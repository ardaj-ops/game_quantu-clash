<<<<<<< HEAD
// domainManager.js
=======
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
const CONFIG = require('../frontend/src/game/gameConfig');

class DomainManager {
    static activateDomain(player) {
        if (!player.domainType || player.isDomainActive || player.domainCooldown > 0) return;

        player.isDomainActive = true;
        // Základní doba trvání domény (pokud nemáš definováno jinak, dáme 5 sekund)
        player.domainTimer = player.domainDuration || 5000; 
        
        console.log(`Hráč ${player.id} aktivoval doménu: ${player.domainType}`);

        // --- OKAMŽITÉ EFEKTY PŘI AKTIVACI ---
        switch (player.domainType) {
            case 'GAMBLER':
                this.rollJackpot(player);
                break;
            case 'MIRROR_SINGULARITY':
                player.ammo = 0; // Vynulování nábojů (jistota k pasivnímu maxAmmo = 0)
                break;
            case 'INFINITE_ARSENAL':
                player.arsenalTimer = 0; // Příprava časovače pro střelbu domény
                break;
        }
    }

<<<<<<< HEAD
    // Přidán parametr 'projectiles' kvůli Zrcadlové Singularitě
=======
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
    static updateDomains(players, enemies, projectiles, deltaTime) {
        for (let id in players) {
            let p = players[id];

            // 1. Řešení cooldownu
            if (!p.isDomainActive && p.domainCooldown > 0) {
                p.domainCooldown -= deltaTime;
                if (p.domainCooldown < 0) p.domainCooldown = 0;
            }

            // 2. Řešení probíhající domény
            if (p.isDomainActive) {
                p.domainTimer -= deltaTime;

                // Aplikace neustálých (tick) efektů domény
                this.applyDomainEffects(p, enemies, projectiles, deltaTime);

<<<<<<< HEAD
                // Konec domény
                if (p.domainTimer <= 0) {
                    this.deactivateDomain(p);
=======
                // Konec domény - OPRAVA: Předáváme i enemies pro vyčištění efektů
                if (p.domainTimer <= 0) {
                    this.deactivateDomain(p, enemies);
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
                }
            }

            // 3. Specifický buff pro Gamblera (Jackpot nesmrtelnost a nekonečno munice)
            if (p.isJackpotActive) {
                p.jackpotTimer -= deltaTime;
                
<<<<<<< HEAD
                // Zde můžeš v hlavním kódu kontrolovat p.isJackpotActive pro nesmrtelnost
                // a nekonečnou munici (nebude se mu odečítat ammo).
                
=======
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
                if (p.jackpotTimer <= 0) {
                    p.isJackpotActive = false;
                    console.log(`Hráči ${p.id} skončil Jackpot.`);
                }
            }
        }
    }

    static applyDomainEffects(player, enemies, projectiles, deltaTime) {
        const radius = player.domainRadius || 200; 
<<<<<<< HEAD
=======
        const radiusSq = radius * radius; // Optimalizace: použijeme mocninu pro rychlejší výpočet
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
        const dtSec = deltaTime / 1000; // Převod na sekundy pro výpočet DMG/s

        switch (player.domainType) {
            case 'QUANTUM_PRISON':
                enemies.forEach(enemy => {
<<<<<<< HEAD
                    let dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
                    if (dist <= radius) {
=======
                    let dx = player.x - enemy.x;
                    let dy = player.y - enemy.y;
                    let distSq = dx * dx + dy * dy;

                    if (distSq <= radiusSq) {
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
                        enemy.isQuantumFrozen = true;
                        // Extrémní zpomalení nepřátel
                        let minSpeed = (typeof CFG !== 'undefined' && CFG.MIN_CAP_MOVE_SPEED) ? CFG.MIN_CAP_MOVE_SPEED : 0.1;
                        enemy.currentSpeed = minSpeed; 
                    } else if (enemy.isQuantumFrozen) {
                        enemy.isQuantumFrozen = false;
                        enemy.currentSpeed = enemy.baseSpeed; // Vrácení rychlosti mimo doménu
                    }
                });
                break;

            case 'MADNESS_VEIL':
                enemies.forEach(enemy => {
<<<<<<< HEAD
                    let dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
                    if (dist <= radius) {
                        // 5 DMG/s
                        enemy.hp -= (player.domainDamage || 5) * dtSec;
                        // Paralyzuje (rychlost 0)
=======
                    let dx = player.x - enemy.x;
                    let dy = player.y - enemy.y;
                    let distSq = dx * dx + dy * dy;

                    if (distSq <= radiusSq) {
                        enemy.hp -= (player.domainDamage || 5) * dtSec;
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
                        enemy.isParalyzed = true;
                        enemy.currentSpeed = 0;
                    } else if (enemy.isParalyzed) {
                        enemy.isParalyzed = false;
                        enemy.currentSpeed = enemy.baseSpeed;
                    }
                });
                break;

            case 'BLOOD_ALTAR':
                let totalHeal = 0;
                enemies.forEach(enemy => {
<<<<<<< HEAD
                    let dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
                    if (dist <= radius) {
                        // 10 DMG/s
=======
                    let dx = player.x - enemy.x;
                    let dy = player.y - enemy.y;
                    
                    if ((dx * dx + dy * dy) <= radiusSq) {
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
                        let frameDmg = (player.domainDamage || 10) * dtSec;
                        enemy.hp -= frameDmg;
                        totalHeal += frameDmg;
                    }
                });
<<<<<<< HEAD
                // Léčení hráče na základě uděleného DMG a lifestealu
                if (totalHeal > 0) {
                    let lifestealRate = player.lifesteal || 0.2;
                    player.hp = Math.min(player.maxHp, player.hp + (totalHeal * lifestealRate));
=======
                if (totalHeal > 0) {
                    let lifestealRate = player.lifesteal || 0.2;
                    player.hp = Math.min(player.maxHp || 100, player.hp + (totalHeal * lifestealRate)); // Přidána ochrana maxHp
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
                }
                break;

            case 'GRAVITY_COLLAPSE':
                enemies.forEach(enemy => {
<<<<<<< HEAD
                    let dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
                    if (dist <= radius) {
                        // Drtí (15 DMG/s)
                        enemy.hp -= (player.domainDamage || 15) * dtSec;
                        
                        // Vtahuje do středu
                        if (dist > 5) {
                            let pullForce = (player.gravityPull || 5) * 10 * dtSec;
                            let dx = player.x - enemy.x;
                            let dy = player.y - enemy.y;
=======
                    let dx = player.x - enemy.x;
                    let dy = player.y - enemy.y;
                    let distSq = dx * dx + dy * dy;

                    if (distSq <= radiusSq) {
                        enemy.hp -= (player.domainDamage || 15) * dtSec;
                        
                        // Vtahuje do středu
                        let dist = Math.sqrt(distSq); // Zde už odmocninu potřebujeme pro směrový vektor
                        if (dist > 5) {
                            let pullForce = (player.gravityPull || 5) * 10 * dtSec;
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
                            enemy.x += (dx / dist) * pullForce;
                            enemy.y += (dy / dist) * pullForce;
                        }
                    }
                });
                break;

            case 'MIRROR_SINGULARITY':
<<<<<<< HEAD
                // Prochází všechny projektily a hledá nepřátelské v okruhu
                if (projectiles && projectiles.length > 0) {
                    projectiles.forEach(proj => {
                        // Zkontrolujeme, jestli je projektil cizí (od nepřítele nebo jiného hráče)
                        if (proj.ownerId !== player.id) {
                            let dist = Math.hypot(player.x - proj.x, player.y - proj.y);
                            if (dist <= radius && !proj.isReflected) {
                                // Odrážení kulky
                                proj.vx *= -1;
                                proj.vy *= -1;
                                proj.damage *= (player.reflectDamageMult || 1.5);
                                proj.ownerId = player.id; // Nyní kulka patří tobě (nezraní tě)
                                proj.isReflected = true; // Zabrání nekonečnému loopu odrážení
=======
                if (projectiles && projectiles.length > 0) {
                    projectiles.forEach(proj => {
                        if (proj.ownerId !== player.id && !proj.isReflected) {
                            let dx = player.x - proj.x;
                            let dy = player.y - proj.y;
                            
                            if ((dx * dx + dy * dy) <= radiusSq) {
                                proj.vx *= -1;
                                proj.vy *= -1;
                                proj.damage *= (player.reflectDamageMult || 1.5);
                                proj.ownerId = player.id;
                                proj.isReflected = true;
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
                            }
                        }
                    });
                }
                break;

            case 'INFINITE_ARSENAL':
<<<<<<< HEAD
                // Doména střílí sama. 
                // arsenalFireRate je např. 50 (ms), takže to sype velmi rychle.
=======
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
                if (player.arsenalTimer === undefined) player.arsenalTimer = 0;
                player.arsenalTimer -= deltaTime;
                
                if (player.arsenalTimer <= 0) {
                    player.arsenalTimer = player.arsenalFireRate || 50;
                    
<<<<<<< HEAD
                    // Najdeme náhodného nebo nejbližšího nepřítele v dosahu a udělíme poškození
                    // Simulace "automatické střelby všude kolem"
                    let targets = enemies.filter(e => Math.hypot(player.x - e.x, player.y - e.y) <= radius);
                    if (targets.length > 0) {
                        // Pro plný bullet hell efekt zasáhneme všechny v okruhu, nebo jen náhodného
                        targets.forEach(t => {
                            t.hp -= player.arsenalDamage || 10;
                        });
                        // Alternativně zde můžeš reálně spawnovat projektily:
                        // projectiles.push({ x: player.x, y: player.y, vx: ..., vy: ..., damage: player.arsenalDamage, ownerId: player.id })
                    }
                }
                break;
                
            // GAMBLER nemá žádný kontinuální tick efekt na okolí (jen buff na hráči)
        }
    }

    static deactivateDomain(player) {
        player.isDomainActive = false;
        // Nastavení cooldownu (např. 15 vteřin, pokud nemáš v kartě definováno jinak)
=======
                    enemies.forEach(enemy => {
                        let dx = player.x - enemy.x;
                        let dy = player.y - enemy.y;
                        
                        if ((dx * dx + dy * dy) <= radiusSq) {
                            enemy.hp -= player.arsenalDamage || 10;
                        }
                    });
                }
                break;
        }
    }

    // OPRAVA: Přidán parametr 'enemies', aby se daly vyčistit statusy
    static deactivateDomain(player, enemies) {
        player.isDomainActive = false;
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
        player.domainCooldown = 15000;
        console.log(`Hráči ${player.id} skončila doména ${player.domainType}.`);

        // --- UKLÍZENÍ EFEKTŮ PŘI KONCI ---
<<<<<<< HEAD
        // Nepřátelům se automaticky vrátí rychlost v dalším framu mimo if (dist <= radius) větve v applyDomainEffects, 
        // ale pro jistotu můžeš přidat globální reset, pokud by se hra chovala nestandardně.
    }

    // --- LOGIKA KARET ---
    static rollJackpot(player) {
        let roll = Math.random();
        // Šance + pity systém (pokud máš smůlu, šance se zvyšuje)
=======
        // Původní kód spoléhal na to, že se efekty vyčistí v `applyDomainEffects`, 
        // ale jakmile doména skončí, ta funkce se už nevolá! Nepřátelé by zůstali navždy zmražení.
        if (enemies && enemies.length > 0) {
            enemies.forEach(enemy => {
                if (enemy.isQuantumFrozen || enemy.isParalyzed) {
                    enemy.isQuantumFrozen = false;
                    enemy.isParalyzed = false;
                    if (enemy.baseSpeed !== undefined) {
                        enemy.currentSpeed = enemy.baseSpeed;
                    }
                }
            });
        }
    }

    static rollJackpot(player) {
        let roll = Math.random();
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
        let chance = (player.jackpotChance || 0.15) + (player.jackpotPity || 0); 

        if (roll <= chance) {
            console.log(`JACKPOT! Hráč ${player.id} získává nesmrtelnost a nekonečno munice na 4.11s!`);
            player.isJackpotActive = true;
            player.jackpotTimer = player.jackpotDuration || 4110;
<<<<<<< HEAD
            player.jackpotPity = 0; // Reset pity
        } else {
            console.log(`Gambler miss. Zvyšuji pity.`);
            // Za každé neúspěšné vyvolání se šance zvedne např. o 5%
=======
            player.jackpotPity = 0; 
        } else {
            console.log(`Gambler miss. Zvyšuji pity.`);
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
            player.jackpotPity = (player.jackpotPity || 0) + 0.05; 
        }
    }
}

module.exports = DomainManager;