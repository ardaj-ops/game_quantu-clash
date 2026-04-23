import { initGameEngine } from './game/main.js';
import { CONFIG } from './gameConfig.js';
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
        screens[screenName].style.display = (screenName === 'game') ? 'block' : 'flex';
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
    if (code) socket.emit('joinRoom', { roomId: code, name, color });
});

document.getElementById('btn-ready')?.addEventListener('click', () => {
    socket.emit('playerReady');
});

// --- SOCKET EVENTY: LOBBY ---
socket.on('roomCreated', (data) => {
    document.getElementById('lobby-title').innerText = `LOBBY: ${data.roomId}`;
    showScreen('lobby');
});

socket.on('roomJoined', (data) => {
    document.getElementById('lobby-title').innerText = `LOBBY: ${data.roomId}`;
    showScreen('lobby');
});

socket.on('updatePlayerList', (players) => {
    const list = document.getElementById('player-list');
    if (!list) return;
    list.innerHTML = players.map(p => `
        <li style="color: ${p.color}; margin-bottom: 10px;">
            ${p.name} ${p.isReady ? '✅' : '⏳'}
        </li>
    `).join('');
});

// --- SOCKET EVENTY: HRA ---
socket.on('gameStateChanged', (data) => {
    if (data.state === 'PLAYING') {
        showScreen('game');
        initGameEngine(); // Nastartuje herní engine a canvas
    } else if (data.state === 'LOBBY') {
        showScreen('lobby');
    } else if (data.state === 'GAMEOVER') {
        showScreen('gameover');
        const winnerText = document.getElementById('winner-text');
        if (winnerText && data.winner) {
            winnerText.innerText = `Vítěz: ${data.winner.name}`;
        }
    }
});

// --- SOCKET EVENTY: KARTY ---
socket.on('showCardSelection', (cards) => {
    showScreen('cards');
    const container = document.getElementById('card-container');
    if (!container) return;
    container.innerHTML = '';
    
    cards.forEach(card => {
        const div = document.createElement('div');
        div.style.background = '#1f2833';
        div.style.border = `2px solid ${card.rarity === 'legendary' ? 'gold' : '#45f3ff'}`;
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
            container.innerHTML = '<h2 style="color: white;">Karta vybrána! Čekám na ostatní...</h2>';
        });
        
        container.appendChild(div);
    });
});

// --- BLESKOVÝ UPDATE HUDu ---
const hudAmmo = document.getElementById('hud-ammo');
const hudHp = document.getElementById('hud-hp');

socket.on('gameUpdate', (data) => {
    if (data.players && data.players[socket.id]) {
        const me = data.players[socket.id];
        if (hudAmmo) hudAmmo.innerText = `${me.ammo} / ${me.maxAmmo || 10}`;
        if (hudHp) hudHp.innerText = `${Math.round(me.hp)} / ${me.maxHp || 100}`;
    }
});