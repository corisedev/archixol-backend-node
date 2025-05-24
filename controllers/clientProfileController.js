// controllers/clientProfileController.js
const User = require("../models/User");
const ClientProfile = require("../models/ClientProfile");
const ClientSettings = require("../models/ClientSettings");
const bcrypt = require("bcryptjs");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Get client profile
// @route   GET /client/profile
// @access  Private (Client Only)
exports.getClientProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user basic information
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get client profile if exists
    let clientProfile = await ClientProfile.findOne({ user_id: userId });

    // If no profile exists, create a default one
    if (!clientProfile) {
      clientProfile = new ClientProfile({
        user_id: userId,
        full_name: "",
        phone_number: "",
        company_name: "",
        business_type: "",
        address: "",
        city: "",
        about: "",
        profile_img: "",
      });
      await clientProfile.save();
    }

    // Combine user and profile data
    const profileData = {
      profile_img: clientProfile.profile_img,
      full_name: clientProfile.full_name,
      email: user.email, // Email comes from User model
      phone_number: clientProfile.phone_number,
      company_name: clientProfile.company_name,
      business_type: clientProfile.business_type,
      address: clientProfile.address,
      city: clientProfile.city,
      about: clientProfile.about,
    };

    const responseData = {
      message: "Client profile retrieved successfully",
      ...profileData,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get client profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update client profile
// @route   POST /client/profile
// @access  Private (Client Only)
exports.updateClientProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      profile_img,
      full_name,
      email,
      phone_number,
      company_name,
      business_type,
      address,
      city,
      about,
    } = req.body;

    // Update email in User model if provided
    if (email) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if email is already taken by another user
      const existingUser = await User.findOne({
        email: email,
        _id: { $ne: userId },
      });

      if (existingUser) {
        return res.status(400).json({ error: "Email is already in use" });
      }

      user.email = email;
      await user.save();
    }

    // Find existing profile or create new one
    let clientProfile = await ClientProfile.findOne({ user_id: userId });

    if (!clientProfile) {
      clientProfile = new ClientProfile({ user_id: userId });
    }

    // Update profile fields if provided
    if (profile_img !== undefined) clientProfile.profile_img = profile_img;
    if (full_name !== undefined) clientProfile.full_name = full_name;
    if (phone_number !== undefined) clientProfile.phone_number = phone_number;
    if (company_name !== undefined) clientProfile.company_name = company_name;
    if (business_type !== undefined)
      clientProfile.business_type = business_type;
    if (address !== undefined) clientProfile.address = address;
    if (city !== undefined) clientProfile.city = city;
    if (about !== undefined) clientProfile.about = about;

    // Save the profile
    await clientProfile.save();

    const responseData = {
      message: "Profile updated successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Update client profile error:", err);

    // Check for validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ error: messages.join(", ") });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Change password
// @route   POST /client/change_password
// @access  Private (Client Only)
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password, confirm_password } = req.body;

    // Validate required fields
    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({
        error:
          "Current password, new password, and confirm password are required",
      });
    }

    // Check if new password and confirm password match
    if (new_password !== confirm_password) {
      return res.status(400).json({
        error: "New password and confirm password do not match",
      });
    }

    // Validate new password length
    if (new_password.length < 6) {
      return res.status(400).json({
        error: "New password must be at least 6 characters long",
      });
    }

    // Get user with password
    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check current password
    const isCurrentPasswordMatch = await bcrypt.compare(
      current_password,
      user.password
    );

    if (!isCurrentPasswordMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Check if new password is different from current password
    const isSamePassword = await bcrypt.compare(new_password, user.password);

    if (isSamePassword) {
      return res.status(400).json({
        error: "New password must be different from current password",
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(new_password, saltRounds);

    // Update password
    user.password = hashedNewPassword;
    await user.save();

    // Update last password change in settings
    let clientSettings = await ClientSettings.findOne({ user_id: userId });
    if (!clientSettings) {
      clientSettings = new ClientSettings({ user_id: userId });
    }
    clientSettings.last_password_change = new Date();
    await clientSettings.save();

    const responseData = {
      message: "Password changed successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get additional security settings
// @route   GET /client/additional_settings
// @access  Private (Client Only)
exports.getAdditionalSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get client settings if exists
    let clientSettings = await ClientSettings.findOne({ user_id: userId });

    // If no settings exist, create default ones
    if (!clientSettings) {
      clientSettings = new ClientSettings({
        user_id: userId,
        two_factor: false,
        email_notify_for_logins: false,
        remember_30days: false,
      });
      await clientSettings.save();
    }

    const settingsData = {
      two_factor: clientSettings.two_factor,
      email_notify_for_logins: clientSettings.email_notify_for_logins,
      remember_30days: clientSettings.remember_30days,
    };

    const responseData = {
      message: "Additional security settings retrieved successfully",
      ...settingsData,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get additional settings error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update additional security settings
// @route   POST /client/additional_settings
// @access  Private (Client Only)
exports.updateAdditionalSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { two_factor, email_notify_for_logins, remember_30days } = req.body;

    // Find existing settings or create new ones
    let clientSettings = await ClientSettings.findOne({ user_id: userId });

    if (!clientSettings) {
      clientSettings = new ClientSettings({ user_id: userId });
    }

    // Update settings fields if provided
    if (two_factor !== undefined) {
      clientSettings.two_factor = two_factor;
    }
    if (email_notify_for_logins !== undefined) {
      clientSettings.email_notify_for_logins = email_notify_for_logins;
    }
    if (remember_30days !== undefined) {
      clientSettings.remember_30days = remember_30days;
    }

    // Save the settings
    await clientSettings.save();

    const responseData = {
      message: "Additional security settings updated successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Update additional settings error:", err);

    // Check for validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ error: messages.join(", ") });
    }

    res.status(500).json({ error: "Server error" });
  }
};
