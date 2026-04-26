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

// --- PERSIST SETTINGS ---
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

// Colour preset dots
document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        const c = dot.dataset.color;
        colorInput.value = c;
        localStorage.setItem('qc_player_color', c);
        updateColorDots(c);
    });
});

// --- MENU ACTIONS ---
document.getElementById('btn-create-room')?.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'Hráč';
    socket.emit('createRoom', { name, color: colorInput.value, cosmetics: 'none' });
});

document.getElementById('btn-join-room')?.addEventListener('click', () => {
    const code = document.getElementById('room-code').value.toUpperCase().trim();
    if (!code) { alert('Zadej kód místnosti!'); return; }
    socket.emit('joinRoom', {
        roomId: code,
        name:   nameInput.value.trim() || 'Hráč',
        color:  colorInput.value
    });
});

document.getElementById('btn-back-to-menu')?.addEventListener('click', () => showScreen('menu'));

// --- READY BUTTON ---
const btnReady = document.getElementById('btn-ready');
let amReady = false;
btnReady?.addEventListener('click', () => {
    socket.emit('playerReady');
});

// --- COPY CODE ---
const btnCopy   = document.getElementById('btn-copy-code');
const lobbyCode = document.getElementById('lobby-title');
btnCopy?.addEventListener('click', () => {
    const code = lobbyCode?.innerText || '';
    if (!code || code === '----') return;
    navigator.clipboard.writeText(code).then(() => {
        btnCopy.textContent = '✅';
        setTimeout(() => { btnCopy.textContent = '📋'; }, 1500);
    });
});
lobbyCode?.addEventListener('click', () => btnCopy?.click());

// --- LOBBY EVENTS ---
socket.on('roomCreated', ({ roomId }) => {
    if (lobbyCode) lobbyCode.innerText = roomId;
    showScreen('lobby');
});
socket.on('roomJoined', ({ roomId }) => {
    if (lobbyCode) lobbyCode.innerText = roomId;
    showScreen('lobby');
});

socket.on('updatePlayerList', (players) => {
    amReady = false;
    const list = document.getElementById('player-list');
    if (!list) return;

    list.innerHTML = players.map(p => {
        const isMe = p.id === socket.id;
        if (isMe) amReady = p.isReady;
        return `
        <div class="player-row" style="border-left-color:${p.color}">
            <div class="player-avatar" style="background:${p.color}">${(p.name||'?')[0].toUpperCase()}</div>
            <div class="player-name">
                ${escHtml(p.name)}
                ${isMe ? '<span class="player-you">(TY)</span>' : ''}
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
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// --- GAME STATE ---
socket.on('errorMsg', (msg) => alert(msg));

socket.on('gameStateChanged', (data) => {
    if (data.state === 'PLAYING') {
        showScreen('game');
        initGameEngine();
    }
    if (data.state === 'GAMEOVER') showScreen('gameover');
});