import express from 'express';
const router = express.Router();
import Product from '../models/productModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { keyword, category, promotion } = req.query;
    const filter = {};

    if (keyword) {
      filter.name = { $regex: keyword, $options: 'i' };
    }

    // --- LOGIQUE DE FILTRAGE MISE À JOUR ---
    if (category) {
      if (category === 'supermarket') {
        filter.category = 'Supermarché'; // Filtre sur la nouvelle catégorie
      } else if (category !== 'all') {
        filter.category = category;
      }
    } else {
      // Par défaut, si aucune catégorie n'est spécifiée, on exclut le Supermarché
      filter.category = { $ne: 'Supermarché' };
    }

    if (promotion === 'true') {
      filter.promotion = { $exists: true, $ne: null };
    }

    const products = await Product.find({ ...filter });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Produit non trouvé' });
    }
  } catch (error) {
    res.status(404).json({ message: 'Produit non trouvé' });
  }
});

router.post('/', protect, admin, async (req, res) => {
  try {
    const product = new Product({
      ...req.body,
      user: req.user._id,
    });
    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la création du produit' });
  }
});

router.put('/:id', protect, admin, async (req, res) => {
    const { name, price, description, images, brand, category, countInStock, originalPrice, isSupermarket, promotion } = req.body;
    const product = await Product.findById(req.params.id);
    if (product) {
        product.name = name;
        product.price = price;
        product.description = description;
        product.images = images;
        product.brand = brand;
        product.category = category;
        product.countInStock = countInStock;
        product.originalPrice = originalPrice;
        product.isSupermarket = isSupermarket;
        product.promotion = promotion === '' ? undefined : promotion;
        const updatedProduct = await product.save();
        res.json(updatedProduct);
    } else {
        res.status(404).json({ message: 'Produit non trouvé' });
    }
});

router.delete('/:id', protect, admin, async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (product) {
        await product.deleteOne();
        res.json({ message: 'Produit supprimé' });
    } else {
        res.status(404).json({ message: 'Produit non trouvé' });
    }
});

export default router;