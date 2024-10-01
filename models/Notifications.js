const mongoose = require('mongoose');

// Define the NotificationTypes enum
const NotificationTypes = {
    FRIEND_REQUEST: 'friendRequest',
    NEW_MESSAGE: 'newMessage',
    NEW_FOLLOWER: 'newFollower',
    NEW_LIKE: 'newLike',
    COMMENT: 'comment',
    MENTION: 'mention',
    SYSTEM: 'system',
    REMINDER: 'reminder',
};

// Define the NotificationSchema
const NotificationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: Object.values(NotificationTypes), // Reference the notification types enum
        required: true,
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the sender (optional)
        default: null,
    },
    objectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User schema for recipient
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    body: {
        type: String,
        required: true,
    },
    data: {
        type: Map, // Flexible field to store different payloads
        of: mongoose.Schema.Types.Mixed,
        default: {},
    },
    url: {
        type: String, // Optional field to link the user to relevant content
        default: null,
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

// Automatically update `updatedAt` field on modification
NotificationSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Export both Notification model and NotificationTypes enum
const NotificationExp = mongoose.model('Notification', NotificationSchema);
module.exports = {
  NotificationExp
};
module.exports.NotificationTypes = NotificationTypes;
