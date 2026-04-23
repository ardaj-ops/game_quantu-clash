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

// --- OPRAVA: Nastavení statických souborů ---
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- FUNKCE PRO NAČÍTÁNÍ SDÍLENÉHO KÓDU (CONFIG / CARDS) ---
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
                
                // Odstranění ES6 exportů pro Node.js
                const sanitized = raw
                    .replace(/^\s*export\s+const\s+/gm, 'const ')
                    .replace(/^\s*export\s+let\s+/gm, 'let ')
                    .replace(/^\s*export\s+var\s+/gm, 'var ')
                    .replace(/^\s*export\s+function\s+/gm, 'function ')
                    .replace(/^\s*export\s+class\s+/gm, 'class ')
                    .replace(/^\s*export\s+default\s+/gm, '')
                    .replace(/^\s*export\s*\{([^}]*)\}\s*;?\s*$/gm, '')
                    .replace(/^\s*import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '');

                const sandbox = {};
                eval(sanitized + `\nif(typeof CONFIG !== 'undefined') sandbox.data = CONFIG;\nif(typeof availableCards !== 'undefined') sandbox.data = availableCards;\nif(typeof CARDS !== 'undefined') sandbox.data = CARDS;`);
                
                console.log(`✅ Soubor ${fileName} načten z: ${p}`);
                return sandbox.data || {};
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

// --- POMOCNÉ FUNKCE (Kolize, Reset) ---
function resetPlayer(p, team, map) {
    p.hp = p.maxHp;
    p.ammo = p.maxAmmo;
    p.isReloading = false;
    p.isInvisible = false;
    p.domainActive = false;
    if (p.domainManager) p.domainManager.active = false;

    // Spawn body podle týmu
    if (team === 'blue') {
        p.x = 100 + Math.random() * 200;
        p.y = CONFIG.MAP_HEIGHT / 2;
    } else {
        p.x = CONFIG.MAP_WIDTH - 300 + Math.random() * 200;
        p.y = CONFIG.MAP_HEIGHT / 2;
    }
}

function checkCollision(obj1, r1, obj2, r2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    return Math.sqrt(dx*dx + dy*dy) < (r1 + r2);
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
            bullets: [],
            gameState: 'LOBBY',
            map: map,
            teamScores: { blue: 0, red: 0 },
            settings: { maxRounds: CONFIG.MAX_SCORE, gameMode: 'TDM' },
            lastTick: Date.now()
        };
        // 1. ZDE OPRAVA: Aktivace UI u tvůrce
        socket.emit('roomCreated', { roomId }); 
        joinRoom(socket, roomId, data);
    });

    socket.on('joinRoom', (data) => {
        const roomId = (data.roomId || "").toUpperCase();
        if (rooms[roomId]) {
            // 2. ZDE OPRAVA: Aktivace UI u hosta
            socket.emit('roomJoined', { roomId }); 
            joinRoom(socket, roomId, data);
        }
        else socket.emit('errorMsg', 'Místnost neexistuje.'); // Lepší handling chyby
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
        
        // 3. ZDE OPRAVA: Odesíláme všem kompletní listinu, aby se jména ukázala v lobby
        io.to(roomId).emit('updatePlayerList', Object.values(room.players));
        io.to(roomId).emit('mapUpdate', room.map);
    }

    socket.on('playerReady', () => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        
        // Přepínání stavu připravenosti (aby hráč mohl vzít Ready zpět)
        room.players[socket.id].isReady = !room.players[socket.id].isReady; 
        io.to(room.id).emit('updatePlayerList', Object.values(room.players));

        const allReady = Object.values(room.players).every(p => p.isReady);
        if (allReady && Object.keys(room.players).length >= 1) { // Upraveno pro testování s 1 hráčem
            room.gameState = 'PLAYING';
            io.to(room.id).emit('gameStateChanged', { state: 'PLAYING', obstacles: room.map.obstacles, breakables: room.map.breakables });
        }
    });

    socket.on('playerInput', (input) => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        room.players[socket.id].lastInput = input;
    });

    socket.on('disconnect', () => {
        const room = rooms[socket.roomId];
        if (room) {
            delete room.players[socket.id];
            // Odeslání nového listu hráčů, když někdo odejde
            io.to(socket.roomId).emit('updatePlayerList', Object.values(room.players));
            if (Object.keys(room.players).length === 0) delete rooms[socket.roomId];
        }
    });
});

// --- HLAVNÍ HERNÍ SMYČKA ---
setInterval(() => {
    Object.values(rooms).forEach(room => {
        if (room.gameState !== 'PLAYING') return;

        const now = Date.now();
        const deltaTime = now - room.lastTick;
        room.lastTick = now;

        // 1. POHYB HRÁČŮ A STŘELBA
        Object.values(room.players).forEach(p => {
            if (p.hp <= 0 || !p.lastInput) return;

            const input = p.lastInput;
            let speed = p.moveSpeed * deltaTime;
            if (input.up) p.y -= speed;
            if (input.down) p.y += speed;
            if (input.left) p.x -= speed;
            if (input.right) p.x += speed;

            // Střelba
            if (input.click && p.ammo > 0 && !p.isReloading) {
                const lastShot = p.lastShotTime || 0;
                if (now - lastShot > p.fireRate) {
                    p.ammo--;
                    p.lastShotTime = now;
                    const bX = p.x + Math.cos(input.aimAngle) * 30;
                    const bY = p.y + Math.sin(input.aimAngle) * 30;
                    
                    room.bullets.push({
                        ownerId: p.id, team: p.team,
                        x: bX, y: bY,
                        vx: Math.cos(input.aimAngle) * p.bulletSpeed,
                        vy: Math.sin(input.aimAngle) * p.bulletSpeed,
                        damage: p.damage, bounces: p.bounces, pierce: p.pierce
                    });
                }
            }
        });

        // 2. UPDATE STŘEL
        for (let i = room.bullets.length - 1; i >= 0; i--) {
            const b = room.bullets[i];
            b.x += b.vx;
            b.y += b.vy;

            // Hranice mapy
            if (b.x < 0 || b.x > CONFIG.MAP_WIDTH || b.y < 0 || b.y > CONFIG.MAP_HEIGHT) {
                room.bullets.splice(i, 1);
                continue;
            }

            // Kolize s hráči
            let hitPlayer = false;
            Object.values(room.players).forEach(target => {
                if (target.hp > 0 && target.team !== b.team && checkCollision(b, 5, target, CONFIG.PLAYER_RADIUS)) {
                    target.hp -= b.damage;
                    const owner = room.players[b.ownerId];
                    if (owner && owner.lifesteal > 0) owner.hp = Math.min(owner.maxHp, owner.hp + (b.damage * owner.lifesteal));
                    
                    if (target.hp <= 0) {
                        if (owner) owner.score++;
                        room.teamScores[b.team]++;
                        setTimeout(() => resetPlayer(target, target.team, room.map), CONFIG.RESPAWN_TIME);
                    }
                    hitPlayer = true;
                }
            });

            if (hitPlayer) {
                room.bullets.splice(i, 1);
                continue;
            }
        }

        // 3. ODESLÁNÍ DAT
        const leanPlayers = {};
        Object.values(room.players).forEach(p => {
            leanPlayers[p.id] = {
                id: p.id, name: p.name, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp,
                ammo: p.ammo, maxAmmo: p.maxAmmo, color: p.color, team: p.team,
                score: p.score, aimAngle: p.lastInput?.aimAngle || 0
            };
        });

        io.to(room.id).volatile.emit('gameUpdate', {
            players: leanPlayers,
            bullets: room.bullets,
            teamScores: room.teamScores,
            gameState: room.gameState
        });
    });
}, TICK_RATE);

server.listen(PORT, () => {
    console.log(`\n🚀 SERVER QUANTUM CLASH BĚŽÍ NA PORTU ${PORT}`);
    console.log(`----------------------------------------`);
});