/* life_mine.js — ขุดแร่ (mining), a life skill of js/life.js. Ore veins stand in the rooms of every dungeon floor (a
   few per floor, their ores by the dungeon: DUNGEON_ORES), and a few in the fields (the canyon's abandoned orange crystal
   mine, the sleeping volcano) and in the little quarry of the farm map (js/life_farm.js, safe, for learning). B next to
   a vein (or a click on it), then strike when the glint on the rock flashes; a strike on the flash counts double and
   may knock a gem loose. Every strike is noisy: when the noise bar fills, the monsters round about come running (a
   strike on the flash is quieter). Now and then a vein is a sleeping rock monster (แร่ปลอม). A mined vein leaves rubble
   and comes back after a while (or when the floor is built again). Teacher: ตุ่นหัวไฟ on the farm map, who upgrades the
   pickaxe. Art: assets/life/ (ore_*, lf_* icons, npc_mole*). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, L = NC.Life;
  const MAT = NC.MATERIALS;

  // (copper, iron and silver glow faintly too since 2026-10-20: in a dark dungeon a vein without a light was one more rock,
  // Discord #123 "หาจุดขุดแร่ยากมาก")
  const ORE = {
    copper: { mat: 'lf_copper', name: 'สายแร่ทองแดง', lv: 1, tier: 1, hp: 7, xp: 14, light: '255,176,120' },
    quartz: { mat: 'lf_quartz', name: 'กลุ่มผลึกควอตซ์', lv: 3, tier: 1, hp: 8, xp: 17, light: '255,220,235' },
    iron: { mat: 'lf_iron', name: 'สายแร่เหล็ก', lv: 6, tier: 1, hp: 9, xp: 24, light: '200,214,236' },
    amber: { mat: 'lf_amber', name: 'สายอำพัน', lv: 10, tier: 2, hp: 10, xp: 32, light: '255,180,70' },
    silver: { mat: 'lf_silver', name: 'สายแร่เงิน', lv: 13, tier: 2, hp: 11, xp: 40, light: '226,236,255' },
    moonsilver: { mat: 'lf_moonsilver', name: 'สายเงินจันทร์', lv: 16, tier: 2, hp: 12, xp: 50, light: '150,200,255' },
    soul: { mat: 'lf_soul', name: 'ผลึกวิญญาณ', lv: 18, tier: 3, hp: 13, xp: 58, light: '170,140,255' },
    orange: { mat: 'lf_orange', name: 'สายผลึกส้ม', lv: 20, tier: 3, hp: 13, xp: 62, light: '255,170,80' },
    obsidian: { mat: 'lf_obsidian', name: 'หินออบซิเดียน', lv: 23, tier: 3, hp: 15, xp: 75, light: '255,120,50' },
    fire: { mat: 'lf_fireore', name: 'สายแร่เพลิง', lv: 25, tier: 4, hp: 16, xp: 85, light: '255,110,60' },
    star: { mat: 'lf_starore', name: 'แร่ดาวตก', lv: 28, tier: 4, hp: 20, xp: 120, light: '255,225,120' },
  };
  // which ores grow on each dungeon floor (weights), by floor id, else by the dungeon's theme
  const DUNGEON_ORES = {
    batcave: [['copper', 5], ['quartz', 3], ['star', 0.08]], batnest: [['quartz', 3], ['copper', 2], ['star', 0.3]],
    antmine1: [['iron', 4], ['copper', 3], ['amber', 1]], antmine2: [['iron', 3], ['amber', 3], ['silver', 1.5]],
    antmine3: [['silver', 3], ['amber', 2], ['iron', 2], ['star', 0.2]],
    crypt1: [['moonsilver', 4], ['soul', 2], ['silver', 2]], crypt2: [['moonsilver', 3], ['soul', 3], ['star', 0.3]],
    lavavent1: [['fire', 4], ['obsidian', 4], ['star', 0.3]], lavavent2: [['fire', 3], ['obsidian', 3], ['star', 1]],
  };
  const BY_THEME = { cave: DUNGEON_ORES.batcave, mine: DUNGEON_ORES.antmine2, crypt: DUNGEON_ORES.crypt1, lava: DUNGEON_ORES.lavavent1 };
  // star ore veins a floor always has (the owner, 2026-10-07, the endgame balance audit): the weights above are rolled
  // once per floor, so the whole world had one star vein (crypt2, ~3.7 ore per ~9 min) and lavavent2's weight of 1
  // came out as fire and obsidian. G4 to +10 asks ~96 star ore, so the Lv 85+ floors each keep one: a miner who
  // farms one of them gets ~15–25 an hour from its vein, more by going round two or three, without queueing for one
  // node. The first veins placed on the floor become star (same spots, same random stream: placeInDungeon).
  const STAR_VEINS = { lavavent1: 1, lavavent2: 1, puppet2: 1, grave1: 1, grave2: 1, bell6: 1 };
  const GEMS = { cave: ['lf_amethyst', 'lf_sapphire'], mine: ['lf_emerald', 'lf_topaz'], crypt: ['lf_sapphire', 'lf_amethyst'],
    lava: ['lf_ruby', 'lf_topaz'], canyon: ['lf_topaz', 'lf_ruby'], volcano: ['lf_ruby', 'lf_ruby', 'lf_topaz'], homefarm: ['lf_amethyst', 'lf_emerald'] };
  // veins in the fields: [map, ore, x, y] (the farm's quarry is placed by js/life_farm.js through L.fieldVeins)
  L.fieldVeins = L.fieldVeins || [];
  L.fieldVeins.push(
    ['canyon', 'orange', 3420, 2330], ['canyon', 'orange', 3700, 2460], ['canyon', 'orange', 4020, 2380], ['canyon', 'iron', 3560, 2700],
    ['canyon', 'orange', 4200, 2720], ['canyon', 'copper', 3300, 2640],
    ['volcano', 'obsidian', 1500, 1900], ['volcano', 'obsidian', 2300, 2500], ['volcano', 'fire', 3100, 2100], ['volcano', 'fire', 3800, 2800],
  );
  const WHERE = {
    copper: 'ถ้ำค้างคาวริมทุ่ง · ลานหินฟาร์มหิ่งห้อย', quartz: 'ถ้ำค้างคาวริมทุ่ง', iron: 'เหมืองมด B1–B3', amber: 'เหมืองมด B1–B3 (ชั้นลึกเจอบ่อย)',
    silver: 'เหมืองมด B2–B3 · สุสานใต้ดิน', moonsilver: 'สุสานใต้ดิน 1–2', soul: 'สุสานใต้ดิน 1–2', orange: 'เหมืองร้างผลึกส้ม (ผาหินแดง)',
    obsidian: 'ปล่องภูเขาไฟ · ภูเขาไฟหลับ', fire: 'ปล่องภูเขาไฟ · ภูเขาไฟหลับ', star: 'ดันเจี้ยน Lv 85+ ชั้นละสาย: ปล่องภูเขาไฟ 1–2 · โรงหุ่น 2 · หลุมดาว 1–2 · หอระฆัง 6 (ดันเจี้ยนอื่นหายากมาก)',
  };
  for (const k of ['copper', 'quartz', 'iron', 'amber', 'silver', 'moonsilver', 'soul', 'orange', 'obsidian', 'fire', 'star']) {
    const O = ORE[k];
    L.GUIDE.mine.push({ mat: O.mat, name: MAT[O.mat].name, lv: O.lv, tier: O.tier, where: WHERE[k] });
    L.SOURCE[O.mat] = 'ขุดแร่: ' + WHERE[k];
  }
  L.GUIDE.mine.push({ mat: 'lf_ruby', name: 'อัญมณี (ทับทิม ไพลิน มรกต บุษราคัม อเมทิสต์)', lv: 1, tier: 1, where: 'เคาะแร่ตรงประกาย มีโอกาสหลุดออกมา' });
  L.SOURCE.lf_stone = 'ขุดแร่ได้ทุกที่'; L.SOURCE.lf_amber = 'ขุดแร่ในเหมืองมด · ตัดต้นไม้โบราณ';
  for (const g of ['lf_ruby', 'lf_sapphire', 'lf_emerald', 'lf_topaz', 'lf_amethyst']) L.SOURCE[g] = 'เคาะแร่ตรงประกาย (บางที)';

  // ---------------- placing the veins: small walk-through props with a glow ----------------
  const mined = {}; // 'map:x,y' -> game.time the vein is back
  function addVein(w, type, x, y, flip) {
    const O = ORE[type], name = 'ore_' + type, s = NC.SPR[name];
    const prop = { kind: 'prop', name, x, y, scale: 1, flip: !!flip, sort: y, shadow: s ? [s.w * 0.42, s.w * 0.1] : [44, 12], _ore: type };
    w.props.push(prop);
    if (O.light) { if (!w.lights) w.lights = []; w.lights.push({ x, y: y - 50, r: 190, rgb: O.light, flick: 1.6, owner: prop }); }
    const n = makeNode(w, prop);
    (w.lfVeins || (w.lfVeins = [])).push(n);
    delete w.autoGrid; // (autofarm.js caches which cells can be walked)
    // a map built again (maps.js keeps only the last few): a vein mined a moment ago is still rubble
    const g = NC.game;
    if (g && mined[n.key] !== undefined && g.time < mined[n.key]) {
      prop.name = NC.SPR.ore_rubble ? 'ore_rubble' : prop.name;
      if (w.lights) w.lights = w.lights.filter((l) => l.owner !== prop);
    }
    return prop;
  }
  // a free spot near (x, y) for a field vein (the field maps are drawn from numbers: rocks and ponds move with them)
  function freeSpot(w, x, y, onRoad) {
    if (!w.fits) return [x, y];
    for (let r = 0; r <= 360; r += 30)
      for (let k = 0; k < (r ? 12 : 1); k++) {
        const a = (k / 12) * Math.PI * 2, px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r * 0.7);
        // (onRoad: js/roadclear.js, the vein keeps off the roads)
        if (w.fits(px, py, 64) && w.fits(px, py - 40, 44) && !(onRoad && onRoad(px, py - 4, 38, 14))) return [px, py];
      }
    return null;
  }
  const pickW = (list, R) => { let s = 0; for (const [, wt] of list) s += wt; let r = R() * s; for (const [id, wt] of list) { if ((r -= wt) <= 0) return id; } return list[0][0]; };
  const baseDungeon = NC.buildDungeon;
  NC.buildDungeon = function (def) {
    const w = baseDungeon.apply(this, arguments);
    try { placeInDungeon(w, def); } catch (e) { console.warn('life_mine: veins', e); }
    return w;
  };
  function placeInDungeon(w, def) {
    if (!w || !w.rooms || !NC.SPR.ore_copper) return;
    const list = DUNGEON_ORES[def.id] || BY_THEME[w.theme] || DUNGEON_ORES.batcave;
    const R = NC.rng((def.seed || 7) * 131 + 17);
    const rooms = w.rooms.filter((q) => q.role === 'room' || q.role === 'deep');
    const want = Math.min(8, 3 + Math.floor(rooms.length / 3));
    // (kept away from the chests, the warps and the way in, and from each other; monsters roam anyway)
    const taken = [];
    for (const s of w.spawns || []) taken.push([s[1], s[2], String(s[0]).startsWith('chest') ? 170 : 50]);
    for (const q of w.warps || []) taken.push([q.x, q.y, 260]);
    if (w.spawn) taken.push([w.spawn.x, w.spawn.y, 300]);
    let placed = 0, stars = STAR_VEINS[def.id] || 0;
    for (let k = 0; k < want * 12 && placed < want; k++) {
      const q = rooms[Math.floor(R() * rooms.length)];
      if (!q) break;
      const x = Math.round(q.x + (R() - 0.5) * q.rx * 1.2), y = Math.round(q.y + (R() - 0.5) * q.ry * 1.0);
      if (!w.fits(x, y, 50) || !w.fits(x, y - 40, 36)) continue;
      if (taken.some(([tx, ty, r]) => Math.hypot(tx - x, ty - y) < r)) continue;
      let type = pickW(list, R);
      if (stars > 0) { type = 'star'; stars--; } // (STAR_VEINS: after the roll, so the stream and the spots stay as they were)
      addVein(w, type, x, y, R() < 0.5);
      taken.push([x, y, 220]);
      placed++;
    }
  }
  const baseField = NC.buildField;
  NC.buildField = function (def) {
    const w = baseField.apply(this, arguments);
    if (def && !def.dungeon && NC.SPR.ore_copper) for (const [map, type, x, y] of L.fieldVeins) {
      if (map !== def.id) continue;
      const at = freeSpot(w, x, y, def.onRoad);
      if (at) addVein(w, type, at[0], at[1], (x + y) % 2 === 0);
    }
    return w;
  };

  // ---------------- a vein as a node of js/life.js ----------------
  const keyOf = (w, t) => `${w.mapId || w.field}:${t.x},${t.y}`;
  function makeNode(w, t) {
    const O = ORE[t._ore], s = NC.SPR[t.name], key = keyOf(w, t);
    const n = {
      skill: 'mine', prop: t, key, x: t.x, y: t.y, hx: t.x, hy: t.y - 42, reach: 118, game: 'glint', verb: 'ขุดแร่',
      w: s ? s.w * 0.8 : 90, h: s ? s.h * 0.85 : 90, lv: O.lv, tier: O.tier, hp: O.hp, left: O.hp, label: `${O.name} · ${MAT[O.mat].name}`,
      box: [t.x - 55, t.y - (s ? s.h : 100), t.x + 55, t.y + 12], tagY: t.y - (s ? s.h : 100) - 40,
      ok: () => t.name !== 'ore_rubble', hit, done, start, tick, drawExtra,
    };
    return n;
  }
  const inDungeon = (game) => !!(game.world && game.world.dungeon);
  const safeMap = (game) => !!(NC.MAPS[game.mapId] || {}).lifeSafe;
  function start(game, p, n, a) {
    if (n.left <= 0) n.left = n.hp;
    const act = p.lifeAct;
    if (act) act.noise = act.noise || 0;
    // a sleeping rock monster? (only the first strike of a fresh vein can wake it)
    if (n.left === n.hp && !safeMap(game) && L.roll(0.03)) V.at(0.35, () => wake(game, p, n));
    void a;
  }
  function wake(game, p, n) {
    if (n.prop.name === 'ore_rubble') return;
    const w = game.world, t = n.prop, hot = w.theme === 'lava' || game.mapId === 'volcano';
    const type = hot && NC.MONSTERS.magma_golem ? 'magma_golem' : 'golem';
    if (!NC.MONSTERS[type]) return;
    if (p.lifeAct && p.lifeAct.node === n) L.stopWork(game, p);
    rubble(game, n);
    const lv = NC.spawnLevel ? NC.spawnLevel(w, 'hollow', t.x, t.y) : 20;
    const m = NC.makeEnemy(type, t.x, t.y + 6, lv);
    m.owner = { life: true }; m.state = 'chase'; m.t = 0; m.angry = true; m.show = 3;
    game.enemies.push(m);
    FX.text(t.x, t.y - 160, 'แร่ปลอม!', '#ff9a8a', 34);
    V.debris(t.x, t.y - 40, 10, V.PAL.stone, { size: 0.8 });
    V.shake(game, 8);
  }
  function tick(game, p, n, dt, a) {
    a.noise = Math.max(0, (a.noise || 0) - dt * 12);
  }
  function hit(game, p, n, perfect, a) {
    const t = n.prop, lv = L.lvOf(p, 'mine'), side = p.x < t.x ? -1 : 1;
    V.debris(t.x + side * 20, t.y - 44, perfect ? 8 : 4, V.PAL.stone, { size: 0.55, min: 160, max: 380, tilt: side > 0 ? 0.6 : -0.6 });
    V.sparks(t.x + side * 16, t.y - 46, perfect ? 10 : 5, '255,236,170', { min: 220, max: 520, size: 0.7 });
    V.shake(game, perfect ? 3 : 1.5);
    // a gem knocked loose
    if (perfect && L.roll((0.02 + lv * 0.001) * (lv >= 20 ? 1.5 : 1))) {
      const pool = GEMS[game.world.theme] || GEMS[game.mapId] || GEMS.cave;
      L.drop(game, pool[Math.floor(Math.random() * pool.length)], 1, t.x + (p.x - t.x) * 0.4, t.y + 8, { spread: 24 });
    }
    // the noise
    if (!a || safeMap(game)) return;
    let add = perfect ? 7 : 14;
    if (lv >= 15) add *= 0.7;
    if (lv >= 30 && perfect) add *= 0.3;
    a.noise = (a.noise || 0) + add;
    if (a.noise >= 100) { a.noise = 30; alarm(game, p, t); }
  }
  function alarm(game, p, t) {
    const R = inDungeon(game) ? 700 : 520;
    let n = 0;
    for (const e of game.enemies) {
      if (!e || e.dead || e.hp <= 0 || e.owner || e.state !== 'idle' || NC.dist(e.x, e.y, t.x, t.y) > R) continue;
      e.state = 'chase'; e.t = 0; e.angry = true; n++;
      FX.num(e.x, (NC.labelTop ? NC.labelTop(e) : e.y - 120) - 10, '!', { fill: '#ff9a5a', size: 46 });
    }
    FX.text(p.x, p.y - 200, n ? 'เสียงดังเกินไป! มอนได้ยินแล้ว' : 'เสียงดังเกินไป!', '#ffb08a', 26);
  }
  function drawExtra(ctx, game, a) {
    if (safeMap(game) || !(a.noise > 0)) return;
    const n = a.node, x = n.x - 50, y = n.y - (n.h || 90) - 34, k = Math.min(1, a.noise / 100);
    ctx.save();
    ctx.beginPath(); NC.rrect(ctx, x, y, 100, 10, 5); ctx.fillStyle = 'rgba(30,24,44,0.8)'; ctx.fill();
    ctx.beginPath(); NC.rrect(ctx, x + 1, y + 1, 98 * k, 8, 4); ctx.fillStyle = k > 0.75 ? '#ff7a5a' : '#ffb35a'; ctx.fill();
    ctx.font = "600 13px 'Mitr', sans-serif"; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff3cf'; ctx.strokeStyle = NC.OUTLINE; ctx.lineWidth = 3;
    ctx.strokeText('เสียง', x - 38, y + 5); ctx.fillText('เสียง', x - 38, y + 5);
    ctx.restore();
  }
  function rubbleLook(w, t) {
    t.name = NC.SPR.ore_rubble ? 'ore_rubble' : t.name;
    const s = NC.SPR[t.name];
    t.shadow = s ? [s.w * 0.4, s.w * 0.08] : t.shadow;
    if (w.lights) w.lights = w.lights.filter((l) => l.owner !== t);
  }
  function rubble(game, n) {
    rubbleLook(game.world, n.prop);
    mined[n.key] = game.time + (inDungeon(game) ? 480 : 300) + Math.random() * 120;
  }
  function done(game, p, n) {
    const t = n.prop, O = ORE[t._ore], lv = L.lvOf(p, 'mine'), tier = L.toolTier(p, 'pick');
    rubble(game, n);
    V.debris(t.x, t.y - 30, 12, V.PAL.stone, { size: 0.9 });
    V.smoke(t.x, t.y - 20, 8, '#cfc6bc', '#efe8de', { size: 1.1, max: 240, lifeK: 0.8, a: 0.6 });
    V.shake(game, 5);
    const ore = 2 + (L.roll(0.2 + lv * 0.012 + (lv >= 10 ? 0.15 : 0)) ? 1 : 0) + (tier >= 3 ? 1 : 0);
    const dx = t.x + (p.x - t.x) * 0.4, dy = t.y + 8, o = { spread: 32 }; // (on the hero's side of the rock)
    L.drop(game, O.mat, ore, dx, dy, o);
    if (L.roll(0.6)) L.drop(game, 'lf_stone', L.roll(0.4) ? 2 : 1, dx, dy, o);
    if (t._ore !== 'star' && L.roll(0.004 * (lv >= 25 ? 3 : 1))) L.drop(game, 'lf_starore', 1, dx, dy, o);
    L.addXp(game, 'mine', O.xp);
    NC.HUD.log(`ขุด${O.name}เสร็จแล้ว!`, 'item');
  }

  // ---------------- every frame: veins come back ----------------
  L.ticks.push((game) => {
    const w = game.world;
    if (!w || !w.lfVeins) return;
    for (const n of w.lfVeins) {
      const t = n.prop;
      // (a vein mined by someone else, online: js/online/life.js puts the server's mined veins in `mined`. Drawn as ore,
      // it showed the prompt and every press got "แหล่งวัตถุดิบกำลังฟื้นตัว" - on a busy floor nearly every vein,
      // Discord #123 "ในดันก็กดขุดแร่ไม่ได้เลย". The rubble, as the felled trees' stumps, js/life_wood.js)
      if (t.name !== 'ore_rubble') { if (mined[n.key] !== undefined && game.time < mined[n.key]) rubbleLook(w, t); continue; }
      const until = mined[n.key];
      if (until !== undefined && game.time < until) continue;
      delete mined[n.key];
      t.name = 'ore_' + t._ore;
      const s = NC.SPR[t.name], O = ORE[t._ore];
      t.shadow = s ? [s.w * 0.42, s.w * 0.1] : t.shadow;
      if (O.light) { if (!w.lights) w.lights = []; w.lights.push({ x: t.x, y: t.y - 50, r: 190, rgb: O.light, flick: 1.6, owner: t }); }
      n.left = n.hp;
    }
  });
  L.finders.push((game) => (game.world && game.world.lfVeins) || null);
  L.mined = mined; // (js/online/life.js: the server's mined veins, 'map:x,y' -> game.time they come back)

  // ---------------- the teacher: ตุ่นหัวไฟ (the farm map, js/life_farm.js places him) ----------------
  L.mineMentor = {
    id: 'mole', name: 'ตุ่นหัวไฟ', title: 'ครูขุดแร่ · อัปเกรดอีเต้อ', sprite: 'npc_mole', spriteB: 'npc_mole_b', h: 118,
    greet: ['หินก้อนไหนมีแร่ ดูที่ประกายนะ!', 'ใต้ดินมีของดีเยอะเลย~', 'เคาะเบา ๆ ตรงประกาย มอนจะไม่ได้ยิน!'],
    chat: ['เหมืองมดมีเหล็กกับอำพันเพียบ', 'สุสานใต้ดินมีเงินจันทร์ เรืองแสงสวยมาก', 'ถ้าหินลืมตามองกลับ... วิ่ง!', 'แร่ดาวตกหายากสุด ๆ เลยนะ'],
    talk: (game, p) => (L.lvOf(p, 'mine') < 5 ? 'ลองเคาะหินที่ลานหินข้าง ๆ นี่ก่อน กด B ใกล้สายแร่ แล้วกดอีกทีตอนประกายสว่างวาบ!' :
      'ดันเจี้ยนลึก ๆ แร่ดีกว่า แต่หินแข็งกว่าด้วย เอาแร่มา เดี๋ยวตุ่นตีอีเต้อให้!'),
    render: (game, p) => '<div class="mt-sec">' + L.upgradeRow(p, 'pick') + '</div>',
  };
  L.ORE = ORE;
})();
