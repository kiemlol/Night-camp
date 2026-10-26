/* life_fish.js — ตกปลา (fishing), a life skill of js/life.js (the user, 2026-09-29: "ทำระบบตกปลา"; the plan: the
   Artifact "อาชีพเสริม Night Camp", phase 1). Every pond of the fields can be fished (js/water.js gives the ponds and
   makes them move); what bites depends on the water (pond / marsh / glowing woods / grave / poison swamp / mist lake /
   lava), the time (some fish only at night), the fishing level and the rod.
     start      walk to the shore, B or a click on the water
     cast       hold B / Space / J / the mouse: the power swings; let go to cast (further = bigger fish)
     wait       a fish shadow swims to the bobber, nibbles (little ripples) ...
     bite       ... the bobber goes under and "!" pops up: press at once to hook it
     reel       hold to pull (the line tightens), let go to give line: keep the needle in the green until the fish
                is landed; too slack for long and it gets away, too tight for long and the line snaps. Big fish jerk.
     landed     the hero holds it up (its size in cm), it goes into the pouch and the fish book; walk away to stop
   Now and then: an old boot, weed, a sunken treasure chest (coins), and off the safe maps a crab or a turtle that
   jumps out to fight. Three legendary fish (the lily pond king, the shadow of the mist lake, the magma dragonfish).
   The teacher ตานาก (an old otter) fishes by the farm's lily pond: rod upgrades, buys fish, the fish book.
   Rods: t_rod1..4 (bamboo, willow, moon silver, star metal); lava needs the moon-silver rod. Art: assets/life/ (fs_*,
   t_rod*, npc_otter*) from assets/gen/make_life_prompts.py (rods, otter, fish1..5). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, L = NC.Life, WTR = NC.Water, ITEMS = NC.ITEMS, MAT = NC.MATERIALS, K = NC.SkillKit;
  const TAU = Math.PI * 2, $ = (id) => document.getElementById(id);
  if (!L || !WTR) return;

  // ---------------- the skill, the rod ----------------
  L.SKILLS.fish = { name: 'ตกปลา', tool: 'rod', icon: 't_rod1', rgb: '120,190,255',
    perks: [[5, 'ปลากินเบ็ดเร็วขึ้น'], [10, 'บางทีได้ปลา 2 ตัว'], [15, 'ช่องสายพอดีกว้างขึ้น'], [20, 'ปลาหายากออกบ่อยขึ้น'],
      [25, 'ปลาเจ้าถิ่นยอมกินเบ็ดบ่อยขึ้น'], [30, 'ปรมาจารย์: สายไม่ขาดง่าย ปลาไม่หลุดง่าย']] };
  L.TOOLS.rod = { skill: 'fish', names: ['คันเบ็ดไม้ไผ่', 'คันเบ็ดไม้หลิว', 'คันเบ็ดเงินจันทร์', 'คันเบ็ดดาวตก'], sprite: (t) => 't_rod' + t, mentor: 'ตานาก' };
  L.UPGRADES.rod = [{ lv: 8, coins: 1000, mats: { lf_willow: 6, lf_copper: 6 } }, { lv: 16, coins: 10000, mats: { lf_moonsilver: 6, lf_silverwood: 4, fs_ghost: 2 } },
    { lv: 24, coins: 60000, mats: { lf_starore: 4, lf_moonwood: 6, fs_lantern: 3 } }];
  L.GUIDE.fish = [];
  for (let i = 1; i <= 4; i++)
    ITEMS['t_rod' + i] = { slot: 'tool', name: L.TOOLS.rod.names[i - 1], sprite: 't_rod' + i, rarity: 'common', dmg: [1, 1], cd: 0.5, dur: 0.3, hitAt: 0.1,
      reach: 120, arc: 1.2, aspd: 1, desc: '', style: 'thrust', wtype: 'rod', grip: 0.24, grip2: 24, gripAhead: 34, twoHanded: true, restAng: -0.95, stance: -0.95 };
  // (grip: where the holding hand is; grip2: held in the far hand, the near hand on the butt this far down the rod;
  // gripAhead: held in the near hand (the fishing poses), the far hand this far up the rod, in front of the body)
  L.onLoad.push((game, p) => { const r = L.rec(p); r.tools.rod = r.tools.rod || 1; if (!r.fishbook) r.fishbook = {}; });

  // ---------------- the fish ----------------
  // id: [name, price, waters, when (0 any, 1 night, 2 day), fishing Lv, rod tier, weight, [cm min, max], fight 1-6, xp, text]
  const ALL = ['pond', 'marsh', 'woods', 'grave', 'poison', 'lake'];
  const FISH = {
    fs_minnow: ['ปลาซิวเงิน', 4, ['pond', 'marsh', 'lake'], 0, 1, 1, 10, [5, 9], 1, 6, 'ปลาตัวจิ๋วสีเงิน ว่ายกันเป็นฝูงใต้ใบบัว'],
    fs_shrimp: ['กุ้งฝอยใส', 6, ['marsh', 'pond', 'lake'], 0, 1, 1, 6, [3, 6], 0.8, 5, 'กุ้งตัวใสจิ๋ว ทอดกรอบอร่อย'],
    fs_perch: ['ปลาเพิร์ชลายทาง', 8, ['pond', 'lake', 'marsh'], 0, 1, 1, 8, [12, 24], 1.5, 9, 'ปลาลายทางครีบส้ม กินเหยื่อไม่เลือก'],
    fs_goldfish: ['ปลาทองหางพวง', 12, ['pond'], 2, 2, 1, 5, [8, 15], 1, 10, 'ปลาทองแก้มป่อง หางพวงพลิ้วไหว ชอบแดดอุ่น ๆ'],
    fs_bluegill: ['ปลาแก้มฟ้า', 10, ['pond', 'lake'], 0, 3, 1, 7, [10, 20], 1.5, 10, 'ปลาตัวกลมแบน แก้มสีฟ้าสดใส'],
    fs_crab: ['ปูแม่น้ำ', 16, ['marsh', 'lake'], 0, 3, 1, 4, [6, 14], 1.5, 12, 'ปูตัวแดงชูก้ามขู่ หนีบเบ็ดแน่นไม่ยอมปล่อย'],
    fs_frogfish: ['ปลาหัวกบ', 20, ['marsh'], 0, 4, 1, 5, [15, 30], 2, 16, 'ปลาหน้าตาเหมือนกบ ตาโปนยิ้มกว้าง'],
    fs_carp: ['ปลาคาร์ปทอง', 18, ['pond', 'marsh', 'lake'], 0, 5, 1, 6, [25, 60], 2.5, 16, 'ปลาคาร์ปอ้วนเกล็ดทองวาว มีหนวดเล็ก ๆ'],
    fs_catfish: ['ปลาดุกหนวดยาว', 22, ['marsh', 'pond'], 0, 6, 1, 5, [30, 70], 3, 20, 'ปลาดุกปากกว้างหนวดยาว ชอบว่ายตอนมืด'],
    fs_lilyfish: ['ปลาใบบัว', 26, ['pond', 'marsh'], 2, 8, 1, 3, [18, 35], 2, 22, 'ครีบกับหลังเหมือนใบบัว มีดอกบัวตูมบนหัว ซ่อนตัวเก่ง'],
    fs_bone: ['ปลากระดูก', 30, ['grave'], 0, 8, 1, 6, [20, 45], 2.5, 24, 'โครงกระดูกปลาที่ยังว่ายได้ ตาเรืองแสงสีเขียว'],
    fs_eel: ['ปลาไหลลายเขียว', 28, ['marsh', 'poison'], 1, 9, 1, 4, [40, 90], 3.5, 26, 'ปลาไหลตัวยาวลื่น ดิ้นเก่งมาก'],
    fs_glowfish: ['ปลาเห็ดเรืองแสง', 34, ['woods'], 0, 10, 1, 6, [18, 40], 2.5, 28, 'มีหมวกเห็ดเรืองแสงบนหัว จุดฟ้าเรืองทั้งตัว'],
    fs_moonkoi: ['ปลาคาร์ปแสงจันทร์', 70, ['pond', 'lake'], 1, 12, 1, 1.4, [40, 80], 3, 45, 'ปลาคาร์ปสีขาวลายเงินอมฟ้า เรืองแสงเบา ๆ ใต้แสงจันทร์'],
    fs_ghost: ['ปลาผีใส', 55, ['grave'], 1, 12, 1, 4, [25, 50], 3, 38, 'ปลาใสจนเห็นทะลุ ออกมาว่ายเฉพาะกลางดึก'],
    fs_lantern: ['ปลาโคมไฟ', 60, ['woods', 'lake'], 1, 14, 1, 2, [20, 45], 3, 40, 'ปลาปากกว้างมีโคมไฟดวงเล็กห้อยหน้าหัว'],
    fs_slimefish: ['ปลาวุ้นพิษ', 40, ['poison'], 0, 14, 1, 6, [20, 40], 3, 34, 'สไลม์รูปปลาสีเขียวสด มีก้างปลาอยู่ข้างใน'],
    fs_trout: ['ปลาเทราต์สายรุ้ง', 45, ['lake'], 2, 15, 1, 6, [30, 60], 3, 38, 'ปลาเทราต์ตัวเพรียว มีแถบสีรุ้งอมชมพูข้างลำตัว'],
    fs_puffer: ['ปลาปักเป้าพิษ', 48, ['poison'], 0, 16, 1, 5, [15, 30], 3.5, 40, 'ปลาปักเป้าสีม่วงเขียว พองตัวเป็นลูกหนาม'],
    fs_pike: ['ปลาไพค์เขี้ยวเงิน', 65, ['lake'], 0, 18, 2, 4, [60, 120], 4, 52, 'นักล่าปากยาวฟันคมเต็มปาก ดึงแรงมาก'],
    fs_meteor: ['ปลาดาวตก', 400, ALL, 1, 18, 2, 0.25, [40, 80], 4.5, 150, 'ปลาสีครามมีดาวทองระยิบทั้งตัว หางเหมือนดาวหาง หายากมาก', true],
    fs_mistray: ['ปลากระเบนหมอก', 90, ['lake'], 1, 20, 2, 2, [60, 140], 4.5, 70, 'กระเบนสีเทาม่วง ขอบปีกฟุ้งเป็นหมอก', true],
    fs_ember: ['ปลาถ่านคุ', 80, ['lava'], 0, 20, 3, 7, [12, 25], 3, 60, 'ปลาดำสนิท ท้องเรืองส้ม ครีบเหมือนเปลวไฟ'],
    fs_lavafish: ['ปลาลาวา', 110, ['lava'], 0, 22, 3, 6, [30, 70], 4, 80, 'ปลาหินภูเขาไฟ รอยร้าวลาวาเรืองแสงทั้งตัว'],
    // the legends (one to a kind of water)
    fs_lilyking: ['ราชาปลาบึงบัว', 1500, ['pond'], 0, 20, 2, 0.12, [120, 200], 5, 400, 'ปลาคาร์ปทองยักษ์ ใบบัวกับดอกบัวงอกบนหลัง เจ้าแห่งบึงบัว', 'legend'],
    fs_lakeshadow: ['เงาใต้ทะเลสาบหมอก', 2500, ['lake'], 1, 26, 3, 0.1, [200, 320], 5.5, 600, 'ปลาโบราณตัวมหึมา มีหมอกห่อหุ้ม ตาเรืองแสงซีด', 'legend'],
    fs_magmadragon: ['ปลามังกรลาวา', 3000, ['lava'], 0, 28, 4, 0.1, [150, 260], 6, 700, 'ปลามังกรหินภูเขาไฟ ลาวาไหลเป็นครีบ', 'legend'],
    // not fish
    fs_boot: ['รองเท้าบูทเก่า', 1, ALL, 0, 1, 1, 2, [0, 0], 0.6, 2, 'รองเท้าบูทหนังเปียกโชก มีรูด้วย ใครทิ้งไว้เนี่ย'],
    fs_weed: ['สาหร่ายพันกัน', 1, ALL, 0, 1, 1, 2.5, [0, 0], 0.5, 2, 'สาหร่ายเขียวพันเบ็ดมาเป็นก้อน'],
    fs_chest: ['หีบสมบัติจมน้ำ', 0, ALL.concat(['lava']), 0, 6, 1, 0.6, [0, 0], 2.5, 20, 'หีบไม้คาดเหล็ก มีเหรียญทองโผล่ออกมา', true],
  };
  const JUNK = { fs_boot: 1, fs_weed: 1, fs_chest: 1 };
  const WATER_NAME = { pond: 'บ่อและบึงทั่วไป', marsh: 'บึงกบลำธารใส', woods: 'บึงในป่าเห็ดเรืองแสง', grave: 'บ่อเนินสุสาน', poison: 'หนองพิษป่าชายเลน',
    lake: 'ทะเลสาบหมอกเงา', lava: 'บ่อลาวาภูเขาไฟ (คันเบ็ดเงินจันทร์ขึ้นไป)' };
  for (const id in FISH) {
    const [name, price, waters, when, lv, tier, , , , , text, rare] = FISH[id];
    if (id === 'fs_chest') { MAT[id] = { name, price: 0, desc: text, life: true, rare: true }; continue; }
    MAT[id] = { name, price, desc: text, life: true };
    if (rare) MAT[id].rare = true;
    L.SOURCE[id] = 'ตกปลา: ' + waters.map((w) => WATER_NAME[w]).join(' · ') + (when === 1 ? ' (กลางคืน)' : when === 2 ? ' (กลางวัน)' : '');
    if (!JUNK[id]) L.GUIDE.fish.push({ mat: id, name, lv, tier: tier > 1 ? tier : 0, night: when === 1, where: waters.length > 5 ? 'แหล่งน้ำไหนก็ได้' : waters.map((w) => WATER_NAME[w]).join(' · ') });
  }
  L.FISH = FISH;

  // what kind of water a pond is (by the map's ground and the pond itself)
  const BIOME_WATER = { marsh: 'marsh', woods: 'woods', grave: 'grave', swamp: 'poison', lake: 'lake' };
  const waterOf = (world, pond) => (pond.glow ? 'lava' : BIOME_WATER[world.biome] || 'pond');

  // ---------------- choosing what bites ----------------
  function choose(game, p, a) {
    const w = a.water, night = L.isNight(game), lv = L.lvOf(p, 'fish'), tier = L.toolTier(p, 'rod');
    const list = [];
    for (const id in FISH) {
      const F = FISH[id];
      if (!F[2].includes(w) || F[4] > lv || F[5] > tier) continue;
      if ((F[3] === 1 && !night) || (F[3] === 2 && night)) continue;
      if (w === 'lava' && (id === 'fs_boot' || id === 'fs_weed')) continue;
      let wt = F[6];
      if (MAT[id].rare) wt *= 1 + (lv >= 20 ? 0.5 : 0) + a.power * 0.6; // (a long cast reaches the deep water)
      if (legendOf(id)) wt *= 1 + (lv >= 25 ? 1 : 0);
      if (JUNK[id] && id !== 'fs_chest') wt *= 1.2 - a.power * 0.6;
      list.push([id, Math.max(0.01, wt)]);
    }
    let r = Math.random() * list.reduce((s, x) => s + x[1], 0);
    for (const [id, wt] of list) { r -= wt; if (r <= 0) return id; }
    return list.length ? list[0][0] : 'fs_weed';
  }
  const legendOf = (id) => FISH[id] && FISH[id][11] === 'legend';

  // ---------------- the fishing spots: the shore nearest to the hero ----------------
  const safeMap = (game) => !!(game.world && (game.world.lifeSafe || (NC.MAPS[game.mapId] || {}).lifeSafe || game.world.farm));
  let spot = null;
  L.finders.push((game) => {
    const p = game.player, w = game.world;
    if (!p || !w || !w.ponds || !w.ponds.length || p.fishAct) return null;
    let best = null;
    for (const pond of w.ponds) {
      const s = WTR.shorePoint(pond, p.x, p.y);
      if (s.d < 130 && (!best || s.d < best.d)) best = { pond, x: s.x, y: s.y, d: s.d };
    }
    if (!best) { spot = null; return null; }
    const water = waterOf(w, best.pond);
    if (!spot || spot.pond !== best.pond) spot = { skill: 'fish', game: null, reach: 150, use: startFishing, tagY: null };
    Object.assign(spot, { pond: best.pond, x: best.x, y: best.y + 10, hx: best.x, hy: best.y, water, lv: water === 'lava' ? 18 : 1, tier: water === 'lava' ? 3 : 0,
      verb: water === 'lava' ? 'ตกปลาในลาวา' : 'ตกปลา', label: WATER_NAME[water].replace(/ \(.*\)$/, ''), box: [best.x - 90, best.y - 60, best.x + 90, best.y + 60],
      ok: () => !game.player.fishAct });
    return [spot];
  });

  // ---------------- the fishing itself ----------------
  const rodId = (p) => 't_rod' + L.toolTier(p, 'rod');
  function startFishing(game, p, n) {
    if (p.fishAct || p.dead > 0) return;
    const a = { pond: n.pond, water: n.water, shore: [n.hx, n.hy], phase: 'ready', t: 0, hold: false, power: 0, pdir: 1 };
    p.fishAct = a;
    p.atk.on = false;
    p.channel = { fish: true, t: 0, dur: Infinity, update: tick, end: null };
    L.showTool(game, p, rodId(p), Infinity);
    faceTo(p, a.shore[0], a.shore[1]);
  }
  function faceTo(p, x, y) { p.face = x >= p.x ? 1 : -1; p.aim = NC.angle(p.x, p.y - 60, x, y); }
  function stopFishing(game, p, why) {
    const a = p.fishAct;
    if (!a) return;
    freeFish(a);
    p.fishAct = null;
    if (p.channel && p.channel.fish) p.channel = null;
    L.showTool(game, p, rodId(p), 0.35);
    if (why) FX.text(p.x, p.y - 170, why, '#fff3cf', 20);
  }
  L.stopFishing = stopFishing;
  function freeFish(a) {
    if (a.fish) { a.fish.lure = false; a.fish.wait = 0.2; a.fish.s = a.fish.s0 || a.fish.s; a.fish.tx = a.pond.x + NC.rand(-a.pond.rx, a.pond.rx) * 0.5; a.fish.ty = a.pond.y + NC.rand(-a.pond.ry, a.pond.ry) * 0.5; a.fish = null; }
  }
  // the bobber's spot: from the shore out into the water, as far as the power says (kept inside the pond)
  function target(a, p) {
    const pond = a.pond, sx = a.shore[0], sy = a.shore[1];
    let dx = pond.x - sx, dy = pond.y - sy;
    const ph = NC.angle(p.x, p.y, sx, sy); // (partly the way the hero faces the water)
    dx = dx / (Math.hypot(dx, dy) || 1) + Math.cos(ph) * 0.8; dy = dy / (Math.hypot(pond.x - sx, pond.y - sy) || 1) + Math.sin(ph) * 0.8;
    const L0 = Math.hypot(dx, dy) || 1; dx /= L0; dy /= L0;
    let dist = 50 + a.power * Math.min(320, Math.max(pond.rx, pond.ry) * 1.1);
    for (let k = 0; k < 30; k++) {
      const x = sx + dx * dist, y = sy + dy * dist * 0.75;
      if (WTR.inPoly(pond.inner || pond.pts, x, y) && WTR.inPoly(pond.inner || pond.pts, x, y + 14)) return [x, y];
      dist *= k < 10 ? 0.88 : 1.08;
    }
    return [pond.x, pond.y];
  }

  function press(game, p) {
    const a = p.fishAct;
    if (!a) return;
    a.hold = true;
    if (a.phase === 'ready') { a.phase = 'aim'; a.power = 0; a.pdir = 1; }
    else if (a.phase === 'wait' || a.phase === 'nibble') { reelIn(game, p, a, 'ดึงเบ็ดกลับ'); }
    else if (a.phase === 'bite') hook(game, p, a);
  }
  function release(game, p) {
    const a = p.fishAct;
    if (!a) return;
    a.hold = false;
    if (a.phase === 'aim') cast(game, p, a);
  }
  function cast(game, p, a) {
    const [tx, ty] = target(a, p);
    a.phase = 'fly'; a.t = 0; a.fly = 0.5; a.to = [tx, ty];
    a.from = rodTip(p) || [p.x, p.y - 100];
    faceTo(p, tx, ty);
    a.castWord = a.power > 0.8 ? 'ไกลสุด!' : a.power > 0.5 ? 'เหวี่ยงดี!' : '';
  }
  function landed(game, p, a) {
    a.phase = 'wait'; a.t = 0; a.bob = a.to.slice();
    if (a.castWord) FX.text(a.bob[0], a.bob[1] - 50, a.castWord, '#bfe4ff', 18);
    WTR.ripple(a.pond, a.bob[0], a.bob[1], 34, { a: 0.8 });
    V.sparks(a.bob[0], a.bob[1] - 4, 6, '200,230,255', { ang: -Math.PI / 2, spread: 0.9, min: 120, max: 260, size: 0.5, grav: 900 });
    a.catch = choose(game, p, a);
    const lv = L.lvOf(p, 'fish');
    a.wait = NC.rand(2.2, 6.5) * (lv >= 5 ? 0.8 : 1) * (legendOf(a.catch) ? 1.6 : 1);
    a.nibbles = 1 + Math.floor(Math.random() * 3);
    // a shadow from the pond comes to it (its size tells the fish's size)
    const F = FISH[a.catch], big = JUNK[a.catch] ? 0.8 : NC.clamp(0.6 + (F[7][1] / 90), 0.6, legendOf(a.catch) ? 3.2 : 2);
    let best = null, bd = Infinity;
    for (const f of a.pond.fish || []) { const d = Math.hypot(f.x - a.bob[0], f.y - a.bob[1]); if (!f.lure && d < bd) { bd = d; best = f; } }
    if (!best) { best = { x: a.bob[0] + 200, y: a.bob[1], a: Math.PI, s: big, v: 0, wig: 0, wait: 0 }; (a.pond.fish = a.pond.fish || []).push(best); }
    best.lure = true; best.s0 = best.s; best.s = big;
    a.fish = best;
  }
  function hook(game, p, a) {
    a.phase = 'reel'; a.t = 0;
    const F = FISH[a.catch], lv = L.lvOf(p, 'fish'), tier = L.toolTier(p, 'rod');
    a.size = F[7][1] ? Math.round(NC.lerp(F[7][0], F[7][1], Math.pow(Math.random(), 1.6 - a.power * 0.6))) : 0;
    a.pow = F[8] * (a.size && F[7][1] > F[7][0] ? 0.8 + 0.4 * ((a.size - F[7][0]) / (F[7][1] - F[7][0])) : 1);
    a.T = 0.45; a.C = 0.12; a.slack = 0; a.snap = 0; a.jerk = 0.8;
    const wide = 0.04 * (tier - 1) + (lv >= 15 ? 0.05 : 0);
    a.gLo = 0.36 - wide * 0.5; a.gHi = 0.7 + wide * 0.5 - Math.min(0.12, (a.pow - 2) * 0.03);
    a.snapMax = 0.55 + tier * 0.1 + (lv >= 30 ? 0.35 : 0); a.slackMax = 2.2 + (lv >= 30 ? 1 : 0);
    // off the safe maps, now and then it's no fish at all
    if (!safeMap(game) && !legendOf(a.catch) && Math.random() < 0.035) return monster(game, p, a);
    WTR.ripple(a.pond, a.bob[0], a.bob[1], 44, { a: 0.9 });
    V.sparks(a.bob[0], a.bob[1] - 6, 10, '210,236,255', { ang: -Math.PI / 2, spread: 1, min: 180, max: 380, size: 0.6, grav: 1000 });
    FX.text(p.x, p.y - 200, legendOf(a.catch) ? 'ปลาเจ้าถิ่น!! ดึงดี ๆ นะ' : 'ติดเบ็ดแล้ว!', legendOf(a.catch) ? '#ffd35c' : '#bfe4ff', legendOf(a.catch) ? 26 : 22);
    if (legendOf(a.catch)) V.shake(game, 6);
  }
  function monster(game, p, a) {
    const w = game.world, types = ['crab', 'turtle', 'frog'].filter((t) => NC.MONSTERS[t]);
    stopFishing(game, p);
    if (!types.length) return;
    const type = types[Math.floor(Math.random() * types.length)], x = a.shore[0], y = a.shore[1] + 30;
    const e = NC.makeEnemy(type, x, y, NC.spawnLevel ? NC.spawnLevel(w, 'hollow', x, y) : p.lv);
    game.enemies.push(e);
    WTR.ripple(a.pond, a.bob[0], a.bob[1], 60, { a: 1 });
    V.sparks(x, y - 20, 14, '200,230,255', { ang: -Math.PI / 2, spread: 1.2, min: 220, max: 480, size: 0.7, grav: 1100 });
    FX.text(x, y - 140, 'มอนติดเบ็ด! กระโดดขึ้นมาแล้ว', '#ffb0a0', 24);
  }
  function reelIn(game, p, a, why) {
    freeFish(a);
    a.phase = 'ready'; a.t = 0; a.hold = false;
    if (why) FX.text(p.x, p.y - 170, why, '#fff3cf', 18);
  }
  function lose(game, p, a, why) {
    freeFish(a);
    a.phase = 'lost'; a.t = 0; a.why = why;
    FX.text(p.x, p.y - 190, why, '#ffb0a0', 24);
    WTR.ripple(a.pond, a.bob[0], a.bob[1], 50, { a: 0.9 });
  }
  function land(game, p, a) {
    // the fish comes out of the water: a big splash, then it flies up into the hero's hands (lift), then he holds it
    // up (show); it goes into the pouch when he catches it
    freeFish(a);
    a.phase = 'lift'; a.t = 0; a.liftFrom = a.bob.slice();
    const [bx, by] = a.bob, big = legendOf(a.catch) ? 2 : MAT[a.catch] && MAT[a.catch].rare ? 1.4 : 1;
    WTR.ripple(a.pond, bx, by, 60 * big, { a: 1 }); WTR.ripple(a.pond, bx, by, 34 * big, { a: 0.9, life: 0.8 });
    V.sparks(bx, by - 8, Math.round(16 * big), '190,225,255', { ang: -Math.PI / 2, spread: 0.9, min: 260, max: 620, size: 0.8, grav: 1500, lifeK: 1.4 });
    V.sparks(bx, by - 4, Math.round(8 * big), '255,255,255', { ang: -Math.PI / 2, spread: 1.3, min: 160, max: 360, size: 0.5, grav: 1200 });
    if (V.bubbles) V.bubbles(bx, by, Math.round(6 * big), 'rgba(210,236,255,0.9)', { spread: 30 });
    FX.ring(bx, by, 10, 90 * big, '200,235,255', 0.5, 6);
  }
  function caught(game, p, a) {
    const id = a.catch, F = FISH[id], lv = L.lvOf(p, 'fish'), book = L.rec(p).fishbook || (L.rec(p).fishbook = {});
    a.phase = 'show'; a.t = 0;
    if (id === 'fs_chest') {
      const coins = Math.round(NC.rand(60, 140) * (1 + p.lv / 20));
      p.coins += coins;
      a.extra = `+${NC.fmtCoins(coins)} เหรียญ`;
      if (Math.random() < 0.25) NC.addMat(game, ['lf_ruby', 'lf_sapphire', 'lf_emerald', 'lf_topaz', 'lf_amethyst'][Math.floor(Math.random() * 5)], 1);
    } else {
      const n = !JUNK[id] && lv >= 10 && Math.random() < 0.2 ? 2 : 1;
      NC.addMat(game, id, n);
      a.extra = n > 1 ? 'ได้ 2 ตัว!' : '';
    }
    const rec = book[id] || (book[id] = { n: 0, best: 0 }), first = rec.n === 0, record = a.size > rec.best && rec.n > 0;
    rec.n++; rec.best = Math.max(rec.best, a.size);
    a.show = { id, size: a.size, first, record, grade: legendOf(id) ? 2 : MAT[id] && MAT[id].rare ? 1 : 0 };
    const xp = F[9] * (a.size && F[7][1] > F[7][0] ? 0.85 + 0.3 * ((a.size - F[7][0]) / (F[7][1] - F[7][0])) : 1);
    L.addXp(game, 'fish', xp);
    // the burst where he holds it
    const hold = heldAt(p) || [p.x, p.y - 190], G = a.show.grade, rgb = G === 2 ? '255,220,120' : G === 1 ? '255,214,110' : '190,228,255';
    V.stars(hold[0], hold[1] - 20, G === 2 ? 26 : G === 1 ? 16 : 9, G ? '#ffd35c' : '#e8f6ff', rgb, { speed: G === 2 ? 380 : 260 });
    FX.ring(hold[0], hold[1] - 20, 16, G === 2 ? 240 : 150, rgb, 0.7, G === 2 ? 10 : 7);
    V.sparks(hold[0], hold[1] - 20, 10, '200,235,255', { min: 120, max: 300, size: 0.5, grav: 700 });
    if (G === 2) {
      V.shake(game, 9);
      if (V.flash) V.flash('255,236,170', 0.35, 0.5);
      game.toast(`จับได้ ${F[0]} ${a.size} ซม.!!`);
      NC.HUD.log(`ปลาเจ้าถิ่น! จับ${F[0]}ได้ ขนาด ${a.size} ซม.`, 'item');
    } else NC.HUD.log(JUNK[id] ? `ตกได้${F[0]}` : `ตกได้${F[0]} ${a.size} ซม.${record ? ' (สถิติใหม่!)' : ''}`, 'item');
    L.save(game);
  }
  // where the hands hold the catch up (world): between them
  // where the catch is held (world): the hands, held out in front
  function heldAt(p) {
    const J = p.pose && NC.rigJoints && NC.rigJoints(Object.assign({}, p.equip, { weapon: rodId(p), shield: null }), p.pose, p.x, p.y, 1);
    return J ? [(J.haN[0] + J.haF[0]) / 2, (J.haN[1] + J.haF[1]) / 2] : null;
  }
  const rodTip = (p) => {
    if (!p.pose) return null;
    const Ln = NC.weaponLine(Object.assign({}, p.equip, { weapon: rodId(p), shield: null }), p.pose, p.x, p.y);
    return Ln ? Ln.tip : null;
  };

  function tick(game, p, ch, dt) {
    const a = p.fishAct;
    if (!a) { p.channel = null; return; }
    if (p.dead > 0 || game.world.ponds.indexOf(a.pond) < 0) return stopFishing(game, p);
    if (game.input.mx || game.input.my) return stopFishing(game, p); // walking away
    p.vx = p.vy = 0; p.moving = p.running = false;
    a.t += dt;
    const lv = L.lvOf(p, 'fish');
    switch (a.phase) {
      case 'aim':
        a.power += a.pdir * dt * 1.25;
        if (a.power >= 1) { a.power = 1; a.pdir = -1; } else if (a.power <= 0) { a.power = 0; a.pdir = 1; }
        break;
      case 'fly':
        if (a.t >= a.fly) landed(game, p, a);
        break;
      case 'wait': case 'nibble': {
        const f = a.fish;
        if (f) { // the shadow comes closer, circles, nibbles
          const d = Math.hypot(a.bob[0] - f.x, a.bob[1] - f.y), want = Math.atan2(a.bob[1] - f.y, a.bob[0] - f.x);
          const da = Math.atan2(Math.sin(want - f.a), Math.cos(want - f.a));
          f.a += NC.clamp(da, -3 * dt, 3 * dt);
          const sp = d > 60 ? 45 : 16;
          if (d > 26) { f.x += Math.cos(f.a) * sp * dt; f.y += Math.sin(f.a) * sp * dt * 0.62; }
          f.wig += dt * 6;
        }
        a.wait -= dt;
        if (a.wait < 1.6 && a.nibbles > 0 && Math.random() < dt * 2.2) { // (a nibble: a little dip and a ring)
          a.nibbles--; a.dip = 0.25; a.phase = 'nibble';
          WTR.ripple(a.pond, a.bob[0], a.bob[1], 20, { a: 0.6 });
        }
        if (a.wait <= 0) {
          a.phase = 'bite'; a.t = 0; a.win = 0.62 + lv * 0.01 + (lv >= 5 ? 0.08 : 0);
          WTR.ripple(a.pond, a.bob[0], a.bob[1], 40, { a: 0.9 });
          V.sparks(a.bob[0], a.bob[1] - 4, 8, '200,230,255', { ang: -Math.PI / 2, spread: 0.9, min: 140, max: 300, size: 0.5, grav: 900 });
        }
        break;
      }
      case 'bite':
        if (a.t > a.win) lose(game, p, a, 'ปลากินเหยื่อแล้วหนีไป!');
        break;
      case 'reel': {
        // the pull: hold = tighter, let go = slacker; the fish jerks the line now and then
        a.T += (a.hold ? 0.95 + a.pow * 0.05 : -0.85) * dt;
        a.jerk -= dt;
        if (a.jerk <= 0) {
          a.jerk = NC.rand(0.35, 1.1) / Math.max(0.6, a.pow / 3);
          a.T += NC.rand(0.08, 0.2) * (a.pow / 3.2) * (Math.random() < 0.7 ? 1 : -0.7);
          WTR.ripple(a.pond, a.bob[0], a.bob[1], 26 + a.pow * 4, { a: 0.7 });
        }
        a.T = NC.clamp(a.T, 0, 1);
        const green = a.T >= a.gLo && a.T <= a.gHi;
        if (green) a.C += dt * (0.16 / (0.45 + a.pow * 0.22)) * (1 + (L.toolTier(p, 'rod') - 1) * 0.12);
        else a.C -= dt * 0.04;
        a.slack = a.T < a.gLo ? a.slack + dt : Math.max(0, a.slack - dt * 2);
        a.snap = a.T > 0.94 ? a.snap + dt : Math.max(0, a.snap - dt * 2);
        a.C = NC.clamp(a.C, 0, 1);
        // the bobber is pulled in towards the shore as the fish tires, and thrashes about
        const k = a.C * 0.8, tx = NC.lerp(a.to[0], a.shore[0], k), ty = NC.lerp(a.to[1], a.shore[1], k);
        a.bob = [tx + Math.sin(a.t * 7) * 6 * a.pow, ty + Math.cos(a.t * 5.3) * 3 * a.pow];
        if (!WTR.inPoly(a.pond.inner || a.pond.pts, a.bob[0], a.bob[1])) a.bob = [NC.lerp(a.bob[0], a.pond.x, 0.2), NC.lerp(a.bob[1], a.pond.y, 0.2)];
        if (Math.random() < dt * 3) WTR.ripple(a.pond, a.bob[0], a.bob[1], 18, { a: 0.5 });
        if (a.slack > a.slackMax) lose(game, p, a, 'สายหย่อนเกินไป ปลาหลุด!');
        else if (a.snap > a.snapMax) lose(game, p, a, 'สายขาด!');
        else if (a.C >= 1) land(game, p, a);
        break;
      }
      case 'lift':
        if (a.t >= 0.5) caught(game, p, a);
        break;
      case 'show': case 'lost':
        if (a.t > (a.phase === 'show' ? 2.4 : 1.1)) { a.phase = 'ready'; a.t = 0; a.show = null; }
        break;
    }
    if (a.dip) a.dip = Math.max(0, a.dip - dt);
    if (a.phase === 'nibble' && !a.dip) a.phase = 'wait';
    const look = a.phase === 'show' || a.phase === 'lift' ? a.liftFrom || a.bob : a.bob || a.to || [a.pond.x, a.pond.y];
    faceTo(p, look[0], look[1]);
  }

  // ---------------- the fishing pose: the rod in both hands (near hand on the reel seat, far hand on the butt) ----------------
  // (the user, 2026-09-29: "ท่าถือเบ็ดตอนตกปลาต้องเป็น 2 มือ") set over the animation every frame while fishing and
  // blended in and out: a wide easy stance, the rod held out over the water; drawn back over the shoulder while charging,
  // swung forward on the cast, tipped down at the bite, pulled up and back while reeling (harder the tighter the line),
  // yanked up as the fish comes out, then put away while both hands hold the catch up high
  // (arm and weapon angles: 0 = straight ahead, negative = raised, positive = lowered)
  const ease = (u) => u * u * (3 - 2 * u);
  function fishPose(a, t, over) {
    // the rod is in the NEAR hand; the FAR hand joins it further up the rod (ik + the rod's gripAhead), out in front of
    // the torso where it shows (a clip made earlier may hold it in the far hand, the near hand on the butt: kept so).
    // Four key poses: ready (held out, waiting), aim (drawn back to cast), reel (pulling), show (the catch held out);
    // the user can make any of them in the Pose Studio (a one-shot clip marked "ใช้ในเกมเป็นท่าตกปลา", saved in
    // js/poselib_data.js as d.fish): that picture replaces the built-in one, the rest (the power, the tension, the
    // cast, the bite, breathing) moves on top of it
    const ph = a ? a.phase : 'ready', u = a ? a.t : 0, breath = Math.sin(t * 1.7);
    const S = over || studioFish();
    const key = (name) => keyOf(name, S);
    const mix = (A, B, k) => { const o = {}; for (const c in A) o[c] = B[c] === undefined ? A[c] : NC.lerp(A[c], B[c], k); for (const c in B) if (o[c] === undefined) o[c] = B[c]; return o; };
    let T;
    if (ph === 'aim') T = mix(key('ready'), key('aim'), ease(0.25 + 0.75 * a.power));
    else if (ph === 'fly') {
      // swung forward from the drawn-back pose, a little past the held one, then settling
      const k = ease(NC.clamp(u / 0.16, 0, 1)), k2 = ease(NC.clamp((u - 0.16) / 0.3, 0, 1));
      T = mix(mix(key('aim'), key('ready'), k), key('ready'), k2);
      T.wAng += 0.34 * k * (1 - k2); T.lean = (T.lean || 0) + 0.1 * k * (1 - k2);
    } else if (ph === 'reel') {
      T = key('reel');
      const k = a.T - 0.5, j = Math.sin(t * 31) * 0.035 * a.pow, h = farHold(T) ? 'aB' : 'aF';
      T.wAng -= k * 0.5 - j; T[h] = (T[h] || 0) - k * 0.4 + j * 0.5; T.lean = (T.lean || 0) - k * 0.1;
    } else if (ph === 'lift') T = mix(key('reel'), key('aim'), ease(NC.clamp(u / 0.2, 0, 1)));
    else if (ph === 'show') {
      T = key('show');
      const hop = u < 0.32 ? Math.sin((u / 0.32) * Math.PI) : 0, wob = Math.sin(u * 5) * 0.04 * Math.max(0, 1 - u / 1.6);
      T.y = (T.y || 0) - 12 * hop; T.aF = (T.aF || 0) + wob; T.aB = (T.aB || 0) - wob;
      T.wHide = 1;
    } else if (ph === 'lost') { T = key('ready'); const h = farHold(T) ? 'aB' : 'aF'; T.wAng = -0.2; T[h] = (T[h] || 0) + 0.4; T.head = 0.14; T.lean = 0.1; }
    else {
      T = key('ready');
      if (ph === 'bite') { T.wAng += 0.22 + 0.05 * Math.sin(t * 42); T.lean = (T.lean || 0) + 0.04; T.head = (T.head || 0) + 0.05; }
      if (a && a.dip) T.wAng += 0.12 * (a.dip / 0.25);
    }
    if (ph !== 'show') { const h = farHold(T) ? 'aB' : 'aF'; T.wAng += 0.025 * breath; T[h] = (T[h] || 0) + 0.02 * breath; }
    return T;
  }
  // the built-in key poses (the user's studio poses go over them)
  // (the rod in the NEAR hand, the user 2026-09-29: "เบ็ดอยากให้สลับมาอีกมือ"; the far hand joins ahead on the rod, the
  // rod's gripAhead, so both show; drawn back to cast, the rod goes behind the head, wz, clear of the face)
  const BUILT = {
    ready: { legF: 0.14, legB: -0.12, kF: 0.16, kB: 0.18, lean: 0.03, head: 0.05, aF: 0.62, eF: 0.2, aB: 0.9, eB: 1.1, wAng: -0.72, wPush: 0, gAdj: 0, ik: 1, wFar: 0, wHide: 0, wz: 0, y: 0 },
    aim: { legF: 0.14, legB: -0.2, kF: 0.16, kB: 0.3, lean: -0.12, head: -0.06, aF: 0.2, eF: 0.5, aB: 0.9, eB: 1.1, wAng: -2.3, wPush: 0, gAdj: 0, ik: 1, wFar: 0, wHide: 0, wz: 1, y: 0 },
    reel: { legF: 0.22, legB: -0.2, kF: 0.33, kB: 0.42, lean: -0.11, head: -0.04, aF: 0.4, eF: 0.55, aB: 0.9, eB: 1.1, wAng: -1.12, wPush: 0, gAdj: 0, ik: 1, wFar: 0, wHide: 0, wz: 0, y: 0 },
    show: { legF: 0.14, legB: -0.12, kF: 0.16, kB: 0.18, lean: -0.05, head: -0.1, aF: 0.22, eF: 0.4, aB: 0.12, eB: 0.45, wAng: -0.72, wPush: 0, gAdj: 0, ik: 0, wFar: 0, wHide: 1, wz: 0, y: 0 },
  };
  // one picture makes them all (the user, 2026-09-29: "ตัวบันทึกออโต้เฟรมเฟรมเดียวให้ใช้กับท่าเบ็ดได้ด้วย เป็นท่ายืน ได้ปลา
  // ตอนดึงปลา"): a phase the user did not pose is made from the one they did. It keeps their picture (the stance, the
  // arms, the rod, the head) and moves it as far as the built-in phase moves from the built-in held pose: drawn back to
  // cast, leaning back and pulling while reeling, and so on. The catch is always held the built-in way (both hands on
  // the fish, the rod put away), only the legs, the lean and the head come from their picture there.
  const REL = ['legF', 'legB', 'kF', 'kB', 'lean', 'head', 'aF', 'eF', 'aB', 'eB', 'wAng', 'wPush', 'gAdj', 'y'];
  const OWN = { show: { aF: 1, eF: 1, aB: 1, eB: 1, wAng: 1, wPush: 1, gAdj: 1 } };
  const SWITCH = ['ik', 'wHide', 'wz'];
  const LIMIT = { aF: [-2.5, 2.2], aB: [-2.5, 2.2], eF: [-0.3, 2.4], eB: [-0.3, 2.4], wAng: [-2.95, 0.9], lean: [-0.4, 0.4] };
  // (and per phase: pulling, the rod stays in front of the head, or the line would cross the face)
  const PH_LIMIT = { reel: { wAng: [-1.5, 0.2] }, aim: { wAng: [-2.95, -1.6] } };
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const farHold = (P) => num(P && P.wFar, 0) > 0.5;
  // how far the built-in phase moves each channel from the built-in held pose; held in the far hand (far), the arm
  // moves swap arms
  function moveOf(name, far) {
    const d = {};
    for (const c of REL) d[c] = BUILT[name][c] - BUILT.ready[c];
    if (far) { [d.aF, d.aB] = [d.aB, d.aF]; [d.eF, d.eB] = [d.eB, d.eF]; }
    return d;
  }
  // the held pose (ready) the user's picture stands for: theirs, or worked back from the phase they did pose
  function baseOf(S) {
    if (S.ready) return S.ready;
    for (const n of ['reel', 'aim', 'show']) {
      if (!S[n]) continue;
      const B = Object.assign({}, S[n]), own = OWN[n] || {}, d = moveOf(n, farHold(S[n]));
      for (const c of REL) B[c] = own[c] ? BUILT.ready[c] : num(S[n][c], BUILT[n][c]) - d[c];
      for (const c of SWITCH) B[c] = BUILT.ready[c];
      if (n === 'show') B.wFar = BUILT.ready.wFar;
      return B;
    }
    return null;
  }
  function keyOf(name, S) {
    if (S[name]) return Object.assign({}, BUILT[name], S[name]);
    const B = baseOf(S);
    if (!B) return Object.assign({}, BUILT[name]);
    const T = Object.assign({}, BUILT.ready, B), own = OWN[name] || {}, far = farHold(B), d = moveOf(name, far);
    for (const c of SWITCH) T[c] = BUILT[name][c];
    T.wFar = name === 'show' ? 0 : far ? 1 : 0;
    for (const c of REL) {
      T[c] = own[c] ? BUILT[name][c] : num(B[c], BUILT.ready[c]) + d[c];
      if (LIMIT[c] && !own[c]) T[c] = NC.clamp(T[c], LIMIT[c][0], LIMIT[c][1]);
      const lim = PH_LIMIT[name] && PH_LIMIT[name][c];
      if (lim) T[c] = NC.clamp(T[c], lim[0], lim[1]);
    }
    return T;
  }
  // the poses a pose library holds, per phase (the first key of each clip marked d.fish; the last clip per phase wins)
  function posesOf(lib) {
    const poses = {};
    for (const id in lib || {}) {
      const d = lib[id];
      if (!d || !d.fish || !d.keys || !d.keys.length) continue;
      const k0 = d.keys.slice().sort((x, y) => x.t - y.t)[0].P, P = {};
      for (const c in k0) if (c !== 'x' && c !== 'fade' && c !== 'turn' && c !== 'rot') P[c] = k0[c];
      poses[d.fish] = P;
    }
    return poses;
  }
  let fishLib = null;
  function studioFish() {
    if (fishLib && fishLib.src === NC.POSE_LIB) return fishLib.poses;
    const poses = posesOf(NC.POSE_LIB);
    fishLib = { src: NC.POSE_LIB, poses };
    return poses;
  }
  const baseAnim = NC.updateHeroAnim;
  NC.updateHeroAnim = function (game, dt) {
    baseAnim.apply(this, arguments);
    const p = game.player, a = p && p.fishAct;
    if (!p || !p.pose) return;
    p.fishW = NC.clamp((p.fishW || 0) + (a ? dt * 7 : -dt * 5), 0, 1);
    const w = ease(p.fishW);
    if (w <= 0.001) return;
    const P = p.pose, T = fishPose(a || null, game.time);
    for (const k in T) P[k] = NC.lerp(P[k] === undefined ? T[k] : P[k], T[k], w);
    if (w > 0.5) { P.tuck = 0; P.wBehind = false; }
  };
  L.fishPose = fishPose; L.FISH_POSES = BUILT; L.fishPosesOf = posesOf; L.fishKey = keyOf;

  // ---------------- keys and clicks while fishing (before the game's own: the attack, the pouch) ----------------
  const typing = () => { const t = document.activeElement; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); };
  const KEYS = { KeyB: 1, Space: 1, KeyJ: 1 };
  addEventListener('keydown', (e) => {
    const game = NC.game, p = game && game.player;
    if (!p || !p.fishAct || game.paused || typing() || !KEYS[e.code]) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!e.repeat) press(game, p);
  }, true);
  addEventListener('keyup', (e) => {
    const game = NC.game, p = game && game.player;
    if (!p || !p.fishAct || !KEYS[e.code]) return;
    e.preventDefault(); e.stopImmediatePropagation();
    release(game, p);
  }, true);
  addEventListener('mousedown', (e) => {
    const game = NC.game, p = game && game.player;
    if (e.button !== 0 || !p || !p.fishAct || game.paused || e.target !== $('view')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    press(game, p);
  }, true);
  addEventListener('mouseup', (e) => {
    const game = NC.game, p = game && game.player;
    if (e.button !== 0 || !p || !p.fishAct) return;
    release(game, p);
  }, true);

  // ---------------- drawing ----------------
  // (the user, 2026-09-29: "เอ็นกับเหยื่อให้ทำ art ดี ๆ ... เอฟเฟกต์ตอนได้ปลาด้วย") the tackle is art (assets/life:
  // fb_float1..4 for the rod tiers, fb_worm on the hook); the line has a dark edge and a light core and sags as slack as
  // it is; the float sits in the water (its lower half under the surface, pulled under at the bite); the catch flies out
  // shedding drops and is held up with light rays, a pulse, sparkles and drips (bigger and golden for a rare one, a
  // rainbow for a legend)
  const floatOf = (p) => 'fb_float' + L.toolTier(p, 'rod');
  function drawFloat(ctx, p, x, y, sink) {
    const s = NC.SPR[floatOf(p)];
    if (!s) { // (before the art: a painted one)
      ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = NC.OUTLINE;
      ctx.beginPath(); ctx.arc(x, y - 6 + sink, 7, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y - 6 + sink, 7, Math.PI, TAU); ctx.fillStyle = '#e8403a'; ctx.fill(); ctx.stroke(); ctx.restore();
      return [x, y - 13 + sink];
    }
    const w = s.w * 1.05, h = s.h * 1.05, top = y - h * 0.62 + sink;
    ctx.save();
    ctx.save(); ctx.beginPath(); ctx.rect(x - w, top - 6, w * 2, y - top + 6); ctx.clip(); // above the water
    ctx.drawImage(s.img, x - w / 2, top, w, h); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(x - w, y, w * 2, h); ctx.clip(); // under it: faint and blue
    ctx.globalAlpha *= 0.35; ctx.drawImage(s.img, x - w / 2, top, w, h); ctx.restore();
    ctx.strokeStyle = 'rgba(235,245,255,0.85)'; ctx.lineWidth = 1.6; // the waterline round it
    ctx.beginPath(); ctx.ellipse(x, y + 1, w * 0.62, 2.6, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    return [x, top + 2];
  }
  // the fishing line: a dark edge and a light core, sagging as slack as it is (tight 1: straight)
  function line(ctx, A, B, tight, t) {
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const sag = (1 - tight) * Math.min(90, len * 0.32) + Math.sin(t * 1.9) * 2 * (1 - tight);
    const cx = mx + Math.sin(t * 1.3) * 3 * (1 - tight), cy = my + sag;
    ctx.save(); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(cx, cy, B[0], B[1]);
    ctx.strokeStyle = 'rgba(35,26,51,0.55)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(248,252,255,0.95)'; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.restore();
  }
  function img(ctx, id, x, y, sz, rot, alpha, flip) {
    const s = NC.SPR[id];
    if (!s) return;
    const k = sz / Math.max(s.w, s.h);
    ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha; ctx.translate(x, y); ctx.rotate(rot || 0); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(s.img, -s.w * k / 2, -s.h * k / 2, s.w * k, s.h * k); ctx.restore();
  }
  // the float and the baited hook dangling from the tip on a short line (swing: leaning back while charging)
  function drawHanging(ctx, fid, tip, t, swing) {
    const ang = swing + Math.sin(t * 2.4) * 0.12, fx = tip[0] + Math.sin(ang) * 24, fy = tip[1] + Math.cos(ang) * 24;
    const hx = tip[0] + Math.sin(ang) * 44, hy = tip[1] + Math.cos(ang) * 44;
    line(ctx, tip, [fx, fy - 9], 0.95, t);
    line(ctx, [fx, fy + 8], [hx, hy - 7], 1, t);
    const fs = NC.SPR[fid], ws = NC.SPR.fb_worm;
    if (ws) img(ctx, 'fb_worm', hx, hy + 2, ws.h * 0.95, -ang * 0.6);
    if (fs) img(ctx, fid, fx, fy, fs.h, -ang * 0.6);
  }
  WTR.extra.push((ctx, game, pond, t) => {
    const p = game.player, a = p && p.fishAct;
    if (!a || a.pond !== pond || !a.bob) return;
    if (a.phase !== 'wait' && a.phase !== 'nibble' && a.phase !== 'bite' && a.phase !== 'reel') return;
    const [x, y0] = a.bob, sink = a.phase === 'bite' ? 13 + Math.sin(t * 30) * 2 : a.dip ? 7 * (a.dip / 0.25) : a.phase === 'reel' ? 5 + Math.sin(t * 20) * 2 : 0;
    const y = y0 + Math.sin(t * 2.6) * 1.5;
    ctx.fillStyle = 'rgba(10,20,40,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + 3, 12, 4, 0, 0, TAU); ctx.fill();
    a.floatTop = drawFloat(ctx, p, x, y, sink);
  });

  function bar(ctx, x, y, w, h, frac, col, back) {
    ctx.beginPath(); NC.rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = back || 'rgba(30,24,44,0.85)'; ctx.fill();
    if (frac > 0) { ctx.beginPath(); NC.rrect(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * frac), h - 4, (h - 4) / 2); ctx.fillStyle = col; ctx.fill(); }
  }
  const hueRgb = (h) => { const f = (n) => { const k = (n + h * 6) % 6; return Math.round(255 * (1 - 0.6 * Math.max(0, Math.min(k, 4 - k, 1)))); }; return `${f(5)},${f(3)},${f(1)}`; };
  function rays(ctx, x, y, r, t, a, G) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.rotate(t * 0.6);
    const n = G === 2 ? 16 : 12;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU, w = 0.11, rgb = G === 2 ? hueRgb((i / n + t * 0.1) % 1) : G === 1 ? '255,214,110' : '190,228,255';
      const g = ctx.createLinearGradient(0, 0, Math.cos(ang) * r, Math.sin(ang) * r);
      g.addColorStop(0, `rgba(${rgb},${0.55 * a})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang - w) * r, Math.sin(ang - w) * r); ctx.lineTo(Math.cos(ang + w) * r, Math.sin(ang + w) * r); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // the Pose Studio's preview (studio/studio.js, after saving a fishing pose): the water, the tackle, the line and the
  // catch round a hero drawn at (x, y) at scale k, for one moment of a phase (a: { phase, t, power, T, dip }, as in
  // p.fishAct); water: where the float sits
  L.fishPreview = function (ctx, equip, P, x, y, k, a, t, water) {
    const Ln = NC.weaponLine(equip, P, x, y, k), tip = Ln && Ln.tip, fid = 'fb_float' + ((/t_rod(\d)/.exec(equip.weapon || '') || [0, 1])[1]);
    const J = NC.rigJoints(equip, P, x, y, k), hold = J ? [(J.haN[0] + J.haF[0]) / 2, (J.haN[1] + J.haF[1]) / 2] : [x, y - 120 * k];
    const ph = a.phase, u = a.t || 0, wx = water[0], wy = water[1], fs = NC.SPR[fid];
    ctx.save();
    ctx.fillStyle = 'rgba(70,140,200,0.35)'; ctx.beginPath(); ctx.ellipse(wx, wy, 46 * k, 9 * k, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,232,255,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(wx, wy, 46 * k, 9 * k, 0, 0, TAU); ctx.stroke();
    const float = (fx, fy, rot) => { if (fs) img(ctx, fid, fx, fy, fs.h * k, rot || 0); };
    if (tip && ph !== 'show') {
      if (ph === 'ready' || ph === 'aim' || ph === 'lost') {
        ctx.save(); ctx.translate(tip[0], tip[1]); ctx.scale(k, k);
        drawHanging(ctx, fid, [0, 0], t, ph === 'aim' ? 0.5 + (a.power || 0) * 0.8 : 0);
        ctx.restore();
      } else if (ph === 'fly') {
        const v = NC.clamp(u / 0.45, 0, 1), end = [NC.lerp(tip[0], wx, v), NC.lerp(tip[1], wy - 8 * k, v) - Math.sin(v * Math.PI) * 60 * k];
        line(ctx, tip, end, 0.85, t);
        float(end[0], end[1], v * 1.4);
      } else if (ph === 'lift') {
        const v = NC.clamp(u / 0.5, 0, 1), pos = (q) => [NC.lerp(wx, hold[0], ease(q)), NC.lerp(wy, hold[1], q) - Math.sin(q * Math.PI) * 70 * k];
        const [fx, fy] = pos(v);
        line(ctx, tip, [fx, fy - 10 * k], 0.9, t);
        img(ctx, 'fs_carp', fx, fy, 62 * k, Math.sin(v * 18) * 0.5);
      } else {
        const sink = (ph === 'bite' ? 9 + Math.sin(t * 30) * 2 : a.dip ? 6 * (a.dip / 0.25) : ph === 'reel' ? 4 + Math.sin(t * 20) * 1.5 : 0) * k;
        float(wx, wy - 8 * k + sink);
        line(ctx, tip, [wx, wy - 16 * k + sink], ph === 'reel' ? 0.35 + (a.T || 0.5) * 0.65 : ph === 'bite' ? 0.6 : 0.12, t);
        if (ph === 'bite') {
          ctx.font = `900 ${Math.round(34 * k)}px 'Mitr', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 5; ctx.strokeStyle = NC.OUTLINE; ctx.strokeText('!', wx, wy - 50 * k); ctx.fillStyle = '#ffe14d'; ctx.fillText('!', wx, wy - 50 * k);
        }
      }
    }
    if (ph === 'show') { // the catch held out, as the game draws it (grade 1: gold rays)
      const pop = u < 0.12 ? NC.lerp(0.6, 1.15, u / 0.12) : u < 0.28 ? NC.lerp(1.15, 1, (u - 0.12) / 0.16) : 1, sz = 68 * k * pop;
      const fx = hold[0] + sz * 0.34, fy = hold[1] - sz * 0.12;
      rays(ctx, fx, fy, 110 * k * Math.min(1, u / 0.25 + 0.3), t, 0.7, 1);
      img(ctx, 'fs_carp', fx, fy, sz, Math.sin(u * 13) * 0.18 * Math.max(0, 1 - u / 1.2));
    }
    ctx.restore();
  };
  L.overlays.push((ctx, game, p) => {
    const a = p.fishAct;
    if (!a) return;
    const tip = rodTip(p), t = game.time;
    // the line and the tackle
    if (tip && a.phase !== 'show') {
      if (a.phase === 'ready' || a.phase === 'aim' || a.phase === 'lost') drawHanging(ctx, floatOf(p), tip, t, a.phase === 'aim' ? 0.5 + a.power * 0.8 : 0);
      else if (a.phase === 'fly') {
        const u = NC.clamp(a.t / a.fly, 0, 1), end = [NC.lerp(a.from[0], a.to[0], u), NC.lerp(a.from[1], a.to[1], u) - Math.sin(u * Math.PI) * 130];
        line(ctx, tip, end, 0.85, t);
        const fs = NC.SPR[floatOf(p)], ws = NC.SPR.fb_worm;
        if (ws) img(ctx, 'fb_worm', end[0] - 4, end[1] + 18, ws.h * 0.95, u * 2);
        if (fs) img(ctx, floatOf(p), end[0], end[1], fs.h, u * 1.4);
      } else if (a.phase === 'wait' || a.phase === 'nibble' || a.phase === 'bite' || a.phase === 'reel') {
        const end = a.floatTop || [a.bob[0], a.bob[1] - 12];
        line(ctx, tip, end, a.phase === 'reel' ? 0.35 + a.T * 0.65 : a.phase === 'bite' ? 0.6 : 0.12, t);
      } else if (a.phase === 'lift') {
        // the catch flying out of the water on the line, turning, shedding drops
        const u = NC.clamp(a.t / 0.5, 0, 1), hold = heldAt(p) || [p.x, p.y - 200], f = a.liftFrom;
        const pos = (v) => [NC.lerp(f[0], hold[0], ease(v)), NC.lerp(f[1], hold[1], v) - Math.sin(v * Math.PI) * 150];
        const [x, y] = pos(u);
        line(ctx, tip, [x, y - 12], 0.9, t);
        img(ctx, a.catch, x, y, JUNK[a.catch] ? 50 : legendOf(a.catch) ? 96 : 62, Math.sin(u * 18) * 0.5);
        for (let k = 1; k <= 7; k++) { // drops trailing behind it
          const [dx, dy] = pos(Math.max(0, u - k * 0.045));
          ctx.fillStyle = `rgba(200,232,255,${0.85 - k * 0.1})`;
          ctx.beginPath(); ctx.ellipse(dx + Math.sin(k * 7.3) * 10, dy + k * 5, 2.6, 3.6, 0, 0, TAU); ctx.fill();
        }
      }
    }
    const bx = p.x - 70, by = p.y - 230;
    ctx.save();
    if (a.phase === 'ready') {
      NC.drawTag(ctx, 'กดค้าง B / Space / คลิก เพื่อเหวี่ยง · เดินเพื่อเลิก', p.x, by + 20 + Math.sin(t * 4) * 2, 18, '#fff3cf');
    } else if (a.phase === 'aim') {
      bar(ctx, bx, by, 140, 16, a.power, a.power > 0.8 ? '#ffd35c' : '#8fd0ff');
      NC.drawTag(ctx, 'ปล่อยเพื่อเหวี่ยง', p.x, by - 14, 18, '#fff3cf');
    } else if (a.phase === 'bite') {
      const s = 1 + 0.15 * Math.sin(t * 24), x = a.bob[0], y = a.bob[1] - 70;
      V.glow(ctx, x, y, 44, '255,90,70', 0.6, true);
      ctx.font = `900 ${Math.round(56 * s)}px 'Mitr', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.strokeStyle = NC.OUTLINE; ctx.strokeText('!', x, y); ctx.fillStyle = '#ffe14d'; ctx.fillText('!', x, y);
      NC.drawTag(ctx, 'กดเลย!', x, y + 44, 20, '#ffe14d');
    } else if (a.phase === 'reel') {
      // the line's tension: slack | the green | too tight, and the needle
      const w = 190, x0 = p.x - w / 2, y0 = by - 16;
      ctx.beginPath(); NC.rrect(ctx, x0, y0, w, 20, 10); ctx.fillStyle = 'rgba(30,24,44,0.88)'; ctx.fill();
      ctx.fillStyle = 'rgba(140,150,170,0.55)'; ctx.fillRect(x0 + 3, y0 + 3, (w - 6) * a.gLo, 14);
      ctx.fillStyle = '#5fd07a'; ctx.fillRect(x0 + 3 + (w - 6) * a.gLo, y0 + 3, (w - 6) * (a.gHi - a.gLo), 14);
      ctx.fillStyle = '#e8584a'; ctx.fillRect(x0 + 3 + (w - 6) * 0.94, y0 + 3, (w - 6) * 0.06, 14);
      ctx.fillStyle = 'rgba(232,88,74,0.45)'; ctx.fillRect(x0 + 3 + (w - 6) * a.gHi, y0 + 3, (w - 6) * (0.94 - a.gHi), 14);
      const nx = x0 + 3 + (w - 6) * a.T;
      ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = NC.OUTLINE; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(nx, y0 - 2); ctx.lineTo(nx - 7, y0 - 12); ctx.lineTo(nx + 7, y0 - 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(nx - 2, y0 - 2, 4, 24); ctx.strokeRect(nx - 2, y0 - 2, 4, 24);
      bar(ctx, x0 + 20, y0 + 28, w - 40, 12, a.C, '#8fd0ff');
      const warn = a.snap > 0.2 ? 'ตึงเกินไป! ปล่อยสายหน่อย' : a.slack > 1 ? 'สายหย่อน! กดค้างดึง' : 'กดค้างดึง · ปล่อยผ่อนสาย';
      NC.drawTag(ctx, warn, p.x, y0 - 30, 18, a.snap > 0.2 || a.slack > 1 ? '#ffb0a0' : '#e8e0d2');
    } else if (a.phase === 'show' && a.show) {
      // the catch held up between the hands: light rays turning behind it, a pulse, sparkles winking round it, drips
      const S = a.show, F = FISH[S.id], G = S.grade, u = a.t, hold = heldAt(p) || [p.x, p.y - 200];
      const pop = u < 0.12 ? NC.lerp(0.6, 1.15, u / 0.12) : u < 0.28 ? NC.lerp(1.15, 1, (u - 0.12) / 0.16) : 1;
      const fade = NC.clamp((2.4 - u) / 0.35, 0, 1), sz = (JUNK[S.id] ? 54 : G === 2 ? 108 : G === 1 ? 80 : 68) * pop;
      const x = hold[0] + (p.face || 1) * sz * 0.34, y = hold[1] - sz * 0.12;
      rays(ctx, x, y, (G === 2 ? 190 : G === 1 ? 140 : 110) * Math.min(1, u / 0.25 + 0.3), t, fade * (G === 2 ? 1 : 0.75), G);
      V.glow(ctx, x, y, sz * 0.95, G === 2 ? '255,220,120' : G === 1 ? '255,214,110' : '190,228,255', 0.5 * fade, true);
      if (u < 0.5) { ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - u / 0.5)})`; ctx.lineWidth = 4 * (1 - u / 0.5) + 1; ctx.beginPath(); ctx.arc(x, y, 30 + u * 260, 0, TAU); ctx.stroke(); }
      img(ctx, S.id, x, y, sz, Math.sin(u * 13) * 0.18 * Math.max(0, 1 - u / 1.2), fade, (p.face || 1) < 0);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < (G === 2 ? 9 : 6); k++) { // sparkles winking round it
        const q = u * 2.2 + k * 0.37, ph = q % 1, ang = k * 2.39 + Math.floor(q) * 1.3, rr = sz * (0.55 + (k % 3) * 0.18);
        const s = Math.sin(ph * Math.PI) * (5 + (k % 3) * 2) * fade;
        if (s < 0.5) continue;
        const sx = x + Math.cos(ang) * rr, sy = y + Math.sin(ang) * rr * 0.8;
        V.glow(ctx, sx, sy, s * 2.2, G ? '255,226,140' : '210,236,255', 0.6, true);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, s / 5)})`; V.flarePath(ctx, sx, sy, s, s * 0.22, 0); ctx.fill();
      }
      ctx.restore();
      if (u < 1.6) for (let k = 0; k < 5; k++) { // drips falling off it
        const q = (u * 1.4 + k * 0.23) % 1, dx = x + (k - 2) * sz * 0.16, dy = y + sz * 0.25 + q * 60;
        ctx.fillStyle = `rgba(200,232,255,${0.85 * (1 - q) * fade})`; ctx.beginPath(); ctx.ellipse(dx, dy, 2.4, 3.4, 0, 0, TAU); ctx.fill();
      }
      const ty = y - sz * 0.62 - 38;
      ctx.globalAlpha *= fade;
      if (G) NC.drawTag(ctx, G === 2 ? '★ ปลาเจ้าถิ่น! ★' : 'หายาก!', x, ty - 26, G === 2 ? 22 : 18, '#ffd35c');
      NC.drawTag(ctx, JUNK[S.id] ? F[0] : `${F[0]} ${S.size} ซม.`, x, ty, 22, G ? '#ffd35c' : '#fff3cf');
      const note = [S.first && !JUNK[S.id] ? 'ใหม่! ลงสมุดปลาแล้ว' : S.record ? 'สถิติใหม่!' : '', a.extra].filter(Boolean).join(' · ');
      if (note) NC.drawTag(ctx, note, x, ty + 24, 17, '#9be89b');
    }
    ctx.restore();
  });

  // ---------------- the fish book in the H window ----------------
  L.fishPanel = function (game, p) {
    const book = L.rec(p).fishbook || {}, ids = Object.keys(FISH).filter((id) => !JUNK[id]);
    const got = ids.filter((id) => book[id] && book[id].n > 0).length;
    return `<div class="lf-box"><div class="lf-h">สมุดปลา ${got}/${ids.length}</div><div class="lf-fishbook">` +
      ids.map((id) => {
        const r = book[id], F = FISH[id];
        return `<div class="lf-fish ${r ? '' : 'unseen'} ${legendOf(id) ? 'legend' : ''}" title="${r ? F[0] : '???'}"><img src="${NC.matIcon(id)}" alt="">` +
          `<span>${r ? `${r.best} ซม.` : '???'}</span></div>`;
      }).join('') + '</div></div>';
  };
  const css = document.createElement('style');
  css.textContent = `.lf-fishbook{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px}
    .lf-fish{display:grid;justify-items:center;gap:2px;background:rgba(255,255,255,.05);border-radius:10px;padding:4px}
    .lf-fish img{width:44px;height:44px;object-fit:contain}.lf-fish span{font-size:12px;color:#cfd6ea}
    .lf-fish.unseen img{filter:brightness(0) opacity(.45)}.lf-fish.legend{box-shadow:inset 0 0 0 2px #ffd35c}`;
  document.head.appendChild(css);

  // ---------------- the teacher: ตานาก by the farm's lily pond ----------------
  const FARM = 'homefarm', OTTER = { x: 905, y: 1965 };
  const def = NC.MAPS[FARM];
  if (def && def.clear) def.clear.push({ x: OTTER.x, y: OTTER.y, r: 110 });
  const fishWorth = (p) => { let s = 0; for (const id in FISH) if (!JUNK[id] && MAT[id]) s += NC.Econ && NC.Econ.quote ? NC.Econ.quote(id, NC.matCount(p, id), p) : NC.matCount(p, id) * MAT[id].price; return s; }; // (piece by piece: economy.js)
  L.addMentor({
    id: 'otter', name: 'ตานาก', title: 'ครูตกปลา · คันเบ็ด รับซื้อปลา', sprite: 'npc_otter', spriteB: 'npc_otter_b', h: 132,
    x: OTTER.x, y: OTTER.y, here: (game) => !!(game && game.mapId === FARM),
    greet: ['อ้าว หลาน มาตกปลากันไหม', 'บ่อนี้ปลาเยอะนะ ลองดูสิ', 'ใจเย็น ๆ ปลาใหญ่ชอบคนใจเย็น'],
    chat: ['กลางคืนปลาคาร์ปแสงจันทร์ออกมาว่ายนะ', 'สายตึงไปมันขาด หย่อนไปปลาก็หลุด', 'เหวี่ยงไกล ๆ ได้ปลาตัวโต', 'ได้ยินว่าบึงนี้มีราชาปลาอยู่ด้วยนะ'],
    talk: () => 'เดินไปริมน้ำแล้วกด B กดค้างเหวี่ยง ปลากินเบ็ดมี ! ขึ้นก็กดทันที แล้วกดค้างดึง ปล่อยผ่อน ให้เข็มอยู่ช่องเขียวนะหลาน',
    render(game, p) {
      const book = L.rec(p).fishbook || {}, ids = Object.keys(FISH).filter((id) => !JUNK[id]), got = ids.filter((id) => book[id]).length;
      let h = '<div class="mt-sec">' + L.upgradeRow(p, 'rod');
      const worth = fishWorth(p);
      h += `<div class="mt-item"><img src="${NC.matIcon('fs_carp')}" alt=""><div><div class="n">ขายปลาทั้งหมดให้ตานาก</div>` +
        `<div class="w">ได้ ${NC.fmtCoins(worth)} เหรียญ (ราคาเดียวกับลุงโกโก้ · รองเท้ากับสาหร่ายไม่รับนะ)</div></div><button data-act="sellfish" ${worth ? '' : 'disabled'}>ขาย</button></div>`;
      h += `<div class="mt-item"><img src="${NC.matIcon('fs_lilyking')}" alt=""><div><div class="n">สมุดปลา ${got}/${ids.length}</div>` +
        `<div class="w">ดูได้ที่หน้าต่าง H แท็บตกปลา · ปลาเจ้าถิ่นมี 3 ตัว: ราชาปลาบึงบัว เงาใต้ทะเลสาบหมอก ปลามังกรลาวา</div></div><span></span></div>`;
      return h + '</div>';
    },
    act(game, p, what) {
      if (what !== 'sellfish') return;
      if (!fishWorth(p)) return;
      let worth = 0;
      for (const id in FISH) if (!JUNK[id] && p.mats[id]) { const k = NC.matCount(p, id); worth += NC.Econ && NC.Econ.sell ? NC.Econ.sell(game, id, k) : k * MAT[id].price; delete p.mats[id]; }
      p.coins += worth;
      game.toast(`ขายปลาได้ ${NC.fmtCoins(worth)} เหรียญ`);
      NC.saveGame(game);
    },
  });
})();
