// utils/adminContentValidation.js
const { body, query, validationResult } = require("express-validator");

// Validate get profile images request
exports.validateGetProfileImages = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("user_type")
    .optional()
    .isIn(["client", "supplier", "service_provider", "admin"])
    .withMessage("Invalid user type"),
];

// Validate get service images request
exports.validateGetServiceImages = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("category")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Category cannot be more than 100 characters"),
];

// Validate get product images request
exports.validateGetProductImages = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("category")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Category cannot be more than 100 characters"),

  query("status")
    .optional()
    .isIn(["active", "draft", "archived"])
    .withMessage("Invalid product status"),
];

// Validate get certificates request
exports.validateGetCertificates = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("user_type")
    .optional()
    .isIn(["client", "supplier", "service_provider", "admin"])
    .withMessage("Invalid user type"),
];

// Validate get documents request
exports.validateGetDocuments = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("user_type")
    .optional()
    .isIn(["client", "supplier", "service_provider", "admin"])
    .withMessage("Invalid user type"),
];

// Validate get videos request
exports.validateGetVideos = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("user_type")
    .optional()
    .isIn(["client", "supplier", "service_provider", "admin"])
    .withMessage("Invalid user type"),
];

// Validate delete media request
exports.validateDeleteMedia = [
  body("file_path")
    .notEmpty()
    .withMessage("File path is required")
    .trim()
    .isLength({ max: 500 })
    .withMessage("File path cannot be more than 500 characters"),

  body("media_type")
    .notEmpty()
    .withMessage("Media type is required")
    .isIn([
      "profile_image",
      "banner_image",
      "intro_video",
      "certificate",
      "document",
      "service_image",
      "product_image",
      "collection_image",
      "site_builder_image",
    ])
    .withMessage("Invalid media type"),

  body("record_id").notEmpty().withMessage("Record ID is required").trim(),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),
];

// Validate bulk delete media request
exports.validateBulkDeleteMedia = [
  body("media_items")
    .isArray({ min: 1 })
    .withMessage(
      "Media items array is required and must contain at least one item"
    ),

  body("media_items.*.file_path")
    .notEmpty()
    .withMessage("File path is required for each media item")
    .trim(),

  body("media_items.*.media_type")
    .notEmpty()
    .withMessage("Media type is required for each media item")
    .isIn([
      "profile_image",
      "banner_image",
      "intro_video",
      "certificate",
      "document",
      "service_image",
      "product_image",
      "collection_image",
      "site_builder_image",
    ])
    .withMessage("Invalid media type"),

  body("media_items.*.record_id")
    .notEmpty()
    .withMessage("Record ID is required for each media item")
    .trim(),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot be more than 500 characters"),

  body("confirm_bulk_delete")
    .notEmpty()
    .withMessage("Bulk delete confirmation is required")
    .isBoolean()
    .withMessage("Confirmation must be true or false")
    .custom((value) => {
      if (value !== true) {
        throw new Error("You must confirm bulk deletion");
      }
      return true;
    }),
];

// Validate content search request
exports.validateContentSearch = [
  body("search_query")
    .trim()
    .notEmpty()
    .withMessage("Search query is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Search query must be between 2 and 100 characters"),

  body("media_types")
    .optional()
    .isArray()
    .withMessage("Media types must be an array"),

  body("media_types.*")
    .optional()
    .isIn([
      "profile_image",
      "banner_image",
      "intro_video",
      "certificate",
      "document",
      "service_image",
      "product_image",
      "collection_image",
    ])
    .withMessage("Invalid media type"),

  body("user_types")
    .optional()
    .isArray()
    .withMessage("User types must be an array"),

  body("user_types.*")
    .optional()
    .isIn(["client", "supplier", "service_provider", "admin"])
    .withMessage("Invalid user type"),

  body("date_range")
    .optional()
    .isObject()
    .withMessage("Date range must be an object"),

  body("date_range.start")
    .optional()
    .isISO8601()
    .withMessage("Start date must be in ISO8601 format"),

  body("date_range.end")
    .optional()
    .isISO8601()
    .withMessage("End date must be in ISO8601 format"),

  body("file_size_range")
    .optional()
    .isObject()
    .withMessage("File size range must be an object"),

  body("file_size_range.min")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Minimum file size must be a positive number"),

  body("file_size_range.max")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Maximum file size must be a positive number"),

  body("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  body("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// Validate content cleanup request
exports.validateContentCleanup = [
  body("cleanup_type")
    .notEmpty()
    .withMessage("Cleanup type is required")
    .isIn([
      "orphaned_files",
      "broken_links",
      "old_files",
      "large_files",
      "duplicate_files",
      "unused_media",
    ])
    .withMessage("Invalid cleanup type"),

  body("criteria")
    .optional()
    .isObject()
    .withMessage("Criteria must be an object"),

  body("criteria.older_than_days")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Older than days must be between 1 and 365"),

  body("criteria.larger_than_mb")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Larger than MB must be a positive number"),

  body("criteria.media_types")
    .optional()
    .isArray()
    .withMessage("Media types must be an array"),

  body("dry_run")
    .optional()
    .isBoolean()
    .withMessage("Dry run must be true or false"),

  body("confirm_cleanup")
    .if(body("dry_run").not().equals(true))
    .notEmpty()
    .withMessage("Cleanup confirmation is required")
    .isBoolean()
    .withMessage("Confirmation must be true or false")
    .custom((value) => {
      if (value !== true) {
        throw new Error("You must confirm cleanup operation");
      }
      return true;
    }),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Reason cannot be more than 1000 characters"),
];

// Validate media analytics request
exports.validateMediaAnalytics = [
  body("date_range")
    .optional()
    .isObject()
    .withMessage("Date range must be an object"),

  body("date_range.start")
    .optional()
    .isISO8601()
    .withMessage("Start date must be in ISO8601 format"),

  body("date_range.end")
    .optional()
    .isISO8601()
    .withMessage("End date must be in ISO8601 format"),

  body("groupby")
    .optional()
    .isIn(["user_type", "media_type", "date", "category", "file_size"])
    .withMessage("Invalid group by option"),

  body("include_storage_breakdown")
    .optional()
    .isBoolean()
    .withMessage("Include storage breakdown must be true or false"),

  body("include_usage_trends")
    .optional()
    .isBoolean()
    .withMessage("Include usage trends must be true or false"),
];

// Validate media optimization request
exports.validateMediaOptimization = [
  body("optimization_type")
    .notEmpty()
    .withMessage("Optimization type is required")
    .isIn([
      "compress_images",
      "convert_format",
      "generate_thumbnails",
      "optimize_videos",
    ])
    .withMessage("Invalid optimization type"),

  body("media_ids")
    .isArray({ min: 1 })
    .withMessage(
      "Media IDs array is required and must contain at least one ID"
    ),

  body("media_ids.*")
    .notEmpty()
    .withMessage("Each media ID is required")
    .trim(),

  body("optimization_settings")
    .optional()
    .isObject()
    .withMessage("Optimization settings must be an object"),

  body("optimization_settings.quality")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Quality must be between 1 and 100"),

  body("optimization_settings.max_width")
    .optional()
    .isInt({ min: 100, max: 4000 })
    .withMessage("Max width must be between 100 and 4000 pixels"),

  body("optimization_settings.max_height")
    .optional()
    .isInt({ min: 100, max: 4000 })
    .withMessage("Max height must be between 100 and 4000 pixels"),

  body("optimization_settings.format")
    .optional()
    .isIn(["jpg", "png", "webp", "mp4", "webm"])
    .withMessage("Invalid format"),

  body("backup_originals")
    .optional()
    .isBoolean()
    .withMessage("Backup originals must be true or false"),
];

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
