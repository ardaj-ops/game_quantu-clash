// network.js
import { state } from './state.js';

const BACKEND_URL = "https://quantum-clash-backend.onrender.com";
export const socket = typeof io !== 'undefined' ? io(BACKEND_URL) : null;

if (!socket) {
    console.error("❌ Socket.IO není načten!");
} else {
    socket.on('connect', () => console.log('✅ ÚSPĚCH: Připojeno k serveru! Moje ID:', socket.id));
    socket.on('connect_error', (err) => console.error('❌ CHYBA: Nelze se spojit se serverem!', err));

    socket.on('gameState', (serverData) => { state.latestServerData = serverData; });
    socket.on('update', (serverData) => { state.latestServerData = serverData; });

    socket.on('mapUpdate', (data) => {
        if (data.obstacles) state.localObstacles = data.obstacles;
        if (data.breakables) state.localBreakables = data.breakables;
    });

    socket.on('initCatalog', (catalogData) => {
        state.CARD_CATALOG = catalogData;
        console.log("📚 Katalog karet načten!", catalogData);
    });
}