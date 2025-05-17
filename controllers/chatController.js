// controllers/chatController.js
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const ChatStatus = require("../models/ChatStatus");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { encryptData } = require("../utils/encryptResponse");
const mongoose = require("mongoose");

// Helper function to create or update chat status
const getOrCreateChatStatus = async (userId) => {
  let chatStatus = await ChatStatus.findOne({ user: userId });

  if (!chatStatus) {
    chatStatus = new ChatStatus({
      user: userId,
      isOnline: false,
      lastSeen: new Date(),
    });
    await chatStatus.save();
  }

  return chatStatus;
};

// @desc    Get all conversations for current user
// @route   GET /chat/conversations
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all conversations where current user is a participant
    const conversations = await Conversation.find({
      participants: userId,
      isActive: true,
    })
      .populate("participants", "username user_type email")
      .populate("lastMessage", "text createdAt")
      .sort({ updatedAt: -1 });

    // Format the conversations for response
    const formattedConversations = await Promise.all(
      conversations.map(async (conv) => {
        // Get other participants (excluding current user)
        const otherParticipants = conv.participants.filter(
          (p) => p._id.toString() !== userId
        );

        // Get unread count for current user
        const unreadCount = conv.unreadCount.get(userId) || 0;

        // Get online status for other participants
        const otherParticipantIds = otherParticipants.map((p) => p._id);
        const statuses = await ChatStatus.find({
          user: { $in: otherParticipantIds },
        });

        // Create a map of participant ID to online status
        const onlineStatusMap = {};
        statuses.forEach((status) => {
          onlineStatusMap[status.user.toString()] = {
            isOnline: status.isOnline,
            lastSeen: status.lastSeen,
          };
        });

        // Add online status to participants
        const participantsWithStatus = otherParticipants.map((p) => ({
          _id: p._id,
          username: p.username,
          user_type: p.user_type,
          email: p.email,
          isOnline: onlineStatusMap[p._id.toString()]?.isOnline || false,
          lastSeen: onlineStatusMap[p._id.toString()]?.lastSeen || null,
        }));

        return {
          _id: conv._id,
          participants: participantsWithStatus,
          lastMessage: conv.lastMessage
            ? {
                text: conv.lastMessageText || conv.lastMessage.text,
                createdAt: conv.lastMessageTime || conv.lastMessage.createdAt,
              }
            : null,
          unreadCount,
          updatedAt: conv.updatedAt,
        };
      })
    );

    // Encrypt and send response
    const responseData = {
      message: "Conversations retrieved successfully",
      conversations: formattedConversations,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting conversations:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get messages for a specific conversation
// @route   POST /chat/messages
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversation_id, limit = 50, page = 1 } = req.body;

    if (!conversation_id) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    // Check if user is a participant in this conversation
    const conversation = await Conversation.findOne({
      _id: conversation_id,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Get messages for this conversation
    const messages = await Message.find({
      conversation: conversation_id,
      isDeleted: false,
    })
      .populate("sender", "username user_type")
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit);

    // Mark messages as read by current user
    await Message.updateMany(
      {
        conversation: conversation_id,
        sender: { $ne: userId },
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } }
    );

    // Reset unread count for this user in this conversation
    conversation.unreadCount.set(userId, 0);
    await conversation.save();

    // Format messages for response
    const formattedMessages = messages.map((message) => ({
      _id: message._id,
      text: message.text,
      sender: message.sender,
      isRead: message.readBy.includes(userId),
      isEdited: message.isEdited,
      attachments: message.attachments,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    }));

    // Encrypt and send response
    const responseData = {
      message: "Messages retrieved successfully",
      messages: formattedMessages,
      hasMore: formattedMessages.length === limit,
      currentPage: page,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting messages:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Start or get an existing conversation with another user
// @route   POST /chat/conversation/start
// @access  Private
exports.startConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { participant_id } = req.body;

    if (!participant_id) {
      return res.status(400).json({ error: "Participant ID is required" });
    }

    if (userId === participant_id) {
      return res
        .status(400)
        .json({ error: "Cannot start conversation with yourself" });
    }

    // Check if participant exists
    const participant = await User.findById(participant_id);
    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    // Check if a conversation already exists between these users
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, participant_id] },
      $expr: { $eq: [{ $size: "$participants" }, 2] }, // Ensure it's a direct conversation (only 2 participants)
    }).populate("participants", "username user_type email");

    // If no conversation exists, create a new one
    if (!conversation) {
      conversation = new Conversation({
        participants: [userId, participant_id],
        unreadCount: new Map([
          [participant_id, 0],
          [userId, 0],
        ]),
      });

      await conversation.save();

      // Populate the participants after saving
      conversation = await Conversation.findById(conversation._id).populate(
        "participants",
        "username user_type email"
      );
    }

    // Get online status for the other participant
    const participantStatus = await getOrCreateChatStatus(participant_id);

    // Format the conversation for response
    const otherParticipant = conversation.participants.find(
      (p) => p._id.toString() !== userId
    );

    const formattedConversation = {
      _id: conversation._id,
      participant: {
        _id: otherParticipant._id,
        username: otherParticipant.username,
        user_type: otherParticipant.user_type,
        email: otherParticipant.email,
        isOnline: participantStatus.isOnline,
        lastSeen: participantStatus.lastSeen,
      },
      lastMessage: null,
      unreadCount: conversation.unreadCount.get(userId) || 0,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };

    // Encrypt and send response
    const responseData = {
      message: "Conversation started successfully",
      conversation: formattedConversation,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error starting conversation:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Send a message in a conversation
// @route   POST /chat/send
// @access  Private
exports.sendMessage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { conversation_id, text, attachments = [] } = req.body;

    if (!conversation_id || !text) {
      return res
        .status(400)
        .json({ error: "Conversation ID and message text are required" });
    }

    // Check if user is a participant in this conversation
    const conversation = await Conversation.findOne({
      _id: conversation_id,
      participants: userId,
    }).session(session);

    if (!conversation) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Create new message
    const message = new Message({
      conversation: conversation_id,
      sender: userId,
      text,
      attachments,
      readBy: [userId], // Sender has already read it
    });

    await message.save({ session });

    // Update conversation with last message
    conversation.lastMessage = message._id;
    conversation.lastMessageText = text;
    conversation.lastMessageTime = message.createdAt;

    // Increment unread count for all participants except sender
    conversation.participants.forEach((participant) => {
      if (participant.toString() !== userId) {
        const currentCount =
          conversation.unreadCount.get(participant.toString()) || 0;
        conversation.unreadCount.set(participant.toString(), currentCount + 1);
      }
    });

    await conversation.save({ session });

    // Create notifications for other participants
    const notifications = conversation.participants
      .filter((participant) => participant.toString() !== userId)
      .map((recipient) => ({
        recipient,
        sender: userId,
        type: "message",
        message: text.length > 50 ? text.substring(0, 47) + "..." : text,
        conversation: conversation_id,
      }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications, { session });
    }

    // Get the sender details
    const sender = await User.findById(userId).select("username user_type");

    // Create formatted message for response
    const formattedMessage = {
      _id: message._id,
      text: message.text,
      sender: {
        _id: sender._id,
        username: sender.username,
        user_type: sender.user_type,
      },
      conversation: conversation_id,
      isRead: false,
      isEdited: false,
      attachments: message.attachments,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };

    await session.commitTransaction();
    session.endSession();

    // Send real-time notification via WebSocket
    if (req.socketService) {
      const otherParticipants = conversation.participants.filter(
        (p) => p.toString() !== userId
      );

      otherParticipants.forEach((recipientId) => {
        req.socketService.emitToUser(recipientId.toString(), "newMessage", {
          message: formattedMessage,
          conversation: {
            _id: conversation._id,
            unreadCount:
              conversation.unreadCount.get(recipientId.toString()) || 0,
            lastMessage: {
              text: message.text,
              createdAt: message.createdAt,
            },
          },
        });
      });
    }

    // Encrypt and send response
    const responseData = {
      message: "Message sent successfully",
      sentMessage: formattedMessage,
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Mark messages as read
// @route   POST /chat/mark-read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversation_id } = req.body;

    if (!conversation_id) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    // Check if user is a participant
    const conversation = await Conversation.findOne({
      _id: conversation_id,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Mark all messages as read
    const result = await Message.updateMany(
      {
        conversation: conversation_id,
        sender: { $ne: userId },
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } }
    );

    // Update unread count in conversation
    conversation.unreadCount.set(userId, 0);
    await conversation.save();

    // Notify other participants via WebSocket
    if (req.socketService) {
      const otherParticipants = conversation.participants.filter(
        (p) => p.toString() !== userId
      );

      otherParticipants.forEach((recipientId) => {
        req.socketService.emitToUser(recipientId.toString(), "messagesRead", {
          conversation_id,
          reader: userId,
        });
      });
    }

    // Encrypt and send response
    const responseData = {
      message: "Messages marked as read",
      updatedCount: result.nModified,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error marking messages as read:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get online status of a user or users
// @route   POST /chat/status
// @access  Private
exports.getUserStatus = async (req, res) => {
  try {
    const { user_ids } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: "User IDs array is required" });
    }

    // Get status for the requested users
    const statuses = await ChatStatus.find({
      user: { $in: user_ids },
    });

    // Format the statuses
    const statusMap = {};
    statuses.forEach((status) => {
      statusMap[status.user.toString()] = {
        isOnline: status.isOnline,
        lastSeen: status.lastSeen,
      };
    });

    // Add entries for users with no status record
    user_ids.forEach((userId) => {
      if (!statusMap[userId]) {
        statusMap[userId] = {
          isOnline: false,
          lastSeen: null,
        };
      }
    });

    // Encrypt and send response
    const responseData = {
      message: "User statuses retrieved successfully",
      statuses: statusMap,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting user status:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Set typing status
// @route   POST /chat/typing
// @access  Private
exports.setTypingStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversation_id, is_typing } = req.body;

    if (!conversation_id) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    // Check if user is a participant
    const conversation = await Conversation.findOne({
      _id: conversation_id,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get or create chat status
    const chatStatus = await getOrCreateChatStatus(userId);

    // Update typing status
    chatStatus.isTyping.set(conversation_id, !!is_typing);
    await chatStatus.save();

    // Notify other participants via WebSocket
    if (req.socketService) {
      const otherParticipants = conversation.participants.filter(
        (p) => p.toString() !== userId
      );

      otherParticipants.forEach((recipientId) => {
        req.socketService.emitToUser(recipientId.toString(), "typingStatus", {
          conversation_id,
          user_id: userId,
          is_typing,
        });
      });
    }

    // Encrypt and send response
    const responseData = {
      message: `Typing status ${is_typing ? "started" : "stopped"}`,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error setting typing status:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get notifications
// @route   GET /chat/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, page = 1 } = req.query;

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Get notifications for current user
    const notifications = await Notification.find({
      recipient: userId,
    })
      .populate("sender", "username user_type")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Count unread notifications
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    // Format notifications for response
    const formattedNotifications = notifications.map((notification) => ({
      _id: notification._id,
      sender: notification.sender,
      type: notification.type,
      message: notification.message,
      conversation: notification.conversation,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    }));

    // Encrypt and send response
    const responseData = {
      message: "Notifications retrieved successfully",
      notifications: formattedNotifications,
      unreadCount,
      hasMore: formattedNotifications.length === limit,
      currentPage: page,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting notifications:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Mark notifications as read
// @route   POST /chat/notifications/mark-read
// @access  Private
exports.markNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notification_ids } = req.body;

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return res
        .status(400)
        .json({ error: "Notification IDs array is required" });
    }

    // Mark the specified notifications as read
    const result = await Notification.updateMany(
      {
        _id: { $in: notification_ids },
        recipient: userId,
      },
      { isRead: true }
    );

    // Encrypt and send response
    const responseData = {
      message: "Notifications marked as read",
      updatedCount: result.nModified,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error marking notifications as read:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Search users to start a conversation
// @route   POST /chat/search-users
// @access  Private
exports.searchUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { query } = req.body;

    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Search users by username or email
    const searchPattern = new RegExp(query, "i");
    const users = await User.find({
      $or: [{ username: searchPattern }, { email: searchPattern }],
      _id: { $ne: userId }, // Don't include current user
    })
      .select("username email user_type")
      .limit(10);

    // Get online status for found users
    const userIds = users.map((user) => user._id);
    const statuses = await ChatStatus.find({
      user: { $in: userIds },
    });

    // Create map of user ID to online status
    const statusMap = {};
    statuses.forEach((status) => {
      statusMap[status.user.toString()] = {
        isOnline: status.isOnline,
        lastSeen: status.lastSeen,
      };
    });

    // Format users with status
    const formattedUsers = users.map((user) => ({
      _id: user._id,
      username: user.username,
      email: user.email,
      user_type: user.user_type,
      isOnline: statusMap[user._id.toString()]?.isOnline || false,
      lastSeen: statusMap[user._id.toString()]?.lastSeen || null,
    }));

    // Encrypt and send response
    const responseData = {
      message: "Users found",
      users: formattedUsers,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error searching users:", err);
    res.status(500).json({ error: "Server error" });
  }
};
