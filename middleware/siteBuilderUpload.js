// middleware/siteBuilderUpload.js
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

// Configure storage for site builder images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/site-builder";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname || "site-builder";
    cb(null, `${prefix}-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure file filter for images
const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(
      {
        message: "Unsupported file format. Only images are allowed.",
      },
      false
    );
  }
};

// Set up multer middleware for site builder image uploads
exports.uploadSiteBuilderImages = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 30, // maximum 30 files at once
  },
  fileFilter: fileFilter,
}).fields([
  { name: "banner_images", maxCount: 10 },
  { name: "hero_banners", maxCount: 10 },
  { name: "gallery_images", maxCount: 15 },
  { name: "section_images", maxCount: 15 },
  { name: "imageUrl", maxCount: 10 }, // Handle imageUrl as file uploads
]);

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
        .json({ error: "Too many files. Maximum is 30 files total." });
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

// Process site builder data with uploaded files
exports.processSiteBuilderData = (req, res, next) => {
  try {
    console.log("Processing site builder data...");
    console.log("Files received:", req.files);
    console.log("Body received:", req.body);

    // Store uploaded file paths
    const uploadedFiles = {
      banner_images: [],
      hero_banners: [],
      gallery_images: [],
      section_images: [],
      imageUrl: [], // Handle imageUrl file uploads
    };

    // Process uploaded files and create file paths
    if (req.files) {
      Object.keys(req.files).forEach((fieldName) => {
        if (uploadedFiles[fieldName] !== undefined) {
          uploadedFiles[fieldName] = req.files[fieldName].map((file) => ({
            path: `/uploads/site-builder/${file.filename}`,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
          }));
        }
      });
    }

    // Handle encrypted data if present
    if (req.body && req.body.data) {
      try {
        // Decrypt the data field
        const bytes = CryptoJS.AES.decrypt(
          req.body.data,
          process.env.AES_SECRET_KEY
        );
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

        console.log("Decrypted data:", decryptedData);

        // Parse the decrypted data
        const parsedData = JSON.parse(decryptedData);

        // Replace req.body with the parsed data
        req.body = parsedData;
      } catch (decryptError) {
        console.error("Decryption error:", decryptError);
        // If decryption fails, continue with original body data (no encryption)
      }
    }
    // If no encrypted data field, treat as unencrypted request

    // Process sections and merge with uploaded images
    if (req.body.sections && Array.isArray(req.body.sections)) {
      req.body.sections = req.body.sections.map((section, index) => {
        // Handle banner sections with uploaded imageUrl files
        if (section.type === "banner") {
          // First check for specific imageUrl uploads
          if (uploadedFiles.imageUrl.length > index) {
            const imageUrlFile = uploadedFiles.imageUrl[index];
            if (imageUrlFile) {
              section.imageUrl = imageUrlFile.path;
            }
          }
          // Fallback to banner_images if no specific imageUrl file
          else if (uploadedFiles.banner_images.length > 0) {
            const bannerImage = uploadedFiles.banner_images[0];
            if (bannerImage) {
              section.imageUrl = bannerImage.path;
            }
          }
          // Fallback to section_images
          else if (uploadedFiles.section_images.length > index) {
            const sectionImage = uploadedFiles.section_images[index];
            if (sectionImage) {
              section.imageUrl = sectionImage.path;
            }
          }
        }

        // Handle gallery sections with uploaded images
        if (
          section.type === "gallery" &&
          uploadedFiles.gallery_images.length > 0
        ) {
          section.images = uploadedFiles.gallery_images.map((img) => img.path);
        }

        return section;
      });
    }

    // Process hero banners with uploaded images
    if (req.body.hero_banners && Array.isArray(req.body.hero_banners)) {
      req.body.hero_banners = req.body.hero_banners.map((banner, index) => {
        // Check if there's an uploaded hero banner image for this index
        if (uploadedFiles.hero_banners.length > index) {
          const heroBannerImage = uploadedFiles.hero_banners[index];
          if (heroBannerImage) {
            banner.path = heroBannerImage.path;
            banner.relativePath = heroBannerImage.path;
            banner.image_path = heroBannerImage.path;
          }
        }

        // Clean up path format if it exists
        if (banner.path && !banner.path.startsWith("/uploads/")) {
          // Handle relative paths like "./filename.jpg"
          const cleanPath = banner.path.replace("./", "");
          banner.path = `/uploads/site-builder/${cleanPath}`;
        }

        return banner;
      });
    }

    // Add uploaded files info to request for reference
    req.uploadedFiles = uploadedFiles;

    console.log("Final processed body:", JSON.stringify(req.body, null, 2));
    console.log("Uploaded files summary:", uploadedFiles);

    next();
  } catch (error) {
    console.error("Processing error:", error);

    // Delete uploaded files if there was an error
    if (req.files) {
      Object.keys(req.files).forEach((fieldName) => {
        req.files[fieldName].forEach((file) => {
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
};
