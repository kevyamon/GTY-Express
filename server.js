import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';

dotenv.config();
import connectDB from './config/db.js';

// On importe toutes nos routes
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import configRoutes from './routes/configRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import promotionRoutes from './routes/promotionRoutes.js';
import promoBannerRoutes from './routes/promoBannerRoutes.js';
import messageRoutes from './routes/messageRoutes.js'; // NOUVEL IMPORT

const port = process.env.PORT || 5000;

connectDB();

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middlewares
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
app.use('/api/promobanner', promoBannerRoutes);
app.use('/api/messages', messageRoutes); // NOUVELLE ROUTE

// Logique de connexion Socket.IO
io.on('connection', (socket) => {
  console.log('Un client est connecté:', socket.id);
  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(userId);
    console.log(`L'utilisateur ${userId} a rejoint sa room`);
  }

  socket.on('disconnect', () => {
    console.log('Un client est déconnecté:', socket.id);
  });
});

// Route de base pour vérifier que l'API est en ligne
app.get('/', (req, res) => {
  res.send('L\'API GTY Express est en cours d\'exécution...');
});

server.listen(port, () =>
  console.log(`Le serveur tourne en mode ${process.env.NODE_ENV} sur le port ${port}`)
);