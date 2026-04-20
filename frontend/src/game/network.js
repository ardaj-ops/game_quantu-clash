// game/network.js
import { state } from './state.js';
import { CONFIG } from './gameConfig.js';

export const socket = window.gameSocket;

if (!socket) {
    console.error("❌ HERNÍ ENGINE: window.gameSocket není dostupný! Ujisti se, že App.jsx ho nastaví před voláním initGameEngine().");
} else {
    console.log('✅ HERNÍ ENGINE: Sdílený socket nalezen. ID:', socket.id);

    // ==========================================
    // KLÍČOVÁ HERNÍ DATA (Pro herní smyčku a render)
    // ==========================================
    const updateGameState = (serverData) => { state.latestServerData = serverData; };
    socket.on('gameUpdate', updateGameState);
    socket.on('gameState', updateGameState);
    socket.on('update', updateGameState);

    socket.on('mapUpdate', (data) => {
        if (data.obstacles) state.localObstacles = data.obstacles;
        if (data.breakables) state.localBreakables = data.breakables;
        console.log(`🗺️ Mapa aktualizována. Zdi: ${data.obstacles?.length || 0}, Bloky: ${data.breakables?.length || 0}`);
    });

    socket.on('gameStateChanged', (data) => {
        console.log(`🔄 ENGINE: Stav hry změněn na [${data.state}]`);
        // Pokud se vrátíme do lobby, vymažeme herní data
        if (data.state === 'LOBBY') {
            state.latestServerData = null;
            state.localBullets = [];
        }
    });

    socket.on('showCards', (cards) => {
        console.log(`🃏 ENGINE: Karty pro výběr (${cards.length} karet).`);
    });

    socket.on('initCatalog', (catalogData) => {
        state.CARD_CATALOG = catalogData;
        console.log("📚 ENGINE: Katalog karet načten:", Object.keys(catalogData || {}).length, "položek");
    });
}

// ==========================================
// ODESÍLÁNÍ DAT NA SERVER
// ==========================================
export function sendInputsToServer() {
    if (!socket || !state.playerInputs) return;
    socket.emit('playerInput', state.playerInputs);
}

export function joinGame(playerName) {
    if (!socket) return;
    const finalName = playerName || "Hráč_" + Math.floor(Math.random() * 1000);
    socket.emit('joinGame', { name: finalName });
}

export function selectUpgradeCard(cardId) {
    if (!socket) return;
    socket.emit('selectCard', { cardId });
}