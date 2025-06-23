// utils/clientOrderValidation.js
const { body, validationResult } = require("express-validator");

// Validate place order request
exports.validatePlaceOrder = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email"),

  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ max: 50 })
    .withMessage("First name cannot be more than 50 characters"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ max: 50 })
    .withMessage("Last name cannot be more than 50 characters"),

  body("address")
    .trim()
    .notEmpty()
    .withMessage("Address is required")
    .isLength({ max: 200 })
    .withMessage("Address cannot be more than 200 characters"),

  body("apartment")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Apartment cannot be more than 50 characters"),

  body("city")
    .trim()
    .notEmpty()
    .withMessage("City is required")
    .isLength({ max: 100 })
    .withMessage("City cannot be more than 100 characters"),

  body("country")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Country cannot be more than 100 characters"),

  body("province")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Province cannot be more than 100 characters"),

  body("postalCode")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Postal code cannot be more than 20 characters"),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .isLength({ max: 20 })
    .withMessage("Phone number cannot be more than 20 characters")
    .matches(/^[\d\s\+\-\(\)]*$/)
    .withMessage("Please provide a valid phone number"),

  body("shippingMethod")
    .optional()
    .isIn(["cash_on_delivery", "card_payment", "bank_transfer"])
    .withMessage("Invalid shipping method"),

  body("discountCode")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Discount code cannot be more than 50 characters"),

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

  body("subtotal")
    .notEmpty()
    .withMessage("Subtotal is required")
    .isFloat({ min: 0 })
    .withMessage("Subtotal must be a positive number"),

  body("shipping")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Shipping must be a positive number"),

  body("tax")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Tax must be a positive number"),

  body("total")
    .notEmpty()
    .withMessage("Total is required")
    .isFloat({ min: 0 })
    .withMessage("Total must be a positive number"),
];

// Validate get order details request
exports.validateGetOrderDetails = [
  body("order_id")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid order ID format"),
];

// Validate request return
exports.validateRequestReturn = [
  body("order_id")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid order ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Return reason cannot be more than 500 characters"),
];

// Validate cancel order request
exports.validateCancelOrder = [
  body("order_id")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid order ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Cancellation reason cannot be more than 500 characters"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};

exports.validateGetConfirmedOrderDetail = [
  body("order_id")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid order ID format"),
];
