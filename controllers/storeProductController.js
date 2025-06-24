const Product = require("../models/Product");
const Vendor = require("../models/Vendor");
const User = require("../models/User");
const { StoreDetails } = require("../models/SupplierSettings");
const SupplierSiteBuilder = require("../models/SupplierSiteBuilder");

// @desc    Get specific product details from supplier store
// @route   GET /public/supplier/:store_name/products/:product_id
// @access  Public
exports.getStoreProduct = async (req, res) => {
  try {
    const { store_name, product_id } = req.params;

    console.log(
      "Getting product details for store:",
      store_name,
      "product:",
      product_id
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
      is_published: true,
    });

    if (!siteBuilder) {
      return res.status(404).json({
        error: "Store not found or not published",
      });
    }

    // Find the specific product with populated collections
    const product = await Product.findOne({
      _id: product_id,
      supplier_id: supplierId,
      status: "active",
    }).populate({
      path: "search_collection",
      select: "title description url_handle",
      match: { status: "active" },
    }).select(`
      title description media category status variant_option variants 
      url_handle page_title meta_description price search_vendor 
      search_collection search_tags
    `);

    if (!product) {
      return res.status(404).json({
        error: "Product not found or not accessible in this store",
      });
    }

    // Get vendor name if search_vendor exists
    let vendor_name = "";
    if (product.search_vendor) {
      try {
        const vendor = await Vendor.findById(product.search_vendor).select(
          "vendor_name first_name last_name"
        );
        if (vendor) {
          vendor_name =
            vendor.vendor_name ||
            `${vendor.first_name} ${vendor.last_name}`.trim();
        }
      } catch (vendorError) {
        console.warn("Error fetching vendor for product:", vendorError);
        vendor_name = "";
      }
    }

    // Format the product response
    const productResponse = {
      title: product.title,
      description: product.description,
      media: product.media || [],
      category: product.category,
      status: product.status,
      variant_option: product.variant_option,
      variants: product.variants.map((variant) => ({
        option_name: variant.option_name,
        option_values: variant.option_values,
      })),
      url_handle: product.url_handle,
      page_title: product.page_title,
      meta_description: product.meta_description,
      price: product.price || 0,
      vendor_name: vendor_name,
      search_collection: product.search_collection.map((collection) => ({
        id: collection._id,
        title: collection.title,
        description: collection.description,
        url_handle: collection.url_handle,
      })),
      search_tags: product.search_tags || [],
    };

    const responseData = {
      message: "Product details retrieved successfully",
      product: productResponse,
    };

    console.log(
      `Successfully retrieved product: ${product.title} from store: ${store_name}`
    );

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Get store product error:", err);

    // Handle invalid ObjectId error
    if (err.name === "CastError" && err.kind === "ObjectId") {
      return res.status(400).json({
        error: "Invalid product ID format",
      });
    }

    res.status(500).json({
      error: "Server error while retrieving product details",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
