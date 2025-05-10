const mongoose = require("mongoose");

const UserProfileSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  fullname: {
    type: String,
    trim: true,
  },
  phone_number: {
    type: String,
    trim: true,
  },
  experience: {
    type: Number,
  },
  cnic: {
    type: String,
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },
  service_location: {
    type: String,
    trim: true,
  },
  introduction: {
    type: String,
    trim: true,
  },
  website: {
    type: String,
    trim: true,
  },
  profile_img: {
    type: String,
    default: "",
  },
  banner_img: {
    type: String,
    default: "",
  },
  intro_video: {
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
UserProfileSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("UserProfile", UserProfileSchema);
