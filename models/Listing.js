const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      required: true,
      trim: true,
      default: "",
    },
    images: [
      {
        type: String, // URL to the image
        default: "",
      },
    ],
    pickupTime: {
      type: String, // Text field for pickup time (e.g., "08:30 AM")
      default: "",
    },
    pickupEndTime: {
      type: String, // Text field for close pickup time (e.g., "08:30 PM")
      default: "",
    },
    totalValue: {
      type: Number, // Total value of the listing
      default: 0,
    },
    openForRent: {
      type: Boolean, // Whether the listing is open for rent
      default: true,
    },
    rentPerHour: {
      type: Number, // Rent per hour
      default: 0,
    },
    rentPerDay: {
      type: Number, // Rent per day
      default: 0,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["available", "booked", "deleted"],
      default: "available", // Set default status as available
    },
    instantBooking: {
      type: String,
      enum: ["yes", "no"],
      default: "yes",
    },
    currencySymbol: {
      type: String,
      default: "$",
    },
    currencyCode: {
      type: String,
      default: "USD",
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
  }
);

listingSchema.methods.toJSON = function (currencyCode = "USD") {
  const listing = this;
  const listingObject = listing.toObject();

  const baseUrl = `${process.env.S3_BASE_URL}/`;

  if (listingObject.creator && listingObject.creator.profileIcon) {
    listingObject.creator.profileIcon = `${baseUrl}${listingObject.creator.profileIcon}`;
  }

  listingObject.currencyCode = currencyCode;

  if (listingObject.images && listingObject.images.length > 0) {
    listingObject.images = listingObject.images.map((image) =>
      image ? { url: baseUrl + image, name: image } : null
    );
  }

  return listingObject;
};

const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;
