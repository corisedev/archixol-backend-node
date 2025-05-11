// middleware/productUpload.js
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

// Configure storage for product images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/products";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    console.log(req.user.id);
    cb(null, `product-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure file filter for images
const fileFilter = (req, file, cb) => {
  cb(null, true);
};

// Set up multer middleware for product image uploads
exports.uploadProductImages = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 10, // maximum 10 files
  },
  fileFilter: fileFilter,
}).array("media", 10);

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
        .json({ error: "Too many files. Maximum is 10 files." });
    } else {
      return res.status(400).json({ error: "Error of file Size" });
    }
  } else if (err) {
    return res.status(400).json({ error: "Error uploading files" });
  }
  next();
};

// Custom middleware to process uploaded files and decrypted data
exports.processProductData = (req, res, next) => {
  try {
    console.log("Request after file upload:", req.body);
    console.log("Files:", req.files);

    // Store media_urls separately to avoid overwriting
    let media_urls = [];
    if (req.body.media) {
      if (Array.isArray(req.body.media)) {
        media_urls = [...req.body.media];
      } else {
        media_urls = [req.body.media];
      }
    }

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

      // Add newly uploaded file paths
      const newUploaded = [];
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          newUploaded.push(`/uploads/products/${file.filename}`);
        });
      }

      // Replace req.body with the decrypted data
      req.body = parsedData;

      // Add back the media_urls
      if (media_urls.length > 0) {
        req.body.media_urls = media_urls;
      }

      // Add newly uploaded files to media
      if (newUploaded.length > 0) {
        req.body.media = [...(req.body.media || []), ...newUploaded];
      }
    } else if (req.files && req.files.length > 0) {
      // If there's no encrypted data but there are files
      if (!req.body.media) {
        req.body.media = [];
      }

      // Add uploaded files to media
      req.files.forEach((file) => {
        req.body.media.push(`/uploads/products/${file.filename}`);
      });
    }

    console.log("Final request body:", req.body);
    next();
  } catch (error) {
    console.error("Processing error:", error);
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
      .json({ error: "Failed to process request: " + error.message });
  }
};
