// game/network.js
import { io } from 'socket.io-client';
import { state } from './state.js';

// Automatická detekce prostředí (Lokálně vs. Produkce)
const BACKEND_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000" 
    : "https://quantum-clash-backend.onrender.com";

// Vytvoření spojení s extra parametry pro stabilitu
export const socket = io(BACKEND_URL, {
    reconnection: true,           // Automaticky se pokusí znovu připojit, pokud spadne net
    reconnectionAttempts: 10,     // Zkusí to až 10x, než to vzdá
    reconnectionDelay: 1000       // Mezi pokusy počká 1 vteřinu
});

if (!socket) {
    console.error("❌ Socket.IO se nepodařilo inicializovat! Zkontroluj instalaci (npm install socket.io-client).");
} else {
    // ==========================================
    // 1. ZÁKLADNÍ PŘIPOJENÍ
    // ==========================================
    socket.on('connect', () => {
        console.log('✅ HERNÍ ENGINE: Úspěšně připojeno k serveru! Moje ID:', socket.id);
    });

    socket.on('connect_error', (err) => {
        console.error('❌ HERNÍ ENGINE: Nelze se spojit se serverem! Běží backend?', err.message);
    });

    socket.on('disconnect', (reason) => {
        console.warn('⚠️ HERNÍ ENGINE: Odpojeno od serveru. Důvod:', reason);
    });

    // ==========================================
    // 2. KLÍČOVÁ HERNÍ DATA (Pro herní smyčku a render)
    // ==========================================
    
    // Server posílá event 'gameUpdate' každou vteřinu (např. 20x nebo 60x za vteřinu)
    socket.on('gameUpdate', (serverData) => { 
        // Průběžně aktualizujeme globální stav hry pro Vanilla JS engine (render.js a main.js)
        state.latestServerData = serverData; 
    });

    // Server pošle mapu hned, jak hra začne (nebo když se rozbije zeď/krabice)
    socket.on('mapUpdate', (data) => {
        if (data.obstacles) state.localObstacles = data.obstacles;
        if (data.breakables) state.localBreakables = data.breakables;
        
        const pocetZdi = data.obstacles ? data.obstacles.length : 0;
        const pocetKrabic = data.breakables ? data.breakables.length : 0;
        console.log(`🗺️ MAPA AKTUALIZOVÁNA! Zdi: ${pocetZdi}, Zničitelné bloky: ${pocetKrabic}`);
    });

    // ==========================================
    // 3. DIAGNOSTIKA STAVŮ (Pro snazší debugování)
    // ==========================================
    socket.on('gameStateChanged', (data) => {
        console.log(`🔄 ENGINE: Server hlásí změnu stavu hry na [${data.state}]`);
        // O samotné překreslení vizuálu a zobrazení správných menu se stará React (App.jsx)
    });

    socket.on('showCards', (cards) => {
        console.log(`🃏 ENGINE: Server poslal karty pro výběr (${cards.length} karet). React by měl ukázat overlay s výběrem.`);
    });

    // ==========================================
    // 4. OSTATNÍ DATA (Karty a katalogy)
    // ==========================================
    socket.on('initCatalog', (catalogData) => {
        state.CARD_CATALOG = catalogData;
        console.log("📚 ENGINE: Katalog karet načten. Počet položek:", Object.keys(catalogData || {}).length);
    });
}