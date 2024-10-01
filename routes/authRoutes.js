const express = require("express");
const auth = require("../middlewares/authMiddleware");

const {
  register,
  login,
  generateOtp,
  resetPassword,
  verifyOtp,
  logout,
  deleteAccount,
  resumeAccount,
  socialAuth,
} = require("../controllers/authController");
const createRateLimiter = require("../helperUtils/rateLimiter");

const router = express.Router();
// Create a rate limiter for signup routes
// Define rate limiters
const signupRateLimiter = createRateLimiter("register", 15, 15); // 15 requests per 15 minutes
const loginRateLimiter = createRateLimiter("login", 15, 15); // 15 requests per 15 minute
const generateOtpRateLimiter = createRateLimiter("forgotPassword", 15, 15); // 15 requests per 15 minutes
const resendOtpRateLimiter = createRateLimiter("resendOtp", 15, 15); // 15 requests per 15 minutes
const verifyOtpRateLimiter = createRateLimiter("verifyOtp", 15, 15); // 10 requests per 10 minutes

const resetPasswordRateLimiter = createRateLimiter("resetPassword", 15, 15); // 15 requests per 15 minutes

// Apply rate limiters to routes
router.post("/register", signupRateLimiter, register);
router.post("/login", loginRateLimiter, login);
router.post("/forgotPassword", generateOtpRateLimiter, generateOtp);
router.post("/resendOtp", resendOtpRateLimiter, generateOtp);
router.post("/verifyOtp", verifyOtpRateLimiter, verifyOtp);
router.post("/resetPassword", resetPasswordRateLimiter, resetPassword);

router.post("/logout", auth, logout);
router.delete("/deleteAccount", auth, deleteAccount);
router.put("/resumeAccount", resumeAccount);
router.post("/socialAuth", socialAuth);

module.exports = router;
