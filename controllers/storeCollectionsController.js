const Collection = require("../models/Collection");
const User = require("../models/User");
const { StoreDetails } = require("../models/SupplierSettings");
const SupplierSiteBuilder = require("../models/SupplierSiteBuilder");

// @desc    Get supplier store collections
// @route   GET /public/supplier/:store_name/collections
// @access  Public
exports.getStoreCollections = async (req, res) => {
  try {
    const { store_name } = req.params;

    console.log("Getting collections for store:", store_name);

    // Find the supplier by store name or username
    let supplier = null;

    // First try to find by store name in StoreDetails
    const storeDetails = await StoreDetails.findOne({
      store_name: store_name,
    }).populate("supplier_id", "username email");

    if (storeDetails && storeDetails.supplier_id) {
      supplier = storeDetails.supplier_id;
    } else {
      // Fallback: try to find by username
      supplier = await User.findOne({
        username: store_name,
        accessRoles: { $in: ["supplier"] },
      }).select("_id username email");
    }

    if (!supplier) {
      return res.status(404).json({
        error: "Store not found with the provided store name",
      });
    }

    const supplierId = supplier._id;
    console.log(`Found supplier ID ${supplierId} for store: ${store_name}`);

    // Check if the store is published
    const siteBuilder = await SupplierSiteBuilder.findOne({
      supplier_id: supplierId,
    });

    if (!siteBuilder) {
      return res.status(404).json({
        error: "Store not found or not published",
      });
    }

    // Get all active collections for this supplier
    const collections = await Collection.find({
      supplier_id: supplierId,
      status: "active",
    })
      .select("_id title collection_images createdAt")
      .sort({ createdAt: -1 }); // Sort by newest first

    // Format collections for response
    const formattedCollections = collections.map((collection) => ({
      id: collection._id,
      title: collection.title,
      collection_image:
        collection.collection_images && collection.collection_images.length > 0
          ? collection.collection_images[0]
          : null,
    }));

    const responseData = {
      message: "Store collections retrieved successfully",
      collection: formattedCollections,
    };

    console.log(
      `Successfully retrieved ${formattedCollections.length} collections for store: ${store_name}`
    );

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Get store collections error:", err);
    res.status(500).json({
      error: "Server error while retrieving store collections",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
