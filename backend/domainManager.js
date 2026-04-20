// domainManager.js
// OPRAVA: Odstraněn require gameConfig (obsahuje ES6 export, crashoval by server).
// Konstanty jsou předávány jako parametry nebo používají bezpečné fallbacky.

class DomainManager {

    // OPRAVA: Přidán parametr 'room' pro přístup k projektilům (MIRROR_SINGULARITY)
    static activateDomain(player, room) {
        // OPRAVA: isDomainActive -> domainActive (konzistentní se server.js)
        if (!player.domainType || player.domainActive || player.domainCooldown > 0) return;

        player.domainActive = true;
        player.domainTimer = player.domainDuration || 5000;

        console.log(`Hráč aktivoval doménu: ${player.domainType}`);

        switch (player.domainType) {
            case 'GAMBLER':
                this.rollJackpot(player);
                break;
            case 'MIRROR_SINGULARITY':
                player.ammo = 0;
                break;
            case 'INFINITE_ARSENAL':
                player.arsenalTimer = 0;
                break;
        }
    }

    // OPRAVA: Správná signatura - (players, enemies, projectiles, deltaTime)
    // Server volá: DomainManager.updateDomains(room.players, enemies, projectiles, TICK_RATE)
    static updateDomains(players, enemies, projectiles, deltaTime) {
        for (let id in players) {
            let p = players[id];

            // 1. Cooldown
            if (!p.domainActive && p.domainCooldown > 0) {
                p.domainCooldown -= deltaTime;
                if (p.domainCooldown < 0) p.domainCooldown = 0;
            }

            // 2. Probíhající doména
            if (p.domainActive) {
                p.domainTimer -= deltaTime;
                this.applyDomainEffects(p, enemies, projectiles, deltaTime);

                if (p.domainTimer <= 0) {
                    this.deactivateDomain(p, enemies);
                }
            }

            // 3. Jackpot buff (Gambler)
            if (p.isJackpotActive) {
                p.jackpotTimer -= deltaTime;
                if (p.jackpotTimer <= 0) {
                    p.isJackpotActive = false;
                    console.log(`Hráči skončil Jackpot.`);
                }
            }
        }
    }

    static applyDomainEffects(player, enemies, projectiles, deltaTime) {
        const radius = player.domainRadius || 200;
        const radiusSq = radius * radius;
        const dtSec = deltaTime / 1000;

        // Bezpečná konstanta (OPRAVA: CFG neexistoval, použijeme fixní fallback)
        const MIN_SPEED = 0.1;

        switch (player.domainType) {
            case 'QUANTUM_PRISON':
                enemies.forEach(enemy => {
                    if (enemy === player) return;
                    let dx = player.x - enemy.x;
                    let dy = player.y - enemy.y;
                    if (dx * dx + dy * dy <= radiusSq) {
                        enemy.isQuantumFrozen = true;
                        enemy.currentSpeed = MIN_SPEED;
                    } else if (enemy.isQuantumFrozen) {
                        enemy.isQuantumFrozen = false;
                        enemy.currentSpeed = enemy.baseSpeed || enemy.moveSpeed || 0.8;
                    }
                });
                break;

            case 'MADNESS_VEIL':
                enemies.forEach(enemy => {
                    if (enemy === player) return;
                    let dx = player.x - enemy.x;
                    let dy = player.y - enemy.y;
                    if (dx * dx + dy * dy <= radiusSq) {
                        enemy.hp -= (player.domainDamage || 5) * dtSec;
                        enemy.isParalyzed = true;
                        enemy.currentSpeed = 0;
                    } else if (enemy.isParalyzed) {
                        enemy.isParalyzed = false;
                        enemy.currentSpeed = enemy.baseSpeed || enemy.moveSpeed || 0.8;
                    }
                });
                break;

            case 'BLOOD_ALTAR':
                let totalHeal = 0;
                enemies.forEach(enemy => {
                    if (enemy === player) return;
                    let dx = player.x - enemy.x;
                    let dy = player.y - enemy.y;
                    if (dx * dx + dy * dy <= radiusSq) {
                        let frameDmg = (player.domainDamage || 10) * dtSec;
                        enemy.hp -= frameDmg;
                        totalHeal += frameDmg;
                    }
                });
                if (totalHeal > 0) {
                    let lifestealRate = player.lifesteal || 0.2;
                    player.hp = Math.min(player.maxHp || 100, player.hp + totalHeal * lifestealRate);
                }
                break;

            case 'GRAVITY_COLLAPSE':
                enemies.forEach(enemy => {
                    if (enemy === player) return;
                    let dx = player.x - enemy.x;
                    let dy = player.y - enemy.y;
                    let distSq = dx * dx + dy * dy;
                    if (distSq <= radiusSq) {
                        enemy.hp -= (player.domainDamage || 15) * dtSec;
                        let dist = Math.sqrt(distSq);
                        if (dist > 5) {
                            let pullForce = (player.gravityPull || 5) * 10 * dtSec;
                            enemy.x += (dx / dist) * pullForce;
                            enemy.y += (dy / dist) * pullForce;
                        }
                    }
                });
                break;

            case 'MIRROR_SINGULARITY':
                if (projectiles && projectiles.length > 0) {
                    projectiles.forEach(proj => {
                        if (proj.ownerId !== player.id && !proj.isReflected) {
                            let dx = player.x - proj.x;
                            let dy = player.y - proj.y;
                            if (dx * dx + dy * dy <= radiusSq) {
                                proj.vx *= -1;
                                proj.vy *= -1;
                                proj.damage *= (player.reflectDamageMult || 1.5);
                                proj.ownerId = player.id;
                                proj.isReflected = true;
                            }
                        }
                    });
                }
                break;

            case 'INFINITE_ARSENAL':
                if (player.arsenalTimer === undefined) player.arsenalTimer = 0;
                player.arsenalTimer -= deltaTime;
                if (player.arsenalTimer <= 0) {
                    player.arsenalTimer = player.arsenalFireRate || 50;
                    enemies.forEach(enemy => {
                        if (enemy === player) return;
                        let dx = player.x - enemy.x;
                        let dy = player.y - enemy.y;
                        if (dx * dx + dy * dy <= radiusSq) {
                            enemy.hp -= player.arsenalDamage || 10;
                        }
                    });
                }
                break;
        }
    }

    static deactivateDomain(player, enemies) {
        // OPRAVA: isDomainActive -> domainActive
        player.domainActive = false;
        player.domainCooldown = 15000;
        console.log(`Hráči skončila doména ${player.domainType}.`);

        // Vyčištění statusů na nepřátelích
        if (enemies && enemies.length > 0) {
            enemies.forEach(enemy => {
                if (enemy.isQuantumFrozen || enemy.isParalyzed) {
                    enemy.isQuantumFrozen = false;
                    enemy.isParalyzed = false;
                    enemy.currentSpeed = enemy.baseSpeed || enemy.moveSpeed || 0.8;
                }
            });
        }
    }

    static rollJackpot(player) {
        let roll = Math.random();
        let chance = (player.jackpotChance || 0.15) + (player.jackpotPity || 0);

        if (roll <= chance) {
            console.log(`JACKPOT! Nesmrtelnost a nekonečno munice na 4.11s!`);
            player.isJackpotActive = true;
            player.jackpotTimer = player.jackpotDuration || 4110;
            player.jackpotPity = 0;
        } else {
            console.log(`Gambler miss. Zvyšuji pity o 5%.`);
            player.jackpotPity = (player.jackpotPity || 0) + 0.05;
        }
    }
}

module.exports = DomainManager;