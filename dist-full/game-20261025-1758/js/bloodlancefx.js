/* bloodlancefx.js — the blood lance (2026-10-05, after a stylized Unreal reference clip the
   user sent: "ทำ vfx แบบนี้ให้หน่อย"). Drawn by code like the crimson shield
   (tools/bloodlance_fx.py → assets/vfx2d/bloodlance/), played along the line from the hero to a monster, in the clip's beats:
     0.00  the monster is struck: a white-pink star with dark thorns and red sparks; a dark orb lights in the hero's hand
     0.15  red claw crescents spring off it, bunch up and fly back to the hero, growing
     0.85  they hit him: a crimson whirlpool round a black ball, white flares, embers; the ball turns pink;
           a trail of dark specks and embers is left along the line
     2.40  a pink flash fills the screen, the lance is a shell, a white beam fires down it and a crown of crystal spikes
           bursts out of the monster; it hardens into a crimson crystal (sharp at the hero, wide at the monster) that
           pulses, turns violet, shrinks to a thin violet line and leaves violet sparkles drifting along it
   NC.BloodLanceFX.cast(game, p, e, { onStrike, onLance })   the whole thing at monster e (onStrike at 0, onLance at 2.4 s)
   Test: ?bloodlance casts it at the nearest monster every 6 s (the strike 100% ATK, the lance 400%). Not tied to a skill. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX;
  if (!FX || !V) return;
  const BL = (NC.BloodLanceFX = { on: true, bloom: 0.55 });
  const D = 'assets/vfx2d/bloodlance/';
  const FPS = 15, TAU = Math.PI * 2, rand = NC.rand;
  // the sheets (meta.json): frame size, columns, frames, the anchor in the frame
  const SH = {
    burst: { w: 384, h: 384, cols: 5, n: 10, ax: 192, ay: 192 },
    shards: { w: 512, h: 256, cols: 4, n: 8, ax: 430, ay: 128 },
    vortex: { w: 640, h: 480, cols: 4, n: 12, ax: 320, ay: 250 },
    lance: { w: 1024, h: 320, cols: 3, n: 21, ax: 40, ay: 160, len: 944 },
    crown: { w: 512, h: 512, cols: 4, n: 16, ax: 256, ay: 256 },
  };
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const IMG = {};
  for (const n in SH) { IMG[n] = load(D + n + '.webp'); IMG[n + '_glow'] = load(D + n + '_glow.webp'); }
  BL.ready = () => Object.values(IMG).every(ok);
  const RED = '255,60,110', PINK = '255,150,205', VIO = '160,110,255';

  // frame f of a sheet with its anchor at (x, y), turned by rot, scaled kx / ky; the bloom added on top
  function blit(ctx, name, f, x, y, kx, ky, rot, a) {
    const s = SH[name];
    f = Math.max(0, Math.min(s.n - 1, f | 0));
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (a !== undefined) ctx.globalAlpha *= Math.max(0, a);
    for (const glow of [false, true]) {
      const img = IMG[name + (glow ? '_glow' : '')], fw = glow ? s.w / 2 : s.w, fh = glow ? s.h / 2 : s.h;
      if (!ok(img)) continue;
      if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= BL.bloom; }
      ctx.drawImage(img, (f % s.cols) * fw, Math.floor(f / s.cols) * fh, fw, fh, -s.ax * kx, -s.ay * ky, s.w * kx, s.h * ky);
    }
    ctx.restore();
  }
  const oneShot = (q, n) => Math.min(n - 1, Math.floor((q.t / q.life) * n));
  // where the hand and the monster's body are now
  const hand = (p) => {
    const L = p.pose && NC.weaponLine && NC.weaponLine(p.equip, p.pose, p.x, p.y);
    return L ? [L.hand[0], L.hand[1]] : [p.x + (p.face || 1) * 26, p.y - 72];
  };
  const body = (e) => [e.x, e.y - 48];

  // ---------------- the pieces ----------------
  FX.def('bl_burst', (ctx, q) => blit(ctx, 'burst', oneShot(q, 10), q.x, q.y, q.k, q.k), 'glow');
  // the orb in the hand: a black ball in a red halo, pulsing, until the crescents arrive
  FX.def('bl_orb', (ctx, q) => {
    const [x, y] = hand(q.p), u = q.t / q.life, pul = 1 + 0.15 * Math.sin(q.t * 22);
    const a = Math.min(1, q.t / 0.08) * (u > 0.85 ? (1 - u) / 0.15 : 1);
    V.glow(ctx, x, y, 44 * pul, RED, 0.85 * a, false);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.beginPath(); ctx.arc(x, y, 7.5 * pul, 0, TAU); ctx.fillStyle = '#12040b'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${RED},0.95)`; ctx.stroke();
    ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, 2.2, 0, TAU); ctx.fillStyle = '#ff5c8a'; ctx.fill();
    ctx.restore();
  }, 'glow');
  // the crescents: from the monster back to the hand, eased in, growing, the sheet's head leading
  FX.def('bl_shards', (ctx, q) => {
    const u = q.t / q.life, [hx, hy] = hand(q.p), [ex, ey] = body(q.e);
    const k = 1 - Math.pow(1 - u, 1.7) * (1 - u * 0.3);
    const x = ex + (hx - ex) * k, y = ey + (hy - ey) * k - Math.sin(u * Math.PI) * 26;
    const ang = Math.atan2(hy - ey, hx - ex);
    const sc = 0.36 + 0.5 * u, a = Math.min(1, u / 0.12);
    blit(ctx, 'shards', Math.floor(q.t * FPS * 1.4), x, y, sc, sc * (1.25 + 0.2 * Math.sin(q.t * 9)), ang, a);
  }, 'glow');
  FX.def('bl_vortex', (ctx, q) => { const [x, y] = hand(q.p); blit(ctx, 'vortex', oneShot(q, 12), x, y, q.k, q.k * 0.92, -0.25); }, 'glow');
  // the lance itself: the sheet stretched along the line, its thickness kept
  FX.def('bl_lance', (ctx, q) => {
    const [hx, hy] = q.follow ? hand(q.p) : [q.x0, q.y0], [ex, ey] = q.e && q.e.hp > 0 ? body(q.e) : [q.x1, q.y1];
    q.x1 = ex; q.y1 = ey;
    const len = Math.hypot(ex - hx, ey - hy), ang = Math.atan2(ey - hy, ex - hx);
    blit(ctx, 'lance', oneShot(q, 21), hx, hy, Math.max(0.15, len / SH.lance.len), q.th, ang);
  }, 'glow');
  FX.def('bl_crown', (ctx, q) => {
    const [x, y] = q.e && q.e.hp > 0 ? body(q.e) : [q.x, q.y];
    q.x = x; q.y = y;
    blit(ctx, 'crown', oneShot(q, 16), x, y, q.k, q.k, q.ang);
  }, 'glow');
  // dark specks and embers lying along the line for a second (the clip's trail at 2.6 s)
  FX.def('bl_trail', (ctx, q) => {
    const u = q.t / q.life;
    ctx.save();
    for (const d of q.dots) {
      const v = (u - d.t0) / (1 - d.t0);
      if (v <= 0 || v >= 1) continue;
      const x = q.x0 + (q.x1 - q.x0) * d.s + d.ox + d.vx * v, y = q.y0 + (q.y1 - q.y0) * d.s + d.oy - d.rise * v;
      const a = Math.sin(v * Math.PI);
      if (d.ember) { V.glow(ctx, x, y, 7, d.glow || '255,120,70', 0.9 * a, true); continue; }
      ctx.globalAlpha = 0.85 * a;
      ctx.fillStyle = d.c;
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }, 'glow');
  const trail = (x0, y0, x1, y1, n, palette, life) => {
    const dots = [];
    for (let i = 0; i < n; i++) dots.push({ s: Math.random(), ox: rand(-14, 14), oy: rand(-10, 10), vx: rand(-20, 20), rise: rand(10, 40), r: rand(1.6, 3.6),
      t0: rand(0, 0.35), ember: Math.random() < palette.ember, glow: palette.glow, c: palette.c[Math.floor(Math.random() * palette.c.length)] });
    FX.add({ type: 'bl_trail', x0, y0, x1, y1, dots, life });
  };

  // ---------------- the whole cast ----------------
  BL.cast = function (game, p, e, o) {
    o = o || {};
    if (!BL.ready() || !e) return false;
    const [ex, ey] = body(e);
    // the hero swings at it, and thrusts when the lance goes (o.pose === false: the caller poses)
    const K = NC.SkillKit, face = () => { p.aim = Math.atan2(e.y - p.y, e.x - p.x); };
    const pose = (style, i, lock) => { if (o.pose === false || !K || !K.pose || !K.clip) return; face(); K.pose(game, p, K.clip(p, style, i), lock); };
    pose(null, 0, 0.35);
    // 0.00: the strike on the monster, the orb in the hand
    FX.add({ type: 'bl_burst', x: ex, y: ey, k: 0.72, life: 10 / FPS });
    V.light(ex, ey, 320, RED, 0.9, 0.5);
    V.sparks(ex, ey, 12, '255,90,120', { size: 1, min: 300, max: 760 });
    V.shake(game, 4);
    FX.add({ type: 'bl_orb', p, x: p.x, y: p.y, life: 0.95 });
    if (o.onStrike) o.onStrike(game, p, e);
    // 0.15: the crescents fly back
    V.at(0.15, () => FX.add({ type: 'bl_shards', p, e, x: ex, y: ey, life: 0.7 }));
    // 0.85: the whirlpool round the hero, the trail along the line
    V.at(0.85, () => {
      const [hx, hy] = hand(p), [bx, by] = body(e);
      FX.add({ type: 'bl_vortex', p, x: hx, y: hy, k: 1.0, life: 12 / FPS });
      V.light(hx, hy, 420, RED, 1, 0.9, { follow: p });
      V.sparks(hx, hy, 16, '255,110,90', { size: 0.9, min: 260, max: 620 });
      V.shake(game, 6);
      V.stop(game, 0.05);
      trail(hx, hy, bx, by, 42, { ember: 0.35, c: ['#1d0a14', '#2b0d1c', '#3a1024'] }, 1.5);
    });
    // 2.40: the flash, the lance, the crown
    V.at(2.4, () => {
      if (!(e.hp > 0) && !o.anyway) { const [hx, hy] = hand(p); FX.add({ type: 'bl_vortex', p, x: hx, y: hy, k: 0.3, life: 0.5 }); return; }
      pose(null, 2, 0.6);
      const [hx, hy] = hand(p), [bx, by] = body(e), ang = Math.atan2(by - hy, bx - hx);
      V.flash('255,120,200', 0.42, 0.22);
      V.shake(game, 12);
      V.stop(game, 0.08);
      FX.add({ type: 'bl_lance', p, e, follow: true, x0: hx, y0: hy, x1: bx, y1: by, th: 0.9, life: 21 / FPS });
      V.at(1 / FPS, () => FX.add({ type: 'bl_crown', e, x: bx, y: by, k: 0.68, ang, life: 16 / FPS }));
      V.light(bx, by, 520, RED, 1, 1.2);
      for (let i = 1; i <= 3; i++) V.light(hx + ((bx - hx) * i) / 4, hy + ((by - hy) * i) / 4, 300, PINK, 0.7, 1.0);
      V.light(hx, hy, 300, PINK, 0.8, 0.6);
      V.sparks(bx, by, 20, '255,200,180', { size: 1.1, min: 380, max: 900 });
      if (o.onLance) o.onLance(game, p, e);
      // the violet end: sparkles drifting off the line
      V.at(14 / FPS, () => { for (let i = 0; i <= 4; i++) V.light(hx + ((bx - hx) * i) / 4, hy + ((by - hy) * i) / 4, 300, VIO, 0.8, 0.7); });
      V.at(17 / FPS, () => { const [h2x, h2y] = hand(p), [b2x, b2y] = body(e); trail(h2x, h2y, b2x, b2y, 110, { ember: 0.3, glow: VIO, c: ['#c8b4ff', '#9c78ff', '#e8deff', '#3a1c66'] }, 1.5); });
    });
    return true;
  };

})();
