import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';

import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';

dotenv.config();
connectDB();
const app = express();

// --- NOUVELLE CONFIGURATION CORS ---
// On définit l'URL exacte de notre frontend
const allowedOrigins = ['https://gty-express-frontend.onrender.com'];

const corsOptions = {
  origin: (origin, callback) => {
    // On autorise si l'origine de la requête est dans notre liste
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
};
app.use(cors(corsOptions));
// --- FIN DE LA NOUVELLE CONFIGURATION ---

app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
