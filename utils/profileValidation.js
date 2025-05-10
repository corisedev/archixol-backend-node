const { body, validationResult } = require("express-validator");

// Validate profile update request
exports.validateProfileUpdate = [
  body("fullname")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Fullname cannot be more than 100 characters"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email"),

  body("phone_number")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Phone number cannot be more than 20 characters"),

  body("experience")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Experience must be a positive number"),

  body("cnic")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("CNIC cannot be more than 20 characters"),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Address cannot be more than 200 characters"),

  body("service_location")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Service location cannot be more than 100 characters"),

  body("introduction")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Introduction cannot be more than 1000 characters"),

  body("website")
    .optional()
    .trim()
    .isURL()
    .withMessage("Please provide a valid website URL")
    .isLength({ max: 100 })
    .withMessage("Website URL cannot be more than 100 characters"),

  body("services")
    .optional()
    .isArray()
    .withMessage("Services must be an array of service IDs"),

  body("services.*")
    .optional()
    .isMongoId()
    .withMessage("Invalid service ID format"),
];

// Validate delete intro video request
exports.validateDeleteVideo = [
  body("intro_video")
    .notEmpty()
    .withMessage("Video path is required")
    .trim()
    .isString()
    .withMessage("Video path must be a string"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
