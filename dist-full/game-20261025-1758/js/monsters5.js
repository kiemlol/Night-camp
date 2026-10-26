/* monsters5.js — the monsters of the story's new maps (the story bible draft 8, chapters 4–18; js/fields4.js, the
   dungeon floors in js/dungeons2.js): 33 species on monsters.js's four ways of moving and fighting (hop / melee / charge /
   fly). The "hollow" ones are shadow beings in the clothes of who they used to be (the people the tithe emptied).
     ถนนผู้อพยพ (road)          caravan bandit (a dash stab) · hollow horse (a heavy charge) · giant crow
     ด่านสะพานเกลือ (salt)       toll guard (armoured, long reach) · hunting hound · warehouse keeper (a mole, slam)
     ยอดเขาหมอกเหนือ (peak)      snow wolf · ice goat (charge) · storm spirit (wind)
     หอดูดาวนกฮูก (owl1-3)      stone owl (earth, flies) · hollow stargazer
     เส้นทางขึ้นเหนือ (nroad)     hollow villager (slow, sad) · shadow crow
     ย่านนอกกำแพง (outer)        hollow guard (high DEF) · city hound · hollow carthorse (a heavy charge)
     ย่านริมคลอง (canal)         candle minion (fire) · canal rat (poison) · light filler (holy light)
     หอบัญชีใต้วิหาร (ledger1-2)  flying book (ghost) · hollow lamplighter (fire, long reach) · paper blade (wind)
     เกาะกลางทะเลสาบ (isle)      mist citizen (leaves you alone, see-through)
     ป่าใต้ที่มืดสนิท (dark)       lightless deer (shadow, charge)
     โรงหุ่นใต้วิหาร (puppet1-2)  faceless puppet · wooden hand (a grab) · thread binder (long thread shot)
     ย่านวิหาร (cathedral)        cardinal's puppet (holy) · temple soldier (holy, high DEF)
     หอระฆัง (bell1-7)           bell puppet (a heavy ringing slam) · hollow bellringer (a rope whip)
     หลุมดาว (grave1-2)          first lamplighter (holy ghost) · living star crystal (hop)
   Their names are the ones the quests use (assets/gen/loot/quests_build.py maps them). Also their materials (the
   quest draft's m_* are these mat_*). Art: assets/monsters/ from assets/gen/make_monster5_prompts.py -> Codex ->
   tools/monster_cut.py. Load after dungeons.js (the dungeons' floors' ROSTER is in dungeons2.js). */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC.SPECIES || !NC.ROSTER) return;

  const SLIME = { kind: 'hop', r: 26, hpK: 0.65, atkK: 0.75, defK: 0.4, mdefK: 1.2, agiK: 0.3, dexK: 0.5, expK: 0.8, spd: 0, aggro: 480 };
  const MON = { r: 24, hpK: 1, atkK: 1, defK: 1, mdefK: 0.5, agiK: 0.6, dexK: 0.7, expK: 1.2, spd: 150, aggro: 560 };
  const sp = (base, o) => Object.assign({}, base, o);
  // the hollows share a look: a dim violet glow round them
  const HOL = { element: 'shadow', light: [110, '170,150,230'] };
  const SPECIES = {
    // ---- the pilgrims' road ----
    caravan_bandit: sp(MON, { name: 'โจรปล้นคาราวาน', kind: 'charge', element: 'neutral', atkElement: 'neutral', r: 26, hpK: 1, atkK: 1.15,
      defK: 0.8, agiK: 1.2, dexK: 1.1, expK: 1.25, spd: 175, aggro: 600, color: '150,110,80', dash: [300, 720, 0.34], leap: 14,
      dust: '140,120,90', shadow: [48, 13] }),
    hollow_horse: sp(MON, Object.assign({}, HOL, { name: 'ม้ากลวง', kind: 'charge', atkElement: 'neutral', r: 32, hpK: 1.3, atkK: 1.15,
      defK: 1, agiK: 0.8, expK: 1.3, spd: 150, aggro: 540, color: '110,100,150', dash: [360, 760, 0.46], dust: '120,110,110',
      shadow: [64, 16] })),
    giant_crow: sp(MON, { name: 'อีกายักษ์', kind: 'fly', element: 'wind', atkElement: 'neutral', r: 24, hpK: 0.8, atkK: 1.05, defK: 0.6,
      mdefK: 0.7, agiK: 1.3, dexK: 1, expK: 1.2, spd: 190, aggro: 600, color: '70,70,110', hover: 60, swoop: 640, flap: 11 }),
    // ---- saltbridge ----
    toll_guard: sp(MON, { name: 'ยามด่านเกลือ', kind: 'melee', element: 'earth', atkElement: 'neutral', r: 28, hpK: 1.3, atkK: 1.1, defK: 1.5,
      mdefK: 0.6, agiK: 0.4, dexK: 0.9, expK: 1.35, spd: 110, aggro: 560, color: '90,110,170', reach: 124, windup: 0.6, lunge: 90,
      slam: 110, recover: 0.8, dust: '200,200,210', shadow: [52, 14] }),
    hound: sp(MON, { name: 'สุนัขล่า', kind: 'charge', element: 'neutral', atkElement: 'neutral', r: 26, hpK: 0.95, atkK: 1.2, defK: 0.8,
      agiK: 1.3, dexK: 1.1, expK: 1.3, spd: 200, aggro: 680, color: '150,150,160', dash: [320, 820, 0.34], leap: 24, dust: '180,180,190',
      shadow: [52, 13] }),
    salt_mole: sp(MON, { name: 'คนคุมโกดัง', kind: 'melee', element: 'earth', atkElement: 'earth', r: 30, hpK: 1.45, atkK: 1.2, defK: 1.3,
      mdefK: 0.5, agiK: 0.3, dexK: 0.7, expK: 1.4, spd: 90, aggro: 500, color: '120,100,90', reach: 110, windup: 0.75, lunge: 70,
      slam: 130, recover: 0.9, dust: '230,230,235', shadow: [56, 15] }),
    // ---- northpeak ----
    snow_wolf: sp(MON, { name: 'หมาป่าหิมะ', kind: 'charge', element: 'water', atkElement: 'water', r: 28, hpK: 1.1, atkK: 1.2, defK: 0.9,
      mdefK: 0.7, agiK: 1.3, dexK: 1.1, expK: 1.35, spd: 195, aggro: 640, color: '220,235,255', dash: [320, 800, 0.36], leap: 26,
      dust: '240,245,255', shadow: [56, 14] }),
    ice_goat: sp(MON, { name: 'แพะภูเขา', kind: 'charge', element: 'water', atkElement: 'neutral', r: 30, hpK: 1.35, atkK: 1.15, defK: 1.2,
      mdefK: 0.6, agiK: 0.6, dexK: 0.8, expK: 1.35, spd: 130, aggro: 520, color: '200,220,240', dash: [340, 700, 0.46],
      dust: '240,245,255', shadow: [58, 16] }),
    storm_spirit: sp(MON, { name: 'ภูตพายุหิมะ', kind: 'fly', element: 'wind', atkElement: 'wind', r: 26, hpK: 0.9, atkK: 1.15, defK: 0.5,
      mdefK: 1.2, agiK: 1.1, dexK: 1, expK: 1.4, spd: 150, aggro: 580, color: '190,200,230', hover: 70, swoop: 520, flap: 4,
      light: [150, '200,220,255'] }),
    // ---- owlspire ----
    stone_owl: sp(MON, { name: 'นกฮูกหิน', kind: 'fly', element: 'earth', atkElement: 'earth', r: 28, hpK: 1.3, atkK: 1.2, defK: 1.8,
      mdefK: 0.5, agiK: 0.8, dexK: 1, expK: 1.45, spd: 150, aggro: 560, color: '150,150,140', hover: 56, swoop: 560, flap: 6,
      light: [90, '255,200,110'] }),
    hollow_stargazer: sp(MON, Object.assign({}, HOL, { name: 'ผู้ช่วยนักดาราศาสตร์กลวง', kind: 'melee', atkElement: 'shadow', r: 28,
      hpK: 1.2, atkK: 1.2, defK: 0.9, mdefK: 1.1, agiK: 0.6, dexK: 1, expK: 1.4, spd: 110, aggro: 540, color: '90,100,170',
      reach: 116, windup: 0.55, lunge: 140, recover: 0.75, slash: '200,190,255' })),
    // ---- the north road ----
    hollow_villager: sp(MON, Object.assign({}, HOL, { name: 'ชาวบ้านกลวง', kind: 'melee', atkElement: 'neutral', r: 28, hpK: 1.25, atkK: 1.1,
      defK: 1, agiK: 0.4, dexK: 0.8, expK: 1.35, spd: 90, aggro: 440, color: '130,110,90', reach: 130, windup: 0.6, lunge: 180,
      recover: 0.8, slash: '220,200,160' })),
    shadow_crow: sp(MON, { name: 'อีกาเงา', kind: 'fly', element: 'shadow', atkElement: 'shadow', r: 24, hpK: 0.9, atkK: 1.2, defK: 0.6,
      mdefK: 1, agiK: 1.4, dexK: 1.1, expK: 1.35, spd: 200, aggro: 640, color: '80,60,120', hover: 64, swoop: 700, flap: 12,
      light: [100, '170,120,255'], seeThrough: 0.9 }),
    // ---- bellhaven outer ward ----
    hollow_guard: sp(MON, Object.assign({}, HOL, { name: 'ยามกลวง', kind: 'melee', atkElement: 'neutral', r: 30, hpK: 1.5, atkK: 1.2,
      defK: 1.8, mdefK: 0.8, agiK: 0.5, dexK: 1, expK: 1.5, spd: 110, aggro: 580, color: '80,100,160', reach: 132, windup: 0.5,
      lunge: 220, recover: 0.75, slash: '190,210,255' })),
    city_hound: sp(MON, { name: 'หมาจรเมืองหลวง', kind: 'charge', element: 'neutral', atkElement: 'neutral', r: 26, hpK: 1, atkK: 1.2,
      defK: 0.9, agiK: 1.3, dexK: 1.1, expK: 1.35, spd: 200, aggro: 640, color: '150,120,90', dash: [300, 780, 0.34], leap: 20,
      dust: '150,140,130', shadow: [50, 13] }),
    hollow_carthorse: sp(MON, Object.assign({}, HOL, { name: 'ม้าลากเกวียนกลวง', kind: 'charge', atkElement: 'neutral', r: 38, hpK: 1.9,
      atkK: 1.3, defK: 1.4, agiK: 0.4, dexK: 0.8, expK: 1.6, spd: 120, aggro: 520, color: '110,100,140', dash: [380, 700, 0.55],
      dust: '130,120,120', shadow: [76, 20], heavy: true, light: [140, '255,200,120'] })),
    // ---- the canal ward ----
    candle_minion: sp(MON, { name: 'ลูกน้องแคนเดิล', kind: 'melee', element: 'fire', atkElement: 'fire', r: 26, hpK: 1.1, atkK: 1.2,
      defK: 0.8, mdefK: 0.8, agiK: 0.7, dexK: 1, expK: 1.35, spd: 110, aggro: 540, color: '255,220,160', reach: 120, windup: 0.5,
      lunge: 120, recover: 0.7, slash: '255,190,110', light: [140, '255,190,110'] }),
    canal_rat: sp(MON, { name: 'หนูคลอง', kind: 'charge', element: 'poison', atkElement: 'poison', r: 24, hpK: 0.95, atkK: 1.15,
      defK: 0.8, agiK: 1.3, dexK: 1.1, expK: 1.3, spd: 190, aggro: 600, color: '140,140,150', dash: [260, 760, 0.3], leap: 18,
      dust: '100,110,110', shadow: [46, 12] }),
    light_filler: sp(MON, Object.assign({}, HOL, { name: 'คนกรอกแสง', kind: 'melee', atkElement: 'holy', r: 30, hpK: 1.4, atkK: 1.25,
      defK: 1.1, mdefK: 1, agiK: 0.4, dexK: 0.9, expK: 1.5, spd: 95, aggro: 520, color: '255,220,120', reach: 118, windup: 0.6,
      lunge: 110, recover: 0.8, slash: '255,230,150', light: [170, '255,210,120'] })),
    // ---- the ledger archive ----
    flying_book: sp(MON, { name: 'หนังสือบิน', kind: 'fly', element: 'ghost', atkElement: 'neutral', r: 24, hpK: 0.95, atkK: 1.2, defK: 0.7,
      mdefK: 1.3, agiK: 1.2, dexK: 1.1, expK: 1.4, spd: 170, aggro: 600, color: '220,200,150', hover: 56, swoop: 600, flap: 9,
      light: [110, '255,230,150'] }),
    hollow_lamplighter: sp(MON, Object.assign({}, HOL, { name: 'ผู้จุดตะเกียงกลวง', kind: 'melee', atkElement: 'fire', r: 28, hpK: 1.35,
      atkK: 1.3, defK: 1, mdefK: 1, agiK: 0.5, dexK: 1, expK: 1.5, spd: 105, aggro: 560, color: '150,140,130', reach: 170,
      windup: 0.65, lunge: 60, slam: 120, recover: 0.85, dust: '200,160,110', light: [150, '255,180,90'] })),
    paper_blade: sp(MON, { name: 'ใบมีดกระดาษ', kind: 'fly', element: 'wind', atkElement: 'wind', r: 24, hpK: 0.9, atkK: 1.3, defK: 0.5,
      mdefK: 0.9, agiK: 1.4, dexK: 1.2, expK: 1.45, spd: 210, aggro: 620, color: '230,230,240', hover: 50, swoop: 720, flap: 7 }),
    // ---- the lake island ----
    mist_citizen: sp(MON, { name: 'ชาวเมืองหมอก', kind: 'fly', element: 'ghost', atkElement: 'water', r: 26, hpK: 1.3, atkK: 1.1, defK: 0.6,
      mdefK: 1.3, agiK: 0.8, dexK: 1, expK: 1.45, spd: 90, aggro: 460, passive: true, color: '180,210,240', hover: 30, swoop: 360,
      flap: 3, light: [150, '190,220,255'], seeThrough: 0.82 }),
    // ---- the lightless south forest ----
    lightless_deer: sp(MON, { name: 'กวางไร้แสง', kind: 'charge', element: 'shadow', atkElement: 'shadow', r: 34, hpK: 1.6, atkK: 1.35,
      defK: 1.2, mdefK: 1, agiK: 0.9, dexK: 1.1, expK: 1.6, spd: 170, aggro: 620, color: '40,40,70', dash: [380, 820, 0.44],
      dust: '60,60,80', shadow: [70, 18], light: [120, '150,190,255'] }),
    // ---- the puppet workshop ----
    faceless_puppet: sp(MON, { name: 'หุ่นไร้หน้า', kind: 'melee', element: 'neutral', atkElement: 'neutral', r: 28, hpK: 1.4, atkK: 1.3,
      defK: 1.2, mdefK: 0.8, agiK: 0.8, dexK: 1.1, expK: 1.55, spd: 130, aggro: 600, color: '200,170,130', reach: 104, windup: 0.4,
      lunge: 240, recover: 0.6, slash: '255,120,120' }),
    wooden_hand: sp(MON, { name: 'มือหุ่นยักษ์', kind: 'charge', element: 'earth', atkElement: 'neutral', r: 30, hpK: 1.5, atkK: 1.3,
      defK: 1.4, mdefK: 0.6, agiK: 0.8, dexK: 1, expK: 1.55, spd: 150, aggro: 560, color: '190,150,110', dash: [300, 700, 0.42],
      leap: 30, dust: '160,130,100', shadow: [60, 16] }),
    thread_binder: sp(MON, { name: 'ด้ายพันคน', kind: 'melee', element: 'neutral', atkElement: 'shadow', r: 30, hpK: 1.35, atkK: 1.3,
      defK: 1, mdefK: 1, agiK: 0.7, dexK: 1.2, expK: 1.6, spd: 120, aggro: 600, color: '200,60,70', reach: 180, windup: 0.6,
      lunge: 50, recover: 0.8, slash: '255,90,100' }),
    // ---- the cathedral ward ----
    cardinal_puppet: sp(MON, { name: 'หุ่นของคาร์ดินัล', kind: 'melee', element: 'holy', atkElement: 'holy', r: 30, hpK: 1.6, atkK: 1.4,
      defK: 1.2, mdefK: 1.4, agiK: 0.6, dexK: 1.1, expK: 1.7, spd: 110, aggro: 600, color: '220,60,60', reach: 150, windup: 0.6,
      lunge: 100, slam: 140, recover: 0.8, dust: '255,230,150', light: [170, '255,220,130'] }),
    temple_soldier: sp(MON, { name: 'ทหารวิหาร', kind: 'melee', element: 'holy', atkElement: 'neutral', r: 30, hpK: 1.7, atkK: 1.35,
      defK: 2, mdefK: 1, agiK: 0.5, dexK: 1.1, expK: 1.7, spd: 115, aggro: 600, color: '240,230,200', reach: 140, windup: 0.5,
      lunge: 230, recover: 0.75, slash: '255,240,190' }),
    // ---- the bell tower ----
    // (the owner, 2026-10-07, the endgame balance audit: the Lv 99 floors paid ~32 EXP and ~52 coins of junk per 10k HP
    // behind DEF 60%, so a Lv 99 hero farmed Lv 88–98 maps for 1.4–2.8x the EXP and coins. The bell tower's species:
    // HP about x0.5, DEF x0.65–0.8, EXP x1.5, junk 0.55 -> 0.74 a kill, gear rows x1.35 (js/loot.js); the star's
    // grave's: HP x0.8–0.85, DEF x0.75–0.8, EXP x1.2, junk and gear x1.2. Measured with the server's own code (9 Lv 99
    // builds, 13 maps): a Lv 99 floor now leads every Lv 78–98 field map in coins an hour and leads or ties it (within 5%)
    // in EXP for every build; only the tower's denser first floor (Lv 94–96, 41 monsters to the top floor's 31) pays more.
    // Was: bell puppet hpK 2 defK 1.9 expK 1.8; bellringer 1.5 / 1.2 / 1.7; first lamplighter 1.6 / - / 1.9; star
    // crystal 1.2 / 1.4 / 1.4)
    bell_puppet: sp(MON, { name: 'หุ่นระฆัง', kind: 'melee', element: 'wind', atkElement: 'neutral', r: 34, hpK: 1, atkK: 1.45, defK: 1.25,
      mdefK: 0.8, agiK: 0.2, dexK: 0.9, expK: 2.7, spd: 80, aggro: 520, color: '200,150,80', reach: 140, windup: 0.9, lunge: 40,
      slam: 180, recover: 1.05, heavy: true, dust: '220,180,110', shadow: [70, 18] }),
    hollow_bellringer: sp(MON, Object.assign({}, HOL, { name: 'ผู้ตีระฆังกลวง', kind: 'melee', atkElement: 'neutral', r: 28, hpK: 0.85,
      atkK: 1.4, defK: 1, mdefK: 1, agiK: 0.7, dexK: 1.2, expK: 2.55, spd: 115, aggro: 600, color: '140,110,90', reach: 170,
      windup: 0.5, lunge: 60, recover: 0.7, slash: '220,190,150' })),
    // ---- the star's grave ----
    first_lamplighter: sp(MON, { name: 'ผู้จุดตะเกียงรุ่นแรก', kind: 'fly', element: 'ghost', atkElement: 'holy', r: 28, hpK: 1.3, atkK: 1.5,
      defK: 0.9, mdefK: 1.5, agiK: 1, dexK: 1.2, expK: 2.3, spd: 140, aggro: 620, color: '200,220,255', hover: 50, swoop: 560, flap: 4,
      light: [200, '230,240,255'], seeThrough: 0.9 }),
    star_crystal: sp(SLIME, { name: 'ผลึกดาวมีชีวิต', element: 'holy', atkElement: 'holy', hpK: 1, atkK: 1.1, defK: 1.1, mdefK: 1.5,
      agiK: 0.6, expK: 1.7, color: '255,240,190', light: [130, '255,240,190'] }),
  };
  Object.assign(NC.SPECIES, SPECIES);
  Object.assign(NC.MONSTERS, SPECIES);

  // who lives where in the fields (dungeons2.js has the floors)
  Object.assign(NC.ROSTER, {
    road: {
      '*': { slime: [['giant_crow', 2], ['crow', 1]], hollow: [['caravan_bandit', 2], ['hollow_horse', 1]] },
      'ขบวนเกวียนล่ม': { slime: [['giant_crow', 1]], hollow: [['hollow_horse', 2], ['caravan_bandit', 1]] },
    },
    salt: {
      '*': { slime: [['hound', 2], ['giant_crow', 1]], hollow: [['toll_guard', 2], ['hound', 1]] },
      'โกดังเกลือ': { slime: [['hound', 1]], hollow: [['salt_mole', 3], ['toll_guard', 1]] },
      'ปราสาทเจ้าด่าน': { slime: [['hound', 1]], hollow: [['toll_guard', 2], ['salt_mole', 1]] },
    },
    peak: {
      '*': { slime: [['storm_spirit', 1], ['snow_wolf', 1]], hollow: [['snow_wolf', 2], ['ice_goat', 1]] },
      'สันเขาพายุหิมะ': { slime: [['storm_spirit', 2]], hollow: [['ice_goat', 2], ['snow_wolf', 1]] },
    },
    nroad: {
      '*': { slime: [['shadow_crow', 2]], hollow: [['hollow_villager', 2], ['shadow_crow', 1]] },
      'หมู่บ้านร้าง': { slime: [['shadow_crow', 1]], hollow: [['hollow_villager', 3]] },
    },
    outer: {
      '*': { slime: [['city_hound', 2]], hollow: [['hollow_guard', 2], ['hollow_carthorse', 1]] },
      'หน้าประตูเมือง': { slime: [['city_hound', 1]], hollow: [['hollow_guard', 3], ['hollow_carthorse', 1]] },
    },
    canal: {
      '*': { slime: [['canal_rat', 2], ['candle_minion', 1]], hollow: [['candle_minion', 2], ['light_filler', 1]] },
      'โรงเทียน': { slime: [['candle_minion', 1]], hollow: [['light_filler', 2], ['candle_minion', 2]] },
    },
    isle: {
      '*': { slime: [['mist_citizen', 1]], hollow: [['mist_citizen', 2], ['mist_wraith', 1]] },
    },
    dark: {
      '*': { slime: [['shadow_crow', 1], ['slime_glow', 1]], hollow: [['lightless_deer', 3], ['ghost', 1]] },
      'แคมป์ที่ไฟดับ': { slime: [['shadow_crow', 1]], hollow: [['lightless_deer', 2], ['faceless_puppet', 1]] },
    },
    cathedral: {
      '*': { slime: [['cardinal_puppet', 1], ['temple_soldier', 1]], hollow: [['temple_soldier', 2], ['cardinal_puppet', 1]] },
      'ย่านคนจนหลังรั้ว': { slime: [['canal_rat', 1]], hollow: [['cardinal_puppet', 2], ['temple_soldier', 1]] },
    },
  });

  // ---------------- what they drop (materials.js: sold to ลุงโกโก้, or in a player shop) ----------------
  if (NC.MATERIALS && NC.MAT_DROPS) {
    Object.assign(NC.MATERIALS, {
      mat_bandit_cloth: { name: 'ผ้าโพกโจรคาราวาน', price: 90, desc: 'ผ้าโพกหัวสีแดงหม่น กลิ่นฝุ่นถนนกับควันไฟ' },
      mat_rusty_shoe: { name: 'เกือกม้ากลวงขึ้นสนิม', price: 96, desc: 'เกือกม้าสนิมเขรอะ ยังมีเงาดำ ๆ เกาะอยู่ในรูตะปู' },
      mat_shiny_ring: { name: 'แหวนที่อีกาขโมยมา', price: 100, desc: 'แหวนเงินเล็ก ๆ ด้านในสลักชื่อใครสักคนที่เลือนไปแล้ว' },
      mat_toll_token: { name: 'เหรียญค่าผ่านด่าน', price: 104, desc: 'เหรียญทองแดงตราผลึกเกลือ ใช้ได้ที่ด่านเดียวในโลก' },
      mat_spike_collar: { name: 'ปลอกคอหนามสุนัขล่า', price: 110, desc: 'ปลอกคอหนังมีหนามเหล็ก ผูกป้ายชื่อเจ้าของที่ไม่มีใครรู้จัก' },
      mat_black_salt: { name: 'ถุงเกลือดำ', price: 118, desc: 'เกลือสีดำเป็นประกาย ไม่เค็ม... แต่เย็นเหมือนแสงที่ถูกดูดไป' },
      mat_snow_fur: { name: 'ขนหมาป่าหิมะ', price: 150, desc: 'ขนสีขาวปลายฟ้า อุ่นอย่างน่าประหลาดแม้จะเย็นเฉียบ' },
      mat_ice_horn: { name: 'เขาแพะน้ำแข็ง', price: 160, desc: 'เขาโค้งใสเป็นน้ำแข็ง ไม่ละลายแม้วางข้างกองไฟ' },
      mat_storm_cloud: { name: 'เมฆพายุในขวด', price: 166, desc: 'ขวดแก้วที่มีเมฆเทาหมุนวน ฟ้าแลบเล็ก ๆ เป็นระยะ' },
      mat_stone_feather: { name: 'ขนนกฮูกหิน', price: 180, desc: 'ขนนกที่เป็นหินสลัก บางเบากว่าที่ควรจะเป็น' },
      mat_cracked_lens: { name: 'เลนส์ร้าว', price: 190, desc: 'เลนส์กล้องดูดาวที่ร้าวเป็นรูปดาวห้าแฉก' },
      mat_brass_button: { name: 'กระดุมทองเหลืองของชาวบ้านกลวง', price: 200, desc: 'กระดุมเสื้อโค้ตชาวนา ขัดจนเงาเหมือนเจ้าของยังดูแลอยู่' },
      mat_shadow_quill: { name: 'ขนอีกาเงา', price: 210, desc: 'ขนสีดำที่ไม่สะท้อนแสงเลยสักนิด' },
      mat_bell_collar: { name: 'ปลอกคอกระดิ่ง', price: 220, desc: 'ปลอกคอหนังขาด ๆ กับกระดิ่งเล็กที่ยังดังกรุ๊งกริ๊ง' },
      mat_guard_badge: { name: 'ป้ายยามเมือง', price: 230, desc: 'ป้ายทองเหลืองตราระฆังของยามเมืองหอระฆัง' },
      mat_rat_tail: { name: 'หางหนูคลอง', price: 236, desc: 'หางยาวสีชมพูเทา ต้องห่อผ้าก่อนหยิบ' },
      mat_cart_lantern: { name: 'ตะเกียงแอกม้า', price: 240, desc: 'ตะเกียงเหล็กจากแอกม้าลากเกวียน ไส้ยังอุ่นอยู่' },
      mat_black_wick: { name: 'ไส้เทียนดำ', price: 250, desc: 'ไส้เทียนสีดำจากโรงเทียน จุดแล้วแสงออกมาเป็นสีทองเกินจริง' },
      mat_cracked_jar: { name: 'ขวดแสงร้าว', price: 270, desc: 'ขวดแก้วที่เคยบรรจุแสงของใครสักคน ยังเรืองจาง ๆ ตรงรอยร้าว' },
      mat_glow_page: { name: 'หน้ากระดาษเรืองแสง', price: 290, desc: 'หน้าบัญชีที่ลายมือยังเรืองแสง รายชื่อคนจ่ายส่วยแสง' },
      mat_ink_blade: { name: 'ใบมีดกระดาษหมึก', price: 296, desc: 'กระดาษพับจนคมเหมือนมีด หมึกยังไม่แห้ง' },
      mat_old_lampwick: { name: 'ไส้ตะเกียงเก่า', price: 300, desc: 'ไส้ตะเกียงของผู้จุดตะเกียงรุ่นก่อน ยังติดไฟได้ด้วยตัวเอง' },
      mat_mist_memory: { name: 'หยดหมอกความทรงจำ', price: 310, desc: 'หยดหมอกในขวด มองนาน ๆ จะเห็นถนนของเมืองเก่า' },
      mat_dark_leaf: { name: 'ใบไม้ไร้แสง', price: 320, desc: 'ใบไม้ดำสนิท มีเส้นใบเรืองฟ้าจาง ๆ ดูดแสงรอบตัว' },
      mat_wood_joint: { name: 'ข้อต่อไม้หุ่น', price: 330, desc: 'ข้อต่อไม้กลมเกลี้ยง... หน้าตาคุ้นเหมือนข้อต่อของใครบางคน' },
      mat_puppet_finger: { name: 'นิ้วหุ่นไม้', price: 340, desc: 'นิ้วไม้ขัดเงา ปลายผูกด้ายแดงที่ยังตึงอยู่' },
      mat_red_thread: { name: 'ด้ายแดง', price: 360, desc: 'ด้ายสีแดงที่ตัดยังไงก็ไม่ขาด เว้นแต่ใช้แสงของกองไฟ' },
      mat_sun_plate: { name: 'แผ่นเกราะตราตะวัน', price: 370, desc: 'แผ่นเกราะขาวทองของทหารวิหาร สะอาดเกินกว่าจะเคยผ่านศึก' },
      mat_gold_string: { name: 'เชือกทองของคาร์ดินัล', price: 380, desc: 'เส้นเชือกทองคำเส้นบาง ที่ปลายยังขยับเองได้' },
      mat_bell_rope: { name: 'เชือกระฆังเก่า', price: 390, desc: 'เชือกป่านหนาที่สึกเป็นรูปมือของคนตีระฆังหลายรุ่น' },
      mat_bell_shard: { name: 'เศษระฆังทองเหลือง', price: 400, desc: 'เศษระฆังที่ยังสั่นเป็นเสียงเบา ๆ เมื่อถือไว้' },
      mat_star_ember: { name: 'ถ่านไฟดาว', price: 440, desc: 'ถ่านเล็ก ๆ ที่ลุกเป็นไฟสีขาว จากตะเกียงของผู้จุดตะเกียงรุ่นแรก' },
      mat_star_crystal: { name: 'เศษผลึกดาว', price: 450, desc: 'เศษผลึกสีทองขาวจากดาวที่ตกลงมา อุ่นเหมือนแสงเช้า' },
    });
    Object.assign(NC.MAT_DROPS, {
      caravan_bandit: [['mat_bandit_cloth', 0.55]], hollow_horse: [['mat_rusty_shoe', 0.55]], giant_crow: [['mat_shiny_ring', 0.5]],
      toll_guard: [['mat_toll_token', 0.55]], hound: [['mat_spike_collar', 0.55]], salt_mole: [['mat_black_salt', 0.55]],
      snow_wolf: [['mat_snow_fur', 0.55]], ice_goat: [['mat_ice_horn', 0.55]], storm_spirit: [['mat_storm_cloud', 0.5]],
      stone_owl: [['mat_stone_feather', 0.55]], hollow_stargazer: [['mat_cracked_lens', 0.55]],
      hollow_villager: [['mat_brass_button', 0.55]], shadow_crow: [['mat_shadow_quill', 0.55]],
      hollow_guard: [['mat_guard_badge', 0.55]], city_hound: [['mat_bell_collar', 0.55]], hollow_carthorse: [['mat_cart_lantern', 0.5]],
      candle_minion: [['mat_black_wick', 0.55]], canal_rat: [['mat_rat_tail', 0.55]], light_filler: [['mat_cracked_jar', 0.55]],
      flying_book: [['mat_glow_page', 0.55]], hollow_lamplighter: [['mat_old_lampwick', 0.55]], paper_blade: [['mat_ink_blade', 0.55]],
      mist_citizen: [['mat_mist_memory', 0.55]], lightless_deer: [['mat_dark_leaf', 0.55]],
      faceless_puppet: [['mat_wood_joint', 0.55]], wooden_hand: [['mat_puppet_finger', 0.55]], thread_binder: [['mat_red_thread', 0.55]],
      cardinal_puppet: [['mat_gold_string', 0.5], ['mat_red_thread', 0.25]], temple_soldier: [['mat_sun_plate', 0.55]],
      // (0.55 / 0.55 / 0.5 / 0.55 until the endgame balance audit, the owner 2026-10-07: x1.35 the bell tower, x1.2 the grave)
      bell_puppet: [['mat_bell_shard', 0.74]], hollow_bellringer: [['mat_bell_rope', 0.74]],
      first_lamplighter: [['mat_star_ember', 0.6]], star_crystal: [['mat_star_crystal', 0.66]],
    });
  }
})();
