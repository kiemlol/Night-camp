/* crimsonfx.js — a red foam shield round the hero that soaks hits and blows up (2026-10-03, the user after KarmicBit's
   hand-drawn Nonu clip: "ลองทำ vfx แบบนี้ให้หน่อย"). tools/crimson_shield.py draws the frames into assets/vfx2d/crimson/:
     form   it rises from the ground, fills with marbled swirls and opens into a red web of foam cells
     idle   the web, breathing, a band sweeping round it (loop)
     hit    a whirlpool splash where a blow lands (drawn for the right side, flipped for the left)
     burst  it charges white, shreds into fibres flying out, and its web runs down and fades
   Every shell frame has a back half (drawn under the characters, 'low') and a front half (over them, 'glow'), and each
   front frame a bloom (<seq>_glow.webp: its light blurred, half size, on black) added on top with 'lighter'.
     NC.CrimsonFX.add(game, p, { hold, onBurst })   the shield on p; it bursts `hold` s after it formed, or on q.burst()
     NC.CrimsonFX.hit(p, fromX)                     a splash on the side facing fromX (monster hits do this by themselves)
   Test: ?crimson casts it on the hero every 6.5 s; the burst hits monsters round the hero for 300% ATK. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX;
  if (!FX || !V) return;
  const CF = (NC.CrimsonFX = { on: true, R: 100, bloom: 0.8 });
  const D = 'assets/vfx2d/crimson/';
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  // the sheets' layout (meta.json): 384 px frames, the hero's feet at (192, 300), the sphere's radius 110 px, 15 fps
  const M = { S: 384, gx: 192, gy: 300, r: 110, fps: 15,
    form: { frames: 11, cols: 8 }, idle: { frames: 16, cols: 8 }, hit: { frames: 7, cols: 7 }, burst: { frames: 15, cols: 8 } };
  const FLASH = 5;     // the burst's white frame: the blast goes off here
  const SHELL = 6;     // burst frames after this are flying fibres (no back half)
  const A = {};
  for (const n of ['form', 'idle', 'hit', 'burst']) {
    A[n] = load(D + n + '.webp');
    A[n + '_glow'] = load(D + n + '_glow.webp');
    if (n !== 'hit') A[n + '_back'] = load(D + n + '_back.webp');
  }
  CF.ready = () => Object.values(A).every(ok);
  const RGB = '255,60,90', HOT = '255,190,170';
  const TAU = Math.PI * 2;

  // one frame of a sheet with the feet at (x, y); half: a half-size sheet (the bloom)
  const frame = (ctx, img, sheet, f, x, y, k, flip, half) => {
    const S = half ? M.S / 2 : M.S, sx = (f % sheet.cols) * S, sy = Math.floor(f / sheet.cols) * S, D = M.S * k;
    if (!flip) { ctx.drawImage(img, sx, sy, S, S, x - M.gx * k, y - M.gy * k, D, D); return; }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, S, S, -M.gx * k, -M.gy * k, D, D);
    ctx.restore();
  };
  // which sequence and frame the shield shows now
  const pick = (q) => {
    if (q.burstT !== undefined) {
      const f = Math.floor((q.t - q.burstT) * M.fps);
      return f < M.burst.frames ? ['burst', f] : null;
    }
    const f = Math.floor(q.t * M.fps);
    return f < M.form.frames ? ['form', f] : ['idle', (f - M.form.frames) % M.idle.frames];
  };
  const formDur = M.form.frames / M.fps;

  // the front half, the hit splashes and the light (after the night lighting: it glows)
  FX.def('crimson', (ctx, q) => {
    const p = q.follow;
    if (!p || !CF.ready()) return;
    const at = pick(q);
    if (!at) return;
    const k = CF.R / M.r, x = p.x, y = p.y + 4;
    const [seq, f] = at;
    const hot = seq === 'burst' && f >= 3 && f <= FLASH + 1;
    const out = seq === 'burst' && f > FLASH ? 1 + (f - FLASH) * 0.1 : 1;
    V.glow(ctx, x, y - 64, 150 * out, hot ? HOT : RGB, hot ? 0.55 : seq === 'form' && f < 4 ? 0.3 : 0.16, hot, 0.85);
    frame(ctx, A[seq], M[seq], f, x, y, k);
    const splash = [];
    if (seq !== 'burst' || f < 2)
      for (const h of q.hits) {
        const hf = Math.floor((q.t - h.t) * M.fps);
        if (hf >= 0 && hf < M.hit.frames) { frame(ctx, A.hit, M.hit, hf, x, y, k, h.side < 0); splash.push([hf, h.side < 0]); }
      }
    // the bloom over it all
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= CF.bloom * (hot ? 1.15 : 1);
    frame(ctx, A[seq + '_glow'], M[seq], f, x, y, k, false, true);
    for (const [hf, flip] of splash) frame(ctx, A.hit_glow, M.hit, hf, x, y, k, flip, true);
    ctx.restore();
  }, 'glow');
  // the back half: under every character, so the hero stands inside it
  FX.def('crimson_back', (ctx, b) => {
    const q = b.main, p = q && q.follow;
    if (!p || q.dead || !CF.ready()) { if (!q || q.dead) b.dead = true; return; }
    const at = pick(q);
    if (!at || (at[0] === 'burst' && at[1] >= SHELL)) return;
    const k = CF.R / M.r;
    frame(ctx, A[at[0] + '_back'], M[at[0]], at[1], p.x, p.y + 4, k);
  }, 'low');

  // speed lines: thin bright strokes flying out from the hero (or in, while it charges)
  FX.def('crimson_lines', (ctx, o, u) => {
    const p = o.follow, x = p ? p.x : o.x, y = (p ? p.y : o.y) - 62;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const L of o.lines) {
      const v = (u - L.d) / (1 - L.d);
      if (v <= 0 || v >= 1) continue;
      const r = o.inward ? L.r1 - (L.r1 - L.r0) * v : L.r0 + (L.r1 - L.r0) * v;
      const len = L.len * Math.sin(v * Math.PI), c = Math.cos(L.a), s = Math.sin(L.a) * 0.8;
      const r2 = o.inward ? r + len : r - len;
      ctx.strokeStyle = `rgba(255,${L.w > 2 ? 236 : 196},${L.w > 2 ? 226 : 206},${0.85 * Math.sin(v * Math.PI)})`;
      ctx.lineWidth = L.w;
      ctx.beginPath();
      ctx.moveTo(x + c * r, y + s * r);
      ctx.lineTo(x + c * r2, y + s * r2);
      ctx.stroke();
    }
    ctx.restore();
  }, 'glow');
  const lines = (p, n, inward, life) => {
    const L = [];
    for (let i = 0; i < n; i++)
      L.push({ a: NC.rand(0, TAU), d: NC.rand(0, 0.45), r0: NC.rand(40, 70), r1: NC.rand(170, 240), len: NC.rand(40, 90), w: NC.rand(1.2, 3.2) });
    FX.add({ type: 'crimson_lines', follow: p, x: p.x, y: p.y, life, lines: L, inward });
  };

  // the shield's clock: bursts after `hold`, goes off on the flash frame, ends when its last frame is shown
  const tick = (q, dt, game) => {
    const p = q.follow;
    if (!p || p.dead > 0 || p.hp <= 0) { q.dead = true; return; }
    q.hits = q.hits.filter((h) => q.t - h.t < 1);
    if (q.burstT === undefined && q.hold !== undefined && q.t >= formDur + q.hold) q.burst();
    if (q.burstT === undefined) return;
    const f = Math.floor((q.t - q.burstT) * M.fps);
    if (!q.chargeFx) {
      q.chargeFx = true;
      lines(p, 22, true, FLASH / M.fps + 0.05);
      V.light(p.x, p.y - 60, 320, HOT, 0.7, 0.6, { follow: p });
    }
    if (f >= FLASH && !q.blown) {
      q.blown = true;
      lines(p, 30, false, 0.42);
      V.flash('255,120,140', 0.22, 0.28);
      V.shake(game, 14);
      V.stop(game, 0.06);
      V.sparks(p.x, p.y - 66, 22, '255,110,130', { size: 1.3, min: 420, max: 900, sq: 0.8 });
      V.light(p.x, p.y - 60, 420, RGB, 1, 0.7);
      if (q.onBurst) q.onBurst(game, p);
    }
    if (f >= M.burst.frames) q.dead = true;
  };

  // the shield on p (one at a time): hold = seconds it stands after forming (undefined: until q.burst())
  CF.add = function (game, p, o) {
    o = o || {};
    if (p.crimsonFx && !p.crimsonFx.dead) p.crimsonFx.dead = true;
    const q = FX.add({ type: 'crimson', follow: p, x: p.x, y: p.y, life: 9999, hits: [], hold: o.hold, onBurst: o.onBurst, update: tick });
    q.burst = () => { if (q.burstT === undefined) q.burstT = q.t; };
    FX.add({ type: 'crimson_back', main: q, x: p.x, y: p.y, life: 9999 });
    p.crimsonFx = q;
    lines(p, 26, false, 0.5);
    V.sparks(p.x, p.y - 30, 12, '255,90,120', { size: 1, ang: -Math.PI / 2, spread: 1.2, min: 300, max: 650 });
    V.light(p.x, p.y - 60, 300, RGB, 0.65, 2.5, { follow: p });
    V.flash('255,90,120', 0.08, 0.2);
    return q;
  };
  // a blow landing on the shield from fromX's side
  CF.hit = function (p, fromX) {
    const q = p.crimsonFx;
    if (!q || q.dead || q.burstT !== undefined || q.t < formDur * 0.6) return;
    if (q.hits.length && q.t - q.hits[q.hits.length - 1].t < 0.18) return;
    const side = fromX === undefined ? (Math.random() < 0.5 ? -1 : 1) : fromX < p.x ? -1 : 1;
    q.hits.push({ t: q.t, side });
    V.sparks(p.x + side * 80, p.y - 70, 7, '255,150,90', { size: 0.8, ang: side > 0 ? 0 : Math.PI, spread: 0.9 });
  };
  // a blow on a shielded hero splashes on its side (the damage itself is left to the skill using the shield; this sits
  // outside the guards so the burst stays visible)
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game, dmg, fromX) {
    const p = game.player;
    if (p && p.crimsonFx && !p.crimsonFx.dead && !(p.inv > 0) && dmg > 0) CF.hit(p, fromX);
    return baseHurt.apply(this, arguments);
  };

})();
