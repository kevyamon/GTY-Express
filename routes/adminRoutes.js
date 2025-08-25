import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import User from '../models/userModel.js';
import Complaint from '../models/complaintModel.js';
import Notification from '../models/notificationModel.js';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import Promotion from '../models/promotionModel.js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken'; 

const router = express.Router();

const generateTokenWithStatus = (id, status) => {
    return jwt.sign({ id, status }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });
};

// @desc    Récupérer les statistiques pour le tableau de bord
// @route   GET /api/admin/stats
// @access  Private/Admin
router.get('/stats', protect, admin, asyncHandler(async (req, res) => {
    const totalUsers = await User.countDocuments({});
    const totalProducts = await Product.countDocuments({});
    const totalPromotions = await Promotion.countDocuments({});
    const pendingComplaints = await Complaint.countDocuments({ status: 'pending' });

    const orderStatusCounts = await Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const orderStats = orderStatusCounts.reduce((acc, current) => {
        acc[current._id] = current.count;
        return acc;
    }, {});

    const stats = {
        totalUsers,
        totalProducts,
        totalPromotions,
        pendingComplaints,
        orderStats,
    };

    res.json(stats);
}));

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

    // RÈGLE DE SÉCURITÉ ABSOLUE POUR LE SUPER ADMIN
    if (userToModify.email === process.env.SUPER_ADMIN_EMAIL) {
        const tryingAdmin = req.user;
        const superAdmin = await User.findById(userToModify._id);
        const action = `changer le statut en "${status}"`;

        const newNotif = {
            notificationId: uuidv4(),
            user: superAdmin._id,
            message: `ALERTE: ${tryingAdmin.name} (Email: ${tryingAdmin.email}, Tél: ${tryingAdmin.phone}) a essayé de ${action} sur votre compte.`,
            link: '/admin/userlist',
        };
        await Notification.create(newNotif);
        req.io.to(superAdmin._id.toString()).emit('notification', newNotif);
        
        res.status(403);
        throw new Error('Impossible de changer le statut de cet utilisateur. Attention ! Vous risquez d\'être Banni !');
    }

    // --- DÉBUT DE LA CORRECTION ---
    // On utilise findByIdAndUpdate pour ne modifier que le statut,
    // ce qui évite la re-validation des autres champs comme 'phone'.
    const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { status: status },
        { new: true } // 'new: true' nous retourne le document mis à jour
    );
    // --- FIN DE LA CORRECTION ---

    const newToken = generateTokenWithStatus(updatedUser._id, updatedUser.status);
    req.io.to(updatedUser._id.toString()).emit('status_update', {
        status: updatedUser.status,
        token: newToken,
    });
    res.json({ message: 'Statut mis à jour', user: updatedUser });
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

    // RÈGLE DE SÉCURITÉ ABSOLUE POUR LE SUPER ADMIN
    if (userToModify.email === process.env.SUPER_ADMIN_EMAIL) {
        const tryingAdmin = req.user;
        const superAdmin = await User.findById(userToModify._id);
        const action = isAdmin ? "vous nommer admin (déjà fait)" : "vous révoquer les droits d'admin";

        const newNotif = {
            notificationId: uuidv4(),
            user: superAdmin._id,
            message: `ALERTE: ${tryingAdmin.name} (Email: ${tryingAdmin.email}, Tél: ${tryingAdmin.phone}) a essayé de ${action}.`,
            link: '/admin/userlist',
        };
        await Notification.create(newNotif);
        req.io.to(superAdmin._id.toString()).emit('notification', newNotif);

        res.status(403);
        throw new Error('Impossible de changer le rôle de cet utilisateur. Attention ! Vous risquez d\'être Banni !');
    }

    // --- DÉBUT DE LA CORRECTION (même logique que pour le statut) ---
    const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { isAdmin: isAdmin },
        { new: true }
    );
    // --- FIN DE LA CORRECTION ---

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