const { body, validationResult } = require("express-validator");

// Validate upload certificate request
exports.validateUploadCertificate = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Certificate title is required")
    .isLength({ max: 100 })
    .withMessage("Title cannot be more than 100 characters"),

  body("dated")
    .notEmpty()
    .withMessage("Certificate date is required")
    .isISO8601()
    .withMessage("Invalid date format. Use YYYY-MM-DD format"),
];

// Validate update certificate request
exports.validateUpdateCertificate = [
  body("certificate_id")
    .notEmpty()
    .withMessage("Certificate ID is required")
    .isMongoId()
    .withMessage("Invalid certificate ID format"),

  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Certificate title cannot be empty if provided")
    .isLength({ max: 100 })
    .withMessage("Title cannot be more than 100 characters"),

  body("dated")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format. Use YYYY-MM-DD format"),
];

// Validate delete certificate request
exports.validateDeleteCertificate = [
  body("certificate_id")
    .notEmpty()
    .withMessage("Certificate ID is required")
    .isMongoId()
    .withMessage("Invalid certificate ID format"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
