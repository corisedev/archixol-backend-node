const Collection = require("../models/Collection");
const User = require("../models/User");
const { StoreDetails } = require("../models/SupplierSettings");
const SupplierSiteBuilder = require("../models/SupplierSiteBuilder");

// Helper function to format product data (reused from home page controller)
const formatProductData = (product) => {
  if (!product) return null;
  console.log(product);
  // Calculate discount price and rating
  const price = product.price || 0;
  const compareAtPrice = product.compare_at_price || 0;
  const discountPrice = compareAtPrice > price ? compareAtPrice : null;

  // Get primary image
  const primaryImage =
    product.media && product.media.length > 0 ? product.media[0] : null;

  // Mock rating data (you can replace with actual rating system)
  const rating = 4.5; // Default rating
  const ratingCount = Math.floor(Math.random() * 100) + 10; // Mock rating count
  const creation_date = product.createdAt;

  return {
    id: product._id,
    title: product.title,
    image: primaryImage,
    price: price,
    discount_price: discountPrice,
    rating: rating,
    rating_count: ratingCount,
    stock: product.quantity || 0,
    creation_date: creation_date,
  };
};

// @desc    Get products from a specific collection in supplier store
// @route   GET /public/supplier/:store_name/collections/:collection_id
// @access  Public
exports.getStoreCollectionProducts = async (req, res) => {
  try {
    const { store_name, collection_id } = req.params;

    console.log(
      "Getting collection products for store:",
      store_name,
      "collection:",
      collection_id
    );

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

    // Find the specific collection with populated products
    const collection = await Collection.findOne({
      _id: collection_id,
      supplier_id: supplierId,
      status: "active",
    })
      .populate({
        path: "product_list",
        select:
          "title price media url_handle status category description compare_at_price quantity createdAt",
        match: { status: "active" }, // Only get active products
        options: { sort: { createdAt: -1 } }, // Sort by newest first
      })
      .select("title description product_list");

    if (!collection) {
      return res.status(404).json({
        error: "Collection not found or not accessible in this store",
      });
    }

    // Format products for response
    const collection_products = [];
    if (collection.product_list && collection.product_list.length > 0) {
      for (const product of collection.product_list) {
        const formattedProduct = formatProductData(product);
        if (formattedProduct) {
          collection_products.push(formattedProduct);
        }
      }
    }

    const responseData = {
      message: "Collection products retrieved successfully",
      title: collection.title,
      collection_products: collection_products,
    };

    console.log(
      `Successfully retrieved ${collection_products.length} products for collection: ${collection.title} in store: ${store_name}`
    );

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Get store collection products error:", err);

    // Handle invalid ObjectId error
    if (err.name === "CastError" && err.kind === "ObjectId") {
      return res.status(400).json({
        error: "Invalid collection ID format",
      });
    }

    res.status(500).json({
      error: "Server error while retrieving collection products",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
