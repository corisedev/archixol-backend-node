const Company = require("../models/Company");
const User = require("../models/User");
const Service = require("../models/Service");
const { encryptData } = require("../utils/encryptResponse");
const fs = require("fs");
const path = require("path");

// Helper function to get user services
const getUserServices = async (userId) => {
  try {
    const services = await Service.find({ user: userId });
    return services;
  } catch (error) {
    console.error("Error fetching user services:", error);
    return [];
  }
};

// @desc    Get company data
// @route   GET /company/get_data
// @access  Private
exports.getCompanyData = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is a company
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.company) {
      return res
        .status(403)
        .json({ error: "Only company accounts can access company data" });
    }

    // Get or create company data
    let company = await Company.findOne({ user_id: userId });

    if (!company) {
      company = await Company.create({
        user_id: userId,
      });
    }

    // Get user services
    const services = await getUserServices(userId);

    // Add services to response
    const companyData = company.toObject();
    companyData.services = services || [];

    const responseData = {
      message: "Company data retrieved successfully",
      company: companyData,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update company data
// @route   POST /company/update_data
// @access  Private
exports.updateCompanyData = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      business_email,
      address,
      experience,
      description,
      owner_name,
      owner_cnic,
      phone_number,
      service_location,
      services_tags,
      BRN,
      tax_ntn,
    } = req.body;

    // Check if user is a company
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.company) {
      return res
        .status(403)
        .json({ error: "Only company accounts can update company data" });
    }

    // Find or create company
    let company = await Company.findOne({ user_id: userId });

    if (!company) {
      company = new Company({ user_id: userId });
    }

    // Process the uploaded files
    let logoPath, bannerPath, licensePath;

    // Handle logo upload if provided
    if (req.files && req.files.logo && req.files.logo[0]) {
      // Delete previous logo if it exists
      if (company.logo) {
        try {
          const oldLogoPath = path.join(__dirname, "..", company.logo);
          if (fs.existsSync(oldLogoPath)) {
            fs.unlinkSync(oldLogoPath);
          }
        } catch (unlinkErr) {
          console.error("Error deleting old logo:", unlinkErr);
        }
      }

      // Set new logo path
      logoPath = `/uploads/company/logos/${req.files.logo[0].filename}`;
    }

    // Handle banner upload if provided
    if (req.files && req.files.banner && req.files.banner[0]) {
      // Delete previous banner if it exists
      if (company.banner) {
        try {
          const oldBannerPath = path.join(__dirname, "..", company.banner);
          if (fs.existsSync(oldBannerPath)) {
            fs.unlinkSync(oldBannerPath);
          }
        } catch (unlinkErr) {
          console.error("Error deleting old banner:", unlinkErr);
        }
      }

      // Set new banner path
      bannerPath = `/uploads/company/banners/${req.files.banner[0].filename}`;
    }

    // Handle license upload if provided
    if (req.files && req.files.license_img && req.files.license_img[0]) {
      // Delete previous license if it exists
      if (company.license_img) {
        try {
          const oldLicensePath = path.join(
            __dirname,
            "..",
            company.license_img
          );
          if (fs.existsSync(oldLicensePath)) {
            fs.unlinkSync(oldLicensePath);
          }
        } catch (unlinkErr) {
          console.error("Error deleting old license:", unlinkErr);
        }
      }

      // Set new license path
      licensePath = `/uploads/company/licenses/${req.files.license_img[0].filename}`;
    }

    // Update company fields
    if (name !== undefined) company.name = name;
    if (business_email !== undefined) company.business_email = business_email;
    if (address !== undefined) company.address = address;
    if (experience !== undefined) company.experience = experience;
    if (description !== undefined) company.description = description;
    if (owner_name !== undefined) company.owner_name = owner_name;
    if (owner_cnic !== undefined) company.owner_cnic = owner_cnic;
    if (phone_number !== undefined) company.phone_number = phone_number;
    if (service_location !== undefined)
      company.service_location = service_location;
    if (logoPath) company.logo = logoPath;
    if (bannerPath) company.banner = bannerPath;
    if (licensePath) company.license_img = licensePath;

    if (BRN) {
      company.BRN = BRN;
    }
    if (tax_ntn) {
      company.tax_ntn = tax_ntn;
    }

    if (services_tags) {
      company.services_tags = services_tags;
    }

    // Save updated company
    await company.save();

    // Get all company data for response
    const updatedCompany = await Company.findOne({ user_id: userId });

    // Add services to response
    const companyData = updatedCompany.toObject();

    const responseData = {
      message: "Company data updated successfully",
      company: companyData,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);

    // Delete uploaded files if there was an error
    if (req.files) {
      // Handle logo deletion
      if (req.files.logo && req.files.logo[0]) {
        try {
          fs.unlinkSync(
            path.join(
              __dirname,
              "..",
              "uploads",
              "company",
              "logos",
              req.files.logo[0].filename
            )
          );
        } catch (unlinkErr) {
          console.error("Error deleting logo:", unlinkErr);
        }
      }

      // Handle banner deletion
      if (req.files.banner && req.files.banner[0]) {
        try {
          fs.unlinkSync(
            path.join(
              __dirname,
              "..",
              "uploads",
              "company",
              "banners",
              req.files.banner[0].filename
            )
          );
        } catch (unlinkErr) {
          console.error("Error deleting banner:", unlinkErr);
        }
      }

      // Handle license deletion
      if (req.files.license_img && req.files.license_img[0]) {
        try {
          fs.unlinkSync(
            path.join(
              __dirname,
              "..",
              "uploads",
              "company",
              "licenses",
              req.files.license_img[0].filename
            )
          );
        } catch (unlinkErr) {
          console.error("Error deleting license:", unlinkErr);
        }
      }
    }

    res.status(500).json({ error: "Server error" });
  }
};
