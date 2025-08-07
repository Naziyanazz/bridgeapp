// backend/routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const authenticate = require('../middleware/authMiddleware');

// 📁 Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${unique}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// ✅ Send text message
router.post('/', authenticate, async (req, res) => {
  try {
    const { chatId, content, receiver, replyToId } = req.body;
    if (!chatId || !content) {
      return res.status(400).json({ message: 'Chat ID and content required' });
    }
    let receiverId = receiver;
    // auto-detect receiver if missing (using Chat document)
    if (!receiverId) {
      const chat = await Chat.findById(chatId).populate('users');
      const other = chat.users.find(u => u._id.toString() !== req.user._id.toString());
      receiverId = other?._id;
    }

    const msg = await Message.create({
      chat: chatId,
      sender: req.user._id,
      receiver: receiverId,
      content,
      replyTo: replyToId || null,
      readBy: [req.user._id],
    });

    const populated = await msg.populate([
      { path: 'sender', select: 'name' },
      { path: 'receiver', select: 'name' },
      { path: 'chat' },
      {
        path: 'replyTo',
        populate: { path: 'sender', select: 'name' }
      }
    ]);
    res.status(201).json(populated);

  } catch (err) {
    console.error('❌ Error sendMessage:', err);
    res.status(500).json({ message: 'Message sending failed' });
  }
});

// ✅ Upload image message with reply support
router.post('/upload', authenticate, upload.single('image'), async (req, res) => {
  try {
    const { chatId, receiver, replyToId } = req.body;
    if (!chatId || !receiver || !req.file) {
      return res.status(400).json({ message: 'Missing chatId, receiver, or image file' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    const msg = await Message.create({
      chat: chatId,
      sender: req.user._id,
      receiver,
      image: imageUrl,
      content: imageUrl,
      readBy: [req.user._id],
      replyTo: replyToId || null,
    });

    const populated = await msg.populate([
      { path: 'sender', select: 'name' },
      { path: 'receiver', select: 'name' },
      { path: 'chat' },
      {
        path: 'replyTo',
        populate: { path: 'sender', select: 'name' }
      }
    ]);

    res.status(201).json(populated);
  } catch (err) {
    console.error('❌ Error upload:', err);
    res.status(500).json({ message: 'Image upload failed' });
  }
});


router.delete('/soft-delete/:chatId', authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    await Message.updateMany(
      { chat: chatId },
      { $addToSet: { hiddenFrom: userId } }
    );

    res.status(200).json({ message: 'Messages hidden successfully' });
  } catch (err) {
    console.error('❌ Error in soft delete route:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.get('/:chatId', authenticate, async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const messages = await Message.find({
      chat: chatId,
      createdAt: { $gte: twentyFourHoursAgo },  // only messages within last 24 hours
      hiddenFrom: { $ne: userId }               // exclude hidden messages
    })
      .populate('sender', 'name')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'name' }
      });

    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
