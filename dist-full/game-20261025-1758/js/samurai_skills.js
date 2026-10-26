/* samurai_skills.js — the Samurai line's skills (samurai.js has the jobs and their gear; unreleased catalog source). Their
   effects are drawn by code with the crimson shield's recipe (tools/samurai_fx.py: flat tones, a dark outline, marbled
   streaks, foam dissolves, a bloom sheet each) in three palettes: moon (blue-white), blood, wind (jade). NC.SamFX plays
   the sheets (assets/vfx2d/samurai/: slash, ring, pop, burst in each palette, the moon discs, the wind's tornado).
     ซามูไร        ใจดาบ (Ki, 0–100) from hits; full: the next skill hits ×1.5 and the gauge empties
                   lines: ดาบจันทร์ (crescent cut, flying waves, the full-moon ultimate) · ชักดาบ (a dash whose cuts open
                   after it, a counter stance) · ใจดาบ (the auto-attack line: Ki, every 3rd swing a crescent, criticals)
     ซามูไรเลือด   blood skills cost HP, not SP (refused when the HP isn't there); เลือดไหล (bleeding, up to 10 stacks)
                   from swings and cuts; ผลิบานโลหิต bursts the wounds, ดื่มโลหิต drinks blood back, โล่โลหิต is the
                   crimson shield (it soaks hits, then blows up), จันทร์สีเลือด the ultimate
     ซามูไรลม      กระแสลม (Wind, 0–100) filled by moving and dashing: more damage and speed; ก้าวลม is a dash with
                   charges (a kill gives one back), every dash leaves a wind blade that flies back to the hero
                   (ลมหวนกลับ); a tornado that walks with the hero; the ultimate warps from monster to monster
   The ids skip rotiming.js's class list: the dash with charges keeps its own timing (S.ro = 'own'). Loaded right after
   samurai.js, before rotiming.js. */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC.JOBS.samurai) return;
  const FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS;
  const { TAU } = K;
  const rand = NC.rand, S = K.S, alive = K.alive;
  const lvOf = (p, id) => NC.skillLv(p, id);
  const r1 = (v) => Math.round(v * 10) / 10;
  const isSam = (p) => p && NC.isJob(p, 'samurai');
  const isBS = (p) => p && NC.isJob(p, 'bloodsamurai');
  const isWD = (p) => p && NC.isJob(p, 'windsamurai');
  const MOON = '170,200,255', BLOOD = '255,50,80', WIND = '120,240,190';
  const MPAL = ['#3a54b2', '#98c4ff', '#ffffff'], BPAL = ['#7a0826', '#ff4a66', '#ffd8cc'], WPAL = ['#1e9e7c', '#aaf2ce', '#ffffff'];
  const shout = (p, text, fill) => FX.text(p.x, p.y - 200, text, fill || '#cfe0ff', 30);

  // =====================================================================================================
  // the effect sheets (tools/samurai_fx.py → assets/vfx2d/samurai/, meta.json): 15 fps, one row each, a bloom sheet
  // at half size added with 'lighter'
  // =====================================================================================================
  const D = 'assets/vfx2d/samurai/';
  const SH = {};
  const sheet = (name, w, h, n, ax, ay) => { SH[name] = { w, h, n, ax, ay }; };
  for (const pal of ['moon', 'blood', 'wind']) {
    sheet('arc_' + pal, 448, 448, 10, 224, 224);   // the swoosh round the centre, on its right, top to bottom (radius 150), torn inner edge
    sheet('ring_' + pal, 448, 448, 10, 224, 224);  // a full circle cut (radius 144)
    sheet('pop_' + pal, 192, 192, 8, 96, 96);
    sheet('burst_' + pal, 384, 384, 12, 192, 192);
  }
  for (const pal of ['moon', 'blood', 'wind', 'ink']) sheet('ribbon_' + pal, 512, 128, 10, 256, 64); // the blade-shaped cut (492 long, head right)
  sheet('ink', 512, 512, 10, 256, 256);  // the black brush sweep (radius 170)
  sheet('star', 256, 256, 6, 128, 128);  // the impact star
  sheet('disc_moon', 256, 256, 6, 128, 128); sheet('disc_blood', 256, 256, 6, 128, 128); // (radius 95: loops)
  sheet('tornado_wind', 256, 448, 12, 128, 430); // (feet at the anchor, 400 tall: a loop)
  // the Blood Samurai's cuts rendered in Blender after the reference clip (tools/blender/blood_kit.py -> tools/blood_sheets.py):
  // flat colour, no outline. Ribbons 556 long round their middle (head right), the hood's anchor is the foot of its dome
  // (radius 132), the swooshes turn round their centre (radius 188)
  for (const n of ['b3_ribbon_a', 'b3_ribbon_b', 'b3_ribbon_ink']) sheet(n, 640, 200, 10, 320, 100);
  sheet('b3_hood', 384, 384, 10, 164, 274);
  sheet('b3_swoosh_h', 512, 512, 10, 256, 256); sheet('b3_swoosh_d', 512, 512, 10, 256, 256);
  // ... and made the game-VFX way in Unity (meshes + painted textures + an eroding shader:
  // RenderBloodSlash.cs -> tools/unity_sheets.py; these u_* sheets are not uploaded, tools/online/build_web.py): the hit, its hood BEHIND the monster
  // and the cuts, star and sparks IN FRONT; the hit point at the frame's centre, 114 px a Unity unit
  sheet('u_bloodhit_back', 640, 480, 24, 320, 240); sheet('u_bloodhit_front', 640, 480, 24, 320, 240);
  // ... and as hand-drawn-looking 2D frames after the user's second reference (a flame-combo reference, in blood red:
  // tools/blood2d.py): the swing smear, its centre (the hero's chest) at the anchor, 30 fps
  sheet('bslash', 560, 480, 14, 300, 290);
  sheet('bswirl', 640, 640, 16, 320, 320); sheet('bball', 384, 384, 14, 192, 192); sheet('bthrust', 768, 256, 12, 120, 128);
  // ... and the same in the Wind Samurai's jade (tools/blood2d.py --pal wind)
  sheet('wslash', 560, 480, 14, 300, 290); sheet('wswirl', 640, 640, 16, 320, 320); sheet('wball', 384, 384, 14, 192, 192); sheet('wthrust', 768, 256, 12, 120, 128);
  // ... and the 1st-job Samurai's moonlight (tools/blood2d.py --pal moon), + its full moon (radius 150, a 12-frame loop)
  sheet('mslash', 560, 480, 14, 300, 290); sheet('mswirl', 640, 640, 16, 320, 320); sheet('mball', 384, 384, 14, 192, 192); sheet('mthrust', 768, 256, 12, 120, 128);
  sheet('mmoon', 448, 448, 12, 224, 224);
  const IMG = {};
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  for (const n in SH) { IMG[n] = load(D + n + '.webp'); IMG[n + '_glow'] = load(D + n + '_glow.webp'); }
  const SF = (NC.SamFX = { bloom: 0.55, ready: () => Object.values(IMG).every(ok) });
  // frame f of a sheet, its anchor at (x, y), scaled k; o: flip (mirrored, the hero facing left), tilt (turned before
  // the squash: a slanted ellipse), sy (squash: a cut seen lying round the body), rot, flipY, a, part 'glow'
  function blit(ctx, name, f, x, y, k, o) {
    o = o || {};
    const s = SH[name], glow = o.part === 'glow', img = IMG[name + (glow ? '_glow' : '')];
    if (!s || !ok(img) || k <= 0) return;
    const fw = glow ? s.w / 2 : s.w, fh = glow ? s.h / 2 : s.h;
    f = Math.max(0, Math.min(s.n - 1, f | 0));
    ctx.save();
    ctx.translate(x, y);
    if (o.flip) ctx.scale(-1, 1);
    if (o.tilt) ctx.rotate(o.tilt);
    if (o.sy) ctx.scale(1, o.sy);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flipY) ctx.scale(1, -1);
    if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= SF.bloom * (o.glowK || 1); }
    if (o.a !== undefined) ctx.globalAlpha *= Math.max(0, Math.min(1, o.a));
    ctx.drawImage(img, f * fw, 0, fw, fh, -s.ax * k, -s.ay * k, s.w * k, s.h * k);
    ctx.restore();
  }
  const both = (ctx, name, f, x, y, k, o) => { blit(ctx, name, f, x, y, k, o); if (!(o && o.noGlow)) blit(ctx, name, f, x, y, k, Object.assign({}, o, { part: 'glow' })); };
  SF.blit = both;
  FX.def('samfx', (ctx, q) => {
    const s = SH[q.name];
    if (!s || q.t < (q.delay || 0)) return;
    const t = q.t - (q.delay || 0), life = q.life - (q.delay || 0);
    const f = q.loop ? Math.floor(t * (q.fps || 15)) % s.n : q.frame !== undefined ? q.frame : Math.min(s.n - 1, Math.floor((t / life) * s.n));
    let a = q.a === undefined ? 1 : q.a;
    if (q.fadeIn) a *= Math.min(1, t / q.fadeIn);
    if (q.fadeOut) a *= Math.min(1, (life - t) / q.fadeOut);
    const x = q.follow ? q.follow.x + (q.ox || 0) : q.x, y = q.follow ? q.follow.y + (q.oy || 0) : q.y;
    const k = q.k * (q.grow ? 1 + q.grow * (t / life) : 1);
    both(ctx, q.name, f, x, y, k, { rot: q.rot, flip: q.flip, flipY: q.flipY, tilt: q.tilt, sy: q.sy, a, glowK: q.glowK, noGlow: q.noGlow });
  }, 'glow');
  // play a sheet at (x, y): o = k, rot, tilt, sy, flip, flipY, life (default: its frames at 15 fps), delay, loop,
  // follow (+ox, oy), a, fadeIn / fadeOut, grow, layer
  SF.play = (name, x, y, o) => FX.add(Object.assign({ type: 'samfx', name, x, y, k: 1, rot: 0, life: SH[name].n / 15 + ((o && o.delay) || 0) }, o || {}));
  // the aim as the hero sees it: facing left mirrors the effect, rel = the aim off straight ahead (- up, + down)
  const facing = (ang) => { const left = Math.cos(ang) < 0, rel = left ? Math.PI - ang : ang; return { left, rel: Math.atan2(Math.sin(rel), Math.cos(rel)) }; };
  // a sweeping cut round (x, y) towards ang, reach r: the swoosh lying round the body (squashed: from behind, round
  // the front), slanted by the aim and by o.tilt (+ down to the front, - rising); o.flipY sweeps the other way
  SF.cut = (pal, x, y, ang, r, o) => {
    const f = facing(ang), oo = Object.assign({}, o || {});
    const tilt = (oo.tilt || 0) + f.rel * 0.6;
    delete oo.tilt;
    return SF.play('arc_' + pal, x, y, Object.assign({ k: r / 150, flip: f.left, tilt, sy: 0.46, life: 0.6 }, oo));
  };
  // the ink stroke on the ground under a sweep (black sumi-e), round (x, y), radius r
  SF.ink = (x, y, ang, r, o) => SF.play('ink', x, y, Object.assign({ k: r / 170, flip: facing(ang).left, sy: 0.4, layer: 'low', life: 0.75, noGlow: true }, o || {}));
  // a blade-shaped cut centred on (x, y) along ang, len long
  SF.ribbon = (pal, x, y, ang, len, o) => SF.play('ribbon_' + pal, x, y, Object.assign({ k: len / 492, rot: ang, flipY: Math.cos(ang) < 0, life: 0.55, noGlow: pal === 'ink' }, o || {}));
  // the impact: the gold star and a spray of thin sparks
  SF.star = (x, y, k, o) => { SF.play('star', x, y, Object.assign({ k: k || 1, rot: rand(-0.4, 0.4), life: 0.36 }, o || {})); SF.sparks(x, y, Math.round(6 + 6 * (k || 1))); };
  // an X: two cuts crossing on (x, y), size long, the second a beat later, a star where they cross
  SF.xcut = (pal, x, y, size, o) => {
    o = o || {};
    const base = o.ang !== undefined ? o.ang : rand(-0.3, 0.3), spread = o.spread || rand(0.55, 0.8);
    SF.ribbon(pal, x, y, base - spread, size, { life: 0.5 });
    SF.ribbon(pal, x, y, base + spread + Math.PI, size, { life: 0.5, delay: o.gap === undefined ? 0.06 : o.gap });
    V.at(0.05, () => SF.star(x, y, o.star || 0.7));
  };
  // ---- the Blood Samurai's cuts (Blender) ----
  // the swing: a swoosh round (x, y) towards ang, reach r (o.flat: the lying one, else the slanted one; o.flipY the other way)
  SF.bcut = (x, y, ang, r, o) => {
    const f = facing(ang), oo = Object.assign({}, o || {}), tilt = (oo.tilt || 0) + f.rel * 0.6;
    delete oo.tilt;
    return SF.play(oo.flat ? 'b3_swoosh_h' : 'b3_swoosh_d', x, y, Object.assign({ k: r / 188, flip: f.left, tilt, life: 0.62, noGlow: true }, oo));
  };
  // the Unity hit: two red cuts crossing on the monster, the hood behind it, the star and sparks (k: its size)
  SF.uhit = (e, ang, k, hood) => {
    const f = facing(ang), o = { k: k || 0.62, flip: f.left, life: 0.8, noGlow: true };
    if (hood !== false) SF.play('u_bloodhit_back', e.x, e.y - 58, Object.assign({ layer: 'low' }, o));
    SF.play('u_bloodhit_front', e.x, e.y - 58, o);
  };
  // the hit on a monster: two red cuts crossing on it, the crimson hood behind it (the far side from the hero), the star
  SF.bhit = (e, ang, size, o) => {
    o = o || {};
    const f = facing(ang), x = e.x, y = e.y - 62, len = size || 330;
    const base = rand(-0.12, 0.12);
    SF.play('b3_ribbon_a', x, y, { k: len / 556, rot: base - 0.62, flip: f.left, life: 0.66, noGlow: true });
    SF.play('b3_ribbon_b', x, y + 6, { k: len / 556, rot: base + 0.5, flip: f.left, life: 0.66, delay: 0.05, noGlow: true });
    if (o.hood !== false) SF.play('b3_hood', x + (f.left ? -18 : 18), e.y + 6, { k: (len * 0.36) / 132, flip: f.left, life: 0.7, layer: 'low', noGlow: true });
    V.at(0.04, () => SF.star(x, y, o.star || 0.75));
  };

  // dark red speed bars across the view behind everyone (the reference's big swings), round (x, y)
  FX.def('sambars', (ctx, q) => {
    const u = q.t / q.life, a = (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85) * 0.8;
    ctx.save();
    ctx.fillStyle = 'rgba(90,6,22,' + a.toFixed(3) + ')';
    for (const [dy, h, w0, w1] of q.bars) ctx.fillRect(q.x + q.dir * w0 - (q.dir < 0 ? w1 - w0 : 0), q.y + dy, (w1 - w0) * (0.6 + 0.4 * u), h);
    ctx.restore();
  }, 'low');
  // the world dimmed under the effects (drawn on the 'high' layer: after the characters, before the glow layer)
  FX.def('samdim', (ctx, q) => {
    const u = q.t / q.life, a = q.a * Math.min(1, q.t / 0.15) * Math.min(1, (q.life - q.t) / 0.4);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(18,4,12,' + a.toFixed(3) + ')'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }, 'high');
  SF.bars = (x, y, dir) => FX.add({ type: 'sambars', x, y, dir: dir || 1, life: 0.45, bars: [[-150, 18, -520, 380], [-95, 9, -380, 520], [-40, 26, -620, 260], [30, 12, -420, 600], [80, 20, -560, 300]] });

  // sparks: thin gold streaks flung out (drawn by code: crisp at any size)
  FX.def('samspark', (ctx, q) => {
    const u = q.t / q.life, sp = Math.hypot(q.vx, q.vy) || 1, len = q.len * (1 - u * 0.6);
    const x1 = q.x - (q.vx / sp) * len, y1 = q.y - (q.vy / sp) * len;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(' + q.rgb + ',' + (1 - u) + ')'; ctx.lineWidth = q.w * (1 - u * 0.7); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.restore();
  }, 'glow');
  SF.sparks = (x, y, n, o) => {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = o.ang !== undefined ? o.ang + rand(-(o.spread || 0.6), o.spread || 0.6) : rand(0, TAU), v = rand(500, 1100) * (o.speed || 1);
      FX.add({ type: 'samspark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.75, drag: 4, life: rand(0.22, 0.4), len: rand(18, 40), w: rand(1.6, 3), rgb: o.rgb || NC.pick(['255,226,140', '255,244,200', '255,190,90']) });
    }
  };
  SF.ring = (pal, x, y, r, o) => SF.play('ring_' + pal, x, y, Object.assign({ k: r / 144, sy: 0.58 }, o || {}));
  SF.pop = (pal, x, y, k, o) => SF.play('pop_' + pal, x, y, Object.assign({ k: k || 1, rot: rand(0, TAU) }, o || {}));
  SF.burst = (pal, x, y, r, o) => SF.play('burst_' + pal, x, y, Object.assign({ k: r / 150, sy: 0.8 }, o || {}));
  // a cut flying along (q.x, q.y): the blade shape at its full frame, its head on the point; k: its length / 300
  const flyLook = (pal, k) => (ctx, q) => {
    const ang = Math.atan2(q.vy, q.vx), a = Math.min(1, (q.life - q.t) / 0.12), len = 300 * k, kk = len / 492;
    both(ctx, 'ribbon_' + pal, 3, q.x - Math.cos(ang) * len * 0.42, q.y - Math.sin(ang) * len * 0.42, kk, { rot: ang, flipY: Math.cos(ang) < 0, a });
  };

  // ---------------- the impact frame (the reference's ultimate): the screen floods one colour, everyone on it turns
  // into a black silhouette and black ink cuts slash across; then the world comes back ----------------
  const IMPACT = { blood: '#ff0a4c', moon: '#e9efff', wind: '#40e3ad' };
  let sil = null;
  FX.def('samimpact', (ctx, q) => {
    const G = NC.game;
    if (!G) return;
    const u = q.t / q.life, cv = ctx.canvas, T = ctx.getTransform();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (u < 0.12) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore(); return; }
    ctx.fillStyle = q.fill; ctx.fillRect(0, 0, cv.width, cv.height);
    // the silhouettes: the hero, the party, every monster on screen, drawn into a canvas of their own and filled black
    if (!sil) sil = document.createElement('canvas');
    if (sil.width !== cv.width || sil.height !== cv.height) { sil.width = cv.width; sil.height = cv.height; }
    const sc = sil.getContext('2d');
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalCompositeOperation = 'source-over'; sc.clearRect(0, 0, sil.width, sil.height);
    sc.setTransform(T);
    try {
      for (const e of G.enemies) if (e.hp > 0 && !e.dead) NC.drawEnemy(sc, G, e);
      if (NC.Party && NC.Party.members) for (const m of NC.Party.members) if (m.dead <= 0) NC.Party.draw(sc, G, m);
      const inv = G.player.inv; G.player.inv = 0; // (no blinking while invulnerable: the silhouette is always there)
      try { NC.drawPlayer(sc, G); } finally { G.player.inv = inv; }
    } catch (e) { /* (a drawer that needs more than it gets here: no silhouette for it) */ }
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#000000'; sc.fillRect(0, 0, sil.width, sil.height);
    for (let i = 0; i < 3; i++) ctx.drawImage(sil, 0, 0); // (three times: a blinking, see-through hero still comes out solid black)
    ctx.setTransform(T);
    // the black ink cuts (the ribbons of the ink palette, big), one after another
    for (const c of q.cuts) {
      const ct = q.t - c.at;
      if (ct < 0) continue;
      blit(ctx, 'ribbon_ink', Math.min(9, Math.floor((ct / 0.3) * 10)), c.x, c.y, c.len / 492, { rot: c.ang, flipY: Math.cos(c.ang) < 0 });
    }
    ctx.restore();
  }, 'glow');
  // o: life (0.5), cuts (how many ink cuts), r (how far round the hero they land)
  SF.impact = (game, p, pal, o) => {
    o = o || {};
    const life = o.life || 0.5, n = o.cuts || 4, r = o.r || 220, cuts = [];
    for (let i = 0; i < n; i++) {
      const a = rand(-0.75, 0.75) + (i % 2 ? Math.PI : 0);
      cuts.push({ at: life * (0.15 + (0.6 * i) / n), x: p.x + rand(-r, r), y: p.y - 60 + rand(-r * 0.4, r * 0.3), ang: a, len: rand(520, 760) });
    }
    V.shake(game, 10);
    return FX.add({ type: 'samimpact', layer: 'glow', x: p.x, y: p.y, life, fill: IMPACT[pal] || IMPACT.blood, cuts });
  };

  // =====================================================================================================
  // ซามูไร: ใจดาบ (Ki)
  // =====================================================================================================
  const ki = (p) => p.saKi || 0;
  function kiGain(game, p, n) {
    if (!isSam(p)) return;
    const k = 1 + lvOf(p, 'sa_ki') * 0.05 + (K.buffOn(p, 'sa_focus') && lvOf(p, 'sa_focus') >= 5 ? 0.5 : 0);
    const was = ki(p);
    p.saKi = Math.min(100, was + n * k); p.saKiT = game.time;
    if (was < 100 && p.saKi >= 100) {
      SF.play('mswirl', p.x, p.y - 66, { follow: p, oy: -66, k: 0.42, sy: 0.72, life: 16 / 30, glowK: 1.2 });
      FX.text(p.x, p.y - 210, 'ใจดาบเต็ม!', '#dce8ff', 26);
      if (lvOf(p, 'sa_ki') >= 5) NC.applyGear(game);
    }
  }
  NC.saKi = { gain: kiGain, ki };
  // the skills a full gauge powers up (the cast empties it: castSkill below)
  const EMPOWER = new Set(['sa_crescent', 'sa_draw', 'sa_counter', 'sa_wave', 'bs_rend', 'bs_bloom', 'bs_drink', 'bs_moon', 'wd_gale', 'wd_step', 'wd_cyclone', 'wd_leaves']);
  const OURS = new Set();

  K.def({
    sa_crescent: S({ name: 'ฟันจันทร์เสี้ยว', icon: 'sk_sa_crescent', free: 1, cd: 6, ro: 'a', sp: (lv) => 9 + lv, mul: (lv) => 1.1 + lv * 0.11,
      desc: (lv, m) => `ฟันเป็นจันทร์เสี้ยวกว้างข้างหน้า ${m}% ของ ATK ใจดาบ +8${lv >= 5 ? ' · ฟันกลับอีกครั้ง 60%' : ''}${lv >= 10 ? ' · จันทร์เสี้ยวพุ่งออกไปอีก 400 แรง 80%' : ''}` }),
    sa_wave: S({ name: 'คลื่นดาบจันทร์', icon: 'sk_sa_wave', cd: 3, sp: (lv) => 12 + lv, mul: (lv) => 1.2 + lv * 0.12,
      desc: (lv, m) => `ส่งคมจันทร์เสี้ยวพุ่งทะลุทั้งแนว 650 ${m}% ของ ATK ใจดาบ +4${lv >= 5 ? ' · คลื่นใหญ่ขึ้น' : ''}${lv >= 10 ? ' · ยิงสองคลื่นไขว้กัน' : ''}` }),
    sa_fullmoon: S({ name: 'ดาบจันทร์เต็มดวง', icon: 'sk_sa_fullmoon', ult: true, max: 5, cd: 45, sp: (lv) => 36 + lv * 4, mul: (lv) => 2.6 + lv * 0.4,
      need: (game, p) => (ki(p) >= 30 ? true : 'ใจดาบไม่พอ (ต้อง 30)'),
      desc: (lv, m) => `ใช้ใจดาบทั้งหมด จันทร์เต็มดวงขึ้นหลังตัว แล้วฟันวงกลมใหญ่สองรอบรอบตัว 340 ครั้งละ ${m}% ของ ATK × (1 + ใจดาบ/100)` }),
    sa_draw: S({ name: 'ชักดาบแสงจันทร์', icon: 'sk_sa_draw', free: 1, cd: 6, ro: 'd', sp: (lv) => 12 + lv, mul: (lv) => 2 + lv * 0.2,
      desc: (lv, m) => `ชักดาบพุ่งไปข้างหน้า 300 ทุกตัวที่ผ่าน แผลเปิดตามหลัง 0.35 วิ ${m}% ของ ATK${lv >= 5 ? ' · อมตะตอนพุ่ง ใจดาบ +15' : ''}${lv >= 10 ? ' · แผลเปิดสองครั้ง' : ''}` }),
    sa_counter: S({ name: 'ท่าสวนกลับ', icon: 'sk_sa_counter', cd: 8, ro: 'u', sp: (lv) => 14 + lv, mul: (lv) => 3 + lv * 0.3,
      desc: (lv, m) => `ตั้งท่ารับ 1.2 วิ ถ้าโดนตี ไม่เสียเลือดแล้วฟันวงรอบตัว ${m}% ของ ATK ใจดาบ +30 (ไม่โดนตี ฟันเบา 50%)${lv >= 5 ? ' · สวนได้ ฟื้น HP 5%' : ''}${lv >= 10 ? ' · สวนแล้วพุ่งไปฟันตัวที่ตี' : ''}` }),
    sa_katana: S({ name: 'ชำนาญคาตานะ', icon: 'sk_sa_katana', pass: (lv, p) => (/^(katana|nodachi)$/.test(wt(p)) ? { atk: lv * 2, hit: lv, aspd: lv >= 10 ? 5 : 0 } : null),
      desc: (lv) => `ถือคาตานะหรือโนดาจิ ATK +${lv * 2}% HIT +${lv}${lv >= 10 ? ' · ความเร็วโจมตี +5%' : ''}` }),
    sa_ki: S({ name: 'ใจดาบ', icon: 'sk_sa_ki', free: 1, pass: (lv, p) => (lv >= 5 && ki(p) >= 100 ? { aspd: 10 } : {}),
      desc: (lv) => `ตีโดนได้ใจดาบ (0–100) ได้เร็วขึ้น ${lv * 5}% · เต็มแล้วสกิลถัดไปแรง ×${r1(1.4 + lv * 0.02)} แล้วใจดาบหมด${lv >= 5 ? ' · ใจดาบเต็มตีเร็วขึ้น 10%' : ''}${lv >= 10 ? ' · ใจดาบไม่ลดเอง' : ' · ไม่ได้สู้ 5 วิ ใจดาบค่อย ๆ ลด'}` }),
    sa_flow: S({ name: 'ฟันต่อเนื่อง', icon: 'sk_sa_flow', pass: () => ({}), mul: (lv) => 0.35 + lv * 0.04,
      desc: (lv) => `ตีปกติครั้งที่ ${lv >= 5 ? 3 : 4} ฟันจันทร์เสี้ยวเพิ่ม ${Math.round((0.35 + lv * 0.04) * 100)}% ของ ATK โดนรอบเป้า${lv >= 10 ? ' · คมจันทร์พุ่งต่อไปอีก 300' : ''}` }),
    sa_edge: S({ name: 'คมดาบไร้ลังเล', icon: 'sk_sa_edge', pass: (lv) => ({ crit: r1(lv * 0.6), critDmg: lv * 3 }),
      desc: (lv) => `คริติคอล +${r1(lv * 0.6)} แรงคริ +${lv * 3}%` }),
    sa_focus: S({ name: 'จิตนิ่ง', icon: 'sk_sa_focus', kind: 'buff', type: 'buff', cd: 30, sp: (lv) => 20 + lv * 2, rgb: MOON, circle: 'star', dur: () => 30,
      buff: (lv) => ({ aspd: r1(lv * 1.5), hit: lv * 2 + (lv >= 10 ? 20 : 0) }),
      desc: (lv) => `30 วิ: ความเร็วโจมตี +${r1(lv * 1.5)}% HIT +${lv * 2}${lv >= 5 ? ' · ใจดาบได้เพิ่ม 50%' : ''}${lv >= 10 ? ' · HIT +20' : ''}` }),
  });
  for (const id of ['sa_katana', 'sa_ki', 'sa_flow', 'sa_edge']) { SK[id].active = false; SK[id].kind = 'passive'; }
  const wt = (p) => (NC.wtypeOf ? NC.wtypeOf(NC.weaponDef(p)) : '');

  // ---------------- the looks (the user, 2026-10-03: "ปรับสกิลของคลาสซามูไรคลาสแรกด้วย": the 1st job in the
  // hand-drawn style of its 2nd jobs, in moonlight: tools/blood2d.py --pal moon) ----------------
  // a cut at (x, y) the way ang faces (the smear's centre at the chest), k its size
  const mcut = (x, y, ang, k, o) => { const fw = Math.cos(ang) >= 0 ? 1 : -1; return SF.play('mslash', x + fw * 40, y, Object.assign({ k, flip: fw > 0, rot: fw * Math.max(-0.35, Math.min(0.35, Math.sin(ang) * 0.6)), life: 14 / 30 }, o || {})); };
  const mstar = (e, k) => { SF.star(e.x, e.y - 60, k || 0.45); V.sparks(e.x, e.y - 60, 6, '220,232,255', { size: 0.8 }); };
  // a flying crescent: a smear sheet's frame held whole, turned along its flight (its arc, radius 196 round the
  // anchor, bulging towards -103 deg: turned so it bulges along the flight)
  const smearLook = (name, k) => (ctx, q) => {
    const ang = Math.atan2(q.vy, q.vx), a = Math.min(1, (q.life - q.t) / 0.12);
    SF.blit(ctx, name, 3 + (Math.floor(q.t * 30) % 2), q.x - Math.cos(ang) * 196 * k, q.y - Math.sin(ang) * 196 * k, k, { rot: ang + 1.8, a, glowK: 1.2 });
  };
  const moonLook = (k) => smearLook('mslash', k);

  // ---------------- casting ----------------
  // ฟันจันทร์เสี้ยว: a moonlight crescent cut in front (Lv5 back the other way, Lv10 a crescent flies on)
  RUN.sa_crescent = function (game, p, lv) {
    const a = p.aim;
    K.pose(game, p, K.clip(p, 'swing', 1), 0.32);
    const cut = (k, rev) => {
      mcut(p.x, p.y - 72, a, rev ? 0.62 : 0.74, rev ? {} : { flipY: true });
      for (const e of K.cone(game, p, 'sa_crescent', 250, 0.95, { ang: a, kb: 220, color: MOON, mul: k })) mstar(e, 0.55);
      V.shake(game, 3);
    };
    cut(1);
    kiGain(game, p, 8);
    if (lv >= 5) V.at(0.16, () => cut(0.6, true));
    if (lv >= 10) V.at(0.22, () => K.shot(game, p, 'sa_crescent', { from: [p.x, p.y - 60], ang: a, v: 1200, range: 400, r: 70, pierce: true, mul: 0.8, rgb: MOON, look: moonLook(0.42) }));
  };
  // คลื่นดาบจันทร์: a cut, and a big moonlight crescent flies out of it; it bursts where it ends
  RUN.sa_wave = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 2), 0.28);
    const k = lv >= 5 ? 1 : 0.8;
    mcut(p.x, p.y - 72, p.aim, 0.66);
    const fire = (ang) => K.shot(game, p, 'sa_wave', { from: [p.x + Math.cos(ang) * 30, p.y - 60], ang, v: 1100, range: 650, r: 60 + k * 30, pierce: true, rgb: MOON, look: moonLook(0.42 + k * 0.2),
      hit(e) { K.hit(game, p, 'sa_wave', e, Math.cos(ang) * 160, Math.sin(ang) * 110, MOON); mstar(e, 0.5); kiGain(game, p, 2); },
      end(q) { SF.play('mball', q.x, q.y, { k: 0.42 * k, rot: rand(0, TAU), life: 14 / 30 }); } });
    fire(p.aim);
    if (lv >= 10) V.at(0.08, () => fire(p.aim - 0.12));
    kiGain(game, p, 4);
  };
  // ดาบจันทร์เต็มดวง: the world dims, a full moon rises behind the hero, the screen flashes white (black silhouettes),
  // then two great moonlight circles round him, a crossed cut on each one in them, and a moon blast at the end
  RUN.sa_fullmoon = function (game, p, lv) {
    const k = 1 + ki(p) / 100;
    p.saKi = 0;
    K.pose(game, p, 'cheer', 1.1);
    p.inv = Math.max(p.inv, 1.2);
    FX.add({ type: 'samdim', layer: 'high', x: p.x, y: p.y, life: 1.6, a: 0.3 });
    SF.play('mmoon', p.x - 40, p.y - 290, { k: 0.72, loop: true, fps: 12, life: 1.7, fadeIn: 0.3, fadeOut: 0.5, grow: 0.1, layer: 'high' });
    V.light(p.x, p.y - 160, 520, MOON, 1, 1.6);
    V.flash(MOON, 0.18, 0.5);
    const R = 340 * (NC.skillScale ? NC.skillScale(p, 'sa_fullmoon') : 1);
    const wave = (i) => {
      K.pose(game, p, K.clip(p, 'swing', i), 0.3);
      SF.play('mswirl', p.x, p.y - 66, { k: R / 270, sy: 0.74, flip: i === 1, life: 16 / 30, glowK: 1.3 });
      K.nova(game, p, 'sa_fullmoon', p.x, p.y, R, { fx: false, mul: k * 0.8, kb: 300, big: true, each(e) {
        const fa = e.x >= p.x ? 0 : Math.PI;
        mcut(e.x, e.y - 72, fa, 0.46, { flipY: i === 1 });
        V.at(0.04, () => { if (alive(e)) mcut(e.x, e.y - 72, fa + Math.PI, 0.4, { flipY: i !== 1 }); });
        mstar(e, 0.6);
      } });
      V.shake(game, 9);
    };
    V.at(0.35, () => {
      SF.impact(game, p, 'moon', { life: 0.45, cuts: 4 });
      K.nova(game, p, 'sa_fullmoon', p.x, p.y, R, { fx: false, mul: k * 0.4, kb: 0, each(e) { mstar(e, 0.5); } }); // (the flash cuts them)
    });
    V.at(0.82, () => wave(0));
    V.at(1.12, () => {
      wave(1);
      V.at(0.1, () => { SF.play('mball', p.x, p.y - 66, { k: 1.15, rot: rand(0, TAU), life: 14 / 30, glowK: 1.4 }); V.flash('225,235,255', 0.16, 0.2); });
      SF.star(p.x, p.y - 80, 1.4);
    });
    shout(p, 'ดาบจันทร์เต็มดวง!', '#e2ecff');
  };
  // ชักดาบแสงจันทร์: a moonlight streak along the dash; a moment later each one passed opens in a crossed cut
  RUN.sa_draw = function (game, p, lv) {
    const a = p.aim, got = [], x0 = p.x, y0 = p.y;
    K.pose(game, p, K.clip(p, 'swing', 2), 0.3);
    if (lv >= 5) p.inv = Math.max(p.inv, 0.4);
    SF.play('mthrust', x0 - Math.cos(a) * 30, y0 - 62, { k: 0.6, rot: a, flipY: Math.cos(a) < 0, life: 12 / 30, glowK: 1.1 });
    K.dash(game, p, 'sa_draw', a, 300, 0.16, { rgb: MOON, hit(e) { if (!got.includes(e)) got.push(e); }, end() {
      const open = (n) => {
        for (const e of got) {
          if (!alive(e)) continue;
          const fa = Math.cos(a) >= 0 ? 0 : Math.PI;
          mcut(e.x, e.y - 72, fa, 0.5, { flipY: n === 1 });
          V.at(0.04, () => { if (alive(e)) mcut(e.x, e.y - 72, fa + Math.PI, 0.44, { flipY: n !== 1 }); });
          mstar(e, 0.6);
          K.hit(game, p, 'sa_draw', e, Math.cos(a) * 120, Math.sin(a) * 80, MOON);
        }
        if (got.length) { V.shake(game, 5); V.flash(MOON, 0.06, 0.15); }
      };
      V.at(0.35, () => open(0));
      if (lv >= 10) V.at(0.55, () => open(1));
      kiGain(game, p, lv >= 5 ? 15 : 6);
    } });
  };
  RUN.sa_counter = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 0), 1.2);
    p.saCounter = { until: game.time + 1.2, lv, done: false };
    V.ring(p.x, p.y - 6, 130, 60, 6, MOON, 0.4);
    V.glowAt(p.x, p.y - 70, 30, 110, MOON, 0.5, 1.2, { follow: p });
    K.channel(game, p, 1.2, () => {}, () => { if (p.saCounter && !p.saCounter.done) riposte(game, p, null, 0.5); p.saCounter = null; });
  };
  function riposte(game, p, from, k) {
    const lv = lvOf(p, 'sa_counter');
    if (p.saCounter) p.saCounter.done = true;
    SF.play('mswirl', p.x, p.y - 66, { k: k >= 1 ? 0.8 : 0.6, sy: 0.74, flip: Math.cos(p.aim) < 0, life: 16 / 30, glowK: 1.2 });
    if (k >= 1) {
      SF.star(p.x, p.y - 70, 1.3);
      mcut(p.x, p.y - 72, 0, 0.72, { flipY: true }); mcut(p.x, p.y - 72, Math.PI, 0.72, { delay: 0.06 });
      V.at(0.1, () => SF.play('mball', p.x, p.y - 66, { k: 0.6, rot: rand(0, TAU), life: 14 / 30 }));
    }
    K.nova(game, p, 'sa_counter', p.x, p.y, 230, { fx: false, mul: k, kb: 280 });
    V.shake(game, k < 1 ? 4 : 8);
    if (k >= 1) {
      kiGain(game, p, 30);
      shout(p, 'สวน!', '#ffe9a8');
      V.flash('255,240,190', 0.12, 0.2);
      if (lv >= 5) K.heal(game, p, p.maxHp * 0.05);
      if (lv >= 10 && from && alive(from)) V.at(0.15, () => {
        const a = NC.angle(p.x, p.y, from.x, from.y);
        K.dash(game, p, 'sa_counter', a, Math.max(40, NC.dist(p.x, p.y, from.x, from.y) - 50), 0.12, { rgb: MOON, hit(e) { K.hit(game, p, 'sa_counter', e, 0, 0, MOON, 0.6); } });
      });
    }
  }
  // the stance: the first blow is turned aside
  NC.heroGuards.push((game, p, dmg, from) => {
    if (!p.saCounter || p.saCounter.done || p.saCounter.until < game.time) return dmg;
    p.inv = Math.max(p.inv, 0.5);
    p.channel = null;
    riposte(game, p, from, 1);
    p.saCounter = null;
    return 0;
  });

  // =====================================================================================================
  // ซามูไรเลือด: skills paid in HP, bleeding, drinking it back, the crimson shield
  // =====================================================================================================
  const BLEED_MAX = 10;
  function bleed(game, p, e, n) {
    if (!alive(e) || n <= 0) return;
    const b = e.bsBleed || (e.bsBleed = { n: 0, until: 0, acc: 0 });
    b.n = Math.min(BLEED_MAX, (b.until > game.time ? b.n : 0) + n); b.until = game.time + 6;
    V.sparks(e.x, e.y - 60, 3 + n * 2, BLOOD, { size: 0.7 });
  }
  const stacks = (game, e) => (e && e.bsBleed && e.bsBleed.until > game.time ? e.bsBleed.n : 0);
  NC.bsBleed = { add: bleed, stacks };
  // HP a blood skill costs now (ราคาเลือด Lv3: half under 30% HP)
  const bloodCost = (p, pct) => Math.round(p.maxHp * pct * (lvOf(p, 'bs_price') >= 3 && p.hp < p.maxHp * 0.3 ? 0.5 : 1));
  const BLOOD_PCT = { bs_rend: 0.03, bs_bloom: 0.04, bs_guard: 0.1, bs_moon: 0.15 };
  // the blood looks (the user, 2026-10-03: every Blood Samurai skill in the hand-drawn style, like the wind ones)
  const bcut = (x, y, ang, k, o) => { const fw = Math.cos(ang) >= 0 ? 1 : -1; return SF.play('bslash', x + fw * 40, y, Object.assign({ k, flip: fw > 0, rot: fw * Math.max(-0.35, Math.min(0.35, Math.sin(ang) * 0.6)), life: 14 / 30 }, o || {})); };
  const drops = (x, y, n, sp) => V.sparks(x, y, n, BLOOD, { size: 1, min: (sp || 300) * 0.5, max: sp || 300 });
  const needBlood = (id) => (game, p) => (p.hp > bloodCost(p, BLOOD_PCT[id]) + 1 ? true : 'HP ไม่พอจ่ายเลือด');
  function payBlood(game, p, id) {
    const n = bloodCost(p, BLOOD_PCT[id]);
    if (!(n > 0)) return 0;
    p.hp = Math.max(1, p.hp - n);
    FX.num(p.x, p.y - 150, '-' + n, { fill: '#ff5a6a', size: 30 });
    V.sparks(p.x, p.y - 70, 8, BLOOD, { size: 0.8, ang: -Math.PI / 2, spread: 1.4 });
    (p.bsPaid || (p.bsPaid = [])).push({ t: game.time, n });
    p.bsPaidLast = { t: game.time, n, id };
    return n;
  }
  // ราคาเลือด: % more damage for the HP paid in the last 6 s (1% a 1% of max HP, 25% at most)
  const paidPct = (game, p) => { if (!p.bsPaid) return 0; p.bsPaid = p.bsPaid.filter((x) => game.time - x.t < 6); return (p.bsPaid.reduce((s, x) => s + x.n, 0) / Math.max(1, p.maxHp)) * 100; };
  // (small sips, every swing, go in quietly: no number)
  const drinkHeal = (game, p, amt, sip) => {
    if (!(amt > 0) || p.hp >= p.maxHp || p.dead > 0) return;
    if (sip) p.hp = Math.min(p.maxHp, p.hp + amt);
    else K.heal(game, p, amt, { quiet: amt < p.maxHp * 0.05 });
  };

  K.def({
    bs_bleed: S({ name: 'เลือดไหล', icon: 'sk_bs_mark', mul: () => 0.05, sp: () => 0, cd: 0 }),
    bs_rend: S({ name: 'ผ่าโลหิต', icon: 'sk_bs_rend', free: 1, cd: 4, ro: 'a', sp: () => 0, mul: (lv) => 2.3 + lv * 0.23, blood: true, need: needBlood('bs_rend'),
      desc: (lv, m) => `จ่าย HP 3% ผ่าเฉียงข้างหน้า ${m}% ของ ATK (+6% ต่อชั้นเลือดไหลบนเป้า) ติดเลือดไหล ${lv >= 10 ? 4 : 2} ชั้น${lv >= 5 ? ' · ฟันซ้ำอีกครั้ง 50%' : ''}` }),
    bs_bloom: S({ name: 'ผลิบานโลหิต', icon: 'sk_bs_bloom', cd: 6, ro: 'a', roCd: 4, sp: () => 0, mul: (lv) => 0.3 + lv * 0.03, blood: true, need: needBlood('bs_bloom'),
      desc: (lv, m) => `จ่าย HP 4% แผลของทุกตัวที่เลือดไหลในระยะ 450 ระเบิดเป็นดอกโลหิต ชั้นละ ${m}% ของ ATK แล้วหมดชั้น${lv >= 5 ? ' · แผลแพร่ไปตัวข้าง ๆ ครึ่งหนึ่ง' : ''}${lv >= 10 ? ' · ทุกชั้นที่ระเบิด ฟื้น HP 0.5%' : ''}` }),
    bs_moon: S({ name: 'จันทร์สีเลือด', icon: 'sk_bs_moon', ult: true, max: 5, cd: 50, sp: () => 0, mul: (lv) => 0.6 + lv * 0.08, blood: true, need: needBlood('bs_moon'),
      desc: (lv, m) => `จ่าย HP 15% เพลงดาบห้าท่าต่อกัน (อมตะตลอดท่า): ฟันข้ามหัว · ฟันย้อนขึ้น · หมุนวงเลือดรอบตัว + ระเบิดใส่ตัวใกล้สุด · ฟันกว้าง · แทงทะลุแล้วระเบิดทุกตัวที่ผ่าน (ดาเมจรวมราว ${Math.round(m * 6.6)}% ของ ATK ต่อตัว) ติดเลือดไหลเต็ม แล้วดูดเลือดคืน 30% ของดาเมจทั้งหมด` }),
    bs_mark: S({ name: 'แผลเปิด', icon: 'sk_bs_mark', pass: () => ({}),
      desc: (lv) => `ตีปกติโอกาส ${20 + lv * 4}% ติดเลือดไหล (ซ้อน 10 ชั้น 6 วิ ชั้นละ ${Math.round(5 * (1 + lv * 0.1))}% ของ ATK ต่อวิ)${lv >= 5 ? ' · ตีคริติดแน่นอน' : ''}${lv >= 10 ? ' · ติดทีละ 2 ชั้น' : ''}` }),
    bs_drink: S({ name: 'ดื่มโลหิต', icon: 'sk_bs_drink', cd: 7, ro: 'a', roCd: 3, sp: (lv) => 16 + lv, mul: (lv) => 1.7 + lv * 0.17,
      desc: (lv, m) => `ฟันวงรอบตัว ${lv >= 10 ? 280 : 230} ${m}% ของ ATK ดูดเลือด ${20 + lv * 2}% ของดาเมจ${lv >= 5 ? ' + 1% ของ HP สูงสุดต่อชั้นเลือดไหลบนตัวที่โดน' : ''}` }),
    bs_rage: S({ name: 'เลือดเดือด', icon: 'sk_bs_rage', pass: (lv, p) => { const k = p.hp < p.maxHp * 0.25 ? 2 : p.hp < p.maxHp * 0.5 ? 1 : 0; return k ? { atk: r1(lv * 1.5 * k), aspd: lv * k } : {}; },
      desc: (lv) => `HP ต่ำกว่า 50%: ATK +${r1(lv * 1.5)}% ความเร็วโจมตี +${lv}% · ต่ำกว่า 25%: สองเท่า · ตีโดนเป้าที่เลือดไหล ดูดเลือด ${r1(0.5 + lv * 0.15)}%` }),
    bs_guard: S({ name: 'โล่โลหิต', icon: 'sk_bs_guard', cd: 14, ro: 'u', roCd: 10, sp: () => 0, mul: (lv) => 3 + lv * 0.3, blood: true, need: needBlood('bs_guard'),
      desc: (lv, m) => `จ่าย HP 10% สร้างโล่โลหิตรับดาเมจได้ ${20 + lv * 2}% ของ HP สูงสุด 5 วิ แตกหรือหมดเวลาแล้วระเบิดรอบตัว ${m}% ของ ATK (+ตามดาเมจที่รับไว้)${lv >= 5 ? ' ติดเลือดไหล 3 ชั้น' : ''}` }),
    bs_price: S({ name: 'ราคาเลือด', icon: 'sk_bs_price', max: 5, pass: () => ({}),
      desc: (lv) => `จ่ายเลือดแล้วแรงขึ้น: 6 วิหลังจ่าย ดาเมจ +1% ต่อ 1% ของ HP ที่จ่าย (สูงสุด 15%)${lv >= 3 ? ' · HP ต่ำกว่า 30% จ่ายครึ่งเดียว' : ''}${lv >= 5 ? ' · สกิลที่จ่ายเลือดฆ่าได้ คืนเลือดที่จ่าย 30%' : ''}` }),
  });
  SK.bs_bleed.active = false; SK.bs_bleed.kind = 'passive';
  for (const id of ['bs_mark', 'bs_rage', 'bs_price']) { SK[id].active = false; SK[id].kind = 'passive'; }

  RUN.bs_rend = function (game, p, lv) {
    payBlood(game, p, 'bs_rend');
    const a = p.aim;
    K.pose(game, p, K.clip(p, 'swing', 1), 0.4);
    const cut = (k, i) => {
      // the swing: the blood smear round the hero (as in the reference: its fat head behind and low, its tail ahead)
      // (mirrored so its fat head lands in front of the hero, on the monsters; the reverse cut swings back up)
      const fw = Math.cos(a) >= 0 ? 1 : -1;
      if (i === 0) SF.play('bslash', p.x + fw * 40, p.y - 72, { k: 0.8, flip: fw > 0, rot: fw * Math.max(-0.3, Math.min(0.3, Math.sin(a) * 0.5)), life: 14 / 30 });
      else SF.play('bslash', p.x + fw * 40, p.y - 72, { k: 0.72, flip: fw > 0, flipY: true, life: 14 / 30 });
      // the nearest takes the whole cut (the X, the hood, the star), the others a single red cut each
      const got = K.cone(game, p, 'bs_rend', 270, 0.9, { ang: a, kb: 240, color: BLOOD, mul: k }).sort((u, w) => NC.dist(p.x, p.y, u.x, u.y) - NC.dist(p.x, p.y, w.x, w.y));
      got.forEach((e, j) => {
        if (i === 0) bleed(game, p, e, lv >= 10 ? 4 : 2);
        V.at(0.05, () => { if (!alive(e)) return; bcut(e.x - fw * 20, e.y - 66, a, 0.38, { flipY: i === 1 }); SF.star(e.x, e.y - 60, j === 0 ? 0.6 : 0.4); });
        V.sparks(e.x, e.y - 60, 10, BLOOD, { size: 1.1 });
      });
      V.shake(game, 5);
    };
    cut(1, 0);
    if (lv >= 5) V.at(0.18, () => cut(0.5, 1));
  };
  RUN.bs_bloom = function (game, p, lv) {
    payBlood(game, p, 'bs_bloom');
    K.pose(game, p, K.clip(p, 'swing', 2), 0.35);
    const R = 450 * (NC.skillScale ? NC.skillScale(p, 'bs_bloom') : 1);
    let popped = 0;
    const hit = game.enemies.filter((e) => alive(e) && stacks(game, e) > 0 && K.within(e, p.x, p.y, R));
    hit.forEach((e, i) => V.at(i * 0.04, () => {
      const n = stacks(game, e);
      if (!n || !alive(e)) return;
      e.bsBleed.n = 0;
      popped += n;
      SF.play('bball', e.x, e.y - 60, { k: Math.min(0.85, 0.42 + n * 0.045), rot: rand(0, TAU), life: 14 / 30, glowK: 1.2 });
      SF.star(e.x, e.y - 55, 0.4 + n * 0.05);
      drops(e.x, e.y - 60, 6 + n, 380);
      K.hit(game, p, 'bs_bloom', e, 0, 0, BLOOD, n);
      if (lv >= 5) for (const o of K.around(game, e.x, e.y, 150)) if (o !== e) bleed(game, p, o, Math.ceil(n / 2));
      if (lv >= 10) drinkHeal(game, p, p.maxHp * 0.005 * n);
    }));
    SF.play('bswirl', p.x, p.y - 66, { k: 0.55, sy: 0.72, flip: Math.cos(p.aim) < 0, life: 16 / 30, glowK: 1.1 });
    if (!hit.length) FX.text(p.x, p.y - 200, 'ไม่มีแผลให้ระเบิด', '#ffb0b0', 22);
    V.shake(game, 6);
  };
  RUN.bs_drink = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 2), 0.35);
    const R = lv >= 10 ? 280 : 230;
    SF.play('bswirl', p.x, p.y - 66, { k: R / 300, sy: 0.74, flip: Math.cos(p.aim) < 0, life: 16 / 30, glowK: 1.2 });
    let total = 0, wounds = 0;
    const cut = [];
    K.nova(game, p, 'bs_drink', p.x, p.y, R, { fx: false, kb: 180, each(e, r) {
      if (r && r.dmg > 0) total += r.dmg;
      wounds += stacks(game, e);
      cut.push(e);
      drops(e.x, e.y - 60, 8, 320);
    } });
    // the blood of each one cut flows back into the hero: a red stream from it to him
    V.at(0.16, () => cut.forEach((e) => {
      if (!alive(e)) return;
      const a = NC.angle(e.x, e.y - 60, p.x, p.y - 60), d = NC.dist(e.x, e.y, p.x, p.y);
      SF.play('bthrust', e.x, e.y - 60, { k: Math.max(0.3, d / 560), rot: a, flipY: Math.cos(a) < 0, life: 12 / 30, glowK: 1.1 });
    }));
    const heal = total * (0.2 + lv * 0.02) + (lv >= 5 ? p.maxHp * 0.01 * Math.min(20, wounds) : 0);
    V.at(0.32, () => { drinkHeal(game, p, heal); if (heal > 0) { SF.play('bball', p.x, p.y - 70, { k: 0.45, rot: rand(0, TAU), life: 14 / 30, glowK: 1.2 }); } });
    V.shake(game, 5);
  };
  RUN.bs_guard = function (game, p, lv) {
    payBlood(game, p, 'bs_guard');
    K.pose(game, p, 'cheer', 0.4);
    const cap = Math.round(p.maxHp * (0.2 + lv * 0.02));
    const sh = (p.bsShield = { left: cap, cap, until: game.time + 5.4, lv, q: null });
    const boom = () => {
      const k = 1 + Math.min(1, (sh.cap - Math.max(0, sh.left)) / Math.max(1, p.maxHp));
      K.nova(game, p, 'bs_guard', p.x, p.y, 210, { fx: false, mul: k, kb: 360, big: true, each(e) { if (lv >= 5) bleed(game, p, e, 3); drops(e.x, e.y - 60, 6, 360); } });
      SF.play('bswirl', p.x, p.y - 66, { k: 0.75, sy: 0.74, life: 16 / 30, glowK: 1.2 });
      V.shake(game, 10);
      if (p.bsShield === sh) p.bsShield = null;
    };
    if (NC.CrimsonFX && NC.CrimsonFX.ready()) sh.q = NC.CrimsonFX.add(game, p, { hold: 5, onBurst: boom });
    else { V.ring(p.x, p.y - 60, 40, 120, 10, BLOOD, 0.4); V.at(5, () => { SF.play('bball', p.x, p.y - 60, { k: 0.9, life: 14 / 30 }); boom(); }); }
  };
  // the ultimate's sword art: no blow lands meanwhile
  NC.heroGuards.push((game, p, dmg) => (p.bsUltT > game.time ? 0 : dmg));
  // the shield soaks the blows; broken, it blows up at once
  NC.heroGuards.push((game, p, dmg) => {
    const sh = p.bsShield;
    if (!sh || dmg <= 0) return dmg;
    if (sh.until < game.time) { p.bsShield = null; return dmg; }
    const took = Math.min(sh.left, dmg);
    sh.left -= took;
    if (sh.left <= 0) { if (sh.q && sh.q.burst) sh.q.burst(); sh.until = game.time + 0.6; }
    return dmg - took;
  });
  // จันทร์สีเลือด (the user, 2026-10-03: "ต่อคอมโบเป็นเพลงดาบให้หน่อย เหมือนสกิลอัลติ", after a flame-combo reference,
  // in blood): five cuts in 2.4 s, the hero untouchable meanwhile —
  //   1 a crescent over the top onto them, 2 a crescent back up, 3 a spin (a ring of blood fire round the hero) and the
  //   blast ball on the nearest, 4 a great wide cut with dark speed bars, 5 a thrust right through the nearest, the
  //   blast on everyone it passed; then the blood drunk back (30% of all the damage)
  RUN.bs_moon = function (game, p, lv) {
    payBlood(game, p, 'bs_moon');
    p.bsUltT = game.time + 2.6; // (untouchable through the art: a guard below, not p.inv, which would make the hero blink)
    const R = 330 * (NC.skillScale ? NC.skillScale(p, 'bs_moon') : 1);
    let total = 0, n = 0;
    const fw = () => (Math.cos(p.aim) >= 0 ? 1 : -1);
    const hit = (e, k, big) => { const r = K.hit(game, p, 'bs_moon', e, fw() * 160, 0, BLOOD, k, { big }); if (r && r.dmg > 0) total += r.dmg; bleed(game, p, e, 2); };
    const front = (range, cone) => K.around(game, p.x, p.y, range).filter((e) => Math.abs(Math.atan2(Math.sin(NC.angle(p.x, p.y, e.x, e.y) - p.aim), Math.cos(NC.angle(p.x, p.y, e.x, e.y) - p.aim))) < cone);
    const nearest = () => K.target(game, p, R + 80, 260);
    const move = (at, fn) => V.at(at, () => { if (p.dead > 0) return; n++; fn(); });
    V.flash('120,0,20', 0.18, 0.4);
    FX.add({ type: 'samdim', layer: 'high', x: p.x, y: p.y, life: 2.6, a: 0.45 }); // (the world dims while the art plays; the cuts, drawn after, don't)
    shout(p, 'จันทร์สีเลือด!', '#ff9aa8');
    // 1: over the top, onto them
    move(0.0, () => {
      K.pose(game, p, K.clip(p, 'swing', 0), 0.3);
      SF.play('bslash', p.x + fw() * 50, p.y - 78, { k: 1.05, flip: fw() > 0, life: 14 / 30, glowK: 0.7 });
      for (const e of front(300, 1.3)) { hit(e, 0.7); SF.star(e.x, e.y - 60, 0.5); }
      V.shake(game, 5);
    });
    // 2: back up
    move(0.3, () => {
      K.pose(game, p, K.clip(p, 'swing', 1), 0.3);
      SF.play('bslash', p.x + fw() * 50, p.y - 78, { k: 1.0, flip: fw() > 0, flipY: true, life: 14 / 30, glowK: 0.7 });
      for (const e of front(300, 1.3)) { hit(e, 0.7); SF.star(e.x, e.y - 60, 0.5); }
      V.shake(game, 5);
    });
    // 3: the spin, and the blast on the nearest
    move(0.6, () => {
      K.pose(game, p, K.clip(p, 'swing', 2), 0.4);
      SF.play('bswirl', p.x, p.y - 70, { k: 1.2, flip: fw() < 0, sy: 0.84, life: 16 / 30, glowK: 0.8 });
      for (const e of K.around(game, p.x, p.y, R * 0.85)) { K.pull(e, p.x, p.y, 160); hit(e, 0.6); }
      V.shake(game, 7);
      const t = nearest();
      if (t) V.at(0.12, () => { if (!alive(t)) return; SF.play('bball', t.x, t.y - 60, { k: 1.35, rot: rand(0, TAU), life: 14 / 30, glowK: 1.6 }); hit(t, 1.2, true); V.flash('255,90,100', 0.1, 0.18); V.shake(game, 9); });
    });
    // 4: the great wide cut
    move(1.15, () => {
      K.pose(game, p, K.clip(p, 'swing', 1), 0.35);
      SF.bars(p.x, p.y - 60, fw());
      SF.play('bslash', p.x + fw() * 80, p.y - 76, { k: 1.5, flip: fw() > 0, sy: 0.72, tilt: 0.12 * fw(), life: 14 / 30, glowK: 0.8 });
      for (const e of front(R + 60, 1.4)) { hit(e, 1.0, true); SF.star(e.x, e.y - 60, 0.7); }
      V.flash('255,80,90', 0.08, 0.15); V.shake(game, 10);
    });
    // 5: the thrust right through, the blast on all it passed
    move(1.6, () => {
      const t = nearest(), a = t ? NC.angle(p.x, p.y, t.x, t.y) : p.aim, d = t ? Math.min(R, NC.dist(p.x, p.y, t.x, t.y) + 120) : 280;
      const x0 = p.x, y0 = p.y, got = [];
      K.pose(game, p, K.clip(p, 'swing', 2), 0.35);
      SF.bars(p.x, p.y - 60, Math.cos(a) >= 0 ? 1 : -1);
      SF.play('bthrust', x0, y0 - 60, { k: Math.max(0.6, d / 520), rot: a, flipY: Math.cos(a) < 0, life: 12 / 30, glowK: 1.6 });
      K.dash(game, p, 'bs_moon', a, d, 0.12, { rgb: BLOOD, hit(e) { if (!got.includes(e)) got.push(e); }, end() {
        V.flash('255,235,235', 0.35, 0.22);
        V.shake(game, 14);
        got.forEach((e, i) => V.at(0.08 + i * 0.03, () => { if (!alive(e)) return; SF.play('bball', e.x, e.y - 60, { k: 0.95, rot: rand(0, TAU), life: 14 / 30, glowK: 1.6 }); hit(e, 1.8, true); bleed(game, p, e, BLEED_MAX); }));
        V.at(0.5, () => drinkHeal(game, p, total * 0.3));
      } });
    });
  };

  // =====================================================================================================
  // ซามูไรลม: กระแสลม, dash charges, the returning blades
  // =====================================================================================================
  const wind = (p) => p.wdWind || 0;
  const windTier = (p) => Math.floor(wind(p) / 20);
  function windGain(game, p, n) {
    if (!isWD(p)) return;
    const was = windTier(p);
    p.wdWind = Math.max(0, Math.min(100, wind(p) + n));
    if (windTier(p) !== was) NC.applyGear(game);
  }
  const stepMax = (p) => (lvOf(p, 'wd_step') >= 5 ? 3 : 2);
  const STEP_T = 3.2; // s a charge takes to come back
  const stepRate = (p) => (K.buffOn(p, 'wd_heart') && lvOf(p, 'wd_heart') >= 5 ? 1.35 : 1);

  K.def({
    wd_current: S({ name: 'กระแสลม', icon: 'sk_wd_current', free: 1, pass: (lv, p) => ({ spd: Math.round((wind(p) / 100) * 10), aspd: Math.round((wind(p) / 100) * lv * 0.8) }),
      desc: (lv) => `เคลื่อนที่และพุ่งสะสมกระแสลม (0–100) ยืนนิ่งค่อย ๆ หาย · ลมเต็ม: ดาเมจ +${r1(lv * 1.5)}% ความเร็ววิ่ง +10% ความเร็วโจมตี +${r1(lv * 0.8)}% (ตามปริมาณลม)` }),
    wd_swift: S({ name: 'ดาบไวดั่งลม', icon: 'sk_wd_swift', pass: (lv, p) => (wt(p) === 'katana' ? { aspd: lv, flee: lv * 2 } : null), mul: (lv) => 0.5 + lv * 0.05,
      desc: (lv) => `ถือคาตานะ ความเร็วโจมตี +${lv}% FLEE +${lv * 2}${lv >= 5 ? ' · ตีขณะเคลื่อนที่แรงขึ้น 15%' : ''}${lv >= 10 ? ' · ตีครั้งที่ 4 ส่งคมลมพุ่ง 300' : ''}` }),
    wd_gale: S({ name: 'ฟันพายุ', icon: 'sk_wd_gale', free: 1, element: 'wind', cd: 3, sp: (lv) => 10 + lv, mul: (lv) => 1.1 + lv * 0.11,
      desc: (lv, m) => `ส่งคมลมพุ่งทะลุทั้งแนว 650 ${m}% ของ ATK ธาตุลม · กระแสลม +6${lv >= 5 ? ' · ลมครึ่งหลอดขึ้นไป ยิงสองคม' : ''}${lv >= 10 ? ' · คมลมใหญ่ขึ้น' : ''}` }),
    wd_cyclone: S({ name: 'วังวนพายุ', icon: 'sk_wd_cyclone', element: 'wind', cd: 8, ro: 'z', roLife: 5, sp: (lv) => 22 + lv * 2, mul: (lv) => 0.28 + lv * 0.03, type: 'phys', buff: () => ({ spd: 30 }), dur: (lv) => (lv >= 10 ? 4 : 3),
      desc: (lv, m) => `พายุหมุนเดินตามตัว ${lv >= 10 ? 4 : 3} วิ ทุก 0.25 วิ ตีรอบตัว 170 ${m}% ของ ATK ธาตุลม วิ่งเร็วขึ้น 30% (เดินได้ตลอด)${lv >= 5 ? ' · ดูดศัตรูเข้าหา' : ''}` }),
    wd_leaves: S({ name: 'พันใบไม้ร่วง', icon: 'sk_wd_leaves', ult: true, max: 5, element: 'wind', cd: 45, sp: (lv) => 34 + lv * 4, mul: (lv) => 0.7 + lv * 0.08,
      desc: (lv, m) => `วาร์ปฟันศัตรูในระยะ 480 ทีละตัว ${7 + lv} ครั้ง ครั้งละ ${m}% ของ ATK ธาตุลม อมตะตลอดท่า แล้วปิดด้วยพายุใบไม้รอบตัว` }),
    wd_step: S({ name: 'ก้าวลม', icon: 'sk_wd_step', free: 1, cd: 0, ro: 'own', sp: (lv) => Math.max(4, 9 - Math.floor(lv / 2)), mul: (lv) => 1.25 + lv * 0.13,
      need: (game, p) => ((p.wdStep === undefined ? stepMax(p) : p.wdStep) >= 1 ? true : 'ก้าวลมยังไม่พร้อม'),
      desc: (lv, m) => `พุ่งไปทางที่เล็ง 320 ฟันทุกตัวที่ผ่าน ${m}% ของ ATK · ชาร์จ ${lv >= 5 ? 3 : 2} ครั้ง (คืนครั้งละ ${STEP_T} วิ) · กระแสลม +20${lv >= 10 ? ' · ฆ่าได้ คืนชาร์จทันที' : ''}` }),
    wd_return: S({ name: 'ลมหวนกลับ', icon: 'sk_wd_return', pass: () => ({}), mul: (lv) => 0.8 + lv * 0.1,
      desc: (lv) => `ทุกครั้งที่พุ่ง จุดเริ่มทิ้งคมลมที่บินกลับมาหาตัว ฟันทุกตัวที่ขวาง ${Math.round((0.8 + lv * 0.1) * 100)}% ของ ATK${lv >= 5 ? ' · คมลมกลับถึงตัว วิ่งเร็วขึ้น 15% 2 วิ' : ''}` }),
    wd_heart: S({ name: 'ใจสายลม', icon: 'sk_wd_heart', kind: 'buff', type: 'buff', cd: 30, sp: (lv) => 22 + lv * 2, rgb: WIND, circle: 'star', dur: () => 30,
      buff: (lv) => ({ spd: 10 + lv, flee: lv * 3 }),
      desc: (lv) => `30 วิ: วิ่งเร็วขึ้น ${10 + lv}% FLEE +${lv * 3}${lv >= 5 ? ' · ชาร์จก้าวลมคืนไวขึ้น 35%' : ''}${lv >= 10 ? ' · ก้าวลมไม่ใช้ SP' : ''}` }),
  });
  for (const id of ['wd_current', 'wd_swift', 'wd_return']) { SK[id].active = false; SK[id].kind = 'passive'; }
  SK.wd_cyclone.kind = 'active'; SK.wd_cyclone.active = true;
  const baseSp = SK.wd_step.sp;
  SK.wd_step.sp = (lv) => (NC.game && K.buffOn(NC.game.player, 'wd_heart') && lvOf(NC.game.player, 'wd_heart') >= 10 ? 0 : baseSp(lv));

  // ---- the looks (the user, 2026-10-03: the Wind Samurai's skills in the hand-drawn style of the blood ones, jade) ----
  const LEAF = ['#9fdc6a', '#6cc35a', '#c9f08a', '#e8f7c0'];
  const leaves = (x, y, n, sp) => { for (let j = 0; j < n; j++) FX.add({ type: 'leaf', layer: 'glow', x: x + rand(-30, 30), y: y - rand(0, 70), vx: rand(-1, 1) * (sp || 200), vy: rand(-1, 0.3) * (sp || 200), drag: 1.5, life: rand(0.45, 0.85), rot: rand(0, TAU), spin: rand(-12, 12), ph: rand(0, 6), color: NC.pick(LEAF) }); };
  const wcut = (x, y, ang, k, o) => { const fw = Math.cos(ang) >= 0 ? 1 : -1; return SF.play('wslash', x + fw * 40, y, Object.assign({ k, flip: fw > 0, rot: fw * Math.max(-0.35, Math.min(0.35, Math.sin(ang) * 0.6)), life: 14 / 30 }, o || {})); };
  const wstar = (e) => { SF.star(e.x, e.y - 60, 0.45); V.sparks(e.x, e.y - 60, 6, '200,255,230', { size: 0.8 }); };
  // a flying cut: the jade crescent held whole (frame 3) turned along its flight, leaves in its wake
  // (the sheet's arc bulges towards -103 deg, radius 196 round its anchor: turned so it bulges along the flight)
  const windLook = (k) => (ctx, q) => {
    const ang = Math.atan2(q.vy, q.vx), a = Math.min(1, (q.life - q.t) / 0.12);
    SF.blit(ctx, 'wslash', 3 + (Math.floor(q.t * 30) % 2), q.x - Math.cos(ang) * 196 * k, q.y - Math.sin(ang) * 196 * k, k, { rot: ang + 1.8, a, glowK: 1.2 });
  };
  const windBlade = (game, p, id, x, y, ang, o) => K.shot(game, p, id, Object.assign({ from: [x, y], ang, v: 1150, range: 650, r: 64, pierce: true, rgb: WIND, look: windLook(0.5),
    trail(q) { if (Math.random() < 0.4) leaves(q.x, q.y + 30, 1, 90); },
    hit(e) { K.hit(game, p, id, e, Math.cos(ang) * 160, Math.sin(ang) * 110, WIND); wstar(e); },
    end(q) { leaves(q.x, q.y + 30, 4, 140); } }, o || {}));
  // ฟันพายุ: a cut in front, a jade crescent flies out of it (two at half the gauge, Lv5)
  RUN.wd_gale = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 1), 0.24);
    const k = lv >= 10 ? 0.62 : 0.5;
    wcut(p.x, p.y - 72, p.aim, 0.72, { flipY: true });
    windBlade(game, p, 'wd_gale', p.x + Math.cos(p.aim) * 30, p.y - 60, p.aim, { look: windLook(k), r: 50 + k * 40 });
    if (lv >= 5 && wind(p) >= 50) V.at(0.08, () => windBlade(game, p, 'wd_gale', p.x + Math.cos(p.aim) * 30, p.y - 60, p.aim + 0.14, { look: windLook(k) }));
    windGain(game, p, 6);
  };
  // วังวนพายุ: the hero spins inside a ring of wind that keeps turning round him (he walks with it), leaves whirling
  RUN.wd_cyclone = function (game, p, lv) {
    const dur = lv >= 10 ? 4 : 3;
    K.pose(game, p, K.clip(p, 'swing', 2), 0.25);
    K.startBuff(game, p, 'wd_cyclone', lv, dur);
    let acc = 0, ringT = 0, flip = false;
    return FX.add({ type: 'timer', layer: 'none', life: dur, update(q, dt) {
      if ((ringT -= dt) <= 0) {
        ringT = 0.36; flip = !flip;
        SF.play('wswirl', p.x, p.y - 66, { follow: p, oy: -66, k: 0.62, sy: 0.7, flip, life: 16 / 30, glowK: 1.1 });
      }
      if (Math.random() < dt * 30) { const a = rand(0, TAU); FX.add({ type: 'leaf', layer: 'glow', x: p.x + Math.cos(a) * 140, y: p.y - 40 + Math.sin(a) * 60, vx: -Math.sin(a) * 320, vy: Math.cos(a) * 130 - 40, drag: 1, life: 0.6, rot: rand(0, TAU), spin: 9, ph: 0, color: NC.pick(LEAF) }); }
      if ((acc += dt) < 0.25) return;
      acc -= 0.25;
      for (const e of K.around(game, p.x, p.y, 170)) {
        if (lv >= 5) K.pull(e, p.x, p.y, 120);
        K.hit(game, p, 'wd_cyclone', e, 0, 0, WIND);
      }
      windGain(game, p, 2);
    } });
  };
  // ก้าวลม: a dash through them; the path is a jade streak, each one passed gets a cut, leaves in the wake
  RUN.wd_step = function (game, p, lv) {
    if (p.wdStep === undefined) p.wdStep = stepMax(p);
    p.wdStep -= 1;
    const a = p.aim, x0 = p.x, y0 = p.y;
    K.pose(game, p, K.clip(p, 'swing', 2), 0.18);
    SF.play('wthrust', x0 - Math.cos(a) * 30, y0 - 62, { k: 0.62, rot: a, flipY: Math.cos(a) < 0, life: 12 / 30, glowK: 1.1 });
    K.dash(game, p, 'wd_step', a, 320, 0.14, { rgb: WIND, pal: WPAL,
      hit(e) { K.hit(game, p, 'wd_step', e, Math.cos(a) * 160, Math.sin(a) * 110, WIND); V.at(0.06, () => { if (alive(e)) { wcut(e.x - Math.cos(a) * 30, e.y - 66, a, 0.42, { flipY: Math.random() < 0.5 }); wstar(e); } }); },
      tick() { if (Math.random() < 0.6) leaves(p.x, p.y - 40, 1, 80); },
      end() {
        windGain(game, p, 20);
        if (lvOf(p, 'wd_return') > 0) V.at(0.25, () => returning(game, p, x0, y0));
      } });
    showStepCd(p);
  };
  // ลมหวนกลับ: a jade cut flies back from where the dash began to the hero
  function returning(game, p, x0, y0) {
    const lv = lvOf(p, 'wd_return'), done = new Set();
    leaves(x0, y0 - 30, 5, 160);
    FX.add({ type: 'vproj', layer: 'glow', x: x0, y: y0 - 60, vx: 0, vy: 0, life: 1.2, rot: 0, t: 0,
      update(q, dt) { // (fx.js moves it by vx, vy; here it turns towards the hero)
        const tx = p.x, ty = p.y - 60, d = Math.hypot(tx - q.x, ty - q.y);
        if (d <= 1300 * dt + 10) { q.dead = true; if (lv >= 5) { p.wdRushT = game.time + 2; NC.applyGear(game); } leaves(tx, ty + 20, 6, 200); V.sparks(tx, ty, 6, '200,255,230', { size: 0.7 }); return; }
        q.vx = ((tx - q.x) / d) * 1300; q.vy = ((ty - q.y) / d) * 1300;
        if (Math.random() < 0.4) leaves(q.x, q.y + 20, 1, 60);
        for (const e of game.enemies) if (!done.has(e) && alive(e) && NC.dist(q.x, q.y, e.x, e.y - 45) < 60 + e.r) { done.add(e); K.hit(game, p, 'wd_return', e, q.vx * 0.1, q.vy * 0.1, WIND); wstar(e); }
      },
      draw: windLook(0.42) });
  }
  const showStepCd = (p) => {
    if (!p.cd) return;
    const key = '@wd_step';
    if ((p.wdStep || 0) >= 1) { p.cd[key] = 0; return; }
    p.cd[key] = Math.max(0.05, p.wdStepT || STEP_T);
    if (p.cdFull) p.cdFull[key] = STEP_T;
  };
  // พันใบไม้ร่วง (the Wind Samurai's sword art, like the blood one but all movement): the screen goes jade and still,
  // then the hero warps from one to the next, each warp a jade streak and a cut on it (alternating up / down), the
  // last ones faster; it ends back in the middle with a spin of wind and a burst of leaves. Untouchable throughout.
  RUN.wd_leaves = function (game, p, lv) {
    const n = 7 + lv;
    K.pose(game, p, K.clip(p, 'swing', 0), 0.3);
    const total = 0.45 + n * 0.11 + 0.6;
    p.bsUltT = game.time + total + 0.2;                    // (the same no-blow guard as the blood art: no blinking)
    SF.impact(game, p, 'wind', { life: 0.4, cuts: 3 });
    shout(p, 'พันใบไม้ร่วง!', '#c8ffe0');
    FX.add({ type: 'samdim', layer: 'high', x: p.x, y: p.y, life: total + 0.3, a: 0.32 });
    const cx = p.x, cy = p.y;
    let last = null, at = 0.45;
    for (let i = 0; i < n; i++) {
      const gap = i < n - 3 ? 0.12 : 0.08;
      V.at(at, () => {
        const pool = K.around(game, cx, cy, 480).filter((e) => e !== last);
        const e = pool.length ? pool[Math.floor(Math.random() * pool.length)] : last && alive(last) ? last : null;
        if (!e) return;
        last = e;
        const side = p.x < e.x ? 1 : -1, sx = p.x, sy = p.y;
        const tx = e.x + side * 80, ty = e.y + rand(-12, 12);
        // the warp: a jade streak from where he was to where he lands (past it), leaves where he left
        const a = NC.angle(sx, sy, tx, ty), dist = NC.dist(sx, sy, tx, ty);
        SF.play('wthrust', sx, sy - 62, { k: Math.max(0.4, dist / 560), rot: a, flipY: Math.cos(a) < 0, life: 12 / 30, glowK: 1.1 });
        leaves(sx, sy - 40, 6, 180);
        const rush = {};
        for (let j = 0; j < 16; j++) NC.rushMove(game.world, p, (tx - sx) / 16, (ty - sy) / 16, rush);
        NC.finishRush(game.world, p, rush);
        p.aim = NC.angle(p.x, p.y, e.x, e.y);
        K.pose(game, p, K.clip(p, 'swing', i % 3), 0.12);
        wcut(e.x, e.y - 72, Math.cos(p.aim) >= 0 ? 0 : Math.PI, 0.62, { flipY: i % 2 === 1 });
        K.hit(game, p, 'wd_leaves', e, -side * 120, 0, WIND, 1, { big: i === n - 1 });
        wstar(e);
        leaves(e.x, e.y - 50, 5, 220);
        V.shake(game, 4);
      });
      at += gap;
    }
    // the finish: back in the middle, a turning ring of wind and a burst of leaves round him
    V.at(at + 0.1, () => {
      const a = NC.angle(p.x, p.y, cx, cy), d = NC.dist(p.x, p.y, cx, cy);
      if (d > 20) { SF.play('wthrust', p.x, p.y - 62, { k: Math.max(0.4, d / 560), rot: a, flipY: Math.cos(a) < 0, life: 12 / 30 }); const rush = {}; for (let j = 0; j < 16; j++) NC.rushMove(game.world, p, (cx - p.x) / (16 - j), (cy - p.y) / (16 - j), rush); NC.finishRush(game.world, p, rush); }
      K.pose(game, p, K.clip(p, 'swing', 2), 0.4);
      SF.play('wswirl', p.x, p.y - 66, { k: 1.05, sy: 0.78, life: 16 / 30, glowK: 1.4 });
      V.at(0.12, () => { SF.play('wball', p.x, p.y - 70, { k: 1.2, rot: rand(0, TAU), life: 14 / 30, glowK: 1.4 }); V.flash('210,255,235', 0.18, 0.2); });
      K.nova(game, p, 'wd_leaves', p.x, p.y, 280, { fx: false, mul: 1.5, kb: 320, big: true });
      leaves(p.x, p.y - 40, 26, 420);
      V.shake(game, 12);
      windGain(game, p, 100);
    });
  };

  // =====================================================================================================
  // hits, every frame, kills: the three gauges, bleeding, the passives
  // =====================================================================================================
  // (the ใจดาบ power-up: a full gauge, the next attack skill of the line; it is taken when the cast goes off)
  const baseCast = NC.castSkill;
  NC.castSkill = function (game, p, key) {
    const id = NC.skillForKey(p, key);
    const full = !!(id && isSam(p) && EMPOWER.has(id) && ki(p) >= 100);
    if (full) p.saEmpT = game.time + 1.4;
    const done = baseCast.apply(this, arguments);
    if (full) {
      if (done) { p.saKi = 0; FX.text(p.x, p.y - 220, 'ไร้ลังเล!', '#ffffff', 30); V.flash(MOON, 0.1, 0.2); if (lvOf(p, 'sa_ki') >= 5) NC.applyGear(game); }
      else p.saEmpT = 0;
    }
    return done;
  };
  // the beats of each skill's effect (the user, 2026-10-03: "ทุกจังหวะเวลามีเอฟเฟคให้มีเลขดาเมจขึ้น สิ มันเหมือนแค่ตี
  // เฉยๆ"): a hit's damage comes up as one number on each cut / spin / blast its effect shows on that monster
  // (entities.js r.beats; the damage itself lands once)
  const BEATS = {
    sa_crescent: [0, 0.07], sa_wave: [0, 0.06], sa_draw: [0, 0.05, 0.1], sa_counter: [0, 0.06, 0.12], sa_fullmoon: [0, 0.05, 0.1, 0.16],
    bs_rend: [0, 0.06], bs_bloom: [0, 0.06, 0.12], bs_drink: [0, 0.07, 0.14], bs_guard: [0, 0.06, 0.12], bs_moon: [0, 0.05, 0.1],
    wd_gale: [0, 0.06], wd_step: [0, 0.07], wd_leaves: [0, 0.05, 0.1], wd_return: [0, 0.06],
  };
  const baseHH = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHH(d, e, o), G = NC.game, p = G && G.player;
    if (!p || d !== p.d || !(r.dmg > 0) || !isSam(p)) return r;
    if (o && o.sid && BEATS[o.sid]) r.beats = BEATS[o.sid];
    if (o && (o.sid === 'bs_bleed' || o.sid === 'wd_cyclone')) r.tick = true; // (a bleeding / storm tick: a small quick number)
    let k = 1;
    if (o.sid && OURS.has(o.sid) && p.saEmpT > G.time) k *= 1.4 + lvOf(p, 'sa_ki') * 0.02;
    if (isBS(p)) {
      if (lvOf(p, 'bs_price') > 0) k *= 1 + Math.min(15, paidPct(G, p)) / 100;
      if (o.sid === 'bs_rend') k *= 1 + 0.06 * stacks(G, e);
    }
    if (isWD(p)) {
      k *= 1 + (wind(p) / 100) * lvOf(p, 'wd_current') * 0.015;
      if (!o.skill && lvOf(p, 'wd_swift') >= 5 && Math.hypot(p.vx || 0, p.vy || 0) > 40) k *= 1.15;
    }
    if (k !== 1) r.dmg = Math.max(1, Math.round(r.dmg * k));
    return r;
  };
  NC.skillModSources.push((p) => (isWD(p) && p.wdRushT > ((NC.game && NC.game.time) || 0) ? { spd: 15 } : null));

  NC.basicHits.push((game, p, e, r) => {
    if (!isSam(p)) return;
    kiGain(game, p, 6 + (r.crit ? 3 : 0));
    // ฟันต่อเนื่อง: every 3rd (4th) swing a crescent
    const fl = lvOf(p, 'sa_flow');
    if (fl > 0) {
      p.saSwing = (p.saSwing || 0) + 1;
      if (p.saSwing >= (fl >= 5 ? 3 : 4)) {
        p.saSwing = 0;
        const a = NC.angle(p.x, p.y, e.x, e.y), pal = isBS(p) ? 'blood' : isWD(p) ? 'wind' : 'moon', rgb = isBS(p) ? BLOOD : isWD(p) ? WIND : MOON;
        p._saFlip = !p._saFlip;
        const fw2 = Math.cos(a) >= 0 ? 1 : -1, smear = pal === 'wind' ? 'wslash' : pal === 'blood' ? 'bslash' : 'mslash';
        SF.play(smear, p.x + fw2 * 40, p.y - 72, { k: 0.6, flip: fw2 > 0, flipY: !p._saFlip, life: 14 / 30 }); // (each job's hand-drawn smear)
        SF.star(e.x, e.y - 60, 0.45);
        for (const o of K.around(game, e.x, e.y, 120)) K.hit(game, p, 'sa_flow', o, Math.cos(a) * 120, Math.sin(a) * 80, rgb);
        if (fl >= 10) K.shot(game, p, 'sa_flow', { from: [p.x, p.y - 60], ang: a, v: 1100, range: 300, r: 60, pierce: true, rgb, look: smearLook(smear, 0.36) });
      }
    }
    // แผลเปิด: bleeding
    if (isBS(p)) {
      const ml = lvOf(p, 'bs_mark');
      if (ml > 0 && (Math.random() * 100 < 20 + ml * 4 || (ml >= 5 && r.crit))) bleed(game, p, e, ml >= 10 ? 2 : 1);
      const rl = lvOf(p, 'bs_rage');
      if (rl > 0 && stacks(game, e) > 0) drinkHeal(game, p, r.dmg * (0.005 + rl * 0.0015), true);
    }
    // ดาบไวดั่งลม Lv10: every 4th swing a wind blade
    if (isWD(p) && lvOf(p, 'wd_swift') >= 10 && (p._wdSw = (p._wdSw || 0) + 1) % 4 === 0) {
      const a = NC.angle(p.x, p.y, e.x, e.y);
      windBlade(game, p, 'wd_swift', p.x, p.y - 60, a, { range: 300, look: windLook(0.4) });
    }
  });

  NC.skillTicks.push((game, p, dt) => {
    if (!isSam(p)) { p.saKi = 0; p.wdWind = 0; return; }
    // Ki fades out of a fight (not at ใจดาบ Lv 10)
    if (ki(p) > 0 && lvOf(p, 'sa_ki') < 10 && game.time - (p.saKiT || 0) > 5) {
      const was = ki(p) >= 100;
      p.saKi = Math.max(0, ki(p) - dt * 8);
      if (was && lvOf(p, 'sa_ki') >= 5) NC.applyGear(game);
    }
    // bleeding ticks (the hero's own monsters' wounds)
    if (isBS(p)) {
      const k = 1 + lvOf(p, 'bs_mark') * 0.1;
      for (const e of game.enemies) {
        const b = e.bsBleed;
        if (!b || b.n <= 0) continue;
        if (b.until <= game.time || !alive(e)) { b.n = 0; continue; }
        b.acc += dt;
        if (b.acc >= 1) {
          b.acc -= 1;
          K.hit(game, p, 'bs_bleed', e, 0, 0, BLOOD, b.n * k);
          V.sparks(e.x, e.y - 50, 2 + Math.ceil(b.n / 3), BLOOD, { size: 0.6, ang: Math.PI / 2, spread: 0.8 });
          if (b.n >= 3) SF.play('bslash', e.x, e.y - 62, { k: 0.1 + b.n * 0.012, rot: rand(0, TAU), life: 0.28, glowK: 0.6 }); // (the wound flaring)
        }
      }
      // the rage's speed reads the HP: settle the numbers when the band changes
      const band = p.hp < p.maxHp * 0.25 ? 2 : p.hp < p.maxHp * 0.5 ? 1 : 0;
      if (band !== p._bsBand) { p._bsBand = band; if (lvOf(p, 'bs_rage') > 0) NC.applyGear(game); }
      if (p.bsShield && p.bsShield.until < game.time) p.bsShield = null;
    }
    // wind: moving fills it, standing still drains it; the dash charges come back
    if (isWD(p)) {
      const lx = p._wdX, ly = p._wdY;
      p._wdX = p.x; p._wdY = p.y;
      if (lx !== undefined) {
        const m = Math.hypot(p.x - lx, (p.y - ly) / 0.7);
        if (m > 0.5 && m < 120) { windGain(game, p, m / 14); p._wdStill = 0; }
        else if ((p._wdStill = (p._wdStill || 0) + dt) > 1) windGain(game, p, -dt * 12);
      }
      const max = stepMax(p);
      if (p.wdStep === undefined) p.wdStep = max;
      if (p.wdStep < max) {
        p.wdStepT = (p.wdStepT || STEP_T) - dt * stepRate(p);
        if (p.wdStepT <= 0) { p.wdStep += 1; p.wdStepT = p.wdStep < max ? STEP_T : 0; }
      } else p.wdStepT = 0;
      showStepCd(p);
      if (p._wdRush && !(p.wdRushT > game.time)) { p._wdRush = false; NC.applyGear(game); } else if (p.wdRushT > game.time) p._wdRush = true;
      if (wind(p) >= 100 && Math.random() < dt * 8) FX.add({ type: 'leaf', layer: 'glow', x: p.x + rand(-40, 40), y: p.y - rand(10, 120), vx: rand(-160, 160), vy: rand(-100, 20), drag: 1.2, life: rand(0.5, 0.8), rot: rand(0, TAU), spin: rand(-9, 9), ph: rand(0, 6), color: NC.pick(['#9fdc6a', '#6cc35a', '#c9f08a']) });
    }
  });
  NC.skillKills.push((game) => {
    const p = game.player;
    if (isWD(p) && lvOf(p, 'wd_step') >= 10 && p.wdStep < stepMax(p)) { p.wdStep += 1; p.wdStepT = p.wdStep < stepMax(p) ? STEP_T : 0; showStepCd(p); }
    if (isBS(p) && lvOf(p, 'bs_price') >= 5 && p.bsPaidLast && game.time - p.bsPaidLast.t < 1.5 && !p.bsPaidLast.back) {
      p.bsPaidLast.back = true;
      drinkHeal(game, p, p.bsPaidLast.n * 0.3);
    }
  });

  // the gauges over the head: ใจดาบ (moon-white), กระแสลม (jade) with the dash charges as pips
  FX.def('samgauge', (ctx) => {
    const G = NC.game, p = G && G.player;
    if (!p || !isSam(p) || p.dead > 0) return;
    const w = 90, h = 9, x = p.x - w / 2;
    let y = p.y - 236;
    const bar = (v, fill, full) => {
      ctx.fillStyle = 'rgba(14,16,30,0.75)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = v >= 100 ? full : fill; ctx.fillRect(x, y, (w * v) / 100, h);
      if (v >= 100) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x, y, w, 3); }
      y -= h + 5;
    };
    ctx.save();
    bar(ki(p), '#6f8fe0', '#e8f0ff');
    if (isWD(p)) {
      bar(wind(p), '#36b88e', '#b8ffe0');
      const max = stepMax(p);
      for (let i = 0; i < max; i++) {
        ctx.fillStyle = i < (p.wdStep === undefined ? max : p.wdStep) ? '#c8ffe8' : 'rgba(20,40,40,0.8)';
        ctx.beginPath(); ctx.arc(x + 6 + i * 13, y + h / 2, 4.5, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  });
  let gauge = null;
  NC.skillTicks.push((game, p) => { if (isSam(p) && (!gauge || !FX.list.includes(gauge))) gauge = FX.add({ type: 'samgauge', layer: 'glow', life: 1e9, x: 0, y: 0 }); });

  // =====================================================================================================
  // lines, the skill lists, the weapon rules
  // =====================================================================================================
  // a line: [id, name, element, parent (the 1st job's line a 2nd job's line goes on from), auto (the auto-attack line)]
  // a skill: [id, line, top level, free levels, needs, how it grows]
  const LINES = {
    samurai: [['blade', 'ดาบจันทร์', 'neutral', null, 0], ['iai', 'ชักดาบ', 'neutral', null, 0], ['spirit', 'ใจดาบ', 'neutral', null, 1]],
    bloodsamurai: [['crimson', 'เพลงดาบโลหิต', 'neutral', 'blade', 0], ['thirst', 'กระหายเลือด', 'neutral', 'spirit', 1], ['oath', 'สัญญาโลหิต', 'neutral', 'iai', 0]],
    windsamurai: [['gale', 'ลมคม', 'wind', 'blade', 0], ['step', 'ก้าวลม', 'wind', 'iai', 0], ['flow', 'สายลมไหล', 'wind', 'spirit', 1]],
  };
  const PLAN = {
    samurai: [
      ['sa_crescent', 'blade', 10, 1, [], 'Lv5 ฟันกลับอีกครั้ง · Lv10 จันทร์เสี้ยวพุ่งออกไป'],
      ['sa_wave', 'blade', 10, 0, [['sa_crescent', 3]], 'Lv5 คลื่นใหญ่ขึ้น · Lv10 ยิงสองคลื่น'],
      ['sa_fullmoon', 'blade', 5, 0, [['sa_crescent', 5], ['sa_ki', 3]], 'ใจดาบยิ่งเต็มยิ่งแรง (สูงสุด ×2)'],
      ['sa_draw', 'iai', 10, 1, [], 'Lv5 อมตะตอนพุ่ง ใจดาบ +15 · Lv10 แผลเปิดสองครั้ง'],
      ['sa_counter', 'iai', 10, 0, [['sa_draw', 3]], 'Lv5 สวนแล้วฟื้น HP 5% · Lv10 สวนแล้วพุ่งไปฟันตัวที่ตี'],
      ['sa_katana', 'iai', 10, 0, [], 'Lv10 ความเร็วโจมตี +5%'],
      ['sa_ki', 'spirit', 10, 1, [], 'Lv5 ใจดาบเต็มตีเร็วขึ้น 10% · Lv10 ใจดาบไม่ลดเอง'],
      ['sa_flow', 'spirit', 10, 0, [['sa_ki', 3]], 'Lv5 ทุกครั้งที่ 3 · Lv10 คมจันทร์พุ่งต่อ'],
      ['sa_edge', 'spirit', 10, 0, [['sa_katana', 3]], 'ทุกเลเวล คริ +0.6 แรงคริ +3%'],
      ['sa_focus', 'spirit', 10, 0, [['sa_ki', 5]], 'Lv5 ใจดาบได้เพิ่ม 50% · Lv10 HIT +20'],
    ],
    bloodsamurai: [
      ['bs_rend', 'crimson', 10, 1, [], 'Lv5 ฟันซ้ำอีกครั้ง · Lv10 เลือดไหล 4 ชั้น'],
      ['bs_bloom', 'crimson', 10, 0, [['bs_rend', 3]], 'Lv5 แผลแพร่ไปตัวข้าง ๆ · Lv10 ทุกชั้นที่ระเบิดฟื้น HP'],
      ['bs_moon', 'crimson', 5, 0, [['bs_bloom', 3], ['bs_drink', 3]], 'ฟันไขว้ทั้งพื้นที่ ติดเลือดไหลเต็ม ดูดเลือดคืน 30%'],
      ['bs_mark', 'thirst', 10, 0, [], 'Lv5 ตีคริติดเลือดไหลแน่นอน · Lv10 ติดทีละ 2 ชั้น'],
      ['bs_drink', 'thirst', 10, 0, [['bs_mark', 1]], 'Lv5 ดูดจากแผลบนตัวศัตรูเพิ่ม · Lv10 วงกว้างขึ้น'],
      ['bs_rage', 'thirst', 10, 0, [['bs_mark', 3]], 'HP ต่ำกว่า 25% ผลเป็นสองเท่า'],
      ['bs_guard', 'oath', 10, 0, [], 'Lv5 ระเบิดติดเลือดไหล 3 ชั้น'],
      ['bs_price', 'oath', 5, 0, [['bs_guard', 3]], 'Lv1 จ่ายเลือดแล้วแรงขึ้น · Lv3 HP ต่ำกว่า 30% จ่ายครึ่งเดียว · Lv5 ฆ่าได้คืนเลือด 30%'],
    ],
    windsamurai: [
      ['wd_gale', 'gale', 10, 1, [], 'Lv5 ลมครึ่งหลอดยิงสองคม · Lv10 คมลมใหญ่ขึ้น'],
      ['wd_cyclone', 'gale', 10, 0, [['wd_gale', 3]], 'Lv5 ดูดศัตรู · Lv10 พายุอยู่ 4 วิ'],
      ['wd_leaves', 'gale', 5, 0, [['wd_cyclone', 3], ['wd_step', 3]], 'วาร์ปฟันทีละตัว อมตะตลอดท่า'],
      ['wd_step', 'step', 10, 1, [], 'Lv5 ชาร์จ 3 ครั้ง · Lv10 ฆ่าได้คืนชาร์จ'],
      ['wd_return', 'step', 10, 0, [['wd_step', 3]], 'Lv5 คมลมกลับถึงตัว วิ่งเร็วขึ้น'],
      ['wd_heart', 'step', 10, 0, [['wd_step', 5]], 'Lv5 ชาร์จคืนไวขึ้น · Lv10 ก้าวลมไม่ใช้ SP'],
      ['wd_current', 'flow', 10, 1, [], 'ยิ่งวิ่งยิ่งแรง ยืนนิ่งลมหาย'],
      ['wd_swift', 'flow', 10, 0, [['wd_current', 3]], 'Lv5 ตีขณะเคลื่อนที่แรงขึ้น · Lv10 ตีครั้งที่ 4 ส่งคมลม'],
    ],
  };
  for (const job in PLAN) {
    const J = NC.JOBS[job];
    J.lines = LINES[job].map(([id, name, el, parent, auto]) => ({ id, name, el, parent: parent || null, auto: !!auto }));
    J.skills = PLAN[job].map((r) => r[0]).concat(J.tier === 1 ? NC.SHARED_SKILLS : []);
    for (const [id, line, max, free, req, grow] of PLAN[job]) {
      const Sk = SK[id];
      if (!Sk) continue;
      OURS.add(id);
      Sk.line = line; Sk.max = max; Sk.free = free; Sk.grow = grow;
      const any = req[0] === '|';
      Sk.req = (any ? req.slice(1) : req).filter(([r]) => SK[r]);
      Sk.reqAny = any;
    }
  }
  if (NC.weaponRule) {
    const R = NC.weaponRule;
    for (const id of PLAN.samurai.map((r) => r[0]).concat(PLAN.bloodsamurai.map((r) => r[0]))) if (SK[id].active || id === 'sa_flow') R(id, 'n:katana,nodachi');
    for (const id of ['wd_gale', 'wd_cyclone', 'wd_leaves', 'wd_step', 'wd_swift']) R(id, 'n:katana');
  }
})();
