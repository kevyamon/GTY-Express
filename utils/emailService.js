import brevo from '@getbrevo/brevo';

// Configuration de l'API Brevo
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY;

// Fonction pour envoyer un email
const sendEmail = async (toEmail, toName, subject, htmlContent) => {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  sendSmtpEmail.sender = {
    name: process.env.BREVO_SENDER_NAME,
    email: process.env.BREVO_SENDER_EMAIL,
  };
  sendSmtpEmail.to = [{ email: toEmail, name: toName }];
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email envoyé avec succès. ID: ' + data.messageId);
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error.response ? error.response.body : error);
  }
};

// --- Modèle d'email pour la confirmation de commande ---
export const sendOrderConfirmationEmail = (order, user) => {
  // --- MODIFICATION : Utilisation du nouveau numéro de commande ---
  const subject = `✅ Commande confirmée #${order.orderNumber}`;
  const htmlContent = `
    <html>
      <body>
        <h1>Bonjour ${user.name}, 👋</h1>
        <p>Merci pour votre commande sur GTY Express !</p>
        <p>Nous avons bien reçu votre commande <strong>#${order.orderNumber}</strong> d'un total de <strong>${order.totalPrice.toFixed(2)} FCFA</strong>.</p>
        <p>Nous la préparons actuellement pour l'expédition. Vous pouvez suivre son statut depuis votre espace client.</p>
        <p>À très bientôt, <br>L'équipe GTY Express 🚀</p>
      </body>
    </html>
  `;
  sendEmail(user.email, user.name, subject, htmlContent);
};

// --- Modèle d'email pour le changement de statut ---
export const sendStatusUpdateEmail = (order, user) => {
  // --- MODIFICATION : Utilisation du nouveau numéro de commande ---
  const subject = `🚚 Mise à jour de votre commande #${order.orderNumber}`;
  const htmlContent = `
    <html>
      <body>
        <h1>Bonjour ${user.name},</h1>
        <p>Bonne nouvelle ! Le statut de votre commande <strong>#${order.orderNumber}</strong> a été mis à jour.</p>
        <p>Nouveau statut : <strong>${order.status}</strong> ✨</p>
        <p>Si votre commande a été expédiée, vous la recevrez très prochainement.</p>
        <p>À très bientôt, <br>L'équipe GTY Express 🚀</p>
      </body>
    </html>
  `;
  sendEmail(user.email, user.name, subject, htmlContent);
};