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
app.use(cors());
app.use(express.json());

app.use('/api/rooms', roomRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: 'https://codetogether-frontend.vercel.app' }
});

socketServer(io);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error(err));
