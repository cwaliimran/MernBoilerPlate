// middlewares/adminMiddleware.js
const { sendResponse } = require("../helperUtils/responseUtil");

const admin = (req, res, next) => {
  console.log(req.user.accountState.userType)
  if (req.user.accountState.userType === "admin") {
    next();
  } else {
    sendResponse({
      res,
      statusCode: 403,
      translationKey: "Access denied. Admins only.",
      error: "Access denied. Admins only."
    });
  }
};


module.exports = admin;
