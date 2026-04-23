import { initGameEngine } from './game/main.js';

const socket = io();
window.gameSocket = socket;

const screens = {
    menu: document.getElementById('menu-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    cards: document.getElementById('card-screen'),
    gameover: document.getElementById('gameover-screen')
};

// --- LOGIKA LOCAL STORAGE (Ukládání nastavení) ---
const nameInput = document.getElementById('player-name');
const colorInput = document.getElementById('player-color');

// Načtení při startu
window.addEventListener('load', () => {
    const savedName = localStorage.getItem('qc_player_name');
    const savedColor = localStorage.getItem('qc_player_color');
    if (savedName && nameInput) nameInput.value = savedName;
    if (savedColor && colorInput) colorInput.value = savedColor;
});

// Ukládání při každé změně (oninput)
nameInput?.addEventListener('input', () => localStorage.setItem('qc_player_name', nameInput.value));
colorInput?.addEventListener('input', () => localStorage.setItem('qc_player_color', colorInput.value));

function showScreen(screenName) {
    Object.values(screens).forEach(s => { if (s) s.style.display = 'none'; });
    if (screens[screenName]) {
        screens[screenName].style.display = (screenName === 'game') ? 'block' : 'flex';
    }
}

// --- AKCE V MENU ---
document.getElementById('btn-create-room')?.addEventListener('click', () => {
    socket.emit('createRoom', { 
        name: nameInput.value || 'Hráč', 
        color: colorInput.value, 
        cosmetics: 'none' 
    });
});

document.getElementById('btn-join-room')?.addEventListener('click', () => {
    const code = document.getElementById('room-code').value.toUpperCase();
    if (code) {
        socket.emit('joinRoom', { 
            roomId: code, 
            name: nameInput.value || 'Hráč', 
            color: colorInput.value 
        });
    } else {
        alert("Zadej kód místnosti!");
    }
});

document.getElementById('btn-ready')?.addEventListener('click', () => {
    socket.emit('playerReady');
});

// --- LOBBY EVENTY (Tady byla chyba) ---
socket.on('roomCreated', (data) => {
    const roomId = data.roomId || data.id; // Pojistka pro oba názvy
    document.getElementById('lobby-title').innerText = `MÍSTNOST: ${roomId}`;
    showScreen('lobby');
});

socket.on('roomJoined', (data) => {
    const roomId = data.roomId || data.id;
    document.getElementById('lobby-title').innerText = `MÍSTNOST: ${roomId}`;
    showScreen('lobby');
});

socket.on('updatePlayerList', (players) => {
    const listContainer = document.getElementById('player-list');
    if (!listContainer) return;

    listContainer.innerHTML = players.map(p => `
        <div style="background: rgba(255,255,255,0.1); padding: 10px 15px; border-left: 5px solid ${p.color}; display: flex; justify-content: space-between; border-radius: 5px;">
            <span style="color: white; font-weight: bold;">${p.name} ${p.id === socket.id ? '(TY)' : ''}</span>
            <span style="color: ${p.isReady ? '#2ecc71' : '#ff4757'};">${p.isReady ? '✔ READY' : '⏳ ČEKÁ'}</span>
        </div>
    `).join('');
});

// --- OSTATNÍ EVENTY ---
socket.on('errorMsg', (msg) => alert(msg));

socket.on('gameStateChanged', (data) => {
    if (data.state === 'PLAYING') {
        showScreen('game');
        initGameEngine();
    }
});

// HUD Update
socket.on('gameUpdate', (data) => {
    const me = data.players[socket.id];
    if (me) {
        document.getElementById('hud-ammo').innerText = `${me.ammo} / ${me.maxAmmo}`;
        document.getElementById('hud-hp').innerText = `${Math.round(me.hp)} / ${me.maxHp}`;
    }
});