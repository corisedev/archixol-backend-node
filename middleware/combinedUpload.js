// middleware/combinedUpload.js
const CryptoJS = require("crypto-js");
const { uploadServiceImages } = require("./fileUpload");

// Handle file uploads and decrypt data in a single middleware chain
exports.handleServiceUpload = [
  // First handle the file uploads
  uploadServiceImages,

  // Then decrypt the data field
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

        // Add back the service_images_urls that weren't part of the encrypted data
        if (service_images_urls.length > 0) {
          req.body.service_images_urls = service_images_urls;
        }

        // Add newly uploaded images
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
