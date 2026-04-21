// game/main.js
import { state } from './state.js';
import './network.js';
import { updateLocalGame } from './physics.js';
import { drawGame } from './render.js';
import { initInputs } from './input.js';
import { CONFIG } from './gameConfig.js';

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
    // OPRAVA: offsetWidth/Height vrací 0 pokud canvas ještě nebyl layout-ován po display:none->block
    // Používáme window.innerWidth/Height jako zálohu, aby první frame nebyl prázdný
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

    // OPRAVA: Počkáme jeden frame, aby prohlížeč stihl layout po display:none->block
    // Bez toho canvas.offsetWidth = 0 a první frame se nevykreslí
    requestAnimationFrame(() => {
        resizeCanvas(canvas);
        // Pokud offsetWidth stále 0, vynutíme window rozměry
        if (canvas.width === 0) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        state.canvas = canvas;
        state.ctx = canvas.getContext('2d');

        document.addEventListener('contextmenu', event => event.preventDefault());
        window.addEventListener('resize', () => resizeCanvas(canvas));

        console.log(`🚀 Herní engine nastartován! Rozlišení: ${canvas.width}x${canvas.height}`);

        initInputs();
        requestAnimationFrame(renderLoop);

        setInterval(() => {
            if (state.latestServerData) {
                updateLocalGame();
            }
        }, 1000 / 60);

        engineStarted = true;
    });
}