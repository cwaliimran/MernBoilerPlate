const Booking = require("../models/Booking");
const Listing = require("../models/Listing");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("../helperUtils/responseUtil");
const shortid = require("shortid");
const Review = require("../models/Review");
const { values } = require("lodash");
const { sendUserNotifications } = require("./communicationController");
const { NotificationTypes } = require("../models/Notifications");
const calculateDistance = require("../helperUtils/calculateDistance");
const ListingDamageReport = require("../models/DamageReport");
const { ObjectId } = require("mongodb");
const {
  createPaymentIntent,
  getUserAccount,
  capturePayment,
  cancelPayment,
} = require("../helperUtils/stripeUtil");
const { request } = require("../server");
const { User } = require("../models/userModel");
// Create a new booking

// Helper function to calculate user rating and total reviews
const calculateUserRating = async (userId) => {
  const reviews = await Review.find({ reviewType: "user", object: userId });
  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
      : 0;
  return { totalReviews, averageRating };
};

// Create a new booking
const createBooking = async (req, res) => {
  const { _id } = req.user;
  let {
    listingId,
    bookingType,
    hours,
    fromDate,
    toDate,
    notes,
    paymentMethodId,
  } = req.body;

  const validationOptions = {
    rawData: ["listingId", "bookingType"],
    enumFields: {
      bookingType: ["hourly", "daily"],
    },
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  if (bookingType === "hourly" && !hours) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "hours_must",
      values: { hours: "min: 1, max: 24" },
    });
  }
  if (bookingType === "hourly") {
    toDate = fromDate;
  }
  //validate hours
  if (bookingType === "hourly" && (hours < 1 || hours > 24)) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "hours_must",
      values: { hours: "min: 1, max: 24" },
    });
  }

  //validate dates
  if (bookingType === "daily" && (!fromDate || !toDate)) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "start_and",
    });
  }
  //validate dates
  if (bookingType == "daily") {
    //validate date params
    const validationOptions1 = {
      dateFields: {
        fromDate: "YYYY-MM-DD",
        toDate: "YYYY-MM-DD",
      },
    };
    if (!validateParams(req, res, validationOptions1)) {
      return;
    }
  }

  if (bookingType === "daily" && new Date(fromDate) > new Date(toDate)) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "invalid_start_end_date",
    });
  }

  try {
    const { totalReviews, averageRating } = await calculateUserRating(_id);
    // Check if user has more than 5 reviews and rating is less than 3
    if (totalReviews > 5 && averageRating < 3) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "youre_unable",
      });
    }

    // Check if listing is available on selected dates

    const filters = {
      listing: listingId,
      listingBookingStatus: { $nin: ["rejected","cancelled"] },
      $or: [
        {
          fromDate: { $lte: new Date(toDate) },
          toDate: { $gte: new Date(fromDate) },
        },
      ],
    };

    const bookings = await Booking.find(filters);
    if (bookings.length > 0) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "listing_not_available_on_selected_dates",
      });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "listing_not_1",
      });
    }
    let totalBill = 0;
    if (bookingType === "hourly") {
      totalBill = hours * listing.rentPerHour;
    } else if (bookingType === "daily") {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      const days = (end - start) / (1000 * 60 * 60 * 24) + 1;
      totalBill = days * listing.rentPerDay;
    }

    // Check if totalBill is NaN and handle the error
    if (isNaN(totalBill)) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "error_calculating",
      });
    }

    //check if bill amount is greater than minimum amount required on stripe (0.5$)

    //get listing creator
    const listingCreator = await User.findById(listing.creator).select(
      "currencyCode currencySymbol"
    );

    if (!listingCreator) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "renter_not_found",
      });
    }

    if (!paymentMethodId) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "booking_created_success",
      });
    }

    listing.currencyCode = listingCreator?.currencyCode || "USD";

    //check if currency exists
    if (!listingCreator?.currencyCode || !listingCreator?.currencyCode) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "renter_currency_not_found",
      });
    }

    //stripe account
    const userAccount = await getUserAccount({ userId: listing.creator });
    if (!userAccount || !userAccount?.isActive) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "renter_stripe_account_not_found",
      });
    }
    const payment = await createPaymentIntent({
      amount: totalBill,
      currency: listingCreator.currencyCode || "usd",
      email: req.user.email,
      destinationAccountId: userAccount?.accountId,
      payment_method: paymentMethodId,
      capture_method: "manual",
    });
    if (!payment) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "payment_error",
      });
    }

    // Copy listing data for booking record
    const listingDataSnapshot = listing.toObject();
    //convert start date to utc

    var bookingStatus = "booked";
    if (listing.instantBooking == "yes") {
      bookingStatus = "booked";
    } else {
      bookingStatus = "pendingConfirm";
    }

    // Create a new booking
    const booking = new Booking({
      listing: listingId,
      rentee: _id,
      renter: listing.creator,
      bookingType,
      totalBill,
      hours: bookingType === "hourly" ? hours : null,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      notes,
      paymentStatus: "pending",
      listingBookingStatus: bookingStatus,
      listingDataSnapshot,
      paymentId: payment?.id,
      bookingNumber: shortid.generate(), // Generate a short random booking number
      currencySymbol: listingCreator?.currencySymbol || "$",
      currencyCode: listingCreator?.currencyCode || "USD",
    });

    // Mark the listing as booked
    listing.status = "booked";
    await Promise.all([booking.save(), listing.save()]);

    // Send user notifications
    const notificationType =
      bookingStatus === "booked"
        ? NotificationTypes.NEW_BOOKING
        : NotificationTypes.BOOKING_REQUEST;
    const notificationTitle =
      bookingStatus === "booked" ? "New Booking" : "New Booking Request";
    const notificationBody =
      bookingStatus === "booked"
        ? `Your listing has been booked by ${req.user.name}`
        : `You have a new booking request from ${req.user.name}`;

    sendUserNotifications({
      recipientIds: [listing.creator.toString()],
      title: notificationTitle,
      body: notificationBody,
      data: {
        type: notificationType,
        bookingId: booking._id.toString(),
        objectType: "booking",
      },
      sender: _id,
      objectId: booking._id,
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "booking_created",
      data: booking,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server " + error?.message || "",
      error: error,
    });
  }
};

// Get all bookings for the current user
const getMyBookings = async (req, res) => {
  const { _id, timezone, location, distanceUnit = "km" } = req.user;
  try {
    const { page, limit } = parsePaginationParams(req);
    const { status, bookingType, from, to } = req.query;

    const filters = { rentee: _id };
    if (status) filters.listingBookingStatus = status;
    if (bookingType) filters.bookingType = bookingType;
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      filters.$or = [
        { fromDate: { $gte: fromDate, $lte: toDate } },
        { toDate: { $gte: fromDate, $lte: toDate } },
      ];
    }

    const [bookings, totalRecords] = await Promise.all([
      Booking.find(filters)
        .populate("rentee", "name profileIcon")
        .populate("renter", "name profileIcon location currencyCode")
        // .populate("listing")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Booking.countDocuments(filters),
    ]);

    // Calculate distance between location and renter.location
    const bookingsWithDistance = bookings.map((booking) => {
      var unit = distanceUnit;
      let distanceAtoB = null;
      if (
        location &&
        location.coordinates &&
        booking.renter.location &&
        booking.renter.location.coordinates
      ) {
        distanceAtoB = calculateDistance(
          location.coordinates,
          booking.renter.location.coordinates,
          unit
        );
      }
      return {
        ...booking.toJSON(booking?.renter?.currencyCode || "USD"),
        unit,
        distance: distanceAtoB !== null ? parseFloat(distanceAtoB) : 0.0,
        distanceLabel:
          distanceAtoB !== null ? `${distanceAtoB} ${unit} away` : "N/A",
      };
    });

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "bookings_fetched",
      data: bookingsWithDistance,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Get all rentals for the current user
const getMyRentals = async (req, res) => {
  const { _id } = req.user;
  try {
    const { page, limit } = parsePaginationParams(req);
    const { status, bookingType, from, to } = req.query;

    const filters = { renter: _id };
    if (status) filters.listingBookingStatus = status;
    if (bookingType) filters.bookingType = bookingType;
    if (from && to) {
      filters.$or = [
        { fromDate: { $gte: from, $lte: to } },
        { toDate: { $gte: from, $lte: to } },
      ];
    }

    var [rentals, totalRecords] = await Promise.all([
      Booking.find(filters)
        .populate("rentee", "name profileIcon")
        .populate("renter", "name profileIcon location currencyCode")
        // .populate("listing")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Booking.countDocuments(filters),
    ]);

    //add currency symbol
    rentals = rentals.map((rental) => {
      rental = rental.toJSON();
      rental.currencyCode = rental.renter?.currencyCode || "USD";
      return rental;
    });

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "rentals_fetched",
      data: rentals,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Get booking details by ID
const getBookingById = async (req, res) => {
  const { id } = req.params;
  const { location, distanceUnit = "km" } = req.user;

  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    const bookingPromise = Booking.findById(id)
      .populate("rentee", "name profileIcon")
      .populate("renter", "name profileIcon location currencyCode");

    const reviewPromise = Review.find({ bookingId: id }).populate(
      "subject",
      "name profileIcon"
    );

    //check if booking damage request exists
    const damageRequestPromise = ListingDamageReport.findOne({
      booking: ObjectId.createFromHexString(id),
    });

    const [bookingData, reviews, damageRequest] = await Promise.all([
      bookingPromise,
      reviewPromise,
      damageRequestPromise,
    ]);

    if (!bookingData) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "booking_not",
      });
    }
    if (!bookingData) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "booking_not",
      });
    }
    //location
    let unit = distanceUnit;
    let distanceAtoB = null;
    if (
      location &&
      location.coordinates &&
      bookingData.renter.location &&
      bookingData.renter.location.coordinates
    ) {
      distanceAtoB = calculateDistance(
        location.coordinates,
        bookingData.renter.location.coordinates,
        unit
      );
    }

    let booking = {
      ...bookingData.toJSON(bookingData?.renter?.currencyCode || "USD"),
      unit: unit,
      distance: distanceAtoB !== null ? parseFloat(distanceAtoB) : 0.0,
      distanceLabel:
        distanceAtoB !== null ? `${distanceAtoB} ${unit} away` : "N/A",
      damageRequest: damageRequest ? damageRequest : null,
    };

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "booking_details",
      data: { booking, reviews },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Check listing availability for a month
const checkListingAvailability = async (req, res) => {
  const { listingId } = req.params;
  const { month } = req.query;

  try {
    const validationOptions = {
      pathParams: ["listingId"],
      objectIdFields: ["listingId"],
      dateFields: {
        month: "YYYY-MM",
      },
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    // Assuming month format is YYYY-MM
    const dateParts = month.split("-");
    const year = parseInt(dateParts[0], 10);
    const monthIndex = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed in JS

    // Start and end of the month
    const monthStart = new Date(Date.UTC(year, monthIndex, 1));
    const monthEnd = new Date(
      Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)
    );
    // Define booking filters
    const filters = {
      listing: listingId,
      $or: [
        {
          fromDate: { $lte: monthEnd },
          toDate: { $gte: monthStart }, // Daily bookings that overlap with the month
        },
      ],
    };

    // Fetch bookings matching the criteria
    const bookings = await Booking.find(filters);

    // Create an array of booked dates
    let bookedDates = [];
    bookings.forEach((booking) => {
      // Add only the start and end dates
      const fromDate = booking.fromDate.toISOString().split("T")[0];
      const toDate = booking.toDate.toISOString().split("T")[0];
      bookedDates.push(fromDate, toDate);
    });

    // Remove duplicates and sort the booked dates
    bookedDates = [...new Set(bookedDates)].sort();

    // Include all dates between the start and end dates for daily bookings
    let allBookedDates = [];
    bookings.forEach((booking) => {
      let currentDate = new Date(booking.fromDate);
      const endDate = new Date(booking.toDate);
      while (currentDate <= endDate) {
        allBookedDates.push(currentDate.toISOString().split("T")[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // Remove duplicates and sort the booked dates
    allBookedDates = [...new Set(allBookedDates)].sort();

    // Filter booked dates to only include dates within the current month
    const busyDaysInMonth = allBookedDates.filter((dateString) => {
      const date = new Date(dateString);
      return date >= monthStart && date <= monthEnd;
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "listing_not",
      data: busyDaysInMonth,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Add pickup details
const addPickupDetails = async (req, res) => {
  const { id } = req.params; // Booking ID
  const { images, note, date } = req.body;

  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
      dateFields: {
        date: "YYYY-MM-DD HH:mm A",
      },
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    const booking = await Booking.findById(id);
    if (!booking) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "booking_not",
      });
    }

    if (!booking.paymentId) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "payment_error",
      });
    }

    if (booking.paymentStatus !== "paid") {
      const capture = await capturePayment({
        paymentIntentId: booking.paymentId,
      });
      if (!capture) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "payment_error",
          error: capture.error,
        });
      }
      booking.transactionId = capture.id;
      booking.paymentStatus = "paid";
      booking.paidAmount = booking.totalBill;
    }

    booking.pickup = {
      images: images || booking.pickup.images,
      note: note || booking.pickup.note,
      date: date ? new Date(date) : booking.pickup.date,
    };
    booking.listingBookingStatus = "picked"; // Update booking status to 'picked'

    await booking.save();

    //send notification
    // Send user notifications
    sendUserNotifications({
      recipientIds: [booking.renter.toString()],
      title: "Booking Picked",
      body: `Your booking has been picked by ${req.user.name}`,
      data: {
        type: NotificationTypes.BOOKING_PICKED,
        bookingId: booking._id.toString(),
        objectType: "booking",
      },
      sender: booking.rentee,
      objectId: booking._id,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "pickup_details",
      data: booking,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Add drop-off details
const addDropOffDetails = async (req, res) => {
  const { id } = req.params; // Booking ID
  const { images, note, date } = req.body;

  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
      dateFields: {
        date: "YYYY-MM-DD HH:mm A",
      },
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    const booking = await Booking.findById(id);
    if (!booking) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "booking_not",
      });
    }

    booking.dropoff = {
      images: images || booking.dropoff.images,
      note: note || booking.dropoff.note,
      date: date ? new Date(date) : booking.dropoff.date,
    };
    booking.listingBookingStatus = "returned"; // Update booking status to 'returned'

    await booking.save();

    //send notification
    // Send user notifications
    sendUserNotifications({
      recipientIds: [booking.rentee.toString()],
      title: "Booking Completed",
      body: `Your booking has been completed by ${req.user.name}`,
      data: {
        type: NotificationTypes.BOOKING_COMPLETED,
        bookingId: booking._id.toString(),
        objectType: "booking",
      },
      sender: booking.renter,
      objectId: booking._id,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "dropoff_details",
      data: booking,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Cancel a booking by ID
const cancelBookingById = async (req, res) => {
  const { id } = req.params;

  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    const booking = await Booking.findById(id);
    if (!booking) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "booking_not",
      });
    }

    // If the payment is made, do not allow cancellation
    if (booking.paymentStatus === "paid") {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "paid_bookings",
      });
    } else {
      if (booking.paymentStatus !== "paid") {
        const cancel = await cancelPayment({
          paymentIntentId: booking.paymentId,
        });
        if (!cancel) {
          return sendResponse({
            res,
            statusCode: 400,
            translationKey: "payment_cancel_error",
          });
        }
      }
      const listing = await Listing.findById(booking.listing);
      if (listing) {
        listing.status = "available";
        await listing.save();
      }
      booking.listingBookingStatus = "cancelled";
      await booking.save();  
    }
    //send notification
    // Send user notifications
    sendUserNotifications({
      recipientIds: [booking.renter.toString()],
      title: "Booking Canceled",
      body: `Your booking has been canceled by ${req.user.name}`,
      data: {
        type: NotificationTypes.BOOKING_CANCELED,
        bookingId: booking._id.toString(),
        objectType: "booking",
      },
      sender: booking.rentee,
      objectId: booking._id,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "booking_canceled",
      data: booking,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

const directPaidBookingById = async (req, res) => {
  const { id } = req.params;
  const { paymentMethodId } = req.body;

  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    if (!paymentMethodId || !paymentMethodId.startsWith("pm_")) {
      throw new Error("Invalid paymentMethodId or required");
    }
    const booking = await Booking.findById(id).populate(
      "renter",
      "currencyCode"
    );
    if (!booking) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "booking_not",
      });
    }

    // If the payment is made, do not allow cancellation
    if (booking.paymentStatus === "paid") {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "paid_bookings",
      });
    } else {
      if (booking.paymentStatus !== "paid") {
        const userAccount = await getUserAccount({
          userId: booking?.listingDataSnapshot?.creator,
        });
        if (!userAccount || !userAccount?.isActive) {
          return sendResponse({
            res,
            statusCode: 400,
            translationKey: "renter_stripe_account_not_found",
          });
        }
        const cancel = await cancelPayment({
          paymentIntentId: booking.paymentId,
        });
        if (!cancel) {
          return sendResponse({
            res,
            statusCode: 400,
            translationKey: "payment_error",
          });
        }
        const payment = await createPaymentIntent({
          amount: booking.totalBill,
          currency: booking.renter.currencyCode || "usd",
          email: req.user.email,
          destinationAccountId: userAccount?.accountId,
          payment_method: paymentMethodId,
        });
        if (!payment) {
          return sendResponse({
            res,
            statusCode: 400,
            translationKey: "payment_error",
          });
        }
        booking.paymentId = payment?.id;
        booking.paidAmount = booking.totalBill;
        booking.paymentStatus = "paid";
      }
      await booking.save();
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "booking_paid",
      data: booking,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};
// Delete a booking by ID
const deleteBookingById = async (req, res) => {
  const { id } = req.params;

  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    const booking = await Booking.findById(id);
    if (!booking) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "booking_not",
      });
    }

    // If the payment is made, do not permanently delete the booking
    if (booking.paymentStatus === "paid") {
      booking.listingBookingStatus = "deleted";
      await booking.save();
    } else {
      // If the payment is not made, mark the listing as available again
      const listing = await Listing.findById(booking.listing);
      if (listing) {
        listing.status = "available";
        await listing.save();
      }
      await booking.deleteOne();
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "booking_deleted",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Get all active bookings for a specific user
const getBookingsWithUser = async (req, res) => {
  const { userId } = req.params;
  const { _id, timezone, location, distanceUnit = "km" } = req.user;

  try {
    const validationOptions = {
      pathParams: ["userId"],
      objectIdFields: ["userId"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    const { page, limit } = parsePaginationParams(req);
    const { status, bookingType, from, to } = req.query;

    const filters = {
      renter: userId,
      listingBookingStatus: { $in: ["booked", "picked"] },
    };
    if (status) filters.listingBookingStatus = status;
    if (bookingType) filters.bookingType = bookingType;
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      filters.$or = [
        { fromDate: { $gte: fromDate, $lte: toDate } },
        { toDate: { $gte: fromDate, $lte: toDate } },
      ];
    }

    const [bookings, totalRecords] = await Promise.all([
      Booking.find(filters)
        .populate("rentee", "name profileIcon")
        .populate("renter", "name profileIcon location currencyCode")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Booking.countDocuments(filters),
    ]);

    // Calculate distance between location and renter.location
    const bookingsWithDistance = bookings.map((booking) => {
      let unit = distanceUnit;
      let distanceAtoB = null;
      if (
        location &&
        location.coordinates &&
        booking.renter.location &&
        booking.renter.location.coordinates
      ) {
        distanceAtoB = calculateDistance(
          location.coordinates,
          booking.renter.location.coordinates,
          unit
        );
      }
      return {
        ...booking.toJSON(booking?.renter?.currencyCode || "USD"),
        unit,
        distance: distanceAtoB !== null ? parseFloat(distanceAtoB) : 0.0,
        distanceLabel:
          distanceAtoB !== null ? `${distanceAtoB} ${unit} away` : "N/A",
      };
    });

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "bookings_fetched",
      data: bookingsWithDistance,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Get all active rentals for a specific user
const getRentalsWithUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const validationOptions = {
      pathParams: ["userId"],
      objectIdFields: ["userId"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    const { page, limit } = parsePaginationParams(req);
    const { status, bookingType, from, to } = req.query;

    const filters = {
      renter: userId,
      listingBookingStatus: { $in: ["booked", "picked"] },
    };
    if (status) filters.listingBookingStatus = status;
    if (bookingType) filters.bookingType = bookingType;
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      filters.$or = [
        { fromDate: { $gte: fromDate, $lte: toDate } },
        { toDate: { $gte: fromDate, $lte: toDate } },
      ];
    }

    var [rentals, totalRecords] = await Promise.all([
      Booking.find(filters)
        .populate("rentee", "name profileIcon")
        .populate("renter", "name profileIcon currencyCode")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Booking.countDocuments(filters),
    ]);

    //add currency symbol
    rentals.forEach((rental) => {
      rental.currencyCode = rental?.renter?.currencyCode || "USD";
    });

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "rentals_fetched",
      data: rentals,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Approve a booking by ID
const approveBookingById = async (req, res) => {
  const { id } = req.params;
  const { _id } = req.user;

  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    const booking = await Booking.findById(id);
    if (!booking) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "booking_not",
      });
    }
    //if renter is not current user throw error
    if (booking.renter.toString() !== _id.toString()) {
      return sendResponse({
        res,
        statusCode: 403,
        translationKey: "access_denied",
      });
    }
    //if already booked
    if (booking.listingBookingStatus != "pendingConfirm") {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "Booking already " + booking.listingBookingStatus,
      });
    }

    booking.listingBookingStatus = "booked";
    await booking.save();

    //send notification
    // Send user notifications
    sendUserNotifications({
      recipientIds: [booking.rentee.toString()],
      title: "Booking Approved",
      body: `Your booking has been approved by ${req.user.name}`,
      data: {
        type: NotificationTypes.BOOKING_APPROVED,
        bookingId: booking._id.toString(),
        objectType: "booking",
      },
      sender: booking.renter,
      objectId: booking._id,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "booking_approved",
      data: booking,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Reject a booking by ID
const rejectBookingById = async (req, res) => {
  const { id } = req.params;
  const { _id } = req.user;

  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    const booking = await Booking.findById(id);
    if (!booking) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "booking_not",
      });
    }
    //if renter is not current user throw error
    if (booking.renter.toString() !== _id.toString()) {
      return sendResponse({
        res,
        statusCode: 403,
        translationKey: "access_denied",
      });
    }
    //if already booked
    if (booking.listingBookingStatus != "pendingConfirm") {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "Booking already " + booking.listingBookingStatus,
      });
    }

    if (booking.paymentStatus !== "paid") {
      const cancel = await cancelPayment({
        paymentIntentId: booking.paymentId,
      });
      if (!cancel) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "payment_cancel_error",
        });
      }
    }

    booking.listingBookingStatus = "rejected";
    await booking.save();

    //send notification
    // Send user notifications
    sendUserNotifications({
      recipientIds: [booking.rentee.toString()],
      title: "Booking Rejected",
      body: `Your booking has been rejected by ${req.user.name}`,
      data: {
        type: NotificationTypes.BOOKING_REJECTED,
        bookingId: booking._id.toString(),
        objectType: "booking",
      },
      sender: booking.renter,
      objectId: booking._id,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "booking_rejected",
      data: booking,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

module.exports = {
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
};
