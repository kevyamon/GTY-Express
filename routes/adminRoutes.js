import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js'; // NOUVEL IMPORT
import { protect, admin } from '../middleware/authMiddleware.js';
import User from '../models/userModel.js';
import Complaint from '../models/complaintModel.js';
import Notification from '../models/notificationModel.js';
import { v4 as uuidv4 } from 'uuid';
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
router.get('/users', protect, admin, asyncHandler(async (req, res) => {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json(users);
}));

// @desc    Changer le statut d'un utilisateur (bannir/activer)
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
router.put('/users/:id/status', protect, admin, asyncHandler(async (req, res) => {
    const { status } = req.body;
    const userToModify = await User.findById(req.params.id);

    if (!userToModify) {
        res.status(404);
        throw new Error('Utilisateur non trouvé');
    }

    if (userToModify.email === process.env.SUPER_ADMIN_EMAIL) {
        const tryingAdmin = req.user;
        const superAdmin = await User.findOne({ email: process.env.SUPER_ADMIN_EMAIL });

        if (superAdmin) { // On s'assure que le super admin existe
            const newNotif = {
                notificationId: uuidv4(),
                user: superAdmin._id,
                message: `ALERTE SÉCURITÉ : L'admin ${tryingAdmin.name} a tenté de modifier votre compte.`,
                link: '/admin/userlist',
            };
            await Notification.create(newNotif);
            req.io.to(superAdmin._id.toString()).emit('notification', newNotif);
        }
        res.status(403);
        throw new Error('Action non autorisée. Le Super Admin ne peut pas être modifié.');
    }

    userToModify.status = status;
    await userToModify.save();
    const newToken = generateTokenWithStatus(userToModify._id, userToModify.status);
    req.io.to(userToModify._id.toString()).emit('status_update', {
        status: userToModify.status,
        token: newToken,
    });
    res.json({ message: 'Statut mis à jour', user: userToModify });
}));

// @desc    Changer le rôle d'un utilisateur (admin/client)
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
router.put('/users/:id/role', protect, admin, asyncHandler(async (req, res) => {
    const { isAdmin } = req.body;
    const userToModify = await User.findById(req.params.id);

    if (!userToModify) {
        res.status(404);
        throw new Error('Utilisateur non trouvé');
    }

    if (userToModify.email === process.env.SUPER_ADMIN_EMAIL) {
        res.status(403);
        throw new Error('Le rôle du Super Admin ne peut pas être modifié.');
    }

    userToModify.isAdmin = isAdmin;
    const updatedUser = await userToModify.save();

    const message = isAdmin 
        ? `Félicitations ! Vous avez été promu au rang d'Administrateur.`
        : `Votre statut d'Administrateur a été révoqué.`;

    const newNotif = {
        notificationId: uuidv4(),
        user: updatedUser._id,
        message: message,
        link: '/admin/userlist',
    };
    await Notification.create(newNotif);
    req.io.to(updatedUser._id.toString()).emit('notification', newNotif);
    req.io.to(updatedUser._id.toString()).emit('role_update', {
        isAdmin: updatedUser.isAdmin,
        message: message,
    });
    res.json({ message: 'Rôle mis à jour', user: updatedUser });
}));

// @desc    Récupérer toutes les réclamations
// @route   GET /api/admin/complaints
// @access  Private/Admin
router.get('/complaints', protect, admin, asyncHandler(async (req, res) => {
    const complaints = await Complaint.find({}).populate('user', 'name email').sort({ createdAt: -1 });
    res.json(complaints);
}));

// @desc    Supprimer une réclamation
// @route   DELETE /api/admin/complaints/:id
// @access  Private/Admin
router.delete('/complaints/:id', protect, admin, asyncHandler(async (req, res) => {
    const complaint = await Complaint.findById(req.params.id);
    if (complaint) {
        await complaint.deleteOne();
        req.io.to('admin').emit('complaint_update');
        res.json({ message: 'Réclamation supprimée' });
    } else {
        res.status(404);
        throw new Error('Réclamation non trouvée');
    }
}));

// @desc    Supprimer toutes les réclamations
// @route   DELETE /api/admin/complaints
// @access  Private/Admin
router.delete('/complaints', protect, admin, asyncHandler(async (req, res) => {
    await Complaint.deleteMany({});
    req.io.to('admin').emit('complaint_update');
    res.json({ message: 'Toutes les réclamations ont été supprimées' });
}));

export default router;