/* monsters3.js — the monsters of the third batch of fields (js/fields3.js), eighteen new species on monsters.js's four
   ways of moving and fighting (hop / melee / charge / fly), plus some old ones living in the new places:
     ป่าไหม้ถ่านคุ (burnt)       ember fox (fast dash) · charred stump (slam) · ash wisp (ghost element) · lava slime
     ทุ่งลมหวีดหน้าผา (wind)      storm eagle (fast swoop) · cloud ram (leaves you alone until hit) · gust sprite · bee
     หนองพิษป่าชายเลน (swamp)    poison toad · swamp snake · man-eater flower (slow, long reach, earth) · glow slime
     ภูเขาไฟหลับ (volcano)       salamander · magma golem (heavy slam) · flame bat · lava slime · scorpion
     ทะเลสาบหมอกเงา (lake)       kappa · mist wraith (shadow, see-through) · shadow heron (a long beak lunge) · bat
     ป่าดึกดำบรรพ์ (prime)       leaf raptor (leaping dash) · rhino beetle (armoured charge) · elder treant (huge slam)
                                · wolf
   Data only: 'passive' and 'seeThrough' are handled by monsters2.js for every species. Also their materials.
   Art: assets/monsters/ (+ monsters.manifest.js) from assets/gen/make_monster3_prompts.py -> Codex ->
   tools/monster_cut.py. Load after monsters2.js. */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC.SPECIES || !NC.ROSTER) return;

  // the same bases as monsters.js
  const SLIME = { kind: 'hop', r: 26, hpK: 0.65, atkK: 0.75, defK: 0.4, mdefK: 1.2, agiK: 0.3, dexK: 0.5, expK: 0.8, spd: 0, aggro: 480 };
  const MON = { r: 24, hpK: 1, atkK: 1, defK: 1, mdefK: 0.5, agiK: 0.6, dexK: 0.7, expK: 1.2, spd: 150, aggro: 560 };
  const sp = (base, o) => Object.assign({}, base, o);
  const SPECIES = {
    // ---- the burnt charcoal forest ----
    ember_fox: sp(MON, { name: 'จิ้งจอกถ่านแดง', kind: 'charge', element: 'fire', atkElement: 'fire', r: 26, hpK: 0.95, atkK: 1.15, defK: 0.8,
      mdefK: 0.6, agiK: 1.3, dexK: 1, expK: 1.25, spd: 190, aggro: 600, color: '255,130,60', dash: [320, 780, 0.36], leap: 20,
      dust: '120,100,100', shadow: [54, 14], light: [110, '255,140,60'] }),
    char_stump: sp(MON, { name: 'ตอไม้ถ่านคุ', kind: 'melee', element: 'fire', atkElement: 'fire', r: 32, hpK: 1.45, atkK: 1.1, defK: 1.4,
      mdefK: 0.5, agiK: 0.2, dexK: 0.6, expK: 1.35, spd: 80, aggro: 480, color: '90,80,80', reach: 100, windup: 0.7, lunge: 100,
      slam: 120, recover: 0.85, dust: '90,80,80', shadow: [56, 16], light: [120, '255,130,60'] }),
    ash_wisp: sp(MON, { name: 'ภูตเถ้าถ่าน', kind: 'fly', element: 'ghost', atkElement: 'fire', r: 24, hpK: 0.75, atkK: 1, defK: 0.4,
      mdefK: 1.1, agiK: 1.1, dexK: 0.9, expK: 1.3, spd: 150, aggro: 560, color: '180,170,170', hover: 60, swoop: 520, flap: 5,
      light: [180, '255,150,80'], seeThrough: 0.85 }),
    // ---- the howling wind cliffs ----
    storm_eagle: sp(MON, { name: 'อินทรีพายุ', kind: 'fly', element: 'wind', atkElement: 'wind', r: 24, hpK: 0.85, atkK: 1.1, defK: 0.6,
      mdefK: 0.7, agiK: 1.4, dexK: 1.1, expK: 1.3, spd: 210, aggro: 640, color: '170,190,210', hover: 70, swoop: 760, flap: 12 }),
    cloud_ram: sp(MON, { name: 'แกะเมฆเขาม้วน', kind: 'charge', element: 'wind', atkElement: 'neutral', r: 30, hpK: 1.3, atkK: 1.1, defK: 1.1,
      mdefK: 0.6, agiK: 0.5, dexK: 0.7, expK: 1.3, spd: 120, aggro: 520, passive: true, color: '240,240,250', dash: [320, 660, 0.46],
      dust: '220,220,230', shadow: [58, 16] }),
    gust_sprite: sp(SLIME, { name: 'ภูตลมหมุน', element: 'wind', atkElement: 'wind', hpK: 0.8, atkK: 0.9, defK: 0.5, agiK: 0.6, expK: 1,
      color: '170,230,170' }),
    // ---- the poison mangrove swamp ----
    poison_toad: sp(SLIME, { name: 'คางคกพิษ', element: 'poison', atkElement: 'poison', hpK: 0.95, atkK: 0.95, defK: 0.7, mdefK: 1, expK: 1.05,
      color: '160,90,200', light: [90, '170,255,130'] }),
    swamp_snake: sp(MON, { name: 'งูหนองพิษ', kind: 'charge', element: 'poison', atkElement: 'poison', r: 26, hpK: 1, atkK: 1.2, defK: 0.9,
      mdefK: 0.6, agiK: 1, dexK: 1, expK: 1.35, spd: 150, aggro: 560, color: '130,80,170', dash: [280, 700, 0.34], dust: '110,120,90',
      shadow: [52, 14] }),
    maneater: sp(MON, { name: 'ดอกไม้กินคน', kind: 'melee', element: 'earth', atkElement: 'poison', r: 34, hpK: 1.6, atkK: 1.2, defK: 1,
      mdefK: 0.6, agiK: 0.15, dexK: 0.8, expK: 1.5, spd: 45, aggro: 420, color: '170,90,200', reach: 150, windup: 0.6, lunge: 90,
      recover: 0.8, slash: '200,255,150', shadow: [60, 16] }),
    // ---- the sleeping volcano ----
    salamander: sp(MON, { name: 'ซาลาแมนเดอร์', kind: 'charge', element: 'fire', atkElement: 'fire', r: 26, hpK: 1.1, atkK: 1.2, defK: 1.2,
      mdefK: 0.6, agiK: 0.9, dexK: 1, expK: 1.4, spd: 150, aggro: 580, color: '255,110,60', dash: [300, 700, 0.4], dust: '160,90,70',
      shadow: [52, 13], light: [120, '255,140,60'] }),
    magma_golem: sp(MON, { name: 'โกเลมลาวา', kind: 'melee', element: 'fire', atkElement: 'fire', r: 44, hpK: 2, atkK: 1.35, defK: 1.8,
      mdefK: 0.6, agiK: 0.1, dexK: 0.7, expK: 1.7, spd: 62, aggro: 500, color: '255,120,50', reach: 130, windup: 0.9, lunge: 50,
      slam: 160, recover: 1.05, heavy: true, dust: '140,90,70', shadow: [84, 22], light: [200, '255,130,50'] }),
    fire_bat: sp(MON, { name: 'ค้างคาวเปลวไฟ', kind: 'fly', element: 'fire', atkElement: 'fire', r: 22, hpK: 0.8, atkK: 1.05, defK: 0.6,
      mdefK: 0.8, agiK: 1.3, dexK: 1, expK: 1.25, spd: 185, aggro: 560, color: '255,120,60', hover: 50, swoop: 620, flap: 16,
      light: [140, '255,140,60'] }),
    // ---- the misty shadow lake ----
    kappa: sp(MON, { name: 'กัปปะหนองหมอก', kind: 'melee', element: 'water', atkElement: 'water', r: 28, hpK: 1.3, atkK: 1.15, defK: 1.2,
      mdefK: 0.7, agiK: 0.7, dexK: 0.9, expK: 1.4, spd: 110, aggro: 540, color: '110,190,120', reach: 96, windup: 0.5, lunge: 240,
      recover: 0.7, slash: '150,210,255' }),
    mist_wraith: sp(MON, { name: 'ภูตหมอกเงา', kind: 'fly', element: 'shadow', atkElement: 'shadow', r: 26, hpK: 0.95, atkK: 1.15, defK: 0.5,
      mdefK: 1.2, agiK: 1, dexK: 1, expK: 1.45, spd: 140, aggro: 580, color: '120,110,200', hover: 66, swoop: 520, flap: 4,
      light: [160, '140,150,255'], seeThrough: 0.8 }),
    shadow_heron: sp(MON, { name: 'นกกระสาเงา', kind: 'melee', element: 'water', atkElement: 'shadow', r: 26, hpK: 1.1, atkK: 1.3, defK: 0.9,
      mdefK: 0.8, agiK: 1.1, dexK: 1.2, expK: 1.45, spd: 140, aggro: 600, color: '90,90,140', reach: 140, windup: 0.55, lunge: 420,
      recover: 0.7, slash: '190,170,255' }),
    // ---- the primeval forest ----
    raptor: sp(MON, { name: 'แร็พเตอร์ใบไม้', kind: 'charge', element: 'earth', atkElement: 'neutral', r: 28, hpK: 1.15, atkK: 1.3, defK: 1,
      mdefK: 0.5, agiK: 1.3, dexK: 1.1, expK: 1.5, spd: 200, aggro: 640, color: '120,180,90', dash: [340, 820, 0.4], leap: 36,
      dust: '120,110,80', shadow: [60, 15] }),
    elder_treant: sp(MON, { name: 'ต้นไม้ยักษ์โบราณ', kind: 'melee', element: 'earth', atkElement: 'earth', r: 50, hpK: 2.4, atkK: 1.4, defK: 1.6,
      mdefK: 0.8, agiK: 0.05, dexK: 0.7, expK: 1.9, spd: 50, aggro: 480, color: '120,150,80', reach: 150, windup: 1, lunge: 40,
      slam: 190, recover: 1.2, heavy: true, dust: '110,100,70', shadow: [100, 26] }),
    rhino_beetle: sp(MON, { name: 'ด้วงแรดยักษ์', kind: 'charge', element: 'earth', atkElement: 'earth', r: 34, hpK: 1.6, atkK: 1.25, defK: 2,
      mdefK: 0.5, agiK: 0.4, dexK: 0.8, expK: 1.6, spd: 110, aggro: 520, color: '90,110,70', dash: [340, 700, 0.5], dust: '120,110,80',
      shadow: [66, 18], heavy: true }),
  };
  Object.assign(NC.SPECIES, SPECIES);
  Object.assign(NC.MONSTERS, SPECIES);

  // who lives where (monsters.js ROSTER: the maps' 'slime' / 'hollow' slots, by zone; '*' = the rest of the map)
  Object.assign(NC.ROSTER, {
    burnt: {
      '*': { slime: [['slime_lava', 2], ['ash_wisp', 1]], hollow: [['ember_fox', 2], ['char_stump', 1]] },
      'ทุ่งเถ้าถ่าน': { slime: [['ash_wisp', 2], ['slime_lava', 1]], hollow: [['char_stump', 2], ['ember_fox', 1]] },
    },
    wind: {
      '*': { slime: [['gust_sprite', 2], ['bee', 1]], hollow: [['cloud_ram', 2], ['storm_eagle', 1]] },
      'ยอดผาลมแรง': { slime: [['gust_sprite', 1]], hollow: [['storm_eagle', 2], ['cloud_ram', 1]] },
    },
    swamp: {
      '*': { slime: [['poison_toad', 2], ['slime_glow', 1]], hollow: [['swamp_snake', 2], ['maneater', 1]] },
      'ใจกลางหนองพิษ': { slime: [['poison_toad', 1]], hollow: [['maneater', 2], ['swamp_snake', 1]] },
    },
    volcano: {
      '*': { slime: [['slime_lava', 1], ['fire_bat', 1]], hollow: [['salamander', 2], ['magma_golem', 1], ['scorpion', 1]] },
      'สุสานมังกร': { slime: [['fire_bat', 1]], hollow: [['magma_golem', 2], ['salamander', 1]] },
    },
    lake: {
      '*': { slime: [['kappa', 2], ['bat', 1]], hollow: [['mist_wraith', 2], ['shadow_heron', 1]] },
      'ฝั่งเหนือหมอกหนา': { slime: [['kappa', 1]], hollow: [['shadow_heron', 2], ['mist_wraith', 1]] },
    },
    prime: {
      '*': { slime: [['raptor', 1], ['wolf', 1]], hollow: [['rhino_beetle', 2], ['elder_treant', 1]] },
      'หุบรังไข่': { slime: [['raptor', 1]], hollow: [['raptor', 1], ['rhino_beetle', 1]] },
      'ใจกลางป่าโบราณ': { slime: [['raptor', 1]], hollow: [['elder_treant', 2], ['rhino_beetle', 1], ['raptor', 1]] },
    },
  });

  // ---------------- what they drop (materials.js: sold to ลุงโกโก้, or in a player shop) ----------------
  if (NC.MATERIALS && NC.MAT_DROPS) {
    Object.assign(NC.MATERIALS, {
      mat_charcoal: { name: 'ถ่านไม้คุไฟ', price: 66, desc: 'ก้อนถ่านจากตอไม้ถ่านคุ ข้างในยังคุแดงอุ่น ๆ' },
      mat_ember_tail: { name: 'ปลายหางไฟจิ้งจอก', price: 72, desc: 'ขนหางสีเทาเข้ม ปลายเป็นเปลวไฟเล็ก ๆ ที่ไม่เคยดับ' },
      mat_gust_orb: { name: 'ลูกแก้วลมหมุน', price: 76, desc: 'ลูกแก้วใส ข้างในมีลมหมุนวนกับใบไม้จิ๋วสองใบ' },
      mat_ash_dust: { name: 'ผงเถ้าวิญญาณ', price: 78, desc: 'ผงเถ้าสีเทาในขวดเล็ก เรืองแสงส้มจาง ๆ ตอนกลางคืน' },
      mat_cloud_wool: { name: 'ขนแกะเมฆ', price: 84, desc: 'ก้อนขนแกะนุ่มฟูเบาหวิว เหมือนดึงเมฆลงมาได้ก้อนหนึ่ง' },
      mat_storm_feather: { name: 'ขนอินทรีพายุ', price: 92, desc: 'ขนปีกสีเทาฟ้า มีประกายไฟฟ้าวิ่งตามก้านขน' },
      mat_toad_gland: { name: 'ต่อมพิษคางคก', price: 108, desc: 'ต่อมพิษสีม่วงของคางคกพิษ จับแล้วต้องล้างมือทันที' },
      mat_snake_skin: { name: 'คราบงูหนองพิษ', price: 124, desc: 'คราบงูสีม่วงลายเขียว บางเหมือนกระดาษ' },
      mat_maneater_pollen: { name: 'เกสรดอกไม้กินคน', price: 132, desc: 'เกสรสีเขียวเรืองแสงในห่อใบไม้ หอมหวานแต่อันตราย' },
      mat_fire_wing: { name: 'ปีกค้างคาวเปลวไฟ', price: 168, desc: 'แผ่นปีกสีส้มแดงที่อุ่นตลอดเวลา เหมือนถือเปลวไฟไว้' },
      mat_salamander_scale: { name: 'เกล็ดซาลาแมนเดอร์', price: 176, desc: 'เกล็ดสีแดงส้มมีจุดเหลืองเรืองแสง ทนไฟได้ดีเยี่ยม' },
      mat_kappa_dish: { name: 'จานน้ำบนหัวกัปปะ', price: 184, desc: 'จานเล็ก ๆ ที่ยังมีน้ำใสอยู่ ห้ามทำหกเด็ดขาด' },
      mat_heron_plume: { name: 'ขนหางนกกระสาเงา', price: 190, desc: 'ขนยาวสีน้ำเงินเทา มีเงาดำจาง ๆ ลอยตามปลายขน' },
      mat_mist_veil: { name: 'ผ้าคลุมหมอกเงา', price: 196, desc: 'ผืนผ้าบางที่ทอจากหมอก เย็นเฉียบเมื่อแตะ' },
      mat_raptor_claw: { name: 'กรงเล็บแร็พเตอร์', price: 214, desc: 'กรงเล็บโค้งคมเป็นรูปเคียว ของแร็พเตอร์ใบไม้' },
      mat_magma_core: { name: 'แกนลาวาเดือด', price: 220, desc: 'ก้อนหินดำที่ข้างในมีลาวาเรืองแสงไหลวน ร้อนมาก' },
      mat_beetle_horn: { name: 'เขาด้วงแรด', price: 236, desc: 'เขาด้วงสีเขียวบรอนซ์ แข็งเหมือนเหล็กกล้า' },
      mat_ancient_sap: { name: 'ยางไม้โบราณ', price: 260, desc: 'ยางไม้สีอำพันจากต้นไม้ยักษ์โบราณ มีใบเฟิร์นจิ๋วติดอยู่ข้างใน' },
    });
    Object.assign(NC.MAT_DROPS, {
      ember_fox: [['mat_ember_tail', 0.55]], char_stump: [['mat_charcoal', 0.6]], ash_wisp: [['mat_ash_dust', 0.55]],
      storm_eagle: [['mat_storm_feather', 0.55]], cloud_ram: [['mat_cloud_wool', 0.6]], gust_sprite: [['mat_gust_orb', 0.6]],
      poison_toad: [['mat_toad_gland', 0.6]], swamp_snake: [['mat_snake_skin', 0.55]], maneater: [['mat_maneater_pollen', 0.55]],
      salamander: [['mat_salamander_scale', 0.55]], magma_golem: [['mat_magma_core', 0.5]], fire_bat: [['mat_fire_wing', 0.55]],
      kappa: [['mat_kappa_dish', 0.55]], mist_wraith: [['mat_mist_veil', 0.5]], shadow_heron: [['mat_heron_plume', 0.55]],
      raptor: [['mat_raptor_claw', 0.55]], elder_treant: [['mat_ancient_sap', 0.5]], rhino_beetle: [['mat_beetle_horn', 0.5]],
    });
  }
})();
