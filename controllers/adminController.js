// controllers/adminController.js
const User = require("../models/User");
const Order = require("../models/Order");
const ClientOrder = require("../models/ClientOrder");
const Customer = require("../models/Customer");
const Service = require("../models/Service");
const ProjectJob = require("../models/ProjectJob");
const { encryptData } = require("../utils/encryptResponse");

// Helper function to calculate trending percentage
const calculateTrending = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  const trend = ((current - previous) / previous) * 100;
  return parseFloat(trend.toFixed(1));
};

// Helper function to determine if trending is positive
const isTrendingPositive = (trendValue) => trendValue > 0;

// Helper function to get date ranges
const getDateRanges = () => {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
    999
  );

  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const previous30Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  return {
    currentMonthStart,
    currentMonthEnd,
    previousMonthStart,
    previousMonthEnd,
    last30Days,
    previous30Days,
    now,
  };
};

// @desc    Get admin dashboard data
// @route   GET /admin/dashboard
// @access  Private (Admin Only)
exports.getAdminDashboard = async (req, res) => {
  try {
    const dateRanges = getDateRanges();
    const {
      currentMonthStart,
      currentMonthEnd,
      previousMonthStart,
      previousMonthEnd,
      last30Days,
      previous30Days,
      now,
    } = dateRanges;

    // 1. Total Clients
    const totalClientsCurrentMonth = await User.countDocuments({
      user_type: "client",
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const totalClientsPreviousMonth = await User.countDocuments({
      user_type: "client",
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const totalClientsOverall = await User.countDocuments({
      user_type: "client",
    });

    // 2. Active Service Providers
    const activeServiceProvidersCurrentMonth = await User.countDocuments({
      user_type: "service_provider",
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const activeServiceProvidersPreviousMonth = await User.countDocuments({
      user_type: "service_provider",
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const activeServiceProvidersOverall = await User.countDocuments({
      user_type: "service_provider",
    });

    // 3. Total Suppliers
    const totalSuppliersCurrentMonth = await User.countDocuments({
      user_type: "supplier",
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const totalSuppliersPreviousMonth = await User.countDocuments({
      user_type: "supplier",
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const totalSuppliersOverall = await User.countDocuments({
      user_type: "supplier",
    });

    // 4. Total Revenue (from both Orders and ClientOrders)
    const currentMonthRevenue = await Promise.all([
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$calculations.total" } } },
      ]),
      ClientOrder.aggregate([
        {
          $match: {
            placed_at: { $gte: currentMonthStart, $lte: currentMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);

    const previousMonthRevenue = await Promise.all([
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$calculations.total" } } },
      ]),
      ClientOrder.aggregate([
        {
          $match: {
            placed_at: { $gte: previousMonthStart, $lte: previousMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);

    const currentRevenue =
      (currentMonthRevenue[0][0]?.total || 0) +
      (currentMonthRevenue[1][0]?.total || 0);
    const previousRevenue =
      (previousMonthRevenue[0][0]?.total || 0) +
      (previousMonthRevenue[1][0]?.total || 0);

    // 5. Active Projects
    const activeProjectsCurrent = await ProjectJob.countDocuments({
      status: { $in: ["open", "in_progress"] },
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const activeProjectsPrevious = await ProjectJob.countDocuments({
      status: { $in: ["open", "in_progress"] },
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const activeProjectsOverall = await ProjectJob.countDocuments({
      status: { $in: ["open", "in_progress"] },
    });

    // 6. Pending Orders
    const pendingOrdersCurrent = await Promise.all([
      Order.countDocuments({
        status: "pending",
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
      ClientOrder.countDocuments({
        status: "pending",
        placed_at: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
    ]);
    const pendingOrdersPrevious = await Promise.all([
      Order.countDocuments({
        status: "pending",
        createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
      }),
      ClientOrder.countDocuments({
        status: "pending",
        placed_at: { $gte: previousMonthStart, $lte: previousMonthEnd },
      }),
    ]);

    const currentPendingOrders =
      pendingOrdersCurrent[0] + pendingOrdersCurrent[1];
    const previousPendingOrders =
      pendingOrdersPrevious[0] + pendingOrdersPrevious[1];
    const totalPendingOrders =
      (await Order.countDocuments({ status: "pending" })) +
      (await ClientOrder.countDocuments({ status: "pending" }));

    // 7. Active Services
    const activeServicesCurrent = await Service.countDocuments({
      service_status: true,
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const activeServicesPrevious = await Service.countDocuments({
      service_status: true,
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const activeServicesOverall = await Service.countDocuments({
      service_status: true,
    });

    // 8. Platform Growth (total users growth)
    const platformGrowthCurrent = await User.countDocuments({
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const platformGrowthPrevious = await User.countDocuments({
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const totalUsers = await User.countDocuments({});

    // Sales Chart Data (last 30 days)
    const salesChartData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      const dateEnd = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
        999
      );

      const [services, orders] = await Promise.all([
        Service.countDocuments({
          createdAt: { $gte: dateStart, $lte: dateEnd },
        }),
        Promise.all([
          Order.countDocuments({
            createdAt: { $gte: dateStart, $lte: dateEnd },
          }),
          ClientOrder.countDocuments({
            placed_at: { $gte: dateStart, $lte: dateEnd },
          }),
        ]),
      ]);

      salesChartData.push({
        date: dateStart.toISOString().split("T")[0],
        services: services,
        orders: orders[0] + orders[1],
      });
    }

    // Recent Activities (last 20 activities)
    const recentActivities = [];

    // Get recent users
    const recentUsers = await User.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select("username user_type createdAt");

    // Get recent orders
    const recentOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select("order_no status createdAt");

    // Get recent client orders
    const recentClientOrders = await ClientOrder.find({})
      .sort({ placed_at: -1 })
      .limit(5)
      .select("order_no status placed_at");

    // Get recent projects
    const recentProjects = await ProjectJob.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title status createdAt");

    // Format activities
    recentUsers.forEach((user) => {
      recentActivities.push({
        label: `New ${user.user_type} registered`,
        detail: `${user.username} joined the platform`,
        time: user.createdAt,
        type: "user_registration",
      });
    });

    recentOrders.forEach((order) => {
      recentActivities.push({
        label: "New order placed",
        detail: `Order ${order.order_no} - Status: ${order.status}`,
        time: order.createdAt,
        type: "order",
      });
    });

    recentClientOrders.forEach((order) => {
      recentActivities.push({
        label: "New client order placed",
        detail: `Order ${order.order_no} - Status: ${order.status}`,
        time: order.placed_at,
        type: "client_order",
      });
    });

    recentProjects.forEach((project) => {
      recentActivities.push({
        label: "New project created",
        detail: `${project.title} - Status: ${project.status}`,
        time: project.createdAt,
        type: "project",
      });
    });

    // Sort activities by time and limit to 20
    recentActivities.sort((a, b) => new Date(b.time) - new Date(a.time));
    const activities = recentActivities.slice(0, 20);

    // Build stats object
    const stats = {
      total_clients: {
        value: totalClientsOverall,
        trendingValue: calculateTrending(
          totalClientsCurrentMonth,
          totalClientsPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(totalClientsCurrentMonth, totalClientsPreviousMonth)
        ),
      },
      active_service_providers: {
        value: activeServiceProvidersOverall,
        trendingValue: calculateTrending(
          activeServiceProvidersCurrentMonth,
          activeServiceProvidersPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            activeServiceProvidersCurrentMonth,
            activeServiceProvidersPreviousMonth
          )
        ),
      },
      total_supplier: {
        value: totalSuppliersOverall,
        trendingValue: calculateTrending(
          totalSuppliersCurrentMonth,
          totalSuppliersPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            totalSuppliersCurrentMonth,
            totalSuppliersPreviousMonth
          )
        ),
      },
      total_revenue: {
        value: currentRevenue,
        trendingValue: calculateTrending(currentRevenue, previousRevenue),
        isTrending: isTrendingPositive(
          calculateTrending(currentRevenue, previousRevenue)
        ),
      },
      active_project: {
        value: activeProjectsOverall,
        trendingValue: calculateTrending(
          activeProjectsCurrent,
          activeProjectsPrevious
        ),
        isTrending: isTrendingPositive(
          calculateTrending(activeProjectsCurrent, activeProjectsPrevious)
        ),
      },
      pending_orders: {
        value: totalPendingOrders,
        trendingValue: calculateTrending(
          currentPendingOrders,
          previousPendingOrders
        ),
        isTrending: isTrendingPositive(
          calculateTrending(currentPendingOrders, previousPendingOrders)
        ),
      },
      active_services: {
        value: activeServicesOverall,
        trendingValue: calculateTrending(
          activeServicesCurrent,
          activeServicesPrevious
        ),
        isTrending: isTrendingPositive(
          calculateTrending(activeServicesCurrent, activeServicesPrevious)
        ),
      },
      platform_growth: {
        value: totalUsers,
        trendingValue: calculateTrending(
          platformGrowthCurrent,
          platformGrowthPrevious
        ),
        isTrending: isTrendingPositive(
          calculateTrending(platformGrowthCurrent, platformGrowthPrevious)
        ),
      },
    };

    const responseData = {
      message: "Admin dashboard data retrieved successfully",
      stats,
      sales_chart_data: salesChartData,
      activities,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting admin dashboard data:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get admin orders data
// @route   GET /admin/get_orders
// @access  Private (Admin Only)
exports.getAdminOrders = async (req, res) => {
  try {
    const dateRanges = getDateRanges();
    const {
      currentMonthStart,
      currentMonthEnd,
      previousMonthStart,
      previousMonthEnd,
    } = dateRanges;

    // 1. Total Clients (customers who placed orders)
    const currentMonthClientOrdersCount = await ClientOrder.distinct(
      "client_id",
      {
        placed_at: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }
    );
    const previousMonthClientOrdersCount = await ClientOrder.distinct(
      "client_id",
      {
        placed_at: { $gte: previousMonthStart, $lte: previousMonthEnd },
      }
    );

    const currentMonthSupplierOrdersCount = await Order.distinct(
      "customer_id",
      {
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }
    );
    const previousMonthSupplierOrdersCount = await Order.distinct(
      "customer_id",
      {
        createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
      }
    );

    const totalClientsCurrentMonth =
      currentMonthClientOrdersCount.length +
      currentMonthSupplierOrdersCount.length;
    const totalClientsPreviousMonth =
      previousMonthClientOrdersCount.length +
      previousMonthSupplierOrdersCount.length;

    // Total unique customers overall
    const allClientOrders = await ClientOrder.distinct("client_id");
    const allSupplierOrders = await Order.distinct("customer_id");
    const totalClientsOverall =
      allClientOrders.length + allSupplierOrders.length;

    // 2. Total Sales (revenue)
    const currentMonthSales = await Promise.all([
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$calculations.total" } } },
      ]),
      ClientOrder.aggregate([
        {
          $match: {
            placed_at: { $gte: currentMonthStart, $lte: currentMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);

    const previousMonthSales = await Promise.all([
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$calculations.total" } } },
      ]),
      ClientOrder.aggregate([
        {
          $match: {
            placed_at: { $gte: previousMonthStart, $lte: previousMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);

    const currentSales =
      (currentMonthSales[0][0]?.total || 0) +
      (currentMonthSales[1][0]?.total || 0);
    const previousSales =
      (previousMonthSales[0][0]?.total || 0) +
      (previousMonthSales[1][0]?.total || 0);

    // Total sales overall
    const totalSalesOverall = await Promise.all([
      Order.aggregate([
        { $group: { _id: null, total: { $sum: "$calculations.total" } } },
      ]),
      ClientOrder.aggregate([
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);
    const overallSales =
      (totalSalesOverall[0][0]?.total || 0) +
      (totalSalesOverall[1][0]?.total || 0);

    // 3. Total Orders
    const currentMonthOrders = await Promise.all([
      Order.countDocuments({
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
      ClientOrder.countDocuments({
        placed_at: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
    ]);

    const previousMonthOrders = await Promise.all([
      Order.countDocuments({
        createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
      }),
      ClientOrder.countDocuments({
        placed_at: { $gte: previousMonthStart, $lte: previousMonthEnd },
      }),
    ]);

    const currentOrdersCount = currentMonthOrders[0] + currentMonthOrders[1];
    const previousOrdersCount = previousMonthOrders[0] + previousMonthOrders[1];

    // Total orders overall
    const totalOrdersOverall =
      (await Order.countDocuments()) + (await ClientOrder.countDocuments());

    // 4. Conversion Rate (orders/unique visitors - simplified as orders/total_users)
    const totalUsers = await User.countDocuments();
    const conversionRate =
      totalUsers > 0
        ? ((totalOrdersOverall / totalUsers) * 100).toFixed(2)
        : "0.00";

    const currentUsersCount = await User.countDocuments({
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const previousUsersCount = await User.countDocuments({
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });

    const currentConversionRate =
      currentUsersCount > 0
        ? (currentOrdersCount / currentUsersCount) * 100
        : 0;
    const previousConversionRate =
      previousUsersCount > 0
        ? (previousOrdersCount / previousUsersCount) * 100
        : 0;

    // Get detailed orders data
    const [supplierOrders, clientOrders] = await Promise.all([
      Order.find({})
        .populate("supplier_id", "username email")
        .populate("customer_id", "first_name last_name email")
        .sort({ createdAt: -1 })
        .limit(50),
      ClientOrder.find({})
        .populate("client_id", "username email")
        .populate("supplier_id", "username email")
        .sort({ placed_at: -1 })
        .limit(50),
    ]);

    // Format orders according to specification
    const formattedOrders = [];

    // Format supplier orders
    supplierOrders.forEach((order) => {
      const items =
        order.products
          ?.map((product) => product.title || "Product")
          .filter(Boolean) || [];

      formattedOrders.push({
        order_no: order.order_no,
        customer: {
          full_name: order.customer_id
            ? `${order.customer_id.first_name || ""} ${
                order.customer_id.last_name || ""
              }`.trim() || order.customer_id
            : "Unknown Customer",
          email: order.customer_id?.email || "N/A",
        },
        items: items,
        supplier_name: order.supplier_id?.username || "Unknown Supplier",
        amount: order.calculations?.total || 0,
        date: order.createdAt.toISOString(),
        status: order.status,
      });
    });

    // Format client orders
    clientOrders.forEach((order) => {
      const items =
        order.items?.map((item) => item.title || "Item").filter(Boolean) || [];

      formattedOrders.push({
        order_no: order.order_no,
        customer: {
          full_name:
            order.customer_details?.firstName &&
            order.customer_details?.lastName
              ? `${order.customer_details.firstName} ${order.customer_details.lastName}`
              : order.client_id?.username || "Unknown Customer",
          email:
            order.customer_details?.email || order.client_id?.email || "N/A",
        },
        items: items,
        supplier_name: order.supplier_id?.username || "Unknown Supplier",
        amount: order.total || 0,
        date: order.placed_at?.toISOString() || order.createdAt?.toISOString(),
        status: order.status,
      });
    });

    // Sort all orders by date (newest first)
    formattedOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Build stats object
    const stats = {
      total_clients: {
        value: totalClientsOverall,
        trendingValue: calculateTrending(
          totalClientsCurrentMonth,
          totalClientsPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(totalClientsCurrentMonth, totalClientsPreviousMonth)
        ),
      },
      total_sales: {
        value: overallSales,
        trendingValue: calculateTrending(currentSales, previousSales),
        isTrending: isTrendingPositive(
          calculateTrending(currentSales, previousSales)
        ),
      },
      orders: {
        value: totalOrdersOverall,
        trendingValue: calculateTrending(
          currentOrdersCount,
          previousOrdersCount
        ),
        isTrending: isTrendingPositive(
          calculateTrending(currentOrdersCount, previousOrdersCount)
        ),
      },
      conversion_rate: {
        value: `${conversionRate}%`,
        trendingValue: calculateTrending(
          currentConversionRate,
          previousConversionRate
        ),
        isTrending: isTrendingPositive(
          calculateTrending(currentConversionRate, previousConversionRate)
        ),
      },
    };

    const responseData = {
      message: "Admin orders data retrieved successfully",
      stats,
      orders: formattedOrders,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting admin orders data:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get order details for admin
// @route   GET /admin/get_order_details
// @access  Private (Admin Only)
exports.getOrderDetails = async (req, res) => {
  try {
    const { order_no } = req.query;

    if (!order_no) {
      return res.status(400).json({ error: "Order number is required" });
    }

    // Try to find the order in both Order and ClientOrder collections
    const [supplierOrder, clientOrder] = await Promise.all([
      Order.findOne({ order_no })
        .populate("supplier_id", "username email")
        .populate(
          "customer_id",
          "first_name last_name email phone_number createdAt"
        ),
      ClientOrder.findOne({ order_no })
        .populate("client_id", "username email createdAt")
        .populate("supplier_id", "username email"),
    ]);

    let order = supplierOrder || clientOrder;
    let isClientOrder = !!clientOrder;

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Format items based on order type
    let formattedItems = [];

    if (isClientOrder) {
      // Client order items
      formattedItems =
        order.items?.map((item, index) => ({
          order_no: order.order_no,
          product: {
            name: item.title || `Product ${index + 1}`,
            type: "physical", // You may need to adjust this based on your product model
          },
          category: item.category || "General",
          quantity: item.quantity || 1,
          unit_price: item.price || 0,
          total: item.total || item.price * item.quantity || 0,
        })) || [];
    } else {
      // Supplier order items
      formattedItems =
        order.products?.map((product, index) => ({
          order_no: order.order_no,
          product: {
            name: product.title || `Product ${index + 1}`,
            type: product.physical_product ? "physical" : "digital",
          },
          category: product.category || "General",
          quantity: product.qty || product.quantity || 1,
          unit_price: product.price || 0,
          total: product.price * (product.qty || product.quantity || 1) || 0,
        })) || [];
    }

    // Get customer information and stats
    let customerInfo = {};
    let totalOrders = 0;
    let totalSpent = 0;

    if (isClientOrder) {
      const clientId = order.client_id?._id;
      if (clientId) {
        // Get client's order history
        const [clientOrderCount, clientOrderTotal] = await Promise.all([
          ClientOrder.countDocuments({ client_id: clientId }),
          ClientOrder.aggregate([
            { $match: { client_id: clientId } },
            { $group: { _id: null, total: { $sum: "$total" } } },
          ]),
        ]);

        totalOrders = clientOrderCount;
        totalSpent = clientOrderTotal[0]?.total || 0;
      }

      customerInfo = {
        full_name:
          order.customer_details?.firstName && order.customer_details?.lastName
            ? `${order.customer_details.firstName} ${order.customer_details.lastName}`
            : order.client_id?.username || "Unknown Customer",
        email: order.customer_details?.email || order.client_id?.email || "N/A",
        phone_number: order.customer_details?.phone || "N/A",
        total_orders: totalOrders,
        total_spent: totalSpent,
        created_at:
          order.client_id?.createdAt?.toISOString() ||
          order.createdAt?.toISOString(),
      };
    } else {
      const customerId = order.customer_id?._id;
      if (customerId) {
        // Get customer's order history from both collections
        const [
          supplierOrderCount,
          supplierOrderTotal,
          clientOrderCount,
          clientOrderTotal,
        ] = await Promise.all([
          Order.countDocuments({ customer_id: customerId }),
          Order.aggregate([
            { $match: { customer_id: customerId } },
            { $group: { _id: null, total: { $sum: "$calculations.total" } } },
          ]),
          ClientOrder.countDocuments({ client_id: customerId }),
          ClientOrder.aggregate([
            { $match: { client_id: customerId } },
            { $group: { _id: null, total: { $sum: "$total" } } },
          ]),
        ]);

        totalOrders = supplierOrderCount + clientOrderCount;
        totalSpent =
          (supplierOrderTotal[0]?.total || 0) +
          (clientOrderTotal[0]?.total || 0);
      }

      customerInfo = {
        full_name: order.customer_id
          ? `${order.customer_id.first_name || ""} ${
              order.customer_id.last_name || ""
            }`.trim()
          : "Unknown Customer",
        email: order.customer_id?.email || "N/A",
        phone_number: order.customer_id?.phone_number || "N/A",
        total_orders: totalOrders,
        total_spent: totalSpent,
        created_at:
          order.customer_id?.createdAt?.toISOString() ||
          order.createdAt?.toISOString(),
      };
    }

    // Order timeline
    const orderTimeline = {
      order_place_at: isClientOrder ? order.placed_at : order.createdAt,
      payment_pending: isClientOrder
        ? order.payment_status === "pending"
        : !order.payment_status,
      processing: isClientOrder
        ? order.status === "processing"
        : order.status === "processing",
      delivery: isClientOrder
        ? order.status === "delivered"
          ? "delivered"
          : "pending"
        : order.delivery_status
        ? "delivered"
        : "pending",
    };

    // Order summary
    let orderSummary = {};

    if (isClientOrder) {
      orderSummary = {
        new_order: order.subtotal || 0,
        discount: 0, // You may need to calculate this based on your discount system
        tax: order.tax || 0,
        shipping: order.shipping || 0,
        total: order.total || 0,
        amount_paid: order.payment_status === "paid" ? order.total : 0,
        balance_due: order.payment_status === "paid" ? 0 : order.total,
      };
    } else {
      const calculations = order.calculations || {};
      orderSummary = {
        new_order: calculations.subtotal || 0,
        discount: calculations.totalDiscount || 0,
        tax: calculations.totalTax || 0,
        shipping: 0, // Add shipping if available in your model
        total: calculations.total || 0,
        amount_paid: order.bill_paid || 0,
        balance_due: Math.max(
          0,
          (calculations.total || 0) - (order.bill_paid || 0)
        ),
      };
    }

    const responseData = {
      message: "Order details retrieved successfully",
      order: {
        items: formattedItems,
        customer: customerInfo,
        order_timeline: orderTimeline,
        order_summary: orderSummary,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting order details:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get admin products data
// @route   GET /admin/get_products
// @access  Private (Admin Only)
exports.getAdminProducts = async (req, res) => {
  try {
    const dateRanges = getDateRanges();
    const {
      currentMonthStart,
      currentMonthEnd,
      previousMonthStart,
      previousMonthEnd,
    } = dateRanges;

    // 1. Total Products
    const totalProductsCurrentMonth = await Product.countDocuments({
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const totalProductsPreviousMonth = await Product.countDocuments({
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const totalProductsOverall = await Product.countDocuments({});

    // 2. Active Products
    const activeProductsCurrentMonth = await Product.countDocuments({
      status: "active",
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const activeProductsPreviousMonth = await Product.countDocuments({
      status: "active",
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const activeProductsOverall = await Product.countDocuments({
      status: "active",
    });

    // 3. Draft Products
    const draftProductsCurrentMonth = await Product.countDocuments({
      status: "draft",
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const draftProductsPreviousMonth = await Product.countDocuments({
      status: "draft",
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const draftProductsOverall = await Product.countDocuments({
      status: "draft",
    });

    // 4. Out of Stock Products (track_quantity = true and quantity <= min_qty)
    const outOfStockProductsCurrentMonth = await Product.countDocuments({
      track_quantity: true,
      $expr: { $lte: ["$quantity", "$min_qty"] },
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const outOfStockProductsPreviousMonth = await Product.countDocuments({
      track_quantity: true,
      $expr: { $lte: ["$quantity", "$min_qty"] },
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const outOfStockProductsOverall = await Product.countDocuments({
      track_quantity: true,
      $expr: { $lte: ["$quantity", "$min_qty"] },
    });

    // Get all products with supplier details for the products list
    const products = await Product.find({})
      .populate("supplier_id", "username email")
      .sort({ createdAt: -1 })
      .limit(100);

    // Format products according to specification
    const formattedProducts = products.map((product) => ({
      product_id: product._id.toString(),
      title: product.title || "Untitled Product",
      category: product.category || "Uncategorized",
      stock: product.track_quantity ? product.quantity : null,
      price: product.price || 0,
      date: product.createdAt.toISOString(),
      status: product.status || "draft",
    }));

    // Build stats object with labels
    const stats = {
      total_products: {
        label: "Total Products",
        value: totalProductsOverall,
        trendingValue: calculateTrending(
          totalProductsCurrentMonth,
          totalProductsPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            totalProductsCurrentMonth,
            totalProductsPreviousMonth
          )
        ),
      },
      active_products: {
        label: "Active Products",
        value: activeProductsOverall,
        trendingValue: calculateTrending(
          activeProductsCurrentMonth,
          activeProductsPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            activeProductsCurrentMonth,
            activeProductsPreviousMonth
          )
        ),
      },
      draft_products: {
        label: "Draft Products",
        value: draftProductsOverall,
        trendingValue: calculateTrending(
          draftProductsCurrentMonth,
          draftProductsPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            draftProductsCurrentMonth,
            draftProductsPreviousMonth
          )
        ),
      },
      out_of_stock: {
        label: "Out of Stock",
        value: outOfStockProductsOverall,
        trendingValue: calculateTrending(
          outOfStockProductsCurrentMonth,
          outOfStockProductsPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            outOfStockProductsCurrentMonth,
            outOfStockProductsPreviousMonth
          )
        ),
      },
    };

    const responseData = {
      message: "Admin products data retrieved successfully",
      stats,
      products: formattedProducts,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting admin products data:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get product details for admin
// @route   GET /admin/get_product_details
// @access  Private (Admin Only)
exports.getAdminProductDetails = async (req, res) => {
  try {
    const { product_id } = req.query;

    if (!product_id) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    // Find the product with supplier and collection details
    const product = await Product.findById(product_id)
      .populate("supplier_id", "username email")
      .populate("search_collection", "title");

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Calculate inventory metrics
    const available = product.track_quantity ? product.quantity : null;
    const committed = 0; // You may need to calculate this based on pending orders
    const low_stock =
      product.track_quantity && product.quantity <= product.min_qty;

    // Calculate profit per item
    const profit_per_item =
      product.price > 0 && product.cost_per_item > 0
        ? product.price - product.cost_per_item
        : product.profit || 0;

    // Format collections
    const collections = product.search_collection
      ? product.search_collection.map(
          (collection) => collection.title || collection._id.toString()
        )
      : [];

    // Format the product details according to specification
    const formattedProduct = {
      title: product.title || "Untitled Product",
      category: product.category || "Uncategorized",
      physical_product: product.physical_product || false,
      description: product.description || "",
      images: product.media || [],
      available: available,
      committed: committed,
      low_stock: product.min_qty || 10,
      track_quantity: product.track_quantity || false,
      continue_out_of_stock: product.continue_out_of_stock || false,
      weight: parseFloat(product.weight) || 0,
      unit: product.units || "",
      status: product.status || "draft",
      created_at: product.createdAt.toISOString(),
      tax: product.tax || false,
      price: product.price || 0,
      compare_at: product.compare_at_price || 0,
      cost_per_item: product.cost_per_item || 0,
      profit_per_item: profit_per_item,
      tags: product.search_tags || [],
      collections: collections,
    };

    const responseData = {
      message: "Product details retrieved successfully",
      product: formattedProduct,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting product details:", err);
    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid product ID format" });
    }
    res.status(500).json({ error: "Server error" });
  }
};
