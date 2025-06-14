// middleware/adminAuth.js
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const User = require("../models/User");

// Admin authorization middleware
exports.authorizeAdmin = async (req, res, next) => {
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

    req.user = user;
    next();
  } catch (error) {
    console.error("Admin authorization error:", error);
    return res.status(401).json({ error: "Not authorized, token failed" });
  }
};

// Super admin authorization middleware (if you need different admin levels)
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
