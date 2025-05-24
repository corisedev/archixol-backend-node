// controllers/chatController.js (Updated for real-time functionality)
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const ChatStatus = require("../models/ChatStatus");
const Notification = require("../models/Notification");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Get all conversations for a user
// @route   GET /chat/conversations
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      participants: userId,
      isActive: true,
    })
      .populate({
        path: "participants",
        select: "username email user_type",
        match: { _id: { $ne: userId } },
      })
      .populate({
        path: "lastMessage",
        select: "text createdAt sender",
      })
      .sort({ updatedAt: -1 })
      .lean();

    // Get chat status for all participants
    const participantIds = conversations.flatMap((conv) =>
      conv.participants.map((p) => p._id)
    );

    const chatStatuses = await ChatStatus.find({
      user: { $in: participantIds },
    }).lean();

    const statusMap = {};
    chatStatuses.forEach((status) => {
      statusMap[status.user.toString()] = status;
    });

    // Format conversations
    const formattedConversations = conversations.map((conv) => {
      const otherParticipant = conv.participants[0];
      const status = statusMap[otherParticipant._id.toString()];

      return {
        _id: conv._id,
        participants: conv.participants.map((p) => ({
          _id: p._id,
          username: p.username,
          email: p.email,
          user_type: p.user_type,
          isOnline: status?.isOnline || false,
          lastSeen: status?.lastSeen || new Date(),
        })),
        lastMessage: conv.lastMessage,
        lastMessageText: conv.lastMessageText,
        lastMessageTime: conv.lastMessageTime,
        unreadCount: conv.getUnreadCount ? conv.getUnreadCount(userId) : 0,
        updatedAt: conv.updatedAt,
      };
    });

    const responseData = {
      message: "Conversations retrieved successfully",
      conversations: formattedConversations,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get conversations error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get messages for a conversation
// @route   POST /chat/messages
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversation_id, page = 1, limit = 50 } = req.body;

    if (!conversation_id) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    // Verify user is participant in conversation
    const conversation = await Conversation.findOne({
      _id: conversation_id,
      participants: userId,
      isActive: true,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get messages with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const messages = await Message.find({
      conversation: conversation_id,
      isDeleted: false,
    })
      .populate({
        path: "sender",
        select: "username email user_type",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Mark messages as read
    await Message.updateMany(
      {
        conversation: conversation_id,
        sender: { $ne: userId },
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } }
    );

    // Update conversation unread count
    conversation.resetUnreadCount(userId);
    await conversation.save();

    const responseData = {
      message: "Messages retrieved successfully",
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: messages.length === parseInt(limit),
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Start or get existing conversation
// @route   POST /chat/conversation/start
// @access  Private
exports.startConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { participant_id } = req.body;

    if (!participant_id) {
      return res.status(400).json({ error: "Participant ID is required" });
    }

    if (participant_id === userId) {
      return res
        .status(400)
        .json({ error: "Cannot start conversation with yourself" });
    }

    // Check if participant exists
    const participant = await User.findById(participant_id).select(
      "username email user_type"
    );
    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, participant_id] },
      isActive: true,
    });

    if (!conversation) {
      // Create new conversation using the static method
      conversation = await Conversation.createWithParticipants([
        userId,
        participant_id,
      ]);
    }

    // Get participant status
    const chatStatus = await ChatStatus.findOne({ user: participant_id });

    const responseData = {
      message: "Conversation started successfully",
      conversation: {
        _id: conversation._id,
        participant: {
          _id: participant._id,
          username: participant.username,
          email: participant.email,
          user_type: participant.user_type,
          isOnline: chatStatus?.isOnline || false,
          lastSeen: chatStatus?.lastSeen || new Date(),
        },
        lastMessage: conversation.lastMessage,
        lastMessageText: conversation.lastMessageText,
        lastMessageTime: conversation.lastMessageTime,
        unreadCount: conversation.getUnreadCount
          ? conversation.getUnreadCount(userId)
          : 0,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Start conversation error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Send a message
// @route   POST /chat/send
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversation_id, text, attachments = [] } = req.body;

    if (!conversation_id || !text?.trim()) {
      return res
        .status(400)
        .json({ error: "Conversation ID and message text are required" });
    }

    // Verify user is participant in conversation
    const conversation = await Conversation.findOne({
      _id: conversation_id,
      participants: userId,
      isActive: true,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get participant details separately to avoid the Map key issue
    const participantDetails = await User.find({
      _id: { $in: conversation.participants },
    })
      .select("username email user_type")
      .lean();

    // Create message
    const message = await Message.create({
      conversation: conversation_id,
      sender: userId,
      text: text.trim(),
      attachments,
      readBy: [userId], // Sender has read the message
    });

    // Populate sender information
    await message.populate({
      path: "sender",
      select: "username email user_type",
    });

    // Update conversation
    conversation.lastMessage = message._id;
    conversation.lastMessageText = text.trim();
    conversation.lastMessageTime = message.createdAt;

    // Update unread count for other participants
    conversation.participants.forEach((participantId) => {
      // participantId is guaranteed to be an ObjectId here since we didn't populate
      const id = participantId.toString();
      if (id !== userId) {
        conversation.incrementUnreadCount(id);
      }
    });

    await conversation.save();

    // Get socket service from request
    const socketService = req.socketService;

    if (socketService) {
      // Emit to conversation room (excluding sender)
      socketService.emitToConversation(
        conversation_id,
        "newMessage",
        {
          message: {
            _id: message._id,
            text: message.text,
            sender: message.sender,
            conversation: conversation_id,
            createdAt: message.createdAt,
            attachments: message.attachments,
            isRead: false,
          },
          conversation: {
            _id: conversation._id,
            lastMessageText: conversation.lastMessageText,
            lastMessageTime: conversation.lastMessageTime,
          },
        },
        userId
      );

      // Send notifications to offline users
      const offlineParticipants = conversation.participants.filter(
        (participantId) => {
          const id = participantId.toString();
          return id !== userId && !socketService.isUserConnected(id);
        }
      );

      for (const participantId of offlineParticipants) {
        await Notification.create({
          recipient: participantId,
          sender: userId,
          type: "message",
          message: `New message from ${req.user.username}: ${text.substring(
            0,
            50
          )}...`,
          conversation: conversation_id,
        });
      }
    }

    const responseData = {
      message: "Message sent successfully",
      sentMessage: {
        _id: message._id,
        text: message.text,
        sender: message.sender,
        conversation: conversation_id,
        createdAt: message.createdAt,
        attachments: message.attachments,
        isRead: true, // For sender
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Send message error:", err);
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

    // Verify user is participant
    const conversation = await Conversation.findOne({
      _id: conversation_id,
      participants: userId,
      isActive: true,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Mark all unread messages as read
    await Message.updateMany(
      {
        conversation: conversation_id,
        sender: { $ne: userId },
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } }
    );

    // Update conversation unread count
    conversation.resetUnreadCount(userId);
    await conversation.save();

    // Emit read receipt via socket
    const socketService = req.socketService;
    if (socketService) {
      socketService.emitToConversation(
        conversation_id,
        "messagesRead",
        {
          conversation_id,
          reader: userId,
          readAt: new Date(),
        },
        userId
      );
    }

    const responseData = {
      message: "Messages marked as read",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Mark as read error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get user status
// @route   POST /chat/status
// @access  Private
exports.getUserStatus = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const chatStatus = await ChatStatus.findOne({ user: user_id });

    const responseData = {
      message: "User status retrieved successfully",
      status: {
        isOnline: chatStatus?.isOnline || false,
        lastSeen: chatStatus?.lastSeen || new Date(),
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get user status error:", err);
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

    // Verify user is participant
    const conversation = await Conversation.findOne({
      _id: conversation_id,
      participants: userId,
      isActive: true,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Update typing status
    const chatStatus = await ChatStatus.findOne({ user: userId });
    if (chatStatus) {
      chatStatus.isTyping.set(conversation_id, !!is_typing);
      await chatStatus.save();
    }

    // Emit typing status via socket
    const socketService = req.socketService;
    if (socketService) {
      socketService.emitToConversation(
        conversation_id,
        "typingStatus",
        {
          conversation_id,
          user_id: userId,
          is_typing: !!is_typing,
          username: req.user.username,
        },
        userId
      );
    }

    const responseData = {
      message: "Typing status updated",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Set typing status error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get notifications
// @route   GET /chat/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find({
      recipient: userId,
    })
      .populate({
        path: "sender",
        select: "username email",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const responseData = {
      message: "Notifications retrieved successfully",
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: notifications.length === parseInt(limit),
      },
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Get notifications error:", err);
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

    let query = { recipient: userId };
    if (notification_ids && Array.isArray(notification_ids)) {
      query._id = { $in: notification_ids };
    }

    await Notification.updateMany(query, { isRead: true });

    const responseData = {
      message: "Notifications marked as read",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Mark notifications as read error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Search users for chat
// @route   POST /chat/search-users
// @access  Private
exports.searchUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { query, user_type } = req.body;

    if (!query || query.trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Search query must be at least 2 characters" });
    }

    // Build search criteria
    const searchCriteria = {
      _id: { $ne: userId }, // Exclude current user
      $or: [
        { username: { $regex: query.trim(), $options: "i" } },
        { email: { $regex: query.trim(), $options: "i" } },
      ],
    };

    if (user_type) {
      searchCriteria.user_type = user_type;
    }

    const users = await User.find(searchCriteria)
      .select("username email user_type")
      .limit(20)
      .lean();

    // Get online status for found users
    const userIds = users.map((user) => user._id);
    const chatStatuses = await ChatStatus.find({
      user: { $in: userIds },
    }).lean();

    const statusMap = {};
    chatStatuses.forEach((status) => {
      statusMap[status.user.toString()] = status;
    });

    // Format users with status
    const formattedUsers = users.map((user) => {
      const status = statusMap[user._id.toString()];
      return {
        _id: user._id,
        username: user.username,
        email: user.email,
        user_type: user.user_type,
        isOnline: status?.isOnline || false,
        lastSeen: status?.lastSeen || new Date(),
      };
    });

    const responseData = {
      message: "Users found",
      users: formattedUsers,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Search users error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
