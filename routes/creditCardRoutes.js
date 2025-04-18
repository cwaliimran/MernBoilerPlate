const express = require("express");
const router = express.Router();
const {
  addCreditCard,
  updateCreditCardExpiry,
  deleteCreditCard,
  getAllCardsByUserId,
  getCardById
} = require("../controllers/creditCardController");
const auth = require("../middlewares/authMiddleware");

router.use(auth);

// Add a new credit card
router.post("/", addCreditCard);

// Update credit card expiry
router.put("/:id", updateCreditCardExpiry);

// Delete a credit card
router.delete("/:id", deleteCreditCard);

// Get all cards by user ID
router.get("/:id", getCardById);
router.get("/", getAllCardsByUserId);

module.exports = router;
