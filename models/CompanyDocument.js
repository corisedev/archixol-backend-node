const mongoose = require("mongoose");

const CompanyDocumentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: [true, "Document title is required"],
    trim: true,
  },
  dated: {
    type: Date,
    required: [true, "Document date is required"],
  },
  doc_image: {
    type: String,
    required: [true, "Document image is required"],
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
CompanyDocumentSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("CompanyDocument", CompanyDocumentSchema);
