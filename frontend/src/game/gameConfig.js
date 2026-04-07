/* =========================================
   PUBLIC/JS/GAMECONFIG.JS
   ========================================= */

const CONFIG = {
    // --- MAPA A SERVER ---
    MAP_WIDTH: 1920,
    MAP_HEIGHT: 1080,
    FPS: 60,
    MAX_SCORE: 25,               // Zápasy budou svižnější a napínavější.
    
    // --- SYSTÉM HRY ---
    RESPAWN_TIME: 3000,          // Čas v milisekundách, než se mrtvý hráč znovu objeví (3s)
    SPAWN_PROTECTION: 2000,      // Doba nezranitelnosti po spawnu (2s) zabrání okamžitému zabití
    
    // --- HRÁČ (Základní staty) ---
    PLAYER_RADIUS: 20,
    MIN_PLAYER_DISTANCE: 400,    // Aby se hráči nespawnovali hned u sebe.
    BASE_HP: 100,
    BASE_DAMAGE: 20,
    BASE_FIRE_RATE: 400,         // v milisekundách (2.5 rány za vteřinu)
    BASE_BULLET_SPEED: 15,
    BASE_MOVE_SPEED: 0.8,        // Základní rychlost pohybu
    BASE_AMMO: 10,               // Základní velikost zásobníku
    BASE_RELOAD_TIME: 1500,      // Doba přebití celého zásobníku (1.5s)
    
    // Defaultní hodnoty pro pokročilé mechaniky
    BASE_LIFESTEAL: 0,
    BASE_BOUNCES: 0,
    BASE_PIERCE: 0,

    // --- DASH (ÚHYB) MECHANIKA ---
    DASH_COOLDOWN: 3000,         // Za jak dlouho lze dash použít znovu (3s)
    DASH_DURATION: 200,          // Jak dlouho trvá samotný "skok" v ms (0.2s)
    DASH_SPEED_MULTIPLIER: 4,    // Kolikrát rychlejší je hráč během dashe (4x)

    // --- HARD CAPS (PvP Limity, aby hra zůstala fér a nerozbila engine) ---
    MAX_CAP_HP: 600,
    MIN_CAP_HP: 30,              // Zabrání tomu, aby tě zabila jedna zbloudilá slabá kulka.
    MAX_CAP_DAMAGE: 999,         // Pro přehlednost kódu stačí 999 na "instant kill".
    MIN_CAP_FIRE_RATE: 50,       // Minimální prodleva mezi výstřely v ms (max 20 ran za vteřinu).
    
    MAX_CAP_MOVE_SPEED: 3.5,     // Rychlost, při které se dá ještě rozumně mířit (cca 4x base speed).
    MIN_CAP_MOVE_SPEED: 0.2,     // Zabrání úplnému přimrazení hráče na místě (musí být pod base speed!).
    
    MAX_CAP_BULLET_SPEED: 80,    // Max rychlost projektilu (aby neprolétal zdmi kvůli FPS).
    MIN_CAP_BULLET_SPEED: 3,     // Aby se extrémně pomalé kulky nezastavily ve vzduchu.
    MAX_CAP_AMMO: 99,            // Omezeno, aby na mapě nebyl neřešitelný spam.
    MAX_CAP_LIFESTEAL: 0.50,     // Max 50 % lifesteal. Zabrání nesmrtelnosti.
    MAX_CAP_BOUNCES: 10,         // Zvednuto na 10 pro extrémní buildy a vizuální chaos.
    MAX_CAP_PIERCE: 15,          // Maximální počet těl, kterými kulka projde.

    // --- SCHOPNOSTI, RITUÁLY A ČASOVÁNÍ ---
    ABILITY_COOLDOWN_DOMAIN: 18000, // Domény jsou silné, musí být víc "high risk/high reward" (18s).
    ABILITY_COOLDOWN_NORMAL: 6000,  // Klasické aktivní schopnosti (6s).
    DOMAIN_RADIUS: 350,             // Základní velikost rituální oblasti.

    // --- PROJEKTILY A GRAVITACE ---
    BULLET_RADIUS: 5,               // Velikost hit-boxu projektilu pro přesnější detekci kolizí
    GRAVITY_CHANGE_INTERVAL: 10000, // Jak často se mění gravitace (10s)
    GRAVITY_OPTIONS: [
        { name: 'Dolů', x: 0, y: 0.5 },
        { name: 'Nahoru', x: 0, y: -0.5 },
        { name: 'Doleva', x: -0.5, y: 0 },
        { name: 'Doprava', x: 0.5, y: 0 },
        { name: 'Žádná', x: 0, y: 0 } 
    ]
};

// =========================================
// EXPORT PRO FRONTEND I BACKEND
// =========================================

// Pro Node.js (Backend - server.js a další soubory)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// Pro Prohlížeč (Frontend - window objekt)
if (typeof window !== 'undefined') {
    // Pro jistotu umožníme přístup jak přes window.CONFIG, tak přímo vložením globálních proměnných
    window.CONFIG = CONFIG;
    // Tímto zpřístupníme všechny vlastnosti rovnou do globálního scope klienta (např. MAP_WIDTH bez prefixu)
    Object.assign(window, CONFIG);
}