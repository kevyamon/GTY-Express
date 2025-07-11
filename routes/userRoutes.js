import express from 'express';
const router = express.Router();
import User from '../models/userModel.js';
import { protect } from '../middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const sendUserResponse = (res, user, statusCode = 200) => {
    res.status(statusCode).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        profilePicture: user.profilePicture,
        token: generateToken(user._id),
      });
};

router.post('/login', async (req, res) => {
  const { loginIdentifier, password } = req.body;
  const user = await User.findOne({
    $or: [{ email: loginIdentifier }, { phone: loginIdentifier }],
  });
  if (user && (await user.matchPassword(password))) {
    sendUserResponse(res, user, 200);
  } else {
    res.status(401).json({ message: 'Identifiant ou mot de passe invalide' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: 'Veuillez remplir tous les champs' });
    }
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Cet utilisateur existe déjà' });
    }
    const phoneExists = await User.findOne({ phone });
    if (phoneExists) {
        return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé' });
    }
    const user = await User.create({ name, email, password, phone });
    if (user) {
      sendUserResponse(res, user, 201);
    } else {
      res.status(400).json({ message: 'Données utilisateur invalides' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

router.post('/logout', (req, res) => {
  res.status(200).json({ message: 'Logged out successfully' });
});

router.get('/profile', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profilePicture: user.profilePicture,
    });
  } else {
    res.status(404).json({ message: 'Utilisateur non trouvé' });
  }
});

router.put('/profile', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    user.profilePicture = req.body.profilePicture || user.profilePicture;
    if (req.body.password) {
      user.password = req.body.password;
    }
    const updatedUser = await user.save();
    sendUserResponse(res, updatedUser);
  } else {
    res.status(404).json({ message: 'Utilisateur non trouvé' });
  }
});

export default router;