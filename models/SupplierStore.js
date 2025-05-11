// models/SupplierStore.js
const mongoose = require("mongoose");

const SupplierStoreSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  store_logo: {
    type: String,
    default: "",
  },
  store_name: {
    type: String,
    default: "",
  },
  email: {
    type: String,
    default: "",
  },
  currency: {
    type: String,
    default: "PKR",
  },
  time_zone: {
    type: String,
    default: "Asia/Karachi",
  },
  // Tax information
  is_auto_apply_tax: {
    type: Boolean,
    default: true,
  },
  default_tax_rate: {
    type: String,
    default: "10",
  },
  reg_number: {
    type: String,
    default: "",
  },
  // User recovery data
  recovery_phone: {
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

// Update the 'updatedAt' field before saving
SupplierStoreSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("SupplierStore", SupplierStoreSchema);
