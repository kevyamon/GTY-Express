import mongoose from 'mongoose';

// Le schéma pour un avis a été enrichi pour gérer les réponses et les likes
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
    // --- DÉBUT DES AJOUTS ---
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review', // Fait référence à un autre avis dans le même document
      default: null,
    },
    // On va stocker les réponses directement ici pour faciliter la récupération
    // C'est une copie de reviewSchema, Mongoose gère bien cette récursion
    replies: [this], 
    // --- FIN DES AJOUTS ---
  },
  {
    timestamps: true,
  }
);

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
    reviews: [reviewSchema], // Le schéma des avis est maintenant plus complexe
    rating: {
      type: Number,
      required: true,
      default: 0,
    },
    numReviews: {
      type: Number,
      required: true,
      default: 0,
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