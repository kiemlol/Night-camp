/* lightslash.js — the sword's plain hits made of LIGHT, the way a game engine's particle system does it (2026-10-19: after the
   painted ink frames, the user: "แบบในคลิปเขาไม่ได้ใช้รูปเป็นเฟรมงี้ เขาทำเป็นแสงๆ เขาทำไง" -> "ลองทำท่าฟันแบบแสงอนุภาค + bloom
   แบบในคลิปกับการตีปกติของดาบ ขอดูภาพนิ่งในเกมก่อน").
   No frames: sixteen single light pieces (assets/lightslash/: spikes, a glow orb, sparkles, lightning, a slash line ...,
   Codex on black: assets/gen/make_lightslash_prompts.py -> tools/lightslash_cut.py) fired by the dozen at every blow and moved
   every frame: a soft flash and a hot core, spikes shooting out along the blow (stretched by their speed, slowing hard,
   shrinking), twinkling sparkles flung out with drag and gravity, a flicker of lightning, speed streaks; the finisher adds a
   shock ring, a crit a crimson cut along the swing with red spikes. Each piece is drawn as light ('lighter': a tinted copy +
   the white painting), so where they pile up they burn white; then a BLOOM pass: the pieces again, in colour and wider, into
   a quarter-size canvas, blurred twice and added over the frame (the glow round the light, like an engine's bloom).
   A look of js/inkslash.js (its hit picking, the swap of hitfeel's spark / embers and the colour split): ?inkslash=light.
   The code only places, moves, turns, stretches, tints and blurs the painted pieces. Load after js/inkslash.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, IS = NC.InkSlash;
  if (!FX || !IS) return;
  const MAN = NC.ASSET_MANIFEST_LIGHTSLASH || {};
  const LS = (NC.LightSlash = { bloom: 0.5, blur: [4, 11] });   // (the first stills burnt white: everything was ~2x)
  const rand = NC.rand, PI = Math.PI;
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const IMG = {}, IMV = {};   // (each piece as painted, and its white copy for any colour)
  for (const n in MAN) { IMG[n] = new Image(); IMG[n].src = MAN[n].src; IMV[n] = new Image(); IMV[n].src = MAN[n].v; }
  const NEED = ['spike_long', 'spike_mid', 'shard', 'soft', 'orb', 'core', 'star', 'dot', 'chip', 'bolt_a', 'bolt_b', 'bolt_c', 'streak', 'ring', 'slash_line'];
  const aspect = (n) => (MAN[n] ? MAN[n].h / MAN[n].w : 0.1);

  // the white copy multiplied by a colour (drawn as light: where it is clear nothing is added)
  const tints = new Map();
  function tinted(n, hex) {
    const key = n + hex;
    let c = tints.get(key);
    if (!c) {
      const im = IMV[n];
      c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      x.globalCompositeOperation = 'multiply'; x.fillStyle = hex; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
      tints.set(key, c);
    }
    return c;
  }
  // one piece as light, centred at (x, y), turned by rot, len x wid world units: as painted (hex null) or its white copy in
  // that colour (a), plus the white copy on top (a x white: where pieces pile up they burn white)
  function piece(c, n, x, y, rot, len, wid, a, hex, white) {
    const im = IMG[n], iv = IMV[n];
    if (!ok(im) || !ok(iv) || a <= 0.004 || len < 0.5) return;
    c.save();
    c.translate(x, y); if (rot) c.rotate(rot);
    c.globalAlpha = Math.min(1, a); c.drawImage(hex ? tinted(n, hex) : im, -len / 2, -wid / 2, len, wid);
    if (white > 0) { c.globalAlpha = Math.min(1, a * white); c.drawImage(iv, -len / 2, -wid / 2, len, wid); }
    c.restore();
  }

  // a particle: n (piece), x y, vx vy (moving: drag, grav), life, t (< 0: not born yet), len, wid (or thick x the painting's
  // own proportion), rot, a, col, white, g (its bloom), grow(u) -> size, fade(u) -> strength, stretch (turned along its
  // flight, longer while fast), tw (twinkle), flick (lightning: another bolt and a jitter 30 times a second)
  const BOLTS = ['bolt_a', 'bolt_b', 'bolt_c'];
  function drawPart(c, P, glow) {
    const u = Math.min(1, P.t / P.life);
    let a = P.a * (P.fade ? P.fade(u) : 1 - u);
    let len = P.len, wid = P.wid, rot = P.rot || 0;
    if (P.grow) { const g = P.grow(u); len *= g; wid *= g; }
    if (P.stretch) {
      const sp = Math.hypot(P.vx, P.vy), s = Math.min(1.5, 0.4 + sp / P.sp0);
      rot = Math.atan2(P.vy, P.vx); len *= s; wid *= Math.min(1, 0.55 + 0.45 * s);
    }
    if (P.tw) a *= 0.6 + 0.4 * Math.sin(P.t * P.tw + P.ph);
    if (glow) piece(c, P.n, P.x, P.y, rot, len * 1.2, wid * 1.8, a * (P.g === undefined ? 0.9 : P.g), P.col, 0);
    else piece(c, P.n, P.x, P.y, rot, len, wid, a, P.col, P.white);
  }
  const live = new Set();
  FX.def('lslash', (ctx, q) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    for (const P of q.parts) if (P.t >= 0) drawPart(ctx, P, false);
    ctx.restore();
  }, 'glow');
  function update(q, dt) {
    for (let i = q.parts.length - 1; i >= 0; i--) {
      const P = q.parts[i];
      P.t += dt;
      if (P.t < 0) continue;
      if (P.t >= P.life) { q.parts.splice(i, 1); continue; }
      if (P.vx !== undefined) {
        const k = Math.exp(-(P.drag || 0) * dt);
        P.vx *= k; P.vy *= k; P.vy += (P.grav || 0) * dt;
        P.x += P.vx * dt; P.y += P.vy * dt;
      }
      if (P.flick && (P.ft = (P.ft || 0) - dt) <= 0) { P.ft = 1 / 30; P.n = BOLTS[(Math.random() * 3) | 0]; P.rot = P.rot0 + rand(-0.3, 0.3); }
    }
    if (q.t > 0.05 && !q.parts.length) q.dead = true;
  }

  // ---------------- one blow: h = { hx, hy, dir, k, fin, crit, heavy, ang, n } (js/inkslash.js) ----------------
  const pop = (s0, s1, at) => (u) => (u < at ? s0 + (s1 - s0) * (u / at) : s1);                 // grows to s1 by `at`, then holds
  const out = (p) => (u) => Math.pow(1 - u, p);
  function burst(h) {
    const red = !!h.crit, K = h.k * (h.fin ? 1.25 : 1) * (h.n > 1 ? 0.85 : 1);
    const fwd = h.dir > 0 ? 0 : PI;                                                              // the blow's way
    const COL = red ? '#ff2d48' : null, COL2 = red ? '#ff7a6a' : '#86dcff';   // (null: the piece as painted, white-hot + violet)
    const parts = [];
    const add = (P) => { P.t = P.t || 0; if (!P.len && P.thick) P.len = 1; parts.push(P); return P; };
    const x = h.hx, y = h.hy;
    // the flash: a wide soft glow and a hot core, then a smaller orb
    add({ n: 'soft', x, y, len: 190 * K, wid: 190 * K * aspect('soft'), life: 0.16, a: 0.38, col: COL, white: 0, g: 0.45, grow: pop(0.5, 1.05, 0.25), fade: out(1.8) });
    add({ n: 'core', x, y, rot: rand(0, PI), len: 125 * K, wid: 125 * K * aspect('core'), life: 0.11, a: 0.95, col: COL, white: 0.45, g: 0.7, grow: pop(0.55, 1.1, 0.35), fade: out(1.3) });
    add({ n: 'orb', x, y, len: 70 * K, wid: 70 * K * aspect('orb'), life: 0.13, a: 0.75, col: COL, white: 0.35, g: 0.6, grow: pop(1.1, 0.5, 1), fade: out(1.5) });
    // the spikes: most along the blow, some all round; fast, slowing hard, stretched by their speed
    const ns = red ? 16 : h.fin ? 18 : 13;
    for (let i = 0; i < ns; i++) {
      const front = Math.random() < 0.68, a = fwd + (front ? rand(-1.05, 1.05) : rand(-PI, PI));
      const sp = rand(1150, 2100) * K, n = i < 4 ? 'spike_long' : i % 3 === 0 ? 'shard' : 'spike_mid';
      const L = (n === 'spike_long' ? rand(150, 210) : n === 'shard' ? rand(55, 80) : rand(95, 140)) * K;
      add({ n, x: x + Math.cos(a) * 10 * K, y: y + Math.sin(a) * 10 * K, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 11, sp0: 900 * K, stretch: true,
        len: L, wid: L * aspect(n) * 1.15, life: rand(0.12, 0.22), a: 0.95, col: i % 4 === 3 ? COL2 : COL, white: 0.45, g: 0.55, fade: out(1.3) });
    }
    // sparkles: stars, dots and chips flung out, twinkling, falling a little
    for (let i = 0; i < (red ? 12 : 11); i++) {
      const a = fwd + rand(-2.2, 2.2), sp = rand(260, 820) * K, n = i < 3 ? 'star' : i < 8 ? 'dot' : 'chip';
      const L = (n === 'star' ? rand(34, 52) : n === 'dot' ? rand(12, 20) : rand(10, 16)) * K;
      const col = n === 'star' ? (red ? '#ffd0c8' : '#ffe27a') : [COL, COL2, red ? '#ffffff' : null][i % 3];
      add({ n, x, y, t: -rand(0, 0.04), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120 * K, drag: 3.6, grav: 380, rot: n === 'chip' ? rand(0, PI) : 0,
        len: L, wid: L * aspect(n), life: rand(0.32, 0.62), a: 1, col, white: 0.5, g: 0.9, tw: rand(30, 48), ph: rand(0, 6), fade: out(1.1) });
    }
    // a flicker of lightning round the hit
    for (let i = 0; i < 2; i++) {
      const r0 = fwd + rand(-1.3, 1.3) + (i ? PI * 0.55 : 0), L = rand(150, 220) * K;
      add({ n: 'bolt_a', x: x + Math.cos(r0) * L * 0.38, y: y + Math.sin(r0) * L * 0.38, rot: r0, rot0: r0, flick: true, t: -i * 0.025,
        len: L, wid: L * aspect('bolt_a'), life: 0.11, a: 0.9, col: red ? COL : '#7fe3ff', white: 0.4, g: 0.6, fade: out(0.8) });
    }
    // speed streaks along the blow
    for (let i = 0; i < 3; i++) {
      const L = rand(170, 260) * K, oy = rand(-34, 34) * K;
      add({ n: 'streak', x: x - Math.cos(fwd) * 40 * K, y: y + oy, vx: Math.cos(fwd) * rand(1300, 1900) * K, vy: 0, drag: 7, rot: fwd,
        len: L, wid: L * aspect('streak') * 1.2, life: rand(0.1, 0.16), a: 0.6, col: COL2, white: 0.3, g: 0.4, fade: out(1) });
    }
    if (h.fin || red) {   // a shock ring
      add({ n: 'ring', x, y, len: 230 * K, wid: 230 * K * aspect('ring'), life: 0.22, a: 0.7, col: COL, white: 0.2, g: 0.5, grow: (u) => 0.25 + 0.95 * (1 - Math.pow(1 - u, 2.4)), fade: out(1.5) });
    }
    if (red) {            // the crimson cut through the monster, steep like the clip's (a flatter, longer one ran over the hero and dyed him red)
      const r0 = h.dir > 0 ? 1.05 : -1.05, cx = x + h.dir * 14 * h.k;
      add({ n: 'slash_line', x: cx, y, rot: r0, len: 380 * h.k, wid: 470 * h.k * aspect('slash_line') * 1.4, life: 0.3, a: 1, col: '#ff2440', white: 0.35, g: 0.7,
        grow: (u) => (u < 0.14 ? 0.3 + 0.7 * (u / 0.14) : 1), fade: out(1.2) });
      add({ n: 'slash_line', x: cx, y, rot: r0, len: 420 * h.k, wid: 520 * h.k * aspect('slash_line') * 0.45, life: 0.18, a: 0.8, col: '#ffffff', white: 0.4, g: 0.3 });
    }
    const q = FX.add({ type: 'lslash', x, y, life: 1.2, parts, update });
    live.add(q);
  }
  IS.STYLES.light = { ready: () => NEED.every((n) => ok(IMG[n]) && ok(IMV[n])), play: (game, e, h) => burst(h) };

  // ---------------- bloom: the live pieces again, in colour and wider, quarter size, blurred, added over the frame ----------------
  let bc = null, b2 = null;
  const canvasOf = (c, W, H) => { if (!c) c = document.createElement('canvas'); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } return c; };
  IS.post.push(function bloom(ctx) {
    if (!live.size || !(LS.bloom > 0)) return;
    for (const q of live) if (q.dead || q.t >= q.life || !FX.list.includes(q)) live.delete(q);
    if (!live.size) return;
    const cv = ctx.canvas, S = 4, W = Math.ceil(cv.width / S), H = Math.ceil(cv.height / S);
    bc = canvasOf(bc, W, H); b2 = canvasOf(b2, W, H);
    const bx = bc.getContext('2d'), bx2 = b2.getContext('2d'), m = ctx.getTransform();
    bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'source-over'; bx.globalAlpha = 1; bx.clearRect(0, 0, W, H);
    bx.setTransform(m.a / S, m.b / S, m.c / S, m.d / S, m.e / S, m.f / S);
    bx.globalCompositeOperation = 'lighter';
    for (const q of live) for (const P of q.parts) if (P.t >= 0) drawPart(bx, P, true);
    const px = W / 480;   // (blur radii for a ~1900 px wide screen, scaled with it)
    bx2.setTransform(1, 0, 0, 1, 0, 0); bx2.globalAlpha = 1;
    bx2.globalCompositeOperation = 'copy'; bx2.filter = `blur(${(LS.blur[0] * px).toFixed(1)}px)`; bx2.drawImage(bc, 0, 0);
    bx2.globalCompositeOperation = 'lighter'; bx2.filter = `blur(${(LS.blur[1] * px).toFixed(1)}px)`; bx2.drawImage(bc, 0, 0);
    bx2.filter = 'none';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, LS.bloom);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b2, 0, 0, cv.width, cv.height);
    ctx.restore();
  });
})();
