// utils/siteBuilderValidation.js - FIXED VERSION
const { body, validationResult } = require("express-validator");

// Custom validation to handle FormData structure - FIXED
exports.validateFormDataStructure = (req, res, next) => {
  try {
    console.log("=== VALIDATING FORMDATA STRUCTURE ===");
    console.log("Body keys:", Object.keys(req.body));
    console.log("Files count:", req.files?.length || 0);

    // Check if we have any valid data to work with
    const hasAboutUs = req.body.about_us !== undefined;
    const hasSections = Object.keys(req.body).some((key) =>
      key.startsWith("sections[")
    );
    const hasHeroBanners = Object.keys(req.body).some((key) =>
      key.startsWith("hero_banners[")
    );
    const hasHotProducts = req.body.hot_products !== undefined;
    const hasFiles = req.files && req.files.length > 0;
    const hasTheme = req.body.theme !== undefined;
    const hasSeo = req.body.seo !== undefined;
    const hasSocialLinks = req.body.social_links !== undefined;
    const hasPublishStatus = req.body.is_published !== undefined;

    const hasValidData =
      hasAboutUs ||
      hasSections ||
      hasHeroBanners ||
      hasHotProducts ||
      hasFiles ||
      hasTheme ||
      hasSeo ||
      hasSocialLinks ||
      hasPublishStatus;

    if (!hasValidData) {
      console.warn("No valid site builder data found");
      return res.status(400).json({
        error:
          "No valid site builder data provided. Expected sections, hero_banners, hot_products, about_us, or files.",
      });
    }

    // Validate file field names if files are present
    if (hasFiles) {
      const invalidFiles = req.files.filter((file) => {
        const isValidHeroBanner = file.fieldname.match(/^hero_banners\[\d+\]$/);
        const isValidSectionImage = file.fieldname.match(
          /^sections\[\d+\]\[image\]$/
        );
        return !isValidHeroBanner && !isValidSectionImage;
      });

      if (invalidFiles.length > 0) {
        console.warn(
          "Invalid file field names found:",
          invalidFiles.map((f) => f.fieldname)
        );
        return res.status(400).json({
          error: `Invalid file field names: ${invalidFiles
            .map((f) => f.fieldname)
            .join(
              ", "
            )}. Expected hero_banners[index] or sections[index][image].`,
        });
      }
    }

    console.log("FormData structure validation passed");
    console.log("Found data types:", {
      hasAboutUs,
      hasSections,
      hasHeroBanners,
      hasHotProducts,
      hasFiles,
      hasTheme,
      hasSeo,
      hasSocialLinks,
      hasPublishStatus,
    });

    next();
  } catch (error) {
    console.error("FormData structure validation error:", error);
    return res.status(400).json({
      error: "Request validation failed: " + error.message,
    });
  }
};

// Validate site builder update request - SIMPLIFIED
exports.validateSiteBuilderUpdate = [
  // Validate sections array if present
  body("sections")
    .optional()
    .isArray()
    .withMessage("Sections must be an array"),

  body("sections.*.type")
    .optional()
    .isIn(["banner", "collection", "products", "text", "gallery"])
    .withMessage("Invalid section type"),

  body("sections.*.collection_id")
    .optional()
    .custom((value) => {
      if (value && !value.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error("Invalid collection ID format");
      }
      return true;
    }),

  body("sections.*.product_ids")
    .optional()
    .isArray()
    .withMessage("Product IDs must be an array"),

  body("sections.*.title")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Section title cannot be more than 200 characters"),

  body("sections.*.content")
    .optional()
    .isLength({ max: 5000 })
    .withMessage("Section content cannot be more than 5000 characters"),

  // Validate hot products
  body("hot_products")
    .optional()
    .isArray()
    .withMessage("Hot products must be an array"),

  // Validate about_us
  body("about_us")
    .optional()
    .isLength({ max: 10000 })
    .withMessage("About us content cannot be more than 10000 characters"),

  // Validate hero banners
  body("hero_banners")
    .optional()
    .isArray()
    .withMessage("Hero banners must be an array"),

  body("hero_banners.*.title")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Banner title cannot be more than 100 characters"),

  body("hero_banners.*.subtitle")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Banner subtitle cannot be more than 200 characters"),

  body("hero_banners.*.button_text")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Button text cannot be more than 50 characters"),

  body("hero_banners.*.button_link")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Button link cannot be more than 500 characters"),

  // Validate theme, seo, social_links (can be objects or JSON strings)
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

  // Validate is_published
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

// Validation results check - SIMPLIFIED
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log("Validation errors:", errors.array());
    return res.status(400).json({
      error: errors.array()[0].msg,
      details: errors.array(),
    });
  }
  next();
};
