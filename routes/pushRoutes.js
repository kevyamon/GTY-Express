import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect } from '../middleware/authMiddleware.js';
import User from '../models/userModel.js';

const router = express.Router();

// @desc    Envoyer la clé publique VAPID au client
// @route   GET /api/push/vapid-public-key
// @access  Public
router.get('/vapid-public-key', (req, res) => {
  res.send(process.env.VAPID_PUBLIC_KEY);
});

// @desc    Abonner un utilisateur aux notifications push
// @route   POST /api/push/subscribe
// @access  Private
router.post('/subscribe', protect, asyncHandler(async (req, res) => {
    const subscription = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error('Utilisateur non trouvé');
    }

    // Vérifier si l'abonnement existe déjà pour éviter les doublons
    const exists = user.pushSubscriptions.some(sub => sub.endpoint === subscription.endpoint);

    if (!exists) {
        user.pushSubscriptions.push(subscription);
        await user.save();
    }
  
    res.status(201).json({ message: 'Abonnement enregistré' });
}));

export default router;