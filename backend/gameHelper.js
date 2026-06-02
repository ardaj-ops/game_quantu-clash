// ============================================================
//  QUANTUM CLASH — gameHelper.js
//  PATCH v16 (2026-05-18):
//    ✨ Card rarity: exact percentage system (common 40%, uncommon 25%,
//       rare 18%, epic 10%, legendary 4.5%, mythic 1.5%, exotic 0.8%,
//       transcended 0.2%) instead of arbitrary weight pool
//    🐛 Rarity fallback now steps down one tier at a time
//  PATCH v9: INNER_MARGIN 520→80, obstacle count guarantee
//  See patchNotes.js for full history.
// ============================================================
// gameHelper.js

const RARITY_WEIGHTS = {
    'common':     100,
    'uncommon':    70,
    'rare':        40,
    'epic':        15,
    'legendary':    5,
    'mythic':       2,
    'exotic':       0.8,
    'transcended':  0.1
};

const checkRectCollision = (circleX, circleY, radius, rect) => {
    const closestX = Math.max(rect.x, Math.min(circleX, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circleY, rect.y + rect.height));
    const dx = circleX - closestX;
    const dy = circleY - closestY;
    return (dx * dx + dy * dy) < (radius * radius);
};

// Spawns are 500px from every border so players never clip into walls
const getFixedSpawns = (mapWidth, mapHeight) => [
    { x: 500,             y: 500              },
    { x: mapWidth - 500,  y: mapHeight - 500  },
    { x: mapWidth - 500,  y: 500              },
    { x: 500,             y: mapHeight - 500  },
    { x: mapWidth / 2,    y: 500              },
    { x: mapWidth / 2,    y: mapHeight - 500  },
    { x: 500,             y: mapHeight / 2    },
    { x: mapWidth - 500,  y: mapHeight / 2    },
];

// FIX v18: Fully random spawns — no fixed corner points.
// Each spawn is rolled randomly and checked for: border clearance,
// obstacle overlap, and minimum gap from already-spawned players.
// This prevents players always spawning in the same corners every round.
const getValidSpawnPoint = (
    playerIndex, mapWidth, mapHeight,
    obstacles, breakables,
    playerRadius = 20,
    usedPositions = []
) => {
    const BORDER_MARGIN   = 80;   // stay at least 80px from arena edge
    const OBSTACLE_CLEAR  = playerRadius + 40;  // clearance from obstacle surfaces
    const MIN_PLAYER_GAP  = playerRadius * 6;   // min distance between two spawns

    const isBlocked = (x, y) => {
        if (x < BORDER_MARGIN || x > mapWidth  - BORDER_MARGIN) return true;
        if (y < BORDER_MARGIN || y > mapHeight - BORDER_MARGIN) return true;
        if (obstacles.some(obs => checkRectCollision(x, y, OBSTACLE_CLEAR, obs))) return true;
        if (breakables.some(w => !w.destroyed && checkRectCollision(x, y, OBSTACLE_CLEAR, w))) return true;
        if (usedPositions.some(p => Math.hypot(x - p.x, y - p.y) < MIN_PLAYER_GAP)) return true;
        return false;
    };

    // Try 500 random positions — should always find one on a 1920×1080 map
    for (let attempt = 0; attempt < 500; attempt++) {
        const x = BORDER_MARGIN + Math.random() * (mapWidth  - BORDER_MARGIN * 2);
        const y = BORDER_MARGIN + Math.random() * (mapHeight - BORDER_MARGIN * 2);
        if (!isBlocked(x, y)) return { x, y };
    }

    // Absolute fallback: widen gap constraints progressively
    for (let relax = 0; relax < 3; relax++) {
        const factor = 1 - relax * 0.3;
        for (let attempt = 0; attempt < 200; attempt++) {
            const x = BORDER_MARGIN + Math.random() * (mapWidth  - BORDER_MARGIN * 2);
            const y = BORDER_MARGIN + Math.random() * (mapHeight - BORDER_MARGIN * 2);
            if (!obstacles.some(obs => checkRectCollision(x, y, OBSTACLE_CLEAR * factor, obs)) &&
                !usedPositions.some(p => Math.hypot(x - p.x, y - p.y) < MIN_PLAYER_GAP * factor))
                return { x, y };
        }
    }

    console.warn('⚠️ getValidSpawnPoint: hard fallback');
    return { x: mapWidth / 2 + (Math.random()-0.5)*200, y: mapHeight / 2 + (Math.random()-0.5)*200 };
};

const generateCardsForPlayer = (player, availableCards) => {
    if (!availableCards?.length || !player) return [];

    let validCards = availableCards
        .map((c, i) => ({ originalIndex: i, data: c }))
        .filter(({ data: c }) => {
            if (c.rarity === 'transcended' && !c.requiresDomain && !c.specificDomain) {
                if (player.domainType) return false;
            }
            if (c.requiresDomain && !c.specificDomain) {
                if (!player.domainType) return false;
            }
            if (c.specificDomain) {
                if (player.domainType !== c.specificDomain) return false;
            }
            return true;
        });

    const pickedIndices = new Set();
    const cardsToSend   = [];

    while (cardsToSend.length < 3 && pickedIndices.size < validCards.length) {
        const unpicked = validCards.filter(c => !pickedIndices.has(c.originalIndex));
        if (unpicked.length === 0) break;

        let totalWeight = 0;
        const weighted = unpicked.map(c => {
            const w = RARITY_WEIGHTS[(c.data.rarity || 'common').toLowerCase()] || 10;
            totalWeight += w;
            return { card: c, weight: w };
        });

        let pick = Math.random() * totalWeight;
        let cum  = 0;
        let selected = weighted[weighted.length - 1].card;
        for (const item of weighted) {
            cum += item.weight;
            if (pick <= cum) { selected = item.card; break; }
        }

        pickedIndices.add(selected.originalIndex);
        cardsToSend.push({ ...selected.data, globalIndex: selected.originalIndex });
    }

    return cardsToSend;
};

const generateMap = (mapWidth, mapHeight) => {
    // BUG FIX: INNER_MARGIN was 520 — on a 1080-high map the obstacle y-range
    // was 520→480 (inverted), so ZERO obstacles ever spawned. Fixed to 80px.
    // Obstacles stay well within the playable area without blocking spawns.
    const INNER_MARGIN = 80;

    // Spawn protection: obstacles must stay away from fixed spawn corners
    const fixedSpawns = getFixedSpawns(mapWidth, mapHeight);
    const SPAWN_PROTECTION = 130;

    const isOverlappingSpawn = (rect) =>
        fixedSpawns.some(s => checkRectCollision(s.x, s.y, SPAWN_PROTECTION, rect));

    const isOverlappingObstacle = (rect, list) =>
        list.some(ex => {
            const gap = 8;
            return !(
                rect.x + rect.width  + gap < ex.x ||
                ex.x + ex.width  + gap < rect.x ||
                rect.y + rect.height + gap < ex.y ||
                ex.y + ex.height + gap < rect.y
            );
        });

    // Invisible border collision objects (used by physics for bounce detection)
    // Placed slightly outside the map edge so they don't visually render
    // but bullets and players still collide with them.
    const BORDER_THICKNESS = 60;
    const borderWalls = [
        { id: 'border-top',    x: -BORDER_THICKNESS, y: -BORDER_THICKNESS, width: mapWidth + BORDER_THICKNESS * 2, height: BORDER_THICKNESS, isBorder: true },
        { id: 'border-bottom', x: -BORDER_THICKNESS, y: mapHeight,          width: mapWidth + BORDER_THICKNESS * 2, height: BORDER_THICKNESS, isBorder: true },
        { id: 'border-left',   x: -BORDER_THICKNESS, y: 0,                  width: BORDER_THICKNESS, height: mapHeight, isBorder: true },
        { id: 'border-right',  x: mapWidth,           y: 0,                  width: BORDER_THICKNESS, height: mapHeight, isBorder: true },
    ];

    const obstacles = [...borderWalls];
    const breakables = [];

    // Interior indestructible walls — guarantee at least 8
    // BUG FIX: attempt many more times (25 tries) to reach the target count
    const interiorObstacles = [];
    const TARGET_SOLID = 8;
    let solidAttempts = 0;
    while (interiorObstacles.length < TARGET_SOLID && solidAttempts < 60) {
        solidAttempts++;
        const width  = Math.floor(Math.random() * 160) + 60;
        const height = Math.floor(Math.random() * 160) + 60;
        const candidate = {
            x: Math.floor(Math.random() * (mapWidth  - width  - INNER_MARGIN * 2)) + INNER_MARGIN,
            y: Math.floor(Math.random() * (mapHeight - height - INNER_MARGIN * 2)) + INNER_MARGIN,
            width, height
        };
        if (!isOverlappingSpawn(candidate) && !isOverlappingObstacle(candidate, interiorObstacles)) {
            interiorObstacles.push(candidate);
        }
    }
    obstacles.push(...interiorObstacles);

    // Breakable walls (1-hit destruction)
    const allSolid = [...obstacles];
    const TARGET_BREAKABLE = 8;
    let brkAttempts = 0;
    while (breakables.length < TARGET_BREAKABLE && brkAttempts < 60) {
        brkAttempts++;
        const isHorizontal = Math.random() > 0.5;
        const width  = isHorizontal ? Math.floor(Math.random() * 120) + 80 : Math.floor(Math.random() * 20) + 20;
        const height = isHorizontal ? Math.floor(Math.random() * 20) + 20  : Math.floor(Math.random() * 120) + 80;
        const candidate = {
            id: breakables.length,
            x: Math.floor(Math.random() * (mapWidth  - width  - INNER_MARGIN * 2)) + INNER_MARGIN,
            y: Math.floor(Math.random() * (mapHeight - height - INNER_MARGIN * 2)) + INNER_MARGIN,
            width, height,
            hp: 1, maxHp: 1,
            destroyed: false
        };
        if (!isOverlappingSpawn(candidate) && !isOverlappingObstacle(candidate, allSolid)) {
            breakables.push(candidate);
            allSolid.push(candidate);
        }
    }

    return { obstacles, breakables };
};

module.exports = {
    RARITY_WEIGHTS,
    getValidSpawnPoint,
    generateCardsForPlayer,
    generateMap,
    checkRectCollision
};
