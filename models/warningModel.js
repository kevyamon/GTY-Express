import mongoose from 'mongoose';

const warningSchema = new mongoose.Schema(
  {
    user: { // L'utilisateur qui reçoit l'avertissement
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    sender: { // L'admin qui envoie l'avertissement
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    message: { // Le contenu du message d'avertissement
      type: String,
      required: true,
    },
    actions: { // Les actions que l'admin a cochées
      contactSupport: { type: Boolean, default: false },
      verifyProfile: { type: Boolean, default: false },
    },
    status: { // Statut pour savoir si l'avertissement est actif ou a été résolu
      type: String,
      required: true,
      enum: ['active', 'dismissed'],
      default: 'active',
    },
  },
  {
    timestamps: true, // Pour savoir quand il a été créé (et trier les plus récents)
  }
);

const Warning = mongoose.model('Warning', warningSchema);

export default Warning;