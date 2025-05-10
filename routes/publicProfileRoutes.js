// routes/publicProfileRoutes.js
const express = require("express");
const router = express.Router();
const {
  getPublicProfile,
  getPublicProjects,
  getPublicCertificates,
  getPublicServices,
  getPublicCompany,
} = require("../controllers/publicProfileController");

// Public routes - no authentication required
router.get("/user/:username", getPublicProfile);
router.get("/projects/:username", getPublicProjects);
router.get("/certificates/:username", getPublicCertificates);
router.get("/services/:username", getPublicServices);
router.get("/company/:username", getPublicCompany);

module.exports = router;
