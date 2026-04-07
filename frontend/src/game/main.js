// main.js
import { state } from './state.js';
import './network.js'; // Jen spustíme
import { updateLocalGame } from './physics.js';
import { drawGame } from './render.js';

// Inicializace nastavení zaměřovače z LocalStorage
try {
    const savedCrosshair = localStorage.getItem('crosshairSettings');
    if (savedCrosshair) {
        state.crosshairConfig = JSON.parse(savedCrosshair);
    }
} catch (e) {
    console.warn("Chyba při načítání zaměřovače z localStorage.");
}

// Eventy myši
window.addEventListener('mousemove', (e) => {
    if (!state.canvas) state.canvas = document.getElementById('game');
    if (!state.canvas) return;
    const rect = state.canvas.getBoundingClientRect();
    state.currentMouseX = e.clientX - rect.left;
    state.currentMouseY = e.clientY - rect.top;
});

// Pokud používáš čisté HTML, musíš některé funkce explicitně napojit na window, 
// aby fungovaly v onclick="saveCrosshairSettings()" atd.
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

// Herní smyčky
function renderLoop() {
    if (state.latestServerData) {
        drawGame(state.latestServerData);
    }
    requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

setInterval(updateLocalGame, 1000 / 60);