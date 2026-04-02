const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Povolí připojení z jakéhokoliv frontendu
        methods: ["GET", "POST"]
    }
});

// Zajišťuje, že se načtou statické soubory ze složky dist (Vite build)
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Catch-all routa pro SPA (Single Page Application)
app.get('*', (req, res) => {
    const indexPath = path.join(frontendDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Hra se načítá nebo build frontendu ještě neexistuje. Spusťte 'npm run build' ve složce frontend.");
    }
});

// --- NASTAVENÍ MAPY A KONSTANTY ---
let availableCards = [];
try {
    const rawCards = require(path.join(__dirname, 'cards.js'));
    // Bezpečné načtení pole karet
    availableCards = Array.isArray(rawCards) ? rawCards : (rawCards.availableCards || Object.values(rawCards) || []);
    if (availableCards.length === 0) console.warn("⚠️ Nebyly nalezeny žádné karty v cards.js.");
} catch (e) {
    console.warn("⚠️ Nepodařilo se načíst cards.js z backendu. Hra poběží bez karet.", e.message);
}

let gameConfig = {};
try {
    gameConfig = require(path.join(__dirname, 'gameConfig.js'));
} catch (e) {
    console.warn("⚠️ Nepodařilo se načíst gameConfig.js. Použijí se výchozí hodnoty.", e.message);
}

// Destrukturalizace s defaultními hodnotami pro případ chybějícího configu
const {
    MAP_WIDTH = 2000, MAP_HEIGHT = 2000, PLAYER_RADIUS = 20,
    BASE_HP = 100, BASE_DAMAGE = 20, BASE_FIRE_RATE = 400, BASE_BULLET_SPEED = 15, BASE_MOVE_SPEED = 0.8,
    BASE_AMMO = 10, BASE_RELOAD_TIME = 1500,
    MAX_CAP_HP = 500, MIN_CAP_HP = 10, MAX_CAP_DAMAGE = 150, MIN_CAP_FIRE_RATE = 50,
    MAX_CAP_MOVE_SPEED = 2.8, MIN_CAP_MOVE_SPEED = 0.2, MAX_CAP_BULLET_SPEED = 45, MAX_CAP_AMMO = 50,
    GRAVITY_OPTIONS = [{ name: "Normal", x: 0, y: 0 }], GRAVITY_CHANGE_INTERVAL = 10000
} = gameConfig;

const rooms = {};
const RARITY_WEIGHTS = { 'common': 100, 'rare': 40, 'epic': 15, 'legendary': 5 };

const uiCatalog = availableCards.map(c => ({
    name: c.name, initials: c.initials, icon: c.icon, desc: c.desc, rarity: c.rarity
}));

// ==========================================
// POMOCNÉ FUNKCE 
// ==========================================

function broadcastLobbyUpdate(room) {
    if (!room) return;
    io.to(room.id).emit('lobbyUpdated', {
        hostId: room.hostId, 
        gameMode: room.gameMode, 
        limit: room.matchScoreLimit, 
        gravityEnabled: room.gravityEnabled, 
        players: room.players
    });
}

function applyHardCaps(p) {
    if(!p) return;
    p.maxHp = Math.max(MIN_CAP_HP, Math.min(MAX_CAP_HP, p.maxHp || BASE_HP));
    p.hp = Math.min(p.hp, p.maxHp);
    p.damage = Math.min(MAX_CAP_DAMAGE, p.damage || BASE_DAMAGE);
    p.fireRate = Math.max(MIN_CAP_FIRE_RATE, p.fireRate || BASE_FIRE_RATE);
    p.moveSpeed = Math.max(MIN_CAP_MOVE_SPEED, Math.min(MAX_CAP_MOVE_SPEED, p.moveSpeed || BASE_MOVE_SPEED));
    p.bulletSpeed = Math.min(MAX_CAP_BULLET_SPEED, p.bulletSpeed || BASE_BULLET_SPEED);
    p.maxAmmo = Math.min(MAX_CAP_AMMO, p.maxAmmo || BASE_AMMO);
}

function resetPlayerStatsToBase(p) {
    if(!p) return;
    p.maxHp = BASE_HP; p.hp = p.maxHp;
    p.damage = BASE_DAMAGE; p.fireRate = BASE_FIRE_RATE;
    p.bulletSpeed = BASE_BULLET_SPEED; p.moveSpeed = BASE_MOVE_SPEED;
    p.maxAmmo = BASE_AMMO; p.ammo = p.maxAmmo;
    p.reloadTime = BASE_RELOAD_TIME;
    p.isReloading = false; p.domainType = undefined; p.multishot = 1;
    p.spread = 0.1; p.bounces = 0; p.pierce = 0; p.lifesteal = 0;
    p.cards = [];
    p.inputs = { up: false, down: false, left: false, right: false, click: false, rightClick: false, aimAngle: 0, reload: false, dash: false };
}

function checkRectCollision(x, y, radius, rect) {
    return (x + radius > rect.x && x - radius < rect.x + rect.width &&
            y + radius > rect.y && y - radius < rect.y + rect.height);
}

function generateMap() {
    let obstacles = [
        { x: -50, y: -50, width: MAP_WIDTH + 100, height: 50 },
        { x: -50, y: MAP_HEIGHT, width: MAP_WIDTH + 100, height: 50 },
        { x: -50, y: 0, width: 50, height: MAP_HEIGHT },
        { x: MAP_WIDTH, y: 0, width: 50, height: MAP_HEIGHT }
    ];
    let breakables = [];

    for (let i = 0; i < 7; i++) {
        let width = Math.floor(Math.random() * 150) + 80;
        let height = Math.floor(Math.random() * 150) + 80;
        let x = Math.floor(Math.random() * (MAP_WIDTH - width - 100)) + 50;
        let y = Math.floor(Math.random() * (MAP_HEIGHT - height - 100)) + 50;
        obstacles.push({ x, y, width, height });
    }

    for (let i = 0; i < 8; i++) {
        let isHorizontal = Math.random() > 0.5;
        let width = isHorizontal ? 150 : 30;
        let height = isHorizontal ? 30 : 150;
        let x = Math.floor(Math.random() * (MAP_WIDTH - width - 100)) + 50;
        let y = Math.floor(Math.random() * (MAP_HEIGHT - height - 100)) + 50;
        breakables.push({ id: i, x, y, width, height, destroyed: false });
    }
    return { obstacles, breakables };
}

function getValidSpawnPoint(players, obstacles, breakables) {
    let maxAttempts = 100;
    let pr = PLAYER_RADIUS + 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let testX = Math.random() * (MAP_WIDTH - 100) + 50;
        let testY = Math.random() * (MAP_HEIGHT - 100) + 50;
        let isValid = true;

        for (let obs of obstacles) { if (checkRectCollision(testX, testY, pr, obs)) { isValid = false; break; } }
        if (!isValid) continue;

        for (let wall of breakables) { if (!wall.destroyed && checkRectCollision(testX, testY, pr, wall)) { isValid = false; break; } }
        if (!isValid) continue;

        return { x: testX, y: testY };
    }
    return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }; 
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

function createPlayerTemplate(playerName, playerColor, playerTeam, playerCosmetic) {
    return {
        x: 0, y: 0, aimAngle: 0,
        hp: BASE_HP, maxHp: BASE_HP,
        damage: BASE_DAMAGE, fireRate: BASE_FIRE_RATE, bulletSpeed: BASE_BULLET_SPEED, moveSpeed: BASE_MOVE_SPEED,
        maxAmmo: BASE_AMMO, ammo: BASE_AMMO,
        name: String(playerName || "Hráč").substring(0, 15), 
        color: String(playerColor || "#ff4757").substring(0, 7), 
        cosmetic: playerCosmetic || "none", team: playerTeam || "none", score: 0,
        isReady: false, isReloading: false, domainActive: false, isInvisible: false,
        cards: [],
        inputs: { up: false, down: false, left: false, right: false, click: false, rightClick: false, aimAngle: 0, reload: false, dash: false }
    };
}

function generateCardsForPlayer(player) {
    if (!availableCards || availableCards.length === 0) return [];
    
    let pickedIndices = [];
    let cardsToSend = [];
    
    let validCards = availableCards.map((c, i) => ({ originalIndex: i, data: c })).filter(c => {
        if (c.data.requiresDomain && !player.domainType) return false;
        if (c.data.specificDomain && player.domainType !== c.data.specificDomain) return false;
        return true;
    });

    while (cardsToSend.length < 3 && pickedIndices.length < validCards.length) {
        let unpickedValidCards = validCards.filter(c => !pickedIndices.includes(c.originalIndex));
        if (unpickedValidCards.length === 0) break;

        let totalWeight = 0;
        let weightedCards = unpickedValidCards.map(c => {
            let rarity = (c.data.rarity || 'common').toLowerCase();
            let weight = RARITY_WEIGHTS[rarity] || 10;
            totalWeight += weight;
            return { card: c, weight: weight };
        });

        let randomPick = Math.random() * totalWeight;
        let cumulativeWeight = 0;
        let selected = null;

        for (let item of weightedCards) {
            cumulativeWeight += item.weight;
            if (randomPick <= cumulativeWeight) {
                selected = item.card;
                break;
            }
        }

        if (!selected) selected = weightedCards[weightedCards.length - 1].card;

        pickedIndices.push(selected.originalIndex);
        cardsToSend.push({ ...selected.data, globalIndex: selected.originalIndex });
    }
    return cardsToSend;
}

// ==========================================
// HERNÍ LOGIKA
// ==========================================

function startNextRound(room) {
    if (!room) return;
    let activePlayersCount = Object.keys(room.players).length;
    
    // Záchrana, pokud během načítání někdo odejde a zbude 1 hráč
    if (activePlayersCount < 2) {
        room.gameState = 'LOBBY';
        io.to(room.id).emit('gameStateChanged', { state: 'LOBBY', roomCode: room.id, scoreLimit: room.matchScoreLimit });
        Object.values(room.players).forEach(p => p.isReady = false);
        broadcastLobbyUpdate(room);
        return;
    }

    room.roundNumber = (room.roundNumber || 0) + 1;
    let mapData = generateMap();
    room.obstacles = mapData.obstacles;
    room.breakables = mapData.breakables;
    room.deadPlayersThisRound = [];
    if (room.processedHits) room.processedHits.clear(); 

    io.to(room.id).emit('mapUpdate', { obstacles: room.obstacles, breakables: room.breakables });

    Object.keys(room.players).forEach(id => {
        let sp = getValidSpawnPoint(room.players, room.obstacles, room.breakables);
        let p = room.players[id];
        applyHardCaps(p);
        p.hp = p.maxHp; p.x = sp.x; p.y = sp.y; p.ammo = p.maxAmmo;
        p.isReloading = false; p.domainActive = false; p.isInvisible = false;
        p.inputs = { up: false, down: false, left: false, right: false, click: false, rightClick: false, aimAngle: 0, reload: false, dash: false };
    });

    room.gameState = 'PLAYING';

    if (room.gravityEnabled && GRAVITY_OPTIONS.length > 0) {
        room.currentGravity = GRAVITY_OPTIONS[Math.floor(Math.random() * GRAVITY_OPTIONS.length)];
        io.to(room.id).emit('gravityChanged', room.currentGravity.name);
    }
    
    io.to(room.id).emit('gameStateChanged', { state: 'PLAYING' });
}

function handleDeath(room, victimId) {
    if (!room || room.gameState !== 'PLAYING') return;

    if (room.players[victimId]) {
        if (!room.deadPlayersThisRound.includes(victimId)) room.deadPlayersThisRound.push(victimId);
        room.players[victimId].hp = 0;
    }

    let alive = Object.keys(room.players).filter(id => room.players[id].hp > 0);
    let roundWinnerTeam = null;
    let roundWinnerId = null;

    if (room.gameMode === 'tdm') {
        if (alive.length > 0) {
            let firstAliveTeam = room.players[alive[0]].team;
            if (firstAliveTeam !== "none" && alive.every(id => room.players[id].team === firstAliveTeam)) {
                roundWinnerTeam = firstAliveTeam;
            }
        }
    } else {
        if (alive.length <= 1) roundWinnerId = alive.length === 1 ? alive[0] : null;
    }

    // Vyhodnocení kola
    if (alive.length <= 1 || roundWinnerTeam) {
        if (room.gameMode === 'tdm' && roundWinnerTeam) {
            room.teamScores[roundWinnerTeam] = (room.teamScores[roundWinnerTeam] || 0) + 1;
            if (room.teamScores[roundWinnerTeam] >= room.matchScoreLimit) {
                room.gameState = 'GAMEOVER';
                io.to(room.id).emit('gameStateChanged', { state: 'GAMEOVER', winnerName: "Tým " + roundWinnerTeam.toUpperCase() });
                return;
            }
        } else if (room.gameMode === 'ffa' && roundWinnerId) {
            room.players[roundWinnerId].score += 1;
            if (room.players[roundWinnerId].score >= room.matchScoreLimit) {
                room.gameState = 'GAMEOVER';
                io.to(room.id).emit('gameStateChanged', { state: 'GAMEOVER', winnerName: room.players[roundWinnerId].name });
                return;
            }
        }

        room.gameState = 'UPGRADE';
        let allPlayers = Object.keys(room.players);

        room.upgradeQueue = allPlayers.filter(id => {
            if (room.gameMode === 'tdm' && roundWinnerTeam) return room.players[id].team !== roundWinnerTeam;
            if (room.gameMode === 'ffa' && roundWinnerId) return id !== roundWinnerId;
            return true;
        });

        if (room.upgradeQueue.length > 0) {
            room.currentLoserId = room.upgradeQueue[0];
            let cardsToSend = generateCardsForPlayer(room.players[room.currentLoserId]);
            io.to(room.id).emit('gameStateChanged', { state: 'UPGRADE', loserId: room.currentLoserId, cards: cardsToSend });
        } else {
            startNextRound(room);
        }
    }
}

// ==========================================
// SOCKET.IO EVENTY
// ==========================================

io.on('connection', (socket) => {
    socket.emit('mapData', { mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT });
    socket.emit('initCatalog', uiCatalog);

    socket.on('createRoom', (data = {}) => {
        const code = generateRoomCode();
        let mapData = generateMap();
        
        rooms[code] = {
            id: code, hostId: socket.id, players: {}, upgradeQueue: [],
            gameState: 'LOBBY', gameMode: 'ffa', matchScoreLimit: 5, teamScores: {},
            deadPlayersThisRound: [], gravityEnabled: true,
            currentGravity: GRAVITY_OPTIONS.length ? GRAVITY_OPTIONS[0] : { name: "Normal", x: 0, y: 0 },
            obstacles: mapData.obstacles, breakables: mapData.breakables,
            processedHits: new Set()
        };
        
        socket.join(code); 
        socket.roomId = code;
        rooms[code].players[socket.id] = createPlayerTemplate(data.name, data.color, "none", data.cosmetic);

        socket.emit('roomCreated', { code, isHost: true, scoreLimit: rooms[code].matchScoreLimit, gravityEnabled: rooms[code].gravityEnabled });
        broadcastLobbyUpdate(rooms[code]);
    });

    socket.on('joinRoom', (data) => {
        if (!data || !data.code) return;
        let code = String(data.code).toUpperCase();
        const room = rooms[code];

        if (!room) return socket.emit('errorMsg', 'Místnost neexistuje.');
        if (Object.keys(room.players).length >= 6) return socket.emit('errorMsg', 'Místnost je plná.');
        if (room.gameState !== 'LOBBY') return socket.emit('errorMsg', 'Hra už začala.');

        socket.join(code); 
        socket.roomId = code;
        let pTeam = (data.team && room.gameMode !== 'ffa') ? data.team : "none";
        room.players[socket.id] = createPlayerTemplate(data.name, data.color, pTeam, data.cosmetic);

        socket.emit('roomJoined', { code, isHost: false, scoreLimit: room.matchScoreLimit, gravityEnabled: room.gravityEnabled });
        broadcastLobbyUpdate(room);
    });

    socket.on('toggleGravity', (data) => {
        const room = rooms[socket.roomId];
        if (!room || room.gameState !== 'LOBBY' || room.hostId !== socket.id) return;
        room.gravityEnabled = (data && data.enabled !== undefined) ? !!data.enabled : !room.gravityEnabled;
        broadcastLobbyUpdate(room);
    });

    socket.on('updateRoomScoreLimit', (data) => {
        const room = rooms[socket.roomId];
        if (!room || room.gameState !== 'LOBBY' || room.hostId !== socket.id || !data) return;
        let limit = parseInt(data.limit);
        if (!isNaN(limit) && limit > 0 && limit <= 50) { 
            room.matchScoreLimit = limit; 
            broadcastLobbyUpdate(room); 
        }
    });

    socket.on('updateGameMode', (data) => {
        const room = rooms[socket.roomId];
        if (!room || room.gameState !== 'LOBBY' || room.hostId !== socket.id || !data) return;
        
        room.gameMode = data.mode === 'tdm' ? 'tdm' : 'ffa';
        let players = Object.values(room.players);
        
        if (room.gameMode === 'ffa') {
            players.forEach(p => p.team = "none");
        } else if (room.gameMode === 'tdm') {
            let redCount = players.filter(p => p.team === "red").length;
            let blueCount = players.filter(p => p.team === "blue").length;
            for (let p of players) {
                if (p.team !== "red" && p.team !== "blue") {
                    if (redCount <= blueCount) { p.team = "red"; redCount++; } 
                    else { p.team = "blue"; blueCount++; }
                }
            }
        }
        broadcastLobbyUpdate(room);
    });

    socket.on('updateProfile', (data) => {
        const room = rooms[socket.roomId];
        if (!room || !room.players[socket.id] || !data) return;
        let p = room.players[socket.id];
        if (data.name) p.name = String(data.name).substring(0, 15);
        if (data.color) p.color = String(data.color).substring(0, 7);
        if (data.cosmetic !== undefined) p.cosmetic = data.cosmetic;
        if (data.team !== undefined) p.team = (room.gameMode !== 'ffa') ? data.team : "none";
        broadcastLobbyUpdate(room);
    });

    socket.on('toggleReady', (status) => {
        const room = rooms[socket.roomId];
        if (!room || room.gameState !== 'LOBBY' || !room.players[socket.id]) return;
        
        room.players[socket.id].isReady = !!status;
        const playerIds = Object.keys(room.players);
        broadcastLobbyUpdate(room);

        // Zkontrolujeme, zda jsou všichni (minimálně 2) připraveni
        if (playerIds.length >= 2 && playerIds.every(id => room.players[id].isReady)) {
            if (room.gameMode === 'tdm') {
                let hasRed = false, hasBlue = false;
                for (let id of playerIds) {
                    if (room.players[id].team === 'red') hasRed = true;
                    if (room.players[id].team === 'blue') hasBlue = true;
                }
                if (!hasRed || !hasBlue) {
                    room.players[socket.id].isReady = false; // Zruší ready hostovi, co to pokazil
                    broadcastLobbyUpdate(room);
                    return socket.emit('errorMsg', 'V TDM musí být alespoň jeden hráč v každém týmu!');
                }
            }
            
            // Inicializace před startem
            for (let id of playerIds) {
                room.players[id].score = 0;
                resetPlayerStatsToBase(room.players[id]);
            }
            room.teamScores = {};
            startNextRound(room);
        }
    });

    const handleInput = (arg1, arg2) => {
        let roomCode = typeof arg1 === 'string' ? arg1 : socket.roomId;
        let data = typeof arg1 === 'object' ? arg1 : arg2;
        
        const room = rooms[roomCode || socket.roomId];
        if (room && room.gameState === 'PLAYING' && room.players[socket.id] && data) {
            // Zachování existujícího dash vstupu z eventu "Dash", pokud by klient poslal false ve standardním updatu
            let currentDash = room.players[socket.id].inputs.dash || false;
            // Bezpečné zkopírování dat, aby klient nemohl přepsat celý objekt něčím jiným
            room.players[socket.id].inputs = {
                ...room.players[socket.id].inputs,
                ...data,
                dash: currentDash || !!data.dash
            };
        }
    };
    
    // Pro zpětnou kompatibilitu, kdyby klient volal P nebo p
    socket.on('PlayerInput', handleInput);
    socket.on('playerInput', handleInput);

    socket.on('Dash', (arg1) => {
        let roomCode = typeof arg1 === 'string' ? arg1 : socket.roomId;
        const room = rooms[roomCode || socket.roomId];
        if (room && room.gameState === 'PLAYING' && room.players[socket.id]) {
            room.players[socket.id].inputs.dash = true; 
        }
    });

    socket.on('clientSync', (arg1, arg2) => {
        let data = typeof arg1 === 'object' ? arg1 : arg2;
        const room = rooms[socket.roomId];
        if (room && room.gameState === 'PLAYING' && room.players[socket.id] && data) {
            let p = room.players[socket.id];
            // Validace, že nám klient neposílá NaN nebo undefined jako pozici a nerozbije server
            if (p.hp > 0 && typeof data.x === 'number' && !isNaN(data.x) && typeof data.y === 'number' && !isNaN(data.y)) {
                p.x = data.x;
                p.y = data.y;
                p.aimAngle = Number(data.aimAngle) || p.aimAngle;
                p.ammo = Number(data.ammo) || p.ammo;
                p.isReloading = !!data.isReloading;
                p.domainActive = !!data.domainActive;
                p.isInvisible = !!data.isInvisible;
            }
        }
    });

    socket.on('playerShot', (arg1, arg2) => {
        let bulletsData = typeof arg1 === 'object' ? arg1 : arg2;
        const room = rooms[socket.roomId];
        if (room && room.gameState === 'PLAYING') {
            socket.to(socket.roomId).emit('enemyShot', bulletsData);
        }
    });

    socket.on('bulletHitPlayer', (arg1, arg2) => {
        let data = typeof arg1 === 'object' ? arg1 : arg2;
        const room = rooms[socket.roomId];
        if (room && room.gameState === 'PLAYING' && data && data.targetId) {
            let target = room.players[data.targetId];
            let shooter = room.players[socket.id];

            if (target && shooter && target.hp > 0) {
                // Prevence vícenásobného zásahu (Double-hit bug prevention)
                if (data.bulletId) {
                    const hitHash = `${data.bulletId}-${data.targetId}`;
                    if (room.processedHits.has(hitHash)) return;
                    room.processedHits.add(hitHash);
                }

                // Ochrana: nedůvěřujeme klientovi slepě damage, zastropujeme ji max. 3x poškozením (např. crit)
                const damageFromClient = Number(data.damage) || 0;
                const maxAllowedDamage = shooter.damage * 3;
                const safeDamage = Math.min(damageFromClient, maxAllowedDamage);
                
                target.hp -= safeDamage;
                
                // Lifesteal kalkulace
                if (data.lifesteal > 0 && shooter.hp > 0) {
                    let healAmount = Math.floor(safeDamage * Number(data.lifesteal));
                    shooter.hp = Math.min(shooter.maxHp, shooter.hp + healAmount);
                }

                if (target.hp <= 0) {
                    handleDeath(room, data.targetId);
                }
                
                io.to(socket.roomId).emit('playerDamaged', { targetId: data.targetId, newHp: target.hp, shooterId: socket.id });
            }
        }
    });

    socket.on('wallDestroyed', (wallId) => {
        const room = rooms[socket.roomId];
        if (room && room.gameState === 'PLAYING') {
            let wall = room.breakables.find(w => w.id === wallId);
            if (wall && !wall.destroyed) {
                wall.destroyed = true;
                io.to(socket.roomId).emit('mapUpdate', { obstacles: room.obstacles, breakables: room.breakables });
            }
        }
    });

    socket.on('spawnDecoy', (decoyData) => {
        if(socket.roomId) socket.to(socket.roomId).emit('enemyDecoySpawned', decoyData);
    });

    socket.on('pickCard', (cardIndex) => {
        const room = rooms[socket.roomId];
        if (!room || room.gameState !== 'UPGRADE' || socket.id !== room.currentLoserId) return;

        const card = availableCards[cardIndex]; 
        let p = room.players[socket.id];

        if (card && p) {
            let oldMaxHp = p.maxHp;
            if (typeof card.apply === 'function') card.apply(p);
            // Přepočet současného HP, pokud se změnilo maximum
            if (p.maxHp !== oldMaxHp) p.hp = Math.floor(p.maxHp * (p.hp / oldMaxHp));
            applyHardCaps(p);
        }

        room.upgradeQueue = room.upgradeQueue.filter(id => id !== socket.id);

        if (room.upgradeQueue.length > 0) {
            room.currentLoserId = room.upgradeQueue[0];
            let nextPlayer = room.players[room.currentLoserId];
            if (nextPlayer) {
                io.to(room.id).emit('gameStateChanged', { state: 'UPGRADE', loserId: room.currentLoserId, cards: generateCardsForPlayer(nextPlayer) });
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

        // Pokud odešel poslední, znič místnost
        if (remainingPlayers.length === 0) {
            delete rooms[code];
            return;
        }

        if (wasHost) {
            room.hostId = remainingPlayers[0];
        }

        // Pokud běží hra a po odpojení zbude jen 1 hráč, ukonči hru do LOBBY
        if (remainingPlayers.length < 2 && !['LOBBY', 'GAMEOVER'].includes(room.gameState)) {
            room.gameState = 'LOBBY';
            if (room.players[remainingPlayers[0]]) room.players[remainingPlayers[0]].isReady = false;
            io.to(code).emit('gameStateChanged', { state: 'LOBBY', roomCode: code, scoreLimit: room.matchScoreLimit });
            broadcastLobbyUpdate(room);
        } 
        // Pokud odešel hráč, který měl zrovna vybírat kartu
        else if (room.gameState === 'UPGRADE' && room.currentLoserId === socket.id) {
            if (room.upgradeQueue.length > 0) {
                room.currentLoserId = room.upgradeQueue[0];
                let nextPlayer = room.players[room.currentLoserId];
                if (nextPlayer) {
                    io.to(room.id).emit('gameStateChanged', { state: 'UPGRADE', loserId: room.currentLoserId, cards: generateCardsForPlayer(nextPlayer) });
                } else {
                    startNextRound(room);
                }
            } else {
                startNextRound(room);
            }
        } 
        else {
             broadcastLobbyUpdate(room);
        }
    });
});

// ==========================================
// GLOBÁLNÍ INTERVALY
// ==========================================

setInterval(() => {
    for (let roomId in rooms) {
        let room = rooms[roomId];
        if (room && room.gameState === 'PLAYING' && room.gravityEnabled && GRAVITY_OPTIONS && GRAVITY_OPTIONS.length > 0) {
            let availableOptions = GRAVITY_OPTIONS.length > 1 ? GRAVITY_OPTIONS.filter(g => g.name !== room.currentGravity?.name) : GRAVITY_OPTIONS;
            if(availableOptions.length > 0) {
                room.currentGravity = availableOptions[Math.floor(Math.random() * availableOptions.length)];
                io.to(roomId).emit('gravityChanged', room.currentGravity.name);
            }
        }
    }
}, GRAVITY_CHANGE_INTERVAL);

setInterval(() => {
    for (let roomId in rooms) {
        let room = rooms[roomId];
        if (room) {
            io.to(roomId).volatile.emit('gameUpdate', {
                players: room.players,
                maxScore: room.matchScoreLimit,
                teamScores: room.teamScores,
                gameState: room.gameState,
                gameMode: room.gameMode
            });
        }
    }
}, 1000 / 20); // 20 ticků za sekundu server sync

server.listen(PORT, () => {
    console.log(`🚀 Server běží na portu ${PORT}`);
});