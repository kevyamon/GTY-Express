import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
dotenv.config();
import connectDB from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import configRoutes from './routes/configRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import promotionRoutes from './routes/promotionRoutes.js';

const port = process.env.PORT || 5000;

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Les routes de l'API
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/config', configRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/promotions', promotionRoutes);

// Route de base pour vérifier que l'API est en ligne
app.get('/', (req, res) => {
  res.send('API is running....');
});

app.listen(port, () =>
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${port}`)
);