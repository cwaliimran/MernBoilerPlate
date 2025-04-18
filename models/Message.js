// models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      required: true,
      default: "direct",
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    objectId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      validate: {
        validator: function () {
          return (
            (this.type === "direct" && this.objectId instanceof mongoose.Types.ObjectId) ||
            (this.type === "group" && this.objectId instanceof mongoose.Types.ObjectId)
          );
        },
        message: "Invalid objectId for the selected message type",
      },
      refPath: "type", // Dynamic reference: "User" for direct, "Group" for group messages
    },
    messageType: {
      type: String,
      enum: ["text", "audio", "file"],
      required: true,
    },
    messageContent: {
      type: String,
      required: function () {
        return this.messageType === "text";
      },
    },
    mediaUrl: {
      type: String,
      required: function () {
        return this.messageType === "audio" || this.messageType === "file";
      },
      validate: {
        validator: function (value) {
          return this.messageType !== "text" || value === null;
        },
        message: "Media URL must be null for text messages.",
      },
    },
    status: {
      type: String,
      enum: ["sent", "delivered"],
      default: "sent",
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ], // Tracks which users have read the message
  },
  {
    timestamps: true,
  }
);

// Export the model
module.exports = mongoose.model("Message", messageSchema);
