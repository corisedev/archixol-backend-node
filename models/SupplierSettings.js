// models/SupplierSettings.js
const mongoose = require("mongoose");

// Store Details Schema
const StoreDetailsSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  logo: {
    type: String,
    default: "",
  },
  store_name: {
    type: String,
    default: "",
  },
  phone_number: {
    type: String,
    default: "",
  },
  email: {
    type: String,
    default: "",
  },
  address: {
    type: String,
    default: "",
  },
  display_currency: {
    type: String,
    default: "USD",
  },
  unit_system: {
    type: String,
    enum: ["metric", "imperial"],
    default: "metric",
  },
  weight_unit: {
    type: String,
    enum: ["kg", "g", "lb", "oz"],
    default: "kg",
  },
  time_zone: {
    type: String,
    default: "UTC",
  },
  prefix: {
    type: String,
    default: "",
  },
  suffix: {
    type: String,
    default: "",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Tax Details Schema
const TaxDetailsSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  is_auto_apply_tax: {
    type: Boolean,
    default: false,
  },
  default_tax_rate: {
    type: String,
    default: "",
  },
  reg_number: {
    type: String,
    default: "",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Product Custom Tax Schema
const ProductTaxSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  custom_tax: {
    type: String,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Return Rules Schema
const ReturnRulesSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  is_enabled: {
    type: Boolean,
    default: false,
  },
  return_window: {
    type: String,
    default: "14",
  },
  no_of_custom_days: {
    type: String,
    default: "",
  },
  return_shipping_cost: {
    type: String,
    enum: [
      "return_shipping_by_customer",
      "return_shipping_by_store",
      "flat_rate",
    ],
    default: "return_shipping_by_customer",
  },
  flat_rate: {
    type: String,
    default: "",
  },
  restocking_fee: {
    type: Boolean,
    default: false,
  },
  final_sale_items: {
    type: String,
    enum: ["collections", "none", "products"],
    default: "none",
  },
  sale_items: {
    type: [mongoose.Schema.Types.ObjectId],
    default: [],
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Policy Content Schema
const PolicyContentSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  return_and_refund: {
    type: String,
    default: "",
  },
  privacy_policy: {
    type: String,
    default: "",
  },
  terms_of_services: {
    type: String,
    default: "",
  },
  shipping_policy: {
    type: String,
    default: "",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Checkout Settings Schema
const CheckoutSettingsSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  address_line: {
    type: String,
    default: "",
  },
  company_name: {
    type: String,
    default: "",
  },
  fullname: {
    type: String,
    default: "",
  },
  is_custom_tip: {
    type: Boolean,
    default: false,
  },
  is_tipping_checkout: {
    type: Boolean,
    default: false,
  },
  shipping_address_phone_number: {
    type: String,
    default: "",
  },
  tip_fixed_amount: {
    type: [String],
    default: [],
  },
  tip_percentage: {
    type: [String],
    default: [],
  },
  tip_type: {
    type: String,
    default: "percentage",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Contact Info Schema
const ContactInfoSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  trade_name: {
    type: String,
    default: "",
  },
  phone_number: {
    type: String,
    default: "",
  },
  email: {
    type: String,
    default: "",
  },
  phyiscal_address: {
    type: String,
    default: "",
  },
  vat_reg_number: {
    type: String,
    default: "",
  },
  business_reg_number: {
    type: String,
    default: "",
  },
  customer_support_hours: {
    type: String,
    default: "",
  },
  response_time: {
    type: String,
    default: "",
  },
  is_contact_form: {
    type: Boolean,
    default: false,
  },
  contact_page_intro: {
    type: String,
    default: "",
  },
  fb_url: {
    type: String,
    default: "",
  },
  insta_url: {
    type: String,
    default: "",
  },
  x_url: {
    type: String,
    default: "",
  },
  linkedin_url: {
    type: String,
    default: "",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Supplier Profile Schema
const SupplierProfileSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  profile_image: {
    type: String,
    default: "",
  },
  first_name: {
    type: String,
    default: "",
  },
  last_name: {
    type: String,
    default: "",
  },
  email: {
    type: String,
    default: "",
  },
  phone_number: {
    type: String,
    default: "",
  },
  recovery_email: {
    type: String,
    default: "",
  },
  is_recovery_email_verified: {
    type: Boolean,
    default: false,
  },
  recovery_email_verification_token: String,
  recovery_email_verification_expire: Date,
  recovery_phone: {
    type: String,
    default: "",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save hooks to update updatedAt
StoreDetailsSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

TaxDetailsSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

ProductTaxSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

ReturnRulesSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

PolicyContentSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

CheckoutSettingsSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

ContactInfoSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

SupplierProfileSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Generate recovery email verification token
SupplierProfileSchema.methods.getRecoveryEmailVerificationToken = function () {
  // Generate token
  const verificationToken = crypto.randomBytes(20).toString("hex");

  // Hash token and set to emailVerificationToken field
  this.recovery_email_verification_token = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  // Set expire
  this.recovery_email_verification_expire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Define models
const StoreDetails = mongoose.model("StoreDetails", StoreDetailsSchema);
const TaxDetails = mongoose.model("TaxDetails", TaxDetailsSchema);
const ProductTax = mongoose.model("ProductTax", ProductTaxSchema);
const ReturnRules = mongoose.model("ReturnRules", ReturnRulesSchema);
const PolicyContent = mongoose.model("PolicyContent", PolicyContentSchema);
const CheckoutSettings = mongoose.model(
  "CheckoutSettings",
  CheckoutSettingsSchema
);
const ContactInfo = mongoose.model("ContactInfo", ContactInfoSchema);
const SupplierProfile = mongoose.model(
  "SupplierProfile",
  SupplierProfileSchema
);

module.exports = {
  StoreDetails,
  TaxDetails,
  ProductTax,
  ReturnRules,
  PolicyContent,
  CheckoutSettings,
  ContactInfo,
  SupplierProfile,
};
