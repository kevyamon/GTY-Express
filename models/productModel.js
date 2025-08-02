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
    // Ajouté pour la compatibilité avec les anciens produits
    image: {
      type: String,
      required: false,
    },
    // Le nouveau champ pour gérer plusieurs images
    images: {
      type: [String],
      default: [],
    },
    brand: {
      type: String,
      required: false,
    },
    category: {
      type: String,
      required: false,
      default: 'general',
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
    originalPrice: {
      type: Number,
    },
    countInStock: {
      type: Number,
      required: true,
      default: 0,
    },
    isSupermarket: {
      type: Boolean,
      default: false,
    },
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promotion',
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model('Product', productSchema);

export default Product;