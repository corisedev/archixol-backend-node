// models/ContactSupport.js
const mongoose = require("mongoose");

// Contact Message Schema
const ContactMessageSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null, // Allow anonymous messages
  },
  fullname: {
    type: String,
    required: [true, "Full name is required"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email",
    ],
  },
  phone_number: {
    type: String,
    default: "",
  },
  subject: {
    type: String,
    required: [true, "Subject is required"],
  },
  message: {
    type: String,
    required: [true, "Message is required"],
  },
  status: {
    type: String,
    enum: ["new", "read", "replied", "closed"],
    default: "new",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Feedback Schema
const FeedbackSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null, // Allow anonymous feedback
  },
  fullname: {
    type: String,
    required: [true, "Full name is required"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email",
    ],
  },
  feedback: {
    type: String,
    required: [true, "Feedback is required"],
  },
  suggestions: {
    type: String,
    default: "",
  },
  feedback_type: {
    type: String,
    enum: ["general", "product", "service", "website", "other"],
    default: "general",
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 0,
  },
  status: {
    type: String,
    enum: ["new", "read", "resolved"],
    default: "new",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Support Request Schema
const SupportRequestSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null, // Allow anonymous support requests
  },
  fullname: {
    type: String,
    required: [true, "Full name is required"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email",
    ],
  },
  phone_number: {
    type: String,
    default: "",
  },
  support_category: {
    type: String,
    enum: [
      "account",
      "order",
      "product",
      "payment",
      "delivery",
      "technical",
      "other",
    ],
    default: "other",
  },
  subject: {
    type: String,
    required: [true, "Subject is required"],
  },
  message: {
    type: String,
    required: [true, "Message is required"],
  },
  status: {
    type: String,
    enum: ["open", "in-progress", "resolved", "closed"],
    default: "open",
  },
  ticket_number: {
    type: String,
    unique: true,
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

// Generate a ticket number before saving
SupportRequestSchema.pre("save", function (next) {
  if (!this.ticket_number) {
    // Create a ticket number with format: SUP-YYYYMMDD-XXXX
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number

    this.ticket_number = `SUP-${year}${month}${day}-${random}`;
  }

  this.updatedAt = Date.now();
  next();
});

// Define models
const ContactMessage = mongoose.model("ContactMessage", ContactMessageSchema);
const Feedback = mongoose.model("Feedback", FeedbackSchema);
const SupportRequest = mongoose.model("SupportRequest", SupportRequestSchema);

module.exports = {
  ContactMessage,
  Feedback,
  SupportRequest,
};
