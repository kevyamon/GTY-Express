import express from 'express';
import Notification from '../models/notificationModel.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Récupérer les notifications
router.get('/', protect, async (req, res) => {
  try {
    const query = req.user.isAdmin ? { user: { $in: [req.user._id, 'admin'] } } : { user: req.user._id };
    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// Marquer comme lues
router.put('/mark-as-read', protect, async (req, res) => {
  try {
    const query = req.user.isAdmin ? { user: { $in: [req.user._id, 'admin'] } } : { user: req.user._id };
    await Notification.updateMany({ ...query, isRead: false }, { isRead: true });
    res.json({ message: 'Notifications marquées comme lues' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// NOUVELLE ROUTE POUR TOUT SUPPRIMER
router.delete('/', protect, async (req, res) => {
    try {
      const query = req.user.isAdmin ? { user: { $in: [req.user._id, 'admin'] } } : { user: req.user._id };
      await Notification.deleteMany(query);
      res.json({ message: 'Toutes les notifications ont été supprimées' });
    } catch (error) {
      res.status(500).json({ message: 'Erreur du serveur' });
    }
  });

// Supprimer une notification
router.delete('/:notificationId', protect, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);
    if (!notification) {
      return res.status(404).json({ message: 'Notification non trouvée' });
    }
    // Vérifier que l'utilisateur est propriétaire ou admin
    if (notification.user.toString() === req.user._id.toString() || req.user.isAdmin) {
      await notification.deleteOne();
      res.json({ message: 'Notification supprimée' });
    } else {
      res.status(401).json({ message: 'Non autorisé' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;