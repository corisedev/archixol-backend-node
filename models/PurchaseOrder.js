// models/PurchaseOrder.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const PurchaseOrderItemSchema = new mongoose.Schema({
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
  quantity: {
    type: Number,
    required: true,
    default: 1,
  },
  total: {
    type: Number,
    required: true,
  },
});

const PurchaseOrderCalculationsSchema = new mongoose.Schema({
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

const PurchaseOrderSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  vendor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
  },
  vendor_name: {
    type: String,
    required: true,
  },
  supplier_name: {
    type: String,
    required: true,
  },
  po_no: {
    type: String,
    unique: true,
    default: () => `PO-${uuidv4().slice(0, 8).toUpperCase()}`,
  },
  payment_terms: {
    type: String,
    default: "net_30",
  },
  destination: {
    type: String,
    default: "",
  },
  supplier_currency: {
    type: String,
    default: "USD",
  },
  estimated_arrival: {
    type: Date,
  },
  shipping_carrier: {
    type: String,
    default: "",
  },
  tracking_number: {
    type: String,
    default: "",
  },
  reference_number: {
    type: String,
    default: "",
  },
  received_status: {
    type: Boolean,
    default: false,
  },
  tags: {
    type: [String],
    default: [],
  },
  notes: {
    type: String,
    default: "",
  },
  products: [PurchaseOrderItemSchema],
  products_count: {
    type: Number,
    default: 0,
  },
  calculations: PurchaseOrderCalculationsSchema,
  status: {
    type: String,
    enum: ["pending", "ordered", "received", "cancelled"],
    default: "pending",
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
PurchaseOrderSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Update products_count
  if (this.products) {
    this.products_count = this.products.length;
  }

  next();
});

module.exports = mongoose.model("PurchaseOrder", PurchaseOrderSchema);
