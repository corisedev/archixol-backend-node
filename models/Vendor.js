// models/Vendor.js
const mongoose = require("mongoose");

const VendorSchema = new mongoose.Schema({
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
  street_address: {
    type: String,
    default: "",
  },
  city: {
    type: String,
    default: "",
  },
  state_province: {
    type: String,
    default: "",
  },
  zip_code: {
    type: String,
    default: "",
  },
  country: {
    type: String,
    default: "",
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

// Generate vendor_name from first_name and last_name
VendorSchema.virtual("vendor_name").get(function () {
  return `${this.first_name} ${this.last_name}`;
});

// Update the 'updatedAt' field before saving
VendorSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Make sure virtuals are included when converting to JSON
VendorSchema.set("toJSON", { virtuals: true });
VendorSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Vendor", VendorSchema);
