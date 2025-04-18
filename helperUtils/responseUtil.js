const mongoose = require("mongoose");
const moment = require("moment-timezone");
const { camelCase } = require("lodash");
const app = require("../server");

/**
 * Sends a JSON response with optional status code, message, data, and meta information.
 * @param {object} res - Express response object.
 * @param {number} [statusCode=200] - HTTP status code (default: 200).
 * @param {string} [translationKey=''] - Base message to send in the response (default: '').
 * @param {object|array|null} [data=null] - Data to send in the response body (default: null).
 * @param {object} [meta] - Additional metadata to include in the response (optional).
 */
const sendResponse = ({
  res,
  statusCode = 200,
  translationKey = "",
  data = null,
  meta = null,
  error = null,
  translateMessage = true,
  values = {}, // Add values parameter for dynamic translation
}) => {
  // Log the error regardless of the translation flag

  // Prepare the response object
  const response = {};
  if (translateMessage) {
    // Get the translation key from the locale file and replace the placeholders using the provided values
    let message = res?.req?.__(translationKey);

    // If the message is missing, undefined, or equals the raw translationKey, fall back to translationKey
    if (!message || message.trim() === "" || message === translationKey) {
      message = translationKey;
    }

    // If values are provided, replace placeholders in the translation
    if (values && typeof values === "object") {
      Object.keys(values).forEach((key) => {
        const placeholder = `{${key}}`;
        message = message.replace(placeholder, values[key]);
      });
    }
    response.message = message;
  } else {
    response.message = translationKey;
  }

  // Check if response.message is an empty object, and set a default message if so
  if (
    typeof response.message === "object" &&
    response.message !== null &&
    Object.keys(response.message).length === 0
  ) {
    response.message = "Something went wrong"; // Default message for empty objects
  }

  // Ensure response.message is a string before using trim()
  if (typeof response.message === "string" && response.message.trim() === "") {
    response.message = translationKey; // Fallback to translation key if the message is empty
  } else if (!response.message) {
    // If response.message is undefined or null, set it to the translation key
    response.message = translationKey;
  }
  // Include data in the response if provided
  if (data !== undefined && data !== null) {
    response.data = data;
  }

  // Include meta information if provided
  if (meta) {
    response.meta = meta;
  }
  if (process.env.NODE_ENV === "dev") {
    if (error !== null && error !== undefined) {
      if (error instanceof Error) {
        // Extract important properties from the Error object
        response.error = {
          message: error.message,
          stack: error.stack, // You may not want to include the stack trace in production
          name: error.name,
        };
      } else if (typeof error === "object") {
        try {
          // Serialize the object if it's not an instance of Error
          response.error = JSON.stringify(error);
        } catch (err) {
          response.error = "Error: Could not serialize the error object.";
        }
      } else {
        // If the error is a primitive value (string, boolean, number, etc.)
        response.error = error;
      }
    }
  }

  // Send the response with the appropriate status code
  res.status(statusCode).json(response);
};

// Helper function to parse pagination parameters
const parsePaginationParams = (req) => {
  let { page = 1, limit = 10 } = req.query;

  // Parse page and limit as integers and ensure they are valid
  page = parseInt(page, 10);
  limit = parseInt(limit, 10);

  if (isNaN(page) || page < 1) {
    page = 1;
  }
  if (isNaN(limit) || limit < 1) {
    limit = 10;
  }

  // Cap the limit to a maximum of 50
  if (limit > 50) {
    limit = 50;
  }

  return { page, limit };
};

// Helper function to generate meta information
const generateMeta = (page, limit, total) => {
  return {
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalRecords: total,
    limit: limit,
  };
};

// Helper function to validate an array of MongoDB ObjectIds with detailed error messages
// Helper function to validate an array of MongoDB ObjectIds with detailed error messages
const validateObjectIdsArr = (res, ids, fieldNames) => {
  const invalidParams = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const fieldName = fieldNames[i];

    // Check if ObjectId is valid
    if (!mongoose.Types.ObjectId.isValid(id)) {
      invalidParams.push(fieldName); // Add the field name to invalid params
    }
  }

  // If invalid ObjectIds are found
  if (invalidParams.length > 0) {
    sendResponse({
      res,
      statusCode: 400,
      translationKey: "invalid_object_ids", // Translation key
      values: { fields: invalidParams.join(", ") }, // Pass invalid field names as values
    });
    return false;
  }

  return true; // All ObjectIds are valid
};

// Helper function to convert underscores to spaces
const convertUnderscoresToSpaces = (str) => String(str).replace(/_/g, " ");

// const validationOptions ={
//   queryParams:["name","plan"],
//   rawData:["title"],
//   formFields:["age"],
//   objectIdFields:["123"]
// }
// if (!validateParams(req, res, validationOptions)) {
//   return; // Invalid request data response already sent by validateParams
// }

// Generic validation function
// Generic validation function
const validateParams = (req, res, options = {}) => {
  const {
    queryParams = [],
    pathParams = [],
    formFields = [],
    rawData = [],
    objectIdFields = [],
    dateFields = {},
    timeFields = {},
    enumFields = {}, // Field for enum validations
    minLengthFields = {}, // Field for minimum length validations
  } = options;

  // Validate query parameters
  const missingParamsQuery = [];
  for (const param of queryParams) {
    if (req.query[param]) {
      req.query[camelCase(param)] = convertUnderscoresToSpaces(
        req.query[param]
      );
    } else {
      missingParamsQuery.push(param);
    }
  }

  if (missingParamsQuery.length > 0) {
    sendResponse({
      res,
      statusCode: 400,
      translationKey: "missing_query_parameters", // Use a general key from translations
      values: { fields: missingParamsQuery.join(", ") }, // Pass the actual missing field as a value
    });
    return false;
  }

  // Validate path parameters
  const missingParamsPath = [];
  for (const param of pathParams) {
    if (req.params[param]) {
      req.params[camelCase(param)] = convertUnderscoresToSpaces(
        req.params[param]
      );
    } else {
      missingParamsPath.push(param);
    }
  }

  if (missingParamsPath.length > 0) {
    sendResponse({
      res,
      statusCode: 400,
      translationKey: "missing_path_parameters", // Use a general key from translations
      values: { fields: missingParamsPath.join(", ") }, // Pass the actual missing field as a value
    });
    return false;
  }

  // Validate form fields
  const missingParamsForm = [];
  for (const param of formFields) {
    if (req.body[param]) {
      req.body[camelCase(param)] = convertUnderscoresToSpaces(req.body[param]);
    } else {
      missingParamsForm.push(param);
    }
  }

  if (missingParamsForm.length > 0) {
    sendResponse({
      res,
      statusCode: 400,
      translationKey: "missing_form_fields", // Use a general key from translations
      values: { fields: missingParamsForm.join(", ") }, // Pass the actual missing field as a value
    });
    return false;
  }

  // Validate raw data
  const missingParamsRaw = [];
  for (const param of rawData) {
    if (req.body.hasOwnProperty(param)) {
      console.log(`param: ${param}, value: ${req.body[param]}`);
      req.body[camelCase(param)] = convertUnderscoresToSpaces(req.body[param]);
    } else {
      missingParamsRaw.push(param);
    }
  }

  if (missingParamsRaw.length > 0) {
    sendResponse({
      res,
      statusCode: 400,
      translationKey: "missing_raw_fields", // Use a general key from translations
      values: { fields: missingParamsRaw.join(", ") }, // Pass the actual missing field as a value
    });
    return false;
  }

  // Validate MongoDB ObjectId fields from different sources
  const objectIdsToValidate = [];
  const fieldNames = [];

  for (const field of objectIdFields) {
    let value = req.body[field] || req.params[field] || req.query[field];
    if (value) {
      objectIdsToValidate.push(value);
      fieldNames.push(field);
    }
  }
  if (!validateObjectIdsArr(res, objectIdsToValidate, fieldNames)) {
    return false;
  }

  // Validate date fields
  for (const [field, format] of Object.entries(dateFields)) {
    const dateValue = req.body[field] || req.params[field] || req.query[field];
    if (dateValue) {
      const isValidDate = moment(dateValue, format, true).isValid();
      if (!isValidDate) {
        sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_date_format", // Use translation key
          values: { field, format }, // Replace placeholders with actual values
        });
        return false;
      }
    } else {
      sendResponse({
        res,
        statusCode: 400,
        translationKey: "missing_date_field", // Use translation key
        values: { field }, // Pass the missing field as a value
      });
      return false;
    }
  }
  //time fields validation
  for (const [field, format] of Object.entries(timeFields)) {
    const timeValue = req.body[field];
    if (timeValue) {
      const isValidTime = moment(timeValue, format, true).isValid();
      if (!isValidTime) {
        sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_time_format", // Use translation key
          values: { field, format }, // Replace placeholders with actual values
        });
        return false;
      }
    } else {
      sendResponse({
        res,
        statusCode: 400,
        translationKey: "missing_time_field", // Use translation key
        values: { field }, // Pass the missing field as a value
      });
      return false;
    }
  }

  // Validate enum fields
  for (const [field, allowedValues] of Object.entries(enumFields)) {
    const value = req.body[field] || req.params[field] || req.query[field];
    if (value && !allowedValues.includes(value)) {
      sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_enum_value", // Use translation key
        values: { field, allowedValues: allowedValues.join(", ") }, // Replace placeholders with actual values
      });
      return false;
    }
  }

  // Validate minimum length fields
  for (const [field, minLength] of Object.entries(minLengthFields)) {
    const value = req.body[field] || req.params[field] || req.query[field];
    if (value && value.length < minLength) {
      sendResponse({
        res,
        statusCode: 400,
        translationKey: "min_length_violation", // Use translation key
        values: { field, minLength }, // Replace placeholders with actual values
      });
      return false;
    }
  }

  return true;
};

// Example usage
const exampleMiddleware = (req, res, next) => {
  const validationOptions = {
    queryParams: ["some_query_param"],
    pathParams: ["some_path_param"],
    formFields: ["title", "description", "image"],
    objectIdFields: ["userId", "postId"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return; // Invalid request data response already sent by validateParams
  }

  next();
};

/**
 * Converts a date from a specified input format to a specified user timezone.
 * If the timezone is null or not provided, it formats the date without applying a timezone.
 * @param {string | Date} date - The date to convert.
 * @param {string} [timezone] - The user's timezone (e.g., "Asia/Karachi"). If null, no timezone conversion is applied.
 * @param {string} [outputFormat="YYYY-MM-DDTHH:mm:ss.SSSZ"] - Optional output date format. Defaults to MongoDB format.
 * @param {string | string[]} [inputFormat="YYYY-MM-DDTHH:mm:ss.SSSZ"] - Optional input date format(s). Defaults to UTC format.
 * @returns {string} The converted date in the user's timezone or formatted date if timezone is null.
 */
const convertUtcToTimezone = (
  date,
  timezone,
  outputFormat = "YYYY-MM-DDTHH:mm:ss.SSSZ",
  inputFormat = "YYYY-MM-DDTHH:mm:ss.SSSZ"
) => {
  const momentDate = moment(date, inputFormat, true); // Parse date with strict input format

  if (timezone) {
    // Apply timezone conversion if timezone is provided
    return momentDate.tz(timezone).format(outputFormat);
  } else {
    // Simply format the date without timezone conversion
    return momentDate.format(outputFormat);
  }
};

/**
 * Converts a date from a specified timezone to UTC.
 * If the timezone is null or not provided, it formats the date without applying a timezone.
 * @param {string | Date} date - The date to convert.
 * @param {string} [timezone] - The user's timezone (e.g., "Asia/Karachi"). If null, no timezone conversion is applied.
 * @param {string} [outputFormat="YYYY-MM-DDTHH:mm:ss.SSSZ"] - Optional output date format. Defaults to MongoDB format.
 * @param {string | string[]} [inputFormat="YYYY-MM-DDTHH:mm:ss.SSSZ"] - Optional input date format(s). Defaults to UTC format.
 * @returns {string} The converted date in UTC or formatted date if timezone is null.
 */
const convertTimezoneToUtc = (
  date,
  timezone,
  inputFormat = "YYYY-MM-DDTHH:mm:ss.SSSZ",
  outputFormat = "YYYY-MM-DDTHH:mm:ss.SSSZ"
) => {
  const momentDate = moment.tz(date, inputFormat, timezone);
  // Convert to UTC and return in the output format
  return momentDate.utc().format(outputFormat);
};

/**
 * Converts a date from a specified input format to a specified output format.
 * If the timezone is null or not provided, it formats the date without applying a timezone.
 * @param {string | Date} date - The date to convert.
 * @param {string} [outputFormat="YYYY-MM-DDTHH:mm:ss.SSSZ"] - Optional output date format. Defaults to MongoDB format.
 * @param {string | string[]} [inputFormat="YYYY-MM-DDTHH:mm:ss.SSSZ"] - Optional input date format(s). Defaults to UTC format.
 * @returns {string} The formatted date.
 */
const convertDateFormat = (
  date,
  outputFormat = "YYYY-MM-DDTHH:mm:ss.SSSZ",
  inputFormat = "YYYY-MM-DDTHH:mm:ss.SSSZ"
) => {
  // Parse date with strict input format
  const momentDate = moment(date, inputFormat, true);

  // Simply format the date without timezone conversion
  return momentDate.format(outputFormat);
};

module.exports = {
  sendResponse,
  parsePaginationParams,
  generateMeta,
  validateObjectIdsArr,
  validateParams,
  exampleMiddleware,
  convertUtcToTimezone,
  convertTimezoneToUtc,
  convertDateFormat,
};
