const AdminSettings = require('../models/AdminSettings');
const { sendResponse } = require('../helperUtils/responseUtil');

// Get Terms and Conditions
const getTermsAndConditions = async (req, res) => {
  try {
    const settings = await AdminSettings.findOne({}, 'terms_and_conditions');
    if (!settings) {
      return sendResponse({
        res,
        statusCode: 404,
translateMessage: false,
        translationKey: "Terms and Conditions not found",
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Terms and Conditions fetched successfully",
      data: settings
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error
    });
  }
};

// Get About Us
const getAboutUs = async (req, res) => {
  try {
    const settings = await AdminSettings.findOne({}, 'about_us');
    if (!settings) {
      return sendResponse({
        res,
        statusCode: 404,
translateMessage: false,
        translationKey: "About Us not found"
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "About Us fetched successfully",
      data: settings
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error
    });
  }
};

// Get Privacy Policy
const getPrivacyPolicy = async (req, res) => {
  try {
    const settings = await AdminSettings.findOne({}, 'privacy_policy');
    if (!settings) {
      return sendResponse({
        res,
        statusCode: 404,
translateMessage: false,
        translationKey: "Privacy Policy not found"
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Privacy Policy fetched successfully",
      data: settings
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error
    });
  }
};

// Create Admin Settings
const createAdminSettings = async (req, res) => {
  const { terms_and_conditions, about_us, privacy_policy } = req.body;

  try {
    // Check if AdminSettings already exist
    const existingSettings = await AdminSettings.findOne();
    if (existingSettings) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "Admin settings already exist",
        translateMessage : false,
      });
    }

    // Create new admin settings
    const newSettings = new AdminSettings({
      terms_and_conditions: terms_and_conditions || '',
      about_us: about_us || '',
      privacy_policy: privacy_policy || '',
    });

    const savedSettings = await newSettings.save();
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "Admin settings created successfully",
      data: savedSettings
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error
    });
  }
};

// Update Admin Settings (Optional: To update multiple fields at once)
const updateAdminSettings = async (req, res) => {
  const { id } = req.params;
  const updateData = {};

  if (req.body.terms_and_conditions) updateData.terms_and_conditions = req.body.terms_and_conditions;
  if (req.body.about_us) updateData.about_us = req.body.about_us;
  if (req.body.privacy_policy) updateData.privacy_policy = req.body.privacy_policy;

  try {
    const settings = await AdminSettings.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!settings) {
      return sendResponse({
        res,
        statusCode: 404,
        translateMessage: false,
        translationKey: "Admin settings not found"
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Admin settings updated successfully",
      data: settings
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error
    });
  }
};

module.exports = {
  getTermsAndConditions,
  getAboutUs,
  getPrivacyPolicy,
  updateAdminSettings,
  createAdminSettings
};
