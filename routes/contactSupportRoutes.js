// routes/contactSupportRoutes.js
const express = require("express");
const router = express.Router();

// Import controllers
const {
  sendContactMessage,
  sendFeedback,
  createSupportRequest,
} = require("../controllers/contactSupportController");

// Import middleware
const { decryptRequest } = require("../middleware/encryption");
const { getUser } = require("../middleware/auth"); // Optional middleware to get user if authenticated

// Apply optional authentication middleware
// This will set req.user if the user is authenticated, but won't require authentication
router.use(getUser);

// Contact and support routes
router.post("/contact", decryptRequest, sendContactMessage);
router.post("/feedback", decryptRequest, sendFeedback);
router.post("/support", decryptRequest, createSupportRequest);

module.exports = router;
