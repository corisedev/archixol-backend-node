const Certificate = require("../models/Certificate");
const { encryptData } = require("../utils/encryptResponse");
const fs = require("fs");
const path = require("path");

// @desc    Get all certificates
// @route   GET /profile/get_certificates
// @access  Private
exports.getCertificates = async (req, res) => {
  try {
    const userId = req.user.id;

    const certificates = await Certificate.find({ user_id: userId }).sort({
      dated: -1,
    });

    const certificatesWithId = certificates.map((certificate) => {
      const certificateObj = certificate.toObject();
      certificateObj.id = certificateObj._id;
      delete certificateObj._id;
      return certificateObj;
    });

    const responseData = {
      message: "Certificates retrieved successfully",
      certificates: certificatesWithId,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Upload certificate
// @route   POST /profile/upload_certificates
// @access  Private
exports.uploadCertificate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, dated } = req.body;

    if (!title || !dated) {
      return res.status(400).json({ error: "Title and date are required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Certificate image is required" });
    }

    const certificateImgPath = `/uploads/certificates/${req.file.filename}`;

    // Create new certificate
    const certificate = await Certificate.create({
      user_id: userId,
      title,
      dated,
      certificate_img: certificateImgPath,
    });

    const responseData = {
      message: "Certificate uploaded successfully",
      certificate,
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error(err);

    if (req.file) {
      try {
        fs.unlinkSync(
          path.join(
            __dirname,
            "..",
            "uploads",
            "certificates",
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

// @desc    Update certificate
// @route   POST /profile/update_certificates
// @access  Private
exports.updateCertificate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { certificate_id, title, dated } = req.body;

    if (!certificate_id) {
      return res.status(400).json({ error: "Certificate ID is required" });
    }

    const certificate = await Certificate.findById(certificate_id);

    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    if (certificate.user_id.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this certificate" });
    }

    if (title) certificate.title = title;
    if (dated) certificate.dated = dated;

    if (req.file) {
      try {
        const oldImgPath = path.join(
          __dirname,
          "..",
          certificate.certificate_img
        );
        if (fs.existsSync(oldImgPath)) {
          fs.unlinkSync(oldImgPath);
        }
      } catch (unlinkErr) {
        console.error("Error deleting old image:", unlinkErr);
      }

      certificate.certificate_img = `/uploads/certificates/${req.file.filename}`;
    }

    await certificate.save();

    const responseData = {
      message: "Certificate updated successfully",
      certificate,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);

    if (req.file) {
      try {
        fs.unlinkSync(
          path.join(
            __dirname,
            "..",
            "uploads",
            "certificates",
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

// @desc    Delete certificate
// @route   POST /profile/delete_certificates
// @access  Private
exports.deleteCertificate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { certificate_id } = req.body;

    if (!certificate_id) {
      return res.status(400).json({ error: "Certificate ID is required" });
    }

    const certificate = await Certificate.findById(certificate_id);

    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    if (certificate.user_id.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this certificate" });
    }

    try {
      const imgPath = path.join(__dirname, "..", certificate.certificate_img);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    } catch (unlinkErr) {
      console.error("Error deleting image:", unlinkErr);
    }

    await Certificate.findByIdAndDelete(certificate_id);

    const responseData = {
      message: "Certificate deleted successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
