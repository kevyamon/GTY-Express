import mongoose from 'mongoose';

const couponSchema = mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  code: { type: String, required: true },
});

const promoBannerSchema = mongoose.Schema(
  {
    mainOfferText: {
      type: String,
      required: true,
      default: "Jusqu'à -60%",
    },
    endDate: {
      type: Date,
      required: true,
    },
    coupons: [couponSchema],
    images: { // CHAMP AJOUTÉ
      type: [String],
      default: [],
    },
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