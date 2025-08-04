const express = require('express');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const cors = require('cors');
const Message = require('./models/Message');
const path = require('path');

dotenv.config();
connectDB();
const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const userRoutes = require('./routes/userRoutes');
const authenticate = require('./middleware/authMiddleware');

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/chats', authenticate, chatRoutes);
app.use('/api/messages', authenticate, messageRoutes);

app.get('/api/protected', authenticate, (req, res) => res.json({ message: `Authorized as user ${req.user.id}` }));
app.get('/', (_, res) => res.send('✅ API running'));

app.get('/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  res.download(filePath, err => {
    if (err) {
      console.error("Download error:", err);
      res.status(404).send("File not found");
    }
  });
});
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: 'Internal server error' });
});


const server = app.listen(process.env.PORT || 5000, () => console.log('🚀 Server started'));

const io = require('socket.io')(server, {
  cors: { origin: 'http://localhost:5173', methods: ['GET','POST'], credentials: true },
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Auth error: no token'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await require('./models/User').findById(decoded.id);
    if (!user) return next(new Error('User not found'));

    socket.user = { id: user._id.toString(), name: user.name }; // ✅ Attach full info
    next();
  } catch {
    next(new Error('Auth error: invalid token'));
  }
});


io.on('connection', socket => {
  console.log('🚀 Connected', socket.user.id);

  socket.on('joinChat', chatId => socket.join(chatId));

  socket.on('sendMessage', msg => {
    const room = msg.chat?._id || msg.chatId;
    if (!room) return;
    socket.to(room).emit('receiveMessage', msg);
  });

  

  socket.on("message-read", async (messageId) => {
  const userId = socket.user.id;

  const message = await Message.findById(messageId);
  if (!message) return;

  if (!message.readBy.includes(userId)) {
    message.readBy.push(userId);
    await message.save();

    // Emit to all users in chat except reader
    io.to(message.chat.toString()).emit("message-read-by", {
      messageId,
      userId
    });
  }
});

  // ✅ Handle typing
socket.on("typing", ({ chatId, name }) => {
  console.log("📡 Server received typing event:", { chatId, name });
  socket.to(chatId).emit("userTyping", { chatId, name });  // ✅ FIXED
});

socket.on("stopTyping", ({ chatId }) => {
  socket.to(chatId).emit("userStopTyping", { chatId });  // ✅ FIXED
});


  socket.on("disconnect", () => {
    console.log("🔌 User disconnected");
  });



  socket.on('scheduleDeletionIf24h', message => {
    if (message.deletionMode === '24h') {
      setTimeout(async () => {
        try {
          const m = await Message.findById(message._id);
          if (m && m.deletionMode === '24h') {
            await Message.findByIdAndDelete(message._id);
            io.to(m.chat.toString()).emit('message-deleted', message._id);
          }
        } catch (e) { console.error('Error in scheduleDelete:', e); }
      }, 24*60*60*1000);
    }
  });
});

