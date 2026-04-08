/// network.js
import { io } from 'socket.io-client';
import { state } from './state.js';

const BACKEND_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000" 
    : "https://quantum-clash-backend.onrender.com";

export const socket = io(BACKEND_URL);

if (!socket) {
    console.error("❌ Socket.IO není načten! Zkontroluj instalaci.");
} else {
    // ==========================================
    // 1. ZÁKLADNÍ PŘIPOJENÍ
    // ==========================================
    socket.on('connect', () => {
        console.log('✅ ÚSPĚCH: Připojeno k serveru! Moje ID:', socket.id);
        // Testovací bypass odstraněn: Už se tu automaticky nevytváří hra!
    });

    socket.on('connect_error', (err) => {
        console.error('❌ CHYBA: Nelze se spojit se serverem! Běží backend?', err);
    });

    socket.on('roomCreated', (data) => {
        console.log(`✅ Místnost vytvořena (Kód: ${data.code}). Řízení přebírá React UI.`);
        // Testovací bypass odstraněn: Už tu nestřílíme automaticky toggleReady.
    });

    // ==========================================
    // 2. KLÍČOVÁ HERNÍ DATA (Pro tvůj render.js)
    // ==========================================
    
    // Server posílá event 'gameUpdate' každou vteřinu 20x (Tvůj TICK_RATE v server.js)
    socket.on('gameUpdate', (serverData) => { 
        state.latestServerData = serverData; 
    });

    // Server pošle mapu hned, jak hra začne (nebo když se rozbije zeď)
    socket.on('mapUpdate', (data) => {
        if (data.obstacles) state.localObstacles = data.obstacles;
        if (data.breakables) state.localBreakables = data.breakables;
        
        // Diagnostický log: Zjistíme, jestli server posílá reálné bloky nebo prázdno
        const pocetZdi = data.obstacles ? data.obstacles.length : 0;
        const pocetKrabic = data.breakables ? data.breakables.length : 0;
        console.log(`🗺️ MAPA PŘIJATA! Počet zdí: ${pocetZdi}, Počet krabic: ${pocetKrabic}`);
    });

    // Změny stavů hry (přepnutí z LOBBY do PLAYING, GAMEOVER atd.)
    socket.on('gameStateChanged', (data) => {
        console.log("🔄 Vanilla JS zaznamenal změnu stavu hry na:", data.state);
        // O překreslení UI se teď stará React v App.jsx
    });

    // ==========================================
    // 3. OSTATNÍ DATA (Karty a katalogy)
    // ==========================================
    socket.on('initCatalog', (catalogData) => {
        state.CARD_CATALOG = catalogData;
        console.log("📚 Katalog karet načten:", Object.keys(catalogData || {}).length, "položek.");
    });
}