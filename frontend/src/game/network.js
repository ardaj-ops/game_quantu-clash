// game/network.js
import { state } from './state.js';

// ==========================================
// KRITICKÁ OPRAVA: Používáme window.gameSocket (sdílený socket z App.jsx).
//
// Původní kód dělal: io(BACKEND_URL) = NOVÉ spojení.
// Tento nový socket NENÍ v herní místnosti (room) — server posílá
// mapUpdate/gameStateChanged jen hráčům v místnosti.
// Výsledek: engine nikdy nedostal překážky → prázdná mapa.
// ==========================================
export const socket = window.gameSocket;

if (!socket) {
    console.error("❌ window.gameSocket chybí! App.jsx ho musí nastavit před initGameEngine().");
} else {
    console.log('✅ HERNÍ ENGINE sdílený socket ID:', socket.id);

    // Herní stav (polohy hráčů, HP, skóre)
    const onGameUpdate = (d) => { state.latestServerData = d; };
    socket.on('gameUpdate', onGameUpdate);
    socket.on('gameState', onGameUpdate);
    socket.on('update', onGameUpdate);

    // Mapa překážek
    socket.on('mapUpdate', (data) => {
        if (data.obstacles) state.localObstacles = data.obstacles;
        if (data.breakables) state.localBreakables = data.breakables;
        console.log(`🗺️ mapUpdate: ${data.obstacles?.length||0} zdí, ${data.breakables?.length||0} bloků`);
    });

    // gameStateChanged — záloha pro data mapy (engine se načítá async, může přijít před mapUpdate listenerem)
    socket.on('gameStateChanged', (data) => {
        console.log(`🔄 ENGINE stav: [${data.state}]`);
        if (data.obstacles) { state.localObstacles = data.obstacles; }
        if (data.breakables) { state.localBreakables = data.breakables; }
        if (data.state === 'LOBBY' || data.state === 'GAMEOVER') {
            state.latestServerData = null;
            state.localBullets = [];
            state.remoteBullets = [];
        }
    });

    // Střely ostatních hráčů
    socket.on('enemyShot', (bulletsData) => {
        if (!bulletsData) return;
        if (!state.remoteBullets) state.remoteBullets = [];
        const arr = Array.isArray(bulletsData) ? bulletsData : [bulletsData];
        arr.forEach(b => { if (b) state.remoteBullets.push({ ...b, createdAt: Date.now() }); });
    });

    socket.on('initCatalog', (catalog) => {
        state.CARD_CATALOG = catalog;
    });
}

export function selectUpgradeCard(cardIndex) {
    if (!socket) return;
    socket.emit('pickCard', cardIndex);
}