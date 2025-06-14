// controllers/discountController.js
const Discount = require("../models/Discount");
const Product = require("../models/Product");
const Collection = require("../models/Collection");
const Customer = require("../models/Customer");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Add new discount
// @route   POST /supplier/add_discount
// @access  Private (Supplier Only)
exports.addDiscount = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const {
      discount_type,
      code,
      title,
      discount_category,
      discount_value_type,
      discount_value,
      appliesTo,
      sale_items,
      start_datetime,
      is_end_date,
      end_datetime,
      eligibility,
      customer_list,
      min_purchase_req,
      min_amount_value,
      min_items_value,
      is_max_limit,
      max_total_uses,
      one_per_customer,
      customer_buy_spend,
      buy_spend_quantity,
      buy_spend_amount,
      buy_spend_any_item_from,
      buy_spend_sale_items,
      gets_quantity,
      gets_any_item_from,
      gets_sale_items,
      discounted_value,
      percentage,
      amount_off_each,
      is_max_users_per_order,
      max_users,
    } = req.body;

    // Validate required fields
    if (
      !discount_type ||
      !title ||
      !discount_value_type ||
      discount_value === undefined
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate discount code for 'code' type discounts
    if (discount_type === "code" && (!code || code.trim() === "")) {
      return res
        .status(400)
        .json({ error: "Discount code is required for code-type discounts" });
    }

    // Check if discount code already exists for this supplier
    if (discount_type === "code" && code) {
      const existingDiscount = await Discount.findOne({
        supplier_id: supplierId,
        code: code.toUpperCase(),
        status: { $in: ["active", "inactive"] },
      });

      if (existingDiscount) {
        return res.status(400).json({ error: "Discount code already exists" });
      }
    }

    // Process sale_items to extract just the IDs
    let processedSaleItems = [];
    if (sale_items && Array.isArray(sale_items) && sale_items.length > 0) {
      processedSaleItems = sale_items
        .map((item) => {
          // If item is an object with id property, extract the id
          if (typeof item === "object" && item.id) {
            return item.id;
          }
          // If item is already a string ID, use it directly
          return item;
        })
        .filter((id) => id); // Remove any null/undefined values
    }

    // Validate sale items if appliesTo is not 'all'
    if (appliesTo !== "all" && processedSaleItems.length > 0) {
      if (appliesTo === "products") {
        const products = await Product.find({
          _id: { $in: processedSaleItems },
          supplier_id: supplierId,
        });
        if (products.length !== processedSaleItems.length) {
          return res
            .status(400)
            .json({ error: "Some products not found or don't belong to you" });
        }
      } else if (appliesTo === "collections") {
        const collections = await Collection.find({
          _id: { $in: processedSaleItems },
          supplier_id: supplierId,
        });
        if (collections.length !== processedSaleItems.length) {
          return res.status(400).json({
            error: "Some collections not found or don't belong to you",
          });
        }
      }
    }

    // Process other sale item arrays
    let processedBuySpendSaleItems = [];
    if (buy_spend_sale_items && Array.isArray(buy_spend_sale_items)) {
      processedBuySpendSaleItems = buy_spend_sale_items
        .map((item) => {
          if (typeof item === "object" && item.id) {
            return item.id;
          }
          return item;
        })
        .filter((id) => id);
    }

    let processedGetsSaleItems = [];
    if (gets_sale_items && Array.isArray(gets_sale_items)) {
      processedGetsSaleItems = gets_sale_items
        .map((item) => {
          if (typeof item === "object" && item.id) {
            return item.id;
          }
          return item;
        })
        .filter((id) => id);
    }

    // Process customer_list to extract just the IDs
    let processedCustomerList = [];
    if (
      customer_list &&
      Array.isArray(customer_list) &&
      customer_list.length > 0
    ) {
      processedCustomerList = customer_list
        .map((customer) => {
          if (typeof customer === "object" && customer.id) {
            return customer.id;
          }
          return customer;
        })
        .filter((id) => id);

      // Validate customer list if eligibility is specific customers
      if (
        eligibility === "specific_customers" &&
        processedCustomerList.length > 0
      ) {
        const customers = await Customer.find({
          _id: { $in: processedCustomerList },
          supplier_id: supplierId,
        });
        if (customers.length !== processedCustomerList.length) {
          return res
            .status(400)
            .json({ error: "Some customers not found or don't belong to you" });
        }
      }
    }

    // Validate date range
    if (is_end_date && end_datetime) {
      const startDate = new Date(start_datetime);
      const endDate = new Date(end_datetime);
      if (endDate <= startDate) {
        return res
          .status(400)
          .json({ error: "End date must be after start date" });
      }
    }

    // Validate discount value
    if (
      discount_value_type === "percentage" &&
      (discount_value < 0 || discount_value > 100)
    ) {
      return res
        .status(400)
        .json({ error: "Percentage discount must be between 0 and 100" });
    }

    if (discount_value_type === "fixed_amount" && discount_value < 0) {
      return res
        .status(400)
        .json({ error: "Fixed amount discount must be positive" });
    }

    // Create discount object
    const discountData = {
      supplier_id: supplierId,
      discount_type,
      title,
      discount_category,
      discount_value_type,
      discount_value,
      applies_to: appliesTo,
      start_datetime: start_datetime || new Date(),
      is_end_date: is_end_date || false,
      eligibility: eligibility || "all_customers",
      min_purchase_req: min_purchase_req || "no_req",
      min_amount_value: min_amount_value || 0,
      min_items_value: min_items_value || 1,
      is_max_limit: is_max_limit || false,
      max_total_uses: max_total_uses || 1,
      one_per_customer: one_per_customer || false,
      customer_buy_spend: customer_buy_spend || "min_item_qty",
      buy_spend_quantity: buy_spend_quantity || 1,
      buy_spend_amount: buy_spend_amount || 0,
      buy_spend_any_item_from: buy_spend_any_item_from || "products",
      gets_quantity: gets_quantity || 1,
      gets_any_item_from: gets_any_item_from || "products",
      discounted_value: discounted_value || "free",
      percentage: percentage || 0,
      amount_off_each: amount_off_each || 0,
      is_max_users_per_order: is_max_users_per_order || false,
      max_users: max_users || 1,
    };

    if (discount_type === "code") {
      if (!code || code.trim() === "") {
        return res
          .status(400)
          .json({ error: "Code is required for code-type discounts" });
      }
      discountData.code = code.toUpperCase();
    }

    if (is_end_date && end_datetime) {
      discountData.end_datetime = end_datetime;
    }

    if (processedSaleItems.length > 0) {
      discountData.sale_items = processedSaleItems;
      discountData.sale_items_type =
        appliesTo === "collections" ? "Collection" : "Product";
    }

    if (processedCustomerList.length > 0) {
      discountData.customer_list = processedCustomerList;
    }

    if (processedBuySpendSaleItems.length > 0) {
      discountData.buy_spend_sale_items = processedBuySpendSaleItems;
      discountData.buy_spend_sale_items_type =
        buy_spend_any_item_from === "collections" ? "Collection" : "Product";
    }

    if (processedGetsSaleItems.length > 0) {
      discountData.gets_sale_items = processedGetsSaleItems;
      discountData.gets_sale_items_type =
        gets_any_item_from === "collections" ? "Collection" : "Product";
    }

    // Create the discount
    const discount = await Discount.create(discountData);

    const responseData = {
      message: "Discount created successfully",
      discount: {
        id: discount._id,
        title: discount.title,
        code: discount.code,
        discount_type: discount.discount_type,
        status: discount.status,
        is_currently_active: discount.is_currently_active,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting discount:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Apply discount to order
// @route   POST /supplier/apply_discount
// @access  Private (Supplier Only)
exports.applyDiscount = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const { discount_id, customer_id, order_items, order_total } = req.body;

    if (!discount_id || !order_items || order_total === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const discount = await Discount.findOne({
      _id: discount_id,
      supplier_id: supplierId,
    });

    if (!discount) {
      return res.status(404).json({ error: "Discount not found" });
    }

    // Check if discount is currently active
    if (!discount.is_currently_active) {
      return res
        .status(400)
        .json({ error: "Discount is not currently active" });
    }

    // Check customer eligibility
    if (customer_id) {
      const eligibilityCheck = discount.canBeUsedBy(customer_id);
      if (!eligibilityCheck.canUse) {
        return res.status(400).json({ error: eligibilityCheck.reason });
      }
    }

    // Calculate discount amount based on discount type
    let discountAmount = 0;
    let applicableItems = [];

    // Filter applicable items based on discount criteria
    if (discount.applies_to === "all") {
      applicableItems = order_items;
    } else if (
      discount.applies_to === "products" &&
      discount.sale_items.length > 0
    ) {
      applicableItems = order_items.filter((item) =>
        discount.sale_items.includes(item.product_id)
      );
    } else if (
      discount.applies_to === "collections" &&
      discount.sale_items.length > 0
    ) {
      // You'll need to check if products belong to the specified collections
      // This requires additional logic to fetch products from collections
      applicableItems = order_items; // Simplified for now
    }

    if (applicableItems.length === 0) {
      return res
        .status(400)
        .json({ error: "No items are eligible for this discount" });
    }

    // Check minimum purchase requirements
    if (
      discount.min_purchase_req === "min_amount" &&
      order_total < discount.min_amount_value
    ) {
      return res.status(400).json({
        error: `Minimum order amount of $${discount.min_amount_value} required`,
      });
    }

    if (discount.min_purchase_req === "min_items") {
      const totalItems = order_items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      if (totalItems < discount.min_items_value) {
        return res.status(400).json({
          error: `Minimum ${discount.min_items_value} items required`,
        });
      }
    }

    // Calculate discount amount
    const applicableTotal = applicableItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    if (discount.discount_value_type === "percentage") {
      discountAmount = (applicableTotal * discount.discount_value) / 100;
    } else if (discount.discount_value_type === "fixed_amount") {
      discountAmount = Math.min(discount.discount_value, applicableTotal);
    }

    // Apply discount usage
    if (customer_id) {
      await discount.useDiscount(customer_id);
    } else {
      discount.total_uses += 1;
      await discount.save();
    }

    const responseData = {
      message: "Discount applied successfully",
      discount_applied: {
        discount_id: discount._id,
        title: discount.title,
        code: discount.code,
        discount_amount: parseFloat(discountAmount.toFixed(2)),
        original_total: order_total,
        new_total: parseFloat((order_total - discountAmount).toFixed(2)),
        applicable_items: applicableItems.length,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error applying discount:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get discount usage report
// @route   POST /supplier/discount_usage_report
// @access  Private (Supplier Only)
exports.getDiscountUsageReport = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const { discount_id, start_date, end_date, status } = req.body;

    // Build query
    const query = { supplier_id: supplierId };

    if (discount_id) {
      query._id = discount_id;
    }

    if (status) {
      query.status = status;
    }

    if (start_date || end_date) {
      query.createdAt = {};
      if (start_date) query.createdAt.$gte = new Date(start_date);
      if (end_date) query.createdAt.$lte = new Date(end_date);
    }

    const discounts = await Discount.find(query).sort({ createdAt: -1 });

    // Calculate usage statistics
    const report = {
      total_discounts: discounts.length,
      active_discounts: discounts.filter((d) => d.status === "active").length,
      total_uses: discounts.reduce((sum, d) => sum + d.total_uses, 0),
      discounts_by_status: {
        active: discounts.filter((d) => d.status === "active").length,
        inactive: discounts.filter((d) => d.status === "inactive").length,
        expired: discounts.filter((d) => d.status === "expired").length,
        used_up: discounts.filter((d) => d.status === "used_up").length,
      },
      discount_details: discounts.map((discount) => ({
        id: discount._id,
        title: discount.title,
        code: discount.code,
        discount_type: discount.discount_type,
        status: discount.status,
        total_uses: discount.total_uses,
        max_total_uses: discount.max_total_uses,
        usage_percentage: discount.is_max_limit
          ? ((discount.total_uses / discount.max_total_uses) * 100).toFixed(1)
          : "Unlimited",
        is_currently_active: discount.is_currently_active,
        created_at: discount.createdAt,
      })),
    };

    const responseData = {
      message: "Discount usage report generated successfully",
      report,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error generating discount usage report:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get public discount by code (for customers)
// @route   POST /public/validate_discount_code
// @access  Public
exports.getPublicDiscountByCode = async (req, res) => {
  try {
    const { code, supplier_id } = req.body;

    if (!code || !supplier_id) {
      return res
        .status(400)
        .json({ error: "Discount code and supplier ID are required" });
    }

    const discount = await Discount.findOne({
      supplier_id: supplier_id,
      code: code.toUpperCase(),
      discount_type: "code",
      status: "active",
    });

    if (!discount) {
      return res.status(404).json({ error: "Invalid discount code" });
    }

    // Check if discount is currently active
    if (!discount.is_currently_active) {
      return res
        .status(400)
        .json({ error: "Discount code is not currently active" });
    }

    const responseData = {
      message: "Discount code found",
      discount: {
        id: discount._id,
        title: discount.title,
        code: discount.code,
        discount_value_type: discount.discount_value_type,
        discount_value: discount.discount_value,
        applies_to: discount.applies_to,
        min_purchase_req: discount.min_purchase_req,
        min_amount_value: discount.min_amount_value,
        min_items_value: discount.min_items_value,
        end_datetime: discount.end_datetime,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting public discount:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get active automatic discounts for supplier
// @route   GET /supplier/get_automatic_discounts
// @access  Private (Supplier Only)
exports.getAutomaticDiscounts = async (req, res) => {
  try {
    const supplierId = req.user.id;

    const automaticDiscounts = await Discount.find({
      supplier_id: supplierId,
      discount_type: "automatic",
      status: "active",
    })
      .populate("sale_items", "title price")
      .sort({ createdAt: -1 });

    // Filter to only currently active discounts
    const activeDiscounts = automaticDiscounts.filter(
      (discount) => discount.is_currently_active
    );

    const responseData = {
      message: "Automatic discounts retrieved successfully",
      discounts: activeDiscounts.map((discount) => ({
        id: discount._id,
        title: discount.title,
        discount_value_type: discount.discount_value_type,
        discount_value: discount.discount_value,
        applies_to: discount.applies_to,
        sale_items: discount.sale_items,
        min_purchase_req: discount.min_purchase_req,
        min_amount_value: discount.min_amount_value,
        min_items_value: discount.min_items_value,
        end_datetime: discount.end_datetime,
      })),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting automatic discounts:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get all discounts for supplier
// @route   GET /supplier/get_discounts
// @access  Private (Supplier Only)
exports.getDiscounts = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build query
    const query = { supplier_id: supplierId };
    if (status) {
      query.status = status;
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const discounts = await Discount.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Discount.countDocuments(query);

    // Format discount list according to specification
    const discount_list = discounts.map((discount) => ({
      id: discount._id,
      code: discount.code,
      title: discount.title,
      discount_category: discount.discount_category,
      discount_value: discount.discount_value,
      discount_value_type: discount.discount_value_type,
      appliesTo: discount.applies_to,
      start_datetime: discount.start_datetime,
      end_datetime: discount.end_datetime,
    }));

    const responseData = {
      message: "Discounts retrieved successfully",
      discount_list,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit),
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting discounts:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get single discount
// @route   POST /supplier/get_discount
// @access  Private (Supplier Only)
exports.getDiscount = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const { discount_id } = req.body;

    if (!discount_id) {
      return res.status(400).json({ error: "Discount ID is required" });
    }

    const discount = await Discount.findOne({
      _id: discount_id,
      supplier_id: supplierId,
    })
      .populate("sale_items")
      .populate("customer_list", "first_name last_name email")
      .populate("buy_spend_sale_items")
      .populate("gets_sale_items");

    if (!discount) {
      return res.status(404).json({ error: "Discount not found" });
    }

    // Format the response according to the specified structure
    const formattedDiscount = {
      discount_type: discount.discount_type,
      code: discount.code || "",
      title: discount.title,
      discount_value_type: discount.discount_value_type,
      discount_value: discount.discount_value,
      appliesTo: discount.applies_to,
      sale_items: discount.sale_items || [],
      start_datetime: discount.start_datetime,
      is_end_date: discount.is_end_date,
      end_datetime: discount.end_datetime || undefined,
      eligibility: discount.eligibility,
      customer_list: discount.customer_list || [],
      min_purchase_req: discount.min_purchase_req,
      min_amount_value: discount.min_amount_value,
      min_items_value: discount.min_items_value,
      is_max_limit: discount.is_max_limit,
      max_total_uses: discount.max_total_uses,
      one_per_customer: discount.one_per_customer,
      customer_buy_spend: discount.customer_buy_spend,
      buy_spend_quantity: discount.buy_spend_quantity,
      buy_spend_amount: discount.buy_spend_amount,
      buy_spend_any_item_from: discount.buy_spend_any_item_from,
      buy_spend_sale_items: discount.buy_spend_sale_items || [],
      gets_quantity: discount.gets_quantity,
      gets_any_item_from: discount.gets_any_item_from,
      gets_sale_items: discount.gets_sale_items || [],
      discounted_value: discount.discounted_value,
      percentage: discount.percentage,
      amount_off_each: discount.amount_off_each,
      is_max_users_per_order: discount.is_max_users_per_order,
      max_users: discount.max_users,
    };

    const responseData = {
      message: "Discount retrieved successfully",
      discount: formattedDiscount,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting discount:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update discount
// @route   POST /supplier/update_discount
// @access  Private (Supplier Only)
exports.updateDiscount = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const { discount_id, ...updateData } = req.body;

    if (!discount_id) {
      return res.status(400).json({ error: "Discount ID is required" });
    }

    const discount = await Discount.findOne({
      _id: discount_id,
      supplier_id: supplierId,
    });

    if (!discount) {
      return res.status(404).json({ error: "Discount not found" });
    }

    // Check if discount code already exists (if updating code)
    if (updateData.code && updateData.code !== discount.code) {
      const existingDiscount = await Discount.findOne({
        supplier_id: supplierId,
        code: updateData.code.toUpperCase(),
        _id: { $ne: discount_id },
        status: { $in: ["active", "inactive"] },
      });

      if (existingDiscount) {
        return res.status(400).json({ error: "Discount code already exists" });
      }
    }

    // Update discount
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        discount[key] = updateData[key];
      }
    });

    await discount.save();

    const responseData = {
      message: "Discount updated successfully",
      discount: {
        id: discount._id,
        title: discount.title,
        code: discount.code,
        status: discount.status,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error updating discount:", err);

    if (err.name === "ValidationError") {
      const message = Object.values(err.errors)[0].message;
      return res.status(400).json({ error: message });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete discount
// @route   POST /supplier/delete_discount
// @access  Private (Supplier Only)
exports.deleteDiscount = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const { discount_id } = req.body;

    if (!discount_id) {
      return res.status(400).json({ error: "Discount ID is required" });
    }

    const discount = await Discount.findOneAndDelete({
      _id: discount_id,
      supplier_id: supplierId,
    });

    if (!discount) {
      return res.status(404).json({ error: "Discount not found" });
    }

    const responseData = {
      message: "Discount deleted successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting discount:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Toggle discount status
// @route   POST /supplier/toggle_discount_status
// @access  Private (Supplier Only)
exports.toggleDiscountStatus = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const { discount_id } = req.body;

    if (!discount_id) {
      return res.status(400).json({ error: "Discount ID is required" });
    }

    const discount = await Discount.findOne({
      _id: discount_id,
      supplier_id: supplierId,
    });

    if (!discount) {
      return res.status(404).json({ error: "Discount not found" });
    }

    // Toggle status between active and inactive
    discount.status = discount.status === "active" ? "inactive" : "active";
    await discount.save();

    const responseData = {
      message: `Discount ${
        discount.status === "active" ? "activated" : "deactivated"
      } successfully`,
      discount: {
        id: discount._id,
        title: discount.title,
        status: discount.status,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error toggling discount status:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Validate discount code
// @route   POST /supplier/validate_discount_code
// @access  Private (Supplier Only)
exports.validateDiscountCode = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const { code, customer_id, order_items, order_total } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Discount code is required" });
    }

    const discount = await Discount.findOne({
      supplier_id: supplierId,
      code: code.toUpperCase(),
      discount_type: "code",
    });

    if (!discount) {
      return res.status(404).json({ error: "Invalid discount code" });
    }

    // Check if discount is currently active
    if (!discount.is_currently_active) {
      return res
        .status(400)
        .json({ error: "Discount code is not currently active" });
    }

    // Check customer eligibility if customer_id provided
    if (customer_id) {
      const eligibilityCheck = discount.canBeUsedBy(customer_id);
      if (!eligibilityCheck.canUse) {
        return res.status(400).json({ error: eligibilityCheck.reason });
      }
    }

    const responseData = {
      message: "Discount code is valid",
      discount: {
        id: discount._id,
        title: discount.title,
        code: discount.code,
        discount_value_type: discount.discount_value_type,
        discount_value: discount.discount_value,
        applies_to: discount.applies_to,
        min_purchase_req: discount.min_purchase_req,
        min_amount_value: discount.min_amount_value,
        min_items_value: discount.min_items_value,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error validating discount code:", err);
    res.status(500).json({ error: "Server error" });
  }
};
