const express = require("express");
const {
  createListing,
  getAllListings,
  getListingById,
  updateListingById,
  deleteListingById,
  getAllListingsByUser,
} = require("../controllers/listingsController");
const auth = require("../middlewares/authMiddleware");
const admin = require("../middlewares/adminMiddleware");

const router = express.Router();
router.use(auth); // Apply authentication middleware to all routes

// Route to create a new listing (Admin only)
router.post("/", createListing);

// Route to get all listings (Admin only)
router.get("/admin", admin, getAllListings);

// Route to get all available listings for users
router.get("/", getAllListingsByUser);

// Route to get a single listing by ID
router.get("/:id", getListingById);

// Route to update a listing by ID (Admin only)
router.put("/:id", updateListingById);

// Route to delete a listing by ID (Admin only)
router.delete("/:id", deleteListingById);

module.exports = router;
