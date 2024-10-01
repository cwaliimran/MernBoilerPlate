const jwt = require("jsonwebtoken");
const { User } = require("../models/userModel");
const { sendResponse } = require("../helperUtils/responseUtil");
const { i18nConfig } = require("../config/i18nConfig");

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      return sendResponse({
        res,
        statusCode: 401,
        translationKey: "Authorization header missing",
      });
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return sendResponse({
        res,
        statusCode: 401,
        translationKey: "Authorization Token missing",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the user with populated fields
    const user = await User.findById(decoded._id).select("name email timezone accountState.userType");
   
    if (!user) {
      return sendResponse({
        res,
        statusCode: 401,
        translationKey: "User not found",
      });
    }

    i18nConfig.setLocale(req, user.language || "en");
    req.token = token;
    req.user = user;

    next(); // Move to the next middleware/route handler
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return sendResponse({
      res,
      statusCode: 401,
      translationKey: "Invalid Authorization token",
      error: error.message,
    });
  }
};

module.exports = auth;
