const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create storage directory if it doesn't exist
const createStorageDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage for company logo
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/company/logos";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `logo-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure storage for company banner
const bannerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/company/banners";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `banner-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure storage for company license
const licenseStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/company/licenses";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `license-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure storage for company documents
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/company/documents";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `document-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure file filter for images
const imageFileFilter = (req, file, cb) => {
  cb(null, true);
};

// Set up multer middleware for different upload types
exports.uploadCompanyLogo = multer({
  storage: logoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 1, // maximum 1 file
  },
  fileFilter: imageFileFilter,
}).single("logo");

exports.uploadCompanyBanner = multer({
  storage: bannerStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1, // maximum 1 file
  },
  fileFilter: imageFileFilter,
}).single("banner");

exports.uploadCompanyLicense = multer({
  storage: licenseStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 1, // maximum 1 file
  },
  fileFilter: imageFileFilter,
}).single("license_img");

exports.uploadCompanyDocument = multer({
  storage: documentStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 1, // maximum 1 file
  },
  fileFilter: imageFileFilter,
}).single("doc_image");

// Error handler for file uploads
exports.handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error:
          "File size is too large. Maximum size is 5MB for most files, 10MB for banners.",
      });
    } else if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: "Too many files. Only one file can be uploaded at a time.",
      });
    } else {
      return res.status(400).json({ error: err.message });
    }
  } else if (err) {
    return res
      .status(400)
      .json({ error: err.message || "Error uploading file" });
  }
  next();
};
