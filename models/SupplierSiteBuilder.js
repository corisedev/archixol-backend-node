// models/SupplierSiteBuilder.js
const mongoose = require("mongoose");

// Section Schema for different types of content blocks
const SectionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["banner", "collection", "products", "text", "gallery"],
    required: true,
  },
  position: {
    type: Number,
    required: true,
    min: 0,
  },
  // For banner sections
  imageUrl: {
    type: String,
    default: "",
  },
  // For collection sections
  collection_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Collection",
    default: null,
  },
  // For text sections
  title: {
    type: String,
    default: "",
  },
  content: {
    type: String,
    default: "",
  },
  // For product sections
  product_ids: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Product",
    default: [],
  },
  // For gallery sections
  images: {
    type: [String],
    default: [],
  },
  // Section styling options
  styling: {
    backgroundColor: {
      type: String,
      default: "",
    },
    textColor: {
      type: String,
      default: "",
    },
    padding: {
      type: String,
      default: "",
    },
    margin: {
      type: String,
      default: "",
    },
  },
});

// Hot Product Schema
const HotProductSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  position: {
    type: Number,
    required: true,
    min: 0,
  },
});

// Hero Banner Schema
const HeroBannerSchema = new mongoose.Schema({
  image_path: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    default: "",
  },
  subtitle: {
    type: String,
    default: "",
  },
  button_text: {
    type: String,
    default: "",
  },
  button_link: {
    type: String,
    default: "",
  },
  position: {
    type: Number,
    required: true,
    min: 0,
  },
});

// Main Site Builder Schema
const SupplierSiteBuilderSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  // Dynamic sections that can be reordered
  sections: {
    type: [SectionSchema],
    default: [],
  },
  // Hot/Featured products
  hot_products: {
    type: [HotProductSchema],
    default: [],
  },
  // About us content
  about_us: {
    type: String,
    default: "",
  },
  // Hero banners for the main slider
  hero_banners: {
    type: [HeroBannerSchema],
    default: [],
  },
  // Store theme settings
  theme: {
    primary_color: {
      type: String,
      default: "#007bff",
    },
    secondary_color: {
      type: String,
      default: "#6c757d",
    },
    font_family: {
      type: String,
      default: "Arial, sans-serif",
    },
    layout_style: {
      type: String,
      enum: ["modern", "classic", "minimal", "bold"],
      default: "modern",
    },
  },
  // SEO Settings
  seo: {
    meta_title: {
      type: String,
      default: "",
    },
    meta_description: {
      type: String,
      default: "",
    },
    meta_keywords: {
      type: [String],
      default: [],
    },
  },
  // Store status
  is_published: {
    type: Boolean,
    default: false,
  },
  // Social media links
  social_links: {
    facebook: {
      type: String,
      default: "",
    },
    instagram: {
      type: String,
      default: "",
    },
    twitter: {
      type: String,
      default: "",
    },
    linkedin: {
      type: String,
      default: "",
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the 'updatedAt' field before saving
SupplierSiteBuilderSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to sort sections by position
SupplierSiteBuilderSchema.methods.sortSectionsByPosition = function () {
  this.sections.sort((a, b) => a.position - b.position);
  return this.sections;
};

// Method to sort hot products by position
SupplierSiteBuilderSchema.methods.sortHotProductsByPosition = function () {
  this.hot_products.sort((a, b) => a.position - b.position);
  return this.hot_products;
};

// Method to sort hero banners by position
SupplierSiteBuilderSchema.methods.sortHeroBannersByPosition = function () {
  this.hero_banners.sort((a, b) => a.position - b.position);
  return this.hero_banners;
};

module.exports = mongoose.model(
  "SupplierSiteBuilder",
  SupplierSiteBuilderSchema
);
