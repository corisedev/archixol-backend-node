const jwt = require("jsonwebtoken");
const config = require("../config/config");
const User = require("../models/User");

// Protect routes
exports.protect = async (req, res, next) => {
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

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ error: "User not found" });
    }

    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Not authorized, token failed" });
  }
};

// Grant access to service providers only
exports.authorizeServiceProvider = (req, res, next) => {
  if (req.user.user_type !== "service_provider") {
    return res
      .status(403)
      .json({ error: "Access denied. Service provider access only." });
  }
  next();
};

// Middleware to check if user is a supplier
exports.authorizeSupplier = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.user_type !== "supplier") {
      return res.status(403).json({
        error: "Access denied. Only suppliers can access this resource",
      });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// Grant access to clients only
exports.authorizeClient = (req, res, next) => {
  if (req.user.user_type !== "client") {
    return res
      .status(403)
      .json({ error: "Access denied. Client access only." });
  }
  next();
};

// Grant access to company accounts only
exports.authorizeCompany = (req, res, next) => {
  next();
};

// middleware/auth.js (add this function)

// Get user from token if provided, but don't require it
exports.getUser = async (req, res, next) => {
  let token;

  // Check if token is in the Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  // If no token, just continue (not required)
  if (!token) {
    return next();
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from the token
    const user = await User.findById(decoded.id);

    if (user) {
      // Set user in request
      req.user = user;
    }

    next();
  } catch (err) {
    // If token is invalid, just continue without setting req.user
    console.error("Token validation error (optional auth):", err.message);
    next();
  }
};
