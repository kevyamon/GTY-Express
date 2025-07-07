import express from 'express';
import Notification from '../models/notificationModel.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Récupérer les notifications
router.get('/', protect, async (req, res) => {
  try {
    // Cette logique est maintenant sûre grâce à la correction du modèle
    const query = req.user.isAdmin
      ? { user: { $in: [req.user._id, 'admin'] } }
      : { user: req.user._id };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);
      
    res.json(notifications);
  } catch (error) {
    console.error('Erreur du serveur lors de la récupération des notifications:', error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// Marquer comme lues
router.put('/mark-as-read', protect, async (req, res) => {
  try {
    const query = req.user.isAdmin
      ? { user: { $in: [req.user._id, 'admin'] } }
      : { user: req.user._id };
      
    await Notification.updateMany({ ...query, isRead: false }, { $set: { isRead: true } });
    res.json({ message: 'Notifications marquées comme lues' });
  } catch (error) {
    console.error('Erreur lors de la mise à jour des notifications:', error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// Supprimer toutes les notifications
router.delete('/', protect, async (req, res) => {
    try {
        const query = req.user.isAdmin
        ? { user: { $in: [req.user._id, 'admin'] } }
        : { user: req.user._id };

      await Notification.deleteMany(query);
      res.json({ message: 'Toutes les notifications ont été supprimées' });
    } catch (error) {
        console.error('Erreur lors de la suppression de toutes les notifications:', error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// Supprimer une notification spécifique
router.delete('/:id', protect, async (req, res) => {
    try {
      const notification = await Notification.findById(req.params.id);
  
      if (!notification) {
        return res.status(404).json({ message: 'Notification non trouvée' });
      }
  
      const isClientOwner = notification.user.toString() === req.user._id.toString();
      const isAdminDeletingAdminNotif = req.user.isAdmin && notification.user === 'admin';

      if (isClientOwner || isAdminDeletingAdminNotif) {
        await notification.deleteOne();
        res.json({ message: 'Notification supprimée' });
      } else {
        res.status(401).json({ message: 'Action non autorisée' });
      }
    } catch (error) {
      console.error('Erreur lors de la suppression de la notification:', error);
      res.status(500).json({ message: 'Erreur du serveur' });
    }
  });

export default router;