// models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
          // If messageType is text, mediaUrl must be null
          if (this.messageType === "text") {
            return value === null;
          }
          return true;
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
    ], // Track which users have read this message
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
