// controllers/serviceProviderJobController.js
const ProjectJob = require("../models/ProjectJob");
const Job = require("../models/Job");
const Service = require("../models/Service");
const SavedJob = require("../models/SavedJob");
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

    console.log(`Getting available jobs for user: ${userId}`);

    // Get all services created by this service provider to determine their categories
    const userServices = await Service.find({ user: userId }).select(
      "service_category"
    );

    console.log(
      `Found ${userServices.length} services for user:`,
      userServices.map((s) => s.service_category)
    );

    if (!userServices || userServices.length === 0) {
      const responseData = {
        message:
          "No services found. Please create services first to see available jobs.",
        jobs: [],
        statistics: {
          applied_jobs: 0,
          available_jobs: 0,
          success_rate: 0,
          saved_jobs: 0,
        },
        pagination: {
          current_page: 0,
          total_pages: 0,
          total_jobs: 0,
          per_page: 0,
        },
        filters: {
          matching_categories: [],
          applied_filters: {
            category: "all",
            budget_range: {
              min: null,
              max: null,
            },
            location: null,
            urgent_only: false,
          },
          sort: {
            by: null,
            order: null,
          },
        },
      };

      const encryptedData = encryptData(responseData);
      return res.status(200).json({ data: encryptedData });
    }

    // Extract unique service categories and normalize to lowercase
    const serviceCategories = [
      ...new Set(
        userServices.map((service) =>
          service.service_category.toLowerCase().trim()
        )
      ),
    ];

    console.log(`Normalized service categories:`, serviceCategories);

    // Build query for filtering with proper category matching
    let query = {
      category: { $in: serviceCategories }, // Match job category with service categories
      status: "open", // Only open jobs
      selected_provider: null, // Jobs that haven't been assigned yet
    };

    // Apply additional filters
    if (category && serviceCategories.includes(category.toLowerCase().trim())) {
      query.category = category.toLowerCase().trim();
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

    console.log("Final query:", JSON.stringify(query, null, 2));

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
    console.log(`Total jobs matching query: ${totalJobs}`);

    // Get jobs with pagination
    const availableJobs = await ProjectJob.find(query)
      .populate("client_id", "username email user_type")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    console.log(`Retrieved ${availableJobs.length} jobs for display`);

    // Get applications for this user to check which jobs they've applied to
    const userApplications = await Job.find({ service_provider: userId });
    const appliedJobIds = userApplications
      .map((app) => app.project_job?.toString())
      .filter(Boolean);

    console.log(`User has applied to ${appliedJobIds.length} jobs`);

    // ==================== CALCULATE STATISTICS ====================

    // Applied jobs count
    const applied_jobs = userApplications.length;

    // Available jobs count (all matching category jobs they haven't applied to)
    const available_jobs_query = {
      category: { $in: serviceCategories },
      status: "open",
      selected_provider: null,
      _id: {
        $nin: userApplications.map((app) => app.project_job).filter(Boolean),
      },
    };

    const available_jobs = await ProjectJob.countDocuments(
      available_jobs_query
    );

    // Success rate calculation (accepted + completed jobs / total applications)
    const successfulApplications = userApplications.filter(
      (app) => app.status === "accepted" || app.status === "completed"
    ).length;
    const success_rate =
      applied_jobs > 0
        ? Math.round((successfulApplications / applied_jobs) * 100)
        : 0;

    // Get saved jobs count
    let saved_jobs = 0;
    try {
      saved_jobs = await SavedJob.countDocuments({ service_provider: userId });
    } catch (error) {
      console.log("SavedJob model not found, setting saved_jobs to 0");
      saved_jobs = 0;
    }

    // ==================== END STATISTICS CALCULATION ====================

    // Get saved job IDs
    let savedJobIds = [];
    try {
      const savedJobs = await SavedJob.find({
        service_provider: userId,
        project_job: { $ne: null, $exists: true },
      }).distinct("project_job");

      savedJobIds = savedJobs
        .filter((id) => id != null)
        .map((id) => id.toString());
    } catch (error) {
      console.log("Error getting saved jobs:", error.message);
    }

    // Add application status to each job
    const jobsWithApplicationStatus = availableJobs.map((job) => {
      const jobObj = job.toObject();
      jobObj.id = jobObj._id;
      delete jobObj._id;

      // Check application status by looking at proposals in ProjectJob
      // Look for user ID in the proposals array of this job
      const userProposal =
        job.proposals &&
        job.proposals.find(
          (proposal) =>
            proposal.service_provider_id &&
            proposal.service_provider_id.toString() === userId
        );
      jobObj.has_applied = !!userProposal;

      // Add saved status
      jobObj.is_saved = job._id
        ? savedJobIds.includes(job._id.toString())
        : false;

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

    // Check if service provider has already applied using Job model
    const existingApplication = await Job.findOne({
      service_provider: userId,
      project_job: job_id,
    });

    const jobObj = projectJob.toObject();
    jobObj.id = jobObj._id;
    delete jobObj._id;

    // Add application status
    jobObj.has_applied = !!existingApplication;
    if (existingApplication) {
      jobObj.application_status = existingApplication.status;
      jobObj.application_id = existingApplication._id;
    }

    // Find user's proposal in the proposals array
    const userProposal = projectJob.proposals.find(
      (proposal) =>
        proposal.service_provider_id &&
        proposal.service_provider_id._id &&
        proposal.service_provider_id._id.toString() === userId
    );

    if (userProposal) {
      jobObj.user_proposal = userProposal;
    }

    // Format user services for response
    const formattedServices = userServices.map((service) => {
      const serviceObj = service.toObject();
      serviceObj.id = serviceObj._id;
      delete serviceObj._id;

      // Check if this service category matches the job category (case-insensitive)
      serviceObj.matches_job_type =
        service.service_category.toLowerCase().trim() ===
        projectJob.category?.toLowerCase().trim();

      return serviceObj;
    });

    // Check if job is saved by this user
    let is_saved = false;
    try {
      const savedJob = await SavedJob.findOne({
        service_provider: userId,
        project_job: job_id,
      });
      is_saved = !!savedJob;
    } catch (error) {
      console.log("Error checking saved status:", error.message);
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

    console.log(`Service provider ${userId} applying for job ${job_id}`);

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

    // Check if service provider has already applied using Job model
    const existingApplication = await Job.findOne({
      service_provider: userId,
      project_job: job_id,
    });

    if (existingApplication) {
      return res
        .status(400)
        .json({ error: "You have already applied for this job" });
    }

    // ALSO check if user already has a proposal in the ProjectJob
    const existingProposal = projectJob.proposals.find(
      (proposal) => proposal.service_provider_id.toString() === userId
    );

    if (existingProposal) {
      return res
        .status(400)
        .json({ error: "You have already submitted a proposal for this job" });
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

      // Check if service category matches job category (case-insensitive)
      const serviceCategory = service.service_category.toLowerCase().trim();
      const jobCategory = projectJob.category?.toLowerCase().trim();

      if (jobCategory && serviceCategory !== jobCategory) {
        console.log(
          `Category mismatch: Service(${serviceCategory}) vs Job(${jobCategory})`
        );
        return res.status(400).json({
          error: `Your service category (${serviceCategory}) doesn't match this job category (${jobCategory})`,
        });
      }
    }

    // Validate proposed budget
    if (proposed_budget <= 0) {
      return res
        .status(400)
        .json({ error: "Proposed budget must be greater than 0" });
    }

    console.log("Creating proposal and job application...");

    // STEP 1: Create proposal in ProjectJob
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

    console.log(`Added proposal to ProjectJob ${job_id}`);

    // STEP 2: Create job application in Job model with project_job reference
    const jobApplication = await Job.create({
      service: service ? service._id : null,
      service_provider: userId,
      client: projectJob.client_id,
      project_job: projectJob._id, // CRITICAL: Set the project_job reference
      status: "requested", // Initial status
      price: Number(proposed_budget),
      payment_status: "pending",
      requirements: proposal_text,
      delivery_date: null, // Will be set if job is accepted
    });

    console.log(`Created Job application record: ${jobApplication._id}`);

    // STEP 3: Update service statistics if service is provided
    if (service) {
      service.total_job_requests += 1;
      await service.save();
      console.log(`Updated service ${service._id} statistics`);
    }

    // STEP 4: Verify the application was created correctly
    const verifyApplication = await Job.findById(jobApplication._id)
      .populate("project_job")
      .populate("client", "username")
      .populate("service", "service_title");

    console.log("Application verification:", {
      applicationId: verifyApplication._id,
      projectJobLinked: !!verifyApplication.project_job,
      clientLinked: !!verifyApplication.client,
      serviceLinked: !!verifyApplication.service,
      projectJobTitle: verifyApplication.project_job?.title,
    });

    const responseData = {
      message: "Job application submitted successfully",
      application: {
        id: jobApplication._id,
        job_id: projectJob._id,
        job_title: projectJob.title,
        status: jobApplication.status,
        proposed_budget: Number(proposed_budget),
        proposed_timeline,
        applied_at: jobApplication.createdAt,
        client_name: verifyApplication.client?.username,
        service_title: verifyApplication.service?.service_title,
      },
      debug_info: {
        project_job_linked: !!verifyApplication.project_job,
        proposal_count: projectJob.proposals.length,
      },
    };

    console.log(`Job application completed successfully for user ${userId}`);

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error("Error in applyForJob:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
};

// @desc    Get all job applications by service provider
// @route   GET /service/get_my_applications
// @access  Private (Service Provider Only)
exports.getMyApplications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    console.log(`Getting applications for service provider: ${userId}`);

    // FIRST METHOD: Get applications from Job model with project_job populated
    let query = { service_provider: userId };

    // Add status filter if provided
    if (status && status !== "all") {
      query.status = status;
    }

    console.log("Query for Job model:", query);

    // Get applications with populated fields - THIS IS THE KEY FIX
    const applications = await Job.find(query)
      .populate("client", "username email user_type")
      .populate("service", "service_title service_category")
      .populate("project_job") // POPULATE the project job reference
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    console.log(`Found ${applications.length} applications from Job model`);

    const totalApplications = await Job.countDocuments(query);

    // SECOND METHOD: Get applications from ProjectJob proposals (as backup/verification)
    const projectJobsWithUserProposals = await ProjectJob.find({
      "proposals.service_provider_id": userId,
    })
      .populate("client_id", "username email user_type")
      .select(
        "title description budget timeline city status proposals createdAt"
      )
      .lean();

    console.log(
      `Found ${projectJobsWithUserProposals.length} project jobs with user proposals`
    );

    // Create a map of project jobs for reference
    const projectJobMap = {};
    projectJobsWithUserProposals.forEach((pj) => {
      const userProposal = pj.proposals.find(
        (p) => p.service_provider_id.toString() === userId
      );
      if (userProposal) {
        projectJobMap[pj._id.toString()] = {
          ...pj,
          user_proposal: userProposal,
        };
      }
    });

    // Format applications with proper project job details
    const formattedApplications = applications.map((app) => {
      const appObj = app.toObject();
      appObj.id = appObj._id;
      delete appObj._id;

      // If project_job is populated from Job model, use it
      if (app.project_job && typeof app.project_job === "object") {
        console.log(`Using populated project_job for application ${app._id}`);

        appObj.project_job = {
          id: app.project_job._id,
          title: app.project_job.title || "Project Title",
          description:
            app.project_job.description || "No description available",
          budget: app.project_job.budget || app.price,
          timeline: app.project_job.timeline || "Not specified",
          city: app.project_job.city || "Not specified",
          status: app.project_job.status || "unknown",
          category: app.project_job.category || "general",
          urgent: app.project_job.urgent || false,
          created_at: app.project_job.createdAt,
        };

        // Get proposal status from the ProjectJob proposals array
        if (
          app.project_job.proposals &&
          Array.isArray(app.project_job.proposals)
        ) {
          const userProposal = app.project_job.proposals.find(
            (p) =>
              p.service_provider_id &&
              p.service_provider_id.toString() === userId
          );
          if (userProposal) {
            appObj.project_job.proposal_status = userProposal.status;
            appObj.project_job.proposed_budget = userProposal.proposed_budget;
            appObj.project_job.proposed_timeline =
              userProposal.proposed_timeline;
            appObj.project_job.proposal_submitted_at =
              userProposal.submitted_at;
          }
        }
      }
      // Fallback: Try to match with project jobs from our map
      else if (app.project_job) {
        const projectJobId = app.project_job.toString();
        const matchingProjectJob = projectJobMap[projectJobId];

        if (matchingProjectJob) {
          console.log(
            `Using fallback project_job data for application ${app._id}`
          );

          appObj.project_job = {
            id: matchingProjectJob._id,
            title: matchingProjectJob.title,
            description: matchingProjectJob.description,
            budget: matchingProjectJob.budget,
            timeline: matchingProjectJob.timeline,
            city: matchingProjectJob.city,
            status: matchingProjectJob.status,
            category: matchingProjectJob.category,
            urgent: matchingProjectJob.urgent,
            created_at: matchingProjectJob.createdAt,
            proposal_status:
              matchingProjectJob.user_proposal?.status || "pending",
            proposed_budget: matchingProjectJob.user_proposal?.proposed_budget,
            proposed_timeline:
              matchingProjectJob.user_proposal?.proposed_timeline,
            proposal_submitted_at:
              matchingProjectJob.user_proposal?.submitted_at,
          };
        } else {
          console.log(`No project job data found for application ${app._id}`);
          // Create minimal project job object
          appObj.project_job = {
            id: app.project_job,
            title: "Project Details Not Available",
            description: app.requirements || "No description available",
            budget: app.price,
            timeline: "Not specified",
            city: "Not specified",
            status: "unknown",
            category: "general",
            urgent: false,
            proposal_status: "unknown",
          };
        }
      } else {
        // No project_job reference at all
        console.log(`No project_job reference for application ${app._id}`);
        appObj.project_job = {
          title: "Legacy Application",
          description: app.requirements || "No description available",
          budget: app.price,
          timeline: "Not specified",
          city: "Not specified",
          status: "unknown",
          category: "general",
          urgent: false,
          proposal_status: "unknown",
        };
      }

      // Add application timeline information
      appObj.application_timeline = {
        applied_at: app.createdAt,
        updated_at: app.updatedAt,
        delivery_date: app.delivery_date,
        completed_date: app.completed_date,
      };

      // Add client information
      if (app.client) {
        appObj.client_info = {
          id: app.client._id,
          username: app.client.username,
          email: app.client.email,
          user_type: app.client.user_type,
        };
      }

      // Add service information
      if (app.service) {
        appObj.service_info = {
          id: app.service._id,
          title: app.service.service_title,
          category: app.service.service_category,
        };
      }

      return appObj;
    });

    // Calculate comprehensive statistics
    const allUserApplications = await Job.find({ service_provider: userId });

    const stats = {
      total_applications: totalApplications,
      // Status breakdown
      pending: allUserApplications.filter((app) => app.status === "requested")
        .length,
      accepted: allUserApplications.filter((app) => app.status === "accepted")
        .length,
      in_progress: allUserApplications.filter(
        (app) => app.status === "in_progress"
      ).length,
      completed: allUserApplications.filter((app) => app.status === "completed")
        .length,
      rejected: allUserApplications.filter((app) => app.status === "rejected")
        .length,
      cancelled: allUserApplications.filter((app) => app.status === "cancelled")
        .length,

      // Additional stats
      success_rate:
        allUserApplications.length > 0
          ? Math.round(
              (allUserApplications.filter((app) =>
                ["accepted", "completed"].includes(app.status)
              ).length /
                allUserApplications.length) *
                100
            )
          : 0,

      total_earnings: allUserApplications
        .filter(
          (app) => app.status === "completed" && app.payment_status === "paid"
        )
        .reduce((sum, app) => sum + (app.price || 0), 0),

      average_project_value:
        allUserApplications.length > 0
          ? Math.round(
              allUserApplications.reduce(
                (sum, app) => sum + (app.price || 0),
                0
              ) / allUserApplications.length
            )
          : 0,
    };

    console.log("Application statistics:", stats);

    const responseData = {
      message: "Applications retrieved successfully",
      applications: formattedApplications,
      statistics: stats,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalApplications / limit),
        total_applications: totalApplications,
        per_page: parseInt(limit),
      },
      debug_info: {
        query_used: query,
        job_model_count: applications.length,
        project_job_model_count: projectJobsWithUserProposals.length,
        user_id: userId,
      },
    };

    console.log(
      `Returning ${formattedApplications.length} formatted applications`
    );

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

    // Find the job application WITHOUT populate first to check if it exists
    const jobApplication = await Job.findOne({
      _id: application_id,
      service_provider: userId,
    });

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

        // Remove proposal from ProjectJob if project_job exists
        if (jobApplication.project_job) {
          try {
            const projectJob = await ProjectJob.findById(
              jobApplication.project_job
            );
            if (projectJob) {
              projectJob.proposals = projectJob.proposals.filter(
                (proposal) => proposal.service_provider_id.toString() !== userId
              );
              await projectJob.save();
            }
          } catch (projectError) {
            console.error("Error updating ProjectJob proposals:", projectError);
            // Continue execution even if ProjectJob update fails
          }
        }

        break;

      case "update_proposal":
        if (!proposal_text || !proposed_budget || !proposed_timeline) {
          return res.status(400).json({
            error:
              "Proposal text, budget, and timeline are required for update",
          });
        }

        // Validate proposed budget
        if (Number(proposed_budget) <= 0) {
          return res.status(400).json({
            error: "Proposed budget must be greater than 0",
          });
        }

        // Update job application
        jobApplication.requirements = proposal_text;
        jobApplication.price = Number(proposed_budget);
        await jobApplication.save();

        // Update proposal in ProjectJob if project_job exists
        if (jobApplication.project_job) {
          try {
            const projectJobForUpdate = await ProjectJob.findById(
              jobApplication.project_job
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
          } catch (projectError) {
            console.error("Error updating ProjectJob proposals:", projectError);
            // Continue execution even if ProjectJob update fails
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
    const projectJobIds = savedJobs
      .map((savedJob) => savedJob.project_job?._id)
      .filter(Boolean);

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
