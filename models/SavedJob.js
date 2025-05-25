// CREATE NEW FILE: models/SavedJob.js

const mongoose = require("mongoose");

const SavedJobSchema = new mongoose.Schema({
  service_provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  project_job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProjectJob",
    required: true,
  },
  saved_at: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    default: "",
    maxlength: [500, "Notes cannot be more than 500 characters"],
  },
  tags: {
    type: [String],
    default: [],
  },
  reminder_date: {
    type: Date,
    default: null,
  },
  is_reminded: {
    type: Boolean,
    default: false,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create compound index to prevent duplicate saves
SavedJobSchema.index({ service_provider: 1, project_job: 1 }, { unique: true });

// Update the 'updatedAt' field before saving
SavedJobSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for checking if job is still available
SavedJobSchema.virtual("is_available").get(function () {
  return (
    this.project_job &&
    this.project_job.status === "open" &&
    !this.project_job.selected_provider
  );
});

// Make sure virtuals are included when converting to JSON
SavedJobSchema.set("toJSON", { virtuals: true });
SavedJobSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("SavedJob", SavedJobSchema);
