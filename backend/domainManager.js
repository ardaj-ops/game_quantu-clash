// domainManager.js
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

    // Přidán parametr 'projectiles' kvůli Zrcadlové Singularitě
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

                // Konec domény
                if (p.domainTimer <= 0) {
                    this.deactivateDomain(p);
                }
            }

            // 3. Specifický buff pro Gamblera (Jackpot nesmrtelnost a nekonečno munice)
            if (p.isJackpotActive) {
                p.jackpotTimer -= deltaTime;
                
                // Zde můžeš v hlavním kódu kontrolovat p.isJackpotActive pro nesmrtelnost
                // a nekonečnou munici (nebude se mu odečítat ammo).
                
                if (p.jackpotTimer <= 0) {
                    p.isJackpotActive = false;
                    console.log(`Hráči ${p.id} skončil Jackpot.`);
                }
            }
        }
    }

    static applyDomainEffects(player, enemies, projectiles, deltaTime) {
        const radius = player.domainRadius || 200; 
        const dtSec = deltaTime / 1000; // Převod na sekundy pro výpočet DMG/s

        switch (player.domainType) {
            case 'QUANTUM_PRISON':
                enemies.forEach(enemy => {
                    let dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
                    if (dist <= radius) {
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
                    let dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
                    if (dist <= radius) {
                        // 5 DMG/s
                        enemy.hp -= (player.domainDamage || 5) * dtSec;
                        // Paralyzuje (rychlost 0)
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
                    let dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
                    if (dist <= radius) {
                        // 10 DMG/s
                        let frameDmg = (player.domainDamage || 10) * dtSec;
                        enemy.hp -= frameDmg;
                        totalHeal += frameDmg;
                    }
                });
                // Léčení hráče na základě uděleného DMG a lifestealu
                if (totalHeal > 0) {
                    let lifestealRate = player.lifesteal || 0.2;
                    player.hp = Math.min(player.maxHp, player.hp + (totalHeal * lifestealRate));
                }
                break;

            case 'GRAVITY_COLLAPSE':
                enemies.forEach(enemy => {
                    let dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
                    if (dist <= radius) {
                        // Drtí (15 DMG/s)
                        enemy.hp -= (player.domainDamage || 15) * dtSec;
                        
                        // Vtahuje do středu
                        if (dist > 5) {
                            let pullForce = (player.gravityPull || 5) * 10 * dtSec;
                            let dx = player.x - enemy.x;
                            let dy = player.y - enemy.y;
                            enemy.x += (dx / dist) * pullForce;
                            enemy.y += (dy / dist) * pullForce;
                        }
                    }
                });
                break;

            case 'MIRROR_SINGULARITY':
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
                            }
                        }
                    });
                }
                break;

            case 'INFINITE_ARSENAL':
                // Doména střílí sama. 
                // arsenalFireRate je např. 50 (ms), takže to sype velmi rychle.
                if (player.arsenalTimer === undefined) player.arsenalTimer = 0;
                player.arsenalTimer -= deltaTime;
                
                if (player.arsenalTimer <= 0) {
                    player.arsenalTimer = player.arsenalFireRate || 50;
                    
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
        player.domainCooldown = 15000;
        console.log(`Hráči ${player.id} skončila doména ${player.domainType}.`);

        // --- UKLÍZENÍ EFEKTŮ PŘI KONCI ---
        // Nepřátelům se automaticky vrátí rychlost v dalším framu mimo if (dist <= radius) větve v applyDomainEffects, 
        // ale pro jistotu můžeš přidat globální reset, pokud by se hra chovala nestandardně.
    }

    // --- LOGIKA KARET ---
    static rollJackpot(player) {
        let roll = Math.random();
        // Šance + pity systém (pokud máš smůlu, šance se zvyšuje)
        let chance = (player.jackpotChance || 0.15) + (player.jackpotPity || 0); 

        if (roll <= chance) {
            console.log(`JACKPOT! Hráč ${player.id} získává nesmrtelnost a nekonečno munice na 4.11s!`);
            player.isJackpotActive = true;
            player.jackpotTimer = player.jackpotDuration || 4110;
            player.jackpotPity = 0; // Reset pity
        } else {
            console.log(`Gambler miss. Zvyšuji pity.`);
            // Za každé neúspěšné vyvolání se šance zvedne např. o 5%
            player.jackpotPity = (player.jackpotPity || 0) + 0.05; 
        }
    }
}

module.exports = DomainManager;