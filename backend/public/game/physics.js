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
        const tx = Math.max(wall.x, Math.min(x, wall.x + wall.width));
        const ty = Math.max(wall.y, Math.min(y, wall.y + wall.height));
        const dx = x - tx, dy = y - ty;
        if (dx * dx + dy * dy <= radius * radius) return true;
    }
    return false;
}

// Returns collision normal AND which wall was hit (for breakable detection)
function getWallCollisionResult(x, y, radius, allWalls, breakables) {
    for (const wall of allWalls) {
        if (!wall || wall.destroyed || (wall.hp !== undefined && wall.hp <= 0)) continue;
        const tx = Math.max(wall.x, Math.min(x, wall.x + wall.width));
        const ty = Math.max(wall.y, Math.min(y, wall.y + wall.height));
        const dx = x - tx, dy = y - ty;
        if (dx * dx + dy * dy > radius * radius) continue;

        const overlapX = wall.width  / 2 - Math.abs(x - (wall.x + wall.width  / 2));
        const overlapY = wall.height / 2 - Math.abs(y - (wall.y + wall.height / 2));
        const nx = overlapX < overlapY ? 1 : 0;
        const ny = nx ? 0 : 1;

        // Check if this is a breakable wall
        const isBreakable = breakables ? breakables.some(b => b === wall || b.id === wall.id) : false;
        return { hit: true, nx, ny, wallId: isBreakable ? wall.id : null };
    }
    return { hit: false, nx: 0, ny: 0, wallId: null };
}

// ---------------------------------------------------------------------------
// DASH STATE
// ---------------------------------------------------------------------------
let _dashActive      = false;
let _dashEndTime     = 0;
let _dashCooldownEnd = 0;
let _prevRitual      = false;
let _prevRightClick  = false;
let _syncThrottle    = 0;

// ---------------------------------------------------------------------------
// REMOTE BULLET SIMULATION
// FIX: Remote bullets were dead-reckoned based on creation time, causing them
// to appear to fly forever. Now each bullet is simulated frame-by-frame with
// proper boundary bounce and wall collision — identical to local bullets.
// ---------------------------------------------------------------------------
export function updateRemoteBullets() {
    if (!state.remoteBullets || state.remoteBullets.length === 0) return;

    const mapW     = CONFIG.MAP_WIDTH  || 1920;
    const mapH     = CONFIG.MAP_HEIGHT || 1080;
    const allWalls = [...(state.localObstacles || []), ...(state.localBreakables || [])];
    const now      = Date.now();

    for (let i = state.remoteBullets.length - 1; i >= 0; i--) {
        const b = state.remoteBullets[i];

        // Expire bullets that are over 5s old (safety net)
        if (now - b.createdAt > 5000) {
            state.remoteBullets.splice(i, 1);
            continue;
        }

        b.x += b.vx;
        b.y += b.vy;

        // FIX: Arena border bounce — same logic as local bullets.
        // With bounce upgrades, remote bullets correctly bounce off borders.
        let hitBoundary = false;
        if (b.x - (b.radius || 5) < 0)    { b.x = b.radius || 5;       b.vx =  Math.abs(b.vx); hitBoundary = true; }
        if (b.x + (b.radius || 5) > mapW)  { b.x = mapW - (b.radius||5); b.vx = -Math.abs(b.vx); hitBoundary = true; }
        if (b.y - (b.radius || 5) < 0)    { b.y = b.radius || 5;       b.vy =  Math.abs(b.vy); hitBoundary = true; }
        if (b.y + (b.radius || 5) > mapH)  { b.y = mapH - (b.radius||5); b.vy = -Math.abs(b.vy); hitBoundary = true; }

        if (hitBoundary) {
            if ((b.bouncesLeft || 0) > 0) b.bouncesLeft--;
            else { state.remoteBullets.splice(i, 1); continue; }
        }

        // Wall collision for remote bullets
        if (allWalls.length > 0) {
            const res = getWallCollisionResult(b.x, b.y, b.radius || 5, allWalls, state.localBreakables);
            if (res.hit) {
                if ((b.bouncesLeft || 0) > 0) {
                    if (res.nx) b.vx *= -1;
                    if (res.ny) b.vy *= -1;
                    b.bouncesLeft--;
                } else {
                    state.remoteBullets.splice(i, 1);
                    continue;
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// MAIN PHYSICS TICK
// ---------------------------------------------------------------------------
export function updateLocalGame() {
    if (!state.latestServerData || state.latestServerData.gameState !== 'PLAYING') return;
    if (!socket || !socket.id) return;

    if (!state.playerInputs) state.playerInputs = {};
    if (!state.localBullets) state.localBullets  = [];

    const playersData = state.latestServerData.players || {};
    const myId        = socket.id;
    const me          = playersData[myId];
    if (!me || me.hp <= 0) return;

    const mapW     = CONFIG.MAP_WIDTH  || 1920;
    const mapH     = CONFIG.MAP_HEIGHT || 1080;
    const pRadius  = me.playerRadius || CONFIG.PLAYER_RADIUS || 20;
    const allWalls = [...(state.localObstacles || []), ...(state.localBreakables || [])];
    const now      = Date.now();

    // ── DASH ────────────────────────────────────────────────────────────────
    const rightClickRising = state.playerInputs.rightClick && !_prevRightClick;
    _prevRightClick = state.playerInputs.rightClick;

    if (rightClickRising && now >= _dashCooldownEnd) {
        _dashActive      = true;
        _dashEndTime     = now + (CONFIG.DASH_DURATION || 200);
        _dashCooldownEnd = now + (CONFIG.DASH_COOLDOWN || 3000);
        socket.emit('Dash');
    }
    if (_dashActive && now >= _dashEndTime) _dashActive = false;

    // ── MOVEMENT ────────────────────────────────────────────────────────────
    const baseSpeed  = me.moveSpeed  || CONFIG.BASE_MOVE_SPEED || 0.8;
    const dashMult   = _dashActive ? (CONFIG.DASH_SPEED_MULTIPLIER || 4) : 1;
    const pixelSpeed = baseSpeed * 5 * dashMult;

    let nextX = me.x, nextY = me.y;
    if (state.playerInputs.up)    nextY -= pixelSpeed;
    if (state.playerInputs.down)  nextY += pixelSpeed;
    nextY = Math.max(pRadius, Math.min(mapH - pRadius, nextY));
    if (!checkWallCollision(me.x, nextY, pRadius, allWalls)) me.y = nextY;

    if (state.playerInputs.left)  nextX -= pixelSpeed;
    if (state.playerInputs.right) nextX += pixelSpeed;
    nextX = Math.max(pRadius, Math.min(mapW - pRadius, nextX));
    if (!checkWallCollision(nextX, me.y, pRadius, allWalls)) me.x = nextX;

    // ── AIM ─────────────────────────────────────────────────────────────────
    if (state.worldMouseX !== undefined && state.worldMouseY !== undefined) {
        state.playerInputs.aimAngle = Math.atan2(
            state.worldMouseY - me.y, state.worldMouseX - me.x
        );
    }
    const currentAimAngle = state.playerInputs.aimAngle || 0;

    // ── SHOOT ───────────────────────────────────────────────────────────────
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

    // ── RITUAL RISING EDGE ──────────────────────────────────────────────────
    const ritualRising = state.playerInputs.ritual && !_prevRitual;
    _prevRitual = state.playerInputs.ritual;

    // ── CLIENT SYNC (30 pps) ────────────────────────────────────────────────
    _syncThrottle++;
    if (_syncThrottle >= 2) {
        _syncThrottle = 0;
        socket.emit('clientSync', {
            x: me.x, y: me.y, aimAngle: currentAimAngle,
            ammo: me.ammo,
            isReloading:     state.playerInputs.reload || me.isReloading || false,
            dashRequested:   false,
            ritualRequested: ritualRising
        });
    }

    // ── LOCAL BULLET PHYSICS ────────────────────────────────────────────────
    const hitWallsThisTick = new Set(); // prevent multi-hit per tick

    for (let i = state.localBullets.length - 1; i >= 0; i--) {
        const b = state.localBullets[i];
        const prevX = b.x, prevY = b.y;

        b.x += b.vx;
        b.y += b.vy;

        // FIX: Arena border — bullets bounce if they have bouncesLeft, else remove.
        // This makes arena borders a valid bounce surface for bounce upgrades.
        let hitBoundary = false;
        if (b.x - b.radius < 0)    { b.x = b.radius;        b.vx =  Math.abs(b.vx); hitBoundary = true; }
        if (b.x + b.radius > mapW) { b.x = mapW - b.radius; b.vx = -Math.abs(b.vx); hitBoundary = true; }
        if (b.y - b.radius < 0)    { b.y = b.radius;        b.vy =  Math.abs(b.vy); hitBoundary = true; }
        if (b.y + b.radius > mapH) { b.y = mapH - b.radius; b.vy = -Math.abs(b.vy); hitBoundary = true; }

        if (hitBoundary) {
            if (b.bouncesLeft > 0) b.bouncesLeft--;
            else { state.localBullets.splice(i, 1); continue; }
        }

        // Interior wall collision
        const res = getWallCollisionResult(b.x, b.y, b.radius, allWalls, state.localBreakables);
        if (res.hit) {
            // FIX: Emit bulletHitWall for breakable walls (so server damages them)
            if (res.wallId !== null && !hitWallsThisTick.has(`${b.id}-${res.wallId}`)) {
                hitWallsThisTick.add(`${b.id}-${res.wallId}`);
                socket.emit('bulletHitWall', { wallId: res.wallId, bulletId: b.id });
            }

            if (b.bouncesLeft > 0) {
                if (res.nx) b.vx *= -1;
                if (res.ny) b.vy *= -1;
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
                    targetId, damage: b.damage, bulletId: b.id, lifesteal: me.lifesteal || 0
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
// DASH HUD STATE
// ---------------------------------------------------------------------------
export function getDashState() {
    const now = Date.now();
    return {
        active:      _dashActive,
        cooldown:    Math.max(0, _dashCooldownEnd - now),
        maxCooldown: CONFIG.DASH_COOLDOWN || 3000
    };
}