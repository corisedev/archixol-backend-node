const mongoose = require("mongoose");

const CertificateSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: [true, "Certificate title is required"],
    trim: true,
  },
  dated: {
    type: Date,
    required: [true, "Certificate date is required"],
  },
  certificate_img: {
    type: String,
    required: [true, "Certificate image is required"],
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
CertificateSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Certificate", CertificateSchema);
