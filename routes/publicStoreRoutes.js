// routes/publicStoreRoutes.js
const express = require("express");
const router = express.Router();

// Import site builder controller
const { getPublicStore } = require("../controllers/siteBuilderController");

// @desc    Get public supplier store
// @route   GET /public/supplier/:supplierIdentifier/store
// @access  Public
router.get("/supplier/:supplierIdentifier/store", getPublicStore);

module.exports = router;
