const express = require("express");
const {
  fetchChats,
  fetchMessages,
  sendMessage,
  deleteChat,
  deleteMessage,
  markAllMessagesAsRead,
  searchChats,
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


// Fetch messages in a conversation with the support team
router.get("/support/messages", apiRateLimiter, (req, res) => fetchMessages(req, res, true)); // true means messages with support team

// Fetch messages in a conversation with a specific user
router.get("/:otherUserId/messages", apiRateLimiter, (req, res) => fetchMessages(req, res, false)); // false means messages with a specific user


// Send a new message to the admin
router.post("/support/message", apiRateLimiter, (req, res) => sendMessage(req, res, true)); // true means message to support team

// Send a new message to a specific user
router.post("/:otherUserId/message", apiRateLimiter, (req, res) => sendMessage(req, res, false)); // false means not support team



// Delete a chat with a specific user
router.delete("/:otherUserId/chat", deleteChat);

// Delete a specific message by its ID
router.delete("/message/:messageId", deleteMessage);

// Mark a specific message as read
router.put("/message/read/:otherUserId", markAllMessagesAsRead);


module.exports = router;
