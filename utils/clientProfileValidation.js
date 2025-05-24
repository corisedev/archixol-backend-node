// utils/clientProfileValidation.js
const { body, validationResult } = require("express-validator");

// Validate client profile update
exports.validateClientProfileUpdate = [
  body("profile_img")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Profile image path cannot be more than 500 characters"),

  body("full_name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Full name cannot be more than 100 characters")
    .matches(/^[a-zA-Z\s]*$/)
    .withMessage("Full name can only contain letters and spaces"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email")
    .isLength({ max: 100 })
    .withMessage("Email cannot be more than 100 characters"),

  body("phone_number")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Phone number cannot be more than 20 characters")
    .matches(/^[\d\s\+\-\(\)]*$/)
    .withMessage("Please provide a valid phone number"),

  body("company_name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Company name cannot be more than 100 characters"),

  body("business_type")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Business type cannot be more than 100 characters"),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Address cannot be more than 500 characters"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City cannot be more than 100 characters"),

  body("about")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("About section cannot be more than 2000 characters"),
];

// Validate change password request
exports.validateChangePassword = [
  body("current_password")
    .notEmpty()
    .withMessage("Current password is required"),

  body("new_password")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "New password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),

  body("confirm_password")
    .notEmpty()
    .withMessage("Confirm password is required")
    .custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error("Password confirmation does not match new password");
      }
      return true;
    }),
];

// Validate additional security settings
exports.validateAdditionalSettings = [
  body("two_factor")
    .optional()
    .isBoolean()
    .withMessage("Two factor must be true or false"),

  body("email_notify_for_logins")
    .optional()
    .isBoolean()
    .withMessage("Email notify for logins must be true or false"),

  body("remember_30days")
    .optional()
    .isBoolean()
    .withMessage("Remember 30 days must be true or false"),
];

// Validate notification settings
exports.validateNotificationSettings = [
  body("email_notifications")
    .optional()
    .isBoolean()
    .withMessage("Email notifications must be true or false"),

  body("sms_notifications")
    .optional()
    .isBoolean()
    .withMessage("SMS notifications must be true or false"),

  body("push_notifications")
    .optional()
    .isBoolean()
    .withMessage("Push notifications must be true or false"),

  body("marketing_emails")
    .optional()
    .isBoolean()
    .withMessage("Marketing emails must be true or false"),
];

// Validate privacy settings
exports.validatePrivacySettings = [
  body("profile_visibility")
    .optional()
    .isIn(["public", "private", "contacts_only"])
    .withMessage(
      "Profile visibility must be one of: public, private, contacts_only"
    ),

  body("show_email")
    .optional()
    .isBoolean()
    .withMessage("Show email must be true or false"),

  body("show_phone")
    .optional()
    .isBoolean()
    .withMessage("Show phone must be true or false"),

  body("allow_contact")
    .optional()
    .isBoolean()
    .withMessage("Allow contact must be true or false"),
];

// Validate account deactivation request
exports.validateAccountDeactivation = [
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("feedback")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Feedback cannot be more than 1000 characters"),

  body("confirm_deactivation")
    .notEmpty()
    .withMessage("Confirmation is required")
    .isBoolean()
    .withMessage("Confirmation must be true or false")
    .custom((value) => {
      if (value !== true) {
        throw new Error("You must confirm account deactivation");
      }
      return true;
    }),
];

// Validate delete account request
exports.validateDeleteAccount = [
  body("password")
    .notEmpty()
    .withMessage("Password is required to delete account"),

  body("confirmation_text")
    .notEmpty()
    .withMessage("Confirmation text is required")
    .custom((value) => {
      if (value !== "DELETE MY ACCOUNT") {
        throw new Error("Please type 'DELETE MY ACCOUNT' to confirm");
      }
      return true;
    }),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
