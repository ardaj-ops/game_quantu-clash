// game/input.js
import { state } from './state.js';

export function initInputs() {
    // Inicializujeme vstupy do centrálního stavu (místo na window)
    if (!state.playerInputs) {
        state.playerInputs = {
            up: false, down: false, left: false, right: false,
            click: false, rightClick: false, reload: false, tab: false,
            aimAngle: 0
        };
    }

    // --- KLÁVESNICE ---
    window.addEventListener('keydown', (e) => {
        // Ignorujeme držení klávesy, pokud zrovna uživatel píše do chatu atd.
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key.toLowerCase();
        if (key === 'w' || e.key === 'arrowup') state.playerInputs.up = true;
        if (key === 's' || e.key === 'arrowdown') state.playerInputs.down = true;
        if (key === 'a' || e.key === 'arrowleft') state.playerInputs.left = true;
        if (key === 'd' || e.key === 'arrowright') state.playerInputs.right = true;
        
        if (key === 'r') state.playerInputs.reload = true;
        
        if (e.key === 'Tab') {
            state.playerInputs.tab = true;
            e.preventDefault(); // Zabrání přepínání UI elementů v prohlížeči
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'w' || e.key === 'arrowup') state.playerInputs.up = false;
        if (key === 's' || e.key === 'arrowdown') state.playerInputs.down = false;
        if (key === 'a' || e.key === 'arrowleft') state.playerInputs.left = false;
        if (key === 'd' || e.key === 'arrowright') state.playerInputs.right = false;
        
        if (key === 'r') state.playerInputs.reload = false;
        if (e.key === 'Tab') state.playerInputs.tab = false;
    });

    // --- MYŠ ---
    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) state.playerInputs.click = true;       // Levé tlačítko (Střelba)
        if (e.button === 2) state.playerInputs.rightClick = true;  // Pravé tlačítko (Dash)
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) state.playerInputs.click = false;
        if (e.button === 2) state.playerInputs.rightClick = false;
    });

    // Zamezení vyskakování kontextového menu prohlížeče při pravém kliku
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // --- SLEDOVÁNÍ MYŠI ---
    window.addEventListener('mousemove', (e) => {
        // Ukládáme si čisté pozice myši na monitoru.
        // Složitý výpočet samotného úhlu (aimAngle) vzhledem ke kameře a mapě
        // už pro nás automaticky a mnohem přesněji řeší physics.js!
        state.currentMouseX = e.clientX;
        state.currentMouseY = e.clientY;
    });
}