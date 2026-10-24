/* jobs3_skills_c.js — the third batch of the new 2nd jobs (the plan "อาชีพใหม่ Night Camp", 2026-09-28):
     นักเชิดหุ่น     a big wooden battle puppet on strings (axe / shield / crossbow: cast it again to rebuild it), threads
                    that hook a monster so it turns on its own kind, steel wires strung as traps;
                    lane หุ่นรบ (the puppet fights, swap places with it) · lane ด้ายสังหาร (wire traps, the bind)
     ผู้จุดตะเกียง   light zones: round the keeper, the flames of the torch, planted torches, glass lamps; friends inside
                    heal, ghosts and the undead inside burn; wider at night and in dungeons;
                    lane คบเพลิง (holy fire up close) · lane โคมแก้ว (lamps that heal an area)
     ผู้เลี้ยงดวงไฟ   up to five spirit wisps circling the shepherd, regrowing every few seconds: sent to latch onto a
                    friend (heals, a shield) or rushed at the enemies;
                    lane ดวงไฟรักษา · lane กระดิ่ง (the attacking wisps)
   The puppet is one of pets.js's summons (it follows, fights, monsters may turn on it); the puppet bar's basic attack
   flicks a thread and the spirit bell's rings a chime (their W.shot, swapped by jobs3_skills_b.js).
   Built with skillkit.js; loaded after jobs3_skills_b.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS;
  const { C, P, TAU } = K;
  const rand = NC.rand, S = K.S, alive = K.alive;
  const r1 = (v) => Math.round(v * 10) / 10;
  const pct = (k) => Math.round(k * 100);
  const lvOf = (p, id) => NC.skillLv(p, id);
  const on = (p, id) => K.buffOn(p, id);
  const roll = (x) => Math.random() * 100 < x;
  const wt = (p) => (NC.wtypeOf ? NC.wtypeOf(NC.weaponDef(p)) : '');
  const isBoss = (e) => !!((NC.BOSSES && NC.BOSSES[e.type]) || e.boss || e.isBoss);
  const isDark = (e) => e && (e.element === 'undead' || e.element === 'ghost' || e.element === 'shadow');
  const shout = (p, text, fill, size) => FX.text(p.x, p.y - 205, text, fill || '#ffe28a', size || 30);
  const castPose = (game, p, lock) => K.pose(game, p, K.clip(p, 'bolt', 0), lock || 0.3);
  const swingPose = (game, p, i, lock) => K.pose(game, p, K.clip(p, 'swing', i || 0), lock || 0.25);
  const heal = (game, who, amount, o) => { if (who && who.hp < who.maxHp && amount > 0) K.heal(game, who, amount, o); };
  const persistent = (type, layer) => { let fx = null; return () => { if (!fx || !FX.list.includes(fx)) fx = FX.add({ type, layer: layer || 'glow', life: 1e9, x: 0, y: 0 }); }; };
  const matk = (p) => (p.d ? (p.d.matk[0] + p.d.matk[1]) / 2 : 0); // (no stats: another player's, replayed as looks by js/net.js)
  const THREAD = '215,195,255', GOLDL = '255,214,130', WISP = '140,255,220';
  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    return Math.hypot(px - ax - dx * u, py - ay - dy * u);
  };
  const nightK = (game) => { // 0 by day, 1 at night (hud.js's dial); a dungeon is always dark
    const hr = (((game.minutes / 60) % 24) + 24) % 24, n = hr < 5.5 || hr >= 19 ? 1 : hr < 7 ? (7 - hr) / 1.5 : hr >= 17.5 ? (hr - 17.5) / 1.5 : 0;
    const M = NC.MAPS && NC.MAPS[game.mapId];
    return M && M.dungeon ? 1 : n;
  };

  // ---------------- the new shots: a thread (the puppet bar), a chime (the spirit bell) ----------------
  FX.def('j3thread', (ctx, q) => {
    const a = Math.atan2(q.vy, q.vx), len = 60;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${THREAD},0.9)`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(q.x - Math.cos(a) * len, q.y - Math.sin(a) * len); ctx.quadraticCurveTo(q.x - Math.cos(a) * len * 0.5 + Math.sin(q.t * 30) * 6, q.y - Math.sin(a) * len * 0.5 - 6, q.x, q.y); ctx.stroke();
    ctx.restore();
    V.glow(ctx, q.x, q.y, 18, THREAD, 0.8, true);
  });
  FX.def('j3chime', (ctx, q) => { // a ring of sound travelling out
    const a = Math.atan2(q.vy, q.vx), s = 0.7 + Math.min(1, q.t * 4) * 0.5;
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(a); ctx.scale(s, s); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(${WISP},${0.8 - i * 0.22})`; ctx.lineWidth = 4 - i; ctx.beginPath(); ctx.arc(-i * 12, 0, 18 + i * 6, -1, 1); ctx.stroke(); }
    ctx.restore();
    V.glow(ctx, q.x, q.y, 26, WISP, 0.6, true);
  });

  // =====================================================================================================
  // นักเชิดหุ่น
  // =====================================================================================================
  const isPP = (p) => p && NC.isJob(p, 'puppeteer');
  const Pets = NC.Pets;
  const BUILDS = ['axe', 'shield', 'xbow'], BUILD_TH = { axe: 'หุ่นขวาน', shield: 'หุ่นโล่', xbow: 'หุ่นหน้าไม้' };
  if (Pets) {
    Pets.KINDS.pp_axe = { a: 'pp_puppet_axe', b: 'pp_puppet_axe', fly: 0, speed: 340, r: 26, reach: 115, solid: true, shadow: [34, 11] };
    Pets.KINDS.pp_shield = { a: 'pp_puppet_shield', b: 'pp_puppet_shield', fly: 0, speed: 320, r: 28, reach: 105, solid: true, shadow: [36, 11] };
    Pets.KINDS.pp_xbow = { a: 'pp_puppet_xbow', b: 'pp_puppet_xbow', fly: 0, speed: 320, r: 26, reach: 430, solid: true, shadow: [34, 11] };
  }
  const puppet = () => (Pets ? Pets.list.find((q) => /^pp_/.test(q.type) && q.dead <= 0) : null);
  const dismissPuppets = (quiet) => { if (Pets) for (const b of BUILDS) Pets.dismiss('pp_' + b, quiet); };
  // the puppeteer's looks, apart so that the online client draws the server's with them (js/online-puppeteer.js)
  const WOOD = ['#6a4a2c', '#c9a270', '#fff2d8'];
  const PP_LOOK = {
    built(q, build) { FX.text(q.x, q.y - 200, BUILD_TH[build], `rgb(${THREAD})`, 28); V.debris(q.x, q.y - 60, 10, ['#6a4a2c', '#a8825a', '#e8d2a8'], { size: 0.8, max: 380, layer: 'glow' }); },
    rebuilt(p) { FX.text(p.x, p.y - 190, 'หุ่นประกอบตัวใหม่!', `rgb(${THREAD})`, 26); },
    slash(q, e) { K.slashAt(e.x, e.y - 50, 80, e.x > q.x ? -0.6 : Math.PI + 0.6, WOOD, '240,220,180', { sweep: 1.5, thick: 26, life: 0.22 }); },
    bolt(game, p, q, e, hit) { // the crossbow's bolt from the puppet's hands at e (hit(f): whatever it strikes first)
      K.shot(game, p, 'pp_puppet', { from: [q.x + (e.x > q.x ? 40 : -40), q.y - 70], ang: NC.angle(q.x, q.y - 70, e.x, e.y - 45), v: 1200, range: 600, r: 26, home: 10, target: e, rgb: '230,220,200',
        look(ctx, s) { K.drawArrow(ctx, s, '230,220,200', 0.8, 90); }, hit });
    },
    spin(q) { K.slashAt(q.x, q.y, 170, 0, WOOD, '240,220,180', { sweep: TAU * 0.95, thick: 30 }); },
    roar(q) { V.ring(q.x, q.y, 20, 300, 10, '255,220,150', 0.5); FX.text(q.x, q.y - 190, 'ยั่วยุ!', '#ffd28a', 26); },
    swap(x0, y0, x1, y1) { // the hero from (x0, y0) to the puppet's (x1, y1)
      V.smoke(x0, y0 - 30, 6, '#6a5a82', '#8a7aa2', { size: 0.8, lifeK: 0.6 });
      V.smoke(x1, y1 - 30, 6, '#6a5a82', '#8a7aa2', { size: 0.8, lifeK: 0.6 });
      FX.add({ type: 'cutline', x: x0, y: y0 - 60, x1, y1: y1 - 60, w: 6, color: THREAD, life: 0.3 });
      FX.text(x1, y1 - 190, 'สลับร่าง!', `rgb(${THREAD})`, 28);
    },
    dance(game, q, i) { K.slashAt(q.x, q.y, 170, i * 2, WOOD, '240,220,180', { sweep: TAU * 0.9, thick: 30, life: 0.28 }); V.shake(game, 3); },
    hook(from, e, boss) { // the thread to a monster taken over (a boss: slowed instead)
      FX.add({ type: 'cutline', x: from[0], y: from[1], x1: e.x, y1: e.y - 60, w: 5, color: THREAD, life: 0.35 });
      FX.text(e.x, NC.labelTop(e) - 90, boss ? 'ช้าลง' : 'ถูกเชิด!', `rgb(${THREAD})`, boss ? 26 : 28);
    },
    charmStrike(t) { V.slash(t.x, t.y - 50, 60, rand(-2, 0), 1.4, 20, ['#4a3a6a', '#b8a0e8', '#ffffff'], 0.2, { rgb: THREAD }); },
    charmBurst(game, x, y) { K.burst(game, x, y, 150, THREAD, { shake: 5, sparks: 10 }); },
    cross(game, x, y) { K.burst(game, x, y, 120, THREAD, { shake: 4, sparks: 10, flare: false }); },
    wireCut(e) { V.sparks(e.x, e.y - 40, 3, THREAD, { size: 0.5, max: 200 }); },
    wire(ctx, w, time) { // one steel wire strung at w.t0 until w.until
      const a = Math.min(1, (time - w.t0) / 0.15) * Math.min(1, (w.until - time) / 0.4);
      ctx.save(); ctx.globalAlpha *= Math.max(0, a);
      ctx.strokeStyle = 'rgba(40,34,56,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w.x0, w.y0); ctx.lineTo(w.x1, w.y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(230,236,250,0.95)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(w.x0, w.y0); ctx.lineTo(w.x1, w.y1); ctx.stroke();
      const s = ((time * 0.8) % 1); // a glint running along the wire
      V.glow(ctx, NC.lerp(w.x0, w.x1, s), NC.lerp(w.y0, w.y1, s), 16, THREAD, 0.9 * a, true);
      for (const [x, y] of [[w.x0, w.y0], [w.x1, w.y1]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fillStyle = '#cfd6e2'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); }
      ctx.restore();
    },
    reel(w, px, py) { FX.add({ type: 'j3wireback', layer: 'high', life: 0.25, w, px, py }); },
    bound(p) { FX.text(p.x, p.y - 190, 'รัด!', `rgb(${THREAD})`, 28); },
  };
  NC.PuppetLooks = PP_LOOK;
  K.def({
    pp_puppet: S({ name: 'สร้างหุ่นรบ', icon: 'sk_pp_puppet', kind: 'buff', type: 'phys', buff: () => ({}), rgb: THREAD, cd: 2, sp: () => 30, mul: (lv) => 0.55 + lv * 0.08,
      desc: (lv, m) => `หุ่นไม้ตัวใหญ่สู้ข้างเราถาวร HP ${60 + lv * 5}% ของ HP สูงสุดเรา ตี ${m}% ของ ATK · กดอีกครั้งเปลี่ยนแบบ: ขวาน (ตีหมู่) → โล่ (ยั่วยุ ทนกว่า) → หน้าไม้ (ยิงไกล)${lv >= 5 ? ' · ได้ท่าพิเศษของแบบนั้น' : ''}${lv >= 10 ? ' · หุ่นร่างใหญ่' : ''}` }),
    pp_strings: S({ name: 'ชักใยหุ่น', icon: 'sk_pp_strings', pass: () => ({}),
      desc: (lv) => `ถือไม้เชิด: ตีปกติสั่งหุ่นฟาดเป้าเดียวกันทันที แรงขึ้น ${lv * 3}%` }),
    pp_swap: S({ name: 'สลับร่างหุ่น', icon: 'sk_pp_swap', max: 5, cd: 6, sp: () => 10, mul: () => 0,
      need: () => (puppet() ? true : 'ยังไม่มีหุ่นรบ'),
      desc: () => 'สลับที่กับหุ่นทันที ศัตรูที่เล็งเราหันไปตีหุ่น' }),
    pp_dance: S({ name: 'ระบำหุ่น', icon: 'sk_pp_dance', cd: 8, sp: () => 22, mul: (lv) => 0.9 + lv * 0.13,
      need: () => (puppet() ? true : 'ยังไม่มีหุ่นรบ'),
      desc: (lv, m) => `หุ่นหมุนตัวฟาดรอบตัว 3 รอบ รอบละ ${m}% ของ ATK` }),
    pp_control: S({ name: 'เชิดมอน', icon: 'sk_pp_control', cd: 20, sp: () => 30, mul: (lv) => 1.2 + lv * 0.15,
      desc: (lv) => `เกี่ยวด้ายเข้ามอน ${lv >= 5 ? 2 : 1} ตัว ${r1(2 + lv * 0.3)} วิ มันหันไปตีพวกเดียวกันด้วยพลังเต็มของมัน · บอสเชิดไม่ได้ แต่ช้าลง 3 วิแทน${lv >= 10 ? ' · มอนที่เชิดตายระหว่างนั้นระเบิดใส่พวกมัน' : ''}` }),
    pp_guide: S({ name: 'ด้ายนำทาง', icon: 'sk_pp_guide', type: 'phys', mul: (lv) => (0.3 + lv * 0.05) / 2, pass: () => ({}),
      desc: (lv) => `ด้ายที่เชื่อมเรากับหุ่นหรือมอนที่เชิด ศัตรูที่ข้ามเส้นด้ายโดนวิละ ${pct(0.3 + lv * 0.05)}% ของ ATK และช้าลง` }),
    pp_soulstring: S({ name: 'เชือกชักวิญญาณ', icon: 'sk_pp_soulstring', max: 5, pass: () => ({}),
      desc: (lv) => `มอนที่เชิดคริได้เท่าเรา${lv >= 3 ? ' · สลับร่างหุ่นแล้ว 2 วิไม่โดนตี' : ''}${lv >= 5 ? ' · หุ่นพังแล้วประกอบใหม่เองใน 5 วิ' : ''}` }),
    pp_edge: S({ name: 'ด้ายคม', icon: 'sk_pp_edge', pass: () => ({}),
      desc: (lv) => `ถือด้ายเหล็ก: ตีปกติสะบัดด้ายไกล 300 ทะลุทั้งแนว แรงขึ้น ${lv * 4}%` }),
    pp_stretch: S({ name: 'ขึงด้ายเหล็ก', icon: 'sk_pp_stretch', cd: 2, sp: () => 12, mul: (lv) => 0.55 + lv * 0.08,
      desc: (lv, m) => `ขึงด้ายจากเราไปจุดที่เล็งยาว 400 นาน 6 วิ ศัตรูที่แตะด้ายโดน ${m}% ของ ATK ทุกครึ่งวิ ขึงได้ ${lv >= 10 ? 5 : 3} เส้น${lv >= 5 ? ' · ด้ายที่ไขว้กันระเบิดตรงจุดตัด' : ''}` }),
    pp_bind: S({ name: 'รัดด้าย', icon: 'sk_pp_bind', cd: 6, sp: () => 18, mul: (lv) => 1.8 + lv * 0.25,
      desc: (lv, m) => `ดึงด้ายทุกเส้นเข้าหาตัว ศัตรูที่ติดด้ายถูกลากมาและรัด 1 วิ ${m}% ของ ATK` }),
    pp_theatre: S({ name: 'โรงละครหุ่นเชิด', icon: 'sk_pp_theatre', ult: true, max: 5, cd: 90, sp: () => 80, mul: (lv) => 0.4 + lv * 0.08,
      desc: (lv, m) => `ด้ายนับร้อยจากฟ้าเกี่ยวศัตรูทุกตัวในวงใหญ่ 6 วิ เดินไม่ได้และโดน ${m}% ของ ATK ทุกวิ มอนธรรมดาหันไปตีกันเอง` }),
  });

  // the puppet: summoned by pets.js; strings to the puppeteer's control bar
  function summonPuppet(game, p, lv, build) {
    dismissPuppets(true);
    p.ppBuild = build;
    const hpK = (0.6 + lv * 0.05) * (build === 'shield' ? 1.5 : 1);
    const q = Pets.summon(game, p, 'pp_' + build, { skill: 'pp_puppet', lv, hp: hpK, scale: lv >= 10 ? 1.15 : 1, name: BUILD_TH[build], glow: THREAD,
      every: build === 'shield' ? 1.3 : build === 'xbow' ? 1.0 : 1.1, act: (g, pet, e) => puppetHit(g, p, pet, e, 1) });
    q.special = game.time + 6;
    q.aura = (ctx, pet, y) => { // the strings: from the control bar (or the hand) down to the head and the hands
      const [hx, hy] = K.tip(p), s = pet.scale;
      ctx.save(); ctx.strokeStyle = `rgba(${THREAD},0.55)`; ctx.lineWidth = 1.4;
      for (const [dx, dy] of [[0, -150], [-28, -95], [26, -95]]) { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + pet.x) / 2, Math.min(hy, y + dy * s) - 40, pet.x + dx * s * (pet.face > 0 ? -1 : 1), y + dy * s); ctx.stroke(); }
      ctx.restore();
    };
    q.onFaint = (g, a) => {
      dismissPuppets();
      NC.HUD.log('หุ่นรบพัง', 'warn');
      if (lvOf(p, 'pp_soulstring') >= 5) V.at(5, () => { if (isPP(p) && !puppet() && p.dead <= 0) { summonPuppet(g, p, lvOf(p, 'pp_puppet') || 1, p.ppBuild || 'axe'); PP_LOOK.rebuilt(p); } });
    };
    return q;
  }
  function puppetHit(game, p, q, e, k) {
    if (!alive(e)) return;
    q.fire = 0.25; q.lunge = 0.2;
    const b = p.ppBuild || 'axe';
    if (b === 'xbow') {
      PP_LOOK.bolt(game, p, q, e, (f) => K.hit(game, p, 'pp_puppet', f, 0, 0, '240,230,210', k));
      return;
    }
    PP_LOOK.slash(q, e);
    if (b === 'axe') for (const f of K.around(game, e.x, e.y, 110)) K.hit(game, p, 'pp_puppet', f, 0, 0, '240,230,210', k);
    else { K.hit(game, p, 'pp_puppet', e, 0, 0, '240,230,210', k * 0.8); e.tgt = q; e.tgtLock = game.time + 3; }
  }
  RUN.pp_puppet = function (game, p, lv) {
    castPose(game, p, 0.35);
    const cur = puppet(), build = cur ? BUILDS[(BUILDS.indexOf(p.ppBuild) + 1) % 3] : p.ppBuild || 'axe';
    const hpF = cur ? cur.hp / cur.maxHp : 1;
    const q = summonPuppet(game, p, lv, build);
    q.hp = Math.max(1, Math.round(q.maxHp * hpF));
    if (!game.presentationOnly) PP_LOOK.built(q, build); // (online the server picks the build and sends its look)
  };
  RUN.pp_swap = function (game, p, lv) {
    const q = puppet();
    if (!q) return;
    const x = p.x, y = p.y;
    PP_LOOK.swap(p.x, p.y, q.x, q.y);
    p.x = q.x; p.y = q.y; q.x = x; q.y = y;
    for (const e of K.around(game, q.x, q.y, 600)) { e.tgt = q; e.tgtLock = game.time + 3; }
    if (lvOf(p, 'pp_soulstring') >= 3) p.inv = Math.max(p.inv, 2);
  };
  RUN.pp_dance = function (game, p, lv) {
    const q = puppet();
    if (!q) return;
    castPose(game, p, 0.25);
    for (let i = 0; i < 3; i++) V.at(i * 0.3, () => {
      if (q.dead > 0) return;
      q.fire = 0.25; q.face = -q.face;
      PP_LOOK.dance(game, q, i);
      for (const e of K.around(game, q.x, q.y, 170)) K.hit(game, p, 'pp_dance', e, 0, 0, '240,230,210');
    });
  };
  // เชิดมอน: the hooked monster turns on its own kind
  const CHARMED = [];
  RUN.pp_control = function (game, p, lv) {
    castPose(game, p, 0.3);
    if (game.presentationOnly) return; // (online the server hooks them and sends each thread: js/online-puppeteer.js)
    const first = K.target(game, p, 650, 300);
    if (!first) return;
    const list = [first];
    if (lv >= 5) { const second = K.nearest(game, first.x, first.y, 400, 3).find((e) => e !== first && !isBoss(e)); if (second) list.push(second); }
    for (const e of list) {
      PP_LOOK.hook(K.tip(p), e, isBoss(e));
      if (isBoss(e)) { K.slow(e, 3); e.slowK = 0.5; continue; }
      e.ppCharm = { until: game.time + 2 + lv * 0.3, acc: 0.6, lv };
      if (!p.remote && !CHARMED.includes(e)) CHARMED.push(e); // (another player's, js/net.js: the thread on a ghost of mine, a look only)
    }
  };
  const monAtk = (e) => (Array.isArray(e.atk) ? rand(e.atk[0], e.atk[1]) : e.atk || 30);
  NC.skillTicks.push((game, p, dt) => {
    for (let i = CHARMED.length - 1; i >= 0; i--) {
      const e = CHARMED[i], c = e.ppCharm;
      if (!c || !alive(e) || game.time > c.until) { if (e.ppCharm) e.ppCharm = null; CHARMED.splice(i, 1); continue; }
      e.stun = Math.max(e.stun || 0, 0.12);
      const t = game.enemies.filter((o) => o !== e && alive(o) && !o.ppCharm).sort((a, b) => NC.dist(a.x, a.y, e.x, e.y) - NC.dist(b.x, b.y, e.x, e.y))[0];
      if (!t) continue;
      const d = NC.dist(e.x, e.y, t.x, t.y);
      if (d > 90 && !e.dummy) { const a = NC.angle(e.x, e.y, t.x, t.y); NC.tryMove(game.world, e, Math.cos(a) * 200 * dt, Math.sin(a) * 140 * dt); }
      if ((c.acc += dt) >= 1 && d < 200) {
        c.acc = 0;
        const crit = lvOf(p, 'pp_soulstring') >= 1 && Math.random() * 100 < (p.d.crit || 0);
        const dmg = Math.max(1, Math.round(monAtk(e) * (crit ? 1.4 : 1)));
        PP_LOOK.charmStrike(t);
        NC.damageEnemy(game, t, { dmg, mod: 1, crit }, 0, 0, { color: THREAD });
      }
    }
    if (!isPP(p)) { if (puppet()) dismissPuppets(true); return; }
    // (the puppet out counts as a running buff: its icon in the buff bar; the auto rotations don't rebuild it)
    if (!p.buffs) p.buffs = {};
    if (!p.buffLv) p.buffLv = {};
    if (puppet()) { p.buffs.pp_puppet = 999; p.buffLv.pp_puppet = lvOf(p, 'pp_puppet') || 1; } else if (p.buffs.pp_puppet > 0) p.buffs.pp_puppet = 0;
    // the puppet's special moves (Lv 5): the axe spins, the shield roars, the crossbow shoots three
    const q = puppet(), lv = lvOf(p, 'pp_puppet');
    if (q && lv >= 5 && game.time > (q.special || 0) && q.target && alive(q.target)) {
      q.special = game.time + 6;
      const b = p.ppBuild;
      if (b === 'axe') { PP_LOOK.spin(q); for (const e of K.around(game, q.x, q.y, 170)) K.hit(game, p, 'pp_puppet', e, 0, 0, '240,230,210', 1.5); }
      else if (b === 'shield') { PP_LOOK.roar(q); for (const e of K.around(game, q.x, q.y, 300)) { e.tgt = q; e.tgtLock = game.time + 4; } }
      else for (let i = 0; i < 3; i++) V.at(i * 0.12, () => puppetHit(game, p, q, q.target, 0.8));
    }
    // ด้ายนำทาง: the threads to the puppet and the hooked monsters cut what crosses them
    const gl = lvOf(p, 'pp_guide');
    if (gl && (p.ppGuideAcc = (p.ppGuideAcc || 0) + dt) >= 0.5) {
      p.ppGuideAcc = 0;
      const [hx, hy] = K.tip(p), ends = [q, ...CHARMED].filter(Boolean);
      for (const end of ends) for (const e of game.enemies) {
        if (!alive(e) || e === end || e.ppCharm) continue;
        if (segDist(e.x, e.y - 40, hx, hy, end.x, end.y - 60) < 24 + e.r) { K.hit(game, p, 'pp_guide', e, 0, 0, THREAD); K.slow(e, 0.6); }
      }
    }
  });
  // the charmed ones' strings; a hooked monster that dies bursts on its friends (Lv 10)
  NC.skillKills.push((game, e) => {
    const p = game.player;
    if (!isPP(p) || !e.ppCharm || (e.ppCharm.lv || 0) < 10) return;
    PP_LOOK.charmBurst(game, e.x, e.y);
    for (const f of K.around(game, e.x, e.y, 150)) K.hit(game, p, 'pp_control', f, 0, 0, THREAD);
  });
  // ชักใยหุ่น: every basic hit (once a swing) sends the puppet at the same monster; ด้ายคม: the wire's flick hits harder
  const once = (game, p, tag) => { const o = p._once4 || (p._once4 = {}); if (o[tag] === game.time) return false; o[tag] = game.time; return true; };
  NC.basicHits.push((game, p, e, r) => {
    if (!game || p !== game.player || !(r.dmg > 0) || !isPP(p)) return;
    const el = lvOf(p, 'pp_edge');
    if (el && wt(p) === 'wire') r.dmg = Math.round(r.dmg * (1 + el * 0.04));
    const sl = lvOf(p, 'pp_strings'), q = puppet();
    if (sl && q && wt(p) === 'puppet' && once(game, p, 'pp') && NC.dist(q.x, q.y, e.x, e.y) < 520) {
      V.at(0.08, () => { if (alive(e) && q.dead <= 0) { if (NC.dist(q.x, q.y, e.x, e.y) > q.T.reach) { q.x += (e.x - q.x) * 0.5; q.y += (e.y - q.y) * 0.5; } puppetHit(game, p, q, e, 1 + sl * 0.03); } });
    }
  });

  // ---- steel wires strung across the ground ----
  const WIRES = [];
  RUN.pp_stretch = function (game, p, lv) {
    swingPose(game, p, 1, 0.25);
    const ang = p.aim, x0 = p.x, y0 = p.y - 30, len = 400, x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len * 0.75;
    const max = lv >= 10 ? 5 : 3;
    const w = { x0, y0, x1, y1, until: game.time + 6, t0: game.time, hit: new Map() };
    // Lv 5: where the new wire crosses an old one, it bursts
    if (lv >= 5) for (const o of WIRES) {
      const X = crossing(w, o);
      if (!X) continue;
      PP_LOOK.cross(game, X[0], X[1] + 30);
      for (const e of K.around(game, X[0], X[1] + 30, 120)) K.hit(game, p, 'pp_stretch', e, 0, 0, THREAD, 1.5);
    }
    if (!game.presentationOnly) { // (online the server strings the wires and sends them: js/online-puppeteer.js)
      WIRES.push(w);
      while (WIRES.length > max) WIRES.shift();
      if (isPP(p)) ensureWires(); // (the wires drawer lasts: only a puppeteer's; the FX capture's hero has no job)
    }
    V.sparks(x1, y1, 6, THREAD, { size: 0.6 });
  };
  function crossing(a, b) {
    const d = (a.x1 - a.x0) * (b.y1 - b.y0) - (a.y1 - a.y0) * (b.x1 - b.x0);
    if (Math.abs(d) < 1e-6) return null;
    const u = ((b.x0 - a.x0) * (b.y1 - b.y0) - (b.y0 - a.y0) * (b.x1 - b.x0)) / d, v = ((b.x0 - a.x0) * (a.y1 - a.y0) - (b.y0 - a.y0) * (a.x1 - a.x0)) / d;
    return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? [a.x0 + (a.x1 - a.x0) * u, a.y0 + (a.y1 - a.y0) * u] : null;
  }
  RUN.pp_bind = function (game, p, lv) {
    castPose(game, p, 0.3);
    const got = new Set();
    for (const w of WIRES) for (const e of game.enemies) if (alive(e) && segDist(e.x, e.y - 30, w.x0, w.y0, w.x1, w.y1) < 60 + e.r) got.add(e);
    for (const w of WIRES.splice(0)) PP_LOOK.reel(w, p.x, p.y - 60);
    for (const e of got) {
      if (!isBoss(e)) K.pull(e, p.x, p.y, 700);
      NC.statusEnemy(game, e, 'stun', 1);
      V.at(0.12, () => K.hit(game, p, 'pp_bind', e, 0, 0, THREAD));
    }
    if (got.size) PP_LOOK.bound(p);
  };
  FX.def('j3wireback', (ctx, q, u) => { // the wires reeled back in
    const w = q.w, k = 1 - u;
    ctx.save(); ctx.strokeStyle = `rgba(${THREAD},${0.9 * k})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(NC.lerp(q.px, w.x0, k), NC.lerp(q.py, w.y0, k)); ctx.lineTo(NC.lerp(q.px, w.x1, k), NC.lerp(q.py, w.y1, k)); ctx.stroke();
    ctx.restore();
  }, 'high');
  const ensureWires = persistent('j3wires', 'high');
  FX.def('j3wires', (ctx) => {
    const G = NC.game;
    if (!G) return;
    for (const w of WIRES) PP_LOOK.wire(ctx, w, G.time);
  });
  NC.skillTicks.push((game, p) => {
    for (let i = WIRES.length - 1; i >= 0; i--) {
      const w = WIRES[i];
      if (game.time > w.until || !isPP(p)) { WIRES.splice(i, 1); continue; }
      for (const e of game.enemies) {
        if (!alive(e) || segDist(e.x, e.y - 30, w.x0, w.y0, w.x1, w.y1) > 24 + e.r) continue;
        if (game.time - (w.hit.get(e) || -9) < 0.5) continue;
        w.hit.set(e, game.time);
        K.hit(game, p, 'pp_stretch', e, 0, 0, THREAD);
        PP_LOOK.wireCut(e);
      }
    }
  });
  // the ultimate: the puppet theatre
  RUN.pp_theatre = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.5);
    const [cx, cy] = K.ground(game, p, 300), R = 420;
    shout(p, 'โรงละครหุ่นเชิด!', `rgb(${THREAD})`, 34);
    V.flash('200,170,255', 0.12, 0.3);
    let acc = 0;
    FX.add({ type: 'j3theatre', layer: 'glow', life: 6, x: cx, y: cy, R,
      update(q, dt) {
        const got = K.around(game, cx, cy, R);
        for (const e of got) { e.stun = Math.max(e.stun || 0, 0.15); e.kbx *= 0.5; e.kby *= 0.5; }
        q.got = got;
        if ((acc += dt) >= 1) {
          acc -= 1;
          for (const e of got) {
            K.hit(game, p, 'pp_theatre', e, 0, 0, THREAD);
            if (!isBoss(e)) { const t = got.filter((o) => o !== e).sort((a, b) => NC.dist(a.x, a.y, e.x, e.y) - NC.dist(b.x, b.y, e.x, e.y))[0]; if (t) NC.damageEnemy(game, t, { dmg: Math.max(1, Math.round(monAtk(e))), mod: 1 }, 0, 0, { color: THREAD }); }
          }
        }
      } });
    V.light(cx, cy - 60, R * 2, '200,170,255', 0.8, 6);
  };
  FX.def('j3theatre', (ctx, q, u) => {
    const a = Math.min(1, q.t / 0.3) * (u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1);
    ctx.save(); ctx.globalAlpha *= a;
    ctx.strokeStyle = `rgba(${THREAD},0.65)`; ctx.lineWidth = 1.5;
    for (const e of q.got || []) for (const dx of [-14, 0, 14]) { ctx.beginPath(); ctx.moveTo(e.x + dx * 3, e.y - 700); ctx.lineTo(e.x + dx, e.y - 70 + Math.abs(dx)); ctx.stroke(); }
    ctx.restore();
    V.glow(ctx, q.x, q.y - 40, q.R, '180,150,255', 0.15 * a, true);
  });

  // =====================================================================================================
  // ผู้จุดตะเกียง: light zones
  // =====================================================================================================
  const isLK = (p) => p && NC.isJob(p, 'lightkeeper');
  const ZONES = []; // { x, y, r, until, kind: 'flame' | 'torch' | 'lamp', t0 } (mine: the tick below heals and burns with them)
  // a keeper's zones: mine, or another player's (their cast replayed by js/net.js) in their own list: looks only, never
  // in my light, never burst by their flare
  function zonesFor(game, p) {
    if (!p || !p.remote) return ZONES;
    const L = p.lkZones || (p.lkZones = []);
    for (let i = L.length - 1; i >= 0; i--) if (game.time > L[i].until) L.splice(i, 1);
    return L;
  }
  K.def({
    lk_radiance: S({ name: 'รัศมีแสง', icon: 'sk_lk_radiance', type: 'magic', element: 'holy', mul: (lv) => (0.2 + lv * 0.03) / 2, pass: () => ({}),
      desc: (lv) => `รอบตัวเป็นเขตแสงรัศมี ${200 + lv * 10} พวกเราในแสงฟื้น HP ${r1(lv * 0.5)}% ทุก 5 วิ ผีและอมตะในแสงโดนเผาวิละ ${pct(0.2 + lv * 0.03)}% ของ MATK · กลางคืนและในดันเจี้ยนแสงกว้างขึ้น 30%` }),
    lk_flash: S({ name: 'แสงไล่เงา', icon: 'sk_lk_flash', type: 'magic', element: 'holy', cd: 6, sp: () => 18, mul: (lv) => 0.9 + lv * 0.14,
      desc: (lv, m) => `แสงวาบรัศมี 300 ศัตรูโดน ${m}% ของ MATK ธาตุแสง ผีและอมตะมึน 1 วิ` }),
    lk_lighthouse: S({ name: 'ประภาคาร', icon: 'sk_lk_lighthouse', max: 5, pass: () => ({}),
      desc: (lv) => `แสงของเราสว่างขึ้น (ฮีลและเผาในแสง +20%)${lv >= 3 ? ' · ยืนนิ่ง 2 วิ เขตแสงกว้างขึ้นอีก 50%' : ''}${lv >= 5 ? ' · ล้มในเขตแสงของตัวเองแล้วลุกทันทีด้วย HP 20% (ทุก 5 นาที)' : ''}` }),
    lk_torchmastery: S({ name: 'ชำนาญคบเพลิง', icon: 'sk_lk_torchmastery', pass: () => ({}),
      desc: (lv) => `ถือคบเพลิง: ตีปกติเป็นไฟศักดิ์สิทธิ์ แรงขึ้น ${lv * 3}% ติดเผา 4% แรงกับผีและอมตะอีก 20%` }),
    lk_swing: S({ name: 'ฟาดเปลวไฟ', icon: 'sk_lk_swing', free: 1, element: 'fire', cd: 3, sp: () => 14, mul: (lv) => 1.8 + lv * 0.28,
      desc: (lv, m) => `ฟาดคบเพลิงเป็นวงข้างหน้า ${m}% ของ ATK ธาตุไฟ ทิ้งเปลวไฟที่พื้น 3 วิ (เป็นเขตแสงด้วย)` }),
    lk_plant: S({ name: 'ปักคบเพลิง', icon: 'sk_lk_plant', max: 5, type: 'magic', element: 'fire', cd: 12, sp: () => 20, mul: (lv) => 0.4 + lv * 0.08,
      desc: (lv, m) => `ปักคบเพลิงสำรองลงพื้น 20 วิ เป็นเขตแสงรัศมี 250 เผาศัตรูที่เข้าใกล้ทุกครึ่งวิ ${m}% ของ MATK ปักได้ 2 อัน` }),
    lk_faith: S({ name: 'ไฟศรัทธา', icon: 'sk_lk_faith', kind: 'buff', cd: 30, sp: () => 25, rgb: GOLDL, enchant: 'holy', dur: () => 30,
      buff: (lv) => ({ vsDark: lv * 2, atk: lv }), party: () => ({ atk: 1.1 }),
      desc: (lv) => `30 วิ: อาวุธเราเป็นธาตุแสง ATK +${lv}% ตีผีและอมตะแรงขึ้นอีก ${lv * 2}% · เพื่อนรอบตัวตีแรงขึ้น 10%` }),
    lk_lamp: S({ name: 'วางโคมแก้ว', icon: 'sk_lk_lamp', free: 1, cd: 2, sp: () => 20, mul: () => 0, heal: (lv) => 0.25 + lv * 0.04,
      desc: (lv) => `วางโคมแก้วที่พื้นได้ ${lv >= 5 ? 4 : 3} ดวง อยู่ 25 วิ (ถือคทา 35 วิ) แต่ละดวงเป็นเขตแสงรัศมี 220 ฮีลพวกเราในแสงวิละ ${pct(0.25 + lv * 0.04)}% ของ MATK${lv >= 10 ? ' · โคมลอยตามเพื่อนที่ใกล้ที่สุด' : ''}` }),
    lk_flare: S({ name: 'โคมเรืองรอง', icon: 'sk_lk_flare', cd: 10, sp: () => 35, mul: () => 0, heal: (lv) => 1.5 + lv * 0.2,
      desc: (lv) => `โคมทุกดวงสว่างวาบ ฮีลทุกคนในแสงของโคม ${pct(1.5 + lv * 0.2)}% ของ MATK ทันที และล้างพิษ` }),
    lk_wick: S({ name: 'ไส้ตะเกียงอย่างดี', icon: 'sk_lk_wick', pass: (lv) => ({ heal: lv * 2, spReg: lv * 3 }),
      desc: (lv) => `ฮีลทุกแบบแรงขึ้น ${lv * 2}% ฟื้น SP เร็วขึ้น ${lv * 3}%` }),
    lk_dawn: S({ name: 'รุ่งอรุณ', icon: 'sk_lk_dawn', ult: true, max: 5, type: 'magic', element: 'holy', cd: 90, sp: () => 90, mul: (lv) => (0.8 + lv * 0.15) / 2,
      desc: (lv) => `ทั้งจอสว่างเหมือนกลางวัน 10 วิ ทุกคนในทีมอยู่ในเขตแสงตลอด ฮีลแรงขึ้น 50% ผีกับอมตะทั้งจอโดนเผาวิละ ${pct(0.8 + lv * 0.15)}% ของ MATK` }),
  });
  const auraR = (game, p) => (200 + lvOf(p, 'lk_radiance') * 10) * (1 + 0.3 * nightK(game)) * (lvOf(p, 'lk_lighthouse') >= 3 && game.time - (p.lkMovedT || 0) >= 2 ? 1.5 : 1);
  // every zone the keeper has now (the aura included), and whether (x, y) is in the light
  function zonesOf(game, p) {
    const out = [];
    if (lvOf(p, 'lk_radiance')) out.push({ x: p.x, y: p.y, r: auraR(game, p), kind: 'aura' });
    for (const z of zonesFor(game, p)) out.push(z);
    return out;
  }
  const inLight = (game, p, x, y, zs) => (p.lkDawn > game.time) || (zs || zonesOf(game, p)).some((z) => NC.dist(x, y, z.x, z.y) < z.r);
  NC.lightZones = zonesOf;
  function addZone(game, z) {
    const L = (z.list = zonesFor(game, game.player));
    z.t0 = game.time;
    L.push(z);
    z.light = V.light(z.x, z.y - 40, z.r * 2.2, z.kind === 'lamp' ? '255,220,150' : '255,190,110', 0.8, z.until - game.time, { flick: z.kind !== 'lamp' });
    if (L !== ZONES && z.kind !== 'flame') z.obj = FX.add({ type: 'j3lampobj', layer: 'sorted', life: z.until - game.time, x: z.x, y: z.y, sort: z.y, z }); // (theirs: no tick)
    if (L !== ZONES || isLK(game.player)) ensureZones(); // (the zones drawer lasts: a lightkeeper's or another player's; the FX capture's hero has no job)
  }
  RUN.lk_flash = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.3);
    V.flash('255,240,200', 0.1, 0.2);
    K.nova(game, p, 'lk_flash', p.x, p.y, 300, { rgb: GOLDL, color: '255,236,170', shake: 3, stars: 8, starFill: '#fff6d0',
      each(e, r) { if (r && !r.miss && isDark(e)) NC.statusEnemy(game, e, 'stun', 1); } });
    V.beam(p.x, p.y, 120, 400, GOLDL, 0.3);
  };
  RUN.lk_swing = function (game, p, lv) {
    swingPose(game, p, 1, 0.3);
    const ang = p.aim, cx = p.x + Math.cos(ang) * 90, cy = p.y + Math.sin(ang) * 60;
    K.slashAt(cx, cy - 40, 120, ang - 1, P.fire, '255,170,90', { sweep: 2, thick: 34, life: 0.28 });
    K.cone(game, p, 'lk_swing', 190, 0.9, { kb: 180, color: '255,190,120' });
    K.flames(cx, cy, 8, 60);
    addZone(game, { x: cx, y: cy, r: 110, until: game.time + 3, kind: 'flame', burn: 'lk_swing', burnK: 0.2 });
  };
  RUN.lk_plant = function (game, p, lv) {
    swingPose(game, p, 0, 0.3);
    const x = p.x + Math.cos(p.aim) * 110, y = p.y + Math.sin(p.aim) * 70;
    const L = zonesFor(game, p), mine = L.filter((z) => z.kind === 'torch');
    if (mine.length >= 2) L.splice(L.indexOf(mine[0]), 1);
    addZone(game, { x, y, r: 250, until: game.time + 20, kind: 'torch', burn: 'lk_plant', burnK: 1 });
    V.debris(x, y - 10, 8, P.rock, { size: 0.7, max: 300, layer: 'glow' });
    K.flames(x, y - 100, 5, 20);
  };
  RUN.lk_lamp = function (game, p, lv) {
    castPose(game, p, 0.25);
    const [x, y] = K.ground(game, p, 320), max = lv >= 5 ? 4 : 3;
    const L = zonesFor(game, p), lamps = L.filter((z) => z.kind === 'lamp');
    if (lamps.length >= max) L.splice(L.indexOf(lamps[0]), 1);
    addZone(game, { x, y, r: 220, until: game.time + (NC.weaponBonus && NC.weaponBonus(p, 'lk_lamp') ? 35 : 25), kind: 'lamp', lv, follow: lv >= 10 });
    V.ring(x, y, 10, 120, 6, GOLDL, 0.35);
  };
  RUN.lk_flare = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.3);
    const lamps = zonesFor(game, p).filter((z) => z.kind === 'lamp');
    const amt = matk(p) * (1.5 + lv * 0.2) * K.healPow(p) * (p.lkDawn > game.time ? 1.5 : 1);
    const team = [p, ...K.friends(game, p, 900)];
    for (const z of lamps) LK_LOOKS.flare(game, z);
    if (p.remote) return; // (another player's: the bursts only)
    for (const a of team) if (lamps.some((z) => NC.dist(a.x, a.y, z.x, z.y) < z.r)) { heal(game, a, amt); if (a.poison) a.poison = null; }
    if (!lamps.length && !game.presentationOnly) LK_LOOKS.noLamps(p); // (online the server's flare event says so)
  };
  RUN.lk_dawn = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.5);
    p.lkDawn = game.time + 10;
    shout(p, 'รุ่งอรุณ!', '#fff0b0', 36);
    V.flash('255,240,200', 0.3, 0.6);
    V.light(p.x, p.y - 60, 2400, '255,236,190', 1, 10, { follow: p });
    FX.add({ type: 'j3dawn', layer: 'glow', life: 10, x: p.x, y: p.y });
  };
  FX.def('j3dawn', (ctx, q, u) => { // a warm wash over the whole view
    const G = NC.game;
    if (!G) return;
    const a = Math.min(1, q.t / 0.8) * (u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1), p = G.player;
    V.glow(ctx, p.x, p.y - 100, 1400, '255,230,170', 0.16 * a, true);
  });
  // the zones' looks, js/online-lightkeeper.js's too: a zone's glow on the ground, the lamp or torch standing on it, a
  // lamp's flare, the flare with no lamp, the lighthouse raising the keeper
  const LK_LOOKS = (NC.LightkeeperLooks = {
    ground(ctx, z, time) {
      const a = z.kind === 'aura' ? 0.13 : 0.2, rgb = z.kind === 'lamp' ? '255,225,150' : z.kind === 'aura' ? '255,236,190' : '255,190,110';
      ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, V.SQ || 0.62);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, z.r);
      g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.75, `rgba(${rgb},${a * 0.6})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${rgb},0.35)`; ctx.lineWidth = 3; ctx.setLineDash([10, 12]); ctx.lineDashOffset = -time * 20; ctx.beginPath(); ctx.arc(0, 0, z.r * 0.98, 0, TAU); ctx.stroke();
      ctx.restore();
    },
    object(ctx, z, time) {
      const name = z.kind === 'lamp' ? 'lk_lamp' : 'lk_torch';
      if (!NC.SPR[name]) return;
      const bob = z.kind === 'lamp' && z.follow ? Math.sin(time * 3) * 6 : 0;
      NC.drawSpr(ctx, name, z.x, z.y + bob, {});
      V.glow(ctx, z.x, z.y - (z.kind === 'lamp' ? 30 : 95), 70, z.kind === 'lamp' ? '255,220,150' : '255,190,110', 0.55 + 0.1 * Math.sin(time * 9), true);
    },
    flare(game, z) { K.burst(game, z.x, z.y, z.r, GOLDL, { shake: 2, flare: true, sparks: 10 }); },
    noLamps(p) { FX.text(p.x, p.y - 190, 'ยังไม่มีโคม', '#ffe6b0', 24); },
    rise(p) { shout(p, 'แสงนำทางกลับ!', '#fff0b0', 32); V.beam(p.x, p.y, 140, 600, GOLDL, 0.5); },
  });
  // the zones: drawn on the ground, the lamp and torch themselves standing among the characters
  const ensureZones = persistent('j3zones', 'low');
  FX.def('j3zones', (ctx) => {
    const G = NC.game, p = G && G.player;
    if (!G || !isLK(p)) return;
    for (const z of zonesOf(G, p)) LK_LOOKS.ground(ctx, z, G.time);
  });
  FX.def('j3lampobj', (ctx, q) => {
    if (!(q.z.list || ZONES).includes(q.z)) { q.dead = true; return; } // (replaced by a newer one)
    LK_LOOKS.object(ctx, q.z, NC.game.time);
  }, 'sorted');
  // every 0.5 s: heal in the light, burn the dark ones, the planted torches and flames burn everyone near
  NC.skillTicks.push((game, p, dt) => {
    if (!isLK(p)) { if (ZONES.length) ZONES.length = 0; return; }
    if (Math.hypot(p.vx || 0, p.vy || 0) > 20 || p.moving) p.lkMovedT = game.time;
    for (let i = ZONES.length - 1; i >= 0; i--) {
      const z = ZONES[i];
      if (game.time > z.until) { ZONES.splice(i, 1); continue; }
      if ((z.kind === 'lamp' || z.kind === 'torch') && !z.obj) z.obj = FX.add({ type: 'j3lampobj', layer: 'sorted', life: z.until - game.time, x: z.x, y: z.y, sort: z.y, z });
      if (z.obj) { z.obj.x = z.x; z.obj.y = z.y; z.obj.sort = z.y; }
      if (z.follow) { const f = K.friends(game, p, 700)[0]; if (f) { z.x += (f.x - z.x) * Math.min(1, dt * 2); z.y += (f.y + 20 - z.y) * Math.min(1, dt * 2); } }
    }
    if ((p.lkAcc = (p.lkAcc || 0) + dt) < 0.5) return;
    p.lkAcc -= 0.5;
    const zs = zonesOf(game, p), team = [p, ...K.friends(game, p, 900)], boost = (lvOf(p, 'lk_lighthouse') ? 1.2 : 1) * (p.lkDawn > game.time ? 1.5 : 1);
    // healing: the aura's regeneration (per 5 s, dealt out every half second), the lamps' MATK heal
    const rl = lvOf(p, 'lk_radiance');
    for (const a of team) {
      const lit = inLight(game, p, a.x, a.y, zs);
      if (!lit) continue;
      let amt = rl ? a.maxHp * (rl * 0.005) * 0.1 : 0;
      for (const z of zs) if (z.kind === 'lamp' && NC.dist(a.x, a.y, z.x, z.y) < z.r) amt += matk(p) * (0.25 + (z.lv || 1) * 0.04) * 0.5 * K.healPow(p);
      heal(game, a, amt * boost, { quiet: amt < a.maxHp * 0.03 });
    }
    // burning: the dark ones in any light; everyone by a planted torch or on the flames
    for (const e of game.enemies) {
      if (!alive(e)) continue;
      if (rl && isDark(e) && inLight(game, p, e.x, e.y, zs)) K.hit(game, p, 'lk_radiance', e, 0, 0, '255,236,170', boost);
      for (const z of ZONES) if (z.burn && NC.dist(e.x, e.y, z.x, z.y) < z.r * (z.kind === 'torch' ? 1 : 0.9)) { K.hit(game, p, z.burn, e, 0, 0, '255,190,120', z.burnK); if (Math.random() < 0.15) NC.addStatus(game, e, 'burn'); }
      if (p.lkDawn > game.time && isDark(e) && NC.dist(e.x, e.y, p.x, p.y) < 1000) K.hit(game, p, 'lk_dawn', e, 0, 0, '255,236,170');
    }
  });
  // the torch's holy fire on the basic hits
  NC.basicHits.push((game, p, e, r) => {
    if (!game || p !== game.player || !(r.dmg > 0) || !isLK(p) || wt(p) !== 'torch') return;
    const tl = lvOf(p, 'lk_torchmastery');
    if (!tl) return;
    r.dmg = Math.round(r.dmg * (1 + tl * 0.03) * (isDark(e) ? 1.2 : 1));
    if (roll(4)) NC.addStatus(game, e, 'burn');
  });
  // ประภาคาร Lv 5: falling inside our own light, we stand up again at once
  NC.heroGuards.push((game, p, dmg) => {
    if (!isLK(p) || lvOf(p, 'lk_lighthouse') < 5 || dmg < p.hp || game.time < (p.lkReviveCd || 0) || !inLight(game, p, p.x, p.y)) return dmg;
    p.lkReviveCd = game.time + 300;
    p.hp = Math.round(p.maxHp * 0.2); p.inv = 1.5;
    LK_LOOKS.rise(p);
    return 0;
  });

  // =====================================================================================================
  // ผู้เลี้ยงดวงไฟ: wisps
  // =====================================================================================================
  const isWS = (p) => p && NC.isJob(p, 'wisp');
  const wispMax = (p) => Math.min(5, 1 + Math.floor(lvOf(p, 'ws_flock') / 2));
  K.def({
    ws_flock: S({ name: 'เลี้ยงดวงไฟ', icon: 'sk_ws_flock', free: 1, pass: () => ({}),
      desc: (lv) => `ดวงไฟวิญญาณลอยรอบตัว ${Math.min(5, 1 + Math.floor(lv / 2))} ดวง ดวงที่ใช้ไปเกิดใหม่ทุก ${lv >= 5 ? 3 : 4} วิ แรงตาม MATK${lv >= 10 ? ' · ส่องทางในความมืด' : ''}` }),
    ws_swarm: S({ name: 'ฝูงหิ่งห้อย', icon: 'sk_ws_swarm', type: 'magic', mul: (lv) => 0.2 + lv * 0.045, pass: () => ({}),
      desc: (lv) => `ดวงไฟที่ลอยรอบตัวยิงศัตรูใกล้ ๆ เอง ดวงละ ${pct(0.2 + lv * 0.045)}% ของ MATK ทุก 1.6 วิ` }),
    ws_swift: S({ name: 'ดวงไฟเร็ว', icon: 'sk_ws_swift', pass: () => ({}), desc: (lv) => `ดวงไฟเกิดใหม่และพุ่งเร็วขึ้น ${lv * 3}%` }),
    ws_heart: S({ name: 'ใจดวงไฟ', icon: 'sk_ws_heart', max: 5, pass: () => ({}),
      desc: (lv) => `เกาะเพื่อนได้คนละ 2 ดวง${lv >= 3 ? ' · ดวงไฟที่แตกทิ้งแสงฮีลรอบ ๆ' : ''}${lv >= 5 ? ' · ดวงไฟครบ 5 ดวงรวมเป็นดวงใหญ่ ฝูงดวงไฟพุ่งแรง ×1.5' : ''}` }),
    ws_latch: S({ name: 'ส่งดวงไฟเกาะ', icon: 'sk_ws_latch', free: 1, cd: 1, sp: () => 12, mul: () => 0, heal: (lv) => 0.15 + lv * 0.03,
      need: (game, p) => ((p.wsOrbit || 0) > 0 ? true : 'ไม่มีดวงไฟเหลือ'),
      desc: (lv) => `ส่งดวงไฟ 1 ดวงไปเกาะเพื่อนที่เลือดน้อยที่สุด (หรือตัวเอง) 20 วิ (ถือคทา 30 วิ) ฮีลวิละ ${pct(0.15 + lv * 0.03)}% ของ MATK` }),
    ws_embrace: S({ name: 'ดวงไฟโอบกาย', icon: 'sk_ws_embrace', cd: 12, sp: () => 20, mul: () => 0,
      desc: (lv) => `ดวงไฟที่เกาะอยู่กลายเป็นโล่ ดูดซับดาเมจดวงละ ${pct(1 + lv * 0.15)}% ของ MATK · อยู่จนดวงไฟที่เกาะหมดเวลา (20 วิ ถือคทา 30 วิ) ดูดซับครบ หรือใช้ดวงไฟแตกฮีล · ดูเวลาที่แถวบัฟ` }),
    ws_burst: S({ name: 'ดวงไฟแตกฮีล', icon: 'sk_ws_burst', cd: 10, sp: () => 30, mul: () => 0, heal: (lv) => 1.2 + lv * 0.2,
      desc: (lv) => `ดวงไฟทุกดวงที่เกาะอยู่แตกพร้อมกัน ฮีลทันที ${pct(1.2 + lv * 0.2)}% ของ MATK รอบตัวคนนั้น` }),
    ws_call: S({ name: 'เสียงเรียกดวงไฟ', icon: 'sk_ws_call', type: 'magic', mul: (lv) => 0.6 + lv * 0.08, pass: () => ({}),
      desc: (lv) => `ถือกระดิ่ง: ตีปกติเป็นคลื่นเสียง ทุก 0.8 วิ ดวงไฟ 1 ดวงพุ่งใส่เป้าที่ตีโดน ${pct(0.6 + lv * 0.08)}% ของ MATK (ดวงไฟไม่หมด ยังลอยรอบตัวเท่าเดิม)` }),
    ws_rush: S({ name: 'ฝูงดวงไฟพุ่ง', icon: 'sk_ws_rush', type: 'magic', cd: 5, sp: () => 20, mul: (lv) => 0.9 + lv * 0.13,
      need: (game, p) => ((p.wsOrbit || 0) > 0 ? true : 'ไม่มีดวงไฟเหลือ'),
      desc: (lv, m) => `ดวงไฟทุกดวงพุ่งรุมเป้า ดวงละ ${m}% ของ MATK ระเบิดเป็นวงเล็ก${lv >= 10 ? ' · ดวงไฟครึ่งหนึ่งเกิดใหม่ทันที' : ''}` }),
    // (2026-10-20 Discord #67: "ทุกเลเวลค่าเท่าเดิม": 40% at every level, now +5% a level; server patch 020 ws_mark_levels.go)
    ws_mark: S({ name: 'ดวงไฟติดศัตรู', icon: 'sk_ws_mark', max: 5, type: 'magic', cd: 8, sp: () => 15, mul: (lv) => (35 + 5 * lv) / 100,
      desc: (lv, m) => `แปะดวงไฟไว้บนศัตรู 6 วิ ทุกครั้งที่ตีมัน ดวงไฟระเบิดเพิ่ม ${m}% ของ MATK` }),
    ws_night: S({ name: 'คืนหิ่งห้อยพันดวง', icon: 'sk_ws_night', ult: true, max: 5, type: 'magic', cd: 90, sp: () => 90, mul: (lv) => (0.5 + lv * 0.1) / 2,
      desc: (lv) => `ดวงไฟนับพันลอยขึ้นทั่วจอ 10 วิ พวกเราฟื้น HP 2% ทุกวิ ศัตรูโดนดวงไฟรุมวิละ ${pct(0.5 + lv * 0.1)}% ของ MATK` }),
  });
  const regrow = (p) => (lvOf(p, 'ws_flock') >= 5 ? 3 : 4) * (1 - 0.03 * lvOf(p, 'ws_swift'));
  function drawWisp(ctx, x, y, s, t, a) {
    V.glow(ctx, x, y, 26 * s, WISP, 0.75 * (a || 1), true);
    ctx.save(); ctx.globalAlpha *= a || 1;
    ctx.beginPath(); ctx.arc(x, y, 7 * s, 0, TAU); ctx.fillStyle = '#e8fff8'; ctx.fill();
    ctx.beginPath(); ctx.arc(x - 2 * s, y - 2 * s, 3 * s, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();
    if (Math.random() < 0.05) V.motes(x, y, 1, WISP, { rise: 30, spread: 4, size: 0.6 });
  }
  const wispPos = (p, i, n, t) => { const a = t * 1.8 + (i / Math.max(1, n)) * TAU; return [p.x + Math.cos(a) * 58, p.y - 96 + Math.sin(a) * 20 + Math.sin(t * 3 + i) * 5]; };
  // a wisp flying from the shepherd at v to a monster, hit(f) on arrival (none online, where it is a look and the server
  // strikes); the swarm's little shot (lookOnly: its sparks, no hit)
  function flyShot(game, p, from, e, id, v, hit) {
    K.shot(game, p, id, { from, ang: NC.angle(from[0], from[1], e.x, e.y - 50), v, range: 1000, r: 30, home: 16, target: e, rgb: WISP,
      look(ctx, q) { drawWisp(ctx, q.x, q.y, 1, q.t); },
      hit(f) { if (hit) hit(f); V.sparks(f.x, f.y - 50, 6, WISP, { size: 0.6 }); } });
  }
  const swarmShot = (game, p, from, e, lookOnly) => K.shot(game, p, 'ws_swarm', { from, ang: NC.angle(from[0], from[1], e.x, e.y - 50), v: 900, range: 600, r: 24, home: 14, target: e, rgb: WISP, size: 0.5,
    look(ctx, q) { V.glow(ctx, q.x, q.y, 14, WISP, 0.9, true); }, hit: lookOnly ? (f, q) => V.sparks(q.x, q.y, 6, WISP, { size: 0.7 }) : undefined });
  function wispFly(game, p, from, e, id, k, onHit) {
    flyShot(game, p, from, e, id, 700 * (1 + 0.03 * lvOf(p, 'ws_swift')), (f) => { K.hit(game, p, id, f, 0, 0, WISP, k); if (onHit) onHit(f); });
  }
  // the looks the online client draws from the server's `wisp` events and meters (js/online-wisp.js)
  const WS_LOOK = {
    draw: drawWisp, pos: wispPos, fly: flyShot, swarm: swarmShot,
    orbit(ctx, p, n, big, t) { for (let i = 0; i < n; i++) { const [x, y] = wispPos(p, i, n, t); drawWisp(ctx, x, y, big ? 1.25 : 1, t); } },
    latched(ctx, host, phase, shielded, t) { // a wisp latched onto host, circling above its head; a glow while it shields
      const a = t * 2.4 + phase, x = host.x + Math.cos(a) * 34, y = host.y - 110 + Math.sin(a) * 10;
      drawWisp(ctx, x, y, 0.85, t, 0.9);
      if (shielded) V.glow(ctx, host.x, host.y - 60, 90, WISP, 0.18, true);
    },
    latch(x0, y0, x1, y1) { FX.add({ type: 'cutline', x: x0, y: y0 - 96, x1, y1: y1 - 90, w: 4, color: WISP, life: 0.25 }); },
    none(x, y) { FX.text(x, y - 190, 'ยังไม่มีดวงไฟเกาะใคร', '#bfffee', 24); },
    embrace(x, y) { V.ring(x, y - 40, 10, 90, 6, WISP, 0.35); },
    embraced(x, y) { FX.text(x, y - 190, 'ดวงไฟโอบกาย!', '#bfffee', 26); },
    burst(game, x, y) { K.burst(game, x, y, 150, WISP, { shake: 2, sparks: 10, flare: false }); },
    healRing(x, y) { V.ring(x, y, 10, 90, 5, '170,255,200', 0.3); },
    marked(e) { FX.text(e.x, NC.labelTop(e) - 90, 'ดวงไฟติด!', '#bfffee', 26); },
    markBurst(e) { V.ring(e.x, e.y - 40, 6, 60, 5, WISP, 0.25); },
    soak(x, y, n) { FX.num(x, y - 140, 'ดูดซับ ' + Math.round(n), { fill: '#bfffee', size: 24 }); },
    // the wisps latched on p as icons with their seconds in p's buff row (Discord #142: "มองไม่ออกว่ายังทำงานอยู่ไหม"):
    // ส่งดวงไฟเกาะ while one is latched (the longest left), ดวงไฟโอบกาย while a shield on p holds (it soaks for whoever it
    // sits on, wsSoak; online js/online-wisp.js sets these from the meters). on: [{ until }], shielded: the ones whose shield holds
    latchBuffs(p, on, shielded, now) {
      if (!p.buffs) p.buffs = {};
      const left = (L) => L.reduce((m, l) => Math.max(m, l.until - now), 0);
      p.buffs.ws_latch = on.length ? Math.max(0.1, left(on)) : 0;
      p.buffs.ws_embrace = shielded.length ? Math.max(0.1, left(shielded)) : 0;
    },
    regrow(x, y) { V.sparks(x, y, 5, WISP, { size: 0.5 }); },
  };
  NC.WispLooks = WS_LOOK;
  RUN.ws_latch = function (game, p, lv) {
    castPose(game, p, 0.2);
    if (game.presentationOnly) return; // (online the server latches it and sends the line: js/online-wisp.js)
    const team = [p, ...K.friends(game, p, 600)].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    const host = team[0];
    if (!p.wsLatch) p.wsLatch = [];
    const per = lvOf(p, 'ws_heart') >= 1 ? 2 : 1;
    if (p.wsLatch.filter((l) => l.host === host).length >= per) { const old = p.wsLatch.find((l) => l.host === host); p.wsLatch.splice(p.wsLatch.indexOf(old), 1); }
    p.wsOrbit--;
    const dur = NC.weaponBonus && NC.weaponBonus(p, 'ws_latch') ? 30 : 20;
    p.wsLatch.push({ host, until: game.time + dur, lv, shield: 0, acc: 0 });
    WS_LOOK.latch(p.x, p.y, host.x, host.y);
    if (isWS(p)) ensureWisps(); // (the wisps drawer lasts: only a wisp's; the FX capture's hero has no job)
  };
  RUN.ws_embrace = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.25);
    if (game.presentationOnly) return; // (online the server shields them and sends the looks: js/online-wisp.js)
    if (!p.wsLatch || !p.wsLatch.length) { WS_LOOK.none(p.x, p.y); return; }
    for (const l of p.wsLatch) { l.shield = Math.round(matk(p) * (1 + lv * 0.15)); WS_LOOK.embrace(l.host.x, l.host.y); }
    WS_LOOK.embraced(p.x, p.y);
  };
  RUN.ws_burst = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.3);
    if (game.presentationOnly) return; // (online the server bursts them and sends the looks: js/online-wisp.js)
    const L = (p.wsLatch || []).splice(0);
    if (!L.length) { WS_LOOK.none(p.x, p.y); return; }
    const team = [p, ...K.friends(game, p, 900)], amt = matk(p) * (1.2 + lv * 0.2) * K.healPow(p);
    for (const l of L) {
      WS_LOOK.burst(game, l.host.x, l.host.y);
      for (const a of team) if (NC.dist(a.x, a.y, l.host.x, l.host.y) < 150) heal(game, a, amt);
    }
  };
  RUN.ws_rush = function (game, p, lv) {
    castPose(game, p, 0.3);
    if (game.presentationOnly) return; // (online the server sends the wisps: js/online-wisp.js)
    const e = K.target(game, p, 750, 300);
    if (!e) return;
    const n = p.remote ? 3 : p.wsOrbit || 0, big = lvOf(p, 'ws_heart') >= 5 && n >= 5, t = game.time; // (another player's: their flock isn't sent, three)
    for (let i = 0; i < n; i++) {
      const from = wispPos(p, i, n, t);
      V.at(i * 0.06, () => wispFly(game, p, from, e, 'ws_rush', big ? 1.5 : 1, (f) => { for (const o of K.around(game, f.x, f.y, 80)) if (o !== f) K.hit(game, p, 'ws_rush', o, 0, 0, WISP, 0.5); if (lvOf(p, 'ws_heart') >= 3) healRing(game, p, f.x, f.y); }));
    }
    p.wsOrbit = lv >= 10 ? Math.floor(n / 2) : 0;
    p.wsRegrowT = game.time;
  };
  function healRing(game, p, x, y) { // ใจดวงไฟ Lv 3: a burst leaves a little healing light
    WS_LOOK.healRing(x, y);
    for (const a of [p, ...K.friends(game, p, 900)]) if (NC.dist(a.x, a.y, x, y) < 120) heal(game, a, matk(p) * 0.2 * K.healPow(p), { quiet: true });
  }
  RUN.ws_mark = function (game, p, lv) {
    castPose(game, p, 0.25);
    const e = K.target(game, p, 750, 300);
    if (!e) return;
    e.wsMark = { until: game.time + 6, next: 0 };
    WS_LOOK.marked(e);
    if (isWS(p) && !game.presentationOnly) ensureWisps();
    // (another player's mark, on the ghost of my monster js/net.js gives them: j3wisps only draws my marks)
    if (p.remote) FX.add({ type: 'custom', layer: 'glow', life: 6, x: e.x, y: e.y, draw(ctx) { if (alive(e)) drawWisp(ctx, e.x + Math.sin(game.time * 3) * 10, NC.labelTop(e) - 40, 0.9, game.time); } });
  };
  RUN.ws_night = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.5);
    p.wsNight = game.time + 10;
    shout(p, 'คืนหิ่งห้อยพันดวง!', '#bfffee', 34);
    V.flash('170,255,220', 0.12, 0.35);
    V.light(p.x, p.y - 60, 1600, WISP, 0.8, 10, { follow: p });
    FX.add({ type: 'j3fireflies', layer: 'glow', life: 10, x: p.x, y: p.y, dots: [...Array(90)].map(() => [rand(-900, 900), rand(-500, 350), rand(0, 9)]) });
  };
  FX.def('j3fireflies', (ctx, q, u) => {
    const G = NC.game;
    if (!G) return;
    const p = G.player, a = Math.min(1, q.t / 0.6) * (u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1);
    for (const [dx, dy, ph] of q.dots) {
      const x = p.x + dx + Math.sin(G.time * 0.8 + ph) * 30, y = p.y + dy - q.t * 20 + Math.cos(G.time * 1.1 + ph) * 20;
      V.glow(ctx, x, y, 14, WISP, 0.8 * a * (0.5 + 0.5 * Math.sin(G.time * 4 + ph)), true);
    }
  });
  // the wisps circling the shepherd, the latched ones on their hosts, the marks on monsters
  const ensureWisps = persistent('j3wisps');
  FX.def('j3wisps', (ctx) => {
    const G = NC.game, p = G && G.player;
    if (!isWS(p) || p.dead > 0) return;
    const n = p.wsOrbit || 0, t = G.time;
    WS_LOOK.orbit(ctx, p, n, n >= 5 && lvOf(p, 'ws_heart') >= 5, t);
    for (const l of p.wsLatch || []) WS_LOOK.latched(ctx, l.host, l.until, l.shield > 0, t);
    for (const e of G.enemies) if (e.wsMark && e.wsMark.until > t && alive(e)) drawWisp(ctx, e.x + Math.sin(t * 3) * 10, NC.labelTop(e) - 40, 0.9, t);
  });
  NC.skillTicks.push((game, p, dt) => {
    if (!isWS(p)) { p.wsOrbit = 0; p.wsLatch = []; return; }
    ensureWisps();
    const max = wispMax(p);
    if (p.wsOrbit === undefined) p.wsOrbit = max;
    // regrowth
    if ((p.wsOrbit || 0) < max) { if (game.time - (p.wsRegrowT || 0) >= regrow(p)) { p.wsOrbit++; p.wsRegrowT = game.time; const [x, y] = wispPos(p, p.wsOrbit - 1, p.wsOrbit, game.time); WS_LOOK.regrow(x, y); } }
    else p.wsRegrowT = game.time;
    if (p.wsOrbit > max) p.wsOrbit = max;
    // latched wisps heal their hosts; they run out
    p.wsLatch = (p.wsLatch || []).filter((l) => l.until > game.time && l.host && l.host.dead <= 0 && (l.host === p || K.friends(game, p, 2000).includes(l.host)));
    for (const l of p.wsLatch) if ((l.acc += dt) >= 1) { l.acc -= 1; heal(game, l.host, matk(p) * (0.15 + l.lv * 0.03) * K.healPow(p), { quiet: true }); }
    const onMe = p.wsLatch.filter((l) => l.host === p);
    WS_LOOK.latchBuffs(p, onMe, onMe.filter((l) => l.shield > 0), game.time);
    // ฝูงหิ่งห้อย: the circling wisps shoot the monsters near
    const sl = lvOf(p, 'ws_swarm');
    if (sl && p.wsOrbit > 0 && game.time - (p.wsSwarmT || 0) >= 1.6) {
      p.wsSwarmT = game.time;
      const near = K.nearest(game, p.x, p.y, 420, p.wsOrbit);
      if (near.length) for (let i = 0; i < p.wsOrbit; i++) { // (every circling wisp shoots, sharing out the monsters near)
        const e = near[i % near.length], from = wispPos(p, i, p.wsOrbit, game.time);
        V.at(i * 0.08, () => { if (alive(e)) swarmShot(game, p, from, e); });
      }
    }
    // คืนหิ่งห้อยพันดวง: the team heals, the monsters get swarmed
    if (p.wsNight > game.time && (p.wsNightAcc = (p.wsNightAcc || 0) + dt) >= 0.5) {
      p.wsNightAcc = 0;
      for (const a of [p, ...K.friends(game, p, 1200)]) heal(game, a, a.maxHp * 0.01, { quiet: true });
      for (const e of game.enemies) if (alive(e) && NC.dist(e.x, e.y, p.x, p.y) < 1000) { K.hit(game, p, 'ws_night', e, 0, 0, WISP); if (Math.random() < 0.3) V.sparks(e.x, e.y - 50, 3, WISP, { size: 0.5 }); }
    }
  });
  // the shields of ดวงไฟโอบกาย soak for whoever they sit on: the shepherd herself or a friend (Discord #142: before
  // 2026-10-20 only her own soaked, a friend's just glowed). Her own first, then the other shepherds' (the server's
  // wsEmbraceGuard, patch 021, the same). The hero's in NC.heroGuards, the AI friends' in party.js hurtAlly (NC.allyGuards)
  function wsSoak(game, host, dmg) {
    const herds = [host, game.player, ...((NC.allies && NC.allies(game)) || [])];
    for (let i = 0; i < herds.length && dmg > 0; i++) {
      const s = herds[i];
      if (!isWS(s) || !s.wsLatch || herds.indexOf(s) !== i) continue;
      for (const l of s.wsLatch) {
        if (dmg <= 0) break;
        if (l.host !== host || !(l.shield > 0) || l.until <= game.time) continue;
        const soak = Math.min(l.shield, dmg);
        l.shield -= soak; dmg -= soak;
        WS_LOOK.soak(host.x, host.y, soak);
      }
    }
    return dmg;
  }
  NC.heroGuards.push(wsSoak);
  (NC.allyGuards || (NC.allyGuards = [])).push(wsSoak);
  // the bell's chime sends a circling wisp at what it hit; a marked monster bursts a wisp when hit
  NC.basicHits.push((game, p, e, r) => {
    if (!game || p !== game.player || !(r.dmg > 0) || !isWS(p)) return;
    const cl = lvOf(p, 'ws_call');
    // (the called wisp flies out, strikes and comes back: it isn't used up; one call every 0.8 s)
    if (cl && wt(p) === 'bell' && p.wsOrbit > 0 && game.time - (p.wsCallT || 0) >= 0.8) {
      p.wsCallT = game.time;
      const from = wispPos(p, p.wsOrbit - 1, p.wsOrbit, game.time);
      wispFly(game, p, from, e, 'ws_call', 1, lvOf(p, 'ws_heart') >= 3 ? (f) => healRing(game, p, f.x, f.y) : null);
    }
  });
  const baseDmg = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r) {
    baseDmg.apply(this, arguments);
    const p = game && game.player;
    // (a presented cast's hits on the copies of marked monsters burst nothing: online the server does, js/online-wisp.js)
    if (!isWS(p) || game.presentationOnly || !e || !e.wsMark || !(r && r.dmg > 0) || e.wsMark.until < game.time || game.time < e.wsMark.next || !alive(e)) return;
    e.wsMark.next = game.time + 0.3;
    V.at(0, () => { if (!alive(e)) return; WS_LOOK.markBurst(e); K.hit(game, p, 'ws_mark', e, 0, 0, WISP); });
  };

  // =====================================================================================================
  // lines, the skill list, the weapon rules
  // =====================================================================================================
  const LINES = {
    puppeteer: [['puppet', 'หุ่นรบ', 'neutral', null, 0], ['thread', 'ด้ายเชิด', 'shadow', 'shadow', 0], ['wire', 'ด้ายสังหาร', 'neutral', 'blade', 1], ['theatre', 'โรงละครหุ่นเชิด', 'neutral', null, 0]],
    lightkeeper: [['light', 'เขตแสง', 'holy', 'light', 0], ['torch', 'คบเพลิงศักดิ์สิทธิ์', 'fire', 'battle', 1], ['lamp', 'โคมแก้ว', 'holy', 'heal', 0], ['dawn', 'รุ่งอรุณ', 'holy', null, 0]],
    wisp: [['flock', 'ฝูงดวงไฟ', 'holy', 'bless', 0], ['mend', 'ดวงไฟรักษา', 'holy', 'heal', 0], ['bell', 'ดวงไฟโจมตี', 'holy', 'battle', 1], ['night', 'คืนหิ่งห้อยพันดวง', 'holy', null, 0]],
  };
  const PLAN = {
    puppeteer: [
      ['pp_puppet', 'puppet', 10, 1, [], 'Lv5 หุ่นได้ท่าพิเศษของแบบนั้น · Lv10 หุ่นร่างใหญ่'],
      ['pp_strings', 'puppet', 10, 0, [['pp_puppet', 3]], 'หุ่นตีตามทุกครั้งที่เราตีปกติ'],
      ['pp_swap', 'puppet', 5, 0, [['pp_puppet', 3]], 'ศัตรูหันไปตีหุ่น'],
      ['pp_dance', 'puppet', 10, 0, [['pp_puppet', 5]], 'หมุน 3 รอบ'],
      ['pp_control', 'thread', 10, 0, [['ro_hide', 1]], 'Lv5 เชิดได้ 2 ตัว · Lv10 มอนที่เชิดตายแล้วระเบิด'],
      ['pp_guide', 'thread', 10, 0, [['pp_control', 3]], 'ด้ายถึงหุ่นและมอนที่เชิด'],
      ['pp_soulstring', 'thread', 5, 0, [['pp_control', 5]], 'Lv1 มอนที่เชิดคริได้ · Lv3 สลับร่างแล้วไม่โดนตี 2 วิ · Lv5 หุ่นประกอบใหม่เอง'],
      ['pp_edge', 'wire', 10, 0, [['ro_dagger', 3]], 'สะบัดด้ายทะลุทั้งแนว'],
      ['pp_stretch', 'wire', 10, 1, [], 'Lv5 ด้ายไขว้ระเบิดที่จุดตัด · Lv10 ขึงได้ 5 เส้น'],
      ['pp_bind', 'wire', 10, 0, [['pp_stretch', 3]], 'ลากและรัด 1 วิ'],
      ['pp_theatre', 'theatre', 5, 0, ['|', ['pp_dance', 5], ['pp_bind', 5]], 'มอนธรรมดาหันไปตีกันเอง'],
    ],
    lightkeeper: [
      ['lk_radiance', 'light', 10, 0, [], 'กลางคืนและในดันเจี้ยนแสงกว้างขึ้น 30%'],
      ['lk_flash', 'light', 10, 0, [['holylight', 3]], 'ผีและอมตะมึน 1 วิ'],
      ['lk_lighthouse', 'light', 5, 0, [['lk_radiance', 5]], 'Lv1 แสงแรงขึ้น · Lv3 ยืนนิ่งแสงกว้างขึ้น · Lv5 ล้มในแสงแล้วลุก'],
      ['lk_torchmastery', 'torch', 10, 0, [['pr_macemastery', 1]], 'ติดเผา แรงกับผีและอมตะ'],
      ['lk_swing', 'torch', 10, 1, [], 'ทิ้งเปลวไฟที่เป็นเขตแสง'],
      ['lk_plant', 'torch', 5, 0, [['lk_swing', 3]], 'ปักได้ 2 อัน'],
      ['lk_faith', 'torch', 10, 0, [['lk_torchmastery', 3]], 'อาวุธเป็นธาตุแสง'],
      ['lk_lamp', 'lamp', 10, 1, [], 'Lv5 วางได้ 4 ดวง · Lv10 โคมลอยตามเพื่อน'],
      ['lk_flare', 'lamp', 10, 0, [['lk_lamp', 3]], 'ฮีลทุกคนในแสงของโคม'],
      ['lk_wick', 'lamp', 10, 0, [], '-'],
      ['lk_dawn', 'dawn', 5, 0, ['|', ['lk_flare', 5], ['lk_plant', 3]], 'ทั้งทีมอยู่ในแสง 10 วิ'],
    ],
    wisp: [
      ['ws_flock', 'flock', 10, 1, [], 'จำนวนดวงเพิ่มทุก 2 เลเวล (สูงสุด 5) · Lv5 เกิดใหม่ทุก 3 วิ'],
      ['ws_swarm', 'flock', 10, 0, [['ws_flock', 3]], 'ดวงไฟยิงเองทุก 1.6 วิ'],
      ['ws_swift', 'flock', 10, 0, [], '-'],
      ['ws_heart', 'flock', 5, 0, [['ws_flock', 5]], 'Lv1 เกาะเพื่อนได้ 2 ดวง · Lv3 แตกแล้วฮีล · Lv5 ดวงใหญ่'],
      ['ws_latch', 'mend', 10, 1, [], 'เกาะเพื่อนที่เลือดน้อยที่สุด'],
      ['ws_embrace', 'mend', 10, 0, [['ws_latch', 3]], 'ดวงไฟที่เกาะกลายเป็นโล่'],
      ['ws_burst', 'mend', 10, 0, [['ws_latch', 5]], 'ฮีลรอบตัวคนที่ถูกเกาะ'],
      ['ws_call', 'bell', 10, 0, [['pr_macemastery', 1]], 'ถือกระดิ่งเท่านั้น'],
      ['ws_rush', 'bell', 10, 0, [['ws_call', 3]], 'Lv10 ดวงไฟครึ่งหนึ่งเกิดใหม่ทันที'],
      ['ws_mark', 'bell', 5, 0, [['ws_call', 3]], 'ตีมันแล้วระเบิดเพิ่ม'],
      ['ws_night', 'night', 5, 0, ['|', ['ws_burst', 5], ['ws_rush', 5]], 'ทั้งจอ 10 วิ'],
    ],
  };
  for (const job in PLAN) {
    const J = NC.JOBS[job];
    if (!J) continue;
    J.lines = LINES[job].map(([id, name, el, parent, auto]) => ({ id, name, el, parent: parent || null, auto: !!auto }));
    J.skills = PLAN[job].map((r) => r[0]);
    for (const [id, line, max, free, req, grow] of PLAN[job]) {
      const Sk = SK[id];
      if (!Sk) { console.warn('jobs3 c: no skill', id); continue; }
      Sk.line = line; Sk.max = max; Sk.free = free; Sk.grow = grow;
      const any = req[0] === '|';
      Sk.req = any ? req.slice(1) : req;
      Sk.reqAny = any;
    }
  }
  if (NC.weaponRule) {
    const R = NC.weaponRule;
    for (const id of ['pp_strings', 'pp_swap', 'pp_dance']) R(id, 'n:puppet');
    for (const id of ['pp_edge', 'pp_stretch', 'pp_bind']) R(id, 'n:wire');
    for (const id of ['lk_torchmastery', 'lk_swing', 'lk_plant', 'lk_faith']) R(id, 'n:torch');
    R('lk_lamp', 'b:staff', { note: 'โคมอยู่นานขึ้น 10 วิ' });
    R('ws_latch', 'b:staff', { note: 'เกาะนานขึ้น 10 วิ' });
    for (const id of ['ws_call', 'ws_rush', 'ws_mark']) R(id, 'n:bell');
  }
})();
