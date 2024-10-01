const { sendResponse, generateMeta, parsePaginationParams } = require('../helperUtils/responseUtil'); 
const moment = require('moment-timezone');
const { NotificationExp } = require('../models/Notifications');

// Get all notifications with pagination
const getNotifications = async (req, res) => {
    const { page, limit } = parsePaginationParams(req);

    try {
        const notifications = await NotificationExp.find({ objectId: req.user._id })
            .skip((page - 1) * limit)
            .limit(limit);

        const totalNotifications = await NotificationExp.countDocuments({ objectId: req.user._id });

        // Calculate pagination meta
        const meta = generateMeta(page, limit, totalNotifications);

        const formattedNotifications = notifications.map(notification => {
            const { _id, type, subjectId, objectId, title, body, data, url, isRead, createdAt } = notification;
            const userTimezone = req.user.timezone || 'UTC'; 
            const timeSince = moment(createdAt).tz(userTimezone).fromNow();

            return {
                _id,
                type,
                subjectId,
                objectId,
                title,
                body,
                data,
                isRead,
                timeSince
            };
        });

        return sendResponse({
            res,
            statusCode: 200,
            translationKey: 'Notifications fetched successfully',
            data: formattedNotifications,
            meta: meta,
        });
    } catch (error) {
        console.error(error);
        return sendResponse({
            res,
            statusCode: 500,
            translationKey: 'Error fetching notifications',
            error
        });
    }
};

// Mark a notification as read by ID
const readNotification = async (req, res) => {
  try {
    const notification = await NotificationExp.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      return sendResponse({
        res,
        statusCode: 404,
        translateMessage: false,
        translationKey: 'Notification not found'
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: 'Notification marked as read successfully',
      data: notification
    });
  } catch (error) {
    console.error(error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: 'Error marking notification as read',
      error
    });
  }
};

module.exports = {
  getNotifications,
  readNotification
};