// middleware/chatUpload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const CryptoJS = require("crypto-js");

// Create storage directory if it doesn't exist
const createStorageDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage for chat attachments
const chatStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/chat";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `chat-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure file filter
const fileFilter = (req, file, cb) => {
  // Accept images, documents, audio, and small videos
  const allowedMimeTypes = [
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    // Audio
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/ogg",
    // Video (small)
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb({ message: "Unsupported file format" }, false);
  }
};

// Set up multer middleware for chat attachments
exports.uploadChatAttachments = multer({
  storage: chatStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 5, // maximum 5 files at once
  },
  fileFilter: fileFilter,
}).array("attachments", 5);

// Handle upload errors
exports.handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File size is too large. Maximum size is 10MB." });
    } else if (err.code === "LIMIT_FILE_COUNT") {
      return res
        .status(400)
        .json({ error: "Too many files. Maximum is 5 files." });
    } else {
      return res.status(400).json({ error: err.message });
    }
  } else if (err) {
    return res
      .status(400)
      .json({ error: err.message || "Error uploading files" });
  }
  next();
};

// Process chat message with attachments
exports.processChatMessage = (req, res, next) => {
  try {
    console.log("Processing chat message with attachments");
    console.log("Files:", req.files);

    // If there are encrypted data in the request
    if (req.body && req.body.data) {
      // Decrypt the data field
      const bytes = CryptoJS.AES.decrypt(
        req.body.data,
        process.env.AES_SECRET_KEY
      );
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

      console.log("Decrypted chat data:", decryptedData);

      // Parse the decrypted data
      const parsedData = JSON.parse(decryptedData);

      // Replace req.body with the parsed data
      req.body = parsedData;
    }

    // Process uploaded files and add them to the message
    if (req.files && req.files.length > 0) {
      req.body.attachments = req.files.map(
        (file) => `/uploads/chat/${file.filename}`
      );
    } else {
      req.body.attachments = [];
    }

    console.log("Final processed chat message:", req.body);
    next();
  } catch (error) {
    console.error("Error processing chat message:", error);

    // Delete uploaded files if there was an error
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkErr) {
          console.error("Error deleting file:", unlinkErr);
        }
      });
    }

    return res
      .status(400)
      .json({ error: "Failed to process message: " + error.message });
  }
};
