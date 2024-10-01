// helperUtils/userResponseUtil.js

const { convertUtcToTimezone } = require("./responseUtil");

const formatUserResponse = (
  userObject,
  token = null,
  includeFields = [],
  excludeFields = []
) => {
  var pIcon = null;
  if (
    userObject.profileIcon
  ) {
    pIcon = userObject.profileIcon;
  }
  const response = {
    basicInfo: {
      _id: userObject._id,
      profileIcon: pIcon,
      name: userObject.nameToShow || userObject.name,
      email: userObject.email,
      phoneNumber: userObject.phoneNumber,
      phoneNote: userObject.phoneNote,
     
    },
    accountState: {
      userType: userObject.accountState?.userType || "user",
      status: userObject.accountState?.status || "active",
      verificationStatus: userObject.verificationStatus || "pending",
      ...(userObject.accountState?.reason
        ? { reason: userObject.accountState.reason }
        : {}),
    },
    
  };


  // Append metadata
  response.metadata = {
    timezone: userObject.timezone,
    createdAt: userObject.createdAt,
    updatedAt: userObject.updatedAt,
    __v: userObject.__v,
  };

  // Include otpInfo only in development environment
  let otpExpLocalTz;
  if (userObject.otpInfo && userObject.otpInfo.otpExpires) {
    otpExpLocalTz = convertUtcToTimezone(
      userObject.otpInfo.otpExpires,
      userObject.timezone
    );
  }

  if (process.env.NODE_ENV === "dev" && userObject.otpInfo) {
    response.otpInfo = {
      otp: userObject.otpInfo.otp,
      otpUsed: userObject.otpInfo.otpUsed,
      otpExpires: otpExpLocalTz || null, // Provide a default value if otpExpLocalTz is not set
    };
  }
  if(userObject.resetToken){
    response.resetToken = userObject.resetToken;
  }
  // Return the structured response with token
  // Append token only if it's not null
  if (token) {
    response.token = token;
  }

  // Determine which objects to include or exclude in the final response
  let finalResponse = response;

  // Include specific fields if specified
  if (includeFields.length > 0) {
    finalResponse = {};
    includeFields.forEach((field) => {
      if (response[field]) {
        finalResponse[field] = response[field];
      }
    });
  }

  // Exclude specific fields if specified
  if (excludeFields.length > 0) {
    excludeFields.forEach((fieldPath) => {
      const [mainField, subField] = fieldPath.split(".");
      if (subField) {
        if (finalResponse[mainField]) {
          delete finalResponse[mainField][subField];
        }
      } else {
        delete finalResponse[fieldPath];
      }
    });

    return finalResponse;
  } else {
    // Include all fields
    return response;
  }
};

module.exports = {
  formatUserResponse,
};