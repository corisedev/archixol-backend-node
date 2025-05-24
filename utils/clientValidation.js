// utils/clientValidation.js
const { body, query, validationResult } = require("express-validator");

// Validate create job request
exports.validateCreateJob = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Job title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot be more than 200 characters"),

  body("type")
    .notEmpty()
    .withMessage("Job type is required")
    .isIn(["fixed", "hourly", "project"])
    .withMessage("Job type must be one of: fixed, hourly, project"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Job description is required")
    .isLength({ max: 5000 })
    .withMessage("Description cannot be more than 5000 characters"),

  body("budget")
    .notEmpty()
    .withMessage("Budget is required")
    .isFloat({ min: 0 })
    .withMessage("Budget must be a positive number"),

  body("timeline")
    .trim()
    .notEmpty()
    .withMessage("Timeline is required")
    .isLength({ max: 100 })
    .withMessage("Timeline cannot be more than 100 characters"),

  body("city")
    .trim()
    .notEmpty()
    .withMessage("City is required")
    .isLength({ max: 100 })
    .withMessage("City cannot be more than 100 characters"),

  body("address")
    .trim()
    .notEmpty()
    .withMessage("Address is required")
    .isLength({ max: 500 })
    .withMessage("Address cannot be more than 500 characters"),

  body("urgent")
    .optional()
    .isBoolean()
    .withMessage("Urgent must be true or false"),

  body("docs").optional().isArray().withMessage("Documents must be an array"),

  body("required_skills")
    .optional()
    .isArray()
    .withMessage("Required skills must be an array"),

  body("required_skills.*")
    .optional()
    .isString()
    .withMessage("Each skill must be a string"),

  body("tags").optional().isArray().withMessage("Tags must be an array"),

  body("tags.*").optional().isString().withMessage("Each tag must be a string"),
];

// Validate get product request
exports.validateGetProduct = [
  body("product_id")
    .notEmpty()
    .withMessage("Product ID is required")
    .isMongoId()
    .withMessage("Invalid product ID format"),
];

// Validate get service request
exports.validateGetService = [
  body("service_id")
    .notEmpty()
    .withMessage("Service ID is required")
    .isMongoId()
    .withMessage("Invalid service ID format"),
];

// Validate client profile update
exports.validateClientProfileUpdate = [
  body("fullname")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Fullname cannot be more than 100 characters"),

  body("phone_number")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Phone number cannot be more than 20 characters")
    .matches(/^[\d\s\+\-\(\)]+$/)
    .withMessage("Please provide a valid phone number"),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Address cannot be more than 200 characters"),

  body("profile_img")
    .optional()
    .trim()
    .isURL()
    .withMessage("Profile image must be a valid URL"),

  body("banner_img")
    .optional()
    .trim()
    .isURL()
    .withMessage("Banner image must be a valid URL"),
];

// Validate get job request
exports.validateGetJob = [
  body("job_id")
    .notEmpty()
    .withMessage("Job ID is required")
    .isMongoId()
    .withMessage("Invalid job ID format"),
];

// Validate jobs query parameters
exports.validateJobsQuery = [
  query("status")
    .optional()
    .isIn([
      "requested",
      "accepted",
      "in_progress",
      "completed",
      "cancelled",
      "rejected",
    ])
    .withMessage("Invalid status value"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// Validate update job request
exports.validateUpdateJob = [
  body("job_id")
    .notEmpty()
    .withMessage("Job ID is required")
    .isMongoId()
    .withMessage("Invalid job ID format"),

  body("requirements")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Requirements cannot be empty if provided")
    .isLength({ max: 2000 })
    .withMessage("Requirements cannot be more than 2000 characters"),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("delivery_date")
    .optional()
    .isISO8601()
    .withMessage("Invalid delivery date format. Use ISO 8601 format"),
];

// Validate job action requests (accept, reject, etc.)
exports.validateJobAction = [
  body("job_id")
    .notEmpty()
    .withMessage("Job ID is required")
    .isMongoId()
    .withMessage("Invalid job ID format"),

  body("action")
    .notEmpty()
    .withMessage("Action is required")
    .isIn(["accept", "reject", "cancel", "complete"])
    .withMessage(
      "Invalid action. Must be one of: accept, reject, cancel, complete"
    ),
];

// Validate job feedback
exports.validateJobFeedback = [
  body("job_id")
    .notEmpty()
    .withMessage("Job ID is required")
    .isMongoId()
    .withMessage("Invalid job ID format"),

  body("rating")
    .notEmpty()
    .withMessage("Rating is required")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),

  body("comment")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Comment cannot be more than 1000 characters"),
];

// Validate create order request
exports.validateCreateOrder = [
  body("supplier_id")
    .notEmpty()
    .withMessage("Supplier ID is required")
    .isMongoId()
    .withMessage("Invalid supplier ID format"),

  body("items")
    .isArray({ min: 1 })
    .withMessage("Items array is required and must contain at least one item"),

  body("items.*.product_id")
    .notEmpty()
    .withMessage("Product ID is required for each item")
    .isMongoId()
    .withMessage("Invalid product ID format"),

  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be a positive integer"),

  body("shipping_address")
    .trim()
    .notEmpty()
    .withMessage("Shipping address is required")
    .isLength({ max: 500 })
    .withMessage("Shipping address cannot be more than 500 characters"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot be more than 1000 characters"),
];

// Validate order query parameters
exports.validateOrdersQuery = [
  query("status")
    .optional()
    .isIn([
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "returned",
    ])
    .withMessage("Invalid status value"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// Validate products query parameters
exports.validateProductsQuery = [
  query("category")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Category cannot be more than 100 characters"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query cannot be more than 100 characters"),

  query("min_price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum price must be a positive number"),

  query("max_price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum price must be a positive number"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// Validate services query parameters
exports.validateServicesQuery = [
  query("category")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Category cannot be more than 100 characters"),

  query("location")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location cannot be more than 100 characters"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query cannot be more than 100 characters"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
