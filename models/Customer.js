// models/Customer.js
const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  first_name: {
    type: String,
    required: [true, "First name is required"],
    trim: true,
  },
  last_name: {
    type: String,
    required: [true, "Last name is required"],
    trim: true,
  },
  language: {
    type: String,
    default: "English",
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email",
    ],
  },
  phone_number: {
    type: String,
    default: "",
  },
  email_subscribe: {
    type: Boolean,
    default: false,
  },
  msg_subscribe: {
    type: Boolean,
    default: false,
  },
  default_address: {
    type: String,
    default: "",
  },
  notes: {
    type: String,
    default: "",
  },
  amount_spent: {
    type: Number,
    default: 0,
  },
  orders_count: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["active", "inactive", "deleted"],
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

// Generate customer_name from first_name and last_name
CustomerSchema.virtual("customer_name").get(function () {
  return `${this.first_name} ${this.last_name}`;
});

// Update the 'updatedAt' field before saving
CustomerSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Make sure virtuals are included when converting to JSON
CustomerSchema.set("toJSON", { virtuals: true });
CustomerSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Customer", CustomerSchema);
