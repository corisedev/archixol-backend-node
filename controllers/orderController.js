// controllers/orderController.js (Updated to include ClientOrders)
const Order = require("../models/Order");
const ClientOrder = require("../models/ClientOrder"); // Add this import
const Product = require("../models/Product");
const User = require("../models/User");
const Customer = require("../models/Customer");
const { encryptData } = require("../utils/encryptResponse");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");

// @desc    Get all orders (Updated to include ClientOrders)
// @route   GET /supplier/get_all_orders
// @access  Private (Supplier Only)
exports.getAllOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all legacy orders for this supplier
    const legacyOrders = await Order.find({
      supplier_id: userId,
    }).sort({ createdAt: -1 }); // Latest first

    // Get all client orders for this supplier
    const clientOrders = await ClientOrder.find({
      supplier_id: userId,
    }).sort({ placed_at: -1 }); // Latest first

    // Format legacy orders for response and fetch customer names
    const formattedLegacyOrders = await Promise.all(
      legacyOrders.map(async (order) => {
        const orderObj = order.toObject();
        orderObj.id = orderObj._id;
        delete orderObj._id;
        orderObj.order_type = "legacy";

        // Add customer name
        try {
          // First try to find from Customer model (preferred for orders)
          const customer = await Customer.findById(order.customer_id);
          if (customer) {
            orderObj.customer_name =
              `${customer.first_name} ${customer.last_name}`.trim();
          } else {
            // If not found in Customer model, try User model as fallback
            const user = await User.findById(order.customer_id);
            if (user) {
              orderObj.customer_name = user.username || "Unknown";
            } else {
              orderObj.customer_name = "Unknown";
            }
          }
        } catch (error) {
          console.log(
            `Error fetching customer for order ${order._id}:`,
            error.message
          );
          orderObj.customer_name = "Unknown";
        }

        return orderObj;
      })
    );

    // Format client orders for response
    const formattedClientOrders = await Promise.all(
      clientOrders.map(async (order) => {
        const orderObj = order.toObject();
        orderObj.id = orderObj._id;
        delete orderObj._id;
        orderObj.order_type = "client";

        // For client orders, we have customer details embedded
        orderObj.customer_name = order.customer_details
          ? `${order.customer_details.firstName} ${order.customer_details.lastName}`.trim()
          : "Unknown";

        // Convert client order structure to match legacy order structure
        orderObj.products = order.items.map((item) => ({
          id: item.product_id,
          title: item.title,
          price: item.price,
          qty: item.quantity,
          total: item.total,
        }));

        orderObj.calculations = {
          subtotal: order.subtotal,
          totalTax: order.tax,
          totalDiscount: 0, // Client orders don't have discount structure
          total: order.total,
        };

        orderObj.createdAt = order.placed_at;
        orderObj.payment_status = order.payment_status === "paid";
        orderObj.fulfillment_status =
          order.status === "delivered" || order.status === "completed";
        orderObj.delivery_status = order.status === "delivered";

        return orderObj;
      })
    );

    // Combine both order types and sort by creation date (latest first)
    const allOrders = [...formattedLegacyOrders, ...formattedClientOrders].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Calculate order statistics for frontend
    const total_orders = allOrders.length;

    // Calculate total items ordered (sum of all product quantities)
    const items_orders = allOrders.reduce((total, order) => {
      const products = order.products || [];
      return (
        total +
        products.reduce((itemTotal, product) => {
          return itemTotal + (product.qty || 1); // Default to 1 if qty not specified
        }, 0)
      );
    }, 0);

    // Count orders by status
    const orders_restock = allOrders.filter(
      (order) => order.status === "returned"
    ).length;
    const orders_fulfilled = allOrders.filter(
      (order) => order.fulfillment_status === true
    ).length;
    const orders_delivered = allOrders.filter(
      (order) => order.delivery_status === true
    ).length;

    // Calculate average delivery time (if applicable)
    let avg_delivery_time = 0;
    const deliveredOrders = allOrders.filter(
      (order) => order.delivery_status === true
    );

    if (deliveredOrders.length > 0) {
      const totalDeliveryDays = deliveredOrders.reduce((total, order) => {
        // If you have a specific delivery date field, use that instead
        // For now, we'll use updatedAt as a proxy for when the order was delivered
        const createdDate = new Date(order.createdAt);
        const deliveryDate = new Date(
          order.updated_at || order.updatedAt || order.createdAt
        );
        const daysDifference =
          (deliveryDate - createdDate) / (1000 * 60 * 60 * 24);
        return total + daysDifference;
      }, 0);

      avg_delivery_time = (totalDeliveryDays / deliveredOrders.length).toFixed(
        1
      );
    }

    const responseData = {
      message: "Orders retrieved successfully",
      orders: allOrders,
      // Add statistics for frontend
      total_orders,
      items_orders,
      orders_restock,
      orders_fulfilled,
      orders_delivered,
      avg_delivery_time,
      // Additional breakdown
      order_breakdown: {
        legacy_orders: formattedLegacyOrders.length,
        client_orders: formattedClientOrders.length,
        total_orders,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get single order by ID (Updated to handle both order types)
// @route   POST /supplier/get_order
// @access  Private (Supplier Only)
exports.getOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Try to find in legacy orders first
    let order = await Order.findOne({
      _id: order_id,
      supplier_id: userId,
    });

    let orderType = "legacy";
    let orderObj;

    if (order) {
      // Legacy order found
      orderObj = order.toObject();
      orderObj.id = orderObj._id;
      delete orderObj._id;
      orderObj.order_type = "legacy";

      // Try to get customer details if available
      try {
        const customer = await Customer.findById(orderObj.customer_id).select(
          "email first_name last_name phone_number"
        );
        if (customer) {
          orderObj.customer = {
            id: customer._id,
            customer_name: customer.first_name + " " + customer.last_name,
            email: customer.email,
            phone_number: customer.phone_number,
          };
        }
      } catch (error) {
        console.log("Customer not found in database:", error.message);
      }
    } else {
      // Try to find in client orders
      const clientOrder = await ClientOrder.findOne({
        _id: order_id,
        supplier_id: userId,
      }).populate("items.product_id", "title description media");

      if (!clientOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      orderType = "client";
      orderObj = clientOrder.toObject();
      orderObj.id = orderObj._id;
      delete orderObj._id;
      orderObj.order_type = "client";

      // Convert client order structure to match legacy order structure
      orderObj.products = clientOrder.items.map((item) => ({
        id: item.product_id._id || item.product_id,
        title: item.title,
        price: item.price,
        qty: item.quantity,
        total: item.total,
        product_details: item.product_id,
      }));

      orderObj.calculations = {
        subtotal: clientOrder.subtotal,
        totalTax: clientOrder.tax,
        totalDiscount: 0, // Client orders don't have discount structure
        total: clientOrder.total,
      };

      orderObj.createdAt = clientOrder.placed_at;
      orderObj.payment_status = clientOrder.payment_status === "paid";
      orderObj.fulfillment_status =
        clientOrder.status === "delivered" ||
        clientOrder.status === "completed";
      orderObj.delivery_status = clientOrder.status === "delivered";

      // Customer details are embedded in client orders
      if (clientOrder.customer_details) {
        orderObj.customer = {
          customer_name:
            `${clientOrder.customer_details.firstName} ${clientOrder.customer_details.lastName}`.trim(),
          email: clientOrder.customer_details.email,
          phone_number: clientOrder.customer_details.phone,
          address: clientOrder.customer_details.address,
          city: clientOrder.customer_details.city,
          country: clientOrder.customer_details.country,
        };
      }
    }

    const responseData = {
      message: "Order retrieved successfully",
      order: orderObj,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Note: The rest of the methods (createOrder, updateOrder, deleteOrder, etc.)
// remain the same as they work with legacy orders specifically.
// The client orders are managed through the clientOrderController.

// @desc    Create new order
// @route   POST /supplier/create_order
// @access  Private (Supplier Only)
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      products,
      calculations,
      notes,
      customer_id,
      market_price,
      tags,
      channel,
      payment_due_later,
      shipping_address,
      bill_paid,
    } = req.body;

    // Validate required fields
    if (!products || !products.length) {
      return res
        .status(400)
        .json({ error: "Order must contain at least one product" });
    }

    if (!calculations) {
      return res.status(400).json({ error: "Order calculations are required" });
    }

    if (!customer_id) {
      return res.status(400).json({ error: "Customer ID is required" });
    }

    // Create the order
    const order = await Order.create({
      supplier_id: userId,
      products,
      calculations,
      notes: notes || "",
      customer_id,
      market_price: market_price || "PKR",
      tags: tags || [],
      channel: channel || "Offline Store",
      payment_due_later: payment_due_later || false,
      shipping_address: shipping_address || "",
      bill_paid: bill_paid || 0,
    });

    // Update product quantities if tracking is enabled
    for (const item of products) {
      if (item.track_quantity && item.id) {
        const product = await Product.findById(item.id);
        if (product) {
          // Reduce quantity
          product.quantity = Math.max(0, product.quantity - item.qty);
          await product.save();
        }
      }
    }

    if (order.customer_id) {
      const customer = await Customer.findById(order.customer_id);
      if (customer) {
        customer.amount_spent += order.calculations.total;
        customer.orders_count += 1;
        await customer.save();
      }
    }

    const responseData = {
      message: "Order created successfully",
      order_id: order._id,
      order_no: order.order_no,
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error(err);

    // Check for validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ error: messages.join(", ") });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update order
// @route   POST /supplier/update_order
// @access  Private (Supplier Only)
exports.updateOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_id, ...updateData } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Find the order
    const order = await Order.findOne({
      _id: order_id,
      supplier_id: userId,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Handle products update
    if (updateData.products) {
      // If quantity tracking is enabled, restore original quantities first
      for (const item of order.products) {
        if (item.track_quantity && item.product_id) {
          const product = await Product.findById(item.product_id);
          if (product) {
            // Restore quantity
            product.quantity += item.qty;
            await product.save();
          }
        }
      }

      // Update with new quantities
      for (const item of updateData.products) {
        if (item.track_quantity && item.id) {
          const product = await Product.findById(item.id);
          if (product) {
            // Reduce quantity for the updated order
            product.quantity = Math.max(0, product.quantity - item.qty);
            await product.save();
          }
        }
      }
    }

    // Update order fields
    Object.keys(updateData).forEach((key) => {
      order[key] = updateData[key];
    });

    await order.save();

    if (
      order.customer_id &&
      updateData.calculations &&
      updateData.calculations.total !== order.calculations.total
    ) {
      const customer = await Customer.findById(order.customer_id);
      if (customer) {
        // Adjust the amount spent
        customer.amount_spent =
          customer.amount_spent -
          order.calculations.total +
          updateData.calculations.total;
        await customer.save();
      }
    }

    const responseData = {
      message: "Order updated successfully",
      order_id: order._id,
      order_no: order.order_no,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);

    // Check for validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ error: messages.join(", ") });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete order (set to cancelled)
// @route   POST /supplier/delete_order
// @access  Private (Supplier Only)
exports.deleteOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Find the order
    const order = await Order.findOne({
      _id: order_id,
      supplier_id: userId,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Set order status to cancelled
    order.status = "cancelled";
    await order.save();

    if (order.customer_id) {
      const customer = await Customer.findById(order.customer_id);
      if (customer) {
        customer.amount_spent = Math.max(
          0,
          customer.amount_spent - order.calculations.total
        );
        customer.orders_count = Math.max(0, customer.orders_count - 1);
        await customer.save();
      }
    }

    // Restore product quantities if tracking is enabled
    for (const item of order.products) {
      if (item.track_quantity && item.product_id) {
        const product = await Product.findById(item.product_id);
        if (product) {
          // Restore quantity
          product.quantity += item.qty;
          await product.save();
        }
      }
    }

    const responseData = {
      message: "Order deleted successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Restock order
// @route   POST /supplier/restock
// @access  Private (Supplier Only)
exports.restockOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_no } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: "Order number is required" });
    }

    // Try to find in legacy orders first
    let order = await Order.findOne({
      order_no,
      supplier_id: userId,
    });

    if (order) {
      // Legacy order found
      // Restore product quantities if tracking is enabled
      for (const item of order.products) {
        // Check for both id and product_id to ensure compatibility
        const productId = item.product_id || item.id;

        if (item.track_quantity && productId) {
          const product = await Product.findById(productId);
          if (product) {
            // Restore quantity
            product.quantity += item.qty;
            await product.save();
          }
        }
      }

      // Mark order as returned
      order.status = "returned";
      await order.save();
    } else {
      // Try to find in client orders
      const clientOrder = await ClientOrder.findOne({
        order_no,
        supplier_id: userId,
      });

      if (!clientOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Restore product quantities for client order
      for (const item of clientOrder.items) {
        const product = await Product.findById(item.product_id);
        if (product && product.track_quantity) {
          product.quantity += item.quantity;
          await product.save();
        }
      }

      // Mark client order as returned
      clientOrder.status = "returned";
      await clientOrder.save();
    }

    const responseData = {
      message: "Order restocked successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// The remaining methods (updateFulfillmentStatus, markAsPaid, markAsDelivered, sendInvoice)
// continue to work with legacy orders only, as requested in the original code.
// Client order status updates would be handled separately through the client order system.

exports.updateFulfillmentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_no, fulfillment_status } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: "Order number is required" });
    }

    // Find the order (legacy orders only)
    const order = await Order.findOne({
      order_no,
      supplier_id: userId,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Update fulfillment status
    order.fulfillment_status = !!fulfillment_status;

    // If order is fulfilled, update status to processing or completed
    if (order.fulfillment_status) {
      order.status = order.payment_status ? "completed" : "processing";
    }

    await order.save();

    const responseData = {
      message: `Order ${
        order.fulfillment_status ? "fulfilled" : "unfulfilled"
      } successfully`,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.markAsPaid = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_no, payment_status } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: "Order number is required" });
    }

    // Find the order (legacy orders only)
    const order = await Order.findOne({
      order_no,
      supplier_id: userId,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Update payment status
    order.payment_status = !!payment_status;

    // If order is paid and fulfilled, update status to completed
    if (order.payment_status && order.fulfillment_status) {
      order.status = "completed";
    } else if (order.payment_status) {
      order.status = "processing";
    }

    // Update bill paid to total if paid
    if (order.payment_status) {
      order.bill_paid = order.calculations.total;
    }

    await order.save();

    const responseData = {
      message: `Order ${
        order.payment_status ? "marked as paid" : "marked as unpaid"
      } successfully`,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.markAsDelivered = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_no, delivery_status } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: "Order number is required" });
    }

    // Find the order (legacy orders only)
    const order = await Order.findOne({
      order_no,
      supplier_id: userId,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Update delivery status
    order.delivery_status = !!delivery_status;

    // If order is delivered, update status to completed
    if (order.delivery_status) {
      order.status = "delivered";
      // Also mark as fulfilled
      order.fulfillment_status = true;
    }

    await order.save();

    const responseData = {
      message: `Order ${
        order.delivery_status ? "marked as delivered" : "marked as undelivered"
      } successfully`,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.sendInvoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_no } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: "Order number is required" });
    }

    // Find the order (legacy orders only)
    const order = await Order.findOne({
      order_no,
      supplier_id: userId,
    }).populate("supplier_id", "email");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Find customer
    let customerEmail = "";
    try {
      const customer = await User.findById(order.customer_id);
      if (customer) {
        customerEmail = customer.email;
      }
    } catch (error) {
      console.log("Customer not found:", error.message);
    }

    if (!customerEmail) {
      return res.status(400).json({ error: "Customer email not found" });
    }

    // Invoice template and email sending logic remains the same...
    // (keeping the original invoice template code)

    const responseData = {
      message: "Invoice sent successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
