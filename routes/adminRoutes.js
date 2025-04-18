const express = require("express");
const {
  dashboard,
  getUserStatsByRegion,
  topRatedListings,
  topRatedUsers,
  allUsers,
  documentsVerficication,
  allListings,
  damageRequests,
  getSupportRequests,
  updateSupportRequestStatus,
  deleteSupportRequest,
  getContactRequests,
  updateContactRequestStatus,
  deleteContactRequest,
  getAllListingsByUser,
  getAllUserBookings,
  getAllUserRentals,
  getUserEarnings,
  getFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  updateDocumentStatus,
  deleteDocument,
  getTransactions,
  updateUserAccountState

} = require("../controllers/adminPanelController");
const auth = require("../middlewares/authMiddleware");
const admin = require("../middlewares/adminMiddleware");

const router = express.Router();
router.use(auth);
router.use(admin);
router.get("/dashboard", dashboard);
router.get("/user-stats-by-region", getUserStatsByRegion);
router.get("/top-rated-listings", topRatedListings);
router.get("/top-rated-users", topRatedUsers);
router.get("/all-users", allUsers);
router.get("/documents-verification", documentsVerficication);
router.get("/all-listings", allListings);
router.get("/damage-requests", damageRequests);

// Route to get all support requests (Admin)
router.get("/support-requests/", getSupportRequests);
// Route to update support request status (Admin)
router.put("/support-requests/:id", updateSupportRequestStatus);
router.delete("/support-requests/:id", deleteSupportRequest);

// Route to get all contact requests (Admin)
router.get("/contact-us", getContactRequests);

// Route to update contact request status (Admin)
router.put("/contact-us/:id", updateContactRequestStatus);

router.delete("/contact-us/:id", deleteContactRequest);

router.get("/listings-by-user/:id", getAllListingsByUser);
router.get("/user-bookings/:id", getAllUserBookings);
router.get("/user-rentals/:id", getAllUserRentals);
router.get("/user-earnings/:id", getUserEarnings);

//faqs
router.get("/faqs", getFaqs);
router.post("/faqs", createFaq);
router.put("/faqs/:id", updateFaq);
router.delete("/faqs/:id", deleteFaq);

// Route to update document status (pending, submitted, verified, rejected)
router.patch("/documents/:userId/status", admin, updateDocumentStatus);

// Route to delete document (reset front and back images)
router.delete("/documents/:userId", admin, deleteDocument);

router.get("/transactions", admin, getTransactions);

router.patch("/users/:userId/account-state", updateUserAccountState);


module.exports = router;
