/* dungeongen.js — builds a DUNGEON floor (the caves, mines, crypts and lava vents under the fields, js/dungeons.js)
   from its description in NC.MAPS: rooms of different sizes joined by winding tunnels (a spanning tree and a few
   loops), carved out of solid rock and painted in its theme: the floor, the dark rock mass, the cliff face along the
   rock's south edges and a bold outline; props and lights along the walls and in the rooms; the entrance room (the way
   up), the deepest room (the stairs down, or the boss), chests in the dead ends, spike traps in the tunnels, lava or
   water pools. Every floor is checked: the way up, the way down, the boss and the chests can all be walked to (else the
   next seed is tried).
   It returns the same world shape as fieldgen.js NC.buildField, so game.js, the minimap, the monsters, the bots and the
   auto farm work in it unchanged; a dungeon stays night-dark (world.dusk = 1, world.ambient: the theme's). maps.js
   builds every map but the camp with NC.buildField: this wraps it for the maps that have a `dungeon` entry.
   Load after fieldgen.js and fields3.js. */
(function () {
  'use strict';
  const NC = window.NC, TAU = Math.PI * 2;
  const CELL = 10, GS = 0.5, FACE = 84; // collision grid, ground canvas scale, cliff face height (world units)

  // ---------------- themes: the paint, the air, what stands where ----------------
  // floor / floor2: the ground and its patches; rock / rock2: the solid mass; face: the cliff face (top, bottom);
  // pool: lava or water (and its glow); wall: big things along the walls; glow: light-giving things (every ~glowEvery);
  // big / low: things in the rooms (low = no collision); torch: a light that may stand in any room
  const THEMES = {
    cave: {
      floor: [112, 102, 96], floor2: [128, 116, 104], rock: [34, 30, 42], rock2: [50, 44, 58],
      face: [[132, 120, 116], [80, 70, 78]], ambient: [86, 82, 116], light: [380, '255,214,160'],
      specks: ['rgba(64,56,62,0.55)', 'rgba(170,158,144,0.5)', 'rgba(110,140,160,0.35)'], cracks: 60,
      wall: [['dc_stalagmite', 1], ['dc_stalagmites', 1.5], ['dc_boulder', 0.8]],
      glow: [['dc_crystals', 1], ['dc_shrooms', 1]], glowEvery: 460,
      big: [['dc_boulder', 1], ['dc_stalagmites', 1]], low: [['dc_bones', 1], ['dc_puddle', 1.3]],
      entrance: 'dc_camp',
      mini: '#8e8078',
    },
    mine: {
      floor: [128, 96, 70], floor2: [146, 110, 78], rock: [44, 32, 30], rock2: [62, 44, 38],
      face: [[150, 112, 80], [92, 64, 50]], ambient: [104, 88, 84], light: [360, '255,206,140'],
      specks: ['rgba(80,56,40,0.55)', 'rgba(190,150,110,0.45)', 'rgba(60,44,34,0.5)'], cracks: 40, rails: 2,
      wall: [['dm_support', 1.2], ['dm_barrel', 0.6], ['dm_mound', 0.8]],
      glow: [['dm_eggs', 1], ['dm_amber', 1.2]], glowEvery: 520,
      big: [['dm_cart', 1], ['dm_mound', 1], ['dm_barrel', 0.6]], low: [['dm_fungus', 1], ['dm_roots', 1]],
      torch: 'd_torch',
      mini: '#9a7456',
    },
    crypt: {
      floor: [104, 106, 116], floor2: [118, 120, 128], rock: [26, 26, 36], rock2: [40, 40, 52],
      face: [[124, 124, 136], [72, 72, 86]], ambient: [52, 54, 78], light: [420, '220,225,255'],
      specks: ['rgba(60,62,76,0.5)', 'rgba(170,172,182,0.4)', 'rgba(90,120,90,0.35)'], cracks: 30, tiles: true,
      wall: [['dy_pillar', 1], ['dy_niche', 1], ['dy_coffin', 1.2], ['dy_urns', 0.8]],
      glow: [['dy_candelabra', 1], ['dy_brazier', 1]], glowEvery: 560,
      big: [['dy_coffin', 1], ['dy_urns', 0.6], ['dy_pillar', 0.5]], low: [['dy_boneheap', 1], ['dy_slabs', 1.4]],
      mini: '#8a8c9a',
    },
    lava: {
      floor: [70, 56, 60], floor2: [86, 66, 64], rock: [24, 18, 24], rock2: [40, 28, 32],
      face: [[98, 76, 76], [54, 40, 46]], ambient: [132, 86, 80], light: [340, '255,190,140'],
      specks: ['rgba(40,30,34,0.6)', 'rgba(255,120,60,0.45)', 'rgba(120,100,100,0.4)'], cracks: 140, glowCracks: true,
      pool: { c1: [255, 210, 90], c2: [255, 110, 40], edge: [70, 30, 30], glow: '255,120,40' },
      wall: [['dl_obsidian', 1.2], ['dl_pillar', 0.8], ['dl_magma', 1]],
      glow: [['dl_geyser', 1], ['dl_suncrystal', 1]], glowEvery: 600,
      big: [['dl_magma', 1], ['dl_obsidian', 0.8]], low: [['dl_ash', 1.4]],
      special: ['dl_ribs', 'dl_cage'],
      mini: '#6a5056',
    },
  };
  NC.DUNGEON_THEMES = THEMES;

  // ---------------- small geometry helpers (as fieldgen.js) ----------------
  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, t = NC.clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
  };
  const blob = (cx, cy, rx, ry, seed, wob) => {
    const pts = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU, k = 1 + (NC.fbm(Math.cos(a) * 1.7 + 5, Math.sin(a) * 1.7 + 5, seed, 3) - 0.5) * wob;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  };
  const trace = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
  const pickW = (R, list) => {
    let s = 0;
    for (const [, w] of list) s += w;
    let r = R() * s;
    for (const [n, w] of list) if ((r -= w) <= 0) return n;
    return list[list.length - 1][0];
  };
  // A random sort comparator consumes an engine-dependent number of RNG draws.
  // Fisher-Yates preserves the same layout sequence for a given dungeon seed.
  const shuffle = (R, list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(R() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const inRoom = (q, x, y, k) => ((x - q.x) / (q.rx * (k || 1))) ** 2 + ((y - q.y) / (q.ry * (k || 1))) ** 2 < 1;

  // ---------------- layout: rooms, the tunnels between them ----------------
  function layout(def, R) {
    const D = def.dungeon, W = def.W, H = def.H, M = 280;
    const rooms = [];
    // the entrance at the bottom, the boss (a big room) at the top; the rest wherever they fit
    rooms.push({ x: W * (0.3 + R() * 0.4), y: H - M - 190, rx: 330, ry: 200, role: 'entrance' });
    if (D.boss) rooms.push({ x: W * (0.3 + R() * 0.4), y: M + 300, rx: 560, ry: 330, role: 'boss' });
    const [r0, r1] = D.room || [220, 420];
    for (let tries = 0; rooms.length < D.rooms && tries < 900; tries++) {
      const rx = r0 + R() * (r1 - r0), ry = rx * (0.56 + R() * 0.18);
      const x = M + rx + R() * (W - 2 * (M + rx)), y = M + ry + R() * (H - 2 * (M + ry));
      if (rooms.some((q) => Math.hypot((q.x - x) / (q.rx + rx + 200), (q.y - y) / (q.ry + ry + 200)) < 1)) continue;
      rooms.push({ x, y, rx, ry, role: 'room' });
    }
    rooms.forEach((q, i) => { q.i = i; q.pts = blob(q.x, q.y, q.rx, q.ry, def.seed * 13 + i, 0.42); q.links = []; });
    // a spanning tree over the rooms (Prim, by distance), then a few loops (never into the boss room: one way in)
    const n = rooms.length, inTree = new Set([0]), edges = [];
    const dist = (a, b) => Math.hypot(rooms[a].x - rooms[b].x, (rooms[a].y - rooms[b].y) * 1.2);
    while (inTree.size < n) {
      let best = null;
      for (const a of inTree) for (let b = 0; b < n; b++) if (!inTree.has(b) && (!best || dist(a, b) < best[2])) best = [a, b, dist(a, b)];
      if (!best) break;
      inTree.add(best[1]); edges.push([best[0], best[1]]);
    }
    const avg = edges.reduce((s, [a, b]) => s + dist(a, b), 0) / Math.max(1, edges.length);
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++) {
        if (rooms[a].role === 'boss' || rooms[b].role === 'boss' || edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) continue;
        if (dist(a, b) < avg * 1.25 && R() < (D.loops || 0.2)) edges.push([a, b]);
      }
    // the boss room hangs off one room only: keep its first tree edge
    const tunnels = [];
    for (const [a, b] of edges) {
      const A = rooms[a], B = rooms[b], len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
      const nx = -(B.y - A.y) / len, ny = (B.x - A.x) / len, off = (R() - 0.5) * len * 0.45;
      const c = [(A.x + B.x) / 2 + nx * off, (A.y + B.y) / 2 + ny * off];
      const pts = [];
      for (let s = 0; s <= 24; s++) {
        const t = s / 24, u = 1 - t;
        pts.push([u * u * A.x + 2 * u * t * c[0] + t * t * B.x, u * u * A.y + 2 * u * t * c[1] + t * t * B.y]);
      }
      // (an east-west tunnel is wider: the cliff face of its north wall takes part of it)
      tunnels.push({ a, b, pts, w: (D.tunnel || 190) * (0.88 + R() * 0.3) + FACE * Math.abs(B.x - A.x) / len });
      A.links.push(b); B.links.push(a);
    }
    // the deepest room: the furthest from the entrance along the tunnels (the boss room when there is one)
    const far = new Array(n).fill(Infinity);
    far[0] = 0;
    for (let k = 0; k < n; k++) for (const t of tunnels) {
      const d = dist(t.a, t.b);
      if (far[t.a] + d < far[t.b]) far[t.b] = far[t.a] + d;
      if (far[t.b] + d < far[t.a]) far[t.a] = far[t.b] + d;
    }
    let deep = rooms.find((q) => q.role === 'boss');
    if (!deep) { deep = rooms[1] || rooms[0]; for (const q of rooms) if (q.role === 'room' && far[q.i] > far[deep.i]) deep = q; if (deep.role === 'room') deep.role = 'deep'; }
    // dead ends (one tunnel) that are neither: chests go there
    for (const q of rooms) if (q.role === 'room' && q.links.length === 1) q.deadEnd = true;
    // little side caves on the rooms (the walls are less round)
    const nooks = [];
    for (const q of rooms) for (let k = 0, m = Math.floor(R() * 3); k < m; k++) {
      const a = R() * TAU, r = 80 + R() * 70;
      nooks.push({ x: q.x + Math.cos(a) * q.rx * 0.92, y: q.y + Math.sin(a) * q.ry * 0.92, r, pts: blob(q.x + Math.cos(a) * q.rx * 0.92, q.y + Math.sin(a) * q.ry * 0.92, r, r * 0.7, def.seed * 7 + q.i * 3 + k, 0.5) });
    }
    return { rooms, tunnels, deep, nooks };
  }

  // ---------------- one try at a floor (null when something can't be walked to) ----------------
  function attempt(def, seed, force) {
    const D = def.dungeon, T = THEMES[D.theme] || THEMES.cave, W = def.W, H = def.H;
    const R = NC.rng(seed * 7919 + 17);
    const L = layout(Object.assign({}, def, { seed }), R);
    const gw = Math.ceil(W * GS), gh = Math.ceil(H * GS);
    const mkCanvas = () => { const c = document.createElement('canvas'); c.width = gw; c.height = gh; return c; };

    // the floor mask: rooms, nooks, tunnels (discs stamped along each one, a wobbly edge)
    const maskCv = mkCanvas(), m = maskCv.getContext('2d', { willReadFrequently: true });
    m.scale(GS, GS); m.fillStyle = '#fff';
    for (const q of L.rooms) { trace(m, q.pts); m.fill(); }
    for (const q of L.nooks) { trace(m, q.pts); m.fill(); }
    L.tunnels.forEach((t, ti) => {
      m.beginPath();
      let acc = 0;
      for (let i = 0; i < t.pts.length - 1; i++) {
        const [ax, ay] = t.pts[i], [bx, by] = t.pts[i + 1], len = Math.hypot(bx - ax, by - ay);
        for (let s = 0; s < len; s += 12) {
          const x = ax + ((bx - ax) * s) / len, y = ay + ((by - ay) * s) / len;
          const rad = (t.w / 2) * (0.82 + 0.36 * NC.noise((acc + s) / 90, ti * 3.7, seed + 5));
          m.moveTo(x + rad, y); m.arc(x, y, rad, 0, TAU);
        }
        acc += len;
      }
      m.fill();
    });
    // pools (lava / water): blobs in some rooms, never the entrance or the boss's
    const pools = [];
    if (D.pools) for (const q of L.rooms) {
      if (q.role !== 'room' || R() > D.pools) continue;
      const a = R() * TAU, k = 0.25 + R() * 0.3, rx = q.rx * (0.28 + R() * 0.14), ry = rx * 0.55;
      const x = q.x + Math.cos(a) * q.rx * k, y = q.y + Math.sin(a) * q.ry * k;
      pools.push({ x, y, rx, ry, pts: blob(x, y, rx, ry, seed * 3 + q.i, 0.45) });
    }
    const poolCv = mkCanvas(), pm = poolCv.getContext('2d', { willReadFrequently: true });
    pm.scale(GS, GS); pm.fillStyle = '#fff';
    for (const p of pools) { trace(pm, p.pts); pm.fill(); }
    const mdat = m.getImageData(0, 0, gw, gh).data, pdat = pm.getImageData(0, 0, gw, gh).data;
    const floorPx = new Uint8Array(gw * gh), poolPx = new Uint8Array(gw * gh);
    for (let i = 0; i < gw * gh; i++) { floorPx[i] = mdat[i * 4] > 127 ? 1 : 0; poolPx[i] = floorPx[i] && pdat[i * 4] > 127 ? 1 : 0; }
    const isFloor = (x, y) => { const i = Math.floor(x * GS), j = Math.floor(y * GS); return i >= 0 && j >= 0 && i < gw && j < gh && floorPx[j * gw + i] === 1; };

    // ---------- collision: the rock, the cliff face along the rock's south edge, pools, the border ----------
    const GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL), solid = new Uint8Array(GW * GH);
    for (let gx = 0; gx < GW; gx++) {
      let run = 0;
      for (let gy = 0; gy < GH; gy++) {
        const x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2, k = gy * GW + gx;
        if (!isFloor(x, y)) { solid[k] = 1; run = 0; continue; }
        run++;
        if (run * CELL <= FACE) solid[k] = 1;
        const i = Math.floor(x * GS), j = Math.floor(y * GS);
        if (poolPx[j * gw + i]) solid[k] = 1;
      }
    }
    // js/passprops.js: what stood each solid cell up (as in fieldgen.js: 0 = hard, the walls and pools above too)
    const own = new Uint8Array(GW * GH);
    let soft = 0;
    const put = (k) => { own[k] = soft ? (solid[k] ? own[k] & soft : soft) : 0; solid[k] = 1; };
    const markRect = (x0, y0, x1, y1) => {
      for (let gy = Math.max(0, Math.floor(y0 / CELL)); gy < Math.min(GH, Math.ceil(y1 / CELL)); gy++)
        for (let gx = Math.max(0, Math.floor(x0 / CELL)); gx < Math.min(GW, Math.ceil(x1 / CELL)); gx++) put(gy * GW + gx);
    };
    const markEllipse = (cx, cy, rx, ry) => {
      for (let gy = Math.floor((cy - ry) / CELL); gy <= (cy + ry) / CELL; gy++)
        for (let gx = Math.floor((cx - rx) / CELL); gx <= (cx + rx) / CELL; gx++) {
          if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
          const nx = (gx * CELL + CELL / 2 - cx) / rx, ny = (gy * CELL + CELL / 2 - cy) / ry;
          if (nx * nx + ny * ny <= 1) put(gy * GW + gx);
        }
    };
    markRect(0, 0, W, 40); markRect(0, H - 40, W, H); markRect(0, 0, 40, H); markRect(W - 40, 0, W, H);
    const terrainSolid = solid.slice();
    const isSolid = (x, y) => {
      const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
      return gx < 0 || gy < 0 || gx >= GW || gy >= GH || solid[gy * GW + gx] === 1;
    };
    const fits = (x, y, r) => {
      if (isSolid(x, y)) return false;
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; if (isSolid(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6)) return false; }
      return true;
    };
    // the nearest open spot to a wished-for point (a spiral outwards)
    const nearOpen = (x, y, r) => {
      for (let d = 0; d < 600; d += 12)
        for (let k = 0, n = Math.max(1, Math.floor(d / 10)); k < n; k++) {
          const a = (k / n) * TAU, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.7;
          if (fits(px, py, r)) return [Math.round(px), Math.round(py)];
        }
      return null;
    };
    const tunnelDist = (x, y) => {
      let d = Infinity;
      for (const t of L.tunnels) for (let i = 0; i < t.pts.length - 1; i++) d = Math.min(d, segDist(x, y, t.pts[i][0], t.pts[i][1], t.pts[i + 1][0], t.pts[i + 1][1]) - t.w / 2);
      return d;
    };

    // ---------- props ----------
    const props = [], lights = [], occ = [];
    const free = (x, y, r) => occ.every(([ox, oy, or]) => Math.hypot(ox - x, (oy - y) * 1.5) >= r + or);
    const addProp = (name, x, y, o) => {
      o = o || {};
      const s = NC.SPR[name], P = NC.FIELD_PROPS[name] || { kind: 'low' };
      if (!s) return null;
      const scale = o.scale || 1, flip = !!o.flip, w = s.w * scale, h = s.h * scale;
      const p = { kind: 'prop', name, x, y, scale, flip, sort: y };
      // a prop the floor clears (D.clear: [name, x, y]) keeps its spot and its draws of R, so the rest of the floor is
      // the same, but stands nowhere: no collision, not drawn (lavavent1: two obsidians squeezed its only way down)
      const cleared = (D.clear || []).some(([n, cx, cy]) => n === name && Math.hypot(x - cx, y - cy) < 2);
      const walkThrough = NC.propIsWalkThrough(name, P.kind, scale);
      soft = NC.softProp ? NC.softProp(name, P, scale) : 0; // (js/passprops.js)
      if (!cleared) switch (P.kind) {
        case 'tree': markEllipse(x, y - w * 0.014, w * 0.085, w * 0.045); p.shadow = [w * 0.2, w * 0.055]; break;
        case 'house': markRect(x - (w * P.rect[0]) / 2, y - P.rect[1], x + (w * P.rect[0]) / 2, y - 4); p.shadow = [w * 0.46, 26]; break;
        case 'tall': if (!walkThrough) markEllipse(x, y - 6, w * 0.16, w * 0.07); p.shadow = [w * 0.3, w * 0.08]; break;
        case 'rock': if (!walkThrough) markEllipse(x, y - h * 0.08, w * 0.34, Math.min(h * 0.2, w * 0.15)); p.shadow = [w * 0.42, w * 0.11]; break;
        case 'bush': if (!walkThrough) markEllipse(x, y - 6, w * 0.26, w * 0.11); p.shadow = [w * 0.4, w * 0.1]; break;
        case 'post': if (!walkThrough) markEllipse(x, y - 4, 16, 9); p.shadow = [20, 7]; break;
        case 'fence': markRect(x - w * 0.47, y - 24, x + w * 0.47, y - 2); break;
        default: if (h > 70) p.shadow = [w * 0.3, 7];
      }
      soft = 0;
      if (p.shadow) p.shadow = [p.shadow[0] / scale, p.shadow[1] / scale];
      if (P.kind === 'tall' || P.kind === 'tree') p.canopy = { x0: x - w * 0.45, x1: x + w * 0.45, y0: y - h, y1: y - h * 0.3 };
      if (P.sway) p.sway = R() * 6;
      if (P.light) { const l = { x: x + P.light[0] * w * (flip ? -1 : 1), y: y + P.light[1] * h, r: P.light[2] * Math.sqrt(scale), rgb: P.light[3], flick: R() * 10, owner: p }; if (!cleared) lights.push(l); }
      if (!cleared) props.push(p);
      occ.push([x, y, o.r || (P.kind === 'low' ? 24 : P.kind === 'house' ? w * 0.4 : Math.max(40, w * 0.3))]);
      return p;
    };

    // the way up (at the entrance room's north wall), the way down / the boss (the deepest room)
    const entrance = L.rooms[0], deep = L.deep;
    const wallAbove = (q) => { // the open floor just under a room's north wall, near its middle
      for (let y = q.y - q.ry; y < q.y + q.ry * 0.3; y += 10) if (fits(q.x, y, 60)) return [Math.round(q.x), Math.round(y + 30)];
      return nearOpen(q.x, q.y, 60);
    };
    const warps = (def.warps || []).map((w0) => {
      const w = Object.assign({}, w0);
      let at = null;
      if (w.place === 'entrance') at = wallAbove(entrance);
      else if (w.place === 'deep') at = nearOpen(deep.x, deep.y - deep.ry * 0.1, 70);
      else if (w.place === 'secret') at = null; // (dungeons.js opens it at runtime)
      if (!at) return null;
      [w.x, w.y] = at;
      const arrive = nearOpen(w.x, w.y + 150, 26) || [w.x, w.y + 120];
      [w.ax, w.ay] = arrive;
      return w;
    }).filter(Boolean);
    for (const w of warps) {
      // the stairs under the warp (drawn at the warp's feet); nothing else stands near it
      if (w.place === 'entrance' && NC.SPR.d_stairs_up) addProp('d_stairs_up', w.x, w.y - 26, { r: 110 });
      if (w.place === 'deep' && NC.SPR.d_stairs_down) addProp('d_stairs_down', w.x, w.y + 20, { r: 110 });
      occ.push([w.x, w.y, 190]);
    }
    const nearWarp = (x, y, d) => warps.some((w) => Math.hypot(x - w.x, (y - w.y) * 1.3) < d);
    // the boss's spot, the chests, the traps
    const bossAt = D.boss ? nearOpen(deep.x, deep.y, 90) : null;
    if (bossAt) occ.push([bossAt[0], bossAt[1], 260]);
    const chestSpots = [];
    const deadEnds = shuffle(R, L.rooms.filter((q) => q.deadEnd));
    for (const q of deadEnds.slice(0, D.chests || 0)) {
      const at = nearOpen(q.x + (R() - 0.5) * q.rx * 0.5, q.y - q.ry * 0.25, 50);
      if (at) { chestSpots.push(at); occ.push([at[0], at[1], 90]); }
    }
    if (D.boss && bossAt && D.bossChest) { // the golden chest behind the boss
      const at = nearOpen(bossAt[0], bossAt[1] - 150, 50);
      if (at) { chestSpots.push([at[0], at[1], 'gold']); occ.push([at[0], at[1], 90]); }
    }
    const traps = [];
    const tunnels = shuffle(R, L.tunnels.slice());
    for (const t of tunnels) {
      if (traps.length >= (D.traps || 0)) break;
      const [x, y] = t.pts[12];
      if (!fits(x, y, 60) || nearWarp(x, y, 400) || L.rooms.some((q) => inRoom(q, x, y, 1.1))) continue;
      traps.push({ x: Math.round(x), y: Math.round(y), w: 104, h: 64, t: R() * 3, ph: 0 });
      occ.push([x, y, 90]);
    }
    // the theme's special things: the lost explorer's camp by the entrance, landmarks in the biggest rooms
    if (T.entrance) { const at = nearOpen(entrance.x - entrance.rx * 0.45, entrance.y + entrance.ry * 0.2, 60); if (at) addProp(T.entrance, at[0], at[1], { flip: R() < 0.5 }); }
    if (T.special) {
      const big = L.rooms.filter((q) => q.role === 'room').sort((a, b) => b.rx - a.rx);
      T.special.forEach((name, k) => { const q = big[k]; if (!q) return; const at = nearOpen(q.x + (R() - 0.5) * q.rx * 0.4, q.y - q.ry * 0.3, 110); if (at && free(at[0], at[1], 120)) addProp(name, at[0], at[1], { flip: R() < 0.5 }); });
    }
    // along the walls of the rooms: big things, and a light every so often
    const wallFoot = [];
    for (let gy = 2; gy < GH - 2; gy++)
      for (let gx = 2; gx < GW - 2; gx++) {
        if (solid[gy * GW + gx]) continue;
        const x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2;
        if (!(solid[(gy - 3) * GW + gx] || solid[gy * GW + gx - 3] || solid[gy * GW + gx + 3])) continue;
        if ((gx * 7 + gy * 13) % 5) continue; // (a sample of them)
        wallFoot.push([x, y]);
      }
    for (let i = wallFoot.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [wallFoot[i], wallFoot[j]] = [wallFoot[j], wallFoot[i]]; }
    let lastGlow = [];
    for (const [x0, y0] of wallFoot) {
      const q = L.rooms.find((r) => inRoom(r, x0, y0, 1.08));
      const x = x0, y = y0 + 16;
      if (nearWarp(x, y, 260) || (bossAt && Math.hypot(x - bossAt[0], y - bossAt[1]) < 320)) continue;
      const wantLight = T.glow && !lastGlow.some(([lx, ly]) => Math.hypot(lx - x, ly - y) < (T.glowEvery || 500));
      if (wantLight && free(x, y, 50) && fits(x, y, 20)) {
        const name = q || R() < 0.5 ? pickW(R, T.glow) : (T.torch || pickW(R, T.glow));
        if (addProp(name, x, y, { flip: R() < 0.5, scale: 0.85 + R() * 0.25, r: 50 })) { lastGlow.push([x, y]); continue; }
      }
      if (!q || R() > 0.45 || !free(x, y, 70) || !fits(x, y, 40)) continue;
      addProp(pickW(R, T.wall), x, y, { flip: R() < 0.5, scale: 0.8 + R() * 0.35 });
    }
    // in the rooms: a few big things away from the walls and the middle, low things anywhere
    for (const q of L.rooms) {
      if (q.role === 'boss') continue;
      for (let k = 0, made = 0; k < 30 && made < 2 + Math.floor(q.rx / 180); k++) {
        const a = R() * TAU, rr = 0.35 + R() * 0.45, x = Math.round(q.x + Math.cos(a) * q.rx * rr), y = Math.round(q.y + Math.sin(a) * q.ry * rr);
        if (!fits(x, y, 110) || !free(x, y, 90) || nearWarp(x, y, 300) || tunnelDist(x, y) < 40) continue;
        addProp(pickW(R, T.big), x, y, { flip: R() < 0.5, scale: 0.8 + R() * 0.3 });
        made++;
      }
    }
    for (let k = 0, made = 0; k < 400 && made < Math.round((W * H) / 1e6 * 5); k++) {
      const x = 80 + R() * (W - 160), y = 80 + R() * (H - 160);
      if (!fits(x, y, 26) || !free(x, y, 30) || nearWarp(x, y, 200)) continue;
      addProp(pickW(R, T.low), Math.round(x), Math.round(y), { flip: R() < 0.5, scale: 0.8 + R() * 0.4, r: 20 });
      made++;
    }

    // ---------- can everything be walked to? (the hero's size on the collision grid) ----------
    const start = warps.find((w) => w.place === 'entrance') || { ax: entrance.x, ay: entrance.y };
    const seen = new Uint8Array(GW * GH), stack = [];
    const open = (gx, gy) => gx > 0 && gy > 0 && gx < GW - 1 && gy < GH - 1 && fits(gx * CELL + CELL / 2, gy * CELL + CELL / 2, 20);
    const sx = Math.floor(start.ax / CELL), sy = Math.floor(start.ay / CELL);
    if (open(sx, sy)) { seen[sy * GW + sx] = 1; stack.push(sx, sy); }
    while (stack.length) {
      const gy = stack.pop(), gx = stack.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = gx + dx, ny = gy + dy, k = ny * GW + nx;
        if (seen[k] || !open(nx, ny)) continue;
        seen[k] = 1; stack.push(nx, ny);
      }
    }
    const reach = (x, y) => {
      const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (seen[(gy + j) * GW + gx + i]) return true;
      return false;
    };
    const must = [...warps.map((w) => [w.x, w.y]), ...chestSpots, ...(bossAt ? [bossAt] : [])];
    if (!force && (!seen[sy * GW + sx] || must.some(([x, y]) => !reach(x, y)))) return null;

    // ---------- monsters: in the rooms (not the entrance, not the boss's), fewer in the tunnels ----------
    const spawns = [], mult = NC.MOB_MULT || 1, gap = 230 / Math.sqrt(mult);
    const wants = [];
    for (const [type, n0] of def.spawns || []) for (let i = 0, c = Math.round(n0 * mult); i < c; i++) wants.push([type, i / c]);
    wants.sort((a, b) => a[1] - b[1]); // (the kinds take turns: each gets its share when the floor fills up)
    for (const [type] of wants) {
      const count = 1;
      for (let n = 0, made = 0; n < 50 && made < count; n++) {
        const x = Math.round(120 + R() * (W - 240)), y = Math.round(120 + R() * (H - 240));
        if (!fits(x, y, 34) || !reach(x, y) || nearWarp(x, y, 480) || inRoom(entrance, x, y, 1.15)) continue;
        if (D.boss && inRoom(deep, x, y, 1.1)) continue;
        if (!L.rooms.some((q) => inRoom(q, x, y)) && R() < 0.6) continue; // (the tunnels get fewer)
        if (traps.some((t) => Math.hypot(t.x - x, t.y - y) < 160) || chestSpots.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 160)) continue;
        if (spawns.some((s) => Math.hypot(s[1] - x, s[2] - y) < gap)) continue;
        spawns.push([type, x, y]); made++;
      }
    }
    for (const [type] of def.bosses || []) if (bossAt) spawns.push([type, bossAt[0], bossAt[1]]);
    for (const [x, y, kind] of chestSpots) spawns.push([kind === 'gold' ? 'chest_gold' : D.chest || 'chest_wood', x, y]);

    // ---------- the ground: one painting (a dungeon is always night: the lighting does the rest) ----------
    const ground = mkCanvas(), G = ground.getContext('2d'), img = G.createImageData(gw, gh), px = img.data;
    const FP = FACE * GS;
    // per pixel: rows of the face under the rock, rows of rock above the floor, the distance to the rock sideways
    const faceRun = new Uint16Array(gw * gh), rockDown = new Uint16Array(gw * gh), below = new Uint16Array(gw * gh), side = new Uint16Array(gw * gh);
    for (let i = 0; i < gw; i++) {
      let run = 999;
      for (let j = 0; j < gh; j++) { const k = j * gw + i; if (!floorPx[k]) run = 0; else run = Math.min(999, run + 1); faceRun[k] = run; }
      let rock = 999, flo = 999; // (rock rows down to the floor, floor rows down to the rock)
      for (let j = gh - 1; j >= 0; j--) {
        const k = j * gw + i;
        if (floorPx[k]) { rock = 0; flo = Math.min(999, flo + 1); } else { flo = 0; rock = Math.min(999, rock + 1); }
        rockDown[k] = rock; below[k] = flo;
      }
    }
    for (let j = 0; j < gh; j++) {
      let run = 999;
      for (let i = 0; i < gw; i++) { const k = j * gw + i; run = floorPx[k] ? Math.min(999, run + 1) : 0; side[k] = run; }
      run = 999;
      for (let i = gw - 1; i >= 0; i--) { const k = j * gw + i; run = floorPx[k] ? Math.min(999, run + 1) : 0; side[k] = Math.min(side[k], run); }
    }
    const blurCv = mkCanvas(), bc = blurCv.getContext('2d');
    bc.filter = 'blur(9px)'; bc.drawImage(maskCv, 0, 0); bc.filter = 'none';
    const bdat = bc.getImageData(0, 0, gw, gh).data;
    const O = [42, 36, 53], S = seed * 5 + 3;
    for (let j = 0; j < gh; j++) {
      const y = j / GS;
      for (let i = 0; i < gw; i++) {
        const k = j * gw + i, x = i / GS, o = k * 4;
        let c;
        if (floorPx[k] && poolPx[k] && T.pool) { // a pool: bright in the middle, a dark crust at its edge
          const n = NC.noise(x / 60, y / 60, S + 9);
          c = mix(T.pool.c2, T.pool.c1, NC.clamp(n * 1.4 - 0.2, 0, 1));
        } else if (floorPx[k] && faceRun[k] <= FP) { // the cliff face under the rock
          const t = faceRun[k] / FP, stri = NC.noise(x / 9, y / 70, S + 11) - 0.5;
          c = mix(T.face[0], T.face[1], t);
          c = [c[0] + stri * 26, c[1] + stri * 24, c[2] + stri * 22];
          if (NC.noise(x / 40, y / 14, S + 12) > 0.72) c = mix(c, T.face[1], 0.35); // strata
          if (faceRun[k] <= 2) c = mix(c, [255, 255, 255], 0.22); // the lit top edge
          if (faceRun[k] >= FP - 2.5) c = O; // the foot of the cliff
        } else if (floorPx[k]) { // the floor: patches, darker by the walls
          const n = NC.fbm(x / 420, y / 420, S + 1, 2), v = (NC.fbm(x / 60, y / 60, S + 2, 2) - 0.5) * 18;
          c = mix(T.floor, T.floor2, NC.clamp((n - 0.42) / 0.2, 0, 1));
          const ao = NC.clamp((1 - bdat[k * 4] / 255) * 1.7, 0, 1) * 0.42; // (darker by the walls)
          c = [c[0] * (1 - ao) + v, c[1] * (1 - ao) + v, c[2] * (1 - ao) + v];
          if (side[k] <= 2 || below[k] <= 2) c = O; // the rock's edge beside and below the floor
        } else { // the rock mass: a rim over the floor below, darker further in
          const n = NC.fbm(x / 110, y / 110, S + 4, 3), edge = NC.clamp((bdat[k * 4] / 255) * 2.4, 0, 1);
          c = mix(T.rock, T.rock2, NC.clamp(edge * 0.9 + (n - 0.5) * 0.6, 0, 1));
          if (NC.noise(x / 26, y / 26, S + 6) > 0.78) c = mix(c, T.rock2, 0.35); // (a few lighter stones)
          if (rockDown[k] <= 2) c = O; // the outline over the floor
        }
        px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
      }
    }
    G.putImageData(img, 0, 0);
    // the walkable floor as a mask (for details that must stay on the floor, not climb the cliffs)
    const walkCv = mkCanvas(), wc = walkCv.getContext('2d'), wimg = wc.createImageData(gw, gh);
    for (let k = 0; k < gw * gh; k++) if (floorPx[k] && !poolPx[k] && faceRun[k] > FP + 1) wimg.data[k * 4 + 3] = 255;
    wc.putImageData(wimg, 0, 0);
    const detail = mkCanvas(), dc = detail.getContext('2d');
    dc.scale(GS, GS); dc.lineCap = 'round'; dc.lineJoin = 'round';
    const Rg = NC.rng(seed * 31 + 7);
    // crypt: worn flagstones
    if (T.tiles) {
      dc.strokeStyle = 'rgba(42,36,53,0.28)'; dc.lineWidth = 4;
      for (let y = 0, row = 0; y < H; y += 96, row++) {
        dc.beginPath(); dc.moveTo(0, y); dc.lineTo(W, y); dc.stroke();
        for (let x = (row % 2) * 70; x < W; x += 140 + Math.floor(Rg() * 20)) { dc.beginPath(); dc.moveTo(x, y); dc.lineTo(x, y + 96); dc.stroke(); }
      }
      dc.fillStyle = 'rgba(255,255,255,0.05)';
      for (let n = 0; n < (W * H) / 40000; n++) dc.fillRect(Math.floor(Rg() * W / 140) * 140 + 6, Math.floor(Rg() * H / 96) * 96 + 6, 120, 80);
    }
    // mine: rails down a couple of the tunnels
    for (const t of L.tunnels.slice(0, T.rails || 0)) {
      for (const off of [-18, 18]) {
        dc.strokeStyle = 'rgba(42,36,53,0.8)'; dc.lineWidth = 7;
        dc.beginPath();
        t.pts.forEach(([x, y], i) => {
          const q = t.pts[Math.min(t.pts.length - 1, i + 1)], p0 = t.pts[Math.max(0, i - 1)], dx = q[0] - p0[0], dy = q[1] - p0[1], l = Math.hypot(dx, dy) || 1;
          const X = x - (dy / l) * off, Y = y + (dx / l) * off;
          i ? dc.lineTo(X, Y) : dc.moveTo(X, Y);
        });
        dc.stroke();
      }
      dc.strokeStyle = 'rgba(96,66,44,0.9)'; dc.lineWidth = 9;
      for (let i = 1; i < t.pts.length - 1; i++) {
        const [x, y] = t.pts[i], q = t.pts[i + 1], dx = q[0] - x, dy = q[1] - y, l = Math.hypot(dx, dy) || 1;
        for (let s = 0; s < l; s += 34) {
          const X = x + (dx * s) / l, Y = y + (dy * s) / l;
          dc.beginPath(); dc.moveTo(X - (dy / l) * 28, Y + (dx / l) * 28); dc.lineTo(X + (dy / l) * 28, Y - (dx / l) * 28); dc.stroke();
        }
      }
    }
    // pebbles and specks, cracks (glowing in the lava vent)
    for (let n = 0; n < (W * H) / 5000; n++) {
      const x = Rg() * W, y = Rg() * H;
      dc.fillStyle = T.specks[Math.floor(Rg() * T.specks.length)];
      dc.beginPath(); dc.ellipse(x, y, 3 + Rg() * 5, 2 + Rg() * 3, Rg() * 3, 0, TAU); dc.fill();
    }
    for (let n = 0; n < (T.cracks || 0) * (W * H) / 1e7; n++) {
      let x = Rg() * W, y = Rg() * H;
      dc.strokeStyle = T.glowCracks ? 'rgba(255,120,50,0.8)' : 'rgba(42,36,53,0.45)'; dc.lineWidth = T.glowCracks ? 4 : 3;
      dc.beginPath(); dc.moveTo(x, y);
      for (let s = 0; s < 5; s++) { x += 14 + Rg() * 24; y += (Rg() - 0.5) * 30; dc.lineTo(x, y); }
      dc.stroke();
    }
    dc.setTransform(1, 0, 0, 1, 0, 0);
    dc.globalCompositeOperation = 'destination-in';
    dc.drawImage(walkCv, 0, 0);
    G.drawImage(detail, 0, 0);
    // pools: ripples and their crust
    if (pools.length && T.pool) {
      G.save(); G.scale(GS, GS);
      for (const p of pools) {
        G.strokeStyle = `rgb(${T.pool.edge})`; G.lineWidth = 16; trace(G, p.pts); G.stroke();
        G.strokeStyle = 'rgba(42,36,53,0.9)'; G.lineWidth = 6; trace(G, p.pts); G.stroke();
        G.strokeStyle = 'rgba(255,240,180,0.55)'; G.lineWidth = 5;
        for (let s = 0; s < 6; s++) {
          const a = Rg() * TAU, rr = Rg() * 0.55, x = p.x + Math.cos(a) * p.rx * rr, y = p.y + Math.sin(a) * p.ry * rr, w = 20 + Rg() * 28;
          G.beginPath(); G.moveTo(x - w / 2, y); G.quadraticCurveTo(x, y - 6, x + w / 2, y); G.stroke();
        }
        lights.push({ x: p.x, y: p.y - 120, r: Math.max(p.rx, p.ry) * 1.5, rgb: T.pool.glow, flick: Rg() * 10, owner: p });
      }
      G.restore();
    }

    // ---------- the minimap canvas (1 px = 10 units) ----------
    const mm = document.createElement('canvas');
    mm.width = Math.ceil(W / 10); mm.height = Math.ceil(H / 10);
    mm.getContext('2d').drawImage(ground, 0, 0, mm.width, mm.height);

    const zoneOf = (q, name) => ({ name, test: (x, y) => inRoom(q, x, y, 1.15) });
    const world = {
      W, H, ground, groundDay: ground, GS, props, decals: [], blocks: [], blockH: 0, lights, solid, terrainSolid, solidOwn: own, GW, GH, CELL, minimap: mm,
      portals: [], warps, spawns, field: def.id, dungeon: def.dungeon, theme: D.theme, traps, rooms: L.rooms,
      ...(def.secret ? { bots: [] } : {}), // (nobody else has found a secret floor: no adventurers there)
      dusk: 1, ambient: () => T.ambient, heroLight: T.light,
      zones: [
        zoneOf(entrance, 'ทางเข้า'),
        ...(D.boss ? [zoneOf(deep, 'ห้องบอส')] : []),
        { name: def.name, lv: def.lv, test: () => true },
      ],
      isSolid(x, y) { return isSolid(x, y); },
      fits(x, y, r) { return fits(x, y, r); },
      spawn: start.ax !== undefined ? { x: start.ax, y: start.ay } : { x: entrance.x, y: entrance.y },
      secretSpot: (() => { // a dead end far from the way in: where a hidden way may open (dungeons.js)
        const q = L.rooms.filter((r) => r.role === 'room').sort((a, b) => Math.hypot(b.x - entrance.x, b.y - entrance.y) - Math.hypot(a.x - entrance.x, a.y - entrance.y))[0];
        return q ? nearOpen(q.x, q.y, 60) : null;
      })(),
    };
    if (NC.passProps) NC.passProps(world); // js/passprops.js: shots past rocks and trees, the hero walks round them
    return world;
  }

  NC.buildDungeon = function (def) {
    for (let k = 0; k < 8; k++) { const w = attempt(def, (def.seed || 1) + k * 1013, false); if (w) return w; }
    return attempt(def, def.seed || 1, true);
  };

  const baseField = NC.buildField;
  NC.buildField = function (def) {
    if (def && def.dungeon) return NC.buildDungeon(def);
    return baseField.apply(this, arguments);
  };
})();
