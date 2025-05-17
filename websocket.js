// websocket.js (updated)
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");
const config = require("./config/config");
const User = require("./models/User");
const ChatStatus = require("./models/ChatStatus");
const Conversation = require("./models/Conversation");

// Map to track connected users
const connectedUsers = new Map();

// Helper function to update user's online status in DB
const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    let chatStatus = await ChatStatus.findOne({ user: userId });

    if (!chatStatus) {
      chatStatus = new ChatStatus({
        user: userId,
        isOnline,
        lastSeen: new Date(),
      });
    } else {
      chatStatus.isOnline = isOnline;
      if (!isOnline) {
        chatStatus.lastSeen = new Date();
      }
    }

    await chatStatus.save();
    return chatStatus;
  } catch (error) {
    console.error(`Error updating online status for user ${userId}:`, error);
    return null;
  }
};

// Helper to get user's conversation participants
const getUserConversationParticipants = async (userId) => {
  try {
    const conversations = await Conversation.find({
      participants: userId,
      isActive: true,
    });

    // Extract all unique participant IDs except the user
    const participantIds = new Set();
    conversations.forEach((conversation) => {
      conversation.participants.forEach((participantId) => {
        const idStr = participantId.toString();
        if (idStr !== userId) {
          participantIds.add(idStr);
        }
      });
    });

    return Array.from(participantIds);
  } catch (error) {
    console.error(
      `Error getting conversation participants for user ${userId}:`,
      error
    );
    return [];
  }
};

// Initialize WebSocket server
const initializeWebSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication error: Token required"));
      }

      // Verify the token
      const decoded = jwt.verify(token, config.jwtSecret);

      // Find the user
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      // Attach user to socket
      socket.user = user;
      next();
    } catch (error) {
      console.error("Socket authentication error:", error.message);
      next(new Error("Authentication error: " + error.message));
    }
  });

  // Connection handler
  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();
    const username = socket.user.username;

    // Add user to connected users map
    connectedUsers.set(userId, {
      userId,
      username,
      socketId: socket.id,
      connectedAt: new Date(),
      userType: socket.user.user_type,
    });

    // Update user's online status in DB
    const chatStatus = await updateUserOnlineStatus(userId, true);

    // Log connection
    console.log(
      `User connected: ${username} (${userId}), Type: ${socket.user.user_type}`
    );

    // Notify user's conversation partners about online status
    const conversationPartners = await getUserConversationParticipants(userId);
    conversationPartners.forEach((partnerId) => {
      if (connectedUsers.has(partnerId)) {
        io.to(connectedUsers.get(partnerId).socketId).emit(
          "userStatusChanged",
          {
            user_id: userId,
            status: { isOnline: true, lastSeen: new Date() },
          }
        );
      }
    });

    // Join user's personal room for targeted messages
    socket.join(userId);

    // Join room for each conversation the user is part of
    try {
      const conversations = await Conversation.find({
        participants: userId,
        isActive: true,
      });

      conversations.forEach((conversation) => {
        socket.join(`conversation:${conversation._id}`);
      });
    } catch (error) {
      console.error(`Error joining conversation rooms for ${username}:`, error);
    }

    // CHAT-SPECIFIC EVENT HANDLERS

    // Handle typing status
    socket.on("typing", async (data) => {
      try {
        const { conversation_id, is_typing } = data;

        // Validate the conversation exists and user is a participant
        const conversation = await Conversation.findOne({
          _id: conversation_id,
          participants: userId,
          isActive: true,
        });

        if (!conversation) {
          return;
        }

        // Update typing status in DB
        const chatStatus = await ChatStatus.findOne({ user: userId });
        if (chatStatus) {
          chatStatus.isTyping.set(conversation_id, !!is_typing);
          await chatStatus.save();
        }

        // Broadcast to other participants in the conversation
        socket.to(`conversation:${conversation_id}`).emit("typingStatus", {
          conversation_id,
          user_id: userId,
          is_typing,
        });
      } catch (error) {
        console.error(`Error handling typing status for ${username}:`, error);
      }
    });

    // Handle read receipts
    socket.on("markRead", async (data) => {
      try {
        const { conversation_id } = data;

        // Validate the conversation exists and user is a participant
        const conversation = await Conversation.findOne({
          _id: conversation_id,
          participants: userId,
          isActive: true,
        });

        if (!conversation) {
          return;
        }

        // Broadcast to other participants in the conversation
        socket.to(`conversation:${conversation_id}`).emit("messagesRead", {
          conversation_id,
          reader: userId,
        });
      } catch (error) {
        console.error(`Error handling read receipt for ${username}:`, error);
      }
    });

    // Handle "user is viewing conversation" status
    socket.on("viewingConversation", async (data) => {
      try {
        const { conversation_id, is_viewing } = data;

        // Validate the conversation exists and user is a participant
        const conversation = await Conversation.findOne({
          _id: conversation_id,
          participants: userId,
          isActive: true,
        });

        if (!conversation) {
          return;
        }

        // If user starts viewing a conversation, join its room
        if (is_viewing) {
          socket.join(`conversation:${conversation_id}`);
        }

        // Broadcast to other participants in the conversation
        socket
          .to(`conversation:${conversation_id}`)
          .emit("conversationViewed", {
            conversation_id,
            user_id: userId,
            is_viewing,
          });
      } catch (error) {
        console.error(
          `Error handling conversation viewing for ${username}:`,
          error
        );
      }
    });

    // Ping/pong for connection testing
    socket.on("ping", (callback) => {
      if (typeof callback === "function") {
        callback({
          status: "success",
          message: "pong",
          timestamp: new Date(),
        });
      }
    });

    // Disconnect handler
    socket.on("disconnect", async () => {
      // Remove from connected users map
      connectedUsers.delete(userId);

      // Update online status in DB
      await updateUserOnlineStatus(userId, false);

      // Notify conversation partners about offline status
      const conversationPartners = await getUserConversationParticipants(
        userId
      );
      const currentTime = new Date();

      conversationPartners.forEach((partnerId) => {
        if (connectedUsers.has(partnerId)) {
          io.to(connectedUsers.get(partnerId).socketId).emit(
            "userStatusChanged",
            {
              user_id: userId,
              status: { isOnline: false, lastSeen: currentTime },
            }
          );
        }
      });

      console.log(`User disconnected: ${username} (${userId})`);
    });
  });

  // Periodic cleanup and status check (every 5 minutes)
  setInterval(async () => {
    const count = connectedUsers.size;
    console.log(`Active chat connections: ${count}`);

    // Check for stale connections (inactive for > 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    for (const [userId, userData] of connectedUsers.entries()) {
      const socket = io.sockets.sockets.get(userData.socketId);

      // If socket is no longer connected or connection is stale
      if (!socket || userData.connectedAt < thirtyMinutesAgo) {
        // Update user status in DB
        await updateUserOnlineStatus(userId, false);

        // Remove from our tracking map
        connectedUsers.delete(userId);

        console.log(
          `Cleaned up stale connection for user: ${userData.username}`
        );
      }
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Expose methods to interact with socket.io from other parts of the app
  return {
    io,
    getConnectedUsers: () => Array.from(connectedUsers.values()),
    isUserConnected: (userId) => connectedUsers.has(userId),
    getConnectedUserCount: () => connectedUsers.size,
    emitToUser: (userId, event, data) => {
      const userInfo = connectedUsers.get(userId);
      if (userInfo) {
        io.to(userInfo.socketId).emit(event, data);
        return true;
      }
      return false;
    },
    emitToConversation: (conversationId, event, data, excludeUserId = null) => {
      if (excludeUserId) {
        io.to(`conversation:${conversationId}`)
          .except(connectedUsers.get(excludeUserId)?.socketId)
          .emit(event, data);
      } else {
        io.to(`conversation:${conversationId}`).emit(event, data);
      }
    },
    emitToUserType: (userType, event, data) => {
      // Filter connected users by type and emit to them
      for (const [userId, userData] of connectedUsers.entries()) {
        if (userData.userType === userType) {
          io.to(userData.socketId).emit(event, data);
        }
      }
    },
    emitToAll: (event, data) => {
      io.emit(event, data);
    },
  };
};

module.exports = initializeWebSocket;
