const path = require("path");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require("multer");
const { sendResponse } = require("../helperUtils/responseUtil");
const { v4: uuidv4 } = require("uuid");
const uploadsAWSMw = require("../middlewares/uploadFilesAWSMw");
require("dotenv").config();

// Initialize AWS S3 Client
const s3 = new S3Client({
  region: process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

// Helper function to generate the S3 upload parameters for each file
const createUploadParams = (file) => {
  const fileExtension = path.extname(file.originalname); // Get the file extension (e.g., .png)
  const filename = `${uuidv4()}${fileExtension}`; // Generate unique filename with uuid

  if (!file.buffer) {
    throw new Error("File buffer is missing");
  }

  return {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: filename,
    Body: file.buffer, // File buffer from multer
    ContentType: file.mimetype,
  };
};

// Function to upload multiple files to S3 in parallel with progress tracking
const uploadFilesToS3 = async (files) => {
  const uploadPromises = files.map((file) => {
    const params = createUploadParams(file);
    const parallelUploads3 = new Upload({
      client: s3,
      params: params,
    });

    // Register a progress listener
    parallelUploads3.on("httpUploadProgress", (progress) => {
      console.log(
        `Progress for ${params.Key}: ${Math.round(
          (progress.loaded / progress.total) * 100
        )}%`
      );
    });

    return parallelUploads3.done().then(() => ({
      file: params.Key,
      fileUrl: `${process.env.S3_BASE_URL}/${params.Key}`,
      fileExtension: path.extname(params.Key),
    }));
  });

  return Promise.all(uploadPromises);
};

// Function to handle file upload
const uploadFiles = (req, res) => {
  uploadsAWSMw(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_COUNT") {
        // Custom error message when file count exceeds the limit
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "You can upload a maximum of 10 files at a time.",
          error: "Too many files",
          translateMessage: false,
        });
      }
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "File upload failed " + err.message,
        error: err.message,
        translateMessage: false,
      });
    } else if (err) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "File upload failed " + err.message,
        error: err.message,
        translateMessage: false,
      });
    } else if (!req.files || req.files.length === 0) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "No files selected!",
        translateMessage : false,
      });
    }

    try {
      // Upload all files to S3 in parallel
      const uploadedFiles = await uploadFilesToS3(req.files);

      // If only one file is uploaded, return it as an object; otherwise, return an array
      const response =
        uploadedFiles.length === 1 ? uploadedFiles[0] : uploadedFiles;

      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "Files uploaded successfully",
        data: response,
      });
    } catch (error) {
      return sendResponse({
        res,
        statusCode: 500,
        translationKey: "S3 upload failed " + error.message,
        error: error.message,
        translateMessage: false,
      });
    }
  });
};

// Function to delete file from S3
const deleteFileFromS3 = async (fileKey) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileKey, // The file name (key) you want to delete
  };

  try {
    const data = await s3.send(new DeleteObjectCommand(params));
    return data; // This will contain info like request ID
  } catch (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

// Function to handle deleting multiple files in parallel
const deleteMultipleFilesFromS3 = async (fileKeys) => {
  const deletePromises = fileKeys.map((fileKey) => deleteFileFromS3(fileKey));
  try {
    await Promise.all(deletePromises);
  } catch (error) {
    throw new Error(`Failed to delete some files: ${error.message}`);
  }
};

/* Request body format:
For a single file: { "fileKey": "some-file.png" }
For multiple files: { "fileKey": ["file1.png", "file2.jpg", "file3.pdf"] } */
// API to handle delete request for single or multiple files
const deleteFiles = async (req, res) => {
  const { fileKey } = req.body; // Expecting the file key(s) to be sent in the request body

  if (!fileKey) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "File key is required to delete the file.",
      error: "File key is missing.",
      translateMessage : false,
    });
  }

  try {
    if (Array.isArray(fileKey)) {
      // If fileKey is an array, delete multiple files
      await deleteMultipleFilesFromS3(fileKey);
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "Files deleted successfully.",
        data: { fileKeys: fileKey },
      });
    } else {
      // If fileKey is a single string, delete one file
      await deleteFileFromS3(fileKey);
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "File deleted successfully.",
        data: { fileKey },
      });
    }
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "File deletion failed.",
      error: error.message,
    });
  }
};
module.exports = {
  uploadFiles,
  deleteFiles,
};
