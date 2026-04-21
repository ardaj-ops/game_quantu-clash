// game/network.js
import { state } from './state.js';
import { CONFIG } from './gameConfig.js';

// KRITICKÁ OPRAVA: Používáme SDÍLENÝ socket z App.jsx (window.gameSocket).
// Původní kód dělal io(BACKEND_URL) = nové spojení = server viděl engine
// jako jiného hráče, enemyShot chodil na špatnou instanci atd.
export const socket = window.gameSocket;

if (!socket) {
    console.error("❌ HERNÍ ENGINE: window.gameSocket není dostupný!");
} else {
    console.log('✅ HERNÍ ENGINE: Sdílený socket nalezen. ID:', socket.id);

    // Herní stav (polohy hráčů, HP, skóre...)
    const updateGameState = (serverData) => { state.latestServerData = serverData; };
    socket.on('gameUpdate', updateGameState);
    socket.on('gameState', updateGameState);
    socket.on('update', updateGameState);

    // Mapa — přijímáme z mapUpdate i z gameStateChanged (viz server.js fix)
    socket.on('mapUpdate', (data) => {
        if (data.obstacles) state.localObstacles = data.obstacles;
        if (data.breakables) state.localBreakables = data.breakables;
        console.log(`🗺️ Mapa: ${data.obstacles?.length || 0} zdí, ${data.breakables?.length || 0} bloků`);
    });

    socket.on('gameStateChanged', (data) => {
        console.log(`🔄 ENGINE: Stav -> [${data.state}]`);
        // OPRAVA: Mapa je teď součástí gameStateChanged payloadu
        if (data.obstacles) state.localObstacles = data.obstacles;
        if (data.breakables) state.localBreakables = data.breakables;
        // Reset střel při návratu do lobby
        if (data.state === 'LOBBY' || data.state === 'GAMEOVER') {
            state.latestServerData = null;
            state.localBullets = [];
            state.remoteBullets = [];
        }
    });

    // OPRAVA: enemyShot listener ÚPLNĚ CHYBĚL.
    // Střely ostatních hráčů se proto nikdy nekreslily — vidět byly jen vlastní.
    socket.on('enemyShot', (bulletsData) => {
        if (!bulletsData) return;
        const bullets = Array.isArray(bulletsData) ? bulletsData : [bulletsData];
        bullets.forEach(b => {
            if (b) state.remoteBullets.push({ ...b, createdAt: Date.now() });
        });
    });

    socket.on('showCards', (cards) => {
        console.log(`🃏 ENGINE: Karty přijaty (${cards?.length || 0}).`);
    });

    socket.on('initCatalog', (catalogData) => {
        state.CARD_CATALOG = catalogData;
    });
}

// Odesílání vstupů
export function sendInputsToServer() {
    if (!socket || !state.playerInputs) return;
    socket.emit('playerInput', state.playerInputs);
}

export function joinGame(playerName) {
    if (!socket) return;
    socket.emit('joinGame', { name: playerName || "Hráč_" + Math.floor(Math.random() * 1000) });
}

// OPRAVA: selectUpgradeCard nyní emituje 'pickCard' s indexem (server očekává pickCard)
export function selectUpgradeCard(cardIndex) {
    if (!socket) return;
    socket.emit('pickCard', cardIndex);
    console.log(`🃏 Volba karty: index ${cardIndex}`);
}