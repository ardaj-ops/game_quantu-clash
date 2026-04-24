import { state } from './state.js';

export let socket = null;

export function initNetwork() {
    socket = window.gameSocket;

    if (!socket) {
        console.error("❌ window.gameSocket chybí! Zkontroluj, že v app.js je 'window.gameSocket = socket;' PŘED voláním initGameEngine().");
        return;
    }

    console.log('✅ HERNÍ ENGINE sdílený socket ID:', socket.id);

    const onGameUpdate = (d) => { 
        // --- ANTI-GLITCH A ANTI-RUBBERBANDING SYSTÉM ---
        if (state.latestServerData && state.latestServerData.players && d.players && socket) {
            const myId = socket.id;
            const localMe = state.latestServerData.players[myId];
            const serverMe = d.players[myId];

            if (localMe && serverMe) {
                // 1. ZÁCHRANA POZICE (Hladký pohyb)
                const dist = Math.hypot(localMe.x - serverMe.x, localMe.y - serverMe.y);
                if (dist < 150) { // Věříme prohlížeči, pokud to není teleport (např. respawn)
                    serverMe.x = localMe.x;
                    serverMe.y = localMe.y;
                    serverMe.aimAngle = localMe.aimAngle;
                }

                // 2. ZÁCHRANA NÁBOJŮ (Zabrání blikání a zasekávání zásobníků)
                if (localMe.ammo < serverMe.ammo && !localMe.isReloading && !serverMe.isReloading) {
                    serverMe.ammo = localMe.ammo;
                }
                
                // Zachováme lokální zprávu o přebíjení
                if (localMe.isReloading && localMe.ammo === 0) {
                    serverMe.isReloading = true;
                }
            }
        }
        state.latestServerData = d; 
    };

    socket.on('gameUpdate', onGameUpdate);
    socket.on('gameState', onGameUpdate);
    socket.on('update', onGameUpdate);

    socket.on('mapUpdate', (data) => {
        if (data.obstacles) state.localObstacles = data.obstacles;
        if (data.breakables) state.localBreakables = data.breakables;
        console.log(`🗺️ mapUpdate: ${data.obstacles?.length||0} zdí, ${data.breakables?.length||0} bloků`);
    });

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

    socket.on('playerDamaged', (data) => {});
    socket.on('enemyDecoySpawned', (decoyData) => {});
    socket.on('gravityChanged', (gravityName) => {});
}