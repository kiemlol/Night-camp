/* cooking.js — ทำอาหาร, the fifth life skill (the user, 2026-10-04: "ระบบทำอาหารก็สำคัญมากๆ ใส่ไปเลย", then
   "ระบบอาหารเลือกแบบ B": the cookbook of assets/gen/nightcamp_ec_cook_b_raw.png). The plan's numbers are in the Claude Docs
   "Night Camp ระบบเศรษฐกิจที่เสนอ": a meal is a 30-minute buff, one at a time, never EXP, about 5% of what a hero earns.
     where     ป้าหมีหม้อดำ and her cooking station north-east of the campfire (COOK, no light of its own): B or a click opens the cookbook
     recipes   8 dishes (DISHES) from farm crops, fish, monster junk and coins; each asks a cooking level and a pot tier.
               Dishes are materials (fd_*) in the pouch, never bought by the merchant (noNpc: players' shops only)
     eating    a double-click on a dish in the bag (or its กิน button), the cookbook's กิน, or the auto farm (the switch
               "ออโต้ฟาร์มกินจานนี้ให้เอง", one dish) when no meal is on. One meal at a time: a new one replaces it. The
               buff counts down while playing and is saved with the seconds left
     skill     NC.Life skill 'cook' (Lv 1–30, perks every 5) and tool 'pot' in 4 tiers, upgraded in the life window (H)
               next to ป้าหมี (TOOLS.pot.teacher / map: the two hooks in js/lifebook.js)
     buff      NC.skillModSources: atk / matk (%), taken (% less damage taken), hpReg / spReg (%), spd (% move speed)
   Saved: nightcamp.cook.v1 (the meal, the auto dish); the level and the pot with the life record (life.js).
   Art: assets/life/ npc_bear, npc_bear_b, cook_station, fd_*, t_pot1..4 (assets/gen/make_life_prompts.py sheets cook and
   cookicons -> Codex -> python tools/life_art.py --only cook,cookicons). Test: ?cook stands you by the station with the
   cookbook open; ?life = every life skill Lv 30 with the best tools. */
(function () {
  'use strict';
  const NC = window.NC, L = NC.Life, MAT = NC.MATERIALS, P = NC.Party, FX = NC.FX;
  if (!L || !MAT || !P) return;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => NC.fmtCoins(n);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const icon = (id) => (L.lifeIcon(id) || NC.matIcon(id) || '');
  const KEY = 'nightcamp.cook.v1';
  const BASE_DUR = 1800; // (seconds of play)

  // ---------------- the dishes ----------------
  // kind: the buff's colour on the cards (red attack, blue guard, green HP, purple SP, yellow speed, orange both)
  const DISHES = [
    { id: 'fd_carrot_stew', name: 'สตูว์แครอท', lv: 1, pot: 1, kind: 'red', buff: { atk: 5, matk: 5 }, tag: 'ATK & MATK +5%',
      mats: { lf_carrot: 3, lf_potato: 2, mat_boar_tusk: 10 }, coins: 200, xp: 12, desc: 'สตูว์ข้นสีส้ม ต้มกระดูกหมูป่าจนหอม กินแล้วแขนมีแรง' },
    { id: 'fd_fish_skewer', name: 'ปลาเสียบไม้ย่าง', lv: 1, pot: 1, kind: 'blue', buff: { taken: 6 }, tag: 'ดาเมจที่รับ −6%',
      mats: { fs_minnow: 2, fs_perch: 1, lf_herb: 1 }, coins: 200, xp: 12, desc: 'ปลาย่างไฟอ่อนโรยสมุนไพร กินแล้วตัวแน่นทนมือ' },
    { id: 'fd_herb_soup', name: 'ซุปสมุนไพร', lv: 3, pot: 1, kind: 'green', buff: { hpReg: 30 }, tag: 'ฟื้น HP +30%',
      mats: { lf_herb: 3, mat_leaf_jelly: 10 }, coins: 300, xp: 18, desc: 'ซุปเขียวใสกลิ่นสมุนไพรฮีล อุ่นท้องจนแผลหายไว' },
    { id: 'fd_moon_tea', name: 'ชาดอกจันทร์', lv: 5, pot: 1, kind: 'purple', buff: { spReg: 30 }, tag: 'ฟื้น SP +30%',
      mats: { lf_moonflower: 1, lf_herb: 1, mat_water_jelly: 8 }, coins: 400, xp: 25, desc: 'ชาสีฟ้าเรืองแสงจาง ๆ จิบแล้วหัวโล่ง ร่ายเวทได้นาน' },
    { id: 'fd_pumpkin_pie', name: 'พายฟักทอง', lv: 8, pot: 1, kind: 'yellow', buff: { spd: 5 }, tag: 'เดินเร็ว +5%',
      mats: { lf_pumpkin: 2, lf_wheat: 2, lf_nest: 1 }, coins: 600, xp: 35, desc: 'พายฟักทองแป้งกรอบ ไข่จากรังนกทำให้เนื้อนุ่ม กินแล้วเท้าเบา' },
    { id: 'fd_honey_pancake', name: 'แพนเค้กน้ำผึ้ง', lv: 15, pot: 2, kind: 'orange', buff: { atk: 3, matk: 3, taken: 4 }, tag: 'ATK/MATK +3% · ดาเมจที่รับ −4%',
      mats: { lf_wheat: 3, lf_nest: 1, mat_honeycomb: 6 }, coins: 1500, xp: 60, desc: 'แพนเค้กสามชั้นราดน้ำผึ้งจากรวงผึ้งสไลม์ ได้ทั้งแรงทั้งทน' },
    { id: 'fd_hotpot', name: 'หม้อไฟรวมมิตร', lv: 20, pot: 3, kind: 'red', buff: { atk: 8, matk: 8 }, tag: 'ATK & MATK +8%',
      mats: { fs_catfish: 2, lf_potato: 3, lf_carrot: 3, mat_red_cap: 10 }, coins: 4000, xp: 90, desc: 'หม้อเหล็กเดือดปุด ๆ ปลาดุกกับเห็ดหมวกแดง ร้อนจนเหงื่อออก' },
    { id: 'fd_fullmoon_stew', name: 'สตูว์จันทร์เพ็ญ', lv: 25, pot: 4, kind: 'blue', buff: { taken: 10, hpReg: 30 }, tag: 'ดาเมจที่รับ −10% · ฟื้น HP +30%',
      mats: { fs_moonkoi: 1, lf_moonflower: 2, mat_ancient_sap: 8 }, coins: 8000, xp: 140, desc: 'สตูว์ครีมในชามสีเที่ยงคืน มีลูกแป้งเรืองแสงเหมือนจันทร์เต็มดวง' },
  ];
  const BY = Object.fromEntries(DISHES.map((d) => [d.id, d]));
  for (const d of DISHES) {
    MAT[d.id] = { name: d.name, price: Math.round(d.coins * 1.5), desc: d.desc, food: true, kindTh: 'อาหาร', noNpc: true,
      npcNote: 'ลุงไม่รับซื้ออาหาร · กินเอง หรือขายในร้านผู้เล่น' };
    L.SOURCE[d.id] = 'ทำอาหารที่ป้าหมีหม้อดำ ข้างกองไฟกลางค่าย';
  }

  // ---------------- the skill, the pot, the teacher ----------------
  L.SKILLS.cook = { name: 'ทำอาหาร', tool: 'pot', icon: 't_pot1', rgb: '255,170,90', book: 'สมุดอาหาร',
    perks: [[5, 'บางครั้งได้อาหารเพิ่ม 1 จาน'], [10, 'บัฟอาหารนานขึ้น 10%'], [15, 'ใช้เหรียญน้อยลง 10%'], [20, 'ได้อาหารเพิ่มบ่อยขึ้น'],
      [25, 'บัฟอาหารนานขึ้น 20%'], [30, 'ปรมาจารย์: อาหารแรงขึ้น 20%']] };
  const COOK = { x: 3230, y: 2050 }; // (the station's base line, north-east of the campfire: open ground)
  const BEAR = { kind: 'ally', npc: true, cookNpc: true, name: 'ป้าหมีหม้อดำ', x: COOK.x + 170, y: COOK.y + 26, sort: COOK.y + 26, dead: 0, face: -1,
    t: 0, wave: 0, say: '', sayT: 0, near: false, stir: 0 };
  const here = (game) => !!(game && game.world && game.world.cook);
  BEAR.here = here;
  L.TOOLS.pot = { skill: 'cook', names: ['หม้อเหล็ก', 'หม้อทองแดง', 'หม้อเงินจันทร์', 'หม้อดาวตก'], sprite: (t) => 't_pot' + t,
    mentor: BEAR.name, map: 'camp', where: 'ข้างกองไฟกลางค่าย', teacher: () => BEAR };
  L.UPGRADES.pot = [{ lv: 8, coins: 2000, mats: { lf_iron: 10, lf_copper: 8 } }, { lv: 16, coins: 20000, mats: { lf_moonsilver: 8, lf_silver: 8, lf_amber: 3 } },
    { lv: 24, coins: 120000, mats: { lf_starore: 4, lf_obsidian: 8, lf_moonwood: 4 } }];
  L.GUIDE.cook = DISHES.map((d) => ({ mat: d.id, name: d.name, lv: d.lv, tier: d.pot > 1 ? d.pot : 0, where: 'ป้าหมีหม้อดำ · ข้างกองไฟ' }));
  L.onLoad.push((game, p) => { const r = L.rec(p); r.tools.pot = r.tools.pot || 1; if (!r.cook) r.cook = { lv: 1, xp: 0 }; });
  const GREET = ['หิวไหมจ๊ะ? มาทำอะไรกินกัน', 'กินให้อิ่มก่อนออกไปเจอความมืดนะ', 'ผักจากฟาร์ม ปลาจากบ่อ ป้าทำได้หมด', 'ท้องอิ่ม ใจก็กล้า'];
  const CHAT = ['คนอะไรออกล่าทั้งคืนไม่ยอมกินข้าว...', 'หม้อนี้ต้มมาตั้งแต่ไฟค่ายจุดครั้งแรก', 'หอมไหมล่ะ? สตูว์แครอทสูตรป้าเอง', 'เติมฟืนอีกนิด ไฟอ่อนไปหน่อย'];

  // ---------------- the player's kitchen state ----------------
  let st = { meal: null, auto: '' }, dirty = false;
  const lvOf = (p) => L.lvOf(p, 'cook');
  const potOf = (p) => L.toolTier(p, 'pot');
  const strong = (p) => (lvOf(p) >= 30 ? 1.2 : 1);
  const durOf = (p) => Math.round(BASE_DUR * (lvOf(p) >= 25 ? 1.2 : lvOf(p) >= 10 ? 1.1 : 1));
  const coinsOf = (p, d) => Math.round(d.coins * (lvOf(p) >= 15 ? 0.9 : 1));
  const extraChance = (p) => (lvOf(p) >= 20 ? 0.25 : lvOf(p) >= 5 ? 0.1 : 0);
  const have = (p, id) => NC.matCount(p, id);
  function save(game) {
    dirty = false;
    if (!game || game.noSave) return;
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage blocked */ }
  }
  L.onLoad.push((game, p, saved, prm) => {
    st = { meal: null, auto: '' };
    if (!NC.ONLINE) { try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* blocked */ } }
    if (st.meal && !(BY[st.meal.id] && st.meal.t > 0)) st.meal = null;
    if (st.auto && !BY[st.auto]) st.auto = '';
  });
  setInterval(() => { if (dirty && NC.game) save(NC.game); }, 5000);
  addEventListener('beforeunload', () => { if (NC.game) save(NC.game); });

  // the meal's numbers join the hero's (skilltree.js adds every source up)
  NC.skillModSources.push((p) => {
    const g = NC.game;
    if (!st.meal || !g || p !== g.player) return null;
    const d = BY[st.meal.id], k = strong(p), m = {};
    for (const key in d.buff) m[key] = Math.round(d.buff[key] * k * 10) / 10;
    return m;
  });

  function canCook(p, d, n) {
    if (lvOf(p) < d.lv) return `ต้องมีทำอาหาร Lv ${d.lv}`;
    if (potOf(p) < d.pot) return `ต้องใช้${L.TOOLS.pot.names[d.pot - 1]}`;
    for (const id in d.mats) if (have(p, id) < d.mats[id] * n) return `${(MAT[id] || {}).name || id} ไม่พอ`;
    if ((p.coins || 0) < coinsOf(p, d) * n) return 'เหรียญไม่พอ';
    return '';
  }
  function cook(game, id, n) {
    const p = game.player, d = BY[id];
    if (!d || !canHere(game)) return false;
    const why = canCook(p, d, n);
    if (why) { game.toast(why); return false; }
    for (const m in d.mats) { p.mats[m] -= d.mats[m] * n; if (p.mats[m] <= 0) delete p.mats[m]; }
    const coins = coinsOf(p, d) * n;
    p.coins -= coins;
    if (NC.Econ && NC.Econ.sink) NC.Econ.sink('cook', coins);
    let made = n;
    for (let i = 0; i < n; i++) if (Math.random() < extraChance(p)) made++;
    NC.addMat(game, id, made);
    L.addXp(game, 'cook', d.xp * n);
    BEAR.stir = 0.9; BEAR.wave = 0.8; say(pick(['ได้แล้วจ้า ร้อน ๆ เลย!', 'หอมฟุ้งไปทั้งค่ายเลย', 'ฝีมือดีขึ้นทุกวันนะเรา', 'อย่าลืมกินก่อนออกไปล่ะ']));
    steam(game, 14);
    game.toast(`ได้${d.name} ×${made}${made > n ? ' (ได้เพิ่ม!)' : ''}`);
    NC.HUD.log(`ทำ${d.name} ×${made} ใช้ ${fmt(coins)} เหรียญ`, 'item');
    if (NC.saveTrade) NC.saveTrade(game);
    NC.saveGame(game);
    return true;
  }
  function eat(game, id, quiet) {
    const p = game.player, d = BY[id];
    if (!d || p.dead > 0) return false;
    if (have(p, id) < 1) { if (!quiet) game.toast(`ไม่มี${d.name}ในกระเป๋า`); return false; }
    p.mats[id] -= 1; if (p.mats[id] <= 0) delete p.mats[id];
    const was = st.meal && BY[st.meal.id];
    st.meal = { id, t: durOf(p) };
    dirty = true;
    NC.applyGear(game);
    FX.stars(p.x, p.y - 100, 12, '255,200,120', { speed: 200 });
    NC.HUD.log(`กิน${d.name}: ${d.tag} ${Math.round(durOf(p) / 60)} นาที${was && was.id !== id ? ` (แทน${was.name})` : ''}`, 'item');
    if (!quiet) game.toast(`กิน${d.name}`);
    if (NC.saveTrade) NC.saveTrade(game);
    save(game);
    refresh();
    return true;
  }
  NC.Cook = { DISHES, BY, cook, eat, state: () => st, open: (game) => open(game || NC.game), COOK, npc: BEAR,
    lvOf, potOf, durOf, coinsOf, canCook, locked: (p, d) => lvOf(p) < d.lv || potOf(p) < d.pot, near: (g) => nearCook(g), // (js/craftgo.js: its cooking page)
    get auto() { return st.auto; }, set auto(id) { st.auto = id; dirty = true; } };

  // the meal runs down while playing; the auto farm eats the chosen dish when it is over
  L.ticks.push((game, dt) => {
    const p = game.player;
    if (!p) return;
    if (st.meal) {
      st.meal.t -= dt; dirty = true;
      if (st.meal.t <= 0) {
        const d = BY[st.meal.id];
        st.meal = null;
        NC.applyGear(game);
        NC.HUD.log(`${d.name}หมดฤทธิ์แล้ว`, 'warn');
        save(game);
        refresh();
      }
    }
    if (!st.meal && st.auto && NC.Auto && NC.Auto.on && p.dead <= 0 && have(p, st.auto) > 0) eat(game, st.auto, true);
  });

  // ---------------- the station and ป้าหมี in the camp ----------------
  const baseBuild = NC.buildWorld;
  NC.buildWorld = function () {
    const w = baseBuild.apply(this, arguments), s = NC.SPR.cook_station;
    if (!w.shop) return w; // (the camp only: where the merchant is)
    const inBox = (x, y) => x > COOK.x - 200 && x < COOK.x + 270 && y > COOK.y - 120 && y < COOK.y + 70;
    w.props = w.props.filter((q) => !(inBox(q.x, q.y) && /bush|rock|log|grass|flower|fern|shroom|pebble/.test(q.name || '')));
    const prop = { kind: 'prop', name: 'cook_station', x: COOK.x, y: COOK.y, scale: 1, flip: false, sort: COOK.y, shadow: [130, 24] };
    if (s) w.props.push(prop);
    const mark = (cx, cy, rx, ry) => {
      for (let gy = Math.floor((cy - ry) / w.CELL); gy <= (cy + ry) / w.CELL; gy++)
        for (let gx = Math.floor((cx - rx) / w.CELL); gx <= (cx + rx) / w.CELL; gx++) {
          if (gx < 0 || gy < 0 || gx >= w.GW || gy >= w.GH) continue;
          const nx = (gx * w.CELL + w.CELL / 2 - cx) / rx, ny = (gy * w.CELL + w.CELL / 2 - cy) / ry;
          if (nx * nx + ny * ny <= 1) w.solid[gy * w.GW + gx] = 1;
        }
    };
    mark(COOK.x, COOK.y - 10, 120, 30);
    mark(BEAR.x, BEAR.y - 4, 30, 13);
    // (no light of its own: the campfire stays the camp's only light, the user's rule)
    w.cook = BEAR;
    return w;
  };
  function say(text) { BEAR.say = text; BEAR.sayT = 3.6; }
  const TALK = 240;
  const nearCook = (game) => here(game) && game.player.dead <= 0 &&
    (NC.dist(game.player.x, game.player.y, BEAR.x, BEAR.y) < TALK + 40 || NC.dist(game.player.x, game.player.y, COOK.x, COOK.y) < TALK + 60);
  // (2026-10-17) cooking also works away from her: js/craftgo.js's crafting window, out of combat on an allowed map
  const canHere = (game) => nearCook(game) || !!(NC.CraftGo && NC.CraftGo.ok(game));
  let steamT = 0;
  function steam(game, n) {
    if (!FX.puff) return;
    FX.puff(COOK.x - 22, COOK.y - 128, n || 2, { speed: 16, rise: 55, size: 0.42, lifeK: 1.9, color: '240,240,246' }); // (thin steam off the pot)
  }
  const baseUpdate = P.update;
  P.update = function (game, dt) {
    baseUpdate.call(P, game, dt);
    if (!here(game)) return;
    const p = game.player, d = NC.dist(p.x, p.y, BEAR.x, BEAR.y);
    BEAR.t += dt; BEAR.wave = Math.max(0, BEAR.wave - dt); BEAR.sayT = Math.max(0, BEAR.sayT - dt); BEAR.stir = Math.max(0, BEAR.stir - dt);
    const near = d < TALK && p.dead <= 0;
    if (near && !BEAR.near) { BEAR.wave = 1.2; say(pick(GREET)); }
    BEAR.near = near;
    if (near && Math.abs(p.x - BEAR.x) > 24) BEAR.face = p.x < BEAR.x ? -1 : 1; else if (!near) BEAR.face = -1; // (at work: towards the pot)
    if (d < 560 && BEAR.sayT <= 0 && Math.random() < dt / 11) say(pick(near ? GREET : CHAT));
    steamT -= dt;
    if (steamT <= 0 && NC.dist(p.x, p.y, COOK.x, COOK.y) < 1400) { steamT = 0.5; steam(game, 1); }
  };
  const baseCollect = P.collect;
  P.collect = function (list, visible) {
    baseCollect.call(P, list, visible);
    if (here(NC.game) && visible(BEAR.x - 120, BEAR.y - 220, BEAR.x + 120, BEAR.y + 40)) list.push(BEAR);
  };
  const baseDraw = P.draw;
  P.draw = function (ctx, game, a) {
    if (!a.cookNpc) return baseDraw.call(P, ctx, game, a);
    const b = Math.sin(a.t * 2.2) * 0.016, pose = (a.wave > 0 || a.stir > 0) && NC.SPR.npc_bear_b ? 'npc_bear_b' : 'npc_bear';
    if (NC.SPR[pose]) NC.drawSpr(ctx, pose, a.x, a.y, { flip: a.face < 0, sx: 1 + b * 0.5, sy: 1 - b });
  };
  function bubble(ctx, text, x, y, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = "500 20px 'Mitr', sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(380, ctx.measureText(text).width + 30), h = 40;
    ctx.beginPath(); NC.rrect(ctx, x - w / 2, y - h, w, h, 14);
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 9, y - 2); ctx.lineTo(x, y + 12); ctx.lineTo(x + 9, y - 2); ctx.closePath();
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.stroke();
    ctx.fillRect(x - 7, y - 6, 14, 6);
    ctx.fillStyle = NC.OUTLINE; ctx.fillText(text, x, y - h / 2 + 1, w - 20);
    ctx.restore();
  }
  const baseTags = P.drawTags;
  P.drawTags = function (ctx, game) {
    baseTags.call(P, ctx, game);
    if (!here(game) || !NC.drawTag) return;
    const c = game.cam;
    if (BEAR.x < c.x - 300 || BEAR.x > c.x + game.vw + 300 || BEAR.y < c.y - 300 || BEAR.y > c.y + game.vh + 300) return;
    NC.drawTag(ctx, BEAR.name, BEAR.x, BEAR.y + 32, 22, '#ffc37a');
    NC.drawTag(ctx, 'แม่ครัว · ทำอาหาร · อัปเกรดหม้อ', BEAR.x, BEAR.y + 58, 16, '#e8e0d2');
    if (BEAR.sayT > 0) bubble(ctx, BEAR.say, BEAR.x, BEAR.y - 196, NC.clamp(BEAR.sayT / 0.3, 0, 1) * NC.clamp((3.6 - BEAR.sayT) / 0.15, 0, 1));
    else if (BEAR.near) NC.drawTag(ctx, 'กด B หรือคลิก เพื่อทำอาหาร', BEAR.x, BEAR.y - 204 + Math.sin(game.time * 4) * 3, 20, '#fff3cf');
  };

  // ---------------- the cookbook (layout B) ----------------
  let win = null, sel = DISHES[0].id;
  const PILL = { red: 'ck-red', blue: 'ck-blue', green: 'ck-green', purple: 'ck-purple', yellow: 'ck-yellow', orange: 'ck-orange' };
  function build() {
    win = document.createElement('div');
    win.id = 'cookbook'; win.className = 'kw-panel'; win.hidden = true;
    win.innerHTML = '<div class="ck-wrap"><section class="kw-win ck-win">' +
      '<header class="kw-title"><span>ทำอาหาร</span><button class="kw-x" id="ck-close" aria-label="ปิด">✕</button></header>' +
      '<div class="ck-body"><div class="ck-book">' +
        '<div class="ck-page ck-left kw-scroll" id="ck-left"></div><div class="ck-spine"></div><div class="ck-page ck-right" id="ck-right"></div>' +
        '<i class="ck-clasp a"></i><i class="ck-clasp b"></i>' +
      '</div></div></section></div>';
    document.body.appendChild(win);
    $('ck-close').addEventListener('click', close);
    win.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const g = NC.game;
      if (b.dataset.dish) { sel = b.dataset.dish; render(); return; }
      if (b.dataset.cook) { if (cook(g, sel, Number(b.dataset.cook))) render(); return; }
      if (b.dataset.eat) { eat(g, b.dataset.eat); return; }
      if (b.id === 'ck-auto') { st.auto = st.auto === sel ? '' : sel; dirty = true; save(g); render(); }
    });
  }
  function open(game) {
    if (!win) return;
    game.paused = true;
    NC.HUD.panel('pause', false); // (closes the other windows)
    win.hidden = false;
    render();
  }
  function close() {
    if (!win) return;
    win.hidden = true;
    const g = NC.game;
    if (g) g.paused = false;
  }
  function refresh() { if (win && !win.hidden) render(); }
  function fit() {
    const wrap = win.querySelector('.ck-wrap');
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) fit(); }, 0));
  const mmss = (t) => { const s = Math.max(0, Math.ceil(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const locked = (p, d) => lvOf(p) < d.lv || potOf(p) < d.pot;

  function render() {
    if (!win || win.hidden) return;
    const g = NC.game, p = g.player, R = L.rec(p).cook || { lv: 1, xp: 0 }, max = R.lv >= L.MAXLV;
    const need = L.xpNeed(R.lv), pct = max ? 100 : Math.min(100, (100 * R.xp) / need);
    // the left page: the level, then every recipe as a card
    let h = `<div class="ck-title">ทำอาหาร Lv ${R.lv} - ${esc(L.rankOf(R.lv))}</div>` +
      `<div class="ck-xprow" title="${max ? 'เลเวลสูงสุดแล้ว' : `XP ${R.xp} / ${need}`}"><div class="ck-xp"><i style="width:${pct.toFixed(1)}%"></i></div><b>${max ? 'MAX' : Math.floor(pct) + '%'}</b></div>` +
      '<div class="ck-grid">';
    for (const d of DISHES) {
      const lk = locked(p, d), n = have(p, d.id);
      h += `<button class="ck-card${d.id === sel ? ' sel' : ''}${lk ? ' lk' : ''}" data-dish="${d.id}">` +
        (lk ? '<span class="ck-q">?</span>' : `<img src="${icon(d.id)}" alt="">`) +
        (n && !lk ? `<em class="ck-have">×${n}</em>` : '') +
        `<b>${esc(d.name)}</b><span class="ck-pill ${lk ? 'ck-grey' : PILL[d.kind]}">${lk ? (lvOf(p) < d.lv ? `ทำอาหาร Lv ${d.lv}` : esc(L.TOOLS.pot.names[d.pot - 1])) : esc(d.tag)}</span></button>`;
    }
    h += '</div>';
    $('ck-left').innerHTML = h;
    renderRight(g, p);
    fit();
  }
  function renderRight(g, p) {
    const d = BY[sel], lk = locked(p, d), n = have(p, d.id), meal = st.meal && BY[st.meal.id];
    const coins = coinsOf(p, d), ok1 = !canCook(p, d, 1), ok5 = !canCook(p, d, 5), near = canHere(g);
    let h = '<div class="ck-top"><div class="ck-meal">' + (meal
      ? `<img src="${icon(meal.id)}" alt=""><span>${esc(meal.name)} · เหลือ <b>${mmss(st.meal.t)}</b></span>`
      : '<span class="ck-none">ยังไม่ได้กินอาหาร</span>') + '</div></div>';
    h += '<div class="ck-head"><div class="ck-info">' +
      `<div class="ck-name">${esc(d.name)}</div><span class="ck-pill ck-lg ${lk ? 'ck-grey' : PILL[d.kind]}">${esc(d.tag)}</span>` +
      `<div class="ck-time"><i class="ck-clock"></i>${Math.round(durOf(p) / 60)} นาที</div>` +
      `<div class="ck-eatrow"><span>มีในกระเป๋า <b>${n}</b> จาน</span><button class="kw-btn blue ck-eat" data-eat="${d.id}"${n ? '' : ' disabled'}>กิน</button></div>` +
      '</div><div class="ck-scene"><canvas id="ck-scene" width="490" height="330"></canvas>' +
      `<img class="ck-dish" src="${icon(d.id)}" alt=""><i class="ck-steam s1"></i><i class="ck-steam s2"></i><i class="ck-steam s3"></i></div></div>`;
    // what it takes: the ingredients (have / need) and the coins
    h += '<div class="ck-mats">';
    for (const id in d.mats) {
      const hv = have(p, id), nd = d.mats[id], seen = p.matSeen && p.matSeen.has(id);
      h += `<div class="ck-mat"><span class="ck-slot">${seen ? `<img src="${NC.matIcon(id)}" alt="">` : '<i>?</i>'}</span>` +
        `<b>${esc((MAT[id] || {}).name || id)}</b><em class="${hv >= nd ? 'ok' : 'no'}">${hv}/${nd}</em></div>`;
    }
    h += `<div class="ck-mat"><span class="ck-slot ck-coinslot"><img src="${NC.matIcon('ic_coin')}" alt=""></span><b>${fmt(coins)} เหรียญ</b>` +
      `<em class="${(p.coins || 0) >= coins ? 'ok' : 'no'}">มี ${fmt(p.coins || 0)}</em></div></div>`;
    const why = lk ? canCook(p, d, 1) : !near ? 'ทำได้ที่ป้าหมีหม้อดำ ข้างกองไฟกลางค่าย หรือเปิดงานฝีมือ (Y) ตอนไม่ได้สู้' : !ok1 ? canCook(p, d, 1) : '';
    h += `<div class="ck-btns"><button class="kw-btn blue" data-cook="1"${ok1 && near ? '' : ' disabled'}>ทำ x1</button>` +
      `<button class="kw-btn gold" data-cook="5"${ok5 && near ? '' : ' disabled'}>ทำ x5</button></div>` +
      (why ? `<div class="ck-why">${esc(why)}</div>` : '') +
      `<button class="ck-auto${st.auto === d.id ? ' on' : ''}" id="ck-auto"${lk ? ' disabled' : ''}><i></i><span>ออโต้ฟาร์มกินจานนี้ให้เองเมื่อบัฟหมด</span></button>`;
    $('ck-right').innerHTML = h;
    drawScene(p);
  }
  // the corner picture: the hero stirring the pot at the station (the real hero, as dressed now)
  function drawScene(p) {
    const cv = $('ck-scene'), s = NC.SPR.cook_station;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    const glow = ctx.createRadialGradient(170, 250, 10, 170, 250, 220);
    glow.addColorStop(0, 'rgba(255,190,110,0.45)'); glow.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, cv.width, cv.height);
    if (s && s.img) {
      const k = Math.min(300 / s.w, 250 / s.h);
      ctx.drawImage(s.img, 175 - (s.w * k) / 2, 300 - s.h * k, s.w * k, s.h * k);
    }
    try {
      const eq = p.equip, c = NC.animCtx(eq), P0 = NC.Anim.sample('idle', 0.4, c);
      P0.face = -1;
      ctx.fillStyle = 'rgba(40,20,20,0.25)';
      ctx.beginPath(); ctx.ellipse(380, 302, 50, 12, 0, 0, Math.PI * 2); ctx.fill();
      if (!(NC.HeroSpine && NC.HeroSpine.preview && NC.HeroSpine.preview(ctx, eq, 380, 300, 1.75, { t: 0.4, face: -1 }))) // (the hero rig's idle, js/herospine.js)
        NC.drawHero(ctx, eq, P0, 380, 300, { scale: 1.75 });
    } catch (e) { /* (the hero's parts are not loaded yet) */ }
  }

  // ---------------- opening it: B or a click by ป้าหมี / the station ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build();
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id !== 'cookbook') win.hidden = true;
    if (win && id === 'cookbook') { const on = show === undefined ? win.hidden : show; if (on) open(NC.game); else close(); return on; }
    return basePanel(id, show);
  };
  addEventListener('keydown', (e) => {
    const game = NC.game;
    if (!game || !game.player || e.repeat) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (win && !win.hidden && (e.code === 'Escape' || e.code === 'KeyB')) { e.stopImmediatePropagation(); e.preventDefault(); close(); return; }
    if (e.code !== 'KeyB' || game.paused || !nearCook(game)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (NC.Lessons && NC.Lessons.talk && NC.Lessons.talk(game, 'bear')) return; // (js/lessons.js: a quest waits with her)
    open(game);
  }, true);
  addEventListener('mousedown', (e) => {
    const game = NC.game;
    if (e.button !== 0 || !game || !here(game) || e.target !== $('view') || !win || !win.hidden) return;
    const wx = game.cam.x + (e.clientX * game.dpr) / game.scale, wy = game.cam.y + (e.clientY * game.dpr) / game.scale;
    const onBear = Math.abs(wx - BEAR.x) < 70 && wy > BEAR.y - 180 && wy < BEAR.y + 16;
    const onPot = Math.abs(wx - COOK.x) < 130 && wy > COOK.y - 170 && wy < COOK.y + 20;
    if (!onBear && !onPot) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (nearCook(game)) { if (!(NC.Lessons && NC.Lessons.talk && NC.Lessons.talk(game, 'bear'))) open(game); } // (js/lessons.js)
    else game.toast('เดินเข้าไปใกล้ป้าหมีหม้อดำก่อนนะ');
  }, true);

  // ---------------- the meal on the HUD (beside the skill buffs) ----------------
  const baseBuffs = NC.HUD.renderBuffs.bind(NC.HUD);
  NC.HUD.renderBuffs = function (p) {
    baseBuffs(p);
    const box = $('buffs');
    if (!box) return;
    let el = box.querySelector('.buff.meal');
    if (!st.meal) { if (el) el.remove(); return; }
    const d = BY[st.meal.id];
    if (!el || el.dataset.id !== d.id) {
      if (el) el.remove();
      el = document.createElement('div');
      el.className = 'buff meal'; el.dataset.id = d.id;
      el.innerHTML = `<img src="${icon(d.id)}" alt=""><b></b>`;
      box.appendChild(el);
    }
    el.title = `${d.name}: ${d.tag}`;
    const t = st.meal.t;
    el.querySelector('b').textContent = t >= 60 ? Math.ceil(t / 60) + 'm' : Math.ceil(t);
    el.classList.toggle('ending', t < 60);
  };

  // ---------------- the bag: eat a dish (its card's button, or a double-click) ----------------
  (NC.matCardExtras = NC.matCardExtras || []).push((p, en) => {
    const d = BY[en.id];
    if (!d) return '';
    const on = st.meal && st.meal.id === d.id;
    return `<div class="iv-lines"><div class="fx">${esc(d.tag)} · ${Math.round(durOf(p) / 60)} นาที${on ? ' · กำลังได้ผลอยู่' : ''}</div></div>` +
      `<div class="iv-acts"><button class="iv-btn blue" data-act="cook:eat">กิน</button></div>`;
  });
  if (NC.invActs) NC.invActs.push((game, a, en) => {
    if (!en || en.kind !== 'mat' || !BY[en.id] || (a !== 'cook:eat' && a !== 'main')) return false;
    eat(game, en.id);
    return true;
  });
})();
