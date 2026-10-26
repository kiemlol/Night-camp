/* world.js — the map: ground layer, stone-ruin walls, props, lights, collision grid, minimap image */
(function () {
  'use strict';
  const NC = window.NC;

  // Monsters and attacks ignore decorative footprints, while terrain and map walls stay solid.
  NC.isTerrainSolid = function (world, x, y) {
    if (!world.terrainSolid) return world.isSolid ? world.isSolid(x, y) : !world.fits(x, y, 0);
    const gx = Math.floor(x / world.CELL), gy = Math.floor(y / world.CELL);
    return gx < 0 || gy < 0 || gx >= world.GW || gy >= world.GH || world.terrainSolid[gy * world.GW + gx] === 1;
  };
  NC.terrainFits = function (world, x, y, r = 0) {
    if (!world.terrainSolid) return world.fits(x, y, r);
    if (NC.isTerrainSolid(world, x, y)) return false;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      if (NC.isTerrainSolid(world, x + Math.cos(a) * r, y + Math.sin(a) * r * .6)) return false;
    }
    return true;
  };

  // Rushing can cross low props, but uses its own solid mask so walls and large props still stop it.
  NC.dashFits = function (world, x, y, r = 0) {
    if (!world.dashSolid) return world.fits(x, y, r);
    if (world.dashSolid(x, y)) return false;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      if (world.dashSolid(x + Math.cos(a) * r, y + Math.sin(a) * r * .6)) return false;
    }
    return true;
  };

  NC.propIsDashThrough = function (name, kind, scale = 1) {
    if (!['rock', 'bush', 'seat', 'log', 'post', 'fence'].includes(kind)) return false;
    const s = NC.SPR[name];
    return !!s && s.w <= 360 && s.h <= 260 && s.w * scale <= 360 && s.h * scale <= 260;
  };

  // Flowers and ground cover stay passable; passprops.js steers around other props.
  NC.propIsWalkThrough = function (name, kind, scale = 1) {
    const prop = NC.FIELD_PROPS?.[name] || NC.CAMP_PROPS?.[name] || NC.VILLAGE_PROPS?.[name];
    return kind === 'low' || prop?.walkThrough === true;
  };

  const W = 4700, H = 3300;
  const GS = 0.5; // ground canvas resolution (ground art is soft, half resolution is plenty)
  const CELL = 10; // collision grid cell (world units)

  // stone ruins: '#' wall block, '.' floor, ' ' outside
  const RX = 2660, RY = 520, BW = 140, BH = 110, BLOCK_H = 96;
  const RUINS = [
    '#############',
    '#...........#',
    '#...........#',
    '#...........#',
    '#...........#',
    '####..##..###',
    '#...........#',
    '............#',
    '............#',
    '#...........#',
    '#...........#',
    '#...........#',
    '######..#####',
  ];

  // lower ground beyond the cliff south of the camp (the camp plateau drops into it)
  const LOWLAND = [
    [1330, 2470, 1620, H], [1620, 2360, 1920, H], [1920, 2290, 2270, H], [2270, 2390, 2660, H],
  ];
  const FACE_H = 78;

  const PATHS = [
    [[1450, 1560], [1900, 1490], [2300, 1420], [2700, 1360]],
    [[3640, 1950], [3560, 2300], [3250, 2750], [3050, 3300]],
  ];

  // name, x, y, [opts]
  const CAMP_PROPS = [
    ['tent', 860, 1215], ['tent', 2380, 1045, { flip: true, scale: 0.9 }],
    ['rack', 1790, 1175], ['barrel', 2210, 1235], ['crates', 640, 1395],
    ['torch', 1215, 1150], ['torch', 1640, 1140], ['torch', 2060, 1560], ['torch', 1150, 1900], ['torch', 520, 1560],
    ['stone', 1430, 1235], ['stone', 1555, 1262, { scale: 0.85, flip: true }], ['stone', 2480, 1840, { scale: 1.1 }],
    ['stone', 360, 1990, { scale: 0.9 }], ['barrel', 700, 1250, { scale: 0.9 }],
  ];
  const CAMP_DECALS = [
    ['rug_red', 900, 1345], ['rug_orange', 1065, 1385], ['rug_red', 1440, 1575], ['rug_orange', 1620, 1612],
  ];
  const RUIN_PROPS = [
    ['wagon', 3150, 960], ['roundtent', 4000, 930], ['lamp', 3560, 760], ['lamp', 3780, 1040],
    ['crates', 2900, 1010], ['barrel', 3330, 700, { scale: 0.9 }], ['torch', 2910, 1320], ['torch', 4230, 1320],
    ['torch', 2910, 1780], ['torch', 4230, 1780], ['stone', 4200, 700, { scale: 0.8 }],
  ];
  const PORTALS = [{ x: 2100, y: 1950 }, { x: 3570, y: 1560 }]; // camp <-> ruins

  // collision footprints (ellipse radii at the base) and light sources per sprite
  const FOOT = {
    tree: [46, 24], tree2: [42, 22], stone: [46, 22], barrel: [30, 16], torch: [12, 8], lamp: [12, 8],
    rack: [72, 14], tent: [128, 40], roundtent: [150, 46], wagon: [128, 36], crates: [70, 26],
  };
  const LIGHT = { torch: [0, -200, 330, '255,170,90'], lamp: [-35, -178, 280, '255,205,130'] };

  NC.WORLD_SIZE = [W, H];

  NC.buildWorld = function () {
    const R = NC.rng(7);
    const GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
    const solid = new Uint8Array(GW * GH), terrainSolid = new Uint8Array(GW * GH);
    const own = new Uint8Array(GW * GH);
    let soft = 0;
    const put = k => { own[k] = soft ? (solid[k] ? own[k] & soft : soft) : 0; solid[k] = 1; };
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

    // exits to the hunting fields (maps.js): each gets a road through the forest and a warp at its end
    const EXITS = (NC.MAPS && NC.MAPS.camp && NC.MAPS.camp.exits) || [];
    const ROADS = PATHS.concat(EXITS.filter((e) => e.road).map((e) => e.road));

    // ---------- where is what ----------
    const inRuins = (x, y) => x >= RX - 60 && x <= RX + 13 * BW + 60 && y >= RY - 160 && y <= RY + 13 * BH + 40;
    const inLow = (x, y) => LOWLAND.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
    const lowTop = (x) => { for (const [x0, y0, x1] of LOWLAND) if (x >= x0 && x < x1) return y0; return Infinity; };
    const segDist = (px, py, ax, ay, bx, by) => {
      const dx = bx - ax, dy = by - ay, t = NC.clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
      return Math.hypot(px - ax - dx * t, py - ay - dy * t);
    };
    const pathDist = (x, y) => {
      let d = Infinity;
      for (const p of ROADS) for (let i = 0; i < p.length - 1; i++) d = Math.min(d, segDist(x, y, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]));
      return d;
    };
    const ruinFloor = (x, y) => {
      const c = Math.floor((x - RX) / BW), r = Math.floor((y - RY) / BH);
      return r >= 0 && r < RUINS.length && c >= 0 && c < 13 && RUINS[r][c] !== ' ';
    };

    // ---------- ground canvas ----------
    const gw = Math.ceil(W * GS), gh = Math.ceil(H * GS);
    const ground = document.createElement('canvas');
    ground.width = gw; ground.height = gh;
    const g = ground.getContext('2d');
    const img = g.createImageData(gw, gh);
    const px = img.data;
    // the same ground painted for daylight (crossfaded in by the renderer)
    const groundDay = document.createElement('canvas');
    groundDay.width = gw; groundDay.height = gh;
    const gd = groundDay.getContext('2d');
    const imgD = gd.createImageData(gw, gh);
    const dpx = imgD.data;
    for (let j = 0; j < gh; j++) {
      const y = j / GS;
      for (let i = 0; i < gw; i++) {
        const x = i / GS, k = (j * gw + i) * 4;
        let r, gg, b, dr, dg, db;
        if (inLow(x, y)) {
          const n = NC.fbm(x / 240, y / 240, 11, 2);
          r = 52 + n * 14; gg = 43 + n * 10; b = 70 + n * 14;
          dr = 74 + n * 18; dg = 98 + n * 16; db = 74 + n * 12;
        } else if (ruinFloor(x, y)) {
          // big flagstones with dark seams
          const fx = (x - RX) / 150, fy = (y - RY) / 105;
          const sx = fx - Math.floor(fx), sy = fy - Math.floor(fy);
          const seam = sx < 0.035 || sy < 0.05;
          const v = NC.hash(Math.floor(fx), Math.floor(fy), 5) * 10 + NC.noise(x / 60, y / 60, 6) * 6;
          if (seam) { r = 41; gg = 44; b = 58; dr = 96; dg = 96; db = 108; } else { r = 47 + v; gg = 51 + v; b = 68 + v; dr = 128 + v * 2; dg = 128 + v * 2; db = 138 + v * 2; }
        } else {
          const n = NC.fbm(x / 300, y / 300, 3, 3), m = NC.noise(x / 55, y / 55, 4);
          const v = (n - 0.5) * 22 + (m - 0.5) * 8;
          r = 50 + v; gg = 68 + v; b = 82 + v * 0.9;
          dr = 96 + v * 1.3; dg = 140 + v * 1.4; db = 84 + v;
          const pd = pathDist(x, y);
          if (pd < 60) {
            const t = NC.clamp((60 - pd) / 25, 0, 1) * (0.75 + NC.noise(x / 20, y / 20, 9) * 0.25);
            r = NC.lerp(r, 62, t); gg = NC.lerp(gg, 66, t); b = NC.lerp(b, 80, t);
            dr = NC.lerp(dr, 176, t); dg = NC.lerp(dg, 150, t); db = NC.lerp(db, 108, t);
          }
        }
        px[k] = r; px[k + 1] = gg; px[k + 2] = b; px[k + 3] = 255;
        dpx[k] = dr; dpx[k + 1] = dg; dpx[k + 2] = db; dpx[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    gd.putImageData(imgD, 0, 0);
    for (const G of [g, gd]) {
    const R = NC.rng(99); // same decorations on the night and the day ground
    G.save();
    G.scale(GS, GS);
    // little leaves and pebbles on the camp ground
    for (let n = 0; n < 900; n++) {
      const x = R() * W, y = R() * H;
      if (inLow(x, y) || inRuins(x, y)) continue;
      G.fillStyle = R() < 0.7 ? 'rgba(150,190,150,0.35)' : 'rgba(20,30,40,0.35)';
      G.beginPath();
      G.ellipse(x, y, 4 + R() * 5, 2 + R() * 2, R() * 3, 0, Math.PI * 2);
      G.fill();
    }
    // cliff faces where the camp plateau drops into the lowland
    for (const [x0, y0, x1] of LOWLAND) {
      const grd = G.createLinearGradient(0, y0, 0, y0 + FACE_H);
      grd.addColorStop(0, '#6a587c'); grd.addColorStop(0.25, '#574869'); grd.addColorStop(1, '#3f3350');
      G.fillStyle = grd;
      G.fillRect(x0, y0, x1 - x0, FACE_H);
      // rock seams
      G.strokeStyle = 'rgba(40,30,55,0.6)'; G.lineWidth = 4;
      for (let x = x0 + 40; x < x1 - 20; x += 70 + R() * 50) {
        G.beginPath(); G.moveTo(x, y0 + 14); G.lineTo(x + R() * 16 - 8, y0 + FACE_H - 8); G.stroke();
      }
      G.strokeStyle = NC.OUTLINE; G.lineWidth = 6;
      G.beginPath(); G.moveTo(x0, y0); G.lineTo(x1, y0); G.stroke();
    }
    // outline the plateau corners between steps
    G.strokeStyle = NC.OUTLINE; G.lineWidth = 6;
    for (let i = 0; i < LOWLAND.length - 1; i++) {
      const a = LOWLAND[i], b = LOWLAND[i + 1];
      G.beginPath(); G.moveTo(a[2], Math.min(a[1], b[1])); G.lineTo(a[2], Math.max(a[1], b[1]) + FACE_H); G.stroke();
    }
    G.restore();
    }

    // ---------- objects ----------
    const props = [];
    const decals = [];
    const lights = [];
    const occupied = [];
    const addProp = (name, x, y, o) => {
      o = o || {};
      const p = { kind: 'prop', name, x, y, scale: o.scale || 1, flip: !!o.flip, sort: y };
      props.push(p);
      const f = FOOT[name];
      const kind = name === 'stone' || name === 'barrel' || name === 'crates' ? 'rock' : 'tall';
      soft = NC.propIsDashThrough(name, kind, p.scale) ? 8 : 0;
      if (f && !NC.propIsWalkThrough(name, kind, p.scale)) markEllipse(x, y - f[1] * 0.3, f[0] * p.scale, f[1] * p.scale);
      soft = 0;
      if (LIGHT[name]) {
        const L = LIGHT[name];
        lights.push({ x: x + L[0] * (p.flip ? -1 : 1) * p.scale, y: y + L[1] * p.scale, r: L[2], rgb: L[3], flick: R() * 10, owner: p });
      }
      if (name === 'tree' || name === 'tree2') {
        const s = NC.SPR[name];
        if (s) p.canopy = { x0: x - s.w * 0.45 * p.scale, x1: x + s.w * 0.45 * p.scale, y0: y - s.h * p.scale, y1: y - s.h * 0.33 * p.scale };
      }
      occupied.push([x, y, (f ? f[0] : 40) * p.scale]);
      return p;
    };
    CAMP_PROPS.forEach(([n, x, y, o]) => addProp(n, x, y, o));
    RUIN_PROPS.forEach(([n, x, y, o]) => addProp(n, x, y, o));
    CAMP_DECALS.forEach(([n, x, y]) => decals.push({ name: n, x, y }));

    // wall blocks
    const blocks = [];
    const blockArt = NC.makeBlockArt(BW, BH, BLOCK_H);
    RUINS.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch !== '#') return;
        const x = RX + c * BW, y = RY + r * BH;
        blocks.push({ kind: 'block', x: x + BW / 2, y: y + BH, bx: x, by: y, art: blockArt[Math.floor(NC.hash(c, r, 3) * blockArt.length)], sort: y + BH });
        markRect(x + 4, y + 10, x + BW - 4, y + BH, true);
      })
    );

    // forest: big trees everywhere outside the clearing, the ruins and the paths
    const nearPortal = (x, y, d) => PORTALS.concat(EXITS).some((pt) => Math.hypot(x - pt.x, (y - pt.y) * 1.4) < d);
    const free = (x, y, r) => occupied.every(([ox, oy, or]) => Math.hypot(ox - x, (oy - y) * 1.5) > r + or);
    const clearing = (x, y) => ((x - 1400) / 1150) ** 2 + ((y - 1480) / 820) ** 2 < 1;
    // a tree's crown covers the ground north of its trunk: keep crowns off the exit roads and their warps
    const exitRoads = EXITS.map((e) => e.road || PATHS.find((p) => Math.hypot(p[p.length - 1][0] - e.x, p[p.length - 1][1] - e.y) < 320)).filter(Boolean);
    const exitCover = (x, y) =>
      [[0, 160], [0, 320], [-130, 240], [130, 240]].some(([dx, dy]) => {
        const px = x + dx, py = y - dy;
        if (EXITS.some((e) => Math.hypot(px - e.x, py - e.y) < 200)) return true;
        for (const p of exitRoads) for (let i = 0; i < p.length - 1; i++) if (segDist(px, py, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]) < 70) return true;
        return false;
      });
    for (let gy = 250; gy < H + 200; gy += 170)
      for (let gx = 80; gx < W; gx += 190) {
        const x = gx + (R() - 0.5) * 140, y = gy + (R() - 0.5) * 110;
        if (clearing(x, y) || inRuins(x, y) || inLow(x, y + 40) || pathDist(x, y) < 150 || nearPortal(x, y, 300)) continue;
        if (exitCover(x, y)) continue; // no crown over the roads out to the fields
        // keep tall canopies from covering the fort's courtyard (they stand south of it)
        if (x > RX - 260 && x < RX + 13 * BW + 260 && y > RY - 200 && y < RY + 13 * BH + 480) continue;
        if (y > lowTop(x) - 60 && y < lowTop(x) + 150) continue;
        const border = x < 300 || x > W - 250 || y < 380 || y > H - 150;
        if (!border && R() < 0.42) continue;
        if (!free(x, y, 70)) continue;
        addProp(R() < 0.55 ? 'tree' : 'tree2', Math.round(x), Math.round(y), { scale: 0.85 + R() * 0.3, flip: R() < 0.5 });
      }
    // grass tufts: sparse in the middle of the camp, thicker towards the forest; taller ones along the cliff
    const onRug = (x, y) => CAMP_DECALS.some(([, dx, dy]) => Math.abs(x - dx) < 150 && Math.abs(y - dy) < 90);
    for (let n = 0; n < 520; n++) {
      const x = 60 + R() * (W - 120), y = 60 + R() * (H - 120);
      if (ruinFloor(x, y) || pathDist(x, y) < 60 || nearPortal(x, y, 150) || onRug(x, y) || !free(x, y, 30)) continue;
      const cd = ((x - 1400) / 1100) ** 2 + ((y - 1500) / 760) ** 2;
      if (cd < 1 && R() > 0.12 + cd * 0.35) continue;
      const low = inLow(x, y);
      if (low && y > lowTop(x) + 360) continue;
      props.push({ kind: 'prop', name: 'grass', x: Math.round(x), y: Math.round(y), scale: low ? 1.3 + R() * 0.5 : 0.65 + R() * 0.5, flip: R() < 0.5, sort: y, sway: R() * 6 });
      occupied.push([x, y, 26]);
    }
    for (const [x0, y0, x1] of LOWLAND)
      for (let x = x0 + 30; x < x1 - 20; x += 55 + R() * 45)
        props.push({ kind: 'prop', name: 'grass', x: Math.round(x), y: Math.round(y0 + FACE_H + 30 + R() * 50), scale: 1.5 + R() * 0.5, flip: R() < 0.5, sort: y0 + FACE_H + 60, sway: R() * 6 });

    // ---------- collision: lowland, world border ----------
    for (const [x0, y0, x1, y1] of LOWLAND) markRect(x0, y0 - 4, x1, y1, true);
    markRect(0, 0, W, 40, true); markRect(0, H - 40, W, H, true); markRect(0, 0, 40, H, true); markRect(W - 40, 0, W, H, true);

    // ---------- minimap image (1 px = 10 units) ----------
    const mm = document.createElement('canvas');
    mm.width = Math.ceil(W / 10); mm.height = Math.ceil(H / 10);
    const m = mm.getContext('2d');
    m.fillStyle = '#c9dcb4'; m.fillRect(0, 0, mm.width, mm.height);
    m.fillStyle = '#7f8f86';
    for (const [x0, y0, x1, y1] of LOWLAND) m.fillRect(x0 / 10, y0 / 10, (x1 - x0) / 10, (y1 - y0) / 10);
    m.fillStyle = '#f4f1ea';
    RUINS.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '.') m.fillRect((RX + c * BW) / 10, (RY + r * BH) / 10, BW / 10 + 0.5, BH / 10 + 0.5); }));
    m.strokeStyle = '#1b1822'; m.lineCap = 'round'; m.lineJoin = 'round'; m.lineWidth = 7;
    for (const p of ROADS) { m.beginPath(); p.forEach(([x, y], i) => (i ? m.lineTo(x / 10, y / 10) : m.moveTo(x / 10, y / 10))); m.stroke(); }
    m.fillStyle = '#1b1822';
    for (const b of blocks) m.fillRect(b.bx / 10, b.by / 10, BW / 10 + 0.5, BH / 10 + 0.5);
    m.fillStyle = 'rgba(70,110,70,0.55)';
    for (const p of props) if (p.name === 'tree' || p.name === 'tree2') { m.beginPath(); m.arc(p.x / 10, (p.y - 150) / 10, 11 * p.scale, 0, Math.PI * 2); m.fill(); }
    m.fillStyle = '#e8b64a';
    for (const pt of PORTALS.concat(EXITS)) { m.beginPath(); m.arc(pt.x / 10, pt.y / 10, 5, 0, Math.PI * 2); m.fill(); }

    const world = {
      W, H, ground, groundDay, GS, props, decals, blocks, blockH: BLOCK_H, lights, solid, terrainSolid, solidOwn: own, GW, GH, CELL, minimap: mm, portals: PORTALS,
      spawn: { x: 1480, y: 1640 },
      zones: [
        { name: 'ค่ายกลางป่า', test: (x, y) => x < 2500 },
        { name: 'ซากป้อมหินเก่า', test: (x, y) => inRuins(x, y) },
        { name: 'ป่าตะวันออก', test: () => true },
      ],
      isSolid(x, y) {
        const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return true;
        return solid[gy * GW + gx] === 1;
      },
      // true when a circle at x,y fits
      fits(x, y, r) {
        if (this.isSolid(x, y)) return false;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          if (this.isSolid(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6)) return false;
        }
        return true;
      },
    };
    // warps to the fields; coming back, the hero steps out a little way up the road from the warp
    world.warps = EXITS.map((e) => {
      const [ax, ay] = NC.arrivalPoint(world, ROADS, e.x, e.y);
      return { id: e.id, x: e.x, y: e.y, to: e.to, at: e.at, ax, ay };
    });
    if (NC.attachDashCollision) NC.attachDashCollision(world);
    return world;
  };

  // is (x, y) a wall to a flying shot? js/passprops.js gives built maps shotSolid (rocks, trees, bushes, posts and
  // fences let shots through; water, cliffs, houses and dungeon walls stop them); a world without it: any solid cell
  NC.shotWall = (w, x, y) => (w.shotSolid ? w.shotSolid(x, y) : w.isSolid(x, y));

  // where the hero appears when he arrives through a warp at x,y: ~170 units back along the road that ends there
  // (else towards the middle of the map), moved on until he fits
  NC.arrivalPoint = function (world, roads, x, y) {
    let best = null;
    for (const p of roads)
      for (const i of [0, p.length - 1]) {
        const d = Math.hypot(p[i][0] - x, p[i][1] - y);
        if (d < 320 && (!best || d < best.d)) best = { d, p, i };
      }
    let ux, uy;
    if (best) {
      const p = best.p, j = best.i === 0 ? 1 : p.length - 2;
      ux = p[j][0] - p[best.i][0]; uy = p[j][1] - p[best.i][1];
    } else { ux = world.W / 2 - x; uy = world.H / 2 - y; }
    const L = Math.hypot(ux, uy) || 1;
    ux /= L; uy /= L;
    let ax = x + ux * 170, ay = y + uy * 170;
    for (let s = 0; s < 40 && !world.fits(ax, ay, 30); s++) { ax += ux * 15; ay += uy * 15; }
    return [Math.round(ax), Math.round(ay)];
  };

  // pre-rendered stone blocks (a few variants): a cube on a bw x bd footprint, hb tall. In the 3/4
  // view its top face is the footprint lifted by hb, and the brick front face hangs below it.
  NC.makeBlockArt = function (bw, bd, hb) {
    const out = [];
    for (let v = 0; v < 4; v++) {
      const R = NC.rng(40 + v);
      const S = 2, P = 4; // art resolution, padding
      const cv = document.createElement('canvas');
      cv.width = (bw + 2 * P) * S; cv.height = (bd + hb + 2 * P) * S;
      const c = cv.getContext('2d');
      c.scale(S, S);
      c.translate(P, P);
      c.lineJoin = 'round';
      const topH = bd, bh = bd + hb;
      // front face
      NC.rrect(c, 2, topH - 10, bw - 4, bh - topH + 8, 14);
      c.fillStyle = '#6c6e8e'; c.fill();
      // bricks on the front face: two courses
      const rows = 2, rh = (bh - topH) / rows;
      for (let r = 0; r < rows; r++) {
        const y0 = topH + r * rh;
        let x = 6 - (r % 2) * 30;
        while (x < bw - 6) {
          const w = 46 + R() * 22;
          const xa = Math.max(6, x), xb = Math.min(bw - 6, x + w - 5);
          if (xb - xa > 10) {
            NC.rrect(c, xa, y0 + 4, xb - xa, rh - 8, 7);
            c.fillStyle = R() < 0.3 ? '#8385a8' : '#77799c'; c.fill();
            c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(xa + 4, y0 + 6, xb - xa - 8, 4);
          }
          x += w;
        }
      }
      // top face
      NC.rrect(c, 0, 0, bw, topH, 16);
      c.fillStyle = '#4a4d63'; c.fill();
      NC.rrect(c, 6, 5, bw - 12, topH - 12, 12);
      c.fillStyle = '#52566e'; c.fill();
      // cracks / moss
      c.strokeStyle = 'rgba(30,30,45,0.55)'; c.lineWidth = 3;
      if (R() < 0.7) { c.beginPath(); const x0 = 20 + R() * (bw - 40); c.moveTo(x0, 8); c.lineTo(x0 + R() * 20 - 10, 26); c.lineTo(x0 + R() * 30 - 15, 40); c.stroke(); }
      if (v === 1 || v === 3) {
        c.fillStyle = '#4f7d55';
        for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(15 + R() * 40, topH - 16 + R() * 8, 10 + R() * 8, 6, 0, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#6a9c66';
        c.beginPath(); c.ellipse(24, topH - 18, 7, 4, 0, 0, Math.PI * 2); c.fill();
      }
      // outlines
      c.strokeStyle = NC.OUTLINE; c.lineWidth = 5;
      NC.rrect(c, 2, topH - 10, bw - 4, bh - topH + 8, 14); c.stroke();
      NC.rrect(c, 0, 0, bw, topH, 16); c.stroke();
      out.push({ cv, w: bw + 2 * P, h: bh + 2 * P, pad: P });
    }
    return out;
  };
})();
