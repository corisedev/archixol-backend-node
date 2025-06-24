const SupplierSiteBuilder = require("../models/SupplierSiteBuilder");
const Collection = require("../models/Collection");
const Product = require("../models/Product");
const User = require("../models/User");
const { StoreDetails } = require("../models/SupplierSettings");

// Helper function to format product data
const formatProductData = (product) => {
  if (!product) return null;

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

  return {
    id: product._id,
    title: product.title,
    image: primaryImage,
    price: price,
    discount_price: discountPrice,
    rating: rating,
    rating_count: ratingCount,
    stock: product.quantity || 0,
  };
};

// @desc    Get supplier store home page data
// @route   GET /public/supplier/:store_name/home_page
// @access  Public
exports.getStoreHomePage = async (req, res) => {
  try {
    const { store_name } = req.params;

    console.log("Getting home page data for store:", store_name);

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

    // Get published site builder configuration with populated data
    const siteBuilder = await SupplierSiteBuilder.findOne({
      supplier_id: supplierId,
      is_published: true,
    })
      .populate({
        path: "sections.collection_id",
        select: "title description collection_images url_handle status",
        populate: {
          path: "product_list",
          select:
            "title price media url_handle status category description compare_at_price quantity",
          match: { status: "active" },
          options: { limit: 12 }, // Limit products per collection
        },
      })
      .populate({
        path: "sections.product_ids",
        select:
          "title price media url_handle status category description compare_at_price quantity",
        match: { status: "active" },
      })
      .populate({
        path: "hot_products.product_id",
        select:
          "title price media url_handle status category description compare_at_price quantity",
        match: { status: "active" },
      });

    if (!siteBuilder) {
      return res.status(404).json({
        error: "Store not found or not published",
      });
    }

    // Sort arrays by position
    siteBuilder.sortSectionsByPosition();
    siteBuilder.sortHotProductsByPosition();
    siteBuilder.sortHeroBannersByPosition();

    // 1. Format Hero Banners
    const hero_banners = siteBuilder.hero_banners.map((banner) => ({
      id: banner._id,
      image_path: banner.image_path,
      title: banner.title,
      subtitle: banner.subtitle,
      button_text: banner.button_text,
      button_link: banner.button_link,
      position: banner.position,
    }));

    // 2. Get Collections with their primary images
    const collections = await Collection.find({
      supplier_id: supplierId,
      status: "active",
    })
      .select("_id title collection_images")
      .sort({ title: 1 });

    const formattedCollections = collections.map((collection) => ({
      id: collection._id,
      title: collection.title,
      collection_image:
        collection.collection_images && collection.collection_images.length > 0
          ? collection.collection_images[0]
          : null,
    }));

    // 3. Format Hot Products
    const hot_product = [];
    for (const hotProduct of siteBuilder.hot_products) {
      if (hotProduct.product_id) {
        const formattedProduct = formatProductData(hotProduct.product_id);
        if (formattedProduct) {
          hot_product.push(formattedProduct);
        }
      }
    }

    // 4. Format Sections
    const sections = [];
    for (const section of siteBuilder.sections) {
      const sectionObj = {
        id: section._id,
        type: section.type,
      };

      switch (section.type) {
        case "banner":
          sectionObj.imageUrl = section.imageUrl;
          sectionObj.title = section.title;
          sectionObj.content = section.content;
          break;

        case "collection":
          if (
            section.collection_id &&
            section.collection_id.status === "active"
          ) {
            const collection = section.collection_id;
            sectionObj.collection_id = collection._id;
            sectionObj.collection_title = collection.title;
            sectionObj.collection_description = collection.description;

            // Format collection products
            const collection_products = [];
            if (collection.product_list && collection.product_list.length > 0) {
              for (const product of collection.product_list) {
                const formattedProduct = formatProductData(product);
                if (formattedProduct) {
                  collection_products.push(formattedProduct);
                }
              }
            }
            sectionObj.collection_products = collection_products;
          }
          break;

        case "products":
          if (section.product_ids && section.product_ids.length > 0) {
            const collection_products = [];
            for (const product of section.product_ids) {
              const formattedProduct = formatProductData(product);
              if (formattedProduct) {
                collection_products.push(formattedProduct);
              }
            }
            sectionObj.collection_products = collection_products;
          }
          break;

        case "text":
          sectionObj.title = section.title;
          sectionObj.content = section.content;
          break;

        case "gallery":
          sectionObj.images = section.images || [];
          break;

        default:
          // For unknown section types, include basic info
          if (section.imageUrl) sectionObj.imageUrl = section.imageUrl;
          if (section.title) sectionObj.title = section.title;
          if (section.content) sectionObj.content = section.content;
          break;
      }

      sections.push(sectionObj);
    }

    const responseData = {
      message: "Store home page data retrieved successfully",
      hero_banners,
      collections: formattedCollections,
      hot_product,
      sections,
    };

    console.log(
      `Successfully retrieved home page data for store: ${store_name}`
    );
    console.log(
      `Hero banners: ${hero_banners.length}, Collections: ${formattedCollections.length}, Hot products: ${hot_product.length}, Sections: ${sections.length}`
    );

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Get store home page error:", err);
    res.status(500).json({
      error: "Server error while retrieving store home page data",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
