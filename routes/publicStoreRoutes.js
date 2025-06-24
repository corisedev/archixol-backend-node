const express = require("express");
const router = express.Router();

// Import site builder controller
const { getPublicStore } = require("../controllers/siteBuilderController");

// Import navbar/footer controller
const {
  getStoreNavFooter,
} = require("../controllers/storeNavFooterController");

// Import home page controller
const { getStoreHomePage } = require("../controllers/storeHomePageController");

// Import collections controller
const {
  getStoreCollections,
} = require("../controllers/storeCollectionsController");

// Import collection products controller
const {
  getStoreCollectionProducts,
} = require("../controllers/storeCollectionProductsController");

// Import product controller
const { getStoreProduct } = require("../controllers/storeProductController");

// Import policies controller
const {
  getStorePrivacyPolicy,
  getStoreRefundPolicy,
  getStoreShippingPolicy,
  getStoreTermsOfServices,
} = require("../controllers/storePoliciesController");

// @desc    Get public supplier store
// @route   GET /public/supplier/:supplierIdentifier/store
// @access  Public
router.get("/supplier/:supplierIdentifier/store", getPublicStore);

// @desc    Get supplier store navigation and footer data
// @route   GET /public/supplier/:store_name/navbar_footer
// @access  Public
router.get("/supplier/:store_name/navbar_footer", getStoreNavFooter);

// @desc    Get supplier store home page data
// @route   GET /public/supplier/:store_name/home_page
// @access  Public
router.get("/supplier/:store_name/home_page", getStoreHomePage);

// @desc    Get supplier store collections
// @route   GET /public/supplier/:store_name/collections
// @access  Public
router.get("/supplier/:store_name/collections", getStoreCollections);

// @desc    Get products from a specific collection in supplier store
// @route   GET /public/supplier/:store_name/collections/:collection_id
// @access  Public
router.get(
  "/supplier/:store_name/collections/:collection_id",
  getStoreCollectionProducts
);

// @desc    Get specific product details from supplier store
// @route   GET /public/supplier/:store_name/products/:product_id
// @access  Public
router.get("/supplier/:store_name/products/:product_id", getStoreProduct);

// Policy endpoints
// @desc    Get supplier store privacy policy
// @route   GET /public/supplier/:store_name/privacy_policy
// @access  Public
router.get("/supplier/:store_name/privacy_policy", getStorePrivacyPolicy);

// @desc    Get supplier store refund policy
// @route   GET /public/supplier/:store_name/refund_policy
// @access  Public
router.get("/supplier/:store_name/refund_policy", getStoreRefundPolicy);

// @desc    Get supplier store shipping policy
// @route   GET /public/supplier/:store_name/shipping_policy
// @access  Public
router.get("/supplier/:store_name/shipping_policy", getStoreShippingPolicy);

module.exports = router;
