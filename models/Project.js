const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  project_title: {
    type: String,
    required: [true, "Project title is required"],
    trim: true,
  },
  project_category: {
    type: String,
    required: [true, "Project category is required"],
    trim: true,
  },
  project_location: {
    type: String,
    required: [true, "Project location is required"],
    trim: true,
  },
  project_description: {
    type: String,
    required: [true, "Project description is required"],
    trim: true,
  },
  start_date: {
    type: Date,
    required: [true, "Project start date is required"],
  },
  end_date: {
    type: Date,
  },
  project_imgs: {
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
ProjectSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Project", ProjectSchema);
