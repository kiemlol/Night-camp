/* lightkit.js — the shared LIGHT KIT: skill effects made of light, the way an engine's particle system does it (2026-10-19,
   the user after the sword's light slash, js/lightslash.js: "สวยๆ เลย ปรับทุกสกิล ให้ใช้เเสง อารมนี้เเทนได้ไหม เริ่มจากพระก่อน
   ... ใช้เฟรมรูปผสมได้นะ" -> "เริ่มเลย ทำชุดแสงกลาง + พระคลาส 1 ทั้ง 6 อย่าง").
   PIECES: painted single light pieces (assets/lightkit/ + the sword's assets/lightslash/, Codex on black:
   assets/gen/make_lightkit_prompts.py -> tools/lightkit_cut.py), each as painted and as a white copy to tint any colour,
   plus painted frames where a shape matters (a sigil circle, light wings opening). Everything is drawn as LIGHT
   ('lighter'), then a BLOOM pass adds the pieces again in colour, wider, quarter size, blurred twice.
   RECIPES (LK.*): burst (spikes shooting out), pillar (a column of light from the sky), ring (a wave on the ground), sigil
   (the painted circle flat on the ground, turning), glow, flare, wings (the painted frames behind someone), halo, heal rise
   (feathers and petals lifting), plus single moving pieces (LK.part).
   RESKIN (LK.reskin(map, fn, tag)): a skill keeps ALL its own code and numbers; while it runs (and its timers / projectiles
   later), the code-drawn effects it asks vfx.js / fx.js for (FX items vbeam, vring, vcircle, vglow, vflare, vstar, vmote,
   vstreak, star, spark, ring, vwings, vplus ...) are turned into these light recipes instead. LK.holyMap(): the holy one.
   The code only places, moves, turns, stretches, tints and blurs the painted pieces (the user's rule: effect pieces are
   generated pictures). Load before the skin files that use it (js/priestlight.js) and before js/hitstyle.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX;
  if (!FX || !V) return;
  const MAN = NC.ASSET_MANIFEST_LIGHTKIT || {};
  // expo: the automatic exposure (1 = as painted): the more light items alive, the dimmer each one, so a big buff with the
  // whole party or an ultimate never burns the screen white (the eye adapting); EXPO = [items it starts at, how it falls]
  // _wk / _ak: the white-hot and strength factors of the item being drawn (a skin's map.__wk / __ak, taken by every light
  // item made inside its scope: the mage line's spells pile many pieces up and burnt white with the holy amounts)
  const LK = (NC.LightKit = { bloom: 0.5, blur: [4, 11], MAN, expo: 1, EXPO: [55, 0.65], _wk: 1, _ak: 1 });
  const rand = NC.rand, PI = Math.PI, TAU = PI * 2, SQ = V.SQ || 0.58;
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const load = (src) => { const im = new Image(); im.src = src; return im; };

  // ---------------- the pieces: each as painted (IMG) and its white copy (IMV); frame sets: arrays ----------------
  const IMG = {}, IMV = {};
  for (const n in MAN) {
    const A = MAN[n];
    if (A.frames) { IMG[n] = A.frames.map((f) => load(f.src)); IMV[n] = A.frames.map((f) => load(f.v)); } else { IMG[n] = load(A.src); IMV[n] = load(A.v); }
  }
  LK.ready = (...names) => names.every((n) => (Array.isArray(IMG[n]) ? IMG[n].every(ok) && IMV[n].every(ok) : ok(IMG[n]) && ok(IMV[n])));
  // a skin's own pieces from its own manifest (js/reaperlight.js: loaded the first time it is needed), listed in the kit
  LK.addPieces = function (man) {
    for (const n in man) {
      if (IMG[n]) continue;
      const A = (MAN[n] = man[n]);
      if (A.frames) { IMG[n] = A.frames.map((f) => load(f.src)); IMV[n] = A.frames.map((f) => load(f.v)); } else { IMG[n] = load(A.src); IMV[n] = load(A.v); }
    }
  };
  const aspect = (n) => (MAN[n] && MAN[n].w ? MAN[n].h / MAN[n].w : 1);
  LK.aspect = aspect;

  // colours: '255,214,110' or '#ffd66e' -> '#rrggbb', mixed toward white by `w` (0..1)
  const hexCache = new Map();
  LK.hex = function (c, w) {
    if (!c) return null;
    const key = c + '|' + (w || 0);
    let h = hexCache.get(key);
    if (!h) {
      let r, g, b;
      if (c[0] === '#') { r = parseInt(c.slice(1, 3), 16); g = parseInt(c.slice(3, 5), 16); b = parseInt(c.slice(5, 7), 16); } else [r, g, b] = c.split(',').map(Number);
      const m = (v) => Math.round(v + (255 - v) * (w || 0)).toString(16).padStart(2, '0');
      h = '#' + m(r) + m(g) + m(b);
      hexCache.set(key, h);
    }
    return h;
  };
  // '#rrggbb' -> 'r,g,b'
  const rgbOf = (hex) => (hex && hex[0] === '#' ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',') : hex || '255,214,110');
  // a ground piece ('low': drawn before the night's darkening, which tinted it blue) also lights the night up under it,
  // so it keeps its colour at night (FX.lights: the game's own skill lights)
  const nightLight = (x, y, r, hex, a, life, follow) => { if (V.light) V.light(x, y, r, rgbOf(hex), a, life, follow ? { follow } : undefined); };
  LK.nightLight = nightLight;
  const tints = new Map();
  function tinted(im, key, hex) {
    let c = tints.get(key + hex);
    if (!c) {
      c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      x.globalCompositeOperation = 'multiply'; x.fillStyle = hex; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
      tints.set(key + hex, c);
    }
    return c;
  }
  // one piece as light: centred at (x, y) (or at its frame's origin), turned by rot, w x h world units; as painted
  // (hex null) or its white copy in that colour (a), plus the white copy on top (a x white). ground: flat on the ground
  // (squashed by the camera, turned in the ground's plane). glow: the bloom pass (its colour only, wider).
  LK.piece = function (c, n, x, y, rot, w, h, a, hex, white, o) {
    o = o || {};
    let im = IMG[n], iv = IMV[n], fr = null;
    if (Array.isArray(im)) { const i = o.frame || 0; im = im[i]; iv = iv[i]; fr = MAN[n].frames[i]; }
    if (!ok(im) || !ok(iv) || !(a > 0.004) || w < 0.5) return;
    if (o.glow) { w *= o.gw || 1.2; h *= o.gh || 1.7; a *= o.g === undefined ? 0.85 : o.g; white = 0; if (!hex) hex = o.gcol || null; }
    c.save();
    c.translate(x, y);
    if (o.ground) c.scale(1, SQ);
    if (rot) c.rotate(rot);
    if (o.flip) c.scale(-1, 1);
    if (o.flipY) c.scale(1, -1);   // (mirrored across its own length: a slash curving the other way)
    const ox = fr ? (fr.ox / fr.w) * w : w / 2, oy = fr ? (fr.oy / fr.h) * h : h / 2;
    a *= LK.expo * LK._ak; white *= LK._wk;
    c.globalAlpha = Math.min(1, a);
    c.drawImage(hex ? tinted(iv, n + (fr ? o.frame : ''), hex) : im, -ox, -oy, w, h);
    if (white > 0) { c.globalAlpha = Math.min(1, a * white); c.drawImage(iv, -ox, -oy, w, h); }
    c.restore();
  };

  // ---------------- light items: FX type 'lk', drawn by their own draw(c, q, u, glow) as light; layer glow / low / sorted ----------------
  FX.def('lk', (ctx, q, u) => {
    if (q.t < 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    LK._wk = q.wk || 1; LK._ak = q.ak || 1;
    try { q.draw(ctx, q, Math.min(1, u), false); } finally { LK._wk = 1; LK._ak = 1; }
    ctx.restore();
  }, 'glow');
  const add = (o) => FX.add(Object.assign({ type: 'lk' }, o));
  LK.add = add;
  const out = (p) => (u) => Math.pow(Math.max(0, 1 - u), p);
  const inOut = (i, o) => (u) => (u < i ? u / i : u > 1 - o ? Math.max(0, (1 - u) / o) : 1);
  LK.out = out; LK.inOut = inOut;
  const at = (q) => (q.follow ? [q.follow.x + (q.fx || 0), q.follow.y + (q.fy || 0)] : [q.x, q.y]);

  // a single moving piece: n, x y, vx vy (drag, grav, spin: FX moves it), life, t (< 0: later), len, wid (or len x the
  // painting's proportion), rot, a, col, white, g (bloom), grow(u), fade(u), stretch (along its flight, longer while fast;
  // sp0), tw (twinkle), sway (drifting side to side), ground
  function drawPart(c, P, u, glow) {
    let a = P.a * (P.fade ? P.fade(u) : 1 - u);
    let len = P.len, wid = P.wid || P.len * aspect(P.n), rot = P.rot || 0, x = P.x, y = P.y;
    if (P.follow) { x += P.follow.x - P.fx0; y += P.follow.y - P.fy0; }
    if (P.grow) { const g = P.grow(u); len *= g; wid *= g; }
    if (P.stretch) {
      const sp = Math.hypot(P.vx, P.vy), s = Math.min(1.5, 0.4 + sp / (P.sp0 || 600));
      rot = Math.atan2(P.vy, P.vx); len *= s; wid *= Math.min(1, 0.55 + 0.45 * s);
    }
    if (P.tw) a *= 0.6 + 0.4 * Math.sin(P.t * P.tw + (P.ph || 0));
    if (P.sway) x += Math.sin(P.t * P.sway + (P.ph || 0)) * (P.swayA || 10);
    LK.piece(c, P.n, x, y, rot, len, wid, a, P.col, P.white, { glow, g: P.g, ground: P.ground, frame: P.frame, flipY: P.flipY });
  }
  LK.part = function (P) {
    P.a = P.a === undefined ? 1 : P.a;
    if (P.follow) { P.fx0 = P.follow.x; P.fy0 = P.follow.y; }
    return add(Object.assign(P, { draw: (c, q, u, glow) => drawPart(c, q, u, glow) }));
  };

  // ---------------- recipes ----------------
  const GOLD = '#ffd66e';
  // spikes of light shooting out from a point (the sword's burst, any colour): o.k size, o.col (null: painted), o.n,
  // o.dir (+1 / -1: most along the blow; 0: all round), o.flash (the soft flash + core), o.spark (sparkles), o.bolts
  LK.burst = function (x, y, o) {
    o = o || {};
    const K = o.k || 1, col = o.col === undefined ? GOLD : o.col, n = o.n || 12, fwd = o.dir ? (o.dir > 0 ? 0 : PI) : null;
    if (o.flash !== false) {
      LK.part({ n: 'soft', x, y, len: 170 * K, life: 0.16, a: 0.38, col, white: 0, g: 0.45, grow: (u) => 0.5 + 0.55 * Math.min(1, u / 0.25), fade: out(1.8), layer: o.layer });
      LK.part({ n: 'core', x, y, rot: rand(0, PI), len: 115 * K, life: 0.11, a: 0.95, col, white: 0.45, g: 0.7, grow: (u) => 0.55 + 0.55 * Math.min(1, u / 0.35), fade: out(1.3), layer: o.layer });
    }
    for (let i = 0; i < n; i++) {
      const a = fwd === null ? rand(0, TAU) : fwd + (Math.random() < 0.68 ? rand(-1.05, 1.05) : rand(-PI, PI));
      const sp = rand(1000, 1900) * K, pc = i < 3 ? 'spike_long' : i % 3 === 0 ? 'shard' : 'spike_mid';
      const L = (pc === 'spike_long' ? rand(140, 200) : pc === 'shard' ? rand(50, 75) : rand(90, 130)) * K;
      LK.part({ n: pc, x: x + Math.cos(a) * 8 * K, y: y + Math.sin(a) * 8 * K, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (o.sq || 1), drag: 11, sp0: 900 * K,
        stretch: true, len: L, wid: L * aspect(pc) * 1.15, life: rand(0.12, 0.22), a: 0.95, col, white: 0.45, g: 0.55, fade: out(1.3), layer: o.layer });
    }
    for (let i = 0; i < (o.spark === undefined ? 8 : o.spark); i++) {
      const a = (fwd === null ? rand(0, TAU) : fwd + rand(-2.2, 2.2)), sp = rand(240, 760) * K, pc = i < 3 ? 'glint' : 'drop';
      const L = (pc === 'glint' ? rand(30, 46) : rand(10, 16)) * K;
      LK.part({ n: pc, x, y, t: -rand(0, 0.04), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 110 * K, drag: 3.6, grav: 360,
        len: L, life: rand(0.32, 0.6), a: 1, col, white: 0.5, g: 0.8, tw: rand(30, 48), ph: rand(0, 6), fade: out(1.1), layer: o.layer });
    }
  };

  // a column of light from the sky onto (x, y): o.w (its width), o.h (its height), o.life, o.col, o.drop (falls in),
  // o.impact (spikes at its foot: a hit)
  LK.pillar = function (x, y, o) {
    o = o || {};
    const w = o.w || 70, h = o.h || 560, life = o.life || 0.5, col = o.col || GOLD, a0 = o.a === undefined ? 1 : o.a;
    const land = (t) => (o.drop === false ? 1 : Math.min(1, t / 0.08));
    // the column: a wide soft one in colour, a thin white-hot core inside; it lands from the top, swells, thins away
    const width = (u) => (u < 0.08 ? 0.55 + 0.45 * (u / 0.08) : 1 - 0.6 * Math.pow((u - 0.08) / 0.92, 1.4));
    add({ x, y, life, draw(c, q, u, glow) {
      const L = land(q.t), H = h * L, top = y - h, cy = top + H / 2, W = w * width(u), a = a0 * inOut(0.03, 0.5)(u);
      LK.piece(c, 'pillar', x, cy, 0, W * 2.3, H, a * 0.55, col, 0.15, { glow, g: 0.7, gw: 1.6, gh: 1.05 });
      LK.piece(c, 'pillar', x, cy, 0, W * 0.7, H, a * 0.75, o.core || '#ffffff', 0.35, { glow, g: 0.4, gw: 1.4, gh: 1.0 });   // (o.core: a tinted core, e.g. fire)   // (first stills: three columns side by side burnt white)
    } });
    nightLight(x, y - 20, w * 3.2, col, 0.7 * a0, life);
    // its foot: a glow on the ground, a flare, light drops falling down the column, sparks thrown up
    add({ x, y, life: life * 0.9, layer: 'low', draw(c, q, u, glow) {
      const a = a0 * inOut(0.05, 0.6)(u) * (land(q.t) >= 1 ? 1 : 0);
      LK.piece(c, 'ground_glow', x, y, 0, w * 4.2, w * 4.2 * aspect('ground_glow'), a * 0.6, col, 0.2, { glow, ground: true, g: 0.6 });
    } });
    LK.part({ n: 'core', x, y: y - 18, rot: rand(0, PI), len: w * 2.2, life: 0.16, t: -0.06, a: 0.9 * a0, col, white: 0.5, g: 0.7, grow: (u) => 0.6 + 0.6 * u, fade: out(1.4) });
    for (let i = 0; i < Math.round(w / 9); i++) {
      LK.part({ n: 'drop', x: x + rand(-w * 0.4, w * 0.4), y: y - h * rand(0.3, 0.95), t: -rand(0, life * 0.5), vx: 0, vy: rand(500, 900), drag: 0.5,
        len: rand(8, 14), wid: rand(30, 60), life: rand(0.2, 0.4), a: 0.8 * a0, col, white: 0.6, g: 0.6, fade: out(1) });
    }
    for (let i = 0; i < Math.round(w / 12); i++) {
      const s = rand(-1, 1);
      LK.part({ n: i % 2 ? 'glint' : 'drop', x: x + s * w * 0.4, y: y - 6, t: -rand(0.04, 0.12), vx: s * rand(80, 260), vy: -rand(200, 520), drag: 2.4, grav: 520,
        len: i % 2 ? rand(24, 36) : rand(9, 14), life: rand(0.35, 0.65), a: a0, col, white: 0.5, g: 0.8, tw: rand(30, 45), ph: rand(0, 6), fade: out(1.2) });
    }
    if (o.impact) LK.burst(x, y - 30, { k: o.impact, col, n: 10, spark: 6 });
  };

  // a wave of light along the ground: radius r0 -> r1 (eased out), flat in the camera's plane
  LK.ring = function (x, y, o) {
    o = o || {};
    const r0 = o.r0 || 10, r1 = o.r1 || 150, life = o.life || 0.45, col = o.col || GOLD, a0 = o.a === undefined ? 0.9 : o.a;
    if (o.ground !== false) nightLight(x, y, r1 * 1.25, col, 0.5 * a0, life, o.follow);
    add({ x, y, life, layer: o.layer || 'low', follow: o.follow, draw(c, q, u, glow) {
      const [px, py] = at(q), r = r0 + (r1 - r0) * (1 - Math.pow(1 - u, 2.4)), a = a0 * out(1.4)(u);
      LK.piece(c, 'ring', px, py, 0, r * 2.15, r * 2.15 * aspect('ring'), a, col, 0.35, { glow, ground: o.ground !== false, g: 0.6 });
    } });
  };

  // the painted sigil flat on the ground, turning (o.spin rad/s), growing in (o.grow), fading out; its outer band turning the
  // other way; a soft glow under it; motes rising from its rim while it lives
  LK.sigil = function (x, y, o) {
    o = o || {};
    const R = o.r || 140, life = o.life || 1, col = o.col || GOLD, a0 = o.a === undefined ? 1 : o.a, spin = o.spin === undefined ? 0.9 : o.spin, rot0 = rand(0, TAU);
    nightLight(x, y, R * 1.5, col, 0.65 * a0, life, o.follow);
    let motes = 0;
    add({ x, y, life, layer: 'low', follow: o.follow, update(q, dt) {
      const [px, py] = at(q);
      motes += dt * R * 0.06;
      while (motes >= 1) {
        motes--;
        const a = rand(0, TAU), r = R * rand(0.75, 1.02);
        LK.part({ n: Math.random() < 0.3 ? 'petal' : 'mote', x: px + Math.cos(a) * r, y: py + Math.sin(a) * r * SQ, vx: rand(-12, 12), vy: -rand(70, 160), drag: 0.6,
          len: rand(9, 15), life: rand(0.6, 1.1), a: 0.85 * a0, col, white: 0.5, g: 0.7, fade: inOut(0.2, 0.6), sway: rand(3, 6), swayA: rand(4, 9), ph: rand(0, 6) });
      }
    }, draw(c, q, u, glow) {
      const [px, py] = at(q), g = o.grow ? 0.6 + 0.4 * (1 - Math.pow(1 - Math.min(1, u / 0.25), 3)) : 1;
      const a = a0 * inOut(o.fin || 0.12, o.fout || 0.3)(u), t = q.t;
      LK.piece(c, 'ground_glow', px, py, 0, R * 2.6 * g, R * 2.6 * g * aspect('ground_glow'), a * 0.25, col, 0, { glow, ground: true, g: 0.3 });
      LK.piece(c, 'sigil', px, py, rot0 + t * spin, R * 2 * g, R * 2 * g, a * 0.9, o.paint ? null : col, 0.2, { glow, ground: true, g: 0.45 });
      LK.piece(c, 'sigil_band', px, py, -rot0 - t * spin * 0.6, R * 2.18 * g, R * 2.18 * g, a * 0.75, o.paint ? null : col, 0.25, { glow, ground: true, g: 0.4 });
    } });
  };

  // a glow of light growing r0 -> r1 (an orb and its soft halo)
  LK.glow = function (x, y, o) {
    o = o || {};
    const r0 = o.r0 || 20, r1 = o.r1 || 120, life = o.life || 0.35, col = o.col || GOLD, a0 = (o.a === undefined ? 0.8 : o.a);
    add({ x, y, life, follow: o.follow, fx: o.follow ? x - o.follow.x : 0, fy: o.follow ? y - o.follow.y : 0, draw(c, q, u, glow) {
      const [px, py] = at(q), r = r0 + (r1 - r0) * (1 - Math.pow(1 - u, 2)), a = a0 * inOut(0.08, 0.7)(u);
      LK.piece(c, 'soft', px, py, 0, r * 2.4, r * 2.4 * aspect('soft'), a * 0.35, col, 0, { glow, g: 0.4 });
      LK.piece(c, 'orb', px, py, 0, r * 1.1, r * 1.1 * aspect('orb'), a, col, o.hot ? 0.35 : 0.15, { glow, g: 0.5 });
    } });
  };

  // a sharp flare: a gold glint opening and closing, a core, a few small spikes
  LK.flare = function (x, y, o) {
    o = o || {};
    const r = o.r || 60, col = o.col || GOLD, life = o.life || 0.3;
    LK.part({ n: 'glint', x, y, rot: rand(-0.3, 0.3), len: r * 2.4, life, a: 1, col, white: 0.6, g: 0.8, grow: (u) => (u < 0.3 ? 0.4 + 2 * u : 1 - 0.7 * (u - 0.3)), fade: out(1.2) });
    LK.part({ n: 'core', x, y, rot: rand(0, PI), len: r * 1.5, life: life * 0.6, a: 0.8, col, white: 0.4, g: 0.6, fade: out(1.4) });
    if (o.spikes !== false) LK.burst(x, y, { k: r / 110, col, n: 6, spark: 3, flash: false });
  };

  // light wings opening behind someone: the painted frames, anchored at their roots between the shoulders; then loose
  // feathers drifting down
  LK.wings = function (who, o) {
    o = o || {};
    const life = o.life || 1.2, k = o.k || 1, col = o.col || null, A = MAN.wings;
    if (!A) return;
    const n = A.frames.length, W = 320 * k;
    add({ x: who.x, y: who.y, life, layer: 'sorted', sort: who.y - 2, follow: who, update(q) { q.sort = who.y - 2; }, draw(c, q, u, glow) {
      const i = Math.min(n - 1, Math.floor(Math.pow(u, 0.85) * n)), f = A.frames[i], a = inOut(0.04, 0.25)(u);
      LK.piece(c, 'wings', who.x, who.y - 92 * k, 0, W, W * (f.h / f.w), a * 0.8, col, 0.12, { glow, frame: i, g: 0.45 });
    } });
    for (let i = 0; i < 7; i++) {
      const s = i % 2 ? 1 : -1;
      LK.part({ n: i % 3 ? 'feather_s' : 'feather', x: who.x + s * rand(40, 140) * k, y: who.y - rand(80, 160) * k, t: -rand(0.35, 0.7) * life,
        vx: s * rand(10, 50), vy: rand(30, 80), drag: 0.8, rot: rand(-0.6, 0.6), spin: rand(-1.5, 1.5), len: rand(26, 40) * k,
        life: rand(0.9, 1.4), a: 0.9, col, white: 0.4, g: 0.6, fade: inOut(0.15, 0.5), sway: rand(2, 4), swayA: rand(8, 16), ph: rand(0, 6) });
    }
  };

  // a halo over someone's head (the ring, flat)
  LK.halo = function (who, o) {
    o = o || {};
    const life = o.life || 1.2, col = o.col || GOLD, k = o.k || 1;
    add({ x: who.x, y: who.y, life, follow: who, draw(c, q, u, glow) {
      const a = inOut(0.12, 0.4)(u), g = 0.7 + 0.3 * Math.min(1, u / 0.15), r = 34 * k * g;
      LK.piece(c, 'halo', who.x, who.y - 165 * k, 0, r * 2, r * 2 * 0.32, a, col, 0.4, { glow, g: 0.7 });
    } });
  };

  // healing light rising from someone: feathers and petals lifting and swaying, a few glints
  LK.healRise = function (x, y, o) {
    o = o || {};
    const col = o.col || '#c8ffd2';
    for (let i = 0; i < (o.n || 9); i++) {
      const pc = i % 3 === 0 ? 'feather_s' : i % 3 === 1 ? 'petal' : 'glint';
      LK.part({ n: pc, x: x + rand(-38, 38), y: y - rand(10, 70), t: -rand(0, 0.3), vx: rand(-15, 15), vy: -rand(90, 190), drag: 0.9,
        rot: pc === 'feather_s' ? rand(-0.8, 0.8) : 0, spin: pc === 'feather_s' ? rand(-1, 1) : 0, len: pc === 'glint' ? rand(26, 40) : rand(18, 30),
        life: rand(0.7, 1.15), a: 0.8, col, white: 0.25, g: 0.6, fade: inOut(0.15, 0.55), sway: rand(3, 6), swayA: rand(5, 12), ph: rand(0, 6), tw: pc === 'glint' ? 30 : 0 });
    }
  };

  // ---------------- more recipes: what the rest of a line's code-drawn looks become ----------------
  // the frame of an animation at time t: o.loop [a, b] cycles frames a..b-1 after the intro (fps)
  LK.frameAt = function (n, t, fps, o) {
    const A = MAN[n];
    if (!A || !A.frames) return 0;
    const N = A.frames.length, f = Math.floor(t * (fps || 10));
    if (o && o.loop) { const [a, b] = o.loop; return f < a ? f : a + ((f - a) % (b - a)); }
    return f % N;
  };
  // a cut of light along an arc (a swing): the painted swing arc turned to `ang`, opening and fading, a few spikes thrown
  LK.arc = function (x, y, o) {
    o = o || {};
    const r = o.r || 100, col = o.col || GOLD, life = o.life || 0.28, rot = o.ang || 0;
    LK.part({ n: 'arc', x, y, rot, len: r * 2.3, life, a: 1, col, white: 0.5, g: 0.7, grow: (u) => 0.8 + 0.3 * Math.min(1, u / 0.3), fade: out(1.4) });
    for (let i = 0; i < 4; i++) {
      const a = rot + rand(-0.9, 0.9), sp = rand(500, 900);
      LK.part({ n: 'spike_mid', x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 9, stretch: true, sp0: 500,
        len: rand(50, 80), life: rand(0.12, 0.2), a: 0.9, col, white: 0.4, g: 0.5, fade: out(1.3) });
    }
  };
  // a line of light from (x0, y0) to (x1, y1) (a dash's trail, a tether): the slash line stretched between them, glints at the ends
  LK.line = function (x0, y0, x1, y1, o) {
    o = o || {};
    const col = o.col || GOLD, life = o.life || 0.3, w = o.w || 12, L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 4) return;
    add({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, life, draw(c, q, u, glow) {
      const a = out(1.3)(u), th = w * (1 - 0.6 * u);
      LK.piece(c, 'slash_line', q.x, q.y, Math.atan2(y1 - y0, x1 - x0), L * 1.08, Math.max(6, th * 3.2), a, col, 0.45, { glow, g: 0.6 });
    } });
    for (const [x, y] of [[x0, y0], [x1, y1]]) LK.part({ n: 'glint', x, y, len: w * 3.2, life: life * 0.8, a: 0.9, col, white: 0.5, g: 0.6, fade: out(1.2) });
  };
  // lightning of light from (x0, y0) to (x1, y1): a painted bolt stretched between them, another one 30 times a second
  const BOLTS = ['bolt_a', 'bolt_b', 'bolt_c'];
  LK.bolt = function (x0, y0, x1, y1, o) {
    o = o || {};
    const col = o.col || '#bfe8ff', life = o.life || 0.22, L = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0), w = o.w || 6;
    let n = BOLTS[(Math.random() * 3) | 0], flip = 1, ft = 0;
    add({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, life, update(q, dt) { if ((ft -= dt) <= 0) { ft = 1 / 30; n = BOLTS[(Math.random() * 3) | 0]; flip = Math.random() < 0.5 ? -1 : 1; } },
      draw(c, q, u, glow) {
        const a = (u < 0.1 ? 1 : 1 - (u - 0.1) / 0.9) * (0.8 + 0.2 * Math.sin(q.t * 90));
        LK.piece(c, n, q.x, q.y, ang, L * 1.05, Math.max(24, w * 9) * flip, a, col, 0.55, { glow, g: 0.7 });
      } });
    LK.part({ n: 'orb', x: x1, y: y1, len: w * 9, life: life * 0.9, a: 0.8, col, white: 0.4, g: 0.6, fade: out(1.3) });
  };
  // cracks of light on the ground (a decal): the painted cracks flat on the ground, glowing then cooling
  LK.crack = function (x, y, o) {
    o = o || {};
    const r = o.r || 90, col = o.col || GOLD, life = o.life || 2, rot = rand(0, TAU), has = !!MAN.crack;
    nightLight(x, y, r * 2, col, 0.7, life);
    add({ x, y, life, layer: 'low', draw(c, q, u, glow) {
      const a = (u < 0.06 ? u / 0.06 : 1) * Math.pow(1 - u, 1.6);
      LK.piece(c, has ? 'crack' : 'ground_glow', x, y, rot, r * 2.2, r * 2.2 * (has ? 1 : aspect('ground_glow')), a, col, 0.12, { glow, ground: true, g: 0.5 });
      LK.piece(c, 'ground_glow', x, y, 0, r * 2.4, r * 2.4 * aspect('ground_glow'), a * 0.35, col, 0, { glow, ground: true, g: 0.3 });
    } });
  };
  // a soft puff of light dust drifting up (in place of a toon smoke puff)
  LK.dust = function (p, col) {
    asPart(p, MAN.dust ? 'dust' : 'soft', ((p.r1 || 36) + (p.r0 || 16)) * 1.6, col || '#f3e6c8', { a: 0.32 * (p.a || 1), white: 0, g: 0.4, fade: inOut(0.15, 0.7) });
    p.grow = (u) => 0.6 + 0.6 * u;
  };
  // the sigil drawn right now into a canvas (inside another drawer, e.g. a cast circle): flat on the ground, turned by rot;
  // style 'star' -> its outer band only
  LK.sigilNow = function (c, x, y, r, rot, hex, a, style, glow) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    if (style !== 'star') LK.piece(c, 'sigil', x, y, rot, r * 2, r * 2, a, hex, 0.2, { glow, ground: true, g: 0.45 });
    LK.piece(c, 'sigil_band', x, y, -rot * 0.7, r * (style === 'star' ? 2 : 2.18), r * (style === 'star' ? 2 : 2.18), a * 0.75, hex, 0.2, { glow, ground: true, g: 0.4 });
    c.restore();
  };

  // ---------------- bloom: every live light item again, in colour and wider, quarter size, blurred, added over the frame ----------------
  let bc = null, b2 = null;
  const canvasOf = (c, W, H) => { if (!c) c = document.createElement('canvas'); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } return c; };
  // (q.noBloom: a light item that stays up long, e.g. the reaper's flying sickles, keeps out of it: while one was up the
  // two blurs and the upload of this canvas ran every frame, and a twin-sickle reaper's FPS fell by half, 2026-10-21.
  // A hidden piece, another player's past the share (js/otherfx.js: layer 'none'), stays out too: it drew nothing on the
  // screen but still started the pass, 2026-10-24.)
  const blooms = (q) => q.type === 'lk' && q.t >= 0 && q.layer !== 'low' && q.layer !== 'none' && !q.noBloom;
  // the bloom by คุณภาพภาพ (2026-10-24: FPS): สูง as it was (a quarter of the screen, two blurs), กลาง an eighth of the
  // screen and the wide blur alone, ต่ำ / ต่ำสุด none
  const quality = () => (NC.Gfx && NC.Gfx.level ? NC.Gfx.level() : 0);
  function bloom(ctx) {
    const lv = quality();
    if (!(LK.bloom > 0) || lv >= 2) return;
    let any = false;
    for (const q of FX.list) if (blooms(q)) { any = true; break; }
    if (!any) return;
    const cv = ctx.canvas, S = lv ? 8 : 4, W = Math.ceil(cv.width / S), H = Math.ceil(cv.height / S);
    bc = canvasOf(bc, W, H); b2 = canvasOf(b2, W, H);
    const bx = bc.getContext('2d'), bx2 = b2.getContext('2d'), m = ctx.getTransform();
    bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'source-over'; bx.globalAlpha = 1; bx.clearRect(0, 0, W, H);
    bx.setTransform(m.a / S, m.b / S, m.c / S, m.d / S, m.e / S, m.f / S);
    bx.globalCompositeOperation = 'lighter';
    // (ground lights stay out: their bloom, added over everything, washed the characters standing on them white)
    for (const q of FX.list) if (blooms(q)) { LK._wk = q.wk || 1; LK._ak = q.ak || 1; q.draw(bx, q, Math.min(1, q.t / q.life), true); }
    LK._wk = 1; LK._ak = 1;
    const px = (W * S) / (480 * 4); // (blur sizes are for the quarter canvas of a 1920 px screen)
    bx2.setTransform(1, 0, 0, 1, 0, 0); bx2.globalAlpha = 1;
    if (!lv) { bx2.globalCompositeOperation = 'copy'; bx2.filter = `blur(${(LK.blur[0] * px).toFixed(1)}px)`; bx2.drawImage(bc, 0, 0); }
    bx2.globalCompositeOperation = lv ? 'copy' : 'lighter'; bx2.filter = `blur(${((LK.blur[1] * px * 4) / S).toFixed(1)}px)`; bx2.drawImage(bc, 0, 0);
    bx2.filter = 'none';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, LK.bloom);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b2, 0, 0, cv.width, cv.height);
    ctx.restore();
  }
  const baseDraw = FX.draw;
  FX.draw = function (ctx, layer) {
    if (layer === 'low') {   // (the first layer of a frame: the exposure for this frame, eased)
      let n = 0;
      for (const q of FX.list) if (q.type === 'lk' && q.t >= 0 && q.layer !== 'none') n++; // (hidden pieces dim nothing)
      const want = n <= LK.EXPO[0] ? 1 : Math.max(0.42, Math.pow(LK.EXPO[0] / n, LK.EXPO[1]));
      LK.expo += (want - LK.expo) * (want < LK.expo ? 0.5 : 0.12);
    }
    baseDraw.apply(this, arguments);
    if (layer === 'glow') bloom(ctx);
  };

  // ---------------- RESKIN: a skill's own code-drawn effects turned into light while it runs ----------------
  let scope = null;
  LK.scope = () => scope;
  // a skin may switch other look files off while its skills run (map.__offs: objects with an `on`, e.g. NC.EmberFX): their
  // skills then take their code-drawn path, which the skin turns into light; put back right after
  function enter(S) {
    const prev = scope; scope = S;
    const offs = S.map && S.map.__offs, was = offs ? offs.map((o) => o && o.on) : null;
    if (offs) for (const o of offs) if (o) o.on = false;
    return () => { scope = prev; if (offs) offs.forEach((o, i) => { if (o) o.on = was[i]; }); };
  }
  const inScope = (S, fn) => function () { const done = enter(S); try { return fn.apply(this, arguments); } finally { done(); } };
  // (the scope keeps the caster: a RUN's second argument, or the one given to within)
  // (a channel or a dash some skills set straight on the hero, `p.channel = {...}` (the berserker's whirlwind, the rogue's
  // shadow storm): its callbacks run later from the hero's own update and drew code slashes; they keep the skin too, 2026-10-20)
  const keep = (o, keys, S) => { for (const k of keys) if (typeof o[k] === 'function' && !o[k].lkIn) { o[k] = inScope(S, o[k]); o[k].lkIn = 1; } };
  LK.reskin = function (map, fn, tag) {
    return function () {
      const p = arguments[1], S = { map, tag, p }, ch0 = p && p.channel, da0 = p && p.dash;
      const done = enter(S);
      try { return fn.apply(this, arguments); } finally {
        done();
        if (p && p.channel && p.channel !== ch0) keep(p.channel, ['update', 'end'], S);
        if (p && p.dash && p.dash !== da0) keep(p.dash, ['tick', 'end', 'hitFn'], S);
      }
    };
  };
  LK.within = function (map, tag, fn, p) { const done = enter({ map, tag, p }); try { return fn(); } finally { done(); } };
  const baseAdd = FX.add;
  FX.add = function (p) {
    const S = scope;
    if (S && p && S.map && (S.map.__wk || S.map.__ak) && p.wk === undefined) { p.wk = S.map.__wk || 1; p.ak = S.map.__ak || 1; }
    if (S && p && p.type !== 'lk') {
      const f = S.map[p.type];
      if (f && f(p, S) === null) return p;   // (turned into light: the code-drawn one is not added)
      // what it runs later (a timer's end, a projectile's flight) runs in the same skin
      if (p.onEnd && !p.lkIn) { p.onEnd = inScope(S, p.onEnd); p.lkIn = 1; }
      if (p.update && !p.lkUp) { p.update = inScope(S, p.update); p.lkUp = 1; }
    }
    return baseAdd.apply(this, arguments);
  };

  // a dash's / a channel's callbacks run later from the hero's own update (js/entities.js), outside any FX item: they keep
  // the skin they were started in (the asura punch's landing drew code cracks without this)
  const SKK = NC.SkillKit;
  if (SKK && SKK.dash) {
    const d0 = SKK.dash;
    SKK.dash = function (game, p) {
      const S = scope, r = d0.apply(this, arguments);
      if (S && p && p.dash) for (const k of ['tick', 'end', 'hitFn']) if (typeof p.dash[k] === 'function') p.dash[k] = inScope(S, p.dash[k]);
      return r;
    };
  }
  if (SKK && SKK.channel) {
    const c0 = SKK.channel;
    SKK.channel = function (game, p) {
      const S = scope, r = c0.apply(this, arguments);
      if (S && p && p.channel) for (const k of ['update', 'end']) if (typeof p.channel[k] === 'function') p.channel[k] = inScope(S, p.channel[k]);
      return r;
    };
  }

  // a moving code-drawn particle (vstar, vmote, vstreak, star, spark) becomes a light piece with the same flight
  function asPart(p, n, len, col, o) {
    o = o || {};
    p.type = 'lk';
    p.n = n; p.len = len; p.col = col; p.a = o.a === undefined ? 1 : o.a; p.white = o.white === undefined ? 0.5 : o.white; p.g = o.g === undefined ? 0.75 : o.g;
    if (o.stretch) { p.stretch = true; p.sp0 = o.sp0 || 500; }
    if (o.tw) { p.tw = o.tw; p.ph = rand(0, 6); }
    if (p.spin) p.spin *= 0.3;
    p.fade = o.fade || inOut(0.1, 0.55);
    p.draw = (c, q, u, glow) => drawPart(c, q, u, glow);
    if (p.layer === 'low' || p.layer === 'high') p.layer = 'glow';
  }
  LK.asPart = asPart;

  // the HOLY skin (the priest line): every code-drawn effect -> its light recipe, in the effect's own colour whitened a
  // little (gold for holy, mint for a heal, sky for the blessing). extra(kind, p, S) lets a skin add its own (an impact at
  // a beam's foot ...).
  const riseAt = new Map();
  LK.holyMap = function (extra) {
    const col = (rgb, w) => LK.hex(rgb || '255,214,110', w === undefined ? 0.2 : w);
    const X = (kind, p, S) => (extra ? extra(kind, p, S) : undefined);
    return {
      vbeam: (p, S) => { if (X('beam', p, S) === null) return null; LK.pillar(p.x, p.y, { w: p.w, h: p.h, life: p.life, col: col(p.rgb), drop: p.drop, a: p.a }); return null; },
      vring: (p, S) => { if (X('ring', p, S) === null) return null; LK.ring(p.x, p.y, { r0: p.r0, r1: p.r1, life: p.life, col: col(p.rgb), follow: p.follow, ground: p.sq !== 1, layer: p.sq === 1 ? 'glow' : 'low' }); return null; },
      vcircle: (p, S) => { if (X('circle', p, S) === null) return null; LK.sigil(p.x, p.y, { r: p.r, life: p.life, spin: (p.spin || 0.8) * 0.6, follow: p.follow, grow: p.grow, col: col(p.rgb, 0.1), a: p.a, fin: p.fin, fout: p.fout }); return null; },
      vglow: (p, S) => { if (X('glow', p, S) === null) return null; LK.glow(p.x, p.y, { r0: p.r0, r1: p.r1, life: p.life, col: col(p.rgb), a: Math.min(1, (p.a || 0.6) * 0.5), hot: p.hot, follow: p.follow }); return null; },
      vflare: (p, S) => { if (X('flare', p, S) === null) return null; LK.flare(p.x, p.y, { r: p.r, life: p.life, col: col(p.rgb) }); return null; },
      vstar: (p) => asPart(p, 'glint', (p.s || 12) * 2.6, col(p.rgb, 0.35), { tw: 34 }),
      star: (p) => asPart(p, 'glint', (p.size || 14) * 2.2, col(p.color, 0.35), { tw: 34 }),
      vmote: (p) => asPart(p, Math.random() < 0.25 ? 'petal' : 'mote', (p.r || 4) * 4, col(p.rgb, 0.3), { a: p.a || 1, g: 0.8 }),
      vstreak: (p) => asPart(p, 'spike_mid', (p.len || 26) * 2.4, col(p.rgb), { stretch: true, sp0: 400, white: 0.45, fade: LK.out(1.3) }),
      spark: (p) => asPart(p, 'spike_mid', 44, col(p.color), { stretch: true, sp0: 380, white: 0.45, fade: LK.out(1.3) }),
      ring: (p, S) => { if (X('fxring', p, S) === null) return null; LK.ring(p.x, p.y, { r0: p.r0, r1: p.r1, life: p.life, col: col(p.color), ground: false, layer: 'glow' }); return null; },
      // (the first pair of wings in a cast opens in full; the friends' get a halo and a few feathers: three pairs side by
      // side burnt into one white shape)
      vwings: (p, S) => {
        if (X('wings', p, S) === null) return null;
        if (!p.follow) return null;
        if (!S.wings) LK.wings(p.follow, { life: Math.max(1.1, p.life || 1.2) }); else LK.healRise(p.follow.x, p.follow.y - 40, { n: 5, col: '#ffe9b0' });
        S.wings = (S.wings || 0) + 1;
        LK.halo(p.follow, { life: (p.life || 1.2) * 1.1 });
        return null;
      },
      // (a heal's plus: a full rise of feathers at most every 0.7 s on one spot; heals ticking every half second on the
      // whole party made a white cloud over everyone)
      vplus: (p, S) => {
        if (X('plus', p, S) === null) return null;
        const G = NC.game, key = Math.round(p.x / 40) + ',' + Math.round(p.y / 40), now = G ? G.time : 0, last = riseAt.get(key);
        const full = !(last !== undefined && now - last < 0.7);
        if (full) riseAt.set(key, now);
        if (riseAt.size > 200) riseAt.clear();
        LK.healRise(p.x, p.y, { n: full ? 8 : 2 });
        return null;
      },
      vslash: (p, S) => { if (X('slash', p, S) === null) return null; LK.arc(p.x, p.y, { r: p.r, ang: p.ang + (p.sweep || 2) * 0.5, life: p.life, col: col(p.rgb || '255,214,110') }); return null; },
      cutline: (p, S) => { if (X('line', p, S) === null) return null; LK.line(p.x, p.y, p.x1, p.y1, { w: p.w, life: p.life, col: col(p.color) }); return null; },
      vbolt: (p, S) => { if (X('bolt', p, S) === null) return null; LK.bolt(p.x0, p.y0, p.x, p.y, { life: p.life, w: p.w, col: col(p.rgb, 0.35) }); return null; },
      vdecal: (p, S) => { if (X('decal', p, S) === null) return null; LK.crack(p.x, p.y, { r: p.r, life: Math.min(1.6, p.life || 2), col: col(p.rgb || (p.kind === 'scorch' ? '255,140,60' : '255,214,110'), 0) }); return null; },
      vsmoke: (p) => LK.dust(p),
      // a flame (V.flameAt): fire-coloured ones keep the painted flame loop of js/emberfx.js; the others (gold, holy) are
      // drawn by code -> a flickering teardrop of light rising
      vflame: (p) => {
        const KK = NC.SkillKit, fire = KK && KK.P && p.pal === KK.P.fire;
        if (fire && NC.EmberFX && NC.EmberFX.on) return;
        asPart(p, 'mote', (p.w || 30) * 1.25, col(fire ? '255,150,70' : '255,200,110', 0.1), { white: 0.45, g: 0.7, fade: inOut(0.12, 0.6) });
        p.tw = 40; p.ph = rand(0, 6);
        if (p.vy === undefined || p.vy === 0) p.vy = -60;
      },
      vshard: (p) => asPart(p, 'chip', (p.s || 14) * 1.4, col('255,200,120', 0.1), { white: 0.4 }),
    };
  };

  // =====================================================================================================
  // LK.lineSkin: a whole JOB LINE made of light (js/priestlight.js, js/knightlight.js ...). o:
  //   name     the switch object NC[name] (its .on); param: the URL switch (?param=1 / 0 forces it for a page)
  //   jobs     the line's job ids (1st, 2nd, class 3); root: the 1st job (NC.isJob covers the rest)
  //   ready    the pieces it needs before it turns on
  //   map      the skin (LK.holyMap(extra) or a copy with the line's own entries)
  //   swaps    { fxType(p, L) -> false (not swapped) }: lasting looks drawn by their own drawers, swapped when added (L.swap)
  //   add      (p, L) -> true when it handled a new FX item itself (a line's own bolt ...)
  //   tone     (p) -> '#hex': the light of a plain melee hit; plain: false -> no plain-hit burst
  // Every skill of the jobs (RUN, its buff aura), a cast (castSkill), the hooks lists (skillTicks, basicHits, heroGuards,
  // skillCasts), the hero's hits (heroHit: class-3 power-ups, procs) and the class-3 effects / hooks of these jobs run in
  // the skin. A plain hit with a melee weapon: hitfeel's spark / embers -> a burst of light spikes in the job's colour.
  // =====================================================================================================
  LK.lineSkin = function (o) {
    const RUN = NC.SKILL_RUN, SK = NC.SKILLS, C3 = NC.C3;
    let on = false;
    const L = (NC[o.name] = { get on() { return on; }, set on(v) { on = !!v; } });
    const isJob = (p, j) => !!p && (p.job === j || (NC.isJob ? NC.isJob(p, j) : false));
    const me = () => NC.game && NC.game.player;
    const need = o.ready || ['ring', 'glint', 'orb', 'soft', 'core', 'drop'];
    L.isJob = isJob; L.me = me;
    const ex = o.exclude || [];   // (jobs of the root's line left out, and every job after them: the mage line's ice mage)
    // (o.skip(p): a hero left out for now, e.g. one wearing a set with its own look: the archer's VOID COMET)
    L.fam = (p) => !!p && !ex.some((j) => isJob(p, j)) && !(o.skip && o.skip(p)) && (o.jobs.includes(p.job) || isJob(p, o.root));
    L.live = () => L.on && LK.ready.apply(null, need);
    L.MAP = o.map;
    const fam = L.fam, live = L.live, MAP = o.map;
    if (o.offs) MAP.__offs = o.offs;
    const within = (tag, fn, p) => LK.within(MAP, tag, fn, p);
    // the skills of the line
    const ids = new Set();
    let lastCast = -99;
    for (const j of o.jobs) for (const id of ((NC.JOBS[j] && NC.JOBS[j].skills) || [])) ids.add(id);
    if (C3) for (const j of o.jobs) { const J = C3.jobs[j]; if (J) { ids.add(J.sig.id); ids.add(J.awaken.id); for (const E of J.enh || []) ids.add(E.id); } }
    L.ids = ids;
    for (const id of ids) {
      const base = RUN[id];
      if (base && !base.lkSkin) {
        const lit = LK.reskin(MAP, base, id);
        RUN[id] = function () { const on = live() && fam(arguments[1]); if (on && arguments[1] === me() && NC.game) lastCast = NC.game.time; return (on ? lit : base).apply(this, arguments); };
        RUN[id]._orig = base; // Rune compatibility/classification follows the underlying skill.
        RUN[id].lkSkin = true;
      }
      const S = SK[id];
      if (S && S.aura && !S.aura.lkSkin) {
        const a0 = S.aura;
        S.aura = function (game, p) { const self = this, args = arguments; return live() && fam(p) ? within(id, () => a0.apply(self, args), p) : a0.apply(this, arguments); };
        S.aura.lkSkin = true;
      }
    }
    const baseCast = NC.castSkill;
    NC.castSkill = function (game, p) { const self = this, args = arguments; return live() && fam(p) ? within('cast', () => baseCast.apply(self, args), p) : baseCast.apply(this, arguments); };
    for (const list of [NC.skillTicks, NC.basicHits, NC.heroGuards, NC.skillCasts]) {
      if (!Array.isArray(list)) continue;
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        const w = function () { const P = me(), self = this, args = arguments; return live() && fam(P) ? within('tick', () => f.apply(self, args), P) : f.apply(this, arguments); };
        // the hook underneath, as RUN[id]._orig; and its source for the audits that find a hook by it (scripts/audit-*.mjs:
        // audit-weapon-rules looks for wskill.js's `b.cd / 100`), which saw only this wrapper from 0.5.8 on
        w._orig = f;
        w.toString = () => String(f);
        list[i] = w;
      }
    }
    const baseHeroHit = NC.heroHit;
    NC.heroHit = function (d, e, oo) {
      const P = me();
      if (!(live() && fam(P) && P && d === P.d)) return baseHeroHit.apply(this, arguments);
      const self = this, args = arguments;
      const r = within((oo && oo.sid) || 'hit', () => baseHeroHit.apply(self, args), P);
      if (r && !(oo && oo.skill) && P.atk && P.atk.on) r.lkPlain = true;
      return r;
    };
    if (C3) {
      for (const k in C3.fx) {
        const f = C3.fx[k];
        C3.fx[k] = function (game, p, sid) { const self = this, args = arguments; return live() && fam(p) ? within(sid, () => f.apply(self, args), p) : f.apply(this, arguments); };
      }
      for (const j of o.jobs) {
        const J = C3.jobs[j];
        if (!J) continue;
        for (const part of [J.sig, J.awaken]) {
          const H = part && part.hooks;
          if (!H) continue;
          for (const h in H) { const f = H[h]; H[h] = function (game, p) { const self = this, args = arguments; return live() ? within(part.id, () => f.apply(self, args), p) : f.apply(this, arguments); }; }
        }
      }
    }
    // a swapped look: drawn as light while the line's switch is on, its old self when it is off
    function orig(c, q2) {
      if (!q2.origType) return;
      c.save(); c.globalCompositeOperation = 'source-over';
      const t = q2.type; q2.type = q2.origType; FX.drawOne(c, q2); q2.type = t;
      c.restore();
    }
    L.swap = function (p, draw, update) {
      p.origType = p.type; p.type = 'lk';
      p.draw = (c, q2, u, glow) => { if (!live()) { if (!glow) orig(c, q2); return; } draw(c, q2, u, glow); };
      if (update) { const u0 = p.update; p.update = function (q2, dt, g) { if (u0) u0.apply(this, arguments); if (live()) update(q2, dt, g); }; }
    };
    const SWAP = o.swaps || {};
    let dealing = false;
    const baseAdd = FX.add;
    const AURA = new Set(['vmote', 'spark', 'vstreak', 'star', 'vstar']);
    // (this hero busy fighting: a skill cast in the last 2 s, a channel, a dash or a swing; the slash within reach of him)
    const near = (q, P) => !!P && (P.channel || P.dash || (P.atk && P.atk.on) || (NC.game && NC.game.time - lastCast < 2)) && Math.hypot((q.x || 0) - P.x, (q.y || 0) - P.y) < 650;
    FX.add = function (p) {
      if (p && live()) {
        const P = me();
        if (dealing && (p.type === 'hfspark' || p.type === 'hfember')) return p;   // (a plain hit of the line: its own burst)
        if (fam(P)) {
          if (SWAP[p.type] && !p.origType) { if (SWAP[p.type](p, L) !== false) return baseAdd.call(this, p); }
          if (p.type === 'hero' && P.dash && p.color === '#9dff8f' && o.ghost) p.color = o.ghost;   // (a dash's afterimages)
          if (o.add && o.add(p, L, (x) => baseAdd.call(this, x)) === true) return p;
          // (a code-drawn slash / cut line of this hero outside any skill's scope: a channel or timer that slipped out, a weapon's
          // element swing (js/wfx.js) - drawn by the line's skin too; the user, 2026-10-20: "ที่วาดด้วยโค้ดอ่ะ เปลี่ยนทั้งหมดเลย")
          if ((p.type === 'vslash' || p.type === 'cutline') && !LK.scope() && near(p, P)) { const self = this; return within('stray', () => baseAdd.call(self, p), P); }
          // (the small code-drawn bits rising round this hero outside a skill: a buff's wisps (the shadow step's), a weapon's
          // motes, a lasting effect's sparks - the line's light too)
          if (AURA.has(p.type) && !LK.scope() && Math.hypot((p.x || 0) - P.x, (p.y || 0) - (P.y - 60)) < 220) { const self = this; return within('aura', () => baseAdd.call(self, p), P); }
          // (a plain swing's own ground ring, js/entities.js: o.swingRing skins draw it as their light too)
          if (o.swingRing && p.type === 'ring' && !LK.scope() && P.atk && P.atk.on && Math.hypot((p.x || 0) - P.x, (p.y || 0) - P.y) < 420) { const self = this; return within('swing', () => baseAdd.call(self, p), P); }
          // a cast's circle under the feet (js/casting.js): the painted sigil
          if (p.type === 'custom' && p.layer === 'low' && p.life === 99 && P.casting && P.casting.fx && !p.lkCast) {
            p.lkCast = true;
            const d0 = p.draw;
            p.draw = function () {
              if (!live()) return d0.apply(this, arguments);
              const mc = V.magicCircle;
              V.magicCircle = (c, x, y, r, rot, rgb, a, style) => LK.sigilNow(c, x, y, r, rot, LK.hex(rgb, 0.15), Math.min(1, a * 1.1), style);
              try { return d0.apply(this, arguments); } finally { V.magicCircle = mc; }
            };
          }
        }
      }
      const r = baseAdd.apply(this, arguments);
      // (a look another file turns an item into while it is added, e.g. a bell's bolt -> j3chime: swapped after)
      if (p && SWAP[p.type] && !p.origType && live() && fam(me()) && SWAP[p.type](p, L) === false) p.origType = null;
      return r;
    };
    if (o.plain !== false) {
      const baseDamage = NC.damageEnemy;
      NC.damageEnemy = function (game, e, r, kx, ky, oo) {
        // (game.player can be a friend with no gear: party.js swaps in a monster's target, e.g. a wolf, while it updates)
        const P = game && game.player, W = P && P.equip && NC.ITEMS[P.equip.weapon];
        const mine = !!(r && r.lkPlain && !r.miss && live() && fam(P) && W && !(o.plainSkip && o.plainSkip(W)) && W.style !== 'arrow' && e && e.hp > 0 && !(oo && oo.dot));
        dealing = mine;
        let res;
        try { res = baseDamage.apply(this, arguments); } finally { dealing = false; }
        if (mine) {
          const dir = Math.sign(kx) || Math.sign(e.x - P.x) || 1, top = NC.labelTop ? NC.labelTop(e) : e.y - 120;
          const hy = e.y - Math.max(30, (e.y - top) * 0.45), k = Math.max(0.75, Math.min(1.4, 0.65 + (e.r || 30) / 110)) * ((oo && oo.big) ? 1.25 : 1);
          if (o.plainHit) o.plainHit(e, r, { x: e.x + dir * 6, y: hy, dir, k, P, W, big: !!(oo && oo.big) });
          else LK.burst(e.x + dir * 6, hy, { k: k * 0.6, col: o.tone ? o.tone(P) : GOLD, n: r.crit ? 12 : 8, dir, spark: 5 });
        }
        return res;
      };
    }
    return L;
  };
})();
