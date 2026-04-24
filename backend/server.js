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
}

const app = express();
app.use(cors());

// Nastavení statických souborů
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 1000, 
    pingTimeout: 3000
});

// --- FUNKCE PRO NAČÍTÁNÍ CONFIGU A KARET ---
const loadSharedFile = (fileName, expectedVar) => {
    const pathsToTry = [ path.join(__dirname, 'public', fileName), path.join(__dirname, 'public', 'game', fileName), path.join(__dirname, fileName) ];
    for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
            try {
                let raw = fs.readFileSync(p, 'utf-8');
                const sanitized = raw.replace(/^\s*export\s+(const|let|var|function|class)\s+/gm, '$1 ')
                                     .replace(/^\s*export\s+default\s+/gm, '')
                                     .replace(/^\s*export\s*\{([^}]*)\}\s*;?\s*$/gm, '')
                                     .replace(/^\s*import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '');
                const extractData = new Function(`
                    ${sanitized}
                    if (typeof ${expectedVar} !== 'undefined') return ${expectedVar};
                    return null;
                `);
                return extractData();
            } catch (err) { return null; }
        }
    }
    return null;
};

// OPRAVA DUPLICITNÍHO CONFIGU
const loadedConfig = loadSharedFile('gameConfig.js', 'CONFIG') || {};
const availableCards = loadSharedFile('cards.js', 'availableCards') || [];

// Funkce pro filtrování karet hráče
function getValidCardsForPlayer(player) {
    return availableCards.filter(card => {
        if (card.rarity === 'transcended' && !card.requiresDomain) {
            if (player.domainType) return false;
        }
        if (card.requiresDomain && !card.specificDomain) {
            if (!player.domainType) return false;
        }
        if (card.specificDomain) {
            if (player.domainType !== card.specificDomain) return false;
        }
        return true;
    });
}

const CONFIG = {
    MAP_WIDTH: loadedConfig.MAP_WIDTH || 1920,
    MAP_HEIGHT: loadedConfig.MAP_HEIGHT || 1080,
    FPS: loadedConfig.FPS || 60,
    MAX_SCORE: loadedConfig.MAX_SCORE || 25,
    RESPAWN_TIME: loadedConfig.RESPAWN_TIME || 3000,
    BASE_HP: loadedConfig.BASE_HP || 100,
    BASE_MOVE_SPEED: loadedConfig.BASE_MOVE_SPEED || 0.8,
    BASE_DAMAGE: loadedConfig.BASE_DAMAGE || 20,
    BASE_FIRE_RATE: loadedConfig.BASE_FIRE_RATE || 400,
    BASE_BULLET_SPEED: loadedConfig.BASE_BULLET_SPEED || 15,
    BASE_AMMO: loadedConfig.BASE_AMMO || 10,
    BASE_RELOAD_TIME: loadedConfig.BASE_RELOAD_TIME || 1500,
    PLAYER_RADIUS: loadedConfig.PLAYER_RADIUS || 20,
    BULLET_RADIUS: 5
};

const PORT = process.env.PORT || 3000;
const TICK_RATE = 1000 / CONFIG.FPS;
const rooms = {};

// --- POMOCNÉ FUNKCE PRO HRU ---
function generateObstaclesForRound(round) {
    if (round === 1) return []; // Kolo 1 je čisté
    const obstacles = [];
    const count = 1 + (round * 3); // Kolo 2 má 7 zdí, kolo 3 jich má 10 atd.
    for (let i = 0; i < count; i++) {
        obstacles.push({
            x: Math.random() * (CONFIG.MAP_WIDTH - 400) + 200,
            y: Math.random() * (CONFIG.MAP_HEIGHT - 300) + 150,
            width: Math.random() * 150 + 50,
            height: Math.random() * 150 + 50
        });
    }
    return obstacles;
}

function resetPlayer(p, team, map, room) {
    p.hp = p.maxHp;
    p.ammo = p.isRussianRoulette ? 6 : p.maxAmmo;
    p.isReloading = false;
    p.isInvisible = false;
    p.domainActive = false;

    const mapW = CONFIG.MAP_WIDTH || 1920;
    const mapH = CONFIG.MAP_HEIGHT || 1080;
    const spawn = gameHelper.getValidSpawnPoint 
        ? gameHelper.getValidSpawnPoint(Object.keys(room.players).indexOf(p.id), mapW, mapH, room.map?.obstacles || [], room.map?.breakables || [], 20)
        : { x: mapW/2, y: mapH/2 };
    p.x = spawn.x;
    p.y = spawn.y;
}

function initiateCardSelection(room) {
    room.gameState = 'CARD_SELECTION';
    if (!room.readyPlayersForNextRound) room.readyPlayersForNextRound = new Set();
    room.readyPlayersForNextRound.clear();
    
    Object.values(room.players).forEach(player => {
        const selection = gameHelper.generateCardsForPlayer ? gameHelper.generateCardsForPlayer(player, availableCards) : [];
        io.to(player.id).emit('showCardSelection', selection);
    });
    
    io.to(room.id).emit('gameStateChanged', { state: 'CARD_SELECTION' });
}

function startNewRound(room) {
    room.round = (room.round || 1) + 1;
    room.gameState = 'PLAYING';
    
    if (gameHelper.generateMap) {
        room.map = gameHelper.generateMap(CONFIG.MAP_WIDTH || 1920, CONFIG.MAP_HEIGHT || 1080);
    } else {
        room.map.obstacles = generateObstaclesForRound(room.round);
    }

    Object.values(room.players).forEach(p => {
        resetPlayer(p, p.team, room.map, room);
    });

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
        rooms[roomId] = {
            id: roomId,
            players: {},
            gameState: 'LOBBY',
            round: 1,
            map: gameHelper.generateMap ? gameHelper.generateMap(CONFIG.MAP_WIDTH || 1920, CONFIG.MAP_HEIGHT || 1080) : { obstacles: generateObstaclesForRound(1), breakables: [] },
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
            reloadTime: CONFIG.BASE_RELOAD_TIME,
            lifesteal: 0, bounces: 0, pierce: 0,
            score: 0, isReady: false,
            hpRegen: 0, isRussianRoulette: false
        };

        resetPlayer(room.players[socket.id], room.players[socket.id].team, room.map, room);
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

    socket.on('selectCard', (cardName) => {
        const room = rooms[socket.roomId];
        if (!room || room.gameState !== 'CARD_SELECTION') return;

        const player = room.players[socket.id];
        const card = availableCards.find(c => c.name === cardName);

        if (player && card && card.apply) {
            card.apply(player);
            console.log(`Hráč ${player.name} vybral kartu: ${cardName}`);
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
        
        p.x = data.x;
        p.y = data.y;
        p.aimAngle = data.aimAngle;

        if (data.ritual && DomainManager && typeof DomainManager.activateDomain === 'function') {
            DomainManager.activateDomain(p, room);
        }

        if (data.isReloading && !p.isReloading && p.ammo < p.maxAmmo) {
            p.isReloading = true;
            setTimeout(() => {
                if (rooms[socket.roomId] && rooms[socket.roomId].players[socket.id]) {
                    const rp = rooms[socket.roomId].players[socket.id];
                    rp.ammo = rp.isRussianRoulette ? 6 : rp.maxAmmo;
                    rp.isReloading = false;
                }
            }, p.reloadTime || 1500);
        }
    });

    socket.on('Dash', () => {
        const room = rooms[socket.roomId];
        if (room && room.players[socket.id]) {
            const p = room.players[socket.id];
            if (p.hp > 0) {
                socket.to(socket.roomId).emit('enemyDash', socket.id);
            }
        }
    });

    socket.on('reload', () => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        
        const p = room.players[socket.id];
        
        if (p.hp <= 0) return;

        if (!p.isReloading && p.ammo < p.maxAmmo) {
            p.isReloading = true;
            setTimeout(() => {
                if (rooms[socket.roomId] && rooms[socket.roomId].players[socket.id]) {
                    const rp = rooms[socket.roomId].players[socket.id];
                    rp.ammo = rp.isRussianRoulette ? 6 : rp.maxAmmo;
                    rp.isReloading = false;
                }
            }, p.reloadTime || 1500);
        }
    });

    socket.on('playerShot', (bullets) => {
        if (!socket.roomId) return;
        const room = rooms[socket.roomId];
        if (room && room.players[socket.id]) {
            const p = room.players[socket.id];
            
            if (p.hp <= 0) return;

            if (p.ammo > 0 && !p.isReloading) {
                p.ammo--;

                if (p.isRussianRoulette) {
                    bullets.forEach(b => { if(Math.random() < 0.166) b.damage *= 5; });
                }
                
                if (p.ammo <= 0) {
                    p.isReloading = true;
                    setTimeout(() => {
                        if (rooms[socket.roomId] && rooms[socket.roomId].players[socket.id]) {
                            const rp = rooms[socket.roomId].players[socket.id];
                            rp.ammo = rp.isRussianRoulette ? 6 : rp.maxAmmo;
                            rp.isReloading = false;
                        }
                    }, p.reloadTime || 1500);
                }
            }
        }
        socket.to(socket.roomId).emit('enemyShot', bullets);
    });

    socket.on('bulletHitPlayer', (data) => {
        const room = rooms[socket.roomId];
        if (!room) return;
        
        const target = room.players[data.targetId];
        const shooter = room.players[socket.id];

        if (target && target.hp > 0) {
            const damageAmount = Number(data.damage) || 20; 
            target.hp -= damageAmount;
            
            if (shooter && data.lifesteal > 0) {
                shooter.hp = Math.min(shooter.maxHp, shooter.hp + (damageAmount * data.lifesteal));
            }
            
            if (target.hp <= 0) {
                target.hp = 0;
                if (shooter) shooter.score++;
                
                target.x = -5000;
                target.y = -5000;
                
                const alivePlayers = Object.values(room.players).filter(p => p.hp > 0);
                if (alivePlayers.length <= 1 && room.gameState === 'PLAYING') {
                    initiateCardSelection(room);
                }
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

        if (DomainManager && typeof DomainManager.updateDomains === 'function') {
            DomainManager.updateDomains(Object.values(room.players), room);
        }

        const leanPlayers = {};
        for (const id in room.players) {
            const p = room.players[id];
            
            if (p.hp > 0 && p.hpRegen > 0) {
                p.hp = Math.min(p.maxHp, p.hp + (p.hpRegen / (CONFIG.FPS || 60)));
            }
            
            leanPlayers[id] = {
                id: p.id, name: p.name, color: p.color, cosmetic: p.cosmetic, team: p.team,
                x: p.x, y: p.y,
                hp: Math.round(p.hp), maxHp: p.maxHp,
                aimAngle: p.aimAngle,
                ammo: p.ammo, maxAmmo: p.maxAmmo,
                isReloading: p.isReloading, isInvisible: p.isInvisible,
                domainActive: p.domainActive, score: p.score,
                isReady: p.isReady, moveSpeed: p.moveSpeed,
                damage: p.damage, fireRate: p.fireRate,
                bulletSpeed: p.bulletSpeed, bounces: p.bounces,
                pierce: p.pierce, lifesteal: p.lifesteal
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