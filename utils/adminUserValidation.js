// utils/adminUserValidation.js - Create this new validation file

const { body, validationResult } = require("express-validator");

// Validate toggle user account status request
exports.validateToggleUserAccountStatus = [
  body("user_id")
    .notEmpty()
    .withMessage("User ID is required")
    .isMongoId()
    .withMessage("Invalid user ID format"),

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isBoolean()
    .withMessage("Status must be true or false"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
