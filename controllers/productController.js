// controllers/productController.js
const Product = require("../models/Product");
const Vendor = require("../models/Vendor");
const Collection = require("../models/Collection");
const { encryptData } = require("../utils/encryptResponse");
const slugify = require("slugify");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

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

exports.getAllProducts = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all products for this supplier
    const products = await Product.find({
      supplier_id: userId,
      status: { $ne: "archived" }, // Exclude archived products
    }).sort({ createdAt: -1 }); // Latest first

    // Create a set of vendor IDs to look up
    const vendorIds = new Set();
    products.forEach((product) => {
      if (
        product.search_vendor &&
        mongoose.Types.ObjectId.isValid(product.search_vendor)
      ) {
        vendorIds.add(product.search_vendor.toString());
      }
    });

    // Get all relevant vendors in one query
    const vendors = await Vendor.find({
      _id: { $in: Array.from(vendorIds) },
      supplier_id: userId,
    });

    // Create a map of vendor IDs to vendor names for quick lookup
    const vendorMap = {};
    vendors.forEach((vendor) => {
      vendorMap[vendor._id.toString()] =
        vendor.vendor_name || `${vendor.first_name} ${vendor.last_name}`;
    });

    // Collect all collection IDs referenced in products
    const collectionIds = new Set();
    products.forEach((product) => {
      if (product.search_collection && product.search_collection.length > 0) {
        product.search_collection.forEach((collId) => {
          if (mongoose.Types.ObjectId.isValid(collId)) {
            collectionIds.add(collId.toString());
          }
        });
      }
    });

    // Get all relevant collections in one query
    const collections = await Collection.find({
      _id: { $in: Array.from(collectionIds) },
      status: { $ne: "archived" },
    }).select("_id title");

    // Create a map of collection IDs to collection names for quick lookup
    const collectionMap = {};
    collections.forEach((collection) => {
      collectionMap[collection._id.toString()] = collection.title;
    });

    // Format products for response and add vendor_name
    const productsList = products.map((product) => {
      const productObj = product.toObject();
      productObj.id = productObj._id;
      delete productObj._id;

      // Add vendor_name if search_vendor is valid and found in our map
      if (
        product.search_vendor &&
        vendorMap[product.search_vendor.toString()]
      ) {
        productObj.vendor_name = vendorMap[product.search_vendor.toString()];
      } else {
        productObj.vendor_name = ""; // Default empty string if no vendor found
      }

      // Transform search_collection from array of IDs to array of titles
      if (
        productObj.search_collection &&
        productObj.search_collection.length > 0
      ) {
        productObj.search_collection = productObj.search_collection
          .map((collId) => {
            const collIdStr = collId.toString();
            if (collectionMap[collIdStr]) {
              return collectionMap[collIdStr]; // Just return the title
            }
            return null;
          })
          .filter((title) => title !== null); // Remove null items (collections that weren't found)
      }

      return productObj;
    });

    const responseData = {
      message: "Products retrieved successfully",
      products_list: productsList,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get a single product by ID
// @route   POST /supplier/get_product
// @access  Private (Supplier Only)
exports.getProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    // Find the product
    const product = await Product.findOne({
      _id: product_id,
      supplier_id: userId,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Format product for response
    const productObj = product.toObject();
    productObj.id = productObj._id;
    delete productObj._id;

    // Look up vendor if product has a search_vendor field
    if (
      product.search_vendor &&
      mongoose.Types.ObjectId.isValid(product.search_vendor)
    ) {
      try {
        const vendor = await Vendor.findOne({
          _id: product.search_vendor,
          supplier_id: userId,
        });

        if (vendor) {
          productObj.vendor_name =
            vendor.vendor_name || `${vendor.first_name} ${vendor.last_name}`;
        } else {
          productObj.vendor_name = ""; // Default empty string if no vendor found
        }
      } catch (vendorError) {
        console.error("Error fetching vendor:", vendorError);
        productObj.vendor_name = ""; // Default empty string if error occurs
      }
    } else {
      productObj.vendor_name = ""; // Default empty string if no search_vendor field
    }

    // Look up collection information if product has search_collection field
    if (product.search_collection && product.search_collection.length > 0) {
      try {
        const collections = await Collection.find({
          _id: { $in: product.search_collection },
          status: { $ne: "archived" },
        }).select("_id title");

        if (collections && collections.length > 0) {
          // Transform search_collection to only contain collection titles
          productObj.search_collection = collections.map(
            (collection) => collection.title
          );

          // Keep collections as is for backward compatibility
          productObj.collections = collections.map((collection) => ({
            id: collection._id,
            title: collection.title,
          }));
        } else {
          productObj.search_collection = [];
          productObj.collections = [];
        }
      } catch (collectionError) {
        console.error("Error fetching collections:", collectionError);
        productObj.search_collection = [];
        productObj.collections = [];
      }
    } else {
      productObj.search_collection = [];
      productObj.collections = [];
    }

    const responseData = {
      message: "Product retrieved successfully",
      product: productObj,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Create a new product
// @route   POST /supplier/create_product
// @access  Private (Supplier Only)
exports.createProduct = async (req, res) => {
  try {
    const userId = req.user.id;

    // Extract product details from request body
    const {
      variant_option,
      physical_product,
      track_quantity,
      variants,
      weight,
      units,
      region,
      hs_code,
      quantity,
      continue_out_of_stock,
      address,
      title,
      category,
      description,
      media,
      price,
      compare_at_price,
      tax,
      cost_per_item,
      profit,
      margin,
      status,
      min_qty,
      search_vendor,
      search_collection,
      search_tags,
      page_title,
      meta_description,
      url_handle,
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({ error: "Product title is required" });
    }

    // Create a URL handle if not provided
    const productUrlHandle = url_handle || slugify(title, { lower: true });

    // Check if URL handle is already in use
    const existingProduct = await Product.findOne({
      url_handle: productUrlHandle,
    });
    if (existingProduct) {
      return res.status(400).json({
        error:
          "URL handle already in use. Please use a different product title or provide a custom URL handle.",
      });
    }

    // Process collection list
    let processedCollectionList = [];
    if (search_collection) {
      if (Array.isArray(search_collection)) {
        // Process array
        processedCollectionList = search_collection
          .map((coll) => {
            if (typeof coll === "object") {
              return coll.id || coll._id;
            }
            return coll;
          })
          .filter((id) => id);
      } else if (typeof search_collection === "string") {
        processedCollectionList = [search_collection];
      }
    }

    // Create new product
    const productData = {
      supplier_id: userId,
      title,
      url_handle: productUrlHandle,
      description: description || "",
      category: category || "",
      media: media || [],
      price: price ? parseFloat(price) : 0,
      compare_at_price: compare_at_price ? parseFloat(compare_at_price) : 0,
      tax: tax || false,
      cost_per_item: cost_per_item ? parseFloat(cost_per_item) : 0,
      status: status || "draft",
      quantity: quantity ? parseInt(quantity) : 0,
      min_qty: min_qty ? parseInt(min_qty) : 10,
      variant_option: variant_option || false,
      physical_product: physical_product || false,
      track_quantity: track_quantity || false,
      variants: variants || [],
      weight: weight || "",
      units: units || "",
      region: region || "",
      hs_code: hs_code || "",
      continue_out_of_stock: continue_out_of_stock || false,
      address: address || "",
      search_vendor: search_vendor || "",
      search_collection: processedCollectionList,
      search_tags: search_tags || [],
      page_title: page_title || title, // Default to title if not provided
      meta_description: meta_description || description.substring(0, 160) || "", // First 160 chars of description
    };

    // Calculate profit and margin
    if (productData.price > 0 && productData.cost_per_item > 0) {
      productData.profit = productData.price - productData.cost_per_item;
      productData.margin = (productData.profit / productData.price) * 100;
    }

    // Create product
    const product = await Product.create(productData);

    // Update collections to add this product
    if (processedCollectionList.length > 0) {
      await Collection.updateMany(
        { _id: { $in: processedCollectionList } },
        { $addToSet: { product_list: product._id } }
      );
    }

    // Find all smart collections and check if this product meets their conditions
    const smartCollections = await Collection.find({
      supplier_id: userId,
      collection_type: "smart",
      status: { $ne: "archived" },
    });

    for (const collection of smartCollections) {
      // Check if product matches this collection's conditions
      const matches = checkProductMatchesCollection(product, collection);

      if (matches) {
        // If product matches, add it to the collection
        await Collection.updateOne(
          { _id: collection._id },
          { $addToSet: { product_list: product._id } }
        );

        // Also add this collection to the product's search_collection
        await Product.updateOne(
          { _id: product._id },
          { $addToSet: { search_collection: collection._id } }
        );
      }
    }

    // Format for response
    const productObj = product.toObject();
    productObj.id = productObj._id;
    delete productObj._id;

    const responseData = {
      message: "Product created successfully",
      product: productObj,
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

// @desc    Update a product
// @route   POST /supplier/update_product
// @access  Private (Supplier Only)
exports.updateProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, media_urls, search_collection, ...updateData } =
      req.body;

    if (!product_id) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    // Find the product and save original state for comparison
    const product = await Product.findOne({
      _id: product_id,
      supplier_id: userId,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Save original state for later comparison
    const originalProduct = product.toObject();

    // If title is being updated, generate a new URL handle if not provided
    if (updateData.title && !updateData.url_handle) {
      updateData.url_handle = slugify(updateData.title, { lower: true });
    }

    // Check if new URL handle is already in use by another product
    if (updateData.url_handle && updateData.url_handle !== product.url_handle) {
      const existingProduct = await Product.findOne({
        url_handle: updateData.url_handle,
        _id: { $ne: product_id },
      });

      if (existingProduct) {
        return res.status(400).json({
          error:
            "URL handle already in use. Please use a different product title or provide a custom URL handle.",
        });
      }
    }

    // Handle media updates
    if (media_urls) {
      // Keep only the media URLs specified in media_urls
      product.media = media_urls;
    }

    // Store the old collection list for comparison
    const oldCollectionList = [...product.search_collection].map((id) =>
      id.toString()
    );

    // Process manual collection list from request
    let processedCollectionList = [];

    if (search_collection) {
      // Check if search_collection contains collection titles instead of IDs
      const collectionTitles = [];
      const collectionIds = [];

      if (Array.isArray(search_collection)) {
        // Process array
        search_collection.forEach((coll) => {
          if (typeof coll === "object" && (coll.id || coll._id)) {
            collectionIds.push(coll.id || coll._id);
          } else if (mongoose.Types.ObjectId.isValid(coll)) {
            collectionIds.push(coll);
          } else if (typeof coll === "string") {
            // Might be a collection title
            collectionTitles.push(coll);
          }
        });
      } else if (typeof search_collection === "string") {
        if (mongoose.Types.ObjectId.isValid(search_collection)) {
          collectionIds.push(search_collection);
        } else {
          // Might be a collection title
          collectionTitles.push(search_collection);
        }
      }

      // Add the collection IDs we already have
      processedCollectionList = [...collectionIds];

      // If we have collection titles, look them up to get their IDs
      if (collectionTitles.length > 0) {
        // Find collections by title
        const collections = await Collection.find({
          supplier_id: userId,
          title: { $in: collectionTitles },
          status: { $ne: "archived" },
        }).select("_id title");

        // Add the IDs of found collections
        collections.forEach((collection) => {
          processedCollectionList.push(collection._id.toString());
        });
      }
    }

    // Update fields
    Object.keys(updateData).forEach((key) => {
      if (key !== "media" && key !== "search_collection") {
        // Don't overwrite media if we've already updated it
        // Convert string numbers to actual numbers
        if (
          [
            "price",
            "compare_at_price",
            "cost_per_item",
            "quantity",
            "min_qty",
          ].includes(key)
        ) {
          product[key] = parseFloat(updateData[key]) || 0;
        } else {
          product[key] = updateData[key];
        }
      }
    });

    // Calculate profit and margin
    if (product.price > 0 && product.cost_per_item > 0) {
      product.profit = product.price - product.cost_per_item;
      product.margin = (product.profit / product.price) * 100;
    }

    // Update the product's manual collection list
    if (search_collection !== undefined) {
      product.search_collection = processedCollectionList;
    }

    // Save updated product
    await product.save();

    // Get the updated product with its assigned fields
    const updatedProduct = await Product.findById(product_id);

    // Convert to array of strings for easier comparison
    const newManualCollectionList = processedCollectionList.map((id) =>
      id.toString()
    );

    // Find collections to add this product to
    const collectionsToAdd = newManualCollectionList.filter(
      (id) => !oldCollectionList.includes(id)
    );

    // Find collections to remove this product from
    const collectionsToRemove = oldCollectionList.filter(
      (id) => !newManualCollectionList.includes(id)
    );

    // Update collections to add this product
    if (collectionsToAdd.length > 0) {
      await Collection.updateMany(
        { _id: { $in: collectionsToAdd } },
        { $addToSet: { product_list: product_id } }
      );
    }

    // Update collections to remove this product
    if (collectionsToRemove.length > 0) {
      await Collection.updateMany(
        { _id: { $in: collectionsToRemove } },
        { $pull: { product_list: product_id } }
      );
    }

    // Now handle smart collections
    // Get all smart collections
    const smartCollections = await Collection.find({
      supplier_id: userId,
      collection_type: "smart",
      status: { $ne: "archived" },
    });

    for (const collection of smartCollections) {
      // Get current collection status (whether it contains the product)
      const collectionHasProduct = collection.product_list.some(
        (pid) => pid.toString() === product_id
      );

      // Check if product matches this collection's conditions
      const matches = checkProductMatchesCollection(updatedProduct, collection);

      if (matches && !collectionHasProduct) {
        // Product matches but is not in collection - add it
        await Collection.updateOne(
          { _id: collection._id },
          { $addToSet: { product_list: product_id } }
        );

        // Add collection to product's search_collection
        await Product.updateOne(
          { _id: product_id },
          { $addToSet: { search_collection: collection._id } }
        );
      } else if (!matches && collectionHasProduct) {
        // Product doesn't match but is in collection - remove it
        await Collection.updateOne(
          { _id: collection._id },
          { $pull: { product_list: product_id } }
        );

        // Remove collection from product's search_collection
        await Product.updateOne(
          { _id: product_id },
          { $pull: { search_collection: collection._id } }
        );
      }
    }

    // Get final updated product to return
    const finalProduct = await Product.findById(product_id);

    // Format for response
    const productObj = finalProduct.toObject();
    productObj.id = productObj._id;
    delete productObj._id;

    const responseData = {
      message: "Product updated successfully",
      product: productObj,
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

// @desc    Delete a product (set to archived)
// @route   POST /supplier/delete_product
// @access  Private (Supplier Only)
exports.deleteProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    // Find the product
    const product = await Product.findOne({
      _id: product_id,
      supplier_id: userId,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Get the collection list before archiving
    const collectionList = product.search_collection;

    // Soft delete by setting status to archived
    product.status = "archived";
    await product.save();

    // Update all collections to remove this product
    if (collectionList && collectionList.length > 0) {
      await Collection.updateMany(
        { _id: { $in: collectionList } },
        { $pull: { product_list: product_id } }
      );
    }

    const responseData = {
      message: "Product deleted successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Search products by query
// @route   POST /supplier/search_product
// @access  Private (Supplier Only)
exports.searchProducts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Create search regex pattern (case-insensitive)
    const searchPattern = new RegExp(query, "i");

    // Search products by title, description, tags, category
    const products = await Product.find({
      supplier_id: userId,
      status: { $ne: "archived" },
      $or: [
        { title: searchPattern },
        { description: searchPattern },
        { category: searchPattern },
        { search_tags: searchPattern },
        { url_handle: searchPattern },
      ],
    }).sort({ createdAt: -1 }); // Latest first

    // Format products for response
    const productsList = products.map((product) => {
      const productObj = product.toObject();
      productObj.id = productObj._id;
      delete productObj._id;
      return productObj;
    });

    const responseData = {
      message: "Products search successful",
      product_list: productsList,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
