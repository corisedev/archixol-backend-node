// models/ProjectJob.js
const mongoose = require("mongoose");

const ProposalSchema = new mongoose.Schema({
  service_provider_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  proposal_text: {
    type: String,
    required: true,
  },
  proposed_budget: {
    type: Number,
    required: true,
  },
  proposed_timeline: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
  submitted_at: {
    type: Date,
    default: Date.now,
  },
});

const ProjectJobSchema = new mongoose.Schema({
  client_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: [true, "Job title is required"],
    trim: true,
    maxlength: [200, "Title cannot be more than 200 characters"],
  },
  type: {
    type: String,
    required: [true, "Job type is required"],
    default: "project",
  },
  description: {
    type: String,
    required: [true, "Job description is required"],
    trim: true,
    maxlength: [5000, "Description cannot be more than 5000 characters"],
  },
  budget: {
    type: Number,
    required: [true, "Budget is required"],
    min: [0, "Budget must be positive"],
  },
  starting_date: {
    type: Date,
    required: [true, "Starting Date is required"],
  },
  timeline: {
    type: String,
    required: [true, "Timeline is required"],
    trim: true,
  },
  city: {
    type: String,
    required: [true, "City is required"],
    trim: true,
  },
  note: {
    type: String,
    required: false,
  },
  address: {
    type: String,
    required: [true, "Address is required"],
    trim: true,
  },
  urgent: {
    type: Boolean,
    default: false,
  },
  docs: {
    type: [String], // Array of file paths
    default: [],
  },
  required_skills: {
    type: [String],
    default: [],
  },
  tags: {
    type: [String],
    default: [],
  },
  status: {
    type: String,
    enum: ["open", "in_progress", "completed", "cancelled", "closed"],
    default: "open",
  },
  proposals: [ProposalSchema],
  selected_provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  started_at: {
    type: Date,
  },
  completed_at: {
    type: Date,
  },
  payment_status: {
    type: String,
    enum: ["pending", "paid", "refunded"],
    default: "pending",
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

// Virtual for proposal count
ProjectJobSchema.virtual("proposal_count").get(function () {
  return this.proposals ? this.proposals.length : 0;
});

// Update the 'updatedAt' field before saving
ProjectJobSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Make sure virtuals are included when converting to JSON
ProjectJobSchema.set("toJSON", { virtuals: true });
ProjectJobSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("ProjectJob", ProjectJobSchema);
