// routes/supplierRoutes.js
const express = require("express");
const router = express.Router();

// Import controllers
const {
  getGlobalData,
  updateGlobalData,
  getDashboardData,
} = require("../controllers/supplierController");

// Import product controllers
const {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
} = require("../controllers/productController");

// Import product middleware
const {
  uploadProductImages,
  handleUploadErrors: handleProductUploadErrors,
  processProductData,
} = require("../middleware/productUpload");

// Import collection controllers
const {
  getAllCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  searchCollections,
} = require("../controllers/collectionController");

// Import collection middleware
const {
  uploadCollectionImages,
  handleUploadErrors: handleCollectionUploadErrors,
  processCollectionData,
} = require("../middleware/collectionUpload");

// Import order controllers
const {
  getAllOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  restockOrder,
  updateFulfillmentStatus,
  markAsPaid,
  markAsDelivered,
  sendInvoice,
} = require("../controllers/orderController");

const {
  getAllCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customerController");

const {
  getAllVendors,
  getVendor,
  createVendor,
  updateVendor,
  deleteVendor,
} = require("../controllers/vendorController");

const {
  getAllPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  markAsReceived,
} = require("../controllers/purchaseOrderController");

const { getInventory } = require("../controllers/inventoryController");
const { generateReport } = require("../controllers/reportController");

const { getFiles, deleteFiles } = require("../controllers/contentController");

// Import auth middleware
const { protect, authorizeSupplier } = require("../middleware/auth");
const { decryptRequest } = require("../middleware/encryption");
const { validateSearchQuery } = require("../utils/searchValidation");

// Middleware to authorize suppliers
router.use(protect);
router.use(authorizeSupplier);

// Global data routes
router.get("/global_data", getGlobalData);
router.post("/update_global_data", decryptRequest, updateGlobalData);

// Dashboard Routes
router.get("/dashboard", getDashboardData);

// Product routes
router.get("/get_all_products", getAllProducts);
router.post("/get_product", decryptRequest, getProduct);
router.post(
  "/create_product",
  uploadProductImages,
  handleProductUploadErrors,
  processProductData,
  createProduct
);
router.post(
  "/update_product",
  uploadProductImages,
  handleProductUploadErrors,
  processProductData,
  updateProduct
);
router.post("/delete_product", decryptRequest, deleteProduct);
router.post("/search_product", validateSearchQuery, searchProducts);

// Collection routes
router.get("/get_all_collections", getAllCollections);
router.post("/get_collection", decryptRequest, getCollection);
router.post(
  "/create_collection",
  uploadCollectionImages,
  handleCollectionUploadErrors,
  processCollectionData,
  createCollection
);
router.post(
  "/update_collection",
  uploadCollectionImages,
  handleCollectionUploadErrors,
  processCollectionData,
  updateCollection
);
router.post("/delete_collection", decryptRequest, deleteCollection);
router.post("/search_collection", validateSearchQuery, searchCollections);

// Order routes
router.get("/get_all_orders", getAllOrders);
router.post("/get_order", decryptRequest, getOrder);
router.post("/create_order", decryptRequest, createOrder);
router.post("/update_order", decryptRequest, updateOrder);
router.post("/delete_order", decryptRequest, deleteOrder);
router.post("/restock", decryptRequest, restockOrder);
router.post("/fullfillment_status", decryptRequest, updateFulfillmentStatus);
router.post("/mark_as_paid", decryptRequest, markAsPaid);
router.post("/mark_as_delivered", decryptRequest, markAsDelivered);
router.post("/send_invoice", decryptRequest, sendInvoice);

// Customer Routes
router.get("/get_all_customers", getAllCustomers);
router.post("/get_customer", decryptRequest, getCustomer);
router.post("/create_customer", decryptRequest, createCustomer);
router.post("/update_customer", decryptRequest, updateCustomer);
router.post("/delete_customer", decryptRequest, deleteCustomer);

// Vendor routes
router.get("/get_all_vendors", getAllVendors);
router.post("/get_vendor", decryptRequest, getVendor);
router.post("/create_vendor", decryptRequest, createVendor);
router.post("/update_vendor", decryptRequest, updateVendor);
router.post("/delete_vendor", decryptRequest, deleteVendor);

// Purchase Order routes
router.get("/get_all_purchaseorders", getAllPurchaseOrders);
router.post("/get_purchaseorder", decryptRequest, getPurchaseOrder);
router.post("/create_purchaseorder", decryptRequest, createPurchaseOrder);
router.post("/update_purchaseorder", decryptRequest, updatePurchaseOrder);
router.post("/delete_purchaseorder", decryptRequest, deletePurchaseOrder);
router.post("/mark_as_recieved", decryptRequest, markAsReceived);

// Content Management routes
router.get("/get_files", getFiles);
router.post("/delete_file", decryptRequest, deleteFiles);

router.get("/get_inventory", getInventory);

router.post("/generate_report", decryptRequest, generateReport);

module.exports = router;
