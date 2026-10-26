/* inklight.js — shared pieces of the "light on ink" recipe (2026-10-20: the reaper's scythe skills, js/reaperlight.js, then
   the user: "ทำ vfx โจรใหม่ด้วย สูตรเดียวกับเคียวเลย เบอเซิกเกอร์ด้วย พวกสายตีทั้งหลาย"). A line's skin (LK.lineSkin, js/lightkit.js)
   draws its effects as painted light pieces added + bloomed, and lays DARK painted ink-smoke pieces under the light (drawn as
   painted: the light reads on a bright meadow too). NC.InkLight:
     IL.dark(P)            a dark piece (P: n, x y, vx vy drag, rot spin, len wid, life, a, grow(u), fade(u), ground, flipY,
                           layer 'high' over the characters / 'low' on the ground, follow)
     IL.dim(life, a)       the world dimmed below the light layer (a cast's darkness; the light stays bright)
     IL.cut(x, y, len, dir, o)   a light slash piece across a point (o.n the piece, o.col, o.white, o.life, o.rot, o.ink: the
                           dark piece under it or false, o.inkA)
     IL.shards / IL.puffs  light pieces flung from a point / ink puffs round a point
     IL.hitFeel(cols)      a lineSkin `add` hook: the hit feel's warm pieces (js/hitfeel.js) in the line's colours
     IL.stars(map, cols)   a skin's stars in the line's colours, never gold
     IL.flashes(pred)      the screen flashes a skill asks for while pred(scope) holds: a dark one -> IL.dim, a white one -> half
   The code only places, moves, turns, stretches, tints and composites the painted pieces. Load after js/lightkit.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, LK = NC.LightKit;
  if (!FX || !V || !LK) return;
  const rand = NC.rand, PI = Math.PI, TAU = PI * 2, SQ = V.SQ || 0.58;
  const IL = (NC.InkLight = {});
  const out = LK.out, inOut = LK.inOut, asp = (n) => LK.aspect(n);
  IL.has = (n) => !!LK.MAN[n] && LK.ready(n);
  // the shared ink pieces (the rogue sheet's rg_v*: smoke bomb, poison cloud, ink slash, splat, smear, torn shadow) for a line
  // that has no ink of its own (the knight line): loaded the first time it asks; true once they are in
  let inkAsked = false;
  IL.ensureInk = function () {
    if (!inkAsked) {
      const M = NC.ASSET_MANIFEST_ROGUELIGHT;
      if (!M) return false;
      inkAsked = true;
      const ink = {};
      for (const n in M) if (/^rg_v/.test(n)) ink[n] = M[n];
      LK.addPieces(ink);
    }
    return LK.ready('rg_vslash', 'rg_vbomb', 'rg_vsplat', 'rg_vsmear');
  };
  IL.pop = (s0, s1, at) => (u) => (u < at ? s0 + (s1 - s0) * (1 - Math.pow(1 - u / at, 2)) : s1);
  IL.mirror = (rot, dir) => (dir < 0 ? { rot: PI - rot, flipY: true } : { rot, flipY: false });
  const pop = IL.pop;

  // ---------------- dark pieces ----------------
  FX.def('inkdark', (ctx, q, u) => {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const g = q.grow ? q.grow(u) : 1, a = q.a * (q.fade ? q.fade(u) : out(1.4)(u));
    let x = q.x, y = q.y;
    if (q.follow) { x += q.follow.x - q.fx0; y += q.follow.y - q.fy0; }
    LK.piece(ctx, q.n, x, y, q.rot || 0, q.len * g, (q.wid || q.len * asp(q.n)) * g, a, null, 0, { ground: q.ground, flipY: q.flipY });
    ctx.restore();
  }, 'high');
  IL.dark = function (P) {
    if (!IL.has(P.n)) return null;
    P.a = P.a === undefined ? 0.6 : P.a;
    if (P.rot === undefined) P.rot = 0;
    if (P.follow) { P.fx0 = P.follow.x; P.fy0 = P.follow.y; }
    return FX.add(Object.assign({ type: 'inkdark' }, P));
  };
  // ---------------- the world dimmed under the light ----------------
  FX.def('inkdim', (ctx, q, u) => {
    const a = q.a * (u < q.fin ? u / q.fin : u > 1 - q.fout ? (1 - u) / q.fout : 1);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(${q.rgb || '6,4,22'},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }, 'high');
  IL.dim = (life, a, rgb) => FX.add({ type: 'inkdim', x: 0, y: 0, life: Math.max(0.2, life), a: Math.min(0.5, a), fin: 0.18, fout: 0.4, rgb });

  // ---------------- light recipes ----------------
  IL.cut = function (x, y, len, dir, o) {
    o = o || {};
    const n = o.n || 'slash_big', life = o.life || 0.26, m = IL.mirror(o.rot === undefined ? rand(-0.2, 0.15) : o.rot, dir);
    if (o.ink !== false) IL.dark({ n: o.ink || 'rg_vslash', x: x - dir * len * 0.03, y: y + len * 0.04, rot: m.rot, flipY: m.flipY, len: len * (o.inkK || 1.15), life: life * 1.5,
      a: o.inkA === undefined ? 0.42 : o.inkA, grow: pop(0.8, 1.05, 0.3), fade: out(1.6) });
    return LK.part({ n, x, y, rot: m.rot, flipY: m.flipY, len, life, a: o.a || 1, col: o.col === undefined ? null : o.col, white: o.white === undefined ? 0.45 : o.white, g: 0.8,
      grow: pop(0.72, 1.06, 0.3), fade: out(1.5) });
  };
  IL.shards = function (x, y, n, a0, spread, k, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = a0 + rand(-spread, spread), sp = rand(500, 1000) * k, L = rand(26, 42) * k * (o.k || 1);
      LK.part({ n: o.n || 'spike_mid', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 6, rot: a + (o.back ? PI : 0), stretch: !o.spin, sp0: 500, spin: o.spin ? rand(-10, 10) : 0,
        len: o.spin ? L : L * 2.2, life: rand(0.2, 0.36), a: 1, col: o.col || '#ffffff', white: 0.4, g: 0.7, fade: out(1.2) });
    }
  };
  IL.puffs = function (x, y, n, r, k, o) {
    o = o || {};
    const names = o.n || ['rg_vbomb'];
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      IL.dark({ n: names[i % names.length], x: x + Math.cos(a) * r * rand(0.1, 1), y: y + Math.sin(a) * r * rand(0.1, 1) * SQ, vx: Math.cos(a) * rand(30, 90) * (o.sp || 1), vy: -rand(10, 50), drag: 1.5,
        rot: rand(0, TAU), spin: rand(-1.2, 1.2), len: rand(70, 120) * k, life: rand(0.5, 0.8) * (o.lifeK || 1), a: o.a || 0.45, grow: (u) => 0.6 + 0.6 * u, fade: inOut(0.12, 0.6), layer: o.layer || 'high' });
    }
  };

  // ---------------- the hit feel in the line's colours ----------------
  IL.hitFeel = function (cols) {
    const [A, B] = cols;
    return function (p, L, base) {
      if (p.type === 'hfember') {
        LK.asPart(p, 'spike_mid', 40 * (p.k || 1), Math.random() < 0.3 ? B : A, { stretch: true, sp0: 500, white: 0.4, fade: out(1.2) });
        base(p);
        return true;
      }
      if (p.type === 'hflight') { LK.part({ n: 'soft', x: p.x, y: p.y, len: p.size * 0.8, life: p.life, a: p.a * 0.45, col: A, white: 0, g: 0.35, grow: pop(0.6, 1, 0.3), fade: out(1.5) }); return true; }
      if (p.type === 'hfpool') {
        LK.add({ x: p.x, y: p.y, life: p.life, layer: 'low', draw(c, q, u, glow) { LK.piece(c, 'ground_glow', q.x, q.y, 0, p.size, p.size * asp('ground_glow'), p.a * 0.55 * out(1.3)(u), A, 0, { glow, ground: true, g: 0.3 }); } });
        return true;
      }
      if (p.type === 'hfspark') return true;
      return false;
    };
  };
  IL.stars = function (MAP, cols) {
    MAP.star = (p) => LK.asPart(p, 'glint', (p.size || 14) * 2.2, cols[Math.random() < 0.5 ? 0 : 1], { tw: 34 });
    MAP.vstar = (p) => LK.asPart(p, 'glint', (p.s || 12) * 2.6, cols[0], { tw: 34 });
  };
  // ---------------- painted FRAME animations played SMOOTHLY (2026-10-20, the user on the assassin: "อยากให้สีเเดงมันออกเข้มหน่อย
  // ... ใช้เฟรมรูปผสมด้วยก็ยิ่งดี อันนี้มันเหมือนเเสงอย่างเดียวเลย"): drawn as painted (not added: a deep red stays deep), each
  // frame melting into the next over its whole time, the picture growing all along, fading at the end - never a visible step
  // (the user's rule for painted frames, 2026-10-20). IL.addFrames(manifest) (name -> { frames: [{ src, w, h, ox, oy, d }], cell }), loaded on call.
  // IL.frames(name, x, y, o): o.size (world width of a whole cell), rot, flipX, ground (flat, squashed by the camera), a, grow
  // [s0, s1], speed, life (default: the frames' own times), layer ('high' over the characters / 'low' / 'glow'), follow,
  // hold [i, j, until()] (cycles frames i..j while until() holds, then plays on)
  const FR = {};
  IL.addFrames = function (man) {
    for (const n in man) {
      if (FR[n]) continue;
      const A = man[n];
      FR[n] = { A, img: A.frames.map((f) => { const im = new Image(); im.src = f.src; return im; }), cum: A.frames.reduce((c, f) => (c.push(c[c.length - 1] + f.d / 1000), c), [0]) };
    }
  };
  const frOk = (n) => !!FR[n] && FR[n].img.every((im) => im.complete && im.naturalWidth > 0);
  IL.framesReady = (...ns) => ns.every(frOk);
  FX.def('inkframes', (ctx, q, u) => {
    const F = FR[q.n];
    if (!F || q.t < 0) return;
    const n = F.A.frames.length, cum = F.cum, total = cum[n];
    let t = q.t * (q.speed || 1);
    if (q.hold && q.holdOn) { const [i, j] = q.hold, a0 = cum[i], a1 = cum[j + 1]; if (t > a0) t = a0 + ((t - a0) % Math.max(0.05, a1 - a0)); }
    else if (q.held) t = q.held + (t - q.holdEnd);
    t = Math.min(total - 0.001, Math.max(0, t));
    let i = 0;
    while (i < n - 1 && t >= cum[i + 1]) i++;
    const f = (t - cum[i]) / Math.max(0.001, cum[i + 1] - cum[i]), next = Math.min(n - 1, i + 1);
    const k = q.t / Math.max(0.05, q.life), g = q.grow ? q.grow[0] + (q.grow[1] - q.grow[0]) * (1 - Math.pow(1 - Math.min(1, k), 2)) : 1;
    const fade = k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1, A0 = (q.a === undefined ? 1 : q.a) * fade;
    const sc = ((q.size || 200) / (F.A.cell || 512)) * g;
    let x = q.x, y = q.y;
    if (q.follow) { x += q.follow.x - q.fx0; y += q.follow.y - q.fy0; }
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.translate(x, y);
    if (q.ground) ctx.scale(1, SQ);
    if (q.rot) ctx.rotate(q.rot);
    if (q.flipX) ctx.scale(-1, 1);
    for (const [j, a] of [[i, 1 - (next === i ? 0 : f)], [next, next === i ? 0 : f]]) {
      if (!(a > 0.01)) continue;
      const fr = F.A.frames[j], im = F.img[j];
      ctx.globalAlpha = Math.min(1, A0 * a);
      ctx.drawImage(im, -fr.ox * sc, -fr.oy * sc, fr.w * sc, fr.h * sc);
    }
    ctx.restore();
  }, 'high');
  IL.frames = function (n, x, y, o) {
    o = o || {};
    if (!frOk(n)) return null;
    const F = FR[n], total = F.cum[F.cum.length - 1] / (o.speed || 1);
    const P = Object.assign({ type: 'inkframes', n, x, y, life: o.life || total + 0.05 }, o);
    if (o.follow) { P.fx0 = o.follow.x; P.fy0 = o.follow.y; }
    if (o.hold) {   // (cycle the middle frames while until() holds; then play the rest from where the cycle ends)
      const [i, j, until] = o.hold, after = F.cum[F.cum.length - 1] - F.cum[j + 1];
      P.holdOn = true; P.life = 30;
      P.update = (q) => { if (q.holdOn && !until()) { q.holdOn = false; q.held = F.cum[j + 1]; q.holdEnd = q.t * (q.speed || 1); q.life = q.t + after / (q.speed || 1) + 0.05; } };
    }
    return FX.add(P);
  };

  // ---------------- STAGING: what makes a line's skills read like the reaper's (2026-10-20, the user: "ทำไมของเคียวมันดูมีอะไร
  // มากกว่าตัวอื่น ... ให้มันได้ระดับเดียวกันดิ") ----------------
  // IL.stage(L, cfg): L a lineSkin; cfg.cast(p, id, S) a flourish when a skill of the line goes off, cfg.ult(p, id) an ultimate's
  // (default: the world dimmed + a camera punch), cfg.hit(game, p, e, r, id) what a monster gives up on every hit of a skill,
  // cfg.big(game, p, e, r, id) a heavy impact on a big hit or a crit. Casts are taken from the skills' RUN (offline, online
  // looks, other heroes' looks alike) and, for buffs with no RUN, the cast hooks. Throttled: a monster reacts at most every
  // 0.12 s, a line at most 10 reactions / 0.25 s, one heavy impact / 0.15 s.
  const RUN = NC.SKILL_RUN, SK = NC.SKILLS, KK = NC.SkillKit;
  const stages = [];
  const zoom = (x, y, k, d) => { if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(x, y, k, d); };
  IL.stage = function (L, cfg) {
    const st = { L, cfg, win: 0, n: 0, bigAt: -9, castAt: {} };
    stages.push(st);
    const takes = (p) => L.live() && L.fam(p) && !(cfg.skip && cfg.skip(p));   // (cfg.skip(p): a hero of the line left unstaged)
    st.takes = takes;
    const fire = (p, id) => {
      const G = NC.game, now = G ? G.time : 0;
      if (st.castAt[id] !== undefined && now - st.castAt[id] < 0.05) return;   // (a RUN and its cast hook: once)
      st.castAt[id] = now;
      try {
        if (cfg.cast) cfg.cast(p, id, SK[id] || {});
        if (SK[id] && SK[id].ult) { if (cfg.ult) cfg.ult(p, id); else { IL.dim(1.1, 0.34); zoom(p.x, p.y - 60, 0.05, 0.3); } }
      } catch (e) { console.warn('inklight stage', id, e); }
    };
    for (const id of L.ids) {
      const f = RUN && RUN[id];
      if (!f || f.ilStage) continue;
      const g = function (game, p) { if (takes(p) && !(game && game.presentationOnly && p !== L.me() && Math.random() < 0.5)) fire(p, id); return f.apply(this, arguments); };
      for (const k of ['lkSkin', 'rlEnsure', 'rgEnsure', 'bkEnsure']) if (f[k]) g[k] = f[k];
      g._orig = f._orig || f; g.ilStage = true;
      RUN[id] = g;
    }
    if (NC.skillCasts) NC.skillCasts.push((game, p, id) => { if (L.ids.has(id) && !(RUN && RUN[id]) && takes(p)) fire(p, id); });
    return st;
  };
  if (KK && KK.hit) {
    const baseHit = KK.hit;
    KK.hit = function (game, p, id, e, kx, ky, color, k, extra) {
      const r = baseHit.apply(this, arguments);
      if (!r || r.miss || !e || !stages.length) return r;
      const now = game && game.time || 0;
      for (const st of stages) {
        if (!st.takes(p)) continue;
        const big = !!((extra && extra.big) || r.crit);
        try {
          if (big && st.cfg.big && now - st.bigAt > 0.15) { st.bigAt = now; st.cfg.big(game, p, e, r, id); }
          if (st.cfg.hit && now - (e._ilHit || -9) > 0.12) {
            if (now - st.win > 0.25) { st.win = now; st.n = 0; }
            if (st.n++ < 10) { e._ilHit = now; st.cfg.hit(game, p, e, r, id); }
          }
        } catch (err) { console.warn('inklight hit', id, err); }
      }
      return r;
    };
  }
  // a flourish under a hero: the line's sigil piece flat on the ground popping in and turning, ink under it, bits rising
  IL.flourish = function (p, o) {
    const R = o.r || 110, col = o.col, life = o.life || 0.55;
    if (o.sigil && IL.has(o.sigil)) LK.add({ x: p.x, y: p.y, life, layer: 'low', follow: p, draw(c, q, u, glow) {
      const g = pop(0.4, 1, 0.3)(u), a = (o.a || 0.85) * inOut(0.05, 0.5)(u);
      LK.piece(c, 'ground_glow', p.x, p.y, 0, R * 2.6 * g, R * 2.6 * g * asp('ground_glow'), a * 0.35, col, 0, { glow, ground: true, g: 0.3 });
      LK.piece(c, o.sigil, p.x, p.y, (o.rot0 || 0) + q.t * (o.spin || 2), R * 2 * g, R * 2 * g, a, o.paint ? null : col, 0.3, { glow, ground: true, g: 0.5 });
    } });
    if (o.ink !== false && IL.has(o.ink || 'rg_vsplat')) IL.dark({ n: o.ink || 'rg_vsplat', x: p.x, y: p.y + 4, rot: rand(0, TAU), len: R * 2.3, life: life * 1.3, a: 0.38, ground: true, layer: 'low', grow: pop(0.5, 1, 0.2), fade: inOut(0.05, 0.6) });
    const n = o.n || 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.3, 0.3), rr = R * rand(0.6, 1);
      LK.part({ n: o.bit || 'mote', x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr * SQ, vx: rand(-15, 15), vy: -rand(140, 260), drag: 1.2, len: o.bitLen || rand(10, 16),
        life: rand(0.45, 0.75), a: 0.9, col: o.bitCol || col, white: 0.45, g: 0.7, grow: pop(0.5, 1, 0.3), fade: inOut(0.1, 0.6), sway: rand(4, 8), swayA: 6, ph: rand(0, 6) });
    }
    LK.nightLight(p.x, p.y, R * 1.8, col, 0.5, life);
  };
  // a heavy impact at a monster: the line's impact piece, a shock ring, cracks of its light on the ground, ink, dust, a punch
  IL.impact = function (e, o) {
    const x = e.x, y = e.y, k = o.k || 1, hy = y - 55;
    if (o.star && IL.has(o.star)) LK.part({ n: o.star, x, y: hy, rot: rand(0, TAU), len: 190 * k, life: 0.22, a: 1, col: o.starCol === undefined ? o.col : o.starCol, white: 0.35, g: 0.7, grow: pop(0.45, 1.1, 0.3), fade: out(1.4) });
    LK.ring(x, y, { r0: 20, r1: 170 * k, life: 0.35, col: o.col, a: 0.7 });
    if (o.crack !== false) LK.crack(x, y, { r: 80 * k, col: o.col, life: 0.9 });
    if (IL.has('rg_vsplat')) IL.dark({ n: o.ink || 'rg_vsplat', x, y: y + 4, rot: rand(0, TAU), len: 190 * k, life: 0.9, a: 0.42, ground: true, layer: 'low', grow: pop(0.5, 1, 0.15), fade: inOut(0.05, 0.6) });
    if (o.dust) IL.puffs(x, y + 10, 2, 60 * k, 0.9 * k, { n: [o.dust], a: 0.35, layer: 'low' });
    if (o.extra) o.extra(x, hy, k);
    zoom(x, hy, 0.025, 0.16);
  };
  // something torn out of a monster flying to the hero (the reaper's souls, every line its own): piece n, colour col
  IL.tear = function (p, e, o) {
    const x = e.x, y = e.y - 60, a = NC.angle(x, y, p.x, p.y - 80) + rand(-0.5, 0.5), sp = rand(380, 560);
    for (let i = 0; i < (o.count || 2); i++) {
      const b = a + rand(-0.6, 0.6);
      LK.part({ n: o.n || 'mote', x: x + rand(-10, 10), y: y + rand(-10, 10), vx: Math.cos(b) * sp, vy: Math.sin(b) * sp - 120, drag: 2.4, rot: b + (o.rotK || 0), stretch: !!o.stretch, sp0: 400,
        len: o.len || 16, life: rand(0.35, 0.55), a: 0.95, col: o.col, white: 0.45, g: 0.75, grow: pop(0.5, 1, 0.3), fade: inOut(0.05, 0.55) });
    }
    if (o.dark && IL.has(o.dark)) IL.dark({ n: o.dark, x, y: y + 20, vx: 0, vy: -70, drag: 1, rot: 0, len: o.darkLen || 70, life: 0.5, a: 0.4, grow: (u) => 0.5 + 0.7 * u, fade: inOut(0.1, 0.6) });
  };

  // the screen flashes a skill asks for while pred(scope) holds: a darkening (drawn over everything, the light too) becomes
  // the dim under the light; a bright one is halved (the user dislikes white screens)
  const preds = [];
  IL.flashes = (pred) => preds.push(pred);
  const baseFlash = V.flash;
  V.flash = function (rgb, a, life, mode) {
    const S = LK.scope && LK.scope();
    if (S && preds.some((f) => f(S))) {
      if (mode === 'source-over') { IL.dim(life, a); return; }
      return baseFlash.call(this, rgb, (a || 0) * 0.5, life, mode);
    }
    return baseFlash.apply(this, arguments);
  };
})();
