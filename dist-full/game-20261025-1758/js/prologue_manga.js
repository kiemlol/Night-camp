/* prologue_manga.js — one shot of the story film (js/prologue.js): the Black Knight, 300 years before, gathering a ball
   of blood-red power, cut like a black-and-white manga panel come alive (the user, 2026-10-04, after a manga-style fan
   edit: "ฉากพระเอกใน 300 ปี ใส่เกราะดำ กำลังปล่อยพลังแดงๆ เป็นฉากขาวดำแบบนี้เลย ลายเส้นแบบนี้เลยนะ").
     A. darkness: his raised claw (km_hand); a red seed of power sparks on its tip, a cracked red smear sweeps round it
        (mgarc), lightning cracks split the dark from it out to the edges, the ball swells, white scribbles boiling on it
        (mgcore); hard cut ->
     B. the knight from the waist up (km_knight over the blurred clearing km_bg), the ball floating over his open palm
        (mgorb), its red light staining the grey ink pink, the visor burning, snow, a slow push in; it flares at the end.
   Only the power is coloured: every picture is grey ink (tools/mangacut.py), the effects are frame sheets drawn by code
   (tools/manga_fx.py) played at 12 drawings a second, like hand-drawn anime, and the lightning is drawn live.
   Registers itself in window.NCPrologueExt; prologue.js plays it for the shot { ext: 'manga' } and preloads its files.
   Load BEFORE js/prologue.js. */
(function () {
  'use strict';
  const EXT = (window.NCPrologueExt = window.NCPrologueExt || {});
  // the effect sheets' frames (tools/manga_fx.py writes the same into assets/prologue/fx/meta.json)
  const FXM = { mgorb: { w: 512, h: 512, cols: 4, n: 12 }, mgcore: { w: 512, h: 512, cols: 4, n: 12 }, mgarc: { w: 640, h: 640, cols: 4, n: 8 } };
  const T_CUT = 1.9;                  // shot A -> shot B
  const FPS = 12;                     // the drawn effects change 12 times a second ("on twos")
  // where things are on the pictures (fractions of the picture)
  const CLAW = [0.482, 0.335];        // the raised claw's tip on km_hand
  const PALM = [0.185, 0.455];        // the ball's centre above the open palm on km_knight
  const VISOR = [0.687, 0.288];       // the visor slit on km_knight
  const ORB_A = 0.82, ORB_B = 1.12;   // the ball's sheet width (screen units, the screen is 2 high) in shot A / B
  const INK = [0.05, 0.012, 0.035];   // the plum the blacks lift to

  // the lightning that cracks the dark open: jagged zig-zag bolts branching out from the ball, as segments
  // [x0, y0, x1, y1, dist, depth]
  function crackTree(seed, n, reach) {
    let s = seed;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const segs = [];
    function branch(x, y, a0, len, d, depth) {
      let side = r() < 0.5 ? -1 : 1;
      while (len > 0) {
        const step = (0.09 + r() * 0.12) * (1 - depth * 0.25);
        side = -side;                                        // (zig, zag)
        const ang = a0 + side * (0.25 + r() * 0.6);
        const nx = x + Math.cos(ang) * step, ny = y + Math.sin(ang) * step;
        segs.push([x, y, nx, ny, d, depth]);
        x = nx; y = ny; d += step; len -= step;
        a0 += (r() - 0.5) * 0.25;
        if (depth < 2 && r() < 0.22) branch(x, y, a0 + (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.5), len * (0.25 + r() * 0.3), d, depth + 1);
      }
    }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.7;
      branch(Math.cos(a) * 0.14, Math.sin(a) * 0.14, a, reach * (0.6 + r() * 0.55), 0, 0);
    }
    return segs;
  }
  const CRACK1 = crackTree(11, 7, 2.9), CRACK2 = crackTree(47, 5, 1.9);

  EXT.manga = {
    files: [['km_hand', 'km_hand.jpg'], ['km_knight', 'km_knight.webp'], ['km_bg', 'km_bg.jpg']]
      .concat(...Object.keys(FXM).map((f) => [['fx_' + f, 'fx/' + f + '.webp'], ['fx_' + f + '_g', 'fx/' + f + '_glow.webp']])),
    draw,
  };
  let shake = 0, lastU = 0;

  // api (from prologue.js): K (the WebGL kit), tex(key), picture(tex, zoom, cx, cy, alpha, sx, sy), at(u, v) picture ->
  // screen units, sq / line (sprites in screen units), emit (a particle), rnd, A() (the screen's aspect)
  function draw(api, u, dt) {
    const { K, tex, picture, at, sq, line, emit, rnd, A } = api;
    if (u < lastU) shake = 0;
    lastU = u;
    const fx = { thr: 0.93, bloomK: 0.55, tint: [1, 0.94, 0.96] };
    // a frame of an effect sheet, centred at (x, y), wd wide, with its bloom sheet added over it
    function sheetF(name, f, x, y, wd, alpha, ang, gk) {
      const m = FXM[name], tx = tex('fx_' + name), tg = tex('fx_' + name + '_g');
      if (!tx) return;
      f = ((Math.floor(f) % m.n) + m.n) % m.n;
      const rows = Math.ceil(m.n / m.cols), u0 = (f % m.cols) / m.cols, v0 = Math.floor(f / m.cols) / rows;
      const hw = wd / 2, hh = (wd * m.h) / m.w / 2, a = A(), c = Math.cos(ang || 0), s = Math.sin(ang || 0);
      const P = [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]].map(([px, py]) => [(x + px * c - py * s) / a, y + px * s + py * c]);
      const uv = [u0, v0, u0 + 1 / m.cols, v0 + 1 / rows];
      K.quad(tx.t, false, P, uv, [1, 1, 1, alpha]);
      if (tg) K.quad(tg.t, true, P, uv, [1, 1, 1, alpha * (gk == null ? 0.85 : gk)]);
    }
    function cracks(segs, x, y, reach, a) {
      for (const [x0, y0, x1, y1, d, dep] of segs) {
        if (d > reach) continue;
        const w = [0.0062, 0.0038, 0.0024][dep] * (1 - Math.min(0.55, d / 3.4));
        const X0 = x + x0 * A() * 0.62, X1 = x + x1 * A() * 0.62;
        line(K.TX.glow, X0, y + y0, X1, y + y1, w * 14, [1, 0.12, 0.25, 0.1 * a]);
        line(K.TX.glow, X0, y + y0, X1, y + y1, w * 4.5, [1, 0.35, 0.5, 0.55 * a]);
        line(K.TX.white, X0, y + y0, X1, y + y1, w, [1, 0.92, 0.95, a]);
      }
    }
    const sx = (rnd() - 0.5) * shake, sy = (rnd() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 0.06);

    if (u < T_CUT) {
      // ---------- A: the claw in the dark ----------
      const grow = K.eOut(K.clamp((u - 0.08) / 0.75, 0, 1));
      const hand = tex('km_hand');
      if (hand) picture(hand, 1.04 + u * 0.03, 0.5, 0.5, 0.18 + 0.82 * grow, sx, sy);
      K.flush();
      const o = at(CLAW[0], CLAW[1] - 0.0), oy = o[1] + 0.06 + ORB_A * 0.3 * grow, ox = o[0];
      // the red light on the claw and in the dark round it
      sq(K.TX.glow, ox, oy, 0.4 + 1.1 * grow, [1, 0.08, 0.16, 0.22 + 0.2 * grow]);
      sq(K.TX.glow, ox, oy, 0.15 + 0.35 * grow, [1, 0.25, 0.35, 0.5]);
      K.flush();
      // the lightning: one burst splits the screen, a smaller one later
      if (u > 0.28) {
        if (u - dt <= 0.28) { shake = 0.02; fx.flash = [0.3, 0.02, 0.06]; }
        const fl = 0.65 + 0.35 * Math.sin(u * 53) * Math.sin(u * 17);
        cracks(CRACK1, ox, oy, 3.4 * K.eOut((u - 0.28) / 0.2), fl * (1 - K.sm(1.05, 1.55, u)));
      }
      if (u > 0.95) cracks(CRACK2, ox, oy, 2.2 * K.eOut((u - 0.95) / 0.16), (0.7 + 0.3 * Math.sin(u * 61)) * (1 - K.sm(1.4, 1.85, u)));
      K.flush();
      // the cracked red smear sweeping round the seed, then the ball itself
      const f = Math.floor(u * FPS);
      if (u > 0.05 && u < 1.25) sheetF('mgarc', f, ox, oy, ORB_A * (0.9 + 0.7 * grow), 1 - K.sm(0.95, 1.25, u), 0);
      sheetF('mgcore', f, ox, oy, Math.max(0.02, ORB_A * grow), 1);
      // sparks spat out of it
      if (rnd() < dt * 40 * grow) { const a = rnd() * Math.PI * 2, v = 0.5 + rnd() * 1.2; emit({ x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35, s: 0.005, c: rnd() < 0.7 ? [1, 0.2, 0.3] : [1, 0.9, 0.92], streak: 0.05, tx: K.TX.white }); }
      fx.zoom = 0.02 * grow; fx.zc = [0.5, 0.6];
    } else {
      // ---------- B: the knight, the ball over his palm ----------
      const v = u - T_CUT, push = K.eOut(v / 2.6);
      if (v - dt < 0 || v < dt) shake = 0.012;
      const bg = tex('km_bg'), kn = tex('km_knight');
      if (bg) picture(bg, 1.1 + 0.025 * push, 0.47, 0.5, 1, sx * 0.5, sy * 0.5);
      K.flush();
      K.screen(K.TX.white, -1, -1, 1, 1, [INK[0], INK[1], INK[2], 0.55]); // (the far plate sinks into the dark)
      K.flush();
      if (kn) picture(kn, 1.0 + 0.07 * push, 0.5 - 0.02 * push, 0.46, 1, sx, sy);
      K.flush();
      K.screen(K.TX.white, -1, -1, 1, 1, [INK[0] * 2, INK[1] * 2, INK[2] * 2, 0.06], { add: true }); // blacks lift to plum
      const o = at(PALM[0], PALM[1]), bob = 0.012 * Math.sin(v * 5.5), z = 1.0 + 0.07 * push;
      const flare = K.sm(2.32, 2.6, v);
      // its red light staining the ink: wide, then close
      sq(K.TX.glow, o[0], o[1] + bob, 1.5 + 0.8 * flare, [1, 0.08, 0.16, 0.17 + 0.25 * flare]);
      sq(K.TX.glow, o[0], o[1] + bob, 0.7, [1, 0.12, 0.2, 0.4]);
      const vz = at(VISOR[0], VISOR[1]); // the visor burns red
      sq(K.TX.glow, vz[0], vz[1], 0.16 + 0.02 * Math.sin(v * 13), [1, 0.1, 0.12, 0.85]);
      sq(K.TX.glow, vz[0], vz[1], 0.05, [1, 0.6, 0.6, 0.9]);
      K.flush();
      sheetF('mgorb', Math.floor(v * FPS), o[0], o[1] + bob, ORB_B * z * (1 + 0.25 * flare), 1, 0, 0.4); // (a weak bloom: deep red, not pink)
      // snow drifting through (grey ink flakes), red sparks off the ball
      if (rnd() < dt * 30) emit({ x: (rnd() * 2.4 - 1.2) * A(), y: 1.1, vx: -0.08, vy: -0.18 - rnd() * 0.12, life: 7, s: 0.004 + rnd() * 0.008, c: [0.9, 0.88, 0.9], a: 0.8, wob: 0.05, ph: rnd() * 9, add: false });
      if (rnd() < dt * 26) { const a = rnd() * Math.PI * 2, sp = 0.3 + rnd() * 0.7; emit({ x: o[0], y: o[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 0.2, life: 0.5, s: 0.005, c: [1, 0.22, 0.3], streak: 0.05, tx: K.TX.white }); }
      if (v < 0.07) fx.flash = [0.55, 0.5, 0.52];
      if (flare > 0) { fx.flash = [flare * 0.75, flare * 0.03, flare * 0.08]; fx.zoom = 0.06 * flare; fx.zc = [0.5 + o[0] / A() / 2, 0.5 + o[1] / 2]; }
    }
    return fx;
  }
})();
