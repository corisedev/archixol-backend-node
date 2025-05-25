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
  getJobProposals,
  getMyJobs,
  proposalAction,
  getProjectsByStatus,
  cancelProject,
  completeProject,
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
  validateGetJobProposals,
  validateProposals,
  validateGetMyJobs,
} = require("../utils/clientValidation");

const {
  validateProposalAction,
  validateGetProjectsByStatus,
  validateCancelProject,
  validateCompleteProject,
  validate: validateProject,
} = require("../utils/projectManagementValidation");

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

// @desc    Get all proposals for a specific job
// @route   POST /client/get_job_proposals
// @access  Private (Client Only)
router.post(
  "/get_job_proposals",
  decryptRequest,
  validateGetJobProposals,
  validate,
  getJobProposals
);

// @desc    Get all jobs posted by client with proposal counts
// @route   GET /client/my_jobs
// @access  Private (Client Only)
router.get("/my_jobs", validateGetMyJobs, validate, getMyJobs);

// My Projects route
router.get("/my-projects", getMyProjects);

// @desc    Get projects by status (ongoing, completed, cancelled, rejected)
// @route   GET /client/projects_by_status
// @access  Private (Client Only)
router.get(
  "/projects_by_status",
  validateGetProjectsByStatus,
  validateProject,
  getProjectsByStatus
);

// @desc    Accept or reject a proposal
// @route   POST /client/proposal_action
// @access  Private (Client Only)
router.post(
  "/proposal_action",
  decryptRequest,
  validateProposalAction,
  validateProject,
  proposalAction
);

// @desc    Cancel an ongoing project
// @route   POST /client/cancel_project
// @access  Private (Client Only)
router.post(
  "/cancel_project",
  decryptRequest,
  validateCancelProject,
  validateProject,
  cancelProject
);

// @desc    Mark project as completed
// @route   POST /client/complete_project
// @access  Private (Client Only)
router.post(
  "/complete_project",
  decryptRequest,
  validateCompleteProject,
  validateProject,
  completeProject
);

module.exports = router;
