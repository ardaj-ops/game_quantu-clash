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