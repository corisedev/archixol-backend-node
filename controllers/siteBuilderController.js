// controllers/siteBuilderController.js - UPDATED VERSION
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

    console.log("=== SITE BUILDER UPDATE CONTROLLER (FINAL FIXED) ===");
    console.log("User ID:", userId);
    console.log("Request body keys:", Object.keys(req.body));
    console.log("Sections received:", sections?.length || 0);
    console.log("Hero banners received:", hero_banners?.length || 0);
    console.log("Hot products received:", hot_products?.length || 0);
    console.log("About us:", about_us || "");

    // Find or create site builder configuration
    let siteBuilder = await SupplierSiteBuilder.findOne({
      supplier_id: userId,
    });

    if (!siteBuilder) {
      siteBuilder = new SupplierSiteBuilder({ supplier_id: userId });
      console.log("Created new site builder configuration");
    } else {
      console.log("Found existing site builder configuration");
    }

    // Process sections - CRITICAL: Validate and process all sections
    if (sections && Array.isArray(sections) && sections.length > 0) {
      console.log("Processing sections...");
      const processedSections = [];

      for (let index = 0; index < sections.length; index++) {
        const section = sections[index];
        console.log(`Processing section ${index}:`, section);

        if (!section.type) {
          console.warn(`Section ${index} missing type, skipping`);
          continue;
        }

        const processedSection = {
          type: section.type,
          position: index,
        };

        switch (section.type) {
          case "banner":
            if (section.imageUrl) {
              processedSection.imageUrl = section.imageUrl.startsWith(
                "/uploads/"
              )
                ? section.imageUrl
                : `/uploads/site-builder/${section.imageUrl.replace("./", "")}`;
              console.log(
                `Banner section ${index} imageUrl:`,
                processedSection.imageUrl
              );
            }

            if (section.title) {
              processedSection.title = section.title;
            }
            if (section.content) {
              processedSection.content = section.content;
            }
            break;

          case "collection":
            if (section.collection_id) {
              // Validate that the collection exists and belongs to the supplier
              try {
                const collection = await Collection.findOne({
                  _id: section.collection_id,
                  supplier_id: userId,
                  status: "active",
                }).populate({
                  path: "product_list",
                  match: { status: "active" },
                  select:
                    "title price media url_handle status category description compare_at_price",
                });

                if (collection) {
                  processedSection.collection_id = section.collection_id;
                  console.log(
                    `✅ Validated collection section ${index} - Collection ID: ${section.collection_id}`
                  );
                  console.log(
                    `   Collection: "${collection.title}" with ${
                      collection.product_list?.length || 0
                    } products`
                  );
                } else {
                  console.warn(
                    `❌ Collection ${section.collection_id} not found or doesn't belong to supplier`
                  );
                  continue;
                }
              } catch (error) {
                console.error(
                  `Error validating collection ${section.collection_id}:`,
                  error
                );
                continue;
              }
            } else {
              console.warn(`Collection section ${index} missing collection_id`);
              continue;
            }
            break;

          case "products":
            if (section.product_ids && Array.isArray(section.product_ids)) {
              // Validate that all products exist and belong to the supplier
              try {
                const validProductIds = [];
                for (const productId of section.product_ids) {
                  const product = await Product.findOne({
                    _id: productId,
                    supplier_id: userId,
                    status: "active",
                  });
                  if (product) {
                    validProductIds.push(productId);
                  } else {
                    console.warn(
                      `Product ${productId} not found or doesn't belong to supplier`
                    );
                  }
                }

                if (validProductIds.length > 0) {
                  processedSection.product_ids = validProductIds;
                  console.log(
                    `✅ Products section ${index} - Valid products: ${validProductIds.length}/${section.product_ids.length}`
                  );
                } else {
                  console.warn(`No valid products found for section ${index}`);
                  continue;
                }
              } catch (error) {
                console.error(
                  `Error validating products for section ${index}:`,
                  error
                );
                continue;
              }
            }
            break;

          case "text":
            processedSection.title = section.title || "";
            processedSection.content = section.content || "";
            console.log(`✅ Text section ${index}:`, {
              title: section.title,
              content: section.content,
            });
            break;

          case "gallery":
            if (section.images && Array.isArray(section.images)) {
              processedSection.images = section.images.map((img) =>
                img.startsWith("/uploads/")
                  ? img
                  : `/uploads/site-builder/${img.replace("./", "")}`
              );
              console.log(
                `✅ Gallery section ${index} images:`,
                processedSection.images
              );
            } else {
              processedSection.images = [];
            }
            break;

          default:
            console.warn(`Unknown section type: ${section.type}`);
            continue;
        }

        // Add styling if provided
        if (section.styling) {
          processedSection.styling = section.styling;
        }

        processedSections.push(processedSection);
        console.log(
          `✅ Successfully processed section ${index}:`,
          processedSection
        );
      }

      siteBuilder.sections = processedSections;
      console.log(
        `✅ Final processed sections count: ${processedSections.length}`
      );
    } else {
      console.log("ℹ️  No sections to process or sections array is empty");
      // Only clear sections if explicitly set to empty array
      if (sections && Array.isArray(sections) && sections.length === 0) {
        siteBuilder.sections = [];
        console.log("🗑️  Clearing existing sections");
      }
    }

    // Process hot products with validation
    if (hot_products && Array.isArray(hot_products)) {
      console.log("Processing hot products...");
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
          try {
            const product = await Product.findOne({
              _id: productId,
              supplier_id: userId,
              status: "active",
            });

            if (product) {
              processedHotProducts.push({
                product_id: productId,
                position: i,
              });
              console.log(
                `✅ Added hot product ${i}: ${product.title} (${productId})`
              );
            } else {
              console.warn(
                `❌ Product ${productId} not found or doesn't belong to supplier`
              );
            }
          } catch (error) {
            console.error(`Error validating hot product ${productId}:`, error);
          }
        } else {
          console.warn(`Hot product ${i} missing valid product ID`);
        }
      }

      siteBuilder.hot_products = processedHotProducts;
      console.log(
        `✅ Processed hot products count: ${processedHotProducts.length}`
      );
    }

    // Process hero banners
    if (hero_banners && Array.isArray(hero_banners)) {
      console.log("Processing hero banners...");
      const processedHeroBanners = hero_banners.map((banner, index) => {
        let imagePath = "";

        // Priority order for image path
        if (banner.image_path) {
          imagePath = banner.image_path;
        } else if (banner.path) {
          imagePath = banner.path;
        } else if (banner.relativePath) {
          imagePath = banner.relativePath;
        }

        // Ensure proper path format
        if (imagePath && !imagePath.startsWith("/uploads/")) {
          imagePath = `/uploads/site-builder/${imagePath.replace("./", "")}`;
        }

        console.log(`✅ Hero banner ${index} final path: ${imagePath}`);

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
      console.log(
        `✅ Processed hero banners count: ${processedHeroBanners.length}`
      );
    }

    // Update other fields
    if (about_us !== undefined) {
      siteBuilder.about_us = about_us;
      console.log("✅ Updated about_us:", about_us);
    }

    if (theme) {
      siteBuilder.theme = {
        ...siteBuilder.theme,
        ...theme,
      };
      console.log("✅ Updated theme");
    }

    if (seo) {
      siteBuilder.seo = {
        ...siteBuilder.seo,
        ...seo,
      };
      console.log("✅ Updated SEO");
    }

    if (social_links) {
      siteBuilder.social_links = {
        ...siteBuilder.social_links,
        ...social_links,
      };
      console.log("✅ Updated social links");
    }

    if (is_published !== undefined) {
      siteBuilder.is_published = is_published;
      console.log("✅ Updated publish status:", is_published);
    }

    // Log what we're about to save
    console.log("=== 💾 ABOUT TO SAVE ===");
    console.log(
      "Final siteBuilder sections:",
      siteBuilder.sections?.length || 0
    );
    console.log(
      "Final siteBuilder hero_banners:",
      siteBuilder.hero_banners?.length || 0
    );
    console.log(
      "Final siteBuilder hot_products:",
      siteBuilder.hot_products?.length || 0
    );
    console.log(
      "Final siteBuilder about_us length:",
      siteBuilder.about_us?.length || 0
    );

    // Save the site builder configuration
    const savedSiteBuilder = await siteBuilder.save();

    console.log("=== ✅ SITE BUILDER SAVED SUCCESSFULLY ===");
    console.log(
      "💾 Saved sections count:",
      savedSiteBuilder.sections?.length || 0
    );
    console.log(
      "💾 Saved hero banners count:",
      savedSiteBuilder.hero_banners?.length || 0
    );
    console.log(
      "💾 Saved hot products count:",
      savedSiteBuilder.hot_products?.length || 0
    );

    // Verify the save by fetching the record again
    const verification = await SupplierSiteBuilder.findOne({
      supplier_id: userId,
    });
    console.log("=== 🔍 VERIFICATION ===");
    console.log(
      "✅ Verified sections count:",
      verification.sections?.length || 0
    );
    console.log(
      "✅ Verified hero banners count:",
      verification.hero_banners?.length || 0
    );
    console.log(
      "✅ Verified hot products count:",
      verification.hot_products?.length || 0
    );

    // If sections were supposed to be saved but weren't, log detailed info
    if (sections && sections.length > 0 && verification.sections.length === 0) {
      console.error("❌ SECTIONS SAVE FAILED!");
      console.error("Original sections:", JSON.stringify(sections, null, 2));
      console.error(
        "Processed sections:",
        JSON.stringify(siteBuilder.sections, null, 2)
      );
    }

    const responseData = {
      message: "Site builder configuration updated successfully",
      site_builder_id: savedSiteBuilder._id,
      is_published: savedSiteBuilder.is_published,
      hero_banners_count: savedSiteBuilder.hero_banners?.length || 0,
      sections_count: savedSiteBuilder.sections?.length || 0,
      hot_products_count: savedSiteBuilder.hot_products?.length || 0,
    };

    res.status(200).json(responseData);
  } catch (err) {
    console.error("=== ❌ SITE BUILDER UPDATE ERROR ===");
    console.error("Error details:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ error: "Server error: " + err.message });
  }
};

// Rest of the controller methods remain the same...
// (getSiteBuilder, getPublicStore, toggleStorePublish)

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
