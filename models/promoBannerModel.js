import mongoose from 'mongoose';

const couponSchema = mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  code: { type: String, required: true, unique: true }, // Assurons-nous que chaque code est unique
  
  // --- AJOUTS POUR LA VALEUR DE LA RÉDUCTION ---
  discountType: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed'], // La réduction peut être un pourcentage ou un montant fixe
  },
  discountValue: {
    type: Number,
    required: true, // La valeur de la réduction est obligatoire
  },
  // --- FIN DE L'AJOUT ---
});

// NOUVEAU : Schéma pour les textes animés
const animatedTextSchema = mongoose.Schema({
    text: { type: String, required: true },
});

// NOUVEAU : Schéma pour les images flottantes
const floatingImageSchema = mongoose.Schema({
    url: { type: String, required: true },
});

const promoBannerSchema = mongoose.Schema(
  {
    // On remplace le texte unique par un tableau de textes
    animatedTexts: [animatedTextSchema], 
    endDate: {
      type: Date,
      required: true,
    },
    coupons: [couponSchema],
    // On ajoute le tableau pour les images flottantes
    floatingImages: [floatingImageSchema],
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const PromoBanner = mongoose.model('PromoBanner', promoBannerSchema);

export default PromoBanner;