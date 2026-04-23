process.on('uncaughtException', (err) => {
    console.error('\n🚨 NEOŠETŘENÁ KRITICKÁ CHYBA SERVERU:');
    console.error('Typ chyby:', err.name);
    console.error('Zpráva:', err.message);
    console.error('Stack Trace:\n', err.stack);
    console.error('----------------------------------------\n');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n🚨 NEOŠETŘENÝ PROMISE REJECTION:');
    console.error('Důvod:', reason);
    console.error('Promise:', promise);
    if (reason && reason.stack) {
        console.error('Stack Trace:\n', reason.stack);
    }
    console.error('----------------------------------------\n');
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());

// --- NASTAVENÍ STATICKÝCH SOUBORŮ (DŮLEŽITÉ) ---
// Server bude hledat soubory (index.html, app.js atd.) ve složce 'public'
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// --- Načtení externích modulů ---
let DomainManager;
let gameHelper = {};
try {
    // Předpokládáme, že tyto soubory jsou ve stejné složce jako server.js
    DomainManager = require('./domainManager.js');
    gameHelper = require('./gameHelper.js') || {};
    console.log('✅ Manažeři a helpery úspěšně načteny.');
} catch (err) {
    console.error('🚨 CHYBA PŘI NAČÍTÁNÍ HELPERŮ (zkontroluj soubory domainManager.js a gameHelper.js)!');
    console.error(err.message);
}

const generateMap = gameHelper.generateMap || ((w, h) => ({ obstacles: [], breakables: [] }));

// --- HERNÍ PROMĚNNÉ ---
const rooms = {};
const TICK_RATE = 16; // cca 60 FPS
const PORT = process.env.PORT || 3000;

// --- SOCKET.IO LOGIKA ---
io.on('connection', (socket) => {
    console.log(`👤 Nové připojení: ${socket.id}`);

    // Vytvoření místnosti
    socket.on('createRoom', (data) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        const mapData = generateMap(1920, 1080);
        
        rooms[roomId] = {
            id: roomId,
            players: {},
            gameState: 'LOBBY',
            obstacles: mapData.obstacles,
            breakables: mapData.breakables,
            settings: { maxRounds: 25, gameMode: 'FFA' },
            teamScores: { red: 0, blue: 0 }
        };

        joinPlayerToRoom(socket, roomId, data);
        socket.emit('roomCreated', { roomId });
    });

    // Připojení do místnosti
    socket.on('joinRoom', (data) => {
        const roomId = data.roomId?.toUpperCase();
        if (rooms[roomId]) {
            joinPlayerToRoom(socket, roomId, data);
            socket.emit('roomJoined', { roomId });
        } else {
            socket.emit('error', 'Místnost neexistuje.');
        }
    });

    // Hráč je připraven
    socket.on('playerReady', () => {
        const roomId = socket.roomId;
        if (!rooms[roomId]) return;

        const player = rooms[roomId].players[socket.id];
        if (player) {
            player.isReady = !player.isReady;
            io.to(roomId).emit('updatePlayerList', Object.values(rooms[roomId].players));

            // Start hry pokud jsou všichni ready
            const allReady = Object.values(rooms[roomId].players).every(p => p.isReady);
            if (allReady && Object.keys(rooms[roomId].players).length >= 1) {
                startGame(roomId);
            }
        }
    });

    // Odpojení
    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            delete rooms[roomId].players[socket.id];
            io.to(roomId).emit('updatePlayerList', Object.values(rooms[roomId].players));
            if (Object.keys(rooms[roomId].players).length === 0) {
                delete rooms[roomId];
            }
        }
        console.log(`👋 Odpojeno: ${socket.id}`);
    });
});

// Pomocná funkce pro přidání hráče
function joinPlayerToRoom(socket, roomId, data) {
    socket.join(roomId);
    socket.roomId = roomId;
    
    rooms[roomId].players[socket.id] = {
        id: socket.id,
        name: data.name || 'Hráč',
        color: data.color || '#45f3ff',
        x: 100 + Math.random() * 500,
        y: 100 + Math.random() * 500,
        hp: 100,
        maxHp: 100,
        ammo: 10,
        maxAmmo: 10,
        isReady: false,
        score: 0
    };

    io.to(roomId).emit('updatePlayerList', Object.values(rooms[roomId].players));
}

// Start hry
function startGame(roomId) {
    const room = rooms[roomId];
    room.gameState = 'PLAYING';
    io.to(roomId).emit('gameStateChanged', { 
        state: 'PLAYING', 
        obstacles: room.obstacles, 
        breakables: room.breakables 
    });
}

// --- HLAVNÍ HERNÍ SMYČKA ---
setInterval(() => {
    Object.keys(rooms).forEach(roomId => {
        const room = rooms[roomId];
        if (room.gameState !== 'PLAYING') return;

        // Tady probíhá fyzika, update domén atd.
        if (DomainManager && DomainManager.updateDomains) {
            const playersArray = Object.values(room.players);
            DomainManager.updateDomains(room.players, playersArray, [], TICK_RATE);
        }

        // Příprava dat pro klienty (ořezání nepotřebných věcí pro snížení lagů)
        const leanPlayers = {};
        for (const id in room.players) {
            const p = room.players[id];
            leanPlayers[id] = {
                name: p.name, color: p.color,
                x: Number((p.x || 0).toFixed(2)),
                y: Number((p.y || 0).toFixed(2)),
                hp: Math.round(p.hp),
                maxHp: p.maxHp,
                ammo: p.ammo, 
                maxAmmo: p.maxAmmo,
                score: p.score
            };
        }

        io.to(room.id).volatile.emit('gameUpdate', {
            players: leanPlayers,
            gameState: room.gameState
        });
    });
}, TICK_RATE);

// Start serveru
server.listen(PORT, () => {
    console.log(`
🚀 SERVER ÚSPĚŠNĚ NASTARTOVÁN
----------------------------------------
Port:    ${PORT}
Režim:   Vanilla JS (Static)
Složka:  ${path.join(__dirname, 'public')}
----------------------------------------
    `);
});