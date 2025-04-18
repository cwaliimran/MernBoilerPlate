const express = require("express");
const router = express.Router();
const {
  createListingDamageReport,
  getListingDamageReports,
  updateListingDamageReport,
  deleteListingDamageReport,
  getAllListingDamageReports,
  getListingDamageReportDetails
} = require("../controllers/damageReportController");
const auth = require("../middlewares/authMiddleware");
const admin = require("../middlewares/adminMiddleware");

router.use(auth);


// Get all listing damage reports with filtering by user ID and status
router.get("/all", admin, getAllListingDamageReports);

// Create a new listing damage report and get reports with filtering
router
  .route("/")
  .post(createListingDamageReport) // Create report
  .get(getListingDamageReports); // Get reports with optional filters

// Get a listing damage report by ID
router.get("/:id", getListingDamageReportDetails);

// Update and delete a listing damage report by ID
router
  .route("/:id")
  .put(updateListingDamageReport) // Update report by ID
  .delete(deleteListingDamageReport); // Delete report by ID

module.exports = router;
