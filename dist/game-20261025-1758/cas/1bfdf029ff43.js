/* rebalance.js — the whole-game balance pass of 2026-10-02 (tools/gamesim and its report "จำลองบาลานซ์ Night Camp"; the
   user picked every fix and a road of ~300 bot hours to Lv 99).
     class gear    the outfits a job change puts on (items.js NC.CLASSES, class3.js NC.CLASS3) get the numbers of the
                   drop sets of their line at the grade they come at: 1st jobs G1, 2nd jobs G2, class 3 G3 (they were as
                   strong as G3–G4 drops, the 1st-job mage's +40% skill power and −20% cooldowns above all). Each job keeps
                   its old damage through JOB_POWER (measured with tools/balance.js), so drops now add on top
     fashion       no stats at all: the costume layer is looks only (it goes to the gacha)
     magic hits    caster monsters (MAGIC) and the bosses' spells (every move but slam / charge / swoop / chase) hit
                   through MDEF: % off = MDEF + half the DEF, the soft part = INT's MDEF + half of VIT's; FLEE can't dodge
                   them (a lucky dodge still can). Before, nothing ever read the hero's MDEF
     class 3       each class-3 job's damage x C3_POWER, so it gains about x1.45 over its 2nd job at the same level and
                   skills (measured x1.21–x1.78)
     drops         the level gate uses where a species really lives (LOOT_REACH, from the map census: 73 items could
                   never drop); the 20 glasses get monsters of their own; the six story bosses drop the old boss outfit
                   they wear (4% a piece, the piece asks the boss's level); boss crowns ask their boss's level
     the curve     kills to a level x KPM(level) / 5: the Game Bible counted 5 kills a minute, the auto farm really
                   kills 40–60 early and 18–30 late (same-level EXP), so Lv 99 took ~50 bot hours, not ~300. Job levels
                   the same way, by the hero's base level
   Also in their own files: refine coins x6 / x6 / x4 / x3 by grade (refine.js), drilling an option row 3,000,000 and
   an option stone 15,000 coins (forge.js). Hooks (outermost, so load late): NC.derive, NC.heroHit, NC.monsterHit,
   NC.xpNext, NC.jobNext. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS;

  // ---------------- class gear: the drop sets' numbers ----------------
  const LINE = { knight: 'hv', paladin: 'hv', dragonknight: 'hv', berserker: 'hv',
    mage: 'mg', priest: 'mg', archmage: 'mg', warlock: 'mg', firemage: 'mg', icemage: 'mg', bishop: 'mg', wisp: 'mg', lightkeeper: 'mg',
    archer: 'rg', ranger: 'rg', wolfhunter: 'rg', gunslinger: 'rg', bard: 'rg', puppeteer: 'rg',
    rogue: 'lt', assassin: 'lt', shinobi: 'lt', monk: 'lt', reaper: 'lt', swordmaster: 'lt',
    samurai: 'hv', bloodsamurai: 'hv', windsamurai: 'lt' }; // (the Samurai line: admin only, samurai.js)
  const MAIN = { hv: 'str', mg: 'int', rg: 'dex', lt: 'agi' };
  const HAT = { 1: [1, 2], 2: [2, 3], 3: [4, 4] }; // [def, main stat] by grade
  function setStats() {
    const S = NC.OUTFITS && NC.OUTFITS.sets, by = {};
    if (!S) return by;
    for (const id in S) { const s = S[id], k = s.line + s.grade; if (!by[k]) { by[k] = {}; for (const sl in s.items) by[k][sl] = ITEMS[s.items[sl]].stats; } }
    return by;
  }
  (function classGear() {
    const by = setStats(), want = {}; // item -> [line, grade] (a piece two jobs share takes the lower grade)
    const put = (id, line, g) => { if (id && ITEMS[id] && (!want[id] || want[id][1] > g)) want[id] = [line, g]; };
    const lineOf = (job) => LINE[job] || (NC.C3 && NC.C3.jobs[job] && LINE[NC.C3.jobs[job].from]) || null;
    for (const C of NC.CLASSES || []) {
      if (C.boss || C.fashion) continue;
      const jid = Object.keys(NC.JOBS).find((j) => NC.JOBS[j].cls === C.id), J = jid && NC.JOBS[jid];
      if (!J || !J.tier || !lineOf(jid)) continue;
      for (const sl of ['top', 'pants', 'shoes', 'hat', 'shield']) put(C.items[sl], lineOf(jid), Math.min(3, J.tier));
    }
    for (const s of (NC.CLASS3 && NC.CLASS3.sets) || []) {
      const jid = s.id.replace(/^c3_/, '');
      if (!lineOf(jid)) continue;
      for (const sl of ['top', 'pants', 'shoes', 'hat', 'shield']) put(s.items[sl], lineOf(jid), 3);
    }
    for (const id in want) {
      const it = ITEMS[id], [line, g] = want[id];
      if (it.slot === 'hat') { const [def, m] = HAT[g]; it.stats = { def, [MAIN[line]]: m }; }
      else if (it.slot === 'shield') it.stats = { def: 6 * g, mdef: g, vit: g > 1 ? g - 1 : 0 };
      else if (by[line + g] && by[line + g][it.slot]) it.stats = Object.assign({}, by[line + g][it.slot]);
    }
    NC.CLASS_GEAR_FIX = want;
  })();

  // ---------------- fashion: looks only ----------------
  for (const id in ITEMS) if (ITEMS[id].rarity === 'fashion' && ITEMS[id].stats) ITEMS[id].stats = {};

  // ---------------- each job's damage (the class gear's old share, class 3's gain) ----------------
  // JOB_POWER: tools/balance.js single-target DPS of the job's builds with the old class gear / with the new (median)
  // (only jobs that lost more than the harness's ±6% noise: the mage set's +40% skill power / −20% cooldowns, the archer's
  // and rogue's critical rate and speed; every other job's class set was DEF and stats only)
  // ranger 0.9 and moonsniper 0.65 (was 1 and 0.82; the owner, 2026-10-07, the endgame balance audit): at Lv 99 in full
  // gear the bow out-farmed every melee build 2–3x (bell6: moonsniper 1,672 kills an hour, berserker 886; lavavent2:
  // ranger 3,514), its range and arrow rain clearing packs with no walk. With these (and the samurai's new katanas) the
  // server's own sim over 13 Lv 85+ maps puts the ranger at ~1.17x and the moonsniper at ~1.31x the best melee build of
  // the map (geometric mean; it was 1.58x and 1.85x), still the fastest, deaths unchanged (the moonsniper's combined
  // power is JOB_POWER.ranger x C3_POWER.moonsniper = 0.585)
  // windsamurai 0.8 (was 0.9; the owner, 2026-10-08): with the G4 katana it farmed ~1.2x the bloodmoon and level with the
  // ranger (the server's sim, Lv 99 full gear, six Lv 94+ maps); at 0.8 it is ~1.14x the bloodmoon and ~0.92x the ranger.
  // Its pace is its dashes and warps more than its damage (0.9 -> 0.75 is only ~6% fewer kills), so bosses feel this more.
  const JOB_POWER = (NC.JOB_POWER = { mage: 1.35, archer: 1.12, rogue: 1.15, ranger: 0.9,
    bloodsamurai: 0.75, windsamurai: 0.8 }); // (the Samurai line, admin only: tools/balance.js builds vs the 3,000 target, 2026-10-03)
  // C3_POWER: x1.45 / the job's measured gain at the same level and skills (tools/gamesim C3EQ, single and pack)
  const C3_POWER = (NC.C3_POWER = { moonsniper: 0.65, shadowlord: 0.82, maestro: 0.82, outlaw: 0.88, packalpha: 0.94,
    eclipse: 1.12, starsaint: 1.16, meteorfist: 1.09, starblade: 1.09, harvester: 1.19, showmaster: 1.2, beacon: 1.17,
    starshepherd: 1.08, bloodmoon: 1.2, hexlord: 1.06, dawnwarden: 1.04 });
  const powerOf = (job) => {
    const C = NC.C3 && NC.C3.jobs[job];
    return C ? (JOB_POWER[C.from] || 1) * (C3_POWER[job] || 1) : JOB_POWER[job] || 1;
  };
  NC.jobPower = powerOf;
  const baseDerive = NC.derive;
  NC.derive = function (p) {
    const d = baseDerive.apply(this, arguments);
    if (d && p && p.kind === 'player') d.powK = powerOf(p.job);
    return d;
  };
  const baseHeroHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHeroHit.apply(this, arguments);
    if (r && r.dmg > 0 && d && d.powK && d.powK !== 1) r.dmg = Math.max(1, Math.round(r.dmg * d.powK));
    return r;
  };

  // ---------------- magic hits ----------------
  const MAGIC = (NC.MAGIC_MONSTERS = new Set(['ghost', 'ghost_violet', 'ash_wisp', 'candle_wisp', 'mist_wraith', 'storm_spirit', 'gust_sprite',
    'mist_sprite', 'blade_sprite', 'mist_citizen', 'first_lamplighter', 'lamplighter_gold', 'hollow_lamplighter', 'flying_book', 'book_gold',
    'candle_witch', 'bone_shaman', 'walking_scope', 'poison_spore', 'lava_imp', 'fire_imp', 'imp_blue', 'star_crystal', 'cardinal_puppet',
    'hollow_stargazer', 'eagle_bolt']));
  const MELEE_MOVES = new Set(['slam', 'charge', 'swoop', 'chase']);
  const isMagic = (m) => !!m && (MAGIC.has(m.type) || (!!NC.BOSSES && !!NC.BOSSES[m.type] && !!m.state && !MELEE_MOVES.has(m.state)));
  NC.isMagicHit = isMagic;
  const baseMonsterHit = NC.monsterHit;
  NC.monsterHit = function (m, d) {
    if (!d || !isMagic(m)) return baseMonsterHit.apply(this, arguments);
    const md = Object.assign({}, d, { def: Math.min(90, (d.mdef || 0) + (d.def || 0) / 2), vdef: (d.imdef || 0) + (d.vdef || 0) / 2, flee: -1000 });
    const r = baseMonsterHit.call(this, m, md);
    if (r) r.magic = true;
    return r;
  };

  // ---------------- drops ----------------
  const D = NC.LOOT_DATA;
  if (D) {
    // where each species really lives (the map census of 2026-10-02; mushlings: the mushroom king's helpers, Lv 32–38)
    const LOOT_REACH = { ash_wisp: 42, bat: 79, bee: 44, blade_sprite: 51, boar: 9, bomb_ant: 44, bone_archer: 35, bone_pile: 48, bone_shaman: 50,
      cabinet_guard: 87, candle_wisp: 48, cave_spider: 19, char_stump: 44, city_hound: 80, coffin_bomb: 37, crow: 38, crystal_bat: 70,
      crystal_mole: 71, dig_ant: 33, doctor_shroom: 43, dragonfly: 23, echo_bat: 12, elder_treant: 91, field_mouse: 17, fire_bat: 87,
      firefly_healer: 21, flying_ant: 47, flying_book: 84, frog: 19, ghost_miner: 69, ghost_violet: 37, giant_crow: 42, glow_spider: 44,
      grave_crow: 35, gust_sprite: 46, hatchling: 96, haunted_cart: 71, hollow_horse: 41, hound: 47, imp_blue: 88, ink_drop: 85, kappa: 84,
      lava_worm: 89, leap_trout: 25, magma_blob: 87, magma_golem: 89, mist_sprite: 33, mosquito: 62, mother_bat: 15, mud_eel: 32, mushling: 38,
      nurse_ant: 49, owlet_lead: 55, paper_blade: 87, plesio: 97, poison_ladybug: 71, poison_spore: 71, poison_toad: 59, potato_walker: 17,
      pterosaur: 95, pumpkin: 9, raptor: 89, rhino_beetle: 89, scorpion: 82, scorpion_copper: 79, seed_flower: 21, shadow_crow: 93,
      shroom_beetle: 45, skeleton: 75, slime_blue: 18, slime_glow: 90, slime_green: 5, slime_honey: 15, slime_lava: 78, slime_stone: 31,
      spit_frog: 24, spit_scorpion: 77, split_slug: 67, spring_bomb: 92, stone_vulture: 77, storm_eagle: 49, storm_sparrow: 52,
      storm_spirit: 57, stump: 38, swamp_croc: 65, tiny_dino: 97, tomb_knight: 51, tombstone: 31, turtle_jade: 27, walking_scope: 57, wolf: 82,
      wooden_hand: 92, worker_ant: 44, zombie: 39, zombie_mold: 37 };
    D.top = D.top || {};
    LOOT_REACH.carrot = 10; // (2026-10-18: pumpkins (Lv 9 at most, the slime slot) and carrots live only on the Lv 1–10 farm + its B1–B3)
    for (const t in LOOT_REACH) D.top[t] = Math.min(D.top[t] || 99, LOOT_REACH[t]);
    // the glasses: a monster each (commons .15%, rares .08%, epics .06%, the legend .03%)
    const GLASSES = [['glasses_square', 'field_mouse', 0.15], ['glasses_tape', 'carrot', 0.15], ['glasses_wood', 'potato_walker', 0.15],
      ['glasses_swim', 'otter', 0.15], ['glasses_sun', 'sunflower_bee', 0.08], ['glasses_moon', 'firefly_healer', 0.08], ['glasses_moth', 'sleep_moth', 0.08],
      ['glasses_aviator', 'kingfisher', 0.08], ['glasses_browline', 'bone_archer', 0.08], ['glasses_bat', 'bat_crimson', 0.08],
      ['glasses_hex', 'dragonfly_lead', 0.08], ['glasses_patch', 'caravan_bandit', 0.08], ['glasses_loupe', 'walking_scope', 0.08],
      ['glasses_monocle', 'hollow_stargazer', 0.06], ['glasses_goggles', 'dig_ant', 0.06], ['glasses_flame', 'ash_wisp', 0.06],
      ['glasses_ski', 'ice_goat', 0.06], ['glasses_ice', 'wolf_frost', 0.06], ['glasses_mirror', 'golem_crystal', 0.06], ['glasses_visor', 'light_filler', 0.03]];
    for (const [id, sp, pct] of GLASSES) {
      if (!ITEMS[id]) continue;
      const rows = (D.species[sp] = D.species[sp] || []);
      if (!rows.some((r) => r[0] === id)) rows.push([id, pct]);
    }
    // the samurai line's katana and nodachi tiers (js/samurai.js TIERS; the owner, 2026-10-07, the endgame balance audit:
    // nothing a samurai holds ever dropped): each from a species living at its level, at the catalog's rates by kind
    // (A .25 · B .12 · C .06 · D .03%, js/loot.js), the level gate as every row's. Added here, after js/book.js, like the
    // glasses: the book and each species' completion stay as they were
    const SAM_DROPS = { ka_iron: 'scarecrow', ka_sakura: 'seed_flower', ka_steel: 'zombie', ka_mist: 'ghost', ka_moonsteel: 'snow_wolf',
      ka_ember: 'slime_lava', ka_starsteel: 'hollow_guard', ka_thunder: 'shadow_heron', ka_shogun: 'faceless_puppet',
      nd_iron: 'boar', nd_cedar: 'hedgehog', nd_steel: 'grave_crow', nd_frost: 'tomb_knight', nd_oni: 'stone_owl',
      nd_venom: 'snake_triple', nd_dragonsteel: 'salamander', nd_eclipse: 'mist_citizen', nd_ashura: 'fire_imp' };
    const SAM_PCT = { A: 0.25, B: 0.12, C: 0.06, D: 0.03 };
    for (const id in SAM_DROPS) {
      const it = ITEMS[id];
      if (!it || !it.wc || !NC.MONSTERS[SAM_DROPS[id]]) continue; // (the samurai line is loaded for admins only: js/samurai.js)
      const rows = (D.species[SAM_DROPS[id]] = D.species[SAM_DROPS[id]] || []);
      if (!rows.some((r) => r[0] === id)) rows.push([id, SAM_PCT[it.wc.kind]]);
    }
    // the old boss outfits: the story boss who wears one drops it, at its level
    const OUTFIT = { sb_ivy: ['occult_priest', 20], sb_morrow: ['plague_shaman', 38], sb_raven: ['shadow_knight', 40], sb_ignis: ['infernal_warlock', 50],
      sb_gareth: ['fallen_paladin', 68], sb_gorm: ['horned_king', 82] };
    for (const b in OUTFIT) {
      const [set, lv] = OUTFIT[b], rows = (D.bosses[b] = D.bosses[b] || []);
      for (const id of ['robe_' + set, 'cape_' + set, 'hat_' + set]) {
        if (!ITEMS[id]) continue;
        ITEMS[id].lvReq = Math.max(ITEMS[id].lvReq || 0, lv);
        if (!rows.some((r) => r[0] === id)) rows.push([id, 4]);
      }
    }
  }
  const CROWN = { bat_king: 22, mushking: 50, ant_queen: 50, crypt_lord: 55, lava_dragon: 92 };
  for (const b in CROWN) { const it = ITEMS['acc_crown_' + b]; if (it) it.lvReq = CROWN[b]; }

  // ---------------- the curve: the bot's real speed ----------------
  // same-level kills a minute of the auto farm (median damage build, gear of its level, tools/gamesim 2026-10-02)
  const KPM = [[10, 40], [20, 60], [30, 60], [40, 52], [50, 48], [60, 50], [70, 40], [80, 29], [90, 24], [99, 18]];
  const kpmAt = (lv) => {
    if (lv <= KPM[0][0]) return KPM[0][1];
    for (let i = 1; i < KPM.length; i++) { const [l1, k1] = KPM[i], [l0, k0] = KPM[i - 1]; if (lv <= l1) return k0 + ((k1 - k0) * (lv - l0)) / (l1 - l0); }
    return KPM[KPM.length - 1][1];
  };
  const slow = (NC.levelSlow = (lv) => kpmAt(lv) / 5); // (x the Game Bible's 5 kills a minute)
  const baseNext = NC.xpNext, baseJob = NC.jobNext;
  NC.xpNext = (lv) => Math.round(baseNext(lv) * slow(lv));
  NC.jobNext = function (j) {
    const p = NC.game && NC.game.player;
    return Math.round(baseJob.apply(this, arguments) * slow((p && p.lv) || 1));
  };
})();
