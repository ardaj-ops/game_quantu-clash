// game/network.js
import { state } from './state.js';

export let socket = null;

// ─── INTERPOLATION CONFIG ────────────────────────────────────────────────────
// Remote players smoothly lerp toward server position each render frame.
// Local player: if server delta < THRESHOLD, keep local prediction (no jitter).
// If delta ≥ THRESHOLD, lerp toward server correction so it eases in smoothly.

const REMOTE_LERP  = 0.20;   // 0–1: how fast remote players chase server (per frame)
const LOCAL_LERP   = 0.30;   // correction speed when local prediction is off by > threshold
const THRESHOLD    = 10;      // px — below this, trust local prediction entirely

function lerp(a, b, t)  { return a + (b - a) * t; }
function lerpAngle(a, b, t) {
    let d = b - a;
    while (d >  Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
}

// ─── NETWORK INIT ────────────────────────────────────────────────────────────
export function initNetwork() {
    socket = window.gameSocket;
    if (!socket) {
        console.error('❌ window.gameSocket chybí!');
        return;
    }
    console.log('✅ ENGINE socket:', socket.id);

    // ── gameUpdate ──────────────────────────────────────────────────────────
    socket.on('gameUpdate', (serverData) => {
        if (!serverData?.players) { state.latestServerData = serverData; return; }

        const myId = socket.id;

        for (const id in serverData.players) {
            const sp = serverData.players[id]; // server position

            // Bootstrap interpolation entry on first sight
            if (!state.interpolatedPlayers[id]) {
                state.interpolatedPlayers[id] = { x: sp.x, y: sp.y, aimAngle: sp.aimAngle || 0 };
            }
            const ip = state.interpolatedPlayers[id];

            if (id === myId) {
                // ── LOCAL PLAYER ──────────────────────────────────────────
                const prev = state.latestServerData?.players?.[myId];

                if (prev) {
                    const dist = Math.hypot(prev.x - sp.x, prev.y - sp.y);

                    if (dist < THRESHOLD) {
                        // Server agrees — keep local prediction
                        ip.x = prev.x;
                        ip.y = prev.y;
                        serverData.players[myId].x = prev.x;
                        serverData.players[myId].y = prev.y;
                    } else {
                        // Server correction — ease in smoothly instead of snapping
                        ip.x = lerp(prev.x, sp.x, LOCAL_LERP);
                        ip.y = lerp(prev.y, sp.y, LOCAL_LERP);
                        serverData.players[myId].x = ip.x;
                        serverData.players[myId].y = ip.y;
                    }
                    ip.aimAngle = lerpAngle(ip.aimAngle, sp.aimAngle || 0, 0.5);

                    // Ammo reconciliation — prevent counter flicker
                    if (prev.ammo < sp.ammo && !prev.isReloading && !sp.isReloading) {
                        serverData.players[myId].ammo = prev.ammo;
                    }
                    if (prev.isReloading && prev.ammo === 0) {
                        serverData.players[myId].isReloading = true;
                    }
                } else {
                    // No previous frame — snap to server
                    ip.x = sp.x; ip.y = sp.y; ip.aimAngle = sp.aimAngle || 0;
                }

            } else {
                // ── REMOTE PLAYERS ────────────────────────────────────────
                // Always smoothly chase server position
                ip.x        = lerp(ip.x,        sp.x,            REMOTE_LERP);
                ip.y        = lerp(ip.y,        sp.y,            REMOTE_LERP);
                ip.aimAngle = lerpAngle(ip.aimAngle, sp.aimAngle || 0, REMOTE_LERP);
            }
        }

        // Clean up disconnected players
        for (const id in state.interpolatedPlayers) {
            if (!serverData.players[id]) delete state.interpolatedPlayers[id];
        }

        state.latestServerData = serverData;
    });

    // ── mapUpdate ───────────────────────────────────────────────────────────
    socket.on('mapUpdate', (data) => {
        if (data.obstacles) state.localObstacles = data.obstacles;
        if (data.breakables) state.localBreakables = data.breakables;
    });

    // ── gameStateChanged ────────────────────────────────────────────────────
    socket.on('gameStateChanged', (data) => {
        console.log(`🔄 [${data.state}] kolo ${data.round || 1}`);
        if (data.obstacles?.length) state.localObstacles = data.obstacles;
        if (data.breakables?.length) state.localBreakables = data.breakables;

        if (data.state === 'PLAYING') {
            const cs = document.getElementById('card-screen');
            if (cs) cs.style.display = 'none';
        }
        if (data.state === 'LOBBY' || data.state === 'GAMEOVER') {
            state.latestServerData   = null;
            state.localBullets       = [];
            state.remoteBullets      = [];
            state.interpolatedPlayers = {};
        }
    });

    // ── showCardSelection ───────────────────────────────────────────────────
    socket.on('showCardSelection', (cards) => {
        const screen    = document.getElementById('card-screen');
        const container = document.getElementById('card-container');
        if (!screen || !container) return;
        container.innerHTML = '';
        let picked = false; // guard against double-click

        cards.forEach(card => {
            const el = document.createElement('div');
            el.className = `card ${card.rarity.toLowerCase()}`;
            el.innerHTML = `
                <div class="rarity-tag">${card.rarity.toUpperCase()}</div>
                <h3>${card.name}</h3>
                <p>${card.description}</p>`;
            el.onclick = () => {
                if (picked) return;
                picked = true;
                socket.emit('selectCard', card.name);
                screen.style.display = 'none';
                // Visually disable all cards immediately
                container.querySelectorAll('.card').forEach(c => {
                    c.onclick = null;
                    c.style.opacity = '0.35';
                    c.style.pointerEvents = 'none';
                });
            };
            container.appendChild(el);
        });
        screen.style.display = 'flex';
    });

    // ── enemyShot ───────────────────────────────────────────────────────────
    socket.on('enemyShot', (bulletsData) => {
        if (!bulletsData) return;
        if (!state.remoteBullets) state.remoteBullets = [];
        const arr = Array.isArray(bulletsData) ? bulletsData : [bulletsData];
        arr.forEach(b => { if (b) state.remoteBullets.push({ ...b, createdAt: Date.now() }); });
    });

    // ── breakable wall update ───────────────────────────────────────────────
    // Server sends updated breakable state after a bullet hits
    socket.on('breakableUpdate', (updated) => {
        if (!state.localBreakables) return;
        updated.forEach(u => {
            const w = state.localBreakables.find(b => b.id === u.id);
            if (w) { w.hp = u.hp; w.destroyed = u.destroyed; }
        });
    });

    // Stubs
    socket.on('playerDamaged',    () => {});
    socket.on('enemyDecoySpawned',() => {});
    socket.on('gravityChanged',   () => {});
    socket.on('enemyDash',        () => {});
}