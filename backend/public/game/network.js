// app.js
import { initGameEngine } from './main.js';

// BUG FIX: app.js byl uploadnutý bez jakýchkoliv mezer (constsocket=io() apod.)
// — soubor by se vůbec nenačetl jako validní JavaScript. Opraveno formátování.

const socket = null;
window.gameSocket = socket;

const screens = {
    menu: document.getElementById('menu-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    cards: document.getElementById('card-screen'),
    gameover: document.getElementById('gameover-screen')
};

// --- LOCAL STORAGE (Ukládání nastavení) ---
const nameInput = document.getElementById('player-name');
const colorInput = document.getElementById('player-color');

window.addEventListener('load', () => {
    const savedName = localStorage.getItem('qc_player_name');
    const savedColor = localStorage.getItem('qc_player_color');
    if (savedName && nameInput) nameInput.value = savedName;
    if (savedColor && colorInput) colorInput.value = savedColor;
});

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
        alert('Zadej kód místnosti!');
    }
});

document.getElementById('btn-ready')?.addEventListener('click', () => {
    socket.emit('playerReady');
});

// --- LOBBY EVENTY ---
socket.on('roomCreated', (data) => {
    const roomId = data.roomId || data.id;
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

// BUG FIX: Odstraněn duplicitní socket.on('gameUpdate') listener pro HUD.
// HUD je aktualizován v main.js renderLoop přímo ze state.latestServerData
// (který je nastaven network.js). Trojitý update způsoboval závodní podmínky.

// --- KOPÍROVÁNÍ KÓDU MÍSTNOSTI ---
const lobbyTitle = document.getElementById('lobby-title');

if (lobbyTitle) {
    lobbyTitle.style.cursor = 'pointer';
    lobbyTitle.title = 'Kliknutím zkopíruješ kód místnosti';

    lobbyTitle.addEventListener('click', () => {
        const text = lobbyTitle.innerText;
        const code = text.replace('MÍSTNOST: ', '').trim();

        if (code && code !== '----' && !text.includes('Zkopírováno')) {
            navigator.clipboard.writeText(code).then(() => {
                const originalText = lobbyTitle.innerText;
                lobbyTitle.innerText = 'Zkopírováno! ✅';
                lobbyTitle.style.color = '#2ed573';
                setTimeout(() => {
                    lobbyTitle.innerText = originalText;
                    lobbyTitle.style.color = '#45f3ff';
                }, 1500);
            }).catch(err => {
                console.error('Nepodařilo se zkopírovat kód:', err);
            });
        }
    });
}