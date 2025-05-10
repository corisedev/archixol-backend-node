const { body, validationResult } = require("express-validator");

// Validate create/update service request
exports.validateService = [
  body("service_title")
    .trim()
    .notEmpty()
    .withMessage("Service title is required")
    .isLength({ max: 100 })
    .withMessage("Service title cannot be more than 100 characters"),

  body("service_category")
    .trim()
    .notEmpty()
    .withMessage("Service category is required"),

  body("service_description")
    .trim()
    .notEmpty()
    .withMessage("Service description is required"),

  body("service_status")
    .isBoolean()
    .withMessage("Service status must be true or false"),

  body("service_faqs").isArray().withMessage("Service FAQs must be an array"),

  body("service_faqs.*.question")
    .if(body("service_faqs").exists())
    .notEmpty()
    .withMessage("FAQ question is required"),

  body("service_faqs.*.answer")
    .if(body("service_faqs").exists())
    .notEmpty()
    .withMessage("FAQ answer is required"),

  body("service_process")
    .isArray()
    .withMessage("Service process must be an array"),

  body("service_process.*.step")
    .if(body("service_process").exists())
    .notEmpty()
    .withMessage("Process step is required"),

  body("service_feature")
    .isArray()
    .withMessage("Service features must be an array"),

  body("service_feature.*.feature")
    .if(body("service_feature").exists())
    .notEmpty()
    .withMessage("Feature is required"),

  body("service_tags").isArray().withMessage("Service tags must be an array"),
];

// Validate get service request
exports.validateGetService = [
  body("service_id")
    .notEmpty()
    .withMessage("Service ID is required")
    .isMongoId()
    .withMessage("Invalid service ID format"),
];

// Validate delete service request
exports.validateDeleteService = [
  body("service_id")
    .notEmpty()
    .withMessage("Service ID is required")
    .isMongoId()
    .withMessage("Invalid service ID format"),
];

// Validate update service request
exports.validateUpdateService = [
  body("service_id")
    .notEmpty()
    .withMessage("Service ID is required")
    .isMongoId()
    .withMessage("Invalid service ID format"),

  ...exports.validateService,
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
