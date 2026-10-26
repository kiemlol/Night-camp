/* roadclear.js — nothing stands in the way on a field's roads (2026-10-18, the user: "บางจุดในแมพ ลองเช็ค object บางอันดู
   มันเดินติด ขวางทางเดิน").
   A walk over all 162 maps found the road blocked in about 120 places: hand-placed landmarks on the road (a wagon, a
   plough, a fallen tent, a log, the moon stone), fences, ditches and trestles laid across it, scattered rocks whose foot
   reached onto it, arches you could not walk through, the new sections' roads running into their lakes, a road over a
   plateau, and salt's way east standing in the sea. This file is NC.buildField's outermost wrapper (load it after every
   field file and every other wrapper of NC.buildField); before fieldgen.js builds a field it
     1. slides a warp on the map's edge that stands in water or on a plateau along that edge to dry ground (its road too);
     2. leads a road that runs through water or over a plateau round it (a path on a 40-unit grid, then straightened);
        a road that ends at a shore stays (a road down to the lake);
     3. moves a hand-placed landmark that stands on a road to the roadside, the shortest step that clears every road
        (buildings, fountains and the doors at the warps stay where they are);
     4. hands fieldgen def.roadGuard: a scattered prop or a fence piece whose foot would reach onto a road is left out
        (fieldgen keeps its place taken, so the rest of the map comes out the same; a fence gets a gap where the road goes).
   Arches, gates and bridges stand on their legs (NC.FIELD_PROPS[name].legs, read by fieldgen.js): you walk through an
   arch and over the planks of a boardwalk. The guild war's lands (one fair layout), the PvP lake, dungeons and the
   towers are left as they are.
   ?roadclear=0 = the maps as before. NC.RoadClear.log[mapId] says what moved; NC.RoadClear.audit(mapId) lists what still
   stands on a road or cannot be reached (testing). */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC.buildField || !NC.FIELD_PROPS) return;
  const OFF = false;
  const FP = NC.FIELD_PROPS, FACE = 90;
  const RC = (NC.RoadClear = { off: OFF, log: {} });

  // ---------------- arches, gates and bridges: their legs (offset from the middle, half width; parts of the width) ----------------
  const LEGS = {
    cd_arch: [[-0.33, 0.08], [0.33, 0.08]], ch_arch: [[-0.33, 0.11], [0.34, 0.1]], mh_arch: [[-0.38, 0.07], [0.38, 0.07]],
    r1_arch: [[-0.3, 0.1], [0.3, 0.1]], qd_arch: [[-0.3, 0.08], [0.3, 0.08]], yk_arch: [[-0.37, 0.07], [0.37, 0.07]],
    ym_gate: [[-0.3, 0.12], [0.3, 0.12]], qi_shadowgate: [[-0.35, 0.1], [0.35, 0.1]], og_gate: [[-0.38, 0.08], [0.38, 0.08]],
    gw_rootarch: [[-0.38, 0.1], [0.38, 0.1]], qh_rootarch: [[-0.38, 0.1], [0.38, 0.1]], bc_bridge: [[-0.42, 0.06], [0.42, 0.06]],
    ra_trestle: [[-0.42, 0.05], [0.42, 0.05]],
    // planks on the ground: walked over
    sd_bridge: [], yv_bridge: [], sh_walkway: [], qc_boardwalk: [], fr_bridge: [], yj_pier: [],
  };
  if (!OFF) for (const [n, L] of Object.entries(LEGS)) if (FP[n]) FP[n].legs = L;
  const KEEP = /fountain/; // (the middle of a square: the roads go round it)

  // ---------------- geometry (as fieldgen.js draws it) ----------------
  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
  };
  const inPoly = (pts, x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const curvePoints = (pts) => {
    const out = [pts[0]];
    let px = pts[0][0], py = pts[0][1];
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      for (let s = 1; s <= 8; s++) {
        const t = s / 8, u = 1 - t;
        out.push([u * u * px + 2 * u * t * pts[i][0] + t * t * mx, u * u * py + 2 * u * t * pts[i][1] + t * t * my]);
      }
      px = mx; py = my;
    }
    out.push(pts[pts.length - 1]);
    return out;
  };
  const blob = (cx, cy, rx, ry, seed, wob) => {
    const pts = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const k = 1 + (NC.fbm(Math.cos(a) * 1.6 + 7, Math.sin(a) * 1.6 + 7, seed, 3) - 0.5) * (wob || 0.5);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  };
  // along a curve every `step` units
  const samples = (curve, step) => {
    const out = [];
    for (let i = 0; i < curve.length - 1; i++) {
      const [ax, ay] = curve[i], [bx, by] = curve[i + 1], L = Math.hypot(bx - ax, by - ay);
      for (let d = 0; d < L; d += step) out.push([ax + ((bx - ax) * d) / L, ay + ((by - ay) * d) / L]);
    }
    out.push(curve[curve.length - 1]);
    return out;
  };

  // the water and the plateaus of a field, exactly as fieldgen.js lays them (same seeds)
  function terrain(def) {
    const SEED = def.seed || 1;
    const ponds = (def.ponds || []).map((p, i) => {
      const pts = blob(p.x, p.y, p.rx, p.ry, SEED * 31 + i, 0.45);
      return { x: p.x, y: p.y, rx: p.rx, ry: p.ry, pts, solid: pts.map(([x, y]) => [p.x + (x - p.x) * 0.94, p.y + (y - p.y) * 0.94]) }; // (fieldgen: 0.94 of it is solid)
    });
    const mesas = (def.mesas || []).map((m, i) => ({ x: m.x, y: m.y, rx: m.rx, ry: m.ry, pts: blob(m.x, m.y, m.rx, m.ry, SEED * 53 + i, 0.55) }));
    // in the outline, or within pad of its edge (the same margin all round, also along a long lake)
    const near = (o, P, x, y, pad) => {
      if (Math.abs(x - o.x) > o.rx * 1.3 + pad || Math.abs(y - o.y) > o.ry * 1.3 + pad) return false;
      if (inPoly(P, x, y)) return true;
      if (!pad) return false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (segDist(x, y, P[j][0], P[j][1], P[i][0], P[i][1]) < pad) return true;
      return false;
    };
    // the water as drawn (roads keep out of it), or only its solid part (where a hero can stand: a warp)
    const wet = (x, y, pad, solid) => ponds.some((p) => near(p, solid ? p.solid : p.pts, x, y, pad || 0));
    const high = (x, y, pad) => mesas.some((m) => {
      if (y < m.y - m.ry * 1.3 - (pad || 0) || y > m.y + m.ry * 1.3 + FACE + (pad || 0)) return false;
      for (let t = 0; t <= FACE; t += FACE / 4) if (near(m, m.pts, x, y - t, pad || 0)) return true; // (the cliff face below the top)
      return false;
    });
    return { wet, high, blocked: (x, y, pad) => wet(x, y, pad) || high(x, y, pad), stand: (x, y, pad) => !wet(x, y, pad, true) && !high(x, y, pad) };
  }

  // the roads as pieces of their middle lines, in a grid for quick lookups
  function roadIndex(list) {
    const G = 200, cells = new Map();
    for (const r0 of list) {
      const r = { hw: (r0.w || 70) / 2 }, c = curvePoints(r0.pts);
      for (let i = 0; i < c.length - 1; i++) {
        const s = { ax: c[i][0], ay: c[i][1], bx: c[i + 1][0], by: c[i + 1][1], r };
        for (let gy = Math.floor(Math.min(s.ay, s.by) / G); gy <= Math.floor(Math.max(s.ay, s.by) / G); gy++)
          for (let gx = Math.floor(Math.min(s.ax, s.bx) / G); gx <= Math.floor(Math.max(s.ax, s.bx) / G); gx++) {
            const k = gx + ',' + gy;
            if (!cells.has(k)) cells.set(k, []);
            cells.get(k).push(s);
          }
      }
    }
    const near = (x0, y0, x1, y1, pad) => {
      const out = new Set();
      for (let gy = Math.floor((y0 - pad) / G); gy <= Math.floor((y1 + pad) / G); gy++)
        for (let gx = Math.floor((x0 - pad) / G); gx <= Math.floor((x1 + pad) / G); gx++) {
          const L = cells.get(gx + ',' + gy);
          if (L) for (const s of L) out.add(s);
        }
      return out;
    };
    return { near };
  }

  // where a prop stands solid (fieldgen.js addProp's footprints): [{ e: [cx, cy, rx, ry] } | { r: [x0, y0, x1, y1] }]
  function footprint(name, x, y, scale, flip) {
    const s = NC.SPR[name], D = FP[name];
    if (!s || !D) return [];
    const w = s.w * scale, h = s.h * scale;
    if (D.legs) return D.legs.map(([dx, rx]) => ({ e: [x + w * dx * (flip ? -1 : 1), y - 8, w * rx, 14] }));
    switch (D.kind) {
      case 'tree': return [{ e: [x, y - w * 0.014, w * 0.085, w * 0.045] }];
      case 'house': return [{ r: [x - (w * D.rect[0]) / 2, y - D.rect[1], x + (w * D.rect[0]) / 2, y - 4] }];
      case 'tall': return [{ e: [x, y - 6, w * 0.16, w * 0.07] }];
      case 'rock': return [{ e: [x, y - h * 0.08, w * 0.36, Math.min(h * 0.22, w * 0.16)] }];
      case 'bush': return [{ e: [x, y - 6, w * 0.26, w * 0.11] }];
      case 'post': return [{ e: [x, y - 4, 14, 8] }];
      case 'fence': return [{ r: [x - w * 0.47, y - 24, x + w * 0.47, y - 2] }];
    }
    return [];
  }
  // does a road's middle line pass within c of the footprint piece?
  const hitsEllipse = (s, [cx, cy, rx, ry], c) =>
    segDist(0, 0, (s.ax - cx) / (rx + c), (s.ay - cy) / (ry + c), (s.bx - cx) / (rx + c), (s.by - cy) / (ry + c)) < 1;
  const hitsRect = (s, [x0, y0, x1, y1], c) => {
    x0 -= c; y0 -= c; x1 += c; y1 += c;
    const dx = s.bx - s.ax, dy = s.by - s.ay;
    let t0 = 0, t1 = 1;
    for (const [p, q] of [[-dx, s.ax - x0], [dx, x1 - s.ax], [-dy, s.ay - y0], [dy, y1 - s.ay]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  };
  const boxOf = (f) => (f.e ? [f.e[0] - f.e[2], f.e[1] - f.e[3], f.e[0] + f.e[2], f.e[1] + f.e[3]] : f.r);
  // the first road piece that comes within corr(road) of the footprint
  const hits = (fp, idx, corr) => {
    for (const f of fp) {
      const [x0, y0, x1, y1] = boxOf(f);
      for (const s of idx.near(x0, y0, x1, y1, 160)) if (f.e ? hitsEllipse(s, f.e, corr(s.r)) : hitsRect(s, f.r, corr(s.r))) return s;
    }
    return null;
  };
  // how far from a road's middle line a prop's foot must keep: things (most of the road free), fence pieces (all of it),
  // a landmark stepping aside (off the road and a little more)
  const C_THING = (r) => Math.max(26, r.hw * 0.7), C_FENCE = (r) => r.hw + 6, C_ASIDE = (r) => r.hw + 16;

  // ---------------- 1. warps on the edge, in water or on a plateau: slide along the edge ----------------
  function slideWarps(def, T, warps, roads, log) {
    const W = def.W, H = def.H;
    for (const w of warps) {
      const d = { west: w.x, east: W - w.x, north: w.y, south: H - w.y };
      const e = Object.keys(d).reduce((a, b) => (d[a] <= d[b] ? a : b));
      if (d[e] > 260) continue; // (a door inside the map)
      const nx = e === 'west' ? 1 : e === 'east' ? -1 : 0, ny = e === 'north' ? 1 : e === 'south' ? -1 : 0;
      const loose = (x, y) => T.stand(x, y, 30) && T.stand(x + nx * 170, y + ny * 170, 20); // (the warp, and where heroes land by it)
      if (!T.blocked(w.x, w.y, 40) && !T.blocked(w.x + nx * 150, w.y + ny * 150, 0)) continue; // (dry enough where it is)
      const along = nx ? 'y' : 'x', len = nx ? H : W;
      // fields7.js freeEdge's own steps first (the server's export took the first dry one of these: salt's way east at
      // y 3200), then every 100 along the edge
      const offs = [700, -700, 1300, -1300];
      for (let k = 1; k <= 60; k++) offs.push(k * 100, -k * 100);
      let best = null;
      for (const o of offs) {
        const v = w[along] + o;
        if (v < 350 || v > len - 350) continue;
        const x = along === 'x' ? v : w.x, y = along === 'y' ? v : w.y;
        if (warps.some((q) => q !== w && Math.hypot(q.x - x, q.y - y) < 600) || !loose(x, y)) continue;
        best = [x, y];
        break;
      }
      if (!best) continue;
      const ox = w.x, oy = w.y, dx = best[0] - ox, dy = best[1] - oy;
      w.x = best[0]; w.y = best[1];
      // its road comes along: the points by the old warp (off the edge, the warp, the first step in)
      for (const r of roads)
        if (r.pts.some(([x, y]) => x === ox && y === oy)) r.pts = r.pts.map(([x, y]) => (Math.hypot(x - ox, y - oy) < 420 ? [x + dx, y + dy] : [x, y]));
      log.warps.push(`${w.id}->${w.to}: ${ox},${oy} -> ${w.x},${w.y}`);
    }
  }

  // ---------------- 2. roads through water, over a plateau or under a building: round it ----------------
  function reroute(def, T, roads, houses, log) {
    const W = def.W, H = def.H, CG = 40, GW = Math.ceil(W / CG), GH = Math.ceil(H / CG), PAD = 80;
    let grid = null; // 1 = water, plateau or the map's edge; 2 = a building
    const inHouse = (x, y, pad) => houses.some(([x0, y0, x1, y1]) => x > x0 - pad && x < x1 + pad && y > y0 - pad && y < y1 + pad);
    const makeGrid = () => {
      const g = new Uint8Array(GW * GH);
      for (let gy = 0; gy < GH; gy++)
        for (let gx = 0; gx < GW; gx++) {
          const x = gx * CG + CG / 2, y = gy * CG + CG / 2;
          if (x < 100 || x > W - 100 || y < 140 || y > H - 70 || T.blocked(x, y, PAD)) g[gy * GW + gx] = 1;
          else if (inHouse(x, y, 40)) g[gy * GW + gx] = 2;
        }
      return g;
    };
    const edgeNear = ([x, y]) => x < 350 || y < 350 || x > W - 350 || y > H - 350;
    const cellOf = (x, y) => Math.max(0, Math.min(GH - 1, Math.floor(y / CG))) * GW + Math.max(0, Math.min(GW - 1, Math.floor(x / CG)));
    // a wet or high stretch with dry road on both sides of it; a building with road on both sides of it, 300 on one and
    // 100 on the other (a road that ends at a door, or a little way past it, stays)
    const crosses = (pts) => {
      let before = 0, after = 0, kind = null;
      for (const [x, y] of samples(curvePoints(pts), 25)) {
        if (x < 40 || y < 40 || x > W - 40 || y > H - 40) continue;
        const k = T.blocked(x, y, 14) ? 'land' : inHouse(x, y, 22) ? 'house' : null; // (a hero's half size off it)
        if (k) { if (before > 0) { kind = kind === 'land' ? 'land' : k; after = 0; } continue; }
        if (!kind) { before += 25; continue; }
        after += 25;
        if (kind === 'land' || (Math.max(before, after) >= 300 && Math.min(before, after) >= 100)) return true;
      }
      return false;
    };
    // where several roads meet under a building (a section's hub between a barn and a silo): the meeting point steps out
    const ends = [];
    for (const r of roads) for (const k of [0, r.pts.length - 1]) ends.push([r, k]);
    for (const [r, k] of ends) {
      const [x, y] = r.pts[k];
      if (!inHouse(x, y, 30)) continue;
      const same = ends.filter(([r2, k2]) => Math.hypot(r2.pts[k2][0] - x, r2.pts[k2][1] - y) < 5);
      if (same.length < 2) continue; // (one road to a door)
      let to = null;
      for (let d = 20; d <= 600 && !to; d += 20)
        for (let a = 0; a < 16; a++) {
          const px = Math.round(x + Math.cos((a / 16) * Math.PI * 2 + Math.PI / 2) * d), py = Math.round(y + Math.sin((a / 16) * Math.PI * 2 + Math.PI / 2) * d * 0.8);
          if (px > 150 && py > 200 && px < W - 150 && py < H - 120 && !inHouse(px, py, 90) && !T.blocked(px, py, 60)) { to = [px, py]; break; }
        }
      if (!to) continue;
      for (const [r2, k2] of same) r2.pts[k2] = to.slice();
      log.roads.push(`meeting point ${x},${y} -> ${to[0]},${to[1]} (out from a building)`);
    }
    for (const r of roads) {
      if (r.pts.length < 2 || !crosses(r.pts)) continue;
      grid = grid || makeGrid();
      // the ends at the map's edge (off the edge, the warp) stay as they are
      let a = 0, b = r.pts.length - 1;
      while (a + 1 < b && edgeNear(r.pts[a]) && edgeNear(r.pts[a + 1])) a++;
      while (b - 1 > a && edgeNear(r.pts[b]) && edgeNear(r.pts[b - 1])) b--;
      const S = r.pts[a], E = r.pts[b];
      const g = grid.slice(), s = cellOf(S[0], S[1]), t = cellOf(E[0], E[1]);
      for (const c of [s, t]) { // (room round the two ends: off the water's margin, a step out of a building's)
        const cx = c % GW, cy = (c / GW) | 0;
        for (let j = -3; j <= 3; j++)
          for (let i = -3; i <= 3; i++) {
            if (cx + i < 0 || cy + j < 0 || cx + i >= GW || cy + j >= GH) continue;
            const k = (cy + j) * GW + cx + i;
            if (g[k] === 1 || (Math.abs(i) <= 1 && Math.abs(j) <= 1)) g[k] = 0;
          }
      }
      const path = astar(g, GW, GH, s, t);
      if (!path) { log.roads.push(`road ${roads.indexOf(r)}: no way round`); continue; }
      const P = (k) => (k === 0 ? S : k === path.length - 1 ? E : [(path[k] % GW) * CG + CG / 2, ((path[k] / GW) | 0) * CG + CG / 2]);
      const clear = ([ax, ay], [bx, by]) => {
        const L = Math.hypot(bx - ax, by - ay);
        for (let d = 0; d <= L; d += 20) if (g[cellOf(ax + ((bx - ax) * d) / L, ay + ((by - ay) * d) / L)]) return false;
        return true;
      };
      // straightened: from each corner as far along the path as the eye can see
      const way = [];
      for (let i = 0; i < path.length - 1; ) {
        let j = path.length - 1;
        while (j > i + 1 && !clear(P(i), P(j))) j--;
        if (j < path.length - 1) way.push(P(j));
        i = j;
      }
      const head = r.pts.slice(0, a + 1), tail = r.pts.slice(b);
      let pts = head.concat(way, tail);
      if (crosses(pts)) { // (the curve cut a corner into the water: follow the path closer)
        const fine = [];
        for (let k = 3; k < path.length - 2; k += 3) fine.push(P(k));
        pts = head.concat(fine, tail);
      }
      if (crosses(pts)) { log.roads.push(`road ${roads.indexOf(r)}: no clean way round`); continue; }
      r.pts = pts.map((p) => p.map(Math.round));
      log.roads.push(`road ${roads.indexOf(r)}: round (${way.length} bends)`);
    }
  }
  function astar(grid, GW, GH, s, t) {
    const N = GW * GH, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const tx = t % GW, ty = (t / GW) | 0;
    const est = (i) => { const dx = Math.abs((i % GW) - tx), dy = Math.abs(((i / GW) | 0) - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const heap = []; // [f, cell]
    const push = (f, i) => {
      heap.push([f, i]);
      for (let k = heap.length - 1; k > 0; ) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let k = 0; ; ) {
          const l = 2 * k + 1, r = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
        }
      }
      return top[1];
    };
    const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    g[s] = 0; push(est(s), s);
    while (heap.length) {
      const i = pop();
      if (done[i]) continue;
      done[i] = 1;
      if (i === t) break;
      const x = i % GW, y = (i / GW) | 0;
      for (const [dx, dy, c] of STEPS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx;
        if (grid[j] || done[j] || (dx && dy && (grid[y * GW + nx] || grid[ny * GW + x]))) continue;
        if (g[i] + c < g[j]) { g[j] = g[i] + c; from[j] = i; push(g[j] + est(j), j); }
      }
    }
    if (!done[t]) return null;
    const path = [];
    for (let i = t; i !== -1; i = from[i]) path.push(i);
    return path.reverse();
  }

  // ---------------- 3. hand-placed landmarks on a road: to the roadside ----------------
  function stepAside(def, T, idx, list, warps, log) {
    const W = def.W, H = def.H;
    const opt = (o) => [(o && o.scale) || 1, !!(o && o.flip)];
    const room = (name, scale) => {
      const D = FP[name] || {}, s = NC.SPR[name], w = s ? s.w * scale : 100;
      return D.kind === 'house' ? w * 0.42 : D.kind === 'tree' ? 70 * scale : D.kind === 'tall' ? 60 : 38 * scale;
    };
    const taken = list.map(([n, x, y, o]) => [x, y, room(n, opt(o)[0])]);
    const ANG = [0, Math.PI, 0.6, -0.6, Math.PI - 0.6, Math.PI + 0.6, 1.2, -1.2, Math.PI - 1.2, Math.PI + 1.2, Math.PI / 2, -Math.PI / 2];
    const dryFoot = (fp) => fp.every((f) => {
      const [x0, y0, x1, y1] = boxOf(f), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      return [[cx, cy], [x0, cy], [x1, cy], [cx, y0], [cx, y1]].every(([x, y]) => !T.blocked(x, y, 20));
    });
    return list.map((entry, i) => {
      const [name, x, y, o] = entry, D = FP[name], [scale, flip] = opt(o);
      if (!D || !NC.SPR[name] || D.kind === 'house' || KEEP.test(name) || warps.some((w) => Math.hypot(w.x - x, w.y - y) < 380)) return entry;
      const fp = footprint(name, x, y, scale, flip), s = fp.length && hits(fp, idx, C_THING);
      if (!s) return entry;
      // away from the nearest point of that road
      const dx = s.bx - s.ax, dy = s.by - s.ay, L = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / L)), px = s.ax + dx * t, py = s.ay + dy * t;
      const base = Math.hypot(x - px, y - py) > 2 ? Math.atan2(y - py, x - px) : Math.atan2(dx, -dy);
      const me = room(name, scale);
      for (let d = 20; d <= 700; d += 20)
        for (const a of ANG) {
          const nx = Math.round(x + Math.cos(base + a) * d), ny = Math.round(y + Math.sin(base + a) * d * 0.8);
          if (nx < 150 || nx > W - 150 || ny < 220 || ny > H - 80) continue;
          const f2 = footprint(name, nx, ny, scale, flip);
          if (hits(f2, idx, C_ASIDE) || !dryFoot(f2) || warps.some((w) => Math.hypot(w.x - nx, w.y - ny) < 300) ||
            taken.some(([ox, oy, or], k) => k !== i && Math.hypot(ox - nx, (oy - ny) * 1.5) < or + me)) continue;
          taken[i] = [nx, ny, me];
          log.moved.push(`${name} ${x},${y} -> ${nx},${ny}`);
          return [name, nx, ny, o];
        }
      log.dropped.push(`${name} ${x},${y}`);
      return null;
    });
  }

  // ---------------- the field's plan, cleared ----------------
  function prepare(def) {
    const T = terrain(def), log = { warps: [], roads: [], moved: [], dropped: [], guard: [] };
    const warps = (def.warps || []).map((w) => Object.assign({}, w));
    const roads = def.roads.map((r) => Object.assign({}, r, { pts: r.pts.map((p) => p.slice()) }));
    const lms = def.landmarks || [];
    slideWarps(def, T, warps, roads, log);
    const houses = [];
    for (const [name, x, y, o] of lms) if ((FP[name] || {}).kind === 'house') for (const f of footprint(name, x, y, (o && o.scale) || 1, !!(o && o.flip))) if (f.r) houses.push(f.r);
    reroute(def, T, roads, houses, log);
    const idx = roadIndex(roads);
    const placed = stepAside(def, T, idx, lms, warps, log), landmarks = placed.filter(Boolean);
    // a moved centrepiece keeps its crown-free box (fields7.js def.keep) with it
    let keep = def.keep;
    if (keep && log.moved.length) {
      keep = keep.map((b) => b.slice());
      lms.forEach(([name, x, y, o], i) => {
        const now = placed[i], s = NC.SPR[name];
        if (!now || !s || (now[1] === x && now[2] === y)) return;
        const k = (o && o.scale) || 1, w = s.w * k, h = s.h * k;
        const b = keep.find(([x0, y0, x1, y1]) => Math.abs(x0 - (x - w / 2)) < 3 && Math.abs(y1 - y) < 3 && Math.abs(y0 - (y - h)) < 3 && Math.abs(x1 - (x + w / 2)) < 3);
        if (b) { const dx = now[1] - x, dy = now[2] - y; b[0] += dx; b[2] += dx; b[1] += dy; b[3] += dy; }
      });
    }
    const roadGuard = (name, x, y, scale, flip) => {
      const D = FP[name];
      if (!D || D.kind === 'house' || KEEP.test(name)) return false;
      const fp = footprint(name, x, y, scale, flip);
      if (!fp.length || !hits(fp, idx, D.kind === 'fence' ? C_FENCE : C_THING)) return false;
      log.guard.push(`${name} ${x},${y}`);
      return true;
    };
    // (for things the other files set down after fieldgen: life_mine.js's veins) does a foot ellipse reach onto a road?
    const onRoad = (x, y, rx, ry) => !!hits([{ e: [x, y, rx, ry] }], idx, C_THING);
    RC.log[def.id] = log;
    return Object.assign({}, def, { warps, roads, landmarks, keep, roadGuard, onRoad });
  }

  const skip = (def) => !def || def.dungeon || def.root || def.tower || /^(gw_|pvp)/.test(def.id || '') || !(def.roads && def.roads.length);
  RC.applies = (def) => !OFF && !skip(def);
  RC.terrain = terrain; // (testing: RC.terrain(NC.MAPS.salt).blocked(x, y, pad))
  const baseField = NC.buildField;
  NC.buildField = function (def) {
    if (OFF || skip(def)) return baseField.apply(this, arguments);
    let d2;
    try { d2 = prepare(def); } catch (e) { console.warn('roadclear', def.id, e); return baseField.apply(this, arguments); }
    const w = baseField.call(this, d2);
    if (w) w.roadPlan = d2.roads; // (the roads as built, for audit)
    return w;
  };

  // ---------------- testing: what still stands on a road, which warps cannot be reached ----------------
  RC.audit = function (id) {
    const w = NC.Maps.world(id), roads = w.roadPlan || (NC.MAPS[id] || {}).roads || [];
    const S = 10, GW = Math.ceil(w.W / S), GH = Math.ceil(w.H / S), ok = new Uint8Array(GW * GH), seen = new Uint8Array(GW * GH);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) ok[gy * GW + gx] = w.fits(gx * S + 5, gy * S + 5, 20) ? 1 : 0;
    // reach from the spawn
    const sp = w.spawn || { x: w.W / 2, y: w.H / 2 }, q = [];
    for (let r = 0; r < 12 && !q.length; r++)
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        const c = (Math.floor(sp.y / S) + j) * GW + Math.floor(sp.x / S) + i;
        if (c >= 0 && c < GW * GH && ok[c] && !seen[c]) { seen[c] = 1; q.push(c); }
      }
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % GW;
      for (const n of [x < GW - 1 ? c + 1 : -1, x > 0 ? c - 1 : -1, c + GW, c - GW]) if (n >= 0 && n < GW * GH && ok[n] && !seen[n]) { seen[n] = 1; q.push(n); }
    }
    const reach = (x, y, rx, ry) => {
      for (let dy = -ry; dy <= ry; dy += S) for (let dx = -rx; dx <= rx; dx += S) {
        const gx = Math.floor((x + dx) / S), gy = Math.floor((y + dy) / S);
        if ((dx / rx) ** 2 + (dy / ry) ** 2 <= 1 && gx >= 0 && gy >= 0 && gx < GW && gy < GH && seen[gy * GW + gx]) return true;
      }
      return false;
    };
    const unreachable = (w.warps || []).filter((p) => !reach(p.x, p.y, 70, 42)).map((p) => `${p.id}->${p.to} @${p.x},${p.y}`);
    const wet = (x, y) => (w.ponds || []).some((p) => p.pts && inPoly(p.pts, x, y));
    const blocked = [];
    for (const r of roads)
      for (const [x, y] of samples(curvePoints(r.pts), 20)) {
        if (x < 80 || y < 80 || x > w.W - 80 || y > w.H - 80 || w.fits(x, y, 20) || wet(x, y)) continue; // (the edge is solid)
        if (blocked.some((b) => Math.hypot(b.x - x, b.y - y) < 160)) continue;
        const near = w.props.filter((p) => Math.hypot(p.x - x, p.y - y) < 200 && ((FP[p.name] && FP[p.name].kind !== 'low') || p._ore)).map((p) => p.name);
        blocked.push({ x: Math.round(x), y: Math.round(y), near: [...new Set(near)].slice(0, 4) });
      }
    return { id, unreachable, blocked };
  };
})();
