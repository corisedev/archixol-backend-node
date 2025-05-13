// routes/settingsRoutes.js
const express = require("express");
const router = express.Router();
const CryptoJS = require("crypto-js");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Import controllers
const {
  getStoreDetails,
  updateStoreDetails,
  getTaxDetails,
  updateTaxDetails,
  applyCustomTax,
  updateReturnRules,
  updateReturnRulesStatus,
  updateReturnRefundPolicy,
  getReturnRefundPolicy,
  updatePrivacyPolicy,
  getPrivacyPolicy,
  updateTermsOfService,
  getTermsOfService,
  updateShippingPolicy,
  getShippingPolicy,
  getAllPolicies,
  updateCheckoutSettings,
  getCheckoutSettings,
  updateContactInfo,
  getContactInfo,
  updateSupplierProfile,
  getSupplierProfile,
  addRecoveryEmail,
  getRecoveryEmail,
  verifyRecoveryEmail,
  resendRecoveryEmail,
  addRecoveryPhone,
} = require("../controllers/settingsController");

// Import middleware
const { protect, authorizeSupplier } = require("../middleware/auth");
const { decryptRequest } = require("../middleware/encryption");

// Apply middleware
router.use(protect);
router.use(authorizeSupplier);

// Create storage directory if it doesn't exist
const createStorageDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage for store logo
const storeLogoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/store";
    createStorageDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `logo-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

// Configure file filter for images
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb({ message: "Unsupported file format. Only images are allowed." }, false);
  }
};

// Set up multer middleware for store logo upload
const uploadStoreLogo = multer({
  storage: storeLogoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: imageFileFilter,
}).single("logo");

// Handle upload errors
const handleLogoUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File size is too large. Maximum size is 5MB." });
    } else {
      return res.status(400).json({ error: err.message });
    }
  } else if (err) {
    return res
      .status(400)
      .json({ error: err.message || "Error uploading file" });
  }
  next();
};

// Custom middleware to process store details data
const processStoreDetailsData = (req, res, next) => {
  try {
    console.log("Raw request for store details update:", req.body);

    if (req.body && req.body.data) {
      // Decrypt the data field
      const bytes = CryptoJS.AES.decrypt(
        req.body.data,
        process.env.AES_SECRET_KEY
      );
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

      console.log("Decrypted data for store details update:", decryptedData);

      // Parse the decrypted data
      const parsedData = JSON.parse(decryptedData);

      // Process logo if it's coming from a file upload
      if (req.file && req.file.filename) {
        parsedData.logo = `/uploads/store/${req.file.filename}`;
      }

      // Replace req.body with the parsed data
      req.body = parsedData;
    }

    console.log("Final request body for store details update:", req.body);
    next();
  } catch (error) {
    console.error("Processing error:", error);
    return res
      .status(400)
      .json({ error: "Failed to process request: " + error.message });
  }
};

// Store details routes
router.get("/store_details", getStoreDetails);

// In your routes section:
router.post(
  "/store_details",
  uploadStoreLogo,
  handleLogoUploadErrors,
  processStoreDetailsData,
  updateStoreDetails
);

// Tax details routes
router.get("/tax_details", getTaxDetails);
router.post("/tax_details", decryptRequest, updateTaxDetails);
router.post("/apply_custom_tax", decryptRequest, applyCustomTax);

// Return rules routes
router.post("/return_rules", decryptRequest, updateReturnRules);
router.post("/return_rules_status", decryptRequest, updateReturnRulesStatus);

// Policy content routes
router.post("/return_and_refund", decryptRequest, updateReturnRefundPolicy);
router.get("/return_and_refund", getReturnRefundPolicy);
router.post("/privacy_policy", decryptRequest, updatePrivacyPolicy);
router.get("/privacy_policy", getPrivacyPolicy);
router.post("/terms_of_services", decryptRequest, updateTermsOfService);
router.get("/terms_of_services", getTermsOfService);
router.post("/shipping_policy", decryptRequest, updateShippingPolicy);
router.get("/shipping_policy", getShippingPolicy);
router.get("/policies", getAllPolicies);

// Checkout settings routes
router.post("/checkout_settings", decryptRequest, updateCheckoutSettings);
router.get("/checkout_settings", getCheckoutSettings);

// Contact info routes
router.post("/contact_info", decryptRequest, updateContactInfo);
router.get("/contact_info", getContactInfo);

// Supplier profile routes
router.post("/supplier_profile", decryptRequest, updateSupplierProfile);
router.get("/supplier_profile", getSupplierProfile);

// Recovery email routes
router.post("/add_recovery_email", decryptRequest, addRecoveryEmail);
router.get("/get_recovery_email", getRecoveryEmail);
router.post("/verify_recovery_email/:token", verifyRecoveryEmail);
router.post("/resend_recovery_email", decryptRequest, resendRecoveryEmail);

// Recovery phone routes
router.post("/add_recovery_phone", decryptRequest, addRecoveryPhone);

module.exports = router;
