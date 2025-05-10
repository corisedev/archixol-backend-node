const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create storage directory if it doesn't exist
const createStorageDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage for certificate images
const certificateImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/certificates";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `certificate-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure file filter for images
const imageFileFilter = (req, file, cb) => {
  cb(null, true);
};

// Set up multer middleware for certificate uploads
exports.uploadCertificateImage = multer({
  storage: certificateImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 1, // maximum 1 file
  },
  fileFilter: imageFileFilter,
}).single("certificate_img");

// Error handler for file uploads
exports.handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File size is too large. Maximum size is 5MB." });
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
