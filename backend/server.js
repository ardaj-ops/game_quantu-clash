// server.js
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

// --- Bezpečné načtení externích modulů ---
let DomainManager;
let gameHelper = {};
try {
    DomainManager = require('./domainManager.js');
    gameHelper = require('./gameHelper.js') || {};
    console.log('✅ Manažeři a helpery úspěšně načteny.');
} catch (err) {
    console.error('🚨 CHYBA PŘI NAČÍTÁNÍ HELPERŮ! (Ujisti se, že domainManager.js a gameHelper.js jsou v rootu)');
    console.error(err.stack);
    process.exit(1);
}

const generateMap = gameHelper.generateMap || (() => ({ obstacles: [], breakables: [] }));

const app = express();
app.use(cors());

// Nastavení statických souborů
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- FUNKCE PRO NAČÍTÁNÍ SDÍLENÉHO KÓDU (BEZPEČNÁ VERZE) ---
const loadSharedFile = (fileName) => {
    const pathsToTry = [
        path.join(__dirname, 'public', fileName),
        path.join(__dirname, 'public', 'game', fileName),
        path.join(__dirname, fileName)
    ];

    for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
            try {
                let raw = fs.readFileSync(p, 'utf-8');
                
                const sanitized = raw
                    .replace(/^\s*export\s+const\s+/gm, 'var ')
                    .replace(/^\s*export\s+let\s+/gm, 'var ')
                    .replace(/^\s*export\s+var\s+/gm, 'var ')
                    .replace(/^\s*export\s+function\s+/gm, 'function ')
                    .replace(/^\s*export\s+class\s+/gm, 'class ')
                    .replace(/^\s*export\s+default\s+/gm, '')
                    .replace(/^\s*export\s*\{([^}]*)\}\s*;?\s*$/gm, '')
                    .replace(/^\s*import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '');

                const extractData = new Function(`
                    ${sanitized}
                    if (typeof CONFIG !== 'undefined') return CONFIG;
                    if (typeof availableCards !== 'undefined') return availableCards;
                    if (typeof CARDS !== 'undefined') return CARDS;
                    return {};
                `);
                
                const data = extractData();
                console.log(`✅ Soubor ${fileName} načten z: ${p}`);
                return data;

            } catch (err) { 
                console.error(`❌ Chyba při parsování ${fileName}:`, err.message); 
                return null; 
            }
        }
    }
    console.warn(`⚠️ Soubor ${fileName} nebyl nalezen!`);
    return null;
};

const gameConfig = loadSharedFile('gameConfig.js') || {};
const availableCards = loadSharedFile('cards.js') || [];

const CONFIG = {
    MAP_WIDTH: gameConfig.MAP_WIDTH || 1920,
    MAP_HEIGHT: gameConfig.MAP_HEIGHT || 1080,
    FPS: gameConfig.FPS || 60,
    MAX_SCORE: gameConfig.MAX_SCORE || 25,
    RESPAWN_TIME: gameConfig.RESPAWN_TIME || 3000,
    BASE_HP: gameConfig.BASE_HP || 100,
    BASE_MOVE_SPEED: gameConfig.BASE_MOVE_SPEED || 0.8,
    BASE_DAMAGE: gameConfig.BASE_DAMAGE || 20,
    BASE_FIRE_RATE: gameConfig.BASE_FIRE_RATE || 400,
    BASE_BULLET_SPEED: gameConfig.BASE_BULLET_SPEED || 15,
    BASE_AMMO: gameConfig.BASE_AMMO || 10,
    BASE_RELOAD_TIME: gameConfig.BASE_RELOAD_TIME || 1500,
    PLAYER_RADIUS: gameConfig.PLAYER_RADIUS || 20,
    BULLET_RADIUS: 5
};

const PORT = process.env.PORT || 3000;
const TICK_RATE = 1000 / CONFIG.FPS;
const rooms = {};

// --- POMOCNÉ FUNKCE ---
function resetPlayer(p, team, map) {
    p.hp = p.maxHp;
    p.ammo = p.maxAmmo;
    p.isReloading = false;
    p.isInvisible = false;
    p.domainActive = false;
    if (p.domainManager) p.domainManager.active = false;

    if (team === 'blue') {
        p.x = 100 + Math.random() * 200;
        p.y = CONFIG.MAP_HEIGHT / 2;
    } else {
        p.x = CONFIG.MAP_WIDTH - 300 + Math.random() * 200;
        p.y = CONFIG.MAP_HEIGHT / 2;
    }
}

// --- SOCKET LOGIKA ---
io.on('connection', (socket) => {
    console.log(`🔌 Hráč připojen: ${socket.id}`);

    socket.on('createRoom', (data) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        const map = generateMap();
        rooms[roomId] = {
            id: roomId,
            players: {},
            gameState: 'LOBBY',
            map: map,
            teamScores: { blue: 0, red: 0 },
            settings: { maxRounds: CONFIG.MAX_SCORE, gameMode: 'TDM' },
            lastTick: Date.now()
        };
        socket.emit('roomCreated', { roomId }); 
        joinRoom(socket, roomId, data);
    });

    socket.on('joinRoom', (data) => {
        const roomId = (data.roomId || "").toUpperCase();
        if (rooms[roomId]) {
            socket.emit('roomJoined', { roomId }); 
            joinRoom(socket, roomId, data);
        } else {
            socket.emit('errorMsg', 'Místnost neexistuje.');
        }
    });

    function joinRoom(socket, roomId, data) {
        const room = rooms[roomId];
        socket.join(roomId);
        socket.roomId = roomId;

        room.players[socket.id] = {
            id: socket.id,
            name: data.name || 'Hráč',
            color: data.color || '#45f3ff',
            cosmetic: data.cosmetic || 'none',
            team: Object.keys(room.players).length % 2 === 0 ? 'blue' : 'red',
            x: 0, y: 0,
            hp: CONFIG.BASE_HP, maxHp: CONFIG.BASE_HP,
            ammo: CONFIG.BASE_AMMO, maxAmmo: CONFIG.BASE_AMMO,
            moveSpeed: CONFIG.BASE_MOVE_SPEED,
            damage: CONFIG.BASE_DAMAGE,
            fireRate: CONFIG.BASE_FIRE_RATE,
            bulletSpeed: CONFIG.BASE_BULLET_SPEED,
            lifesteal: 0, bounces: 0, pierce: 0,
            score: 0, isReady: false,
            domainManager: new DomainManager()
        };

        resetPlayer(room.players[socket.id], room.players[socket.id].team, room.map);
        
        io.to(roomId).emit('updatePlayerList', Object.values(room.players));
        io.to(roomId).emit('mapUpdate', room.map);
    }

    socket.on('playerReady', () => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        
        room.players[socket.id].isReady = !room.players[socket.id].isReady; 
        io.to(room.id).emit('updatePlayerList', Object.values(room.players));

        const allReady = Object.values(room.players).every(p => p.isReady);
        if (allReady && Object.keys(room.players).length >= 1) { 
            room.gameState = 'PLAYING';
            io.to(room.id).emit('gameStateChanged', { state: 'PLAYING', obstacles: room.map.obstacles, breakables: room.map.breakables });
        }
    });

    // --- KLÍČOVÉ OPRAVY PROPOJENÍ S PHYSICS.JS ---

    // 1. Synchronizace pohybu a dat z klienta (nahrazuje starý 'playerInput')
    socket.on('clientSync', (data) => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        const p = room.players[socket.id];
        
        p.x = data.x;
        p.y = data.y;
        p.aimAngle = data.aimAngle;
        p.ammo = data.ammo; // Tímto se bude zbraň správně vyprazdňovat a přebíjet
        p.isReloading = data.isReloading;
    });

    // 2. Přijetí kulky z klienta a rozeslání ostatním (vyřeší "neviditelné" střely)
    socket.on('playerShot', (bullets) => {
        if (!socket.roomId) return;
        // Pošle pole střel všem ostatním v místnosti, takže je vykreslí
        socket.to(socket.roomId).emit('enemyShot', bullets);
    });

    // 3. Poškození (physics.js vyhodnotí kolizi a nahlásí ji sem)
    socket.on('bulletHitPlayer', (data) => {
        const room = rooms[socket.roomId];
        if (!room) return;
        
        const target = room.players[data.targetId];
        const shooter = room.players[socket.id];

        if (target && target.hp > 0) {
            target.hp -= data.damage;
            
            // Lifesteal
            if (shooter && data.lifesteal > 0) {
                shooter.hp = Math.min(shooter.maxHp, shooter.hp + (data.damage * data.lifesteal));
            }
            
            // Smrt hráče
            if (target.hp <= 0) {
                if (shooter) shooter.score++;
                room.teamScores[shooter.team]++;
                setTimeout(() => resetPlayer(target, target.team, room.map), CONFIG.RESPAWN_TIME);
            }
        }
    });

    socket.on('disconnect', () => {
        const room = rooms[socket.roomId];
        if (room) {
            delete room.players[socket.id];
            io.to(socket.roomId).emit('updatePlayerList', Object.values(room.players));
            if (Object.keys(room.players).length === 0) delete rooms[socket.roomId];
        }
    });
});

// --- HLAVNÍ HERNÍ SMYČKA ---
setInterval(() => {
    Object.values(rooms).forEach(room => {
        if (room.gameState !== 'PLAYING') return;

        // Protože se pohyb a střelba počítá přes ClientSync, 
        // smyčka má za úkol už jen balit a rozesílat čistá data o hráčích (leanPlayers).
        const leanPlayers = {};
        for (const id in room.players) {
            const p = room.players[id];
            
            leanPlayers[id] = {
                id: p.id,
                name: p.name, color: p.color, cosmetic: p.cosmetic, team: p.team,
                x: Number((p.x || 0).toFixed(2)),
                y: Number((p.y || 0).toFixed(2)),
                hp: Math.round(p.hp),
                maxHp: p.maxHp,
                aimAngle: Number((p.aimAngle || 0).toFixed(2)),
                ammo: p.ammo, maxAmmo: p.maxAmmo, // Tímto se opraví HUD ukazující správný počet nábojů
                isReloading: p.isReloading, isInvisible: p.isInvisible,
                domainActive: p.domainActive, score: p.score,
                isReady: p.isReady,
                moveSpeed: p.moveSpeed,
                damage: p.damage,
                fireRate: p.fireRate,
                bulletSpeed: p.bulletSpeed,
                bounces: p.bounces,
                pierce: p.pierce,
                lifesteal: p.lifesteal
            };
        }

        io.to(room.id).volatile.emit('gameUpdate', {
            players: leanPlayers,
            maxScore: room.settings.maxRounds,
            teamScores: room.teamScores,
            gameState: room.gameState,
            gameMode: room.settings.gameMode
        });
    });
}, TICK_RATE);

server.listen(PORT, () => {
    console.log(`\n🚀 SERVER QUANTUM CLASH BĚŽÍ NA PORTU ${PORT}`);
    console.log(`----------------------------------------`);
});