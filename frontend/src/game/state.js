// state.js
export const CONFIG = {
    MAP_W: 2000,
    MAP_H: 2000,
    DASH_COOLDOWN: 3000
};

export const state = {
    canvas: null,
    ctx: null,
    latestServerData: null,
    localObstacles: [],
    localBreakables: [],
    localBullets: [],
    CARD_CATALOG: [],
    
    // Zobrazení
    gameScale: 1,
    gameOffsetX: 0,
    gameOffsetY: 0,
    
    // Vstupy a zaměřovač
    currentMouseX: 0,
    currentMouseY: 0,
    crosshairConfig: { color: '#45f3ff', size: 10, shape: 'cross' },
    playerInputs: { up: false, down: false, left: false, right: false, click: false, rightClick: false, reload: false, tab: false, aimAngle: 0 },
    lastShotTime: 0
};