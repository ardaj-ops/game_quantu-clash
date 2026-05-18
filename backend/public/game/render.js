// game/render.js
import { state } from './state.js';
import { CONFIG } from '../gameConfig.js';
import { socket } from './network.js';
import { getDashState } from './physics.js';

const TWO_PI = Math.PI * 2;

// ─── PERFORMANCE: Offscreen canvas cache for static elements ─────────────────
let _gridCanvas = null;
let _gridValid  = false;

// ─── DOMAIN ANIMATION STATE ──────────────────────────────────────────────────
let _domainTime = 0;

// ─── TAB MENU STATE ──────────────────────────────────────────────────────────
let _tabMouseUnlocked  = false;  // toggled by button in tab menu
let _tabCardRegions    = [];     // [{x,y,w,h,card}] screen space

// ─── RARITY COLORS ───────────────────────────────────────────────────────────
const RARITY_COLORS = {
    common:'#9e9e9e', uncommon:'#2ed573', rare:'#2a9df4',
    epic:'#a335ee', legendary:'#ffaa00', mythic:'#ff4757',
    exotic:'#eccc68', transcended:'#ff2a7a'
};

// ─── BACKGROUND ──────────────────────────────────────────────────────────────
function drawGrid() {
    const W = CONFIG.MAP_WIDTH || 1920, H = CONFIG.MAP_HEIGHT || 1080;
    const ctx = state.ctx;

    // Cache grid on offscreen canvas — reuse every frame
    if (!_gridCanvas || !_gridValid) {
        _gridCanvas = document.createElement('canvas');
        _gridCanvas.width = W; _gridCanvas.height = H;
        const gc = _gridCanvas.getContext('2d');
        gc.strokeStyle = 'rgba(69,243,255,0.04)';
        gc.lineWidth = 1;
        const gs = 60;
        for (let x = 0; x <= W; x += gs) { gc.beginPath(); gc.moveTo(x,0); gc.lineTo(x,H); gc.stroke(); }
        for (let y = 0; y <= H; y += gs) { gc.beginPath(); gc.moveTo(0,y); gc.lineTo(W,y); gc.stroke(); }
        _gridValid = true;
    }
    ctx.drawImage(_gridCanvas, 0, 0);
}

function drawBackground() {
    const W = CONFIG.MAP_WIDTH || 1920, H = CONFIG.MAP_HEIGHT || 1080;
    const ctx = state.ctx;
    ctx.fillStyle = '#0d0f16';
    ctx.fillRect(0, 0, W, H);
    drawGrid();

    ctx.strokeStyle = '#45f3ff';
    ctx.lineWidth = 12;
    ctx.shadowColor = '#45f3ff'; ctx.shadowBlur = 24;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.strokeStyle = 'rgba(69,243,255,0.3)';
    ctx.lineWidth = 4; ctx.shadowBlur = 0;
    ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.shadowBlur = 0;
}

// ─── DOMAIN MAP-WIDE VISUAL EFFECTS ──────────────────────────────────────────
// Each domain paints the whole arena differently. Visual style matches the
// domain's theme: black hole for gravity, rotating guns for arsenal, etc.
function drawDomainMapEffect(activePlayers) {
    if (!activePlayers || activePlayers.length === 0) return;
    const W = CONFIG.MAP_WIDTH || 1920, H = CONFIG.MAP_HEIGHT || 1080;
    const ctx = state.ctx;
    _domainTime += 0.04;

    activePlayers.forEach(p => {
        if (!p.domainActive) return;
        ctx.save();

        switch (p.domainType) {

            case 'QUANTUM_PRISON': {
                // Blue distortion grid — lines wave sinusoidally
                const a = 0.09 + 0.06 * Math.abs(Math.sin(_domainTime * 2));
                ctx.strokeStyle = `rgba(42,157,244,${a})`;
                ctx.lineWidth = 1.5;
                for (let x = 0; x <= W; x += 80) {
                    const ox = Math.sin(_domainTime * 1.5 + x * 0.008) * 7;
                    ctx.beginPath(); ctx.moveTo(x + ox, 0); ctx.lineTo(x - ox, H); ctx.stroke();
                }
                for (let y = 0; y <= H; y += 80) {
                    const oy = Math.cos(_domainTime * 1.5 + y * 0.008) * 7;
                    ctx.beginPath(); ctx.moveTo(0, y + oy); ctx.lineTo(W, y - oy); ctx.stroke();
                }
                ctx.fillStyle = `rgba(42,157,244,0.06)`;
                ctx.fillRect(0, 0, W, H);
                _vignette(ctx, W, H, 42, 157, 244, 0.28);
                break;
            }

            case 'MADNESS_VEIL': {
                // Purple ripples across the whole map
                const wave = Math.sin(_domainTime * 3);
                ctx.fillStyle = `rgba(163,53,238,${0.07 + Math.abs(wave) * 0.07})`;
                ctx.fillRect(0, 0, W, H);
                ctx.strokeStyle = `rgba(163,53,238,${0.12 + Math.abs(wave) * 0.1})`;
                ctx.lineWidth = 2;
                for (let y = 0; y < H; y += 55) {
                    ctx.beginPath();
                    for (let x = 0; x <= W; x += 8) {
                        const oy = Math.sin(_domainTime * 4 + x * 0.012 + y * 0.006) * 13;
                        x === 0 ? ctx.moveTo(x, y + oy) : ctx.lineTo(x, y + oy);
                    }
                    ctx.stroke();
                }
                _vignette(ctx, W, H, 163, 53, 238, 0.42);
                break;
            }

            case 'BLOOD_ALTAR': {
                // Heartbeat red pulse
                const beat = Math.abs(Math.sin(_domainTime * 4.5));
                ctx.fillStyle = `rgba(255,0,50,${0.08 + beat * 0.10})`;
                ctx.fillRect(0, 0, W, H);
                // scan lines
                ctx.fillStyle = `rgba(180,0,30,${0.05 + beat * 0.04})`;
                for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
                _vignette(ctx, W, H, 255, 0, 50, 0.45 + beat * 0.15);
                break;
            }

            case 'GRAVITY_COLLAPSE': {
                // BLACK HOLE visual: spinning spiral arms + lens distortion rings
                const cx2 = p.x || W / 2, cy2 = p.y || H / 2;
                const spin = _domainTime * 1.2;

                // Concentric rings (event horizon)
                for (let ring = 0; ring < 4; ring++) {
                    const r = 60 + ring * 55 + Math.sin(_domainTime * 2 + ring) * 12;
                    const alpha = 0.25 - ring * 0.05;
                    ctx.beginPath();
                    ctx.arc(cx2, cy2, r, 0, TWO_PI);
                    ctx.strokeStyle = `rgba(241,196,15,${alpha})`;
                    ctx.lineWidth = 3 - ring * 0.5;
                    ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 10;
                    ctx.stroke(); ctx.shadowBlur = 0;
                }

                // Spiral arms
                ctx.strokeStyle = 'rgba(241,196,15,0.14)';
                ctx.lineWidth = 1;
                for (let arm = 0; arm < 3; arm++) {
                    ctx.beginPath();
                    for (let t = 0; t < 6; t += 0.08) {
                        const r2 = t * 70;
                        const a2 = t + spin + (arm / 3) * TWO_PI;
                        const sx = cx2 + Math.cos(a2) * r2;
                        const sy = cy2 + Math.sin(a2) * r2;
                        t < 0.08 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
                    }
                    ctx.stroke();
                }

                // Radial glow
                const grd = ctx.createRadialGradient(cx2, cy2, 10, cx2, cy2, 380);
                grd.addColorStop(0, 'rgba(241,196,15,0.20)');
                grd.addColorStop(0.4, 'rgba(241,196,15,0.05)');
                grd.addColorStop(1,   'rgba(0,0,0,0)');
                ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
                _vignette(ctx, W, H, 241, 196, 15, 0.25);
                break;
            }

            case 'MIRROR_SINGULARITY': {
                // Rainbow prism edge frames + shimmer
                const sh = 0.5 + 0.5 * Math.sin(_domainTime * 5);
                const prismaColors = ['255,0,0','255,128,0','255,255,0','0,255,80','69,243,255','163,53,238'];
                prismaColors.forEach((col, ci) => {
                    ctx.strokeStyle = `rgba(${col},${0.06 + sh * 0.05})`;
                    ctx.lineWidth = 4;
                    const off = ci * 5 + sh * 6;
                    ctx.strokeRect(off, off, W - off * 2, H - off * 2);
                });
                ctx.fillStyle = `rgba(69,243,255,${0.03 + sh * 0.03})`;
                ctx.fillRect(0, 0, W, H);
                _vignette(ctx, W, H, 69, 243, 255, 0.20);
                break;
            }

            case 'INFINITE_ARSENAL': {
                // ROTATING GUNS around the caster + shell casings raining everywhere
                const cx2 = p.x || W / 2, cy2 = p.y || H / 2;
                const gunCount = 6;
                const orbitR   = (p.domainRadius || 250) * 0.8;

                for (let gi = 0; gi < gunCount; gi++) {
                    const angle  = _domainTime * 2.5 + (gi / gunCount) * TWO_PI;
                    const gx     = cx2 + Math.cos(angle) * orbitR;
                    const gy     = cy2 + Math.sin(angle) * orbitR;
                    const aimAng = angle + Math.PI / 2;   // guns point tangentially

                    ctx.save();
                    ctx.translate(gx, gy);
                    ctx.rotate(aimAng);
                    ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 8;

                    // Gun body
                    ctx.fillStyle = '#ffaa00';
                    ctx.fillRect(-16, -5, 32, 10);
                    // Barrel
                    ctx.fillRect(14, -3, 12, 6);
                    // Stock
                    ctx.fillStyle = '#c87800';
                    ctx.fillRect(-28, -6, 14, 12);
                    // Muzzle flash
                    if (Math.sin(_domainTime * 20 + gi * 1.3) > 0.6) {
                        ctx.fillStyle = 'rgba(255,220,60,0.9)';
                        ctx.beginPath();
                        ctx.arc(26, 0, 6, 0, TWO_PI);
                        ctx.fill();
                    }
                    ctx.shadowBlur = 0;
                    ctx.restore();
                }

                // Raining shell casings
                ctx.fillStyle = 'rgba(255,170,0,0.45)';
                for (let i = 0; i < 18; i++) {
                    const t  = ((_domainTime * 0.6 + i * 0.056) % 1);
                    const sx = (i * 107 + Math.sin(_domainTime + i) * 60) % W;
                    const sy = t * H;
                    ctx.save(); ctx.translate(sx, sy); ctx.rotate(_domainTime * 3 + i);
                    ctx.fillRect(-3, -8, 6, 14);
                    ctx.restore();
                }
                ctx.fillStyle = 'rgba(255,170,0,0.05)'; ctx.fillRect(0, 0, W, H);
                _vignette(ctx, W, H, 255, 170, 0, 0.22);
                break;
            }

            case 'GAMBLER': {
                // Color-flicker arena + floating card suits
                const hue = (Math.sin(_domainTime * 7) * 0.5 + 0.5) * 360;
                const flicker = 0.05 + Math.abs(Math.sin(_domainTime * 8)) * 0.05;
                ctx.fillStyle = `hsla(${hue},80%,50%,${flicker})`;
                ctx.fillRect(0, 0, W, H);

                const suits = ['♠','♥','♦','♣'];
                ctx.globalAlpha = 0.09;
                for (let i = 0; i < 14; i++) {
                    const ang = (i / 14) * TWO_PI + _domainTime * 0.5;
                    const r   = 300 + Math.sin(_domainTime + i) * 60;
                    const fs  = 22 + Math.sin(_domainTime * 2 + i) * 6;
                    ctx.font = `${fs}px serif`;
                    ctx.fillStyle = (i % 2 === 0) ? '#f1c40f' : '#ff4757';
                    ctx.textAlign = 'center';
                    ctx.fillText(suits[i % 4], W/2 + Math.cos(ang)*r, H/2 + Math.sin(ang)*r);
                }
                ctx.globalAlpha = 1;
                _vignette(ctx, W, H, 46, 213, 115, 0.18);
                break;
            }
        }

        ctx.restore();
    });

    // Domain clash banner
    if (activePlayers.length >= 2) {
        const ctx = state.ctx;
        ctx.save();
        const names = activePlayers.map(p => p.domainType.replace(/_/g,' ')).join(' ✖ ');
        ctx.font = 'bold 14px "Orbitron",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff2a7a';
        ctx.shadowColor = '#ff2a7a'; ctx.shadowBlur = 16;
        ctx.fillText(`⚔ DOMAIN CLASH: ${names}`, (CONFIG.MAP_WIDTH||1920)/2, 32);
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

function _vignette(ctx, W, H, r, g, b, alpha) {
    const grd = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, `rgba(${r},${g},${b},${alpha})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
}

// ─── MAP OBJECTS ─────────────────────────────────────────────────────────────
function drawMapObjects(obstacles = [], breakables = []) {
    const ctx = state.ctx;
    obstacles.forEach(obs => {
        if (obs.isBorder || obs.x < -10 || obs.y < -10) return;
        ctx.fillStyle = '#1e2130';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeStyle = 'rgba(100,120,160,0.5)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(obs.x + 0.5, obs.y + 0.5, obs.width - 1, obs.height - 1);
        ctx.strokeStyle = 'rgba(200,220,255,0.08)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height); ctx.lineTo(obs.x, obs.y); ctx.lineTo(obs.x + obs.width, obs.y);
        ctx.stroke();
    });
    breakables.forEach(brk => {
        if (brk.destroyed) return;
        const ratio = Math.max(0, (brk.hp ?? 1) / (brk.maxHp ?? 1));
        ctx.fillStyle = `rgb(${Math.floor(200 + (1-ratio)*55)},${Math.floor(120*ratio)},${Math.floor(20*ratio)})`;
        ctx.fillRect(brk.x, brk.y, brk.width, brk.height);
        ctx.strokeStyle = ratio > 0.5 ? 'rgba(255,180,60,0.7)' : 'rgba(220,80,40,0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(brk.x + 0.5, brk.y + 0.5, brk.width - 1, brk.height - 1);
    });
}

// ─── PLAYERS ─────────────────────────────────────────────────────────────────
function lightenColor(hex, amount) {
    const num = parseInt((hex || '#ffffff').replace('#', ''), 16);
    return `rgb(${Math.min(255,(num>>16)+amount)},${Math.min(255,((num>>8)&0xff)+amount)},${Math.min(255,(num&0xff)+amount)})`;
}

function drawAvatar(player, id, ip, alphaOverride) {
    const rx     = ip ? ip.x        : player.x;
    const ry     = ip ? ip.y        : player.y;
    const rAngle = ip ? ip.aimAngle : (player.aimAngle || 0);
    const radius = player.playerRadius || 20;
    const color  = player.color || '#45f3ff';
    const ctx    = state.ctx;
    const isMe   = socket && id === socket.id;
    const alpha  = alphaOverride !== undefined ? alphaOverride : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color; ctx.shadowBlur = isMe ? 22 : 12;

    ctx.beginPath();
    ctx.arc(rx, ry, radius, 0, TWO_PI);
    const grad = ctx.createRadialGradient(rx - radius*0.3, ry - radius*0.3, 0, rx, ry, radius);
    grad.addColorStop(0, lightenColor(color, 40));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fill();

    if (isMe) { ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    ctx.closePath(); ctx.shadowBlur = 0;

    // Aim pointer
    const tipX = rx + Math.cos(rAngle) * (radius + 10);
    const tipY = ry + Math.sin(rAngle) * (radius + 10);
    ctx.beginPath();
    ctx.moveTo(rx + Math.cos(rAngle)*radius, ry + Math.sin(rAngle)*radius);
    ctx.lineTo(tipX, tipY);
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(tipX, tipY, 3, 0, TWO_PI); ctx.fillStyle = '#fff'; ctx.fill();

    if (player.isJackpotActive) {
        const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
        ctx.beginPath(); ctx.arc(rx, ry, radius + 10, 0, TWO_PI);
        ctx.strokeStyle = `rgba(241,196,15,${pulse})`; ctx.lineWidth = 3;
        ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 20; ctx.stroke(); ctx.shadowBlur = 0;
    }
    if (player.domainActive) {
        ctx.beginPath(); ctx.arc(rx, ry, player.domainRadius || 200, 0, TWO_PI);
        ctx.strokeStyle = 'rgba(255,42,122,0.3)'; ctx.lineWidth = 2;
        ctx.shadowColor = '#ff2a7a'; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
    }
    ctx.restore();
}

function drawPlayers(playersData) {
    const ctx = state.ctx;
    for (const id in playersData) {
        const p  = playersData[id];
        if (!p || p.hp <= 0) continue;
        const ip   = state.interpolatedPlayers?.[id] || null;
        const isMe = socket && id === socket.id;
        const rx   = ip ? ip.x : p.x;
        const ry   = ip ? ip.y : p.y;

        // Clone (Holografický Klon card)
        if (p.clone) {
            ctx.save(); ctx.globalAlpha = 0.30;
            ctx.beginPath(); ctx.arc(p.clone.x, p.clone.y, p.clone.radius || 20, 0, TWO_PI);
            const g = ctx.createRadialGradient(p.clone.x, p.clone.y, 0, p.clone.x, p.clone.y, p.clone.radius||20);
            g.addColorStop(0, lightenColor(p.clone.color||'#45f3ff', 40));
            g.addColorStop(1, p.clone.color||'#45f3ff');
            ctx.fillStyle = g; ctx.shadowColor = p.clone.color||'#45f3ff'; ctx.shadowBlur = 18;
            ctx.fill(); ctx.shadowBlur = 0; ctx.restore();
        }

        // Invisible player
        if (p.isInvisible) {
            if (isMe) drawAvatar(p, id, ip, 0.22);
            continue;
        }

        drawAvatar(p, id, ip, 1);

        // Name + boss crown
        ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
        if (p.isBoss) {
            ctx.font = 'bold 12px "Inter",sans-serif'; ctx.fillStyle = '#f1c40f';
            ctx.fillText('👑 ' + (p.name||'Boss'), rx, ry - 30);
        } else {
            ctx.font = '12px "Inter",sans-serif'; ctx.fillStyle = '#fff';
            ctx.fillText(p.name||'Hráč', rx, ry - 30);
        }
        ctx.shadowBlur = 0;

        // HP bar
        if (p.hp !== undefined && p.maxHp !== undefined) {
            const bw = 44, hpRatio = Math.max(0, p.hp / p.maxHp);
            const barX = rx - bw/2, barY = ry - 44;
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(barX-1, barY-1, bw+2, 7);
            const hpC = hpRatio > 0.5 ? '#2ed573' : hpRatio > 0.25 ? '#f1c40f' : '#ff4757';
            ctx.fillStyle = hpC; ctx.shadowColor = hpC; ctx.shadowBlur = 4;
            ctx.fillRect(barX, barY, bw * hpRatio, 5); ctx.shadowBlur = 0;
        }
    }
}

// ─── BULLETS ─────────────────────────────────────────────────────────────────
function drawBullets() {
    const ctx = state.ctx;
    [state.localBullets, state.remoteBullets].forEach((list, li) => {
        if (!list) return;
        list.forEach(b => {
            ctx.beginPath(); ctx.arc(b.x, b.y, b.radius || 5, 0, TWO_PI);
            ctx.fillStyle   = b.color || (li === 0 ? '#f1c40f' : '#ff4757');
            ctx.shadowColor = b.color || (li === 0 ? '#f1c40f' : '#ff4757');
            ctx.shadowBlur  = 10; ctx.fill(); ctx.shadowBlur = 0; ctx.closePath();
        });
    });
}

// ─── CROSSHAIR ───────────────────────────────────────────────────────────────
function drawCrosshair() {
    const mx = state.currentMouseX, my = state.currentMouseY;
    if (mx == null || my == null) return;
    const shape = state.crosshairConfig?.shape || 'cross';
    const color = state.crosshairConfig?.color || '#45f3ff';
    const ctx = state.ctx;
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
    ctx.shadowColor = color; ctx.shadowBlur = 6;
    if (shape === 'dot') {
        ctx.beginPath(); ctx.arc(mx, my, 3, 0, TWO_PI); ctx.fill();
    } else if (shape === 'circle') {
        ctx.beginPath(); ctx.arc(mx, my, 12, 0, TWO_PI); ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.moveTo(mx-14,my); ctx.lineTo(mx-6,my); ctx.moveTo(mx+6,my); ctx.lineTo(mx+14,my);
        ctx.moveTo(mx,my-14); ctx.lineTo(mx,my-6); ctx.moveTo(mx,my+6); ctx.lineTo(mx,my+14);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(mx, my, 2, 0, TWO_PI); ctx.fill();
    }
    ctx.shadowBlur = 0; ctx.restore();
}

// ─── CARD CHIP TOOLTIP ───────────────────────────────────────────────────────
function updateTabTooltip(mx, my) {
    let t = document.getElementById('tab-card-tooltip');
    if (!t) {
        t = document.createElement('div'); t.id = 'tab-card-tooltip';
        t.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;background:rgba(9,10,15,0.97);border:1px solid rgba(69,243,255,0.4);border-radius:10px;padding:10px 14px;max-width:260px;font-family:Inter,sans-serif;font-size:13px;color:#e8eaf0;display:none;line-height:1.5;box-shadow:0 4px 24px rgba(0,0,0,0.6)';
        document.body.appendChild(t);
    }
    const hit = _tabCardRegions.find(r => mx>=r.x && mx<=r.x+r.w && my>=r.y && my<=r.y+r.h);
    if (hit) {
        const col = RARITY_COLORS[hit.card.rarity?.toLowerCase()] || '#888';
        t.innerHTML = `<div style="color:${col};font-size:10px;font-weight:700;letter-spacing:1.5px;margin-bottom:4px;">${(hit.card.rarity||'').toUpperCase()}</div><div style="font-weight:600;font-size:14px;margin-bottom:6px;">${hit.card.name}</div><div style="color:#9ca3af;font-size:12px;">${hit.card.description||'—'}</div>`;
        t.style.display = 'block';
        let tx = mx+18, ty = my-20;
        if (tx+270 > window.innerWidth)  tx = mx-270-18;
        if (ty+140 > window.innerHeight) ty = window.innerHeight - 150;
        t.style.left = tx+'px'; t.style.top = ty+'px';
    } else { t.style.display = 'none'; }
}

function hideTabTooltip() {
    const t = document.getElementById('tab-card-tooltip');
    if (t) t.style.display = 'none';
    _tabCardRegions = [];
}

// Register mousemove once
if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', e => {
        if (state.playerInputs?.tab) updateTabTooltip(e.clientX, e.clientY);
    });
}

// ─── TAB MENU ────────────────────────────────────────────────────────────────
function drawTabMenu(playersData, serverData) {
    const sorted = Object.values(playersData).sort((a,b) => (b.score||0)-(a.score||0));
    const ctx    = state.ctx;
    const SW     = state.canvas.width, SH = state.canvas.height;
    const M      = 12;

    ctx.save(); ctx.setTransform(1,0,0,1,0,0);

    function panel(x, y, w, h, title) {
        ctx.fillStyle = 'rgba(9,10,15,0.96)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(69,243,255,0.4)'; ctx.lineWidth = 1.5;
        ctx.shadowColor = '#45f3ff'; ctx.shadowBlur = 10;
        ctx.strokeRect(x+0.5, y+0.5, w-1, h-1); ctx.shadowBlur = 0;
        ctx.fillStyle = '#45f3ff';
        ctx.font = 'bold 11px "Orbitron",sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(title, x+10, y+19);
        ctx.strokeStyle = 'rgba(69,243,255,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x+6,y+25); ctx.lineTo(x+w-6,y+25); ctx.stroke();
    }

    // ── Left: Score list ─────────────────────────────────────────────────────
    const LP_W = 300, LP_H = Math.max(180, 32+sorted.length*48+24);
    const LP_X = M, LP_Y = Math.max(M, (SH-LP_H)/2);
    panel(LP_X, LP_Y, LP_W, LP_H, `SKÓRE  ·  ${serverData?.gameMode||'FFA'}  ·  Cíl: ${serverData?.maxScore||25}`);

    sorted.forEach((p, i) => {
        const ry = LP_Y + 32 + i * 48;
        if (i%2===0) { ctx.fillStyle='rgba(255,255,255,0.02)'; ctx.fillRect(LP_X+2,ry,LP_W-4,46); }
        ctx.beginPath(); ctx.arc(LP_X+18, ry+16, 9, 0, TWO_PI);
        ctx.fillStyle = p.color||'#fff'; ctx.shadowColor=p.color; ctx.shadowBlur=p.isBoss?12:0; ctx.fill(); ctx.shadowBlur=0;
        if (p.isBoss) { ctx.font='10px serif'; ctx.textAlign='center'; ctx.fillStyle='#f1c40f'; ctx.fillText('👑', LP_X+18, ry+7); }
        ctx.fillStyle = p.hp<=0 ? '#555' : '#e8eaf0';
        ctx.font = (p.isBoss?'bold ':'')+'12px "Inter",sans-serif'; ctx.textAlign='left';
        ctx.fillText((p.hp<=0?'💀 ':'')+p.name+(p.id===socket?.id?' (TY)':''), LP_X+34, ry+14);
        ctx.fillStyle='#f1c40f'; ctx.font='bold 15px "Orbitron",sans-serif';
        ctx.fillText(p.score||0, LP_X+34, ry+36);
        ctx.fillStyle='#555'; ctx.font='9px "Inter",sans-serif'; ctx.fillText('kola', LP_X+34+(String(p.score||0).length*9)+3, ry+35);
        // HP bar
        const hpR=Math.max(0,(p.hp||0)/(p.maxHp||100));
        const hpC=hpR>0.5?'#2ed573':hpR>0.25?'#f1c40f':'#ff4757';
        ctx.fillStyle='#1a1c24'; ctx.fillRect(LP_X+90,ry+28,160,5);
        ctx.fillStyle=hpC; ctx.fillRect(LP_X+90,ry+28,160*hpR,5);
        ctx.fillStyle='#555'; ctx.font='8px "Inter",sans-serif';
        ctx.fillText(`HP ${Math.round(p.hp||0)}/${p.maxHp||100}`, LP_X+256, ry+34);
    });

    // ── Right: Full stat bars (my player) ───────────────────────────────────
    const me = socket && playersData[socket.id];
    const RP_W = 270;
    const RP_X = SW - M - RP_W;
    const ALL_STATS = [
        { key:'hp',          label:'HP',          max:600,  color:'#2ed573', inv:false, fmt:v=>`${Math.round(v)}/${me?.maxHp||100}` },
        { key:'damage',      label:'Poškození',   max:200,  color:'#ff4757', inv:false, fmt:v=>Math.round(v) },
        { key:'moveSpeed',   label:'Rychlost',    max:3.5,  color:'#45f3ff', inv:false, fmt:v=>v.toFixed(2) },
        { key:'fireRate',    label:'Kadence (ms)',max:1200, color:'#f1c40f', inv:true,  fmt:v=>Math.round(v) },
        { key:'bulletSpeed', label:'Rychl. kulky',max:80,   color:'#a335ee', inv:false, fmt:v=>Math.round(v) },
        { key:'maxAmmo',     label:'Max munice',  max:30,   color:'#f1c40f', inv:false, fmt:v=>Math.round(v) },
        { key:'reloadTime',  label:'Přebíjení(ms)',max:3000,color:'#ff6348', inv:true,  fmt:v=>Math.round(v) },
        { key:'bounces',     label:'Odrazy',      max:10,   color:'#2a9df4', inv:false, fmt:v=>Math.round(v) },
        { key:'pierce',      label:'Průraz',      max:10,   color:'#a335ee', inv:false, fmt:v=>Math.round(v) },
        { key:'lifesteal',   label:'Lifesteal',   max:0.5,  color:'#ff2a7a', inv:false, fmt:v=>(v*100).toFixed(0)+'%' },
        { key:'hpRegen',     label:'HP regen/s',  max:20,   color:'#2ed573', inv:false, fmt:v=>v.toFixed(1) },
        { key:'multishot',   label:'Multishot',   max:5,    color:'#ffaa00', inv:false, fmt:v=>Math.round(v) },
    ];
    const RP_H = 32 + ALL_STATS.length * 22 + 16;
    const RP_Y = Math.max(M, (SH-RP_H)/2);
    panel(RP_X, RP_Y, RP_W, RP_H, 'STATY  ·  MŮJ HRÁČ');

    if (me) {
        ALL_STATS.forEach((s, si) => {
            const val  = me[s.key] !== undefined ? me[s.key] : 0;
            const barY = RP_Y + 30 + si * 22;
            const bW   = 110, bX = RP_X + 128;
            const ratio = s.inv ? Math.max(0, 1 - val/s.max) : Math.min(1, val/s.max);
            ctx.fillStyle='#888'; ctx.font='9px "Inter",sans-serif'; ctx.textAlign='right';
            ctx.fillText(s.label, RP_X+123, barY+9);
            ctx.fillStyle='#1a1c24'; ctx.fillRect(bX, barY, bW, 7);
            ctx.fillStyle=s.color; ctx.shadowColor=s.color; ctx.shadowBlur=3;
            ctx.fillRect(bX, barY, bW*ratio, 7); ctx.shadowBlur=0;
            ctx.fillStyle=s.color; ctx.font='bold 9px "Inter",sans-serif'; ctx.textAlign='left';
            ctx.fillText(s.fmt(val), bX+bW+4, barY+8);
        });
    } else {
        ctx.fillStyle='#555'; ctx.font='11px "Inter",sans-serif'; ctx.textAlign='center';
        ctx.fillText('(Nejsi ve hře)', RP_X+RP_W/2, RP_Y+80);
    }

    // ── Middle: Card history ─────────────────────────────────────────────────
    const CHIP_W=20, CHIP_H=15, CPR=10;
    const MP_W = SW - LP_W - RP_W - M*4;
    const MP_X = LP_X + LP_W + M;
    const maxCards  = Math.max(1, ...sorted.map(p=>(p.pickedCards||[]).length));
    const chipRows  = Math.max(1, Math.ceil(maxCards/CPR));
    const perPlayer = 24 + chipRows*(CHIP_H+3);
    const MP_H = 32 + sorted.length*perPlayer + 10;
    const MP_Y = Math.max(M, (SH-MP_H)/2);

    if (MP_W > 140) {
        panel(MP_X, MP_Y, MP_W, MP_H, 'KARTY CELKEM');
        _tabCardRegions = [];

        sorted.forEach((p, i) => {
            const ry = MP_Y + 30 + i*perPlayer;
            if (i%2===0) { ctx.fillStyle='rgba(255,255,255,0.02)'; ctx.fillRect(MP_X+2,ry,MP_W-4,perPlayer-2); }
            ctx.beginPath(); ctx.arc(MP_X+12, ry+10, 6, 0, TWO_PI);
            ctx.fillStyle=p.color||'#fff'; ctx.fill();
            ctx.fillStyle='#aaa'; ctx.font='10px "Inter",sans-serif'; ctx.textAlign='left';
            ctx.fillText(p.name+(p.id===socket?.id?' (TY)':''), MP_X+24, ry+14);
            const cards = p.pickedCards||[];
            if (cards.length===0) {
                ctx.fillStyle='#333'; ctx.font='9px "Inter",sans-serif';
                ctx.fillText('žádné karty', MP_X+12, ry+28);
            } else {
                cards.forEach((card, ci) => {
                    const col = RARITY_COLORS[card.rarity?.toLowerCase()]||'#888';
                    const cr=Math.floor(ci/CPR), cc=ci%CPR;
                    const cx2=MP_X+12+cc*(CHIP_W+2), cy2=ry+18+cr*(CHIP_H+3);
                    ctx.fillStyle=col+'28'; ctx.fillRect(cx2,cy2,CHIP_W,CHIP_H);
                    ctx.strokeStyle=col; ctx.lineWidth=0.8;
                    ctx.strokeRect(cx2+0.5,cy2+0.5,CHIP_W-1,CHIP_H-1);
                    ctx.fillStyle=col; ctx.font='bold 7px "Inter",sans-serif'; ctx.textAlign='center';
                    ctx.fillText((card.name||'?')[0].toUpperCase(), cx2+CHIP_W/2, cy2+10);
                    _tabCardRegions.push({ x:cx2, y:cy2, w:CHIP_W, h:CHIP_H, card });
                });
            }
        });
    }

    // ── MOUSE UNLOCK BUTTON ──────────────────────────────────────────────────
    // Lets the player move their cursor freely over cards to see tooltips
    const btnW=180, btnH=32, btnX=SW/2-btnW/2, btnY=SH-M-btnH;
    ctx.fillStyle = _tabMouseUnlocked ? 'rgba(69,243,255,0.2)' : 'rgba(255,255,255,0.07)';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = _tabMouseUnlocked ? '#45f3ff' : '#555'; ctx.lineWidth=1;
    ctx.strokeRect(btnX+0.5, btnY+0.5, btnW-1, btnH-1);
    ctx.fillStyle = _tabMouseUnlocked ? '#45f3ff' : '#888';
    ctx.font = '10px "Orbitron",sans-serif'; ctx.textAlign='center';
    ctx.fillText(
        _tabMouseUnlocked ? '🔓 KURZOR ODEMKNUT' : '🔒 ODEMKNOUT KURZOR',
        SW/2, btnY+btnH/2+4
    );

    // Store unlock button region in a global for click handling
    state._tabUnlockBtn = { x:btnX, y:btnY, w:btnW, h:btnH };

    ctx.restore();
}

// ─── DOMAIN HUD ───────────────────────────────────────────────────────────────
function drawDomainHUD(serverData) {
    const me = serverData.players && socket ? serverData.players[socket.id] : null;
    if (!me?.domainType) return;
    const ctx = state.ctx;
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    const x=20, y=state.canvas.height-96, w=230, h=76;
    ctx.fillStyle='rgba(9,10,15,0.82)'; ctx.fillRect(x,y,w,h);
    const bc = me.domainActive ? '#ff2a7a' : (me.domainCooldown>0 ? '#333' : '#45f3ff');
    ctx.strokeStyle=bc; ctx.lineWidth=1.5; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
    ctx.fillStyle=bc; ctx.font='bold 11px "Orbitron",sans-serif'; ctx.textAlign='left';
    ctx.fillText(`⚡ ${me.domainType.replace(/_/g,' ')}`, x+10, y+22);
    if (me.domainActive) {
        ctx.fillStyle='#ff2a7a'; ctx.font='13px "Inter",sans-serif';
        ctx.fillText('AKTIVNÍ', x+10, y+48);
        const prog = 1 - Math.max(0, me.domainTimer||0) / ((me.domainDuration||5000));
        ctx.fillStyle='rgba(255,42,122,0.2)'; ctx.fillRect(x+1,y+58,(w-2)*prog,16);
    } else if (me.domainCooldown>0) {
        ctx.fillStyle='#888'; ctx.font='12px "Inter",sans-serif';
        ctx.fillText(`Cooldown: ${(me.domainCooldown/1000).toFixed(1)}s`, x+10, y+48);
        const ratio = 1 - Math.min(1, me.domainCooldown/15000);
        ctx.fillStyle='rgba(69,243,255,0.18)'; ctx.fillRect(x+1,y+58,(w-2)*ratio,16);
    } else {
        ctx.fillStyle='#45f3ff'; ctx.font='12px "Inter",sans-serif';
        ctx.fillText('Připraveno  [F]', x+10, y+48);
        ctx.fillStyle='rgba(69,243,255,0.12)'; ctx.fillRect(x+1,y+58,w-2,16);
    }
    ctx.restore();
}

// ─── DASH HUD ────────────────────────────────────────────────────────────────
function drawDashHUD() {
    const dash = getDashState();
    const ctx  = state.ctx;
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    const w=170, x=state.canvas.width-w-20, y=state.canvas.height-52, h=32;
    ctx.fillStyle='rgba(9,10,15,0.82)'; ctx.fillRect(x,y,w,h);
    if (dash.active) {
        ctx.fillStyle='#45f3ff'; ctx.shadowColor='#45f3ff'; ctx.shadowBlur=14;
        ctx.fillRect(x+1,y+1,w-2,h-2); ctx.shadowBlur=0;
        ctx.fillStyle='#000'; ctx.font='bold 12px "Orbitron",sans-serif'; ctx.textAlign='center';
        ctx.fillText('⚡ DASH', x+w/2, y+h/2+5);
    } else if (dash.cooldown>0) {
        const r = 1 - dash.cooldown/dash.maxCooldown;
        ctx.fillStyle='rgba(69,243,255,0.2)'; ctx.fillRect(x+1,y+1,(w-2)*r,h-2);
        ctx.strokeStyle='#333'; ctx.lineWidth=1; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
        ctx.fillStyle='#888'; ctx.font='12px "Orbitron",sans-serif'; ctx.textAlign='center';
        ctx.fillText(`Dash  ${(dash.cooldown/1000).toFixed(1)}s`, x+w/2, y+h/2+4);
    } else {
        ctx.strokeStyle='#45f3ff'; ctx.lineWidth=1.5; ctx.shadowColor='#45f3ff'; ctx.shadowBlur=6;
        ctx.strokeRect(x+0.5,y+0.5,w-1,h-1); ctx.shadowBlur=0;
        ctx.fillStyle='#45f3ff'; ctx.font='bold 12px "Orbitron",sans-serif'; ctx.textAlign='center';
        ctx.fillText('DASH  [RMB] ✓', x+w/2, y+h/2+4);
    }
    ctx.restore();
}

// ─── WINNER WAIT SCREEN ───────────────────────────────────────────────────────
function drawWinnerWaitScreen() {
    const ctx = state.ctx;
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle='rgba(0,0,0,0.78)'; ctx.fillRect(0,0,state.canvas.width,state.canvas.height);
    const cx=state.canvas.width/2;
    let cy=state.canvas.height/2-80;
    ctx.textAlign='center';
    ctx.fillStyle='#f1c40f'; ctx.font='bold 48px "Orbitron",sans-serif';
    ctx.shadowColor='#f1c40f'; ctx.shadowBlur=28; ctx.fillText('🏆 VÍTĚZ KOLA!', cx, cy); ctx.shadowBlur=0; cy+=52;
    const csd = state.cardSelectionData;
    if (csd) {
        const picked=csd.pickedCount||0, total=csd.totalLosers||0;
        ctx.fillStyle='#6b7280'; ctx.font='18px "Inter",sans-serif';
        ctx.fillText(`${picked} / ${total} hráčů vybralo vylepšení`, cx, cy); cy+=36;
        const bw=340, bh=8, bx=cx-bw/2;
        ctx.fillStyle='rgba(255,255,255,0.08)'; ctx.fillRect(bx,cy,bw,bh);
        ctx.fillStyle='#45f3ff'; ctx.shadowColor='#45f3ff'; ctx.shadowBlur=8;
        ctx.fillRect(bx,cy,bw*(total>0?picked/total:0),bh); ctx.shadowBlur=0; cy+=30;
        (csd.loserData||[]).forEach(loser => {
            const col = loser.picked ? (RARITY_COLORS[loser.chosenRarity?.toLowerCase()]||'#45f3ff') : '#6b7280';
            const status = loser.picked ? `✔  ${loser.chosenCard||'?'}` : '⏳ vybírá…';
            ctx.fillStyle=loser.color||'#fff'; ctx.font='bold 13px "Inter",sans-serif'; ctx.textAlign='right';
            ctx.fillText(loser.name+':', cx-8, cy);
            ctx.fillStyle=col; ctx.font='13px "Inter",sans-serif'; ctx.textAlign='left';
            ctx.fillText(status, cx+8, cy); cy+=24;
        });
    }
    ctx.restore();
}

// ─── CLICK HANDLER for tab unlock button ─────────────────────────────────────
if (typeof window !== 'undefined') {
    window.addEventListener('mousedown', (e) => {
        if (!state.playerInputs?.tab) return;
        const btn = state._tabUnlockBtn;
        if (!btn) return;
        if (e.clientX>=btn.x && e.clientX<=btn.x+btn.w && e.clientY>=btn.y && e.clientY<=btn.y+btn.h) {
            _tabMouseUnlocked = !_tabMouseUnlocked;
            // Lock/unlock the game cursor
            if (_tabMouseUnlocked) {
                const canvas = document.getElementById('game');
                if (canvas) canvas.style.cursor = 'default';
            }
        }
    });
    window.addEventListener('keyup', (e) => {
        if (e.key === 'Tab') {
            _tabMouseUnlocked = false;
            hideTabTooltip();
        }
    });
}

// ─── MAIN DRAW ───────────────────────────────────────────────────────────────
export function drawGame(serverData) {
    if (!state.canvas) {
        state.canvas = document.getElementById('game');
        if (state.canvas) state.ctx = state.canvas.getContext('2d');
    }
    if (!serverData || !state.ctx || !state.canvas) return;

    const playersData = serverData.players || {};
    const isPlaying   = serverData.gameState === 'PLAYING';

    // Update canvas cursor based on tab unlock state
    state.canvas.style.cursor = (isPlaying && !_tabMouseUnlocked && !state.playerInputs?.tab)
        ? 'none' : 'default';

    const cw = state.canvas.offsetWidth  || window.innerWidth;
    const ch = state.canvas.offsetHeight || window.innerHeight;
    if (state.canvas.width !== cw || state.canvas.height !== ch) {
        state.canvas.width = cw; state.canvas.height = ch;
        _gridValid = false; // invalidate cached grid on resize
    }

    const mapW = CONFIG.MAP_WIDTH||1920, mapH = CONFIG.MAP_HEIGHT||1080;
    state.gameScale   = Math.min(cw/mapW, ch/mapH);
    state.gameOffsetX = (cw - mapW * state.gameScale) / 2;
    state.gameOffsetY = (ch - mapH * state.gameScale) / 2;

    state.ctx.fillStyle = '#000';
    state.ctx.fillRect(0, 0, cw, ch);

    state.ctx.save();
    state.ctx.translate(state.gameOffsetX, state.gameOffsetY);
    state.ctx.scale(state.gameScale, state.gameScale);

    drawBackground();

    // Domain map-wide effects (in world space)
    const activeDomainPlayers = Object.values(playersData).filter(p => p.domainActive);
    if (activeDomainPlayers.length > 0) drawDomainMapEffect(activeDomainPlayers);

    drawMapObjects(state.localObstacles||[], state.localBreakables||[]);

    if (serverData.gameState !== 'LOBBY') {
        drawPlayers(playersData);
        drawBullets();
    }

    state.ctx.restore();

    // HUD (screen space)
    if (isPlaying) {
        if (state.playerInputs?.tab) {
            drawTabMenu(playersData, serverData);
        } else {
            hideTabTooltip();
            drawCrosshair();
            drawDomainHUD(serverData);
            drawDashHUD();
        }
    }

    if (serverData.gameState === 'CARD_SELECTION') {
        const me = socket && playersData[socket.id];
        if (state.playerInputs?.tab) {
            drawTabMenu(playersData, serverData);
        } else {
            hideTabTooltip();
            if (!me || me.hp > 0) drawWinnerWaitScreen();
        }
    }

    if (serverData.gameState === 'SCOREBOARD') {
        state.ctx.fillStyle = 'rgba(0,0,0,0.88)';
        state.ctx.fillRect(0, 0, cw, ch);
        state.ctx.fillStyle = '#fff'; state.ctx.font = 'bold 48px "Orbitron",sans-serif';
        state.ctx.textAlign = 'center'; state.ctx.fillText('KOLO SKONČILO', cw/2, ch/2);
    }
}
