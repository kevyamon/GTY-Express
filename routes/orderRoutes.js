import express from 'express';
const router = express.Router();
import Order from '../models/orderModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import Notification from '../models/notificationModel.js';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { orderItems, shippingAddress, paymentMethod, itemsPrice, taxPrice, shippingPrice, totalPrice } = req.body;
    if (orderItems && orderItems.length === 0) {
      return res.status(400).json({ message: 'Aucun article dans la commande' });
    }

    const order = new Order({
      orderItems: orderItems.map((x) => ({ ...x, product: x._id, _id: undefined })),
      user: req.user._id,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
    });

    const createdOrder = await order.save();

    await Notification.create({
      user: req.user._id,
      message: `Nouvelle commande N°${createdOrder._id.toString().substring(0, 8)} passée par ${req.user.name}`,
      link: `/order/${createdOrder._id}`,
    });

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// @desc    Get logged in user orders
router.get('/myorders', protect, async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(orders);
});

// @desc    Get all orders (ADMIN)
router.get('/', protect, admin, async (req, res) => {
  const orders = await Order.find({}).populate('user', 'id name').sort({ createdAt: -1 });
  res.json(orders);
});

// @desc    Update order to paid
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
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Commande non trouvée' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur lors du paiement' });
  }
});

// @desc    Update order status (ADMIN)
router.put('/:id/status', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name');
    if (order) {
      const oldStatus = order.status;

      if (req.body.status && req.body.status !== oldStatus) {
        order.status = req.body.status;
        if (req.body.status === 'Livrée') {
          order.isDelivered = true;
          order.deliveredAt = Date.now();
        }

        // Notification pour le client
        await Notification.create({
          user: order.user._id,
          message: `Le statut de votre commande N°${order._id.toString().substring(0, 8)} est passé à "${req.body.status}"`,
          link: `/order/${order._id}`,
        });

        // Notification pour l'admin
        await Notification.create({
          user: req.user._id,
          message: `Vous avez confirmé la commande N°${order._id.toString().substring(0, 8)}`,
          link: `/order/${order._id}`,
        });
      }

      if (req.body.isPaid === true && !order.isPaid) {
        order.isPaid = true;
        order.paidAt = Date.now();
      }

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Commande non trouvée' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// @desc    Cancel an order (USER)
router.put('/:id/cancel', protect, async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name');
  if (order && order.user._id.toString() === req.user._id.toString()) {
    if (order.status === 'En attente') {
      order.status = 'Annulée';
      const updatedOrder = await order.save();

      await Notification.create({
        user: req.user._id,
        message: `Vous avez annulé la commande N°${order._id.toString().substring(0, 8)}`,
        link: `/order/${order._id}`,
      });

      res.json(updatedOrder);
    } else {
      res.status(400).json({ message: "Impossible d'annuler une commande déjà traitée." });
    }
  } else {
    res.status(404).json({ message: 'Commande non trouvée ou autorisation refusée' });
  }
});

// @desc    Delete an order
router.delete('/:id', protect, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (order && (req.user.isAdmin || order.user.toString() === req.user._id.toString())) {
    await order.deleteOne();
    res.json({ message: 'Commande supprimée' });
  } else {
    res.status(404).json({ message: 'Commande non trouvée ou autorisation refusée' });
  }
});

// @desc    Get order by ID
router.get('/:id', protect, async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ message: 'Commande non trouvée' });
  }
});

export default router;