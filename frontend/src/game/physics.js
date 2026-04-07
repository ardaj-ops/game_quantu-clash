// physics.js
import { state, CONFIG } from './state.js';
import { socket } from './network.js';

export function checkWallCollision(x, y, radius, walls) {
    if (!walls || walls.length === 0) return false;
    for (let wall of walls) {
        if (!wall || wall.destroyed) continue;
        let testX = Math.max(wall.x, Math.min(x, wall.x + wall.width));
        let testY = Math.max(wall.y, Math.min(y, wall.y + wall.height));
        let distX = x - testX;
        let distY = y - testY;
        if (Math.sqrt((distX * distX) + (distY * distY)) <= radius) return true;
    }
    return false;
}

export function updateLocalGame() {
    if (!state.latestServerData || state.latestServerData.gameState !== 'PLAYING') return;
    if (!socket || !state.playerInputs) return;

    let playersData = state.latestServerData.leanPlayers || state.latestServerData.players || {};
    let myId = socket.id;
    let me = playersData[myId];
    
    if (!me || me.hp <= 0) return;

    let speed = me.moveSpeed || 5;
    let pRadius = me.playerRadius || 20;
    let allWalls = [...(state.localObstacles || []), ...(state.localBreakables || [])];

    let nextX = me.x;
    let nextY = me.y;

    if (state.playerInputs.up) nextY -= speed;
    if (state.playerInputs.down) nextY += speed;
    nextY = Math.max(pRadius, Math.min(CONFIG.MAP_H - pRadius, nextY));
    if (!checkWallCollision(me.x, nextY, pRadius, allWalls)) me.y = nextY;

    if (state.playerInputs.left) nextX -= speed;
    if (state.playerInputs.right) nextX += speed;
    nextX = Math.max(pRadius, Math.min(CONFIG.MAP_W - pRadius, nextX));
    if (!checkWallCollision(nextX, me.y, pRadius, allWalls)) me.x = nextX;

    // Odeslání dat na server
    socket.emit('clientSync', {
        x: me.x, y: me.y,
        aimAngle: state.playerInputs.aimAngle,
        ammo: me.ammo,
        isReloading: state.playerInputs.reload,
        dashRequested: state.playerInputs.rightClick
    });

    let now = Date.now();
    let fireRate = me.fireRate || 200;
    
    // Střelba
    if (state.playerInputs.click && now - state.lastShotTime > fireRate && me.ammo > 0 && me.maxAmmo > 0 && !me.isReloading) {
        state.lastShotTime = now;
        me.ammo--; 

        let bSpeed = me.bulletSpeed || 15;
        let bullet = {
            id: Math.random().toString(36).substring(2, 9), 
            ownerId: myId,
            x: me.x + Math.cos(state.playerInputs.aimAngle) * (pRadius + 5),
            y: me.y + Math.sin(state.playerInputs.aimAngle) * (pRadius + 5),
            vx: Math.cos(state.playerInputs.aimAngle) * bSpeed,
            vy: Math.sin(state.playerInputs.aimAngle) * bSpeed,
            damage: me.damage || 10,
            radius: 5,
            color: me.color || '#ffffff'
        };

        state.localBullets.push(bullet);
        socket.emit('playerShot', [bullet]); 
    }

    // Fyzika střel
    for (let i = state.localBullets.length - 1; i >= 0; i--) {
        let b = state.localBullets[i];
        b.x += b.vx;
        b.y += b.vy;

        if (checkWallCollision(b.x, b.y, b.radius, allWalls)) {
            state.localBullets.splice(i, 1);
            continue;
        }

        for (let targetId in playersData) {
            if (targetId === myId) continue; 
            let target = playersData[targetId];
            if (!target || target.hp <= 0) continue;

            let dist = Math.hypot(b.x - target.x, b.y - target.y);
            if (dist < (target.playerRadius || 20) + b.radius) {
                socket.emit('bulletHitPlayer', { targetId, damage: b.damage, bulletId: b.id });
                state.localBullets.splice(i, 1);
                break;
            }
        }
    }
}