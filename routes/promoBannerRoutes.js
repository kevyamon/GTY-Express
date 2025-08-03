import express from 'express';
const router = express.Router();
import { protect, admin } from '../middleware/authMiddleware.js';
import PromoBanner from '../models/promoBannerModel.js';

// @desc    Récupérer la bannière active
// @route   GET /api/promobanner/active
// @access  Public
router.get('/active', async (req, res) => {
  try {
    const banner = await PromoBanner.findOne({ isActive: true });
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// @desc    Récupérer toutes les bannières
// @route   GET /api/promobanner
// @access  Private/Admin
router.get('/', protect, admin, async (req, res) => {
    try {
      const banners = await PromoBanner.find({});
      res.json(banners);
    } catch (error) {
      res.status(500).json({ message: 'Erreur du serveur' });
    }
  });

// @desc    Créer une nouvelle bannière
// @route   POST /api/promobanner
// @access  Private/Admin
router.post('/', protect, admin, async (req, res) => {
  try {
    await PromoBanner.updateMany({}, { isActive: false });
    const banner = new PromoBanner({
      ...req.body,
      isActive: true,
    });
    const createdBanner = await banner.save();
    // On envoie le signal de mise à jour à tout le monde
    req.io.emit('banner_update');
    res.status(201).json(createdBanner);
  } catch (error) {
    res.status(400).json({ message: 'Données invalides' });
  }
});

// @desc    Supprimer une bannière
// @route   DELETE /api/promobanner/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
    try {
        const banner = await PromoBanner.findById(req.params.id);
        if (banner) {
          await banner.deleteOne();
          // On envoie le signal de mise à jour à tout le monde
          req.io.emit('banner_update');
          res.json({ message: 'Bannière supprimée' });
        } else {
          res.status(404).json({ message: 'Bannière non trouvée' });
        }
      } catch (error) {
        res.status(500).json({ message: 'Erreur du serveur' });
      }
});

export default router;