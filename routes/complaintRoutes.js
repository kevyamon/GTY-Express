import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import Complaint from '../models/complaintModel.js';

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

    // Envoyer une notification à l'admin
    req.io.to('admin').emit('new_complaint', createdComplaint);

    res.status(201).json(createdComplaint);
  } catch (error) {
    res.status(400).json({ message: 'Données de réclamation invalides' });
  }
});

export default router;