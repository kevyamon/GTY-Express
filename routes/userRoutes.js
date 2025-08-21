import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto'; // --- NOUVEL IMPORT ---
const router = express.Router();
import User from '../models/userModel.js';
import { protect } from '../middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';
import asyncHandler from '../middleware/asyncHandler.js'; // --- NOUVEL IMPORT ---
import { sendPasswordResetEmail } from '../utils/emailService.js'; // --- NOUVEL IMPORT ---


// --- CONFIGURATION DU RATE LIMITER POUR LE LOGIN ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Bloque après 5 tentatives
  message: {
    message: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // La clé de blocage est basée sur l'email ou le téléphone fourni
  keyGenerator: (req, res) => {
    return req.body.loginIdentifier;
  },
});
// --- FIN DE LA CONFIGURATION ---

const generateToken = (id, status) => {
  return jwt.sign({ id, status }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const sendUserResponse = (res, user, statusCode = 200, isNew = false) => {
    res.status(statusCode).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        status: user.status,
        profilePicture: user.profilePicture,
        token: generateToken(user._id, user.status),
        isNewUser: isNew,
      });
};

// --- ROUTE DE LOGIN PROTÉGÉE PAR LE RATE LIMITER ---
router.post('/login', loginLimiter, asyncHandler(async (req, res) => { // asyncHandler ajouté
  const { loginIdentifier, password } = req.body;
  const user = await User.findOne({
    $or: [{ email: loginIdentifier }, { phone: loginIdentifier }],
  });
  if (user && (await user.matchPassword(password))) {
    // Un utilisateur qui se connecte n'est jamais nouveau
    sendUserResponse(res, user, 200, false);
  } else {
    res.status(401).json({ message: 'Identifiant ou mot de passe invalide' });
  }
}));
// --- FIN DE LA MODIFICATION ---

router.post('/register', asyncHandler(async (req, res) => { // asyncHandler ajouté
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password || !phone) {
    res.status(400);
    throw new Error('Veuillez remplir tous les champs');
  }
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('Cet utilisateur existe déjà');
  }
  const phoneExists = await User.findOne({ phone });
  if (phoneExists) {
      res.status(400);
      throw new Error('Ce numéro de téléphone est déjà utilisé');
  }
  const user = await User.create({ name, email, password, phone });
  if (user) {
    req.io.to('admin').emit('new_user_registered', {
      name: user.name,
      createdAt: user.createdAt,
    });
    sendUserResponse(res, user, 201, true);
  } else {
    res.status(400);
    throw new Error('Données utilisateur invalides');
  }
}));

router.post('/logout', (req, res) => {
  res.status(200).json({ message: 'Logged out successfully' });
});

router.get('/profile', protect, asyncHandler(async (req, res) => {
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
}));

router.put('/profile', protect, asyncHandler(async (req, res) => {
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
}));

// --- DÉBUT DE L'AJOUT : ROUTES POUR LE MOT DE PASSE OUBLIÉ ---

// @desc    Demander la réinitialisation du mot de passe
// @route   POST /api/users/forgot-password
// @access  Public
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    res.status(404);
    throw new Error('Aucun utilisateur trouvé avec cet email');
  }

  // 1. Générer un jeton aléatoire et sécurisé
  const resetToken = crypto.randomBytes(20).toString('hex');

  // 2. Hasher le jeton et le sauvegarder dans la base de données
  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // 3. Définir une date d'expiration (15 minutes)
  user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  await user.save({ validateBeforeSave: false });

  // 4. Envoyer l'email
  try {
    sendPasswordResetEmail(user, resetToken);
    res.status(200).json({ message: 'Email de réinitialisation envoyé' });
  } catch (err) {
    console.error(err);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    res.status(500);
    throw new Error("L'email n'a pas pu être envoyé");
  }
}));

// @desc    Réinitialiser le mot de passe
// @route   PUT /api/users/reset-password/:resetToken
// @access  Public
router.put('/reset-password/:resetToken', asyncHandler(async (req, res) => {
  // 1. Hasher le jeton reçu pour le comparer à celui dans la DB
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resetToken)
    .digest('hex');

  // 2. Trouver l'utilisateur avec ce jeton et s'assurer qu'il n'est pas expiré
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error('Jeton invalide ou expiré');
  }

  // 3. Mettre à jour le mot de passe
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  
  // 4. (Optionnel) Générer un nouveau token de connexion et le renvoyer
  const token = generateToken(user._id, user.status);
  res.status(200).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    token,
    message: 'Mot de passe mis à jour avec succès',
  });
}));

// --- FIN DE L'AJOUT ---


export default router;