// domainManager.js
const CFG = require('./gameConfig');

class DomainManager {
    static activateDomain(player) {
        if (!player.domainType || player.isDomainActive || player.domainCooldown > 0) return;

        player.isDomainActive = true;
        // Základní doba trvání domény + případný bonus z karet
        player.domainTimer = 5000 + (player.domainDurationBonus || 0); 
        
        console.log(`Hráč ${player.id} aktivoval doménu: ${player.domainType}`);

        // Specifická logika při aktivaci
        if (player.domainType === 'GAMBLER') {
            this.rollJackpot(player);
        } else if (player.domainType === 'MIRROR_SINGULARITY') {
            player.ammo = 0; // Vyprázdní zásobník podle popisu karty
        }
    }

    static updateDomains(players, enemies, deltaTime) {
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

                // Aplikace neustálých efektů (AoE, heal, atd.)
                this.applyDomainEffects(p, enemies, deltaTime);

                // Konec domény
                if (p.domainTimer <= 0) {
                    this.deactivateDomain(p);
                }
            }

            // 3. Specifické buffy mimo samotnou doménu (např. probíhající Jackpot u Gamblera)
            if (p.isJackpotActive) {
                p.jackpotTimer -= deltaTime;
                if (p.jackpotTimer <= 0) {
                    p.isJackpotActive = false;
                    console.log(`Hráči ${p.id} skončil Jackpot.`);
                }
            }
        }
    }

    static applyDomainEffects(player, enemies, deltaTime) {
        // Tady budeme procházet nepřátele a řešit kolize s poloměrem domény (player.domainRadius)
        // Příklad pro Krvavý Oltář
        if (player.domainType === 'BLOOD_ALTAR') {
            /* Logika:
            1. Najdi nepřátele v okruhu player.domainRadius
            2. Uděl jim player.domainDamage za vteřinu (přepočítáno přes deltaTime)
            3. Vyléč hráče o určité % z uděleného DMG
            */
        }
        
        // Příklad pro Kvantové vězení
        if (player.domainType === 'QUANTUM_PRISON') {
            /*
            Logika:
            1. Najdi nepřátele v okruhu a nastav jim dočasně sníženou rychlost (nebo na CFG.MIN_CAP_MOVE_SPEED z upgradu)
            */
        }
    }

    static deactivateDomain(player) {
        player.isDomainActive = false;
        // Základní cooldown (např. 15 vteřin) modifikovaný kartami (Mistr Rituálů)
        player.domainCooldown = 15000 * (player.domainCooldownModifier || 1);
        console.log(`Hráči ${player.id} skončila doména.`);
    }

    // --- Specifické funkce ---
    static rollJackpot(player) {
        // Logika pro Gambler kartu
        let roll = Math.random();
        let chance = player.jackpotChance * (player.jackpotPity || 1); // Pity systém

        if (roll <= chance) {
            console.log(`JACKPOT padl pro hráče ${player.id}!`);
            player.isJackpotActive = true;
            player.jackpotTimer = player.jackpotDuration || 4110;
            player.jackpotPity = 1; // Reset pity
        } else {
            console.log(`Gambler miss. Zvyšuji pity.`);
            player.jackpotPity = (player.jackpotPity || 1) + (player.jackpotPityMultiplier || 0.1);
        }
    }
}

module.exports = DomainManager;