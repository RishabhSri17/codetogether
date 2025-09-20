import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import roomRoutes from './routes/roomRoutes.js';
import socketServer from './socket.js';

dotenv.config();

const app = express();

// ✅ Manual CORS fallback (must be first for Vercel)
/* app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://codetogether-frontend.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
}); */

// ✅ Debug CORS middleware with allowed origins (useful locally or if deployed on custom server)
const allowedOrigins = [
  'http://localhost:3000',
  'https://codetogether-frontend.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    console.log('[CORS] Request Origin:', origin);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked Origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// ✅ Body parser
app.use(express.json());
console.log('[Express] JSON body parsing enabled');

// ✅ API routes
app.get('/', (req, res) => {
  res.json('Welcome to CodeTogether API');
  console.log('[Express] Root route accessed');
});

app.use('/api/rooms', roomRoutes);
console.log('[Express] /api/rooms route registered');

// ✅ Create HTTP server
const server = http.createServer(app);

// ✅ Socket.io with CORS config
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});
console.log('[Socket.IO] Initialized with CORS');

// ✅ Socket server logic
socketServer(io);
console.log('[Socket.IO] Custom socket logic loaded');

// ✅ MongoDB connection and server startup
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('[MongoDB] Connected successfully');
    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
  });
