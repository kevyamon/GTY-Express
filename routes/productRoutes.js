import express from 'express';
const router = express.Router();
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import asyncHandler from '../middleware/asyncHandler.js';

// --- ROUTE PRINCIPALE CORRIGÉE ---
router.get('/', asyncHandler(async (req, res) => {
  const { keyword, category, promotion } = req.query;
  const filter = {};

  if (keyword) {
    filter.name = { $regex: keyword, $options: 'i' };
  }

  // --- LOGIQUE DE CATÉGORIE CLARIFIÉE ---
  if (category === 'supermarket') {
    // Si on demande explicitement le supermarché, on ne montre que ça.
    filter.category = 'Supermarché';
  } else if (category && category !== 'all' && category !== 'general') {
    // Si une catégorie spécifique est demandée, on la filtre.
    filter.category = category;
  } else if (category !== 'all') {
    // Pour toutes les autres requêtes générales (y compris la grille "Tous les Produits"),
    // on exclut la catégorie 'Supermarché'.
    filter.category = { $ne: 'Supermarché' };
  }
  // Si category === 'all' (ex: page promotions), on n'applique aucun filtre de catégorie.

  if (promotion === 'true') {
    filter.promotion = { $exists: true, $ne: null };
  }

  const products = await Product.find({ ...filter }).sort({ createdAt: -1 });
  res.json(products);
}));


// --- Les routes "top" et "popular" restent inchangées car elles font déjà ce que tu veux ---
router.get('/top', asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 0;
  const query = Product.find({ rating: { $gte: 4 } }).sort({ rating: -1 });
  if (limit > 0) {
    query.limit(limit);
  }
  const products = await query;
  res.json(products);
}));

router.get('/popular', asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 0;
  const aggregatePipeline = [
    { $match: { status: 'Livrée' } },
    { $unwind: '$orderItems' },
    { $group: { _id: '$orderItems.product', totalSold: { $sum: '$orderItems.qty' } } },
    { $sort: { totalSold: -1 } },
  ];
  if (limit > 0) {
    aggregatePipeline.push({ $limit: limit });
  }
  aggregatePipeline.push({ $project: { _id: 1 } });
  
  const popularProductsIds = await Order.aggregate(aggregatePipeline);
  const productIds = popularProductsIds.map(p => p._id);
  
  if (productIds.length === 0) {
    return res.json([]);
  }
  
  const products = await Product.find({ _id: { $in: productIds } });
  const sortedProducts = productIds.map(id => products.find(p => p._id.equals(id))).filter(Boolean);
  res.json(sortedProducts);
}));

// Le reste du fichier est inchangé
router.get('/:id', asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (product) { return res.json(product); }
  res.status(404);
  throw new Error('Produit non trouvé');
}));

router.post('/', protect, admin, asyncHandler(async (req, res) => {
  const product = new Product({ ...req.body, user: req.user._id });
  const createdProduct = await product.save();
  res.status(201).json(createdProduct);
}));

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

router.post('/:id/reviews', protect, asyncHandler(async (req, res) => {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);
    if (product) {
      const alreadyReviewed = product.reviews.find((r) => r.user.toString() === req.user._id.toString());
      if (alreadyReviewed) {
        res.status(400);
        throw new Error('Vous avez déjà commenté ce produit');
      }
      const deliveredOrders = await Order.find({ user: req.user._id, status: 'Livrée', 'orderItems.product': product._id });
      if (deliveredOrders.length === 0) {
        res.status(403);
        throw new Error("Vous ne pouvez laisser un avis que sur les produits que vous avez reçus.");
      }
      const review = { name: req.user.name, rating: Number(rating), comment, user: req.user._id };
      product.reviews.push(review);
      product.numReviews = product.reviews.length;
      product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;
      await product.save();
      res.status(201).json({ message: 'Avis ajouté' });
    } else {
      res.status(404);
      throw new Error('Produit non trouvé');
    }
  })
);

export default router;          