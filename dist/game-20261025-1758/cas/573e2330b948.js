/* fields5.js — the expansion's part 1 (the user, 2026-09-30: zone 2 / zone 3 off the Lv 1-99 maps, more and more varied
   monsters): eleven zone maps, each off the far edge of an old field, all-new art, and the root caves under the poison
   swamp (a new dungeon for the thin Lv 60-75 band). Monsters: js/monsters6.js (with monkinds.js's new ways to fight).
     farm2       ไร่ร้างหลังเขา         Lv 10–18  north of the pumpkin farm
     meadow2     เนินดอกไม้กลางคืน      Lv 14–22  west of the moonlit meadow
     marsh2      ต้นลำธาร              Lv 20–28  north of the frog marsh
     marsh3      น้ำตกหิ่งห้อย          Lv 26–34  on up the stream · boss ราชินีกบน้ำตก Lv 34
     graveyard2  สุสานเก่าหลังเนิน       Lv 28–38  south of the graveyard
     woods2      ป่าเห็ดชั้นใน           Lv 36–46  west of the glowing mushroom woods
     wind2       เกาะหินลอยลม           Lv 44–54  south of the wind cliffs
     swamp2      รากต้นแม่พิษ           Lv 56–66  east of the poison swamp · the root caves' mouth (roots1-2, Lv 62–75,
                                                boss หัวใจต้นแม่พิษ Lv 75)
     canyon2     เหมืองลึกผลึกส้ม        Lv 62–72  west of the red canyon
     canyon3     ใจกลางหุบผา            Lv 70–80  on from the deep mine · boss ราชาแมงป่องทราย Lv 80
     prime2      ทะเลสาบไข่มังกร        Lv 88–98  north of the primeval forest · boss แม่มังกรไพร Lv 98
   Art: assets/maps/ (fz_ mh_ sh_ wf_ og_ im_ fr_ rp_ cm_ ch_ el_ dr_; assets/gen/make_map5_prompts.py). Load after
   fields4.js, dungeons2.js and monsters6.js. */
(function () {
  'use strict';
  const NC = window.NC;
  const WARM = '255,196,120';

  // ---------------- props ----------------
  const P = (o) => Object.assign(NC.FIELD_PROPS, o);
  P({
    fz_barn: { kind: 'house', rect: [0.8, 100], roof: '#a04a3a' }, fz_sunflower: { kind: 'tall', crown: '#e0b030', walkThrough: true },
    fz_oak: { kind: 'tree', crown: '#6a8a40' }, fz_corn: { kind: 'tall', crown: '#c8a850' }, fz_tractor: { kind: 'rock' },
    fz_silo: { kind: 'house', rect: [0.6, 90], roof: '#8a6a4a' },
    fz_weeds: { kind: 'low', sway: 1 }, fz_pumpkin: { kind: 'low' }, fz_flowers: { kind: 'low', sway: 1 }, fz_hay: { kind: 'rock' },
    fz_fence: { kind: 'fence' }, fz_rock: { kind: 'rock' }, fz_bucket: { kind: 'low' }, fz_scarepost: { kind: 'post' },
    mh_belltree: { kind: 'tree', crown: '#a890d8', light: [0, -0.6, 160, '200,170,255'] }, mh_moonbush: { kind: 'bush', light: [0, -0.5, 110, '230,230,255'] },
    mh_arch: { kind: 'rock', light: [0, -0.7, 180, '210,190,255'] }, mh_stone: { kind: 'post' }, mh_lily: { kind: 'tall', light: [0, -0.8, 130, '240,240,255'], walkThrough: true },
    mh_tree: { kind: 'tree', crown: '#b8c8c8' },
    mh_grass: { kind: 'low', sway: 1 }, mh_flowers: { kind: 'low', sway: 1 }, mh_glowflowers: { kind: 'low', sway: 1, light: [0, -0.5, 70, '150,200,255'] },
    mh_clover: { kind: 'low' }, mh_bush: { kind: 'bush' }, mh_rock: { kind: 'rock' }, mh_mushrooms: { kind: 'low' }, mh_log: { kind: 'rock' },
    sh_alder: { kind: 'tree', crown: '#3f7a4a' }, sh_mill: { kind: 'house', rect: [0.7, 90], light: [0.1, -0.35, 220, WARM], roof: '#6a5a4a' },
    sh_pine: { kind: 'tree', crown: '#2f5a4a' }, sh_bridge: { kind: 'low' }, sh_boulder: { kind: 'rock' }, sh_totem: { kind: 'post', light: [0.2, -0.8, 150, WARM] },
    sh_fern: { kind: 'low', sway: 1 }, sh_reeds: { kind: 'low', sway: 1 }, sh_grass: { kind: 'low', sway: 1 }, sh_stones: { kind: 'low' },
    sh_moss: { kind: 'low' }, sh_flowers: { kind: 'low', sway: 1 }, sh_log: { kind: 'rock' }, sh_basket: { kind: 'low' },
    wf_falls: { kind: 'house', rect: [0.8, 110], light: [0, -0.4, 300, '150,230,220'], roof: '#6a8a8a' }, wf_tree: { kind: 'tree', crown: '#3a8a7a', light: [0, -0.6, 140, '120,230,210'] },
    wf_cave: { kind: 'house', rect: [0.76, 100], light: [0, -0.3, 200, '150,220,255'], roof: '#5a6a6a' }, wf_lantern: { kind: 'post', light: [0, -0.85, 200, '230,240,140'] },
    wf_rocks: { kind: 'rock' }, wf_bigfern: { kind: 'tall', crown: '#4a9a6a' },
    wf_grass: { kind: 'low', sway: 1 }, wf_lily: { kind: 'low', light: [0, -0.3, 60, '230,240,140'] }, wf_moss: { kind: 'low' },
    wf_shroom: { kind: 'low' }, wf_rock: { kind: 'rock' }, wf_reeds: { kind: 'low', sway: 1 },
    wf_crystal: { kind: 'rock', light: [0, -0.5, 100, '170,220,255'] }, wf_flowers: { kind: 'low', sway: 1 },
    og_tomb: { kind: 'house', rect: [0.76, 90], light: [0.3, -0.5, 170, '150,200,255'], roof: '#6a6a78' }, og_deadtree: { kind: 'tree', crown: '#3a3440' },
    og_statue: { kind: 'post', light: [0.2, -0.6, 120, '150,200,255'] }, og_gate: { kind: 'fence' }, og_stones: { kind: 'rock' }, og_yew: { kind: 'tree', crown: '#2a3a34' },
    og_grass: { kind: 'low', sway: 1 }, og_flowers: { kind: 'low' }, og_candles: { kind: 'low', light: [0, -0.5, 80, '255,200,130'] }, og_fence: { kind: 'fence' },
    og_stone: { kind: 'rock' }, og_skull: { kind: 'low' }, og_bush: { kind: 'bush' }, og_shovel: { kind: 'post' },
    im_giant: { kind: 'tree', crown: '#5a8ae0', light: [0, -0.8, 260, '120,190,255'] }, im_giant2: { kind: 'tree', crown: '#a070e0', light: [0, -0.8, 240, '200,150,255'] },
    im_house: { kind: 'house', rect: [0.6, 90], light: [0, -0.35, 220, WARM], roof: '#c05050' }, im_ring: { kind: 'low', light: [0, -0.2, 120, '140,220,255'] },
    im_cluster: { kind: 'tall', light: [0, -0.6, 170, '150,200,255'] }, im_stump: { kind: 'rock' },
    im_grass: { kind: 'low', sway: 1 }, im_small: { kind: 'low', light: [0, -0.4, 50, '150,200,255'] }, im_spores: { kind: 'low', light: [0, -0.5, 60, '190,230,255'] },
    im_fern: { kind: 'low', sway: 1 }, im_rock: { kind: 'rock' }, im_log: { kind: 'rock' }, im_puff: { kind: 'low' }, im_vine: { kind: 'low', sway: 1, light: [0, -0.6, 60, '170,255,200'] },
    fr_isle: { kind: 'rock', crown: '#8ab86a' }, fr_tree: { kind: 'tree', crown: '#7aa850' }, fr_hut: { kind: 'house', rect: [0.7, 80], light: [0.1, -0.35, 200, WARM], roof: '#c08a4a' },
    fr_bridge: { kind: 'post' }, fr_chime: { kind: 'post' }, fr_pine: { kind: 'tree', crown: '#3a6a5a' },
    fr_grass: { kind: 'low', sway: 1 }, fr_flowers: { kind: 'low', sway: 1 }, fr_rock: { kind: 'low' }, fr_kite: { kind: 'post' },
    fr_bush: { kind: 'bush' }, fr_boulder: { kind: 'rock' }, fr_feather: { kind: 'low' }, fr_clover: { kind: 'low' },
    rp_root: { kind: 'rock', crown: '#6a4a7a' }, rp_tree: { kind: 'tree', crown: '#5a3a6a', light: [0, -0.6, 150, '170,255,130'] },
    rp_cave: { kind: 'house', rect: [0.7, 100], light: [0, -0.3, 220, '170,255,130'], roof: '#4a3a4a' }, rp_pod: { kind: 'tall', light: [0, -0.7, 150, '170,255,130'] },
    rp_bloom: { kind: 'tall', light: [0, -0.6, 140, '255,150,220'], walkThrough: true }, rp_stump: { kind: 'rock', light: [0, -0.5, 80, '170,255,130'] },
    rp_grass: { kind: 'low', sway: 1 }, rp_bubbles: { kind: 'low', light: [0, -0.3, 70, '170,255,130'] }, rp_shroom: { kind: 'low' }, rp_reeds: { kind: 'low', sway: 1 },
    rp_rootlet: { kind: 'low' }, rp_rock: { kind: 'rock' }, rp_flower: { kind: 'low', light: [0, -0.4, 50, '255,150,220'] }, rp_bones: { kind: 'low' },
    cm_crystal: { kind: 'tall', light: [0, -0.5, 280, '255,170,80'], crown: '#e08a3a' }, cm_scaffold: { kind: 'house', rect: [0.7, 90], light: [0.2, -0.5, 200, WARM], roof: '#8a6a4a' },
    cm_pillar: { kind: 'tree', crown: '#5a4040', light: [0, -0.5, 120, '255,170,80'] }, cm_cart: { kind: 'rock', light: [0, -0.5, 100, '255,170,80'] },
    cm_drill: { kind: 'rock' }, cm_lamp: { kind: 'post', light: [0.2, -0.75, 200, WARM] },
    cm_rubble: { kind: 'low' }, cm_shards: { kind: 'low', light: [0, -0.4, 70, '255,170,80'] }, cm_barrel: { kind: 'rock' }, cm_pick: { kind: 'low' },
    cm_rock: { kind: 'rock' }, cm_rail: { kind: 'low' }, cm_sacks: { kind: 'rock' }, cm_shroom: { kind: 'low' },
    ch_arch: { kind: 'rock', crown: '#c0604a' }, ch_bones: { kind: 'rock' }, ch_mesa: { kind: 'tree', crown: '#b0503a' },
    ch_tent: { kind: 'house', rect: [0.76, 80], light: [0.3, -0.4, 180, WARM], roof: '#c08a50' }, ch_cactus: { kind: 'bush' }, ch_skull: { kind: 'rock' },
    ch_grass: { kind: 'low', sway: 1 }, ch_pebbles: { kind: 'low' }, ch_bush: { kind: 'bush' }, ch_rock: { kind: 'rock' },
    ch_cactus2: { kind: 'bush' }, ch_dune: { kind: 'low' }, ch_flower: { kind: 'low', sway: 1 }, ch_pot: { kind: 'low' },
    el_tree: { kind: 'tree', crown: '#3f7a3a' }, el_nest: { kind: 'rock' }, el_fern: { kind: 'tall', crown: '#5aa050' }, el_cycad: { kind: 'tall', crown: '#6a9a40' },
    el_rock: { kind: 'rock' }, el_egg: { kind: 'rock' },
    el_grass: { kind: 'low', sway: 1 }, el_fern2: { kind: 'low', sway: 1 }, el_flowers: { kind: 'low', sway: 1 }, el_horsetail: { kind: 'low', sway: 1 },
    el_rock2: { kind: 'rock' }, el_lily: { kind: 'low' }, el_shell: { kind: 'low' }, el_log: { kind: 'rock' },
    // the root caves (a dungeon theme)
    dr_root: { kind: 'tall' }, dr_pod: { kind: 'rock', light: [0, -0.5, 200, '170,255,130'] }, dr_bloom: { kind: 'rock', light: [0, -0.5, 200, '255,150,220'], walkThrough: true },
    dr_web: { kind: 'tall' }, dr_shroom: { kind: 'rock', light: [0, -0.6, 120, '170,255,130'] }, dr_rock: { kind: 'rock' },
    dr_puddle: { kind: 'low', light: [0, -0.1, 80, '170,255,130'] }, dr_entrance: { kind: 'low', light: [0.3, -0.6, 220, '170,255,130'] },
  });

  // ---------------- biomes ----------------
  // b(ground night, ground day, road night, road day, water night, water day, trees, border, grass, flowers, rocks, bushes, mini, more)
  const V = (a, d) => a.map((x) => Math.max(0, Math.min(255, x + d)));
  function b(gn, gd, rn, rd, wn, wd, trees, border, grass, flowers, rocks, bushes, mini, more) {
    return Object.assign({
      base: { n: gn, d: gd }, patch: { n: V(gn, 6), d: V(gd, 12) }, vary: 14, patchScale: 460,
      road: { n: rn, d: rd }, roadEdge: { n: V(rn, -10), d: V(rd, -24) }, roadMid: { n: V(rn, 8), d: V(rd, 18) },
      water: { n: wn, d: wd }, deep: { n: V(wn, -12), d: V(wd, -28) }, shore: { n: V(gn, 8), d: V(gd, 20) },
      specks: [{ n: ['rgba(255,255,255,0.25)', 'rgba(20,20,30,0.3)'], d: ['rgba(255,255,255,0.4)', 'rgba(40,40,40,0.25)'], count: 2000, size: [2, 5] },
        { n: ['rgba(20,40,30,0.35)'], d: ['rgba(60,100,60,0.35)'], count: 1600, size: [3, 7], blade: 1 }],
      trees, border, grove: 0.56, fill: 0.5, lone: 0.28,
      bushes, nBush: 70, grass, nGrass: 440, flowers, nPatch: 38, rocks, nRock: 50, mini,
    }, more || {});
  }
  Object.assign(NC.BIOMES, {
    farm2: b([54, 58, 46], [150, 150, 90], [70, 64, 60], [178, 150, 110], [36, 56, 84], [90, 150, 180],
      [['fz_oak', 1]], [['fz_oak', 1], ['fz_corn', 1.4], ['fz_sunflower', 0.8]], [['fz_weeds', 2]], [['fz_flowers', 1], ['fz_pumpkin', 0.4]],
      [['fz_rock', 1], ['fz_hay', 0.5], ['fz_bucket', 0.2]], [['fz_weeds', 1]], { ground: '#c8c088', road: '#a08868', water: '#7aa8c4', tree: 'rgba(100,120,60,0.55)' },
      { giants: [['fz_corn', 1.4], ['fz_sunflower', 1]], nGiant: 60 }),
    meadow2: b([40, 50, 64], [120, 150, 140], [60, 62, 78], [170, 160, 150], [34, 54, 92], [90, 140, 190],
      [['mh_tree', 1], ['mh_belltree', 0.8]], [['mh_tree', 1.2], ['mh_belltree', 1]], [['mh_grass', 2], ['mh_clover', 0.6]],
      [['mh_flowers', 1.4], ['mh_glowflowers', 1], ['mh_mushrooms', 0.4]], [['mh_rock', 1], ['mh_log', 0.5]], [['mh_bush', 1], ['mh_moonbush', 0.4]],
      { ground: '#a8b8c0', road: '#9a8a88', water: '#6a90c0', tree: 'rgba(120,110,160,0.55)' }, { giants: [['mh_lily', 1]], nGiant: 18 }),
    marsh2: b([36, 58, 50], [100, 150, 100], [58, 62, 66], [160, 146, 120], [34, 70, 100], [90, 170, 200],
      [['sh_alder', 1], ['sh_pine', 1]], [['sh_pine', 1.3], ['sh_alder', 1]], [['sh_grass', 2], ['sh_fern', 1]], [['sh_flowers', 1], ['sh_moss', 0.8]],
      [['sh_boulder', 0.4], ['sh_stones', 1], ['sh_log', 0.5]], [['sh_fern', 1]], { ground: '#a0c0a0', road: '#8a7a64', water: '#5aa8d0', tree: 'rgba(40,90,70,0.55)' },
      { shorePlants: [['sh_reeds', 1.4], ['sh_stones', 0.6]] }),
    marsh3: b([28, 52, 56], [80, 140, 130], [52, 60, 70], [150, 150, 140], [30, 70, 100], [80, 170, 200],
      [['wf_tree', 1]], [['wf_tree', 1.2], ['wf_rocks', 0.5]], [['wf_grass', 2], ['wf_moss', 1]], [['wf_flowers', 1], ['wf_shroom', 1]],
      [['wf_rock', 1], ['wf_crystal', 0.3]], [['wf_bigfern', 0.3]], { ground: '#90b8b0', road: '#7a7a74', water: '#4aa0c8', tree: 'rgba(40,110,100,0.55)' },
      { shorePlants: [['wf_reeds', 1.4], ['wf_lily', 1]], giants: [['wf_bigfern', 1]], nGiant: 8, nGrass: 300 }),
    graveyard2: b([40, 40, 50], [110, 110, 110], [58, 56, 66], [150, 140, 130], [30, 40, 60], [70, 90, 110],
      [['og_deadtree', 1], ['og_yew', 1]], [['og_yew', 1.2], ['og_deadtree', 1]], [['og_grass', 2]], [['og_flowers', 0.6], ['og_candles', 0.4], ['og_skull', 0.3]],
      [['og_stone', 1.4], ['og_stones', 0.6]], [['og_bush', 1]], { ground: '#9a9aa4', road: '#8a8278', water: '#5a6a80', tree: 'rgba(40,40,50,0.6)' },
      { fill: 0.28, grove: 0.66, lone: 0.2 }),
    woods2: b([30, 36, 58], [70, 90, 130], [46, 48, 70], [120, 110, 120], [30, 50, 90], [80, 110, 170],
      [['im_giant', 1], ['im_giant2', 1]], [['im_giant', 1.2], ['im_giant2', 1]], [['im_grass', 2], ['im_fern', 0.8]], [['im_small', 1], ['im_spores', 0.8], ['im_puff', 0.4]],
      [['im_rock', 1], ['im_log', 0.8], ['im_stump', 0.2]], [['im_vine', 0.6], ['im_fern', 1]], { ground: '#7a88b0', road: '#80788a', water: '#5a78b0', tree: 'rgba(80,90,180,0.55)' },
      { giants: [['im_cluster', 1]], nGiant: 24 }),
    wind2: b([50, 72, 70], [140, 184, 116], [72, 76, 86], [206, 190, 150], [40, 66, 106], [100, 180, 220],
      [['fr_tree', 1], ['fr_pine', 1]], [['fr_pine', 1.2], ['fr_tree', 1]], [['fr_grass', 2], ['fr_clover', 0.6]], [['fr_flowers', 1], ['fr_feather', 0.3]],
      [['fr_boulder', 1], ['fr_rock', 0.6]], [['fr_bush', 1]], { ground: '#cfe0b0', road: '#a08a64', water: '#7cb8e0', mesa: '#9aa08e', tree: 'rgba(70,110,80,0.55)' },
      { mesaTop: { n: [70, 84, 80], d: [150, 176, 120] }, mesaRim: { n: [82, 96, 88], d: [170, 196, 136] }, mesaFace: { n: [58, 60, 70], d: [140, 138, 132] },
        mesaFace2: { n: [46, 48, 60], d: [112, 110, 108] }, mesaDeco: [['fr_grass', 1.5], ['fr_flowers', 1], ['fr_rock', 0.6]] }),
    swamp2: b([36, 34, 48], [90, 80, 100], [56, 50, 62], [140, 118, 110], [70, 40, 90], [120, 80, 140],
      [['rp_tree', 1]], [['rp_tree', 1.2], ['rp_root', 0.6]], [['rp_grass', 2], ['rp_reeds', 0.4]], [['rp_shroom', 1], ['rp_flower', 0.8], ['rp_bubbles', 0.5]],
      [['rp_rock', 1], ['rp_rootlet', 1], ['rp_stump', 0.3]], [['rp_reeds', 0.6]], { ground: '#9a88a8', road: '#7a6468', water: '#8a60a8', tree: 'rgba(70,40,90,0.6)' },
      { giants: [['rp_pod', 1], ['rp_bloom', 0.8]], nGiant: 12, shorePlants: [['rp_reeds', 1.4], ['rp_bubbles', 0.6]] }),
    canyon2: b([44, 36, 36], [96, 80, 70], [66, 54, 50], [150, 120, 96], [255, 150, 60], [255, 150, 60],
      [['cm_pillar', 1]], [['cm_pillar', 1.3], ['cm_crystal', 0.5]], [['cm_rubble', 1]], [['cm_shards', 1], ['cm_shroom', 0.6], ['cm_rail', 0.3]],
      [['cm_rock', 1], ['cm_barrel', 0.3], ['cm_sacks', 0.3], ['cm_pick', 0.3]], [['cm_rubble', 1]], { ground: '#806a64', road: '#a08060', water: '#ff9a3a', tree: 'rgba(60,40,40,0.6)' },
      { giants: [['cm_crystal', 1]], nGiant: 10, cracks: 120, fill: 0.16, grove: 0.72, lone: 0.1 }),
    canyon3: b([70, 46, 40], [196, 120, 80], [84, 60, 50], [214, 170, 120], [40, 70, 100], [90, 160, 190],
      [['ch_mesa', 1]], [['ch_mesa', 1.2], ['ch_arch', 0.3]], [['ch_grass', 2], ['ch_dune', 0.6]], [['ch_flower', 0.6], ['ch_pebbles', 1]],
      [['ch_rock', 1], ['ch_skull', 0.2], ['ch_pot', 0.2]], [['ch_bush', 1], ['ch_cactus2', 1], ['ch_cactus', 0.3]],
      { ground: '#d09a70', road: '#e0b888', water: '#6aa0c0', tree: 'rgba(140,60,40,0.6)' },
      { fill: 0.18, grove: 0.72, lone: 0.12 }),
    prime2: b([30, 56, 50], [74, 138, 72], [52, 60, 62], [150, 120, 84], [26, 70, 90], [64, 170, 180],
      [['el_tree', 1]], [['el_tree', 1.2], ['el_fern', 1]], [['el_grass', 2], ['el_fern2', 1], ['el_horsetail', 0.8]], [['el_flowers', 1], ['el_shell', 0.3]],
      [['el_rock2', 1], ['el_log', 0.7], ['el_rock', 0.3]], [['el_fern2', 1]], { ground: '#9cc890', road: '#7a6448', water: '#5ac0c8', tree: 'rgba(30,80,40,0.6)' },
      { giants: [['el_fern', 1], ['el_cycad', 1]], nGiant: 30, shorePlants: [['el_horsetail', 1], ['el_lily', 1]] }),
  });

  // ---------------- the ways in: a warp at the far end of an old map's road ----------------
  const join = (id, warp, road) => {
    const M = NC.MAPS[id];
    if (!M || (M.warps || []).some((w) => w.id === warp.id)) return;
    (M.warps = M.warps || []).push(warp);
    if (road) (M.roads = M.roads || []).push(road);
  };
  join('farm', { id: 'north', x: 2400, y: 130, to: 'farm2', at: 'south' }, { w: 56, pts: [[2380, 860], [2400, 420], [2400, 40]] });
  join('meadow', { id: 'west', x: 130, y: 2150, to: 'meadow2', at: 'east' }, { w: 58, pts: [[2350, 1500], [1600, 1800], [900, 2150], [40, 2150]] });
  join('marsh', { id: 'north', x: 2350, y: 130, to: 'marsh2', at: 'south' }, { w: 56, pts: [[2500, 930], [2350, 500], [2350, 40]] });
  join('graveyard', { id: 'south', x: 2700, y: 3470, to: 'graveyard2', at: 'north' }, { w: 56, pts: [[2700, 3300], [2700, 3560]] });
  join('woods', { id: 'west', x: 130, y: 2400, to: 'woods2', at: 'east' }, { w: 56, pts: [[800, 2600], [400, 2420], [40, 2400]] });
  join('wind', { id: 'south', x: 3200, y: 3470, to: 'wind2', at: 'north' }, { w: 56, pts: [[3200, 3000], [3200, 3560]] });
  join('swamp', { id: 'east', x: 5070, y: 1900, to: 'swamp2', at: 'west' }, { w: 58, pts: [[5000, 1900], [5160, 1900]] });
  join('canyon', { id: 'west', x: 130, y: 2600, to: 'canyon2', at: 'east' }, { w: 58, pts: [[720, 2500], [320, 2600], [40, 2600]] });
  join('prime', { id: 'north', x: 2800, y: 130, to: 'prime2', at: 'south' }, { w: 60, pts: [[2800, 500], [2800, 40]] });

  // ---------------- the zone maps (each 4800 x 3400, the way in on one side, the next zone on the other) ----------------
  const zone = (o) => Object.assign({ W: 4800, H: 3400, spawns: [['slime', 14], ['hollow', 16]] }, o);
  const lv = (lo, hi) => ({ slime: [lo, Math.round(lo + (hi - lo) * 0.6)], hollow: [lo + 2, hi] });
  Object.assign(NC.MAPS, {
    farm2: zone({ name: 'ไร่ร้างหลังเขา', lvText: 'Lv 10–18', biome: 'farm2', seed: 701, lv: lv(10, 18),
      warps: [{ id: 'south', x: 2400, y: 3270, to: 'farm', at: 'north' }],
      roads: [{ w: 70, pts: [[2400, 3360], [2350, 2700], [2000, 2100], [2200, 1500], [2800, 1100], [3400, 900]] }, { w: 54, pts: [[2000, 2100], [1300, 1900], [800, 1400]] }],
      ponds: [{ x: 3700, y: 2500, rx: 320, ry: 160, reeds: 6 }],
      landmarks: [['fz_barn', 3000, 1000], ['fz_silo', 3450, 950], ['fz_tractor', 2700, 1250, { flip: true }], ['fz_scarepost', 1800, 2300], ['fz_hay', 3300, 1300], ['fz_fence', 2600, 1400]],
      safe: [[2150, 2900, 2700, 3300]], zones: [{ name: 'ทางลงไร่ฟักทอง', rect: [2100, 2850, 2750, 3350] }, { name: 'โรงนาพัง', rect: [2500, 600, 3900, 1500], lv: lv(15, 18) }] }),
    meadow2: zone({ name: 'เนินดอกไม้กลางคืน', lvText: 'Lv 14–22', biome: 'meadow2', seed: 709, lv: lv(14, 22),
      warps: [{ id: 'east', x: 4670, y: 1700, to: 'meadow', at: 'west' }],
      roads: [{ w: 66, pts: [[4760, 1700], [4000, 1750], [3200, 1600], [2400, 1700], [1600, 1500], [900, 1200]] }, { w: 52, pts: [[2400, 1700], [2300, 2400], [1800, 2900]] }],
      landmarks: [['mh_arch', 2400, 1500], ['mh_stone', 2150, 1650], ['mh_stone', 2650, 1650, { flip: true }], ['mh_lily', 1400, 2200], ['mh_moonbush', 3300, 2300]],
      safe: [[4200, 1450, 4700, 1950]], zones: [{ name: 'ทางกลับทุ่งหญ้า', rect: [4150, 1400, 4750, 2000] }, { name: 'ซุ้มดอกไม้กลางเนิน', rect: [1900, 1100, 2900, 2000], lv: lv(19, 22) }] }),
    marsh2: zone({ name: 'ต้นลำธาร', lvText: 'Lv 20–28', biome: 'marsh2', seed: 719, lv: lv(20, 28),
      warps: [{ id: 'south', x: 2400, y: 3270, to: 'marsh', at: 'north' }, { id: 'north', x: 2400, y: 130, to: 'marsh3', at: 'south' }],
      roads: [{ w: 64, pts: [[2400, 3360], [2300, 2700], [2600, 2100], [2300, 1500], [2500, 900], [2400, 40]] }],
      ponds: [{ x: 1300, y: 2300, rx: 700, ry: 160, reeds: 12, lilies: 4 }, { x: 3500, y: 1200, rx: 700, ry: 150, reeds: 12 }, { x: 1600, y: 700, rx: 400, ry: 150, reeds: 8 }],
      landmarks: [['sh_mill', 2950, 2400], ['sh_bridge', 2000, 2300], ['sh_totem', 3300, 2500], ['sh_boulder', 2700, 1250]],
      safe: [[2750, 2250, 3400, 2800]], zones: [{ name: 'โรงสีริมน้ำ', rect: [2700, 2200, 3450, 2850] }] }),
    marsh3: zone({ name: 'น้ำตกหิ่งห้อย', lvText: 'Lv 26–34 · บอส Lv 34', biome: 'marsh3', seed: 727, lv: Object.assign(lv(26, 34), { frog_queen: [34, 34] }),
      warps: [{ id: 'south', x: 2400, y: 3270, to: 'marsh2', at: 'north' }],
      roads: [{ w: 62, pts: [[2400, 3360], [2500, 2700], [2200, 2100], [2400, 1500], [2400, 1100]] }, { w: 50, pts: [[2200, 2100], [1300, 1900], [900, 1400]] }],
      ponds: [{ x: 2400, y: 700, rx: 700, ry: 300, lilies: 10, reeds: 16 }, { x: 3800, y: 2400, rx: 400, ry: 200, lilies: 6 }],
      landmarks: [['wf_falls', 2400, 420], ['wf_cave', 3300, 800], ['wf_lantern', 2000, 1200], ['wf_lantern', 2800, 1200, { flip: true }]],
      bosses: [['frog_queen', 2400, 1250]],
      safe: [[2150, 2900, 2650, 3300]], zones: [{ name: 'ปลายน้ำตก', rect: [2100, 2850, 2700, 3350] }, { name: 'แอ่งน้ำตก', rect: [1500, 300, 3300, 1500], lv: lv(31, 34) }] }),
    graveyard2: zone({ name: 'สุสานเก่าหลังเนิน', lvText: 'Lv 28–38', biome: 'graveyard2', seed: 733, lv: lv(28, 38),
      warps: [{ id: 'north', x: 2400, y: 130, to: 'graveyard', at: 'south' }],
      roads: [{ w: 62, pts: [[2400, 40], [2450, 700], [2200, 1400], [2500, 2100], [2300, 2800]] }, { w: 50, pts: [[2200, 1400], [1400, 1500], [800, 1800]] }, { w: 50, pts: [[2500, 2100], [3400, 2200], [4000, 2600]] }],
      ponds: [{ x: 3600, y: 900, rx: 300, ry: 150 }],
      landmarks: [['og_tomb', 2300, 2750], ['og_gate', 2450, 900], ['og_statue', 1400, 1400], ['og_statue', 3400, 2050, { flip: true }], ['og_stones', 1900, 2000]],
      safe: [[2150, 200, 2650, 600]], zones: [{ name: 'ประตูสุสานเก่า', rect: [2100, 150, 2700, 650] }, { name: 'สุสานหลวงเก่า', rect: [1600, 2300, 3200, 3300], lv: lv(34, 38) }] }),
    woods2: zone({ name: 'ป่าเห็ดชั้นใน', lvText: 'Lv 36–46', biome: 'woods2', seed: 739, lv: lv(36, 46),
      warps: [{ id: 'east', x: 4670, y: 1700, to: 'woods', at: 'west' }],
      roads: [{ w: 64, pts: [[4760, 1700], [4000, 1800], [3200, 1600], [2400, 1800], [1600, 1500], [900, 1700]] }, { w: 50, pts: [[2400, 1800], [2300, 2600]] }],
      landmarks: [['im_house', 2400, 1450], ['im_ring', 1700, 2400], ['im_ring', 3300, 900, { flip: true }], ['im_stump', 2800, 1900]],
      safe: [[4200, 1450, 4700, 1950]], zones: [{ name: 'ทางกลับป่าเห็ด', rect: [4150, 1400, 4750, 2000] }, { name: 'วงเห็ดลึก', rect: [600, 400, 2000, 1400], lv: lv(42, 46) }] }),
    wind2: zone({ name: 'เกาะหินลอยลม', lvText: 'Lv 44–54', biome: 'wind2', seed: 743, lv: lv(44, 54),
      warps: [{ id: 'north', x: 2400, y: 130, to: 'wind', at: 'south' }],
      roads: [{ w: 62, pts: [[2400, 40], [2400, 800], [2000, 1500], [2600, 2200], [3400, 2500]] }, { w: 50, pts: [[2000, 1500], [1100, 1700], [700, 2400]] }],
      mesas: [{ x: 1100, y: 800, rx: 420, ry: 220, deco: 6 }, { x: 3700, y: 1100, rx: 480, ry: 240, deco: 6 }, { x: 1400, y: 2700, rx: 420, ry: 210, deco: 5 }, { x: 3900, y: 2800, rx: 380, ry: 190, deco: 4 }],
      landmarks: [['fr_hut', 2600, 1050], ['fr_chime', 2850, 1100], ['fr_isle', 2000, 2400], ['fr_isle', 3100, 1700, { flip: true }], ['fr_bridge', 1500, 1600], ['fr_bridge', 3300, 2400, { flip: true }]],
      safe: [[2150, 200, 2650, 650]], zones: [{ name: 'ปากทางหน้าผา', rect: [2100, 150, 2700, 700] }, { name: 'เกาะลอยไกล', rect: [3000, 2000, 4700, 3300], lv: lv(50, 54) }] }),
    swamp2: zone({ name: 'รากต้นแม่พิษ', lvText: 'Lv 56–66', biome: 'swamp2', seed: 751, lv: lv(56, 66),
      warps: [{ id: 'west', x: 130, y: 1700, to: 'swamp', at: 'east' }, { id: 'roots', x: 3900, y: 1000, to: 'roots1', at: 'up', ax: 3900, ay: 1160 }],
      roads: [{ w: 62, pts: [[40, 1700], [800, 1650], [1600, 1900], [2400, 1700], [3200, 1300], [3900, 1080]] }, { w: 50, pts: [[1600, 1900], [1800, 2700], [2600, 3000]] }],
      ponds: [{ x: 1200, y: 800, rx: 500, ry: 230, reeds: 12 }, { x: 3000, y: 2500, rx: 600, ry: 260, reeds: 14 }, { x: 4200, y: 2600, rx: 380, ry: 180, reeds: 8 }],
      landmarks: [['rp_cave', 3900, 920], ['rp_root', 2400, 1400], ['rp_root', 3300, 1700, { flip: true }], ['rp_bloom', 1900, 1300]],
      safe: [[150, 1450, 700, 1950]], zones: [{ name: 'ขอบหนองพิษ', rect: [100, 1400, 750, 2000] }, { name: 'ใต้รากแม่พิษ', rect: [2600, 600, 4700, 1600], lv: lv(62, 66) }] }),
    canyon2: zone({ name: 'เหมืองลึกผลึกส้ม', lvText: 'Lv 62–72', biome: 'canyon2', seed: 757, lv: lv(62, 72),
      warps: [{ id: 'east', x: 4670, y: 1700, to: 'canyon', at: 'west' }, { id: 'west', x: 130, y: 1700, to: 'canyon3', at: 'east' }],
      roads: [{ w: 64, pts: [[4760, 1700], [3800, 1750], [3000, 1500], [2200, 1800], [1300, 1600], [40, 1700]] }, { w: 50, pts: [[3000, 1500], [2900, 800]] }],
      ponds: [{ x: 2200, y: 2700, rx: 420, ry: 200, glow: '255,150,60' }, { x: 3600, y: 800, rx: 300, ry: 150, glow: '255,150,60' }],
      landmarks: [['cm_scaffold', 2900, 700], ['cm_drill', 3300, 900], ['cm_lamp', 2600, 1400], ['cm_cart', 2000, 1650, { flip: true }], ['cm_lamp', 3900, 1550]],
      safe: [[4200, 1450, 4700, 1950]], zones: [{ name: 'ปากเหมืองลึก', rect: [4150, 1400, 4750, 2000] }, { name: 'ห้องผลึกใหญ่', rect: [500, 300, 2000, 1300], lv: lv(68, 72) }] }),
    canyon3: zone({ name: 'ใจกลางหุบผา', lvText: 'Lv 70–80 · บอส Lv 80', biome: 'canyon3', seed: 761, lv: Object.assign(lv(70, 80), { scorpion_king: [80, 80] }),
      warps: [{ id: 'east', x: 4670, y: 1700, to: 'canyon2', at: 'west' }],
      roads: [{ w: 64, pts: [[4760, 1700], [3900, 1600], [3000, 1900], [2200, 1700], [1400, 1900]] }, { w: 50, pts: [[3000, 1900], [3100, 2700]] }],
      landmarks: [['ch_arch', 2200, 1500], ['ch_bones', 1400, 2300], ['ch_tent', 3800, 1350], ['ch_skull', 2800, 2500], ['ch_cactus', 3300, 1000]],
      bosses: [['scorpion_king', 1300, 1700]],
      safe: [[3600, 1150, 4300, 1600]], zones: [{ name: 'เต็นท์คนเร่ร่อน', rect: [3550, 1100, 4350, 1650] }, { name: 'หลุมราชาแมงป่อง', rect: [500, 1000, 1900, 2600], lv: lv(76, 80) }] }),
    prime2: zone({ name: 'ทะเลสาบไข่มังกร', lvText: 'Lv 88–98 · บอส Lv 98', biome: 'prime2', seed: 769, lv: Object.assign(lv(88, 98), { dragon_mother: [98, 98] }), W: 5200, H: 3800,
      warps: [{ id: 'south', x: 2600, y: 3670, to: 'prime', at: 'north' }],
      roads: [{ w: 66, pts: [[2600, 3760], [2500, 3000], [2900, 2400], [2500, 1800], [1800, 1500]] }, { w: 52, pts: [[2900, 2400], [3800, 2200], [4400, 1600]] }],
      ponds: [{ x: 2600, y: 900, rx: 900, ry: 380, lilies: 14, reeds: 20 }, { x: 900, y: 2700, rx: 400, ry: 200, lilies: 6 }],
      landmarks: [['el_nest', 3700, 1500], ['el_egg', 3950, 1650], ['el_nest', 1300, 1400, { flip: true }], ['el_rock', 2100, 2300]],
      bosses: [['dragon_mother', 3500, 1300]],
      safe: [[2300, 3300, 2900, 3700]], zones: [{ name: 'ทางกลับป่าโบราณ', rect: [2250, 3250, 2950, 3750] }, { name: 'ฝั่งรังมังกร', rect: [3000, 900, 4800, 2000], lv: lv(94, 98) }] }),
  });

  // ---------------- each zone's air ----------------
  const tint = (k) => (minutes, n) => {
    const s = NC.skyAmbient ? NC.skyAmbient(minutes, n) : [255 - 83 * n, 255 - 69 * n, 255 - 23 * n];
    return [Math.round(s[0] * (1 - k[0] * n)), Math.round(s[1] * (1 - k[1] * n)), Math.round(s[2] * (1 - k[2] * n))];
  };
  const AIR = {
    meadow2: { dusk: 0.3, ambient: tint([0.06, 0.08, 0]) }, marsh3: { dusk: 0.25 }, graveyard2: { dusk: 0.3, mist: true },
    woods2: { dusk: 0.35, ambient: tint([0.12, 0.06, 0]) }, wind2: { gusts: true }, swamp2: { dusk: 0.3, ambient: tint([0.1, 0.02, 0.12]) },
    canyon2: { dusk: 0.75, ambient: tint([0.1, 0.22, 0.34]) }, canyon3: { ambient: tint([0, 0.08, 0.2]) },
  };
  const baseField = NC.buildField;
  NC.buildField = function (def) {
    const w = baseField.apply(this, arguments);
    if (def && AIR[def.id]) Object.assign(w, AIR[def.id]);
    return w;
  };

  // ---------------- the root caves under the poison swamp ----------------
  if (NC.DUNGEON_THEMES) NC.DUNGEON_THEMES.roots = {
    floor: [70, 56, 76], floor2: [84, 66, 90], rock: [24, 16, 30], rock2: [40, 28, 48],
    face: [[96, 76, 104], [56, 42, 64]], ambient: [96, 80, 120], light: [360, '220,255,200'],
    specks: ['rgba(40,30,50,0.55)', 'rgba(170,255,130,0.35)', 'rgba(255,150,220,0.3)'], cracks: 60,
    pool: { c1: [170, 255, 130], c2: [90, 190, 80], edge: [50, 40, 60], glow: '170,255,130' },
    wall: [['dr_root', 1.4], ['dr_web', 1], ['dr_rock', 0.8]],
    glow: [['dr_pod', 1], ['dr_bloom', 1], ['dr_shroom', 0.8]], glowEvery: 480,
    big: [['dr_rock', 1], ['dr_root', 0.5]], low: [['dr_puddle', 1.2]],
    entrance: 'dr_entrance', mini: '#6a5476',
  };
  const chests = Object.keys(NC.DUNGEON_CHESTS || {});
  const FLOORS = {
    roots1: { name: 'ถ้ำรากแม่พิษ B1', lvText: 'Lv 62–68', parent: 'swamp2', W: 3800, H: 3000, seed: 781,
      dungeon: { theme: 'roots', rooms: 11, room: [230, 410], tunnel: 200, loops: 0.3, chests: 2, traps: 4, chest: 'chest_iron', pools: 0.5 },
      lv: { slime: [62, 65], hollow: [64, 68] }, spawns: [['slime', 10], ['hollow', 11]],
      warps: [{ id: 'up', to: 'swamp2', at: 'roots', place: 'entrance' }, { id: 'down', to: 'roots2', at: 'up', place: 'deep' }] },
    roots2: { name: 'ถ้ำรากแม่พิษ B2 · หัวใจ', lvText: 'Lv 68–74 · บอส Lv 75', parent: 'roots1', W: 4000, H: 3200, seed: 787,
      dungeon: { theme: 'roots', rooms: 10, room: [240, 420], tunnel: 210, loops: 0.25, chests: 2, traps: 5, chest: 'chest_iron', pools: 0.5, boss: true, bossChest: true },
      lv: { slime: [68, 71], hollow: [70, 74], poison_heart: [75, 75] }, spawns: [['slime', 10], ['hollow', 11]], bosses: [['poison_heart']],
      warps: [{ id: 'up', to: 'roots1', at: 'down', place: 'entrance' }] },
  };
  for (const [id, F] of Object.entries(FLOORS)) {
    const top = Math.max(...Object.values(F.lv).map((r) => r[1]));
    for (const c of chests) F.lv[c] = [top, top];
    F.dungeonFloor = true;
    NC.MAPS[id] = F;
  }
  Object.assign(NC.DUNGEON_FLOORS || (NC.DUNGEON_FLOORS = {}), FLOORS);
})();
