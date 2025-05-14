const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { decrypt, encrypt } = require("../utils/encryptResponse");
const Order = require("../models/Order");
const Product = require("../models/Product");

/**
 * Generate report data based on the requested report type
 * @route POST /api/reports/generate
 * @access Private
 */
router.post("/generate", verifyToken, async (req, res) => {
  try {
    const user = req.user;

    // Get and decrypt the data
    const encryptedData = req.body.data;
    if (!encryptedData) {
      return res.status(400).json({ error: "No data provided" });
    }

    let data;
    try {
      const decryptedPayload = decrypt(encryptedData);
      data = JSON.parse(decryptedPayload);
    } catch (error) {
      return res.status(400).json({ error: "Decryption or JSON error" });
    }

    console.log(data);

    // Get the report key
    const reportKey = data.table_name;
    if (!reportKey) {
      return res.status(400).json({ error: "Report key is required" });
    }

    // Parse date filters
    const startDateStr = data.start_date;
    const endDateStr = data.end_date;
    let startDate = null;
    let endDate = null;

    try {
      startDate = startDateStr ? new Date(startDateStr) : null;
      endDate = endDateStr ? new Date(endDateStr) : null;

      // Check if dates are valid
      if (
        (startDateStr && isNaN(startDate.getTime())) ||
        (endDateStr && isNaN(endDate.getTime()))
      ) {
        return res
          .status(400)
          .json({ error: "Invalid date format. Use ISO format." });
      }
    } catch (error) {
      return res
        .status(400)
        .json({ error: "Invalid date format. Use ISO format." });
    }

    let result = {};

    // For sales/financial reports
    if (
      [
        "sales_overview",
        "sales_by_product",
        "sales_by_customer",
        "sales_by_location",
        "financial_reports",
      ].includes(reportKey)
    ) {
      // Build the query
      let query = { supplier: user.id };
      if (startDate) {
        query.created_at = { $gte: startDate };
      }
      if (endDate) {
        query.created_at = { ...query.created_at, $lte: endDate };
      }

      if (reportKey === "sales_overview") {
        // Total sales, total orders and average order value
        const orders = await Order.find(query);
        const totalSales = orders.reduce(
          (sum, order) => sum + (order.total || 0),
          0
        );
        const totalOrders = orders.length;
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

        // Daily sales breakdown for bar graph
        const salesByDay = {};
        orders.forEach((order) => {
          const day = order.created_at.toISOString().split("T")[0]; // YYYY-MM-DD format
          if (!salesByDay[day]) {
            salesByDay[day] = 0;
          }
          salesByDay[day] += order.total || 0;
        });

        const barData = Object.entries(salesByDay)
          .map(([day, totalSales]) => ({
            day,
            total_sales: totalSales,
          }))
          .sort((a, b) => a.day.localeCompare(b.day));

        result = {
          total_sales: totalSales,
          total_orders: totalOrders,
          avg_order_value: avgOrderValue,
          bar_data: barData,
        };
      } else if (reportKey === "sales_by_product") {
        // Get all orders
        const orders = await Order.find(query);

        // Manually aggregate sales by product from the products array in each order
        const productSales = {};

        orders.forEach((order) => {
          const productsList = Array.isArray(order.products)
            ? order.products
            : [];

          productsList.forEach((item) => {
            const productId = item.id;
            let productTotal = item.total;

            // If the product item has no total, distribute the order's total equally
            if (productTotal === undefined || productTotal === null) {
              const count = productsList.length;
              productTotal = count > 0 && order.total ? order.total / count : 0;
            }

            if (productId !== undefined && productId !== null) {
              if (productSales[productId]) {
                productSales[productId].total_sales += Number(productTotal);
                productSales[productId].order_count += 1;
              } else {
                productSales[productId] = {
                  total_sales: Number(productTotal),
                  order_count: 1,
                };
              }
            }
          });
        });

        // Get product titles
        const barData = [];

        // Use Promise.all to wait for all lookups to complete
        await Promise.all(
          Object.entries(productSales).map(async ([productId, stats]) => {
            try {
              const product = await Product.findById(productId);
              const title = product ? product.title : "Unknown";

              barData.push({
                product: title,
                total_sales: stats.total_sales,
                order_count: stats.order_count,
              });
            } catch (error) {
              barData.push({
                product: "Unknown",
                total_sales: stats.total_sales,
                order_count: stats.order_count,
              });
            }
          })
        );

        // Sort descending by total sales
        barData.sort((a, b) => b.total_sales - a.total_sales);

        result = { bar_data: barData };
      } else if (reportKey === "sales_by_customer") {
        // In MongoDB/Mongoose we need to use aggregation
        const salesByCustomer = await Order.aggregate([
          { $match: query },
          {
            $lookup: {
              from: "customers",
              localField: "customer",
              foreignField: "_id",
              as: "customerData",
            },
          },
          { $unwind: "$customerData" },
          {
            $group: {
              _id: "$customer",
              first_name: { $first: "$customerData.first_name" },
              last_name: { $first: "$customerData.last_name" },
              total_sales: { $sum: "$total" },
              order_count: { $sum: 1 },
            },
          },
          { $sort: { total_sales: -1 } },
        ]);

        const barData = salesByCustomer.map((item) => ({
          customer: `${item.first_name || ""} ${item.last_name || ""}`.trim(),
          total_sales: Number(item.total_sales || 0),
          order_count: item.order_count,
        }));

        result = { bar_data: barData };
      } else if (reportKey === "sales_by_location") {
        // Similar approach with aggregation
        const salesByLocation = await Order.aggregate([
          { $match: query },
          {
            $lookup: {
              from: "customers",
              localField: "customer",
              foreignField: "_id",
              as: "customerData",
            },
          },
          { $unwind: "$customerData" },
          {
            $group: {
              _id: "$customerData.city",
              total_sales: { $sum: "$total" },
              order_count: { $sum: 1 },
            },
          },
          { $sort: { total_sales: -1 } },
        ]);

        const barData = salesByLocation.map((item) => ({
          city: item._id || "Unknown",
          total_sales: Number(item.total_sales || 0),
          order_count: item.order_count,
        }));

        result = { bar_data: barData };
      } else if (reportKey === "financial_reports") {
        // Get revenue, costs, and profit
        const financialData = await Order.aggregate([
          { $match: query },
          {
            $group: {
              _id: null,
              total_revenue: { $sum: "$total" },
              total_cost: { $sum: "$cost" },
            },
          },
        ]);

        const totalRevenue =
          financialData.length > 0
            ? Number(financialData[0].total_revenue || 0)
            : 0;
        const totalCost =
          financialData.length > 0
            ? Number(financialData[0].total_cost || 0)
            : 0;
        const netProfit = totalRevenue - totalCost;

        // Monthly profit breakdown
        const monthlyProfit = await Order.aggregate([
          { $match: query },
          {
            $project: {
              month: {
                $dateToString: { format: "%Y-%m", date: "$created_at" },
              },
              revenue: "$total",
              cost: "$cost",
            },
          },
          {
            $group: {
              _id: "$month",
              revenue: { $sum: "$revenue" },
              cost: { $sum: "$cost" },
            },
          },
          { $sort: { _id: 1 } },
        ]);

        const barData = monthlyProfit.map((item) => {
          const date = new Date(item._id + "-01"); // Add day to make a valid date
          const monthStr = date.toLocaleString("en-US", {
            month: "long",
            year: "numeric",
          });
          const profit = Number(item.revenue || 0) - Number(item.cost || 0);

          return {
            month: monthStr,
            net_profit: profit,
          };
        });

        result = {
          net_profit: netProfit,
          bar_data: barData,
        };
      }
    }
    // For inventory reports
    else if (
      [
        "inventory_levels",
        "inventory_valuation",
        "inventory_movement",
        "variant_inventory",
      ].includes(reportKey)
    ) {
      // Build the query
      let query = { supplier: user.id };
      if (startDate) {
        query.created_at = { $gte: startDate };
      }
      if (endDate) {
        query.created_at = { ...query.created_at, $lte: endDate };
      }

      if (reportKey === "inventory_levels") {
        const inventoryLevels = await Product.aggregate([
          { $match: query },
          {
            $group: {
              _id: "$title",
              current_stock: { $sum: "$quantity" },
            },
          },
          { $sort: { _id: 1 } },
        ]);

        const barData = inventoryLevels.map((item) => ({
          title: item._id,
          current_stock: item.current_stock,
        }));

        result = { bar_data: barData };
      } else if (reportKey === "inventory_valuation") {
        const valuationData = await Product.aggregate([
          { $match: query },
          {
            $project: {
              value: { $multiply: ["$quantity", "$cost_per_item"] },
            },
          },
          {
            $group: {
              _id: null,
              total_value: { $sum: "$value" },
            },
          },
        ]);

        const inventoryValue =
          valuationData.length > 0
            ? Number(valuationData[0].total_value || 0)
            : 0;

        result = { inventory_value: inventoryValue };
      } else if (reportKey === "inventory_movement") {
        result = { message: "Inventory movement report not implemented." };
      } else if (reportKey === "variant_inventory") {
        result = { message: "Variant inventory report not implemented." };
      }
    } else {
      return res.status(400).json({ error: "Unsupported report key" });
    }

    const response = {
      message: "Data retrieved successfully",
      report_data: result,
    };

    // Encrypt the response
    const encryptedResponse = encrypt(JSON.stringify(response));
    return res.status(200).json({ data: encryptedResponse });
  } catch (error) {
    console.error("Error generating report:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
