// utils/adminCustomerValidation.js - Add supplier validation

const { body, validationResult } = require("express-validator");

// Validate get customer request
exports.validateGetCustomer = [
  body("customer_id")
    .notEmpty()
    .withMessage("Customer ID is required")
    .isMongoId()
    .withMessage("Invalid customer ID format"),
];

// Validate get supplier request
exports.validateGetSupplier = [
  body("supplier_id")
    .notEmpty()
    .withMessage("Supplier ID is required")
    .isMongoId()
    .withMessage("Invalid supplier ID format"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};

exports.validateGetServiceProvider = [
  body("service_provider_id")
    .notEmpty()
    .withMessage("Service provider ID is required")
    .isMongoId()
    .withMessage("Invalid service provider ID format"),
];

exports.validateGetCompany = [
  body("company_id")
    .notEmpty()
    .withMessage("Company ID is required")
    .isMongoId()
    .withMessage("Invalid company ID format"),
];
