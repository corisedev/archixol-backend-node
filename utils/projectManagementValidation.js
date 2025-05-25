// utils/projectManagementValidation.js
const { body, query, validationResult } = require("express-validator");

// Validate proposal action request (accept/reject)
exports.validateProposalAction = [
  body("job_id")
    .notEmpty()
    .withMessage("Job ID is required")
    .isMongoId()
    .withMessage("Invalid job ID format"),

  body("proposal_id")
    .notEmpty()
    .withMessage("Proposal ID is required")
    .isMongoId()
    .withMessage("Invalid proposal ID format"),

  body("action")
    .notEmpty()
    .withMessage("Action is required")
    .isIn(["accept", "reject"])
    .withMessage("Invalid action. Must be 'accept' or 'reject'"),

  body("message")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Message cannot be more than 500 characters"),
];

// Validate get projects by status query
exports.validateGetProjectsByStatus = [
  query("status")
    .optional()
    .isIn(["ongoing", "completed", "cancelled", "rejected"])
    .withMessage(
      "Invalid status. Use: ongoing, completed, cancelled, rejected"
    ),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
];

// Validate cancel project request
exports.validateCancelProject = [
  body("project_id")
    .notEmpty()
    .withMessage("Project ID is required")
    .isMongoId()
    .withMessage("Invalid project ID format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Reason cannot be more than 1000 characters"),

  body("notify_provider")
    .optional()
    .isBoolean()
    .withMessage("Notify provider must be true or false"),
];

// Validate complete project request (client side)
exports.validateCompleteProject = [
  body("project_id")
    .notEmpty()
    .withMessage("Project ID is required")
    .isMongoId()
    .withMessage("Invalid project ID format"),

  body("feedback_rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Feedback rating must be between 1 and 5"),

  body("feedback_comment")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Feedback comment cannot be more than 1000 characters"),

  body("final_payment_amount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Final payment amount must be a positive number"),
];

// Validate complete project request (service provider side)
exports.validateCompleteProjectFromProvider = [
  body("project_id")
    .notEmpty()
    .withMessage("Project ID is required")
    .isMongoId()
    .withMessage("Invalid project ID format"),

  body("completion_notes")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Completion notes cannot be more than 2000 characters"),

  body("deliverables")
    .optional()
    .isArray()
    .withMessage("Deliverables must be an array"),

  body("deliverables.*")
    .optional()
    .isString()
    .withMessage("Each deliverable must be a string"),
];

// Validate update project progress request
exports.validateUpdateProjectProgress = [
  body("project_id")
    .notEmpty()
    .withMessage("Project ID is required")
    .isMongoId()
    .withMessage("Invalid project ID format"),

  body("progress_notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Progress notes cannot be more than 1000 characters"),

  body("estimated_completion_date")
    .optional()
    .isISO8601()
    .withMessage(
      "Invalid estimated completion date format. Use ISO 8601 format"
    ),

  body("milestone_completed")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Milestone description cannot be more than 200 characters"),
];

// Validate get project details request
exports.validateGetProjectDetails = [
  body("project_id")
    .notEmpty()
    .withMessage("Project ID is required")
    .isMongoId()
    .withMessage("Invalid project ID format"),
];

// Validate service provider projects by status query
exports.validateServiceProviderProjectsByStatus = [
  query("status")
    .optional()
    .isIn(["ongoing", "completed", "cancelled"])
    .withMessage("Invalid status. Use: ongoing, completed, cancelled"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
];

// Validate ongoing projects query
exports.validateGetOngoingProjects = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
