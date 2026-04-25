// game/network.js
import { state } from './state.js';

export let socket = null;

// --- INTERPOLATION CONSTANTS ---
// How aggressively to lerp REMOTE players toward server position per render frame.
// 0.15 = smooth lag, 0.25 = responsive, 0.4 = snappier (pick based on feel).
const REMOTE_LERP = 0.20;

// How aggressively to correct LOCAL player when server disagrees by > CORRECTION_THRESHOLD.
// Smaller = smoother correction but lag if wall pushback is needed.
const LOCAL_LERP = 0.30;

// Below this px distance, trust the local prediction completely (no correction applied).
// Above it, server wins and correction lerps in at LOCAL_LERP speed.
const CORRECTION_THRESHOLD = 10;

// Helper: linear interpolation
function lerp(a, b, t) { return a + (b - a) * t; }

// Helper: shortest angle interpolation (handles wrap-around at ±π)
function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
}

export function initNetwork() {
    socket = window.gameSocket;

    if (!socket) {
        console.error("❌ window.gameSocket chybí! Zkontroluj app.js.");
        return;
    }

    console.log('✅ ENGINE socket ID:', socket.id);

    socket.on('gameUpdate', (serverData) => {
        if (!serverData || !serverData.players) {
            state.latestServerData = serverData;
            return;
        }

        const myId = socket.id;

        // -------------------------------------------------------
        // RUBBERBANDING FIX
        // -------------------------------------------------------
        // Strategy: we NEVER modify the server's data object directly.
        // Instead, we maintain state.interpolatedPlayers which smoothly
        // chases the server truth. render.js reads interpolatedPlayers
        // for drawing; physics.js reads latestServerData.players for logic.
        //
        // For the LOCAL player:
        //   - If dist(local, server) < threshold → keep local prediction (no correction)
        //   - If dist(local, server) ≥ threshold → lerp toward server position
        //     This removes the jarring snap while still eventually correcting.
        //
        // For REMOTE players:
        //   - Always lerp interpolatedPlayers toward server position
        //   - This gives smooth rendering even with variable network delay
        // -------------------------------------------------------

        for (const id in serverData.players) {
            const serverP = serverData.players[id];
            if (!state.interpolatedPlayers[id]) {
                // First time seeing this player — initialize at exact server position
                state.interpolatedPlayers[id] = {
                    x: serverP.x,
                    y: serverP.y,
                    aimAngle: serverP.aimAngle || 0
                };
            }
            const interp = state.interpolatedPlayers[id];

            if (id === myId) {
                // LOCAL PLAYER
                const localMe = state.latestServerData?.players?.[myId];
                if (localMe) {
                    const dist = Math.hypot(localMe.x - serverP.x, localMe.y - serverP.y);

                    if (dist < CORRECTION_THRESHOLD) {
                        // Server agrees with our prediction — stay at local position
                        interp.x = localMe.x;
                        interp.y = localMe.y;
                        // Also update serverData so physics.js keeps predicting correctly
                        serverData.players[myId].x = localMe.x;
                        serverData.players[myId].y = localMe.y;
                    } else {
                        // Server disagrees — smoothly lerp toward server truth.
                        // Update both interpolated (for rendering) AND serverData (so
                        // physics.js starts predicting from the corrected position).
                        interp.x = lerp(localMe.x, serverP.x, LOCAL_LERP);
                        interp.y = lerp(localMe.y, serverP.y, LOCAL_LERP);
                        serverData.players[myId].x = interp.x;
                        serverData.players[myId].y = interp.y;
                    }
                    interp.aimAngle = lerpAngle(interp.aimAngle, serverP.aimAngle || 0, 0.5);
                } else {
                    // No previous local state — snap to server
                    interp.x = serverP.x;
                    interp.y = serverP.y;
                    interp.aimAngle = serverP.aimAngle || 0;
                }

                // Ammo reconciliation: prevent counter flickering
                const localAmmo = state.latestServerData?.players?.[myId]?.ammo;
                if (localAmmo !== undefined && localAmmo < serverP.ammo &&
                    !state.latestServerData?.players?.[myId]?.isReloading &&
                    !serverP.isReloading) {
                    serverData.players[myId].ammo = localAmmo;
                }
                if (state.latestServerData?.players?.[myId]?.isReloading && localAmmo === 0) {
                    serverData.players[myId].isReloading = true;
                }

            } else {
                // REMOTE PLAYER — smoothly chase server position
                interp.x        = lerp(interp.x,        serverP.x,            REMOTE_LERP);
                interp.y        = lerp(interp.y,        serverP.y,            REMOTE_LERP);
                interp.aimAngle = lerpAngle(interp.aimAngle, serverP.aimAngle || 0, REMOTE_LERP);
            }
        }

        // Clean up players that left
        for (const id in state.interpolatedPlayers) {
            if (!serverData.players[id]) {
                delete state.interpolatedPlayers[id];
            }
        }

        state.latestServerData = serverData;
    });

    socket.on('mapUpdate', (data) => {
        if (data.obstacles) state.localObstacles = data.obstacles;
        if (data.breakables) state.localBreakables = data.breakables;
        console.log(`🗺️ mapUpdate: ${data.obstacles?.length || 0} zdí, ${data.breakables?.length || 0} bloků`);
    });

    socket.on('gameStateChanged', (data) => {
        console.log(`🔄 ENGINE stav: [${data.state}] (Kolo: ${data.round || 1})`);

        if (data.obstacles?.length > 0) state.localObstacles = data.obstacles;
        if (data.breakables?.length > 0) state.localBreakables = data.breakables;

        if (data.state === 'PLAYING') {
            const cardScreen = document.getElementById('card-screen');
            if (cardScreen) cardScreen.style.display = 'none';
        }

        if (data.state === 'LOBBY' || data.state === 'GAMEOVER') {
            state.latestServerData = null;
            state.localBullets = [];
            state.remoteBullets = [];
            state.interpolatedPlayers = {};
        }
    });

    socket.on('showCardSelection', (cards) => {
        const screen    = document.getElementById('card-screen');
        const container = document.getElementById('card-container');
        if (!screen || !container) return;

        container.innerHTML = '';
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = `card ${card.rarity.toLowerCase()}`;
            cardEl.innerHTML = `
                <div class="rarity-tag">${card.rarity.toUpperCase()}</div>
                <h3>${card.name}</h3>
                <p>${card.description}</p>
            `;
            cardEl.onclick = () => {
                socket.emit('selectCard', card.name);
                screen.style.display = 'none';
                // BUG FIX: Disable all cards after clicking one — prevents double-emit
                // from rapid double-click before screen hides
                container.querySelectorAll('.card').forEach(el => {
                    el.onclick = null;
                    el.style.opacity = '0.4';
                    el.style.pointerEvents = 'none';
                });
            };
            container.appendChild(cardEl);
        });

        screen.style.display = 'flex';
    });

    socket.on('enemyShot', (bulletsData) => {
        if (!bulletsData) return;
        if (!state.remoteBullets) state.remoteBullets = [];
        const arr = Array.isArray(bulletsData) ? bulletsData : [bulletsData];
        arr.forEach(b => { if (b) state.remoteBullets.push({ ...b, createdAt: Date.now() }); });
    });

    // Stubbed listeners (events emitted by server but not yet consumed)
    socket.on('playerDamaged',    () => {});
    socket.on('enemyDecoySpawned',() => {});
    socket.on('gravityChanged',   () => {});
    socket.on('enemyDash',        () => {});
}
