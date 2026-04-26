// game/state.js
export const state = {
    canvas: null,
    ctx:    null,
    latestServerData: null,
    localObstacles:  [],
    localBreakables: [],
    localBullets:    [],
    remoteBullets:   [],
    CARD_CATALOG:    [],

    // Rendering scale/offset (letterbox)
    gameScale:   1,
    gameOffsetX: 0,
    gameOffsetY: 0,

    // Raw mouse position (screen space)
    currentMouseX: 0,
    currentMouseY: 0,
    // Mouse in world/map space
    worldMouseX: 0,
    worldMouseY: 0,

    crosshairConfig: { color: '#45f3ff', size: 10, shape: 'cross' },

    playerInputs: {
        up: false, down: false, left: false, right: false,
        click: false, rightClick: false, reload: false, tab: false,
        ritual: false, dash: false,
        aimAngle: 0
    },

    lastShotTime: 0,

    // Smooth interpolated positions for rendering (keyed by player id).
    // Physics and server sync always read latestServerData.players directly.
    // render.js draws from interpolatedPlayers so remote players never snap.
    interpolatedPlayers: {}
};