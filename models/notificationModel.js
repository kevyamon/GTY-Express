import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const notificationSchema = mongoose.Schema(
  {
    notificationId: {
      type: String,
      required: true,
      default: uuidv4,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      required: true,
      default: false,
    },
    link: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;