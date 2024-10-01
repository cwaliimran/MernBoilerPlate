const attachMessageListeners = require("./chatListeners");
const { getActiveSockets, addActiveSocket, removeActiveSocket } = require("./activeSockets");

// Connection handler for new socket connections
const chatSocketHandler = (io) => {
  io.on("connection", (socket) => {
    console.log("New client connected", socket.id);

    const userId = socket.handshake.query.userId; // Assuming userId is passed as a query parameter

    if (userId) {
      addActiveSocket(userId, socket.id); // Map user to their socket ID
      console.log(`User ${userId} joined chat with socket ID ${socket.id}`);
      console.log("activeSockets user added", getActiveSockets());
    } else {
      console.error("User ID not provided in query parameters");
      return; // Exit early if userId is not provided
    }

    // Call separate function to handle message events
    attachMessageListeners(io, socket, userId);

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`Client with socket ID ${socket.id} disconnected`);
      if (userId) {
        removeActiveSocket(userId); // Remove socket from active sockets
        console.log(`Removed ${userId} from active sockets`);
      }
    });
  });
};

module.exports = chatSocketHandler;
