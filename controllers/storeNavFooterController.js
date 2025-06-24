const SupplierSiteBuilder = require("../models/SupplierSiteBuilder");
const Collection = require("../models/Collection");
const User = require("../models/User");
const {
  StoreDetails,
  ContactInfo,
  PolicyContent,
} = require("../models/SupplierSettings");

// @desc    Get supplier store navigation and footer data
// @route   GET /public/supplier/:store_name/navbar_footer
// @access  Public
exports.getStoreNavFooter = async (req, res) => {
  try {
    const { store_name } = req.params;

    console.log("Getting navbar/footer data for store:", store_name);

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

    // Get all active collections for this supplier
    const collections = await Collection.find({
      supplier_id: supplierId,
      status: "active",
    })
      .select("_id title description meta_description")
      .sort({ title: 1 });

    // Format collections for response
    const formattedCollections = collections.map((collection) => ({
      collection_id: collection._id,
      title: collection.title,
      meta_description:
        collection.meta_description || collection.description || "",
    }));

    // Get store details for currency and store name
    const storeDetailsData =
      storeDetails ||
      (await StoreDetails.findOne({
        supplier_id: supplierId,
      }));

    // Get contact information
    const contactInfo = await ContactInfo.findOne({
      supplier_id: supplierId,
    });

    // Get policy content to check which policies exist
    const policyContent = await PolicyContent.findOne({
      supplier_id: supplierId,
    });

    // Prepare navbar data
    const navbar = {
      collections: formattedCollections,
      store_name: storeDetailsData?.store_name || supplier.username || "Store",
      store_currency: storeDetailsData?.display_currency || "USD",
      store_logo: storeDetailsData?.logo || null,
    };

    // Prepare footer data
    const footer = {
      about_us: siteBuilder.about_us || "",
      collections: formattedCollections, // Same collections as navbar
      contact_us: {
        email: contactInfo?.email || supplier.email || "",
        phone_number: contactInfo?.phone_number || "",
      },
      privacy_policy: !!(
        policyContent?.privacy_policy &&
        policyContent.privacy_policy.trim() !== ""
      ),
      refund_policy: !!(
        policyContent?.return_and_refund &&
        policyContent.return_and_refund.trim() !== ""
      ),
      shipping_policy: !!(
        policyContent?.shipping_policy &&
        policyContent.shipping_policy.trim() !== ""
      ),
      terms_of_services: !!(
        policyContent?.terms_of_services &&
        policyContent.terms_of_services.trim() !== ""
      ),
      store_logo: storeDetailsData?.logo || null,
      store_name: storeDetailsData?.store_name || supplier.username || "Store",
    };

    const responseData = {
      message: "Store navigation and footer data retrieved successfully",
      navbar,
      footer,
    };

    console.log(
      `Successfully retrieved navbar/footer data for store: ${store_name}`
    );
    console.log(`Collections count: ${formattedCollections.length}`);

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Get store navbar/footer error:", err);
    res.status(500).json({
      error: "Server error while retrieving store data",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
