/* dungeons2.js — the story's dungeons (the story bible draft 8), built by dungeongen.js from the numbers here, the same
   way as js/dungeons.js's (chests, traps, the lantern in the dark, dying brings you back to the entrance):
     หอดูดาวนกฮูก 1–3 (owl1-3)       Lv 50–58   from Northpeak (the observatory on the north ridge): stone owls, hollow
                                           stargazers; Magister Vosse in the dome (floor 3, a story boss)
     หอบัญชีใต้วิหาร 1–2 (ledger1-2)  Lv 78–88   from the canal ward (the archive's iron back door): flying books,
                                           hollow lamplighters, paper blades; Brother Quill (floor 2)
     โรงหุ่นใต้วิหาร 1–2 (puppet1-2)  Lv 88–94   from the cathedral ward (the cellar under the garden pavilion): faceless
                                           puppets, wooden hands, thread binders; the puppets No. 2–6 (story bosses)
     หอระฆัง ชั้น 1–7 (bell1-7)       Lv 94–99   from the cathedral ward (the white bell tower's gate): seven short
                                           floors up, bell puppets, hollow bellringers; the Hundred-String on top (an MVP)
     หลุมดาว 1–2 (grave1-2)          Lv 97–99   from the wind cliffs' ring of standing stones: first lamplighters, living
                                           star crystals; Saint Aurel at the bottom (floor 2, a world boss in three
                                           forms, the last is Aurelion, the fallen star)
   Also the two new monster bosses (hundred_string, aurelion: js/dunbosses.js's fight) and their drops. Story bosses in
   a floor stand in its boss room ('deep') or its far rooms (js/storyboss.js). Art: assets/maps/ (do_ dl2_ dp_ db_ dg_,
   the doors de_*: assets/gen/make_map4_prompts.py) and assets/monsters/ (make_monster5_prompts.py).
   Load after dungeons.js, dunbosses.js, fields4.js and monsters5.js. */
(function () {
  'use strict';
  const NC = window.NC;
  const THEMES = NC.DUNGEON_THEMES, DB = NC.DUNGEON_BOSSES;
  if (!THEMES || !DB) return;

  // ---------------- props (fieldgen.js PROPS) ----------------
  const WARM = '255,200,130';
  Object.assign(NC.FIELD_PROPS, {
    // the observatory
    do_telescope: { kind: 'post' }, do_shelf: { kind: 'fence' }, do_orrery: { kind: 'rock', light: [0, -0.55, 220, '255,210,140'] },
    do_globe: { kind: 'rock', light: [0, -0.6, 240, '140,190,255'] }, do_owlstatue: { kind: 'tall', light: [0, -0.8, 120, '255,200,110'] },
    do_gears: { kind: 'low' }, do_papers: { kind: 'low' }, do_entrance: { kind: 'low', light: [0.3, -0.6, 240, WARM] },
    // the ledger archive
    dl2_shelf: { kind: 'tall' }, dl2_ladder: { kind: 'post' }, dl2_lamp: { kind: 'post', light: [0, -0.8, 250, '220,240,160'] },
    dl2_desk: { kind: 'rock', light: [0.2, -0.6, 120, '255,220,150'] }, dl2_stack: { kind: 'rock' }, dl2_cabinet: { kind: 'rock' },
    dl2_papers: { kind: 'low' }, dl2_entrance: { kind: 'low', light: [0.3, -0.6, 240, WARM] },
    // the puppet workshop
    dp_table: { kind: 'rock' }, dp_rack: { kind: 'tall' }, dp_strings: { kind: 'tall', light: [0, -0.5, 110, '255,90,100'] },
    dp_lamp: { kind: 'post', light: [0, -0.8, 250, '255,150,110'] }, dp_parts: { kind: 'rock' }, dp_easel: { kind: 'post' },
    dp_shavings: { kind: 'low' }, dp_entrance: { kind: 'low', light: [0.3, -0.6, 220, WARM] },
    // the bell tower
    db_bell: { kind: 'tall', light: [0, -0.4, 120, '255,210,120'] }, db_gear: { kind: 'tall' },
    db_window: { kind: 'fence', light: [0, -0.5, 260, '255,236,170'] }, db_ropes: { kind: 'tall' },
    db_brazier: { kind: 'post', light: [0, -0.8, 280, '255,245,220'] }, db_beam: { kind: 'rock' }, db_dust: { kind: 'low' },
    db_entrance: { kind: 'low', light: [0.3, -0.6, 240, WARM] },
    // the star's grave
    dg_crystal: { kind: 'tall', light: [0, -0.6, 280, '255,240,190'] }, dg_lamp: { kind: 'post', light: [0, -0.86, 260, '230,240,255'] },
    dg_shard: { kind: 'rock', light: [0, -0.5, 300, '255,236,170'] }, dg_pillar: { kind: 'tall', light: [0, -0.5, 120, '170,190,255'] },
    dg_ring: { kind: 'rock', light: [0, -0.3, 200, '200,220,255'] }, dg_bones: { kind: 'low' },
    dg_glass: { kind: 'low', light: [0, -0.2, 90, '200,220,255'] }, dg_entrance: { kind: 'house', rect: [0.7, 90], light: [0, -0.9, 260, '255,240,190'], roof: '#8a8aa0' },
  });

  // ---------------- the themes (dungeongen.js THEMES) ----------------
  Object.assign(THEMES, {
    owl: {
      floor: [96, 104, 132], floor2: [110, 118, 146], rock: [24, 28, 50], rock2: [38, 44, 70],
      face: [[128, 134, 160], [72, 78, 104]], ambient: [80, 90, 140], light: [400, '230,225,255'],
      specks: ['rgba(60,66,96,0.5)', 'rgba(200,210,255,0.4)', 'rgba(255,220,140,0.35)'], cracks: 30, tiles: true,
      wall: [['do_shelf', 1.2], ['do_telescope', 1], ['do_owlstatue', 0.8]],
      glow: [['do_globe', 1], ['do_orrery', 1]], glowEvery: 520,
      big: [['do_telescope', 1], ['do_orrery', 0.5], ['do_owlstatue', 0.5]], low: [['do_papers', 1.4], ['do_gears', 1]],
      entrance: 'do_entrance', mini: '#6a7090',
    },
    ledger: {
      floor: [120, 100, 80], floor2: [136, 114, 90], rock: [36, 28, 26], rock2: [54, 42, 36],
      face: [[146, 120, 94], [88, 70, 56]], ambient: [96, 84, 80], light: [380, '255,226,170'],
      specks: ['rgba(70,54,40,0.5)', 'rgba(230,210,160,0.4)', 'rgba(60,60,90,0.3)'], cracks: 20, tiles: true,
      wall: [['dl2_shelf', 1.6], ['dl2_cabinet', 0.8], ['dl2_ladder', 0.5]],
      glow: [['dl2_lamp', 1], ['dl2_desk', 0.8]], glowEvery: 500,
      big: [['dl2_stack', 1], ['dl2_desk', 0.8], ['dl2_cabinet', 0.5]], low: [['dl2_papers', 1.6]],
      entrance: 'dl2_entrance', mini: '#8a7058',
    },
    puppet: {
      floor: [100, 78, 70], floor2: [116, 90, 78], rock: [30, 20, 24], rock2: [48, 32, 36],
      face: [[128, 98, 88], [76, 56, 54]], ambient: [110, 70, 76], light: [360, '255,190,170'],
      specks: ['rgba(60,40,36,0.55)', 'rgba(210,170,120,0.4)', 'rgba(200,60,70,0.3)'], cracks: 40,
      wall: [['dp_rack', 1.2], ['dp_strings', 1], ['dp_easel', 0.6]],
      glow: [['dp_lamp', 1]], glowEvery: 480,
      big: [['dp_table', 1], ['dp_parts', 1], ['dp_rack', 0.4]], low: [['dp_shavings', 1.6]],
      entrance: 'dp_entrance', mini: '#7a5a54',
    },
    bell: {
      floor: [150, 130, 100], floor2: [166, 144, 110], rock: [44, 36, 30], rock2: [64, 52, 42],
      face: [[176, 150, 116], [110, 90, 70]], ambient: [130, 110, 90], light: [400, '255,236,190'],
      specks: ['rgba(90,70,50,0.5)', 'rgba(255,230,170,0.4)', 'rgba(200,160,90,0.35)'], cracks: 30, tiles: true,
      wall: [['db_bell', 1], ['db_gear', 1], ['db_window', 1], ['db_ropes', 0.8]],
      glow: [['db_brazier', 1], ['db_window', 0.6]], glowEvery: 520,
      big: [['db_beam', 1], ['db_gear', 0.5], ['db_bell', 0.4]], low: [['db_dust', 1.4]],
      entrance: 'db_entrance', mini: '#a08a68',
    },
    grave: {
      floor: [40, 48, 84], floor2: [52, 60, 100], rock: [10, 12, 30], rock2: [22, 24, 48],
      face: [[70, 80, 130], [36, 42, 78]], ambient: [70, 80, 140], light: [440, '240,240,255'],
      specks: ['rgba(20,24,50,0.55)', 'rgba(220,230,255,0.45)', 'rgba(255,236,170,0.4)'], cracks: 120, glowCracks: true,
      wall: [['dg_pillar', 1.2], ['dg_crystal', 1], ['dg_ring', 0.5]],
      glow: [['dg_lamp', 1], ['dg_shard', 1], ['dg_crystal', 0.8]], glowEvery: 460,
      big: [['dg_shard', 0.8], ['dg_pillar', 0.6], ['dg_ring', 0.6]], low: [['dg_glass', 1.4], ['dg_bones', 0.25]],
      mini: '#3a4270',
    },
  });

  // ---------------- the two new monster bosses (dunbosses.js's fight) ----------------
  // (the endgame balance audit, the owner 2026-10-07: a full-gear ranger or moon sniper killed the Hundred-String alone
  // in 2–3 min and the star's grave's three forms in 6–9; HP x3 (hpK 70 -> 210) and x2.6 (90 -> 230, the forms in
  // storyboss.js the same): now ~8–10 min and ~20–25 min for the strongest full-gear builds alone, 15 min to an hour for
  // the rest, so a party is what it takes. EXP 50 per 10k HP
  // (was 35 and 41; the Lv 99 maps' monsters pay 54–82 now): expK 80 -> 345, 120 -> 377. Their drops: js/loot.js and below)
  Object.assign(DB, {
    hundred_string: { name: 'หุ่นร้อยเชือก', element: 'neutral', atkElement: 'shadow', r: 90, hpK: 210, atkK: 2, defK: 1.7, mdefK: 1.4,
      agiK: 0.4, dexK: 1.2, expK: 345, spd: 82, aggro: 780, moves: ['slam', 'orbs', 'summon', 'screech'], minion: ['faceless_puppet', 3],
      light: [440, '255,90,100'], top: 420, fx: '255,90,100' },
    aurelion: { name: 'ออเรเลียน ดาวที่ตกลงมา', element: 'holy', atkElement: 'holy', r: 96, hpK: 230, atkK: 2.2, defK: 1.5, mdefK: 2,
      agiK: 0.6, dexK: 1.3, expK: 377, spd: 90, aggro: 900, fly: 60, moves: ['rain', 'orbs', 'breath', 'screech', 'summon'],
      minion: ['star_crystal', 3], light: [640, '255,240,190'], top: 440, fx: '255,240,190' },
  });
  for (const id of ['hundred_string', 'aurelion']) {
    const D = DB[id];
    NC.MONSTERS[id] = { name: D.name, element: D.element, atkElement: D.atkElement, r: D.r, hpK: D.hpK, atkK: D.atkK, defK: D.defK,
      mdefK: D.mdefK, agiK: D.agiK, dexK: D.dexK, expK: D.expK, spd: D.spd, aggro: D.aggro };
    NC.BOSSES[id] = { respawn: id === 'aurelion' ? 3600 : 900, drops: 6, top: D.top };
  }

  // ---------------- the floors ----------------
  const fl = (o) => Object.assign({ W: 3600, H: 2900 }, o);
  const dun = (theme, o) => Object.assign({ theme, rooms: 10, room: [230, 410], tunnel: 200, loops: 0.3, chests: 2, traps: 4, chest: 'chest_iron' }, o);
  const updown = (parent, at, up, down) => [{ id: 'up', to: parent, at, place: 'entrance' }, ...(down ? [{ id: 'down', to: down, at: 'up', place: 'deep' }] : [])];
  const FLOORS = {
    owl1: fl({ name: 'หอดูดาวนกฮูก ชั้น 1', lvText: 'Lv 50–54', parent: 'peak', seed: 601, dungeon: dun('owl', { chest: 'chest_wood' }),
      lv: { slime: [50, 52], hollow: [51, 54] }, spawns: [['slime', 9], ['hollow', 9]], warps: updown('peak', 'owl', 'up', 'owl2') }),
    owl2: fl({ name: 'หอดูดาวนกฮูก ชั้น 2', lvText: 'Lv 53–56', parent: 'owl1', seed: 607, dungeon: dun('owl'),
      lv: { slime: [53, 55], hollow: [54, 56] }, spawns: [['slime', 9], ['hollow', 10]], warps: updown('owl1', 'down', 'up', 'owl3') }),
    owl3: fl({ name: 'หอดูดาวนกฮูก ชั้น 3 · โดมดาว', lvText: 'Lv 55–58 · บอส Lv 58', parent: 'owl2', seed: 613, W: 3800, H: 3100,
      dungeon: dun('owl', { rooms: 9, boss: true }), lv: { slime: [55, 57], hollow: [56, 58] }, spawns: [['slime', 9], ['hollow', 10]],
      warps: updown('owl2', 'down') }),
    ledger1: fl({ name: 'หอบัญชีใต้วิหาร ชั้น 1', lvText: 'Lv 78–83', parent: 'canal', seed: 621, W: 3800, H: 3000, dungeon: dun('ledger', { rooms: 11 }),
      lv: { slime: [78, 81], hollow: [80, 83] }, spawns: [['slime', 10], ['hollow', 10]], warps: updown('canal', 'archive', 'up', 'ledger2') }),
    ledger2: fl({ name: 'หอบัญชีใต้วิหาร ชั้น 2 · ห้องบัญชี', lvText: 'Lv 82–88 · บอส Lv 88', parent: 'ledger1', seed: 627, W: 4000, H: 3200,
      dungeon: dun('ledger', { rooms: 10, boss: true }), lv: { slime: [82, 85], hollow: [84, 88] }, spawns: [['slime', 10], ['hollow', 11]],
      warps: updown('ledger1', 'down') }),
    puppet1: fl({ name: 'โรงหุ่นใต้วิหาร ชั้น 1 · ห้องขัง', lvText: 'Lv 88–91', parent: 'cathedral', seed: 631, W: 3800, H: 3000,
      dungeon: dun('puppet', { rooms: 11 }), lv: { slime: [88, 90], hollow: [89, 91] }, spawns: [['slime', 10], ['hollow', 11]],
      warps: updown('cathedral', 'cellar', 'up', 'puppet2') }),
    puppet2: fl({ name: 'โรงหุ่นใต้วิหาร ชั้น 2 · โต๊ะช่าง', lvText: 'Lv 90–94', parent: 'puppet1', seed: 637, W: 4000, H: 3200,
      dungeon: dun('puppet', { rooms: 11, boss: true }), lv: { slime: [90, 92], hollow: [91, 94] }, spawns: [['slime', 10], ['hollow', 11]],
      warps: updown('puppet1', 'down') }),
    grave1: fl({ name: 'หลุมดาว ชั้น 1 · พื้นแก้ว', lvText: 'Lv 97–99', parent: 'wind', seed: 661, W: 4000, H: 3200, dungeon: dun('grave', { rooms: 11, traps: 5 }),
      lv: { slime: [97, 98], hollow: [98, 99] }, spawns: [['slime', 10], ['hollow', 12]], warps: updown('wind', 'grave', 'up', 'grave2') }),
    grave2: fl({ name: 'หลุมดาว ชั้น 2 · ใจกลางดาว', lvText: 'Lv 99 · บอสโลก', parent: 'grave1', seed: 667, W: 4200, H: 3400,
      dungeon: dun('grave', { rooms: 9, traps: 5, chest: 'chest_gold', boss: true }), lv: { slime: [99, 99], hollow: [99, 99] },
      spawns: [['slime', 9], ['hollow', 11]], warps: updown('grave1', 'down') }),
  };
  // the bell tower: seven short floors up, a bell's tongue on every one (the quest), the Hundred-String on top
  // (the upper floors 5–7 are wider, with more rooms and packs: the owner, 2026-10-08, the endgame balance: the 3000x2500
  // floor fits only 27–33 of its 60 monsters (the 115 px spacing fills its rooms), so bell1's 41 out-farmed the Lv99
  // floors 1.2–1.5x; at 3600x2900 with 11 rooms and 76 wanted they hold 50–57, bell1's density, and the server's sim
  // puts bell6/bell7 at 1.0–1.36x bell1's EXP an hour for a Lv 99 hero)
  for (let f = 1; f <= 7; f++) {
    const lo = Math.min(99, 93 + f), top = f === 7, wide = f >= 5;
    FLOORS['bell' + f] = fl({ name: `หอระฆัง ชั้น ${f}${top ? ' · ยอดหอ' : ''}`, lvText: `Lv ${lo}–${Math.min(99, lo + 2)}${top ? ' · บอส Lv 99' : ''}`,
      parent: f === 1 ? 'cathedral' : 'bell' + (f - 1), seed: 641 + f * 6, W: wide ? 3600 : 3000, H: wide ? 2900 : 2500,
      dungeon: dun('bell', { rooms: wide ? 11 : 7, room: [230, 380], chests: 1, traps: 3, ...(top ? { boss: true, bossChest: true, chest: 'chest_gold' } : {}) }),
      lv: { slime: [lo, Math.min(99, lo + 1)], hollow: [Math.min(99, lo + 1), Math.min(99, lo + 2)], ...(top ? { hundred_string: [99, 99] } : {}) },
      spawns: wide ? [['slime', 9], ['hollow', 10]] : [['slime', 7], ['hollow', 8]], ...(top ? { bosses: [['hundred_string']] } : {}),
      warps: updown(f === 1 ? 'cathedral' : 'bell' + (f - 1), f === 1 ? 'bell' : 'down', 'up', top ? null : 'bell' + (f + 1)) });
  }
  const chests = Object.keys(NC.DUNGEON_CHESTS || {});
  for (const [id, F] of Object.entries(FLOORS)) {
    const top = Math.max(...Object.values(F.lv).map((r) => r[1]));
    for (const c of chests) F.lv[c] = [top, top];
    F.dungeonFloor = true;
    NC.MAPS[id] = F;
  }
  Object.assign(NC.DUNGEON_FLOORS || (NC.DUNGEON_FLOORS = {}), FLOORS);

  // who lives where
  const R = (s, h) => ({ '*': { slime: s, hollow: h } });
  Object.assign(NC.ROSTER, {
    owl1: R([['stone_owl', 2]], [['hollow_stargazer', 2], ['stone_owl', 1]]),
    owl2: R([['stone_owl', 1]], [['hollow_stargazer', 2], ['stone_owl', 1]]),
    owl3: R([['stone_owl', 1], ['storm_spirit', 1]], [['hollow_stargazer', 2], ['stone_owl', 2]]),
    ledger1: R([['flying_book', 2], ['paper_blade', 1]], [['hollow_lamplighter', 2], ['flying_book', 1]]),
    ledger2: R([['paper_blade', 2], ['flying_book', 1]], [['hollow_lamplighter', 2], ['paper_blade', 1]]),
    puppet1: R([['wooden_hand', 1], ['faceless_puppet', 1]], [['faceless_puppet', 3], ['thread_binder', 1]]),
    puppet2: R([['wooden_hand', 2]], [['thread_binder', 2], ['faceless_puppet', 2]]),
    grave1: R([['star_crystal', 2]], [['first_lamplighter', 2], ['star_crystal', 1]]),
    grave2: R([['star_crystal', 1]], [['first_lamplighter', 3]]),
  });
  for (let f = 1; f <= 7; f++) NC.ROSTER['bell' + f] = R([['bell_puppet', 1], ['hollow_bellringer', 1]], [['bell_puppet', 2], ['hollow_bellringer', 2]]);

  // ---------------- the doors in the fields (as dungeons.js: their warps set their own arrival) ----------------
  const door = (field, warp, landmark, road) => {
    const M = NC.MAPS[field];
    if (!M || (M.warps || []).some((w) => w.id === warp.id)) return;
    (M.warps = M.warps || []).push(warp);
    if (landmark) (M.landmarks = M.landmarks || []).push(landmark);
    if (road) (M.roads = M.roads || []).push(road);
  };
  door('peak', { id: 'owl', x: 2600, y: 410, to: 'owl1', at: 'up', ax: 2600, ay: 560 }, ['de_owl', 2600, 330]);
  door('canal', { id: 'archive', x: 800, y: 2640, to: 'ledger1', at: 'up', ax: 930, ay: 2700 }, ['de_archive', 780, 2570],
    { w: 54, pts: [[950, 2300], [880, 2560], [800, 2660]] });
  door('cathedral', { id: 'cellar', x: 1000, y: 1180, to: 'puppet1', at: 'up', ax: 1060, ay: 1320 }, ['de_cellar', 1000, 1100]);
  door('cathedral', { id: 'bell', x: 4400, y: 850, to: 'bell1', at: 'up', ax: 4400, ay: 1000 }, ['de_bell', 4400, 770]);
  door('wind', { id: 'grave', x: 1000, y: 2390, to: 'grave1', at: 'up', ax: 1000, ay: 2520 }, ['dg_entrance', 1000, 2310]);

  // ---------------- their drops ----------------
  if (NC.MATERIALS && NC.MAT_DROPS) {
    Object.assign(NC.MATERIALS, {
      mat_hundred_thread: { name: 'เชือกร้อยเส้นที่ขาด', price: 7000, rare: true, desc: 'เชือกแดงร้อยเส้นที่ขาดพร้อมกัน ยังอุ่นเหมือนมีคนจับอยู่ หายากมาก!' },
      mat_aurelion_core: { name: 'แกนดาวออเรเลียน', price: 12000, rare: true, desc: 'แกนแสงสีทองขาวที่ร้าว หัวใจของดาวที่ตกลงมา หายากที่สุด!' },
    });
    // (the same audit: x2–3 the threads and crystals, the rare piece 15% -> 45% and 12% -> 40%; was 3–6 / 15%, 4–8 / 12%)
    Object.assign(NC.MAT_DROPS, {
      hundred_string: [['mat_red_thread', 1, 8, 14], ['mat_hundred_thread', 0.45]],
      aurelion: [['mat_star_crystal', 1, 10, 16], ['mat_aurelion_core', 0.4]],
    });
  }
})();
