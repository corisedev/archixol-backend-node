const User = require("../models/User");
const UserProfile = require("../models/UserProfile");
const fs = require("fs");
const path = require("path");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Get user profile data
// @route   GET /profile/get_data
// @access  Private
exports.getProfileData = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user data
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get or create profile data
    let profileData = await UserProfile.findOne({ user_id: userId });

    if (!profileData) {
      profileData = await UserProfile.create({
        user_id: userId,
      });
    }

    // Construct response object
    const responseData = {
      message: "Profile data retrieved successfully",
      user: {
        username: user.username,
        isCompany: user.company || false,
        email: user.email,
        fullname: profileData.fullname || "",
        phone_number: profileData.phone_number || "",
        experience: profileData.experience || 0,
        cnic: profileData.cnic || "",
        address: profileData.address || "",
        service_location: profileData.service_location || "",
        introduction: profileData.introduction || "",
        website: profileData.website || "",
        profile_img: profileData.profile_img || "",
        banner_img: profileData.banner_img || "",
        intro_video: profileData.intro_video || "",
        services_tags: profileData.services_tags || [],
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update user profile
// @route   POST /profile/update_data
// @access  Private
exports.updateProfileData = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("Raw request body:", req.body);
    console.log("Files:", req.files);

    const {
      fullname,
      email,
      address,
      experience,
      introduction,
      cnic,
      phone_number,
      website,
      service_location,
      services_tags,
    } = req.body;

    // Get user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update email if provided and different
    if (email && email !== user.email) {
      // Check if email already exists
      const emailExists = await User.findOne({ email, _id: { $ne: userId } });

      if (emailExists) {
        return res.status(400).json({ error: "Email already in use" });
      }

      user.email = email;
      user.isEmailVerified = false; // Require verification for new email

      // Generate verification token
      const verificationToken = user.getEmailVerificationToken();

      await user.save();

      // TODO: Send verification email (implement this functionality)
    }

    // Find or create profile
    let profile = await UserProfile.findOne({ user_id: userId });

    if (!profile) {
      profile = new UserProfile({ user_id: userId });
    }

    // Update profile fields
    if (fullname !== undefined) profile.fullname = fullname;
    if (address !== undefined) profile.address = address;
    if (experience !== undefined) profile.experience = experience;
    if (introduction !== undefined) profile.introduction = introduction;
    if (cnic !== undefined) profile.cnic = cnic;
    if (phone_number !== undefined) profile.phone_number = phone_number;
    if (website !== undefined) profile.website = website;
    if (service_location !== undefined)
      profile.service_location = service_location;

    // Process services_tags field
    if (services_tags !== undefined) {
      // Handle both array and single string formats
      if (Array.isArray(services_tags)) {
        profile.services_tags = services_tags;
      } else if (typeof services_tags === "string") {
        profile.services_tags = [services_tags];
      } else {
        profile.services_tags = [];
      }
    }

    // Handle file uploads
    // Check if files were uploaded through multer
    if (req.files) {
      // Update profile image if provided
      if (req.files.profile_img && req.files.profile_img[0]) {
        profile.profile_img = `/uploads/profile/images/${req.files.profile_img[0].filename}`;
      }

      // Update banner image if provided
      if (req.files.banner_img && req.files.banner_img[0]) {
        profile.banner_img = `/uploads/profile/banners/${req.files.banner_img[0].filename}`;
      }

      // Update intro video if provided
      if (req.files.intro_video && req.files.intro_video[0]) {
        profile.intro_video = `/uploads/profile/videos/${req.files.intro_video[0].filename}`;
      }
    } else {
      // Handle string paths provided directly in the body
      if (req.body.profile_img) {
        const profileImg = Array.isArray(req.body.profile_img)
          ? req.body.profile_img[0]
          : req.body.profile_img;
        profile.profile_img = profileImg;
      }

      if (req.body.banner_img) {
        const bannerImg = Array.isArray(req.body.banner_img)
          ? req.body.banner_img[0]
          : req.body.banner_img;
        profile.banner_img = bannerImg;
      }

      if (req.body.intro_video) {
        const introVideo = Array.isArray(req.body.intro_video)
          ? req.body.intro_video[0]
          : req.body.intro_video;
        profile.intro_video = introVideo;
      }
    }

    // Save updated profile
    await profile.save();

    // Prepare response
    const responseData = {
      message: "Profile updated successfully",
      profile_data: {
        username: user.username,
        isCompany: user.company || false,
        email: user.email,
        fullname: profile.fullname || "",
        phone_number: profile.phone_number || "",
        experience: profile.experience || 0,
        cnic: profile.cnic || "",
        address: profile.address || "",
        service_location: profile.service_location || "",
        introduction: profile.introduction || "",
        website: profile.website || "",
        profile_img: profile.profile_img || "",
        banner_img: profile.banner_img || "",
        intro_video: profile.intro_video || "",
        services_tags: profile.services_tags || [],
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete intro video
// @route   POST /profile/delete_intro_video
// @access  Private
exports.deleteIntroVideo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { intro_video } = req.body;

    if (!intro_video) {
      return res.status(400).json({ error: "Video path is required" });
    }

    // Find profile
    const profile = await UserProfile.findOne({ user_id: userId });

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Check if profile has this video
    if (profile.intro_video !== intro_video) {
      return res
        .status(400)
        .json({ error: "This video does not belong to your profile" });
    }

    // Delete file from server if it exists
    try {
      const videoPath = path.join(__dirname, "..", intro_video);
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    } catch (fileErr) {
      console.error("Error deleting file:", fileErr);
      // Continue even if file deletion fails
    }

    // Update profile
    profile.intro_video = "";
    await profile.save();

    const responseData = {
      message: "Intro video deleted successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update profile template
// @route   POST /profile/update_template
// @access  Private
exports.updateProfileTemplate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { profile_template } = req.body;

    if (!profile_template) {
      return res.status(400).json({ error: "Profile template is required" });
    }

    // Find user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update the profile template
    user.profile_template = profile_template;
    await user.save();

    const responseData = {
      message: "Profile template updated successfully",
      profile_template,
    };

    // No encryption needed for this endpoint as specified
    res.status(200).json({ data: responseData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
