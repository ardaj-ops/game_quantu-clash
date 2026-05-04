// game/physics.js — 80% CLIENT SIDE
// This file handles ALL real-time physics:
//  • Local player movement + wall collision
//  • Local bullet simulation (spawn, move, bounce, hit detection)
//  • Remote bullet simulation (frame-by-frame, with wall/border bounce)
//  • Dash timing (client-authoritative, server only told for visual fx)
//  • clientSync throttled to 20pps (server updates position at 20fps)

import { state } from './state.js';
import { socket } from './network.js';
import { CONFIG } from '../gameConfig.js';

// ─── WALL COLLISION ──────────────────────────────────────────────────────────

export function checkWallCollision(x, y, radius, walls) {
    if (!walls || walls.length === 0) return false;
    for (const wall of walls) {
        // BUG FIX: Skip border walls (isBorder flag, negative coords) — player
        // movement is already clamped by Math.max/min, so border walls in the
        // collision list just waste CPU and produce wrong push-out normals.
        if (!wall || wall.isBorder || wall.destroyed || (wall.hp !== undefined && wall.hp <= 0)) continue;
        const tx = Math.max(wall.x, Math.min(x, wall.x + wall.width));
        const ty = Math.max(wall.y, Math.min(y, wall.y + wall.height));
        const dx = x - tx, dy = y - ty;
        if (dx * dx + dy * dy <= radius * radius) return true;
    }
    return false;
}

// Returns collision normal + wallId (for breakable hit detection)
function getWallCollisionResult(x, y, radius, allWalls, breakables) {
    for (const wall of allWalls) {
        // BUG FIX: Skip border walls here too — bullets already bounce off arena
        // borders via the explicit boundary checks below. Including border walls
        // in this loop caused incorrect normals on corner shots.
        if (!wall || wall.isBorder || wall.destroyed || (wall.hp !== undefined && wall.hp <= 0)) continue;
        const tx = Math.max(wall.x, Math.min(x, wall.x + wall.width));
        const ty = Math.max(wall.y, Math.min(y, wall.y + wall.height));
        const dx = x - tx, dy = y - ty;
        if (dx * dx + dy * dy > radius * radius) continue;
        const overlapX = wall.width  / 2 - Math.abs(x - (wall.x + wall.width  / 2));
        const overlapY = wall.height / 2 - Math.abs(y - (wall.y + wall.height / 2));
        const nx = overlapX < overlapY ? 1 : 0;
        const ny = nx ? 0 : 1;
        const isBreakable = breakables ? breakables.some(b => b === wall || b.id === wall.id) : false;
        return { hit: true, nx, ny, wallId: isBreakable ? wall.id : null };
    }
    return { hit: false, nx: 0, ny: 0, wallId: null };
}

// ─── DASH STATE ──────────────────────────────────────────────────────────────
let _dashActive      = false;
let _dashEndTime     = 0;
let _dashCooldownEnd = 0;
let _prevRitual      = false;
let _prevRightClick  = false;
// 20/80 SPLIT: sync at 20pps (every 3rd tick at 60fps)
let _syncThrottle    = 0;

// ─── REMOTE BULLET SIMULATION ────────────────────────────────────────────────
// Enemy bullets are simulated frame-by-frame on client so they appear smooth.
// Server only relays the initial spawn data; physics runs 100% client-side.
export function updateRemoteBullets() {
    if (!state.remoteBullets || state.remoteBullets.length === 0) return;

    const mapW = CONFIG.MAP_WIDTH  || 1920;
    const mapH = CONFIG.MAP_HEIGHT || 1080;
    // BUG FIX: Only include non-border interior walls for bullet wall collision.
    // Border walls are handled by the explicit x/y boundary checks below.
    const allWalls = [
        ...(state.localObstacles || []).filter(w => !w.isBorder),
        ...(state.localBreakables || [])
    ];
    const now = Date.now();

    for (let i = state.remoteBullets.length - 1; i >= 0; i--) {
        const b = state.remoteBullets[i];
        if (now - b.createdAt > 5000) { state.remoteBullets.splice(i, 1); continue; }

        b.x += b.vx;
        b.y += b.vy;

        // Arena border bounce (arena walls are a bounce surface)
        let hitBoundary = false;
        const r = b.radius || 5;
        if (b.x - r < 0)    { b.x = r;        b.vx =  Math.abs(b.vx); hitBoundary = true; }
        if (b.x + r > mapW) { b.x = mapW - r;  b.vx = -Math.abs(b.vx); hitBoundary = true; }
        if (b.y - r < 0)    { b.y = r;        b.vy =  Math.abs(b.vy); hitBoundary = true; }
        if (b.y + r > mapH) { b.y = mapH - r;  b.vy = -Math.abs(b.vy); hitBoundary = true; }

        if (hitBoundary) {
            // FIX: Arena borders always bounce remote bullets for free too.
        }

        if (allWalls.length > 0) {
            const res = getWallCollisionResult(b.x, b.y, r, allWalls, state.localBreakables);
            if (res.hit) {
                if ((b.bouncesLeft || 0) > 0) {
                    if (res.nx) b.vx *= -1;
                    if (res.ny) b.vy *= -1;
                    b.bouncesLeft--;
                } else { state.remoteBullets.splice(i, 1); continue; }
            }
        }
    }
}

// ─── MAIN LOCAL PHYSICS TICK (60fps) ────────────────────────────────────────
export function updateLocalGame() {
    if (!state.latestServerData || state.latestServerData.gameState !== 'PLAYING') return;
    if (!socket || !socket.id) return;
    if (!state.playerInputs) state.playerInputs = {};
    if (!state.localBullets) state.localBullets  = [];

    const playersData = state.latestServerData.players || {};
    const myId  = socket.id;
    const me    = playersData[myId];
    if (!me || me.hp <= 0) return;

    const mapW    = CONFIG.MAP_WIDTH  || 1920;
    const mapH    = CONFIG.MAP_HEIGHT || 1080;
    const pRadius = me.playerRadius || CONFIG.PLAYER_RADIUS || 20;
    // BUG FIX: Filter border walls from allWalls for movement collision.
    const allWalls = [
        ...(state.localObstacles || []).filter(w => !w.isBorder),
        ...(state.localBreakables || [])
    ];
    const now = Date.now();

    // ── DASH ─────────────────────────────────────────────────────────────────
    const rcRising = state.playerInputs.rightClick && !_prevRightClick;
    _prevRightClick = state.playerInputs.rightClick;
    if (rcRising && now >= _dashCooldownEnd) {
        _dashActive      = true;
        _dashEndTime     = now + (CONFIG.DASH_DURATION || 200);
        _dashCooldownEnd = now + (CONFIG.DASH_COOLDOWN || 3000);
        socket.emit('Dash');
    }
    if (_dashActive && now >= _dashEndTime) _dashActive = false;

    // ── MOVEMENT ─────────────────────────────────────────────────────────────
    const baseSpeed  = me.moveSpeed || CONFIG.BASE_MOVE_SPEED || 0.8;
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

    // ── AIM ───────────────────────────────────────────────────────────────────
    if (state.worldMouseX !== undefined) {
        state.playerInputs.aimAngle = Math.atan2(
            state.worldMouseY - me.y, state.worldMouseX - me.x
        );
    }
    const aim = state.playerInputs.aimAngle || 0;

    // ── SHOOT ─────────────────────────────────────────────────────────────────
    const fireRate = me.fireRate || CONFIG.BASE_FIRE_RATE || 400;
    if (state.playerInputs.click &&
        now - (state.lastShotTime || 0) > fireRate &&
        me.ammo > 0 && me.maxAmmo > 0 && !me.isReloading) {

        state.lastShotTime = now;
        me.ammo--;
        if (me.ammo === 0) me.isReloading = true;

        const bSpeed    = me.bulletSpeed || CONFIG.BASE_BULLET_SPEED || 15;
        const bRadius   = me.bulletSize  || CONFIG.BULLET_RADIUS     || 5;
        const multishot = me.multishot   || 1;
        const spread    = me.spread      || 0;

        for (let s = 0; s < multishot; s++) {
            const offset = multishot > 1 ? (s - (multishot - 1) / 2) * (spread || 0.15) : 0;
            const angle  = aim + offset;
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

    // ── RITUAL ────────────────────────────────────────────────────────────────
    const ritualRising = state.playerInputs.ritual && !_prevRitual;
    _prevRitual = state.playerInputs.ritual;

    // ── CLIENT SYNC — 20pps (every 3rd frame at 60fps) ───────────────────────
    // 20/80 SPLIT: sync rate reduced from 30pps to 20pps to match server
    // broadcast rate. No point syncing faster than server broadcasts.
    _syncThrottle++;
    if (_syncThrottle >= 3) {
        _syncThrottle = 0;
        socket.emit('clientSync', {
            x: me.x, y: me.y, aimAngle: aim,
            ammo: me.ammo,
            isReloading:     state.playerInputs.reload || me.isReloading || false,
            dashRequested:   false,
            ritualRequested: ritualRising
        });
    }

    // ── LOCAL BULLET PHYSICS ──────────────────────────────────────────────────
    const hitWallsThisTick = new Set();

    for (let i = state.localBullets.length - 1; i >= 0; i--) {
        const b = state.localBullets[i];
        const prevX = b.x, prevY = b.y;

        b.x += b.vx;
        b.y += b.vy;

        // Arena border bounce
        let hitBoundary = false;
        if (b.x - b.radius < 0)    { b.x = b.radius;        b.vx =  Math.abs(b.vx); hitBoundary = true; }
        if (b.x + b.radius > mapW) { b.x = mapW - b.radius; b.vx = -Math.abs(b.vx); hitBoundary = true; }
        if (b.y - b.radius < 0)    { b.y = b.radius;        b.vy =  Math.abs(b.vy); hitBoundary = true; }
        if (b.y + b.radius > mapH) { b.y = mapH - b.radius; b.vy = -Math.abs(b.vy); hitBoundary = true; }

        if (hitBoundary) {
            // FIX: Arena borders ALWAYS bounce bullets for free (no bouncesLeft consumed).
            // Interior walls still consume bounces. This makes the arena border a permanent
            // bounce surface regardless of the player's bounce upgrade count.
        }

        // Interior wall collision
        const res = getWallCollisionResult(b.x, b.y, b.radius, allWalls, state.localBreakables);
        if (res.hit) {
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
            } else { state.localBullets.splice(i, 1); continue; }
        }

        // Player hit detection (client-side, reported to server for damage)
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
                } else { state.localBullets.splice(i, 1); removed = true; break; }
            }
        }
        if (removed) continue;
    }
}

// ─── DASH HUD STATE ──────────────────────────────────────────────────────────
export function getDashState() {
    const now = Date.now();
    return {
        active:      _dashActive,
        cooldown:    Math.max(0, _dashCooldownEnd - now),
        maxCooldown: CONFIG.DASH_COOLDOWN || 3000
    };
}
