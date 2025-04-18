const Listing = require("../models/Listing");
const { User } = require("../models/userModel"); // Assuming this is the User model path
const Review = require("../models/Review"); // Assuming this is the Review model path

const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
} = require("../helperUtils/responseUtil");
const getHome = async (req, res) => {
  let lat, lng;

  if (
    req.user.location &&
    req.user.location.coordinates &&
    req.user.location.coordinates.length === 2
  ) {
    lat = req.user.location.coordinates[1];
    lng = req.user.location.coordinates[0];
  } else {
    lat = 0;
    lng = 0;
  }

  try {
    var dUnit = req.user.distanceUnit || "km";
    const { rating, search, radius = 50, unit = dUnit } = req.query;
    const { page, limit } = parsePaginationParams(req);
    const currentUser = req.user._id;

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const distanceRadius = parseFloat(radius);

    const earthRadius = unit === "miles" ? 3963.2 : 6378.1;

    // Base match condition
    const baseMatch = {
      creator: { $ne: currentUser },
      status: { $nin: ["deleted"] },
      openForRent: true,
    };

    // Search and rating filters
    const searchMatch = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const ratingMatch = rating
      ? {
          _id: {
            $in: await Review.aggregate([
              {
                $match: {
                  reviewType: "listing",
                  rating: { $gte: parseFloat(rating) },
                },
              },
              { $group: { _id: "$object", avgRating: { $avg: "$rating" } } },
              { $match: { avgRating: { $gte: parseFloat(rating) } } },
            ]).then((results) => results.map((result) => result._id)),
          },
        }
      : {};

    // Distance calculation
    const distanceCalculation = {
      $addFields: {
        distance: {
          $let: {
            vars: {
              lat1: { $multiply: [userLat, Math.PI / 180] },
              lng1: { $multiply: [userLng, Math.PI / 180] },
              lat2: {
                $multiply: [
                  { $arrayElemAt: ["$creator.location.coordinates", 1] },
                  Math.PI / 180,
                ],
              },
              lng2: {
                $multiply: [
                  { $arrayElemAt: ["$creator.location.coordinates", 0] },
                  Math.PI / 180,
                ],
              },
            },
            in: {
              $multiply: [
                earthRadius,
                {
                  $acos: {
                    $add: [
                      { $multiply: [{ $sin: "$$lat1" }, { $sin: "$$lat2" }] },
                      {
                        $multiply: [
                          { $cos: "$$lat1" },
                          { $cos: "$$lat2" },
                          { $cos: { $subtract: ["$$lng2", "$$lng1"] } },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    };

    const distanceFilter = {
      $match: distanceRadius === 1000 ? {} : { distance: { $lte: distanceRadius } },
    };

    // Pipeline for fetching paginated results
    const paginatedPipeline = [
      { $match: { ...baseMatch, ...searchMatch, ...ratingMatch } },
      {
        $lookup: {
          from: "users",
          localField: "creator",
          foreignField: "_id",
          as: "creator",
        },
      },
      { $unwind: "$creator" },
      distanceCalculation,
      { $addFields: { distance: { $round: ["$distance", 2] } } },
      distanceFilter,
      { $sort: { distance: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) },
      {
        $project: {
          name: 1,
          description: 1,
          rentPerHour: 1,
          rentPerDay: 1,
          images: 1,
          distance: 1,
          "creator.name": 1,
          "creator._id": 1,
          "creator.profileIcon": 1,
          "creator.currencyCode": 1,
        },
      },
    ];

    // Pipeline for totalRecords calculation
    const totalRecordsPipeline = [
      { $match: { ...baseMatch, ...searchMatch, ...ratingMatch } },
      {
        $lookup: {
          from: "users",
          localField: "creator",
          foreignField: "_id",
          as: "creator",
        },
      },
      { $unwind: "$creator" },
      distanceCalculation,
      { $addFields: { distance: { $round: ["$distance", 2] } } },
      distanceFilter,
      { $count: "totalRecords" },
    ];

    // Execute both pipelines
    const [listings, totalRecordsResult] = await Promise.all([
      Listing.aggregate(paginatedPipeline),
      Listing.aggregate(totalRecordsPipeline).then((results) =>
        results.length > 0 ? results[0].totalRecords : 0
      ),
    ]);

    // Fetch avgRating and totalReviews for the listings
    const listingIds = listings.map((listing) => listing._id);
    const listingRatings = await Review.aggregate([
      {
        $match: { reviewType: "listing", object: { $in: listingIds } },
      },
      {
        $group: {
          _id: "$object",
          avgRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    const meta = generateMeta(page, limit, totalRecordsResult);

    const formattedListings = listings.map((listing) => {
      const ratingData = listingRatings.find((rating) =>
      rating._id.equals(listing._id)
      );
      
      const listingInstance = new Listing(listing);
      return {
      ...listingInstance.toJSON(listing.creator.currencyCode || "USD"),
      distanceLabel: `${listing.distance} ${unit} away`,
      avgRating: ratingData?.avgRating || 0,
      totalReviews: ratingData?.totalReviews || 0,
      creator: {
        ...listing.creator,
        profileIcon: `${process.env.S3_BASE_URL}/${listing.creator.profileIcon}`,
      },
      };
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "listings_fetched",
      data: formattedListings,
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



module.exports = {
  getHome,
};
