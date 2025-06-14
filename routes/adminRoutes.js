// routes/adminRoutes.js
const express = require("express");
const router = express.Router();

// Import admin controllers
const {
  getAdminDashboard,
  getAdminOrders,
  getOrderDetails,
  getAdminProducts,
  getAdminProductDetails,
} = require("../controllers/adminController");

// Import middleware
const { authorizeAdmin } = require("../middleware/adminAuth");
const { decryptRequest } = require("../middleware/encryption");

// Apply admin authorization to all routes
router.use(authorizeAdmin);

// Admin Dashboard Routes
router.get("/dashboard", getAdminDashboard);

// Admin Orders Routes
router.get("/get_orders", getAdminOrders);

// Admin Order Details Route
router.post("/get_order_details", decryptRequest, getOrderDetails);

// Admin Products Routes
router.get("/get_products", getAdminProducts);

// Admin Product Details Route
router.post("/get_product_details", decryptRequest, getAdminProductDetails);

module.exports = router;
