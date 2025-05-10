const express = require("express");
const router = express.Router();
const { encryptData } = require("../utils/encryptResponse");
const { protect } = require("../middleware/auth");
const {
  uploadProfileImage,
  uploadBannerImage,
  uploadIntroVideo,
  handleUploadErrors,
} = require("../middleware/profileUpload");
const UserProfile = require("../models/UserProfile");

// @desc    Upload profile image
// @route   POST /uploads/profile-image
// @access  Private
router.post(
  "/profile-image",
  protect,
  uploadProfileImage,
  handleUploadErrors,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const imagePath = `/uploads/profile/images/${req.file.filename}`;

      // Update user profile with new image
      let profile = await UserProfile.findOne({ user_id: req.user.id });

      if (!profile) {
        profile = new UserProfile({ user_id: req.user.id });
      }

      profile.profile_img = imagePath;
      await profile.save();

      const responseData = {
        message: "Profile image uploaded successfully",
        file: imagePath,
      };

      const encryptedData = encryptData(responseData);
      res.status(200).json({ data: encryptedData });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// @desc    Upload banner image
// @route   POST /uploads/banner-image
// @access  Private
router.post(
  "/banner-image",
  protect,
  uploadBannerImage,
  handleUploadErrors,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const imagePath = `/uploads/profile/banners/${req.file.filename}`;

      // Update user profile with new banner
      let profile = await UserProfile.findOne({ user_id: req.user.id });

      if (!profile) {
        profile = new UserProfile({ user_id: req.user.id });
      }

      profile.banner_img = imagePath;
      await profile.save();

      const responseData = {
        message: "Banner image uploaded successfully",
        file: imagePath,
      };

      const encryptedData = encryptData(responseData);
      res.status(200).json({ data: encryptedData });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// @desc    Upload intro video
// @route   POST /uploads/intro-video
// @access  Private
router.post(
  "/intro-video",
  protect,
  uploadIntroVideo,
  handleUploadErrors,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const videoPath = `/uploads/profile/videos/${req.file.filename}`;

      // Update user profile with new video
      let profile = await UserProfile.findOne({ user_id: req.user.id });

      if (!profile) {
        profile = new UserProfile({ user_id: req.user.id });
      }

      profile.intro_video = videoPath;
      await profile.save();

      const responseData = {
        message: "Intro video uploaded successfully",
        file: videoPath,
      };

      const encryptedData = encryptData(responseData);
      res.status(200).json({ data: encryptedData });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router;
