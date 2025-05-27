const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPasswordWithToken,
  updatePassword,
  getCurrentUser,
  becomeCompany,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { decryptRequest } = require("../middleware/encryption");

const conditionalDecrypt = (req, res, next) => {
  // Skip decryption for GET routes or routes that don't send encrypted data
  if (req.path.includes("/verify_email/")) {
    return next();
  }
  // Apply decryption for POST routes
  return decryptRequest(req, res, next);
};

// Apply conditional decryption middleware to all routes
router.use(conditionalDecrypt);

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.get("/verify_email/:token", verifyEmail);
router.post("/resend_email", resendVerificationEmail);
router.post("/forgot_password", forgotPassword);
router.post("/reset_password/:token", resetPasswordWithToken);

// Protected routes
router.post("/update_password", protect, updatePassword);
router.get("/me", protect, getCurrentUser);
router.post("/become_company", protect, becomeCompany);

module.exports = router;
