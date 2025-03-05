const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Serve static files from the client folder
app.use(express.static('client'));

const players = {};

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    players[socket.id] = { x: 0, y: 1, z: 0, yaw: 0 };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', { id: socket.id, ...players[socket.id] });

    socket.on('playerMove', data => {
        if (players[socket.id]) {
            players[socket.id] = data;
            socket.broadcast.emit('updatePlayer', { id: socket.id, ...data });
        }
    });

    socket.on('spellCast', data => {
        socket.broadcast.emit('spellCast', { id: socket.id, ...data });
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        socket.broadcast.emit('removePlayer', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
