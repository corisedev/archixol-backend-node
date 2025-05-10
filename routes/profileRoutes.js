const express = require("express");
const router = express.Router();
const CryptoJS = require("crypto-js");

// Import controllers
const {
  getProfileData,
  updateProfileData,
  deleteIntroVideo,
  updateProfileTemplate,
} = require("../controllers/profileController");

const {
  getCertificates,
  uploadCertificate,
  updateCertificate,
  deleteCertificate,
} = require("../controllers/certificateController");

const {
  getProjects,
  getProject,
  uploadProject,
  updateProject,
  deleteProject,
} = require("../controllers/projectController");

const {
  getCompanyDocuments,
  uploadCompanyDocument,
  updateCompanyDocument,
  deleteCompanyDocument,
} = require("../controllers/companyDocumentController");

// Import validations
const {
  validateProfileUpdate,
  validateDeleteVideo,
  validate,
} = require("../utils/profileValidation");

const {
  validateUploadCertificate,
  validateUpdateCertificate,
  validateDeleteCertificate,
} = require("../utils/certificateValidation");

const {
  validateGetProject,
  validateUploadProject,
  validateUpdateProject,
  validateDeleteProject,
} = require("../utils/projectValidation");

const {
  validateCompanyDocumentUpload,
  validateCompanyDocumentUpdate,
  validateCompanyDocumentDelete,
} = require("../utils/companyValidation");

// Import middlewares
const { protect, authorizeCompany } = require("../middleware/auth");
const { decryptRequest } = require("../middleware/encryption");
const {
  uploadCertificateImage,
  handleUploadErrors: handleCertificateUploadErrors,
} = require("../middleware/certificateUpload");
const {
  uploadProjectImages,
  handleUploadErrors: handleProjectUploadErrors,
} = require("../middleware/projectUpload");
const {
  uploadCompanyDocument: uploadCompanyDocumentMiddleware,
  handleUploadErrors: handleCompanyDocumentUploadErrors,
} = require("../middleware/companyUpload");
const {
  handleProfileUpload,
} = require("../middleware/profileUploadMiddleware");
// Apply decryption middleware to all routes that receive data
// router.use(decryptRequest);

// Profile routes
router.get("/get_data", protect, decryptRequest, getProfileData);
router.post(
  "/update_data",
  protect,
  handleProfileUpload,
  validateProfileUpdate,
  validate,
  updateProfileData
);
router.post(
  "/delete_intro_video",
  protect,
  validateDeleteVideo,
  validate,
  deleteIntroVideo
);

// Certificate routes
router.get("/get_certificates", protect, getCertificates);
router.post(
  "/upload_certificates",
  protect,
  uploadCertificateImage,
  handleCertificateUploadErrors,
  (req, res, next) => {
    try {
      console.log("Raw request for certificate upload:", req.body);
      console.log("Files:", req.file); // Note: using req.file for single file upload

      if (req.body && req.body.data) {
        // Decrypt the data field
        const bytes = CryptoJS.AES.decrypt(
          req.body.data,
          process.env.AES_SECRET_KEY
        );
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

        console.log("Decrypted data for certificate upload:", decryptedData);

        // Parse the decrypted data
        const parsedData = JSON.parse(decryptedData);

        // Replace req.body with the parsed data
        req.body = parsedData;

        // Add information about the uploaded file
        if (req.file) {
          req.body.certificate_path = `/uploads/certificates/${req.file.filename}`;
        }
      }

      console.log("Final request body for certificate upload:", req.body);
      next();
    } catch (error) {
      console.error("Processing error:", error);
      // Delete uploaded file if there was an error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.error("Error deleting file:", unlinkErr);
        }
      }
      return res
        .status(400)
        .json({ error: "Failed to process request: " + error.message });
    }
  },
  validateUploadCertificate,
  validate,
  uploadCertificate
);
router.post(
  "/update_certificates",
  protect,
  uploadCertificateImage,
  handleCertificateUploadErrors,
  (req, res, next) => {
    try {
      console.log("Raw request for project update:", req.body);
      console.log("Files:", req.files);

      // Store project_imgs_urls separately before decryption
      // since it might be outside the encrypted data
      let project_imgs_urls = [];
      if (req.body.project_imgs_urls) {
        if (Array.isArray(req.body.project_imgs_urls)) {
          project_imgs_urls = [...req.body.project_imgs_urls];
        } else {
          project_imgs_urls = [req.body.project_imgs_urls];
        }
      }

      if (req.body && req.body.data) {
        // Decrypt the data field
        const bytes = CryptoJS.AES.decrypt(
          req.body.data,
          process.env.AES_SECRET_KEY
        );
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

        console.log("Decrypted data for project update:", decryptedData);

        // Parse the decrypted data
        const parsedData = JSON.parse(decryptedData);

        // Add newly uploaded file paths
        const newUploadedImages = [];
        if (req.files && req.files.length > 0) {
          req.files.forEach((file) => {
            newUploadedImages.push(`/uploads/projects/${file.filename}`);
          });
        }

        // Replace req.body with the decrypted data
        req.body = parsedData;

        // Add back the project_imgs_urls that weren't part of the encrypted data
        if (project_imgs_urls.length > 0) {
          req.body.project_imgs_urls = project_imgs_urls;
        }

        // Add information about new files
        if (newUploadedImages.length > 0) {
          req.body.new_uploaded_images = newUploadedImages;
        }
      }

      console.log("Final request body for project update:", req.body);
      next();
    } catch (error) {
      console.error("Processing error:", error);
      // Delete uploaded files if there was an error
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkErr) {
            console.error("Error deleting file:", unlinkErr);
          }
        });
      }
      return res
        .status(400)
        .json({ error: "Failed to process request: " + error.message });
    }
  },
  validateUpdateCertificate,
  validate,
  updateCertificate
);
router.post(
  "/delete_certificates",
  protect,
  decryptRequest,
  validateDeleteCertificate,
  validate,
  deleteCertificate
);

// Project routes
router.get("/get_projects", protect, getProjects);
router.post("/get_project", protect, validateGetProject, validate, getProject);
router.post(
  "/upload_project",
  protect,
  // First upload the files
  uploadProjectImages,
  handleProjectUploadErrors,
  // Then process the encrypted data while preserving files
  (req, res, next) => {
    try {
      console.log("Raw request for project upload:", req.body);
      console.log("Files:", req.files);

      if (req.body && req.body.data) {
        // Decrypt the data field
        const bytes = CryptoJS.AES.decrypt(
          req.body.data,
          process.env.AES_SECRET_KEY
        );
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

        console.log("Decrypted data for project upload:", decryptedData);

        // Parse the decrypted data
        const parsedData = JSON.parse(decryptedData);

        // Replace req.body with the parsed data while preserving the files
        req.body = {
          ...parsedData,
          // Store files information for the controller
          files: req.files,
        };
      }

      console.log("Final request body for project upload:", req.body);
      next();
    } catch (error) {
      console.error("Processing error:", error);
      // Delete uploaded files if there was an error
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkErr) {
            console.error("Error deleting file:", unlinkErr);
          }
        });
      }
      return res
        .status(400)
        .json({ error: "Failed to process request: " + error.message });
    }
  },
  // Then validate the data
  validateUploadProject,
  validate,
  // Finally handle the upload
  uploadProject
);
router.post(
  "/update_project",
  protect,
  // First handle file uploads
  uploadProjectImages,
  handleProjectUploadErrors,
  // Then process the encrypted data
  (req, res, next) => {
    try {
      console.log("Raw request for project update:", req.body);
      console.log("Files:", req.files);

      // Store project_imgs_urls separately before decryption
      // since it might be outside the encrypted data
      let project_imgs_urls = [];
      if (req.body.project_imgs_urls) {
        if (Array.isArray(req.body.project_imgs_urls)) {
          project_imgs_urls = [...req.body.project_imgs_urls];
        } else {
          project_imgs_urls = [req.body.project_imgs_urls];
        }
      }

      if (req.body && req.body.data) {
        // Decrypt the data field
        const bytes = CryptoJS.AES.decrypt(
          req.body.data,
          process.env.AES_SECRET_KEY
        );
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

        console.log("Decrypted data for project update:", decryptedData);

        // Parse the decrypted data
        const parsedData = JSON.parse(decryptedData);

        // Add newly uploaded file paths
        const newUploadedImages = [];
        if (req.files && req.files.length > 0) {
          req.files.forEach((file) => {
            newUploadedImages.push(`/uploads/projects/${file.filename}`);
          });
        }

        // Replace req.body with the decrypted data
        req.body = parsedData;

        // Add back the project_imgs_urls that weren't part of the encrypted data
        if (project_imgs_urls.length > 0) {
          req.body.project_imgs_urls = project_imgs_urls;
        }

        // Add information about new files
        if (newUploadedImages.length > 0) {
          req.body.new_uploaded_images = newUploadedImages;
        }
      }

      console.log("Final request body for project update:", req.body);
      next();
    } catch (error) {
      console.error("Processing error:", error);
      // Delete uploaded files if there was an error
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkErr) {
            console.error("Error deleting file:", unlinkErr);
          }
        });
      }
      return res
        .status(400)
        .json({ error: "Failed to process request: " + error.message });
    }
  },
  // Then validate the decrypted data
  validateUpdateProject,
  validate,
  // Finally update the project
  updateProject
);

router.post(
  "/delete_project",
  protect,
  decryptRequest,
  validateDeleteProject,
  validate,
  deleteProject
);

// Company document routes
router.get(
  "/get_company_documents",
  protect,
  authorizeCompany,
  getCompanyDocuments
);
// Update the upload_company_documents route
router.post(
  "/upload_company_documents",
  protect,
  authorizeCompany,
  // First handle file uploads
  uploadCompanyDocumentMiddleware,
  handleCompanyDocumentUploadErrors,
  // Then process the encrypted data
  (req, res, next) => {
    try {
      console.log("Raw request for company document upload:", req.body);
      console.log("Files:", req.files);

      if (req.body && req.body.data) {
        // Decrypt the data field
        const bytes = CryptoJS.AES.decrypt(
          req.body.data,
          process.env.AES_SECRET_KEY
        );
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

        console.log(
          "Decrypted data for company document upload:",
          decryptedData
        );

        // Parse the decrypted data
        const parsedData = JSON.parse(decryptedData);

        // Add file information
        if (req.file) {
          // For single file upload
          parsedData.document_path = `/uploads/company/documents/${req.file.filename}`;
        } else if (req.files && req.files.length > 0) {
          // For multiple file upload
          parsedData.document_paths = req.files.map(
            (file) => `/uploads/company/documents/${file.filename}`
          );
        }

        // Replace req.body with the parsed data
        req.body = parsedData;
      }

      console.log("Final request body for company document upload:", req.body);
      next();
    } catch (error) {
      console.error("Processing error:", error);
      // Delete uploaded files if there was an error
      if (req.file) {
        // For single file upload
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.error("Error deleting file:", unlinkErr);
        }
      } else if (req.files && req.files.length > 0) {
        // For multiple file upload
        req.files.forEach((file) => {
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkErr) {
            console.error("Error deleting file:", unlinkErr);
          }
        });
      }
      return res
        .status(400)
        .json({ error: "Failed to process request: " + error.message });
    }
  },
  // Then validate the decrypted data
  validateCompanyDocumentUpload,
  validate,
  // Finally upload the document
  uploadCompanyDocument
);

// Update the update_company_documents route
router.post(
  "/update_company_documents",
  protect,
  authorizeCompany,
  // First handle file uploads
  uploadCompanyDocumentMiddleware,
  handleCompanyDocumentUploadErrors,
  // Then process the encrypted data
  (req, res, next) => {
    try {
      console.log("Raw request for company document update:", req.body);
      console.log("Files:", req.files);

      if (req.body && req.body.data) {
        // Decrypt the data field
        const bytes = CryptoJS.AES.decrypt(
          req.body.data,
          process.env.AES_SECRET_KEY
        );
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

        console.log(
          "Decrypted data for company document update:",
          decryptedData
        );

        // Parse the decrypted data
        const parsedData = JSON.parse(decryptedData);

        // Add file information if files were uploaded
        if (req.file) {
          // For single file upload
          parsedData.new_document_path = `/uploads/company/documents/${req.file.filename}`;
        } else if (req.files && req.files.length > 0) {
          // For multiple file upload
          parsedData.new_document_paths = req.files.map(
            (file) => `/uploads/company/documents/${file.filename}`
          );
        }

        // Replace req.body with the parsed data
        req.body = parsedData;
      }

      console.log("Final request body for company document update:", req.body);
      next();
    } catch (error) {
      console.error("Processing error:", error);
      // Delete uploaded files if there was an error
      if (req.file) {
        // For single file upload
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.error("Error deleting file:", unlinkErr);
        }
      } else if (req.files && req.files.length > 0) {
        // For multiple file upload
        req.files.forEach((file) => {
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkErr) {
            console.error("Error deleting file:", unlinkErr);
          }
        });
      }
      return res
        .status(400)
        .json({ error: "Failed to process request: " + error.message });
    }
  },
  // Then validate the decrypted data
  validateCompanyDocumentUpdate,
  validate,
  // Finally update the document
  updateCompanyDocument
);
router.post(
  "/delete_company_documents",
  protect,
  decryptRequest,
  authorizeCompany,
  validateCompanyDocumentDelete,
  validate,
  deleteCompanyDocument
);

router.post("/update_template", protect, updateProfileTemplate);

module.exports = router;
