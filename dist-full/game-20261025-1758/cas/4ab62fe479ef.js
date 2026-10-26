/* endgame_audit.js — the endgame balance audit (the user, 2026-10-07; brought into this web 2026-10-18: "ยก ... กติกา
   ท้ายเกมมาใส่เว็บเรา"; it lived only in the server team's copy of the web and on the Go server: monster_scale.go,
   gear_loot.go, junk_level.go, star_ore.go, gear_copies.go). Not tuned to the x2.5 monster HP on purpose (the user:
   monsters still die too easily).
     ATK         a monster's ATK grows with its level like its HP: x1 to Lv 60, x1.12 at 90, x1.2 at 99, straight lines
                 between (NC.MON_SCALE.atk; chests x1)
     VIT pierce  a high-level monster's blow cuts through part of the hero's soft DEF (VIT): none to Lv 60, all of it at
                 Lv 99 (NC.MON_SCALE.pierce; magic hits meet MDEF as before, js/rebalance.js)
     drops       every gear roll (species, boss, legend), the material pieces and the star ore x the level gap, the same
                 multiplier as EXP (js/levelgap.js), so a Lv 99 hero's drops come from monsters near its level; the
                 lava dragon's boss table x0.2 (NC.LOOT_DATA.bossK)
     star ore    the G4 refine's ore (lf_starore) had one sure source, a mining node: a monster of Lv 90+ drops one at
                 0.1% (1–3 an hour on the Lv 99 maps), a boss of Lv 98+ one every kill (NC.LOOT_DATA.star)
     gear sales  selling dropped gear was 35–50% of a Lv 99 hero's coins: Uncle Coco and the forge pay full price for the
                 day's first 15 pieces, then 1/40 less a piece down to 20%, full again the next day (NC.GEAR.sellPrice)
   The tables go to the Go server with tools/online/world_export.mjs (monsterBalance.atkScale / vdefPierce,
   gear.loot.bossK / star); the sale curve is the server's own constants. Hooks: js/loot.js (rolls x NC.dropGap),
   js/gearbag.js and js/forge.js (sellPrice + NC.gearSold). Load after js/levelgap.js. */
(function () {
  'use strict';
  const NC = window.NC;
  const T = (NC.MON_SCALE = NC.MON_SCALE || {});
  T.atk = [[60, 1], [90, 1.12], [99, 1.2]];
  T.pierce = [[60, 0], [99, 1]];
  // monscale.js `along`: the first point's factor before it, straight lines between, the last point's after
  const along = (pts, lv) => {
    if (!pts || !pts.length) return 0;
    if (lv <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [l1, k1] = pts[i], [l0, k0] = pts[i - 1];
      if (lv <= l1) return k0 + ((k1 - k0) * (lv - l0)) / (l1 - l0);
    }
    return pts[pts.length - 1][1];
  };
  NC.monAtkScale = (type, lv) => (/^chest_/.test(type || '') ? 1 : along(T.atk, lv || 1) || 1);

  // ---------------- ATK by level ----------------
  const baseStats = NC.monsterStats;
  NC.monsterStats = function (type, lv) {
    const s = baseStats.apply(this, arguments);
    const k = s && Array.isArray(s.atk) ? NC.monAtkScale(type, lv) : 1;
    if (k !== 1) s.atk = s.atk.map((v) => Math.round(v * k));
    return s;
  };

  // ---------------- the VIT pierce ----------------
  const baseMonHit = NC.monsterHit;
  NC.monsterHit = function (m, d) {
    const k = m && d && d.vdef > 0 && !(NC.isMagicHit && NC.isMagicHit(m)) ? along(T.pierce, m.lv || 1) : 0;
    if (k > 0) return baseMonHit.call(this, m, Object.assign({}, d, { vdef: d.vdef * (1 - Math.min(1, k)) }));
    return baseMonHit.apply(this, arguments);
  };

  // ---------------- drops x the level gap ----------------
  NC.dropGap = (heroLv, monLv) => (NC.levelGapMult ? NC.levelGapMult(heroLv, monLv) : 1);
  const D = NC.LOOT_DATA;
  if (D) {
    D.bossK = Object.assign({ lava_dragon: 0.2 }, D.bossK || {});
    D.star = D.star || { id: 'lf_starore', lv: 90, pct: 0.1, bossLv: 98, boss: 1 };
  }
  // the material pieces (js/materials.js asks NC.matQty for each drop of the hero's kill): x the gap, its fraction rolled
  const baseQty = NC.matQty;
  NC.matQty = function (e, n0, mat) {
    const n = baseQty ? baseQty.apply(this, arguments) : n0, p = NC.game && NC.game.player;
    const k = p && e ? (NC.questMatGap ? NC.questMatGap(p, mat, NC.dropGap(p.lv, e.lv)) : NC.dropGap(p.lv, e.lv)) : 1;
    if (k === 1 || !(n > 0)) return n;
    const x = n * k, whole = Math.floor(x);
    return whole + (Math.random() < x - whole ? 1 : 0);
  };
  // the star ore: a Lv 90+ monster 0.1% x the gap, a Lv 98+ boss its pieces every kill when the gap lets it
  NC.skillKills.push((game, e) => {
    const S = D && D.star, p = game.player;
    if (!S || !p || !e || e._heroT == null || game.time - e._heroT > 3 || e.lootless || (e.lv || 0) < S.lv) return;
    if (!NC.MATERIALS || !NC.MATERIALS[S.id] || /^chest_/.test(e.type || '')) return;
    const gap = NC.dropGap(p.lv, e.lv);
    let n = 0;
    if (NC.BOSSES && NC.BOSSES[e.type]) { if (e.lv >= S.bossLv && (gap >= 1 || Math.random() < gap)) n = S.boss; }
    else if (Math.random() * 100 < S.pct * gap) n = 1;
    for (let i = 0; i < n; i++)
      game.loot.push({ kind: 'loot', mat: S.id, x: e.x + NC.rand(-60, 60), y: e.y + NC.rand(-20, 20), sort: e.y, t: 0, z: 0, vz: NC.rand(420, 540), spin: NC.rand(0, 6) });
  });

  // ---------------- gear sales: full price for the day's first 15, then 1/40 less a piece, at least 20% ----------------
  const SALE = (NC.GEAR_SALE = { full: 15, drop: 40, floor: 0.2, key: 'nightcamp.gearsale.v1' });
  const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  const soldToday = () => {
    try { const s = JSON.parse(localStorage.getItem(SALE.key) || 'null'); return s && s.day === today() ? s.n | 0 : 0; } catch (e) { return 0; }
  };
  NC.gearSaleFlow = (sold) => (sold < SALE.full ? 1 : Math.max(SALE.floor, 1 - (sold - SALE.full + 1) / SALE.drop));
  NC.gearSold = function () {
    try { localStorage.setItem(SALE.key, JSON.stringify({ day: today(), n: soldToday() + 1 })); } catch (e) { /* storage blocked */ }
  };
  if (NC.GEAR && NC.GEAR.priceOf)
    NC.GEAR.sellPrice = (c) => { const base = NC.GEAR.priceOf(c); return base > 0 ? Math.max(1, Math.round(base * NC.gearSaleFlow(soldToday()))) : 0; };
})();
