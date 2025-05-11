// models/Order.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const OrderItemSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  title: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    default: "",
  },
  description: {
    type: String,
    default: "",
  },
  price: {
    type: Number,
    required: true,
  },
  compare_at_price: {
    type: Number,
    default: 0,
  },
  cost_per_item: {
    type: Number,
    default: 0,
  },
  margin: {
    type: Number,
    default: 0,
  },
  profit: {
    type: Number,
    default: 0,
  },
  quantity: {
    type: Number,
    default: 1,
  },
  weight: {
    type: String,
    default: "",
  },
  physical_product: {
    type: Boolean,
    default: false,
  },
  continue_out_of_stock: {
    type: Boolean,
    default: false,
  },
  tax: {
    type: Boolean,
    default: false,
  },
  track_quantity: {
    type: Boolean,
    default: false,
  },
  variant_option: {
    type: Boolean,
    default: false,
  },
  units: {
    type: String,
    default: "",
  },
  media: {
    type: [String],
    default: [],
  },
  qty: {
    type: Number,
    required: true,
    default: 1,
  },
});

const CalculationsSchema = new mongoose.Schema({
  subtotal: {
    type: Number,
    required: true,
  },
  discountPercentage: {
    type: Number,
    default: 0,
  },
  taxPercentage: {
    type: Number,
    default: 0,
  },
  totalDiscount: {
    type: Number,
    default: 0,
  },
  totalTax: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  shippingAddress: {
    type: String,
    default: "",
  },
});

const OrderSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  customer_id: {
    type: String,
    required: true,
  },
  order_no: {
    type: String,
    unique: true,
    default: () => `ORD-${uuidv4().slice(0, 8).toUpperCase()}`,
  },
  products: [OrderItemSchema],
  calculations: CalculationsSchema,
  notes: {
    type: String,
    default: "",
  },
  market_price: {
    type: String,
    default: "PKR",
  },
  tags: {
    type: [String],
    default: [],
  },
  channel: {
    type: String,
    default: "Offline Store",
  },
  payment_due_later: {
    type: Boolean,
    default: false,
  },
  shipping_address: {
    type: String,
    default: "",
  },
  bill_paid: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: [
      "pending",
      "processing",
      "completed",
      "delivered",
      "cancelled",
      "returned",
    ],
    default: "pending",
  },
  payment_status: {
    type: Boolean,
    default: false,
  },
  fulfillment_status: {
    type: Boolean,
    default: false,
  },
  delivery_status: {
    type: Boolean,
    default: false,
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
OrderSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Order", OrderSchema);
