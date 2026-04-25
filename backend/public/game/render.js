// game/render.js
import { state } from './state.js';
import { CONFIG } from '../gameConfig.js';
import { socket } from './network.js';

const TWO_PI = Math.PI * 2;

function drawGrid() {
    const W = CONFIG.MAP_WIDTH  || 1920;
    const H = CONFIG.MAP_HEIGHT || 1080;
    state.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    state.ctx.lineWidth = 1;
    const gs = 50;
    for (let x = 0; x <= W; x += gs) {
        state.ctx.beginPath(); state.ctx.moveTo(x, 0); state.ctx.lineTo(x, H); state.ctx.stroke();
    }
    for (let y = 0; y <= H; y += gs) {
        state.ctx.beginPath(); state.ctx.moveTo(0, y); state.ctx.lineTo(W, y); state.ctx.stroke();
    }
}

function drawBackground() {
    const W = CONFIG.MAP_WIDTH  || 1920;
    const H = CONFIG.MAP_HEIGHT || 1080;
    state.ctx.fillStyle = '#111';
    state.ctx.fillRect(0, 0, W, H);
    drawGrid();
    state.ctx.strokeStyle = '#45f3ff';
    state.ctx.lineWidth = 4;
    state.ctx.strokeRect(0, 0, W, H);
}

function drawMapObjects(obstacles = [], breakables = []) {
    obstacles.forEach(obs => {
        state.ctx.fillStyle = '#333';
        state.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        state.ctx.strokeStyle = '#555';
        state.ctx.lineWidth = 1;
        state.ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
    });

    breakables.forEach(brk => {
        if (brk.destroyed) return;
        // Colour shifts from brown → red as HP drops
        const hpRatio = brk.hp !== undefined ? Math.max(0, brk.hp / (brk.maxHp || brk.hp)) : 1;
        const r = Math.floor(160 + (1 - hpRatio) * 80);
        const g = Math.floor(82  * hpRatio);
        const b = Math.floor(45  * hpRatio);
        state.ctx.fillStyle = `rgb(${r},${g},${b})`;
        state.ctx.fillRect(brk.x, brk.y, brk.width, brk.height);
        state.ctx.strokeStyle = '#c87941';
        state.ctx.lineWidth = 1;
        state.ctx.strokeRect(brk.x, brk.y, brk.width, brk.height);
    });
}

// BUG FIX: drawAvatar now accepts a separate 'renderPos' object for smooth drawing
// while 'player' still carries all the stat fields (hp, aimAngle, domainActive…).
// This lets the interpolated position drive visuals without corrupting physics data.
function drawAvatar(player, id, renderPos) {
    const rx     = renderPos ? renderPos.x        : player.x;
    const ry     = renderPos ? renderPos.y        : player.y;
    const rAngle = renderPos ? renderPos.aimAngle : (player.aimAngle || 0);
    const radius = player.playerRadius || CONFIG.PLAYER_RADIUS || 20;

    state.ctx.beginPath();
    state.ctx.arc(rx, ry, radius, 0, TWO_PI);
    state.ctx.fillStyle = player.color || '#ff2a7a';
    state.ctx.fill();

    if (socket && id === socket.id) {
        state.ctx.lineWidth = 3;
        state.ctx.strokeStyle = '#ffffff';
        state.ctx.stroke();
    }
    state.ctx.closePath();

    // Aim direction pointer
    const tipX = rx + Math.cos(rAngle) * (radius + 8);
    const tipY = ry + Math.sin(rAngle) * (radius + 8);
    state.ctx.beginPath();
    state.ctx.moveTo(rx, ry);
    state.ctx.lineTo(tipX, tipY);
    state.ctx.strokeStyle = player.color || '#ff2a7a';
    state.ctx.lineWidth = 3;
    state.ctx.stroke();
    state.ctx.closePath();

    // Jackpot aura
    if (player.isJackpotActive) {
        state.ctx.beginPath();
        state.ctx.arc(rx, ry, radius + 8, 0, TWO_PI);
        state.ctx.strokeStyle = 'rgba(241, 196, 15, 0.85)';
        state.ctx.lineWidth = 3;
        state.ctx.stroke();
        state.ctx.closePath();
    }

    // Domain radius ring
    if (player.domainActive) {
        state.ctx.beginPath();
        // BUG FIX: use player.domainRadius (now sent by server); fallback to 200
        state.ctx.arc(rx, ry, player.domainRadius || 200, 0, TWO_PI);
        state.ctx.strokeStyle = 'rgba(255, 42, 122, 0.25)';
        state.ctx.lineWidth = 2;
        state.ctx.stroke();
        state.ctx.closePath();
    }
}

function drawPlayers(playersData) {
    for (const id in playersData) {
        const p = playersData[id];
        if (!p || p.hp <= 0) continue;

        // BUG FIX: Use interpolated position for rendering if available.
        // physics.js / server sync still operates on playersData[id].x/y.
        const renderPos = state.interpolatedPlayers?.[id] || null;

        drawAvatar(p, id, renderPos);

        const rx = renderPos ? renderPos.x : p.x;
        const ry = renderPos ? renderPos.y : p.y;

        state.ctx.fillStyle = 'white';
        state.ctx.font = '13px "Segoe UI", sans-serif';
        state.ctx.textAlign = 'center';
        state.ctx.fillText(p.name || 'Hráč', rx, ry - 28);

        if (p.hp !== undefined && p.maxHp !== undefined) {
            const bw = 40;
            const hpRatio = Math.max(0, p.hp / p.maxHp);
            state.ctx.fillStyle = '#550000';
            state.ctx.fillRect(rx - bw / 2, ry - 42, bw, 5);
            state.ctx.fillStyle = '#2ed573';
            state.ctx.fillRect(rx - bw / 2, ry - 42, bw * hpRatio, 5);
        }
    }
}

function drawBullets() {
    if (state.localBullets) {
        state.localBullets.forEach(b => {
            state.ctx.beginPath();
            state.ctx.arc(b.x, b.y, b.radius || 5, 0, TWO_PI);
            state.ctx.fillStyle = b.color || '#f1c40f';
            state.ctx.fill();
            state.ctx.closePath();
        });
    }

    if (state.remoteBullets) {
        const now = Date.now();
        state.remoteBullets = state.remoteBullets.filter(b => now - b.createdAt < 3000);
        state.remoteBullets.forEach(b => {
            const age = (now - b.createdAt) / 1000;
            const rx = b.x + (b.vx || 0) * age * 60;
            const ry = b.y + (b.vy || 0) * age * 60;
            state.ctx.beginPath();
            state.ctx.arc(rx, ry, b.radius || 5, 0, TWO_PI);
            state.ctx.fillStyle = b.color || '#ff4757';
            state.ctx.fill();
            state.ctx.closePath();
        });
    }
}

function drawCrosshair() {
    const mx = state.currentMouseX;
    const my = state.currentMouseY;
    if (mx == null || my == null) return;

    const shape = state.crosshairConfig?.shape || 'cross';
    const color = state.crosshairConfig?.color || '#45f3ff';

    state.ctx.save();
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.ctx.strokeStyle = color;
    state.ctx.fillStyle   = color;
    state.ctx.lineWidth   = 2;

    if (shape === 'dot') {
        state.ctx.beginPath();
        state.ctx.arc(mx, my, 4, 0, TWO_PI);
        state.ctx.fill();
    } else if (shape === 'circle') {
        state.ctx.beginPath();
        state.ctx.arc(mx, my, 12, 0, TWO_PI);
        state.ctx.stroke();
    } else {
        state.ctx.beginPath();
        state.ctx.arc(mx, my, 6, 0, TWO_PI);
        state.ctx.moveTo(mx - 15, my); state.ctx.lineTo(mx - 8,  my);
        state.ctx.moveTo(mx + 8,  my); state.ctx.lineTo(mx + 15, my);
        state.ctx.moveTo(mx, my - 15); state.ctx.lineTo(mx, my - 8);
        state.ctx.moveTo(mx, my + 8);  state.ctx.lineTo(mx, my + 15);
        state.ctx.stroke();
    }
    state.ctx.restore();
}

function drawTabMenu(playersData) {
    const playerCount = Object.keys(playersData).length;
    const w = 500;
    const h = 80 + playerCount * 40;

    state.ctx.save();
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);

    const x = (state.canvas.width  - w) / 2;
    const y = (state.canvas.height - h) / 2;

    state.ctx.fillStyle = 'rgba(11, 12, 16, 0.92)';
    state.ctx.fillRect(x, y, w, h);
    state.ctx.strokeStyle = '#45f3ff';
    state.ctx.lineWidth = 2;
    state.ctx.strokeRect(x, y, w, h);

    state.ctx.fillStyle = 'white';
    state.ctx.font = 'bold 22px "Segoe UI", sans-serif';
    state.ctx.textAlign = 'center';
    state.ctx.fillText('TABULKA SKÓRE', state.canvas.width / 2, y + 35);

    let rowY = y + 70;
    for (const id in playersData) {
        const p = playersData[id];
        state.ctx.fillStyle = p.color || 'white';
        state.ctx.font = '17px "Segoe UI", sans-serif';
        state.ctx.textAlign = 'left';
        state.ctx.fillText(`${p.name || 'Hráč'} ${p.hp > 0 ? '❤️' : '💀'}`, x + 25, rowY);
        state.ctx.textAlign = 'right';
        state.ctx.fillStyle = '#f1c40f';
        state.ctx.fillText(`${p.score || 0} bodů`, x + w - 25, rowY);
        rowY += 38;
    }
    state.ctx.restore();
}

function drawDomainHUD(serverData) {
    const me = serverData.players && socket ? serverData.players[socket.id] : null;
    if (!me || !me.domainType) return;

    state.ctx.save();
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);

    const x = 20;
    const y = state.canvas.height - 90;

    state.ctx.fillStyle = 'rgba(0,0,0,0.65)';
    state.ctx.fillRect(x, y, 220, 70);
    state.ctx.strokeStyle = me.domainActive ? '#ff2a7a' : (me.domainCooldown > 0 ? '#555' : '#45f3ff');
    state.ctx.lineWidth = 1.5;
    state.ctx.strokeRect(x, y, 220, 70);

    // Domain name
    state.ctx.fillStyle = me.domainActive ? '#ff2a7a' : (me.domainCooldown > 0 ? '#888' : '#45f3ff');
    state.ctx.font = 'bold 13px "Segoe UI", sans-serif';
    state.ctx.textAlign = 'left';
    state.ctx.fillText(`⚡ ${me.domainType.replace(/_/g, ' ')}`, x + 10, y + 22);

    // Status line
    if (me.domainActive) {
        state.ctx.fillStyle = '#ff2a7a';
        state.ctx.fillText('AKTIVNÍ', x + 10, y + 48);
    } else if (me.domainCooldown > 0) {
        // BUG FIX: domainCooldown is now sent by server, so this shows real time
        state.ctx.fillStyle = '#aaa';
        const cdSec = (me.domainCooldown / 1000).toFixed(1);
        state.ctx.fillText(`Cooldown: ${cdSec}s`, x + 10, y + 48);
        // Cooldown progress bar
        const maxCd = 15000;
        const ratio = 1 - Math.min(1, me.domainCooldown / maxCd);
        state.ctx.fillStyle = 'rgba(69,243,255,0.15)';
        state.ctx.fillRect(x + 1, y + 55, 218 * ratio, 13);
    } else {
        state.ctx.fillStyle = '#45f3ff';
        state.ctx.fillText('Připraveno  [F]', x + 10, y + 48);
        // Pulsing ready indicator
        state.ctx.fillStyle = 'rgba(69,243,255,0.12)';
        state.ctx.fillRect(x + 1, y + 55, 218, 13);
    }

    state.ctx.restore();
}

export function drawGame(serverData) {
    if (!state.canvas) {
        state.canvas = document.getElementById('game');
        if (state.canvas) state.ctx = state.canvas.getContext('2d');
    }
    if (!serverData || !state.ctx || !state.canvas) return;

    const playersData = serverData.players || {};
    state.canvas.style.cursor = serverData.gameState === 'PLAYING' ? 'none' : 'default';

    // Sync canvas resolution to CSS size
    const cw = state.canvas.offsetWidth  || window.innerWidth;
    const ch = state.canvas.offsetHeight || window.innerHeight;
    if (state.canvas.width !== cw || state.canvas.height !== ch) {
        state.canvas.width  = cw;
        state.canvas.height = ch;
    }

    // Black letter-box background
    state.ctx.fillStyle = '#000';
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    const mapW = CONFIG.MAP_WIDTH  || 1920;
    const mapH = CONFIG.MAP_HEIGHT || 1080;

    state.gameScale   = Math.min(state.canvas.width / mapW, state.canvas.height / mapH);
    state.gameOffsetX = (state.canvas.width  - mapW * state.gameScale) / 2;
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
            drawDomainHUD(serverData);
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
