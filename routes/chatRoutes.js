// routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const {
  getConversations,
  getMessages,
  startConversation,
  sendMessage,
  markAsRead,
  getUserStatus,
  setTypingStatus,
  getNotifications,
  markNotificationsAsRead,
  searchUsers,
} = require("../controllers/chatController");

const { protect } = require("../middleware/auth");
const { decryptRequest } = require("../middleware/encryption");

// Apply authentication middleware to all chat routes
router.use(protect);
// Apply decryption middleware to routes that receive data
router.use(decryptRequest);

// Conversation routes
router.get("/conversations", getConversations);
router.post("/conversation/start", startConversation);

// Messages routes
router.post("/messages", getMessages);
router.post("/send", sendMessage);
router.post("/mark-read", markAsRead);

// Status routes
router.post("/status", getUserStatus);
router.post("/typing", setTypingStatus);

// Notification routes
router.get("/notifications", getNotifications);
router.post("/notifications/mark-read", markNotificationsAsRead);

// User search route
router.post("/search-users", searchUsers);

module.exports = router;
