// controllers/supportController.js
const SupportRequest = require('../models/SupportRequest');
const { sendResponse, validateParams } = require('../helperUtils/responseUtil');

// Create a new support request
const createSupportRequest = async (req, res) => {
  const { name, email, subject, message } = req.body;

  const validationOptions = {
    rawData: ['name', 'email', 'subject', 'message'],
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
      status: 'pending', // Set the default status
    });

    await supportRequest.save();
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: 'Support request created successfully',
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: 'Internal server error',
      error: error.message,
    });
  }
};

// Get all support requests (Admin)
const getSupportRequests = async (req, res) => {
  try {
    const supportRequests = await SupportRequest.find().sort({ createdAt: -1 });
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: 'Support requests fetched successfully',
      data: supportRequests,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: 'Internal server error',
      error: error.message,
    });
  }
};

// Update support request status (Admin)
const updateSupportRequestStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validationOptions = {
    pathParams: ['id'],
    rawData: ['status'],
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
        translationKey: 'Support request not found',
      });
    }

    supportRequest.status = status;
    await supportRequest.save();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: 'Support request updated successfully',
      data: supportRequest,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: 'Internal server error',
      error: error.message,
    });
  }
};

module.exports = {
  createSupportRequest,
  getSupportRequests,
  updateSupportRequestStatus,
};
