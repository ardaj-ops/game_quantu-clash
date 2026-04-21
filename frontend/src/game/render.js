// game/render.js
import { state } from './state.js';
import { CONFIG } from './gameConfig.js';
import { socket } from './network.js';

const TWO_PI = Math.PI * 2;

// OPRAVA ammo glitch: callback nastavený z App.jsx pro update ammo v React state
// místo přímého document.getElementById(...).innerText (způsobovalo glitch)
export let onAmmoUpdate = null;

function drawGrid() {
    state.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    state.ctx.lineWidth = 1;
    const gridSize = 50;
    // OPRAVA: MAP_W/MAP_H -> MAP_WIDTH/MAP_HEIGHT
    for (let x = 0; x <= CONFIG.MAP_WIDTH; x += gridSize) {
        state.ctx.beginPath(); state.ctx.moveTo(x, 0); state.ctx.lineTo(x, CONFIG.MAP_HEIGHT); state.ctx.stroke();
    }
    for (let y = 0; y <= CONFIG.MAP_HEIGHT; y += gridSize) {
        state.ctx.beginPath(); state.ctx.moveTo(0, y); state.ctx.lineTo(CONFIG.MAP_WIDTH, y); state.ctx.stroke();
    }
}

function drawBackground() {
    state.ctx.fillStyle = '#111';
    state.ctx.fillRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
    drawGrid();
    state.ctx.strokeStyle = '#45f3ff';
    state.ctx.lineWidth = 4;
    state.ctx.strokeRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
}

function drawMapObjects(obstacles = [], breakables = []) {
    obstacles.forEach(obs => {
        state.ctx.fillStyle = '#333333';
        state.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        state.ctx.strokeStyle = '#555';
        state.ctx.lineWidth = 1;
        state.ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
    });
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
    if (socket && id === socket.id) {
        state.ctx.lineWidth = 3;
        state.ctx.strokeStyle = '#ffffff';
        state.ctx.stroke();
    }
    state.ctx.closePath();
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
        state.ctx.fillStyle = 'white';
        state.ctx.font = '13px "Segoe UI", sans-serif';
        state.ctx.textAlign = 'center';
        state.ctx.fillText(p.name || "Hráč", p.x, p.y - 28);
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

function drawBullets() {
    const now = Date.now();

    // Vlastní střely
    if (state.localBullets) {
        state.localBullets.forEach(b => {
            state.ctx.beginPath();
            state.ctx.arc(b.x, b.y, b.radius || 5, 0, TWO_PI);
            state.ctx.fillStyle = b.color || '#f1c40f';
            state.ctx.fill();
            state.ctx.closePath();
        });
    }

    // OPRAVA: Střely ostatních hráčů — dříve VŮBEC neexistoval kód pro toto!
    if (state.remoteBullets) {
        state.remoteBullets = state.remoteBullets.filter(b => now - b.createdAt < 3000);
        state.remoteBullets.forEach(b => {
            const age = (now - b.createdAt) / 1000;
            const x = b.x + (b.vx || 0) * age * 60;
            const y = b.y + (b.vy || 0) * age * 60;
            state.ctx.beginPath();
            state.ctx.arc(x, y, b.radius || 5, 0, TWO_PI);
            state.ctx.fillStyle = b.color || '#ff4757';
            state.ctx.fill();
            state.ctx.closePath();
        });
    }
}

function drawCrosshair() {
    if (state.currentMouseX === undefined) return;
    const mx = state.currentMouseX;
    const my = state.currentMouseY;
    const shape = state.crosshairConfig?.shape || 'cross';
    state.ctx.save();
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.ctx.strokeStyle = '#45f3ff';
    state.ctx.lineWidth = 2;
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
    const w = 500, h = 400;
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

export function drawGame(serverData) {
    if (!state.canvas) {
        state.canvas = document.getElementById('game');
        if (state.canvas) state.ctx = state.canvas.getContext('2d');
    }
    if (!serverData || !state.ctx || !state.canvas) return;

    const playersData = serverData.leanPlayers || serverData.players || {};
    state.canvas.style.cursor = (serverData.gameState === 'PLAYING') ? 'none' : 'default';

    const w = state.canvas.offsetWidth || window.innerWidth;
    const h = state.canvas.offsetHeight || window.innerHeight;
    if (state.canvas.width !== w || state.canvas.height !== h) {
        state.canvas.width = w;
        state.canvas.height = h;
    }

    state.ctx.fillStyle = '#000000';
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    const mapW = CONFIG.MAP_WIDTH;
    const mapH = CONFIG.MAP_HEIGHT;
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
        drawBullets();
    }

    state.ctx.restore();

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

    // OPRAVA ammo: voláme callback z App.jsx místo přímého DOM.innerText
    if (socket && playersData[socket.id] && typeof onAmmoUpdate === 'function') {
        const me = playersData[socket.id];
        onAmmoUpdate(me.ammo ?? 0, me.maxAmmo ?? 0);
    }
}