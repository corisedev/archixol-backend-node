// utils/adminServiceValidation.js - Create this new validation file

const { body, validationResult } = require("express-validator");

// Validate toggle service status request
exports.validateToggleServiceStatus = [
  body("service_id")
    .notEmpty()
    .withMessage("Service ID is required")
    .isMongoId()
    .withMessage("Invalid service ID format"),

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
