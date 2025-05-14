const Order = require("../models/Order");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Generate a report based on table_name and filter
// @route   POST /supplier/generate_report
// @access  Private (Supplier Only)
exports.generateReport = async (req, res) => {
  try {
    const user = req.user;

    // Get the data
    const data = req.body;
    console.log(data);
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
      let query = { supplier_id: user.id };
      if (startDate) {
        query.createdAt = { $gte: startDate };
      }
      if (endDate) {
        query.createdAt = { ...query.createdAt, $lte: endDate };
      }

      if (reportKey === "sales_overview") {
        // Total sales, total orders and average order value
        const orders = await Order.find(query);
        const totalSales = orders.reduce(
          (sum, order) => sum + (order.calculations.total || 0),
          0
        );
        const totalOrders = orders.length;
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

        // Daily sales breakdown for bar graph
        const salesByDay = {};
        orders.forEach((order) => {
          const day = order.createdAt.toISOString().split("T")[0]; // YYYY-MM-DD format
          if (!salesByDay[day]) {
            salesByDay[day] = 0;
          }
          salesByDay[day] += order.calculations.total || 0;
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
        console.log(query);

        const orders = await Order.find(query);
        console.log(orders);
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
              productTotal =
                count > 0 && order.calculations.total
                  ? order.calculations.total / count
                  : 0;
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
        // Improved implementation using Customer model directly
        const orders = await Order.find(query);

        // Create a map to aggregate customer sales
        const customerSalesMap = {};

        // Process each order to build customer sales data
        for (const order of orders) {
          const customerId = order.customer_id;
          if (!customerId) continue;

          if (!customerSalesMap[customerId]) {
            // Initialize customer data if not already in map
            customerSalesMap[customerId] = {
              total_sales: 0,
              order_count: 0,
              customer_info: null,
            };

            // Fetch customer info
            try {
              const customer = await Customer.findById(customerId);
              if (customer) {
                customerSalesMap[customerId].customer_info = {
                  first_name: customer.first_name,
                  last_name: customer.last_name,
                  email: customer.email,
                  phone_number: customer.phone_number,
                  amount_spent: customer.amount_spent, // Add the amount_spent field
                  orders_count: customer.orders_count, // Add orders_count as well
                  default_address: customer.default_address,
                };
              }
            } catch (error) {
              console.error(`Error fetching customer ${customerId}:`, error);
            }
          }

          // Add order data to customer totals (for the current date range)
          customerSalesMap[customerId].total_sales += Number(order.total || 0);
          customerSalesMap[customerId].order_count += 1;
        }

        // Convert map to array for the response
        const barData = Object.entries(customerSalesMap)
          .map(([customerId, data]) => {
            const customerInfo = data.customer_info || {};
            return {
              customer_id: customerId,
              customer:
                `${customerInfo.first_name || ""} ${
                  customerInfo.last_name || ""
                }`.trim() || "Unknown",
              email: customerInfo.email || "N/A",
              phone: customerInfo.phone_number || "N/A",
              // Use the total_sales from orders in the date range for chart data
              total_sales: customerInfo.amount_spent || 0,
              order_count: customerInfo.orders_count || 0,
              // Include the customer's lifetime stats from the Customer model
              lifetime_amount_spent: customerInfo.amount_spent || 0,
              lifetime_orders_count: customerInfo.orders_count || 0,
              address: customerInfo.default_address || "N/A",
            };
          })
          .sort((a, b) => b.total_sales - a.total_sales);

        result = { bar_data: barData };
      } else if (reportKey === "sales_by_location") {
        // Using the Customer model for improved location data
        // First get all customers for this supplier
        const customers = await Customer.find({ supplier_id: user.id });

        // Build a map of customer cities
        const customerCities = {};
        console.log(customers);
        customers.forEach((customer) => {
          if (customer._id) {
            customerCities[customer._id.toString()] =
              customer.default_address || "Unknown";
          }
        });

        // Get all orders
        const orders = await Order.find(query);

        // Build sales by location
        const cityStats = {};

        orders.forEach((order) => {
          // Get customer location from the map
          const customerId = order.customer ? order.customer.toString() : null;
          const city = customerId ? customerCities[customerId] : "Unknown";

          if (!cityStats[city]) {
            cityStats[city] = {
              total_sales: 0,
              order_count: 0,
            };
          }

          cityStats[city].total_sales += Number(order.total || 0);
          cityStats[city].order_count += 1;
        });

        // Convert to array for the response
        const barData = Object.entries(cityStats)
          .map(([city, stats]) => ({
            city: city || "Unknown",
            total_sales: stats.total_sales,
            order_count: stats.order_count,
          }))
          .sort((a, b) => b.total_sales - a.total_sales);

        result = { bar_data: barData };
      } else if (reportKey === "financial_reports") {
        // Get revenue, costs, and profit
        const orders = await Order.find(query);

        let totalRevenue = 0;
        let totalCost = 0;

        // Monthly breakdown
        const monthlyStats = {};

        orders.forEach((order) => {
          totalRevenue += Number(order.total || 0);
          totalCost += Number(order.cost || 0);

          // Get month in YYYY-MM format
          const month = order.createdAt.toISOString().substring(0, 7);

          if (!monthlyStats[month]) {
            monthlyStats[month] = {
              revenue: 0,
              cost: 0,
            };
          }

          monthlyStats[month].revenue += Number(order.total || 0);
          monthlyStats[month].cost += Number(order.cost || 0);
        });

        const netProfit = totalRevenue - totalCost;

        // Create bar data for monthly profit
        const barData = Object.entries(monthlyStats)
          .map(([month, stats]) => {
            const date = new Date(`${month}-01`);
            const monthStr = date.toLocaleString("en-US", {
              month: "long",
              year: "numeric",
            });
            const profit = stats.revenue - stats.cost;

            return {
              month: monthStr,
              net_profit: profit,
              revenue: stats.revenue,
              cost: stats.cost,
            };
          })
          .sort((a, b) => {
            // Sort by date (extract year and month from the month string)
            const [aMonth, aYear] = a.month.split(" ");
            const [bMonth, bYear] = b.month.split(" ");

            if (aYear !== bYear) {
              return aYear - bYear;
            }

            const months = [
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
            ];
            return months.indexOf(aMonth) - months.indexOf(bMonth);
          });

        result = {
          net_profit: netProfit,
          total_revenue: totalRevenue,
          total_cost: totalCost,
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
      let query = { supplier_id: user.id };
      if (startDate) {
        query.createdAt = { $gte: startDate };
      }
      if (endDate) {
        query.createdAt = { ...query.createdAt, $lte: endDate };
      }

      if (reportKey === "inventory_levels") {
        // Get all products
        const products = await Product.find(query);

        // Group by title
        const productsByTitle = {};

        products.forEach((product) => {
          const title = product.title || "Unnamed Product";

          if (!productsByTitle[title]) {
            productsByTitle[title] = {
              current_stock: 0,
              products: [],
            };
          }

          productsByTitle[title].current_stock += Number(product.quantity || 0);
          productsByTitle[title].products.push({
            id: product._id,
            sku: product.sku,
            quantity: product.quantity,
          });
        });

        // Create bar data
        const barData = Object.entries(productsByTitle)
          .map(([title, data]) => ({
            title,
            current_stock: data.current_stock,
            variants: data.products.length,
          }))
          .sort((a, b) => a.title.localeCompare(b.title));

        result = { bar_data: barData };
      } else if (reportKey === "inventory_valuation") {
        // Get all products
        const products = await Product.find(query);

        let totalValue = 0;
        let productValueData = [];

        // Calculate value for each product
        products.forEach((product) => {
          const quantity = Number(product.quantity || 0);
          const costPerItem = Number(product.cost_per_item || 0);
          const value = quantity * costPerItem;

          totalValue += value;

          if (value > 0) {
            productValueData.push({
              product: product.title || "Unnamed Product",
              quantity,
              cost_per_item: costPerItem,
              value,
            });
          }
        });

        // Sort by value (highest first)
        productValueData.sort((a, b) => b.value - a.value);

        result = {
          inventory_value: totalValue,
          product_breakdown: productValueData,
        };
      } else if (reportKey === "inventory_movement") {
        result = { message: "Inventory movement report not implemented." };
      } else if (reportKey === "variant_inventory") {
        // Get all products with variants
        const products = await Product.find(query);

        // Group products by parent/variant relationship
        const variantGroups = {};

        products.forEach((product) => {
          // Assuming product has parent_id field to identify variants
          // If it's a variant, add to parent's group
          if (product.parent_id) {
            const parentId = product.parent_id.toString();

            if (!variantGroups[parentId]) {
              variantGroups[parentId] = {
                parent_title: "Unknown",
                variants: [],
                total_quantity: 0,
              };
            }

            variantGroups[parentId].variants.push({
              id: product._id,
              title: product.title,
              sku: product.sku,
              quantity: product.quantity || 0,
              options: product.options || {}, // Variant options like color, size, etc.
            });

            variantGroups[parentId].total_quantity += Number(
              product.quantity || 0
            );
          }
          // If it's a parent product or standalone product with variants
          else if (product.has_variants) {
            const productId = product._id.toString();

            if (!variantGroups[productId]) {
              variantGroups[productId] = {
                parent_title: product.title,
                variants: [],
                total_quantity: 0,
              };
            } else {
              variantGroups[productId].parent_title = product.title;
            }
          }
        });

        // Convert to array for the response
        const variantData = Object.entries(variantGroups)
          .map(([parentId, data]) => ({
            parent_id: parentId,
            parent_title: data.parent_title,
            variant_count: data.variants.length,
            total_quantity: data.total_quantity,
            variants: data.variants,
          }))
          .filter((item) => item.variant_count > 0) // Only include products with variants
          .sort((a, b) => b.total_quantity - a.total_quantity);

        result = {
          variant_data: variantData,
          total_variant_products: variantData.length,
        };
      }
    } else {
      return res.status(400).json({ error: "Unsupported report key" });
    }

    const response = {
      message: "Data retrieved successfully",
      report_data: result,
    };

    // encryptData the response
    const encryptedResponse = encryptData(response);
    return res.status(200).json({ data: encryptedResponse });
  } catch (error) {
    console.error("Error generating report:", error);
    return res.status(500).json({ error: "Server error" });
  }
};
