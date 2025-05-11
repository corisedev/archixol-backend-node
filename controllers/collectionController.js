// controllers/collectionController.js
const Collection = require("../models/Collection");
const Product = require("../models/Product");
const { encryptData } = require("../utils/encryptResponse");
const slugify = require("slugify");
const fs = require("fs");
const path = require("path");

// @desc    Get all collections for a supplier
// @route   GET /supplier/get_all_collections
// @access  Private (Supplier Only)
exports.getAllCollections = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all collections for this supplier
    const collections = await Collection.find({
      supplier_id: userId,
      status: { $ne: "archived" }, // Exclude archived collections
    }).sort({ createdAt: -1 }); // Latest first

    // Format collections for response
    const collectionsList = collections.map((collection) => {
      const collectionObj = collection.toObject();
      collectionObj.id = collectionObj._id;
      delete collectionObj._id;
      return collectionObj;
    });

    const responseData = {
      message: "Collections retrieved successfully",
      collections: collectionsList,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get a single collection by ID
// @route   POST /supplier/get_collection
// @access  Private (Supplier Only)
exports.getCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { collection_id } = req.body;

    if (!collection_id) {
      return res.status(400).json({ error: "Collection ID is required" });
    }

    // Find the collection
    const collection = await Collection.findOne({
      _id: collection_id,
      supplier_id: userId,
    });

    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    // Format collection for response
    const collectionObj = collection.toObject();
    collectionObj.id = collectionObj._id;
    delete collectionObj._id;

    // Get product details for product_list, filtering out archived products
    if (collection.product_list && collection.product_list.length > 0) {
      const products = await Product.find({
        _id: { $in: collection.product_list },
        status: { $ne: "archived" }, // Only get active products
      }).select("title price _id media");

      // Format products
      const formattedProducts = products.map((product) => ({
        id: product._id,
        title: product.title,
        price: product.price,
        image:
          product.media && product.media.length > 0 ? product.media[0] : "",
      }));

      collectionObj.products = formattedProducts;
    } else {
      collectionObj.products = [];
    }

    const responseData = {
      message: "Collection retrieved successfully",
      collection: collectionObj,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Helper function to check if a product matches the conditions of a smart collection
const checkProductMatchesCollection = (product, collection) => {
  // If not a smart collection, skip
  if (collection.collection_type !== "smart") {
    return false;
  }

  // No conditions means no match
  if (
    !collection.smart_conditions ||
    collection.smart_conditions.length === 0
  ) {
    return false;
  }

  // For 'all' operator, all conditions must be met
  // For 'any' operator, at least one condition must be met
  const needAllConditions = collection.smart_operator === "all";

  // Check each condition
  const conditionResults = collection.smart_conditions.map((condition) => {
    const { field, operator, value } = condition;

    // Get the product field value
    let productValue;

    // Handle special cases for fields
    if (field === "inventory") {
      productValue = product.quantity;
    } else if (field === "compareTo_at_price") {
      productValue = product.compare_at_price;
    } else if (field === "vendor") {
      // For vendor we need to check the vendor name, which we don't have here
      // We'll assume it's stored in search_vendor field
      productValue = product.search_vendor;
    } else {
      productValue = product[field];
    }

    // If product value is an array (like search_tags), convert to string for comparison
    if (Array.isArray(productValue)) {
      if (field === "search_tags") {
        // For search_tags we're checking if any tag matches
        if (operator === "is_equal_to") {
          return productValue.includes(value);
        }
      }
      return false;
    }

    // Convert values to strings for string operations
    const productValueStr = String(productValue || "");
    const conditionValueStr = String(value || "");

    // For numeric comparisons, convert to numbers
    const numericFields = ["price", "compare_at_price", "weight", "inventory"];
    let numericProductValue, numericConditionValue;

    if (numericFields.includes(field)) {
      numericProductValue = parseFloat(productValueStr) || 0;
      numericConditionValue = parseFloat(conditionValueStr) || 0;
    }

    // Check based on operator
    switch (operator) {
      case "is_equal_to":
        return productValueStr === conditionValueStr;

      case "is_not_equal_to":
        return productValueStr !== conditionValueStr;

      case "starts_with":
        return productValueStr.startsWith(conditionValueStr);

      case "ends_with":
        return productValueStr.endsWith(conditionValueStr);

      case "contains":
        return productValueStr.includes(conditionValueStr);

      case "does_not_contain":
        return !productValueStr.includes(conditionValueStr);

      case "is_greater_than":
        return numericProductValue > numericConditionValue;

      case "is_less_than":
        return numericProductValue < numericConditionValue;

      case "is_not_empty":
        return productValueStr.trim() !== "";

      case "is_empty":
        return productValueStr.trim() === "";

      default:
        return false;
    }
  });

  // If smart_operator is 'all', all conditions must be true
  // If smart_operator is 'any', at least one condition must be true
  return needAllConditions
    ? conditionResults.every((result) => result)
    : conditionResults.some((result) => result);
};

// Add this function to handle smart collection product population
const populateSmartCollection = async (collection, userId) => {
  if (
    collection.collection_type !== "smart" ||
    !collection.smart_conditions ||
    collection.smart_conditions.length === 0
  ) {
    return;
  }

  // Get all active products for this supplier
  const products = await Product.find({
    supplier_id: userId,
    status: { $ne: "archived" },
  });

  // Check each product against the collection conditions
  for (const product of products) {
    const matches = checkProductMatchesCollection(product, collection);

    if (matches) {
      // Add product to collection
      await Collection.updateOne(
        { _id: collection._id },
        { $addToSet: { product_list: product._id } }
      );

      // Add collection to product's search_collection
      await Product.updateOne(
        { _id: product._id },
        { $addToSet: { search_collection: collection._id } }
      );
    }
  }
};

// Modify the createCollection function to include smart collection handling
exports.createCollection = async (req, res) => {
  try {
    const userId = req.user.id;

    // Extract collection details from request body
    const {
      title,
      description,
      collection_type,
      search_products,
      collection_images,
      product_list,
      smart_operator,
      smart_conditions,
      page_title,
      meta_description,
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({ error: "Collection title is required" });
    }

    // Create a URL handle from title
    const collectionUrlHandle = slugify(title, { lower: true });

    // Check if URL handle is already in use
    const existingCollection = await Collection.findOne({
      url_handle: collectionUrlHandle,
    });
    if (existingCollection) {
      return res.status(400).json({
        error:
          "URL handle already in use. Please use a different collection title.",
      });
    }

    // Process the product list to extract just the IDs
    let processedProductList = [];
    if (product_list && Array.isArray(product_list)) {
      // Extract just the product IDs from the product objects
      processedProductList = product_list
        .map((product) => {
          if (typeof product === "object") {
            return product.id || product._id;
          }
          return product;
        })
        .filter((id) => id); // Filter out any undefined or null values
    }

    // Create new collection
    const collectionData = {
      supplier_id: userId,
      title,
      url_handle: collectionUrlHandle,
      description: description || "",
      collection_type: collection_type || "manual",
      collection_images: collection_images || [],
      product_list: processedProductList, // Use the processed product IDs
      smart_operator: smart_operator || "all",
      smart_conditions: smart_conditions || [],
      page_title: page_title || title, // Default to title if not provided
      meta_description: meta_description || description || "", // Default to description if not provided
    };

    // Create collection
    const collection = await Collection.create(collectionData);

    // Now update all products to add this collection to their search_collection field
    // (only for manual collections or initially added products)
    if (processedProductList.length > 0) {
      await Product.updateMany(
        { _id: { $in: processedProductList } },
        { $addToSet: { search_collection: collection._id } }
      );
    }

    // For smart collections, populate with matching products
    if (collection.collection_type === "smart") {
      await populateSmartCollection(collection, userId);
    }

    // Format for response
    const collectionObj = collection.toObject();
    collectionObj.id = collectionObj._id;
    delete collectionObj._id;

    // Get product details for product_list
    if (collection.product_list && collection.product_list.length > 0) {
      const products = await Product.find({
        _id: { $in: collection.product_list },
        status: { $ne: "archived" },
      }).select("title price _id media");

      // Format products
      const formattedProducts = products.map((product) => ({
        id: product._id,
        title: product.title,
        price: product.price,
        image:
          product.media && product.media.length > 0 ? product.media[0] : "",
      }));

      collectionObj.products = formattedProducts;
    } else {
      collectionObj.products = [];
    }

    const responseData = {
      message: "Collection created successfully",
      collection: collectionObj,
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error(err);

    // Check for validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ error: messages.join(", ") });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// Also update the collection update function to handle smart collection changes
exports.updateCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      collection_id,
      title,
      description,
      collection_type,
      search_products,
      collection_images,
      product_list,
      smart_operator,
      smart_conditions,
      page_title,
      meta_description,
    } = req.body;

    if (!collection_id) {
      return res.status(400).json({ error: "Collection ID is required" });
    }

    // Find the collection
    const collection = await Collection.findOne({
      _id: collection_id,
      supplier_id: userId,
    });

    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    // If title is being updated, generate a new URL handle
    if (title && title !== collection.title) {
      const newUrlHandle = slugify(title, { lower: true });

      // Check if new URL handle is already in use by another collection
      const existingCollection = await Collection.findOne({
        url_handle: newUrlHandle,
        _id: { $ne: collection_id },
      });

      if (existingCollection) {
        return res.status(400).json({
          error:
            "URL handle already in use. Please use a different collection title.",
        });
      }

      collection.title = title;
      collection.url_handle = newUrlHandle;
    }

    // Store old collection data for comparison
    const oldCollectionType = collection.collection_type;
    const oldSmartOperator = collection.smart_operator;
    const oldSmartConditions = JSON.stringify(
      collection.smart_conditions || []
    );

    // Store the old product list for comparison
    const oldProductList = [...collection.product_list].map((id) =>
      id.toString()
    );

    // Process the product list to extract just the IDs
    let processedProductList = [];
    if (product_list !== undefined) {
      if (Array.isArray(product_list)) {
        // Extract just the product IDs from the product objects
        processedProductList = product_list
          .map((product) => {
            if (typeof product === "object") {
              return product.id || product._id;
            }
            return product;
          })
          .filter((id) => id); // Filter out any undefined or null values
      }

      collection.product_list = processedProductList;
    } else {
      processedProductList = oldProductList;
    }

    // Convert to array of strings for easier comparison
    const newProductList = processedProductList.map((id) => id.toString());

    // Find products to add the collection to
    const productsToAdd = newProductList.filter(
      (id) => !oldProductList.includes(id)
    );

    // Find products to remove the collection from
    const productsToRemove = oldProductList.filter(
      (id) => !newProductList.includes(id)
    );

    // Update other fields if provided
    if (description !== undefined) collection.description = description;
    if (collection_type !== undefined)
      collection.collection_type = collection_type;
    if (collection_images !== undefined)
      collection.collection_images = collection_images;
    if (smart_operator !== undefined)
      collection.smart_operator = smart_operator;
    if (smart_conditions !== undefined)
      collection.smart_conditions = smart_conditions;
    if (page_title !== undefined) collection.page_title = page_title;
    if (meta_description !== undefined)
      collection.meta_description = meta_description;

    // Check if smart collection settings have changed
    const smartSettingsChanged =
      collection.collection_type === "smart" &&
      (oldCollectionType !== "smart" ||
        oldSmartOperator !== collection.smart_operator ||
        oldSmartConditions !==
          JSON.stringify(collection.smart_conditions || []));

    // Save updated collection
    await collection.save();

    // Update products to add the collection reference
    if (productsToAdd.length > 0) {
      await Product.updateMany(
        { _id: { $in: productsToAdd } },
        { $addToSet: { search_collection: collection_id } }
      );
    }

    // Update products to remove the collection reference
    if (productsToRemove.length > 0) {
      await Product.updateMany(
        { _id: { $in: productsToRemove } },
        { $pull: { search_collection: collection_id } }
      );
    }

    // If collection was changed to smart type or smart settings changed,
    // repopulate the collection based on the criteria
    if (smartSettingsChanged) {
      // First, clear the manual product list if switching from manual to smart
      if (oldCollectionType !== "smart") {
        await Collection.updateOne(
          { _id: collection_id },
          { $set: { product_list: [] } }
        );

        // Also remove this collection from all products
        await Product.updateMany(
          { search_collection: collection_id },
          { $pull: { search_collection: collection_id } }
        );
      }

      // Then populate with matching products
      await populateSmartCollection(collection, userId);
    }

    // Format for response
    const collectionObj = collection.toObject();
    collectionObj.id = collectionObj._id;
    delete collectionObj._id;

    // Get product details for product_list
    if (collection.product_list && collection.product_list.length > 0) {
      const products = await Product.find({
        _id: { $in: collection.product_list },
        status: { $ne: "archived" },
      }).select("title price _id media");

      // Format products
      const formattedProducts = products.map((product) => ({
        id: product._id,
        title: product.title,
        price: product.price,
        image:
          product.media && product.media.length > 0 ? product.media[0] : "",
      }));

      collectionObj.products = formattedProducts;
    } else {
      collectionObj.products = [];
    }

    const responseData = {
      message: "Collection updated successfully",
      collection: collectionObj,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);

    // Check for validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ error: messages.join(", ") });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete a collection (set to archived)
// @route   POST /supplier/delete_collection
// @access  Private (Supplier Only)
exports.deleteCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { collection_id } = req.body;

    if (!collection_id) {
      return res.status(400).json({ error: "Collection ID is required" });
    }

    // Find the collection
    const collection = await Collection.findOne({
      _id: collection_id,
      supplier_id: userId,
    });

    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    // Get the product list before archiving
    const productList = collection.product_list;

    // Soft delete by setting status to archived
    collection.status = "archived";
    await collection.save();

    // Update all products to remove this collection from their search_collection field
    if (productList && productList.length > 0) {
      await Product.updateMany(
        { _id: { $in: productList } },
        { $pull: { search_collection: collection_id } }
      );
    }

    const responseData = {
      message: "Collection deleted successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Search collections by query
// @route   POST /supplier/search_collection
// @access  Private (Supplier Only)
exports.searchCollections = async (req, res) => {
  try {
    const userId = req.user.id;
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Create search regex pattern (case-insensitive)
    const searchPattern = new RegExp(query, "i");

    // Search collections by title and description
    const collections = await Collection.find({
      supplier_id: userId,
      status: { $ne: "archived" },
      $or: [
        { title: searchPattern },
        { description: searchPattern },
        { url_handle: searchPattern },
      ],
    }).sort({ createdAt: -1 }); // Latest first

    // Format collections for response
    const collectionsList = collections.map((collection) => {
      const collectionObj = collection.toObject();
      collectionObj.id = collectionObj._id;
      delete collectionObj._id;
      return collectionObj;
    });

    const responseData = {
      message: "Collections search successful",
      collections: collectionsList,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
