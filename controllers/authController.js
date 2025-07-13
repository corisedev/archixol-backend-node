const crypto = require("crypto");
const User = require("../models/User");
const Company = require("../models/Company");
const sendEmail = require("../utils/email");
const {
  validateSignup,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validate,
} = require("../utils/validation");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Register user
// @route   POST /account/signup
// @access  Public
exports.signup = [
  validateSignup,
  validate,
  async (req, res) => {
    console.log(req.body);
    const { username, email, password, user_type, agree_terms } = req.body;

    try {
      let user = await User.findOne({ email });

      if (user) {
        return res.status(409).json({ error: "User already exists" });
      }
      user = new User({
        username,
        email,
        password,
        user_type,
        agree_terms,
      });

      const verificationToken = user.getEmailVerificationToken();

      await user.save();

      const verificationUrl = `${process.env.FRONTEND_URL}/email-verified/${verificationToken}`;
      const message = `
        <h1>Email Verification</h1>
        <p>Please click the link below to verify your email:</p>
      `;

      try {
        // console.log("SENDING MAIL");
        // await sendEmail({
        //   email: user.email,
        //   subject: "Archixol Email Verification",
        //   message,
        // });
        // console.log("Email sent");

        const responseData = {
          message: "Registration successfull!",
        };

        const encryptedData = encryptData(responseData);

        res.status(200).json({ data: encryptedData });
      } catch (err) {
        console.log(err);
        user.emailVerificationToken = undefined;
        user.emailVerificationExpire = undefined;

        await user.save();

        return res.status(500).json({ error: "Email could not be sent" });
      }
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "Something went wrong, Server side error" });
    }
  },
];

// @desc    Login user
// @route   POST /account/login
// @access  Public
exports.login = [
  validateLogin,
  validate,
  async (req, res) => {
    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const isMatch = await user.matchPassword(password);

      if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // ✅ CHECK AND UPDATE FIRST LOGIN
      let isFirstLogin = false;
      if (!user.firstLogin) {
        user.firstLogin = true;
        await user.save();
        isFirstLogin = true;
      }

      // ✅ GET USER PROFILE DATA
      let userProfile = null;
      try {
        const UserProfile = require("../models/UserProfile");
        userProfile = await UserProfile.findOne({ user_id: user._id });
      } catch (profileError) {
        console.error(
          "Error fetching user profile during login:",
          profileError
        );
      }

      const token = user.getSignedJwtToken();

      const user_data = {
        id: user._id,
        email: user.email,
        username: user.username,
        firstLogin: isFirstLogin,
        accessRoles: user.accessRoles,
        isCompany: user.company || false,
        isVerify: user.user_type === "admin" ? true : user.isEmailVerified,
        fullname: userProfile ? userProfile.fullname : null,
        profile_img: userProfile ? userProfile.profile_img : "",
      };

      const responseData = {
        message: "Login successful",
        token,
        user_type: user.user_type,
        user_data,
      };

      const encryptedData = encryptData(responseData);
      res.status(200).json({ data: encryptedData });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
];

// @desc    Verify email
// @route   GET /account/verify_email/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ error: "Invalid verification link" });
  }

  try {
    const emailVerificationToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      emailVerificationToken,
      emailVerificationExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ error: "Invalid or expired verification link" });
    }

    if (user.isEmailVerified) {
      const responseData = { message: "Email already verified" };
      const encryptedData = encryptData(responseData);
      return res.status(200).json({ data: encryptedData });
    }
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;

    await user.save();

    const responseData = { message: "Email verified successfully" };
    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Resend verification email
// @route   POST /account/resend_email
// @access  Public
exports.resendVerificationEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.isEmailVerified) {
      const responseData = { message: "Email already verified" };
      const encryptedData = encryptData(responseData);
      return res.status(200).json({ data: encryptedData });
    }

    const verificationToken = user.getEmailVerificationToken();

    await user.save();

    const verificationUrl = `${process.env.FRONTEND_URL}/email-verified/${verificationToken}`;

    const message = `
      <h1>Email Verification</h1>
      <p>Please click the link below to verify your email:</p>
      <a href="${verificationUrl}" target="_blank">Verify Email</a>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: "Archixol Email Verification",
        message,
      });

      const responseData = {
        message: "Email verification sent, please check your email",
      };
      const encryptedData = encryptData(responseData);
      res.status(200).json({ data: encryptedData });
    } catch (err) {
      console.error("Email sending error:", err);
      user.emailVerificationToken = undefined;
      user.emailVerificationExpire = undefined;

      await user.save();

      return res.status(500).json({ error: "Email could not be sent" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Forgot password
// @route   POST /account/forgot_password
// @access  Public
exports.forgotPassword = [
  validateForgotPassword,
  validate,
  async (req, res) => {
    const { email } = req.body;

    try {
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const resetToken = user.getResetPasswordToken();

      await user.save();
      const resetUrl = `${process.env.FRONTEND_URL}/change-password/${resetToken}`;

      const message = `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Please click the link below to reset your password:</p>
        <a href="${resetUrl}" target="_blank">Reset Password</a>
        <p>If you didn't request this, please ignore this email.</p>
      `;

      try {
        await sendEmail({
          email: user.email,
          subject: "Archixol Password Reset",
          message,
        });

        const responseData = { message: "Password reset email sent" };
        const encryptedData = encryptData(responseData);
        res.status(200).json({ data: encryptedData });
      } catch (err) {
        console.error("Email sending error:", err);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        return res.status(500).json({ error: "Email could not be sent" });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
];

// @desc    Reset password with token
// @route   POST /account/reset_password/:token
// @access  Public
exports.resetPasswordWithToken = [
  validateResetPassword,
  validate,
  async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;

      if (!token) {
        return res.status(400).json({ error: "Invalid reset token" });
      }
      const resetPasswordToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() },
      });

      if (!user) {
        return res
          .status(400)
          .json({ error: "Invalid or expired reset token" });
      }

      user.password = password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save();

      const responseData = { message: "Password updated successfully" };
      const encryptedData = encryptData(responseData);
      res.status(200).json({ data: encryptedData });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
];

// @desc    Update password (when logged in)
// @route   POST /account/update_password
// @access  Private
exports.updatePassword = [
  validateResetPassword,
  validate,
  async (req, res) => {
    try {
      const { password } = req.body;
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      user.password = password;

      await user.save();

      const responseData = { message: "Password updated successfully" };
      const encryptedData = encryptData(responseData);
      res.status(200).json({ data: encryptedData });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
];

// @desc    Get current user profile
// @route   GET /account/me
// @access  Private
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // ✅ GET USER PROFILE DATA
    let userProfile = null;
    try {
      const UserProfile = require("../models/UserProfile");
      userProfile = await UserProfile.findOne({ user_id: user._id });
    } catch (profileError) {
      console.error("Error fetching user profile:", profileError);
    }

    const userData = {
      id: user._id,
      email: user.email,
      username: user.username,
      user_type: user.user_type,
      isEmailVerified: user.isEmailVerified,
      isCompany: user.company || false,
      profile_template: user.profile_template || "default",
      // ✅ ADD NEW FIELDS TO RESPONSE
      firstLogin: user.firstLogin,
      accessRoles: user.accessRoles,
      // ✅ ADD PROFILE DATA
      fullname: userProfile ? userProfile.fullname : null,
      profile_img: userProfile ? userProfile.profile_img : "",
    };

    const responseData = { user: userData };
    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Become a company
// @route   POST /account/become_company
// @access  Private
exports.becomeCompany = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (user.company) {
      return res
        .status(400)
        .json({ error: "User is already registered as a company" });
    }

    user.company = true;
    await user.save();
    let company = await Company.findOne({ user_id: userId });

    if (!company) {
      company = await Company.create({
        user_id: userId,
      });
    }

    const responseData = {
      message: "Successfully registered as a company",
      user: {
        isCompany: true,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ NEW API: Become a supplier
// @desc    Become a supplier
// @route   POST /account/become_a_supplier
// @access  Private
exports.becomeSupplier = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user already has supplier access
    if (user.accessRoles.includes("supplier")) {
      return res.status(400).json({
        error: "User already has supplier access",
      });
    }

    // Add supplier to access roles
    user.accessRoles.push("supplier");
    await user.save();

    const responseData = {
      message: "Successfully became a supplier",
      user: {
        accessRoles: user.accessRoles,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Become a service provider
// @route   POST /account/become_a_service_provider
// @access  Private
exports.becomeServiceProvider = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user already has service provider access
    if (user.accessRoles.includes("service_provider")) {
      return res.status(400).json({
        error: "User already has service provider access",
      });
    }

    // Add service_provider to access roles
    user.accessRoles.push("service_provider");
    await user.save();

    const responseData = {
      message: "Successfully became a service provider",
      user: {
        accessRoles: user.accessRoles,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
