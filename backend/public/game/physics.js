// game/physics.js
import { state } from './state.js';
import { socket } from './network.js';
import { CONFIG } from '../gameConfig.js';

// ---------------------------------------------------------------------------
// WALL COLLISION UTILITIES
// ---------------------------------------------------------------------------

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
        return overlapX < overlapY ? { hit: true, nx: 1, ny: 0 }
                                   : { hit: true, nx: 0, ny: 1 };
    }
    return { hit: false, nx: 0, ny: 0 };
}

// ---------------------------------------------------------------------------
// DASH STATE  (module-level so it persists between updateLocalGame calls)
// ---------------------------------------------------------------------------
// BUG FIX: Dash was completely non-functional — input.js emitted the socket
// event but physics.js never applied any speed boost. Added full client-side
// dash movement with duration and cooldown tracking.

let _dashActive       = false;
let _dashEndTime      = 0;
let _dashCooldownEnd  = 0;

// Rising-edge trackers
let _prevRitual       = false;
let _prevRightClick   = false;

// clientSync throttle (send at 30/s instead of 60/s)
let _syncThrottle     = 0;

// ---------------------------------------------------------------------------
// MAIN PHYSICS TICK
// ---------------------------------------------------------------------------
export function updateLocalGame() {
    if (!state.latestServerData || state.latestServerData.gameState !== 'PLAYING') return;
    if (!socket || !socket.id) return;

    if (!state.playerInputs) state.playerInputs = {};
    if (!state.localBullets)  state.localBullets  = [];

    const playersData = state.latestServerData.players || {};
    const myId        = socket.id;
    const me          = playersData[myId];
    if (!me || me.hp <= 0) return;

    const mapW    = CONFIG.MAP_WIDTH  || 1920;
    const mapH    = CONFIG.MAP_HEIGHT || 1080;
    const pRadius = me.playerRadius || CONFIG.PLAYER_RADIUS || 20;
    const allWalls = [...(state.localObstacles || []), ...(state.localBreakables || [])];
    const now     = Date.now();

    // -----------------------------------------------------------------------
    // DASH — rising edge on right-click
    // -----------------------------------------------------------------------
    const rightClickRising = state.playerInputs.rightClick && !_prevRightClick;
    _prevRightClick = state.playerInputs.rightClick;

    if (rightClickRising && now >= _dashCooldownEnd) {
        _dashActive      = true;
        _dashEndTime     = now + (CONFIG.DASH_DURATION      || 200);
        _dashCooldownEnd = now + (CONFIG.DASH_COOLDOWN      || 3000);
        socket.emit('Dash'); // tell others to play visual effect
    }

    // Expire dash
    if (_dashActive && now >= _dashEndTime) {
        _dashActive = false;
    }

    // -----------------------------------------------------------------------
    // MOVEMENT
    // -----------------------------------------------------------------------
    const baseSpeed  = me.moveSpeed  || CONFIG.BASE_MOVE_SPEED || 0.8;
    const dashMult   = (_dashActive) ? (CONFIG.DASH_SPEED_MULTIPLIER || 4) : 1;
    const pixelSpeed = baseSpeed * 5 * dashMult;

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

    // -----------------------------------------------------------------------
    // AIM ANGLE
    // -----------------------------------------------------------------------
    if (state.worldMouseX !== undefined && state.worldMouseY !== undefined) {
        state.playerInputs.aimAngle = Math.atan2(
            state.worldMouseY - me.y,
            state.worldMouseX - me.x
        );
    }
    const currentAimAngle = state.playerInputs.aimAngle || 0;

    // -----------------------------------------------------------------------
    // SHOOTING
    // -----------------------------------------------------------------------
    const fireRate = me.fireRate || CONFIG.BASE_FIRE_RATE || 400;

    if (state.playerInputs.click &&
        now - (state.lastShotTime || 0) > fireRate &&
        me.ammo > 0 && me.maxAmmo > 0 && !me.isReloading) {

        state.lastShotTime = now;
        me.ammo--;
        if (me.ammo === 0) me.isReloading = true;

        const bSpeed    = me.bulletSpeed || CONFIG.BASE_BULLET_SPEED || 15;
        const bRadius   = me.bulletSize  || CONFIG.BULLET_RADIUS || 5;
        const multishot = me.multishot   || 1;
        const spread    = me.spread      || 0;

        for (let s = 0; s < multishot; s++) {
            const offset = multishot > 1 ? (s - (multishot - 1) / 2) * (spread || 0.15) : 0;
            const angle  = currentAimAngle + offset;
            state.localBullets.push({
                id:          Math.random().toString(36).substring(2, 9),
                ownerId:     myId,
                x:           me.x + Math.cos(angle) * (pRadius + bRadius + 2),
                y:           me.y + Math.sin(angle) * (pRadius + bRadius + 2),
                vx:          Math.cos(angle) * bSpeed,
                vy:          Math.sin(angle) * bSpeed,
                damage:      me.damage || 20,
                radius:      bRadius,
                color:       me.color  || '#f1c40f',
                bouncesLeft: me.bounces || 0,
                pierce:      me.pierce  || 0,
                pierceHits:  []
            });
        }
        socket.emit('playerShot', state.localBullets.slice(-multishot));
    }

    // -----------------------------------------------------------------------
    // RITUAL — send ONLY on the rising edge (prevents 60× server calls/sec)
    // -----------------------------------------------------------------------
    const ritualRising = state.playerInputs.ritual && !_prevRitual;
    _prevRitual = state.playerInputs.ritual;

    // -----------------------------------------------------------------------
    // CLIENT SYNC — throttled to 30 packets/sec (physics still at 60fps)
    // -----------------------------------------------------------------------
    _syncThrottle++;
    if (_syncThrottle >= 2) {
        _syncThrottle = 0;
        socket.emit('clientSync', {
            x:               me.x,
            y:               me.y,
            aimAngle:        currentAimAngle,
            ammo:            me.ammo,
            isReloading:     state.playerInputs.reload || me.isReloading || false,
            dashRequested:   false,          // movement handled client-side now
            ritualRequested: ritualRising    // only true for exactly 1 packet
        });
    }

    // -----------------------------------------------------------------------
    // BULLET PHYSICS
    // -----------------------------------------------------------------------
    for (let i = state.localBullets.length - 1; i >= 0; i--) {
        const b = state.localBullets[i];
        const prevX = b.x, prevY = b.y;

        b.x += b.vx;
        b.y += b.vy;

        // Boundary bounce / remove
        let hitBoundary = false;
        if (b.x - b.radius < 0)    { b.x = b.radius;        b.vx =  Math.abs(b.vx); hitBoundary = true; }
        if (b.x + b.radius > mapW)  { b.x = mapW - b.radius; b.vx = -Math.abs(b.vx); hitBoundary = true; }
        if (b.y - b.radius < 0)    { b.y = b.radius;        b.vy =  Math.abs(b.vy); hitBoundary = true; }
        if (b.y + b.radius > mapH)  { b.y = mapH - b.radius; b.vy = -Math.abs(b.vy); hitBoundary = true; }

        if (hitBoundary) {
            if (b.bouncesLeft > 0) b.bouncesLeft--;
            else { state.localBullets.splice(i, 1); continue; }
        }

        // Wall bounce / remove
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

        // Player hit detection
        let removed = false;
        for (const targetId in playersData) {
            if (targetId === myId) continue;
            if (b.pierceHits?.includes(targetId)) continue;

            const target = playersData[targetId];
            if (!target || target.hp <= 0) continue;

            const tRadius = target.playerRadius || target.radius || 20;
            if (Math.hypot(b.x - target.x, b.y - target.y) < tRadius + b.radius) {
                socket.emit('bulletHitPlayer', {
                    targetId,
                    damage:    b.damage,
                    bulletId:  b.id,
                    lifesteal: me.lifesteal || 0
                });

                if (b.pierce > 0 && (b.pierceHits?.length || 0) < b.pierce) {
                    b.pierceHits.push(targetId);
                } else {
                    state.localBullets.splice(i, 1);
                    removed = true;
                    break;
                }
            }
        }
        if (removed) continue;
    }
}

// ---------------------------------------------------------------------------
// DASH HUD ACCESSORS  (used by render.js to draw the dash cooldown indicator)
// ---------------------------------------------------------------------------
export function getDashState() {
    const now = Date.now();
    return {
        active:   _dashActive,
        cooldown: Math.max(0, _dashCooldownEnd - now),
        maxCooldown: CONFIG.DASH_COOLDOWN || 3000
    };
}
