const express = require("express");
const {
  addDocument,
  updateDocumentStatus,
  deleteDocument,
  approveDocument,
} = require("../controllers/documentsController");
const auth = require("../middlewares/authMiddleware");
const createRateLimiter = require("../helperUtils/rateLimiter");

const admin = require("../middlewares/adminMiddleware");

const router = express.Router();
router.use(auth); // Apply authentication middleware to all document routes

const apiRateLimiter = createRateLimiter("documents", 10, 50); // Optional rate limiting

// Route to add or update document images (front and back)
router.post("/", apiRateLimiter, addDocument);

// Route to update document status (pending, submitted, verified, rejected)
router.patch("/:userId/status", apiRateLimiter,admin, updateDocumentStatus);

// Route to delete document (reset front and back images)
router.delete("/:userId", apiRateLimiter, admin, deleteDocument);


module.exports = router;
