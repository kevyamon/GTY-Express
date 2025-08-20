import webpush from 'web-push';
import User from '../models/userModel.js';

// Configurer web-push avec vos clés VAPID
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Envoie une notification push à un ou plusieurs utilisateurs.
 * @param {string|string[]} userIds - L'ID de l'utilisateur ou un tableau d'IDs. Pour les admins, utiliser 'admin'.
 * @param {object} payload - Les données à envoyer dans la notification.
 * @param {string} payload.title - Le titre de la notification.
 * @param {string} payload.body - Le corps du message de la notification.
 * @param {string} [payload.icon] - L'URL de l'icône à afficher.
 * @param {object} [payload.data] - Des données supplémentaires à transmettre au service worker.
 */
export const sendPushNotification = async (userIds, payload) => {
  try {
    const query = Array.isArray(userIds) 
      ? { _id: { $in: userIds } }
      : { _id: userIds };

    const users = await User.find(query).select('pushSubscriptions');

    if (!users || users.length === 0) {
      console.log('Aucun utilisateur trouvé pour envoyer la notification push.');
      return;
    }

    const notificationPayload = JSON.stringify({
        title: payload.title || 'GTY Express',
        body: payload.body,
        icon: payload.icon || '/pwa-192x192.png',
        data: payload.data || {},
    });

    const sendPromises = [];

    users.forEach(user => {
      user.pushSubscriptions.forEach(sub => {
        const promise = webpush.sendNotification(sub, notificationPayload)
          .catch(err => {
            console.error(`Erreur d'envoi de notif à ${sub.endpoint}:`, err.statusCode);
            // Si l'abonnement est expiré (410 Gone), on pourrait le supprimer de la DB ici.
          });
        sendPromises.push(promise);
      });
    });

    await Promise.all(sendPromises);
    console.log('Notifications push envoyées.');

  } catch (error) {
    console.error("Erreur dans sendPushNotification:", error);
  }
};