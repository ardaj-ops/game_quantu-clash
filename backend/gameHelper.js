// gameHelper.js

// Exact percentage chances per rarity (must sum to 100)
// common=40%, uncommon=25%, rare=18%, epic=10%, legendary=4.5%, mythic=1.5%, exotic=0.8%, transcended=0.2%
const RARITY_CHANCES = {
    'common':     40.0,
    'uncommon':   25.0,
    'rare':       18.0,
    'epic':       10.0,
    'legendary':   4.5,
    'mythic':      1.5,
    'exotic':      0.8,
    'transcended': 0.2
};
// Keep alias for any code referencing RARITY_WEIGHTS
const RARITY_WEIGHTS = RARITY_CHANCES;

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

const getValidSpawnPoint = (
    playerIndex, mapWidth, mapHeight,
    obstacles, breakables,
    playerRadius = 20,
    usedPositions = []
) => {
    const BORDER_MARGIN = 500;

    const isPositionBlocked = (x, y) => {
        if (x < BORDER_MARGIN || x > mapWidth  - BORDER_MARGIN) return true;
        if (y < BORDER_MARGIN || y > mapHeight - BORDER_MARGIN) return true;
        if (obstacles.some(obs => checkRectCollision(x, y, playerRadius + 15, obs))) return true;
        if (breakables.some(w => !w.destroyed && checkRectCollision(x, y, playerRadius + 15, w))) return true;
        const minSpawnGap = playerRadius * 5;
        if (usedPositions.some(pos => Math.hypot(x - pos.x, y - pos.y) < minSpawnGap)) return true;
        return false;
    };

    const fixedSpawns = getFixedSpawns(mapWidth, mapHeight);
    for (let i = 0; i < fixedSpawns.length; i++) {
        const candidate = fixedSpawns[(playerIndex + i) % fixedSpawns.length];
        if (!isPositionBlocked(candidate.x, candidate.y)) return candidate;
    }

    for (let attempt = 0; attempt < 300; attempt++) {
        const x = BORDER_MARGIN + Math.random() * (mapWidth  - BORDER_MARGIN * 2);
        const y = BORDER_MARGIN + Math.random() * (mapHeight - BORDER_MARGIN * 2);
        if (!isPositionBlocked(x, y)) return { x, y };
    }

    console.warn('⚠️ getValidSpawnPoint: fallback to center');
    return { x: mapWidth / 2, y: mapHeight / 2 };
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

        // Percentage-based rarity selection:
        // 1. Roll a rarity using exact percentage chances
        // 2. Pick a random card of that rarity (or fall back to closest available)
        const roll = Math.random() * 100;
        let cumPct = 0;
        let targetRarity = 'common';
        const rarityOrder = ['transcended','exotic','mythic','legendary','epic','rare','uncommon','common'];
        // Roll from rarest to most common so high rolls land on common
        const rarityOrderAsc = ['common','uncommon','rare','epic','legendary','mythic','exotic','transcended'];
        for (const rar of rarityOrderAsc) {
            cumPct += RARITY_CHANCES[rar] || 0;
            if (roll < cumPct) { targetRarity = rar; break; }
        }

        // Find cards of the rolled rarity among unpicked
        let rarityMatch = unpicked.filter(c => (c.data.rarity||'common').toLowerCase() === targetRarity);
        // Fallback: if none of that rarity, try one step lower, then pick any
        if (rarityMatch.length === 0) {
            const idx = rarityOrderAsc.indexOf(targetRarity);
            for (let fi = idx - 1; fi >= 0; fi--) {
                rarityMatch = unpicked.filter(c => (c.data.rarity||'common').toLowerCase() === rarityOrderAsc[fi]);
                if (rarityMatch.length > 0) break;
            }
        }
        if (rarityMatch.length === 0) rarityMatch = unpicked;

        let selected = rarityMatch[Math.floor(Math.random() * rarityMatch.length)];

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
