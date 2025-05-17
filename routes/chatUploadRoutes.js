// routes/chatUploadRoutes.js
const express = require("express");
const router = express.Router();
const { encryptData } = require("../utils/encryptResponse");
const { protect } = require("../middleware/auth");
const {
  uploadChatAttachments,
  handleUploadErrors,
  processChatMessage,
} = require("../middleware/chatUpload");

// @desc    Upload chat attachments
// @route   POST /uploads/chat/attachments
// @access  Private
router.post(
  "/attachments",
  protect,
  uploadChatAttachments,
  handleUploadErrors,
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Create file paths to return to client
      const attachments = req.files.map((file) => ({
        url: `/uploads/chat/${file.filename}`,
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
      }));

      const responseData = {
        message: "Attachments uploaded successfully",
        attachments,
      };

      const encryptedData = encryptData(responseData);
      res.status(200).json({ data: encryptedData });
    } catch (err) {
      console.error("Error in chat attachment upload:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// @desc    Send message with attachments
// @route   POST /uploads/chat/send-with-attachments
// @access  Private
router.post(
  "/send-with-attachments",
  protect,
  uploadChatAttachments,
  handleUploadErrors,
  processChatMessage,
  (req, res, next) => {
    // Forward the processed request to the sendMessage controller
    req.originalUrl = "/chat/send";

    // Route to the chat controller
    require("../controllers/chatController").sendMessage(req, res, next);
  }
);

module.exports = router;
