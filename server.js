import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js'; // Nous créerons ce fichier juste après

// Import des routes
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';

// Configuration initiale
dotenv.config();
connectDB(); // Connexion à la base de données
const app = express();

// Middlewares
app.use(cors());
app.use(express.json()); // Pour parser le JSON des requêtes

// Routes principales
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Utilisation des routes
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);


// Lancement du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, console.log(`Server running on port ${PORT}`));
