/* =========================================
   GAMECONFIG.JS - Sdílená konfigurace hry
   Pouze ES6 export (pro Vite/React frontend).
   Backend načítá hodnoty přes loadSharedFile() v server.js.
   ========================================= */

export const CONFIG = {
    // --- MAPA A SERVER ---
    MAP_WIDTH: 1920,
    MAP_HEIGHT: 1080,
    FPS: 60,
    MAX_SCORE: 25,

    // --- SYSTÉM HRY ---
    RESPAWN_TIME: 3000,
    SPAWN_PROTECTION: 2000,

    // --- HRÁČ (Základní staty) ---
    PLAYER_RADIUS: 20,
    MIN_PLAYER_DISTANCE: 400,
    BASE_HP: 100,
    BASE_DAMAGE: 20,
    BASE_FIRE_RATE: 400,
    BASE_BULLET_SPEED: 15,
    BASE_MOVE_SPEED: 0.8,
    BASE_AMMO: 10,
    BASE_RELOAD_TIME: 1500,

    BASE_LIFESTEAL: 0,
    BASE_BOUNCES: 0,
    BASE_PIERCE: 0,

    // --- DASH ---
    DASH_COOLDOWN: 3000,
    DASH_DURATION: 200,
    DASH_SPEED_MULTIPLIER: 4,

    // --- HARD CAPS ---
    MAX_CAP_HP: 600,
    MIN_CAP_HP: 30,
    MAX_CAP_DAMAGE: 999,
    MIN_CAP_FIRE_RATE: 50,
    MAX_CAP_MOVE_SPEED: 3.5,
    MIN_CAP_MOVE_SPEED: 0.2,
    MAX_CAP_BULLET_SPEED: 80,
    MAX_CAP_AMMO: 99,
    MAX_CAP_LIFESTEAL: 0.50,
    MAX_CAP_BOUNCES: 10,
    MAX_CAP_PIERCE: 15,

    // --- OSTATNÍ ---
    GRAVITY_OPTIONS: [
        { name: "Normal", x: 0, y: 0 },
        { name: "Moon", x: 0, y: 0.2 },
        { name: "Heavy", x: 0, y: 1.5 },
        { name: "Windy Left", x: -0.5, y: 0 },
        { name: "Windy Right", x: 0.5, y: 0 }
    ],
    GRAVITY_CHANGE_INTERVAL: 10000
};