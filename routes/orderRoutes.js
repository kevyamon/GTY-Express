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
import asyncHandler from '../middleware/asyncHandler.js';
import crypto from 'crypto';


// --- DÉBUT : FONCTION UTILITAIRE POUR LE NUMÉRO DE COMMANDE ---
const generateUniquePart = async () => {
  let randomPart;
  let orderExists = true;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  do {
    const digits = Math.floor(100 + Math.random() * 900);
    const letters = chars[Math.floor(Math.random() * chars.length)] + chars[Math.floor(Math.random() * chars.length)];
    randomPart = `${digits}${letters}`;
    orderExists = await Order.findOne({ orderNumber: { $regex: `-${randomPart}$` } });
  } while (orderExists);
  return randomPart;
};
// --- FIN : FONCTION UTILITAIRE ---

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

  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const datePart = `${day}${month}${year}`;

  const productInitials = orderItems
    .slice(0, 2)
    .map(item => item.name.charAt(0))
    .join('')
    .toUpperCase();

  const uniquePart = await generateUniquePart();
  const generatedOrderNumber = `${datePart}-${productInitials}-${uniquePart}`;

  const orderData = {
    orderNumber: generatedOrderNumber,
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
    message: `Nouvelle commande N°${createdOrder.orderNumber} passée par ${req.user.name}`,
    link: `/admin/orderlist`,
  };
  await Notification.create(adminNotification);
  req.io.to('admin').emit('notification', adminNotification);
  req.io.to('admin').emit('order_update', { orderId: createdOrder._id });
  res.status(201).json(createdOrder);
}));

// --- DÉBUT DE LA SECTION CINETPAY ---

// @desc    Générer le lien de paiement CinetPay
// @route   POST /api/orders/:id/pay-cinetpay
// @access  Private
router.post('/:id/pay-cinetpay', protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Commande non trouvée');
  }

  const transaction_id = order._id.toString();

  const paymentData = {
    apikey: process.env.CINETPAY_API_KEY,
    site_id: process.env.CINETPAY_SITE_ID,
    transaction_id: transaction_id,
    amount: Math.round(order.totalPrice),
    currency: 'XOF',
    description: `Paiement pour la commande ${order.orderNumber}`,
    return_url: `${process.env.FRONTEND_URL}/order/${order._id}`,
    notify_url: `${process.env.BACKEND_URL}/api/orders/cinetpay-notify`,
    // Vous pouvez ajouter des metadata si besoin
    metadata: `user_id:${order.user.toString()}`
  };

  try {
    const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
      method: 'POST',
      body: JSON.stringify(paymentData),
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = await response.json();

    if (data.code === '201') {
      order.cinetpayTransactionId = transaction_id;
      await order.save();
      res.json({ payment_url: data.data.payment_url });
    } else {
      console.error('Erreur CinetPay:', data.message);
      res.status(400);
      throw new Error(`Erreur CinetPay: ${data.message}`);
    }
  } catch (error) {
    console.error("Erreur lors de l'initialisation du paiement CinetPay:", error);
    res.status(500);
    throw new Error("Impossible d'initialiser le paiement, veuillez réessayer.");
  }
}));

// @desc    Recevoir la notification de CinetPay (Webhook)
// @route   POST /api/orders/cinetpay-notify
// @access  Public
router.post('/cinetpay-notify', asyncHandler(async (req, res) => {
    const { cpm_trans_id } = req.body;
  
    if (!cpm_trans_id) {
        console.log("Notification CinetPay reçue sans cpm_trans_id");
        return res.status(400).send("ID de transaction manquant");
    }

    try {
        // Étape 1: Vérifier le statut de la transaction auprès de CinetPay
        const checkStatusData = {
            apikey: process.env.CINETPAY_API_KEY,
            site_id: process.env.CINETPAY_SITE_ID,
            transaction_id: cpm_trans_id,
        };

        const response = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
            method: 'POST',
            body: JSON.stringify(checkStatusData),
            headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json();

        if (result.code === '00') {
            const cinetpayData = result.data;
            const order = await Order.findById(cpm_trans_id).populate('user', 'name email');

            if (!order) {
                console.error(`Commande non trouvée pour la transaction CinetPay ${cpm_trans_id}`);
                return res.status(404).send('Commande non trouvée');
            }

            // Étape 2: VÉRIFICATION RIGOUREUSE DU MONTANT
            if (Math.round(order.totalPrice) !== cinetpayData.amount) {
                console.warn(`ALERTE SÉCURITÉ : Montant invalide pour la commande ${order._id}. Attendu: ${Math.round(order.totalPrice)}, Reçu: ${cinetpayData.amount}`);
                
                // On notifie l'admin d'une tentative de paiement frauduleuse
                const adminNotification = {
                    notificationId: uuidv4(),
                    user: 'admin',
                    message: `⚠️ Tentative de paiement avec montant incorrect pour la commande N°${order.orderNumber}.`,
                    link: `/admin/orders/${order._id}`,
                };
                await Notification.create(adminNotification);
                req.io.to('admin').emit('notification', adminNotification);

                // On ne valide pas la commande et on arrête le processus ici.
                return res.status(400).send('Montant invalide.');
            }

            // Étape 3: Mettre à jour la commande si tout est correct
            if (order && !order.isPaid) {
                order.isPaid = true;
                order.paidAt = new Date();
                order.paymentResult = {
                    id: cinetpayData.payment_method,
                    status: cinetpayData.message,
                    update_time: new Date().toISOString(),
                    email_address: order.user.email,
                };

                const updatedOrder = await order.save();
                
                // Envoyer les notifications
                const paymentNotif = {
                    notificationId: uuidv4(),
                    user: order.user._id,
                    message: `Votre paiement pour la commande N°${order.orderNumber} a été confirmé.`,
                    link: `/order/${order._id}`,
                };
                await Notification.create(paymentNotif);
                req.io.to(order.user._id.toString()).emit('notification', paymentNotif);
                req.io.to(order.user._id.toString()).emit('order_update', { orderId: order._id });
                req.io.to('admin').emit('order_update', { orderId: order._id });
            }
        } else {
            console.error(`Échec de la vérification CinetPay pour ${cpm_trans_id}: ${result.message}`);
        }

        res.status(200).send('Notification reçue');

    } catch (error) {
        console.error('Erreur dans le webhook CinetPay:', error);
        res.status(500).send('Erreur interne');
    }
}));


// @desc    Vérifier le statut du paiement depuis le frontend
// @route   GET /api/orders/cinetpay-status/:orderId
// @access  Private
router.get('/cinetpay-status/:orderId', protect, asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
        res.status(404);
        throw new Error('Commande non trouvée');
    }

    // Vérifier que l'utilisateur a le droit de voir cette commande
    if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        res.status(401);
        throw new Error('Non autorisé');
    }

    res.json({
        isPaid: order.isPaid,
        status: order.status
    });
}));

// --- FIN DE LA SECTION CINETPAY ---


// @desc    Récupérer toutes les commandes (Admin)
// @route   GET /api/orders
// @access  Private/Admin
router.get('/', protect, admin, asyncHandler(async (req, res) => {
  const orders = await Order.find({ isArchived: false }).populate('user', 'id name').sort({ createdAt: -1 });
  res.json(orders);
}));

// @desc    Récupérer les commandes archivées (Admin)
// @route   GET /api/orders/archived
// @access  Private/Admin
router.get('/archived', protect, admin, asyncHandler(async (req, res) => {
    const orders = await Order.find({ isArchived: true }).populate('user', 'id name').sort({ createdAt: -1 });
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
router.put('/:id/status', protect, admin, asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate('user', 'name email phone');

    if (!order) {
        res.status(404);
        throw new Error('Commande non trouvée');
    }

    let hasChanged = false;
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

        if (customer && customer._id) {
            const newNotif = {
                notificationId: uuidv4(),
                user: customer._id,
                message: `Le statut de votre commande N°${order.orderNumber} est passé à "${order.status}"`,
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
      
        if (customer && customer._id) {
            const paymentNotif = {
                notificationId: uuidv4(),
                user: customer._id,
                message: `Votre paiement pour la commande N°${order.orderNumber} a été confirmé.`,
                link: `/order/${order._id}`,
            };
            await Notification.create(paymentNotif);
            req.io.to(customer._id.toString()).emit('notification', paymentNotif);
        }
    }

    if (hasChanged) {
        const updatedOrder = await order.save();
        if (customer && customer._id) {
            req.io.to(customer._id.toString()).emit('order_update', { orderId: order._id });
        }
        req.io.to('admin').emit('order_update', { orderId: order._id });
        res.json(updatedOrder);
    } else {
        res.json(order);
    }
}));

// @desc    Archiver/Désarchiver une commande (Admin)
// @route   PUT /api/orders/:id/archive
// @access  Private/Admin
router.put('/:id/archive', protect, admin, asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order) {
        order.isArchived = !order.isArchived; 
        await order.save();
        req.io.to('admin').emit('order_update', { orderId: order._id });
        res.json({ message: `Commande ${order.isArchived ? 'archivée' : 'désarchivée'}` });
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
                message: `Le client ${req.user.name} a annulé la commande N°${order.orderNumber}`,
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