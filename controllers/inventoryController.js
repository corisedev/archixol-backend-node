// controllers/inventoryController.js
const Product = require("../models/Product");
const Order = require("../models/Order");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Get inventory status
// @route   GET /supplier/get_inventory
// @access  Private (Supplier Only)
exports.getInventory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all active products
    const products = await Product.find({
      supplier_id: userId,
      status: "active",
    }).select("_id title media quantity track_quantity physical_product");

    // Get all pending/processing orders to calculate committed inventory
    const pendingOrders = await Order.find({
      supplier_id: userId,
      status: { $in: ["pending", "processing"] },
    }).select("products");

    // Calculate committed quantities for each product
    const committedMap = {};

    pendingOrders.forEach((order) => {
      order.products.forEach((item) => {
        if (item.product_id) {
          const productId = item.product_id.toString();
          if (!committedMap[productId]) {
            committedMap[productId] = 0;
          }
          committedMap[productId] += item.qty;
        }
      });
    });

    // Format inventory data
    const inventoryItems = products.map((product) => {
      const productId = product._id.toString();
      const committed = committedMap[productId] || 0;
      const current = product.track_quantity ? product.quantity : 0;

      // Only track inventory for physical products with tracking enabled
      const trackInventory = product.physical_product && product.track_quantity;

      return {
        id: product._id,
        product_name: product.title,
        image:
          product.media && product.media.length > 0 ? product.media[0] : "",
        current_qty: trackInventory ? current : "Not tracked",
        committed: trackInventory ? committed : "Not tracked",
        available: trackInventory
          ? Math.max(0, current - committed)
          : "Not tracked",
      };
    });

    const responseData = {
      message: "Inventory retrieved successfully",
      inventory: inventoryItems,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
