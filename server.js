const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(cors());

// Serve static files from the 'uploads' directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/account", require("./routes/authRoutes"));
app.use("/account", require("./routes/contactSupportRoutes"));
app.use("/service", require("./routes/serviceRoutes"));
app.use("/profile", require("./routes/profileRoutes"));
app.use("/company", require("./routes/companyRoutes"));
app.use("/uploads/profile", require("./routes/profileUploadRoutes"));
app.use("/uploads/service", require("./routes/serviceUploadRoutes"));
app.use("/public", require("./routes/publicProfileRoutes"));
app.use("/supplier", require("./routes/supplierRoutes"));
app.use("/supplier", require("./routes/settingsRoutes"));

// Default route
app.get("/", (req, res) => {
  res.send("Archixol API is running");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Server Error" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
