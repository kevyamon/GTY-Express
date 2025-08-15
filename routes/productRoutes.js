import express from 'express';
const router = express.Router();
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js'; // NOUVEL IMPORT
import { protect, admin } from '../middleware/authMiddleware.js';
import asyncHandler from '../middleware/asyncHandler.js';

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
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
}));

// --- NOUVELLE ROUTE POUR LES PRODUITS LES MIEUX NOTÉS ---
// @desc    Get top rated products
// @route   GET /api/products/top
// @access  Public
router.get('/top', asyncHandler(async (req, res) => {
  // On cherche les produits avec une note supérieure ou égale à 4,
  // on les classe par note décroissante et on ne garde que les 5 premiers.
  const products = await Product.find({ rating: { $gte: 4 } })
    .sort({ rating: -1 })
    .limit(5);
  res.json(products);
}));
// --- FIN DE L'AJOUT ---

// --- NOUVELLE ROUTE POUR LES PRODUITS POPULAIRES (LES PLUS VENDUS) ---
// @desc    Get most popular products
// @route   GET /api/products/popular
// @access  Public
router.get('/popular', asyncHandler(async (req, res) => {
  // 1. On analyse toutes les commandes "Livrée" pour compter les produits vendus
  const popularProductsIds = await Order.aggregate([
    // On ne prend que les commandes qui ont bien été livrées
    { $match: { status: 'Livrée' } },
    // On "déplie" le tableau des articles pour traiter chaque article individuellement
    { $unwind: '$orderItems' },
    // On groupe par ID de produit et on fait la somme des quantités vendues
    {
      $group: {
        _id: '$orderItems.product',
        totalSold: { $sum: '$orderItems.qty' },
      },
    },
    // On classe par total vendu, du plus grand au plus petit
    { $sort: { totalSold: -1 } },
    // On ne garde que les 10 produits les plus populaires
    { $limit: 10 },
    // On ne garde que l'ID pour la prochaine étape
    { $project: { _id: 1 } }
  ]);

  // On extrait juste les IDs du résultat
  const productIds = popularProductsIds.map(p => p._id);

  // 2. On récupère les détails complets de ces produits populaires
  const products = await Product.find({ _id: { $in: productIds } });

  res.json(products);
}));
// --- FIN DE L'AJOUT ---

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (product) {
    return res.json(product);
  }
  res.status(404);
  throw new Error('Produit non trouvé');
}));

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
router.post('/', protect, admin, asyncHandler(async (req, res) => {
  const product = new Product({
    ...req.body,
    user: req.user._id,
  });
  const createdProduct = await product.save();
  res.status(201).json(createdProduct);
}));

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
router.put('/:id', protect, admin, asyncHandler(async (req, res) => {
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

      req.io.emit('product_update', { productId: product._id });
      res.json(updatedProduct);
  } else {
      res.status(404);
      throw new Error('Produit non trouvé');
  }
}));

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (product) {
      await product.deleteOne();
      res.json({ message: 'Produit supprimé' });
  } else {
      res.status(404);
      throw new Error('Produit non trouvé');
  }
}));

// --- ROUTE POUR LES AVIS SÉCURISÉE ---
// @desc    Create a new review
// @route   POST /api/products/:id/reviews
// @access  Private
router.post('/:id/reviews', protect, asyncHandler(async (req, res) => {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
      // VÉRIFICATION 1 : L'utilisateur a-t-il déjà commenté ?
      const alreadyReviewed = product.reviews.find(
        (r) => r.user.toString() === req.user._id.toString()
      );

      if (alreadyReviewed) {
        res.status(400);
        throw new Error('Vous avez déjà commenté ce produit');
      }

      // VÉRIFICATION 2 : L'utilisateur a-t-il acheté et reçu ce produit ?
      const deliveredOrders = await Order.find({
        user: req.user._id,
        status: 'Livrée',
        'orderItems.product': product._id,
      });

      if (deliveredOrders.length === 0) {
        res.status(403); // 403 Forbidden = non autorisé
        throw new Error("Vous ne pouvez laisser un avis que sur les produits que vous avez reçus.");
      }

      const review = {
        name: req.user.name,
        rating: Number(rating),
        comment,
        user: req.user._id,
      };

      product.reviews.push(review);
      product.numReviews = product.reviews.length;
      product.rating =
        product.reviews.reduce((acc, item) => item.rating + acc, 0) /
        product.reviews.length;

      await product.save();
      res.status(201).json({ message: 'Avis ajouté' });
    } else {
      res.status(404);
      throw new Error('Produit non trouvé');
    }
  })
);

export default router;