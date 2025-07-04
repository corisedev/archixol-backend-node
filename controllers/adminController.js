// controllers/adminController.js (Fixed version for customer_id string issue)
const User = require("../models/User");
const UserProfile = require("../models/UserProfile");
const ClientProfile = require("../models/ClientProfile");
const Job = require("../models/Job");
const Order = require("../models/Order");
const ClientOrder = require("../models/ClientOrder");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const Service = require("../models/Service");
const ProjectJob = require("../models/ProjectJob");
const { encryptData } = require("../utils/encryptResponse");
const SupplierStore = require("../models/SupplierStore");
const Company = require("../models/Company");
const CompanyDocument = require("../models/CompanyDocument");
const Certificate = require("../models/Certificate");
const { StoreDetails } = require("../models/SupplierSettings");

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

// Helper function to get customer data for orders
const getCustomerDataForOrders = async (orders) => {
  // Extract unique customer IDs from orders
  const customerIds = [
    ...new Set(orders.map((order) => order.customer_id).filter(Boolean)),
  ];

  // Fetch customers from Customer collection
  const customers = await Customer.find({
    _id: { $in: customerIds },
  }).select("_id first_name last_name email phone_number createdAt");

  // Create a map for quick lookup
  const customerMap = new Map();
  customers.forEach((customer) => {
    customerMap.set(customer._id.toString(), customer);
  });

  return customerMap;
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
      accessRoles: "client",
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const totalClientsPreviousMonth = await User.countDocuments({
      accessRoles: "client",
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const totalClientsOverall = await User.countDocuments({
      accessRoles: "client",
    });

    // 2. Active Service Providers
    const activeServiceProvidersCurrentMonth = await User.countDocuments({
      accessRoles: "service_provider",
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const activeServiceProvidersPreviousMonth = await User.countDocuments({
      accessRoles: "service_provider",
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const activeServiceProvidersOverall = await User.countDocuments({
      accessRoles: "service_provider",
    });

    // 3. Total Suppliers
    const totalSuppliersCurrentMonth = await User.countDocuments({
      accessRoles: "supplier",
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const totalSuppliersPreviousMonth = await User.countDocuments({
      accessRoles: "supplier",
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const totalSuppliersOverall = await User.countDocuments({
      accessRoles: "supplier",
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

    // Get detailed orders data with manual customer lookup
    const [supplierOrders, clientOrders] = await Promise.all([
      Order.find({})
        .populate("supplier_id", "username email")
        .sort({ createdAt: -1 })
        .limit(50),
      ClientOrder.find({})
        .populate("client_id", "username email")
        .populate("supplier_id", "username email")
        .sort({ placed_at: -1 })
        .limit(50),
    ]);

    // Get customer data for supplier orders manually
    const customerMap = await getCustomerDataForOrders(supplierOrders);

    // Format orders according to specification
    const formattedOrders = [];

    // Format supplier orders with manual customer lookup
    supplierOrders.forEach((order) => {
      const items =
        order.products
          ?.map((product) => product.title || "Product")
          .filter(Boolean) || [];

      // Get customer data from our manual lookup
      const customerData = customerMap.get(order.customer_id);

      formattedOrders.push({
        order_no: order.order_no,
        customer: {
          full_name: customerData
            ? `${customerData.first_name || ""} ${
                customerData.last_name || ""
              }`.trim()
            : order.customer_id || "Unknown Customer",
          email: customerData?.email || "N/A",
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
// @route   POST /admin/get_order_details
// @access  Private (Admin Only)
exports.getOrderDetails = async (req, res) => {
  try {
    const { order_no } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: "Order number is required" });
    }

    // Try to find the order in both Order and ClientOrder collections
    const [supplierOrder, clientOrder] = await Promise.all([
      Order.findOne({ order_no }).populate("supplier_id", "username email"),
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
      // For supplier orders, manually get customer data
      let customerData = null;
      if (order.customer_id) {
        try {
          customerData = await Customer.findById(order.customer_id).select(
            "first_name last_name email phone_number createdAt"
          );
        } catch (error) {
          console.log(`Customer not found for ID: ${order.customer_id}`);
        }
      }

      if (customerData) {
        // Get customer's order history from both collections
        const [
          supplierOrderCount,
          supplierOrderTotal,
          clientOrderCount,
          clientOrderTotal,
        ] = await Promise.all([
          Order.countDocuments({ customer_id: order.customer_id }),
          Order.aggregate([
            { $match: { customer_id: order.customer_id } },
            { $group: { _id: null, total: { $sum: "$calculations.total" } } },
          ]),
          ClientOrder.countDocuments({ client_id: customerData._id }),
          ClientOrder.aggregate([
            { $match: { client_id: customerData._id } },
            { $group: { _id: null, total: { $sum: "$total" } } },
          ]),
        ]);

        totalOrders = supplierOrderCount + clientOrderCount;
        totalSpent =
          (supplierOrderTotal[0]?.total || 0) +
          (clientOrderTotal[0]?.total || 0);

        customerInfo = {
          full_name: `${customerData.first_name || ""} ${
            customerData.last_name || ""
          }`.trim(),
          email: customerData.email || "N/A",
          phone_number: customerData.phone_number || "N/A",
          total_orders: totalOrders,
          total_spent: totalSpent,
          created_at:
            customerData.createdAt?.toISOString() ||
            order.createdAt?.toISOString(),
        };
      } else {
        // Fallback if customer not found
        customerInfo = {
          full_name: order.customer_id || "Unknown Customer",
          email: "N/A",
          phone_number: "N/A",
          total_orders: 0,
          total_spent: 0,
          created_at: order.createdAt?.toISOString(),
        };
      }
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
// @route   POST /admin/get_product_details
// @access  Private (Admin Only)
exports.getAdminProductDetails = async (req, res) => {
  try {
    const { product_id } = req.body;

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

// @desc    Get all services for admin
// @route   GET /admin/get_services
// @access  Private (Admin Only)
exports.getAdminServices = async (req, res) => {
  try {
    // Get all services with populated service provider details
    const services = await Service.find({})
      .populate({
        path: "user",
        select: "username email user_type createdAt",
        model: "User",
      })
      .sort({ createdAt: -1 });

    // Format services according to specification
    const formattedServices = await Promise.all(
      services.map(async (service) => {
        // Get the first image from service_images array or use a default
        const image =
          service.service_images && service.service_images.length > 0
            ? service.service_images[0]
            : "/uploads/services/default-service.jpg";

        // Determine if service is top-rated (e.g., rating >= 4.5 and at least 10 reviews)
        const isRated = service.rating >= 4.5 && service.reviews_count >= 10;

        // Get service provider's profile for location
        if (service.user) {
          const userProfile = await UserProfile.findOne({
            user_id: service.user._id,
          }).select("service_location address");

          location =
            userProfile?.service_location ||
            userProfile?.address ||
            "Not specified";
        }

        return {
          id: service._id.toString(),
          image: image,
          title: service.service_title || "Untitled Service",
          category: service.service_category || "Uncategorized",
          detail: service.service_description || "No description available",
          rating: service.rating || 0,
          location: service.location || "Not Specified",
          rating_count: service.reviews_count || 0,
          isRated: isRated,
          service_provider: service.user || null,
        };
      })
    );

    const responseData = {
      message: "Services retrieved successfully",
      services: formattedServices,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting admin services data:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get service details for admin
// @route   POST /admin/get_service
// @access  Private (Admin Only)
exports.getAdminServiceDetails = async (req, res) => {
  try {
    const { service_id } = req.body;

    if (!service_id) {
      return res.status(400).json({ error: "Service ID is required" });
    }

    // Find the service with populated user details
    const service = await Service.findById(service_id).populate({
      path: "user",
      select: "username email user_type",
      model: "User",
    });

    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    // Get service provider's profile for location
    let location = "Not specified";
    if (service.user) {
      const userProfile = await UserProfile.findOne({
        user_id: service.user._id,
      }).select("service_location address");

      location =
        userProfile?.service_location ||
        userProfile?.address ||
        "Not specified";
    }

    // Get all jobs/requests for this service to calculate pricing
    const jobs = await Job.find({
      service: service_id,
      status: { $in: ["completed", "in_progress", "accepted"] },
    });

    // Calculate average price from completed jobs
    let price = 0;
    if (jobs.length > 0) {
      const totalPrice = jobs.reduce((sum, job) => sum + (job.price || 0), 0);
      price = totalPrice / jobs.length;
    }

    // Format the service details according to specification
    const formattedService = {
      title: service.service_title || "Untitled Service",
      price: price || 0, // Average price from jobs
      description: service.service_description || "No description available",
      about_service:
        service.service_description || "No additional information available",
      rating: service.rating || 0,
      average_rating: service.rating || 0, // Same as rating
      no_of_reviews: service.reviews_count || 0,
      images: service.service_images || [],
      category: service.service_category || "Uncategorized",
      location: location,
    };

    const responseData = {
      message: "Service details retrieved successfully",
      service: formattedService,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting service details:", err);
    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid service ID format" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Toggle service status (active/inactive)
// @route   POST /admin/service_status_toggle
// @access  Private (Admin Only)
exports.toggleServiceStatus = async (req, res) => {
  try {
    const { service_id, status } = req.body;

    // Validate input
    if (!service_id) {
      return res.status(400).json({ error: "Service ID is required" });
    }

    if (typeof status !== "boolean") {
      return res.status(400).json({ error: "Status must be true or false" });
    }

    // Find the service
    const service = await Service.findById(service_id);

    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    // Get service provider details for logging
    const serviceProvider = await User.findById(service.user).select(
      "username email"
    );

    // Update service status
    service.service_status = status;
    await service.save();

    // Log the action
    console.log(
      `Admin ${req.user.username} ${
        status ? "activated" : "deactivated"
      } service "${service.service_title}" by ${
        serviceProvider?.username || "Unknown"
      }`
    );

    const responseData = {
      message: `Service has been ${
        status ? "activated" : "deactivated"
      } successfully`,
      service_id: service_id,
      service_title: service.service_title,
      new_status: status,
      service_provider: serviceProvider?.username || "Unknown",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error toggling service status:", err);

    // Handle invalid ObjectId
    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid service ID format" });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// Updated getAdminCustomers function
exports.getAdminCustomers = async (req, res) => {
  try {
    const dateRanges = getDateRanges();
    const {
      currentMonthStart,
      currentMonthEnd,
      previousMonthStart,
      previousMonthEnd,
    } = dateRanges;

    // 1. Total Customers (users with user_type 'client' or accessRoles containing 'client')
    const totalCustomersCurrentMonth = await User.countDocuments({
      accessRoles: "client",
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });

    const totalCustomersPreviousMonth = await User.countDocuments({
      accessRoles: "client",
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });

    const totalCustomersOverall = await User.countDocuments({
      accessRoles: "client",
    });

    // 2. Active Customers (customers who have placed orders or created projects in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Get active customers from orders and projects
    const [activeOrderCustomers, activeProjectCustomers] = await Promise.all([
      ClientOrder.distinct("client_id", {
        placed_at: { $gte: thirtyDaysAgo },
      }),
      ProjectJob.distinct("client_id", {
        createdAt: { $gte: thirtyDaysAgo },
      }),
    ]);

    const [previousActiveOrderCustomers, previousActiveProjectCustomers] =
      await Promise.all([
        ClientOrder.distinct("client_id", {
          placed_at: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        }),
        ProjectJob.distinct("client_id", {
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        }),
      ]);

    // Combine and deduplicate active customers
    const activeCustomersSet = new Set([
      ...activeOrderCustomers,
      ...activeProjectCustomers,
    ]);
    const previousActiveCustomersSet = new Set([
      ...previousActiveOrderCustomers,
      ...previousActiveProjectCustomers,
    ]);

    const activeCustomersCount = activeCustomersSet.size;
    const previousActiveCustomersCount = previousActiveCustomersSet.size;

    // 3. New This Month
    const newThisMonthCount = totalCustomersCurrentMonth;
    const newPreviousMonthCount = totalCustomersPreviousMonth;

    // 4. Total Investment (sum of all orders from customers)
    const currentMonthInvestment = await Promise.all([
      ClientOrder.aggregate([
        {
          $match: {
            placed_at: { $gte: currentMonthStart, $lte: currentMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);

    const previousMonthInvestment = await Promise.all([
      ClientOrder.aggregate([
        {
          $match: {
            placed_at: { $gte: previousMonthStart, $lte: previousMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);

    const currentInvestment = currentMonthInvestment[0][0]?.total || 0;
    const previousInvestment = previousMonthInvestment[0][0]?.total || 0;

    // Get total investment overall
    const totalInvestmentOverall = await ClientOrder.aggregate([
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const overallInvestment = totalInvestmentOverall[0]?.total || 0;

    // 5. Get all customers with their details
    const customers = await User.find({
      $or: [{ user_type: "client" }, { accessRoles: { $in: ["client"] } }],
    })
      .select("_id username email createdAt isEmailVerified supplier_id")
      .sort({ createdAt: -1 })
      .limit(100);

    // Get detailed customer data
    const formattedCustomers = await Promise.all(
      customers.map(async (customer) => {
        const projectJobs = await ProjectJob.find({ client_id: customer._id })
          .populate({
            path: "selected_provider",
            select: "username user_type email",
          })
          .sort({ createdAt: -1 })
          .lean();

        const totalInvestments = projectJobs.reduce((sum, project) => {
          // Include completed projects (money was spent) and in-progress projects (money is committed)
          if (
            project.status === "completed" ||
            project.status === "pending_client_approval" ||
            project.status === "in_progress"
          ) {
            return sum + (project.budget || 0);
          }
          return sum; // Important: Return the sum even if the condition is false!
        }, 0);
        // Get profile information
        const clientProfile = await ClientProfile.findOne({
          user_id: customer._id,
        });

        // Get order count and total investment for this customer
        const [orderCount, orderTotal] = await Promise.all([
          ClientOrder.countDocuments({ client_id: customer._id }),
          ClientOrder.aggregate([
            { $match: { client_id: customer._id } },
            { $group: { _id: null, total: { $sum: "$total" } } },
          ]),
        ]);

        // Get project count
        const projectCount = await ProjectJob.countDocuments({
          client_id: customer._id,
        });

        // Get phone number from profile
        const phone_number = clientProfile?.phone_number || "N/A";
        const full_name =
          clientProfile?.full_name || customer.username || "N/A";

        return {
          customer: {
            id: customer._id.toString(),
            full_name: full_name,
            email: customer.email,
            phone_number: phone_number,
          },
          order_count: orderCount,
          project_count: projectCount,
          total_investment: totalInvestments,
          join_date: customer.createdAt.toISOString(),
          status: customer.isEmailVerified, // Changed from static "active" to based on email verification
        };
      })
    );

    // 6. Recent Activities
    const activities = [];

    // Get recent customer registrations
    const recentCustomers = await User.find({
      $or: [{ user_type: "client" }, { accessRoles: { $in: ["client"] } }],
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("username createdAt");

    recentCustomers.forEach((customer) => {
      activities.push({
        title: "New Customer Registration",
        detail: `${customer.username} joined as a customer`,
        type: "customer_registration",
        time: customer.createdAt,
      });
    });

    // Get recent orders
    const recentOrders = await ClientOrder.find({})
      .populate("client_id", "username")
      .sort({ placed_at: -1 })
      .limit(10)
      .select("order_no client_id total placed_at");

    recentOrders.forEach((order) => {
      activities.push({
        title: "New Order Placed",
        detail: `${order.client_id?.username || "Customer"} placed order ${
          order.order_no
        } worth $${order.total}`,
        type: "order_placed",
        time: order.placed_at,
      });
    });

    // Get recent projects
    const recentProjects = await ProjectJob.find({})
      .populate("client_id", "username")
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title client_id budget createdAt");

    recentProjects.forEach((project) => {
      activities.push({
        title: "New Project Created",
        detail: `${
          project.client_id?.username || "Customer"
        } created project "${project.title}" with budget PKR ${project.budget}`,
        type: "project_created",
        time: project.createdAt,
      });
    });

    // Sort activities by time and limit to 20
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    const sortedActivities = activities.slice(0, 20);

    // Build stats object
    const stats = {
      total_customers: {
        value: totalCustomersOverall,
        trendingValue: calculateTrending(
          totalCustomersCurrentMonth,
          totalCustomersPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            totalCustomersCurrentMonth,
            totalCustomersPreviousMonth
          )
        ),
      },
      active_customers: {
        value: activeCustomersCount,
        trendingValue: calculateTrending(
          activeCustomersCount,
          previousActiveCustomersCount
        ),
        isTrending: isTrendingPositive(
          calculateTrending(activeCustomersCount, previousActiveCustomersCount)
        ),
      },
      new_this_month: {
        value: newThisMonthCount,
        trendingValue: calculateTrending(
          newThisMonthCount,
          newPreviousMonthCount
        ),
        isTrending: isTrendingPositive(
          calculateTrending(newThisMonthCount, newPreviousMonthCount)
        ),
      },
      total_investment: {
        value: overallInvestment,
        trendingValue: calculateTrending(currentInvestment, previousInvestment),
        isTrending: isTrendingPositive(
          calculateTrending(currentInvestment, previousInvestment)
        ),
      },
    };

    const responseData = {
      message: "Admin customers data retrieved successfully",
      stats,
      customers: formattedCustomers,
      activities: sortedActivities,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting admin customers data:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Updated getAdminCustomer function
exports.getAdminCustomer = async (req, res) => {
  try {
    const { customer_id } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: "Customer ID is required" });
    }

    // Find the customer
    const customer = await User.findById(customer_id);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Verify the user is a customer
    const isCustomer =
      customer.user_type === "client" ||
      (customer.accessRoles && customer.accessRoles.includes("client"));

    if (!isCustomer) {
      return res.status(400).json({ error: "User is not a customer" });
    }

    // Get customer profile information
    const clientProfile = await ClientProfile.findOne({ user_id: customer_id });

    // Get date ranges for trending calculations
    const dateRanges = getDateRanges();
    const {
      currentMonthStart,
      currentMonthEnd,
      previousMonthStart,
      previousMonthEnd,
    } = dateRanges;

    // Get customer orders and calculations
    const [
      currentMonthOrders,
      previousMonthOrders,
      totalOrders,
      currentMonthSpent,
      previousMonthSpent,
      totalSpent,
      lastOrder,
    ] = await Promise.all([
      ClientOrder.countDocuments({
        client_id: customer_id,
        placed_at: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
      ClientOrder.countDocuments({
        client_id: customer_id,
        placed_at: { $gte: previousMonthStart, $lte: previousMonthEnd },
      }),
      ClientOrder.countDocuments({ client_id: customer_id }),
      ClientOrder.aggregate([
        {
          $match: {
            client_id: customer._id,
            placed_at: { $gte: currentMonthStart, $lte: currentMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      ClientOrder.aggregate([
        {
          $match: {
            client_id: customer._id,
            placed_at: { $gte: previousMonthStart, $lte: previousMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      ClientOrder.aggregate([
        { $match: { client_id: customer._id } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      ClientOrder.findOne({ client_id: customer_id })
        .sort({ placed_at: -1 })
        .select("placed_at"),
    ]);

    // Get customer projects
    const [currentMonthProjects, previousMonthProjects, totalProjects] =
      await Promise.all([
        ProjectJob.countDocuments({
          client_id: customer_id,
          createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
        }),
        ProjectJob.countDocuments({
          client_id: customer_id,
          createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
        }),
        ProjectJob.countDocuments({ client_id: customer_id }),
      ]);

    const currentSpent = currentMonthSpent[0]?.total || 0;
    const previousSpent = previousMonthSpent[0]?.total || 0;
    const totalSpentAmount = totalSpent[0]?.total || 0;
    const averageOrderValue =
      totalOrders > 0 ? totalSpentAmount / totalOrders : 0;

    // Build personal info
    const personalInfo = {
      full_name: clientProfile?.full_name || customer.username || "N/A",
      status: customer.isEmailVerified, // Changed from static true to based on email verification
      customer_id: customer._id.toString(),
      joinedDate: new Date(customer.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
      bio: clientProfile?.about || "No bio available",
      contact: {
        phone_number: clientProfile?.phone_number || "N/A",
        email: customer.email,
      },
      defaultAddress: clientProfile?.address || clientProfile?.city || "N/A",
      plan: "Standard Member", // You can implement plan logic
      email_subscription: true, // You can get this from customer settings
      sms_subscription: true,
      language: "English", // You can get this from customer settings
    };

    const projectJobs = await ProjectJob.find({ client_id: customer_id })
      .populate({
        path: "selected_provider",
        select: "username user_type email",
      })
      .sort({ createdAt: -1 })
      .lean();

    const totalJobAmount = projectJobs.reduce((sum, project) => {
      // Include completed projects (money was spent) and in-progress projects (money is committed)
      if (
        project.status === "completed" ||
        project.status === "pending_client_approval" ||
        project.status === "in_progress"
      ) {
        return sum + (project.budget || 0);
      }
      return sum; // Important: Return the sum even if the condition is false!
    }, 0);

    // Build stats with trending
    const stats = [
      {
        label: "Total orders",
        value: totalOrders,
        trendingValue: calculateTrending(
          currentMonthOrders,
          previousMonthOrders
        ),
        isPrice: false,
        isTrending: isTrendingPositive(
          calculateTrending(currentMonthOrders, previousMonthOrders)
        ),
      },
      {
        label: "Total order amount",
        value: Math.round(totalSpentAmount),
        trendingValue: calculateTrending(averageOrderValue, averageOrderValue), // Simple for now
        isPrice: true,
        isTrending: true,
      },
      {
        label: "Total jobs",
        value: totalProjects,
        trendingValue: calculateTrending(
          currentMonthProjects,
          previousMonthProjects
        ),
        isPrice: false,
        isTrending: isTrendingPositive(
          calculateTrending(currentMonthProjects, previousMonthProjects)
        ),
      },

      {
        label: "Total job amount",
        value: Math.round(totalJobAmount),
        trendingValue: calculateTrending(currentSpent, previousSpent),
        isPrice: true,
        isTrending: isTrendingPositive(
          calculateTrending(currentSpent, previousSpent)
        ),
      },
    ];

    // Get service requests history (projects)
    const serviceRequests = await ProjectJob.find({ client_id: customer_id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title description budget status createdAt");

    const serviceRequestsHistory = serviceRequests.map((project) => {
      let progress = 0;
      switch (project.status) {
        case "completed":
          progress = 100;
          break;
        case "in_progress":
          progress = 50;
          break;
        case "open":
          progress = 10;
          break;
        default:
          progress = 0;
      }

      return {
        title: project.title || "Untitled Project",
        detail: project.description || "No description available",
        progress: progress,
        budget: project.budget || 0,
        status: project.status || "open",
        type: "project", // You can categorize based on project category
      };
    });

    // Get recent order history
    const recentOrders = await ClientOrder.find({ client_id: customer_id })
      .sort({ placed_at: -1 })
      .limit(10)
      .select("order_no total placed_at items status");

    const recentOrderHistory = recentOrders.map((order) => {
      const firstItem = order.items && order.items[0];
      const deliveryTime = "7 Days"; // You can calculate based on order dates

      return {
        orderNo: order.order_no,
        deliveryTime: deliveryTime,
        category: "general", // You can get from item category
        budget: order.total || 0,
        service: firstItem?.title || "Order Items",
        date: new Date(order.placed_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "2-digit",
        }),
      };
    });

    // Calculate customer metrics (simplified for now)
    const completedOrders = await ClientOrder.countDocuments({
      client_id: customer_id,
      status: { $in: ["delivered", "completed"] },
    });

    const completionRate =
      totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

    const customerMetrics = [
      {
        label: "Order completion rate",
        value: completionRate,
      },
      {
        label: "Payment reliability",
        value: 95, // You can implement payment reliability logic
      },
      {
        label: "Repeat customer rate",
        value: totalOrders > 1 ? 100 : 0,
      },
      {
        label: "Response time",
        value: 24, // Hours - you can calculate from messages
      },
      {
        label: "Communication response",
        value: 90, // Percentage - you can calculate from chat responses
      },
    ];

    // Build customer info summary
    const customerInfo = {
      status: customer.isEmailVerified, // Changed from static true to based on email verification
      totalOrders: totalOrders,
      totalSpend: Math.round(totalSpentAmount),
      lastOrderDate: lastOrder
        ? new Date(lastOrder.placed_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "2-digit",
          })
        : "Never",
      language: "English",
      region: clientProfile?.city || "N/A",
      email_subscription: true, // You can get from settings
      sms_subscription: true,
    };

    const responseData = {
      message: "Customer details retrieved successfully",
      personalInfo,
      stats,
      serviceRequestsHistory,
      recentOrderHistory,
      customerMetrics,
      customerInfo,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting customer details:", err);

    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid customer ID format" });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get specific supplier details for admin
// @route   POST /admin/get_supplier
// @access  Private (Admin Only)
exports.getAdminSupplier = async (req, res) => {
  try {
    const { supplier_id } = req.body;

    if (!supplier_id) {
      return res.status(400).json({ error: "Supplier ID is required" });
    }

    // Find the supplier
    const supplier = await User.findById(supplier_id);

    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    // Verify the user is a supplier
    const isSupplier =
      supplier.user_type === "supplier" ||
      (supplier.accessRoles && supplier.accessRoles.includes("supplier"));

    if (!isSupplier) {
      return res.status(400).json({ error: "User is not a supplier" });
    }

    // Get supplier profile information
    const [userProfile, storeDetails] = await Promise.all([
      UserProfile.findOne({ user_id: supplier_id }),
      StoreDetails.findOne({ supplier_id: supplier_id }),
    ]);

    // Get date ranges for trending calculations
    const dateRanges = getDateRanges();
    const {
      currentMonthStart,
      currentMonthEnd,
      previousMonthStart,
      previousMonthEnd,
    } = dateRanges;

    // Get supplier statistics
    const [
      currentMonthProducts,
      previousMonthProducts,
      totalProducts,
      currentMonthOrders,
      previousMonthOrders,
      totalOrders,
      currentMonthRevenue,
      previousMonthRevenue,
      totalRevenue,
      supplierRating,
    ] = await Promise.all([
      Product.countDocuments({
        supplier_id: supplier_id,
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
      Product.countDocuments({
        supplier_id: supplier_id,
        createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
      }),
      Product.countDocuments({ supplier_id: supplier_id }),
      Order.countDocuments({
        supplier_id: supplier_id,
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
      Order.countDocuments({
        supplier_id: supplier_id,
        createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
      }),
      Order.countDocuments({ supplier_id: supplier_id }),
      Order.aggregate([
        {
          $match: {
            supplier_id: supplier._id,
            createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$calculations.total" } } },
      ]),
      Order.aggregate([
        {
          $match: {
            supplier_id: supplier._id,
            createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$calculations.total" } } },
      ]),
      Order.aggregate([
        { $match: { supplier_id: supplier._id } },
        { $group: { _id: null, total: { $sum: "$calculations.total" } } },
      ]),
      // Calculate average rating from completed orders (simplified)
      Order.aggregate([
        { $match: { supplier_id: supplier._id, status: "completed" } },
        { $group: { _id: null, avgRating: { $avg: 4.5 } } }, // Placeholder logic
      ]),
    ]);

    const currentRevenue = currentMonthRevenue[0]?.total || 0;
    const previousRevenue = previousMonthRevenue[0]?.total || 0;
    const totalRevenueAmount = totalRevenue[0]?.total || 0;
    const rating = supplierRating[0]?.avgRating || 4.0;

    // Get last order date
    const lastOrder = await Order.findOne({ supplier_id: supplier_id })
      .sort({ createdAt: -1 })
      .select("createdAt");

    // Build personal info
    const personalInfo = {
      full_name:
        userProfile?.fullname ||
        storeDetails?.store_name ||
        supplier.username ||
        "N/A",
      status: true, // Assume active for now
      supplier_id: supplier._id.toString(),
      joinedDate: new Date(supplier.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
      bio: userProfile?.introduction || "No bio available",
      contact: {
        phone_number:
          userProfile?.phone_number || storeDetails?.phone_number || "N/A",
        email: supplier.email,
      },
      defaultAddress:
        userProfile?.address || userProfile?.service_location || "N/A",
      plan: "Standard Member", // You can implement plan logic
      zip_code: 0, // You can add zip code field to profile
      account_type: "supplier",
      country: "Pakistan", // You can get from profile or settings
    };

    // Build stats with trending
    const stats = [
      {
        label: "Total products",
        value: totalProducts,
        trendingValue: calculateTrending(
          currentMonthProducts,
          previousMonthProducts
        ),
        isPrice: false,
        isTrending: isTrendingPositive(
          calculateTrending(currentMonthProducts, previousMonthProducts)
        ),
      },
      {
        label: "Total orders",
        value: totalOrders,
        trendingValue: calculateTrending(
          currentMonthOrders,
          previousMonthOrders
        ),
        isPrice: false,
        isTrending: isTrendingPositive(
          calculateTrending(currentMonthOrders, previousMonthOrders)
        ),
      },
      {
        label: "Total revenue",
        value: Math.round(totalRevenueAmount),
        trendingValue: calculateTrending(currentRevenue, previousRevenue),
        isPrice: true,
        isTrending: isTrendingPositive(
          calculateTrending(currentRevenue, previousRevenue)
        ),
      },
      {
        label: "Rating",
        value: parseFloat(rating.toFixed(1)),
        trendingValue: 0, // Rating trending can be complex
        isPrice: false,
        isTrending: true,
      },
    ];

    // Get products inventory
    const products = await Product.find({ supplier_id: supplier_id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title description price quantity status createdAt");

    const productsInventory = products.map((product) => {
      let progress = 0;
      switch (product.status) {
        case "active":
          progress = 100;
          break;
        case "draft":
          progress = 50;
          break;
        default:
          progress = 25;
      }

      return {
        title: product.title || "Untitled Product",
        detail: product.description || "No description available",
        progress: progress,
        budget: product.price || 0,
        status: product.status || "draft",
        type: "product", // You can categorize based on product category
      };
    });

    // Get recent order history
    const recentOrders = await Order.find({ supplier_id: supplier_id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("order_no calculations.total createdAt products status");

    const recentOrderHistory = recentOrders.map((order) => {
      const firstProduct = order.products && order.products[0];
      const deliveryTime = "7 Days"; // You can calculate based on order dates

      return {
        orderNo: order.order_no,
        deliveryTime: deliveryTime,
        category: firstProduct?.category || "general",
        budget: order.calculations?.total || 0,
        service: firstProduct?.title || "Order Items",
        date: new Date(order.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "2-digit",
        }),
      };
    });

    // Calculate supplier metrics
    const completedOrders = await Order.countDocuments({
      supplier_id: supplier_id,
      status: { $in: ["completed", "delivered"] },
    });

    const onTimeDelivery = await Order.countDocuments({
      supplier_id: supplier_id,
      status: "delivered",
      // You can add delivery date comparison logic here
    });

    const fulfillmentRate =
      totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
    const onTimeRate =
      completedOrders > 0
        ? Math.round((onTimeDelivery / completedOrders) * 100)
        : 0;

    const supplierMetrics = [
      {
        label: "Order fulfillment rate",
        value: fulfillmentRate,
      },
      {
        label: "On-time delivery",
        value: onTimeRate,
      },
      {
        label: "Product quality rating",
        value: Math.round(rating * 20), // Convert 5-star to percentage
      },
      {
        label: "Customer satisfactions",
        value: 95, // You can calculate from reviews/feedback
      },
      {
        label: "Communication response",
        value: 90, // You can calculate from chat response times
      },
    ];

    // Build supplier info summary
    const supplierInfo = {
      status: true,
      totalOrders: totalOrders,
      totalProducts: totalProducts,
      lastOrderDate: lastOrder
        ? new Date(lastOrder.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "2-digit",
          })
        : "Never",
      language: "English",
      region: userProfile?.service_location || "N/A",
      email_verify: supplier.isEmailVerified,
      tax_no: storeDetails?.reg_number || "N/A",
      timezone: storeDetails?.time_zone || "Asia/Karachi(PKT)",
      store_currency: storeDetails?.display_currency || "PKR",
    };

    const responseData = {
      message: "Supplier details retrieved successfully",
      personalInfo,
      stats,
      productsInventory,
      recentOrderHistory,
      supplierMetrics,
      supplierInfo,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting supplier details:", err);

    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid supplier ID format" });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get all suppliers data for admin
// @route   GET /admin/get_suppliers
// @access  Private (Admin Only)
exports.getAdminSuppliers = async (req, res) => {
  try {
    const dateRanges = getDateRanges();
    const {
      currentMonthStart,
      currentMonthEnd,
      previousMonthStart,
      previousMonthEnd,
    } = dateRanges;

    // 1. Total Suppliers (users with user_type 'supplier' or accessRoles containing 'supplier')
    const totalSuppliersCurrentMonth = await User.countDocuments({
      $or: [{ user_type: "supplier" }, { accessRoles: { $in: ["supplier"] } }],
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });

    const totalSuppliersPreviousMonth = await User.countDocuments({
      $or: [{ user_type: "supplier" }, { accessRoles: { $in: ["supplier"] } }],
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });

    const totalSuppliersOverall = await User.countDocuments({
      $or: [{ user_type: "supplier" }, { accessRoles: { $in: ["supplier"] } }],
    });

    // 2. Active Suppliers (suppliers who have products or received orders in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Get active suppliers from products and orders
    const [activeSuppliersFromProducts, activeSuppliersFromOrders] =
      await Promise.all([
        Product.distinct("supplier_id", {
          createdAt: { $gte: thirtyDaysAgo },
        }),
        Order.distinct("supplier_id", {
          createdAt: { $gte: thirtyDaysAgo },
        }),
      ]);

    const [
      previousActiveSuppliersFromProducts,
      previousActiveSuppliersFromOrders,
    ] = await Promise.all([
      Product.distinct("supplier_id", {
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      }),
      Order.distinct("supplier_id", {
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      }),
    ]);

    // Combine and deduplicate active suppliers
    const activeSuppliersSet = new Set([
      ...activeSuppliersFromProducts,
      ...activeSuppliersFromOrders,
    ]);
    const previousActiveSuppliersSet = new Set([
      ...previousActiveSuppliersFromProducts,
      ...previousActiveSuppliersFromOrders,
    ]);

    const activeSuppliersCount = activeSuppliersSet.size;
    const previousActiveSuppliersCount = previousActiveSuppliersSet.size;

    // 3. Supplier Stores (suppliers who have set up store details)
    const supplierStoresCurrentMonth = await StoreDetails.countDocuments({
      updatedAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });

    const supplierStoresPreviousMonth = await StoreDetails.countDocuments({
      updatedAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });

    const supplierStoresOverall = await StoreDetails.countDocuments({});

    // 4. Pending Verification (suppliers with unverified emails)
    const pendingVerifyCurrentMonth = await User.countDocuments({
      $or: [{ user_type: "supplier" }, { accessRoles: { $in: ["supplier"] } }],
      isEmailVerified: false,
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });

    const pendingVerifyPreviousMonth = await User.countDocuments({
      $or: [{ user_type: "supplier" }, { accessRoles: { $in: ["supplier"] } }],
      isEmailVerified: false,
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });

    const pendingVerifyOverall = await User.countDocuments({
      $or: [{ user_type: "supplier" }, { accessRoles: { $in: ["supplier"] } }],
      isEmailVerified: false,
    });

    // 5. Get all suppliers with their details
    const suppliers = await User.find({
      $or: [{ user_type: "supplier" }, { accessRoles: { $in: ["supplier"] } }],
    })
      .select("_id username email createdAt isEmailVerified")
      .sort({ createdAt: -1 })
      .limit(100);

    // Get detailed supplier data
    const formattedSuppliers = await Promise.all(
      suppliers.map(async (supplier) => {
        // Get supplier profile information
        const [userProfile, storeDetails] = await Promise.all([
          UserProfile.findOne({ user_id: supplier._id }),
          StoreDetails.findOne({ supplier_id: supplier._id }),
        ]);

        // Get phone number and name from profile
        const phone_number =
          userProfile?.phone_number || storeDetails?.phone_number || "N/A";
        const full_name =
          userProfile?.fullname ||
          storeDetails?.store_name ||
          supplier.username ||
          "N/A";
        const location =
          userProfile?.address || userProfile?.service_location || "N/A";

        // Determine supplier status (active if they have products or recent orders)
        const [hasProducts, hasRecentOrders] = await Promise.all([
          Product.countDocuments({ supplier_id: supplier._id }),
          Order.countDocuments({
            supplier_id: supplier._id,
            createdAt: { $gte: thirtyDaysAgo },
          }),
        ]);

        const isActive = hasProducts > 0 || hasRecentOrders > 0;

        return {
          supplier: {
            id: supplier._id.toString(),
            full_name: full_name,
            email: supplier.email,
            phone_number: phone_number,
          },
          email_verify: supplier.isEmailVerified,
          status: isActive,
          location: location,
          join_date: supplier.createdAt.toISOString(),
        };
      })
    );

    // 6. Recent Activities
    const activities = [];

    // Get recent supplier registrations
    const recentSuppliers = await User.find({
      $or: [{ user_type: "supplier" }, { accessRoles: { $in: ["supplier"] } }],
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("username createdAt");

    recentSuppliers.forEach((supplier) => {
      activities.push({
        title: "New Supplier Registration",
        detail: `${supplier.username} joined as a supplier`,
        type: "supplier_registration",
        time: supplier.createdAt,
      });
    });

    // Get recent products added by suppliers
    const recentProducts = await Product.find({})
      .populate("supplier_id", "username")
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title supplier_id price createdAt");

    recentProducts.forEach((product) => {
      activities.push({
        title: "New Product Added",
        detail: `${
          product.supplier_id?.username || "Supplier"
        } added product "${product.title}" for $${product.price}`,
        type: "product_added",
        time: product.createdAt,
      });
    });

    // Get recent orders to suppliers
    const recentOrders = await Order.find({})
      .populate("supplier_id", "username")
      .sort({ createdAt: -1 })
      .limit(10)
      .select("order_no supplier_id calculations.total createdAt");

    recentOrders.forEach((order) => {
      activities.push({
        title: "New Order Received",
        detail: `${order.supplier_id?.username || "Supplier"} received order ${
          order.order_no
        } worth $${order.calculations?.total || 0}`,
        type: "order_received",
        time: order.createdAt,
      });
    });

    // Get recent store setups
    const recentStores = await StoreDetails.find({})
      .populate("supplier_id", "username")
      .sort({ updatedAt: -1 })
      .limit(5)
      .select("store_name supplier_id updatedAt");

    recentStores.forEach((store) => {
      activities.push({
        title: "Store Setup Completed",
        detail: `${store.supplier_id?.username || "Supplier"} set up store "${
          store.store_name
        }"`,
        type: "store_setup",
        time: store.updatedAt,
      });
    });

    // Sort activities by time and limit to 20
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    const sortedActivities = activities.slice(0, 20);

    // Build stats object
    const stats = {
      total_suppliers: {
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
      active_suppliers: {
        value: activeSuppliersCount,
        trendingValue: calculateTrending(
          activeSuppliersCount,
          previousActiveSuppliersCount
        ),
        isTrending: isTrendingPositive(
          calculateTrending(activeSuppliersCount, previousActiveSuppliersCount)
        ),
      },
      supplier_stores: {
        value: supplierStoresOverall,
        trendingValue: calculateTrending(
          supplierStoresCurrentMonth,
          supplierStoresPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            supplierStoresCurrentMonth,
            supplierStoresPreviousMonth
          )
        ),
      },
      pending_verify: {
        value: pendingVerifyOverall,
        trendingValue: calculateTrending(
          pendingVerifyCurrentMonth,
          pendingVerifyPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            pendingVerifyCurrentMonth,
            pendingVerifyPreviousMonth
          )
        ),
      },
    };

    const responseData = {
      message: "Admin suppliers data retrieved successfully",
      stats,
      suppliers: formattedSuppliers,
      activities: sortedActivities,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting admin suppliers data:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Toggle user account status (active/inactive)
// @route   POST /admin/user_account_status_toggle
// @access  Private (Admin Only)
exports.toggleUserAccountStatus = async (req, res) => {
  try {
    const { user_id, status } = req.body;

    // Validate input
    if (!user_id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (typeof status !== "boolean") {
      return res.status(400).json({ error: "Status must be true or false" });
    }

    // Find the user
    const user = await User.findById(user_id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent admin from deactivating themselves
    if (user_id === req.user.id.toString()) {
      return res
        .status(400)
        .json({ error: "You cannot change your own account status" });
    }

    // Prevent deactivating other admins (optional security measure)
    if (user.isAdmin && !status) {
      return res
        .status(400)
        .json({ error: "Cannot deactivate admin accounts" });
    }

    // Use existing isEmailVerified field to control account status
    // true = active account, false = deactivated account
    user.isEmailVerified = status;

    await user.save();

    // Get user profile for better logging
    const userProfile = await UserProfile.findOne({ user_id: user_id });
    const displayName = userProfile?.fullname || user.username;

    // Log the action
    console.log(
      `Admin ${req.user.username} ${
        status ? "activated" : "deactivated"
      } user account "${displayName}" (${
        user.user_type
      }) using email verification status`
    );

    const responseData = {
      message: `User account has been ${
        status ? "activated" : "deactivated"
      } successfully`,
      user_id: user_id,
      username: user.username,
      user_type: user.user_type,
      new_status: status,
      email_verified: status,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error toggling user account status:", err);

    // Handle invalid ObjectId
    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get admin projects data
// @route   GET /admin/get_projects
// @access  Private (Admin Only)
exports.getAdminProjects = async (req, res) => {
  try {
    const dateRanges = getDateRanges();
    const {
      currentMonthStart,
      currentMonthEnd,
      previousMonthStart,
      previousMonthEnd,
    } = dateRanges;

    // 1. Total Projects
    const totalProjectsCurrentMonth = await ProjectJob.countDocuments({
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const totalProjectsPreviousMonth = await ProjectJob.countDocuments({
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const totalProjectsOverall = await ProjectJob.countDocuments({});

    // 2. Active Projects (open and in_progress)
    const activeProjectsCurrentMonth = await ProjectJob.countDocuments({
      status: { $in: ["open", "in_progress"] },
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });
    const activeProjectsPreviousMonth = await ProjectJob.countDocuments({
      status: { $in: ["open", "in_progress"] },
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });
    const activeProjectsOverall = await ProjectJob.countDocuments({
      status: { $in: ["open", "in_progress"] },
    });

    // 3. New This Month
    const newThisMonthCount = totalProjectsCurrentMonth;
    const newPreviousMonthCount = totalProjectsPreviousMonth;

    // 4. Projects Growth (compared to previous period)
    const projectsGrowthCurrentMonth = totalProjectsCurrentMonth;
    const projectsGrowthPreviousMonth = totalProjectsPreviousMonth;

    // Get all projects with client details for the projects list
    const projects = await ProjectJob.find({})
      .populate("_id client_id", "username email")
      .sort({ createdAt: -1 })
      .limit(100)
      .select("title category city budget createdAt status client_id");

    // Format projects according to specification
    const formattedProjects = projects.map((project) => ({
      title: project.title || "Untitled Project",
      category: project.category || "Uncategorized",
      location: project.city || "Not specified",
      amount: project.budget || 0,
      date: project.createdAt.toISOString(),
      status: project.status || "open",
      id: project._id,
    }));

    // Build stats object
    const stats = {
      total_projects: {
        value: totalProjectsOverall,
        trendingValue: calculateTrending(
          totalProjectsCurrentMonth,
          totalProjectsPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            totalProjectsCurrentMonth,
            totalProjectsPreviousMonth
          )
        ),
      },
      active_projects: {
        value: activeProjectsOverall,
        trendingValue: calculateTrending(
          activeProjectsCurrentMonth,
          activeProjectsPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            activeProjectsCurrentMonth,
            activeProjectsPreviousMonth
          )
        ),
      },
      new_this_month: {
        value: newThisMonthCount,
        trendingValue: calculateTrending(
          newThisMonthCount,
          newPreviousMonthCount
        ),
        isTrending: isTrendingPositive(
          calculateTrending(newThisMonthCount, newPreviousMonthCount)
        ),
      },
      projects_growth: {
        value: totalProjectsOverall,
        trendingValue: calculateTrending(
          projectsGrowthCurrentMonth,
          projectsGrowthPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            projectsGrowthCurrentMonth,
            projectsGrowthPreviousMonth
          )
        ),
      },
    };

    const responseData = {
      message: "Admin projects data retrieved successfully",
      stats,
      projects: formattedProjects,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting admin projects data:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get project details for admin
// @route   POST /admin/get_project
// @access  Private (Admin Only)
exports.getAdminProject = async (req, res) => {
  try {
    const { project_id } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    // Find the project with populated client and selected provider details
    const project = await ProjectJob.findById(project_id)
      .populate("client_id", "username email user_type createdAt")
      .populate("selected_provider", "username email user_type");

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Get client profile for additional details
    let clientProfile = null;
    if (project.client_id) {
      clientProfile = await ClientProfile.findOne({
        user_id: project.client_id._id,
      }).select("full_name phone_number company_name address city");
    }

    // Get service provider profile for additional details
    let providerProfile = null;
    if (project.selected_provider) {
      providerProfile = await UserProfile.findOne({
        user_id: project.selected_provider._id,
      }).select("fullname phone_number address service_location");
    }

    // Format client information
    const clientInfo = {
      id: project.client_id?._id?.toString() || null,
      username: project.client_id?.username || "Unknown Client",
      email: project.client_id?.email || "N/A",
      full_name:
        clientProfile?.full_name || project.client_id?.username || "Unknown",
      phone_number: clientProfile?.phone_number || "N/A",
      company_name: clientProfile?.company_name || "N/A",
      address: clientProfile?.address || "N/A",
      city: clientProfile?.city || "N/A",
      joined_date: project.client_id?.createdAt?.toISOString() || null,
    };

    // Format service provider information (if assigned)
    const providerInfo = project.selected_provider
      ? {
          id: project.selected_provider._id.toString(),
          username: project.selected_provider.username,
          email: project.selected_provider.email,
          full_name:
            providerProfile?.fullname || project.selected_provider.username,
          phone_number: providerProfile?.phone_number || "N/A",
          address:
            providerProfile?.address ||
            providerProfile?.service_location ||
            "N/A",
        }
      : null;

    // Format proposals
    const formattedProposals = project.proposals.map((proposal) => ({
      id: proposal._id.toString(),
      service_provider_id: proposal.service_provider_id.toString(),
      proposal_text: proposal.proposal_text,
      proposed_budget: proposal.proposed_budget,
      proposed_timeline: proposal.proposed_timeline,
      status: proposal.status,
      submitted_at: proposal.submitted_at.toISOString(),
    }));

    // Format the complete project details
    const formattedProject = {
      id: project._id.toString(),
      title: project.title || "Untitled Project",
      type: project.type || "project",
      category: project.category || "Uncategorized",
      description: project.description || "No description available",
      budget: project.budget || 0,
      starting_date: project.starting_date?.toISOString() || null,
      timeline: project.timeline || "Not specified",
      city: project.city || "Not specified",
      note: project.note || "",
      address: project.address || "",
      urgent: project.urgent || false,
      docs: project.docs || [],
      required_skills: project.required_skills || [],
      tags: project.tags || [],
      status: project.status || "open",
      client: clientInfo,
      selected_provider: providerInfo,
      proposals: formattedProposals,
      proposal_count: project.proposals?.length || 0,
      started_at: project.started_at?.toISOString() || null,
      completed_at: project.completed_at?.toISOString() || null,
      payment_status: project.payment_status || "pending",
      created_at: project.createdAt.toISOString(),
      updated_at: project.updatedAt.toISOString(),
    };

    const responseData = {
      message: "Project details retrieved successfully",
      project: formattedProject,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting project details:", err);
    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid project ID format" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get admin service providers data
// @route   GET /admin/get_service_providers
// @access  Private (Admin Only)
exports.getAdminServiceProviders = async (req, res) => {
  try {
    const dateRanges = getDateRanges();
    const {
      currentMonthStart,
      currentMonthEnd,
      previousMonthStart,
      previousMonthEnd,
    } = dateRanges;

    // 1. Total Service Providers (users with user_type 'service_provider' or accessRoles containing 'service_provider')
    const totalServiceProvidersCurrentMonth = await User.countDocuments({
      accessRoles: "service_provider",
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });

    console.log(totalServiceProvidersCurrentMonth);

    const totalServiceProvidersPreviousMonth = await User.countDocuments({
      accessRoles: "service_provider",
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });

    const totalServiceProvidersOverall = await User.countDocuments({
      accessRoles: "service_provider",
    });

    // 2. Active Service Providers (those who have active services or recent job activity)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Get active service providers from services and jobs
    const [activeFromServices, activeFromJobs] = await Promise.all([
      Service.distinct("user", {
        service_status: true,
        createdAt: { $gte: thirtyDaysAgo },
      }),
      Job.distinct("service_provider", {
        createdAt: { $gte: thirtyDaysAgo },
      }),
    ]);

    const [previousActiveFromServices, previousActiveFromJobs] =
      await Promise.all([
        Service.distinct("user", {
          service_status: true,
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        }),
        Job.distinct("service_provider", {
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        }),
      ]);

    // Combine and deduplicate active service providers
    const activeServiceProvidersSet = new Set([
      ...activeFromServices,
      ...activeFromJobs,
    ]);
    const previousActiveServiceProvidersSet = new Set([
      ...previousActiveFromServices,
      ...previousActiveFromJobs,
    ]);

    const activeServiceProvidersCount = activeServiceProvidersSet.size;
    const previousActiveServiceProvidersCount =
      previousActiveServiceProvidersSet.size;

    // 3. New This Month
    const newThisMonthCount = totalServiceProvidersCurrentMonth;
    const newPreviousMonthCount = totalServiceProvidersPreviousMonth;

    // 4. Total Earnings (sum of all completed jobs for service providers)
    const currentMonthEarnings = await Job.aggregate([
      {
        $match: {
          status: "completed",
          completed_date: { $gte: currentMonthStart, $lte: currentMonthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);

    const previousMonthEarnings = await Job.aggregate([
      {
        $match: {
          status: "completed",
          completed_date: { $gte: previousMonthStart, $lte: previousMonthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);

    const currentEarnings = currentMonthEarnings[0]?.total || 0;
    const previousEarnings = previousMonthEarnings[0]?.total || 0;

    // Get total earnings overall
    const totalEarningsOverall = await Job.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);
    const overallEarnings = totalEarningsOverall[0]?.total || 0;

    // 5. Get all service providers with their details
    const serviceProviders = await User.find({
      accessRoles: "service_provider",
    })
      .select("_id username email createdAt isEmailVerified")
      .sort({ createdAt: -1 })
      .limit(100);

    // Get detailed service provider data
    const formattedServiceProviders = await Promise.all(
      serviceProviders.map(async (serviceProvider) => {
        // Get service provider profile information
        const userProfile = await UserProfile.findOne({
          user_id: serviceProvider._id,
        });

        // Check if they have a company profile
        const hasCompany = await Company.exists({
          user_id: serviceProvider._id,
        });

        // Get job statistics
        const [jobCount, totalEarnings] = await Promise.all([
          Job.countDocuments({ service_provider: serviceProvider._id }),
          Job.aggregate([
            {
              $match: {
                service_provider: serviceProvider._id,
                status: "completed",
              },
            },
            { $group: { _id: null, total: { $sum: "$price" } } },
          ]),
        ]);

        // Get project statistics (from ProjectJob where selected_provider is this service provider)
        const projectCount = await ProjectJob.countDocuments({
          selected_provider: serviceProvider._id,
        });

        // Calculate total investment (earnings from jobs)
        const totalInvestment = totalEarnings[0]?.total || 0;

        // Get phone number and name from profile
        const phone_number = userProfile?.phone_number || "N/A";
        const full_name =
          userProfile?.fullname || serviceProvider.username || "N/A";

        return {
          serviceProvider: {
            id: serviceProvider._id.toString(),
            full_name: full_name,
            email: serviceProvider.email,
            phone_number: phone_number,
          },
          order_count: jobCount, // Jobs count as orders for service providers
          project_count: projectCount,
          total_investment: totalInvestment,
          has_company: !!hasCompany,
          join_date: serviceProvider.createdAt.toISOString(),
          status: serviceProvider.isEmailVerified ? "active" : "inactive",
        };
      })
    );

    // 6. Recent Activities
    const activities = [];

    // Get recent service provider registrations
    const recentServiceProviders = await User.find({
      accessRoles: "service_provider",
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("username createdAt");

    recentServiceProviders.forEach((sp) => {
      activities.push({
        title: "New Service Provider Registration",
        detail: `${sp.username} joined as a service provider`,
        type: "service_provider_registration",
        time: sp.createdAt,
      });
    });

    // Get recent services created
    const recentServices = await Service.find({})
      .populate("user", "username")
      .sort({ createdAt: -1 })
      .limit(10)
      .select("service_title user createdAt");

    recentServices.forEach((service) => {
      activities.push({
        title: "New Service Created",
        detail: `${
          service.user?.username || "Service Provider"
        } created service "${service.service_title}"`,
        type: "service_created",
        time: service.createdAt,
      });
    });

    // Get recent completed jobs
    const recentJobs = await Job.find({ status: "completed" })
      .populate("service_provider", "username")
      .populate("service", "service_title")
      .sort({ completed_date: -1 })
      .limit(10)
      .select("service_provider service price completed_date");

    recentJobs.forEach((job) => {
      activities.push({
        title: "Job Completed",
        detail: `${
          job.service_provider?.username || "Service Provider"
        } completed "${job.service?.service_title || "Service"}" for PKR ${
          job.price
        }`,
        type: "job_completed",
        time: job.completed_date,
      });
    });

    // Get recent project completions
    const recentProjects = await ProjectJob.find({
      status: "completed",
      selected_provider: { $exists: true },
    })
      .populate("selected_provider", "username")
      .sort({ completed_at: -1 })
      .limit(10)
      .select("title selected_provider budget completed_at");

    recentProjects.forEach((project) => {
      activities.push({
        title: "Project Completed",
        detail: `${
          project.selected_provider?.username || "Service Provider"
        } completed project "${project.title}" for PKR ${project.budget}`,
        type: "project_completed",
        time: project.completed_at,
      });
    });

    // Sort activities by time and limit to 20
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    const sortedActivities = activities.slice(0, 20);

    // Build stats object
    const stats = {
      total_service_providers: {
        value: totalServiceProvidersOverall,
        trendingValue: calculateTrending(
          totalServiceProvidersCurrentMonth,
          totalServiceProvidersPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            totalServiceProvidersCurrentMonth,
            totalServiceProvidersPreviousMonth
          )
        ),
      },
      active_service_provider: {
        value: activeServiceProvidersCount,
        trendingValue: calculateTrending(
          activeServiceProvidersCount,
          previousActiveServiceProvidersCount
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            activeServiceProvidersCount,
            previousActiveServiceProvidersCount
          )
        ),
      },
      new_this_month: {
        value: newThisMonthCount,
        trendingValue: calculateTrending(
          newThisMonthCount,
          newPreviousMonthCount
        ),
        isTrending: isTrendingPositive(
          calculateTrending(newThisMonthCount, newPreviousMonthCount)
        ),
      },
      total_earning: {
        value: overallEarnings,
        trendingValue: calculateTrending(currentEarnings, previousEarnings),
        isTrending: isTrendingPositive(
          calculateTrending(currentEarnings, previousEarnings)
        ),
      },
    };

    const responseData = {
      message: "Admin service providers data retrieved successfully",
      stats,
      service_providers: formattedServiceProviders,
      activities: sortedActivities,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting admin service providers data:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Add this function to controllers/adminController.js

// @desc    Get specific service provider details for admin
// @route   POST /admin/get_service_provider
// @access  Private (Admin Only)
exports.getAdminServiceProvider = async (req, res) => {
  try {
    const { service_provider_id } = req.body;

    if (!service_provider_id) {
      return res.status(400).json({ error: "Service provider ID is required" });
    }

    // Find the service provider
    const serviceProvider = await User.findById(service_provider_id);

    if (!serviceProvider) {
      return res.status(404).json({ error: "Service provider not found" });
    }

    // Verify the user is a service provider
    const isServiceProvider =
      serviceProvider.user_type === "service_provider" ||
      (serviceProvider.accessRoles &&
        serviceProvider.accessRoles.includes("service_provider"));

    if (!isServiceProvider) {
      return res.status(400).json({ error: "User is not a service provider" });
    }

    // Get service provider profile information
    const [userProfile, companyProfile] = await Promise.all([
      UserProfile.findOne({ user_id: service_provider_id }),
      Company.findOne({ user_id: service_provider_id }),
    ]);

    // Get date ranges for trending calculations
    const dateRanges = getDateRanges();
    const {
      currentMonthStart,
      currentMonthEnd,
      previousMonthStart,
      previousMonthEnd,
    } = dateRanges;

    // Get service provider statistics
    const [
      currentMonthServices,
      previousMonthServices,
      totalServices,
      currentMonthJobs,
      previousMonthJobs,
      totalJobs,
      completedJobs,
      currentMonthEarnings,
      previousMonthEarnings,
      totalEarnings,
      avgRating,
    ] = await Promise.all([
      Service.countDocuments({
        user: service_provider_id,
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
      Service.countDocuments({
        user: service_provider_id,
        createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
      }),
      Service.countDocuments({ user: service_provider_id }),
      Job.countDocuments({
        service_provider: service_provider_id,
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
      Job.countDocuments({
        service_provider: service_provider_id,
        createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
      }),
      Job.countDocuments({ service_provider: service_provider_id }),
      Job.countDocuments({
        service_provider: service_provider_id,
        status: "completed",
      }),
      Job.aggregate([
        {
          $match: {
            service_provider: serviceProvider._id,
            status: "completed",
            completed_date: { $gte: currentMonthStart, $lte: currentMonthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$price" } } },
      ]),
      Job.aggregate([
        {
          $match: {
            service_provider: serviceProvider._id,
            status: "completed",
            completed_date: {
              $gte: previousMonthStart,
              $lte: previousMonthEnd,
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$price" } } },
      ]),
      Job.aggregate([
        {
          $match: {
            service_provider: serviceProvider._id,
            status: "completed",
          },
        },
        { $group: { _id: null, total: { $sum: "$price" } } },
      ]),
      Job.aggregate([
        {
          $match: {
            service_provider: serviceProvider._id,
            status: "completed",
          },
        },
        { $group: { _id: null, avgRating: { $avg: "$feedback.rating" } } },
      ]),
    ]);

    const currentEarnings = currentMonthEarnings[0]?.total || 0;
    const previousEarnings = previousMonthEarnings[0]?.total || 0;
    const totalEarningsAmount = totalEarnings[0]?.total || 0;
    const averageRating = avgRating[0]?.avgRating || 0;

    // Generate unique service provider ID
    const serviceProviderId = `SP${serviceProvider._id
      .toString()
      .slice(-8)
      .toUpperCase()}`;

    // Build personal info
    const personalInfo = {
      full_name: userProfile?.fullname || serviceProvider.username || "N/A",
      status: serviceProvider.isEmailVerified,
      supplier_id: serviceProviderId, // Using supplier_id field name as per API spec
      joinedDate: new Date(serviceProvider.createdAt).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "short",
          day: "2-digit",
        }
      ),
      bio: userProfile?.introduction || "No bio available",
      contact: {
        phone_number: userProfile?.phone_number || "N/A",
        email: serviceProvider.email,
      },
      service_area:
        userProfile?.service_location || userProfile?.address || "N/A",
      account_type: companyProfile
        ? "Business Provider"
        : "Individual Provider",
    };

    // Build stats with trending
    const stats = [
      {
        label: "Active services",
        value: totalServices,
        trendingValue: calculateTrending(
          currentMonthServices,
          previousMonthServices
        ),
        isPrice: false,
        isTrending: isTrendingPositive(
          calculateTrending(currentMonthServices, previousMonthServices)
        ),
      },
      {
        label: "Completed jobs",
        value: completedJobs,
        trendingValue: calculateTrending(currentMonthJobs, previousMonthJobs),
        isPrice: false,
        isTrending: isTrendingPositive(
          calculateTrending(currentMonthJobs, previousMonthJobs)
        ),
      },
      {
        label: "Total Earnings",
        value: Math.round(totalEarningsAmount),
        trendingValue: calculateTrending(currentEarnings, previousEarnings),
        isPrice: true,
        isTrending: isTrendingPositive(
          calculateTrending(currentEarnings, previousEarnings)
        ),
      },
      {
        label: "Average rating",
        value: parseFloat(averageRating.toFixed(1)),
        trendingValue: 0, // Rating trending can be complex to calculate
        isPrice: false,
        isTrending: true,
      },
    ];

    // Get service portfolio (completed projects)
    const servicePortfolio = await ProjectJob.find({
      selected_provider: service_provider_id,
      status: { $in: ["completed", "in_progress"] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select(
        "title description budget status createdAt completed_at category"
      );

    const formattedServicePortfolio = servicePortfolio.map((project) => {
      let progress = 0;
      switch (project.status) {
        case "completed":
          progress = 100;
          break;
        case "in_progress":
          progress = 75;
          break;
        case "pending_client_approval":
          progress = 90;
          break;
        default:
          progress = 50;
      }

      return {
        title: project.title || "Untitled Project",
        detail: project.description || "No description available",
        progress: progress,
        budget: project.budget || 0,
        status: project.status || "open",
        type: project.category || "general",
      };
    });

    // Get job applications (proposals submitted by service provider)
    const jobApplications = await ProjectJob.find({
      "proposals.service_provider_id": service_provider_id,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title description budget proposals category createdAt status");

    const formattedJobApplications = jobApplications.map((project) => {
      // Find this service provider's proposal
      const proposal = project.proposals.find(
        (p) => p.service_provider_id.toString() === service_provider_id
      );

      return {
        title: project.title || "Untitled Project",
        status: proposal?.status || "pending",
        category: project.category || "general",
        budget: proposal?.proposed_budget || project.budget || 0,
        detail: project.description || "No description available",
        datetime: project.createdAt.toISOString(),
      };
    });

    // Calculate service provider metrics
    const completionRate =
      totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

    // Calculate on-time delivery (simplified - jobs completed within estimated time)
    const onTimeJobs = await Job.countDocuments({
      service_provider: service_provider_id,
      status: "completed",
      // Add logic for on-time delivery based on your business rules
    });
    const onTimeRate =
      completedJobs > 0 ? Math.round((onTimeJobs / completedJobs) * 100) : 0;

    // Customer satisfaction based on ratings
    const customerSatisfaction =
      averageRating > 0 ? Math.round(averageRating * 20) : 0; // Convert 5-star to percentage

    // Response time (simplified - could be calculated based on message response times)
    const responseTime = 24; // hours - placeholder

    const serviceProviderMetrics = [
      {
        label: "Job completion rate",
        value: completionRate,
      },
      {
        label: "On-time delivery",
        value: onTimeRate,
      },
      {
        label: "Customer satisfactions",
        value: customerSatisfaction,
      },
      {
        label: "Response time",
        value: responseTime,
      },
    ];

    // Get total applications count
    const totalApplications = await ProjectJob.countDocuments({
      "proposals.service_provider_id": service_provider_id,
    });

    // Build service provider info summary
    const serviceProviderInfo = {
      status: serviceProvider.isEmailVerified,
      total_services: totalServices,
      total_applications: totalApplications,
      join_date: new Date(serviceProvider.createdAt).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "short",
          day: "2-digit",
        }
      ),
      email_verify: serviceProvider.isEmailVerified,
    };

    const responseData = {
      message: "Service provider details retrieved successfully",
      service_provider: {
        personalInfo,
        stats,
        servicePortfolio: formattedServicePortfolio,
        jobApplication: formattedJobApplications,
        serviceProviderMetrics,
        serviceProviderInfo,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting service provider details:", err);

    if (err.name === "CastError") {
      return res
        .status(400)
        .json({ error: "Invalid service provider ID format" });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// Add this function to controllers/adminController.js

// @desc    Get admin companies data
// @route   GET /admin/get_companies
// @access  Private (Admin Only)
exports.getAdminCompanies = async (req, res) => {
  try {
    const dateRanges = getDateRanges();
    const {
      currentMonthStart,
      currentMonthEnd,
      previousMonthStart,
      previousMonthEnd,
    } = dateRanges;

    // 1. Total Service Providers with companies (users who have company profiles)
    const totalServiceProvidersCurrentMonth = await Company.countDocuments({
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
    });

    const totalServiceProvidersPreviousMonth = await Company.countDocuments({
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
    });

    const totalServiceProvidersOverall = await Company.countDocuments({});

    // 2. Active Service Providers (companies with active services or recent jobs)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Get companies whose users have active services or recent jobs
    const companies = await Company.find({}).select("user_id");
    const companyUserIds = companies.map((company) => company.user_id);

    const [activeFromServices, activeFromJobs] = await Promise.all([
      Service.distinct("user", {
        user: { $in: companyUserIds },
        service_status: true,
        createdAt: { $gte: thirtyDaysAgo },
      }),
      Job.distinct("service_provider", {
        service_provider: { $in: companyUserIds },
        createdAt: { $gte: thirtyDaysAgo },
      }),
    ]);

    const [previousActiveFromServices, previousActiveFromJobs] =
      await Promise.all([
        Service.distinct("user", {
          user: { $in: companyUserIds },
          service_status: true,
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        }),
        Job.distinct("service_provider", {
          service_provider: { $in: companyUserIds },
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        }),
      ]);

    // Combine and deduplicate active service providers
    const activeServiceProvidersSet = new Set([
      ...activeFromServices,
      ...activeFromJobs,
    ]);
    const previousActiveServiceProvidersSet = new Set([
      ...previousActiveFromServices,
      ...previousActiveFromJobs,
    ]);

    const activeServiceProvidersCount = activeServiceProvidersSet.size;
    const previousActiveServiceProvidersCount =
      previousActiveServiceProvidersSet.size;

    // 3. New This Month
    const newThisMonthCount = totalServiceProvidersCurrentMonth;
    const newPreviousMonthCount = totalServiceProvidersPreviousMonth;

    // 4. Total Earnings (sum of all completed jobs for company service providers)
    const currentMonthEarnings = await Job.aggregate([
      {
        $match: {
          service_provider: { $in: companyUserIds },
          status: "completed",
          completed_date: { $gte: currentMonthStart, $lte: currentMonthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);

    const previousMonthEarnings = await Job.aggregate([
      {
        $match: {
          service_provider: { $in: companyUserIds },
          status: "completed",
          completed_date: { $gte: previousMonthStart, $lte: previousMonthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);

    const currentEarnings = currentMonthEarnings[0]?.total || 0;
    const previousEarnings = previousMonthEarnings[0]?.total || 0;

    // Get total earnings overall for companies
    const totalEarningsOverall = await Job.aggregate([
      {
        $match: {
          service_provider: { $in: companyUserIds },
          status: "completed",
        },
      },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);
    const overallEarnings = totalEarningsOverall[0]?.total || 0;

    // 5. Get all companies with their details
    const allCompanies = await Company.find({})
      .populate("_id user_id", "username email createdAt isEmailVerified")
      .sort({ createdAt: -1 })
      .limit(100);

    // Get detailed company data
    const formattedCompanies = await Promise.all(
      allCompanies.map(async (company) => {
        // Get services count for this company
        const servicesCount = await Service.countDocuments({
          user: company.user_id._id,
        });

        // Format company data
        return {
          company: {
            _id: company._id,
            full_name:
              company.name ||
              company.owner_name ||
              company.user_id.username ||
              "N/A",
            email: company.business_email || company.user_id.email,
          },
          services: servicesCount,
          experience: company.experience || 0,
          location: company.service_location || company.address || "N/A",
          join_date: company.createdAt.toISOString(),
          status: company.user_id.isEmailVerified,
        };
      })
    );

    // Build stats object
    const stats = {
      total_service_providers: {
        value: totalServiceProvidersOverall,
        trendingValue: calculateTrending(
          totalServiceProvidersCurrentMonth,
          totalServiceProvidersPreviousMonth
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            totalServiceProvidersCurrentMonth,
            totalServiceProvidersPreviousMonth
          )
        ),
      },
      active_service_provider: {
        value: activeServiceProvidersCount,
        trendingValue: calculateTrending(
          activeServiceProvidersCount,
          previousActiveServiceProvidersCount
        ),
        isTrending: isTrendingPositive(
          calculateTrending(
            activeServiceProvidersCount,
            previousActiveServiceProvidersCount
          )
        ),
      },
      new_this_month: {
        value: newThisMonthCount,
        trendingValue: calculateTrending(
          newThisMonthCount,
          newPreviousMonthCount
        ),
        isTrending: isTrendingPositive(
          calculateTrending(newThisMonthCount, newPreviousMonthCount)
        ),
      },
      total_earning: {
        value: overallEarnings,
        trendingValue: calculateTrending(currentEarnings, previousEarnings),
        isTrending: isTrendingPositive(
          calculateTrending(currentEarnings, previousEarnings)
        ),
      },
    };

    const responseData = {
      message: "Admin companies data retrieved successfully",
      stats,
      companies: formattedCompanies,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting admin companies data:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Add this function to controllers/adminController.js

// @desc    Get specific company details for admin
// @route   POST /admin/get_company
// @access  Private (Admin Only)
exports.getAdminCompany = async (req, res) => {
  try {
    const { company_id } = req.body;

    if (!company_id) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    // Find the company
    const company = await Company.findById(company_id).populate(
      "user_id",
      "username email createdAt isEmailVerified user_type"
    );

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Get company documents
    const companyDocuments = await CompanyDocument.find({
      user_id: company.user_id._id,
    }).select("title dated doc_image createdAt updatedAt");

    // Get user profile for additional company information
    const userProfile = await UserProfile.findOne({
      user_id: company.user_id._id,
    });

    // Get services created by this company
    const services = await Service.find({
      user: company.user_id._id,
    }).select("service_title service_category service_status createdAt");

    // Get job statistics for this company
    const [totalJobs, completedJobs, totalEarnings] = await Promise.all([
      Job.countDocuments({ service_provider: company.user_id._id }),
      Job.countDocuments({
        service_provider: company.user_id._id,
        status: "completed",
      }),
      Job.aggregate([
        {
          $match: {
            service_provider: company.user_id._id,
            status: "completed",
          },
        },
        { $group: { _id: null, total: { $sum: "$price" } } },
      ]),
    ]);

    // Get project statistics
    const [totalProjects, completedProjects] = await Promise.all([
      ProjectJob.countDocuments({ selected_provider: company.user_id._id }),
      ProjectJob.countDocuments({
        selected_provider: company.user_id._id,
        status: "completed",
      }),
    ]);

    // Get certificates if any
    const certificates = await Certificate.find({
      user_id: company.user_id._id,
    }).select("title dated certificate_img createdAt");

    // Format company documents
    const formattedDocuments = companyDocuments.map((doc) => ({
      id: doc._id.toString(),
      title: doc.title,
      dated: doc.dated.toISOString(),
      doc_image: doc.doc_image,
      uploaded_at: doc.createdAt.toISOString(),
      updated_at: doc.updatedAt.toISOString(),
    }));

    // Format certificates
    const formattedCertificates = certificates.map((cert) => ({
      id: cert._id.toString(),
      title: cert.title,
      dated: cert.dated.toISOString(),
      certificate_img: cert.certificate_img,
      uploaded_at: cert.createdAt.toISOString(),
    }));

    // Format services
    const formattedServices = services.map((service) => ({
      id: service._id.toString(),
      title: service.service_title,
      category: service.service_category,
      status: service.service_status ? "active" : "inactive",
      created_at: service.createdAt.toISOString(),
    }));

    // Build comprehensive company object
    const companyData = {
      // Basic company information
      id: company._id.toString(),
      name: company.name || "N/A",
      business_email: company.business_email || company.user_id.email,
      address: company.address || "N/A",
      experience: company.experience || 0,
      description: company.description || "No description available",

      // Owner information
      owner_name: company.owner_name || "N/A",
      owner_cnic: company.owner_cnic || "N/A",
      phone_number: company.phone_number || userProfile?.phone_number || "N/A",
      service_location:
        company.service_location || userProfile?.service_location || "N/A",

      // Company assets
      logo: company.logo || "",
      banner: company.banner || "",
      license_img: company.license_img || "",

      // Registration details
      BRN: company.BRN || "N/A",
      tax_ntn: company.tax_ntn || "N/A",

      // Services and tags
      services_tags: company.services_tags || [],

      // User account information
      user_account: {
        id: company.user_id._id.toString(),
        username: company.user_id.username,
        email: company.user_id.email,
        user_type: company.user_id.user_type,
        is_email_verified: company.user_id.isEmailVerified,
        joined_date: company.user_id.createdAt.toISOString(),
      },

      // Company statistics
      statistics: {
        total_services: services.length,
        active_services: services.filter((s) => s.service_status).length,
        total_jobs: totalJobs,
        completed_jobs: completedJobs,
        total_projects: totalProjects,
        completed_projects: completedProjects,
        total_earnings: totalEarnings[0]?.total || 0,
        job_completion_rate:
          totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
        project_completion_rate:
          totalProjects > 0
            ? Math.round((completedProjects / totalProjects) * 100)
            : 0,
      },

      // Documents and certificates
      company_documents: formattedDocuments,
      certificates: formattedCertificates,

      // Services offered
      services: formattedServices,

      // Profile information
      profile_info: {
        profile_img: userProfile?.profile_img || "",
        banner_img: userProfile?.banner_img || "",
        intro_video: userProfile?.intro_video || "",
        introduction: userProfile?.introduction || "",
        website: userProfile?.website || "",
        fullname: userProfile?.fullname || "",
        cnic: userProfile?.cnic || "",
      },

      // Timestamps
      created_at: company.createdAt.toISOString(),
      updated_at: company.updatedAt.toISOString(),

      // Status information
      status: {
        is_active: company.user_id.isEmailVerified,
        account_status: company.user_id.isEmailVerified ? "active" : "inactive",
        has_services: services.length > 0,
        has_documents: companyDocuments.length > 0,
        has_certificates: certificates.length > 0,
        profile_completeness: calculateProfileCompleteness(
          company,
          userProfile
        ),
      },
    };

    const responseData = {
      message: "Company details retrieved successfully",
      company: companyData,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting company details:", err);

    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid company ID format" });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// Helper function to calculate profile completeness
const calculateProfileCompleteness = (company, userProfile) => {
  let completeness = 0;
  const totalFields = 15;

  // Company fields
  if (company.name) completeness++;
  if (company.business_email) completeness++;
  if (company.address) completeness++;
  if (company.description) completeness++;
  if (company.owner_name) completeness++;
  if (company.phone_number) completeness++;
  if (company.service_location) completeness++;
  if (company.logo) completeness++;
  if (company.experience > 0) completeness++;

  // Profile fields
  if (userProfile?.fullname) completeness++;
  if (userProfile?.introduction) completeness++;
  if (userProfile?.profile_img) completeness++;
  if (userProfile?.website) completeness++;
  if (userProfile?.cnic) completeness++;
  if (company.services_tags && company.services_tags.length > 0) completeness++;

  return Math.round((completeness / totalFields) * 100);
};

// Add these functions to controllers/adminController.js

// @desc    Delete a user (soft delete by deactivating)
// @route   POST /admin/delete_user
// @access  Private (Admin Only)
exports.deleteUser = async (req, res) => {
  try {
    const { user_id, permanent_delete = false } = req.body;

    // Find the user
    const user = await User.findById(user_id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent admin from deleting themselves
    if (user_id === req.user.id.toString()) {
      return res
        .status(400)
        .json({ error: "You cannot delete your own account" });
    }

    // Prevent deleting other admins (optional security measure)
    if (user.isAdmin && !req.user.isSuperAdmin) {
      return res.status(400).json({ error: "Cannot delete admin accounts" });
    }

    if (permanent_delete) {
      // Permanent deletion - remove all associated data
      await Promise.all([
        UserProfile.deleteOne({ user_id }),
        Service.deleteMany({ user: user_id }),
        Project.deleteMany({ user_id }),
        Certificate.deleteMany({ user_id }),
        Job.deleteMany({
          $or: [{ service_provider: user_id }, { client: user_id }],
        }),
        ProjectJob.deleteMany({
          $or: [{ client_id: user_id }, { selected_provider: user_id }],
        }),
        Order.deleteMany({ $or: [{ supplier_id: user_id }] }),
        ClientOrder.deleteMany({
          $or: [{ client_id: user_id }, { supplier_id: user_id }],
        }),
        Product.deleteMany({ supplier_id: user_id }),
        Collection.deleteMany({ supplier_id: user_id }),
        Customer.deleteMany({ supplier_id: user_id }),
        Vendor.deleteMany({ supplier_id: user_id }),
        Company.deleteOne({ user_id }),
        CompanyDocument.deleteMany({ user_id }),
        User.findByIdAndDelete(user_id),
      ]);
    } else {
      // Soft delete - deactivate account
      user.isEmailVerified = false;
      await user.save();
    }

    const responseData = {
      message: permanent_delete
        ? "User permanently deleted successfully"
        : "User deactivated successfully",
      user_id,
      username: user.username,
      deletion_type: permanent_delete ? "permanent" : "soft",
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete a project
// @route   POST /admin/delete_project
// @access  Private (Admin Only)
exports.deleteProject = async (req, res) => {
  try {
    const { project_id } = req.body;

    const project = await ProjectJob.findById(project_id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Delete related jobs and saved jobs
    await Promise.all([
      Job.deleteMany({ project_job: project_id }),
      SavedJob.deleteMany({ project_job: project_id }),
      ProjectJob.findByIdAndDelete(project_id),
    ]);

    const responseData = {
      message: "Project deleted successfully",
      project_id,
      project_title: project.title,
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting project:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete a service
// @route   POST /admin/delete_service
// @access  Private (Admin Only)
exports.deleteService = async (req, res) => {
  try {
    const { service_id } = req.body;

    const service = await Service.findById(service_id).populate(
      "user",
      "username"
    );

    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    // Delete related jobs
    await Promise.all([
      Job.deleteMany({ service: service_id }),
      Service.findByIdAndDelete(service_id),
    ]);

    const responseData = {
      message: "Service deleted successfully",
      service_id,
      service_title: service.service_title,
      service_provider: service.user?.username || "Unknown",
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting service:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete a product
// @route   POST /admin/delete_product
// @access  Private (Admin Only)
exports.deleteProduct = async (req, res) => {
  try {
    const { product_id } = req.body;

    const product = await Product.findById(product_id).populate(
      "supplier_id",
      "username"
    );

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Remove product from collections and orders
    await Promise.all([
      Collection.updateMany(
        { product_list: product_id },
        { $pull: { product_list: product_id } }
      ),
      Product.findByIdAndDelete(product_id),
    ]);

    const responseData = {
      message: "Product deleted successfully",
      product_id,
      product_title: product.title,
      supplier: product.supplier_id?.username || "Unknown",
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete an order
// @route   POST /admin/delete_order
// @access  Private (Admin Only)
exports.deleteOrder = async (req, res) => {
  try {
    const { order_id, order_type = "supplier" } = req.body;

    let order;
    if (order_type === "client") {
      order = await ClientOrder.findById(order_id);
      if (order) {
        await ClientOrder.findByIdAndDelete(order_id);
      }
    } else {
      order = await Order.findById(order_id);
      if (order) {
        await Order.findByIdAndDelete(order_id);
      }
    }

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const responseData = {
      message: "Order deleted successfully",
      order_id,
      order_no: order.order_no,
      order_type,
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting order:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete a customer
// @route   POST /admin/delete_customer
// @access  Private (Admin Only)
exports.deleteCustomer = async (req, res) => {
  try {
    const { customer_id } = req.body;

    const customer = await Customer.findById(customer_id);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Update orders to remove customer reference
    await Promise.all([
      Order.updateMany({ customer_id: customer_id }, { customer_id: null }),
      Customer.findByIdAndDelete(customer_id),
    ]);

    const responseData = {
      message: "Customer deleted successfully",
      customer_id,
      customer_name: `${customer.first_name} ${customer.last_name}`,
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting customer:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete a collection
// @route   POST /admin/delete_collection
// @access  Private (Admin Only)
exports.deleteCollection = async (req, res) => {
  try {
    const { collection_id } = req.body;

    const collection = await Collection.findById(collection_id).populate(
      "supplier_id",
      "username"
    );

    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    await Collection.findByIdAndDelete(collection_id);

    const responseData = {
      message: "Collection deleted successfully",
      collection_id,
      collection_title: collection.title,
      supplier: collection.supplier_id?.username || "Unknown",
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting collection:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete a company
// @route   POST /admin/delete_company
// @access  Private (Admin Only)
exports.deleteCompany = async (req, res) => {
  try {
    const { company_id } = req.body;

    const company = await Company.findById(company_id).populate(
      "user_id",
      "username"
    );

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Delete related company documents
    await Promise.all([
      CompanyDocument.deleteMany({ user_id: company.user_id }),
      Company.findByIdAndDelete(company_id),
    ]);

    const responseData = {
      message: "Company deleted successfully",
      company_id,
      company_name: company.name,
      owner: company.user_id?.username || "Unknown",
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting company:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete a vendor
// @route   POST /admin/delete_vendor
// @access  Private (Admin Only)
exports.deleteVendor = async (req, res) => {
  try {
    const { vendor_id } = req.body;

    const vendor = await Vendor.findById(vendor_id);

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // Update purchase orders to remove vendor reference
    await Promise.all([
      PurchaseOrder.updateMany({ vendor_id: vendor_id }, { vendor_id: null }),
      Vendor.findByIdAndDelete(vendor_id),
    ]);

    const responseData = {
      message: "Vendor deleted successfully",
      vendor_id,
      vendor_name: `${vendor.first_name} ${vendor.last_name}`,
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting vendor:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete a purchase order
// @route   POST /admin/delete_purchase_order
// @access  Private (Admin Only)
exports.deletePurchaseOrder = async (req, res) => {
  try {
    const { purchase_order_id } = req.body;

    const purchaseOrder = await PurchaseOrder.findById(purchase_order_id);

    if (!purchaseOrder) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    await PurchaseOrder.findByIdAndDelete(purchase_order_id);

    const responseData = {
      message: "Purchase order deleted successfully",
      purchase_order_id,
      po_no: purchaseOrder.po_no,
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting purchase order:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete a discount
// @route   POST /admin/delete_discount
// @access  Private (Admin Only)
exports.deleteDiscount = async (req, res) => {
  try {
    const { discount_id } = req.body;

    const discount = await Discount.findById(discount_id);

    if (!discount) {
      return res.status(404).json({ error: "Discount not found" });
    }

    await Discount.findByIdAndDelete(discount_id);

    const responseData = {
      message: "Discount deleted successfully",
      discount_id,
      discount_title: discount.title,
      discount_code: discount.code,
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting discount:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete a notification
// @route   POST /admin/delete_notification
// @access  Private (Admin Only)
exports.deleteNotification = async (req, res) => {
  try {
    const { notification_id } = req.body;

    const notification = await Notification.findById(notification_id);

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    await Notification.findByIdAndDelete(notification_id);

    const responseData = {
      message: "Notification deleted successfully",
      notification_id,
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting notification:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete site builder data
// @route   POST /admin/delete_site_builder
// @access  Private (Admin Only)
exports.deleteSiteBuilder = async (req, res) => {
  try {
    const { supplier_id } = req.body;

    const siteBuilder = await SupplierSiteBuilder.findOne({ supplier_id });

    if (!siteBuilder) {
      return res.status(404).json({ error: "Site builder data not found" });
    }

    await SupplierSiteBuilder.findByIdAndDelete(siteBuilder._id);

    const responseData = {
      message: "Site builder data deleted successfully",
      supplier_id,
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error deleting site builder data:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Bulk delete users
// @route   POST /admin/bulk_delete_users
// @access  Private (Admin Only)
exports.bulkDeleteUsers = async (req, res) => {
  try {
    const { user_ids, permanent_delete = false } = req.body;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: "User IDs array is required" });
    }

    // Prevent admin from deleting themselves
    if (user_ids.includes(req.user.id.toString())) {
      return res
        .status(400)
        .json({ error: "You cannot delete your own account" });
    }

    const users = await User.find({ _id: { $in: user_ids } });

    if (users.length === 0) {
      return res.status(404).json({ error: "No users found" });
    }

    let deletedCount = 0;
    const deletedUsers = [];

    for (const user of users) {
      // Skip admin users if current user is not super admin
      if (user.isAdmin && !req.user.isSuperAdmin) {
        continue;
      }

      if (permanent_delete) {
        // Permanent deletion
        await Promise.all([
          UserProfile.deleteOne({ user_id: user._id }),
          Service.deleteMany({ user: user._id }),
          Project.deleteMany({ user_id: user._id }),
          User.findByIdAndDelete(user._id),
        ]);
      } else {
        // Soft delete
        user.isEmailVerified = false;
        await user.save();
      }

      deletedCount++;
      deletedUsers.push({
        user_id: user._id.toString(),
        username: user.username,
        user_type: user.user_type,
      });
    }

    const responseData = {
      message: `${deletedCount} users ${
        permanent_delete ? "permanently deleted" : "deactivated"
      } successfully`,
      deletion_type: permanent_delete ? "permanent" : "soft",
      deleted_count: deletedCount,
      deleted_users: deletedUsers,
      deleted_at: new Date().toISOString(),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error bulk deleting users:", err);
    res.status(500).json({ error: "Server error" });
  }
};
