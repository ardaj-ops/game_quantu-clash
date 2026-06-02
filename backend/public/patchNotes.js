// ============================================================
//  QUANTUM CLASH — PATCH NOTES
//  Every code change is logged here with version, date, file,
//  and a plain-language description of what changed and why.
//  Add a new entry at the TOP for every future change.
//
//  IMPORTANT: This file uses CommonJS exports (module.exports)
//  so server.js can require() it. app.js reads it via the
//  window.PATCH_NOTES global injected by a <script> tag,
//  NOT via ES module import (which would break Node).
// ============================================================

const PATCH_NOTES = [
    {
        version: 'v18',
        date:    '2026-05-18',
        changes: [
            { file:'server.js',     type:'fix',     text:'TDM: Team win condition now works — round ends when all players on one team are dead. Teams assigned blue/red on join, score tracked per-team.' },
            { file:'server.js',     type:'fix',     text:'BOSS mode: bulletHitPlayer now detects boss death and challenger wipe-out, correctly ends the round in both cases.' },
            { file:'server.js',     type:'fix',     text:'BOSS round score: boss earns 1 point for surviving, each challenger earns 1 point for killing the boss.' },
            { file:'patchNotes.js', type:'fix',     text:'CRITICAL: patchNotes.js mixed CommonJS module.exports with ES module export{} — caused syntax error in Node, server silently crashed and sent no patch notes. Fixed to CommonJS only; browser reads via window.PATCH_NOTES global.' },
            { file:'gameHelper.js', type:'fix',     text:'Spawn: fully random positions checked against all obstacles. Fixed spawn points removed — every round players spawn in a fresh random valid location.' },
            { file:'gameHelper.js', type:'fix',     text:'Spawn safety: minimum 150px gap from all other spawned players, 40px clearance from obstacles, 80px from arena border.' },
            { file:'physics.js',    type:'fix',     text:'Arena border bounce: only bounces if bullet has bouncesLeft >= 1. Without bounce upgrades, bullets that hit the border are destroyed (correct behavior).' },
            { file:'render.js',     type:'feature', text:'Tab menu: three separate slots — Alive players (with HP bars), Dead players (greyed out), and Cards (all cards picked across the whole game with hover tooltips).' },
            { file:'index.html',    type:'feature', text:'Patch notes moved to main menu — shown as a collapsible panel below the join form. No longer requires entering a room to see changes.' },
            { file:'app.js',        type:'fix',     text:'Patch notes loaded from embedded window.PATCH_NOTES on page load (no socket request needed). Displayed in main menu immediately.' },
        ]
    },
    {
        version: 'v17',
        date:    '2026-05-18',
        changes: [
            { file:'patchNotes.js', type:'feature', text:'Central patch notes file created. Every code change logged with version, date, file, type (feature/fix/perf/balance), and description.' },
            { file:'server.js',     type:'feature', text:'Patch notes printed on server startup. requestPatchNotes socket event added.' },
            { file:'app.js',        type:'feature', text:'Patch notes fetched from server and displayed in lobby as collapsible panel.' },
            { file:'index.html',    type:'feature', text:'Patch notes panel added to lobby.' },
        ]
    },
    {
        version: 'v16',
        date:    '2026-05-18',
        changes: [
            { file:'render.js',     type:'feature', text:'Domain map-wide visual effects: Gravity Collapse = spinning black hole with spiral arms, Infinite Arsenal = 6 orbiting rotating guns with muzzle flashes + raining shell casings, Madness Veil = purple ripple bands, Blood Altar = red heartbeat scan lines, Mirror Singularity = rainbow prism edges, Quantum Prison = sinusoidal blue grid distortion, Gambler = hue-cycling arena with floating card suits.' },
            { file:'render.js',     type:'feature', text:'Tab menu mouse unlock button — frees cursor to hover card chips for tooltips.' },
            { file:'render.js',     type:'feature', text:'Full stat bars for all 12 stats in tab menu right panel.' },
            { file:'render.js',     type:'perf',    text:'Grid cached on offscreen canvas, redrawn only on resize.' },
            { file:'gameHelper.js', type:'feature', text:'Card rarity: exact percentages (common 40%, uncommon 25%, rare 18%, epic 10%, legendary 4.5%, mythic 1.5%, exotic 0.8%, transcended 0.2%).' },
        ]
    },
    {
        version: 'v15',
        date:    '2026-05-17',
        changes: [
            { file:'app.js',     type:'fix', text:'CRITICAL: roomInfo/settingsChanged moved to page-load from game-start — settings panel now appears correctly for room creator.' },
            { file:'physics.js', type:'fix', text:'Arena border bounces for free. Diagonal movement normalised (0.7071).' },
            { file:'server.js',  type:'fix', text:'GAMEOVER triggered when score reaches maxRounds. BOSS mode in changeSettings.' },
        ]
    },
    {
        version: 'v14',
        date:    '2026-05-16',
        changes: [
            { file:'render.js',  type:'feature', text:'Three-panel tab menu: scores, stat bars, card history with hover tooltips.' },
            { file:'server.js',  type:'fix',     text:'GAMEOVER check in startNewRound. Solo-play card skip.' },
        ]
    },
    {
        version: 'v13',
        date:    '2026-05-15',
        changes: [
            { file:'server.js',  type:'feature', text:'Boss mode added: creator picks 3 cards before round. Boss gets 3x HP.' },
            { file:'render.js',  type:'feature', text:'Boss crown 👑 above boss nametag.' },
        ]
    },
    {
        version: 'v12',
        date:    '2026-05-14',
        changes: [
            { file:'domainManager.js', type:'feature', text:'6 domain clashes: Frozen Bleed, Imploding Madness, Mirror Arsenal, Singularity, Bloody Jackpot, Wild Cards.' },
            { file:'cards.js',         type:'balance', text:'All 7 domain cards rebalanced.' },
        ]
    },
    {
        version: 'v9',
        date:    '2026-05-11',
        changes: [
            { file:'gameHelper.js', type:'fix', text:'INNER_MARGIN 520→80: zero obstacles were spawning. Obstacle count guaranteed.' },
            { file:'server.js',     type:'fix', text:'cloneOnDash, invisOnDash, max 6 players implemented.' },
            { file:'render.js',     type:'fix', text:'isInvisible, clone, arena border neon wall all fixed.' },
        ]
    },
];

const TYPE_LABELS = {
    feature: '✨ Feature',
    fix:     '🐛 Fix',
    perf:    '⚡ Perf',
    balance: '⚖ Balance',
};

function formatPatchNotes(maxVersions) {
    const count = maxVersions || PATCH_NOTES.length;
    return PATCH_NOTES.slice(0, count).map(v => ({
        version: v.version,
        date:    v.date,
        summary: v.changes.map(c => `${TYPE_LABELS[c.type]||c.type} [${c.file}] ${c.text}`),
    }));
}

function latestVersion() { return PATCH_NOTES[0]?.version || 'v1'; }

// CommonJS export (for server.js require())
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PATCH_NOTES, formatPatchNotes, latestVersion };
}

// Browser global (for index.html <script> tag injection into app.js)
if (typeof window !== 'undefined') {
    window.PATCH_NOTES      = PATCH_NOTES;
    window.formatPatchNotes = formatPatchNotes;
    window.latestVersion    = latestVersion;
}
