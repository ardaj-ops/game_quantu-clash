// public/app.js
import { initGameEngine } from './game/main.js';

// Inicializace socketu
const socket = io();
window.gameSocket = socket;

// --- ODKAZY NA HTML ELEMENTY ---
const screens = {
    menu: document.getElementById('menu-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    cards: document.getElementById('card-screen'),
    gameover: document.getElementById('gameover-screen')
};

// Funkce pro přepínání obrazovek
function showScreen(screenName) {
    Object.values(screens).forEach(s => {
        if (s) s.style.display = 'none';
    });
    if (screens[screenName]) {
        screens[screenName].style.display = 'flex'; // Overlay používá flex pro centrování
        if (screenName === 'game') screens.game.style.display = 'block';
    }
}

// --- MENU LOGIKA ---
document.getElementById('btn-create-room')?.addEventListener('click', () => {
    const name = document.getElementById('player-name').value || 'Hráč';
    const color = document.getElementById('player-color').value || '#45f3ff';
    socket.emit('createRoom', { name, color, cosmetics: 'none' });
});

document.getElementById('btn-join-room')?.addEventListener('click', () => {
    const name = document.getElementById('player-name').value || 'Hráč';
    const color = document.getElementById('player-color').value || '#45f3ff';
    const code = document.getElementById('room-code').value.toUpperCase();
    if (code) socket.emit('joinRoom', { name, color, cosmetics: 'none', code });
});

// --- LOBBY LOGIKA ---
let isReady = false;
document.getElementById('btn-ready')?.addEventListener('click', () => {
    isReady = !isReady;
    socket.emit('toggleReady', isReady);
    const btn = document.getElementById('btn-ready');
    btn.innerText = isReady ? 'ZRUŠIT PŘIPRAVENOST' : 'PŘIPRAVIT SE';
    btn.style.background = isReady ? '#ff2a7a' : '#45f3ff';
});

// --- SOCKET EVENTY ---
socket.on('roomCreated', (data) => {
    document.getElementById('lobby-room-id').innerText = data.code;
    showScreen('lobby');
});

socket.on('roomJoined', (data) => {
    document.getElementById('lobby-room-id').innerText = data.code;
    showScreen('lobby');
});

socket.on('lobbyUpdated', (data) => {
    const list = document.getElementById('player-list');
    if (!list) return;
    list.innerHTML = '';
    for (const id in data.players) {
        const p = data.players[id];
        const li = document.createElement('li');
        li.style.color = p.color;
        li.style.fontSize = '1.2rem';
        li.style.marginBottom = '10px';
        li.innerText = `${p.isHost ? '👑' : ''} ${p.name} - ${p.isReady ? '✅ Připraven' : '⏳ Čeká'}`;
        list.appendChild(li);
    }
});

// --- HLAVNÍ PŘEPÍNAČ STAVU HRY ---
socket.on('gameStateChanged', (data) => {
    if (data.state === 'PLAYING') {
        showScreen('game');
        initGameEngine(); // Zapne herní smyčku v main.js
    } else if (data.state === 'UPGRADE') {
        showScreen('cards');
        if (data.loserId !== socket.id) {
            document.getElementById('card-container').innerHTML = '<h2 style="color: white;">Kolo skončilo! Čekej, než si poražený vybere kartu...</h2>';
        }
    } else if (data.state === 'LOBBY') {
        isReady = false;
        const btn = document.getElementById('btn-ready');
        if (btn) {
            btn.innerText = 'PŘIPRAVIT SE';
            btn.style.background = '#45f3ff';
        }
        showScreen('lobby');
    } else if (data.state === 'GAMEOVER') {
        showScreen('gameover');
        document.getElementById('winner-name').innerText = data.winnerName;
    }
});

// --- VYKRESLENÍ KARET ---
socket.on('showCards', (cards) => {
    const container = document.getElementById('card-container');
    if (!container) return;
    container.innerHTML = '';
    
    cards.forEach(card => {
        const div = document.createElement('div');
        div.style.background = '#1f2833';
        div.style.border = '2px solid #45f3ff';
        div.style.padding = '20px';
        div.style.borderRadius = '10px';
        div.style.cursor = 'pointer';
        div.style.width = '200px';
        div.style.color = 'white';
        
        div.innerHTML = `
            <h3 style="margin-top: 0;">${card.name}</h3>
            <p style="color: #aaa; font-size: 0.9rem;">${card.description || card.desc || ''}</p>
        `;
        
        div.addEventListener('click', () => {
            socket.emit('selectCard', card.name);
            container.innerHTML = '<h2 style="color: white;">Karta vybrána! Startuji další kolo...</h2>';
        });
        
        container.appendChild(div);
    });
});

// --- BLESKOVÝ UPDATE HUDu (Přímo z Vanilla JS, bez lagů!) ---
const hudAmmo = document.getElementById('hud-ammo');
const hudHp = document.getElementById('hud-hp');

socket.on('gameUpdate', (data) => {
    if (data.players && data.players[socket.id]) {
        const me = data.players[socket.id];
        if (hudAmmo) hudAmmo.innerText = `${me.ammo} / ${me.maxAmmo}`;
        if (hudHp) hudHp.innerText = `${me.hp} / ${me.maxHp}`;
    }
});

// Tlačítko zpět do menu
document.getElementById('btn-menu-back')?.addEventListener('click', () => {
    socket.emit('leaveRoom');
    showScreen('menu');
});