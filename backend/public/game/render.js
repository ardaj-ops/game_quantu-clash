// game/render.js
import { state } from './state.js';
import { CONFIG } from '../gameConfig.js';
import { socket } from './network.js';
import { getDashState } from './physics.js';

const TWO_PI = Math.PI * 2;

// ─── BACKGROUND ─────────────────────────────────────────────────────────────

function drawGrid() {
    const W = CONFIG.MAP_WIDTH  || 1920;
    const H = CONFIG.MAP_HEIGHT || 1080;
    const ctx = state.ctx;
    ctx.strokeStyle = 'rgba(69,243,255,0.04)';
    ctx.lineWidth = 1;
    const gs = 60;
    for (let x = 0; x <= W; x += gs) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += gs) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
}

function drawBackground() {
    const W = CONFIG.MAP_WIDTH  || 1920;
    const H = CONFIG.MAP_HEIGHT || 1080;
    const ctx = state.ctx;

    ctx.fillStyle = '#0d0f16';
    ctx.fillRect(0, 0, W, H);
    drawGrid();

    // FIX: Arena border is now drawn as a thick solid neon wall (12px),
    // matching the physical border wall objects in gameHelper.js.
    // Previously just a thin decorative 3px line that gave no visual feedback
    // that bullets actually bounce off it.
    ctx.strokeStyle = '#45f3ff';
    ctx.lineWidth = 12;
    ctx.shadowColor = '#45f3ff';
    ctx.shadowBlur  = 24;
    ctx.strokeRect(6, 6, W - 12, H - 12);

    // Inner glow layer
    ctx.strokeStyle = 'rgba(69,243,255,0.3)';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 0;
    ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.shadowBlur = 0;
}

// ─── MAP OBJECTS ─────────────────────────────────────────────────────────────

function drawMapObjects(obstacles = [], breakables = []) {
    const ctx = state.ctx;

    obstacles.forEach(obs => {
        // FIX: Skip border wall objects (isBorder flag) — they are already drawn
        // as the thick arena border in drawBackground(). Rendering them again
        // would paint dark rectangles over the neon border.
        if (obs.isBorder) return;
        // Also skip anything genuinely outside the map
        if (obs.x < -10 || obs.y < -10) return;

        ctx.fillStyle = '#1e2130';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeStyle = 'rgba(100,120,160,0.5)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(obs.x + 0.5, obs.y + 0.5, obs.width - 1, obs.height - 1);
        ctx.strokeStyle = 'rgba(200,220,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y);
        ctx.stroke();
    });

    breakables.forEach(brk => {
        if (brk.destroyed) return;
        const hp    = brk.hp    !== undefined ? brk.hp    : 1;
        const maxHp = brk.maxHp !== undefined ? brk.maxHp : 1;
        const ratio = Math.max(0, hp / maxHp);

        const r = Math.floor(200 + (1 - ratio) * 55);
        const g = Math.floor(120 * ratio);
        const b = Math.floor(20  * ratio);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(brk.x, brk.y, brk.width, brk.height);

        if (ratio < 0.99) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(brk.x, brk.y, brk.width, brk.height);
            ctx.clip();
            ctx.strokeStyle = `rgba(0,0,0,${(1 - ratio) * 0.7})`;
            ctx.lineWidth = 1.5;
            const cx = brk.x + brk.width / 2;
            const cy = brk.y + brk.height / 2;
            ctx.beginPath();
            ctx.moveTo(cx - 10, cy - 15); ctx.lineTo(cx + 5,  cy + 8);
            ctx.moveTo(cx + 5,  cy + 8);  ctx.lineTo(cx + 15, cy + 20);
            ctx.moveTo(cx - 5,  cy - 5);  ctx.lineTo(cx - 18, cy + 10);
            ctx.stroke();
            ctx.restore();
        }

        ctx.strokeStyle = ratio > 0.5 ? 'rgba(255,180,60,0.7)' : 'rgba(220,80,40,0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(brk.x + 0.5, brk.y + 0.5, brk.width - 1, brk.height - 1);
    });
}

// ─── PLAYERS ─────────────────────────────────────────────────────────────────

function lightenColor(hex, amount) {
    const num = parseInt((hex || '#ffffff').replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
}

function drawAvatar(player, id, ip, alphaOverride) {
    const rx     = ip ? ip.x        : player.x;
    const ry     = ip ? ip.y        : player.y;
    const rAngle = ip ? ip.aimAngle : (player.aimAngle || 0);
    const radius = player.playerRadius || CONFIG.PLAYER_RADIUS || 20;
    const color  = player.color || '#45f3ff';
    const ctx    = state.ctx;
    const isMe   = socket && id === socket.id;
    const alpha  = alphaOverride !== undefined ? alphaOverride : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur  = isMe ? 22 : 12;

    ctx.beginPath();
    ctx.arc(rx, ry, radius, 0, TWO_PI);
    const grad = ctx.createRadialGradient(rx - radius * 0.3, ry - radius * 0.3, 0, rx, ry, radius);
    grad.addColorStop(0, lightenColor(color, 40));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fill();

    if (isMe) {
        ctx.lineWidth   = 3;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    }
    ctx.closePath();
    ctx.shadowBlur = 0;

    // Aim pointer
    const tipX = rx + Math.cos(rAngle) * (radius + 10);
    const tipY = ry + Math.sin(rAngle) * (radius + 10);
    ctx.beginPath();
    ctx.moveTo(rx + Math.cos(rAngle) * radius, ry + Math.sin(rAngle) * radius);
    ctx.lineTo(tipX, tipY);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 8;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    ctx.beginPath();
    ctx.arc(tipX, tipY, 3, 0, TWO_PI);
    ctx.fillStyle = '#fff';
    ctx.fill();

    if (player.isJackpotActive) {
        const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
        ctx.beginPath();
        ctx.arc(rx, ry, radius + 10, 0, TWO_PI);
        ctx.strokeStyle = `rgba(241,196,15,${pulse})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.closePath();
    }

    if (player.domainActive) {
        ctx.beginPath();
        ctx.arc(rx, ry, player.domainRadius || 200, 0, TWO_PI);
        ctx.strokeStyle = 'rgba(255,42,122,0.3)';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff2a7a'; ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.closePath();
    }

    ctx.restore();
}

function drawPlayers(playersData) {
    const ctx = state.ctx;
    for (const id in playersData) {
        const p  = playersData[id];
        if (!p || p.hp <= 0) continue;

        const ip    = state.interpolatedPlayers?.[id] || null;
        const isMe  = socket && id === socket.id;
        const rx    = ip ? ip.x : p.x;
        const ry    = ip ? ip.y : p.y;

        // FIX: Draw holographic clone (cloneOnDash card) before the real player
        if (p.clone) {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.arc(p.clone.x, p.clone.y, p.clone.radius || 20, 0, TWO_PI);
            const grad = ctx.createRadialGradient(
                p.clone.x, p.clone.y, 0,
                p.clone.x, p.clone.y, p.clone.radius || 20
            );
            grad.addColorStop(0, lightenColor(p.clone.color || '#45f3ff', 40));
            grad.addColorStop(1, p.clone.color || '#45f3ff');
            ctx.fillStyle = grad;
            ctx.shadowColor = p.clone.color || '#45f3ff';
            ctx.shadowBlur  = 18;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.closePath();
            ctx.restore();
        }

        // FIX: isInvisible (Stínový Dash card) — remote invisible players are
        // completely skipped so enemies can't see them. Own player is drawn
        // at low alpha (ghost) so the player can see themselves.
        if (p.isInvisible) {
            if (isMe) {
                drawAvatar(p, id, ip, 0.25); // own player: ghost
            }
            // Remote invisible players: draw nothing
            continue;
        }

        drawAvatar(p, id, ip, 1);

        // Name tag
        ctx.fillStyle = '#fff';
        ctx.font = '12px "Inter",sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur  = 4;
        ctx.fillText(p.name || 'Hráč', rx, ry - 30);
        ctx.shadowBlur = 0;

        // HP bar
        if (p.hp !== undefined && p.maxHp !== undefined) {
            const bw      = 44;
            const hpRatio = Math.max(0, p.hp / p.maxHp);
            const barX    = rx - bw / 2;
            const barY    = ry - 44;

            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(barX - 1, barY - 1, bw + 2, 7);

            const hpColor = hpRatio > 0.5 ? '#2ed573' : hpRatio > 0.25 ? '#f1c40f' : '#ff4757';
            ctx.fillStyle   = hpColor;
            ctx.shadowColor = hpColor;
            ctx.shadowBlur  = 4;
            ctx.fillRect(barX, barY, bw * hpRatio, 5);
            ctx.shadowBlur = 0;
        }
    }
}

// ─── BULLETS ─────────────────────────────────────────────────────────────────

function drawBullets() {
    const ctx = state.ctx;

    if (state.localBullets) {
        state.localBullets.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius || 5, 0, TWO_PI);
            ctx.fillStyle   = b.color || '#f1c40f';
            ctx.shadowColor = b.color || '#f1c40f';
            ctx.shadowBlur  = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.closePath();
        });
    }

    if (state.remoteBullets) {
        state.remoteBullets.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius || 5, 0, TWO_PI);
            ctx.fillStyle   = b.color || '#ff4757';
            ctx.shadowColor = b.color || '#ff4757';
            ctx.shadowBlur  = 8;
            ctx.fill();
            ctx.shadowBlur  = 0;
            ctx.closePath();
        });
    }
}

// ─── CROSSHAIR ───────────────────────────────────────────────────────────────

function drawCrosshair() {
    const mx  = state.currentMouseX;
    const my  = state.currentMouseY;
    if (mx == null || my == null) return;

    const shape = state.crosshairConfig?.shape || 'cross';
    const color = state.crosshairConfig?.color || '#45f3ff';
    const ctx   = state.ctx;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 6;

    if (shape === 'dot') {
        ctx.beginPath(); ctx.arc(mx, my, 3, 0, TWO_PI); ctx.fill();
    } else if (shape === 'circle') {
        ctx.beginPath(); ctx.arc(mx, my, 12, 0, TWO_PI); ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.moveTo(mx - 14, my); ctx.lineTo(mx -  6, my);
        ctx.moveTo(mx +  6, my); ctx.lineTo(mx + 14, my);
        ctx.moveTo(mx, my - 14); ctx.lineTo(mx, my -  6);
        ctx.moveTo(mx, my +  6); ctx.lineTo(mx, my + 14);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(mx, my, 2, 0, TWO_PI); ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
}

// ─── HUDs ────────────────────────────────────────────────────────────────────

function drawTabMenu(playersData) {
    const sorted = Object.values(playersData).sort((a, b) => (b.score || 0) - (a.score || 0));
    const w = 600, rowH = 60, headerH = 60;
    const h = headerH + sorted.length * rowH + 16;
    const ctx = state.ctx;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const x = (state.canvas.width  - w) / 2;
    const y = (state.canvas.height - h) / 2;

    ctx.fillStyle = 'rgba(9,10,15,0.94)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(69,243,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#45f3ff'; ctx.shadowBlur = 14;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#45f3ff';
    ctx.font = 'bold 14px "Orbitron",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TABULKA SKÓRE', state.canvas.width / 2, y + 36);

    ctx.fillStyle = '#555';
    ctx.font = '10px "Inter",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HRÁČ', x + 48, y + 54);
    ctx.textAlign = 'right';
    ctx.fillText('KARTY', x + w - 20, y + 54);

    let ry = y + headerH;
    sorted.forEach((p, i) => {
        if (i % 2 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(x + 1, ry, w - 2, rowH);
        }

        ctx.beginPath();
        ctx.arc(x + 22, ry + rowH / 2 - 6, 8, 0, TWO_PI);
        ctx.fillStyle = p.color || '#fff';
        ctx.fill();

        ctx.fillStyle = p.hp > 0 ? '#e8eaf0' : '#555';
        ctx.font = '14px "Inter",sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(
            `${p.hp > 0 ? '' : '💀 '}${p.name || 'Hráč'}${p.id === socket?.id ? ' (TY)' : ''}`,
            x + 40, ry + 22
        );

        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 15px "Orbitron",sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${p.score || 0}`, x + w - 20, ry + 22);

        // Picked card tags
        const RARITY_COLORS = {
            common:'#9e9e9e', uncommon:'#2ed573', rare:'#2a9df4',
            epic:'#a335ee', legendary:'#ffaa00', mythic:'#ff4757',
            exotic:'#eccc68', transcended:'#ff2a7a'
        };
        const cards = p.pickedCards || [];
        if (cards.length > 0) {
            let cx = x + 40;
            cards.slice(-8).forEach(card => {
                const col = RARITY_COLORS[card.rarity?.toLowerCase()] || '#888';
                const tw  = Math.min(ctx.measureText(card.name).width + 8, 120);
                ctx.fillStyle = `${col}33`;
                ctx.fillRect(cx, ry + 30, tw, 16);
                ctx.strokeStyle = col; ctx.lineWidth = 0.8;
                ctx.strokeRect(cx + 0.5, ry + 30.5, tw - 1, 15);
                ctx.fillStyle = col;
                ctx.font = '9px "Inter",sans-serif';
                ctx.textAlign = 'left';
                const display = card.name.length > 14 ? card.name.substring(0, 13) + '…' : card.name;
                ctx.fillText(display, cx + 4, ry + 41);
                cx += tw + 4;
            });
        }

        ry += rowH;
    });
    ctx.restore();
}

function drawDomainHUD(serverData) {
    const me = serverData.players && socket ? serverData.players[socket.id] : null;
    if (!me?.domainType) return;
    const ctx = state.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const x = 20, y = state.canvas.height - 96, w = 230, h = 76;
    ctx.fillStyle = 'rgba(9,10,15,0.82)';
    ctx.fillRect(x, y, w, h);
    const bc = me.domainActive ? '#ff2a7a' : (me.domainCooldown > 0 ? '#333' : '#45f3ff');
    ctx.strokeStyle = bc; ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    ctx.fillStyle = bc;
    ctx.font = 'bold 11px "Orbitron",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⚡ ${me.domainType.replace(/_/g, ' ')}`, x + 10, y + 22);

    if (me.domainActive) {
        ctx.fillStyle = '#ff2a7a';
        ctx.font = '13px "Inter",sans-serif';
        ctx.fillText('AKTIVNÍ', x + 10, y + 48);
    } else if (me.domainCooldown > 0) {
        ctx.fillStyle = '#888';
        ctx.font = '12px "Inter",sans-serif';
        ctx.fillText(`Cooldown: ${(me.domainCooldown / 1000).toFixed(1)}s`, x + 10, y + 48);
        const ratio = 1 - Math.min(1, me.domainCooldown / 15000);
        ctx.fillStyle = 'rgba(69,243,255,0.18)';
        ctx.fillRect(x + 1, y + 58, (w - 2) * ratio, 16);
    } else {
        ctx.fillStyle = '#45f3ff';
        ctx.font = '12px "Inter",sans-serif';
        ctx.fillText('Připraveno  [F]', x + 10, y + 48);
        ctx.fillStyle = 'rgba(69,243,255,0.12)';
        ctx.fillRect(x + 1, y + 58, w - 2, 16);
    }
    ctx.restore();
}

function drawDashHUD() {
    const dash = getDashState();
    const ctx  = state.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const w = 170, x = state.canvas.width - w - 20, y = state.canvas.height - 52, h = 32;
    ctx.fillStyle = 'rgba(9,10,15,0.82)';
    ctx.fillRect(x, y, w, h);

    if (dash.active) {
        ctx.fillStyle = '#45f3ff';
        ctx.shadowColor = '#45f3ff'; ctx.shadowBlur = 14;
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px "Orbitron",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ DASH', x + w / 2, y + h / 2 + 5);
    } else if (dash.cooldown > 0) {
        const ratio = 1 - dash.cooldown / dash.maxCooldown;
        ctx.fillStyle = 'rgba(69,243,255,0.2)';
        ctx.fillRect(x + 1, y + 1, (w - 2) * ratio, h - 2);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.fillStyle = '#888';
        ctx.font = '12px "Orbitron",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Dash  ${(dash.cooldown / 1000).toFixed(1)}s`, x + w / 2, y + h / 2 + 4);
    } else {
        ctx.strokeStyle = '#45f3ff'; ctx.lineWidth = 1.5;
        ctx.shadowColor = '#45f3ff'; ctx.shadowBlur = 6;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#45f3ff';
        ctx.font = 'bold 12px "Orbitron",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('DASH  [RMB] ✓', x + w / 2, y + h / 2 + 4);
    }
    ctx.restore();
}

function drawWinnerWaitScreen() {
    const ctx = state.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    const cx = state.canvas.width / 2;
    let cy = state.canvas.height / 2 - 80;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 48px "Orbitron",sans-serif';
    ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 28;
    ctx.fillText('🏆 VÍTĚZ KOLA!', cx, cy);
    ctx.shadowBlur = 0;
    cy += 50;

    const csd = state.cardSelectionData;
    if (csd) {
        const picked = csd.pickedCount || 0;
        const total  = csd.totalLosers || 0;

        ctx.fillStyle = '#6b7280';
        ctx.font = '18px "Inter",sans-serif';
        ctx.fillText(`${picked} / ${total} hráčů vybralo vylepšení`, cx, cy);
        cy += 36;

        const bw = 340, bh = 8, bx = cx - bw / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(bx, cy, bw, bh);
        ctx.fillStyle = '#45f3ff';
        ctx.shadowColor = '#45f3ff'; ctx.shadowBlur = 8;
        ctx.fillRect(bx, cy, bw * (total > 0 ? picked / total : 0), bh);
        ctx.shadowBlur = 0;
        cy += 30;

        const RARITY_COLORS = {
            common:'#9e9e9e', uncommon:'#2ed573', rare:'#2a9df4',
            epic:'#a335ee', legendary:'#ffaa00', mythic:'#ff4757',
            exotic:'#eccc68', transcended:'#ff2a7a'
        };

        (csd.loserData || []).forEach(loser => {
            const status = loser.picked ? `✔  ${loser.chosenCard || '?'}` : '⏳ vybírá…';
            const col    = loser.picked
                ? (RARITY_COLORS[loser.chosenRarity?.toLowerCase()] || '#45f3ff')
                : '#6b7280';

            ctx.fillStyle = loser.color || '#fff';
            ctx.font = 'bold 13px "Inter",sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(loser.name + ':', cx - 8, cy);
            ctx.fillStyle = col;
            ctx.font = '13px "Inter",sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(status, cx + 8, cy);
            cy += 24;
        });
    } else {
        ctx.fillStyle = '#6b7280';
        ctx.font = '18px "Inter",sans-serif';
        ctx.fillText('Hráči vybírají vylepšení…', cx, cy);
    }
    ctx.restore();
}

// ─── MAIN DRAW FUNCTION ──────────────────────────────────────────────────────

export function drawGame(serverData) {
    if (!state.canvas) {
        state.canvas = document.getElementById('game');
        if (state.canvas) state.ctx = state.canvas.getContext('2d');
    }
    if (!serverData || !state.ctx || !state.canvas) return;

    const playersData = serverData.players || {};
    state.canvas.style.cursor = serverData.gameState === 'PLAYING' ? 'none' : 'default';

    const cw = state.canvas.offsetWidth  || window.innerWidth;
    const ch = state.canvas.offsetHeight || window.innerHeight;
    if (state.canvas.width !== cw || state.canvas.height !== ch) {
        state.canvas.width = cw; state.canvas.height = ch;
    }

    state.ctx.fillStyle = '#000';
    state.ctx.fillRect(0, 0, cw, ch);

    const mapW = CONFIG.MAP_WIDTH  || 1920;
    const mapH = CONFIG.MAP_HEIGHT || 1080;

    state.gameScale   = Math.min(cw / mapW, ch / mapH);
    state.gameOffsetX = (cw - mapW * state.gameScale) / 2;
    state.gameOffsetY = (ch - mapH * state.gameScale) / 2;

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

    if (serverData.gameState === 'CARD_SELECTION') {
        const me = socket && playersData[socket.id];
        if (me && me.hp > 0) {
            if (state.playerInputs?.tab) {
                drawTabMenu(playersData);
            } else {
                drawWinnerWaitScreen();
            }
        }
    }

    if (serverData.gameState === 'SCOREBOARD') {
        const ctx = state.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.88)';
        ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px "Orbitron",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('KOLO SKONČILO', cw / 2, ch / 2);
    }
}