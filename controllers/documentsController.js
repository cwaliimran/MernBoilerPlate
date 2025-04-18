const { User } = require("../models/userModel");
const { sendResponse, validateParams } = require("../helperUtils/responseUtil");
const { NotificationTypes } = require("../models/Notifications");
const { sendUserNotifications } = require("./communicationController");
const { accountOnBoardMail } = require("./accountController");

// Add or Update Document
const addDocument = async (req, res) => {
  const { _id: userId } = req.user;

  const { frontImage, backImage } = req.body; // Front and back images

  const validationOptions = {
    rawData: ["frontImage", "backImage"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return; // Validation failed, response already sent
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not",
      });
    }

    // Update the document images
    if (frontImage) user.documents.frontImage = frontImage;
    if (backImage) user.documents.backImage = backImage;

    user.verificationStatus.documents = "submitted"; // Set status to submitted
    await user.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "document_addedupdate",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "an_error_3",
      error,
    });
  }
};




module.exports = {
  addDocument,
};
