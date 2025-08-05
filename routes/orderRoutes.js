import express from 'express';
const router = express.Router();
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import Notification from '../models/notificationModel.js';
import { v4 as uuidv4 } from 'uuid';

// @desc    Créer une nouvelle commande
// @route   POST /api/orders
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { orderItems, shippingAddress, paymentMethod, itemsPrice, taxPrice, shippingPrice, totalPrice } = req.body;
    if (orderItems && orderItems.length === 0) {
      return res.status(400).json({ message: 'Aucun article dans la commande' });
    }
    const order = new Order({
      orderItems: orderItems.map((x) => ({
        ...x,
        product: x._id,
        _id: undefined,
        image: (x.images && x.images.length > 0) ? x.images[0] : x.image,
      })),
      user: req.user._id,
      shippingAddress, paymentMethod, itemsPrice, taxPrice, shippingPrice, totalPrice,
    });
    const createdOrder = await order.save();
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// @desc    Récupérer les commandes de l'utilisateur connecté
// @route   GET /api/orders/myorders
// @access  Private
router.get('/myorders', protect, async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(orders);
});

// @desc    Récupérer toutes les commandes (Admin)
// @route   GET /api/orders
// @access  Private/Admin
router.get('/', protect, admin, async (req, res) => {
  const orders = await Order.find({}).populate('user', 'id name').sort({ createdAt: -1 });
  res.json(orders);
});

// @desc    Mettre à jour le statut ou le paiement (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
router.put('/:id/status', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (order) {
      // Gérer le changement de statut
      if (req.body.status && req.body.status !== order.status) {
        order.status = req.body.status;
        if (req.body.status === 'Confirmée') {
          for (const item of order.orderItems) {
            const product = await Product.findById(item.product);
            if (product) {
              product.countInStock -= item.qty;
              await product.save();
              req.io.emit('product_update', { productId: product._id });
            }
          }
        }
        if (req.body.status === 'Livrée') {
          order.isDelivered = true;
          order.deliveredAt = Date.now();
        }
        const newNotif = {
            notificationId: uuidv4(),
            user: order.user,
            message: `Le statut de votre commande N°${order._id.toString().substring(0,8)} est passé à "${req.body.status}"`,
            link: `/order/${order._id}`,
        };
        await Notification.create(newNotif);
        req.io.to(order.user.toString()).emit('notification', newNotif);
      }

      // Gérer le changement de paiement
      if (req.body.isPaid === true && !order.isPaid) {
        order.isPaid = true;
        order.paidAt = Date.now();
      }

      const updatedOrder = await order.save();

      // Envoyer la notification temps réel pour TOUTE mise à jour
      req.io.to(order.user.toString()).emit('order_update', { orderId: order._id });
      req.io.to('admin').emit('order_update', { orderId: order._id });

      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Commande non trouvée' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// @desc    Mettre à jour une commande comme "Payée" (Client)
// @route   PUT /api/orders/:id/pay
// @access  Private
router.put('/:id/pay', protect, async (req, res) => {
  try {
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

      // Notification temps réel
      req.io.to(order.user.toString()).emit('order_update', { orderId: order._id });
      req.io.to('admin').emit('order_update', { orderId: order._id });

      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Commande non trouvée' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur lors du paiement' });
  }
});

// @desc    Annuler une commande (Utilisateur)
// @route   PUT /api/orders/:id/cancel
// @access  Private
router.put('/:id/cancel', protect, async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order && order.user.toString() === req.user._id.toString()) {
        if (order.status === 'En attente') {
            order.status = 'Annulée';
            const updatedOrder = await order.save();
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
            res.status(400).json({ message: "Impossible d'annuler une commande déjà traitée." });
        }
    } else {
        res.status(404).json({ message: 'Commande non trouvée ou autorisation refusée' });
    }
});

// @desc    Supprimer une commande
// @route   DELETE /api/orders/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order && (req.user.isAdmin || order.user.toString() === req.user._id.toString())) {
      await order.deleteOne();
      res.json({ message: 'Commande supprimée' });
    } else {
      res.status(404).json({ message: 'Commande non trouvée ou autorisation refusée' });
    }
});

// @desc    Récupérer une commande par ID
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ message: 'Commande non trouvée' });
  }
});

export default router;