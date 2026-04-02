// ==========================================
// INICIALIZACE ZÁKLADNÍCH PROMĚNNÝCH
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const TWO_PI = Math.PI * 2; // Optimalizace pro kreslení kruhů
window.latestServerData = null; 
window.gameScale = 1;
window.gameOffsetX = 0;
window.gameOffsetY = 0;

// Pojistka pro vstupy (pokud jsou definovány jinde)
window.inputs = window.inputs || { up: false, down: false, left: false, right: false, click: false, aimAngle: 0 };

// ==========================================
// 0. LOKÁLNÍ PAMĚŤ PRO MAPU A STAV
// ==========================================
window.localObstacles = [];
window.localBreakables = [];
window.CARD_CATALOG = []; 
window.localBullets = []; 
let lastShotTime = 0;
window.showTabMenu = false; 

if (typeof socket !== 'undefined') {
    socket.on('mapUpdate', (data) => {
        if (data.obstacles) window.localObstacles = data.obstacles;
        if (data.breakables) window.localBreakables = data.breakables;
    });

    socket.on('initCatalog', (catalogData) => {
        window.CARD_CATALOG = catalogData;
        console.log("📚 Katalog karet úspěšně načten ze serveru!", catalogData);
    });
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        window.showTabMenu = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        window.showTabMenu = false;
    }
});

const MAP_W = (typeof CONFIG !== 'undefined' && CONFIG.MAP_WIDTH) ? CONFIG.MAP_WIDTH : 2000;
const MAP_H = (typeof CONFIG !== 'undefined' && CONFIG.MAP_HEIGHT) ? CONFIG.MAP_HEIGHT : 2000;

// ==========================================
// 1. ZAMĚŘOVAČ A JEHO NASTAVENÍ
// ==========================================
window.crosshairConfig = { color: '#45f3ff', size: 10 };

try {
    const savedCrosshair = localStorage.getItem('crosshairSettings');
    if (savedCrosshair) {
        window.crosshairConfig = JSON.parse(savedCrosshair);
    }
} catch (e) {
    console.warn("Chyba při načítání zaměřovače z localStorage, použije se výchozí.");
}

function drawCrosshair() {
    if (!window.currentMouseX || !window.currentMouseY || !ctx) return;
    
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    
    const shape = window.gameCrosshair || 'cross'; 
    const color = window.crosshairConfig.color || '#45f3ff';
    const size = window.crosshairConfig.size || 10;
    const x = window.currentMouseX;
    const y = window.currentMouseY;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 5;
    ctx.shadowColor = color;

    ctx.beginPath();
    if (shape === 'circle') {
        ctx.arc(x, y, size, 0, TWO_PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, TWO_PI);
        ctx.fill();
    } else if (shape === 'cross') {
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size, y);
        ctx.moveTo(x, y - size);
        ctx.lineTo(x, y + size);
        ctx.stroke();
    } else if (shape === 'dot') {
        ctx.arc(x, y, size / 2, 0, TWO_PI);
        ctx.fill();
    }
    ctx.restore();
}

window.screenToWorld = function(screenX, screenY) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const xOnCanvas = screenX - rect.left;
    const yOnCanvas = screenY - rect.top;

    return {
        x: (xOnCanvas - window.gameOffsetX) / window.gameScale,
        y: (yOnCanvas - window.gameOffsetY) / window.gameScale
    };
};

window.updateCrosshairPreview = function() {
    const shapeEl = document.getElementById('crosshairShape');
    const colorEl = document.getElementById('crosshairColor');
    const sizeEl = document.getElementById('crosshairSize');
    const pCanvas = document.getElementById('crosshairPreview');

    if (!shapeEl || !colorEl || !sizeEl || !pCanvas) return;

    const shape = shapeEl.value;
    const color = colorEl.value;
    const size = parseInt(sizeEl.value);
    
    const pCtx = pCanvas.getContext('2d');
    if (!pCtx) return;

    pCtx.clearRect(0, 0, 60, 60);
    pCtx.strokeStyle = color;
    pCtx.fillStyle = color;
    pCtx.lineWidth = 2;
    
    const x = 30, y = 30;
    pCtx.beginPath();
    if (shape === 'circle') {
        pCtx.arc(x, y, size, 0, TWO_PI);
        pCtx.stroke();
        pCtx.beginPath();
        pCtx.arc(x, y, 2, 0, TWO_PI);
        pCtx.fill();
    } else if (shape === 'cross') {
        pCtx.moveTo(x - size, y);
        pCtx.lineTo(x + size, y);
        pCtx.moveTo(x, y - size);
        pCtx.lineTo(x, y + size);
        pCtx.stroke();
    } else if (shape === 'dot') {
        pCtx.arc(x, y, size / 2, 0, TWO_PI);
        pCtx.fill();
    }
};

window.saveCrosshairSettings = function() {
    const shapeEl = document.getElementById('crosshairShape');
    const colorEl = document.getElementById('crosshairColor');
    const sizeEl = document.getElementById('crosshairSize');

    if (shapeEl && colorEl && sizeEl) {
        window.crosshairConfig = {
            color: colorEl.value,
            size: parseInt(sizeEl.value)
        };
        window.gameCrosshair = shapeEl.value; 
        
        localStorage.setItem('crosshairSettings', JSON.stringify(window.crosshairConfig));
    }

    const settingsUI = document.getElementById('settingsUI');
    if (settingsUI) settingsUI.classList.add('hidden');
};

// ==========================================
// 2. VYKRESLOVÁNÍ MAPY A PROSTŘEDÍ
// ==========================================
function drawBackground() {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = '#1e272e'; 
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    ctx.strokeStyle = '#ff3f34'; 
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, MAP_W, MAP_H);
    ctx.restore();
}

function drawDomains(players) {
    if (!ctx) return;
    const timePulse = Math.abs(Math.sin(Date.now() / 400)) * 0.1; 
    
    const domainStyles = {
        'QUANTUM_PRISON': { fill: `rgba(0, 255, 255, ${0.1 + timePulse})`, stroke: '#00ffff' },
        'MADNESS_VEIL': { fill: `rgba(128, 0, 128, ${0.1 + timePulse})`, stroke: '#8a2be2' },
        'BLOOD_ALTAR': { fill: `rgba(220, 20, 60, ${0.1 + timePulse})`, stroke: '#dc143c' },
        'GRAVITY_COLLAPSE': { fill: `rgba(15, 15, 15, ${0.4 + timePulse})`, stroke: '#555555' },
        'MIRROR_SINGULARITY': { fill: `rgba(255, 255, 255, ${0.15 + timePulse})`, stroke: '#e0e0e0' },
        'INFINITE_ARSENAL': { fill: `rgba(255, 140, 0, ${0.1 + timePulse})`, stroke: '#ff8c00' }
    };

    ctx.save();
    Object.values(players).forEach(p => {
        if (p.domainActive && p.domainRadius) {
            let dX = p.domainX !== undefined ? p.domainX : p.x;
            let dY = p.domainY !== undefined ? p.domainY : p.y;
            
            ctx.beginPath();
            ctx.arc(dX, dY, p.domainRadius, 0, TWO_PI);
            let style = domainStyles[p.domainType] || { fill: `rgba(255, 255, 255, ${0.1 + timePulse})`, stroke: '#ffffff' };
            
            ctx.fillStyle = style.fill;
            ctx.fill();
            
            ctx.lineWidth = 3;
            ctx.strokeStyle = style.stroke;
            ctx.setLineDash([10, 15]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    });
    ctx.restore();
}

function drawMapObjects(obstacles, breakables) {
    if (!ctx) return;
    ctx.save();
    if (obstacles) {
        obstacles.forEach(obs => {
            if(!obs) return;
            ctx.fillStyle = '#272424';
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height); 
            ctx.strokeStyle = '#45f3ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        });
    }
    if (breakables) {
        breakables.forEach(wall => {
            if (!wall || wall.destroyed) return; 
            ctx.fillStyle = '#b33939'; 
            ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
            ctx.strokeStyle = '#2c2c54';
            ctx.lineWidth = 2;
            ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
        });
    }
    ctx.restore();
}

// ==========================================
// 3. VYKRESLENÍ KOSMETIKY A AVATARA
// ==========================================
function drawCosmetics(ctx, x, y, radius, cosmetic, bodyColor, aimAngle) {
    if (!cosmetic || cosmetic === 'none' || !ctx) return;
    
    ctx.save();
    switch (cosmetic) {
        case 'crown':
            ctx.fillStyle = '#f1c40f'; 
            ctx.beginPath();
            ctx.moveTo(x - 12, y - radius + 2);
            ctx.lineTo(x - 18, y - radius - 15);
            ctx.lineTo(x - 6, y - radius - 5);
            ctx.lineTo(x, y - radius - 18);
            ctx.lineTo(x + 6, y - radius - 5);
            ctx.lineTo(x + 18, y - radius - 15);
            ctx.lineTo(x + 12, y - radius + 2);
            ctx.fill();
            ctx.stroke();
            break;
        case 'halo':
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(x, y - radius - 8, 15, 5, 0, 0, TWO_PI);
            ctx.stroke();
            break;
        case 'horns':
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(x - 10, y - radius + 5);
            ctx.quadraticCurveTo(x - 15, y - radius - 10, x - 5, y - radius - 15);
            ctx.quadraticCurveTo(x - 5, y - radius - 5, x - 2, y - radius + 2);
            ctx.moveTo(x + 10, y - radius + 5);
            ctx.quadraticCurveTo(x + 15, y - radius - 10, x + 5, y - radius - 15);
            ctx.quadraticCurveTo(x + 5, y - radius - 5, x + 2, y - radius + 2);
            ctx.fill();
            ctx.stroke();
            break;
        case 'top_hat':
        case 'tophat':
            ctx.fillStyle = '#222';
            ctx.fillRect(x - 15, y - radius - 2, 30, 4); 
            ctx.fillRect(x - 10, y - radius - 18, 20, 16); 
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(x - 10, y - radius - 6, 20, 4); 
            break;
        case 'cat_ears':
        case 'catears':
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.moveTo(x - 12, y - radius + 4);
            ctx.lineTo(x - 18, y - radius - 10);
            ctx.lineTo(x - 4, y - radius + 1);
            ctx.moveTo(x + 12, y - radius + 4);
            ctx.lineTo(x + 18, y - radius - 10);
            ctx.lineTo(x + 4, y - radius + 1);
            ctx.fill();
            ctx.stroke();
            break;
        case 'sunglasses':
            ctx.fillStyle = '#111';
            ctx.beginPath();
            let lookX = x + Math.cos(aimAngle || 0) * (radius - 5);
            let lookY = y + Math.sin(aimAngle || 0) * (radius - 5);
            ctx.arc(lookX - 4, lookY, 4, 0, TWO_PI);
            ctx.arc(lookX + 4, lookY, 4, 0, TWO_PI);
            ctx.fill();
            break;
        case 'ninja_headband':
            ctx.fillStyle = '#000';
            ctx.fillRect(x - radius, y - radius + 5, radius * 2, 6);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x, y - radius + 8, 2, 0, TWO_PI);
            ctx.fill();
            break;
        case 'flower':
            ctx.fillStyle = '#ff9ff3';
            ctx.beginPath();
            ctx.arc(x + 10, y - radius + 5, 5, 0, TWO_PI);
            ctx.fill();
            ctx.fillStyle = '#feca57';
            ctx.beginPath();
            ctx.arc(x + 10, y - radius + 5, 2, 0, TWO_PI);
            ctx.fill();
            break;
        case 'mohawk':
            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath();
            ctx.moveTo(x - 5, y - radius + 2);
            ctx.lineTo(x, y - radius - 15);
            ctx.lineTo(x + 5, y - radius + 2);
            ctx.fill();
            break;
    }
    ctx.restore();
}

function drawAvatar(ctx, x, y, radius, color, cosmetic, aimAngle, hp, maxHp, ammo, maxAmmo, name, team, isReloading, isInvisible, dashCD, domainProgress, isDomainActive, isMe) {
    if (!ctx) return;
    const gameMode = window.latestServerData ? window.latestServerData.gameMode : 'ffa';
    let bodyColor = color || '#fff'; 
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TWO_PI);
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.lineWidth = 3;
    
    if (gameMode === 'tdm') {
        if (team === 'red') {
            ctx.strokeStyle = '#c0392b';
            ctx.shadowColor = '#ff4757';
            ctx.shadowBlur = 10;
        } else if (team === 'blue') {
            ctx.strokeStyle = '#273c75'; 
            ctx.shadowColor = '#3742fa';
            ctx.shadowBlur = 10;
        } else {
            ctx.strokeStyle = '#222';
            ctx.shadowBlur = 0;
        }
    } else {
        ctx.strokeStyle = '#222';
        ctx.shadowBlur = 0;
    }
    ctx.stroke();
    ctx.shadowBlur = 0; 

    drawCosmetics(ctx, x, y, radius, cosmetic, bodyColor, aimAngle);

    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(aimAngle || 0) * (radius + 15), y + Math.sin(aimAngle || 0) * (radius + 15));
    ctx.lineWidth = 4;
    ctx.stroke();

    const actualMaxHp = Math.max(maxHp || 100, hp);
    const hpBarWidth = Math.min(100, Math.max(30, 40 + (actualMaxHp - 100) * 0.15));
    const hpRatio = Math.min(1, Math.max(0, hp / actualMaxHp)); 
    
    ctx.fillStyle = '#eb4d4b';
    ctx.fillRect(x - hpBarWidth / 2, y + radius + 10, hpBarWidth, 6);
    
    ctx.fillStyle = '#6ab04c';
    ctx.fillRect(x - hpBarWidth / 2, y + radius + 10, hpBarWidth * hpRatio, 6);

    if (actualMaxHp > 25) {
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        const segmentCount = Math.floor(actualMaxHp / 25);
        const segmentWidth = hpBarWidth / (actualMaxHp / 25);
        for (let i = 1; i <= segmentCount; i++) {
            let segX = (x - hpBarWidth / 2) + (i * segmentWidth);
            if (segX >= x + hpBarWidth / 2) break; 
            ctx.beginPath();
            ctx.moveTo(segX, y + radius + 10);
            ctx.lineTo(segX, y + radius + 16);
            ctx.stroke();
        }
    }

    let currentBarOffsetY = y + radius + 18;
    if (maxAmmo !== undefined && ammo !== undefined && maxAmmo > 0) {
        const ammoRatio = Math.min(1, Math.max(0, ammo / maxAmmo));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x - hpBarWidth / 2, currentBarOffsetY, hpBarWidth, 4);
        ctx.fillStyle = '#f1c40f'; 
        ctx.fillRect(x - hpBarWidth / 2, currentBarOffsetY, hpBarWidth * ammoRatio, 4);
        currentBarOffsetY += 6;
    } else {
        currentBarOffsetY += 2; 
    }

    if (dashCD !== undefined && dashCD > 0) {
        const maxDashCD = (typeof CONFIG !== 'undefined' && CONFIG.DASH_COOLDOWN) ? CONFIG.DASH_COOLDOWN : 3000; 
        const dashRatio = Math.min(1, Math.max(0, dashCD / maxDashCD)); 
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x - hpBarWidth / 2, currentBarOffsetY, hpBarWidth, 4);
        ctx.fillStyle = '#45f3ff'; 
        ctx.fillRect(x - hpBarWidth / 2, currentBarOffsetY, hpBarWidth * dashRatio, 4);
        currentBarOffsetY += 8;
    }

    if (domainProgress !== undefined && domainProgress > 0 && !isDomainActive) {
        const domainRatio = Math.min(1, Math.max(0, domainProgress / 100));
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x - hpBarWidth / 2, currentBarOffsetY, hpBarWidth, 5);
        ctx.fillStyle = '#9b59b6'; 
        ctx.fillRect(x - hpBarWidth / 2, currentBarOffsetY, hpBarWidth * domainRatio, 5);
        
        ctx.fillStyle = 'white';
        ctx.font = "10px Arial";
        ctx.textAlign = 'center';
        ctx.fillText("RITUÁL", x, currentBarOffsetY + 10);
        currentBarOffsetY += 15;
    }

    let nameOffsetY = (cosmetic && cosmetic !== 'none') ? radius + 28 : radius + 12;
    
    if (isInvisible) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = "italic 12px Arial";
        ctx.textAlign = 'center';
        ctx.fillText("NEVIDITELNOST", x, y - nameOffsetY);
        nameOffsetY += 16;
    }

    if (isReloading) {
        ctx.fillStyle = '#f39c12'; 
        ctx.font = "bold 13px Arial";
        ctx.textAlign = 'center';
        ctx.fillText("PŘEBÍJÍM...", x, y - nameOffsetY);
        nameOffsetY += 16; 
    }

    if (window.showNames !== false) {
        if (gameMode === 'tdm') {
            ctx.fillStyle = team === 'blue' ? '#74b9ff' : (team === 'red' ? '#ff7675' : 'white');
        } else {
            ctx.fillStyle = bodyColor;
        }
        ctx.textAlign = 'center';
        ctx.font = "bold 14px Arial";
        ctx.fillText(name || "Hráč", x, y - nameOffsetY);
    }
}

// ==========================================
// 4. ENTITY A STŘELY
// ==========================================
function drawDecoys(decoys, players) {
    if (!decoys || !players || !ctx) return;
    const myId = typeof socket !== 'undefined' ? socket.id : null;

    decoys.forEach(d => {
        let owner = players[d.ownerId];
        if (!owner) return; 

        ctx.save();
        ctx.globalAlpha = (d.ownerId === myId) ? 0.4 : 1.0;
        drawAvatar(
            ctx, d.x, d.y, d.radius || 20, 
            owner.color, owner.cosmetic, owner.aimAngle, 
            d.hp, owner.maxHp, owner.ammo, owner.maxAmmo, owner.name, owner.team, false, false,
            undefined, undefined, false, false
        );
        ctx.restore();
    });
}

function drawPlayers(players) {
    if (!ctx) return;
    const myId = typeof socket !== 'undefined' ? socket.id : null;

    Object.keys(players).forEach(id => {
        let p = players[id];
        if (p.hp <= 0) return; 

        ctx.save();
        let isMe = (id === myId);
        
        if (p.isInvisible) {
            if (isMe) {
                ctx.globalAlpha = 0.35; 
            } else {
                ctx.restore();
                return; 
            }
        }

        let displayName = p.name || "Hráč";
        if (p.isGambler) displayName = "🎲 " + displayName;
        if (p.isRussianRoulette) displayName = "💀 " + displayName;

        drawAvatar(
            ctx, p.x, p.y, p.playerRadius || 20, 
            p.color, p.cosmetic, p.aimAngle, 
            p.hp, p.maxHp, p.ammo, p.maxAmmo, displayName, p.team, p.isReloading, (p.isInvisible && isMe),
            p.dashCooldown, p.domainProgress, p.domainActive, isMe
        );
        ctx.restore();
    });
}

function drawBullets(bullets, players) {
    if ((!bullets && !window.localBullets) || !ctx) return;
    const gameMode = window.latestServerData ? window.latestServerData.gameMode : 'ffa';
    const myId = typeof socket !== 'undefined' ? socket.id : null;

    let serverBullets = (bullets || []).filter(b => b.ownerId !== myId);
    let allBullets = [...serverBullets, ...(window.localBullets || [])];

    ctx.save();
    allBullets.forEach(b => {
        let bulletColor = b.color || '#ff4757';
        let bSize = b.size || 5;

        if (b.isLethal) {
            bulletColor = '#ff0000';
            bSize += 3;
        } else if (players && b.ownerId && players[b.ownerId]) {
            let owner = players[b.ownerId];
            bulletColor = owner.color || '#fff';
            
            if (gameMode === 'tdm') {
                if (owner.team === 'red') bulletColor = '#ff4757';
                else if (owner.team === 'blue') bulletColor = '#3742fa';
                else bulletColor = '#95a5a6';
            }
        }

        ctx.beginPath();
        ctx.arc(b.x, b.y, bSize, 0, TWO_PI);
        
        if (b.isLethal) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = bSize + 10; 
            ctx.shadowColor = '#ff0000';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(b.x, b.y, bSize - 2, 0, TWO_PI);
            ctx.fillStyle = '#ff0000';
            ctx.fill();
        } else {
            const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, bSize);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(1, bulletColor);
            
            ctx.fillStyle = grad;
            ctx.shadowBlur = bSize + 2; 
            ctx.shadowColor = bulletColor;
            ctx.fill();
        }
    });
    ctx.restore();
}

// ==========================================
// 5. OVERLAY KARET A ENCYKLOPEDIE (TAB MENU)
// ==========================================
function drawTabMenu(players) {
    if (!players || !ctx || !canvas) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.fillStyle = 'rgba(15, 20, 30, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(69, 243, 255, 0.1)';
    ctx.fillRect(0, 0, canvas.width, 100);

    ctx.fillStyle = '#45f3ff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#45f3ff';
    ctx.fillText('PŘEHLED HRY', canvas.width / 2, 60);
    ctx.shadowBlur = 0; 

    ctx.strokeStyle = 'rgba(69, 243, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 120);
    ctx.lineTo(canvas.width / 2, canvas.height - 50);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('ŽIVÍ HRÁČI A JEJICH KARTY (HISTORIE)', 50, 140);

    let startY = 190;
    const startX = 50; 
    const playersArray = Object.values(players).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    playersArray.forEach(p => {
        let name = p.name || 'Hráč';
        let hp = p.hp || 0;
        let maxHp = p.maxHp || 100;
        let isDead = hp <= 0;
        
        ctx.fillStyle = isDead ? '#7f8c8d' : (p.color || '#ffffff');
        ctx.font = 'bold 20px Arial';
        let displayName = isDead ? `☠ ${name}` : name;
        ctx.fillText(displayName, startX, startY);

        const barWidth = 100;
        const barHeight = 14;
        const barX = startX + 180;
        const barY = startY - 12;
        
        ctx.fillStyle = '#eb4d4b'; 
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        if (!isDead) {
            ctx.fillStyle = '#6ab04c'; 
            const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
            ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        }

        ctx.fillStyle = 'white';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(Math.max(0, hp))} / ${maxHp}`, barX + barWidth / 2, barY + 11);
        ctx.textAlign = 'left'; 

        let obtainedCards = p.cardHistory || p.cards || []; 
        let legacyCards = [];
        if (p.isGambler) legacyCards.push('Gambler');
        if (p.isRussianRoulette) legacyCards.push('Ruská ruleta');
        if (p.domainType) legacyCards.push(p.domainType.replace('_', ' ')); 
        if (p.isInvisible) legacyCards.push('Neviditelnost');

        let allPlayerCards = [...obtainedCards, ...legacyCards];
        let cardStartX = barX + barWidth + 20;

        if (allPlayerCards.length === 0) {
            ctx.fillStyle = isDead ? '#7f8c8d' : '#95a5a6';
            ctx.font = 'italic 16px Arial';
            ctx.fillText('Zatím žádné karty', cardStartX, startY);
        } else {
            allPlayerCards.forEach(cardName => {
                let initials = (cardName || '').substring(0, 2).toUpperCase();
                
                ctx.beginPath();
                ctx.arc(cardStartX + 10, startY - 2, 14, 0, TWO_PI);
                
                if (isDead) {
                    ctx.fillStyle = '#2c3e50'; 
                    ctx.strokeStyle = '#7f8c8d';
                } else {
                    ctx.fillStyle = '#34495e'; 
                    ctx.strokeStyle = '#ecf0f1'; 
                }
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = isDead ? '#7f8c8d' : '#ecf0f1';
                ctx.textAlign = 'center';
                ctx.fillText(initials, cardStartX + 10, startY + 2);
                ctx.textAlign = 'left'; 

                cardStartX += 35; 
            });
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.moveTo(startX, startY + 15);
        ctx.lineTo(canvas.width / 2 - 20, startY + 15);
        ctx.stroke();

        startY += 40; 
    });

    const catalogStartX = (canvas.width / 2) + 40;
    let catalogStartY = 140;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('ENCYKLOPEDIE VŠECH KARET', catalogStartX, catalogStartY);

    catalogStartY += 50;

    if (window.CARD_CATALOG && window.CARD_CATALOG.length > 0) {
        window.CARD_CATALOG.forEach(card => {
            let initials = (card.name || '').substring(0, 2).toUpperCase();
            let icon = '🃏'; 
            
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(`${icon} ${card.name} (${initials})`, catalogStartX, catalogStartY);

            ctx.fillStyle = '#bdc3c7';
            ctx.font = '15px Arial';
            const maxDescWidth = (canvas.width) - catalogStartX - 40; 
            ctx.fillText(card.desc, catalogStartX + 20, catalogStartY + 25, maxDescWidth);

            catalogStartY += 65; 
        });
    } else {
        ctx.fillStyle = '#7f8c8d';
        ctx.font = 'italic 18px Arial';
        ctx.fillText('Načítám karty ze serveru...', catalogStartX, catalogStartY);
    }

    ctx.restore();
}

// ==========================================
// 5.5 PROPOJENÍ S HTML UI (HUD) - NOVÉ
// ==========================================
function updateDOM_HUD(me) {
    if (!me) return;

    // 1. Dash Ukazatel 
    const dashFill = document.getElementById('dash-progress-fill'); 
    if (dashFill) {
        const maxDashCD = (typeof CONFIG !== 'undefined' && CONFIG.DASH_COOLDOWN) ? CONFIG.DASH_COOLDOWN : 3000;
        let currentCD = me.dashCooldown || 0;
        
        if (currentCD > 0) {
            let percent = Math.max(0, 100 - (currentCD / maxDashCD * 100));
            dashFill.style.width = percent + '%';
            dashFill.style.backgroundColor = '#f39c12'; // Oranžová
        } else {
            dashFill.style.width = '100%';
            dashFill.style.backgroundColor = '#45f3ff'; // Tyrkysová
        }
    }

    // 2. Náboje 
    const ammoText = document.getElementById('ammo-text');
    if (ammoText) {
        if (me.isReloading) {
            ammoText.innerText = "PŘEBÍJÍM...";
            ammoText.style.color = "#e74c3c";
        } else if (me.maxAmmo === 0) {
            ammoText.innerText = "∞ / ∞";
            ammoText.style.color = "#f1c40f";
        } else {
            ammoText.innerText = `${me.ammo} / ${me.maxAmmo}`;
            ammoText.style.color = (me.ammo === 0) ? "#e74c3c" : "#fff";
        }
    }
}

// ==========================================
// 6. HLAVNÍ LOOP PRO VYKRESLOVÁNÍ 
// ==========================================
window.drawGame = function(serverData) {
    if (!serverData || !ctx || !canvas) return;
    window.latestServerData = serverData; 

    canvas.style.cursor = (serverData.gameState === 'PLAYING') ? 'none' : 'default';

    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    window.gameScale = Math.min(canvas.width / MAP_W, canvas.height / MAP_H);
    window.gameOffsetX = (canvas.width - MAP_W * window.gameScale) / 2;
    window.gameOffsetY = (canvas.height - MAP_H * window.gameScale) / 2;

    ctx.save();
    ctx.translate(window.gameOffsetX, window.gameOffsetY);
    ctx.scale(window.gameScale, window.gameScale);

    drawBackground();
    
    const obstacles = window.localObstacles;
    const breakables = window.localBreakables;
    drawMapObjects(obstacles, breakables);

    if (serverData.gameState !== 'LOBBY') {
        if (serverData.players) drawDomains(serverData.players);
        drawDecoys(serverData.decoys, serverData.players);
        if (serverData.players) drawPlayers(serverData.players);
        drawBullets(serverData.bullets, serverData.players);
        
        // --- ZAVOLÁNÍ DOM UI UPDATU ---
        if (typeof socket !== 'undefined' && serverData.players) {
            let myId = socket.id;
            let me = serverData.players[myId];
            updateDOM_HUD(me);
        }
    }
    
    ctx.restore();

    if (serverData.gameState === 'PLAYING') {
        if (!window.showTabMenu) {
            drawCrosshair(); 
        } else {
            drawTabMenu(serverData.players);
        }
    }

    if (serverData.gameState === 'SCOREBOARD') {
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "bold 50px Arial";
        ctx.textAlign = "center";
        ctx.shadowBlur = 20;
        ctx.shadowColor = "white";
        ctx.fillText("KOLO SKONČILO", canvas.width / 2, canvas.height / 2);
        ctx.shadowBlur = 0; 
    } 
};

// ==========================================
// 7. CLIENT-AUTHORITATIVE MOZEK A FYZIKA
// ==========================================

function checkWallCollision(x, y, radius, walls) {
    if (!walls || walls.length === 0) return false;
    let rSquared = radius * radius; // Optimalizace: Bez nutnosti používat pomalý Math.sqrt()
    
    for (let wall of walls) {
        if (!wall || wall.destroyed) continue; 
        
        let testX = Math.max(wall.x, Math.min(x, wall.x + wall.width));
        let testY = Math.max(wall.y, Math.min(y, wall.y + wall.height));
        
        let distX = x - testX;
        let distY = y - testY;
        
        if ((distX * distX) + (distY * distY) <= rSquared) {
            return true; 
        }
    }
    return false;
}

window.updateLocalGame = function() {
    if (!window.latestServerData || window.latestServerData.gameState !== 'PLAYING') return;
    if (typeof socket === 'undefined' || !window.inputs) return;

    let myId = socket.id;
    let me = window.latestServerData.players[myId];
    if (!me || me.hp <= 0) return;

    let speed = me.moveSpeed || 5;
    let pRadius = me.playerRadius || 20;
    let allWalls = [...(window.localObstacles || []), ...(window.localBreakables || [])];

    let nextX = me.x;
    let nextY = me.y;

    if (window.inputs.up) nextY -= speed;
    if (window.inputs.down) nextY += speed;
    if (!checkWallCollision(me.x, nextY, pRadius, allWalls)) {
        me.y = nextY;
    }

    if (window.inputs.left) nextX -= speed;
    if (window.inputs.right) nextX += speed;
    if (!checkWallCollision(nextX, me.y, pRadius, allWalls)) {
        me.x = nextX;
    }

    socket.emit('clientSync', {
        x: me.x,
        y: me.y,
        aimAngle: window.inputs.aimAngle,
        ammo: me.ammo,
        isReloading: me.isReloading
    });

    let now = Date.now();
    let fireRate = me.fireRate || 200;
    
    if (window.inputs.click && now - lastShotTime > fireRate && me.ammo > 0 && me.maxAmmo > 0 && !me.isReloading) {
        lastShotTime = now;
        me.ammo--; 

        let bSpeed = me.bulletSpeed || 15;
        let bullet = {
            id: Math.random().toString(36).substring(2, 9), 
            ownerId: myId,
            x: me.x + Math.cos(window.inputs.aimAngle) * (pRadius + 5),
            y: me.y + Math.sin(window.inputs.aimAngle) * (pRadius + 5),
            vx: Math.cos(window.inputs.aimAngle) * bSpeed,
            vy: Math.sin(window.inputs.aimAngle) * bSpeed,
            damage: me.damage || 10,
            radius: 5,
            color: me.color
        };

        window.localBullets.push(bullet);
        socket.emit('playerShot', [bullet]); 
    }

    for (let i = window.localBullets.length - 1; i >= 0; i--) {
        let b = window.localBullets[i];
        b.x += b.vx;
        b.y += b.vy;

        if (checkWallCollision(b.x, b.y, b.radius, allWalls)) {
            window.localBullets.splice(i, 1);
            continue;
        }

        for (let targetId in window.latestServerData.players) {
            if (targetId === myId) continue; 
            
            let target = window.latestServerData.players[targetId];
            if (target.hp <= 0) continue;

            // Optimalizace: Porovnávání na druhou místo Math.hypot()
            let distX = b.x - target.x;
            let distY = b.y - target.y;
            let combinedRadius = (target.playerRadius || 20) + b.radius;
            
            if ((distX * distX) + (distY * distY) < (combinedRadius * combinedRadius)) {
                
                socket.emit('bulletHitPlayer', {
                    targetId: targetId,
                    damage: b.damage,
                    bulletId: b.id 
                });
                
                window.localBullets.splice(i, 1);
                break;
            }
        }
    }
};

setInterval(window.updateLocalGame, 1000 / 60);