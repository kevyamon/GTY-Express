import mongoose from 'mongoose';

const notificationSchema = mongoose.Schema(
  {
    // CORRECTION : On autorise le champ 'user' à être soit un ID, soit un simple texte.
    user: { type: mongoose.Schema.Types.Mixed, required: true },
    notificationId: { type: String, required: true, unique: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    link: { type: String },
  },
  { timestamps: true }
);

// On ajoute un index pour que la recherche de notifications soit plus rapide.
notificationSchema.index({ user: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;