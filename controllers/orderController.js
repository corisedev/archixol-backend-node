// controllers/orderController.js
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Customer = require("../models/Customer");
const { encryptData } = require("../utils/encryptResponse");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");

// @desc    Get all orders
// @route   GET /supplier/get_all_orders
// @access  Private (Supplier Only)
exports.getAllOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all orders for this supplier
    const orders = await Order.find({
      supplier_id: userId,
    }).sort({ createdAt: -1 }); // Latest first

    // Format orders for response
    const ordersList = orders.map((order) => {
      const orderObj = order.toObject();
      orderObj.id = orderObj._id;
      delete orderObj._id;
      return orderObj;
    });

    const responseData = {
      message: "Orders retrieved successfully",
      orders: ordersList,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get single order by ID
// @route   POST /supplier/get_order
// @access  Private (Supplier Only)
exports.getOrder = async (req, res) => {
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

    // Format order for response
    const orderObj = order.toObject();
    orderObj.id = orderObj._id;
    delete orderObj._id;

    // Try to get customer details if available
    try {
      const customer = await User.findById(orderObj.customer_id).select(
        "username email"
      );
      if (customer) {
        orderObj.customer = {
          id: customer._id,
          username: customer.username,
          email: customer.email,
        };
      }
    } catch (error) {
      console.log("Customer not found in database:", error.message);
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

// @desc    Restock order (restore quantities)
// @route   POST /supplier/restock
// @access  Private (Supplier Only)
exports.restockOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_no } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: "Order number is required" });
    }

    // Find the order
    const order = await Order.findOne({
      order_no,
      supplier_id: userId,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
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

    // Mark order as returned
    order.status = "returned";
    await order.save();

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

// @desc    Update fulfillment status
// @route   POST /supplier/fulfillment_status
// @access  Private (Supplier Only)
exports.updateFulfillmentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_no, fulfillment_status } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: "Order number is required" });
    }

    // Find the order
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

// @desc    Mark order as paid
// @route   POST /supplier/mark_as_paid
// @access  Private (Supplier Only)
exports.markAsPaid = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_no, payment_status } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: "Order number is required" });
    }

    // Find the order
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

// @desc    Mark order as delivered
// @route   POST /supplier/mark_as_delivered
// @access  Private (Supplier Only)
exports.markAsDelivered = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_no, delivery_status } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: "Order number is required" });
    }

    // Find the order
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
      order.status = "completed";
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

// @desc    Send invoice email
// @route   POST /supplier/send_invoice
// @access  Private (Supplier Only)
exports.sendInvoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_no } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: "Order number is required" });
    }

    // Find the order
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

    // Prepare invoice template
    // This is a simplified example. In a real app, you'd have a proper HTML template
    const invoiceTemplate = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .invoice { max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .order-info { margin-bottom: 20px; }
            .products { width: 100%; border-collapse: collapse; }
            .products th, .products td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            .totals { margin-top: 20px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="invoice">
            <div class="header">
              <h1>INVOICE</h1>
              <p>Order #: {{order_no}}</p>
              <p>Date: {{date}}</p>
            </div>
            
            <div class="order-info">
              <p><strong>Bill To:</strong></p>
              <p>{{customer_id}}</p>
              <p>{{shipping_address}}</p>
            </div>
            
            <table class="products">
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
              {{#each products}}
              <tr>
                <td>{{this.title}}</td>
                <td>{{this.qty}}</td>
                <td>{{this.price}}</td>
                <td>{{multiply this.qty this.price}}</td>
              </tr>
              {{/each}}
            </table>
            
            <div class="totals">
              <p><strong>Subtotal:</strong> {{calculations.subtotal}}</p>
              <p><strong>Tax:</strong> {{calculations.totalTax}}</p>
              <p><strong>Discount:</strong> {{calculations.totalDiscount}}</p>
              <p><strong>Total:</strong> {{calculations.total}}</p>
              <p><strong>Amount Paid:</strong> {{bill_paid}}</p>
              <p><strong>Balance Due:</strong> {{balanceDue}}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Register handlebars helper
    handlebars.registerHelper("multiply", function (qty, price) {
      return (qty * price).toFixed(2);
    });

    // Compile template
    const template = handlebars.compile(invoiceTemplate);

    // Prepare data for template
    const invoiceData = {
      ...order.toObject(),
      date: new Date(order.createdAt).toLocaleDateString(),
      balanceDue: (order.calculations.total - order.bill_paid).toFixed(2),
    };

    // Generate invoice HTML
    const invoiceHtml = template(invoiceData);

    // Configure email transport (you'd use your own SMTP settings)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.example.com",
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER || "user@example.com",
        pass: process.env.SMTP_PASS || "password",
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: `"${order.supplier_id.email}" <${order.supplier_id.email}>`,
      to: customerEmail,
      subject: `Invoice for Order ${order.order_no}`,
      html: invoiceHtml,
    });

    const responseData = {
      message: "Invoice sent successfully",
      messageId: info.messageId,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
