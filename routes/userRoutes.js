const express = require("express");
const auth = require("../middlewares/authMiddleware");
const admin = require("../middlewares/adminMiddleware");

const {
  allUsers,
  blockUser,
  reportUser,
  addOrUpdateSubscription,
  removeSubscription,
  getSubscriptions,
  getUserProfile,
  updateUserProfile,
} = require("../controllers/userController");
const router = express.Router();

// Apply auth middleware to the router
router.use(auth);

// // Specify the fields you want to populate dynamically
// const fieldsToPopulate = [
//   "profileIcon",
//   "age",
// ];
router.get("/profile", (req, res, next) => {
  getUserProfile(req, res, next);
});
router.put("/profile", updateUserProfile)
router.get("/allUsers", admin, allUsers);
router.post("/:userIdToBlock/block", blockUser);
router.post("/:userIdToReport/report", reportUser);
router.post("/addOrUpdateSubscription", addOrUpdateSubscription);
router.post("/removeSubscription/:subscriptionId", removeSubscription);
router.get("/subscriptions", getSubscriptions);

module.exports = router;
