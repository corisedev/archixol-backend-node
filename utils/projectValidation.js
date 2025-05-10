const { body, validationResult } = require("express-validator");

// Validate get project request
exports.validateGetProject = [
  body("project_id")
    .notEmpty()
    .withMessage("Project ID is required")
    .isMongoId()
    .withMessage("Invalid project ID format"),
];

// Validate upload project request
exports.validateUploadProject = [
  body("project_title")
    .trim()
    .notEmpty()
    .withMessage("Project title is required")
    .isLength({ max: 100 })
    .withMessage("Project title cannot be more than 100 characters"),

  body("project_category")
    .trim()
    .notEmpty()
    .withMessage("Project category is required")
    .isLength({ max: 50 })
    .withMessage("Project category cannot be more than 50 characters"),

  body("project_location")
    .trim()
    .notEmpty()
    .withMessage("Project location is required")
    .isLength({ max: 100 })
    .withMessage("Project location cannot be more than 100 characters"),

  body("project_description")
    .trim()
    .notEmpty()
    .withMessage("Project description is required")
    .isLength({ max: 2000 })
    .withMessage("Project description cannot be more than 2000 characters"),

  body("start_date")
    .notEmpty()
    .withMessage("Start date is required")
    .isISO8601()
    .withMessage("Invalid start date format. Use YYYY-MM-DD format"),

  body("end_date")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("Invalid end date format. Use YYYY-MM-DD format")
    .custom((value, { req }) => {
      if (value && new Date(value) < new Date(req.body.start_date)) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),
];

// Validate update project request
exports.validateUpdateProject = [
  body("project_id")
    .notEmpty()
    .withMessage("Project ID is required")
    .isMongoId()
    .withMessage("Invalid project ID format"),

  body("project_title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Project title cannot be empty if provided")
    .isLength({ max: 100 })
    .withMessage("Project title cannot be more than 100 characters"),

  body("project_category")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Project category cannot be empty if provided")
    .isLength({ max: 50 })
    .withMessage("Project category cannot be more than 50 characters"),

  body("project_location")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Project location cannot be empty if provided")
    .isLength({ max: 100 })
    .withMessage("Project location cannot be more than 100 characters"),

  body("project_description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Project description cannot be empty if provided")
    .isLength({ max: 2000 })
    .withMessage("Project description cannot be more than 2000 characters"),

  body("start_date")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format. Use YYYY-MM-DD format"),

  body("end_date")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("Invalid end date format. Use YYYY-MM-DD format")
    .custom((value, { req }) => {
      if (
        value &&
        req.body.start_date &&
        new Date(value) < new Date(req.body.start_date)
      ) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),

  body("project_imgs_urls")
    .optional()
    .isArray()
    .withMessage("Project images URLs must be an array"),
];

// Validate delete project request
exports.validateDeleteProject = [
  body("project_id")
    .notEmpty()
    .withMessage("Project ID is required")
    .isMongoId()
    .withMessage("Invalid project ID format"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
