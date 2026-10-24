/* gwar_zones.js — the four lands of ศึกชิงกองไฟ (js/gwar.js), each its own war map that a guild holds for the week
   (the user, 2026-10-14: zones, owner vs one challenger, hold the great fire at the end). They share one fair layout
   (NC.GWAR_GEO: point-symmetric round the middle; the defenders' camp north-west, the attackers' south-east, five fires:
   the defenders' fire, the south flank, the great fire, the north flank, the attackers' fire, roads between) and the war
   kit (pits, flames, banners, tents, the stakes: assets/gwar, make_gwar_prompts.py), but each has its own ground,
   trees to chop for firewood, cover and air:
     gw_roots  ลานรากชิงไฟ          the Dark Tree's giant roots split the dead forest (violet cracks)     (mockup B)
     gw_ruin   ค่ายนักเดินทางร้าง      torn tents, wagons and crates in a dark pine forest                   (mockup A)
     gw_ash    หุบเขาเถ้า             burnt trees, obsidian spires, ember cracks; the great fire on a dais  (mockup C)
     gw_ice    ทะเลสาบน้ำแข็ง          snowy pines round a frozen lake, the great fire on the ice            (mockup D)
   Art: assets/gwar/ (gw_ war kit + the roots, gr_ ruin, ga_ ash, gi_ ice: make_gwar_prompts.py, make_gwzone_prompts.py).
   Load before js/gwar.js. */
(function () {
  'use strict';
  const NC = window.NC;
  const W = 6800, H = 5200;
  const FIRES = [
    { id: 'bnear', name: 'ไฟฝั่งป้องกัน', kind: 'small', x: 2300, y: 1850 },
    { id: 'south', name: 'ไฟปีกใต้', kind: 'small', x: 2160, y: 4300 },
    { id: 'great', name: 'กองไฟใหญ่', kind: 'great', x: 3400, y: 2600 },
    { id: 'north', name: 'ไฟปีกเหนือ', kind: 'small', x: 4640, y: 900 },
    { id: 'rnear', name: 'ไฟฝั่งบุก', kind: 'small', x: 4500, y: 3350 },
  ];
  const CAMPS = { b: { x: 850, y: 900, name: 'ค่ายฝั่งป้องกัน' }, r: { x: W - 850, y: H - 900, name: 'ค่ายฝั่งบุก' } };
  const ROADS = [
    { w: 96, pts: [[CAMPS.b.x, CAMPS.b.y], [1500, 1280], [2300, 1850], [2850, 2250], [3400, 2600], [3950, 2950], [4500, 3350], [5300, 3920], [CAMPS.r.x, CAMPS.r.y]] },
    { w: 90, pts: [[2300, 1850], [3000, 1400], [3800, 1060], [4640, 900]] },
    { w: 90, pts: [[4640, 900], [4800, 1700], [4650, 2600], [4500, 3350]] },
    { w: 90, pts: [[4500, 3350], [3800, 3800], [3000, 4140], [2160, 4300]] },
    { w: 90, pts: [[2160, 4300], [2000, 3500], [2150, 2600], [2300, 1850]] },
  ];
  NC.GWAR_GEO = { W, H, FIRES, CAMPS, ROADS };

  // a pair = the piece and its mirror through the middle (both sides get the same cover)
  const marks = (fn) => {
    const out = [];
    const pair = (name, x, y, o) => { out.push([name, x, y, o || {}]); out.push([name, W - x, H - y, Object.assign({}, o, { flip: !(o && o.flip) })]); };
    fn(pair, out);
    // the war kit in both camps: tents, the side's banner, firewood stacked, the palisade facing the field
    for (const [s, k] of [['b', 1], ['r', -1]]) {
      const C = CAMPS[s], at = (dx, dy) => [C.x + dx * k, C.y + dy * k];
      const tent = s === 'b' ? 'gw_tent_blue' : 'gw_tent_red', banner = s === 'b' ? 'gw_banner_blue' : 'gw_banner_red';
      out.push([tent, ...at(-250, -160), { flip: k < 0 }], [tent, ...at(260, -230), { flip: k > 0 }]);
      out.push([banner, ...at(150, -40), {}], ['gw_woodpile', ...at(-270, 120), { flip: k < 0 }], ['gw_logbench', ...at(-60, 190), {}]);
      out.push(['gw_stakes', ...at(420, 300), {}], ['gw_stakes', ...at(140, 430), {}], ['gw_stakes', ...at(-180, 470), {}], ['gw_stakes', ...at(560, 60), {}]);
    }
    return out;
  };
  const ground = (base, patch, road, roadEdge, roadMid, specks, extra) => Object.assign({
    base: { n: base, d: base }, patch: { n: patch, d: patch }, vary: 14, patchScale: 520,
    road: { n: road, d: road }, roadEdge: { n: roadEdge, d: roadEdge }, roadMid: { n: roadMid, d: roadMid },
    water: { n: [30, 44, 70], d: [30, 44, 70] }, deep: { n: [22, 32, 56], d: [22, 32, 56] }, shore: { n: [50, 44, 54], d: [50, 44, 54] }, specks,
  }, extra);

  // ---------------- the props of each land: how they stand (fieldgen.js kinds) ----------------
  Object.assign(NC.FIELD_PROPS, {
    // the war kit
    gw_woodpile: { kind: 'rock' }, gw_stakes: { kind: 'fence' }, gw_logbench: { kind: 'rock' },
    gw_tent_blue: { kind: 'house', rect: [0.78, 80], roof: '#3f6fb0' }, gw_tent_red: { kind: 'house', rect: [0.78, 80], roof: '#b0443f' },
    gw_banner_blue: { kind: 'post' }, gw_banner_red: { kind: 'post' }, gw_banner_none: { kind: 'post' },
    // the roots
    gw_deadtree: { kind: 'tree', crown: '#4a4458' }, gw_deadtree2: { kind: 'tree', crown: '#514a5c' },
    gw_rootarch: { kind: 'house', rect: [0.84, 70], roof: '#3a2e40' }, gw_rootwall: { kind: 'house', rect: [0.88, 60], roof: '#3a2e40' },
    gw_rootcoil: { kind: 'tall', crown: '#3a2e40' }, gw_rootknot: { kind: 'rock' }, gw_stump: { kind: 'rock' },
    gw_boulder: { kind: 'rock', light: [0.02, -0.45, 90, '150,210,255'] }, gw_stones: { kind: 'rock' }, gw_cart: { kind: 'rock' },
    gw_bramble: { kind: 'bush' }, gw_bud: { kind: 'low', light: [0.08, -0.78, 80, '170,120,255'] }, gw_grass: { kind: 'low', sway: 1 }, gw_flatroots: { kind: 'low' },
    // the abandoned camp
    gr_pine: { kind: 'tree', crown: '#24403e' }, gr_pine2: { kind: 'tree', crown: '#2c4644' },
    gr_tentbig: { kind: 'house', rect: [0.82, 80], roof: '#7a7064' }, gr_tentsmall: { kind: 'rock' }, gr_tentframe: { kind: 'house', rect: [0.7, 60], roof: '#5a4a40' },
    gr_wagon: { kind: 'house', rect: [0.8, 70], roof: '#8a7a68' }, gr_crates: { kind: 'rock' }, gr_fence: { kind: 'fence' },
    gr_sacks: { kind: 'rock' }, gr_barrels: { kind: 'rock' }, gr_rack: { kind: 'rock' }, gr_stumps: { kind: 'rock' },
    gr_bush: { kind: 'bush' }, gr_rock: { kind: 'rock' }, gr_logs: { kind: 'rock' }, gr_ferns: { kind: 'low', sway: 1 },
    // the ash valley
    ga_burnt: { kind: 'tree', crown: '#3a3436' }, ga_burnt2: { kind: 'tree', crown: '#403a3c' },
    ga_dais: { kind: 'low' }, ga_spire: { kind: 'house', rect: [0.5, 60], roof: '#2a2430' }, ga_boulder: { kind: 'rock', light: [0, -0.4, 110, '255,130,60'] },
    ga_vent: { kind: 'rock', light: [0, -0.4, 150, '255,120,50'] }, ga_stump: { kind: 'rock', light: [0, -0.4, 90, '255,130,60'] }, ga_logs: { kind: 'rock' },
    ga_ashgrass: { kind: 'low', sway: 1 }, ga_cinders: { kind: 'low', light: [0, -0.3, 70, '255,120,50'] }, ga_bush: { kind: 'bush' },
    ga_pillar: { kind: 'tall', crown: '#7a7478' }, ga_rocks: { kind: 'rock' }, ga_cart: { kind: 'rock' }, ga_crack: { kind: 'low', light: [0, -0.3, 80, '255,110,40'] }, ga_stones: { kind: 'rock' },
    // the frozen lake
    gi_pine: { kind: 'tree', crown: '#dfe8f2' }, gi_pine2: { kind: 'tree', crown: '#d2dde9' },
    gi_rock: { kind: 'rock' }, gi_icechunk: { kind: 'house', rect: [0.6, 60], roof: '#a8d4f0' }, gi_crystal: { kind: 'tall', light: [0, -0.5, 140, '140,220,255'], crown: '#a8e4ff' },
    gi_dock: { kind: 'low' }, gi_boat: { kind: 'rock' }, gi_drift: { kind: 'low' },
    gi_reeds: { kind: 'low', sway: 1 }, gi_bush: { kind: 'bush' }, gi_stump: { kind: 'rock' }, gi_logs: { kind: 'rock' },
    gi_floe: { kind: 'low' }, gi_icicles: { kind: 'rock' }, gi_posts: { kind: 'post' }, gi_grass: { kind: 'low', sway: 1 },
  });

  // ---------------- the four lands ----------------
  NC.BIOMES.gwroots = ground([36, 31, 46], [44, 37, 52], [60, 51, 60], [47, 41, 53], [70, 60, 66], [
    { n: ['rgba(120,96,128,0.45)', 'rgba(92,76,104,0.5)', 'rgba(140,116,120,0.35)'], d: ['#7a6a7a'], count: 2600, size: [2.5, 5.5], leaf: 1 },
    { n: ['rgba(190,150,255,0.55)'], d: ['rgba(170,130,220,0.5)'], count: 240, size: [1.4, 2.4] },
  ], { cracks: 110, trees: [['gw_deadtree', 1], ['gw_deadtree2', 0.8]], border: [['gw_deadtree', 1.2], ['gw_deadtree2', 1], ['gw_rootcoil', 0.2]],
    grove: 0.56, fill: 0.6, lone: 0.22, bushes: [['gw_bramble', 1]], nBush: 70, grass: [['gw_grass', 1]], nGrass: 360,
    flowers: [['gw_bud', 0.6], ['gw_flatroots', 1.3]], nPatch: 36, rocks: [['gw_boulder', 0.7], ['gw_stones', 1], ['gw_stump', 0.6]], nRock: 44,
    mini: { ground: '#6e6478', road: '#a08a78', water: '#5f7fa0', tree: 'rgba(40,30,50,0.6)' } });
  NC.BIOMES.gwruin = ground([30, 40, 42], [36, 48, 46], [62, 54, 52], [46, 46, 46], [72, 62, 58], [
    { n: ['rgba(110,96,70,0.45)', 'rgba(70,90,70,0.45)'], d: ['#6a6450'], count: 2400, size: [3, 6], leaf: 1 },
    { n: ['rgba(30,48,48,0.45)'], d: ['rgba(40,70,60,0.4)'], count: 1600, size: [3, 7], blade: 1 },
  ], { trees: [['gr_pine', 1.2], ['gr_pine2', 0.8]], border: [['gr_pine', 1.4], ['gr_pine2', 1]], grove: 0.54, fill: 0.66, lone: 0.25,
    bushes: [['gr_bush', 1]], nBush: 90, grass: [['gr_ferns', 1]], nGrass: 320, flowers: [['gr_logs', 0.5], ['gr_stumps', 0.5]], nPatch: 20,
    rocks: [['gr_rock', 1], ['gr_logs', 0.6], ['gr_stumps', 0.5]], nRock: 46, mini: { ground: '#5f7066', road: '#9a8a70', water: '#5f7fa0', tree: 'rgba(20,50,44,0.6)' } });
  NC.BIOMES.gwash = ground([50, 45, 48], [58, 52, 54], [72, 64, 62], [56, 50, 52], [84, 74, 70], [
    { n: ['rgba(150,140,140,0.4)', 'rgba(90,84,88,0.5)'], d: ['#8a8488'], count: 2600, size: [2.5, 5.5] },
    { n: ['rgba(255,140,60,0.65)', 'rgba(255,190,90,0.5)'], d: ['rgba(255,140,60,0.5)'], count: 420, size: [1.4, 2.6] },
  ], { cracks: 240, trees: [['ga_burnt', 1], ['ga_burnt2', 0.8]], border: [['ga_burnt', 1.2], ['ga_burnt2', 1], ['ga_spire', 0.3]], grove: 0.6, fill: 0.55, lone: 0.2,
    bushes: [['ga_bush', 1]], nBush: 60, grass: [['ga_ashgrass', 1]], nGrass: 260, flowers: [['ga_cinders', 1], ['ga_crack', 0.8]], nPatch: 40,
    rocks: [['ga_rocks', 1], ['ga_stones', 1], ['ga_stump', 0.6], ['ga_boulder', 0.5]], nRock: 50, mini: { ground: '#7a7074', road: '#a89484', water: '#5f7fa0', tree: 'rgba(40,30,30,0.6)' } });
  NC.BIOMES.gwice = ground([66, 78, 104], [76, 90, 116], [92, 100, 120], [74, 84, 106], [106, 114, 134], [
    { n: ['rgba(235,245,255,0.6)', 'rgba(200,225,255,0.55)'], d: ['#ffffff'], count: 2800, size: [2, 4.5] },
    { n: ['rgba(150,190,230,0.35)'], d: ['rgba(150,190,230,0.35)'], count: 900, size: [4, 8] },
  ], { trees: [['gi_pine', 1.2], ['gi_pine2', 0.8]], border: [['gi_pine', 1.4], ['gi_pine2', 1]], grove: 0.55, fill: 0.62, lone: 0.22,
    bushes: [['gi_bush', 1], ['gi_reeds', 0.6]], nBush: 70, grass: [['gi_grass', 1]], nGrass: 280, flowers: [['gi_drift', 1], ['gi_floe', 0.6]], nPatch: 34,
    rocks: [['gi_rock', 1], ['gi_stump', 0.6], ['gi_logs', 0.6], ['gi_icicles', 0.5]], nRock: 46, mini: { ground: '#b8c8dc', road: '#8a98ac', water: '#7fb0d8', tree: 'rgba(60,80,100,0.55)' } });

  const LAKE = { x: 3400, y: 2600, rx: 1650, ry: 1050 };
  NC.GWAR_ZONES = [
    { id: 'gw_roots', name: 'ลานรากชิงไฟ', pic: 'assets/gwar/zone_roots.jpg', biome: 'gwroots', seed: 1414, amb: [72, 78, 120], chop: ['gw_deadtree', 'gw_deadtree2'],
      note: 'รากยักษ์ของต้นไม้มืดตัดผ่านป่าตาย เป็นกำแพงกั้นทาง', marks: marks((pair) => {
        pair('gw_rootwall', 3920, 1990); pair('gw_rootarch', 4200, 1560, { flip: true });
        pair('gw_rootcoil', 3010, 1880); pair('gw_rootknot', 1700, 2720); pair('gw_rootarch', 1480, 3620);
        pair('gw_rootknot', 3560, 1260, { flip: true }); pair('gw_rootcoil', 1240, 1980);
        pair('gw_cart', 2040, 2060); pair('gw_boulder', 2580, 1690); pair('gw_stones', 2460, 4150); pair('gw_boulder', 1920, 4440, { flip: true });
        pair('gw_cart', 3010, 2860, { flip: true }); pair('gw_logbench', 3400, 2330); pair('gw_logbench', 3090, 2560, { scale: 0.9 });
        pair('gw_stones', 3720, 2280); pair('gw_flatroots', 2700, 2400, { scale: 1.5 }); pair('gw_flatroots', 2350, 3600, { scale: 1.4 });
        pair('gw_bud', 2950, 2150); pair('gw_bud', 1980, 3150);
      }) },
    { id: 'gw_ruin', name: 'ค่ายนักเดินทางร้าง', pic: 'assets/gwar/zone_ruin.jpg', biome: 'gwruin', seed: 2626, amb: [70, 82, 110], chop: ['gr_pine', 'gr_pine2'],
      note: 'ค่ายเก่ากลางป่าสน เต็นท์ขาด เกวียนคว่ำ มีที่หลบเยอะ', marks: marks((pair) => {
        pair('gr_tentbig', 3920, 1990); pair('gr_wagon', 4200, 1560, { flip: true }); pair('gr_tentframe', 3010, 1880);
        pair('gr_tentbig', 1480, 3620, { flip: true }); pair('gr_crates', 1700, 2720); pair('gr_wagon', 3560, 1260);
        pair('gr_fence', 3700, 1850); pair('gr_fence', 3820, 1720); pair('gr_fence', 1350, 2000);
        pair('gr_tentsmall', 2040, 2060); pair('gr_barrels', 2580, 1690); pair('gr_sacks', 2460, 4150); pair('gr_crates', 1920, 4440, { flip: true });
        pair('gr_rack', 3010, 2860); pair('gw_logbench', 3400, 2330); pair('gw_logbench', 3090, 2560, { scale: 0.9 }); pair('gr_barrels', 3720, 2280);
        pair('gr_tentsmall', 2700, 2420, { flip: true }); pair('gr_sacks', 2330, 3560);
      }) },
    { id: 'gw_ash', name: 'หุบเขาเถ้า', pic: 'assets/gwar/zone_ash.jpg', biome: 'gwash', seed: 3838, amb: [98, 80, 86], chop: ['ga_burnt', 'ga_burnt2'],
      note: 'หุบเขาถ่านคุ กองไฟใหญ่อยู่บนแท่นหินกลางหุบ', dais: true, marks: marks((pair) => {
        pair('ga_spire', 3920, 1990); pair('ga_spire', 4200, 1560, { flip: true }); pair('ga_pillar', 3010, 1880);
        pair('ga_boulder', 1700, 2720); pair('ga_spire', 1480, 3620); pair('ga_pillar', 3560, 1260, { flip: true }); pair('ga_boulder', 1240, 1980);
        pair('ga_cart', 2040, 2060); pair('ga_boulder', 2580, 1690); pair('ga_rocks', 2460, 4150); pair('ga_vent', 1920, 4440);
        pair('ga_vent', 2900, 3000); pair('ga_rocks', 3720, 2280); pair('ga_crack', 2700, 2400, { scale: 1.5 }); pair('ga_cinders', 2350, 3600, { scale: 1.4 });
        pair('ga_stones', 2950, 2150); pair('ga_logs', 1980, 3150);
      }) },
    { id: 'gw_ice', name: 'ทะเลสาบน้ำแข็ง', pic: 'assets/gwar/zone_ice.jpg', biome: 'gwice', seed: 4949, amb: [80, 96, 138], chop: ['gi_pine', 'gi_pine2'],
      note: 'ทะเลสาบที่แข็งเป็นน้ำแข็ง กองไฟใหญ่อยู่กลางลานน้ำแข็ง', lake: LAKE, marks: marks((pair) => {
        pair('gi_icechunk', 3920, 1990); pair('gi_crystal', 4200, 1560); pair('gi_icechunk', 3010, 1880, { flip: true });
        pair('gi_rock', 1700, 2720); pair('gi_icechunk', 1480, 3620); pair('gi_crystal', 3560, 1260); pair('gi_rock', 1240, 1980);
        pair('gi_boat', 2040, 2060); pair('gi_icicles', 2580, 1690); pair('gi_rock', 2460, 4150); pair('gi_posts', 1920, 4440);
        pair('gi_dock', 3000, 2900); pair('gi_posts', 3720, 2280); pair('gi_floe', 2700, 2400, { scale: 1.6 }); pair('gi_floe', 2350, 3600, { scale: 1.4 });
        pair('gi_drift', 2950, 2150); pair('gi_reeds', 1980, 3150);
      }) },
  ];
})();
