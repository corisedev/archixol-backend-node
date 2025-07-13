// models/User.js (Updated with RBAC fields)
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const config = require("../config/config");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Please add a username"],
    unique: true,
    trim: true,
    maxlength: [50, "Username cannot be more than 50 characters"],
  },
  email: {
    type: String,
    required: [true, "Please add an email"],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email",
    ],
  },
  password: {
    type: String,
    required: [true, "Please add a password"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false,
  },
  user_type: {
    type: String,
    enum: ["supplier", "service_provider", "client", "admin"],
    required: [true, "Please specify user type"],
  },
  agree_terms: {
    type: Boolean,
    required: [true, "Please agree to terms and conditions"],
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  // Add the company field to the schema
  company: {
    type: Boolean,
    default: false,
  },
  profile_template: {
    type: String,
    default: "DefaultTemplate",
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isSuperAdmin: {
    type: Boolean,
    default: false,
  },

  // ✅ UPDATED RBAC FIELDS
  adminRole: {
    type: String,
    default: null,
    // Reference to AdminRole.name field
  },
  adminPermissions: {
    type: [String],
    default: [],
  },

  // Account status for admins
  isDeactivated: {
    type: Boolean,
    default: false,
  },

  // Last login tracking
  lastLogin: {
    type: Date,
    default: null,
  },

  // Login attempt tracking
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockedUntil: {
    type: Date,
    default: null,
  },

  // ✅ EXISTING FIELDS
  firstLogin: {
    type: Boolean,
    default: false,
  },
  accessRoles: {
    type: [String],
    enum: ["client", "supplier", "service_provider", "admin"],
    default: ["client"], // Default to client role
  },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Encrypt password using bcrypt
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ✅ UPDATE PRE-SAVE HOOK FOR RBAC
UserSchema.pre("save", function (next) {
  // Update last login when user logs in
  if (this.isModified("lastLogin")) {
    this.loginAttempts = 0; // Reset login attempts on successful login
    this.lockedUntil = null; // Clear any account locks
  }

  // Ensure admin users have proper role setup
  if (this.isAdmin && !this.adminRole && !this.isSuperAdmin) {
    // Assign default role if none specified
    this.adminRole = "admin";
  }

  // Clear admin fields if user is not admin
  if (!this.isAdmin) {
    this.adminRole = null;
    this.adminPermissions = [];
    this.isSuperAdmin = false;
    this.isDeactivated = false;
  }

  // Super admin cannot be deactivated
  if (this.isSuperAdmin) {
    this.isDeactivated = false;
  }

  next();
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT token
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, config.jwtSecret, {
    expiresIn: config.jwtExpire,
  });
};

// Generate email verification token
UserSchema.methods.getEmailVerificationToken = function () {
  // Generate token
  const verificationToken = crypto.randomBytes(20).toString("hex");

  // Hash token and set to emailVerificationToken field
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  // Set expire
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Generate reset password token
UserSchema.methods.getResetPasswordToken = function () {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString("hex");

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set expire
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour

  return resetToken;
};

// ✅ NEW RBAC METHODS

// Check if user has specific permission
UserSchema.methods.hasPermission = function (permission) {
  if (!this.isAdmin) return false;
  if (this.isSuperAdmin) return true; // Super admin has all permissions
  if (this.isDeactivated) return false; // Deactivated admins have no permissions

  return this.adminPermissions && this.adminPermissions.includes(permission);
};

// Check if user has all specified permissions
UserSchema.methods.hasAllPermissions = function (permissions) {
  if (!this.isAdmin) return false;
  if (this.isSuperAdmin) return true;
  if (this.isDeactivated) return false;

  if (!this.adminPermissions) return false;
  return permissions.every((permission) =>
    this.adminPermissions.includes(permission)
  );
};

// Check if user has any of the specified permissions
UserSchema.methods.hasAnyPermission = function (permissions) {
  if (!this.isAdmin) return false;
  if (this.isSuperAdmin) return true;
  if (this.isDeactivated) return false;

  if (!this.adminPermissions) return false;
  return permissions.some((permission) =>
    this.adminPermissions.includes(permission)
  );
};

// Track login attempt
UserSchema.methods.trackLoginAttempt = function () {
  this.loginAttempts += 1;

  // Lock account after 5 failed attempts for 30 minutes
  if (this.loginAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }

  return this.save();
};

// Check if account is locked
UserSchema.methods.isLocked = function () {
  return this.lockedUntil && this.lockedUntil > Date.now();
};

// Update last login
UserSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  this.loginAttempts = 0;
  this.lockedUntil = null;
  return this.save();
};

// Virtual for checking if admin is active
UserSchema.virtual("isActiveAdmin").get(function () {
  return this.isAdmin && !this.isDeactivated;
});

// Make sure virtuals are included when converting to JSON
UserSchema.set("toJSON", { virtuals: true });
UserSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("User", UserSchema);
