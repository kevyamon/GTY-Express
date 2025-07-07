import express from 'express';
import Notification from '../models/notificationModel.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @route   GET /api/notifications
// @desc    Récupérer les notifications pour l'utilisateur connecté
router.get('/', protect, async (req, res) => {
  try {
    // --- CORRECTION DE LA LOGIQUE ADMIN ---
    // Si l'utilisateur est admin, on récupère les notifications pour 'admin' ET pour son propre ID.
    const query = req.user.isAdmin
      ? { user: { $in: [req.user._id, 'admin'] } }
      : { user: req.user._id };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);
      
    res.json(notifications);
  } catch (error) {
    console.error('Erreur lors de la récupération des notifications:', error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// @route   PUT /api/notifications/mark-as-read
// @desc    Marquer les notifications comme lues
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

// @route   DELETE /api/notifications/:id
// @desc    Supprimer une notification spécifique
router.delete('/:id', protect, async (req, res) => {
    try {
      const notification = await Notification.findById(req.params.id);
  
      if (!notification) {
        return res.status(404).json({ message: 'Notification non trouvée' });
      }
  
      // L'admin peut supprimer ses propres notifs et les notifs 'admin'
      // Le client ne peut supprimer que les siennes
      const isAdminOwner = req.user.isAdmin && (notification.user.toString() === req.user._id.toString() || notification.user.toString() === 'admin');
      const isClientOwner = notification.user.toString() === req.user._id.toString();

      if (isAdminOwner || isClientOwner) {
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

// @route   DELETE /api/notifications
// @desc    Supprimer toutes les notifications de l'utilisateur
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

export default router;