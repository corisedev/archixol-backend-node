const Project = require("../models/Project");
const { encryptData } = require("../utils/encryptResponse");
const fs = require("fs");
const path = require("path");

// @desc    Get all projects
// @route   GET /profile/get_projects
// @access  Private
exports.getProjects = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all projects for the user
    const projects = await Project.find({ user_id: userId }).sort({
      createdAt: -1,
    });

    const projectsWithId = projects.map((project) => {
      const projectObj = project.toObject();
      projectObj.id = projectObj._id;
      delete projectObj._id;
      return projectObj;
    });

    const responseData = {
      message: "Projects retrieved successfully",
      projects: projectsWithId,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get single project
// @route   POST /profile/get_project
// @access  Private
exports.getProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { project_id } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    // Find the project
    const project = await Project.findById(project_id);

    const projectObj = project.toObject();
    projectObj.id = projectObj._id;
    delete projectObj._id;

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if project belongs to the user
    if (project.user_id.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to access this project" });
    }

    const responseData = {
      message: "Project retrieved successfully",
      project: projectObj,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Upload project
// @route   POST /profile/upload_project
// @access  Private
exports.uploadProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      project_title,
      project_category,
      project_location,
      project_description,
      start_date,
      end_date,
    } = req.body;

    // Prepare image paths from uploaded files
    const projectImgs = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        projectImgs.push(`/uploads/projects/${file.filename}`);
      });
    }

    // Create new project
    const project = await Project.create({
      user_id: userId,
      project_title,
      project_category,
      project_location,
      project_description,
      start_date,
      end_date,
      project_imgs: projectImgs,
    });

    const projectObj = project.toObject();
    projectObj.id = projectObj._id;
    delete projectObj._id;

    const responseData = {
      message: "Project uploaded successfully",
      project: projectObj,
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error(err);

    // Delete uploaded files if there was an error
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        try {
          fs.unlinkSync(
            path.join(__dirname, "..", "uploads", "projects", file.filename)
          );
        } catch (unlinkErr) {
          console.error("Error deleting file:", unlinkErr);
        }
      });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Update project
// @route   POST /profile/update_project
// @access  Private
exports.updateProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      project_id,
      project_title,
      project_category,
      project_location,
      project_description,
      start_date,
      end_date,
      project_imgs_urls = [],
      new_uploaded_images = [],
    } = req.body;

    console.log("Controller received:", req.body);

    if (!project_id) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    // Find the project
    const project = await Project.findById(project_id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if project belongs to the user
    if (project.user_id.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this project" });
    }

    // Determine which old images to keep
    const imagesToKeep = [];
    const imagesToDelete = [];

    project.project_imgs.forEach((img) => {
      if (project_imgs_urls.includes(img)) {
        imagesToKeep.push(img);
      } else {
        imagesToDelete.push(img);
      }
    });

    // Delete images that are no longer needed
    imagesToDelete.forEach((img) => {
      try {
        const imgPath = path.join(__dirname, "..", img);
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      } catch (unlinkErr) {
        console.error("Error deleting image:", unlinkErr);
        // Continue even if deletion fails
      }
    });

    // Combine kept images with new images
    const updatedImages = [...imagesToKeep, ...new_uploaded_images];

    // Update project fields
    const updatedProject = {
      project_title: project_title || project.project_title,
      project_category: project_category || project.project_category,
      project_location: project_location || project.project_location,
      project_description: project_description || project.project_description,
      start_date: start_date || project.start_date,
      end_date: end_date || project.end_date,
      project_imgs: updatedImages,
      updatedAt: Date.now(),
    };

    // Update project in database
    const result = await Project.findByIdAndUpdate(project_id, updatedProject, {
      new: true,
    });

    // Convert _id to id for consistent frontend usage
    const resultObj = result.toObject();
    resultObj.id = resultObj._id.toString();
    delete resultObj._id;

    const responseData = {
      message: "Project updated successfully",
      project: resultObj,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Delete project
// @route   POST /profile/delete_project
// @access  Private
exports.deleteProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { project_id } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    // Find the project
    const project = await Project.findById(project_id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if project belongs to the user
    if (project.user_id.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this project" });
    }

    // Delete project images
    project.project_imgs.forEach((img) => {
      try {
        const imgPath = path.join(__dirname, "..", img);
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      } catch (unlinkErr) {
        console.error("Error deleting image:", unlinkErr);
        // Continue even if deletion fails
      }
    });

    // Delete the service using findByIdAndDelete (instead of remove)
    await Project.findByIdAndDelete(project_id);

    const responseData = {
      message: "Project deleted successfully",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
