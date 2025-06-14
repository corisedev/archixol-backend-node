// utils/notificationHelpers.js
const notificationService = require("./notificationService");

// Quick notification functions for common use cases

// Project notifications
const notifyProjectCreated = async (clientId, projectTitle, projectId) => {
  return await notificationService.sendProjectNotification({
    recipient: clientId,
    sender: null,
    projectTitle,
    action: "created",
    projectId,
    senderUsername: "System",
  });
};

const notifyProjectApplication = async (
  clientId,
  serviceProviderId,
  projectTitle,
  projectId,
  providerName
) => {
  return await notificationService.sendProjectNotification({
    recipient: clientId,
    sender: serviceProviderId,
    projectTitle,
    action: "applied",
    projectId,
    senderUsername: providerName,
  });
};

const notifyProposalAccepted = async (
  serviceProviderId,
  clientId,
  projectTitle,
  projectId,
  clientName
) => {
  return await notificationService.sendProjectNotification({
    recipient: serviceProviderId,
    sender: clientId,
    projectTitle,
    action: "accepted",
    projectId,
    senderUsername: clientName,
  });
};

const notifyProposalRejected = async (
  serviceProviderId,
  clientId,
  projectTitle,
  projectId,
  clientName
) => {
  return await notificationService.sendProjectNotification({
    recipient: serviceProviderId,
    sender: clientId,
    projectTitle,
    action: "rejected",
    projectId,
    senderUsername: clientName,
  });
};

// Order notifications
const notifyNewOrder = async (
  supplierId,
  clientId,
  orderNo,
  orderId,
  clientName
) => {
  return await notificationService.sendOrderNotification({
    recipient: supplierId,
    sender: clientId,
    orderNo,
    action: "placed",
    orderId,
    senderUsername: clientName,
  });
};

const notifyOrderStatusChange = async (
  clientId,
  supplierId,
  orderNo,
  orderId,
  action,
  supplierName
) => {
  return await notificationService.sendOrderNotification({
    recipient: clientId,
    sender: supplierId,
    orderNo,
    action,
    orderId,
    senderUsername: supplierName,
  });
};

// Service notifications
const notifyServiceRequest = async (
  serviceProviderId,
  clientId,
  serviceTitle,
  serviceId,
  clientName
) => {
  return await notificationService.sendServiceNotification({
    recipient: serviceProviderId,
    sender: clientId,
    serviceTitle,
    action: "requested",
    serviceId,
    senderUsername: clientName,
  });
};

// Message notifications
const notifyNewMessage = async (
  recipientId,
  senderId,
  conversationId,
  messagePreview,
  senderName
) => {
  return await notificationService.sendMessageNotification({
    recipient: recipientId,
    sender: senderId,
    conversationId,
    messagePreview,
    senderUsername: senderName,
  });
};

// Payment notifications
const notifyPaymentReceived = async (userId, amount, orderId, paymentId) => {
  return await notificationService.sendPaymentNotification({
    recipient: userId,
    sender: null,
    amount,
    action: "received",
    paymentId,
    orderId,
    senderUsername: "System",
  });
};

// System notifications
const notifySystemMaintenance = async () => {
  return await notificationService.broadcastToAll({
    type: "system",
    title: "System Maintenance",
    message:
      "The system will undergo maintenance in 30 minutes. Please save your work.",
    data: { priority: "high", category: "maintenance" },
  });
};

const notifyNewFeature = async (userType, featureName, description) => {
  return await notificationService.broadcastToUserType({
    userType,
    type: "system",
    title: "New Feature Available",
    message: `${featureName}: ${description}`,
    data: { priority: "normal", category: "feature", featureName },
  });
};

// Admin notifications
const notifyAdminNewUser = async (adminIds, newUserName, userType) => {
  return await notificationService.sendBulkNotifications({
    recipients: adminIds,
    sender: null,
    type: "system",
    title: "New User Registration",
    message: `New ${userType} "${newUserName}" has registered`,
    data: { category: "user_management", userType, newUserName },
  });
};

const notifyAdminHighValueOrder = async (
  adminIds,
  orderNo,
  amount,
  supplierName
) => {
  return await notificationService.sendBulkNotifications({
    recipients: adminIds,
    sender: null,
    type: "order",
    title: "High Value Order",
    message: `Order ${orderNo} worth $${amount} placed with ${supplierName}`,
    data: { category: "high_value", orderNo, amount, supplierName },
  });
};

// Custom notification wrapper for specific topics
const notify = {
  // Project-related
  project: {
    created: notifyProjectCreated,
    applied: notifyProjectApplication,
    accepted: notifyProposalAccepted,
    rejected: notifyProposalRejected,
  },

  // Order-related
  order: {
    placed: notifyNewOrder,
    statusChanged: notifyOrderStatusChange,
  },

  // Service-related
  service: {
    requested: notifyServiceRequest,
  },

  // Message-related
  message: {
    new: notifyNewMessage,
  },

  // Payment-related
  payment: {
    received: notifyPaymentReceived,
  },

  // System-related
  system: {
    maintenance: notifySystemMaintenance,
    newFeature: notifyNewFeature,
  },

  // Admin-related
  admin: {
    newUser: notifyAdminNewUser,
    highValueOrder: notifyAdminHighValueOrder,
  },

  // Generic notification
  send: async ({ type, title, message, recipient, sender, data = {} }) => {
    return await notificationService.sendNotification({
      recipient,
      sender,
      type,
      title,
      message,
      data,
    });
  },

  // Broadcast notifications
  broadcast: {
    toAll: async ({ type, title, message, data = {} }) => {
      return await notificationService.broadcastToAll({
        type,
        title,
        message,
        data,
      });
    },
    toUserType: async ({ userType, type, title, message, data = {} }) => {
      return await notificationService.broadcastToUserType({
        userType,
        type,
        title,
        message,
        data,
      });
    },
  },
};

module.exports = {
  notify,
  notificationService,
  // Export individual functions for backward compatibility
  notifyProjectCreated,
  notifyProjectApplication,
  notifyProposalAccepted,
  notifyProposalRejected,
  notifyNewOrder,
  notifyOrderStatusChange,
  notifyServiceRequest,
  notifyNewMessage,
  notifyPaymentReceived,
  notifySystemMaintenance,
  notifyNewFeature,
  notifyAdminNewUser,
  notifyAdminHighValueOrder,
};
