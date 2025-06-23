// utils/siteBuilderValidation.js
const { body, validationResult } = require("express-validator");

// Validate site builder update request
exports.validateSiteBuilderUpdate = [
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
      // imageUrl should be handled as file upload, not as string in body
      // This validation will mainly check if it's provided as string accidentally
      if (typeof value === "string" && value.length > 0) {
        // Allow existing file paths (updates)
        if (value.startsWith("/uploads/") || value.startsWith("./")) {
          return true;
        }
        // If it's a string but not a path, it might be a filename that should be uploaded
        throw new Error(
          "imageUrl should be uploaded as a file, not as a string"
        );
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

  body("sections.*.images")
    .optional()
    .isArray()
    .withMessage("Section images must be an array"),

  body("hot_products")
    .optional()
    .isArray()
    .withMessage("Hot products must be an array"),

  body("about_us")
    .optional()
    .trim()
    .isLength({ max: 10000 })
    .withMessage("About us content cannot be more than 10000 characters"),

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

  body("theme.primary_color")
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage("Primary color must be a valid hex color"),

  body("theme.secondary_color")
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage("Secondary color must be a valid hex color"),

  body("theme.font_family")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Font family cannot be more than 100 characters"),

  body("theme.layout_style")
    .optional()
    .isIn(["modern", "classic", "minimal", "bold"])
    .withMessage("Invalid layout style"),

  body("seo.meta_title")
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage("Meta title cannot be more than 60 characters"),

  body("seo.meta_description")
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage("Meta description cannot be more than 160 characters"),

  body("seo.meta_keywords")
    .optional()
    .isArray()
    .withMessage("Meta keywords must be an array"),

  body("social_links.facebook")
    .optional()
    .trim()
    .isURL()
    .withMessage("Facebook URL must be a valid URL"),

  body("social_links.instagram")
    .optional()
    .trim()
    .isURL()
    .withMessage("Instagram URL must be a valid URL"),

  body("social_links.twitter")
    .optional()
    .trim()
    .isURL()
    .withMessage("Twitter URL must be a valid URL"),

  body("social_links.linkedin")
    .optional()
    .trim()
    .isURL()
    .withMessage("LinkedIn URL must be a valid URL"),

  body("is_published")
    .optional()
    .isBoolean()
    .withMessage("Is published must be true or false"),
];

// Validate toggle publish request
exports.validateTogglePublish = [
  body("is_published")
    .notEmpty()
    .withMessage("Publish status is required")
    .isBoolean()
    .withMessage("Publish status must be true or false"),
];

// Validation results check
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};
