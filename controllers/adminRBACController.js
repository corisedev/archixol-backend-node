// controllers/adminRBACController.js
const User = require("../models/User");
const AdminRole = require("../models/AdminRole");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Create new admin user
// @route   POST /admin/create_admin
// @access  Private (Super Admin Only)
exports.createAdmin = async (req, res) => {
  try {
    const {
      full_name,
      username,
      email,
      password,
      is_active = false,
      role,
      permissions = [],
    } = req.body;

    // Check if current user is super admin
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({
        error: "Access denied. Super admin privileges required.",
      });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({ error: "Email already exists" });
    }

    // Create new admin user
    const newAdmin = new User({
      username,
      email,
      password,
      user_type: "admin",
      agree_terms: true,
      isEmailVerified: true, // Auto-verify admin emails
      isAdmin: true,
      isSuperAdmin: false, // Only super admin can create super admins separately
      adminRole: role,
      adminPermissions:
        permissions.length > 0 ? permissions : adminRole.default_permissions,
      firstLogin: false,
      accessRoles: ["admin"],
    });

    // Save the new admin
    await newAdmin.save();

    // Create admin profile data
    const UserProfile = require("../models/UserProfile");
    const adminProfile = new UserProfile({
      user_id: newAdmin._id,
      fullname: full_name,
    });
    await adminProfile.save();

    // Prepare response data (exclude sensitive information)
    const adminData = {
      id: newAdmin._id,
      full_name,
      username: newAdmin.username,
      email: newAdmin.email,
      is_active,
      role: newAdmin.adminRole,
      permissions: newAdmin.adminPermissions,
      created_at: newAdmin.createdAt,
      is_super_admin: newAdmin.isSuperAdmin,
    };

    const responseData = {
      message: "Admin created successfully",
      admin: adminData,
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({ error: "Server error while creating admin" });
  }
};

// @desc    Get specific admin details
// @route   POST /admin/get_admin
// @access  Private (Super Admin Only)
exports.getAdmin = async (req, res) => {
  try {
    const { admin_id } = req.body;

    // Check if current user is super admin
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({
        error: "Access denied. Super admin privileges required.",
      });
    }

    // Find the admin by ID
    const admin = await User.findById(admin_id).select("-password");

    if (!admin || !admin.isAdmin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Get admin profile
    const UserProfile = require("../models/UserProfile");
    const profile = await UserProfile.findOne({ user_id: admin._id });

    // Prepare admin data
    const adminData = {
      id: admin._id,
      full_name: profile ? profile.fullname : "",
      username: admin.username,
      email: admin.email,
      is_active: !admin.isDeactivated,
      role: admin.adminRole,
      permissions: admin.adminPermissions,
      created_at: admin.createdAt,
      is_super_admin: admin.isSuperAdmin,
      last_login: admin.lastLogin || null,
      updated_at: admin.updatedAt,
    };

    const responseData = {
      message: "Admin details retrieved successfully",
      admin: adminData,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error getting admin:", error);
    res.status(500).json({ error: "Server error while retrieving admin" });
  }
};

// @desc    Get all admins
// @route   GET /admin/get_admins
// @access  Private (Super Admin Only)
exports.getAllAdmins = async (req, res) => {
  try {
    // Check if current user is super admin
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({
        error: "Access denied. Super admin privileges required.",
      });
    }

    // Get all admin users with their profiles
    const admins = await User.find({
      user_type: "admin",
      isAdmin: true,
      isSuperAdmin: false,
    })
      .select("-password")
      .populate({
        path: "_id",
        select: "fullname",
        model: "UserProfile",
        localField: "_id",
        foreignField: "user_id",
      });

    const adminList = [];

    for (const admin of admins) {
      // Get admin profile
      const UserProfile = require("../models/UserProfile");
      const profile = await UserProfile.findOne({ user_id: admin._id });

      adminList.push({
        id: admin._id._id,
        user_id: admin._id.user_id,
        full_name: admin._id.fullname ? admin._id.fullname : "",
        username: admin.username,
        email: admin.email,
        is_active: !admin.isDeactivated,
        role: admin.adminRole,
        permissions: admin.adminPermissions,
        created_at: admin.createdAt,
        is_super_admin: admin.isSuperAdmin,
        last_login: admin.lastLogin || null,
      });
    }

    const responseData = {
      message: "Admins retrieved successfully",
      admins: adminList,
      total: adminList.length,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error getting admins:", error);
    res.status(500).json({ error: "Server error while retrieving admins" });
  }
};

// @desc    Update admin user
// @route   POST /admin/update_admin
// @access  Private (Super Admin Only)
exports.updateAdmin = async (req, res) => {
  try {
    const {
      admin_id,
      full_name,
      username,
      email,
      is_active,
      role,
      permissions,
    } = req.body;

    // Check if current user is super admin
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({
        error: "Access denied. Super admin privileges required.",
      });
    }

    // Find the admin to update
    const admin = await User.findById(admin_id);
    if (!admin || !admin.isAdmin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Prevent super admin from being modified by another super admin
    if (admin.isSuperAdmin && admin._id.toString() !== req.user.id) {
      return res.status(403).json({
        error: "Cannot modify another super admin",
      });
    }

    // Check for duplicate username/email if they're being changed
    if (username && username !== admin.username) {
      const existingUsername = await User.findOne({
        username,
        _id: { $ne: admin_id },
      });
      if (existingUsername) {
        return res.status(409).json({ error: "Username already exists" });
      }
    }

    if (email && email !== admin.email) {
      const existingEmail = await User.findOne({
        email,
        _id: { $ne: admin_id },
      });
      if (existingEmail) {
        return res.status(409).json({ error: "Email already exists" });
      }
    }

    // Validate role if provided

    // Update admin data
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.adminRole = role;
    if (permissions) updateData.adminPermissions = permissions;
    if (is_active !== undefined) updateData.isDeactivated = !is_active;
    console.log(updateData.isDeactivated);
    await User.findByIdAndUpdate(admin_id, updateData);

    // Update profile if full_name provided
    if (full_name) {
      const UserProfile = require("../models/UserProfile");
      await UserProfile.findOneAndUpdate(
        { user_id: admin_id },
        { fullname: full_name },
        { upsert: true }
      );
    }

    // Get updated admin data
    const updatedAdmin = await User.findById(admin_id).select("-password");
    const UserProfile = require("../models/UserProfile");
    const profile = await UserProfile.findOne({ user_id: admin_id });

    const adminData = {
      id: updatedAdmin._id,
      full_name: profile ? profile.fullname : "",
      username: updatedAdmin.username,
      email: updatedAdmin.email,
      is_active: !updatedAdmin.isDeactivated || true,
      role: updatedAdmin.adminRole,
      permissions: updatedAdmin.adminPermissions,
      created_at: updatedAdmin.createdAt,
      is_super_admin: updatedAdmin.isSuperAdmin,
    };

    const responseData = {
      message: "Admin updated successfully",
      admin: adminData,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error updating admin:", error);
    res.status(500).json({ error: "Server error while updating admin" });
  }
};

// @desc    Delete admin user
// @route   POST /admin/delete_admin
// @access  Private (Super Admin Only)
exports.deleteAdmin = async (req, res) => {
  try {
    const { admin_id } = req.body;

    // Check if current user is super admin
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({
        error: "Access denied. Super admin privileges required.",
      });
    }

    // Find the admin to delete
    const admin = await User.findById(admin_id);
    if (!admin || !admin.isAdmin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Prevent super admin from being deleted
    if (admin.isSuperAdmin) {
      return res.status(403).json({
        error: "Cannot delete super admin",
      });
    }

    // Prevent admin from deleting themselves
    if (admin._id.toString() === req.user.id) {
      return res.status(403).json({
        error: "Cannot delete your own account",
      });
    }

    // Delete admin and their profile
    await User.findByIdAndDelete(admin_id);

    const UserProfile = require("../models/UserProfile");
    await UserProfile.findOneAndDelete({ user_id: admin_id });

    const responseData = {
      message: "Admin deleted successfully",
      deleted_admin_id: admin_id,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error deleting admin:", error);
    res.status(500).json({ error: "Server error while deleting admin" });
  }
};

// @desc    Toggle admin status (activate/deactivate)
// @route   POST /admin/toggle_admin_status
// @access  Private (Super Admin Only)
exports.toggleAdminStatus = async (req, res) => {
  try {
    const { admin_id, is_active } = req.body;

    // Check if current user is super admin
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({
        error: "Access denied. Super admin privileges required.",
      });
    }

    // Find the admin
    const admin = await User.findById(admin_id);
    if (!admin || !admin.isAdmin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Prevent super admin status from being changed
    if (admin.isSuperAdmin) {
      return res.status(403).json({
        error: "Cannot modify super admin status",
      });
    }

    // Update admin status
    admin.isDeactivated = !is_active;
    await admin.save();

    const responseData = {
      message: `Admin ${is_active ? "activated" : "deactivated"} successfully`,
      admin_id: admin_id,
      is_active: is_active,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error toggling admin status:", error);
    res.status(500).json({ error: "Server error while updating admin status" });
  }
};
