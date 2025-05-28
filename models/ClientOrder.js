// models/ClientOrder.js (Updated)
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const OrderItemSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  title: {
    type: String,
    required: true,
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

const CustomerDetailsSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  apartment: {
    type: String,
    default: "",
  },
  city: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    default: "United States",
  },
  province: {
    type: String,
    default: "",
  },
  postalCode: {
    type: String,
    default: "",
  },
  phone: {
    type: String,
    required: true,
  },
  shippingMethod: {
    type: String,
    default: "cash_on_delivery",
  },
  discountCode: {
    type: String,
    default: "",
  },
});

const ClientOrderSchema = new mongoose.Schema({
  client_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  order_no: {
    type: String,
    unique: true,
    default: () => `CLT-${uuidv4().slice(0, 8).toUpperCase()}`,
  },
  items: [OrderItemSchema],
  subtotal: {
    type: Number,
    required: true,
  },
  tax: {
    type: Number,
    default: 0,
  },
  shipping: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "returned",
    ],
    default: "pending",
  },
  payment_status: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending",
  },
  shipping_address: {
    type: String,
    required: true,
  },
  notes: {
    type: String,
    default: "",
  },
  // Store complete customer details
  customer_details: CustomerDetailsSchema,

  // Return and cancellation fields
  return_requested_at: {
    type: Date,
  },
  return_reason: {
    type: String,
    default: "",
  },
  cancelled_at: {
    type: Date,
  },
  cancellation_reason: {
    type: String,
    default: "",
  },

  placed_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// Update the 'updated_at' field before saving
ClientOrderSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model("ClientOrder", ClientOrderSchema);
