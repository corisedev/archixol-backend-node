// middleware/profileUpload.js
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

// Configure storage for profile images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/profiles";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure file filter for images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb({ message: "Unsupported file format. Only images are allowed." }, false);
  }
};

// Set up multer middleware for profile image uploads
exports.uploadProfileImage = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: fileFilter,
}).single("profile_image");

// Handle upload errors
exports.handleProfileUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File size is too large. Maximum size is 5MB." });
    } else {
      return res.status(400).json({ error: err.message });
    }
  } else if (err) {
    return res
      .status(400)
      .json({ error: err.message || "Error uploading profile image" });
  }
  next();
};

// Custom middleware to process uploaded profile image and decrypted data
exports.processProfileData = (req, res, next) => {
  try {
    console.log("Request after file upload:", req.body);
    console.log("File:", req.file);

    // Store the existing profile image path to avoid overwriting
    let existing_profile_image = req.body.profile_image || "";

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

      // Replace req.body with the decrypted data
      req.body = parsedData;
    }

    // If there's a newly uploaded file, use its path
    if (req.file) {
      req.body.profile_image = `/uploads/profiles/${req.file.filename}`;
    } else if (existing_profile_image && !req.body.profile_image) {
      // Keep the existing profile image if no new one is uploaded
      req.body.profile_image = existing_profile_image;
    }

    console.log("Final request body:", req.body);
    next();
  } catch (error) {
    console.error("Processing error:", error);
    // Delete uploaded file if there was an error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error("Error deleting file:", unlinkErr);
      }
    }
    return res
      .status(400)
      .json({ error: "Failed to process request: " + error.message });
  }
};
