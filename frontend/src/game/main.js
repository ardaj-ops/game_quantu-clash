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
    }
} catch (e) {
    console.warn("⚠️ Chyba při načítání zaměřovače z localStorage.");
}

// --- 2. UKLÁDÁNÍ Z UI (Zůstává pro kompatibilitu se starším HTML) ---
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

// --- 3. HERNÍ SMYČKA (Kreslení) ---
let firstFrameLogged = false;

function renderLoop() {
    // Vytahujeme canvas rovnou ze state, pokud už je uložený
    const canvas = state.canvas || document.getElementById('game');
    
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
            // Předáme data k vykreslení hernímu renderu (ten už teď obsluhuje kameru i plynulost)
            drawGame(state.latestServerData);
        } else {
            // Pokud čekáme v lobby, jen vykreslíme černé plátno místo blikání
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    requestAnimationFrame(renderLoop);
}

// --- 4. EXPORTOVANÁ FUNKCE PRO REACT ---
let engineStarted = false;

export function initGameEngine() {
    if (engineStarted) return; // Zabráníme vícenásobnému spuštění

    // --- SKRYTÍ LOBBY UI ---
    // Skryjeme staré HTML elementy, pokud existují (pro čistý přechod na React)
    const lobbyElements = [
        document.getElementById('lobby-container'), 
        document.getElementById('lobby'),
        document.querySelector('.lobby-wrapper') 
    ];

    lobbyElements.forEach(el => {
        if (el) {
            el.style.display = 'none';
            console.log("🙈 Lobby UI bylo skryto.");
        }
    });

    const canvas = document.getElementById('game');
    if (!canvas) {
        console.error("❌ Plátno nenalezeno! React ještě nevykreslil <canvas id='game'>.");
        return;
    }

    // Zviditelnění canvasu (pro jistotu, kdyby byl skrytý)
    canvas.style.display = 'block';

    // KRITICKÝ KROK PRO REACT: Okamžitě plátnu nastavíme 100% vnitřní velikost
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.canvas = canvas; 

    // Pojistka pro Dash: zablokování kontextového menu na celém dokumentu (nejen na canvasu)
    document.addEventListener('contextmenu', event => event.preventDefault());

    console.log(`🚀 Herní engine nastartován! Rozlišení plátna: ${canvas.width}x${canvas.height}`);
    
    // ZAPNEME OVLÁDÁNÍ (z input.js)
    initInputs(); 
    
    // Odstartování smyček
    requestAnimationFrame(renderLoop);
    setInterval(updateLocalGame, 1000 / 60); // Fyzika běží stabilně 60x za vteřinu
    
    engineStarted = true;
}