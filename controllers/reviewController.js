const Review = require("../models/Review");
const Listing = require("../models/Listing");
const { User } = require("../models/userModel");
const Booking = require("../models/Booking");
const moment = require("moment");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("../helperUtils/responseUtil");

// Create a new review
const createReview = async (req, res) => {
  const { reviewType, objectId, bookingId, rating, comment } = req.body;
  const currentUserId = req.user._id; // Get the current user's ID from the auth middleware

  const validationOptions = {
    rawData: ["reviewType", "rating"],
    minLengthFields: { rating: 1 },
    enumFields: {
      reviewType: ["listing", "user"],
    },
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    let reviewData = {
      reviewType,
      object: objectId,
      bookingId,
      subject: currentUserId,
      rating,
      comment,
    };

    // Ensure the object (Listing or User) and booking exist
    const [object, booking] = await Promise.all([
      reviewType === "listing"
        ? Listing.findById(objectId)
        : User.findById(objectId),
      Booking.findById(bookingId),
    ]);

    if (!object) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey:
          reviewType === "listing" ? "Listing not found" : "User not found",
      });
    }

    if (!booking) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "booking_not",
      });
    }

    // Check if a review already exists for this booking and user/listing
    const existingReview = await Review.findOne({
      bookingId,
      subject: currentUserId,
      object: objectId,
    });
    if (existingReview) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "review_already",
      });
    }

    // Create a new review
    const review = new Review(reviewData);
    await review.save();

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "review_created",
      data: review,
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

// Get all reviews for a specific listing or user
const getReviewsByType = async (req, res) => {
  const { timezone } = req.user;
  const { reviewType, entityId } = req.params;
  const { page, limit } = parsePaginationParams(req);

  try {
    const query = { reviewType, object: entityId };

    const [reviews, totalRecords] = await Promise.all([
      Review.find(query)
        .populate("subject", "name profileIcon")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Review.countDocuments(query),
    ]);

    //add timesince with reviews

    const formattedReviews = reviews.map((review) => {
      const localDate = moment(review.createdAt).tz(timezone).format();
      const subject = review.subject.toJSON ? review.subject.toJSON() : review.subject;
      return {
        ...review.toObject(),
        subject,
        timesince: moment(localDate).fromNow(),
      };
    });

    // Calculate pagination meta
    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "reviews_fetched",
      data: formattedReviews,
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

// Update a review by ID
const updateReviewById = async (req, res) => {
  const { reviewId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user._id; // Ensure only the owner of the review can update it

  try {
    const review = await Review.findById(reviewId);

    if (!review) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "review_not",
      });
    }

    // Ensure the review belongs to the current user
    if (review.subject.toString() !== userId.toString()) {
      return sendResponse({
        res,
        statusCode: 403,
        translationKey: "you_are",
      });
    }

    // Update the review fields
    if (rating) review.rating = rating;
    if (comment) review.comment = comment;

    review.updatedAt = Date.now();
    await review.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "review_updated",
      data: review,
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

// Delete a review by ID
const deleteReviewById = async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user._id; // Ensure only the owner of the review can delete it

  try {
    const review = await Review.findById(reviewId);

    if (!review) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "review_not",
      });
    }

    // Ensure the review belongs to the current user
    if (review.subject.toString() !== userId.toString()) {
      return sendResponse({
        res,
        statusCode: 403,
        translationKey: "you_are_1",
      });
    }

    await review.deleteOne();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "review_deleted",
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

// Get a review by ID
const getReviewById = async (req, res) => {
  const { reviewId } = req.params;

  try {
    const review = await Review.findById(reviewId).populate("subject", "name");

    if (!review) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "review_not",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "review_fetched",
      data: review,
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
  createReview,
  getReviewsByType,
  updateReviewById,
  deleteReviewById,
  getReviewById,
};
