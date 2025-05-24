// websocket.js (Complete Updated Version)
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

// Helper to get user's conversation participants (keep the original function too)
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

// Helper to sync all conversation partners' status for a newly connected user
const syncConversationPartnersStatus = async (socket, userId) => {
  try {
    // Get all conversations for this user with participant details
    const conversations = await Conversation.find({
      participants: userId,
      isActive: true,
    }).populate({
      path: "participants",
      select: "username email user_type",
      match: { _id: { $ne: userId } }, // Exclude the current user
    });

    // Get chat statuses for all conversation partners
    const allPartnerIds = [];
    conversations.forEach((conv) => {
      conv.participants.forEach((participant) => {
        if (!allPartnerIds.includes(participant._id.toString())) {
          allPartnerIds.push(participant._id.toString());
        }
      });
    });

    const chatStatuses = await ChatStatus.find({
      user: { $in: allPartnerIds },
    });

    const statusMap = {};
    chatStatuses.forEach((status) => {
      statusMap[status.user.toString()] = status;
    });

    // Send status for each conversation partner
    conversations.forEach((conv) => {
      conv.participants.forEach((participant) => {
        const partnerId = participant._id.toString();
        const isOnline = connectedUsers.has(partnerId);
        const chatStatus = statusMap[partnerId];

        socket.emit("userStatusChanged", {
          user_id: partnerId,
          username: participant.username,
          status: {
            isOnline: isOnline,
            lastSeen: isOnline
              ? new Date()
              : chatStatus?.lastSeen || new Date(),
          },
        });
      });
    });

    console.log(
      `Synced status for ${allPartnerIds.length} conversation partners for user ${userId}`
    );
  } catch (error) {
    console.error(
      `Error syncing conversation partners status for user ${userId}:`,
      error
    );
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
      socket: socket,
      connectedAt: new Date(),
      userType: socket.user.user_type,
    });

    // Update user's online status in DB
    const chatStatus = await updateUserOnlineStatus(userId, true);

    // Log connection
    console.log(
      `User connected: ${username} (${userId}), Type: ${socket.user.user_type}`
    );

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
        console.log(
          `User ${username} joined conversation: ${conversation._id}`
        );
      });
    } catch (error) {
      console.error(`Error joining conversation rooms for ${username}:`, error);
    }

    // Notify user's conversation partners about online status
    const conversationPartners = await getUserConversationParticipants(userId);
    conversationPartners.forEach((partnerId) => {
      if (connectedUsers.has(partnerId)) {
        const partnerSocket = connectedUsers.get(partnerId).socket;
        partnerSocket.emit("userStatusChanged", {
          user_id: userId,
          username: username,
          status: {
            isOnline: true,
            lastSeen: new Date(),
          },
        });
      }
    });

    // IMPORTANT: Sync all conversation partners' current status to the newly connected user
    await syncConversationPartnersStatus(socket, userId);

    // CHAT-SPECIFIC EVENT HANDLERS

    // Handle typing status
    socket.on("typing", async (data) => {
      try {
        const { conversation_id, is_typing } = data;

        console.log(`Typing event from ${username}:`, {
          conversation_id,
          is_typing,
        });

        // Validate the conversation exists and user is a participant
        const conversation = await Conversation.findOne({
          _id: conversation_id,
          participants: userId,
          isActive: true,
        });

        if (!conversation) {
          console.log(`Invalid conversation for typing: ${conversation_id}`);
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
          username: username,
          is_typing: !!is_typing,
        });

        console.log(
          `Broadcast typing status to conversation:${conversation_id}`,
          {
            user_id: userId,
            is_typing: !!is_typing,
          }
        );
      } catch (error) {
        console.error(`Error handling typing status for ${username}:`, error);
      }
    });

    // Handle read receipts
    socket.on("markRead", async (data) => {
      try {
        const { conversation_id } = data;

        console.log(`Mark read event from ${username}:`, { conversation_id });

        // Validate the conversation exists and user is a participant
        const conversation = await Conversation.findOne({
          _id: conversation_id,
          participants: userId,
          isActive: true,
        });

        if (!conversation) {
          console.log(`Invalid conversation for mark read: ${conversation_id}`);
          return;
        }

        // Broadcast to other participants in the conversation
        socket.to(`conversation:${conversation_id}`).emit("messagesRead", {
          conversation_id,
          reader: userId,
          username: username,
          readAt: new Date(),
        });

        console.log(
          `Broadcast messages read to conversation:${conversation_id}`
        );
      } catch (error) {
        console.error(`Error handling read receipt for ${username}:`, error);
      }
    });

    // Handle "user is viewing conversation" status
    socket.on("viewingConversation", async (data) => {
      try {
        const { conversation_id, is_viewing } = data;

        console.log(`Viewing conversation event from ${username}:`, {
          conversation_id,
          is_viewing,
        });

        // Validate the conversation exists and user is a participant
        const conversation = await Conversation.findOne({
          _id: conversation_id,
          participants: userId,
          isActive: true,
        });

        if (!conversation) {
          console.log(`Invalid conversation for viewing: ${conversation_id}`);
          return;
        }

        // If user starts viewing a conversation, join its room
        if (is_viewing) {
          socket.join(`conversation:${conversation_id}`);
          console.log(
            `User ${username} joined conversation room: ${conversation_id}`
          );
        }

        // Broadcast to other participants in the conversation
        socket
          .to(`conversation:${conversation_id}`)
          .emit("conversationViewed", {
            conversation_id,
            user_id: userId,
            username: username,
            is_viewing,
          });
      } catch (error) {
        console.error(
          `Error handling conversation viewing for ${username}:`,
          error
        );
      }
    });

    // Handle joining conversation room explicitly
    socket.on("joinConversation", async (data) => {
      try {
        const { conversation_id } = data;

        console.log(`Join conversation event from ${username}:`, {
          conversation_id,
        });

        // Validate the conversation exists and user is a participant
        const conversation = await Conversation.findOne({
          _id: conversation_id,
          participants: userId,
          isActive: true,
        });

        if (!conversation) {
          console.log(`Invalid conversation to join: ${conversation_id}`);
          socket.emit("error", { message: "Conversation not found" });
          return;
        }

        // Join the conversation room
        socket.join(`conversation:${conversation_id}`);
        console.log(
          `User ${username} explicitly joined conversation: ${conversation_id}`
        );

        // Confirm joining
        socket.emit("conversationJoined", {
          conversation_id,
          message: "Successfully joined conversation",
        });
      } catch (error) {
        console.error(`Error joining conversation for ${username}:`, error);
        socket.emit("error", { message: "Failed to join conversation" });
      }
    });

    // Ping/pong for connection testing
    socket.on("ping", (callback) => {
      console.log(`Ping received from ${username}`);
      if (typeof callback === "function") {
        callback({
          status: "success",
          message: "pong",
          timestamp: new Date(),
          userId: userId,
        });
      }
    });

    // Handle manual disconnect
    socket.on("manualDisconnect", () => {
      console.log(`Manual disconnect requested by ${username}`);
      socket.disconnect();
    });

    // Handle status sync request
    socket.on("syncStatus", async () => {
      console.log(`Status sync requested by ${username}`);
      await syncConversationPartnersStatus(socket, userId);
      socket.emit("statusSynced", {
        message: "Status sync completed",
        timestamp: new Date(),
      });
    });

    // Handle request for specific user status
    socket.on("getUserStatus", async (data) => {
      try {
        const { user_id } = data;

        if (!user_id) {
          socket.emit("error", { message: "User ID required" });
          return;
        }

        const isOnline = connectedUsers.has(user_id);
        let lastSeen = new Date();
        let username = "Unknown User";

        if (!isOnline) {
          // Get last seen from database
          const chatStatus = await ChatStatus.findOne({ user: user_id });
          if (chatStatus) {
            lastSeen = chatStatus.lastSeen;
          }
        }

        // Get username
        const User = require("./models/User");
        const user = await User.findById(user_id).select("username");
        if (user) {
          username = user.username;
        }

        socket.emit("userStatus", {
          user_id: user_id,
          username: username,
          status: {
            isOnline: isOnline,
            lastSeen: lastSeen,
          },
        });
      } catch (error) {
        console.error(`Error getting user status for ${username}:`, error);
        socket.emit("error", { message: "Failed to get user status" });
      }
    });

    // Disconnect handler
    socket.on("disconnect", async (reason) => {
      console.log(
        `User disconnected: ${username} (${userId}) - Reason: ${reason}`
      );

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
          const partnerSocket = connectedUsers.get(partnerId).socket;
          partnerSocket.emit("userStatusChanged", {
            user_id: userId,
            username: username,
            status: {
              isOnline: false,
              lastSeen: currentTime,
            },
          });
        }
      });
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
      if (userInfo && userInfo.socket) {
        userInfo.socket.emit(event, data);
        console.log(`Emitted ${event} to user ${userId}:`, data);
        return true;
      }
      console.log(`User ${userId} not connected for event ${event}`);
      return false;
    },

    emitToConversation: (conversationId, event, data, excludeUserId = null) => {
      console.log(`Emitting ${event} to conversation:${conversationId}`, data);

      if (excludeUserId) {
        const excludeUserInfo = connectedUsers.get(excludeUserId);
        if (excludeUserInfo) {
          io.to(`conversation:${conversationId}`)
            .except(excludeUserInfo.socketId)
            .emit(event, data);
        } else {
          io.to(`conversation:${conversationId}`).emit(event, data);
        }
      } else {
        io.to(`conversation:${conversationId}`).emit(event, data);
      }

      // Log which users received the event
      const roomSockets = io.sockets.adapter.rooms.get(
        `conversation:${conversationId}`
      );
      if (roomSockets) {
        console.log(
          `Event ${event} sent to ${roomSockets.size} users in conversation:${conversationId}`
        );
      }
    },

    emitToUserType: (userType, event, data) => {
      // Filter connected users by type and emit to them
      let count = 0;
      for (const [userId, userData] of connectedUsers.entries()) {
        if (userData.userType === userType && userData.socket) {
          userData.socket.emit(event, data);
          count++;
        }
      }
      console.log(`Emitted ${event} to ${count} users of type ${userType}`);
    },

    emitToAll: (event, data) => {
      io.emit(event, data);
      console.log(`Broadcast ${event} to all users:`, data);
    },

    // Helper method to get conversation room info
    getConversationRoomInfo: (conversationId) => {
      const roomSockets = io.sockets.adapter.rooms.get(
        `conversation:${conversationId}`
      );
      return {
        conversationId,
        connectedUsers: roomSockets ? roomSockets.size : 0,
        socketIds: roomSockets ? Array.from(roomSockets) : [],
      };
    },

    // Helper method to force join a user to a conversation
    forceJoinConversation: (userId, conversationId) => {
      const userInfo = connectedUsers.get(userId);
      if (userInfo && userInfo.socket) {
        userInfo.socket.join(`conversation:${conversationId}`);
        console.log(
          `Force joined user ${userId} to conversation:${conversationId}`
        );
        return true;
      }
      return false;
    },

    // Helper method to get all rooms a user is in
    getUserRooms: (userId) => {
      const userInfo = connectedUsers.get(userId);
      if (userInfo && userInfo.socket) {
        return Array.from(userInfo.socket.rooms);
      }
      return [];
    },

    // Helper method to get users in a conversation
    getConversationUsers: (conversationId) => {
      const roomSockets = io.sockets.adapter.rooms.get(
        `conversation:${conversationId}`
      );
      if (!roomSockets) return [];

      const users = [];
      for (const socketId of roomSockets) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket && socket.user) {
          users.push({
            userId: socket.user._id.toString(),
            username: socket.user.username,
            userType: socket.user.user_type,
            socketId: socketId,
          });
        }
      }
      return users;
    },

    // Helper method to broadcast to all users except one
    broadcastToAllExcept: (excludeUserId, event, data) => {
      const excludeUserInfo = connectedUsers.get(excludeUserId);
      if (excludeUserInfo) {
        io.except(excludeUserInfo.socketId).emit(event, data);
      } else {
        io.emit(event, data);
      }
      console.log(`Broadcast ${event} to all users except ${excludeUserId}`);
    },

    // Helper method to check if a conversation has active users
    isConversationActive: (conversationId) => {
      const roomSockets = io.sockets.adapter.rooms.get(
        `conversation:${conversationId}`
      );
      return roomSockets && roomSockets.size > 0;
    },

    // Helper method to get socket by user ID
    getSocketByUserId: (userId) => {
      const userInfo = connectedUsers.get(userId);
      return userInfo ? userInfo.socket : null;
    },

    // Helper method to disconnect a user
    disconnectUser: (userId, reason = "Server disconnect") => {
      const userInfo = connectedUsers.get(userId);
      if (userInfo && userInfo.socket) {
        userInfo.socket.disconnect(reason);
        console.log(`Disconnected user ${userId}: ${reason}`);
        return true;
      }
      return false;
    },
  };
};

module.exports = initializeWebSocket;
