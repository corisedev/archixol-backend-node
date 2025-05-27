// middleware/combinedUpload.js
const CryptoJS = require("crypto-js");
const { uploadServiceImages } = require("./fileUpload");

// Handle file uploads and decrypt data in a single middleware chain
exports.handleServiceUpload = [
  // First handle the file uploads
  uploadServiceImages,

  // Then decrypt the data field and process images
  (req, res, next) => {
    try {
      console.log("Request after file upload:", req.body);
      console.log("Files received:", req.files);

      // Store service_images_urls separately before decryption since it's outside encrypted data
      let service_images_urls = [];
      if (req.body.service_images_urls) {
        if (Array.isArray(req.body.service_images_urls)) {
          service_images_urls = [...req.body.service_images_urls];
        } else {
          service_images_urls = [req.body.service_images_urls];
        }
      }

      // Store service_images separately before decryption (for creation)
      let service_images = [];
      if (req.body.service_images) {
        if (Array.isArray(req.body.service_images)) {
          service_images = [...req.body.service_images];
        } else {
          service_images = [req.body.service_images];
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

        // Add file paths from successfully uploaded files
        let newUploadedImages = [];
        if (req.files && req.files.length > 0) {
          newUploadedImages = req.files.map(
            (file) => `/uploads/services/${file.filename}`
          );
        }

        // Replace req.body with the decrypted data
        req.body = parsedData;

        // Handle service images based on the scenario:

        // 1. For service creation: combine existing service_images with new uploads
        if (service_images.length > 0) {
          req.body.service_images = [...service_images, ...newUploadedImages];
          console.log(
            "Service creation - combined service_images:",
            req.body.service_images
          );
        }
        // 2. For service updates: combine service_images_urls with new uploads
        else if (service_images_urls.length > 0) {
          req.body.service_images_urls = service_images_urls;
          // Add newly uploaded images to service_images array
          if (newUploadedImages.length > 0) {
            req.body.service_images = [
              ...(req.body.service_images || []),
              ...newUploadedImages,
            ];
          }
          console.log(
            "Service update - service_images_urls:",
            req.body.service_images_urls
          );
          console.log(
            "Service update - new service_images:",
            req.body.service_images
          );
        }
        // 3. If only new files are uploaded (no existing images)
        else if (newUploadedImages.length > 0) {
          req.body.service_images = newUploadedImages;
          console.log(
            "Only new uploads - service_images:",
            req.body.service_images
          );
        }

        // Also preserve any existing service_images from the decrypted data
        if (
          parsedData.service_images &&
          Array.isArray(parsedData.service_images)
        ) {
          req.body.service_images = [
            ...(parsedData.service_images || []),
            ...(req.body.service_images || []),
          ];
          // Remove duplicates
          req.body.service_images = [...new Set(req.body.service_images)];
        }

        // Add information about new uploads for controller use
        if (newUploadedImages.length > 0) {
          req.body.new_uploaded_images = newUploadedImages;
        }
      }

      console.log("Final request body:", req.body);
      next();
    } catch (error) {
      console.error("Processing error:", error);
      return res
        .status(400)
        .json({ error: "Failed to process request: " + error.message });
    }
  },
];
