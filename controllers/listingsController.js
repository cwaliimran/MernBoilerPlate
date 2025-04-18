const Listing = require("../models/Listing");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("../helperUtils/responseUtil");
const Review = require("../models/Review");
const { getUserAccount } = require("../helperUtils/stripeUtil");
const { User } = require("../models/userModel");

// Create a new listing
const createListing = async (req, res) => {
  const {
    name,
    description,
    images,
    pickupTime,
    pickupEndTime,
    totalValue,
    openForRent,
    rentPerHour,
    rentPerDay,
    instantBooking = "yes",
  } = req.body;
  const { _id, currencyCode } = req.user; // Assuming the user is logged in and authenticated
  const validationOptions = {
    rawData: [
      "name",
      "description",
      "images",
      "pickupTime",
      "pickupEndTime",
      "totalValue",
      "openForRent",
      "rentPerHour",
      "rentPerDay",
      "instantBooking",
    ],
    timeFields: {
      pickupTime: "hh:mm a", // Default time for pickup
      pickupEndTime: "hh:mm a", // Default time for pickupEndTime
    },
    enumFields: {
      instantBooking: ["yes", "no"],
      },
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    var listing = new Listing({
      name,
      description,
      images,
      pickupTime,
      pickupEndTime,
      totalValue,
      openForRent,
      rentPerHour,
      rentPerDay,
      instantBooking,
      creator:_id, // Attach the creator to the listing

    });

    await listing.save();

    const listingObj = listing.toJSON();
     listingObj.currencyCode = currencyCode;
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "listing_created",
      data: listingObj,
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

// Get all listings
const getAllListings = async (req, res) => {
  try {
    const { page, limit } = parsePaginationParams(req);
    const [listings, totalRecords] = await Promise.all([
      Listing.find({ status: { $ne: "deleted" } }) // Only fetch active listings
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Listing.countDocuments({ status: { $ne: "deleted" } }),
    ]);

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "listings_fetched",
      data: listings,
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

// Get all listings available for users
const getAllListingsByUser = async (req, res) => {
  try {
    const { _id } = req.user;
    const { page, limit } = parsePaginationParams(req);
    const [listings, totalRecords] = await Promise.all([
      Listing.find({ status: { $ne: "deleted" }, creator: _id }) // Only fetch active listings created by the user
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("creator", "currencyCode")
        ,
      Listing.countDocuments({ status: { $ne: "deleted" }, creator: _id }),
    ]);

    const listingIds = listings.map((listing) => listing._id);

    const avgRatings = await Review.aggregate([
      {
        $match: {
          reviewType: "listing",
          object: { $in: listingIds },
        },
      },
      {
        $group: {
          _id: "$object",
          avgRating: { $avg: "$rating" },
        },
      },
    ]);

    const listingsWithRatings = listings.map((listing) => {
      const rating = avgRatings.find((r) => r._id.equals(listing._id));
      return {
        ...listing.toJSON(listing.creator?.currencyCode || "USD"),
        avgRating: rating ? rating.avgRating : 0,
      };
    });

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "listings_available",
      data: listingsWithRatings,
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

// Get a single listing by ID and recent reviews
const getListingById = async (req, res) => {
  const { id } = req.params;
  const { limit = 5 } = req.query; // Default to 5 recent reviews if not provided

  try {
    // Fetch listing and recent reviews in parallel using Promise.all
    const [listing, recentReviews] = await Promise.all([
      Listing.findById(id).populate("creator", "name profileIcon location currencyCode"), // Populate creator field
      Review.find({ object: id, reviewType: "listing" })
        .sort({ createdAt: -1 }) // Sort by most recent
        .limit(5) // Limit to 5 reviews
        .populate({
          path: "subject",
          select: "name profileIcon",
        }), // Populate subject field
    ]);

    // Check if listing exists and is not deleted
    if (!listing || listing.status === "deleted") {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "listing_not_1",
      });
    }


    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "listing_and",
      data: {
        listing: listing.toJSON((listing.creator?.currencyCode) || "USD"), // Spread listing fields into data
        recentReviews,
      },
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
// Update a listing by ID
const updateListingById = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    images,
    pickupTime,
    pickupEndTime,
    totalValue,
    openForRent,
    status,
    rentPerHour,
    rentPerDay,
    instantBooking,
  } = req.body;

  const validationOptions = {
    pathParams: ["id"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    const listing = await Listing.findById(id);
    if (!listing || listing.status === "deleted") {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "listing_not_1",
      });
    }

    // Update the listing's fields with the new values, or retain the old values if not provided
    listing.name = name || listing.name;
    listing.description = description || listing.description;
    listing.instantBooking = instantBooking || listing.instantBooking;
    listing.images = images || listing.images;
    listing.pickupTime = pickupTime || listing.pickupTime;
    listing.pickupEndTime = pickupEndTime || listing.pickupEndTime;
    listing.totalValue =
      totalValue !== undefined ? totalValue : listing.totalValue;
    listing.openForRent =
      openForRent !== undefined ? openForRent : listing.openForRent;

    // Update the status field only if it's provided
    if (status && ["available", "booked", "deleted"].includes(status)) {
      listing.status = status;
    }

    listing.rentPerHour =
      rentPerHour !== undefined ? rentPerHour : listing.rentPerHour;
    listing.rentPerDay =
      rentPerDay !== undefined ? rentPerDay : listing.rentPerDay;

    await listing.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "listing_updated",
      data: listing,
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

// Mark listing as deleted
const deleteListingById = async (req, res) => {
  const { id } = req.params;

  try {
    const listing = await Listing.findById(id);
    if (!listing || listing.status === "deleted") {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "listing_not_1",
      });
    }

    // Update the status to 'deleted' instead of removing the listing
    listing.status = "deleted";
    await listing.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "listing_marked",
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
  createListing,
  getAllListings,
  getAllListingsByUser,
  getListingById,
  updateListingById,
  deleteListingById,
};
