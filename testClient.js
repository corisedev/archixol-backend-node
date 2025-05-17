// testClient.js
const axios = require("axios");
const io = require("socket.io-client");
const readline = require("readline");
const fs = require("fs");
const FormData = require("form-data");
const path = require("path");

// Configuration
const API_URL = process.env.API_URL || "http://localhost:5000";
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || "http://localhost:5000";

// Create readline interface for command-line input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// State variables
let token = null;
let user = null;
let socket = null;
let currentConversation = null;
let conversations = [];

// Helper functions
const formatDate = (date) => {
  return new Date(date).toLocaleString();
};

const logMessage = (msg) => {
  console.log(
    `[${formatDate(msg.createdAt)}] ${msg.sender.username}: ${msg.text}`
  );
};

const askQuestion = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

// API functions with encryption handling (simplified for testing)
const api = {
  login: async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/account/login`, {
        email,
        password,
      });
      if (response.data && response.data.data) {
        // This is a simplified version - in production you'd use proper decryption
        const responseData = response.data.data;
        console.log("Login successful!");
        return {
          token: responseData.token,
          user: {
            id: responseData.user_data.id,
            username: responseData.user_data.username,
            email: responseData.user_data.email,
            userType: responseData.user_type,
          },
        };
      }
      throw new Error("Invalid response format");
    } catch (error) {
      console.error(
        "Login failed:",
        error.response?.data?.error || error.message
      );
      return null;
    }
  },

  getConversations: async () => {
    try {
      const response = await axios.get(`${API_URL}/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      }); // testClient.js
      const axios = require("axios");
      const io = require("socket.io-client");
      const readline = require("readline");
      const fs = require("fs");
      const FormData = require("form-data");
      const path = require("path");

      // Configuration
      const API_URL = process.env.API_URL || "http://localhost:5000";
      const WEBSOCKET_URL =
        process.env.WEBSOCKET_URL || "http://localhost:5000";

      // Create readline interface for command-line input
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      // State variables
      let token = null;
      let user = null;
      let socket = null;
      let currentConversation = null;
      let conversations = [];

      // Helper functions
      const formatDate = (date) => {
        return new Date(date).toLocaleString();
      };

      const logMessage = (msg) => {
        console.log(
          `[${formatDate(msg.createdAt)}] ${msg.sender.username}: ${msg.text}`
        );
      };

      const askQuestion = (query) =>
        new Promise((resolve) => rl.question(query, resolve));

      // API functions with encryption handling (simplified for testing)
      const api = {
        login: async (email, password) => {
          try {
            const response = await axios.post(`${API_URL}/account/login`, {
              email,
              password,
            });
            console.log(
              "Login response:",
              JSON.stringify(response.data, null, 2)
            );

            if (response.data && response.data.data) {
              try {
                // This is a simplified version for testing - extracting the data
                // The actual response is encrypted, but for testing we'll directly parse it
                // In a real application, you would properly decrypt this
                let responseData;

                // Handle different response structures
                if (typeof response.data.data === "string") {
                  // Try to parse if it's JSON
                  try {
                    responseData = JSON.parse(response.data.data);
                  } catch (e) {
                    // If not JSON, assume it's the data itself
                    responseData = response.data.data;
                  }
                } else {
                  // Already an object
                  responseData = response.data.data;
                }

                console.log("Parsed response data:", responseData);

                // Extract token and user data based on the structure
                let token, userData;

                if (responseData.token) {
                  // Direct structure
                  token = responseData.token;
                  userData = {
                    id: responseData.user_data?.id,
                    username: responseData.user_data?.username,
                    email: responseData.user_data?.email,
                    userType: responseData.user_type,
                  };
                } else if (
                  responseData.message &&
                  responseData.message === "Login successful"
                ) {
                  // Alternative structure
                  token = responseData.token;
                  userData = {
                    id: responseData.user_data?.id || responseData.id,
                    username:
                      responseData.user_data?.username || responseData.username,
                    email: responseData.user_data?.email || responseData.email,
                    userType: responseData.user_type,
                  };
                }

                if (token) {
                  console.log("Login successful!");
                  console.log("Token:", token);
                  console.log("User:", userData);

                  return {
                    token,
                    user: userData,
                  };
                }
              } catch (parseError) {
                console.error("Error parsing response data:", parseError);
              }
            }

            throw new Error("Invalid response format or login failed");
          } catch (error) {
            console.error(
              "Login failed:",
              error.response?.data?.error || error.message
            );
            return null;
          }
        },

        getConversations: async () => {
          try {
            if (!token) {
              console.error("No authentication token available");
              return [];
            }

            console.log(
              "Fetching conversations with token:",
              token.substring(0, 10) + "..."
            );

            const response = await axios.get(`${API_URL}/chat/conversations`, {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            });

            console.log("Get conversations response:", response.status);

            if (response.data && response.data.data) {
              // Simplified decryption for testing
              let conversations;
              if (typeof response.data.data === "string") {
                try {
                  conversations = JSON.parse(response.data.data).conversations;
                } catch (e) {
                  console.error("Error parsing conversations data:", e);
                  return [];
                }
              } else {
                conversations = response.data.data.conversations;
              }
              return conversations || [];
            }
            return [];
          } catch (error) {
            console.error(
              "Failed to get conversations:",
              error.response?.data?.error || error.message
            );
            return [];
          }
        },

        getMessages: async (conversationId, page = 1) => {
          try {
            const response = await axios.post(
              `${API_URL}/chat/messages`,
              { conversation_id: conversationId, page, limit: 20 },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data && response.data.data) {
              // Simplified decryption for testing
              return response.data.data.messages;
            }
            return [];
          } catch (error) {
            console.error(
              "Failed to get messages:",
              error.response?.data?.error || error.message
            );
            return [];
          }
        },

        startConversation: async (participantId) => {
          try {
            const response = await axios.post(
              `${API_URL}/chat/conversation/start`,
              { participant_id: participantId },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data && response.data.data) {
              // Simplified decryption for testing
              return response.data.data.conversation;
            }
            return null;
          } catch (error) {
            console.error(
              "Failed to start conversation:",
              error.response?.data?.error || error.message
            );
            return null;
          }
        },

        sendMessage: async (conversationId, text) => {
          try {
            const response = await axios.post(
              `${API_URL}/chat/send`,
              { conversation_id: conversationId, text },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data && response.data.data) {
              // Simplified decryption for testing
              return response.data.data.sentMessage;
            }
            return null;
          } catch (error) {
            console.error(
              "Failed to send message:",
              error.response?.data?.error || error.message
            );
            return null;
          }
        },

        markAsRead: async (conversationId) => {
          try {
            await axios.post(
              `${API_URL}/chat/mark-read`,
              { conversation_id: conversationId },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            return true;
          } catch (error) {
            console.error(
              "Failed to mark as read:",
              error.response?.data?.error || error.message
            );
            return false;
          }
        },

        sendAttachment: async (conversationId, filePath) => {
          try {
            const formData = new FormData();
            formData.append("attachments", fs.createReadStream(filePath));

            // Add conversation_id and other data
            formData.append(
              "data",
              JSON.stringify({ conversation_id: conversationId })
            );

            const response = await axios.post(
              `${API_URL}/uploads/chat/send-with-attachments`,
              formData,
              {
                headers: {
                  ...formData.getHeaders(),
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (response.data && response.data.data) {
              // Simplified decryption for testing
              return response.data.data.sentMessage;
            }
            return null;
          } catch (error) {
            console.error(
              "Failed to send attachment:",
              error.response?.data?.error || error.message
            );
            return null;
          }
        },

        searchUsers: async (query) => {
          try {
            if (!token) {
              console.error("No authentication token available");
              return [];
            }

            console.log(`Searching users with query: "${query}"`);

            const response = await axios.post(
              `${API_URL}/chat/search-users`,
              { query },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              }
            );

            console.log("Search users response:", response.status);

            if (response.data && response.data.data) {
              // Simplified decryption for testing
              let users;
              if (typeof response.data.data === "string") {
                try {
                  users = JSON.parse(response.data.data).users;
                } catch (e) {
                  console.error("Error parsing users data:", e);
                  return [];
                }
              } else {
                users = response.data.data.users;
              }
              return users || [];
            }
            return [];
          } catch (error) {
            console.error(
              "Failed to search users:",
              error.response?.data?.error || error.message
            );
            return [];
          }
        },
      };

      // Socket handling
      const setupSocket = () => {
        if (!token) {
          console.error("Cannot connect socket: No authentication token");
          return null;
        }

        console.log("Setting up socket with token:", token);

        // Connect to socket with auth token
        const socketClient = io(WEBSOCKET_URL, {
          auth: {
            token: token,
          },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        // Socket event handlers
        socketClient.on("connect", () => {
          console.log("Socket connected successfully!");
        });

        socketClient.on("connect_error", (error) => {
          console.error("Socket connection error:", error.message);
          console.log("Connection details:", {
            url: WEBSOCKET_URL,
            token: token ? token.substring(0, 10) + "..." : "none",
          });
        });

        socketClient.on("disconnect", (reason) => {
          console.log("Socket disconnected:", reason);
        });

        // Chat-specific events
        socketClient.on("newMessage", (data) => {
          const { message, conversation } = data;

          // If this is for the current conversation, show it immediately
          if (
            currentConversation &&
            message.conversation === currentConversation._id
          ) {
            logMessage(message);

            // Mark message as read
            socketClient.emit("markRead", {
              conversation_id: currentConversation._id,
            });
            api.markAsRead(currentConversation._id);
          } else {
            // Just notify about new message in another conversation
            console.log(
              `\n[NEW MESSAGE] from ${message.sender.username} in another conversation`
            );
          }

          // Update the appropriate conversation in our list
          const convIndex = conversations.findIndex(
            (c) => c._id === message.conversation
          );
          if (convIndex >= 0) {
            conversations[convIndex].lastMessage = {
              text: message.text,
              createdAt: message.createdAt,
            };
            conversations[convIndex].unreadCount += 1;
          }
        });

        socketClient.on("typingStatus", (data) => {
          const { conversation_id, user_id, is_typing } = data;

          // Only show typing indicator for current conversation
          if (
            currentConversation &&
            conversation_id === currentConversation._id
          ) {
            if (is_typing) {
              // Find the user name
              const participant = currentConversation.participants.find(
                (p) => p._id === user_id
              );
              if (participant) {
                console.log(`\n[${participant.username} is typing...]`);
              }
            }
          }
        });

        socketClient.on("userStatusChanged", (data) => {
          const { user_id, status } = data;

          // Update status in conversations
          conversations.forEach((conv) => {
            const participant = conv.participants.find(
              (p) => p._id === user_id
            );
            if (participant) {
              participant.isOnline = status.isOnline;
              participant.lastSeen = status.lastSeen;

              // Log the status change if it's the current conversation
              if (currentConversation && conv._id === currentConversation._id) {
                console.log(
                  `\n[${participant.username} is now ${
                    status.isOnline ? "online" : "offline"
                  }]`
                );
              }
            }
          });
        });

        socketClient.on("messagesRead", (data) => {
          const { conversation_id, reader } = data;

          // Only relevant for current conversation
          if (
            currentConversation &&
            conversation_id === currentConversation._id
          ) {
            console.log(`\n[Messages read by other participant]`);
          }
        });

        return socketClient;
      };

      // Command functions
      const commands = {
        help: () => {
          console.log("\n--- Chat Test Client Commands ---");
          console.log("/help - Show this help");
          console.log("/exit - Exit the application");
          console.log(
            "/login <email> <password> - Login with email and password"
          );
          console.log("/conversations - List all conversations");
          console.log("/open <index> - Open conversation by index");
          console.log("/search <query> - Search for users");
          console.log("/start <user_id> - Start a new conversation");
          console.log("/send <message> - Send message in current conversation");
          console.log(
            "/attach <file_path> - Send attachment in current conversation"
          );
          console.log("/typing - Toggle typing indicator");
          console.log("/read - Mark current conversation as read");
          console.log("/back - Go back to conversation list");
          console.log("/status - Show current connection status");
          console.log("-------------------------------\n");
        },

        login: async (args) => {
          if (args.length < 2) {
            console.log("Usage: /login <email> <password>");
            return;
          }

          const [email, password] = args;
          const result = await api.login(email, password);

          if (result) {
            token = result.token;
            user = result.user;

            console.log(`Logged in as ${user.username} (${user.userType})`);

            // Setup socket after login
            socket = setupSocket();

            // Get initial conversations
            await commands.conversations();
          }
        },

        conversations: async () => {
          conversations = await api.getConversations();

          if (conversations.length === 0) {
            console.log("No conversations found");
            return;
          }

          console.log("\n--- Your Conversations ---");
          conversations.forEach((conv, index) => {
            const participant = conv.participants[0]; // In a direct chat, just show the other person
            const lastMsg = conv.lastMessage
              ? `${conv.lastMessage.text.substring(0, 30)}${
                  conv.lastMessage.text.length > 30 ? "..." : ""
                }`
              : "No messages yet";

            console.log(
              `[${index}] ${participant.username} (${
                participant.user_type
              }) - ${lastMsg} ${
                conv.unreadCount > 0 ? `(${conv.unreadCount} unread)` : ""
              }`
            );
          });
          console.log("------------------------\n");
        },

        open: async (args) => {
          if (args.length < 1) {
            console.log("Usage: /open <index>");
            return;
          }

          const index = parseInt(args[0], 10);
          if (isNaN(index) || index < 0 || index >= conversations.length) {
            console.log("Invalid conversation index");
            return;
          }

          currentConversation = conversations[index];

          // Get messages for this conversation
          const messages = await api.getMessages(currentConversation._id);

          // Display conversation header
          const participant = currentConversation.participants[0];
          console.log(
            `\n--- Conversation with ${participant.username} (${participant.user_type}) ---`
          );
          console.log(
            `Status: ${
              participant.isOnline
                ? "Online"
                : "Last seen " + formatDate(participant.lastSeen)
            }`
          );

          // Display messages in chronological order (oldest first)
          console.log("--- Messages ---");

          if (messages.length === 0) {
            console.log("No messages in this conversation");
          } else {
            // Sort messages by date (oldest first)
            messages
              .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
              .forEach(logMessage);
          }

          // Mark conversation as read
          if (currentConversation.unreadCount > 0) {
            await api.markAsRead(currentConversation._id);
            if (socket) {
              socket.emit("markRead", {
                conversation_id: currentConversation._id,
              });
            }

            // Update local state
            const convIndex = conversations.findIndex(
              (c) => c._id === currentConversation._id
            );
            if (convIndex >= 0) {
              conversations[convIndex].unreadCount = 0;
            }
          }

          // If connected to socket, emit that we're viewing this conversation
          if (socket) {
            socket.emit("viewingConversation", {
              conversation_id: currentConversation._id,
              is_viewing: true,
            });
          }
        },

        search: async (args) => {
          if (args.length < 1) {
            console.log("Usage: /search <query>");
            return;
          }

          const query = args.join(" ");
          const users = await api.searchUsers(query);

          if (users.length === 0) {
            console.log("No users found");
            return;
          }

          console.log("\n--- Found Users ---");
          users.forEach((user, index) => {
            console.log(
              `[${index}] ${user.username} (${user.user_type}) - ${
                user.email
              } - ${user.isOnline ? "Online" : "Offline"}`
            );
          });
          console.log("------------------\n");

          const response = await askQuestion(
            'Start conversation with a user? (Enter index or "cancel"): '
          );

          if (response.toLowerCase() !== "cancel") {
            const index = parseInt(response, 10);
            if (!isNaN(index) && index >= 0 && index < users.length) {
              await commands.start([users[index]._id]);
            } else {
              console.log("Invalid selection");
            }
          }
        },

        start: async (args) => {
          if (args.length < 1) {
            console.log("Usage: /start <user_id>");
            return;
          }

          const participantId = args[0];
          const conversation = await api.startConversation(participantId);

          if (conversation) {
            console.log(
              `Started conversation with ${conversation.participant.username}`
            );

            // Add to conversations list
            const existingIndex = conversations.findIndex(
              (c) => c._id === conversation._id
            );
            if (existingIndex >= 0) {
              conversations[existingIndex] = {
                ...conversation,
                participants: [conversation.participant], // Convert to expected format
              };
            } else {
              conversations.push({
                ...conversation,
                participants: [conversation.participant], // Convert to expected format
              });
            }

            // Open the new conversation
            const index = conversations.findIndex(
              (c) => c._id === conversation._id
            );
            await commands.open([index.toString()]);
          }
        },

        send: async (args) => {
          if (!currentConversation) {
            console.log("No open conversation");
            return;
          }

          if (args.length < 1) {
            console.log("Usage: /send <message>");
            return;
          }

          const text = args.join(" ");

          // If connected to socket, emit typing status
          if (socket) {
            socket.emit("typing", {
              conversation_id: currentConversation._id,
              is_typing: false,
            });
          }

          const message = await api.sendMessage(currentConversation._id, text);

          if (message) {
            // Log the sent message
            logMessage(message);
          }
        },

        attach: async (args) => {
          if (!currentConversation) {
            console.log("No open conversation");
            return;
          }

          if (args.length < 1) {
            console.log("Usage: /attach <file_path>");
            return;
          }

          const filePath = args.join(" ");

          // Check if file exists
          if (!fs.existsSync(filePath)) {
            console.log(`File not found: ${filePath}`);
            return;
          }

          const message = await api.sendAttachment(
            currentConversation._id,
            filePath
          );

          if (message) {
            console.log(`Attachment sent: ${path.basename(filePath)}`);
            logMessage(message);
          }
        },

        typing: () => {
          if (!currentConversation || !socket) {
            console.log("No open conversation or not connected");
            return;
          }

          // Toggle typing status
          const isTyping = true; // Always start typing - it will auto-clear after a few seconds

          socket.emit("typing", {
            conversation_id: currentConversation._id,
            is_typing: isTyping,
          });

          console.log(`Typing status: ${isTyping ? "ON" : "OFF"}`);

          // Automatically stop typing after 5 seconds
          setTimeout(() => {
            if (socket) {
              socket.emit("typing", {
                conversation_id: currentConversation._id,
                is_typing: false,
              });
            }
          }, 5000);
        },

        read: async () => {
          if (!currentConversation) {
            console.log("No open conversation");
            return;
          }

          await api.markAsRead(currentConversation._id);

          if (socket) {
            socket.emit("markRead", {
              conversation_id: currentConversation._id,
            });
          }

          console.log("Marked conversation as read");
        },

        back: () => {
          // If viewing a conversation, emit that we're no longer viewing it
          if (currentConversation && socket) {
            socket.emit("viewingConversation", {
              conversation_id: currentConversation._id,
              is_viewing: false,
            });
          }

          currentConversation = null;
          commands.conversations();
        },

        status: () => {
          console.log("\n--- Status ---");
          console.log(`User: ${user ? user.username : "Not logged in"}`);
          console.log(
            `Socket connected: ${socket && socket.connected ? "Yes" : "No"}`
          );
          console.log(
            `Current conversation: ${
              currentConversation
                ? `${currentConversation.participants[0].username}`
                : "None"
            }`
          );
          console.log(`Total conversations: ${conversations.length}`);
          console.log("--------------\n");
        },

        exit: () => {
          console.log("Exiting...");

          // Clean up resources
          if (socket && socket.connected) {
            socket.disconnect();
          }

          rl.close();
          process.exit(0);
        },
      };

      // Main input loop
      async function main() {
        console.log("=== Chat Test Client ===");
        console.log("Type /help to see available commands");

        rl.on("line", async (input) => {
          try {
            // Handle commands
            if (input.startsWith("/")) {
              const [command, ...args] = input.slice(1).split(" ");

              if (commands[command]) {
                await commands[command](args);
              } else {
                console.log(`Unknown command: ${command}`);
                commands.help();
              }
            } else if (input.trim() !== "") {
              // Treat regular input as a message to send in current conversation
              if (currentConversation) {
                await commands.send([input]);
              } else {
                console.log(
                  "No open conversation. Type /conversations to see your conversations."
                );
              }
            }
          } catch (error) {
            console.error("Error processing command:", error);
          }
        });
      }

      // Start the application
      main().catch(console.error);

      if (response.data && response.data.data) {
        // Simplified decryption for testing
        return response.data.data.conversations;
      }
      return [];
    } catch (error) {
      console.error(
        "Failed to get conversations:",
        error.response?.data?.error || error.message
      );
      return [];
    }
  },

  getMessages: async (conversationId, page = 1) => {
    try {
      const response = await axios.post(
        `${API_URL}/chat/messages`,
        { conversation_id: conversationId, page, limit: 20 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data && response.data.data) {
        // Simplified decryption for testing
        return response.data.data.messages;
      }
      return [];
    } catch (error) {
      console.error(
        "Failed to get messages:",
        error.response?.data?.error || error.message
      );
      return [];
    }
  },

  startConversation: async (participantId) => {
    try {
      const response = await axios.post(
        `${API_URL}/chat/conversation/start`,
        { participant_id: participantId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data && response.data.data) {
        // Simplified decryption for testing
        return response.data.data.conversation;
      }
      return null;
    } catch (error) {
      console.error(
        "Failed to start conversation:",
        error.response?.data?.error || error.message
      );
      return null;
    }
  },

  sendMessage: async (conversationId, text) => {
    try {
      const response = await axios.post(
        `${API_URL}/chat/send`,
        { conversation_id: conversationId, text },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data && response.data.data) {
        // Simplified decryption for testing
        return response.data.data.sentMessage;
      }
      return null;
    } catch (error) {
      console.error(
        "Failed to send message:",
        error.response?.data?.error || error.message
      );
      return null;
    }
  },

  markAsRead: async (conversationId) => {
    try {
      await axios.post(
        `${API_URL}/chat/mark-read`,
        { conversation_id: conversationId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return true;
    } catch (error) {
      console.error(
        "Failed to mark as read:",
        error.response?.data?.error || error.message
      );
      return false;
    }
  },

  sendAttachment: async (conversationId, filePath) => {
    try {
      const formData = new FormData();
      formData.append("attachments", fs.createReadStream(filePath));

      // Add conversation_id and other data
      formData.append(
        "data",
        JSON.stringify({ conversation_id: conversationId })
      );

      const response = await axios.post(
        `${API_URL}/uploads/chat/send-with-attachments`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data && response.data.data) {
        // Simplified decryption for testing
        return response.data.data.sentMessage;
      }
      return null;
    } catch (error) {
      console.error(
        "Failed to send attachment:",
        error.response?.data?.error || error.message
      );
      return null;
    }
  },

  searchUsers: async (query) => {
    try {
      const response = await axios.post(
        `${API_URL}/chat/search-users`,
        { query },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data && response.data.data) {
        // Simplified decryption for testing
        return response.data.data.users;
      }
      return [];
    } catch (error) {
      console.error(
        "Failed to search users:",
        error.response?.data?.error || error.message
      );
      return [];
    }
  },
};

// Socket handling
const setupSocket = () => {
  if (!token) {
    console.error("Cannot connect socket: No authentication token");
    return null;
  }

  // Connect to socket with auth token
  const socketClient = io(WEBSOCKET_URL, {
    auth: {
      token: token,
    },
  });

  // Socket event handlers
  socketClient.on("connect", () => {
    console.log("Socket connected!");
  });

  socketClient.on("connect_error", (error) => {
    console.error("Socket connection error:", error.message);
  });

  socketClient.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
  });

  // Chat-specific events
  socketClient.on("newMessage", (data) => {
    const { message, conversation } = data;

    // If this is for the current conversation, show it immediately
    if (
      currentConversation &&
      message.conversation === currentConversation._id
    ) {
      logMessage(message);

      // Mark message as read
      socketClient.emit("markRead", {
        conversation_id: currentConversation._id,
      });
      api.markAsRead(currentConversation._id);
    } else {
      // Just notify about new message in another conversation
      console.log(
        `\n[NEW MESSAGE] from ${message.sender.username} in another conversation`
      );
    }

    // Update the appropriate conversation in our list
    const convIndex = conversations.findIndex(
      (c) => c._id === message.conversation
    );
    if (convIndex >= 0) {
      conversations[convIndex].lastMessage = {
        text: message.text,
        createdAt: message.createdAt,
      };
      conversations[convIndex].unreadCount += 1;
    }
  });

  socketClient.on("typingStatus", (data) => {
    const { conversation_id, user_id, is_typing } = data;

    // Only show typing indicator for current conversation
    if (currentConversation && conversation_id === currentConversation._id) {
      if (is_typing) {
        // Find the user name
        const participant = currentConversation.participants.find(
          (p) => p._id === user_id
        );
        if (participant) {
          console.log(`\n[${participant.username} is typing...]`);
        }
      }
    }
  });

  socketClient.on("userStatusChanged", (data) => {
    const { user_id, status } = data;

    // Update status in conversations
    conversations.forEach((conv) => {
      const participant = conv.participants.find((p) => p._id === user_id);
      if (participant) {
        participant.isOnline = status.isOnline;
        participant.lastSeen = status.lastSeen;

        // Log the status change if it's the current conversation
        if (currentConversation && conv._id === currentConversation._id) {
          console.log(
            `\n[${participant.username} is now ${
              status.isOnline ? "online" : "offline"
            }]`
          );
        }
      }
    });
  });

  socketClient.on("messagesRead", (data) => {
    const { conversation_id, reader } = data;

    // Only relevant for current conversation
    if (currentConversation && conversation_id === currentConversation._id) {
      console.log(`\n[Messages read by other participant]`);
    }
  });

  return socketClient;
};

// Command functions
const commands = {
  help: () => {
    console.log("\n--- Chat Test Client Commands ---");
    console.log("/help - Show this help");
    console.log("/exit - Exit the application");
    console.log("/login <email> <password> - Login with email and password");
    console.log("/conversations - List all conversations");
    console.log("/open <index> - Open conversation by index");
    console.log("/search <query> - Search for users");
    console.log("/start <user_id> - Start a new conversation");
    console.log("/send <message> - Send message in current conversation");
    console.log(
      "/attach <file_path> - Send attachment in current conversation"
    );
    console.log("/typing - Toggle typing indicator");
    console.log("/read - Mark current conversation as read");
    console.log("/back - Go back to conversation list");
    console.log("/status - Show current connection status");
    console.log("-------------------------------\n");
  },

  login: async (args) => {
    if (args.length < 2) {
      console.log("Usage: /login <email> <password>");
      return;
    }

    const [email, password] = args;
    const result = await api.login(email, password);

    if (result) {
      token = result.token;
      user = result.user;

      console.log(`Logged in as ${user.username} (${user.userType})`);

      // Setup socket after login
      socket = setupSocket();

      // Get initial conversations
      await commands.conversations();
    }
  },

  conversations: async () => {
    conversations = await api.getConversations();

    if (conversations.length === 0) {
      console.log("No conversations found");
      return;
    }

    console.log("\n--- Your Conversations ---");
    conversations.forEach((conv, index) => {
      const participant = conv.participants[0]; // In a direct chat, just show the other person
      const lastMsg = conv.lastMessage
        ? `${conv.lastMessage.text.substring(0, 30)}${
            conv.lastMessage.text.length > 30 ? "..." : ""
          }`
        : "No messages yet";

      console.log(
        `[${index}] ${participant.username} (${
          participant.user_type
        }) - ${lastMsg} ${
          conv.unreadCount > 0 ? `(${conv.unreadCount} unread)` : ""
        }`
      );
    });
    console.log("------------------------\n");
  },

  open: async (args) => {
    if (args.length < 1) {
      console.log("Usage: /open <index>");
      return;
    }

    const index = parseInt(args[0], 10);
    if (isNaN(index) || index < 0 || index >= conversations.length) {
      console.log("Invalid conversation index");
      return;
    }

    currentConversation = conversations[index];

    // Get messages for this conversation
    const messages = await api.getMessages(currentConversation._id);

    // Display conversation header
    const participant = currentConversation.participants[0];
    console.log(
      `\n--- Conversation with ${participant.username} (${participant.user_type}) ---`
    );
    console.log(
      `Status: ${
        participant.isOnline
          ? "Online"
          : "Last seen " + formatDate(participant.lastSeen)
      }`
    );

    // Display messages in chronological order (oldest first)
    console.log("--- Messages ---");

    if (messages.length === 0) {
      console.log("No messages in this conversation");
    } else {
      // Sort messages by date (oldest first)
      messages
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .forEach(logMessage);
    }

    // Mark conversation as read
    if (currentConversation.unreadCount > 0) {
      await api.markAsRead(currentConversation._id);
      if (socket) {
        socket.emit("markRead", { conversation_id: currentConversation._id });
      }

      // Update local state
      const convIndex = conversations.findIndex(
        (c) => c._id === currentConversation._id
      );
      if (convIndex >= 0) {
        conversations[convIndex].unreadCount = 0;
      }
    }

    // If connected to socket, emit that we're viewing this conversation
    if (socket) {
      socket.emit("viewingConversation", {
        conversation_id: currentConversation._id,
        is_viewing: true,
      });
    }
  },

  search: async (args) => {
    if (args.length < 1) {
      console.log("Usage: /search <query>");
      return;
    }

    const query = args.join(" ");
    const users = await api.searchUsers(query);

    if (users.length === 0) {
      console.log("No users found");
      return;
    }

    console.log("\n--- Found Users ---");
    users.forEach((user, index) => {
      console.log(
        `[${index}] ${user.username} (${user.user_type}) - ${user.email} - ${
          user.isOnline ? "Online" : "Offline"
        }`
      );
    });
    console.log("------------------\n");

    const response = await askQuestion(
      'Start conversation with a user? (Enter index or "cancel"): '
    );

    if (response.toLowerCase() !== "cancel") {
      const index = parseInt(response, 10);
      if (!isNaN(index) && index >= 0 && index < users.length) {
        await commands.start([users[index]._id]);
      } else {
        console.log("Invalid selection");
      }
    }
  },

  start: async (args) => {
    if (args.length < 1) {
      console.log("Usage: /start <user_id>");
      return;
    }

    const participantId = args[0];
    const conversation = await api.startConversation(participantId);

    if (conversation) {
      console.log(
        `Started conversation with ${conversation.participant.username}`
      );

      // Add to conversations list
      const existingIndex = conversations.findIndex(
        (c) => c._id === conversation._id
      );
      if (existingIndex >= 0) {
        conversations[existingIndex] = {
          ...conversation,
          participants: [conversation.participant], // Convert to expected format
        };
      } else {
        conversations.push({
          ...conversation,
          participants: [conversation.participant], // Convert to expected format
        });
      }

      // Open the new conversation
      const index = conversations.findIndex((c) => c._id === conversation._id);
      await commands.open([index.toString()]);
    }
  },

  send: async (args) => {
    if (!currentConversation) {
      console.log("No open conversation");
      return;
    }

    if (args.length < 1) {
      console.log("Usage: /send <message>");
      return;
    }

    const text = args.join(" ");

    // If connected to socket, emit typing status
    if (socket) {
      socket.emit("typing", {
        conversation_id: currentConversation._id,
        is_typing: false,
      });
    }

    const message = await api.sendMessage(currentConversation._id, text);

    if (message) {
      // Log the sent message
      logMessage(message);
    }
  },

  attach: async (args) => {
    if (!currentConversation) {
      console.log("No open conversation");
      return;
    }

    if (args.length < 1) {
      console.log("Usage: /attach <file_path>");
      return;
    }

    const filePath = args.join(" ");

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    const message = await api.sendAttachment(currentConversation._id, filePath);

    if (message) {
      console.log(`Attachment sent: ${path.basename(filePath)}`);
      logMessage(message);
    }
  },

  typing: () => {
    if (!currentConversation || !socket) {
      console.log("No open conversation or not connected");
      return;
    }

    // Toggle typing status
    const isTyping = true; // Always start typing - it will auto-clear after a few seconds

    socket.emit("typing", {
      conversation_id: currentConversation._id,
      is_typing: isTyping,
    });

    console.log(`Typing status: ${isTyping ? "ON" : "OFF"}`);

    // Automatically stop typing after 5 seconds
    setTimeout(() => {
      if (socket) {
        socket.emit("typing", {
          conversation_id: currentConversation._id,
          is_typing: false,
        });
      }
    }, 5000);
  },

  read: async () => {
    if (!currentConversation) {
      console.log("No open conversation");
      return;
    }

    await api.markAsRead(currentConversation._id);

    if (socket) {
      socket.emit("markRead", { conversation_id: currentConversation._id });
    }

    console.log("Marked conversation as read");
  },

  back: () => {
    // If viewing a conversation, emit that we're no longer viewing it
    if (currentConversation && socket) {
      socket.emit("viewingConversation", {
        conversation_id: currentConversation._id,
        is_viewing: false,
      });
    }

    currentConversation = null;
    commands.conversations();
  },

  status: () => {
    console.log("\n--- Status ---");
    console.log(`User: ${user ? user.username : "Not logged in"}`);
    console.log(
      `Socket connected: ${socket && socket.connected ? "Yes" : "No"}`
    );
    console.log(
      `Current conversation: ${
        currentConversation
          ? `${currentConversation.participants[0].username}`
          : "None"
      }`
    );
    console.log(`Total conversations: ${conversations.length}`);
    console.log("--------------\n");
  },

  exit: () => {
    console.log("Exiting...");

    // Clean up resources
    if (socket && socket.connected) {
      socket.disconnect();
    }

    rl.close();
    process.exit(0);
  },
};

// Main input loop
async function main() {
  console.log("=== Chat Test Client ===");
  console.log("Type /help to see available commands");

  rl.on("line", async (input) => {
    try {
      // Handle commands
      if (input.startsWith("/")) {
        const [command, ...args] = input.slice(1).split(" ");

        if (commands[command]) {
          await commands[command](args);
        } else {
          console.log(`Unknown command: ${command}`);
          commands.help();
        }
      } else if (input.trim() !== "") {
        // Treat regular input as a message to send in current conversation
        if (currentConversation) {
          await commands.send([input]);
        } else {
          console.log(
            "No open conversation. Type /conversations to see your conversations."
          );
        }
      }
    } catch (error) {
      console.error("Error processing command:", error);
    }
  });
}

// Start the application
main().catch(console.error);
