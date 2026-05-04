// app.js
import { initGameEngine } from './game/main.js';

const socket = io();
window.gameSocket = socket;

const screens = {
    menu:     document.getElementById('menu-screen'),
    lobby:    document.getElementById('lobby-screen'),
    game:     document.getElementById('game-screen'),
    cards:    document.getElementById('card-screen'),
    gameover: document.getElementById('gameover-screen')
};

function showScreen(name) {
    Object.values(screens).forEach(s => { if (s) s.style.display = 'none'; });
    if (screens[name]) screens[name].style.display = (name === 'game') ? 'block' : 'flex';
}

// ── PERSIST SETTINGS ────────────────────────────────────────────────────────
const nameInput  = document.getElementById('player-name');
const colorInput = document.getElementById('player-color');

window.addEventListener('load', () => {
    const n = localStorage.getItem('qc_player_name');
    const c = localStorage.getItem('qc_player_color');
    if (n && nameInput)  nameInput.value  = n;
    if (c && colorInput) colorInput.value = c;
    updateColorDots(c || '#45f3ff');
});

nameInput?.addEventListener('input',  () => localStorage.setItem('qc_player_name',  nameInput.value));
colorInput?.addEventListener('input', () => {
    localStorage.setItem('qc_player_color', colorInput.value);
    updateColorDots(colorInput.value);
});

function updateColorDots(hex) {
    document.querySelectorAll('.color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === hex);
    });
}
document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        const c = dot.dataset.color;
        if (colorInput) colorInput.value = c;
        localStorage.setItem('qc_player_color', c);
        updateColorDots(c);
    });
});

// ── MENU ACTIONS ─────────────────────────────────────────────────────────────
document.getElementById('btn-create-room')?.addEventListener('click', () => {
    socket.emit('createRoom', {
        name:  nameInput?.value.trim() || 'Hráč',
        color: colorInput?.value || '#45f3ff',
        cosmetics: 'none'
    });
});

document.getElementById('btn-join-room')?.addEventListener('click', () => {
    const code = document.getElementById('room-code')?.value.toUpperCase().trim();
    if (!code) { alert('Zadej kód místnosti!'); return; }
    socket.emit('joinRoom', {
        roomId: code,
        name:   nameInput?.value.trim() || 'Hráč',
        color:  colorInput?.value || '#45f3ff'
    });
});

document.getElementById('btn-back-to-menu')?.addEventListener('click', () => showScreen('menu'));

// ── MATCH SETTINGS (creator only) ────────────────────────────────────────────
document.getElementById('btn-apply-settings')?.addEventListener('click', () => {
    const maxRounds  = parseInt(document.getElementById('setting-maxRounds')?.value)  || 25;
    const startingHp = parseInt(document.getElementById('setting-startingHp')?.value) || 100;
    const gameMode   = document.getElementById('setting-gameMode')?.value || 'FFA';
    socket.emit('changeSettings', { maxRounds, startingHp, gameMode });
});

// Auto-apply on any input change (live preview)
['setting-maxRounds', 'setting-startingHp', 'setting-gameMode'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
        document.getElementById('btn-apply-settings')?.click();
    });
});

// ── READY BUTTON ─────────────────────────────────────────────────────────────
const btnReady = document.getElementById('btn-ready');
let amReady = false;
btnReady?.addEventListener('click', () => socket.emit('playerReady'));

// ── COPY CODE ─────────────────────────────────────────────────────────────────
const btnCopy   = document.getElementById('btn-copy-code');
const lobbyCode = document.getElementById('lobby-title');
btnCopy?.addEventListener('click', () => {
    const code = lobbyCode?.innerText || '';
    if (!code || code === '----') return;
    navigator.clipboard.writeText(code).then(() => {
        if (btnCopy) btnCopy.textContent = '✅';
        setTimeout(() => { if (btnCopy) btnCopy.textContent = '📋'; }, 1500);
    });
});
lobbyCode?.addEventListener('click', () => btnCopy?.click());

// ── LOBBY EVENTS ──────────────────────────────────────────────────────────────
socket.on('roomCreated', ({ roomId }) => {
    if (lobbyCode) lobbyCode.innerText = roomId;
    showScreen('lobby');
});
socket.on('roomJoined', ({ roomId }) => {
    if (lobbyCode) lobbyCode.innerText = roomId;
    showScreen('lobby');
});

socket.on('updatePlayerList', (players) => {
    const list = document.getElementById('player-list');
    if (!list) return;
    amReady = false;

    list.innerHTML = players.map(p => {
        const isMe = p.id === socket.id;
        if (isMe) amReady = p.isReady;
        return `
        <div class="player-row" style="border-left-color:${p.color}">
            <div class="player-avatar" style="background:${p.color}">${(p.name || '?')[0].toUpperCase()}</div>
            <div class="player-name">
                ${escHtml(p.name)} ${isMe ? '<span class="player-you">(TY)</span>' : ''}
            </div>
            <span class="player-status ${p.isReady ? 'ready' : 'waiting'}">
                ${p.isReady ? '✔ READY' : '⏳ ČEKÁ'}
            </span>
        </div>`;
    }).join('');

    if (btnReady) {
        btnReady.textContent = amReady ? '✅ PŘIPRAVEN' : 'PŘIPRAVIT SE';
        btnReady.classList.toggle('is-ready', amReady);
    }
});

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── GAME STATE ────────────────────────────────────────────────────────────────
socket.on('errorMsg', (msg) => alert(msg));

socket.on('gameStateChanged', (data) => {
    if (data.state === 'PLAYING') {
        showScreen('game');
        initGameEngine();

        // Hide winner overlay when game resumes
        const wo = document.getElementById('winner-wait-overlay');
        if (wo) wo.style.display = 'none';
    }

    // FIX: Show winner overlay to the survivor when card selection starts.
    // The winner's id isn't known here, so render.js also checks via canvas.
    // This HTML overlay shows real-time pick progress on top of the canvas.
    if (data.state === 'CARD_SELECTION') {
        const myId = socket.id;
        const isLoser = data.loserData?.some(l => l.id === myId);

        if (!isLoser) {
            // I'm the winner — show the overlay
            const wo = document.getElementById('winner-wait-overlay');
            if (wo) {
                wo.style.display = 'block';
                const statusEl = document.getElementById('winner-pick-status');
                const logEl    = document.getElementById('winner-pick-log');
                if (statusEl) statusEl.textContent = `0 / ${data.totalLosers || 0} hráčů vybralo`;
                if (logEl)    logEl.innerHTML = '';

                // Show each loser's card options in the overlay
                if (data.loserData?.length) {
                    data.loserData.forEach(loser => {
                        const section = document.createElement('div');
                        section.style.cssText = 'margin-bottom:8px;';
                        section.innerHTML = `<div style="color:${loser.color};font-size:12px;font-weight:600;margin-bottom:4px;">
                            ${escHtml(loser.name)} vybírá z:</div>
                            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                            ${(loser.options || []).map(c => `
                                <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(255,255,255,0.07);color:#aaa;">
                                    ${escHtml(c.name)}
                                </span>`).join('')}
                            </div>`;
                        if (logEl) logEl.appendChild(section);
                    });
                }
            }
        }
    }

    if (data.state === 'BOSS_PICKING') {
        // Boss mode: show which boss is picking, show card UI to boss
        const bossStatusEl = document.getElementById('boss-picking-banner');
        if (bossStatusEl) {
            bossStatusEl.style.display = 'block';
            bossStatusEl.textContent = data.bossName + ' (BOSS) vybírá karty…';
            bossStatusEl.style.color = data.bossColor || '#ff2a7a';
        }
    }

    if (data.state === 'GAMEOVER') {
        // BUG FIX: Populate winner name and final scores before showing gameover screen.
        // Previously showScreen was called but winner-text was never set.
        const winnerEl = document.getElementById('winner-text');
        if (winnerEl && data.winnerName) {
            winnerEl.style.color = data.winnerColor || '#45f3ff';
            winnerEl.textContent = data.winnerName + ' vyhrál hru!';
        }
        // Show final scoreboard if element exists
        const scoreListEl = document.getElementById('gameover-scores');
        if (scoreListEl && data.scores) {
            scoreListEl.innerHTML = data.scores
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map(p => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:rgba(255,255,255,0.04);border-left:3px solid ${p.color};border-radius:6px;margin-bottom:4px;">
                    <span style="color:${p.color};font-weight:600;">${escHtml(p.name)}</span>
                    <span style="color:#f1c40f;font-family:'Orbitron',sans-serif;font-size:13px;">${p.score} bodů</span>
                </div>`).join('');
        }
        showScreen('gameover');
    }
});
