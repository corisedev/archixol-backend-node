const User = require("../models/User");
const { StoreDetails, PolicyContent } = require("../models/SupplierSettings");
const SupplierSiteBuilder = require("../models/SupplierSiteBuilder");

// Helper function to find supplier by store name
const findSupplierByStoreName = async (store_name) => {
  // First try to find by store name in StoreDetails
  const storeDetails = await StoreDetails.findOne({
    store_name: store_name,
  }).populate("supplier_id", "username email");

  if (storeDetails && storeDetails.supplier_id) {
    return storeDetails.supplier_id;
  }

  // Fallback: try to find by username
  const supplier = await User.findOne({
    username: store_name,
    accessRoles: { $in: ["supplier"] },
  }).select("_id username email");

  return supplier;
};

// Helper function to check if store is published
const checkStorePublished = async (supplierId) => {
  const siteBuilder = await SupplierSiteBuilder.findOne({
    supplier_id: supplierId,
    is_published: true,
  });

  return !!siteBuilder;
};

// @desc    Get supplier store privacy policy
// @route   GET /public/supplier/:store_name/privacy_policy
// @access  Public
exports.getStorePrivacyPolicy = async (req, res) => {
  try {
    const { store_name } = req.params;

    console.log("Getting privacy policy for store:", store_name);

    // Find the supplier by store name or username
    const supplier = await findSupplierByStoreName(store_name);

    if (!supplier) {
      return res.status(404).json({
        error: "Store not found with the provided store name",
      });
    }

    const supplierId = supplier._id;
    console.log(`Found supplier ID ${supplierId} for store: ${store_name}`);

    // Check if the store is published
    const isPublished = await checkStorePublished(supplierId);
    if (!isPublished) {
      return res.status(404).json({
        error: "Store not found or not published",
      });
    }

    // Get policy content for this supplier
    const policyContent = await PolicyContent.findOne({
      supplier_id: supplierId,
    }).select("privacy_policy");

    const content = policyContent?.privacy_policy || "";

    const responseData = {
      message: "Privacy policy retrieved successfully",
      content: content,
    };

    console.log(
      `Successfully retrieved privacy policy for store: ${store_name}`
    );

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Get store privacy policy error:", err);
    res.status(500).json({
      error: "Server error while retrieving privacy policy",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// @desc    Get supplier store refund policy
// @route   GET /public/supplier/:store_name/refund_policy
// @access  Public
exports.getStoreRefundPolicy = async (req, res) => {
  try {
    const { store_name } = req.params;

    console.log("Getting refund policy for store:", store_name);

    // Find the supplier by store name or username
    const supplier = await findSupplierByStoreName(store_name);

    if (!supplier) {
      return res.status(404).json({
        error: "Store not found with the provided store name",
      });
    }

    const supplierId = supplier._id;
    console.log(`Found supplier ID ${supplierId} for store: ${store_name}`);

    // Check if the store is published
    const isPublished = await checkStorePublished(supplierId);
    if (!isPublished) {
      return res.status(404).json({
        error: "Store not found or not published",
      });
    }

    // Get policy content for this supplier
    const policyContent = await PolicyContent.findOne({
      supplier_id: supplierId,
    }).select("return_and_refund");

    const content = policyContent?.return_and_refund || "";

    const responseData = {
      message: "Refund policy retrieved successfully",
      content: content,
    };

    console.log(
      `Successfully retrieved refund policy for store: ${store_name}`
    );

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Get store refund policy error:", err);
    res.status(500).json({
      error: "Server error while retrieving refund policy",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// @desc    Get supplier store shipping policy
// @route   GET /public/supplier/:store_name/shipping_policy
// @access  Public
exports.getStoreShippingPolicy = async (req, res) => {
  try {
    const { store_name } = req.params;

    console.log("Getting shipping policy for store:", store_name);

    // Find the supplier by store name or username
    const supplier = await findSupplierByStoreName(store_name);

    if (!supplier) {
      return res.status(404).json({
        error: "Store not found with the provided store name",
      });
    }

    const supplierId = supplier._id;
    console.log(`Found supplier ID ${supplierId} for store: ${store_name}`);

    // Check if the store is published
    const isPublished = await checkStorePublished(supplierId);
    if (!isPublished) {
      return res.status(404).json({
        error: "Store not found or not published",
      });
    }

    // Get policy content for this supplier
    const policyContent = await PolicyContent.findOne({
      supplier_id: supplierId,
    }).select("shipping_policy");

    const content = policyContent?.shipping_policy || "";

    const responseData = {
      message: "Shipping policy retrieved successfully",
      content: content,
    };

    console.log(
      `Successfully retrieved shipping policy for store: ${store_name}`
    );

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Get store shipping policy error:", err);
    res.status(500).json({
      error: "Server error while retrieving shipping policy",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// @desc    Get supplier store terms of services
// @route   GET /public/supplier/:store_name/term_of_services
// @access  Public
exports.getStoreTermsOfServices = async (req, res) => {
  try {
    const { store_name } = req.params;

    console.log("Getting terms of services for store:", store_name);

    // Find the supplier by store name or username
    const supplier = await findSupplierByStoreName(store_name);

    if (!supplier) {
      return res.status(404).json({
        error: "Store not found with the provided store name",
      });
    }

    const supplierId = supplier._id;
    console.log(`Found supplier ID ${supplierId} for store: ${store_name}`);

    // Check if the store is published
    const isPublished = await checkStorePublished(supplierId);
    if (!isPublished) {
      return res.status(404).json({
        error: "Store not found or not published",
      });
    }

    // Get policy content for this supplier
    const policyContent = await PolicyContent.findOne({
      supplier_id: supplierId,
    }).select("terms_of_services");

    const content = policyContent?.terms_of_services || "";

    const responseData = {
      message: "Terms of services retrieved successfully",
      content: content,
    };

    console.log(
      `Successfully retrieved terms of services for store: ${store_name}`
    );

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Get store terms of services error:", err);
    res.status(500).json({
      error: "Server error while retrieving terms of services",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
