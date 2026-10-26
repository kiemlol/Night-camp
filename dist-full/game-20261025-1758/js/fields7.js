/* fields7.js — the hunting AREAS' new sections, built from data (design 2026-10-14 "เขตล่าและผู้ถูกรากสิง",
   https://claude.ai/artifact/9UVocGiUxz3kaXxpqegJa8; the user, after the pilot ไร่ฟักทอง of js/fields6.js: "ทำต่อให้ครบเลย").
   NC.AREA_DATA (js/areas_data.js, written by assets/gen/loot/areas_build.py from areas_data.py) lists every new section:
   its area and number, levels, the map it hangs off (parent + the parent's edge it is on), its six props (one landmark
   sheet, assets/maps/<prefix>_*: the first is the centrepiece), its two zones, its air. Each one becomes a map the way
   the pilot's were made by hand, the same for everyone (a seed from its id):
     - warps at the middle of the edges: the way back on the edge facing its parent, one more for each section behind it;
       the parent gets a warp on its edge and a road to it from its nearest road
     - the deepest section of an area (data `link`) also gets a shortcut warp to a neighbouring area's map, and that map one
       back (the plan: no dead ends)
     - roads from every warp to a hub near the middle; the centrepiece beside the hub, off the roads, the section's
       centre zone round it (the higher levels); the way-in zone by the way back
     - the section's other props: houses, tall things, posts and rocks a few times each by hand; trees, bushes and the
       low plants go into its biome (a copy of its area's, so the area's own props fill the rest)
   A section whose art is not cut yet is left out (and the sections behind it). Since the B1–B3 plan (2026-10-15) every
   section is a B slot of one field map at that map's level band, and the warps and the map curtain read
   "<root map> B<n> · <section>" ("เนินดอกไม้กลางคืน B1 · ทุ่งหญ้าสูงท่วมหัว": NC.areaLabel below). Monsters: js/monsters8.js.
   Load after fields6.js and js/areas_data.js. */
(function () {
  'use strict';
  const NC = window.NC, D = NC.AREA_DATA;
  if (!D || !NC.MAPS || !NC.BIOMES || !NC.FIELD_PROPS) return;
  const MAN = NC.ASSET_MANIFEST_MAPS || {};
  const W = 4800, H = 3400, TAU = Math.PI * 2;
  const OPP = { north: 'south', south: 'north', east: 'west', west: 'east' };
  const sizeOf = (M) => [M.W || W, M.H || H];
  const edgePt = (M, e) => { const [w, h] = sizeOf(M); return e === 'north' ? [w / 2, 130] : e === 'south' ? [w / 2, h - 130] : e === 'east' ? [w - 130, h / 2] : [130, h / 2]; };
  const outPt = (M, e, x, y) => { const [w, h] = sizeOf(M); return e === 'north' ? [x, 40] : e === 'south' ? [x, h - 40] : e === 'east' ? [w - 40, y] : [40, y]; };
  const inward = (e, x, y, d) => (e === 'north' ? [x, y + d] : e === 'south' ? [x, y - d] : e === 'east' ? [x - d, y] : [x + d, y]);
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const lvOf = (lo, hi) => ({ slime: [lo, Math.round(lo + (hi - lo) * 0.6)], hollow: [Math.min(hi, lo + 2), hi] });
  // points along a road (its corners joined by straight steps: close enough to the game's curve for spacing checks)
  const along = (pts, step) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
      for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  };

  // ---------------- the props ----------------
  for (const [id, P] of Object.entries(D.props)) if (!NC.FIELD_PROPS[id]) NC.FIELD_PROPS[id] = Object.assign({}, P);

  // ---------------- which sections can be built (their art cut, the map they hang off there) ----------------
  const ready = [];
  for (const s of D.sections) {
    if (NC.MAPS[s.id] || !MAN[s.centre]) continue;
    if (!NC.MAPS[s.parent] && !ready.some((r) => r.id === s.parent)) continue;
    ready.push(s);
  }
  if (!ready.length) return;

  // ---------------- a biome for each: its area's, with the section's own trees, bushes and low plants ----------------
  function biome(s) {
    const b = clone(NC.BIOMES[s.base] || NC.BIOMES.meadow);
    const more = clone(s.more || {});
    const add = (list, id, w) => {
      if (more[list]) return; // (the data set this list itself)
      b[list] = (b[list] || []).filter(([n]) => n !== id);
      b[list].push([id, w]);
    };
    for (const id of s.props.slice(1)) {
      const k = (D.props[id] || {}).kind;
      if (k === 'tree') { add('trees', id, 1); add('border', id, 0.5); }
      else if (k === 'bush') add('bushes', id, 1.4);
      else if (k === 'low') add('flowers', id, 1.2);
    }
    return Object.assign(b, more);
  }

  // ---------------- the parent's side: a warp on its edge, a road to it from its nearest road ----------------
  function freeEdge(M, e) {
    const [x, y] = edgePt(M, e);
    const [w, h] = sizeOf(M), horiz = e === 'north' || e === 'south';
    const clash = (px, py) => (M.warps || []).some((q) => Math.hypot(q.x - px, q.y - py) < 600);
    // (nor in a pond: ด่านสะพานเกลือ's sea fills the middle of its east edge, and B1's door there could not be reached)
    const wet = (px, py) => (M.ponds || []).some((p) => ((px - p.x) / p.rx) ** 2 + ((py - p.y) / p.ry) ** 2 < 1);
    for (const d of [0, 700, -700, 1300, -1300]) {
      const px = horiz ? Math.min(w - 400, Math.max(400, x + d)) : x, py = horiz ? y : Math.min(h - 400, Math.max(400, y + d));
      if (!clash(px, py) && !wet(px, py)) return [px, py];
    }
    return [x, y];
  }
  // a road from a new warp at (x, y) on M's edge e to M's nearest road (a gentle bend, the same for everyone)
  function roadIn(M, e, x, y, seed) {
    const i1 = inward(e, x, y, 300);
    let best = null;
    for (const r of M.roads || []) for (const p of along(r.pts, 50)) {
      const d = Math.hypot(p[0] - i1[0], p[1] - i1[1]);
      if (!best || d < best.d) best = { d, p };
    }
    const pts = [outPt(M, e, x, y), [x, y], i1];
    if (best && best.d > 60) {
      const [bx, by] = best.p, mx = (bx + i1[0]) / 2, my = (by + i1[1]) / 2, L = best.d, b = ((hash(seed) % 100) / 100 - 0.5) * 0.3 * L;
      pts.push([mx - ((by - i1[1]) / L) * b, my + ((bx - i1[0]) / L) * b], [bx, by]);
    }
    (M.roads = M.roads || []).push({ w: 56, pts: pts.reverse().map((p) => p.map(Math.round)) });
  }
  // the parent's warp id for a section: its edge, or "<edge>_<section>" when that edge already has a warp of that id going
  // elsewhere (the B1-B3 sections hang off field maps whose four edges are all in use: a second "south" warp made the way
  // back land on the first one)
  const pid = (s) => { const P = NC.MAPS[s.parent]; return P && (P.warps || []).some((q) => q.id === s.edge && q.to !== s.id) ? s.edge + '_' + s.id : s.edge; };
  function join(M, s) {
    const e = s.edge;
    if ((M.warps || []).some((q) => q.to === s.id)) return;
    const [x, y] = freeEdge(M, e);
    (M.warps = M.warps || []).push({ id: pid(s), x, y, to: s.id, at: OPP[e] });
    roadIn(M, e, x, y, s.id);
  }

  // ---------------- a section's own map ----------------
  // (a shortcut is built only when the map at its other end is there: an old map, or a section built with this one)
  const linkOk = (s) => !!(s.link && (NC.MAPS[s.link[0]] || ready.some((r) => r.id === s.link[0])));
  function layout(s, kids) {
    const R = rng(hash(s.id)), lo = s.lv[0], hi = s.lv[1], self = { W, H };
    const back = OPP[s.edge];
    const warps = [];
    { const [x, y] = edgePt(self, back); warps.push({ id: back, x, y, to: s.parent, at: pid(s) }); }
    for (const c of kids) { const [x, y] = edgePt(self, c.edge); warps.push({ id: c.edge, x, y, to: c.id, at: OPP[c.edge] }); }
    if (linkOk(s)) { const [x, y] = edgePt(self, s.link[1]); warps.push({ id: s.link[1], x, y, to: s.link[0], at: 'lk_' + s.id }); }
    const ponds = s.ponds || [];
    const pondAt = (x, y, pad) => ponds.find((p) => ((x - p.x) / (p.rx + pad)) ** 2 + ((y - p.y) / (p.ry + pad)) ** 2 < 1);
    const inPond = (x, y, pad) => !!pondAt(x, y, pad);
    // the hub: near the middle, out of the water
    let hub = [W / 2 + (R() - 0.5) * 500, H / 2 + (R() - 0.5) * 360];
    for (let n = 0, p; n < 60 && (p = pondAt(hub[0], hub[1], 260)); n++) {
      const a = Math.atan2(hub[1] - p.y, hub[0] - p.x) || -Math.PI / 2;
      hub = [hub[0] + Math.cos(a) * 60, hub[1] + Math.sin(a) * 60];
    }
    hub = hub.map(Math.round);
    const roads = warps.map((w) => {
      const o = outPt(self, w.id, w.x, w.y), i1 = inward(w.id, w.x, w.y, 320);
      const dx = hub[0] - i1[0], dy = hub[1] - i1[1], L = Math.hypot(dx, dy) || 1, b = (R() - 0.5) * 0.45 * L;
      let mid = [(i1[0] + hub[0]) / 2 - (dy / L) * b, (i1[1] + hub[1]) / 2 + (dx / L) * b];
      if (inPond(mid[0], mid[1], 200)) mid = [(i1[0] + hub[0]) / 2, (i1[1] + hub[1]) / 2];
      return { w: 62, pts: [o, [w.x, w.y], i1, mid, hub].map((p) => p.map(Math.round)) };
    });
    const steps = roads.flatMap((r) => along(r.pts, 40));
    const roadD = (x, y) => steps.reduce((m, [a, b]) => Math.min(m, Math.hypot(a - x, (b - y) * 1.3)), 1e9);
    const nearWarp = (x, y, d) => warps.some((w) => Math.hypot(w.x - x, w.y - y) < d);
    // the centrepiece beside the hub, as far from the roads as the ring allows
    let C = null;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU + R() * 0.2, rr = 520 + R() * 160;
      const x = hub[0] + Math.cos(a) * rr, y = hub[1] + Math.sin(a) * rr * 0.75;
      if (x < 650 || x > W - 650 || y < 750 || y > H - 450 || inPond(x, y, 300) || nearWarp(x, y, 700)) continue;
      const d = roadD(x, y);
      if (!C || d > C.d) C = { x: Math.round(x), y: Math.round(y), d };
    }
    if (!C) C = { x: hub[0] + 600, y: hub[1] - 300 };
    const L = [[s.centre, C.x, C.y]];
    const placed = [[C.x, C.y, 460]];
    // the rest of the sheet by hand: how many of each kind
    const COUNT = { house: 2, tall: 3, post: 3, rock: 3, tree: 2 };
    const RAD = { house: 320, tall: 220, tree: 220, post: 140, rock: 170 };
    const free = (x, y, rad) => roadD(x, y) > rad * 0.55 + 70 && !nearWarp(x, y, 560) && !inPond(x, y, rad * 0.6 + 80) &&
      !placed.some(([px, py, pr]) => Math.hypot(px - x, (py - y) * 1.3) < pr + rad);
    const fences = [];
    const copies = s.copies || {}, suf = (id) => id.slice(s.prefix.length + 1);
    // extra copies of the centrepiece (a village of stilt houses), a little smaller
    for (let n = (copies[suf(s.centre)] || 1) - 1, t = 0; n > 0 && t < 400; t++) {
      const x = 400 + R() * (W - 800), y = 550 + R() * (H - 850);
      if (!free(x, y, 360)) continue;
      L.push([s.centre, Math.round(x), Math.round(y), { flip: R() < 0.5, scale: 0.8 + R() * 0.1 }]);
      placed.push([x, y, 360]); n--;
    }
    for (const id of s.props.slice(1)) {
      const k = (D.props[id] || {}).kind, S = MAN[id];
      if (!S) continue;
      if (k === 'fence') { // two short rows (a broken boardwalk, a fence): along the pond or in the open
        for (let made = 0, t = 0; made < (copies[suf(id)] || 2) && t < 300; t++) {
          const n = 3 + Math.floor(R() * 3), len = n * S.w * 0.92, x0 = 300 + R() * (W - 600 - len), y = 450 + R() * (H - 750);
          const mids = [x0, x0 + len / 2, x0 + len];
          if (!mids.every((x) => free(x, y, 150))) continue;
          fences.push([id, Math.round(x0), Math.round(x0 + len), Math.round(y)]);
          for (const x of mids) placed.push([x, y, 150]);
          made++;
        }
        continue;
      }
      const rad = RAD[k] || 160;
      for (let n = copies[suf(id)] != null ? copies[suf(id)] : COUNT[k] || 0, t = 0; n > 0 && t < 400; t++) {
        const x = 350 + R() * (W - 700), y = 450 + R() * (H - 750);
        if (!free(x, y, rad)) continue;
        L.push([id, Math.round(x), Math.round(y), { flip: R() < 0.5, scale: 0.9 + R() * 0.2 }]);
        placed.push([x, y, rad]); n--;
      }
    }
    // the zones: the centre (its higher levels) and the way in
    const cl = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
    const zc = [cl(C.x - 700, 150, W - 150), cl(C.y - 650, 150, H - 150), cl(C.x + 700, 150, W - 150), cl(C.y + 420, 150, H - 150)];
    const [bx, by] = edgePt(self, back);
    const zw = back === 'east' ? [W - 820, by - 560, W - 60, by + 560] : back === 'west' ? [60, by - 560, 820, by + 560]
      : back === 'north' ? [bx - 560, 60, bx + 560, 820] : [bx - 560, H - 820, bx + 560, H - 60];
    const zones = [{ name: s.zones[1], rect: zc, lv: lvOf(Math.round(lo + (hi - lo) * 0.6), hi) }, { name: s.zones[0], rect: zw }];
    // the centrepiece and the tall things stay in view: no tree crowns over them from the front (fieldgen's keep)
    const keep = L.filter(([id]) => id === s.centre || ['tall', 'house'].includes((D.props[id] || {}).kind)).map(([id, x, y, o]) => {
      const S = MAN[id], k = (o && o.scale) || 1, w = S.w * k, h = S.h * k;
      return [Math.round(x - w / 2), Math.round(y - h), Math.round(x + w / 2), y];
    });
    const def = { name: s.name, area: s.area, sec: s.sec, lvText: `Lv ${lo}–${hi}`, biome: s.id, W, H, seed: hash(s.id) % 100000,
      lv: lvOf(lo, hi), spawns: [['slime', 14], ['hollow', 16]], warps, roads, landmarks: L, zones, keep };
    if (fences.length) def.fences = fences;
    if (ponds.length) def.ponds = ponds.map((p) => Object.assign({}, p));
    return def;
  }

  // ---------------- build them ----------------
  const built = [];
  for (const s of ready) {
    const parent = NC.MAPS[s.parent];
    if (!parent) continue;
    NC.BIOMES[s.id] = biome(s);
    const kids = ready.filter((c) => c.parent === s.id);
    NC.MAPS[s.id] = layout(s, kids);
    join(parent, s);
    built.push(s);
  }

  // ---------------- the shortcuts (the plan: "no dead ends"): the deepest section of an area -> a neighbouring area ----------------
  // its own warp was laid with its roads; the other map gets one on the facing edge and a road to its nearest road
  for (const s of built) {
    const M = s.link && NC.MAPS[s.link[0]];
    if (!M || !linkOk(s) || (M.warps || []).some((q) => q.to === s.id && q.id === 'lk_' + s.id)) continue;
    const e = OPP[s.link[1]], [x, y] = freeEdge(M, e);
    (M.warps = M.warps || []).push({ id: 'lk_' + s.id, x, y, to: s.id, at: s.link[1] });
    roadIn(M, e, x, y, 'lk' + s.id);
  }

  // ---------------- safe camps for the maps that had none (their own sheet of props) ----------------
  for (const c of D.camps || []) {
    const M = NC.MAPS[c.map], P = c.props;
    if (!M || !MAN[P.tent] || (M.zones || []).some((z) => z.name === c.name)) continue;
    const [x0, y0, x1, y1] = c.safe, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    M.safe = (M.safe || []).concat([c.safe]);
    M.zones = [{ name: c.name, rect: c.safe }].concat(M.zones || []);
    M.landmarks = (M.landmarks || []).concat([
      [P.fire, Math.round(cx), Math.round(cy + 40)], [P.tent, Math.round(cx - 230), Math.round(cy - 90)],
      [P.tent, Math.round(cx + 250), Math.round(cy - 70), { flip: true, scale: 0.9 }], [P.lookout, x1 - 110, y0 + 170],
      [P.crates, Math.round(cx - 300), Math.round(cy + 170)], [P.crates, Math.round(cx + 330), Math.round(cy + 190), { flip: true }],
      [P.flag, Math.round(cx + 40), y0 + 110],
    ].filter((l) => MAN[l[0]]));
    if (MAN[P.stakes]) { // (along the top and the bottom of the camp: the road side stays open)
      const w = MAN[P.stakes].w * 0.92;
      M.fences = (M.fences || []).concat([[P.stakes, x0 + 60, x1 - 60 - w, y0 + 30], [P.stakes, x0 + 60, x1 - 60 - w, y1 - 10]]);
    }
  }

  // ---------------- the areas: each map's area and number (the labels on the warps and the curtain) ----------------
  const AREAS = (NC.AREAS = NC.AREAS || {});
  for (const area of new Set(built.map((s) => s.area))) {
    const old = (D.old[area] || []).filter((id) => NC.MAPS[id]);
    old.forEach((id, i) => { if (!NC.MAPS[id].area) Object.assign(NC.MAPS[id], { area, sec: i + 1 }); });
    const mine = D.sections.filter((s) => s.area === area && NC.MAPS[s.id]).sort((a, b) => a.sec - b.sec).map((s) => s.id);
    AREAS[area] = { name: D.areaNames[area] || area, maps: old.concat(mine) };
  }
  // the B1–B3 label (2026-10-15, the user: "ไร่ฟักทอง B1, B2, B3"): a section is a B slot of ONE field map at that map's
  // level band (NC.AREA_DATA.bslots: id -> [root field map, n], the farm pilot's cornmaze/pens too), so the warps and the
  // curtain read "<root map> B<n> · <section>" (e.g. "ไร่ร้างหลังเขา B1 · เขาวงกตข้าวโพด"); a field map shows its own name
  // (it replaces fields6.js's "<area> <n> · <name>"; fields6's portal / curtain wrappers call this one)
  for (const [id, [root, n]] of Object.entries(D.bslots || {})) if (NC.MAPS[id]) Object.assign(NC.MAPS[id], { broot: root, bn: n });
  NC.areaLabel = (id) => {
    const M = NC.MAPS[id], R = M && M.broot && NC.MAPS[M.broot];
    return !M ? '' : R ? `${R.name} B${M.bn} · ${M.name}` : M.name;
  };

  // ---------------- each section's air ----------------
  const AIR = {};
  for (const s of built) if (s.dusk != null) AIR[s.id] = { dusk: s.dusk };
  const baseField = NC.buildField;
  NC.buildField = function (def) {
    const w = baseField.apply(this, arguments);
    if (def && AIR[def.id]) Object.assign(w, AIR[def.id]);
    return w;
  };

  // ---------------- the world map's pins and notes, the music (their lists load after this file) ----------------
  const STEP = { west: [-6, 3], east: [6, -3], north: [2, -8], south: [-2, 8] };
  const rootOf = (id) => { let s = D.sections.find((q) => q.id === id); while (s && D.sections.find((q) => q.id === s.parent)) s = D.sections.find((q) => q.id === s.parent); return s ? s.parent : id; };
  const baseLoad = NC.loadAssets;
  NC.loadAssets = function () {
    const PINS = NC.WORLD_PINS;
    if (PINS) for (const s of built) {
      if (PINS[s.id] || !PINS[s.parent]) continue;
      const [reg, px, py] = PINS[s.parent], [dx, dy] = STEP[s.edge] || [4, 4];
      let x = Math.max(4, Math.min(96, px + dx)), y = Math.max(4, Math.min(96, py + dy));
      for (let n = 0; n < 8 && Object.values(PINS).some((v) => v[0] === reg && Math.hypot(v[1] - x, v[2] - y) < 4); n++) { x = Math.max(4, Math.min(96, x + dx * 0.5)); y = Math.max(4, Math.min(96, y + dy * 0.5 + 1)); }
      PINS[s.id] = [reg, Math.round(x), Math.round(y)];
    }
    if (NC.MAP_NOTES) for (const s of built) {
      if (NC.MAP_NOTES[s.id]) continue;
      const nm = (id) => (NC.SPECIES && NC.SPECIES[id] ? NC.SPECIES[id].name : '');
      const mons = (s.monsters || []).map(nm).filter(Boolean), rare = nm(s.rare);
      // ("<root map> B<n>", the B1–B3 label; the B sections of 2026-10-15 also hold their root map's monsters)
      const R = s.root && NC.MAPS[s.root], where = R ? `${R.name} B${s.b}` : `${D.areaNames[s.area] || ''} เขต ${s.sec}`;
      NC.MAP_NOTES[s.id] = where + (mons.length ? ' · ' + mons.join(' · ') : '') + (rare ? ` · หายาก: ${rare}` : '');
    }
    if (NC.MUSIC_TRACKS) for (const s of built) {
      if (NC.MUSIC_TRACKS[s.id]) continue;
      const t = NC.MUSIC_TRACKS[s.parent] || NC.MUSIC_TRACKS[rootOf(s.id)];
      if (t) NC.MUSIC_TRACKS[s.id] = t;
    }
    return baseLoad.apply(this, arguments);
  };

  NC.Sections = { built: built.map((s) => s.id) };
})();
