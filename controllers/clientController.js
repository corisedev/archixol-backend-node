// controllers/clientController.js
const User = require("../models/User");
const Job = require("../models/Job");
const ProjectJob = require("../models/ProjectJob");
const ClientOrder = require("../models/ClientOrder");
const Product = require("../models/Product");
const Service = require("../models/Service");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Get client dashboard data
// @route   GET /client/dashboard
// @access  Private (Client Only)
exports.getClientDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get current projects (jobs that are accepted or in progress)
    const currentProjectsCount = await Job.countDocuments({
      client: userId,
      status: { $in: ["accepted", "in_progress"] },
    });

    // Calculate total spent (sum of completed and paid jobs)
    const totalSpentResult = await Job.aggregate([
      {
        $match: {
          client: userId,
          status: "completed",
          payment_status: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$price" },
        },
      },
    ]);

    const totalSpent =
      totalSpentResult.length > 0 ? totalSpentResult[0].totalSpent : 0;

    // Get pending orders count (jobs that are requested but not yet accepted)
    const pendingOrdersCount = await Job.countDocuments({
      client: userId,
      status: "requested",
    });

    // Get project completion count (completed jobs)
    const projectCompletionCount = await Job.countDocuments({
      client: userId,
      status: "completed",
    });

    // Get purchased services (recent completed jobs with service details)
    const purchasedServices = await Job.find({
      client: userId,
      status: { $in: ["completed", "in_progress", "accepted"] },
    })
      .populate({
        path: "service",
        select: "service_title service_description",
      })
      .populate({
        path: "service_provider",
        select: "username",
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Format purchased services for response
    const formattedPurchasedServices = purchasedServices.map((job) => ({
      title: job.service?.service_title || "Service Unavailable",
      provider_name: job.service_provider?.username || "Unknown Provider",
      purchase_date: job.createdAt,
      description: job.service?.service_description || job.requirements,
      price: job.price,
      status: job.status,
    }));

    const responseData = {
      message: "Client dashboard data retrieved successfully",
      current_projects: currentProjectsCount,
      total_spent: totalSpent,
      pending_orders: pendingOrdersCount,
      project_completion: projectCompletionCount,
      purchased_services: formattedPurchasedServices,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Client dashboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get Jobs and Projects
// @route   GET /client/jobs
// @access  Private (Client Only)
exports.getJobsAndProjects = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get project statistics
    const totalProjects = await ProjectJob.countDocuments({
      client_id: userId,
    });

    const budgetResult = await ProjectJob.aggregate([
      { $match: { client_id: userId } },
      { $group: { _id: null, totalBudget: { $sum: "$budget" } } },
    ]);
    const totalBudget =
      budgetResult.length > 0 ? budgetResult[0].totalBudget : 0;

    const completed = await ProjectJob.countDocuments({
      client_id: userId,
      status: "completed",
    });

    const inProgress = await ProjectJob.countDocuments({
      client_id: userId,
      status: "in_progress",
    });

    const openJobs = await ProjectJob.countDocuments({
      client_id: userId,
      status: "open",
    });

    // Get jobs list with proposal count
    const jobs = await ProjectJob.find({ client_id: userId })
      .sort({ createdAt: -1 })
      .lean();

    // Format jobs for response
    const formattedJobs = jobs.map((job) => ({
      project_id: job._id,
      date: job.createdAt,
      title: job.title,
      description: job.description,
      budget: job.budget,
      timeline: job.timeline,
      location: `${job.city}, ${job.address}`,
      proposal_count: job.proposals ? job.proposals.length : 0,
      status: job.status,
      tags: job.tags,
      urgent: job.urgent,
      required_skills: job.required_skills,
    }));

    const responseData = {
      message: "Jobs and projects retrieved successfully",
      total_projects: totalProjects,
      total_budget: totalBudget,
      completed: completed,
      inprogress: inProgress,
      open_jobs: openJobs,
      jobs: formattedJobs,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get jobs and projects error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Create Job
// @route   POST /client/create_jobs
// @access  Private (Client Only)
exports.createJob = async (req, res) => {
  try {
    const {
      name: title,
      category, // ADD THIS
      details: description,
      budget,
      days_project: timeline,
      location: city,
      location: address,
      urgent = false,
      note = "",
      docs = [],
      required_skills = [],
      tags = [],
      starting_date, // ADD THIS IF NEEDED
    } = req.body;

    const clientId = req.user.id;

    // Normalize category to lowercase
    const normalizedCategory = category ? category.toLowerCase().trim() : "";

    console.log("Creating job with category:", normalizedCategory);

    // Create project job
    const projectJob = await ProjectJob.create({
      client_id: clientId,
      title,
      category: normalizedCategory, // ADD THIS
      description,
      budget: Number(budget),
      starting_date: starting_date || new Date(), // Use provided date or current date
      timeline,
      city,
      address,
      urgent: Boolean(urgent),
      note,
      docs,
      required_skills,
      tags,
      status: "open",
    });

    console.log("Job created successfully with ID:", projectJob._id);

    const responseData = {
      message: "Job created successfully",
      job: {
        id: projectJob._id,
        title: projectJob.title,
        category: projectJob.category,
        description: projectJob.description,
        budget: projectJob.budget,
        timeline: projectJob.timeline,
        city: projectJob.city,
        address: projectJob.address,
        urgent: projectJob.urgent,
        status: projectJob.status,
        created_at: projectJob.createdAt,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in createJob:", err);

    if (err.name === "ValidationError") {
      const validationErrors = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ error: validationErrors[0] });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get Orders
// @route   GET /client/orders
// @access  Private (Client Only)
exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get order statistics
    const totalOrders = await ClientOrder.countDocuments({ client_id: userId });

    const pendingPayments = await ClientOrder.countDocuments({
      client_id: userId,
      payment_status: "pending",
    });

    const beingProcessed = await ClientOrder.countDocuments({
      client_id: userId,
      status: { $in: ["processing", "shipped"] },
    });

    const spentResult = await ClientOrder.aggregate([
      { $match: { client_id: userId, payment_status: "paid" } },
      { $group: { _id: null, totalSpent: { $sum: "$total" } } },
    ]);
    const totalSpent = spentResult.length > 0 ? spentResult[0].totalSpent : 0;

    // Get orders list
    const orders = await ClientOrder.find({ client_id: userId })
      .populate({
        path: "supplier_id",
        select: "username",
      })
      .sort({ placed_at: -1 })
      .lean();

    // Format orders for response
    const ordersList = orders.map((order) => ({
      order_id: order._id,
      created_at: order.placed_at,
      supplier_name: order.supplier_id?.username || "Unknown Supplier",
      items: order.items.map((item) => ({ name: item.title })),
      total: order.total,
      status: order.status,
    }));

    const responseData = {
      message: "Orders retrieved successfully",
      total_orders: totalOrders,
      pending_payments: pendingPayments,
      being_processed: beingProcessed,
      total_spent: totalSpent,
      orders_list: ordersList,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get orders error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get Products
// @route   GET /client/products
// @access  Private (Client Only)
exports.getProducts = async (req, res) => {
  try {
    // Get all active products
    const products = await Product.find({
      status: "active",
    })
      .populate({
        path: "supplier_id",
        select: "username",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Format products for response
    const productsList = products.map((product) => ({
      product_id: product._id,
      title: product.title,
      price: product.price,
      rating: 0, // You'll need to implement rating system
      average_rating: 0,
      no_of_reviews: 0,
      image: product.media && product.media.length > 0 ? product.media[0] : "",
      category: product.category,
      brand: product.supplier_id?.username || "Unknown Brand",
    }));

    const responseData = {
      message: "Products retrieved successfully",
      products_list: productsList,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get products error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get Product
// @route   POST /client/product
// @access  Private (Client Only)
exports.getProduct = async (req, res) => {
  try {
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    // Find the product
    const product = await Product.findOne({
      _id: product_id,
      status: "active",
    })
      .populate({
        path: "supplier_id",
        select: "username",
      })
      .lean();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Format product for response
    const productData = {
      title: product.title,
      price: product.compare_at_price,
      discounted_price: product.price,
      meta_description: product.meta_description,
      description: product.description,
      rating: 0, // You'll need to implement rating system
      average_rating: 0,
      no_of_reviews: 0,
      images: product.media || [],
      category: product.category,
      brand: product.supplier_id?.username || "Unknown Brand",
      weight: product.weight,
      units: product.units,
      region: product.region,
      address: product.address,
      tags: product.search_tags,
      qty: product.quantity,
      variants: product.variants,
    };

    const responseData = {
      message: "Product retrieved successfully",
      product: productData,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get product error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get Services
// @route   GET /client/services
// @access  Private (Client Only)
exports.getServices = async (req, res) => {
  try {
    // Get all active services
    const services = await Service.find({
      service_status: true,
    })
      .populate({
        path: "user",
        select: "username user_type",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Get user profiles for location information
    const userIds = services
      .map((service) => service.user?._id)
      .filter(Boolean);
    const UserProfile = require("../models/UserProfile");
    const userProfiles = await UserProfile.find({
      user_id: { $in: userIds },
    }).lean();

    // Create a map for quick lookup
    const profileMap = {};
    userProfiles.forEach((profile) => {
      profileMap[profile.user_id.toString()] = profile;
    });

    // Format services for response
    const servicesList = services.map((service) => {
      const userProfile = profileMap[service.user?._id?.toString()];

      return {
        service_id: service._id,
        title: service.service_title,
        price: 0, // You'll need to add pricing to Service model
        description: service.service_description,
        rating: service.rating || 0,
        average_rating: service.rating || 0,
        no_of_reviews: service.reviews_count || 0,
        image:
          service.service_images && service.service_images.length > 0
            ? service.service_images[0]
            : "",
        category: service.service_category,
        location: userProfile?.service_location || "Location not specified",
      };
    });

    const responseData = {
      message: "Services retrieved successfully",
      services_list: servicesList,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get services error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get Service
// @route   POST /client/service
// @access  Private (Client Only)
exports.getService = async (req, res) => {
  try {
    const { service_id } = req.body;

    if (!service_id) {
      return res.status(400).json({ error: "Service ID is required" });
    }

    // Find the service
    const service = await Service.findOne({
      _id: service_id,
      service_status: true,
    })
      .populate({
        path: "user",
        select: "username user_type",
      })
      .lean();

    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    // Get user profile for location information
    const UserProfile = require("../models/UserProfile");
    const userProfile = await UserProfile.findOne({
      user_id: service.user._id,
    }).lean();

    // Format service for response
    const serviceData = {
      title: service.service_title,
      price: 0, // You'll need to add pricing to Service model
      description: service.service_description,
      about_service: service.service_description, // or add separate field
      rating: service.rating || 0,
      average_rating: service.rating || 0,
      no_of_reviews: service.reviews_count || 0,
      images: service.service_images || [],
      category: service.service_category,
      location: userProfile?.service_location || "Location not specified",
      website: userProfile?.website,
      faqs: service.service_faqs,
      features: service.service_feature,
      tags: service.service_tags,
      total_jobs_completed: service.total_jobs_completed,
      total_job_requests: service.total_job_requests,
      total_pending_jobs: service.total_pending_jobs,
    };

    const responseData = {
      message: "Service retrieved successfully",
      service: serviceData,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get service error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get My Projects
// @route   GET /client/my-projects
// @access  Private (Client Only)
exports.getMyProjects = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all project jobs for this client
    const projectJobs = await ProjectJob.find({ client_id: userId })
      .populate({
        path: "selected_provider",
        select: "username",
        populate: {
          path: "user_id",
          model: "UserProfile",
          select: "profile_img",
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate statistics
    const totalProjects = projectJobs.length;

    const activeProjects = projectJobs.filter((project) =>
      ["open", "in_progress"].includes(project.status)
    ).length;

    const completedProjects = projectJobs.filter(
      (project) => project.status === "completed"
    ).length;

    // Calculate total investments (sum of all project budgets)
    const totalInvestments = projectJobs.reduce((sum, project) => {
      return sum + (project.budget || 0);
    }, 0);

    // Create stats array
    const stats = [
      {
        label: "Total Projects",
        value: totalProjects,
      },
      {
        label: "Active Projects",
        value: activeProjects,
      },
      {
        label: "Completed",
        value: completedProjects,
      },
      {
        label: "Total Investments",
        value: totalInvestments,
        isPrice: true,
      },
    ];

    // Format projects for response
    const projects = projectJobs.map((project) => {
      // Calculate progress value based on status
      let progressValue = 0;
      switch (project.status) {
        case "open":
          progressValue = 10;
          break;
        case "in_progress":
          progressValue = 50;
          break;
        case "completed":
          progressValue = 100;
          break;
        case "cancelled":
        case "closed":
          progressValue = 0;
          break;
        default:
          progressValue = 0;
      }

      // Get project image - either from docs or use a default/placeholder
      let image = "";
      if (project.docs && project.docs.length > 0) {
        // Find the first image file from docs
        const imageDoc = project.docs.find((doc) => {
          const ext = doc.toLowerCase();
          return (
            ext.includes(".jpg") ||
            ext.includes(".jpeg") ||
            ext.includes(".png") ||
            ext.includes(".gif") ||
            ext.includes(".webp")
          );
        });
        if (imageDoc) {
          image = imageDoc;
        }
      }

      // If no image found in docs, try to get from selected provider profile
      if (!image && project.selected_provider?.user_id?.profile_img) {
        image = project.selected_provider.user_id.profile_img;
      }

      // If still no image, use a placeholder or leave empty
      if (!image) {
        image = "/uploads/placeholders/project-placeholder.png"; // You can add a default image
      }

      return {
        project_id: project._id,
        image: image,
        title: project.title,
        description: project.description,
        price: project.budget,
        date: project.createdAt,
        progressValue: progressValue,
        status: project.status,
      };
    });

    const responseData = {
      message: "My projects retrieved successfully",
      stats: stats,
      projects: projects,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get my projects error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
