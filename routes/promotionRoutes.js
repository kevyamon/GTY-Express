import express from 'express';
import Promotion from '../models/promotionModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Créer une nouvelle promotion
// @route   POST /api/promotions
// @access  Private/Admin
router.post('/', protect, admin, async (req, res) => {
  try {
    const { name, description } = req.body;

    const promotionExists = await Promotion.findOne({ name });

    if (promotionExists) {
      return res.status(400).json({ message: 'Une promotion avec ce nom existe déjà' });
    }

    const promotion = new Promotion({
      name,
      description,
    });

    const createdPromotion = await promotion.save();
    res.status(201).json(createdPromotion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// @desc    Récupérer toutes les promotions
// @route   GET /api/promotions
// @access  Private/Admin
router.get('/', protect, admin, async (req, res) => {
  try {
    const promotions = await Promotion.find({}).sort({ createdAt: -1 });
    res.json(promotions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// @desc    Supprimer une promotion
// @route   DELETE /api/promotions/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);

    if (promotion) {
      await promotion.deleteOne();
      res.json({ message: 'Promotion supprimée' });
    } else {
      res.status(404).json({ message: 'Promotion non trouvée' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

export default router;