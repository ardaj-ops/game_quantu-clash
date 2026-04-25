// game/physics.js
import { state } from './state.js';
import { socket } from './network.js';
import { CONFIG } from '../gameConfig.js';

export function checkWallCollision(x, y, radius, walls) {
    if (!walls || walls.length === 0) return false;
    for (const wall of walls) {
        if (!wall || wall.destroyed || (wall.hp !== undefined && wall.hp <= 0)) continue;
        const testX = Math.max(wall.x, Math.min(x, wall.x + wall.width));
        const testY = Math.max(wall.y, Math.min(y, wall.y + wall.height));
        const dx = x - testX, dy = y - testY;
        if (dx * dx + dy * dy <= radius * radius) return true;
    }
    return false;
}

function getWallCollisionNormal(x, y, radius, walls) {
    for (const wall of walls) {
        if (!wall || wall.destroyed || (wall.hp !== undefined && wall.hp <= 0)) continue;
        const testX = Math.max(wall.x, Math.min(x, wall.x + wall.width));
        const testY = Math.max(wall.y, Math.min(y, wall.y + wall.height));
        const dx = x - testX, dy = y - testY;
        if (dx * dx + dy * dy > radius * radius) continue;
        const overlapX = wall.width  / 2 - Math.abs(x - (wall.x + wall.width  / 2));
        const overlapY = wall.height / 2 - Math.abs(y - (wall.y + wall.height / 2));
        return overlapX < overlapY
            ? { hit: true, nx: 1, ny: 0 }
            : { hit: true, nx: 0, ny: 1 };
    }
    return { hit: false, nx: 0, ny: 0 };
}

// BUG FIX: Track ritual key state so we only send ritualRequested=true on the
// FIRST tick after F is pressed (rising edge), not every tick it's held down.
// Without this, DomainManager.activateDomain() was called 60 times per second
// on the server (though its internal guard prevented double-activation, it was wasteful).
let _prevRitual = false;
let _syncThrottle = 0;

export function updateLocalGame() {
    if (!state.latestServerData || state.latestServerData.gameState !== 'PLAYING') return;
    if (!socket || !socket.id) return;

    if (!state.playerInputs) state.playerInputs = {};
    if (!state.localBullets)  state.localBullets  = [];

    const playersData = state.latestServerData.players || {};
    const myId = socket.id;
    const me   = playersData[myId];
    if (!me || me.hp <= 0) return;

    const speed      = me.moveSpeed  || CONFIG.BASE_MOVE_SPEED || 0.8;
    const pixelSpeed = speed * 5;
    const pRadius    = me.playerRadius || CONFIG.PLAYER_RADIUS || 20;
    const mapW       = CONFIG.MAP_WIDTH  || 1920;
    const mapH       = CONFIG.MAP_HEIGHT || 1080;
    const allWalls   = [...(state.localObstacles || []), ...(state.localBreakables || [])];

    // --- MOVEMENT (axis-separated collision) ---
    let nextX = me.x;
    let nextY = me.y;

    if (state.playerInputs.up)    nextY -= pixelSpeed;
    if (state.playerInputs.down)  nextY += pixelSpeed;
    nextY = Math.max(pRadius, Math.min(mapH - pRadius, nextY));
    if (!checkWallCollision(me.x, nextY, pRadius, allWalls)) me.y = nextY;

    if (state.playerInputs.left)  nextX -= pixelSpeed;
    if (state.playerInputs.right) nextX += pixelSpeed;
    nextX = Math.max(pRadius, Math.min(mapW - pRadius, nextX));
    if (!checkWallCollision(nextX, me.y, pRadius, allWalls)) me.x = nextX;

    // --- AIM ---
    if (state.worldMouseX !== undefined && state.worldMouseY !== undefined) {
        state.playerInputs.aimAngle = Math.atan2(
            state.worldMouseY - me.y,
            state.worldMouseX - me.x
        );
    }

    const currentAimAngle = state.playerInputs.aimAngle || 0;

    // --- SHOOTING ---
    const now      = Date.now();
    const fireRate = me.fireRate || CONFIG.BASE_FIRE_RATE || 400;

    if (state.playerInputs.click &&
        now - (state.lastShotTime || 0) > fireRate &&
        me.ammo > 0 && me.maxAmmo > 0 && !me.isReloading) {

        state.lastShotTime = now;
        me.ammo--;
        if (me.ammo === 0) me.isReloading = true;

        const bSpeed    = me.bulletSpeed || 15;
        const bRadius   = me.bulletSize  || 5;
        const multishot = me.multishot   || 1;
        const spread    = me.spread      || 0;

        for (let s = 0; s < multishot; s++) {
            const angleOffset = multishot > 1 ? (s - (multishot - 1) / 2) * (spread || 0.15) : 0;
            const angle = currentAimAngle + angleOffset;

            state.localBullets.push({
                id: Math.random().toString(36).substring(2, 9),
                ownerId: myId,
                x:  me.x + Math.cos(angle) * (pRadius + bRadius + 2),
                y:  me.y + Math.sin(angle) * (pRadius + bRadius + 2),
                vx: Math.cos(angle) * bSpeed,
                vy: Math.sin(angle) * bSpeed,
                damage:      me.damage || 20,
                radius:      bRadius,
                color:       me.color || '#f1c40f',
                bouncesLeft: me.bounces || 0,
                pierce:      me.pierce  || 0,
                pierceHits:  []
            });
        }

        socket.emit('playerShot', state.localBullets.slice(-multishot));
    }

    // --- RITUAL DEBOUNCE ---
    // BUG FIX: Only send ritualRequested=true on the rising edge of the F key.
    // Previously sent true every single tick while F was held (60×/sec).
    const ritualRisingEdge = state.playerInputs.ritual && !_prevRitual;
    _prevRitual = state.playerInputs.ritual;

    // --- CLIENT SYNC (throttled to 30/sec — server still runs at 60 but extra syncs waste bandwidth) ---
    // BUG FIX: Was emitting 60 times/sec with no throttle; halved to 30 syncs/sec.
    // The local movement loop still runs at 60fps for smooth prediction — only the
    // network packet is throttled.
    _syncThrottle++;
    if (_syncThrottle >= 2) {
        _syncThrottle = 0;
        socket.emit('clientSync', {
            x:               me.x,
            y:               me.y,
            aimAngle:        currentAimAngle,
            ammo:            me.ammo,
            isReloading:     state.playerInputs.reload || me.isReloading || false,
            dashRequested:   state.playerInputs.rightClick || false,
            ritualRequested: ritualRisingEdge    // ← only true on the one tick of rising edge
        });
    }

    // --- BULLET UPDATE ---
    for (let i = state.localBullets.length - 1; i >= 0; i--) {
        const b = state.localBullets[i];
        const prevX = b.x, prevY = b.y;

        b.x += b.vx;
        b.y += b.vy;

        let hitBoundary = false;
        if (b.x - b.radius < 0)    { b.x = b.radius;    b.vx =  Math.abs(b.vx); hitBoundary = true; }
        if (b.x + b.radius > mapW)  { b.x = mapW - b.radius; b.vx = -Math.abs(b.vx); hitBoundary = true; }
        if (b.y - b.radius < 0)    { b.y = b.radius;    b.vy =  Math.abs(b.vy); hitBoundary = true; }
        if (b.y + b.radius > mapH)  { b.y = mapH - b.radius; b.vy = -Math.abs(b.vy); hitBoundary = true; }

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

        // Hit detection vs remote players
        let bulletRemoved = false;
        for (const targetId in playersData) {
            if (targetId === myId) continue;
            if (b.pierceHits?.includes(targetId)) continue;

            const target = playersData[targetId];
            if (!target || target.hp <= 0) continue;

            const targetRadius = target.playerRadius || target.radius || 20;
            const dist = Math.hypot(b.x - target.x, b.y - target.y);
            if (dist < targetRadius + b.radius) {
                socket.emit('bulletHitPlayer', {
                    targetId,
                    damage:   b.damage,
                    bulletId: b.id,
                    lifesteal: me.lifesteal || 0
                });

                if (b.pierce > 0 && (b.pierceHits?.length || 0) < b.pierce) {
                    b.pierceHits.push(targetId);
                } else {
                    state.localBullets.splice(i, 1);
                    bulletRemoved = true;
                    break;
                }
            }
        }
        if (bulletRemoved) continue;
    }
}
