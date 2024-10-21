const { User } = require("../models/userModel");
const { sendResponse, validateParams } = require("../helperUtils/responseUtil");

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
        translationKey: "User not found",
        translateMessage: false,
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
      translationKey: "Document added/updated successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while updating the document",
      error,
    });
  }
};

// Update Document Status (Pending, Submitted, Verified, Rejected)
const updateDocumentStatus = async (req, res) => {
  const { userId } = req.params; // User ID to update document status
  const { status, rejectionReason } = req.body; // Document status and rejection reason

  const validationOptions = {
    pathParams: ["userId"],
    objectIdFields: ["userId"],
    rawData: ["status"],
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
        translationKey: "User not found",
        translateMessage: false,
      });
    }

    // Check if status is valid
    const validStatuses = ["pending", "submitted", "verified", "rejected"];
    if (!validStatuses.includes(status)) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey:
          "Invalid status, valid statuses are " + validStatuses.join(", "),
      });
    }

    user.verificationStatus["documents"] = "verified";

    // If rejected, add a rejection reason
    if (status === "rejected") {
      user.documents.rejectionReason = rejectionReason || "No reason provided";
    }

    await user.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Document status updated successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while updating the document status",
      error,
    });
  }
};

// Delete Document (Reset Front and Back Images)
const deleteDocument = async (req, res) => {
  const { userId } = req.params; // User ID to delete document for

  const validationOptions = {
    pathParams: ["userId"],
    objectIdFields: ["userId"],
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
        translationKey: "User not found",
        translateMessage: false,
      });
    }

    // Reset front and back images
    user.documents.frontImage = "";
    user.documents.backImage = "";
    user.documents.version += 1; // Increment version after deletion
    user.verificationStatus.documents = "pending"; // Set status back to pending

    await user.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Document deleted successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while deleting the document",
      error,
    });
  }
};


module.exports = {
  addDocument,
  updateDocumentStatus,
  deleteDocument,
};
