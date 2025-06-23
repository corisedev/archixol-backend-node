// utils/roleSwitchValidation.js
const { body, validationResult } = require("express-validator");

// Validate role switch request
exports.validateRoleSwitch = [
  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["client", "supplier", "service_provider"])
    .withMessage(
      "Invalid role. Must be one of: client, supplier, service_provider"
    )
    .trim()
    .toLowerCase(),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
