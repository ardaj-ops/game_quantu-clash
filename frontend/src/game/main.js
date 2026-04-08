// game/main.js
import { state } from './state.js';
import './network.js'; // Jen spustíme, aby se navázalo spojení
import { updateLocalGame } from './physics.js';
import { drawGame } from './render.js';
import { initInputs } from './input.js'; // Správně importováno

// --- 1. Inicializace zaměřovače z LocalStorage ---
try {
    const savedCrosshair = localStorage.getItem('crosshairSettings');
    if (savedCrosshair) {
        state.crosshairConfig = JSON.parse(savedCrosshair);
    }
} catch (e) {
    console.warn("⚠️ Chyba při načítání zaměřovače z localStorage.");
}

// --- 2. Ukládání z UI (Zůstává pro kompatibilitu s případným starým kódem) ---
window.saveCrosshairSettings = function() {
    const shapeEl = document.getElementById('crosshairShape');
    const colorEl = document.getElementById('crosshairColor');
    const sizeEl = document.getElementById('crosshairSize');

    if (shapeEl && colorEl && sizeEl) {
        state.crosshairConfig = { color: colorEl.value, size: parseInt(sizeEl.value), shape: shapeEl.value };
        localStorage.setItem('crosshairSettings', JSON.stringify(state.crosshairConfig));
    }
};

// --- 3. HERNÍ SMYČKY (Kreslení a Fyzika) ---
let firstFrameLogged = false;

function renderLoop() {
    const canvas = document.getElementById('game');
    
    if (canvas) {
        // UDRŽUJEME SPRÁVNÉ ROZLIŠENÍ: Pokud hráč zmenší/zvětší okno, canvas se okamžitě přizpůsobí
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
            // Předáme data k vykreslení hernímu renderu
            drawGame(state.latestServerData);
        } else {
            // Pokud čekáme v lobby nebo data ještě nedorazila, aspoň plátno promažeme.
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
    if (!canvas) {
        console.error("❌ Plátno nenalezeno! React ještě nevykreslil <canvas id='game'>.");
        return;
    }

    // KRITICKÝ KROK PRO REACT: Okamžitě plátnu nastavíme 100% vnitřní velikost.
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.canvas = canvas; // Uložíme do state pro myš a ostatní skripty

    console.log(`🚀 Herní engine nastartován! Rozlišení plátna: ${canvas.width}x${canvas.height}`);
    
    // ---> TADY JE TA MAGIE: ZAPNEME OVLÁDÁNÍ <---
    initInputs(); 
    
    // Odstartování smyček
    requestAnimationFrame(renderLoop);
    setInterval(updateLocalGame, 1000 / 60); // Fyzika běží 60x za vteřinu
    
    engineStarted = true;
}