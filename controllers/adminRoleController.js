// controllers/adminRoleController.js
const AdminRole = require("../models/AdminRole");
const User = require("../models/User");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Create new admin role
// @route   POST /admin/create_role
// @access  Private (Super Admin Only)
exports.createRole = async (req, res) => {
  try {
    const {
      name,
      display_name,
      description = "",
      default_permissions = [],
      is_active = true,
    } = req.body;

    // Check if role name already exists
    const existingRole = await AdminRole.findOne({ name });
    if (existingRole) {
      return res.status(409).json({ error: "Role name already exists" });
    }

    // Create new role
    const newRole = new AdminRole({
      name,
      display_name,
      description,
      default_permissions,
      is_active,
      created_by: req.user.id,
    });

    await newRole.save();

    const responseData = {
      message: "Admin role created successfully",
      role: {
        id: newRole._id,
        name: newRole.name,
        display_name: newRole.display_name,
        description: newRole.description,
        default_permissions: newRole.default_permissions,
        is_active: newRole.is_active,
        created_at: newRole.created_at,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({ error: "Server error while creating role" });
  }
};

// @desc    Get all admin roles
// @route   GET /admin/get_roles
// @access  Private (Admin with manage_admin_roles permission)
exports.getAllRoles = async (req, res) => {
  try {
    const roles = await AdminRole.find({})
      .populate("created_by", "username email")
      .sort({ created_at: -1 });

    const roleList = roles.map((role) => ({
      id: role._id,
      name: role.name,
      display_name: role.display_name,
      description: role.description,
      default_permissions: role.default_permissions,
      permissions_count: role.default_permissions.length,
      is_system_role: role.is_system_role,
      is_active: role.is_active,
      created_by: role.created_by
        ? {
            id: role.created_by._id,
            username: role.created_by.username,
            email: role.created_by.email,
          }
        : null,
      created_at: role.created_at,
      updated_at: role.updated_at,
    }));

    const responseData = {
      message: "Roles retrieved successfully",
      roles: roleList,
      total: roleList.length,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error getting roles:", error);
    res.status(500).json({ error: "Server error while retrieving roles" });
  }
};

// @desc    Get specific role details
// @route   POST /admin/get_role
// @access  Private (Admin with manage_admin_roles permission)
exports.getRole = async (req, res) => {
  try {
    const { role_id } = req.body;

    const role = await AdminRole.findById(role_id).populate(
      "created_by",
      "username email"
    );

    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Get users count with this role
    const usersCount = await User.countDocuments({ adminRole: role.name });

    const roleData = {
      id: role._id,
      name: role.name,
      display_name: role.display_name,
      description: role.description,
      default_permissions: role.default_permissions,
      permissions_count: role.default_permissions.length,
      is_system_role: role.is_system_role,
      is_active: role.is_active,
      users_count: usersCount,
      created_by: role.created_by
        ? {
            id: role.created_by._id,
            username: role.created_by.username,
            email: role.created_by.email,
          }
        : null,
      created_at: role.created_at,
      updated_at: role.updated_at,
    };

    const responseData = {
      message: "Role details retrieved successfully",
      role: roleData,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error getting role:", error);
    res.status(500).json({ error: "Server error while retrieving role" });
  }
};

// @desc    Update admin role
// @route   POST /admin/update_role
// @access  Private (Super Admin Only)
exports.updateRole = async (req, res) => {
  try {
    const {
      role_id,
      name,
      display_name,
      description,
      default_permissions,
      is_active,
    } = req.body;

    const role = await AdminRole.findById(role_id);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Prevent modification of system roles
    if (role.is_system_role) {
      return res.status(403).json({
        error: "Cannot modify system role",
      });
    }

    // Check for duplicate name if changing
    if (name && name !== role.name) {
      const existingRole = await AdminRole.findOne({
        name,
        _id: { $ne: role_id },
      });
      if (existingRole) {
        return res.status(409).json({ error: "Role name already exists" });
      }
    }

    // Update role data
    const updateData = {};
    if (name) updateData.name = name;
    if (display_name) updateData.display_name = display_name;
    if (description !== undefined) updateData.description = description;
    if (default_permissions)
      updateData.default_permissions = default_permissions;
    if (is_active !== undefined) updateData.is_active = is_active;

    const updatedRole = await AdminRole.findByIdAndUpdate(role_id, updateData, {
      new: true,
    }).populate("created_by", "username email");

    // If role name changed, update all users with this role
    if (name && name !== role.name) {
      await User.updateMany({ adminRole: role.name }, { adminRole: name });
    }

    const roleData = {
      id: updatedRole._id,
      name: updatedRole.name,
      display_name: updatedRole.display_name,
      description: updatedRole.description,
      default_permissions: updatedRole.default_permissions,
      permissions_count: updatedRole.default_permissions.length,
      is_system_role: updatedRole.is_system_role,
      is_active: updatedRole.is_active,
      created_by: updatedRole.created_by
        ? {
            id: updatedRole.created_by._id,
            username: updatedRole.created_by.username,
            email: updatedRole.created_by.email,
          }
        : null,
      created_at: updatedRole.created_at,
      updated_at: updatedRole.updated_at,
    };

    const responseData = {
      message: "Role updated successfully",
      role: roleData,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ error: "Server error while updating role" });
  }
};

// @desc    Delete admin role
// @route   POST /admin/delete_role
// @access  Private (Super Admin Only)
exports.deleteRole = async (req, res) => {
  try {
    const { role_id } = req.body;

    const role = await AdminRole.findById(role_id);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Prevent deletion of system roles
    if (role.is_system_role) {
      return res.status(403).json({
        error: "Cannot delete system role",
      });
    }

    // Check if any users are assigned to this role
    const usersWithRole = await User.countDocuments({ adminRole: role.name });
    if (usersWithRole > 0) {
      return res.status(400).json({
        error: `Cannot delete role. ${usersWithRole} admin(s) are assigned to this role.`,
      });
    }

    await AdminRole.findByIdAndDelete(role_id);

    const responseData = {
      message: "Role deleted successfully",
      deleted_role_id: role_id,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({ error: "Server error while deleting role" });
  }
};

// @desc    Get all available permissions
// @route   GET /admin/get_permissions
// @access  Private (Admin with manage_admin_roles permission)
exports.getAvailablePermissions = async (req, res) => {
  try {
    const permissions = AdminRole.getAllPermissions();

    const responseData = {
      message: "Available permissions retrieved successfully",
      permissions,
      total_categories: permissions.length,
      total_permissions: permissions.reduce(
        (sum, category) => sum + category.permissions.length,
        0
      ),
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error getting permissions:", error);
    res
      .status(500)
      .json({ error: "Server error while retrieving permissions" });
  }
};

// @desc    Get permissions for a specific role
// @route   POST /admin/get_role_permissions
// @access  Private (Admin with manage_admin_roles permission)
exports.getRolePermissions = async (req, res) => {
  try {
    const { role_name } = req.body;

    const role = await AdminRole.findOne({ name: role_name });
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    const allPermissions = AdminRole.getAllPermissions();

    // Map permissions with their assigned status
    const permissionsWithStatus = allPermissions.map((category) => ({
      category: category.category,
      permissions: category.permissions.map((permission) => ({
        ...permission,
        assigned: role.default_permissions.includes(permission.key),
      })),
    }));

    const responseData = {
      message: "Role permissions retrieved successfully",
      role: {
        id: role._id,
        name: role.name,
        display_name: role.display_name,
      },
      permissions: permissionsWithStatus,
      assigned_permissions: role.default_permissions,
      assigned_count: role.default_permissions.length,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error getting role permissions:", error);
    res
      .status(500)
      .json({ error: "Server error while retrieving role permissions" });
  }
};

// @desc    Get all admin roles
// @route   GET /admin/get_roles
// @access  Private (Admin with manage_admin_roles permission)
exports.getAllRoles = async (req, res) => {
  try {
    const roles = await AdminRole.find({})
      .populate("created_by", "username email")
      .sort({ created_at: -1 });

    const roleList = roles.map((role) => ({
      id: role._id,
      name: role.name,
      display_name: role.display_name,
      description: role.description,
      default_permissions: role.default_permissions,
      permissions_count: role.default_permissions.length,
      is_system_role: role.is_system_role,
      is_active: role.is_active,
      created_by: role.created_by
        ? {
            id: role.created_by._id,
            username: role.created_by.username,
            email: role.created_by.email,
          }
        : null,
      created_at: role.created_at,
      updated_at: role.updated_at,
    }));

    const responseData = {
      message: "Roles retrieved successfully",
      roles: roleList,
      total: roleList.length,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error getting roles:", error);
    res.status(500).json({ error: "Server error while retrieving roles" });
  }
};

// @desc    Get specific role details
// @route   POST /admin/get_role
// @access  Private (Admin with manage_admin_roles permission)
exports.getRole = async (req, res) => {
  try {
    const { role_id } = req.body;

    const role = await AdminRole.findById(role_id).populate(
      "created_by",
      "username email"
    );

    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Get users count with this role
    const usersCount = await User.countDocuments({ adminRole: role.name });

    const roleData = {
      id: role._id,
      name: role.name,
      display_name: role.display_name,
      description: role.description,
      default_permissions: role.default_permissions,
      permissions_count: role.default_permissions.length,
      is_system_role: role.is_system_role,
      is_active: role.is_active,
      users_count: usersCount,
      created_by: role.created_by
        ? {
            id: role.created_by._id,
            username: role.created_by.username,
            email: role.created_by.email,
          }
        : null,
      created_at: role.created_at,
      updated_at: role.updated_at,
    };

    const responseData = {
      message: "Role details retrieved successfully",
      role: roleData,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error getting role:", error);
    res.status(500).json({ error: "Server error" });
  }
};
