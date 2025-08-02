import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { Server } from 'socket.io'; // Ajout de l'import
import http from 'http'; // Ajout de l'import

dotenv.config();
import connectDB from './config/db.js';

// ... (imports des routes)
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import configRoutes from './routes/configRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import promotionRoutes from './routes/promotionRoutes.js';

const port = process.env.PORT || 5000;

connectDB();

const app = express();

// Création du serveur HTTP et du serveur Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Pour le développement. En production, vous devriez restreindre ceci.
    methods: ['GET', 'POST'],
  },
});

// Middleware pour passer 'io' aux routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ... (routes de l'API)
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/config', configRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/promotions', promotionRoutes);

// Logique de connexion Socket.IO
io.on('connection', (socket) => {
  console.log('Un client est connecté:', socket.id);

  socket.on('joinRoom', (userId) => {
    socket.join(userId);
    console.log(`L'utilisateur ${userId} a rejoint sa room`);
  });

  socket.on('disconnect', () => {
    console.log('Un client est déconnecté:', socket.id);
  });
});


// Route de base
app.get('/', (req, res) => {
  res.send('L\'API GTY Express est en cours d\'exécution...');
});

// On utilise 'server.listen' au lieu de 'app.listen'
server.listen(port, () =>
  console.log(`Le serveur tourne en mode ${process.env.NODE_ENV} sur le port ${port}`)
);