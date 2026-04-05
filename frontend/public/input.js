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