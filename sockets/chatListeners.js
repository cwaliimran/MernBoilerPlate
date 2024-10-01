const { getActiveSockets } = require("./activeSockets");
const Message = require("../models/Message"); // Assuming you have a Message model for DB operations

// This function attaches listeners to the socket after connection
const attachMessageListeners = (io, socket, userId) => {
    console.log("trying to attach message listeners");
    // Handle other events like message read, typing, etc.
    socket.on("messageRead", async ({ messageId, readerId }) => {
        // Update message read status here
        try {
            // Update the readBy field of the message
            const message = await Message.findById(messageId);
            if (!message.readBy.includes(readerId)) {
                message.readBy.push(readerId);
                await message.save();

                console.log(`Message ${messageId} read by user ${readerId}`);

                // Notify the sender about the read receipt
                const senderSocketId = getActiveSockets()[message.senderId];
                if (senderSocketId) {
                    io.to(senderSocketId).emit("messageRead", {
                        messageId,
                        readerId,
                        readBy: message.readBy,
                    });
                }
            }
        } catch (error) {
            console.error("Error updating read receipt:", error);
        }
    });

    socket.on("typing", ({ senderId, receiverId }) => {
        const receiverSocketId = getActiveSockets()[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("typing", { senderId, receiverId });
        }
    });

    socket.on("stopTyping", ({ senderId, receiverId }) => {
        const receiverSocketId = getActiveSockets()[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("stopTyping", { senderId, receiverId });
        }
    });

    // Handle client disconnection
    socket.on("disconnect", () => {
        console.log(`Client with userId ${userId} has disconnected.`);
        // Handle cleanup logic if needed
    });
};


module.exports = attachMessageListeners;
