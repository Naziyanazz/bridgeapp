// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const User = require('../models/User');
const authenticate = require('../middleware/authMiddleware'); 

// @route POST /api/chats/
// Create or fetch one-on-one chat
router.post('/', authenticate, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'UserId is required' });
    }

    const existingChat = await Chat.findOne({
      isGroupChat: false,
      users: { $all: [req.user._id, userId] },
    })
      .populate('users', '-password')
      .populate('latestMessage');

    if (existingChat) return res.status(200).json(existingChat);

    const newChat = await Chat.create({
      chatName: 'sender',
      isGroupChat: false,
      users: [req.user._id, userId],
    });

    const fullChat = await Chat.findById(newChat._id).populate('users', '-password');
    res.status(201).json(fullChat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/chats/
// Fetch all chats for the logged-in user
router.get('/', authenticate, async (req, res) => {
  try {
    const chats = await Chat.find({ users: { $in: [req.user._id] } })
      .populate('users', '-password')
      .populate('latestMessage')
      .sort({ updatedAt: -1 });

    res.status(200).json(chats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
