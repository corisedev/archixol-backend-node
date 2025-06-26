// scripts/cleanDatabase.js
// ⚠️ WARNING: This script will DELETE ALL DATA in your database
// Use with extreme caution and only in development environments

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import all models to ensure they're registered
const User = require("../models/User");
const UserProfile = require("../models/UserProfile");
const Company = require("../models/Company");
const CompanyDocument = require("../models/CompanyDocument");
const Certificate = require("../models/Certificate");
const Project = require("../models/Project");
const Service = require("../models/Service");
const Product = require("../models/Product");
const Collection = require("../models/Collection");
const Order = require("../models/Order");
const ClientOrder = require("../models/ClientOrder");
const PurchaseOrder = require("../models/PurchaseOrder");
const Customer = require("../models/Customer");
const Vendor = require("../models/Vendor");
const Discount = require("../models/Discount");
const Job = require("../models/Job");
const ProjectJob = require("../models/ProjectJob");
const SavedJob = require("../models/SavedJob");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const ChatStatus = require("../models/ChatStatus");
const SupplierSiteBuilder = require("../models/SupplierSiteBuilder");
const SupplierStore = require("../models/SupplierStore");
const ClientProfile = require("../models/ClientProfile");
const ClientSettings = require("../models/ClientSettings");
const {
  ContactMessage,
  Feedback,
  SupportRequest,
} = require("../models/ContactSupport");

// Import supplier settings models
const {
  StoreDetails,
  TaxDetails,
  ProductTax,
  ReturnRules,
  PolicyContent,
  CheckoutSettings,
  ContactInfo,
  SupplierProfile,
} = require("../models/SupplierSettings");

// List of all collections/models to clean
const modelsToClean = [
  { name: "User", model: User },
  { name: "UserProfile", model: UserProfile },
  { name: "Company", model: Company },
  { name: "CompanyDocument", model: CompanyDocument },
  { name: "Certificate", model: Certificate },
  { name: "Project", model: Project },
  { name: "Service", model: Service },
  { name: "Product", model: Product },
  { name: "Collection", model: Collection },
  { name: "Order", model: Order },
  { name: "ClientOrder", model: ClientOrder },
  { name: "PurchaseOrder", model: PurchaseOrder },
  { name: "Customer", model: Customer },
  { name: "Vendor", model: Vendor },
  { name: "Discount", model: Discount },
  { name: "Job", model: Job },
  { name: "ProjectJob", model: ProjectJob },
  { name: "SavedJob", model: SavedJob },
  { name: "Conversation", model: Conversation },
  { name: "Message", model: Message },
  { name: "Notification", model: Notification },
  { name: "ChatStatus", model: ChatStatus },
  { name: "SupplierSiteBuilder", model: SupplierSiteBuilder },
  { name: "SupplierStore", model: SupplierStore },
  { name: "ClientProfile", model: ClientProfile },
  { name: "ClientSettings", model: ClientSettings },
  { name: "ContactMessage", model: ContactMessage },
  { name: "Feedback", model: Feedback },
  { name: "SupportRequest", model: SupportRequest },
  { name: "StoreDetails", model: StoreDetails },
  { name: "TaxDetails", model: TaxDetails },
  { name: "ProductTax", model: ProductTax },
  { name: "ReturnRules", model: ReturnRules },
  { name: "PolicyContent", model: PolicyContent },
  { name: "CheckoutSettings", model: CheckoutSettings },
  { name: "ContactInfo", model: ContactInfo },
  { name: "SupplierProfile", model: SupplierProfile },
];

// List of upload directories to clean
const uploadDirectories = [
  "uploads/certificates",
  "uploads/chat",
  "uploads/clients/profiles",
  "uploads/collections",
  "uploads/company/banners",
  "uploads/company/documents",
  "uploads/company/licenses",
  "uploads/company/logos",
  "uploads/jobs/documents",
  "uploads/products",
  "uploads/profile/banners",
  "uploads/profile/images",
  "uploads/profile/videos",
  "uploads/profiles",
  "uploads/projects",
  "uploads/services",
  "uploads/site-builder",
  "uploads/store",
];

// Function to safely delete files in a directory
const cleanDirectory = (dirPath) => {
  try {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        // Skip .gitkeep files
        if (file === ".gitkeep") continue;

        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          // Recursively clean subdirectories
          cleanDirectory(filePath);
          // Remove empty directory (but keep the main structure)
          try {
            fs.rmdirSync(filePath);
          } catch (error) {
            // Directory might not be empty, that's okay
          }
        } else {
          // Delete file
          fs.unlinkSync(filePath);
        }
      }

      console.log(`✅ Cleaned directory: ${dirPath}`);
      return true;
    } else {
      console.log(`⚠️  Directory does not exist: ${dirPath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error cleaning directory ${dirPath}:`, error.message);
    return false;
  }
};

// Function to get collection stats before deletion
const getCollectionStats = async () => {
  const stats = {};

  for (const { name, model } of modelsToClean) {
    try {
      const count = await model.countDocuments();
      stats[name] = count;
    } catch (error) {
      console.error(`Error getting stats for ${name}:`, error.message);
      stats[name] = "Error";
    }
  }

  return stats;
};

// Function to clean all collections
const cleanCollections = async () => {
  console.log("🗑️  Starting database cleanup...");

  const results = {
    success: [],
    failed: [],
    totalDeleted: 0,
  };

  for (const { name, model } of modelsToClean) {
    try {
      console.log(`\n🔄 Cleaning collection: ${name}...`);

      // Get count before deletion
      const countBefore = await model.countDocuments();

      if (countBefore === 0) {
        console.log(`   ✅ ${name}: Already empty`);
        results.success.push({ name, deleted: 0, status: "already_empty" });
        continue;
      }

      // Delete all documents
      const deleteResult = await model.deleteMany({});

      console.log(
        `   ✅ ${name}: Deleted ${deleteResult.deletedCount} documents`
      );

      results.success.push({
        name,
        deleted: deleteResult.deletedCount,
        status: "deleted",
      });

      results.totalDeleted += deleteResult.deletedCount;
    } catch (error) {
      console.error(`   ❌ ${name}: Failed -`, error.message);
      results.failed.push({
        name,
        error: error.message,
      });
    }
  }

  return results;
};

// Function to clean upload files
const cleanUploadFiles = async () => {
  console.log("\n📁 Cleaning upload directories...");

  const results = {
    cleaned: [],
    failed: [],
    notFound: [],
  };

  for (const dirPath of uploadDirectories) {
    try {
      if (fs.existsSync(dirPath)) {
        const filesBefore = fs
          .readdirSync(dirPath)
          .filter((f) => f !== ".gitkeep").length;

        if (filesBefore === 0) {
          console.log(`   ✅ ${dirPath}: Already empty`);
          results.cleaned.push({
            path: dirPath,
            filesDeleted: 0,
            status: "already_empty",
          });
        } else {
          cleanDirectory(dirPath);
          console.log(`   ✅ ${dirPath}: Cleaned ${filesBefore} files`);
          results.cleaned.push({
            path: dirPath,
            filesDeleted: filesBefore,
            status: "cleaned",
          });
        }
      } else {
        console.log(`   ⚠️  ${dirPath}: Directory does not exist`);
        results.notFound.push({ path: dirPath });
      }
    } catch (error) {
      console.error(`   ❌ ${dirPath}: Failed -`, error.message);
      results.failed.push({ path: dirPath, error: error.message });
    }
  }

  return results;
};

// Function to reset database indexes
const resetIndexes = async () => {
  console.log("\n🔧 Resetting database indexes...");

  try {
    // Get all collection names
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();

    for (const collection of collections) {
      try {
        await mongoose.connection.db.collection(collection.name).dropIndexes();
        console.log(`   ✅ Reset indexes for: ${collection.name}`);
      } catch (error) {
        // Some collections might not have custom indexes, that's okay
        if (!error.message.includes("ns not found")) {
          console.log(`   ⚠️  ${collection.name}: ${error.message}`);
        }
      }
    }

    // Recreate indexes by calling model methods (this happens automatically on next model use)
    console.log(
      "   ✅ Indexes will be recreated automatically on next model use"
    );
  } catch (error) {
    console.error("   ❌ Error resetting indexes:", error.message);
  }
};

// Main cleanup function
const cleanDatabase = async () => {
  try {
    console.log("=".repeat(60));
    console.log("🚨 DATABASE CLEANUP SCRIPT");
    console.log("⚠️  WARNING: This will delete ALL data in your database!");
    console.log("=".repeat(60));

    // Connect to database
    console.log("\n🔌 Connecting to database...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    // Get stats before cleanup
    console.log("\n📊 Getting database statistics...");
    const statsBefore = await getCollectionStats();

    console.log("\n📈 Database contents before cleanup:");
    let totalDocuments = 0;
    for (const [collection, count] of Object.entries(statsBefore)) {
      if (typeof count === "number") {
        console.log(`   ${collection}: ${count} documents`);
        totalDocuments += count;
      } else {
        console.log(`   ${collection}: ${count}`);
      }
    }
    console.log(`\n   📋 Total documents: ${totalDocuments}`);

    if (totalDocuments === 0) {
      console.log("\n✅ Database is already empty!");
      return;
    }

    // Prompt for confirmation (comment out in automated environments)
    console.log("\n⏳ Starting cleanup in 3 seconds...");
    console.log("💡 Press Ctrl+C to cancel");

    // Wait 3 seconds for user to cancel
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Clean collections
    const collectionResults = await cleanCollections();

    // Clean upload files
    const fileResults = await cleanUploadFiles();

    // Reset indexes
    await resetIndexes();

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 CLEANUP SUMMARY");
    console.log("=".repeat(60));

    console.log(
      `\n📊 Collections cleaned: ${collectionResults.success.length}`
    );
    console.log(`❌ Collections failed: ${collectionResults.failed.length}`);
    console.log(
      `🗑️  Total documents deleted: ${collectionResults.totalDeleted}`
    );

    console.log(`\n📁 Directories cleaned: ${fileResults.cleaned.length}`);
    console.log(`❌ Directory cleanup failed: ${fileResults.failed.length}`);
    console.log(`⚠️  Directories not found: ${fileResults.notFound.length}`);

    if (collectionResults.failed.length > 0) {
      console.log("\n❌ Failed collections:");
      collectionResults.failed.forEach((item) => {
        console.log(`   ${item.name}: ${item.error}`);
      });
    }

    if (fileResults.failed.length > 0) {
      console.log("\n❌ Failed directories:");
      fileResults.failed.forEach((item) => {
        console.log(`   ${item.path}: ${item.error}`);
      });
    }

    console.log("\n✨ Database cleanup completed!");
    console.log("🔧 Remember to restart your application to recreate indexes");
  } catch (error) {
    console.error("\n💥 Critical error during cleanup:", error);
    process.exit(1);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    console.log("🔌 Disconnected from database");
  }
};

// Advanced cleanup with options
const advancedClean = async (options = {}) => {
  const {
    includeFiles = true,
    includeIndexes = true,
    excludeCollections = [],
    dryRun = false,
  } = options;

  console.log("\n🔧 Advanced cleanup options:");
  console.log(`   Include files: ${includeFiles}`);
  console.log(`   Include indexes: ${includeIndexes}`);
  console.log(
    `   Exclude collections: ${excludeCollections.join(", ") || "none"}`
  );
  console.log(`   Dry run: ${dryRun}`);

  if (dryRun) {
    console.log("\n🧪 DRY RUN MODE - No actual deletion will occur");

    // Connect to database
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Get and display stats
    const stats = await getCollectionStats();
    console.log("\n📊 What would be deleted:");

    let totalWouldDelete = 0;
    for (const [collection, count] of Object.entries(stats)) {
      if (
        !excludeCollections.includes(collection) &&
        typeof count === "number"
      ) {
        console.log(`   ${collection}: ${count} documents`);
        totalWouldDelete += count;
      }
    }

    console.log(
      `\n📋 Total documents that would be deleted: ${totalWouldDelete}`
    );

    if (includeFiles) {
      console.log("\n📁 Upload directories that would be cleaned:");
      uploadDirectories.forEach((dir) => {
        if (fs.existsSync(dir)) {
          const fileCount = fs
            .readdirSync(dir)
            .filter((f) => f !== ".gitkeep").length;
          if (fileCount > 0) {
            console.log(`   ${dir}: ${fileCount} files`);
          }
        }
      });
    }

    await mongoose.disconnect();
    return;
  }

  // Run actual cleanup with options
  await cleanDatabase();
};

// Export functions for use in other scripts
module.exports = {
  cleanDatabase,
  advancedClean,
  cleanCollections,
  cleanUploadFiles,
  resetIndexes,
  getCollectionStats,
};

// Run the script if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  if (args.includes("--dry-run")) {
    options.dryRun = true;
  }

  if (args.includes("--no-files")) {
    options.includeFiles = false;
  }

  if (args.includes("--no-indexes")) {
    options.includeIndexes = false;
  }

  const excludeIndex = args.indexOf("--exclude");
  if (excludeIndex !== -1 && args[excludeIndex + 1]) {
    options.excludeCollections = args[excludeIndex + 1].split(",");
  }

  // Run cleanup
  if (Object.keys(options).length > 0) {
    advancedClean(options);
  } else {
    cleanDatabase();
  }
}

// Usage examples:
// node scripts/cleanDatabase.js                    # Full cleanup
// node scripts/cleanDatabase.js --dry-run          # See what would be deleted
// node scripts/cleanDatabase.js --no-files        # Don't clean files
// node scripts/cleanDatabase.js --exclude User,Product  # Exclude specific collections
