import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import Complaint from '../models/complaintModel.js';
import Notification from '../models/notificationModel.js'; // NOUVEL IMPORT
import { v4 as uuidv4 } from 'uuid'; // NOUVEL IMPORT

const router = express.Router();

// @desc    Créer une nouvelle réclamation
// @route   POST /api/complaints
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { text, images } = req.body;
    const complaint = new Complaint({
      user: req.user._id,
      text,
      images,
    });

    const createdComplaint = await complaint.save();

    // --- LOGIQUE DE NOTIFICATION AJOUTÉE ---
    // 1. On crée la notification pour la cloche
    const newNotif = {
        notificationId: uuidv4(),
        user: 'admin', // Cible tous les admins
        message: `Nouvelle réclamation reçue de ${req.user.name}.`,
        link: '/admin/complaintlist',
    };
    await Notification.create(newNotif);

    // 2. On envoie les signaux en temps réel
    req.io.to('admin').emit('new_complaint', createdComplaint); // Pour la page de gestion des réclamations
    req.io.to('admin').emit('notification', newNotif); // Pour la cloche

    res.status(201).json(createdComplaint);
  } catch (error) {
    res.status(400).json({ message: 'Données de réclamation invalides' });
  }
});

export default router;