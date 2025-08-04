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
    const { animatedTexts, endDate, coupons, floatingImages } = req.body;
    const banner = new PromoBanner({
      animatedTexts,
      endDate,
      coupons,
      floatingImages,
      isActive: true,
    });
    const createdBanner = await banner.save();
    req.io.emit('banner_update');
    res.status(201).json(createdBanner);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Données invalides' });
  }
});

// @desc    Mettre à jour une bannière
// @route   PUT /api/promobanner/:id
// @access  Private/Admin
router.put('/:id', protect, admin, async (req, res) => {
    try {
      const { animatedTexts, endDate, coupons, floatingImages } = req.body;
      const banner = await PromoBanner.findById(req.params.id);

      if (banner) {
        banner.animatedTexts = animatedTexts;
        banner.endDate = endDate;
        banner.coupons = coupons;
        banner.floatingImages = floatingImages;

        const updatedBanner = await banner.save();
        req.io.emit('banner_update');
        res.json(updatedBanner);
      } else {
        res.status(404).json({ message: 'Bannière non trouvée' });
      }
    } catch (error) {
      console.error(error);
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