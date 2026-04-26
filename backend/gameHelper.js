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

// Circle vs rectangle collision (mathematically correct)
const checkRectCollision = (circleX, circleY, radius, rect) => {
    const closestX = Math.max(rect.x, Math.min(circleX, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circleY, rect.y + rect.height));
    const dx = circleX - closestX;
    const dy = circleY - closestY;
    return (dx * dx + dy * dy) < (radius * radius);
};

// Fixed spawn corners — spread around all four quadrants
const getFixedSpawns = (mapWidth, mapHeight) => [
    { x: 150,             y: 150              },  // top-left
    { x: mapWidth - 150,  y: mapHeight - 150  },  // bottom-right
    { x: mapWidth - 150,  y: 150              },  // top-right
    { x: 150,             y: mapHeight - 150  },  // bottom-left
    { x: mapWidth / 2,    y: 150              },  // top-center
    { x: mapWidth / 2,    y: mapHeight - 150  },  // bottom-center
    // Extra spawns for 7-8 player rooms
    { x: 150,             y: mapHeight / 2    },  // left-center
    { x: mapWidth - 150,  y: mapHeight / 2    },  // right-center
];

/**
 * Returns a safe spawn point that:
 *  1. Does not overlap any obstacle or intact breakable wall
 *  2. Is not already taken by another player (usedPositions)
 *  3. Stays within the playable map area
 *
 * @param {number}   playerIndex   - Slot index (0-based) — determines which fixed spawn to try first
 * @param {number}   mapWidth
 * @param {number}   mapHeight
 * @param {Array}    obstacles     - Indestructible wall rects
 * @param {Array}    breakables    - Breakable wall rects
 * @param {number}   playerRadius  - Collision radius (default 20)
 * @param {Array}    usedPositions - Array of {x,y} already assigned to other players this round
 */
const getValidSpawnPoint = (
    playerIndex, mapWidth, mapHeight,
    obstacles, breakables,
    playerRadius = 20,
    usedPositions = []
) => {
    // Add comfortable clearance on top of the collision radius
    const safeRadius = playerRadius + 15;

    const isPositionBlocked = (x, y) => {
        // Must be inside the arena with a margin
        if (x < safeRadius || x > mapWidth  - safeRadius) return true;
        if (y < safeRadius || y > mapHeight - safeRadius) return true;

        // Must not be inside an indestructible wall
        if (obstacles.some(obs => checkRectCollision(x, y, safeRadius, obs))) return true;

        // Must not be inside an intact breakable wall
        if (breakables.some(w => !w.destroyed && checkRectCollision(x, y, safeRadius, w))) return true;

        // Must not be too close to another player's already-assigned spawn
        // (minimum 4× player diameter between spawns)
        const minSpawnGap = playerRadius * 4;
        if (usedPositions.some(pos => Math.hypot(x - pos.x, y - pos.y) < minSpawnGap)) return true;

        return false;
    };

    const fixedSpawns = getFixedSpawns(mapWidth, mapHeight);

    // BUG FIX: Previously fixed spawns were returned DIRECTLY without checking obstacles.
    // Now we cycle through all fixed spawns starting from playerIndex, and only use
    // one that is actually clear. This handles both obstacle overlap AND duplicate spawns.
    for (let i = 0; i < fixedSpawns.length; i++) {
        const candidate = fixedSpawns[(playerIndex + i) % fixedSpawns.length];
        if (!isPositionBlocked(candidate.x, candidate.y)) {
            return candidate;
        }
    }

    // All fixed spawns blocked — try random positions within the arena
    for (let attempt = 0; attempt < 300; attempt++) {
        const x = Math.random() * (mapWidth  - safeRadius * 2) + safeRadius;
        const y = Math.random() * (mapHeight - safeRadius * 2) + safeRadius;
        if (!isPositionBlocked(x, y)) {
            return { x, y };
        }
    }

    // Absolute last resort — center of map (should never realistically be reached)
    console.warn('⚠️ getValidSpawnPoint: nenalezena platná pozice, použit střed mapy.');
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
    // BUG FIX: Border walls are placed OUTSIDE the playable area so the
    // collision-clamping in physics.js (max pRadius, mapW-pRadius) keeps players
    // well away from them. Negative x/y means they are invisible / outside canvas.
    const obstacles = [
        { x: -60, y: -60, width: mapWidth + 120, height: 60 },  // top
        { x: -60, y: mapHeight, width: mapWidth + 120, height: 60 }, // bottom
        { x: -60, y: 0,  width: 60, height: mapHeight },          // left
        { x: mapWidth, y: 0,  width: 60, height: mapHeight }       // right
    ];
    const breakables = [];

    const fixedSpawns = getFixedSpawns(mapWidth, mapHeight);
    // Generous protection radius — obstacles must not come within 80px of any spawn
    const spawnProtectionRadius = 80;

    const isOverlappingSpawn = (rect) =>
        fixedSpawns.some(spawn => checkRectCollision(spawn.x, spawn.y, spawnProtectionRadius, rect));

    // Also check that a new obstacle doesn't overlap an already-placed one
    const isOverlappingObstacle = (rect, existingList) =>
        existingList.some(existing => {
            // Simple AABB overlap check with a small gap
            const gap = 10;
            return !(
                rect.x + rect.width  + gap < existing.x ||
                existing.x + existing.width  + gap < rect.x ||
                rect.y + rect.height + gap < existing.y ||
                existing.y + existing.height + gap < rect.y
            );
        });

    // Interior indestructible walls
    const interiorObstacles = [];
    for (let i = 0; i < 7; i++) {
        const width  = Math.floor(Math.random() * 150) + 80;
        const height = Math.floor(Math.random() * 150) + 80;
        const candidate = {
            x: Math.floor(Math.random() * (mapWidth  - width  - 200)) + 100,
            y: Math.floor(Math.random() * (mapHeight - height - 200)) + 100,
            width, height
        };
        if (!isOverlappingSpawn(candidate) && !isOverlappingObstacle(candidate, interiorObstacles)) {
            interiorObstacles.push(candidate);
        }
    }
    obstacles.push(...interiorObstacles);

    // Breakable walls
    const allSolidSoFar = [...obstacles];
    for (let i = 0; i < 8; i++) {
        const isHorizontal = Math.random() > 0.5;
        const width  = isHorizontal ? 150 : 30;
        const height = isHorizontal ? 30  : 150;
        const candidate = {
            id: i,
            x: Math.floor(Math.random() * (mapWidth  - width  - 200)) + 100,
            y: Math.floor(Math.random() * (mapHeight - height - 200)) + 100,
            width, height,
            hp: 3, maxHp: 3,
            destroyed: false
        };
        if (!isOverlappingSpawn(candidate) && !isOverlappingObstacle(candidate, allSolidSoFar)) {
            breakables.push(candidate);
            allSolidSoFar.push(candidate);
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
