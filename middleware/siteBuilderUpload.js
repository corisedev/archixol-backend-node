// middleware/siteBuilderUpload.js - FINAL FIXED VERSION
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
    const prefix =
      file.fieldname.replace(/\[|\]/g, "").replace(/\d+/g, "") ||
      "site-builder";
    cb(null, `${prefix}-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure file filter for images
const fileFilter = (req, file, cb) => {
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

// Process site builder data with uploaded files - FINAL FIXED VERSION
exports.processSiteBuilderData = (req, res, next) => {
  try {
    console.log("=== PROCESSING SITE BUILDER DATA (FINAL FIXED) ===");
    console.log("Files received:", req.files?.length || 0);
    console.log("Body received keys:", Object.keys(req.body));
    console.log("Raw body:", JSON.stringify(req.body, null, 2));

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
          const match = file.fieldname.match(/hero_banners\[(\d+)\]/);
          if (match) {
            const index = match[1];
            uploadedFiles.hero_banners[
              index
            ] = `/uploads/site-builder/${file.filename}`;
            console.log(`Mapped hero banner ${index}: ${file.filename}`);
          }
        }

        // Section images: sections[0][image], sections[1][image], etc.
        else if (
          file.fieldname.includes("sections[") &&
          file.fieldname.includes("[image]")
        ) {
          const match = file.fieldname.match(/sections\[(\d+)\]\[image\]/);
          if (match) {
            const index = match[1];
            uploadedFiles.section_images[
              index
            ] = `/uploads/site-builder/${file.filename}`;
            console.log(`Mapped section ${index} image: ${file.filename}`);
          }
        }
      });
    }

    // Step 2: Initialize parsed data structure
    const parsedData = {
      sections: [],
      hero_banners: [],
      hot_products: [],
      about_us: req.body.about_us || "",
    };

    // Step 3: Process sections - Handle both FormData keys and already parsed arrays
    if (req.body.sections) {
      console.log("Processing sections from parsed array...");

      // If sections is already an array (from multipart/form-data with JSON parsing)
      if (Array.isArray(req.body.sections)) {
        console.log("Sections is already an array, processing directly...");

        req.body.sections.forEach((section, index) => {
          if (!section.type) {
            console.warn(`Section ${index} missing type, skipping`);
            return;
          }

          console.log(`Processing section ${index}:`, section);

          const processedSection = {
            type: section.type,
            position: index,
          };

          // Handle different section types
          switch (section.type) {
            case "banner":
              // Add uploaded image if exists
              if (uploadedFiles.section_images[index]) {
                processedSection.imageUrl = uploadedFiles.section_images[index];
                console.log(
                  `Added imageUrl to banner section ${index}: ${processedSection.imageUrl}`
                );
              }

              // Add title and content if provided
              if (section.title) {
                processedSection.title = section.title;
              }
              if (section.content) {
                processedSection.content = section.content;
              }
              break;

            case "collection":
              if (section.collection_id) {
                processedSection.collection_id = section.collection_id;
                console.log(
                  `Added collection_id to section ${index}: ${section.collection_id}`
                );
              } else {
                console.warn(
                  `Collection section ${index} missing collection_id`
                );
              }
              break;

            case "products":
              if (section.product_ids && Array.isArray(section.product_ids)) {
                processedSection.product_ids = section.product_ids;
                console.log(
                  `Added product_ids to section ${index}:`,
                  section.product_ids
                );
              }
              break;

            case "text":
              processedSection.title = section.title || "";
              processedSection.content = section.content || "";
              console.log(`Added text content to section ${index}`);
              break;

            case "gallery":
              processedSection.images = section.images || [];

              // Add uploaded image if exists
              if (uploadedFiles.section_images[index]) {
                processedSection.images.push(
                  uploadedFiles.section_images[index]
                );
              }
              break;

            default:
              console.warn(`Unknown section type: ${section.type}`);
          }

          // Add styling if provided
          if (section.styling) {
            processedSection.styling = section.styling;
          }

          parsedData.sections.push(processedSection);
          console.log(
            `Successfully added section ${index}:`,
            JSON.stringify(processedSection, null, 2)
          );
        });
      }
      // If sections is a JSON string, parse it
      else if (typeof req.body.sections === "string") {
        try {
          const sectionsArray = JSON.parse(req.body.sections);
          req.body.sections = sectionsArray;
          // Process recursively with the parsed array
          return exports.processSiteBuilderData(req, res, next);
        } catch (e) {
          console.error("Error parsing sections JSON string:", e);
        }
      }
    } else {
      // Fallback: Look for FormData-style section keys
      console.log("Looking for FormData-style section keys...");
      const sectionIndices = new Set();

      Object.keys(req.body).forEach((key) => {
        const match = key.match(/^sections\[(\d+)\]/);
        if (match) {
          const index = parseInt(match[1]);
          sectionIndices.add(index);
          console.log(`Found section index: ${index} from key: ${key}`);
        }
      });

      if (sectionIndices.size > 0) {
        console.log("Processing FormData-style sections...");

        Array.from(sectionIndices)
          .sort((a, b) => a - b)
          .forEach((index) => {
            const typeKey = `sections[${index}][type]`;
            const sectionType = req.body[typeKey];

            if (!sectionType) {
              console.warn(`No type found for section ${index}`);
              return;
            }

            const section = {
              type: sectionType,
              position: index,
            };

            // Process based on type (same logic as above)
            switch (sectionType) {
              case "banner":
                if (uploadedFiles.section_images[index]) {
                  section.imageUrl = uploadedFiles.section_images[index];
                }
                if (req.body[`sections[${index}][title]`]) {
                  section.title = req.body[`sections[${index}][title]`];
                }
                if (req.body[`sections[${index}][content]`]) {
                  section.content = req.body[`sections[${index}][content]`];
                }
                break;

              case "collection":
                const collectionId =
                  req.body[`sections[${index}][collection_id]`];
                if (collectionId) {
                  section.collection_id = collectionId;
                }
                break;

              case "products":
                const productIds = req.body[`sections[${index}][product_ids]`];
                if (productIds) {
                  try {
                    section.product_ids =
                      typeof productIds === "string"
                        ? JSON.parse(productIds)
                        : productIds;
                  } catch (e) {
                    section.product_ids = Array.isArray(productIds)
                      ? productIds
                      : [productIds];
                  }
                }
                break;

              case "text":
                section.title = req.body[`sections[${index}][title]`] || "";
                section.content = req.body[`sections[${index}][content]`] || "";
                break;

              case "gallery":
                section.images = [];
                const galleryImages = req.body[`sections[${index}][images]`];
                if (galleryImages) {
                  try {
                    section.images =
                      typeof galleryImages === "string"
                        ? JSON.parse(galleryImages)
                        : galleryImages;
                  } catch (e) {
                    section.images = Array.isArray(galleryImages)
                      ? galleryImages
                      : [galleryImages];
                  }
                }
                if (uploadedFiles.section_images[index]) {
                  section.images.push(uploadedFiles.section_images[index]);
                }
                break;
            }

            parsedData.sections.push(section);
          });
      }
    }

    // Step 4: Process hero banners
    const heroBannerIndices = new Set();

    // Find hero banner indices from uploaded files
    Object.keys(uploadedFiles.hero_banners).forEach((index) => {
      heroBannerIndices.add(parseInt(index));
    });

    // Find hero banner indices from form data
    Object.keys(req.body).forEach((key) => {
      const match = key.match(/^hero_banners\[(\d+)\]/);
      if (match) {
        heroBannerIndices.add(parseInt(match[1]));
      }
    });

    console.log(
      "Found hero banner indices:",
      Array.from(heroBannerIndices).sort()
    );

    // Process each hero banner
    Array.from(heroBannerIndices)
      .sort((a, b) => a - b)
      .forEach((index) => {
        const banner = {
          title: req.body[`hero_banners[${index}][title]`] || "",
          subtitle: req.body[`hero_banners[${index}][subtitle]`] || "",
          button_text: req.body[`hero_banners[${index}][button_text]`] || "",
          button_link: req.body[`hero_banners[${index}][button_link]`] || "",
          position: index,
        };

        // Add uploaded image path if available
        if (uploadedFiles.hero_banners[index]) {
          banner.image_path = uploadedFiles.hero_banners[index];
          banner.path = uploadedFiles.hero_banners[index]; // For compatibility
          console.log(
            `Added image_path to hero banner ${index}: ${banner.image_path}`
          );
        }

        parsedData.hero_banners.push(banner);
        console.log(`Added hero banner ${index}:`, banner);
      });

    // Step 5: Process hot products (JSON string or array)
    if (req.body.hot_products) {
      try {
        parsedData.hot_products =
          typeof req.body.hot_products === "string"
            ? JSON.parse(req.body.hot_products)
            : req.body.hot_products;
        console.log(
          "Processed hot products count:",
          parsedData.hot_products.length
        );
      } catch (parseError) {
        console.error("Error parsing hot_products:", parseError);
        parsedData.hot_products = [];
      }
    }

    // Step 6: Process other fields
    ["theme", "seo", "social_links"].forEach((field) => {
      if (req.body[field]) {
        try {
          parsedData[field] =
            typeof req.body[field] === "string"
              ? JSON.parse(req.body[field])
              : req.body[field];
        } catch (parseError) {
          console.log(`${field} parsing failed, keeping as string`);
          parsedData[field] = req.body[field];
        }
      }
    });

    if (req.body.is_published !== undefined) {
      parsedData.is_published =
        req.body.is_published === "true" || req.body.is_published === true;
    }

    // Step 7: Set the processed data
    req.body = parsedData;
    req.uploadedFiles = uploadedFiles;

    console.log("=== PROCESSING COMPLETE ===");
    console.log("Final sections count:", parsedData.sections.length);
    console.log("Final hero_banners count:", parsedData.hero_banners.length);
    console.log("Final hot_products count:", parsedData.hot_products.length);
    console.log(
      "Final sections structure:",
      JSON.stringify(parsedData.sections, null, 2)
    );

    next();
  } catch (error) {
    console.error("=== PROCESSING ERROR ===");
    console.error("Error details:", error);
    console.error("Error stack:", error.stack);

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
