/* greatswords.js — the 40 greatswords (ดาบใหญ่) of the item plan the user approved on 2026-09-28, the first weapon type
   of the ~200-item push. The rules (the user's and the approved proposal):
     - grades by level: 1 Lv 1–25 · 2 Lv 26–50 · 3 Lv 51–75 · 4 Lv 76–99, mid ATK 70 / 110 / 150 / 190 (flat on
       purpose: at Lv 99 the hero's own ATK is ~220, so a low sword of the right element still wins, like classic MMOs)
     - 4 kinds: ธรรมดา (plain: the grade's top ATK) · ออป (a trait with a cost, ATK ~-8%) · เวท (a chance on hit to
       cause a status or cast a spell, ATK ~-12%) · บอส / ตำนาน (two abilities, ATK +15-30%)
     - an element on most swords, spread over the grades with gaps on purpose (no water sword of grade 4, one ghost
       sword at grade 2): a Lv 99 hero carries low swords for the maps they suit
     - the only limit is a minimum level; every copy is an item of its own with option rows (js/wbag.js), the
       abilities run in js/wabil.js; the blacksmith ป๋าหมูหริ่ง crafts / drills / sells (js/forge.js)
   For now (the user, 2026-09-28: the swords' pictures and holding them first, the rest later) only this file is
   loaded: the swords are plain collection items (items.js: they drop like any item, ?allitems gives them all) and
   wabil.js / wbag.js / forge.js wait, unhooked in index.html.
   Each entry: [id, name, grade, kind, element, Lv, ATK, ability text, where from, abilities (wabil.js specs), look].
   The old ดาบใหญ่ผู้พิทักษ์ (items.js `greatsword`, the gsword lane's starting sword) stays as it was and counts as
   the 40th. Art: assets/gen/make_gs_prompts.py -> Codex -> tools/gs_art.py (assets/greatswords/). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS;
  if (NC.ASSET_MANIFEST_GS) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_GS);
  // the user (2026-09-28): greatswords a bit bigger. The new ones are cut x1.2 (tools/gs_art.py SIZE); the old
  // ดาบใหญ่ผู้พิทักษ์ is drawn x1.2 too, so the 40 stand together
  const OLD = NC.ASSET_MANIFEST.greatsword;
  if (OLD && !OLD.big) { OLD.w = Math.round(OLD.w * 12) / 10; OLD.h = Math.round(OLD.h * 12) / 10; OLD.big = true; }

  // grade: level range, option rows a drop / craft starts with (bosses and the legend 3), what the blacksmith pays
  const GRADES = { 1: { lv: [1, 25], rows: 1, sell: 300 }, 2: { lv: [26, 50], rows: 2, sell: 1200 }, 3: { lv: [51, 75], rows: 2, sell: 4000 },
    4: { lv: [76, 99], rows: 3, sell: 10000 } };
  const KIND = { A: { th: 'ธรรมดา', rarity: 'common' }, B: { th: 'ออปพิเศษ', rarity: 'rare' }, C: { th: 'ปลุกเวท', rarity: 'epic' },
    D: { th: 'บอส', rarity: 'legend' }, L: { th: 'ตำนาน', rarity: 'legend' } };
  const TRAIL = { neutral: '236,236,245', water: '150,210,255', wind: '170,240,200', earth: '225,185,125', fire: '255,150,80', poison: '190,140,255',
    holy: '255,232,160', shadow: '175,140,235', ghost: '200,255,240' };

  // where a sword comes from: { mob: species (its drop), boss, chest, craft: {materials}, coins, shop: price, rare: Lv }
  const L = [
    // ---- grade 1 ----
    ['gs_training', 'ดาบใหญ่ไม้ฝึก', 1, 'A', 'neutral', 1, 54, 'ดาบไม้หนักไว้ฝึกตี', { shop: 500 }, [], 'ไม้ขัดหยาบ ๆ ปลายมน มีผ้าแดงผูกไว้'],
    ['gs_blackiron', 'ดาบใหญ่เหล็กดำ', 1, 'A', 'neutral', 10, 70, '—', { craft: { mat_boar_tusk: 10, mat_moss_shell: 5 }, coins: 2000 }, [], 'เหล็กดำตีมือ ของป๋าหมูหริ่ง'],
    ['gs_broad', 'ดาบใหญ่ใบกว้าง', 1, 'A', 'neutral', 18, 78, 'หนัก: ความเร็วโจมตี −5%', { mob: 'boar' }, [{ t: 'aspd', v: -5 }], 'ใบกว้างเท่าบานประตู การ์ดเป็นเขี้ยวหมูป่า'],
    ['gs_batfang', 'ดาบใหญ่เขี้ยวค้างคาว', 1, 'B', 'shadow', 14, 65, 'ตีดูดเลือด 3% ของดาเมจ แต่เสีย SP 1 ต่อครั้ง', { mob: 'bat' },
      [{ t: 'leech', pct: 3, sp: 1 }], 'เขี้ยวโค้งยาวสีม่วง การ์ดเป็นปีกค้างคาว'],
    ['gs_carrot', 'ดาบแครอทยักษ์', 1, 'B', 'earth', 8, 62, 'ฆ่าได้ฟื้น HP 2% (กรุบ!) · แรงกับพืช +20%', { mob: 'carrot' },
      [{ t: 'killHeal', pct: 2 }, { t: 'vsRace', race: 'plant', pct: 20 }], 'แครอทยักษ์ทั้งหัว ใบเขียวเป็นการ์ด'],
    ['gs_windleaf', 'ดาบใหญ่ใบไม้ลม', 1, 'C', 'wind', 12, 62, '10% ปล่อยใบมีดลมพุ่งเป็นแนว 150%', { mob: 'slime_green' },
      [{ t: 'proc', chance: 10, fx: 'windline', mul: 1.5 }], 'ใบไม้เรียวยาว ลายลมหมุน'],
    ['gs_clearwater', 'ดาบใหญ่น้ำใส', 1, 'C', 'water', 20, 62, '12% ติดเย็นเฉียบ (3 ชั้นแข็ง)', { mob: 'frog' },
      [{ t: 'status', chance: 12, st: 'chill', freeze3: true }], 'ใบดาบแก้วน้ำใส มีใบบัวจิ๋วที่การ์ด'],
    ['gs_batking', 'ดาบใหญ่ราชาค้างคาว', 1, 'D', 'shadow', 22, 81, 'กลางคืนดูดเลือด 4% ไม่เสีย SP · 5% ฝูงค้างคาวรุมเป้า 3 ครั้ง', { boss: 'bat_king' },
      [{ t: 'leech', pct: 4, night: true }, { t: 'proc', chance: 5, fx: 'bats', n: 3, mul: 0.7 }], 'ปีกค้างคาวพับเป็นใบดาบ มงกุฎทองตาแดง'],
    // ---- grade 2 ----
    ['gs_steel', 'ดาบใหญ่เหล็กกล้า', 2, 'A', 'neutral', 26, 110, '—', { craft: { mat_ant_shell: 12, mat_old_bone: 8 }, coins: 15000 }, [], 'ดาบสองมือเหล็กกล้าขัดเงา ด้ามหนังแดง'],
    ['gs_bonesoldier', 'ดาบใหญ่กระดูกทหาร', 2, 'A', 'neutral', 34, 117, '—', { mob: 'skeleton' }, [], 'แกนกระดูกยาว คมเหล็กสนิม ผ้าพันคอแดง'],
    ['gs_stumpthorn', 'ดาบใหญ่หนามตอไม้', 2, 'B', 'earth', 28, 101, 'ใครตีเราโดนสะท้อน 15% · DEF −5', { mob: 'stump' },
      [{ t: 'reflect', pct: 15 }, { t: 'stat', def: -5 }], 'ไม้บิดเบี้ยวมีหนามรอบใบ ตาปุ่มไม้ง่วง ๆ'],
    ['gs_ghostleech', 'ดาบใหญ่ผีดูดเลือด', 2, 'B', 'ghost', 40, 101, 'ดูดเลือด 6% แต่เสีย SP 3 ต่อครั้ง · ดาบธาตุผีเล่มเดียวในเกม', { mob: 'tombstone' },
      [{ t: 'leech', pct: 6, sp: 3 }], 'ใบดาบวิญญาณสีมิ้นต์ ขอบเป็นควันผี'],
    ['gs_eaglefeather', 'ดาบใหญ่ขนอินทรี', 2, 'B', 'wind', 44, 94, 'เบา: ความเร็วโจมตี +15%', { mob: 'storm_eagle' }, [{ t: 'aspd', v: 15 }], 'ขนนกยักษ์ทั้งเส้น เบาที่สุด'],
    ['gs_giantslayer', 'ดาบใหญ่นักล่ายักษ์', 2, 'B', 'neutral', 46, 99, 'บอสและมอนตัวใหญ่ +25% · ตัวเล็ก −10%', { chest: 'chest_iron' },
      [{ t: 'vsBig', pct: 25, small: -10 }], 'ยาวเกินตัว ปลายขอเกี่ยว มีรอยนับหัว'],
    ['gs_spiderfang', 'ดาบใหญ่เขี้ยวแมงมุม', 2, 'C', 'poison', 32, 95, '12% ติดพิษ + ใยทำให้ช้า', { mob: 'cave_spider' },
      [{ t: 'status', chance: 12, st: 'poison', slow: 2 }], 'เขี้ยวโค้งสีดำ ร่องพิษม่วงเขียว'],
    ['gs_ember', 'ดาบใหญ่ถ่านแดง', 2, 'C', 'fire', 36, 97, '12% ติดเผา', { mob: 'ember_fox' }, [{ t: 'status', chance: 12, st: 'burn' }], 'หินถ่านร้าว มีถ่านแดงคุ พู่หางจิ้งจอก'],
    ['gs_thunder', 'ดาบใหญ่ฟ้าร้อง', 2, 'C', 'wind', 42, 96, '8% ฟ้าผ่าลงเป้า 250% + ช็อต', { mob: 'cloud_ram' },
      [{ t: 'proc', chance: 8, fx: 'lightning', mul: 2.5, st: 'shock' }], 'ใบดาบรูปสายฟ้าซิกแซก เขาแกะม้วน'],
    ['gs_mushking', 'ดาบใหญ่ราชาเห็ด', 2, 'D', 'poison', 50, 126, '10% ระเบิดสปอร์พิษรอบเป้า · ศัตรูติดพิษโดนเรา +15%', { boss: 'mushking' },
      [{ t: 'proc', chance: 10, fx: 'spores', mul: 1.2, st: 'poison' }, { t: 'vsPoisoned', pct: 15 }], 'หมวกเห็ดม่วงเป็นการ์ด จุดเรืองแสงฟ้า'],
    ['gs_antqueen', 'ดาบใหญ่นางพญามด', 2, 'D', 'earth', 50, 126, '15% ติดร้าว (DEF ลด) · 3% เรียกมดทหารช่วยสู้ 10 วิ', { boss: 'ant_queen' },
      [{ t: 'status', chance: 15, st: 'crack' }, { t: 'summon', chance: 3, kind: 'ant', dur: 10, max: 2 }], 'เขี้ยวมดยักษ์สองอันประกบ มงกุฎทอง'],
    // ---- grade 3 ----
    ['gs_lunar', 'ดาบใหญ่จันทรา', 3, 'A', 'neutral', 52, 150, '—', { craft: { mat_ghost_flame: 10, mat_kappa_dish: 6 }, coins: 60000 }, [], 'เหล็กจันทราขาวเงิน มีช่องเสี้ยวจันทร์'],
    ['gs_redstone', 'ดาบใหญ่หินแดง', 3, 'A', 'earth', 60, 155, '—', { mob: 'golem' }, [], 'หินแดงก้อนโต แกนผลึกส้มที่การ์ด'],
    ['gs_ghosthunter', 'ดาบใหญ่ผู้ล่าผี', 3, 'B', 'holy', 55, 138, 'แรงกับอมตะ ผี เงา +25%', { mob: 'bone_knight' },
      [{ t: 'vsEl', els: ['undead', 'ghost', 'shadow'], pct: 25 }], 'เงินขอบทอง ตะเกียงแขวนที่การ์ด'],
    ['gs_maneater', 'ดาบใหญ่ดอกไม้กินคน', 3, 'B', 'poison', 58, 138, 'ฆ่าได้ฟื้น SP 3 · ดูดเลือด 2% จากศัตรูที่ติดพิษ', { mob: 'maneater' },
      [{ t: 'killSp', sp: 3 }, { t: 'leech', pct: 2, poisoned: true }], 'ใบกาบหอยมีฟัน ดอกแดงบานเป็นการ์ด'],
    ['gs_boilblood', 'ดาบใหญ่เลือดเดือด', 3, 'B', 'neutral', 64, 140, 'HP ยิ่งน้อยยิ่งแรง สูงสุด +30% ที่ HP 20%', { mob: 'wolf' },
      [{ t: 'lowHp', max: 30, at: 20 }], 'รางแก้วเลือดเดือดกลางใบ ขนหมาป่าที่การ์ด'],
    ['gs_newmooncurse', 'ดาบใหญ่คำสาปจันทร์ดับ', 3, 'B', 'shadow', 70, 171, 'แรงกว่าเกรดเดียวกัน 14% แต่ตีทุกครั้งเสีย HP 1%', { mob: 'mist_wraith' },
      [{ t: 'hpCost', pct: 1 }], 'ใบดาบดำหักเหลี่ยม ขอบเป็นควันม่วง'],
    ['gs_candlelight', 'ดาบใหญ่แสงเทียน', 3, 'C', 'holy', 60, 132, '7% แสงศักดิ์สิทธิ์ ฮีลเรา 3% และแผดเผารอบตัว 150%', { mob: 'candle_wisp' },
      [{ t: 'proc', chance: 7, fx: 'holyburst', mul: 1.5, heal: 3 }], 'เทียนขาวยาวเป็นใบดาบ มีเปลวไฟที่ปลาย'],
    ['gs_glacier', 'ดาบใหญ่ธารน้ำแข็ง', 3, 'C', 'water', 72, 133, '8% หนามน้ำแข็งพุ่งเป็นแนว 200% แข็ง 1 วิ', { mob: 'kappa' },
      [{ t: 'proc', chance: 8, fx: 'icespikes', mul: 2, freeze: 1 }], 'ผลึกน้ำแข็งเหลี่ยม หนามน้ำแข็งงอกหลังใบ'],
    ['gs_lava', 'ดาบใหญ่ลาวา', 3, 'C', 'fire', 74, 133, '10% เสาเพลิงใต้เป้า 220% + เผา', { mob: 'magma_golem' },
      [{ t: 'proc', chance: 10, fx: 'firepillar', mul: 2.2, st: 'burn' }], 'ออบซิเดียนดำ ลาวาไหลกลางใบ'],
    ['gs_graveking', 'ดาบใหญ่ราชาสุสาน', 3, 'D', 'shadow', 55, 173, 'ฆ่าได้เรียกทหารกระดูกช่วยสู้ 10 วิ (สูงสุด 2) · 5% คำสาป', { boss: 'crypt_lord' },
      [{ t: 'killSummon', kind: 'skeleton', dur: 10, max: 2 }, { t: 'status', chance: 5, st: 'curse' }], 'ใบดาบรูปฝาโลง ตะเกียงไฟฟ้าที่ด้าม'],
    // ---- grade 4 ----
    ['gs_meteor', 'ดาบใหญ่ดาวตก', 4, 'A', 'neutral', 76, 190, '—', { craft: { mat_worm_plate: 12, mat_beetle_horn: 8, mat_magma_core: 4 }, coins: 250000 }, [],
      'เหล็กอุกกาบาตลายจุดเหมือนทางช้างเผือก'],
    ['gs_ancientwood', 'ดาบใหญ่ไม้โบราณ', 4, 'A', 'earth', 82, 186, 'VIT +8', { mob: 'elder_treant' }, [{ t: 'stat', vit: 8 }], 'เปลือกไม้โบราณ อักษรเรืองเขียว ยางอำพัน'],
    ['gs_volcanic', 'ดาบใหญ่หินภูเขาไฟ', 4, 'A', 'fire', 84, 195, '—', { mob: 'lava_worm' }, [], 'เสาหินบะซอลต์หกเหลี่ยม รอยต่อลาวา'],
    ['gs_rhinohorn', 'ดาบใหญ่เขาด้วงแรด', 4, 'B', 'neutral', 80, 175, 'ฟันทะลุ: ตัวหลังเป้าโดน 40% · ผลักกระเด็นไกล', { mob: 'rhino_beetle' },
      [{ t: 'pierce', pct: 40, kb: 1.6 }], 'เขาด้วงแรดโค้งไปข้างหน้า เปลือกเหลือบรุ้ง'],
    ['gs_endlessnight', 'ดาบใหญ่ราตรีนิรันดร์', 4, 'B', 'shadow', 88, 179, 'กลางคืน +20% · กลางวัน −10%', { mob: 'shadow_heron' },
      [{ t: 'night', night: 20, day: -10 }], 'ท้องฟ้ากลางคืนในใบดาบ การ์ดขนนกกระสา'],
    ['gs_raptortail', 'ดาบใหญ่หางแร็พเตอร์', 4, 'C', 'wind', 78, 167, '15% ลงเลือดไหล', { mob: 'raptor' }, [{ t: 'status', chance: 15, st: 'bleed' }],
      'หางไดโนเสาร์เกล็ดเขียว กรงเล็บตามขอบ'],
    ['gs_impflame', 'ดาบใหญ่เปลวอิมป์', 4, 'C', 'fire', 86, 168, '10% ลูกไฟ 2 ลูกพุ่งตามเป้า 120%', { mob: 'fire_imp' },
      [{ t: 'proc', chance: 10, fx: 'fireballs', n: 2, mul: 1.2 }], 'ปลายแตกเป็นสามง่ามเปลวไฟ เขาอิมป์'],
    ['gs_meteorstorm', 'ดาบใหญ่พายุดาวตก', 4, 'C', 'neutral', 90, 167, '5% อุกกาบาตตกใส่ 400% วงกว้าง', { rare: 76 },
      [{ t: 'proc', chance: 5, fx: 'meteor', mul: 4 }], 'เศษหินลอยต่อกันด้วยพลังฟ้า ปลายเป็นอุกกาบาต'],
    ['gs_lavadragon', 'ดาบใหญ่มังกรลาวา', 4, 'D', 'fire', 92, 218, '10% ลมหายใจมังกรเป็นกรวย 300% + เผา · ต้านไฟ 20%', { boss: 'lava_dragon' },
      [{ t: 'proc', chance: 10, fx: 'breath', mul: 3, st: 'burn' }, { t: 'resist', el: 'fire', pct: 20 }], 'หัวมังกรอ้าปากเป็นการ์ด เกล็ดดำสันลาวา'],
    ['gs_midnightsun', 'ดาบใหญ่ตะวันเที่ยงคืน', 4, 'L', 'holy', 95, 246, 'ตีครบ 5 ครั้งปล่อยคลื่นเสี้ยวจันทร์ 250% · กลางวันธาตุแสง กลางคืนธาตุเงา',
      { craft: { mat_bat_crown: 1, mat_queen_tiara: 1, mat_lord_crown: 1, mat_dragon_heart: 1, mat_king_crown: 1 }, coins: 1000000, forge: true },
      [{ t: 'every', n: 5, fx: 'crescent', mul: 2.5 }, { t: 'dayNight', day: 'holy', night: 'shadow' }], 'ครึ่งทองกลางวัน ครึ่งครามกลางคืน สุริยุปราคาที่การ์ด'],
  ];

  const T = ITEMS.greatsword; // the moves, grip and feel of the old greatsword
  const GS = (NC.GS = { GRADES, KIND, list: [], byId: {} });
  for (const [id, name, grade, kind, el, lv, atk, text, src, abil, look] of L) {
    const it = {
      slot: 'weapon', wtype: 'gsword', sprite: id, name, rarity: KIND[kind].rarity, style: 'swing',
      dmg: [Math.round(atk * 0.88), Math.round(atk * 1.12)], hitK: T.hitK, cd: T.cd, dur: T.dur, hitAt: T.hitAt, reach: T.reach, arc: T.arc, kb: T.kb,
      grip: T.grip, restAng: T.restAng, stance: T.stance, behind: true, twoHanded: true, grip2: T.grip2, tuck: T.tuck, aspd: T.aspd,
      trailRgb: TRAIL[el] || TRAIL.neutral, slow: T.slow, sig: T.sig, element: el === 'neutral' ? undefined : el,
      gs: { grade, kind, atk, lv, text, src, abil, look }, lvReq: lv, // (js/wbag.js makes them copies with rows: `inst`)
      desc: look,
    };
    const m = (NC.ASSET_MANIFEST_GS || {})[id];
    if (m && m.grip) it.grip = m.grip; // (where the hand holds, measured on the picture by tools/gs_art.py)
    it.id = id;
    ITEMS[id] = it;
    GS.list.push(id);
    GS.byId[id] = it;
  }
  // the old greatsword keeps its stats; it counts as the 40th (grade 2, holy) in the lists
  GS.all = ['greatsword', ...GS.list];
  // the item order (js/items.js exposes its ORDER: the drop pool): their own order, grade by grade
  if (NC.ITEM_ORDER) for (const id of GS.list) if (!NC.ITEM_ORDER.includes(id)) NC.ITEM_ORDER.push(id);
})();
