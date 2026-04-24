// game/main.js
import { state } from './state.js';
import { initNetwork } from './network.js'; 
import { updateLocalGame } from './physics.js';
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
    console.warn("⚠️ Chyba při načítání zaměřovače.");
}

function resizeCanvas(canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const scaleX = canvas.width / CONFIG.MAP_WIDTH;
    const scaleY = canvas.height / CONFIG.MAP_HEIGHT;
    state.gameScale = Math.min(scaleX, scaleY);
    
    state.gameOffsetX = (canvas.width - CONFIG.MAP_WIDTH * state.gameScale) / 2;
    state.gameOffsetY = (canvas.height - CONFIG.MAP_HEIGHT * state.gameScale) / 2;
}

function renderLoop() {
    const canvas = state.canvas;
    if (canvas && state.ctx) {
        if (state.latestServerData) {
            
            // --- OKAMŽITÝ UPDATE HUDu BEZ ZPOŽDĚNÍ ---
            const s = window.gameSocket;
            if (s && state.latestServerData.players) {
                const me = state.latestServerData.players[s.id];
                if (me) {
                    const hudAmmo = document.getElementById('hud-ammo');
                    const hudHp = document.getElementById('hud-hp');
                    if (hudAmmo) hudAmmo.innerText = `${me.ammo} / ${me.maxAmmo || 10}`;
                    if (hudHp) hudHp.innerText = `${Math.round(me.hp)} / ${me.maxHp || 100}`;
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
    state.ctx = canvas.getContext('2d');

    initNetwork(); 

    document.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', () => resizeCanvas(canvas));

    initInputs();
    requestAnimationFrame(renderLoop);

    setInterval(() => {
        if (state.latestServerData && state.latestServerData.gameState === 'PLAYING') {
            updateLocalGame();
        }
    }, 1000 / 60);
}