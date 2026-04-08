// gameHelpers.js
const RARITY_WEIGHTS = { 'common': 100, 'rare': 40, 'epic': 15, 'legendary': 5 };

const checkRectCollision = (x, y, radius, rect) => {
    return (x + radius > rect.x && x - radius < rect.x + rect.width &&
            y + radius > rect.y && y - radius < rect.y + rect.height);
};

// Vrací fixní body na mapě (rohy a středy okrajů), aby hráči nespawnovali na sobě
const getValidSpawnPoint = (playerIndex, mapWidth, mapHeight, obstacles, breakables, playerRadius = 20) => {
    const fixedSpawns = [
        { x: 150, y: 150 }, // Levý horní
        { x: mapWidth - 150, y: mapHeight - 150 }, // Pravý dolní
        { x: mapWidth - 150, y: 150 }, // Pravý horní
        { x: 150, y: mapHeight - 150 }, // Levý dolní
        { x: mapWidth / 2, y: 150 }, // Střed nahoře
        { x: mapWidth / 2, y: mapHeight - 150 } // Střed dole
    ];

    // Pokud máme volný fixní spawn
    if (playerIndex < fixedSpawns.length) {
        return fixedSpawns[playerIndex];
    }

    // Fallback: Náhodný spawn pro více než 6 hráčů
    const pr = playerRadius + 5;
    for (let attempt = 0; attempt < 100; attempt++) {
        let testX = Math.random() * (mapWidth - 100) + 50;
        let testY = Math.random() * (mapHeight - 100) + 50;
        
        const hitObstacle = obstacles.some(obs => checkRectCollision(testX, testY, pr, obs));
        if (hitObstacle) continue;
        
        const hitBreakable = breakables.some(wall => !wall.destroyed && checkRectCollision(testX, testY, pr, wall));
        if (hitBreakable) continue;

        return { x: testX, y: testY };
    }
    return { x: mapWidth / 2, y: mapHeight / 2 }; 
};

const generateCardsForPlayer = (player, availableCards) => {
    if (!availableCards.length || !player) return [];
    
    let pickedIndices = [];
    let cardsToSend = [];
    
    let validCards = availableCards
        .map((c, i) => ({ originalIndex: i, data: c }))
        .filter(c => {
            if (c.data.requiresDomain && !player.domainType) return false;
            if (c.data.specificDomain && player.domainType !== c.data.specificDomain) return false;
            return true;
        });

    // ZDE JE ZAJIŠTĚNO, ŽE NEJSOU DUPLIKÁTY (unpickedValidCards)
    while (cardsToSend.length < 3 && pickedIndices.length < validCards.length) {
        let unpickedValidCards = validCards.filter(c => !pickedIndices.includes(c.originalIndex));
        if (unpickedValidCards.length === 0) break;

        let totalWeight = 0;
        let weightedCards = unpickedValidCards.map(c => {
            let weight = RARITY_WEIGHTS[(c.data.rarity || 'common').toLowerCase()] || 10;
            totalWeight += weight;
            return { card: c, weight };
        });

        let randomPick = Math.random() * totalWeight;
        let cumulativeWeight = 0;
        let selected = weightedCards[weightedCards.length - 1].card; 

        for (let item of weightedCards) {
            cumulativeWeight += item.weight;
            if (randomPick <= cumulativeWeight) { selected = item.card; break; }
        }

        pickedIndices.push(selected.originalIndex);
        cardsToSend.push({ ...selected.data, globalIndex: selected.originalIndex });
    }
    return cardsToSend;
};

const generateMap = (MAP_WIDTH, MAP_HEIGHT) => {
    const obstacles = [
        { x: -50, y: -50, width: MAP_WIDTH + 100, height: 50 },
        { x: -50, y: MAP_HEIGHT, width: MAP_WIDTH + 100, height: 50 },
        { x: -50, y: 0, width: 50, height: MAP_HEIGHT },
        { x: MAP_WIDTH, y: 0, width: 50, height: MAP_HEIGHT }
    ];
    const breakables = [];

    for (let i = 0; i < 7; i++) {
        let width = Math.floor(Math.random() * 150) + 80;
        let height = Math.floor(Math.random() * 150) + 80;
        obstacles.push({
            x: Math.floor(Math.random() * (MAP_WIDTH - width - 100)) + 50,
            y: Math.floor(Math.random() * (MAP_HEIGHT - height - 100)) + 50,
            width, height
        });
    }

    for (let i = 0; i < 8; i++) {
        let isHorizontal = Math.random() > 0.5;
        let width = isHorizontal ? 150 : 30;
        let height = isHorizontal ? 30 : 150;
        breakables.push({
            id: i,
            x: Math.floor(Math.random() * (MAP_WIDTH - width - 100)) + 50,
            y: Math.floor(Math.random() * (MAP_HEIGHT - height - 100)) + 50,
            width, height, destroyed: false
        });
    }
    return { obstacles, breakables };
};

module.exports = {
    getValidSpawnPoint,
    generateCardsForPlayer,
    generateMap,
    checkRectCollision
};