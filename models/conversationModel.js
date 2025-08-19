import mongoose from 'mongoose';

const conversationSchema = mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    messages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: [],
      },
    ],
    lastMessage: {
      text: String,
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    // --- AJOUT POUR L'ARCHIVAGE ---
    // Un tableau qui stockera les IDs des admins qui ont archivé ce message
    archivedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // --- FIN DE L'AJOUT ---
  },
  {
    timestamps: true,
  }
);

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;