import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import User from '../models/userModel.js';
import Complaint from '../models/complaintModel.js';
import Notification from '../models/notificationModel.js'; // NOUVEL IMPORT
import { v4 as uuidv4 } from 'uuid'; // NOUVEL IMPORT
import jwt from 'jsonwebtoken';

const router = express.Router();

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
        const userToModify = await User.findById(req.params.id);

        if (!userToModify) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        // --- LOGIQUE DE PROTECTION DU SUPER ADMIN ---
        if (userToModify.email === process.env.SUPER_ADMIN_EMAIL) {
            // Un admin essaie de bannir le Super Admin
            const tryingAdmin = req.user; // L'admin qui fait la requête
            const superAdmin = await User.findOne({ email: process.env.SUPER_ADMIN_EMAIL });

            // Créer une notification pour le Super Admin
            const newNotif = {
                notificationId: uuidv4(),
                user: superAdmin._id,
                message: `ALERTE SÉCURITÉ : L'admin ${tryingAdmin.name} (${tryingAdmin.email}) a tenté de bannir votre compte.`,
                link: '/admin/userlist',
            };
            await Notification.create(newNotif);
            req.io.to(superAdmin._id.toString()).emit('notification', newNotif);

            return res.status(403).json({ message: 'Action non autorisée. Le Super Admin ne peut pas être modifié.' });
        }
        // --- FIN DE LA LOGIQUE DE PROTECTION ---

        userToModify.status = status;
        await userToModify.save();

        const newToken = generateTokenWithStatus(userToModify._id, userToModify.status);

        req.io.to(userToModify._id.toString()).emit('status_update', {
            status: userToModify.status,
            token: newToken,
        });

        res.json({ message: 'Statut mis à jour', user: userToModify });

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