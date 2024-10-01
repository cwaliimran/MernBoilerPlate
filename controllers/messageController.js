const Message = require("../models/Message");
const mongoose = require("mongoose");
const moment = require("moment");
const { User } = require("../models/userModel");
const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
  validateParams,
  convertUtcToTimezone,
} = require("../helperUtils/responseUtil");
const { formatUserResponse } = require("../helperUtils/userResponseUtil");

const {
  sendUserNotifications,
} = require("./communicationController");
const {Devices} = require("../models/Devices");
const { NotificationTypes } = require("../models/Notifications");
const { getActiveSockets } = require("../sockets/activeSockets");

// Fetch chats (first message from each conversation with users list)
const fetchChats = async (req, res) => {
  const { _id, timezone } = req.user;
  const { page, limit } = parsePaginationParams(req);

  try {
    const [currentUser, latestMessages] = await Promise.all([
      User.findById(_id).select("visibleTo"),
      Message.aggregate([
        {
          $match: {
            $or: [{ senderId: _id }, { receiverId: _id }],
          },
        },
        {
          $group: {
            _id: {
              $cond: {
                if: { $eq: ["$senderId", _id] },
                then: "$receiverId",
                else: "$senderId",
              },
            },
            lastMessage: { $last: "$$ROOT" },
            unreadCount: {
              $sum: {
                $cond: {
                  if: {
                    $and: [
                      { $eq: ["$receiverId", _id] },
                      { $not: { $in: [_id, "$readBy"] } },
                    ],
                  },
                  then: 1,
                  else: 0,
                },
              },
            },
          },
        },
        {
          $sort: { "lastMessage.createdAt": -1 },
        },
        {
          $skip: (page - 1) * limit,
        },
        {
          $limit: limit,
        },
      ]),
    ]);

    const visibleTo = currentUser.visibleTo;

    const userIds = latestMessages.map((message) =>
      message.lastMessage.senderId.equals(_id)
        ? message.lastMessage.receiverId
        : message.lastMessage.senderId
    );

    // Fetch users and total chats in parallel
    const [users, totalChats] = await Promise.all([
      User.find({ _id: { $in: userIds } })
        .select("name profileIcon")
        .lean(),
      Message.distinct("senderId", {
        $or: [{ senderId: _id }, { receiverId: _id }],
      }),
    ]);

    const responseData = latestMessages.map((message) => {
      // Determine the other user (not the current user)
      const otherUserId = message.lastMessage.senderId.equals(_id)
        ? message.lastMessage.receiverId
        : message.lastMessage.senderId;

      const otherUser = users.find((user) => user._id.equals(otherUserId));

      if (!otherUser) {
        return null; // Handle when otherUser is null
      }

      // Construct base URL for profile icon
      const baseUrl = `${process.env.S3_BASE_URL}/`;
      otherUser.profileIcon = otherUser.profileIcon
        ? baseUrl + otherUser.profileIcon
        : baseUrl + "noimage.png";

      // Convert UTC to local time
      const localDate = convertUtcToTimezone(
        message.lastMessage.createdAt,
        timezone
      );
      message.lastMessage.timesince = moment(localDate).fromNow();

      return {
        message: message.lastMessage,
        otherUser: formatUserResponse(
          otherUser,
          null,
          ["basicInfo"],
          ["basicInfo.email", "basicInfo.phoneNumber", "basicInfo.phoneNote"]
        ),
        unreadCount: message.unreadCount,
      };
    });

    // Remove null values from responseData
    const filteredResponseData = responseData.filter((data) => data !== null);

    // Calculate pagination meta
    const totalPages = Math.ceil(totalChats.length / limit);
    const meta = generateMeta(page, limit, totalChats.length, totalPages);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Chats fetched successfully",
      data: filteredResponseData,
      meta: meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "Error fetching chats" + error.message,
      error: error.message,
    });
  }
};


// Fetch messages (pagination)
const fetchMessages = async (req, res) => {
  const { _id, timezone } = req.user;
  const { otherUserId } = req.params; // Use the parameter from the route
  const { page, limit } = parsePaginationParams(req);

  const validationOptions = {
    objectIdFields: ["otherUserId"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    const query = {
      $or: [
        { senderId: _id, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: _id },
      ],
    };

    const [messages, totalMessages] = await Promise.all([
      Message.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Message.countDocuments(query),
    ]);

    // Mark messages as read by adding the current user's ID to the `readBy` array
    await Message.updateMany(
      {
        receiverId: _id, // Only mark messages that the current user has received
        senderId: otherUserId, // Only from the other user
        readBy: { $ne: _id }, // Only mark unread messages (where the current user's ID is not in `readBy`)
      },
      { $addToSet: { readBy: _id } } // Add current user's ID to `readBy` array
    );

    // Append formatted date and read status to each message
    const formattedMessages = messages.map((message) => {
      const localDate = convertUtcToTimezone(message.createdAt, timezone);
      const timesince = moment(localDate).fromNow(); // Format date

      return {
        ...message,
        timesince,
        isRead: message.readBy && message.readBy.includes(_id), // Check if the message is read by the current user
      };
    });

    const totalPages = Math.ceil(totalMessages / limit);
    const meta = generateMeta(page, limit, totalMessages, totalPages);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Messages fetched successfully",
      data: formattedMessages,
      meta: meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "Error fetching messages",
      error: error.message,
    });
  }
};
// Send a new message
const sendMessage = async (req, res) => {
  const { _id: senderId, timezone } = req.user; // sender is the current authenticated user
  const { otherUserId } = req.params; // receiverId is extracted from the route parameter
  const { messageType, messageContent = "", mediaUrl = null } = req.body;

  const validationOptions = {
    rawData: ["messageType"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    //get device id of the receiver

    var message = await Message.create({
      senderId,
      receiverId: otherUserId, // use otherUserId from params
      messageType,
      messageContent,
      mediaUrl,
    });
    const localDate = convertUtcToTimezone(message.createdAt, timezone);
    const timesince = moment(localDate).fromNow();

    const messageObject = message.toObject();
    messageObject.timesince = timesince;

  
    // Emit the message only after it is successfully saved
    const activeSockets = getActiveSockets(); // Get the latest active sockets
    const receiverSocketId = activeSockets[otherUserId]; // Get receiver's socket ID
    if (receiverSocketId) {
      console.log("Delivering message to receiver via socket", receiverSocketId);
      req.io.to(receiverSocketId).emit("receiveMessage", messageObject);
    } else {
      console.log("Receiver is not connected, no socket ID found");
    }


    // Emit `chatUpdated` to update the chats screen for both sender and receiver
    const senderSocketId = activeSockets[senderId];
    if (senderSocketId) {
      req.io.to(senderSocketId).emit("chatUpdated", {
        senderId,
        receiverId: otherUserId,
        messageContent: messageObject,
      });
    }
    if (receiverSocketId) {
      req.io.to(receiverSocketId).emit("chatUpdated", {
        senderId,
        receiverId: otherUserId,
        messageContent: messageObject,
      });
    }


    const recipientIds = [otherUserId];
    const title = "New Message";
    const body = `${req.user.name} sent you a message: ${messageContent}`;
    // Send notification in the background
    sendUserNotifications({
      recipientIds,
      title,
      body,
      data: { type: NotificationTypes.NEW_MESSAGE },
      sender: senderId,
      objectId: otherUserId,
    }).catch((notificationError) => {
      console.error("Error sending notification:", notificationError);
    });


    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "Message sent successfully",
      data: messageObject,
      translateMessage: false,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error: error,
    });
  }
};

// Delete a chat
const deleteChat = async (req, res) => {
  const { _id } = req.user;
  const { otherUserId } = req.params; // Use the parameter from the route

  const validationOptions = {
    objectIdFields: ["otherUserId"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    const query = {
      $or: [
        { senderId: _id, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: _id },
      ],
    };

    const deleted = await Message.deleteMany(query);
    if (deleted.deletedCount === 0) {
      return sendResponse({
        res,
        statusCode: 404,
translateMessage: false,
        translationKey: "No chat found to delete",
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Chat deleted successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error: error.message,
    });
  }
};
// Delete a message
const deleteMessage = async (req, res) => {
  const { messageId } = req.params; // Use the parameter from the route
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return sendResponse({
      res,
      statusCode: 404,
translateMessage: false,
      translationKey: "Invalid message ID",
    });
  }

  try {
    const message = await Message.findByIdAndDelete(messageId);
    if (!message) {
      return sendResponse({
        res,
        statusCode: 404,
translateMessage: false,
        translationKey: "No such message found",
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Message deleted successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error: error.message,
    });
  }
};

// Mark all messages in the conversation as read
const markAllMessagesAsRead = async (req, res) => {
  const { _id: userId } = req.user; // Current user
  const { otherUserId } = req.params; // The other user in the conversation

  // Validate the other user's ID
  if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "Invalid other user ID",
      translateMessage : false,
    });
  }

  try {
    // Update all messages where the current user is the receiver and the other user is the sender, marking them as read
    const result = await Message.updateMany(
      {
        $or: [
          { senderId: otherUserId, receiverId: userId }, // Messages sent to current user by otherUserId
          { senderId: userId, receiverId: otherUserId }, // Messages sent by current user to otherUserId
        ],
        readBy: { $ne: userId }, // Only mark messages that haven't been read by the current user yet
      },
      { $addToSet: { readBy: userId } } // Add current user ID to the `readBy` array
    );

    if (result.nModified === 0) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "No unread messages found to mark as read",
        translateMessage: false,
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "All messages marked as read successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "Error marking messages as read: " + error.message,
    });
  }
};

// Search chats with pagination
const searchChats = async (req, res) => {
  const { _id } = req.user;
  const { keyword } = req.query;
  const { page, limit } = parsePaginationParams(req);

  // Validate keyword
  if (!keyword || keyword.trim() === "") {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "Keyword is required for searching",
      translateMessage : false,
    });
  }

  try {
    // Step 1: Search for users by name with pagination
    const matchedUsers = await User.find({
      name: { $regex: keyword, $options: "i" }, // Case-insensitive partial match on name
    })
      .select("_id name profileIcon")
      .skip((page - 1) * limit) // Skip for pagination
      .limit(limit) // Limit for pagination
      .lean();

    if (!matchedUsers.length) {
      return sendResponse({
        res,
        statusCode: 404,
translateMessage: false,
        translationKey: "No users found for the given name",
        data: [],
      });
    }

    // Step 2: Extract matched user IDs
    const matchedUserIds = matchedUsers.map((user) => user._id);

    // Step 3: Find messages involving the current user and any matched users, but get the **last** message
    const matchedMessages = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: _id, receiverId: { $in: matchedUserIds } }, // Current user sent message
            { receiverId: _id, senderId: { $in: matchedUserIds } }, // Current user received message
          ],
        },
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$senderId", _id] },
              then: "$receiverId",
              else: "$senderId",
            },
          },
          lastMessage: { $last: "$$ROOT" }, // Get the last message instead of the first
          unreadCount: {
            $sum: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ["$receiverId", _id] }, // Unread messages should be received by the current user
                    { $not: { $in: [_id, "$readBy"] } }, // Message is unread by the current user
                  ],
                },
                then: 1,
                else: 0,
              },
            },
          },
        },
      },
      {
        $sort: { "lastMessage.createdAt": -1 }, // Sort by the latest message
      },
      {
        $skip: (page - 1) * limit, // Pagination
      },
      {
        $limit: limit, // Pagination limit
      },
    ]);

    // If no messages were found, return a 404
    if (!matchedMessages.length) {
      return sendResponse({
        res,
        statusCode: 404,
translateMessage: false,
        translationKey: "No chats found for the given name",
        data: [],
      });
    }

    // Step 4: Calculate the total number of matched users for pagination meta
    const totalMatchedUsers = await User.countDocuments({
      name: { $regex: keyword, $options: "i" },
    });

    // Step 5: Format the response with users and their chats
    const responseData = matchedMessages.map((message) => {
      const otherUser = matchedUsers.find((user) =>
        user._id.equals(
          message.lastMessage.senderId.equals(_id)
            ? message.lastMessage.receiverId
            : message.lastMessage.senderId
        )
      );

      if (!otherUser) return null;

      // Construct base URL for profile icon
      const baseUrl = `${process.env.S3_BASE_URL}/`;
      otherUser.profileIcon = otherUser.profileIcon
        ? baseUrl + otherUser.profileIcon.data.icon
        : baseUrl + "noimage.png";

      // Convert UTC to local time
      const localDate = convertUtcToTimezone(
        message.lastMessage.createdAt,
        req.user.timezone
      );
      message.lastMessage.timesince = moment(localDate).fromNow();

      return {
        message: message.lastMessage, // Use lastMessage instead of firstMessage
        otherUser: {
          _id: otherUser._id,
          name: otherUser.name,
          profileIcon: otherUser.profileIcon,
        },
        unreadCount: message.unreadCount,
      };
    });

    // Remove null values from responseData
    const filteredResponseData = responseData.filter((data) => data !== null);

    // Calculate pagination meta
    const totalPages = Math.ceil(totalMatchedUsers / limit);
    const meta = generateMeta(page, limit, totalMatchedUsers, totalPages);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Chats searched successfully",
      data: filteredResponseData,
      meta: meta,
    });
  } catch (error) {
    console.error("Error searching chats by name:", error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "Error searching chats by name",
      error: error.message,
    });
  }
};

module.exports = {
  fetchChats,
  fetchMessages,
  sendMessage,
  deleteChat,
  deleteMessage,
  markAllMessagesAsRead,
  searchChats,
};
