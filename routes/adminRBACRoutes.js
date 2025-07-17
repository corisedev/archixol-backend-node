// routes/adminRBACRoutes.js
const express = require("express");
const router = express.Router();

// Import controllers
const {
  createAdmin,
  getAllAdmins,
  getAdmin,
  updateAdmin,
  deleteAdmin,
  toggleAdminStatus,
} = require("../controllers/adminRBACController");

const {
  createRole,
  getAllRoles,
  getRole,
  updateRole,
  deleteRole,
  getAvailablePermissions,
  getRolePermissions,
} = require("../controllers/adminRoleController");

// Import middleware
const {
  authorizeSuperAdmin,
  requirePermission,
} = require("../middleware/adminRBACAuth");
const { decryptRequest } = require("../middleware/encryption");

// Import validation
const {
  validateCreateAdmin,
  validateUpdateAdmin,
  validateGetAdmin,
  validateDeleteAdmin,
  validateToggleAdminStatus,
  validateCreateRole,
  validateUpdateRole,
  validateDeleteRole,
  validate,
} = require("../utils/adminRBACValidation");

// ==================== ADMIN MANAGEMENT ROUTES ====================

// @desc    Create new admin user
// @route   POST /admin/create_admin
// @access  Private (Super Admin Only)
router.post(
  "/create_admin",
  authorizeSuperAdmin,
  decryptRequest,
  validateCreateAdmin,
  validate,
  createAdmin
);

// @desc    Get all admin users
// @route   GET /admin/get_admins
// @access  Private (Super Admin Only)
router.get("/get_admins", authorizeSuperAdmin, getAllAdmins);

// @desc    Update admin user
// @route   POST /admin/update_admin
// @access  Private (Super Admin Only)
router.post(
  "/update_admin",
  authorizeSuperAdmin,
  decryptRequest,
  validateUpdateAdmin,
  validate,
  updateAdmin
);

// @desc    Delete admin user
// @route   POST /admin/delete_admin
// @access  Private (Super Admin Only)
router.post(
  "/delete_admin",
  authorizeSuperAdmin,
  decryptRequest,
  validateDeleteAdmin,
  validate,
  deleteAdmin
);

// @desc    Toggle admin status (activate/deactivate)
// @route   POST /admin/toggle_admin_status
// @access  Private (Super Admin Only)
router.post(
  "/toggle_admin_status",
  authorizeSuperAdmin,
  decryptRequest,
  validateToggleAdminStatus,
  validate,
  toggleAdminStatus
);

// ==================== ROLE MANAGEMENT ROUTES ====================

// @desc    Create new admin role
// @route   POST /admin/create_role
// @access  Private (Super Admin Only)
router.post(
  "/create_role",
  authorizeSuperAdmin,
  decryptRequest,
  validateCreateRole,
  validate,
  createRole
);

// @desc    Get all admin roles
// @route   GET /admin/get_roles
// @access  Private (Admin with manage_admin_roles permission)
router.get("/get_roles", requirePermission("manage_admin_roles"), getAllRoles);

// @desc    Get specific role details
// @route   POST /admin/get_role
// @access  Private (Admin with manage_admin_roles permission)
router.post(
  "/get_role",
  requirePermission("manage_admin_roles"),
  decryptRequest,
  getRole
);

// @desc    Update admin role
// @route   POST /admin/update_role
// @access  Private (Super Admin Only)
router.post(
  "/update_role",
  authorizeSuperAdmin,
  decryptRequest,
  validateUpdateRole,
  validate,
  updateRole
);

// @desc    Delete admin role
// @route   POST /admin/delete_role
// @access  Private (Super Admin Only)
router.post(
  "/delete_role",
  authorizeSuperAdmin,
  decryptRequest,
  validateDeleteRole,
  validate,
  deleteRole
);

// ==================== PERMISSION MANAGEMENT ROUTES ====================

// @desc    Get all available permissions
// @route   GET /admin/get_permissions
// @access  Private (Admin with manage_admin_roles permission)
router.get(
  "/get_permissions",
  requirePermission("manage_admin_roles"),
  getAvailablePermissions
);

// @desc    Get permissions for a specific role
// @route   POST /admin/get_role_permissions
// @access  Private (Admin with manage_admin_roles permission)
router.post(
  "/get_role_permissions",
  requirePermission("manage_admin_roles"),
  decryptRequest,
  getRolePermissions
);

// @desc    Get specific admin details
// @route   POST /admin/get_admin
// @access  Private (Super Admin Only)
router.post(
  "/get_admin",
  authorizeSuperAdmin,
  decryptRequest,
  validateGetAdmin,
  validate,
  getAdmin
);

module.exports = router;
