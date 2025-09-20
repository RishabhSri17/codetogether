const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { PORT, MONGODB_URI, CLIENT_URL } = require('./config');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: CLIENT_URL,
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors({
    origin: CLIENT_URL,
    credentials: true
}));
app.use(express.json());

// ...existing route handlers and socket logic...

mongoose.connect(MONGODB_URI)
    .then(() => {
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => console.error('MongoDB connection error:', err));