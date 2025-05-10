const { body, validationResult } = require("express-validator");

// Validate company document upload
exports.validateCompanyDocumentUpload = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Document title is required")
    .isLength({ max: 100 })
    .withMessage("Title cannot be more than 100 characters"),

  body("dated")
    .notEmpty()
    .withMessage("Document date is required")
    .isISO8601()
    .withMessage("Invalid date format. Use YYYY-MM-DD format"),
];

// Validate company document update
exports.validateCompanyDocumentUpdate = [
  body("document_id")
    .notEmpty()
    .withMessage("Document ID is required")
    .isMongoId()
    .withMessage("Invalid document ID format"),

  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Document title cannot be empty if provided")
    .isLength({ max: 100 })
    .withMessage("Title cannot be more than 100 characters"),

  body("dated")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format. Use YYYY-MM-DD format"),
];

// Validate company document delete
exports.validateCompanyDocumentDelete = [
  body("document_id")
    .notEmpty()
    .withMessage("Document ID is required")
    .isMongoId()
    .withMessage("Invalid document ID format"),
];

// Validate company data update
exports.validateCompanyDataUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Company name cannot be more than 100 characters"),

  body("business_email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email")
    .isLength({ max: 100 })
    .withMessage("Email cannot be more than 100 characters"),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Address cannot be more than 200 characters"),

  body("experience")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Experience must be a positive number"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description cannot be more than 2000 characters"),

  body("owner_name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Owner name cannot be more than 100 characters"),

  body("owner_cnic")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Owner CNIC cannot be more than 20 characters"),

  body("phone_number")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Phone number cannot be more than 20 characters"),

  body("service_location")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Service location cannot be more than 100 characters"),

  body("services")
    .optional()
    .isArray()
    .withMessage("Services must be an array"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
