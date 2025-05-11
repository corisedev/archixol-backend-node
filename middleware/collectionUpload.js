// middleware/collectionUpload.js
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

// Configure storage for collection images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/collections";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `collection-${req.user.id}-${uniqueSuffix}${ext}`);
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

// Set up multer middleware for collection image uploads
exports.uploadCollectionImages = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 5, // maximum 5 files
  },
  fileFilter: fileFilter,
}).array("collection_images", 5);

// Handle upload errors
exports.handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File size is too large. Maximum size is 5MB." });
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

// Custom middleware to process uploaded files and decrypted data
exports.processCollectionData = (req, res, next) => {
  try {
    console.log("Request after file upload:", req.body);
    console.log("Files:", req.files);

    // Store collection_images separately to avoid overwriting
    let existing_images = [];
    if (req.body.collection_images) {
      if (Array.isArray(req.body.collection_images)) {
        existing_images = [...req.body.collection_images];
      } else {
        existing_images = [req.body.collection_images];
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

      // Process product_list if it exists to ensure it's an array of IDs
      if (parsedData.product_list && Array.isArray(parsedData.product_list)) {
        parsedData.product_list = parsedData.product_list
          .map((product) => {
            if (typeof product === "object") {
              return product.id || product._id;
            }
            return product;
          })
          .filter((id) => id);
      }

      // Add newly uploaded file paths
      const newUploaded = [];
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          newUploaded.push(`/uploads/collections/${file.filename}`);
        });
      }

      // Replace req.body with the decrypted data
      req.body = parsedData;

      // Add back existing images and newly uploaded images
      req.body.collection_images = [
        ...(parsedData.collection_images || []),
        ...existing_images,
        ...newUploaded,
      ];
    } else if (req.files && req.files.length > 0) {
      // If there's no encrypted data but there are files
      if (!req.body.collection_images) {
        req.body.collection_images = [];
      }

      // Add uploaded files to collection_images
      req.files.forEach((file) => {
        req.body.collection_images.push(
          `/uploads/collections/${file.filename}`
        );
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
