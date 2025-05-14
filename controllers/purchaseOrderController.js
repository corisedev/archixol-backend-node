// controllers/purchaseOrderController.js
const PurchaseOrder = require("../models/PurchaseOrder");
const Vendor = require("../models/Vendor");
const Product = require("../models/Product");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Get all purchase orders
// @route   GET /supplier/get_all_purchaseorders
// @access  Private (Supplier Only)
exports.getAllPurchaseOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all purchase orders for this supplier
    const purchaseOrders = await PurchaseOrder.find({
      supplier_id: userId,
      status: { $ne: "cancelled" }, // Exclude cancelled POs
    }).sort({ createdAt: -1 }); // Latest first

    // Format purchase orders for response
    const purchaseOrdersList = purchaseOrders.map((po) => {
      const poObj = po.toObject();
      poObj.id = poObj._id;
      delete poObj._id;

      // Format dates for frontend
      poObj.created_at = poObj.createdAt;
      poObj.updated_at = poObj.updatedAt;

      return poObj;
    });

    const responseData = {
      message: "Purchase orders retrieved successfully",
      purchase_orders: purchaseOrdersList,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get purchase order by ID
// @route   POST /supplier/get_purchaseorder
// @access  Private (Supplier Only)
exports.getPurchaseOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { purchase_order_id } = req.body;

    if (!purchase_order_id) {
      return res.status(400).json({ error: "Purchase order ID is required" });
    }

    // Find the purchase order
    const purchaseOrder = await PurchaseOrder.findOne({
      _id: purchase_order_id,
      supplier_id: userId,
    });

    if (!purchaseOrder) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    // Format purchase order for response
    const poObj = purchaseOrder.toObject();
    poObj.id = poObj._id;
    delete poObj._id;

    // Format dates for frontend
    poObj.created_at = poObj.createdAt;
    poObj.updated_at = poObj.updatedAt;

    // Try to get vendor details if available
    if (purchaseOrder.vendor_id) {
      try {
        const vendor = await Vendor.findById(purchaseOrder.vendor_id);
        if (vendor) {
          poObj.vendor_details = {
            id: vendor._id,
            vendor_name:
              vendor.vendor_name || `${vendor.first_name} ${vendor.last_name}`,
            email: vendor.email,
            phone_number: vendor.phone_number,
            address: {
              street: vendor.street_address,
              city: vendor.city,
              state: vendor.state_province,
              zip: vendor.zip_code,
              country: vendor.country,
            },
          };
        }
      } catch (error) {
        console.log("Vendor not found:", error.message);
      }
    }

    // Fetch product images for each product in the purchase order
    if (poObj.products && poObj.products.length > 0) {
      const productIds = poObj.products
        .filter((product) => product._id)
        .map((product) => product._id);

      console.log("FROM FRONTEND", poObj.products);

      // Fetch all products in one query for better performance
      const productDetails = await Product.find({
        _id: { $in: productIds },
      }).select("_id media");

      // Create a map for quick lookup
      const productMediaMap = {};
      productDetails.forEach((product) => {
        productMediaMap[product._id.toString()] = product.media || [];
      });
      console.log("PRODUCTS:", productDetails);
      console.log("productMediaMap:", productMediaMap);

      // Now assign media to each product
      for (let i = 0; i < poObj.products.length; i++) {
        const product = poObj.products[i];
        if (product._id) {
          const productId = product._id.toString();
          poObj.products[i].media = productMediaMap[productId] || [];
        } else {
          poObj.products[i].media = [];
        }
      }
    }

    const responseData = {
      message: "Purchase order retrieved successfully",
      purchase_order: poObj,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Create a new purchase order
// @route   POST /supplier/create_purchaseorder
// @access  Private (Supplier Only)
exports.createPurchaseOrder = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      vendor_name,
      supplier_name,
      payment_terms,
      destination,
      supplier_currency,
      estimated_arrival,
      shipping_carrier,
      tracking_number,
      reference_number,
      received_status,
      tags,
      notes,
      products,
      calculations,
    } = req.body;

    // Validate required fields
    if (!vendor_name) {
      return res.status(400).json({ error: "Vendor name is required" });
    }

    if (!products || !products.length) {
      return res
        .status(400)
        .json({ error: "At least one product is required" });
    }

    if (!calculations) {
      return res.status(400).json({ error: "Calculations are required" });
    }

    // Process the products - use qty from frontend as quantity and calculate total
    const productsWithTotal = products.map((product) => {
      const qty = product.qty || 1; // Default to 1 if qty is not provided
      return {
        ...product,
        quantity: qty, // Set quantity to qty from frontend
        total: (product.price || 0) * qty,
      };
    });

    // Try to find vendor by name to get vendor_id
    let vendorId = null;
    let actualVendorName = vendor_name;

    try {
      // First check if vendor_name is actually a MongoDB ObjectId
      if (vendor_name && vendor_name.match(/^[0-9a-fA-F]{24}$/)) {
        // If it's an ObjectId, fetch the vendor directly by ID
        const vendorById = await Vendor.findOne({
          _id: vendor_name,
          supplier_id: userId,
        });

        if (vendorById) {
          vendorId = vendorById._id;
          actualVendorName =
            vendorById.vendor_name ||
            `${vendorById.first_name} ${vendorById.last_name}`;
        }
      } else {
        // Otherwise, search by name
        const vendor = await Vendor.findOne({
          $or: [
            { vendor_name: vendor_name },
            {
              first_name: {
                $regex: new RegExp(vendor_name.split(" ")[0], "i"),
              },
            },
          ],
          supplier_id: userId,
        });

        if (vendor) {
          vendorId = vendor._id;
          actualVendorName =
            vendor.vendor_name || `${vendor.first_name} ${vendor.last_name}`;
        }
      }
    } catch (error) {
      console.log("Vendor lookup error:", error.message);
    }

    // Create new purchase order
    const purchaseOrder = await PurchaseOrder.create({
      supplier_id: userId,
      vendor_id: vendorId,
      vendor_name: actualVendorName,
      supplier_name: supplier_name || userId,
      payment_terms: payment_terms,
      destination: destination || "",
      supplier_currency: supplier_currency || "USD",
      estimated_arrival: estimated_arrival || null,
      shipping_carrier: shipping_carrier || "",
      tracking_number: tracking_number || "",
      reference_number: reference_number || "",
      received_status: received_status || false,
      tags: tags || [],
      notes: notes || "",
      products: productsWithTotal,
      calculations,
      products_count: productsWithTotal.length,
    });

    const responseData = {
      message: "Purchase order created successfully",
      purchase_order_id: purchaseOrder._id,
      po_no: purchaseOrder.po_no,
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error(err);

    // Check for validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ error: messages.join(", ") });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update purchase order
// @route   POST /supplier/update_purchaseorder
// @access  Private (Supplier Only)
exports.updatePurchaseOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { purchase_order_id, ...updateData } = req.body;

    if (!purchase_order_id) {
      return res.status(400).json({ error: "Purchase order ID is required" });
    }

    // Find the purchase order
    const purchaseOrder = await PurchaseOrder.findOne({
      _id: purchase_order_id,
      supplier_id: userId,
    });

    if (!purchaseOrder) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    // Check if the PO has already been received
    if (purchaseOrder.received_status && !updateData.received_status) {
      return res.status(400).json({
        error: "Cannot update a purchase order that has been received",
      });
    }

    // Try to find vendor by name if vendor_name is updated
    if (
      updateData.vendor_name &&
      updateData.vendor_name !== purchaseOrder.vendor_name
    ) {
      try {
        // Check if vendor_name is actually a MongoDB ObjectId
        if (updateData.vendor_name.match(/^[0-9a-fA-F]{24}$/)) {
          // If it's an ObjectId, fetch the vendor directly by ID
          const vendorById = await Vendor.findOne({
            _id: updateData.vendor_name,
            supplier_id: userId,
          });

          if (vendorById) {
            purchaseOrder.vendor_id = vendorById._id;
            updateData.vendor_name =
              vendorById.vendor_name ||
              `${vendorById.first_name} ${vendorById.last_name}`;
          } else {
            purchaseOrder.vendor_id = null;
          }
        } else {
          // Otherwise, search by name
          const vendor = await Vendor.findOne({
            $or: [
              { vendor_name: updateData.vendor_name },
              {
                first_name: {
                  $regex: new RegExp(updateData.vendor_name.split(" ")[0], "i"),
                },
              },
            ],
            supplier_id: userId,
          });

          if (vendor) {
            purchaseOrder.vendor_id = vendor._id;
            updateData.vendor_name =
              vendor.vendor_name || `${vendor.first_name} ${vendor.last_name}`;
          } else {
            purchaseOrder.vendor_id = null;
          }
        }
      } catch (error) {
        console.log("Vendor lookup error:", error.message);
      }
    }

    // Process products if they are being updated
    if (updateData.products && Array.isArray(updateData.products)) {
      updateData.products = updateData.products.map((product) => {
        const qty = product.qty || 1; // Default to 1 if qty is not provided
        return {
          ...product,
          quantity: qty, // Set quantity to qty from frontend
          total: (product.price || 0) * qty,
        };
      });

      // Update products_count
      updateData.products_count = updateData.products.length;
    }

    // Update purchase order fields
    Object.keys(updateData).forEach((key) => {
      if (key !== "po_no" && key !== "supplier_id") {
        // Don't allow updating these fields
        purchaseOrder[key] = updateData[key];
      }
    });

    await purchaseOrder.save();

    const responseData = {
      message: "Purchase order updated successfully",
      purchase_order_id: purchaseOrder._id,
      po_no: purchaseOrder.po_no,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);

    // Check for validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ error: messages.join(", ") });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete purchase order (cancel)
// @route   POST /supplier/delete_purchaseorder
// @access  Private (Supplier Only)
exports.deletePurchaseOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { purchase_order_id } = req.body;

    if (!purchase_order_id) {
      return res.status(400).json({ error: "Purchase order ID is required" });
    }

    // Find the purchase order
    const purchaseOrder = await PurchaseOrder.findOne({
      _id: purchase_order_id,
      supplier_id: userId,
    });

    if (!purchaseOrder) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    // Check if the PO has already been received
    if (purchaseOrder.received_status) {
      return res.status(400).json({
        error: "Cannot delete a purchase order that has been received",
      });
    }

    // Set status to cancelled
    purchaseOrder.status = "cancelled";
    await purchaseOrder.save();

    const responseData = {
      message: "Purchase order deleted successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Mark purchase order as received
// @route   POST /supplier/mark_as_received
// @access  Private (Supplier Only)
exports.markAsReceived = async (req, res) => {
  try {
    const userId = req.user.id;
    const { po_no } = req.body;

    if (!po_no) {
      return res
        .status(400)
        .json({ error: "Purchase order number is required" });
    }

    // Find the purchase order
    const purchaseOrder = await PurchaseOrder.findOne({
      po_no,
      supplier_id: userId,
    });

    if (!purchaseOrder) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    // Check if the PO is already received
    if (purchaseOrder.received_status) {
      return res
        .status(400)
        .json({ error: "Purchase order has already been received" });
    }

    // Update inventory for each product
    for (const item of purchaseOrder.products) {
      if (item.product_id) {
        const product = await Product.findById(item.product_id);
        if (product) {
          // Increase quantity - use the quantity from the purchase order (which was set from frontend's qty)
          product.quantity += item.quantity;
          await product.save();
        }
      }
    }

    // Mark as received
    purchaseOrder.received_status = true;
    purchaseOrder.status = "received";
    await purchaseOrder.save();

    const responseData = {
      message: "Purchase order marked as received successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
