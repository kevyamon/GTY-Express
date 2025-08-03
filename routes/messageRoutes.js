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
    let { recipientId, text, image } = req.body; // On récupère l'image ici
    const senderId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({ message: "Le message ne peut pas être vide."});
    }

    let conversation;

    // Si l'utilisateur est un client, on trouve ou crée la conversation avec un admin
    if (!req.user.isAdmin) {
      // Si le client n'a pas de destinataire spécifié (premier message), on trouve un admin
      if (!recipientId) {
        const adminUser = await User.findOne({ isAdmin: true });
        if (!adminUser) return res.status(404).json({ message: 'Aucun administrateur disponible.' });
        recipientId = adminUser._id;
      }

      conversation = await Conversation.findOne({
        participants: { $all: [senderId, recipientId] },
      });

      if (!conversation) {
        conversation = new Conversation({
          participants: [senderId, recipientId],
        });
      }
    } else { // Si l'expéditeur est un admin
        if (!recipientId) return res.status(400).json({ message: 'Aucun destinataire spécifié.'});
        conversation = await Conversation.findOne({
            participants: { $all: [senderId, recipientId] },
        });
        if (!conversation) return res.status(404).json({ message: "Conversation introuvable."});
    }

    const newMessage = new Message({
      conversationId: conversation._id,
      sender: senderId,
      text,
      image, // On ajoute l'image au nouveau message
    });

    await newMessage.save();
    conversation.messages.push(newMessage._id);

    // Le lastMessage affiche "Photo" si c'est une image, sinon le texte
    const lastMessageText = image ? "📷 Photo" : text;
    conversation.lastMessage = { 
      text: lastMessageText, 
      sender: senderId,
      readBy: [senderId],
    };
    await conversation.save();

    await newMessage.populate('sender', 'name profilePicture');

    const recipientSocketId = conversation.participants.find(p => p.toString() !== senderId.toString());
    req.io.to(recipientSocketId.toString()).emit('newMessage', newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// @desc    Récupérer toutes les conversations avec le statut "non lu"
// @route   GET /api/messages
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        let conversations;
        if(req.user.isAdmin) {
            conversations = await Conversation.find().populate('participants', 'name profilePicture').sort({ updatedAt: -1 });
        } else {
            conversations = await Conversation.find({ participants: userId }).populate('participants', 'name profilePicture').sort({ updatedAt: -1 });
        }
        const conversationsWithStatus = conversations.map(convo => {
          const isUnread = convo.lastMessage && !convo.lastMessage.readBy.includes(userId);
          return { ...convo.toObject(), isUnread };
        });
        res.json(conversationsWithStatus);
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

// @desc    Marquer une conversation comme lue
// @route   POST /api/messages/read/:conversationId
// @access  Private
router.post('/read/:conversationId', protect, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (conversation && conversation.lastMessage) {
      const userId = req.user._id;
      if (!conversation.lastMessage.readBy.includes(userId)) {
        conversation.lastMessage.readBy.push(userId);
        await conversation.save();
        req.io.to(userId.toString()).emit('conversationRead', { conversationId: conversation._id });
      }
    }
    res.status(200).json({ message: 'Conversation marquée comme lue.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

export default router;