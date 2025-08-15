import mongoose from 'mongoose';

const orderSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    orderItems: [
      {
        name: { type: String, required: true },
        qty: { type: Number, required: true },
        image: { type: String, required: false },
        price: { type: Number, required: true },
        product: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: 'Product',
        },
      },
    ],
    shippingAddress: {
      name: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String },
      country: { type: String, required: true },
      phone: { type: String, required: true },
    },
    paymentMethod: { type: String, required: true },
    paymentResult: { id: { type: String }, status: { type: String }, update_time: { type: String }, email_address: { type: String } },
    itemsPrice: { type: Number, required: true, default: 0.0 },
    taxPrice: { type: Number, required: true, default: 0.0 },
    shippingPrice: { type: Number, required: true, default: 0.0 },
    totalPrice: { type: Number, required: true, default: 0.0 },

    coupon: {
      code: { type: String },
      discountType: { type: String, enum: ['percentage', 'fixed'] },
      discountAmount: { type: Number },
      priceBeforeDiscount: { type: Number },
    },

    isPaid: { type: Boolean, required: true, default: false },
    paidAt: { type: Date },
    status: {
      type: String,
      required: true,
      enum: ['En attente', 'Confirmée', 'Expédiée', 'Livrée', 'Annulée'],
      default: 'En attente',
    },
    deliveredAt: { type: Date },
    
    isVisible: {
      type: Boolean,
      required: true,
      default: true,
    },
    
    // --- AJOUT POUR L'ARCHIVAGE ADMIN ---
    isArchived: {
      type: Boolean,
      required: true,
      default: false,
    },
    // --- FIN DE L'AJOUT ---
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('Order', orderSchema);
export default Order;