// scripts/createTestUsers.js
const mongoose = require("mongoose");
const User = require("../models/User");
const ChatStatus = require("../models/ChatStatus");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Connect to the database
mongoose
  .connect(
    process.env.MONGO_URI ||
      "mongodb+srv://archixol:8B8k7Fr7jMDM4FkL@cluster0.8mznnpg.mongodb.net/archixol?retryWrites=true&w=majority&appName=Cluster0",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.error(`Database Connection Error: ${err.message}`);
    process.exit(1);
  });

// Test users to create (one of each type)
const testUsers = [
  {
    username: "test_client",
    email: "client@test.com",
    password: "password123",
    user_type: "client",
    agree_terms: true,
    isEmailVerified: true,
  },
  {
    username: "test_supplier",
    email: "supplier@test.com",
    password: "password123",
    accessRoles: "supplier",
    agree_terms: true,
    isEmailVerified: true,
  },
  {
    username: "test_serviceprovider",
    email: "serviceprovider@test.com",
    password: "password123",
    accessRoles: "service_provider",
    agree_terms: true,
    isEmailVerified: true,
  },
];

// Create test users
const createUsers = async () => {
  try {
    console.log("Creating test users...");

    // Delete existing test users if they exist
    for (const userData of testUsers) {
      await User.deleteOne({ email: userData.email });
      console.log(`Deleted existing user with email: ${userData.email}`);
    }

    // Create new test users
    const createdUsers = [];

    for (const userData of testUsers) {
      const user = new User(userData);
      await user.save();
      console.log(`Created user: ${user.username} (${user.user_type})`);

      // Create chat status for user
      const chatStatus = new ChatStatus({
        user: user._id,
        isOnline: false,
        lastSeen: new Date(),
      });
      await chatStatus.save();
      console.log(`Created chat status for: ${user.username}`);

      createdUsers.push(user);
    }

    console.log("\n--- Test Users Created ---");
    createdUsers.forEach((user) => {
      console.log(`Username: ${user.username}`);
      console.log(`Email: ${user.email}`);
      console.log(`Password: password123`);
      console.log(`User Type: ${user.user_type}`);
      console.log(`ID: ${user._id}`);
      console.log("---------------------------");
    });

    console.log("\nTest users created successfully!");
    console.log(
      "You can now run the test client and log in with these credentials."
    );

    // Disconnect from database
    mongoose.disconnect();
  } catch (error) {
    console.error("Error creating test users:", error);
    mongoose.disconnect();
    process.exit(1);
  }
};

// Run the function
createUsers();
