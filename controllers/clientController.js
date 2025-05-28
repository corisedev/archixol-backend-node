// controllers/clientController.js
const User = require("../models/User");
const Job = require("../models/Job");
const ProjectJob = require("../models/ProjectJob");
const ClientOrder = require("../models/ClientOrder");
const Product = require("../models/Product");
const Service = require("../models/Service");
const UserProfile = require("../models/UserProfile");
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
      status: { $in: ["in_progress", "pending_client_approval"] },
    });

    const openJobs = await ProjectJob.countDocuments({
      client_id: userId,
      status: "open",
    });

    // Get jobs list with proposal count
    const jobs = await ProjectJob.find({ client_id: userId, status: "open" })
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

    // Get all project jobs for this client with proper population
    const projectJobs = await ProjectJob.find({ client_id: userId })
      .populate({
        path: "selected_provider",
        select: "username user_type email",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate statistics
    const totalProjects = projectJobs.length;

    const activeProjects = projectJobs.filter((project) =>
      ["open", "in_progress", "pending_client_approval"].includes(
        project.status
      )
    ).length;

    const completedProjects = projectJobs.filter(
      (project) => project.status === "completed"
    ).length;

    // Calculate total investments (sum of all project budgets)
    const totalInvestments = projectJobs.reduce((sum, project) => {
      if (
        project.status === "pending_client_approval" ||
        project.status === "in_progress"
      ) {
        return sum + (project.budget || 0);
      }
      return sum; // Important: Return the sum even if the condition is false!
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

    // Get UserProfile data separately if needed for profile images
    let userProfiles = {};
    if (projectJobs.some((p) => p.selected_provider)) {
      const providerIds = projectJobs
        .filter((p) => p.selected_provider)
        .map((p) => p.selected_provider._id);

      const profiles = await UserProfile.find({
        user_id: { $in: providerIds },
      }).lean();

      profiles.forEach((profile) => {
        userProfiles[profile.user_id.toString()] = profile;
      });
    }

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
        case "pending_client_approval":
          progressValue = 90;
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
      if (!image && project.selected_provider) {
        const userProfile =
          userProfiles[project.selected_provider._id.toString()];
        if (userProfile?.profile_img) {
          image = userProfile.profile_img;
        }
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
        selected_provider: project.selected_provider
          ? {
              id: project.selected_provider._id,
              username: project.selected_provider.username,
              user_type: project.selected_provider.user_type,
              email: project.selected_provider.email,
            }
          : null,
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
// @desc    Get all proposals for a specific job posted by client
// @route   POST /client/get_job_proposals
// @access  Private (Client Only)
exports.getJobProposals = async (req, res) => {
  try {
    const { job_id } = req.body;
    const userId = req.user.id;

    if (!job_id) {
      return res.status(400).json({ error: "Job ID is required" });
    }

    // Get the project job and verify it belongs to this client
    const projectJob = await ProjectJob.findOne({
      _id: job_id,
      client_id: userId,
    }).populate("client_id", "username email user_type");

    if (!projectJob) {
      return res.status(404).json({
        error: "Job not found or you don't have permission to view it",
      });
    }

    // Get detailed information for each proposal
    const proposalsWithDetails = await Promise.all(
      projectJob.proposals.map(async (proposal) => {
        try {
          // Get service provider basic info
          const serviceProvider = await User.findById(
            proposal.service_provider_id
          ).select("username email user_type createdAt");

          if (!serviceProvider) {
            return null; // Skip if service provider not found
          }

          // Get service provider profile
          const providerProfile = await UserProfile.findOne({
            user_id: proposal.service_provider_id,
          });

          // Get service provider's services
          const providerServices = await Service.find({
            user: proposal.service_provider_id,
          }).select(
            "service_title service_category service_status total_job_requests total_jobs_completed rating"
          );

          // Get total statistics for this service provider
          const totalApplications = await Job.countDocuments({
            service_provider: proposal.service_provider_id,
          });

          const completedJobs = await Job.countDocuments({
            service_provider: proposal.service_provider_id,
            status: "completed",
          });

          const successRate =
            totalApplications > 0
              ? Math.round((completedJobs / totalApplications) * 100)
              : 0;

          // Calculate average rating from services
          const avgRating =
            providerServices.length > 0
              ? providerServices.reduce(
                  (sum, service) => sum + (service.rating || 0),
                  0
                ) / providerServices.length
              : 0;

          // Format the proposal with complete details
          const proposalWithDetails = {
            // Proposal details
            proposal_id: proposal._id,
            proposal_text: proposal.proposal_text,
            proposed_budget: proposal.proposed_budget,
            proposed_timeline: proposal.proposed_timeline,
            proposal_status: proposal.status,
            submitted_at: proposal.submitted_at,

            // Service provider basic info
            service_provider: {
              id: serviceProvider._id,
              username: serviceProvider.username,
              email: serviceProvider.email,
              user_type: serviceProvider.user_type,
              member_since: serviceProvider.createdAt,
            },

            // Service provider profile
            provider_profile: providerProfile
              ? {
                  fullname: providerProfile.fullname,
                  phone_number: providerProfile.phone_number,
                  experience: providerProfile.experience,
                  address: providerProfile.address,
                  service_location: providerProfile.service_location,
                  introduction: providerProfile.introduction,
                  website: providerProfile.website,
                  profile_img: providerProfile.profile_img,
                  banner_img: providerProfile.banner_img,
                  services_tags: providerProfile.services_tags,
                }
              : null,

            // Service provider services
            provider_services: providerServices.map((service) => ({
              id: service._id,
              service_title: service.service_title,
              service_category: service.service_category,
              service_status: service.service_status,
              rating: service.rating,
            })),

            // Statistics
            provider_stats: {
              total_applications: totalApplications,
              completed_jobs: completedJobs,
              success_rate: successRate,
              average_rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
              total_services: providerServices.length,
              active_services: providerServices.filter((s) => s.service_status)
                .length,
            },

            // Match score (how well this provider matches the job)
            match_score: {
              category_match: providerServices.some(
                (s) => s.service_category === projectJob.type
              ),
              experience_level: providerProfile?.experience || 0,
              location_match:
                providerProfile?.service_location
                  ?.toLowerCase()
                  .includes(projectJob.city?.toLowerCase() || "") || false,
            },
          };

          return proposalWithDetails;
        } catch (error) {
          console.error(`Error processing proposal ${proposal._id}:`, error);
          return null;
        }
      })
    );

    // Filter out null proposals (where service provider wasn't found)
    const validProposals = proposalsWithDetails.filter(
      (proposal) => proposal !== null
    );

    // Sort proposals by various criteria
    const sortedProposals = validProposals.sort((a, b) => {
      // Primary sort: Status (pending first)
      if (a.proposal_status !== b.proposal_status) {
        if (a.proposal_status === "pending") return -1;
        if (b.proposal_status === "pending") return 1;
      }

      // Secondary sort: Success rate (highest first)
      if (b.provider_stats.success_rate !== a.provider_stats.success_rate) {
        return b.provider_stats.success_rate - a.provider_stats.success_rate;
      }

      // Tertiary sort: Submitted date (newest first)
      return new Date(b.submitted_at) - new Date(a.submitted_at);
    });

    // Format job details
    const jobDetails = {
      id: projectJob._id,
      title: projectJob.title,
      description: projectJob.description,
      budget: projectJob.budget,
      timeline: projectJob.timeline,
      city: projectJob.city,
      status: projectJob.status,
      type: projectJob.type,
      urgent: projectJob.urgent,
      created_at: projectJob.createdAt,
      total_proposals: validProposals.length,
    };

    const responseData = {
      message: "Job proposals retrieved successfully",
      job: jobDetails,
      proposals: sortedProposals,
      summary: {
        total_proposals: validProposals.length,
        pending_proposals: validProposals.filter(
          (p) => p.proposal_status === "pending"
        ).length,
        accepted_proposals: validProposals.filter(
          (p) => p.proposal_status === "accepted"
        ).length,
        rejected_proposals: validProposals.filter(
          (p) => p.proposal_status === "rejected"
        ).length,
        average_proposed_budget:
          validProposals.length > 0
            ? Math.round(
                validProposals.reduce((sum, p) => sum + p.proposed_budget, 0) /
                  validProposals.length
              )
            : 0,
        budget_range:
          validProposals.length > 0
            ? {
                min: Math.min(...validProposals.map((p) => p.proposed_budget)),
                max: Math.max(...validProposals.map((p) => p.proposed_budget)),
              }
            : null,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in getJobProposals:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get all jobs posted by client with proposal counts
// @route   GET /client/my_jobs
// @access  Private (Client Only)
exports.getMyJobs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build query
    let query = { client_id: userId };
    if (status) {
      query.status = status;
    }

    // Setup pagination
    const skip = (page - 1) * limit;

    // Get jobs with pagination
    const jobs = await ProjectJob.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalJobs = await ProjectJob.countDocuments(query);

    // Format jobs with proposal information
    const formattedJobs = jobs.map((job) => {
      const jobObj = job.toObject();
      jobObj.id = jobObj._id;
      delete jobObj._id;

      // Add proposal statistics
      const proposals = job.proposals || [];
      jobObj.proposal_stats = {
        total_proposals: proposals.length,
        pending_proposals: proposals.filter((p) => p.status === "pending")
          .length,
        accepted_proposals: proposals.filter((p) => p.status === "accepted")
          .length,
        rejected_proposals: proposals.filter((p) => p.status === "rejected")
          .length,
        has_proposals: proposals.length > 0,
      };

      // Add budget range from proposals
      if (proposals.length > 0) {
        const budgets = proposals.map((p) => p.proposed_budget);
        jobObj.proposal_budget_range = {
          min: Math.min(...budgets),
          max: Math.max(...budgets),
          average: Math.round(
            budgets.reduce((sum, b) => sum + b, 0) / budgets.length
          ),
        };
      }

      return jobObj;
    });

    const responseData = {
      message: "Your jobs retrieved successfully",
      jobs: formattedJobs,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalJobs / limit),
        total_jobs: totalJobs,
        per_page: parseInt(limit),
      },
      summary: {
        total_jobs: totalJobs,
        jobs_with_proposals: formattedJobs.filter(
          (j) => j.proposal_stats.has_proposals
        ).length,
        jobs_without_proposals: formattedJobs.filter(
          (j) => !j.proposal_stats.has_proposals
        ).length,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in getMyJobs:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Accept or reject a proposal
// @route   POST /client/proposal_action
// @access  Private (Client Only)
exports.proposalAction = async (req, res) => {
  try {
    const { job_id, proposal_id, action, message = "" } = req.body;
    const userId = req.user.id;

    // Validate action
    if (!["accept", "reject"].includes(action)) {
      return res
        .status(400)
        .json({ error: "Invalid action. Must be 'accept' or 'reject'" });
    }

    // Get the project job and verify it belongs to this client
    const projectJob = await ProjectJob.findOne({
      _id: job_id,
      client_id: userId,
    });

    if (!projectJob) {
      return res.status(404).json({
        error:
          "Job not found or you don't have permission to perform this action",
      });
    }

    // Check if job is still open
    if (projectJob.status !== "open") {
      return res.status(400).json({
        error: "Cannot modify proposals for jobs that are not open",
      });
    }

    // Find the specific proposal
    const proposalIndex = projectJob.proposals.findIndex(
      (p) => p._id.toString() === proposal_id
    );

    if (proposalIndex === -1) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    const proposal = projectJob.proposals[proposalIndex];

    // Check if proposal is still pending
    if (proposal.status !== "pending") {
      return res.status(400).json({
        error: "Can only modify pending proposals",
      });
    }

    if (action === "accept") {
      // Accept the proposal
      proposal.status = "accepted";

      // Update job status and assign service provider
      projectJob.status = "in_progress";
      projectJob.selected_provider = proposal.service_provider_id;
      projectJob.started_at = new Date();

      // Update budget to match accepted proposal if different
      projectJob.budget = proposal.proposed_budget;

      // Reject all other pending proposals
      projectJob.proposals.forEach((p, index) => {
        if (index !== proposalIndex && p.status === "pending") {
          p.status = "rejected";
        }
      });

      // CRITICAL FIX: Find and update the corresponding Job record
      const jobToUpdate = await Job.findOne({
        service_provider: proposal.service_provider_id,
        project_job: job_id,
      });

      if (jobToUpdate) {
        console.log(`Found Job record to update: ${jobToUpdate._id}`);

        // Update the job status and details
        jobToUpdate.status = "accepted";
        jobToUpdate.price = proposal.proposed_budget; // Update price to match proposal
        jobToUpdate.delivery_date = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ); // 30 days from now
        await jobToUpdate.save();

        console.log(`Updated Job record ${jobToUpdate._id} status to accepted`);
      } else {
        console.error(
          `No Job record found for service_provider: ${proposal.service_provider_id} and project_job: ${job_id}`
        );

        // FALLBACK: Create a Job record if it doesn't exist (shouldn't happen but safety net)
        const newJob = await Job.create({
          service: null, // Will be filled if service is provided
          service_provider: proposal.service_provider_id,
          client: userId,
          project_job: job_id,
          status: "accepted",
          price: proposal.proposed_budget,
          payment_status: "pending",
          requirements: proposal.proposal_text,
          delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        console.log(`Created new Job record: ${newJob._id}`);
      }

      // Update other Job records for rejected proposals
      const rejectedProposals = projectJob.proposals.filter(
        (p, index) => index !== proposalIndex && p.status === "rejected"
      );

      for (const rejectedProposal of rejectedProposals) {
        const rejectedJob = await Job.findOne({
          service_provider: rejectedProposal.service_provider_id,
          project_job: job_id,
        });

        if (rejectedJob) {
          rejectedJob.status = "rejected";
          await rejectedJob.save();
          console.log(`Updated rejected Job record: ${rejectedJob._id}`);
        }
      }

      // Update service provider's service statistics
      await Service.updateMany(
        { user: proposal.service_provider_id },
        {
          $inc: {
            total_job_requests: 1,
            total_pending_jobs: 1,
          },
        }
      );
    } else {
      // Reject the proposal
      proposal.status = "rejected";

      // CRITICAL FIX: Update the corresponding Job record status
      const jobToReject = await Job.findOne({
        service_provider: proposal.service_provider_id,
        project_job: job_id,
      });

      if (jobToReject) {
        jobToReject.status = "rejected";
        await jobToReject.save();
        console.log(`Updated Job record ${jobToReject._id} status to rejected`);
      } else {
        console.error(
          `No Job record found to reject for service_provider: ${proposal.service_provider_id} and project_job: ${job_id}`
        );
      }
    }

    // Save the project job with updated proposals
    await projectJob.save();

    // Get service provider details for notification
    const serviceProvider = await User.findById(
      proposal.service_provider_id
    ).select("username email");

    const responseData = {
      message: `Proposal ${action}ed successfully`,
      job: {
        id: projectJob._id,
        title: projectJob.title,
        status: projectJob.status,
        selected_provider: projectJob.selected_provider,
        started_at: projectJob.started_at,
      },
      proposal: {
        id: proposal._id,
        status: proposal.status,
        service_provider: {
          id: proposal.service_provider_id,
          username: serviceProvider?.username,
        },
      },
      notification_message: message,
    };

    // Send real-time notification to service provider if socket service is available
    if (req.socketService && serviceProvider) {
      const notificationData = {
        type: "proposal_" + action,
        message: `Your proposal for "${projectJob.title}" has been ${action}ed`,
        job_id: projectJob._id,
        job_title: projectJob.title,
        client_message: message,
        timestamp: new Date(),
      };

      req.socketService.emitToUser(
        proposal.service_provider_id.toString(),
        "proposalStatusChanged",
        notificationData
      );
    }

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in proposalAction:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get client projects by status (ongoing, completed, cancelled, rejected)
// @route   GET /client/projects_by_status
// @access  Private (Client Only)
exports.getProjectsByStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build query based on status
    let query = { client_id: userId };

    if (status) {
      switch (status.toLowerCase()) {
        case "ongoing":
          query.status = { $in: ["in_progress", "pending_client_approval"] };
          break;
        case "completed":
          query.status = "completed";
          break;
        case "cancelled":
          query.status = { $in: ["cancelled", "closed"] };
          break;
        case "rejected":
          // Projects where all proposals were rejected and job is still open or closed
          query = {
            ...query,
            $or: [
              { status: "open", "proposals.0": { $exists: true } },
              { status: "closed" },
            ],
          };
          break;
        default:
          return res.status(400).json({
            error:
              "Invalid status. Use: ongoing, completed, cancelled, rejected",
          });
      }
    }

    // Setup pagination
    const skip = (page - 1) * limit;

    // Get projects with pagination
    const projects = await ProjectJob.find(query)
      .populate({
        path: "selected_provider",
        select: "username email user_type",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalProjects = await ProjectJob.countDocuments(query);

    // Format projects with additional details
    const formattedProjects = await Promise.all(
      projects.map(async (project) => {
        let progressPercentage = 0;
        let timeRemaining = null;
        let proposalsSummary = null;

        // Calculate progress based on status
        switch (project.status) {
          case "open":
            progressPercentage = 10;
            break;
          case "in_progress":
            progressPercentage = 50;
            // Calculate time remaining if timeline is specified
            if (project.started_at && project.timeline) {
              const timelineMatch = project.timeline.match(/(\d+)/);
              if (timelineMatch) {
                const timelineDays = parseInt(timelineMatch[0]);
                const startDate = new Date(project.started_at);
                const expectedEndDate = new Date(startDate);
                expectedEndDate.setDate(startDate.getDate() + timelineDays);

                const now = new Date();
                const timeDiff = expectedEndDate - now;
                timeRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)); // days
              }
            }
            break;
          case "completed":
            progressPercentage = 100;
            break;
          default:
            progressPercentage = 0;
        }

        // For rejected status, provide proposals summary
        if (status === "rejected" || project.proposals?.length > 0) {
          const proposals = project.proposals || [];
          proposalsSummary = {
            total: proposals.length,
            pending: proposals.filter((p) => p.status === "pending").length,
            accepted: proposals.filter((p) => p.status === "accepted").length,
            rejected: proposals.filter((p) => p.status === "rejected").length,
          };
        }

        // Get service provider profile if selected
        let serviceProviderProfile = null;
        if (project.selected_provider) {
          serviceProviderProfile = await UserProfile.findOne({
            user_id: project.selected_provider._id,
          })
            .select("profile_img experience service_location")
            .lean();
        }

        return {
          project_id: project._id,
          title: project.title,
          category: project.category,
          description: project.description,
          budget: project.budget,
          timeline: project.timeline,
          status: project.status,
          urgent: project.urgent,
          city: project.city,
          address: project.address,
          created_at: project.createdAt,
          started_at: project.started_at,
          completed_at: project.completed_at,
          progress_percentage: progressPercentage,
          time_remaining_days: timeRemaining,
          selected_provider: project.selected_provider
            ? {
                id: project.selected_provider._id,
                username: project.selected_provider.username,
                email: project.selected_provider.email,
                user_type: project.selected_provider.user_type,
                profile_img: serviceProviderProfile?.profile_img || "",
                experience: serviceProviderProfile?.experience || 0,
                service_location:
                  serviceProviderProfile?.service_location || "",
              }
            : null,
          proposals_summary: proposalsSummary,
          required_skills: project.required_skills,
          tags: project.tags,
          docs: project.docs,
        };
      })
    );

    // Calculate summary statistics
    const summaryStats = await ProjectJob.aggregate([
      { $match: { client_id: userId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalBudget: { $sum: "$budget" },
        },
      },
    ]);

    const summary = {
      total_projects: totalProjects,
      ongoing:
        summaryStats.find(
          (s) => s._id === "in_progress" || s._id === "pending_client_approval"
        )?.count || 0,
      completed: summaryStats.find((s) => s._id === "completed")?.count || 0,
      cancelled: summaryStats
        .filter((s) => ["cancelled", "closed"].includes(s._id))
        .reduce((sum, s) => sum + s.count, 0),
      open: summaryStats.find((s) => s._id === "open")?.count || 0,
      total_investment: summaryStats.reduce(
        (sum, s) => sum + (s.totalBudget || 0),
        0
      ),
    };

    const responseData = {
      message: "Projects retrieved successfully",
      projects: formattedProjects,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalProjects / limit),
        total_projects: totalProjects,
        per_page: parseInt(limit),
      },
      summary: summary,
      filter_applied: status || "all",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in getProjectsByStatus:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Cancel an ongoing project
// @route   POST /client/cancel_project
// @access  Private (Client Only)
exports.cancelProject = async (req, res) => {
  try {
    const { project_id, reason = "", notify_provider = true } = req.body;
    const userId = req.user.id;

    // Get the project and verify it belongs to this client
    const project = await ProjectJob.findOne({
      _id: project_id,
      client_id: userId,
    }).populate({
      path: "selected_provider",
      select: "username email user_type",
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or you don't have permission to cancel it",
      });
    }

    // Check if project can be cancelled
    if (
      !["open", "in_progress", "pending_client_approval"].includes(
        project.status
      )
    ) {
      return res.status(400).json({
        error: "Can only cancel open or in-progress projects",
      });
    }

    // Update project status
    const previousStatus = project.status;
    project.status = "cancelled";
    project.completed_at = new Date();

    // Add cancellation note
    if (!project.note) {
      project.note = `Cancelled by client. Reason: ${reason}`;
    } else {
      project.note += `\n\nCancelled by client. Reason: ${reason}`;
    }

    await project.save();

    // Update service provider statistics if project was in progress
    if (previousStatus === "in_progress" && project.selected_provider) {
      await Service.updateMany(
        { user: project.selected_provider._id },
        {
          $inc: {
            total_pending_jobs: -1,
          },
        }
      );
    }

    const responseData = {
      message: "Project cancelled successfully",
      project: {
        id: project._id,
        title: project.title,
        status: project.status,
        cancelled_at: project.completed_at,
        cancellation_reason: reason,
        previous_status: previousStatus,
      },
    };

    // Send notification to service provider if applicable
    if (notify_provider && project.selected_provider && req.socketService) {
      const notificationData = {
        type: "project_cancelled",
        message: `Project "${project.title}" has been cancelled by the client`,
        project_id: project._id,
        project_title: project.title,
        cancellation_reason: reason,
        cancelled_at: project.completed_at,
        timestamp: new Date(),
      };

      req.socketService.emitToUser(
        project.selected_provider._id.toString(),
        "projectCancelled",
        notificationData
      );
    }

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in cancelProject:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Mark project as completed
// @route   POST /client/complete_project
// @access  Private (Client Only)
exports.completeProject = async (req, res) => {
  try {
    const {
      project_id,
      feedback_rating,
      feedback_comment = "",
      final_payment_amount,
      approve_provider_completion = true,
    } = req.body;
    const userId = req.user.id;

    const project = await ProjectJob.findOne({
      _id: project_id,
      client_id: userId,
    }).populate({
      path: "selected_provider",
      select: "username email user_type",
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or you don't have permission to complete it",
      });
    }

    // Allow completion from both "in_progress" and "pending_client_approval" statuses
    if (!["in_progress", "pending_client_approval"].includes(project.status)) {
      return res.status(400).json({
        error:
          "Can only complete in-progress projects or approve submitted work",
      });
    }

    // Validate feedback rating if provided
    if (feedback_rating && (feedback_rating < 1 || feedback_rating > 5)) {
      return res.status(400).json({
        error: "Feedback rating must be between 1 and 5",
      });
    }

    const wasSubmittedByProvider = project.status === "pending_client_approval";
    const previousStatus = project.status;

    // Update project status to completed
    project.status = "completed";
    project.completed_at = new Date();
    project.payment_status = final_payment_amount ? "paid" : "pending";

    // Add completion feedback
    const completionEntry = `\n\n[${new Date().toISOString()}] CLIENT COMPLETION:`;
    let completionText = completionEntry;

    if (wasSubmittedByProvider && approve_provider_completion) {
      completionText += `\nApproved provider's submitted work.`;
    }

    if (feedback_rating) {
      completionText += `\nRating: ${feedback_rating}/5`;
    }

    if (feedback_comment) {
      completionText += `\nFeedback: ${feedback_comment}`;
    }

    project.note = (project.note || "") + completionText;

    await project.save();

    // NOW update service provider statistics (only when truly completed)
    if (project.selected_provider) {
      const updateStats = {
        $inc: {
          total_jobs_completed: 1,
          total_pending_jobs: -1,
        },
      };

      if (final_payment_amount) {
        updateStats.$inc.total_earnings = final_payment_amount;
      }

      // Update average rating if feedback is provided
      if (feedback_rating) {
        const services = await Service.find({
          user: project.selected_provider._id,
        });
        if (services.length > 0) {
          const totalRatings = services.reduce(
            (sum, service) => sum + (service.rating || 0),
            0
          );
          const newAverageRating =
            (totalRatings + feedback_rating) / (services.length + 1);
          updateStats.$set = { rating: Math.round(newAverageRating * 10) / 10 };
        }
      }

      await Service.updateMany(
        { user: project.selected_provider._id },
        updateStats
      );
    }

    const responseData = {
      message: wasSubmittedByProvider
        ? "Provider's work approved and project completed"
        : "Project completed successfully",
      project: {
        id: project._id,
        title: project.title,
        status: project.status,
        completed_at: project.completed_at,
        provider_completed_at: project.provider_completed_at,
        payment_status: project.payment_status,
        feedback_rating: feedback_rating,
        feedback_comment: feedback_comment,
        final_payment_amount: final_payment_amount,
        was_submitted_by_provider: wasSubmittedByProvider,
        previous_status: previousStatus,
      },
    };

    // Notify service provider
    if (project.selected_provider && req.socketService) {
      const notificationData = {
        type: "project_completed",
        message: wasSubmittedByProvider
          ? `Your submitted work for "${project.title}" has been approved!`
          : `Project "${project.title}" has been marked as completed by the client`,
        project_id: project._id,
        project_title: project.title,
        completed_at: project.completed_at,
        feedback_rating: feedback_rating,
        feedback_comment: feedback_comment,
        final_payment_amount: final_payment_amount,
        was_submitted_work_approved: wasSubmittedByProvider,
        timestamp: new Date(),
      };

      req.socketService.emitToUser(
        project.selected_provider._id.toString(),
        "projectCompleted",
        notificationData
      );
    }

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in completeProject:", err);
    res.status(500).json({ error: "Server error" });
  }
};
