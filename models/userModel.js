import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// --- AJOUT : Schéma pour l'abonnement push ---
const pushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
});
// --- FIN DE L'AJOUT ---

const userSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    profilePicture: { type: String, default: '' },
    isAdmin: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      required: true,
      enum: ['active', 'banned'],
      default: 'active',
    },
    // --- AJOUT : Champ pour stocker les abonnements ---
    pushSubscriptions: [pushSubscriptionSchema],

    // --- DÉBUT DE LA MODIFICATION : MOT DE PASSE OUBLIÉ ---
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // --- FIN DE LA MODIFICATION ---
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;