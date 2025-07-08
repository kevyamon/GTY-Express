import express from 'express';
const router = express.Router();
import Product from '../models/productModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.get('/', async (req, res) => {
  try {
    const { keyword, category } = req.query;
    const filter = {};
    if (keyword) {
      filter.name = {
        $regex: req.query.keyword,
        $options: 'i',
      };
    }
    if (category === 'supermarket') {
      filter.isSupermarket = true;
    } else if (category === 'general') {
      filter.isSupermarket = { $ne: true };
    }
    const products = await Product.find({ ...filter });
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ message: 'Produit non trouvé' });
  }
});

router.post('/', protect, admin, async (req, res) => {
  const product = new Product({
    name: 'Exemple de nom',
    price: 0,
    user: req.user._id,
    images: ['/images/sample.jpg'], // Initialise avec une liste d'images
    countInStock: 0,
    description: 'Exemple de description',
    isSupermarket: false,
  });
  const createdProduct = await product.save();
  res.status(201).json(createdProduct);
});

router.put('/:id', protect, admin, async (req, res) => {
    const { name, price, description, images, countInStock, originalPrice, isSupermarket } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
        product.name = name;
        product.price = price;
        product.originalPrice = originalPrice;
        product.description = description;
        product.images = images; // Met à jour la liste d'images
        product.countInStock = countInStock;
        product.isSupermarket = isSupermarket;
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