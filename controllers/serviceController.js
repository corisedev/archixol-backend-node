const Service = require("../models/Service");
const Job = require("../models/Job");
const User = require("../models/User");
const UserProfile = require("../models/UserProfile");
const ProjectJob = require("../models/ProjectJob");
const { encryptData } = require("../utils/encryptResponse");

// Helper function to get monthly data for graph
const getMonthlyData = async (userId) => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), 1);

  // Initialize data for the last 12 months
  const graphData = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(lastYear);
    date.setMonth(lastYear.getMonth() + i);

    const monthLabel = date.toISOString().slice(0, 7) + "-01"; // Format as YYYY-MM-01
    graphData.push({
      date: monthLabel,
      jobs: 0,
      requests: 0,
    });
  }

  // Get completed jobs by month
  const completedJobs = await Job.aggregate([
    {
      $match: {
        service_provider: userId,
        status: "completed",
        completed_date: { $gte: lastYear, $lte: today },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$completed_date" },
          month: { $month: "$completed_date" },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  // Get job requests by month
  const jobRequests = await Job.aggregate([
    {
      $match: {
        service_provider: userId,
        createdAt: { $gte: lastYear, $lte: today },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  // Populate graph data
  completedJobs.forEach((job) => {
    const monthIndex = (job._id.month - lastYear.getMonth() - 1 + 12) % 12;
    graphData[monthIndex].jobs = job.count;
  });

  jobRequests.forEach((request) => {
    const monthIndex = (request._id.month - lastYear.getMonth() - 1 + 12) % 12;
    graphData[monthIndex].requests = request.count;
  });

  return graphData;
};

// @desc    Get service provider dashboard data
// @route   GET /service/dashboard
// @access  Private (Service Provider Only)
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(req.user.id);
    // Get job statistics
    const totalJobsCompleted = await Job.countDocuments({
      service_provider: userId,
      status: "completed",
    });

    const totalJobRequested = await Job.countDocuments({
      service_provider: userId,
    });

    const totalPendingJobs = await Job.countDocuments({
      service_provider: userId,
      status: { $in: ["requested", "accepted", "in_progress"] },
    });

    // Calculate total earnings
    const earnings = await Job.aggregate([
      {
        $match: {
          service_provider: userId,
          status: "completed",
          payment_status: "paid",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$price" },
        },
      },
    ]);

    const totalEarnings = earnings.length > 0 ? earnings[0].total : 0;

    // Calculate monthly change ratios
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const currentMonthCompleted = await Job.countDocuments({
      service_provider: userId,
      status: "completed",
      completed_date: { $gte: new Date(new Date().setDate(1)) },
    });

    const lastMonthCompleted = await Job.countDocuments({
      service_provider: userId,
      status: "completed",
      completed_date: {
        $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
        $lt: new Date(new Date().setDate(1)),
      },
    });

    const currentMonthRequested = await Job.countDocuments({
      service_provider: userId,
      createdAt: { $gte: new Date(new Date().setDate(1)) },
    });

    const lastMonthRequested = await Job.countDocuments({
      service_provider: userId,
      createdAt: {
        $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
        $lt: new Date(new Date().setDate(1)),
      },
    });

    // Current month earnings
    const currentMonthEarningsData = await Job.aggregate([
      {
        $match: {
          service_provider: userId,
          status: "completed",
          payment_status: "paid",
          completed_date: { $gte: new Date(new Date().setDate(1)) },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$price" },
        },
      },
    ]);

    // Last month earnings
    const lastMonthEarningsData = await Job.aggregate([
      {
        $match: {
          service_provider: userId,
          status: "completed",
          payment_status: "paid",
          completed_date: {
            $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
            $lt: new Date(new Date().setDate(1)),
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$price" },
        },
      },
    ]);

    const currentMonthEarnings =
      currentMonthEarningsData.length > 0
        ? currentMonthEarningsData[0].total
        : 0;
    const lastMonthEarnings =
      lastMonthEarningsData.length > 0 ? lastMonthEarningsData[0].total : 0;

    // Current month pending
    const currentMonthPending = await Job.countDocuments({
      service_provider: userId,
      status: { $in: ["requested", "accepted", "in_progress"] },
      createdAt: { $gte: new Date(new Date().setDate(1)) },
    });

    // Last month pending
    const lastMonthPending = await Job.countDocuments({
      service_provider: userId,
      status: { $in: ["requested", "accepted", "in_progress"] },
      createdAt: {
        $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
        $lt: new Date(new Date().setDate(1)),
      },
    });

    // Calculate ratios (percentage change)
    const calculateRatio = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const ratioJobCompleted = calculateRatio(
      currentMonthCompleted,
      lastMonthCompleted
    );
    const ratioJobRequested = calculateRatio(
      currentMonthRequested,
      lastMonthRequested
    );
    const ratioEarnings = calculateRatio(
      currentMonthEarnings,
      lastMonthEarnings
    );
    const ratioPendingJobs = calculateRatio(
      currentMonthPending,
      lastMonthPending
    );

    // Get graph data
    const graphData = await getMonthlyData(userId);

    const dashboardData = {
      total_job_completed: totalJobsCompleted,
      total_job_requested: totalJobRequested,
      total_earnings: totalEarnings,
      total_pending_jobs: totalPendingJobs,
      ratio_job_completed: ratioJobCompleted,
      ratio_job_requested: ratioJobRequested,
      ratio_earnings: ratioEarnings,
      ratio_pending_jobs: ratioPendingJobs,
      graph_data: graphData,
    };

    const encryptedData = encryptData(dashboardData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Create a new service
// @route   POST /service/create_service
// @access  Private (Service Provider Only)
exports.createService = async (req, res) => {
  try {
    const {
      service_images, // This comes from the middleware processing
      service_title,
      service_category,
      service_description,
      service_status,
      service_faqs,
      service_process,
      service_feature,
      service_tags,
    } = req.body;

    console.log("Creating service with data:", req.body);

    // Check if user is a service provider
    if (req.user.user_type !== "service_provider") {
      return res
        .status(403)
        .json({ error: "Only service providers can create services" });
    }

    // Validate required fields
    if (!service_title || !service_category || !service_description) {
      return res.status(400).json({
        error: "Service title, category, and description are required",
      });
    }

    // Process service images - ensure it's an array
    const processedImages = Array.isArray(service_images)
      ? service_images
      : service_images
      ? [service_images]
      : [];

    console.log("Processed service images:", processedImages);

    // Create a new service with the processed data
    const service = await Service.create({
      user: req.user.id,
      service_images: processedImages, // Use processed images array
      service_title,
      service_category,
      service_description,
      service_status: service_status !== undefined ? service_status : false,
      service_faqs: service_faqs || [],
      service_process: service_process || [],
      service_feature: service_feature || [],
      service_tags: service_tags || [],
    });

    // Format response with consistent ID
    const serviceResponse = {
      id: service._id,
      service_title: service.service_title,
      service_category: service.service_category,
      service_description: service.service_description,
      service_status: service.service_status,
      service_images: service.service_images,
      service_faqs: service.service_faqs,
      service_process: service.service_process,
      service_feature: service.service_feature,
      service_tags: service.service_tags,
      created_at: service.createdAt,
      updated_at: service.updatedAt,
    };

    const responseData = {
      message: "Service created successfully",
      service: serviceResponse,
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in createService:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get all services for a service provider
// @route   GET /service/get_services
// @access  Private (Service Provider Only)
exports.getServices = async (req, res) => {
  try {
    // Check if user is a service provider
    if (req.user.user_type !== "service_provider") {
      return res
        .status(403)
        .json({ error: "Only service providers can access their services" });
    }

    // Get all services for the logged-in service provider
    const services = await Service.find({ user: req.user.id }).sort({
      createdAt: -1,
    });

    // Convert _id to id in each service
    const servicesWithId = services.map((service) => {
      const serviceObj = service.toObject();
      serviceObj.id = serviceObj._id;
      delete serviceObj._id;
      return serviceObj;
    });

    const responseData = {
      message: "Services retrieved successfully",
      services_list: servicesWithId,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get a specific service
// @route   POST /service/get_service
// @access  Private
exports.getService = async (req, res) => {
  try {
    const { service_id } = req.body;

    if (!service_id) {
      return res.status(400).json({ error: "Service ID is required" });
    }

    // Find the service
    const service = await Service.findById(service_id);

    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    // If user is not a client and not the owner of the service, deny access
    if (
      req.user.user_type !== "client" &&
      service.user.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ error: "Not authorized to access this service" });
    }

    // Convert _id to id
    const serviceWithId = service.toObject();
    serviceWithId.id = serviceWithId._id;
    delete serviceWithId._id;

    const responseData = {
      message: "Service retrieved successfully",
      service: serviceWithId,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update a service
// @route   POST /service/update_service
// @access  Private (Service Provider Only)
exports.updateService = async (req, res) => {
  try {
    console.log("Full request body in updateService:", req.body);

    const {
      service_id,
      service_title,
      service_category,
      service_description,
      service_status,
      service_faqs,
      service_process,
      service_feature,
      service_tags,
      service_images_urls, // Existing images to keep
      service_images, // New uploaded images (processed by middleware)
      new_uploaded_images, // Alternative field name for new uploads
    } = req.body;

    if (!service_id) {
      return res.status(400).json({ error: "Service ID is required" });
    }

    // Find the service
    let service = await Service.findById(service_id);

    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    // Check ownership
    if (service.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this service" });
    }

    // Process existing images to keep
    let existingImages = [];
    if (service_images_urls) {
      existingImages = Array.isArray(service_images_urls)
        ? service_images_urls
        : [service_images_urls];
    }

    console.log("Existing images to keep:", existingImages);

    // Process new uploaded images
    let newImages = [];

    // Check for new images in different possible fields
    if (service_images && Array.isArray(service_images)) {
      newImages = [...service_images];
    } else if (service_images && typeof service_images === "string") {
      newImages = [service_images];
    }

    // Also check alternative field name
    if (new_uploaded_images) {
      const altNewImages = Array.isArray(new_uploaded_images)
        ? new_uploaded_images
        : [new_uploaded_images];
      newImages = [...newImages, ...altNewImages];
    }

    console.log("Newly uploaded images:", newImages);

    // Combine all images and remove duplicates
    const combinedImages = [...new Set([...existingImages, ...newImages])];
    console.log("Combined images for update:", combinedImages);

    // Prepare update data
    const updateData = {
      updatedAt: Date.now(),
    };

    // Only update fields that are provided
    if (service_title !== undefined) updateData.service_title = service_title;
    if (service_category !== undefined)
      updateData.service_category = service_category;
    if (service_description !== undefined)
      updateData.service_description = service_description;
    if (service_status !== undefined)
      updateData.service_status = service_status;
    if (service_faqs !== undefined) updateData.service_faqs = service_faqs;
    if (service_process !== undefined)
      updateData.service_process = service_process;
    if (service_feature !== undefined)
      updateData.service_feature = service_feature;
    if (service_tags !== undefined) updateData.service_tags = service_tags;

    // Always update images (even if empty array to clear images)
    updateData.service_images = combinedImages;

    console.log("Update data:", updateData);

    // Update service
    service = await Service.findByIdAndUpdate(service_id, updateData, {
      new: true,
      runValidators: true,
    });

    // Convert _id to id for consistent frontend usage
    const serviceWithId = service.toObject();
    serviceWithId.id = serviceWithId._id;
    delete serviceWithId._id;

    const responseData = {
      message: "Service updated successfully",
      service: serviceWithId,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in updateService:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete a service
// @route   POST /service/delete_service
// @access  Private (Service Provider Only)
exports.deleteService = async (req, res) => {
  try {
    const { service_id } = req.body;

    if (!service_id) {
      return res.status(400).json({ error: "Service ID is required" });
    }

    // Find the service
    const service = await Service.findById(service_id);

    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    // Check ownership
    if (service.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this service" });
    }

    // Check if there are any active jobs for this service
    const activeJobs = await Job.countDocuments({
      service: service_id,
      status: { $in: ["requested", "accepted", "in_progress"] },
    });

    if (activeJobs > 0) {
      return res.status(400).json({
        error:
          "Cannot delete service with active jobs. Please complete or cancel all jobs first.",
      });
    }

    // Store service data for response before deleting
    const serviceData = service.toObject();

    // Convert _id to id for consistent frontend usage
    serviceData.id = serviceData._id;
    delete serviceData._id;

    // Delete the service using findByIdAndDelete (instead of remove)
    await Service.findByIdAndDelete(service_id);

    const responseData = {
      message: "Service deleted successfully",
      service: serviceData,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get ongoing projects for service provider
// @route   GET /service/ongoing_projects
// @access  Private (Service Provider Only)
exports.getOngoingProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    // Setup pagination
    const skip = (page - 1) * limit;

    // Get ongoing projects where this service provider is selected
    const projects = await ProjectJob.find({
      selected_provider: userId,
      status: "in_progress",
    })
      .populate({
        path: "client_id",
        select: "username email user_type",
      })
      .sort({ started_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalProjects = await ProjectJob.countDocuments({
      selected_provider: userId,
      status: "in_progress",
    });

    // Format projects with additional details
    const formattedProjects = await Promise.all(
      projects.map(async (project) => {
        // Calculate time remaining if timeline is specified
        let timeRemaining = null;
        let isOverdue = false;

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
            isOverdue = timeRemaining < 0;
          }
        }

        // Get client profile
        let clientProfile = null;
        if (project.client_id) {
          clientProfile = await UserProfile.findOne({
            user_id: project.client_id._id,
          })
            .select("profile_img fullname phone_number address")
            .lean();
        }

        // Calculate project duration so far
        const startDate = new Date(project.started_at);
        const now = new Date();
        const durationDays = Math.floor(
          (now - startDate) / (1000 * 60 * 60 * 24)
        );

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
          started_at: project.started_at,
          duration_days: durationDays,
          time_remaining_days: timeRemaining,
          is_overdue: isOverdue,
          client: project.client_id
            ? {
                id: project.client_id._id,
                username: project.client_id.username,
                email: project.client_id.email,
                fullname: clientProfile?.fullname || "",
                profile_img: clientProfile?.profile_img || "",
                phone_number: clientProfile?.phone_number || "",
                address: clientProfile?.address || "",
              }
            : null,
          required_skills: project.required_skills,
          tags: project.tags,
          docs: project.docs,
          note: project.note,
        };
      })
    );

    // Get summary statistics for service provider
    const stats = await ProjectJob.aggregate([
      { $match: { selected_provider: userId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalEarnings: { $sum: "$budget" },
        },
      },
    ]);

    const summary = {
      ongoing_projects: stats.find((s) => s._id === "in_progress")?.count || 0,
      completed_projects: stats.find((s) => s._id === "completed")?.count || 0,
      total_earnings:
        stats.find((s) => s._id === "completed")?.totalEarnings || 0,
      total_projects: stats.reduce((sum, s) => sum + s.count, 0),
    };

    const responseData = {
      message: "Ongoing projects retrieved successfully",
      projects: formattedProjects,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalProjects / limit),
        total_projects: totalProjects,
        per_page: parseInt(limit),
      },
      summary: summary,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in getOngoingProjects:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get all projects by status for service provider
// @route   GET /service/projects_by_status
// @access  Private (Service Provider Only)
exports.getServiceProviderProjectsByStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build query based on status
    let query = { selected_provider: userId };

    if (status) {
      switch (status.toLowerCase()) {
        case "ongoing":
          query.status = "in_progress";
          break;
        case "completed":
          query.status = "completed";
          break;
        case "cancelled":
          query.status = { $in: ["cancelled", "closed"] };
          break;
        default:
          return res.status(400).json({
            error: "Invalid status. Use: ongoing, completed, cancelled",
          });
      }
    }

    // Setup pagination
    const skip = (page - 1) * limit;

    // Get projects with pagination
    const projects = await ProjectJob.find(query)
      .populate({
        path: "client_id",
        select: "username email user_type",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalProjects = await ProjectJob.countDocuments(query);

    // Format projects
    const formattedProjects = await Promise.all(
      projects.map(async (project) => {
        // Get client profile
        let clientProfile = null;
        if (project.client_id) {
          clientProfile = await UserProfile.findOne({
            user_id: project.client_id._id,
          })
            .select("profile_img fullname phone_number")
            .lean();
        }

        // Calculate project metrics
        let duration = null;
        let earnings = 0;

        if (project.completed_at && project.started_at) {
          const startDate = new Date(project.started_at);
          const endDate = new Date(project.completed_at);
          duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        }

        if (project.status === "completed") {
          earnings = project.budget;
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
          started_at: project.started_at,
          completed_at: project.completed_at,
          duration_days: duration,
          earnings: earnings,
          client: project.client_id
            ? {
                id: project.client_id._id,
                username: project.client_id.username,
                email: project.client_id.email,
                fullname: clientProfile?.fullname || "",
                profile_img: clientProfile?.profile_img || "",
              }
            : null,
          payment_status: project.payment_status,
        };
      })
    );

    const responseData = {
      message: "Projects retrieved successfully",
      projects: formattedProjects,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalProjects / limit),
        total_projects: totalProjects,
        per_page: parseInt(limit),
      },
      filter_applied: status || "all",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in getServiceProviderProjectsByStatus:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Mark project as completed from service provider side
// @route   POST /service/complete_project
// @access  Private (Service Provider Only)
exports.completeProjectFromProvider = async (req, res) => {
  try {
    const { project_id, completion_notes = "" } = req.body;
    const userId = req.user.id;

    const project = await ProjectJob.findOne({
      _id: project_id,
      selected_provider: userId,
    }).populate({
      path: "client_id",
      select: "username email user_type",
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or you don't have permission to complete it",
      });
    }

    if (project.status !== "in_progress") {
      return res.status(400).json({
        error: "Can only complete in-progress projects",
      });
    }

    // Instead of marking as completed, mark as "pending_client_approval"
    project.status = "pending_client_approval";
    project.provider_completed_at = new Date(); // New field

    // Add completion notes
    if (completion_notes) {
      const completionEntry = `\n\n[${new Date().toISOString()}] SERVICE PROVIDER COMPLETION:\nNotes: ${completion_notes}`;
      project.note = (project.note || "") + completionEntry;
    }

    await project.save();

    // DON'T update statistics yet - wait for client confirmation

    const responseData = {
      message: "Project submitted for client approval",
      project: {
        id: project._id,
        title: project.title,
        status: project.status, // "pending_client_approval"
        provider_completed_at: project.provider_completed_at,
        completion_notes: completion_notes,
        budget: project.budget,
        next_step: "Waiting for client to review and approve completion",
      },
    };

    // Notify client that work is ready for review
    if (project.client_id && req.socketService) {
      const notificationData = {
        type: "work_submitted_for_approval",
        message: `"${project.title}" has been submitted for your review and approval`,
        project_id: project._id,
        project_title: project.title,
        provider_completed_at: project.provider_completed_at,
        completion_notes: completion_notes,
        provider_username: req.user.username,
        action_required:
          "Please review the work and mark as completed if satisfied",
        timestamp: new Date(),
      };

      req.socketService.emitToUser(
        project.client_id._id.toString(),
        "workSubmittedForApproval",
        notificationData
      );
    }

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in completeProjectFromProvider:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update project progress/status
// @route   POST /service/update_project_progress
// @access  Private (Service Provider Only)
exports.updateProjectProgress = async (req, res) => {
  try {
    const {
      project_id,
      progress_notes,
      estimated_completion_date,
      milestone_completed,
    } = req.body;
    const userId = req.user.id;

    // Get the project and verify it's assigned to this service provider
    const project = await ProjectJob.findOne({
      _id: project_id,
      selected_provider: userId,
    }).populate({
      path: "client_id",
      select: "username email user_type",
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or you don't have permission to update it",
      });
    }

    // Check if project is in progress
    if (project.status !== "in_progress") {
      return res.status(400).json({
        error: "Can only update progress for in-progress projects",
      });
    }

    // Add progress notes
    if (progress_notes) {
      const timestamp = new Date().toISOString();
      const progressUpdate = `\n\n[${timestamp}] Progress Update: ${progress_notes}`;

      if (!project.note) {
        project.note = `Progress Updates:${progressUpdate}`;
      } else {
        project.note += progressUpdate;
      }
    }

    await project.save();

    const responseData = {
      message: "Project progress updated successfully",
      project: {
        id: project._id,
        title: project.title,
        status: project.status,
        progress_notes: progress_notes,
        estimated_completion_date: estimated_completion_date,
        milestone_completed: milestone_completed,
        updated_at: new Date(),
      },
    };

    // Send notification to client about progress update
    if (project.client_id && req.socketService) {
      const notificationData = {
        type: "project_progress_update",
        message: `Progress update for project "${project.title}"`,
        project_id: project._id,
        project_title: project.title,
        progress_notes: progress_notes,
        provider_username: req.user.username,
        timestamp: new Date(),
      };

      req.socketService.emitToUser(
        project.client_id._id.toString(),
        "projectProgressUpdate",
        notificationData
      );
    }

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in updateProjectProgress:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get project details for service provider
// @route   POST /service/get_project_details
// @access  Private (Service Provider Only)
exports.getProjectDetails = async (req, res) => {
  try {
    const { project_id } = req.body;
    const userId = req.user.id;

    if (!project_id) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    // Get the project and verify it's assigned to this service provider
    const project = await ProjectJob.findOne({
      _id: project_id,
      selected_provider: userId,
    })
      .populate({
        path: "client_id",
        select: "username email user_type createdAt",
      })
      .lean();

    if (!project) {
      return res.status(404).json({
        error: "Project not found or you don't have permission to view it",
      });
    }

    // Get client profile details
    let clientProfile = null;
    if (project.client_id) {
      clientProfile = await UserProfile.findOne({
        user_id: project.client_id._id,
      }).lean();
    }

    // Calculate project metrics
    let timeRemaining = null;
    let durationSoFar = null;
    let isOverdue = false;

    if (project.started_at) {
      const startDate = new Date(project.started_at);
      const now = new Date();
      durationSoFar = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

      if (project.timeline) {
        const timelineMatch = project.timeline.match(/(\d+)/);
        if (timelineMatch) {
          const timelineDays = parseInt(timelineMatch[0]);
          const expectedEndDate = new Date(startDate);
          expectedEndDate.setDate(startDate.getDate() + timelineDays);

          const timeDiff = expectedEndDate - now;
          timeRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
          isOverdue = timeRemaining < 0;
        }
      }
    }

    // Calculate completion metrics if completed
    let actualDuration = null;
    if (project.completed_at && project.started_at) {
      const startDate = new Date(project.started_at);
      const endDate = new Date(project.completed_at);
      actualDuration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    }

    const responseData = {
      message: "Project details retrieved successfully",
      project: {
        id: project._id,
        title: project.title,
        category: project.category,
        description: project.description,
        budget: project.budget,
        timeline: project.timeline,
        status: project.status,
        urgent: project.urgent,
        city: project.city,
        address: project.address,
        required_skills: project.required_skills,
        tags: project.tags,
        docs: project.docs,
        note: project.note,
        created_at: project.createdAt,
        started_at: project.started_at,
        completed_at: project.completed_at,
        payment_status: project.payment_status,

        // Time metrics
        duration_so_far_days: durationSoFar,
        time_remaining_days: timeRemaining,
        is_overdue: isOverdue,
        actual_duration_days: actualDuration,

        // Client information
        client: project.client_id
          ? {
              id: project.client_id._id,
              username: project.client_id.username,
              email: project.client_id.email,
              user_type: project.client_id.user_type,
              member_since: project.client_id.createdAt,
              fullname: clientProfile?.fullname || "",
              profile_img: clientProfile?.profile_img || "",
              phone_number: clientProfile?.phone_number || "",
              company_name: clientProfile?.company_name || "",
              business_type: clientProfile?.business_type || "",
              address: clientProfile?.address || "",
              city: clientProfile?.city || "",
              about: clientProfile?.about || "",
            }
          : null,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in getProjectDetails:", err);
    res.status(500).json({ error: "Server error" });
  }
};
