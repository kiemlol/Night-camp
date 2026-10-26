/* fields2.js — the second batch of hunting fields, east of the camp. Classic MMO style:
   more than one place to hunt at every level, and each field has its own elements, so each suits some jobs better
   (the world map, js/worldmap.js, shows which):
     farm       ไร่ฟักทอง         Lv 1–10   earth: pumpkins and carrots leave you alone until hit; crows and scarecrows
                                          don't. Tilled plots, a barn, an orchard
     marsh      บึงกบลำธารใส       Lv 12–24  water (and wind): frogs, river crabs, dragonflies; snapping turtles (very high
                                          DEF) in the great lotus pond. Clear ponds with reeds, paths winding between
     graveyard  เนินสุสานโบสถ์ร้าง   Lv 18–32  undead / ghost / shadow: zombies, skeletons, ghosts, haunted headstones. Rows
                                          of graves, a small ruined chapel; dim even by day, mist drifting over it
   The camp's east road leads to the farm (this adds that exit); the farm's east road goes on to the marsh, and the
   farm's south lane and the marsh's south road both end at the graveyard. Further on (js/fields3.js): the marsh's
   east road to the misty lake, the graveyard's east road to the poison swamp. fieldgen.js draws the maps from the numbers
   here (its 'plots' and
   pond 'reeds' were added for these). This adds their biomes (ground colours, what grows where) and props: all-new
   art in assets/maps/ (assets/gen/make_map2_prompts.py -> Codex -> tools/cutout.py). Monsters: js/monsters2.js.
   Load after camp.js (it adds the camp's east exit). */
(function () {
  'use strict';
  const NC = window.NC;

  // ---------------- props: how each stands (see fieldgen.js PROPS); crown / roof: its colour on the minimap ----------
  Object.assign(NC.FIELD_PROPS, {
    // the pumpkin farm
    f_oak: { kind: 'tree', crown: '#5fa050' }, f_pear: { kind: 'tree', crown: '#a4cc58' },
    f_barn: { kind: 'house', rect: [0.82, 100], roof: '#b8483c' },
    f_farmhouse: { kind: 'house', rect: [0.8, 95], light: [-0.1, -0.38, 280, '255,196,120'], roof: '#8a6a4a' },
    f_granary: { kind: 'house', rect: [0.56, 70], roof: '#d9b25c' }, f_haycart: { kind: 'rock' },
    f_pumpkins: { kind: 'low' }, f_corn: { kind: 'low', sway: 1 }, f_sunflowers: { kind: 'low', sway: 1 }, f_grass: { kind: 'low', sway: 1 },
    f_bush: { kind: 'bush' }, f_haybale: { kind: 'rock' }, f_fence: { kind: 'fence' }, f_rock: { kind: 'rock' },
    // the frog marsh
    s_willow: { kind: 'tree', crown: '#8fbf6a' }, s_mangrove: { kind: 'tree', crown: '#3f8a70' },
    s_stilthut: { kind: 'house', rect: [0.6, 80], light: [0.09, -0.52, 260, '255,200,130'], roof: '#c9a860' },
    s_frogstone: { kind: 'rock' }, s_lantern: { kind: 'post', light: [0.41, -0.57, 240, '200,255,140'] }, s_boat: { kind: 'rock' },
    s_reeds: { kind: 'low', sway: 1 }, s_cattails: { kind: 'low', sway: 1 }, s_grass: { kind: 'low', sway: 1 }, s_flowers: { kind: 'low', sway: 1 },
    s_bush: { kind: 'bush' }, s_rock: { kind: 'rock' }, s_log: { kind: 'rock' }, s_fence: { kind: 'fence' },
    // the graveyard hill
    g_deadoak: { kind: 'tree', crown: '#7d7482' }, g_yew: { kind: 'tree', crown: '#2f5a58' },
    g_chapel: { kind: 'house', rect: [0.7, 110], light: [-0.05, -0.16, 300, '140,255,170'], roof: '#8a8a96' },
    g_crypt: { kind: 'house', rect: [0.74, 80], light: [0.06, -0.3, 220, '150,210,255'], roof: '#9a9aa4' },
    g_lamp: { kind: 'post', light: [0.38, -0.61, 260, '150,225,255'] }, g_statue: { kind: 'rock', light: [0.02, -0.83, 90, '140,255,160'] },
    g_grave1: { kind: 'rock' }, g_grave2: { kind: 'rock' }, g_grave3: { kind: 'rock' },
    g_candles: { kind: 'low', light: [-0.05, -0.75, 130, '255,190,110'] }, g_fence: { kind: 'fence' }, g_bush: { kind: 'bush' },
    g_grass: { kind: 'low', sway: 1 }, g_flowers: { kind: 'low', sway: 1, light: [-0.09, -0.58, 90, '170,220,255'] },
  });

  // ---------------- biomes: ground palettes (n = night, d = day) and what grows where (see fieldgen.js BIOMES) --------
  Object.assign(NC.BIOMES, {
    farm: {
      base: { n: [52, 74, 70], d: [128, 172, 92] }, patch: { n: [62, 84, 74], d: [150, 186, 100] }, vary: 18, patchScale: 520,
      road: { n: [70, 72, 84], d: [214, 182, 128] }, roadEdge: { n: [60, 70, 76], d: [176, 164, 104] }, roadMid: { n: [78, 80, 92], d: [230, 202, 150] },
      water: { n: [38, 64, 104], d: [96, 176, 214] }, deep: { n: [30, 50, 90], d: [70, 144, 196] }, shore: { n: [66, 74, 84], d: [200, 186, 140] },
      soil: { n: [66, 54, 62], d: [150, 104, 70] }, soilEdge: { n: [56, 62, 64], d: [134, 120, 80] },
      furrow: { n: [50, 40, 50], d: [116, 78, 52] }, ridge: { n: [82, 68, 74], d: [178, 130, 90] },
      specks: [
        { n: ['rgba(230,236,255,0.5)', 'rgba(255,240,190,0.45)'], d: ['#fff6d8', '#ffe07a', '#ffffff', '#f6c9dc'], count: 2200, size: [2.5, 5] },
        { n: ['rgba(30,50,48,0.35)'], d: ['rgba(80,130,60,0.35)'], count: 1600, size: [3, 7], blade: 1 },
      ],
      trees: [['f_oak', 1], ['f_pear', 0.5]], border: [['f_oak', 1.2], ['f_pear', 0.6]], grove: 0.64, fill: 0.5, lone: 0.22,
      bushes: [['f_bush', 1]], nBush: 60, grass: [['f_grass', 1]], nGrass: 520,
      flowers: [['f_sunflowers', 0.6], ['f_pumpkins', 0.8], ['f_grass', 0.5]], nPatch: 26,
      rocks: [['f_rock', 1], ['f_haybale', 0.7]], nRock: 34,
      shorePlants: [['f_grass', 1]],
      mini: { ground: '#d4e4ae', road: '#9a7a52', water: '#7cb8e0', plot: '#b98b5e', tree: 'rgba(80,130,70,0.55)' },
    },
    marsh: {
      base: { n: [36, 62, 66], d: [96, 158, 110] }, patch: { n: [42, 72, 70], d: [112, 172, 116] }, vary: 16, patchScale: 440,
      road: { n: [58, 66, 74], d: [178, 156, 112] }, roadEdge: { n: [48, 62, 66], d: [132, 146, 100] }, roadMid: { n: [66, 74, 82], d: [196, 176, 132] },
      water: { n: [36, 78, 104], d: [96, 196, 214] }, deep: { n: [26, 58, 88], d: [60, 158, 196] }, shore: { n: [54, 70, 74], d: [170, 176, 126] },
      specks: [
        { n: ['rgba(200,255,220,0.45)', 'rgba(255,250,200,0.4)'], d: ['#fff6c0', '#e0f4ff', '#ffffff'], count: 1600, size: [2, 4.5] },
        { n: ['rgba(20,50,50,0.35)'], d: ['rgba(60,120,80,0.35)'], count: 2000, size: [3, 7], blade: 1 },
      ],
      trees: [['s_willow', 1], ['s_mangrove', 1]], border: [['s_mangrove', 1.2], ['s_willow', 1]], grove: 0.55, fill: 0.62, lone: 0.32,
      bushes: [['s_bush', 1]], nBush: 80, grass: [['s_grass', 2], ['s_reeds', 0.6]], nGrass: 560,
      flowers: [['s_flowers', 1]], nPatch: 40, rocks: [['s_rock', 1], ['s_log', 0.8]], nRock: 46,
      shorePlants: [['s_reeds', 1.2], ['s_cattails', 1], ['s_grass', 0.6]],
      mini: { ground: '#a8d0a4', road: '#7e6a4c', water: '#6cc4dc', tree: 'rgba(40,90,70,0.55)' },
    },
    grave: {
      base: { n: [44, 50, 60], d: [112, 132, 104] }, patch: { n: [50, 56, 64], d: [126, 142, 108] }, vary: 14, patchScale: 480,
      road: { n: [62, 64, 76], d: [168, 160, 146] }, roadEdge: { n: [52, 56, 66], d: [136, 136, 116] }, roadMid: { n: [72, 74, 86], d: [188, 180, 164] },
      water: { n: [34, 48, 70], d: [80, 118, 130] }, deep: { n: [26, 36, 58], d: [58, 92, 108] }, shore: { n: [54, 56, 64], d: [128, 128, 110] },
      specks: [
        { n: ['rgba(140,110,90,0.45)', 'rgba(110,100,120,0.45)'], d: ['#a08466', '#8e7c6a', '#c0a882'], count: 2000, size: [3, 6], leaf: 1 },
        { n: ['rgba(200,230,255,0.4)'], d: ['rgba(240,240,230,0.55)'], count: 700, size: [1.5, 3] },
      ],
      trees: [['g_deadoak', 1], ['g_yew', 1]], border: [['g_yew', 1.3], ['g_deadoak', 1]], grove: 0.6, fill: 0.6, lone: 0.3,
      bushes: [['g_bush', 1]], nBush: 70, grass: [['g_grass', 1]], nGrass: 420,
      flowers: [['g_flowers', 1], ['g_candles', 0.25]], nPatch: 32,
      rocks: [['g_grave2', 1], ['g_grave3', 0.8], ['g_grave1', 0.5]], nRock: 50,
      mini: { ground: '#b4c0a6', road: '#8e8a80', water: '#6f94a0', tree: 'rgba(50,60,60,0.6)' },
    },
  });

  // fruit trees in loose rows (an orchard)
  const orchard = (name, x0, y0, x1, y1, dx, dy, seed) => {
    const R = NC.rng(seed), out = [];
    for (let y = y0, r = 0; y <= y1; y += dy, r++)
      for (let x = x0 + (r % 2) * dx * 0.5; x <= x1; x += dx)
        out.push([name, Math.round(x + (R() - 0.5) * 40), Math.round(y + (R() - 0.5) * 30), { flip: R() < 0.5, scale: 0.88 + R() * 0.2 }]);
    return out;
  };
  const GRAVES = [['g_grave1', 1], ['g_grave2', 1], ['g_grave3', 0.8]];

  // ---------------- the maps ----------------
  // the camp's road east (camp.js builds its roads from NC.MAPS.camp.exits; the same road the old village used)
  const camp = NC.MAPS.camp;
  if (camp && camp.exits && !camp.exits.some((e) => e.id === 'east'))
    camp.exits.push({ id: 'east', x: 2945, y: 1650, to: 'farm', at: 'west', road: [[2600, 1605], [2780, 1660], [2960, 1650], [3040, 1650]] });

  Object.assign(NC.MAPS, {
    farm: {
      // (2026-10-18, the user: the farm + its B1–B3 are the Lv 1–10 maps; it was Lv 4–14, a third of it Lv 10+)
      name: 'ไร่ฟักทอง', lvText: 'Lv 1–10', biome: 'farm', W: 5000, H: 3600, seed: 41,
      lv: { slime: [3, 8], hollow: [5, 10] },
      spawns: [['slime', 18], ['hollow', 10]],
      warps: [
        { id: 'west', x: 130, y: 1440, to: 'camp', at: 'east' },
        { id: 'east', x: 4870, y: 1900, to: 'marsh', at: 'west' },
        { id: 'south', x: 2200, y: 3470, to: 'graveyard', at: 'west' },
      ],
      roads: [
        { w: 84, pts: [[40, 1440], [700, 1440], [1300, 1500], [1900, 1480], [2450, 1350]] },
        { w: 80, pts: [[2450, 1350], [2900, 1560], [3500, 1700], [4100, 1880], [4960, 1900]] },
        { w: 64, pts: [[2450, 1350], [2500, 1900], [2420, 2500], [2230, 3100], [2200, 3560]] },
        { w: 56, pts: [[2450, 1350], [2430, 1040], [2380, 860]] }, // into the barnyard
      ],
      plots: [
        { x0: 700, y0: 1760, x1: 1500, y1: 2360, crops: [['f_pumpkins', 1]], row: 110, gap: 150, fence: 'f_fence' },
        { x0: 1680, y0: 1860, x1: 2180, y1: 2620, crops: [['f_pumpkins', 1]], row: 110, gap: 150, skip: 0.1 },
        { x0: 2820, y0: 2200, x1: 3700, y1: 2900, crops: [['f_corn', 1]], row: 120, gap: 110, skip: 0.08 },
        { x0: 3900, y0: 2300, x1: 4560, y1: 3100, crops: [['f_corn', 1]], row: 120, gap: 110, skip: 0.1 },
        { x0: 900, y0: 900, x1: 1600, y1: 1300, crops: [['f_sunflowers', 1]], row: 110, gap: 110, fence: 'f_fence' },
        { x0: 1960, y0: 480, x1: 2300, y1: 790, crops: [['f_pumpkins', 1], ['f_sunflowers', 0.5]], row: 105, gap: 130 },
      ],
      ponds: [{ x: 1200, y: 3050, rx: 380, ry: 200, lilies: 6, reeds: 10 }, { x: 3350, y: 640, rx: 230, ry: 120, lilies: 3, reeds: 6 }],
      landmarks: [
        ['f_farmhouse', 2140, 1170], ['f_barn', 2800, 1140, { flip: true }], ['f_granary', 3170, 1290],
        ['f_haycart', 2610, 1310, { flip: true }], ['f_haybale', 2960, 1400], ['f_haybale', 3060, 1440, { scale: 0.9 }],
        ['f_haybale', 3010, 1340, { scale: 0.85, flip: true }], ['f_oak', 1840, 1020],
        ['f_sunflowers', 2330, 1250], ['f_pumpkins', 2020, 1330], ['f_pumpkins', 2720, 1420, { flip: true }],
        ...orchard('f_pear', 3700, 540, 4700, 1400, 320, 260, 4101),
      ],
      landmarkCrowns: true, // (no monster starts hidden under the orchard's crowns)
      fences: [['f_fence', 1950, 2270, 820], ['f_fence', 2500, 3300, 820]],
      safe: [[1900, 800, 3350, 1480]],
      zones: [
        // the newbie meadow by the road in from the camp: the camp's old monsters since the big camp is safe ground
        // (2026-10-04, the user: "ย้ายไปไร่ฟักทอง"), as many as the camp had (monsters2.js ROSTER). Since 2026-10-08 (the
        // owner, after dying at Lv 2 to bats and boars with no potions): Lv 1–3; passive, every monster here only hits
        // back like a classic MMO's first-field slimes ("มอนทุ่งหญ้าไม่ดุ": monsters2.js, backend monster_ai.go); and half the scattered
        // bushes, tufts, rocks, hay bales and trees (decor: the share kept, fieldgen.js), "ลดของตกแต่งในทุ่งหญ้า" so the
        // hero stays in sight
        { name: 'ทุ่งหญ้าหน้าไร่', rect: [150, 200, 1700, 1000], lv: { slime: [1, 3], hollow: [2, 3] }, spawns: [['hollow', 4], ['slime', 6]],
          passive: true, decor: 0.5 },
        { name: 'ลานบ้านไร่', rect: [1900, 800, 3350, 1480] },
        { name: 'ไร่ข้าวโพด', rect: [2750, 2100, 4700, 3350], lv: { slime: [6, 9], hollow: [7, 10] } },
        { name: 'สวนสาลี่', rect: [3600, 380, 4800, 1500] },
        { name: 'แปลงฟักทองยักษ์', rect: [550, 1650, 2300, 2750] },
      ],
    },

    marsh: {
      name: 'บึงกบลำธารใส', lvText: 'Lv 12–24', biome: 'marsh', W: 5200, H: 3800, seed: 53,
      lv: { slime: [12, 18], hollow: [16, 24] },
      spawns: [['slime', 18], ['hollow', 12]],
      warps: [
        { id: 'west', x: 130, y: 1900, to: 'farm', at: 'east' },
        { id: 'south', x: 3000, y: 3670, to: 'graveyard', at: 'north' },
        { id: 'east', x: 5070, y: 990, to: 'lake', at: 'west' }, // (fields3.js)
      ],
      roads: [
        { w: 74, pts: [[40, 1900], [600, 1850], [1100, 1650], [1600, 1700], [2100, 1950], [2600, 2050], [2900, 2500], [3000, 3100], [3000, 3760]] },
        { w: 60, pts: [[1600, 1700], [1900, 1200], [2500, 930], [3200, 860], [3800, 1100], [4400, 1000], [5160, 990]] },
        { w: 60, pts: [[2600, 2050], [3300, 1900], [3900, 2100], [4500, 2380]] },
        { w: 50, pts: [[1860, 1810], [1935, 2000], [1915, 2210]] }, // down to the fisher's hut, by its east side
      ],
      ponds: [
        { x: 900, y: 1150, rx: 420, ry: 230, lilies: 10, reeds: 14 }, { x: 1350, y: 2520, rx: 520, ry: 280, lilies: 14, reeds: 18 },
        { x: 2350, y: 1450, rx: 290, ry: 150, lilies: 6, reeds: 10 }, { x: 3500, y: 1420, rx: 370, ry: 190, lilies: 8, reeds: 12 },
        { x: 4300, y: 1650, rx: 290, ry: 160, lilies: 6, reeds: 10 }, { x: 3980, y: 2920, rx: 540, ry: 270, lilies: 16, reeds: 22 },
        { x: 2000, y: 3260, rx: 370, ry: 190, lilies: 8, reeds: 12 }, { x: 2750, y: 580, rx: 250, ry: 130, lilies: 5, reeds: 8 },
      ],
      lanterns: ['s_lantern', 640],
      landmarks: [
        ['s_stilthut', 1760, 2230], ['s_frogstone', 2760, 1880], ['s_boat', 1060, 2210, { flip: true }], ['s_boat', 3420, 2560],
        ['s_willow', 3330, 3150], ['s_willow', 1060, 1500, { scale: 0.9 }],
      ],
      landmarkCrowns: true,
      fences: [['s_fence', 1440, 1640, 2150]],
      safe: [[1550, 2000, 2250, 2420]],
      zones: [
        { name: 'ท่าน้ำคนหาปลา', rect: [1500, 1950, 2300, 2450] },
        { name: 'บึงบัวใหญ่', rect: [3050, 2300, 5150, 3720], lv: { slime: [16, 20], hollow: [20, 24] } },
        { name: 'ลานกบหิน', rect: [2400, 1650, 3150, 2300] },
      ],
    },

    graveyard: {
      name: 'เนินสุสานโบสถ์ร้าง', lvText: 'Lv 18–30', biome: 'grave', W: 4800, H: 3600, seed: 67,
      lv: { slime: [18, 24], hollow: [22, 28] },
      spawns: [['slime', 13], ['hollow', 12]],
      warps: [
        { id: 'north', x: 2400, y: 130, to: 'marsh', at: 'south' },
        { id: 'west', x: 130, y: 1800, to: 'farm', at: 'south' },
        { id: 'east', x: 4670, y: 1480, to: 'swamp', at: 'west' }, // (fields3.js)
      ],
      roads: [
        { w: 76, pts: [[2400, 40], [2380, 500], [2300, 900], [2350, 1300], [2400, 1700], [2500, 2200], [2600, 2800], [2700, 3300]] },
        { w: 66, pts: [[40, 1800], [600, 1760], [1200, 1650], [1800, 1560], [2350, 1320]] },
        { w: 60, pts: [[2400, 1700], [3000, 1800], [3600, 1650], [4200, 1500], [4760, 1480]] },
      ],
      plots: [
        { x0: 900, y0: 880, x1: 1900, y1: 1400, crops: GRAVES, row: 130, gap: 160, skip: 0.15, soil: false, fence: 'g_fence' },
        { x0: 2820, y0: 1960, x1: 3900, y1: 2500, crops: GRAVES, row: 130, gap: 170, skip: 0.2, soil: false },
        { x0: 700, y0: 2200, x1: 1320, y1: 3000, crops: GRAVES, row: 135, gap: 165, skip: 0.2, soil: false, fence: 'g_fence' },
        { x0: 3000, y0: 2820, x1: 4200, y1: 3300, crops: GRAVES, row: 130, gap: 170, skip: 0.25, soil: false },
        { x0: 3100, y0: 620, x1: 4300, y1: 1200, crops: GRAVES, row: 140, gap: 180, skip: 0.3, soil: false, fence: 'g_fence' },
      ],
      ponds: [{ x: 1700, y: 3120, rx: 320, ry: 160 }],
      lanterns: ['g_lamp', 720],
      landmarks: [
        ['g_chapel', 2660, 1110], ['g_crypt', 1520, 2320], ['g_crypt', 3520, 2640, { flip: true }], ['g_statue', 2130, 1720],
        ['g_candles', 2560, 1180], ['g_candles', 2790, 1200, { flip: true }], ['g_candles', 1440, 2360], ['g_candles', 3600, 2690],
        ['g_deadoak', 2050, 1250, { flip: true }], ['g_yew', 2950, 900], ['g_yew', 2130, 760, { scale: 0.9, flip: true }],
      ],
      landmarkCrowns: true,
      safe: [[2400, 1140, 2950, 1420]],
      zones: [
        { name: 'ลานโบสถ์ร้าง', rect: [2050, 780, 3050, 1450] },
        { name: 'แถวหลุมศพเก่า', rect: [600, 780, 2000, 1500], lv: { slime: [20, 26], hollow: [24, 30] } },
        { name: 'สุสานคนนิรนาม', rect: [2900, 450, 4500, 1300], lv: { slime: [24, 28], hollow: [26, 30] } },
      ],
    },
  });

  // ---------------- the graveyard: dim even by day, a cold green night, mist drifting over the graves ----------------
  const graveAmbient = (minutes, n) => {
    const b = NC.skyAmbient ? NC.skyAmbient(minutes, n) : [255 - 83 * n, 255 - 69 * n, 255 - 23 * n];
    return [Math.round(b[0] * (1 - 0.2 * n)), Math.round(b[1] * (1 - 0.07 * n)), Math.round(b[2] * (1 - 0.1 * n))];
  };
  const baseField = NC.buildField;
  NC.buildField = function (def) {
    const w = baseField.apply(this, arguments);
    if (def && def.id === 'graveyard') { w.dusk = 0.42; w.ambient = graveAmbient; w.mist = true; }
    return w;
  };

  let mistFx = null;
  function mistFrame(game) {
    if (!game.world || !game.world.mist || (mistFx && NC.FX.list.includes(mistFx))) return;
    // (maps.js empties the effect list on a map change: put it back)
    mistFx = NC.FX.add({ type: 'custom', layer: 'high', x: 0, y: 0, life: Infinity, draw(ctx) {
      const g = NC.game;
      if (!g.world || !g.world.mist) return;
      const c = g.cam, T = g.time, span = g.vw + 1000;
      for (let i = 0; i < 16; i++) {
        // each wisp drifts slowly east over a band a little wider than the screen, and comes back in from the west
        const f = (i * 0.618034) % 1, sp = 12 + (i % 5) * 6, rx = 260 + (i % 4) * 80, ry = rx * 0.3;
        const x = c.x - 500 + ((f * span + T * sp) % span), y = c.y - 80 + ((i * 0.381966) % 1) * (g.vh + 160) + Math.sin(T * 0.3 + i) * 30;
        const a = 0.12 + 0.06 * Math.sin(T * 0.5 + i * 1.7);
        ctx.save();
        ctx.translate(x, y); ctx.scale(1, ry / rx);
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        gr.addColorStop(0, `rgba(214,228,236,${a})`); gr.addColorStop(1, 'rgba(214,228,236,0)');
        ctx.fillStyle = gr; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
        ctx.restore();
      }
    } });
  }
  (NC.assetsLoaded || (NC.assetsLoaded = [])).push(() => {
    const baseLoot = NC.updateLoot;
    NC.updateLoot = function (game) { mistFrame(game); return baseLoot.apply(this, arguments); };
  });
})();
