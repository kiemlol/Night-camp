/* balance_1016.js — the balance round of 2026-10-16, after the B1–B3 sections (128 field maps). Measured with a headless
   map census (every field map, the same knight build at the map's mid level, 300 game seconds a run, repeats where noisy;
   raw data and scripts in the session scratchpad bal2/); the user picked sets A, B, C, D, E, F, G, H:
     A  root spawns     12 of the 32 old root maps gave 0.58–0.81x the EXP of their own B sections: 88–128 monsters on
                        15–22 Mpx² (4.4–6.7 a Mpx²) against 7.35 in every section. The 13 below get section density:
                        graveyard 100→127, wind 120→143, burnt 112→132, swamp 120→145, marsh 120→145, isle 96→110,
                        prime 128→165, farm 120→132, woods 113→153, peak 120→153, cathedral 128→156, volcano 120→145,
                        dark 120→159 (NC.MAPS[id].spawns scaled; fieldgen.js places them)
     B  fast sections   (1) the new species of the Lv 80+ sections had HP x1.1 (median) against x1.4 for the old species of
                        those levels at the same EXP, so they were the best maps from Lv 80: hpK +0.3, at most 1.45
                        (29 species; not the two sections that were already slower than their band: rooftops, amberwood);
                        (2) nightmarket (outer B1, 1.32x): pickpocket_cat, lamp_vendor hpK +0.25; (3) splitters gave
                        1.3–1.5x (the pieces come at the hero): sack_mimic, snowball_yeti, needle_urchin, geode_hopper
                        expK x0.75. Their rare hue forms follow (same ratio)
     C  cornmaze        the maze walls cost walking (0.65x): spawns 120→150
     D  the curve       NC.xpNext / NC.jobNext x KPM_NEW(lv) / KPM_OLD(lv) (rebalance.js's table of the bot's real kills
                        a minute, re-measured on the best map of each level after A–C, E–H): the best-of-128-maps road to
                        Lv 99 back at ~300 bot hours (it was ~226 h after the other sets); then x0.85 (CURVE_K, the user's
                        middle: best map ~256 h, a median map ~355 h). See KPM_NEW below
     E  economy         honeycomb 70→28 coins (Lv 8–19 slime, 2.5x the price curve); NC.matQty also scales DOWN for a
                        species below the level its junk is priced for (balance_round.js NC.MAT_NATIVE): x (lv/native)^1.374,
                        at least 0.6 (shadow_quill 210 at Lv 63–68 paid 1.6x); the wolf's fur (60 coins, native Lv 30) may
                        scale up to x4 instead of x2.5 (Lv 77–82 wolves in prime paid 0.69x)
     F  content         the boar spawns nowhere since the camp lost its monsters: its 10 weapons move to boar_silver (the
                        same boar line, its silver-horned form, Lv 16–21 in meadow2 / battlefield / thornrose; kind A rate
                        0.25% kept); loot-gate tops (NC.LOOT_DATA.top) lowered to where the species really spawn so 18 rows
                        can drop: zombie 39→38, soldier_ant 50→49, candle_wisp 48→47, cliff_goat 54→53, bomb_ant 44→42;
                        the pilot sections' species get top 18 (the daily board saw none of them). (js/bots.js: the other
                        adventurers on maps it doesn't list take the map's own "Lv a–b" — a small hook in that file)
     G  Blazing Ring Burst  its fire blade (on every sword-line hotbar at Lv 1: 8 s on a 9 s cooldown, so every hit was fire:
                        x0.25 on fire monsters, x0.5 water, x1.5 earth) lasts 4 s
     H  weapons         the 12 kind-D species weapons (aw_*) were 1.10–1.24x a kind-A weapon of their type and level
                        (catalog kind D: 0.86x) and beat the root bosses' 1.08x: now 1.05x the kind-A median of their
                        type at ±5 levels, and below 0.97x of any root boss weapon of their type within 12 levels;
                        aw_log_lurker 89→114, aw_rusty_squire 40→50 (both were 0.76–0.78x). (runtime only: the source rows
                        in assets/gen/wcat_area + js/wcatalog_area_data.js keep the old ATK)
   Load late: after rebalance.js, balance_round.js, arealoot.js, the field / section files and skills.js. Hooks: NC.MAPS,
   NC.SPECIES, NC.MATERIALS, NC.matQty, NC.LOOT_DATA, NC.updateSkills, NC.loadAssets, NC.xpNext, NC.jobNext.
   NC.Bal1016 lists what changed. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS;
  const log = (NC.Bal1016 = { spawns: {}, hp: {}, exp: {}, weapons: {}, tops: {}, moved: [] });

  // ---------------- A + C: monsters per map ----------------
  const SPAWNS = { graveyard: 127, wind: 143, burnt: 132, swamp: 145, marsh: 145, isle: 110, prime: 165, farm: 132, woods: 153, peak: 153,
    cathedral: 156, volcano: 145, dark: 159, cornmaze: 150 };
  const mult = NC.MOB_MULT || 1;
  for (const [id, want] of Object.entries(SPAWNS)) {
    const M = NC.MAPS && NC.MAPS[id];
    if (!M || !Array.isArray(M.spawns)) continue;
    const now = M.spawns.reduce((s, [, n]) => s + n * mult, 0);
    if (!(now > 0)) continue;
    const k = want / now;
    M.spawns = M.spawns.map(([t, n, ...rest]) => [t, n * k, ...rest]);
    log.spawns[id] = [Math.round(now), want];
  }

  // ---------------- B: species HP / EXP (their rare hue forms by the same ratio) ----------------
  const S = NC.SPECIES || {};
  function scale(id, key, f) {
    const B = S[id];
    if (!B || typeof f !== 'function') return;
    const old = B[key] || 1, now = f(old);
    if (Math.abs(now - old) < 1e-9) return;
    B[key] = now;
    (key === 'hpK' ? log.hp : log.exp)[id] = [old, +now.toFixed(3)];
    for (const E of Object.values(S)) if (E.eliteOf === id) E[key] = (E[key] || 1) * (now / old);
  }
  const A = NC.AREA_DATA, SKIP_SECTIONS = new Set(['rooftops', 'amberwood']);
  if (A) for (const s of A.sections || []) {
    if (!Array.isArray(s.lv) || (s.lv[0] + s.lv[1]) / 2 < 80 || SKIP_SECTIONS.has(s.id)) continue;
    for (const m of s.monsters || []) scale(Array.isArray(m) ? m[0] : m, 'hpK', (h) => Math.max(h, Math.min(h + 0.3, 1.45)));
  }
  for (const id of ['pickpocket_cat', 'lamp_vendor']) scale(id, 'hpK', (h) => h + 0.25);
  for (const id of ['sack_mimic', 'snowball_yeti', 'needle_urchin', 'geode_hopper']) scale(id, 'expK', (x) => x * 0.75);

  // ---------------- E: material prices, pieces by level ----------------
  const MAT = NC.MATERIALS || {};
  if (MAT.mat_honeycomb) { MAT.mat_honeycomb.price = 28; MAT.mat_honeycomb.base = 28; }
  const NATIVE = NC.MAT_NATIVE || {}, CURVE = 1.374, FLOOR = 0.6, OLD_CAP = 2.5, CAP = { wolf: 4 };
  const baseQty = NC.matQty;
  NC.matQty = function (e, n0) {
    const n = baseQty ? baseQty.apply(this, arguments) : n0, lv0 = e && NATIVE[e.type];
    if (!lv0 || !(e.lv > 0) || !(n > 0)) return n;
    let k = 1;
    if (e.lv < lv0) k = Math.max(FLOOR, Math.pow(e.lv / lv0, CURVE));
    else if (CAP[e.type]) { const raw = Math.pow(e.lv / lv0, CURVE); k = Math.min(CAP[e.type], raw) / Math.min(OLD_CAP, raw); }
    if (k === 1) return n;
    const x = n * k;
    return Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);
  };

  // ---------------- F: drop tables ----------------
  const D = NC.LOOT_DATA;
  if (D) {
    D.top = D.top || {};
    const TOPS = { zombie: 38, soldier_ant: 49, candle_wisp: 47, cliff_goat: 53, bomb_ant: 42,
      popcorn_pod: 18, straw_shooter: 18, straw_shooter_ember: 18, black_ewe: 18, black_ewe_frost: 18, stitch_doll: 18 };
    for (const [id, t] of Object.entries(TOPS)) if (S[id] || D.species[id]) { log.tops[id] = [D.top[id] || null, t]; D.top[id] = t; }
    // the boar's weapons: one source, the boar line's silver-horned form (its rows keep their kind-A rate)
    const from = D.species.boar || [], to = (D.species.boar_silver = D.species.boar_silver || []);
    if (S.boar_silver) {
      for (const [id, pct] of from) if (ITEMS[id] && !to.some(([x]) => x === id)) { to.push([id, pct]); log.moved.push(id); }
      D.species.boar = from.filter(([id]) => !log.moved.includes(id));
    }
  }

  // ---------------- G: Blazing Ring Burst's fire blade 8 s -> 4 s ----------------
  const FIRE_BLADE = 4;
  const baseSkills = NC.updateSkills;
  if (baseSkills) NC.updateSkills = function (game) {
    const p = game && game.player;
    if (p && p.buffs && p.buffs.fireblade > FIRE_BLADE) p.buffs.fireblade = FIRE_BLADE;
    return baseSkills.apply(this, arguments);
  };

  // ---------------- H: the species weapons (after arealoot.js tunes the root bosses' pieces at loadAssets) ----------------
  const info = (it) => it && (it.gs || it.sw || it.wc);
  const avg = (it) => (it.dmg[0] + it.dmg[1]) / 2;
  const typeOf = (it) => (NC.wtypeOf ? NC.wtypeOf(it) : null) || it.wtype;
  const RAISE = { aw_log_lurker: 114, aw_rusty_squire: 50 }, D_K = 1.05, BELOW_ROOT = 0.97;
  function weapons() {
    const RB = (NC.RootBoss && NC.RootBoss.B) || {}, rootW = new Set();
    for (const B of Object.values(RB)) if (B.equip && B.equip.weapon) rootW.add(B.equip.weapon);
    const W = Object.entries(ITEMS).filter(([, it]) => it.slot === 'weapon' && Array.isArray(it.dmg) && info(it));
    const ordinary = W.filter(([id, it]) => !it.srcSpecies && !rootW.has(id) && !it.bossGear && it.rarity !== 'fashion');
    const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
    function refA(t, L) {
      const A2 = ordinary.filter(([, it]) => typeOf(it) === t && info(it).kind === 'A').map(([, it]) => it);
      const near = A2.filter((it) => Math.abs((it.lvReq || 1) - L) <= 5);
      if (near.length) return median(near.map(avg));
      const lo = A2.filter((it) => (it.lvReq || 1) <= L).sort((a, b) => b.lvReq - a.lvReq)[0], hi = A2.filter((it) => (it.lvReq || 1) >= L).sort((a, b) => a.lvReq - b.lvReq)[0];
      if (lo && hi && hi.lvReq !== lo.lvReq) return avg(lo) + ((avg(hi) - avg(lo)) * (L - lo.lvReq)) / (hi.lvReq - lo.lvReq);
      return lo ? avg(lo) : hi ? avg(hi) : 0;
    }
    const set = (id, it, want) => {
      const k = want / avg(it);
      if (!(k > 0) || Math.abs(k - 1) < 0.005) return;
      log.weapons[id] = [avg(it), +want.toFixed(1)];
      it.dmg = it.dmg.map((v) => Math.max(1, Math.round(v * k)));
      if (info(it).atk) info(it).atk = Math.round(info(it).atk * k);
    };
    for (const [id, it] of W) {
      if (!it.srcSpecies || !/^aw_/.test(id) || rootW.has(id)) continue; // (the root bosses' own weapons carry a srcSpecies too)
      if (RAISE[id]) { set(id, it, RAISE[id]); continue; }
      if (info(it).kind !== 'D') continue;
      const t = typeOf(it), L = it.lvReq || 1, ref = refA(t, L);
      if (!ref) continue;
      let want = ref * D_K;
      for (const r of rootW) { const R = ITEMS[r]; if (R && Array.isArray(R.dmg) && typeOf(R) === t && Math.abs((R.lvReq || 1) - L) <= 12) want = Math.min(want, avg(R) * BELOW_ROOT); }
      set(id, it, want);
    }
  }
  const baseLoad = NC.loadAssets;
  if (baseLoad) NC.loadAssets = function () { const r = baseLoad.apply(this, arguments); try { weapons(); } catch (e) { console.warn('balance_1016 weapons:', e); } return r; };
  else weapons();

  // ---------------- D: the level curve (rebalance.js's KPM table -> the re-measured best-map speed) ----------------
  // kills a minute of same-level monsters the auto farm really makes on the best map of each level (knight, band gear,
  // after A–C and E–H; 2026-10-16). xpNext and jobNext x KPM_NEW / KPM_OLD
  const KPM_OLD = [[10, 40], [20, 60], [30, 60], [40, 52], [50, 48], [60, 50], [70, 40], [80, 29], [90, 24], [99, 18]];
  // (39 runs on the best map at Lv 3–98, 1-2-1 smoothed: the road on the best of the 128 maps comes to ~300 h, it was 228)
  const KPM_NEW = [[3, 96], [6, 76], [10, 68], [15, 71], [20, 71], [25, 67], [30, 62], [35, 66], [40, 67], [45, 59], [50, 54], [55, 53],
    [60, 51], [65, 45], [70, 38], [75, 36], [80, 39], [85, 42], [90, 44], [95, 40], [99, 30]];
  const at = (T, lv) => {
    if (lv <= T[0][0]) return T[0][1];
    for (let i = 1; i < T.length; i++) { const [l1, k1] = T[i], [l0, k0] = T[i - 1]; if (lv <= l1) return k0 + ((k1 - k0) * (lv - l0)) / (l1 - l0); }
    return T[T.length - 1][1];
  };
  // the user, 2026-10-16: "ปรับเส้น EXP ให้อยู่กลางๆ แมพดีสุดราว 260 ชม. แมพกลางๆราว 350 ชม." - the curve fitted to the best map
  // gave 301 h there and 418 h on a median map; the time to 99 scales straight with this factor: x0.85 -> ~256 h / ~355 h
  const CURVE_K = 0.85;
  if (KPM_NEW && NC.xpNext) {
    const f = (lv) => (at(KPM_NEW, lv) / at(KPM_OLD, lv)) * CURVE_K;
    const baseNext = NC.xpNext, baseJob = NC.jobNext;
    // (never less than the level before: the fitted speed rises again at Lv 95-99, which made Lv 96-99 need LESS EXP than 95)
    const raw = (lv) => Math.round(baseNext(lv) * f(lv)), memo = [];
    const next = (lv) => {
      lv = Math.max(1, lv | 0);
      if (memo[lv] === undefined) memo[lv] = lv > 1 ? Math.max(raw(lv), next(lv - 1)) : raw(lv);
      return memo[lv];
    };
    NC.xpNext = next;
    if (baseJob) NC.jobNext = function (j) { const p = NC.game && NC.game.player; return Math.round(baseJob.apply(this, arguments) * f((p && p.lv) || 1)); };
    log.kpm = KPM_NEW;
  }
})();
