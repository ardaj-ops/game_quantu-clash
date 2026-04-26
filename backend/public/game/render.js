// game/render.js
import { state } from './state.js';
import { CONFIG } from '../gameConfig.js';
import { socket } from './network.js';
import { getDashState } from './physics.js';

const TWO_PI = Math.PI * 2;

function drawGrid() {
    const W = CONFIG.MAP_WIDTH || 1920;
    const H = CONFIG.MAP_HEIGHT || 1080;
    state.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    state.ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x <= W; x += gridSize) {
        state.ctx.beginPath(); state.ctx.moveTo(x, 0); state.ctx.lineTo(x, H); state.ctx.stroke();
    }
    for (let y = 0; y <= H; y += gridSize) {
        state.ctx.beginPath(); state.ctx.moveTo(0, y); state.ctx.lineTo(W, y); state.ctx.stroke();
    }
}

function drawBackground() {
    const W = CONFIG.MAP_WIDTH || 1920;
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
        state.ctx.fillStyle = '#333333';
        state.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        state.ctx.strokeStyle = '#555555';
        state.ctx.lineWidth = 1;
        state.ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
    });

    breakables.forEach(brk => {
        if (brk.destroyed) return;
        const hpRatio = brk.hp !== undefined ? Math.max(0, brk.hp / (brk.maxHp || brk.hp)) : 1;
        // BUG FIX: Barva zničitelné stěny zbledne jak dostává poškození
        const r = Math.floor(160 + (1 - hpRatio) * 80);
        const g = Math.floor(82 * hpRatio);
        const b = Math.floor(45 * hpRatio);
        state.ctx.fillStyle = `rgb(${r},${g},${b})`;
        state.ctx.fillRect(brk.x, brk.y, brk.width, brk.height);
        state.ctx.strokeStyle = '#c87941';
        state.ctx.lineWidth = 1;
        state.ctx.strokeRect(brk.x, brk.y, brk.width, brk.height);
    });
}

function drawAvatar(player, id) {
    const radius = player.playerRadius || player.radius || CONFIG.PLAYER_RADIUS || 20;
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

    // Jackpot aura
    if (player.isJackpotActive) {
        state.ctx.beginPath();
        state.ctx.arc(player.x, player.y, radius + 8, 0, TWO_PI);
        state.ctx.strokeStyle = 'rgba(241, 196, 15, 0.8)';
        state.ctx.lineWidth = 3;
        state.ctx.stroke();
        state.ctx.closePath();
    }

    // Doménový indikátor
    if (player.domainActive) {
        state.ctx.beginPath();
        state.ctx.arc(player.x, player.y, (player.domainRadius || 200), 0, TWO_PI);
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

        drawAvatar(p, id);

        state.ctx.fillStyle = 'white';
        state.ctx.font = '13px "Segoe UI", sans-serif';
        state.ctx.textAlign = 'center';
        state.ctx.fillText(p.name || 'Hráč', p.x, p.y - 28);

        if (p.hp !== undefined && p.maxHp !== undefined) {
            const barWidth = 40;
            const hpRatio = Math.max(0, p.hp / p.maxHp);
            state.ctx.fillStyle = '#550000';
            state.ctx.fillRect(p.x - barWidth / 2, p.y - 42, barWidth, 5);
            state.ctx.fillStyle = '#2ed573';
            state.ctx.fillRect(p.x - barWidth / 2, p.y - 42, barWidth * hpRatio, 5);
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
    // BUG FIX: Barva vždy čte z configu. Dříve 'dot' tvar ignoroval barvu a
    // vždy kreslil '#45f3ff' hardcoded jako fillStyle.
    const color = state.crosshairConfig?.color || '#45f3ff';

    state.ctx.save();
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.ctx.strokeStyle = color;
    state.ctx.fillStyle = color;
    state.ctx.lineWidth = 2;

    if (shape === 'dot') {
        state.ctx.beginPath();
        state.ctx.arc(mx, my, 4, 0, TWO_PI);
        state.ctx.fill();
    } else if (shape === 'circle') {
        state.ctx.beginPath();
        state.ctx.arc(mx, my, 12, 0, TWO_PI);
        state.ctx.stroke();
    } else {
        // cross (výchozí)
        state.ctx.beginPath();
        state.ctx.arc(mx, my, 6, 0, TWO_PI);
        state.ctx.moveTo(mx - 15, my); state.ctx.lineTo(mx - 8, my);
        state.ctx.moveTo(mx + 8, my);  state.ctx.lineTo(mx + 15, my);
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

    const x = (state.canvas.width - w) / 2;
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

    state.ctx.fillStyle = me.domainActive ? '#ff2a7a' : (me.domainCooldown > 0 ? '#888' : '#45f3ff');
    state.ctx.font = 'bold 13px "Segoe UI", sans-serif';
    state.ctx.textAlign = 'left';
    state.ctx.fillText(`⚡ ${me.domainType.replace(/_/g, ' ')}`, x + 10, y + 22);

    if (me.domainActive) {
        state.ctx.fillStyle = '#ff2a7a';
        state.ctx.fillText('AKTIVNÍ', x + 10, y + 48);
    } else if (me.domainCooldown > 0) {
        state.ctx.fillStyle = '#aaa';
        state.ctx.fillText(`Cooldown: ${(me.domainCooldown / 1000).toFixed(1)}s`, x + 10, y + 48);
        const ratio = 1 - Math.min(1, me.domainCooldown / 15000);
        state.ctx.fillStyle = 'rgba(69,243,255,0.15)';
        state.ctx.fillRect(x + 1, y + 57, 218 * ratio, 11);
    } else {
        state.ctx.fillStyle = '#45f3ff';
        state.ctx.fillText('Připraveno  [F]', x + 10, y + 48);
        state.ctx.fillStyle = 'rgba(69,243,255,0.12)';
        state.ctx.fillRect(x + 1, y + 57, 218, 11);
    }

    state.ctx.restore();
}

// Dash cooldown bar — bottom-right corner, always visible during gameplay
function drawDashHUD() {
    const dash = getDashState();

    state.ctx.save();
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);

    const w  = 160;
    const x  = state.canvas.width  - w - 20;
    const y  = state.canvas.height - 50;

    state.ctx.fillStyle = 'rgba(0,0,0,0.65)';
    state.ctx.fillRect(x, y, w, 30);

    if (dash.active) {
        // Dashing — solid cyan fill
        state.ctx.fillStyle = '#45f3ff';
        state.ctx.fillRect(x + 1, y + 1, w - 2, 28);
        state.ctx.fillStyle = '#000';
        state.ctx.font = 'bold 13px "Segoe UI", sans-serif';
        state.ctx.textAlign = 'center';
        state.ctx.fillText('DASH!', x + w / 2, y + 20);
    } else if (dash.cooldown > 0) {
        // Cooling down — progress bar
        const ratio = 1 - dash.cooldown / dash.maxCooldown;
        state.ctx.fillStyle = 'rgba(69,243,255,0.25)';
        state.ctx.fillRect(x + 1, y + 1, (w - 2) * ratio, 28);
        state.ctx.fillStyle = '#aaa';
        state.ctx.font = 'bold 13px "Segoe UI", sans-serif';
        state.ctx.textAlign = 'center';
        state.ctx.fillText(`Dash ${(dash.cooldown / 1000).toFixed(1)}s`, x + w / 2, y + 20);
    } else {
        // Ready
        state.ctx.strokeStyle = '#45f3ff';
        state.ctx.lineWidth = 1.5;
        state.ctx.strokeRect(x, y, w, 30);
        state.ctx.fillStyle = '#45f3ff';
        state.ctx.font = 'bold 13px "Segoe UI", sans-serif';
        state.ctx.textAlign = 'center';
        state.ctx.fillText('DASH  [RMB] ✓', x + w / 2, y + 20);
    }

    state.ctx.restore();
}

// Shown to the winner while losers are picking cards
function drawWinnerWaitScreen() {
    state.ctx.save();
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.ctx.fillStyle = 'rgba(0,0,0,0.75)';
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    state.ctx.textAlign = 'center';
    state.ctx.fillStyle = '#f1c40f';
    state.ctx.font = 'bold 56px "Segoe UI", sans-serif';
    state.ctx.fillText('🏆 VÍTĚZ KOLA!', state.canvas.width / 2, state.canvas.height / 2 - 30);

    state.ctx.fillStyle = '#aaa';
    state.ctx.font = '24px "Segoe UI", sans-serif';
    state.ctx.fillText('Ostatní hráči vybírají kartu…', state.canvas.width / 2, state.canvas.height / 2 + 30);
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

    const cw = state.canvas.offsetWidth || window.innerWidth;
    const ch = state.canvas.offsetHeight || window.innerHeight;
    if (state.canvas.width !== cw || state.canvas.height !== ch) {
        state.canvas.width = cw;
        state.canvas.height = ch;
    }

    state.ctx.fillStyle = '#000';
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    const mapW = CONFIG.MAP_WIDTH || 1920;
    const mapH = CONFIG.MAP_HEIGHT || 1080;

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
            drawDomainHUD(serverData);
            drawDashHUD();
        }
    }

    // Winner waiting screen — shown to the survivor while others pick cards
    if (serverData.gameState === 'CARD_SELECTION') {
        const me = socket && playersData[socket.id];
        const iAmWinner = me && me.hp > 0;
        if (iAmWinner) {
            drawWinnerWaitScreen();
        }
        // Losers see the card selection overlay (handled in network.js / HTML)
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
