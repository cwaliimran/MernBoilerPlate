const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const moment = require("moment-timezone");
const validator = require("validator");
const { randomBytes } = require("crypto");

// Define subscription statuses
const SubscriptionType = {
  PLAN1: "plan1", //free
  PLAN2: "plan2", //monthly
  PLAN3: "plan3", // yearly
};

// Define subscription schema
const subscriptionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(SubscriptionType),
    required: true,
    default: SubscriptionType.PLAN1, // Default subscription for all users
  },
  startDate: {
    type: Date,
    default: Date.now, // Start date defaults to now for other subscriptions
  },
  endDate: {
    type: Date, // Can be null for lifetime subscriptions (like spark connection)
  },
});

const userSchema = new mongoose.Schema(
  {
    profileIcon: {
      type: String,
      default: "",
    },

    name: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      validate: {
        validator: function (value) {
          return validator.isEmail(value);
        },
        message: "Invalid email format.",
      },
    },
    phoneNumber: {
      type: String,
      default: "",
    },
    password: {
      type: String,
      default: "",
    },
    accountState: {
      userType: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
      },
      status: {
        type: String,
        enum: [
          "active",
          "inactive",
          "suspended",
          "softDeleted",
          "hardDeleted",
          "restricted",
        ],
        default: "active",
      },
      reason: {
        type: String,
        default: "",
      },
      suspensionDate: {
        type: Date,
      },
      finalDeletionDate: {
        type: Date, // field to keep track of final deletion date
      },
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    otpInfo: {
      otp: {
        type: String,
        default: "",
      },
      otpUsed: {
        type: Boolean,
        default: false,
      },
      otpExpires: {
        type: Date,
      },
    },
    resetToken: {
      //used to reset password
      type: String,
      default: "",
    },
    timezone: {
      type: String,
      default: "",
      required: true,
    },
    language: {
      type: String,
      default: "en",
    },

    blockedUsers: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    reportedBy: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    // Subscription Details
    subscriptions: {
      type: [subscriptionSchema],
      default: [
        {
          status: SubscriptionType.PLAN1,
          startDate: null,
          endDate: null, // No expiry for the default subscription
        },
      ],
    },

    provider: {
      // Social provider details
      type: String,
      enum: ["google", "facebook", "apple", "email"], // Provider types
      default: "email",
    },
    googleId: {
      type: String,
      default: null,
    },
    facebookId: {
      type: String,
      default: null,
    },
    appleId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving to database
userSchema.pre("save", async function (next) {
  const user = this;
  if (this.phoneNumber === "") {
    this.phoneNumber = null;
  }
  if (user.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
  // Convert the email to lowercase before saving
  if (user.isModified("email")) {
    user.email = user.email.toLowerCase().trim();
  }

  next();
});

// Generate JWT token
userSchema.methods.generateAuthToken = function () {
  const user = this;
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
  return token;
};

// Find user by credentials
userSchema.statics.findByCredentials = async (email, password) => {
  const user = await User.findOne({ email: email });
  if (!user) {
    throw new Error("No account found with the provided email address.");
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Incorrect password. Please try again.");
  }

  return user;
};

// Generate OTP
userSchema.methods.generateOtp = function (timezone = "UTC") {
  // default to UTC if no timezone is provided
  const user = this;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.otpInfo.otp = otp;

  // Use moment-timezone to set the expiration in the user's timezone to 1 minute
  const otpExpires = moment
    .tz(Date.now(), timezone)
    .add(10, "minute")
    .valueOf();
  user.otpInfo.otpExpires = otpExpires; // Set expiry in user's timezone

  user.otpInfo.otpUsed = false; // Reset otpUsed when generating a new OTP
  return otp;
};

// Exclude sensitive fields when returning user object
userSchema.methods.toJSON = function () {
  const user = this;
  const userObject = user.toObject();
  delete userObject.password;

  // include otpInfo only in development environment
  if (process.env.NODE_ENV == "prod") {
    delete userObject.otpInfo;
  }

  return userObject;
};
const generateResetToken = () => {
  return randomBytes(32).toString("hex"); // 64-character token
};

const User = mongoose.model("User", userSchema);

module.exports =  { User, SubscriptionType, generateResetToken };
