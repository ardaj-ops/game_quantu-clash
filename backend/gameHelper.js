// gameHelper.js

const RARITY_WEIGHTS = {
    'common':     0,
    'uncommon':    0,
    'rare':        0,
    'epic':        0,
    'legendary':    0,
    'mythic':       0,
    'exotic':       0,
    'transcended':  100
};

const checkRectCollision = (circleX, circleY, radius, rect) => {
    const closestX = Math.max(rect.x, Math.min(circleX, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circleY, rect.y + rect.height));
    const dx = circleX - closestX;
    const dy = circleY - closestY;
    return (dx * dx + dy * dy) < (radius * radius);
};

// FIX: All spawns are now at least 500px from every arena border.
// Previously 150px was too close and players would clip into border walls.
const getFixedSpawns = (mapWidth, mapHeight) => [
    { x: 500,              y: 500              },  // top-left quadrant
    { x: mapWidth - 500,   y: mapHeight - 500  },  // bottom-right quadrant
    { x: mapWidth - 500,   y: 500              },  // top-right quadrant
    { x: 500,              y: mapHeight - 500  },  // bottom-left quadrant
    { x: mapWidth  / 2,    y: 500              },  // top-center
    { x: mapWidth  / 2,    y: mapHeight - 500  },  // bottom-center
    { x: 500,              y: mapHeight / 2    },  // left-center
    { x: mapWidth  - 500,  y: mapHeight / 2    },  // right-center
];

const getValidSpawnPoint = (
    playerIndex, mapWidth, mapHeight,
    obstacles, breakables,
    playerRadius = 20,
    usedPositions = []
) => {
    // FIX: safeRadius includes the 500px border margin — even random fallback
    // spawns can't be within 500px of any edge.
    const BORDER_MARGIN = 500;
    const safeRadius = Math.max(playerRadius + 15, BORDER_MARGIN);

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
        if (!isPositionBlocked(candidate.x, candidate.y)) {
            return candidate;
        }
    }

    // Random fallback — also respects 500px border margin
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
    // Border walls placed outside the visible playable area
    const obstacles = [
        { x: -60, y: -60, width: mapWidth + 120, height: 60 },
        { x: -60, y: mapHeight, width: mapWidth + 120, height: 60 },
        { x: -60, y: 0,  width: 60, height: mapHeight },
        { x: mapWidth, y: 0, width: 60, height: mapHeight }
    ];
    const breakables = [];

    const fixedSpawns = getFixedSpawns(mapWidth, mapHeight);
    // FIX: spawn protection radius also bumped to match the 500px margin
    const spawnProtectionRadius = 130;

    const isOverlappingSpawn = (rect) =>
        fixedSpawns.some(spawn => checkRectCollision(spawn.x, spawn.y, spawnProtectionRadius, rect));

    const isOverlappingObstacle = (rect, existingList) =>
        existingList.some(existing => {
            const gap = 10;
            return !(
                rect.x + rect.width  + gap < existing.x ||
                existing.x + existing.width  + gap < rect.x ||
                rect.y + rect.height + gap < existing.y ||
                existing.y + existing.height + gap < rect.y
            );
        });

    // Interior indestructible walls — placed within the 500px-safe inner zone
    const INNER_MARGIN = 520;
    const interiorObstacles = [];
    for (let i = 0; i < 7; i++) {
        const width  = Math.floor(Math.random() * 150) + 80;
        const height = Math.floor(Math.random() * 150) + 80;
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

    // FIX: Breakable walls now have hp:1 — destroyed in a single hit
    const allSolidSoFar = [...obstacles];
    for (let i = 0; i < 8; i++) {
        const isHorizontal = Math.random() > 0.5;
        const width  = isHorizontal ? 150 : 30;
        const height = isHorizontal ? 30  : 150;
        const candidate = {
            id: i,
            x: Math.floor(Math.random() * (mapWidth  - width  - INNER_MARGIN * 2)) + INNER_MARGIN,
            y: Math.floor(Math.random() * (mapHeight - height - INNER_MARGIN * 2)) + INNER_MARGIN,
            width, height,
            hp: 1, maxHp: 1,   // ← 1-hit destruction
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