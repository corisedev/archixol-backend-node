// utils/serviceProviderJobValidation.js
const { body, query, validationResult } = require("express-validator");

// Validate get job details request
exports.validateGetJobDetails = [
  body("job_id")
    .notEmpty()
    .withMessage("Job ID is required")
    .isMongoId()
    .withMessage("Invalid job ID format"),
];

// Validate apply for job request
exports.validateApplyForJob = [
  body("job_id")
    .notEmpty()
    .withMessage("Job ID is required")
    .isMongoId()
    .withMessage("Invalid job ID format"),

  body("proposal_text")
    .trim()
    .notEmpty()
    .withMessage("Proposal text is required")
    .isLength({ min: 10, max: 2000 })
    .withMessage("Proposal text must be between 10 and 2000 characters"),

  body("proposed_budget")
    .notEmpty()
    .withMessage("Proposed budget is required")
    .isFloat({ min: 1 })
    .withMessage("Proposed budget must be a positive number"),

  body("proposed_timeline")
    .trim()
    .notEmpty()
    .withMessage("Proposed timeline is required")
    .isLength({ max: 200 })
    .withMessage("Proposed timeline cannot be more than 200 characters"),

  body("service_id")
    .optional()
    .isMongoId()
    .withMessage("Invalid service ID format"),
];

// Validate get my applications query parameters
exports.validateGetMyApplications = [
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
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
];

// Validate update application request
exports.validateUpdateApplication = [
  body("application_id")
    .notEmpty()
    .withMessage("Application ID is required")
    .isMongoId()
    .withMessage("Invalid application ID format"),

  body("action")
    .notEmpty()
    .withMessage("Action is required")
    .isIn(["withdraw", "update_proposal"])
    .withMessage("Invalid action. Must be 'withdraw' or 'update_proposal'"),

  body("proposal_text")
    .if(body("action").equals("update_proposal"))
    .trim()
    .notEmpty()
    .withMessage("Proposal text is required for update")
    .isLength({ min: 10, max: 2000 })
    .withMessage("Proposal text must be between 10 and 2000 characters"),

  body("proposed_budget")
    .if(body("action").equals("update_proposal"))
    .notEmpty()
    .withMessage("Proposed budget is required for update")
    .isFloat({ min: 1 })
    .withMessage("Proposed budget must be a positive number"),

  body("proposed_timeline")
    .if(body("action").equals("update_proposal"))
    .trim()
    .notEmpty()
    .withMessage("Proposed timeline is required for update")
    .isLength({ max: 200 })
    .withMessage("Proposed timeline cannot be more than 200 characters"),
];

// Validate save job request
exports.validateSaveJob = [
  body("job_id")
    .notEmpty()
    .withMessage("Job ID is required")
    .isMongoId()
    .withMessage("Invalid job ID format"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot be more than 500 characters"),

  body("tags").optional().isArray().withMessage("Tags must be an array"),

  body("tags.*").optional().isString().withMessage("Each tag must be a string"),

  body("reminder_date")
    .optional()
    .isISO8601()
    .withMessage("Invalid reminder date format. Use ISO 8601 format"),
];

// Validate unsave job request
exports.validateUnsaveJob = [
  body("job_id")
    .notEmpty()
    .withMessage("Job ID is required")
    .isMongoId()
    .withMessage("Invalid job ID format"),
];

// Validate get saved jobs query parameters
exports.validateGetSavedJobs = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),

  query("tag")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Tag cannot be more than 50 characters"),

  query("category")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Category cannot be more than 100 characters"),

  query("sort_by")
    .optional()
    .isIn(["saved_date", "budget", "deadline"])
    .withMessage("Invalid sort option"),

  query("sort_order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];

// Validate get available jobs query parameters
exports.validateGetAvailableJobs = [
  query("category")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Category cannot be more than 100 characters"),

  query("budget_min")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum budget must be a positive number"),

  query("budget_max")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum budget must be a positive number"),

  query("location")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location cannot be more than 100 characters"),

  query("urgent")
    .optional()
    .isBoolean()
    .withMessage("Urgent must be true or false"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),

  query("sort_by")
    .optional()
    .isIn(["budget", "created_date", "timeline"])
    .withMessage("Invalid sort option"),

  query("sort_order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
