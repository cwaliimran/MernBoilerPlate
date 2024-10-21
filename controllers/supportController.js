// controllers/supportController.js
const SupportRequest = require("../models/SupportRequest");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("../helperUtils/responseUtil");

// Create a new support request
const createSupportRequest = async (req, res) => {
  const { name, email, subject, message } = req.body;

  const validationOptions = {
    rawData: ["name", "email", "subject", "message"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    const supportRequest = new SupportRequest({
      name,
      email,
      subject,
      message,
      status: "pending", // Set the default status
    });

    await supportRequest.save();
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "Support request created successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "Internal server error",
      error: error.message,
    });
  }
};

// Get all support requests (Admin)
const getSupportRequests = async (req, res) => {
  try {
    const { page, limit } = parsePaginationParams(req);
    const [supportRequests, totalRecords] = await Promise.all([
      SupportRequest.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      SupportRequest.countDocuments()
    ]);
    // Calculate pagination meta
    const totalPages = totalRecords === 0 ? 1 : Math.ceil(totalRecords / limit);
    const meta = generateMeta(page, limit, totalRecords, totalPages);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Support requests fetched successfully",
      data: supportRequests,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "Internal server error",
      error: error.message,
    });
  }
};

// Update support request status (Admin)
const updateSupportRequestStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validationOptions = {
    pathParams: ["id"],
    rawData: ["status"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return; // Invalid request data response already sent by validateParams
  }

  try {
    const supportRequest = await SupportRequest.findById(id);
    if (!supportRequest) {
      return sendResponse({
        res,
        statusCode: 404,
        translateMessage: false,
        translationKey: "Support request not found",
      });
    }

    supportRequest.status = status;
    await supportRequest.save();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Support request updated successfully",
      data: supportRequest,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "Internal server error",
      error: error.message,
    });
  }
};

// Delete support request (Admin)
const deleteSupportRequest = async (req, res) => {
  const { id } = req.params;

  const validationOptions = {
    pathParams: ["id"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return; // Invalid request data response already sent by validateParams
  }

  try {
    const supportRequest = await SupportRequest.findById(id);
    if (!supportRequest) {
      return sendResponse({
        res,
        statusCode: 404,
        translateMessage: false,
        translationKey: "Support request not found",
      });
    }

    await supportRequest.deleteOne();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Support request deleted successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  createSupportRequest,
  getSupportRequests,
  updateSupportRequestStatus,
  deleteSupportRequest,
};
