// controllers/roleSwitchController.js
const User = require("../models/User");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Switch user's active role
// @route   POST /account/role_switch
// @access  Private
exports.switchRole = async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.user.id;

    console.log(`Role switch request from user ${userId} to role: ${role}`);

    // Find the user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the user has access to the requested role
    if (!user.accessRoles.includes(role)) {
      return res.status(403).json({
        error: `You don't have access to ${role} role. Please register for this role first.`,
      });
    }

    // Update the user's primary user_type
    user.user_type = role;
    await user.save();

    console.log(`User ${user.username} switched to role: ${role}`);

    // Prepare response data
    const responseData = {
      message: `Successfully switched to ${role} role`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        user_type: user.user_type,
        accessRoles: user.accessRoles,
        isEmailVerified: user.isEmailVerified,
        firstLogin: false,
      },
    };

    // Encrypt and send response
    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Role switch error:", error);
    res.status(500).json({ error: "Server error during role switch" });
  }
};
