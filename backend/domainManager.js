// domainManager.js - Map-wide domain effects + domain clashes

class DomainManager {

    static activateDomain(player) {
        if (!player.domainType || player.domainActive || player.domainCooldown > 0) return;
        player.domainActive = true;
        player.domainTimer  = (player.domainDuration || 5000) + (player.domainDurationBonus || 0);
        switch (player.domainType) {
            case "GAMBLER":            this.rollJackpot(player); break;
            case "MIRROR_SINGULARITY": player.ammo = 0; break;
            case "INFINITE_ARSENAL":   player.arsenalTimer = 0; break;
        }
    }

    static updateDomains(players, enemies, projectiles, deltaTime) {
        const activeDomains = [];
        for (let id in players) {
            const p = players[id];
            if (!p.domainActive && p.domainCooldown > 0) {
                p.domainCooldown -= deltaTime;
                if (p.domainCooldown < 0) p.domainCooldown = 0;
            }
            if (p.domainActive) {
                p.domainTimer -= deltaTime;
                activeDomains.push(p);
                this.applyDomainEffects(p, enemies, projectiles, deltaTime);
                if (p.domainTimer <= 0) this.deactivateDomain(p, enemies);
            }
            if (p.isJackpotActive) {
                p.jackpotTimer -= deltaTime;
                if (p.jackpotTimer <= 0) {
                    p.isJackpotActive = false;
                    if (p._preJackpotSpeed !== undefined) { p.moveSpeed = p._preJackpotSpeed; delete p._preJackpotSpeed; }
                    if (p._preJackpotDamage !== undefined) { p.damage = p._preJackpotDamage; delete p._preJackpotDamage; }
                }
            }
        }
        if (activeDomains.length >= 2) this.processDomainClashes(activeDomains, enemies, projectiles, deltaTime);
    }

    // Domain clashes - two active domains produce emergent combined effects
    static processDomainClashes(active, enemies, projectiles, deltaTime) {
        const types = active.map(p => p.domainType);
        const has = (t) => types.includes(t);
        const find = (t) => active.find(p => p.domainType === t);

        // QUANTUM_PRISON + BLOOD_ALTAR = Frozen Bleed: frozen enemies bleed 3x
        if (has("QUANTUM_PRISON") && has("BLOOD_ALTAR")) {
            const altar = find("BLOOD_ALTAR");
            enemies.forEach(e => {
                if (e.isQuantumFrozen) e.hp -= (altar.domainDamage || 10) * 2 * (deltaTime / 1000);
            });
        }

        // GRAVITY_COLLAPSE + MADNESS_VEIL = Imploding Madness: pull tripled, paralysis
        if (has("GRAVITY_COLLAPSE") && has("MADNESS_VEIL")) {
            const grav = find("GRAVITY_COLLAPSE");
            enemies.forEach(e => {
                const dx = grav.x - e.x, dy = grav.y - e.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < (grav.domainRadius || 200) * 1.5 && dist > 5) {
                    const pull = (grav.gravityPull || 5) * 25 * (deltaTime / 1000);
                    e.x += (dx/dist)*pull; e.y += (dy/dist)*pull;
                    e.isParalyzed = true; e.moveSpeed = 0;
                }
            });
        }

        // MIRROR_SINGULARITY + INFINITE_ARSENAL = Mirror Arsenal: reflected shots 3x dmg + pierce
        if (has("MIRROR_SINGULARITY") && has("INFINITE_ARSENAL") && projectiles) {
            projectiles.forEach(proj => { if (proj.isReflected) { proj.damage *= 3; proj.pierce = (proj.pierce||0)+2; } });
        }

        // QUANTUM_PRISON + GRAVITY_COLLAPSE = Singularity: players caught take 50% extra damage
        if (has("QUANTUM_PRISON") && has("GRAVITY_COLLAPSE")) {
            const grav = find("GRAVITY_COLLAPSE");
            enemies.forEach(e => {
                const dx = grav.x-e.x, dy = grav.y-e.y;
                e._singularityVuln = (dx*dx+dy*dy) < (grav.domainRadius||200)**2;
            });
        }

        // BLOOD_ALTAR + GAMBLER = Bloody Jackpot: healing crits give random bonus
        if (has("BLOOD_ALTAR") && has("GAMBLER")) {
            const altar = find("BLOOD_ALTAR");
            if (altar && Math.random() < 0.02) {
                altar.hp = Math.min(altar.maxHp||100, altar.hp + 15);
            }
        }

        // MADNESS_VEIL + GAMBLER = Wild Cards: all fire rates randomize
        if (has("MADNESS_VEIL") && has("GAMBLER")) {
            enemies.forEach(e => { e._wildFireRate = 100 + Math.random() * 600; });
        }

        // BLOOD_ALTAR + INFINITE_ARSENAL = Bloodgun: each arsenal hit heals owner
        if (has("BLOOD_ALTAR") && has("INFINITE_ARSENAL")) {
            const arsenal = find("INFINITE_ARSENAL");
            if (arsenal) arsenal.hp = Math.min(arsenal.maxHp||100, arsenal.hp + 0.5 * (deltaTime/1000));
        }
    }

    // Map-wide visual effect descriptor (sent in gameUpdate, used by render.js)
    static getMapEffect(players) {
        const active = Object.values(players||{}).filter(p => p.domainActive);
        if (active.length === 0) return null;
        if (active.length === 1) return this._domainMapEffect(active[0]);
        return { type:"CLASH", effects: active.map(p => this._domainMapEffect(p)),
                 tint: this._blendTints(active), intensity: Math.min(1, active.length * 0.35) };
    }

    static _domainMapEffect(p) {
        const defs = {
            QUANTUM_PRISON:    { tint:"rgba(42,157,244,0.18)",  vignette:"#2a9df4", fx:"grid_pulse",   label:"QUANTUM FIELD"       },
            MADNESS_VEIL:      { tint:"rgba(163,53,238,0.22)",  vignette:"#a335ee", fx:"screen_wave",  label:"VEIL OF MADNESS"     },
            BLOOD_ALTAR:       { tint:"rgba(255,0,50,0.20)",    vignette:"#ff0032", fx:"red_pulse",    label:"BLOOD ALTAR"         },
            GRAVITY_COLLAPSE:  { tint:"rgba(241,196,15,0.15)",  vignette:"#f1c40f", fx:"gravity_lens", label:"GRAVITY COLLAPSE", cx:p.x, cy:p.y },
            MIRROR_SINGULARITY:{ tint:"rgba(69,243,255,0.12)",  vignette:"#45f3ff", fx:"prism",        label:"MIRROR SINGULARITY"  },
            INFINITE_ARSENAL:  { tint:"rgba(255,170,0,0.15)",   vignette:"#ffaa00", fx:"shells_rain",  label:"INFINITE ARSENAL"    },
            GAMBLER:           { tint:"rgba(46,213,115,0.12)",  vignette:"#2ed573", fx:"color_flicker",label:"THE GAMBLE"          },
        };
        return { ...(defs[p.domainType] || { tint:"rgba(255,255,255,0.05)", fx:"none" }), type:p.domainType, intensity:0.35 };
    }

    static _blendTints(active) {
        // Take most intense domain tint color
        return this._domainMapEffect(active[0]).tint || "rgba(255,42,122,0.2)";
    }

    static applyDomainEffects(player, enemies, projectiles, deltaTime) {
        const radius = player.domainRadius || 200;
        const radiusSq = radius * radius;
        const dtSec = deltaTime / 1000;
        switch (player.domainType) {
            case "QUANTUM_PRISON":
                enemies.forEach(e => {
                    if (e.id === player.id) return;
                    const dx=player.x-e.x, dy=player.y-e.y;
                    if (dx*dx+dy*dy <= radiusSq) {
                        e.isQuantumFrozen = true;
                        e.moveSpeed = player.prisonSlowdown !== undefined ? player.prisonSlowdown : 0.1;
                        // Singularity clash bonus damage
                        if (e._singularityVuln) e.hp -= 5 * dtSec;
                    } else if (e.isQuantumFrozen) { e.isQuantumFrozen=false; e.moveSpeed=e.baseSpeed||0.8; }
                }); break;
            case "MADNESS_VEIL":
                enemies.forEach(e => {
                    if (e.id === player.id) return;
                    const dx=player.x-e.x, dy=player.y-e.y;
                    if (dx*dx+dy*dy <= radiusSq) {
                        e.hp -= (player.domainDamage||5)*dtSec;
                        e.isParalyzed=true; e.moveSpeed=0;
                    } else if (e.isParalyzed) { e.isParalyzed=false; e.moveSpeed=e.baseSpeed||0.8; }
                }); break;
            case "BLOOD_ALTAR": {
                let totalHeal=0;
                enemies.forEach(e => {
                    if (e.id===player.id) return;
                    const dx=player.x-e.x, dy=player.y-e.y;
                    if (dx*dx+dy*dy<=radiusSq) { const d=(player.domainDamage||10)*dtSec; e.hp-=d; totalHeal+=d; }
                });
                if (totalHeal>0) player.hp=Math.min(player.maxHp||100,player.hp+totalHeal*(player.lifesteal||0.2));
                break;
            }
            case "GRAVITY_COLLAPSE":
                enemies.forEach(e => {
                    if (e.id===player.id) return;
                    const dx=player.x-e.x, dy=player.y-e.y, distSq=dx*dx+dy*dy;
                    if (distSq<=radiusSq) {
                        e.hp-=(player.domainDamage||15)*dtSec;
                        const dist=Math.sqrt(distSq);
                        if (dist>5) { const f=(player.gravityPull||5)*10*dtSec; e.x+=(dx/dist)*f; e.y+=(dy/dist)*f; }
                    }
                }); break;
            case "MIRROR_SINGULARITY":
                if (projectiles) projectiles.forEach(proj => {
                    if (proj.ownerId!==player.id && !proj.isReflected) {
                        const dx=player.x-proj.x, dy=player.y-proj.y;
                        if (dx*dx+dy*dy<=radiusSq) {
                            proj.vx*=-1; proj.vy*=-1;
                            proj.damage*=(player.reflectDamageMult||1.5);
                            proj.ownerId=player.id; proj.isReflected=true;
                        }
                    }
                }); break;
            case "INFINITE_ARSENAL":
                if (player.arsenalTimer===undefined) player.arsenalTimer=0;
                player.arsenalTimer-=deltaTime;
                if (player.arsenalTimer<=0) {
                    player.arsenalTimer=player.arsenalFireRate||50;
                    enemies.forEach(e => {
                        if (e.id===player.id) return;
                        const dx=player.x-e.x, dy=player.y-e.y;
                        if (dx*dx+dy*dy<=radiusSq) e.hp-=player.arsenalDamage||10;
                    });
                } break;
        }
    }

    static deactivateDomain(player, enemies) {
        player.domainActive=false;
        player.domainCooldown=15000*(player.domainCooldownModifier||1);
        if (enemies) enemies.forEach(e => {
            if (e.isQuantumFrozen||e.isParalyzed) { e.isQuantumFrozen=false; e.isParalyzed=false; e.moveSpeed=e.baseSpeed||0.8; }
            e._singularityVuln=false; e._wildFireRate=undefined;
        });
    }

    static rollJackpot(player) {
        const roll=Math.random(), chance=(player.jackpotChance||0.15)+(player.jackpotPity||0);
        if (roll<=chance) {
            player.isJackpotActive=true; player.jackpotTimer=player.jackpotDuration||4110; player.jackpotPity=0;
            if (player.jackpotSpeedBonus) { player._preJackpotSpeed=player.moveSpeed; player.moveSpeed=Math.min(3.5,player.moveSpeed+player.jackpotSpeedBonus); }
            if (player.jackpotDamageBonus) { player._preJackpotDamage=player.damage; player.damage=Math.min(999,player.damage+player.jackpotDamageBonus); }
        } else { player.jackpotPity=(player.jackpotPity||0)+(player.jackpotPityStep||0.05); }
    }
}

module.exports = DomainManager;
