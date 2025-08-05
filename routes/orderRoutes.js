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
    if (!orderItems || orderItems.length === 0) {
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
    console.error("ERREUR [POST /api/orders] :", error);
    res.status(500).json({ message: 'Erreur du serveur lors de la création de la commande.' });
  }
});

// @desc    Récupérer les commandes de l'utilisateur connecté
// @route   GET /api/orders/myorders
// @access  Private
router.get('/myorders', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("ERREUR [GET /api/orders/myorders] :", error);
    res.status(500).json({ message: 'Erreur du serveur.' });
  }
});

// @desc    Récupérer toutes les commandes (Admin)
// @route   GET /api/orders
// @access  Private/Admin
router.get('/', protect, admin, async (req, res) => {
  try {
    const orders = await Order.find({}).populate('user', 'id name').sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("ERREUR [GET /api/orders] :", error);
    res.status(500).json({ message: 'Erreur du serveur.' });
  }
});

// @desc    Mettre à jour le statut ou le paiement (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
router.put('/:id/status', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'id name');

    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    // CORRECTION DÉFINITIVE : On vérifie que l'utilisateur existe AVANT toute chose.
    if (!order.user) {
        return res.status(400).json({ 
            message: `Action impossible. L'utilisateur de cette commande n'a pas été trouvé (ID: ${order.user}). Il a peut-être été supprimé.` 
        });
    }

    let hasChanged = false;

    // Gérer le changement de statut
    if (req.body.status && req.body.status !== order.status) {
      hasChanged = true;

      if (req.body.status === 'Confirmée') {
        for (const item of order.orderItems) {
          const product = await Product.findById(item.product);
          if (!product) {
            return res.status(400).json({ message: `Action impossible : le produit '${item.name}' n'existe plus.` });
          }
          if (product.countInStock < item.qty) {
            return res.status(400).json({ message: `Stock insuffisant pour '${item.name}'.` });
          }
          product.countInStock -= item.qty;
          await product.save();
          req.io.emit('product_update', { productId: product._id });
        }
      }

      order.status = req.body.status;

      if (req.body.status === 'Livrée') {
        order.isDelivered = true;
        order.deliveredAt = Date.now();
      }

      const newNotif = {
        notificationId: uuidv4(),
        user: order.user._id,
        message: `Le statut de votre commande N°${order._id.toString().substring(0,8)} est passé à "${req.body.status}"`,
        link: `/order/${order._id}`,
      };
      await Notification.create(newNotif);
      req.io.to(order.user._id.toString()).emit('notification', newNotif);
    }

    // Gérer le changement de paiement
    if (req.body.isPaid === true && !order.isPaid) {
      hasChanged = true;
      order.isPaid = true;
      order.paidAt = Date.now();
    }

    const updatedOrder = await order.save();

    if (hasChanged) {
      req.io.to(order.user._id.toString()).emit('order_update', { orderId: order._id });
      req.io.to('admin').emit('order_update', { orderId: order._id });
    }

    res.json(updatedOrder);

  } catch (error) {
    console.error(`ERREUR [PUT /api/orders/${req.params.id}/status] :`, error);
    res.status(500).json({ message: 'Erreur interne du serveur. Vérifiez les logs.' });
  }
});

// @desc    Mettre à jour une commande comme "Payée" (Client)
// @route   PUT /api/orders/:id/pay
// @access  Private
router.put('/:id/pay', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }
    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentResult = {
      id: req.body.id, status: req.body.status, update_time: req.body.update_time,
      email_address: req.body.payer ? req.body.payer.email_address : 'N/A',
    };
    const updatedOrder = await order.save();

    req.io.to(order.user.toString()).emit('order_update', { orderId: order._id });
    req.io.to('admin').emit('order_update', { orderId: order._id });

    res.json(updatedOrder);
  } catch (error) {
    console.error(`ERREUR [PUT /api/orders/${req.params.id}/pay] :`, error);
    res.status(500).json({ message: 'Erreur du serveur lors du paiement.' });
  }
});

// @desc    Annuler une commande (Utilisateur)
// @route   PUT /api/orders/:id/cancel
// @access  Private
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || order.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Commande non trouvée ou autorisation refusée' });
    }

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
  } catch (error) {
    console.error(`ERREUR [PUT /api/orders/${req.params.id}/cancel] :`, error);
    res.status(500).json({ message: 'Erreur du serveur lors de l\'annulation.' });
  }
});

// @desc    Supprimer une commande
// @route   DELETE /api/orders/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }
    await order.deleteOne();
    res.json({ message: 'Commande supprimée' });
  } catch (error) {
    console.error(`ERREUR [DELETE /api/orders/${req.params.id}] :`, error);
    res.status(500).json({ message: 'Erreur du serveur lors de la suppression.' });
  }
});

// @desc    Récupérer une commande par ID
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }
    // L'admin peut voir la commande même si l'user est supprimé, mais un user non-admin ne peut pas voir une commande qui ne lui appartient pas
    if (!order.user && !req.user.isAdmin) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }
    if (order.user && order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        return res.status(401).json({ message: 'Non autorisé' });
    }
    res.json(order);
  } catch (error) {
    console.error(`ERREUR [GET /api/orders/${req.params.id}] :`, error);
    res.status(500).json({ message: 'Erreur du serveur.' });
  }
});

export default router;