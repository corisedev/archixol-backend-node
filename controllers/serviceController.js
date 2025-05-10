const Service = require("../models/Service");
const Job = require("../models/Job");
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
      service_images,
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

    // Create a new service with the image paths from the middleware
    const service = await Service.create({
      user: req.user.id,
      service_images, // This will contain the file paths processed by the middleware
      service_title,
      service_category,
      service_description,
      service_status,
      service_faqs,
      service_process,
      service_feature,
      service_tags,
    });

    const responseData = {
      message: "Service created successfully",
      service,
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
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
      service_images_urls, // These are kept URLs from existing images
      new_uploaded_images, // These are newly uploaded images
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

    // Process service_images_urls (existing images to keep)
    const existingImages = Array.isArray(service_images_urls)
      ? service_images_urls
      : service_images_urls
      ? [service_images_urls]
      : [];

    console.log("Existing images to keep:", existingImages);

    // Process new uploaded images
    const newImages = Array.isArray(new_uploaded_images)
      ? new_uploaded_images
      : new_uploaded_images
      ? [new_uploaded_images]
      : [];

    console.log("Newly uploaded images:", newImages);

    // Combine all images
    const combinedImages = [...existingImages, ...newImages];
    console.log("Combined images for update:", combinedImages);

    // Handle case when no images are provided but service had images before
    // If combinedImages is empty but you don't want to remove all images,
    // don't include service_images in the update
    const updateData = {
      service_title,
      service_category,
      service_description,
      service_status,
      service_faqs,
      service_process,
      service_feature,
      service_tags,
      service_images: combinedImages,
      updatedAt: Date.now(),
    };

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
    console.error(err);
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
