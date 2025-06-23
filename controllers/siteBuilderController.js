// controllers/siteBuilderController.js
const SupplierSiteBuilder = require("../models/SupplierSiteBuilder");
const Product = require("../models/Product");
const Collection = require("../models/Collection");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Update supplier site builder configuration
// @route   POST /supplier/site_builder
// @access  Private (Supplier Only)
exports.updateSiteBuilder = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      sections,
      hot_products,
      about_us,
      hero_banners,
      theme,
      seo,
      social_links,
      is_published,
    } = req.body;

    console.log("Site builder update request from user:", userId);
    console.log("Request data:", JSON.stringify(req.body, null, 2));

    // Find or create site builder configuration
    let siteBuilder = await SupplierSiteBuilder.findOne({
      supplier_id: userId,
    });

    if (!siteBuilder) {
      siteBuilder = new SupplierSiteBuilder({ supplier_id: userId });
    }

    // Process sections with position indexing
    if (sections && Array.isArray(sections)) {
      const processedSections = sections.map((section, index) => {
        const processedSection = {
          type: section.type,
          position: index, // Use array index as position
        };

        // Handle different section types
        switch (section.type) {
          case "banner":
            if (section.imageUrl) {
              // Handle image path processing
              processedSection.imageUrl = section.imageUrl.startsWith(
                "/uploads/"
              )
                ? section.imageUrl
                : `/uploads/site-builder/${section.imageUrl}`;
            }
            break;

          case "collection":
            if (section.collection_id) {
              processedSection.collection_id = section.collection_id;
            }
            break;

          case "products":
            if (section.product_ids && Array.isArray(section.product_ids)) {
              processedSection.product_ids = section.product_ids;
            }
            break;

          case "text":
            processedSection.title = section.title || "";
            processedSection.content = section.content || "";
            break;

          case "gallery":
            if (section.images && Array.isArray(section.images)) {
              processedSection.images = section.images.map((img) =>
                img.startsWith("/uploads/")
                  ? img
                  : `/uploads/site-builder/${img}`
              );
            }
            break;
        }

        // Add styling if provided
        if (section.styling) {
          processedSection.styling = section.styling;
        }

        return processedSection;
      });

      siteBuilder.sections = processedSections;
    }

    // Process hot products
    if (hot_products && Array.isArray(hot_products)) {
      const processedHotProducts = [];

      for (let i = 0; i < hot_products.length; i++) {
        const hotProduct = hot_products[i];

        // Extract product ID from the product object
        let productId = null;
        if (hotProduct.id) {
          productId = hotProduct.id;
        } else if (hotProduct._id) {
          productId = hotProduct._id;
        } else if (hotProduct.product_id) {
          productId = hotProduct.product_id;
        }

        if (productId) {
          // Verify product exists and belongs to supplier
          const product = await Product.findOne({
            _id: productId,
            supplier_id: userId,
          });

          if (product) {
            processedHotProducts.push({
              product_id: productId,
              position: i,
            });
          } else {
            console.warn(
              `Product ${productId} not found or doesn't belong to supplier`
            );
          }
        }
      }

      siteBuilder.hot_products = processedHotProducts;
    }

    // Process hero banners
    if (hero_banners && Array.isArray(hero_banners)) {
      const processedHeroBanners = hero_banners.map((banner, index) => {
        let imagePath =
          banner.path || banner.relativePath || banner.image_path || "";

        // Process image path
        if (imagePath && !imagePath.startsWith("/uploads/")) {
          imagePath = `/uploads/site-builder/${imagePath.replace("./", "")}`;
        }

        return {
          image_path: imagePath,
          title: banner.title || "",
          subtitle: banner.subtitle || "",
          button_text: banner.button_text || "",
          button_link: banner.button_link || "",
          position: index,
        };
      });

      siteBuilder.hero_banners = processedHeroBanners;
    }

    // Update other fields
    if (about_us !== undefined) {
      siteBuilder.about_us = about_us;
    }

    if (theme) {
      siteBuilder.theme = {
        ...siteBuilder.theme,
        ...theme,
      };
    }

    if (seo) {
      siteBuilder.seo = {
        ...siteBuilder.seo,
        ...seo,
      };
    }

    if (social_links) {
      siteBuilder.social_links = {
        ...siteBuilder.social_links,
        ...social_links,
      };
    }

    if (is_published !== undefined) {
      siteBuilder.is_published = is_published;
    }

    await siteBuilder.save();

    console.log("Site builder configuration updated successfully");

    const responseData = {
      message: "Site builder configuration updated successfully",
      site_builder_id: siteBuilder._id,
      is_published: siteBuilder.is_published,
    };

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Site builder update error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get supplier site builder configuration
// @route   GET /supplier/site_builder
// @access  Private (Supplier Only)
exports.getSiteBuilder = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log("Getting site builder configuration for user:", userId);

    // Find site builder configuration with populated data
    let siteBuilder = await SupplierSiteBuilder.findOne({
      supplier_id: userId,
    })
      .populate({
        path: "sections.collection_id",
        select: "title description collection_images url_handle status",
        populate: {
          path: "product_list",
          select:
            "title price media url_handle status category description compare_at_price",
          match: { status: "active" },
          options: { limit: 10 },
        },
      })
      .populate({
        path: "sections.product_ids",
        select:
          "title price media url_handle status category description compare_at_price",
        match: { status: "active" },
      })
      .populate({
        path: "hot_products.product_id",
        select:
          "title price media url_handle status category description compare_at_price supplier_id variants weight units region address search_vendor search_collection search_tags page_title meta_description quantity min_qty cost_per_item profit margin tax physical_product track_quantity variant_option continue_out_of_stock createdAt updatedAt",
        match: { status: "active" },
      });

    if (!siteBuilder) {
      // Create default configuration
      siteBuilder = await SupplierSiteBuilder.create({
        supplier_id: userId,
        sections: [],
        hot_products: [],
        about_us: "",
        hero_banners: [],
        theme: {
          primary_color: "#007bff",
          secondary_color: "#6c757d",
          font_family: "Arial, sans-serif",
          layout_style: "modern",
        },
        is_published: false,
      });
    }

    // Sort sections, hot products, and hero banners by position
    siteBuilder.sortSectionsByPosition();
    siteBuilder.sortHotProductsByPosition();
    siteBuilder.sortHeroBannersByPosition();

    // Process populated hot products to include vendor information
    const processedHotProducts = [];
    for (const hotProduct of siteBuilder.hot_products) {
      if (hotProduct.product_id) {
        const product = hotProduct.product_id.toObject();

        // Add vendor name if search_vendor exists
        if (product.search_vendor) {
          try {
            const Vendor = require("../models/Vendor");
            const vendor = await Vendor.findById(product.search_vendor);
            if (vendor) {
              product.vendor_name = vendor.vendor_name;
            }
          } catch (vendorError) {
            console.warn("Error fetching vendor:", vendorError);
            product.vendor_name = "";
          }
        }

        // Add id field for compatibility
        product.id = product._id;

        processedHotProducts.push(product);
      }
    }

    // Process sections to ensure collections have proper product data
    const processedSections = siteBuilder.sections.map((section) => {
      const sectionObj = section.toObject();

      if (section.type === "collection" && section.collection_id) {
        const collection = section.collection_id.toObject();

        // Ensure product_list is properly formatted
        if (collection.product_list) {
          collection.products = collection.product_list.map((product) => ({
            ...product,
            id: product._id,
          }));
          delete collection.product_list;
        }

        sectionObj.collection_data = collection;
        delete sectionObj.collection_id;
      }

      if (section.type === "products" && section.product_ids) {
        sectionObj.products_data = section.product_ids.map((product) => ({
          ...product.toObject(),
          id: product._id,
        }));
        delete sectionObj.product_ids;
      }

      return sectionObj;
    });

    const responseData = {
      message: "Site builder configuration retrieved successfully",
      site_data: {
        sections: processedSections,
        hot_products: processedHotProducts,
        about_us: siteBuilder.about_us,
        hero_banners: siteBuilder.hero_banners,
        theme: siteBuilder.theme,
        seo: siteBuilder.seo,
        social_links: siteBuilder.social_links,
        is_published: siteBuilder.is_published,
        created_at: siteBuilder.createdAt,
        updated_at: siteBuilder.updatedAt,
      },
    };

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Get site builder error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get public site builder configuration (for public store view)
// @route   GET /public/supplier/:supplierIdentifier/store
// @access  Public
exports.getPublicStore = async (req, res) => {
  try {
    const { supplierIdentifier } = req.params;

    console.log("Getting public store for supplier:", supplierIdentifier);

    // First, determine if supplierIdentifier is an ObjectId or username
    let supplierId;

    // Check if it's a valid ObjectId (24 hex characters)
    const mongoose = require("mongoose");
    if (
      mongoose.Types.ObjectId.isValid(supplierIdentifier) &&
      supplierIdentifier.length === 24
    ) {
      supplierId = supplierIdentifier;
    } else {
      // It's a username, find the user first
      const User = require("../models/User");

      const supplier = await User.findOne({
        username: supplierIdentifier,
        accessRoles: { $in: ["supplier"] }, // Check if supplier is in accessRoles
      }).select("_id username");

      if (!supplier) {
        return res.status(404).json({
          error: "Supplier not found with the provided username",
        });
      }

      supplierId = supplier._id;
      console.log(
        `Found supplier ID ${supplierId} for username: ${supplierIdentifier}`
      );
    }

    // Find published site builder configuration
    const siteBuilder = await SupplierSiteBuilder.findOne({
      supplier_id: supplierId,
      is_published: true,
    })
      .populate({
        path: "sections.collection_id",
        select: "title description collection_images url_handle",
        populate: {
          path: "product_list",
          select:
            "title price media url_handle category description compare_at_price",
          match: { status: "active" },
          options: { limit: 20 },
        },
      })
      .populate({
        path: "sections.product_ids",
        select:
          "title price media url_handle category description compare_at_price",
        match: { status: "active" },
      })
      .populate({
        path: "hot_products.product_id",
        select:
          "title price media url_handle category description compare_at_price",
        match: { status: "active" },
      })
      .populate({
        path: "supplier_id",
        select: "username email",
      });

    if (!siteBuilder) {
      return res.status(404).json({
        error: "Store not found or not published for this supplier",
      });
    }

    // Sort by position
    siteBuilder.sortSectionsByPosition();
    siteBuilder.sortHotProductsByPosition();
    siteBuilder.sortHeroBannersByPosition();

    // Get supplier information
    const supplierInfo = siteBuilder.supplier_id;

    // Process for public view (remove sensitive data)
    const publicData = {
      store_info: {
        supplier_id: supplierId,
        supplier_name: supplierInfo.username,
        supplier_email: supplierInfo.email,
      },
      sections: siteBuilder.sections.map((section) => {
        const sectionObj = section.toObject();

        if (section.type === "collection" && section.collection_id) {
          sectionObj.collection_data = section.collection_id.toObject();
          delete sectionObj.collection_id;
        }

        if (section.type === "products" && section.product_ids) {
          sectionObj.products_data = section.product_ids.map((product) =>
            product.toObject()
          );
          delete sectionObj.product_ids;
        }

        return sectionObj;
      }),
      hot_products: siteBuilder.hot_products
        .map((hp) => (hp.product_id ? hp.product_id.toObject() : null))
        .filter(Boolean),
      about_us: siteBuilder.about_us,
      hero_banners: siteBuilder.hero_banners,
      theme: siteBuilder.theme,
      social_links: siteBuilder.social_links,
    };

    res.status(200).json({
      message: "Store retrieved successfully",
      store: publicData,
    });
  } catch (err) {
    console.error("Get public store error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Publish/Unpublish store
// @route   POST /supplier/site_builder/publish
// @access  Private (Supplier Only)
exports.toggleStorePublish = async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_published } = req.body;

    const siteBuilder = await SupplierSiteBuilder.findOne({
      supplier_id: userId,
    });

    if (!siteBuilder) {
      return res
        .status(404)
        .json({ error: "Site builder configuration not found" });
    }

    siteBuilder.is_published = is_published;
    await siteBuilder.save();

    const responseData = {
      message: `Store ${
        is_published ? "published" : "unpublished"
      } successfully`,
      is_published: siteBuilder.is_published,
    };

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Toggle store publish error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
