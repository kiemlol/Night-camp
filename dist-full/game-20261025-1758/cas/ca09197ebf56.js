/* lavadragonfx.js — the lava dragon's skills in the BLOOD-SHIELD recipe (2026-10-15, the user, after the painted + shader
   version of the old dungeon bosses: "ผมไม่ชอบเอฟเฟคเเบบนี้เลย ผมชอบการทำเอฟเฟคเเบบโล่เลือด" -> the dragon first as the
   sample). Frames drawn by tools/lavadragon_fx.py (the Fire Mage's builders in tools/ember_fx.py re-coloured as magma: a
   dark crust with hot veins; flat tones, warped marble, foam dissolves, a real dome in the game camera, 15 fps) into
   assets/vfx2d/lavadragon/, each with a bloom sheet; this file only plays them where js/dunbosses.js's fight happens:
     danger circle   a band of magma on the ground round a pool of lava filling from the middle (its bloom over)
     danger lane     a strip of cracking lava along the breath, filling from the dragon outwards
     breath          fireballs streaming from the mouth down the lane, flame licks rising along it, pops where they end
     slam            a dome of magma bursting where it lands (its back half under the characters), licks round it
     meteors         rocks in fire falling slanted onto their circles, a dome at each landing
     the plain FX    a fire puff -> a pop, a ring -> the magma band spreading, an ember -> a lick / a pop (dust and
                     sparks drawn by code are dropped)
     rage            a hot tint, meteors over the whole screen, a camera punch (only looks: the fight is the server's)
   Takes the dragon over from js/dunbossfx.js once its sheets are in (NC.LavaFX.on = false: the painted look). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  if (!FX || !NC.DUNGEON_BOSSES) return;
  const LF = (NC.LavaFX = { on: true, bloom: 0.35 });
  const TAU = Math.PI * 2, FPS = 15, D = 'assets/vfx2d/lavadragon/';
  // the sheets (tools/ember_fx.py SPEC): frame size, columns, frames, the anchor (feet / centre) in the frame
  const SH = {
    ring: { w: 512, h: 300, cols: 6, n: 12, ax: 256, ay: 150 },
    sea: { w: 576, h: 340, cols: 6, n: 22, ax: 288, ay: 170 },
    wall: { w: 448, h: 128, cols: 6, n: 12, ax: 224, ay: 64 },
    ball: { w: 384, h: 384, cols: 8, n: 16, ax: 236, ay: 192 },
    blast: { w: 448, h: 448, cols: 7, n: 14, ax: 224, ay: 340, back: true },
    pop: { w: 192, h: 192, cols: 8, n: 8, ax: 96, ay: 96 },
    tongue: { w: 160, h: 256, cols: 10, n: 30, ax: 80, ay: 240 },
  };
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const IMG = {};
  for (const n in SH) {
    IMG[n] = load(D + n + '.webp');
    IMG[n + '_glow'] = load(D + n + '_glow.webp');
    if (SH[n].back) IMG[n + '_back'] = load(D + n + '_back.webp');
  }
  LF.ready = () => Object.values(IMG).every(ok);
  LF.live = () => LF.on && LF.ready();
  const isLava = (e) => !!(e && e.type === 'lava_dragon');
  const ease = (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  const loopF = (t, n) => ((Math.floor(t * FPS) % n) + n) % n;
  const oneShot = (q, n) => Math.min(n - 1, Math.floor((Math.max(0, q.t) / q.life) * n));

  // frame f of a sheet with its anchor at (x, y), scaled k. o: part ('glow' = the bloom, added; 'back'), flip, rot, a
  function blit(ctx, name, f, x, y, k, o) {
    o = o || {};
    const s = SH[name], glow = o.part === 'glow';
    const img = IMG[name + (glow ? '_glow' : o.part === 'back' ? '_back' : '')];
    if (!ok(img) || k <= 0) return;
    const fw = glow ? s.w / 2 : s.w, fh = glow ? s.h / 2 : s.h;
    f = Math.max(0, Math.min(s.n - 1, f | 0));
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= LF.bloom * (o.glowK || 1); }
    if (o.a !== undefined) ctx.globalAlpha *= Math.max(0, Math.min(1, o.a));
    ctx.drawImage(img, (f % s.cols) * fw, Math.floor(f / s.cols) * fh, fw, fh, -s.ax * k, -s.ay * k, s.w * k, s.h * k);
    ctx.restore();
  }
  const both = (ctx, name, f, x, y, k, o) => { blit(ctx, name, f, x, y, k, o); blit(ctx, name, f, x, y, k, Object.assign({}, o, { part: 'glow' })); };

  // the ground pieces are drawn under the characters ('low', before the night lighting): their bloom waits for 'glow'
  const GQ = [];
  let gq = null;
  FX.def('lv_gq', (ctx) => { for (const f of GQ) f(ctx); GQ.length = 0; }, 'glow');
  const baseAdd = FX.add;
  const glowLater = (f) => {
    if (!gq || !FX.list.includes(gq)) gq = baseAdd.call(FX, { type: 'lv_gq', x: 0, y: 0, life: 1e9 });
    GQ.push(f);
  };

  // ---------------- dunbosses.js's danger zones ----------------
  function warn(ctx, p, u) {
    const beat = 0.88 + 0.12 * Math.sin(p.t * 18), kf = (p.r / 270) * (0.2 + 0.8 * ease(u)), ff = 5 + loopF(p.t, 12), fr = loopF(p.t, 12), kr = p.r / 220;
    blit(ctx, 'sea', ff, p.x, p.y, kf, { a: 0.78 * beat });
    blit(ctx, 'ring', fr, p.x, p.y, kr, { a: 0.95 });
    glowLater((c) => { blit(c, 'ring', fr, p.x, p.y, kr, { part: 'glow' }); blit(c, 'sea', ff, p.x, p.y, kf, { part: 'glow', a: 0.6 }); });
  }
  function lane(ctx, p, u) {
    const s = SH.wall, f = loopF(p.t, 12), W = p.w * 1.7, k = Math.max(0.04, ease(u)), beat = 0.88 + 0.12 * Math.sin(p.t * 18);
    const draw = (c, glow, a, kk) => {
      const im = IMG[glow ? 'wall_glow' : 'wall'], fw = glow ? s.w / 2 : s.w, fh = glow ? s.h / 2 : s.h;
      if (!ok(im)) return;
      c.save(); c.translate(p.x, p.y); c.scale(1, 0.62); c.rotate(p.ang);
      c.beginPath(); c.rect(0, -W, p.len * kk, W * 2); c.clip();
      if (glow) { c.globalCompositeOperation = 'lighter'; c.globalAlpha *= LF.bloom; }
      c.globalAlpha *= a;
      c.drawImage(im, (f % s.cols) * fw, Math.floor(f / s.cols) * fh, fw, fh, 0, -W / 2, p.len, W);
      c.restore();
    };
    draw(ctx, false, 0.3 * beat, 1);
    draw(ctx, false, 0.95 * beat, k);
    glowLater((c) => draw(c, true, 0.9, k));
  }

  // ---------------- the pieces ----------------
  FX.def('lv_pop', (ctx, q) => { if (q.t >= 0) both(ctx, 'pop', oneShot(q, 8), q.x, q.y, q.k); }, 'glow');
  FX.def('lv_tongue', (ctx, q) => { if (q.t >= 0) both(ctx, 'tongue', q.v * 10 + oneShot(q, 10), q.x, q.y, q.k, { flip: q.flip }); }, 'glow');
  FX.def('lv_ring', (ctx, q, u) => {
    const r = NC.lerp(q.r0, q.r1, ease(u)), big = q.r1 > 300;
    both(ctx, 'ring', loopF(q.t, 12), q.x, q.y, r / 220, { a: (big ? 0.6 : 0.95) * Math.pow(1 - u, 1.4) });
  }, 'glow');
  FX.def('lv_blast', (ctx, q) => { if (q.t >= 0) both(ctx, 'blast', oneShot(q, 14), q.x, q.y, q.k); }, 'glow');
  FX.def('lv_blast_back', (ctx, q) => { if (q.t >= 0) blit(ctx, 'blast', oneShot(q, 14), q.x, q.y, q.k, { part: 'back' }); }, 'low');
  // a fireball flying along the lane, ~55 above the ground
  FX.def('lv_ball', (ctx, q) => both(ctx, 'ball', loopF(q.t + q.ph, 8), q.x, q.y - 55, q.k, { rot: Math.atan2(q.vy, q.vx) }), 'glow');
  // a meteor coming down slanted onto (x, y)
  const MDX = -260, MDY = -620, MANG = Math.atan2(-MDY, -MDX);
  FX.def('lv_meteor', (ctx, q) => {
    if (q.t < 0) return;
    const u = Math.min(1, q.t / q.life), w = 1 - u * u;
    both(ctx, 'ball', 8 + loopF(q.t, 8), q.x + MDX * w, q.y + MDY * w, q.k, { rot: MANG, a: Math.min(1, q.t / 0.06) });
  }, 'glow');

  const pop = (x, y, k, delay) => baseAdd.call(FX, { type: 'lv_pop', x, y, k, life: 8 / FPS, t0: delay || 0 });
  const tongue = (x, y, k, delay) => baseAdd.call(FX, { type: 'lv_tongue', x, y, k, v: (Math.random() * 3) | 0, flip: Math.random() < 0.5, life: 10 / FPS, t0: delay || 0 });
  function blast(x, y, r, delay) {
    const k = (r * 0.8) / 130, life = 14 / FPS, t0 = delay || 0; // (t0: dunbossfx.js's FX.add holds a piece back that long)
    baseAdd.call(FX, { type: 'lv_blast_back', x, y, k, life, t0 });
    baseAdd.call(FX, { type: 'lv_blast', x, y, k, life, t0 });
    const n = Math.max(3, Math.round(r / 30));
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + Math.random() * 0.4, d = r * (0.55 + Math.random() * 0.35); tongue(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.58, 0.45 + Math.random() * 0.3, (delay || 0) + 0.12 + Math.random() * 0.12); }
  }
  // (the meteor's landing is timed on the game clock)
  const LANDS = [];
  function meteor(game, x, y, wait, k, r) {
    const lead = Math.min(wait, 0.45);
    baseAdd.call(FX, { type: 'lv_meteor', x, y, k: k || 0.7, life: Math.max(0.05, lead), t0: wait - lead });
    LANDS.push({ x, y, r: r || 128, at: game.time + wait });
  }

  // ---------------- the plain FX the dragon asks for ----------------
  const DUST = /^(160,140,130|215,218,230|160,140,190)$/;
  let cur = null;
  function convert(p, e) {
    if (p.type === 'puff') {
      if (DUST.test(p.color || '')) { p.type = 'lv_none'; p.life = 0; return; } // (dust drawn by code: dropped)
      p.type = 'lv_pop'; p.k = Math.max(0.25, (p.r1 || 36) / 90); p.life = 8 / FPS; p.vx = p.vy = 0; p.layer = 'glow';
    } else if (p.type === 'ring') {
      p.type = 'lv_ring'; p.layer = 'glow'; p.life = Math.max(p.life, 0.5);
    } else if (p.type === 'ember') {
      e._lvE = (e._lvE || 0) + 1;
      if (e.state === 'breath' && e._lvE % 5 === 0) { p.type = 'lv_tongue'; p.y += 30; p.vx = p.vy = 0; p.k = 0.45 + Math.random() * 0.25; p.v = (Math.random() * 3) | 0; p.flip = Math.random() < 0.5; p.life = 10 / FPS; }
      else if (e.state !== 'breath' && e._lvE % 2 === 0) { p.type = 'lv_pop'; p.k = 0.3; p.vx = p.vy = 0; p.life = 8 / FPS; }
      else { p.type = 'lv_none'; p.life = 0; }
      p.layer = 'glow';
    }
  }
  FX.add = function (p) {
    if (p && LF.live()) {
      const e = p.dun ? p.owner : cur;
      if (isLava(e)) {
        if (p.dun === 'warn') p.draw = warn;
        else if (p.dun === 'lane') p.draw = lane;
        else if (!p.dun) convert(p, e);
      }
    }
    return baseAdd.call(this, p);
  };

  // ---------------- while the dragon updates ----------------
  function extras(game, e, s0, d0, r0, dt) {
    if (!r0 && e.raged && e.awake) rage(game, e);
    // the breath: fireballs stream from the mouth down the lane
    if (e.state === 'breath' && e.t >= e.wind) {
      e._lvB = (e._lvB || 0) - dt;
      if (e._lvB <= 0) {
        e._lvB = 0.06;
        const a = e.ang + NC.rand(-0.08, 0.08), sp = 1000, x = e.lx + Math.cos(a) * 70, y = e.ly + Math.sin(a) * 70 * 0.62;
        baseAdd.call(FX, { type: 'lv_ball', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.62, life: Math.max(0.1, (e.len - 70) / sp), k: NC.rand(0.5, 0.7), ph: Math.random(),
          onEnd: (q) => pop(q.x, q.y - 40, 0.55) });
      }
    }
    // the slam lands: a dome of magma
    if (s0 === 'slam' && !d0 && (e.state !== 'slam' || e.done)) blast(e.x, e.y, 240);
    // a new rain: the meteors set off now to land on their circles in time
    if (e.state === 'rain' && e.spots && e.spots !== e._lvSpots) {
      e._lvSpots = e.spots;
      for (const q of e.spots) meteor(game, q.x, q.y + 4, Math.max(0, q.at - e.t), 0.7, 128);
    }
    // the fire bats come out of pops
    if (s0 === 'summon' && !d0 && e.done) for (const m of game.enemies) if (m.owner === e && !m._lv) { m._lv = true; pop(m.x, m.y - 30, 0.8); }
  }
  const baseUpdate = NC.updateEnemy;
  NC.updateEnemy = function (game, e, dt) {
    if (!isLava(e) || !LF.live()) return baseUpdate.apply(this, arguments);
    const s0 = e.state, d0 = e.done, r0 = e.raged, o = cur;
    cur = e;
    let out;
    try { out = baseUpdate.apply(this, arguments); } finally { cur = o; }
    extras(game, e, s0, d0, r0, dt);
    return out;
  };
  const baseUpd = FX.update;
  FX.update = function (dt, game) {
    const r = baseUpd.apply(this, arguments);
    if (LANDS.length && game) for (let i = LANDS.length - 1; i >= 0; i--) if (game.time >= LANDS[i].at) {
      const q = LANDS.splice(i, 1)[0];
      blast(q.x, q.y, q.r);
      game.shake = Math.max(game.shake || 0, q.r > 140 ? 10 : 7);
    }
    return r;
  };

  // ---------------- the rage ----------------
  FX.def('lv_rage', (ctx, q) => {
    const env = Math.min(1, q.t / 0.35, (q.life - q.t) / 0.6);
    if (env <= 0.003) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,90,30,${0.12 * env})`; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }, 'glow');
  function rage(game, e) {
    const v = { x: game.cam.x, y: game.cam.y, w: game.vw, h: game.vh };
    baseAdd.call(FX, { type: 'lv_rage', x: 0, y: 0, life: 2.8 });
    game.shake = Math.max(game.shake || 0, 22);
    if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(e.x, e.y - 80, 0.06, 0.45);
    blast(e.x, e.y, 300);
    for (let i = 0; i < 12; i++) {
      let x = 0, y = 0;
      for (let k = 0; k < 12; k++) { x = v.x + NC.rand(0.05, 0.95) * v.w; y = v.y + NC.rand(0.3, 0.95) * v.h; if (game.world.fits(x, y, 20)) break; }
      meteor(game, x, y, 0.5 + i * 0.16 + Math.random() * 0.1, NC.rand(0.75, 1.1), NC.rand(120, 170));
    }
  }
  LF.rage = (e) => { if (NC.game && isLava(e)) rage(NC.game, e); };
  LF.blast = blast;
})();
