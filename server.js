require("dotenv").config({ path: `.env.${process.env.NODE_ENV || "dev"}` });
const http = require("http");
const socketIo = require("socket.io");

const morgan = require("morgan");
const fs = require("fs");
const path = require("path");
const express = require("express");
const connectToDB = require("./helperUtils/server-setup");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const uploads3Routes = require("./routes/uploadAWSRoutes.js");
const { sendResponse } = require("./helperUtils/responseUtil");
const bulkInsertRoutes = require("./routes/dbRoutes");
const adminSettingsRoutes = require("./routes/adminSettingsRoutes.js");
const messageRoutes = require("./routes/messageRoutes");
const communicationRoutes = require("./routes/communicationRoutes");
const notificationsRoutes = require("./routes/notificationsRoutes");
const supportRoutes = require("./routes/supportRoutes");
const contactUsRoutes = require("./routes/contactUsRoutes");
const documentsRoutes = require("./routes/documentsRoutes");
const { i18nConfig } = require("./config/i18nConfig");
const chatSocketHandler = require("./sockets/chatSocketHandler.js");

const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Express app
const app = express();

// i18n middleware initialization for language localization
app.use(i18nConfig.init); // Use i18n middleware for localization

// Create a write stream for logging
const accessLogStream = fs.createWriteStream(
  path.join(logsDir, `access-${new Date().toISOString().slice(0, 10)}.log`),
  { flags: "a" }
);

// Morgan middleware for request logging to file
app.use(morgan("combined", { stream: accessLogStream }));

// Morgan middleware for request logging to console
app.use(morgan("dev"));

// Middleware to parse JSON bodies
app.use(express.json());

// Connect to MongoDB and start server
const server = http.createServer(app);

connectToDB(app);

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: "*", // Adjust according to your frontend
    methods: ["GET", "POST"],
  },
});

// Start the server and listen on the specified port
server.listen(process.env.PORT_SOCKET || 4002, () => {
  // Initialize Socket.IO chat handler once the server is listening
  chatSocketHandler(io);
});
// Middleware to attach io to req
app.use((req, res, next) => {
  req.io = io; // Attach the socket instance to every request
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/upload/s3", uploads3Routes);
app.use("/api/settings", adminSettingsRoutes);
app.use("/api/conversation", messageRoutes);
app.use("/api/communications", communicationRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/contact-us", contactUsRoutes);
app.use("/api/documents", documentsRoutes);

//db utils routes
app.use("/api/util", bulkInsertRoutes);

// Global error handler
app.use((req, res, next) => {
  sendResponse({
    res,
    statusCode: 404,
    translateMessage: false,
    translationKey: "Route not found",
  });
});


// Export your app for testing or other modules
module.exports = app;
