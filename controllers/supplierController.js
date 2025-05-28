// controllers/supplierController.js (Updated to include ClientOrders)
const User = require("../models/User");
const SupplierStore = require("../models/SupplierStore");
const { encryptData } = require("../utils/encryptResponse");
const Product = require("../models/Product");
const Order = require("../models/Order");
const ClientOrder = require("../models/ClientOrder"); // Add this import
const Customer = require("../models/Customer");

// @desc    Get supplier global data
// @route   GET /supplier/global_data
// @access  Private (Supplier Only)
exports.getGlobalData = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is a supplier
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.user_type !== "supplier") {
      return res
        .status(403)
        .json({ error: "Access denied. User is not a supplier" });
    }

    // Get or create supplier store data
    let supplierStore = await SupplierStore.findOne({ user_id: userId });

    if (!supplierStore) {
      // Create default supplier store settings
      supplierStore = await SupplierStore.create({
        user_id: userId,
      });
    }

    // Prepare response object
    const responseData = {
      message: "Supplier data retrieved successfully.",
      store_data: {
        store_logo: supplierStore.store_logo || "",
        store_name: supplierStore.store_name || "",
        email: supplierStore.email || user.email || "",
        currency: supplierStore.currency || "PKR",
        time_zone: supplierStore.time_zone || "Asia/Karachi",
      },
      tax_data: {
        is_auto_apply_tax: supplierStore.is_auto_apply_tax || true,
        default_tax_rate: supplierStore.default_tax_rate || "10",
        reg_number: supplierStore.reg_number || "",
      },
      user_data: {
        recovery_phone: supplierStore.recovery_phone || "",
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update supplier global data
// @route   POST /supplier/update_global_data
// @access  Private (Supplier Only)
exports.updateGlobalData = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      store_logo,
      store_name,
      email,
      currency,
      time_zone,
      is_auto_apply_tax,
      default_tax_rate,
      reg_number,
      recovery_phone,
    } = req.body;

    // Check if user is a supplier
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.user_type !== "supplier") {
      return res
        .status(403)
        .json({ error: "Access denied. User is not a supplier" });
    }

    // Find or create supplier store
    let supplierStore = await SupplierStore.findOne({ user_id: userId });

    if (!supplierStore) {
      supplierStore = new SupplierStore({ user_id: userId });
    }

    // Update fields if provided
    if (store_logo !== undefined) supplierStore.store_logo = store_logo;
    if (store_name !== undefined) supplierStore.store_name = store_name;
    if (email !== undefined) supplierStore.email = email;
    if (currency !== undefined) supplierStore.currency = currency;
    if (time_zone !== undefined) supplierStore.time_zone = time_zone;
    if (is_auto_apply_tax !== undefined)
      supplierStore.is_auto_apply_tax = is_auto_apply_tax;
    if (default_tax_rate !== undefined)
      supplierStore.default_tax_rate = default_tax_rate;
    if (reg_number !== undefined) supplierStore.reg_number = reg_number;
    if (recovery_phone !== undefined)
      supplierStore.recovery_phone = recovery_phone;

    // Save updated store
    await supplierStore.save();

    // Prepare response
    const responseData = {
      message: "Supplier data updated successfully.",
      store_data: {
        store_logo: supplierStore.store_logo || "",
        store_name: supplierStore.store_name || "",
        email: supplierStore.email || "",
        currency: supplierStore.currency || "PKR",
        time_zone: supplierStore.time_zone || "Asia/Karachi",
      },
      tax_data: {
        is_auto_apply_tax: supplierStore.is_auto_apply_tax,
        default_tax_rate: supplierStore.default_tax_rate || "10",
        reg_number: supplierStore.reg_number || "",
      },
      user_data: {
        recovery_phone: supplierStore.recovery_phone || "",
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get supplier dashboard data (Updated to include ClientOrders)
// @route   GET /supplier/dashboard
// @access  Private (Supplier Only)
exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is a supplier
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.user_type !== "supplier") {
      return res
        .status(403)
        .json({ error: "Access denied. User is not a supplier" });
    }

    // Get all legacy orders
    const legacyOrders = await Order.find({ supplier_id: userId });

    // Get all client orders (new orders)
    const clientOrders = await ClientOrder.find({ supplier_id: userId });

    // Combine both order types
    const allOrders = [
      ...legacyOrders.map((order) => ({
        ...order.toObject(),
        order_type: "legacy",
        total: order.calculations?.total || 0,
        status: order.status,
        createdAt: order.createdAt,
      })),
      ...clientOrders.map((order) => ({
        ...order.toObject(),
        order_type: "client",
        total: order.total,
        status: order.status,
        createdAt: order.placed_at,
      })),
    ];

    // Filter for completed/delivered orders for sales calculations
    const completedOrders = allOrders.filter(
      (order) => order.status === "completed" || order.status === "delivered"
    );

    // Get total sales from only completed/delivered orders
    const totalSale = completedOrders.reduce((acc, order) => {
      return acc + (order.total || 0);
    }, 0);

    // Get order count (all orders)
    const ordersCount = allOrders.length;

    // Get total unique clients from both order types
    const uniqueClients = new Set();

    // Add clients from legacy orders
    legacyOrders.forEach((order) => {
      if (order.customer_id) {
        uniqueClients.add(order.customer_id.toString());
      }
    });

    // Add clients from client orders
    clientOrders.forEach((order) => {
      if (order.client_id) {
        uniqueClients.add(order.client_id.toString());
      }
    });

    const totalClients = uniqueClients.size;

    // Get unfulfilled orders (pending/processing/returned)
    const unfulfilledOrders = allOrders.filter(
      (order) =>
        order.status === "pending" ||
        order.status === "processing" ||
        order.status === "returned"
    ).length;

    // Get product stock data (products with quantity < min_qty)
    const products = await Product.find({
      supplier_id: userId,
      status: "active",
    });

    const lowStockProducts = products
      .filter((product) => product.quantity < product.min_qty)
      .map((product) => ({
        id: product._id,
        title: product.title,
        quantity: product.quantity,
        min_qty: product.min_qty,
      }));

    // Calculate monthly sales data (last 6 months) - Updated to include both order types
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const salesData = [];

    // Get current date
    const currentDate = new Date();

    // Generate sales data for last 6 months
    for (let i = 5; i >= 0; i--) {
      const month = new Date(currentDate);
      month.setMonth(currentDate.getMonth() - i);

      const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
      const endOfMonth = new Date(
        month.getFullYear(),
        month.getMonth() + 1,
        0,
        23,
        59,
        59
      );

      // Find completed/delivered orders for this month from both order types
      const monthlyOrders = completedOrders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= startOfMonth && orderDate <= endOfMonth;
      });

      // Calculate total sales for this month
      const monthlySales = monthlyOrders.reduce((acc, order) => {
        return acc + (order.total || 0);
      }, 0);

      // Add month to the data
      salesData.push({
        month: monthNames[month.getMonth()],
        total_sales: Number(monthlySales.toFixed(2)),
      });
    }

    // Prepare response data
    const responseData = {
      dashboard_data: {
        message: "Supplier dashboard data retrieved successfully.",
        total_sale: Number(totalSale.toFixed(2)),
        orders_count: ordersCount,
        total_clients: totalClients,
        product_stock_count: lowStockProducts.length,
        product_stock: lowStockProducts,
        orders_unfullfilled: unfulfilledOrders,
        sales_data: salesData,
        // Additional info about order types
        order_breakdown: {
          legacy_orders: legacyOrders.length,
          client_orders: clientOrders.length,
          total_orders: ordersCount,
        },
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
