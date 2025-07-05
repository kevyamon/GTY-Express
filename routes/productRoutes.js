import express from 'express';
const router = express.Router();
import Product from '../models/productModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';

// Route modifiée pour gérer les catégories et la recherche
router.get('/', async (req, res) => {
  const { keyword, category } = req.query;

  const filter = {};

  if (keyword) {
    filter.name = {
      $regex: keyword,
      $options: 'i',
    };
  }

  // Logique pour filtrer par catégorie
  if (category === 'supermarket') {
    filter.isSupermarket = true;
  } else {
    // Par défaut, on n'affiche que les produits qui ne sont PAS de supermarché
    filter.isSupermarket = { $ne: true };
  }

  const products = await Product.find({ ...filter });
  res.json(products);
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
    image: '/images/sample.jpg',
    countInStock: 0,
    description: 'Exemple de description',
    isSupermarket: false, // Valeur par défaut
  });
  const createdProduct = await product.save();
  res.status(201).json(createdProduct);
});

router.put('/:id', protect, admin, async (req, res) => {
    const { name, price, description, image, countInStock, originalPrice, isSupermarket } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
        product.name = name;
        product.price = price;
        product.originalPrice = originalPrice;
        product.description = description;
        product.image = image;
        product.countInStock = countInStock;
        product.isSupermarket = isSupermarket; // On sauvegarde la nouvelle valeur
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