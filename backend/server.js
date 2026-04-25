// server.js
process.on('uncaughtException', (err) => {
    console.error('\n🚨 NEOŠETŘENÁ KRITICKÁ CHYBA SERVERU:');
    console.error('Typ chyby:', err.name);
    console.error('Zpráva:', err.message);
    console.error('Stack Trace:\n', err.stack);
});

process.on('unhandledRejection', (reason) => {
    console.error('\n🚨 NEOŠETŘENÝ PROMISE REJECTION:', reason);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

let DomainManager;
let gameHelper = {};
try {
    DomainManager = require('./domainManager.js');
    gameHelper = require('./gameHelper.js') || {};
    console.log('✅ DomainManager a gameHelper načteny.');
} catch (err) {
    console.error('🚨 CHYBA PŘI NAČÍTÁNÍ HELPERŮ:', err.message);
}

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: 2000,
    pingTimeout: 5000
});

// --- NAČÍTÁNÍ SDÍLENÝCH SOUBORŮ ---
const loadSharedFile = (fileName, expectedVar) => {
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
                    .replace(/^\s*export\s+(const|let|var|function|class)\s+/gm, '$1 ')
                    .replace(/^\s*export\s+default\s+/gm, '')
                    .replace(/^\s*export\s*\{([^}]*)\}\s*;?\s*$/gm, '')
                    .replace(/^\s*import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '');
                const extractData = new Function(`
                    ${sanitized}
                    if (typeof ${expectedVar} !== 'undefined') return ${expectedVar};
                    return null;
                `);
                return extractData();
            } catch (e) {
                console.error(`❌ loadSharedFile chyba v ${p}:`, e.message);
                return null;
            }
        }
    }
    console.warn(`⚠️ loadSharedFile: soubor '${fileName}' nenalezen.`);
    return null;
};

const loadedConfig = loadSharedFile('gameConfig.js', 'CONFIG') || {};
const availableCards = (() => {
    const result = loadSharedFile('cards.js', 'availableCards');
    if (!Array.isArray(result)) {
        console.error('🚨 availableCards není pole! Zkontroluj cards.js. Vráceno:', typeof result);
        return [];
    }
    return result;
})();
console.log(`✅ Načteno ${availableCards.length} karet.`);

const CONFIG = {
    MAP_WIDTH:       loadedConfig.MAP_WIDTH       || 1920,
    MAP_HEIGHT:      loadedConfig.MAP_HEIGHT      || 1080,
    FPS:             loadedConfig.FPS             || 60,
    MAX_SCORE:       loadedConfig.MAX_SCORE       || 25,
    RESPAWN_TIME:    loadedConfig.RESPAWN_TIME    || 3000,
    BASE_HP:         loadedConfig.BASE_HP         || 100,
    BASE_MOVE_SPEED: loadedConfig.BASE_MOVE_SPEED || 0.8,
    BASE_DAMAGE:     loadedConfig.BASE_DAMAGE     || 20,
    BASE_FIRE_RATE:  loadedConfig.BASE_FIRE_RATE  || 400,
    BASE_BULLET_SPEED: loadedConfig.BASE_BULLET_SPEED || 15,
    BASE_AMMO:       loadedConfig.BASE_AMMO       || 10,
    BASE_RELOAD_TIME:loadedConfig.BASE_RELOAD_TIME|| 1500,
    PLAYER_RADIUS:   loadedConfig.PLAYER_RADIUS   || 20,
    BULLET_RADIUS:   5
};

const PORT = process.env.PORT || 3000;
const TICK_RATE = 1000 / CONFIG.FPS;
const rooms = {};

// --- HELPERS ---

function isValidNumber(v) {
    return typeof v === 'number' && isFinite(v) && !isNaN(v);
}

// BUG FIX: Clamp server-side position to map bounds (prevents NaN / OOB teleports).
// The client is trusted for normal movement but this catches edge cases.
function clampPosition(x, y, radius) {
    const r = radius || CONFIG.PLAYER_RADIUS;
    return {
        x: Math.max(r, Math.min(CONFIG.MAP_WIDTH  - r, x)),
        y: Math.max(r, Math.min(CONFIG.MAP_HEIGHT - r, y))
    };
}

function resetPlayer(p, room) {
    p.hp = p.maxHp;
    // Russian Roulette resets to 6 not maxAmmo (which is 0 for that card)
    p.ammo = p.isRussianRoulette ? 6 : p.maxAmmo;
    p.isReloading = false;
    p.isInvisible = false;
    p.domainActive = false;
    p.domainTimer = 0;
    // Don't reset domainCooldown on respawn — that would let players exploit death to skip cooldown

    const playerIndex = Object.keys(room.players).indexOf(p.id);
    const spawn = gameHelper.getValidSpawnPoint
        ? gameHelper.getValidSpawnPoint(
            playerIndex,
            CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT,
            room.map?.obstacles || [],
            room.map?.breakables || [],
            p.playerRadius || CONFIG.PLAYER_RADIUS
          )
        : { x: CONFIG.MAP_WIDTH / 2, y: CONFIG.MAP_HEIGHT / 2 };

    p.x = spawn.x;
    p.y = spawn.y;
}

function initiateCardSelection(room) {
    if (room.gameState === 'CARD_SELECTION') return; // Guard against double-trigger
    room.gameState = 'CARD_SELECTION';
    if (!room.readyPlayersForNextRound) room.readyPlayersForNextRound = new Set();
    room.readyPlayersForNextRound.clear();
    // BUG FIX: Track which players have already picked a card this round
    room.cardPickedThisRound = new Set();

    Object.values(room.players).forEach(player => {
        const selection = gameHelper.generateCardsForPlayer
            ? gameHelper.generateCardsForPlayer(player, availableCards)
            : availableCards.slice(0, 3);
        io.to(player.id).emit('showCardSelection', selection);
    });

    io.to(room.id).emit('gameStateChanged', { state: 'CARD_SELECTION' });
}

function startNewRound(room) {
    room.round = (room.round || 1) + 1;
    room.gameState = 'PLAYING';
    room.cardPickedThisRound = new Set();

    // Regenerate full map (obstacles + breakables)
    room.map = gameHelper.generateMap
        ? gameHelper.generateMap(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT)
        : { obstacles: [], breakables: [] };

    Object.values(room.players).forEach(p => resetPlayer(p, room));

    io.to(room.id).emit('mapUpdate', room.map);
    io.to(room.id).emit('gameStateChanged', {
        state: 'PLAYING',
        round: room.round,
        obstacles: room.map.obstacles,
        breakables: room.map.breakables
    });
}

// --- SOCKET LOGIKA ---
io.on('connection', (socket) => {

    socket.on('createRoom', (data) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        const initialMap = gameHelper.generateMap
            ? gameHelper.generateMap(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT)
            : { obstacles: [], breakables: [] };

        rooms[roomId] = {
            id: roomId,
            players: {},
            gameState: 'LOBBY',
            round: 1,
            map: initialMap,
            teamScores: { blue: 0, red: 0 },
            settings: { maxRounds: CONFIG.MAX_SCORE, gameMode: 'FFA' },
            cardPickedThisRound: new Set(),
            lastTick: Date.now()
        };
        socket.emit('roomCreated', { roomId });
        joinRoom(socket, roomId, data);
    });

    socket.on('joinRoom', (data) => {
        const roomId = (data.roomId || '').toUpperCase().trim();
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

        // Sanitize name — strip HTML, limit length
        const safeName = String(data.name || 'Hráč').replace(/</g, '').substring(0, 24);
        const safeColor = /^#[0-9A-Fa-f]{6}$/.test(data.color) ? data.color : '#45f3ff';

        room.players[socket.id] = {
            id: socket.id,
            name: safeName,
            color: safeColor,
            cosmetic: 'none',
            team: Object.keys(room.players).length % 2 === 0 ? 'blue' : 'red',
            x: 0, y: 0,
            hp: CONFIG.BASE_HP, maxHp: CONFIG.BASE_HP,
            ammo: CONFIG.BASE_AMMO, maxAmmo: CONFIG.BASE_AMMO,
            moveSpeed: CONFIG.BASE_MOVE_SPEED,
            damage: CONFIG.BASE_DAMAGE,
            fireRate: CONFIG.BASE_FIRE_RATE,
            bulletSpeed: CONFIG.BASE_BULLET_SPEED,
            reloadTime: CONFIG.BASE_RELOAD_TIME,
            lifesteal: 0, bounces: 0, pierce: 0,
            // BUG FIX: Initialize playerRadius and bulletSize explicitly so card apply()
            // functions using (p.playerRadius || 20) always get the right base value
            playerRadius: CONFIG.PLAYER_RADIUS,
            bulletSize: CONFIG.BULLET_RADIUS,
            multishot: 1, spread: 0,
            score: 0, isReady: false,
            hpRegen: 0,
            isRussianRoulette: false,
            domainType: null,
            domainActive: false,
            domainCooldown: 0,
            domainTimer: 0,
            domainRadius: 200,
            isJackpotActive: false,
            jackpotTimer: 0,
            jackpotPity: 0,
            baseSpeed: CONFIG.BASE_MOVE_SPEED,
            _lastSyncTime: 0
        };

        resetPlayer(room.players[socket.id], room);
        io.to(roomId).emit('updatePlayerList', Object.values(room.players));
        io.to(roomId).emit('mapUpdate', room.map);
    }

    socket.on('playerReady', () => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        if (room.gameState !== 'LOBBY') return;

        room.players[socket.id].isReady = !room.players[socket.id].isReady;
        io.to(room.id).emit('updatePlayerList', Object.values(room.players));

        const allReady = Object.values(room.players).every(p => p.isReady);
        if (allReady && Object.keys(room.players).length >= 1) {
            room.gameState = 'PLAYING';
            io.to(room.id).emit('gameStateChanged', {
                state: 'PLAYING',
                obstacles: room.map.obstacles,
                breakables: room.map.breakables
            });
        }
    });

    socket.on('selectCard', (cardName) => {
        const room = rooms[socket.roomId];
        if (!room || room.gameState !== 'CARD_SELECTION') return;

        // BUG FIX: Prevent double-picking — a player can only pick one card per round
        if (!room.cardPickedThisRound) room.cardPickedThisRound = new Set();
        if (room.cardPickedThisRound.has(socket.id)) return;
        room.cardPickedThisRound.add(socket.id);

        const player = room.players[socket.id];
        const card = availableCards.find(c => c.name === cardName);

        if (player && card && typeof card.apply === 'function') {
            card.apply(player);
            console.log(`✅ ${player.name} zvolil kartu: ${cardName}`);
        }

        if (!room.readyPlayersForNextRound) room.readyPlayersForNextRound = new Set();
        room.readyPlayersForNextRound.add(socket.id);

        if (room.readyPlayersForNextRound.size >= Object.keys(room.players).length) {
            startNewRound(room);
        }
    });

    socket.on('clientSync', (data) => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        const p = room.players[socket.id];
        if (p.hp <= 0) return;

        const now = Date.now();

        // BUG FIX: Rate-limit clientSync to prevent packet flooding (max 120 syncs/sec)
        if (now - (p._lastSyncTime || 0) < 8) return;
        p._lastSyncTime = now;

        // BUG FIX: Validate all incoming numbers before trusting them
        if (isValidNumber(data.x) && isValidNumber(data.y)) {
            // BUG FIX: Clamp position to map bounds server-side — a buggy or malicious
            // client cannot place themselves outside the map
            const clamped = clampPosition(data.x, data.y, p.playerRadius);
            p.x = clamped.x;
            p.y = clamped.y;
        }

        if (isValidNumber(data.aimAngle)) {
            p.aimAngle = data.aimAngle;
        }

        // Ritual activation — only trigger once per press (client debounces via keydown)
        if (data.ritualRequested && DomainManager && typeof DomainManager.activateDomain === 'function') {
            DomainManager.activateDomain(p);
        }

        // Reload — only start if not already reloading
        if (data.isReloading && !p.isReloading) {
            const fullAmmo = p.isRussianRoulette ? 6 : p.maxAmmo;
            if (p.ammo < fullAmmo) {
                p.isReloading = true;
                const rt = p.reloadTime || 1500;
                setTimeout(() => {
                    const rp = rooms[socket.roomId]?.players[socket.id];
                    if (rp) { rp.ammo = p.isRussianRoulette ? 6 : rp.maxAmmo; rp.isReloading = false; }
                }, rt);
            }
        }
    });

    socket.on('Dash', () => {
        const room = rooms[socket.roomId];
        if (room && room.players[socket.id] && room.players[socket.id].hp > 0) {
            socket.to(socket.roomId).emit('enemyDash', socket.id);
        }
    });

    socket.on('reload', () => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        const p = room.players[socket.id];
        if (p.hp <= 0 || p.isReloading) return;

        const fullAmmo = p.isRussianRoulette ? 6 : p.maxAmmo;
        if (p.ammo < fullAmmo) {
            p.isReloading = true;
            setTimeout(() => {
                const rp = rooms[socket.roomId]?.players[socket.id];
                if (rp) { rp.ammo = fullAmmo; rp.isReloading = false; }
            }, p.reloadTime || 1500);
        }
    });

    socket.on('playerShot', (bullets) => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        const p = room.players[socket.id];
        if (p.hp <= 0) return;

        const fullAmmo = p.isRussianRoulette ? 6 : p.maxAmmo;
        if (p.ammo > 0 && !p.isReloading) {
            p.ammo--;
            if (p.ammo <= 0) {
                p.isReloading = true;
                setTimeout(() => {
                    const rp = rooms[socket.roomId]?.players[socket.id];
                    if (rp) { rp.ammo = fullAmmo; rp.isReloading = false; }
                }, p.reloadTime || 1500);
            }
        }

        if (bullets) socket.to(socket.roomId).emit('enemyShot', bullets);
    });

    socket.on('bulletHitPlayer', (data) => {
        const room = rooms[socket.roomId];
        if (!room) return;

        const target  = room.players[data.targetId];
        const shooter = room.players[socket.id];

        if (!target || target.hp <= 0) return;
        if (target.isJackpotActive) return; // Jackpot = invincible

        let damageAmount;
        if (shooter && shooter.isRussianRoulette) {
            // 1-in-6 chance of massive shot; resolved server-side
            damageAmount = Math.random() < (1 / 6) ? 150 : 1;
        } else {
            damageAmount = Number(data.damage) || 20;
            // BUG FIX: Cap damage to a sane maximum to prevent exploit packets
            damageAmount = Math.min(damageAmount, 9999);
        }

        target.hp = Math.max(0, target.hp - damageAmount);

        if (shooter && isValidNumber(data.lifesteal) && data.lifesteal > 0) {
            shooter.hp = Math.min(shooter.maxHp, shooter.hp + damageAmount * Math.min(data.lifesteal, 1));
        }

        if (target.hp <= 0) {
            if (shooter) shooter.score++;
            // Move dead player off-screen until card selection / new round
            target.x = -9999;
            target.y = -9999;

            const alivePlayers = Object.values(room.players).filter(p => p.hp > 0);
            if (alivePlayers.length <= 1 && room.gameState === 'PLAYING') {
                // Small delay so the killing blow renders client-side before screen change
                setTimeout(() => initiateCardSelection(room), 800);
            }
        }
    });

    socket.on('disconnect', () => {
        const room = rooms[socket.roomId];
        if (!room) return;
        delete room.players[socket.id];
        io.to(socket.roomId).emit('updatePlayerList', Object.values(room.players));
        if (Object.keys(room.players).length === 0) {
            delete rooms[socket.roomId];
            console.log(`🗑️ Místnost ${socket.roomId} smazána (prázdná).`);
        }
    });
});

// --- HLAVNÍ HERNÍ SMYČKA ---
setInterval(() => {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        if (room.gameState !== 'PLAYING') continue;

        const allPlayers = Object.values(room.players);

        if (DomainManager && typeof DomainManager.updateDomains === 'function') {
            DomainManager.updateDomains(room.players, allPlayers, [], TICK_RATE);
        }

        const leanPlayers = {};
        for (const id in room.players) {
            const p = room.players[id];

            // HP regen (Ještěří krev card)
            if (p.hpRegen > 0 && p.hp > 0 && p.hp < p.maxHp) {
                p.hp = Math.min(p.maxHp, p.hp + p.hpRegen * (TICK_RATE / 1000));
            }

            // Jackpot: infinite ammo during buff
            if (p.isJackpotActive) {
                p.ammo = p.isRussianRoulette ? 6 : p.maxAmmo;
            }

            // BUG FIX: Include domainCooldown and domainRadius in leanPlayers.
            // Previously both were missing, so:
            //   - drawDomainHUD always showed "Cooldown: NaN" instead of real time
            //   - drawAvatar always drew domain circle with radius 200 instead of player's actual value
            leanPlayers[id] = {
                id:          p.id,
                name:        p.name,
                color:       p.color,
                team:        p.team,
                x:           p.x,
                y:           p.y,
                hp:          Math.round(p.hp),
                maxHp:       p.maxHp,
                aimAngle:    p.aimAngle,
                ammo:        p.ammo,
                maxAmmo:     p.maxAmmo,
                isReloading: p.isReloading,
                domainActive:   p.domainActive,
                domainType:     p.domainType,
                domainCooldown: p.domainCooldown,   // ← was missing
                domainRadius:   p.domainRadius,     // ← was missing
                score:       p.score,
                moveSpeed:   p.moveSpeed,
                damage:      p.damage,
                fireRate:    p.fireRate,
                bulletSpeed: p.bulletSpeed,
                bounces:     p.bounces,
                pierce:      p.pierce,
                lifesteal:   p.lifesteal,
                playerRadius:p.playerRadius,
                bulletSize:  p.bulletSize,
                multishot:   p.multishot,
                spread:      p.spread,
                isJackpotActive: p.isJackpotActive
            };
        }

        io.to(room.id).volatile.emit('gameUpdate', {
            players:    leanPlayers,
            maxScore:   room.settings.maxRounds,
            teamScores: room.teamScores,
            gameState:  room.gameState,
            gameMode:   room.settings.gameMode
        });
    }
}, TICK_RATE);

server.listen(PORT, () => {
    console.log(`\n🚀 SERVER QUANTUM CLASH BĚŽÍ NA PORTU ${PORT}`);
    console.log(`----------------------------------------`);
});
