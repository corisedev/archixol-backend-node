// controllers/adminContentController.js
const User = require("../models/User");
const UserProfile = require("../models/UserProfile");
const Company = require("../models/Company");
const CompanyDocument = require("../models/CompanyDocument");
const Certificate = require("../models/Certificate");
const Project = require("../models/Project");
const Service = require("../models/Service");
const Product = require("../models/Product");
const Collection = require("../models/Collection");
const SupplierSiteBuilder = require("../models/SupplierSiteBuilder");
const ClientProfile = require("../models/ClientProfile");
const { StoreDetails } = require("../models/SupplierSettings");
const { encryptData } = require("../utils/encryptResponse");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// @desc    Get all media content overview
// @route   GET /admin/content/overview
// @access  Private (Admin Only)
exports.getContentOverview = async (req, res) => {
  try {
    console.log("Fetching content overview...");

    // Count different types of media
    const profileImages = await UserProfile.countDocuments({
      profile_img: { $ne: "" },
    });

    const bannerImages = await UserProfile.countDocuments({
      banner_img: { $ne: "" },
    });

    const introVideos = await UserProfile.countDocuments({
      intro_video: { $ne: "" },
    });

    const certificates = await Certificate.countDocuments();

    const companyDocuments = await CompanyDocument.countDocuments();

    const projectImages = await Project.aggregate([
      { $match: { project_imgs: { $exists: true, $ne: [] } } },
      { $project: { imageCount: { $size: "$project_imgs" } } },
      { $group: { _id: null, total: { $sum: "$imageCount" } } },
    ]);

    const serviceImages = await Service.aggregate([
      { $match: { service_images: { $exists: true, $ne: [] } } },
      { $project: { imageCount: { $size: "$service_images" } } },
      { $group: { _id: null, total: { $sum: "$imageCount" } } },
    ]);

    const productImages = await Product.aggregate([
      { $match: { media: { $exists: true, $ne: [] } } },
      { $project: { imageCount: { $size: "$media" } } },
      { $group: { _id: null, total: { $sum: "$imageCount" } } },
    ]);

    const collectionImages = await Collection.aggregate([
      { $match: { collection_images: { $exists: true, $ne: [] } } },
      { $project: { imageCount: { $size: "$collection_images" } } },
      { $group: { _id: null, total: { $sum: "$imageCount" } } },
    ]);

    const siteBuilderImages = await SupplierSiteBuilder.aggregate([
      {
        $project: {
          totalImages: {
            $add: [
              { $size: { $ifNull: ["$hero_banners", []] } },
              {
                $sum: {
                  $map: {
                    input: { $ifNull: ["$sections", []] },
                    as: "section",
                    in: {
                      $cond: [
                        { $eq: ["$$section.type", "banner"] },
                        1,
                        { $size: { $ifNull: ["$$section.images", []] } },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalImages" } } },
    ]);

    // Storage usage calculation
    const uploadDir = path.join(__dirname, "../uploads");
    let totalStorageSize = 0;
    const storageByCategory = {};

    if (fs.existsSync(uploadDir)) {
      const categories = fs.readdirSync(uploadDir);

      for (const category of categories) {
        const categoryPath = path.join(uploadDir, category);
        if (fs.statSync(categoryPath).isDirectory()) {
          let categorySize = 0;
          const files = getAllFiles(categoryPath);

          files.forEach((file) => {
            try {
              const stats = fs.statSync(file);
              categorySize += stats.size;
            } catch (error) {
              console.error(`Error reading file ${file}:`, error);
            }
          });

          storageByCategory[category] = {
            size: categorySize,
            sizeFormatted: formatBytes(categorySize),
            fileCount: files.length,
          };
          totalStorageSize += categorySize;
        }
      }
    }

    const overview = {
      total_media_items: {
        profile_images: profileImages,
        banner_images: bannerImages,
        intro_videos: introVideos,
        certificates: certificates,
        company_documents: companyDocuments,
        project_images: projectImages.length > 0 ? projectImages[0].total : 0,
        service_images: serviceImages.length > 0 ? serviceImages[0].total : 0,
        product_images: productImages.length > 0 ? productImages[0].total : 0,
        collection_images:
          collectionImages.length > 0 ? collectionImages[0].total : 0,
        site_builder_images:
          siteBuilderImages.length > 0 ? siteBuilderImages[0].total : 0,
      },
      storage_usage: {
        total_size: totalStorageSize,
        total_size_formatted: formatBytes(totalStorageSize),
        by_category: storageByCategory,
      },
      recent_uploads: await getRecentUploads(),
    };

    const responseData = {
      message: "Content overview retrieved successfully",
      overview,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get content overview error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get profile images
// @route   GET /admin/content/profile-images
// @access  Private (Admin Only)
exports.getProfileImages = async (req, res) => {
  try {
    const { page = 1, limit = 20, user_type } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    let matchQuery = { profile_img: { $ne: "" } };

    const profiles = await UserProfile.find(matchQuery)
      .populate({
        path: "user_id",
        select: "username email user_type createdAt isEmailVerified",
        match: user_type ? { user_type } : {},
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ updatedAt: -1 })
      .lean();

    // Filter out profiles where user was not found (due to user_type filter)
    const filteredProfiles = profiles.filter((profile) => profile.user_id);

    // Get file details for each image
    const profilesWithDetails = filteredProfiles.map((profile) => {
      const imagePath = path.join(__dirname, "..", profile.profile_img);
      let fileSize = 0;
      let fileStats = null;

      try {
        if (fs.existsSync(imagePath)) {
          fileStats = fs.statSync(imagePath);
          fileSize = fileStats.size;
        }
      } catch (error) {
        console.error(`Error reading file ${imagePath}:`, error);
      }

      return {
        id: profile._id,
        user: {
          id: profile.user_id._id,
          username: profile.user_id.username,
          email: profile.user_id.email,
          user_type: profile.user_id.user_type,
          is_verified: profile.user_id.isEmailVerified,
          created_at: profile.user_id.createdAt,
        },
        image_url: profile.profile_img,
        file_size: fileSize,
        file_size_formatted: formatBytes(fileSize),
        uploaded_at: profile.updatedAt,
        file_exists: fileStats !== null,
        file_extension: path.extname(profile.profile_img),
      };
    });

    const total = await UserProfile.countDocuments(matchQuery);

    const responseData = {
      message: "Profile images retrieved successfully",
      profile_images: profilesWithDetails,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total,
        per_page: parseInt(limit),
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get profile images error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get service images
// @route   GET /admin/content/service-images
// @access  Private (Admin Only)
exports.getServiceImages = async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const skip = (page - 1) * limit;

    let matchQuery = { service_images: { $exists: true, $ne: [] } };
    if (category) {
      matchQuery.service_category = new RegExp(category, "i");
    }

    const services = await Service.find(matchQuery)
      .populate({
        path: "user",
        select: "username email user_type createdAt",
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ updatedAt: -1 })
      .lean();

    const servicesWithDetails = [];

    services.forEach((service) => {
      service.service_images.forEach((imageUrl, index) => {
        const imagePath = path.join(__dirname, "..", imageUrl);
        let fileSize = 0;
        let fileStats = null;

        try {
          if (fs.existsSync(imagePath)) {
            fileStats = fs.statSync(imagePath);
            fileSize = fileStats.size;
          }
        } catch (error) {
          console.error(`Error reading file ${imagePath}:`, error);
        }

        servicesWithDetails.push({
          id: `${service._id}_${index}`,
          service: {
            id: service._id,
            title: service.service_title,
            category: service.service_category,
            status: service.service_status,
            created_at: service.createdAt,
          },
          user: service.user
            ? {
                id: service.user._id,
                username: service.user.username,
                email: service.user.email,
                user_type: service.user.user_type,
              }
            : null,
          image_url: imageUrl,
          image_index: index,
          file_size: fileSize,
          file_size_formatted: formatBytes(fileSize),
          uploaded_at: service.updatedAt,
          file_exists: fileStats !== null,
          file_extension: path.extname(imageUrl),
        });
      });
    });

    const total = await Service.countDocuments(matchQuery);

    const responseData = {
      message: "Service images retrieved successfully",
      service_images: servicesWithDetails,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total,
        per_page: parseInt(limit),
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get service images error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get product images
// @route   GET /admin/content/product-images
// @access  Private (Admin Only)
exports.getProductImages = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, status } = req.query;
    const skip = (page - 1) * limit;

    let matchQuery = { media: { $exists: true, $ne: [] } };
    if (category) {
      matchQuery.category = new RegExp(category, "i");
    }
    if (status) {
      matchQuery.status = status;
    }

    const products = await Product.find(matchQuery)
      .populate({
        path: "supplier_id",
        select: "username email user_type createdAt",
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ updatedAt: -1 })
      .lean();

    const productsWithDetails = [];

    products.forEach((product) => {
      product.media.forEach((imageUrl, index) => {
        const imagePath = path.join(__dirname, "..", imageUrl);
        let fileSize = 0;
        let fileStats = null;

        try {
          if (fs.existsSync(imagePath)) {
            fileStats = fs.statSync(imagePath);
            fileSize = fileStats.size;
          }
        } catch (error) {
          console.error(`Error reading file ${imagePath}:`, error);
        }

        productsWithDetails.push({
          id: `${product._id}_${index}`,
          product: {
            id: product._id,
            title: product.title,
            category: product.category,
            status: product.status,
            price: product.price,
            created_at: product.createdAt,
          },
          supplier: product.supplier_id
            ? {
                id: product.supplier_id._id,
                username: product.supplier_id.username,
                email: product.supplier_id.email,
                user_type: product.supplier_id.user_type,
              }
            : null,
          image_url: imageUrl,
          image_index: index,
          file_size: fileSize,
          file_size_formatted: formatBytes(fileSize),
          uploaded_at: product.updatedAt,
          file_exists: fileStats !== null,
          file_extension: path.extname(imageUrl),
        });
      });
    });

    const total = await Product.countDocuments(matchQuery);

    const responseData = {
      message: "Product images retrieved successfully",
      product_images: productsWithDetails,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total,
        per_page: parseInt(limit),
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get product images error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get certificates
// @route   GET /admin/content/certificates
// @access  Private (Admin Only)
exports.getCertificates = async (req, res) => {
  try {
    const { page = 1, limit = 20, user_type } = req.query;
    const skip = (page - 1) * limit;

    const certificates = await Certificate.find()
      .populate({
        path: "user_id",
        select: "username email user_type createdAt",
        match: user_type ? { user_type } : {},
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();

    // Filter out certificates where user was not found
    const filteredCertificates = certificates.filter((cert) => cert.user_id);

    const certificatesWithDetails = filteredCertificates.map((certificate) => {
      const imagePath = path.join(__dirname, "..", certificate.certificate_img);
      let fileSize = 0;
      let fileStats = null;

      try {
        if (fs.existsSync(imagePath)) {
          fileStats = fs.statSync(imagePath);
          fileSize = fileStats.size;
        }
      } catch (error) {
        console.error(`Error reading file ${imagePath}:`, error);
      }

      return {
        id: certificate._id,
        title: certificate.title,
        dated: certificate.dated,
        user: {
          id: certificate.user_id._id,
          username: certificate.user_id.username,
          email: certificate.user_id.email,
          user_type: certificate.user_id.user_type,
        },
        image_url: certificate.certificate_img,
        file_size: fileSize,
        file_size_formatted: formatBytes(fileSize),
        uploaded_at: certificate.createdAt,
        file_exists: fileStats !== null,
        file_extension: path.extname(certificate.certificate_img),
      };
    });

    const total = await Certificate.countDocuments();

    const responseData = {
      message: "Certificates retrieved successfully",
      certificates: certificatesWithDetails,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total,
        per_page: parseInt(limit),
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get certificates error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get documents
// @route   GET /admin/content/documents
// @access  Private (Admin Only)
exports.getDocuments = async (req, res) => {
  try {
    const { page = 1, limit = 20, user_type } = req.query;
    const skip = (page - 1) * limit;

    const documents = await CompanyDocument.find()
      .populate({
        path: "user_id",
        select: "username email user_type createdAt",
        match: user_type ? { user_type } : {},
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();

    // Filter out documents where user was not found
    const filteredDocuments = documents.filter((doc) => doc.user_id);

    const documentsWithDetails = filteredDocuments.map((document) => {
      const imagePath = path.join(__dirname, "..", document.doc_image);
      let fileSize = 0;
      let fileStats = null;

      try {
        if (fs.existsSync(imagePath)) {
          fileStats = fs.statSync(imagePath);
          fileSize = fileStats.size;
        }
      } catch (error) {
        console.error(`Error reading file ${imagePath}:`, error);
      }

      return {
        id: document._id,
        title: document.title,
        dated: document.dated,
        user: {
          id: document.user_id._id,
          username: document.user_id.username,
          email: document.user_id.email,
          user_type: document.user_id.user_type,
        },
        image_url: document.doc_image,
        file_size: fileSize,
        file_size_formatted: formatBytes(fileSize),
        uploaded_at: document.createdAt,
        file_exists: fileStats !== null,
        file_extension: path.extname(document.doc_image),
      };
    });

    const total = await CompanyDocument.countDocuments();

    const responseData = {
      message: "Documents retrieved successfully",
      documents: documentsWithDetails,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total,
        per_page: parseInt(limit),
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get documents error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get videos
// @route   GET /admin/content/videos
// @access  Private (Admin Only)
exports.getVideos = async (req, res) => {
  try {
    const { page = 1, limit = 20, user_type } = req.query;
    const skip = (page - 1) * limit;

    let matchQuery = { intro_video: { $ne: "" } };

    const profiles = await UserProfile.find(matchQuery)
      .populate({
        path: "user_id",
        select: "username email user_type createdAt",
        match: user_type ? { user_type } : {},
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ updatedAt: -1 })
      .lean();

    // Filter out profiles where user was not found
    const filteredProfiles = profiles.filter((profile) => profile.user_id);

    const videosWithDetails = filteredProfiles.map((profile) => {
      const videoPath = path.join(__dirname, "..", profile.intro_video);
      let fileSize = 0;
      let fileStats = null;

      try {
        if (fs.existsSync(videoPath)) {
          fileStats = fs.statSync(videoPath);
          fileSize = fileStats.size;
        }
      } catch (error) {
        console.error(`Error reading file ${videoPath}:`, error);
      }

      return {
        id: profile._id,
        user: {
          id: profile.user_id._id,
          username: profile.user_id.username,
          email: profile.user_id.email,
          user_type: profile.user_id.user_type,
        },
        video_url: profile.intro_video,
        file_size: fileSize,
        file_size_formatted: formatBytes(fileSize),
        uploaded_at: profile.updatedAt,
        file_exists: fileStats !== null,
        file_extension: path.extname(profile.intro_video),
      };
    });

    const total = await UserProfile.countDocuments(matchQuery);

    const responseData = {
      message: "Videos retrieved successfully",
      videos: videosWithDetails,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total,
        per_page: parseInt(limit),
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get videos error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete media file
// @route   POST /admin/content/delete-media
// @access  Private (Admin Only)
exports.deleteMedia = async (req, res) => {
  try {
    const { file_path, media_type, record_id, reason } = req.body;

    if (!file_path || !media_type || !record_id) {
      return res.status(400).json({
        error: "File path, media type, and record ID are required",
      });
    }

    let updateResult = null;
    const fullPath = path.join(__dirname, "..", file_path);

    // Update database based on media type
    switch (media_type) {
      case "profile_image":
        updateResult = await UserProfile.findByIdAndUpdate(record_id, {
          profile_img: "",
        });
        break;

      case "banner_image":
        updateResult = await UserProfile.findByIdAndUpdate(record_id, {
          banner_img: "",
        });
        break;

      case "intro_video":
        updateResult = await UserProfile.findByIdAndUpdate(record_id, {
          intro_video: "",
        });
        break;

      case "certificate":
        updateResult = await Certificate.findByIdAndDelete(record_id);
        break;

      case "document":
        updateResult = await CompanyDocument.findByIdAndDelete(record_id);
        break;

      case "service_image":
        // For service images, we need to remove from array
        const [serviceId, imageIndex] = record_id.split("_");
        const service = await Service.findById(serviceId);
        if (service && service.service_images[imageIndex]) {
          service.service_images.splice(imageIndex, 1);
          updateResult = await service.save();
        }
        break;

      case "product_image":
        // For product images, we need to remove from array
        const [productId, prodImageIndex] = record_id.split("_");
        const product = await Product.findById(productId);
        if (product && product.media[prodImageIndex]) {
          product.media.splice(prodImageIndex, 1);
          updateResult = await product.save();
        }
        break;

      default:
        return res.status(400).json({ error: "Invalid media type" });
    }

    if (!updateResult) {
      return res.status(404).json({ error: "Record not found" });
    }

    // Delete the actual file
    let fileDeleted = false;
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        fileDeleted = true;
      }
    } catch (error) {
      console.error(`Error deleting file ${fullPath}:`, error);
    }

    const responseData = {
      message: "Media deleted successfully",
      file_deleted: fileDeleted,
      database_updated: true,
      deleted_file: file_path,
      reason: reason || "No reason provided",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Delete media error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get storage statistics
// @route   GET /admin/content/storage-stats
// @access  Private (Admin Only)
exports.getStorageStats = async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "../uploads");
    const stats = {
      total_size: 0,
      total_files: 0,
      categories: {},
      largest_files: [],
      oldest_files: [],
      newest_files: [],
    };

    if (!fs.existsSync(uploadDir)) {
      return res.status(200).json({
        data: encryptData({
          message: "Storage statistics retrieved successfully",
          stats,
        }),
      });
    }

    const allFiles = [];
    const categories = fs.readdirSync(uploadDir);

    // Process each category
    for (const category of categories) {
      const categoryPath = path.join(uploadDir, category);

      if (fs.statSync(categoryPath).isDirectory()) {
        const categoryFiles = getAllFiles(categoryPath);
        let categorySize = 0;
        const categoryFileDetails = [];

        categoryFiles.forEach((filePath) => {
          try {
            const fileStats = fs.statSync(filePath);
            const fileDetail = {
              path: path.relative(path.join(__dirname, ".."), filePath),
              size: fileStats.size,
              created: fileStats.birthtime,
              modified: fileStats.mtime,
              extension: path.extname(filePath),
              category: category,
            };

            categorySize += fileStats.size;
            categoryFileDetails.push(fileDetail);
            allFiles.push(fileDetail);
          } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
          }
        });

        stats.categories[category] = {
          size: categorySize,
          size_formatted: formatBytes(categorySize),
          file_count: categoryFiles.length,
          files: categoryFileDetails,
        };

        stats.total_size += categorySize;
        stats.total_files += categoryFiles.length;
      }
    }

    // Sort files for statistics
    allFiles.sort((a, b) => b.size - a.size);
    stats.largest_files = allFiles.slice(0, 10).map((file) => ({
      ...file,
      size_formatted: formatBytes(file.size),
    }));

    allFiles.sort((a, b) => a.created - b.created);
    stats.oldest_files = allFiles.slice(0, 10).map((file) => ({
      ...file,
      size_formatted: formatBytes(file.size),
    }));

    allFiles.sort((a, b) => b.created - a.created);
    stats.newest_files = allFiles.slice(0, 10).map((file) => ({
      ...file,
      size_formatted: formatBytes(file.size),
    }));

    stats.total_size_formatted = formatBytes(stats.total_size);

    const responseData = {
      message: "Storage statistics retrieved successfully",
      stats,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get storage stats error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Helper function to get all files recursively
function getAllFiles(dir) {
  let files = [];

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files = files.concat(getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return files;
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Helper function to get recent uploads
async function getRecentUploads() {
  try {
    const recentUploads = [];

    // Get recent profile updates
    const recentProfiles = await UserProfile.find({
      $or: [
        { profile_img: { $ne: "" } },
        { banner_img: { $ne: "" } },
        { intro_video: { $ne: "" } },
      ],
    })
      .populate("user_id", "username email user_type")
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    recentProfiles.forEach((profile) => {
      if (profile.profile_img) {
        recentUploads.push({
          type: "profile_image",
          file_path: profile.profile_img,
          user: profile.user_id,
          uploaded_at: profile.updatedAt,
        });
      }
      if (profile.banner_img) {
        recentUploads.push({
          type: "banner_image",
          file_path: profile.banner_img,
          user: profile.user_id,
          uploaded_at: profile.updatedAt,
        });
      }
      if (profile.intro_video) {
        recentUploads.push({
          type: "intro_video",
          file_path: profile.intro_video,
          user: profile.user_id,
          uploaded_at: profile.updatedAt,
        });
      }
    });

    // Get recent certificates
    const recentCertificates = await Certificate.find()
      .populate("user_id", "username email user_type")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    recentCertificates.forEach((cert) => {
      recentUploads.push({
        type: "certificate",
        file_path: cert.certificate_img,
        user: cert.user_id,
        uploaded_at: cert.createdAt,
        title: cert.title,
      });
    });

    // Get recent documents
    const recentDocuments = await CompanyDocument.find()
      .populate("user_id", "username email user_type")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    recentDocuments.forEach((doc) => {
      recentUploads.push({
        type: "document",
        file_path: doc.doc_image,
        user: doc.user_id,
        uploaded_at: doc.createdAt,
        title: doc.title,
      });
    });

    // Sort all recent uploads by date
    recentUploads.sort(
      (a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at)
    );

    return recentUploads.slice(0, 10);
  } catch (error) {
    console.error("Error getting recent uploads:", error);
    return [];
  }
}
