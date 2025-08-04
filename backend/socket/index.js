const http = require("http");
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/user");
const Message = require("../models/Message");
const Chat = require("../models/Chat");

const server = http.createServer(require("./server")); // Import your Express app from server.js
const io = socketIO(server, {
  cors: {
    origin: "*", // 🔒 In production, use actual frontend domain
    methods: ["GET", "POST"]
  }
});

const JWT_SECRET = "your_jwt_secret"; // Move to .env in production
app.use('/api/messages', messageRoutes);

// ✅ Authenticate user with JWT on socket connection
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return next(new Error("User not found"));

    socket.user = { id: user._id.toString(), name: user.name };
    next();
  } catch (err) {
    console.error("Socket auth failed:", err.message);
    next(new Error("Authentication error"));
  }
});

// ✅ Socket connection handlers
io.on("connection", (socket) => {
  const userId = socket.user._id.toString();
  console.log(`✅ User connected: ${userId}`);

  socket.on("joinChat", (chatId) => {
    socket.join(chatId);
    console.log(`📥 ${userId} joined chat ${chatId}`);
  });

  socket.on("sendMessage", async (messageData) => {
    try {
      const message = await Message.create(messageData);
      await Chat.findByIdAndUpdate(messageData.chat._id, {
        latestMessage: message._id
      });

      io.to(messageData.chat._id).emit("receiveMessage", message);
      console.log(`📨 Message sent in chat ${messageData.chat._id}`);
    } catch (err) {
      console.error("❌ Error sending message:", err);
    }
  });

  socket.on("message-read", async (messageId) => {
    try {
      await Message.findByIdAndUpdate(messageId, { isRead: true });
      io.emit("message-read-by", { messageId, userId });
      console.log(`📖 Read receipt updated for message: ${messageId}`);
    } catch (err) {
      console.error("❌ Error updating read receipt:", err);
    }
  });

  // ✅ Typing indicator logic
  socket.on("typing", ({ chatId, name }) => {
    console.log(`✏️ Received typing from ${name} for chat ${chatId}`);
    socket.to(chatId).emit("userTyping", { chatId, name });
  });

  socket.on("stopTyping", ({ chatId }) => {
    console.log(`🛑 Received stopTyping for chat ${chatId}`);
    if (chatId) {
      socket.to(chatId).emit("userStopTyping", { chatId });
    } else {
      console.warn("⚠️ Missing chatId in stopTyping");
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${userId}`);
  });
});

module.exports = server;
