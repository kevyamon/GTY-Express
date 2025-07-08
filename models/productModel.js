import mongoose from 'mongoose';

const productSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    images: [{ type: String, required: true }],
    description: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    originalPrice: { type: Number },
    countInStock: { type: Number, required: true, default: 0 },
    isSupermarket: { type: Boolean, required: true, default: false },
    // NOUVEAU CHAMP POUR LA PROMOTION
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promotion',
      required: false, // Un produit n'est pas obligatoirement en promotion
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model('Product', productSchema);
export default Product;