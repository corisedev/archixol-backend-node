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

// Modified code for processProductData middleware in middleware/productUpload.js
exports.processProductData = (req, res, next) => {
  try {
    // ... existing code ...

    if (req.body && req.body.data) {
      // Decrypt the data field
      const bytes = CryptoJS.AES.decrypt(
        req.body.data,
        process.env.AES_SECRET_KEY
      );
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

      // Parse the decrypted data
      const parsedData = JSON.parse(decryptedData);

      // Process search_collection field properly
      if (parsedData.search_collection) {
        if (Array.isArray(parsedData.search_collection)) {
          // Make sure each item is just the ObjectId, not an array or nested structure
          parsedData.search_collection = parsedData.search_collection
            .map((item) => {
              // If it's an object with id/ObjectId property, extract just that
              if (typeof item === "object" && item !== null) {
                return item.id || item._id;
              }
              // If it's a string that looks like an array, try to parse it
              if (
                typeof item === "string" &&
                item.startsWith("[") &&
                item.endsWith("]")
              ) {
                try {
                  // Try to extract ObjectId from the string if possible
                  const parsed = JSON.parse(item);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed[0]; // Take first item if it's an array
                  }
                } catch (e) {
                  // Parsing failed, just return the original item
                  return item;
                }
              }
              return item;
            })
            .filter((id) => id); // Filter out any empty/null/undefined values
        } else if (typeof parsedData.search_collection === "string") {
          // If it's a single string, make it an array with one item
          parsedData.search_collection = [parsedData.search_collection];
        }
      }

      // Replace req.body with the parsed data
      req.body = parsedData;

      // Add newly uploaded files to media
      // ... rest of existing code ...
    }

    next();
  } catch (error) {
    // ... error handling ...
  }
};
