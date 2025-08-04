import mongoose from 'mongoose';

// NOUVEAU : Schéma pour un fichier unique
const fileSchema = mongoose.Schema({
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
});

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
    // On remplace les anciens champs par un tableau de fichiers
    files: [fileSchema],
    isRead: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    seenBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
  },
  {
    timestamps: true,
  }
);

delete mongoose.connection.models['Message'];
const Message = mongoose.model('Message', messageSchema);

export default Message;