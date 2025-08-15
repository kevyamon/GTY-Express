import mongoose from 'mongoose';

const suggestionSchema = mongoose.Schema(
  {
    // L'ID de l'utilisateur qui a fait la suggestion
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    // Le contenu du message
    text: {
      type: String,
      required: true,
    },
    // Un tableau qui stockera les IDs des admins qui ont archivé ce message
    archivedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true, // Pour savoir quand la suggestion a été créée/modifiée
  }
);

const Suggestion = mongoose.model('Suggestion', suggestionSchema);

export default Suggestion;