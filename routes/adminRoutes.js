// routes/adminRoutes.js - Update the existing adminRoutes.js file

const express = require("express");
const router = express.Router();

// Import admin controllers
const {
  getAdminDashboard,
  getAdminOrders,
  getOrderDetails,
  getAdminProducts,
  getAdminProductDetails,
  getAdminServices,
  getAdminServiceDetails,
  toggleServiceStatus,
  getAdminCustomers,
  getAdminCustomer,
  getAdminSuppliers,
  getAdminSupplier,
  toggleUserAccountStatus,
  getAdminProjects,
  getAdminProject,
} = require("../controllers/adminController");

// Import middleware
const { authorizeAdmin } = require("../middleware/adminAuth");
const { decryptRequest } = require("../middleware/encryption");

// Import validation
const {
  validateToggleServiceStatus,
  validate,
} = require("../utils/adminServiceValidation");

const {
  validateGetProject,
  validate: validationGetProject,
} = require("../utils/adminProjectValidation");

const {
  validateGetCustomer,
  validateGetSupplier,
  validate: validateCustomer,
} = require("../utils/adminCustomerValidation");

const {
  validateToggleUserAccountStatus,
  validate: validateUser,
} = require("../utils/adminUserValidation");

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

// Admin Services Route
router.get("/get_services", getAdminServices);

// Admin Service Details Route
router.post("/get_service", decryptRequest, getAdminServiceDetails);

// NEW: Admin Service Status Toggle Route
router.post(
  "/service_status_toggle",
  decryptRequest,
  validateToggleServiceStatus,
  validate,
  toggleServiceStatus
);

// NEW: Admin Customers Route
router.get("/get_customers", getAdminCustomers);

// NEW: Admin Get Specific Customer Route
router.post(
  "/get_customer",
  decryptRequest,
  validateGetCustomer,
  validateCustomer,
  getAdminCustomer
);

// NEW: Admin Suppliers Route
router.get("/get_suppliers", getAdminSuppliers);

// NEW: Admin Get Specific Supplier Route
router.post(
  "/get_supplier",
  decryptRequest,
  validateGetSupplier,
  validateCustomer,
  getAdminSupplier
);

router.post(
  "/user_account_status_toggle",
  decryptRequest,
  validateToggleUserAccountStatus,
  validateUser,
  toggleUserAccountStatus
);

router.get("/get_projects", getAdminProjects);

router.post(
  "/get_project",
  decryptRequest,
  validateGetProject,
  validationGetProject,
  getAdminProject
);

module.exports = router;
