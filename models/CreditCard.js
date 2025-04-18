const mongoose = require("mongoose");

const creditCardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    cardType: {
      type: String,
      enum: ["Visa", "MasterCard", "American Express", "Discover", "Stripe"], // You can add more card types here
      default: "Visa",
    },
    cardNumber: {
      type: String,
      required: true,
      minlength: 13,
      maxlength: 19,
    },
    defaultCard: {
      type: Boolean,
      default: false,
    },
    cvc: {
      type: String,
      minlength: 3,
      maxlength: 4,
      default: null,
    },
    expiry: {
      type: String,
      required: true, // Format: MM/YY
    },
  },
  { timestamps: true }
);

const CreditCard = mongoose.model("CreditCard", creditCardSchema);

module.exports = CreditCard;
