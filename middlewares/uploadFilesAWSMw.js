const multer = require("multer");
const path = require("path");

// Set storage engine to memory
const storage = multer.memoryStorage(); // Store files in memory as a buffer

// Initialize upload with file size limit and file type filter
const uploads3Mw = multer({
  storage: storage, // Use memoryStorage instead of diskStorage
  limits: { fileSize: 3000000 }, // Limit file size to 3MB
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
}).array("files", 10); // Adjust this based on whether you're uploading single or multiple files

// Check file type function
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png/; // Allowed file types
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Error: Images Only!")); // Reject any non-image files
  }
}

module.exports = uploads3Mw;
