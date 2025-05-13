// controllers/settingsController.js
const {
  StoreDetails,
  TaxDetails,
  ProductTax,
  ReturnRules,
  PolicyContent,
  CheckoutSettings,
  ContactInfo,
  SupplierProfile,
} = require("../models/SupplierSettings");
const Product = require("../models/Product");
const { encryptData } = require("../utils/encryptResponse");
const sendEmail = require("../utils/email");
const crypto = require("crypto");

// Store Details APIs
// @desc    Get store details
// @route   GET /supplier/store_details
// @access  Private (Supplier Only)
exports.getStoreDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get or create store details
    let storeDetails = await StoreDetails.findOne({ supplier_id: userId });

    if (!storeDetails) {
      storeDetails = await StoreDetails.create({ supplier_id: userId });
    }

    const responseData = {
      message: "Store details retrieved successfully",
      store_data: {
        logo: storeDetails.logo || "",
        store_name: storeDetails.store_name || "",
        phone_number: storeDetails.phone_number || "",
        email: storeDetails.email || "",
        address: storeDetails.address || "",
        display_currency: storeDetails.display_currency || "USD",
        unit_system: storeDetails.unit_system || "metric",
        weight_unit: storeDetails.weight_unit || "kg",
        time_zone: storeDetails.time_zone || "UTC",
        prefix: storeDetails.prefix || "",
        suffix: storeDetails.suffix || "",
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update store details
// @route   POST /supplier/store_details
// @access  Private (Supplier Only)
exports.updateStoreDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      logo,
      store_name,
      phone_number,
      email,
      address,
      display_currency,
      unit_system,
      weight_unit,
      time_zone,
      prefix,
      suffix,
    } = req.body;

    // Find or create store details
    let storeDetails = await StoreDetails.findOne({ supplier_id: userId });

    if (!storeDetails) {
      storeDetails = new StoreDetails({ supplier_id: userId });
    }

    // Update fields
    if (logo !== undefined) storeDetails.logo = logo;
    if (store_name !== undefined) storeDetails.store_name = store_name;
    if (phone_number !== undefined) storeDetails.phone_number = phone_number;
    if (email !== undefined) storeDetails.email = email;
    if (address !== undefined) storeDetails.address = address;
    if (display_currency !== undefined)
      storeDetails.display_currency = display_currency;
    if (unit_system !== undefined) storeDetails.unit_system = unit_system;
    if (weight_unit !== undefined) storeDetails.weight_unit = weight_unit;
    if (time_zone !== undefined) storeDetails.time_zone = time_zone;
    if (prefix !== undefined) storeDetails.prefix = prefix;
    if (suffix !== undefined) storeDetails.suffix = suffix;

    await storeDetails.save();

    const responseData = {
      message: "Store details updated successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Tax Details APIs
// @desc    Get tax details
// @route   GET /supplier/tax_details
// @access  Private (Supplier Only)
exports.getTaxDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get or create tax details
    let taxDetails = await TaxDetails.findOne({ supplier_id: userId });

    if (!taxDetails) {
      taxDetails = await TaxDetails.create({ supplier_id: userId });
    }

    // Get all products belonging to this supplier
    const products = await Product.find({ supplier_id: userId });

    // Get products with custom tax
    const productTaxes = await ProductTax.find({ supplier_id: userId });

    // Create a map for quick lookup of custom taxes
    const customTaxMap = {};
    for (const pt of productTaxes) {
      customTaxMap[pt.product_id.toString()] = pt.custom_tax;
    }

    // Format all products with their tax rates
    const taxProducts = [];
    for (const product of products) {
      const productId = product._id.toString();

      // Get the tax rate for this product (custom or default)
      const taxRate =
        customTaxMap[productId] ||
        (taxDetails.is_auto_apply_tax ? taxDetails.default_tax_rate : "");

      // Only include products that have a tax rate
      if (taxRate) {
        taxProducts.push({
          product_id: product._id,
          title: product.title,
          tax_rate: taxRate,
          category: product.category,
          is_custom: customTaxMap[productId] ? true : false,
        });
      }
    }

    const responseData = {
      message: "Tax details retrieved successfully",
      tax_data: {
        is_auto_apply_tax: taxDetails.is_auto_apply_tax || false,
        default_tax_rate: taxDetails.default_tax_rate || "",
        reg_number: taxDetails.reg_number || "",
      },
      tax_products: taxProducts,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update tax details
// @route   POST /supplier/tax_details
// @access  Private (Supplier Only)
exports.updateTaxDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_auto_apply_tax, default_tax_rate, reg_number } = req.body;

    // Find or create tax details
    let taxDetails = await TaxDetails.findOne({ supplier_id: userId });

    if (!taxDetails) {
      taxDetails = await new TaxDetails({ supplier_id: userId });
    }

    // Update fields
    if (is_auto_apply_tax !== undefined)
      taxDetails.is_auto_apply_tax = is_auto_apply_tax;
    if (default_tax_rate !== undefined)
      taxDetails.default_tax_rate = default_tax_rate;
    if (reg_number !== undefined) taxDetails.reg_number = reg_number;

    await taxDetails.save();

    // If auto-apply tax is enabled, apply the default tax rate to all products
    if (is_auto_apply_tax && default_tax_rate) {
      // Get all products belonging to this supplier
      const products = await Product.find({ supplier_id: userId });

      // For each product, update or create tax entry with default tax rate
      for (const product of products) {
        // Check if product has a custom tax
        const existingCustomTax = await ProductTax.findOne({
          supplier_id: userId,
          product_id: product._id,
        });

        if (existingCustomTax) {
          // Update existing tax entry with the new default tax rate
          existingCustomTax.custom_tax = default_tax_rate;
          await existingCustomTax.save();
        } else {
          // Create new tax entry with the default tax rate
          await ProductTax.create({
            supplier_id: userId,
            product_id: product._id,
            custom_tax: default_tax_rate,
          });
        }
      }
    }

    const responseData = {
      message: "Tax details updated successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Apply custom tax to product
// @route   POST /supplier/apply_custom_tax
// @access  Private (Supplier Only)
exports.applyCustomTax = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, custom_tax } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    if (!custom_tax) {
      return res.status(400).json({ error: "Custom tax rate is required" });
    }

    // Check if product exists and belongs to supplier
    const product = await Product.findOne({
      _id: product_id,
      supplier_id: userId,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Find or create product tax
    let productTax = await ProductTax.findOne({
      supplier_id: userId,
      product_id,
    });

    if (!productTax) {
      productTax = new ProductTax({
        supplier_id: userId,
        product_id,
        custom_tax,
      });
    } else {
      productTax.custom_tax = custom_tax;
    }

    await productTax.save();

    const responseData = {
      message: "Custom tax applied successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update return rules
// @route   POST /supplier/return_rules
// @access  Private (Supplier Only)
exports.updateReturnRules = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      return_window,
      no_of_custom_days,
      return_shipping_cost,
      flat_rate,
      restocking_fee,
      final_sale_items,
      sale_items,
    } = req.body;

    // Find or create return rules
    let returnRules = await ReturnRules.findOne({ supplier_id: userId });

    if (!returnRules) {
      returnRules = new ReturnRules({ supplier_id: userId });
    }

    // Update fields
    if (return_window !== undefined) returnRules.return_window = return_window;
    if (no_of_custom_days !== undefined)
      returnRules.no_of_custom_days = no_of_custom_days;
    if (return_shipping_cost !== undefined)
      returnRules.return_shipping_cost = return_shipping_cost;
    if (flat_rate !== undefined) returnRules.flat_rate = flat_rate;
    if (restocking_fee !== undefined)
      returnRules.restocking_fee = restocking_fee;
    if (final_sale_items !== undefined)
      returnRules.final_sale_items = final_sale_items;

    // Extract just the product IDs from the sale_items objects
    if (sale_items !== undefined) {
      if (Array.isArray(sale_items)) {
        // Extract just the product IDs from the product objects
        const productIds = sale_items
          .map((item) => {
            // Check if item is a string (already an ID) or an object with an id field
            if (typeof item === "string") {
              return item;
            } else if (item && item.id) {
              return item.id;
            } else if (item && item._id) {
              return item._id;
            }
            return null;
          })
          .filter((id) => id !== null); // Filter out any null values

        returnRules.sale_items = productIds;
      } else {
        // If it's not an array, log an error and don't update this field
        console.error("sale_items is not an array:", sale_items);
      }
    }

    await returnRules.save();

    const responseData = {
      message: "Return rules updated successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update return rules status
// @route   POST /supplier/return_rules_status
// @access  Private (Supplier Only)
exports.updateReturnRulesStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.body;

    if (status === undefined) {
      return res.status(400).json({ error: "Status is required" });
    }

    // Find or create return rules
    let returnRules = await ReturnRules.findOne({ supplier_id: userId });

    if (!returnRules) {
      returnRules = new ReturnRules({
        supplier_id: userId,
        is_enabled: status,
      });
    } else {
      returnRules.is_enabled = status;
    }

    await returnRules.save();

    const responseData = {
      message: `Return rules ${status ? "enabled" : "disabled"} successfully`,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Policy Content APIs
// @desc    Update return and refund policy
// @route   POST /supplier/return_and_refund
// @access  Private (Supplier Only)
exports.updateReturnRefundPolicy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    // Find or create policy content
    let policyContent = await PolicyContent.findOne({ supplier_id: userId });

    if (!policyContent) {
      policyContent = new PolicyContent({
        supplier_id: userId,
        return_and_refund: content,
      });
    } else {
      policyContent.return_and_refund = content;
    }

    await policyContent.save();

    const responseData = {
      message: "Return and refund policy updated successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get return and refund policy
// @route   GET /supplier/return_and_refund
// @access  Private (Supplier Only)
exports.getReturnRefundPolicy = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get or create policy content
    let policyContent = await PolicyContent.findOne({ supplier_id: userId });

    if (!policyContent) {
      policyContent = await PolicyContent.create({ supplier_id: userId });
    }

    const responseData = {
      message: "Return and refund policy retrieved successfully",
      content: policyContent.return_and_refund || "",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update privacy policy
// @route   POST /supplier/privacy_policy
// @access  Private (Supplier Only)
exports.updatePrivacyPolicy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    // Find or create policy content
    let policyContent = await PolicyContent.findOne({ supplier_id: userId });

    if (!policyContent) {
      policyContent = new PolicyContent({
        supplier_id: userId,
        privacy_policy: content,
      });
    } else {
      policyContent.privacy_policy = content;
    }

    await policyContent.save();

    const responseData = {
      message: "Privacy policy updated successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get privacy policy
// @route   GET /supplier/privacy_policy
// @access  Private (Supplier Only)
exports.getPrivacyPolicy = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get or create policy content
    let policyContent = await PolicyContent.findOne({ supplier_id: userId });

    if (!policyContent) {
      policyContent = await PolicyContent.create({ supplier_id: userId });
    }

    const responseData = {
      message: "Privacy policy retrieved successfully",
      content: policyContent.privacy_policy || "",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update terms of service
// @route   POST /supplier/terms_of_services
// @access  Private (Supplier Only)
exports.updateTermsOfService = async (req, res) => {
  try {
    const userId = req.user.id;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    // Find or create policy content
    let policyContent = await PolicyContent.findOne({ supplier_id: userId });

    if (!policyContent) {
      policyContent = new PolicyContent({
        supplier_id: userId,
        terms_of_services: content,
      });
    } else {
      policyContent.terms_of_services = content;
    }

    await policyContent.save();

    const responseData = {
      message: "Terms of service updated successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get terms of service
// @route   GET /supplier/terms_of_services
// @access  Private (Supplier Only)
exports.getTermsOfService = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get or create policy content
    let policyContent = await PolicyContent.findOne({ supplier_id: userId });

    if (!policyContent) {
      policyContent = await PolicyContent.create({ supplier_id: userId });
    }

    const responseData = {
      message: "Terms of service retrieved successfully",
      content: policyContent.terms_of_services || "",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update shipping policy
// @route   POST /supplier/shipping_policy
// @access  Private (Supplier Only)
exports.updateShippingPolicy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    // Find or create policy content
    let policyContent = await PolicyContent.findOne({ supplier_id: userId });

    if (!policyContent) {
      policyContent = new PolicyContent({
        supplier_id: userId,
        shipping_policy: content,
      });
    } else {
      policyContent.shipping_policy = content;
    }

    await policyContent.save();

    const responseData = {
      message: "Shipping policy updated successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get shipping policy
// @route   GET /supplier/shipping_policy
// @access  Private (Supplier Only)
exports.getShippingPolicy = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get or create policy content
    let policyContent = await PolicyContent.findOne({ supplier_id: userId });

    if (!policyContent) {
      policyContent = await PolicyContent.create({ supplier_id: userId });
    }

    const responseData = {
      message: "Shipping policy retrieved successfully",
      content: policyContent.shipping_policy || "",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// controllers/settingsController.js (continued)

// @desc    Get all policies
// @route   GET /supplier/policies
// @access  Private (Supplier Only)
exports.getAllPolicies = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all policy-related settings
    const policyContent =
      (await PolicyContent.findOne({ supplier_id: userId })) ||
      new PolicyContent({ supplier_id: userId });

    // Find and populate return rules with product details for sale_items
    const returnRules = await ReturnRules.findOne({
      supplier_id: userId,
    }).populate({
      path: "sale_items",
      model: "Product",
      select:
        "title url_handle description category media price compare_at_price tax status id",
    });

    if (!returnRules) {
      returnRules = new ReturnRules({ supplier_id: userId });
    }

    // Find contact info
    const contactInfo = await ContactInfo.findOne({ supplier_id: userId });
    const isEmpty = Object.keys(contactInfo).length === 0;

    // Transform sale_items to include necessary product details
    const populatedSaleItems = returnRules.sale_items
      ? returnRules.sale_items.map((product) => ({
          id: product._id || product.id,
          title: product.title || "",
          url_handle: product.url_handle || "",
          description: product.description || "",
          category: product.category || "",
          media: product.media || [],
          price: product.price || 0,
          compare_at_price: product.compare_at_price || 0,
          tax: product.tax || false,
          status: product.status || "active",
        }))
      : [];

    const responseData = {
      message: "Policy settings retrieved successfully",
      rules: {
        return_rules: {
          is_enabled: returnRules.is_enabled || false,
          return_window: returnRules.return_window || "14",
          no_of_custom_days: returnRules.no_of_custom_days || "",
          return_shipping_cost:
            returnRules.return_shipping_cost || "return_shipping_by_customer",
          flat_rate: returnRules.flat_rate || "",
          restocking_fee: returnRules.restocking_fee || false,
          final_sale_items: returnRules.final_sale_items || "none",
          sale_items: populatedSaleItems,
        },
        policies: {
          return_and_refund: policyContent.return_and_refund ? true : false,
          privacy_policy: policyContent.privacy_policy ? true : false,
          terms_of_services: policyContent.terms_of_services ? true : false,
          shipping_policy: policyContent.shipping_policy ? true : false,
          contact_info: !isEmpty ? true : false,
        },
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Checkout Settings APIs
// @desc    Update checkout settings
// @route   POST /supplier/checkout_settings
// @access  Private (Supplier Only)
exports.updateCheckoutSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      address_line,
      company_name,
      fullname,
      is_custom_tip,
      is_tipping_checkout,
      shipping_address_phone_number,
      tip_fixed_amount,
      tip_percentage,
      tip_type,
    } = req.body;

    // Find or create checkout settings
    let checkoutSettings = await CheckoutSettings.findOne({
      supplier_id: userId,
    });

    if (!checkoutSettings) {
      checkoutSettings = new CheckoutSettings({ supplier_id: userId });
    }

    // Update fields
    if (address_line !== undefined)
      checkoutSettings.address_line = address_line;
    if (company_name !== undefined)
      checkoutSettings.company_name = company_name;
    if (fullname !== undefined) checkoutSettings.fullname = fullname;
    if (is_custom_tip !== undefined)
      checkoutSettings.is_custom_tip = is_custom_tip;
    if (is_tipping_checkout !== undefined)
      checkoutSettings.is_tipping_checkout = is_tipping_checkout;
    if (shipping_address_phone_number !== undefined)
      checkoutSettings.shipping_address_phone_number =
        shipping_address_phone_number;
    if (tip_fixed_amount !== undefined)
      checkoutSettings.tip_fixed_amount = tip_fixed_amount;
    if (tip_percentage !== undefined)
      checkoutSettings.tip_percentage = tip_percentage;
    if (tip_type !== undefined) checkoutSettings.tip_type = tip_type;

    await checkoutSettings.save();

    const responseData = {
      message: "Checkout settings updated successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get checkout settings
// @route   GET /supplier/checkout_settings
// @access  Private (Supplier Only)
exports.getCheckoutSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get or create checkout settings
    let checkoutSettings = await CheckoutSettings.findOne({
      supplier_id: userId,
    });

    if (!checkoutSettings) {
      checkoutSettings = await CheckoutSettings.create({ supplier_id: userId });
    }

    const responseData = {
      message: "Checkout settings retrieved successfully",
      data: {
        address_line: checkoutSettings.address_line || "",
        company_name: checkoutSettings.company_name || "",
        fullname: checkoutSettings.fullname || "",
        is_custom_tip: checkoutSettings.is_custom_tip || false,
        is_tipping_checkout: checkoutSettings.is_tipping_checkout || false,
        shipping_address_phone_number:
          checkoutSettings.shipping_address_phone_number || "",
        tip_fixed_amount: checkoutSettings.tip_fixed_amount || [],
        tip_percentage: checkoutSettings.tip_percentage || [],
        tip_type: checkoutSettings.tip_type || "percentage",
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Contact Info APIs
// @desc    Update contact info
// @route   POST /supplier/contact_info
// @access  Private (Supplier Only)
exports.updateContactInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      trade_name,
      phone_number,
      email,
      phyiscal_address,
      vat_reg_number,
      business_reg_number,
      customer_support_hours,
      response_time,
      is_contact_form,
      contact_page_intro,
      fb_url,
      insta_url,
      x_url,
      linkedin_url,
    } = req.body;

    // Find or create contact info
    let contactInfo = await ContactInfo.findOne({ supplier_id: userId });

    if (!contactInfo) {
      contactInfo = new ContactInfo({ supplier_id: userId });
    }

    // Update fields
    if (trade_name !== undefined) contactInfo.trade_name = trade_name;
    if (phone_number !== undefined) contactInfo.phone_number = phone_number;
    if (email !== undefined) contactInfo.email = email;
    if (phyiscal_address !== undefined)
      contactInfo.phyiscal_address = phyiscal_address;
    if (vat_reg_number !== undefined)
      contactInfo.vat_reg_number = vat_reg_number;
    if (business_reg_number !== undefined)
      contactInfo.business_reg_number = business_reg_number;
    if (customer_support_hours !== undefined)
      contactInfo.customer_support_hours = customer_support_hours;
    if (response_time !== undefined) contactInfo.response_time = response_time;
    if (is_contact_form !== undefined)
      contactInfo.is_contact_form = is_contact_form;
    if (contact_page_intro !== undefined)
      contactInfo.contact_page_intro = contact_page_intro;
    if (fb_url !== undefined) contactInfo.fb_url = fb_url;
    if (insta_url !== undefined) contactInfo.insta_url = insta_url;
    if (x_url !== undefined) contactInfo.x_url = x_url;
    if (linkedin_url !== undefined) contactInfo.linkedin_url = linkedin_url;

    await contactInfo.save();

    const responseData = {
      message: "Contact info updated successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get contact info
// @route   GET /supplier/contact_info
// @access  Private (Supplier Only)
exports.getContactInfo = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get or create contact info
    let contactInfo = await ContactInfo.findOne({ supplier_id: userId });

    if (!contactInfo) {
      contactInfo = await ContactInfo.create({ supplier_id: userId });
    }

    const responseData = {
      message: "Contact info retrieved successfully",
      data: {
        trade_name: contactInfo.trade_name || "",
        phone_number: contactInfo.phone_number || "",
        email: contactInfo.email || "",
        phyiscal_address: contactInfo.phyiscal_address || "",
        vat_reg_number: contactInfo.vat_reg_number || "",
        business_reg_number: contactInfo.business_reg_number || "",
        customer_support_hours: contactInfo.customer_support_hours || "",
        response_time: contactInfo.response_time || "",
        is_contact_form: contactInfo.is_contact_form || false,
        contact_page_intro: contactInfo.contact_page_intro || "",
        fb_url: contactInfo.fb_url || "",
        insta_url: contactInfo.insta_url || "",
        x_url: contactInfo.x_url || "",
        linkedin_url: contactInfo.linkedin_url || "",
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Supplier Profile APIs
// @desc    Update supplier profile
// @route   POST /supplier/supplier_profile
// @access  Private (Supplier Only)
exports.updateSupplierProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { profile_image, first_name, last_name, email, phone_number } =
      req.body;
    console.log(req.body);
    // Find or create supplier profile
    let supplierProfile = await SupplierProfile.findOne({
      supplier_id: userId,
    });

    if (!supplierProfile) {
      supplierProfile = new SupplierProfile({ supplier_id: userId });
    }

    // Update fields
    if (profile_image !== undefined)
      supplierProfile.profile_image = profile_image;
    if (first_name !== undefined) supplierProfile.first_name = first_name;
    if (last_name !== undefined) supplierProfile.last_name = last_name;
    if (email !== undefined) supplierProfile.email = email;
    if (phone_number !== undefined) supplierProfile.phone_number = phone_number;

    await supplierProfile.save();

    const responseData = {
      message: "Supplier profile updated successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get supplier profile
// @route   GET /supplier/supplier_profile
// @access  Private (Supplier Only)
exports.getSupplierProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get or create supplier profile
    let supplierProfile = await SupplierProfile.findOne({
      supplier_id: userId,
    });

    if (!supplierProfile) {
      supplierProfile = await SupplierProfile.create({ supplier_id: userId });
    }

    console.log(supplierProfile);

    const responseData = {
      message: "Supplier profile retrieved successfully",
      data: {
        profile_image: supplierProfile.profile_image || "",
        first_name: supplierProfile.first_name || "",
        last_name: supplierProfile.last_name || "",
        email: supplierProfile.email || "",
        phone_number: supplierProfile.phone_number || "",
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Recovery Email APIs
// @desc    Add recovery email
// @route   POST /supplier/add_recovery_email
// @access  Private (Supplier Only)
exports.addRecoveryEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recovery_email } = req.body;

    if (!recovery_email) {
      return res.status(400).json({ error: "Recovery email is required" });
    }

    // Validate email format
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(recovery_email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Find or create supplier profile
    let supplierProfile = await SupplierProfile.findOne({
      supplier_id: userId,
    });

    if (!supplierProfile) {
      supplierProfile = new SupplierProfile({ supplier_id: userId });
    }

    // Update recovery email
    supplierProfile.recovery_email = recovery_email;
    supplierProfile.is_recovery_email_verified = false;

    // Generate verification token
    const verificationToken =
      supplierProfile.getRecoveryEmailVerificationToken();

    await supplierProfile.save();

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-recovery-email/${verificationToken}`;

    const message = `
        <h1>Recovery Email Verification</h1>
        <p>Please click the link below to verify your recovery email:</p>
        <a href="${verificationUrl}" target="_blank">Verify Recovery Email</a>
      `;

    try {
      await sendEmail({
        email: recovery_email,
        subject: "Recovery Email Verification",
        message,
      });

      const responseData = {
        message: "Recovery email added and verification sent",
      };

      const encryptedData = encryptData(responseData);
      res.status(200).json({ data: encryptedData });
    } catch (emailError) {
      console.error("Error sending email:", emailError);

      // Reset verification tokens
      supplierProfile.recovery_email_verification_token = undefined;
      supplierProfile.recovery_email_verification_expire = undefined;
      await supplierProfile.save();

      return res.status(500).json({ error: "Email could not be sent" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get recovery email
// @route   GET /supplier/get_recovery_email
// @access  Private (Supplier Only)
exports.getRecoveryEmail = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get supplier profile
    const supplierProfile = await SupplierProfile.findOne({
      supplier_id: userId,
    });

    let recovery_email = "";
    let is_verified = false;

    if (supplierProfile) {
      recovery_email = supplierProfile.recovery_email || "";
      is_verified = supplierProfile.is_recovery_email_verified || false;
    }

    const responseData = {
      message: "Recovery email retrieved successfully",
      recovery_email,
      is_verified,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Verify recovery email
// @route   POST /supplier/verify_recovery_email
// @access  Public
exports.verifyRecoveryEmail = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: "Verification token is required" });
    }

    // Hash the token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find the profile with this token
    const supplierProfile = await SupplierProfile.findOne({
      recovery_email_verification_token: hashedToken,
      recovery_email_verification_expire: { $gt: Date.now() },
    });

    if (!supplierProfile) {
      return res
        .status(400)
        .json({ error: "Invalid or expired verification token" });
    }

    // Mark email as verified
    supplierProfile.is_recovery_email_verified = true;
    supplierProfile.recovery_email_verification_token = undefined;
    supplierProfile.recovery_email_verification_expire = undefined;

    await supplierProfile.save();

    const responseData = {
      message: "Recovery email verified successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Resend recovery email verification
// @route   POST /supplier/resend_recovery_email
// @access  Private (Supplier Only)
exports.resendRecoveryEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recovery_email } = req.body;
    console.log("RESEND");

    if (!recovery_email) {
      return res.status(400).json({ error: "Recovery email is required" });
    }

    // Find supplier profile
    let supplierProfile = await SupplierProfile.findOne({
      supplier_id: userId,
    });

    if (!supplierProfile) {
      return res.status(404).json({ error: "Supplier profile not found" });
    }

    // Check if this is the same email as before
    if (supplierProfile.recovery_email !== recovery_email) {
      return res
        .status(400)
        .json({ error: "Recovery email does not match the one on record" });
    }

    // Check if already verified
    if (supplierProfile.is_recovery_email_verified) {
      return res
        .status(400)
        .json({ error: "Recovery email is already verified" });
    }

    // Generate new verification token
    const verificationToken =
      supplierProfile.getRecoveryEmailVerificationToken();

    await supplierProfile.save();

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-recovery-email/${verificationToken}`;

    const message = `
        <h1>Recovery Email Verification</h1>
        <p>Please click the link below to verify your recovery email:</p>
        <a href="${verificationUrl}" target="_blank">Verify Recovery Email</a>
      `;

    try {
      await sendEmail({
        email: recovery_email,
        subject: "Recovery Email Verification",
        message,
      });

      const responseData = {
        message: "Recovery email verification resent",
      };

      const encryptedData = encryptData(responseData);
      res.status(200).json({ data: encryptedData });
    } catch (emailError) {
      console.error("Error sending email:", emailError);

      // Reset verification tokens
      supplierProfile.recovery_email_verification_token = undefined;
      supplierProfile.recovery_email_verification_expire = undefined;
      await supplierProfile.save();

      return res.status(500).json({ error: "Email could not be sent" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Add recovery phone
// @route   POST /supplier/add_recovery_phone
// @access  Private (Supplier Only)
exports.addRecoveryPhone = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recovery_phone } = req.body;

    if (!recovery_phone) {
      return res.status(400).json({ error: "Recovery phone is required" });
    }

    // Find or create supplier profile
    let supplierProfile = await SupplierProfile.findOne({
      supplier_id: userId,
    });

    if (!supplierProfile) {
      supplierProfile = new SupplierProfile({ supplier_id: userId });
    }

    // Update recovery phone
    supplierProfile.recovery_phone = recovery_phone;

    await supplierProfile.save();

    const responseData = {
      message: "Recovery phone added successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
