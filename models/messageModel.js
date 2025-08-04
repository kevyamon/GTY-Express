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
    // Le champ 'image' est renommé et on ajoute des champs pour les fichiers
    fileUrl: {
      type: String, 
    },
    fileName: {
      type: String,
    },
    fileType: {
      type: String,
    },
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

// On supprime l'ancien modèle 'Message' s'il existe pour éviter une erreur lors du redémarrage
delete mongoose.connection.models['Message'];

const Message = mongoose.model('Message', messageSchema);

export default Message;