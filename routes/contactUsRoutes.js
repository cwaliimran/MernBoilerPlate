// routes/contactUsRoutes.js
const express = require("express");
const {
  createContactRequest,
  getContactRequests,
  updateContactRequestStatus,
  deleteContactRequest
} = require("../controllers/contactUsController");
const auth = require("../middlewares/authMiddleware");
const admin = require("../middlewares/adminMiddleware");
const createRateLimiter = require("../helperUtils/rateLimiter");

const router = express.Router();
const contactRateLimiter = createRateLimiter("contact", 10, 5);

// Route to create a contact request
router.post("/", contactRateLimiter, createContactRequest);

// Route to get all contact requests (Admin)
router.get("/", auth, admin, getContactRequests);

// Route to update contact request status (Admin)
router.put("/:id", auth, admin, updateContactRequestStatus);

router.delete("/:id", auth, admin, deleteContactRequest);

module.exports = router;
