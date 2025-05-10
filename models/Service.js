const mongoose = require("mongoose");

const ServiceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  service_title: {
    type: String,
    required: [true, "Please add a service title"],
    trim: true,
    maxlength: [100, "Service title cannot be more than 100 characters"],
  },
  service_category: {
    type: String,
    required: [true, "Please add a service category"],
  },
  service_description: {
    type: String,
    required: [true, "Please add a service description"],
  },
  service_status: {
    type: Boolean,
    default: false,
  },
  service_images: {
    type: [String],
    default: [],
  },
  service_faqs: [
    {
      question: {
        type: String,
        required: [true, "FAQ question is required"],
      },
      answer: {
        type: String,
        required: [true, "FAQ answer is required"],
      },
    },
  ],
  service_process: [
    {
      step: {
        type: String,
        required: [true, "Process step is required"],
      },
    },
  ],
  service_feature: [
    {
      feature: {
        type: String,
        required: [true, "Feature is required"],
      },
    },
  ],
  service_tags: {
    type: [String],
    default: [],
  },
  rating: {
    type: Number,
    default: 0,
  },
  reviews_count: {
    type: Number,
    default: 0,
  },
  total_jobs_completed: {
    type: Number,
    default: 0,
  },
  total_job_requests: {
    type: Number,
    default: 0,
  },
  total_earnings: {
    type: Number,
    default: 0,
  },
  total_pending_jobs: {
    type: Number,
    default: 0,
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
ServiceSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Service", ServiceSchema);
