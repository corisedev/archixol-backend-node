// controllers/publicProfileController.js
const User = require("../models/User");
const UserProfile = require("../models/UserProfile");
const Project = require("../models/Project");
const Certificate = require("../models/Certificate");
const Service = require("../models/Service");
const Company = require("../models/Company");
const Job = require("../models/Job");
const CompanyDocument = require("../models/CompanyDocument");

// @desc    Get user's public profile data
// @route   GET /public/user/:username
// @access  Public
exports.getPublicProfile = async (req, res) => {
  try {
    const { username } = req.params;

    // Find user by username
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prepare response data object
    const responseData = {};

    // 1. Get user profile data
    const profile = await UserProfile.findOne({ user_id: user._id });

    if (profile) {
      // Prepare user profile data
      responseData.user_profile_data = {
        username: user.username,
        isCompany: user.company || false,
        fullname: profile.fullname || "",
        experience: profile.experience || 0,
        service_location: profile.service_location || "",
        introduction: profile.introduction || "",
        website: profile.website || "",
        profile_img: profile.profile_img || "",
        banner_img: profile.banner_img || "",
        intro_video: profile.intro_video || "",
        services_tags: profile.services_tags || [],
        profile_template: user.profile_template || "DefaultTemplate", // Get from user model now
      };
    } else {
      // Create minimal profile if none exists
      responseData.user_profile_data = {
        username: user.username,
        isCompany: user.company || false,
        profile_template: user.profile_template || "DefaultTemplate",
      };
    }

    // 2. Get user's projects
    const projects = await Project.find({ user_id: user._id });

    // Format projects for response
    if (projects && projects.length > 0) {
      responseData.projects = projects.map((project) => {
        const projectObj = project.toObject();
        projectObj.id = projectObj._id.toString();
        delete projectObj._id;
        return projectObj;
      });
    } else {
      responseData.projects = [];
    }

    // 3. Get user's certificates
    const certificates = await Certificate.find({ user_id: user._id });

    // Format certificates for response
    if (certificates && certificates.length > 0) {
      responseData.certificates = certificates.map((cert) => {
        const certObj = cert.toObject();
        certObj.id = certObj._id.toString();
        delete certObj._id;
        return certObj;
      });
    } else {
      responseData.certificates = [];
    }

    // 4. Get user's services (regardless of whether they're a company)
    const services = await Service.find({
      user: user._id,
      service_status: true,
    });

    if (services && services.length > 0) {
      responseData.services = services.map((service) => {
        const serviceObj = service.toObject();
        serviceObj.id = serviceObj._id.toString();
        delete serviceObj._id;
        return serviceObj;
      });
    } else {
      responseData.services = [];
    }

    // 5. Get user's jobs
    const jobs = await Job.find({
      user_id: user._id,
      status: { $ne: "deleted" },
    });

    if (jobs && jobs.length > 0) {
      responseData.jobs = jobs.map((job) => {
        const jobObj = job.toObject();
        jobObj.id = jobObj._id.toString();
        delete jobObj._id;
        return jobObj;
      });
    } else {
      responseData.jobs = [];
    }

    // 6. Get company profile and documents if user is a company
    if (user.company) {
      const company = await Company.findOne({ user_id: user._id });

      if (company) {
        const companyObj = company.toObject();
        companyObj.id = companyObj._id.toString();
        delete companyObj._id;

        responseData.company_profile = companyObj;

        // Get company documents (only public ones)
        const companyDocuments = await CompanyDocument.find({
          company_id: user._id,
          is_public: true, // Only include documents marked as public
        });

        if (companyDocuments && companyDocuments.length > 0) {
          responseData.company_documents = companyDocuments.map((doc) => {
            const docObj = doc.toObject();
            docObj.id = docObj._id.toString();
            delete docObj._id;
            return docObj;
          });
        } else {
          responseData.company_documents = [];
        }
      }
    }

    res.status(200).json({ data: responseData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get user's public projects
// @route   GET /public/projects/:username
// @access  Public
exports.getPublicProjects = async (req, res) => {
  try {
    const { username } = req.params;

    // Find user by username
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's projects
    const projects = await Project.find({ user_id: user._id });

    // Format projects for response
    const formattedProjects = projects.map((project) => {
      const projectObj = project.toObject();
      projectObj.id = projectObj._id.toString();
      delete projectObj._id;
      return projectObj;
    });

    res.status(200).json({ projects: formattedProjects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get user's public certificates
// @route   GET /public/certificates/:username
// @access  Public
exports.getPublicCertificates = async (req, res) => {
  try {
    const { username } = req.params;

    // Find user by username
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's certificates
    const certificates = await Certificate.find({ user_id: user._id });

    // Format certificates for response
    const formattedCertificates = certificates.map((cert) => {
      const certObj = cert.toObject();
      certObj.id = certObj._id.toString();
      delete certObj._id;
      return certObj;
    });

    res.status(200).json({ certificates: formattedCertificates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get user's public services
// @route   GET /public/services/:username
// @access  Public
exports.getPublicServices = async (req, res) => {
  try {
    const { username } = req.params;

    // Find user by username
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's services
    const services = await Service.find({
      user: user._id,
      service_status: "active",
    });

    // Format services for response
    const formattedServices = services.map((service) => {
      const serviceObj = service.toObject();
      serviceObj.id = serviceObj._id.toString();
      delete serviceObj._id;
      return serviceObj;
    });

    res.status(200).json({ services: formattedServices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get company's public profile
// @route   GET /public/company/:username
// @access  Public
exports.getPublicCompany = async (req, res) => {
  try {
    const { username } = req.params;

    // Find user by username
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user is a company
    if (!user.company) {
      return res.status(400).json({ error: "User is not a company" });
    }

    // Get company data
    const company = await Company.findOne({ user_id: user._id });

    if (!company) {
      return res.status(404).json({ error: "Company profile not found" });
    }

    // Prepare public company data
    const companyObj = company.toObject();
    companyObj.id = companyObj._id.toString();
    delete companyObj._id;

    res.status(200).json({ company: companyObj });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
