/* fields6.js — the hunting AREAS (design 2026-10-14 "เขตล่าและผู้ถูกรากสิง", https://claude.ai/artifact/9UVocGiUxz3kaXxpqegJa8):
   every hunting field becomes an area of 4 sections like classic MMOs' fields, so that many farmers can farm one area.
   The user's picks: 4 sections an area; a new section reuses its area's props plus ONE new landmark sheet; one
   root-possessed human boss per area (js/rootboss.js); the pilot is ไร่ฟักทอง:
     1 farm      ไร่ฟักทอง        Lv 1–14   (fields2.js) the way in from the camp, the area's only safe camp
     2 farm2     ไร่ร้างหลังเขา    Lv 10–18  (fields5.js)
     3 cornmaze  เขาวงกตข้าวโพด   Lv 10–18  east of 2 (B1 of farm2 since the B1–B3 plan, at farm2's band): corn taller than a man cut into a maze round a giant scarecrow
                                         (the maze is made here from a fixed seed: walls of corn rows and corn clumps)
     4 pens      คอกสัตว์ร้าง      Lv 10–18  south of 3 (B2 of farm2): empty pens and a collapsed stable under a dead tree; a shortcut
                                         east to ต้นลำธาร (marsh2, Lv 20–28), so the area is no dead end
   Every section carries `area` and `sec`; the warp labels and the map curtain read "ไร่ร้างหลังเขา B1 · เขาวงกตข้าวโพด"
   (NC.areaLabel, replaced by js/fields7.js's B1–B3 label). Art: assets/maps/ mz_* pn_* (assets/gen/make_map6_prompts.py -> run_map6.sh -> cut_map6.sh) and the
   area's own fz_* props. Monsters: js/monsters7.js. Load after fields5.js and monsters7.js. */
(function () {
  'use strict';
  const NC = window.NC;
  const MAN = NC.ASSET_MANIFEST_MAPS || {};
  if (!MAN.mz_cornrow || !MAN.pn_stable || !NC.MAPS.farm2 || !NC.MAPS.marsh2) return; // (no art yet)

  // ---------------- props ----------------
  if (MAN.pn_penfence) MAN.pn_penfence.ax = 0.5;                  // (cut anchored at its lowest post; a fence row wants the middle)
  if (MAN.fz_corn && !MAN.mz_cornclump) MAN.mz_cornclump = Object.assign({}, MAN.fz_corn); // the area's tall corn as a maze wall
  const WALL = '#b89a48';
  Object.assign(NC.FIELD_PROPS, {
    // the maze walls block like a house (and fade when the hero walks behind them); their roof colour draws the maze on
    // the minimap
    mz_cornrow: { kind: 'house', rect: [0.94, 36], roof: WALL }, mz_cornclump: { kind: 'house', rect: [0.5, 52], roof: WALL },
    mz_scarecrow: { kind: 'tall', crown: '#8a6a3a' }, mz_shock: { kind: 'rock' }, mz_cart: { kind: 'rock' },
    mz_sign: { kind: 'post' }, mz_crowpost: { kind: 'post' },
    pn_stable: { kind: 'house', rect: [0.82, 110], roof: '#6a6258' }, pn_deadtree: { kind: 'tree', crown: '#5a5050' },
    pn_penfence: { kind: 'fence' }, pn_haywagon: { kind: 'rock' }, pn_trough: { kind: 'rock' },
    pn_shelter: { kind: 'house', rect: [0.8, 70], roof: '#6a6a60' },
  });

  // ---------------- biomes (the farm area's ground, drier in the maze, muddier by the pens) ----------------
  const V = (a, d) => a.map((x) => Math.max(0, Math.min(255, x + d)));
  function b(gn, gd, rn, rd, wn, wd, trees, border, grass, flowers, rocks, bushes, mini, more) {
    return Object.assign({
      base: { n: gn, d: gd }, patch: { n: V(gn, 6), d: V(gd, 12) }, vary: 14, patchScale: 460,
      road: { n: rn, d: rd }, roadEdge: { n: V(rn, -10), d: V(rd, -24) }, roadMid: { n: V(rn, 8), d: V(rd, 18) },
      water: { n: wn, d: wd }, deep: { n: V(wn, -12), d: V(wd, -28) }, shore: { n: V(gn, 8), d: V(gd, 20) },
      specks: [{ n: ['rgba(255,240,200,0.22)', 'rgba(20,20,30,0.3)'], d: ['rgba(255,250,220,0.4)', 'rgba(40,40,40,0.25)'], count: 2000, size: [2, 5] },
        { n: ['rgba(40,40,20,0.35)'], d: ['rgba(110,100,50,0.35)'], count: 1600, size: [3, 7], blade: 1 }],
      trees, border, grove: 0.56, fill: 0.5, lone: 0.28,
      bushes, nBush: 70, grass, nGrass: 440, flowers, nPatch: 38, rocks, nRock: 50, mini,
    }, more || {});
  }
  Object.assign(NC.BIOMES, {
    // (no trees inside: they would block the maze's paths; corn and sunflowers along the edges)
    cornmaze: b([64, 60, 40], [172, 152, 92], [76, 66, 54], [182, 152, 104], [36, 56, 84], [90, 150, 180],
      [['fz_sunflower', 1]], [['fz_corn', 1.4], ['fz_sunflower', 0.9], ['fz_oak', 0.4]], [['fz_weeds', 2]], [['fz_flowers', 1], ['fz_pumpkin', 0.6]],
      [['fz_hay', 1], ['mz_shock', 0.6], ['fz_rock', 0.5]], [['fz_weeds', 1]], { ground: '#d0c080', road: '#a88a62', water: '#7aa8c4', tree: 'rgba(150,130,60,0.55)' },
      { grove: 1.01, fill: 0, lone: 0, nBush: 24, nRock: 24, nGrass: 360 }),
    pens: b([50, 52, 44], [132, 128, 96], [66, 60, 56], [160, 136, 104], [34, 46, 52], [96, 120, 120],
      [['pn_deadtree', 1], ['fz_oak', 0.5]], [['fz_oak', 1], ['pn_deadtree', 0.8], ['fz_corn', 0.6]], [['fz_weeds', 2]], [['fz_flowers', 0.6]],
      [['fz_hay', 1], ['fz_bucket', 0.4], ['fz_rock', 0.6]], [['fz_weeds', 1]], { ground: '#a8a488', road: '#8a7a64', water: '#6a8a8a', tree: 'rgba(80,90,60,0.55)' },
      { grove: 0.66, fill: 0.28, lone: 0.1 }),
  });

  // ---------------- the corn maze: a maze from a fixed seed (the same for everyone), walls of corn ----------------
  const MZ = { C: 6, R: 5, S: 460, X0: 1020, Y0: 560 };
  function maze() {
    const { C, R, S, X0, Y0 } = MZ;
    let seed = 6101;
    const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const Hw = Array.from({ length: R + 1 }, () => Array(C).fill(true)); // Hw[k][c]: the wall along y = Y0 + k*S over column c
    const Vw = Array.from({ length: R }, () => Array(C + 1).fill(true)); // Vw[r][k]: the wall along x = X0 + k*S beside row r
    const seen = Array.from({ length: R }, () => Array(C).fill(false));
    const stack = [[0, 2]];
    seen[2][0] = true;
    while (stack.length) { // (a depth-first maze: every cell reachable)
      const [c, r] = stack[stack.length - 1];
      const nb = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].filter(([x, y]) => x >= 0 && y >= 0 && x < C && y < R && !seen[y][x]);
      if (!nb.length) { stack.pop(); continue; }
      const [x, y] = nb[Math.floor(rnd() * nb.length)];
      if (x !== c) Vw[r][Math.max(c, x)] = false; else Hw[Math.max(r, y)][c] = false;
      seen[y][x] = true;
      stack.push([x, y]);
    }
    for (let n = 0; n < 5; n++) Vw[1 + Math.floor(rnd() * (R - 2))][1 + Math.floor(rnd() * (C - 1))] = false; // a few loops
    Vw[2][3] = false;   // the scarecrow's yard: the two middle cells of the middle row joined
    Vw[2][0] = false;   // the way in from the west (row 2)
    Hw[R][3] = false;   // the way out to the south (column 3)
    const L = [];
    for (let k = 0; k <= R; k++) for (let c = 0; c < C; c++) {
      if (Hw[k][c]) L.push(['mz_cornrow', X0 + c * S + S / 2, Y0 + k * S + 18, { scale: 0.87, flip: rnd() < 0.5 }]);
    }
    for (let r = 0; r < R; r++) for (let k = 0; k <= C; k++) {
      if (!Vw[r][k]) continue;
      for (let i = 0; i < 10; i++) L.push(['mz_cornclump', Math.round(X0 + k * S + (rnd() - 0.5) * 14), Y0 + r * S + 23 + i * 46, { scale: 0.55, flip: rnd() < 0.5 }]);
    }
    // in the cells: corn shocks at dead ends, signposts where paths cross
    const walls = (c, r) => (Hw[r][c] ? 1 : 0) + (Hw[r + 1][c] ? 1 : 0) + (Vw[r][c] ? 1 : 0) + (Vw[r][c + 1] ? 1 : 0);
    let shocks = 0, signs = 0;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if ((c === 2 || c === 3) && r === 2) continue;
      const cx = X0 + c * S + S / 2, cy = Y0 + r * S + S / 2 + 60;
      if (walls(c, r) === 3 && shocks < 5) { L.push(['mz_shock', cx, cy, { flip: rnd() < 0.5 }]); shocks++; }
      else if (walls(c, r) <= 1 && signs < 3) { L.push(['mz_sign', cx + 90, cy, { flip: rnd() < 0.5 }]); signs++; }
    }
    L.push(['mz_scarecrow', X0 + 3 * S, Y0 + 2 * S + S / 2 + 110]);
    return L;
  }

  // ---------------- the ways in: farm2's east edge, marsh2's west edge ----------------
  const join = (id, warp, road) => {
    const M = NC.MAPS[id];
    if (!M || (M.warps || []).some((w) => w.id === warp.id)) return;
    (M.warps = M.warps || []).push(warp);
    if (road) (M.roads = M.roads || []).push(road);
  };
  join('farm2', { id: 'east', x: 4670, y: 1710, to: 'cornmaze', at: 'west' }, { w: 56, pts: [[3400, 900], [4000, 1300], [4400, 1650], [4760, 1710]] });
  // (the shortcut pens -> marsh2 moved to farm2's deepest section ลานนวดข้าวร้าง, B3 behind pens: areas_data.py link, js/fields7.js)

  // ---------------- the sections ----------------
  const lv = (lo, hi) => ({ slime: [lo, Math.round(lo + (hi - lo) * 0.6)], hollow: [lo + 2, hi] });
  const MS = MZ.X0 + 3.5 * MZ.S; // (the maze's south opening)
  Object.assign(NC.MAPS, {
    cornmaze: { name: 'เขาวงกตข้าวโพด', area: 'farm', sec: 3, lvText: 'Lv 10–18', biome: 'cornmaze', W: 4800, H: 3400, seed: 6103,
      lv: lv(10, 18), spawns: [['slime', 14], ['hollow', 16]], // (B1 of farm2: farm2's band since the B1–B3 plan; was 14–20)
      warps: [{ id: 'west', x: 130, y: 1710, to: 'farm2', at: 'east' }, { id: 'south', x: MS, y: 3270, to: 'pens', at: 'north' }],
      roads: [{ w: 62, pts: [[40, 1710], [600, 1700], [MZ.X0 + 20, 1710]] }, { w: 62, pts: [[MS, MZ.Y0 + MZ.R * MZ.S - 10], [MS - 30, 3100], [MS, 3360]] }],
      landmarks: maze().concat([
        ['mz_cart', 640, 2050, { flip: true }], ['mz_crowpost', 560, 1260], ['mz_crowpost', 4250, 760, { flip: true }],
        ['mz_crowpost', 4100, 3020], ['mz_shock', 4300, 1900], ['mz_shock', 380, 2700, { flip: true }], ['fz_hay', 4500, 2400],
      ]),
      zones: [
        { name: 'ลานหุ่นไล่กายักษ์', rect: [MZ.X0 + 2 * MZ.S, MZ.Y0 + 2 * MZ.S, MZ.X0 + 4 * MZ.S, MZ.Y0 + 3 * MZ.S], lv: lv(15, 18) },
        { name: 'ทางเข้าเขาวงกต', rect: [130, 1250, MZ.X0, 2170] },
        { name: 'ในเขาวงกต', rect: [MZ.X0, MZ.Y0, MZ.X0 + MZ.C * MZ.S, MZ.Y0 + MZ.R * MZ.S] },
        { name: 'ทุ่งข้าวโพดรอบนอก', rect: [MZ.X0 + MZ.C * MZ.S, 300, 4700, 3200] },
      ] },
    pens: { name: 'คอกสัตว์ร้าง', area: 'farm', sec: 4, lvText: 'Lv 10–18', biome: 'pens', W: 4800, H: 3400, seed: 6107,
      lv: lv(10, 18), spawns: [['slime', 14], ['hollow', 16]], // (B2 of farm2: farm2's band since the B1–B3 plan; was 17–22)
      warps: [{ id: 'north', x: 2400, y: 130, to: 'cornmaze', at: 'south' }], // (east: B3 ลานนวดข้าวร้าง, added by js/fields7.js)
      roads: [{ w: 66, pts: [[2400, 40], [2380, 700], [2200, 1300], [2500, 1850], [3200, 1800], [4000, 1700], [4760, 1700]] },
        { w: 50, pts: [[2200, 1300], [1500, 1200], [900, 1500]] }],
      ponds: [{ x: 1150, y: 2650, rx: 380, ry: 160, reeds: 6 }],
      landmarks: [['pn_stable', 2900, 1250], ['pn_deadtree', 3650, 1100], ['pn_shelter', 1650, 2250], ['pn_haywagon', 2200, 1600, { flip: true }],
        ['pn_trough', 2050, 2450], ['pn_trough', 3150, 2600, { flip: true }], ['pn_deadtree', 850, 900, { flip: true, scale: 0.85 }],
        ['fz_hay', 3300, 1450], ['fz_scarepost', 1300, 1750], ['pn_haywagon', 4000, 2700]],
      fences: [['pn_penfence', 1500, 2700, 2050], ['pn_penfence', 1500, 2700, 2950], ['pn_penfence', 2950, 3950, 2250], ['pn_penfence', 2950, 3950, 3050]],
      zones: [
        { name: 'คอกแกะดำ', rect: [1400, 1950, 4000, 3150], lv: lv(15, 18) },
        { name: 'คอกม้าพัง', rect: [2300, 800, 3950, 1700] },
        { name: 'ทางไปลานนวดข้าว', rect: [3950, 1300, 4760, 2100] },
      ] },
  });
  // the older sections of the area
  Object.assign(NC.MAPS.farm, { area: 'farm', sec: 1 });
  Object.assign(NC.MAPS.farm2, { area: 'farm', sec: 2 });

  // ---------------- the area's name on the warps and on the map curtain ----------------
  const AREAS = (NC.AREAS = NC.AREAS || {});
  AREAS.farm = { name: 'ไร่ฟักทอง', maps: ['farm', 'farm2', 'cornmaze', 'pens'] };
  NC.areaLabel = (id) => {
    const M = NC.MAPS[id], A = M && AREAS[M.area];
    return !M ? '' : !A || !(M.sec > 1) ? M.name : `${A.name} ${M.sec} · ${M.name}`;
  };
  // (maps.js builds the warp list with its own inner function when the hero changes maps: the labels are set where they
  // are drawn, each frame, which costs nothing)
  const label = (list) => { for (const pt of list || []) if (pt.to && NC.MAPS[pt.to] && !pt._area) { pt.name = NC.areaLabel(pt.to); pt._area = 1; } };
  const basePortals = NC.Maps.portals;
  NC.Maps.portals = function () { const out = basePortals.apply(this, arguments); label(out); return out; };
  const baseLabels = NC.Maps.drawLabels;
  NC.Maps.drawLabels = function (ctx, game) { if (game) label(game.portals); return baseLabels.apply(this, arguments); };
  const baseGo = NC.Maps.go;
  NC.Maps.go = function (game, id) {
    const M = NC.MAPS[id];
    if (!M || !(M.sec > 1)) return baseGo.apply(this, arguments);
    const name = M.name;
    M.name = NC.areaLabel(id); // (go() writes the name on the curtain at once)
    try { return baseGo.apply(this, arguments); } finally { M.name = name; }
  };

  // ---------------- each section's air ----------------
  const AIR = { cornmaze: { dusk: 0.16 }, pens: { dusk: 0.3 } };
  const baseField = NC.buildField;
  NC.buildField = function (def) {
    const w = baseField.apply(this, arguments);
    if (def && AIR[def.id]) Object.assign(w, AIR[def.id]);
    return w;
  };

  // ---------------- the world map's notes and the music (their lists load after this file) ----------------
  const NOTES = {
    cornmaze: 'ไร่ร้างหลังเขา B1 · ข้าวโพดสูงท่วมหัวกั้นเป็นเขาวงกต หุ่นฟางยิงเมล็ดจากที่ไกล ฝักข้าวโพดป๊อปวิ่งเข้ามาระเบิด · หุ่นไล่กายักษ์ยืนกลางวง',
    pens: 'ไร่ร้างหลังเขา B2 · คอกร้างใต้ต้นไม้ตาย แม่แกะดำเรียกลูกแกะ ตุ๊กตาฟางเย็บแผลให้พวกเดียวกัน (ตีตัวเย็บก่อน) · ทางต่อไปลานนวดข้าวร้าง',
  };
  const baseLoad = NC.loadAssets;
  NC.loadAssets = function () {
    if (NC.MAP_NOTES) for (const k in NOTES) if (!NC.MAP_NOTES[k]) NC.MAP_NOTES[k] = NOTES[k];
    if (NC.MUSIC_TRACKS && NC.MUSIC_TRACKS.farm2) for (const k of ['cornmaze', 'pens']) if (!NC.MUSIC_TRACKS[k]) NC.MUSIC_TRACKS[k] = NC.MUSIC_TRACKS.farm2;
    return baseLoad.apply(this, arguments);
  };
})();
