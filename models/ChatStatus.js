const mongoose = require("mongoose");

const ChatStatusSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  isTyping: {
    type: Map,
    of: Boolean,
    default: new Map(), // Maps conversation IDs to typing status
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update updatedAt on save
ChatStatusSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("ChatStatus", ChatStatusSchema);
