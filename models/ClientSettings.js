// models/ClientSettings.js
const mongoose = require("mongoose");

const ClientSettingsSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  two_factor: {
    type: Boolean,
    default: false,
  },
  email_notify_for_logins: {
    type: Boolean,
    default: false,
  },
  remember_30days: {
    type: Boolean,
    default: false,
  },
  // Additional security settings can be added here
  two_factor_secret: {
    type: String,
    default: "",
  },
  backup_codes: {
    type: [String],
    default: [],
  },
  last_password_change: {
    type: Date,
    default: Date.now,
  },
  login_notifications: {
    type: Boolean,
    default: true,
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
ClientSettingsSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("ClientSettings", ClientSettingsSchema);
