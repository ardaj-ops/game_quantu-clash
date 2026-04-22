// game/input.js
import { state } from './state.js';

export function initInputs() {
    // Inicializujeme vstupy do centrálního stavu
    if (!state.playerInputs) {
        state.playerInputs = {
            up: false, down: false, left: false, right: false,
            click: false, rightClick: false, reload: false, tab: false,
            ritual: false, dash: false,
            aimAngle: 0
        };
    }

    // --- KLÁVESNICE ---
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key.toLowerCase();
        if (key === 'w' || key === 'arrowup') state.playerInputs.up = true;
        if (key === 's' || key === 'arrowdown') state.playerInputs.down = true;
        if (key === 'a' || key === 'arrowleft') state.playerInputs.left = true;
        if (key === 'd' || key === 'arrowright') state.playerInputs.right = true;
        
        if (key === 'r') state.playerInputs.reload = true;
        if (key === 'f') state.playerInputs.ritual = true; 
        
        if (e.key === 'Tab') {
            state.playerInputs.tab = true;
            e.preventDefault(); 
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key.toLowerCase();
        if (key === 'w' || key === 'arrowup') state.playerInputs.up = false;
        if (key === 's' || key === 'arrowdown') state.playerInputs.down = false;
        if (key === 'a' || key === 'arrowleft') state.playerInputs.left = false;
        if (key === 'd' || key === 'arrowright') state.playerInputs.right = false;
        
        if (key === 'r') state.playerInputs.reload = false;
        if (key === 'f') state.playerInputs.ritual = false;
        
        if (e.key === 'Tab') {
            state.playerInputs.tab = false;
            e.preventDefault();
        }
    });

    // GLOBÁLNÍ BLOKOVÁNÍ KONTEXTOVÉHO MENU (zajišťuje plynulý dash)
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // --- SLEDOVÁNÍ MYŠI A KLIKÁNÍ ---
    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) state.playerInputs.click = true;
        if (e.button === 2) {
            state.playerInputs.rightClick = true;
            state.playerInputs.dash = true; // Zde je oprava pro Dash!
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) state.playerInputs.click = false;
        if (e.button === 2) {
            state.playerInputs.rightClick = false;
            state.playerInputs.dash = false; // Dash se musí vypnout po uvolnění
        }
    });

    window.addEventListener('mousemove', (e) => {
        state.currentMouseX = e.clientX;
        state.currentMouseY = e.clientY;

        const scale = state.gameScale || 1;
        const offsetX = state.gameOffsetX || 0;
        const offsetY = state.gameOffsetY || 0;

        state.worldMouseX = (e.clientX - offsetX) / scale;
        state.worldMouseY = (e.clientY - offsetY) / scale;
    });
}