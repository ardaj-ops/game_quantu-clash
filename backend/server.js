process.on('uncaughtException', (err) => {
    console.error('\n🚨 NEOŠETŘENÁ KRITICKÁ CHYBA SERVERU:');
    console.error('Zpráva:', err.message);
    console.error('Stack Trace:\n', err.stack);
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

// --- KLÍČOVÉ PRO VANILLA JS: Servírování složky public ---
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// --- Načtení externích modulů ---
let DomainManager;
let gameHelper = {};
try {
    DomainManager = require('./domainManager.js');
    gameHelper = require('./gameHelper.js') || {};
    console.log('✅ Logické moduly úspěšně načteny.');
} catch (err) {
    console.error('🚨 CHYBA NAČÍTÁNÍ MODULŮ:', err.message);
}

// --- HERNÍ KONSTANTY ---
const TICK_RATE = 16; 
const MAP_WIDTH = 1920;
const MAP_HEIGHT = 1080;
const rooms = {};

// --- POMOCNÉ FUNKCE ---
const generateMap = gameHelper.generateMap || ((w, h) => ({ obstacles: [], breakables: [] }));

// --- SOCKET.IO LOGIKA ---
io.on('connection', (socket) => {
    console.log(`👤 Připojen hráč: ${socket.id}`);

    socket.on('createRoom', (data) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        const mapData = generateMap(MAP_WIDTH, MAP_HEIGHT);
        
        rooms[roomId] = {
            id: roomId,
            players: {},
            projectiles: [],
            gameState: 'LOBBY',
            obstacles: mapData.obstacles,
            breakables: mapData.breakables,
            settings: { maxRounds: 25, gameMode: 'FFA' },
            teamScores: { red: 0, blue: 0 }
        };

        handleJoin(socket, roomId, data);
        socket.emit('roomCreated', { roomId });
    });

    socket.on('joinRoom', (data) => {
        const roomId = data.roomId?.toUpperCase();
        if (rooms[roomId]) {
            handleJoin(socket, roomId, data);
            socket.emit('roomJoined', { roomId });
        } else {
            socket.emit('error', 'Místnost neexistuje.');
        }
    });

    // POHYB A AKCE
    socket.on('playerInput', (input) => {
        const room = rooms[socket.roomId];
        if (!room || room.gameState !== 'PLAYING') return;
        const player = room.players[socket.id];
        if (!player || player.hp <= 0) return;

        // Výpočet pohybu
        const speed = player.moveSpeed || 4;
        let dx = 0, dy = 0;
        if (input.up) dy -= speed;
        if (input.down) dy += speed;
        if (input.left) dx -= speed;
        if (input.right) dx += speed;

        // Aplikace pohybu s jednoduchou kolizí s okrajem mapy
        player.x = Math.max(20, Math.min(MAP_WIDTH - 20, player.x + dx));
        player.y = Math.max(20, Math.min(MAP_HEIGHT - 20, player.y + dy));
        player.aimAngle = input.angle || 0;

        // Střelba
        if (input.shooting && player.ammo > 0 && !player.isReloading) {
            const now = Date.now();
            if (now - (player.lastShot || 0) > (1000 / (player.fireRate || 5))) {
                fireProjectile(room, player);
                player.lastShot = now;
            }
        }
    });

    socket.on('playerReady', () => {
        const room = rooms[socket.roomId];
        if (!room) return;
        const p = room.players[socket.id];
        if (p) {
            p.isReady = !p.isReady;
            io.to(room.id).emit('updatePlayerList', Object.values(room.players));
            
            const allReady = Object.values(room.players).every(player => player.isReady);
            if (allReady && Object.keys(room.players).length >= 1) {
                room.gameState = 'PLAYING';
                io.to(room.id).emit('gameStateChanged', { 
                    state: 'PLAYING', 
                    obstacles: room.obstacles, 
                    breakables: room.breakables 
                });
            }
        }
    });

    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (rooms[roomId]) {
            delete rooms[roomId].players[socket.id];
            io.to(roomId).emit('updatePlayerList', Object.values(rooms[roomId].players));
            if (Object.keys(rooms[roomId].players).length === 0) delete rooms[roomId];
        }
    });
});

function handleJoin(socket, roomId, data) {
    socket.join(roomId);
    socket.roomId = roomId;
    rooms[roomId].players[socket.id] = {
        id: socket.id,
        name: data.name || 'Hráč',
        color: data.color || '#45f3ff',
        x: Math.random() * 800 + 100,
        y: Math.random() * 600 + 100,
        hp: 100, maxHp: 100,
        ammo: 10, maxAmmo: 10,
        moveSpeed: 5, fireRate: 6,
        isReady: false, score: 0
    };
    io.to(roomId).emit('updatePlayerList', Object.values(rooms[roomId].players));
}

function fireProjectile(room, player) {
    player.ammo--;
    const angle = player.aimAngle;
    room.projectiles.push({
        id: Math.random().toString(36).substr(2, 9),
        ownerId: player.id,
        x: player.x + Math.cos(angle) * 30,
        y: player.y + Math.sin(angle) * 30,
        vx: Math.cos(angle) * 12,
        vy: Math.sin(angle) * 12,
        damage: 15,
        life: 100
    });
}

// --- HLAVNÍ SMYČKA (Fyzika a kolize) ---
setInterval(() => {
    Object.keys(rooms).forEach(roomId => {
        const room = rooms[roomId];
        if (room.gameState !== 'PLAYING') return;

        // Update domén přes tvůj DomainManager
        if (DomainManager && DomainManager.updateDomains) {
            DomainManager.updateDomains(room.players, Object.values(room.players), room.projectiles, TICK_RATE);
        }

        // Update projektilů a kolize
        for (let i = room.projectiles.length - 1; i >= 0; i--) {
            const proj = room.projectiles[i];
            proj.x += proj.vx;
            proj.y += proj.vy;
            proj.life--;

            if (proj.life <= 0) {
                room.projectiles.splice(i, 1);
                continue;
            }

            // Kolize s hráči
            for (const pId in room.players) {
                const target = room.players[pId];
                if (target.id === proj.ownerId || target.hp <= 0) continue;

                const dist = Math.hypot(proj.x - target.x, proj.y - target.y);
                if (dist < 25) { // Rádius hráče
                    target.hp -= proj.damage;
                    room.projectiles.splice(i, 1);
                    if (target.hp <= 0) room.players[proj.ownerId].score++;
                    break;
                }
            }
        }

        // Odeslání stavu klientům
        const leanPlayers = {};
        for (const id in room.players) {
            const p = room.players[id];
            leanPlayers[id] = {
                id: p.id, x: p.x, y: p.y, hp: p.hp, name: p.name, 
                color: p.color, ammo: p.ammo, score: p.score, angle: p.aimAngle
            };
        }

        io.to(roomId).volatile.emit('gameUpdate', {
            players: leanPlayers,
            projectiles: room.projectiles,
            gameState: room.gameState
        });
    });
}, TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server Quantum Clash běží na portu ${PORT}`);
});