// game/main.js
import { state } from './state.js';
import './network.js'; // Jen spustíme, aby se navázalo spojení
import { updateLocalGame } from './physics.js';
import { drawGame } from './render.js';

// --- 1. Inicializace zaměřovače z LocalStorage ---
try {
    const savedCrosshair = localStorage.getItem('crosshairSettings');
    if (savedCrosshair) {
        state.crosshairConfig = JSON.parse(savedCrosshair);
    }
} catch (e) {
    console.warn("⚠️ Chyba při načítání zaměřovače z localStorage.");
}

// --- 2. Eventy myši (Bezpečné pro React/HTML) ---
window.addEventListener('mousemove', (e) => {
    // Dynamicky hledáme canvas (pokud ho React ještě nevykreslil, nespadne to)
    if (!state.canvas) {
        state.canvas = document.getElementById('game');
    }
    if (!state.canvas) return; // Canvas ještě není v DOMu, kašleme na to
    
    const rect = state.canvas.getBoundingClientRect();
    // Výpočet pozice myši uvnitř plátna
    state.currentMouseX = e.clientX - rect.left;
    state.currentMouseY = e.clientY - rect.top;
});

// --- 3. Ukládání z UI (Pro Vanilla HTML menu) ---
window.saveCrosshairSettings = function() {
    const shapeEl = document.getElementById('crosshairShape');
    const colorEl = document.getElementById('crosshairColor');
    const sizeEl = document.getElementById('crosshairSize');

    if (shapeEl && colorEl && sizeEl) {
        state.crosshairConfig = { color: colorEl.value, size: parseInt(sizeEl.value), shape: shapeEl.value };
        localStorage.setItem('crosshairSettings', JSON.stringify(state.crosshairConfig));
    }
    const settingsUI = document.getElementById('settingsUI');
    if (settingsUI) settingsUI.classList.add('hidden');
};

// --- 4. HERNÍ SMYČKY (Kreslení a Fyzika) ---
let firstFrameLogged = false;

function renderLoop() {
    const canvas = document.getElementById('game');
    
    // Kreslíme POUZE tehdy, pokud máme plátno a pokud máme data ze serveru
    if (canvas && state.latestServerData) {
        
        // POJISTKA: Pokud canvas nemá nastavenou vnitřní velikost, nakreslí se jen černo!
        // (Uprav si 800x600 podle toho, jak velkou máš hru, nebo použij window.innerWidth)
        if (canvas.width === 0 || canvas.height === 0) {
            canvas.width = 800; 
            canvas.height = 600;
        }

        if (!firstFrameLogged) {
            console.log("🎨 PRVNÍ FRAME: main.js našel canvas, má data a volá render.js!");
            firstFrameLogged = true;
        }

        // Předáme data k vykreslení
        drawGame(state.latestServerData);
    }
    
    requestAnimationFrame(renderLoop);
}

// --- 5. EXPORTOVANÁ FUNKCE PRO REACT ---
let engineStarted = false;

export function initGameEngine() {
    if (engineStarted) return; // Zabráníme vícenásobnému spuštění

    const canvas = document.getElementById('game');
    if (!canvas) {
        console.error("❌ Plátno nenalezeno! React ještě nevykreslil <canvas id='game'>.");
        return;
    }

    console.log("🚀 Herní engine úspěšně nastartován!");
    
    // Odstartování smyček až teď, když víme, že plátno existuje
    requestAnimationFrame(renderLoop);
    setInterval(updateLocalGame, 1000 / 60); // Fyzika běží 60x za vteřinu
    
    engineStarted = true;
}