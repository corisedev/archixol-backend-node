const express = require("express");
const router = express.Router();
const {
  getCompanyData,
  updateCompanyData,
} = require("../controllers/companyController");
const {
  validateCompanyDataUpdate,
  validate,
} = require("../utils/companyValidation");
const { protect, authorizeCompany } = require("../middleware/auth");
const { decryptRequest } = require("../middleware/encryption");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const CryptoJS = require("crypto-js");

// Create storage directory if it doesn't exist
const createStorageDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage for company files
const companyStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    let dir;

    // Determine destination folder based on field name
    if (file.fieldname === "logo") {
      dir = "uploads/company/logos";
    } else if (file.fieldname === "banner") {
      dir = "uploads/company/banners";
    } else if (file.fieldname === "license_img") {
      dir = "uploads/company/licenses";
    } else {
      dir = "uploads/company/misc";
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

// Configure file filter for images
const imageFileFilter = (req, file, cb) => {
  cb(null, true);
};

// Set up multer middleware for company file uploads
const uploadCompanyFiles = multer({
  storage: companyStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: imageFileFilter,
}).fields([
  { name: "logo", maxCount: 1 },
  { name: "banner", maxCount: 1 },
  { name: "license_img", maxCount: 1 },
]);

// Handle upload errors
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File size is too large. Maximum size is 10MB." });
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ error: "Unexpected file field." });
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

// Apply company authorization to all routes
router.use(protect);
router.use(authorizeCompany);

// Get company data
router.get("/get_data", decryptRequest, getCompanyData);

// Update company data
router.post(
  "/update_data",
  // First handle file uploads
  uploadCompanyFiles,
  handleUploadErrors,
  // Then process the encrypted data
  (req, res, next) => {
    try {
      console.log("Raw request for company update:", req.body);
      console.log("Files:", req.files);

      if (req.body && req.body.data) {
        // Decrypt the data field
        const bytes = CryptoJS.AES.decrypt(
          req.body.data,
          process.env.AES_SECRET_KEY
        );
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

        console.log("Decrypted data for company update:", decryptedData);

        // Parse the decrypted data
        const parsedData = JSON.parse(decryptedData);

        // Process uploaded files
        const fileData = {};

        if (req.files) {
          // Process logo
          if (req.files.logo && req.files.logo[0]) {
            fileData.logo_path = `/uploads/company/logos/${req.files.logo[0].filename}`;
          }

          // Process banner
          if (req.files.banner && req.files.banner[0]) {
            fileData.banner_path = `/uploads/company/banners/${req.files.banner[0].filename}`;
          }

          // Process license image
          if (req.files.license_img && req.files.license_img[0]) {
            fileData.license_img_path = `/uploads/company/licenses/${req.files.license_img[0].filename}`;
          }
        }

        // Replace req.body with the parsed data and add file paths
        req.body = {
          ...parsedData,
          ...fileData,
        };
      }

      console.log("Final request body for company update:", req.body);
      next();
    } catch (error) {
      console.error("Processing error:", error);
      // Delete uploaded files if there was an error
      if (req.files) {
        Object.keys(req.files).forEach((fieldname) => {
          req.files[fieldname].forEach((file) => {
            try {
              fs.unlinkSync(file.path);
            } catch (unlinkErr) {
              console.error("Error deleting file:", unlinkErr);
            }
          });
        });
      }
      return res
        .status(400)
        .json({ error: "Failed to process request: " + error.message });
    }
  },
  // Then validate the processed data
  validateCompanyDataUpdate,
  validate,
  // Finally update the company data
  updateCompanyData
);

module.exports = router;
