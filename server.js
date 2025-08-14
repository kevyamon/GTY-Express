import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';

dotenv.config();
import connectDB from './config/db.js';
// --- NOUVEL IMPORT POUR LE GESTIONNAIRE D'ERREURS ---
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import configRoutes from './routes/configRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import promotionRoutes from './routes/promotionRoutes.js';
import promoBannerRoutes from './routes/promoBannerRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';

const port = process.env.PORT || 5000;

connectDB();

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://gty-express-frontend.onrender.com',
  credentials: true,
};
app.use(cors(corsOptions));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'https://gty-express-frontend.onrender.com',
    methods: ['GET', 'POST'],
  },
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/config', configRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/promobanner', promoBannerRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/complaints', complaintRoutes);

io.on('connection', (socket) => {
  console.log('Un client est connecté:', socket.id);

  socket.on('joinRoom', (room) => {
    socket.join(room);
    console.log(`Un utilisateur a rejoint la room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Un client est déconnecté:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('L\'API GTY Express est en cours d\'exécution...');
});

// --- AJOUT DU GESTIONNAIRE D'ERREURS ---
// Doit être après toutes les routes de l'API
app.use(notFound);
app.use(errorHandler);
// --- FIN DE L'AJOUT ---

server.listen(port, () =>
  console.log(`Le serveur tourne en mode ${process.env.NODE_ENV} sur le port ${port}`)
);