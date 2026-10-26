/* darkroot.js — รากต้นไม้มืด (THE DARK ROOT): a 100-floor tower going DOWN into the roots under the Dark Tree, solo or as
   a party of 2–4 real players, with its own leaderboard (the user, 2026-10-12: "ทำหอคอย 100 ชั้น แบบ solo กับปาร์ตี้
   ออกแบบให้ดีที่สุด แล้วก็ทำระบบ leader board ด้วย"; mockups assets/gen/nightcamp_tower_lobby_a / board_b, the windows
   are js/darkroot_ui.js).
     ten zones of ten floors, monsters from Lv 5 (floor 1) to Lv 99 (floor 100), each zone its own art (assets/root/,
     assets/gen/make_root_prompts.py), its own monsters and, on every 10th floor, the root's shade of a boss it swallowed
     every floor a goal (the stairs down stay sealed by thorns until it is done):
       ล่า        hunt N monsters                     จุดกองไฟ   light 3 cold campfires (stand by one 3.5 s) while monsters come
       หัวหน้า     fell the elites (big, violet ring)   ระลอก      survive 3 waves that come at you
       กุญแจ      fell the key bearers                 ชั้นมืด     hunt in the dark: the hero's light shrinks to half
       บอส        every 10th floor; after it a campfire: the checkpoint (a new run may start on the floor below it)
     the wind of the week (WINDS): one rule for everyone that week (blood moon, fog, hungry roots, warm embers, ...)
     solo: dying ends the run. party (2–4, js/partynet.js): monsters +15% HP for each member, the goal counts every
       member's part (presence `rt`), the boss is one HP pool (like the guild boss), the party has 3 revives a run
     the time: each floor's clear time; the boards rank the deepest floor cleared, then the sum of the best times of
       floors 1..that floor (so a run started at a campfire is ranked like one from floor 1)
     rewards: a floor's first clear this season pays coins (x3 on a boss floor) and an option stone every 5th floor; its
       first clear this week a Root Seed (3 on a boss floor) when its monsters are at most 20 levels under the hero;
       Root Seeds buy stones, sap and frames in the lobby (darkroot_ui.js). The auto farm cannot play here.
   Saved: nightcamp.root.v1 (records, checkpoints, first clears). Shared (js/store.js): root/{uid} (solo), rootp/{key}
   (a party: its members' ids sorted). Floors are maps root_<f>_<run id> (made when walked into; a reload is back at the
   camp). Hooks: NC.buildField, NC.buildWorld (the gate in the camp), NC.makeEnemy, NC.damageEnemy, NC.skillKills,
   NC.skillTicks, NC.gainXp, NC.skillModSources, NC.Maps.drawLabels, NC.Auto.toggle, NC.Net fields/hooks.
   NC.Root: ZONES, WINDS, floorInfo(f), state, startRun(game, f, mode), run(), floor(), wind(), lobby (ready/floor),
   boardRows(mode, period), recordKey, push(). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, TAU = Math.PI * 2;
  if (NC.ASSET_MANIFEST_ROOT && NC.ASSET_MANIFEST) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_ROOT);
  const G = () => NC.game;
  const fmt = (n) => (NC.fmtCoins ? NC.fmtCoins(Math.round(n)) : Math.round(n).toLocaleString());
  const clean = (s, n) => (NC.Net && NC.Net.clean ? NC.Net.clean(s, n) : String(s == null ? '' : s).trim().slice(0, n));
  const KEY = 'nightcamp.root.v1', FLOORS = 100, REVIVES = 3, SEED_GAP = 20;
  const weekNo = () => Math.floor((Date.now() / 86400000 + 3) / 7);
  const SV = () => (NC.Root && NC.Root.server) || null; // (?online: the server runs the floors, js/online/root.js)
  const seasonNo = () => (NC.Season && NC.Season.seasonNo ? NC.Season.seasonNo() : 1);

  // ======================================================================================================
  // ---------------- the zones ----------------
  // paint: the dungeon theme's colours (dungeongen.js THEMES); props: [wall, glow, big, low, special] from assets/root
  const W = (list) => list.map((x) => (Array.isArray(x) ? x : [x, 1]));
  const ZONES = [
    { name: 'ประตูราก', en: 'Root Gate', boss: 'bat_king', mobs: ['root_worm', 'slime_green', 'stump', 'field_mouse', 'bat', 'cave_spider', 'potato_walker', 'hedgehog'],
      paint: { floor: [98, 80, 64], floor2: [112, 92, 72], rock: [30, 22, 26], rock2: [50, 38, 38], face: [[122, 96, 78], [72, 54, 50]], ambient: [74, 64, 100], light: [400, '255,214,170'],
        specks: ['rgba(60,44,40,0.55)', 'rgba(150,130,104,0.45)', 'rgba(110,150,90,0.3)'], cracks: 30, mini: '#7a604e' },
      wall: [['r1_rootwall', 1.3], ['r1_stones', 0.8]], glow: ['r1_grubs', 'r1_bud'], big: ['r1_stump', ['r1_stones', 0.7]], low: [['r1_tangle', 1.3], 'r1_leaves'], special: ['r1_arch'] },
    { name: 'โพรงเห็ดเรือง', en: 'Glowshroom Hollow', boss: 'mushking', mobs: ['split_shroom', 'puff_shroom', 'shroom_beetle', 'shroom_wolf', 'doctor_shroom', 'glow_spider', 'stump_shroom', 'slime_glow', 'moth'],
      paint: { floor: [74, 82, 92], floor2: [84, 96, 104], rock: [20, 24, 36], rock2: [34, 40, 56], face: [[100, 112, 124], [56, 62, 80]], ambient: [60, 96, 124], light: [380, '200,240,255'],
        specks: ['rgba(40,50,70,0.55)', 'rgba(120,230,230,0.35)', 'rgba(230,240,255,0.3)'], cracks: 20, mini: '#5c6c7e' },
      wall: [['r2_shelf', 1.2], ['r2_puff', 0.6]], glow: ['r2_giant', 'r2_cluster', 'r2_spores'], big: ['r2_puff', 'r2_cap'], low: [['r2_web', 1.3], 'r2_ring'], special: ['r2_giant'] },
    { name: 'ห้องกระดูก', en: 'Bone Vault', boss: 'crypt_lord', mobs: ['skeleton', 'bone_archer', 'bone_pile', 'tomb_knight', 'bone_shaman', 'coffin_bomb', 'zombie', 'grave_crow', 'candle_wisp'],
      paint: { floor: [104, 100, 104], floor2: [118, 112, 114], rock: [24, 22, 32], rock2: [40, 36, 48], face: [[130, 124, 130], [74, 70, 82]], ambient: [56, 60, 92], light: [400, '220,228,255'],
        specks: ['rgba(60,58,70,0.5)', 'rgba(220,214,200,0.4)', 'rgba(140,170,210,0.3)'], cracks: 40, mini: '#86828a' },
      wall: [['r3_grave', 1], ['r3_cage', 0.8], ['r3_skull', 0.8]], glow: ['r3_candles', 'r3_brazier'], big: ['r3_skull', 'r3_bonepile', ['r3_grave', 0.6]], low: [['r3_dust', 1.4], ['r3_bonepile', 0.4]], special: ['r3_ribs'] },
    { name: 'เส้นเลือดถ่านไฟ', en: 'Ember Veins', boss: 'lava_dragon', mobs: ['ember_fox', 'char_stump', 'ash_wisp', 'fire_bat', 'salamander', 'magma_blob', 'lava_imp', 'slime_lava', 'fire_imp'],
      paint: { floor: [70, 54, 56], floor2: [84, 64, 62], rock: [22, 14, 18], rock2: [40, 24, 26], face: [[100, 74, 70], [54, 36, 40]], ambient: [120, 76, 72], light: [360, '255,196,150'],
        specks: ['rgba(40,26,28,0.6)', 'rgba(255,130,60,0.45)', 'rgba(120,96,96,0.4)'], cracks: 120, glowCracks: true, mini: '#6a4c4e' },
      wall: [['r4_char', 1.2], ['r4_smoke', 0.8]], glow: ['r4_vein', 'r4_crystal', 'r4_stump', 'r4_coals'], big: ['r4_cinder', 'r4_smoke'], low: [['r4_ash', 1.4]], special: ['r4_vein'] },
    { name: 'รากจมน้ำ', en: 'Drowned Roots', boss: 'frog_queen', mobs: ['kappa', 'frog', 'spit_frog', 'mud_eel', 'shield_crab', 'water_newt', 'ink_drop', 'mist_sprite', 'leap_trout'],
      paint: { floor: [62, 78, 86], floor2: [72, 90, 98], rock: [16, 22, 32], rock2: [28, 38, 52], face: [[90, 108, 118], [48, 60, 74]], ambient: [56, 84, 120], light: [380, '200,230,255'],
        specks: ['rgba(30,44,56,0.55)', 'rgba(140,200,230,0.4)', 'rgba(90,140,110,0.3)'], cracks: 20,
        pool: { c1: [70, 120, 160], c2: [30, 56, 90], edge: [26, 40, 56], glow: '120,190,255' }, mini: '#4c6474' },
      wall: [['r5_barnacle', 1.1], ['r5_reeds', 0.9]], glow: ['r5_jelly', 'r5_snails', 'r5_hanging'], big: ['r5_reeds', 'r5_barnacle'], low: [['r5_puddle', 1.2], 'r5_lily'], special: ['r5_boat', 'r5_hanging'], pools: 0.45 },
    { name: 'รังผีเสื้อกลางคืน', en: 'Moth Nest', boss: 'ant_queen', mobs: ['moth', 'sleep_moth', 'mosquito', 'dragonfly', 'flying_ant', 'poison_ladybug', 'glow_spider', 'mother_bat', 'echo_bat'],
      paint: { floor: [96, 90, 84], floor2: [110, 104, 94], rock: [28, 24, 30], rock2: [46, 40, 46], face: [[124, 116, 106], [70, 64, 66]], ambient: [96, 88, 104], light: [380, '255,236,190'],
        specks: ['rgba(60,54,56,0.5)', 'rgba(240,230,200,0.4)', 'rgba(255,220,140,0.3)'], cracks: 20, mini: '#7a726a' },
      wall: [['r6_silk', 1], ['r6_husk', 0.8]], glow: ['r6_glow', 'r6_bloom', 'r6_eggs'], big: ['r6_husk', 'r6_eggs'], low: ['r6_wings'], special: ['r6_cocoons'] },
    { name: 'คณะประสานเสียงเงียบ', en: 'Silent Choir', boss: 'sb_nocturne', mobs: ['bell_puppet', 'bell_lead', 'bomb_bell', 'hollow_bellringer', 'mist_citizen', 'faceless_puppet', 'cardinal_puppet', 'temple_soldier', 'mist_wraith', 'ghost_violet'],
      paint: { floor: [92, 88, 106], floor2: [104, 100, 120], rock: [22, 20, 34], rock2: [38, 34, 54], face: [[118, 112, 136], [64, 60, 84]], ambient: [74, 66, 118], light: [380, '230,220,255'],
        specks: ['rgba(50,46,70,0.5)', 'rgba(200,190,240,0.35)', 'rgba(170,150,220,0.3)'], cracks: 30, tiles: true, mini: '#6e6886' },
      wall: [['r7_singer', 1], ['r7_pair', 1], ['r7_bench', 0.6]], glow: ['r7_basin', 'r7_candles'], big: ['r7_bell', 'r7_pair', 'r7_bench'], low: [['r7_sheets', 1.2]], special: ['r7_pipes', 'r7_singer'] },
    { name: 'รากกินดาว', en: 'Star-eater Roots', boss: 'aurelion', mobs: ['star_crystal', 'tiny_meteor', 'walking_scope', 'owl_star', 'hollow_stargazer', 'glass_warden', 'crystal_bat', 'crystal_golem', 'storm_spirit'],
      paint: { floor: [56, 58, 82], floor2: [66, 68, 96], rock: [12, 12, 28], rock2: [26, 24, 48], face: [[84, 86, 116], [42, 42, 66]], ambient: [60, 62, 120], light: [400, '255,240,200'],
        specks: ['rgba(30,30,54,0.55)', 'rgba(255,240,180,0.45)', 'rgba(180,200,255,0.4)'], cracks: 20, mini: '#4a4c6e' },
      wall: [['r8_void', 1], ['r8_rocks', 0.8], ['r8_meteor', 0.7]], glow: ['r8_star', 'r8_shards', 'r8_orbs'], big: ['r8_meteor', 'r8_rocks'], low: [['r8_rocks', 1]], special: ['r8_scope', 'r8_star'] },
    { name: 'ทะเลยางดำ', en: 'Black Sap Sea', boss: 'poison_heart', mobs: ['bloat_toad', 'split_slug', 'swamp_croc', 'poison_toad', 'swamp_snake', 'mother_bloom', 'bloom_sprout', 'poison_spore', 'maneater'],
      paint: { floor: [64, 58, 70], floor2: [74, 66, 82], rock: [12, 8, 16], rock2: [26, 18, 32], face: [[88, 78, 96], [42, 34, 50]], ambient: [84, 60, 116], light: [360, '230,200,255'],
        specks: ['rgba(20,14,26,0.6)', 'rgba(180,120,255,0.35)', 'rgba(90,80,100,0.4)'], cracks: 40,
        pool: { c1: [70, 50, 96], c2: [18, 12, 26], edge: [10, 6, 14], glow: '170,110,255' }, mini: '#504658' },
      wall: [['r9_spikes', 1.2], ['r9_mound', 0.8]], glow: ['r9_sapfall', 'r9_reeds', 'r9_bubbles'], big: ['r9_mound', 'r9_spikes'], low: [['r9_slick', 1.3], 'r9_bones'], special: ['r9_head'], pools: 0.5 },
    { name: 'หัวใจต้นไม้มืด', en: 'Heart of the Dark Tree', boss: 'hundred_string', mobs: ['thread_binder', 'wooden_hand', 'puppet_black', 'faceless_puppet', 'repair_puppet', 'spring_bomb', 'lightless_deer', 'hollow_horse', 'elder_treant'],
      paint: { floor: [70, 52, 72], floor2: [82, 60, 84], rock: [16, 8, 20], rock2: [34, 16, 38], face: [[98, 72, 100], [50, 32, 56]], ambient: [110, 60, 124], light: [360, '255,200,240'],
        specks: ['rgba(30,14,34,0.6)', 'rgba(220,120,255,0.4)', 'rgba(255,90,140,0.3)'], cracks: 90, glowCracks: true, mini: '#5a3e5e' },
      wall: [['r10_thorns', 1.2], ['r10_ring', 0.6]], glow: ['r10_heart', 'r10_eye', 'r10_crystal'], big: ['r10_ring', 'r10_crystal'], low: [['r10_strings', 1.2]], special: ['r10_throne', 'r10_puppets'] },
  ];
  ZONES.forEach((Z, i) => { Z.i = i; Z.theme = 'root' + (i + 1); Z.first = i * 10 + 1; Z.last = i * 10 + 10; });
  const zoneOf = (f) => ZONES[Math.max(0, Math.min(9, Math.floor((f - 1) / 10)))];
  const LV = (f) => 4 + Math.round(f * 0.95); // floor 1: Lv 5 · 10: Lv 14 · 50: Lv 52 · 100: Lv 99

  // the props: how each stands (fieldgen.js PROPS), lights on the glowing ones
  const L = (r, rgb, y) => [0, y == null ? -0.55 : y, r, rgb];
  Object.assign(NC.FIELD_PROPS, {
    rt_gate: { kind: 'rock', light: L(240, '170,110,255', -0.4) }, rt_down: { kind: 'low' }, rt_sealed: { kind: 'low', light: L(150, '170,110,255', -0.3) },
    rt_up: { kind: 'low', light: L(240, '190,210,255', -0.6) }, rt_fire_off: { kind: 'rock' }, rt_fire_on: { kind: 'rock', light: L(380, '255,190,110', -0.5) },
    r1_rootwall: { kind: 'tall' }, r1_arch: { kind: 'rock' }, r1_stump: { kind: 'rock' }, r1_grubs: { kind: 'rock', light: L(170, '190,255,170', -0.4) },
    r1_bud: { kind: 'tall', light: L(200, '200,150,255', -0.7), walkThrough: true }, r1_stones: { kind: 'rock' }, r1_tangle: { kind: 'low' }, r1_leaves: { kind: 'low' },
    r2_giant: { kind: 'tall', light: L(300, '120,230,255', -0.75) }, r2_shelf: { kind: 'tall' }, r2_cluster: { kind: 'rock', light: L(220, '120,220,240', -0.5) },
    r2_puff: { kind: 'rock' }, r2_spores: { kind: 'tall', light: L(200, '210,255,150', -0.75) }, r2_cap: { kind: 'rock' }, r2_ring: { kind: 'low', light: L(110, '150,240,240', -0.3) }, r2_web: { kind: 'low' },
    r3_ribs: { kind: 'rock' }, r3_skull: { kind: 'rock' }, r3_cage: { kind: 'tall' }, r3_candles: { kind: 'rock', light: L(220, '200,225,255', -0.6) },
    r3_grave: { kind: 'rock' }, r3_brazier: { kind: 'post', light: L(260, '150,200,255', -0.75) }, r3_bonepile: { kind: 'rock' }, r3_dust: { kind: 'low' },
    r4_vein: { kind: 'tall', light: L(240, '255,140,60', -0.5) }, r4_char: { kind: 'tall' }, r4_stump: { kind: 'rock', light: L(260, '255,160,80', -0.7) },
    r4_crystal: { kind: 'rock', light: L(220, '255,120,70', -0.5) }, r4_coals: { kind: 'rock', light: L(200, '255,130,60', -0.3) }, r4_smoke: { kind: 'rock' }, r4_cinder: { kind: 'rock' },
    r4_ash: { kind: 'low', light: L(70, '255,120,50', -0.3) },
    r5_hanging: { kind: 'tall', light: L(150, '140,200,255', -0.2) }, r5_barnacle: { kind: 'tall' }, r5_boat: { kind: 'rock' }, r5_jelly: { kind: 'rock', light: L(230, '130,200,255', -0.5) },
    r5_snails: { kind: 'rock', light: L(160, '120,240,220', -0.4) }, r5_reeds: { kind: 'bush' }, r5_lily: { kind: 'low' }, r5_puddle: { kind: 'low' },
    r6_cocoons: { kind: 'rock' }, r6_silk: { kind: 'fence' }, r6_glow: { kind: 'rock', light: L(250, '255,220,140', -0.55) }, r6_husk: { kind: 'rock' },
    r6_bloom: { kind: 'bush', light: L(200, '255,240,170', -0.7), walkThrough: true }, r6_eggs: { kind: 'rock', light: L(140, '255,240,210', -0.4) }, r6_wings: { kind: 'low' }, r6_dust: { kind: 'low' },
    r7_singer: { kind: 'tall' }, r7_pipes: { kind: 'rock' }, r7_pair: { kind: 'rock' }, r7_bell: { kind: 'rock' }, r7_basin: { kind: 'post', light: L(260, '210,170,255', -0.75) },
    r7_candles: { kind: 'rock', light: L(220, '170,200,255', -0.6) }, r7_bench: { kind: 'rock' }, r7_sheets: { kind: 'low' },
    r8_star: { kind: 'tall', light: L(320, '255,236,170', -0.6) }, r8_void: { kind: 'tall', light: L(140, '160,170,255', -0.5) }, r8_scope: { kind: 'rock' },
    r8_shards: { kind: 'rock', light: L(230, '255,245,200', -0.5) }, r8_orbs: { kind: 'rock', light: L(220, '255,240,190', -0.7) }, r8_meteor: { kind: 'rock' }, r8_rocks: { kind: 'rock' },
    r8_dust: { kind: 'low', light: L(80, '255,240,200', -0.3) },
    r9_sapfall: { kind: 'tall', light: L(170, '170,110,255', -0.4) }, r9_spikes: { kind: 'rock' }, r9_head: { kind: 'rock' }, r9_mound: { kind: 'rock' },
    r9_reeds: { kind: 'bush', light: L(160, '190,120,255', -0.8) }, r9_bubbles: { kind: 'low', light: L(120, '170,110,255', -0.3) }, r9_bones: { kind: 'low' }, r9_slick: { kind: 'low' },
    r10_heart: { kind: 'tall', light: L(320, '200,90,255', -0.5) }, r10_puppets: { kind: 'rock' }, r10_throne: { kind: 'rock' }, r10_thorns: { kind: 'tall' },
    r10_eye: { kind: 'rock', light: L(200, '255,90,170', -0.55) }, r10_crystal: { kind: 'rock', light: L(220, '200,120,255', -0.5) }, r10_ring: { kind: 'rock' }, r10_strings: { kind: 'low' },
  });
  // each zone's paint and props as a dungeongen.js theme (a missing picture falls back to the cave's props)
  for (const Z of ZONES) {
    const T = Object.assign({}, Z.paint, { wall: W(Z.wall), glow: W(Z.glow), big: W(Z.big), low: W(Z.low), special: Z.special, glowEvery: 470 });
    NC.DUNGEON_THEMES[Z.theme] = T;
  }
  // (until the art is loaded and cut, a theme whose pictures are missing borrows the bat cave's)
  (NC.assetsLoaded || (NC.assetsLoaded = [])).push(() => {
    const cave = NC.DUNGEON_THEMES.cave;
    for (const Z of ZONES) {
      const T = NC.DUNGEON_THEMES[Z.theme];
      for (const k of ['wall', 'glow', 'big', 'low']) { const ok = T[k].filter(([n]) => NC.SPR[n]); T[k] = ok.length ? ok : cave[k]; }
      T.special = (T.special || []).filter((n) => NC.SPR[n]);
    }
  });

  // ---------------- the floors ----------------
  const SEQ = ['hunt', 'fires', 'elite', 'waves', 'keys', 'dark', 'hunt', 'fires', 'waves'];
  const goalOf = (f) => (f % 10 === 0 ? 'boss' : SEQ[((f - 1) % 10 + Math.floor((f - 1) / 10) * 2) % 9]);
  const GOAL = {
    hunt: { name: 'ล่า', icon: 'ri_hunt', text: (n) => `ล่ามอนให้ครบ ${n} ตัว` },
    fires: { name: 'จุดกองไฟ', icon: 'ic_pfire', text: (n) => `จุดกองไฟ ${n} กอง ระหว่างมอนบุก (ยืนข้างกองไฟ 3.5 วิ)` },
    elite: { name: 'หัวหน้า', icon: 'ri_elite', text: (n) => `ล้มหัวหน้าฝูง ${n} ตัว (วงม่วงใต้เท้า)` },
    waves: { name: 'ระลอก', icon: 'ri_waves', text: (n) => `รอด ${n} ระลอกที่บุกเข้ามา` },
    keys: { name: 'แก่นราก', icon: 'rt_seed', text: (n) => `ล้มมอนที่กลืนแก่นราก ${n} ตัว (เมล็ดม่วงลอยเหนือหัว)` },
    dark: { name: 'ชั้นมืด', icon: 'ri_dark', text: (n) => `ล่า ${n} ตัวในความมืด (แสงรอบตัวเหลือครึ่งเดียว)` },
    boss: { name: 'บอส', icon: 'ic_rank', text: () => 'ล้มเงาราก: ดรอปของบอสตัวจริง (ผูกตัว) + แก่นเงา 1 · หลังบอสมีกองไฟจุดเซฟ' },
  };
  // the winds of the week: one for everyone that week
  const WINDS = [
    { id: 'blood', name: 'พระจันทร์เลือด', text: 'มอนตีแรงขึ้น 15%' },
    { id: 'fog', name: 'หมอกราก', text: 'แสงรอบตัวแคบลง 35%' },
    { id: 'hunger', name: 'รากหิว', text: 'มอนเลือดมากขึ้น 20% · เหรียญผ่านชั้นครั้งแรก +20%' },
    { id: 'ember', name: 'ไฟอุ่น', text: 'ชั้นจุดไฟใช้แค่ 2 กอง · ยืนข้างกองไฟที่ติดแล้วฟื้นพลัง' },
    { id: 'swarm', name: 'ฝูงหนา', text: 'มอนมากขึ้น 30% · เป้าล่า +20% · EXP +20%' },
    { id: 'stars', name: 'ดาวตกในราก', text: 'หัวหน้าและบอสให้เมล็ดรากอีก 1' },
    { id: 'silence', name: 'เงียบงัน', text: 'ดาเมจของเรา +10% แต่โดนแรงขึ้น 10%' },
  ];
  const wind = () => WINDS[(weekNo() * 3 + 1) % WINDS.length];
  const windIs = (id) => wind().id === id;
  const partyK = (n) => 1 + 0.75 * (Math.max(1, n) - 1); // (party size → how much more the goal asks: 2 = x1.75, 4 = x3.25)
  function needOf(f, n) {
    const kind = goalOf(f), z = zoneOf(f).i;
    const swarm = windIs('swarm') ? 1.2 : 1;
    switch (kind) {
      case 'hunt': return Math.ceil((18 + 2 * z) * swarm * partyK(n));
      case 'dark': return Math.ceil((14 + 2 * z) * swarm * partyK(n));
      case 'fires': return windIs('ember') ? 2 : 3;
      case 'elite': return 2 + Math.max(0, n - 1);
      case 'keys': return 3 + Math.max(0, n - 1);
      case 'waves': return 3;
      default: return 1;
    }
  }
  const waveSize = (f) => 6 + zoneOf(f).i;
  function floorInfo(f, n) {
    const Z = zoneOf(f), kind = goalOf(f), need = needOf(f, n || 1), lv = LV(f);
    return { f, zone: Z, kind, goal: GOAL[kind], need, text: GOAL[kind].text(need), lv, lvText: `Lv ${lv}–${Math.min(99, lv + 2)}`, boss: kind === 'boss' ? Z.boss : null,
      coins: firstCoins(f), seeds: kind === 'boss' ? 3 : 1, stone: f % 5 === 0 };
  }
  const firstCoins = (f) => Math.round((LV(f) * 150 + f * 40) * (f % 10 === 0 ? 3 : 1) * (windIs('hunger') ? 1.2 : 1));

  // ======================================================================================================
  // ---------------- my records ----------------
  // s / w / a: this season, this week, all time: { best: deepest floor cleared, t: { floor: best time (s) } }
  // cp: the deepest campfire reached this season (a run may start there); first: the first clears paid
  const blank = () => ({ best: 0, t: {} });
  let st = { season: seasonNo(), week: weekNo(), cp: 1, s: blank(), w: blank(), a: blank(), first: { s: {}, w: {} }, frames: [], frame: null, pname: {}, runs: 0, seen: 0 };
  try { if (!NC.ONLINE) st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* blocked */ }
  const save = () => { if (G() && G().noSave) return; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* blocked */ } };
  function roll() { // a new week / season: their records start again (all time stays)
    let ch = false;
    if (st.season !== seasonNo()) { st.season = seasonNo(); st.s = blank(); st.cp = 1; st.first.s = {}; ch = true; }
    if (st.week !== weekNo()) { st.week = weekNo(); st.w = blank(); st.first.w = {}; ch = true; }
    if (ch) save();
  }
  roll();
  // a board's time: the deepest floor F, and the sum of the best times of floors 1..F (a floor without a time in this
  // period takes the season's, then the all-time one: a run begun at a campfire counts the floors above it as before)
  function sumTime(rec, F, ...fallback) {
    let T = 0;
    for (let f = 1; f <= F; f++) {
      let t = rec.t[f];
      for (const fb of fallback) if (t == null && fb) t = fb.t[f];
      T += t == null ? 600 : t; // (a floor never timed: 10 minutes)
    }
    return Math.round(T * 10) / 10;
  }
  const score = (F, T) => (F > 0 ? F * 1e7 + (1e7 - 1 - Math.min(1e7 - 1, Math.round(T * 10))) : 0);
  function boardsOf(recS, recW, recA) {
    const out = {};
    const sT = sumTime(recS, recS.best, recA), wT = sumTime(recW, recW.best, recS, recA), aT = sumTime(recA, recA.best);
    Object.assign(out, { sF: recS.best, sT, sScore: score(recS.best, sT), wF: recW.best, wT, wScore: score(recW.best, wT), aF: recA.best, aT, aScore: score(recA.best, aT) });
    return out;
  }
  function recordFloor(rec, f, t) {
    rec.best = Math.max(rec.best, f);
    if (rec.t[f] == null || t < rec.t[f]) rec.t[f] = Math.round(t * 10) / 10;
  }

  // ======================================================================================================
  // ---------------- the shared boards (js/store.js) ----------------
  const S = NC.Store;
  let uid = null;
  if (S) S.ready.then(() => { uid = S.me(); setTimeout(() => settle().then(() => push()), 5000); });
  // a season over: where my record ended it (my doc still holds it until this first write): the top 10 get the root
  // crown frame (others who already moved on to the new season are no longer counted: the game's server will rank it
  // properly)
  async function settle() {
    try {
      const d = await S.get('root/' + uid);
      if (!d || !(d.season < seasonNo()) || !(d.sScore > 0) || st.settled === d.season) return;
      st.settled = d.season;
      const rank = (await S.query('root', { where: [['sScore', '>', d.sScore]] })).filter((r) => r.data.season === d.season).length + 1;
      if (rank <= 10 && !st.frames.includes('crown')) { st.frames.push('crown'); NC.HUD.log(`ฤดูกาล ${d.season} คุณจบอันดับ #${rank} ในรากต้นไม้มืด · ได้กรอบมงกุฎราก`, 'level'); }
      save();
    } catch (e) { /* (the store is away: next time) */ }
  }
  const LINE_OF = (job) => { let j = job, J = NC.JOBS[j], n = 0; while (J && J.tier > 1 && J.from && n++ < 6) { j = J.from; J = NC.JOBS[j]; } return J && J.tier === 1 ? j : 'traveler'; };
  const SLOTS = ['hat', 'hair', 'top', 'pants', 'shoes', 'weapon', 'robe', 'cape', 'glasses'];
  function meRow() {
    const g = G(), p = g.player, gd = NC.Guild && NC.Guild.gid && NC.Guild.gid() ? NC.Guild.guild() : null;
    return { name: clean(p.name, 16) || 'ผู้เล่น', job: p.job, line: LINE_OF(p.job), lv: p.lv, eq: SLOTS.map((s) => p.equip[s] || null),
      guild: gd ? clean(gd.name, 16) : null, gcolor: gd ? gd.color : null, frame: st.frame || null };
  }
  let lastSig = '';
  function push() {
    const g = G();
    if (SV() || !S || !uid || !g || !g.player || g.noRanks) return;
    roll();
    const r = Object.assign(meRow(), boardsOf(st.s, st.w, st.a), { season: seasonNo(), week: weekNo() });
    const sig = JSON.stringify(r);
    if (sig === lastSig) return;
    lastSig = sig; r.t = Date.now();
    return S.set('root/' + uid, r);
  }
  // a party's record: the doc of its members (ids sorted), written by whoever leads it in the run
  const partyKey = (ids) => ids.filter(Boolean).slice().sort().join('-');
  async function pushParty(key, members, f, t) {
    if (SV() || !S || !key) return;
    let d = null;
    try { d = await S.get('rootp/' + key); } catch (e) { d = null; }
    d = d || {};
    const wk = weekNo(), ss = seasonNo();
    const rec = (k, keep) => (keep && d[k] ? { best: d[k].best | 0, t: Object.assign({}, d[k].t) } : blank());
    const recS = rec('s', d.season === ss), recW = rec('w', d.week === wk && d.season === ss), recA = rec('a', true);
    for (const R of [recS, recW, recA]) recordFloor(R, f, t);
    const lead = members[0] || {};
    const out = Object.assign({ name: clean((st.pname[key] || d.name || `ทีมของ ${lead.name || 'ผู้เล่น'}`), 20), mem: members.slice(0, 4), n: members.length, line: lead.line || 'traveler',
      season: ss, week: wk, s: recS, w: recW, a: recA, t: Date.now() }, boardsOf(recS, recW, recA));
    try { await S.set('rootp/' + key, out); } catch (e) { console.warn('darkroot: party record', e); }
  }

  // ======================================================================================================
  // ---------------- the run and the floor ----------------
  let run = null; // { id, mode, start, floor, deaths, out, members: [uid], key, pname }
  let fl = null; // the floor I am on: { f, kind, need, t, mine, stage, ... }
  const rid = () => Math.random().toString(36).slice(2, 8);
  const floorRe = /^root_(\d+)_([a-z0-9]{3,10})$/;
  const parseFloor = (id) => { const m = floorRe.exec(id || ''); return m ? { f: m[1] | 0, rid: m[2] } : null; };
  const onRoot = (game) => !!parseFloor((game || G() || {}).mapId);

  function defineFloor(f, id) {
    const mid = `root_${f}_${id}`;
    if (NC.MAPS[mid]) return mid;
    const Z = zoneOf(f), lv = LV(f), kind = goalOf(f), boss = kind === 'boss' ? Z.boss : null, w = weekNo();
    const pick = (k) => Z.mobs[(w * 7 + f * 3 + k * 5) % Z.mobs.length];
    const swarm = windIs('swarm') ? 1.3 : 1, few = kind === 'waves' || kind === 'boss' ? 0.5 : 1;
    NC.MAPS[mid] = {
      name: `รากต้นไม้มืด ชั้น ${f}`, lvText: `${Z.name} · Lv ${lv}–${Math.min(99, lv + 2)}${boss ? ' · บอส' : ''}`, parent: 'camp',
      W: 3800, H: 3000, seed: w * 977 + f * 31 + 7,
      dungeon: { theme: Z.theme, rooms: kind === 'waves' ? 7 : 9, room: [240, 420], tunnel: 200, loops: 0.3, chests: f % 5 === 0 ? 2 : 1, traps: 2 + Math.floor(f / 25),
        chest: f >= 60 ? 'chest_gold' : 'chest_iron', boss: !!boss, bossChest: !!boss, pools: Z.pools || 0 },
      lv: Object.assign({ slime: [lv, lv + 1], hollow: [lv + 1, Math.min(99, lv + 2)], chest_wood: [lv, lv], chest_iron: [lv, lv], chest_gold: [lv, lv] }, boss ? { [boss]: [Math.min(99, lv + 2), Math.min(99, lv + 2)] } : {}), // (the level cap: 99)
      spawns: [['slime', Math.round(10 * swarm * few)], ['hollow', Math.round(11 * swarm * few)]], bosses: boss ? [[boss]] : undefined,
      dungeonFloor: true, secret: true, noWorldMap: true, root: { f, rid: id, kind },
    };
    NC.ROSTER[mid] = { '*': { slime: [[pick(0), 1], [pick(1), 1]], hollow: [[pick(2), 2], [pick(3), 1]] } };
    return mid;
  }
  // the old runs' floors are forgotten when a new one starts
  function forgetFloors(keep) {
    for (const id of Object.keys(NC.MAPS)) { const q = parseFloor(id); if (q && q.rid !== keep) { delete NC.MAPS[id]; delete NC.ROSTER[id]; } }
  }

  // the floor's world: the root's own stairs (sealed until the goal is done), the cold campfires, the dark
  const baseField = NC.buildField;
  NC.buildField = function (def) {
    const R = def && def.root;
    if (!R) return baseField.apply(this, arguments);
    const next = R.f < FLOORS ? defineFloor(R.f + 1, R.rid) : null;
    const warps = [{ id: 'out', to: 'camp', place: 'entrance' }];
    warps.push(next ? { id: 'down', to: next, at: 'up', place: 'deep' } : { id: 'down', to: 'camp', place: 'deep' });
    const w = baseField.call(this, Object.assign({}, def, { warps }));
    decorate(w, def);
    return w;
  };
  function nearOpen(w, x, y, r) {
    for (let d = 0; d < 420; d += 24)
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, X = x + Math.cos(a) * d, Y = y + Math.sin(a) * d * 0.7; if (w.fits(X, Y, r)) return [Math.round(X), Math.round(Y)]; }
    return null;
  }
  function decorate(w, def) {
    const R = def.root, Z = zoneOf(R.f);
    w.root = R;
    for (const p of w.props) {
      if (p.name === 'd_stairs_down') { if (NC.SPR.rt_sealed) p.name = 'rt_sealed'; w.rootStairs = p; }
      else if (p.name === 'd_stairs_up' && NC.SPR.rt_up) p.name = 'rt_up';
    }
    // the stairs' own light stays off while they are sealed
    if (w.rootStairs) w.rootStairsLight = w.lights.find((l) => l.owner === w.rootStairs) || null;
    // the cold campfires: in three rooms far from the way in and from each other
    if (R.kind === 'fires') {
      const ent = w.spawn, rooms = (w.rooms || []).filter((q) => q.role === 'room').sort((a, b) => Math.hypot(b.x - ent.x, b.y - ent.y) - Math.hypot(a.x - ent.x, a.y - ent.y));
      w.rootFires = [];
      for (const q of rooms) {
        if (w.rootFires.length >= 3) break;
        if (w.rootFires.some((o) => Math.hypot(o.x - q.x, o.y - q.y) < 700)) continue;
        const at = nearOpen(w, q.x, q.y, 60);
        if (!at) continue;
        const prop = { kind: 'prop', name: NC.SPR.rt_fire_off ? 'rt_fire_off' : 'dc_camp', x: at[0], y: at[1], scale: 1, flip: false, sort: at[1], shadow: [60, 16] };
        w.props.push(prop);
        w.rootFires.push({ x: at[0], y: at[1], prop, lit: false, t: 0, called: false });
      }
    }
    // the dark floor (and the fog week): the hero's light shrinks
    const hl = w.heroLight || [380, '255,220,170'];
    const k = (R.kind === 'dark' ? 0.5 : 1) * (windIs('fog') ? 0.65 : 1);
    if (k < 1) w.heroLight = [Math.round(hl[0] * k), hl[1]];
    if (R.kind === 'dark') { const a = Z.paint.ambient; w.ambient = () => [a[0] * 0.55, a[1] * 0.55, a[2] * 0.6]; }
  }

  // the camp's root gate (the meeting field's north-west corner) ------------------------------------------
  const GATE = { x: 2560, y: 3760 };
  const baseWorld = NC.buildWorld;
  NC.buildWorld = function () {
    const w = baseWorld.apply(this, arguments);
    if (!w || !w.shop) return w; // (the camp only)
    const s = NC.SPR.rt_gate, gw = s ? s.w : 400;
    const inBox = (x, y) => Math.abs(x - GATE.x) < gw * 0.75 && y > GATE.y - 330 && y < GATE.y + 140;
    w.props = w.props.filter((q) => !(inBox(q.x, q.y) && q.name !== 'camp_fire'));
    if (s) {
      const prop = { kind: 'prop', name: 'rt_gate', x: GATE.x, y: GATE.y, scale: 1, flip: false, sort: GATE.y, shadow: [gw * 0.42, 30], canopy: { x0: GATE.x - gw * 0.48, x1: GATE.x + gw * 0.48, y0: GATE.y - s.h, y1: GATE.y - 60 } };
      w.props.push(prop);
      // its two sides are solid; the dark hole between them is where you stand to go down
      const mark = (cx, cy, rx, ry) => {
        for (let gy = Math.floor((cy - ry) / w.CELL); gy <= (cy + ry) / w.CELL; gy++)
          for (let gx = Math.floor((cx - rx) / w.CELL); gx <= (cx + rx) / w.CELL; gx++) {
            if (gx < 0 || gy < 0 || gx >= w.GW || gy >= w.GH) continue;
            const nx = (gx * w.CELL + w.CELL / 2 - cx) / rx, ny = (gy * w.CELL + w.CELL / 2 - cy) / ry;
            if (nx * nx + ny * ny <= 1) w.solid[gy * w.GW + gx] = 1;
          }
      };
      mark(GATE.x - gw * 0.3, GATE.y - 24, gw * 0.17, 40); mark(GATE.x + gw * 0.3, GATE.y - 24, gw * 0.17, 40);
      // (a faint violet breath out of the hole: not a lamp, the camp's fire stays its only real light)
      w.lights.push({ x: GATE.x, y: GATE.y - 60, r: 190, rgb: '160,100,255', flick: 3, owner: prop });
    }
    w.rootGate = GATE;
    return w;
  };
  const nearGate = (game) => game.mapId === 'camp' && game.player && game.player.dead <= 0 && NC.dist(game.player.x, game.player.y, GATE.x, GATE.y + 30) < 300;

  // ---------------- starting, following, ending a run ----------------
  function startRun(game, f, mode, id) {
    const p = game.player;
    if (!p || p.dead > 0) return false;
    roll();
    f = Math.max(1, Math.min(FLOORS, f | 0));
    if (NC.Auto && NC.Auto.on) NC.Auto.toggle(game);
    const pn = NC.PartyNet;
    const party = mode === 'party' && pn && pn.pid && pn.pid();
    run = { id: id || rid(), mode: party ? 'party' : 'solo', start: f, floor: f, deaths: 0, out: null, total: 0, lead: party ? pn.roster().lead : null };
    forgetFloors(run.id);
    st.runs = (st.runs | 0) + 1; save();
    lobby.ready = false;
    NC.HUD.panel('rootlobby', false); game.paused = false;
    NC.Maps.go(game, defineFloor(f, run.id));
    NC.HUD.log(`ลงไปในรากต้นไม้มืด · เริ่มชั้น ${f}${run.mode === 'party' ? ' (ปาร์ตี้)' : ''}`, 'level');
    return true;
  }
  function endRun(game, why) {
    if (!run) return;
    const r = run;
    run = null; fl = null;
    hud(false);
    if (why === 'dead') NC.HUD.log(`หมดแรงในราก · รอบนี้จบที่ชั้น ${r.floor}`, 'warn');
    else if (why === 'out') NC.HUD.log(`ออกจากรากต้นไม้มืด · ลึกสุดรอบนี้ ชั้น ${r.best || r.start - 1 || 0}`, 'sys');
    else if (why === 'top') NC.HUD.log('ผ่านหัวใจต้นไม้มืดแล้ว! ขึ้นจากราก', 'level');
    push();
  }

  // ---------------- what goes on each floor ----------------
  const isLead = () => !!(run && run.mode === 'party' && NC.PartyNet && NC.PartyNet.isLeader && NC.PartyNet.isLeader());
  function others() { // the party's members in this run (their presence): [{ r, rt }]
    const out = [];
    if (!run || run.mode !== 'party' || !NC.Net || !NC.PartyNet) return out;
    const mem = NC.PartyNet.members ? NC.PartyNet.members() : [];
    for (const peer of mem) {
      const r = NC.Net.remotes.get(peer);
      if (r && r.rt && r.rt[0] === run.id) out.push({ r, rt: r.rt, peer });
    }
    return out;
  }
  // the party's size in this run: me, the members in it, and the ones who said READY (they are on their way in)
  function partyN() {
    if (!run || run.mode !== 'party' || !NC.Net || !NC.PartyNet) return 1;
    let n = 1;
    for (const peer of NC.PartyNet.members ? NC.PartyNet.members() : []) {
      if (peer === NC.Net.me()) continue;
      const r = NC.Net.remotes.get(peer);
      if (r && r.rt && (r.rt[0] === run.id || r.rt[7] === 1)) n++;
    }
    return Math.min(4, n);
  }
  function startFloor(game) {
    const q = parseFloor(game.mapId), f = q.f, w = game.world, kind = goalOf(f), n = partyN();
    fl = { f, kind, n, need: needOf(f, n), t: 0, mine: 0, stage: 0, fires: 0, bossDmg: 0, pool: 0, done: false, dead: false, waveT: 2.5, waveOn: false, deadSeen: false };
    run.floor = f;
    st.seen = Math.max(st.seen | 0, f);
    const Z = zoneOf(f), lv = LV(f);
    // the specials, spawned now in my world (a party member's world has its own)
    const far = SV() ? [] : farSpots(w, kind === 'elite' ? 2 + Math.max(0, n - 1) : kind === 'keys' ? 3 + Math.max(0, n - 1) : 0); // (online: the server's)
    far.forEach(([x, y], i) => {
      const type = Z.mobs[(i * 3 + f) % Z.mobs.length];
      const e = NC.makeEnemy(type, x, y, lv + 1);
      if (!e) return;
      if (kind === 'elite') {
        e.elite = true; e.rootTag = 'elite'; e.rootScale = 1.4; e.r = Math.round(e.r * 1.3);
        e.maxHp = Math.round(e.maxHp * 5); e.hp = e.maxHp; e.atk = e.atk.map((v) => Math.round(v * 1.35)); e.exp *= 4; e.jexp *= 4;
        e.name = 'หัวหน้า' + e.name;
        // its guards
        for (let k = 0; k < 2; k++) { const g2 = NC.makeEnemy(Z.mobs[(i + k + 1) % Z.mobs.length], x + (k ? 90 : -90), y + 40, lv); if (g2) game.enemies.push(g2); }
      } else {
        e.rootTag = 'key'; e.maxHp = Math.round(e.maxHp * 2.2); e.hp = e.maxHp; e.exp *= 2; e.jexp *= 2;
        e.name += ' (กลืนแก่นราก)';
      }
      game.enemies.push(e);
    });
    if (kind === 'boss' && !SV()) {
      const b = game.enemies.find((e) => e.type === Z.boss);
      if (b) {
        b.rootTag = 'boss'; b.name = 'เงาราก ' + b.name;
        fl.poolBase = b.maxHp;
        fl.pool = Math.round(b.maxHp * (1 + 0.85 * (n - 1)));
        b.maxHp = fl.pool; b.hp = fl.pool;
      }
    }
    if (!SV()) game.enemies = game.enemies.filter((e) => !(isChest(e) && chestDone(f, e))); // (this week's chests already opened)
    if (game.mapId && w.rootStairs) sealStairs(w, true);
    const I = floorInfo(f, n);
    NC.HUD.log(`ชั้น ${f} · ${Z.name} · ${I.text}`, 'level');
    hud(true);
  }
  function farSpots(w, n) {
    if (!n) return [];
    const ent = w.spawn, rooms = (w.rooms || []).filter((q) => q.role === 'room').sort((a, b) => Math.hypot(b.x - ent.x, b.y - ent.y) - Math.hypot(a.x - ent.x, a.y - ent.y));
    const out = [];
    for (let i = 0; out.length < n && i < rooms.length * 3; i++) {
      const q = rooms[i % rooms.length], a = (i / 3) * 2.1;
      const at = nearOpen(w, q.x + Math.cos(a) * q.rx * 0.3, q.y + Math.sin(a) * q.ry * 0.3, 40);
      if (at && !out.some(([x, y]) => Math.hypot(x - at[0], y - at[1]) < 200)) out.push(at);
    }
    return out;
  }
  function sealStairs(w, on) {
    const p = w.rootStairs;
    if (!p) return;
    if (NC.SPR.rt_sealed && NC.SPR.rt_down) p.name = on ? 'rt_sealed' : 'rt_down';
    if (w.rootStairsLight) w.rootStairsLight.rgb = on ? '170,110,255' : '255,236,190';
  }
  // the goal's count: mine + the others' on this floor of this run
  function partSum() {
    let have = fl.mine;
    for (const o of others()) if (o.rt[1] === fl.f && o.rt[2] === fl.stage) have += o.rt[3];
    return have;
  }
  function firesLit() {
    let m = fl.fires;
    for (const o of others()) if (o.rt[1] === fl.f) m |= o.rt[4];
    return m;
  }
  const bits = (m) => { let n = 0; for (; m; m &= m - 1) n++; return n; };
  function othersDone() { return others().some((o) => o.rt[1] === fl.f && o.rt[9] === 1); }
  function progress() { // [have, need] for the HUD
    if (!fl) return [0, 0];
    const sr = SV() && SV().run;
    if (sr && sr.floor === fl.f) { // (online: the server's count)
      if (sr.done) return [Math.max(1, sr.need | 0), Math.max(1, sr.need | 0)];
      if (fl.kind === 'fires') return [bits(sr.fireMask | 0), sr.need | 0];
      if (fl.kind === 'waves') return [sr.stage | 0, sr.need | 0];
      if (fl.kind === 'boss') return [0, 1];
      return [Math.min(sr.need | 0, sr.have | 0), sr.need | 0];
    }
    switch (fl.kind) {
      case 'fires': return [bits(firesLit()), fl.need];
      case 'waves': return [fl.stage, fl.need];
      case 'boss': return [fl.done ? 1 : 0, 1];
      default: return [Math.min(fl.need, partSum()), fl.need];
    }
  }

  // ---------------- the tick ----------------
  let lastMap = null;
  // (online this tick stays on: js/online/world.js turns the hero's other skill ticks off; here everything that counts
  // reads the server's numbers through SV())
  const rootTick = (game, p, dt) => {
    const q = parseFloor(game.mapId);
    if (game.mapId !== lastMap) {
      const was = lastMap;
      lastMap = game.mapId;
      if (q && run && q.rid === run.id) startFloor(game);
      else if (q && (!run || q.rid !== run.id)) { // (a stale map, or a run that was replaced on the way: this floor's run, solo)
        run = { id: q.rid, mode: 'solo', start: q.f, floor: q.f, deaths: 0, out: null, total: 0 };
        startFloor(game);
      } else if (!q && run) {
        endRun(game, run.out || 'out');
        if (game.mapId === 'camp' && parseFloor(was)) { p.x = GATE.x; p.y = GATE.y + 110; }
      } else if (!q && game.mapId === 'camp' && parseFloor(was)) { p.x = GATE.x; p.y = GATE.y + 110; }
    }
    if (!q || !run || !fl) return;
    if (NC.Auto && NC.Auto.on) { NC.Auto.toggle(game); NC.HUD.log('ในรากต้นไม้มืดต้องเล่นเอง (ออโต้ฟาร์มปิด)', 'warn'); }
    // back on the feet after a fall (heroFell, below): solo, or the party out of revives, ends the run
    if (p.dead <= 0 && fl.deadSeen) {
      fl.deadSeen = false;
      if (run.out === 'dead') { const g = game; endRun(g, 'dead'); NC.Maps.go(g, 'camp'); return; }
    }
    if (!fl.done) fl.t += dt;
    if (!SV()) keepChestsShut(game);
    // the stairs down stay shut (their warp held back) until the goal is done
    const di = game.portals.findIndex((pt) => pt.id === 'down');
    if (!fl.done) { if (di >= 0) fl.held = game.portals.splice(di, 1)[0]; }
    else if (fl.held) { game.portals.push(fl.held); fl.held = null; }
    const w = game.world;
    switch (fl.kind) {
      case 'fires': tickFires(game, p, dt, w); break;
      case 'waves': tickWaves(game, p, dt, w); break;
      case 'boss': tickBoss(game); break;
      default: break;
    }
    if (!SV()) { fl.n = partyN(); fl.need = needOf(fl.f, fl.n); }
    if (!fl.done) {
      const [have, need] = progress();
      if (have >= need || othersDone()) clearFloor(game);
    } else if (windIs('ember') && w.rootFires) {
      // (the warm week: a lit fire heals whoever stands by it)
    }
    // the warm week: a lit campfire heals (online: the server's, backend rootWarmth)
    if (!SV() && windIs('ember') && w.rootFires) for (const o of w.rootFires) if (o.lit && NC.dist(p.x, p.y, o.x, o.y) < 220 && p.dead <= 0) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.04 * dt); p.sp = Math.min(p.maxSp, p.sp + p.maxSp * 0.04 * dt); }
    if (!SV() && w.rootRest && p.dead <= 0 && NC.dist(p.x, p.y, w.rootRest.x, w.rootRest.y) < 240) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.1 * dt); p.sp = Math.min(p.maxSp, p.sp + p.maxSp * 0.1 * dt); }
    hudTick();
  };
  rootTick.online = true;
  NC.skillTicks.push(rootTick);
  // the hero falls (the skill ticks stop while the hero is down: caught where the blow lands)
  function heroFell(game) {
    if (SV() || !run || !fl || !onRoot(game) || fl.deadSeen) return;
    fl.deadSeen = true; run.deaths++;
    if (run.mode === 'solo') run.out = 'dead';
    else if (deathsAll() > REVIVES) { run.out = 'dead'; NC.HUD.log(`ปาร์ตี้ใช้การฟื้นครบ ${REVIVES} ครั้งแล้ว · คุณออกจากรอบนี้`, 'warn'); }
    else NC.HUD.log(`หมดแรง · ฟื้นที่ทางเข้าชั้น (ปาร์ตี้ฟื้นได้อีก ${Math.max(0, REVIVES - deathsAll())} ครั้ง)`, 'warn');
    hudTick(true);
  }
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game) {
    const p = game && game.player, was = p ? p.dead : 1, r = baseHurt.apply(this, arguments);
    if (p && was <= 0 && p.dead > 0) heroFell(game);
    return r;
  };
  const deathsAll = () => (run ? run.deaths + others().reduce((s, o) => s + (o.rt[6] | 0), 0) : 0);

  // the chests: each pays a hero once a week and never comes back in the roots (the user, 2026-10-19: "กล่องเกิดรัวๆ
  // คนสามารถปั้มกล่อง"). Every run builds its floors anew with the week's same chests (the same seed), so a chest is known
  // by its floor and place; online the server keeps the same rule (backend patch 007, darkroot_rewards.go rootChestOnce)
  const isChest = (e) => !!(NC.DUNGEON_CHESTS && e && NC.DUNGEON_CHESTS[e.type]);
  const chestKey = (f, e) => `${f}:${Math.round(e.sx)},${Math.round(e.sy)}`;
  const chestDone = (f, e) => !!(st.chest && st.chest.w === weekNo() && st.chest.k[chestKey(f, e)]);
  function chestOpened(f, e) {
    if (!st.chest || st.chest.w !== weekNo()) st.chest = { w: weekNo(), k: {} };
    st.chest.k[chestKey(f, e)] = 1;
    save();
  }
  function keepChestsShut(game) { // (js/dungeons.js brings a broken chest back after its time: never in the roots)
    const cd = NC.Dungeons && NC.Dungeons.chestCd;
    if (!cd || !st.chest || st.chest.w !== weekNo()) return;
    const f = fl.f, pre = game.mapId + ':';
    for (const [type, x, y] of (game.world && game.world.spawns) || []) {
      if (!NC.DUNGEON_CHESTS || !NC.DUNGEON_CHESTS[type] || !st.chest.k[chestKey(f, { sx: x, sy: y })]) continue;
      if (cd[pre + x + ',' + y] !== Infinity) cd[pre + x + ',' + y] = Infinity;
    }
  }

  // the cold campfires: stand by one for 3.5 s; lighting it wakes a pack round it
  const LIGHT_S = 3.5;
  function tickFires(game, p, dt, w) {
    const all = firesLit(), Z = zoneOf(fl.f), lv = LV(fl.f);
    (w.rootFires || []).forEach((o, i) => {
      const lit = !!(all & (1 << i));
      if (lit && !o.lit) light(w, o);
      if (lit) return;
      const near = p.dead <= 0 && NC.dist(p.x, p.y, o.x, o.y) < 130;
      if (near && !o.called && !SV()) { // the roots hear it: a pack comes (online: the server's pack)
        o.called = true;
        const k = 3 + Math.floor(Z.i / 3) + (windIs('swarm') ? 1 : 0);
        for (let j = 0; j < k; j++) {
          const a = (j / k) * TAU + 0.4, at = nearOpen(w, o.x + Math.cos(a) * 420, o.y + Math.sin(a) * 300, 30);
          if (!at) continue;
          const e = NC.makeEnemy(Z.mobs[(j * 5 + fl.f) % Z.mobs.length], at[0], at[1], lv);
          if (e) { e.rootTag = 'pack'; e.state = 'chase'; game.enemies.push(e); }
        }
        NC.HUD.log('รากได้ยินเสียง · มอนกำลังมาที่กองไฟ!', 'warn');
      }
      o.t = near ? o.t + dt : Math.max(0, o.t - dt * 2);
      if (o.t >= LIGHT_S && !SV()) { fl.fires |= 1 << i; light(w, o); NC.HUD.log(`จุดกองไฟได้ ${bits(firesLit())}/${fl.need}`, 'item'); }
    });
  }
  function light(w, o) {
    o.lit = true; o.t = LIGHT_S;
    if (NC.SPR.rt_fire_on) o.prop.name = 'rt_fire_on';
    w.lights.push({ x: o.x, y: o.y - 50, r: 380, rgb: '255,190,110', flick: Math.random() * 10, owner: o.prop });
    if (FX.ring) FX.ring(o.x, o.y - 30, 20, 220, '255,200,120', 0.7);
    if (FX.puff) FX.puff(o.x, o.y - 60, 10, { speed: 90, rise: 80, color: '255,190,110' });
  }
  // the waves: each comes round the hero once the last one is down (a party's members each get their own, and the
  // wave falls when the party's count reaches its size x partyK)
  function tickWaves(game, p, dt, w) {
    if (SV() || fl.stage >= fl.need) return; // (online: the server's waves)
    const size = waveSize(fl.f), want = Math.ceil(size * partyK(fl.n));
    if (!fl.waveOn) { if ((fl.waveT -= dt) <= 0) { fl.waveOn = true; spawnWave(game, p, w, size, true); } return; }
    const have = partSum();
    if (have >= want) { // this wave is down (the party's part counted)
      fl.stage++; fl.mine = 0; fl.waveOn = false; fl.waveT = 3;
      if (fl.stage < fl.need) NC.HUD.log(`ผ่านระลอก ${fl.stage}/${fl.need} · ระลอกต่อไปกำลังมา`, 'level');
      for (const e of game.enemies) if (e.rootTag === 'wave') e.rootTag = 'pack';
    } else if (!game.enemies.some((e) => e.rootTag === 'wave' && !e.dead)) {
      // (mine are all down but the party's count is short: a few more come)
      if ((fl.waveT -= dt) <= -1.5) { fl.waveT = 0; spawnWave(game, p, w, Math.min(3, want - have), false); }
    }
  }
  function spawnWave(game, p, w, n, loud) {
    const Z = zoneOf(fl.f), lv = LV(fl.f);
    let made = 0;
    for (let j = 0, tries = 0; made < n && tries < n * 4; tries++, j++) {
      const a = (j / n) * TAU + fl.stage + tries * 0.37, d = tries < n ? 560 : 360;
      const at = nearOpen(w, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.72, 30);
      if (!at) continue;
      const e = NC.makeEnemy(Z.mobs[(j * 3 + fl.stage * 2 + fl.f) % Z.mobs.length], at[0], at[1], lv + (fl.stage >= 2 ? 1 : 0));
      if (e) { e.rootTag = 'wave'; e.state = 'chase'; game.enemies.push(e); made++; }
    }
    if (loud) {
      if (FX.ring) FX.ring(p.x, p.y, 40, 520, '170,110,255', 0.6);
      NC.HUD.log(`ระลอก ${fl.stage + 1}/${fl.need} บุกเข้ามา!`, 'warn');
    }
  }
  // the boss: one HP pool for the party (each member's copy shows what is left)
  function tickBoss(game) {
    if (SV() || fl.done || run.mode !== 'party') return;
    const e = game.enemies.find((x) => x.rootTag === 'boss' && !x.dead);
    if (!e || !fl.pool) return;
    // (members still walking in make the pool bigger; it never shrinks under what was already dealt)
    const pool = Math.round(fl.poolBase * (1 + 0.85 * (fl.n - 1)));
    if (pool > fl.pool) { e.hp += pool - fl.pool; fl.pool = pool; e.maxHp = pool; }
    let total = fl.bossDmg;
    for (const o of others()) if (o.rt[1] === fl.f) total += o.rt[5] | 0;
    if (total >= fl.pool) {
      if (fl.bossDmg > 0) { e._heroT = game.time; NC.damageEnemy(game, e, { dmg: e.hp + 1, mod: 1 }, 0, 0); }
      else { e.dead = true; e.hp = 0; }
      return;
    }
    e.hp = Math.max(1, Math.min(e.hp, fl.pool - total));
  }

  // kills: the goal counts, the specials never come back
  NC.skillKills.push((game, e) => {
    if (!fl || !onRoot(game)) return;
    if (e.rootTag || e.elite) for (let i = game.respawns.length - 1; i >= 0; i--) { const r = game.respawns[i]; if (r.type === e.type && r.x === e.sx && r.y === e.sy) { game.respawns.splice(i, 1); break; } }
    if (/^chest_/.test(e.type || '')) { if (!SV()) chestOpened(fl.f, e); return; }
    switch (fl.kind) {
      case 'hunt': case 'dark': fl.mine++; break;
      case 'elite': if (e.rootTag === 'elite') { fl.mine++; NC.HUD.log(`ล้มหัวหน้าแล้ว ${Math.min(fl.need, partSum())}/${fl.need}`, 'item'); } break;
      case 'keys': if (e.rootTag === 'key') { fl.mine++; NC.HUD.log(`ได้แก่นราก ${Math.min(fl.need, partSum())}/${fl.need}`, 'item'); if (FX.stars) FX.stars(e.x, e.y - 60, 10, '255,220,120', { speed: 200 }); } break;
      case 'waves': if (e.rootTag === 'wave') fl.mine++; break;
      case 'boss': if (e.rootTag === 'boss' && !fl.done) clearFloor(game); break;
      default: break;
    }
    if (windIs('stars') && (e.rootTag === 'elite' || e.rootTag === 'boss') && seedOk(game, fl.f)) { NC.addMat(game, 'mat_rootseed', 1); NC.HUD.log('ดาวตกในราก · เมล็ดราก +1', 'item'); }
  });
  // my damage to the boss (the party's pool)
  const baseDmg = NC.damageEnemy;
  NC.damageEnemy = function (game, e) {
    if (!e || e.rootTag !== 'boss' || !fl) return baseDmg.apply(this, arguments);
    const was = e.hp, res = baseDmg.apply(this, arguments);
    fl.bossDmg += Math.max(0, was - Math.max(0, e.hp));
    return res;
  };

  // the floor is done: the time, the records, the rewards, the stairs open
  const seedOk = (game, f) => LV(f) >= game.player.lv - SEED_GAP;
  function clearFloor(game) {
    if (fl.done) return;
    fl.done = true;
    const f = fl.f, t = Math.round(fl.t * 10) / 10, p = game.player, w = game.world;
    run.total += t; run.best = Math.max(run.best || 0, f);
    const sv = !!SV(); // (online: the server keeps the records and pays; only the look of it here)
    roll();
    // the records: solo runs fill my boards; a party's goes to the party's record
    if (sv) { /* (the server's) */ } else if (run.mode === 'solo') { recordFloor(st.s, f, t); recordFloor(st.w, f, t); recordFloor(st.a, f, t); }
    else partyRecord(f, t);
    // rewards (a party's members each get their own)
    const lines = [];
    if (!sv && !st.first.s[f]) {
      st.first.s[f] = 1;
      const c = firstCoins(f); p.coins += c; if (NC.Econ) NC.Econ.faucet('root', c); lines.push(`${fmt(c)} เหรียญ`);
      if (f % 5 === 0) { NC.addMat(game, 'mat_opt_stone', 1); lines.push('หินออฟ'); }
      if (f === 50 || f === FLOORS) { NC.addMat(game, 'mat_drill_stone', 1); lines.push('หินเจาะออฟ'); }
      if (f === FLOORS && !st.frames.includes('heart')) { st.frames.push('heart'); lines.push('กรอบ "หัวใจราก"'); }
    }
    if (!sv && !st.first.w[f] && seedOk(game, f)) { st.first.w[f] = 1; const n = f % 10 === 0 ? 3 : 1; NC.addMat(game, 'mat_rootseed', n); lines.push(`เมล็ดราก ${n}`); }
    if (f % 10 === 0) {
      if (!sv) st.cp = Math.max(st.cp, Math.min(FLOORS, f + 1));
      // the campfire after the boss: the checkpoint (rest by it)
      const at = w.rootStairs ? nearOpen(w, w.rootStairs.x - 200, w.rootStairs.y + 60, 50) : null;
      if (at && NC.SPR.rt_fire_on) {
        const prop = { kind: 'prop', name: 'rt_fire_on', x: at[0], y: at[1], scale: 1, flip: false, sort: at[1], shadow: [60, 16] };
        w.props.push(prop); w.lights.push({ x: at[0], y: at[1] - 50, r: 420, rgb: '255,190,110', flick: 1, owner: prop });
        w.rootRest = { x: at[0], y: at[1] };
      }
      if (f < FLOORS) lines.push(`จุดเซฟ: เริ่มรอบใหม่ที่ชั้น ${f + 1} ได้`);
    }
    save();
    sealStairs(w, false);
    if (FX.ring && w.rootStairs) FX.ring(w.rootStairs.x, w.rootStairs.y, 30, 300, '255,236,190', 0.8);
    const tt = clock(t);
    NC.HUD.log(`ผ่านชั้น ${f} ใน ${tt}!${lines.length ? ' · ' + lines.join(' · ') : ''}`, 'level');
    game.toast(f === FLOORS ? 'ผ่านหัวใจต้นไม้มืดแล้ว!' : `ผ่านชั้น ${f} · บันไดลงเปิดแล้ว`);
    if (f === FLOORS) run.out = 'top';
    push();
    hudTick(true);
  }
  // the party's record: the members' ids from their presence; the leader (or, without them, the first one) writes
  function partyRecord(f, t) {
    const me = { id: uid, name: clean(G().player.name, 16), job: G().player.job, line: LINE_OF(G().player.job), lv: G().player.lv, eq: SLOTS.map((s) => G().player.equip[s] || null) };
    const list = [me].concat(others().map((o) => ({ id: o.r.ud || null, name: o.r.name, job: o.r.job, line: LINE_OF(o.r.job), lv: o.r.lv, eq: SLOTS.map((s) => (o.r.equip || {})[s] || null), peer: o.peer })));
    const ids = list.map((m) => m.id).filter(Boolean);
    if (ids.length < 2) return;
    const lead = NC.PartyNet && NC.PartyNet.roster ? (NC.PartyNet.roster() || {}).lead : null;
    const leadIn = lead && (lead === NC.Net.me() || list.some((m) => m.peer === lead));
    const writer = leadIn ? lead : [NC.Net.me()].concat(list.slice(1).map((m) => m.peer)).sort()[0];
    if (writer !== NC.Net.me()) return;
    // the leader first in the list
    list.sort((a, b) => (a.peer === lead || (!a.peer && lead === NC.Net.me()) ? -1 : b.peer === lead || (!b.peer && lead === NC.Net.me()) ? 1 : 0));
    const key = partyKey(ids);
    pushParty(key, list.map(({ name, job, line, lv, eq }) => ({ name, job, line, lv, eq })), f, t);
  }

  // ---------------- the monsters of the roots ----------------
  const baseMake = NC.makeEnemy;
  NC.makeEnemy = function (type, x, y, lv) {
    const e = baseMake.apply(this, arguments), g = G(), q = g && parseFloor(g.mapId || (g.world && g.world.mapId));
    if (e && q) {
      let hp = 1.15 + (run && run.mode === 'party' ? 0.15 * (partyN() - 1) : 0);
      if (windIs('hunger')) hp *= 1.2;
      e.maxHp = Math.round(e.maxHp * hp); e.hp = e.maxHp;
      const atk = 1.06 * (windIs('blood') ? 1.15 : 1);
      if (Array.isArray(e.atk)) e.atk = e.atk.map((v) => Math.round(v * atk));
      e.rootF = q.f;
    }
    return e;
  };
  (NC.xpFilters || (NC.xpFilters = [])).push((game, n, jn) => {
    if (windIs('swarm') && onRoot(game)) { n *= 1.2; jn *= 1.2; }
    return [n, jn];
  });
  NC.skillModSources.push((p) => (p && p.kind === 'player' && windIs('silence') && onRoot() ? { atk: 10, matk: 10, taken: -10 } : null));
  // an elite is drawn bigger (round its feet) and its name tag rides higher
  const baseDrawE = NC.drawEnemy;
  NC.drawEnemy = function (ctx, game, e) {
    if (!e || !e.rootScale) return baseDrawE.apply(this, arguments);
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.rootScale, e.rootScale); ctx.translate(-e.x, -e.y);
    try { return baseDrawE.apply(this, arguments); } finally { ctx.restore(); }
  };
  const baseTop = NC.labelTop;
  NC.labelTop = function (e) { const t = baseTop.apply(this, arguments); return e && e.rootScale ? e.y - (e.y - t) * e.rootScale : t; };
  // the auto farm stays outside (the boards are for heroes who play)
  if (NC.Auto && NC.Auto.toggle) {
    const baseToggle = NC.Auto.toggle;
    NC.Auto.toggle = function (game) {
      if (!NC.Auto.on && game && onRoot(game)) { game.toast('ในรากต้นไม้มืดต้องเล่นเอง'); return; }
      return baseToggle.apply(this, arguments);
    };
  }

  // ---------------- the Root Seed (a material) ----------------
  const MAT = NC.MATERIALS;
  if (MAT) {
    MAT.mat_rootseed = { name: 'เมล็ดราก', price: 0, rare: true, keep: true, noNpc: true, desc: 'เมล็ดสีดำมีรอยแตกเรืองม่วงจากรากต้นไม้มืด ใช้แลกของที่หน้าประตูราก' };
    const baseIcon = NC.matIcon;
    NC.matIcon = (id) => (id === 'mat_rootseed' && NC.ASSET_MANIFEST.rt_seed ? NC.ASSET_MANIFEST.rt_seed.src : baseIcon(id));
    const baseSource = NC.matSource;
    NC.matSource = (id) => (id === 'mat_rootseed' ? 'รากต้นไม้มืด: ผ่านชั้นครั้งแรกของสัปดาห์' : baseSource(id));
  }

  // ======================================================================================================
  // ---------------- the party online: what I tell the others ----------------
  // rt: [run id, floor, stage, my part, fires I lit (bits), my boss damage, my deaths, ready, lobby floor, done]
  const lobby = { ready: false, floor: 1, mode: 'solo' };
  if (NC.Net) {
    NC.Net.fields.push({ key: 'rt', get: () => {
      if (run && fl) return [run.id, fl.f, fl.stage, Math.round(fl.mine), fl.fires, Math.round(fl.bossDmg), run.deaths, 0, 0, fl.done ? 1 : 0];
      if (run) return [run.id, run.floor, 0, 0, 0, 0, run.deaths, 0, 0, 0];
      if (lobby.ready) return ['', 0, 0, 0, 0, 0, 0, 1, lobby.floor, 0];
      return null;
    } });
    NC.Net.hooks.push((r, pr) => {
      const a = pr && pr.rt;
      if (!Array.isArray(a) || a.length < 10) { r.rt = null; return; }
      const id = typeof a[0] === 'string' && /^[a-z0-9]{0,10}$/.test(a[0]) ? a[0] : '';
      const n = (i, hi) => Math.max(0, Math.min(hi, a[i] | 0));
      r.rt = [id, n(1, FLOORS), n(2, 9), n(3, 999), n(4, 7), n(5, 2e9), n(6, 99), n(7, 1), n(8, FLOORS), n(9, 1)];
      // (a member's floor this client has not made yet: made now, so their hero shows there)
      if (typeof pr.mp === 'string' && floorRe.test(pr.mp) && !NC.MAPS[pr.mp]) { const q = parseFloor(pr.mp); defineFloor(q.f, q.rid); r.map = pr.mp; }
    });
  }
  // a member follows the leader into the run (when they said READY in the lobby)
  setInterval(() => {
    const g = G(), pn = NC.PartyNet;
    if (!g || !g.player || run || !pn || !pn.pid || !pn.pid() || !NC.Net) return;
    const R = pn.roster(), lead = R && R.lead;
    if (!lead || lead === NC.Net.me()) return;
    const r = NC.Net.remotes.get(lead);
    if (!r || !r.rt || !r.rt[0]) return;
    lobby.leaderRun = { id: r.rt[0], floor: r.rt[1] };
    if (lobby.ready && g.player.dead <= 0) { NC.HUD.log(`หัวตี้พาลงรากต้นไม้มืด ชั้น ${r.rt[1]}`, 'level'); startRun(g, r.rt[1], 'party', r.rt[0]); }
  }, 700);
  function followLeader(game) {
    const L0 = lobby.leaderRun;
    if (!L0 || run) return false;
    return startRun(game, L0.floor, 'party', L0.id);
  }

  // ======================================================================================================
  // ---------------- the HUD: the floor, its goal, the clock ----------------
  let hudEl = null;
  const clock = (t) => { t = Math.max(0, t); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60); return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || (NC.SPR[k] && NC.SPR[k].img && NC.SPR[k].img.src) || (/^ic_/.test(k) ? `assets/bible/${k}.png` : ''); // (the journal's icons: assets/bible)
  function hud(on) {
    if (!hudEl) {
      hudEl = document.createElement('div');
      hudEl.id = 'rt-hud'; hudEl.hidden = true;
      (document.getElementById('hud') || document.body).appendChild(hudEl);
    }
    hudEl.hidden = !on;
    if (on) hudTick(true);
  }
  let hudSig = '';
  // (a boss floor: the boss's big HP bar (js/boss.js #bossbar) sits top centre too, so the panel moves down under it)
  function hudPlace() {
    const bb = document.getElementById('bossbar'), on = !!(bb && Number(bb.style.opacity) > 0.5);
    const top = on ? Math.round(bb.getBoundingClientRect().bottom + 10 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1)) + 'px' : '';
    if (hudEl.style.top !== top) hudEl.style.top = top;
  }
  function hudTick(force) {
    if (!hudEl || hudEl.hidden || !fl) return;
    hudPlace();
    const [have, need] = progress(), Z = zoneOf(fl.f), I = GOAL[fl.kind], wd = wind();
    const sr = SV() && SV().run, pn = sr ? (sr.members || []).length || 1 : partyN(), revLeft = SV() ? SV().revives | 0 : Math.max(0, REVIVES - deathsAll());
    const party = (sr ? sr.mode === 'party' : run.mode === 'party') ? `<div class="rt-pt">ปาร์ตี้ ${pn} คน · ฟื้นได้อีก ${revLeft} ครั้ง</div>` : '<div class="rt-pt">เดี่ยว · ตายแล้วจบรอบ</div>';
    const goal = fl.done ? (fl.f === FLOORS ? 'ผ่านหัวใจต้นไม้มืดแล้ว! เดินออกทางบันได' : 'บันไดลงเปิดแล้ว · ไปชั้นต่อไป') : `${I.name} ${have}/${need}`;
    const sig = [fl.f, goal, Math.floor(fl.t), party, fl.done, NC.Root.hudExtra ? NC.Root.hudExtra(fl) : ''].join('|');
    if (!force && sig === hudSig) return;
    hudSig = sig;
    hudEl.innerHTML = `<div class="rt-top"><b>ชั้น ${fl.f}</b><span>${Z.name}</span><i>${clock(fl.t)}</i></div>` +
      `<div class="rt-goal${fl.done ? ' done' : ''}"><img src="${icon(I.icon)}" alt=""><span>${goal}</span></div>` +
      `<div class="rt-wind">ลมสัปดาห์นี้ · ${wd.name}</div>${party}${NC.Root.hudExtra ? NC.Root.hudExtra(fl) : ''}`; // (js/rootloot.js: the blessings)
  }

  // ---------------- world-space marks: the gate's name, the fires' rings, elites and keys ----------------
  const baseLabels = NC.Maps.drawLabels;
  NC.Maps.drawLabels = function (ctx, game) {
    baseLabels.apply(this, arguments);
    const p = game.player;
    if (game.mapId === 'camp' && game.world && game.world.rootGate) {
      const d = Math.hypot(p.x - GATE.x, p.y - GATE.y);
      if (d < 1000) {
        const a = NC.clamp((1000 - d) / 300, 0, 1), y = GATE.y - ((NC.SPR.rt_gate && NC.SPR.rt_gate.h) || 400) * 0.56 + Math.sin(game.time * 2) * 4; // (over the dark hole)
        label(ctx, 'รากต้นไม้มืด · 100 ชั้น', GATE.x, y, a, '#e3c6ff', 36);
        label(ctx, nearGate(game) ? 'กด T หรือคลิกเพื่อลงไป' : 'เดี่ยว / ปาร์ตี้ · ตารางอันดับ', GATE.x, y + 36, a, '#fff4d8', 24);
      }
    }
    if (!fl || !onRoot(game)) return;
    const w = game.world;
    if (w.rootFires) {
      const all = firesLit();
      w.rootFires.forEach((o, i) => {
        if (all & (1 << i)) return;
        const d = Math.hypot(p.x - o.x, p.y - o.y);
        if (d > 1100) return;
        ctx.save();
        ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(42,36,53,0.9)';
        ctx.beginPath(); ctx.arc(o.x, o.y - 120, 34, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#ffc874'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(o.x, o.y - 120, 34, -Math.PI / 2, -Math.PI / 2 + TAU * NC.clamp(o.t / LIGHT_S, 0, 1)); ctx.stroke();
        ctx.restore();
        label(ctx, 'จุดไฟ', o.x, o.y - 172, NC.clamp((1100 - d) / 300, 0, 1), '#ffd88a', 26);
      });
    }
    for (const e of game.enemies) {
      if (e.dead || (e.rootTag !== 'elite' && e.rootTag !== 'key')) continue;
      if (Math.abs(e.x - p.x) > 1400 || Math.abs(e.y - p.y) > 1000) continue;
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(game.time * 3);
      ctx.strokeStyle = e.rootTag === 'elite' ? '#c08cff' : '#ffd36e'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.6, e.r * 0.55, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      const s = e.rootTag === 'key' ? NC.SPR.rt_seed : null; // (the root core it swallowed, floating over it)
      const top = NC.labelTop ? NC.labelTop(e) : e.y - 120;
      if (s) NC.drawSpr(ctx, 'rt_seed', e.x, top - 40 + Math.sin(game.time * 3) * 6, { scale: 0.75 });
    }
  };
  function label(ctx, text, x, y, a, fill, size) {
    ctx.save();
    ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = `600 ${size}px Mitr, sans-serif`;
    ctx.lineWidth = size / 4; ctx.strokeStyle = NC.OUTLINE; ctx.strokeText(text, x, y);
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
    ctx.restore();
  }

  // the gate: T, or a click on it
  addEventListener('keydown', (e) => {
    const g = G();
    if (e.code !== 'KeyT' || e.repeat || !g || !g.player || g.paused || !nearGate(g)) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    e.stopImmediatePropagation(); e.preventDefault();
    NC.Root.openLobby();
  }, true);
  addEventListener('mousedown', (e) => {
    const g = G();
    if (e.button !== 0 || !g || g.mapId !== 'camp' || !g.player || e.target !== document.getElementById('view')) return;
    const wx = g.cam.x + (e.clientX * g.dpr) / g.scale, wy = g.cam.y + (e.clientY * g.dpr) / g.scale;
    const s = NC.SPR.rt_gate, gw = s ? s.w : 400, gh = s ? s.h : 400;
    if (Math.abs(wx - GATE.x) > gw * 0.45 || wy < GATE.y - gh || wy > GATE.y + 20) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (nearGate(g)) NC.Root.openLobby();
    else g.toast('เดินเข้าไปใกล้ประตูรากก่อนนะ');
  }, true);

  NC.Root = {
    ZONES, WINDS, GOAL, FLOORS, REVIVES, SEED_GAP, LV, zoneOf, goalOf, floorInfo, wind, weekNo, seasonNo, clock, firstCoins,
    state: st, save, roll, lobby, push, pushParty, partyKey, boardsOf, sumTime, score, meRow, lineOf: LINE_OF, gate: GATE,
    run: () => run, floor: () => fl, startRun, followLeader, endRun, others, partyN, progress, seedOk, uid: () => uid, defineFloor, parseFloor,
    server: null, // (js/online/root.js: { run, stairs, elapsed, revives, week } while the server runs the floors)
    cpFor: (f) => Math.max(1, Math.min(st.cp, Math.floor((f - 1) / 10) * 10 + 1)),
    openLobby: () => {}, openBoard: () => {}, // (darkroot_ui.js)
  };
})();
