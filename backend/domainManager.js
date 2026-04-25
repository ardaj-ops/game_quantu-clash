// domainManager.js

class DomainManager {

    // BUG FIX: Odstraněn nepoužívaný parametr 'room' (byl dead code — nikde uvnitř nepoužit)
    static activateDomain(player) {
        if (!player.domainType || player.domainActive || player.domainCooldown > 0) return;

        player.domainActive = true;
        // BUG FIX: Karta "Prodloužený Rituál" přidává domainDurationBonus — předtím ignorováno
        player.domainTimer = (player.domainDuration || 5000) + (player.domainDurationBonus || 0);

        console.log(`Hráč aktivoval doménu: ${player.domainType} (trvání: ${player.domainTimer}ms)`);

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

    // Signatura: (playersObj, enemiesArr, projectilesArr, deltaTime)
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
                    // BUG FIX: Obnovení dočasných bonusů z karty "Horečka Jackpotu"
                    if (p._preJackpotSpeed !== undefined) {
                        p.moveSpeed = p._preJackpotSpeed;
                        delete p._preJackpotSpeed;
                    }
                    if (p._preJackpotDamage !== undefined) {
                        p.damage = p._preJackpotDamage;
                        delete p._preJackpotDamage;
                    }
                    console.log(`Hráči skončil Jackpot.`);
                }
            }
        }
    }

    static applyDomainEffects(player, enemies, projectiles, deltaTime) {
        const radius = player.domainRadius || 200;
        const radiusSq = radius * radius;
        const dtSec = deltaTime / 1000;

        switch (player.domainType) {
            case 'QUANTUM_PRISON':
                enemies.forEach(enemy => {
                    if (enemy.id === player.id) return;
                    let dx = player.x - enemy.x;
                    let dy = player.y - enemy.y;
                    if (dx * dx + dy * dy <= radiusSq) {
                        enemy.isQuantumFrozen = true;
                        // BUG FIX: Karta "Kvantové Zmrznutí" nastavuje prisonSlowdown — předtím ignorováno
                        enemy.currentSpeed = player.prisonSlowdown !== undefined ? player.prisonSlowdown : 0.1;
                        enemy.moveSpeed = enemy.currentSpeed;
                    } else if (enemy.isQuantumFrozen) {
                        enemy.isQuantumFrozen = false;
                        enemy.moveSpeed = enemy.baseSpeed || 0.8;
                    }
                });
                break;

            case 'MADNESS_VEIL':
                enemies.forEach(enemy => {
                    if (enemy.id === player.id) return;
                    let dx = player.x - enemy.x;
                    let dy = player.y - enemy.y;
                    if (dx * dx + dy * dy <= radiusSq) {
                        enemy.hp -= (player.domainDamage || 5) * dtSec;
                        enemy.isParalyzed = true;
                        enemy.moveSpeed = 0;
                    } else if (enemy.isParalyzed) {
                        enemy.isParalyzed = false;
                        enemy.moveSpeed = enemy.baseSpeed || 0.8;
                    }
                });
                break;

            case 'BLOOD_ALTAR':
                let totalHeal = 0;
                enemies.forEach(enemy => {
                    if (enemy.id === player.id) return;
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
                    if (enemy.id === player.id) return;
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
                        if (enemy.id === player.id) return;
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
        player.domainActive = false;
        // BUG FIX: Karta "Mistr Rituálů" nastavuje domainCooldownModifier — předtím ignorováno,
        // cooldown byl vždy natvrdo 15000ms
        player.domainCooldown = 15000 * (player.domainCooldownModifier || 1);
        console.log(`Hráči skončila doména ${player.domainType}. Cooldown: ${player.domainCooldown}ms`);

        if (enemies && enemies.length > 0) {
            enemies.forEach(enemy => {
                if (enemy.isQuantumFrozen || enemy.isParalyzed) {
                    enemy.isQuantumFrozen = false;
                    enemy.isParalyzed = false;
                    enemy.moveSpeed = enemy.baseSpeed || 0.8;
                }
            });
        }
    }

    static rollJackpot(player) {
        let roll = Math.random();
        let chance = (player.jackpotChance || 0.15) + (player.jackpotPity || 0);

        if (roll <= chance) {
            console.log(`JACKPOT! Nesmrtelnost a nekonečno munice na ${player.jackpotDuration || 4110}ms!`);
            player.isJackpotActive = true;
            player.jackpotTimer = player.jackpotDuration || 4110;
            player.jackpotPity = 0;

            // BUG FIX: Karta "Horečka Jackpotu" přidává jackpotSpeedBonus a jackpotDamageBonus
            // — předtím se tyto bonusy nikdy neaplikovaly
            if (player.jackpotSpeedBonus) {
                player._preJackpotSpeed = player.moveSpeed;
                player.moveSpeed = Math.min(3.5, player.moveSpeed + player.jackpotSpeedBonus);
            }
            if (player.jackpotDamageBonus) {
                player._preJackpotDamage = player.damage;
                player.damage = Math.min(999, player.damage + player.jackpotDamageBonus);
            }
        } else {
            // BUG FIX: Karta "Zmanipulovaná Ruleta" nastavuje jackpotPityStep — předtím ignorováno
            const pityIncrease = player.jackpotPityStep || 0.05;
            player.jackpotPity = (player.jackpotPity || 0) + pityIncrease;
            console.log(`Gambler miss. Pity: ${(player.jackpotPity * 100).toFixed(0)}%`);
        }
    }
}

module.exports = DomainManager;
