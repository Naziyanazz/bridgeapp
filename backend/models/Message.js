const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  deletionMode: {
    type: String,
    enum: ['24h'], // We are now only using 24h deletion
    default: '24h',
  },
  readBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }
  ],
   hiddenFrom: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: []
}]
}, {
  timestamps: true,
});

messageSchema.methods.markAsReadBy = async function (userId) {
  if (!this.readBy.includes(userId)) {
    this.readBy.push(userId);
    await this.save();
  }
};


module.exports = mongoose.model('Message', messageSchema);
