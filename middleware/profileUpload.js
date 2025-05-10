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
const profileImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/profile/images";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure storage for banner images
const bannerImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/profile/banners";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `banner-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure storage for intro videos
const introVideoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/profile/videos";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `video-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure file filter for images
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb({ message: "Unsupported file format. Only images are allowed." }, false);
  }
};

// Configure file filter for videos
const videoFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-ms-wmv",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      {
        message:
          "Unsupported file format. Only MP4, MPEG, MOV, AVI, and WMV videos are allowed.",
      },
      false
    );
  }
};

// Set up multer middleware for different upload types
exports.uploadProfileImage = multer({
  storage: profileImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 1, // maximum 1 file
  },
  fileFilter: imageFileFilter,
}).single("profile_img");

exports.uploadBannerImage = multer({
  storage: bannerImageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1, // maximum 1 file
  },
  fileFilter: imageFileFilter,
}).single("banner_img");

exports.uploadIntroVideo = multer({
  storage: introVideoStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 1, // maximum 1 file
  },
  fileFilter: videoFileFilter,
}).single("intro_video");

// Error handler for file uploads
exports.handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({
          error:
            "File size is too large. Maximum size is 5MB for profile images, 10MB for banners, and 50MB for videos.",
        });
    } else if (err.code === "LIMIT_FILE_COUNT") {
      return res
        .status(400)
        .json({
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
