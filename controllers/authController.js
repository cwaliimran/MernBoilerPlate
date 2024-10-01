const { User, generateResetToken } = require("../models/userModel");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const { sendResponse, validateParams } = require("../helperUtils/responseUtil");
const { formatUserResponse } = require("../helperUtils/userResponseUtil");
const { sendEmailViaAwsSes } = require("../helperUtils/emailUtil");
const {
  registrationOtpEmailTemplate,
  forgotPasswordOtpEmailTemplate,
} = require("../helperUtils/emailTemplates");
const { createOrSkipDevice, Devices } = require("../models/Devices");
const validator = require("validator");
//register
const register = async (req, res) => {
  const { email, phoneNumber, deviceId, deviceType, userType } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const validationOptions = {
      rawData: [
        "phoneNumber",
        "name",
        "email",
        "password",
        "deviceId",
        "deviceType",
        "timezone",
      ],
      minLengthFields: {
        password: 6, // Password must be at least 6 characters long
      },
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

    // Fetch existing user and validate profile icon simultaneously
    const [existingUser] = await Promise.all([
      User.findOne({
        $or: [{ email: email }, { phoneNumber: phoneNumber }],
      }),
    ]);

    if (existingUser) {
      if (existingUser.email === email) {
        return sendResponse({
          res,
          statusCode: 409,
          translationKey: "Email already exists.",
        });
      } else if (existingUser.phoneNumber === phoneNumber) {
        return sendResponse({
          res,
          statusCode: 409,
          translationKey: "Phone number already exists.",
        });
      }
    }

    // Restrict admin creation
    let finalUserType = "user"; // default to user
    if (userType === "admin") {
      const adminCreationToken = req.header("x-admin-access-token");
      if (adminCreationToken === process.env.ADMIN_ACCESS_TOKEN) {
        finalUserType = "admin";
      } else {
        return sendResponse({
          res,
          statusCode: 403,
          translationKey: "Unauthorized to create admin user.",
        });
      }
    }

    // Create and save the user within the session
    const user = new User({
      ...req.body,
      accountState: { userType: finalUserType },
    });

    const otp = user.generateOtp(user.timezone);
    user.otp = otp;

    await user.save({ session });

    // Send email within the transaction
    const subject = "Welcome! Verify Your Email";
    const mBody = registrationOtpEmailTemplate(otp);
    // await sendEmailViaAwsSes([email], subject, mBody);

    // Commit the transaction
    await session.commitTransaction();

    // Construct base URL
    const baseUrl = `${process.env.S3_BASE_URL}/`;
    user.profileIcon = user.profileIcon
      ? baseUrl + user.profileIcon
      : baseUrl + "noimage.png";

    // Ensure toJSON method is applied to strip out sensitive data
    const userObject = user.toJSON();

    // Format the user response using the utility function
    const response = formatUserResponse(userObject);

    // Save device information (not part of the transaction)
    createOrSkipDevice(userObject._id, deviceId, deviceType);

    // Send successful response with token and user data
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "Signup successful",
      data: response,
    });
  } catch (error) {
    // Only abort the transaction if it hasn't been committed yet
    // If an error occurs before commit, abort the transaction
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    // Handle other errors
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error,
      translateMessage: false,
    });
  } finally {
    session.endSession(); // Ensure the session is always ended
  }
};

//login

const login = async (req, res) => {
  try {
    const { email, password, deviceId, deviceType, timezone } = req.body;

    const validationOptions = {
      rawData: ["email", "password", "deviceId", "deviceType", "timezone"],
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    const user = await User.findByCredentials(email, password);

    // Restrict admin login
    if (user.accountState.userType === "admin") {
      const adminCreationToken = req.header("x-admin-access-token");
      if (adminCreationToken === process.env.ADMIN_ACCESS_TOKEN) {
      } else {
        return sendResponse({
          res,
          statusCode: 403,
          translationKey: "Unauthorized to login as admin user.",
        });
      }
    }

    // Check the user's verification status
    const verificationStatus = user.verificationStatus;
    if (verificationStatus === "pending") {
      return sendResponse({
        res,
        statusCode: 401,
        translationKey:
          "Your account verification is pending. Please verify your account.",
      });
    }

    if (verificationStatus === "rejected") {
      return sendResponse({
        res,
        statusCode: 403,
        translationKey:
          "Your account verification has been rejected. Please contact support for further assistance.",
      });
    }

    if (
      user.accountState.status === "restricted" ||
      user.accountState.status === "suspended"
    ) {
      return sendResponse({
        res,
        statusCode: 403,
        translationKey:
          "Your account has been suspended. Please contact support for further assistance.",
      });
    }

    if (verificationStatus !== "verified") {
      return sendResponse({
        res,
        statusCode: 401,
        translationKey:
          "Your account is not verified. Please complete the verification process.",
      });
    }

    // Check if the account is softDeleted
    if (user.accountState.status === "softDeleted") {
      const currentDate = moment();
      const finalDeletionDate = moment(user.accountState.finalDeletionDate); // Final deletion date from the user model
      const daysUntilDeletion = finalDeletionDate.diff(currentDate, "days"); // Calculate the difference in days

      return sendResponse({
        res,
        statusCode: 423,
        translationKey: `Your account is marked for deletion. It will be permanently deleted after ${daysUntilDeletion} days. Please resume your account to login.`,
        translateMessage: false,
      });
    }

    // Update the user's timezone
    user.timezone = timezone;

    const token = user.generateAuthToken();

    // Construct base URL
    const baseUrl = `${process.env.S3_BASE_URL}/`;

    // Validate profile icon
    var pIcon = null;

    pIcon = user.profileIcon;
    if (pIcon) {
      user.profileIcon = pIcon ? baseUrl + pIcon : baseUrl + "noimage.png";
    }
    // Ensure toJSON method is applied to strip out sensitive data
    const userObject = user.toJSON();

    // Format the user response using the utility function
    const response = formatUserResponse(userObject, token, [], ["resetToken"]);

    // Save device information (not part of the transaction)
    createOrSkipDevice(userObject._id, deviceId, deviceType);

    // Send successful response with token and user data
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Login success",
      data: response,
      translateMessage: false,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: error.message,
      translateMessage: false,
    });
  }
};

// Generate OTP
const generateOtp = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { email } = req.body;
    const validationOptions = {
      rawData: ["email"],
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    const user = await User.findOne({ email });

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translateMessage: false,
        translationKey: "User not found",
      });
    }

    //check if account is restricted
    if (
      user.accountState.status === "restricted" ||
      user.accountState.status === "suspended"
    ) {
      return sendResponse({
        res,
        statusCode: 403,
        translationKey: "Your account is suspended. Please contact support.",
      });
    }

    const otp = user.generateOtp();
    await user.save({ session });

    // Send email within the transaction
    const subject = "Password Reset OTP";
    const mBody = forgotPasswordOtpEmailTemplate(otp);
    // await sendEmailViaAwsSes([email], subject, mBody);

    await session.commitTransaction();
    session.endSession();

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "OTP generated successfully",
      data: { otp },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while generating OTP",
      error: error.message,
    });
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    console.log("email", email + "otp", otp);

    const validationOptions = {
      rawData: ["email", "otp"],
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    // Find the user by email
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    // Check if user is found
    if (!user) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "Invalid email.",
        translateMessage: false,
      });
    }

    // Check if the OTP matches
    if (user.otpInfo.otp !== otp.toString()) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "Invalid OTP.",
        translateMessage: false,
      });
    }

    // Check if the OTP has expired based on user's timezone
    const currentTime = moment.tz(Date.now(), user.timezone).valueOf();

    if (user.otpInfo.otpExpires && user.otpInfo.otpExpires < currentTime) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "OTP has expired. Please request a new one.",
        translateMessage: false,
      });
    }

    // Clear the OTP and OTP expiration after successful verification
    user.otpInfo.otp = "";
    user.otpInfo.otpExpires = "";
    user.otpInfo.otpUsed = true; // Mark OTP as used
    user.verificationStatus = "verified";
    // Generate a password reset token (JWT or a UUID)
    const resetToken = generateResetToken(); // Function to generate a secure token
    user.resetToken = resetToken; // Save the token to the user model
    await user.save();

    // Fetch the updated user and profile icon simultaneously
    var updatedUser = await User.findById(user._id);

    // Construct base URL
    const baseUrl = `${process.env.S3_BASE_URL}/`;
    updatedUser.profileIcon = updatedUser
      ? baseUrl + updatedUser.profileIcon
      : baseUrl + "noimage.png";

    // Ensure toJSON method is applied to strip out sensitive data
    var userObject = updatedUser.toJSON();

    // Generate a new token for the user
    const token = user.generateAuthToken();

    // Format the user response using the utility function
    const response = formatUserResponse(userObject, token);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "OTP verified successfully",
      data: response,
      translateMessage: false,
    });
  } catch (error) {
    console.error("Error during OTP verification for login:", error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while verifying the OTP",
      error: error.message,
    });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, resetToken } = req.body;

    const validationOptions = {
      rawData: ["email", "newPassword", "resetToken"],
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    // Find the user by email
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      resetToken: resetToken,
    });

    if (!user) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "No valid OTP request found for this account",
        translateMessage: false,
      });
    }

    // Update the password and mark OTP as used
    user.password = newPassword;
    user.otpInfo.otpUsed = true; // Mark OTP as used
    user.otpInfo.otp = ""; // Clear OTP
    user.otpInfo.otpExpires = ""; // Clear OTP expiration
    user.resetToken = ""; // Clear OTP token

    await user.save();

    // Fetch the updated user with profile icon populated and generate a token simultaneously
    const [updatedUser, token] = await Promise.all([
      User.findById(user._id),
      user.generateAuthToken(),
    ]);
    // Construct base URL
    const baseUrl = `${process.env.S3_BASE_URL}/`;

    updatedUser.profileIcon = updatedUser.profileIcon
      ? baseUrl + updatedUser.profileIcon
      : baseUrl + "noimage.png";

    // Apply toJSON method to strip out sensitive data
    const userObject = updatedUser.toJSON();

    // Format the user response using the utility function
    const response = formatUserResponse(userObject, token);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Password has been reset",
      data: response,
      translateMessage: false,
    });
  } catch (error) {
    console.error("Error during password reset:", error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while resetting the password",
      error: error.message,
    });
  }
};

const logout = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req.user._id;

    // Use $pull to remove the specific device from the devices array
    await Devices.updateOne(
      { userId: userId }, // Find the user by userId
      { $pull: { devices: { deviceId: deviceId } } } // Remove the device with matching deviceId
    );

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Logged out successfully",
    });
  } catch (err) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: err.message,
      error: err.message,
      translateMessage: false,
    });
  }
};
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Set the final deletion date to 30 days from now
    const finalDeletionDate = moment().add(30, "days").toDate();

    // Update the user's account state to softDeleted and set the finalDeletionDate
    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "accountState.status": "softDeleted",
          "accountState.finalDeletionDate": finalDeletionDate,
        },
      },
      { new: true }
    );

    await Devices.updateOne(
      { userId: userId },
      { $set: { devices: [] } } // This will empty the array of devices for the user
    );

    return sendResponse({
      res,
      statusCode: 200,
      translationKey:
        "Account marked for deletion. It will be permanently deleted after 30 days.",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error: error.message,
    });
  }
};

const resumeAccount = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const validationOptions = {
      rawData: ["email", "otp"],
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    // Find the user by email and OTP
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      "otpInfo.otp": otp.toString(),
    });

    // Check if user is found
    if (!user) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "Invalid OTP or email.",
        translateMessage: false,
      });
    }

    // Check if the OTP has expired based on user's timezone
    const currentTime = moment.tz(Date.now(), user.timezone).valueOf();

    if (user.otpInfo.otpExpires && user.otpInfo.otpExpires < currentTime) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "OTP has expired. Please request a new one.",
        translateMessage: false,
      });
    }

    // Clear the OTP and OTP expiration after successful verification
    user.otpInfo.otp = "";
    user.otpInfo.otpExpires = "";
    user.otpInfo.otpUsed = true; // Mark OTP as used

    // Check if the account is marked as softDeleted
    if (user.accountState.status !== "softDeleted") {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "Your account is not marked for deletion.",
        translateMessage: false,
      });
    }

    // Reset the account status to active and remove the finalDeletionDate
    user.accountState.status = "active";
    user.accountState.finalDeletionDate = null;

    await user.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Account resumed successfully, you can login now.",
      translateMessage: false,
    });
  } catch (error) {
    console.error("Error during account resumption:", error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "An error occurred while resuming the account",
      error: error.message,
    });
  }
};

const socialAuth = async (req, res) => {
  const { provider, socialId, email, name, deviceId, deviceType, timezone } =
    req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const validationOptions = {
      rawData: [
        "provider",
        "socialId",
        "email",
        "name",
        "deviceId",
        "deviceType",
        "timezone",
      ],
      enumFields: {
        provider: ["google", "facebook", "apple"], // Allowed values for provider
      },
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    // Check for existing user by email
    const existingUser = await User.findOne({ email });

    // If user exists, update or link the social provider
    if (existingUser) {
      let providerLinked = false;

      // Check if the social ID is already linked, if not, link it
      if (provider === "google" && !existingUser.googleId) {
        existingUser.googleId = socialId; // Link Google account
        providerLinked = true;
      } else if (provider === "facebook" && !existingUser.facebookId) {
        existingUser.facebookId = socialId; // Link Facebook account
        providerLinked = true;
      } else if (provider === "apple" && !existingUser.appleId) {
        existingUser.appleId = socialId; // Link Apple account
        providerLinked = true;
      }

      // Always update the provider and timezone, regardless of providerLinked status
      existingUser.provider = provider; // Update the provider field to reflect the latest social login
      existingUser.timezone = timezone; // Update the timezone to reflect the user's current login
      existingUser.name = name;

      await existingUser.save({ session });
      const token = existingUser.generateAuthToken();
         //attach base url with profile icon
      const baseUrl = `${process.env.S3_BASE_URL}/`;
      existingUser.profileIcon = existingUser.profileIcon
        ? baseUrl + existingUser.profileIcon
        : baseUrl + "noimage.png";
      const response = formatUserResponse(existingUser, token);

      // Save device information
      createOrSkipDevice(existingUser._id, deviceId, deviceType);

      await session.commitTransaction();
      session.endSession();

      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "Login successful",
        data: response,
      });
    } else {
      // If user does not exist, treat this as a signup
      const newUser = new User({
        email,
        name,
        provider, // Set the initial provider
        [`${provider}Id`]: socialId, // Dynamically store the provider ID
        timezone,
        verificationStatus: "verified",
      });

      await newUser.save({ session });

      // Generate a token for the new user
      const token = newUser.generateAuthToken();
      // Construct base URL
      const baseUrl = `${process.env.S3_BASE_URL}/`;
      newUser.profileIcon = newUser.profileIcon
        ? baseUrl + newUser.profileIcon
        : baseUrl + "noimage.png";
      const response = formatUserResponse(newUser, token);

      // Save device information
      createOrSkipDevice(newUser._id, deviceId, deviceType);

      await session.commitTransaction();
      session.endSession();

      return sendResponse({
        res,
        statusCode: 201,
        translationKey: "Signup successful",
        data: response,
      });
    }
  } catch (error) {
    // Rollback transaction in case of any error
    await session.abortTransaction();
    session.endSession();
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error: error.message,
      translateMessage: false,
    });
  }
};

module.exports = {
  register,
  login,
  generateOtp,
  verifyOtp,
  resetPassword,
  logout,
  deleteAccount,
  resumeAccount,
  socialAuth,
};
