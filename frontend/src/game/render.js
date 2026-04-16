// renderer.js
import { state } from './state.js';
import { CONFIG } from './gameConfig.js'; // Zde je opravený import!
import { socket } from './network.js';

const TWO_PI = Math.PI * 2;

// ==========================================
//   VYKRESLOVACÍ FUNKCE (Základní šablony)
// ==========================================

function drawGrid() {
    state.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    state.ctx.lineWidth = 1;
    const gridSize = 50; // Velikost jednoho čtverce v mřížce
    
    for (let x = 0; x <= CONFIG.MAP_W; x += gridSize) {
        state.ctx.beginPath(); state.ctx.moveTo(x, 0); state.ctx.lineTo(x, CONFIG.MAP_H); state.ctx.stroke();
    }
    for (let y = 0; y <= CONFIG.MAP_H; y += gridSize) {
        state.ctx.beginPath(); state.ctx.moveTo(0, y); state.ctx.lineTo(CONFIG.MAP_W, y); state.ctx.stroke();
    }
}

function drawBackground(playersData) {
    // Vykreslení barvy pozadí celé mapy
    state.ctx.fillStyle = '#111'; // Tmavý podklad mapy
    state.ctx.fillRect(0, 0, CONFIG.MAP_W, CONFIG.MAP_H);
    
    drawGrid();
    
    // Zářivá hranice mapy
    state.ctx.strokeStyle = '#45f3ff'; // Tvoje --neon-blue barva
    state.ctx.lineWidth = 4;
    state.ctx.strokeRect(0, 0, CONFIG.MAP_W, CONFIG.MAP_H);
}

function drawDomains(playersData) {
    // Místo pro případné bezpečné zóny nebo obsazovací body
}

function drawMapObjects(obstacles = [], breakables = []) {
    // Neprůstřelné překážky (např. zdi)
    state.ctx.fillStyle = '#333333';
    obstacles.forEach(obs => {
        state.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        state.ctx.strokeStyle = '#555';
        state.ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
    });

    // Zničitelné překážky (např. bedny)
    state.ctx.fillStyle = '#a0522d';
    breakables.forEach(brk => {
        state.ctx.fillRect(brk.x, brk.y, brk.width, brk.height);
    });
}

function drawCosmetics(player) {
    // Placeholder pro čepičky, skiny, atd.
}

function drawAvatar(player) {
    // Vykreslení těla hráče (kolečko)
    state.ctx.beginPath();
    state.ctx.arc(player.x, player.y, player.radius || 15, 0, Math.PI * 2);
    state.ctx.fillStyle = player.color || '#ff2a7a'; // Neon pink jako default
    state.ctx.fill();
    
    // Zvýraznění okraje pro tvého hráče
    if (socket && player.id === socket.id) {
        state.ctx.lineWidth = 2;
        state.ctx.strokeStyle = '#ffffff';
        state.ctx.stroke();
    }
    state.ctx.closePath();
}

function drawDecoys(decoys = {}, playersData) {
    // Místo pro falešné cíle / iluze
}

function drawPlayers(playersData) {
    for (const id in playersData) {
        const p = playersData[id];
        if (p.isDead) continue; // Mrtvé nekreslíme
        
        drawAvatar(p);
        drawCosmetics(p);
        
        // Jméno nad hráčem
        state.ctx.fillStyle = 'white';
        state.ctx.font = '14px "Segoe UI", sans-serif';
        state.ctx.textAlign = 'center';
        state.ctx.fillText(p.name || "Hráč", p.x, p.y - 25);
        
        // Jednoduchý HealthBar (ukazatel životů) nad hlavou
        if (p.hp !== undefined && p.maxHp !== undefined) {
            const barWidth = 40;
            const hpRatio = Math.max(0, p.hp / p.maxHp);
            
            // Pozadí baru (červené)
            state.ctx.fillStyle = '#ff0000';
            state.ctx.fillRect(p.x - barWidth / 2, p.y - 45, barWidth, 5);
            // Aktuální životy (zelené)
            state.ctx.fillStyle = '#2ed573'; // Tvoje --neon-green barva
            state.ctx.fillRect(p.x - barWidth / 2, p.y - 45, barWidth * hpRatio, 5);
        }
    }
}

function drawBullets(bullets = [], playersData) {
    state.ctx.fillStyle = '#f1c40f'; // Tvoje --neon-yellow barva pro kulky
    bullets.forEach(b => {
        state.ctx.beginPath();
        state.ctx.arc(b.x, b.y, b.radius || 4, 0, Math.PI * 2);
        state.ctx.fill();
        state.ctx.closePath();
    });
}

function drawCrosshair() {
    // Zaměřovač myši (vykresluje se nezávisle na kameře přímo na obrazovku)
    if (!state.playerInputs || state.playerInputs.mouseX === undefined) return;
    
    const mx = state.playerInputs.mouseX;
    const my = state.playerInputs.mouseY;
    
    state.ctx.strokeStyle = '#45f3ff'; // Neon blue zaměřovač
    state.ctx.lineWidth = 2;
    state.ctx.beginPath();
    // Kolečko uprostřed
    state.ctx.arc(mx, my, 8, 0, Math.PI * 2);
    // Křížek okolo
    state.ctx.moveTo(mx - 15, my); state.ctx.lineTo(mx - 4, my);
    state.ctx.moveTo(mx + 4, my); state.ctx.lineTo(mx + 15, my);
    state.ctx.moveTo(mx, my - 15); state.ctx.lineTo(mx, my - 4);
    state.ctx.moveTo(mx, my + 4); state.ctx.lineTo(mx, my + 15);
    state.ctx.stroke();
    state.ctx.closePath();
}

function drawTabMenu(playersData) {
    // Poloprůhledné černé pozadí pro tabulku skóre
    const w = 500;
    const h = 400;
    const x = (state.canvas.width - w) / 2;
    const y = (state.canvas.height - h) / 2;
    
    state.ctx.fillStyle = 'rgba(11, 12, 16, 0.9)'; // Podobné jako --glass-bg
    state.ctx.fillRect(x, y, w, h);
    
    state.ctx.strokeStyle = '#45f3ff';
    state.ctx.lineWidth = 2;
    state.ctx.strokeRect(x, y, w, h);
    
    state.ctx.fillStyle = 'white';
    state.ctx.font = 'bold 24px "Segoe UI", sans-serif';
    state.ctx.textAlign = 'center';
    state.ctx.fillText("TABULKA SKÓRE", state.canvas.width / 2, y + 40);
    
    // (Zde se později dá dopsat cyklus, co vypíše konkrétní hráče pod sebe)
}

function updateDOM_HUD(playerData) {
    // Tato funkce bezpečně zkusí najít HTML prvky a updatovat text, pokud existují
    const hpEl = document.getElementById('health-display');
    const ammoEl = document.getElementById('ammo-display');
    
    if (hpEl && playerData.hp !== undefined) {
        hpEl.innerText = `HP: ${playerData.hp} / ${playerData.maxHp}`;
    }
    if (ammoEl && playerData.ammo !== undefined) {
        ammoEl.innerText = `Náboje: ${playerData.ammo}`;
    }
}

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
    
    state.ctx.fillStyle = '#000000';
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    state.gameScale = Math.min(state.canvas.width / CONFIG.MAP_W, state.canvas.height / CONFIG.MAP_H);
    state.gameOffsetX = (state.canvas.width - CONFIG.MAP_W * state.gameScale) / 2;
    state.gameOffsetY = (state.canvas.height - CONFIG.MAP_H * state.gameScale) / 2;

    state.ctx.save();
    state.ctx.translate(state.gameOffsetX, state.gameOffsetY);
    state.ctx.scale(state.gameScale, state.gameScale);

    drawBackground(playersData); // Zavolá tvoji původní logiku
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

    if (serverData.gameState === 'PLAYING') {
        if (!state.playerInputs.tab) {
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