// game/render.js
import { socket } from './network.js';
import { state } from "./state.js"; 
import { CONFIG } from "./gameConfig.js";
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
    
    const safeObstacles = Array.isArray(obstacles) ? obstacles : Object.values(obstacles || {});
    const safeBreakables = Array.isArray(breakables) ? breakables : Object.values(breakables || {});

    // Vykreslení překážek (zdí)
    state.ctx.fillStyle = '#555555';
    safeObstacles.forEach(obs => {
        if (obs.x !== undefined) state.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    });

    // Vykreslení zničitelných objektů (krabice)
    state.ctx.fillStyle = '#8B4513';
    safeBreakables.forEach(brk => {
        if (brk.hp > 0 && brk.x !== undefined) state.ctx.fillRect(brk.x, brk.y, brk.width, brk.height);
    });
}

function drawDomains(playersData) {
    if (!state.ctx || !playersData) return;
    // Vykreslí aury/domény kolem hráčů (např. vylepšení z karet)
    for (const id in playersData) {
        const p = playersData[id];
        if (!p || p.hp <= 0 || !p.domainRadius) continue;

        const px = state.renderPlayers?.[id]?.x || p.x;
        const py = state.renderPlayers?.[id]?.y || p.y;

        state.ctx.save();
        state.ctx.globalAlpha = 0.2;
        state.ctx.fillStyle = p.domainColor || p.color || '#ffffff';
        state.ctx.beginPath();
        state.ctx.arc(px, py, p.domainRadius, 0, TWO_PI);
        state.ctx.fill();
        state.ctx.restore();
    }
}

function drawDecoys(decoys = [], playersData) {
    if (!state.ctx) return;
    const safeDecoys = Array.isArray(decoys) ? decoys : Object.values(decoys || {});
    
    safeDecoys.forEach(decoy => {
        if (decoy.x === undefined || decoy.hp <= 0) return;
        
        state.ctx.save();
        state.ctx.translate(decoy.x, decoy.y);
        state.ctx.globalAlpha = 0.5; // Klon je mírně průhledný
        
        // Rotace klonu
        state.ctx.rotate(decoy.angle || 0);
        
        // Vykreslíme stejného avatara jako u originálního hráče
        drawAvatar(decoy);
        state.ctx.restore();
    });
}

function drawPlayers(playersData) {
    if (!state.ctx || !playersData) return;
    
    if (!state.renderPlayers) state.renderPlayers = {};

    for (let rid in state.renderPlayers) {
        if (!playersData[rid]) delete state.renderPlayers[rid];
    }

    for (const id in playersData) {
        const p = playersData[id];
        if (!p || p.hp <= 0) continue;

        if (!state.renderPlayers[id]) {
            state.renderPlayers[id] = { x: p.x, y: p.y };
        }
        
        const lerpSpeed = 0.3; 
        state.renderPlayers[id].x += ((p.x || 0) - state.renderPlayers[id].x) * lerpSpeed;
        state.renderPlayers[id].y += ((p.y || 0) - state.renderPlayers[id].y) * lerpSpeed;

        const px = state.renderPlayers[id].x;
        const py = state.renderPlayers[id].y;

        state.ctx.save();
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

        // Otáčení
        let angleToDraw = p.angle || p.rotation || 0; 
        
        if (socket && id === socket.id && state.currentMouseX !== undefined) {
            const worldMouseX = (state.currentMouseX - state.gameOffsetX) / state.gameScale;
            const worldMouseY = (state.currentMouseY - state.gameOffsetY) / state.gameScale;
            angleToDraw = Math.atan2(worldMouseY - py, worldMouseX - px);
        }

        state.ctx.rotate(angleToDraw);
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
    state.ctx.strokeStyle = '#000000';
    state.ctx.lineWidth = 2;
    state.ctx.stroke();

    // Zbraň (hlaveň)
    state.ctx.fillStyle = '#7f8c8d';
    state.ctx.fillRect(0, -4, 25, 8);
    state.ctx.strokeRect(0, -4, 25, 8);

    // KOSMETIKA (Orientovaná nahoru względem rotace těla)
    if (p.cosmetics && p.cosmetics !== 'none') {
        state.ctx.save();
        state.ctx.rotate(-Math.PI / 2); // Natočení nahoru na hlavu (zbraň míří doprava na 0°)

        switch(p.cosmetics) {
            case 'crown':
                state.ctx.fillStyle = '#f1c40f';
                state.ctx.beginPath();
                state.ctx.moveTo(-10, -10); state.ctx.lineTo(-15, -25);
                state.ctx.lineTo(-5, -15); state.ctx.lineTo(0, -28);
                state.ctx.lineTo(5, -15); state.ctx.lineTo(15, -25);
                state.ctx.lineTo(10, -10); state.ctx.fill(); state.ctx.stroke();
                break;
            case 'horns':
                state.ctx.fillStyle = '#e74c3c';
                state.ctx.beginPath();
                state.ctx.moveTo(-8, -12); state.ctx.quadraticCurveTo(-15, -25, -5, -25); state.ctx.quadraticCurveTo(-10, -18, -2, -15);
                state.ctx.moveTo(8, -12); state.ctx.quadraticCurveTo(15, -25, 5, -25); state.ctx.quadraticCurveTo(10, -18, 2, -15);
                state.ctx.fill(); state.ctx.stroke();
                break;
            case 'wizard_hat':
                state.ctx.fillStyle = '#8e44ad';
                state.ctx.beginPath();
                state.ctx.moveTo(-15, -10); state.ctx.lineTo(15, -10); state.ctx.lineTo(0, -35);
                state.ctx.fill(); state.ctx.stroke();
                break;
            case 'mohawk':
                state.ctx.fillStyle = '#e67e22';
                state.ctx.beginPath();
                state.ctx.moveTo(0, 10); state.ctx.lineTo(0, -25);
                state.ctx.lineWidth = 6; state.ctx.stroke();
                break;
        }
        state.ctx.restore();
    }
}

function drawBullets(serverBullets) {
    if (!state.ctx) return;
    
    const safeServerBullets = Array.isArray(serverBullets) ? serverBullets : Object.values(serverBullets || {});
    const localBullets = state.localBullets || [];
    
    const drawnBulletIds = new Set();
    const allBullets = [...localBullets, ...safeServerBullets];

    state.ctx.lineWidth = 1;

    allBullets.forEach(b => {
        if (b.x === undefined || b.y === undefined || drawnBulletIds.has(b.id)) return;
        drawnBulletIds.add(b.id);
        
        // Pokud má kulka barvu, použijeme ji (např. z ohnivého vylepšení)
        state.ctx.fillStyle = b.color || '#f1c40f'; 
        state.ctx.strokeStyle = '#000000'; 
        
        state.ctx.beginPath();
        state.ctx.arc(b.x, b.y, b.size || 5, 0, TWO_PI);
        state.ctx.fill();
        state.ctx.stroke();
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
    
    // Převedeme hráče na pole a seřadíme podle zabití nebo skóre
    const sortedPlayers = Object.values(playersData).sort((a, b) => (b.kills || 0) - (a.kills || 0));

    state.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    state.ctx.fillRect(state.canvas.width/2 - 200, state.canvas.height/2 - 250, 400, 500);
    
    state.ctx.fillStyle = "#45f3ff";
    state.ctx.font = "bold 24px Arial";
    state.ctx.textAlign = "center";
    state.ctx.fillText("VÝSLEDKOVÁ TABULKA", state.canvas.width/2, state.canvas.height/2 - 210);
    
    state.ctx.font = "18px Arial";
    state.ctx.fillStyle = "white";
    
    // Hlavičky tabulky
    state.ctx.textAlign = "left";
    state.ctx.fillText("Hráč", state.canvas.width/2 - 150, state.canvas.height/2 - 160);
    state.ctx.textAlign = "right";
    state.ctx.fillText("Zabití", state.canvas.width/2 + 50, state.canvas.height/2 - 160);
    state.ctx.fillText("Smrti", state.canvas.width/2 + 150, state.canvas.height/2 - 160);
    
    // Seznam hráčů
    let yOffset = -120;
    sortedPlayers.forEach((p, index) => {
        state.ctx.fillStyle = p.color || "white";
        state.ctx.textAlign = "left";
        state.ctx.fillText(`${index + 1}. ${p.name || "Neznámý"}`, state.canvas.width/2 - 150, state.canvas.height/2 + yOffset);
        
        state.ctx.fillStyle = "white";
        state.ctx.textAlign = "right";
        state.ctx.fillText(p.kills || 0, state.canvas.width/2 + 50, state.canvas.height/2 + yOffset);
        state.ctx.fillText(p.deaths || 0, state.canvas.width/2 + 150, state.canvas.height/2 + yOffset);
        
        yOffset += 30;
    });
}

function updateDOM_HUD(player) {
    const hpEl = document.getElementById('hpDisplay');
    const ammoEl = document.getElementById('ammoDisplay');
    const dashFillEl = document.getElementById('dash-progress-fill');

    // Aktualizace textu
    if (hpEl && hpEl.innerText !== `HP: ${player.hp}`) hpEl.innerText = `HP: ${player.hp}`;
    if (ammoEl && ammoEl.innerText !== `AMMO: ${player.ammo}`) ammoEl.innerText = `AMMO: ${player.ammo || 0}`;

    // Aktualizace Dash Baru v Reactu
    if (dashFillEl) {
        // Předpokládám, že backend/main.js nastavuje player.dashCooldownRatio od 0 do 1
        const dashPercent = player.dashCooldownRatio !== undefined ? (1 - player.dashCooldownRatio) * 100 : 100;
        dashFillEl.style.width = `${dashPercent}%`;
    }
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
    
    state.ctx.fillStyle = '#000000';
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    const mapW = (CONFIG && CONFIG.MAP_W) ? CONFIG.MAP_W : 2000;
    const mapH = (CONFIG && CONFIG.MAP_H) ? CONFIG.MAP_H : 2000;

    let me = null;
    if (socket && socket.id) {
        me = playersData[socket.id];
    }

    // --- ZDE JE HLAVNÍ ZMĚNA: GLOBÁLNÍ KAMERA ---
    // Vypočítáme měřítko, aby se celá mapa vešla do obrazovky
    const scaleX = state.canvas.width / mapW;
    const scaleY = state.canvas.height / mapH;
    state.gameScale = Math.min(scaleX, scaleY); // Zvolíme menší číslo, ať se zachová poměr stran a nic se neořízne

    // Vycentrujeme mapu (vypočítáme prázdné místo po stranách, pokud je monitor v jiném poměru než mapa)
    state.gameOffsetX = (state.canvas.width - (mapW * state.gameScale)) / 2;
    state.gameOffsetY = (state.canvas.height - (mapH * state.gameScale)) / 2;

    state.ctx.save();
    
    // Aplikujeme "zoom" a posun na celé plátno
    state.ctx.translate(state.gameOffsetX, state.gameOffsetY);
    state.ctx.scale(state.gameScale, state.gameScale);

    drawBackground(mapW, mapH); 
    drawMapObjects(state.localObstacles || [], state.localBreakables || []);

    if (gameState !== 'LOBBY') {
        drawDomains(playersData);
        if (safeData.decoys) drawDecoys(safeData.decoys, playersData);
        drawPlayers(playersData);
        drawBullets(safeData.bullets);
        
        if (me) updateDOM_HUD(me);
    }
    
    state.ctx.restore(); 

    // --- Vykreslování UI a křížku nad herní plochou ---
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