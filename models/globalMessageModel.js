import mongoose from 'mongoose';

const globalMessageSchema = new mongoose.Schema(
  {
    // L'admin qui a envoyé le message
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    // Le contenu du message
    message: {
      type: String,
      required: true,
    },
    // Le statut du message, 'active' est le seul message visible par les utilisateurs
    status: {
      type: String,
      required: true,
      enum: ['active', 'archived'],
      default: 'active',
    },
    // Un tableau qui stockera les IDs des utilisateurs qui ont fermé ce message
    dismissedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true, // Pour savoir quand le message a été créé
  }
);

const GlobalMessage = mongoose.model('GlobalMessage', globalMessageSchema);

export default GlobalMessage;