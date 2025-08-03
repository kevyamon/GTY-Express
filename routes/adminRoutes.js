import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import User from '../models/userModel.js';
import Complaint from '../models/complaintModel.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Fonction pour générer un token qui inclut le statut de l'utilisateur
const generateTokenWithStatus = (id, status) => {
    return jwt.sign({ id, status }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });
};

// @desc    Récupérer tous les utilisateurs
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', protect, admin, async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// @desc    Changer le statut d'un utilisateur (bannir/activer)
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
router.put('/users/:id/status', protect, admin, async (req, res) => {
    try {
        const { status } = req.body;
        const user = await User.findById(req.params.id);

        if (user) {
            user.status = status;
            await user.save();

            // Générer un nouveau token avec le statut mis à jour
            const newToken = generateTokenWithStatus(user._id, user.status);

            // Envoyer un signal WebSocket à l'utilisateur concerné
            req.io.to(user._id.toString()).emit('status_update', {
                status: user.status,
                token: newToken, // Envoyer le nouveau token
            });

            res.json({ message: 'Statut mis à jour', user });
        } else {
            res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// @desc    Récupérer toutes les réclamations
// @route   GET /api/admin/complaints
// @access  Private/Admin
router.get('/complaints', protect, admin, async (req, res) => {
    try {
        const complaints = await Complaint.find({}).populate('user', 'name email').sort({ createdAt: -1 });
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

export default router;