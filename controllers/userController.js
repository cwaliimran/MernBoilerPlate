const { User, SubscriptionType } = require("../models/userModel");
const moment = require("moment");
const { sendResponse, validateParams } = require("../helperUtils/responseUtil");
const { formatUserResponse } = require("../helperUtils/userResponseUtil");
const { NotificationTypes } = require("../models/Notifications");
const { sendUserNotifications } = require("./communicationController");
const validator = require("validator");
//get all users
//get all users

const allUsers = async (req, res) => {
  try {
    const data = await User.find({}).sort({ createdAt: -1 });
    console.log(data.length);
    sendResponse({
      res,
      statusCode: 200,
      translationKey: "Suggested friends fetched successfully",
      data,
    });
  } catch (error) {
    sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while fetching suggested friends",
      error,
    });
  }
};

const getNearbyUsers = async (req, res) => {
  const { longitude, latitude } = req.query;

  const validationOptions = {
    queryParams: ["longitude", "latitude"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return; // Validation failed, response already sent
  }

  try {
    const usersNearby = await User.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          distanceField: "distance",
          spherical: true,
          maxDistance: 5000, // Max distance in meters (e.g., 5km)
        },
      },
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Nearby users fetched successfully",
      data: usersNearby,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while fetching nearby users",
      error,
    });
  }
};

const documentsIdentity = async (req, res) => {
  const { userIdToVerify } = req.params; // ID of the user to verify
  const { type } = req.body; // Verification type

  const validationOptions = {
    pathParams: ["userIdToVerify"],
    objectIdFields: ["userIdToVerify"],
    rawData: ["type"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return; // Validation failed, response already sent
  }
  //update type in user
  try {
    const user = await User.findById(userIdToVerify);

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translateMessage: false,
        translationKey: "User to verify not found",
      });
    }

    // Check if the provided type is valid
    const validTypes = ["pending", "submitted", "verified", "rejected"];
    if (!validTypes.includes(type)) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "Invalid verification type, supported types are " + validTypes.join(", "),
        translateMessage: false,
      });
    }

    user.verificationStatus.documents = type;
    await user.save();
    const response = formatUserResponse(user, null, [], ["resetToken"]);
    return sendResponse({
      res,
      statusCode: 200,
      data: response,
      translationKey: "User identity updated successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while verifying the user",
      error,
    });
  }
};

// Block User Function
const blockUser = async (req, res) => {
  const { _id } = req.user;
  const { userIdToBlock } = req.params; // ID of the user to block

  const validationOptions = {
    pathParams: ["userIdToBlock"],
    objectIdFields: ["userIdToBlock"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return; // Validation failed, response already sent
  }
  if (_id.equals(userIdToBlock)) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "You cannot block yourself",
      translateMessage: false,
    });
  }
  try {
    const [currentUser, userToBlock] = await Promise.all([
      User.findById(_id).select("blockedUsers"),
      User.findById(userIdToBlock),
    ]);

    if (!userToBlock) {
      return sendResponse({
        res,
        statusCode: 404,
        translateMessage: false,
        translationKey: "User to block not found",
      });
    }

    // Check if already blocked
    if (currentUser.blockedUsers.includes(userIdToBlock)) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "User is already blocked",
        translateMessage: false,
      });
    }

    // Add the user to the blocked list of the current user
    currentUser.blockedUsers.push(userIdToBlock);

    // Save the current user
    await currentUser.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "User blocked successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while blocking the user",
      error,
    });
  }
};

// Report User Function
const reportUser = async (req, res) => {
  const currentUser = req.user;
  const { userIdToReport } = req.params; // ID of the user to report

  const validationOptions = {
    pathParams: ["userIdToReport"],
    objectIdFields: ["userIdToReport"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return; // Validation failed, response already sent
  }
  if (currentUser._id.equals(userIdToReport)) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "You cannot report yourself",
      translateMessage: false,
    });
  }
  try {
    const userToReport = await User.findById(userIdToReport);

    if (!userToReport) {
      return sendResponse({
        res,
        statusCode: 404,
        translateMessage: false,
        translationKey: "User to report not found",
      });
    }

    // Check if current user has already reported this user
    if (userToReport.reportedBy.includes(currentUser._id)) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "You have already reported this user",
        translateMessage: false,
      });
    }

    // Add current user's ID to the reportedBy list
    userToReport.reportedBy.push(currentUser._id);

    // Increment the report count
    userToReport.reportCount += 1;

    // Check if user should be suspended
    if (userToReport.reportCount >= 10) {
      userToReport.accountState.status = "suspended";
      userToReport.accountState.reason =
        "User suspended due to multiple reports.";
      userToReport.accountState.suspensionDate = new Date();
    }

    // Save the reported user
    await userToReport.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "User reported successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while reporting the user",
      error,
    });
  }
};

// Add or update a subscription for a user
const addOrUpdateSubscription = async (req, res) => {
  const { type } = req.body;
  const { _id } = req.user;

  // Validate subscription type
  if (!Object.values(SubscriptionType).includes(type)) {
    // Convert SubscriptionType values to an array
    const validSubscriptionTypes = Object.values(SubscriptionType);
    const errorMessage =
      "Invalid subscription type. Valid types are: " +
      validSubscriptionTypes.join(", ");
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: errorMessage,
      translateMessage: false,
    });
  }

  try {
    const user = await User.findById(_id).select("subscriptions");
    // Check if the subscription already exists
    const existingSubscription = user.subscriptions.find(
      (sub) => sub.type === type // Use 'type' instead of 'status'
    );

    if (existingSubscription) {
      // Update the expiry date based on subscription type
      if (type === SubscriptionType.BLOOM_AGAIN_ESSENTIALS) {
        existingSubscription.endDate = moment(existingSubscription.endDate)
          .add(1, "month")
          .toDate();
      } else if (type === SubscriptionType.HEALING_HEARTS) {
        existingSubscription.endDate = moment(existingSubscription.endDate)
          .add(1, "year")
          .toDate();
      }
    } else {
      // Add new subscription
      let endDate = null;
      if (type === SubscriptionType.BLOOM_AGAIN_ESSENTIALS) {
        endDate = moment().add(1, "month").toDate();
      } else if (type === SubscriptionType.HEALING_HEARTS) {
        endDate = moment().add(1, "year").toDate();
      }

      user.subscriptions.push({
        type, // Correct 'type' field
        startDate: new Date(),
        endDate,
      });
    }

    // Save the user with the updated subscription
    await user.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Subscription added or updated successfully",
      data: user.subscriptions,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey:
        "An error occurred while adding or updating the subscription",
      error,
    });
  }
};

// Remove a subscription
const removeSubscription = async (req, res) => {
  const { _id: userId } = req.user;
  const { subscriptionId } = req.params;

  try {
    // Find and remove the subscription
    const user = await User.findById(userId).select("subscriptions");
    const subscriptionIndex = user.subscriptions.findIndex(
      (sub) => sub._id.toString() === subscriptionId
    );
    if (subscriptionIndex === -1) {
      return sendResponse({
        res,
        statusCode: 404,
        translateMessage: false,
        translationKey: "Subscription not found",
      });
    }

    user.subscriptions.splice(subscriptionIndex, 1);

    // Save the user after removing the subscription
    await user.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Subscription removed successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while removing the subscription",
      error,
    });
  }
};

// Get all subscriptions for a user
const getSubscriptions = async (req, res) => {
  const { _id } = req.user;

  try {
    const user = await User.findById(_id).select("subscriptions");
    const subscriptions = user.subscriptions;

    if (
      subscriptions.length === 1 &&
      subscriptions[0].type === SubscriptionType.SPARK_CONNECTION
    ) {
      subscriptions[0].isActive = true;
    } else {
      const activeSubscriptions = subscriptions.filter((sub) => {
        return (
          sub.endDate &&
          moment(sub.endDate).isAfter(moment()) &&
          sub.type !== SubscriptionType.SPARK_CONNECTION
        );
      });

      if (activeSubscriptions.length > 0) {
        const maxExpirySubscription = activeSubscriptions.reduce(
          (maxSub, currentSub) => {
            return moment(currentSub.endDate).isAfter(moment(maxSub.endDate))
              ? currentSub
              : maxSub;
          }
        );

        subscriptions.forEach((sub) => {
          sub.isActive = sub._id.equals(maxExpirySubscription._id);
        });
      }
    }

    const formattedSubscriptions = subscriptions.map((sub) => {
      return {
        ...sub.toObject(),
        isActive: sub.isActive,
      };
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "User subscriptions fetched successfully",
      data: formattedSubscriptions,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while fetching user subscriptions",
      error,
    });
  }
};

// Create a mapping for all possible fields and their respective collections
const populationFields = {
  profileIcon: { path: "profileIcon.refId" },
  age: { path: "personalDetails.age", select: "range" },
  pregnancyType: { path: "pregnancyDetails.pregnancyType", select: "type" },
  conceptionMethod: {
    path: "pregnancyDetails.conceptionMethod",
    select: "method",
  },
  weeksOfPregnancyUntilLossRange: {
    path: "pregnancyDetails.weeksOfPregnancyUntilLossRange",
    select: "range",
  },
  pregnancyLossType: {
    path: "lossDetails.pregnancyLoss.pregnancyLossType",
    select: "type",
  },
  yearOfLossRange: { path: "lossDetails.yearOfLossRange", select: "range" },
  numberOfPregnancyLosses: {
    path: "lossDetails.numberOfPregnancyLosses",
    select: "range",
  },
  healingPhase: { path: "healingPhaseDetails.healingPhase", select: "phase" },
  emotionalStatus: {
    path: "healingPhaseDetails.emotionalStatus",
    select: "status",
  },
  pregnancyPlanningStatus: {
    path: "healingPhaseDetails.pregnancyPlanningStatus",
    select: "status",
  },
  additionalSupportNeeds: {
    path: "healingPhaseDetails.additionalSupportNeeds",
    select: "need",
  },
};

/**
 * Dynamic population function to fetch user with populated fields.
 * @param {String} userId - The ID of the user to fetch.
 * @param {Array} fieldsToPopulate - An array of fields that need to be populated.
 * @returns {Promise<Object>} - The populated user object.
 */
const getUserWithPopulatedFields = async (userId, fieldsToPopulate = []) => {
  try {
    let query = User.findById(userId);

    // Build the dynamic population based on the fields requested
    fieldsToPopulate.forEach((field) => {
      const populationConfig = populationFields[field];
      if (populationConfig) {
        query = query.populate(populationConfig.path, populationConfig.select);
      }
    });

    // Execute the query and return the populated user
    const user = await query.exec();
    return user; // Return the user object
  } catch (error) {
    console.error("Error fetching user:", error);
    throw new Error("User fetch error"); // Let the middleware handle the error response
  }
};

/**
 * Dynamic population function to fetch user with populated fields.
 * @param {String} userId - The ID of the user to fetch.
 * @param {Array} fieldsToPopulate - An array of fields that need to be populated.
 * @returns {Promise<Object>} - The populated user object.
 */
const getUserProfile = async (req, res, next, fieldsToPopulate = []) => {
  try {
    const currentUser = req.user;

    let query = User.findById(currentUser._id);

    // Build the dynamic population based on the fields requested
    if (fieldsToPopulate.length > 0) {
      fieldsToPopulate.forEach((field) => {
        const populationConfig = populationFields[field];
        if (populationConfig) {
          query = query.populate(
            populationConfig.path,
            populationConfig.select
          );
        }
      });
    }

    // Execute the query and return the populated user
    const user = await query.exec();

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translateMessage: false,
        translationKey: "User not found",
      });
    }
  
     // Ensure toJSON method is applied to strip out sensitive data
     const userObject = user.toJSON();
     console.log("object",userObject);
    const response = formatUserResponse(userObject, null, [], ["resetToken"]);
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "User fetched successfully",
      data: response,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: `An error occurred while fetching the user: ${error.message}`,
      error,
    });
  }
};

/**
 * Update user profile function.
 * @param {Object} req - The request object containing user data.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {Promise<void>}
 */
const updateUserProfile = async (req, res, next) => {
  const { name, profileIcon, phoneNumber, location } = req.body;
  const currentUser = req.user;

  try {
    const user = await User.findById(currentUser._id);

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translateMessage: false,
        translationKey: "User not found",
      });
    }

    if (profileIcon) {
      user.profileIcon = profileIcon;
    }

    // Update fields if provided
    if (name && name.trim() !== "") user.name = name;
    if (phoneNumber) {
      //validate phone using validator
      if (!validator.isMobilePhone(phoneNumber)) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "Invalid phone number",
          translateMessage: false,
        });
      }
      user.phoneNumber = phoneNumber;
    }

    if (location) {
      // Validate location
      const { coordinates, fullAddress } = location;
      if (!coordinates || coordinates.length !== 2 || !fullAddress) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "Invalid location data",
          translateMessage: false,
        });
      }
      // Ensure coordinates are numbers
      const [longitude, latitude] = coordinates;
      if (typeof longitude !== "number" || typeof latitude !== "number") {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "Invalid coordinates data",
          translateMessage: false,
        });
      }
      user.location = {
        type: "Point",
        coordinates: [longitude, latitude],
        fullAddress,
      };
    }

    // Save the updated user
    await user.save();

   // Ensure toJSON method is applied to strip out sensitive data
   const userObject = user.toJSON();

    const response = formatUserResponse(userObject, null, [], ["resetToken"]);
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "User profile updated successfully",
      data: response,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: `An error occurred while updating the user profile: ${error.message}`,
      error,
      translateMessage: false,
    });
  }
};

module.exports = {
  allUsers,
  blockUser,
  reportUser,
  addOrUpdateSubscription,
  removeSubscription,
  getSubscriptions,
  getUserWithPopulatedFields,
  getUserProfile,
  updateUserProfile,
  documentsIdentity,
};
