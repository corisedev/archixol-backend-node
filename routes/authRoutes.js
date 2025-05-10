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

// Apply decryption middleware to all routes that receive data
router.use(decryptRequest);

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
