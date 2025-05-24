// scripts/fixUnreadCount.js - Run this once to fix existing conversations
const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Connect to the database
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.error(`Database Connection Error: ${err.message}`);
    process.exit(1);
  });

const fixUnreadCounts = async () => {
  try {
    console.log("Starting unreadCount migration...");

    // Get all conversations
    const conversations = await Conversation.find({});
    console.log(`Found ${conversations.length} conversations to check`);

    let fixed = 0;
    let skipped = 0;

    for (const conversation of conversations) {
      try {
        // Check if unreadCount needs fixing
        if (
          !conversation.unreadCount ||
          typeof conversation.unreadCount.set !== "function"
        ) {
          console.log(`Fixing conversation ${conversation._id}`);

          // Initialize unreadCount as Map for all participants
          const newUnreadCount = new Map();

          // Set unread count to 0 for all participants
          conversation.participants.forEach((participantId) => {
            newUnreadCount.set(participantId.toString(), 0);
          });

          // Update the conversation
          await Conversation.updateOne(
            { _id: conversation._id },
            { unreadCount: newUnreadCount }
          );

          fixed++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Error fixing conversation ${conversation._id}:`, error);
      }
    }

    console.log(`Migration completed:`);
    console.log(`- Fixed: ${fixed} conversations`);
    console.log(`- Skipped: ${skipped} conversations`);

    // Disconnect from database
    mongoose.disconnect();
  } catch (error) {
    console.error("Migration error:", error);
    mongoose.disconnect();
    process.exit(1);
  }
};

// Alternative: Update Conversation model to handle this automatically
const updateConversationSchema = async () => {
  try {
    console.log("Updating all conversations with proper unreadCount format...");

    // Update all conversations to ensure unreadCount is properly formatted
    const conversations = await Conversation.find({});

    for (const conv of conversations) {
      // Save each conversation to trigger the pre-save hook
      await conv.save();
    }

    console.log("All conversations updated successfully");
    mongoose.disconnect();
  } catch (error) {
    console.error("Error updating conversations:", error);
    mongoose.disconnect();
    process.exit(1);
  }
};

// Run the migration
if (process.argv[2] === "schema") {
  updateConversationSchema();
} else {
  fixUnreadCounts();
}

// Usage:
// node scripts/fixUnreadCount.js        - Fix unread counts
// node scripts/fixUnreadCount.js schema - Update schema
