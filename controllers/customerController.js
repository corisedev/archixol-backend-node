// controllers/customerController.js (Updated to include ClientOrders)
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const ClientOrder = require("../models/ClientOrder"); // Add this import
const { encryptData } = require("../utils/encryptResponse");

// @desc    Get all customers
// @route   GET /supplier/get_all_customers
// @access  Private (Supplier Only)
exports.getAllCustomers = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all customers for this supplier
    const customers = await Customer.find({
      supplier_id: userId,
      status: { $ne: "deleted" }, // Exclude deleted customers
    }).sort({ createdAt: -1 }); // Latest first

    // Format customers for response
    const customersList = customers.map((customer) => {
      const customerObj = customer.toObject();
      customerObj.id = customerObj._id;
      delete customerObj._id;
      return customerObj;
    });

    const responseData = {
      message: "Customers retrieved successfully",
      customers: customersList,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get customer by ID (Updated to include ClientOrders)
// @route   POST /supplier/get_customer
// @access  Private (Supplier Only)
exports.getCustomer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { customer_id } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: "Customer ID is required" });
    }

    // Find the customer
    const customer = await Customer.findOne({
      _id: customer_id,
      supplier_id: userId,
      status: { $ne: "deleted" },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Get customer's legacy orders
    const legacyOrders = await Order.find({
      supplier_id: userId,
      customer_id: customer_id,
    }).sort({ createdAt: -1 });

    // Get customer's client orders (orders placed by client through the new system)
    // We need to match by email since client orders don't directly reference customer_id
    const clientOrders = await ClientOrder.find({
      supplier_id: userId,
      "customer_details.email": customer.email,
    }).sort({ placed_at: -1 });

    // Format legacy orders
    const formattedLegacyOrders = legacyOrders.map((order) => ({
      order_id: order._id,
      order_no: order.order_no,
      product: order.products,
      sub_total: order.calculations.subtotal,
      add_discount: order.calculations.totalDiscount,
      extimated_tax: order.calculations.totalTax,
      total: order.calculations.total,
      notes: order.notes,
      created_at: order.createdAt,
      fulfillment_status: order.fulfillment_status,
      payment_status: order.payment_status,
      order_type: "legacy", // Add order type identifier
    }));

    // Format client orders to match the same structure
    const formattedClientOrders = clientOrders.map((order) => ({
      order_id: order._id,
      order_no: order.order_no,
      product: order.items.map((item) => ({
        id: item.product_id,
        title: item.title,
        price: item.price,
        qty: item.quantity,
        total: item.total,
      })),
      sub_total: order.subtotal,
      add_discount: 0, // Client orders don't have discount structure like legacy orders
      extimated_tax: order.tax,
      total: order.total,
      notes: order.notes,
      created_at: order.placed_at,
      fulfillment_status:
        order.status === "delivered" || order.status === "completed",
      payment_status: order.payment_status === "paid",
      order_type: "client", // Add order type identifier
      // Additional client order specific fields
      shipping: order.shipping,
      status: order.status,
      customer_details: order.customer_details,
    }));

    // Combine both order types and sort by date (newest first)
    const allOrders = [...formattedLegacyOrders, ...formattedClientOrders].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    // Calculate updated statistics based on all orders
    const totalOrderValue = allOrders.reduce(
      (sum, order) => sum + (order.total || 0),
      0
    );
    const totalOrderCount = allOrders.length;

    // Update customer statistics if they differ from database
    if (
      Math.abs(customer.amount_spent - totalOrderValue) > 0.01 ||
      customer.orders_count !== totalOrderCount
    ) {
      customer.amount_spent = totalOrderValue;
      customer.orders_count = totalOrderCount;
      await customer.save();
    }

    // Format customer for response
    const customerObj = customer.toObject();
    customerObj.id = customerObj._id;
    delete customerObj._id;
    customerObj.orders = allOrders;

    // Add summary statistics
    customerObj.order_summary = {
      total_orders: totalOrderCount,
      legacy_orders: formattedLegacyOrders.length,
      client_orders: formattedClientOrders.length,
      total_spent: totalOrderValue,
      last_order_date: allOrders.length > 0 ? allOrders[0].created_at : null,
    };

    const responseData = {
      message: "Customer retrieved successfully",
      customer: customerObj,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Create a new customer
// @route   POST /supplier/create_customer
// @access  Private (Supplier Only)
exports.createCustomer = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      first_name,
      last_name,
      language,
      email,
      phone_number,
      email_subscribe,
      msg_subscribe,
      default_address,
      notes,
    } = req.body;

    // Check if required fields are provided
    if (!first_name || !last_name) {
      return res
        .status(400)
        .json({ error: "First name and last name are required" });
    }

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if email already exists for this supplier
    const existingCustomer = await Customer.findOne({
      supplier_id: userId,
      email: email,
      status: { $ne: "deleted" },
    });

    if (existingCustomer) {
      return res
        .status(400)
        .json({ error: "Customer with this email already exists" });
    }

    // Create new customer
    const customer = await Customer.create({
      supplier_id: userId,
      first_name,
      last_name,
      language: language || "English",
      email,
      phone_number: phone_number || "",
      email_subscribe: email_subscribe || false,
      msg_subscribe: msg_subscribe || false,
      default_address: default_address || "",
      notes: notes || "",
    });

    const responseData = {
      message: "Customer created successfully",
      customer_id: customer._id,
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

// @desc    Update customer
// @route   POST /supplier/update_customer
// @access  Private (Supplier Only)
exports.updateCustomer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { customer_id, ...updateData } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: "Customer ID is required" });
    }

    // Find the customer
    const customer = await Customer.findOne({
      _id: customer_id,
      supplier_id: userId,
      status: { $ne: "deleted" },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Check if email is being changed and if it's already in use
    if (updateData.email && updateData.email !== customer.email) {
      const existingCustomer = await Customer.findOne({
        supplier_id: userId,
        email: updateData.email,
        _id: { $ne: customer_id },
        status: { $ne: "deleted" },
      });

      if (existingCustomer) {
        return res
          .status(400)
          .json({ error: "Email already in use by another customer" });
      }
    }

    // Update customer fields
    Object.keys(updateData).forEach((key) => {
      if (key !== "amount_spent" && key !== "orders_count") {
        // Don't allow updating these fields directly
        customer[key] = updateData[key];
      }
    });

    await customer.save();

    // Get customer's orders (both legacy and client orders) for response
    const legacyOrders = await Order.find({
      supplier_id: userId,
      customer_id: customer_id,
    }).sort({ createdAt: -1 });

    const clientOrders = await ClientOrder.find({
      supplier_id: userId,
      "customer_details.email": customer.email,
    }).sort({ placed_at: -1 });

    // Format orders for response (same as in getCustomer)
    const formattedLegacyOrders = legacyOrders.map((order) => ({
      order_id: order._id,
      order_no: order.order_no,
      product: order.products,
      sub_total: order.calculations.subtotal,
      add_discount: order.calculations.totalDiscount,
      extimated_tax: order.calculations.totalTax,
      total: order.calculations.total,
      notes: order.notes,
      created_at: order.createdAt,
      order_type: "legacy",
    }));

    const formattedClientOrders = clientOrders.map((order) => ({
      order_id: order._id,
      order_no: order.order_no,
      product: order.items.map((item) => ({
        id: item.product_id,
        title: item.title,
        price: item.price,
        qty: item.quantity,
        total: item.total,
      })),
      sub_total: order.subtotal,
      add_discount: 0,
      extimated_tax: order.tax,
      total: order.total,
      notes: order.notes,
      created_at: order.placed_at,
      order_type: "client",
    }));

    const allOrders = [...formattedLegacyOrders, ...formattedClientOrders].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    // Format customer for response
    const customerObj = customer.toObject();
    customerObj.id = customerObj._id;
    delete customerObj._id;
    customerObj.orders = allOrders;

    const responseData = {
      message: "Customer updated successfully",
      customer: customerObj,
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

// @desc    Delete customer (soft delete)
// @route   POST /supplier/delete_customer
// @access  Private (Supplier Only)
exports.deleteCustomer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { customer_id } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: "Customer ID is required" });
    }

    // Find the customer
    const customer = await Customer.findOne({
      _id: customer_id,
      supplier_id: userId,
      status: { $ne: "deleted" },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Soft delete by setting status to deleted
    customer.status = "deleted";
    await customer.save();

    const responseData = {
      message: "Customer deleted successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
