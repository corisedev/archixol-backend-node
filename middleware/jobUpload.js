// middleware/jobUpload.js
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

// Configure storage for job documents
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/jobs/documents";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `job-doc-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure file filter for documents
const fileFilter = (req, file, cb) => {
  // Accept documents and images
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
    "text/plain",
    "text/csv",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb({ message: "Unsupported file format" }, false);
  }
};

// Set up multer middleware for job document uploads
exports.uploadJobDocuments = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 5, // maximum 5 files
  },
  fileFilter: fileFilter,
}).array("docs", 5);

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

// Custom middleware to process uploaded files and decrypted data
exports.processJobData = (req, res, next) => {
  try {
    console.log("Request after file upload:", req.body);
    console.log("Files:", req.files);

    // Store existing docs separately to avoid overwriting
    let existing_docs = [];
    if (req.body.docs) {
      if (Array.isArray(req.body.docs)) {
        existing_docs = [...req.body.docs];
      } else {
        existing_docs = [req.body.docs];
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
          newUploaded.push(`/uploads/jobs/documents/${file.filename}`);
        });
      }

      // Replace req.body with the decrypted data
      req.body = parsedData;

      // Add back existing docs and newly uploaded files
      req.body.docs = [
        ...(parsedData.docs || []),
        ...existing_docs,
        ...newUploaded,
      ];
    } else if (req.files && req.files.length > 0) {
      // If there's no encrypted data but there are files
      if (!req.body.docs) {
        req.body.docs = [];
      }

      // Add uploaded files to docs
      req.files.forEach((file) => {
        req.body.docs.push(`/uploads/jobs/documents/${file.filename}`);
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
