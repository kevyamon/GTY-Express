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

    if (category === 'supermarket') {
      filter.category = 'Supermarché';
    } else if (category && category !== 'all' && category !== 'general') {
      filter.category = category;
    } else if (category !== 'all') {
      filter.category = { $ne: 'Supermarché' };
    }

    if (promotion === 'true') {
      filter.promotion = { $exists: true, $ne: null };
    }

    const products = await Product.find({ ...filter }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// GET /api/products/:id
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

// POST /api/products
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

// PUT /api/products/:id
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

        // Émission de l'événement de mise à jour du produit
        req.io.emit('product_update', { productId: product._id });

        res.json(updatedProduct);
    } else {
        res.status(404).json({ message: 'Produit non trouvé' });
    }
});

// DELETE /api/products/:id
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