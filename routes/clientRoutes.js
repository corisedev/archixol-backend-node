// routes/clientRoutes.js
const express = require("express");
const router = express.Router();

// Import controllers
const {
  getClientDashboard,
  getJobsAndProjects,
  createJob,
  getOrders,
  getProducts,
  getProduct,
  getServices,
  getService,
  getMyProjects,
} = require("../controllers/clientController");

// Import profile controllers
const {
  getClientProfile,
  updateClientProfile,
  changePassword,
  getAdditionalSettings,
  updateAdditionalSettings,
} = require("../controllers/clientProfileController");

// Import middleware
const { protect, authorizeClient } = require("../middleware/auth");
const { decryptRequest } = require("../middleware/encryption");
const {
  uploadJobDocuments,
  handleUploadErrors,
  processJobData,
} = require("../middleware/jobUpload");
const {
  uploadClientProfileImage,
  handleClientProfileUploadErrors,
  processClientProfileData,
} = require("../middleware/clientProfileUpload");

// Import validation
const {
  validateCreateJob,
  validateGetProduct,
  validateGetService,
  validate,
} = require("../utils/clientValidation");
const {
  validateClientProfileUpdate,
  validateChangePassword,
  validateAdditionalSettings,
  validate: validateProfile,
} = require("../utils/clientProfileValidation");

// Apply middleware to all client routes
router.use(protect);
router.use(authorizeClient);

// Dashboard route
router.get("/dashboard", getClientDashboard);

// Profile routes
router.get("/profile", getClientProfile);
router.post(
  "/profile",
  uploadClientProfileImage,
  handleClientProfileUploadErrors,
  processClientProfileData,
  validateClientProfileUpdate,
  validateProfile,
  updateClientProfile
);

// Password and security routes
router.post(
  "/change_password",
  decryptRequest,
  validateChangePassword,
  validateProfile,
  changePassword
);

// Additional security settings routes
router.get("/additional_settings", getAdditionalSettings);
router.post(
  "/additional_settings",
  decryptRequest,
  validateAdditionalSettings,
  validateProfile,
  updateAdditionalSettings
);

// Jobs and Projects routes
router.get("/jobs", getJobsAndProjects);
router.post(
  "/create_jobs",
  uploadJobDocuments,
  handleUploadErrors,
  processJobData,
  validateCreateJob,
  validate,
  createJob
);

// Orders routes
router.get("/orders", getOrders);

// Products routes
router.get("/products", getProducts);
router.post(
  "/product",
  decryptRequest,
  validateGetProduct,
  validate,
  getProduct
);

// Services routes
router.get("/services", getServices);
router.post(
  "/service",
  decryptRequest,
  validateGetService,
  validate,
  getService
);

// My Projects route
router.get("/my-projects", getMyProjects);

module.exports = router;
