// utils/notificationService.js
const Notification = require("../models/Notification");

class NotificationService {
  constructor() {
    this.socketService = null;
  }

  // Initialize with socket service
  init(socketService) {
    this.socketService = socketService;
    console.log("Notification service initialized with WebSocket");
  }

  // Generic notification sender
  async sendNotification({
    recipient,
    sender = null,
    type = "info",
    title,
    message,
    data = {},
    saveToDb = true,
    realTime = true,
  }) {
    try {
      let notificationRecord = null;

      // Save to database if required
      if (saveToDb) {
        notificationRecord = new Notification({
          recipient,
          sender,
          type,
          message: `${title}: ${message}`,
          conversation: data.conversation_id || null,
          isRead: false,
        });
        await notificationRecord.save();
      }

      // Send real-time notification if WebSocket is available and enabled
      if (realTime && this.socketService) {
        const notificationData = {
          id: notificationRecord ? notificationRecord._id : null,
          type,
          title,
          message,
          timestamp: new Date().toISOString(),
          sender: sender ? { id: sender, username: data.senderUsername } : null,
          data,
        };

        // Send to specific user
        const sent = this.socketService.emitToUser(
          recipient.toString(),
          "newNotification",
          notificationData
        );

        console.log(
          `Notification ${sent ? "sent" : "queued"} to user ${recipient}:`,
          { type, title, message }
        );

        return {
          success: true,
          sent,
          notificationId: notificationRecord ? notificationRecord._id : null,
        };
      }

      return {
        success: true,
        sent: false,
        notificationId: notificationRecord ? notificationRecord._id : null,
      };
    } catch (error) {
      console.error("Error sending notification:", error);
      return { success: false, error: error.message };
    }
  }

  // Project-related notifications
  async sendProjectNotification({
    recipient,
    sender,
    projectTitle,
    action,
    projectId,
    senderUsername,
  }) {
    const messages = {
      created: `New project "${projectTitle}" has been created`,
      applied: `New application received for "${projectTitle}"`,
      accepted: `Your proposal for "${projectTitle}" has been accepted`,
      rejected: `Your proposal for "${projectTitle}" has been rejected`,
      completed: `Project "${projectTitle}" has been completed`,
      cancelled: `Project "${projectTitle}" has been cancelled`,
      updated: `Project "${projectTitle}" has been updated`,
    };

    return await this.sendNotification({
      recipient,
      sender,
      type: "project",
      title: "Project Update",
      message: messages[action] || `Project "${projectTitle}" status changed`,
      data: {
        projectId,
        projectTitle,
        action,
        senderUsername,
      },
    });
  }

  // Order-related notifications
  async sendOrderNotification({
    recipient,
    sender,
    orderNo,
    action,
    orderId,
    senderUsername,
  }) {
    const messages = {
      placed: `New order ${orderNo} has been placed`,
      confirmed: `Order ${orderNo} has been confirmed`,
      shipped: `Order ${orderNo} has been shipped`,
      delivered: `Order ${orderNo} has been delivered`,
      cancelled: `Order ${orderNo} has been cancelled`,
      refunded: `Order ${orderNo} has been refunded`,
      updated: `Order ${orderNo} has been updated`,
    };

    return await this.sendNotification({
      recipient,
      sender,
      type: "order",
      title: "Order Update",
      message: messages[action] || `Order ${orderNo} status changed`,
      data: {
        orderId,
        orderNo,
        action,
        senderUsername,
      },
    });
  }

  // Service-related notifications
  async sendServiceNotification({
    recipient,
    sender,
    serviceTitle,
    action,
    serviceId,
    senderUsername,
  }) {
    const messages = {
      requested: `Service "${serviceTitle}" has been requested`,
      accepted: `Service request for "${serviceTitle}" has been accepted`,
      rejected: `Service request for "${serviceTitle}" has been rejected`,
      completed: `Service "${serviceTitle}" has been completed`,
      cancelled: `Service "${serviceTitle}" has been cancelled`,
      updated: `Service "${serviceTitle}" has been updated`,
    };

    return await this.sendNotification({
      recipient,
      sender,
      type: "service",
      title: "Service Update",
      message: messages[action] || `Service "${serviceTitle}" status changed`,
      data: {
        serviceId,
        serviceTitle,
        action,
        senderUsername,
      },
    });
  }

  // Chat/Message notifications
  async sendMessageNotification({
    recipient,
    sender,
    conversationId,
    messagePreview,
    senderUsername,
  }) {
    return await this.sendNotification({
      recipient,
      sender,
      type: "message",
      title: "New Message",
      message: `${senderUsername}: ${messagePreview}`,
      data: {
        conversationId,
        messagePreview,
        senderUsername,
      },
      saveToDb: true,
      realTime: true,
    });
  }

  // System notifications (admin announcements, updates, etc.)
  async sendSystemNotification({
    recipient,
    title,
    message,
    priority = "normal",
    category = "general",
  }) {
    return await this.sendNotification({
      recipient,
      sender: null,
      type: "system",
      title,
      message,
      data: {
        priority,
        category,
      },
    });
  }

  // Payment notifications
  async sendPaymentNotification({
    recipient,
    sender,
    amount,
    action,
    paymentId,
    orderId,
    senderUsername,
  }) {
    const messages = {
      received: `Payment of $${amount} has been received`,
      sent: `Payment of $${amount} has been sent`,
      refunded: `Refund of $${amount} has been processed`,
      failed: `Payment of $${amount} failed`,
      pending: `Payment of $${amount} is pending`,
    };

    return await this.sendNotification({
      recipient,
      sender,
      type: "payment",
      title: "Payment Update",
      message: messages[action] || `Payment status changed`,
      data: {
        amount,
        action,
        paymentId,
        orderId,
        senderUsername,
      },
    });
  }

  // Bulk notifications (send to multiple users)
  async sendBulkNotifications({
    recipients,
    sender,
    type,
    title,
    message,
    data = {},
    saveToDb = true,
    realTime = true,
  }) {
    const results = [];

    for (const recipient of recipients) {
      const result = await this.sendNotification({
        recipient,
        sender,
        type,
        title,
        message,
        data,
        saveToDb,
        realTime,
      });
      results.push({ recipient, ...result });
    }

    return results;
  }

  // Broadcast to all users of a specific type
  async broadcastToUserType({
    userType,
    type,
    title,
    message,
    data = {},
    saveToDb = false,
  }) {
    if (!this.socketService) {
      console.error("Socket service not available for broadcast");
      return { success: false, error: "Socket service unavailable" };
    }

    const notificationData = {
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    this.socketService.emitToUserType(
      userType,
      "newNotification",
      notificationData
    );

    console.log(`Broadcast notification sent to all ${userType}s:`, {
      type,
      title,
      message,
    });

    return { success: true, broadcast: true };
  }

  // Broadcast to all connected users
  async broadcastToAll({ type, title, message, data = {}, saveToDb = false }) {
    if (!this.socketService) {
      console.error("Socket service not available for broadcast");
      return { success: false, error: "Socket service unavailable" };
    }

    const notificationData = {
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    this.socketService.emitToAll("newNotification", notificationData);

    console.log(`Broadcast notification sent to all users:`, {
      type,
      title,
      message,
    });

    return { success: true, broadcast: true };
  }

  // Schedule notification (you can integrate with a job queue later)
  async scheduleNotification({
    recipient,
    sender,
    type,
    title,
    message,
    scheduleTime,
    data = {},
  }) {
    // For now, we'll save it with a special flag
    // Later you can integrate with a job queue like Bull or Agenda
    const notificationRecord = new Notification({
      recipient,
      sender,
      type,
      message: `${title}: ${message}`,
      isRead: false,
      // Add a custom field for scheduled notifications
      scheduledFor: scheduleTime,
      isScheduled: true,
    });

    await notificationRecord.save();

    console.log(`Notification scheduled for ${scheduleTime}:`, {
      type,
      title,
      message,
      recipient,
    });

    return {
      success: true,
      scheduled: true,
      notificationId: notificationRecord._id,
    };
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { isRead: true },
        { new: true }
      );

      return { success: true, notification };
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return { success: false, error: error.message };
    }
  }

  // Get unread count for a user
  async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        recipient: userId,
        isRead: false,
      });

      return { success: true, count };
    } catch (error) {
      console.error("Error getting unread count:", error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

module.exports = notificationService;
