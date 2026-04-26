// server.js
process.on('uncaughtException', (err) => {
    console.error('\n🚨 NEOŠETŘENÁ KRITICKÁ CHYBA SERVERU:');
    console.error(err.name, ':', err.message);
    console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error('\n🚨 NEOŠETŘENÝ PROMISE REJECTION:', reason);
});

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const fs      = require('fs');
const cors    = require('cors');

let DomainManager;
let gameHelper = {};
try {
    DomainManager = require('./domainManager.js');
    gameHelper    = require('./gameHelper.js') || {};
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

// ---------------------------------------------------------------------------
// SHARED FILE LOADER
// ---------------------------------------------------------------------------
const loadSharedFile = (fileName, expectedVar) => {
    const pathsToTry = [
        path.join(__dirname, 'public', fileName),
        path.join(__dirname, 'public', 'game', fileName),
        path.join(__dirname, fileName)
    ];
    for (const p of pathsToTry) {
        if (!fs.existsSync(p)) continue;
        try {
            const raw = fs.readFileSync(p, 'utf-8');
            const sanitized = raw
                .replace(/^\s*export\s+(const|let|var|function|class)\s+/gm, '$1 ')
                .replace(/^\s*export\s+default\s+/gm, '')
                .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')
                .replace(/^\s*import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '');
            const fn = new Function(`
                ${sanitized}
                if (typeof ${expectedVar} !== 'undefined') return ${expectedVar};
                return null;
            `);
            return fn();
        } catch (e) {
            console.error(`❌ loadSharedFile error in ${p}:`, e.message);
            return null;
        }
    }
    return null;
};

const loadedConfig   = loadSharedFile('gameConfig.js', 'CONFIG') || {};
const rawCards       = loadSharedFile('cards.js', 'availableCards');
const availableCards = Array.isArray(rawCards) ? rawCards : [];
console.log(`✅ Načteno ${availableCards.length} karet.`);

const CONFIG = {
    MAP_WIDTH:        loadedConfig.MAP_WIDTH        || 1920,
    MAP_HEIGHT:       loadedConfig.MAP_HEIGHT       || 1080,
    FPS:              loadedConfig.FPS              || 60,
    MAX_SCORE:        loadedConfig.MAX_SCORE        || 25,
    RESPAWN_TIME:     loadedConfig.RESPAWN_TIME     || 3000,
    BASE_HP:          loadedConfig.BASE_HP          || 100,
    BASE_MOVE_SPEED:  loadedConfig.BASE_MOVE_SPEED  || 0.8,
    BASE_DAMAGE:      loadedConfig.BASE_DAMAGE      || 20,
    BASE_FIRE_RATE:   loadedConfig.BASE_FIRE_RATE   || 400,
    BASE_BULLET_SPEED:loadedConfig.BASE_BULLET_SPEED|| 15,
    BASE_AMMO:        loadedConfig.BASE_AMMO        || 10,
    BASE_RELOAD_TIME: loadedConfig.BASE_RELOAD_TIME || 1500,
    PLAYER_RADIUS:    loadedConfig.PLAYER_RADIUS    || 20,
    BULLET_RADIUS:    5
};

const PORT      = process.env.PORT || 3000;
const TICK_RATE = 1000 / CONFIG.FPS;
const rooms     = {};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function isValidNumber(v) {
    return typeof v === 'number' && isFinite(v) && !isNaN(v);
}

/**
 * Reset a single player's hp/ammo/state and assign a safe spawn point.
 * usedPositions is mutated — the new spawn is pushed to it so subsequent
 * calls within the same round don't overlap.
 */
function resetPlayer(p, room, usedPositions = []) {
    p.hp          = p.maxHp;
    p.ammo        = p.isRussianRoulette ? 6 : p.maxAmmo;
    p.isReloading = false;
    p.isInvisible = false;
    p.domainActive = false;
    p.domainTimer  = 0;
    // domainCooldown intentionally NOT reset — dying shouldn't skip the cooldown

    const playerIndex = Object.keys(room.players).indexOf(p.id);
    const spawn = gameHelper.getValidSpawnPoint
        ? gameHelper.getValidSpawnPoint(
            playerIndex,
            CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT,
            room.map?.obstacles  || [],
            room.map?.breakables || [],
            p.playerRadius || CONFIG.PLAYER_RADIUS,
            usedPositions   // ← pass already-used spots so no two players share one
          )
        : { x: CONFIG.MAP_WIDTH / 2, y: CONFIG.MAP_HEIGHT / 2 };

    p.x = spawn.x;
    p.y = spawn.y;
    usedPositions.push({ x: spawn.x, y: spawn.y });
}

/**
 * Reset all players for a new round, assigning unique spawn points.
 */
function resetAllPlayers(room) {
    const usedPositions = [];
    Object.values(room.players).forEach(p => resetPlayer(p, room, usedPositions));
}

// ---------------------------------------------------------------------------
// CARD SELECTION  (LOSERS ONLY)
// ---------------------------------------------------------------------------
/**
 * NEW MECHANIC: Only players who DIED during the round get to pick a card.
 * The winner keeps their build as-is (they earned it by surviving).
 *
 * room.loserIds  — Set of socket IDs that died this round (populated in bulletHitPlayer)
 * room.loserCardsPicked — Set of IDs that have already picked this phase
 */
function initiateCardSelection(room) {
    if (room.gameState === 'CARD_SELECTION') return; // prevent double-trigger
    room.gameState        = 'CARD_SELECTION';
    room.loserCardsPicked = new Set();

    const loserIds = room.loserIds || new Set();

    if (loserIds.size === 0) {
        // No one died (shouldn't normally happen) — skip straight to new round
        console.log('⚠️ initiateCardSelection: nikdo nezemřel, přeskočení výběru karet.');
        setTimeout(() => startNewRound(room), 500);
        return;
    }

    // Send card selection ONLY to losers
    loserIds.forEach(id => {
        const player = room.players[id];
        if (!player) return;
        const selection = gameHelper.generateCardsForPlayer
            ? gameHelper.generateCardsForPlayer(player, availableCards)
            : availableCards.slice(0, 3);
        io.to(id).emit('showCardSelection', selection);
    });

    // Tell everyone the state changed (so winner sees a "waiting" screen)
    io.to(room.id).emit('gameStateChanged', {
        state:       'CARD_SELECTION',
        losersCount: loserIds.size
    });
}

// ---------------------------------------------------------------------------
// NEW ROUND
// ---------------------------------------------------------------------------
function startNewRound(room) {
    room.round        = (room.round || 1) + 1;
    room.gameState    = 'PLAYING';
    room.loserIds     = new Set(); // reset for the new round
    room.loserCardsPicked = new Set();

    room.map = gameHelper.generateMap
        ? gameHelper.generateMap(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT)
        : { obstacles: [], breakables: [] };

    resetAllPlayers(room);

    io.to(room.id).emit('mapUpdate', room.map);
    io.to(room.id).emit('gameStateChanged', {
        state:     'PLAYING',
        round:     room.round,
        obstacles: room.map.obstacles,
        breakables:room.map.breakables
    });
}

// ---------------------------------------------------------------------------
// SOCKET HANDLERS
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {

    socket.on('createRoom', (data) => {
        const roomId    = Math.random().toString(36).substring(2, 7).toUpperCase();
        const initialMap = gameHelper.generateMap
            ? gameHelper.generateMap(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT)
            : { obstacles: [], breakables: [] };

        rooms[roomId] = {
            id: roomId,
            players:      {},
            gameState:    'LOBBY',
            round:        1,
            map:          initialMap,
            teamScores:   { blue: 0, red: 0 },
            settings:     { maxRounds: CONFIG.MAX_SCORE, gameMode: 'FFA' },
            loserIds:     new Set(),   // tracks who died THIS round
            loserCardsPicked: new Set()
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

        const safeName  = String(data.name  || 'Hráč').replace(/</g, '').substring(0, 24);
        const safeColor = /^#[0-9A-Fa-f]{6}$/.test(data.color) ? data.color : '#45f3ff';

        room.players[socket.id] = {
            id:       socket.id,
            name:     safeName,
            color:    safeColor,
            cosmetic: 'none',
            team:     Object.keys(room.players).length % 2 === 0 ? 'blue' : 'red',
            x: 0, y: 0,
            hp: CONFIG.BASE_HP,  maxHp: CONFIG.BASE_HP,
            ammo: CONFIG.BASE_AMMO, maxAmmo: CONFIG.BASE_AMMO,
            moveSpeed:   CONFIG.BASE_MOVE_SPEED,
            damage:      CONFIG.BASE_DAMAGE,
            fireRate:    CONFIG.BASE_FIRE_RATE,
            bulletSpeed: CONFIG.BASE_BULLET_SPEED,
            reloadTime:  CONFIG.BASE_RELOAD_TIME,
            lifesteal: 0, bounces: 0, pierce: 0,
            playerRadius: CONFIG.PLAYER_RADIUS,
            bulletSize:   CONFIG.BULLET_RADIUS,
            multishot: 1, spread: 0,
            score: 0, isReady: false,
            hpRegen: 0,
            isRussianRoulette: false,
            domainType:   null,
            domainActive: false,
            domainCooldown: 0,
            domainTimer:  0,
            domainRadius: 200,
            isJackpotActive: false,
            jackpotTimer: 0,
            jackpotPity:  0,
            baseSpeed:    CONFIG.BASE_MOVE_SPEED,
            _lastSyncTime: 0
        };

        const usedPositions = Object.values(room.players)
            .filter(p => p.id !== socket.id && p.x !== 0)
            .map(p => ({ x: p.x, y: p.y }));

        resetPlayer(room.players[socket.id], room, usedPositions);
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
            room.loserIds  = new Set();
            io.to(room.id).emit('gameStateChanged', {
                state:      'PLAYING',
                obstacles:  room.map.obstacles,
                breakables: room.map.breakables
            });
        }
    });

    // CARD SELECTION — only losers can pick; winner's selectCard is ignored
    socket.on('selectCard', (cardName) => {
        const room = rooms[socket.roomId];
        if (!room || room.gameState !== 'CARD_SELECTION') return;

        // Only losers may pick a card
        if (!room.loserIds || !room.loserIds.has(socket.id)) {
            console.log(`⚠️ selectCard od výherce ${socket.id} — ignorováno.`);
            return;
        }

        // Prevent double-picking
        if (!room.loserCardsPicked) room.loserCardsPicked = new Set();
        if (room.loserCardsPicked.has(socket.id)) return;
        room.loserCardsPicked.add(socket.id);

        const player = room.players[socket.id];
        const card   = availableCards.find(c => c.name === cardName);
        if (player && card && typeof card.apply === 'function') {
            card.apply(player);
            console.log(`✅ ${player.name} zvolil kartu: ${cardName}`);
        }

        // Start next round when ALL losers have picked
        if (room.loserCardsPicked.size >= room.loserIds.size) {
            startNewRound(room);
        }
    });

    socket.on('clientSync', (data) => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        const p = room.players[socket.id];
        if (p.hp <= 0) return;

        const now = Date.now();
        // Rate-limit: max 120 syncs/sec
        if (now - (p._lastSyncTime || 0) < 8) return;
        p._lastSyncTime = now;

        if (isValidNumber(data.x) && isValidNumber(data.y)) {
            // Clamp to map bounds server-side
            const r = p.playerRadius || CONFIG.PLAYER_RADIUS;
            p.x = Math.max(r, Math.min(CONFIG.MAP_WIDTH  - r, data.x));
            p.y = Math.max(r, Math.min(CONFIG.MAP_HEIGHT - r, data.y));
        }
        if (isValidNumber(data.aimAngle)) p.aimAngle = data.aimAngle;

        // Ritual — rising edge only
        if (data.ritualRequested && DomainManager && typeof DomainManager.activateDomain === 'function') {
            DomainManager.activateDomain(p);
        }

        // Reload
        if (data.isReloading && !p.isReloading) {
            const fullAmmo = p.isRussianRoulette ? 6 : p.maxAmmo;
            if (p.ammo < fullAmmo) {
                p.isReloading = true;
                setTimeout(() => {
                    const rp = rooms[socket.roomId]?.players[socket.id];
                    if (rp) { rp.ammo = fullAmmo; rp.isReloading = false; }
                }, p.reloadTime || 1500);
            }
        }
    });

    // Dash — server just rebroadcasts for visual effect; movement is client-side
    socket.on('Dash', () => {
        const room = rooms[socket.roomId];
        if (room && room.players[socket.id]?.hp > 0) {
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
        if (target.isJackpotActive) return;

        let dmg;
        if (shooter?.isRussianRoulette) {
            dmg = Math.random() < (1 / 6) ? 150 : 1;
        } else {
            dmg = Math.min(Number(data.damage) || 20, 9999);
        }

        target.hp = Math.max(0, target.hp - dmg);

        if (shooter && isValidNumber(data.lifesteal) && data.lifesteal > 0) {
            shooter.hp = Math.min(shooter.maxHp, shooter.hp + dmg * Math.min(data.lifesteal, 1));
        }

        if (target.hp <= 0) {
            if (shooter) shooter.score++;

            // CARD MECHANIC: register this player as a loser for this round
            if (!room.loserIds) room.loserIds = new Set();
            room.loserIds.add(target.id);

            // Move dead player off-screen
            target.x = -9999;
            target.y = -9999;

            // Check if only 0 or 1 players remain alive
            const alivePlayers = Object.values(room.players).filter(p => p.hp > 0);
            if (alivePlayers.length <= 1 && room.gameState === 'PLAYING') {
                // Small delay so the killing blow renders on all clients
                setTimeout(() => initiateCardSelection(room), 800);
            }
        }
    });

    socket.on('disconnect', () => {
        const room = rooms[socket.roomId];
        if (!room) return;
        delete room.players[socket.id];
        if (room.loserIds) room.loserIds.delete(socket.id);
        io.to(socket.roomId).emit('updatePlayerList', Object.values(room.players));
        if (Object.keys(room.players).length === 0) {
            delete rooms[socket.roomId];
            console.log(`🗑️ Místnost ${socket.roomId} smazána.`);
        }
    });
});

// ---------------------------------------------------------------------------
// GAME LOOP
// ---------------------------------------------------------------------------
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

            leanPlayers[id] = {
                id:           p.id,
                name:         p.name,
                color:        p.color,
                team:         p.team,
                x:            p.x,
                y:            p.y,
                hp:           Math.round(p.hp),
                maxHp:        p.maxHp,
                aimAngle:     p.aimAngle,
                ammo:         p.ammo,
                maxAmmo:      p.maxAmmo,
                isReloading:  p.isReloading,
                domainActive: p.domainActive,
                domainType:   p.domainType,
                domainCooldown: p.domainCooldown,  // ← needed for HUD
                domainRadius: p.domainRadius,      // ← needed for domain ring
                score:        p.score,
                moveSpeed:    p.moveSpeed,
                damage:       p.damage,
                fireRate:     p.fireRate,
                bulletSpeed:  p.bulletSpeed,
                bounces:      p.bounces,
                pierce:       p.pierce,
                lifesteal:    p.lifesteal,
                playerRadius: p.playerRadius,
                bulletSize:   p.bulletSize,
                multishot:    p.multishot,
                spread:       p.spread,
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
