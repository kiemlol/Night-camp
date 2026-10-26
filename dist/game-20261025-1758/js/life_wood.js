/* life_wood.js — ตัดไม้ (woodcutting), a life skill of js/life.js. Every tree of the field maps (not the camp's) can be
   chopped: B next to it (or a click on its trunk), then strike when the marker running round the trunk is on the
   glowing axe mark. A felled tree tips over, leaves its stump and grows back after a few minutes; its logs and extras
   pop out and fly to the hero. Each map's trees give their own wood (WOOD / TREES below): the better woods need a
   higher level and a better axe. At night some trees show their moon form (ต้นไม้แสงจันทร์): moonwood. Now and then a
   tree is a sleeping monster (ต้นไม้ปลอม) that wakes up when it falls. Teacher: ลุงบีเวอร์ฟันเก on the farm map
   (js/life_farm.js), who upgrades the axe. Art: assets/life/ (stump_*, moon_tree, lf_* icons, npc_beaver*). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, L = NC.Life;
  const MAT = NC.MATERIALS;

  // the woods: level and axe tier to chop, strikes (hp), life XP, the stump left behind
  const WOOD = {
    birch: { mat: 'lf_birch', name: 'ต้นเบิร์ช', lv: 1, tier: 1, hp: 6, xp: 12, stump: 'stump_birch' },
    oak: { mat: 'lf_oak', name: 'ต้นโอ๊ก', lv: 1, tier: 1, hp: 7, xp: 14, stump: 'stump_oak' },
    pine: { mat: 'lf_pine', name: 'ต้นสน', lv: 5, tier: 1, hp: 9, xp: 22, stump: 'stump_pine' },
    willow: { mat: 'lf_willow', name: 'ต้นหลิว', lv: 9, tier: 2, hp: 11, xp: 32, stump: 'stump_oak' },
    charcoal: { mat: 'lf_charcoal', name: 'ต้นไม้ไหม้', lv: 13, tier: 2, hp: 11, xp: 40, stump: 'b_stump' },
    acacia: { mat: 'lf_acacia', name: 'ต้นอะคาเซีย', lv: 17, tier: 3, hp: 13, xp: 55, stump: 'stump_oak' },
    silverwood: { mat: 'lf_silverwood', name: 'ต้นไม้เงิน', lv: 21, tier: 3, hp: 15, xp: 70, stump: 'stump_birch' },
    ancient: { mat: 'lf_ancient', name: 'ต้นไม้โบราณ', lv: 25, tier: 4, hp: 18, xp: 95, stump: 'stump_ancient' },
    moon: { mat: 'lf_moonwood', name: 'ต้นไม้แสงจันทร์', lv: 12, tier: 2, hp: 12, xp: 80, stump: 'stump_moon' },
  };
  // which tree prop gives which wood
  const TREES = {
    m_birch: 'birch', m_apple: 'oak', f_oak: 'oak', f_pear: 'oak', w_oldtree: 'oak', g_deadoak: 'oak', k_windtree: 'oak',
    hf_cherry: 'oak', hf_maple: 'oak',
    w_fir: 'pine', k_pine: 'pine', l_cypress: 'pine', g_yew: 'pine',
    s_willow: 'willow', s_mangrove: 'willow', p_mangrove: 'willow', p_deadtree: 'willow',
    b_burnttree: 'charcoal', b_scorchpine: 'charcoal', v_deadtree: 'charcoal',
    c_acacia: 'acacia', c_deadtree: 'acacia',
    l_silvertree: 'silverwood', j_bigtree: 'ancient',
  };
  // extras that fall with a tree: [material, chance, min, max]
  const EXTRA = {
    m_apple: [['lf_apple', 0.7, 1, 2]], f_pear: [['lf_pear', 0.7, 1, 2]], hf_cherry: [['lf_nest', 0.08]],
    w_fir: [['lf_sap', 0.12]], k_pine: [['lf_sap', 0.12]], l_cypress: [['lf_sap', 0.1]], j_bigtree: [['lf_amber', 0.18], ['lf_sap', 0.1]],
    s_willow: [['lf_sap', 0.06]], hf_maple: [['lf_sap', 0.15]],
  };
  // a fake tree wakes up (not on the farm): the monster by map
  const FAKE = { burnt: 'char_stump', volcano: 'char_stump', prime: 'elder_treant' };
  const WHERE = {
    birch: 'ทุ่งหญ้าแสงจันทร์', oak: 'ฟาร์มหิ่งห้อย · ไร่ฟักทอง · ป่าเห็ดเรืองแสง · สุสาน', pine: 'ป่าเห็ดเรืองแสง · ทุ่งลมหวีด · ทะเลสาบหมอกเงา',
    willow: 'บึงกบลำธารใส · หนองพิษ', charcoal: 'ป่าไหม้ถ่านคุ · ภูเขาไฟหลับ', acacia: 'ผาหินแดง', silverwood: 'ทะเลสาบหมอกเงา',
    ancient: 'ป่าดึกดำบรรพ์', moon: 'บางต้นในทุกทุ่ง เฉพาะกลางคืน (เรืองแสงสีฟ้า)',
  };
  for (const k of ['birch', 'oak', 'pine', 'moon', 'willow', 'charcoal', 'acacia', 'silverwood', 'ancient']) {
    const W = WOOD[k];
    L.GUIDE.wood.push({ mat: W.mat, name: MAT[W.mat].name, lv: W.lv, tier: W.tier, where: WHERE[k], night: k === 'moon' });
    L.SOURCE[W.mat] = 'ตัดไม้: ' + WHERE[k];
  }
  L.SOURCE.lf_apple = 'ตัดต้นแอปเปิลในทุ่งหญ้าแสงจันทร์'; L.SOURCE.lf_pear = 'ตัดต้นสาลี่ในไร่ฟักทอง';
  L.SOURCE.lf_nest = 'ตัดไม้ (บางที)'; L.SOURCE.lf_sap = 'ตัดต้นสน ต้นเมเปิล (บางที)'; L.SOURCE.lf_amber = 'ตัดต้นไม้โบราณ · ขุดแร่ในเหมืองมด';

  // ---------------- the trees of a map: their state lives on the prop itself (tree / moon / stump) ----------------
  const felled = {}; // 'map:x,y' -> game.time it grows back (kept across map changes and rebuilds)
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const keyOf = (w, t) => `${w.mapId || w.field}:${t.x},${t.y}`;
  const isMoonTree = (key) => hash(key) % 29 === 0;
  const woodOf = (t) => (t._lf === 'moon' ? WOOD.moon : WOOD[TREES[t._base]]);
  function remember(t) {
    if (t._base) return;
    t._base = t.name; t._canopy = t.canopy; t._shadow = t.shadow; t._sway = t.sway; t._lf = 'tree';
  }
  function setTree(w, t) {
    t.name = t._base; t.canopy = t._canopy; t.shadow = t._shadow; t._lf = 'tree';
    if (t._sway === undefined) delete t.sway; else t.sway = t._sway;
    lightOff(w, t);
  }
  function setMoon(w, t) {
    if (!NC.SPR.moon_tree) return;
    t.name = 'moon_tree'; t._lf = 'moon';
    if (!w.lights.some((l) => l.owner === t)) w.lights.push({ x: t.x, y: t.y - 230 * (t.scale || 1), r: 340, rgb: '150,190,255', flick: 1.2, owner: t, lf: true });
  }
  function setStump(w, t) {
    const W = woodOf(t);
    lightOff(w, t);
    t.name = NC.SPR[W.stump] ? W.stump : 'stump_oak'; t._lf = 'stump';
    delete t.canopy; delete t.sway; t.fade = 0;
    const s = NC.SPR[t.name];
    t.shadow = s ? [s.w * 0.36 * (t.scale || 1), s.w * 0.09 * (t.scale || 1)] : t._shadow;
  }
  function lightOff(w, t) { if (w.lights) w.lights = w.lights.filter((l) => l.owner !== t); }
  function treesOf(w) {
    if (!w || w.camp || w.dungeon || !w.props) return [];
    if (w.lfTrees) return w.lfTrees;
    const out = [];
    for (const t of w.props) {
      if (t.kind !== 'prop' || !TREES[t._base || t.name] || t.shadow === null) continue;
      remember(t);
      out.push(makeNode(w, t));
    }
    w.lfTrees = out;
    return out;
  }

  // ---------------- a tree as a node of js/life.js ----------------
  function makeNode(w, t) {
    const s = NC.SPR[t._base], tw = (s ? s.w : 420) * (t.scale || 1), key = keyOf(w, t);
    const n = {
      skill: 'wood', prop: t, key, x: t.x, y: t.y, hx: t.x, hy: t.y - 58, reach: 92 + tw * 0.085, game: 'ring', verb: 'ตัดไม้',
      box: [t.x - Math.max(40, tw * 0.12), t.y - 175, t.x + Math.max(40, tw * 0.12), t.y + 14], tagY: t.y - 200,
      ok: () => t._lf !== 'stump',
      // where the axe bites: the trunk's edge on the hero's side, at his hands' height (kept on the trunk)
      bite: (p) => { const half = NC.clamp(tw * 0.05, 16, 44), side = p.x < t.x ? -1 : 1; return [t.x + side * half, NC.clamp(p.y - 52, t.y - 150, t.y - 30)]; },
      ringK: NC.clamp(0.7 + tw * 0.0006, 0.75, 1.1),
      hit, done, start,
    };
    Object.defineProperty(n, 'lv', { get: () => woodOf(t).lv });
    Object.defineProperty(n, 'tier', { get: () => woodOf(t).tier });
    Object.defineProperty(n, 'label', { get: () => `${woodOf(t).name} · ${MAT[woodOf(t).mat].name}` });
    n.hp = n.left = woodOf(t).hp;
    return n;
  }
  function start(game, p, n) {
    const W = woodOf(n.prop);
    if (n.left <= 0 || n.left > W.hp) n.left = W.hp;
    n.hp = W.hp;
  }
  function hit(game, p, n, perfect) {
    const t = n.prop, side = p.x < t.x ? -1 : 1, [bx, by] = n.bite ? n.bite(p) : [t.x + side * 24, t.y - 58];
    V.debris(bx, by, perfect ? 9 : 5, V.PAL.rock, { size: 0.55, min: 160, max: 380, tilt: side > 0 ? 0.6 : -0.6 });
    if (perfect) V.shake(game, 2);
    // the tree shivers
    const x0 = t.x;
    t.x = x0 + side * -3;
    V.at(0.06, () => { t.x = x0 + side * 2; });
    V.at(0.12, () => { t.x = x0; });
    if (Math.random() < 0.5) V.motes(t.x, t.y - 260 * (t.scale || 1), 3, t._lf === 'moon' ? '160,200,255' : '140,200,110', { rise: -60, spread: 120, size: 0.9 });
  }
  function done(game, p, n) {
    const w = game.world, t = n.prop, W = woodOf(t), lv = L.lvOf(p, 'wood');
    const dir = p.x < t.x ? 1 : -1;
    FX.add({ type: 'lftreefall', layer: 'sorted', x: t.x, y: t.y, sort: t.y + 2, life: 1.15, name: t.name, scale: t.scale || 1, flip: t.flip, dir,
      update(q, dt, g) { if (!q.thud && q.t > 0.72) { q.thud = true; V.shake(g, 7); V.smoke(t.x + dir * 190 * (t.scale || 1), t.y - 10, 10, '#d8cbb4', '#f4ecdc', { size: 1.4, max: 320, lifeK: 0.9, a: 0.7 }); } } });
    const moon = t._lf === 'moon';
    setStump(w, t);
    felled[n.key] = game.time + 150 + Math.random() * 90;
    if (!w.camp) delete w.mapArt; // (the minimap draws the stump's clearing next time)
    // what falls out: logs, extras
    const tier = L.toolTier(p, 'axe');
    let logs = 2 + (L.roll(0.2 + lv * 0.012 + (lv >= 10 ? 0.15 : 0)) ? 1 : 0) + (tier >= 3 ? 1 : 0);
    if (lv >= 30) logs += 1;
    // (they land on the hero's side of the trunk: materials.js pulls them in from 150 away)
    const dx = t.x - dir * 30, o = { spread: 36 };
    L.drop(game, W.mat, logs, dx, t.y + 6, o);
    for (const [id, ch, lo, hi] of EXTRA[t._base] || []) if (L.roll(ch * (lv >= 20 ? 1.5 : 1))) L.drop(game, id, lo ? Math.round(NC.rand(lo, hi)) : 1, dx, t.y + 6, o);
    if (L.roll(0.04)) L.drop(game, 'lf_nest', 1, dx, t.y + 6, o);
    if (moon && L.roll(lv >= 25 ? 0.5 : 0.25)) L.drop(game, 'lf_moonwood', 1, dx, t.y + 6, o);
    L.addXp(game, 'wood', W.xp);
    NC.HUD.log(`ตัด${W.name}ล้มแล้ว!`, 'item');
    // a sleeping monster?
    const def = NC.MAPS[game.mapId] || {};
    if (!def.lifeSafe && L.roll(0.03)) {
      const type = FAKE[game.mapId] || 'stump', lvl = NC.spawnLevel ? NC.spawnLevel(w, 'hollow', t.x, t.y) : 10;
      if (NC.MONSTERS[type]) {
        const m = NC.makeEnemy(type, t.x + dir * 60, t.y + 10, lvl);
        m.owner = { life: true }; m.state = 'chase'; m.t = 0; m.angry = true; m.show = 3;
        game.enemies.push(m);
        FX.text(t.x, t.y - 220, 'ต้นไม้ปลอม!', '#ff9a8a', 34);
        V.shake(game, 6);
      }
    }
  }
  // the old sprite tipping over from its foot, away from the hero, fading at the end
  FX.def('lftreefall', (ctx, q, u) => {
    const k = Math.min(1, u / 0.72), ang = q.dir * (k * k) * 1.5;
    const alpha = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25;
    NC.drawSpr(ctx, q.name, q.x, q.y, { flip: q.flip, scale: q.scale, rot: ang, alpha });
  }, 'sorted');

  // ---------------- every frame: regrowth, the moon form at night ----------------
  let lastWorld = null, lastNight = null;
  L.ticks.push((game) => {
    const w = game.world;
    if (!w || w.camp || w.dungeon) { lastWorld = w; return; }
    const trees = treesOf(w), night = L.isNight(game);
    const changed = w !== lastWorld || night !== lastNight;
    lastWorld = w; lastNight = night;
    for (const n of trees) {
      const t = n.prop, until = felled[n.key];
      if (t._lf === 'stump') {
        if (until !== undefined && game.time < until) continue;
        delete felled[n.key];
        if (night && isMoonTree(n.key)) setMoon(w, t); else setTree(w, t);
        n.left = n.hp = woodOf(t).hp;
        if (NC.dist(game.player.x, game.player.y, t.x, t.y) < 1400) { V.motes(t.x, t.y - 60, 10, '160,230,140', { rise: 90, spread: 60, size: 1 }); FX.stars(t.x, t.y - 80, 6, '190,240,160', { speed: 120, size: 0.6 }); }
        delete w.mapArt;
        continue;
      }
      if (felled[n.key] !== undefined && game.time < felled[n.key]) { setStump(w, t); continue; } // (a rebuilt map: the stump again)
      if (!changed) continue;
      if (night && isMoonTree(n.key)) { if (t._lf !== 'moon') { setMoon(w, t); n.left = n.hp = WOOD.moon.hp; } }
      else if (t._lf === 'moon') { setTree(w, t); n.left = n.hp = woodOf(t).hp; }
    }
  });
  L.finders.push((game) => treesOf(game.world));
  L.felled = felled; // (js/online/life.js: the server's felled trees, 'map:x,y' -> game.time they grow back)

  // ---------------- the teacher: ลุงบีเวอร์ฟันเก (the farm map, js/life_farm.js places him) ----------------
  L.woodMentor = {
    id: 'beaver', name: 'ลุงบีเวอร์ฟันเก', title: 'ครูตัดไม้ · อัปเกรดขวาน', sprite: 'npc_beaver', spriteB: 'npc_beaver_b', h: 150,
    greet: ['ไม้ดีต้องตัดให้ตรงรอยนะหลานเอ๊ย!', 'มาหัดตัดไม้กับลุงไหม?', 'ต้นไม้ล้มแล้วเดี๋ยวก็งอกใหม่ ไม่ต้องห่วง~'],
    chat: ['ต้นสนหอมยางดีนะ อยู่ในป่าเห็ด', 'กลางคืนมีต้นไม้เรืองแสงสีฟ้า ไม้ของมันหายากมาก!', 'บางต้นมันแกล้งหลับอยู่... ระวังด้วย!', 'ลุงใช้ฟันก็ได้ แต่หลานใช้ขวานเถอะ'],
    talk: (game, p) => (L.lvOf(p, 'wood') < 5 ? 'เดินไปใกล้ต้นไม้แล้วกด B นะ มีวงรอบลำต้น กดตอนจุดขาววิ่งทับรอยขวานสีทอง ได้ฟันเข้าเนื้อ!' :
      'ไม้ดี ๆ ต้องใช้ขวานดี ๆ เอาไม้กับแร่มาให้ลุง เดี๋ยวลุงตีขวานให้ใหม่!'),
    render: (game, p) => '<div class="mt-sec">' + L.upgradeRow(p, 'axe') + '</div>',
  };
})();
