// game/main.js
import { state } from './state.js';
import './network.js';
import { updateLocalGame } from './physics.js';
import { drawGame } from './render.js';
import { initInputs } from './input.js';
import { CONFIG } from '../../gameConfig.js';

// --- 1. INICIALIZACE ZAMĚŘOVAČE Z LOCALSTORAGE ---
try {
    const savedCrosshair = localStorage.getItem('crosshairSettings');
    if (savedCrosshair) {
        state.crosshairConfig = JSON.parse(savedCrosshair);
    } else {
        state.crosshairConfig = { color: '#45f3ff', size: 10, shape: 'cross' };
    }
} catch (e) {
    console.warn("⚠️ Chyba při načítání zaměřovače z localStorage.");
}

// --- 2. UKLÁDÁNÍ Z UI ---
export function updateCrosshairSettings(shape, color, size) {
    state.crosshairConfig = { color, size: parseInt(size), shape };
    localStorage.setItem('crosshairSettings', JSON.stringify(state.crosshairConfig));
}

window.saveCrosshairSettings = function() {
    const shapeEl = document.getElementById('crosshairShape');
    const colorEl = document.getElementById('crosshairColor');
    const sizeEl = document.getElementById('crosshairSize');
    if (shapeEl && colorEl && sizeEl) {
        updateCrosshairSettings(shapeEl.value, colorEl.value, sizeEl.value);
    }
    const settingsUI = document.getElementById('settingsUI');
    if (settingsUI) settingsUI.classList.add('hidden');
};

// --- 3. HERNÍ SMYČKA ---
let firstFrameLogged = false;

function resizeCanvas(canvas) {
    // OPRAVA: offsetWidth je 0 hned po display:none->block, dokud prohlížeč neudělá layout.
    // Použijeme window.innerWidth jako zálohu.
    const w = canvas.offsetWidth || window.innerWidth;
    const h = canvas.offsetHeight || window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
}

function renderLoop() {
    const canvas = state.canvas || document.getElementById('game');

    if (canvas && canvas.style.display !== 'none') {
        resizeCanvas(canvas);

        if (state.latestServerData) {
            if (!firstFrameLogged) {
                console.log("🎨 PRVNÍ FRAME: Kreslím hru!");
                firstFrameLogged = true;
            }
            drawGame(state.latestServerData);
        } else {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    requestAnimationFrame(renderLoop);
}

// --- 4. EXPORTOVANÁ FUNKCE PRO REACT ---
let engineStarted = false;

export function initGameEngine() {
    if (engineStarted) return;

    const canvas = document.getElementById('game');

    if (!canvas) {
        console.log("⏳ Čekám na React, než vykreslí plátno...");
        setTimeout(initGameEngine, 100);
        return;
    }

    // OPRAVA: Čekáme jeden frame aby prohlížeč stihl layout po display:none->block.
    // Bez toho canvas.offsetWidth = 0 a první frame je prázdný (canvas 0×0).
    requestAnimationFrame(() => {
        resizeCanvas(canvas);
        state.canvas = canvas;
        state.ctx = canvas.getContext('2d');

        document.addEventListener('contextmenu', e => e.preventDefault());
        window.addEventListener('resize', () => resizeCanvas(canvas));

        console.log(`🚀 Engine nastartován: ${canvas.width}×${canvas.height}`);

        initInputs();
        requestAnimationFrame(renderLoop);

        setInterval(() => {
            if (state.latestServerData && state.latestServerData.gameState === 'PLAYING') {
                updateLocalGame();
            }
        }, 1000 / 60);

        engineStarted = true;
    });
}