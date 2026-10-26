/* jobs3_skills_b.js — the second batch of the new 2nd jobs (the plan "อาชีพใหม่ Night Camp", 2026-09-28):
     นักกวี   songs played in verses (every 5 s the song grows: x1 / x1.5 / x2) and closed with a finale (press it again);
              lane เครื่องดนตรี (songs for the whole team + notes) · lane แส้ (fire dances that weaken the enemies)
     มือปืน   a six-shot cylinder (a reload after six, the sixth hits hardest), the roulette spin;
              lane ปืนพกคู่ (single target) · lane ลูกซอง (a spread, close)
     ยมทูต    souls from the fallen (up to 10: stronger, lifesteal), a ghost form that passes through them;
              lane เคียวใหญ่ (sweeps, executions) · lane เคียวคู่ (throws that come back, the hook)
   The guns and the lute fire their own shots (a bullet, a pellet, a note) through the basic attack of the 'bolt' style:
   FX.add is wrapped to swap the shot's look while the hero's update runs; W.ranged makes their ATK come from DEX
   (stats.js). The guns have three attack clips of their own (gun1-3, NC.Anim.SETS.gun: aimed straight).
   Built with skillkit.js; loaded after jobs3_archmage.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS;
  const { C, P, TAU } = K;
  const rand = NC.rand, S = K.S, alive = K.alive;
  const r1 = (v) => Math.round(v * 10) / 10;
  const pct = (k) => Math.round(k * 100);
  const lvOf = (p, id) => NC.skillLv(p, id);
  const on = (p, id) => K.buffOn(p, id);
  const bl = (p, id) => (on(p, id) ? (p.buffLv && p.buffLv[id]) || 1 : 0);
  const roll = (x) => Math.random() * 100 < x;
  const wt = (p) => (NC.wtypeOf ? NC.wtypeOf(NC.weaponDef(p)) : '');
  const isBoss = (e) => !!((NC.BOSSES && NC.BOSSES[e.type]) || e.boss || e.isBoss);
  const others = (game, e, r, n) => game.enemies.filter((o) => o !== e && alive(o) && NC.dist(o.x, o.y, e.x, e.y) < r)
    .sort((a, b) => NC.dist(a.x, a.y, e.x, e.y) - NC.dist(b.x, b.y, e.x, e.y)).slice(0, n || 99);
  const shout = (p, text, fill, size) => FX.text(p.x, p.y - 205, text, fill || '#ffe28a', size || 30);
  const castPose = (game, p, lock) => K.pose(game, p, K.clip(p, 'bolt', 0), lock || 0.3);
  const swingPose = (game, p, i, lock) => K.pose(game, p, K.clip(p, 'swing', i || 0), lock || 0.25);
  const EL_RGB = { fire: '255,140,60', water: '150,215,255', wind: '255,236,120' };
  const EL_TH = { fire: 'ไฟ', water: 'น้ำแข็ง', wind: 'สายฟ้า' };
  const BRASS = '255,210,120', NOTE_HUES = ['255,150,210', '255,215,110', '140,225,255', '190,160,255'], SOUL = '170,230,255';
  const heal = (game, who, amount, o) => { if (who && who.hp < who.maxHp) K.heal(game, who, amount, o); }; // (no "+0" at full HP)
  const persistent = (type, layer) => { let fx = null; return () => { if (!fx || !FX.list.includes(fx)) fx = FX.add({ type, layer: layer || 'glow', life: 1e9, x: 0, y: 0 }); }; };

  // =====================================================================================================
  // guns: aimed straight (their own clips), their own shots
  // =====================================================================================================
  const Anim = NC.Anim, A = (n) => (c) => c.al + n;
  const gunClip = (name, base, wAng) => { const b = Anim.CLIPS[base]; if (b) Anim.addClip(name, Object.assign({}, b, { keys: Object.assign({}, b.keys, { wAng }) })); };
  gunClip('gun1', 'bolt1', [[0.07, A(-0.5), 'snap'], [0.11, A(0.02), 'out'], [0.3, A(-0.12)]]);
  gunClip('gun2', 'bolt2', [[0.07, A(-0.45), 'snap'], [0.12, A(0.0), 'out'], [0.3, A(-0.15)]]);
  gunClip('gun3', 'bolt3', [[0.26, A(-1.3), 'in'], [0.34, A(0.0), 'snap'], [0.62, A(-0.15)]]);
  Anim.SETS.gun = { ready: 'ready', combo: { bolt: ['gun1', 'gun2', 'gun3'] } };
  for (const id of ['pistols', 'shotgun']) if (NC.ITEMS[id]) NC.ITEMS[id].sig = { set: 'gun' };

  // a bullet: a brass slug with a hot tracer behind it
  function drawBullet(ctx, x, y, vx, vy, rgb, len, s) {
    const a = Math.atan2(vy, vx);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s || 1, s || 1);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(-len, 0, 0, 0);
    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},0.9)`);
    ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffd98a'; ctx.strokeStyle = NC.OUTLINE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(2, 0, 7, 3.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
    V.glow(ctx, x, y, 22 * (s || 1), rgb, 0.7, true);
  }
  // a note: a round head, a stem and a flag, bobbing as it flies
  function drawNote(ctx, x, y, rgb, t, s) {
    s = s || 1;
    V.glow(ctx, x, y, 30 * s, rgb, 0.65, true);
    ctx.save(); ctx.translate(x, y + Math.sin(t * 14) * 3); ctx.rotate(Math.sin(t * 8) * 0.25); ctx.scale(s, s);
    ctx.lineWidth = 3; ctx.strokeStyle = NC.OUTLINE; ctx.fillStyle = `rgb(${rgb})`; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-1, 6); ctx.lineTo(-1, -16); ctx.quadraticCurveTo(9, -12, 8, -2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-7, 7, 7.5, 5.5, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = `rgb(${rgb})`; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-1, 5); ctx.lineTo(-1, -15); ctx.quadraticCurveTo(8, -11, 7, -3); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(-9, 5, 2.4, 1.6, -0.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  FX.def('j3bullet', (ctx, q) => drawBullet(ctx, q.x, q.y, q.vx, q.vy, q.special ? EL_RGB[q.special] : q.sixth ? '255,120,80' : BRASS, q.sixth ? 70 : 42, q.sixth ? 1.3 : 1));
  FX.def('j3pellet', (ctx, q) => {
    drawBullet(ctx, q.x, q.y, q.vx, q.vy, '255,190,110', 30, 0.85);
    if (q.fan) for (const o of [-1, 1]) { const a = Math.atan2(q.vy, q.vx) + o * 0.16, d = q.t * 900; drawBullet(ctx, q.x0 + Math.cos(a) * d, q.y0 + Math.sin(a) * d, q.vx, q.vy, '255,190,110', 24, 0.7); }
  });
  FX.def('j3note', (ctx, q) => drawNote(ctx, q.x, q.y, q.hue || NOTE_HUES[0], q.t, q.big ? 1.4 : 1.05));

  // the swap: a bolt (or arrow) fired while the hero's update runs, with a weapon that has a shot of its own
  let heroUpd = 0, shotKind = null, curShot = null, noteI = 0;
  // (the swings' hit events fire in NC.updateHeroAnim; skills cast from the keys in NC.updatePlayer)
  for (const fn of ['updatePlayer', 'updateHeroAnim']) {
    const base = NC[fn];
    if (base) NC[fn] = function () { heroUpd++; try { return base.apply(this, arguments); } finally { heroUpd--; } };
  }
  const BLUES = { '150,220,255': 1, '170,230,255': 1, '160,210,255': 1 };
  const SHOT_RGB = { bullet: BRASS, pellet: '255,190,110', note: '255,170,220', thread: '220,200,255', chime: '170,240,230' };
  const baseAdd = FX.add;
  FX.add = function (q) {
    if (q && (heroUpd || shotKind)) {
      const G = NC.game, p = G && G.player, W = p && p.equip && NC.ITEMS[p.equip.weapon];
      if (heroUpd && W && W.shot && (q.type === 'bolt' || q.type === 'arrow') && typeof q.update === 'function' && !q.j3) {
        const kind = W.shot, up = q.update;
        q.j3 = true; q.type = 'j3' + kind; q.layer = 'glow'; q.x0 = q.x; q.y0 = q.y; q.hue = NOTE_HUES[noteI++ % 4];
        q.update = function () { const s0 = shotKind, c0 = curShot; shotKind = kind; curShot = q; try { return up.apply(this, arguments); } finally { shotKind = s0; curShot = c0; } };
        shotFired(G, p, W, q, kind);
      } else if (q.color && BLUES[q.color] && (shotKind || (heroUpd && W && W.shot)) && (q.type === 'ring' || q.type === 'star' || q.type === 'puff' || q.type === 'spark')) {
        q.color = SHOT_RGB[shotKind || W.shot] || q.color;
      }
    }
    return baseAdd.apply(this, arguments);
  };
  // a shot leaves the muzzle: the flash, the cylinder, what the roulette loaded
  function shotFired(game, p, W, q, kind) {
    const [mx, my] = [q.x, q.y];
    if (kind !== 'bullet' && kind !== 'pellet') { // (a note, a thread, a chime: no muzzle, no cylinder)
      if (kind === 'note') V.motes(mx, my, 3, q.hue, { rise: 60, spread: 10, size: 0.8 });
      return;
    }
    // the muzzle flash
    V.glowAt(mx, my, 6, kind === 'pellet' ? 70 : 44, '255,220,150', 0.9, 0.08, { hot: true });
    V.sparks(mx, my, kind === 'pellet' ? 6 : 3, '255,210,140', { size: 0.5, max: 300 });
    if (kind === 'pellet') { // the shotgun: four more pellets in a fan, each 45% of a shot (close up, most of them land)
      game.shake = Math.max(game.shake || 0, 3);
      const a0 = Math.atan2(q.vy, q.vx), hk = W.hitK || 1;
      for (const da of [-0.16, -0.08, 0.08, 0.16]) K.shot(game, p, 'gs_pellet', { from: [mx, my], ang: a0 + da, v: 1000, range: W.range || 420, r: 24, rgb: '255,190,110',
        look(ctx, s) { drawBullet(ctx, s.x, s.y, s.vx, s.vy, '255,190,110', 24, 0.7); },
        hit(f) { const r = NC.heroHit(p.d, f, { kind: 'phys', mul: 0.45 * hk }); NC.damageEnemy(game, f, r, Math.cos(a0) * 80, Math.sin(a0) * 60, { color: '255,210,150' }); } });
    }
    if (!NC.isJob(p, 'gunslinger')) return;
    // reloading: the hammer clicks on an empty chamber
    if (p.gsReload > game.time) { q.update = () => {}; q.life = 0.01; FX.text(mx, my - 30, 'แชะ', '#cfc6b8', 22); return; }
    const spin = p.gsSpin;
    p.gsSpin = null;
    if (spin === 'dud') { q.update = () => {}; q.life = 0.01; V.smoke(mx, my, 3, '#6a6470', '#8a8490', { size: 0.5, lifeK: 0.5, a: 0.7 }); FX.text(mx, my - 30, 'ด้าน...', '#cfc6b8', 26); }
    else if (spin) q.spin = spin;
    if (p.gsSpecial > 0) { p.gsSpecial--; q.special = p.gsSpecialEl; }
    p.gsAmmo = (p.gsAmmo === undefined ? 6 : p.gsAmmo) - 1;
    if (p.gsAmmo <= 0) {
      q.sixth = lvOf(p, 'gs_sixth') > 0;
      const t = 1 * (1 - 0.05 * lvOf(p, 'gs_mastery'));
      p.gsReload = game.time + t; p.atk.cd = Math.max(p.atk.cd, t); p.atk.queued = false;
      V.at(0.12, () => { FX.text(p.x, p.y - 190, 'บรรจุ!', '#ffd98a', 26); for (let i = 0; i < 6; i++) FX.add({ type: 'spark', x: p.x, y: p.y - 70, vx: rand(-160, 160), vy: rand(-260, -120), drag: 2, grav: 900, life: 0.6, color: BRASS }); });
    }
  }

  // =====================================================================================================
  // มือปืน
  // =====================================================================================================
  const isGS = (p) => p && NC.isJob(p, 'gunslinger');
  const SPIN = [['x3', 'แรง ×3!', '#ffcf5a'], ['boom', 'กระสุนระเบิด!', '#ff9a5a'], ['elem', 'ธาตุไฟ ×2!', '#ff7a4a'], ['heal', 'ฟื้นพลัง!', '#8dff8a'], ['pierce', 'ทะลุ!', '#bfe8ff'], ['dud', 'ด้าน...', '#bdb6c8']];
  K.def({
    gs_spin: S({ name: 'หมุนโม่', icon: 'sk_gs_spin', cd: 6, sp: () => 8, mul: () => 0,
      desc: (lv) => `หมุนโม่: นัดถัดไปสุ่ม 1 ใน 6 แรง ×3 · ระเบิดเป็นวง · ธาตุไฟ ×2 · ฟื้น HP 5% · ยิงทะลุ · ด้าน (ไม่ออก)${lv >= 10 ? ' · Lv10 ไม่ออกด้านเลย' : ` · โอกาสด้าน ${Math.round(100 * ((10 - lv) / 9) / (5 + (10 - lv) / 9))}%`}` }),
    gs_sixth: S({ name: 'นัดที่หก', icon: 'sk_gs_sixth', pass: () => ({}), desc: (lv) => `ทุกนัดที่ 6 ของลูกโม่คริแน่นอนและแรงขึ้น ${lv * 5}%` }),
    gs_special: S({ name: 'บรรจุกระสุนพิเศษ', icon: 'sk_gs_special', cd: 12, sp: () => 20, mul: () => 0,
      desc: (lv) => `บรรจุใหม่ทันที 6 นัดเป็นกระสุนธาตุ (ไฟ น้ำแข็ง สายฟ้า สลับกันทุกครั้งที่บรรจุ) แรงขึ้น ${10 + lv * 4}% ติดสถานะของธาตุ` }),
    gs_eye: S({ name: 'สายตานักแม่นปืน', icon: 'sk_gs_eye', max: 5, pass: (lv, p) => (['pistol', 'shotgun'].includes(wt(p)) ? { crit: lv, hit: lv * 3 } : null),
      desc: (lv) => `ถือปืน: คริ +${lv} ความแม่น +${lv * 3}` }),
    gs_mastery: S({ name: 'ชำนาญปืนพก', icon: 'sk_gs_mastery', pass: (lv, p) => (wt(p) === 'pistol' ? { aspd: r1(lv * 1.5) } : null),
      desc: (lv) => `ถือปืนพก: ความเร็วโจมตี +${r1(lv * 1.5)}% บรรจุกระสุนเร็วขึ้น ${lv * 5}%` }),
    gs_rapid: S({ name: 'ลั่นไกรัว', icon: 'sk_gs_rapid', type: 'phys', mul: () => 0.9, pass: () => ({}),
      desc: (lv) => `ถือปืนพก: ยิงปกติ ${lv * 4}% ยิงซ้ำอีกนัดฟรี (90% ไม่กินกระสุน)` }),
    gs_triple: S({ name: 'ยิงสามนัด', icon: 'sk_gs_triple', free: 1, cd: 2, sp: () => 12, mul: (lv) => 0.9 + lv * 0.11,
      desc: (lv, m) => `ยิงสามนัดติดใส่เป้า นัดละ ${m}% ของ ATK` }),
    gs_ricochet: S({ name: 'กระสุนสะท้อน', icon: 'sk_gs_ricochet', max: 5, cd: 6, sp: () => 18, mul: (lv) => 1.6 + lv * 0.2,
      desc: (lv, m) => `กระสุนเด้งต่อ ${3 + Math.floor(lv / 2)} ตัว นัดละ ${m}% ของ ATK` }),
    gs_buckshot: S({ name: 'ลูกปรายกระจาย', icon: 'sk_gs_buckshot', free: 1, cd: 2, sp: () => 16, mul: (lv) => 0.24 + lv * 0.033,
      desc: (lv, m) => `ยิงกรวย 9 ลูกปรายระยะ 350 ลูกละ ${m}% ของ ATK ใกล้ยิ่งโดนหลายลูก` }),
    gs_kick: S({ name: 'ถีบถอย', icon: 'sk_gs_kick', max: 5, cd: 5, sp: () => 12, mul: (lv) => 1.4 + lv * 0.25,
      desc: (lv, m) => `ยิงกระแทกระยะใกล้ ${m}% ของ ATK ผลักศัตรูกระเด็น เราถีบตัวถอยหลัง 200` }),
    gs_smoke: S({ name: 'ระเบิดควัน', icon: 'sk_gs_smoke', element: 'fire', cd: 7, sp: () => 20, mul: (lv) => 0.8 + lv * 0.12,
      desc: (lv, m) => `ขว้างระเบิดควันวง 220 ${m}% ของ ATK ธาตุไฟ ศัตรูในควันตีเบาลง 30% นาน 4 วิ (ใช้ได้ทุกอาวุธ)` }),
    gs_stars: S({ name: 'ยิงดาวตก', icon: 'sk_gs_stars', ult: true, max: 5, cd: 60, sp: () => 70, mul: (lv) => 0.7 + lv * 0.12,
      desc: (lv, m) => `ยิงขึ้นฟ้า 1 นัด อีก 1 วิดาวตก 12 ดวงร่วงรอบเป้า ดวงละ ${m}% ของ ATK` }),
  });
  SK.gs_rapid.active = false; SK.gs_rapid.kind = 'passive';
  K.def({ gs_pellet: S({ name: 'ลูกปราย', icon: 'sk_gs_buckshot', mul: () => 0.34, sp: () => 0, cd: 0 }) });
  SK.gs_pellet.active = false; SK.gs_pellet.kind = 'passive';

  const gunFrom = (p) => K.tip(p);
  const bulletShot = (game, p, id, e, o) => K.shot(game, p, id, Object.assign({
    from: gunFrom(p), ang: e ? NC.angle(p.x, p.y - 70, e.x, e.y - 45) : p.aim, v: 1500, range: 800, r: 26, rgb: BRASS,
    look(ctx, q) { drawBullet(ctx, q.x, q.y, q.vx, q.vy, (o && o.rgb) || BRASS, 40, (o && o.size) || 1); },
    hit(f, q) { K.hit(game, p, id, f, Math.cos(p.aim) * 90, Math.sin(p.aim) * 60, '255,220,160', o && o.k); V.sparks(q.x, q.y, 5, BRASS, { size: 0.6 }); if (o && o.each) o.each(f); },
  }, o || {}));
  const muzzle = (p, big) => { const [x, y] = gunFrom(p); V.glowAt(x, y, 6, big ? 80 : 44, '255,220,150', 0.9, 0.1, { hot: true }); V.sparks(x, y, big ? 8 : 4, '255,210,140', { size: 0.5, max: 300 }); };

  RUN.gs_spin = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.2);
    // the cylinder spins: six chambers flash round, the one it stops on glows
    for (let k = 0; k < 6; k++) V.at(k * 0.05, () => { const a = (k / 6) * TAU - Math.PI / 2; V.sparks(p.x + Math.cos(a) * 40, p.y - 200 + Math.sin(a) * 40, 2, BRASS, { size: 0.5, max: 160 }); });
    // (online the server rolls the chamber, job_gunslinger_skills.go castSpin: its gsSpin meter names it, and
    // js/online-meters.js calls NC.gsSpinShout when it comes; a roll here would shout another chamber)
    if (game.presentationOnly) return;
    const dud = Math.max(0, (10 - lv) / 9), w = [1, 1, 1, 1, 1, dud], sum = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum, i = 0;
    while (i < 5 && r >= w[i]) { r -= w[i]; i++; }
    p.gsSpin = SPIN[i][0];
    V.at(0.32, () => spinShout(p, SPIN[i]));
  };
  const spinShout = (p, s) => { FX.text(p.x, p.y - 210, s[1], s[2], 30); V.ring(p.x, p.y - 200, 10, 60, 5, BRASS, 0.3); };
  NC.gsSpinShout = (p, name) => { const s = SPIN.find((x) => x[0] === name); if (s && p) spinShout(p, s); };
  RUN.gs_special = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.25);
    const order = ['fire', 'water', 'wind'];
    p.gsSpecialEl = order[(order.indexOf(p.gsSpecialEl) + 1) % 3];
    p.gsSpecial = 6; p.gsAmmo = 6; p.gsReload = 0; p.atk.cd = 0;
    const rgb = EL_RGB[p.gsSpecialEl];
    K.buffFx(game, p, rgb, { style: 'arcane', r: 110, flash: false });
    FX.text(p.x, p.y - 205, `กระสุน${EL_TH[p.gsSpecialEl]} ×6`, `rgb(${rgb})`, 28);
  };
  RUN.gs_triple = function (game, p, lv) {
    const e = K.target(game, p, 760, 300);
    castPose(game, p, 0.3);
    for (let i = 0; i < 3; i++) V.at(i * 0.08, () => { muzzle(p); bulletShot(game, p, 'gs_triple', e && alive(e) ? e : null, { home: e ? 10 : 0, target: e }); });
  };
  RUN.gs_ricochet = function (game, p, lv) {
    castPose(game, p, 0.3);
    muzzle(p, true);
    const first = K.target(game, p, 760, 300);
    if (!first) return;
    const n = 3 + Math.floor(lv / 2), done = new Set();
    let cur = first, from = gunFrom(p);
    for (let i = 0; i < n && cur; i++) {
      const c = cur, f = from;
      V.at(i * 0.09, () => {
        if (!alive(c)) return;
        FX.add({ type: 'cutline', x: f[0], y: f[1], x1: c.x, y1: c.y - 50, w: 5, color: BRASS, life: 0.18 });
        V.sparks(c.x, c.y - 50, 7, BRASS, { size: 0.6 });
        K.hit(game, p, 'gs_ricochet', c, 0, 0, '255,220,160');
      });
      done.add(c); from = [c.x, c.y - 50];
      cur = game.enemies.filter((o) => alive(o) && !done.has(o) && NC.dist(o.x, o.y, c.x, c.y) < 380).sort((a, b) => NC.dist(a.x, a.y, c.x, c.y) - NC.dist(b.x, b.y, c.x, c.y))[0];
    }
  };
  RUN.gs_buckshot = function (game, p, lv) {
    castPose(game, p, 0.3);
    muzzle(p, true);
    const [x0, y0] = gunFrom(p), hitN = new Map();
    for (let i = 0; i < 9; i++) {
      const a = p.aim + (i - 4) * 0.085 + rand(-0.03, 0.03), e = K.lineHits(game, x0, y0 + 40, a, 350, 26).sort((u, v) => NC.dist(u.x, u.y, x0, y0) - NC.dist(v.x, v.y, x0, y0))[0];
      const len = e ? NC.dist(x0, y0, e.x, e.y - 45) : 350;
      FX.add({ type: 'vstreak', x: x0 + Math.cos(a) * len, y: y0 + Math.sin(a) * len, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, len: Math.min(len, 160), w: 3, rgb: '255,200,130', life: 0.14 });
      if (e) { hitN.set(e, (hitN.get(e) || 0) + 1); V.at(0.03, () => K.hit(game, p, 'gs_buckshot', e, Math.cos(a) * 40, Math.sin(a) * 30, '255,220,160')); }
    }
    game.shake = Math.max(game.shake || 0, 5);
  };
  RUN.gs_kick = function (game, p, lv) {
    castPose(game, p, 0.35);
    muzzle(p, true);
    K.cone(game, p, 'gs_kick', 230, 0.6, { kb: 700, color: '255,220,160' });
    V.slash(p.x + Math.cos(p.aim) * 60, p.y - 60, 110, p.aim - 0.5, 1, 30, P.fire, 0.2, { rgb: '255,200,130' });
    V.smoke(p.x + Math.cos(p.aim) * 80, p.y - 60, 6, '#6a6470', '#8a8490', { size: 0.8, lifeK: 0.5, a: 0.7 });
    K.dash(game, p, 'gs_kick', p.aim + Math.PI, 200, 0.18, { hit() {}, rgb: '220,210,200' });
    p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
    game.shake = Math.max(game.shake || 0, 7);
  };
  RUN.gs_smoke = function (game, p, lv) {
    swingPose(game, p, 0, 0.25);
    const [tx, ty] = K.ground(game, p, 440);
    K.shot(game, p, 'gs_smoke', { from: K.hand(p), to: [tx, ty], dur: 0.45, arc: 160, spin: 12, rgb: '200,190,180',
      look(ctx, q) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fillStyle = '#3a3440'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); ctx.fillStyle = '#ffcf5a'; ctx.fillRect(-2, -16, 4, 6); ctx.restore(); },
      end() {
        K.nova(game, p, 'gs_smoke', tx, ty, 220, { rgb: '255,170,90', color: '255,200,140', shake: 5, flash: false, smoke: ['#6a6470', '#8a8490'] });
        K.zone(game, p, 'gs_smoke', tx, ty, 220, 4, 0.5, { rgb: '170,160,170', circle: false, glow: false, hits: false, each(e) { K.weak(game, e, 0.7, 0.8); },
          tick() { if (Math.random() < 0.5) V.smoke(tx + rand(-200, 200), ty + rand(-80, 60), 1, '#6a6470', '#9a94a0', { size: 1.4, lifeK: 0.9, a: 0.6 }); } });
      } });
  };
  RUN.gs_stars = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.5);
    const e = K.target(game, p, 800, 400), [tx, ty] = e ? [e.x, e.y] : K.ground(game, p, 480);
    const [mx, my] = gunFrom(p);
    FX.add({ type: 'vstreak', x: mx, y: my - 300, vx: 0, vy: -1600, len: 300, w: 5, rgb: BRASS, life: 0.3 });
    V.glowAt(mx, my, 10, 90, '255,220,150', 0.9, 0.15, { hot: true });
    shout(p, 'ยิงดาวตก!', '#ffe28a', 34);
    const look = (ctx, q) => { V.glow(ctx, q.x, q.y, 50, '255,230,140', 0.9, true); K.drawStar(ctx, q.x, q.y, 16, q.t * 10, 5, '#ffe89a'); };
    V.at(1, () => K.rain(game, p, 'gs_stars', e && alive(e) ? e.x : tx, e && alive(e) ? e.y : ty, 180, 12, 1.2, { rgb: '255,230,140', ir: 80, fall: 0.35, look, color: '255,235,170',
      land(x, y) { V.stars(x, y - 20, 4, '#fff0b0', '255,230,140', { speed: 220 }); } }));
  };

  // the cylinder, the roulette's effects, the sixth shot, the free shot of ลั่นไกรัว
  const baseHH = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const s = curShot, G = NC.game, p = G && G.player;
    if (s && p && d === p.d && o && !o.skill && isGS(p)) {
      o = Object.assign({}, o);
      if (s.special) { o.element = s.special; o.mul = (o.mul || 1) * (1.1 + 0.04 * lvOf(p, 'gs_special')); }
      if (s.sixth) { o.crit = true; o.mul = (o.mul || 1) * (1 + 0.05 * lvOf(p, 'gs_sixth')); }
      if (s.spin === 'x3') o.mul = (o.mul || 1) * 3;
      if (s.spin === 'elem') { o.element = 'fire'; o.mul = (o.mul || 1) * 2; }
    }
    return baseHH.call(this, d, e, o);
  };
  let rapidBusy = false;
  NC.basicHits.push((game, p, e, r) => {
    if (!game || p !== game.player || !(r.dmg > 0) || !isGS(p)) return;
    const s = curShot;
    if (s && !s.done) {
      s.done = true;
      if (s.sixth) { FX.text(e.x, NC.labelTop(e) - 90, 'นัดที่หก!', '#ff9a6a', 32); V.ring(e.x, e.y - 50, 10, 110, 7, '255,140,90', 0.3); }
      if (s.spin === 'boom') V.at(0.02, () => { K.burst(game, e.x, e.y, 150, '255,160,90', { shake: 5, sparks: 10 }); for (const f of K.around(game, e.x, e.y, 150)) NC.damageEnemy(game, f, { dmg: Math.round(r.dmg * 1.5), mod: 1 }, 0, 0, { color: '255,180,110' }); });
      if (s.spin === 'heal') heal(game, p, p.maxHp * 0.05);
      if (s.spin === 'pierce') V.at(0.02, () => {
        const a = Math.atan2(s.vy, s.vx);
        for (const f of K.lineHits(game, e.x, e.y - 45, a, 500, 50).filter((f) => f !== e).slice(0, 3)) NC.damageEnemy(game, f, { dmg: r.dmg, mod: 1 }, Math.cos(a) * 120, 0, { color: '200,235,255' });
        FX.add({ type: 'cutline', x: e.x, y: e.y - 50, x1: e.x + Math.cos(a) * 500, y1: e.y - 50 + Math.sin(a) * 500, w: 5, color: '200,235,255', life: 0.2 });
      });
    }
    // ลั่นไกรัว: a second, free shot
    const rl = lvOf(p, 'gs_rapid');
    if (rl && wt(p) === 'pistol' && !rapidBusy && roll(rl * 4)) V.at(0.07, () => {
      if (!alive(e)) return;
      rapidBusy = true;
      try { bulletShot(game, p, 'gs_rapid', e, { home: 12, target: e }); muzzle(p); } finally { rapidBusy = false; }
    });
  });
  // the reload finishing; the chambers over the hero's head
  NC.skillTicks.push((game, p) => {
    if (!isGS(p)) return;
    if (p.gsAmmo === undefined) p.gsAmmo = 6;
    if (p.gsReload && game.time >= p.gsReload) { p.gsReload = 0; p.gsAmmo = 6; V.ring(p.x, p.y - 200, 6, 40, 4, BRASS, 0.25); }
    ensureAmmo();
  });
  const ensureAmmo = persistent('j3ammo');
  FX.def('j3ammo', (ctx) => {
    const G = NC.game, p = G && G.player;
    if (!isGS(p) || p.dead > 0 || !['pistol', 'shotgun'].includes(wt(p))) return;
    const cx = p.x, cy = p.y - 222, R = 15, reload = p.gsReload > G.time;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R + 9, 0, TAU); ctx.fillStyle = 'rgba(20,14,28,0.7)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2a2435'; ctx.stroke();
    const spin = reload ? (1 - (p.gsReload - G.time)) * TAU * 2 : 0;
    for (let i = 0; i < 6; i++) {
      const a = spin + (i / 6) * TAU - Math.PI / 2, x = cx + Math.cos(a) * R * 0.95, y = cy + Math.sin(a) * R * 0.95, full = !reload && i < p.gsAmmo;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU);
      ctx.fillStyle = full ? (p.gsSpecial > 0 && i < p.gsSpecial ? `rgb(${EL_RGB[p.gsSpecialEl]})` : '#ffd98a') : '#3a3440';
      ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#1a1422'; ctx.stroke();
    }
    if (p.gsSpin) { ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fillStyle = '#ff7a5a'; ctx.fill(); }
    ctx.restore();
  });

  // =====================================================================================================
  // นักกวี: songs and dances played as performances
  // =====================================================================================================
  const isBard = (p) => p && NC.isJob(p, 'bard');
  const SONGS = ['bd_tempo', 'bd_warm', 'bd_stars'], DANCES = ['bd_firefly', 'bd_lure'];
  const VMUL = [1, 1, 1.5, 2];
  K.def({
    bd_tempo: S({ name: 'เพลงเร่งจังหวะ', icon: 'sk_bd_tempo', kind: 'buff', free: 1, cd: 1, sp: () => 6, buff: () => ({}), rgb: '255,215,110',
      desc: (lv) => `เล่นต่อเนื่อง (SP 2/วิ) รัศมี 450: ทั้งทีมความเร็วโจมตี +${lv}% คูณท่อน (ท่อนขึ้นทุก 5 วิ ×1 / ×1.5 / ×2) · กดอีกครั้ง = ท่อนฮุก: ทุกคนตีปกติ 3 ครั้งถัดไปคริแน่นอน` }),
    bd_warm: S({ name: 'เพลงอุ่นไอไฟ', icon: 'sk_bd_warm', kind: 'buff', cd: 1, sp: () => 6, buff: () => ({}), rgb: '255,170,110',
      desc: (lv) => `เล่นต่อเนื่อง: ทั้งทีมฟื้น HP ${r1(lv * 0.6)}% ทุก 5 วิ คูณท่อน · ท่อนฮุก: ฮีลทั้งทีม ${15 + lv * 2}% คูณท่อน` }),
    bd_stars: S({ name: 'เพลงดาวค้างฟ้า', icon: 'sk_bd_stars', kind: 'buff', cd: 1, sp: () => 6, buff: () => ({}), rgb: '190,200,255',
      desc: (lv) => `เล่นต่อเนื่อง: ทั้งทีมเวลาร่าย −${lv * 2}% คูลดาวน์ −${lv}% คูณท่อน · ท่อนฮุก: สกิลที่เหลือคูลดาวน์นานที่สุดลดลง 30%` }),
    bd_band: S({ name: 'วงดนตรี', icon: 'sk_bd_band', max: 5, pass: () => ({}),
      desc: (lv) => `หยุดเล่นแล้วเพลงค้างอีก 3 วิ${lv >= 3 ? ' · เดินระหว่างเล่นได้ความเร็วปกติ' : ''}${lv >= 5 ? ' · เล่นได้ 2 เพลงพร้อมกัน แรง 70%' : ''}` }),
    bd_twirl: S({ name: 'ระบำควงไฟ', icon: 'sk_bd_twirl', free: 1, element: 'fire', cd: 2.5, sp: () => 16, mul: (lv) => 0.2 + lv * 0.025,
      desc: (lv, m) => `ควงแส้ปลายไฟรอบตัว 2 วิ ทุก 0.25 วิ ${m}% ของ ATK ติดเผา` }),
    bd_firefly: S({ name: 'ระบำหิ่งห้อย', icon: 'sk_bd_firefly', kind: 'buff', cd: 1, sp: () => 6, buff: () => ({}), rgb: '200,255,130',
      desc: (lv) => `รำต่อเนื่อง (SP 2/วิ) รัศมี 400: หิ่งห้อยล้อมศัตรู เดินช้าลง ตีเบาลง ${lv * 2}% คูณท่อน` }),
    bd_lure: S({ name: 'ระบำหลอกล่อ', icon: 'sk_bd_lure', kind: 'buff', cd: 1, sp: () => 6, buff: () => ({}), rgb: '230,150,255',
      desc: (lv) => `รำต่อเนื่อง: ศัตรูรอบตัวตีเบาลง ${r1(lv * 1.5)}% รับดาเมจเพิ่ม ${lv}% คูณท่อน และหันมาตามผู้รำ` }),
    bd_lash: S({ name: 'ฟาดแส้ดึง', icon: 'sk_bd_lash', max: 5, cd: 3, sp: () => 12, mul: (lv) => 1.8 + lv * 0.35,
      desc: (lv, m) => `ฟาดแส้ยาว 320 ${m}% ของ ATK ดึงศัตรูเข้าหา` }),
    bd_note: S({ name: 'โน้ตเด้ง', icon: 'sk_bd_note', cd: 1, sp: () => 12, mul: (lv) => 0.6 + lv * 0.09,
      desc: (lv, m) => `ยิงตัวโน้ตที่เด้งไปอีก 2 ตัว ตัวละ ${m}% ของ ATK` }),
    bd_noterain: S({ name: 'ฝนโน้ต', icon: 'sk_bd_noterain', cd: 4, sp: () => 24, mul: (lv) => 0.22 + lv * 0.035,
      desc: (lv, m) => `ตัวโน้ต 6 ตัวตกใส่วง ตัวละ ${m}% ของ ATK · ท่อนเพลงยิ่งสูงยิ่งตกเพิ่ม (+2 ต่อท่อน)` }),
    bd_groove: S({ name: 'จังหวะเร้าใจ', icon: 'sk_bd_groove', max: 5, pass: () => ({}),
      desc: (lv) => `ระหว่างเล่นหรือรำ ตีปกติ ${lv * 4}% ยิงโน้ตเด้งฟรี` }),
    bd_festival: S({ name: 'มหกรรมรอบกองไฟ', icon: 'sk_bd_festival', ult: true, max: 5, element: 'fire', cd: 90, sp: () => 80, mul: (lv) => 0.3 + lv * 0.06,
      desc: (lv, m) => `จุดกองไฟใหญ่ 15 วิ พวกเราที่อยู่ใกล้ได้ทุกเพลงที่เรียนไว้ที่ท่อน 3 ศัตรูที่เข้าใกล้ติดเผาวิละ ${m}% ของ ATK และหลับ 2 วิครั้งแรก` }),
  });

  const perfMax = (p) => (lvOf(p, 'bd_band') >= 5 ? 2 : 1);
  const perfK = (p) => (lvOf(p, 'bd_band') >= 5 && p.bdPerf && p.bdPerf.length > 1 ? 0.7 : 1);
  // the performances counting now: the ones played, the echo of one just stopped (วงดนตรี), the festival's songs
  function perfsOf(p) {
    const G = NC.game, t = G ? G.time : 0, out = [];
    for (const pf of p.bdPerf || []) out.push({ id: pf.id, lv: pf.lv, mul: VMUL[pf.verse] * perfK(p) });
    if (p.bdEcho && p.bdEcho.until > t) out.push({ id: p.bdEcho.id, lv: p.bdEcho.lv, mul: VMUL[p.bdEcho.verse] });
    if (p.bdFest && p.bdFest.until > t && NC.dist(p.x, p.y, p.bdFest.x, p.bdFest.y) < 360)
      for (const id of SONGS) if (lvOf(p, id) && !out.some((x) => x.id === id)) out.push({ id, lv: lvOf(p, id), mul: 2 });
    return out;
  }
  NC.bardPerfs = perfsOf;
  // (a performance counts as a running buff while it plays: its icon in the buff bar, no second cast by the auto
  // rotations; it lasts as long as it is played)
  const markBuff = (p, pf, onOff) => { if (!p.buffs) p.buffs = {}; if (!p.buffLv) p.buffLv = {}; p.buffs[pf.id] = onOff ? 999 : 0; if (onOff) p.buffLv[pf.id] = pf.lv; };
  NC.bardMarkBuff = markBuff; // (js/online-bard.js: the icons of the songs the server plays)
  function stopPerf(game, p, pf, quiet) {
    markBuff(p, pf, false);
    p.bdPerf = (p.bdPerf || []).filter((x) => x !== pf);
    if (lvOf(p, 'bd_band') >= 1 && !quiet) p.bdEcho = { id: pf.id, lv: pf.lv, verse: pf.verse, until: game.time + 3 };
    NC.applyGear(game);
  }
  // the bard's looks, also drawn by the online client from the server's `bard` events (js/online-bard.js)
  function finaleLook(p, flash) {
    shout(p, 'ท่อนฮุก!', '#ffd0f0', 34);
    if (flash) V.flash('255,220,240', 0.08, 0.25);
    for (let i = 0; i < 16; i++) V.at(i * 0.02, () => { const a = rand(0, TAU); noteFly(p.x, p.y - 80, a, rand(200, 380)); });
  }
  const cdLook = (p) => FX.text(p.x, p.y - 170, 'คูลดาวน์ลดลง!', '#c8d0ff', 24);
  function finale(game, p, pf) {
    const m = VMUL[pf.verse], lv = pf.lv;
    finaleLook(p, true);
    const team = [p, ...K.friends(game, p, 450)];
    if (pf.id === 'bd_tempo') { p.bdCrit = 3; for (const a of team) if (a !== p) { a.bless = game.time + 4; a.blessK = Math.max(a.blessK || 1, 1.3); } }
    if (pf.id === 'bd_warm') for (const a of team) heal(game, a, a.maxHp * ((15 + lv * 2) / 100) * m);
    if (pf.id === 'bd_stars') {
      let best = null;
      for (const k in p.cd) if (k[0] === '@' && p.cd[k] > 0 && (!best || p.cd[k] > p.cd[best])) best = k;
      if (best) { p.cd[best] *= 1 - 0.3 * Math.min(1, m / 1.5); cdLook(p); }
    }
    stopPerf(game, p, pf, true);
  }
  function startPerf(game, p, id, lv) {
    if (!p.bdPerf) p.bdPerf = [];
    const cur = p.bdPerf.find((x) => x.id === id);
    // (online the server plays them: a second press's finale or stop, the slot a new one takes and the buff icon come
    // back as its bard events and meters, js/online-bard.js; a presented cast only draws a new one starting. The finale
    // played here healed, cut a cooldown and marked a song playing for 999 s that nothing online ever ended)
    const own = !game.presentationOnly;
    if (cur) { if (!own) return; if (SONGS.includes(id) && cur.verse >= 2) finale(game, p, cur); else stopPerf(game, p, cur); return; }
    if (own) {
      while (p.bdPerf.length >= perfMax(p)) stopPerf(game, p, p.bdPerf[0]);
      const pf = { id, lv, verse: 1, next: game.time + 5, t0: game.time };
      p.bdPerf.push(pf);
      markBuff(p, pf, true);
    }
    K.pose(game, p, SONGS.includes(id) ? K.clip(p, 'bolt', 0) : K.clip(p, 'swing', 1), 0.25);
    const rgb = SK[id].rgb || '255,215,110';
    V.circle(p.x, p.y, 150, rgb, 0.6, { style: 'holy', spin: 2, grow: true });
    FX.text(p.x, p.y - 205, SK[id].name + ' · ท่อน 1', `rgb(${rgb})`, 26);
    if (!own) return;
    NC.applyGear(game);
    if (isBard(p)) ensurePerf(); // (the verse labels are the bard's own: none on the FX capture's job-less hero; online the server's meters, js/online-bard.js)
  }
  for (const id of [...SONGS, ...DANCES]) RUN[id] = (game, p, lv) => startPerf(game, p, id, lv);
  // a note flying out (looks only)
  function noteFly(x, y, a, sp) {
    FX.add({ type: 'j3note', layer: 'glow', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 80, drag: 2.2, life: 0.9, hue: NOTE_HUES[noteI++ % 4] });
  }
  // a note that hits, bouncing on (n more)
  function bounceNote(game, p, id, e, n, k) {
    const hue = NOTE_HUES[noteI++ % 4];
    const hit = (f, left) => {
      K.hit(game, p, id, f, 0, 0, hue, k);
      V.sparks(f.x, f.y - 50, 5, hue, { size: 0.6 });
      const next = left > 0 ? others(game, f, 320, 3).find((o) => !o._bdHit) : null;
      f._bdHit = true; V.at(0.4, () => { f._bdHit = false; });
      if (next) K.shot(game, p, id, { from: [f.x, f.y - 50], ang: NC.angle(f.x, f.y - 50, next.x, next.y - 45), v: 900, range: 500, r: 30, home: 14, target: next, rgb: hue,
        look(ctx, q) { drawNote(ctx, q.x, q.y, hue, q.t, 1.1); }, hit(g) { if (g === next) hit(g, left - 1); } });
    };
    K.shot(game, p, id, { from: K.tip(p), ang: NC.angle(p.x, p.y - 70, e.x, e.y - 45), v: 950, range: 800, r: 30, home: 12, target: e, rgb: hue,
      look(ctx, q) { drawNote(ctx, q.x, q.y, hue, q.t, 1.2); }, hit(f) { hit(f, n); } });
  }
  RUN.bd_note = function (game, p, lv) {
    const e = K.target(game, p, 760, 300);
    castPose(game, p, 0.25);
    if (e) bounceNote(game, p, 'bd_note', e, 2);
  };
  RUN.bd_noterain = function (game, p, lv) {
    castPose(game, p, 0.3);
    const e = K.target(game, p, 700, 300), [tx, ty] = e ? [e.x, e.y] : K.ground(game, p, 440);
    const verse = Math.max(1, ...(p.bdPerf || []).map((x) => x.verse)), n = 6 + 2 * (verse - 1);
    K.rain(game, p, 'bd_noterain', tx, ty, 150, n, 1, { rgb: '255,190,230', ir: 70, fall: 0.35, from: [40, -700], color: '255,200,235',
      look(ctx, q) { if (!q.hue) q.hue = NOTE_HUES[noteI++ % 4]; drawNote(ctx, q.x, q.y, q.hue, q.t, 1.2); } });
  };
  RUN.bd_twirl = function (game, p, lv) {
    swingPose(game, p, 2, 0.25);
    let acc = 0, t = 0;
    FX.add({ type: 'timer', layer: 'none', life: 2, x: p.x, y: p.y, update(q, dt) {
      t += dt;
      const a = t * 14;
      for (let i = 0; i < 2; i++) V.flameAt(p.x + Math.cos(a + i * Math.PI) * 120, p.y - 30 + Math.sin(a + i * Math.PI) * 50, 26, 40, P.fire, 0.3, { vy: -40 });
      if ((acc += dt) >= 0.25) { acc -= 0.25; for (const e of K.around(game, p.x, p.y, 150)) { const r = K.hit(game, p, 'bd_twirl', e, 0, 0, '255,180,120'); if (r && !r.miss && roll(35)) NC.addStatus(game, e, 'burn'); } }
    } });
    V.light(p.x, p.y - 40, 380, '255,160,90', 0.8, 2, { follow: p, flick: true });
  };
  RUN.bd_lash = function (game, p, lv) {
    swingPose(game, p, 1, 0.3);
    const ang = p.aim, got = K.lineHits(game, p.x, p.y - 30, ang, 320, 60).sort((a, b) => NC.dist(a.x, a.y, p.x, p.y) - NC.dist(b.x, b.y, p.x, p.y))[0];
    const len = got ? NC.dist(p.x, p.y, got.x, got.y) : 320;
    FX.add({ type: 'cutline', x: p.x + Math.cos(ang) * 20, y: p.y - 70, x1: p.x + Math.cos(ang) * len, y1: p.y - 60 + Math.sin(ang) * len * 0.7, w: 7, color: '200,140,90', life: 0.25 });
    if (!got) return;
    V.slash(got.x, got.y - 60, 60, ang - 0.4, 1.2, 18, P.fire, 0.2, { rgb: '255,190,120' });
    K.hit(game, p, 'bd_lash', got, 0, 0, '255,200,140');
    K.pull(got, p.x + Math.cos(ang) * 90, p.y, 520);
  };
  RUN.bd_festival = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.5);
    const [x, y] = [p.x + Math.cos(p.aim) * 120, p.y + Math.sin(p.aim) * 60];
    if (!game.presentationOnly) p.bdFest = { x, y, until: game.time + 15, lv }; // (online the server's: its songs count there)
    shout(p, 'มหกรรมรอบกองไฟ!', '#ffd08a', 34);
    V.flash('255,200,140', 0.1, 0.3);
    let acc = 0;
    if (!game.presentationOnly) FX.add({ type: 'timer', layer: 'none', life: 15, x, y, // (online the server runs it: backend/job_bard_skills.go)
      update(q, dt) {
        if ((acc += dt) >= 1) {
          acc -= 1;
          for (const e of K.around(game, x, y, 320)) {
            const r = K.hit(game, p, 'bd_festival', e, 0, 0, '255,180,120');
            if (r && !r.miss) NC.addStatus(game, e, 'burn');
            if (!e._bdSlept) { e._bdSlept = true; NC.statusEnemy(game, e, 'stun', 2); sleepLook(e); }
          }
          for (const a of K.friends(game, p, 360)) if (NC.dist(a.x, a.y, x, y) < 360) { a.bless = game.time + 1.5; a.blessK = Math.max(a.blessK || 1, 1.25); heal(game, a, a.maxHp * 0.02, { quiet: true }); }
          NC.applyGear(game);
        }
      },
      onEnd() { NC.applyGear(game); } });
    // (the campfire stands 15 s: the bard's own, as its songs' labels are; none on the FX capture's job-less hero; online
    // the server's `bard` fire event draws it, js/online-bard.js)
    if (!isBard(p) || game.presentationOnly) return;
    campfire(x, y, 15);
  };
  function campfire(x, y, life) {
    FX.add({ type: 'j3fire', layer: 'sorted', life, x, y, sort: y,
      update(q, dt) {
        if (Math.random() < dt * 30) V.flameAt(x + rand(-40, 40), y - rand(0, 20), rand(40, 70), rand(100, 180), P.fire, rand(0.4, 0.7), { vy: -120 });
        if (Math.random() < dt * 6) noteFly(x + rand(-60, 60), y - 120, rand(-2.6, -0.5), rand(120, 220));
      } });
    V.light(x, y - 60, 700, '255,170,90', 1, life, { flick: true });
    V.decal(x, y, 120, 'scorch', life);
  }
  const sleepLook = (e) => FX.text(e.x, NC.labelTop(e) - 80, 'หลับ zZ', '#d8d0ff', 24);
  FX.def('j3fire', (ctx, q) => { // the festival's campfire: crossed logs and a ring of stones
    ctx.save(); ctx.translate(q.x, q.y);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 62, Math.sin(a) * 24, 13, 9, 0, 0, TAU); ctx.fillStyle = '#8a8490'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); }
    for (const r of [-0.5, 0.5]) { ctx.save(); ctx.rotate(r); ctx.fillStyle = '#7a4a2c'; ctx.fillRect(-50, -8, 100, 16); ctx.lineWidth = 3; ctx.strokeStyle = NC.OUTLINE; ctx.strokeRect(-50, -8, 100, 16); ctx.restore(); }
    ctx.restore();
    V.glow(ctx, q.x, q.y - 40, 160, '255,170,90', 0.5, true);
  }, 'sorted');

  const spOutLook = (p) => FX.text(p.x, p.y - 180, 'SP หมด เพลงหยุด', '#8fc8ff', 24);
  function verseLook(p, id, verse) {
    const rgb = SK[id].rgb || '255,215,110';
    FX.text(p.x, p.y - 205, 'ท่อน ' + verse + '!', `rgb(${rgb})`, 30);
    V.ring(p.x, p.y, 20, 200 + verse * 40, 8, rgb, 0.45);
  }
  const playingLook = (p, dt) => { if (Math.random() < dt * 5) noteFly(p.x + rand(-40, 40), p.y - 100, rand(-2.6, -0.5), rand(80, 160)); };
  const fireflyLook = (e) => { if (Math.random() < 0.3) V.motes(e.x + rand(-30, 30), e.y - rand(20, 80), 1, '200,255,130', { rise: 30, spread: 10, size: 0.9 }); };

  // every frame: SP, verses, the songs' and dances' effects on the team and the enemies
  const ensurePerf = persistent('j3perf');
  NC.skillTicks.push((game, p, dt) => {
    if (!isBard(p)) { if (p.bdPerf && p.bdPerf.length) p.bdPerf = []; return; }
    const perf = p.bdPerf || [];
    for (const pf of perf.slice()) {
      if (p.dead > 0 || (NC.weaponOk && !NC.weaponOk(p, pf.id)) || !(p.buffs && p.buffs[pf.id] > 0)) { stopPerf(game, p, pf, true); continue; }
      p.buffs[pf.id] = 999;
      p.sp -= 2 * dt;
      if (p.sp <= 0) { p.sp = 0; stopPerf(game, p, pf); spOutLook(p); continue; }
      if (pf.verse < 3 && game.time >= pf.next) {
        pf.verse++; pf.next += 5;
        verseLook(p, pf.id, pf.verse);
        NC.applyGear(game);
      }
      playingLook(p, dt);
    }
    // effects every 0.5 s
    p.bdAcc = (p.bdAcc || 0) + dt;
    if (p.bdAcc < 0.5) return;
    p.bdAcc -= 0.5;
    p.bdWarmT = (p.bdWarmT || 0) + 0.5;
    const team = [p, ...K.friends(game, p, 450)];
    for (const pf of perfsOf(p)) {
      const k = pf.mul, lv = pf.lv;
      if (pf.id === 'bd_tempo') for (const a of team) if (a !== p) { a.bless = game.time + 1; a.blessK = Math.max(a.blessK && a.bless > game.time ? a.blessK : 1, 1 + (lv * k) / 100); }
      if (pf.id === 'bd_warm' && p.bdWarmT >= 5) for (const a of team) heal(game, a, a.maxHp * (0.006 * lv * k), { quiet: a !== p });
      if (pf.id === 'bd_firefly') for (const e of K.around(game, p.x, p.y, 400)) { K.slow(e, 0.7); K.weak(game, e, 1 - (0.02 * lv * k), 0.7); fireflyLook(e); }
      if (pf.id === 'bd_lure') for (const e of K.around(game, p.x, p.y, 400)) { K.weak(game, e, 1 - (0.015 * lv * k), 0.7); K.vuln(game, e, 1 + (0.01 * lv * k), 0.7, '230,150,255'); if (e.state === 'idle') e.state = 'chase'; }
    }
    if (p.bdWarmT >= 5) p.bdWarmT = 0;
  });
  // the songs on the bard herself: attack speed, casts, cooldowns; slower while playing (unless วงดนตรี Lv 3)
  NC.skillModSources.push((p) => {
    if (!isBard(p)) return null;
    const m = {};
    for (const pf of perfsOf(p)) {
      if (pf.id === 'bd_tempo') m.aspd = (m.aspd || 0) + pf.lv * pf.mul;
      if (pf.id === 'bd_stars') { m.castRed = (m.castRed || 0) + 2 * pf.lv * pf.mul; m.cdr = (m.cdr || 0) + pf.lv * pf.mul; }
    }
    if (p.bdPerf && p.bdPerf.length && lvOf(p, 'bd_band') < 3) m.spd = -20;
    return m;
  });
  // the finale of เพลงเร่งจังหวะ: three sure criticals; จังหวะเร้าใจ: free notes while performing
  const baseHH2 = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const G = NC.game, p = G && G.player;
    if (p && d === p.d && isBard(p) && o && !o.skill && p.bdCrit > 0) { p.bdCrit--; o = Object.assign({}, o, { crit: true }); }
    return baseHH2.call(this, d, e, o);
  };
  NC.basicHits.push((game, p, e, r) => {
    if (!game || p !== game.player || !(r.dmg > 0) || !isBard(p)) return;
    const gl = lvOf(p, 'bd_groove');
    if (gl && p.bdPerf && p.bdPerf.length && roll(gl * 4)) V.at(0.05, () => { if (alive(e)) bounceNote(game, p, 'bd_note', e, 2, 1); });
  });
  // the verse over the bard's head
  FX.def('j3perf', (ctx) => {
    const G = NC.game, p = G && G.player;
    if (!isBard(p) || !p.bdPerf || !p.bdPerf.length || p.dead > 0) return;
    ctx.save(); ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1a1422';
    p.bdPerf.forEach((pf, i) => {
      const rgb = SK[pf.id].rgb || '255,215,110', y = p.y - 228 - i * 20, label = `♪ ${SK[pf.id].name} · ท่อน ${pf.verse}`;
      ctx.fillStyle = `rgb(${rgb})`; ctx.strokeText(label, p.x, y); ctx.fillText(label, p.x, y);
      const w = 90, u = pf.verse >= 3 ? 1 : 1 - (pf.next - G.time) / 5;
      ctx.fillStyle = 'rgba(20,14,28,0.7)'; ctx.fillRect(p.x - w / 2, y + 4, w, 4);
      ctx.fillStyle = `rgb(${rgb})`; ctx.fillRect(p.x - w / 2, y + 4, w * Math.max(0, Math.min(1, u)), 4);
    });
    ctx.restore();
  });
  // for the online client (js/online-bard.js): the labels' drawer, and the looks of the server's `bard` events
  NC.BardLooks = Object.freeze({ ensurePerf, finale: finaleLook, cd: cdLook, verse: verseLook, spOut: spOutLook, playing: playingLook,
    firefly: fireflyLook, campfire, sleep: sleepLook });

  // =====================================================================================================
  // ยมทูต: souls
  // =====================================================================================================
  const isRP = (p) => p && NC.isJob(p, 'reaper');
  const souls = (p) => p.rpSouls || 0;
  K.def({
    rp_souls: S({ name: 'เก็บวิญญาณ', icon: 'sk_rp_souls', pass: (lv, p) => ({ atk: r1(souls(p) * (1 + lv * 0.2)), aspd: lv >= 10 && souls(p) >= 10 ? 10 : 0 }),
      desc: (lv) => `ศัตรูที่ล้มในระยะ ${lv >= 5 ? 600 : 400} ทิ้งดวงวิญญาณ เก็บได้ 10 ดวง (ตีบอสทุก 10% HP ได้ 1 ดวง) ดวงละ ATK +${r1(1 + lv * 0.2)}% ดูดเลือด 0.2%${lv >= 10 ? ' · ครบ 10 ดวง ความเร็วโจมตี +10%' : ''}` }),
    rp_ghost: S({ name: 'ร่างวิญญาณ', icon: 'sk_rp_ghost', cd: 8, sp: () => 15, mul: (lv) => 0.9 + lv * 0.13,
      need: (game, p, lv) => (souls(p) >= (lv >= 10 ? 2 : 3) ? true : 'ดวงวิญญาณไม่พอ'),
      desc: (lv, m) => `ใช้ ${lv >= 10 ? 2 : 3} ดวง: กลายเป็นผี พุ่งทะลุศัตรูเป็นแนว 350 ${m}% ของ ATK ไม่โดนตีระหว่างนั้น${lv >= 5 ? ' · ทิ้งรอยหนาว ศัตรูช้าลง' : ''}` }),
    rp_shroud: S({ name: 'ผ้าคลุมแห่งความตาย', icon: 'sk_rp_shroud', kind: 'buff', cd: 30, sp: () => 30, rgb: '150,140,190', circle: 'arcane',
      dur: () => 30, buff: (lv, p) => ({ taken: Math.min(25, lv * souls(p)) }),
      desc: (lv) => `30 วิ: รับดาเมจลดลง ${lv}% ต่อดวงวิญญาณที่มี (สูงสุด 25%)` }),
    rp_death: S({ name: 'ความตายเยือน', icon: 'sk_rp_death', max: 5, pass: () => ({}),
      desc: (lv) => `ศัตรูเลือดต่ำกว่า 20% โดนเราแรงขึ้น 15%${lv >= 3 ? ' · ฆ่าได้แล้วได้ดวงวิญญาณเพิ่มอีก 1 ดวง' : ''}${lv >= 5 ? ' · ล้มแล้วลุกเป็นร่างวิญญาณ 5 วิ ฆ่าได้ระหว่างนั้นฟื้นกลับด้วย HP 30% (ทุก 3 นาที)' : ''}` }),
    rp_scythemastery: S({ name: 'ชำนาญเคียวใหญ่', icon: 'sk_rp_scythemastery', pass: (lv, p) => (wt(p) === 'scythe' ? { atk: lv * 2 } : null),
      desc: (lv) => `ถือเคียวใหญ่: ตีปกติกวาดกว้างโดนทุกตัวข้างหน้า ATK +${lv * 2}%` }),
    rp_sweep: S({ name: 'ฟันเก็บเกี่ยว', icon: 'sk_rp_sweep', free: 1, cd: 4, sp: () => 16, mul: (lv) => 1.25 + lv * 0.17,
      desc: (lv, m) => `หมุนเคียวรอบตัว 2 รอบ รอบละ ${m}% ของ ATK ดูดเลือด 5% ของดาเมจ${lv >= 5 ? ' · ดึงศัตรูเข้ากลางวง' : ''}${lv >= 10 ? ' · โดน 3 ตัวขึ้นไปได้ดวงวิญญาณ 1 ดวง' : ''}` }),
    rp_execute: S({ name: 'ประหารใต้จันทร์', icon: 'sk_rp_execute', cd: 10, sp: () => 25, mul: (lv) => 2.4 + lv * 0.36,
      desc: (lv, m) => `ฟันลงจากฟ้า ${m}% ของ ATK · ศัตรูธรรมดาที่เลือดต่ำกว่า 30% ตายทันที บอสโดนสองเท่าแทน` }),
    rp_twin: S({ name: 'เคียวคู่ประสาน', icon: 'sk_rp_twin', pass: (lv, p) => (wt(p) === 'sickle' ? { aspd: lv * 2 } : null),
      desc: (lv) => `ถือเคียวคู่: ความเร็วโจมตี +${lv * 2}% ตีแต่ละครั้งโอกาส ${lv * 3}% ติดเลือดไหล (4 วิ)` }),
    rp_return: S({ name: 'ขว้างเคียววกกลับ', icon: 'sk_rp_return', free: 1, cd: 3, sp: () => 14, mul: (lv) => 1.2 + lv * 0.15,
      desc: (lv, m) => `ขว้างเคียว${lv >= 10 ? ' 4 เล่มเป็นกากบาท' : 'สองเล่ม'}ไป 450 แล้ววกกลับ โดนทั้งขาไปขากลับ ${m}% ของ ATK${lv >= 5 ? ' · ขากลับดึงศัตรูเข้าหา' : ''}` }),
    rp_hook: S({ name: 'เกี่ยววิญญาณ', icon: 'sk_rp_hook', max: 5, cd: 6, sp: () => 12, mul: (lv) => 3.0 + lv * 0.5,
      desc: (lv, m) => `เกี่ยวเป้าเดียวดึงมาตรงหน้าแล้วฟัน ${m}% ของ ATK ได้ดวงวิญญาณ 1 ดวง` }),
    rp_storm: S({ name: 'พายุวิญญาณ', icon: 'sk_rp_storm', ult: true, max: 5, cd: 60, sp: () => 70, mul: (lv) => 0.16 + lv * 0.03,
      need: (game, p) => (souls(p) >= 1 ? true : 'ไม่มีดวงวิญญาณ'),
      desc: (lv, m) => `ใช้ดวงวิญญาณทั้งหมด: ดวงวิญญาณหมุนรอบตัวเป็นพายุ 6 วิ ทุกวิดวงละ ${m}% ของ ATK ดูดเลือด 10%` }),
  });

  function addSoul(game, p, n, from) {
    const was = souls(p);
    p.rpSouls = Math.min(10, was + n);
    if (p.rpSouls !== was) NC.applyGear(game);
    if (from) V.motes(from.x, from.y - 50, 4, SOUL, { rise: 80, spread: 20, size: 1 });
  }
  // a soul floating from the fallen to the reaper
  function soulFly(game, p, e) {
    const x0 = e.x, y0 = e.y - 60;
    K.proj({ x: x0, y: y0, vx: 0, vy: -80, life: 2, t0: game.time,
      update(q, dt) {
        const a = NC.angle(q.x, q.y, p.x, p.y - 80), sp = 300 + q.t * 700;
        q.vx += (Math.cos(a) * sp - q.vx) * Math.min(1, dt * 6); q.vy += (Math.sin(a) * sp - q.vy) * Math.min(1, dt * 6);
        if (NC.dist(q.x, q.y, p.x, p.y - 80) < 40) { q.dead = true; addSoul(game, p, 1, p); }
      },
      draw(ctx, q) { K.drawGhost(ctx, q.x, q.y, 11, q.t, SOUL, 0.9); } });
  }
  NC.skillKills.push((game, e) => {
    const p = game.player;
    if (!isRP(p)) return;
    // ความตายเยือน Lv 5: a kill while a ghost brings the reaper back
    if (p.rpGhostUntil > game.time) { p.rpGhostUntil = 0; p.inv = 0.6; p.hp = Math.max(p.hp, Math.round(p.maxHp * 0.3)); shout(p, 'ฟื้นคืนชีพ!', '#bfe8ff', 34); V.flash('190,230,255', 0.12, 0.3); }
    const lv = lvOf(p, 'rp_souls');
    if (!lv || NC.dist(e.x, e.y, p.x, p.y) > (lv >= 5 ? 600 : 400)) return;
    soulFly(game, p, e);
    if (lvOf(p, 'rp_death') >= 3) V.at(0.15, () => soulFly(game, p, e));
  });
  // a boss gives a soul for every tenth of its HP it loses; ความตายเยือน: +15% on the weak ones
  const baseDE = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r) {
    baseDE.apply(this, arguments);
    const p = game && game.player;
    if (!isRP(p) || !lvOf(p, 'rp_souls') || !e || !isBoss(e) || !(e.maxHp > 0)) return;
    const tenth = Math.floor((1 - Math.max(0, e.hp) / e.maxHp) * 10);
    if (e._rpTenth === undefined) e._rpTenth = tenth;
    if (tenth > e._rpTenth) { addSoul(game, p, tenth - e._rpTenth, e); e._rpTenth = tenth; }
  };
  const baseHH3 = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHH3.apply(this, arguments), G = NC.game, p = G && G.player;
    if (p && d === p.d && isRP(p) && r.dmg > 0 && e && e.maxHp > 0 && e.hp < e.maxHp * 0.2 && lvOf(p, 'rp_death') >= 1) r.dmg = Math.round(r.dmg * 1.15);
    return r;
  };
  // lifesteal from the souls; the sickles' bleed
  NC.basicHits.push((game, p, e, r) => {
    if (!game || p !== game.player || !(r.dmg > 0) || !isRP(p)) return;
    const s = souls(p);
    if (s && lvOf(p, 'rp_souls')) { p.rpSteal = (p.rpSteal || 0) + r.dmg * 0.002 * s; }
    const tl = lvOf(p, 'rp_twin');
    if (tl && wt(p) === 'sickle' && roll(tl * 3)) bleed(game, p, e);
  });
  function bleed(game, p, e) {
    if (!alive(e)) return;
    e.rpBleed = { t: 4, acc: 0, dmg: Math.max(1, Math.round((p.d.batk + (p.d.watk[0] + p.d.watk[1]) / 2) * 0.12)) };
    V.sparks(e.x, e.y - 50, 5, '220,60,80', { size: 0.6 });
  }
  NC.skillTicks.push((game, p, dt) => {
    for (const e of game.enemies) {
      const b = e.rpBleed;
      if (!b) continue;
      if (!alive(e) || (b.t -= dt) <= 0) { e.rpBleed = null; continue; }
      if ((b.acc += dt) >= 0.5) { b.acc -= 0.5; NC.damageEnemy(game, e, { dmg: b.dmg, mod: 1 }, 0, 0, { dot: true, fill: '#ff6a7a' }); if (Math.random() < 0.6) V.motes(e.x + rand(-14, 14), e.y - rand(30, 70), 1, '200,40,60', { rise: -40, spread: 4, size: 0.8 }); }
    }
    if (!isRP(p)) return;
    if (p.rpSteal > 1) { const h = Math.floor(p.rpSteal); p.rpSteal -= h; p.hp = Math.min(p.maxHp, p.hp + h); }
    if (p.rpGhostUntil && game.time > p.rpGhostUntil) { p.rpGhostUntil = 0; p.inv = 0; NC.hurtPlayer(game, p.maxHp * 10); }
    if (p.rpGhostUntil > game.time && Math.random() < dt * 12) V.ghost(p, '#9fd4ff', 0.35);
    ensureSouls();
  });
  // ความตายเยือน Lv 5: the killing blow turns the reaper into a ghost instead
  NC.heroGuards.push((game, p, dmg) => {
    if (!isRP(p) || lvOf(p, 'rp_death') < 5 || dmg < p.hp || p.rpGhostUntil > game.time || game.time < (p.rpReviveCd || 0)) return dmg;
    p.rpReviveCd = game.time + 180; p.rpGhostUntil = game.time + 5; p.hp = 1; p.inv = 5;
    shout(p, 'ร่างวิญญาณ! (ฆ่าให้ได้ใน 5 วิ)', '#bfe8ff', 28);
    V.flash('150,200,255', 0.12, 0.4);
    return 0;
  });
  // the souls circling the reaper
  const ensureSouls = persistent('j3souls', 'high');
  FX.def('j3souls', (ctx) => {
    const G = NC.game, p = G && G.player;
    if (!isRP(p) || p.dead > 0) return;
    const n = souls(p), t = G.time;
    for (let i = 0; i < n; i++) {
      const a = t * 1.3 + (i / Math.max(1, n)) * TAU, x = p.x + Math.cos(a) * 62, y = p.y - 70 + Math.sin(a) * 22 + Math.sin(t * 3 + i) * 5;
      K.drawGhost(ctx, x, y, 8, t + i, SOUL, Math.sin(a) > 0 ? 0.95 : 0.55);
    }
  });

  RUN.rp_ghost = function (game, p, lv) {
    p.rpSouls = souls(p) - (lv >= 10 ? 2 : 3);
    NC.applyGear(game);
    const ang = p.aim;
    V.ghost(p, '#9fd4ff', 0.5);
    K.dash(game, p, 'rp_ghost', ang, 350, 0.3, { rgb: SOUL, pal: P.ice,
      hit(e) { K.hit(game, p, 'rp_ghost', e, Math.cos(ang) * 100, Math.sin(ang) * 70, '190,230,255'); V.motes(e.x, e.y - 60, 5, SOUL, { rise: 90, spread: 20 }); },
      tick(pl) { if (Math.random() < 0.7) V.ghost(pl, '#9fd4ff', 0.35); if (lv >= 5 && Math.random() < 0.5) V.smoke(pl.x, pl.y - 10, 1, '#dff4ff', '#ffffff', { size: 0.8, lifeK: 0.7, a: 0.6 }); },
      end() {
        if (lv >= 5) { const x0 = p.x, y0 = p.y; K.zone(game, p, 'rp_ghost', x0 - Math.cos(ang) * 175, y0 - Math.sin(ang) * 120, 190, 3, 0.5, { hits: false, circle: false, glow: false, rgb: SOUL, each(e) { K.slow(e, 0.8); } }); }
      } });
  };
  RUN.rp_sweep = function (game, p, lv) {
    swingPose(game, p, 2, 0.4);
    for (let i = 0; i < 2; i++) V.at(i * 0.2, () => {
      K.slashAt(p.x, p.y + 10, 190, i ? Math.PI : 0, [ '#3a3a52', '#9a9ab8', '#ffffff' ], '200,210,235', { sweep: TAU * 0.95, thick: 34, life: 0.3 });
      let n = 0, dealt = 0;
      for (const e of K.around(game, p.x, p.y, 200)) {
        if (lv >= 5) K.pull(e, p.x, p.y, 260);
        const r = K.hit(game, p, 'rp_sweep', e, 0, 0, '220,225,245');
        if (r && !r.miss) { n++; dealt += r.dmg; }
      }
      if (dealt) p.rpSteal = (p.rpSteal || 0) + dealt * 0.05; // (lifesteal: added up quietly, see the tick)
      if (lv >= 10 && n >= 3) addSoul(game, p, 1, p);
      V.shake(game, 3);
    });
  };
  // (online the server decides it: its combat event says executed, server/server/fx_flags.go, and the shout plays from it)
  const SERVER_HIT = (NC.SKILL_SERVER_HIT = NC.SKILL_SERVER_HIT || {});
  SERVER_HIT.rp_execute = (e, p, ev) => { if (ev && ev.executed) FX.text(e.x, NC.labelTop(e) - 90, 'ประหาร!', '#e6ecff', 32); };
  RUN.rp_execute = function (game, p, lv) {
    const e = K.target(game, p, 520, 260);
    swingPose(game, p, 1, 0.45);
    const [x, y] = e ? [e.x, e.y] : K.ground(game, p, 300);
    V.circle(x, y, 110, '200,210,255', 0.4, { style: 'holy', spin: 3, grow: true });
    V.at(0.22, () => {
      V.beam(x, y, 70, 560, '200,210,255', 0.3);
      K.slashAt(x, y - 30, 130, -1.9, ['#3a3a52', '#b8c0e8', '#ffffff'], '210,220,255', { sweep: 1.3, thick: 40, life: 0.3 });
      V.shake(game, 6);
      for (const f of K.around(game, x, y, 120)) {
        const low = f.maxHp > 0 && f.hp < f.maxHp * 0.3;
        if (low && !isBoss(f) && !f.dummy) { NC.damageEnemy(game, f, { dmg: Math.ceil(f.hp) + 1, mod: 1, crit: true }, 0, -120, { color: '220,225,255', big: true }); if (!game.presentationOnly) FX.text(f.x, NC.labelTop(f) - 90, 'ประหาร!', '#e6ecff', 32); }
        else K.hit(game, p, 'rp_execute', f, 0, -120, '220,225,255', low && isBoss(f) ? 2 : 1, { big: true });
      }
    });
  };
  RUN.rp_return = function (game, p, lv) {
    swingPose(game, p, 1, 0.25);
    const angs = lv >= 10 ? [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => p.aim + a) : [p.aim - 0.14, p.aim + 0.14];
    for (const a0 of angs) {
      const out = new Set(), back = new Set(), x0 = p.x, y0 = p.y - 60;
      let t = 0;
      K.proj({ x: x0, y: y0, vx: 0, vy: 0, life: 1.1, rot: 0,
        update(q, dt) {
          t += dt;
          const u = Math.min(1, t / 0.5), goingBack = t > 0.5, d = goingBack ? 450 * Math.max(0, 1 - (t - 0.5) / 0.55) : 450 * Math.sin(u * Math.PI / 2);
          const hx = goingBack ? p.x : x0, hy = goingBack ? p.y - 60 : y0;
          q.x = hx + Math.cos(a0) * d; q.y = hy + Math.sin(a0) * d * 0.75; q.rot += dt * 22;
          const set = goingBack ? back : out;
          for (const e of game.enemies) if (alive(e) && !set.has(e) && NC.dist(q.x, q.y, e.x, e.y - 45) < 40 + e.r) {
            set.add(e);
            K.hit(game, p, 'rp_return', e, 0, 0, '220,225,245');
            V.sparks(q.x, q.y, 5, '220,225,245', { size: 0.6 });
            if (goingBack && lv >= 5) K.pull(e, p.x, p.y, 300);
          }
          if (goingBack && d <= 5) q.dead = true;
        },
        draw(ctx, q) {
          const s = NC.SPR.w_sickles;
          if (s) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.drawImage(s.img, -s.w / 2, -s.h / 2, s.w, s.h); ctx.restore(); }
          else K.drawBlade(ctx, q.x, q.y, q.rot, 40, 8, '#dfe6ef', '200,210,235');
          V.glow(ctx, q.x, q.y, 34, '190,200,235', 0.4, true);
        } });
    }
  };
  RUN.rp_hook = function (game, p, lv) {
    const e = K.target(game, p, 450, 240);
    swingPose(game, p, 0, 0.35);
    if (!e) return;
    const [hx, hy] = K.hand(p);
    FX.add({ type: 'cutline', x: hx, y: hy, x1: e.x, y1: e.y - 50, w: 5, color: '170,160,200', life: 0.3 });
    V.at(0.12, () => {
      if (!alive(e)) return;
      if (!isBoss(e)) { e.x = p.x + Math.cos(p.aim) * 90; e.y = p.y + Math.sin(p.aim) * 50; }
      K.slashAt(e.x, e.y - 50, 80, -0.8, ['#3a3a52', '#9a9ab8', '#ffffff'], '210,215,240', { sweep: 1.6, thick: 26 });
      K.hit(game, p, 'rp_hook', e, 0, 0, '220,225,245');
      addSoul(game, p, 1, e);
    });
  };
  RUN.rp_storm = function (game, p, lv) {
    const n = souls(p);
    p.rpSouls = 0; NC.applyGear(game);
    K.pose(game, p, 'cheer', 0.5);
    shout(p, 'พายุวิญญาณ!', '#bfe8ff', 34);
    V.flash('170,220,255', 0.1, 0.3);
    let acc = 0, t = 0;
    FX.add({ type: 'j3storm', layer: 'glow', life: 6, x: p.x, y: p.y, n,
      update(q, dt) {
        t += dt; q.x = p.x; q.y = p.y;
        if ((acc += dt) >= 0.5) {
          acc -= 0.5;
          let dealt = 0;
          for (const e of K.around(game, p.x, p.y, 190)) { const r = K.hit(game, p, 'rp_storm', e, 0, 0, '190,230,255', n / 2); if (r && !r.miss) dealt += r.dmg; }
          if (dealt) p.rpSteal = (p.rpSteal || 0) + dealt * 0.1;
        }
      } });
    V.light(p.x, p.y - 60, 480, SOUL, 0.8, 6, { follow: p });
  };
  FX.def('j3storm', (ctx, q) => {
    const G = NC.game, t = G ? G.time : 0;
    for (let i = 0; i < q.n; i++) for (const ring of [0, 1]) {
      const a = t * (3 + ring) + (i / q.n) * TAU + ring, R = ring ? 170 : 110, x = q.x + Math.cos(a) * R, y = q.y - 60 + Math.sin(a) * R * 0.4;
      K.drawGhost(ctx, x, y, ring ? 12 : 10, t + i, SOUL, 0.85);
    }
    V.glow(ctx, q.x, q.y - 60, 220, SOUL, 0.18, true);
  });

  // =====================================================================================================
  // lines, the skill list, the weapon rules
  // =====================================================================================================
  const LINES = {
    bard: [['songs', 'เพลงรอบกองไฟ', 'neutral', null, 0], ['dance', 'ระบำไฟ', 'fire', null, 0], ['notes', 'โน้ตดนตรี', 'neutral', 'rapid', 1], ['fest', 'มหกรรมรอบกองไฟ', 'fire', null, 0]],
    gunslinger: [['cyl', 'โม่เสี่ยงดวง', 'neutral', 'aim', 0], ['pistol', 'ปืนพกคู่', 'neutral', 'rapid', 1], ['shotgun', 'ลูกซอง', 'neutral', 'rain', 0], ['stars', 'ยิงดาวตก', 'neutral', null, 0]],
    reaper: [['souls', 'ดวงวิญญาณ', 'shadow', 'shadow', 0], ['scythe', 'เคียวเก็บเกี่ยว', 'neutral', null, 0], ['sickle', 'เคียวคู่หมุนวน', 'neutral', 'blade', 1], ['storm', 'พายุวิญญาณ', 'shadow', null, 0]],
  };
  const PLAN = {
    bard: [
      ['bd_tempo', 'songs', 10, 1, [], 'ท่อนขึ้นทุก 5 วิ แรง ×1 / ×1.5 / ×2 · กดซ้ำตอนท่อน 2 ขึ้นไป = ท่อนฮุก'],
      ['bd_warm', 'songs', 10, 0, [['bd_tempo', 3]], 'ท่อนฮุกฮีลทั้งทีม'],
      ['bd_stars', 'songs', 10, 0, [['bd_tempo', 3]], 'ท่อนฮุกลดคูลดาวน์สกิลที่นานที่สุด 30%'],
      ['bd_band', 'songs', 5, 0, [['bd_warm', 3]], 'Lv1 เพลงค้าง 3 วิ · Lv3 เดินได้ปกติ · Lv5 เล่น 2 เพลงพร้อมกัน'],
      ['bd_twirl', 'dance', 10, 1, [], 'ติดเผา'],
      ['bd_firefly', 'dance', 10, 0, [['bd_twirl', 3]], 'ท่อนยิ่งสูงยิ่งแรง'],
      ['bd_lure', 'dance', 10, 0, [['bd_twirl', 3]], 'ศัตรูหันมาตามผู้รำ'],
      ['bd_lash', 'dance', 5, 0, [['bd_twirl', 1]], 'ดึงศัตรูเข้าหา'],
      ['bd_note', 'notes', 10, 0, [['double', 3]], 'เด้งต่อ 2 ตัว'],
      ['bd_noterain', 'notes', 10, 0, [['bd_note', 3]], 'ท่อนเพลงยิ่งสูงยิ่งตกเพิ่ม'],
      ['bd_groove', 'notes', 5, 0, [['bd_note', 5]], 'ระหว่างเล่นหรือรำเท่านั้น'],
      ['bd_festival', 'fest', 5, 0, ['|', ['bd_band', 1], ['bd_lure', 5]], 'ทุกเพลงที่เรียนไว้ที่ท่อน 3'],
    ],
    gunslinger: [
      ['gs_spin', 'cyl', 10, 0, [['ar_owl', 1]], 'Lv10 ไม่ออกด้านเลย'],
      ['gs_sixth', 'cyl', 10, 0, [], 'ทุกนัดที่ 6 คริแน่นอน'],
      ['gs_special', 'cyl', 10, 0, [['gs_spin', 3]], 'ธาตุสลับไฟ น้ำแข็ง สายฟ้า'],
      ['gs_eye', 'cyl', 5, 0, [['ar_owl', 3]], '-'],
      ['gs_mastery', 'pistol', 10, 0, [], 'บรรจุเร็วขึ้น'],
      ['gs_rapid', 'pistol', 10, 0, [['gs_mastery', 3]], 'นัดฟรีไม่กินกระสุน'],
      ['gs_triple', 'pistol', 10, 1, [], '-'],
      ['gs_ricochet', 'pistol', 5, 0, [['gs_triple', 5]], 'เด้งเพิ่มทุก 2 เลเวล'],
      ['gs_buckshot', 'shotgun', 10, 1, [], 'ใกล้ยิ่งโดนหลายลูก'],
      ['gs_kick', 'shotgun', 5, 0, [['gs_buckshot', 3]], 'เราถอยหลัง 200'],
      ['gs_smoke', 'shotgun', 10, 0, [], 'ใช้ได้ทุกอาวุธ'],
      ['gs_stars', 'stars', 5, 0, ['|', ['gs_ricochet', 3], ['gs_kick', 3]], 'ดาวตก 12 ดวง'],
    ],
    reaper: [
      ['rp_souls', 'souls', 10, 0, [], 'Lv5 เก็บได้ไกลขึ้น · Lv10 ครบ 10 ดวง ตีเร็วขึ้น 10%'],
      ['rp_ghost', 'souls', 10, 0, [['rp_souls', 3]], 'Lv5 ทิ้งรอยหนาว · Lv10 ใช้แค่ 2 ดวง'],
      ['rp_shroud', 'souls', 10, 0, [['rp_souls', 3]], '-'],
      ['rp_death', 'souls', 5, 0, [['rp_souls', 5]], 'Lv1 ศัตรูเลือดน้อยโดนแรงขึ้น · Lv3 ฆ่าได้วิญญาณเพิ่ม · Lv5 ล้มแล้วลุกเป็นร่างวิญญาณ'],
      ['rp_scythemastery', 'scythe', 10, 0, [], '-'],
      ['rp_sweep', 'scythe', 10, 1, [], 'Lv5 ดึงเข้ากลาง · Lv10 โดน 3 ตัวได้วิญญาณ'],
      ['rp_execute', 'scythe', 10, 0, [['rp_sweep', 5]], 'ตายทันทีต่ำกว่า 30% (ศัตรูธรรมดา)'],
      ['rp_twin', 'sickle', 10, 0, [['ro_dagger', 3]], 'เลือดไหล 4 วิ'],
      ['rp_return', 'sickle', 10, 1, [], 'Lv5 ขากลับดึง · Lv10 4 เล่มกากบาท'],
      ['rp_hook', 'sickle', 5, 0, [['rp_return', 3]], 'ได้วิญญาณ 1 ดวง'],
      ['rp_storm', 'storm', 5, 0, ['|', ['rp_execute', 5], ['rp_hook', 3]], 'ยิ่งมีวิญญาณยิ่งแรง'],
    ],
  };
  for (const job in PLAN) {
    const J = NC.JOBS[job];
    if (!J) continue;
    J.lines = LINES[job].map(([id, name, el, parent, auto]) => ({ id, name, el, parent: parent || null, auto: !!auto }));
    J.skills = PLAN[job].map((r) => r[0]);
    for (const [id, line, max, free, req, grow] of PLAN[job]) {
      const Sk = SK[id];
      if (!Sk) { console.warn('jobs3 b: no skill', id); continue; }
      Sk.line = line; Sk.max = max; Sk.free = free; Sk.grow = grow;
      const any = req[0] === '|';
      Sk.req = any ? req.slice(1) : req;
      Sk.reqAny = any;
    }
  }
  if (NC.weaponRule) {
    const R = NC.weaponRule;
    for (const id of ['bd_tempo', 'bd_warm', 'bd_stars', 'bd_band']) R(id, 'n:instrument');
    for (const id of ['bd_twirl', 'bd_firefly', 'bd_lure', 'bd_lash']) R(id, 'n:whip');
    for (const id of ['bd_note', 'bd_noterain', 'bd_festival']) R(id, 'n:instrument,whip');
    for (const id of ['gs_sixth', 'gs_eye', 'gs_stars']) R(id, 'n:pistol,shotgun');
    for (const id of ['gs_mastery', 'gs_rapid', 'gs_triple', 'gs_ricochet']) R(id, 'n:pistol');
    for (const id of ['gs_buckshot', 'gs_kick']) R(id, 'n:shotgun');
    for (const id of ['rp_scythemastery', 'rp_sweep', 'rp_execute']) R(id, 'n:scythe');
    for (const id of ['rp_twin', 'rp_return', 'rp_hook']) R(id, 'n:sickle');
  }
})();
