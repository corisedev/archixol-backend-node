// utils/discountValidation.js
const { body, validationResult } = require("express-validator");

// Validate add discount request
exports.validateAddDiscount = [
  body("discount_type")
    .notEmpty()
    .withMessage("Discount type is required")
    .isIn(["code", "automatic"])
    .withMessage("Discount type must be 'code' or 'automatic'"),

  body("code")
    .if(body("discount_type").equals("code"))
    .notEmpty()
    .withMessage("Discount code is required for code-type discounts")
    .isLength({ min: 3, max: 20 })
    .withMessage("Discount code must be between 3 and 20 characters")
    .matches(/^[A-Z0-9]+$/)
    .withMessage(
      "Discount code can only contain uppercase letters and numbers"
    ),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Discount title is required")
    .isLength({ max: 100 })
    .withMessage("Title cannot be more than 100 characters"),

  body("discount_value_type")
    .notEmpty()
    .withMessage("Discount value type is required")
    .isIn(["percentage", "fixed_amount"])
    .withMessage("Discount value type must be 'percentage' or 'fixed_amount'"),

  body("discount_value")
    .notEmpty()
    .withMessage("Discount value is required")
    .isFloat({ min: 0 })
    .withMessage("Discount value must be a positive number")
    .custom((value, { req }) => {
      if (
        req.body.discount_value_type === "percentage" &&
        (value < 0 || value > 100)
      ) {
        throw new Error("Percentage discount must be between 0 and 100");
      }
      return true;
    }),

  body("appliesTo")
    .notEmpty()
    .withMessage("Applies to field is required")
    .isIn(["collections", "products", "all"])
    .withMessage("Applies to must be 'collections', 'products', or 'all'"),

  body("sale_items")
    .optional()
    .isArray()
    .withMessage("Sale items must be an array"),

  body("start_datetime")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format. Use ISO 8601 format"),

  body("is_end_date")
    .optional()
    .isBoolean()
    .withMessage("Is end date must be true or false"),

  body("end_datetime")
    .optional()
    .if(body("is_end_date").equals(true))
    .notEmpty()
    .withMessage("End date is required when is_end_date is true")
    .isISO8601()
    .withMessage("Invalid end date format. Use ISO 8601 format")
    .custom((value, { req }) => {
      if (
        value &&
        req.body.start_datetime &&
        new Date(value) <= new Date(req.body.start_datetime)
      ) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),

  body("eligibility")
    .optional()
    .isIn(["all_customers", "specific_customers"])
    .withMessage("Eligibility must be 'all_customers' or 'specific_customers'"),

  body("customer_list")
    .optional()
    .isArray()
    .withMessage("Customer list must be an array"),

  body("min_purchase_req")
    .optional()
    .isIn(["no_req", "min_amount", "min_items"])
    .withMessage(
      "Minimum purchase requirement must be 'no_req', 'min_amount', or 'min_items'"
    ),

  body("min_amount_value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum amount value must be a positive number"),

  body("min_items_value")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Minimum items value must be at least 1"),

  body("is_max_limit")
    .optional()
    .isBoolean()
    .withMessage("Is max limit must be true or false"),

  body("max_total_uses")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Maximum total uses must be at least 1"),

  body("one_per_customer")
    .optional()
    .isBoolean()
    .withMessage("One per customer must be true or false"),

  body("customer_buy_spend")
    .optional()
    .isIn(["min_item_qty", "min_amount"])
    .withMessage("Customer buy spend must be 'min_item_qty' or 'min_amount'"),

  body("buy_spend_quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Buy spend quantity must be at least 1"),

  body("buy_spend_amount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Buy spend amount must be a positive number"),

  body("buy_spend_any_item_from")
    .optional()
    .isIn(["products", "collections"])
    .withMessage("Buy spend any item from must be 'products' or 'collections'"),

  body("buy_spend_sale_items")
    .optional()
    .isArray()
    .withMessage("Buy spend sale items must be an array"),

  body("gets_quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Gets quantity must be at least 1"),

  body("gets_any_item_from")
    .optional()
    .isIn(["products", "collections"])
    .withMessage("Gets any item from must be 'products' or 'collections'"),

  body("gets_sale_items")
    .optional()
    .isArray()
    .withMessage("Gets sale items must be an array"),

  body("discounted_value")
    .optional()
    .isIn(["free", "percentage", "amount_off"])
    .withMessage(
      "Discounted value must be 'free', 'percentage', or 'amount_off'"
    ),

  body("percentage")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Percentage must be between 0 and 100"),

  body("amount_off_each")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Amount off each must be a positive number"),

  body("is_max_users_per_order")
    .optional()
    .isBoolean()
    .withMessage("Is max users per order must be true or false"),

  body("max_users")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Maximum users must be at least 1"),
];

// Validate get discount request
exports.validateGetDiscount = [
  body("discount_id").notEmpty().withMessage("Discount ID is required"),
];

// Validate update discount request
exports.validateUpdateDiscount = [
  body("discount_id").notEmpty().withMessage("Discount ID is required"),

  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Title cannot be empty if provided")
    .isLength({ max: 100 })
    .withMessage("Title cannot be more than 100 characters"),

  body("code")
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage("Discount code must be between 3 and 20 characters")
    .matches(/^[A-Z0-9]+$/)
    .withMessage(
      "Discount code can only contain uppercase letters and numbers"
    ),

  body("discount_value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discount value must be a positive number"),

  body("start_datetime")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format. Use ISO 8601 format"),

  body("end_datetime")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format. Use ISO 8601 format"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "expired", "used_up"])
    .withMessage(
      "Status must be 'active', 'inactive', 'expired', or 'used_up'"
    ),
];

// Validate delete discount request
exports.validateDeleteDiscount = [
  body("discount_id").notEmpty().withMessage("Discount ID is required"),
];

// Validate toggle discount status request
exports.validateToggleDiscountStatus = [
  body("discount_id").notEmpty().withMessage("Discount ID is required"),
];

// Validate discount code validation request
exports.validateDiscountCode = [
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Discount code is required")
    .isLength({ min: 3, max: 20 })
    .withMessage("Discount code must be between 3 and 20 characters"),

  body("order_items")
    .optional()
    .isArray()
    .withMessage("Order items must be an array"),

  body("order_total")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Order total must be a positive number"),
];

// Validate apply discount request
exports.validateApplyDiscount = [
  body("discount_id").notEmpty().withMessage("Discount ID is required"),

  body("order_items")
    .isArray({ min: 1 })
    .withMessage("Order items are required and must be an array"),

  body("order_items.*.product_id")
    .notEmpty()
    .withMessage("Product ID is required for each order item"),

  body("order_items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),

  body("order_items.*.price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("order_total")
    .isFloat({ min: 0 })
    .withMessage("Order total must be a positive number"),
];

// Validate discount usage report request
exports.validateDiscountUsageReport = [
  body("start_date")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format. Use ISO 8601 format"),

  body("end_date")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format. Use ISO 8601 format")
    .custom((value, { req }) => {
      if (
        value &&
        req.body.start_date &&
        new Date(value) <= new Date(req.body.start_date)
      ) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),

  body("status")
    .optional()
    .isIn(["active", "inactive", "expired", "used_up"])
    .withMessage(
      "Status must be 'active', 'inactive', 'expired', or 'used_up'"
    ),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
