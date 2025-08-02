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
    images: {
      type: [String],
      default: [],
    },
    brand: {
      type: String,
      required: false,
    },
    // --- MODIFICATION DU CHAMP CATEGORY ---
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