// Definice vah pro vzácnost karet
const RARITY_WEIGHTS = { 
    'common': 100, 
    'uncommon': 70,    // Častější než Rare, ale méně než Common
    'rare': 40, 
    'epic': 15, 
    'legendary': 5,
    'mythic': 2,       // Vzácnější než Legendary
    'exotic': 0.8,     // Extrémně vzácné (méně než 1 % šance vůči Common)
    'transcended': 0.1 // Absolutní rarita, padne jen velmi výjimečně
};

/**
 * Vylepšená detekce kolize: Skutečný kruh vs. obdélník.
 * Původní kód bral kruh spíše jako čtverec, toto je matematicky přesnější.
 */
const checkRectCollision = (circleX, circleY, radius, rect) => {
    // Nalezení nejbližšího bodu na obdélníku ke středu kruhu
    const closestX = Math.max(rect.x, Math.min(circleX, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circleY, rect.y + rect.height));
    
    // Výpočet vzdálenosti
    const distanceX = circleX - closestX;
    const distanceY = circleY - closestY;
    
    return (distanceX * distanceX + distanceY * distanceY) < (radius * radius);
};

// Pomocná funkce pro fixní spawny, abychom je mohli využít i při generování mapy
const getFixedSpawns = (mapWidth, mapHeight) => [
    { x: 150, y: 150 }, // Levý horní
    { x: mapWidth - 150, y: mapHeight - 150 }, // Pravý dolní
    { x: mapWidth - 150, y: 150 }, // Pravý horní
    { x: 150, y: mapHeight - 150 }, // Levý dolní
    { x: mapWidth / 2, y: 150 }, // Střed nahoře
    { x: mapWidth / 2, y: mapHeight - 150 } // Střed dole
];

const getValidSpawnPoint = (playerIndex, mapWidth, mapHeight, obstacles, breakables, playerRadius = 20) => {
    const fixedSpawns = getFixedSpawns(mapWidth, mapHeight);

    // Pokud máme volný fixní spawn
    if (playerIndex < fixedSpawns.length) {
        return fixedSpawns[playerIndex];
    }

    // Fallback: Náhodný spawn pro více než 6 hráčů
    const safeRadius = playerRadius + 5;
    for (let attempt = 0; attempt < 100; attempt++) {
        let testX = Math.random() * (mapWidth - 100) + 50;
        let testY = Math.random() * (mapHeight - 100) + 50;
        
        const hitObstacle = obstacles.some(obs => checkRectCollision(testX, testY, safeRadius, obs));
        if (hitObstacle) continue;
        
        const hitBreakable = breakables.some(wall => !wall.destroyed && checkRectCollision(testX, testY, safeRadius, wall));
        if (hitBreakable) continue;

        return { x: testX, y: testY };
    }
    
    return { x: mapWidth / 2, y: mapHeight / 2 }; 
};

const generateCardsForPlayer = (player, availableCards) => {
    if (!availableCards?.length || !player) return [];
    
    // Filtrace karet platných pro hráče
    let validCards = availableCards
        .map((c, i) => ({ originalIndex: i, data: c }))
        .filter(c => {
            if (c.data.requiresDomain && !player.domainType) return false;
            if (c.data.specificDomain && player.domainType !== c.data.specificDomain) return false;
            return true;
        });

    // Použití Setu pro rychlejší a čistší vyhledávání duplikátů
    let pickedIndices = new Set();
    let cardsToSend = [];
    
    while (cardsToSend.length < 3 && pickedIndices.size < validCards.length) {
        let unpickedValidCards = validCards.filter(c => !pickedIndices.has(c.originalIndex));
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
            if (randomPick <= cumulativeWeight) { 
                selected = item.card; 
                break; 
            }
        }

        pickedIndices.add(selected.originalIndex);
        cardsToSend.push({ ...selected.data, globalIndex: selected.originalIndex });
    }
    
    return cardsToSend;
};

const generateMap = (mapWidth, mapHeight) => {
    const obstacles = [
        { x: -50, y: -50, width: mapWidth + 100, height: 50 },
        { x: -50, y: mapHeight, width: mapWidth + 100, height: 50 },
        { x: -50, y: 0, width: 50, height: mapHeight },
        { x: mapWidth, y: 0, width: 50, height: mapHeight }
    ];
    const breakables = [];
    
    // Ochranná zóna, aby překážky nevznikaly na startovních pozicích hráčů
    const fixedSpawns = getFixedSpawns(mapWidth, mapHeight);
    const spawnProtectionRadius = 40;

    const isOverlappingSpawn = (rect) => {
        return fixedSpawns.some(spawn => checkRectCollision(spawn.x, spawn.y, spawnProtectionRadius, rect));
    };

    // Generování pevných překážek
    for (let i = 0; i < 7; i++) {
        let width = Math.floor(Math.random() * 150) + 80;
        let height = Math.floor(Math.random() * 150) + 80;
        let newObstacle = {
            x: Math.floor(Math.random() * (mapWidth - width - 100)) + 50,
            y: Math.floor(Math.random() * (mapHeight - height - 100)) + 50,
            width, height
        };
        
        if (!isOverlappingSpawn(newObstacle)) {
            obstacles.push(newObstacle);
        }
    }

    // Generování zničitelných překážek
    for (let i = 0; i < 8; i++) {
        let isHorizontal = Math.random() > 0.5;
        let width = isHorizontal ? 150 : 30;
        let height = isHorizontal ? 30 : 150;
        let newBreakable = {
            id: i,
            x: Math.floor(Math.random() * (mapWidth - width - 100)) + 50,
            y: Math.floor(Math.random() * (mapHeight - height - 100)) + 50,
            width, height, destroyed: false
        };
        
        if (!isOverlappingSpawn(newBreakable)) {
            breakables.push(newBreakable);
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