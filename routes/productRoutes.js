import express from 'express';
const router = express.Router();
import Product from '../models/productModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { keyword, category, promotion } = req.query; // On ajoute la promotion
    const filter = {};

    if (keyword) {
      filter.name = { $regex: req.query.keyword, $options: 'i' };
    }

    if (category === 'supermarket') {
      filter.isSupermarket = true;
    } else if (category === 'general') {
      filter.isSupermarket = { $ne: true };
      filter.promotion = { $exists: false }; // On exclut les produits en promo
    } else if (promotion === 'true') {
      filter.promotion = { $exists: true, $ne: null }; // On ne prend que les produits en promo
    }
    // Si la catégorie est 'all', on n'ajoute pas de filtre isSupermarket

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
      name: 'Exemple de nom',
      price: 0,
      user: req.user._id,
      // CORRECTION : Utilise une image temporaire publique
      image: 'https://via.placeholder.com/300x300.png?text=Image+Exemple',
      images: [],
      brand: 'Exemple de marque',
      countInStock: 0,
      description: 'Exemple de description',
    });
    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la création du produit' });
  }
});

router.put('/:id', protect, admin, async (req, res) => {
    const { name, price, description, images, countInStock, originalPrice, isSupermarket, promotion } = req.body;
    const product = await Product.findById(req.params.id);
    if (product) {
        product.name = name; product.price = price; product.originalPrice = originalPrice;
        product.description = description; product.images = images;
        product.countInStock = countInStock; product.isSupermarket = isSupermarket;
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