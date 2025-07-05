import express from 'express';
const router = express.Router();
import Notification from '../models/notificationModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';

// @desc    Get notifications for logged-in user or all for admin
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const query = req.user.isAdmin ? {} : { user: req.user._id };
    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// @desc    Mark notifications as read
// @route   PUT /api/notifications/mark-as-read
// @access  Private
router.put('/mark-as-read', protect, async (req, res) => {
    try {
      await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
      res.status(200).json({ message: 'Notifications marquées comme lues' });
    } catch (error) {
      res.status(500).json({ message: 'Erreur du serveur' });
    }
  });

export default router;