// game/physics.js
import { state } from './state.js';
import { socket } from './network.js';
import { CONFIG } from '../gameConfig.js';

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

function getWallCollisionNormal(x, y, radius, walls) {
    for (let wall of walls) {
        if (!wall || wall.destroyed || (wall.hp !== undefined && wall.hp <= 0)) continue;

        let testX = Math.max(wall.x, Math.min(x, wall.x + wall.width));
        let testY = Math.max(wall.y, Math.min(y, wall.y + wall.height));
        let distX = x - testX;
        let distY = y - testY;
        if ((distX * distX) + (distY * distY) > radius * radius) continue;

        const overlapX = (wall.width / 2) - Math.abs(x - (wall.x + wall.width / 2));
        const overlapY = (wall.height / 2) - Math.abs(y - (wall.y + wall.height / 2));

        if (overlapX < overlapY) return { hit: true, nx: 1, ny: 0 };
        else return { hit: true, nx: 0, ny: 1 };
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
    let pixelSpeed = speed * 5;
    let pRadius = me.playerRadius || me.radius || CONFIG.PLAYER_RADIUS || 20;
    let allWalls = [...(state.localObstacles || []), ...(state.localBreakables || [])];

    const mapW = CONFIG.MAP_WIDTH || 1920;
    const mapH = CONFIG.MAP_HEIGHT || 1080;

    let nextX = me.x;
    let nextY = me.y;

    if (state.playerInputs.up) nextY -= pixelSpeed;
    if (state.playerInputs.down) nextY += pixelSpeed;
    nextY = Math.max(pRadius, Math.min(mapH - pRadius, nextY));
    if (!checkWallCollision(me.x, nextY, pRadius, allWalls)) me.y = nextY;

    if (state.playerInputs.left) nextX -= pixelSpeed;
    if (state.playerInputs.right) nextX += pixelSpeed;
    nextX = Math.max(pRadius, Math.min(mapW - pRadius, nextX));
    if (!checkWallCollision(nextX, me.y, pRadius, allWalls)) me.x = nextX;

    if (state.worldMouseX !== undefined && state.worldMouseY !== undefined) {
        state.playerInputs.aimAngle = Math.atan2(
            state.worldMouseY - me.y,
            state.worldMouseX - me.x
        );
    }

    let currentAimAngle = state.playerInputs.aimAngle || 0;
    let now = Date.now();
    if (!state.lastShotTime) state.lastShotTime = 0;
    let fireRate = me.fireRate || 400;

    // Lokální výstřel
    if (state.playerInputs.click && now - state.lastShotTime > fireRate && me.ammo > 0 && me.maxAmmo > 0 && !me.isReloading) {
        state.lastShotTime = now;
        me.ammo--;
        
        // Zde zajistíme, aby se okamžitě přeplo na přebíjení bez čekání na server!
        if (me.ammo === 0) me.isReloading = true;

        let bSpeed = me.bulletSpeed || 15;
        let bRadius = me.bulletSize || 5;
        let multishot = me.multishot || 1;
        let spread = me.spread || 0;

        for (let s = 0; s < multishot; s++) {
            let angleOffset = multishot > 1 ? (s - (multishot - 1) / 2) * (spread || 0.15) : 0;
            let angle = currentAimAngle + angleOffset;

            state.localBullets.push({
                id: Math.random().toString(36).substring(2, 9),
                ownerId: myId,
                x: me.x + Math.cos(angle) * (pRadius + bRadius + 2),
                y: me.y + Math.sin(angle) * (pRadius + bRadius + 2),
                vx: Math.cos(angle) * bSpeed,
                vy: Math.sin(angle) * bSpeed,
                damage: me.damage || 20,
                radius: bRadius,
                color: me.color || '#f1c40f',
                bouncesLeft: me.bounces || 0,
                pierce: me.pierce || 0,
                pierceHits: [] 
            });
        }

        const shotBullets = state.localBullets.slice(-multishot);
        socket.emit('playerShot', shotBullets);
    }

    // Odeslání plně lokálního stavu na server
    socket.emit('clientSync', {
        x: me.x,
        y: me.y,
        aimAngle: currentAimAngle,
        ammo: me.ammo,
        isReloading: state.playerInputs.reload || me.isReloading || false,
        dashRequested: state.playerInputs.rightClick || false,
        ritualRequested: state.playerInputs.ritual || false
    });

    for (let i = state.localBullets.length - 1; i >= 0; i--) {
        let b = state.localBullets[i];
        let prevX = b.x;
        let prevY = b.y;

        b.x += b.vx;
        b.y += b.vy;

        let hitBoundary = false;
        if (b.x - b.radius < 0) { b.x = b.radius; b.vx = Math.abs(b.vx); hitBoundary = true; }
        if (b.x + b.radius > mapW) { b.x = mapW - b.radius; b.vx = -Math.abs(b.vx); hitBoundary = true; }
        if (b.y - b.radius < 0) { b.y = b.radius; b.vy = Math.abs(b.vy); hitBoundary = true; }
        if (b.y + b.radius > mapH) { b.y = mapH - b.radius; b.vy = -Math.abs(b.vy); hitBoundary = true; }

        if (hitBoundary) {
            if (b.bouncesLeft > 0) b.bouncesLeft--;
            else { state.localBullets.splice(i, 1); continue; }
        }

        const normal = getWallCollisionNormal(b.x, b.y, b.radius, allWalls);
        if (normal.hit) {
            if (b.bouncesLeft > 0) {
                if (normal.nx) b.vx *= -1;
                if (normal.ny) b.vy *= -1;
                b.bouncesLeft--;
                b.x = prevX + b.vx;
                b.y = prevY + b.vy;
            } else {
                state.localBullets.splice(i, 1);
                continue;
            }
        }

        for (let targetId in playersData) {
            if (targetId === myId) continue;
            if (b.pierceHits && b.pierceHits.includes(targetId)) continue; 

            let target = playersData[targetId];
            if (!target || target.hp <= 0) continue;

            let targetRadius = target.playerRadius || target.radius || 20;
            let dist = Math.hypot(b.x - target.x, b.y - target.y);
            if (dist < targetRadius + b.radius) {
                socket.emit('bulletHitPlayer', {
                    targetId, damage: b.damage, bulletId: b.id, lifesteal: me.lifesteal || 0
                });

                if (b.pierce > 0 && b.pierceHits.length < b.pierce) {
                    b.pierceHits.push(targetId);
                } else {
                    state.localBullets.splice(i, 1);
                    break;
                }
            }
        }
    }
}