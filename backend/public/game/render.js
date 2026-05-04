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


// ─── DOMAIN MAP EFFECTS ───────────────────────────────────────────────────────
// Renders full-arena visual overlays when a domain is active.
// Called inside the scaled ctx (world space), before players are drawn.
// Each domain type has a distinct visual signature; clashing domains blend them.

let _domainTime = 0; // animation clock

function drawDomainMapEffect(mapEffect) {
    if (!mapEffect) return;
    const W   = CONFIG.MAP_WIDTH  || 1920;
    const H   = CONFIG.MAP_HEIGHT || 1080;
    const ctx = state.ctx;
    _domainTime += 0.05;

    const effects = mapEffect.type === 'CLASH' ? mapEffect.effects : [mapEffect];

    effects.forEach(fx => {
        if (!fx) return;
        ctx.save();

        switch (fx.type) {

            case 'QUANTUM_PRISON': {
                // Pulsing blue grid distortion overlay
                const pulse = 0.5 + 0.5 * Math.sin(_domainTime * 2);
                ctx.strokeStyle = `rgba(42,157,244,${0.12 + pulse * 0.08})`;
                ctx.lineWidth = 1;
                const gs = 80;
                for (let x = 0; x <= W; x += gs) {
                    ctx.beginPath();
                    ctx.moveTo(x + Math.sin(_domainTime + x * 0.01) * 4, 0);
                    ctx.lineTo(x + Math.sin(_domainTime + x * 0.01 + 3) * 4, H);
                    ctx.stroke();
                }
                for (let y = 0; y <= H; y += gs) {
                    ctx.beginPath();
                    ctx.moveTo(0, y + Math.cos(_domainTime + y * 0.01) * 4);
                    ctx.lineTo(W, y + Math.cos(_domainTime + y * 0.01 + 3) * 4);
                    ctx.stroke();
                }
                // Full tint
                ctx.fillStyle = fx.tint || 'rgba(42,157,244,0.10)';
                ctx.fillRect(0, 0, W, H);
                // Vignette
                drawVignette(ctx, W, H, fx.vignette || '#2a9df4', 0.35 + pulse * 0.1);
                break;
            }

            case 'MADNESS_VEIL': {
                // Wavy purple corruption
                const wave = Math.sin(_domainTime * 3) * 0.5;
                ctx.fillStyle = `rgba(163,53,238,${0.08 + Math.abs(wave) * 0.08})`;
                ctx.fillRect(0, 0, W, H);
                // Sinusoidal noise bands
                ctx.strokeStyle = `rgba(163,53,238,${0.15 + Math.abs(wave) * 0.1})`;
                ctx.lineWidth = 2;
                for (let y = 0; y < H; y += 60) {
                    ctx.beginPath();
                    for (let x = 0; x <= W; x += 8) {
                        const oy = Math.sin(_domainTime * 4 + x * 0.015 + y * 0.005) * 12;
                        if (x === 0) ctx.moveTo(x, y + oy);
                        else         ctx.lineTo(x, y + oy);
                    }
                    ctx.stroke();
                }
                drawVignette(ctx, W, H, fx.vignette || '#a335ee', 0.45);
                break;
            }

            case 'BLOOD_ALTAR': {
                // Pulsing red heartbeat
                const beat = Math.abs(Math.sin(_domainTime * 4));
                ctx.fillStyle = `rgba(255,0,50,${0.10 + beat * 0.12})`;
                ctx.fillRect(0, 0, W, H);
                // Red scan lines
                ctx.fillStyle = `rgba(200,0,30,${0.06 + beat * 0.04})`;
                for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
                drawVignette(ctx, W, H, fx.vignette || '#ff0032', 0.55 + beat * 0.15);
                break;
            }

            case 'GRAVITY_COLLAPSE': {
                // Gravitational lens lines converging on player position
                const cx2 = fx.cx || W / 2;
                const cy2 = fx.cy || H / 2;
                const spin = _domainTime * 0.8;
                ctx.strokeStyle = `rgba(241,196,15,0.12)`;
                ctx.lineWidth = 1;
                for (let i = 0; i < 24; i++) {
                    const angle = (i / 24) * Math.PI * 2 + spin;
                    const startX = cx2 + Math.cos(angle) * W;
                    const startY = cy2 + Math.sin(angle) * H;
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(cx2 + Math.cos(angle + 0.15) * 60, cy2 + Math.sin(angle + 0.15) * 60);
                    ctx.stroke();
                }
                // Central glow
                const grd = ctx.createRadialGradient(cx2, cy2, 20, cx2, cy2, 350);
                grd.addColorStop(0, 'rgba(241,196,15,0.25)');
                grd.addColorStop(1, 'rgba(241,196,15,0)');
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, W, H);
                drawVignette(ctx, W, H, fx.vignette || '#f1c40f', 0.30);
                break;
            }

            case 'MIRROR_SINGULARITY': {
                // Prism rainbow edges + mirror shimmer
                const shimmer = 0.5 + 0.5 * Math.sin(_domainTime * 5);
                const colors = ['rgba(255,0,0,', 'rgba(255,128,0,', 'rgba(255,255,0,',
                                'rgba(0,255,100,', 'rgba(69,243,255,', 'rgba(163,53,238,'];
                colors.forEach((col, ci) => {
                    ctx.strokeStyle = col + (0.06 + shimmer * 0.04) + ')';
                    ctx.lineWidth = 3;
                    const offset = ci * 4 + shimmer * 6;
                    ctx.strokeRect(offset, offset, W - offset*2, H - offset*2);
                });
                ctx.fillStyle = `rgba(69,243,255,${0.04 + shimmer * 0.04})`;
                ctx.fillRect(0, 0, W, H);
                drawVignette(ctx, W, H, fx.vignette || '#45f3ff', 0.25);
                break;
            }

            case 'INFINITE_ARSENAL': {
                // Golden shells raining across arena
                const shellCount = 16;
                ctx.fillStyle = 'rgba(255,170,0,0.55)';
                for (let i = 0; i < shellCount; i++) {
                    const t   = ((_domainTime * 0.6 + i / shellCount) % 1);
                    const sx  = (i / shellCount) * W + Math.sin(_domainTime + i) * 60;
                    const sy  = t * H;
                    ctx.save();
                    ctx.translate(sx, sy);
                    ctx.rotate(_domainTime + i);
                    ctx.fillRect(-3, -8, 6, 16);
                    ctx.restore();
                }
                ctx.fillStyle = 'rgba(255,170,0,0.07)';
                ctx.fillRect(0, 0, W, H);
                drawVignette(ctx, W, H, fx.vignette || '#ffaa00', 0.28);
                break;
            }

            case 'GAMBLER': {
                // Color-flicker randomized arena hue
                const hue   = (Math.sin(_domainTime * 7) * 0.5 + 0.5) * 360;
                const alpha = 0.07 + Math.abs(Math.sin(_domainTime * 6)) * 0.06;
                ctx.fillStyle = `hsla(${hue},80%,50%,${alpha})`;
                ctx.fillRect(0, 0, W, H);
                // Card suit symbols scattered
                const suits = ['♠','♥','♦','♣'];
                ctx.font = '28px serif';
                ctx.globalAlpha = 0.08;
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2 + _domainTime * 0.4;
                    const r = 350;
                    ctx.fillStyle = (i%2===0) ? '#f1c40f' : '#ff4757';
                    ctx.fillText(suits[i%4], W/2 + Math.cos(angle)*r, H/2 + Math.sin(angle)*r);
                }
                ctx.globalAlpha = 1;
                drawVignette(ctx, W, H, fx.vignette || '#2ed573', 0.22);
                break;
            }
        }

        ctx.restore();
    });

    // CLASH label overlay (top-center)
    if (mapEffect.type === 'CLASH' && mapEffect.effects?.length >= 2) {
        ctx.save();
        ctx.font = 'bold 16px "Orbitron",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,42,122,0.9)';
        ctx.shadowColor = '#ff2a7a'; ctx.shadowBlur = 14;
        const names = mapEffect.effects.map(e => e.label || e.type).join(' ✖ ');
        ctx.fillText('⚔ DOMAIN CLASH: ' + names, W / 2, 36);
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

function buildMapEffect(activePlayers) {
    if (!activePlayers || activePlayers.length === 0) return null;
    if (activePlayers.length === 1) {
        const p = activePlayers[0];
        return { type: p.domainType, tint: 'rgba(0,0,0,0)', cx: p.x, cy: p.y, label: p.domainType.replace(/_/g,' ') };
    }
    return { type: 'CLASH', effects: activePlayers.map(p => ({ type: p.domainType, cx: p.x, cy: p.y, label: p.domainType.replace(/_/g,' ') })) };
}

function drawVignette(ctx, W, H, color, alpha) {
    const grd = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, color.startsWith('#')
        ? hexToRgba(color, alpha)
        : color.replace(/,[^,)]+\)$/, `,${alpha})`));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
}

function hexToRgba(hex, a) {
    const n = parseInt(hex.replace('#',''), 16);
    return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`;
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

// ─── TAB MENU CARD TOOLTIP (HTML overlay, updates on mousemove) ──────────────
// We store card hit-regions so the mouse handler can show tooltips.
let _tabCardRegions = []; // [{x,y,w,h,card}] in screen space

function updateTabTooltip(mx, my) {
    let tooltip = document.getElementById('tab-card-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'tab-card-tooltip';
        tooltip.style.cssText = [
            'position:fixed', 'z-index:9999', 'pointer-events:none',
            'background:rgba(9,10,15,0.97)', 'border:1px solid rgba(69,243,255,0.4)',
            'border-radius:10px', 'padding:10px 14px', 'max-width:240px',
            'font-family:"Inter",sans-serif', 'font-size:13px',
            'color:#e8eaf0', 'display:none', 'line-height:1.5',
            'box-shadow:0 4px 24px rgba(0,0,0,0.6)'
        ].join(';');
        document.body.appendChild(tooltip);
    }

    const hit = _tabCardRegions.find(r =>
        mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h
    );
    if (hit) {
        const RARITY_COLORS = {
            common:'#9e9e9e', uncommon:'#2ed573', rare:'#2a9df4',
            epic:'#a335ee', legendary:'#ffaa00', mythic:'#ff4757',
            exotic:'#eccc68', transcended:'#ff2a7a'
        };
        const col = RARITY_COLORS[hit.card.rarity?.toLowerCase()] || '#888';
        tooltip.innerHTML = `
            <div style="color:${col};font-size:10px;font-weight:700;letter-spacing:1.5px;margin-bottom:4px;">
                ${(hit.card.rarity || 'COMMON').toUpperCase()}
            </div>
            <div style="font-weight:600;font-size:14px;margin-bottom:6px;">${hit.card.name}</div>
            <div style="color:#9ca3af;font-size:12px;">${hit.card.description || '—'}</div>`;
        tooltip.style.display = 'block';
        const pad = 14;
        let tx = mx + 18, ty = my - 20;
        if (tx + 240 > window.innerWidth)  tx = mx - 240 - 18;
        if (ty + 120 > window.innerHeight) ty = window.innerHeight - 130;
        tooltip.style.left = tx + 'px';
        tooltip.style.top  = ty + 'px';
    } else {
        tooltip.style.display = 'none';
    }
}

function hideTabTooltip() {
    const t = document.getElementById('tab-card-tooltip');
    if (t) t.style.display = 'none';
    _tabCardRegions = [];
}

// Register mousemove listener once
if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', (e) => {
        if (state.playerInputs?.tab) updateTabTooltip(e.clientX, e.clientY);
    });
}

// ─── DRAW TAB MENU ───────────────────────────────────────────────────────────
function drawTabMenu(playersData) {
    const RARITY_COLORS = {
        common:'#9e9e9e', uncommon:'#2ed573', rare:'#2a9df4',
        epic:'#a335ee', legendary:'#ffaa00', mythic:'#ff4757',
        exotic:'#eccc68', transcended:'#ff2a7a'
    };

    const sorted = Object.values(playersData).sort((a, b) => (b.score || 0) - (a.score || 0));
    const ctx    = state.ctx;

    // Row height scales with card count — players with many cards get taller rows
    const maxCards  = Math.max(1, ...sorted.map(p => (p.pickedCards || []).length));
    // Each row: name+stats block (50px) + card row that grows with count
    // Cards displayed as small dots/chips, max 12 per visual row, then wrap
    const CARD_CHIP_W   = 22; // width of each chip
    const CARD_CHIP_H   = 16;
    const CARDS_PER_ROW = 12;
    const cardRows      = Math.max(1, Math.ceil(maxCards / CARDS_PER_ROW));
    const rowH          = 54 + cardRows * (CARD_CHIP_H + 3);

    const STAT_W   = 200; // right column: stat bars
    const w        = 700;
    const headerH  = 58;
    const h        = headerH + sorted.length * rowH + 12;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const px = (state.canvas.width  - w) / 2;
    const py = (state.canvas.height - h) / 2;

    // Panel
    ctx.fillStyle = 'rgba(9,10,15,0.96)';
    ctx.fillRect(px, py, w, h);
    ctx.strokeStyle = 'rgba(69,243,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#45f3ff'; ctx.shadowBlur = 14;
    ctx.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;

    // Header
    ctx.fillStyle = '#45f3ff';
    ctx.font = 'bold 13px "Orbitron",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TABULKA SKÓRE', state.canvas.width / 2, py + 34);

    // Column headers
    ctx.fillStyle = '#444';
    ctx.font = '10px "Inter",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HRÁČ  ·  BODY', px + 48, py + 50);
    ctx.textAlign = 'right';
    ctx.fillText('STATY', px + w - STAT_W - 8, py + 50);
    ctx.fillText('KARTY', px + w - 10, py + 50);

    _tabCardRegions = []; // reset hit regions

    let ry = py + headerH;

    sorted.forEach((p, i) => {
        if (i % 2 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.025)';
            ctx.fillRect(px + 1, ry, w - 2, rowH);
        }

        // ── Colour dot ──────────────────────────────────────────────────────
        ctx.beginPath();
        ctx.arc(px + 20, ry + 20, 8, 0, TWO_PI);
        ctx.fillStyle = p.color || '#fff';
        ctx.fill();

        // ── Name + score ─────────────────────────────────────────────────────
        const dead = p.hp <= 0;
        ctx.fillStyle = dead ? '#555' : '#e8eaf0';
        ctx.font = '13px "Inter",sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(
            `${dead ? '💀 ' : ''}${p.name || 'Hráč'}${p.id === socket?.id ? ' (TY)' : ''}`,
            px + 36, ry + 20
        );
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 13px "Orbitron",sans-serif';
        ctx.fillText(`${p.score || 0} bodů`, px + 36, ry + 36);

        // ── STAT BARS (right section before cards) ────────────────────────────
        const statX  = px + w - STAT_W - 130;
        const barLen = 90;
        const barH   = 5;

        // Define stats to show with their max reference values
        const stats = [
            { label: 'DMG',    val: p.damage      || 20,  max: 999, col: '#ff4757' },
            { label: 'SPD',    val: p.moveSpeed   || 0.8, max: 3.5, col: '#45f3ff' },
            { label: 'AMMO',   val: p.maxAmmo     || 10,  max: 30,  col: '#f1c40f' },
        ];

        stats.forEach((s, si) => {
            const bx = statX + si * (barLen + 28);
            const by = ry + 8;
            const ratio = Math.min(1, s.val / s.max);

            ctx.fillStyle = '#222';
            ctx.fillRect(bx, by + 12, barLen, barH);
            ctx.fillStyle = s.col;
            ctx.fillRect(bx, by + 12, barLen * ratio, barH);

            ctx.fillStyle = '#555';
            ctx.font = '8px "Inter",sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(s.label, bx, by + 9);

            ctx.fillStyle = s.col;
            ctx.font = 'bold 9px "Inter",sans-serif';
            const display = s.label === 'SPD' ? s.val.toFixed(1)
                          : s.label === 'DMG' ? Math.round(s.val)
                          : Math.round(s.val);
            ctx.fillText(display, bx + barLen + 3, by + 16);
        });

        // HP bar
        const hpBx  = statX;
        const hpBy  = ry + 30;
        const hpRat = Math.max(0, (p.hp || 0) / (p.maxHp || 100));
        const hpCol = hpRat > 0.5 ? '#2ed573' : hpRat > 0.25 ? '#f1c40f' : '#ff4757';
        ctx.fillStyle = '#222';
        ctx.fillRect(hpBx, hpBy, (barLen + 28) * 3 - 28, barH);
        ctx.fillStyle = hpCol;
        ctx.fillRect(hpBx, hpBy, ((barLen + 28) * 3 - 28) * hpRat, barH);
        ctx.fillStyle = '#555'; ctx.font = '8px "Inter",sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(`HP ${Math.round(p.hp||0)}/${p.maxHp||100}`, hpBx, hpBy - 2);

        // ── CARD CHIPS (scale with count, hover to see description) ───────────
        const cards    = p.pickedCards || [];
        const chipArea = px + w - 124; // start x of card chips
        const chipY0   = ry + 6;

        cards.forEach((card, ci) => {
            const col  = RARITY_COLORS[card.rarity?.toLowerCase()] || '#888';
            const row  = Math.floor(ci / CARDS_PER_ROW);
            const col2 = ci % CARDS_PER_ROW;
            const cx2  = chipArea + col2 * (CARD_CHIP_W + 2);
            const cy2  = chipY0   + row  * (CARD_CHIP_H + 2);

            ctx.fillStyle = `${col}28`;
            ctx.fillRect(cx2, cy2, CARD_CHIP_W, CARD_CHIP_H);
            ctx.strokeStyle = col;
            ctx.lineWidth = 0.8;
            ctx.strokeRect(cx2 + 0.5, cy2 + 0.5, CARD_CHIP_W - 1, CARD_CHIP_H - 1);

            // First letter of card name as icon
            ctx.fillStyle = col;
            ctx.font = 'bold 9px "Inter",sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText((card.name || '?')[0].toUpperCase(), cx2 + CARD_CHIP_W / 2, cy2 + 11);

            // Coordinates are in screen space (drawTabMenu uses setTransform(1,0,0,1,0,0))
            _tabCardRegions.push({ x: cx2, y: cy2, w: CARD_CHIP_W, h: CARD_CHIP_H, card });
        });

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
    // Draw domain map-wide visual effects (tints, animations, vignettes)
    if (serverData.players) {
        const activeDomainPlayers = Object.values(serverData.players).filter(p => p.domainActive);
        if (activeDomainPlayers.length > 0) {
            const mapFx = buildMapEffect(activeDomainPlayers);
            if (mapFx) drawDomainMapEffect(mapFx);
        }
    }
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
            hideTabTooltip();
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
                hideTabTooltip();
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
