const CompanyDocument = require("../models/CompanyDocument");
const User = require("../models/User");
const { encryptData } = require("../utils/encryptResponse");
const fs = require("fs");
const path = require("path");

// @desc    Get company documents
// @route   GET /profile/get_company_documents
// @access  Private
exports.getCompanyDocuments = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is a company
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.company) {
      return res
        .status(403)
        .json({ error: "Only company accounts can access company documents" });
    }

    // Get all documents for the company
    const documents = await CompanyDocument.find({ user_id: userId }).sort({
      dated: -1,
    });

    const documentsWithId = documents.map((document) => {
      const documentObj = document.toObject();
      documentObj.id = documentObj._id;
      delete documentObj._id;
      return documentObj;
    });

    const responseData = {
      message: "Company documents retrieved successfully",
      documents: documentsWithId,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Upload company document
// @route   POST /profile/upload_company_documents
// @access  Private
exports.uploadCompanyDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, dated } = req.body;

    // Check if user is a company
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.company) {
      return res
        .status(403)
        .json({ error: "Only company accounts can upload company documents" });
    }

    // Validate required fields
    if (!title || !dated) {
      return res.status(400).json({ error: "Title and date are required" });
    }

    // Check if document image was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "Document image is required" });
    }

    const docImagePath = `/uploads/company/documents/${req.file.filename}`;

    // Create new document
    const document = await CompanyDocument.create({
      user_id: userId,
      title,
      dated,
      doc_image: docImagePath,
    });

    const responseData = {
      message: "Company document uploaded successfully",
      document,
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error(err);

    // Delete uploaded file if there was an error
    if (req.file) {
      try {
        fs.unlinkSync(
          path.join(
            __dirname,
            "..",
            "uploads",
            "company",
            "documents",
            req.file.filename
          )
        );
      } catch (unlinkErr) {
        console.error("Error deleting file:", unlinkErr);
      }
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update company document
// @route   POST /profile/update_company_documents
// @access  Private
exports.updateCompanyDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { document_id, title, dated } = req.body;

    // Check if user is a company
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.company) {
      return res
        .status(403)
        .json({ error: "Only company accounts can update company documents" });
    }

    // Validate required fields
    if (!document_id) {
      return res.status(400).json({ error: "Document ID is required" });
    }

    // Find the document
    const document = await CompanyDocument.findById(document_id);

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Check if document belongs to the user
    if (document.user_id.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this document" });
    }

    // Update document fields
    if (title) document.title = title;
    if (dated) document.dated = dated;

    // Update document image if provided
    if (req.file) {
      // Delete previous image if it exists
      try {
        const oldImgPath = path.join(__dirname, "..", document.doc_image);
        if (fs.existsSync(oldImgPath)) {
          fs.unlinkSync(oldImgPath);
        }
      } catch (unlinkErr) {
        console.error("Error deleting old image:", unlinkErr);
        // Continue even if deletion fails
      }

      // Set new image path
      document.doc_image = `/uploads/company/documents/${req.file.filename}`;
    }

    // Save updated document
    await document.save();

    const responseData = {
      message: "Company document updated successfully",
      document,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);

    // Delete uploaded file if there was an error
    if (req.file) {
      try {
        fs.unlinkSync(
          path.join(
            __dirname,
            "..",
            "uploads",
            "company",
            "documents",
            req.file.filename
          )
        );
      } catch (unlinkErr) {
        console.error("Error deleting file:", unlinkErr);
      }
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete company document
// @route   POST /profile/delete_company_documents
// @access  Private
exports.deleteCompanyDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { document_id } = req.body;

    // Check if user is a company
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.company) {
      return res
        .status(403)
        .json({ error: "Only company accounts can delete company documents" });
    }

    if (!document_id) {
      return res.status(400).json({ error: "Document ID is required" });
    }

    // Find the document
    const document = await CompanyDocument.findById(document_id);

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Check if document belongs to the user
    if (document.user_id.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this document" });
    }

    // Delete the document image
    try {
      const imgPath = path.join(__dirname, "..", document.doc_image);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    } catch (unlinkErr) {
      console.error("Error deleting image:", unlinkErr);
      // Continue even if deletion fails
    }

    // Delete the document from the database
    await CompanyDocument.findByIdAndDelete(document_id);

    const responseData = {
      message: "Company document deleted successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
