/**
 * Tetris Battle - Online Server
 * Node.js + Socket.io server for multiplayer
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Game rooms
const rooms = new Map();

// Generate room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Socket.io
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Create room
    socket.on('createRoom', (data, callback) => {
        let code;
        do {
            code = generateRoomCode();
        } while (rooms.has(code));

        const room = {
            code,
            host: socket.id,
            guest: null,
            gameStarted: false
        };

        rooms.set(code, room);
        socket.join(code);

        console.log(`Room created: ${code}`);
        callback({ code });
    });

    // Join room
    socket.on('joinRoom', (code, callback) => {
        const room = rooms.get(code.toUpperCase());

        if (!room) {
            callback({ error: 'Phòng không tồn tại' });
            return;
        }

        if (room.guest) {
            callback({ error: 'Phòng đã đầy' });
            return;
        }

        room.guest = socket.id;
        room.gameStarted = true;
        socket.join(code);

        // Notify host
        io.to(room.host).emit('playerJoined', { guestId: socket.id });

        console.log(`Player joined room: ${code}`);
        callback({ success: true });
    });

    // Board update
    socket.on('boardUpdate', (data) => {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        // Send to opponent
        socket.to(data.roomCode).emit('opponentUpdate', {
            board: data.board,
            score: data.score,
            lines: data.lines,
            level: data.level
        });
    });

    // Attack (send garbage)
    socket.on('attack', (data) => {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        socket.to(data.roomCode).emit('garbageReceived', {
            lines: data.lines
        });
    });

    // Game over
    socket.on('gameOver', (data) => {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        socket.to(data.roomCode).emit('opponentGameOver');
    });

    // New game request
    socket.on('requestNewGame', (data) => {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        io.to(data.roomCode).emit('gameReset');
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        for (const [code, room] of rooms.entries()) {
            if (room.host === socket.id) {
                if (room.guest) {
                    io.to(room.guest).emit('opponentLeft');
                }
                rooms.delete(code);
            } else if (room.guest === socket.id) {
                room.guest = null;
                room.gameStarted = false;
                io.to(room.host).emit('opponentLeft');
            }
        }
    });
});

// Cleanup old rooms
setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
        if (!room.guest && now - (room.createdAt || now) > 30 * 60 * 1000) {
            rooms.delete(code);
        }
    }
}, 5 * 60 * 1000);

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║       ⬢ TETRIS BATTLE ONLINE SERVER        ║
╠════════════════════════════════════════════╣
║  Server running at:                        ║
║  → http://localhost:${PORT}                    ║
╚════════════════════════════════════════════╝
    `);
});
