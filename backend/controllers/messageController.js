const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');

// GET: visible messages for current user
exports.getMessagesByChatId = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const userId = req.user.id;

    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'name email')
      .populate('receiver', 'name email')
      .sort({ createdAt: 1 });

    const visible = messages.filter(msg => {
      if (msg.hiddenFor?.includes(userId)) return false;
      return Date.now() - new Date(msg.createdAt).getTime() < 24 * 60 * 60 * 1000;
    });

    res.json(visible);
  } catch (e) {
    console.error('Error getMessages:', e);
    res.status(500).json({ message: 'Failed to load messages' });
  }
};

// POST: send message
exports.sendMessage = async (req, res) => {
  try {
    const { chatId, content, receiver } = req.body;
    const senderId = req.user.id;

    if (!chatId || !content) {
      return res.status(400).json({ message: 'Chat ID and content required' });
    }

    let receiverId = receiver;

    // Auto-detect receiver if not provided
    if (!receiverId) {
      const chat = await Chat.findById(chatId).populate('users');
      if (!chat) return res.status(400).json({ message: 'Chat not found' });

      const otherUser = chat.users.find(u => u._id.toString() !== senderId);
      if (!otherUser) return res.status(400).json({ message: 'Receiver not found in chat' });

      receiverId = otherUser._id;
    }

    const recvUser = await User.findById(receiverId);
    if (!recvUser) return res.status(400).json({ message: 'Receiver user not found' });

    const msg = await Message.create({
      chat: chatId,
      sender: senderId,
      receiver: receiverId,
      content,
      deletionMode: '24h', // default
      receiverDeletionMode: '24h', // default
      readBy: [senderId],
    });

    const populated = await msg.populate(['sender', 'receiver', 'chat']);
    res.status(201).json(populated);
  } catch (e) {
    console.error('Error sendMessage:', e);
    res.status(500).json({ message: 'Failed to send message' });
  }
};

// DELETE: soft delete messages for this user
exports.softDeleteMessagesForUser = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const userId = req.user.id;
    await Message.updateMany(
      { chat: chatId, hiddenFor: { $ne: userId } },
      { $addToSet: { hiddenFor: userId } }
    );
    res.json({ message: 'Chats hidden for this user' });
  } catch (e) {
    console.error('Error softDelete:', e);
    res.status(500).json({ message: 'Failed to delete chats' });
  }
};
