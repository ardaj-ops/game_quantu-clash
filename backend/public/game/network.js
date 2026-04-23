import { state } from './state.js';

// Vytvoříme prázdnou proměnnou, kterou naplníme až při startu hry
export let socket = null;

// Tuto funkci zavoláme z main.js až ve chvíli, kdy je socket připravený
export function initNetwork() {
    socket = window.gameSocket;

    if (!socket) {
        console.error("❌ window.gameSocket chybí! Zkontroluj, že v app.js je 'window.gameSocket = socket;' PŘED voláním initGameEngine().");
        return;
    }

    console.log('✅ HERNÍ ENGINE sdílený socket ID:', socket.id);

    const onGameUpdate = (d) => { state.latestServerData = d; };
    socket.on('gameUpdate', onGameUpdate);
    socket.on('gameState', onGameUpdate);
    socket.on('update', onGameUpdate);

    socket.on('mapUpdate', (data) => {
        if (data.obstacles) state.localObstacles = data.obstacles;
        if (data.breakables) state.localBreakables = data.breakables;
        console.log(`🗺️ mapUpdate: ${data.obstacles?.length||0} zdí, ${data.breakables?.length||0} bloků`);
    });

    // OPRAVA PŘEKÁŽEK: Chytáme mapu ihned po startu kola, nečekáme jen na mapUpdate
    socket.on('gameStateChanged', (data) => {
        console.log(`🔄 ENGINE stav: [${data.state}]`);
        
        if (data.obstacles && data.obstacles.length > 0) { 
            state.localObstacles = data.obstacles; 
        }
        if (data.breakables && data.breakables.length > 0) { 
            state.localBreakables = data.breakables; 
        }
        
        if (data.state === 'LOBBY' || data.state === 'GAMEOVER') {
            state.latestServerData = null;
            state.localBullets = [];
            state.remoteBullets = [];
        }
    });

    socket.on('enemyShot', (bulletsData) => {
        if (!bulletsData) return;
        if (!state.remoteBullets) state.remoteBullets = [];
        const arr = Array.isArray(bulletsData) ? bulletsData : [bulletsData];
        arr.forEach(b => { if (b) state.remoteBullets.push({ ...b, createdAt: Date.now() }); });
    });

    socket.on('playerDamaged', (data) => {
        // Volitelné: Hit markery
    });
    
    socket.on('enemyDecoySpawned', (decoyData) => {
        // Volitelné: Spawn decoyů
    });
    
    socket.on('gravityChanged', (gravityName) => {
        console.log(`🌌 Gravitace změněna na: ${gravityName}`);
    });
}