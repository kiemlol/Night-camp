/* monsters2.js — the monsters of the second batch of fields (js/fields2.js), ten new species built on monsters.js's
   four ways of moving and fighting (hop / melee / charge / fly):
     ไร่ฟักทอง (farm)          pumpkin (hop) and carrot (charge) leave you alone until you hit them (passive, like
                              a classic MMO's first slimes); the crows don't
     บึงกบลำธารใส (marsh)       frog (hop), river crab (charge), dragonfly (fly: fast, hard to hit), snapping turtle
                              (a slow slam, very high DEF and low MDEF: magic works, blades bounce off)
     เนินสุสานโบสถ์ร้าง (graveyard) zombie (undead, slow, tough), ghost (ghost element: plain physical hits do 25%),
                              haunted headstone (shadow, a heavy slam)
   Data only, plus three small wraps: a passive monster sees nobody (game.player is swapped for a far-away stand-in
   during its update) until something hits it (a passive species, or any monster of a passive zone: fields2.js, the
   farm's newbie meadow); ghosts are drawn a little see-through; and the materials they drop.
   Art: assets/monsters/ (+ monsters.manifest.js) from assets/gen/make_monster2_prompts.py -> Codex ->
   tools/monster_cut.py. Load after materials.js (NC.MATERIALS / NC.MAT_DROPS). */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC.SPECIES || !NC.ROSTER) return;

  // the same bases as monsters.js
  const SLIME = { kind: 'hop', r: 26, hpK: 0.65, atkK: 0.75, defK: 0.4, mdefK: 1.2, agiK: 0.3, dexK: 0.5, expK: 0.8, spd: 0, aggro: 480 };
  const MON = { r: 24, hpK: 1, atkK: 1, defK: 1, mdefK: 0.5, agiK: 0.6, dexK: 0.7, expK: 1.2, spd: 150, aggro: 560 };
  const sp = (base, o) => Object.assign({}, base, o);
  const SPECIES = {
    // ---- the pumpkin farm ----
    pumpkin: sp(SLIME, { name: 'ฟักทองจอมซน', element: 'earth', atkElement: 'earth', hpK: 0.8, defK: 0.6, mdefK: 0.9, expK: 0.9,
      passive: true, color: '255,150,60', light: [120, '255,170,80'] }),
    carrot: sp(MON, { name: 'แครอทจอมพุ่ง', kind: 'charge', element: 'earth', atkElement: 'earth', r: 24, hpK: 0.9, atkK: 0.95, defK: 0.8,
      mdefK: 0.5, agiK: 0.8, dexK: 0.7, expK: 1.1, spd: 120, aggro: 520, passive: true, color: '255,140,60', dash: [300, 620, 0.42],
      dust: '160,120,80', shadow: [40, 12] }),
    crow: sp(MON, { name: 'อีกาขโมยข้าวโพด', kind: 'fly', element: 'wind', atkElement: 'neutral', r: 22, hpK: 0.65, atkK: 0.8, defK: 0.5,
      mdefK: 0.6, agiK: 1.3, dexK: 0.9, expK: 1.05, spd: 175, aggro: 540, color: '90,90,120', hover: 50, swoop: 600, flap: 14 }),
    // ---- the frog marsh ----
    frog: sp(SLIME, { name: 'กบบึงใส', element: 'water', atkElement: 'water', hpK: 0.8, atkK: 0.85, expK: 0.95, color: '110,200,110' }),
    crab: sp(MON, { name: 'ปูก้ามโตลำธาร', kind: 'charge', element: 'water', atkElement: 'water', r: 28, hpK: 1.1, atkK: 1.05, defK: 1.5,
      mdefK: 0.5, agiK: 0.6, dexK: 0.8, expK: 1.25, spd: 125, aggro: 520, color: '90,180,170', dash: [260, 560, 0.4], dust: '150,170,160',
      shadow: [52, 14] }),
    dragonfly: sp(MON, { name: 'แมลงปอไพลิน', kind: 'fly', element: 'wind', atkElement: 'wind', r: 20, hpK: 0.7, atkK: 0.95, defK: 0.5,
      mdefK: 0.7, agiK: 1.6, dexK: 1, expK: 1.15, spd: 200, aggro: 580, color: '90,200,220', hover: 58, swoop: 700, flap: 30 }),
    turtle: sp(MON, { name: 'เต่าตะไคร่ขี้โมโห', kind: 'melee', element: 'water', atkElement: 'water', r: 34, hpK: 1.5, atkK: 1.05, defK: 2.4,
      mdefK: 0.25, agiK: 0.15, dexK: 0.6, expK: 1.45, spd: 70, aggro: 460, color: '110,150,90', reach: 105, windup: 0.75, lunge: 60,
      slam: 130, recover: 0.9, heavy: true, dust: '120,140,110', shadow: [64, 18] }),
    // ---- the graveyard hill ----
    zombie: sp(MON, { name: 'ซอมบี้ชาวนา', kind: 'melee', element: 'undead', atkElement: 'neutral', r: 26, hpK: 1.45, atkK: 1.1, defK: 0.9,
      mdefK: 0.3, agiK: 0.2, dexK: 0.6, expK: 1.3, spd: 72, aggro: 500, color: '140,170,120', reach: 96, windup: 0.6, lunge: 180,
      recover: 0.8, slash: '180,230,160' }),
    ghost: sp(MON, { name: 'ผีดวงไฟ', kind: 'fly', element: 'ghost', atkElement: 'ghost', r: 24, hpK: 0.8, atkK: 1, defK: 0.4, mdefK: 1,
      agiK: 1.1, dexK: 0.9, expK: 1.35, spd: 140, aggro: 560, color: '170,230,255', hover: 64, swoop: 480, flap: 5,
      light: [200, '150,220,255'], seeThrough: 0.82 }),
    tombstone: sp(MON, { name: 'ป้ายหลุมศพผีสิง', kind: 'melee', element: 'shadow', atkElement: 'shadow', r: 30, hpK: 1.35, atkK: 1.15,
      defK: 1.6, mdefK: 0.5, agiK: 0.1, dexK: 0.6, expK: 1.4, spd: 64, aggro: 480, color: '170,170,180', reach: 110, windup: 0.8,
      lunge: 90, slam: 128, recover: 0.95, heavy: true, dust: '140,140,150', shadow: [52, 15], light: [110, '140,255,160'] }),
  };
  Object.assign(NC.SPECIES, SPECIES);
  Object.assign(NC.MONSTERS, SPECIES);

  // who lives where (monsters.js ROSTER: the maps' 'slime' / 'hollow' slots, by zone; '*' = the rest of the map)
  Object.assign(NC.ROSTER, {
    farm: {
      '*': { slime: [['pumpkin', 1]], hollow: [['carrot', 2], ['crow', 1]] },
      'ทุ่งหญ้าหน้าไร่': { slime: [['slime_green', 1]], hollow: [['bat', 1], ['boar', 1]] }, // (the camp's old monsters: fields2.js)
      'ไร่ข้าวโพด': { slime: [['pumpkin', 1]], hollow: [['crow', 2], ['scarecrow', 1]] },
    },
    marsh: {
      '*': { slime: [['frog', 2], ['slime_blue', 1]], hollow: [['crab', 2], ['dragonfly', 1], ['turtle', 1]] },
      'บึงบัวใหญ่': { slime: [['frog', 1]], hollow: [['turtle', 3], ['crab', 1], ['dragonfly', 1]] },
    },
    graveyard: {
      '*': { slime: [['zombie', 2], ['bat', 1]], hollow: [['skeleton', 1], ['ghost', 1], ['tombstone', 1]] },
      'สุสานคนนิรนาม': { slime: [['zombie', 1]], hollow: [['ghost', 2], ['tombstone', 1]] },
    },
  });

  // ---------------- passive monsters: they see nobody until something hits them ----------------
  // A passive species (any with passive: monsters3.js's too), or any monster but a boss born in a passive zone (e.calm:
  // fields2.js, the farm's newbie meadow, the owner, 2026-10-08 "มอนทุ่งหญ้าไม่ดุ"; the server: backend monster_ai.go
  // passiveMonster, from the spawn's passive flag in world.json). Its respawns are born there too, so they stay calm.
  const isBoss = (type) => !!((NC.BOSSES && NC.BOSSES[type]) || (NC.DUNGEON_BOSSES && NC.DUNGEON_BOSSES[type]));
  const baseMake = NC.makeEnemy;
  NC.makeEnemy = function (type, x, y) {
    const e = baseMake.apply(this, arguments);
    const w = NC.game && NC.game.world, z = w && w.zones ? w.zones.find((zn) => zn.test(x, y)) : null;
    if (z && z.passive && !isBoss(e.type)) e.calm = true;
    return e;
  };
  // (a story boss is marked after it is made: it never counts; the export marks these spawns passive for the server)
  NC.calmByZone = (e) => !!e.calm && !e.storyBoss;
  const passive = (e) => { const S = NC.SPECIES[e.type]; return !!(S && S.passive) || NC.calmByZone(e); };
  const NOBODY = { x: -1e6, y: -1e6, dead: 0, hp: 1, maxHp: 1, kind: 'player', stats: {}, buffs: {} };
  const baseUpdate = NC.updateEnemy;
  NC.updateEnemy = function (game, e, dt) {
    if (!passive(e) || e.angry) return baseUpdate.apply(this, arguments);
    const p = game.player;
    game.player = NOBODY;
    try { return baseUpdate.apply(this, arguments); } finally { game.player = p; }
  };
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e) {
    if (passive(e)) e.angry = true;
    return baseDamage.apply(this, arguments);
  };

  // ghosts: a little see-through
  const baseDraw = NC.drawEnemy;
  NC.drawEnemy = function (ctx, game, e) {
    const S = NC.SPECIES[e.type];
    if (!S || !S.seeThrough) return baseDraw.apply(this, arguments);
    ctx.save();
    ctx.globalAlpha *= S.seeThrough + 0.08 * Math.sin((e.anim || 0) * 2.2);
    try { return baseDraw.apply(this, arguments); } finally { ctx.restore(); }
  };

  // ---------------- what they drop (materials.js: sold to ลุงโกโก้, or in a player shop) ----------------
  if (NC.MATERIALS && NC.MAT_DROPS) {
    Object.assign(NC.MATERIALS, {
      mat_pumpkin_stem: { name: 'ขั้วฟักทองจอมซน', price: 8, desc: 'ขั้วฟักทองเขียวสด ม้วนเป็นเกลียว ยังดิ้นดุ๊กดิ๊กอยู่นิด ๆ' },
      mat_carrot_top: { name: 'ใบแครอทหยิก', price: 11, desc: 'ใบแครอทฟูฟ่องเหมือนทรงผม ของแครอทจอมพุ่ง' },
      mat_crow_feather: { name: 'ขนอีกาสีรุ้ง', price: 16, desc: 'ขนนกสีดำ ต้องแสงแล้วเป็นประกายสีรุ้งน้ำเงินม่วง' },
      mat_frog_lily: { name: 'หมวกใบบัวของกบ', price: 20, desc: 'ใบบัวจิ๋วที่กบบึงใสใส่เป็นหมวก ยังชุ่มน้ำอยู่เลย' },
      mat_crab_claw: { name: 'ก้ามปูลำธาร', price: 27, desc: 'ก้ามปูสีเขียวอมฟ้า แข็งและหนีบแน่นมาก' },
      mat_dragonfly_wing: { name: 'ปีกแมลงปอใส', price: 31, desc: 'ปีกบางใสลายเส้นสีฟ้า เบาจนแทบลอยได้เอง' },
      mat_turtle_moss: { name: 'เกล็ดกระดองตะไคร่', price: 38, desc: 'เกล็ดกระดองหนาที่มีตะไคร่กับดอกไม้จิ๋วงอกอยู่' },
      mat_zombie_patch: { name: 'ผ้าปะชาวนาผี', price: 40, desc: 'ผ้าปะเก่า ๆ จากเสื้อซอมบี้ชาวนา มีรอยเย็บตะเข็บเบี้ยว' },
      mat_grave_chip: { name: 'เศษหินหลุมศพเรืองแสง', price: 46, desc: 'เศษหินมีตะไคร่ มีจุดแสงสีเขียวกะพริบอยู่ข้างใน' },
      mat_ghost_flame: { name: 'ดวงไฟวิญญาณ', price: 52, desc: 'เปลวไฟสีฟ้าเย็น ๆ ในตะเกียงจิ๋ว ไม่ร้อนแต่ไม่เคยดับ' },
    });
    Object.assign(NC.MAT_DROPS, {
      pumpkin: [['mat_pumpkin_stem', 0.65]], carrot: [['mat_carrot_top', 0.6]], crow: [['mat_crow_feather', 0.6]],
      frog: [['mat_frog_lily', 0.62]], crab: [['mat_crab_claw', 0.58]], dragonfly: [['mat_dragonfly_wing', 0.55]],
      turtle: [['mat_turtle_moss', 0.55]], zombie: [['mat_zombie_patch', 0.6]], tombstone: [['mat_grave_chip', 0.55]],
      ghost: [['mat_ghost_flame', 0.5]],
    });
  }
})();
