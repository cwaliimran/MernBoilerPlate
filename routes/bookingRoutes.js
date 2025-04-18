const express = require("express");
const {
  createBooking,
  getMyBookings,
  getMyRentals,
  getBookingById,
  checkListingAvailability,
  addPickupDetails,
  addDropOffDetails,
  cancelBookingById,
  deleteBookingById,
  getBookingsWithUser,
  getRentalsWithUser,
  directPaidBookingById,
  approveBookingById,
  rejectBookingById,
} = require("../controllers/bookingController");
const auth = require("../middlewares/authMiddleware");
const admin = require("../middlewares/adminMiddleware");

const router = express.Router();
router.use(auth);



// Create a new booking
router.post("/", createBooking);

// Get all bookings for the logged-in user
router.get("/my-bookings", getMyBookings);

//approve booking request
router.put("/:id/approve", approveBookingById);

//reject booking request
router.put("/:id/reject", rejectBookingById);

// Get all rentals for the logged-in user
router.get("/my-rentals", getMyRentals);

// Get booking details by ID
router.get("/:id", getBookingById);

// Check listing availability for a specific month
router.get("/availability/:listingId", checkListingAvailability);

// Add pickup details for a booking
router.put("/:id/pickup", addPickupDetails);

// Add drop-off details for a booking
router.put("/:id/dropoff", addDropOffDetails);

// Cancel a booking by ID
router.put("/:id/cancel", cancelBookingById);

// Direct Paid a booking by ID
router.put("/:id/paid", directPaidBookingById);

// Delete a booking by ID
router.delete("/:id", admin, deleteBookingById);


// Get all bookings with a specific user
router.get("/user/:userId", getBookingsWithUser);

// Get all rentals with a specific user
router.get("/rentals/user/:userId", getRentalsWithUser);
module.exports = router;
