// utils/adminRBACValidation.js
const { body, validationResult } = require("express-validator");

// Validate create admin request
exports.validateCreateAdmin = [
  body("full_name")
    .trim()
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ max: 100 })
    .withMessage("Full name cannot be more than 100 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Full name can only contain letters and spaces"),

  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be between 3 and 50 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),

  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be a boolean value"),

  body("role")
    .trim()
    .notEmpty()
    .withMessage("Role is required")
    .isLength({ max: 50 })
    .withMessage("Role cannot be more than 50 characters"),

  body("permissions")
    .optional()
    .isArray()
    .withMessage("Permissions must be an array"),
];

// Validate update admin request
exports.validateUpdateAdmin = [
  body("admin_id")
    .notEmpty()
    .withMessage("Admin ID is required")
    .isMongoId()
    .withMessage("Invalid admin ID format"),

  body("full_name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Full name cannot be empty if provided")
    .isLength({ max: 100 })
    .withMessage("Full name cannot be more than 100 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Full name can only contain letters and spaces"),

  body("username")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Username cannot be empty if provided")
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be between 3 and 50 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("email")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Email cannot be empty if provided")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be a boolean value"),

  body("role")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Role cannot be empty if provided")
    .isLength({ max: 50 })
    .withMessage("Role cannot be more than 50 characters"),

  body("permissions")
    .optional()
    .isArray()
    .withMessage("Permissions must be an array"),
];

// Validate delete admin request
exports.validateDeleteAdmin = [
  body("admin_id")
    .notEmpty()
    .withMessage("Admin ID is required")
    .isMongoId()
    .withMessage("Invalid admin ID format"),
];

// Validate toggle admin status request
exports.validateToggleAdminStatus = [
  body("admin_id")
    .notEmpty()
    .withMessage("Admin ID is required")
    .isMongoId()
    .withMessage("Invalid admin ID format"),

  body("is_active")
    .notEmpty()
    .withMessage("Status is required")
    .isBoolean()
    .withMessage("Status must be true or false"),
];

// Validate create role request
exports.validateCreateRole = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Role name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Role name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z0-9_\s]+$/)
    .withMessage(
      "Role name can only contain letters, numbers, underscores, and spaces"
    ),

  body("display_name")
    .trim()
    .notEmpty()
    .withMessage("Display name is required")
    .isLength({ max: 100 })
    .withMessage("Display name cannot be more than 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot be more than 500 characters"),

  body("default_permissions")
    .optional()
    .isArray()
    .withMessage("Default permissions must be an array"),

  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be a boolean value"),
];

// Validate update role request
exports.validateUpdateRole = [
  body("role_id")
    .notEmpty()
    .withMessage("Role ID is required")
    .isMongoId()
    .withMessage("Invalid role ID format"),

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Role name cannot be empty if provided")
    .isLength({ min: 2, max: 50 })
    .withMessage("Role name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z0-9_\s]+$/)
    .withMessage(
      "Role name can only contain letters, numbers, underscores, and spaces"
    ),

  body("display_name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Display name cannot be empty if provided")
    .isLength({ max: 100 })
    .withMessage("Display name cannot be more than 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot be more than 500 characters"),

  body("default_permissions")
    .optional()
    .isArray()
    .withMessage("Default permissions must be an array"),

  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be a boolean value"),
];

// Validate delete role request
exports.validateDeleteRole = [
  body("role_id")
    .notEmpty()
    .withMessage("Role ID is required")
    .isMongoId()
    .withMessage("Invalid role ID format"),
];

exports.validateGetAdmin = [
  body("admin_id")
    .notEmpty()
    .withMessage("Admin ID is required")
    .isMongoId()
    .withMessage("Invalid admin ID format"),
];

// Validate get admin permissions request
exports.validateGetAdminPermissions = [
  body("admin_id")
    .optional()
    .isMongoId()
    .withMessage("Invalid admin ID format"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array()[0].msg,
      field: errors.array()[0].param,
      all_errors: errors.array(),
    });
  }
  next();
};
