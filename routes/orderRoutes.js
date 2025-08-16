import express from 'express';
const router = express.Router();
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import PromoBanner from '../models/promoBannerModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import Notification from '../models/notificationModel.js';
import { v4 as uuidv4 } from 'uuid';
import { sendOrderConfirmationEmail, sendStatusUpdateEmail } from '../utils/emailService.js';
import asyncHandler from '../middleware/asyncHandler.js'; // AJOUT DE L'IMPORT

// @desc    Valider un code coupon
// @route   POST /api/orders/validate-coupon
// @access  Private
router.post('/validate-coupon', protect, asyncHandler(async (req, res) => {
  const { couponCode } = req.body;
  if (!couponCode) {
    res.status(400);
    throw new Error('Le code du coupon est requis.');
  }
  const activeBanner = await PromoBanner.findOne({ isActive: true });
  if (!activeBanner || new Date() > new Date(activeBanner.endDate)) {
    res.status(404);
    throw new Error('Coupon invalide ou expiré.');
  }
  const coupon = activeBanner.coupons.find(c => c.code === couponCode);
  if (coupon) {
    res.json({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    });
  } else {
    res.status(404);
    throw new Error('Coupon invalide ou expiré.');
  }
}));

// @desc    Créer une nouvelle commande
// @route   POST /api/orders
// @access  Private
router.post('/', protect, asyncHandler(async (req, res) => {
  const { orderItems, shippingAddress, paymentMethod, itemsPrice, taxPrice, shippingPrice, totalPrice, coupon } = req.body;
  
  if (orderItems && orderItems.length === 0) {
    res.status(400);
    throw new Error('Aucun article dans la commande');
  }

  const orderData = {
    orderItems: orderItems.map((x) => ({
      ...x,
      product: x._id,
      _id: undefined,
      image: (x.images && x.images.length > 0) ? x.images[0] : x.image,
    })),
    user: req.user._id,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  };

  if (coupon && coupon.code) {
    orderData.coupon = {
      code: coupon.code,
      discountType: coupon.discountType,
      discountAmount: coupon.discountAmountApplied,
      priceBeforeDiscount: coupon.priceBeforeDiscount,
    };
  }

  const order = new Order(orderData);
  const createdOrder = await order.save();

  sendOrderConfirmationEmail(createdOrder, req.user);

  const adminNotification = {
    notificationId: uuidv4(),
    user: 'admin',
    message: `Nouvelle commande N°${createdOrder._id.toString().substring(0,8)} passée par ${req.user.name}`,
    link: `/admin/orderlist`,
  };
  await Notification.create(adminNotification);
  req.io.to('admin').emit('notification', adminNotification);
  req.io.to('admin').emit('order_update', { orderId: createdOrder._id });
  res.status(201).json(createdOrder);
}));

// @desc    Récupérer toutes les commandes (Admin)
// @route   GET /api/orders
// @access  Private/Admin
router.get('/', protect, admin, asyncHandler(async (req, res) => {
  const orders = await Order.find({ isArchived: false }).populate('user', 'id name').sort({ createdAt: -1 });
  res.json(orders);
}));

// @desc    Récupérer les commandes visibles de l'utilisateur
// @route   GET /api/orders/myorders
// @access  Private
router.get('/myorders', protect, asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id, isVisible: true }).sort({ createdAt: -1 });
  res.json(orders);
}));

// @desc    Récupérer TOUTES les commandes de l'utilisateur (même masquées)
// @route   GET /api/orders/mypurchases
// @access  Private
router.get('/mypurchases', protect, asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(orders);
}));

// @desc    Récupérer une commande par ID
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (order) {
    if (req.user.isAdmin || order.user._id.toString() === req.user._id.toString()) {
      res.json(order);
    } else {
      res.status(401);
      throw new Error('Non autorisé à voir cette commande');
    }
  } else {
    res.status(404);
    throw new Error('Commande non trouvée');
  }
}));

// @desc    Mettre à jour le statut ou le paiement (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
// --- ROUTE ENTIÈREMENT CORRIGÉE ---
router.put('/:id/status', protect, admin, asyncHandler(async (req, res) => {
    // On récupère la commande et on peuple directement l'utilisateur associé
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (!order) {
        res.status(404);
        throw new Error('Commande non trouvée');
    }

    let hasChanged = false;
    // La variable customer est maintenant order.user (qui peut être null si le client a été supprimé)
    const customer = order.user; 

    if (req.body.status && req.body.status !== order.status) {
        order.status = req.body.status;
        hasChanged = true;

        if (order.status === 'Confirmée') {
            for (const item of order.orderItems) {
                const product = await Product.findById(item.product);
                if (product) {
                    product.countInStock -= item.qty;
                    await product.save();
                    req.io.emit('product_update', { productId: product._id });
                }
            }
        }

        if (order.status === 'Livrée' && !order.deliveredAt) {
            order.deliveredAt = Date.now();
        }

        // On vérifie que le client existe avant de tenter de lui envoyer une notification ou un email
        if (customer) {
            const newNotif = {
                notificationId: uuidv4(),
                user: customer._id,
                message: `Le statut de votre commande N°${order._id.toString().substring(0,8)} est passé à "${order.status}"`,
                link: `/order/${order._id}`,
            };
            await Notification.create(newNotif);
            req.io.to(customer._id.toString()).emit('notification', newNotif);
            sendStatusUpdateEmail(order, customer);
        }
    }

    if (req.body.isPaid === true && !order.isPaid) {
        order.isPaid = true;
        order.paidAt = Date.now();
        hasChanged = true;
      
        if (customer) {
            const paymentNotif = {
                notificationId: uuidv4(),
                user: customer._id,
                message: `Votre paiement pour la commande N°${order._id.toString().substring(0,8)} a été confirmé.`,
                link: `/order/${order._id}`,
            };
            await Notification.create(paymentNotif);
            req.io.to(customer._id.toString()).emit('notification', paymentNotif);
        }
    }

    if (hasChanged) {
        const updatedOrder = await order.save();
        if (customer) {
            req.io.to(customer._id.toString()).emit('order_update', { orderId: order._id });
        }
        req.io.to('admin').emit('order_update', { orderId: order._id });
        res.json(updatedOrder);
    } else {
        res.json(order);
    }
}));
// --- FIN DE LA CORRECTION ---

// @desc    Archiver/Désarchiver une commande (Admin)
// @route   PUT /api/orders/:id/archive
// @access  Private/Admin
router.put('/:id/archive', protect, admin, asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order) {
        order.isArchived = !order.isArchived; // On inverse la valeur actuelle
        await order.save();
        req.io.to('admin').emit('order_update', { orderId: order._id });
        res.json({ message: `Commande ${order.isArchived ? 'archivée' : 'désarchivée'}` });
    } else {
        res.status(404);
        throw new Error('Commande non trouvée');
    }
}));

// @desc    Mettre à jour une commande comme "Payée" (Client)
// @route   PUT /api/orders/:id/pay
// @access  Private
router.put('/:id/pay', protect, asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order) {
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: req.body.id,
        status: req.body.status,
        update_time: req.body.update_time,
        email_address: req.body.payer ? req.body.payer.email_address : 'N/A',
      };
      const updatedOrder = await order.save();
      req.io.to(order.user.toString()).emit('order_update', { orderId: order._id });
      req.io.to('admin').emit('order_update', { orderId: order._id });
      res.json(updatedOrder);
    } else {
      res.status(404);
      throw new Error('Commande non trouvée');
    }
}));

// @desc    Annuler une commande (Utilisateur)
// @route   PUT /api/orders/:id/cancel
// @access  Private
router.put('/:id/cancel', protect, asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order && order.user.toString() === req.user._id.toString()) {
        if (order.status === 'En attente') {
            order.status = 'Annulée';
            const updatedOrder = await order.save();
            sendStatusUpdateEmail(updatedOrder, req.user);
            const newNotif = {
                notificationId: uuidv4(),
                user: 'admin',
                message: `Le client ${req.user.name} a annulé la commande N°${order._id.toString().substring(0,8)}`,
                link: `/admin/orderlist`,
            };
            await Notification.create(newNotif);
            req.io.to('admin').emit('notification', newNotif);
            req.io.to('admin').emit('order_update', { orderId: order._id });
            res.json(updatedOrder);
        } else {
            res.status(400);
            throw new Error("Impossible d'annuler une commande déjà traitée.");
        }
    } else {
        res.status(404);
        throw new Error('Commande non trouvée ou autorisation refusée');
    }
}));

// @desc    Supprimer une commande de la vue (soft delete)
// @route   DELETE /api/orders/:id
// @access  Private
router.delete('/:id', protect, asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order && (req.user.isAdmin || order.user.toString() === req.user._id.toString())) {
      order.isVisible = false;
      await order.save();
      res.json({ message: 'Commande masquée de votre historique' });
    } else {
      res.status(404);
      throw new Error('Commande non trouvée ou autorisation refusée');
    }
}));

export default router;