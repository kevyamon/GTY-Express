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
    const order = await Order.findById(req.params.id).populate('user', 'id name');

    // Sécurité 1 : Vérifier si la commande existe
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    let hasChanged = false;

    // Gérer le changement de statut
    if (req.body.status && req.body.status !== order.status) {
      hasChanged = true;

      // Sécurité 2 : Vérifier que l'utilisateur de la commande existe avant toute action
      if (!order.user) {
        return res.status(400).json({ message: `Action impossible : l'utilisateur de cette commande n'existe plus.` });
      }

      // Logique spécifique quand la commande est CONFIRMÉE
      if (req.body.status === 'Confirmée') {
        for (const item of order.orderItems) {
          const product = await Product.findById(item.product);

          // Sécurité 3 : Vérifier que le produit commandé existe toujours
          if (!product) {
            return res.status(400).json({ 
              message: `Action impossible : le produit '${item.name}' n'existe plus en base de données.` 
            });
          }

          // Sécurité 4 (LA PLUS IMPORTANTE) : Valider que le stock et la quantité sont des nombres
          const stock = Number(product.countInStock);
          const quantity = Number(item.qty);

          if (isNaN(stock)) {
             return res.status(500).json({ message: `Erreur de données : le stock du produit '${product.name}' n'est pas un nombre.`});
          }
          if (isNaN(quantity) || quantity <= 0) {
            return res.status(400).json({ message: `Erreur de données : la quantité pour '${item.name}' est invalide.`});
          }

          if (stock < quantity) {
            return res.status(400).json({ 
              message: `Stock insuffisant pour '${item.name}'. Restant: ${stock}, Demandé: ${quantity}.`
            });
          }

          // Si tout est valide, on met à jour le stock
          product.countInStock = stock - quantity;
          await product.save();
          req.io.emit('product_update', { productId: product._id });
        }
      }

      order.status = req.body.status;

      if (req.body.status === 'Livrée') {
        order.isDelivered = true;
        order.deliveredAt = Date.now();
      }

      // Notification seulement si la logique ci-dessus a réussi
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

    // Sauvegarder la commande uniquement après que toutes les opérations ont réussi
    const updatedOrder = await order.save();

    if (hasChanged) {
      // S'assurer que `order.user` existe avant d'émettre le socket
      if (order.user) {
        req.io.to(order.user._id.toString()).emit('order_update', { orderId: order._id });
      }
      req.io.to('admin').emit('order_update', { orderId: order._id });
    }

    res.json(updatedOrder);

  } catch (error) {
    // Log amélioré pour un débogage facile
    console.error(`ERREUR DÉTAILLÉE [PUT /api/orders/${req.params.id}/status] :`, error);
    res.status(500).json({ message: 'Erreur interne du serveur. Vérifiez les logs pour plus de détails.' });
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
        id: req.body.id, status: req.body.status, update_time: req.body.update_time,
        email_address: req.body.payer ? req.body.payer.email_address : 'N/A',
      };
      const updatedOrder = await order.save();

      req.io.to(order.user.toString()).emit('order_update', { orderId: order._id });
      req.io.to('admin').emit('order_update', { orderId: order._id });

      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Commande non trouvée' });
    }
  } catch (error) {
    console.error("ERREUR [PUT /api/orders/:id/pay] :", error);
    res.status(500).json({ message: 'Erreur du serveur lors du paiement' });
  }
});

// @desc    Annuler une commande (Utilisateur)
// @route   PUT /api/orders/:id/cancel
// @access  Private
router.put('/:id/cancel', protect, async (req, res) => {
    try {
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
    } catch (error) {
        console.error(`ERREUR [PUT /api/orders/${req.params.id}/cancel] :`, error);
        res.status(500).json({ message: 'Erreur du serveur lors de l\'annulation' });
    }
});


// @desc    Supprimer une commande
// @route   DELETE /api/orders/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (order && (req.user.isAdmin || order.user.toString() === req.user._id.toString())) {
      // La méthode a changé dans Mongoose, .remove() est déprécié
      await order.deleteOne();
      res.json({ message: 'Commande supprimée' });
    } else {
      res.status(404).json({ message: 'Commande non trouvée ou autorisation refusée' });
    }
  } catch(error) {
    console.error(`ERREUR [DELETE /api/orders/${req.params.id}] :`, error);
    res.status(500).json({ message: 'Erreur du serveur lors de la suppression' });
  }
});


// @desc    Récupérer une commande par ID
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ message: 'Commande non trouvée' });
    }
  } catch (error) {
    console.error(`ERREUR [GET /api/orders/${req.params.id}] :`, error);
    res.status(500).json({ message: 'Erreur du serveur' });
  }
});

export default router;