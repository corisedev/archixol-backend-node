const express = require("express");
const router = express.Router();
const {
  getDashboard,
  createService,
  getServices,
  getService,
  updateService,
  deleteService,
} = require("../controllers/serviceController");
const {
  validateService,
  validateGetService,
  validateUpdateService,
  validateDeleteService,
  validate,
} = require("../utils/serviceValidation");
const { protect, authorizeServiceProvider } = require("../middleware/auth");
const { decryptRequest } = require("../middleware/encryption");
const { handleServiceUpload } = require("../middleware/combinedUpload");
const { handleUploadErrors } = require("../middleware/fileUpload");

// Apply decryption middleware to standard JSON routes
const standardRoutes = [
  "/dashboard",
  "/get_service",
  "/get_services",
  "/delete_service",
];
router.use(standardRoutes, decryptRequest);

// Dashboard route
router.get("/dashboard", protect, authorizeServiceProvider, getDashboard);

// Service management routes with file uploads
router.post(
  "/create_service",
  protect,
  authorizeServiceProvider,
  handleServiceUpload,
  handleUploadErrors,
  validateService,
  validate,
  createService
);

router.post(
  "/update_service",
  protect,
  authorizeServiceProvider,
  handleServiceUpload,
  handleUploadErrors,
  validateUpdateService,
  validate,
  updateService
);

// Standard JSON routes
router.get("/get_services", protect, authorizeServiceProvider, getServices);
router.post("/get_service", protect, validateGetService, validate, getService);
router.post(
  "/delete_service",
  protect,
  authorizeServiceProvider,
  validateDeleteService,
  validate,
  deleteService
);

module.exports = router;
