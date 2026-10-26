/* camp.js — ค่ายกลางป่า, the map every hero starts on and comes back to: a big safe clearing (6200 x 5000, no monsters)
   with the campfire in the middle (flames that move, sparks, the warmest light of the night), log benches round it and
   tents round the plaza (the blacksmith's forge on its south-west edge, forge.js), and open corners round that, each
   its own place with forest between them: the market (west:
   Uncle Coco's stall, shop.js, and the adventurers' shops, vend.js), the guild lane (north-east: a fire per guild,
   guild.js), the training ground (east: the lookout tower and dummy.js's dummies), the meeting field (south: wide open
   grass) and the star hill (north-west). Roads out: west meadow, north woods, south canyon, and on the east the ones
   other files add (fields2.js farm, life_farm.js farm lane, pvparena.js arena: their roads are drawn here, ROUTES).
   Other files that still write the small camp's numbers go through NC.campPt(x, y); NC.CAMP_SPOT has the spots.
   All-new art: assets/camp/ + assets/camp.manifest.js (NC.ASSET_MANIFEST_CAMP), made with
   assets/gen/make_camp_prompts.py -> Codex -> tools/cutout.py --dir camp.
   It replaces world.js's NC.buildWorld (world.js still gives NC.arrivalPoint / NC.makeBlockArt). Load it after maps.js
   (it moves NC.MAPS.camp's exits onto the new roads) and before shop.js / vend.js / guild.js / dummy.js / storynpc.js. */
(function () {
  'use strict';
  const NC = window.NC, TAU = Math.PI * 2;
  // (2026-10-04, the user: "ขยายแมพแคมไฟขึ้น มันเล็กเกินไป ไม่ควรมีมอนสเตอร์ ไม่ต้องใส่สิ่งไม่จำเป็นเยอะ ดูรก ...
  // คนเล่นพันคน จะได้มีที่มีมุมแต่ละมุม"): the camp grew from 3040 x 2920 to 6200 x 5000, safe ground (no monsters), the
  // old camp spread 1.45x round the fire, and open corners joined by roads with forest between them
  const W = 6200, H = 5000, GS = 0.5, CELL = 10;
  const FIRE = { x: 3100, y: 2500 }; // the campfire's base line
  // the old layout (fire at 1520, 1470) -> the big camp: other files still write the old camp's numbers through this
  const OLD = { x: 1520, y: 1470 }, SPREAD = 1.45;
  NC.campPt = (x, y) => [Math.round(FIRE.x + (x - OLD.x) * SPREAD), Math.round(FIRE.y + (y - OLD.y) * SPREAD)];
  const PLAZA = { x: 3100, y: 2480, rx: 780, ry: 540 }; // packed earth round the fire
  const CLEAR = { x: 3150, y: 2500, rx: 1260, ry: 900 }; // the camp's middle: tents round the plaza
  const STALL = { x: 1500, y: 2500, rx: 230, ry: 90 }; // shop.js puts the merchant's stall here (NC.CAMP_SPOT.stall)
  // forge.js's forge (its base line; the smith stands 235 east of it): the plaza's south-west edge, in the firelight, a
  // few steps from where heroes wake (2026-10-17, the user's pick; it stood among the star hill's trees before)
  const FORGE = { x: 2480, y: 2870 };
  // the corners: open ground for many players, each its own place (forest between them); earth = packed ground
  const CORNERS = [
    { name: 'ลานกองไฟ', x: CLEAR.x, y: CLEAR.y, rx: CLEAR.rx, ry: CLEAR.ry },
    { name: 'ลานตลาด', x: 1500, y: 2650, rx: 600, ry: 430, earth: true },
    { name: 'ลานกิลด์', x: 4650, y: 1380, rx: 720, ry: 400 },
    { name: 'ลานฝึก', x: 4700, y: 2480, rx: 540, ry: 340, earth: true },
    { name: 'ลานนัดพบ', x: 3100, y: 4060, rx: 1050, ry: 520 },
    { name: 'เนินดูดาว', x: 1480, y: 1360, rx: 560, ry: 380 },
  ];
  const TRAINING = CORNERS[3];
  // little groves between the corners, so each corner reads as its own place: [x, y, radius]
  const GROVES = [[2150, 3380, 260], [4050, 3560, 250], [2380, 1560, 230], [3720, 1330, 220]];
  // where the other files' things stand in the big camp (shop.js, vend.js, guild.js, dummy.js, forge.js)
  NC.CAMP_SPOT = {
    fire: FIRE, stall: { x: STALL.x, y: STALL.y }, seller: { x: STALL.x + 104, y: STALL.y + 62 }, forge: { x: FORGE.x, y: FORGE.y },
    vend: [[1130, 2660], [1870, 2660], [1230, 2920], [1770, 2920], [1500, 3020]],
    guild: [[4150, 1260], [4500, 1260], [4850, 1260], [5200, 1260], [4150, 1530], [4500, 1530], [4850, 1530], [5200, 1530]],
    dummies: [[4460, 2560], [4710, 2620], [4960, 2560]],
  };

  // the roads out (maps.js reads NC.MAPS.camp.exits: the warp at the end of each), and the paths between the corners
  const EXITS = [
    { id: 'west', x: 110, y: 2450, to: 'meadow', at: 'east', road: [[2150, 2330], [1700, 2170], [1100, 2190], [500, 2400], [60, 2450]] },
    { id: 'north', x: 3100, y: 120, to: 'woods', at: 'east', road: [[3060, 1680], [3020, 1200], [3140, 700], [3100, 60]] },
    { id: 'south', x: 3100, y: 4880, to: 'canyon', at: 'north', road: [[3180, 3330], [3330, 3700], [3380, 4200], [3170, 4620], [3100, 4960]] },
  ];
  // the exits other files add (fields2.js 'east', life_farm.js 'farmlane', pvparena.js 'arena') get these roads here;
  // any other one is moved with NC.campPt and carried on to the map's edge
  const ROUTES = {
    arena: { x: 6110, y: 1880, road: [[4300, 2060], [4800, 1900], [5500, 1880], [6190, 1880]] },
    east: { x: 6110, y: 2990, road: [[4300, 2900], [4900, 3000], [5500, 3000], [6190, 2990]] },
    farmlane: { x: 6110, y: 3600, road: [[4150, 3220], [4800, 3440], [5500, 3560], [6190, 3600]] },
  };
  const PATHS = [
    [[3900, 2470], [4200, 2470]], // the plaza to the training ground
    [[3700, 1880], [4100, 1620], [4400, 1450]], // to the guild lane
    [[1500, 1740], [1700, 1980], [1900, 2180]], // up the star hill from the west road
  ];

  if (NC.MAPS && NC.MAPS.camp) Object.assign(NC.MAPS.camp, { exits: EXITS, lvText: 'เขตปลอดภัย' });
  NC.WORLD_SIZE = [W, H];
  // a save made in the small camp: its spot, moved into the big one (once)
  try {
    if (!localStorage.getItem('nightcamp.camp.v2')) {
      const k = 'nightcamp.map.v1', s = JSON.parse(localStorage.getItem(k) || 'null');
      if (s && s.map === 'camp') { [s.x, s.y] = NC.campPt(s.x, s.y); localStorage.setItem(k, JSON.stringify(s)); }
      localStorage.setItem('nightcamp.camp.v2', '1');
    }
  } catch (e) { /* no storage */ }

  // how each prop of the camp stands in the world (as fieldgen.js PROPS): kind = what it blocks, its shadow, canopy fade;
  // rect: [width fraction, depth] blocked box of a house; light: [x, y as fractions of w / h from the feet, radius, rgb]
  const PROPS = {
    camp_fire: { kind: 'fire' },
    camp_tripod: { kind: 'post' }, camp_bench: { kind: 'seat' }, camp_stump: { kind: 'rock' }, camp_woodpile: { kind: 'rock' },
    camp_bedroll: { kind: 'low' },
    camp_tent: { kind: 'house', rect: [0.62, 70] },
    camp_belltent: { kind: 'house', rect: [0.66, 70] },
    camp_puptent: { kind: 'house', rect: [0.52, 44] },
    camp_tarp: { kind: 'house', rect: [0.74, 56] },
    camp_pavilion: { kind: 'house', rect: [0.74, 76] },
    camp_tower: { kind: 'tall' },
    camp_wagon: { kind: 'house', rect: [0.74, 48] },
    camp_crates: { kind: 'rock' }, camp_barrels: { kind: 'rock' }, camp_sacks: { kind: 'rock' },
    camp_rack: { kind: 'fence' }, camp_board: { kind: 'fence' },
    camp_lantern: { kind: 'post', light: [0.6, -0.53, 250, '255,200,120'] }, camp_banner: { kind: 'post' }, camp_sign: { kind: 'post' },
    camp_dummy: { kind: 'post' }, camp_fence: { kind: 'fence' }, camp_table: { kind: 'rock' },
    camp_oak: { kind: 'tree' }, camp_pine: { kind: 'tree' }, camp_tree: { kind: 'tree' },
    camp_bush: { kind: 'bush' }, camp_rock: { kind: 'rock' }, camp_log: { kind: 'rock' },
    camp_grass1: { kind: 'low', sway: 1 }, camp_grass2: { kind: 'low', sway: 1 }, camp_flowers: { kind: 'low', sway: 1 },
    camp_fern: { kind: 'low', sway: 1 }, camp_shrooms: { kind: 'low' }, camp_pebbles: { kind: 'low' },
  };
  NC.CAMP_PROPS = PROPS;

  // the camp, placed by hand: [name, x, y, {flip, scale}]. No lantern posts: at night the campfire is the camp's one light
  // (camp_lantern, camp_sign are cut and ready in assets/camp/ if a road ever needs one). The middle is the old camp's
  // layout spread out (OLDP: old numbers through NC.campPt); the corners are placed in the big camp's numbers
  const OLDP = [
    // round the fire: benches behind it, stumps at its sides, the cook's corner on the east
    ['camp_bench', 1405, 1345], ['camp_bench', 1640, 1345, { flip: true }],
    ['camp_stump', 1340, 1500], ['camp_stump', 1700, 1510, { flip: true }],
    ['camp_tripod', 1840, 1470], ['camp_woodpile', 1940, 1610], ['camp_bedroll', 1765, 1665, { flip: true }],
    ['camp_table', 2020, 1500],
    // tents all round the plaza (the north road leaves between the notice board and the banner)
    ['camp_tent', 1085, 1150], ['camp_rack', 1290, 1215], ['camp_board', 1330, 1020], ['camp_banner', 1640, 1040],
    ['camp_belltent', 1930, 1120, { flip: true }], ['camp_pavilion', 2185, 1360, { flip: true }],
    ['camp_puptent', 880, 1860], ['camp_puptent', 1110, 1965, { flip: true, scale: 0.92 }], ['camp_tarp', 2100, 1790],
    // supplies by the tarp and the wagon on the south-east
    ['camp_wagon', 1860, 1990, { flip: true }], ['camp_crates', 2255, 1905], ['camp_barrels', 2220, 2015], ['camp_sacks', 1995, 2085],
  ];
  const PLACED = OLDP.map(([n, x, y, o]) => { const [X, Y] = NC.campPt(x, y); return [n, X, Y, o]; }).concat([
    // the training ground (east): the lookout tower at its back (its three straw dummies are dummy.js's)
    ['camp_tower', 4720, 2215], ['camp_rack', 4380, 2300, { flip: true }], ['camp_barrels', 5120, 2400],
    // the market (west): Uncle Coco's stall in the middle (shop.js), the adventurers' shops round it (vend.js); supplies
    // only at its edges
    ['camp_crates', 1000, 2440], ['camp_barrels', 2000, 2470, { flip: true }], ['camp_sacks', 960, 2900],
    // the star hill (north-west): a few logs to sit on and look up
    ['camp_log', 1330, 1300], ['camp_log', 1660, 1420, { flip: true }], ['camp_stump', 1480, 1180],
    // the meeting field (south): wide open grass, a seat or two at its edge
    ['camp_log', 2250, 3960], ['camp_log', 3950, 4120, { flip: true }], ['camp_rock', 2400, 4380],
  ]);
  // fences closing the middle's back (gaps where the roads go through): [x0, x1, y]
  const FENCES = [[NC.campPt(840, 0)[0], NC.campPt(1270, 0)[0], NC.campPt(0, 930)[1]], [NC.campPt(1760, 0)[0], NC.campPt(2240, 0)[0], NC.campPt(0, 930)[1]]];
  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, t = NC.clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const ex = px - ax - dx * t, ey = py - ay - dy * t;
    return Math.sqrt(ex * ex + ey * ey);
  };
  // a smooth line through the points (the same curve fieldgen.js uses)
  const curve = (pts) => {
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const [ax, ay] = i === 1 ? pts[0] : [(pts[i - 1][0] + pts[i][0]) / 2, (pts[i - 1][1] + pts[i][1]) / 2];
      const [bx, by] = pts[i], mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      for (let s = 1; s <= 8; s++) { const t = s / 8, u = 1 - t; out.push([u * u * ax + 2 * u * t * bx + t * t * mx, u * u * ay + 2 * u * t * by + t * t * my]); }
    }
    out.push(pts[pts.length - 1]);
    return out;
  };
  const ell = (o, x, y, pad) => ((x - o.x) / (o.rx + (pad || 0))) ** 2 + ((y - o.y) / (o.ry + (pad || 0))) ** 2;

  NC.buildWorld = function () {
    const R = NC.rng(2718);
    const GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
    const solid = new Uint8Array(GW * GH), terrainSolid = new Uint8Array(GW * GH);
    // js/passprops.js: what stood each solid cell up (as in fieldgen.js: 0 = hard, else NC.softProp's bits)
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

    // ---------- layout ----------
    // (the exits other files pushed in the small camp's numbers: their roads in the big camp)
    for (const e of EXITS) {
      if (e.big || ['west', 'north', 'south'].includes(e.id)) continue;
      const R0 = ROUTES[e.id];
      if (R0) Object.assign(e, { x: R0.x, y: R0.y, road: R0.road });
      else {
        const pts = (e.road || [[e.x, e.y]]).map(([x, y]) => NC.campPt(x, y)), [lx, ly] = pts[pts.length - 1];
        const side = Math.min(lx, W - lx, ly, H - ly);
        const edge = side === lx ? [10, ly] : side === W - lx ? [W - 10, ly] : side === ly ? [lx, 10] : [lx, H - 10];
        pts.push(edge);
        Object.assign(e, { x: Math.round(edge[0] + Math.sign(W / 2 - edge[0]) * (side === lx || side === W - lx ? 90 : 0)),
          y: Math.round(edge[1] + Math.sign(H / 2 - edge[1]) * (side === ly || side === H - ly ? 90 : 0)), road: pts });
      }
      e.big = true;
    }
    const roads = EXITS.map((e) => ({ w: 96, pts: e.road, curve: curve(e.road) })).concat(PATHS.map((pts) => ({ w: 70, pts, curve: curve(pts) })));
    const boxes = roads.map((r) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of r.curve) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0 - 160, y0 - 160, x1 + 160, y1 + 160]; });
    const roadDist = (x, y) => {
      let d = Infinity;
      roads.forEach((r, k) => {
        const b = boxes[k];
        if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return;
        for (let i = 0; i < r.curve.length - 1; i++) d = Math.min(d, segDist(x, y, r.curve[i][0], r.curve[i][1], r.curve[i + 1][0], r.curve[i + 1][1]) - r.w / 2);
      });
      return d;
    };
    // inside one of the corners (k: its size times k)
    const inOpen = (x, y, k) => CORNERS.some((c) => ((x - c.x) / (c.rx * k)) ** 2 + ((y - c.y) / (c.ry * k)) ** 2 < 1);
    const openE = (x, y) => { let e = 1e9; for (const c of CORNERS) e = Math.min(e, ell(c, x, y)); return e; };
    // the same distance on a coarse grid (6 units), sampled smoothly: the ground painter asks it for every pixel
    const RC = 6, RW = Math.ceil(W / RC) + 2, RH = Math.ceil(H / RC) + 2, rgrid = new Float32Array(RW * RH).fill(1e4);
    roads.forEach((r, k) => {
      const b = boxes[k];
      for (let gy = Math.max(0, Math.floor(b[1] / RC)); gy <= Math.min(RH - 1, Math.ceil(b[3] / RC)); gy++)
        for (let gx = Math.max(0, Math.floor(b[0] / RC)); gx <= Math.min(RW - 1, Math.ceil(b[2] / RC)); gx++) {
          const x = gx * RC, y = gy * RC, i = gy * RW + gx;
          let d = rgrid[i];
          for (let s = 0; s < r.curve.length - 1; s++) d = Math.min(d, segDist(x, y, r.curve[s][0], r.curve[s][1], r.curve[s + 1][0], r.curve[s + 1][1]) - r.w / 2);
          rgrid[i] = d;
        }
    });
    const roadDistGrid = (x, y) => {
      const fx = x / RC, fy = y / RC, gx = Math.min(RW - 2, Math.floor(fx)), gy = Math.min(RH - 2, Math.floor(fy)), u = fx - gx, v = fy - gy, i = gy * RW + gx;
      return (rgrid[i] * (1 - u) + rgrid[i + 1] * u) * (1 - v) + (rgrid[i + RW] * (1 - u) + rgrid[i + RW + 1] * u) * v;
    };

    // ---------- ground (night and day) ----------
    const gw = Math.ceil(W * GS), gh = Math.ceil(H * GS);
    const mk = () => { const c = document.createElement('canvas'); c.width = gw; c.height = gh; return c; };
    const ground = mk(), groundDay = mk();
    const gN = ground.getContext('2d'), gD = groundDay.getContext('2d');
    const imN = gN.createImageData(gw, gh), imD = gD.createImageData(gw, gh);
    const pN = imN.data, pD = imD.data;
    const mix = (a, b, t) => a + (b - a) * t;
    for (let j = 0; j < gh; j++) {
      const y = j / GS;
      for (let i = 0; i < gw; i++) {
        const x = i / GS, k = (j * gw + i) * 4;
        const n = NC.fbm(x / 320, y / 320, 5, 3), m = NC.noise(x / 58, y / 58, 8) - 0.5;
        const v = (n - 0.5) * 22 + m * 8;
        // grass: the forest floor darker, the camp's clearing and the hunting clearings sunnier
        const openness = NC.clamp(1.15 - Math.sqrt(openE(x, y)) * 0.55, 0, 1) * 0.75;
        let rn = 46 + v + openness * 8, gn = 64 + v + openness * 10, bn = 78 + v * 0.9 + openness * 4;
        let rd = 88 + v * 1.3 + openness * 22, gd = 132 + v * 1.4 + openness * 22, bd = 80 + v + openness * 8;
        // packed earth of the plaza (a soft rim) and of the training ground, the roads
        const pe = ell(PLAZA, x, y);
        let earth = pe < 1.08 ? NC.clamp((1.08 - pe) / 0.16, 0, 1) * (0.82 + NC.noise(x / 24, y / 24, 3) * 0.18) : 0;
        for (const c of CORNERS) if (c.earth) { const ce = ell(c, x, y, -40); if (ce < 1) earth = Math.max(earth, NC.clamp((1 - ce) / 0.2, 0, 1) * 0.8); }
        const rdist = roadDistGrid(x, y), road = rdist > 18 ? 0 : NC.clamp((-rdist + 18) / 26, 0, 1) * (0.78 + NC.noise(x / 20, y / 20, 9) * 0.22);
        const dirt = Math.max(earth, road);
        if (dirt > 0) {
          const w = NC.noise(x / 36, y / 36, 12) * 10;
          rn = mix(rn, 64 + w * 0.5, dirt); gn = mix(gn, 66 + w * 0.4, dirt); bn = mix(bn, 80 + w * 0.3, dirt);
          rd = mix(rd, 184 + w, dirt); gd = mix(gd, 154 + w, dirt); bd = mix(bd, 110 + w * 0.6, dirt);
        }
        // ash round the fire
        const ax = (x - FIRE.x) / 170, ay = (y - FIRE.y + 18) / 105, ad = ax * ax + ay * ay;
        if (ad < 1.5625) {
          const ash = 0.8 * NC.clamp(1.25 - Math.sqrt(ad), 0, 1);
          rn = mix(rn, 52, ash); gn = mix(gn, 48, ash); bn = mix(bn, 60, ash); rd = mix(rd, 122, ash); gd = mix(gd, 104, ash); bd = mix(bd, 86, ash);
        }
        pN[k] = rn; pN[k + 1] = gn; pN[k + 2] = bn; pN[k + 3] = 255;
        pD[k] = rd; pD[k + 1] = gd; pD[k + 2] = bd; pD[k + 3] = 255;
      }
    }
    gN.putImageData(imN, 0, 0); gD.putImageData(imD, 0, 0);
    for (const [G, night] of [[gN, true], [gD, false]]) {
      const Rg = NC.rng(314); // the same specks on the night and the day ground
      G.save(); G.scale(GS, GS);
      for (let s = 0; s < 4200; s++) { // leaves, clover and pebbles (flat specks on the ground: no clutter)
        const x = Rg() * W, y = Rg() * H, big = Rg(), onEarth = ell(PLAZA, x, y) < 1 || roadDist(x, y) < 0;
        G.fillStyle = onEarth ? (night ? 'rgba(30,26,40,0.35)' : 'rgba(120,96,70,0.4)')
          : big < 0.6 ? (night ? 'rgba(120,170,140,0.3)' : 'rgba(70,120,60,0.35)') : big < 0.85 ? (night ? 'rgba(230,236,255,0.35)' : 'rgba(255,248,220,0.55)') : (night ? 'rgba(20,30,40,0.35)' : 'rgba(60,80,50,0.3)');
        G.beginPath(); G.ellipse(x, y, 3 + Rg() * 5, 1.6 + Rg() * 2.4, Rg() * 3, 0, TAU); G.fill();
      }
      // wheel ruts along the roads, a trodden ring round the fire
      G.strokeStyle = night ? 'rgba(28,26,38,0.3)' : 'rgba(110,86,60,0.28)'; G.lineWidth = 7; G.lineCap = 'round';
      for (const r of roads.slice(0, 3))
        for (const off of [-18, 18]) {
          G.beginPath();
          r.curve.forEach(([x, y], i) => {
            const nx = r.curve[Math.min(i + 1, r.curve.length - 1)], px = r.curve[Math.max(0, i - 1)];
            const dx = nx[0] - px[0], dy = nx[1] - px[1], L = Math.hypot(dx, dy) || 1;
            const X = x - (dy / L) * off, Y = y + (dx / L) * off;
            if (ell(PLAZA, X, Y) < 1.02) { G.moveTo(X, Y); return; }
            i ? G.lineTo(X, Y) : G.moveTo(X, Y);
          });
          G.stroke();
        }
      G.lineWidth = 16; G.strokeStyle = night ? 'rgba(26,24,36,0.22)' : 'rgba(120,92,64,0.25)';
      G.beginPath(); G.ellipse(FIRE.x, FIRE.y - 10, 260, 170, 0, 0, TAU); G.stroke();
      G.restore();
    }

    // ---------- props ----------
    const props = [], lights = [], occ = [];
    const OG = 300, occGrid = new Map();
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
    const addProp = (name, x, y, o) => {
      o = o || {};
      const s = NC.SPR[name], D = PROPS[name] || { kind: 'low' };
      if (!s) return null;
      const scale = o.scale || 1, flip = !!o.flip, w = s.w * scale, h = s.h * scale;
      const p = { kind: 'prop', name, x, y, scale, flip, sort: y };
      const walkThrough = NC.propIsWalkThrough(name, D.kind, scale);
      soft = NC.softProp ? NC.softProp(name, D, scale) : 0; // (js/passprops.js)
      switch (D.kind) {
        case 'fire': markEllipse(x, y - 22, w * 0.4, 30); p.shadow = [w * 0.42, 22]; break;
        case 'tree': markEllipse(x, y - w * 0.014, w * 0.085, w * 0.045); p.shadow = [w * 0.2, w * 0.055]; break;
        case 'house': markRect(x - (w * D.rect[0]) / 2, y - D.rect[1], x + (w * D.rect[0]) / 2, y - 4); p.shadow = [w * 0.46, 26]; break;
        case 'tall': markEllipse(x, y - 14, w * 0.2, 26); p.shadow = [w * 0.3, 22]; break;
        case 'rock': if (!walkThrough) markEllipse(x, y - h * 0.08, w * 0.38, Math.min(h * 0.22, w * 0.16)); p.shadow = [w * 0.44, w * 0.11]; break;
        case 'seat': if (!walkThrough) markEllipse(x, y - 12, w * 0.42, 16); p.shadow = [w * 0.46, 14]; break;
        case 'bush': if (!walkThrough) markEllipse(x, y - 6, w * 0.26, w * 0.11); p.shadow = [w * 0.42, w * 0.11]; break;
        case 'post': if (!walkThrough) markEllipse(x, y - 4, 16, 9); p.shadow = [22, 7]; break;
        case 'fence': markRect(x - w * 0.46, y - 22, x + w * 0.46, y - 2); p.shadow = [w * 0.46, 8]; break;
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
      occAdd(x, y, o.r || (D.kind === 'house' ? w * 0.42 : D.kind === 'tree' ? 70 * scale : D.kind === 'tall' ? 70 : D.kind === 'low' ? 22 : 40 * scale));
      return p;
    };

    // the campfire: its flames are drawn every frame onto its own picture (see the end of this file)
    const fire = addProp(NC.SPR.camp_fire ? 'camp_fire' : 'camp_firebase', FIRE.x, FIRE.y, { r: 150 });
    // its light: a wide warm pool over the plaza and a hot core round the fire (game.js centres a light 120 below its y)
    if (fire) {
      lights.push({ x: FIRE.x, y: FIRE.y - 120, r: 700, rgb: '255,140,60', flick: 1.7, owner: fire, campfire: true });
      lights.push({ x: FIRE.x, y: FIRE.y - 125, r: 360, rgb: '255,180,90', flick: 4.1, owner: fire, campfire: true });
    }
    occAdd(STALL.x, STALL.y, 190); // the merchant's stall (shop.js)
    occAdd(FORGE.x + 45, FORGE.y - 40, 250); // the blacksmith's forge and the smith (forge.js)
    for (const [n, x, y, o] of PLACED) addProp(n, x, y, o);
    for (const [x0, x1, y] of FENCES) {
      const s = NC.SPR.camp_fence;
      if (!s) continue;
      for (let x = x0; x <= x1; x += s.w * 0.9) addProp('camp_fence', Math.round(x), y, { r: 12 });
    }

    // the forest: trees everywhere outside the clearing, the hunting clearings, the training ground and the roads; a tree's
    // crown covers the ground north of its trunk, so none stands just south of a road near the warps
    const warpsAt = EXITS.map((e) => [e.x, e.y]);
    const exitCover = (x, y) => [[0, 160], [0, 320], [-130, 240], [130, 240]].some(([dx, dy]) => {
      const px = x + dx, py = y - dy;
      if (warpsAt.some(([wx, wy]) => Math.hypot(px - wx, py - wy) < 220)) return true;
      return roadDist(px, py) < 30;
    });
    // nor over the corners: a crown reaches ~500 up the screen from its trunk
    const campCover = (x, y) => [[0, 120], [0, 280], [0, 440], [-150, 300], [150, 300]].some(([dx, dy]) => inOpen(x + dx, y - dy, 0.95));
    const TREES = [['camp_oak', 1], ['camp_pine', 1.3], ['camp_tree', 0.8]];
    const pick = (list) => { let s = 0; for (const [, w] of list) s += w; let r = R() * s; for (const [n, w] of list) if ((r -= w) <= 0) return n; return list[0][0]; };
    for (let gy = 200; gy < H + 240; gy += 150)
      for (let gx = 60; gx < W + 60; gx += 175) {
        const x = gx + (R() - 0.5) * 130, y = gy + (R() - 0.5) * 100;
        const grove = GROVES.some(([gx0, gy0, gr]) => Math.hypot(x - gx0, (y - gy0) * 1.3) < gr);
        if (inOpen(x, y, grove ? 1.0 : 1.08)) continue;
        if (roadDist(x, y) < 110 || exitCover(x, y) || (!grove && campCover(x, y))) continue;
        const border = x < 260 || x > W - 260 || y < 330 || y > H - 120;
        const edge = openE(x, y) < 1.5;
        if (!border && !grove && R() < (edge ? 0.62 : 0.3)) continue;
        if (!free(x, y, 60)) continue;
        addProp(pick(TREES), Math.round(x), Math.round(y), { scale: 0.82 + R() * 0.3, flip: R() < 0.5 });
      }
    // bushes, rocks and logs: along the forest's edge and in it
    for (let n = 0; n < 260; n++) {
      const x = 80 + R() * (W - 160), y = 120 + R() * (H - 200), e = openE(x, y);
      if (e < 1.02 || roadDist(x, y) < 60 || exitCover(x, y)) continue;
      const name = R() < 0.55 ? 'camp_bush' : R() < 0.55 ? 'camp_rock' : 'camp_log';
      if (!free(x, y, 55)) continue;
      addProp(name, Math.round(x), Math.round(y), { scale: 0.8 + R() * 0.35, flip: R() < 0.5 });
    }
    // grass, flowers, ferns, mushrooms and pebbles: in the forest and along the corners' edges, almost none on the open
    // ground (the user: no clutter where people stand), none on the roads
    const LOW = [['camp_grass1', 3], ['camp_grass2', 2.4], ['camp_flowers', 1.2], ['camp_fern', 1.4], ['camp_shrooms', 0.6], ['camp_pebbles', 0.7]];
    for (let n = 0; n < 1300; n++) {
      const x = 40 + R() * (W - 80), y = 60 + R() * (H - 100);
      if (roadDist(x, y) < 26 || Math.hypot(x - FIRE.x, (y - FIRE.y) * 1.4) < 320 || ell(STALL, x, y) < 1.3) continue;
      const oe = openE(x, y);
      if (oe < 0.85 && R() > 0.03) continue;
      if (oe < 1.05 && R() > 0.35) continue;
      if (!free(x, y, 18)) continue;
      addProp(pick(LOW), Math.round(x), Math.round(y), { scale: 0.75 + R() * 0.4, flip: R() < 0.5, r: 16 });
    }

    // ---------- collision: the map's edge ----------
    markRect(0, 0, W, 40, true); markRect(0, H - 40, W, H, true); markRect(0, 0, 40, H, true); markRect(W - 40, 0, W, H, true);

    const world = {
      W, H, ground, groundDay, GS, props, decals: [], blocks: [], blockH: 0, lights, solid, terrainSolid, solidOwn: own, GW, GH, CELL, portals: [],
      spawn: { x: FIRE.x, y: FIRE.y + 240 }, camp: true, campFire: fire,
      zones: CORNERS.map((c) => ({ name: c.name, test: (x, y) => ell(c, x, y) < 1.05 })).concat([{ name: 'ค่ายกลางป่า', test: () => true }]),
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
    const allRoads = roads.map((r) => r.pts);
    world.warps = EXITS.map((e) => {
      const [ax, ay] = NC.arrivalPoint(world, allRoads, e.x, e.y);
      return { id: e.id, x: e.x, y: e.y, to: e.to, at: e.at, ax, ay };
    });
    // no monsters: the camp is safe ground for everyone (the training ground's dummies are dummy.js's)
    world.spawns = [];
    world.mapArt = mapArt(world, roads);
    // (the old minimap image, 1 px = 10 units, for hud.js's own drawMap when minimap.js is not there)
    const mm = document.createElement('canvas');
    mm.width = Math.ceil(W / 10); mm.height = Math.ceil(H / 10);
    mm.getContext('2d').drawImage(world.mapArt, 0, 0, mm.width, mm.height);
    world.minimap = mm;
    if (NC.passProps) NC.passProps(world); // js/passprops.js: shots past rocks and trees, the hero walks round them
    return world;
  };

  // ---------------- the minimap: the day ground, painted like a map, with the camp's roofs and the tree crowns ----------------
  const ART = 5;
  const CROWN = { camp_oak: '#6fae57', camp_pine: '#2f6f60', camp_tree: '#8cc463' };
  const ROOF = { camp_tent: '#e8dcc0', camp_belltent: '#5f8f6a', camp_puptent: '#b85a4a', camp_tarp: '#d8c8a4', camp_pavilion: '#34507a',
    camp_tower: '#8a6a48', camp_wagon: '#e2d6b8', camp_board: '#9a7454', camp_rack: '#9a7454' };
  const DOT = { camp_rock: '#aaa4b2', camp_bush: '#5fa058', camp_log: '#8e6a4c', camp_crates: '#b98a58', camp_barrels: '#a8784c',
    camp_sacks: '#d8c090', camp_woodpile: '#9a7454', camp_bench: '#8e6a4c', camp_stump: '#8e6a4c', camp_table: '#9a7454' };
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (v) => NC.clamp(Math.round(v * k), 0, 255); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  function mapArt(world) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(world.W / ART); cv.height = Math.ceil(world.H / ART);
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(world.groundDay, 0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'soft-light';
    c.fillStyle = 'rgba(255,232,190,0.55)'; c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'source-over';
    const props = world.props.slice().sort((a, b) => a.y - b.y);
    for (const p of props) {
      const col = DOT[p.name], s = NC.SPR[p.name];
      if (!col || !s) continue;
      const w = (s.w * p.scale) / ART;
      c.fillStyle = col; c.strokeStyle = 'rgba(42,36,53,0.55)'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(p.x / ART, p.y / ART - 2, Math.max(2.5, w * 0.3), Math.max(2, w * 0.2), 0, 0, TAU); c.fill(); c.stroke();
    }
    for (const p of props) {
      const col = ROOF[p.name], s = NC.SPR[p.name];
      if (!col || !s) continue;
      const w = (s.w * p.scale * 0.72) / ART, h = Math.max(4, (s.h * p.scale * 0.3) / ART), x = p.x / ART - w / 2, y = p.y / ART - h;
      c.fillStyle = 'rgba(30,24,40,0.35)'; c.fillRect(x + 2, y + 2, w, h);
      c.fillStyle = col; c.fillRect(x, y, w, h);
      c.fillStyle = shade(col, 0.74); c.fillRect(x, y + h / 2, w, h / 2);
      c.strokeStyle = 'rgba(42,36,53,0.8)'; c.lineWidth = 1.2; c.strokeRect(x, y, w, h);
    }
    for (const p of props) {
      const col = CROWN[p.name], s = NC.SPR[p.name];
      if (!col || !s) continue;
      const r = Math.max(4, (s.w * p.scale * 0.26) / ART), x = p.x / ART, y = (p.y - s.h * p.scale * 0.3) / ART;
      c.fillStyle = 'rgba(30,24,40,0.3)'; c.beginPath(); c.arc(x + 2, y + 3, r, 0, TAU); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.fillStyle = shade(col, 1.18); c.beginPath(); c.arc(x - r * 0.3, y - r * 0.32, r * 0.5, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(42,36,53,0.7)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
    }
    // the campfire: a little flame in a ring of stones
    const fx = FIRE.x / ART, fy = (FIRE.y - 20) / ART;
    c.fillStyle = '#8d8a96'; c.beginPath(); c.ellipse(fx, fy, 11, 7, 0, 0, TAU); c.fill();
    c.strokeStyle = '#2a2435'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#ff7a3a'; c.beginPath(); c.moveTo(fx - 6, fy + 2); c.quadraticCurveTo(fx - 6, fy - 9, fx, fy - 15); c.quadraticCurveTo(fx + 6, fy - 9, fx + 6, fy + 2); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffe07a'; c.beginPath(); c.moveTo(fx - 3, fy + 1); c.quadraticCurveTo(fx - 3, fy - 5, fx, fy - 9); c.quadraticCurveTo(fx + 3, fy - 5, fx + 3, fy + 1); c.closePath(); c.fill();
    return cv;
  }

  // ---------------- the campfire's flames: an animated picture ----------------
  // NC.SPR.camp_fire is the base art (stones, logs, coals) with flame tongues drawn on top of it (30 times a second), so
  // the fire is sorted and drawn like any prop
  const TONGUES = [ // x offset, width, height (world units, from the coals), phase; back ones first
    [-30, 40, 86, 1.7], [34, 42, 92, 3.1], [0, 62, 138, 0], [-14, 30, 62, 4.4], [18, 28, 56, 5.2],
  ];
  const ROOM = 150; // room above the base art for the flames
  let fireCv = null, fireCtx = null, fireBase = null, lastDraw = 0;
  const COAL = { x: 0.5, y: 0.58 }; // where the coals are on the base art (fractions)
  function makeFire() {
    const b = NC.SPR.camp_firebase;
    if (!b || fireCv) return;
    fireBase = b;
    const k = b.img.width / b.w; // stored px per world unit
    fireCv = document.createElement('canvas');
    fireCv.width = b.img.width; fireCv.height = b.img.height + Math.round(ROOM * k);
    fireCtx = fireCv.getContext('2d');
    NC.SPR.camp_fire = { img: fireCv, name: 'camp_fire', w: b.w, h: b.h + ROOM, ax: b.ax, ay: 1 };
    drawFire(0);
  }
  function drawFire(t) {
    const b = fireBase, c = fireCtx, k = b.img.width / b.w;
    c.clearRect(0, 0, fireCv.width, fireCv.height);
    const top = fireCv.height - b.img.height;
    c.drawImage(b.img, 0, top);
    const V = NC.VFX;
    if (!V) return;
    const cx = b.img.width * COAL.x, cy = top + b.img.height * COAL.y;
    for (const [dx, w, h, ph] of TONGUES) {
      const flick = 0.84 + 0.16 * Math.sin(t * 5.3 + ph * 2) + 0.06 * Math.sin(t * 13 + ph);
      V.flame(c, cx + dx * k + Math.sin(t * 2.1 + ph) * 3 * k, cy, w * k, h * k * flick, t * 7 + ph, V.PAL.fire, 1);
    }
  }
  // every frame of the game (hooked on NC.updateLoot, which game.js calls once per update): the flames move, sparks rise
  // while the hero is near, and at night the fire's warm light tints everything round it
  let glowFx = null;
  const nightness = (game) => {
    const hr = (((game.minutes / 60) % 24) + 24) % 24;
    return hr < 5 || hr >= 19.5 ? 1 : hr < 7 ? (7 - hr) / 2 : hr >= 17.5 ? (hr - 17.5) / 2 : 0;
  };
  function campFrame(game) {
    if (!fireCv || !game.world || !game.world.camp) return;
    if (game.time - lastDraw > 1 / 30 || game.time < lastDraw) { lastDraw = game.time; drawFire(game.time); }
    const p = game.player;
    if (p && Math.hypot(p.x - FIRE.x, p.y - FIRE.y) < 1400 && Math.random() < 0.35)
      NC.FX.add({ type: 'ember', x: FIRE.x + NC.rand(-28, 28), y: FIRE.y - 60 - NC.rand(0, 40), vx: NC.rand(-16, 16), vy: NC.rand(-120, -60), life: NC.rand(0.7, 1.3) });
    // the firelight: drawn after the night lighting (FX layer 'glow'), a soft warm tint over the plaza, a little glow
    // near the fire (the lighting pass only lifts the dark there; it can't make it warm). Put back after a map change
    // (maps.js empties the effect list)
    if (!glowFx || !NC.FX.list.includes(glowFx))
      glowFx = NC.FX.add({ type: 'custom', layer: 'glow', x: FIRE.x, y: FIRE.y - 40, life: Infinity, draw(ctx, fx) {
        const n = nightness(NC.game);
        if (n <= 0.01) return;
        const t = NC.game.time, f = 1 + Math.sin(t * 9.1) * 0.04 + Math.sin(t * 21.7) * 0.03;
        const pool = (op, r, rgb, a) => {
          ctx.save();
          ctx.globalCompositeOperation = op;
          ctx.translate(fx.x, fx.y); ctx.scale(1, 0.66);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * f);
          g.addColorStop(0, `rgba(${rgb},${a * n})`); g.addColorStop(0.55, `rgba(${rgb},${a * n * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = g; ctx.fillRect(-r * f, -r * f, 2 * r * f, 2 * r * f);
          ctx.restore();
        };
        pool('soft-light', 620, '255,150,60', 0.75);
        pool('lighter', 300, '255,130,50', 0.12);
      } });
  }
  (NC.assetsLoaded || (NC.assetsLoaded = [])).push(() => {
    makeFire();
    // (items.js and materials.js are loaded by now: wrap on top of theirs)
    const baseLoot = NC.updateLoot;
    NC.updateLoot = function (game) { campFrame(game); return baseLoot.apply(this, arguments); };
  });
})();
