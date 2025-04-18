const express = require("express");
const {
  addDocument,
} = require("../controllers/documentsController");
const auth = require("../middlewares/authMiddleware");
const createRateLimiter = require("../helperUtils/rateLimiter");


const router = express.Router();
router.use(auth); // Apply authentication middleware to all document routes

const apiRateLimiter = createRateLimiter("documents", 10, 50); // Optional rate limiting

// Route to add or update document images (front and back)
router.post("/", apiRateLimiter, addDocument);


module.exports = router;
