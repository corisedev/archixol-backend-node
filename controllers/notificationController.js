// controllers/notificationController.js
const Notification = require("../models/Notification");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Get all notifications for the authenticated user
// @route   GET /account/get_notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    // Extract query parameters for pagination and filtering
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type;
    const readStatus = req.query.read_status;

    // Build filter query
    let filterQuery = { recipient: userId };

    // Filter by notification type if specified
    if (type) {
      filterQuery.type = type;
    }

    // Filter by read status if specified
    if (readStatus === "read") {
      filterQuery.isRead = true;
    } else if (readStatus === "unread") {
      filterQuery.isRead = false;
    }
    // If readStatus is 'all' or not specified, don't add isRead filter

    // Get total count for pagination
    const totalNotifications = await Notification.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalNotifications / limit);

    // Find notifications with pagination and filters
    const notifications = await Notification.find(filterQuery)
      .populate({
        path: "sender",
        select: "username email user_type",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Transform notifications to match the required format
    const formattedNotifications = notifications.map((notification) => {
      // Determine notification type based on message content or existing type
      let type = notification.type || "system";

      // Extract title and description from the message
      let title = "Notification";
      let description = notification.message;

      // Parse message if it contains title and description
      if (notification.message.includes(":")) {
        const messageParts = notification.message.split(":", 2);
        title = messageParts[0].trim();
        description = messageParts[1].trim();
      }

      // Set type based on message content if not already set
      if (!notification.type) {
        const messageUpper = notification.message.toUpperCase();
        if (
          messageUpper.includes("PROJECT") ||
          messageUpper.includes("PROPOSAL") ||
          messageUpper.includes("JOB")
        ) {
          type = "project";
        } else if (
          messageUpper.includes("MESSAGE") ||
          messageUpper.includes("CHAT")
        ) {
          type = "message";
        } else if (
          messageUpper.includes("PAYMENT") ||
          messageUpper.includes("ORDER") ||
          messageUpper.includes("REFUND")
        ) {
          type = "payment";
        } else {
          type = "system";
        }
      }

      return {
        id: notification._id,
        type: type,
        title: title,
        description: description,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        sender: notification.sender
          ? {
              id: notification.sender._id,
              username: notification.sender.username,
              userType: notification.sender.user_type,
            }
          : null,
      };
    });

    const responseData = {
      message: "Notifications retrieved successfully",
      notifications: formattedNotifications,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalNotifications: totalNotifications,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        limit: limit,
      },
      filters: {
        type: type || "all",
        readStatus: readStatus || "all",
      },
    };

    // Encrypt the response
    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error retrieving notifications:", error);
    res.status(500).json({
      error: "Failed to retrieve notifications",
      details: error.message,
    });
  }
};

// @desc    Mark all notifications as read for the authenticated user
// @route   POST /account/mark_all_read_notifications
// @access  Private
exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isReadAll } = req.body;

    // Validate that isReadAll is true
    if (!isReadAll || isReadAll !== true) {
      return res.status(400).json({
        error: "Invalid request. isReadAll must be true",
      });
    }

    // Update all unread notifications for the user to read
    const updateResult = await Notification.updateMany(
      {
        recipient: userId,
        isRead: false,
      },
      {
        isRead: true,
      }
    );

    console.log(
      `Marked ${updateResult.modifiedCount} notifications as read for user ${userId}`
    );

    const responseData = {
      message: `Successfully marked ${updateResult.modifiedCount} notifications as read`,
    };

    // Encrypt the response
    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({
      error: "Failed to mark notifications as read",
      details: error.message,
    });
  }
};

// @desc    Mark a specific notification as read
// @route   POST /account/mark_notification_read
// @access  Private
exports.markNotificationRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notification_id } = req.body;

    if (!notification_id) {
      return res.status(400).json({
        error: "Notification ID is required",
      });
    }

    // Find and update the specific notification
    const notification = await Notification.findOneAndUpdate(
      {
        _id: notification_id,
        recipient: userId,
      },
      {
        isRead: true,
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        error:
          "Notification not found or you don't have permission to access it",
      });
    }

    const responseData = {
      message: "Notification marked as read successfully",
    };

    // Encrypt the response
    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      error: "Failed to mark notification as read",
      details: error.message,
    });
  }
};

// @desc    Get unread notification count for the authenticated user
// @route   GET /account/unread_notifications_count
// @access  Private
exports.getUnreadNotificationsCount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Count unread notifications for the user
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    const responseData = {
      message: "Unread count retrieved successfully",
      unreadCount: unreadCount,
    };

    // Encrypt the response
    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error getting unread notifications count:", error);
    res.status(500).json({
      error: "Failed to get unread notifications count",
      details: error.message,
    });
  }
};

// @desc    Delete a notification
// @route   POST /account/delete_notification
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notification_id } = req.body;

    if (!notification_id) {
      return res.status(400).json({
        error: "Notification ID is required",
      });
    }

    // Find and delete the specific notification
    const notification = await Notification.findOneAndDelete({
      _id: notification_id,
      recipient: userId,
    });

    if (!notification) {
      return res.status(404).json({
        error:
          "Notification not found or you don't have permission to delete it",
      });
    }

    const responseData = {
      message: "Notification deleted successfully",
    };

    // Encrypt the response
    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      error: "Failed to delete notification",
      details: error.message,
    });
  }
};

// @desc    Delete all notifications for the authenticated user
// @route   POST /account/delete_all_notifications
// @access  Private
exports.deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { confirmDelete } = req.body;

    // Require confirmation
    if (!confirmDelete || confirmDelete !== true) {
      return res.status(400).json({
        error: "Invalid request. confirmDelete must be true",
      });
    }

    // Delete all notifications for the user
    const deleteResult = await Notification.deleteMany({
      recipient: userId,
    });

    console.log(
      `Deleted ${deleteResult.deletedCount} notifications for user ${userId}`
    );

    const responseData = {
      message: `Successfully deleted ${deleteResult.deletedCount} notifications`,
    };

    // Encrypt the response
    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error("Error deleting all notifications:", error);
    res.status(500).json({
      error: "Failed to delete notifications",
      details: error.message,
    });
  }
};
