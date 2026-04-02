// input.js

// Objekt, který drží aktuální stav všeho, co hráč mačká
const playerInputs = {
    up: false,
    down: false,
    left: false,
    right: false,
    click: false,
    aimAngle: 0
};

// --- KLÁVESNICE ---
window.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp') playerInputs.up = true;
    if (e.key === 's' || e.key === 'ArrowDown') playerInputs.down = true;
    if (e.key === 'a' || e.key === 'ArrowLeft') playerInputs.left = true;
    if (e.key === 'd' || e.key === 'ArrowRight') playerInputs.right = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp') playerInputs.up = false;
    if (e.key === 's' || e.key === 'ArrowDown') playerInputs.down = false;
    if (e.key === 'a' || e.key === 'ArrowLeft') playerInputs.left = false;
    if (e.key === 'd' || e.key === 'ArrowRight') playerInputs.right = false;
});

// --- MYŠ ---
window.addEventListener('mousedown', (e) => {
    if (e.button === 0) playerInputs.click = true; // Levé tlačítko
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 0) playerInputs.click = false;
});

window.addEventListener('mousemove', (e) => {
    // Výpočet úhlu natočení myši vůči středu obrazovky (předpokládáme, že hráč je uprostřed)
    // Pokud máš kameru, která se hýbe, budeš tu možná muset přičíst pozici kamery.
    const canvas = document.getElementById('canvas'); // nebo jak se jmenuje tvé plátno
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