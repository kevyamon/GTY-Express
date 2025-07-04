import express from 'express';
const router = express.Router();
import Product from '../models/productModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';

// @desc    Fetch all products OR search by keyword
// @route   GET /api/products
router.get('/', async (req, res) => {
  const keyword = req.query.keyword
    ? {
        name: {
          $regex: req.query.keyword,
          $options: 'i', // 'i' pour insensible à la casse (majuscules/minuscules)
        },
      }
    : {};

  const products = await Product.find({ ...keyword });
  res.json(products);
});

// @desc    Fetch single product
// @route   GET /api/products/:id
router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ message: 'Produit non trouvé' });
  }
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
router.post('/', protect, admin, async (req, res) => {
  const product = new Product({
    name: 'Exemple de nom',
    price: 0,
    user: req.user._id,
    image: '/images/sample.jpg',
    countInStock: 0,
    description: 'Exemple de description',
  });
  const createdProduct = await product.save();
  res.status(201).json(createdProduct);
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
router.put('/:id', protect, admin, async (req, res) => {
    const { name, price, description, image, countInStock, originalPrice } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
        product.name = name;
        product.price = price;
        product.originalPrice = originalPrice;
        product.description = description;
        product.image = image;
        product.countInStock = countInStock;
        const updatedProduct = await product.save();
        res.json(updatedProduct);
    } else {
        res.status(404).json({ message: 'Produit non trouvé' });
    }
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
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