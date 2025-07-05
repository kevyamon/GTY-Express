import express from 'express';
const router = express.Router();
import Order from '../models/orderModel.js';
import { protect, admin } from '../middleware/authMiddleware.js';

// Créer une nouvelle commande
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
    res.status(201).json(createdOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

// Récupérer les commandes de l'utilisateur connecté
router.get('/myorders', protect, async (req, res) => {
  const orders = await Order.find({ user: req.user._id });
  res.json(orders);
});

// Récupérer toutes les commandes (Admin)
router.get('/', protect, admin, async (req, res) => {
  const orders = await Order.find({}).populate('user', 'id name');
  res.json(orders);
});

// Récupérer une commande par ID
router.get('/:id', protect, async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ message: 'Commande non trouvée' });
  }
});

// Mettre à jour une commande comme "Payée"
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

// Mettre à jour le statut d'une commande (Admin)
router.put('/:id/status', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (order) {
      if (req.body.status) {
        order.status = req.body.status;
        if (req.body.status === 'Livrée') {
          order.isDelivered = true;
          order.deliveredAt = Date.now();
        }
      }
      if (req.body.isPaid === true) {
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

// Annuler une commande (Utilisateur)
router.put('/:id/cancel', protect, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (order && order.user.toString() === req.user._id.toString()) {
    if (order.status === 'En attente') {
      order.status = 'Annulée';
      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(400).json({ message: "Impossible d'annuler une commande déjà traitée." });
    }
  } else {
    res.status(404).json({ message: 'Commande non trouvée' });
  }
});

// Supprimer une commande
router.delete('/:id', protect, async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order && (req.user.isAdmin || order.user.toString() === req.user._id.toString())) {
      await order.deleteOne();
      res.json({ message: 'Commande supprimée' });
    } else {
      res.status(404).json({ message: 'Commande non trouvée ou autorisation refusée' });
    }
});

export default router;