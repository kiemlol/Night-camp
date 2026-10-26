/* dungeons.js — the dungeons under the fields (classic MMO style: go down floor by floor, harder the deeper you go, a
   boss at the bottom). The floors are built by dungeongen.js from the numbers here.
     ถ้ำค้างคาวริมทุ่ง (batcave)    Lv 8–16    the first dungeon, from the meadow (the road north of the windmill village):
                                        one floor, bats, stone slimes, cave spiders. Kill 100 bats in one visit and a
                                        hidden way opens for 3 minutes: รังราชาค้างคาว (batnest), the Bat King (Lv 22)
     เหมืองมด B1–B3 (antmine1-3)    Lv 15–50   from the pumpkin farm (the anthill by the south lane): worker ants,
                                        soldier ants (they call their friends when one is hit), flying ants; the Ant
                                        Queen (Lv 50) on B3
     สุสานใต้ดิน 1–2 (crypt1-2)      Lv 34–52   through the ruined chapel's door on the graveyard hill: very dark (fire and
                                        holy light help), bone knights, candle wisps, ghosts; the Crypt Lord (Lv 55)
     ปล่องภูเขาไฟ 1–2 (lavavent1-2)  Lv 74–90   from the sleeping volcano (the glowing cave at the end of the south road):
                                        lava pools, lava worms, fire imps; the Lava Dragon (Lv 92)
   Every dungeon: chests to break open in the dead ends (coins, materials, potions, maybe gear; they come back after a
   while), spike traps in the tunnels, the hero carries a lantern in the dark; dying brings you back to the entrance.
   Monsters here: data on monsters.js's four ways of fighting; the bosses: js/dunbosses.js. Art: assets/maps/ (d_*,
   dc_*, dm_*, dy_*, dl_*, de_*) and assets/monsters/ (assets/gen/make_dungeon_prompts.py, make_monster4_prompts.py).
   Load after monsters3.js (and materials.js), before dunbosses.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, TAU = Math.PI * 2;
  const SECRET_KEY = 'nightcamp.secrets.v1';

  // ---------------- props: how each stands (fieldgen.js PROPS) ----------------
  Object.assign(NC.FIELD_PROPS, {
    // shared
    d_torch: { kind: 'post', light: [0, -0.88, 280, '255,190,110'] }, d_stairs_down: { kind: 'low' },
    d_stairs_up: { kind: 'low', light: [0, -0.62, 260, '255,236,190'] },
    // the bat cave
    dc_stalagmite: { kind: 'tall' }, dc_stalagmites: { kind: 'rock' }, dc_boulder: { kind: 'rock' },
    dc_crystals: { kind: 'rock', light: [0, -0.5, 240, '140,200,255'] }, dc_shrooms: { kind: 'tall', light: [0, -0.7, 220, '120,230,220'] },
    dc_camp: { kind: 'low', light: [0.2, -0.4, 200, '255,200,120'] }, dc_bones: { kind: 'low' }, dc_puddle: { kind: 'low' },
    // the ant mine
    dm_support: { kind: 'low', light: [0, -0.62, 230, '255,200,120'] }, dm_eggs: { kind: 'rock', light: [0, -0.4, 160, '255,240,200'] },
    dm_amber: { kind: 'rock', light: [0, -0.45, 190, '255,170,60'] }, dm_fungus: { kind: 'low', light: [0, -0.4, 90, '220,255,220'] },
    dm_cart: { kind: 'rock' }, dm_mound: { kind: 'rock' }, dm_barrel: { kind: 'rock' }, dm_roots: { kind: 'low' },
    // the crypt
    dy_coffin: { kind: 'rock' }, dy_candelabra: { kind: 'post', light: [0, -0.85, 250, '255,200,130'] }, dy_pillar: { kind: 'tall' },
    dy_urns: { kind: 'rock' }, dy_brazier: { kind: 'post', light: [0, -0.7, 280, '150,210,255'] }, dy_boneheap: { kind: 'low' },
    dy_niche: { kind: 'fence', light: [0, -0.55, 180, '255,200,130'] }, dy_slabs: { kind: 'low' },
    // the lava vent
    dl_obsidian: { kind: 'rock' }, dl_geyser: { kind: 'rock', light: [0, -0.8, 260, '255,140,50'] }, dl_ribs: { kind: 'rock' },
    dl_magma: { kind: 'rock', light: [0, -0.4, 160, '255,120,40'] }, dl_suncrystal: { kind: 'rock', light: [0, -0.5, 220, '255,220,120'] },
    dl_cage: { kind: 'post' }, dl_pillar: { kind: 'tall', light: [0, -0.4, 120, '255,130,50'] }, dl_ash: { kind: 'low', light: [0, -0.3, 70, '255,120,50'] },
    // the doors in the fields
    de_cave: { kind: 'house', rect: [0.72, 110], roof: '#8a8078' },
    de_mine: { kind: 'house', rect: [0.78, 110], light: [0, -0.35, 240, '255,200,120'], roof: '#9a7456' },
    de_lava: { kind: 'house', rect: [0.72, 110], light: [0, -0.3, 320, '255,140,60'], roof: '#3a2e2e' },
  });

  // ---------------- the monsters of the dungeons (monsters.js SPECIES: the same bases) ----------------
  const MON = { r: 24, hpK: 1, atkK: 1, defK: 1, mdefK: 0.5, agiK: 0.6, dexK: 0.7, expK: 1.2, spd: 150, aggro: 560 };
  const sp = (o) => Object.assign({}, MON, o);
  const SPECIES = {
    cave_spider: sp({ name: 'แมงมุมถ้ำ', kind: 'charge', element: 'poison', atkElement: 'poison', r: 24, hpK: 0.85, atkK: 0.95, defK: 0.7,
      agiK: 1, dexK: 0.9, expK: 1.15, spd: 150, aggro: 520, color: '130,100,120', dash: [260, 640, 0.36], leap: 26, dust: '120,100,100',
      shadow: [44, 12] }),
    worker_ant: sp({ name: 'มดงาน', kind: 'charge', element: 'earth', atkElement: 'earth', r: 24, hpK: 0.95, atkK: 0.95, defK: 1.1,
      agiK: 0.8, expK: 1.15, spd: 140, aggro: 520, color: '170,90,60', dash: [280, 600, 0.4], dust: '140,110,80', shadow: [44, 12], link: 'ant' }),
    soldier_ant: sp({ name: 'มดทหาร', kind: 'melee', element: 'earth', atkElement: 'earth', r: 30, hpK: 1.35, atkK: 1.2, defK: 1.7,
      mdefK: 0.4, agiK: 0.5, expK: 1.4, spd: 110, aggro: 540, color: '150,60,50', reach: 110, windup: 0.5, lunge: 260, recover: 0.7,
      slash: '255,200,160', shadow: [56, 15], link: 'ant' }),
    flying_ant: sp({ name: 'มดบิน', kind: 'fly', element: 'wind', atkElement: 'wind', r: 22, hpK: 0.8, atkK: 1, defK: 0.8,
      agiK: 1.3, dexK: 1, expK: 1.2, spd: 185, aggro: 580, color: '200,150,80', hover: 56, swoop: 640, flap: 26, link: 'ant' }),
    bone_knight: sp({ name: 'อัศวินกระดูก', kind: 'melee', element: 'undead', atkElement: 'neutral', r: 28, hpK: 1.6, atkK: 1.3, defK: 1.6,
      mdefK: 0.6, agiK: 0.5, dexK: 0.9, expK: 1.55, spd: 100, aggro: 560, color: '215,210,190', reach: 118, windup: 0.6, lunge: 300,
      recover: 0.75, slash: '190,220,255', shadow: [54, 15] }),
    candle_wisp: sp({ name: 'วิญญาณเทียน', kind: 'fly', element: 'ghost', atkElement: 'fire', r: 22, hpK: 0.8, atkK: 1.05, defK: 0.4,
      mdefK: 1.1, agiK: 1.1, dexK: 0.9, expK: 1.35, spd: 150, aggro: 600, color: '255,220,160', hover: 58, swoop: 520, flap: 6,
      light: [210, '255,200,120'], seeThrough: 0.9 }),
    lava_worm: sp({ name: 'หนอนลาวา', kind: 'charge', element: 'fire', atkElement: 'fire', r: 30, hpK: 1.45, atkK: 1.25, defK: 1.5,
      mdefK: 0.5, agiK: 0.5, expK: 1.55, spd: 110, aggro: 540, color: '255,120,50', dash: [320, 700, 0.46], dust: '120,80,70',
      shadow: [58, 15], light: [150, '255,130,50'] }),
    fire_imp: sp({ name: 'อิมป์เปลวไฟ', kind: 'melee', element: 'fire', atkElement: 'fire', r: 24, hpK: 1.1, atkK: 1.3, defK: 1,
      mdefK: 0.8, agiK: 1.3, dexK: 1.1, expK: 1.5, spd: 170, aggro: 600, color: '255,110,60', reach: 104, windup: 0.4, lunge: 420,
      recover: 0.55, slash: '255,180,110', light: [110, '255,140,60'] }),
  };
  Object.assign(NC.SPECIES, SPECIES);
  Object.assign(NC.MONSTERS, SPECIES);

  // chests: "monsters" that don't move or fight back: break one open (NC.MONSTERS only: their level is the floor's)
  const CHESTS = {
    chest_wood: { name: 'หีบไม้', sprite: 'd_chest_wood', coins: 1, mats: [2, 3], pots: 1, gear: 1, back: 480 },
    chest_iron: { name: 'หีบเหล็ก', sprite: 'd_chest_iron', coins: 2.2, mats: [3, 5], pots: 2, gear: 2, back: 600 },
    chest_gold: { name: 'หีบทองของบอส', sprite: 'd_chest_gold', coins: 6, mats: [5, 8], pots: 3, gear: 4, back: 0 },
  };
  for (const [id, C] of Object.entries(CHESTS))
    NC.MONSTERS[id] = { name: C.name, element: 'neutral', atkElement: 'neutral', r: 30, hpCurve: 'chest', hpK: id === 'chest_gold' ? 5 : 2.6, atkK: 0.1,
      defK: 2.2, mdefK: 2.2, agiK: 0, dexK: 0, expK: 0.3, spd: 0, aggro: 0 };
  NC.DUNGEON_CHESTS = CHESTS;

  // ---------------- the floors (dungeongen.js reads `dungeon`; place: where a warp stands) ----------------
  const FLOORS = {
    batcave: { name: 'ถ้ำค้างคาวริมทุ่ง', lvText: 'Lv 8–16', parent: 'meadow', W: 3400, H: 2600, seed: 301,
      dungeon: { theme: 'cave', rooms: 9, room: [230, 400], tunnel: 200, loops: 0.25, chests: 2, traps: 2 },
      lv: { slime: [8, 12], hollow: [11, 16] }, spawns: [['slime', 9], ['hollow', 8]],
      warps: [{ id: 'out', to: 'meadow', at: 'batcave', place: 'entrance' }] },
    batnest: { name: 'รังราชาค้างคาว', lvText: 'Lv 16–22 · ดันลับ', parent: 'batcave', secret: true, W: 2600, H: 2300, seed: 303,
      dungeon: { theme: 'cave', rooms: 4, room: [220, 330], tunnel: 220, boss: true, bossChest: true },
      lv: { slime: [16, 18], hollow: [18, 22], bat_king: [22, 22] }, spawns: [['slime', 3], ['hollow', 4]], bosses: [['bat_king']],
      warps: [{ id: 'out', to: 'batcave', at: 'nest', place: 'entrance' }] },
    antmine1: { name: 'เหมืองมด ชั้น B1', lvText: 'Lv 15–25', parent: 'farm', W: 3800, H: 3000, seed: 311,
      dungeon: { theme: 'mine', rooms: 11, room: [230, 420], tunnel: 200, loops: 0.3, chests: 2, traps: 3 },
      lv: { slime: [15, 20], hollow: [19, 25] }, spawns: [['slime', 11], ['hollow', 9]],
      warps: [{ id: 'up', to: 'farm', at: 'antmine', place: 'entrance' }, { id: 'down', to: 'antmine2', at: 'up', place: 'deep' }] },
    antmine2: { name: 'เหมืองมด ชั้น B2', lvText: 'Lv 25–38', parent: 'antmine1', W: 4000, H: 3100, seed: 313,
      dungeon: { theme: 'mine', rooms: 12, room: [230, 430], tunnel: 200, loops: 0.3, chests: 2, traps: 4, chest: 'chest_iron' },
      lv: { slime: [25, 31], hollow: [30, 38] }, spawns: [['slime', 11], ['hollow', 10]],
      warps: [{ id: 'up', to: 'antmine1', at: 'down', place: 'entrance' }, { id: 'down', to: 'antmine3', at: 'up', place: 'deep' }] },
    antmine3: { name: 'เหมืองมด ชั้น B3 · รังนางพญา', lvText: 'Lv 38–50 · บอส Lv 50', parent: 'antmine2', W: 4000, H: 3300, seed: 317,
      dungeon: { theme: 'mine', rooms: 10, room: [240, 420], tunnel: 210, loops: 0.25, chests: 2, traps: 4, chest: 'chest_iron', boss: true, bossChest: true },
      lv: { slime: [38, 44], hollow: [42, 50], ant_queen: [50, 50] }, spawns: [['slime', 10], ['hollow', 10]], bosses: [['ant_queen']],
      warps: [{ id: 'up', to: 'antmine2', at: 'down', place: 'entrance' }] },
    crypt1: { name: 'สุสานใต้ดิน ชั้น 1', lvText: 'Lv 34–44', parent: 'graveyard', W: 3800, H: 3000, seed: 331,
      dungeon: { theme: 'crypt', rooms: 11, room: [230, 400], tunnel: 190, loops: 0.3, chests: 2, traps: 4, chest: 'chest_iron' },
      lv: { slime: [34, 39], hollow: [38, 44] }, spawns: [['slime', 10], ['hollow', 10]],
      warps: [{ id: 'up', to: 'graveyard', at: 'crypt', place: 'entrance' }, { id: 'down', to: 'crypt2', at: 'up', place: 'deep' }] },
    crypt2: { name: 'สุสานใต้ดิน ชั้น 2 · ห้องราชา', lvText: 'Lv 44–52 · บอส Lv 55', parent: 'crypt1', W: 4000, H: 3300, seed: 337,
      dungeon: { theme: 'crypt', rooms: 10, room: [240, 420], tunnel: 200, loops: 0.25, chests: 2, traps: 5, chest: 'chest_iron', boss: true, bossChest: true },
      lv: { slime: [44, 48], hollow: [46, 52], crypt_lord: [55, 55] }, spawns: [['slime', 10], ['hollow', 11]], bosses: [['crypt_lord']],
      warps: [{ id: 'up', to: 'crypt1', at: 'down', place: 'entrance' }] },
    lavavent1: { name: 'ปล่องภูเขาไฟ ชั้น 1', lvText: 'Lv 80–90', parent: 'volcano', W: 4000, H: 3100, seed: 351,
      dungeon: { theme: 'lava', rooms: 11, room: [240, 430], tunnel: 210, loops: 0.3, chests: 2, traps: 4, chest: 'chest_iron', pools: 0.6 },
      lv: { slime: [80, 85], hollow: [84, 90] }, spawns: [['slime', 10], ['hollow', 10]],
      warps: [{ id: 'up', to: 'volcano', at: 'vent', place: 'entrance' }, { id: 'down', to: 'lavavent2', at: 'up', place: 'deep' }] },
    lavavent2: { name: 'ปล่องภูเขาไฟ ชั้น 2 · ถ้ำมังกร', lvText: 'Lv 90–99 · บอส Lv 99', parent: 'lavavent1', W: 4200, H: 3400, seed: 357,
      dungeon: { theme: 'lava', rooms: 10, room: [240, 430], tunnel: 220, loops: 0.25, chests: 2, traps: 5, chest: 'chest_iron', pools: 0.5, boss: true, bossChest: true },
      lv: { slime: [90, 95], hollow: [94, 99], lava_dragon: [99, 99] }, spawns: [['slime', 10], ['hollow', 11]], bosses: [['lava_dragon']],
      warps: [{ id: 'up', to: 'lavavent1', at: 'down', place: 'entrance' }] },
  };
  for (const [id, F] of Object.entries(FLOORS)) {
    // a chest's level: the floor's highest
    const top = Math.max(...Object.values(F.lv).map((r) => r[1]));
    for (const c of Object.keys(CHESTS)) F.lv[c] = [top, top];
    F.dungeonFloor = true;
    NC.MAPS[id] = F;
  }
  NC.DUNGEON_FLOORS = FLOORS;

  // who lives where (monsters.js ROSTER; a dungeon floor's zones: 'ทางเข้า', 'ห้องบอส', the floor: all '*')
  Object.assign(NC.ROSTER, {
    batcave: { '*': { slime: [['slime_stone', 1], ['bat', 1]], hollow: [['bat', 1], ['cave_spider', 2]] } },
    batnest: { '*': { slime: [['bat', 1]], hollow: [['bat', 2], ['cave_spider', 1]] } },
    antmine1: { '*': { slime: [['worker_ant', 3], ['slime_stone', 1]], hollow: [['soldier_ant', 1], ['worker_ant', 1]] } },
    antmine2: { '*': { slime: [['worker_ant', 2], ['flying_ant', 1]], hollow: [['soldier_ant', 2], ['flying_ant', 1]] } },
    antmine3: { '*': { slime: [['worker_ant', 1], ['flying_ant', 1]], hollow: [['soldier_ant', 2], ['flying_ant', 1]] } },
    crypt1: { '*': { slime: [['zombie', 1], ['skeleton', 1], ['candle_wisp', 1]], hollow: [['bone_knight', 1], ['ghost', 1]] } },
    crypt2: { '*': { slime: [['skeleton', 1], ['candle_wisp', 1]], hollow: [['bone_knight', 2], ['ghost', 1]] } },
    lavavent1: { '*': { slime: [['fire_bat', 1], ['slime_lava', 1]], hollow: [['lava_worm', 2], ['fire_imp', 1], ['salamander', 1]] } },
    lavavent2: { '*': { slime: [['fire_bat', 1], ['fire_imp', 1]], hollow: [['lava_worm', 1], ['magma_golem', 1], ['fire_imp', 1]] } },
  });

  // ---------------- the doors in the fields (their warps set their own arrival: fieldgen.js keeps it) ----------------
  const door = (field, warp, landmark, road) => {
    const M = NC.MAPS[field];
    if (!M || (M.warps || []).some((w) => w.id === warp.id)) return;
    (M.warps = M.warps || []).push(warp);
    if (landmark) (M.landmarks = M.landmarks || []).push(landmark);
    if (road) (M.roads = M.roads || []).push(road);
  };
  // the meadow: the road north out of the windmill village ends at a cave in the hillside
  door('meadow', { id: 'batcave', x: 3922, y: 1012, to: 'batcave', at: 'out', ax: 3918, ay: 1160 }, ['de_cave', 3930, 930]);
  // the farm: an anthill by the south lane (a short track to it)
  door('farm', { id: 'antmine', x: 1885, y: 2912, to: 'antmine1', at: 'up', ax: 2030, ay: 2960 }, ['de_mine', 1860, 2830],
    { w: 58, pts: [[2292, 2880], [2110, 2935], [1930, 2930]] });
  // the graveyard: the ruined chapel's door
  door('graveyard', { id: 'crypt', x: 2640, y: 1196, to: 'crypt1', at: 'up', ax: 2640, ay: 1330 });
  // the volcano: the glowing cave beside the end of the south road (a track round to its mouth)
  door('volcano', { id: 'vent', x: 1070, y: 3518, to: 'lavavent1', at: 'up', ax: 1240, ay: 3572 }, ['de_lava', 1060, 3440],
    { w: 60, pts: [[1400, 3400], [1330, 3540], [1200, 3572], [1090, 3560]] });

  // ---------------- the materials they drop (materials.js) ----------------
  if (NC.MATERIALS && NC.MAT_DROPS) {
    Object.assign(NC.MATERIALS, {
      mat_spider_silk: { name: 'ใยแมงมุมถ้ำ', price: 22, desc: 'ม้วนใยแมงมุมเหนียวหนึบ เป็นประกายสีม่วงอ่อน' },
      mat_ant_jaw: { name: 'เขี้ยวมดงาน', price: 30, desc: 'เขี้ยวคู่โค้งสีน้ำตาลแดง ของมดงานในเหมือง' },
      mat_ant_wing: { name: 'ปีกมดบิน', price: 44, desc: 'ปีกใสบางเป็นประกายสีอำพัน' },
      mat_ant_shell: { name: 'เปลือกมดทหาร', price: 48, desc: 'แผ่นเปลือกแข็งสีแดงเข้มเงาวับ ทนมาก' },
      mat_spirit_wax: { name: 'ขี้ผึ้งวิญญาณ', price: 64, desc: 'ขี้ผึ้งเทียนที่ยังอุ่นอยู่ มีประกายไฟเล็ก ๆ ข้างใน' },
      mat_rusty_crest: { name: 'ตราอัศวินขึ้นสนิม', price: 70, desc: 'ตราโลหะจากชุดเกราะอัศวินกระดูก สนิมเขรอะ' },
      mat_imp_fork: { name: 'ส้อมจิ๋วของอิมป์', price: 220, desc: 'ส้อมสามง่ามอันจิ๋ว ปลายยังร้อนแดง' },
      mat_worm_plate: { name: 'เกล็ดหินหนอนลาวา', price: 230, desc: 'แผ่นหินสีดำจากตัวหนอนลาวา ขอบยังเรืองส้ม' },
      mat_bat_fang: { name: 'เขี้ยวราชาค้างคาว', price: 260, desc: 'เขี้ยวแหลมยาวของราชาค้างคาว' },
      mat_bat_crown: { name: 'มงกุฎราชาค้างคาว', price: 1200, rare: true, desc: 'มงกุฎทองเล็ก ๆ ของราชาค้างคาว หายาก!' },
      mat_royal_jelly: { name: 'รอยัลเยลลี่นางพญา', price: 600, desc: 'เยลลี่สีทองในขวดโหล ของนางพญามด' },
      mat_queen_tiara: { name: 'มงกุฎนางพญามด', price: 3000, rare: true, desc: 'มงกุฎทองของนางพญามด หายากมาก!' },
      mat_lord_flame: { name: 'เปลวไฟราชาสุสาน', price: 700, desc: 'เปลวไฟสีฟ้าในโคมเหล็ก ไม่เคยดับ' },
      mat_lord_crown: { name: 'มงกุฎเหล็กราชาสุสาน', price: 3500, rare: true, desc: 'มงกุฎเหล็กบิดเบี้ยวของราชาสุสาน หายากมาก!' },
      mat_dragon_scale: { name: 'เกล็ดมังกรลาวา', price: 900, desc: 'เกล็ดหินดำร้อนระอุ มีลาวาไหลอยู่ในรอยแตก' },
      mat_dragon_heart: { name: 'หัวใจมังกรลาวา', price: 6000, rare: true, desc: 'หัวใจมังกรที่ยังเต้นเป็นแสงลาวา หายากที่สุด!' },
    });
    Object.assign(NC.MAT_DROPS, {
      cave_spider: [['mat_spider_silk', 0.6]], worker_ant: [['mat_ant_jaw', 0.6]], flying_ant: [['mat_ant_wing', 0.55]],
      soldier_ant: [['mat_ant_shell', 0.55]], candle_wisp: [['mat_spirit_wax', 0.55]], bone_knight: [['mat_rusty_crest', 0.55]],
      fire_imp: [['mat_imp_fork', 0.5]], lava_worm: [['mat_worm_plate', 0.5]],
      bat_king: [['mat_bat_fang', 1, 2, 4], ['mat_bat_crown', 0.25]], ant_queen: [['mat_royal_jelly', 1, 2, 4], ['mat_queen_tiara', 0.2]],
      crypt_lord: [['mat_lord_flame', 1, 2, 4], ['mat_lord_crown', 0.2]], lava_dragon: [['mat_dragon_scale', 1, 3, 5], ['mat_dragon_heart', 0.15]],
    });
  }

  // ---------------- chests: stand still, break open, come back later ----------------
  const now = () => performance.now() / 1000;
  const chestCd = {}; // 'map:x,y' -> the time it may come back
  const CHEST_OWNER = { chest: true }; // (an owner: the bots leave chests alone, entities.js's respawn is dropped)
  const isChest = (e) => !!CHESTS[e.type];
  function lootChest(game, e) {
    const C = CHESTS[e.type], p = game.player;
    const coins = Math.round((20 + e.lv * 9) * C.coins * NC.rand(0.8, 1.25));
    if (p.coins !== undefined) { p.coins += coins; FX.num(e.x, e.y - 150, `+${coins.toLocaleString()} เหรียญ`, { fill: '#ffd873', size: 34 }); }
    // materials of the floor's own monsters
    const R = NC.ROSTER[game.mapId] || {}, kinds = new Set();
    for (const z of Object.values(R)) for (const slot of ['slime', 'hollow']) for (const [s] of z[slot] || []) kinds.add(s);
    const mats = [...kinds].map((s) => (NC.MAT_DROPS[s] || [])[0]).filter((d) => d && NC.MATERIALS[d[0]]).map((d) => d[0]);
    const n = Math.round(NC.rand(C.mats[0], C.mats[1]));
    for (let i = 0; i < n && mats.length; i++)
      game.loot.push({ kind: 'loot', mat: NC.pick(mats), x: e.x + NC.rand(-80, 80), y: e.y + NC.rand(-30, 30), sort: e.y, t: 0, z: 20, vz: NC.rand(420, 560), spin: NC.rand(0, 6) });
    const potSize = NC.POT ? NC.POT.sizeFor(e.lv || (game.world && game.world.lv) || 1) : 's'; // (the chest's level's size: js/potions.js)
    for (let i = 0; i < C.pots; i++)
      game.loot.push({ kind: 'loot', potion: Math.random() < 0.6 ? 'red' : 'blue', size: potSize, x: e.x + NC.rand(-70, 70), y: e.y + NC.rand(-25, 25), sort: e.y, t: 0, z: 20, vz: 500 });
    for (let i = 0; i < C.gear; i++) NC.dropLoot(game, e.x + NC.rand(-90, 90), e.y + NC.rand(-30, 30), e);
    FX.stars(e.x, e.y - 50, 18, '255,220,120', { speed: 300 });
    FX.ring(e.x, e.y - 20, 20, 190, '255,220,120', 0.6, 9);
    if (C.back) chestCd[game.mapId + ':' + e.sx + ',' + e.sy] = now() + C.back;
    else chestCd[game.mapId + ':' + e.sx + ',' + e.sy] = now() + ((NC.BOSSES && NC.BOSSES[bossOf(game)] || {}).respawn || 480);
  }
  const bossOf = (game) => ((NC.MAPS[game.mapId] || {}).bosses || [[]])[0][0];

  // ---------------- ants call their friends ----------------
  function callFriends(game, e, S) {
    let n = 0;
    for (const m of game.enemies) {
      const M = NC.SPECIES[m.type];
      if (m === e || m.dead || !M || M.link !== S.link || m.state !== 'idle' || NC.dist(m.x, m.y, e.x, e.y) > 560) continue;
      m.state = 'chase'; m.t = 0; n++;
      FX.num(m.x, NC.labelTop(m) - 10, '!', { fill: '#ff9a5a', size: 46 });
    }
    return n;
  }

  // ---------------- hooks: chests (update / draw / tag), the chest loot, ants, the bat count ----------------
  const baseUpdate = NC.updateEnemy;
  NC.updateEnemy = function (game, e, dt) {
    if (!isChest(e)) return baseUpdate.apply(this, arguments);
    e.t += dt; e.anim += dt;
    e.flash = Math.max(0, e.flash - dt); e.show = Math.max(0, e.show - dt);
    e.kbx = e.kby = 0; e.state = 'idle'; e.sort = e.y;
  };
  const baseDraw = NC.drawEnemy;
  NC.drawEnemy = function (ctx, game, e) {
    if (!isChest(e)) return baseDraw.apply(this, arguments);
    const C = CHESTS[e.type], hit = e.flash > 0;
    NC.drawShadow(ctx, e.x, e.y, 52, 14, 0.35);
    NC.drawSpr(ctx, C.sprite, e.x + (hit ? NC.rand(-3, 3) : 0), e.y, { tint: hit ? ['#ffffff', 0.7] : null, sy: 1 + Math.sin(e.anim * 2) * 0.01 });
    // a glint now and then
    const g = (e.anim * 0.45 + e.sx * 0.001) % 1;
    if (g < 0.12) {
      const s = NC.SPR[C.sprite], a = Math.sin((g / 0.12) * Math.PI);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
      const x = e.x + (s ? s.w * 0.18 : 20), y = e.y - (s ? s.h * 0.62 : 60);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, 30); gr.addColorStop(0, 'rgba(255,245,200,0.9)'); gr.addColorStop(1, 'rgba(255,245,200,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - 30, y - 30, 60, 60);
      ctx.restore();
    }
  };
  const baseTop = NC.labelTop;
  NC.labelTop = (e) => {
    if (isChest(e)) { const s = NC.SPR[CHESTS[e.type].sprite]; return e.y - (s ? s.h : 110) - 22; }
    return baseTop(e);
  };
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    const was = e.hp, S = NC.SPECIES[e.type];
    if (isChest(e)) { kx = 0; ky = 0; }
    baseDamage.call(this, game, e, r, kx, ky, o);
    const died = was > 0 && e.hp <= 0;
    if (isChest(e) && died) lootChest(game, e);
    if (S && S.link && !died && !(r && r.miss) && !e.linked) { e.linked = true; if (callFriends(game, e, S)) FX.num(e.x, NC.labelTop(e) - 40, 'เรียกพวก!', { fill: '#ffb26b', size: 30 }); }
    if (died && e.type === 'bat' && game.mapId === 'batcave') batKilled(game);
  };
  // a map (re)loaded: chests still on their timer stay away; the others get their owner
  const baseMonsters = NC.Maps.monsters;
  NC.Maps.monsters = function (world) {
    const list = baseMonsters(world).filter((e) => !(isChest(e) && (chestCd[world.mapId + ':' + e.sx + ',' + e.sy] || 0) > now()));
    for (const e of list) if (isChest(e)) e.owner = CHEST_OWNER;
    return list;
  };

  // ---------------- the secret: 100 bats in one visit open the way to the Bat King's nest ----------------
  const secrets = (() => { try { return JSON.parse(localStorage.getItem(SECRET_KEY) || '{}'); } catch (e) { return {}; } })();
  NC.secretKnown = (id) => !!secrets[id];
  function batKilled(game) {
    const w = game.world;
    w.batKills = (w.batKills || 0) + 1;
    if (w.batKills === 50) NC.HUD.log('ค้างคาวแถวนี้ดูกระวนกระวาย... เหมือนมีบางอย่างอยู่ลึกเข้าไปในถ้ำ', 'sys');
    if (w.batKills % 100 === 0 && w.secretSpot && !w.nestOpen) openNest(game);
  }
  function openNest(game) {
    const w = game.world, [x, y] = w.secretSpot;
    w.nestOpen = game.time + 180;
    const ax = x, ay = y + 140;
    w.warps.push({ id: 'nest', x, y, ax, ay, to: 'batnest', at: 'out', secret: true });
    game.portals.push({ x, y, charge: 0, cool: false, id: 'nest', to: 'batnest', at: 'out', name: NC.MAPS.batnest.name, lvText: NC.MAPS.batnest.lvText, secret: true });
    FX.ring(x, y, 30, 420, '200,150,255', 0.9, 12);
    FX.stars(x, y - 60, 24, '220,190,255', { speed: 320 });
    game.shake = Math.max(game.shake, 10);
    game.toast('ได้ยินเสียงปีกนับพันกระพืออยู่ลึกเข้าไปในถ้ำ... ทางลับเปิดแล้ว (3 นาที)');
    NC.HUD.log('★ ทางลับสู่รังราชาค้างคาวเปิดแล้ว! รีบหาให้เจอภายใน 3 นาที', 'level');
    if (!secrets.batnest) { secrets.batnest = true; try { localStorage.setItem(SECRET_KEY, JSON.stringify(secrets)); } catch (e) { /* storage blocked */ } }
  }
  function closeNest(game) {
    const w = game.world;
    w.nestOpen = 0; w.batKills = 0;
    w.warps = w.warps.filter((v) => v.id !== 'nest');
    game.portals = game.portals.filter((v) => v.id !== 'nest');
    NC.HUD.log('ทางลับในถ้ำค้างคาวปิดลงแล้ว', 'sys');
  }
  NC.Dungeons = { openNest, FLOORS, chestCd };

  // ---------------- every frame in a dungeon: the lantern, the traps, the chests coming back, the nest's timer ----------------
  const trapDmg = (game) => {
    const lv = NC.MAPS[game.mapId] && NC.MAPS[game.mapId].lv, top = lv ? Math.max(...Object.values(lv).map((r) => r[1])) : 10;
    return Math.round(10 + top * 2.6);
  };
  let trapFx = null;
  function frame(game, dt) {
    const w = game.world, p = game.player;
    if (!w) return;
    // the words when the hero falls in a dungeon
    if (!game.__dunToast) {
      game.__dunToast = true;
      const t0 = game.toast;
      game.toast = function (txt) {
        if (game.world && game.world.dungeon && typeof txt === 'string') txt = txt.replace('กำลังกลับไปที่ค่าย', 'กำลังกลับไปที่ทางเข้า').replace('ฟื้นคืนชีพที่ค่าย', 'ฟื้นคืนชีพที่ทางเข้าดันเจี้ยน');
        return t0.call(this, txt);
      };
    }
    if (!w.dungeon) return;
    // the lantern: a warm light that goes with the hero (game.js centres a light 120 below its y)
    if (w.heroLight) {
      if (!w.lantern || !w.lights.includes(w.lantern)) { w.lantern = { x: p.x, y: p.y, r: w.heroLight[0], rgb: w.heroLight[1], flick: 3, owner: { name: 'lantern' }, hero: true }; w.lights.push(w.lantern); }
      w.lantern.x = p.x + (p.face || 1) * 16; w.lantern.y = p.y - 190;
    }
    // spike traps: down, a warning (the spikes peek out), up (a hit when the hero is on the plate)
    for (const t of w.traps || []) {
      t.t += dt;
      const c = t.t % 3.4, ph = c < 2.2 ? 0 : c < 2.75 ? 1 : 2;
      if (ph === 2 && t.ph !== 2) t.hit = false;
      t.ph = ph;
      if (ph === 2 && !t.hit && p.dead <= 0 && Math.abs(p.x - t.x) < t.w / 2 && Math.abs(p.y - t.y) < t.h / 2) {
        t.hit = true;
        NC.hurtPlayer(game, trapDmg(game), t.x);
        FX.puff(p.x, p.y - 20, 5, { speed: 120, color: '200,200,210' });
      }
    }
    if (w.traps && w.traps.length && (!trapFx || !FX.list.includes(trapFx)))
      trapFx = FX.add({ type: 'custom', layer: 'low', x: 0, y: 0, life: Infinity, draw(ctx) {
        const g = NC.game;
        if (!g.world || !g.world.traps) return;
        for (const t of g.world.traps) {
          if (Math.abs(t.x - g.cam.x - g.vw / 2) > g.vw || Math.abs(t.y - g.cam.y - g.vh / 2) > g.vh) continue;
          const up = t.ph === 2, warn = t.ph === 1;
          if (warn) {
            ctx.save(); ctx.globalAlpha = 0.35 + 0.25 * Math.sin(g.time * 30);
            ctx.fillStyle = 'rgba(255,80,90,0.9)'; ctx.beginPath(); ctx.ellipse(t.x, t.y, t.w * 0.6, t.h * 0.6, 0, 0, TAU); ctx.fill();
            ctx.restore();
          }
          NC.drawSpr(ctx, up ? 'd_spikes_up' : 'd_spikes_down', t.x, t.y + t.h * 0.42);
          if (warn && NC.SPR.d_spikes_up) NC.drawSpr(ctx, 'd_spikes_up', t.x, t.y + t.h * 0.42, { sy: 0.4, alpha: 0.8 });
        }
      } });
    // chests whose time is up come back (not while the hero stands next to them)
    for (const [type, x, y] of w.spawns || []) {
      if (!isChest({ type })) continue;
      const key = game.mapId + ':' + x + ',' + y, at = chestCd[key];
      if (!at || at > now() || NC.dist(x, y, p.x, p.y) < 800 || game.enemies.some((e) => e.type === type && e.sx === x && e.sy === y && !e.dead)) continue;
      delete chestCd[key];
      const e = NC.makeEnemy(type, x, y, NC.spawnLevel(w, type, x, y));
      e.owner = CHEST_OWNER;
      game.enemies.push(e);
      FX.stars(x, y - 40, 10, '255,220,120', { speed: 160 });
    }
    // the nest's way closes after its three minutes
    if (w.nestOpen && game.time > w.nestOpen) closeNest(game);
  }
  const baseLoad = NC.loadAssets;
  NC.loadAssets = function () {
    return baseLoad.apply(this, arguments).then((r) => {
      const baseLoot = NC.updateLoot;
      NC.updateLoot = function (game, dt) { frame(game, dt || 1 / 60); return baseLoot.apply(this, arguments); };
      return r;
    });
  };
})();
