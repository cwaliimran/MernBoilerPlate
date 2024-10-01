// activeSockets.js
const activeSockets = {};

// Function to get the active sockets object
const getActiveSockets = () => activeSockets;

// Function to add a socket entry only if it does not exist
const addActiveSocket = (userId, socketId) => {
    if (!activeSockets[userId]) {
        activeSockets[userId] = socketId;
    }
};

// Function to remove a socket entry when disconnected
const removeActiveSocket = (userId) => {
  delete activeSockets[userId];
};

module.exports = {
  getActiveSockets,
  addActiveSocket,
  removeActiveSocket,
};
