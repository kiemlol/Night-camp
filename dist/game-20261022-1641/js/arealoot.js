/* arealoot.js — gear for the hunting areas' new monsters and for the root-possessed bosses (the user, 2026-10-15, picked
   "D+C" from the drop plan: nothing moves from the old monsters' tables; every item still has one source).
     D  each new species drops its OWN new weapon (js/wcatalog_area.js: items carrying srcSpecies), at its kind's rate like
        every species row (A 0.25 · B 0.12 · C 0.06 · D 0.03 % a kill); its rare hue form (eliteOf) drops the same row at
        x2 (the same monster in a rare colour, like its material at x1.5)
     C  the root-possessed bosses' robes, hats and weapons become real gear pieces: copies with a grade by level, option
        rows, refine, colour grades (js/gearbag.js bossGear / kind D), and they show in the collection book
     +  LOOT_DATA.top for the new species (the highest level of the sections they live in): the loot gate, the daily hunts
        (js/quests.js) and the monster arts' level (js/bl_arts.js) were blind to them
   Load after js/rootboss.js (and js/wcatalog_area.js, js/book.js). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, D = NC.LOOT_DATA, A = NC.AREA_DATA;
  if (!D || !A) return;
  const RATE = { A: 0.25, B: 0.12, C: 0.06, D: 0.03, L: 0.03 };
  const gradeOfLv = (lv) => Math.min(4, 1 + Math.floor(((lv || 1) - 1) / 25));

  // ---------------- the new species' top levels ----------------
  const top = {};
  for (const s of A.sections || []) {
    const hi = Array.isArray(s.lv) ? s.lv[1] : s.lv;
    for (const m of s.monsters || []) { const id = Array.isArray(m) ? m[0] : m; if (hi) top[id] = Math.max(top[id] || 0, hi); }
    if (s.rare && hi) top[s.rare] = Math.max(top[s.rare] || 0, hi);
  }
  for (const [id, lv] of Object.entries(top)) if (NC.SPECIES[id] && !D.top[id]) D.top[id] = lv;
  for (const [id, sp] of Object.entries(NC.SPECIES)) if (sp.eliteOf && !D.top[id] && D.top[sp.eliteOf]) D.top[id] = D.top[sp.eliteOf];

  // ---------------- D: each new species' own weapon ----------------
  let rows = 0;
  for (const [id, it] of Object.entries(ITEMS)) {
    const s = it.srcSpecies;
    if (!s || !NC.SPECIES[s]) continue;
    const kind = (it.gs || it.sw || it.wc || {}).kind || 'A', pct = RATE[kind] || 0.12;
    const add = (sp, p) => { const T = (D.species[sp] = D.species[sp] || []); if (!T.some(([x]) => x === id)) { T.push([id, p]); rows++; } };
    add(s, pct);
    for (const [eid, E] of Object.entries(NC.SPECIES)) if (E.eliteOf === s) add(eid, pct * 2);
  }

  // ---------------- C: the root-possessed bosses' pieces as real gear ----------------
  const RB = NC.RootBoss && NC.RootBoss.B;
  let pieces = 0;
  if (RB) for (const [id, B] of Object.entries(RB)) {
    const g = gradeOfLv(B.lv);
    for (const k of ['robe', 'hat']) {
      const it = ITEMS[B.equip[k]];
      if (!it) continue;
      it.bossGear = true; it.inst = true; pieces++;
    }
    const W = ITEMS[B.equip.weapon];
    if (W) {
      // (its own copy of the catalog info it was made from - the base weapon's object is shared - as a boss piece)
      const key = W.gs ? 'gs' : W.sw ? 'sw' : 'wc';
      W[key] = Object.assign({}, W[key] || { type: W.wtype }, { grade: g, kind: 'D' });
      W.inst = true; pieces++;
    }
  }
  // their power: a little above the ordinary gear of the same level, not endgame (the user, 2026-10-15: "ให้มันแรงขึ้นแต่ก็
  // ไม่มากก็พอ ไม่ต้องเป็น endgame"). They were built from whichever catalog piece sat nearest under the boss's level, so some
  // came out far below the ordinary drops (Victor's sword 77 vs 173) and every robe under a top + pants pair.
  //   weapon  the best ordinary catalog weapon of its type at or under its level (kinds A-C) x 1.08, its own spread kept
  //   robe    DEF = the best catalog top + pants at or under its level x 1.05 (its MDEF, main stat and crit / cdr stay)
  //   hat     DEF at least the best non-fashion catalog hat at or under its level x 1.05
  const BOOST = { weapon: 1.08, robe: 1.05, hat: 1.05 };
  const avg = (d) => (d[0] + d[1]) / 2;
  const rootIds = new Set();
  if (RB) for (const B of Object.values(RB)) for (const k of ['robe', 'hat', 'weapon']) if (B.equip[k]) rootIds.add(B.equip[k]);
  const ordinary = (id, it) => !rootIds.has(id) && !it.srcSpecies && !it.bossGear && it.rarity !== 'fashion';
  const tuned = [];
  const above = (ref, k) => Math.max(ref + 1, Math.ceil(ref * k)); // (small DEF numbers: x 1.05 alone would round back to the same)
  function tune() {
    if (!RB || tuned.length) return;
    // (one pass over every item into short lists, then each boss looks its level up in them: the same answers as before,
    // when each boss went over all the items four times, 60-170 ms of every start; a CPU profile 2026-10-19)
    const wBy = {}, tops = [], pants = [], hats = [];
    for (const [id, it] of Object.entries(ITEMS)) {
      if (!ordinary(id, it)) continue;
      const lv = it.lvReq || 1, c = it.gs || it.sw || it.wc;
      if (it.slot === 'weapon' && Array.isArray(it.dmg) && c && !/[DL]/.test(c.kind || '')) (wBy[it.wtype] || (wBy[it.wtype] = [])).push([lv, avg(it.dmg)]);
      if (!it.stats) continue;
      const def = it.stats.def || 0;
      if (it.of && it.slot === 'top') tops.push([lv, def]);
      if (it.of && it.slot === 'pants') pants.push([lv, def]);
      if (it.slot === 'hat' && it.hc && it.hc !== 'fash') hats.push([lv, def]);
    }
    const bestAt = (list, L) => { let b = 0; if (list) for (const [lv, v] of list) if (lv <= L && v > b) b = v; return b; };
    for (const B of Object.values(RB)) {
      const L = B.lv, W = ITEMS[B.equip.weapon], R = ITEMS[B.equip.robe], H = B.equip.hat && ITEMS[B.equip.hat];
      const rw = W && Array.isArray(W.dmg) && bestAt(wBy[W.wtype], L);
      if (rw) { const k = (rw * BOOST.weapon) / avg(W.dmg); W.dmg = W.dmg.map((v) => Math.max(1, Math.round(v * k))); }
      const pair = bestAt(tops, L) + bestAt(pants, L);
      if (R && R.stats && pair) R.stats = Object.assign({}, R.stats, { def: above(pair, BOOST.robe) });
      const rh = H && bestAt(hats, L);
      if (H && H.stats && rh) H.stats = Object.assign({}, H.stats, { def: Math.max(H.stats.def || 0, above(rh, BOOST.hat)) });
      tuned.push([B.equip.weapon, rw]);
    }
  }
  // (measured once every file has run: js/rebalance.js and others change the ordinary gear's numbers after this file loads)
  const baseLoad = NC.loadAssets;
  if (baseLoad) NC.loadAssets = function () { tune(); return baseLoad.apply(this, arguments); };
  else tune();
  if (NC.Book && NC.Book.fill) NC.Book.fill();
  NC.AreaLoot = { rows, pieces, top, tuned };
})();
