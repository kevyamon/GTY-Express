import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import GlobalMessage from '../models/globalMessageModel.js';

const router = express.Router();

// @desc    Créer et envoyer un message global
// @route   POST /api/global-messages
// @access  Private/Admin
router.post('/', protect, admin, asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) {
    res.status(400);
    throw new Error('Le message ne peut pas être vide.');
  }

  // On désactive tous les anciens messages en les archivant
  await GlobalMessage.updateMany({ status: 'active' }, { $set: { status: 'archived' } });

  // On crée le nouveau message
  const globalMessage = new GlobalMessage({
    sender: req.user._id,
    message,
  });

  const createdMessage = await globalMessage.save();

  // On envoie le message à TOUS les clients connectés via Socket.IO
  req.io.emit('new_global_message', createdMessage);

  res.status(201).json(createdMessage);
}));

// @desc    Récupérer le message global actif pour l'utilisateur connecté
// @route   GET /api/global-messages/active
// @access  Private
router.get('/active', protect, asyncHandler(async (req, res) => {
  // On cherche le message actif que l'utilisateur n'a PAS encore fermé
  const message = await GlobalMessage.findOne({
    status: 'active',
    dismissedBy: { $ne: req.user._id }, // '$ne' signifie "not equal"
  });
  res.json(message);
}));

// @desc    Marquer un message comme "fermé" par l'utilisateur
// @route   PUT /api/global-messages/:id/dismiss
// @access  Private
router.put('/:id/dismiss', protect, asyncHandler(async (req, res) => {
  const message = await GlobalMessage.findById(req.params.id);

  if (message) {
    // On ajoute l'ID de l'utilisateur à la liste de ceux qui ont fermé le message
    await message.updateOne({ $addToSet: { dismissedBy: req.user._id } });
    res.json({ message: 'Message fermé avec succès.' });
  } else {
    res.status(404);
    throw new Error('Message non trouvé.');
  }
}));

// @desc    Archiver (supprimer de la vue) un message global
// @route   DELETE /api/global-messages/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, asyncHandler(async (req, res) => {
    const message = await GlobalMessage.findById(req.params.id);
    if(message) {
        message.status = 'archived';
        await message.save();
        res.json({ message: 'Message archivé.' });
    } else {
        res.status(404);
        throw new Error('Message non trouvé.');
    }
}));


export default router;