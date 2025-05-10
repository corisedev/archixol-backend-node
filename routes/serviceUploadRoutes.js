const express = require("express");
const router = express.Router();
const { encryptData } = require("../utils/encryptResponse");
const {
  uploadServiceImages,
  handleUploadErrors,
} = require("../middleware/fileUpload");
const { protect, authorizeServiceProvider } = require("../middleware/auth");

// @desc    Upload service images
// @route   POST /uploads/service-images
// @access  Private (Service Provider Only)
router.post(
  "/service-images",
  protect,
  authorizeServiceProvider,
  uploadServiceImages,
  handleUploadErrors,
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Create file paths to return to client
      const filePaths = req.files.map((file) => {
        return `/uploads/services/${file.filename}`;
      });

      const responseData = {
        message: "Files uploaded successfully",
        files: filePaths,
      };

      const encryptedData = encryptData(responseData);
      res.status(200).json({ data: encryptedData });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router;
