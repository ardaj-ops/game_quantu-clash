// input.js

// Objekt, který drží aktuální stav všeho, co hráč mačká
const playerInputs = {
    up: false,
    down: false,
    left: false,
    right: false,
    click: false,
    rightClick: false, // Přidáno pro Dash / Rituál
    reload: false,     // Přidáno pro přebíjení (R)
    tab: false,        // Přidáno pro tabulku (TAB)
    aimAngle: 0
};

// --- KLÁVESNICE ---
window.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') playerInputs.up = true;
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') playerInputs.down = true;
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') playerInputs.left = true;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') playerInputs.right = true;
    
    if (e.key === 'r' || e.key === 'R') playerInputs.reload = true;
    
    if (e.key === 'Tab') {
        playerInputs.tab = true;
        e.preventDefault(); // Zabrání přepínání UI elementů v prohlížeči
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') playerInputs.up = false;
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') playerInputs.down = false;
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') playerInputs.left = false;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') playerInputs.right = false;
    
    if (e.key === 'r' || e.key === 'R') playerInputs.reload = false;
    if (e.key === 'Tab') playerInputs.tab = false;
});

// --- MYŠ ---
window.addEventListener('mousedown', (e) => {
    if (e.button === 0) playerInputs.click = true;      // Levé tlačítko
    if (e.button === 2) playerInputs.rightClick = true; // Pravé tlačítko
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 0) playerInputs.click = false;
    if (e.button === 2) playerInputs.rightClick = false;
});

// Zamezení vyskakování kontextového menu prohlížeče při pravém kliku
window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
    // Opraveno ID, v index.html máš <canvas id="game">
    const canvas = document.getElementById('game'); 
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Pokud je hráč vždy vykreslován uprostřed plátna:
    const playerScreenX = canvas.width / 2;
    const playerScreenY = canvas.height / 2;

    playerInputs.aimAngle = Math.atan2(mouseY - playerScreenY, mouseX - playerScreenX);
});

// --- ODESÍLÁNÍ NA SERVER ---
// Tento interval neustále (60x za vteřinu) křičí na server: "Tohle zrovna držím!"
setInterval(() => {
    // Předpokládám, že proměnnou 'socket' a 'gameState' máš definovanou globálně v main.js
    if (typeof socket !== 'undefined' && typeof gameState !== 'undefined' && gameState === 'PLAYING') {
        socket.emit('playerInput', playerInputs);
    }
}, 1000 / 60);