// utils/siteBuilderValidation.js - UPDATED FOR NEW FORMDATA STRUCTURE
const { body, validationResult } = require("express-validator");

// Validate site builder update request - UPDATED
exports.validateSiteBuilderUpdate = [
  // Validate sections array (now processed from FormData)
  body("sections")
    .optional()
    .isArray()
    .withMessage("Sections must be an array"),

  body("sections.*.type")
    .optional()
    .isIn(["banner", "collection", "products", "text", "gallery"])
    .withMessage("Invalid section type"),

  body("sections.*.imageUrl")
    .optional()
    .custom((value, { req }) => {
      // Allow image URLs that are file paths
      if (typeof value === "string" && value.length > 0) {
        // Allow existing file paths or newly uploaded paths
        if (value.startsWith("/uploads/") || value.startsWith("./")) {
          return true;
        }
        throw new Error("Invalid image URL format");
      }
      return true;
    }),

  body("sections.*.collection_id")
    .optional()
    .isMongoId()
    .withMessage("Invalid collection ID format"),

  body("sections.*.product_ids")
    .optional()
    .isArray()
    .withMessage("Product IDs must be an array"),

  body("sections.*.product_ids.*")
    .optional()
    .isMongoId()
    .withMessage("Invalid product ID format"),

  body("sections.*.title")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Section title cannot be more than 200 characters"),

  body("sections.*.content")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Section content cannot be more than 5000 characters"),

  // Validate hot products (JSON string from FormData)
  body("hot_products")
    .optional()
    .custom((value) => {
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            throw new Error("Hot products must be an array");
          }
        } catch (e) {
          throw new Error("Hot products must be valid JSON array");
        }
      } else if (!Array.isArray(value)) {
        throw new Error("Hot products must be an array");
      }
      return true;
    }),

  // Validate about_us (direct field from FormData)
  body("about_us")
    .optional()
    .trim()
    .isLength({ max: 10000 })
    .withMessage("About us content cannot be more than 10000 characters"),

  // Validate hero banners array (now processed from FormData)
  body("hero_banners")
    .optional()
    .isArray()
    .withMessage("Hero banners must be an array"),

  body("hero_banners.*.title")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Banner title cannot be more than 100 characters"),

  body("hero_banners.*.subtitle")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Banner subtitle cannot be more than 200 characters"),

  body("hero_banners.*.button_text")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Button text cannot be more than 50 characters"),

  body("hero_banners.*.button_link")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Button link cannot be more than 500 characters"),

  // Validate theme (could be JSON string or object)
  body("theme")
    .optional()
    .custom((value) => {
      if (typeof value === "string") {
        try {
          JSON.parse(value);
        } catch (e) {
          throw new Error("Theme must be valid JSON");
        }
      }
      return true;
    }),

  // Validate SEO (could be JSON string or object)
  body("seo")
    .optional()
    .custom((value) => {
      if (typeof value === "string") {
        try {
          JSON.parse(value);
        } catch (e) {
          throw new Error("SEO must be valid JSON");
        }
      }
      return true;
    }),

  // Validate social links (could be JSON string or object)
  body("social_links")
    .optional()
    .custom((value) => {
      if (typeof value === "string") {
        try {
          JSON.parse(value);
        } catch (e) {
          throw new Error("Social links must be valid JSON");
        }
      }
      return true;
    }),

  // Validate is_published (string from FormData)
  body("is_published")
    .optional()
    .custom((value) => {
      if (typeof value === "string") {
        if (value !== "true" && value !== "false") {
          throw new Error("Is published must be 'true' or 'false'");
        }
      } else if (typeof value !== "boolean") {
        throw new Error("Is published must be a boolean");
      }
      return true;
    }),
];

// Validate toggle publish request
exports.validateTogglePublish = [
  body("is_published")
    .notEmpty()
    .withMessage("Publish status is required")
    .custom((value) => {
      if (typeof value === "string") {
        if (value !== "true" && value !== "false") {
          throw new Error("Publish status must be 'true' or 'false'");
        }
      } else if (typeof value !== "boolean") {
        throw new Error("Publish status must be a boolean");
      }
      return true;
    }),
];

// Custom validation to handle FormData structure
exports.validateFormDataStructure = (req, res, next) => {
  try {
    console.log("=== VALIDATING FORMDATA STRUCTURE ===");

    // Check if we have the expected FormData fields
    const hasValidStructure =
      req.body.about_us !== undefined ||
      Object.keys(req.body).some((key) => key.startsWith("sections[")) ||
      Object.keys(req.body).some((key) => key.startsWith("hero_banners[")) ||
      req.body.hot_products !== undefined;

    if (!hasValidStructure && (!req.files || req.files.length === 0)) {
      return res.status(400).json({
        error:
          "Invalid request structure. Expected FormData with sections, hero_banners, or files.",
      });
    }

    // Validate that files have proper field names if present
    if (req.files && req.files.length > 0) {
      const validFileFields = req.files.every(
        (file) =>
          file.fieldname.startsWith("hero_banners[") ||
          file.fieldname.includes("[image]")
      );

      if (!validFileFields) {
        return res.status(400).json({
          error:
            "Invalid file field names. Expected hero_banners[index] or sections[index][image].",
        });
      }
    }

    console.log("FormData structure validation passed");
    next();
  } catch (error) {
    console.error("FormData structure validation error:", error);
    return res.status(400).json({
      error: "Request validation failed: " + error.message,
    });
  }
};

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log("Validation errors:", errors.array());
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
