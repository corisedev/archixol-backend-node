// models/AdminRole.js
const mongoose = require("mongoose");

const AdminRoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Role name is required"],
    unique: true,
    trim: true,
    maxlength: [50, "Role name cannot be more than 50 characters"],
  },
  display_name: {
    type: String,
    required: [true, "Display name is required"],
    trim: true,
    maxlength: [100, "Display name cannot be more than 100 characters"],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Description cannot be more than 500 characters"],
    default: "",
  },
  default_permissions: {
    type: [String],
    required: false,
  },
  is_system_role: {
    type: Boolean,
    default: false, // System roles cannot be deleted
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// Update the 'updated_at' field before saving
AdminRoleSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

// Static method to get all available permissions
AdminRoleSchema.statics.getAllPermissions = function () {
  return [
    // User Management
    {
      category: "User Management",
      permissions: [
        {
          key: "view_users",
          name: "View Users",
          description: "View user profiles and data",
        },
        {
          key: "create_users",
          name: "Create Users",
          description: "Create new user accounts",
        },
        {
          key: "edit_users",
          name: "Edit Users",
          description: "Modify user profiles and settings",
        },
        {
          key: "delete_users",
          name: "Delete Users",
          description: "Delete user accounts",
        },
        {
          key: "manage_user_roles",
          name: "Manage User Roles",
          description: "Assign and modify user roles",
        },
      ],
    },

    // Admin Management
    {
      category: "Admin Management",
      permissions: [
        {
          key: "view_admins",
          name: "View Admins",
          description: "View admin accounts",
        },
        {
          key: "create_admins",
          name: "Create Admins",
          description: "Create new admin accounts",
        },
        {
          key: "edit_admins",
          name: "Edit Admins",
          description: "Modify admin accounts",
        },
        {
          key: "delete_admins",
          name: "Delete Admins",
          description: "Delete admin accounts",
        },
        {
          key: "manage_admin_roles",
          name: "Manage Admin Roles",
          description: "Create and modify admin roles",
        },
      ],
    },

    // Product Management
    {
      category: "Product Management",
      permissions: [
        {
          key: "view_products",
          name: "View Products",
          description: "View product listings",
        },
        {
          key: "create_products",
          name: "Create Products",
          description: "Add new products",
        },
        {
          key: "edit_products",
          name: "Edit Products",
          description: "Modify product details",
        },
        {
          key: "delete_products",
          name: "Delete Products",
          description: "Remove products",
        },
        {
          key: "manage_product_categories",
          name: "Manage Categories",
          description: "Manage product categories",
        },
      ],
    },

    // Service Management
    {
      category: "Service Management",
      permissions: [
        {
          key: "view_services",
          name: "View Services",
          description: "View service listings",
        },
        {
          key: "create_services",
          name: "Create Services",
          description: "Add new services",
        },
        {
          key: "edit_services",
          name: "Edit Services",
          description: "Modify service details",
        },
        {
          key: "delete_services",
          name: "Delete Services",
          description: "Remove services",
        },
        {
          key: "approve_services",
          name: "Approve Services",
          description: "Approve pending services",
        },
      ],
    },

    // Order Management
    {
      category: "Order Management",
      permissions: [
        {
          key: "view_orders",
          name: "View Orders",
          description: "View order details",
        },
        {
          key: "create_orders",
          name: "Create Orders",
          description: "Create new orders",
        },
        {
          key: "edit_orders",
          name: "Edit Orders",
          description: "Modify order details",
        },
        {
          key: "delete_orders",
          name: "Delete Orders",
          description: "Cancel/delete orders",
        },
        {
          key: "refund_orders",
          name: "Refund Orders",
          description: "Process order refunds",
        },
        {
          key: "manage_order_status",
          name: "Manage Order Status",
          description: "Update order status",
        },
      ],
    },

    // Project Management
    {
      category: "Project Management",
      permissions: [
        {
          key: "view_projects",
          name: "View Projects",
          description: "View project details",
        },
        {
          key: "create_projects",
          name: "Create Projects",
          description: "Create new projects",
        },
        {
          key: "edit_projects",
          name: "Edit Projects",
          description: "Modify project details",
        },
        {
          key: "delete_projects",
          name: "Delete Projects",
          description: "Remove projects",
        },
        {
          key: "approve_projects",
          name: "Approve Projects",
          description: "Approve pending projects",
        },
      ],
    },

    // Financial Management
    {
      category: "Financial Management",
      permissions: [
        {
          key: "view_financials",
          name: "View Financials",
          description: "View financial data",
        },
        {
          key: "manage_payments",
          name: "Manage Payments",
          description: "Process payments and refunds",
        },
        {
          key: "view_reports",
          name: "View Reports",
          description: "Access financial reports",
        },
        {
          key: "export_data",
          name: "Export Data",
          description: "Export financial data",
        },
      ],
    },

    // System Management
    {
      category: "System Management",
      permissions: [
        {
          key: "system_settings",
          name: "System Settings",
          description: "Modify system configurations",
        },
        {
          key: "backup_restore",
          name: "Backup & Restore",
          description: "Manage system backups",
        },
        {
          key: "view_logs",
          name: "View Logs",
          description: "Access system logs",
        },
        {
          key: "manage_notifications",
          name: "Manage Notifications",
          description: "Send system notifications",
        },
      ],
    },

    // Content Management
    {
      category: "Content Management",
      permissions: [
        {
          key: "manage_content",
          name: "Manage Content",
          description: "Manage website content",
        },
        {
          key: "manage_policies",
          name: "Manage Policies",
          description: "Update terms and policies",
        },
        {
          key: "manage_support_tickets",
          name: "Support Tickets",
          description: "Handle support requests",
        },
      ],
    },

    // Analytics
    {
      category: "Analytics",
      permissions: [
        {
          key: "view_analytics",
          name: "View Analytics",
          description: "Access analytics dashboard",
        },
        {
          key: "view_advanced_reports",
          name: "Advanced Reports",
          description: "Access detailed reports",
        },
        {
          key: "export_analytics",
          name: "Export Analytics",
          description: "Export analytics data",
        },
      ],
    },

    // Communication
    {
      category: "Communication",
      permissions: [
        {
          key: "send_notifications",
          name: "Send Notifications",
          description: "Send notifications to users",
        },
        {
          key: "manage_announcements",
          name: "Manage Announcements",
          description: "Create system announcements",
        },
        {
          key: "view_messages",
          name: "View Messages",
          description: "Monitor user communications",
        },
      ],
    },

    // Security
    {
      category: "Security",
      permissions: [
        {
          key: "view_security_logs",
          name: "Security Logs",
          description: "View security audit logs",
        },
        {
          key: "manage_security_settings",
          name: "Security Settings",
          description: "Configure security settings",
        },
        {
          key: "audit_system",
          name: "System Audit",
          description: "Perform system audits",
        },
      ],
    },
  ];
};

// Method to check if role has specific permission
AdminRoleSchema.methods.hasPermission = function (permission) {
  return this.default_permissions.includes(permission);
};

// Method to add permission to role
AdminRoleSchema.methods.addPermission = function (permission) {
  if (!this.default_permissions.includes(permission)) {
    this.default_permissions.push(permission);
  }
  return this.save();
};

// Method to remove permission from role
AdminRoleSchema.methods.removePermission = function (permission) {
  this.default_permissions = this.default_permissions.filter(
    (p) => p !== permission
  );
  return this.save();
};

module.exports = mongoose.model("AdminRole", AdminRoleSchema);
