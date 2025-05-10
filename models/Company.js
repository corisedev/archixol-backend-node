const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  name: {
    type: String,
    trim: true,
  },
  business_email: {
    type: String,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email",
    ],
  },
  address: {
    type: String,
    trim: true,
  },
  experience: {
    type: Number,
    default: 0,
  },
  description: {
    type: String,
    trim: true,
  },
  owner_name: {
    type: String,
    trim: true,
  },
  owner_cnic: {
    type: String,
    trim: true,
  },
  phone_number: {
    type: String,
    trim: true,
  },
  service_location: {
    type: String,
    trim: true,
  },
  logo: {
    type: String,
    default: "",
  },
  banner: {
    type: String,
    default: "",
  },
  BRN: {
    type: String,
    default: "",
  },
  tax_ntn: {
    type: String,
    default: "",
  },
  license_img: {
    type: String,
    default: "",
  },
  services_tags: {
    type: [String],
    default: [],
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
CompanySchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Company", CompanySchema);
