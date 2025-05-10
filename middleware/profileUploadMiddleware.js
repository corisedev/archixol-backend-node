// middleware/profileUploadMiddleware.js
const CryptoJS = require("crypto-js");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create storage directory if it doesn't exist
const createStorageDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage for profile images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let dir;

    // Determine destination folder based on field name
    if (file.fieldname === "profile_img") {
      dir = "uploads/profile/images";
    } else if (file.fieldname === "banner_img") {
      dir = "uploads/profile/banners";
    } else if (file.fieldname === "intro_video") {
      dir = "uploads/profile/videos";
    } else {
      dir = "uploads/profile/misc";
    }

    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);

    // Use field name as prefix for better organization
    cb(null, `${file.fieldname}-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure file filter for images and videos
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "intro_video") {
    // Accept video files
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(
        {
          message:
            "Unsupported file format. Only videos are allowed for intro_video.",
        },
        false
      );
    }
  } else {
    // Accept image files for profile_img and banner_img
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(
        {
          message:
            "Unsupported file format. Only images are allowed for profile and banner images.",
        },
        false
      );
    }
  }
};

// Set up multer middleware for combined uploads
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size (larger for videos)
  },
  fileFilter: fileFilter,
});

// Handle profile update with file uploads and decryption
exports.handleProfileUpload = [
  // Handle file uploads for multiple fields
  upload.fields([
    { name: "profile_img", maxCount: 1 },
    { name: "banner_img", maxCount: 1 },
    { name: "intro_video", maxCount: 1 },
  ]),

  // Handle upload errors
  (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: "File size is too large. Maximum size is 50MB." });
      } else if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ error: "Too many files uploaded." });
      } else {
        return res.status(400).json({ error: err.message });
      }
    } else if (err) {
      return res
        .status(400)
        .json({ error: err.message || "Error uploading files" });
    }
    next();
  },

  // Decrypt data
  (req, res, next) => {
    try {
      console.log("Request after file upload:", req.body);
      console.log("Files received:", req.files);

      if (req.body && req.body.data) {
        // Decrypt the data field
        const bytes = CryptoJS.AES.decrypt(
          req.body.data,
          process.env.AES_SECRET_KEY
        );
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

        console.log("Decrypted data:", decryptedData);

        // Parse the decrypted data
        const parsedData = JSON.parse(decryptedData);

        // Replace req.body with the combined data (keeping the files information)
        req.body = {
          ...parsedData,
          files: req.files, // Store files information for use in controller
        };
      }

      console.log("Final request body:", req.body);
      next();
    } catch (error) {
      console.error("Processing error:", error);
      return res
        .status(400)
        .json({ error: "Failed to process request: " + error.message });
    }
  },
];
