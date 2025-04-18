// routes/contactUsRoutes.js
const express = require("express");
const {
  createContactRequest,
} = require("../controllers/contactUsController");
const auth = require("../middlewares/authMiddleware");
const admin = require("../middlewares/adminMiddleware");
const createRateLimiter = require("../helperUtils/rateLimiter");

const router = express.Router();
const contactRateLimiter = createRateLimiter("contact", 10, 5);

// Route to create a contact request
router.post("/", contactRateLimiter, createContactRequest);

module.exports = router;
