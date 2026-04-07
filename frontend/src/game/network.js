// network.js
import { state } from './state.js';

// Automatické přepínání: Pokud jsi u sebe na PC, použije localhost. Jinak použije produkční Render server.
const BACKEND_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000" 
    : "https://quantum-clash-backend.onrender.com";

export const socket = typeof io !== 'undefined' ? io(BACKEND_URL) : null;

if (!socket) {
    console.error("❌ Socket.IO není načten! Zkontroluj, jestli máš v index.html správný script tag.");
} else {
    // ==========================================
    // 1. ZÁKLADNÍ PŘIPOJENÍ A TESTOVACÍ ZKRATKA
    // ==========================================
    socket.on('connect', () => {
        console.log('✅ ÚSPĚCH: Připojeno k serveru! Moje ID:', socket.id);
        
        // PRO TESTOVÁNÍ MAPY: Okamžitě po připojení vytvoříme místnost
        console.log("🛠️ Vytvářím testovací místnost...");
        socket.emit('createRoom', { name: "Tester", color: "#3498db", cosmetic: "none" });
    });

    socket.on('connect_error', (err) => {
        console.error('❌ CHYBA: Nelze se spojit se serverem! Běží backend?', err);
    });

    // Jakmile server potvrdí, že je místnost vytvořena, odpálíme "Ready" a hra začne
    socket.on('roomCreated', (data) => {
        console.log(`✅ Místnost vytvořena (Kód: ${data.code}). Přepínám na READY!`);
        socket.emit('toggleReady', true); 
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
        console.log("🗺️ Herní mapa úspěšně načtena a uložena do state!");
    });

    // Změny stavů hry (přepnutí z LOBBY do PLAYING, GAMEOVER atd.)
    socket.on('gameStateChanged', (data) => {
        console.log("🔄 Změna stavu hry na:", data.state);
        // Sem budeme později dávat schovávání/ukazování HTML UI
    });

    // ==========================================
    // 3. OSTATNÍ DATA (Karty a katalogy)
    // ==========================================
    socket.on('initCatalog', (catalogData) => {
        state.CARD_CATALOG = catalogData;
        console.log("📚 Katalog karet načten:", catalogData);
    });
}