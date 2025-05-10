const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema({
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,
  },
  service_provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: [
      "requested",
      "accepted",
      "in_progress",
      "completed",
      "cancelled",
      "rejected",
    ],
    default: "requested",
  },
  price: {
    type: Number,
    required: true,
  },
  payment_status: {
    type: String,
    enum: ["pending", "paid", "refunded"],
    default: "pending",
  },
  requirements: {
    type: String,
    required: [true, "Please specify job requirements"],
  },
  delivery_date: {
    type: Date,
  },
  completed_date: {
    type: Date,
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
    },
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
JobSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Job", JobSchema);
