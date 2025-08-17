import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { execSync } from 'child_process';

dotenv.config();
import connectDB from './config/db.js';
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
import warningRoutes from './routes/warningRoutes.js';
import suggestionRoutes from './routes/suggestionRoutes.js';
import globalMessageRoutes from './routes/globalMessageRoutes.js';

const serverStartTime = new Date();
const port = process.env.PORT || 5000;

connectDB();

const app = express();

app.set('trust proxy', 1);

// --- MODIFICATION : On autorise maintenant le localhost en plus du site de production ---
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'https://gty-express-frontend.onrender.com',
    'http://localhost:5173', // Port par défaut de Vite
    'http://localhost:3000'  // Autre port courant pour le développement
  ],
  credentials: true,
};
app.use(cors(corsOptions));
// --- FIN DE LA MODIFICATION ---


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [ // On met à jour ici aussi pour Socket.IO
      process.env.FRONTEND_URL || 'https://gty-express-frontend.onrender.com',
      'http://localhost:5173',
      'http://localhost:3000'
    ],
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
app.use('/api/warnings', warningRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/global-messages', globalMessageRoutes);


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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getGitCommitHash = () => {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch (e) {
    console.error('Impossible de récupérer le hash du commit git:', e);
    return 'unknown';
  }
};

app.get('/api/version', async (req, res) => {
  try {
    const packageJsonPath = path.resolve(process.cwd(), 'package.json');
    const packageJsonData = await fs.readFile(packageJsonPath, 'utf8');
    const { version } = JSON.parse(packageJsonData);
    const commitHash = getGitCommitHash();
    res.json({ version, commitHash });
  } catch (error) {
    console.error("Erreur de lecture de la version:", error);
    res.status(500).json({ message: "Impossible de lire la version de l'application" });
  }
});

app.get('/', (req, res) => {
  res.send("L'API GTY Express est en cours d'exécution...");
});

app.get('/ping', (req, res) => {
  res.status(200).json({ message: 'pong' });
});

app.use(notFound);
app.use(errorHandler);

server.listen(port, () =>
  console.log(`Le serveur tourne en mode ${process.env.NODE_ENV} sur le port ${port}`)
);