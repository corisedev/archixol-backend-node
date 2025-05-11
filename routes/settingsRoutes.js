// routes/settingsRoutes.js
const express = require("express");
const router = express.Router();

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

// Store details routes
router.get("/store_details", getStoreDetails);
router.post("/store_details", decryptRequest, updateStoreDetails);

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
