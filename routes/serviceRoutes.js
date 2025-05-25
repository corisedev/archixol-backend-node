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

// Import job-related controllers
const {
  getAvailableJobs,
  getJobDetails,
  applyForJob,
  getMyApplications,
  updateApplication,
  saveJob,
  unsaveJob,
  getSavedJobs,
} = require("../controllers/serviceProviderJobController");

const {
  validateService,
  validateGetService,
  validateUpdateService,
  validateDeleteService,
  validate,
} = require("../utils/serviceValidation");

// Import job validation
const {
  validateGetJobDetails,
  validateApplyForJob,
  validateGetMyApplications,
  validateUpdateApplication,
  validateGetAvailableJobs,
  validateSaveJob,
  validateUnsaveJob,
  validateGetSavedJobs,
  validate: validateJob,
} = require("../utils/serviceProviderJobValidation");

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
  "/get_job_details",
  "/apply_job",
  "/update_application",
  "/save_job",
  "/unsave_job",
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

// Standard JSON routes for services
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

// ==================== JOB APPLICATION ROUTES ====================

// @desc    Get all available jobs matching service provider's categories
// @route   GET /service/get_available_jobs
// @access  Private (Service Provider Only)
router.get(
  "/get_available_jobs",
  protect,
  authorizeServiceProvider,
  validateGetAvailableJobs,
  validateJob,
  getAvailableJobs
);

// @desc    Get details of a specific project job
// @route   POST /service/get_job_details
// @access  Private (Service Provider Only)
router.post(
  "/get_job_details",
  protect,
  authorizeServiceProvider,
  validateGetJobDetails,
  validateJob,
  getJobDetails
);

// @desc    Apply for a project job
// @route   POST /service/apply_job
// @access  Private (Service Provider Only)
router.post(
  "/apply_job",
  protect,
  authorizeServiceProvider,
  validateApplyForJob,
  validateJob,
  applyForJob
);

// @desc    Get all job applications by service provider
// @route   GET /service/get_my_applications
// @access  Private (Service Provider Only)
router.get(
  "/get_my_applications",
  protect,
  authorizeServiceProvider,
  validateGetMyApplications,
  validateJob,
  getMyApplications
);

// @desc    Update job application (withdraw, update proposal)
// @route   POST /service/update_application
// @access  Private (Service Provider Only)
router.post(
  "/update_application",
  protect,
  authorizeServiceProvider,
  validateUpdateApplication,
  validateJob,
  updateApplication
);

// ==================== SAVED JOBS ROUTES ====================

// @desc    Save a job for later
// @route   POST /service/save_job
// @access  Private (Service Provider Only)
router.post(
  "/save_job",
  protect,
  authorizeServiceProvider,
  validateSaveJob,
  validateJob,
  saveJob
);

// @desc    Remove a saved job
// @route   POST /service/unsave_job
// @access  Private (Service Provider Only)
router.post(
  "/unsave_job",
  protect,
  authorizeServiceProvider,
  validateUnsaveJob,
  validateJob,
  unsaveJob
);

// @desc    Get all saved jobs
// @route   GET /service/get_saved_jobs
// @access  Private (Service Provider Only)
router.get(
  "/get_saved_jobs",
  protect,
  authorizeServiceProvider,
  validateGetSavedJobs,
  validateJob,
  getSavedJobs
);

module.exports = router;
