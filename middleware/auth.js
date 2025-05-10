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

// Grant access to suppliers only
exports.authorizeSupplier = (req, res, next) => {
  if (req.user.user_type !== "supplier") {
    return res
      .status(403)
      .json({ error: "Access denied. Supplier access only." });
  }
  next();
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
