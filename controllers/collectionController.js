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

// @desc    Create a new collection
// @route   POST /supplier/create_collection
// @access  Private (Supplier Only)
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
    if (processedProductList.length > 0) {
      await Product.updateMany(
        { _id: { $in: processedProductList } },
        { $addToSet: { search_collection: collection._id } }
      );
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

// @desc    Update a collection
// @route   POST /supplier/update_collection
// @access  Private (Supplier Only)
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
