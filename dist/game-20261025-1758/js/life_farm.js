/* life_farm.js — ปลูกผัก (farming), a life skill of js/life.js, and its own map ฟาร์มหิ่งห้อย (homefarm): the hero's
   small farm in a forest clearing, reached by the farm lane off the camp's east road. A safe map (no monsters): the
   farmhouse, a tool shed, a greenhouse, beehives, a lily pond, an orchard of cherry and maple trees (woodcutting,
   js/life_wood.js), a little quarry (mining, js/life_mine.js) and the garden: 24 plots behind a white picket fence,
   6 open at first (ยายกระต่าย opens more). All-new art (assets/life/hf_*, plot_*, crop_*, gd_scarecrow ...).
     a plot      B next to it or a click: till (hoe) → plant a seed (the seed menu) → water each stage (can) → harvest
     growing     real time, also while the game is closed: 3 stages (CROPS[..].mins in all); the moonflower ripens
                 only at night. Stars ★1–3 from the stages watered (+ fertiliser, − a crow), stars = how many you pick
     fertiliser  เจลใบไม้ (leaf slime jelly): grows 25% faster · หมวกเห็ดพราย (mushling cap): +1 star
     crows       at night a crow may land on a crop and peck at it: walk up to shoo it (else the crop loses a star);
                 scarecrows (from ยายกระต่าย) keep most away; farming Lv 25 keeps them all away
     fireflies   drift over the farm at night
   The teachers stand here too: ยายกระต่าย (seeds, plots, scarecrows, cans, buys vegetables), ลุงบีเวอร์ฟันเก (axes),
   ตุ่นหัวไฟ (pickaxes). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, L = NC.Life, TAU = Math.PI * 2;
  const MAT = NC.MATERIALS, K = NC.SkillKit;
  const $ = (id) => document.getElementById(id);
  const MAP = 'homefarm';

  // ---------------- the map ----------------
  Object.assign(NC.FIELD_PROPS, {
    hf_cherry: { kind: 'tree', crown: '#5fa050' }, hf_maple: { kind: 'tree', crown: '#e0782c' },
    hf_house: { kind: 'house', rect: [0.78, 96], light: [0.12, -0.3, 300, '255,196,120'], roof: '#6f9a4a' },
    hf_shed: { kind: 'house', rect: [0.72, 80], light: [0.1, -0.42, 170, '255,200,130'], roof: '#b8483c' },
    hf_greenhouse: { kind: 'house', rect: [0.74, 84], roof: '#dfe8e0' },
    hf_hives: { kind: 'rock' }, hf_fence: { kind: 'fence' }, hf_grass: { kind: 'low', sway: true }, hf_flowers: { kind: 'low', sway: true },
    hf_berrybush: { kind: 'bush' }, hf_rock: { kind: 'rock' }, hf_crates: { kind: 'rock' }, hf_barrow: { kind: 'rock' }, hf_pump: { kind: 'rock' },
    seed_cart: { kind: 'rock' }, chop_block: { kind: 'rock' }, mine_cart: { kind: 'rock' }, garden_sign: { kind: 'post' }, gd_scarecrow: { kind: 'post' },
  });
  NC.BIOMES.homefarm = {
    base: { n: [46, 76, 66], d: [120, 176, 96] }, patch: { n: [56, 86, 72], d: [142, 192, 106] }, vary: 16, patchScale: 480,
    road: { n: [72, 70, 80], d: [210, 176, 124] }, roadEdge: { n: [60, 70, 72], d: [170, 160, 100] }, roadMid: { n: [80, 78, 90], d: [226, 196, 146] },
    water: { n: [38, 66, 108], d: [96, 180, 216] }, deep: { n: [30, 52, 92], d: [70, 146, 198] }, shore: { n: [64, 76, 84], d: [198, 188, 140] },
    soil: { n: [66, 54, 62], d: [150, 104, 70] }, soilEdge: { n: [56, 62, 64], d: [134, 120, 80] }, // (the garden's tilled rows: like the sunflower field's)
    furrow: { n: [50, 40, 50], d: [116, 78, 52] }, ridge: { n: [82, 68, 74], d: [178, 130, 90] },
    specks: [
      { n: ['rgba(230,240,255,0.5)', 'rgba(255,240,190,0.45)'], d: ['#fff6d8', '#ffe07a', '#ffffff', '#cfe0ff'], count: 1800, size: [2.5, 5] },
      { n: ['rgba(30,54,46,0.35)'], d: ['rgba(76,132,62,0.35)'], count: 1500, size: [3, 7], blade: 1 },
    ],
    trees: [['hf_cherry', 1], ['hf_maple', 0.9]], border: [['hf_maple', 1.1], ['hf_cherry', 1]], grove: 0.62, fill: 0.55, lone: 0.18,
    bushes: [['hf_berrybush', 1]], nBush: 34, grass: [['hf_grass', 1]], nGrass: 380,
    flowers: [['hf_flowers', 1]], nPatch: 30,
    rocks: [['hf_rock', 1]], nRock: 14,
    shorePlants: [['hf_grass', 1]],
    mini: { ground: '#cfe6a8', road: '#9a7a52', water: '#7cb8e0', tree: 'rgba(80,130,70,0.55)' },
  };
  const orchard = (x0, y0, cols, rows, dx, dy, seed) => {
    const R = NC.rng(seed), out = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++)
        out.push([R() < 0.55 ? 'hf_cherry' : 'hf_maple', Math.round(x0 + i * dx + (j % 2) * dx * 0.5 + (R() - 0.5) * 40), Math.round(y0 + j * dy + (R() - 0.5) * 30),
          { flip: R() < 0.5, scale: 0.86 + R() * 0.18 }]);
    return out;
  };
  // the places everything stands (the teachers, the garden)
  const SPOT = { rabbit: { x: 1010, y: 1720 }, cart: { x: 930, y: 1610 }, beaver: { x: 2330, y: 1210 }, block: { x: 2240, y: 1150 },
    mole: { x: 2520, y: 2010 }, mcart: { x: 2420, y: 1930 } };
  const GARDEN = { x0: 1282, y0: 1578, dx: 132, dy: 100, cols: 6, rows: 4 };
  const SCARE = [[2082, 1640], [1168, 1640]];
  const CROP_K = 1.28; // (the crops a little bigger than drawn: a garden you can read at a glance)
  NC.MAPS[MAP] = {
    name: 'ฟาร์มหิ่งห้อย', lvText: 'ปลอดภัย · ฟาร์มของเรา', biome: 'homefarm', W: 3600, H: 2700, seed: 151, lifeSafe: true,
    lv: { slime: [1, 3], hollow: [1, 3] }, spawns: [], bots: [],
    warps: [{ id: 'west', x: 120, y: 1380, to: 'camp', at: 'farmlane' }],
    roads: [
      { w: 84, pts: [[40, 1380], [500, 1392], [900, 1334], [1250, 1290], [1700, 1286], [2150, 1300], [2460, 1290]] },
      { w: 58, pts: [[1610, 1290], [1612, 1480]] }, // the garden gate
      { w: 58, pts: [[2460, 1290], [2520, 1620], [2570, 1900]] }, // down to the quarry
      { w: 52, pts: [[900, 1334], [820, 1640], [720, 1860]] }, // to the pond
    ],
    // the garden's ground (the user, 2026-09-29: like the sunflower field, long rows of earth): fieldgen.js draws the
    // tilled patch and a furrow along each row; the rows fall on the plots' rows (a crop stands where fieldgen puts one)
    plots: [{ x0: GARDEN.x0 - 92, y0: GARDEN.y0 + 10 - 75, x1: GARDEN.x0 + (GARDEN.cols - 1) * GARDEN.dx + 92, y1: GARDEN.y0 + (GARDEN.rows - 1) * GARDEN.dy + 70, row: GARDEN.dy }],
    ponds: [{ x: 610, y: 2110, rx: 320, ry: 170, lilies: 7, reeds: 9 }],
    clear: [{ x: 1612, y: 1770, r: 640 }, { x: 1500, y: 1080, r: 560 }, { x: 2860, y: 2120, r: 420 }, { x: 2330, y: 1180, r: 170 }, { x: 960, y: 1660, r: 200 }],
    landmarks: [
      ['hf_house', 1500, 1010], ['hf_shed', 1990, 1060], ['hf_greenhouse', 1010, 1040],
      ['hf_pump', 1780, 1190], ['hf_crates', 1300, 1170], ['hf_barrow', 2150, 1170, { flip: true }],
      ['hf_hives', 2330, 1620], ['hf_flowers', 2230, 1700], ['hf_flowers', 2440, 1700, { flip: true }],
      ['seed_cart', SPOT.cart.x, SPOT.cart.y], ['chop_block', SPOT.block.x, SPOT.block.y], ['mine_cart', SPOT.mcart.x, SPOT.mcart.y, { flip: true }],
      ['garden_sign', 1520, 1478], ['hf_berrybush', 780, 1180], ['hf_berrybush', 2640, 1540, { flip: true }],
      ['hf_rock', 2700, 1760], ['hf_rock', 3160, 2380, { flip: true }], ['hf_rock', 3240, 1990, { scale: 0.8 }],
      ...orchard(2660, 600, 3, 3, 330, 260, 1511),
    ],
    landmarkCrowns: true,
    fences: [['hf_fence', 1110, 1510, 1488], ['hf_fence', 1720, 2120, 1488], ['hf_fence', 1110, 2120, 2046]],
    safe: [[0, 0, 3600, 2700]],
    zones: [
      { name: 'ลานบ้านไร่ของเรา', rect: [800, 700, 2250, 1420] },
      { name: 'แปลงผักของเรา', rect: [1100, 1420, 2200, 2080] },
      { name: 'สวนเชอร์รี่กับเมเปิล', rect: [2450, 380, 3500, 1400] },
      { name: 'ลานหินเล็ก', rect: [2400, 1760, 3450, 2560] },
      { name: 'บ่อบัวหิ่งห้อย', rect: [200, 1840, 1050, 2450] },
    ],
  };
  // the camp: a farm lane off the east road
  const camp = NC.MAPS.camp;
  if (camp && camp.exits && !camp.exits.some((e) => e.id === 'farmlane'))
    camp.exits.push({ id: 'farmlane', x: 2950, y: 1970, to: MAP, at: 'west', road: [[2640, 1618], [2790, 1765], [2920, 1905], [3040, 1970]] });
  // the little quarry's veins (placed by js/life_mine.js)
  L.fieldVeins = L.fieldVeins || [];
  L.fieldVeins.push([MAP, 'copper', 2760, 1960], [MAP, 'copper', 3000, 2160], [MAP, 'quartz', 2780, 2300], [MAP, 'iron', 3120, 1920]);

  // ---------------- crops ----------------
  const CROPS = {
    carrot: { name: 'แครอท', seed: 'sd_carrot', mat: 'lf_carrot', lv: 1, mins: 12, xp: 10, price: 5, st: ['crop_sprout', 'crop_carrot2', 'crop_carrot3', 'crop_carrot4'] },
    potato: { name: 'มันฝรั่ง', seed: 'sd_potato', mat: 'lf_potato', lv: 3, mins: 25, xp: 16, price: 8, st: ['crop_sprout', 'crop_potato2', 'crop_potato3', 'crop_potato4'] },
    wheat: { name: 'ข้าวสาลี', seed: 'sd_wheat', mat: 'lf_wheat', lv: 6, mins: 40, xp: 22, price: 10, st: ['crop_sprout', 'crop_wheat2', 'crop_wheat3', 'crop_wheat4'] },
    herb: { name: 'สมุนไพรฮีล', seed: 'sd_herb', mat: 'lf_herb', lv: 10, mins: 60, xp: 30, price: 15, st: ['crop_sprout', 'crop_herb2', 'crop_herb3', 'crop_herb4'] },
    pumpkin: { name: 'ฟักทอง', seed: 'sd_pumpkin', mat: 'lf_pumpkin', lv: 14, mins: 90, xp: 45, price: 25, st: ['crop_sprout', 'crop_pumpkin2', 'crop_pumpkin3', 'crop_pumpkin4'] },
    moonflower: { name: 'ดอกจันทร์', seed: 'sd_moonflower', mat: 'lf_moonflower', lv: 20, mins: 120, xp: 70, price: 45, night: true,
      st: ['crop_sprout', 'crop_moon2', 'crop_moon3', 'crop_moon4'] },
  };
  const ORDER = Object.keys(CROPS);
  const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)} ชม.${m % 60 ? ` ${m % 60} นาที` : ''}` : `${m} นาที`);
  for (const id of ORDER) {
    const C = CROPS[id];
    L.GUIDE.farm.push({ mat: C.mat, name: C.name, lv: C.lv, tier: 0, night: !!C.night,
      where: `เมล็ด ${C.price} เหรียญที่ยายกระต่าย · โตใน ${hm(C.mins)}${C.night ? ' · บานและเก็บได้เฉพาะกลางคืน' : ''}` });
    L.SOURCE[C.mat] = 'ปลูกที่แปลงผัก ฟาร์มหิ่งห้อย';
    L.SOURCE[C.seed] = 'ยายกระต่าย (ฟาร์มหิ่งห้อย) · มอนบางตัวดรอป';
  }
  // seeds that monsters drop now and then (materials.js: one roll each)
  const SEED_DROPS = { carrot: ['sd_carrot', 0.1], pumpkin: ['sd_pumpkin', 0.07], crow: ['sd_wheat', 0.07], zombie: ['sd_potato', 0.06],
    bee: ['sd_herb', 0.05], moth: ['sd_moonflower', 0.04] };
  for (const sp in SEED_DROPS) { if (!NC.MAT_DROPS[sp]) NC.MAT_DROPS[sp] = []; NC.MAT_DROPS[sp].push(SEED_DROPS[sp]); }

  // ---------------- the garden record (saved with the life record) ----------------
  const EXPAND = [{ n: 12, lv: 4, coins: 2000 }, { n: 18, lv: 12, coins: 10000 }, { n: 24, lv: 20, coins: 40000 }];
  // Shared with the online server and Unity by the content exporter.
  const CARE = {
    fertilisers: { mat_leaf_jelly: { bit: 1, speed: 1.25, stars: 0 }, mat_mush_cap: { bit: 2, speed: 1, stars: 1 } },
    xp: { till: 2, plant: 3, water: 2, shoo: 3 },
    growth: { firstLV: 5, secondLV: 20, bonus: 0.1 },
    scare: { price: 800, max: 2, keep: [0, 0.5, 0.8] },
    crow: { first: [25, 45], interval: [45, 95], peck: 16, cap: 2, reach: 170, immuneLV: 25, flySpeed: 340, fleeSpeed: 380, fleeSeconds: 2.5 },
    scarePositions: SCARE,
  };
  function garden(p) {
    const r = L.rec(p);
    if (!r.garden || !Array.isArray(r.garden.plots)) r.garden = { n: 6, scare: 0, plots: [] };
    const g = r.garden;
    while (g.plots.length < GARDEN.cols * GARDEN.rows) g.plots.push({ s: 'empty' });
    g.n = Math.max(6, Math.min(24, g.n | 0));
    g.scare = Math.max(0, Math.min(2, g.scare | 0));
    return g;
  }
  L.onLoad.push((game, p) => {
    garden(p);
  });
  const plotX = (i) => GARDEN.x0 + (i % GARDEN.cols) * GARDEN.dx;
  const plotY = (i) => GARDEN.y0 + Math.floor(i / GARDEN.cols) * GARDEN.dy;
  const speedOf = (p, pl) => (1 + (L.lvOf(p, 'farm') >= CARE.growth.firstLV ? CARE.growth.bonus : 0) + (L.lvOf(p, 'farm') >= CARE.growth.secondLV ? CARE.growth.bonus : 0)) * (pl.f & 1 ? CARE.fertilisers.mat_leaf_jelly.speed : 1);
  function stageOf(p, pl) {
    if (pl.s !== 'crop' || !CROPS[pl.c]) return -1;
    const C = CROPS[pl.c], len = (C.mins * 60000) / 3;
    return Math.min(3, Math.floor(((Date.now() - pl.t0) * speedOf(p, pl)) / len));
  }
  function msLeft(p, pl) {
    const C = CROPS[pl.c], total = C.mins * 60000;
    return Math.max(0, (total - (Date.now() - pl.t0) * speedOf(p, pl)) / speedOf(p, pl));
  }
  function starsOf(p, pl) {
    const wet = (pl.w || []).filter(Boolean).length;
    let s = 1 + (wet >= 2 ? 1 : 0) + (wet >= 3 ? 1 : 0) + (pl.f & 2 ? CARE.fertilisers.mat_mush_cap.stars : 0) - (pl.crow ? 1 : 0);
    if (L.lvOf(p, 'farm') >= 30) s += 1;
    return Math.max(1, Math.min(3, s));
  }
  const ripe = (game, p, pl) => stageOf(p, pl) >= 3;
  const canPick = (game, p, pl) => ripe(game, p, pl) && (!CROPS[pl.c].night || L.isNight(game));
  const minsText = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที`; };

  // ---------------- the world: plot tiles (ground decals), crops and scarecrows (props), the teachers' spots ----------------
  const baseField = NC.buildField;
  NC.buildField = function (def) {
    const w = baseField.apply(this, arguments);
    if (!def || def.id !== MAP) return w;
    w.lfGarden = [];
    for (let i = 0; i < GARDEN.cols * GARDEN.rows; i++) {
      const x = plotX(i), y = plotY(i);
      const decal = { name: '', x, y: y + 6 }; // (on the row's furrow)
      w.decals.push(decal);
      const crop = { kind: 'prop', name: '', x, y: y + 10, scale: CROP_K, flip: i % 2 === 1, sort: y + 10 };
      w.props.push(crop);
      w.lfGarden.push({ i, x, y, decal, crop });
    }
    w.lfScare = SCARE.map(([x, y]) => { const q = { kind: 'prop', name: '', x, y, scale: 1, flip: x < 1500, sort: y, shadow: [34, 10] }; w.props.push(q); return q; });
    // (the teachers stand where the clearings were kept for them: a little solid ellipse each)
    const mark = (cx, cy, rx, ry) => {
      for (let gy = Math.floor((cy - ry) / w.CELL); gy <= (cy + ry) / w.CELL; gy++)
        for (let gx = Math.floor((cx - rx) / w.CELL); gx <= (cx + rx) / w.CELL; gx++) {
          if (gx < 0 || gy < 0 || gx >= w.GW || gy >= w.GH) continue;
          const nx = (gx * w.CELL + w.CELL / 2 - cx) / rx, ny = (gy * w.CELL + w.CELL / 2 - cy) / ry;
          if (nx * nx + ny * ny <= 1) w.solid[gy * w.GW + gx] = 1;
        }
    };
    for (const k of ['rabbit', 'beaver', 'mole']) mark(SPOT[k].x, SPOT[k].y - 4, 30, 13);
    w.farm = true;
    w.bots = []; // (our own farm: no adventurer bots wander in, bots.js)
    return w;
  };
  const here = (game) => !!(game && game.world && game.world.lfGarden && game.mapId === MAP);
  // a plot's piece of its long row (drawn here, see-through, so it sits on the day and the night ground alike): rough
  // bare earth (not tilled), a fresh mound (tilled; the mounds of a row meet into one long ridge), a dark wet mound
  function rowPieces() {
    if (NC.SPR.gd_row_mound) return;
    const PX = 3, W = GARDEN.dx, H = 44; // (as wide as a plot's step: the mounds of a row join into one ridge)
    const make = (name, kind) => {
      const cv = document.createElement('canvas'); cv.width = W * PX; cv.height = H * PX;
      const g = cv.getContext('2d'), R = NC.rng(name.length * 131 + 7);
      g.scale(PX, PX);
      const clods = (n, dark, light, spread) => {
        for (let i = 0; i < n; i++) {
          const x = 8 + R() * (W - 16), y = H / 2 + (R() - 0.5) * spread;
          g.fillStyle = R() < 0.55 ? dark : light;
          g.beginPath(); g.ellipse(x, y, 1.8 + R() * 3.4, 1.2 + R() * 1.8, (R() - 0.5) * 0.6, 0, TAU); g.fill();
        }
      };
      if (kind === 'rough') clods(30, 'rgba(28,18,16,0.3)', 'rgba(255,232,200,0.16)', 20);
      else if (kind === 'weeds') { // not ours yet: a few weeds sprouting from the row
        clods(10, 'rgba(28,18,16,0.25)', 'rgba(255,232,200,0.12)', 18);
        for (let k = 0; k < 4; k++) {
          const x = 14 + (k + R() * 0.8) * (W - 28) / 4, y = H / 2 + 6 + (R() - 0.5) * 8, s = 0.7 + R() * 0.5;
          for (let b = -2; b <= 2; b++) {
            const tip = [x + b * 3 * s + (R() - 0.5) * 2, y - (9 - Math.abs(b) * 2) * s - R() * 3];
            g.beginPath(); g.moveTo(x + b * 1.2 - 1.2, y); g.quadraticCurveTo(x + b * 2, y - 4 * s, tip[0], tip[1]); g.lineTo(x + b * 1.2 + 1.2, y); g.closePath();
            g.fillStyle = b % 2 ? 'rgba(96,150,70,0.9)' : 'rgba(122,178,84,0.9)'; g.fill();
          }
        }
      }
      else {
        const wet = kind === 'wet';
        const mound = (inset, ry, dy, rad) => { g.beginPath(); g.roundRect(inset, H / 2 + dy - ry, W - inset * 2, ry * 2, rad); };
        g.fillStyle = 'rgba(18,10,10,0.24)'; mound(0, 14, 5, 12); g.fill(); // its shadow on the furrow
        g.fillStyle = wet ? 'rgba(22,16,40,0.56)' : 'rgba(48,26,16,0.4)'; mound(1, 13, 0, 12); g.fill();
        g.fillStyle = wet ? 'rgba(160,190,255,0.14)' : 'rgba(255,214,170,0.17)'; mound(6, 5, -6, 5); g.fill(); // the lit top
        clods(22, wet ? 'rgba(10,8,24,0.35)' : 'rgba(30,16,10,0.34)', wet ? 'rgba(190,215,255,0.22)' : 'rgba(255,226,190,0.22)', 16);
        if (wet) {
          g.strokeStyle = 'rgba(215,235,255,0.5)'; g.lineWidth = 1.2; g.lineCap = 'round';
          for (let i = 0; i < 7; i++) { const x = 14 + R() * (W - 28), y = H / 2 - 6 + R() * 8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4 + R() * 6, y - 0.6); g.stroke(); }
        }
      }
      NC.SPR[name] = { name, img: cv, w: W, h: H, ax: 0.5, ay: 0.5 };
    };
    make('gd_row_rough', 'rough'); make('gd_row_mound', 'mound'); make('gd_row_wet', 'wet'); make('gd_row_weeds', 'weeds');
  }
  function sync(game) {
    rowPieces();
    const w = game.world, p = game.player, g = garden(p), night = L.isNight(game);
    for (const q of w.lfGarden) {
      const pl = g.plots[q.i];
      if (q.i >= g.n) { q.decal.name = 'gd_row_weeds'; q.crop.name = ''; continue; } // (not ours yet: a few weeds)
      if (pl.s === 'empty') { q.decal.name = 'gd_row_rough'; q.crop.name = ''; continue; }
      if (pl.s === 'tilled') { q.decal.name = 'gd_row_mound'; q.crop.name = ''; continue; }
      const st = stageOf(p, pl), C = CROPS[pl.c];
      q.decal.name = st < 3 && pl.w && pl.w[st] ? 'gd_row_wet' : 'gd_row_mound';
      q.crop.name = st >= 3 && C.night && !night && NC.SPR.crop_moon4d ? 'crop_moon4d' : C.st[Math.max(0, st)];
    }
    w.lfScare.forEach((q, k) => { q.name = k < g.scare ? 'gd_scarecrow' : ''; });
  }

  // ---------------- working a plot (instant: no timing game) ----------------
  function plotNode(q) {
    const n = { skill: 'farm', x: q.x, y: q.y + 8, hx: q.x, hy: q.y - 10, reach: 92, lv: 1, tier: 0, plot: q, box: [q.x - 56, q.y - 44, q.x + 56, q.y + 32], tagY: q.y - 100,
      ok: () => { const g = NC.game; return !!g && q.i < garden(g.player).n; }, use: usePlot };
    Object.defineProperty(n, 'verb', { get: () => verbOf(NC.game, q) });
    Object.defineProperty(n, 'label', { get: () => labelOf(NC.game, q) });
    return n;
  }
  function verbOf(game, q) {
    const p = game.player, pl = garden(p).plots[q.i];
    if (pl.s === 'empty') return 'พรวนดิน';
    if (pl.s === 'tilled') return 'ปลูกผัก';
    const st = stageOf(p, pl);
    if (st >= 3) return canPick(game, p, pl) ? 'เก็บเกี่ยว' : 'รอกลางคืนค่อยเก็บ';
    return pl.w && pl.w[st] ? 'ดูแปลงผัก' : 'รดน้ำ';
  }
  function labelOf(game, q) {
    const p = game.player, pl = garden(p).plots[q.i];
    if (pl.s !== 'crop') return '';
    const st = stageOf(p, pl), C = CROPS[pl.c], stars = `★ ${starsOf(p, pl)}/3`;
    return st >= 3 ? `${C.name} สุกแล้ว ${stars}` : `${C.name} อีก ${minsText(msLeft(p, pl))} ${stars}`;
  }
  const plotFace = (p, q) => { p.aim = NC.angle(p.x, p.y - 50, q.x, q.y); p.face = q.x >= p.x ? 1 : -1; };
  function usePlot(game, p, n) {
    const q = n.plot, g = garden(p), pl = g.plots[q.i];
    closePop();
    plotFace(p, q);
    if (pl.s === 'empty') return till(game, p, q, pl);
    if (pl.s === 'tilled') return seedMenu(game, p, q);
    const st = stageOf(p, pl);
    if (st >= 3) {
      if (canPick(game, p, pl)) return harvest(game, p, q, pl);
      FX.text(q.x, q.y - 120, 'ดอกจันทร์บานตอนกลางคืน มาเก็บตอนกลางคืนนะ', '#cfe0ff', 20);
      return;
    }
    if (!(pl.w && pl.w[st])) return water(game, p, q, st);
    return careMenu(game, p, q, pl);
  }
  function busy(game, p, secs) { p.skillLock = Math.max(p.skillLock || 0, secs); }
  function till(game, p, q, pl) {
    const remote = L.farmAction && L.farmAction(game, 'till', q.i);
    if (remote === 'pending') return;
    L.showTool(game, p, 't_hoe', 0.75);
    if (NC.Anim.CLIPS.smash1) K.pose(game, p, 'smash1', 0.45);
    busy(game, p, 0.45);
    V.at(0.24, () => {
      if (!remote) pl.s = 'tilled';
      V.debris(q.x, q.y, 7, V.PAL.rock, { size: 0.5, min: 120, max: 300 });
      V.smoke(q.x, q.y + 4, 5, '#a88a64', '#d8c4a0', { size: 0.8, max: 160, lifeK: 0.7, a: 0.5 });
      if (!remote) L.addXp(game, 'farm', CARE.xp.till);
      sync(game);
    });
  }
  function plant(game, p, q, id) {
    const C = CROPS[id], pl = garden(p).plots[q.i];
    if (!C || pl.s !== 'tilled' || NC.matCount(p, C.seed) <= 0 || L.lvOf(p, 'farm') < C.lv) return;
    const remote = L.farmAction && L.farmAction(game, 'plant', q.i, id);
    if (remote === 'pending') return;
    if (!remote) {
      p.mats[C.seed] -= 1; if (!p.mats[C.seed]) delete p.mats[C.seed];
      NC.saveTrade(game);
    }
    L.showTool(game, p, 't_none', 0.6); // (empty hands)
    if (NC.Anim.CLIPS.lfKneel) K.pose(game, p, 'lfKneel', 0.5);
    busy(game, p, 0.5);
    if (!remote) Object.assign(pl, { s: 'crop', c: id, t0: Date.now(), w: [0, 0, 0], f: 0, crow: 0 });
    V.motes(q.x, q.y, 6, '150,220,120', { rise: 50, spread: 30, size: 0.8 });
    if (!remote) { L.addXp(game, 'farm', CARE.xp.plant); NC.HUD.log(`ปลูก${C.name}แล้ว โตใน ${hm(C.mins)}`, 'item'); }
    sync(game);
    L.save(game);
  }
  // the can waters this plot and, with a better can, its neighbours (tier 2: left and right, 3: a cross, 4: every plot)
  function water(game, p, q, st) {
    const remote = L.farmAction && L.farmAction(game, 'water', q.i);
    if (remote === 'pending') return;
    const g = garden(p), tier = L.toolTier(p, 'can'), c = q.i % GARDEN.cols, r = Math.floor(q.i / GARDEN.cols);
    let list = [q.i];
    if (tier >= 2) { if (c > 0) list.push(q.i - 1); if (c < GARDEN.cols - 1) list.push(q.i + 1); }
    if (tier >= 3) { if (r > 0) list.push(q.i - GARDEN.cols); if (r < GARDEN.rows - 1) list.push(q.i + GARDEN.cols); }
    if (tier >= 4) list = g.plots.map((_, i) => i);
    L.showTool(game, p, 't_can' + tier, 1.1);
    if (NC.Anim.CLIPS.lfWater) K.pose(game, p, 'lfWater', 0.7);
    busy(game, p, 0.7);
    V.at(0.25, () => {
      let n = 0;
      const w = game.world;
      for (const i of list) {
        const pl = g.plots[i];
        if (i >= g.n || pl.s !== 'crop') continue;
        const s = stageOf(p, pl);
        if (s < 0 || s >= 3 || (!remote && pl.w && pl.w[s])) continue;
        if (!remote) { pl.w = pl.w || [0, 0, 0]; pl.w[s] = 1; }
        n++;
        const x = plotX(i), y = plotY(i);
        V.sparks(x, y - 30, 6, '140,200,255', { ang: Math.PI / 2, spread: 0.5, min: 120, max: 260, size: 0.6 });
        V.ring(x, y, 8, 50, 4, '160,210,255', 0.4);
      }
      if (n && !remote) { L.addXp(game, 'farm', CARE.xp.water * n); FX.text(q.x, q.y - 110, n > 1 ? `รดน้ำ ${n} แปลง` : 'รดน้ำแล้ว', '#bfe4ff', 22); }
      void w;
      sync(game);
      L.save(game);
    });
  }
  function harvest(game, p, q, pl) {
    const C = CROPS[pl.c], stars = starsOf(p, pl), lv = L.lvOf(p, 'farm');
    const remote = L.farmAction && L.farmAction(game, 'harvest', q.i);
    if (remote === 'pending') return;
    L.showTool(game, p, 't_none', 0.6); // (empty hands)
    if (NC.Anim.CLIPS.lfKneel) K.pose(game, p, 'lfKneel', 0.5);
    busy(game, p, 0.5);
    if (remote) return; // The authoritative snapshot supplies the crop reset, items and XP together.
    let n = stars + (lv >= 10 && L.roll(0.25) ? 1 : 0);
    L.drop(game, C.mat, n, q.x, q.y, { spread: 30 });
    if (L.roll(0.3 + (lv >= 15 ? 0.2 : 0))) L.drop(game, C.seed, 1, q.x, q.y, { spread: 20 });
    L.addXp(game, 'farm', Math.round(C.xp * (0.8 + 0.2 * stars)));
    FX.text(q.x, q.y - 120, `${C.name} ${'★'.repeat(stars)}`, '#ffe58f', 26);
    FX.stars(q.x, q.y - 40, 8 + stars * 4, '255,230,140', { speed: 180, size: 0.7 });
    NC.HUD.log(`เก็บ${C.name}ได้ ${n} (${'★'.repeat(stars)})`, 'item');
    Object.assign(pl, { s: 'tilled', c: null, t0: 0, w: null, f: 0, crow: 0 });
    sync(game);
    L.save(game);
  }

  // ---------------- the small menus over a plot (seeds, fertiliser) ----------------
  let pop = null, popPlot = null;
  function screenOf(game, x, y) {
    const cv = $('view'), r = cv ? cv.getBoundingClientRect() : { left: 0, top: 0 };
    return [r.left + ((x - game.cam.x) * game.scale) / game.dpr, r.top + ((y - game.cam.y) * game.scale) / game.dpr];
  }
  function openPop(game, q, html) {
    if (!pop) {
      pop = document.createElement('div');
      pop.className = 'lf-pop'; pop.hidden = true;
      document.body.appendChild(pop);
      pop.addEventListener('mousedown', (e) => e.stopPropagation());
      pop.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled || !popPlot) return;
        const game = NC.game, p = game.player, q2 = popPlot;
        if (b.dataset.seed) plant(game, p, q2, b.dataset.seed);
        else if (b.dataset.fert) fertilise(game, p, q2, Number(b.dataset.fert));
        closePop();
      });
    }
    pop.innerHTML = html;
    const [sx, sy] = screenOf(game, q.x, q.y - 50);
    pop.style.left = sx + 'px'; pop.style.top = sy + 'px';
    pop.hidden = false;
    popPlot = q;
  }
  function closePop() { if (pop) pop.hidden = true; popPlot = null; }
  L.closePop = closePop;
  function seedMenu(game, p, q) {
    const lv = L.lvOf(p, 'farm');
    const any = ORDER.some((id) => NC.matCount(p, CROPS[id].seed) > 0);
    if (!any) { FX.text(q.x, q.y - 110, 'ไม่มีเมล็ด ซื้อได้ที่ยายกระต่ายข้างแปลงผัก', '#ffe0b0', 20); return; }
    let h = '<div class="h">เลือกเมล็ดที่จะปลูก</div>';
    for (const id of ORDER) {
      const C = CROPS[id], n = NC.matCount(p, C.seed);
      if (!n && lv < C.lv) continue;
      const lock = lv < C.lv;
      h += `<button data-seed="${id}" ${n && !lock ? '' : 'disabled'}><img src="${NC.matIcon(C.seed)}" alt="">${C.name}` +
        `<em>${lock ? `Lv ${C.lv}` : `×${n}`}</em></button>`;
    }
    openPop(game, q, h);
  }
  function careMenu(game, p, q, pl) {
    const C = CROPS[pl.c], grow = NC.matCount(p, 'mat_leaf_jelly'), star = NC.matCount(p, 'mat_mush_cap');
    let h = `<div class="h">${C.name} · อีก ${minsText(msLeft(p, pl))} · ★ ${starsOf(p, pl)}/3</div>`;
    h += `<button data-fert="1" ${grow && !(pl.f & 1) ? '' : 'disabled'}><img src="${NC.matIcon('mat_leaf_jelly')}" alt="">ปุ๋ยเร่งโต (เจลใบไม้)<em>${pl.f & 1 ? 'ใส่แล้ว' : `×${grow}`}</em></button>`;
    h += `<button data-fert="2" ${star && !(pl.f & 2) ? '' : 'disabled'}><img src="${NC.matIcon('mat_mush_cap')}" alt="">ปุ๋ยดาว (หมวกเห็ดพราย)<em>${pl.f & 2 ? 'ใส่แล้ว' : `×${star}`}</em></button>`;
    openPop(game, q, h);
  }
  function fertilise(game, p, q, kind) {
    const pl = garden(p).plots[q.i], id = kind === 1 ? 'mat_leaf_jelly' : 'mat_mush_cap';
    if (pl.s !== 'crop' || pl.f & kind || NC.matCount(p, id) <= 0) return;
    const remote = L.farmAction && L.farmAction(game, 'fertilise', q.i, id);
    if (remote === 'pending') return;
    if (!remote) {
      p.mats[id] -= 1; if (!p.mats[id]) delete p.mats[id];
      NC.saveTrade(game);
      pl.f = (pl.f || 0) | kind;
    }
    V.motes(q.x, q.y, 10, kind === 1 ? '150,230,120' : '255,220,140', { rise: 70, spread: 40, size: 0.9 });
    if (!remote) FX.text(q.x, q.y - 110, kind === 1 ? 'โตเร็วขึ้น!' : 'ได้ดาวเพิ่ม!', '#ffe58f', 22);
    L.save(game);
  }
  addEventListener('keydown', (e) => { if (pop && !pop.hidden && (e.code === 'Escape' || e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD' || e.code.startsWith('Arrow'))) closePop(); });
  addEventListener('mousedown', () => { if (pop && !pop.hidden) closePop(); });

  // ---------------- two moves: kneeling (planting, picking) and pouring the can ----------------
  if (NC.Anim && NC.Anim.addClip) {
    NC.Anim.addClip('lfKneel', { dur: 0.55, in: 0.1, out: 0.16, keys: {
      y: [[0.15, 16, 'out'], [0.42, 16], [0.55, 0]], kF: [[0.15, 1.3], [0.42, 1.3], [0.55, 0.15]], kB: [[0.15, 1.1], [0.42, 1.1], [0.55, 0.15]],
      lean: [[0.15, 0.24], [0.42, 0.24], [0.55, 0]], head: [[0.15, 0.16], [0.55, 0]],
      aF: [[0.15, 0.9], [0.3, 1.1], [0.42, 0.95], [0.55, 1.3]], eF: [[0.15, 0.2], [0.55, 0.1]], aB: [[0.15, 0.7], [0.55, 1.2]],
    } });
    NC.Anim.addClip('lfWater', { dur: 0.9, in: 0.12, out: 0.2, keys: { // (the can hangs from its handle: tilted forward it pours)
      aF: [[0.15, 0.55, 'out'], [0.72, 0.5], [0.9, 1.2]], eF: [[0.15, 0.2], [0.9, 0.2]], wAng: [[0.15, -1.57, 'out'], [0.3, -1.0], [0.72, -0.95], [0.9, -1.57]],
      lean: [[0.15, 0.1], [0.72, 0.12], [0.9, 0]], head: [[0.15, 0.12], [0.9, 0]],
    } });
  }

  // ---------------- crows at night; fireflies ----------------
  let crowT = 20, lastWorld = null;
  const crows = [];
  function spawnCrow(game, p) {
    const g = garden(p), w = game.world;
    const targets = w.lfGarden.filter((q) => q.i < g.n && g.plots[q.i].s === 'crop' && !g.plots[q.i].crow && !crows.some((c) => c.q === q));
    if (!targets.length) return;
    const q = targets[Math.floor(Math.random() * targets.length)];
    const from = Math.random() < 0.5 ? -1 : 1, x = game.cam.x + (from < 0 ? -200 : game.vw + 200), y = q.y - 420;
    const c = { q, x, y, state: 'in', t: 0, face: from < 0 ? 1 : -1 };
    c.fx = FX.add({ type: 'lfcrow', layer: 'sorted', life: 1e9, x, y, sort: q.y, crow: c });
    crows.push(c);
  }
  function crowFrame(game, dt) {
    const p = game.player, g = garden(p);
    for (let k = crows.length - 1; k >= 0; k--) {
      const c = crows[k];
      c.t += dt;
      if (c.state === 'in') {
        const tx = c.q.x + 18, ty = c.q.y - 8, d = Math.hypot(tx - c.x, ty - c.y), s = CARE.crow.flySpeed * dt;
        if (d <= s) { c.x = tx; c.y = ty; c.state = 'peck'; c.t = 0; }
        else { c.x += ((tx - c.x) / d) * s; c.y += ((ty - c.y) / d) * s; c.face = tx > c.x ? 1 : -1; }
      } else if (c.state === 'peck') {
        if (NC.dist(p.x, p.y, c.x, c.y) < CARE.crow.reach) {
          c.state = 'out'; c.t = 0; c.face = p.x < c.x ? 1 : -1;
          FX.text(c.x, c.y - 90, 'ไล่อีกาไปแล้ว!', '#ffe0b0', 20);
          L.addXp(game, 'farm', CARE.xp.shoo);
        } else if (c.t > CARE.crow.peck) {
          const pl = g.plots[c.q.i];
          if (pl.s === 'crop') { pl.crow = 1; L.save(game); }
          c.state = 'out'; c.t = 0;
        }
      } else {
        c.x += c.face * CARE.crow.fleeSpeed * dt; c.y -= 260 * dt;
        if (c.t > CARE.crow.fleeSeconds) { if (c.fx) c.fx.dead = true; crows.splice(k, 1); continue; }
      }
      if (c.fx) { c.fx.x = c.x; c.fx.y = c.y; c.fx.sort = c.state === 'peck' ? c.q.y + 12 : c.q.y + 40; }
    }
  }
  FX.def('lfcrow', (ctx, q) => {
    const c = q.crow, G = NC.game;
    if (!c || !G) return;
    const flying = c.state !== 'peck', flap = flying ? Math.sin(G.time * 28) > 0 : Math.sin(G.time * 9) > 0.7;
    const hover = flying ? 30 : 0, peck = c.state === 'peck' ? Math.max(0, Math.sin(G.time * 9)) * 5 : 0;
    NC.drawSpr(ctx, flap && NC.SPR.crow_b ? 'crow_b' : 'crow', c.x, c.y - hover + peck, { flip: c.face > 0, scale: 0.8 });
  }, 'sorted');
  // fireflies: little lights drifting over the whole farm at night (after the night light, so they glow)
  let fireflies = null;
  function ensureFireflies() {
    if (fireflies && FX.list.includes(fireflies)) return;
    const R = NC.rng(77), dots = [];
    for (let i = 0; i < 140; i++) dots.push([R() * 3600, R() * 2700, R() * TAU, 0.6 + R() * 0.8]);
    fireflies = FX.add({ type: 'lfflies', layer: 'glow', life: 1e9, x: 0, y: 0, dots });
  }
  FX.def('lfflies', (ctx, q) => {
    const G = NC.game;
    if (!G || !here(G)) return;
    const h = L.hour(G), n = h < 5 || h >= 19.5 ? 1 : h < 6.5 ? (6.5 - h) / 1.5 : h >= 18 ? (h - 18) / 1.5 : 0;
    if (n <= 0.02) return;
    const c = G.cam, t = G.time;
    for (const [x0, y0, ph, sp] of q.dots) {
      const x = x0 + Math.sin(t * 0.4 * sp + ph) * 60, y = y0 + Math.cos(t * 0.33 * sp + ph * 1.7) * 40;
      if (x < c.x - 40 || x > c.x + G.vw + 40 || y < c.y - 40 || y > c.y + G.vh + 40) continue;
      const blink = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.2 * sp + ph * 3));
      V.glow(ctx, x, y, 18, '210,255,140', 0.75 * blink * n, true);
    }
  });

  L.ticks.push((game, dt) => {
    if (!here(game)) { if (crows.length) { for (const c of crows) if (c.fx) c.fx.dead = true; crows.length = 0; } lastWorld = game.world; closePopIfAway(game); return; }
    const w = game.world, p = game.player;
    if (w !== lastWorld) { lastWorld = w; crowT = CARE.crow.first[0] + Math.random() * (CARE.crow.first[1] - CARE.crow.first[0]); }
    if (!w.lfPlots) w.lfPlots = w.lfGarden.map(plotNode);
    sync(game);
    ensureFireflies();
    crowFrame(game, dt);
    if (!L.noLocalCrows && L.isNight(game) && L.lvOf(p, 'farm') < CARE.crow.immuneLV && (crowT -= dt) <= 0) { // (?online: the server's crows, js/online/extras.js)
      crowT = CARE.crow.interval[0] + Math.random() * (CARE.crow.interval[1] - CARE.crow.interval[0]);
      const g = garden(p), keep = CARE.scare.keep[g.scare] || 0;
      if (Math.random() >= keep && crows.length < CARE.crow.cap) spawnCrow(game, p);
    }
    closePopIfAway(game);
  });
  function closePopIfAway(game) {
    if (!pop || pop.hidden || !popPlot) return;
    const p = game.player;
    if (!here(game) || NC.dist(p.x, p.y, popPlot.x, popPlot.y) > 180) closePop();
  }
  L.finders.push((game) => (here(game) && game.world.lfPlots) || null);

  // ---------------- the window's garden panel (H) ----------------
  L.farmPanel = function (game, p) {
    const g = garden(p);
    let h = `<div class="lf-box"><div class="lf-h">แปลงผักของเรา (${g.n}/24) · ฟาร์มหิ่งห้อย</div><div class="lf-plots">`;
    for (let i = 0; i < 24; i++) {
      const pl = g.plots[i];
      if (i >= g.n) { h += '<div class="lf-plot locked"></div>'; continue; }
      if (pl.s !== 'crop') { h += `<div class="lf-plot"><b>${pl.s === 'tilled' ? 'พรวนแล้ว' : 'ว่าง'}</b></div>`; continue; }
      const C = CROPS[pl.c], r = ripe(game, p, pl);
      h += `<div class="lf-plot ${r ? 'ripe' : ''}"><img src="${NC.matIcon(C.mat)}" alt=""><b>${r ? 'สุกแล้ว!' : minsText(msLeft(p, pl))}</b></div>`;
    }
    h += '</div><div class="lf-hint">ทางไปฟาร์ม: ทางแยกจากถนนตะวันออกของค่าย · ผักโตต่อแม้ปิดเกม · รดน้ำทุกระยะได้ดาวเพิ่ม</div></div>';
    return h;
  };

  // ---------------- the teachers on the farm ----------------
  const farmHere = (game) => !!(game && game.mapId === MAP);
  const seedRow = (p, id) => {
    const C = CROPS[id], lv = L.lvOf(p, 'farm'), lock = lv < C.lv;
    return `<div class="mt-item"><img src="${NC.matIcon(C.seed)}" alt=""><div><div class="n">${MAT[C.seed].name}${C.night ? ' ☾' : ''}</div>` +
      `<div class="w">${lock ? `ต้องมีปลูกผัก Lv ${C.lv}` : `${C.price} เหรียญ · โตใน ${hm(C.mins)} · มีอยู่ ${NC.matCount(p, C.seed)}`}</div></div>` +
      `<div class="mt-btns"><button data-act="seed:${id}:1" ${!lock && p.coins >= C.price ? '' : 'disabled'}>ซื้อ 1</button>` +
      `<button data-act="seed:${id}:5" ${!lock && p.coins >= C.price * 5 ? '' : 'disabled'}>ซื้อ 5</button></div></div>`;
  };
  const CROP_MATS = ORDER.map((id) => CROPS[id].mat);
  const cropWorth = (p) => CROP_MATS.reduce((s, id) => s + (NC.Econ && NC.Econ.quote ? NC.Econ.quote(id, NC.matCount(p, id), p) : NC.matCount(p, id) * MAT[id].price), 0); // (piece by piece: economy.js)
  const rabbit = L.addMentor({
    id: 'rabbit', name: 'ยายกระต่าย', title: 'ครูปลูกผัก · เมล็ดพันธุ์ ขยายแปลง', sprite: 'npc_rabbit', spriteB: 'npc_rabbit_b', h: 140,
    x: SPOT.rabbit.x, y: SPOT.rabbit.y, here: farmHere,
    greet: ['มาปลูกผักกันเถอะหลาน~', 'รดน้ำทุกระยะ ผักจะได้ดาวเยอะ ๆ นะ', 'กลางคืนระวังอีกามาแอบกินผักด้วยล่ะ'],
    chat: ['ดอกจันทร์บานเฉพาะกลางคืนเท่านั้นนะ', 'เจลใบไม้เป็นปุ๋ยชั้นดีเลย', 'ยายมีหุ่นไล่กาน่ารัก ๆ ขายด้วยนะ', 'หิ่งห้อยเยอะจัง คืนนี้สวยเชียว'],
    talk: (game, p) => {
      const g = garden(p);
      if (!g.plots.some((pl) => pl.s !== 'empty')) return 'แปลงผักอยู่ในรั้วตรงนี้เลย เดินไปใกล้แปลงแล้วกด B พรวนดิน แล้วเลือกเมล็ดปลูกได้เลยจ้ะ ซื้อเมล็ดกับยายก่อนนะ';
      return 'ผักโตเองแม้หลานจะไม่อยู่ รดน้ำทุกระยะได้ดาวเยอะ ปุ๋ยก็ช่วยได้นะจ๊ะ';
    },
    render(game, p) {
      const g = garden(p), next = EXPAND.find((e) => e.n > g.n), lv = L.lvOf(p, 'farm');
      let h = '<div class="mt-sec">' + ORDER.map((id) => seedRow(p, id)).join('') + '</div><div class="mt-sec">';
      if (next) h += `<div class="mt-item"><img src="${L.lifeIcon('plot_tilled')}" alt=""><div><div class="n">ขยายแปลงผักเป็น ${next.n} แปลง</div>` +
        `<div class="w">${NC.fmtCoins(next.coins)} เหรียญ · ต้องมีปลูกผัก Lv ${next.lv}${lv >= next.lv ? ' ✓' : ''}</div></div>` +
        `<button data-act="expand" ${lv >= next.lv && p.coins >= next.coins ? '' : 'disabled'}>ขยาย</button></div>`;
      if (g.scare < 2) h += `<div class="mt-item"><img src="${L.lifeIcon('gd_scarecrow')}" alt=""><div><div class="n">หุ่นไล่กา (${g.scare}/2)</div>` +
        `<div class="w">800 เหรียญ · ไล่อีกาตอนกลางคืน ตัวเดียวกันได้ครึ่งหนึ่ง สองตัวกันได้เกือบหมด</div></div>` +
        `<button data-act="scare" ${p.coins >= 800 ? '' : 'disabled'}>ซื้อ</button></div>`;
      h += L.upgradeRow(p, 'can');
      const worth = cropWorth(p);
      h += `<div class="mt-item"><img src="${NC.matIcon('lf_carrot')}" alt=""><div><div class="n">ขายผักทั้งหมดให้ยาย</div>` +
        `<div class="w">ได้ ${NC.fmtCoins(worth)} เหรียญ (ราคาเดียวกับลุงโกโก้)</div></div><button data-act="sellcrops" ${worth ? '' : 'disabled'}>ขาย</button></div>`;
      return h + '</div>';
    },
    act(game, p, what, arg, btn) {
      const g = garden(p);
      if (what === 'seed') {
        const [id, nStr] = arg.split(':'), C = CROPS[id], n = Number(btn.dataset.act.split(':')[2]) || 1;
        void nStr;
        if (!C || L.lvOf(p, 'farm') < C.lv || p.coins < C.price * n) return;
        p.coins -= C.price * n; NC.addMat(game, C.seed, n); NC.saveTrade(game);
        NC.HUD.log(`ซื้อ${MAT[C.seed].name} ×${n} จ่าย ${NC.fmtCoins(C.price * n)} เหรียญ`, 'item');
        rabbit.wave = 1; rabbit.say = 'ขอให้ผักงามนะจ๊ะ~'; rabbit.sayT = 3;
      } else if (what === 'expand') {
        const next = EXPAND.find((e) => e.n > g.n);
        if (!next || L.lvOf(p, 'farm') < next.lv || p.coins < next.coins) return;
        p.coins -= next.coins; g.n = next.n;
        game.toast(`แปลงผักเพิ่มเป็น ${g.n} แปลง!`);
        NC.saveGame(game);
      } else if (what === 'scare') {
        if (g.scare >= CARE.scare.max || p.coins < CARE.scare.price) return;
        p.coins -= CARE.scare.price; g.scare++;
        NC.HUD.log('ตั้งหุ่นไล่กาในแปลงผักแล้ว', 'item');
        NC.saveGame(game);
      } else if (what === 'sellcrops') {
        if (!cropWorth(p)) return;
        let got = 0;
        for (const id of CROP_MATS) { const k = NC.matCount(p, id); if (k > 0) got += NC.Econ && NC.Econ.sell ? NC.Econ.sell(game, id, k) : k * MAT[id].price; delete p.mats[id]; }
        p.coins += got;
        NC.HUD.log(`ขายผักให้ยายกระต่ายได้ ${NC.fmtCoins(got)} เหรียญ`, 'item');
        NC.saveGame(game);
      }
    },
  });
  // (the seed buttons carry "seed:<id>:<n>": life.js splits on the first ':' only as far as it needs)
  if (L.woodMentor) L.addMentor(Object.assign({ x: SPOT.beaver.x, y: SPOT.beaver.y, here: farmHere }, L.woodMentor));
  if (L.mineMentor) L.addMentor(Object.assign({ x: SPOT.mole.x, y: SPOT.mole.y, here: farmHere }, L.mineMentor));
  L.CROPS = CROPS; L.garden = garden; L.GARDEN_CARE = CARE;
})();
