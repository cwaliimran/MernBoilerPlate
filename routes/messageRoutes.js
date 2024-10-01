const express = require("express");
const {
  fetchChats,
  fetchMessages,
  sendMessage,
  deleteChat,
  deleteMessage,
  markAllMessagesAsRead,
  searchChats
} = require("../controllers/messageController");
const auth = require("../middlewares/authMiddleware");
const createRateLimiter = require("../helperUtils/rateLimiter");

const router = express.Router();
router.use(auth);

const apiRateLimiter = createRateLimiter("messages", 10, 50);

// Routes for conversations

// Fetch the first message from each conversation (chats)
router.get("/chats", apiRateLimiter, fetchChats);
router.get("/chats/search", apiRateLimiter, searchChats);

// Fetch messages in a conversation with a specific user
router.get("/:otherUserId/messages", apiRateLimiter, fetchMessages);

// Send a new message to a specific user
router.post("/:otherUserId/message", apiRateLimiter, sendMessage);

// Delete a chat with a specific user
router.delete("/:otherUserId/chat", deleteChat);

// Delete a specific message by its ID
router.delete("/message/:messageId", deleteMessage);

// Mark a specific message as read
router.put("/message/read/:otherUserId", markAllMessagesAsRead);

module.exports = router;
