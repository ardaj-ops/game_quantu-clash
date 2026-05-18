// ============================================================
//  QUANTUM CLASH — PATCH NOTES
//  Every code change is logged here with version, date, file,
//  and a plain-language description of what changed and why.
//  Add a new entry at the TOP for every future change.
// ============================================================

const PATCH_NOTES = [
    {
        version: 'v16',
        date:    '2026-05-18',
        changes: [
            // render.js
            { file:'render.js',  type:'feature', text:'Domain map-wide visual effects: each domain now paints the whole arena — Gravity Collapse draws a spinning black hole with spiral arms and concentric rings, Infinite Arsenal shows 6 orbiting rotating gun sprites with muzzle flashes and raining shell casings, Madness Veil sweeps purple ripple bands, Blood Altar pulses a red heartbeat scan pattern, etc.' },
            { file:'render.js',  type:'feature', text:'Tab menu: mouse unlock button at bottom. Click "🔒 ODEMKNOUT KURZOR" to free the cursor while tab is open so you can hover card chips for tooltips. Tab release resets it.' },
            { file:'render.js',  type:'feature', text:'Full stat bars panel in tab menu: HP, Damage, Speed, Kadence, Bullet Speed, Max Ammo, Reload Time, Bounces, Pierce, Lifesteal, HP Regen, Multishot — all shown with colour-coded fill bars and numeric values.' },
            { file:'render.js',  type:'feature', text:'Three-panel tab layout: left = score list with HP bars, middle = card history chips with hover tooltip, right = full stat bars.' },
            { file:'render.js',  type:'perf',    text:'Grid cached on offscreen canvas — redrawn only on resize instead of every frame. ~3% CPU saved on 1920×1080.' },
            { file:'render.js',  type:'perf',    text:'Local and remote bullet loops merged into one shared loop.' },
            // gameHelper.js
            { file:'gameHelper.js', type:'feature', text:'Card rarity changed from arbitrary weight system (100/70/40...) to exact defined percentages: common 40%, uncommon 25%, rare 18%, epic 10%, legendary 4.5%, mythic 1.5%, exotic 0.8%, transcended 0.2%.' },
            { file:'gameHelper.js', type:'fix',     text:'Rarity fallback: if no card of the rolled rarity is available, steps down one tier at a time rather than picking randomly from all cards.' },
        ]
    },
    {
        version: 'v15',
        date:    '2026-05-17',
        changes: [
            { file:'app.js',     type:'fix',     text:'CRITICAL: roomInfo and settingsChanged handlers moved from initNetwork() (game-start) to app.js top-level (page-load). Previously the creator joined the lobby, roomInfo fired, no listener was registered yet → settings panel never appeared.' },
            { file:'app.js',     type:'fix',     text:'GAMEOVER screen now populates winner name, color, and final sorted scoreboard from server event data.' },
            { file:'server.js',  type:'fix',     text:'BOSS mode added to changeSettings whitelist — was silently ignored before.' },
            { file:'server.js',  type:'fix',     text:'Spawn filter now excludes destroyed breakables and border walls with negative coordinates.' },
            { file:'physics.js', type:'fix',     text:'Arena border always bounces bullets for free (no bouncesLeft consumed). Previously deleted bullets on border hit even with bounce upgrades.' },
            { file:'physics.js', type:'fix',     text:'Diagonal movement normalised: dx/dy multiplied by 0.7071 when both axes active, so diagonal speed = cardinal speed.' },
            { file:'index.html', type:'feature', text:'BOSS mode option added to game mode dropdown.' },
            { file:'index.html', type:'fix',     text:'gameover-scores div added to gameover panel for final leaderboard.' },
        ]
    },
    {
        version: 'v14',
        date:    '2026-05-16',
        changes: [
            { file:'render.js',  type:'feature', text:'drawTabMenu fully rewritten: 3-panel layout (scores, stat bars, card history).' },
            { file:'render.js',  type:'feature', text:'Card chips in tab menu: small coloured letter icons. Hover shows full card name, rarity, and description in HTML tooltip.' },
            { file:'physics.js', type:'fix',     text:'Border walls (isBorder flag) filtered from movement collision list — previously caused wrong push-out normals and CPU waste.' },
            { file:'server.js',  type:'fix',     text:'GAMEOVER check added to startNewRound: game now ends when a player reaches maxRounds score.' },
            { file:'server.js',  type:'fix',     text:'Solo-play card selection no longer freezes — skips card phase when playerCount <= 1.' },
        ]
    },
    {
        version: 'v13',
        date:    '2026-05-15',
        changes: [
            { file:'server.js',  type:'feature', text:'Boss mode: creator picks 3 starting cards before round launches. Boss gets 3× HP. Round ends when boss dies or all challengers die.' },
            { file:'server.js',  type:'fix',     text:'Spawn filter strips isBorder obstacles before calling getValidSpawnPoint.' },
            { file:'network.js', type:'feature', text:'showBossCardSelection, bossPickingCards, bossPickProgress socket events added.' },
            { file:'render.js',  type:'feature', text:'Boss crown (👑) rendered above boss player nametag, gold name text.' },
            { file:'index.html', type:'feature', text:'Boss picking banner element added to game screen.' },
        ]
    },
    {
        version: 'v12',
        date:    '2026-05-14',
        changes: [
            { file:'domainManager.js', type:'feature', text:'6 domain clashes: Quantum Prison + Blood Altar = Frozen Bleed (3× altar damage on frozen enemies). Gravity + Madness = Imploding Madness (3× pull + paralysis). Mirror + Arsenal = Mirror Arsenal (3× DMG + pierce on reflected shots). Prison + Gravity = Singularity (+50% damage vuln). Altar + Gambler = Bloody Jackpot. Veil + Gambler = Wild Cards (random fire rates).' },
            { file:'domainManager.js', type:'feature', text:'getMapEffect() returns visual descriptor for each active domain, used by render.js for arena-wide effects.' },
            { file:'cards.js',         type:'balance', text:'All 7 domain cards rebalanced: Blood Altar -30% speed (was -60%), Mirror Singularity -50% ammo (was total disable), Infinite Arsenal -40% own DMG (was -80%), Gravity Collapse +0.5s reload (was +2s), Quantum Prison +0.15 speed (was +0.3).' },
        ]
    },
    {
        version: 'v11',
        date:    '2026-05-13',
        changes: [
            { file:'server.js',  type:'fix',     text:'startNewRound now checks maxRounds and triggers GAMEOVER with winner name/color/scores. Game no longer runs forever.' },
            { file:'server.js',  type:'fix',     text:'Solo mode: card selection skips when playerCount <= 1, no longer freezes.' },
            { file:'app.js',     type:'fix',     text:'GAMEOVER handler sets #winner-text and populates #gameover-scores.' },
            { file:'index.html', type:'fix',     text:'#gameover-scores div added to gameover panel.' },
            { file:'render.js',  type:'fix',     text:'Removed dead variable const scaleX = state.gameOffsetX (was wrong assignment, never used).' },
        ]
    },
    {
        version: 'v10',
        date:    '2026-05-12',
        changes: [
            { file:'server.js',  type:'perf',    text:'20/80 split: domain+regen runs at 60fps, gameUpdate broadcast dropped to 20fps. Saves 67% outbound socket traffic.' },
            { file:'physics.js', type:'perf',    text:'clientSync throttled to 20pps (every 3rd frame) to match server broadcast rate.' },
            { file:'network.js', type:'perf',    text:'REMOTE_LERP raised 0.20→0.35, LOCAL_LERP 0.30→0.40, threshold 10→12px to compensate for 20fps broadcasts.' },
            { file:'render.js',  type:'feature', text:'Tab menu with stat bars (DMG/SPD/AMMO/HP) and card history chips with hover tooltip.' },
        ]
    },
    {
        version: 'v9',
        date:    '2026-05-11',
        changes: [
            { file:'gameHelper.js', type:'fix',     text:'INNER_MARGIN fixed from 520 to 80: with 520 the obstacle y-range was 520→480 (inverted), so zero obstacles ever spawned.' },
            { file:'gameHelper.js', type:'fix',     text:'Obstacle generation uses while(count<TARGET && attempts<60) so 8 solid + 8 breakable walls are always placed.' },
            { file:'server.js',     type:'fix',     text:'cloneOnDash card fully implemented: Dash event now creates p.clone with expiry timer, sent in buildLean.' },
            { file:'server.js',     type:'fix',     text:'invisOnDash: shooting in playerShot now clears isInvisible.' },
            { file:'render.js',     type:'fix',     text:'isInvisible: remote invisible players now skipped in drawPlayers; self drawn at 25% alpha.' },
            { file:'render.js',     type:'fix',     text:'Clone rendered as 35% alpha faded player circle before real player.' },
            { file:'render.js',     type:'fix',     text:'Arena border drawn as 12px solid neon wall with shadowBlur glow.' },
            { file:'render.js',     type:'fix',     text:'drawMapObjects skips isBorder obstacles to prevent dark rectangles over neon border.' },
            { file:'server.js',     type:'fix',     text:'Max 6 players enforced in joinRoom.' },
            { file:'server.js',     type:'fix',     text:'Round reset HP: keeps card-upgraded bonus on top of (possibly changed) baseMaxHp.' },
        ]
    },
];

// ── DISPLAY HELPERS ──────────────────────────────────────────────────────────
// Used by server.js to print patch notes on startup
// and by network.js to send them to the lobby for display.

const TYPE_LABELS = {
    feature: '✨ Feature',
    fix:     '🐛 Fix',
    perf:    '⚡ Perf',
    balance: '⚖ Balance',
};

function formatPatchNotes(maxVersions = 3) {
    return PATCH_NOTES.slice(0, maxVersions).map(v => ({
        version: v.version,
        date:    v.date,
        summary: v.changes.map(c => `${TYPE_LABELS[c.type]||c.type} [${c.file}] ${c.text}`),
    }));
}

function latestVersion() { return PATCH_NOTES[0]?.version || 'v1'; }

// Node (server) export
if (typeof module !== 'undefined') module.exports = { PATCH_NOTES, formatPatchNotes, latestVersion };

// Browser (ES module) export — only runs if this file is loaded as a module
// (app.js imports it for lobby display)
export { PATCH_NOTES, formatPatchNotes, latestVersion };
