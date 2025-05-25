// controllers/serviceProviderJobController.js
const ProjectJob = require("../models/ProjectJob");
const Job = require("../models/Job");
const Service = require("../models/Service");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Get all available jobs matching service provider's service categories
// @route   GET /service/get_available_jobs
// @access  Private (Service Provider Only)
exports.getAvailableJobs = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      category,
      budget_min,
      budget_max,
      location,
      urgent,
      page = 1,
      limit = 10,
      sort_by = "created_date",
      sort_order = "desc",
    } = req.query;

    // Get all services created by this service provider to determine their categories
    const userServices = await Service.find({ user: userId }).select(
      "service_category"
    );

    if (!userServices || userServices.length === 0) {
      return res.status(400).json({
        error:
          "No services found. Please create services first to see available jobs.",
      });
    }

    // Extract unique service categories
    const serviceCategories = [
      ...new Set(userServices.map((service) => service.service_category)),
    ];

    // Build query for filtering
    let query = {
      type: { $in: serviceCategories }, // Match job type with service categories
      status: "open", // Only open jobs
      selected_provider: null, // Jobs that haven't been assigned yet
    };

    // Apply additional filters
    if (category && serviceCategories.includes(category)) {
      query.type = category;
    }

    if (budget_min || budget_max) {
      query.budget = {};
      if (budget_min) query.budget.$gte = Number(budget_min);
      if (budget_max) query.budget.$lte = Number(budget_max);
    }

    if (location) {
      query.city = { $regex: location, $options: "i" };
    }

    if (urgent !== undefined) {
      query.urgent = urgent === "true";
    }

    // Setup sorting
    let sortOptions = {};
    switch (sort_by) {
      case "budget":
        sortOptions.budget = sort_order === "asc" ? 1 : -1;
        break;
      case "timeline":
        sortOptions.timeline = sort_order === "asc" ? 1 : -1;
        break;
      case "created_date":
      default:
        sortOptions.createdAt = sort_order === "asc" ? 1 : -1;
        break;
    }

    // Setup pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalJobs = await ProjectJob.countDocuments(query);

    // Get jobs with pagination
    const availableJobs = await ProjectJob.find(query)
      .populate("client_id", "username email user_type")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Check which jobs this service provider has already applied to
    const appliedJobIds = await Job.find({
      service_provider: userId,
      project_job: { $in: availableJobs.map((job) => job._id) },
    }).distinct("project_job");

    // ==================== CALCULATE STATISTICS ====================

    // Get all applications by this service provider
    const allApplications = await Job.find({ service_provider: userId });

    // Applied jobs count
    const applied_jobs = allApplications.length;

    // Available jobs count (total matching jobs they haven't applied to)
    const available_jobs = await ProjectJob.countDocuments({
      type: { $in: serviceCategories },
      status: "open",
      selected_provider: null,
      _id: { $nin: allApplications.map((app) => app.project_job) },
    });

    // Success rate calculation (accepted + completed jobs / total applications)
    const successfulApplications = allApplications.filter(
      (app) => app.status === "accepted" || app.status === "completed"
    ).length;
    const success_rate =
      applied_jobs > 0
        ? Math.round((successfulApplications / applied_jobs) * 100)
        : 0;

    // Get saved jobs count (we'll need to create a SavedJob model or add to existing model)
    let saved_jobs = 0;
    try {
      const SavedJob = require("../models/SavedJob");
      saved_jobs = await SavedJob.countDocuments({ service_provider: userId });
    } catch (error) {
      // If SavedJob model doesn't exist, default to 0
      console.log("SavedJob model not found, setting saved_jobs to 0");
      saved_jobs = 0;
    }

    // ==================== END STATISTICS CALCULATION ====================

    // Add application status to each job
    const jobsWithApplicationStatus = availableJobs.map((job) => {
      const jobObj = job.toObject();
      jobObj.id = jobObj._id;
      delete jobObj._id;

      // Add application status
      jobObj.has_applied = appliedJobIds.some(
        (appliedId) => appliedId.toString() === job._id.toString()
      );

      // Add proposal count
      jobObj.proposal_count = job.proposals ? job.proposals.length : 0;

      return jobObj;
    });

    const responseData = {
      message: "Available jobs retrieved successfully",
      jobs: jobsWithApplicationStatus,
      statistics: {
        applied_jobs,
        available_jobs,
        success_rate,
        saved_jobs,
      },
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalJobs / limit),
        total_jobs: totalJobs,
        per_page: parseInt(limit),
      },
      filters: {
        matching_categories: serviceCategories,
        applied_filters: {
          category: category || "all",
          budget_range: {
            min: budget_min || null,
            max: budget_max || null,
          },
          location: location || null,
          urgent_only: urgent === "true",
        },
        sort: {
          by: sort_by,
          order: sort_order,
        },
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in getAvailableJobs:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get details of a specific project job
// @route   POST /service/get_job_details
// @access  Private (Service Provider Only)
exports.getJobDetails = async (req, res) => {
  try {
    const { job_id } = req.body;
    const userId = req.user.id;

    if (!job_id) {
      return res.status(400).json({ error: "Job ID is required" });
    }

    // Get the project job with client details
    const projectJob = await ProjectJob.findById(job_id)
      .populate("client_id", "username email user_type")
      .populate({
        path: "proposals.service_provider_id",
        select: "username email user_type",
      });

    if (!projectJob) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Get all services of the current user
    const userServices = await Service.find({ user: userId }).select(
      "service_title service_category service_description service_status service_images"
    );

    // Check if service provider has already applied
    const existingApplication = await Job.findOne({
      service_provider: userId,
      project_job: job_id,
    });

    const jobObj = projectJob.toObject();
    jobObj.id = jobObj._id;
    delete jobObj._id;

    // Add application status and user's proposal if exists
    jobObj.has_applied = !!existingApplication;
    if (existingApplication) {
      jobObj.application_status = existingApplication.status;
      jobObj.application_id = existingApplication._id;
    }

    // Find user's proposal in the proposals array
    const userProposal = projectJob.proposals.find(
      (proposal) => proposal.service_provider_id._id.toString() === userId
    );

    if (userProposal) {
      jobObj.user_proposal = userProposal;
    }

    // Format user services for response
    const formattedServices = userServices.map((service) => {
      const serviceObj = service.toObject();
      serviceObj.id = serviceObj._id;
      delete serviceObj._id;

      // Check if this service category matches the job type
      serviceObj.matches_job_type =
        service.service_category === projectJob.type;

      return serviceObj;
    });

    // Check if job is saved by this user
    let is_saved = false;
    try {
      const SavedJob = require("../models/SavedJob");
      const savedJob = await SavedJob.findOne({
        service_provider: userId,
        project_job: job_id,
      });
      is_saved = !!savedJob;
    } catch (error) {
      // SavedJob model not found, default to false
      is_saved = false;
    }

    const responseData = {
      message: "Job details retrieved successfully",
      job: jobObj,
      user_services: formattedServices,
      matching_services_count: formattedServices.filter(
        (service) => service.matches_job_type
      ).length,
      is_saved: is_saved,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in getJobDetails:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Apply for a project job
// @route   POST /service/apply_job
// @access  Private (Service Provider Only)
exports.applyForJob = async (req, res) => {
  try {
    const {
      job_id,
      proposal_text,
      proposed_budget,
      proposed_timeline,
      service_id, // Which service they're applying with
    } = req.body;

    const userId = req.user.id;

    // Validate required fields
    if (!job_id || !proposal_text || !proposed_budget || !proposed_timeline) {
      return res.status(400).json({
        error:
          "Job ID, proposal text, proposed budget, and proposed timeline are required",
      });
    }

    // Check if project job exists and is still open
    const projectJob = await ProjectJob.findById(job_id);
    if (!projectJob) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (projectJob.status !== "open") {
      return res
        .status(400)
        .json({ error: "This job is no longer open for applications" });
    }

    if (projectJob.selected_provider) {
      return res
        .status(400)
        .json({ error: "This job has already been assigned to a provider" });
    }

    // Check if service provider has already applied
    const existingApplication = await Job.findOne({
      service_provider: userId,
      project_job: job_id,
    });

    if (existingApplication) {
      return res
        .status(400)
        .json({ error: "You have already applied for this job" });
    }

    // Validate service if provided
    let service = null;
    if (service_id) {
      service = await Service.findOne({ _id: service_id, user: userId });
      if (!service) {
        return res
          .status(400)
          .json({ error: "Service not found or doesn't belong to you" });
      }

      // Check if service category matches job type
      if (service.service_category !== projectJob.type) {
        return res.status(400).json({
          error: "Your service category doesn't match this job type",
        });
      }
    }

    // Validate proposed budget
    if (proposed_budget <= 0) {
      return res
        .status(400)
        .json({ error: "Proposed budget must be greater than 0" });
    }

    // Create proposal in ProjectJob
    const proposal = {
      service_provider_id: userId,
      proposal_text,
      proposed_budget: Number(proposed_budget),
      proposed_timeline,
      status: "pending",
      submitted_at: new Date(),
    };

    projectJob.proposals.push(proposal);
    await projectJob.save();

    // Create job application in Job model
    const jobApplication = await Job.create({
      service: service ? service._id : null,
      service_provider: userId,
      client: projectJob.client_id,
      project_job: projectJob._id,
      status: "requested",
      price: Number(proposed_budget),
      payment_status: "pending",
      requirements: proposal_text,
      delivery_date: null, // Will be set if job is accepted
    });

    // Update service statistics if service is provided
    if (service) {
      service.total_job_requests += 1;
      await service.save();
    }

    const responseData = {
      message: "Job application submitted successfully",
      application: {
        id: jobApplication._id,
        job_id: projectJob._id,
        status: jobApplication.status,
        proposed_budget: Number(proposed_budget),
        proposed_timeline,
        applied_at: jobApplication.createdAt,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in applyForJob:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get all job applications by service provider
// @route   GET /service/get_my_applications
// @access  Private (Service Provider Only)
exports.getMyApplications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build query
    let query = { service_provider: userId };
    if (status) {
      query.status = status;
    }

    // Get applications with pagination
    const skip = (page - 1) * limit;
    const applications = await Job.find(query)
      .populate("client", "username email user_type")
      .populate("service", "service_title service_category")
      .populate("project_job", "title description budget timeline city status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalApplications = await Job.countDocuments(query);

    // Format applications
    const formattedApplications = applications.map((app) => {
      const appObj = app.toObject();
      appObj.id = appObj._id;
      delete appObj._id;

      return appObj;
    });

    const responseData = {
      message: "Applications retrieved successfully",
      applications: formattedApplications,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalApplications / limit),
        total_applications: totalApplications,
        per_page: parseInt(limit),
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in getMyApplications:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update job application (withdraw, update proposal, etc.)
// @route   POST /service/update_application
// @access  Private (Service Provider Only)
exports.updateApplication = async (req, res) => {
  try {
    const {
      application_id,
      action, // "withdraw", "update_proposal"
      proposal_text,
      proposed_budget,
      proposed_timeline,
    } = req.body;

    const userId = req.user.id;

    if (!application_id || !action) {
      return res
        .status(400)
        .json({ error: "Application ID and action are required" });
    }

    // Find the job application
    const jobApplication = await Job.findOne({
      _id: application_id,
      service_provider: userId,
    }).populate("project_job");

    if (!jobApplication) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Check if application can be modified
    if (
      jobApplication.status === "accepted" ||
      jobApplication.status === "completed"
    ) {
      return res.status(400).json({
        error: "Cannot modify an accepted or completed application",
      });
    }

    switch (action) {
      case "withdraw":
        // Update job status to cancelled
        jobApplication.status = "cancelled";
        await jobApplication.save();

        // Remove proposal from ProjectJob
        const projectJob = await ProjectJob.findById(
          jobApplication.project_job._id
        );
        if (projectJob) {
          projectJob.proposals = projectJob.proposals.filter(
            (proposal) => proposal.service_provider_id.toString() !== userId
          );
          await projectJob.save();
        }

        break;

      case "update_proposal":
        if (!proposal_text || !proposed_budget || !proposed_timeline) {
          return res.status(400).json({
            error:
              "Proposal text, budget, and timeline are required for update",
          });
        }

        // Update job application
        jobApplication.requirements = proposal_text;
        jobApplication.price = Number(proposed_budget);
        await jobApplication.save();

        // Update proposal in ProjectJob
        const projectJobForUpdate = await ProjectJob.findById(
          jobApplication.project_job._id
        );
        if (projectJobForUpdate) {
          const proposalIndex = projectJobForUpdate.proposals.findIndex(
            (proposal) => proposal.service_provider_id.toString() === userId
          );

          if (proposalIndex !== -1) {
            projectJobForUpdate.proposals[proposalIndex].proposal_text =
              proposal_text;
            projectJobForUpdate.proposals[proposalIndex].proposed_budget =
              Number(proposed_budget);
            projectJobForUpdate.proposals[proposalIndex].proposed_timeline =
              proposed_timeline;
            await projectJobForUpdate.save();
          }
        }

        break;

      default:
        return res.status(400).json({ error: "Invalid action" });
    }

    const responseData = {
      message: `Application ${action.replace("_", " ")} successful`,
      application: {
        id: jobApplication._id,
        status: jobApplication.status,
        updated_at: new Date(),
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in updateApplication:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ADD THIS TO: controllers/serviceProviderJobController.js

// @desc    Save a job for later
// @route   POST /service/save_job
// @access  Private (Service Provider Only)
exports.saveJob = async (req, res) => {
  try {
    const { job_id } = req.body;
    const userId = req.user.id;

    if (!job_id) {
      return res.status(400).json({ error: "Job ID is required" });
    }

    // Check if project job exists
    const projectJob = await ProjectJob.findById(job_id);
    if (!projectJob) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Check if job is still available
    if (projectJob.status !== "open") {
      return res.status(400).json({ error: "This job is no longer available" });
    }

    // Try to import SavedJob model, create a simple saved jobs tracking
    let SavedJob;
    try {
      SavedJob = require("../models/SavedJob");
    } catch (error) {
      // If SavedJob model doesn't exist, we'll create a simple schema inline
      // In production, you should create a proper SavedJob model
      const mongoose = require("mongoose");

      const SavedJobSchema = new mongoose.Schema({
        service_provider: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        project_job: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ProjectJob",
          required: true,
        },
        saved_at: {
          type: Date,
          default: Date.now,
        },
      });

      // Create compound index to prevent duplicate saves
      SavedJobSchema.index(
        { service_provider: 1, project_job: 1 },
        { unique: true }
      );

      SavedJob = mongoose.model("SavedJob", SavedJobSchema);
    }

    // Check if job is already saved
    const existingSave = await SavedJob.findOne({
      service_provider: userId,
      project_job: job_id,
    });

    if (existingSave) {
      return res.status(400).json({ error: "Job is already saved" });
    }

    // Save the job
    const savedJob = await SavedJob.create({
      service_provider: userId,
      project_job: job_id,
    });

    const responseData = {
      message: "Job saved successfully",
      saved_job: {
        id: savedJob._id,
        job_id: job_id,
        saved_at: savedJob.saved_at,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in saveJob:", err);
    if (err.code === 11000) {
      return res.status(400).json({ error: "Job is already saved" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Remove a saved job
// @route   POST /service/unsave_job
// @access  Private (Service Provider Only)
exports.unsaveJob = async (req, res) => {
  try {
    const { job_id } = req.body;
    const userId = req.user.id;

    if (!job_id) {
      return res.status(400).json({ error: "Job ID is required" });
    }

    // Try to import SavedJob model
    let SavedJob;
    try {
      SavedJob = require("../models/SavedJob");
    } catch (error) {
      return res
        .status(400)
        .json({ error: "Saved jobs feature not available" });
    }

    // Find and remove the saved job
    const savedJob = await SavedJob.findOneAndDelete({
      service_provider: userId,
      project_job: job_id,
    });

    if (!savedJob) {
      return res.status(404).json({ error: "Saved job not found" });
    }

    const responseData = {
      message: "Job removed from saved list successfully",
      removed_job: {
        id: savedJob._id,
        job_id: job_id,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in unsaveJob:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get all saved jobs
// @route   GET /service/get_saved_jobs
// @access  Private (Service Provider Only)
exports.getSavedJobs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    // Try to import SavedJob model
    let SavedJob;
    try {
      SavedJob = require("../models/SavedJob");
    } catch (error) {
      return res.status(200).json({
        data: encryptData({
          message: "No saved jobs found",
          saved_jobs: [],
          pagination: {
            current_page: 1,
            total_pages: 0,
            total_saved_jobs: 0,
            per_page: parseInt(limit),
          },
        }),
      });
    }

    // Setup pagination
    const skip = (page - 1) * limit;

    // Get saved jobs with project job details
    const savedJobs = await SavedJob.find({ service_provider: userId })
      .populate({
        path: "project_job",
        populate: {
          path: "client_id",
          select: "username email user_type",
        },
      })
      .sort({ saved_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalSavedJobs = await SavedJob.countDocuments({
      service_provider: userId,
    });

    // Check which saved jobs the user has applied to
    const projectJobIds = savedJobs.map((savedJob) => savedJob.project_job._id);
    const appliedJobIds = await Job.find({
      service_provider: userId,
      project_job: { $in: projectJobIds },
    }).distinct("project_job");

    // Format saved jobs
    const formattedSavedJobs = savedJobs
      .map((savedJob) => {
        if (!savedJob.project_job) {
          return null; // Skip if project job was deleted
        }

        const savedJobObj = savedJob.toObject();
        const projectJobObj = savedJobObj.project_job;

        // Format project job
        projectJobObj.id = projectJobObj._id;
        delete projectJobObj._id;

        // Add application status
        projectJobObj.has_applied = appliedJobIds.some(
          (appliedId) => appliedId.toString() === projectJobObj.id.toString()
        );

        // Add proposal count
        projectJobObj.proposal_count = projectJobObj.proposals
          ? projectJobObj.proposals.length
          : 0;

        return {
          id: savedJobObj._id,
          saved_at: savedJobObj.saved_at,
          job: projectJobObj,
        };
      })
      .filter((job) => job !== null); // Remove null entries

    const responseData = {
      message: "Saved jobs retrieved successfully",
      saved_jobs: formattedSavedJobs,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalSavedJobs / limit),
        total_saved_jobs: totalSavedJobs,
        per_page: parseInt(limit),
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in getSavedJobs:", err);
    res.status(500).json({ error: "Server error" });
  }
};
