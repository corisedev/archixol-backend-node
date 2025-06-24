// Create utils/adminDeleteValidation.js

const { body, validationResult } = require("express-validator");

// ==================== USER DELETE VALIDATIONS ====================

// Validate delete user request
exports.validateDeleteUser = [
  body("user_id")
    .notEmpty()
    .withMessage("User ID is required")
    .isMongoId()
    .withMessage("Invalid user ID format"),

  body("permanent_delete")
    .optional()
    .isBoolean()
    .withMessage("Permanent delete must be true or false"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),
];

// Validate bulk delete users request
exports.validateBulkDeleteUsers = [
  body("user_ids")
    .isArray({ min: 1 })
    .withMessage("User IDs array is required and must contain at least one ID"),

  body("user_ids.*")
    .isMongoId()
    .withMessage("Each user ID must be a valid MongoDB ObjectId"),

  body("permanent_delete")
    .optional()
    .isBoolean()
    .withMessage("Permanent delete must be true or false"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),
];

// ==================== PROJECT DELETE VALIDATIONS ====================

// Validate delete project request
exports.validateDeleteProject = [
  body("project_id")
    .notEmpty()
    .withMessage("Project ID is required")
    .isMongoId()
    .withMessage("Invalid project ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("notify_client")
    .optional()
    .isBoolean()
    .withMessage("Notify client must be true or false"),

  body("notify_provider")
    .optional()
    .isBoolean()
    .withMessage("Notify provider must be true or false"),
];

// ==================== SERVICE DELETE VALIDATIONS ====================

// Validate delete service request
exports.validateDeleteService = [
  body("service_id")
    .notEmpty()
    .withMessage("Service ID is required")
    .isMongoId()
    .withMessage("Invalid service ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("notify_provider")
    .optional()
    .isBoolean()
    .withMessage("Notify provider must be true or false"),
];

// ==================== PRODUCT DELETE VALIDATIONS ====================

// Validate delete product request
exports.validateDeleteProduct = [
  body("product_id")
    .notEmpty()
    .withMessage("Product ID is required")
    .isMongoId()
    .withMessage("Invalid product ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("notify_supplier")
    .optional()
    .isBoolean()
    .withMessage("Notify supplier must be true or false"),

  body("remove_from_collections")
    .optional()
    .isBoolean()
    .withMessage("Remove from collections must be true or false"),
];

// ==================== COLLECTION DELETE VALIDATIONS ====================

// Validate delete collection request
exports.validateDeleteCollection = [
  body("collection_id")
    .notEmpty()
    .withMessage("Collection ID is required")
    .isMongoId()
    .withMessage("Invalid collection ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("notify_supplier")
    .optional()
    .isBoolean()
    .withMessage("Notify supplier must be true or false"),
];

// ==================== ORDER DELETE VALIDATIONS ====================

// Validate delete order request
exports.validateDeleteOrder = [
  body("order_id")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid order ID format"),

  body("order_type")
    .optional()
    .isIn(["supplier", "client"])
    .withMessage("Order type must be 'supplier' or 'client'"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("notify_customer")
    .optional()
    .isBoolean()
    .withMessage("Notify customer must be true or false"),

  body("notify_supplier")
    .optional()
    .isBoolean()
    .withMessage("Notify supplier must be true or false"),

  body("refund_payment")
    .optional()
    .isBoolean()
    .withMessage("Refund payment must be true or false"),
];

// ==================== CUSTOMER DELETE VALIDATIONS ====================

// Validate delete customer request
exports.validateDeleteCustomer = [
  body("customer_id")
    .notEmpty()
    .withMessage("Customer ID is required")
    .isMongoId()
    .withMessage("Invalid customer ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("handle_orders")
    .optional()
    .isIn(["keep", "cancel", "transfer"])
    .withMessage("Handle orders must be 'keep', 'cancel', or 'transfer'"),

  body("transfer_to_customer_id")
    .if(body("handle_orders").equals("transfer"))
    .notEmpty()
    .withMessage("Transfer to customer ID is required when transferring orders")
    .isMongoId()
    .withMessage("Invalid transfer customer ID format"),
];

// ==================== VENDOR DELETE VALIDATIONS ====================

// Validate delete vendor request
exports.validateDeleteVendor = [
  body("vendor_id")
    .notEmpty()
    .withMessage("Vendor ID is required")
    .isMongoId()
    .withMessage("Invalid vendor ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("handle_purchase_orders")
    .optional()
    .isIn(["keep", "cancel", "transfer"])
    .withMessage(
      "Handle purchase orders must be 'keep', 'cancel', or 'transfer'"
    ),

  body("transfer_to_vendor_id")
    .if(body("handle_purchase_orders").equals("transfer"))
    .notEmpty()
    .withMessage(
      "Transfer to vendor ID is required when transferring purchase orders"
    )
    .isMongoId()
    .withMessage("Invalid transfer vendor ID format"),
];

// ==================== PURCHASE ORDER DELETE VALIDATIONS ====================

// Validate delete purchase order request
exports.validateDeletePurchaseOrder = [
  body("purchase_order_id")
    .notEmpty()
    .withMessage("Purchase order ID is required")
    .isMongoId()
    .withMessage("Invalid purchase order ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("notify_supplier")
    .optional()
    .isBoolean()
    .withMessage("Notify supplier must be true or false"),

  body("notify_vendor")
    .optional()
    .isBoolean()
    .withMessage("Notify vendor must be true or false"),

  body("cancel_if_pending")
    .optional()
    .isBoolean()
    .withMessage("Cancel if pending must be true or false"),
];

// ==================== COMPANY DELETE VALIDATIONS ====================

// Validate delete company request
exports.validateDeleteCompany = [
  body("company_id")
    .notEmpty()
    .withMessage("Company ID is required")
    .isMongoId()
    .withMessage("Invalid company ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("notify_owner")
    .optional()
    .isBoolean()
    .withMessage("Notify owner must be true or false"),

  body("delete_documents")
    .optional()
    .isBoolean()
    .withMessage("Delete documents must be true or false"),

  body("delete_certificates")
    .optional()
    .isBoolean()
    .withMessage("Delete certificates must be true or false"),
];

// ==================== DISCOUNT DELETE VALIDATIONS ====================

// Validate delete discount request
exports.validateDeleteDiscount = [
  body("discount_id")
    .notEmpty()
    .withMessage("Discount ID is required")
    .isMongoId()
    .withMessage("Invalid discount ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("notify_supplier")
    .optional()
    .isBoolean()
    .withMessage("Notify supplier must be true or false"),

  body("refund_usage")
    .optional()
    .isBoolean()
    .withMessage("Refund usage must be true or false"),
];

// ==================== NOTIFICATION DELETE VALIDATIONS ====================

// Validate delete notification request
exports.validateDeleteNotification = [
  body("notification_id")
    .notEmpty()
    .withMessage("Notification ID is required")
    .isMongoId()
    .withMessage("Invalid notification ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),
];

// ==================== SITE BUILDER DELETE VALIDATIONS ====================

// Validate delete site builder request
exports.validateDeleteSiteBuilder = [
  body("supplier_id")
    .notEmpty()
    .withMessage("Supplier ID is required")
    .isMongoId()
    .withMessage("Invalid supplier ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("notify_supplier")
    .optional()
    .isBoolean()
    .withMessage("Notify supplier must be true or false"),

  body("backup_data")
    .optional()
    .isBoolean()
    .withMessage("Backup data must be true or false"),
];

// ==================== BULK DELETE VALIDATIONS ====================

// Validate bulk delete products request
exports.validateBulkDeleteProducts = [
  body("product_ids")
    .isArray({ min: 1 })
    .withMessage(
      "Product IDs array is required and must contain at least one ID"
    ),

  body("product_ids.*")
    .isMongoId()
    .withMessage("Each product ID must be a valid MongoDB ObjectId"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("notify_suppliers")
    .optional()
    .isBoolean()
    .withMessage("Notify suppliers must be true or false"),

  body("remove_from_collections")
    .optional()
    .isBoolean()
    .withMessage("Remove from collections must be true or false"),
];

// Validate bulk delete orders request
exports.validateBulkDeleteOrders = [
  body("order_ids")
    .isArray({ min: 1 })
    .withMessage(
      "Order IDs array is required and must contain at least one ID"
    ),

  body("order_ids.*")
    .isMongoId()
    .withMessage("Each order ID must be a valid MongoDB ObjectId"),

  body("order_type")
    .optional()
    .isIn(["supplier", "client", "mixed"])
    .withMessage("Order type must be 'supplier', 'client', or 'mixed'"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("notify_customers")
    .optional()
    .isBoolean()
    .withMessage("Notify customers must be true or false"),

  body("notify_suppliers")
    .optional()
    .isBoolean()
    .withMessage("Notify suppliers must be true or false"),

  body("refund_payments")
    .optional()
    .isBoolean()
    .withMessage("Refund payments must be true or false"),
];

// Validate bulk delete services request
exports.validateBulkDeleteServices = [
  body("service_ids")
    .isArray({ min: 1 })
    .withMessage(
      "Service IDs array is required and must contain at least one ID"
    ),

  body("service_ids.*")
    .isMongoId()
    .withMessage("Each service ID must be a valid MongoDB ObjectId"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("notify_providers")
    .optional()
    .isBoolean()
    .withMessage("Notify providers must be true or false"),

  body("cancel_active_jobs")
    .optional()
    .isBoolean()
    .withMessage("Cancel active jobs must be true or false"),
];

// Validate bulk delete projects request
exports.validateBulkDeleteProjects = [
  body("project_ids")
    .isArray({ min: 1 })
    .withMessage(
      "Project IDs array is required and must contain at least one ID"
    ),

  body("project_ids.*")
    .isMongoId()
    .withMessage("Each project ID must be a valid MongoDB ObjectId"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("notify_clients")
    .optional()
    .isBoolean()
    .withMessage("Notify clients must be true or false"),

  body("notify_providers")
    .optional()
    .isBoolean()
    .withMessage("Notify providers must be true or false"),

  body("cancel_active_proposals")
    .optional()
    .isBoolean()
    .withMessage("Cancel active proposals must be true or false"),
];

// ==================== ADVANCED DELETE VALIDATIONS ====================

// Validate delete by criteria request
exports.validateDeleteByCriteria = [
  body("entity_type")
    .notEmpty()
    .withMessage("Entity type is required")
    .isIn([
      "users",
      "products",
      "services",
      "projects",
      "orders",
      "customers",
      "vendors",
      "collections",
      "discounts",
      "notifications",
    ])
    .withMessage("Invalid entity type"),

  body("criteria").isObject().withMessage("Criteria must be an object"),

  body("criteria.date_range")
    .optional()
    .isObject()
    .withMessage("Date range must be an object"),

  body("criteria.date_range.start")
    .optional()
    .isISO8601()
    .withMessage("Start date must be in ISO8601 format"),

  body("criteria.date_range.end")
    .optional()
    .isISO8601()
    .withMessage("End date must be in ISO8601 format"),

  body("criteria.status")
    .optional()
    .isArray()
    .withMessage("Status must be an array"),

  body("criteria.user_type")
    .optional()
    .isIn(["client", "supplier", "service_provider", "admin"])
    .withMessage("Invalid user type"),

  body("dry_run")
    .optional()
    .isBoolean()
    .withMessage("Dry run must be true or false"),

  body("reason")
    .notEmpty()
    .withMessage("Reason is required for bulk operations")
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Reason cannot be more than 1000 characters"),

  body("confirm_deletion")
    .notEmpty()
    .withMessage("Confirmation is required")
    .isBoolean()
    .withMessage("Confirm deletion must be true or false")
    .custom((value) => {
      if (value !== true) {
        throw new Error("You must confirm the deletion");
      }
      return true;
    }),
];

// Validate cleanup inactive data request
exports.validateCleanupInactiveData = [
  body("entity_types")
    .isArray({ min: 1 })
    .withMessage("Entity types array is required"),

  body("entity_types.*")
    .isIn([
      "inactive_users",
      "expired_discounts",
      "old_notifications",
      "cancelled_orders",
      "draft_products",
      "empty_collections",
    ])
    .withMessage("Invalid entity type for cleanup"),

  body("inactive_threshold_days")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Inactive threshold must be between 1 and 365 days"),

  body("dry_run")
    .optional()
    .isBoolean()
    .withMessage("Dry run must be true or false"),

  body("backup_before_delete")
    .optional()
    .isBoolean()
    .withMessage("Backup before delete must be true or false"),

  body("reason")
    .notEmpty()
    .withMessage("Reason is required for cleanup operations")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),
];

// ==================== VALIDATION RESULTS CHECK ====================

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array()[0].msg,
      field: errors.array()[0].param,
      all_errors: errors.array(),
    });
  }
  next();
};
