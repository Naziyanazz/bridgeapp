const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
latestMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },

  isGroupChat: { type: Boolean, default: false },
  chatName: { type: String },
 
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
