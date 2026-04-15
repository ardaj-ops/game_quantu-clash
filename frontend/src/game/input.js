<<<<<<< HEAD
// input.js

// Pověsíme objekt na window, aby byl snadno dostupný v game.js
window.playerInputs = {
    up: false,
    down: false,
    left: false,
    right: false,
    click: false,
    rightClick: false, // Dash / Rituál / Schopnost
    reload: false,     // Přebíjení (R)
    tab: false,        // Tabulka skóre (TAB)
    aimAngle: 0
};

// --- KLÁVESNICE ---
window.addEventListener('keydown', (e) => {
    // Ignorujeme držení klávesy, pokud zrovna uživatel píše do chatu atd.
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') window.playerInputs.up = true;
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') window.playerInputs.down = true;
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') window.playerInputs.left = true;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') window.playerInputs.right = true;
    
    if (e.key === 'r' || e.key === 'R') window.playerInputs.reload = true;
    
    if (e.key === 'Tab') {
        window.playerInputs.tab = true;
        e.preventDefault(); // Zabrání přepínání UI elementů v prohlížeči (např. url řádku)
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') window.playerInputs.up = false;
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') window.playerInputs.down = false;
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') window.playerInputs.left = false;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') window.playerInputs.right = false;
    
    if (e.key === 'r' || e.key === 'R') window.playerInputs.reload = false;
    if (e.key === 'Tab') window.playerInputs.tab = false;
});

// --- MYŠ ---
window.addEventListener('mousedown', (e) => {
    if (e.button === 0) window.playerInputs.click = true;      // Levé tlačítko (Střelba)
    if (e.button === 2) window.playerInputs.rightClick = true; // Pravé tlačítko (Dash)
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 0) window.playerInputs.click = false;
    if (e.button === 2) window.playerInputs.rightClick = false;
});

// Zamezení vyskakování kontextového menu prohlížeče při pravém kliku (aby šel hrát dash/akce bez vyrušení)
window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Sledování myši a výpočet úhlu zaměření
window.addEventListener('mousemove', (e) => {
    const canvas = document.getElementById('game'); 
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    
    // Získání reálné pozice myši vůči canvasu (ošetřuje i případné CSS škálování)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Předpoklad: Hráč je neustále vykreslován v centru obrazovky (kamera ho sleduje)
    const playerScreenX = canvas.width / 2;
    const playerScreenY = canvas.height / 2;

    // Výpočet úhlu v radiánech (od -PI do PI)
    window.playerInputs.aimAngle = Math.atan2(mouseY - playerScreenY, mouseX - playerScreenX);
});
=======
// game/input.js
import { state } from './state.js';

export function initInputs() {
    // Inicializujeme vstupy do centrálního stavu
    if (!state.playerInputs) {
        state.playerInputs = {
            up: false, down: false, left: false, right: false,
            click: false, rightClick: false, reload: false, tab: false,
            ritual: false, 
            aimAngle: 0
        };
    }

    // --- KLÁVESNICE ---
    window.addEventListener('keydown', (e) => {
        // Ignorujeme držení klávesy, pokud zrovna uživatel píše do chatu nebo formuláře
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key.toLowerCase();
        if (key === 'w' || e.key === 'arrowup') state.playerInputs.up = true;
        if (key === 's' || e.key === 'arrowdown') state.playerInputs.down = true;
        if (key === 'a' || e.key === 'arrowleft') state.playerInputs.left = true;
        if (key === 'd' || e.key === 'arrowright') state.playerInputs.right = true;
        
        if (key === 'r') state.playerInputs.reload = true;
        if (key === 'f') state.playerInputs.ritual = true; 
        
        if (e.key === 'Tab') {
            state.playerInputs.tab = true;
            e.preventDefault(); // Zabrání přepínání UI elementů v prohlížeči, když hráč chce vidět skóre
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'w' || e.key === 'arrowup') state.playerInputs.up = false;
        if (key === 's' || e.key === 'arrowdown') state.playerInputs.down = false;
        if (key === 'a' || e.key === 'arrowleft') state.playerInputs.left = false;
        if (key === 'd' || e.key === 'arrowright') state.playerInputs.right = false;
        
        if (key === 'r') state.playerInputs.reload = false;
        if (key === 'f') state.playerInputs.ritual = false; 
        if (e.key === 'Tab') state.playerInputs.tab = false;
    });

    // --- MYŠ ---
    window.addEventListener('mousedown', (e) => {
        // OPRAVA: Pokud uživatel kliká na UI (React), ignoruj to!
        // Střílet a dashovat chceme POUZE když kliká na herní canvas.
        if (e.target.id !== 'game') return;

        if (e.button === 0) state.playerInputs.click = true;       // Levé tlačítko (Střelba)
        if (e.button === 2) state.playerInputs.rightClick = true;  // Pravé tlačítko (Dash)
    });

    window.addEventListener('mouseup', (e) => {
        // MouseUp zachytáváme všude (bez filtru na target), abychom zabránili bugu,
        // kdy hráč klikne, vyjede myší mimo okno, pustí myš a zbraň by střílela donekonečna.
        if (e.button === 0) state.playerInputs.click = false;
        if (e.button === 2) state.playerInputs.rightClick = false;
    });

    // Zamezení vyskakování kontextového menu prohlížeče při pravém kliku (dash)
    window.addEventListener('contextmenu', (e) => {
        // Blokujeme to jen na plátně, aby mohl hráč normálně klikat pravým v UI, kdyby potřeboval
        if (e.target.id === 'game') {
            e.preventDefault();
        }
    });

    // --- SLEDOVÁNÍ MYŠI ---
    window.addEventListener('mousemove', (e) => {
        // 1. ČISTÉ POZICE MONITORU (Pro UI a HUD)
        // Toto si necháváme pro render.js, aby věděl, kam nakreslit zelený křížek (drawCrosshair)
        state.currentMouseX = e.clientX;
        state.currentMouseY = e.clientY;

        // 2. PŘEPOČET NA HERNÍ SVĚT (Pro fyziku a střelbu)
        // Získáme aktuální nastavení kamery z render.js (pokud už naběhla, jinak dáme výchozí nuly)
        const scale = state.gameScale || 1;
        const offsetX = state.gameOffsetX || 0;
        const offsetY = state.gameOffsetY || 0;

        // Vypočítáme, kam přesně v MAPĚ hráč ukazuje
        state.worldMouseX = (e.clientX - offsetX) / scale;
        state.worldMouseY = (e.clientY - offsetY) / scale;
    });
}
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
