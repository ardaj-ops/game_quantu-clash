// game/main.js
import { state } from './state.js';
import './network.js'; // Jen spustíme, aby se navázalo spojení
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
        // Nastavení výchozího zaměřovače, pokud v paměti nic není
        state.crosshairConfig = { color: '#45f3ff', size: 10, shape: 'cross' };
    }
} catch (e) {
    console.warn("⚠️ Chyba při načítání zaměřovače z localStorage.");
}

// --- 2. UKLÁDÁNÍ Z UI ---
// Exportujeme funkci pro React, aby mohl zaměřovač měnit moderně
export function updateCrosshairSettings(shape, color, size) {
    state.crosshairConfig = { color, size: parseInt(size), shape };
    localStorage.setItem('crosshairSettings', JSON.stringify(state.crosshairConfig));
}

// Zůstává pro zpětnou kompatibilitu, dokud to nepředěláš plně do Reactu
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

// --- 3. HERNÍ SMYČKA (Kreslení) ---
let firstFrameLogged = false;

function renderLoop() {
    const canvas = state.canvas || document.getElementById('game');
    
    if (canvas) {
        // UDRŽUJEME SPRÁVNÉ ROZLIŠENÍ: Přizpůsobení velikosti okna
        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        // Kreslíme hru POUZE tehdy, pokud už dorazila živá data ze serveru
        if (state.latestServerData) {
            if (!firstFrameLogged) {
                console.log("🎨 PRVNÍ FRAME: main.js našel canvas, má data a volá render.js!");
                firstFrameLogged = true;
            }
            drawGame(state.latestServerData);
        } else {
            // Pokud čekáme v menu/lobby, vymažeme plátno, aby bylo průhledné a vyniklo React UI
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    requestAnimationFrame(renderLoop);
}

// --- 4. EXPORTOVANÁ FUNKCE PRO REACT ---
let engineStarted = false;

export function initGameEngine() {
    if (engineStarted) return; // Zabráníme vícenásobnému spuštění

    const canvas = document.getElementById('game');
    
    // Pokud React ještě nestihl vykreslit <canvas id="game">, zkusíme to znovu za 100ms
    if (!canvas) {
        console.log("⏳ Čekám na React, než vykreslí plátno...");
        setTimeout(initGameEngine, 100);
        return;
    }

    // Okamžitě plátnu nastavíme 100% vnitřní velikost
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.canvas = canvas; 

    // Pojistka pro Dash: zablokování kontextového menu na celém dokumentu
    document.addEventListener('contextmenu', event => event.preventDefault());

    console.log(`🚀 Herní engine nastartován! Rozlišení plátna: ${canvas.width}x${canvas.height}`);
    
    // ZAPNEME OVLÁDÁNÍ (z input.js)
    initInputs(); 
    
    // Odstartování kreslící smyčky
    requestAnimationFrame(renderLoop);
    
    // Fyzika běží stabilně 60x za vteřinu, ale jen pokud hrajeme
    setInterval(() => {
        if (state.latestServerData) {
            updateLocalGame();
        }
    }, 1000 / 60); 
    
    engineStarted = true;
}