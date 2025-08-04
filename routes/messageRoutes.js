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
    let { recipientId, text, fileUrl, fileName, fileType } = req.body; // MODIFIÉ ICI pour les fichiers
    const senderId = req.user._id;

    if (!text && !fileUrl) { // MODIFIÉ ICI
      return res.status(400).json({ message: "Le message ne peut pas être vide."});
    }

    let conversation;

    if (!req.user.isAdmin) {
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
    } else {
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
      fileUrl, // On utilise les nouveaux champs
      fileName,
      fileType,
      seenBy: [senderId],
    });

    await newMessage.save();
    conversation.messages.push(newMessage._id);

    // Le lastMessage affiche "Fichier" si c'est un fichier, sinon le texte
    const lastMessageText = fileUrl ? `📎 ${fileName || 'Fichier'}` : text;
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

// @desc    Récupérer toutes les conversations
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

// @desc    Marquer les messages d'une conversation comme "vus"
// @route   POST /api/messages/seen/:conversationId
// @access  Private
router.post('/seen/:conversationId', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        await Message.updateMany(
            { conversationId: req.params.conversationId, seenBy: { $ne: userId } },
            { $addToSet: { seenBy: userId } }
        );

        const conversation = await Conversation.findById(req.params.conversationId);
        const recipientSocketId = conversation.participants.find(p => p.toString() !== userId.toString());
        req.io.to(recipientSocketId.toString()).emit('messagesSeen', { conversationId: req.params.conversationId });

        res.status(200).json({ message: 'Messages marqués comme vus.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});


// @desc    Supprimer un message
// @route   DELETE /api/messages/:messageId
// @access  Private
router.delete('/:messageId', protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message non trouvé' });
    }
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Action non autorisée' });
    }
    message.text = "Ce message a été supprimé";
    message.fileUrl = undefined; // On utilise le nouveau nom de champ
    message.fileName = undefined;
    message.fileType = undefined;
    await message.save();

    const conversation = await Conversation.findById(message.conversationId);
    conversation.participants.forEach(participant => {
        req.io.to(participant.toString()).emit('messageEdited', message);
    });

    res.json({ message: 'Message supprimé' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// @desc    Modifier un message
// @route   PUT /api/messages/:messageId
// @access  Private
router.put('/:messageId', protect, async (req, res) => {
  try {
    const { text } = req.body;
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message non trouvé' });
    }
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Action non autorisée' });
    }

    message.text = text;
    message.isEdited = true;
    await message.save();

    await message.populate('sender', 'name profilePicture');

    const conversation = await Conversation.findById(message.conversationId);
    conversation.participants.forEach(participant => {
        req.io.to(participant.toString()).emit('messageEdited', message);
    });

    res.json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

export default router;