// game/render.js
import { state } from './state.js';
import { CONFIG } from './gameConfig.js';
import { socket } from './network.js';

const TWO_PI = Math.PI * 2;

// ==========================================
// OPRAVA: CONFIG.MAP_W -> CONFIG.MAP_WIDTH
//         CONFIG.MAP_H -> CONFIG.MAP_HEIGHT
// ==========================================

function drawGrid() {
    state.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    state.ctx.lineWidth = 1;
    const gridSize = 50;

    for (let x = 0; x <= CONFIG.MAP_WIDTH; x += gridSize) {
        state.ctx.beginPath();
        state.ctx.moveTo(x, 0);
        state.ctx.lineTo(x, CONFIG.MAP_HEIGHT);
        state.ctx.stroke();
    }
    for (let y = 0; y <= CONFIG.MAP_HEIGHT; y += gridSize) {
        state.ctx.beginPath();
        state.ctx.moveTo(0, y);
        state.ctx.lineTo(CONFIG.MAP_WIDTH, y);
        state.ctx.stroke();
    }
}

function drawBackground() {
    state.ctx.fillStyle = '#111';
    state.ctx.fillRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);

    drawGrid();

    // Zářivá hranice mapy
    state.ctx.strokeStyle = '#45f3ff';
    state.ctx.lineWidth = 4;
    state.ctx.strokeRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
}

function drawMapObjects(obstacles = [], breakables = []) {
    // Neprůstřelné překážky
    obstacles.forEach(obs => {
        state.ctx.fillStyle = '#333333';
        state.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        state.ctx.strokeStyle = '#555';
        state.ctx.lineWidth = 1;
        state.ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
    });

    // Zničitelné překážky
    breakables.forEach(brk => {
        if (brk.destroyed) return;
        state.ctx.fillStyle = '#a0522d';
        state.ctx.fillRect(brk.x, brk.y, brk.width, brk.height);
        state.ctx.strokeStyle = '#c87941';
        state.ctx.lineWidth = 1;
        state.ctx.strokeRect(brk.x, brk.y, brk.width, brk.height);
    });
}

function drawAvatar(player, id) {
    const radius = player.radius || CONFIG.PLAYER_RADIUS || 20;

    state.ctx.beginPath();
    state.ctx.arc(player.x, player.y, radius, 0, TWO_PI);
    state.ctx.fillStyle = player.color || '#ff2a7a';
    state.ctx.fill();

    // Bílý okraj pro vlastního hráče
    if (socket && id === socket.id) {
        state.ctx.lineWidth = 3;
        state.ctx.strokeStyle = '#ffffff';
        state.ctx.stroke();
    }
    state.ctx.closePath();

    // Směrová čárka (ukazuje kam hráč míří)
    if (player.aimAngle !== undefined) {
        const tipX = player.x + Math.cos(player.aimAngle) * (radius + 8);
        const tipY = player.y + Math.sin(player.aimAngle) * (radius + 8);
        state.ctx.beginPath();
        state.ctx.moveTo(player.x, player.y);
        state.ctx.lineTo(tipX, tipY);
        state.ctx.strokeStyle = player.color || '#ff2a7a';
        state.ctx.lineWidth = 3;
        state.ctx.stroke();
        state.ctx.closePath();
    }
}

function drawPlayers(playersData) {
    for (const id in playersData) {
        const p = playersData[id];
        if (!p || p.hp <= 0) continue;

        drawAvatar(p, id);

        // Jméno nad hráčem
        state.ctx.fillStyle = 'white';
        state.ctx.font = '13px "Segoe UI", sans-serif';
        state.ctx.textAlign = 'center';
        state.ctx.fillText(p.name || "Hráč", p.x, p.y - 28);

        // HP bar
        if (p.hp !== undefined && p.maxHp !== undefined) {
            const barWidth = 40;
            const hpRatio = Math.max(0, p.hp / p.maxHp);

            state.ctx.fillStyle = '#ff0000';
            state.ctx.fillRect(p.x - barWidth / 2, p.y - 42, barWidth, 5);
            state.ctx.fillStyle = '#2ed573';
            state.ctx.fillRect(p.x - barWidth / 2, p.y - 42, barWidth * hpRatio, 5);
        }
    }
}

function drawBullets(bullets = []) {
    bullets.forEach(b => {
        state.ctx.beginPath();
        state.ctx.arc(b.x, b.y, b.radius || 5, 0, TWO_PI);
        state.ctx.fillStyle = b.color || '#f1c40f';
        state.ctx.fill();
        state.ctx.closePath();
    });
}

function drawLocalBullets() {
    if (!state.localBullets) return;
    state.localBullets.forEach(b => {
        state.ctx.beginPath();
        state.ctx.arc(b.x, b.y, b.radius || 5, 0, TWO_PI);
        state.ctx.fillStyle = b.color || '#f1c40f';
        state.ctx.fill();
        state.ctx.closePath();
    });
}

function drawCrosshair() {
    // OPRAVA: Používáme state.currentMouseX/Y (nastavuje input.js)
    // PŮVODNÍ CHYBA: state.playerInputs.mouseX/Y — ty nikdy neexistovaly
    if (state.currentMouseX === undefined) return;

    const mx = state.currentMouseX;
    const my = state.currentMouseY;

    state.ctx.save();
    // Zaměřovač kreslíme ve screen-space (mimo scale/translate kamery)
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.ctx.strokeStyle = '#45f3ff';
    state.ctx.lineWidth = 2;

    const shape = state.crosshairConfig?.shape || 'cross';

    if (shape === 'dot') {
        state.ctx.beginPath();
        state.ctx.arc(mx, my, 4, 0, TWO_PI);
        state.ctx.fillStyle = '#45f3ff';
        state.ctx.fill();
    } else if (shape === 'circle') {
        state.ctx.beginPath();
        state.ctx.arc(mx, my, 12, 0, TWO_PI);
        state.ctx.stroke();
    } else {
        // 'cross' (výchozí)
        state.ctx.beginPath();
        state.ctx.arc(mx, my, 6, 0, TWO_PI);
        state.ctx.moveTo(mx - 14, my); state.ctx.lineTo(mx - 8, my);
        state.ctx.moveTo(mx + 8, my);  state.ctx.lineTo(mx + 14, my);
        state.ctx.moveTo(mx, my - 14); state.ctx.lineTo(mx, my - 8);
        state.ctx.moveTo(mx, my + 8);  state.ctx.lineTo(mx, my + 14);
        state.ctx.stroke();
    }
    state.ctx.restore();
}

function drawTabMenu(playersData) {
    const w = 500;
    const h = 400;

    state.ctx.save();
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);

    const x = (state.canvas.width - w) / 2;
    const y = (state.canvas.height - h) / 2;

    state.ctx.fillStyle = 'rgba(11, 12, 16, 0.92)';
    state.ctx.fillRect(x, y, w, h);
    state.ctx.strokeStyle = '#45f3ff';
    state.ctx.lineWidth = 2;
    state.ctx.strokeRect(x, y, w, h);

    state.ctx.fillStyle = 'white';
    state.ctx.font = 'bold 24px "Segoe UI", sans-serif';
    state.ctx.textAlign = 'center';
    state.ctx.fillText("TABULKA SKÓRE", state.canvas.width / 2, y + 45);

    let rowY = y + 90;
    for (const id in playersData) {
        const p = playersData[id];
        state.ctx.fillStyle = p.color || 'white';
        state.ctx.font = '18px "Segoe UI", sans-serif';
        state.ctx.textAlign = 'left';
        state.ctx.fillText(`${p.name || 'Hráč'}`, x + 30, rowY);
        state.ctx.textAlign = 'right';
        state.ctx.fillStyle = 'white';
        state.ctx.fillText(`${p.score || 0} bodů`, x + w - 30, rowY);
        rowY += 36;
    }

    state.ctx.restore();
}

function updateDOM_HUD(playerData) {
    const ammoEl = document.getElementById('ammo-text');
    if (ammoEl && playerData.ammo !== undefined) {
        ammoEl.innerText = `${playerData.ammo} / ${playerData.maxAmmo}`;
    }
}

export function drawGame(serverData) {
    // Zajistíme canvas a ctx
    if (!state.canvas) {
        state.canvas = document.getElementById('game');
        if (state.canvas) state.ctx = state.canvas.getContext('2d');
    }

    if (!serverData || !state.ctx || !state.canvas) return;

    const playersData = serverData.leanPlayers || serverData.players || {};

    // Skryjeme kurzor ve hře
    state.canvas.style.cursor = (serverData.gameState === 'PLAYING') ? 'none' : 'default';

    // Synchronizujeme rozlišení canvasu s jeho CSS velikostí
    const w = state.canvas.offsetWidth;
    const h = state.canvas.offsetHeight;
    if (state.canvas.width !== w || state.canvas.height !== h) {
        state.canvas.width = w;
        state.canvas.height = h;
    }

    // Černé pozadí obrazovky
    state.ctx.fillStyle = '#000000';
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    // OPRAVA: MAP_WIDTH a MAP_HEIGHT (ne MAP_W / MAP_H)
    const mapW = CONFIG.MAP_WIDTH;
    const mapH = CONFIG.MAP_HEIGHT;

    // Výpočet škálování pro letterbox (zachová poměr strany mapy)
    state.gameScale = Math.min(state.canvas.width / mapW, state.canvas.height / mapH);
    state.gameOffsetX = (state.canvas.width - mapW * state.gameScale) / 2;
    state.gameOffsetY = (state.canvas.height - mapH * state.gameScale) / 2;

    state.ctx.save();
    state.ctx.translate(state.gameOffsetX, state.gameOffsetY);
    state.ctx.scale(state.gameScale, state.gameScale);

    drawBackground();
    drawMapObjects(state.localObstacles || [], state.localBreakables || []);

    if (serverData.gameState !== 'LOBBY') {
        drawPlayers(playersData);
        drawLocalBullets();
        if (serverData.bullets) drawBullets(serverData.bullets);

        if (socket && playersData[socket.id]) {
            updateDOM_HUD(playersData[socket.id]);
        }
    }

    state.ctx.restore();

    // Tyto prvky kreslíme ve screen-space (po restore)
    if (serverData.gameState === 'PLAYING') {
        if (state.playerInputs?.tab) {
            drawTabMenu(playersData);
        } else {
            drawCrosshair();
        }
    }

    if (serverData.gameState === 'SCOREBOARD') {
        state.ctx.fillStyle = 'rgba(0,0,0,0.85)';
        state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
        state.ctx.fillStyle = 'white';
        state.ctx.font = 'bold 50px Arial';
        state.ctx.textAlign = 'center';
        state.ctx.fillText('KOLO SKONČILO', state.canvas.width / 2, state.canvas.height / 2);
    }
}