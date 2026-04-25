// game/state.js

export const state = {
    canvas: null,
    ctx: null,
    latestServerData: null,
    localObstacles: [],
    localBreakables: [],
    localBullets: [],
    remoteBullets: [],
    CARD_CATALOG: [],

    // Zobrazení
    gameScale: 1,
    gameOffsetX: 0,
    gameOffsetY: 0,

    // Vstupy a zaměřovač
    currentMouseX: 0,
    currentMouseY: 0,
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

    // --- SMOOTH INTERPOLATION (anti-rubberbanding) ---
    // Each entry: { x, y, aimAngle } — smoothed positions used ONLY for rendering.
    // Physics and server sync always use latestServerData.players directly.
    // Remote players lerp toward their server position every render frame.
    // Local player lerps toward server-corrected position only when correction > 10px.
    interpolatedPlayers: {},

    // Previous ritual key state — used to send ritualRequested only on rising edge
    _prevRitualState: false
};
