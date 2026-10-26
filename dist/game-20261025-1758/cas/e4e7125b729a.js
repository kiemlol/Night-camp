/* fields3.js — the third batch of hunting fields, for the middle and high levels (classic MMO style: at every level more
   than one place to go, each with its own elements, so each suits some jobs better; the world map in js/worldmap.js
   shows which):
     burnt    ป่าไหม้ถ่านคุ        Lv 30–45  fire + ghost: ember foxes, charred stumps, ash wisps, lava slimes. North of the
                                        glowing-mushroom woods; a charcoal burners' camp (safe)
     wind     ทุ่งลมหวีดหน้าผา     Lv 36–50  wind: storm eagles, cloud rams, gust sprites, bees. Grassy cliff tops (raised
                                        plateaus), a ring of standing stones, a shepherd's hut (safe); streaks of wind
     prime    ป่าดึกดำบรรพ์       Lv 72–92  earth: raptors, rhino beetles, elder treants, wolves. Giant trees and tree
                                        ferns, a fossil ribcage, nests of big eggs; the old heart of the forest is Lv 92
     swamp    หนองพิษป่าชายเลน    Lv 48–62  poison (+ earth): poison toads, swamp snakes, man-eater flowers, glow slimes.
                                        Toxic ponds, giant glowing mushrooms, a swamp witch's hut (safe); dim and green
     lake     ทะเลสาบหมอกเงา      Lv 70–88  water + shadow: kappas, mist wraiths, shadow herons, bats. A great lake with a
                                        sunken arch, stone lanterns, an old boathouse (safe); mist, dusky all day
     volcano  ภูเขาไฟหลับ         Lv 66–84  fire: salamanders, magma golems, flame bats, scorpions, lava slimes. Glowing
                                        lava pools, obsidian spires, an old miners' forge (safe), a dragon's skull
   Joins: woods (north) -> burnt -> (east) wind -> (north) prime · graveyard (east) -> swamp -> (north) lake <- (east)
   marsh · canyon (south) -> volcano. This adds the warps and roads to the woods and the canyon (maps.js); fields2.js
   has the graveyard's and the marsh's. fieldgen.js draws the maps (its pond 'glow' and biome 'mesaDeco' were added
   for these). All-new art: assets/maps/ (assets/gen/make_map3_prompts.py -> Codex -> tools/cutout.py). Monsters:
   js/monsters3.js. Load after fields2.js. */
(function () {
  'use strict';
  const NC = window.NC;

  // ---------------- props: how each stands (see fieldgen.js PROPS); crown / roof: its colour on the minimap ----------
  Object.assign(NC.FIELD_PROPS, {
    // the burnt charcoal forest
    b_burnttree: { kind: 'tree', crown: '#4a4040' }, b_scorchpine: { kind: 'tree', crown: '#6a6a3a' },
    b_kiln: { kind: 'house', rect: [0.72, 80], light: [-0.33, -0.19, 260, '255,150,60'], roof: '#8a6a4a' },
    b_hut: { kind: 'house', rect: [0.76, 90], light: [-0.18, -0.36, 260, '255,190,110'], roof: '#5a4a3a' },
    b_logpile: { kind: 'rock' }, b_emberrock: { kind: 'rock', light: [-0.09, -0.41, 170, '255,120,50'] },
    b_ashgrass: { kind: 'low', sway: 1 }, b_sprouts: { kind: 'low' }, b_embers: { kind: 'low', light: [0, -0.43, 120, '255,130,50'] },
    b_firelily: { kind: 'low', sway: 1, light: [0.06, -0.57, 80, '255,140,70'] }, b_stump: { kind: 'rock', light: [-0.03, -0.48, 100, '255,130,60'] },
    b_bush: { kind: 'bush' }, b_rock: { kind: 'rock' }, b_fence: { kind: 'fence' },
    // the howling wind cliffs
    k_windtree: { kind: 'tree', crown: '#8cc46a' }, k_pine: { kind: 'tree', crown: '#3f7a6a' },
    k_shephut: { kind: 'house', rect: [0.72, 80], light: [0.14, -0.36, 240, '255,196,120'], roof: '#7aa050' },
    k_cairn: { kind: 'post' }, k_vane: { kind: 'post' }, k_standing: { kind: 'tall' },
    k_tallgrass: { kind: 'low', sway: 1 }, k_grass: { kind: 'low', sway: 1 }, k_edelweiss: { kind: 'low', sway: 1 },
    k_heather: { kind: 'low', sway: 1 }, k_bush: { kind: 'bush' }, k_rock: { kind: 'rock' }, k_boulder: { kind: 'rock' },
    k_wall: { kind: 'fence' },
    // the poison mangrove swamp
    p_deadtree: { kind: 'tree', crown: '#5a4a6a' }, p_mangrove: { kind: 'tree', crown: '#3f5a3a' },
    p_witchhut: { kind: 'house', rect: [0.6, 80], light: [0.07, -0.39, 260, '160,255,120'], roof: '#6a5a4a' },
    p_bigshroom: { kind: 'tall', light: [0, -0.69, 240, '150,255,120'], crown: '#8a5ac8' },
    p_cauldron: { kind: 'rock', light: [0.01, -0.66, 180, '150,255,100'] }, p_totem: { kind: 'post', light: [0.47, -0.44, 180, '180,255,120'] },
    p_reeds: { kind: 'low', sway: 1 }, p_glowflowers: { kind: 'low', sway: 1, light: [-0.03, -0.53, 90, '170,255,130'] },
    p_bubbles: { kind: 'low', light: [0.03, -0.59, 80, '170,255,130'] }, p_grass: { kind: 'low', sway: 1 },
    p_bush: { kind: 'bush' }, p_rock: { kind: 'rock' }, p_log: { kind: 'rock' }, p_shrooms: { kind: 'low' },
    // the sleeping volcano
    v_deadtree: { kind: 'tree', crown: '#3a2e2e' }, v_spire: { kind: 'tall', crown: '#2e2638' },
    v_forge: { kind: 'house', rect: [0.72, 100], light: [0, -0.35, 300, '255,150,60'], roof: '#5a4a44' },
    v_skull: { kind: 'rock' }, v_vent: { kind: 'rock', light: [0, -0.54, 200, '255,130,50'] }, v_basalt: { kind: 'rock' },
    v_ashgrass: { kind: 'low', sway: 1 }, v_firebloom: { kind: 'low', sway: 1, light: [-0.15, -0.62, 90, '255,140,60'] },
    v_lavapuddle: { kind: 'low', light: [0, -0.48, 130, '255,120,40'] }, v_crystals: { kind: 'rock', light: [-0.05, -0.41, 160, '255,90,70'] },
    v_rock: { kind: 'rock' }, v_pebbles: { kind: 'low' }, v_shrub: { kind: 'bush' }, v_steam: { kind: 'low' },
    // the misty shadow lake
    l_silvertree: { kind: 'tree', crown: '#a8c8c0' }, l_cypress: { kind: 'tree', crown: '#2f5a58' },
    l_boathouse: { kind: 'house', rect: [0.8, 90], light: [0.11, -0.34, 240, '150,210,255'], roof: '#4a4a58' },
    l_arch: { kind: 'rock' }, l_lantern: { kind: 'post', light: [0.01, -0.46, 220, '150,210,255'] }, l_dock: { kind: 'rock' },
    l_reeds: { kind: 'low', sway: 1 }, l_lotus: { kind: 'low', light: [0.02, -0.52, 70, '220,190,255'] }, l_grass: { kind: 'low', sway: 1 },
    l_shrooms: { kind: 'low', light: [-0.18, -0.6, 90, '140,200,255'] }, l_bush: { kind: 'bush' }, l_rock: { kind: 'rock' },
    l_driftwood: { kind: 'rock' }, l_fence: { kind: 'fence' },
    // the primeval forest
    j_bigtree: { kind: 'tree', crown: '#3f7a3a' }, j_treefern: { kind: 'tall', crown: '#5aa050' }, j_cycad: { kind: 'tall', crown: '#6a9a40' },
    j_ribcage: { kind: 'rock' }, j_nest: { kind: 'rock' }, j_boulder: { kind: 'rock' },
    j_fern: { kind: 'low', sway: 1 }, j_horsetail: { kind: 'low', sway: 1 }, j_flowers: { kind: 'low', sway: 1 }, j_grass: { kind: 'low', sway: 1 },
    j_bush: { kind: 'bush' }, j_rock: { kind: 'rock' }, j_log: { kind: 'rock' }, j_fungi: { kind: 'low' },
  });

  // ---------------- biomes: ground palettes (n = night, d = day) and what grows where (see fieldgen.js BIOMES) --------
  Object.assign(NC.BIOMES, {
    burnt: {
      base: { n: [48, 46, 54], d: [120, 110, 100] }, patch: { n: [56, 52, 58], d: [138, 124, 108] }, vary: 16, patchScale: 460,
      road: { n: [66, 60, 66], d: [176, 150, 118] }, roadEdge: { n: [56, 52, 58], d: [148, 128, 104] }, roadMid: { n: [74, 68, 74], d: [194, 168, 134] },
      water: { n: [34, 50, 76], d: [86, 128, 150] }, deep: { n: [26, 38, 62], d: [62, 100, 126] }, shore: { n: [58, 54, 60], d: [140, 128, 110] },
      specks: [
        { n: ['rgba(255,140,60,0.55)', 'rgba(90,86,96,0.5)'], d: ['#5a5050', '#8a8078', '#3a3434', '#ff9a50'], count: 2400, size: [2, 5] },
        { n: ['rgba(80,120,70,0.35)'], d: ['rgba(90,140,70,0.45)'], count: 900, size: [3, 6], blade: 1 },
      ],
      cracks: 90,
      trees: [['b_burnttree', 1], ['b_scorchpine', 0.8]], border: [['b_scorchpine', 1.2], ['b_burnttree', 1]], grove: 0.56, fill: 0.62, lone: 0.32,
      bushes: [['b_bush', 1]], nBush: 70, grass: [['b_ashgrass', 2], ['b_sprouts', 1]], nGrass: 460,
      flowers: [['b_firelily', 1], ['b_embers', 0.8], ['b_sprouts', 0.6]], nPatch: 34,
      rocks: [['b_rock', 1], ['b_stump', 0.9], ['b_emberrock', 0.4], ['b_logpile', 0.3]], nRock: 60,
      mini: { ground: '#b8ada0', road: '#8a7058', water: '#6f94a8', tree: 'rgba(50,44,44,0.6)' },
    },
    wind: {
      base: { n: [48, 70, 70], d: [138, 180, 108] }, patch: { n: [56, 78, 74], d: [156, 194, 118] }, vary: 18, patchScale: 560,
      road: { n: [70, 74, 84], d: [206, 190, 150] }, roadEdge: { n: [60, 70, 76], d: [168, 170, 124] }, roadMid: { n: [78, 82, 92], d: [222, 208, 170] },
      water: { n: [40, 66, 106], d: [100, 180, 220] }, deep: { n: [30, 52, 92], d: [72, 148, 202] }, shore: { n: [66, 74, 84], d: [196, 190, 150] },
      mesaTop: { n: [70, 84, 80], d: [150, 176, 120] }, mesaRim: { n: [82, 96, 88], d: [170, 196, 136] },
      mesaFace: { n: [58, 60, 70], d: [140, 138, 132] }, mesaFace2: { n: [46, 48, 60], d: [112, 110, 108] },
      mesaDeco: [['k_grass', 1.5], ['k_heather', 1], ['k_rock', 1], ['k_edelweiss', 0.8], ['k_pine', 0.25]],
      specks: [
        { n: ['rgba(240,244,255,0.5)', 'rgba(210,190,255,0.45)'], d: ['#ffffff', '#f4f0ff', '#c9b8f0', '#fff6c0'], count: 2400, size: [2, 4.5] },
        { n: ['rgba(30,50,48,0.35)'], d: ['rgba(90,140,70,0.35)'], count: 1800, size: [3, 8], blade: 1 },
      ],
      trees: [['k_windtree', 1], ['k_pine', 1]], border: [['k_pine', 1.3], ['k_windtree', 0.8]], grove: 0.66, fill: 0.46, lone: 0.26,
      bushes: [['k_bush', 1], ['k_heather', 0.8]], nBush: 60, grass: [['k_tallgrass', 1], ['k_grass', 2]], nGrass: 400,
      flowers: [['k_edelweiss', 1], ['k_heather', 0.6]], nPatch: 40,
      rocks: [['k_rock', 1], ['k_boulder', 0.6]], nRock: 50,
      mini: { ground: '#cfe0b0', road: '#a08a64', water: '#7cb8e0', mesa: '#9aa08e', tree: 'rgba(70,110,80,0.55)' },
    },
    swamp: {
      base: { n: [36, 44, 50], d: [84, 104, 80] }, patch: { n: [42, 50, 54], d: [96, 116, 84] }, vary: 14, patchScale: 420,
      road: { n: [54, 54, 64], d: [140, 122, 96] }, roadEdge: { n: [46, 50, 58], d: [112, 110, 84] }, roadMid: { n: [62, 62, 72], d: [158, 138, 110] },
      water: { n: [58, 60, 70], d: [110, 150, 90] }, deep: { n: [70, 40, 90], d: [120, 80, 140] }, shore: { n: [48, 48, 56], d: [106, 104, 80] },
      specks: [
        { n: ['rgba(170,255,130,0.5)', 'rgba(200,150,255,0.4)'], d: ['#a8e070', '#b890e0', '#6a7a4a'], count: 1800, size: [2, 4.5] },
        { n: ['rgba(20,30,30,0.4)'], d: ['rgba(50,70,50,0.4)'], count: 2000, size: [3, 7], blade: 1 },
      ],
      trees: [['p_deadtree', 1], ['p_mangrove', 1]], border: [['p_mangrove', 1.2], ['p_deadtree', 1]], grove: 0.52, fill: 0.66, lone: 0.34,
      bushes: [['p_bush', 1]], nBush: 80, grass: [['p_grass', 2], ['p_reeds', 0.5]], nGrass: 520,
      flowers: [['p_glowflowers', 1], ['p_shrooms', 1], ['p_bubbles', 0.6]], nPatch: 44,
      rocks: [['p_rock', 1], ['p_log', 0.8]], nRock: 46,
      giants: [['p_bigshroom', 1]], nGiant: 22,
      shorePlants: [['p_reeds', 1.4], ['p_grass', 0.6], ['p_shrooms', 0.4]],
      mini: { ground: '#9aa88a', road: '#6e5e4a', water: '#8a78a8', tree: 'rgba(50,50,60,0.6)' },
    },
    volcano: {
      base: { n: [44, 36, 44], d: [96, 78, 72] }, patch: { n: [52, 40, 46], d: [112, 88, 78] }, vary: 14, patchScale: 520,
      road: { n: [70, 58, 62], d: [150, 120, 98] }, roadEdge: { n: [58, 48, 54], d: [124, 98, 84] }, roadMid: { n: [78, 64, 68], d: [170, 138, 112] },
      water: { n: [255, 128, 46], d: [255, 120, 40] }, deep: { n: [255, 196, 90], d: [255, 190, 80] }, shore: { n: [40, 30, 36], d: [60, 44, 44] },
      mesaTop: { n: [52, 44, 52], d: [84, 70, 70] }, mesaRim: { n: [62, 52, 60], d: [100, 84, 82] },
      mesaFace: { n: [38, 30, 40], d: [62, 50, 54] }, mesaFace2: { n: [30, 24, 34], d: [48, 38, 44] },
      mesaDeco: [['v_rock', 1], ['v_ashgrass', 1], ['v_crystals', 0.5], ['v_basalt', 0.3]],
      specks: [
        { n: ['rgba(255,120,50,0.6)', 'rgba(80,60,70,0.5)'], d: ['#3a2e30', '#6a5048', '#ff7a40', '#2a2226'], count: 2600, size: [2, 5] },
      ],
      cracks: 220,
      trees: [['v_deadtree', 1], ['v_spire', 0.7]], border: [['v_spire', 1.2], ['v_deadtree', 1], ['v_basalt', 0.6]], grove: 0.62, fill: 0.5, lone: 0.3,
      bushes: [['v_shrub', 1]], nBush: 50, grass: [['v_ashgrass', 1]], nGrass: 300,
      flowers: [['v_firebloom', 1], ['v_pebbles', 1], ['v_lavapuddle', 0.5], ['v_steam', 0.4]], nPatch: 36,
      rocks: [['v_rock', 1], ['v_crystals', 0.5], ['v_vent', 0.35], ['v_basalt', 0.5]], nRock: 70,
      mini: { ground: '#8a766c', road: '#b0906c', water: '#ff8a3a', mesa: '#5a4a4a', tree: 'rgba(40,30,34,0.6)' },
    },
    lake: {
      base: { n: [34, 50, 60], d: [92, 132, 120] }, patch: { n: [40, 56, 64], d: [104, 144, 128] }, vary: 14, patchScale: 480,
      road: { n: [58, 62, 74], d: [160, 150, 132] }, roadEdge: { n: [48, 56, 66], d: [128, 134, 116] }, roadMid: { n: [66, 70, 82], d: [178, 168, 150] },
      water: { n: [34, 54, 92], d: [80, 130, 170] }, deep: { n: [24, 36, 72], d: [50, 96, 146] }, shore: { n: [52, 60, 70], d: [150, 150, 130] },
      specks: [
        { n: ['rgba(190,220,255,0.5)', 'rgba(220,200,255,0.45)'], d: ['#e8f0ff', '#d8c8f0', '#ffffff'], count: 1800, size: [2, 4] },
        { n: ['rgba(20,40,50,0.35)'], d: ['rgba(60,100,90,0.35)'], count: 1800, size: [3, 7], blade: 1 },
      ],
      trees: [['l_silvertree', 1], ['l_cypress', 1]], border: [['l_cypress', 1.2], ['l_silvertree', 1]], grove: 0.54, fill: 0.62, lone: 0.32,
      bushes: [['l_bush', 1]], nBush: 70, grass: [['l_grass', 2], ['l_reeds', 0.4]], nGrass: 480,
      flowers: [['l_shrooms', 1], ['l_lotus', 0.6]], nPatch: 40, rocks: [['l_rock', 1], ['l_driftwood', 0.8]], nRock: 44,
      shorePlants: [['l_reeds', 1.4], ['l_lotus', 0.8], ['l_grass', 0.5]],
      mini: { ground: '#a4c0b4', road: '#7a6e5e', water: '#5a88b0', tree: 'rgba(40,70,70,0.55)' },
    },
    prime: {
      base: { n: [30, 56, 50], d: [74, 138, 72] }, patch: { n: [36, 64, 54], d: [90, 154, 80] }, vary: 16, patchScale: 440,
      road: { n: [52, 60, 62], d: [150, 120, 84] }, roadEdge: { n: [42, 56, 54], d: [110, 118, 72] }, roadMid: { n: [60, 68, 70], d: [170, 140, 100] },
      water: { n: [30, 62, 84], d: [74, 156, 170] }, deep: { n: [22, 46, 68], d: [52, 124, 146] }, shore: { n: [44, 56, 56], d: [118, 124, 88] },
      specks: [
        { n: ['rgba(255,200,120,0.4)', 'rgba(200,255,200,0.4)'], d: ['#ffcf6a', '#ff8a5a', '#fff0c0'], count: 1600, size: [2, 4.5] },
        { n: ['rgba(10,40,30,0.4)'], d: ['rgba(40,100,50,0.4)'], count: 2400, size: [3, 8], blade: 1 },
      ],
      trees: [['j_bigtree', 1], ['j_treefern', 0.8]], border: [['j_bigtree', 1.2], ['j_treefern', 1]], grove: 0.5, fill: 0.72, lone: 0.34,
      bushes: [['j_bush', 1], ['j_fern', 1]], nBush: 130, grass: [['j_grass', 2], ['j_fern', 1], ['j_horsetail', 0.8]], nGrass: 560,
      flowers: [['j_flowers', 1], ['j_fungi', 0.7]], nPatch: 44, rocks: [['j_rock', 1], ['j_log', 0.7], ['j_boulder', 0.4]], nRock: 50,
      giants: [['j_treefern', 1], ['j_cycad', 1]], nGiant: 30,
      shorePlants: [['j_horsetail', 1], ['j_fern', 1]],
      mini: { ground: '#9cc890', road: '#7a6448', water: '#6ab4c4', tree: 'rgba(30,80,40,0.6)' },
    },
  });

  // ---------------- joins into the first maps (maps.js): the woods' north road, the canyon's south road ----------------
  const join = (id, warp, road) => {
    const M = NC.MAPS[id];
    if (!M || (M.warps || []).some((w) => w.id === warp.id)) return;
    (M.warps = M.warps || []).push(warp);
    (M.roads = M.roads || []).push(road);
  };
  join('woods', { id: 'north', x: 2800, y: 130, to: 'burnt', at: 'south' }, { w: 54, pts: [[3550, 1600], [3150, 1150], [2850, 650], [2800, 40]] });
  join('canyon', { id: 'south', x: 3120, y: 3070, to: 'volcano', at: 'north' }, { w: 64, pts: [[3200, 2250], [3150, 2700], [3120, 3160]] });

  const LAVA = '255,120,40';
  // ---------------- the maps ----------------
  Object.assign(NC.MAPS, {
    burnt: {
      name: 'ป่าไหม้ถ่านคุ', lvText: 'Lv 35–45', biome: 'burnt', W: 5000, H: 3600, seed: 71,
      lv: { slime: [35, 40], hollow: [38, 43] },
      spawns: [['slime', 16], ['hollow', 12]],
      warps: [
        { id: 'south', x: 2600, y: 3470, to: 'woods', at: 'north' },
        { id: 'east', x: 4870, y: 1500, to: 'wind', at: 'west' },
      ],
      roads: [
        { w: 74, pts: [[2600, 3560], [2550, 3000], [2300, 2500], [2400, 2000], [2800, 1650], [3500, 1550], [4200, 1500], [4960, 1500]] },
        { w: 60, pts: [[2400, 2000], [1900, 1700], [1450, 1300], [1180, 1000]] },
        { w: 54, pts: [[2800, 1650], [2900, 1100], [3100, 620]] },
      ],
      ponds: [{ x: 3650, y: 820, rx: 260, ry: 140, lilies: 3 }],
      landmarks: [
        ['b_hut', 1000, 760], ['b_kiln', 1380, 700, { flip: true }], ['b_kiln', 760, 1020], ['b_logpile', 1220, 940],
        ['b_logpile', 880, 620, { flip: true }], ['b_emberrock', 1500, 960], ['b_embers', 1150, 820],
        ['b_emberrock', 3180, 560], ['b_emberrock', 4100, 2700, { flip: true }], ['b_stump', 3800, 2400],
      ],
      safe: [[680, 480, 1620, 1120]],
      zones: [
        { name: 'ลานเผาถ่าน', rect: [640, 440, 1660, 1160] },
        { name: 'ทุ่งเถ้าถ่าน', rect: [3300, 2100, 4800, 3400], lv: { slime: [39, 43], hollow: [41, 45] } },
      ],
    },

    wind: {
      name: 'ทุ่งลมหวีดหน้าผา', lvText: 'Lv 42–52', biome: 'wind', W: 5400, H: 3600, seed: 83,
      lv: { slime: [42, 47], hollow: [46, 50] },
      spawns: [['slime', 16], ['hollow', 14]],
      warps: [
        { id: 'west', x: 130, y: 1500, to: 'burnt', at: 'east' },
        { id: 'north', x: 3200, y: 130, to: 'prime', at: 'south' },
      ],
      roads: [
        { w: 74, pts: [[40, 1500], [700, 1550], [1400, 1650], [2100, 1550], [2700, 1300], [3100, 800], [3200, 40]] },
        { w: 60, pts: [[2100, 1550], [2800, 1800], [3500, 1900], [4300, 1800], [5000, 1750]] },
        { w: 54, pts: [[2800, 1800], [3000, 2400], [3200, 3000]] },
      ],
      mesas: [
        { x: 1150, y: 780, rx: 480, ry: 250, deco: 6 }, { x: 4300, y: 880, rx: 580, ry: 290, deco: 8 },
        { x: 2150, y: 2720, rx: 430, ry: 220, deco: 5 }, { x: 4250, y: 2650, rx: 500, ry: 250, deco: 6 },
      ],
      ponds: [{ x: 700, y: 3000, rx: 300, ry: 150, lilies: 3 }],
      landmarks: [
        ['k_shephut', 1760, 1340], ['k_vane', 1990, 1390], ['k_cairn', 2620, 1150], ['k_cairn', 3380, 2330, { flip: true }],
        ['k_boulder', 1560, 1420, { flip: true }], ['k_wall', 1500, 1200], ['k_wall', 1640, 1200],
      ],
      rings: [{ x: 1000, y: 2320, r: 290, names: ['k_standing'], n: 7, gap: [1.25, 1.95] }],
      safe: [[1500, 1080, 2150, 1470]],
      zones: [
        { name: 'กระท่อมคนเลี้ยงแกะ', rect: [1460, 1040, 2200, 1480] },
        { name: 'ยอดผาลมแรง', rect: [3500, 250, 5300, 1450], lv: { slime: [46, 50], hollow: [48, 52] } },
        { name: 'วงหินโบราณ', rect: [600, 2000, 1400, 2700] },
      ],
    },

    prime: {
      name: 'ป่าดึกดำบรรพ์', lvText: 'Lv 88–99', biome: 'prime', W: 5600, H: 4000, seed: 139,
      lv: { slime: [88, 92], hollow: [90, 95] },
      spawns: [['slime', 18], ['hollow', 14]],
      warps: [{ id: 'south', x: 2800, y: 3870, to: 'wind', at: 'north' }],
      roads: [
        { w: 74, pts: [[2800, 3960], [2750, 3300], [2400, 2700], [2600, 2100], [3100, 1600], [3000, 1000], [2800, 500]] },
        { w: 60, pts: [[2400, 2700], [1700, 2500], [1100, 2000], [800, 1400]] },
        { w: 60, pts: [[2600, 2100], [3400, 2300], [4200, 2100], [4900, 1700]] },
      ],
      ponds: [
        { x: 1500, y: 3320, rx: 380, ry: 200, lilies: 8, reeds: 10 }, { x: 4300, y: 3120, rx: 440, ry: 220, lilies: 10, reeds: 12 },
        { x: 1350, y: 880, rx: 300, ry: 160, lilies: 4, reeds: 8 },
      ],
      landmarks: [
        ['j_ribcage', 3350, 2900], ['j_nest', 1000, 2700], ['j_nest', 4700, 1250, { flip: true }], ['j_boulder', 3700, 2950],
        ['j_boulder', 2250, 1500, { flip: true }], ['j_nest', 2200, 700],
      ],
      zones: [
        { name: 'หุบรังไข่', rect: [600, 2250, 1650, 3050], lv: { hollow: [92, 96] } },
        { name: 'ใจกลางป่าโบราณ', rect: [2200, 250, 3800, 1500], lv: { slime: [94, 97], hollow: [96, 99] } },
      ],
    },

    swamp: {
      name: 'หนองพิษป่าชายเลน', lvText: 'Lv 50–62', biome: 'swamp', W: 5200, H: 3800, seed: 97,
      lv: { slime: [50, 56], hollow: [54, 60] },
      spawns: [['slime', 16], ['hollow', 14]],
      warps: [
        { id: 'west', x: 130, y: 1500, to: 'graveyard', at: 'east' },
        { id: 'north', x: 2800, y: 130, to: 'lake', at: 'south' },
      ],
      roads: [
        { w: 70, pts: [[40, 1500], [700, 1450], [1300, 1600], [1900, 1500], [2500, 1600], [2850, 1100], [2780, 600], [2800, 40]] },
        { w: 58, pts: [[2500, 1600], [3000, 2000], [3600, 2200], [4300, 2100], [5000, 1900]] },
        { w: 54, pts: [[1900, 1500], [1800, 2100], [2000, 2600], [1900, 3300]] },
        { w: 50, pts: [[2800, 1000], [3100, 850], [3300, 900]] }, // to the witch's hut
      ],
      ponds: [
        { x: 1150, y: 2620, rx: 500, ry: 250, lilies: 6, reeds: 14 }, { x: 2250, y: 880, rx: 360, ry: 190, reeds: 10 },
        { x: 3650, y: 1480, rx: 440, ry: 220, reeds: 12 }, { x: 4200, y: 2920, rx: 540, ry: 270, reeds: 16 },
        { x: 2620, y: 2920, rx: 290, ry: 150, reeds: 8 }, { x: 4550, y: 700, rx: 290, ry: 150, reeds: 8 },
      ],
      landmarks: [
        ['p_witchhut', 3380, 820], ['p_cauldron', 3560, 900], ['p_totem', 3150, 1000], ['p_totem', 3640, 700, { flip: true }],
        ['p_bigshroom', 3000, 700, { scale: 1.1 }], ['p_totem', 600, 1330],
      ],
      safe: [[3080, 560, 3760, 1040]],
      zones: [
        { name: 'กระท่อมแม่มดหนอง', rect: [3040, 520, 3800, 1080] },
        { name: 'ใจกลางหนองพิษ', rect: [3500, 2300, 5100, 3650], lv: { slime: [56, 60], hollow: [58, 62] } },
      ],
    },

    lake: {
      name: 'ทะเลสาบหมอกเงา', lvText: 'Lv 78–90', biome: 'lake', W: 5400, H: 3800, seed: 127,
      lv: { slime: [78, 83], hollow: [82, 87] },
      spawns: [['slime', 16], ['hollow', 14]],
      warps: [
        { id: 'west', x: 130, y: 1700, to: 'marsh', at: 'east' },
        { id: 'south', x: 2700, y: 3670, to: 'swamp', at: 'north' },
      ],
      roads: [
        { w: 72, pts: [[40, 1700], [700, 1750], [1400, 2250], [2100, 2420], [2700, 2520], [2700, 3000], [2700, 3760]] },
        { w: 60, pts: [[700, 1750], [1200, 1000], [1900, 680], [2800, 580], [3700, 680], [4350, 1100]] },
        { w: 60, pts: [[2700, 2520], [3500, 2320], [4150, 2000], [4350, 1100]] },
      ],
      ponds: [
        { x: 2800, y: 1480, rx: 980, ry: 470, lilies: 22, reeds: 30 }, { x: 900, y: 2950, rx: 360, ry: 180, reeds: 10 },
        { x: 4650, y: 2850, rx: 420, ry: 210, lilies: 6, reeds: 12 }, { x: 4750, y: 620, rx: 300, ry: 150, reeds: 8 },
      ],
      lanterns: ['l_lantern', 720],
      landmarks: [
        ['l_boathouse', 2420, 2170], ['l_dock', 2050, 2030], ['l_dock', 3420, 2060, { flip: true }],
        ['l_arch', 3150, 1330], ['l_silvertree', 1500, 1500, { scale: 1.05 }],
      ],
      safe: [[2150, 1980, 2760, 2360]],
      zones: [
        { name: 'ท่าเรือเก่า', rect: [2100, 1940, 2800, 2400] },
        { name: 'ฝั่งเหนือหมอกหนา', rect: [1100, 250, 4500, 1000], lv: { slime: [84, 88], hollow: [86, 90] } },
      ],
    },

    volcano: {
      name: 'ภูเขาไฟหลับ', lvText: 'Lv 70–82', biome: 'volcano', W: 5200, H: 3800, seed: 109,
      lv: { slime: [70, 75], hollow: [74, 79] },
      spawns: [['slime', 16], ['hollow', 14]],
      warps: [{ id: 'north', x: 2600, y: 130, to: 'canyon', at: 'south' }],
      roads: [
        { w: 74, pts: [[2600, 40], [2550, 600], [2200, 1000], [1700, 1500], [1500, 2100], [1600, 2700], [1400, 3400]] },
        { w: 60, pts: [[2550, 600], [3200, 600], [4000, 540], [4700, 700]] },
        { w: 60, pts: [[1700, 1500], [2300, 1900], [3200, 2000], [3900, 2300], [4600, 2400]] },
      ],
      ponds: [
        { x: 1100, y: 1150, rx: 420, ry: 220, glow: LAVA }, { x: 3800, y: 1020, rx: 480, ry: 240, glow: LAVA },
        { x: 2600, y: 2620, rx: 580, ry: 290, glow: LAVA }, { x: 4300, y: 2950, rx: 360, ry: 180, glow: LAVA },
        { x: 900, y: 2950, rx: 360, ry: 180, glow: LAVA },
      ],
      mesas: [{ x: 2720, y: 1330, rx: 320, ry: 170, deco: 4 }, { x: 4500, y: 1780, rx: 320, ry: 170, deco: 4 }],
      landmarks: [
        ['v_forge', 3020, 440], ['v_skull', 2000, 3150], ['v_vent', 3300, 380], ['v_crystals', 2780, 470, { flip: true }],
        ['v_basalt', 2200, 3350, { flip: true }], ['v_vent', 1800, 2950],
      ],
      safe: [[2760, 200, 3420, 560]],
      zones: [
        { name: 'โรงตีเหล็กร้าง', rect: [2720, 160, 3460, 600] },
        { name: 'สุสานมังกร', rect: [1500, 2800, 2700, 3700], lv: { slime: [76, 80], hollow: [78, 82] } },
      ],
    },
  });

  // ---------------- each map's air: dim swamp, misty lake, warm volcano, wind over the cliffs ----------------
  const tint = (k) => (minutes, n) => {
    const b = NC.skyAmbient ? NC.skyAmbient(minutes, n) : [255 - 83 * n, 255 - 69 * n, 255 - 23 * n];
    return [Math.round(b[0] * (1 - k[0] * n)), Math.round(b[1] * (1 - k[1] * n)), Math.round(b[2] * (1 - k[2] * n))];
  };
  const AIR = {
    swamp: { dusk: 0.3, ambient: tint([0.16, 0.02, 0.14]) },
    lake: { dusk: 0.36, ambient: tint([0.12, 0.06, 0]), mist: true },
    volcano: { dusk: 0.18, ambient: (minutes, n) => { const b = tint([0, 0.1, 0.24])(minutes, n); return [Math.min(255, b[0] + 30 * n), b[1], b[2]]; } },
    burnt: { ambient: tint([0, 0.08, 0.16]) },
    wind: { gusts: true },
  };
  const baseField = NC.buildField;
  NC.buildField = function (def) {
    const w = baseField.apply(this, arguments);
    if (def && AIR[def.id]) Object.assign(w, AIR[def.id]);
    return w;
  };

  // streaks of wind over the cliffs (fields2.js puts the mist back the same way: maps.js empties the effect list)
  let gustFx = null;
  function gustFrame(game) {
    if (!game.world || !game.world.gusts || (gustFx && NC.FX.list.includes(gustFx))) return;
    gustFx = NC.FX.add({ type: 'custom', layer: 'high', x: 0, y: 0, life: Infinity, draw(ctx) {
      const g = NC.game;
      if (!g.world || !g.world.gusts) return;
      const c = g.cam, T = g.time, span = g.vw + 800;
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < 22; i++) {
        // each streak blows east fast, fades in and out along its way; leaves tumble with some of them
        const f = (i * 0.618034) % 1, sp = 520 + (i % 5) * 90, len = 90 + (i % 4) * 40;
        const x = c.x - 400 + ((f * span + T * sp) % span), y = c.y + ((i * 0.381966) % 1) * g.vh + Math.sin(T * 1.7 + i) * 18;
        const u = ((f * span + T * sp) % span) / span, a = Math.sin(Math.PI * u) * 0.35;
        ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - len, y + 6); ctx.quadraticCurveTo(x - len * 0.4, y - 8, x, y); ctx.stroke();
        if (i % 3 === 0) {
          ctx.fillStyle = `rgba(${i % 2 ? '150,200,100' : '220,200,120'},${a * 2})`;
          ctx.save(); ctx.translate(x + 14, y); ctx.rotate(T * 6 + i); ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }
      ctx.restore();
    } });
  }
  (NC.assetsLoaded || (NC.assetsLoaded = [])).push(() => {
    const baseLoot = NC.updateLoot;
    NC.updateLoot = function (game) { gustFrame(game); return baseLoot.apply(this, arguments); };
  });
})();
