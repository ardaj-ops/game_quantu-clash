// game/state.js

export const state = {
    canvas: null,
    ctx: null,
    latestServerData: null,
    localObstacles: [],
    localBreakables: [],
    localBullets: [],
    remoteBullets: [],  // Střely ostatních hráčů přijaté přes enemyShot
    CARD_CATALOG: [],
    
    // Zobrazení
    gameScale: 1,
    gameOffsetX: 0,
    gameOffsetY: 0,
    
    // Vstupy a zaměřovač
    currentMouseX: 0,
    currentMouseY: 0,
    // Souřadnice myši přepočítané na herní svět
    worldMouseX: 0,
    worldMouseY: 0,
    crosshairConfig: { color: '#45f3ff', size: 10, shape: 'cross' },
    
    playerInputs: { 
        up: false, down: false, left: false, right: false, 
        click: false, rightClick: false, reload: false, tab: false, 
        ritual: false, dash: false, // OPRAVA: Přidán dash do výchozího stavu
        aimAngle: 0 
    },
    
    lastShotTime: 0
};