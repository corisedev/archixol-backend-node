// middleware/adminRBACAuth.js
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const User = require("../models/User");

// Super admin authorization middleware
exports.authorizeSuperAdmin = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ error: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Check if user is super admin
    if (!user.isSuperAdmin) {
      return res.status(403).json({
        error: "Access denied. Super admin privileges required.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Super admin authorization error:", error);
    return res.status(401).json({ error: "Not authorized, token failed" });
  }
};

// Permission-based authorization middleware
exports.requirePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      let token;

      if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
      ) {
        token = req.headers.authorization.split(" ")[1];
      }

      if (!token) {
        return res.status(401).json({ error: "Not authorized, no token" });
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Check if user is admin
      if (!user.isAdmin) {
        return res.status(403).json({
          error: "Access denied. Admin privileges required.",
        });
      }

      // Super admin has all permissions
      if (user.isSuperAdmin) {
        req.user = user;
        return next();
      }

      // Check if admin is active (not deactivated)
      if (user.isDeactivated) {
        return res.status(403).json({
          error: "Account is deactivated. Contact super admin.",
        });
      }

      // Check if admin has the required permission
      if (
        !user.adminPermissions ||
        !user.adminPermissions.includes(requiredPermission)
      ) {
        return res.status(403).json({
          error: `Access denied. Required permission: ${requiredPermission}`,
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Permission authorization error:", error);
      return res.status(401).json({ error: "Not authorized, token failed" });
    }
  };
};

// Multiple permissions check (user must have ALL permissions)
exports.requireAllPermissions = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      let token;

      if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
      ) {
        token = req.headers.authorization.split(" ")[1];
      }

      if (!token) {
        return res.status(401).json({ error: "Not authorized, no token" });
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Check if user is admin
      if (!user.isAdmin) {
        return res.status(403).json({
          error: "Access denied. Admin privileges required.",
        });
      }

      // Super admin has all permissions
      if (user.isSuperAdmin) {
        req.user = user;
        return next();
      }

      // Check if admin is active
      if (user.isDeactivated) {
        return res.status(403).json({
          error: "Account is deactivated. Contact super admin.",
        });
      }

      // Check if admin has ALL required permissions
      const userPermissions = user.adminPermissions || [];
      const missingPermissions = requiredPermissions.filter(
        (permission) => !userPermissions.includes(permission)
      );

      if (missingPermissions.length > 0) {
        return res.status(403).json({
          error: `Access denied. Missing permissions: ${missingPermissions.join(
            ", "
          )}`,
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Multiple permissions authorization error:", error);
      return res.status(401).json({ error: "Not authorized, token failed" });
    }
  };
};

// Any permission check (user must have AT LEAST ONE permission)
exports.requireAnyPermission = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      let token;

      if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
      ) {
        token = req.headers.authorization.split(" ")[1];
      }

      if (!token) {
        return res.status(401).json({ error: "Not authorized, no token" });
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Check if user is admin
      if (!user.isAdmin) {
        return res.status(403).json({
          error: "Access denied. Admin privileges required.",
        });
      }

      // Super admin has all permissions
      if (user.isSuperAdmin) {
        req.user = user;
        return next();
      }

      // Check if admin is active
      if (user.isDeactivated) {
        return res.status(403).json({
          error: "Account is deactivated. Contact super admin.",
        });
      }

      // Check if admin has ANY of the required permissions
      const userPermissions = user.adminPermissions || [];
      const hasPermission = requiredPermissions.some((permission) =>
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: `Access denied. Required permissions (any): ${requiredPermissions.join(
            ", "
          )}`,
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Any permission authorization error:", error);
      return res.status(401).json({ error: "Not authorized, token failed" });
    }
  };
};

// Admin access middleware (any admin, but not regular users)
exports.requireAdminAccess = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ error: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Check if user is admin
    if (!user.isAdmin) {
      return res.status(403).json({
        error: "Access denied. Admin privileges required.",
      });
    }

    // Check if admin is active (except super admin)
    if (!user.isSuperAdmin && user.isDeactivated) {
      return res.status(403).json({
        error: "Account is deactivated. Contact super admin.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Admin access authorization error:", error);
    return res.status(401).json({ error: "Not authorized, token failed" });
  }
};

// Helper function to check permissions programmatically
exports.hasPermission = (user, permission) => {
  if (!user || !user.isAdmin) {
    return false;
  }

  // Super admin has all permissions
  if (user.isSuperAdmin) {
    return true;
  }

  // Check if admin is active
  if (user.isDeactivated) {
    return false;
  }

  // Check specific permission
  return user.adminPermissions && user.adminPermissions.includes(permission);
};

// Helper function to check multiple permissions
exports.hasAllPermissions = (user, permissions) => {
  if (!user || !user.isAdmin) {
    return false;
  }

  // Super admin has all permissions
  if (user.isSuperAdmin) {
    return true;
  }

  // Check if admin is active
  if (user.isDeactivated) {
    return false;
  }

  // Check all permissions
  const userPermissions = user.adminPermissions || [];
  return permissions.every((permission) =>
    userPermissions.includes(permission)
  );
};

// Helper function to check any permission
exports.hasAnyPermission = (user, permissions) => {
  if (!user || !user.isAdmin) {
    return false;
  }

  // Super admin has all permissions
  if (user.isSuperAdmin) {
    return true;
  }

  // Check if admin is active
  if (user.isDeactivated) {
    return false;
  }

  // Check any permission
  const userPermissions = user.adminPermissions || [];
  return permissions.some((permission) => userPermissions.includes(permission));
};

// Middleware to attach user permissions to request
exports.attachPermissions = async (req, res, next) => {
  try {
    if (req.user && req.user.isAdmin) {
      if (req.user.isSuperAdmin) {
        // Super admin has all permissions
        const AdminRole = require("../models/AdminRole");
        const allPermissions = AdminRole.getAllPermissions();
        req.userPermissions = allPermissions.reduce((acc, category) => {
          return acc.concat(category.permissions.map((p) => p.key));
        }, []);
      } else {
        req.userPermissions = req.user.adminPermissions || [];
      }
    } else {
      req.userPermissions = [];
    }
    next();
  } catch (error) {
    console.error("Error attaching permissions:", error);
    req.userPermissions = [];
    next();
  }
};
