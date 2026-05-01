// server.js — 20/80 SPLIT: server handles only authoritative events
// (damage, death, scoring, card selection, domain effects, HP regen, clone expiry)
// All movement/bullet physics run on clients at 60fps.
// Server broadcasts state at 20fps — enough for corrections, not a physics engine.

process.on('uncaughtException', (err) => console.error('🚨 CRASH:', err.message, err.stack));
process.on('unhandledRejection', (r) => console.error('🚨 REJECTION:', r));

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const fs      = require('fs');
const cors    = require('cors');

let DomainManager, gameHelper = {};
try {
    DomainManager = require('./domainManager.js');
    gameHelper    = require('./gameHelper.js') || {};
    console.log('✅ Helpery načteny.');
} catch (err) { console.error('🚨 HELPERY:', err.message); }

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: 2000, pingTimeout: 5000
});

// ─── SHARED FILE LOADER ──────────────────────────────────────────────────────
const loadSharedFile = (fileName, expectedVar) => {
    const paths = [
        path.join(__dirname, 'public', fileName),
        path.join(__dirname, 'public', 'game', fileName),
        path.join(__dirname, fileName)
    ];
    for (const p of paths) {
        if (!fs.existsSync(p)) continue;
        try {
            const s = fs.readFileSync(p, 'utf-8')
                .replace(/^\s*export\s+(const|let|var|function|class)\s+/gm, '$1 ')
                .replace(/^\s*export\s+default\s+/gm, '')
                .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')
                .replace(/^\s*import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '');
            return new Function(`${s}\nif(typeof ${expectedVar}!=='undefined')return ${expectedVar};return null;`)();
        } catch (e) { console.error(`❌ ${p}:`, e.message); return null; }
    }
    return null;
};

const loadedConfig   = loadSharedFile('gameConfig.js', 'CONFIG') || {};
const rawCards       = loadSharedFile('cards.js', 'availableCards');
const availableCards = Array.isArray(rawCards) ? rawCards : [];
console.log(`✅ ${availableCards.length} karet.`);

const CONFIG = {
    MAP_WIDTH:        loadedConfig.MAP_WIDTH        || 1920,
    MAP_HEIGHT:       loadedConfig.MAP_HEIGHT       || 1080,
    FPS:              60,
    MAX_SCORE:        loadedConfig.MAX_SCORE        || 25,
    BASE_HP:          loadedConfig.BASE_HP          || 100,
    BASE_MOVE_SPEED:  loadedConfig.BASE_MOVE_SPEED  || 0.8,
    BASE_DAMAGE:      loadedConfig.BASE_DAMAGE      || 20,
    BASE_FIRE_RATE:   loadedConfig.BASE_FIRE_RATE   || 400,
    BASE_BULLET_SPEED:loadedConfig.BASE_BULLET_SPEED|| 15,
    BASE_AMMO:        loadedConfig.BASE_AMMO        || 10,
    BASE_RELOAD_TIME: loadedConfig.BASE_RELOAD_TIME || 1500,
    PLAYER_RADIUS:    loadedConfig.PLAYER_RADIUS    || 20,
    DASH_DURATION:    loadedConfig.DASH_DURATION    || 200,
    BULLET_RADIUS:    5,
    MAX_PLAYERS:      6
};

const PORT            = process.env.PORT || 3000;
// 20/80 SPLIT: server physics tick = 60fps (damage/domain), broadcast = 20fps
const PHYSICS_TICK    = 1000 / 60;
const BROADCAST_TICK  = 1000 / 20;  // ← was 60fps, now 20fps (saves 67% server broadcast)
const rooms           = {};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function isValidNumber(v) { return typeof v === 'number' && isFinite(v) && !isNaN(v); }

function makeDefaultPlayer(id, name, color, room) {
    const startHp = room.settings.startingHp || CONFIG.BASE_HP;
    return {
        id, name, color, cosmetic: 'none',
        team: Object.keys(room.players).length % 2 === 0 ? 'blue' : 'red',
        x: 0, y: 0, aimAngle: 0,
        hp: startHp, maxHp: startHp, baseMaxHp: startHp,
        ammo: CONFIG.BASE_AMMO, maxAmmo: CONFIG.BASE_AMMO,
        moveSpeed: CONFIG.BASE_MOVE_SPEED, damage: CONFIG.BASE_DAMAGE,
        fireRate: CONFIG.BASE_FIRE_RATE, bulletSpeed: CONFIG.BASE_BULLET_SPEED,
        reloadTime: CONFIG.BASE_RELOAD_TIME,
        lifesteal: 0, bounces: 0, pierce: 0,
        playerRadius: CONFIG.PLAYER_RADIUS, bulletSize: CONFIG.BULLET_RADIUS,
        multishot: 1, spread: 0,
        score: 0, isReady: false, hpRegen: 0,
        isRussianRoulette: false, invisOnDash: false, cloneOnDash: false,
        domainType: null, domainActive: false, domainCooldown: 0,
        domainTimer: 0, domainRadius: 200, isJackpotActive: false,
        jackpotTimer: 0, jackpotPity: 0, baseSpeed: CONFIG.BASE_MOVE_SPEED,
        isInvisible: false, _lastSyncTime: 0,
        pickedCards: [], clone: null
    };
}

function resetPlayer(p, room, usedPositions = []) {
    p.hp = p.maxHp;
    p.ammo = p.isRussianRoulette ? 6 : p.maxAmmo;
    p.isReloading = false; p.isInvisible = false;
    p.domainActive = false; p.domainTimer = 0; p.clone = null;

    const idx = Object.keys(room.players).indexOf(p.id);
    const spawn = gameHelper.getValidSpawnPoint
        ? gameHelper.getValidSpawnPoint(idx, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT,
            (room.map?.obstacles || []).filter(o => !o.isBorder),
            room.map?.breakables || [],
            p.playerRadius || CONFIG.PLAYER_RADIUS, usedPositions)
        : { x: CONFIG.MAP_WIDTH / 2, y: CONFIG.MAP_HEIGHT / 2 };
    p.x = spawn.x; p.y = spawn.y;
    usedPositions.push({ x: spawn.x, y: spawn.y });
}

function resetAllPlayers(room) {
    const used = [];
    const baseHp = room.settings.startingHp || CONFIG.BASE_HP;
    Object.values(room.players).forEach(p => {
        const bonus = p.maxHp - (p.baseMaxHp || baseHp);
        p.baseMaxHp = baseHp;
        p.maxHp = Math.max(30, baseHp + bonus);
        resetPlayer(p, room, used);
    });
}

function buildLean(p) {
    return {
        id: p.id, name: p.name, color: p.color, team: p.team,
        x: p.x, y: p.y, hp: Math.round(p.hp), maxHp: p.maxHp,
        aimAngle: p.aimAngle, ammo: p.ammo, maxAmmo: p.maxAmmo,
        isReloading: p.isReloading, isInvisible: p.isInvisible,
        domainActive: p.domainActive, domainType: p.domainType,
        domainCooldown: p.domainCooldown, domainRadius: p.domainRadius,
        score: p.score,
        // Stats sent for tab menu display
        moveSpeed: p.moveSpeed, damage: p.damage, fireRate: p.fireRate,
        bulletSpeed: p.bulletSpeed, bounces: p.bounces, pierce: p.pierce,
        lifesteal: p.lifesteal, hpRegen: p.hpRegen,
        playerRadius: p.playerRadius, bulletSize: p.bulletSize,
        multishot: p.multishot, spread: p.spread,
        isJackpotActive: p.isJackpotActive,
        pickedCards: p.pickedCards || [],
        clone: p.clone || null
    };
}

// ─── CARD SELECTION ───────────────────────────────────────────────────────────
function initiateCardSelection(room) {
    if (room.gameState === 'CARD_SELECTION') return;
    room.gameState = 'CARD_SELECTION';
    room.loserCardsPicked = new Set();
    room.loserCardOptions = {};

    const loserIds = room.loserIds || new Set();
    if (loserIds.size === 0) { setTimeout(() => startNewRound(room), 500); return; }

    loserIds.forEach(id => {
        const player = room.players[id];
        if (!player) return;
        const selection = gameHelper.generateCardsForPlayer
            ? gameHelper.generateCardsForPlayer(player, availableCards)
            : availableCards.slice(0, 3);
        room.loserCardOptions[id] = selection;
        io.to(id).emit('showCardSelection', selection);
    });

    const loserData = [...loserIds].map(id => ({
        id, name: room.players[id]?.name || '?', color: room.players[id]?.color || '#fff',
        options: room.loserCardOptions[id] || [], picked: false
    }));

    io.to(room.id).emit('gameStateChanged', {
        state: 'CARD_SELECTION', loserData,
        totalLosers: loserIds.size, pickedCount: 0
    });
}

function startNewRound(room) {
    room.round = (room.round || 1) + 1;
    room.gameState = 'PLAYING';
    room.loserIds = new Set();
    room.loserCardsPicked = new Set();
    room.loserCardOptions = {};
    room.map = gameHelper.generateMap
        ? gameHelper.generateMap(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT)
        : { obstacles: [], breakables: [] };
    resetAllPlayers(room);
    io.to(room.id).emit('mapUpdate', room.map);
    io.to(room.id).emit('gameStateChanged', {
        state: 'PLAYING', round: room.round,
        obstacles: room.map.obstacles, breakables: room.map.breakables
    });
}

// ─── SOCKET HANDLERS ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {

    socket.on('createRoom', (data) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        const initialMap = gameHelper.generateMap
            ? gameHelper.generateMap(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT)
            : { obstacles: [], breakables: [] };
        rooms[roomId] = {
            id: roomId, creatorId: socket.id, players: {},
            gameState: 'LOBBY', round: 1, map: initialMap,
            settings: { maxRounds: CONFIG.MAX_SCORE, gameMode: 'FFA', startingHp: CONFIG.BASE_HP },
            loserIds: new Set(), loserCardsPicked: new Set(), loserCardOptions: {}
        };
        socket.emit('roomCreated', { roomId });
        joinRoom(socket, roomId, data);
    });

    socket.on('joinRoom', (data) => {
        const roomId = (data.roomId || '').toUpperCase().trim();
        if (!rooms[roomId]) { socket.emit('errorMsg', 'Místnost neexistuje.'); return; }
        if (Object.keys(rooms[roomId].players).length >= CONFIG.MAX_PLAYERS) {
            socket.emit('errorMsg', `Místnost je plná (max ${CONFIG.MAX_PLAYERS} hráčů).`); return;
        }
        socket.emit('roomJoined', { roomId });
        joinRoom(socket, roomId, data);
    });

    function joinRoom(sock, roomId, data) {
        const room = rooms[roomId];
        sock.join(roomId); sock.roomId = roomId;
        const safeName  = String(data.name || 'Hráč').replace(/</g, '').substring(0, 24);
        const safeColor = /^#[0-9A-Fa-f]{6}$/.test(data.color) ? data.color : '#45f3ff';
        room.players[sock.id] = makeDefaultPlayer(sock.id, safeName, safeColor, room);
        const used = Object.values(room.players)
            .filter(p => p.id !== sock.id && p.x !== 0).map(p => ({ x: p.x, y: p.y }));
        resetPlayer(room.players[sock.id], room, used);
        sock.emit('roomInfo', { isCreator: room.creatorId === sock.id, settings: room.settings });
        io.to(roomId).emit('updatePlayerList', Object.values(room.players));
        io.to(roomId).emit('mapUpdate', room.map);
    }

    socket.on('changeSettings', (s) => {
        const room = rooms[socket.roomId];
        if (!room || room.creatorId !== socket.id || room.gameState !== 'LOBBY') return;
        if (isValidNumber(s.maxRounds) && s.maxRounds >= 1 && s.maxRounds <= 100)
            room.settings.maxRounds = Math.floor(s.maxRounds);
        if (['FFA', 'TDM'].includes(s.gameMode)) room.settings.gameMode = s.gameMode;
        if (isValidNumber(s.startingHp) && s.startingHp >= 30 && s.startingHp <= 600) {
            room.settings.startingHp = Math.floor(s.startingHp);
            Object.values(room.players).forEach(p => { p.hp = p.maxHp = p.baseMaxHp = room.settings.startingHp; });
        }
        io.to(room.id).emit('settingsChanged', room.settings);
    });

    socket.on('playerReady', () => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id] || room.gameState !== 'LOBBY') return;
        room.players[socket.id].isReady = !room.players[socket.id].isReady;
        io.to(room.id).emit('updatePlayerList', Object.values(room.players));
        const allReady = Object.values(room.players).every(p => p.isReady);
        if (allReady && Object.keys(room.players).length >= 1) {
            room.gameState = 'PLAYING'; room.loserIds = new Set();
            io.to(room.id).emit('gameStateChanged', {
                state: 'PLAYING', obstacles: room.map.obstacles, breakables: room.map.breakables
            });
        }
    });

    socket.on('selectCard', (cardName) => {
        const room = rooms[socket.roomId];
        if (!room || room.gameState !== 'CARD_SELECTION') return;
        if (!room.loserIds?.has(socket.id) || room.loserCardsPicked?.has(socket.id)) return;
        room.loserCardsPicked.add(socket.id);
        const player = room.players[socket.id];
        const card   = availableCards.find(c => c.name === cardName);
        if (player && card && typeof card.apply === 'function') {
            card.apply(player);
            player.pickedCards.push({ name: card.name, rarity: card.rarity, description: card.description });
        }
        io.to(room.id).emit('cardPickProgress', {
            pickerId: socket.id, pickerName: player?.name || '?',
            pickerColor: player?.color || '#fff', cardName: card?.name || '?',
            cardRarity: card?.rarity || 'common',
            pickedCount: room.loserCardsPicked.size, totalLosers: room.loserIds.size
        });
        if (room.loserCardsPicked.size >= room.loserIds.size) startNewRound(room);
    });

    // 20/80 SPLIT: clientSync is the main position authority.
    // Server accepts updates at max 30pps (33ms between updates).
    // BUG FIX: was 8ms limit (125pps) — pointlessly high, wasted CPU.
    socket.on('clientSync', (data) => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        const p = room.players[socket.id];
        if (p.hp <= 0) return;
        const now = Date.now();
        if (now - (p._lastSyncTime || 0) < 33) return;  // 30pps max
        p._lastSyncTime = now;
        if (isValidNumber(data.x) && isValidNumber(data.y)) {
            const r = p.playerRadius || CONFIG.PLAYER_RADIUS;
            p.x = Math.max(r, Math.min(CONFIG.MAP_WIDTH  - r, data.x));
            p.y = Math.max(r, Math.min(CONFIG.MAP_HEIGHT - r, data.y));
        }
        if (isValidNumber(data.aimAngle)) p.aimAngle = data.aimAngle;
        if (data.ritualRequested && DomainManager?.activateDomain) DomainManager.activateDomain(p);
        if (data.isReloading && !p.isReloading) {
            const full = p.isRussianRoulette ? 6 : p.maxAmmo;
            if (p.ammo < full) {
                p.isReloading = true;
                setTimeout(() => {
                    const rp = rooms[socket.roomId]?.players[socket.id];
                    if (rp) { rp.ammo = full; rp.isReloading = false; }
                }, p.reloadTime || 1500);
            }
        }
    });

    socket.on('Dash', () => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]?.hp) return;
        const p = room.players[socket.id];
        if (p.invisOnDash) {
            p.isInvisible = true;
            setTimeout(() => {
                const rp = rooms[socket.roomId]?.players[socket.id];
                if (rp) rp.isInvisible = false;
            }, CONFIG.DASH_DURATION || 200);
        }
        if (p.cloneOnDash) {
            p.clone = { x: p.x, y: p.y, color: p.color,
                radius: p.playerRadius || CONFIG.PLAYER_RADIUS,
                expiresAt: Date.now() + 3000 };
        }
        socket.to(socket.roomId).emit('enemyDash', socket.id);
    });

    socket.on('reload', () => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        const p = room.players[socket.id];
        if (p.hp <= 0 || p.isReloading) return;
        const full = p.isRussianRoulette ? 6 : p.maxAmmo;
        if (p.ammo < full) {
            p.isReloading = true;
            setTimeout(() => {
                const rp = rooms[socket.roomId]?.players[socket.id];
                if (rp) { rp.ammo = full; rp.isReloading = false; }
            }, p.reloadTime || 1500);
        }
    });

    socket.on('playerShot', (bullets) => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        const p = room.players[socket.id];
        if (p.hp <= 0) return;
        if (p.isInvisible) p.isInvisible = false;
        const full = p.isRussianRoulette ? 6 : p.maxAmmo;
        if (p.ammo > 0 && !p.isReloading) {
            p.ammo--;
            if (p.ammo <= 0) {
                p.isReloading = true;
                setTimeout(() => {
                    const rp = rooms[socket.roomId]?.players[socket.id];
                    if (rp) { rp.ammo = full; rp.isReloading = false; }
                }, p.reloadTime || 1500);
            }
        }
        if (bullets) socket.to(socket.roomId).emit('enemyShot', bullets);
    });

    socket.on('bulletHitWall', (data) => {
        const room = rooms[socket.roomId];
        if (!room?.map?.breakables) return;
        const wall = room.map.breakables.find(w => w.id === data.wallId && !w.destroyed);
        if (!wall) return;
        wall.hp = 0; wall.destroyed = true;
        io.to(room.id).emit('breakableUpdate', [{ id: wall.id, hp: 0, destroyed: true }]);
    });

    socket.on('bulletHitPlayer', (data) => {
        const room = rooms[socket.roomId];
        if (!room) return;
        const target = room.players[data.targetId];
        const shooter = room.players[socket.id];
        if (!target || target.hp <= 0 || target.isJackpotActive) return;
        let dmg = shooter?.isRussianRoulette
            ? (Math.random() < 1/6 ? 150 : 1)
            : Math.min(Number(data.damage) || 20, 9999);
        target.hp = Math.max(0, target.hp - dmg);
        if (shooter && isValidNumber(data.lifesteal) && data.lifesteal > 0)
            shooter.hp = Math.min(shooter.maxHp, shooter.hp + dmg * Math.min(data.lifesteal, 1));
        if (target.hp <= 0) {
            if (shooter) shooter.score++;
            if (!room.loserIds) room.loserIds = new Set();
            room.loserIds.add(target.id);
            target.x = -9999; target.y = -9999;
            const alive = Object.values(room.players).filter(p => p.hp > 0);
            if (alive.length <= 1 && room.gameState === 'PLAYING')
                setTimeout(() => initiateCardSelection(room), 800);
        }
    });

    socket.on('disconnect', () => {
        const room = rooms[socket.roomId];
        if (!room) return;
        delete room.players[socket.id];
        room.loserIds?.delete(socket.id);
        io.to(socket.roomId).emit('updatePlayerList', Object.values(room.players));
        if (Object.keys(room.players).length === 0) delete rooms[socket.roomId];
    });
});

// ─── PHYSICS LOOP (60fps) — domain effects, HP regen, clone expiry ─────────
// 20/80: Server runs domain+regen at 60fps but only BROADCASTS at 20fps.
setInterval(() => {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        if (room.gameState !== 'PLAYING') continue;
        const allPlayers = Object.values(room.players);
        if (DomainManager?.updateDomains)
            DomainManager.updateDomains(room.players, allPlayers, [], PHYSICS_TICK);
        const now = Date.now();
        for (const id in room.players) {
            const p = room.players[id];
            if (p.hpRegen > 0 && p.hp > 0 && p.hp < p.maxHp)
                p.hp = Math.min(p.maxHp, p.hp + p.hpRegen * (PHYSICS_TICK / 1000));
            if (p.isJackpotActive) p.ammo = p.isRussianRoulette ? 6 : p.maxAmmo;
            if (p.clone && now >= p.clone.expiresAt) p.clone = null;
        }
    }
}, PHYSICS_TICK);

// ─── BROADCAST LOOP (20fps) — send lean state to all clients ─────────────────
setInterval(() => {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        if (room.gameState !== 'PLAYING') continue;
        const leanPlayers = {};
        for (const id in room.players) leanPlayers[id] = buildLean(room.players[id]);
        io.to(room.id).volatile.emit('gameUpdate', {
            players: leanPlayers, maxScore: room.settings.maxRounds,
            gameState: room.gameState, gameMode: room.settings.gameMode
        });
    }
}, BROADCAST_TICK);

server.listen(PORT, () => console.log(`\n🚀 QUANTUM CLASH : ${PORT} (server 20% | client 80%)\n`));
