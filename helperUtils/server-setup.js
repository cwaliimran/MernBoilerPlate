const mongoose = require("mongoose");
require('dotenv').config({ path: `.env.${process.env.NODE_ENV || 'dev'}` });

const startServer = (app) => {
  app.listen(process.env.PORT, () => {
    console.log("Server is running on port", process.env.PORT);
  });
};

const connectToDB = async (app) => {
  try {
    const uri = process.env.BASE_URL;
    if (!uri) {
      throw new Error("MongoDB URI not found in environment variables");
    }

    await mongoose.connect(uri);
    console.log("Connected to MongoDB");

    startServer(app);
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
};

module.exports = connectToDB;
