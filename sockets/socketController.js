const SocketConnectionSchema = require("./SocketConnectionSchema");

// Create or update a connection (either direct or group)
const createOrUpdateConnection = async ({
  subjectId,
  objectId,
  socketId,
  type = "direct",
}) => {
  let chatRoomId;

  if (type === "direct") {
    // Generate chatRoomId for direct (1-to-1) chat only
    chatRoomId = SocketConnectionSchema.generateChatRoomId(subjectId, objectId);
  } else if (type === "group") {
    // Use the groupId directly as the chatRoomId for group chats
    chatRoomId = objectId; // objectId represents groupId in the group chat scenario
  }

  const query = { subjectId, objectId, type };
  const update = { socketId, lastActive: Date.now(), chatRoomId };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  return await SocketConnectionSchema.findOneAndUpdate(query, update, options);
};

// Delete a connection by user ID and, optionally, by type and group
const deleteConnectionByUserId = async (
  subjectId,
  objectId = null,
  type = "direct"
) => {
  const query = { subjectId, type };
  if (objectId) query.objectId = objectId;

  return await SocketConnectionSchema.deleteMany(query);
};

// Retrieve connection by chatRoomId
const getConnectionByChatRoomId = async (objectId, chatRoomId) => {
  return await SocketConnectionSchema.findOne({
    subjectId: objectId, // Receiver ID is the subject in the connection
    chatRoomId,
  });
};

// Retrieve connections by group ID
const getConnectionsByGroupId = async (objectId) => {
  return await SocketConnectionSchema.find({
    objectId: objectId,
    type: "group",
  });
};

module.exports = {
  createOrUpdateConnection,
  deleteConnectionByUserId,
  getConnectionByChatRoomId,
  getConnectionsByGroupId,
};
