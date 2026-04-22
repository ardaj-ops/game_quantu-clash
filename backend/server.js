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
    console.error('🚨 CHYBA PŘI NAČÍTÁNÍ HELPERŮ!');
    console.error(err.stack);
    process.exit(1);
}

const generateMap = gameHelper.generateMap || ((w, h) => ({ obstacles: [], breakables: [] }));
const getValidSpawnPoint = gameHelper.getValidSpawnPoint || ((index, w, h) => ({ x: w / 2, y: h / 2 }));
const generateCardsForPlayer = gameHelper.generateCardsForPlayer || ((player, cards) => []);

const applyHardCaps = (p) => {
    if (!p) return;
    p.maxHp = Math.max(MIN_CAP_HP, Math.min(MAX_CAP_HP, p.maxHp || BASE_HP));
    p.hp = Math.min(p.hp, p.maxHp);
    p.damage = Math.min(MAX_CAP_DAMAGE, p.damage || BASE_DAMAGE);
    p.fireRate = Math.max(MIN_CAP_FIRE_RATE, p.fireRate || BASE_FIRE_RATE);
    p.moveSpeed = Math.max(MIN_CAP_MOVE_SPEED, Math.min(MAX_CAP_MOVE_SPEED, p.moveSpeed || BASE_MOVE_SPEED));
    p.bulletSpeed = Math.min(MAX_CAP_BULLET_SPEED, p.bulletSpeed || BASE_BULLET_SPEED);
    p.maxAmmo = Math.min(MAX_CAP_AMMO, p.maxAmmo || BASE_AMMO);
};

const resetPlayerStatsToBase = (p) => {
    if (!p) return;
    Object.assign(p, {
        maxHp: BASE_HP, hp: BASE_HP,
        damage: BASE_DAMAGE, fireRate: BASE_FIRE_RATE,
        bulletSpeed: BASE_BULLET_SPEED, moveSpeed: BASE_MOVE_SPEED,
        maxAmmo: BASE_AMMO, ammo: BASE_AMMO,
        reloadTime: BASE_RELOAD_TIME, isReloading: false, multishot: 1,
        spread: 0.1, bounces: 0, pierce: 0, lifesteal: 0,
        cards: [], domainType: undefined, domainActive: false,
        domainTimer: 0, domainCooldown: 0, isJackpotActive: false,
        inputs: { up: false, down: false, left: false, right: false, click: false, rightClick: false, aimAngle: 0, reload: false, dash: false }
    });
};

const createPlayerTemplate = (playerName, playerColor, playerTeam, playerCosmetic, isHost = false) => ({
    x: 0, y: 0, aimAngle: 0,
    hp: BASE_HP, maxHp: BASE_HP, damage: BASE_DAMAGE, fireRate: BASE_FIRE_RATE,
    bulletSpeed: BASE_BULLET_SPEED, moveSpeed: BASE_MOVE_SPEED,
    maxAmmo: BASE_AMMO, ammo: BASE_AMMO,
    name: String(playerName || "Hráč").substring(0, 15),
    color: String(playerColor || "#ff4757").substring(0, 7),
    cosmetic: playerCosmetic || "none", team: playerTeam || "none", score: 0,
    isReady: false, isReloading: false, isInvisible: false, isHost: isHost,
    cards: [],
    inputs: { up: false, down: false, left: false, right: false, click: false, rightClick: false, aimAngle: 0, reload: false, dash: false },
    domainType: undefined, domainActive: false, domainTimer: 0, domainCooldown: 0, isJackpotActive: false
});

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

const allowedOrigins = ["https://quantum-clash-gq1w.onrender.com", "http://localhost:5173", "http://localhost:3000"];
app.use(cors({ origin: allowedOrigins, methods: ["GET", "POST", "OPTIONS"] }));

const io = new Server(server, { cors: { origin: allowedOrigins, methods: ["GET", "POST", "OPTIONS"], credentials: true } });

const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
const frontendPublicPath = path.join(__dirname, '..', 'frontend', 'public');
const staticPath = fs.existsSync(frontendDistPath) ? frontendDistPath : frontendPublicPath;

app.use(express.static(staticPath));
app.get('/', (req, res) => {
    const indexPath = path.join(staticPath, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.send("🚀 Backend běží!");
});

const loadSharedFile = (fileName, windowMock = undefined) => {
    const pathsToTry = [
        path.join(__dirname, '..', 'frontend', 'src', 'game', fileName),
        path.join(frontendDistPath, fileName),
        path.join(frontendPublicPath, fileName),
        path.join(__dirname, 'public', fileName),
        path.join(__dirname, fileName)
    ];

    for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
            try {
                const raw = fs.readFileSync(p, 'utf-8');
                const sanitized = raw
                    .replace(/^\s*export\s+default\s+/gm, 'module.exports = ')
                    .replace(/^\s*export\s*\{([^}]*)\}\s*;?\s*$/gm, (_, names) => {
                        const first = names.trim().split(',')[0].trim();
                        return first ? `module.exports = ${first};` : '';
                    })
                    .replace(/^\s*export\s+(const|let|var|function|class)\s+/gm, '$1 ')
                    .replace(/^\s*import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '');

                const m = { exports: {} };
                const fileDir = path.dirname(p);
                const customRequire = (moduleName) => {
                    if (moduleName.startsWith('.')) {
                        const basename = path.basename(moduleName, '.js');
                        if (basename === 'gameConfig' && windowMock && windowMock.CONFIG) return windowMock.CONFIG;
                        let resolvedPath = path.join(fileDir, moduleName);
                        if (!resolvedPath.endsWith('.js')) resolvedPath += '.js';
                        if (fs.existsSync(resolvedPath)) return require(resolvedPath);
                    }
                    return require(moduleName);
                };

                const wrapper = new Function('module', 'exports', 'require', 'window', sanitized);
                wrapper(m, m.exports, customRequire, windowMock || {});
                return m.exports;
            } catch (err) { return null; }
        }
    }
    return null;
};

const gameConfig = loadSharedFile('gameConfig.js') || {};
const {
    MAP_WIDTH = 1920, MAP_HEIGHT = 1080, PLAYER_RADIUS = 20,
    BASE_HP = 100, BASE_DAMAGE = 20, BASE_FIRE_RATE = 400, BASE_BULLET_SPEED = 15, BASE_MOVE_SPEED = 0.8,
    BASE_AMMO = 10, BASE_RELOAD_TIME = 1500,
    MAX_CAP_HP = 600, MIN_CAP_HP = 30, MAX_CAP_DAMAGE = 999, MIN_CAP_FIRE_RATE = 50,
    MAX_CAP_MOVE_SPEED = 3.5, MIN_CAP_MOVE_SPEED = 0.2, MAX_CAP_BULLET_SPEED = 80, MAX_CAP_AMMO = 99,
    MAX_CAP_LIFESTEAL = 0.5, MAX_CAP_BOUNCES = 10, MAX_CAP_PIERCE = 15,
    GRAVITY_OPTIONS = [{ name: "Normal", x: 0, y: 0 }], GRAVITY_CHANGE_INTERVAL = 10000
} = gameConfig;

const fullConfig = { MAP_WIDTH, MAP_HEIGHT, PLAYER_RADIUS, BASE_HP, BASE_DAMAGE, BASE_FIRE_RATE, BASE_BULLET_SPEED, BASE_MOVE_SPEED, BASE_AMMO, BASE_RELOAD_TIME, MAX_CAP_HP, MIN_CAP_HP, MAX_CAP_DAMAGE, MIN_CAP_FIRE_RATE, MAX_CAP_MOVE_SPEED, MIN_CAP_MOVE_SPEED, MAX_CAP_BULLET_SPEED, MAX_CAP_AMMO, MAX_CAP_LIFESTEAL, MAX_CAP_BOUNCES, MAX_CAP_PIERCE, GRAVITY_OPTIONS, GRAVITY_CHANGE_INTERVAL, ...gameConfig };

let availableCards = [];
const rawCards = loadSharedFile('cards.js', { CONFIG: fullConfig });
if (rawCards) availableCards = Array.isArray(rawCards) ? rawCards : (rawCards.availableCards || Object.values(rawCards).filter(v => Array.isArray(v))[0] || []);

const uiCatalog = availableCards.map(c => ({ name: c.name, initials: c.initials, icon: c.icon, desc: c.desc || c.description || '', rarity: c.rarity }));

const rooms = {};

const broadcastLobbyUpdate = (room) => {
    if (!room) return;
    io.to(room.id).emit('lobbyUpdated', { hostId: room.hostId, players: room.players });
};

const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
};

const startNextRound = (room) => {
    if (!room) return;
    if (Object.keys(room.players).length < 1) {
        room.gameState = 'LOBBY';
        io.to(room.id).emit('gameStateChanged', { state: 'LOBBY', roomCode: room.id });
        Object.values(room.players).forEach(p => p.isReady = false);
        broadcastLobbyUpdate(room);
        return;
    }

    room.roundNumber = (room.roundNumber || 0) + 1;
    const mapData = generateMap(MAP_WIDTH, MAP_HEIGHT);
    room.obstacles = mapData.obstacles;
    room.breakables = mapData.breakables;
    room.deadPlayersThisRound = [];
    if (room.processedHits) room.processedHits.clear();

    const playerIds = Object.keys(room.players);
    playerIds.forEach((id, index) => {
        const p = room.players[id];
        let sp = getValidSpawnPoint(index, MAP_WIDTH, MAP_HEIGHT, room.obstacles, room.breakables, PLAYER_RADIUS);
        applyHardCaps(p);
        p.hp = p.maxHp; p.x = sp.x; p.y = sp.y; p.ammo = p.maxAmmo;
        p.isReloading = false; p.domainActive = false; p.isInvisible = false;
        p.inputs = { up: false, down: false, left: false, right: false, click: false, rightClick: false, aimAngle: 0, reload: false, dash: false };
    });

    room.gameState = 'PLAYING';

    if (room.settings.gravityTwist && GRAVITY_OPTIONS.length > 0) {
        room.currentGravity = GRAVITY_OPTIONS[Math.floor(Math.random() * GRAVITY_OPTIONS.length)];
        io.to(room.id).emit('gravityChanged', room.currentGravity.name);
    }

    io.to(room.id).emit('mapUpdate', { obstacles: room.obstacles, breakables: room.breakables });
    io.to(room.id).emit('gameStateChanged', { state: 'PLAYING', obstacles: room.obstacles, breakables: room.breakables });
};

const handleDeath = (room, victimId) => {
    if (!room || room.gameState !== 'PLAYING') return;
    if (room.players[victimId]) {
        if (!room.deadPlayersThisRound.includes(victimId)) room.deadPlayersThisRound.push(victimId);
        if (room.players[victimId].domainActive && DomainManager && typeof DomainManager.deactivateDomain === 'function') {
            DomainManager.deactivateDomain(room.players[victimId], Object.values(room.players));
        }
        room.players[victimId].hp = 0;
        room.players[victimId].domainActive = false;
    }

    let alive = Object.keys(room.players).filter(id => room.players[id].hp > 0);
    let roundWinnerTeam = null;
    let roundWinnerId = null;

    if (room.settings.gameMode === 'TDM' && alive.length > 0) {
        let firstAliveTeam = room.players[alive[0]].team;
        if (firstAliveTeam !== "none" && alive.every(id => room.players[id].team === firstAliveTeam)) roundWinnerTeam = firstAliveTeam;
    } else if (alive.length <= 1) {
        roundWinnerId = alive.length === 1 ? alive[0] : null;
    }

    if (alive.length <= 1 || roundWinnerTeam) {
        if (room.settings.gameMode === 'TDM' && roundWinnerTeam) {
            room.teamScores[roundWinnerTeam] = (room.teamScores[roundWinnerTeam] || 0) + 1;
            if (room.teamScores[roundWinnerTeam] >= room.settings.maxRounds) {
                room.gameState = 'GAMEOVER';
                io.to(room.id).emit('gameStateChanged', { state: 'GAMEOVER', winnerName: "Tým " + roundWinnerTeam.toUpperCase() });
                return;
            }
        } else if (room.settings.gameMode === 'FFA' && roundWinnerId) {
            room.players[roundWinnerId].score += 1;
            if (room.players[roundWinnerId].score >= room.settings.maxRounds) {
                room.gameState = 'GAMEOVER';
                io.to(room.id).emit('gameStateChanged', { state: 'GAMEOVER', winnerName: room.players[roundWinnerId].name });
                return;
            }
        }

        room.gameState = 'UPGRADE';
        room.upgradeQueue = Object.keys(room.players).filter(id => {
            if (room.settings.gameMode === 'TDM' && roundWinnerTeam) return room.players[id].team !== roundWinnerTeam;
            if (room.settings.gameMode === 'FFA' && roundWinnerId) return id !== roundWinnerId;
            return true;
        });

        if (room.upgradeQueue.length > 0) {
            room.currentLoserId = room.upgradeQueue[0];
            let cardsToSend = generateCardsForPlayer(room.players[room.currentLoserId], availableCards);
            io.to(room.id).emit('gameStateChanged', { state: 'UPGRADE', loserId: room.currentLoserId, cards: cardsToSend });
            io.to(room.id).emit('showCards', cardsToSend);
        } else {
            startNextRound(room);
        }
    }
};

io.on('connection', (socket) => {
    socket.emit('mapData', { mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT });
    socket.emit('initCatalog', uiCatalog);

    socket.on('createRoom', (data = {}) => {
        const code = generateRoomCode();
        const mapData = generateMap(MAP_WIDTH, MAP_HEIGHT);
        rooms[code] = {
            id: code, hostId: socket.id, players: {}, upgradeQueue: [],
            gameState: 'LOBBY', teamScores: {}, deadPlayersThisRound: [],
            settings: { gameMode: 'FFA', maxRounds: 5, gravityTwist: false },
            currentGravity: GRAVITY_OPTIONS.length ? GRAVITY_OPTIONS[0] : { name: "Normal", x: 0, y: 0 },
            obstacles: mapData.obstacles, breakables: mapData.breakables, processedHits: new Set()
        };
        socket.join(code);
        socket.roomId = code;
        rooms[code].players[socket.id] = createPlayerTemplate(data.name, data.color, "none", data.cosmetic, true);
        socket.emit('roomCreated', { code, isHost: true });
        socket.emit('settingsUpdated', rooms[code].settings);
        broadcastLobbyUpdate(rooms[code]);
    });

    socket.on('joinRoom', (data) => {
        if (!data || !data.code) return;
        const code = String(data.code).toUpperCase();
        const room = rooms[code];
        if (!room) return socket.emit('errorMsg', 'Místnost neexistuje.');
        if (Object.keys(room.players).length >= 6) return socket.emit('errorMsg', 'Místnost je plná.');
        if (room.gameState !== 'LOBBY') return socket.emit('errorMsg', 'Hra už začala.');

        socket.join(code);
        socket.roomId = code;
        const pTeam = (data.team && room.settings.gameMode !== 'FFA') ? data.team : "none";
        rooms[code].players[socket.id] = createPlayerTemplate(data.name, data.color, pTeam, data.cosmetic, false);
        socket.emit('roomJoined', { code, isHost: false });
        socket.emit('settingsUpdated', room.settings);
        broadcastLobbyUpdate(room);
    });

    socket.on('updateSettings', (newSettings) => {
        const room = rooms[socket.roomId];
        if (!room || room.gameState !== 'LOBBY' || room.hostId !== socket.id || !newSettings) return;
        room.settings = { ...room.settings, ...newSettings };
        if (room.settings.gameMode === 'TDM') {
            let redCount = 0, blueCount = 0;
            const players = Object.values(room.players);
            players.forEach(p => { if (p.team === 'red') redCount++; else if (p.team === 'blue') blueCount++; });
            players.forEach(p => {
                if (p.team !== "red" && p.team !== "blue") {
                    if (redCount <= blueCount) { p.team = "red"; redCount++; }
                    else { p.team = "blue"; blueCount++; }
                }
            });
        } else {
            Object.values(room.players).forEach(p => p.team = "none");
        }
        io.to(room.id).emit('settingsUpdated', room.settings);
        broadcastLobbyUpdate(room);
    });

    socket.on('updateProfile', (data) => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id] || !data) return;
        const p = room.players[socket.id];
        if (data.name) p.name = String(data.name).substring(0, 15);
        if (data.color) p.color = String(data.color).substring(0, 7);
        if (data.cosmetic !== undefined) p.cosmetic = data.cosmetic;
        if (data.team !== undefined) p.team = (room.settings.gameMode !== 'FFA') ? data.team : "none";
        broadcastLobbyUpdate(room);
    });

    socket.on('toggleReady', (status) => {
        const room = rooms[socket.roomId];
        if (!room || room.gameState !== 'LOBBY' || !room.players[socket.id]) return;
        room.players[socket.id].isReady = !!status;
        const playerIds = Object.keys(room.players);
        broadcastLobbyUpdate(room);

        if (playerIds.length >= 2 && playerIds.every(id => room.players[id].isReady)) {
            if (room.settings.gameMode === 'TDM' && playerIds.length > 1) {
                const hasRed = playerIds.some(id => room.players[id].team === 'red');
                const hasBlue = playerIds.some(id => room.players[id].team === 'blue');
                if (!hasRed || !hasBlue) {
                    room.players[socket.id].isReady = false;
                    broadcastLobbyUpdate(room);
                    return socket.emit('errorMsg', 'V TDM musí být alespoň jeden hráč v každém týmu!');
                }
            }
            playerIds.forEach(id => { room.players[id].score = 0; resetPlayerStatsToBase(room.players[id]); });
            room.teamScores = {};
            startNextRound(room);
        }
    });

    socket.on('activateDomain', () => {
        const room = rooms[socket.roomId];
        if (room && room.gameState === 'PLAYING' && room.players[socket.id]) {
            DomainManager.activateDomain(room.players[socket.id], room);
        }
    });

    const handleInput = (arg1, arg2) => {
        const roomCode = typeof arg1 === 'string' ? arg1 : socket.roomId;
        const data = typeof arg1 === 'object' ? arg1 : arg2;
        const room = rooms[roomCode || socket.roomId];
        if (room && room.gameState === 'PLAYING' && room.players[socket.id] && data) {
            const currentDash = room.players[socket.id].inputs.dash || false;
            room.players[socket.id].inputs = { ...room.players[socket.id].inputs, ...data, dash: currentDash || !!data.dash };
        }
    };
    socket.on('PlayerInput', handleInput);
    socket.on('playerInput', handleInput);

    socket.on('Dash', (arg1) => {
        const roomCode = typeof arg1 === 'string' ? arg1 : socket.roomId;
        const room = rooms[roomCode || socket.roomId];
        if (room && room.gameState === 'PLAYING' && room.players[socket.id]) {
            room.players[socket.id].inputs.dash = true;
        }
    });

    socket.on('clientSync', (arg1, arg2) => {
        const data = typeof arg1 === 'object' ? arg1 : arg2;
        const room = rooms[socket.roomId];
        if (room && room.gameState === 'PLAYING' && data) {
            const p = room.players[socket.id];
            if (p && p.hp > 0 && typeof data.x === 'number' && typeof data.y === 'number') {
                p.x = data.x;
                p.y = data.y;
                p.aimAngle = Number(data.aimAngle) || p.aimAngle;
                p.ammo = Number(data.ammo) || p.ammo;
                p.isReloading = !!data.isReloading;
                if (data.domainActive !== undefined) p.domainActive = !!data.domainActive;
                p.isInvisible = !!data.isInvisible;
            }
        }
    });

    socket.on('playerShot', (arg1, arg2) => {
        const bulletsData = typeof arg1 === 'object' ? arg1 : arg2;
        const room = rooms[socket.roomId];
        if (room && room.gameState === 'PLAYING') socket.to(socket.roomId).emit('enemyShot', bulletsData);
    });

    socket.on('bulletHitPlayer', (arg1, arg2) => {
        const data = typeof arg1 === 'object' ? arg1 : arg2;
        const room = rooms[socket.roomId];
        if (room && room.gameState === 'PLAYING' && data && data.targetId) {
            const target = room.players[data.targetId];
            const shooter = room.players[socket.id];
            if (target && shooter && target.hp > 0) {
                if (data.bulletId) {
                    const hitHash = `${data.bulletId}-${data.targetId}`;
                    if (room.processedHits.has(hitHash)) return;
                    room.processedHits.add(hitHash);
                    if (room.processedHits.size > 2000) {
                        const iterator = room.processedHits.values();
                        for (let i = 0; i < 500; i++) room.processedHits.delete(iterator.next().value);
                    }
                }
                const damageFromClient = Number(data.damage) || 0;
                const maxAllowedDamage = shooter.damage * 3;
                const safeDamage = Math.min(damageFromClient, maxAllowedDamage);
                target.hp -= safeDamage;
                if (data.lifesteal > 0 && shooter.hp > 0) {
                    const healAmount = Math.floor(safeDamage * Number(data.lifesteal));
                    shooter.hp = Math.min(shooter.maxHp, shooter.hp + healAmount);
                }
                if (target.hp <= 0) handleDeath(room, data.targetId);
                io.to(socket.roomId).emit('playerDamaged', { targetId: data.targetId, newHp: target.hp, shooterId: socket.id });
            }
        }
    });

    socket.on('wallDestroyed', (wallId) => {
        const room = rooms[socket.roomId];
        if (room && room.gameState === 'PLAYING') {
            const wall = room.breakables.find(w => w.id === wallId);
            if (wall && !wall.destroyed) {
                wall.destroyed = true;
                io.to(socket.roomId).emit('mapUpdate', { obstacles: room.obstacles, breakables: room.breakables });
            }
        }
    });

    socket.on('spawnDecoy', (decoyData) => {
        if (socket.roomId) socket.to(socket.roomId).emit('enemyDecoySpawned', decoyData);
    });

    // ZDE JE OPRAVA PRO KARTY: Přejmenováno z pickCard na selectCard
    socket.on('selectCard', (cardIndex) => {
        const room = rooms[socket.roomId];
        if (!room || room.gameState !== 'UPGRADE' || socket.id !== room.currentLoserId) return;

        const card = availableCards[cardIndex];
        const p = room.players[socket.id];

        if (card && p) {
            const oldMaxHp = p.maxHp;
            if (typeof card.apply === 'function') card.apply(p);
            if (p.maxHp !== oldMaxHp) p.hp = Math.floor(p.maxHp * (p.hp / oldMaxHp));
            applyHardCaps(p);
        }

        room.upgradeQueue = room.upgradeQueue.filter(id => id !== socket.id);

        if (room.upgradeQueue.length > 0) {
            room.currentLoserId = room.upgradeQueue[0];
            const nextPlayer = room.players[room.currentLoserId];
            if (nextPlayer) {
                let cardsToSend = generateCardsForPlayer(nextPlayer, availableCards);
                io.to(room.id).emit('gameStateChanged', { state: 'UPGRADE', loserId: room.currentLoserId, cards: cardsToSend });
                io.to(room.id).emit('showCards', cardsToSend);
            } else {
                startNextRound(room);
            }
        } else {
            startNextRound(room);
        }
    });

    socket.on('disconnect', () => {
        const code = socket.roomId;
        if (!code) return;
        const room = rooms[code];
        if (!room) return;

        const wasHost = (room.hostId === socket.id);
        delete room.players[socket.id];
        room.upgradeQueue = (room.upgradeQueue || []).filter(id => id !== socket.id);
        const remainingPlayers = Object.keys(room.players);

        if (remainingPlayers.length === 0) {
            delete rooms[code];
            return;
        }

        if (wasHost) {
            room.hostId = remainingPlayers[0];
            room.players[remainingPlayers[0]].isHost = true;
        }

        if (remainingPlayers.length < 1 && !['LOBBY', 'GAMEOVER'].includes(room.gameState)) {
            room.gameState = 'LOBBY';
            if (room.players[remainingPlayers[0]]) room.players[remainingPlayers[0]].isReady = false;
            io.to(code).emit('gameStateChanged', { state: 'LOBBY', roomCode: code });
            broadcastLobbyUpdate(room);
        } else if (room.gameState === 'UPGRADE' && room.currentLoserId === socket.id) {
            if (room.upgradeQueue.length > 0) {
                room.currentLoserId = room.upgradeQueue[0];
                const nextPlayer = room.players[room.currentLoserId];
                if (nextPlayer) {
                    let cardsToSend = generateCardsForPlayer(nextPlayer, availableCards);
                    io.to(room.id).emit('gameStateChanged', { state: 'UPGRADE', loserId: room.currentLoserId, cards: cardsToSend });
                    io.to(room.id).emit('showCards', cardsToSend);
                } else startNextRound(room);
            } else startNextRound(room);
        } else {
            broadcastLobbyUpdate(room);
        }
    });
});

setInterval(() => {
    Object.values(rooms).forEach(room => {
        if (room && room.gameState === 'PLAYING' && room.settings.gravityTwist && GRAVITY_OPTIONS.length > 0) {
            const availableOptions = GRAVITY_OPTIONS.length > 1
                ? GRAVITY_OPTIONS.filter(g => g.name !== room.currentGravity?.name)
                : GRAVITY_OPTIONS;
            if (availableOptions.length > 0) {
                room.currentGravity = availableOptions[Math.floor(Math.random() * availableOptions.length)];
                io.to(room.id).emit('gravityChanged', room.currentGravity.name);
            }
        }
    });
}, GRAVITY_CHANGE_INTERVAL);

const TICK_RATE = 1000 / 50;

setInterval(() => {
    Object.values(rooms).forEach(room => {
        if (!room) return;

        if (room.gameState === 'PLAYING' && DomainManager && typeof DomainManager.updateDomains === 'function') {
            const enemiesArray = Object.values(room.players);
            DomainManager.updateDomains(room.players, enemiesArray, [], TICK_RATE);
        }

        const leanPlayers = {};
        for (const id in room.players) {
            const p = room.players[id];
            
            // ZDE JE OPRAVA POHYBU: Používáme .toFixed(2) místo Math.round()
            leanPlayers[id] = {
                name: p.name, color: p.color, cosmetic: p.cosmetic, team: p.team,
                x: Number((p.x || 0).toFixed(2)),
                y: Number((p.y || 0).toFixed(2)),
                hp: Math.round(p.hp),
                maxHp: p.maxHp,
                aimAngle: Number(p.aimAngle.toFixed(2)),
                ammo: p.ammo, maxAmmo: p.maxAmmo,
                isReloading: p.isReloading, isInvisible: p.isInvisible,
                domainActive: p.domainActive, score: p.score
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
    console.log(`🚀 Backend Quantum Clash bezpečně běží na portu ${PORT}`);
});