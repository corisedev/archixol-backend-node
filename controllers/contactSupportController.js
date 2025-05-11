// controllers/contactSupportController.js
const {
  ContactMessage,
  Feedback,
  SupportRequest,
} = require("../models/ContactSupport");
const User = require("../models/User");
const { encryptData } = require("../utils/encryptResponse");
const sendEmail = require("../utils/email");

// @desc    Send contact message
// @route   POST /account/contact
// @access  Public
exports.sendContactMessage = async (req, res) => {
  try {
    const { fullname, email, phone_number, subject, message } = req.body;

    // Validate required fields
    if (!fullname || !email || !subject || !message) {
      return res
        .status(400)
        .json({ error: "Please provide all required fields" });
    }

    // Create contact message
    const contactMessage = await ContactMessage.create({
      user_id: req.user ? req.user.id : null, // Use authenticated user if available
      fullname,
      email,
      phone_number: phone_number || "",
      subject,
      message,
    });

    // Send notification email to admin
    try {
      const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";

      await sendEmail({
        email: adminEmail,
        subject: `New Contact Message: ${subject}`,
        message: `
            <h1>New Contact Message</h1>
            <p><strong>From:</strong> ${fullname} (${email})</p>
            <p><strong>Phone:</strong> ${phone_number || "Not provided"}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <p>${message}</p>
          `,
      });
    } catch (emailError) {
      console.error("Error sending notification email:", emailError);
      // Continue even if notification email fails
    }

    // Send confirmation email to user
    try {
      await sendEmail({
        email: email,
        subject: "Your message has been received",
        message: `
            <h1>Thank you for contacting us</h1>
            <p>Dear ${fullname},</p>
            <p>We have received your message regarding "${subject}" and will get back to you shortly.</p>
            <p>Best regards,</p>
            <p>The Archixol Team</p>
          `,
      });
    } catch (emailError) {
      console.error("Error sending confirmation email:", emailError);
      // Continue even if confirmation email fails
    }

    const responseData = {
      message:
        "Your message has been sent successfully. We will contact you soon.",
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Send feedback
// @route   POST /account/feedback
// @access  Public
exports.sendFeedback = async (req, res) => {
  try {
    const { fullname, email, feedback, suggestions, feedback_type, rating } =
      req.body;

    // Validate required fields
    if (!fullname || !email || !feedback) {
      return res
        .status(400)
        .json({ error: "Please provide all required fields" });
    }

    // Create feedback
    const feedbackEntry = await Feedback.create({
      user_id: req.user ? req.user.id : null, // Use authenticated user if available
      fullname,
      email,
      feedback,
      suggestions: suggestions || "",
      feedback_type: feedback_type || "general",
      rating: rating || 0,
    });

    // Send notification email to admin
    try {
      const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";

      await sendEmail({
        email: adminEmail,
        subject: `New Feedback Received`,
        message: `
            <h1>New Feedback</h1>
            <p><strong>From:</strong> ${fullname} (${email})</p>
            <p><strong>Type:</strong> ${feedback_type || "General"}</p>
            <p><strong>Rating:</strong> ${rating || "Not provided"}/5</p>
            <p><strong>Feedback:</strong></p>
            <p>${feedback}</p>
            <p><strong>Suggestions:</strong></p>
            <p>${suggestions || "None provided"}</p>
          `,
      });
    } catch (emailError) {
      console.error("Error sending notification email:", emailError);
      // Continue even if notification email fails
    }

    // Send thank you email to user
    try {
      await sendEmail({
        email: email,
        subject: "Thank you for your feedback",
        message: `
            <h1>Thank you for your feedback</h1>
            <p>Dear ${fullname},</p>
            <p>We appreciate you taking the time to share your thoughts with us. Your feedback helps us improve our services.</p>
            <p>Best regards,</p>
            <p>The Archixol Team</p>
          `,
      });
    } catch (emailError) {
      console.error("Error sending thank you email:", emailError);
      // Continue even if thank you email fails
    }

    const responseData = {
      message: "Thank you for your feedback!",
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Create support request
// @route   POST /account/support
// @access  Public
exports.createSupportRequest = async (req, res) => {
  try {
    const {
      fullname,
      email,
      phone_number,
      support_category,
      subject,
      message,
    } = req.body;

    // Validate required fields
    if (!fullname || !email || !subject || !message) {
      return res
        .status(400)
        .json({ error: "Please provide all required fields" });
    }

    // Create support request
    const supportRequest = await SupportRequest.create({
      user_id: req.user ? req.user.id : null, // Use authenticated user if available
      fullname,
      email,
      phone_number: phone_number || "",
      support_category: support_category || "other",
      subject,
      message,
    });

    // Send notification email to support team
    try {
      const supportEmail = process.env.SUPPORT_EMAIL || "support@example.com";

      await sendEmail({
        email: supportEmail,
        subject: `New Support Request: ${subject}`,
        message: `
            <h1>New Support Request</h1>
            <p><strong>Ticket:</strong> ${supportRequest.ticket_number}</p>
            <p><strong>From:</strong> ${fullname} (${email})</p>
            <p><strong>Phone:</strong> ${phone_number || "Not provided"}</p>
            <p><strong>Category:</strong> ${support_category || "Other"}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <p>${message}</p>
          `,
      });
    } catch (emailError) {
      console.error("Error sending notification email:", emailError);
      // Continue even if notification email fails
    }

    // Send confirmation email to user
    try {
      await sendEmail({
        email: email,
        subject: `Your Support Request - ${supportRequest.ticket_number}`,
        message: `
            <h1>Support Request Received</h1>
            <p>Dear ${fullname},</p>
            <p>We have received your support request with ticket number <strong>${
              supportRequest.ticket_number
            }</strong>.</p>
            <p>Our support team will review your request and respond as soon as possible. Please keep this ticket number for reference.</p>
            <p><strong>Request Details:</strong></p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Category:</strong> ${support_category || "Other"}</p>
            <p><strong>Message:</strong> ${message}</p>
            <p>Thank you for your patience.</p>
            <p>Best regards,</p>
            <p>The Archixol Support Team</p>
          `,
      });
    } catch (emailError) {
      console.error("Error sending confirmation email:", emailError);
      // Continue even if confirmation email fails
    }

    const responseData = {
      message: `Your support request has been submitted successfully. Your ticket number is ${supportRequest.ticket_number}.`,
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
