const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPasswordWithToken,
  updatePassword,
  getCurrentUser,
  becomeCompany,
  becomeSupplier,
  becomeServiceProvider,
} = require("../controllers/authController");

// Import role switch controller
const { switchRole } = require("../controllers/roleSwitchController");

// Import role switch validation
const {
  validateRoleSwitch,
  validate: validateRole,
} = require("../utils/roleSwitchValidation");

// Import notification controllers
const {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  getUnreadNotificationsCount,
  deleteNotification,
  deleteAllNotifications,
} = require("../controllers/notificationController");

// Import notification validation
const {
  validateMarkAllRead,
  validateMarkNotificationRead,
  validateDeleteNotification,
  validateDeleteAllNotifications,
  validateGetNotifications,
  validate,
} = require("../utils/notificationValidation");

const { protect } = require("../middleware/auth");
const { decryptRequest } = require("../middleware/encryption");

const conditionalDecrypt = (req, res, next) => {
  // Skip decryption for GET routes or routes that don't send encrypted data
  if (req.path.includes("/verify_email/") || req.method === "GET") {
    return next();
  }
  // Apply decryption for POST routes
  return decryptRequest(req, res, next);
};

// Apply conditional decryption middleware to all routes
router.use(conditionalDecrypt);

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.get("/verify_email/:token", verifyEmail);
router.post("/resend_email", resendVerificationEmail);
router.post("/forgot_password", forgotPassword);
router.post("/reset_password/:token", resetPasswordWithToken);

// Protected routes
router.post("/update_password", protect, updatePassword);
router.get("/me", protect, getCurrentUser);
router.post("/become_company", protect, becomeCompany);
router.post("/become_a_supplier", protect, becomeSupplier);
router.post("/become_a_service_provider", protect, becomeServiceProvider);

// ==================== NEW ROLE SWITCH ROUTE ====================

// @desc    Switch user's active role
// @route   POST /account/role_switch
// @access  Private
router.post(
  "/role_switch",
  protect,
  validateRoleSwitch,
  validateRole,
  switchRole
);

// ==================== NOTIFICATION ROUTES ====================

// @desc    Get all notifications for authenticated user
// @route   GET /account/get_notifications
// @access  Private
router.get(
  "/get_notifications",
  protect,
  validateGetNotifications,
  validate,
  getNotifications
);

// @desc    Mark all notifications as read
// @route   POST /account/mark_all_read_notifications
// @access  Private
router.post(
  "/mark_all_read_notifications",
  protect,
  validateMarkAllRead,
  validate,
  markAllNotificationsRead
);

// @desc    Mark specific notification as read
// @route   POST /account/mark_notification_read
// @access  Private
router.post(
  "/mark_notification_read",
  protect,
  validateMarkNotificationRead,
  validate,
  markNotificationRead
);

// @desc    Get unread notifications count
// @route   GET /account/unread_notifications_count
// @access  Private
router.get("/unread_notifications_count", protect, getUnreadNotificationsCount);

// @desc    Delete specific notification
// @route   POST /account/delete_notification
// @access  Private
router.post(
  "/delete_notification",
  protect,
  validateDeleteNotification,
  validate,
  deleteNotification
);

// @desc    Delete all notifications
// @route   POST /account/delete_all_notifications
// @access  Private
router.post(
  "/delete_all_notifications",
  protect,
  validateDeleteAllNotifications,
  validate,
  deleteAllNotifications
);

module.exports = router;
