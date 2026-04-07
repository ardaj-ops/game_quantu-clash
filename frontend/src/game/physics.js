// physics.js
import { state, CONFIG } from './state.js';
import { socket } from './network.js';

export function checkWallCollision(x, y, radius, walls) {
    if (!walls || walls.length === 0) return false;
    for (let wall of walls) {
        // BEZPEČNOST: Zdi a krabice, které jsou zničené nebo mají 0 HP, ignorujeme (dá se přes ně chodit/střílet)
        if (!wall || wall.destroyed || (wall.hp !== undefined && wall.hp <= 0)) continue;
        
        let testX = Math.max(wall.x, Math.min(x, wall.x + wall.width));
        let testY = Math.max(wall.y, Math.min(y, wall.y + wall.height));
        let distX = x - testX;
        let distY = y - testY;
        if (Math.sqrt((distX * distX) + (distY * distY)) <= radius) return true;
    }
    return false;
}

export function updateLocalGame() {
    if (!state.latestServerData || state.latestServerData.gameState !== 'PLAYING') return;
    if (!socket) return;

    // POJISTKA: Pokud se fyzika spustí dřív, než se vytvoří objekty pro vstupy nebo kulky
    if (!state.playerInputs) state.playerInputs = {};
    if (!state.localBullets) state.localBullets = [];

    let playersData = state.latestServerData.leanPlayers || state.latestServerData.players || {};
    let myId = socket.id;
    let me = playersData[myId];
    
    if (!me || me.hp <= 0) return;

    let speed = me.moveSpeed || 5;
    let pRadius = me.playerRadius || 20;
    let allWalls = [...(state.localObstacles || []), ...(state.localBreakables || [])];

    let nextX = me.x;
    let nextY = me.y;

    // BEZPEČNÉ VYTAŽENÍ ROZMĚRŮ MAPY (Aby ses mohl hýbat, i když CONFIG zrovna chybí)
    const mapW = (CONFIG && CONFIG.MAP_W) ? CONFIG.MAP_W : 2000;
    const mapH = (CONFIG && CONFIG.MAP_H) ? CONFIG.MAP_H : 2000;

    // Pohyb Y
    if (state.playerInputs.up) nextY -= speed;
    if (state.playerInputs.down) nextY += speed;
    nextY = Math.max(pRadius, Math.min(mapH - pRadius, nextY)); // Zastaví tě na kraji mapy
    if (!checkWallCollision(me.x, nextY, pRadius, allWalls)) me.y = nextY;

    // Pohyb X
    if (state.playerInputs.left) nextX -= speed;
    if (state.playerInputs.right) nextX += speed;
    nextX = Math.max(pRadius, Math.min(mapW - pRadius, nextX)); // Zastaví tě na kraji mapy
    if (!checkWallCollision(nextX, me.y, pRadius, allWalls)) me.x = nextX;

    // Pojistka pro úhel, kdyby chyběl (aby neletělo na server NaN)
    let currentAimAngle = state.playerInputs.aimAngle || 0;

    // Odeslání dat na server
    socket.emit('clientSync', {
        x: me.x, 
        y: me.y,
        aimAngle: currentAimAngle,
        ammo: me.ammo,
        isReloading: state.playerInputs.reload || false,
        dashRequested: state.playerInputs.rightClick || false
    });

    let now = Date.now();
    if (!state.lastShotTime) state.lastShotTime = 0;
    let fireRate = me.fireRate || 200;
    
    // Střelba
    if (state.playerInputs.click && now - state.lastShotTime > fireRate && me.ammo > 0 && me.maxAmmo > 0 && !me.isReloading) {
        state.lastShotTime = now;
        me.ammo--; 

        let bSpeed = me.bulletSpeed || 15;
        let bullet = {
            id: Math.random().toString(36).substring(2, 9), 
            ownerId: myId,
            x: me.x + Math.cos(currentAimAngle) * (pRadius + 5),
            y: me.y + Math.sin(currentAimAngle) * (pRadius + 5),
            vx: Math.cos(currentAimAngle) * bSpeed,
            vy: Math.sin(currentAimAngle) * bSpeed,
            damage: me.damage || 10,
            radius: 5,
            color: me.color || '#ffffff'
        };

        state.localBullets.push(bullet);
        socket.emit('playerShot', [bullet]); 
    }

    // Fyzika lokálních střel (pohyb a srážky)
    for (let i = state.localBullets.length - 1; i >= 0; i--) {
        let b = state.localBullets[i];
        b.x += b.vx;
        b.y += b.vy;

        // Narazila kulka do zdi?
        if (checkWallCollision(b.x, b.y, b.radius, allWalls)) {
            state.localBullets.splice(i, 1);
            continue;
        }

        // Narazila kulka do jiného hráče?
        for (let targetId in playersData) {
            if (targetId === myId) continue; // Sami sebe neprostřelíme
            let target = playersData[targetId];
            if (!target || target.hp <= 0) continue;

            let dist = Math.hypot(b.x - target.x, b.y - target.y);
            if (dist < (target.playerRadius || 20) + b.radius) {
                // Zásah! Pošleme info na server.
                socket.emit('bulletHitPlayer', { targetId, damage: b.damage, bulletId: b.id });
                state.localBullets.splice(i, 1); // Smažeme kulku lokálně
                break;
            }
        }
    }
}