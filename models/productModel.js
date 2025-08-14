import mongoose from 'mongoose';

// --- NOUVEAU : Schéma pour un avis individuel ---
const reviewSchema = mongoose.Schema(
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
    rating: {
      type: Number,
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
// --- FIN DU NOUVEAU SCHÉMA ---

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
      required: true,
      enum: [
        'Électronique',
        'Vêtements et Accessoires',
        'Sports et Loisirs',
        'Beauté et Santé',
        'Maison et Cuisine',
        'Supermarché',
        'Autres',
      ],
      default: 'Autres',
    },
    description: {
      type: String,
      required: true,
    },
    // --- AJOUTS POUR LES AVIS ---
    reviews: [reviewSchema], // Un produit peut avoir plusieurs avis
    rating: {
      type: Number,
      required: true,
      default: 0, // Note moyenne
    },
    numReviews: {
      type: Number,
      required: true,
      default: 0, // Nombre total d'avis
    },
    // --- FIN DES AJOUTS ---
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