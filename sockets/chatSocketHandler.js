const mongoose = require('mongoose');

const {
  createOrUpdateConnection,
  deleteConnectionByUserId,
  getConnectionByChatRoomId,
  getConnectionsByGroupId,
} = require("../sockets/socketController.js");

const chatSocketHandler = (io) => {
  io.on("connection", (socket) => {
    const { subjectId, objectId, type } = socket.handshake.query;

    const { Types } = mongoose;

    if (!subjectId || !objectId || !Types.ObjectId.isValid(subjectId) || !Types.ObjectId.isValid(objectId)) {
      const errorMessage = "subjectId and objectId must be provided in query parameters and must be valid ObjectId.";
      socket.emit("error", { message: errorMessage });
      return;
    }

    // Determine connection type
    const connectionType = type === "group" ? "group" : "direct";
    console.log(`Connection type determined: ${connectionType}`);

    // Create or update connection
    createOrUpdateConnection({
      subjectId,
      objectId,
      socketId: socket.id,
      type: connectionType,
    })
      .then((connection) => {
        console.log(
          `Socket connection created or updated for ${connectionType}:`,
          connection
        );
      })
      .catch((error) => {
        console.error(
          `Error creating/updating ${connectionType} socket connection:`,
          error
        );
      });

    // // Listeners for sending and receiving messages
    // if (connectionType === "direct") {
    //   // Direct message listener
    //   socket.on("sendDirectMessage", async (messageData) => {
    //     console.log(`Direct message received:`, messageData);
    //     const { messageContent, messageType, mediaUrl } = messageData;

    //     // Check if the receiver is connected
    //     const connection = await getConnectionByChatRoomId(objectId,
    //       `${[subjectId, objectId].sort().join("_")}`
    //     );

    //     console.log(connection);
    //     // Emit to the receiver if connected
    //     if (
    //       connection
    //     ) {
    //       console.log(
    //         `Emitting direct message to receiver with socketId: ${connection.socketId}`
    //       );
    //       io.to(connection.socketId).emit("receiveMessage", {
    //         subjectId,
    //         messageContent,
    //         messageType,
    //         mediaUrl,
    //       });
    //     } else {
    //       console.log(`Receiver not connected for direct message: ${objectId}`);
    //     }
    //   });
    // } else {
    //   // Group message listener
    //   socket.on("sendGroupMessage", async (messageData) => {
    //     console.log(`Group message received:`, messageData);
    //     const { messageContent, messageType, mediaUrl } =
    //       messageData;

    //     // Fetch all active connections in the group
    //     const groupConnections = await getConnectionsByGroupId(objectId);
    //     console.log("groupConnections", groupConnections);

    //     // Collect all socket IDs except the sender's
    //     const socketIds = groupConnections
    //       .filter((connection) => connection.subjectId.toString() !== subjectId)
    //       .map((connection) => connection.socketId);

    //     if (socketIds.length > 0) {
    //       console.log(`Emitting group message to members with socketIds: ${socketIds}`);
    //       io.to(socketIds).emit("receiveMessage", {
    //         objectId,
    //         subjectId,
    //         messageContent,
    //         messageType,
    //         mediaUrl,
    //       });
    //     }
    //   });
    // }

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log(`User ${subjectId} disconnected.`);
      await deleteConnectionByUserId(
        subjectId,
        connectionType === "group" ? objectId : null,
        connectionType
      );
      console.log(
        `User ${subjectId} removed from ${connectionType} active connections.`
      );
    });
  });
};

module.exports = chatSocketHandler;
