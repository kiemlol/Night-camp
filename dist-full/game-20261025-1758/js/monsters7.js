/* monsters7.js — the monsters of the new hunting sections (js/fields6.js; design 2026-10-14 "เขตล่าและผู้ถูกรากสิง").
   Every section holds 6 kinds: 3 of its area, 2 of its own, 1 rare form. Pilot area ไร่ฟักทอง; each new species fights
   in a way the area did not have yet (monkinds.js's kinds):
     straw_shooter  หุ่นฟางยิงเมล็ด     ranged    เขาวงกตข้าวโพด  shoots hard kernels from a corn-cob cannon, keeps away
     popcorn_pod    ฝักข้าวโพดป๊อป     bomber    เขาวงกตข้าวโพด  runs in, swells up and pops (fire)
     black_ewe      แม่แกะดำ          summoner  คอกสัตว์ร้าง    calls up to three black lambs (black_lamb: only as her lambs)
     stitch_doll    ตุ๊กตาฟางเย็บแผล   healer    คอกสัตว์ร้าง    sews the others back up: hit it first
   + the rare forms, monsters6.js's hue-shifted zone forms (HP x1.8, EXP x2; about 1 in 30 of a section's monsters):
     straw_shooter_ember (เขาวงกต), black_ewe_frost (คอกสัตว์ร้าง)
   Materials: one each (assets/shop: assets/gen/make_shop7_prompts.py -> tools/shop_art.py). Gear tables come with the
   next drop_plan.py run (each item keeps exactly one source). Art: assets/monsters/ (make_monster7_prompts.py ->
   run_mon7.sh -> cut_mon7.sh). Load after monsters6.js. */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC.SPECIES || !NC.ROSTER) return;
  // the same bases as monsters.js
  const MON = { r: 24, hpK: 1, atkK: 1, defK: 1, mdefK: 0.5, agiK: 0.6, dexK: 0.7, expK: 1.2, spd: 150, aggro: 560 };
  const sp = (base, o) => Object.assign({}, base, o);
  const SPECIES = {
    straw_shooter: sp(MON, { name: 'หุ่นฟางยิงเมล็ด', kind: 'ranged', hpK: 0.9, atkK: 1.0, defK: 0.7, mdefK: 0.8, agiK: 0.8, dexK: 1.1,
      expK: 1.3, spd: 120, aggro: 600, range: 380, fire: 2.2, element: 'earth', atkElement: 'neutral',
      shot: { rgb: '245,210,90', speed: 600, size: 10, n: 3, spread: 0.2 }, r: 24, color: '205,175,95', dust: '200,170,100' }),
    popcorn_pod: sp(MON, { name: 'ฝักข้าวโพดป๊อป', kind: 'bomber', hpK: 0.7, atkK: 1.1, defK: 0.6, mdefK: 0.6, agiK: 0.9, dexK: 0.9,
      expK: 1.2, spd: 150, aggro: 560, blast: 150, blastMul: 2.2, fuse: 1.1, element: 'fire', atkElement: 'fire', r: 26,
      color: '250,225,130', light: [90, '255,190,90'] }),
    black_ewe: sp(MON, { name: 'แม่แกะดำ', kind: 'summoner', hpK: 1.1, atkK: 0.8, defK: 0.9, mdefK: 1.0, agiK: 0.5, dexK: 0.9,
      expK: 1.45, spd: 100, aggro: 580, range: 330, every: 7, element: 'shadow', atkElement: 'neutral', minion: ['black_lamb', 3],
      shot: { rgb: '220,70,80', mul: 0.6, size: 12 }, r: 32, color: '70,60,80', heavy: true }),
    black_lamb: sp(MON, { name: 'ลูกแกะดำ', kind: 'charge', hpK: 0.5, atkK: 0.8, defK: 0.6, mdefK: 0.5, agiK: 1.0, dexK: 0.9, expK: 0.6,
      spd: 170, aggro: 600, dash: [240, 620, 0.32], leap: 14, element: 'shadow', atkElement: 'neutral', dust: '120,110,120', r: 20,
      color: '70,60,80' }),
    stitch_doll: sp(MON, { name: 'ตุ๊กตาฟางเย็บแผล', kind: 'healer', hpK: 0.9, atkK: 0.7, defK: 0.7, mdefK: 1.3, agiK: 0.6, dexK: 0.9,
      expK: 1.4, spd: 110, aggro: 560, range: 300, every: 5, heal: 0.18, element: 'earth', atkElement: 'neutral',
      shot: { rgb: '230,70,80', mul: 0.5, size: 10 }, r: 24, color: '215,185,115' }),
  };
  Object.assign(NC.SPECIES, SPECIES);
  Object.assign(NC.MONSTERS, SPECIES);

  // the rare forms: monsters6.js's zone forms (its loader hue-shifts the base's two poses for every eliteOf species)
  const ELITE = { hpK: 1.8, atkK: 1.25, defK: 1.2, expK: 2 };
  const elite = (id, base, suffix, hue) => {
    const B = NC.SPECIES[base];
    if (!B) return;
    const o = Object.assign({}, B, { name: B.name + ' · ' + suffix, hue, eliteOf: base });
    for (const k in ELITE) o[k] = (B[k] || 1) * ELITE[k];
    NC.SPECIES[id] = o; NC.MONSTERS[id] = o;
  };
  elite('straw_shooter_ember', 'straw_shooter', 'ร่างฟางไฟ', 335);
  elite('black_ewe_frost', 'black_ewe', 'ร่างตาน้ำแข็ง', 190);

  // who lives where (monsters.js ROSTER: the maps' 'slime' / 'hollow' slots, by zone; '*' = the rest of the map)
  Object.assign(NC.ROSTER, {
    cornmaze: {
      '*': { slime: [['popcorn_pod', 2], ['crow', 1]], hollow: [['straw_shooter', 3], ['scarecrow', 1], ['angry_rooster', 1], ['straw_shooter_ember', 0.15]] },
      'ลานหุ่นไล่กายักษ์': { slime: [['popcorn_pod', 1]], hollow: [['straw_shooter', 2], ['scarecrow', 2]] },
      'ทางเข้าเขาวงกต': { slime: [['crow', 1], ['popcorn_pod', 1]], hollow: [['angry_rooster', 1], ['straw_shooter', 1]] },
    },
    pens: {
      '*': { slime: [['potato_walker', 2], ['crow_red', 1]], hollow: [['black_ewe', 3], ['stitch_doll', 2], ['bucket_scarecrow', 1], ['black_ewe_frost', 0.15]] },
      'คอกแกะดำ': { slime: [['potato_walker', 1]], hollow: [['black_ewe', 3], ['stitch_doll', 1]] },
    },
  });

  // materials: each species its own (the rare forms carry their base's at x1.5); prices at the B1–B3 band Lv 10–18 (areas_build.py's rule)
  if (NC.MATERIALS && NC.MAT_DROPS) {
    Object.assign(NC.MATERIALS, {
      mat_hard_kernel: { name: 'เมล็ดข้าวโพดแข็ง', price: 30, desc: 'เมล็ดข้าวโพดแห้งแข็งเหมือนหิน หุ่นฟางยัดไว้ยิงจากซังข้าวโพด' },
      mat_popcorn: { name: 'ป๊อปคอร์นระเบิด', price: 30, desc: 'ป๊อปคอร์นที่ยังอุ่นจากฝักข้าวโพดที่แตกตัว หอมแต่ไม่ควรกิน' },
      mat_cracked_bell: { name: 'กระดิ่งแกะร้าว', price: 30, desc: 'กระดิ่งทองเหลืองร้าวที่คอแม่แกะดำ เขย่าแล้วเสียงแหบ' },
      mat_stitch_needle: { name: 'เข็มเย็บด้ายแดง', price: 30, desc: 'เข็มเล่มโตร้อยด้ายแดง ตุ๊กตาฟางใช้เย็บพวกเดียวกันที่ขาด' },
    });
    Object.assign(NC.MAT_DROPS, {
      straw_shooter: [['mat_hard_kernel', 0.55]], popcorn_pod: [['mat_popcorn', 0.55]],
      black_ewe: [['mat_cracked_bell', 0.5]], stitch_doll: [['mat_stitch_needle', 0.5]],
      straw_shooter_ember: [['mat_hard_kernel', 0.82]], black_ewe_frost: [['mat_cracked_bell', 0.75]],
    });
  }
})();
