// websocket.js
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");
const config = require("./config/config");
const User = require("./models/User");

// Map to track connected users
const connectedUsers = new Map();

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
  io.on("connection", (socket) => {
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

    // Log connection
    console.log(
      `User connected: ${username} (${userId}), Type: ${socket.user.user_type}`
    );

    // Emit the current list of connected users (to admins only)
    if (socket.user.user_type === "supplier") {
      io.to(socket.id).emit(
        "connectedUsers",
        Array.from(connectedUsers.values())
      );
    }

    // Broadcast to other users that someone has connected
    socket.broadcast.emit("userConnected", {
      userId,
      username,
      userType: socket.user.user_type,
    });

    // Listen for user-specific events
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
    socket.on("disconnect", () => {
      // Remove from connected users
      connectedUsers.delete(userId);

      console.log(`User disconnected: ${username} (${userId})`);

      // Broadcast disconnection to other users
      socket.broadcast.emit("userDisconnected", {
        userId,
        username,
      });
    });

    // Example of room functionality for user types
    const userTypeRoom = `${socket.user.user_type}s`;
    socket.join(userTypeRoom);

    // Join a personal room using their user ID
    socket.join(userId);
  });

  // Periodic logging of connected users count
  setInterval(() => {
    const count = connectedUsers.size;
    console.log(`Connected users: ${count}`);
    if (count > 0) {
      console.log(
        "Active users:",
        Array.from(connectedUsers.values()).map(
          (u) =>
            `${u.username} (${u.userId.substring(0, 6)}...) - Type: ${
              u.userType
            }`
        )
      );
    }
  }, 60000); // Log every minute

  // Expose methods to interact with socket.io from other parts of the application
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
    emitToUserType: (userType, event, data) => {
      io.to(`${userType}s`).emit(event, data);
    },
    emitToAll: (event, data) => {
      io.emit(event, data);
    },
  };
};

module.exports = initializeWebSocket;
