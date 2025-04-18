const mongoose = require("mongoose");
const shortid = require("shortid");
const { convertDateFormat } = require("../helperUtils/responseUtil");

const bookingSchema = new mongoose.Schema(
  {
    bookingNumber: {
      type: String,
      default: () => shortid.generate(), // Generate a short random booking number
    },
    bookingType: {
      type: String,
      enum: ["hourly", "daily"],
      required: true,
    },
    totalBill: {
      type: Number,
      required: true,
    },
    hours: {
      type: Number,
    },
    fromDate: {
      type: Date,
    },
    toDate: {
      type: Date,
    },
    notes: {
      type: String,
      default: "",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "rejected"], //pending==captured payment on stripe
      default: "pending",
    },
    paymentId: {
      type: String,
      default: "",
    },
    transactionId: {
      type: String,
      default: "",
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    listingBookingStatus: {
      type: String,
      enum: [
        "pendingConfirm", //booking request sent by rentee
        "rejected", //rejected by renter
        "cancelled", //cancelled by rentee
        "booked", //accepted by renter / confirmed
        "picked",
        "returned",
        "lost",
        "other",
      ],
      default: "booked",
    },
    rentee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    renter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
    },
    listingDataSnapshot: {
      type: Object,
      required: true, // Store the listing data for record
    },
    pickup: {
      images: {
        type: [String], // URLs for pickup images
        default: [],
      },
      note: {
        type: String,
        default: "",
      },
      date: {
        type: Date,
      },
    },
    dropoff: {
      images: {
        type: [String], // URLs for dropoff images
        default: [],
      },
      note: {
        type: String,
        default: "",
      },
      date: {
        type: Date,
      },
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
    timestamps: true,
  }
);

bookingSchema.methods.toJSON = function (currencyCode = "USD") {
  const booking = this.toObject();
  booking.currencyCode = currencyCode;
  const baseUrl = `${process.env.S3_BASE_URL}/`;

  if (booking.listingDataSnapshot && booking.listingDataSnapshot.images) {
    booking.listingDataSnapshot.images = booking.listingDataSnapshot.images.map(
      (image) => `${baseUrl}${image}`
    );
  }

  if (booking.rentee && booking.rentee.profileIcon) {
    booking.rentee.profileIcon = `${baseUrl}${booking.rentee.profileIcon}`;
  }

  if (booking.renter && booking.renter.profileIcon) {
    booking.renter.profileIcon = `${baseUrl}${booking.renter.profileIcon}`;
  }

  if (booking.pickup && booking.pickup.images) {
    booking.pickup.images = booking.pickup.images.map(
      (image) => `${baseUrl}${image}`
    );
  }

  if (booking.dropoff && booking.dropoff.images) {
    booking.dropoff.images = booking.dropoff.images.map(
      (image) => `${baseUrl}${image}`
    );
  }

  // Add # with bookingNumber
  if (booking.bookingNumber) {
    booking.bookingNumber = `#${booking.bookingNumber}`;
  }

  if (booking.pickup && booking.pickup.date) {
    booking.pickup.date = convertDateFormat(
      booking.pickup.date,
      (outputFormat = "DD-MM-YYYY hh:mm A"),
      (inputFormat = "YYYY-MM-DDTHH:mm:ss.SSSZ")
    );
  }

  if (booking.dropoff && booking.dropoff.date) {
    booking.dropoff.date = convertDateFormat(
      booking.dropoff.date,
      (outputFormat = "DD-MM-YYYY hh:mm A"),
      (inputFormat = "YYYY-MM-DDTHH:mm:ss.SSSZ")
    );
  }

  if (booking.fromDate) {
    booking.fromDate = convertDateFormat(
      booking.fromDate,
      (outputFormat = "DD-MM-YYYY"),
      (inputFormat = "YYYY-MM-DDTHH:mm:ss.SSSZ")
    );
  }
  if (booking.toDate) {
    booking.toDate = convertDateFormat(
      booking.toDate,
      (outputFormat = "DD-MM-YYYY"),
      (inputFormat = "YYYY-MM-DDTHH:mm:ss.SSSZ")
    );
  }

  return booking;
};

const Booking = mongoose.model("Booking", bookingSchema);
module.exports = Booking;
