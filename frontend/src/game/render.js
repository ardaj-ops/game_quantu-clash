// renderer.js
import { state, CONFIG } from './state.js';
import { socket } from './network.js';

const TWO_PI = Math.PI * 2;

// Sem překopíruj funkce:
// drawGrid, drawBackground, drawDomains, drawMapObjects
// drawCosmetics, drawAvatar, drawDecoys, drawPlayers, drawBullets
// drawTabMenu, updateDOM_HUD, drawCrosshair

export function drawGame(serverData) {
    if (!state.canvas) {
        state.canvas = document.getElementById('game');
        if (state.canvas) state.ctx = state.canvas.getContext('2d');
    }

    if (!serverData || !state.ctx || !state.canvas) return;
    const playersData = serverData.leanPlayers || serverData.players || {};
    state.canvas.style.cursor = (serverData.gameState === 'PLAYING') ? 'none' : 'default';

    if (state.canvas.width !== window.innerWidth || state.canvas.height !== window.innerHeight) {
        state.canvas.width = window.innerWidth;
        state.canvas.height = window.innerHeight;
    }
    
    state.ctx.fillStyle = '#000000';
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    state.gameScale = Math.min(state.canvas.width / CONFIG.MAP_W, state.canvas.height / CONFIG.MAP_H);
    state.gameOffsetX = (state.canvas.width - CONFIG.MAP_W * state.gameScale) / 2;
    state.gameOffsetY = (state.canvas.height - CONFIG.MAP_H * state.gameScale) / 2;

    state.ctx.save();
    state.ctx.translate(state.gameOffsetX, state.gameOffsetY);
    state.ctx.scale(state.gameScale, state.gameScale);

    drawBackground(playersData); // Zavolá tvoji původní logiku
    drawMapObjects(state.localObstacles, state.localBreakables);

    if (serverData.gameState !== 'LOBBY') {
        drawDomains(playersData);
        if (serverData.decoys) drawDecoys(serverData.decoys, playersData);
        drawPlayers(playersData);
        drawBullets(serverData.bullets, playersData);
        
        if (socket && playersData[socket.id]) {
            updateDOM_HUD(playersData[socket.id]);
        }
    }
    
    state.ctx.restore();

    if (serverData.gameState === 'PLAYING') {
        if (!state.playerInputs.tab) {
            drawCrosshair(); 
        } else {
            drawTabMenu(playersData);
        }
    }

    if (serverData.gameState === 'SCOREBOARD') {
        state.ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
        state.ctx.fillStyle = "white";
        state.ctx.font = "bold 50px Arial";
        state.ctx.textAlign = "center";
        state.ctx.fillText("KOLO SKONČILO", state.canvas.width / 2, state.canvas.height / 2);
    } 
}