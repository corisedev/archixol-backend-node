// scripts/fixConversationMaps.js - Comprehensive fix for Map key issues
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

const fixConversationMaps = async () => {
  try {
    console.log("Starting comprehensive conversation Map fix...");

    // Get all conversations
    const conversations = await Conversation.find({}).lean();
    console.log(`Found ${conversations.length} conversations to fix`);

    let fixed = 0;
    let errors = 0;

    for (const conv of conversations) {
      try {
        console.log(`Processing conversation ${conv._id}...`);

        // Create a clean unreadCount Map with proper string keys
        const cleanUnreadCount = new Map();

        // Ensure all participants have an entry in unreadCount
        conv.participants.forEach((participantId) => {
          const stringId = participantId.toString();

          // Check if there's an existing count for this participant
          let existingCount = 0;
          if (conv.unreadCount) {
            // Try to find existing count in various possible formats
            if (conv.unreadCount[stringId] !== undefined) {
              existingCount = conv.unreadCount[stringId];
            } else if (conv.unreadCount[participantId] !== undefined) {
              existingCount = conv.unreadCount[participantId];
            }
          }

          cleanUnreadCount.set(stringId, existingCount);
        });

        // Update the conversation with clean data
        await Conversation.updateOne(
          { _id: conv._id },
          {
            unreadCount: cleanUnreadCount,
            updatedAt: new Date(),
          }
        );

        console.log(`✅ Fixed conversation ${conv._id}`);
        fixed++;
      } catch (error) {
        console.error(
          `❌ Error fixing conversation ${conv._id}:`,
          error.message
        );
        errors++;
      }
    }

    console.log(`\n🎉 Fix completed:`);
    console.log(`- Successfully fixed: ${fixed} conversations`);
    console.log(`- Errors: ${errors} conversations`);

    if (errors === 0) {
      console.log(`✨ All conversations are now properly formatted!`);
    }

    // Disconnect from database
    mongoose.disconnect();
  } catch (error) {
    console.error("❌ Critical error during fix:", error);
    mongoose.disconnect();
    process.exit(1);
  }
};

// Alternative: Rebuild all conversation unreadCounts from scratch
const rebuildUnreadCounts = async () => {
  try {
    console.log("Rebuilding all unreadCounts from scratch...");

    const conversations = await Conversation.find({}).lean();
    console.log(`Rebuilding ${conversations.length} conversations...`);

    for (const conv of conversations) {
      try {
        // Create fresh unreadCount Map with all participants set to 0
        const freshUnreadCount = new Map();

        conv.participants.forEach((participantId) => {
          const stringId = participantId.toString();
          freshUnreadCount.set(stringId, 0);
        });

        await Conversation.updateOne(
          { _id: conv._id },
          {
            unreadCount: freshUnreadCount,
            updatedAt: new Date(),
          }
        );

        console.log(`✅ Rebuilt conversation ${conv._id}`);
      } catch (error) {
        console.error(
          `❌ Error rebuilding conversation ${conv._id}:`,
          error.message
        );
      }
    }

    console.log("🎉 Rebuild completed!");
    mongoose.disconnect();
  } catch (error) {
    console.error("❌ Critical error during rebuild:", error);
    mongoose.disconnect();
    process.exit(1);
  }
};

// Validate all conversations after fix
const validateConversations = async () => {
  try {
    console.log("Validating all conversations...");

    const conversations = await Conversation.find({});
    let validCount = 0;
    let invalidCount = 0;

    for (const conv of conversations) {
      try {
        // Try to access the unreadCount Map safely
        if (conv.unreadCount && typeof conv.unreadCount.get === "function") {
          // Check if all participants have valid entries
          let allParticipantsValid = true;

          for (const participantId of conv.participants) {
            const stringId = participantId.toString();
            const count = conv.unreadCount.get(stringId);

            if (count === undefined) {
              console.log(
                `⚠️  Missing unreadCount for participant ${stringId} in conversation ${conv._id}`
              );
              allParticipantsValid = false;
            }
          }

          if (allParticipantsValid) {
            validCount++;
          } else {
            invalidCount++;
          }
        } else {
          console.log(
            `❌ Invalid unreadCount format in conversation ${conv._id}`
          );
          invalidCount++;
        }
      } catch (error) {
        console.error(
          `❌ Validation error for conversation ${conv._id}:`,
          error.message
        );
        invalidCount++;
      }
    }

    console.log(`\n📊 Validation Results:`);
    console.log(`- Valid conversations: ${validCount}`);
    console.log(`- Invalid conversations: ${invalidCount}`);

    if (invalidCount === 0) {
      console.log(`✨ All conversations are valid!`);
    } else {
      console.log(`⚠️  Some conversations need attention.`);
    }

    mongoose.disconnect();
  } catch (error) {
    console.error("❌ Validation error:", error);
    mongoose.disconnect();
    process.exit(1);
  }
};

// Run based on command line argument
const command = process.argv[2] || "fix";

switch (command) {
  case "fix":
    console.log("🔧 Running comprehensive fix...");
    fixConversationMaps();
    break;
  case "rebuild":
    console.log("🔨 Rebuilding all unreadCounts...");
    rebuildUnreadCounts();
    break;
  case "validate":
    console.log("🔍 Validating conversations...");
    validateConversations();
    break;
  default:
    console.log("Usage:");
    console.log("node scripts/fixConversationMaps.js [fix|rebuild|validate]");
    console.log("");
    console.log("Commands:");
    console.log(
      "  fix     - Fix existing unreadCount Maps (preserves existing counts)"
    );
    console.log(
      "  rebuild - Rebuild all unreadCounts from scratch (resets to 0)"
    );
    console.log("  validate - Validate all conversations");
    mongoose.disconnect();
}

// Usage examples:
// node scripts/fixConversationMaps.js fix      - Fix existing data
// node scripts/fixConversationMaps.js rebuild  - Reset all unread counts
// node scripts/fixConversationMaps.js validate - Check if all conversations are valid
