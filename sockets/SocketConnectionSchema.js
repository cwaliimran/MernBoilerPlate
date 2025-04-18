// models/SocketConnectionSchema.js
const mongoose = require("mongoose");

const SocketConnectionSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    objectId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "type", // Can reference either User or Group based on type
      required: true,
    },
    type: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
      required: true,
    },
    socketId: {
      type: String,
      required: true,
    },
    chatRoomId: {
      type: String,
      required: true,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Static method to generate a unique chatRoomId
SocketConnectionSchema.statics.generateChatRoomId = function (subjectId, objectId) {
  return [subjectId, objectId].sort().join("_");
};

// Static method to remove inactive connections
SocketConnectionSchema.statics.removeInactiveConnections = async function () {
  const timeMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  try {
    await this.deleteMany({ lastActive: { $lt: timeMinutesAgo } });
    console.log("Cleaned up inactive socket connections");
  } catch (error) {
    console.error("Error cleaning up inactive socket connections:", error);
  }
  await this.deleteMany({ lastActive: { $lt: timeMinutesAgo } });
};


// Schedule cleanup of inactive connections every 10 minutes
setInterval(async () => {
  try {
    await mongoose.model("SocketConnection").removeInactiveConnections();
  } catch (error) {
    console.error(
      "Error during scheduled cleanup of inactive socket connections:",
      error
    );
  }
}, 10 * 60 * 1000); // 10 minutes in milliseconds

module.exports = mongoose.model("SocketConnection", SocketConnectionSchema);
