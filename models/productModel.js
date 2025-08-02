import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: false, // MODIFIÉ ICI
    },
    category: {
      type: String,
      required: true,
      default: 'general', // 'general' ou 'supermarket'
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    countInStock: {
      type: Number,
      required: true,
      default: 0,
    },
    // --- NOUVEAUX CHAMPS POUR LES PROMOTIONS ---
    isOnPromotion: {
      type: Boolean,
      required: true,
      default: false,
    },
    promotionPrice: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model('Product', productSchema);

export default Product;