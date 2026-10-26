/* fields4.js — the story's new fields (the story bible draft 8, chapters 4–18: the refugees' road north to the capital
   Bellhaven, and the places round it). Every one is a shared hunting field; the story's bosses stand in them
   (js/storyboss.js); the monsters are js/monsters5.js's:
     road       ถนนผู้อพยพ          Lv 32–42  autumn hills, overturned wagons, milestones; a wayside rest shelter (safe).
                                           North of the burnt forest
     salt       ด่านสะพานเกลือ       Lv 36–48  a white salt-stone toll town by a river: the toll gate, salt warehouses, the
                                           lord's keep (Lord Halvard); the refugees wait by the west gate (safe)
     peak       ยอดเขาหมอกเหนือ      Lv 46–58  a snowy mountain top in a blizzard; a storm shelter (safe); Owlspire (the
                                           observatory dungeon, js/dungeons2.js) on the north ridge. From the wind cliffs
                                           (east) and from Saltbridge (north)
     nroad      เส้นทางขึ้นเหนือ       Lv 60–72  empty farm villages, tax poles, a broken windmill; the house that still has
                                           a lamp (safe)
     outer      ย่านนอกกำแพง         Lv 68–82  Bellhaven's outskirts: timbered townhouses, street lamps, the fountain
                                           square (safe), the great city gate (Captain Aldric)
     canal      ย่านริมคลอง          Lv 74–86  dark canals, stilt houses, the candle factory (Madame Candle); the ledger
                                           archive's back door (dungeon)
     isle       เกาะกลางทะเลสาบ      Lv 84–92  a misty island in the shadow lake (by boat from its east dock): the old
                                           stone hall (Nocturne), mist citizens who leave you alone
     dark       ป่าใต้ที่มืดสนิท        Lv 86–96  a forest where no light survives, south of the meadow; the dead camp at the
                                           end of the road (puppet No. 1)
     cathedral  ย่านวิหาร            Lv 92–99  the richest ward, too white and golden (Cardinal Severin); the poor quarter
                                           behind the hedges; the puppet workshop's cellar and the bell tower's gate
   Joins: burnt (north) -> road -> (east) salt -> (north) peak <- (east) wind · peak (east) -> nroad -> outer -> canal ->
   cathedral · lake (east dock) -> isle · meadow (south) -> dark. All-new art: assets/maps/ (pr_ sx_ np_ nr_ bo_ bc_ li_
   dk_ cd_ and the doors de_owl/de_archive/de_cellar/de_bell; assets/gen/make_map4_prompts.py -> Codex ->
   tools/cutout.py). Load after fields3.js and dungeons.js. */
(function () {
  'use strict';
  const NC = window.NC;

  // ---------------- props: how each stands (see fieldgen.js PROPS); crown / roof: its colour on the minimap ----------
  const WARM = '255,196,120', CANDLE = '255,200,110', PALE = '170,210,255';
  Object.assign(NC.FIELD_PROPS, {
    // the pilgrims' road
    pr_oak: { kind: 'tree', crown: '#d08a3a' }, pr_birch: { kind: 'tree', crown: '#e0c050' },
    pr_shelter: { kind: 'house', rect: [0.78, 80], light: [0.02, -0.5, 240, WARM], roof: '#8a5a3a' },
    pr_wagon: { kind: 'rock' }, pr_milestone: { kind: 'post' }, pr_cart: { kind: 'rock' },
    pr_grass: { kind: 'low', sway: 1 }, pr_leaves: { kind: 'low' }, pr_asters: { kind: 'low', sway: 1 }, pr_bush: { kind: 'bush' },
    pr_rock: { kind: 'rock' }, pr_crates: { kind: 'rock' }, pr_fence: { kind: 'fence' }, pr_sign: { kind: 'post' },
    // saltbridge
    sx_bridge: { kind: 'house', rect: [0.8, 90], light: [0.3, -0.55, 220, WARM], roof: '#dcdce4' },
    sx_warehouse: { kind: 'house', rect: [0.84, 100], roof: '#5a6a80' },
    sx_castle: { kind: 'house', rect: [0.7, 110], light: [0.05, -0.4, 300, WARM], roof: '#4a6a9a' },
    sx_poplar: { kind: 'tree', crown: '#9ab8a0' }, sx_saltpile: { kind: 'rock' },
    sx_gate: { kind: 'house', rect: [0.5, 70], light: [-0.2, -0.6, 200, WARM], roof: '#c04a4a' },
    sx_reeds: { kind: 'low', sway: 1 }, sx_grass: { kind: 'low', sway: 1 }, sx_flowers: { kind: 'low', sway: 1 },
    sx_barrels: { kind: 'rock' }, sx_rock: { kind: 'rock' }, sx_crystal: { kind: 'rock', light: [0, -0.5, 110, '230,240,255'] },
    sx_post: { kind: 'post' }, sx_lamp: { kind: 'post', light: [0, -0.86, 240, WARM] },
    // northpeak
    np_pine: { kind: 'tree', crown: '#3a5a60' }, np_deadpine: { kind: 'tree', crown: '#8aa0b0' },
    np_shelter: { kind: 'house', rect: [0.76, 90], light: [0.1, -0.35, 260, WARM], roof: '#e8f0f8' },
    np_rock: { kind: 'rock' }, np_flags: { kind: 'post' }, np_crystal: { kind: 'rock', light: [0, -0.5, 170, PALE] },
    np_snowbush: { kind: 'bush' }, np_grass: { kind: 'low', sway: 1 }, np_flowers: { kind: 'low', sway: 1 }, np_drift: { kind: 'low' },
    np_stone: { kind: 'rock' }, np_icicle: { kind: 'rock', light: [0, -0.5, 90, PALE] }, np_sled: { kind: 'rock' },
    np_cairn: { kind: 'post', light: [0, -0.8, 120, PALE] },
    // the north road
    nr_house: { kind: 'house', rect: [0.8, 95], light: [-0.25, -0.2, 200, WARM], roof: '#a08a5a' },
    nr_mill: { kind: 'house', rect: [0.44, 80], roof: '#8a7a6a' }, nr_elm: { kind: 'tree', crown: '#a09a6a' },
    nr_taxpole: { kind: 'post' }, nr_haystack: { kind: 'rock' }, nr_well: { kind: 'rock' },
    nr_wheat: { kind: 'low', sway: 1 }, nr_grass: { kind: 'low', sway: 1 }, nr_thistle: { kind: 'low', sway: 1 }, nr_bush: { kind: 'bush' },
    nr_fence: { kind: 'fence' }, nr_stones: { kind: 'rock' }, nr_basket: { kind: 'low' }, nr_scare: { kind: 'post' },
    // bellhaven outer ward
    bo_house: { kind: 'house', rect: [0.8, 95], light: [0.1, -0.35, 240, WARM], roof: '#4a6aa0' },
    bo_house2: { kind: 'house', rect: [0.82, 95], light: [-0.1, -0.3, 220, WARM], roof: '#a05a4a' },
    bo_gate: { kind: 'house', rect: [0.9, 120], light: [0, -0.3, 300, WARM], roof: '#6a7a9a' },
    bo_linden: { kind: 'tree', crown: '#6a9a5a' }, bo_cart: { kind: 'rock' }, bo_fountain: { kind: 'rock' },
    bo_lamp: { kind: 'post', light: [0, -0.86, 260, WARM] }, bo_barrels: { kind: 'rock' }, bo_bench: { kind: 'low' },
    bo_planter: { kind: 'rock' }, bo_crates: { kind: 'rock' }, bo_post: { kind: 'post' }, bo_grass: { kind: 'low', sway: 1 },
    bo_hydrant: { kind: 'rock' },
    // the canal ward
    bc_factory: { kind: 'house', rect: [0.86, 110], light: [0, -0.35, 340, CANDLE], roof: '#6a4a3a' },
    bc_stilthouse: { kind: 'house', rect: [0.7, 80], light: [0.2, -0.5, 220, CANDLE], roof: '#5a4a4a' },
    bc_bridge: { kind: 'rock', light: [0, -0.6, 200, CANDLE] }, bc_willow: { kind: 'tree', crown: '#2f4a3a' },
    bc_boat: { kind: 'rock', light: [0.2, -0.8, 140, CANDLE] }, bc_candles: { kind: 'rock', light: [0, -0.55, 200, CANDLE] },
    bc_lamp: { kind: 'post', light: [0.1, -0.84, 240, CANDLE] }, bc_waxpile: { kind: 'rock' }, bc_reeds: { kind: 'low', sway: 1 },
    bc_lily: { kind: 'low', light: [0, -0.4, 60, CANDLE] }, bc_crates: { kind: 'rock' }, bc_post: { kind: 'post' },
    bc_barrel: { kind: 'rock' }, bc_stairs: { kind: 'rock' },
    // the lake island
    li_chapel: { kind: 'house', rect: [0.76, 100], light: [0, -0.4, 280, PALE], roof: '#8a90a0' },
    li_ghosttree: { kind: 'tree', crown: '#c8d8e8' }, li_willow: { kind: 'tree', crown: '#8aa0a0' },
    li_lantern: { kind: 'post', light: [0, -0.7, 220, PALE] }, li_arch: { kind: 'rock' }, li_statue: { kind: 'post', light: [0.1, -0.6, 140, PALE] },
    li_reeds: { kind: 'low', sway: 1 }, li_lotus: { kind: 'low', light: [0, -0.4, 60, '230,230,255'] }, li_grass: { kind: 'low', sway: 1 },
    li_flowers: { kind: 'low', sway: 1, light: [0, -0.5, 60, '230,240,255'] }, li_rock: { kind: 'rock' },
    li_floatlamp: { kind: 'low', light: [0, -0.5, 110, WARM] }, li_bench: { kind: 'low' }, li_boat: { kind: 'rock', light: [0, -0.4, 90, PALE] },
    // the lightless south forest
    dk_tree: { kind: 'tree', crown: '#1a1a2a' }, dk_tree2: { kind: 'tree', crown: '#22202e' },
    dk_stone: { kind: 'tall', light: [0, -0.5, 170, '120,170,255'] }, dk_camp: { kind: 'rock' }, dk_roots: { kind: 'rock' },
    dk_glowrock: { kind: 'rock', light: [0, -0.5, 150, '120,170,255'] }, dk_grass: { kind: 'low', sway: 1 }, dk_fern: { kind: 'low', sway: 1 },
    dk_mush: { kind: 'low' }, dk_pool: { kind: 'low' }, dk_bush: { kind: 'bush' }, dk_rock: { kind: 'rock' }, dk_log: { kind: 'rock' },
    dk_bones: { kind: 'low' },
    // the cathedral ward
    cd_manor: { kind: 'house', rect: [0.8, 100], light: [0, -0.35, 260, '255,236,170'], roof: '#e8d8a0' },
    cd_spire: { kind: 'tall', light: [0, -0.9, 260, '255,236,170'], crown: '#f0e8d0' },
    cd_cypress: { kind: 'tree', crown: '#3a6a4a' }, cd_fountain: { kind: 'rock', light: [0, -0.6, 160, '255,240,190'] },
    cd_arch: { kind: 'rock' }, cd_orb: { kind: 'post', light: [0, -0.86, 280, '255,236,170'] },
    cd_hedge: { kind: 'bush' }, cd_roses: { kind: 'bush', walkThrough: true }, cd_lawn: { kind: 'low', sway: 1 }, cd_urn: { kind: 'rock' },
    cd_bench: { kind: 'low' }, cd_statue: { kind: 'post' }, cd_lamp: { kind: 'post', light: [0, -0.86, 260, '255,240,190'] },
    cd_poorhut: { kind: 'rock', light: [0.2, -0.4, 90, WARM] },
    // the doors into the new dungeons
    de_owl: { kind: 'house', rect: [0.56, 100], light: [0, -0.5, 300, WARM], roof: '#8a8a9a' },
    de_archive: { kind: 'house', rect: [0.76, 100], light: [0, -0.3, 260, CANDLE], roof: '#6a5a4a' },
    de_cellar: { kind: 'house', rect: [0.8, 100], light: [0, -0.3, 220, '255,120,120'], roof: '#e8e0c8' },
    de_bell: { kind: 'house', rect: [0.6, 120], light: [0, -0.3, 320, '255,236,170'], roof: '#f0e8d0' },
  });

  // ---------------- biomes (see fieldgen.js BIOMES) ----------------
  const specks = (n, d, count, size, blade) => ({ n, d, count, size, ...(blade ? { blade: 1 } : {}) });
  Object.assign(NC.BIOMES, {
    road: {
      base: { n: [52, 56, 50], d: [150, 146, 92] }, patch: { n: [60, 60, 52], d: [168, 150, 90] }, vary: 16, patchScale: 480,
      road: { n: [70, 66, 70], d: [176, 164, 140] }, roadEdge: { n: [58, 58, 60], d: [150, 138, 110] }, roadMid: { n: [80, 76, 80], d: [196, 184, 160] },
      water: { n: [36, 58, 88], d: [90, 150, 180] }, deep: { n: [28, 44, 72], d: [64, 120, 156] }, shore: { n: [60, 58, 54], d: [160, 146, 110] },
      specks: [specks(['rgba(255,170,90,0.45)', 'rgba(230,200,120,0.4)'], ['#e0903a', '#d0602a', '#f0c050', '#b07a3a'], 2600, [2, 5]),
        specks(['rgba(30,40,30,0.35)'], ['rgba(120,120,60,0.4)'], 1600, [3, 7], 1)],
      trees: [['pr_oak', 1], ['pr_birch', 1]], border: [['pr_oak', 1.2], ['pr_birch', 1]], grove: 0.56, fill: 0.56, lone: 0.3,
      bushes: [['pr_bush', 1]], nBush: 80, grass: [['pr_grass', 2], ['pr_leaves', 1]], nGrass: 480,
      flowers: [['pr_asters', 1], ['pr_leaves', 1]], nPatch: 40, rocks: [['pr_rock', 1], ['pr_crates', 0.3]], nRock: 50,
      mini: { ground: '#c8b880', road: '#9a8a70', water: '#7aaac4', tree: 'rgba(150,90,40,0.55)' },
    },
    salt: {
      base: { n: [56, 64, 74], d: [176, 186, 190] }, patch: { n: [62, 70, 80], d: [196, 204, 206] }, vary: 14, patchScale: 520,
      road: { n: [80, 84, 96], d: [228, 226, 220] }, roadEdge: { n: [66, 72, 84], d: [196, 198, 196] }, roadMid: { n: [88, 92, 104], d: [240, 238, 232] },
      water: { n: [34, 60, 96], d: [80, 150, 200] }, deep: { n: [24, 46, 80], d: [52, 118, 176] }, shore: { n: [70, 76, 86], d: [210, 214, 210] },
      specks: [specks(['rgba(240,248,255,0.5)', 'rgba(200,220,255,0.4)'], ['#ffffff', '#e8f0ff', '#c8d8e8'], 2800, [2, 4]),
        specks(['rgba(30,50,60,0.35)'], ['rgba(90,140,120,0.35)'], 1400, [3, 7], 1)],
      trees: [['sx_poplar', 1]], border: [['sx_poplar', 1]], grove: 0.6, fill: 0.44, lone: 0.26,
      bushes: [['sx_reeds', 1]], nBush: 50, grass: [['sx_grass', 2], ['sx_reeds', 0.4]], nGrass: 420,
      flowers: [['sx_flowers', 1]], nPatch: 36, rocks: [['sx_rock', 1], ['sx_barrels', 0.12], ['sx_crystal', 0.12]], nRock: 44,
      shorePlants: [['sx_reeds', 1.4], ['sx_grass', 0.6]],
      mini: { ground: '#dfe4e6', road: '#b8b4a8', water: '#6a9cc8', tree: 'rgba(80,110,100,0.5)' },
    },
    peak: {
      base: { n: [62, 70, 88], d: [212, 222, 236] }, patch: { n: [70, 78, 96], d: [228, 236, 246] }, vary: 16, patchScale: 460,
      road: { n: [78, 80, 96], d: [180, 184, 196] }, roadEdge: { n: [70, 74, 90], d: [200, 206, 218] }, roadMid: { n: [86, 88, 104], d: [168, 172, 186] },
      water: { n: [96, 128, 170], d: [170, 210, 240] }, deep: { n: [80, 110, 156], d: [140, 190, 230] }, shore: { n: [80, 88, 104], d: [230, 236, 246] },
      mesaTop: { n: [74, 82, 100], d: [230, 236, 246] }, mesaRim: { n: [90, 98, 116], d: [246, 250, 255] },
      mesaFace: { n: [50, 56, 76], d: [120, 130, 150] }, mesaFace2: { n: [40, 44, 64], d: [96, 104, 126] },
      mesaDeco: [['np_drift', 1.5], ['np_stone', 1], ['np_pine', 0.3], ['np_icicle', 0.4]],
      specks: [specks(['rgba(255,255,255,0.55)', 'rgba(190,210,255,0.45)'], ['#ffffff', '#e0ecff', '#c8d8f0'], 3200, [2, 5]),
        specks(['rgba(30,40,60,0.3)'], ['rgba(140,160,190,0.3)'], 900, [3, 6], 1)],
      trees: [['np_pine', 1.4], ['np_deadpine', 0.8]], border: [['np_pine', 1.4], ['np_deadpine', 0.8], ['np_rock', 0.4]], grove: 0.6, fill: 0.52, lone: 0.3,
      bushes: [['np_snowbush', 1]], nBush: 60, grass: [['np_grass', 1], ['np_drift', 1]], nGrass: 360,
      flowers: [['np_flowers', 1], ['np_drift', 0.8]], nPatch: 34, rocks: [['np_stone', 1], ['np_rock', 0.5], ['np_icicle', 0.4], ['np_crystal', 0.2]], nRock: 60,
      mini: { ground: '#e6eef6', road: '#a8b0c0', water: '#a8cce8', mesa: '#c8d4e4', tree: 'rgba(50,80,90,0.55)' },
    },
    nroad: {
      base: { n: [56, 58, 56], d: [164, 156, 112] }, patch: { n: [62, 62, 58], d: [180, 168, 118] }, vary: 16, patchScale: 560,
      road: { n: [74, 70, 72], d: [170, 150, 120] }, roadEdge: { n: [64, 62, 62], d: [150, 140, 104] }, roadMid: { n: [82, 78, 80], d: [188, 168, 136] },
      water: { n: [40, 58, 82], d: [100, 140, 160] }, deep: { n: [30, 44, 68], d: [70, 110, 136] }, shore: { n: [62, 60, 58], d: [160, 150, 118] },
      specks: [specks(['rgba(230,210,150,0.4)', 'rgba(160,160,170,0.4)'], ['#c8b070', '#a09060', '#e0d090', '#8a8a80'], 2400, [2, 5]),
        specks(['rgba(40,40,30,0.35)'], ['rgba(120,110,70,0.4)'], 2000, [3, 8], 1)],
      trees: [['nr_elm', 1]], border: [['nr_elm', 1.2]], grove: 0.66, fill: 0.4, lone: 0.22,
      bushes: [['nr_bush', 1]], nBush: 60, grass: [['nr_grass', 2], ['nr_wheat', 1]], nGrass: 520,
      flowers: [['nr_thistle', 1], ['nr_wheat', 1.2]], nPatch: 44, rocks: [['nr_stones', 1], ['nr_basket', 0.2]], nRock: 44,
      mini: { ground: '#c8bc8a', road: '#9a8468', water: '#7a9cb0', tree: 'rgba(110,100,60,0.55)' },
    },
    outer: {
      base: { n: [58, 60, 72], d: [150, 148, 140] }, patch: { n: [64, 66, 78], d: [166, 162, 150] }, vary: 12, patchScale: 380,
      road: { n: [74, 74, 88], d: [184, 176, 160] }, roadEdge: { n: [62, 62, 76], d: [150, 144, 130] }, roadMid: { n: [82, 82, 96], d: [198, 190, 174] },
      water: { n: [36, 54, 84], d: [90, 140, 170] }, deep: { n: [26, 40, 70], d: [62, 110, 146] }, shore: { n: [66, 66, 76], d: [160, 154, 140] },
      specks: [specks(['rgba(120,120,140,0.5)', 'rgba(90,90,110,0.5)'], ['#8a8a8a', '#a8a49a', '#6a6a70'], 3600, [3, 6]),
        specks(['rgba(40,60,40,0.3)'], ['rgba(90,130,70,0.35)'], 900, [3, 6], 1)],
      cracks: 70,
      trees: [['bo_linden', 1]], border: [['bo_linden', 1], ['bo_house', 0.5], ['bo_house2', 0.4]], grove: 0.7, fill: 0.3, lone: 0.2,
      bushes: [['bo_planter', 1]], nBush: 40, grass: [['bo_grass', 1]], nGrass: 260,
      flowers: [['bo_grass', 1], ['bo_bench', 0.3]], nPatch: 20, rocks: [['bo_barrels', 1], ['bo_crates', 1], ['bo_hydrant', 0.4]], nRock: 50,
      mini: { ground: '#b8b4aa', road: '#d0c8b4', water: '#6a9cc0', tree: 'rgba(80,110,70,0.55)' },
    },
    canal: {
      base: { n: [44, 46, 58], d: [120, 116, 110] }, patch: { n: [50, 50, 62], d: [134, 128, 118] }, vary: 12, patchScale: 420,
      road: { n: [66, 62, 72], d: [168, 150, 124] }, roadEdge: { n: [56, 54, 64], d: [138, 126, 108] }, roadMid: { n: [74, 70, 80], d: [184, 166, 138] },
      water: { n: [22, 30, 48], d: [50, 70, 90] }, deep: { n: [14, 20, 36], d: [34, 50, 70] }, shore: { n: [60, 56, 62], d: [120, 110, 100] },
      specks: [specks(['rgba(255,200,110,0.45)', 'rgba(100,100,120,0.5)'], ['#6a6460', '#8a8070', '#ffc86a', '#4a4650'], 3000, [2, 5]),
        specks(['rgba(20,30,30,0.35)'], ['rgba(60,80,60,0.35)'], 900, [3, 6], 1)],
      cracks: 60,
      trees: [['bc_willow', 1]], border: [['bc_willow', 1], ['bc_stilthouse', 0.35]], grove: 0.66, fill: 0.36, lone: 0.22,
      bushes: [['bc_reeds', 1]], nBush: 50, grass: [['bc_reeds', 1]], nGrass: 240,
      flowers: [['bc_waxpile', 0.4], ['bc_reeds', 1]], nPatch: 20, rocks: [['bc_crates', 1], ['bc_barrel', 1], ['bc_waxpile', 0.5]], nRock: 50,
      shorePlants: [['bc_reeds', 1.4], ['bc_lily', 1], ['bc_post', 0.3]],
      mini: { ground: '#8a8480', road: '#b09a78', water: '#34465a', tree: 'rgba(40,60,50,0.6)' },
    },
    isle: {
      base: { n: [44, 58, 66], d: [150, 170, 170] }, patch: { n: [50, 64, 72], d: [166, 184, 182] }, vary: 14, patchScale: 440,
      road: { n: [66, 72, 84], d: [196, 196, 190] }, roadEdge: { n: [56, 64, 74], d: [170, 176, 170] }, roadMid: { n: [74, 80, 92], d: [214, 212, 206] },
      water: { n: [30, 48, 84], d: [80, 120, 160] }, deep: { n: [20, 32, 64], d: [50, 90, 136] }, shore: { n: [60, 70, 80], d: [176, 182, 176] },
      specks: [specks(['rgba(220,235,255,0.55)', 'rgba(200,210,255,0.45)'], ['#ffffff', '#e0ecf8', '#c8d0e0'], 2400, [2, 4]),
        specks(['rgba(20,40,50,0.35)'], ['rgba(100,130,130,0.35)'], 1400, [3, 7], 1)],
      trees: [['li_ghosttree', 1], ['li_willow', 1]], border: [['li_willow', 1], ['li_ghosttree', 0.8]], grove: 0.52, fill: 0.6, lone: 0.3,
      bushes: [['li_reeds', 0.6]], nBush: 40, grass: [['li_grass', 2], ['li_reeds', 0.6]], nGrass: 420,
      flowers: [['li_flowers', 1], ['li_lotus', 0.2]], nPatch: 36, rocks: [['li_rock', 1], ['li_bench', 0.2]], nRock: 36,
      shorePlants: [['li_reeds', 1.4], ['li_lotus', 1], ['li_floatlamp', 0.4]],
      mini: { ground: '#b8cccc', road: '#9aa0a4', water: '#50709a', tree: 'rgba(120,150,170,0.55)' },
    },
    dark: {
      base: { n: [22, 24, 34], d: [60, 62, 74] }, patch: { n: [26, 28, 38], d: [70, 70, 82] }, vary: 10, patchScale: 460,
      road: { n: [38, 38, 50], d: [92, 88, 96] }, roadEdge: { n: [30, 30, 42], d: [76, 74, 84] }, roadMid: { n: [44, 44, 56], d: [104, 100, 108] },
      water: { n: [10, 12, 22], d: [20, 24, 36] }, deep: { n: [4, 6, 14], d: [10, 12, 22] }, shore: { n: [30, 30, 40], d: [56, 56, 66] },
      specks: [specks(['rgba(120,170,255,0.35)', 'rgba(60,60,80,0.5)'], ['#3a3a4a', '#5a5a6a', '#6a8aff', '#2a2a36'], 2400, [2, 5]),
        specks(['rgba(10,10,20,0.4)'], ['rgba(40,44,50,0.4)'], 2000, [3, 8], 1)],
      trees: [['dk_tree', 1], ['dk_tree2', 1]], border: [['dk_tree', 1.2], ['dk_tree2', 1]], grove: 0.58, fill: 0.46, lone: 0.26,
      bushes: [['dk_bush', 1], ['dk_fern', 0.8]], nBush: 100, grass: [['dk_grass', 2], ['dk_fern', 0.6]], nGrass: 480,
      flowers: [['dk_mush', 1], ['dk_bones', 0.2]], nPatch: 36, rocks: [['dk_rock', 1], ['dk_log', 0.8], ['dk_glowrock', 0.3], ['dk_roots', 0.4]], nRock: 60,
      shorePlants: [['dk_fern', 1], ['dk_grass', 1]],
      mini: { ground: '#4a4c5a', road: '#6a6874', water: '#141824', tree: 'rgba(10,10,20,0.7)' },
    },
    cathedral: {
      base: { n: [60, 66, 72], d: [196, 206, 176] }, patch: { n: [66, 72, 78], d: [180, 204, 150] }, vary: 10, patchScale: 400,
      road: { n: [86, 86, 96], d: [240, 234, 214] }, roadEdge: { n: [74, 74, 86], d: [212, 204, 176] }, roadMid: { n: [94, 94, 104], d: [252, 246, 228] },
      water: { n: [40, 62, 100], d: [110, 180, 220] }, deep: { n: [30, 50, 86], d: [80, 150, 200] }, shore: { n: [80, 80, 90], d: [236, 230, 210] },
      specks: [specks(['rgba(255,240,190,0.45)', 'rgba(255,255,255,0.4)'], ['#ffffff', '#fff4d0', '#e8d890'], 2000, [2, 4]),
        specks(['rgba(30,50,40,0.3)'], ['rgba(90,160,70,0.4)'], 2200, [3, 6], 1)],
      trees: [['cd_cypress', 1]], border: [['cd_cypress', 1], ['cd_manor', 0.4], ['cd_hedge', 0.6]], grove: 0.8, fill: 0.26, lone: 0.18,
      bushes: [['cd_hedge', 1], ['cd_roses', 1]], nBush: 90, grass: [['cd_lawn', 2]], nGrass: 360,
      flowers: [['cd_roses', 0.6], ['cd_lawn', 1]], nPatch: 24, rocks: [['cd_urn', 1], ['cd_bench', 0.6]], nRock: 36,
      mini: { ground: '#d8e4c0', road: '#f4ecd4', water: '#7ab8e0', tree: 'rgba(50,100,70,0.55)' },
    },
  });

  // ---------------- joins into the old maps (their far roads end at a new warp) ----------------
  const join = (id, warp, road) => {
    const M = NC.MAPS[id];
    if (!M || (M.warps || []).some((w) => w.id === warp.id)) return;
    (M.warps = M.warps || []).push(warp);
    if (road) (M.roads = M.roads || []).push(road);
  };
  join('burnt', { id: 'north', x: 3100, y: 130, to: 'road', at: 'south' }, { w: 54, pts: [[3100, 620], [3110, 300], [3100, 40]] });
  join('wind', { id: 'east', x: 5270, y: 1750, to: 'peak', at: 'west' }, { w: 60, pts: [[5000, 1750], [5360, 1750]] });
  join('meadow', { id: 'south', x: 1250, y: 3670, to: 'dark', at: 'north' }, { w: 54, pts: [[1300, 3050], [1260, 3400], [1250, 3760]] });
  // the lake: a boat at the east dock
  join('lake', { id: 'boat', x: 3560, y: 2140, to: 'isle', at: 'boat' }, { w: 50, pts: [[3500, 2320], [3540, 2200]] });
  if (NC.MAPS.lake) (NC.MAPS.lake.landmarks = NC.MAPS.lake.landmarks || []).push(['li_boat', 3640, 2110, { flip: true }]);

  // ---------------- the maps ----------------
  Object.assign(NC.MAPS, {
    road: {
      name: 'ถนนผู้อพยพ', lvText: 'Lv 32–42', biome: 'road', W: 5400, H: 3400, seed: 401,
      lv: { slime: [32, 38], hollow: [35, 42] }, spawns: [['slime', 14], ['hollow', 14]],
      warps: [
        { id: 'south', x: 2700, y: 3270, to: 'burnt', at: 'north' },
        { id: 'east', x: 5270, y: 1500, to: 'salt', at: 'west' },
      ],
      roads: [
        { w: 76, pts: [[2700, 3360], [2650, 2800], [2300, 2300], [2500, 1800], [3200, 1560], [4200, 1500], [5360, 1500]] },
        { w: 60, pts: [[2300, 2300], [1500, 2100], [900, 1600], [600, 1000]] },
        { w: 54, pts: [[3200, 1560], [3300, 900], [3700, 500]] },
      ],
      lanterns: ['pr_milestone', 1000],
      ponds: [{ x: 4200, y: 2700, rx: 380, ry: 180, reeds: 8 }],
      landmarks: [
        ['pr_shelter', 2980, 2380], ['pr_cart', 3200, 2440], ['pr_sign', 2480, 2240], ['pr_crates', 2800, 2460, { flip: true }],
        ['pr_wagon', 3500, 1420], ['pr_wagon', 1400, 1950, { flip: true }], ['pr_wagon', 900, 1200], ['pr_cart', 1150, 1500, { flip: true }],
        ['pr_crates', 1650, 2250], ['pr_cart', 4600, 1400], ['pr_fence', 3650, 1650], ['pr_fence', 3800, 1650],
      ],
      safe: [[2600, 2150, 3400, 2620]],
      zones: [
        { name: 'ศาลาพักริมทาง', rect: [2560, 2120, 3440, 2660] },
        { name: 'ขบวนเกวียนล่ม', rect: [500, 700, 2000, 2200], lv: { slime: [38, 40], hollow: [39, 42] } },
      ],
    },

    salt: {
      name: 'ด่านสะพานเกลือ', lvText: 'Lv 36–48', biome: 'salt', W: 5400, H: 3800, seed: 409,
      lv: { slime: [36, 42], hollow: [40, 48] }, spawns: [['slime', 14], ['hollow', 16]],
      warps: [
        { id: 'west', x: 130, y: 1700, to: 'road', at: 'east' },
        { id: 'north', x: 2700, y: 130, to: 'peak', at: 'south' },
      ],
      roads: [
        { w: 80, pts: [[40, 1700], [900, 1750], [1800, 1900], [2600, 1800], [2700, 1000], [2700, 40]] },
        { w: 62, pts: [[2600, 1800], [3300, 2300], [3900, 2500]] },
        { w: 62, pts: [[2700, 1000], [3400, 850], [3900, 820]] },
        { w: 58, pts: [[2600, 1800], [3400, 1750], [4050, 1720]] },
      ],
      lanterns: ['sx_lamp', 820],
      ponds: [{ x: 4900, y: 1900, rx: 560, ry: 1500, reeds: 20 }, { x: 1200, y: 3100, rx: 360, ry: 170, reeds: 8 }],
      landmarks: [
        ['sx_gate', 920, 1640], ['sx_castle', 3900, 640], ['sx_bridge', 4180, 1700],
        ['sx_warehouse', 3450, 2520], ['sx_warehouse', 4050, 2780, { flip: true }], ['sx_warehouse', 3300, 3150],
        ['sx_saltpile', 3750, 2400], ['sx_saltpile', 3900, 3100, { flip: true }], ['sx_barrels', 3150, 2600], ['sx_barrels', 4300, 2500],
        ['sx_post', 4300, 1850], ['sx_post', 4330, 1560], ['sx_crystal', 1700, 2900],
      ],
      safe: [[250, 1400, 1150, 2050]],
      zones: [
        { name: 'ลานคนรอข้ามด่าน', rect: [200, 1360, 1200, 2100] },
        { name: 'โกดังเกลือ', rect: [2950, 2150, 4450, 3600], lv: { slime: [42, 44], hollow: [42, 46] } },
        { name: 'ปราสาทเจ้าด่าน', rect: [3200, 250, 4450, 1100], lv: { slime: [44, 46], hollow: [45, 48] } },
      ],
    },

    peak: {
      name: 'ยอดเขาหมอกเหนือ', lvText: 'Lv 46–58', biome: 'peak', W: 5200, H: 4000, seed: 419,
      lv: { slime: [46, 52], hollow: [50, 58] }, spawns: [['slime', 14], ['hollow', 16]],
      warps: [
        { id: 'south', x: 2600, y: 3870, to: 'salt', at: 'north' },
        { id: 'west', x: 130, y: 2000, to: 'wind', at: 'east' },
        { id: 'east', x: 5070, y: 1200, to: 'nroad', at: 'west' },
      ],
      roads: [
        { w: 70, pts: [[2600, 3960], [2500, 3300], [2200, 2700], [2400, 2000], [2600, 1300], [2600, 520]] },
        { w: 60, pts: [[40, 2000], [800, 2050], [1600, 2150], [2200, 2700]] },
        { w: 60, pts: [[2400, 2000], [3300, 1700], [4200, 1300], [5160, 1200]] },
        { w: 52, pts: [[2500, 3300], [3100, 2900], [3300, 2620]] },
      ],
      mesas: [{ x: 1200, y: 900, rx: 520, ry: 260, deco: 7 }, { x: 4200, y: 2800, rx: 560, ry: 280, deco: 7 }, { x: 900, y: 3200, rx: 420, ry: 210, deco: 5 }],
      ponds: [{ x: 3800, y: 700, rx: 340, ry: 160 }],
      landmarks: [
        ['np_shelter', 3300, 2560], ['np_flags', 3000, 2620], ['np_sled', 3500, 2700], ['np_cairn', 2300, 1900],
        ['np_cairn', 3600, 1560, { flip: true }], ['np_flags', 1700, 2200], ['np_rock', 2900, 1200], ['np_crystal', 2200, 900],
      ],
      safe: [[2950, 2350, 3700, 2850]],
      zones: [
        { name: 'ที่หลบพายุ', rect: [2900, 2300, 3750, 2900] },
        { name: 'สันเขาพายุหิมะ', rect: [3300, 150, 5100, 1050], lv: { slime: [54, 56], hollow: [55, 58] } },
      ],
    },

    nroad: {
      name: 'เส้นทางขึ้นเหนือ', lvText: 'Lv 60–72', biome: 'nroad', W: 5600, H: 3400, seed: 431,
      lv: { slime: [60, 66], hollow: [64, 72] }, spawns: [['slime', 14], ['hollow', 16]],
      warps: [
        { id: 'west', x: 130, y: 1700, to: 'peak', at: 'east' },
        { id: 'east', x: 5470, y: 1600, to: 'outer', at: 'west' },
      ],
      roads: [
        { w: 76, pts: [[40, 1700], [900, 1650], [1800, 1800], [2800, 1700], [3800, 1500], [4700, 1600], [5560, 1600]] },
        { w: 60, pts: [[2800, 1700], [2700, 2400], [2500, 2900]] },
        { w: 54, pts: [[1800, 1800], [1700, 1100], [1500, 700]] },
      ],
      lanterns: ['nr_taxpole', 1150],
      ponds: [{ x: 4300, y: 2700, rx: 320, ry: 150, reeds: 6 }],
      landmarks: [
        ['nr_house', 1500, 620], ['nr_well', 1760, 720], ['nr_haystack', 1250, 760, { flip: true }],
        ['nr_house', 2300, 2600], ['nr_house', 2900, 2800, { flip: true }], ['nr_house', 2450, 3100, { flip: true }], ['nr_mill', 3400, 2500],
        ['nr_well', 2700, 2700], ['nr_haystack', 3100, 2350], ['nr_scare', 1100, 2600], ['nr_scare', 4000, 900, { flip: true }],
        ['nr_fence', 3700, 2300], ['nr_fence', 3850, 2300], ['nr_house', 4600, 800, { flip: true }],
      ],
      safe: [[1150, 350, 1950, 900]],
      zones: [
        { name: 'บ้านที่ยังมีตะเกียง', rect: [1100, 300, 2000, 950] },
        { name: 'หมู่บ้านร้าง', rect: [2000, 2150, 3700, 3300], lv: { slime: [66, 70], hollow: [68, 72] } },
      ],
    },

    outer: {
      name: 'ย่านนอกกำแพง', lvText: 'Lv 68–82', biome: 'outer', W: 5600, H: 3800, seed: 443,
      lv: { slime: [68, 74], hollow: [72, 82] }, spawns: [['slime', 14], ['hollow', 17]],
      warps: [
        { id: 'west', x: 130, y: 1900, to: 'nroad', at: 'east' },
        { id: 'east', x: 5470, y: 1900, to: 'canal', at: 'west' },
      ],
      roads: [
        { w: 84, pts: [[40, 1900], [1000, 1950], [2000, 1850], [3000, 1900], [4000, 1880], [4900, 1900], [5560, 1900]] },
        { w: 62, pts: [[2000, 1850], [2100, 1000], [2200, 400]] },
        { w: 62, pts: [[3000, 1900], [3100, 2700], [3000, 3500]] },
        { w: 56, pts: [[1000, 1950], [900, 2800], [1300, 3300]] },
        { w: 56, pts: [[2100, 1000], [3000, 900], [3800, 1000]] },
      ],
      lanterns: ['bo_lamp', 620],
      landmarks: [
        ['bo_fountain', 2000, 1900], ['bo_bench', 1780, 2080], ['bo_planter', 2250, 2080],
        ['bo_gate', 5000, 1780], ['bo_house', 1600, 1400], ['bo_house2', 2400, 1450, { flip: true }], ['bo_house', 2500, 900],
        ['bo_house2', 1700, 900], ['bo_house', 3400, 1500, { flip: true }], ['bo_house2', 3500, 2400], ['bo_house', 2600, 2500],
        ['bo_house', 1300, 2500, { flip: true }], ['bo_house2', 700, 2400], ['bo_house', 3400, 700], ['bo_cart', 2700, 2050],
        ['bo_post', 1400, 2100], ['bo_barrels', 3700, 2100], ['bo_crates', 3850, 2150, { flip: true }],
      ],
      safe: [[1700, 1600, 2330, 2200]],
      zones: [
        { name: 'จัตุรัสน้ำพุ', rect: [1650, 1550, 2380, 2250] },
        { name: 'หน้าประตูเมือง', rect: [4000, 1100, 5500, 2700], lv: { slime: [78, 80], hollow: [78, 82] } },
      ],
    },

    canal: {
      name: 'ย่านริมคลอง', lvText: 'Lv 74–86', biome: 'canal', W: 5400, H: 3800, seed: 457,
      lv: { slime: [74, 80], hollow: [78, 86] }, spawns: [['slime', 15], ['hollow', 16]],
      warps: [
        { id: 'west', x: 130, y: 1900, to: 'outer', at: 'east' },
        { id: 'east', x: 5270, y: 1900, to: 'cathedral', at: 'west' },
      ],
      roads: [
        { w: 74, pts: [[40, 1900], [900, 1900], [1800, 1800], [2700, 1900], [3600, 1850], [4500, 1900], [5360, 1900]] },
        { w: 58, pts: [[2700, 1900], [2800, 2300], [3600, 2350], [3900, 2250]] },
        { w: 54, pts: [[900, 1900], [950, 2300]] }, // (on to the archive's door: dungeons2.js)
        { w: 54, pts: [[1800, 1800], [1900, 1300], [2600, 1350]] },
      ],
      lanterns: ['bc_lamp', 600],
      ponds: [
        { x: 1500, y: 1050, rx: 760, ry: 150, lilies: 8, reeds: 8 }, { x: 3700, y: 1000, rx: 840, ry: 160, lilies: 8, reeds: 8 },
        { x: 2100, y: 2950, rx: 900, ry: 170, lilies: 8, reeds: 8 }, { x: 4400, y: 2950, rx: 560, ry: 160, lilies: 6, reeds: 6 },
      ],
      landmarks: [
        ['bc_factory', 3900, 2150], ['bc_candles', 3550, 2300], ['bc_waxpile', 4250, 2250], ['bc_barrel', 3450, 2150],
        ['bc_stilthouse', 1300, 850], ['bc_stilthouse', 3200, 780, { flip: true }], ['bc_stilthouse', 4300, 820], ['bc_stilthouse', 1800, 2750, { flip: true }],
        ['bc_bridge', 2400, 1180], ['bc_boat', 2800, 1050], ['bc_boat', 1600, 3000, { flip: true }], ['bc_stairs', 700, 1200],
        ['bc_crates', 600, 2150], ['bc_barrel', 760, 2200],
      ],
      safe: [[350, 1650, 1100, 2250]],
      zones: [
        { name: 'ท่าเรือเล็ก', rect: [300, 1600, 1150, 2300] },
        { name: 'โรงเทียน', rect: [3300, 1950, 4700, 2700], lv: { slime: [82, 84], hollow: [82, 86] } },
      ],
    },

    isle: {
      name: 'เกาะกลางทะเลสาบ', lvText: 'Lv 84–92', biome: 'isle', W: 4400, H: 3400, seed: 467,
      lv: { slime: [84, 88], hollow: [86, 92] }, spawns: [['slime', 10], ['hollow', 14]],
      warps: [{ id: 'boat', x: 200, y: 1700, to: 'lake', at: 'boat' }],
      roads: [
        { w: 64, pts: [[120, 1700], [800, 1650], [1500, 1500], [2100, 1250], [2200, 900]] },
        { w: 52, pts: [[1500, 1500], [1900, 2100], [2700, 2400], [3400, 2200]] },
        { w: 48, pts: [[2100, 1250], [2900, 1300], [3500, 1000]] },
      ],
      lanterns: ['li_lantern', 700],
      ponds: [
        { x: 700, y: 500, rx: 700, ry: 380, lilies: 10, reeds: 14 }, { x: 3800, y: 400, rx: 700, ry: 320, lilies: 8, reeds: 12 },
        { x: 600, y: 3000, rx: 680, ry: 360, lilies: 10, reeds: 14 }, { x: 3900, y: 3050, rx: 620, ry: 340, lilies: 8, reeds: 12 },
        { x: 2300, y: 3250, rx: 800, ry: 200, reeds: 10 }, { x: 4300, y: 1700, rx: 220, ry: 600, reeds: 10 },
      ],
      landmarks: [
        ['li_chapel', 2200, 780], ['li_statue', 1900, 900], ['li_statue', 2500, 900, { flip: true }], ['li_arch', 2900, 1500],
        ['li_bench', 2000, 1150], ['li_arch', 1200, 2300, { flip: true }], ['li_statue', 3300, 2300], ['li_boat', 330, 1560],
      ],
      safe: [[150, 1450, 800, 1950]],
      zones: [
        { name: 'ท่าเรือเกาะ', rect: [120, 1400, 850, 2000] },
        { name: 'หอหินเก่า', rect: [1600, 400, 2900, 1300], lv: { slime: [88, 90], hollow: [90, 92] } },
      ],
    },

    dark: {
      name: 'ป่าใต้ที่มืดสนิท', lvText: 'Lv 86–96', biome: 'dark', W: 5400, H: 4000, seed: 479,
      lv: { slime: [86, 90], hollow: [88, 96] }, spawns: [['slime', 12], ['hollow', 18]],
      warps: [{ id: 'north', x: 1250, y: 130, to: 'meadow', at: 'south' }],
      roads: [
        { w: 64, pts: [[1250, 40], [1400, 700], [1900, 1400], [2600, 2000], [3300, 2600], [3900, 3300]] },
        { w: 52, pts: [[1900, 1400], [1000, 1900], [700, 2700]] },
        { w: 52, pts: [[2600, 2000], [3600, 1500], [4500, 1200]] },
      ],
      ponds: [
        { x: 700, y: 3300, rx: 420, ry: 200 }, { x: 4400, y: 2400, rx: 380, ry: 180 }, { x: 2600, y: 900, rx: 320, ry: 160 },
      ],
      landmarks: [
        ['dk_camp', 3950, 3350], ['dk_stone', 2300, 1700], ['dk_stone', 3700, 1600, { flip: true }], ['dk_stone', 900, 2500],
        ['dk_glowrock', 1500, 800], ['dk_glowrock', 3100, 2300], ['dk_roots', 4700, 1300], ['dk_bones', 3500, 3000],
      ],
      safe: [[900, 180, 1650, 650]],
      zones: [
        { name: 'ปากทางป่ามืด', rect: [850, 150, 1700, 700] },
        { name: 'แคมป์ที่ไฟดับ', rect: [3300, 2800, 4700, 3800], lv: { slime: [92, 94], hollow: [94, 96] } },
      ],
    },

    cathedral: {
      name: 'ย่านวิหาร', lvText: 'Lv 92–99', biome: 'cathedral', W: 5600, H: 3800, seed: 487,
      lv: { slime: [92, 96], hollow: [94, 99] }, spawns: [['slime', 14], ['hollow', 18]],
      warps: [{ id: 'west', x: 130, y: 1900, to: 'canal', at: 'east' }],
      roads: [
        { w: 90, pts: [[40, 1900], [1200, 1900], [2400, 1800], [3400, 1600], [4200, 1100], [4400, 860]] },
        { w: 58, pts: [[2400, 1800], [2500, 2700], [2300, 3400]] },
        { w: 56, pts: [[1200, 1900], [1100, 1400], [1000, 1180]] },
        { w: 56, pts: [[3400, 1600], [4200, 2200], [5000, 2400]] },
      ],
      lanterns: ['cd_orb', 560],
      ponds: [{ x: 3000, y: 2500, rx: 300, ry: 150, lilies: 6 }],
      landmarks: [
        ['cd_fountain', 2400, 1800], ['cd_manor', 1800, 1400], ['cd_manor', 2900, 1300, { flip: true }], ['cd_manor', 3300, 2200],
        ['cd_manor', 1700, 2400, { flip: true }], ['cd_manor', 4600, 2800], ['cd_arch', 3800, 1500], ['cd_statue', 2150, 1600],
        ['cd_statue', 2650, 1600, { flip: true }], ['cd_spire', 3600, 700], ['cd_urn', 1400, 1700],
        ['cd_poorhut', 2000, 3100], ['cd_poorhut', 2600, 3300, { flip: true }], ['cd_poorhut', 2900, 3000], ['cd_poorhut', 2200, 3450],
      ],
      safe: [[200, 1600, 850, 2200]],
      zones: [
        { name: 'ประตูย่านวิหาร', rect: [150, 1550, 900, 2250] },
        { name: 'ย่านคนจนหลังรั้ว', rect: [1700, 2800, 3300, 3700] },
        { name: 'ลานระฆังขาว', rect: [3700, 300, 5400, 1500], lv: { slime: [96, 98], hollow: [97, 99] } },
      ],
    },
  });

  // ---------------- each map's air ----------------
  const tint = (k) => (minutes, n) => {
    const b = NC.skyAmbient ? NC.skyAmbient(minutes, n) : [255 - 83 * n, 255 - 69 * n, 255 - 23 * n];
    return [Math.round(b[0] * (1 - k[0] * n)), Math.round(b[1] * (1 - k[1] * n)), Math.round(b[2] * (1 - k[2] * n))];
  };
  const AIR = {
    road: { ambient: tint([0, 0.04, 0.14]) },
    salt: { ambient: tint([0.06, 0.02, 0]) },
    peak: { ambient: tint([0.06, 0.02, 0]), snow: true },
    nroad: { dusk: 0.2, ambient: tint([0.02, 0.04, 0.12]) },
    outer: { dusk: 0.22 },
    canal: { dusk: 0.42, ambient: tint([0.02, 0.1, 0.16]) },
    isle: { dusk: 0.36, ambient: tint([0.1, 0.04, 0]), mist: true },
    dark: { dusk: 0.7, ambient: tint([0.3, 0.26, 0.1]) },
    cathedral: { dusk: 0.05, ambient: (minutes, n) => { const b = tint([0, 0.02, 0.2])(minutes, n); return [Math.min(255, b[0] + 26 * n), Math.min(255, b[1] + 18 * n), b[2]]; } },
  };
  const baseField = NC.buildField;
  NC.buildField = function (def) {
    const w = baseField.apply(this, arguments);
    if (def && AIR[def.id]) Object.assign(w, AIR[def.id]);
    return w;
  };

  // snow blowing across the mountain top (as the wind cliffs' streaks in fields3.js: maps.js empties the effect list)
  let snowFx = null;
  function snowFrame(game) {
    if (!game.world || !game.world.snow || (snowFx && NC.FX.list.includes(snowFx))) return;
    snowFx = NC.FX.add({ type: 'custom', layer: 'high', x: 0, y: 0, life: Infinity, draw(ctx) {
      const g = NC.game;
      if (!g.world || !g.world.snow) return;
      const c = g.cam, T = g.time, span = g.vw + 400, spanY = g.vh + 200;
      ctx.save();
      for (let i = 0; i < 110; i++) {
        // each flake drifts down and east, wobbling; nearer ones bigger and faster
        const f = (i * 0.618034) % 1, h = (i * 0.381966) % 1, near = 0.5 + (i % 5) * 0.2;
        const x = c.x - 200 + ((f * span + T * 90 * near + Math.sin(T * 1.3 + i) * 20) % span);
        const y = c.y - 100 + ((h * spanY + T * 70 * near) % spanY);
        ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * (near - 0.5)})`;
        ctx.beginPath(); ctx.arc(x, y, 2 + near * 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } });
  }
  (NC.assetsLoaded || (NC.assetsLoaded = [])).push(() => {
    const baseLoot = NC.updateLoot;
    NC.updateLoot = function (game) { snowFrame(game); return baseLoot.apply(this, arguments); };
  });
})();
