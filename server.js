// server.js (updated with site builder routes)
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const initializeWebSocket = require("./websocket");
const notificationService = require("./utils/notificationService");

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const socketService = initializeWebSocket(server);

// Initialize notification service with socket service
notificationService.init(socketService);

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(cors());

// Serve static files from the 'uploads' directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Make socketService and notificationService available in the request object
app.use((req, res, next) => {
  req.socketService = socketService;
  req.notificationService = notificationService;
  next();
});

// Routes
app.use("/account", require("./routes/authRoutes"));
app.use("/account", require("./routes/contactSupportRoutes"));
app.use("/service", require("./routes/serviceRoutes"));
app.use("/profile", require("./routes/profileRoutes"));
app.use("/company", require("./routes/companyRoutes"));
app.use("/uploads/profile", require("./routes/profileUploadRoutes"));
app.use("/uploads/service", require("./routes/serviceUploadRoutes"));
app.use("/uploads/chat", require("./routes/chatUploadRoutes"));
app.use("/public", require("./routes/publicProfileRoutes"));
app.use("/public", require("./routes/publicStoreRoutes"));
app.use("/supplier", require("./routes/supplierRoutes"));
app.use("/supplier", require("./routes/settingsRoutes"));
app.use("/chat", require("./routes/chatRoutes"));
app.use("/client", require("./routes/clientRoutes"));
app.use("/admin", require("./routes/adminRoutes"));

// WebSocket status endpoint
app.get("/api/websocket-status", (req, res) => {
  const status = {
    connectedUsers: socketService.getConnectedUserCount(),
    usersList: socketService.getConnectedUsers().map((user) => ({
      userId: user.userId,
      username: user.username,
      userType: user.userType,
      connectedAt: user.connectedAt,
    })),
  };
  res.json(status);
});

// Chat status endpoint
app.get("/api/chat-status", (req, res) => {
  const status = {
    connectedUsers: socketService.getConnectedUserCount(),
    usersByType: {
      clients: socketService
        .getConnectedUsers()
        .filter((u) => u.userType === "client").length,
      suppliers: socketService
        .getConnectedUsers()
        .filter((u) => u.userType === "supplier").length,
      service_providers: socketService
        .getConnectedUsers()
        .filter((u) => u.userType === "service_provider").length,
    },
  };
  res.json(status);
});

// Notification test endpoint (for development/testing)
app.post("/api/test-notification", async (req, res) => {
  try {
    const { userId, type, title, message, data } = req.body;

    const result = await notificationService.sendNotification({
      recipient: userId,
      type: type || "info",
      title: title || "Test Notification",
      message: message || "This is a test notification",
      data: data || {},
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Default route
app.get("/", (req, res) => {
  res.send("Archixol API is running with Chat and Notification functionality");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Server Error" });
});

const PORT = process.env.PORT || 5000;

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server initialized`);
  console.log(`Notification service initialized`);
});

module.exports = { app, socketService, notificationService };
