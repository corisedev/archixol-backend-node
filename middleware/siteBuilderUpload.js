// middleware/siteBuilderUpload.js - UPDATED FOR NEW FORMDATA STRUCTURE
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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
    const prefix = file.fieldname.replace(/\[|\]/g, "") || "site-builder"; // Clean field name
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
    files: 50, // Handle many files
  },
  fileFilter: fileFilter,
}).any(); // Use .any() to handle dynamic field names

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
        .json({ error: "Too many files. Maximum is 50 files total." });
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

// Process site builder data with uploaded files - UPDATED FOR NEW STRUCTURE
exports.processSiteBuilderData = (req, res, next) => {
  try {
    console.log("=== PROCESSING SITE BUILDER DATA (NEW STRUCTURE) ===");
    console.log("Files received:", req.files?.length || 0);
    console.log("Body received keys:", Object.keys(req.body));

    // Step 1: Organize uploaded files by type
    const uploadedFiles = {
      hero_banners: {},
      section_images: {},
    };

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        console.log(`Processing file: ${file.fieldname} -> ${file.filename}`);

        // Hero banner files: hero_banners[0], hero_banners[1], etc.
        if (file.fieldname.startsWith("hero_banners[")) {
          const index = file.fieldname.match(/\[(\d+)\]/)?.[1];
          if (index !== undefined) {
            uploadedFiles.hero_banners[
              index
            ] = `/uploads/site-builder/${file.filename}`;
            console.log(`Mapped hero banner ${index}: ${file.filename}`);
          }
        }

        // Section images: sections[0][image], sections[1][image], etc.
        else if (file.fieldname.includes("[image]")) {
          const index = file.fieldname.match(/sections\[(\d+)\]/)?.[1];
          if (index !== undefined) {
            uploadedFiles.section_images[
              index
            ] = `/uploads/site-builder/${file.filename}`;
            console.log(`Mapped section ${index} image: ${file.filename}`);
          }
        }
      });
    }

    // Step 2: Parse form data into structured objects
    const parsedData = {
      sections: [],
      hero_banners: [],
      hot_products: [],
      about_us: req.body.about_us || "",
    };

    // Step 3: Process sections from form data
    const sectionIndices = new Set();

    // Find all section indices
    Object.keys(req.body).forEach((key) => {
      const match = key.match(/^sections\[(\d+)\]/);
      if (match) {
        sectionIndices.add(parseInt(match[1]));
      }
    });

    // Build sections array
    Array.from(sectionIndices)
      .sort()
      .forEach((index) => {
        const section = {
          type: req.body[`sections[${index}][type]`] || "",
        };

        // Add type-specific fields
        if (section.type === "banner") {
          // Check if there's an uploaded image for this section
          if (uploadedFiles.section_images[index]) {
            section.imageUrl = uploadedFiles.section_images[index];
            console.log(
              `Added imageUrl to section ${index}: ${section.imageUrl}`
            );
          }
        } else if (section.type === "collection") {
          section.collection_id =
            req.body[`sections[${index}][collection_id]`] || "";
        } else if (section.type === "text") {
          section.title = req.body[`sections[${index}][title]`] || "";
          section.content = req.body[`sections[${index}][content]`] || "";
        }

        parsedData.sections.push(section);
      });

    // Step 4: Process hero banners
    // Find hero banner indices from uploaded files and form data
    const heroBannerIndices = new Set();

    // Add indices from uploaded files
    Object.keys(uploadedFiles.hero_banners).forEach((index) => {
      heroBannerIndices.add(parseInt(index));
    });

    // Add indices from form data (in case there are hero banners without files)
    Object.keys(req.body).forEach((key) => {
      const match = key.match(/^hero_banners\[(\d+)\]/);
      if (match) {
        heroBannerIndices.add(parseInt(match[1]));
      }
    });

    // Build hero banners array
    Array.from(heroBannerIndices)
      .sort()
      .forEach((index) => {
        const banner = {
          title: req.body[`hero_banners[${index}][title]`] || "",
          subtitle: req.body[`hero_banners[${index}][subtitle]`] || "",
          button_text: req.body[`hero_banners[${index}][button_text]`] || "",
          button_link: req.body[`hero_banners[${index}][button_link]`] || "",
        };

        // Add uploaded image path if available
        if (uploadedFiles.hero_banners[index]) {
          banner.image_path = uploadedFiles.hero_banners[index];
          banner.path = uploadedFiles.hero_banners[index];
          console.log(
            `Added image_path to hero banner ${index}: ${banner.image_path}`
          );
        }

        parsedData.hero_banners.push(banner);
      });

    // Step 5: Process hot products (JSON string)
    if (req.body.hot_products) {
      try {
        parsedData.hot_products = JSON.parse(req.body.hot_products);
      } catch (parseError) {
        console.error("Error parsing hot_products JSON:", parseError);
        parsedData.hot_products = [];
      }
    }

    // Step 6: Add other fields if present
    if (req.body.theme) {
      try {
        parsedData.theme = JSON.parse(req.body.theme);
      } catch (parseError) {
        console.log("Theme parsing failed, keeping as string");
        parsedData.theme = req.body.theme;
      }
    }

    if (req.body.seo) {
      try {
        parsedData.seo = JSON.parse(req.body.seo);
      } catch (parseError) {
        parsedData.seo = req.body.seo;
      }
    }

    if (req.body.social_links) {
      try {
        parsedData.social_links = JSON.parse(req.body.social_links);
      } catch (parseError) {
        parsedData.social_links = req.body.social_links;
      }
    }

    if (req.body.is_published !== undefined) {
      parsedData.is_published = req.body.is_published === "true";
    }

    // Step 7: Set the processed data
    req.body = parsedData;

    // Step 8: Add uploaded files info to request for reference
    req.uploadedFiles = uploadedFiles;

    console.log("=== PROCESSING COMPLETE ===");
    console.log("Final hero_banners count:", parsedData.hero_banners.length);
    console.log("Final sections count:", parsedData.sections.length);
    console.log(
      "Hero banners with images:",
      parsedData.hero_banners.filter((b) => b.image_path).length
    );
    console.log(
      "Sections with images:",
      parsedData.sections.filter((s) => s.imageUrl).length
    );
    console.log("Hot products count:", parsedData.hot_products.length);

    next();
  } catch (error) {
    console.error("=== PROCESSING ERROR ===");
    console.error("Error details:", error);

    // Delete uploaded files if there was an error
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        try {
          fs.unlinkSync(file.path);
          console.log("Deleted file due to error:", file.path);
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
