// models/Collection.js
const mongoose = require("mongoose");
const slugify = require("slugify");

const SmartConditionSchema = new mongoose.Schema({
  field: {
    type: String,
    required: true,
  },
  operator: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
});

const CollectionSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: [true, "Please add a collection title"],
    trim: true,
  },
  url_handle: {
    type: String,
    unique: true,
  },
  description: {
    type: String,
    default: "",
  },
  collection_type: {
    type: String,
    enum: ["manual", "smart"],
    default: "manual",
  },
  collection_images: {
    type: [String],
    default: [],
  },
  product_list: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Product",
    default: [],
  },
  smart_operator: {
    type: String,
    enum: ["all", "any"],
    default: "all",
  },
  smart_conditions: {
    type: [SmartConditionSchema],
    default: [],
  },
  status: {
    type: String,
    enum: ["active", "draft", "archived"],
    default: "active",
  },
  // Add page_title and meta_description fields
  page_title: {
    type: String,
    default: "",
  },
  meta_description: {
    type: String,
    default: "",
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

// Generate URL handle from title if not provided
CollectionSchema.pre("save", function (next) {
  // Update timestamp
  this.updatedAt = Date.now();

  // Generate URL handle if not provided
  if (!this.url_handle) {
    this.url_handle = slugify(this.title, { lower: true });
  }

  next();
});

module.exports = mongoose.model("Collection", CollectionSchema);
