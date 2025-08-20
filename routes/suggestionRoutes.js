import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import Suggestion from '../models/suggestionModel.js';
import Notification from '../models/notificationModel.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// @desc    Créer une nouvelle suggestion
// @route   POST /api/suggestions
// @access  Private
router.post('/', protect, asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) {
    res.status(400);
    throw new Error('Le texte de la suggestion ne peut pas être vide.');
  }

  const suggestion = new Suggestion({
    user: req.user._id,
    text,
  });

  const createdSuggestion = await suggestion.save();

  const newNotif = {
      notificationId: uuidv4(),
      user: 'admin',
      message: `Nouvelle suggestion reçue de ${req.user.name}.`,
      link: '/admin/suggestionlist',
  };
  await Notification.create(newNotif);
  req.io.to('admin').emit('notification', newNotif);
  req.io.to('admin').emit('suggestion_update');

  res.status(201).json(createdSuggestion);
}));

// @desc    Récupérer les suggestions de l'utilisateur connecté
// @route   GET /api/suggestions/mysuggestions
// @access  Private
router.get('/mysuggestions', protect, asyncHandler(async (req, res) => {
  const suggestions = await Suggestion.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(suggestions);
}));

// @desc    Mettre à jour une de ses propres suggestions
// @route   PUT /api/suggestions/:id
// @access  Private
router.put('/:id', protect, asyncHandler(async (req, res) => {
  const suggestion = await Suggestion.findById(req.params.id);

  if (suggestion) {
    if (suggestion.user.toString() !== req.user._id.toString()) {
      res.status(401);
      throw new Error('Action non autorisée');
    }
    suggestion.text = req.body.text || suggestion.text;
    const updatedSuggestion = await suggestion.save();
    req.io.to('admin').emit('suggestion_update');
    res.json(updatedSuggestion);
  } else {
    res.status(404);
    throw new Error('Suggestion non trouvée');
  }
}));

// @desc    Supprimer une de ses propres suggestions
// @route   DELETE /api/suggestions/:id
// @access  Private
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const suggestion = await Suggestion.findById(req.params.id);

  if (suggestion) {
    if (suggestion.user.toString() !== req.user._id.toString()) {
      res.status(401);
      throw new Error('Action non autorisée');
    }
    await suggestion.deleteOne();
    req.io.to('admin').emit('suggestion_update');
    res.json({ message: 'Suggestion supprimée' });
  } else {
    res.status(404);
    throw new Error('Suggestion non trouvée');
  }
}));

// --- ROUTES POUR LES ADMINS ---

// @desc    Récupérer les suggestions actives (non archivées par l'admin)
// @route   GET /api/suggestions
// @access  Private/Admin
router.get('/', protect, admin, asyncHandler(async (req, res) => {
  const suggestions = await Suggestion.find({ archivedBy: { $ne: req.user._id } })
    .populate('user', 'name email profilePicture')
    .sort({ createdAt: -1 });
  res.json(suggestions);
}));

// --- NOUVELLE ROUTE ---
// @desc    Récupérer les suggestions archivées par l'admin
// @route   GET /api/suggestions/archived
// @access  Private/Admin
router.get('/archived', protect, admin, asyncHandler(async (req, res) => {
  const suggestions = await Suggestion.find({ archivedBy: req.user._id })
    .populate('user', 'name email profilePicture')
    .sort({ createdAt: -1 });
  res.json(suggestions);
}));

// @desc    Archiver/Désarchiver une suggestion (Admin)
// @route   PUT /api/suggestions/:id/archive
// @access  Private/Admin
router.put('/:id/archive', protect, admin, asyncHandler(async (req, res) => {
  const suggestion = await Suggestion.findById(req.params.id);

  if (suggestion) {
    const adminId = req.user._id;
    const isArchived = suggestion.archivedBy.includes(adminId);

    if (isArchived) {
      suggestion.archivedBy.pull(adminId);
    } else {
      suggestion.archivedBy.push(adminId);
    }
    const updatedSuggestion = await suggestion.save();
    
    req.io.to('admin').emit('suggestion_update');
    res.json(updatedSuggestion);
  } else {
    res.status(404);
    throw new Error('Suggestion non trouvée');
  }
}));

export default router;