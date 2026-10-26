/* storyboss.js — the story's bosses are people (the story bible: the six generals of the cult, in the six boss outfits the
   game already has), fought as map bosses in the shared maps (the user: no private scenes). Each is a rigged hero in a
   boss outfit (NC.drawHero, the animation clips) driven by js/dunbosses.js's fight (every attack shown on the ground first,
   angry under half HP, minions) and boss.js's rest (the big HP bar, the long respawn, drops through js/loot.js):
     sb_ivy     ไอวี่            Lv 20  ทุ่งหญ้าแสงจันทร์ · หมู่บ้านกังหันลม   นักบวชลัทธิมืด   orbs, rain, summon (scarecrows), blink
     sb_morrow  หมอมอร์โรว์      Lv 38  เนินสุสาน · หน้าศาลาฝังศพเก่า (ตะวันออกเฉียงใต้)  หมอผีโรคระบาด   acid, rain, summon (zombies)
                (it stood by the chapel, on the crypt's way out and against the safe yard: moved 2026-10-20, Discord #98)
     sb_raven   ไรเวน            Lv 40  ป่าเห็ดเรืองแสง · บึงเงาจันทร์      อัศวินเงา       slam, blink, orbs, summon (wolves)
     sb_ignis   อิกนิส           Lv 50  ป่าไหม้ · ลานเผาถ่าน              จอมเวทนรก       breath, rain, slam, summon (charcoal stumps)
     sb_gareth  กาเรธ            Lv 68  ผาหินแดง · เหมืองร้างผลึกส้ม       พาลาดินผู้ร่วงหล่น slam, screech, summon (skeletons)
     sb_gorm    กอร์ม            Lv 82  ป่าดึกดำบรรพ์ · ใจกลางป่าโบราณ      ราชาเขาอสูร     slam, breath, summon (raptors)
   A boss is on its map once the hero's story has reached it (js/quests.js NC.Quests.reached) and stays there after, a
   map boss for good (respawn ~1 h). Its key item for the quest drops from it for everyone who hit it (js/quests.js).
   Hooks: NC.Maps.monsters (placing it), NC.drawEnemy (the rig), the dunbosses table (NC.DUNGEON_BOSSES). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, DB = NC.DUNGEON_BOSSES;
  if (!DB || !NC.BOSSES) return;
  const base = { hair: 'hair_long', top: 'top_traveler', pants: 'pants_traveler', shoes: 'shoes_traveler', hat: null, cape: null, robe: null, weapon: 'staff' };
  const S = {
    sb_ivy: { name: 'ไอวี่ ผู้ขโมยไฟ', lv: 20, map: 'meadow', at: [3925, 1355], set: 'occult_priest', hair: 'hair_long', weapon: 'staff',
      element: 'shadow', atkElement: 'shadow', moves: ['orbs', 'rain', 'summon', 'blink'], minion: ['scarecrow', 3], fx: '190,140,255', quest: 'MQ15' },
    sb_morrow: { name: 'หมอมอร์โรว์', lv: 38, map: 'graveyard', at: [3540, 2740], set: 'plague_shaman', hair: 'hair_neat', weapon: 'staff',
      element: 'poison', atkElement: 'poison', moves: ['acid', 'rain', 'summon'], minion: ['zombie', 3], fx: '170,255,120', quest: 'MQ25' },
    sb_raven: { name: 'ไรเวน พี่ชายในเงา', lv: 40, map: 'woods', at: [3625, 3225], set: 'shadow_knight', hair: 'hair_spiky', weapon: 'sword',
      element: 'shadow', atkElement: 'shadow', moves: ['slam', 'blink', 'orbs', 'summon'], minion: ['wolf', 3], fx: '170,130,240', quest: 'MQ34' },
    sb_ignis: { name: 'อิกนิส ผู้ป้อนไฟ', lv: 50, map: 'burnt', at: [1150, 800], set: 'infernal_warlock', hair: 'hair_buzz', weapon: 'staff',
      element: 'fire', atkElement: 'fire', moves: ['breath', 'rain', 'slam', 'summon'], minion: ['char_stump', 3], fx: '255,150,60', quest: 'MQ54' },
    sb_gareth: { name: 'กาเรธ คำสาบานที่แตก', lv: 68, map: 'canyon', at: [3825, 2525], set: 'fallen_paladin', hair: 'hair_neat', weapon: 'greatsword',
      element: 'holy', atkElement: 'neutral', moves: ['slam', 'screech', 'summon'], minion: ['skeleton', 3], fx: '255,228,140', quest: 'MQ75' },
    sb_gorm: { name: 'กอร์ม ราชาเขาอสูร', lv: 82, map: 'prime', at: [3000, 875], set: 'horned_king', hair: 'hair_buzz', weapon: 'axe',
      element: 'earth', atkElement: 'earth', moves: ['slam', 'breath', 'summon'], minion: ['raptor', 3], fx: '230,185,120', quest: 'MQ84' },
    // ---- the story's later chapters (js/fields4.js, js/dungeons2.js). at: a spot, or 'deep' / 'room1'.. in a dungeon floor
    sb_halvard: { name: 'ลอร์ดฮัลวาร์ด เจ้าด่านเกลือ', lv: 46, map: 'salt', at: [3900, 930], set: 'hv_iron', hair: 'hair_neat', weapon: 'spear',
      element: 'earth', atkElement: 'neutral', moves: ['slam', 'screech', 'summon'], minion: ['hound', 3], fx: '220,230,255', quest: 'MQ44' },
    sb_vosse: { name: 'มาจิสเตอร์วอสส์', lv: 58, map: 'owl3', at: 'deep', set: 'mg_star', hair: 'hair_long', weapon: 'staff',
      element: 'wind', atkElement: 'wind', moves: ['orbs', 'rain', 'blink', 'summon'], minion: ['stone_owl', 3], fx: '170,190,255', quest: 'MQ63' },
    sb_aldric: { name: 'กัปตันอัลดริก', lv: 80, map: 'outer', at: [4650, 2080], set: 'hv_moon', hair: 'hair_spiky', weapon: 'spear',
      element: 'neutral', atkElement: 'neutral', moves: ['slam', 'screech', 'summon'], minion: ['hollow_guard', 3], fx: '190,210,255', quest: 'MQ93' },
    sb_candle: { name: 'มาดามแคนเดิล', lv: 84, map: 'canal', at: [3900, 2480], set: 'mg_candle', hair: 'hair_long', weapon: 'staff',
      element: 'fire', atkElement: 'fire', moves: ['breath', 'rain', 'summon'], minion: ['candle_minion', 3], fx: '255,190,110', quest: 'MQ103' },
    sb_quill: { name: 'บราเดอร์ควิลล์', lv: 88, map: 'ledger2', at: 'deep', set: 'mg_ink', hair: 'hair_neat', weapon: 'staff',
      element: 'shadow', atkElement: 'neutral', moves: ['orbs', 'rain', 'blink', 'summon'], minion: ['flying_book', 3], fx: '230,215,160', quest: 'MQ112' },
    sb_nocturne: { name: 'อาร์ชบิชอปโนคเทิร์น', lv: 90, map: 'isle', at: [2200, 1080], set: 'mg_void', hair: 'hair_long', weapon: 'staff',
      element: 'shadow', atkElement: 'shadow', moves: ['orbs', 'blink', 'rain', 'summon'], minion: ['mist_wraith', 2], fx: '150,140,255', quest: 'MQ122',
      hpK: 15, flee: true },
    // the puppets that came before us: a traveller's clothes, red strings from above (No. 1 in the dark forest's dead
    // camp, No. 2–6 in the workshop under the cathedral)
    sb_puppet1: { name: 'หุ่นหมายเลขหนึ่ง', lv: 92, map: 'dark', at: [3950, 3560], set: 'base', hair: 'hair_spiky', weapon: 'sword', puppet: true,
      element: 'neutral', atkElement: 'shadow', moves: ['slam', 'blink', 'summon'], minion: ['faceless_puppet', 2], fx: '255,90,100', quest: 'MQ133' },
    sb_puppet2: { name: 'หุ่นที่ 2', lv: 89, map: 'puppet1', at: 'room1', set: 'rg_trail', hair: 'hair_curly', weapon: 'bow', puppet: true,
      element: 'neutral', atkElement: 'neutral', moves: ['orbs', 'blink'], minion: ['wooden_hand', 2], fx: '255,90,100', quest: 'MQ141', hpK: 18 },
    sb_puppet3: { name: 'หุ่นที่ 3', lv: 90, map: 'puppet1', at: 'room2', set: 'lt_scout', hair: 'hair_ponytail', weapon: 'dagger', puppet: true,
      element: 'neutral', atkElement: 'shadow', moves: ['blink', 'slam'], minion: ['thread_binder', 2], fx: '255,90,100', quest: 'MQ142', hpK: 18 },
    sb_puppet4: { name: 'หุ่นที่ 4', lv: 91, map: 'puppet2', at: 'room1', set: 'mg_novice', hair: 'hair_long', weapon: 'staff', puppet: true,
      element: 'neutral', atkElement: 'fire', moves: ['rain', 'orbs'], minion: ['faceless_puppet', 2], fx: '255,90,100', quest: 'MQ143', hpK: 18 },
    sb_puppet5: { name: 'หุ่นที่ 5', lv: 92, map: 'puppet2', at: 'room2', set: 'hv_tin', hair: 'hair_buzz', weapon: 'sword', puppet: true,
      element: 'neutral', atkElement: 'neutral', moves: ['slam', 'screech'], minion: ['wooden_hand', 2], fx: '255,90,100', quest: 'MQ144', hpK: 18 },
    sb_puppet6: { name: 'หุ่นที่ 6', lv: 93, map: 'puppet2', at: 'deep', set: 'rg_camp', hair: 'hair_neat', weapon: 'axe', puppet: true,
      element: 'neutral', atkElement: 'neutral', moves: ['slam', 'summon', 'blink'], minion: ['thread_binder', 2], fx: '255,90,100', quest: 'MQ145', hpK: 18 },
    sb_severin: { name: 'คาร์ดินัลเซเวริน', lv: 99, map: 'cathedral', at: [3300, 1320], set: 'bishop', hair: 'hair_neat', weapon: 'staff',
      element: 'holy', atkElement: 'holy', moves: ['rain', 'orbs', 'summon', 'screech'], minion: ['temple_soldier', 3], fx: '255,236,170', quest: 'MQ163' },
    // the world bosses in three forms: each form that falls brings the next up where it stood
    sb_lumen: { name: 'ตาลูเมน ผู้จุดตะเกียงคนสุดท้าย', lv: 99, map: 'wind', at: [1360, 2150], set: 'lightkeeper', hair: 'hair_neat', weapon: 'staff',
      element: 'fire', atkElement: 'fire', moves: ['rain', 'breath', 'summon'], minion: ['candle_wisp', 3], fx: '255,200,120', quest: 'MQ151',
      hpK: 60, next: 'sb_lumen2' },
    sb_lumen2: { name: 'ตาลูเมน · เชือกทั้งร้อย', lv: 99, set: 'lightkeeper', hair: 'hair_neat', weapon: 'staff', puppeteer: true,
      element: 'shadow', atkElement: 'shadow', moves: ['orbs', 'rain', 'blink', 'summon'], minion: ['faceless_puppet', 3], fx: '255,90,100', hpK: 60, next: 'sb_lumen3' },
    sb_lumen3: { name: 'ตาลูเมน · ไฟดวงสุดท้าย', lv: 99, set: 'lightkeeper', hair: 'hair_neat', weapon: 'staff',
      element: 'fire', atkElement: 'holy', moves: ['breath', 'rain', 'orbs', 'screech', 'slam'], minion: ['first_lamplighter', 2], fx: '255,240,200', hpK: 70 },
    // (the endgame balance audit, the owner 2026-10-07: HP x2.6, hpK 70 -> 180, and 50 EXP per 10k HP, expK 30 -> 295, as
    // Aurelion in dungeons2.js; the three forms took a full-gear moon sniper ~7 min alone)
    sb_aurel: { name: 'นักบุญออเรล', lv: 99, map: 'grave2', at: 'deep', set: 'c3_starsaint', hair: 'hair_long', weapon: 'staff',
      element: 'holy', atkElement: 'holy', moves: ['orbs', 'rain', 'blink'], minion: ['star_crystal', 3], fx: '255,240,190', quest: 'MQ182',
      hpK: 180, expK: 295, next: 'sb_aurel2' },
    sb_aurel2: { name: 'นักบุญออเรล · ดาวที่ตื่น', lv: 99, set: 'c3_starsaint', hair: 'hair_long', weapon: 'staff',
      element: 'holy', atkElement: 'holy', moves: ['rain', 'breath', 'summon', 'screech'], minion: ['first_lamplighter', 2], fx: '255,250,220',
      hpK: 180, expK: 295, next: 'aurelion' },
  };
  NC.STORY_BOSSES = S;
  // the star's grave's first two forms had no materials (the same audit): the grave's own, a pile each (Aurelion's in
  // dungeons2.js)
  if (NC.MAT_DROPS) Object.assign(NC.MAT_DROPS, { sb_aurel: [['mat_star_ember', 1, 6, 10]], sb_aurel2: [['mat_star_crystal', 1, 6, 10]] });
  const setOf = (id) => (NC.CLASSES || []).find((c) => c.id === id) ||
    (NC.OUTFITS && (Array.isArray(NC.OUTFITS.sets) ? NC.OUTFITS.sets : Object.values(NC.OUTFITS.sets || {})).find((c) => c.id === id));
  for (const [id, D] of Object.entries(S)) {
    const hpK = D.hpK || 30, expK = D.expK || 30;
    DB[id] = { name: D.name, element: D.element, atkElement: D.atkElement, r: 34, hpK, atkK: 1.5, defK: 1.2, mdefK: 1.1, agiK: 0.8, dexK: 1,
      expK, spd: 120, aggro: 700, moves: D.moves, minion: D.minion, top: 300, fx: D.fx, human: true };
    NC.MONSTERS[id] = { name: D.name, element: D.element, atkElement: D.atkElement, r: 34, hpK, atkK: 1.5, defK: 1.2, mdefK: 1.1, agiK: 0.8,
      dexK: 1, expK, spd: 120, aggro: 700 };
    NC.BOSSES[id] = { respawn: 3600, drops: 0, top: 300 };
    const C = setOf(D.set), eq = Object.assign({}, base, { hair: D.hair, weapon: ITEMS[D.weapon] ? D.weapon : 'staff' });
    if (C) for (const k in C.items) if (C.items[k]) eq[k] = C.items[k];
    D.equip = eq;
  }

  // ---------------- on its map ----------------
  const reached = (D) => NC.Quests && NC.Quests.reached && NC.Quests.reached(D.quest);
  function spot(world, x, y) {
    for (let r = 0; r < 600; r += 40) for (let a = 0; a < 6.28; a += 0.5) {
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.6;
      if (!world.fits || world.fits(px, py, 40)) return [px, py];
    }
    return [x, y];
  }
  // a dungeon floor's spot: its boss room ('deep') or its far rooms ('room1' the farthest from the way in, 'room2' the next)
  function roomSpot(world, at) {
    const rooms = world.rooms || [];
    if (at === 'deep') { const q = rooms.find((r) => r.role === 'boss') || rooms.find((r) => r.role === 'deep'); return q ? [q.x, q.y] : null; }
    const e = rooms[0], n = +at.replace('room', '') || 1;
    const far = rooms.filter((r) => r.role === 'room').sort((a, b) => Math.hypot(b.x - e.x, b.y - e.y) - Math.hypot(a.x - e.x, a.y - e.y));
    const q = far[n - 1] || far[far.length - 1];
    return q ? [q.x, q.y] : null;
  }
  const baseMon = NC.Maps.monsters;
  NC.Maps.monsters = function (world) {
    const list = baseMon.apply(this, arguments), id = world && world.field;
    for (const [type, D] of Object.entries(S)) {
      if (D.map !== id || !reached(D)) continue;
      const cd = NC.Boss && NC.Boss.cooldown && NC.Boss.cooldown[id + ':' + type];
      if (cd && cd > performance.now() / 1000) continue;
      const at = typeof D.at === 'string' ? roomSpot(world, D.at) : D.at;
      if (!at) continue;
      const [x, y] = spot(world, at[0], at[1]);
      const e = NC.makeEnemy(type, x, y, D.lv);
      if (e) { e.storyBoss = true; list.push(e); }
    }
    return list;
  };

  // ---------------- drawn as a person ----------------
  const Anim = NC.Anim;
  const baseDraw = NC.drawEnemy;
  NC.drawEnemy = function (ctx, game, e) {
    const D = S[e.type];
    if (!D) return baseDraw.apply(this, arguments);
    if (!e.rig) e.rig = { anim: Anim.makeState(), hatS: {}, walk: 0, lx: e.x, face: -1, attackT: 0 };
    const R = e.rig, dt = Math.min(0.1, Math.max(0, game.time - (R.t || game.time))); R.t = game.time;
    const dx = e.x - R.lx; R.lx = e.x;
    const moving = Math.abs(dx) + Math.abs(e.y - (R.ly === undefined ? e.y : R.ly)) > 0.4; R.ly = e.y;
    if (Math.abs(dx) > 0.3) R.face = dx > 0 ? 1 : -1;
    else if (game.player) R.face = game.player.x > e.x ? 1 : -1;
    R.walk += dt * (moving ? 1 : 0);
    const W = ITEMS[D.equip.weapon] || {}, SET = Anim.setOf(Anim.movesFor({ idle: 'idle', set: 'basic' }, W));
    const busy = e.state && !['idle', 'chase', 'recover', 'return'].includes(e.state);
    const fight = e.awake || busy;
    const baseClip = e.dead ? 'death' : moving ? (fight ? 'runReady' : 'walk') : fight ? SET.ready : 'idle';
    Anim.setBase(R.anim, baseClip, 0.16);
    if (busy && e.state !== R.lastState) { const c = SET.combo(W.style)[Math.floor(Math.random() * 3)]; if (Anim.CLIPS[c]) Anim.play(R.anim, c); }
    R.lastState = e.state;
    Anim.update(R.anim, dt, 1, () => {});
    const c = NC.animCtx(D.equip, { al: 0, walk: R.walk, moving, hurt: e.hurt ? 1 : 0, idleStyle: 'idle', ready: SET.ready });
    const P = Anim.evaluate(R.anim, c);
    P.face = R.face;
    NC.hatSpring(R.hatS, D.equip, P, dx * 60 * R.face, dt);
    ctx.save();
    ctx.fillStyle = 'rgba(20,14,30,0.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 46, 13, 0, 0, Math.PI * 2); ctx.fill();
    if (NC.VFX) NC.VFX.glow(ctx, e.x, e.y - 100, 170, D.fx, e.raged ? 0.38 : 0.2, true);
    if (D.flee && e.dead) ctx.globalAlpha = Math.max(0, 1 - (game.time - (e._fleeT || (e._fleeT = game.time))) / 1.2); // Nocturne thins into the mist
    if (D.puppet || D.puppeteer) strings(ctx, game, e, D);
    NC.drawHero(ctx, D.equip, P, e.x, e.y, { scale: 1.45 });
    ctx.restore();
  };

  // red strings from the dark above: to a puppet's head and hands, or out from Lumen's hands
  function strings(ctx, game, e, D) {
    const T = game.time;
    const ends = D.puppet ? [[-34, -150], [0, -222], [38, -140], [-20, -40], [22, -40]] : [[-60, -150], [60, -150], [-90, -120], [90, -120]];
    ctx.save();
    ctx.lineCap = 'round';
    ends.forEach(([dx, dy], i) => {
      const x1 = e.x + dx + Math.sin(T * 1.6 + i) * 6, y1 = e.y + dy + (e.raged ? Math.sin(T * 9 + i) * 3 : 0);
      const x0 = D.puppet ? e.x + dx * 0.4 : e.x + dx * 4, y0 = D.puppet ? e.y - 900 : e.y - 700 - i * 60;
      ctx.strokeStyle = 'rgba(255,70,90,0.18)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,110,120,0.85)'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    });
    ctx.restore();
  }

  // ---------------- a world boss's next form rises where the last one fell ----------------
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e) {
    const out = baseDamage.apply(this, arguments);
    const D = S[e.type];
    if (D && D.next && e.dead && !e._nextUp) {
      e._nextUp = true;
      const x = e.x, y = e.y, world = game.world;
      NC.FX.ring(x, y - 60, 30, 520, D.fx, 0.9, 12);
      NC.FX.puff(x, y - 60, 24, { speed: 260, color: D.fx });
      setTimeout(() => {
        const g = NC.game;
        if (!g || g.world !== world) return;
        const n = NC.makeEnemy(D.next, x, y, D.lv);
        if (!n) return;
        n.storyBoss = !!S[D.next];
        n.awake = true; n.state = 'roar'; n.t = 0; // (up already: no sleeping between the forms)
        g.shake = Math.max(g.shake || 0, 14);
        g.enemies.push(n);
        NC.HUD.log(`★ ${n.name} ลุกขึ้นมาอีกครั้ง...`, 'warn');
      }, 1600);
    }
    return out;
  };

  NC.StoryBoss = { S };
})();
