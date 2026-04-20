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
    MIN_CAP_BULLET_SPEED: 3,
    MAX_CAP_AMMO: 99,
    MAX_CAP_LIFESTEAL: 0.50,
    MAX_CAP_BOUNCES: 10,
    MAX_CAP_PIERCE: 15,

    // --- SCHOPNOSTI ---
    ABILITY_COOLDOWN_DOMAIN: 18000,
    ABILITY_COOLDOWN_NORMAL: 6000,
    DOMAIN_RADIUS: 350,

    // --- PROJEKTILY A GRAVITACE ---
    BULLET_RADIUS: 5,
    GRAVITY_CHANGE_INTERVAL: 10000,
    GRAVITY_OPTIONS: [
        { name: 'Dolů',    x: 0,    y: 0.5  },
        { name: 'Nahoru',  x: 0,    y: -0.5 },
        { name: 'Doleva',  x: -0.5, y: 0    },
        { name: 'Doprava', x: 0.5,  y: 0    },
        { name: 'Žádná',   x: 0,    y: 0    }
    ]
};