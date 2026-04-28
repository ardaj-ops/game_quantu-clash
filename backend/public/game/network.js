// game/network.js
import { state } from './state.js';

export let socket = null;

const REMOTE_LERP = 0.20;
const LOCAL_LERP  = 0.30;
const THRESHOLD   = 10;

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpAngle(a, b, t) {
    let d = b - a;
    while (d >  Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
}

export function initNetwork() {
    socket = window.gameSocket;
    if (!socket) { console.error('❌ window.gameSocket chybí!'); return; }
    console.log('✅ ENGINE socket:', socket.id);

    // ── gameUpdate ──────────────────────────────────────────────────────────
    socket.on('gameUpdate', (serverData) => {
        if (!serverData?.players) { state.latestServerData = serverData; return; }

        const myId = socket.id;

        for (const id in serverData.players) {
            const sp = serverData.players[id];

            if (!state.interpolatedPlayers[id]) {
                state.interpolatedPlayers[id] = { x: sp.x, y: sp.y, aimAngle: sp.aimAngle || 0 };
            }
            const ip = state.interpolatedPlayers[id];

            if (id === myId) {
                const prev = state.latestServerData?.players?.[myId];
                if (prev) {
                    const dist = Math.hypot(prev.x - sp.x, prev.y - sp.y);
                    if (dist < THRESHOLD) {
                        ip.x = prev.x; ip.y = prev.y;
                        serverData.players[myId].x = prev.x;
                        serverData.players[myId].y = prev.y;
                    } else {
                        ip.x = lerp(prev.x, sp.x, LOCAL_LERP);
                        ip.y = lerp(prev.y, sp.y, LOCAL_LERP);
                        serverData.players[myId].x = ip.x;
                        serverData.players[myId].y = ip.y;
                    }
                    ip.aimAngle = lerpAngle(ip.aimAngle, sp.aimAngle || 0, 0.5);
                    if (prev.ammo < sp.ammo && !prev.isReloading && !sp.isReloading)
                        serverData.players[myId].ammo = prev.ammo;
                    if (prev.isReloading && prev.ammo === 0)
                        serverData.players[myId].isReloading = true;
                } else {
                    ip.x = sp.x; ip.y = sp.y; ip.aimAngle = sp.aimAngle || 0;
                }
            } else {
                ip.x        = lerp(ip.x,        sp.x,            REMOTE_LERP);
                ip.y        = lerp(ip.y,        sp.y,            REMOTE_LERP);
                ip.aimAngle = lerpAngle(ip.aimAngle, sp.aimAngle || 0, REMOTE_LERP);
            }
        }

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
            // Hide winner overlay when next round starts
            const wo = document.getElementById('winner-wait-overlay');
            if (wo) wo.style.display = 'none';
            state.cardSelectionData = null;
        }

        // FIX: Store loser card data so render.js can show it to the winner
        if (data.state === 'CARD_SELECTION') {
            state.cardSelectionData = {
                loserData:   data.loserData   || [],
                totalLosers: data.totalLosers || 0,
                pickedCount: data.pickedCount || 0
            };
        }

        if (data.state === 'LOBBY' || data.state === 'GAMEOVER') {
            state.latestServerData    = null;
            state.localBullets        = [];
            state.remoteBullets       = [];
            state.interpolatedPlayers = {};
            state.cardSelectionData   = null;
        }
    });

    // FIX: Live card pick progress — update stored state + HTML overlay for winner
    socket.on('cardPickProgress', (data) => {
        if (state.cardSelectionData) {
            state.cardSelectionData.pickedCount = data.pickedCount;
            // Mark this loser as having picked
            const loser = state.cardSelectionData.loserData?.find(l => l.id === data.pickerId);
            if (loser) { loser.picked = true; loser.chosenCard = data.cardName; loser.chosenRarity = data.cardRarity; }
        }

        // Update HTML winner overlay (if visible)
        const statusEl = document.getElementById('winner-pick-status');
        const logEl    = document.getElementById('winner-pick-log');
        if (statusEl) statusEl.textContent = `${data.pickedCount} / ${data.totalLosers} hráčů vybralo`;
        if (logEl) {
            const entry = document.createElement('div');
            entry.style.cssText = `display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.05);font-size:12px;`;
            entry.innerHTML = `<span style="color:${data.pickerColor};font-weight:600;">${data.pickerName}</span> <span style="color:#6b7280;">vybral</span> <span style="color:#45f3ff;">${data.cardName}</span>`;
            logEl.appendChild(entry);
            logEl.scrollTop = logEl.scrollHeight;
        }
    });

    // FIX: roomInfo — tells this client if they are the room creator + current settings
    socket.on('roomInfo', (data) => {
        window._isRoomCreator = data.isCreator;
        const settingsPanel   = document.getElementById('settings-panel');
        const settingsDisplay = document.getElementById('settings-display');
        if (settingsPanel)   settingsPanel.style.display   = data.isCreator ? 'block' : 'none';
        if (settingsDisplay) settingsDisplay.style.display = data.isCreator ? 'none'  : 'block';
        applySettingsDisplay(data.settings);
    });

    // FIX: settingsChanged — sync displayed settings for all players
    socket.on('settingsChanged', (settings) => {
        applySettingsDisplay(settings);
        // Also update creator inputs so they reflect current values
        const mr = document.getElementById('setting-maxRounds');
        const hp = document.getElementById('setting-startingHp');
        const gm = document.getElementById('setting-gameMode');
        if (mr) mr.value = settings.maxRounds;
        if (hp) hp.value = settings.startingHp;
        if (gm) gm.value = settings.gameMode;
    });

    // ── showCardSelection ───────────────────────────────────────────────────
    socket.on('showCardSelection', (cards) => {
        const screen    = document.getElementById('card-screen');
        const container = document.getElementById('card-container');
        if (!screen || !container) return;
        container.innerHTML = '';
        let picked = false;

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

    // ── breakableUpdate ─────────────────────────────────────────────────────
    socket.on('breakableUpdate', (updated) => {
        if (!state.localBreakables) return;
        updated.forEach(u => {
            const w = state.localBreakables.find(b => b.id === u.id);
            if (w) { w.hp = u.hp; w.destroyed = u.destroyed; }
        });
    });

    socket.on('playerDamaged',    () => {});
    socket.on('enemyDecoySpawned',() => {});
    socket.on('gravityChanged',   () => {});
    socket.on('enemyDash',        () => {});
}

// Helper — update the read-only settings display shown to non-creators
function applySettingsDisplay(settings) {
    const mr = document.getElementById('disp-maxRounds');
    const hp = document.getElementById('disp-startingHp');
    const gm = document.getElementById('disp-gameMode');
    if (mr) mr.textContent = settings.maxRounds;
    if (hp) hp.textContent = settings.startingHp + ' HP';
    if (gm) gm.textContent = settings.gameMode;

    // Also update rules list hint
    const maxScoreDisplay = document.getElementById('max-score-display');
    if (maxScoreDisplay) maxScoreDisplay.textContent = settings.maxRounds;
}
