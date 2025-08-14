import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import Warning from '../models/warningModel.js';

const router = express.Router();

// @desc    Créer un nouvel avertissement
// @route   POST /api/warnings
// @access  Private/Admin
router.post('/', protect, admin, asyncHandler(async (req, res) => {
  const { userId, message, actions } = req.body;

  if (!userId || !message) {
    res.status(400);
    throw new Error('L\'ID de l\'utilisateur et le message sont requis.');
  }

  const warning = new Warning({
    user: userId,
    sender: req.user._id,
    message,
    actions,
  });

  const createdWarning = await warning.save();
  
  // Envoyer une notification en temps réel à l'utilisateur ciblé
  req.io.to(userId).emit('new_warning', createdWarning);

  res.status(201).json(createdWarning);
}));

// @desc    Récupérer les avertissements actifs pour l'utilisateur connecté
// @route   GET /api/warnings/mywarnings
// @access  Private
router.get('/mywarnings', protect, asyncHandler(async (req, res) => {
  const warnings = await Warning.find({ user: req.user._id, status: 'active' }).sort({ createdAt: 'desc' });
  res.json(warnings);
}));

// @desc    Fermer (supprimer) un avertissement
// @route   DELETE /api/warnings/:id
// @access  Private
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const warning = await Warning.findById(req.params.id);

  if (warning) {
    // Vérifier que c'est bien l'utilisateur concerné qui supprime son propre avertissement
    if (warning.user.toString() !== req.user._id.toString()) {
      res.status(401);
      throw new Error('Action non autorisée');
    }
    
    // On pourrait le supprimer avec .deleteOne()
    // mais le marquer comme 'dismissed' est mieux si on veut garder un historique
    await warning.deleteOne(); 

    res.json({ message: 'Avertissement fermé' });
  } else {
    res.status(404);
    throw new Error('Avertissement non trouvé');
  }
}));

export default router;