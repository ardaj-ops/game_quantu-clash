// game/main.js
import { state } from './state.js';
import { initNetwork } from './network.js';
import { updateLocalGame, updateRemoteBullets } from './physics.js';
import { drawGame } from './render.js';
import { initInputs } from './input.js';
import { CONFIG } from '../gameConfig.js';

try {
    const savedCrosshair = localStorage.getItem('crosshairSettings');
    if (savedCrosshair) {
        state.crosshairConfig = JSON.parse(savedCrosshair);
    } else {
        state.crosshairConfig = { color: '#45f3ff', size: 10, shape: 'cross' };
    }
} catch (e) {
    console.warn('⚠️ Chyba při načítání zaměřovače.');
}

function resizeCanvas(canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const scaleX = canvas.width / CONFIG.MAP_WIDTH;
    const scaleY = canvas.height / CONFIG.MAP_HEIGHT;
    state.gameScale   = Math.min(scaleX, scaleY);
    state.gameOffsetX = (canvas.width  - CONFIG.MAP_WIDTH  * state.gameScale) / 2;
    state.gameOffsetY = (canvas.height - CONFIG.MAP_HEIGHT * state.gameScale) / 2;
}

function renderLoop() {
    const canvas = state.canvas;
    if (canvas && state.ctx) {
        if (state.latestServerData) {
            // Update HTML HUD
            const s = window.gameSocket;
            if (s && state.latestServerData.players) {
                const me = state.latestServerData.players[s.id];
                if (me) {
                    const hudAmmo   = document.getElementById('hud-ammo');
                    const hudHp     = document.getElementById('hud-hp');
                    const hudHpBar  = document.getElementById('hud-hp-bar');
                    if (hudAmmo)  hudAmmo.innerText  = `${me.ammo} / ${me.maxAmmo || 10}`;
                    if (hudHp)    hudHp.innerText    = `${Math.round(me.hp)} / ${me.maxHp || 100}`;
                    if (hudHpBar) {
                        const pct = Math.max(0, (me.hp / (me.maxHp || 100)) * 100);
                        hudHpBar.style.width = `${pct}%`;
                        hudHpBar.style.background = pct > 50 ? '#2ed573' : pct > 25 ? '#f1c40f' : '#ff4757';
                    }
                }
            }
            drawGame(state.latestServerData);
        } else {
            state.ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    requestAnimationFrame(renderLoop);
}

let engineStarted = false;

export function initGameEngine() {
    if (engineStarted) return;
    engineStarted = true;

    const canvas = document.getElementById('game');
    if (!canvas) return;

    resizeCanvas(canvas);
    state.canvas = canvas;
    state.ctx    = canvas.getContext('2d');

    initNetwork();

    document.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', () => resizeCanvas(canvas));

    initInputs();
    requestAnimationFrame(renderLoop);

    setInterval(() => {
        if (!state.latestServerData) return;
        if (state.latestServerData.gameState === 'PLAYING') {
            updateLocalGame();
        }
        // FIX: updateRemoteBullets runs every tick regardless of state — remote bullets
        // need to keep simulating even during CARD_SELECTION transition frame.
        updateRemoteBullets();
    }, 1000 / 60);
}