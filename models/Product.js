// models/Product.js
const mongoose = require("mongoose");
const slugify = require("slugify");

const VariantSchema = new mongoose.Schema({
  option_name: {
    type: String,
    default: "",
  },
  option_values: {
    type: String,
    default: "",
  },
});

const ProductSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: [true, "Please add a product title"],
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
  category: {
    type: String,
    default: "",
  },
  media: {
    type: [String],
    default: [],
  },
  price: {
    type: Number,
    default: 0,
  },
  compare_at_price: {
    type: Number,
    default: 0,
  },
  tax: {
    type: Boolean,
    default: false,
  },
  cost_per_item: {
    type: Number,
    default: 0,
  },
  profit: {
    type: Number,
    default: 0,
  },
  margin: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["active", "draft", "archived"],
    default: "draft",
  },
  quantity: {
    type: Number,
    default: 0,
  },
  min_qty: {
    type: Number,
    default: 10,
  },
  variant_option: {
    type: Boolean,
    default: false,
  },
  physical_product: {
    type: Boolean,
    default: false,
  },
  track_quantity: {
    type: Boolean,
    default: false,
  },
  variants: {
    type: [VariantSchema],
    default: [],
  },
  weight: {
    type: String,
    default: "",
  },
  units: {
    type: String,
    default: "",
  },
  region: {
    type: String,
    default: "",
  },
  hs_code: {
    type: String,
    default: "",
  },
  continue_out_of_stock: {
    type: Boolean,
    default: false,
  },
  address: {
    type: String,
    default: "",
  },
  search_vendor: {
    type: String,
    default: "",
  },
  search_collection: {
    type: [String],
    default: [],
  },
  search_tags: {
    type: [String],
    default: [],
  },
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
ProductSchema.pre("save", function (next) {
  // Update timestamp
  this.updatedAt = Date.now();

  // Generate URL handle if not provided
  if (!this.url_handle) {
    this.url_handle = slugify(this.title, { lower: true });
  }

  // Calculate profit and margin if price and cost are provided
  if (this.price > 0 && this.cost_per_item > 0) {
    this.profit = this.price - this.cost_per_item;
    this.margin = (this.profit / this.price) * 100;
  }

  next();
});

module.exports = mongoose.model("Product", ProductSchema);
