import express from 'express';
const router = express.Router();
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import asyncHandler from '../middleware/asyncHandler.js';

// --- ROUTE PRINCIPALE AMÉLIORÉE ---
// @desc    Fetch products with advanced filtering
// @route   GET /api/products
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const { keyword, category, promotion, pageType } = req.query;
  const filter = {};

  // Logique de filtrage existante
  if (keyword) {
    filter.name = { $regex: keyword, $options: 'i' };
  }
  if (category === 'supermarket') {
    filter.category = 'Supermarché';
  } else if (category && category !== 'all' && category !== 'general') {
    filter.category = category;
  } else if (category !== 'all' && !isSupermarket && !pageType) { // Ne s'applique pas au supermarché ou aux pages spéciales
    filter.category = { $ne: 'Supermarché' };
  }
  if (promotion === 'true') {
    filter.promotion = { $exists: true, $ne: null };
  }

  // --- NOUVELLE LOGIQUE POUR LA GRILLE NORMALE ---
  // Si on demande la grille principale, on exclut les produits populaires et mieux notés.
  if (pageType === 'mainGrid') {
    // 1. Trouver les IDs des produits populaires
    const popularProductsIds = await Order.aggregate([
      { $match: { status: 'Livrée' } },
      { $unwind: '$orderItems' },
      { $group: { _id: '$orderItems.product' } },
    ]);
    const popularIds = popularProductsIds.map(p => p._id);

    // 2. Trouver les IDs des produits mieux notés
    const topRatedProducts = await Product.find({ rating: { $gte: 4 } }).select('_id');
    const topRatedIds = topRatedProducts.map(p => p._id);

    // 3. Fusionner les listes d'IDs à exclure
    const idsToExclude = [...new Set([...popularIds, ...topRatedIds])];

    // 4. Ajouter la condition d'exclusion au filtre principal
    filter._id = { $nin: idsToExclude };
  }
  
  const products = await Product.find({ ...filter }).sort({ createdAt: -1 });
  res.json(products);
}));

// --- ROUTE "MIEUX NOTÉS" MISE À JOUR ---
// @desc    Get top rated products (all or limited)
// @route   GET /api/products/top
// @access  Public
router.get('/top', asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 0; // 0 = pas de limite
  
  const query = Product.find({ rating: { $gte: 4 } }).sort({ rating: -1 });

  if (limit > 0) {
    query.limit(limit);
  }

  const products = await query;
  res.json(products);
}));

// --- ROUTE "POPULAIRES" MISE À JOUR ---
// @desc    Get most popular products (all or limited)
// @route   GET /api/products/popular
// @access  Public
router.get('/popular', asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 0;

  const aggregatePipeline = [
    { $match: { status: 'Livrée' } },
    { $unwind: '$orderItems' },
    {
      $group: {
        _id: '$orderItems.product',
        totalSold: { $sum: '$orderItems.qty' },
      },
    },
    { $sort: { totalSold: -1 } },
  ];

  if (limit > 0) {
    aggregatePipeline.push({ $limit: limit });
  }

  aggregatePipeline.push({ $project: { _id: 1 } });
  
  const popularProductsIds = await Order.aggregate(aggregatePipeline);
  const productIds = popularProductsIds.map(p => p._id);
  const products = await Product.find({ _id: { $in: productIds } });

  res.json(products);
}));


// --- Les autres routes restent inchangées ---

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

// @desc    Create a new review
// @route   POST /api/products/:id/reviews
// @access  Private
router.post('/:id/reviews', protect, asyncHandler(async (req, res) => {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
      const alreadyReviewed = product.reviews.find(
        (r) => r.user.toString() === req.user._id.toString()
      );

      if (alreadyReviewed) {
        res.status(400);
        throw new Error('Vous avez déjà commenté ce produit');
      }

      const deliveredOrders = await Order.find({
        user: req.user._id,
        status: 'Livrée',
        'orderItems.product': product._id,
      });

      if (deliveredOrders.length === 0) {
        res.status(403);
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