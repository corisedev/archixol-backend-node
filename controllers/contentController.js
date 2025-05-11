// controllers/contentController.js
const Product = require("../models/Product");
const Collection = require("../models/Collection");
const { encryptData } = require("../utils/encryptResponse");
const fs = require("fs");
const path = require("path");

// @desc    Get all uploaded files
// @route   GET /supplier/get_files
// @access  Private (Supplier Only)
exports.getFiles = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all products with media for this supplier
    const products = await Product.find({
      supplier_id: userId,
      status: { $ne: "archived" },
      "media.0": { $exists: true }, // Only get products with at least one media item
    }).select("_id title media");

    // Get all collections with images for this supplier
    const collections = await Collection.find({
      supplier_id: userId,
      status: { $ne: "archived" },
      "collection_images.0": { $exists: true }, // Only get collections with at least one image
    }).select("_id title collection_images");

    const baseUrl = process.env.BASE_URL || "http://localhost:5000";
    const uploadPath = "/uploads";

    // Format product images
    const productImages = products
      .map((product) => {
        const images = product.media.map((media) => {
          // Extract file information
          const filePath = media.replace(uploadPath, "").split("/");
          const fileName = filePath[filePath.length - 1];
          const fileStats = getFileStats(path.join(__dirname, "..", media));

          return {
            file_name: fileName,
            full_name: `user_${userId}/${fileName}`,
            size: fileStats ? (fileStats.size / (1024 * 1024)).toFixed(2) : 0, // Size in MB
            date: fileStats
              ? new Date(fileStats.mtime).toISOString()
              : new Date().toISOString(),
            reference: `${baseUrl}${media}`,
            extension: path.extname(fileName),
            preview: `${baseUrl}${media}`,
          };
        });

        return {
          parent_id: product._id,
          parent_type: "product",
          title: product.title,
          images,
        };
      })
      .filter((item) => item.images.length > 0);

    // Format collection images
    const collectionImages = collections
      .map((collection) => {
        const images = collection.collection_images.map((image) => {
          // Extract file information
          const filePath = image.replace(uploadPath, "").split("/");
          const fileName = filePath[filePath.length - 1];
          const fileStats = getFileStats(path.join(__dirname, "..", image));

          return {
            file_name: fileName,
            full_name: `user_${userId}/${fileName}`,
            size: fileStats ? (fileStats.size / (1024 * 1024)).toFixed(2) : 0, // Size in MB
            date: fileStats
              ? new Date(fileStats.mtime).toISOString()
              : new Date().toISOString(),
            reference: `${baseUrl}${image}`,
            extension: path.extname(fileName),
            preview: `${baseUrl}${image}`,
          };
        });

        return {
          parent_id: collection._id,
          parent_type: "collection",
          title: collection.title,
          images,
        };
      })
      .filter((item) => item.images.length > 0);

    // Combine and format all images
    const allImages = [...productImages, ...collectionImages];

    const responseData = {
      message: "Content loaded successfully",
      images: allImages,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete files
// @route   POST /supplier/delete_file
// @access  Private (Supplier Only)
exports.deleteFiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "No files selected for deletion" });
    }

    const results = {
      success: [],
      failed: [],
    };

    // Process each file for deletion
    for (const file of data) {
      const { parent_id, parent_type, file_name, full_name } = file;

      if (!parent_id || !parent_type || !file_name) {
        results.failed.push({
          file_name,
          reason: "Missing required information",
        });
        continue;
      }

      try {
        // Handle different parent types
        if (parent_type === "product") {
          // Find the product
          const product = await Product.findOne({
            _id: parent_id,
            supplier_id: userId,
          });

          if (!product) {
            results.failed.push({ file_name, reason: "Product not found" });
            continue;
          }

          // Find the file path in media array
          const mediaIndex = product.media.findIndex((m) =>
            m.includes(file_name)
          );
          if (mediaIndex === -1) {
            results.failed.push({
              file_name,
              reason: "File not found in product media",
            });
            continue;
          }

          // Get the file path to delete from filesystem
          const filePath = product.media[mediaIndex];

          // Remove from media array
          product.media.splice(mediaIndex, 1);
          await product.save();

          // Delete file from filesystem
          try {
            fs.unlinkSync(path.join(__dirname, "..", filePath));
            results.success.push({ file_name });
          } catch (unlinkErr) {
            console.error("Error deleting file:", unlinkErr);
            results.failed.push({
              file_name,
              reason: "Error deleting file from storage",
            });
          }
        } else if (parent_type === "collection") {
          // Find the collection
          const collection = await Collection.findOne({
            _id: parent_id,
            supplier_id: userId,
          });

          if (!collection) {
            results.failed.push({ file_name, reason: "Collection not found" });
            continue;
          }

          // Find the file path in collection_images array
          const imageIndex = collection.collection_images.findIndex((img) =>
            img.includes(file_name)
          );
          if (imageIndex === -1) {
            results.failed.push({
              file_name,
              reason: "File not found in collection images",
            });
            continue;
          }

          // Get the file path to delete from filesystem
          const filePath = collection.collection_images[imageIndex];

          // Remove from collection_images array
          collection.collection_images.splice(imageIndex, 1);
          await collection.save();

          // Delete file from filesystem
          try {
            fs.unlinkSync(path.join(__dirname, "..", filePath));
            results.success.push({ file_name });
          } catch (unlinkErr) {
            console.error("Error deleting file:", unlinkErr);
            results.failed.push({
              file_name,
              reason: "Error deleting file from storage",
            });
          }
        } else {
          results.failed.push({ file_name, reason: "Unsupported parent type" });
        }
      } catch (error) {
        console.error("Error processing file:", error);
        results.failed.push({
          file_name,
          reason: "Server error while processing",
        });
      }
    }

    // Construct response message
    let message = "";
    if (results.success.length > 0 && results.failed.length === 0) {
      message = "All files deleted successfully";
    } else if (results.success.length > 0 && results.failed.length > 0) {
      message = `${results.success.length} files deleted successfully, ${results.failed.length} files failed`;
    } else if (results.success.length === 0 && results.failed.length > 0) {
      message = "Failed to delete any files";
    }

    const responseData = {
      message,
      results,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Helper function to get file stats safely
function getFileStats(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.statSync(filePath);
    }
    return null;
  } catch (error) {
    console.error("Error getting file stats:", error);
    return null;
  }
}
