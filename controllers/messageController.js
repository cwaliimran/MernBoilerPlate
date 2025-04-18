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

const { sendUserNotifications } = require("./communicationController");
const { NotificationTypes } = require("../models/Notifications");

const Group = require("../sockets/Group");
const SocketConnectionSchema = require("../sockets/SocketConnectionSchema");

// Fetch chats (first message from each conversation with users list)
const fetchChats = async (req, res) => {
  const { _id, timezone } = req.user;
  const { page, limit } = parsePaginationParams(req);
  const { keyword } = req.query; // Get keyword from query

  try {
    const [latestMessages] = await Promise.all([
      Message.aggregate([
        {
          $match: {
            $or: [{ subjectId: _id }, { objectId: _id }],
          },
        },
        {
          $group: {
            _id: {
              $cond: {
                if: { $eq: ["$subjectId", _id] },
                then: "$objectId",
                else: "$subjectId",
              },
            },
            lastMessage: { $last: "$$ROOT" },
            unreadCount: {
              $sum: {
                $cond: {
                  if: {
                    $and: [
                      { $eq: ["$objectId", _id] },
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

    const userIds = latestMessages.map((message) =>
      message.lastMessage.subjectId.equals(_id)
        ? message.lastMessage.objectId
        : message.lastMessage.subjectId
    );

    // Build user query, conditionally adding keyword filtering
    const userQuery = {
      _id: { $in: userIds },
      "accountState.userType": "user",
    };
    if (keyword && keyword.trim() !== "") {
      userQuery.$or = [
        { name: { $regex: keyword, $options: "i" } }, // Case-insensitive match on name
      ];
    }

    // Fetch users and total chats in parallel
    const [currentUser, users, totalChats] = await Promise.all([
      User.findById(_id).select("blockedUsers").lean(),
      User.find(userQuery)
        .select(
          "name profileIcon"
        )
        .lean(),
      Message.distinct("subjectId", {
        $or: [{ subjectId: _id }, { objectId: _id }],
      }),
    ]);

    const responseData = latestMessages.map((message) => {
      // Determine the other user (not the current user)
      const otherUserId = message.lastMessage.subjectId.equals(_id)
        ? message.lastMessage.objectId
        : message.lastMessage.subjectId;

      const otherUser = users.find((user) => user._id.equals(otherUserId));

      if (!otherUser) {
        return null; // Handle when otherUser is null
      }
      console.log("otherUser", otherUser);

      const baseUrl = `${process.env.S3_BASE_URL}/`;
      // Validate profile icon
      var pIcon = null;
      if (
        otherUser.profileIcon
      ) {
        pIcon = otherUser.profileIcon;
      }
     
      otherUser.profileIcon = pIcon
        ? baseUrl + pIcon
        : baseUrl + "noimage.png";

      // Convert UTC to local time
      const localDate = convertUtcToTimezone(
        message.lastMessage.createdAt,
        timezone
      );
      message.lastMessage.timesince = moment(localDate).fromNow();

      // Determine whether to show real name or anonymous name based on visibility
      otherUser.isAnonymous = !(
        otherUser.visibleTo && otherUser.visibleTo.some((id) => id.equals(_id))
      );
      if(otherUser.blockedUsers==null){
        otherUser.blockedUsers = [];
      }
      if(otherUser.reportedBy==null){
        otherUser.reportedBy = [];
      }

      // Determine if the other user has blocked the current user
      const isBlocked = otherUser.blockedUsers.some((id) => id.equals(_id));
      const hasBlocked = currentUser.blockedUsers.some((id) =>
        id.equals(otherUser._id)
      );
      // Determine report status
      const hasReported = otherUser.reportedBy.some((id) => id.equals(_id));

      //loop through fromatted messages to remove readBy field
      delete message.lastMessage.readBy;
      delete message.lastMessage.type;
      delete message.lastMessage.status;

      return {
        message: message.lastMessage,
        otherUser: formatUserResponse(
          otherUser,
          null,
          ["basicInfo", "anonymousName"],
          ["basicInfo.email", "basicInfo.phoneNumber", "basicInfo.phoneNote"]
        ),
        unreadCount: message.unreadCount,
        userFlags: {
          isBlocked, // Check if the other user has blocked the current user
          hasBlocked, // Check if the current user has blocked the other user
          hasReported, // Check if the current user has reported the other user
        },
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
      translationKey: "Error fetching chats",
      error: error.message,
    });
  }
};

// Fetch messages (pagination)
const fetchMessages = async (req, res) => {
  const { _id, timezone } = req.user;
  let otherUserId;
  let supportPerson = null;

  // If it's an admin message, assign the admin ID
 
    // If it's a normal message, extract `otherUserId` from the route params
    otherUserId = req.params.otherUserId;

    const validationOptions = {
      pathParams: ["otherUserId"],
      objectIdFields: ["otherUserId"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }

  const { page, limit } = parsePaginationParams(req);


  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    const query = {
      $or: [
        { subjectId: _id, objectId: otherUserId },
        { subjectId: otherUserId, objectId: _id },
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
        objectId: _id, // Only mark messages that the current user has received
        subjectId: otherUserId, // Only from the other user
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
        isRead: message.readBy && message.readBy.some((id) => id.equals(_id)), // Check if the message is read by the current user
      };
    });

    const meta = generateMeta(page, limit, totalMessages);

    //loop through fromatted messages to remove readBy field
    formattedMessages.forEach((message) => {
      delete message.readBy;
      delete message.type;
      delete message.status;
    });

    // If support person details are available, append them to the response
    const responseData = supportPerson
      ? { supportPerson, messages: formattedMessages }
      : formattedMessages;

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Messages fetched successfully",
      data: responseData,
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

// Send a new direct (1-to-1) message
const sendDirectMessage = async (req, res) => {
  const { _id: subjectId, timezone } = req.user;
  const {
    messageType,
    messageContent = "",
    mediaUrl = null,
    conversationType = "direct",
  } = req.body;
  if (conversationType === "group") {
    sendGroupMessage(req, res);
    return;
  }
  let objectId;
  let chatRoomId;

  try {
    
      objectId = req.params.otherUserId;
      if (!objectId || !mongoose.Types.ObjectId.isValid(objectId))
        throw new Error("Invalid receiver ID");

      chatRoomId = SocketConnectionSchema.generateChatRoomId(
        subjectId,
        objectId
      );

    const message = await Message.create({
      subjectId,
      objectId: objectId,
      messageType,
      messageContent,
      mediaUrl,
      type: "direct",
      readBy: [subjectId],
    });

    const localDate = moment(message.createdAt).tz(timezone).format();
    const messageObject = {
      ...message.toObject(),
      timesince: moment(localDate).fromNow(),
    };

    // Background task for emitting messages
    const handleBackgroundTask = async () => {
      try {
        const connection = await SocketConnectionSchema.findOne({
          subjectId: objectId, // Receiver ID is the subject in the connection
          chatRoomId,
          type: "direct",
        });

        console.log("connection", connection)
        if (connection) {
          // Ensure the receiver (not sender) is connected
          await Message.updateOne(
            { _id: message._id },
            { $addToSet: { readBy: objectId } }
          );

          console.log("messageObject", messageObject)
          req.io.to(connection.socketId).emit("receiveMessage", messageObject);
          req.io.to(connection.socketId).emit("chatUpdated", {
            subjectId,
            objectId,
            messageContent: messageObject,
          });

          await SocketConnectionSchema.updateOne(
            { chatRoomId, type: "direct" },
            { lastActive: Date.now() }
          );
        }

        // Send user notifications
        await sendUserNotifications({
          recipientIds: [objectId],
          title: "New Message",
          body: `You received a new message: ${messageContent}`,
          data: { type: NotificationTypes.NEW_MESSAGE, objectType: "user" },
          sender: subjectId,
          objectId: objectId,
        });
      } catch (error) {
        console.error("Error in background task:", error);
      }
    };

    // Execute background task
    handleBackgroundTask();

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "Message sent successfully",
      data: messageObject,
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

// Send a new group message
const sendGroupMessage = async (req, res) => {
  const { _id: subjectId, timezone } = req.user;
  const objectId = req.params.otherUserId;
  const { messageType, messageContent = "", mediaUrl = null } = req.body;

  try {
    const validationOptions = {
      objectIdFields: ["otherUserId"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    const message = await Message.create({
      objectId,
      subjectId,
      messageType,
      messageContent,
      mediaUrl,
      type: "group",
      readBy: [subjectId],
    });

    const localDate = moment(message.createdAt).tz(timezone).format();
    const messageObject = {
      ...message.toObject(),
      timesince: moment(localDate).fromNow(),
    };
    
    // Background task for emitting group messages
    const handleGroupMessageTask = async () => {
      try {
        const [groupConnections, group] = await Promise.all([
          SocketConnectionSchema.find({
            objectId: objectId,
            type: "group",
          }),
          Group.findById(objectId).select("participants"),
        ]);
    
        if (!group) {
          console.error("Group not found for objectId:", objectId);
          return;
        }
    
        // Get IDs of active members, excluding the sender
        const activeMemberIds = groupConnections
          .filter((conn) => conn.subjectId.toString() !== subjectId.toString())
          .map((conn) => conn.subjectId);
    
        // Update `readBy` for all active members except the sender
        await Message.updateOne(
          { _id: message._id },
          { $addToSet: { readBy: { $each: activeMemberIds } } }
        );
    
        // Emit the message to all active members except the sender
        const socketIds = groupConnections
          .filter((conn) => conn.subjectId.toString() !== subjectId.toString())
          .map((conn) => conn.socketId);
    
        if (socketIds.length > 0) {
          req.io.to(socketIds).emit("receiveMessage", {
            objectId,
            subjectId,
            messageContent: messageObject,
          });
        }
    
        // Notify all participants except the sender
        const recipientIds = group.participants.filter(
          (participant) => !participant.equals(subjectId)
        );
    
        if (recipientIds.length > 0) {
          await sendUserNotifications({
            recipientIds,
            title: "New Group Message",
            body: `Received a new group message: ${messageContent}`,
            data: { type: NotificationTypes.NEW_MESSAGE, objectType: "group" },
            sender: subjectId,
            objectId,
          });
        }
      } catch (error) {
        console.error("Error in handleGroupMessageTask:", error);
      }
    };
    
    // Execute background task
    handleGroupMessageTask();
    
    // Return response immediately
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "Message sent successfully",
      data: messageObject,
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
        { subjectId: _id, objectId: otherUserId },
        { subjectId: otherUserId, objectId: _id },
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

  const validationOptions = {
    objectIdFields: ["messageId"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
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

  const validationOptions = {
    objectIdFields: ["otherUserId"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    // Update all messages where the current user is the receiver and the other user is the sender, marking them as read
    const result = await Message.updateMany(
      {
        $or: [
          { subjectId: otherUserId, objectId: userId }, // Messages sent to current user by otherUserId
          { subjectId: userId, objectId: otherUserId }, // Messages sent by current user to otherUserId
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


module.exports = {
  fetchChats,
  fetchMessages,
  sendDirectMessage,
  deleteChat,
  deleteMessage,
  markAllMessagesAsRead,
};
