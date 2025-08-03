import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import Conversation from '../models/conversationModel.js';
import Message from '../models/messageModel.js';
import User from '../models/userModel.js';

const router = express.Router();

// @desc    Envoyer un message
// @route   POST /api/messages/send
// @access  Private
router.post('/send', protect, async (req, res) => {
  try {
    const { recipientId, text } = req.body;
    const senderId = req.user._id;

    let conversation;
    // Si le client envoie un message, on cherche une conversation existante ou on en crée une
    if (!req.user.isAdmin) {
      conversation = await Conversation.findOne({
        participants: { $all: [senderId, recipientId] }, // recipientId sera 'admin'
      });

      if (!conversation) {
        // L'admin est représenté par le premier utilisateur admin trouvé
        const adminUser = await User.findOne({ isAdmin: true });
        if (!adminUser) return res.status(404).json({ message: 'Aucun administrateur trouvé.' });

        conversation = new Conversation({
          participants: [senderId, adminUser._id],
        });
      }
    } else { // Si l'admin envoie un message
        conversation = await Conversation.findOne({
            participants: { $all: [senderId, recipientId] },
        });
        if (!conversation) return res.status(404).json({ message: "Conversation introuvable."});
    }

    const newMessage = new Message({
      conversationId: conversation._id,
      sender: senderId,
      text,
    });

    // On sauvegarde le message et on l'ajoute à la conversation
    await newMessage.save();
    conversation.messages.push(newMessage._id);
    conversation.lastMessage = { text, sender: senderId };
    await conversation.save();

    // On peuple le message avec les infos du sender pour le temps réel
    await newMessage.populate('sender', 'name profilePicture');

    // Envoyer le message en temps réel via Socket.IO
    const recipientSocketId = req.user.isAdmin ? recipientId : conversation.participants.find(p => p.toString() !== senderId.toString());
    req.io.to(recipientSocketId.toString()).emit('newMessage', newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// @desc    Récupérer toutes les conversations
// @route   GET /api/messages
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        let conversations;
        if(req.user.isAdmin) {
            // L'admin voit toutes les conversations
            conversations = await Conversation.find().populate('participants', 'name profilePicture').sort({ updatedAt: -1 });
        } else {
            // Un client ne voit que sa conversation
            conversations = await Conversation.find({ participants: req.user._id }).populate('participants', 'name profilePicture').sort({ updatedAt: -1 });
        }
        res.json(conversations);
    } catch (error) {
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// @desc    Récupérer les messages d'une conversation
// @route   GET /api/messages/:conversationId
// @access  Private
router.get('/:conversationId', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.conversationId,
    }).populate('sender', 'name profilePicture');
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

export default router;