// routes/adminContentRoutes.js - FIXED VERSION
const express = require("express");
const router = express.Router();

// Import controllers - ONLY import functions that actually exist
const {
  getContentOverview,
  getProfileImages,
  getServiceImages,
  getProductImages,
  getCertificates,
  getDocuments,
  getVideos,
  deleteMedia,
  getStorageStats,
} = require("../controllers/adminContentController");

// Import middleware
const { authorizeAdmin } = require("../middleware/adminAuth");
const { decryptRequest } = require("../middleware/encryption");

// Import validation
const {
  validateGetProfileImages,
  validateGetServiceImages,
  validateGetProductImages,
  validateGetCertificates,
  validateGetDocuments,
  validateGetVideos,
  validateDeleteMedia,
  validate,
} = require("../utils/adminContentValidation");

// Apply admin authorization to all routes
router.use(authorizeAdmin);

// ==================== CONTENT OVERVIEW ROUTES ====================

// @desc    Get content overview/dashboard
// @route   GET /admin/content/overview
// @access  Private (Admin Only)
router.get("/overview", getContentOverview);

// @desc    Get storage statistics
// @route   GET /admin/content/storage-stats
// @access  Private (Admin Only)
router.get("/storage-stats", getStorageStats);

// ==================== MEDIA RETRIEVAL ROUTES ====================

// @desc    Get profile images
// @route   GET /admin/content/profile-images
// @access  Private (Admin Only)
router.get(
  "/profile-images",
  validateGetProfileImages,
  validate,
  getProfileImages
);

// @desc    Get service images
// @route   GET /admin/content/service-images
// @access  Private (Admin Only)
router.get(
  "/service-images",
  validateGetServiceImages,
  validate,
  getServiceImages
);

// @desc    Get product images
// @route   GET /admin/content/product-images
// @access  Private (Admin Only)
router.get(
  "/product-images",
  validateGetProductImages,
  validate,
  getProductImages
);

// @desc    Get certificates
// @route   GET /admin/content/certificates
// @access  Private (Admin Only)
router.get("/certificates", validateGetCertificates, validate, getCertificates);

// @desc    Get documents
// @route   GET /admin/content/documents
// @access  Private (Admin Only)
router.get("/documents", validateGetDocuments, validate, getDocuments);

// @desc    Get videos
// @route   GET /admin/content/videos
// @access  Private (Admin Only)
router.get("/videos", validateGetVideos, validate, getVideos);

// ==================== CONTENT MANAGEMENT ROUTES ====================

// @desc    Delete single media file
// @route   POST /admin/content/delete-media
// @access  Private (Admin Only)
router.post(
  "/delete-media",
  decryptRequest,
  validateDeleteMedia,
  validate,
  deleteMedia
);

module.exports = router;
