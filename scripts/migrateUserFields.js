// scripts/migrateUserFields.js
// Run this script once to update existing users with new fields

const mongoose = require("mongoose");
const User = require("../models/User");
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

const migrateUsers = async () => {
  try {
    console.log("Starting user migration...");

    // Get all users that don't have the new fields
    const users = await User.find({
      $or: [
        { firstLogin: { $exists: false } },
        { accessRoles: { $exists: false } },
      ],
    });

    console.log(`Found ${users.length} users to migrate`);

    let migratedCount = 0;

    for (const user of users) {
      let needsUpdate = false;
      const updateData = {};

      // Add firstLogin field if missing
      if (user.firstLogin === undefined) {
        updateData.firstLogin = false;
        needsUpdate = true;
      }

      // Add accessRoles field if missing
      if (!user.accessRoles || user.accessRoles.length === 0) {
        // Set accessRoles based on user_type and add client as default
        const roles = ["client"];

        // Add the user's primary type if it's not client
        if (
          user.user_type &&
          user.user_type !== "client" &&
          !roles.includes(user.user_type)
        ) {
          roles.push(user.user_type);
        }

        updateData.accessRoles = roles;
        needsUpdate = true;
      }

      // Update user if needed
      if (needsUpdate) {
        await User.findByIdAndUpdate(user._id, updateData);
        migratedCount++;
        console.log(`✅ Updated user: ${user.username} (${user.email})`);
        console.log(
          `   - firstLogin: ${
            updateData.firstLogin !== undefined
              ? updateData.firstLogin
              : "already set"
          }`
        );
        console.log(
          `   - accessRoles: ${
            updateData.accessRoles
              ? updateData.accessRoles.join(", ")
              : "already set"
          }`
        );
      }
    }

    console.log(`\n🎉 Migration completed!`);
    console.log(`- Total users checked: ${users.length}`);
    console.log(`- Users migrated: ${migratedCount}`);
    console.log(`- Users already up to date: ${users.length - migratedCount}`);

    // Verify migration
    const verifyUsers = await User.find({})
      .select("username email firstLogin accessRoles user_type")
      .limit(5);
    console.log(`\n📋 Sample of migrated users:`);
    verifyUsers.forEach((user) => {
      console.log(
        `   ${user.username}: firstLogin=${
          user.firstLogin
        }, accessRoles=[${user.accessRoles.join(", ")}], user_type=${
          user.user_type
        }`
      );
    });

    mongoose.disconnect();
  } catch (error) {
    console.error("❌ Migration error:", error);
    mongoose.disconnect();
    process.exit(1);
  }
};

// Run the migration
migrateUsers();

// Usage: node scripts/migrateUserFields.js
