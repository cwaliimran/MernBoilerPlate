// emailTemplate.js
const APP_NAME = 'BIOLER PLATE PROJECT'; // Define the app name as a constant at the top
const currentYear = new Date().getFullYear(); // Dynamically get the current year

// Function to generate Registration OTP email template
const registrationOtpEmailTemplate = (otp) => `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        .email-container {
          font-family: Arial, sans-serif;
          line-height: 1.5;
          color: #333;
        }
        .email-header {
          background-color: #4CAF50;
          color: white;
          text-align: center;
          padding: 10px 0;
        }
        .email-body {
          margin: 20px;
        }
        .otp {
          font-size: 1.5em;
          color: #4CAF50;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          color: #888;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <h2>Welcome to ${APP_NAME}</h2>
        </div>
        <div class="email-body">
          <p>Hello,</p>
          <p>Thank you for registering with us. Please use the OTP below to complete your registration:</p>
          <p class="otp"><strong>${otp}</strong></p>
          <p>If you didn't initiate this request, please ignore this email.</p>
        </div>
        <div class="footer">
          &copy; ${currentYear} ${APP_NAME}. All rights reserved.
        </div>
      </div>
    </body>
  </html>
`;

// Function to generate Forgot Password OTP email template
const forgotPasswordOtpEmailTemplate = (otp) => `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        .email-container {
          font-family: Arial, sans-serif;
          line-height: 1.5;
          color: #333;
        }
        .email-header {
          background-color: #FF5733;
          color: white;
          text-align: center;
          padding: 10px 0;
        }
        .email-body {
          margin: 20px;
        }
        .otp {
          font-size: 1.5em;
          color: #FF5733;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          color: #888;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <h2>Password Reset Request</h2>
        </div>
        <div class="email-body">
          <p>Hello,</p>
          <p>We received a request to reset your password for your account at ${APP_NAME}. Please use the OTP below to reset your password:</p>
          <p class="otp"><strong>${otp}</strong></p>
          <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
        </div>
        <div class="footer">
          &copy; ${currentYear} ${APP_NAME}. All rights reserved.
        </div>
      </div>
    </body>
  </html>
`;

// Export both functions
module.exports = {
  registrationOtpEmailTemplate,
  forgotPasswordOtpEmailTemplate,
};
