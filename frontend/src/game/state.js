// state.js
<<<<<<< HEAD
export const CONFIG = {
    MAP_W: 2000,
    MAP_H: 2000,
    DASH_COOLDOWN: 3000
};
=======
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076

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
<<<<<<< HEAD
    playerInputs: { up: false, down: false, left: false, right: false, click: false, rightClick: false, reload: false, tab: false, aimAngle: 0 },
=======
    playerInputs: { 
        up: false, down: false, left: false, right: false, 
        click: false, rightClick: false, reload: false, tab: false, 
        aimAngle: 0 
    },
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
    lastShotTime: 0
};