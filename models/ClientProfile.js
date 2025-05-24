// models/ClientProfile.js
const mongoose = require("mongoose");

const ClientProfileSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  profile_img: {
    type: String,
    default: "",
  },
  full_name: {
    type: String,
    trim: true,
    maxlength: [100, "Full name cannot be more than 100 characters"],
    default: "",
  },
  phone_number: {
    type: String,
    trim: true,
    maxlength: [20, "Phone number cannot be more than 20 characters"],
    default: "",
  },
  company_name: {
    type: String,
    trim: true,
    maxlength: [100, "Company name cannot be more than 100 characters"],
    default: "",
  },
  business_type: {
    type: String,
    trim: true,
    maxlength: [100, "Business type cannot be more than 100 characters"],
    default: "",
  },
  address: {
    type: String,
    trim: true,
    maxlength: [500, "Address cannot be more than 500 characters"],
    default: "",
  },
  city: {
    type: String,
    trim: true,
    maxlength: [100, "City cannot be more than 100 characters"],
    default: "",
  },
  about: {
    type: String,
    trim: true,
    maxlength: [2000, "About section cannot be more than 2000 characters"],
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
ClientProfileSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("ClientProfile", ClientProfileSchema);
