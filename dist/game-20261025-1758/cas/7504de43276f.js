/* droplight.js — the light of a dropped ราตรี piece drawn LIVE with shaders (js/glfx.js, the way the void dome was made),
   four versions for the user to pick (2026-10-12, the user: "เราวาดสดได้ไหมแบบนั้น ทำแสงตรงลง แล้วเพิ่ม bloom ให้สวยๆ" →
   "ทำมาให้เลือกดีกว่า เอาแค่ของสีแดงก็พอ"). Every version strikes DOWN from the sky onto the item when it lands (a flash
   and a ring at the foot), then stays as a column of light with its own life, and a bloom of soft glow layers round it:
     A  เสานุ่ม        a soft column, light pouring down slowly inside it, a wide bloom, embers rising
     B  ฟาดลง          a narrow white-hot strike, light pouring down fast, a star flash, ripples on the ground, sparks
                       raining down the column
     C  ม่านราตรี      a wide curtain of red light, dark smoke turning at its foot, sparks circling it
     D  วงแหวนเลื่อนลง  rings of light sliding down the column and spreading over the ground, twinkles
   The beam is the shader shape `beam` (glfx.js); the bloom is shape `glow` quads (a halo along it, a pool on the ground).
   The user liked D ("ชอบอันขวา D แต่อยากเห็นสีอื่นๆด้วย"): D is the light of EVERY grade now, in the grade's colour (glfx
   palettes g0..g4, ราตรี the red blood palette), its height, width and number of rings growing with the grade (ธรรมดา a
   short white glint, ตำนาน / ราตรี the tallest).
   NC.DropLight: STYLES, style ('D'), LOOK (per grade), draw(ctx, game, l, style) -> true when drawn. Test: ?droplight (the
   six grades side by side, striking again every 5 s; add &root=95), ?droplight=abcd (the four red versions). */
(function () {
  'use strict';
  const NC = window.NC, GL = NC.GLFX, FX = NC.FX;
  if (!GL || !FX) return;
  const STYLES = { A: 'เสานุ่ม', B: 'ฟาดลง', C: 'ม่านราตรี', D: 'วงแหวนเลื่อนลง' };
  const DL = (NC.DropLight = { STYLES, style: 'D' });
  // each grade's light: the shader palette, the bloom's two tints, the dark backing behind the item, the outline's colour,
  // the column's height and half width, the rings, the twinkles, the bloom's strength
  const LOOK = [
    { pal: 8, c1: [0.95, 0.92, 0.85], c2: [1, 1, 1], back: '30,26,22', rim: '#ffffff', H: 170, RX: 40, rings: 1, tw: 0, bloom: 0.55 },
    { pal: 9, c1: [0.25, 0.95, 0.32], c2: [0.62, 1, 0.58], back: '6,26,10', rim: '#7dff76', H: 230, RX: 50, rings: 2, tw: 1, bloom: 0.75 },
    { pal: 10, c1: [0.28, 0.6, 1.0], c2: [0.6, 0.82, 1], back: '6,16,36', rim: '#7cc4ff', H: 290, RX: 58, rings: 2, tw: 2, bloom: 0.85 },
    { pal: 11, c1: [0.66, 0.36, 1.0], c2: [0.84, 0.66, 1], back: '22,8,40', rim: '#c79bff', H: 340, RX: 66, rings: 3, tw: 3, bloom: 0.95 },
    { pal: 12, c1: [1.0, 0.7, 0.16], c2: [1, 0.88, 0.5], back: '40,22,4', rim: '#ffd25e', H: 390, RX: 72, rings: 3, tw: 4, bloom: 1 },
    { pal: 0, c1: [1.0, 0.16, 0.34], c2: [1.0, 0.42, 0.55], back: '25,4,16', rim: '#ff5c8e', H: 390, RX: 72, rings: 3, tw: 4, bloom: 1 },
  ];
  DL.LOOK = LOOK;
  const gradeOf = (l) => (l.dlGrade != null ? l.dlGrade : NC.Grade && l.inst ? NC.Grade.of(l.inst) : 5);
  const STRIKE = 0.2; // (seconds for the strike to reach the ground)

  function state(game, l) {
    if (!l._dl) l._dl = { t0: game.time, seen: game.time, parts: null, seed: Math.random() * 50 };
    l._dl.seen = game.time;
    return l._dl;
  }
  // a particle system living as long as the drop is drawn
  function partsOf(game, S, spawn, draw) {
    if (S.parts && !S.parts.dead) return S.parts;
    const o = { life: 1e9, spawnFor: 1e9, draw, tick(q, dt) { if (game.time - S.seen > 0.25) { o.spawnFor = 0; return; } spawn(q, dt); } };
    S.parts = GL.parts(o);
    return S.parts;
  }
  const glow = (x, y, rx, ry, tint, a) => GL.quad('glow', x, y, rx, ry, 0, { shape: GL.SH.glow, add: true, tint, a });
  let PALN = 0; // (the palette of the light being drawn)
  const ring = (x, y, r, a, extra, seed) => GL.quad('glow', x, y, r, r * 0.34, 0, { shape: GL.SH.ring, add: true, pal: PALN, ns: 3, extra: extra || 0.25, a, seed: seed || 0 });

  // ---------------- which drops get the live light: ESC → ตั้งค่า → "แสงของดรอป" (2026-10-24: FPS on a loot pile) ----------------
  // full: every drop · good: แวววาว and up (grade 3+) and the 8 nearest; the rest stand in their painted pillar (gradetier.js
  // draws it when this returns false: two pictures, not a dozen large shader quads and a 2D pass) · auto: on the WebGL
  // screen full at คุณภาพภาพ สูง and good below it; on the Canvas2D screen (Macs and iPhones by default, gl2d.js) only
  // เจิดจ้า and ราตรี: there every live light is drawn on a WebGL canvas and copied onto the 2D screen, and the first one a
  // frame costs ~4 ms (a crowd with 80 drops on the ground: 12.9 -> 6.1 ms a frame with the pillars, 2026-10-24).
  // Remembered in localStorage nightcamp.droplight.v1.
  const MODE_KEY = 'nightcamp.droplight.v1', MODES = ['auto', 'full', 'good'], NEAR = 8, NEAR_KEEP = 12, GOOD_GRADE = 3, TOP_GRADE = 4;
  let mode = 'auto';
  try { const v = localStorage.getItem(MODE_KEY); if (MODES.includes(v)) mode = v; } catch (e) { /* storage blocked: auto */ }
  const webglScreen = () => !!(NC.GL2D && NC.GL2D.on);
  const highQuality = () => !(NC.Gfx && NC.Gfx.level && NC.Gfx.level() > 0);
  // the drops by distance from the hero, once a frame; a drop keeps its light while it stays in the nearest 12 (no
  // flicker as two drops trade places at the 8th)
  let rankAt = -1;
  const rank = new Map();
  function rankOf(game, l) {
    if (rankAt !== game.time) {
      rankAt = game.time; rank.clear();
      const p = game.player, L = game.loot || [];
      if (p) L.filter((d) => d.inst && !d.done).map((d) => [(d.x - p.x) ** 2 + (d.y - p.y) ** 2, d]).sort((a, b) => a[0] - b[0]).forEach(([, d], i) => rank.set(d, i));
    }
    return rank.has(l) ? rank.get(l) : Infinity;
  }
  function lit(game, l) {
    const g = gradeOf(l);
    if (mode === 'full') return true;
    if (mode === 'auto' && !webglScreen()) return g >= TOP_GRADE;
    // (Auto's relief, js/gfx.js: the CPU holding the frames back makes อัตโนมัติ เฉพาะของดี)
    const relieved = NC.Gfx && NC.Gfx.relief && NC.Gfx.relief() >= 1;
    if ((mode === 'auto' && highQuality() && !relieved) || g >= GOOD_GRADE) return true;
    const r = rankOf(game, l);
    l._dlNear = r < NEAR || (!!l._dlNear && r < NEAR_KEEP);
    return l._dlNear;
  }
  DL.mode = () => mode;
  DL.setMode = (v) => {
    if (!MODES.includes(v)) return;
    mode = v;
    try { localStorage.setItem(MODE_KEY, v); } catch (e) { /* storage blocked: this visit only */ }
  };
  (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []).push({
    name: 'แสงของดรอป',
    note: 'ของตกเยอะแล้วกระตุก: เฉพาะของดี = แสงเต็มแค่ของแวววาวขึ้นไปกับ 8 ชิ้นที่ใกล้สุด · อัตโนมัติ = เต็มเมื่อคุณภาพภาพสูง (Mac / iPhone: เฉพาะเจิดจ้าขึ้นไป)',
    group: 'perf',
    opts: [['auto', 'อัตโนมัติ'], ['full', 'เต็ม'], ['good', 'เฉพาะของดี']],
    get: () => mode,
    set: (v) => DL.setMode(v),
  });

  DL.draw = function (ctx, game, l, style) {
    if (!GL.ok() || !lit(game, l)) return false;
    style = style || l.dlStyle || DL.style;
    const S = state(game, l), t = game.time, age = t - S.t0, x = l.x, y = l.y;
    const strike = GL.out(Math.min(1, age / STRIKE), 2), after = age - STRIKE;
    const breathe = 0.92 + 0.08 * Math.sin(t * 2.6 + S.seed);
    const gr = gradeOf(l), K = LOOK[gr], RED = K.c1, RED2 = K.c2, DEEP = K.c1;
    PALN = K.pal;
    const H = style === 'D' ? K.H : style === 'C' ? 430 : style === 'B' ? 400 : 380, RX = style === 'D' ? K.RX : style === 'C' ? 96 : style === 'B' ? 58 : 72;
    const cy = y - H / 2 + 6, iconV = (H / 2 - 118) / (H / 2); // (where the item floats, js/droplight.js TOP)
    // the bloom: a halo along the column and a pool on the ground (soft glow layers added together)
    const bl = strike * breathe * K.bloom;
    glow(x, y - H * 0.42, RX * 2.2, H * 0.62, style === 'C' ? DEEP : RED, 0.38 * bl);
    glow(x, y - H * 0.3, RX * 1.1, H * 0.45, RED2, 0.22 * bl);
    glow(x, y - 30, RX * 1.8, 80, RED2, 0.5 * bl);
    glow(x, y, 170, 58, RED, 0.85 * bl);
    // the column
    const beam = {
      A: { edge: 0.09, ns: 2.2, pan: 0.35, extra: 1.1, w: 0.5 },
      B: { edge: 0.06, ns: 2.6, pan: 1.5, extra: 1.35, w: 0.34 },
      C: { edge: 0.12, ns: 1.6, pan: 0.6, extra: 0.95, w: 0.72 },
      D: { edge: 0.08, ns: 2.2, pan: 0.5, extra: 1.1, w: 0.42 },
    }[style];
    GL.quad('glow', x, cy, RX, H / 2, 0, { shape: GL.SH.beam, add: true, pal: PALN, erode: strike, edge: beam.edge, ns: beam.ns, pan: beam.pan,
      extra: beam.extra * breathe * (age < STRIKE + 0.25 ? 1.35 : 1) * (gr === 0 ? 0.8 : 1), seed: S.seed, p2: [0, Math.max(-0.6, iconV), 0.42, beam.w] });
    // the ground ring
    ring(x, y + 2, style === 'C' ? 86 : RX - 6, strike * (0.75 + 0.25 * Math.sin(t * 3 + S.seed)), 0.25, S.seed);
    // the landing: a flash at the foot and a ring spreading out (every version)
    if (after >= 0 && after < 0.5) {
      const u = after / 0.5;
      const big = 0.5 + 0.5 * (gr / 5);
      GL.quad('glow', x, y - 30, (190 * GL.out(u, 2) + 40) * big, (190 * GL.out(u, 2) + 40) * big, S.seed, { shape: GL.SH.star, add: true, pal: PALN, seed: S.seed, a: (1 - u) * (style === 'B' ? 1 : 0.75), extra: 0.25 });
      ring(x, y + 2, (60 + 170 * GL.out(u, 2)) * big, (1 - u) * 0.9, 0.35, S.seed + 3);
      glow(x, y - 40, 200, 140, RED2, (1 - u) * 0.45);
    }
    // each version's own life
    if (style === 'A') {        // embers rising slowly through the column
      partsOf(game, S, (q, dt) => {
        if (Math.random() < dt * 9) q.add({ x: x + (Math.random() - 0.5) * RX * 0.9, y: y - Math.random() * 30, vx: (Math.random() - 0.5) * 10, vy: -40 - Math.random() * 60, life: 1.6 + Math.random() * 1.2, s: 4 + Math.random() * 6 });
      }, (p, u) => GL.quad('glow', p.x, p.y, p.s * 2.2, p.s * 2.2, 0, { shape: GL.SH.glow, add: true, tint: RED2, a: Math.sin(Math.PI * u) * 0.9 }));
    } else if (style === 'B') { // sparks raining down the column, ripples on the ground
      partsOf(game, S, (q, dt) => {
        if (Math.random() < dt * 14) q.add({ x: x + (Math.random() - 0.5) * RX * 0.7, y: y - H * (0.5 + Math.random() * 0.45), vx: 0, vy: 380 + Math.random() * 260, life: 0.5 + Math.random() * 0.3, s: 10 + Math.random() * 10 });
      }, (p, u) => { if (p.y < y - 6) GL.quad('glow', p.x, p.y, p.s * 1.8, 3.2, Math.PI / 2, { shape: GL.SH.spark, add: true, pal: K.pal, a: Math.sin(Math.PI * Math.min(1, u * 1.3)) * 0.95, extra: 0.25 }); });
      const ph = ((age + S.seed) % 1.3) / 1.3;
      if (after > 0) ring(x, y + 2, 60 + 110 * ph, (1 - ph) * 0.7, 0.3, S.seed + 7);
    } else if (style === 'C') { // dark smoke turning at the foot, sparks circling
      // a glowing swirl turning on the ground round its foot (the vortex shape's tendrils, flattened), two layers
      GL.quad('glow', x, y - 4, 130, 46, 0, { shape: GL.SH.vortex, add: true, pal: PALN, ns: 2.2, pan: 1.1, seed: S.seed, extra: 1, a: 0.9 * strike });
      GL.quad('glow', x, y - 4, 100, 34, 0, { shape: GL.SH.vortex, add: true, pal: PALN, ns: 3.0, pan: -1.6, seed: S.seed + 5, extra: 1, a: 0.6 * strike });
      for (let k = 0; k < 5; k++) {
        const ang = t * 1.8 + (k / 5) * Math.PI * 2, px = x + Math.cos(ang) * 84, py = y - 60 - k * 22 + Math.sin(ang) * 26;
        GL.quad('glow', px, py, 16, 16, 0, { shape: GL.SH.twinkle, add: true, pal: PALN, a: 0.8 * strike * (0.6 + 0.4 * Math.sin(t * 5 + k)) });
      }
    } else if (style === 'D') { // rings sliding down the column, then spreading over the ground
      const n = K.rings, rr = RX / 72;
      for (let k = 0; k < n; k++) {
        const ph = ((age * 0.8 + k / n + S.seed) % 1);
        if (ph < 0.7) { const u = ph / 0.7; ring(x, y - H * 0.85 * (1 - u), (34 + 20 * u) * rr, Math.sin(Math.PI * u) * 0.9 * strike, 0.35, S.seed + k); }
        else { const u = (ph - 0.7) / 0.3; ring(x, y + 2, (54 + 120 * u) * rr, (1 - u) * 0.8 * strike, 0.3, S.seed + k + 9); }
      }
      for (let k = 0; k < K.tw; k++) {
        const tw = (t * 0.7 + k * 0.27 + S.seed) % 1, px = x + Math.sin(k * 2.3 + S.seed) * RX * 0.8, py = y - 80 - k * (H - 100) / 4;
        GL.quad('glow', px, py, 22, 22, 0, { shape: GL.SH.twinkle, add: true, pal: PALN, a: Math.sin(Math.PI * tw) * strike });
      }
    }
    TOP.push({ l, g: gr, H });
    return true;
  };

  // ---------------- the item over its light ----------------
  // the light is drawn in the glow layer (after the world), so the item is drawn again on top of it: a dark soft
  // backing for contrast, a bright outline in the grade's light, the icon bigger, floating and turning a little
  const TOP = [];
  // The outline round the icon: 8 copies of its silhouette in white, 8 in the grade's light, each set baked once into one
  // picture per item and grade (2026-10-24: FPS; it was 16 drawImage a drop a frame, the silhouettes made again every 2 s).
  // Baked only once the icon's art is in (js/stream.js: a pending icon is an empty canvas filled in later).
  const OUT_PAD = 12, OUT_SIZE = 128 + OUT_PAD * 2, OUT_MAX = 300;
  const outlines = new Map(); // 'id|grade' -> { white, glow }
  function silhouette(ic, col) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.drawImage(ic, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, 128, 128);
    return c;
  }
  function bake(sil, off, add) {
    const c = document.createElement('canvas'); c.width = c.height = OUT_SIZE;
    const x = c.getContext('2d');
    if (add) x.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; x.drawImage(sil, OUT_PAD + Math.cos(a) * off, OUT_PAD + Math.sin(a) * off); }
    return c;
  }
  // the dark backing, one radial gradient baked per grade (2026-10-24: FPS: a gradient and a circle path a drop a frame)
  const BACK_R = 64, BACKS = [];
  function backOf(g) {
    if (BACKS[g]) return BACKS[g];
    const K = LOOK[g], c = document.createElement('canvas'); c.width = c.height = BACK_R * 2;
    const x = c.getContext('2d'), r0 = (BACK_R * 4) / (1.25 * (g >= 3 ? 46 : 40)); // (the gradient's 4 px core at full size)
    const sh = x.createRadialGradient(BACK_R, BACK_R, r0, BACK_R, BACK_R, BACK_R);
    sh.addColorStop(0, `rgba(${K.back},0.72)`); sh.addColorStop(0.6, `rgba(${K.back},0.45)`); sh.addColorStop(1, `rgba(${K.back},0)`);
    x.fillStyle = sh; x.fillRect(0, 0, BACK_R * 2, BACK_R * 2);
    return (BACKS[g] = c);
  }
  function outlineOf(id, g) {
    const key = id + '|' + g;
    let o = outlines.get(key);
    if (o) return o;
    const ic = NC.itemIcon(id, 128);
    if (!ic || (ic.ncIcon && ic.ncIcon.pending)) return null; // (its art is not in yet: no outline until it is)
    const k = 128 / (2 * (g >= 3 ? 46 : 40)); // (icon pixels per world unit at the light's full size, R below)
    if (outlines.size >= OUT_MAX) outlines.clear();
    o = { white: bake(silhouette(ic, '#fff'), 3.2 * k, false), glow: bake(silhouette(ic, LOOK[g].rim), 6.5 * k, true) };
    outlines.set(key, o);
    return o;
  }
  const baseFxDraw = FX.draw;
  FX.draw = function (ctx, layer) {
    baseFxDraw.apply(this, arguments);
    if (layer !== 'glow' || !TOP.length || !NC.game) return;
    const t = NC.game.time;
    for (const { l, g, H } of TOP.splice(0)) {
      const K = LOOK[g], S = l._dl, age = S ? t - S.t0 : 1, pop = GL.backOut(Math.min(1, age / 0.35), 2.2);
      const lift = Math.min(112, H * 0.42);
      const bob = Math.sin(t * 2.4 + l.x * 0.01) * 7, x = l.x, y = l.y - lift - (l.z || 0) + bob, R = (g >= 3 ? 46 : 40) * pop, rot = Math.sin(t * 1.6 + l.x) * 0.12;
      ctx.save();
      // the dark backing (a soft round shadow inside the light), baked per grade (backOf)
      const br = R * 1.25;
      ctx.drawImage(backOf(g), x - br, y - br, br * 2, br * 2);
      ctx.translate(x, y); ctx.rotate(rot);
      // the outline: the silhouette round it in white, then in the grade's light (baked, outlineOf)
      const out = outlineOf(l.id, g), s2 = R * 2, ko = s2 / 128, ob = OUT_SIZE * ko, oo = -R - OUT_PAD * ko;
      if (out) {
        ctx.globalAlpha = 0.95; ctx.drawImage(out.white, oo, oo, ob, ob);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 4); ctx.drawImage(out.glow, oo, oo, ob, ob);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
      ctx.drawImage(NC.itemIcon(l.id, 128), -R, -R, s2, s2);
      ctx.restore();
      if (NC.gradeStarTag) NC.gradeStarTag(ctx, x, y - R - 22, g);
    }
  };

})();
