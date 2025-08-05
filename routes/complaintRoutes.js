import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js'; // NOUVEL IMPORT
import { protect } from '../middleware/authMiddleware.js';
import Complaint from '../models/complaintModel.js';
import Notification from '../models/notificationModel.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// @desc    Créer une nouvelle réclamation
// @route   POST /api/complaints
// @access  Private
router.post('/', protect, asyncHandler(async (req, res) => {
  const { text, images } = req.body;
  if (!text) {
    res.status(400);
    throw new Error('Le texte de la réclamation ne peut pas être vide.');
  }

  const complaint = new Complaint({
    user: req.user._id,
    text,
    images,
  });

  const createdComplaint = await complaint.save();

  const newNotif = {
      notificationId: uuidv4(),
      user: 'admin',
      message: `Nouvelle réclamation reçue de ${req.user.name}.`,
      link: '/admin/complaintlist',
  };
  await Notification.create(newNotif);

  req.io.to('admin').emit('new_complaint', createdComplaint);
  req.io.to('admin').emit('notification', newNotif);

  res.status(201).json(createdComplaint);
}));

export default router;