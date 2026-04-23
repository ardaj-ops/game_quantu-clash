// game/physics.js
import { state } from './state.js';
import { socket } from './network.js';
import { CONFIG } from './gameConfig.js';

// Vrátí true/false - narazil kruh na stěnu?
export function checkWallCollision(x, y, radius, walls) {
    if (!walls || walls.length === 0) return false;
    for (let wall of walls) {
        if (!wall || wall.destroyed || (wall.hp !== undefined && wall.hp <= 0)) continue;
        let testX = Math.max(wall.x, Math.min(x, wall.x + wall.width));
        let testY = Math.max(wall.y, Math.min(y, wall.y + wall.height));
        let distX = x - testX;
        let distY = y - testY;
        if ((distX * distX) + (distY * distY) <= radius * radius) return true;
    }
    return false;
}

// Vrátí { hit: bool, nx: 0|1, ny: 0|1 } — osu kolize pro správné odrážení
function getWallCollisionNormal(x, y, radius, walls) {
    for (let wall of walls) {
        if (!wall || wall.destroyed || (wall.hp !== undefined && wall.hp <= 0)) continue;

        let testX = Math.max(wall.x, Math.min(x, wall.x + wall.width));
        let testY = Math.max(wall.y, Math.min(y, wall.y + wall.height));
        let distX = x - testX;
        let distY = y - testY;
        if ((distX * distX) + (distY * distY) > radius * radius) continue;

        // Zjistíme, ze které strany kulka přišla
        // Pokud je přesně na rohu, převáží ta osa, na které je kulka dál od středu zdi
        const overlapX = (wall.width / 2) - Math.abs(x - (wall.x + wall.width / 2));
        const overlapY = (wall.height / 2) - Math.abs(y - (wall.y + wall.height / 2));

        if (overlapX < overlapY) {
            // Kulka narazila ze strany (X osa)
            return { hit: true, nx: 1, ny: 0 };
        } else {
            // Kulka narazila shora/zdola (Y osa)
            return { hit: true, nx: 0, ny: 1 };
        }
    }
    return { hit: false, nx: 0, ny: 0 };
}

export function updateLocalGame() {
    if (!state.latestServerData || state.latestServerData.gameState !== 'PLAYING') return;
    if (!socket || !socket.id) return;

    if (!state.playerInputs) state.playerInputs = {};
    if (!state.localBullets) state.localBullets = [];

    let playersData = state.latestServerData.leanPlayers || state.latestServerData.players || {};
    let myId = socket.id;
    let me = playersData[myId];

    if (!me || me.hp <= 0) return;

    let speed = me.moveSpeed || 0.8;
    // OPRAVA: Server posílá moveSpeed jako 0.8 (násobič), fyzika potřebuje pixely/frame
    // Přepočítáme na rozumnou rychlost (base 5px/frame * násobič)
    let pixelSpeed = speed * 5;
    let pRadius = me.playerRadius || me.radius || CONFIG.PLAYER_RADIUS || 20;
    let allWalls = [...(state.localObstacles || []), ...(state.localBreakables || [])];

    const mapW = CONFIG.MAP_WIDTH || 1920;
    const mapH = CONFIG.MAP_HEIGHT || 1080;

    let nextX = me.x;
    let nextY = me.y;

    // Pohyb Y
    if (state.playerInputs.up) nextY -= pixelSpeed;
    if (state.playerInputs.down) nextY += pixelSpeed;
    nextY = Math.max(pRadius, Math.min(mapH - pRadius, nextY));
    if (!checkWallCollision(me.x, nextY, pRadius, allWalls)) me.y = nextY;

    // Pohyb X
    if (state.playerInputs.left) nextX -= pixelSpeed;
    if (state.playerInputs.right) nextX += pixelSpeed;
    nextX = Math.max(pRadius, Math.min(mapW - pRadius, nextX));
    if (!checkWallCollision(nextX, me.y, pRadius, allWalls)) me.x = nextX;

    // Výpočet úhlu zaměřování
    if (state.worldMouseX !== undefined && state.worldMouseY !== undefined) {
        state.playerInputs.aimAngle = Math.atan2(
            state.worldMouseY - me.y,
            state.worldMouseX - me.x
        );
    }

    let currentAimAngle = state.playerInputs.aimAngle || 0;

    // Odeslání pozice na server
    socket.emit('clientSync', {
        x: me.x,
        y: me.y,
        aimAngle: currentAimAngle,
        ammo: me.ammo,
        isReloading: state.playerInputs.reload || false,
        dashRequested: state.playerInputs.rightClick || false,
        ritualRequested: state.playerInputs.ritual || false
    });

    let now = Date.now();
    if (!state.lastShotTime) state.lastShotTime = 0;
    let fireRate = me.fireRate || 400;

    // Střelba
    if (state.playerInputs.click && now - state.lastShotTime > fireRate && me.ammo > 0 && me.maxAmmo > 0 && !me.isReloading) {
        state.lastShotTime = now;
        me.ammo--;

        let bSpeed = me.bulletSpeed || 15;
        let bRadius = me.bulletSize || 5;
        let multishot = me.multishot || 1;
        let spread = me.spread || 0;

        for (let s = 0; s < multishot; s++) {
            // Rozptyl pro multishot
            let angleOffset = multishot > 1 ? (s - (multishot - 1) / 2) * (spread || 0.15) : 0;
            let angle = currentAimAngle + angleOffset;

            let bullet = {
                id: Math.random().toString(36).substring(2, 9),
                ownerId: myId,
                x: me.x + Math.cos(angle) * (pRadius + bRadius + 2),
                y: me.y + Math.sin(angle) * (pRadius + bRadius + 2),
                vx: Math.cos(angle) * bSpeed,
                vy: Math.sin(angle) * bSpeed,
                damage: me.damage || 20,
                radius: bRadius,
                color: me.color || '#f1c40f',
                // OPRAVA: Čteme bounce count z hráčových statů
                bouncesLeft: me.bounces || 0,
                pierce: me.pierce || 0,
                pierceHits: []  // seznam ID hráčů, které tato kulka už prostřelila
            };

            state.localBullets.push(bullet);
        }

        // Pošleme všechny kulky naráz
        const shotBullets = state.localBullets.slice(-multishot);
        socket.emit('playerShot', shotBullets);
    }

    // Fyzika lokálních střel
    for (let i = state.localBullets.length - 1; i >= 0; i--) {
        let b = state.localBullets[i];

        // Uložíme předchozí pozici pro detekci kolize
        let prevX = b.x;
        let prevY = b.y;

        b.x += b.vx;
        b.y += b.vy;

        // Hranice mapy — odraz od okraje
        let hitBoundary = false;
        if (b.x - b.radius < 0) { b.x = b.radius; b.vx = Math.abs(b.vx); hitBoundary = true; }
        if (b.x + b.radius > mapW) { b.x = mapW - b.radius; b.vx = -Math.abs(b.vx); hitBoundary = true; }
        if (b.y - b.radius < 0) { b.y = b.radius; b.vy = Math.abs(b.vy); hitBoundary = true; }
        if (b.y + b.radius > mapH) { b.y = mapH - b.radius; b.vy = -Math.abs(b.vy); hitBoundary = true; }

        if (hitBoundary) {
            if (b.bouncesLeft > 0) {
                b.bouncesLeft--;
            } else {
                state.localBullets.splice(i, 1);
                continue;
            }
        }

        // Kolize s překážkami
        const normal = getWallCollisionNormal(b.x, b.y, b.radius, allWalls);
        if (normal.hit) {
            if (b.bouncesLeft > 0) {
                // OPRAVA: Správné odrážení podle normály kolize
                if (normal.nx) b.vx *= -1;  // narazilo ze strany
                if (normal.ny) b.vy *= -1;  // narazilo shora/zdola
                b.bouncesLeft--;

                // Posuneme kulku zpět, aby nebyla uvnitř zdi
                b.x = prevX + b.vx;
                b.y = prevY + b.vy;
            } else {
                state.localBullets.splice(i, 1);
                continue;
            }
        }

        // Kolize s hráči
        let bulletDestroyed = false;
        for (let targetId in playersData) {
            if (targetId === myId) continue;
            if (b.pierceHits && b.pierceHits.includes(targetId)) continue; // pierce — přeskočíme

            let target = playersData[targetId];
            if (!target || target.hp <= 0) continue;

            let targetRadius = target.playerRadius || target.radius || 20;
            let dist = Math.hypot(b.x - target.x, b.y - target.y);
            if (dist < targetRadius + b.radius) {
                socket.emit('bulletHitPlayer', {
                    targetId,
                    damage: b.damage,
                    bulletId: b.id,
                    lifesteal: me.lifesteal || 0
                });

                if (b.pierce > 0 && b.pierceHits.length < b.pierce) {
                    // Pierce — kulka pokračuje dál
                    b.pierceHits.push(targetId);
                } else {
                    bulletDestroyed = true;
                    state.localBullets.splice(i, 1);
                    break;
                }
            }
        }
    }
}