// utils/notificationValidation.js
const { body, query, validationResult } = require("express-validator");

// Validate mark all notifications read request
exports.validateMarkAllRead = [
  body("isReadAll")
    .notEmpty()
    .withMessage("isReadAll is required")
    .isBoolean()
    .withMessage("isReadAll must be a boolean")
    .custom((value) => {
      if (value !== true) {
        throw new Error("isReadAll must be true");
      }
      return true;
    }),
];

// Validate mark single notification read request
exports.validateMarkNotificationRead = [
  body("notification_id")
    .notEmpty()
    .withMessage("Notification ID is required")
    .isMongoId()
    .withMessage("Invalid notification ID format"),
];

// Validate delete notification request
exports.validateDeleteNotification = [
  body("notification_id")
    .notEmpty()
    .withMessage("Notification ID is required")
    .isMongoId()
    .withMessage("Invalid notification ID format"),
];

// Validate delete all notifications request
exports.validateDeleteAllNotifications = [
  body("confirmDelete")
    .notEmpty()
    .withMessage("confirmDelete is required")
    .isBoolean()
    .withMessage("confirmDelete must be a boolean")
    .custom((value) => {
      if (value !== true) {
        throw new Error("confirmDelete must be true");
      }
      return true;
    }),
];

// Validate get notifications query parameters
exports.validateGetNotifications = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// Validate create notification request (for admin/system use)
exports.validateCreateNotification = [
  body("recipient")
    .notEmpty()
    .withMessage("Recipient is required")
    .isMongoId()
    .withMessage("Invalid recipient ID format"),

  body("type")
    .notEmpty()
    .withMessage("Notification type is required")
    .isIn(["project", "message", "payment", "system"])
    .withMessage("Invalid notification type"),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Notification title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot be more than 200 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Notification description is required")
    .isLength({ max: 1000 })
    .withMessage("Description cannot be more than 1000 characters"),

  body("sender").optional().isMongoId().withMessage("Invalid sender ID format"),

  body("conversation")
    .optional()
    .isMongoId()
    .withMessage("Invalid conversation ID format"),

  body("data").optional().isObject().withMessage("Data must be an object"),
];

// Validate bulk notification request (for admin use)
exports.validateBulkNotification = [
  body("recipients")
    .isArray({ min: 1 })
    .withMessage(
      "Recipients array is required and must contain at least one recipient"
    ),

  body("recipients.*")
    .isMongoId()
    .withMessage("Each recipient must be a valid user ID"),

  body("type")
    .notEmpty()
    .withMessage("Notification type is required")
    .isIn(["project", "message", "payment", "system"])
    .withMessage("Invalid notification type"),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Notification title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot be more than 200 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Notification description is required")
    .isLength({ max: 1000 })
    .withMessage("Description cannot be more than 1000 characters"),

  body("sender").optional().isMongoId().withMessage("Invalid sender ID format"),

  body("data").optional().isObject().withMessage("Data must be an object"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
