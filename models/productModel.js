import mongoose from 'mongoose';

// --- CORRECTION APPLIQUÉE ICI ---
// On définit d'abord le schéma sans le champ récursif
const reviewSchema = new mongoose.Schema(
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
      default: 0,
    },
    comment: {
      type: String,
      required: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
      default: null,
    },
    // Le champ 'replies' est retiré d'ici pour être ajouté après
  },
  {
    timestamps: true,
  }
);

// Puis, on ajoute le champ récursif 'replies' au schéma déjà existant.
// C'est la méthode correcte pour que Mongoose comprenne la référence à soi-même.
reviewSchema.add({ replies: [reviewSchema] });
// --- FIN DE LA CORRECTION ---

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
    reviews: [reviewSchema],
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