// routes/supportRoutes.js
const express = require("express");
const {
  createSupportRequest,
  getSupportRequests,
  updateSupportRequestStatus,
} = require("../controllers/supportController");
const auth = require("../middlewares/authMiddleware");
const admin = require("../middlewares/adminMiddleware");
const createRateLimiter = require("../helperUtils/rateLimiter");

const router = express.Router();
const supportRateLimiter = createRateLimiter("support", 10, 5);

// Route to create a support request
router.post("/", supportRateLimiter, auth, createSupportRequest);

// Route to get all support requests (Admin)
router.get("/requests", auth, admin, getSupportRequests);

// Route to update support request status (Admin)
router.put("/requests/:id/status", auth, admin, updateSupportRequestStatus);

module.exports = router;
