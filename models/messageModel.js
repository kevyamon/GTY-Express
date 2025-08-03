import mongoose from 'mongoose';

const messageSchema = mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    text: {
      type: String,
    },
    image: {
      type: String, 
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isEdited: { // CHAMP AJOUTÉ
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model('Message', messageSchema);

export default Message;