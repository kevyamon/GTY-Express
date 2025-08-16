import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      console.error(error);
      // --- CORRECTION : On envoie une réponse JSON ---
      res.status(401).json({ message: 'Non autorisé, le token a échoué' });
    }
  }

  if (!token) {
    // --- CORRECTION : On envoie une réponse JSON ---
    res.status(401).json({ message: 'Non autorisé, pas de token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    // --- CORRECTION : On envoie une réponse JSON ---
    res.status(401).json({ message: 'Action non autorisée pour votre rôle' });
  }
};

export { protect, admin };