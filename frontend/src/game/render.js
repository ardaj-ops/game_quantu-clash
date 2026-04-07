// render.js
import { state, CONFIG } from './state.js';
import { socket } from './network.js';

const TWO_PI = Math.PI * 2;

// --- POMOCNÉ VYKRESLOVACÍ FUNKCE ---

function drawGrid() {
    state.ctx.strokeStyle = '#222222';
    state.ctx.lineWidth = 2;
    const gridSize = 50;
    
    for (let x = 0; x <= CONFIG.MAP_W; x += gridSize) {
        state.ctx.beginPath(); state.ctx.moveTo(x, 0); state.ctx.lineTo(x, CONFIG.MAP_H); state.ctx.stroke();
    }
    for (let y = 0; y <= CONFIG.MAP_H; y += gridSize) {
        state.ctx.beginPath(); state.ctx.moveTo(0, y); state.ctx.lineTo(CONFIG.MAP_W, y); state.ctx.stroke();
    }
}

function drawBackground(playersData) {
    // Pozadí mapy
    state.ctx.fillStyle = '#111111';
    state.ctx.fillRect(0, 0, CONFIG.MAP_W, CONFIG.MAP_H);
    drawGrid();
    
    // Hranice mapy
    state.ctx.strokeStyle = '#ff0000';
    state.ctx.lineWidth = 5;
    state.ctx.strokeRect(0, 0, CONFIG.MAP_W, CONFIG.MAP_H);
}

function drawMapObjects(obstacles = [], breakables = []) {
    // Vykreslení překážek (zdí)
    state.ctx.fillStyle = '#555555';
    obstacles.forEach(obs => {
        state.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    });

    // Vykreslení zničitelných objektů (krabice)
    state.ctx.fillStyle = '#8B4513';
    breakables.forEach(brk => {
        if (brk.hp > 0) state.ctx.fillRect(brk.x, brk.y, brk.width, brk.height);
    });
}

function drawDomains(playersData) {
    // Pokud hra používá nějaké zóny/teritoria
}

function drawDecoys(decoys, playersData) {
    // Vykreslení falešných cílů (pokud existují)
}

function drawPlayers(playersData) {
    for (const id in playersData) {
        const p = playersData[id];
        if (p.hp <= 0) continue; // Mrtvé nekreslíme

        state.ctx.save();
        state.ctx.translate(p.x, p.y);
        
        // Jméno hráče
        state.ctx.fillStyle = (socket && id === socket.id) ? '#00ff00' : '#ffffff';
        state.ctx.font = '14px Arial';
        state.ctx.textAlign = 'center';
        state.ctx.fillText(p.name || "Hráč", 0, -35);

        // Healthbar (Zdraví)
        const hpPercent = p.hp / (p.maxHp || 100);
        state.ctx.fillStyle = '#ff0000';
        state.ctx.fillRect(-20, -25, 40, 5);
        state.ctx.fillStyle = '#00ff00';
        state.ctx.fillRect(-20, -25, 40 * hpPercent, 5);

        // Rotace hráče podle toho, kam míří
        state.ctx.rotate(p.angle || 0);

        // Samotný avatar (Tělo a zbraň)
        drawAvatar(p);

        state.ctx.restore();
    }
}

function drawAvatar(p) {
    // Tělo
    state.ctx.fillStyle = p.color || '#3498db';
    state.ctx.beginPath();
    state.ctx.arc(0, 0, 15, 0, TWO_PI);
    state.ctx.fill();
    state.ctx.stroke();

    // Zbraň (hlaveň)
    state.ctx.fillStyle = '#7f8c8d';
    state.ctx.fillRect(0, -4, 25, 8);
    
    drawCosmetics(p);
}

function drawCosmetics(p) {
    // Klobouky, brýle atd., pokud je hráč má
}

function drawBullets(bullets = [], playersData) {
    state.ctx.fillStyle = '#f1c40f'; // Žluté kulky
    bullets.forEach(b => {
        state.ctx.beginPath();
        state.ctx.arc(b.x, b.y, 4, 0, TWO_PI);
        state.ctx.fill();
    });
}

function drawCrosshair() {
    if (state.currentMouseX === undefined || state.currentMouseY === undefined) return;
    
    const config = state.crosshairConfig || { color: '#00ff00', size: 10, shape: 'cross' };
    const { currentMouseX: x, currentMouseY: y } = state;

    state.ctx.save();
    state.ctx.strokeStyle = config.color;
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
    // Vykreslení tabulky skóre (TAB)
    state.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    state.ctx.fillRect(state.canvas.width/2 - 150, state.canvas.height/2 - 200, 300, 400);
    state.ctx.fillStyle = "white";
    state.ctx.font = "20px Arial";
    state.ctx.textAlign = "center";
    state.ctx.fillText("SKÓRE", state.canvas.width/2, state.canvas.height/2 - 160);
    // Zde by se cyklem vypsali hráči...
}

function updateDOM_HUD(player) {
    // Aktualizace HTML prvků (pokud existují)
    const hpEl = document.getElementById('hpDisplay');
    const ammoEl = document.getElementById('ammoDisplay');
    
    if (hpEl) hpEl.innerText = `HP: ${player.hp}`;
    if (ammoEl) ammoEl.innerText = `AMMO: ${player.ammo || 0}`;
}

// --- HLAVNÍ FUNKCE (Zavolá se z main.js každou vteřinu 60x) ---

export function drawGame(serverData) {
    if (!state.canvas) {
        state.canvas = document.getElementById('game');
        if (state.canvas) state.ctx = state.canvas.getContext('2d');
    }

    if (!serverData || !state.ctx || !state.canvas) return;
    const playersData = serverData.leanPlayers || serverData.players || {};
    state.canvas.style.cursor = (serverData.gameState === 'PLAYING') ? 'none' : 'default';

    if (state.canvas.width !== window.innerWidth || state.canvas.height !== window.innerHeight) {
        state.canvas.width = window.innerWidth;
        state.canvas.height = window.innerHeight;
    }
    
    // Černé pozadí mimo mapu
    state.ctx.fillStyle = '#000000';
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    // Vypočítáme kameru (změřítkování a centrování mapy)
    // Předpokládám, že CONFIG.MAP_W je definováno ve state.js. Pokud ne, dej tam třeba 2000.
    const mapW = CONFIG.MAP_W || 2000;
    const mapH = CONFIG.MAP_H || 2000;

    state.gameScale = Math.min(state.canvas.width / mapW, state.canvas.height / mapH);
    state.gameOffsetX = (state.canvas.width - mapW * state.gameScale) / 2;
    state.gameOffsetY = (state.canvas.height - mapH * state.gameScale) / 2;

    state.ctx.save();
    state.ctx.translate(state.gameOffsetX, state.gameOffsetY);
    state.ctx.scale(state.gameScale, state.gameScale);

    // Vykreslení herního světa
    drawBackground(playersData); 
    drawMapObjects(state.localObstacles, state.localBreakables);

    if (serverData.gameState !== 'LOBBY') {
        drawDomains(playersData);
        if (serverData.decoys) drawDecoys(serverData.decoys, playersData);
        drawPlayers(playersData);
        drawBullets(serverData.bullets, playersData);
        
        if (socket && playersData[socket.id]) {
            updateDOM_HUD(playersData[socket.id]);
        }
    }
    
    state.ctx.restore();

    // Vykreslení UI (zaměřovač nebo tabulka)
    if (serverData.gameState === 'PLAYING' || !serverData.gameState) {
        if (!state.playerInputs || !state.playerInputs.tab) {
            drawCrosshair(); 
        } else {
            drawTabMenu(playersData);
        }
    }

    if (serverData.gameState === 'SCOREBOARD') {
        state.ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
        state.ctx.fillStyle = "white";
        state.ctx.font = "bold 50px Arial";
        state.ctx.textAlign = "center";
        state.ctx.fillText("KOLO SKONČILO", state.canvas.width / 2, state.canvas.height / 2);
    } 
}