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

// @desc    Auth user & get token (Login)
// @route   POST /api/users/login
router.post('/login', async (req, res) => {
  const { loginIdentifier, password } = req.body;
  
  // Le backend cherche un utilisateur dont l'email OU le téléphone correspond
  const user = await User.findOne({
    $or: [{ email: loginIdentifier }, { phone: loginIdentifier }],
  });

  if (user && (await user.matchPassword(password))) {
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin,
      token: generateToken(user._id),
    });
  } else {
    res.status(401).json({ message: 'Identifiant ou mot de passe invalide' });
  }
});

// @desc    Register a new user
// @route   POST /api/users/register
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
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Données utilisateur invalides' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// @desc    Logout user
// @route   POST /api/users/logout
router.post('/logout', (req, res) => {
  res.status(200).json({ message: 'Logged out successfully' });
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user) {
    res.json({ _id: user._id, name: user.name, email: user.email, phone: user.phone });
  } else {
    res.status(404).json({ message: 'Utilisateur non trouvé' });
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    if (req.body.password) {
      user.password = req.body.password;
    }
    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      isAdmin: updatedUser.isAdmin,
      token: generateToken(updatedUser._id),
    });
  } else {
    res.status(404).json({ message: 'Utilisateur non trouvé' });
  }
});

export default router;