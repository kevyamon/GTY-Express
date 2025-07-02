import path from 'path'; // Importer path
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';

import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js'; // Importer la nouvelle route

dotenv.config();
connectDB();
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes); // Utiliser la nouvelle route

const __dirname = path.resolve(); // Rendre __dirname disponible
app.use('/uploads', express.static(path.join(__dirname, '/uploads'))); // Rendre le dossier 'uploads' statique

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
