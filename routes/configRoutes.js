import express from 'express';
const router = express.Router();

// @desc    Get PayPal client ID
// @route   GET /api/config/paypal
// @access  Public
router.get('/paypal', (req, res) => {
  res.send({ clientId: process.env.PAYPAL_CLIENT_ID });
});

export default router;