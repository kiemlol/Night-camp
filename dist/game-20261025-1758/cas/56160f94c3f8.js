/* fieldgen.js — builds a FIELD map (the classic-MMO-style hunting maps around the camp) from its description in
   maps.js: painted ground (grass / moss / red sand), roads, ponds (reeds round them), raised rock plateaus, farm
   plots (tilled rows of crops, or rows of headstones), the all-new props of its
   biome (trees, houses, bushes, grass, flowers, rocks), collision grid, night lights, minimap, zones, warps and
   monster spawn points. It returns the same world shape as world.js buildWorld(), so game.js draws both alike. */
(function () {
  'use strict';
  const NC = window.NC;
  const TAU = Math.PI * 2;
  const CELL = 10, GS = 0.5;

  // how each new prop stands in the world
  //   kind: tree | house | tall | rock | bush | post | fence | low  (what it blocks, its shadow, canopy fade)
  //   rect: [width fraction, depth] blocked box for houses; light: [x, y as fractions of w/h from the feet, radius, rgb]
  const PROPS = {
    // meadow
    m_birch: { kind: 'tree' }, m_apple: { kind: 'tree' },
    m_cottage: { kind: 'house', rect: [0.8, 95], light: [0.12, -0.32, 300, '255,196,120'] },
    m_windmill: { kind: 'house', rect: [0.42, 80], light: [0.02, -0.14, 220, '255,196,120'] },
    m_haystack: { kind: 'rock' }, m_well: { kind: 'rock' },
    m_grass1: { kind: 'low', sway: 1 }, m_grass2: { kind: 'low', sway: 1 },
    m_flowers1: { kind: 'low', sway: 1 }, m_flowers2: { kind: 'low', sway: 1 },
    m_bush1: { kind: 'bush' }, m_bush2: { kind: 'bush' }, m_rock: { kind: 'rock' }, m_fence: { kind: 'fence' },
    // glowing-mushroom woods
    w_fir: { kind: 'tree' }, w_oldtree: { kind: 'tree' },
    w_shroomhouse: { kind: 'house', rect: [0.5, 80], light: [0, -0.3, 320, '255,190,120'] },
    w_glowshroom: { kind: 'tall', light: [0, -0.78, 260, '120,230,255'] },
    w_shrooms3: { kind: 'tall', light: [0, -0.7, 240, '200,150,255'] },
    w_stump: { kind: 'rock' }, w_fern: { kind: 'low', sway: 1 }, w_glowflowers: { kind: 'low', sway: 1, light: [0, -0.5, 100, '70,165,190'] },
    w_shrooms_small: { kind: 'low' }, w_log: { kind: 'rock' }, w_rock: { kind: 'rock' }, w_grass: { kind: 'low', sway: 1 },
    w_lantern: { kind: 'post', light: [-0.18, -0.62, 280, '130,200,255'] }, w_bramble: { kind: 'bush' },
    // red-rock canyon
    c_deadtree: { kind: 'tree' }, c_acacia: { kind: 'tree' },
    c_shack: { kind: 'house', rect: [0.78, 85], light: [-0.18, -0.34, 280, '255,190,110'] },
    c_spire: { kind: 'tall' }, c_boulders: { kind: 'rock' }, c_minecart: { kind: 'rock', light: [0, -0.7, 170, '255,170,80'] },
    c_rock: { kind: 'rock' }, c_pebbles: { kind: 'low' }, c_drybush: { kind: 'bush' }, c_cactus: { kind: 'bush' },
    c_bones: { kind: 'low' }, c_grass: { kind: 'low', sway: 1 }, c_crystals: { kind: 'rock', light: [0, -0.55, 220, '255,160,70'] },
    c_sign: { kind: 'post' },
  };
  NC.FIELD_PROPS = PROPS;

  // ---------------- biomes: ground palettes (n = night, d = day) and what grows where ----------------
  const BIOMES = {
    meadow: {
      base: { n: [50, 76, 74], d: [118, 170, 94] }, patch: { n: [60, 90, 78], d: [142, 190, 104] }, vary: 20, patchScale: 560,
      road: { n: [64, 70, 82], d: [205, 170, 118] }, roadEdge: { n: [56, 72, 78], d: [166, 160, 100] }, roadMid: { n: [72, 78, 90], d: [224, 194, 142] },
      water: { n: [38, 62, 104], d: [92, 172, 216] }, deep: { n: [30, 48, 88], d: [66, 138, 198] }, shore: { n: [66, 74, 86], d: [206, 190, 142] },
      specks: [
        { n: ['rgba(230,236,255,0.55)', 'rgba(255,214,236,0.5)', 'rgba(255,244,190,0.5)'], d: ['#f7f2e8', '#ffd3e4', '#fff0a6', '#cfe6ff'], count: 2600, size: [2.5, 5] },
        { n: ['rgba(30,48,52,0.35)'], d: ['rgba(70,120,60,0.35)'], count: 1800, size: [3, 7], blade: 1 },
      ],
      trees: [['m_birch', 1], ['m_apple', 1]], border: [['m_birch', 1], ['m_apple', 1]], grove: 0.6, fill: 0.55, lone: 0.35,
      bushes: [['m_bush1', 1], ['m_bush2', 1]], nBush: 90,
      grass: [['m_grass1', 3], ['m_grass2', 1]], nGrass: 650,
      flowers: [['m_flowers1', 1], ['m_flowers2', 1]], nPatch: 46,
      rocks: [['m_rock', 1]], nRock: 28,
      mini: { ground: '#cfe2b2', road: '#8a6e4c', water: '#7cb8e0', tree: 'rgba(70,120,70,0.55)' },
    },
    woods: {
      base: { n: [32, 50, 58], d: [70, 112, 86] }, patch: { n: [38, 60, 62], d: [86, 128, 92] }, vary: 14, patchScale: 460,
      road: { n: [46, 58, 64], d: [132, 106, 78] }, roadEdge: { n: [38, 54, 60], d: [96, 104, 74] }, roadMid: { n: [54, 66, 72], d: [150, 124, 92] },
      water: { n: [30, 58, 84], d: [70, 138, 150] }, deep: { n: [22, 42, 66], d: [48, 108, 126] }, shore: { n: [44, 50, 60], d: [110, 112, 84] },
      specks: [
        { n: ['rgba(170,110,70,0.5)', 'rgba(200,150,80,0.45)'], d: ['#c98a4a', '#e0b060', '#a8643c'], count: 2200, size: [3, 6], leaf: 1 },
        { n: ['rgba(150,245,255,0.8)', 'rgba(200,170,255,0.7)'], d: ['rgba(150,230,240,0.6)'], count: 700, size: [1.5, 3] },
      ],
      trees: [['w_fir', 1.2], ['w_oldtree', 1]], border: [['w_fir', 1.3], ['w_oldtree', 1]], grove: 0.5, fill: 0.8, lone: 0.3,
      bushes: [['w_bramble', 1], ['w_fern', 1.4]], nBush: 170,
      grass: [['w_grass', 1]], nGrass: 480,
      flowers: [['w_glowflowers', 1], ['w_shrooms_small', 1]], nPatch: 52,
      rocks: [['w_rock', 1], ['w_stump', 0.7], ['w_log', 0.7]], nRock: 60,
      giants: [['w_glowshroom', 1], ['w_shrooms3', 1]], nGiant: 34,
      mini: { ground: '#9fbf9c', road: '#6e5a48', water: '#5f9fb0', tree: 'rgba(30,70,60,0.6)' },
    },
    canyon: {
      base: { n: [72, 50, 62], d: [204, 132, 92] }, patch: { n: [82, 58, 66], d: [222, 156, 108] }, vary: 16, patchScale: 620,
      road: { n: [92, 74, 82], d: [234, 194, 144] }, roadEdge: { n: [80, 60, 70], d: [214, 160, 112] }, roadMid: { n: [100, 82, 90], d: [242, 208, 164] },
      water: { n: [40, 58, 96], d: [90, 150, 190] }, deep: { n: [30, 44, 80], d: [64, 118, 170] }, shore: { n: [84, 66, 74], d: [214, 170, 126] },
      mesaTop: { n: [94, 62, 70], d: [196, 112, 80] }, mesaRim: { n: [110, 76, 82], d: [220, 140, 100] },
      mesaFace: { n: [62, 40, 52], d: [150, 80, 62] }, mesaFace2: { n: [50, 32, 44], d: [120, 60, 52] },
      specks: [
        { n: ['rgba(40,28,40,0.4)', 'rgba(120,96,104,0.45)'], d: ['#9a6a52', '#c79070', '#8d7a70'], count: 2000, size: [2.5, 5.5] },
      ],
      cracks: 160,
      trees: [['c_deadtree', 1], ['c_acacia', 0.6]], border: [['c_spire', 1], ['c_boulders', 0.8], ['c_deadtree', 0.8]], grove: 0.64, fill: 0.7, lone: 0.4,
      bushes: [['c_drybush', 1], ['c_cactus', 0.8]], nBush: 90,
      grass: [['c_grass', 1]], nGrass: 340,
      flowers: [['c_pebbles', 1], ['c_bones', 0.4]], nPatch: 30,
      rocks: [['c_rock', 1], ['c_boulders', 0.5], ['c_crystals', 0.35]], nRock: 70,
      mini: { ground: '#e3b48c', road: '#f1d6a8', water: '#7fa9cf', mesa: '#a8624a', tree: 'rgba(110,70,50,0.55)' },
    },
  };
  NC.BIOMES = BIOMES;

  // ---------------- small geometry helpers ----------------
  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, t = NC.clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
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
  // a wobbly closed outline around an ellipse
  const blob = (cx, cy, rx, ry, seed, wob) => {
    const pts = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU;
      const k = 1 + (NC.fbm(Math.cos(a) * 1.6 + 7, Math.sin(a) * 1.6 + 7, seed, 3) - 0.5) * (wob || 0.5);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  };
  const scalePoly = (pts, cx, cy, k) => pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
  const tracePoly = (c, pts, dy) => {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y + (dy || 0)) : c.moveTo(x, y + (dy || 0))));
    c.closePath();
  };
  // a smooth line through the points (quadratic curves through the midpoints)
  const traceCurve = (c, pts) => {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    c.lineTo(l[0], l[1]);
  };
  // the same curve as points (for distances and for the minimap)
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
  const pickW = (R, list) => {
    let s = 0;
    for (const [, w] of list) s += w;
    let r = R() * s;
    for (const [n, w] of list) if ((r -= w) <= 0) return n;
    return list[list.length - 1][0];
  };
  const rgb = (a) => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;

  NC.buildField = function (def) {
    const B = BIOMES[def.biome];
    const W = def.W, H = def.H, SEED = def.seed || 1;
    const R = NC.rng(SEED * 7919 + 13);
    const GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
    const solid = new Uint8Array(GW * GH), terrainSolid = new Uint8Array(GW * GH);
    // js/passprops.js: what stood each solid cell up. own 0 = anything hard (water, cliffs, plateaus, the edge); else only
    // props marked it, with the NC.softProp bits all of them give (2 a shot flies past it, 4 the hero walks round it)
    const own = new Uint8Array(GW * GH);
    let soft = 0;
    const put = (k) => { own[k] = soft ? (solid[k] ? own[k] & soft : soft) : 0; solid[k] = 1; };
    const markRect = (x0, y0, x1, y1, terrain = false) => {
      for (let gy = Math.max(0, Math.floor(y0 / CELL)); gy < Math.min(GH, Math.ceil(y1 / CELL)); gy++)
        for (let gx = Math.max(0, Math.floor(x0 / CELL)); gx < Math.min(GW, Math.ceil(x1 / CELL)); gx++) { const k = gy * GW + gx; put(k); if (terrain) terrainSolid[k] = 1; }
    };
    const markEllipse = (cx, cy, rx, ry) => {
      for (let gy = Math.floor((cy - ry) / CELL); gy <= (cy + ry) / CELL; gy++)
        for (let gx = Math.floor((cx - rx) / CELL); gx <= (cx + rx) / CELL; gx++) {
          if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
          const nx = (gx * CELL + CELL / 2 - cx) / rx, ny = (gy * CELL + CELL / 2 - cy) / ry;
          if (nx * nx + ny * ny <= 1) put(gy * GW + gx);
        }
    };
    const markPoly = (pts, dyMax) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      for (let gy = Math.max(0, Math.floor(y0 / CELL)); gy <= Math.min(GH - 1, (y1 + (dyMax || 0)) / CELL); gy++)
        for (let gx = Math.max(0, Math.floor(x0 / CELL)); gx <= Math.min(GW - 1, x1 / CELL); gx++) {
          const x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2;
          let hit = inPoly(pts, x, y);
          for (let k = 1; !hit && dyMax && k <= 4; k++) hit = inPoly(pts, x, y - (dyMax * k) / 4);
          if (hit) { const k = gy * GW + gx; put(k); terrainSolid[k] = 1; }
        }
    };

    // ---------- layout: roads, water, plateaus ----------
    const roads = (def.roads || []).map((r) => ({ w: r.w || 70, pts: r.pts, curve: curvePoints(r.pts) }));
    const roadDist = (x, y) => {
      let d = Infinity;
      for (const r of roads)
        for (let i = 0; i < r.curve.length - 1; i++) d = Math.min(d, segDist(x, y, r.curve[i][0], r.curve[i][1], r.curve[i + 1][0], r.curve[i + 1][1]) - r.w / 2);
      return d;
    };
    const ponds = (def.ponds || []).map((p, i) => ({ ...p, pts: blob(p.x, p.y, p.rx, p.ry, SEED * 31 + i, 0.45) }));
    const inWater = (x, y, pad) =>
      ponds.some((p) => ((x - p.x) / (p.rx * 1.3 + (pad || 0))) ** 2 + ((y - p.y) / (p.ry * 1.3 + (pad || 0))) ** 2 < 1 && inPoly(pad ? scalePoly(p.pts, p.x, p.y, 1 + pad / p.rx) : p.pts, x, y));
    const FACE = 90;
    const mesas = (def.mesas || []).map((m, i) => ({ ...m, pts: blob(m.x, m.y, m.rx, m.ry, SEED * 53 + i, 0.55) }));
    const inMesa = (x, y, pad) =>
      mesas.some((m) => Math.abs(x - m.x) < m.rx * 1.35 + (pad || 0) && y > m.y - m.ry * 1.35 - (pad || 0) && y < m.y + m.ry * 1.35 + FACE + (pad || 0) &&
        (inPoly(m.pts, x, y) || inPoly(m.pts, x, y - FACE / 2) || inPoly(m.pts, x, y - FACE) || (pad && Math.hypot((x - m.x) / m.rx, (y - m.y - FACE / 2) / m.ry) < 1 + pad / m.rx)));
    const warps = (def.warps || []).map((w) => ({ ...w }));
    const nearWarp = (x, y, d) => warps.some((w) => Math.hypot(x - w.x, (y - w.y) * 1.3) < d);
    const safe = def.safe || []; // [x0, y0, x1, y1] boxes kept free of monsters (villages)
    const clears = def.clear || []; // {x, y, r}: open clearings (a boss arena): no trees, bushes or grass inside
    const inClear = (x, y, pad) => clears.some((c) => ((x - c.x) / (c.r + (pad || 0))) ** 2 + ((y - c.y) / ((c.r + (pad || 0)) * 0.62)) ** 2 < 1);
    const inSafe = (x, y) => safe.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    // farm plots and grave rows ({x0, y0, x1, y1, crops, row, gap, fence, soil}): tilled earth (none with soil: false)
    // with crops or headstones in rows; trees, bushes and grass keep off them
    const plots = def.plots || [];
    const inPlot = (x, y, pad) => plots.some((q) => x > q.x0 - (pad || 0) && x < q.x1 + (pad || 0) && y > q.y0 - (pad || 0) && y < q.y1 + (pad || 0));

    // ---------- ground: painted twice (night and day), crossfaded by the renderer ----------
    const gw = Math.ceil(W * GS), gh = Math.ceil(H * GS);
    const mk = () => { const c = document.createElement('canvas'); c.width = gw; c.height = gh; return c; };
    const ground = mk(), groundDay = mk();
    const gN = ground.getContext('2d'), gD = groundDay.getContext('2d');
    const imN = gN.createImageData(gw, gh), imD = gD.createImageData(gw, gh);
    const pN = imN.data, pD = imD.data;
    const bn = B.base.n, bd = B.base.d, qn = B.patch.n, qd = B.patch.d, V = B.vary, PS = B.patchScale;
    for (let j = 0; j < gh; j++) {
      const y = j / GS;
      for (let i = 0; i < gw; i++) {
        const x = i / GS, k = (j * gw + i) * 4;
        const n = NC.fbm(x / PS, y / PS, SEED + 3, 2);
        const m = NC.noise(x / 64, y / 64, SEED + 9) - 0.5;
        const t = NC.clamp((n - 0.44) / 0.18, 0, 1);
        const v = m * V;
        pN[k] = bn[0] + (qn[0] - bn[0]) * t + v; pN[k + 1] = bn[1] + (qn[1] - bn[1]) * t + v; pN[k + 2] = bn[2] + (qn[2] - bn[2]) * t + v * 0.8; pN[k + 3] = 255;
        pD[k] = bd[0] + (qd[0] - bd[0]) * t + v * 1.3; pD[k + 1] = bd[1] + (qd[1] - bd[1]) * t + v * 1.3; pD[k + 2] = bd[2] + (qd[2] - bd[2]) * t + v; pD[k + 3] = 255;
      }
    }
    gN.putImageData(imN, 0, 0);
    gD.putImageData(imD, 0, 0);

    for (const [G, P] of [[gN, 'n'], [gD, 'd']]) {
      const Rg = NC.rng(SEED * 17 + 5); // the same decoration on the night and the day ground
      G.save();
      G.scale(GS, GS);
      G.lineCap = 'round'; G.lineJoin = 'round';
      // specks: tiny flowers, grass blades, fallen leaves, pebbles
      for (const S of B.specks) {
        const cols = S[P];
        for (let n = 0; n < S.count; n++) {
          const x = Rg() * W, y = Rg() * H, s = S.size[0] + Rg() * (S.size[1] - S.size[0]), col = cols[Math.floor(Rg() * cols.length)], rot = Rg() * 3;
          if (inWater(x, y, 10)) continue;
          G.fillStyle = col; G.strokeStyle = col;
          if (S.blade) { G.lineWidth = 2; G.beginPath(); G.moveTo(x, y); G.lineTo(x + (Rg() - 0.5) * 6, y - s * 1.6); G.stroke(); }
          else { G.beginPath(); G.ellipse(x, y, s, S.leaf ? s * 0.5 : s * 0.7, S.leaf ? rot : 0, 0, TAU); G.fill(); }
        }
      }
      // cracks in dry ground
      for (let n = 0; n < (B.cracks || 0); n++) {
        let x = Rg() * W, y = Rg() * H;
        G.strokeStyle = P === 'n' ? 'rgba(30,20,34,0.45)' : 'rgba(120,70,50,0.45)'; G.lineWidth = 3;
        G.beginPath(); G.moveTo(x, y);
        for (let s = 0; s < 4; s++) { x += 12 + Rg() * 22; y += (Rg() - 0.5) * 26; G.lineTo(x, y); }
        G.stroke();
      }
      // roads: a soft edge, the dirt, a lighter middle, pebbles; each layer is one path of overlapping discs along
      // the curve, so the edges wobble and the road wanders a little
      for (const [ri, r] of roads.entries()) {
        const layer = (col, widen, k, alpha, wob) => {
          G.fillStyle = rgb(col); G.globalAlpha = alpha;
          G.beginPath();
          let dist = 0;
          for (let i = 0; i < r.curve.length - 1; i++) {
            const [ax, ay] = r.curve[i], [bx, by] = r.curve[i + 1], len = Math.hypot(bx - ax, by - ay) || 1;
            const nx = -(by - ay) / len, ny = (bx - ax) / len;
            for (let t = 0; t < len; t += 9) {
              const d = dist + t, x = ax + ((bx - ax) * t) / len, y = ay + ((by - ay) * t) / len;
              const off = (NC.noise(d / 260, ri * 7.3, SEED + 41) - 0.5) * 2 * wob;
              const rad = Math.max(4, (r.w * k) / 2 * (0.84 + 0.32 * NC.noise(d / 70, ri * 3.1 + widen, SEED + 43)) + widen);
              G.moveTo(x + nx * off + rad, y + ny * off);
              G.arc(x + nx * off, y + ny * off, rad, 0, TAU);
            }
            dist += len;
          }
          G.fill();
          G.globalAlpha = 1;
        };
        layer(B.roadEdge[P], 17, 1, 0.5, 14);
        layer(B.road[P], 0, 1, 1, 14);
        layer(B.roadMid[P], 0, 0.42, 0.45, 14);
        for (let i = 0; i < r.curve.length - 1; i++) {
          const [ax, ay] = r.curve[i], [bx, by] = r.curve[i + 1];
          const len = Math.hypot(bx - ax, by - ay);
          for (let s = 0; s < len / 70; s++) {
            const t = Rg(), off = (Rg() - 0.5) * r.w * 0.8;
            const x = ax + (bx - ax) * t - ((by - ay) / (len || 1)) * off, y = ay + (by - ay) * t + ((bx - ax) / (len || 1)) * off;
            G.fillStyle = P === 'n' ? 'rgba(30,30,44,0.35)' : 'rgba(120,96,70,0.4)';
            G.beginPath(); G.ellipse(x, y, 3 + Rg() * 4, 2 + Rg() * 2, 0, 0, TAU); G.fill();
          }
        }
      }
      // farm plots: a soft edge, the tilled earth, a furrow and a ridge along every row
      for (const q of plots) {
        if (q.soil === false || !B.soil) continue;
        const w = q.x1 - q.x0, h = q.y1 - q.y0, row = q.row || 95;
        G.fillStyle = rgb(B.soilEdge[P]); G.globalAlpha = 0.6;
        G.beginPath(); G.roundRect(q.x0 - 18, q.y0 - 18, w + 36, h + 36, 32); G.fill();
        G.globalAlpha = 1; G.fillStyle = rgb(B.soil[P]);
        G.beginPath(); G.roundRect(q.x0, q.y0, w, h, 22); G.fill();
        for (let y = q.y0 + row * 0.75 + 6; y < q.y1 - 8; y += row) {
          G.strokeStyle = rgb(B.furrow[P]); G.lineWidth = 16;
          G.beginPath(); G.moveTo(q.x0 + 20, y); G.lineTo(q.x1 - 20, y); G.stroke();
          G.strokeStyle = rgb(B.ridge[P]); G.lineWidth = 6;
          G.beginPath(); G.moveTo(q.x0 + 24, y - 15); G.lineTo(q.x1 - 24, y - 15); G.stroke();
        }
      }
      // ponds: sandy shore, water, the deep middle, ripples, lily pads, outline
      for (const p of ponds) {
        G.strokeStyle = rgb(B.shore[P]); G.lineWidth = 40; tracePoly(G, p.pts); G.stroke();
        G.fillStyle = rgb(B.water[P]); tracePoly(G, p.pts); G.fill();
        G.fillStyle = rgb(B.deep[P]); G.globalAlpha = 0.65; tracePoly(G, scalePoly(p.pts, p.x, p.y + p.ry * 0.08, 0.66)); G.fill();
        G.globalAlpha = 1;
        G.strokeStyle = P === 'n' ? 'rgba(170,200,255,0.35)' : 'rgba(255,255,255,0.55)'; G.lineWidth = 5;
        for (let s = 0; s < Math.round(p.rx / 60); s++) {
          const a = Rg() * TAU, rr = Rg() * 0.6;
          const x = p.x + Math.cos(a) * p.rx * rr, y = p.y + Math.sin(a) * p.ry * rr, w = 20 + Rg() * 30;
          G.beginPath(); G.moveTo(x - w / 2, y); G.quadraticCurveTo(x, y - 6, x + w / 2, y); G.stroke();
        }
        if (p.lilies)
          for (let s = 0; s < p.lilies; s++) {
            const a = Rg() * TAU, rr = 0.35 + Rg() * 0.5;
            const x = p.x + Math.cos(a) * p.rx * rr, y = p.y + Math.sin(a) * p.ry * rr, r0 = 14 + Rg() * 10, a0 = Rg() * TAU;
            G.fillStyle = P === 'n' ? '#3f6a5a' : '#6fae5e';
            G.beginPath(); G.ellipse(x, y, r0, r0 * 0.6, 0, a0 + 0.5, a0 + TAU - 0.1); G.lineTo(x, y); G.closePath(); G.fill();
            G.strokeStyle = NC.OUTLINE; G.lineWidth = 3; G.stroke();
            if (Rg() < 0.4) { G.fillStyle = P === 'n' ? '#e8d7ec' : '#ffd0e4'; G.beginPath(); G.arc(x + 4, y - 4, 5, 0, TAU); G.fill(); }
          }
        G.strokeStyle = NC.OUTLINE; G.lineWidth = 6; tracePoly(G, p.pts); G.stroke();
      }
      // clearings: a soft disc of moss (and a faint glow by night)
      for (const c of clears) {
        if (!c.glow) continue;
        G.save(); G.translate(c.x, c.y); G.scale(1, 0.62);
        const gr = G.createRadialGradient(0, 0, 0, 0, 0, c.r);
        gr.addColorStop(0, P === 'n' ? 'rgba(110,210,210,0.22)' : 'rgba(150,200,120,0.35)');
        gr.addColorStop(0.75, P === 'n' ? 'rgba(80,170,180,0.12)' : 'rgba(120,170,100,0.2)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        G.fillStyle = gr; G.beginPath(); G.arc(0, 0, c.r, 0, TAU); G.fill();
        G.restore();
      }
      // raised rock plateaus: the cliff face (the outline pushed down), then the top
      for (const m of mesas) {
        G.fillStyle = rgb(B.mesaFace2[P]);
        for (let dy = FACE; dy >= 0; dy -= 3) { tracePoly(G, m.pts, dy); G.fill(); }
        G.strokeStyle = NC.OUTLINE; G.lineWidth = 6; tracePoly(G, m.pts, FACE); G.stroke();
        G.fillStyle = rgb(B.mesaFace[P]); G.globalAlpha = 0.9;
        for (let dy = FACE * 0.45; dy >= 0; dy -= 3) { tracePoly(G, m.pts, dy); G.fill(); }
        G.globalAlpha = 1;
        // strata lines on the face
        G.strokeStyle = P === 'n' ? 'rgba(30,20,34,0.45)' : 'rgba(90,40,36,0.4)'; G.lineWidth = 4;
        for (const k of [0.35, 0.68]) { G.save(); tracePoly(G, m.pts, FACE); G.clip(); tracePoly(G, m.pts, FACE * k); G.stroke(); G.restore(); }
        G.fillStyle = rgb(B.mesaTop[P]); tracePoly(G, m.pts); G.fill();
        G.fillStyle = rgb(B.mesaRim[P]); G.globalAlpha = 0.7; tracePoly(G, scalePoly(m.pts, m.x - m.rx * 0.05, m.y - m.ry * 0.1, 0.82)); G.fill();
        G.globalAlpha = 1;
        G.strokeStyle = NC.OUTLINE; G.lineWidth = 6; tracePoly(G, m.pts); G.stroke();
      }
      G.restore();
    }

    // ---------- props ----------
    const props = [], lights = [], occ = [];
    const OG = 300, occGrid = new Map(); // spacing checks look only at nearby cells
    const occAdd = (x, y, r) => {
      const key = Math.floor(x / OG) + ',' + Math.floor(y / OG);
      if (!occGrid.has(key)) occGrid.set(key, []);
      occGrid.get(key).push([x, y, r]); occ.push([x, y, r]);
    };
    const free = (x, y, r) => {
      const cx = Math.floor(x / OG), cy = Math.floor(y / OG);
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const L = occGrid.get(cx + i + ',' + (cy + j));
          if (L) for (const [ox, oy, or] of L) if (Math.hypot(ox - x, (oy - y) * 1.5) < r + or) return false;
        }
      return true;
    };
    const isSolidAt = (x, y) => {
      const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
      return gx < 0 || gy < 0 || gx >= GW || gy >= GH || solid[gy * GW + gx] === 1;
    };
    // a zone may thin the scattered decor (zone.decor: the share kept; the farm's newbie meadow keeps half, the owner,
    // 2026-10-08 "ลดของตกแต่งในทุ่งหญ้า"): of the trees, bushes, rocks, flowers and tufts the scatter puts there, every
    // other one in turn is left out (o.thin; never the hand-placed ones, the plots, the shores or the border forest)
    const thinZones = (def.zones || []).filter((z) => z.decor !== undefined && z.decor < 1).map((z) => ({ rect: z.rect, keep: z.decor, seen: 0 }));
    const thinnedOut = (x, y) => {
      const z = thinZones.find(({ rect: [x0, y0, x1, y1] }) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
      if (!z) return false;
      z.seen++;
      return Math.floor(z.seen * z.keep) === Math.floor((z.seen - 1) * z.keep); // (kept: its share, spread evenly in order)
    };
    const addProp = (name, x, y, o) => {
      o = o || {};
      const s = NC.SPR[name], D = PROPS[name] || { kind: 'low' };
      if (!s) return null;
      const scale = o.scale || 1, flip = !!o.flip, w = s.w * scale, h = s.h * scale;
      const occR = o.r || (D.kind === 'house' ? w * 0.42 : D.kind === 'tree' ? 70 * scale : D.kind === 'tall' ? 60 : D.kind === 'low' ? 22 : 38 * scale);
      if (o.thin && thinnedOut(x, y)) {
        // left out, but it still takes its random draws (sway, light) and keeps its room empty, so everything else on
        // the map stands exactly where it did
        if (D.sway) R();
        if (D.light) R();
        occAdd(x, y, occR);
        return null;
      }
      // js/roadclear.js: a scattered prop or a fence piece that would stand on a road is left out (its place stays taken
      // and the random numbers are drawn as before, so the rest of the map is the same)
      if (!handPlaced && def.roadGuard && def.roadGuard(name, x, y, scale, flip)) { if (D.sway) R(); if (D.light) R(); occAdd(x, y, occR); return null; }
      const p = { kind: 'prop', name, x, y, scale, flip, sort: y };
      const walkThrough = NC.propIsWalkThrough(name, D.kind, scale);
      // an arch, a gate or a bridge stands on its legs (D.legs: [offset, half width] in parts of its width; [] = walk over it)
      if (D.legs && !walkThrough) for (const [dx, rx] of D.legs) markEllipse(x + w * dx * (flip ? -1 : 1), y - 8, w * rx, 14);
      const mE = D.legs ? () => {} : markEllipse, mR = D.legs ? () => {} : markRect;
      soft = NC.softProp ? NC.softProp(name, D, scale) : 0; // (js/passprops.js)
      switch (D.kind) {
        case 'tree': mE(x, y - w * 0.014, w * 0.085, w * 0.045); p.shadow = [w * 0.2, w * 0.055]; break;
        case 'house': mR(x - (w * D.rect[0]) / 2, y - D.rect[1], x + (w * D.rect[0]) / 2, y - 4); p.shadow = [w * 0.46, 28]; break;
        case 'tall': if (!walkThrough) mE(x, y - 6, w * 0.16, w * 0.07); p.shadow = [w * 0.3, w * 0.08]; break;
        case 'rock': if (!walkThrough) mE(x, y - h * 0.08, w * 0.36, Math.min(h * 0.22, w * 0.16)); p.shadow = [w * 0.44, w * 0.12]; break;
        case 'bush': if (!walkThrough) mE(x, y - 6, w * 0.26, w * 0.11); p.shadow = [w * 0.42, w * 0.11]; break;
        case 'post': if (!walkThrough) mE(x, y - 4, 14, 8); p.shadow = [18, 6]; break;
        case 'fence': mR(x - w * 0.47, y - 24, x + w * 0.47, y - 2); break;
        default: if (h > 70) p.shadow = [w * 0.3, 7];
      }
      soft = 0;
      if (p.shadow) p.shadow = [p.shadow[0] / scale, p.shadow[1] / scale]; // game.js scales contact shadows by p.scale
      if (D.kind === 'tree' || D.kind === 'tall') p.canopy = { x0: x - w * 0.45, x1: x + w * 0.45, y0: y - h, y1: y - h * 0.3 };
      if (D.kind === 'house') p.canopy = { x0: x - w * 0.48, x1: x + w * 0.48, y0: y - h, y1: y - 30 };
      if (D.sway) p.sway = R() * 6;
      if (D.light) {
        const L = D.light;
        lights.push({ x: x + L[0] * w * (flip ? -1 : 1), y: y + L[1] * h, r: L[2] * Math.sqrt(scale), rgb: L[3], flick: R() * 10, owner: p });
      }
      props.push(p);
      occAdd(x, y, occR);
      return p;
    };

    // hand-placed landmarks first (houses, windmill, well, fences...)
    let handPlaced = true; // (roadclear.js already set these off the roads, or they stand there on purpose: a door at its road)
    for (const [name, x, y, o] of def.landmarks || []) addProp(name, x, y, o);
    handPlaced = false;
    for (const [name, x0, x1, y] of def.fences || []) {
      const s = NC.SPR[name];
      if (!s) continue;
      for (let x = x0; x <= x1; x += s.w * 0.92) addProp(name, Math.round(x), y, { r: 10 });
    }
    for (const g of def.rings || [])
      for (let i = 0; i < g.n; i++) {
        const a = (i / g.n) * TAU + (R() - 0.5) * 0.12;
        if (g.gap && a > g.gap[0] && a < g.gap[1]) continue; // the way in
        const rr = g.r * (0.94 + R() * 0.12), x = Math.round(g.x + Math.cos(a) * rr), y = Math.round(g.y + Math.sin(a) * rr * 0.62);
        addProp(g.names[i % g.names.length], x, y, { scale: 0.9 + R() * 0.35, flip: R() < 0.5, r: 14 });
      }
    // crops (or headstones) in rows on the plots, a fence along a plot's top edge
    for (const q of plots) {
      const row = q.row || 95, gap = q.gap || 120;
      if (q.crops)
        for (let y = q.y0 + row * 0.75, r = 0; y < q.y1 - 12; y += row, r++)
          for (let x = q.x0 + gap * (0.45 + (r % 2) * 0.35); x < q.x1 - gap * 0.3; x += gap) {
            if (R() < (q.skip || 0)) continue;
            addProp(pickW(R, q.crops), Math.round(x + (R() - 0.5) * (q.jitter || 16)), Math.round(y + (R() - 0.5) * 8),
              { flip: R() < 0.5, scale: (q.scale || 0.85) + R() * 0.25, r: 10 });
          }
      const f = q.fence && NC.SPR[q.fence];
      if (f) for (let x = q.x0 + f.w * 0.46; x <= q.x1 - f.w * 0.4; x += f.w * 0.92) addProp(q.fence, Math.round(x), q.y0 - 18, { r: 10 });
    }
    // reeds and other shore plants (the biome's shorePlants) round the ponds that ask for them (a pond's reeds: how many)
    for (const p of ponds)
      for (let k = 0, made = 0; B.shorePlants && k < (p.reeds || 0) * 4 && made < (p.reeds || 0); k++) {
        const a = R() * TAU, s = 1 + R() * 0.16, x = Math.round(p.x + Math.cos(a) * p.rx * s), y = Math.round(p.y + Math.sin(a) * p.ry * s);
        if (inWater(x, y, 6) || roadDist(x, y) < 24 || nearWarp(x, y, 200) || !free(x, y, 18)) continue;
        addProp(pickW(R, B.shorePlants), x, y, { flip: R() < 0.5, scale: 0.8 + R() * 0.35, r: 16 });
        made++;
      }
    // lanterns along the roads (every ~spacing units, alternating sides)
    if (def.lanterns) {
      const [name, spacing] = def.lanterns;
      let side = 1;
      for (const r of roads) {
        let acc = spacing * 0.5;
        for (let i = 0; i < r.curve.length - 1; i++) {
          const [ax, ay] = r.curve[i], [bx, by] = r.curve[i + 1], len = Math.hypot(bx - ax, by - ay);
          acc += len;
          if (acc < spacing) continue;
          acc = 0; side = -side;
          const nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
          const x = Math.round(bx + nx * (r.w / 2 + 40) * side), y = Math.round(by + ny * (r.w / 2 + 40) * side);
          if (!nearWarp(x, y, 260) && free(x, y, 40) && !inWater(x, y, 30)) addProp(name, x, y, { flip: side < 0 });
        }
      }
    }
    // keep: [x0, y0, x1, y1] boxes of hand-placed landmarks that must stay in view (a section's centrepiece, js/fields7.js):
    // no tree crown over them from the south, and nothing scattered on the strip in front of their base
    const keeps = def.keep || [];
    const inFront = (x, y) => keeps.some(([x0, , x1, y1]) => x > x0 - 60 && x < x1 + 60 && y > y1 - 60 && y < y1 + 400); // (tall bushes reach far up)
    const open = (x, y, road, water, plotsOk) => roadDist(x, y) > road && !inWater(x, y, water) && !inMesa(x, y, water) && !isSolidAt(x, y) && !inClear(x, y) &&
      (plotsOk || !inPlot(x, y, 30)) && !inFront(x, y);
    // big things (trees, giant mushrooms) must not hide a road, a pond or a house behind their crown: in the 3/4 view
    // the crown covers the ground north of the trunk, so sample that area
    const houses = props.filter((p) => (PROPS[p.name] || {}).kind === 'house').map((p) => {
      const s = NC.SPR[p.name], w = s.w * p.scale, h = s.h * p.scale;
      return [p.x - w / 2, p.y - h, p.x + w / 2, p.y];
    }).concat(keeps);
    const crownClear = (name, x, y, scale) => {
      const s = NC.SPR[name];
      if (!s) return false;
      const w = s.w * scale, h = s.h * scale;
      for (const fx of [-0.36, 0, 0.36])
        for (const fy of [0.3, 0.55, 0.8]) {
          const px = x + fx * w, py = y - fy * h;
          // (a clearing keeps a wide margin: tall things south of it would hide the fight)
          if (roadDist(px, py) < 12 || inWater(px, py, 20) || nearWarp(px, py, 170) || inClear(px, py, 160) || inPlot(px, py, 10)) return false;
          if (houses.some(([x0, y0, x1, y1]) => px > x0 && px < x1 && py > y0 && py < y1 && y > y1)) return false;
        }
      return true;
    };
    const tall = []; // trunks of the big things, to keep monsters out from under their crowns
    if (def.landmarkCrowns) // (a map may count its hand-placed trees too: an orchard)
      for (const p of props) {
        const D = PROPS[p.name], s = NC.SPR[p.name];
        if (s && D && (D.kind === 'tree' || D.kind === 'tall')) tall.push([p.x, p.y, s.w * p.scale * 0.42, s.h * p.scale * 0.85]);
      }
    const addBig = (name, x, y, scale, flip, thin) => {
      const p = addProp(name, x, y, { scale, flip, thin });
      if (p) { const s = NC.SPR[name]; tall.push([x, y, s.w * scale * 0.42, s.h * scale * 0.85]); }
      return p;
    };
    // the forest ring along the edge of the map, then groves inside (patches of a slow noise), a few lone trees
    const groveN = (x, y) => NC.fbm(x / 900, y / 900, SEED + 21, 3);
    for (let gy = 140; gy < H + 150; gy += 150)
      for (let gx = 60; gx < W + 60; gx += 190) {
        const x = Math.round(gx + (R() - 0.5) * 130), y = Math.round(gy + (R() - 0.5) * 100);
        const edge = Math.min(x, W - x, y, H - y);
        const border = edge < 240;
        const roll = R();
        if (border ? roll > 0.88 : groveN(x, y) < B.grove || roll > B.fill) continue;
        if (x < 30 || x > W - 30 || y < 80 || y > H + 80 || nearWarp(x, y, 330) || !open(x, y, 140, 90) || !free(x, y, 72)) continue;
        const name = pickW(R, border ? B.border : B.trees), scale = 0.86 + R() * 0.28;
        if (!crownClear(name, x, y, scale)) continue;
        addBig(name, x, y, scale, R() < 0.5, !border);
      }
    for (let n = 0; n < (W * H) / 1e6 * (B.lone || 0.5); n++) {
      const x = 300 + R() * (W - 600), y = 350 + R() * (H - 600), name = pickW(R, B.trees), scale = 0.9 + R() * 0.2;
      if (open(x, y, 140, 90) && !nearWarp(x, y, 330) && free(x, y, 110) && crownClear(name, x, y, scale)) addBig(name, Math.round(x), Math.round(y), scale, R() < 0.5, true);
    }
    // giant mushrooms (woods): at the edges of the groves
    for (let n = 0, made = 0; n < (B.nGiant || 0) * 6 && made < (B.nGiant || 0); n++) {
      const x = 200 + R() * (W - 400), y = 250 + R() * (H - 400), g = groveN(x, y), name = pickW(R, B.giants), scale = 0.85 + R() * 0.3;
      if (g < B.grove - 0.12 || g > B.grove + 0.04 || !open(x, y, 90, 60) || nearWarp(x, y, 260) || !free(x, y, 60) || !crownClear(name, x, y, scale)) continue;
      addBig(name, Math.round(x), Math.round(y), scale, R() < 0.5, true);
      made++;
    }
    const underCrown = (x, y) => tall.some(([tx, ty, hw, hh]) => ty - y > -30 && ty - y < hh && Math.abs(tx - x) < hw);
    // bushes and rocks: more of them near the groves
    const scatter = (list, count, r, road, near) => {
      let made = 0;
      for (let n = 0; n < count * 6 && made < count; n++) {
        const x = 80 + R() * (W - 160), y = 120 + R() * (H - 200);
        if (near && groveN(x, y) < B.grove - 0.2 && R() < 0.6) continue;
        if (!open(x, y, road, 30) || nearWarp(x, y, 200) || !free(x, y, r)) continue;
        addProp(pickW(R, list), Math.round(x), Math.round(y), { scale: 0.85 + R() * 0.3, flip: R() < 0.5, thin: true });
        made++;
      }
    };
    scatter(B.bushes, B.nBush, 44, 40, true);
    scatter(B.rocks, B.nRock, 46, 50, false);
    // flower / pebble patches in the open
    for (let n = 0, made = 0; n < B.nPatch * 5 && made < B.nPatch; n++) {
      const cx = 200 + R() * (W - 400), cy = 250 + R() * (H - 400);
      if (!open(cx, cy, 40, 30) || nearWarp(cx, cy, 200)) continue;
      made++;
      for (let k = 0, m = 3 + Math.floor(R() * 5); k < m; k++) {
        const x = cx + (R() - 0.5) * 220, y = cy + (R() - 0.5) * 130;
        if (open(x, y, 20, 20) && free(x, y, 18)) addProp(pickW(R, B.flowers), Math.round(x), Math.round(y), { scale: 0.8 + R() * 0.4, flip: R() < 0.5, r: 16, thin: true });
      }
    }
    // grass tufts everywhere, a little thicker near the trees
    for (let n = 0, made = 0; n < B.nGrass * 4 && made < B.nGrass; n++) {
      const x = 60 + R() * (W - 120), y = 80 + R() * (H - 140);
      if (groveN(x, y) < B.grove - 0.25 && R() < 0.35) continue;
      if (!open(x, y, 16, 16) || nearWarp(x, y, 150) || !free(x, y, 24)) continue;
      addProp(pickW(R, B.grass), Math.round(x), Math.round(y), { scale: 0.75 + R() * 0.5, flip: R() < 0.5, r: 20, thin: true });
      made++;
    }
    // props standing on top of the plateaus (not walkable: pure decoration)
    for (const m of mesas)
      for (let k = 0; k < (m.deco || 0); k++) {
        const a = R() * TAU, rr = Math.sqrt(R()) * 0.7;
        const x = Math.round(m.x + Math.cos(a) * m.rx * rr), y = Math.round(m.y + Math.sin(a) * m.ry * rr);
        if (inPoly(m.pts, x, y) && inPoly(m.pts, x, y - 30)) {
          const p = addProp(pickW(R, B.mesaDeco || [['c_rock', 1], ['c_drybush', 1], ['c_grass', 1.5], ['c_deadtree', 0.3], ['c_spire', 0.25]]), x, y, { scale: 0.8 + R() * 0.3, flip: R() < 0.5 });
          if (p) p.shadow = null;
        }
      }

    // a pond may glow (lava): a light over it (game.js centres a light 120 below its y)
    for (const p of ponds) if (p.glow) lights.push({ x: p.x, y: p.y - 120, r: Math.max(p.rx, p.ry) * 1.3, rgb: p.glow, flick: R() * 10, owner: p });

    // ---------- collision: water, plateaus, the border ----------
    for (const p of ponds) markPoly(scalePoly(p.pts, p.x, p.y, 0.94));
    for (const m of mesas) markPoly(m.pts, FACE);
    markRect(0, 0, W, 40, true); markRect(0, H - 40, W, H, true); markRect(0, 0, 40, H, true); markRect(W - 40, 0, W, H, true);

    // ---------- monsters: spread over the open ground, not in the villages or at the warps ----------
    // (NC.MOB_MULT times the numbers in NC.MAPS; the more there are, the closer together they may stand)
    const spawns = [], mult = NC.MOB_MULT || 1, gap = 230 / Math.sqrt(mult);
    for (const [type, n0] of def.spawns || []) {
      const count = Math.round(n0 * mult);
      for (let n = 0, made = 0; n < count * 40 && made < count; n++) {
        const x = Math.round(150 + R() * (W - 300)), y = Math.round(200 + R() * (H - 350));
        if (!open(x, y, 10, 90, true) || inSafe(x, y) || nearWarp(x, y, 520) || underCrown(x, y) || spawns.some((s) => Math.hypot(s[1] - x, s[2] - y) < gap)) continue;
        spawns.push([type, x, y]); made++;
      }
    }

    // a zone's own monsters (zone.spawns, counted as def.spawns): inside its rect, on top of the map's (farm's newbie
    // meadow: the camp's old green slimes, bats and boars since the big camp became safe ground, 2026-10-04)
    for (const z of def.zones || []) for (const [type, n0] of z.spawns || []) {
      const count = Math.round(n0 * mult), [x0, y0, x1, y1] = z.rect;
      for (let n = 0, made = 0; n < count * 40 && made < count; n++) {
        const x = Math.round(x0 + R() * (x1 - x0)), y = Math.round(y0 + R() * (y1 - y0));
        if (!open(x, y, 10, 90, true) || inSafe(x, y) || nearWarp(x, y, 520) || underCrown(x, y) || spawns.some((s) => Math.hypot(s[1] - x, s[2] - y) < gap)) continue;
        spawns.push([type, x, y]); made++;
      }
    }

    for (const [type, x, y] of def.bosses || []) spawns.push([type, x, y]);

    // ---------- minimap (1 px = 10 units) ----------
    const mm = document.createElement('canvas');
    mm.width = Math.ceil(W / 10); mm.height = Math.ceil(H / 10);
    const mc = mm.getContext('2d');
    mc.fillStyle = B.mini.ground; mc.fillRect(0, 0, mm.width, mm.height);
    mc.save(); mc.scale(0.1, 0.1);
    mc.lineCap = 'round'; mc.lineJoin = 'round';
    for (const m of mesas) { mc.fillStyle = B.mini.mesa || '#8a7060'; tracePoly(mc, m.pts); mc.fill(); }
    for (const q of plots) if (q.soil !== false && B.mini.plot) { mc.fillStyle = B.mini.plot; mc.fillRect(q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0); }
    for (const p of ponds) { mc.fillStyle = B.mini.water; tracePoly(mc, p.pts); mc.fill(); }
    mc.strokeStyle = B.mini.road;
    for (const r of roads) { mc.lineWidth = Math.max(40, r.w * 0.9); traceCurve(mc, r.pts); mc.stroke(); }
    mc.fillStyle = B.mini.tree;
    for (const p of props) {
      const D = PROPS[p.name];
      if (D && (D.kind === 'tree' || D.kind === 'tall')) { mc.beginPath(); mc.arc(p.x, p.y - 120, 100 * p.scale, 0, TAU); mc.fill(); }
    }
    mc.fillStyle = '#6a4a3c';
    for (const p of props) {
      const D = PROPS[p.name], s = NC.SPR[p.name];
      if (D && D.kind === 'house' && s) mc.fillRect(p.x - s.w * 0.4, p.y - 160, s.w * 0.8, 160);
    }
    mc.fillStyle = '#e8b64a';
    for (const w of warps) { mc.beginPath(); mc.arc(w.x, w.y, 55, 0, TAU); mc.fill(); }
    mc.restore();

    const world = {
      W, H, ground, groundDay, GS, props, decals: [], blocks: [], blockH: 0, lights, solid, terrainSolid, solidOwn: own, GW, GH, CELL, minimap: mm,
      portals: [], warps, spawns, field: def.id, biome: def.biome, ponds, // (ponds: their outlines, for js/water.js and fishing)
      zones: [
        // (passive: its monsters only hit back, monsters2.js)
        ...(def.zones || []).map((z) => ({ name: z.name, lv: z.lv, passive: !!z.passive, test: (x, y) => x >= z.rect[0] && x <= z.rect[2] && y >= z.rect[1] && y <= z.rect[3] })),
        { name: def.name, lv: def.lv, test: () => true },
      ],
      isSolid(x, y) {
        const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return true;
        return solid[gy * GW + gx] === 1;
      },
      fits(x, y, r) {
        if (this.isSolid(x, y)) return false;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          if (this.isSolid(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6)) return false;
        }
        return true;
      },
    };
    for (const w of warps) if (w.ax === undefined) [w.ax, w.ay] = NC.arrivalPoint(world, roads.map((r) => r.pts), w.x, w.y); // (a warp may set its own: a dungeon door)
    world.spawn = def.spawn ? { x: def.spawn[0], y: def.spawn[1] } : warps.length ? { x: warps[0].ax, y: warps[0].ay } : { x: W / 2, y: H / 2 };
    if (NC.passProps) NC.passProps(world); // js/passprops.js: shots past rocks and trees, the hero walks round them
    return world;
  };
})();
