// controllers/contactUsController.js
const ContactUs = require("../models/ContactUs");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("../helperUtils/responseUtil");
const validator = require("validator");
const { sendEmailViaAwsSes } = require("../helperUtils/emailUtil");
const { config } = require("dotenv");

// Create a new contact request
const createContactRequest = async (req, res) => {
  const { name, email, phoneNumber, description } = req.body;

  const validationOptions = {
    rawData: ["name", "email", "description"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  // Validate phone number format
  if (
    phoneNumber &&
    !validator.isMobilePhone(phoneNumber, "any", { strictMode: true })
  ) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "Invalid phone number format.",
      translateMessage: false,
    });
  }

  try {
    const contactRequest = new ContactUs({
      name,
      email,
      phoneNumber,
      description,
      status: "pending", // Set the default status
    });

    // Send email within the transaction
    const subject = "Contact Us Request by " + name;
    //append phone number with description if available
    const mDescription = phoneNumber
      ? `${description} \n Name: ${name} \n Email: ${email} \n Phone Number: ${phoneNumber}`
      : `${description} \n Name: ${name} \n Email: ${email}`;

    const supportEmail = process.env.SUPPORT_EMAIL;

    await Promise.all([
      contactRequest.save(),
      // sendEmailViaAwsSes([supportEmail], subject, mDescription, {
      // isHtml: false,
      // }),
    ]);

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "Contact request created successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "Internal server error",
      error: error,
    });
  }
};

// Get all contact requests (Admin)
const getContactRequests = async (req, res) => {
  try {
    const { page, limit } = parsePaginationParams(req);
    const [contactRequests, totalRecords] = await Promise.all([
      ContactUs.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      ContactUs.countDocuments(),
    ]);
    // Calculate pagination meta
    const totalPages = totalRecords === 0 ? 1 : Math.ceil(totalRecords / limit);
    const meta = generateMeta(page, limit, totalRecords, totalPages);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Contact requests fetched successfully",
      data: contactRequests,
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

// Update contact request status (Admin)
const updateContactRequestStatus = async (req, res) => {
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
    const contactRequest = await ContactUs.findById(id);
    if (!contactRequest) {
      return sendResponse({
        res,
        statusCode: 404,
        translateMessage: false,
        translationKey: "Contact request not found",
      });
    }

    contactRequest.status = status;
    await contactRequest.save();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Contact request updated successfully",
      data: contactRequest,
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

// Delete contact request (Admin)
const deleteContactRequest = async (req, res) => {
  const { id } = req.params;

  const validationOptions = {
    pathParams: ["id"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return; // Invalid request data response already sent by validateParams
  }

  try {
    const contactRequest = await ContactUs.findById(id);
    if (!contactRequest) {
      return sendResponse({
        res,
        statusCode: 404,
        translateMessage: false,
        translationKey: "Contact request not found",
      });
    }

    await contactRequest.deleteOne();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Contact request deleted successfully",
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
  createContactRequest,
  getContactRequests,
  updateContactRequestStatus,
  deleteContactRequest,
};
