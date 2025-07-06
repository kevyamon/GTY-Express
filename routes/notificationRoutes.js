import express from 'express';
const router = express.Router();
import Notification from '../models/notificationModel.js';
import { protect } from '../middleware/authMiddleware.js';

// ✅ Obtenir les notifications de l'utilisateur connecté
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// ✅ Marquer toutes les notifications comme lues
router.put('/mark-as-read', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true }
    );
    res.status(200).json({ message: 'Notifications marquées comme lues' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// ✅ Supprimer une notification par son notificationId (indépendamment)
router.delete('/:notificationId', protect, async (req, res) => {
  try {
    const notif = await Notification.findOne({
      notificationId: req.params.notificationId,
      user: req.user._id,
    });

    if (!notif) {
      return res.status(404).json({ message: 'Notification non trouvée' });
    }

    await notif.deleteOne();
    res.json({ message: 'Notification supprimée' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
});

export default router;