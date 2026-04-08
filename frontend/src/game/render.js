// game/render.js
import { state, CONFIG } from './state.js';
import { socket } from './network.js';

const TWO_PI = Math.PI * 2;

// --- POMOCNÉ VYKRESLOVACÍ FUNKCE ---

function drawGrid(mapW, mapH) {
    if (!state.ctx) return;
    state.ctx.strokeStyle = '#222222';
    state.ctx.lineWidth = 2;
    const gridSize = 50;
    
    for (let x = 0; x <= mapW; x += gridSize) {
        state.ctx.beginPath(); state.ctx.moveTo(x, 0); state.ctx.lineTo(x, mapH); state.ctx.stroke();
    }
    for (let y = 0; y <= mapH; y += gridSize) {
        state.ctx.beginPath(); state.ctx.moveTo(0, y); state.ctx.lineTo(mapW, y); state.ctx.stroke();
    }
}

function drawBackground(mapW, mapH) {
    if (!state.ctx) return;
    // Pozadí mapy
    state.ctx.fillStyle = '#111111';
    state.ctx.fillRect(0, 0, mapW, mapH);
    
    drawGrid(mapW, mapH);
    
    // Hranice mapy
    state.ctx.strokeStyle = '#ff0000';
    state.ctx.lineWidth = 5;
    state.ctx.strokeRect(0, 0, mapW, mapH);
}

function drawMapObjects(obstacles = [], breakables = []) {
    if (!state.ctx) return;
    
    const safeObstacles = Array.isArray(obstacles) ? obstacles : [];
    const safeBreakables = Array.isArray(breakables) ? breakables : [];

    // Vykreslení překážek (zdí)
    state.ctx.fillStyle = '#555555';
    safeObstacles.forEach(obs => {
        state.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    });

    // Vykreslení zničitelných objektů (krabice)
    state.ctx.fillStyle = '#8B4513';
    safeBreakables.forEach(brk => {
        if (brk.hp > 0) state.ctx.fillRect(brk.x, brk.y, brk.width, brk.height);
    });
}

function drawDomains(playersData) {}
function drawDecoys(decoys = [], playersData) {}

function drawPlayers(playersData) {
    if (!state.ctx || !playersData) return;
    
    for (const id in playersData) {
        const p = playersData[id];
        if (!p || p.hp <= 0) continue; // Mrtvé nekreslíme

        state.ctx.save();
        const px = p.x || 0;
        const py = p.y || 0;
        state.ctx.translate(px, py);
        
        // Jméno hráče
        state.ctx.fillStyle = (socket && id === socket.id) ? '#00ff00' : '#ffffff';
        state.ctx.font = '14px Arial';
        state.ctx.textAlign = 'center';
        state.ctx.fillText(p.name || "Hráč", 0, -35);

        // Healthbar
        const maxHp = p.maxHp || 100;
        const hpPercent = (p.hp || 0) / maxHp;
        state.ctx.fillStyle = '#ff0000';
        state.ctx.fillRect(-20, -25, 40, 5);
        state.ctx.fillStyle = '#00ff00';
        state.ctx.fillRect(-20, -25, 40 * Math.max(0, Math.min(1, hpPercent)), 5); 

        state.ctx.rotate(p.angle || 0);
        drawAvatar(p);
        state.ctx.restore();
    }
}

function drawAvatar(p) {
    if (!state.ctx) return;
    // Tělo
    state.ctx.fillStyle = p.color || '#3498db';
    state.ctx.beginPath();
    state.ctx.arc(0, 0, 15, 0, TWO_PI);
    state.ctx.fill();
    state.ctx.stroke();

    // Zbraň (hlaveň)
    state.ctx.fillStyle = '#7f8c8d';
    state.ctx.fillRect(0, -4, 25, 8);
}

function drawBullets(bullets = []) {
    if (!state.ctx) return;
    const safeBullets = Array.isArray(bullets) ? bullets : [];
    
    state.ctx.fillStyle = '#f1c40f'; // Žluté kulky
    safeBullets.forEach(b => {
        if (b.x === undefined || b.y === undefined) return;
        state.ctx.beginPath();
        state.ctx.arc(b.x, b.y, 4, 0, TWO_PI);
        state.ctx.fill();
    });
}

function drawCrosshair() {
    if (!state.ctx || state.currentMouseX === undefined || state.currentMouseY === undefined) return;
    
    const config = state.crosshairConfig || { color: '#00ff00', size: 10, shape: 'cross' };
    const { currentMouseX: x, currentMouseY: y } = state;

    state.ctx.save();
    state.ctx.strokeStyle = config.color || '#00ff00';
    state.ctx.lineWidth = 2;

    if (config.shape === 'cross' || !config.shape) {
        state.ctx.beginPath();
        state.ctx.moveTo(x - config.size, y); state.ctx.lineTo(x + config.size, y);
        state.ctx.moveTo(x, y - config.size); state.ctx.lineTo(x, y + config.size);
        state.ctx.stroke();
    } else if (config.shape === 'circle') {
        state.ctx.beginPath();
        state.ctx.arc(x, y, config.size, 0, TWO_PI);
        state.ctx.stroke();
    }
    state.ctx.restore();
}

function drawTabMenu(playersData) {
    if (!state.ctx || !state.canvas) return;
    state.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    state.ctx.fillRect(state.canvas.width/2 - 150, state.canvas.height/2 - 200, 300, 400);
    state.ctx.fillStyle = "white";
    state.ctx.font = "20px Arial";
    state.ctx.textAlign = "center";
    state.ctx.fillText("SKÓRE", state.canvas.width/2, state.canvas.height/2 - 160);
}

function updateDOM_HUD(player) {
    const hpEl = document.getElementById('hpDisplay');
    const ammoEl = document.getElementById('ammoDisplay');
    if (hpEl) hpEl.innerText = `HP: ${player.hp}`;
    if (ammoEl) ammoEl.innerText = `AMMO: ${player.ammo || 0}`;
}

// --- HLAVNÍ FUNKCE ---

export function drawGame(serverData) {
    if (!state.canvas) state.canvas = document.getElementById('game');
    if (state.canvas && !state.ctx) state.ctx = state.canvas.getContext('2d');
    if (!state.canvas || !state.ctx) return; 

    const safeData = serverData || {};
    const playersData = safeData.leanPlayers || safeData.players || {};
    const gameState = safeData.gameState || 'PLAYING';

    state.canvas.style.cursor = (gameState === 'PLAYING') ? 'none' : 'default';

    if (state.canvas.width !== window.innerWidth || state.canvas.height !== window.innerHeight) {
        state.canvas.width = window.innerWidth;
        state.canvas.height = window.innerHeight;
    }
    
    // Černé pozadí mimo mapu (Zároveň vyčistí předchozí frame)
    state.ctx.fillStyle = '#000000';
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    const mapW = (CONFIG && CONFIG.MAP_W) ? CONFIG.MAP_W : 2000;
    const mapH = (CONFIG && CONFIG.MAP_H) ? CONFIG.MAP_H : 2000;

    // --- NOVÁ KAMERA: ZOOM A SLEDOVÁNÍ HRÁČE ---
    const ZOOM = 1.2; // Tady můžeš upravit, jak moc chceš mít hru zvětšenou (např. 1.5, 2.0)
    state.gameScale = ZOOM;

    // Najdeme našeho hráče
    let me = null;
    if (socket && socket.id) {
        me = playersData[socket.id];
    }

    if (me) {
        // Pokud žijeme, chceme mít vlastní postavičku PŘESNĚ uprostřed obrazovky
        state.gameOffsetX = (state.canvas.width / 2) - (me.x * state.gameScale);
        state.gameOffsetY = (state.canvas.height / 2) - (me.y * state.gameScale);
    } else {
        // Pokud umřeme nebo čekáme, zíráme doprostřed mapy
        state.gameOffsetX = (state.canvas.width / 2) - ((mapW / 2) * state.gameScale);
        state.gameOffsetY = (state.canvas.height / 2) - ((mapH / 2) * state.gameScale);
    }

    state.ctx.save();
    // Aplikování kamery (posun + přiblížení)
    state.ctx.translate(state.gameOffsetX, state.gameOffsetY);
    state.ctx.scale(state.gameScale, state.gameScale);

    // Vykreslení herního světa
    drawBackground(mapW, mapH); 
    drawMapObjects(state.localObstacles || [], state.localBreakables || []);

    if (gameState !== 'LOBBY') {
        drawDomains(playersData);
        if (safeData.decoys) drawDecoys(safeData.decoys, playersData);
        drawPlayers(playersData);
        drawBullets(safeData.bullets || []);
        
        if (me) updateDOM_HUD(me);
    }
    
    state.ctx.restore(); // Konec transformací kamery, dál už kreslíme jen statické UI

    // UI přes mapu (nezávislé na kameře - drží se na monitoru)
    if (gameState === 'PLAYING') {
        const isTabPressed = state.playerInputs && state.playerInputs.tab;
        if (!isTabPressed) {
            drawCrosshair(); 
        } else {
            drawTabMenu(playersData);
        }
    }

    if (gameState === 'SCOREBOARD') {
        state.ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
        state.ctx.fillStyle = "white";
        state.ctx.font = "bold 50px Arial";
        state.ctx.textAlign = "center";
        state.ctx.fillText("KOLO SKONČILO", state.canvas.width / 2, state.canvas.height / 2);
    } 
}