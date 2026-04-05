// cards.js
// Zajištění kompatibility napříč Frontendem (window) a Backendem (require)
const CFG = typeof window !== 'undefined' ? window.CONFIG : require('./gameConfig');

const availableCards = [
    // =========================================================================
    // COMMON
    // =========================================================================
    { name: "Gumové projektily", rarity: "common", description: "Kulky se jednou odrazí. -1 Dmg.", apply: (p) => { p.bounces = Math.min(CFG.MAX_CAP_BOUNCES, (p.bounces || 0) + 1); p.damage = Math.max(1, p.damage - 1); } },
    { name: "Svačina", rarity: "common", description: "+20 % Max HP. Jsi o malinko pomalejší.", apply: (p) => { p.maxHp = Math.min(CFG.MAX_CAP_HP, Math.floor(p.maxHp * 1.20)); p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.02); } },
    { name: "Těžká munice", rarity: "common", description: "Větší kulky, +6 Dmg, -2 Max Ammo", apply: (p) => { p.bulletSize = (p.bulletSize || 5) + 3; p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 6); p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 2); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Kukátko", rarity: "common", description: "O něco rychlejší a přesnější kulky", apply: (p) => { p.bulletSpeed = Math.min(CFG.MAX_CAP_BULLET_SPEED, p.bulletSpeed + 3); } },
    { name: "Běžecké boty", rarity: "common", description: "Rychlejší pohyb. -10 % Max HP.", apply: (p) => { p.moveSpeed = Math.min(CFG.MAX_CAP_MOVE_SPEED, p.moveSpeed + 0.15); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.90)); } },
    { name: "Promazání", rarity: "common", description: "Rychlejší střelba. Přebíjíš o chlup déle.", apply: (p) => { p.fireRate = Math.max(CFG.MIN_CAP_FIRE_RATE, p.fireRate - 30); p.reloadTime = (p.reloadTime || 1500) + 100; } },
    { name: "Štít z popelnice", rarity: "common", description: "+25 % Max HP. Jsi znatelně pomalejší.", apply: (p) => { p.maxHp = Math.min(CFG.MAX_CAP_HP, Math.floor(p.maxHp * 1.25)); p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.08); } },
    { name: "Větší kapsy", rarity: "common", description: "+4 Dmg a +4 Max Ammo. -10% rychlost pohybu.", apply: (p) => { p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 4); p.maxAmmo = Math.min(CFG.MAX_CAP_AMMO, (p.maxAmmo || 10) + 4); p.ammo = Math.min(p.ammo, p.maxAmmo); p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.05); } },
    { name: "Špičaté náboje", rarity: "common", description: "Kulky projdou skrz 1 nepřítele. -2 Dmg.", apply: (p) => { p.pierce = (p.pierce || 0) + 1; p.damage = Math.max(1, p.damage - 2); } },
    { name: "Káva", rarity: "common", description: "Rychlejší pohyb i střelba. -2 Max Ammo.", apply: (p) => { p.moveSpeed = Math.min(CFG.MAX_CAP_MOVE_SPEED, p.moveSpeed + 0.1); p.fireRate = Math.max(CFG.MIN_CAP_FIRE_RATE, p.fireRate - 15); p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 2); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Zpevněná hlaveň", rarity: "common", description: "+5 Dmg. Kulky létají trochu pomaleji.", apply: (p) => { p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 5); p.bulletSpeed = Math.max(3, p.bulletSpeed - 1); } },
    { name: "Lehká váha", rarity: "common", description: "Jsi menší. Máš o 15 % méně Max HP.", apply: (p) => { p.playerRadius = Math.max(8, (p.playerRadius || 20) - 3); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.85)); } },
    { name: "Lékárnička", rarity: "common", description: "Uzdraví 30 HP a přidá 10 % Max HP.", apply: (p) => { p.maxHp = Math.min(CFG.MAX_CAP_HP, Math.floor(p.maxHp * 1.10)); p.hp += 30; } },
    { name: "Odhodlání", rarity: "common", description: "+8 Dmg, ale kulky letí pomaleji a pomaleji střílíš.", apply: (p) => { p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 8); p.bulletSpeed = Math.max(3, p.bulletSpeed - 2); p.fireRate += 30; } },
    { name: "Rozšířený zásobník", rarity: "common", description: "+6 Max Ammo. Přebíjení trvá o 0.3s déle.", apply: (p) => { p.maxAmmo = Math.min(CFG.MAX_CAP_AMMO, (p.maxAmmo || 10) + 6); p.ammo = Math.min(p.ammo, p.maxAmmo); p.reloadTime = (p.reloadTime || 1500) + 300; } },
    { name: "Pružný krok", rarity: "common", description: "Jsi lehčí na nohou. +10% rychlost pohybu, -5% Max HP.", apply: (p) => { p.moveSpeed = Math.min(CFG.MAX_CAP_MOVE_SPEED, p.moveSpeed + 0.1); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.95)); } },
    { name: "Plastové lahve", rarity: "common", description: "Kulky letí rychleji, ale jsou menší a dávají -2 Dmg.", apply: (p) => { p.bulletSpeed = Math.min(CFG.MAX_CAP_BULLET_SPEED, p.bulletSpeed + 4); p.bulletSize = Math.max(2, (p.bulletSize || 5) - 2); p.damage = Math.max(1, p.damage - 2); } },

    // =========================================================================
    // UNCOMMON
    // =========================================================================
    { name: "Brokovnice", rarity: "uncommon", description: "3 kulky naráz. -30% Dmg. Rychlé vyprázdnění (-3 Ammo).", apply: (p) => { p.multishot = (p.multishot || 1) + 2; p.spread = 0.1; p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 3); p.ammo = Math.min(p.ammo, p.maxAmmo); p.damage = Math.max(2, p.damage * 0.70); } },
    { name: "Hřebíky", rarity: "uncommon", description: "Kulky projdou skrz 2 nepřátele. Střílíš pomaleji.", apply: (p) => { p.pierce = (p.pierce || 0) + 2; p.fireRate += 50; } },
    { name: "Flubber", rarity: "uncommon", description: "Kulky se odrazí 3x. Dmg se snižuje o 20%.", apply: (p) => { p.bounces = Math.min(CFG.MAX_CAP_BOUNCES, (p.bounces || 0) + 3); p.damage = Math.max(2, p.damage * 0.80); } },
    { name: "Záškodník", rarity: "uncommon", description: "Jsi menší a rychlejší. -25 % Max HP.", apply: (p) => { p.playerRadius = Math.max(8, (p.playerRadius || 20) - 5); p.moveSpeed = Math.min(CFG.MAX_CAP_MOVE_SPEED, p.moveSpeed + 0.1); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.75)); } },
    { name: "Odstřelovač", rarity: "uncommon", description: "Rychlé kulky, +15 Dmg. Pomalá střelba a -4 Ammo.", apply: (p) => { p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 15); p.bulletSpeed = Math.min(CFG.MAX_CAP_BULLET_SPEED, p.bulletSpeed + 10); p.fireRate += 200; p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 4); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Zdravotník", rarity: "uncommon", description: "+25 % Max HP, 2% lifesteal. Jsi větší terč.", apply: (p) => { p.maxHp = Math.min(CFG.MAX_CAP_HP, Math.floor(p.maxHp * 1.25)); p.lifesteal = Math.min(CFG.MAX_CAP_LIFESTEAL, (p.lifesteal || 0) + 0.02); p.playerRadius = (p.playerRadius || 20) + 3; } },
    { name: "Pružina", rarity: "uncommon", description: "Rychlejší pohyb, 2 odrazy kulek. Tvé kulky létají mnohem pomaleji.", apply: (p) => { p.moveSpeed = Math.min(CFG.MAX_CAP_MOVE_SPEED, p.moveSpeed + 0.2); p.bounces = Math.min(CFG.MAX_CAP_BOUNCES, (p.bounces || 0) + 2); p.bulletSpeed = Math.max(3, p.bulletSpeed - 3); } },
    { name: "Široká hlaveň", rarity: "uncommon", description: "Větší kulky, +10 Dmg. Pomalejší přebíjení (+0.4s).", apply: (p) => { p.bulletSize = (p.bulletSize || 5) + 3; p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 10); p.reloadTime = (p.reloadTime || 1500) + 400; } },
    { name: "Adrenalin", rarity: "uncommon", description: "+12 Dmg, rychlejší pohyb. Stojí to 20 % Max HP a přesnost.", apply: (p) => { p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 12); p.moveSpeed = Math.min(CFG.MAX_CAP_MOVE_SPEED, p.moveSpeed + 0.2); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.80)); p.spread = (p.spread || 0) + 0.05; } },
    { name: "Lehká spoušť", rarity: "uncommon", description: "Rychlejší střelba. -3 Dmg.", apply: (p) => { p.fireRate = Math.max(CFG.MIN_CAP_FIRE_RATE, p.fireRate - 50); p.damage = Math.max(1, p.damage - 3); } },
    { name: "Svižné prsty", rarity: "uncommon", description: "Přebíjíš o 30% rychleji. Kapacita zbraně -2 Ammo.", apply: (p) => { p.reloadTime = Math.max(300, (p.reloadTime || 1500) * 0.7); p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 2); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Ocelový štít", rarity: "uncommon", description: "+35 % Max HP, ale jsi výrazně větší terč a vlečeš se (-15% rychlost).", apply: (p) => { p.maxHp = Math.min(CFG.MAX_CAP_HP, Math.floor(p.maxHp * 1.35)); p.playerRadius = (p.playerRadius || 20) + 8; p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.15); } },
    { name: "Recyklace", rarity: "uncommon", description: "+15 % Max HP. Tvé zbraně jsou trochu přesnější (menší rozptyl).", apply: (p) => { p.maxHp = Math.min(CFG.MAX_CAP_HP, Math.floor(p.maxHp * 1.15)); p.spread = Math.max(0, (p.spread || 0) - 0.05); } },
    { name: "Těžká olovnice", rarity: "uncommon", description: "+8 Dmg, kulky jsou větší, ale letí mnohem pomaleji a ty se vlečeš.", apply: (p) => { p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 8); p.bulletSize = (p.bulletSize || 5) + 4; p.bulletSpeed = Math.max(2, p.bulletSpeed - 3); p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.1); } },

    // =========================================================================
    // RARE
    // =========================================================================
    { name: "Upír", rarity: "rare", description: "Sání životů (5%). Jsi pomalejší a křehčí (-15 % Max HP).", apply: (p) => { p.lifesteal = Math.min(CFG.MAX_CAP_LIFESTEAL, (p.lifesteal || 0) + 0.05); p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.05); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.85)); } },
    { name: "Ještěří krev", rarity: "rare", description: "Extrémně pomalu regeneruješ životy (+1 HP/s). -10 % Max HP.", apply: (p) => { p.hpRegen = (p.hpRegen || 0) + 1; p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.90)); } },
    { name: "Dvojče", rarity: "rare", description: "Střílíš 2 kulky vedle sebe. -20% Dmg, -4 Max Ammo.", apply: (p) => { p.multishot = (p.multishot === 1 ? 2 : p.multishot + 1); p.spread = 0.05; p.damage = Math.max(2, p.damage * 0.80); p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 4); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Nindža", rarity: "rare", description: "Jsi menší a rychlý. Extrémně křehký (-40 % Max HP).", apply: (p) => { p.playerRadius = Math.max(8, (p.playerRadius || 20) - 7); p.moveSpeed = Math.min(CFG.MAX_CAP_MOVE_SPEED, p.moveSpeed + 0.25); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.60)); } },
    { name: "Kanón", rarity: "rare", description: "Obří kulky, +20 Dmg. Pohybuješ se o 15% pomaleji a pálíš pomalu.", apply: (p) => { p.bulletSize = (p.bulletSize || 5) + 10; p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 20); p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.15); p.fireRate += 100; } },
    { name: "Kevlarový oblek", rarity: "rare", description: "+50 % Max HP, mírně pomalejší. Rychlost kulek i střelby klesá.", apply: (p) => { p.maxHp = Math.min(CFG.MAX_CAP_HP, Math.floor(p.maxHp * 1.50)); p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.1); p.bulletSpeed = Math.max(3, p.bulletSpeed - 1.5); p.fireRate += 40; } },
    { name: "Trojitá hrozba", rarity: "rare", description: "3 kulky, 1 odraz. -30% Dmg, Přebíjení +0.6s.", apply: (p) => { p.multishot = (p.multishot === 1 ? 3 : p.multishot + 2); p.spread = 0.12; p.bounces = Math.min(CFG.MAX_CAP_BOUNCES, (p.bounces || 0) + 1); p.damage = Math.max(2, p.damage * 0.70); p.reloadTime = (p.reloadTime || 1500) + 600; } },
    { name: "Chirurg", rarity: "rare", description: "+12 Dmg, průraz skrz 3. Tvé kulky jsou ale mikroskopické (-3 velikost) a máš -3 Ammo.", apply: (p) => { p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 12); p.pierce = (p.pierce || 0) + 3; p.bulletSize = Math.max(2, (p.bulletSize || 5) - 3); p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 3); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Rychlopalba", rarity: "rare", description: "Rychlejší střelba, menší kulky. Rozptyl se výrazně zhorší.", apply: (p) => { p.fireRate = Math.max(CFG.MIN_CAP_FIRE_RATE, p.fireRate - 80); p.bulletSize = Math.max(2, (p.bulletSize || 5) - 2); p.spread = (p.spread || 0) + 0.15; } },
    { name: "Mutant", rarity: "rare", description: "+25 % Max HP, sání životů 4%. Přebíjení zbraně trvá o 0.5s déle.", apply: (p) => { p.maxHp = Math.min(CFG.MAX_CAP_HP, Math.floor(p.maxHp * 1.25)); p.lifesteal = Math.min(CFG.MAX_CAP_LIFESTEAL, (p.lifesteal || 0) + 0.04); p.reloadTime = (p.reloadTime || 1500) + 500; } },
    { name: "Absolutní optika", rarity: "rare", description: "Laserová přesnost (0 rozptyl), rychlé kulky, +15 Dmg. Přebíjení +0.8s, -3 Ammo.", apply: (p) => { p.spread = 0; p.bulletSpeed = Math.min(CFG.MAX_CAP_BULLET_SPEED, p.bulletSpeed + 8); p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 15); p.reloadTime = (p.reloadTime || 1500) + 800; p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 3); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Vysavač duší", rarity: "rare", description: "Lifesteal +4%. Přebíjení trvá o 0.6s déle a ztrácíš -15 % Max HP.", apply: (p) => { p.lifesteal = Math.min(CFG.MAX_CAP_LIFESTEAL, (p.lifesteal || 0) + 0.04); p.reloadTime = (p.reloadTime || 1500) + 600; p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.85)); } },
    { name: "Trojitý průraz", rarity: "rare", description: "Průraz skrz 3 cíle, +5 Dmg. Ztrácíš 3 Ammo z kapacity a pálíš pomaleji.", apply: (p) => { p.pierce = (p.pierce || 0) + 3; p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 5); p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 3); p.ammo = Math.min(p.ammo, p.maxAmmo); p.fireRate += 100; } },

    // =========================================================================
    // EPIC
    // =========================================================================
    { name: "Stínový Dash", rarity: "epic", description: "Dash přidá neviditelnost (zruší se výstřelem). Trvale ztrácíš 25 % Max HP a -2 Ammo.", apply: (p) => { p.invisOnDash = true; p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.75)); p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 2); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Holografický Klon", rarity: "epic", description: "Dash zanechá klon. Rychlost pohybu i střelby klesá o 10%.", apply: (p) => { p.cloneOnDash = true; p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.08); p.fireRate += 40; } },
    { name: "Bumerang", rarity: "epic", description: "Kulky se odrazí 3x. Pomalá střelba, dlouhé přebíjení (+0.8s) a -20% Dmg.", apply: (p) => { p.bounces = Math.min(CFG.MAX_CAP_BOUNCES, (p.bounces || 0) + 3); p.fireRate += 50; p.reloadTime = (p.reloadTime || 1500) + 800; p.damage = Math.max(2, p.damage * 0.80); } },
    { name: "Krvavá brokovnice", rarity: "epic", description: "5 kulek, 3% lifesteal. Dmg -60%, pálíš pomalu, přebíjení +1s, -5 Ammo.", apply: (p) => { p.multishot = (p.multishot === 1 ? 5 : p.multishot + 4); p.spread = 0.2; p.lifesteal = Math.min(CFG.MAX_CAP_LIFESTEAL, (p.lifesteal || 0) + 0.03); p.damage = Math.max(2, p.damage * 0.4); p.fireRate += 150; p.reloadTime = (p.reloadTime || 1500) + 1000; p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 5); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Juggernaut", rarity: "epic", description: "Obrovský terč (+15 velikost), +100 % Max HP. -20% Rychlost pohybu, střílíš hrozně pomalu.", apply: (p) => { p.playerRadius = (p.playerRadius || 20) + 15; p.maxHp = Math.min(CFG.MAX_CAP_HP, Math.floor(p.maxHp * 2.00)); p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.2); p.fireRate += 120; } },
    { name: "Laserový vrtač", rarity: "epic", description: "Rychlé kulky, průraz 4. Výstřely žerou -30% Dmg a přebíjíš mnohem déle.", apply: (p) => { p.pierce = (p.pierce || 0) + 4; p.bulletSpeed = Math.min(CFG.MAX_CAP_BULLET_SPEED, p.bulletSpeed + 12); p.fireRate += 80; p.damage = Math.max(2, p.damage * 0.70); p.reloadTime = (p.reloadTime || 1500) + 700; } },
    { name: "Drtič", rarity: "epic", description: "+30 Dmg. Obří kulky. Přebíjení trvá neskutečně dlouho (+1.5s) a -4 Ammo.", apply: (p) => { p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 30); p.fireRate += 200; p.bulletSize = (p.bulletSize || 5) + 7; p.reloadTime = (p.reloadTime || 1500) + 1500; p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 4); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Kofeinový šok", rarity: "epic", description: "Rychlejší všechno. Stojí tě to 40 % Max HP, -2 Ammo a rozptyl kulek.", apply: (p) => { p.moveSpeed = Math.min(CFG.MAX_CAP_MOVE_SPEED, p.moveSpeed + 0.25); p.fireRate = Math.max(CFG.MIN_CAP_FIRE_RATE, p.fireRate - 80); p.bulletSpeed = Math.min(CFG.MAX_CAP_BULLET_SPEED, p.bulletSpeed + 5); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.60)); p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 2); p.ammo = Math.min(p.ammo, p.maxAmmo); p.spread = (p.spread || 0) + 0.1; } },
    { name: "Ocelový ježek", rarity: "epic", description: "4 kulky, 2 odrazy, +50 % Max HP. -40% Dmg, dlouhé přebíjení, -5 Ammo.", apply: (p) => { p.multishot = (p.multishot === 1 ? 4 : p.multishot + 3); p.spread = 0.15; p.bounces = Math.min(CFG.MAX_CAP_BOUNCES, (p.bounces || 0) + 2); p.maxHp = Math.min(CFG.MAX_CAP_HP, Math.floor(p.maxHp * 1.50)); p.damage = Math.max(2, p.damage * 0.6); p.fireRate += 100; p.reloadTime = (p.reloadTime || 1500) + 900; p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 5); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Bezedný pás", rarity: "epic", description: "+25 Max Ammo. Tvůj pohyb je o 25% pomalejší a přebíjení +1.2s.", apply: (p) => { p.maxAmmo = Math.min(CFG.MAX_CAP_AMMO, (p.maxAmmo || 10) + 25); p.ammo = p.maxAmmo; p.reloadTime = (p.reloadTime || 1500) + 1200; p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.25); } },
    { name: "Skleněné dělo", rarity: "epic", description: "Extrémní poškození (+40 Dmg) a rychlost. Tvé Max HP je ale sníženo o 75 %!", apply: (p) => { p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 40); p.moveSpeed = Math.min(CFG.MAX_CAP_MOVE_SPEED, p.moveSpeed + 0.2); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.25)); } },
    { name: "Broková stěna", rarity: "epic", description: "8 kulek. Hrozný rozptyl, -50% Dmg, pomalý pohyb a přebíjení +1s.", apply: (p) => { p.multishot = (p.multishot || 1) + 7; p.spread = 0.3; p.damage = Math.max(1, p.damage * 0.50); p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.15); p.reloadTime = (p.reloadTime || 1500) + 1000; } },
    { name: "Krvavá oběť", rarity: "epic", description: "+40 Dmg, obrovské zrychlení. Ztrácíš 60 % Max HP a jsi velký terč.", apply: (p) => { p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 40); p.moveSpeed = Math.min(CFG.MAX_CAP_MOVE_SPEED, p.moveSpeed + 0.3); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.40)); p.playerRadius = (p.playerRadius || 20) + 10; } },
    
    // =========================================================================
    // LEGENDARY
    // =========================================================================
    { name: "Minigun", rarity: "legendary", description: "Extrémní rychlost, +40 Ammo. Dmg -80%, hrozný rozptyl, rychlost -15%.", apply: (p) => { p.fireRate = Math.max(CFG.MIN_CAP_FIRE_RATE, p.fireRate * 0.2); p.spread = 0.25; p.damage = Math.max(1, p.damage * 0.20); p.bulletSize = Math.max(2, (p.bulletSize || 5) - 3); p.maxAmmo = Math.min(CFG.MAX_CAP_AMMO, (p.maxAmmo || 10) + 40); p.ammo = p.maxAmmo; p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.15); } },
    { name: "Hromová rána", rarity: "legendary", description: "Obří kulka, +65 Dmg. Pomalá střelba, Přebíjení +2s. Kapacita: Max 3 Ammo.", apply: (p) => { p.bulletSize = (p.bulletSize || 5) + 15; p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 65); p.fireRate += 350; p.reloadTime = (p.reloadTime || 1500) + 2000; p.maxAmmo = Math.min(3, p.maxAmmo); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Stěna smrti", rarity: "legendary", description: "7 kulek (průraz 5). Dmg -70%. Přebíjení +1.5s, -6 Ammo.", apply: (p) => { p.multishot = (p.multishot === 1 ? 7 : p.multishot + 6); p.spread = 0.15; p.pierce = (p.pierce || 0) + 5; p.fireRate += 300; p.reloadTime = (p.reloadTime || 1500) + 1500; p.damage = Math.max(1, p.damage * 0.3); p.bulletSpeed = Math.max(3, p.bulletSpeed - 5); p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 6); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Drakula", rarity: "legendary", description: "Sání životů +8%, +15 Dmg. Tvé Max HP se sníží o 60%. Ztratíš 3 Ammo.", apply: (p) => { p.lifesteal = Math.min(CFG.MAX_CAP_LIFESTEAL, (p.lifesteal || 0) + 0.08); p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 15); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.40)); p.fireRate += 120; p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 3); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Zrcadlové bludiště", rarity: "legendary", description: "5 kulek, 4 odrazy. -60% Dmg, dlouhý cooldown, přebíjení +1.5s, -5 Ammo.", apply: (p) => { p.multishot = (p.multishot === 1 ? 5 : p.multishot + 4); p.spread = 0.2; p.bounces = Math.min(CFG.MAX_CAP_BOUNCES, (p.bounces || 0) + 4); p.damage = Math.max(1, p.damage * 0.4); p.fireRate += 200; p.reloadTime = (p.reloadTime || 1500) + 1500; p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 5); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Hyper-jádro", rarity: "legendary", description: "Střílíš jako šílený, přebíjíš téměř okamžitě. Dmg klesá o 70%, Max HP -40%.", apply: (p) => { p.fireRate = Math.max(CFG.MIN_CAP_FIRE_RATE, p.fireRate - 200); p.reloadTime = Math.max(200, (p.reloadTime || 1500) - 1000); p.damage = Math.max(1, p.damage * 0.30); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.60)); } },

    // =========================================================================
    // MYTHIC
    // =========================================================================
    { name: "Matrix", rarity: "mythic", description: "Průraz 5, extrémní rychlost, bleskové přebíjení. -50% Max HP, Dmg -40%.", apply: (p) => { p.playerRadius = Math.max(8, (p.playerRadius || 20) - 8); p.moveSpeed = Math.min(CFG.MAX_CAP_MOVE_SPEED, p.moveSpeed + 0.3); p.pierce = (p.pierce || 0) + 5; p.reloadTime = Math.max(300, (p.reloadTime || 1500) - 800); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.50)); p.damage = Math.max(2, p.damage * 0.6); } },
    { name: "Bůh krve", rarity: "mythic", description: "Lifesteal 10%, rychlopalba, +10 Dmg. -50% Max HP, Max Ammo fixováno na 3.", apply: (p) => { p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 10); p.fireRate = Math.max(CFG.MIN_CAP_FIRE_RATE, p.fireRate - 120); p.lifesteal = Math.min(CFG.MAX_CAP_LIFESTEAL, (p.lifesteal || 0) + 0.10); p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.50)); p.maxAmmo = Math.min(3, p.maxAmmo); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Apokalypsa", rarity: "mythic", description: "6 kulek, 2 odrazy. Obří terč, -65% Dmg, šílené přebíjení (+2.5s), -7 Ammo.", apply: (p) => { p.multishot = (p.multishot === 1 ? 6 : p.multishot + 5); p.spread = 0.2; p.bounces = Math.min(CFG.MAX_CAP_BOUNCES, (p.bounces || 0) + 2); p.damage = Math.max(1, p.damage * 0.35); p.playerRadius = (p.playerRadius || 20) + 15; p.fireRate += 300; p.reloadTime = (p.reloadTime || 1500) + 2500; p.maxAmmo = Math.max(1, (p.maxAmmo || 10) - 7); p.ammo = Math.min(p.ammo, p.maxAmmo); } },
    { name: "Absolutní Ticho", rarity: "mythic", description: "Průraz 7, 5 odrazů, +20 Dmg. Pohybuješ se v mrákotách (-40% rychlost) a max ammo je 2.", apply: (p) => { p.pierce = (p.pierce || 0) + 7; p.bounces = Math.min(CFG.MAX_CAP_BOUNCES, (p.bounces || 0) + 5); p.damage = Math.min(CFG.MAX_CAP_DAMAGE, p.damage + 20); p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.40); p.maxAmmo = Math.min(2, p.maxAmmo); p.ammo = Math.min(p.ammo, p.maxAmmo); } },

    // =========================================================================
    // EXOTIC
    // =========================================================================
    { name: "Zlatá kulka", rarity: "exotic", description: `Maximální DMG (${typeof CFG !== 'undefined' ? CFG.MAX_CAP_DAMAGE : 999}). Průraz 10. Máš POUZE 1 náboj a přebíjíš 5 vteřin.`, apply: (p) => { p.damage = CFG.MAX_CAP_DAMAGE; p.bulletSize = Math.max(2, (p.bulletSize || 5) - 3); p.fireRate += 1000; p.pierce = (p.pierce || 0) + 10; p.maxAmmo = 1; p.ammo = 1; p.reloadTime = (p.reloadTime || 1500) + 5000; } },
    { name: "Ruská ruleta", rarity: "exotic", description: "Máš 6 nábojů. 5 dělá 1 Dmg, 1 dává masivních +150 Dmg (Rozhoduje štěstí při každém výstřelu!)", apply: (p) => { p.isRussianRoulette = true; p.maxAmmo = 6; p.ammo = 6; } },

    // =========================================================================
    // TRANSCENDED
    // =========================================================================
    { name: "Gambler", rarity: "transcended", description: "Rituál: Hazard smrti. V doméně se losuje. Jackpot dává na 4.11s absolutní nesmrtelnost a nekonečno munice.", apply: (p) => { p.domainType = 'GAMBLER'; p.domainRadius = 280; p.jackpotChance = 0.15; p.jackpotDuration = 4110; p.isJackpotActive = false; p.jackpotPity = 0; } },
    { name: "Kvantové Vězení", rarity: "transcended", description: "Rituál: Zmrazí čas. Extrémně zpomalí nepřátele, ale ty jsi o 30% rychlejší. DMG klesne o 20%.", apply: (p) => { p.domainType = 'QUANTUM_PRISON'; p.domainRadius = 250; p.moveSpeed = Math.min(CFG.MAX_CAP_MOVE_SPEED, p.moveSpeed + 0.3); p.damage = Math.max(1, p.damage * 0.8); } },
    { name: "Závoj Šílenství", rarity: "transcended", description: "Rituál: Paralyzuje a spaluje mysl nepřátel v dosahu (5 DMG/s). Stojí tě to 30% Max HP.", apply: (p) => { p.domainType = 'MADNESS_VEIL'; p.domainRadius = 250; p.domainDamage = 5; p.maxHp = Math.max(CFG.MIN_CAP_HP, Math.floor(p.maxHp * 0.7)); } },
    { name: "Krvavý Oltář", rarity: "transcended", description: "Rituál: Masivně vysává HP všemu v okolí (10 DMG/s) a léčí tě. Skoro se ale nemůžeš hýbat (-60% rychlost).", apply: (p) => { p.domainType = 'BLOOD_ALTAR'; p.domainRadius = 220; p.domainDamage = 10; p.lifesteal = Math.min(CFG.MAX_CAP_LIFESTEAL, (p.lifesteal || 0) + 0.2); p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.6); } },
    { name: "Gravitační Kolaps", rarity: "transcended", description: "Rituál: Drtivá černá díra. Silně vtahuje a drtí nepřátele (15 DMG/s). Přebíjíš o 2s déle.", apply: (p) => { p.domainType = 'GRAVITY_COLLAPSE'; p.domainRadius = 300; p.gravityPull = 5; p.domainDamage = 15; p.reloadTime = (p.reloadTime || 1500) + 2000; } },
    { name: "Zrcadlová Singularita", rarity: "transcended", description: "Rituál: Absolutní obrana. Odráží cizí kulky zpět s +50% poškozením. Přijdeš o všechny náboje (nemůžeš střílet).", apply: (p) => { p.domainType = 'MIRROR_SINGULARITY'; p.domainRadius = 180; p.reflectDamageMult = 1.5; p.maxAmmo = 0; p.ammo = 0; } },
    { name: "Nekonečný Arzenál", rarity: "transcended", description: "Rituál: Doména střílí všude kolem tebe za tebe. Tvé vlastní zbraně dělají -80% DMG.", apply: (p) => { p.domainType = 'INFINITE_ARSENAL'; p.domainRadius = 250; p.arsenalFireRate = 50; p.arsenalDamage = 10; p.damage = Math.max(1, p.damage * 0.2); } },

    // --- Vylepšení Rituálů (Upgrady domén) ---
    { name: "Prodloužený Rituál", rarity: "legendary", requiresDomain: true, description: "Tvá doména zůstane aktivní o 3 vteřiny déle.", apply: (p) => { p.domainDurationBonus = (p.domainDurationBonus || 0) + 3000; } },
    { name: "Mistr Rituálů", rarity: "mythic", requiresDomain: true, description: "Zkracuje cooldown domény o 20 %.", apply: (p) => { p.domainCooldownModifier = (p.domainCooldownModifier || 1) * 0.8; } },
    
    // Upravené Specifické Upgrady
    { name: "Zmanipulovaná Ruleta", rarity: "epic", requiresDomain: true, specificDomain: "GAMBLER", description: "V doméně Gambler se šance na Jackpot zvyšuje rychleji (Pity x3).", apply: (p) => { p.jackpotChance = (p.jackpotChance || 0.15) * 1.5; p.jackpotPityStep = 0.15; } },
    { name: "Horečka Jackpotu", rarity: "legendary", requiresDomain: true, specificDomain: "GAMBLER", description: "Jackpot trvá o 4 vteřiny déle a získáš během něj masivní rychlost a poškození.", apply: (p) => { p.jackpotDuration = (p.jackpotDuration || 4110) + 4000; p.jackpotSpeedBonus = 0.5; p.jackpotDamageBonus = 20; } },
    { name: "Krvavá Hostina", rarity: "epic", requiresDomain: true, specificDomain: "BLOOD_ALTAR", description: "Krvavý oltář dává dvojnásobné poškození a léčí ještě víc.", apply: (p) => { p.domainDamage = (p.domainDamage || 10) * 2; p.lifesteal = Math.min(CFG.MAX_CAP_LIFESTEAL, (p.lifesteal || 0) + 0.15); } },
    { name: "Horizont Událostí", rarity: "legendary", requiresDomain: true, specificDomain: "GRAVITY_COLLAPSE", description: "Gravitační kolaps vtahuje z mnohem větší dálky (+50% dosah).", apply: (p) => { p.domainRadius = (p.domainRadius || 300) * 1.5; p.gravityPull = (p.gravityPull || 5) * 1.3; } },
    { name: "Kvantové Zmrznutí", rarity: "epic", requiresDomain: true, specificDomain: "QUANTUM_PRISON", description: `Nepřátelé v doméně se prakticky zastaví (${typeof CFG !== 'undefined' ? CFG.MIN_CAP_MOVE_SPEED : 0.2}).`, apply: (p) => { p.prisonSlowdown = CFG.MIN_CAP_MOVE_SPEED; } },
    { name: "Továrna na Smrt", rarity: "legendary", requiresDomain: true, specificDomain: "INFINITE_ARSENAL", description: "Nekonečný arzenál střílí o 50% rychleji s dvojnásobným DMG.", apply: (p) => { p.arsenalFireRate = Math.max(10, Math.floor((p.arsenalFireRate || 50) * 0.66)); p.arsenalDamage = (p.arsenalDamage || 10) * 2; } },
    { name: "Tříštivé Zrcadlo", rarity: "legendary", requiresDomain: true, specificDomain: "MIRROR_SINGULARITY", description: "Odráží kulky s brutálním 300% bonusem k poškození, ale ztratíš 20% rychlosti.", apply: (p) => { p.reflectDamageMult = (p.reflectDamageMult || 1.5) + 1.5; p.moveSpeed = Math.max(CFG.MIN_CAP_MOVE_SPEED, p.moveSpeed - 0.2); } }
];

// =========================================================================
// FUNKCE PRO FILTROVÁNÍ KARET (HLÍDÁ LOGIKU DOMÉN)
// =========================================================================
function getValidCardsForPlayer(player) {
    return availableCards.filter(card => {
        if (card.rarity === 'transcended' && !card.requiresDomain) {
            if (player.domainType) return false;
        }

        if (card.requiresDomain && !card.specificDomain) {
            if (!player.domainType) return false;
        }

        if (card.specificDomain) {
            if (player.domainType !== card.specificDomain) return false;
        }

        return true;
    });
}

// =========================================================================
// EXPORT PRO SERVER I KLIENT
// =========================================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { availableCards, getValidCardsForPlayer };
} else if (typeof window !== 'undefined') {
    window.availableCards = availableCards;
    window.getValidCardsForPlayer = getValidCardsForPlayer;
}