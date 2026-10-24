/* baphomet.js — บาโฟเม็ด, a WORLD BOSS in two forms (the user, 2026-10-15: "เจน บอสบาโฟเม็ด แบบ MMO คลาสสิก มาให้ดูหน่อย", then
   "ทำเป็น world boss เลย มีสองร่าง อันขวาสุดไม่เอา": concept A then B of assets/gen/make_baphomet_prompts.py, C dropped):
     ร่าง 1  บาโฟเม็ด จ้าวแพะปีศาจ  a towering goat demon with a giant scythe: the scythe sweep (เคียวกวาด), dark bolts falling
                                   round the hero (สายฟ้ามืด), the hoof quake (กีบกระแทกพื้น), calls goat kids, vanishes in smoke
     ร่าง 2  บาโฟเม็ด ร่างรากสิง    when the first form falls, the Dark Tree's roots burst into him and he rises again with a new
                                   HP bar: root spikes along the ground (หนามรากทะลวง), crystal shards (ผลึกม่วงโปรย), the
                                   spinning root scythe (เคียวรากหมุน), the root whip (รากฟาด), calls root kids
   A world boss like season.js's: every day at 16:00 and 21:00 (the viewer's clock) on one of the Dark Tree's maps (it turns
   with the day), told 10 minutes before; Lv 99, its HP grows with the heroes online on that map; the auto farm can't hurt it;
   20 minutes for both forms. The kill: coins, option stones, season tokens, its horn and root heart; rarely its two scythes
   and two horn headpieces (boss rates, bossrate.js; one source each).
   Its skills (the user's pick, "ผสม ภาพวาด+glfx"): every shape is a PAINTED piece (Codex: assets/gen/
   make_baphomet_game_prompts.py -> tools/baph_cut.py -> assets/baph/fx_baph_*, and the root bosses' danger ring and lane of
   assets/lost/), placed, turned, scaled and faded by code; js/glfx.js adds live light over them: soft glows, shock rings,
   sparks, star bursts, the Dark Tree's vortex at the change, camera punches. Nothing is drawn as a canvas shape.
   Load after season.js, before bossrate.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, ITEMS = NC.ITEMS, TAU = Math.PI * 2;
  if (!FX || !NC.BOSSES || !NC.MONSTERS || !ITEMS) return;
  if (NC.ASSET_MANIFEST_BAPH) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_BAPH);
  const GL = NC.GLFX, MIN = 60;

  // ---------------- who ----------------
  const ID1 = 'baphomet', ID2 = 'baphomet_root';
  const FORM = {
    [ID1]: { n: 1, top: 400, light: [560, '220,80,150'], tint: [0.85, 0.22, 0.45], pal: 'blood', minion: ['baph_kid', 3],
      moves: ['sweep', 'bolts', 'quake', 'summon', 'blink'], spd: 120 },
    [ID2]: { n: 2, top: 430, light: [600, '200,80,255'], tint: [0.8, 0.3, 1.0], pal: 'void', minion: ['baph_rootkid', 3],
      moves: ['spikes', 'shards', 'spin', 'whip', 'summon'], spd: 130 },
  };
  Object.assign(NC.MONSTERS, {
    [ID1]: { name: 'บาโฟเม็ด จ้าวแพะปีศาจ', element: 'shadow', atkElement: 'shadow', r: 70, hpK: 55, atkK: 1.9, defK: 1.6, mdefK: 1.2,
      agiK: 0.5, dexK: 1.2, expK: 60, spd: 120, aggro: 900 },
    [ID2]: { name: 'บาโฟเม็ด ร่างรากสิง', element: 'shadow', atkElement: 'shadow', r: 74, hpK: 62, atkK: 2.1, defK: 1.7, mdefK: 1.3,
      agiK: 0.5, dexK: 1.3, expK: 80, spd: 130, aggro: 1100 },
  });
  // the kids it calls (only as its minions: no rosters, no drops)
  const MON = { r: 24, hpK: 1, atkK: 1, defK: 1, mdefK: 0.5, agiK: 0.6, dexK: 0.7, expK: 1.2, spd: 150, aggro: 560 };
  const KID = (name, el) => Object.assign({}, MON, { name, kind: 'charge', hpK: 0.6, atkK: 0.9, defK: 0.7, mdefK: 0.6, agiK: 1.0,
    dexK: 0.9, expK: 0.4, spd: 175, aggro: 900, dash: [260, 680, 0.32], leap: 16, element: el, atkElement: 'shadow', dust: '90,70,90',
    r: 22, color: '60,50,70' });
  const KIDS = { baph_kid: KID('ลูกแพะปีศาจ', 'shadow'), baph_rootkid: KID('ลูกแพะราก', 'earth') };
  if (NC.SPECIES) Object.assign(NC.SPECIES, KIDS);
  Object.assign(NC.MONSTERS, KIDS);
  NC.NO_MONSKILLS = Object.assign(NC.NO_MONSKILLS || {}, { baph_kid: 1, baph_rootkid: 1 }); // (no leap / howl with code-drawn warnings)
  // the boss bar (boss.js) and the name tag; its death is handled here (boss.js's own ending is skipped)
  NC.BOSSES[ID1] = { respawn: 0, drops: 0, top: FORM[ID1].top };
  NC.BOSSES[ID2] = { respawn: 0, drops: 0, top: FORM[ID2].top };

  // ---------------- its drops (one source each) ----------------
  const M = NC.ASSET_MANIFEST;
  function bestScythe(lv) {
    let best = null;
    for (const [id, it] of Object.entries(ITEMS)) {
      if (it.slot !== 'weapon' || it.wtype !== 'scythe' || !it.lvReq || it.lvReq > lv || /_harlock$|^c3_|^scythe_baph/.test(id)) continue;
      if (!best || it.lvReq > best.lvReq) best = it;
    }
    return best || ITEMS.scythe;
  }
  const scythe = (id, sprite, name, lv, k, desc) => {
    const base = bestScythe(lv);
    if (!base || !M[sprite]) return;
    const W = Object.assign({}, base, { id, sprite, name, rarity: 'legend', lvReq: lv, element: 'shadow', desc,
      dmg: base.dmg ? base.dmg.map((v) => Math.round(v * k)) : base.dmg, stats: { str: 6, crit: 0.05 } });
    for (const key of Object.keys(W)) if (key[0] === '_') delete W[key];
    ITEMS[id] = W;
  };
  scythe('scythe_baph', 'w_baph', 'เคียวจ้าวแพะปีศาจ', 90, 1.12, 'เคียวใหญ่ใบเหล็กขาวหม่นของบาโฟเม็ด ด้ามพันผ้าแดงเก่า ฟันทีเดียวลมหวีด · จากบอสโลกบาโฟเม็ด');
  scythe('scythe_baphroot', 'w_baphroot', 'เคียวรากจ้าวแพะ', 95, 1.16, 'เคียวด้ามรากดำบิดเกลียว ใบเป็นเปลือกไม้ขอบผลึกม่วงเรืองแสง · จากบาโฟเม็ดร่างรากสิง');
  const horns = (id, sprite, name, lv, stats, desc, fit) => {
    if (!M[sprite]) return;
    const w = Object.assign({ fit: 1.35, seat: 0.05, clip: false }, M[sprite].wear || {}, fit || {});
    ITEMS[id] = { id, slot: 'hat', name, sprite, rarity: 'legend', lvReq: lv, fit: w.fit, seat: w.seat, dx: w.dx || 0, clip: w.clip, soft: 0.3, stats, desc };
  };
  horns('hat_baph', 'hat_baph', 'เขาจ้าวแพะปีศาจ', 90, { def: 12, str: 4 }, 'เขาแกะม้วนคู่สีน้ำตาลทองบนสายคาดหนังดำ · จากบอสโลกบาโฟเม็ด');
  horns('hat_baphroot', 'hat_baphroot', 'เขารากจ้าวแพะ', 95, { def: 13, int: 4, mdef: 6 }, 'เขาม้วนคู่ที่เป็นรากดำบิดเกลียว มีผลึกม่วงงอกตามรอยแตก · จากบาโฟเม็ดร่างรากสิง');
  if (NC.ITEM_ORDER) for (const id of ['scythe_baph', 'scythe_baphroot', 'hat_baph', 'hat_baphroot']) if (ITEMS[id] && !NC.ITEM_ORDER.includes(id)) NC.ITEM_ORDER.push(id);
  if (NC.LOOT_DATA && NC.LOOT_DATA.bosses) // (bossrate.js sets the rates: weapons 0.5%, the horns 1%)
    NC.LOOT_DATA.bosses[ID2] = [['scythe_baph', 0.5], ['scythe_baphroot', 0.5], ['hat_baph', 1], ['hat_baphroot', 1]].filter(([it]) => ITEMS[it]);
  if (NC.MATERIALS) {
    NC.MATERIALS.mat_baph_horn = { name: 'เขาจ้าวแพะปีศาจ', price: 2400, desc: 'เขาแกะม้วนที่หักจากหัวบาโฟเม็ด ยังมีรอยร้าวของสายฟ้ามืด' };
    NC.MATERIALS.mat_baph_heart = { name: 'หัวใจรากจ้าวแพะ', price: 3200, desc: 'ปมรากดำมีหนามที่เคยพันหัวใจของบาโฟเม็ดไว้ ข้างในผลึกม่วงยังเต้นอยู่' };
  }

  // ---------------- painted pieces + live light ----------------
  const S = (n) => { const s = NC.SPR[n]; return s && s.img ? s : null; };
  const ease = (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  const glOk = () => !!(GL && GL.ok && GL.ok());
  // one painted piece centred on (x, y) (ay 1: standing on y), w x h world units
  function pic(ctx, n, x, y, w, h, a, o) {
    const s = S(n);
    if (!s || a <= 0.005 || w <= 0 || h <= 0) return;
    o = o || {};
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    if (o.add) ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    ctx.drawImage(s.img, -w / 2, o.ay ? -h : -h / 2, w, h);
    ctx.restore();
  }
  const fit = (n, w) => { const s = S(n); return s ? [w, (w * s.h) / s.w] : [w, w]; }; // (a piece w wide, its own shape)
  // live light (glfx): only inside 'low' / 'glow' drawers
  function glow(layer, x, y, r, tint, a, squash) {
    if (glOk() && a > 0.01) GL.quad(layer, x, y, r, r * (squash || 1), 0, { shape: GL.SH.glow, tint, a, add: true });
  }
  function ringGL(layer, x, y, r, pal, a, erode, seed) {
    if (glOk() && a > 0.01) GL.quad(layer, x, y, r, r * 0.58, 0, { shape: GL.SH.ring, pal: GL.PAL[pal], a, erode: erode || 0, ns: 4, seed: seed || 0, add: true });
  }
  function starsGL(x, y, r, pal, a, seed) {
    if (glOk() && a > 0.01) GL.quad('glow', x, y, r, r, 0, { shape: GL.SH.star, pal: GL.PAL[pal], a, seed: seed || 0, add: true });
  }
  // sparks flying out of a point (glfx particles; nothing without WebGL2)
  function sparks(x, y, n, pal, speed, up) {
    if (!glOk()) return;
    const q = GL.parts({ life: 1.4, draw: (p, u) => {
      const a = (1 - u) * 0.95, L = 26 + 40 * (1 - u), ang = Math.atan2(p.vy, p.vx);
      GL.quad('glow', p.x, p.y, L, 5, ang, { shape: GL.SH.spark, pal: GL.PAL[pal], a, add: true });
    } });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.5 + Math.random() * 0.7);
      q.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - (up || 0) * Math.random(), drag: 3.2, grav: 380, life: 0.5 + Math.random() * 0.5 });
    }
  }
  const zoom = (x, y, k, d) => { if (glOk()) GL.zoom(x, y, k, d); };
  // later, on the GAME clock (a background tab stepped by tests, a paused game: never a wall-clock timer)
  const later = (sec, fn) => FX.add({ type: 'custom', layer: 'low', life: sec, draw() {}, onEnd: () => fn() });
  // an effect item that draws itself (layer 'low' under the sprites, 'high' over them, 'glow' after the night)
  const fx = (layer, life, o, draw) => FX.add(Object.assign({ type: 'custom', layer, life, draw }, o));

  // ---- the pieces as effects ----
  // the danger zone: form 1 its own violet-red cracked ring, form 2 the root bosses' ring of roots (assets/lost)
  function warnAt(e, x, y, r, life) {
    const two = FORM[e.type] && FORM[e.type].n === 2;
    return fx('low', life, { x, y, r, owner: e }, (ctx, p, u) => {
      const k = ease(u), beat = 0.85 + 0.15 * Math.sin(p.t * 16), W = p.r * 2.1, H = W * 0.58;
      if (two && S('fx_warn_rim')) {
        pic(ctx, 'fx_warn_fill', p.x, p.y, W * (0.25 + 0.75 * k), H * (0.25 + 0.75 * k), (0.35 + 0.45 * k) * beat);
        pic(ctx, 'fx_warn_rim', p.x, p.y, W, H, 0.9 * Math.min(1, u * 5));
      } else {
        pic(ctx, 'fx_baph_warn', p.x, p.y, W, H, (0.35 + 0.55 * k) * beat * Math.min(1, u * 5));
      }
      glow('low', p.x, p.y, p.r * 0.9, FORM[e.type] ? FORM[e.type].tint : [1, 0.3, 0.5], 0.18 + 0.25 * k, 0.58);
    });
  }
  function warnLane(e, x, y, ang, len, w, life) {
    return fx('low', life, { x, y, owner: e }, (ctx, p, u) => {
      const k = ease(u), beat = 0.85 + 0.15 * Math.sin(p.t * 16);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.62); ctx.rotate(ang);
      pic(ctx, 'fx_lane', len / 2, 0, len, w * 1.15, (0.45 + 0.5 * k) * beat * Math.min(1, u * 5));
      ctx.restore();
    });
  }
  function smoke(x, y, size, owner) {
    fx('high', 0.9, { x, y, owner }, (ctx, p, u) => pic(ctx, 'fx_baph_smoke', p.x, p.y - size * 0.35 - u * 30, ...fit('fx_baph_smoke', size * (0.6 + 0.6 * ease(u))), (1 - u) * 1.1));
    fx('glow', 0.5, { x, y }, (ctx, p, u) => glow('glow', p.x, p.y - size * 0.3, size * 0.7, [0.7, 0.2, 0.5], 0.45 * (1 - u)));
  }
  function eruption(x, y, size, delay, owner) {
    fx('high', 0.95 + (delay || 0), { x, y, owner }, (ctx, p, u0) => {
      const t = p.t - (delay || 0);
      if (t < 0) return;
      const u = t / 0.95, grow = Math.min(1, GL ? GL.backOut(Math.min(1, t / 0.22), 2.2) : t / 0.22);
      const [w, h] = fit('fx_baph_eruption', size);
      pic(ctx, 'fx_baph_eruption', p.x, p.y + 10, w * (0.7 + 0.3 * grow), h * grow, u < 0.7 ? 1 : (1 - u) / 0.3, { ay: 1 });
    });
    fx('glow', 0.6 + (delay || 0), { x, y }, (ctx, p) => { const t = p.t - (delay || 0); if (t >= 0) glow('glow', p.x, p.y - size * 0.4, size * 0.75, [0.85, 0.3, 1], 0.5 * Math.max(0, 1 - t / 0.6)); });
  }

  // ---------------- the fight ----------------
  const hitHero = (game, e, mul) => {
    if (e.online) return false; // (?online: the server lands his blows, js/online/baph.js)
    const p = game.player;
    if (p.inv > 0 || p.dead > 0) return false;
    const r = NC.monsterHit(e, p.d);
    if (r.miss) { FX.num(p.x, p.y - 150, r.lucky ? 'Lucky!' : 'MISS', { fill: r.lucky ? '#ffe28a' : '#cfd8ff', size: 34 }); p.inv = 0.3; return false; }
    NC.hurtPlayer(game, Math.max(1, Math.round(r.dmg * mul)), e.x);
    return true;
  };
  const hurtParty = (game, e, x, y, r, mul) => { if (!e.online && NC.Party && NC.Party.hurtArea) NC.Party.hurtArea(game, e, x, y, r, mul); };
  const inEllipse = (x, y, cx, cy, r) => ((x - cx) / r) ** 2 + ((y - cy) / (r * 0.58)) ** 2 < 1;
  const inLane = (x, y, ox, oy, ang, len, w) => {
    const dx = x - ox, dy = (y - oy) / 0.62, along = dx * Math.cos(ang) + dy * Math.sin(ang), across = -dx * Math.sin(ang) + dy * Math.cos(ang);
    return along > -20 && along < len && Math.abs(across) < w / 2;
  };
  const push = (game, e, k) => { const p = game.player, a = NC.angle(e.x, e.y, p.x, p.y); for (let i = 0; i < k; i++) NC.tryMove(game.world, p, Math.cos(a) * 22, Math.sin(a) * 13); };
  const say = (game, text, kind) => { if (game.toast) game.toast(text); NC.HUD.log(text, kind || 'warn'); };
  const pickW = (opts) => { let s = 0; for (const [, w] of opts) s += w; let r = Math.random() * s; for (const [k, w] of opts) if ((r -= w) <= 0) return k; return opts[0][0]; };

  function wake(game, e) {
    if (e.awake) return;
    e.awake = true; e.state = 'roar'; e.t = 0;
    game.shake = Math.max(game.shake, 16);
    zoom(e.x, e.y - 160, 0.06, 0.5);
    say(game, `${e.name} ตื่นแล้ว!`);
  }
  function pick(game, e, dp) {
    const F = FORM[e.type], kids = game.enemies.filter((m) => m.owner === e && !m.dead).length, opts = [];
    for (const m of F.moves) {
      if (m === 'summon') { if (kids < 5 && e.summonCd <= 0 && e.hp < e.maxHp * 0.9) opts.push([m, 2.2]); continue; }
      if (m === 'sweep' || m === 'quake' || m === 'spin') { if (dp < 460) opts.push([m, 3]); continue; }
      if (m === 'blink') { if (dp < 260 || dp > 900) opts.push([m, 1.6]); continue; }
      opts.push([m, dp > 420 ? 3 : 2]); // bolts, spikes, shards, whip: from afar too
    }
    start(game, e, pickW(opts));
  }
  function start(game, e, kind) {
    const p = game.player, rage = e.raged ? 0.78 : 1, toP = NC.angle(e.x, e.y, p.x, p.y);
    e.state = kind; e.t = 0; e.done = false; e.n = 0;
    e.face = Math.cos(toP) > 0 ? 1 : -1;
    if (kind === 'sweep') {
      e.wind = 0.85 * rage; e.ang = toP;
      e.ax = e.x + Math.cos(toP) * 230; e.ay = e.y + Math.sin(toP) * 230 * 0.62;
      warnAt(e, e.ax, e.ay, 330, e.wind + 0.1);
    } else if (kind === 'bolts' || kind === 'shards') {
      e.wind = 0.15; e.spots = [];
      const n = (kind === 'bolts' ? 6 : 8) + (e.raged ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, d = i === 0 ? 0 : NC.rand(100, kind === 'bolts' ? 380 : 420);
        let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.62;
        if (!game.world.fits(x, y, 10)) { x = p.x; y = p.y; }
        const at = (kind === 'bolts' ? 0.9 : 1.0) + i * (kind === 'bolts' ? 0.16 : 0.12);
        e.spots.push({ x, y, at, done: false });
        warnAt(e, x, y, 120, at);
      }
    } else if (kind === 'quake' || kind === 'spin') {
      e.wind = (kind === 'quake' ? 0.9 : 0.85) * rage;
      warnAt(e, e.x, e.y, kind === 'quake' ? 380 : 400, e.wind + 0.1);
    } else if (kind === 'spikes' || kind === 'whip') {
      e.wind = (kind === 'spikes' ? 0.9 : 0.75) * rage; e.ang = toP; e.lx = e.x; e.ly = e.y;
      e.len = kind === 'spikes' ? 720 : 640; e.lw = kind === 'spikes' ? 170 : 150;
      warnLane(e, e.x, e.y, toP, e.len, e.lw, e.wind + 0.1);
    } else if (kind === 'summon') {
      e.wind = 0.8;
    } else if (kind === 'blink') {
      e.wind = 0.3;
    }
  }

  function update(game, e, dt) {
    if (e.dead) return;
    const F = FORM[e.type], p = game.player, world = game.world;
    e.t += dt; e.anim = (e.anim || 0) + dt;
    e.flash = Math.max(0, (e.flash || 0) - dt); e.slow = Math.max(0, (e.slow || 0) - dt); e.show = Math.max(0, (e.show || 0) - dt);
    e.kbx = e.kby = 0;
    if (e.cd === undefined) { e.cd = 1.4; e.summonCd = 10; e.z = 0; }
    if (!e.light || !world.lights.includes(e.light)) { e.light = { x: e.x, y: e.y, r: F.light[0], rgb: F.light[1], flick: Math.random() * 10, owner: e, boss: true }; world.lights.push(e.light); }
    e.light.x = e.x; e.light.y = e.y - F.top * 0.5;
    if (!e.aura) e.aura = aura(e);
    if (e.changing) return change(game, e);
    const alive = p.dead <= 0, dp = NC.dist(e.x, e.y, p.x, p.y), toP = NC.angle(e.x, e.y, p.x, p.y);
    if (!e.raged && e.awake && e.hp < e.maxHp * 0.5) {
      e.raged = true;
      game.shake = Math.max(game.shake, 16);
      zoom(e.x, e.y - 200, 0.07, 0.5);
      say(game, `${e.name} โกรธจัด! (โจมตีถี่ขึ้น แรงขึ้น)`);
    }
    const sp = (e.slow > 0 ? 0.6 : 1) * (e.raged ? 1.25 : 1);
    e.cd -= dt * (e.raged ? 1.4 : 1); e.summonCd -= dt;
    switch (e.state) {
      case 'idle':
        if (alive && dp < NC.MONSTERS[e.type].aggro && !e.online) wake(game, e);
        break;
      case 'roar':
        if (e.t > 1.4) { e.state = 'chase'; e.t = 0; e.cd = 0.6; }
        break;
      case 'chase': {
        if (e.online) break; // (?online: the server walks him and picks his moves)
        if (!e.awake) { wake(game, e); break; }
        const home = NC.dist(e.x, e.y, e.sx, e.sy);
        e.face = Math.cos(toP) > 0 ? 1 : -1;
        if (!alive || home > 1700) { // (it never leaves its spot for long: back to it)
          const a = NC.angle(e.x, e.y, e.sx, e.sy);
          if (home > 40) NC.tryMove(world, e, Math.cos(a) * F.spd * dt, Math.sin(a) * F.spd * dt);
          break;
        }
        if (dp > 240) NC.tryMove(world, e, Math.cos(toP) * F.spd * sp * dt, Math.sin(toP) * F.spd * sp * dt);
        if (e.cd <= 0) pick(game, e, dp);
        break;
      }
      case 'sweep':
        if (e.t >= e.wind && !e.done) {
          e.done = true;
          const x = e.ax, y = e.ay, ang = e.ang, flip = Math.cos(ang) < 0;
          if (NC.MeshFX && NC.MeshFX.ok()) { // a MESH slash (js/meshfx.js): the scythe's arc swept round him in the 3/4 view
            const base = flip ? Math.PI : 0, s = flip ? -1 : 1;
            NC.MeshFX.slash({ x: e.x, y: e.y, h: 120, r: 300, w: 190, tilt: 0.38, a0: base - s * 1.45, a1: base + s * 1.25,
              dur: 0.16, lag: 0.12, life: 0.6, strip: 'strip_violet', tint: [1.1, 0.92, 1.05], dark: true, owner: e });
            fx('glow', 0.42, { x, y, owner: e }, (ctx, q, u) => glow('glow', q.x, q.y - 120, 300, [0.9, 0.4, 0.75], 0.4 * (1 - u), 0.6));
          } else fx('glow', 0.42, { x, y, owner: e }, (ctx, q, u) => { // the crescent sweeps across the zone and fades
            const k = ease(u / 0.5), [w, h] = fit('fx_baph_crescent', 660);
            pic(ctx, 'fx_baph_crescent', q.x, q.y - 120, w * (0.7 + 0.3 * k), h * (0.7 + 0.3 * k), u < 0.55 ? 1 : (1 - u) / 0.45, { flip, rot: (flip ? 1 : -1) * (0.5 - k) * 0.6 });
            glow('glow', q.x, q.y - 120, 300, [0.9, 0.4, 0.75], 0.55 * (1 - u), 0.6);
          });
          sparks(x, y - 110, 18, 'blood', 520, 140);
          game.shake = Math.max(game.shake, 14); zoom(x, y - 80, 0.05, 0.3);
          if (p.dead <= 0 && inEllipse(p.x, p.y, x, y, 330) && hitHero(game, e, 1.6)) push(game, e, 5);
          hurtParty(game, e, x, y, 330, 1.6);
          e.state = 'recover'; e.t = 0; e.rec = 0.7; e.cd = NC.rand(1.1, 1.9);
        }
        break;
      case 'bolts':
      case 'shards': {
        let left = 0;
        for (const s of e.spots) {
          if (s.done) continue;
          left++;
          if (e.t < s.at) continue;
          s.done = true;
          if (e.state === 'bolts') bolt(game, e, s.x, s.y); else shard(game, e, s.x, s.y);
        }
        if (!left) { e.state = 'recover'; e.t = 0; e.rec = 0.5; e.cd = NC.rand(1.3, 2.1); }
        break;
      }
      case 'quake': {
        if (e.t < e.wind) break;
        const u = Math.min(1, (e.t - e.wind) / 0.4);
        e.z = Math.sin(Math.PI * u) * 150;
        if (u >= 1 && !e.done) {
          e.done = true; e.z = 0;
          const x = e.x, y = e.y;
          fx('low', 0.7, { x, y, owner: e }, (ctx, q, uu) => { // the ground breaks outward
            const k = ease(uu / 0.6), [w, h] = fit('fx_baph_quake', 820 * (0.35 + 0.65 * k));
            pic(ctx, 'fx_baph_quake', q.x, q.y, w, h, uu < 0.6 ? 1 : (1 - uu) / 0.4);
            ringGL('low', q.x, q.y, 440 * (0.3 + 0.9 * k), 'blood', 0.4 * (1 - uu), 0.35 + uu * 0.6, 3);
          });
          sparks(x, y - 20, 24, 'blood', 620, 260);
          game.shake = Math.max(game.shake, 24); zoom(x, y - 60, 0.1, 0.4);
          if (p.dead <= 0 && inEllipse(p.x, p.y, x, y, 380) && hitHero(game, e, 1.4)) push(game, e, 7);
          hurtParty(game, e, x, y, 380, 1.4);
          e.state = 'recover'; e.t = 0; e.rec = 0.8; e.cd = NC.rand(1.3, 2.2);
        }
        break;
      }
      case 'spin':
        if (e.t >= e.wind && !e.done) {
          e.done = true;
          const x = e.x, y = e.y;
          fx('low', 0.75, { x, y, owner: e }, (ctx, q, uu) => { // the root scythe spins round him: the ring opens out
            const k = ease(uu / 0.45), [w, h] = fit('fx_baph_ringslash', 860 * (0.55 + 0.45 * k));
            const wob = Math.sin(q.t * 40) * 0.04;
            pic(ctx, 'fx_baph_ringslash', q.x, q.y - 10, w * (1 + wob), h * (1 - wob), uu < 0.6 ? 1 : (1 - uu) / 0.4);
            ringGL('low', q.x, q.y, 430 * (0.5 + 0.5 * k), 'void', 0.45 * (1 - uu), 0.35 + uu * 0.6, 7);
          });
          sparks(x, y - 60, 26, 'void', 700, 120);
          game.shake = Math.max(game.shake, 18); zoom(x, y - 80, 0.07, 0.35);
          if (p.dead <= 0 && inEllipse(p.x, p.y, x, y, 400) && hitHero(game, e, 1.6)) push(game, e, 6);
          hurtParty(game, e, x, y, 400, 1.6);
          e.state = 'recover'; e.t = 0; e.rec = 0.7; e.cd = NC.rand(1.2, 2);
        }
        break;
      case 'spikes':
        if (e.t >= e.wind && !e.done) {
          e.done = true;
          const n = Math.floor(e.len / 100);
          for (let i = 1; i <= n; i++) {
            const d = i * 100, x = e.lx + Math.cos(e.ang) * d, y = e.ly + Math.sin(e.ang) * d * 0.62;
            eruption(x + NC.rand(-20, 20), y + NC.rand(-10, 10), 260 + NC.rand(-30, 30), i * 0.05, e);
          }
          game.shake = Math.max(game.shake, 14); zoom(e.lx + Math.cos(e.ang) * 300, e.ly, 0.05, 0.35);
          if (p.dead <= 0 && inLane(p.x, p.y, e.lx, e.ly, e.ang, e.len, e.lw) && hitHero(game, e, 1.5)) push(game, e, 4);
          if (NC.Party && NC.Party.hurtArea) for (let d = 120; d < e.len; d += 160) hurtParty(game, e, e.lx + Math.cos(e.ang) * d, e.ly + Math.sin(e.ang) * d * 0.62, 110, 1.5);
          e.state = 'recover'; e.t = 0; e.rec = 0.8; e.cd = NC.rand(1.2, 2);
        }
        break;
      case 'whip':
        if (e.t >= e.wind && !e.done) {
          e.done = true;
          const ang = e.ang, ox = e.lx, oy = e.ly, len = e.len;
          fx('glow', 0.5, { x: ox, y: oy, owner: e }, (ctx, q, uu) => { // the root lashes out along the lane
            const k = ease(uu / 0.35);
            ctx.save(); ctx.translate(q.x, q.y - 70); ctx.scale(1, 0.62); ctx.rotate(ang);
            const [w, h] = fit('fx_baph_whip', len * k);
            pic(ctx, 'fx_baph_whip', (len * k) / 2, 0, w, h * 1.4, uu < 0.6 ? 1 : (1 - uu) / 0.4);
            ctx.restore();
            glow('glow', q.x + Math.cos(ang) * len * k * 0.6, q.y - 70 + Math.sin(ang) * len * k * 0.37, 180, [0.85, 0.3, 1], 0.5 * (1 - uu));
          });
          const tx = ox + Math.cos(ang) * len * 0.8, ty = oy + Math.sin(ang) * len * 0.8 * 0.62;
          sparks(tx, ty - 60, 14, 'void', 480, 100);
          game.shake = Math.max(game.shake, 10);
          if (p.dead <= 0 && inLane(p.x, p.y, ox, oy, ang, len, e.lw) && hitHero(game, e, 1.3)) push(game, e, 4);
          hurtParty(game, e, tx, ty, 160, 1.3);
          e.state = 'recover'; e.t = 0; e.rec = 0.55; e.cd = NC.rand(1, 1.8);
        }
        break;
      case 'summon':
        if (e.t >= e.wind && !e.done) {
          e.done = true;
          const [type, n0] = F.minion, n = e.online ? 0 : n0 + (e.raged ? 1 : 0); // (?online: the server's kids)
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + NC.rand(-0.4, 0.4);
            let x = e.x + Math.cos(a) * 200, y = e.y + Math.sin(a) * 125;
            if (!world.fits(x, y, 26)) { x = e.x; y = e.y + 90; }
            if (F.n === 2) eruption(x, y + 6, 170, 0, e); else smoke(x, y, 230, e);
            const m = NC.makeEnemy(type, x, y, Math.max(1, e.lv - 8));
            if (!m) continue;
            m.owner = e; m.state = 'chase'; m.lootless = true;
            game.enemies.push(m);
          }
          e.summonCd = 16;
          e.state = 'recover'; e.t = 0; e.rec = 0.5; e.cd = NC.rand(1, 1.6);
        }
        break;
      case 'blink':
        if (e.t >= e.wind && !e.done) {
          e.done = true;
          smoke(e.x, e.y, 300, e);
          for (let k = 0; k < 24 && !e.online; k++) {
            const a = Math.random() * TAU, d = NC.rand(340, 480), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.62;
            if (world.fits(x, y, 60) && NC.dist(x, y, e.sx, e.sy) < 1500) { e.x = x; e.y = y; break; }
          }
          smoke(e.x, e.y, 320, e);
          e.state = 'recover'; e.t = 0; e.rec = 0.4; e.cd = 0.5;
        }
        break;
      case 'recover':
        if (e.t > e.rec) { e.state = 'chase'; e.t = 0; }
        break;
      default:
        e.state = e.awake ? 'chase' : 'idle';
    }
    e.sort = e.y;
  }

  // a dark bolt: falls from high above onto its spot, cracks the ground there
  function bolt(game, e, x, y) {
    const p = game.player;
    fx('glow', 0.42, { x, y, owner: e }, (ctx, q, u) => {
      const [w, h] = fit('fx_baph_bolt', 260), drop = Math.min(1, u / 0.18);
      ctx.save(); ctx.beginPath(); ctx.rect(q.x - w, q.y - h * 1.6, w * 2, h * 1.6 * drop + 40); ctx.clip(); // (the bolt reaches down)
      pic(ctx, 'fx_baph_bolt', q.x, q.y + 10, w, h * 1.5, u < 0.5 ? 1 : (1 - u) / 0.5, { ay: 1, add: true });
      ctx.restore();
      glow('glow', q.x, q.y - h * 0.6, 120, [1, 0.35, 0.6], 0.6 * (1 - u), 2.4);
    });
    fx('low', 0.6, { x, y, owner: e }, (ctx, q, u) => {
      if (q.t < 0.07) return;
      const [w, h] = fit('fx_baph_impact', 300 * (0.7 + 0.4 * ease(u * 2)));
      pic(ctx, 'fx_baph_impact', q.x, q.y - 10, w, h, u < 0.4 ? 1 : (1 - u) / 0.6);
      ringGL('low', q.x, q.y, 150 * (0.4 + ease(u)), 'blood', 0.7 * (1 - u), u * 0.8, 5);
    });
    sparks(x, y - 20, 10, 'blood', 420, 220);
    game.shake = Math.max(game.shake, 8);
    if (p.dead <= 0 && inEllipse(p.x, p.y, x, y, 125)) hitHero(game, e, 1.1);
    hurtParty(game, e, x, y, 125, 1.1);
  }
  // a crystal shard: falls point first, shatters on the ground
  function shard(game, e, x, y) {
    const p = game.player;
    fx('glow', 0.32, { x, y, owner: e }, (ctx, q, u) => {
      const [w, h] = fit('fx_baph_shard', 80), fall = (1 - u) * 520;
      pic(ctx, 'fx_baph_shard', q.x, q.y - fall, w, h, 1, { ay: 1 });
      glow('glow', q.x, q.y - fall - h * 0.5, 70, [0.85, 0.35, 1], 0.6, 1.6);
    });
    later(0.3, () => {
      fx('low', 0.6, { x, y, owner: e }, (ctx, q, u) => {
        const [w, h] = fit('fx_baph_shatter', 300 * (0.7 + 0.4 * ease(u * 2)));
        pic(ctx, 'fx_baph_shatter', q.x, q.y - 10, w, h, u < 0.4 ? 1 : (1 - u) / 0.6);
        ringGL('low', q.x, q.y, 140 * (0.4 + ease(u)), 'void', 0.65 * (1 - u), u * 0.8, 9);
      });
      fx('glow', 0.35, { x, y }, (ctx, q, u) => starsGL(q.x, q.y - 30, 130 * (0.6 + u), 'void', 0.9 * (1 - u), x));
      sparks(x, y - 20, 10, 'void', 420, 220);
      game.shake = Math.max(game.shake, 7);
      if (p.dead <= 0 && inEllipse(p.x, p.y, x, y, 120)) hitHero(game, e, 1.2);
      hurtParty(game, e, x, y, 120, 1.2);
    });
  }

  // ---------------- the change: the roots take him (form 1 -> form 2) ----------------
  const CHANGE = 3.4, SWAP = 1.7;
  function beginChange(game, e) {
    e.changing = true; e.t = 0; e.state = 'change'; e.hp = 0; e.z = 0; e.raged = false;
    for (const m of game.enemies) if (m.owner === e && !m.dead) { m.hp = 0; m.dead = true; smoke(m.x, m.y, 160); }
    say(game, `${e.name} ล้มลง… แต่รากต้นไม้มืดพุ่งขึ้นจากพื้นเข้าไปในร่างมัน!`, 'level');
    const x = e.x, y = e.y;
    // the Dark Tree's vortex under him (live), roots bursting up round him one by one, then the burst
    fx('low', CHANGE, { x, y, owner: e }, (ctx, q, u) => {
      const k = Math.min(1, q.t / 1.2), out = q.t > SWAP ? Math.max(0, 1 - (q.t - SWAP) / 0.8) : 1;
      if (glOk()) {
        GL.quad('low', q.x, q.y - 10, 330 * k, 200 * k, 0, { shape: GL.SH.vortex, pal: GL.PAL.void, extra: 0, pan: 1.6, ns: 3, a: 0.85 * out, seed: 2 });
        GL.quad('low', q.x, q.y - 10, 330 * k, 200 * k, 0, { shape: GL.SH.vortex, pal: GL.PAL.void, extra: 1, pan: 1.6, ns: 3, a: 0.9 * out, seed: 2, add: true });
      }
      glow('low', q.x, q.y, 380 * k, [0.85, 0.25, 1], 0.4 * out, 0.58);
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.3, r = 240 + (i % 2) * 50;
      eruption(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 280, 0.12 + i * 0.16, e);
    }
    later(SWAP, () => {
      fx('glow', 1.0, { x, y }, (ctx, q, u) => { // the burst as he rises
        const k = GL ? GL.backOut(Math.min(1, u / 0.35), 1.6) : Math.min(1, u / 0.35), [w, h] = fit('fx_baph_burst', 820 * (0.3 + 0.8 * k));
        // (the first try blew the screen white: the painted burst blends normally, the live light stays small)
        pic(ctx, 'fx_baph_burst', q.x, q.y - 200, w, h, u < 0.45 ? 1 : (1 - u) / 0.55);
        starsGL(q.x, q.y - 200, 260 * (0.4 + 0.8 * k), 'void', 0.55 * (1 - u), 5);
        glow('glow', q.x, q.y - 200, 360, [0.8, 0.3, 0.9], 0.3 * (1 - u));
      });
      for (let i = 0; i < 3; i++) later(0.01 + i * 0.12, () => fx('low', 0.8, { x, y }, (ctx, q, u) => ringGL('low', q.x, q.y, 700 * (0.2 + ease(u)), 'void', 0.45 * (1 - u), 0.3 + u * 0.6, i)));
      sparks(x, y - 200, 30, 'void', 800, 300);
      game.shake = Math.max(game.shake, 24); zoom(x, y - 200, 0.1, 0.55);
    });
  }
  function change(game, e) {
    e.face = game.player.x > e.x ? 1 : -1;
    if (e.online) return; // (?online: the server turns him into form 2 under the same id: world.js makes the new mirror)
    if (e.t >= CHANGE && !e.swapped) {
      e.swapped = true;
      const f2 = NC.makeEnemy(ID2, e.x, e.y, e.lv);
      if (!f2) return;
      Object.assign(f2, { sx: e.sx, sy: e.sy, awake: true, state: 'roar', t: 0, face: e.face, worldBoss: e.worldBoss, baphKey: e.baphKey });
      scaleHp(game, f2);
      const i = game.enemies.indexOf(e);
      if (i >= 0) game.enemies.splice(i, 1, f2); else game.enemies.push(f2);
      e.dead = true;
      const L = game.world.lights.indexOf(e.light);
      if (L >= 0) game.world.lights.splice(L, 1);
      say(game, `${f2.name} ลุกขึ้นอีกครั้ง!`, 'level');
    }
  }

  // ---------------- its own end (boss.js's rings and its "comes back in" line are skipped) ----------------
  function ending(game, e) {
    const x = e.x, y = e.y;
    for (const f of FX.list) if (f.owner === e) f.dead = true; // (its warnings and pieces still in the air)
    for (const m of game.enemies) if (m.owner === e && !m.dead) { m.hp = 0; m.dead = true; eruption(m.x, m.y, 150, 0); }
    const L = game.world.lights.indexOf(e.light);
    if (L >= 0) game.world.lights.splice(L, 1);
    fx('glow', 1.3, { x, y }, (ctx, q, u) => {
      const k = Math.min(1, u / 0.3), [w, h] = fit('fx_baph_burst', 900 * (0.4 + 0.7 * k));
      pic(ctx, 'fx_baph_burst', q.x, q.y - 200, w, h, u < 0.4 ? 1 : (1 - u) / 0.6);
      starsGL(q.x, q.y - 200, 300 * (0.5 + k), 'void', 0.55 * (1 - u), 8);
    });
    smoke(x, y, 520);
    sparks(x, y - 160, 50, 'void', 1000, 320);
    game.shake = Math.max(game.shake, 26); zoom(x, y - 160, 0.12, 0.6);
    if (e.online) return; // (?online: the server pays the kill)
    for (let k = 0; k < 3; k++) game.loot.push({ kind: 'loot', potion: k < 2 ? 'red' : 'blue', size: NC.POT ? NC.POT.sizeFor(e.lv) : 's', x: x + NC.rand(-120, 120), y: y + NC.rand(-50, 50), sort: y, t: 0, z: 0, vz: 520 });
    reward(game, e);
  }

  // ---------------- drawing ----------------
  // a soft breathing light under him (live) and, on form 2, the root bosses' painted aura pieces grown to his size
  function aura(e) {
    return fx('low', 1e9, { x: e.x, y: e.y, owner: e }, (ctx, q) => {
      if (e.dead) { q.dead = true; return; }
      const F = FORM[e.type], T = q.t, two = F.n === 2 || (e.changing && e.t > SWAP);
      glow('low', e.x, e.y - 10, 300, F.tint, 0.3 + 0.08 * Math.sin(T * 2.2), 0.5);
      if (two && S('aura_ground')) {
        const G = S('aura_ground'), k = 2.3 * (1 + Math.sin(T * 2) * 0.03);
        pic(ctx, 'aura_ground', e.x, e.y, G.w * k, G.h * k, 0.85);
      }
    });
  }
  function draw(ctx, game, e) {
    const F = FORM[e.type];
    // his body: bent by js/baphrig.js's auto rig (a mesh on the painting), else the plain sprite
    const spr = (name, x, y, o) => { if (!(NC.BaphRig && NC.BaphRig.draw(ctx, e, name, x, y, o))) NC.drawSpr(ctx, name, x, y, o); };
    const tint = e.flash > 0 ? ['#ffffff', 0.7] : e.slow > 0 ? ['#8fd8ff', 0.4] : e.raged ? ['#ff5f7a', 0.08 + 0.06 * Math.sin(e.anim * 6)] : null;
    const winding = e.t < (e.wind || 0);
    const attack = e.state === 'roar' || (!['chase', 'idle', 'recover', 'change'].includes(e.state) && !winding);
    let sx = 1 + Math.sin(e.anim * 2) * 0.012, sy = 1 - Math.sin(e.anim * 2) * 0.012, dx = 0;
    if ((e.state === 'quake' || e.state === 'sweep' || e.state === 'spin') && winding) { const u = Math.min(1, e.t / e.wind); sx += 0.05 * u; sy -= 0.07 * u; }
    if (e.state === 'chase') sy += Math.abs(Math.sin(e.anim * 3.4)) * 0.02;
    const z = e.z || 0;
    NC.drawShadow(ctx, e.x, e.y + 2, 150 - z * 0.25, 38 - z * 0.06, 0.45);
    if (e.changing) { // shaking while the roots climb him; at the burst his new form shows through
      const t = e.t, shake = Math.min(1, t / 1.4) * 7;
      dx = Math.sin(t * 60) * shake;
      const two = Math.max(0, Math.min(1, (t - SWAP) / 0.35));
      if (two < 1) spr('baphomet_b', e.x + dx, e.y, { flip: e.face > 0, sx, sy, tint: ['#9040d0', 0.12 + 0.2 * Math.min(1, t / SWAP)], alpha: 1 - two });
      if (two > 0) spr('baphomet_root_b', e.x + dx, e.y, { flip: e.face > 0, sx, sy, alpha: two });
      return;
    }
    const name = attack && NC.SPR[e.type + '_b'] ? e.type + '_b' : e.type;
    spr(name, e.x + dx, e.y - z, { flip: e.face > 0, sx, sy, tint });
  }

  // ---------------- hooks ----------------
  const mine = (e) => !!(e && FORM[e.type]);
  const baseUpdate = NC.updateEnemy, baseDraw = NC.drawEnemy, baseDamage = NC.damageEnemy;
  NC.updateEnemy = function (game, e, dt) { if (mine(e)) return update(game, e, dt); return baseUpdate.apply(this, arguments); };
  NC.drawEnemy = function (ctx, game, e) { if (mine(e)) return draw(ctx, game, e); return baseDraw.apply(this, arguments); };
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    if (!mine(e)) return baseDamage.apply(this, arguments);
    if (e.changing || e.hp <= 0) return; // (the change: nothing lands)
    if (NC.Auto && NC.Auto.on && r && r.dmg > 0) { // (a world boss is fought by hand, as season.js's)
      if (!e._autoTold) { e._autoTold = 1; NC.HUD.log('บอสโลกต้องตีเอง ปิดออโต้ฟาร์ม (Z) ก่อน', 'warn'); }
      r = Object.assign({}, r, { dmg: 0 });
    }
    if (!e.awake && e.state === 'idle') wake(game, e);
    const F = FORM[e.type], B = NC.BOSSES[e.type];
    // form 1 never dies: below 3% it falls and the change begins (a hit that would take it lower is cut short)
    if (F.n === 1 && r && r.dmg > 0 && e.hp - r.dmg < e.maxHp * 0.03) r = Object.assign({}, r, { dmg: Math.max(0, Math.floor(e.hp - e.maxHp * 0.02)) });
    // (the last blow of form 2: boss.js's own ending - its code-drawn rings and "comes back in N minutes" - is skipped, ours
    // runs below; on every other hit boss.js keeps its say in where the numbers rise)
    const lethal = F.n === 2 && r && !r.miss && r.dmg >= e.hp;
    if (lethal) delete NC.BOSSES[e.type];
    const was = e.hp;
    try { baseDamage.call(this, game, e, r, 0, 0, o); } finally { NC.BOSSES[e.type] = B; }
    if (F.n === 1 && !e.changing && e.hp > 0 && e.hp < e.maxHp * 0.03) beginChange(game, e);
    else if (F.n === 1 && e.hp <= 0) { e.dead = false; e.hp = 1; beginChange(game, e); } // (a multiplier deeper in the chain went past the cut)
    if (F.n === 2 && was > 0 && e.hp <= 0) ending(game, e);
  };
  // the minions never come back, the boss is not respawned by entities.js
  NC.skillTicks && NC.skillTicks.push((game) => {
    for (let i = game.respawns.length - 1; i >= 0; i--) if (FORM[game.respawns[i].type] || KIDS[game.respawns[i].type]) game.respawns.splice(i, 1);
  });

  // ---------------- the world boss: when, where, the reward ----------------
  const KEY = 'nightcamp.baph.v1', MEMONLY = NC.ONLINE;
  const st = (() => { if (MEMONLY) return { done: {} }; try { return Object.assign({ done: {} }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (err) { return { done: {} }; } })();
  const save = () => { if (!MEMONLY) try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (err) { /* blocked */ } };
  const TIMES = [[16, 0], [21, 0]];
  const MAPS = () => ['dark', 'blackroots', 'shadowpath', 'treeedge'].filter((m) => NC.MAPS[m]);
  const dayIdx = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); }; // (the viewer's own day, like the times)
  const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  function slot() {
    const d = new Date(), m = d.getHours() * 60 + d.getMinutes(), maps = MAPS();
    if (!maps.length) return null;
    for (let i = 0; i < TIMES.length; i++) {
      const t = TIMES[i][0] * 60 + TIMES[i][1];
      if (m >= t - 10 && m < t + 20) return { i, soon: m < t, map: maps[(dayIdx() + i) % maps.length], key: 'baph:' + today() + ':' + i };
    }
    return null;
  }
  const others = (game) => (NC.Net && NC.Net.remotes ? [...NC.Net.remotes.values()].filter((r) => r.map === game.mapId).length : 0);
  // (x2 a form, not season.js's x3: two bars, and each hero fights their own copy - a hero at Lv 99 ends both in ~17 min)
  function scaleHp(game, e) { e.maxHp = Math.round(e.maxHp * 2 * (1 + 0.6 * others(game))); e.hp = e.maxHp; }
  function spot(game) { // the middle of a zone that is not a camp, away from the warps
    const def = NC.MAPS[game.mapId] || {}, w = game.world, safe = def.safe || [], warps = def.warps || [];
    const inR = (x, y, q) => x > q[0] && x < q[2] && y > q[1] && y < q[3];
    const zones = (def.zones || []).filter((z) => z.rect && !safe.some((q) => inR((z.rect[0] + z.rect[2]) / 2, (z.rect[1] + z.rect[3]) / 2, q)));
    const z = zones.length ? zones[zones.length > 1 ? 1 : 0] : null;
    const cx = z ? (z.rect[0] + z.rect[2]) / 2 : w.W / 2, cy = z ? (z.rect[1] + z.rect[3]) / 2 : w.H / 2;
    for (let r = 0; r < 1600; r += 40) for (let a = 0; a < TAU; a += 0.3) {
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.7;
      if (w.fits(x, y, 90) && !warps.some((q) => Math.hypot(q.x - x, q.y - y) < 700) && !safe.some((q) => inR(x, y, q))) return [Math.round(x), Math.round(y)];
    }
    return [Math.round(cx), Math.round(cy)];
  }
  function spawn(game, key) {
    const at = spot(game);
    const e = NC.makeEnemy(ID1, at[0], at[1], 99);
    if (!e) return null;
    e.worldBoss = { key, t: 20 * MIN, own: 'baph' }; // (own: season.js leaves its reward and its clock to this file; gradetier.js / ranks.js still see a world boss)
    e.baphKey = key;
    scaleHp(game, e);
    game.enemies.push(e);
    smoke(e.x, e.y, 420);
    st.done[key] = 'up'; save();
    NC.HUD.log(`บอสโลก ${e.name} ปรากฏที่ ${NC.areaLabel ? NC.areaLabel(game.mapId) : game.mapId}!`, 'level');
    if (NC.Chat) NC.Chat.add({ ch: 'sys', kind: 'level', text: `🔔 บอสโลก บาโฟเม็ด ปรากฏแล้ว!` });
    return e;
  }
  function reward(game, e) {
    const p = game.player, c = 100000;
    p.coins += c; if (NC.Econ) NC.Econ.faucet('worldboss', c);
    NC.addMat(game, 'mat_opt_stone', 5); if (Math.random() < 0.5) NC.addMat(game, 'mat_drill_stone', 1);
    NC.addMat(game, 'mat_baph_horn', 1 + (Math.random() < 0.3 ? 1 : 0)); NC.addMat(game, 'mat_baph_heart', 1);
    if (NC.Quests && NC.Quests.state) NC.Quests.state.tokens += 60;
    if (e.baphKey) { st.done[e.baphKey] = 'done'; save(); }
    say(game, `★ ล้มบอสโลก บาโฟเม็ด สำเร็จ! ${NC.fmtCoins ? NC.fmtCoins(c) : c} เหรียญ · หินออฟ 5 · ตราฤดูกาล 60 · เขาและหัวใจรากจ้าวแพะ`, 'level');
    if (NC.Loot) NC.Loot.news(game, `${p.name || 'นักเดินทาง'} ล้มบอสโลก บาโฟเม็ด ได้!`);
  }
  let told = '';
  setInterval(() => {
    const g = NC.game; if (!g || !g.player || !g.world) return;
    if (NC.Baph.server) return; // (?online: the server's schedule, its notices and spawn)
    const w = slot();
    if (!w) return;
    const where = NC.areaLabel ? NC.areaLabel(w.map) : (NC.MAPS[w.map] || {}).name;
    if (w.soon && told !== w.key) {
      told = w.key;
      NC.HUD.log(`อีกไม่ถึง 10 นาที บอสโลก บาโฟเม็ด จะตื่นที่ ${where}`, 'level');
      if (NC.Chat) NC.Chat.add({ ch: 'sys', kind: 'level', text: `🔔 บาโฟเม็ดกำลังจะตื่นที่ ${where}` });
    }
    if (!w.soon && !st.done[w.key] && g.mapId === w.map && !g.enemies.some((e) => mine(e) && !e.dead)) spawn(g, w.key);
  }, 5000);
  NC.skillTicks && NC.skillTicks.push((game, p, dt) => { // 20 minutes for both forms, then it sinks back into the dark
    for (const e of game.enemies) if (mine(e) && !e.dead && !e.changing && e.worldBoss && (e.worldBoss.t -= dt) <= 0) {
      e.dead = true; e.hp = 0; smoke(e.x, e.y, 520);
      for (const m of game.enemies) if (m.owner === e) m.dead = true;
      NC.HUD.log('บาโฟเม็ดกลับเข้าความมืดไปแล้ว', 'warn');
    }
  });
  // the world boss page (season.js's tab) lists its two times
  NC.WorldBossRows = (game, esc) => {
    const now = slot(), maps = MAPS();
    if (!maps.length) return '';
    return TIMES.map(([hh, mm], i) => {
      const map = maps[(dayIdx() + i) % maps.length], key = 'baph:' + today() + ':' + i, on = now && now.i === i;
      const name = NC.areaLabel ? NC.areaLabel(map) : (NC.MAPS[map] || {}).name;
      return `<div class="bb-row ${on ? 'on' : st.done[key] === 'done' ? 'done' : ''}"><img src="${NC.Hub ? NC.Hub.icon('ic_rank') : ''}" alt=""><div class="t">` +
        `<b>${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · บาโฟเม็ด (สองร่าง)</b><small>${esc(name || map)}` +
        `${st.done[key] === 'done' ? ' · ล้มแล้ว ✔' : on ? (now.soon ? ' · ใกล้ตื่นแล้ว' : ' · ตื่นอยู่!') : ''}</small></div>` +
        (on && game.mapId !== map && NC.Econ ? `<button class="kw-btn gold" data-go="${map}">ไปที่นั่น</button>` : '') + '</div>';
    }).join('');
  };

  NC.Baph = { state: st, slot, FORM,
    times: TIMES, // (the PC shop row's บอส badge, js/hudshop.js)
    // (js/online/baph.js drives the server's boss with these)
    update, wake, beginChange, ending, warnAt, warnLane, smoke, server: false };
})();
