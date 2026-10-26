/* bloodlance_gl.js — the blood lance on the WebGL effects layer (js/glfx.js), 2026-10-05. The first try was baked sheets
   (js/bloodlancefx.js, tools/bloodlance_fx.py) and the user found it stiff ("แข็งทื่อ"); this one is made the way the
   clip's Unreal effect is made: many small live pieces, each with its own path, timing and curves, noise flowing through
   them and eating them away. The reference clip, in beats:
     0.00  strike on the monster: star rays, dark thorns that shoot out and erode, a ring, sparks, a puff of dark smoke;
           a dark orb lights in the hero's hand and pulls red motes in
     0.12  seven claw blades fling out of the monster, each on its own curve, and fly back into the hand, growing, trailing
           dark smoke
     0.82  they land: a crimson whirlpool (dark body + bright tendrils spinning), the orb heats pink, white flares cross,
           embers burst, smoke streams back along the line; dark specks and embers hang on the line
     2.00  motes rush into the orb (charge)
     2.40  pink flash, camera punch, hit-stop: a shell (ink rim, orange band, white) bursts along the line, a white beam
           fires through it, then the crystal: sharp at the hand, wide at the monster, energy flowing down it, pulsing;
           a crown of crystal spikes shoots out of the monster; all turn violet, erode from the hand end with a bright
           edge, leave a thin violet line and violet twinkles drifting up
   NC.BloodLanceFX.cast(game, p, e, { onStrike, onLance, pose }) · test: ?bloodlance (the nearest monster every 6 s). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, GL = NC.GLFX;
  if (!FX || !V || !GL) return;
  const BL = (NC.BloodLanceFX = { on: true, gl: true });
  const rand = NC.rand, TAU = Math.PI * 2, C = GL.curve, back = GL.backOut, out = GL.out;
  const P = GL.PAL, S = GL.SH;
  const RED = '255,60,110', PINK = '255,150,205', VIO = '160,110,255';
  BL.ready = () => GL.ok();

  const hand = (p) => {
    const L = p.pose && NC.weaponLine && NC.weaponLine(p.equip, p.pose, p.x, p.y);
    return L ? [L.hand[0], L.hand[1]] : [p.x + (p.face || 1) * 26, p.y - 72];
  };
  const body = (e) => [e.x, e.y - 48];
  const alive = (e) => e && e.hp > 0;

  // one live piece: draw(q, u) each frame for `life` seconds on a layer
  FX.def('bl2_piece', (ctx, q) => q.draw(q, Math.min(1, q.t / q.life)), 'glow');
  FX.def('bl2_piece_low', (ctx, q) => q.draw(q, Math.min(1, q.t / q.life)), 'low');
  const piece = (life, draw, low, delay) => {
    const go = () => FX.add({ type: low ? 'bl2_piece_low' : 'bl2_piece', x: 0, y: 0, life, draw });
    if (delay) V.at(delay, go); else go();
  };

  // sparks / embers stretched along their velocity (additive)
  const sparkDraw = (palId, lenK, wid) => (p, u) => {
    const sp = Math.hypot(p.vx, p.vy), ang = Math.atan2(p.vy, p.vx), a = (1 - u) * (p.a || 1);
    const len = (p.len || 8) + sp * (lenK || 0.03);
    GL.quad('glow', p.x, p.y, len, (p.w || 2.4) * (wid || 1) * (1 - u * 0.5), ang, { shape: S.spark, pal: palId, add: true, a });
  };
  const burstSparks = (x, y, n, o) => {
    const ps = GL.parts({ draw: sparkDraw(o.pal, o.lenK, o.wid) });
    for (let i = 0; i < n; i++) {
      const a = o.ang !== undefined ? o.ang + rand(-o.spread, o.spread) : rand(0, TAU), s = rand(o.min || 300, o.max || 800);
      ps.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.8, drag: o.drag || 5, grav: o.grav || 0, life: rand(o.l0 || 0.25, o.l1 || 0.55), w: rand(1.8, 3.2), len: rand(4, 10) });
    }
    return ps;
  };
  // dark toon smoke puffs (alpha): grow, drift, erode with a lit edge
  const smoke = (keep) => GL.parts({ spawnFor: keep || 0,
    draw: (p, u) => {
      const r = p.r0 + (p.r1 - p.r0) * out(u, 2);
      GL.quad(p.low ? 'low' : 'glow', p.x, p.y, r, r * 0.9, p.rot || 0, { shape: S.puff, pal: p.pal === undefined ? P.dusk : p.pal, erode: C(u, [[0, 0.05], [0.35, 0.15], [1, 1.25]]), edge: 0.1, seed: p.seed, ns: 2.4, pan: 0.3, a: 0.95 });
    },
  });
  const puff = (sys, x, y, o) => sys.add(Object.assign({ x, y, vx: rand(-30, 30), vy: rand(-40, -5), drag: 2, life: rand(0.4, 0.7), r0: 10, r1: 26, seed: rand(0, 50), rot: rand(0, TAU) }, o || {}));

  // ---------------- the beats ----------------
  function strike(game, p, e) {
    const [x, y] = body(e), seed = rand(0, 9);
    // star rays + glow + ring
    piece(0.42, (q, u) => {
      const r = 165 * C(u, [[0, 0.25], [0.07, 1.12], [0.22, 0.85], [1, 0.05]]);
      GL.quad('glow', x, y, r * 1.5, r * 1.5, 0, { shape: S.glow, tint: [1, 0.35, 0.6], add: true, a: C(u, [[0, 1], [0.5, 0.6], [1, 0]]) });
      GL.quad('glow', x, y, r, r, seed, { shape: S.star, pal: P.pink, seed, add: true, a: C(u, [[0, 1], [0.55, 0.9], [1, 0]]) });
    });
    piece(0.4, (q, u) => {
      const r = 40 + 150 * out(u, 2.5);
      GL.quad('glow', x, y, r, r * 0.62, 0, { shape: S.ring, pal: P.pink, erode: C(u, [[0, 0], [0.3, 0.1], [1, 1]]), ns: 3, seed, add: true });
    });
    // the dark thorns: shoot out with overshoot, erode from the tips
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * TAU + rand(-0.25, 0.25), L = rand(110, 200), w = rand(12, 20), d = rand(0, 0.04), sd = rand(0, 40);
      piece(0.62, (q, u) => {
        const len = L * back(u / 0.16, 2.2) * C(u, [[0, 1], [0.5, 1], [1, 0.92]]);
        if (len < 2) return;
        const cx = x + Math.cos(ang) * len * 0.5, cy = y + Math.sin(ang) * len * 0.5 * 0.85;
        GL.quad('glow', cx, cy, len * 0.5, w, ang, { shape: S.thorn, pal: P.dusk, erode: C(u, [[0, 0], [0.4, 0], [1, 1]]), edge: 0.12, ns: 3, seed: sd, extra: 0.08 });
      }, false, d);
    }
    burstSparks(x, y, 26, { pal: P.ember, min: 380, max: 980, drag: 5, l0: 0.25, l1: 0.55 });
    const sm = smoke();
    for (let i = 0; i < 6; i++) { const a = rand(0, TAU); puff(sm, x + Math.cos(a) * 20, y + Math.sin(a) * 14, { vx: Math.cos(a) * 90, vy: Math.sin(a) * 60 - 20, r0: 14, r1: 34, life: rand(0.45, 0.7) }); }
    V.light(x, y, 360, RED, 1, 0.5);
    V.shake(game, 6);
    V.stop(game, 0.05);
  }

  // the orb in the hand and the motes it pulls in
  function orb(game, p, from, to, heat0, heat1, r0, r1) {
    piece(to - from, (q, u) => {
      const [x, y] = hand(p), pul = 1 + 0.12 * Math.sin(q.t * 26), heat = heat0 + (heat1 - heat0) * u, r = (r0 + (r1 - r0) * u) * pul;
      GL.quad('glow', x, y, r * 4.2, r * 4.2, 0, { shape: S.glow, tint: heat > 0.5 ? [1, 0.55, 0.8] : [1, 0.15, 0.32], add: true, a: 0.75 * Math.min(1, q.t / 0.08) });
      GL.quad('glow', x, y, r, r, 0, { shape: S.orb, pal: P.blood, extra: heat, a: Math.min(1, q.t / 0.06) });
    }, false, from);
  }
  function pullIn(game, p, from, dur, rate, palId) {
    V.at(from, () => {
      const ps = GL.parts({ draw: sparkDraw(palId, 0.025, 0.9), life: dur + 0.5, spawnFor: dur,
        tick(q, dt) {
          if (q.t > dur) return;
          const [x, y] = hand(p);
          for (let n = 0; n < rate * dt; n++) {
            const a = rand(0, TAU), d = rand(70, 140), s = rand(260, 420);
            ps.add({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8, vx: -Math.cos(a) * s, vy: -Math.sin(a) * s * 0.8, life: d / s * 0.95, w: rand(1.6, 2.6), len: 5 });
          }
        } });
    });
  }

  // the claw blades: out of the monster on their own curves, back into the hand
  function claws(game, p, e) {
    const [ax, ay] = body(e), sm = smoke(1.3);
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1, spread = rand(70, 175) * side, along0 = rand(-30, 60), back1 = rand(60, 120);
      const delay = i * 0.025 + rand(0, 0.03), T = 0.68 - delay + rand(0, 0.1), Wd = rand(7, 11), sd = rand(0, 40);
      let lastPuff = 0;
      piece(T + 0.08, (q, u0) => {
        const [hx, hy] = hand(p);
        let dx = hx - ax, dy = hy - ay; const D = Math.hypot(dx, dy) || 1; dx /= D; dy /= D;
        const px = -dy, py = dx;
        const B = [ax + px * spread + dx * along0, ay + py * spread * 0.8 + dy * along0];
        const Cc = [hx + px * spread * 0.32 - dx * back1, hy + py * spread * 0.26 - dy * back1];
        const bz = (s) => { const m = 1 - s; return [m * m * m * ax + 3 * m * m * s * B[0] + 3 * m * s * s * Cc[0] + s * s * s * hx, m * m * m * ay + 3 * m * m * s * B[1] + 3 * m * s * s * Cc[1] + s * s * s * hy]; };
        const sOf = (u) => { u = Math.max(0, Math.min(1, u)); return 0.45 * GL.ease(u) + 0.55 * u * u; };
        const u = Math.min(1, (q.t) / T);
        if (u >= 1 && q.t > T + 0.06) return;
        const N = 12, W = Wd * (0.7 + 1.1 * u);
        const pts = [];
        for (let k = N - 1; k >= 0; k--) {
          const [x, y] = bz(sOf(u - k * 0.028));
          const w = k === 0 ? W * 0.12 : k === 1 ? W * 0.85 : W * Math.pow(1 - (k - 1) / (N - 1), 1.3);
          pts.push({ x, y, w });
        }
        const fade = u >= 1 ? 1 - (q.t - T) / 0.06 : Math.min(1, q.t / 0.05);
        GL.strip('glow', pts, { shape: S.blade, pal: P.blood, pan: 3, ns: 3.5, seed: sd, a: fade, extra: 0.04 });
        const hd = pts[pts.length - 1];
        GL.quad('glow', hd.x, hd.y, W * 2.6, W * 2.6, 0, { shape: S.glow, tint: [1, 0.4, 0.65], add: true, a: 0.55 * fade });
        if (u < 1 && q.t - lastPuff > 0.03) { lastPuff = q.t; const tl = pts[Math.floor(N * 0.5)]; puff(sm, tl.x, tl.y, { vx: rand(-20, 20), vy: rand(-25, 0), r0: 6, r1: 16 + 10 * u, life: rand(0.3, 0.45), pal: P.smoke }); }
      }, false, 0.12 + delay);
    }
  }

  // the whirlpool round the hand
  function vortex(game, p, e) {
    const sd = rand(0, 30);
    piece(0.95, (q, u) => {
      const [x, y] = hand(p);
      const r = 165 * back(u / 0.14, 1.6) * C(u, [[0, 1], [0.6, 1.05], [1, 1.1]]);
      const er = C(u, [[0, 0], [0.55, 0.02], [1, 1.05]]);
      GL.quad('glow', x, y, r, r * 0.82, -0.25, { shape: S.vortex, pal: P.blood, erode: er, pan: 3.2, ns: 1.6, seed: sd, extra: 0 });
      GL.quad('glow', x, y, r, r * 0.82, -0.25, { shape: S.vortex, pal: P.blood, erode: er, pan: 3.2, ns: 1.6, seed: sd, extra: 1, add: true });
    });
    // the ball heats up
    orb(game, p, 0, 0.9, 0, 1, 15, 19);
    // white flares crossing
    for (const [rot, L, w, d] of [[-0.45, 260, 5.5, 0.02], [0.62, 180, 4, 0.05], [-0.15, 150, 3, 0.1]])
      piece(0.55, (q, u) => {
        const [x, y] = hand(p), len = L * C(u, [[0, 0.1], [0.12, 1], [0.6, 0.8], [1, 0]]);
        GL.quad('glow', x, y, len, w * (1 - u * 0.5), rot, { shape: S.spark, pal: P.pink, add: true, extra: 0.2, a: C(u, [[0, 1], [0.7, 1], [1, 0]]) });
      }, false, d);
    const [hx, hy] = hand(p), [bx, by] = body(e);
    burstSparks(hx, hy, 34, { pal: P.ember, min: 300, max: 760, drag: 3.5, l0: 0.35, l1: 0.85, grav: -60 });
    // smoke streaming back along the line toward the monster
    const sm = smoke();
    const dx = bx - hx, dy = by - hy, D = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < 9; i++) { const k = rand(0.05, 0.4); puff(sm, hx + dx * k, hy + dy * k, { vx: (dx / D) * rand(60, 160), vy: (dy / D) * rand(60, 160) - 10, r0: 12, r1: 30, life: rand(0.45, 0.8), pal: P.smoke }); }
    V.light(hx, hy, 460, RED, 1, 0.9, { follow: p });
    V.shake(game, 9);
    V.stop(game, 0.07);
    // dark specks and embers hanging on the line
    V.at(0.15, () => {
      const ps = GL.parts({ life: 1.8, spawnFor: 1.2,
        draw: (s, u) => {
          const a = Math.sin(u * Math.PI);
          if (s.ember) GL.quad('glow', s.x, s.y, 7, 7, 0, { shape: S.glow, tint: [1, 0.45, 0.25], add: true, a: a * 0.9 });
          else GL.quad('glow', s.x, s.y, s.r, s.r, s.rot, { shape: S.puff, pal: P.smoke, erode: 0.1 + u * 0.8, seed: s.sd, ns: 3, a: 0.9 * a });
        },
        tick(q, dt) {
          if (q.t > 1.2) return;
          const [h2x, h2y] = hand(p), [b2x, b2y] = alive(e) ? body(e) : [bx, by];
          for (let n = 0; n < 34 * dt * 2; n++) {
            const k = Math.random();
            ps.add({ x: h2x + (b2x - h2x) * k + rand(-12, 12), y: h2y + (b2y - h2y) * k + rand(-10, 10), vx: rand(-15, 15), vy: rand(-30, -8), drag: 1, life: rand(0.6, 1.1),
              ember: Math.random() < 0.35, r: rand(3, 6), rot: rand(0, TAU), sd: rand(0, 40) });
          }
        } });
    });
  }

  // the lance, the crown, the violet end
  function lance(game, p, e) {
    const sd = rand(0, 30);
    let lastB = body(e);
    const ends = () => { const h = hand(p); if (alive(e)) lastB = body(e); return [h[0], h[1], lastB[0], lastB[1]]; };
    const [hx, hy, bx, by] = ends(), ang = Math.atan2(by - hy, bx - hx);
    V.flash('255,120,200', 0.45, 0.24);
    V.shake(game, 14);
    V.stop(game, 0.1);
    GL.zoom((hx + bx) / 2, (hy + by) / 2, 0.12, 0.55);
    // the shell
    piece(0.3, (q, u) => {
      const [x0, y0, x1, y1] = ends(), L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
      GL.quad('glow', (x0 + x1) / 2, (y0 + y1) / 2, L * 0.53, 64 * C(u, [[0, 0.7], [0.15, 1.08], [1, 0.92]]), a,
        { shape: S.shell, pal: P.shell, erode: C(u, [[0, 0], [0.35, 0], [1, 1.05]]), ns: 4, pan: 2, seed: sd, extra: 0.1 });
    });
    // the beam through it
    piece(0.5, (q, u) => {
      const [x0, y0, x1, y1] = ends(), pts = [];
      for (let k = 0; k <= 8; k++) { const s = k / 8; pts.push({ x: x0 + (x1 - x0) * s, y: y0 + (y1 - y0) * s, w: 30 * C(u, [[0, 1], [0.3, 0.6], [1, 0]]) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, s * 1.15))) + 1 }); }
      GL.strip('glow', pts, { shape: S.blade, pal: P.pink, add: true, extra: 0.7, pan: 8, ns: 4, seed: sd, even: true });
      GL.quad('glow', x0, y0, 70 * (1 - u), 70 * (1 - u), 0, { shape: S.star, pal: P.pink, add: true, seed: sd + 1 });
    }, false, 0.02);
    // the crystal
    const life = 1.6;
    const palOf = (u) => C(u, [[0, 0], [0.6, 0], [0.7, 1], [1, 1]]);
    piece(life, (q, u) => {
      const [x0, y0, x1, y1] = ends(), pts = [];
      const W = 68 * C(u, [[0, 0], [0.05, 1.15], [0.11, 0.94], [0.16, 1], [0.6, 1], [0.7, 1.06], [1, 0.9]]) * (1 + 0.035 * Math.sin(q.t * 31));
      for (let k = 0; k <= 16; k++) {
        const s = k / 16;
        pts.push({ x: x0 + (x1 - x0) * s, y: y0 + (y1 - y0) * s, w: W * Math.pow(s, 0.82) * (1 - 0.45 * Math.max(0, (s - 0.88) / 0.12)) + 1.2 });
      }
      const pulse = 0.07 * Math.sin(q.t * 24) + C(u, [[0, 0.3], [0.1, 0], [0.6, 0], [0.68, 0.3], [0.78, 0.04]]);
      GL.strip('glow', pts, { shape: S.crystal, pal: palOf(u), extra: pulse, erode: C(u, [[0, 0], [0.74, 0], [1, 1.02]]), edge: 0.06, pan: 2.6, ns: 6, seed: sd });
    }, false, 0.05);
    // the crown of spikes out of the monster
    const spikes = [];
    for (let i = 0; i < 13; i++) spikes.push({ a: ang + (-1 + (2 * i) / 12) * 1.95 + rand(-0.12, 0.12), L: rand(70, 150), w: rand(12, 20), d: rand(0, 0.05), sd: rand(0, 40) });
    for (let i = 0; i < 4; i++) spikes.push({ a: ang + Math.PI + rand(-0.8, 0.8), L: rand(40, 70), w: rand(10, 14), d: rand(0, 0.05), sd: rand(0, 40) });
    piece(life, (q, u) => {
      const [, , x1, y1] = ends(), pf = palOf(u);
      GL.quad('glow', x1, y1, 120, 100, 0, { shape: S.glow, tint: pf < 0.5 ? [1, 0.25, 0.5] : [0.6, 0.4, 1], add: true, a: 0.65 * C(u, [[0, 1], [0.8, 0.6], [1, 0]]) });
      for (const s of spikes) {
        const v = Math.max(0, (q.t - s.d) / life);
        const len = s.L * back(v / 0.09, 2.4) * (1 + 0.04 * Math.sin(q.t * 18 + s.sd));
        if (len < 2) continue;
        GL.quad('glow', x1 + Math.cos(s.a) * len * 0.5, y1 + Math.sin(s.a) * len * 0.5 * 0.85, len * 0.5, s.w, s.a,
          { shape: S.thorn, pal: pf, erode: C(v, [[0, 0], [0.7, 0], [1, 1]]), edge: 0.1, ns: 3, seed: s.sd, extra: 0.06 });
      }
    }, false, 0.06);
    // sparks pouring off the crown
    V.at(0.06, () => {
      const ps = GL.parts({ draw: sparkDraw(P.pink, 0.03, 1), life: 1.4, spawnFor: 0.7,
        tick(q, dt) {
          if (q.t > 0.7) return;
          const [, , x1, y1] = ends();
          for (let n = 0; n < 60 * dt; n++) { const a = ang + rand(-1.6, 1.6), s = rand(260, 700); ps.add({ x: x1, y: y1, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.8, drag: 4, grav: 120, life: rand(0.25, 0.55), w: rand(1.6, 2.8), len: 6 }); }
        } });
      burstSparks(bx, by, 30, { pal: P.pink, ang, spread: 1.4, min: 500, max: 1100, drag: 5, l0: 0.3, l1: 0.6 });
    });
    // the light on the ground under the line
    piece(life + 0.1, (q, u) => {
      const [x0, y0, x1, y1] = ends(), pf = palOf(u), a = 0.55 * C(u, [[0, 1], [0.8, 0.8], [1, 0]]);
      for (let k = 0; k <= 4; k++) {
        const s = k / 4;
        GL.quad('low', x0 + (x1 - x0) * s, y0 + (y1 - y0) * s + 40, 130, 46, 0, { shape: S.glow, tint: pf < 0.5 ? [1, 0.3, 0.55] : [0.55, 0.4, 1], add: true, a });
      }
    }, true);
    for (let k = 0; k <= 3; k++) V.light(hx + ((bx - hx) * k) / 3, hy + ((by - hy) * k) / 3, 300, PINK, 0.75, 1.1);
    V.at(life * 0.68, () => { const [x0, y0, x1, y1] = ends(); for (let k = 0; k <= 3; k++) V.light(x0 + ((x1 - x0) * k) / 3, y0 + ((y1 - y0) * k) / 3, 300, VIO, 0.75, 0.9); });
    // the thin violet line and the twinkles
    piece(0.65, (q, u) => {
      const [x0, y0, x1, y1] = ends(), pts = [];
      for (let k = 0; k <= 8; k++) { const s = k / 8; pts.push({ x: x0 + (x1 - x0) * s, y: y0 + (y1 - y0) * s, w: 5.5 * C(u, [[0, 1], [0.6, 0.5], [1, 0]]) + 0.3 }); }
      GL.strip('glow', pts, { shape: S.blade, pal: P.violet, add: true, extra: 0.6, pan: 6, ns: 5, seed: sd, even: true });
    }, false, life * 0.78);
    V.at(life * 0.8, () => {
      const ps = GL.parts({ life: 2.2, spawnFor: 0.5,
        draw: (s, u) => { const k = Math.sin(u * Math.PI) * (0.75 + 0.25 * Math.sin(s.t * 20 + s.ph)); GL.quad('glow', s.x, s.y, s.r * k, s.r * k, 0, { shape: S.twinkle, pal: P.violet, add: true, a: k }); },
        tick(q, dt) {
          if (q.t > 0.5) return;
          const [x0, y0, x1, y1] = ends();
          for (let n = 0; n < 160 * dt; n++) { const k = Math.random(); ps.add({ x: x0 + (x1 - x0) * k + rand(-10, 10), y: y0 + (y1 - y0) * k + rand(-8, 8), vx: rand(-14, 14), vy: rand(-55, -15), drag: 1.2, life: rand(0.6, 1.3), r: rand(4, 10), ph: rand(0, 9) }); }
        } });
    });
  }

  // ---------------- the whole cast ----------------
  BL.cast = function (game, p, e, o) {
    o = o || {};
    if (!BL.ready() || !e) return false;
    const K = NC.SkillKit;
    const pose = (i, lock) => { if (o.pose === false || !K || !K.pose || !K.clip) return; p.aim = Math.atan2(e.y - p.y, e.x - p.x); K.pose(game, p, K.clip(p, null, i), lock); };
    pose(0, 0.35);
    strike(game, p, e);
    orb(game, p, 0, 0.84, 0, 0.12, 9, 12);
    pullIn(game, p, 0.08, 0.6, 30, P.blood);
    if (o.onStrike) o.onStrike(game, p, e);
    V.at(0, () => claws(game, p, e));
    V.at(0.82, () => vortex(game, p, e));
    V.at(1.95, () => { orb(game, p, 0, 0.47, 0.5, 1, 11, 17); pullIn(game, p, 0, 0.42, 70, P.pink); });
    V.at(2.4, () => {
      if (!alive(e) && !o.anyway) return;
      pose(2, 0.6);
      lance(game, p, e);
      if (o.onLance) o.onLance(game, p, e);
    });
    return true;
  };

})();
