// models/Discount.js
const mongoose = require("mongoose");

const DiscountSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  discount_type: {
    type: String,
    enum: ["code", "automatic"],
    required: true,
  },
  code: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true, // Allows multiple null values but unique non-null values
  },
  title: {
    type: String,
    required: [true, "Discount title is required"],
    trim: true,
    maxlength: [100, "Title cannot be more than 100 characters"],
  },
  discount_value_type: {
    type: String,
    enum: ["percentage", "fixed_amount"],
    required: true,
  },
  discount_value: {
    type: Number,
    required: true,
    min: [0, "Discount value must be positive"],
  },
  applies_to: {
    type: String,
    enum: ["collections", "products", "all"],
    required: true,
  },
  sale_items: {
    type: [mongoose.Schema.Types.ObjectId],
    default: [],
    refPath: "sale_items_type",
  },
  sale_items_type: {
    type: String,
    enum: ["Product", "Collection"],
    default: "Product",
  },
  start_datetime: {
    type: Date,
    required: true,
    default: Date.now,
  },
  is_end_date: {
    type: Boolean,
    default: false,
  },
  end_datetime: {
    type: Date,
    default: null,
  },
  eligibility: {
    type: String,
    enum: ["all_customers", "specific_customers"],
    default: "all_customers",
  },
  customer_list: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Customer",
    default: [],
  },
  min_purchase_req: {
    type: String,
    enum: ["no_req", "min_amount", "min_items"],
    default: "no_req",
  },
  min_amount_value: {
    type: Number,
    default: 0,
    min: [0, "Minimum amount must be positive"],
  },
  min_items_value: {
    type: Number,
    default: 1,
    min: [1, "Minimum items must be at least 1"],
  },
  is_max_limit: {
    type: Boolean,
    default: false,
  },
  max_total_uses: {
    type: Number,
    default: 1,
    min: [1, "Maximum uses must be at least 1"],
  },
  one_per_customer: {
    type: Boolean,
    default: false,
  },
  // Buy X Get Y discount fields
  customer_buy_spend: {
    type: String,
    enum: ["min_item_qty", "min_amount"],
    default: "min_item_qty",
  },
  buy_spend_quantity: {
    type: Number,
    default: 1,
    min: [1, "Buy quantity must be at least 1"],
  },
  buy_spend_amount: {
    type: Number,
    default: 0,
    min: [0, "Buy amount must be positive"],
  },
  buy_spend_any_item_from: {
    type: String,
    enum: ["products", "collections"],
    default: "products",
  },
  buy_spend_sale_items: {
    type: [mongoose.Schema.Types.ObjectId],
    default: [],
    refPath: "buy_spend_sale_items_type",
  },
  buy_spend_sale_items_type: {
    type: String,
    enum: ["Product", "Collection"],
    default: "Product",
  },
  gets_quantity: {
    type: Number,
    default: 1,
    min: [1, "Gets quantity must be at least 1"],
  },
  gets_any_item_from: {
    type: String,
    enum: ["products", "collections"],
    default: "products",
  },
  gets_sale_items: {
    type: [mongoose.Schema.Types.ObjectId],
    default: [],
    refPath: "gets_sale_items_type",
  },
  gets_sale_items_type: {
    type: String,
    enum: ["Product", "Collection"],
    default: "Product",
  },
  discounted_value: {
    type: String,
    enum: ["free", "percentage", "amount_off"],
    default: "free",
  },
  percentage: {
    type: Number,
    default: 0,
    min: [0, "Percentage must be positive"],
    max: [100, "Percentage cannot exceed 100"],
  },
  amount_off_each: {
    type: Number,
    default: 0,
    min: [0, "Amount off must be positive"],
  },
  is_max_users_per_order: {
    type: Boolean,
    default: false,
  },
  max_users: {
    type: Number,
    default: 1,
    min: [1, "Maximum users must be at least 1"],
  },
  // Usage tracking
  total_uses: {
    type: Number,
    default: 0,
  },
  customer_uses: {
    type: Map,
    of: Number,
    default: new Map(),
  },
  // Status and metadata
  status: {
    type: String,
    enum: ["active", "inactive", "expired", "used_up"],
    default: "active",
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

// Compound index for supplier and code uniqueness
DiscountSchema.index(
  { supplier_id: 1, code: 1 },
  { unique: true, sparse: true }
);

// Index for efficient querying
DiscountSchema.index({ supplier_id: 1, status: 1 });
DiscountSchema.index({ start_datetime: 1, end_datetime: 1 });

// Virtual for checking if discount is currently active
DiscountSchema.virtual("is_currently_active").get(function () {
  const now = new Date();
  const started = this.start_datetime <= now;
  const not_ended =
    !this.is_end_date || !this.end_datetime || this.end_datetime >= now;
  const not_used_up =
    !this.is_max_limit || this.total_uses < this.max_total_uses;

  return this.status === "active" && started && not_ended && not_used_up;
});

// Pre-save middleware
DiscountSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Ensure code is uppercase if provided
  if (this.code) {
    this.code = this.code.toUpperCase();
  }

  // Validate end date is after start date
  if (
    this.is_end_date &&
    this.end_datetime &&
    this.end_datetime <= this.start_datetime
  ) {
    const error = new Error("End date must be after start date");
    return next(error);
  }

  // Auto-update status based on conditions
  const now = new Date();
  if (this.is_end_date && this.end_datetime && this.end_datetime < now) {
    this.status = "expired";
  } else if (this.is_max_limit && this.total_uses >= this.max_total_uses) {
    this.status = "used_up";
  }

  next();
});

// Method to check if discount can be used by a customer
DiscountSchema.methods.canBeUsedBy = function (customerId) {
  if (!this.is_currently_active) {
    return { canUse: false, reason: "Discount is not currently active" };
  }

  // Check customer eligibility
  if (
    this.eligibility === "specific_customers" &&
    !this.customer_list.includes(customerId)
  ) {
    return { canUse: false, reason: "Customer not eligible for this discount" };
  }

  // Check one per customer limit
  if (this.one_per_customer) {
    const customerUseCount = this.customer_uses.get(customerId.toString()) || 0;
    if (customerUseCount > 0) {
      return {
        canUse: false,
        reason: "Discount already used by this customer",
      };
    }
  }

  return { canUse: true };
};

// Method to use the discount
DiscountSchema.methods.useDiscount = function (customerId) {
  this.total_uses += 1;

  const customerIdStr = customerId.toString();
  const currentUses = this.customer_uses.get(customerIdStr) || 0;
  this.customer_uses.set(customerIdStr, currentUses + 1);

  return this.save();
};

// Make sure virtuals are included when converting to JSON
DiscountSchema.set("toJSON", { virtuals: true });
DiscountSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Discount", DiscountSchema);
