// models/Conversation.js (Updated to handle Map properly)
const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  ],
  // Track last message for preview purposes
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
  },
  lastMessageText: {
    type: String,
    default: "",
  },
  lastMessageTime: {
    type: Date,
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: () => new Map(), // Initialize as empty Map
  },
  isActive: {
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

// Update updatedAt on save and ensure unreadCount is properly initialized
ConversationSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Ensure unreadCount is a Map and initialize for all participants
  if (!this.unreadCount || typeof this.unreadCount.set !== "function") {
    this.unreadCount = new Map();
  }

  // Initialize unread count for all participants if not set
  // IMPORTANT: Convert ObjectId to string to avoid the dot issue
  this.participants.forEach((participantId) => {
    // Handle both ObjectId and populated participant objects
    let id;
    if (typeof participantId === "object" && participantId._id) {
      // It's a populated participant object
      id = participantId._id.toString();
    } else {
      // It's just an ObjectId
      id = participantId.toString();
    }

    if (!this.unreadCount.has(id)) {
      this.unreadCount.set(id, 0);
    }
  });

  next();
});

// Method to safely get unread count for a user
ConversationSchema.methods.getUnreadCount = function (userId) {
  if (!this.unreadCount || typeof this.unreadCount.get !== "function") {
    return 0;
  }
  // Ensure userId is a string
  const id = typeof userId === "object" ? userId.toString() : userId.toString();
  return this.unreadCount.get(id) || 0;
};

// Method to safely set unread count for a user
ConversationSchema.methods.setUnreadCount = function (userId, count) {
  if (!this.unreadCount || typeof this.unreadCount.set !== "function") {
    this.unreadCount = new Map();
  }
  // Ensure userId is a string
  const id = typeof userId === "object" ? userId.toString() : userId.toString();
  this.unreadCount.set(id, count);
};

// Method to increment unread count for a user
ConversationSchema.methods.incrementUnreadCount = function (userId) {
  const currentCount = this.getUnreadCount(userId);
  this.setUnreadCount(userId, currentCount + 1);
};

// Method to reset unread count for a user
ConversationSchema.methods.resetUnreadCount = function (userId) {
  this.setUnreadCount(userId, 0);
};

// Static method to create conversation with proper unread count initialization
ConversationSchema.statics.createWithParticipants = async function (
  participantIds
) {
  const unreadCount = new Map();
  participantIds.forEach((id) => {
    // Ensure all IDs are strings
    const stringId = typeof id === "object" ? id.toString() : id.toString();
    unreadCount.set(stringId, 0);
  });

  return this.create({
    participants: participantIds,
    unreadCount: unreadCount,
  });
};

module.exports = mongoose.model("Conversation", ConversationSchema);
