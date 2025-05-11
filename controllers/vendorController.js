// controllers/vendorController.js
const Vendor = require("../models/Vendor");
const { encryptData } = require("../utils/encryptResponse");

// @desc    Get all vendors
// @route   GET /supplier/get_all_vendors
// @access  Private (Supplier Only)
exports.getAllVendors = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all vendors for this supplier
    const vendors = await Vendor.find({
      supplier_id: userId,
      status: { $ne: "deleted" }, // Exclude deleted vendors
    }).sort({ createdAt: -1 }); // Latest first

    // Format vendors for response
    const vendorsList = vendors.map((vendor) => {
      const vendorObj = vendor.toObject();
      vendorObj.id = vendorObj._id;
      delete vendorObj._id;
      return vendorObj;
    });

    const responseData = {
      message: "Vendors retrieved successfully",
      vendors: vendorsList,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get vendor by ID
// @route   POST /supplier/get_vendor
// @access  Private (Supplier Only)
exports.getVendor = async (req, res) => {
  try {
    const userId = req.user.id;
    const { vendor_id } = req.body;

    if (!vendor_id) {
      return res.status(400).json({ error: "Vendor ID is required" });
    }

    // Find the vendor
    const vendor = await Vendor.findOne({
      _id: vendor_id,
      supplier_id: userId,
      status: { $ne: "deleted" },
    });

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // Format vendor for response
    const vendorObj = vendor.toObject();
    vendorObj.id = vendorObj._id;
    delete vendorObj._id;

    const responseData = {
      message: "Vendor retrieved successfully",
      vendor: vendorObj,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Create a new vendor
// @route   POST /supplier/create_vendor
// @access  Private (Supplier Only)
exports.createVendor = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      first_name,
      last_name,
      email,
      phone_number,
      street_address,
      city,
      state_province,
      zip_code,
      country,
    } = req.body;

    // Check if required fields are provided
    if (!first_name || !last_name) {
      return res
        .status(400)
        .json({ error: "First name and last name are required" });
    }

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if email already exists for this supplier
    const existingVendor = await Vendor.findOne({
      supplier_id: userId,
      email: email,
      status: { $ne: "deleted" },
    });

    if (existingVendor) {
      return res
        .status(400)
        .json({ error: "Vendor with this email already exists" });
    }

    // Create new vendor
    const vendor = await Vendor.create({
      supplier_id: userId,
      first_name,
      last_name,
      email,
      phone_number: phone_number || "",
      street_address: street_address || "",
      city: city || "",
      state_province: state_province || "",
      zip_code: zip_code || "",
      country: country || "",
    });

    const responseData = {
      message: "Vendor created successfully",
      vendor_id: vendor._id,
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

// @desc    Update vendor
// @route   POST /supplier/update_vendor
// @access  Private (Supplier Only)
exports.updateVendor = async (req, res) => {
  try {
    const userId = req.user.id;
    const { vendor_id, ...updateData } = req.body;

    if (!vendor_id) {
      return res.status(400).json({ error: "Vendor ID is required" });
    }

    // Find the vendor
    const vendor = await Vendor.findOne({
      _id: vendor_id,
      supplier_id: userId,
      status: { $ne: "deleted" },
    });

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // Check if email is being changed and if it's already in use
    if (updateData.email && updateData.email !== vendor.email) {
      const existingVendor = await Vendor.findOne({
        supplier_id: userId,
        email: updateData.email,
        _id: { $ne: vendor_id },
        status: { $ne: "deleted" },
      });

      if (existingVendor) {
        return res
          .status(400)
          .json({ error: "Email already in use by another vendor" });
      }
    }

    // Update vendor fields
    Object.keys(updateData).forEach((key) => {
      vendor[key] = updateData[key];
    });

    await vendor.save();

    const responseData = {
      message: "Vendor updated successfully",
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

// @desc    Delete vendor (soft delete)
// @route   POST /supplier/delete_vendor
// @access  Private (Supplier Only)
exports.deleteVendor = async (req, res) => {
  try {
    const userId = req.user.id;
    const { vendor_id } = req.body;

    if (!vendor_id) {
      return res.status(400).json({ error: "Vendor ID is required" });
    }

    // Find the vendor
    const vendor = await Vendor.findOne({
      _id: vendor_id,
      supplier_id: userId,
      status: { $ne: "deleted" },
    });

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // Soft delete by setting status to deleted
    vendor.status = "deleted";
    await vendor.save();

    const responseData = {
      message: "Vendor deleted successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
