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
  getAdminServiceProviders,
  getAdminServiceProvider,
  getAdminCompanies,
  getAdminCompany,
  deleteUser,
  deleteProject,
  deleteService,
  deleteProduct,
  deleteOrder,
  deleteCustomer,
  deleteCollection,
  deleteCompany,
  deleteVendor,
  deletePurchaseOrder,
  deleteDiscount,
  deleteNotification,
  deleteSiteBuilder,
  bulkDeleteUsers,
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
  validateDeleteUser,
  validateDeleteProject,
  validateDeleteService,
  validateDeleteProduct,
  validateDeleteOrder,
  validateDeleteCustomer,
  validateDeleteCollection,
  validateDeleteCompany,
  validateDeleteVendor,
  validateDeletePurchaseOrder,
  validateDeleteDiscount,
  validateDeleteNotification,
  validateDeleteSiteBuilder,
  validateBulkDeleteUsers,
  validate: validateDelete,
} = require("../utils/adminDeleteValidation");

const {
  validateGetCustomer,
  validateGetSupplier,
  validateGetServiceProvider,
  validateGetCompany,
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

router.get("/get_service_providers", getAdminServiceProviders);

router.post(
  "/get_service_provider",
  decryptRequest,
  validateGetServiceProvider,
  validateCustomer,
  getAdminServiceProvider
);

router.get("/get_companies", getAdminCompanies);

router.post(
  "/get_company",
  decryptRequest,
  validateGetCompany,
  validateCustomer,
  getAdminCompany
);

// @desc    Delete a user
// @route   POST /admin/delete_user
// @access  Private (Admin Only)
router.post(
  "/delete_user",
  decryptRequest,
  validateDeleteUser,
  validateDelete,
  deleteUser
);

// @desc    Bulk delete users
// @route   POST /admin/bulk_delete_users
// @access  Private (Admin Only)
router.post(
  "/bulk_delete_users",
  decryptRequest,
  validateBulkDeleteUsers,
  validateDelete,
  bulkDeleteUsers
);

// ==================== PROJECT MANAGEMENT DELETE ROUTES ====================

// @desc    Delete a project
// @route   POST /admin/delete_project
// @access  Private (Admin Only)
router.post(
  "/delete_project",
  decryptRequest,
  validateDeleteProject,
  validateDelete,
  deleteProject
);

// ==================== SERVICE MANAGEMENT DELETE ROUTES ====================

// @desc    Delete a service
// @route   POST /admin/delete_service
// @access  Private (Admin Only)
router.post(
  "/delete_service",
  decryptRequest,
  validateDeleteService,
  validateDelete,
  deleteService
);

// ==================== PRODUCT MANAGEMENT DELETE ROUTES ====================

// @desc    Delete a product
// @route   POST /admin/delete_product
// @access  Private (Admin Only)
router.post(
  "/delete_product",
  decryptRequest,
  validateDeleteProduct,
  validateDelete,
  deleteProduct
);

// @desc    Delete a collection
// @route   POST /admin/delete_collection
// @access  Private (Admin Only)
router.post(
  "/delete_collection",
  decryptRequest,
  validateDeleteCollection,
  validateDelete,
  deleteCollection
);

// ==================== ORDER MANAGEMENT DELETE ROUTES ====================

// @desc    Delete an order
// @route   POST /admin/delete_order
// @access  Private (Admin Only)
router.post(
  "/delete_order",
  decryptRequest,
  validateDeleteOrder,
  validateDelete,
  deleteOrder
);

// ==================== CUSTOMER MANAGEMENT DELETE ROUTES ====================

// @desc    Delete a customer
// @route   POST /admin/delete_customer
// @access  Private (Admin Only)
router.post(
  "/delete_customer",
  decryptRequest,
  validateDeleteCustomer,
  validateDelete,
  deleteCustomer
);

// ==================== VENDOR MANAGEMENT DELETE ROUTES ====================

// @desc    Delete a vendor
// @route   POST /admin/delete_vendor
// @access  Private (Admin Only)
router.post(
  "/delete_vendor",
  decryptRequest,
  validateDeleteVendor,
  validateDelete,
  deleteVendor
);

// ==================== PURCHASE ORDER DELETE ROUTES ====================

// @desc    Delete a purchase order
// @route   POST /admin/delete_purchase_order
// @access  Private (Admin Only)
router.post(
  "/delete_purchase_order",
  decryptRequest,
  validateDeletePurchaseOrder,
  validateDelete,
  deletePurchaseOrder
);

// ==================== COMPANY MANAGEMENT DELETE ROUTES ====================

// @desc    Delete a company
// @route   POST /admin/delete_company
// @access  Private (Admin Only)
router.post(
  "/delete_company",
  decryptRequest,
  validateDeleteCompany,
  validateDelete,
  deleteCompany
);

// ==================== DISCOUNT MANAGEMENT DELETE ROUTES ====================

// @desc    Delete a discount
// @route   POST /admin/delete_discount
// @access  Private (Admin Only)
router.post(
  "/delete_discount",
  decryptRequest,
  validateDeleteDiscount,
  validateDelete,
  deleteDiscount
);

// ==================== NOTIFICATION MANAGEMENT DELETE ROUTES ====================

// @desc    Delete a notification
// @route   POST /admin/delete_notification
// @access  Private (Admin Only)
router.post(
  "/delete_notification",
  decryptRequest,
  validateDeleteNotification,
  validateDelete,
  deleteNotification
);

// ==================== SITE BUILDER DELETE ROUTES ====================

// @desc    Delete site builder data
// @route   POST /admin/delete_site_builder
// @access  Private (Admin Only)
router.post(
  "/delete_site_builder",
  decryptRequest,
  validateDeleteSiteBuilder,
  validateDelete,
  deleteSiteBuilder
);

module.exports = router;
