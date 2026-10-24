/* heavenfx.js — the Paladin's Heaven's Judgment (pal_heaven) with Blender swords (2026-10-02, the user: "ไอที่ดาบพุ่งลงมา
   อยากให้เป็น Blender เหมือนกัน", after the barrier): tools/blender/heaven_kit.py -> assets/vfx3d/heaven/.
     the swords   each falling sword is a Blender holy greatsword (crystal blade, gold crescent-moon guard, the navy outline),
                  turning as it drops, a trail of its own light above it; it sinks its tip into the ground, shines,
                  and fades
     the impact   where it lands: crystal shards flying out, light pooling on the ground (12 frames, drawn 'lighter')
                  and the game's own column of light (V.beam), instead of the flat ring
     the finale   the big ring at the end is a big impact in the middle
   Damage and timing don't change (class2_skills_a.js). NC.HeavenFX.on = false: the old look. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX;
  if (!FX || !V) return;
  const HF = (NC.HeavenFX = { on: true, LEN: 270, UNIT: 78 });
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const D = 'assets/vfx3d/heaven/';
  const A = { sword: load(D + 'sword.webp'), glow: load(D + 'glow.webp'), impact: load(D + 'impact.webp') };
  const SW = { W: 320, H: 640, n: 8, tipx: 160, tipy: 573, len: 506 }, IM = { W: 512, H: 512, n: 12, cols: 6, gx: 256, gy: 360, unit: 128 };
  const HOLY = '255,226,140';
  HF.ready = () => ok(A.sword) && ok(A.glow) && ok(A.impact);
  const lerp = (a, b, t) => a + (b - a) * t;

  // one sword frame, tip at (x, y)
  const sword = (ctx, img, f, x, y, k) => ctx.drawImage(img, f * SW.W, 0, SW.W, SW.H, x - SW.tipx * k, y - SW.tipy * k, SW.W * k, SW.H * k);
  // the impact burst at ground (x, y), frame by time u (0..1), size s (1 = a sword's)
  HF.impact = (ctx, x, y, u, s) => {
    if (!ok(A.impact) || u < 0 || u >= 1) return;
    const f = Math.min(IM.n - 1, Math.floor(u * IM.n)), k = (HF.UNIT / IM.unit) * (s || 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(A.impact, (f % IM.cols) * IM.W, Math.floor(f / IM.cols) * IM.H, IM.W, IM.H, x - IM.gx * k, y - IM.gy * k, IM.W * k, IM.H * k);
    ctx.restore();
  };

  // the falling sword (replaces class2_skills_a.js's drawn one while on)
  FX.def('vsword3', (ctx, q) => {
    const fall = q.fall, t = q.t, k = HF.LEN / SW.len;
    const spin = Math.floor((t + q.ph) * 18) % SW.n;
    if (t < fall) {
      const u = t / fall, y = lerp(q.y - 900, q.y + 26, u * u);
      V.glow(ctx, q.x, y - 120, 110, HOLY, 0.45, false);
      // the trail: the blade's light, stretched above it
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 3; i >= 1; i--) { ctx.globalAlpha = 0.22 * (4 - i) / 3; sword(ctx, A.glow, spin, q.x, y - i * 70 * (0.4 + u), k); }
      ctx.restore();
      sword(ctx, A.sword, spin, q.x, y, k);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; sword(ctx, A.glow, spin, q.x, y, k); ctx.restore();
      return;
    }
    // landed: stuck in the ground, a flash of light, then it fades out
    const s = t - fall, a = 1 - Math.max(0, Math.min(1, (s - 0.32) / 0.3));
    if (!q.landed) { q.landed = true; V.beam(q.x, q.y, 22, 260, HOLY, 0.32); } // (the column of light: the game's drawn beam)
    HF.impact(ctx, q.x, q.y, s / 0.55, 1);
    if (a <= 0) return;
    const f = q.landF === undefined ? (q.landF = spin) : q.landF;
    ctx.save(); ctx.globalAlpha *= a; sword(ctx, A.sword, f, q.x, q.y + 26, k); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * (0.3 + 0.5 * Math.max(0, 1 - s / 0.25)); sword(ctx, A.glow, f, q.x, q.y + 26, k); ctx.restore();
  }, 'glow');
  // the finale: a big burst in the middle
  FX.def('vheavenburst', (ctx, q) => {
    if (!q.beamed) { q.beamed = true; V.beam(q.x, q.y, 70, 520, HOLY, 0.55); }
    HF.impact(ctx, q.x, q.y, q.t / q.life, q.s || 1.8);
  }, 'glow');

  // swap the drawn sword for the Blender one: FX.add of 'vsword2' -> 'vsword3' while on
  const baseAdd = FX.add;
  FX.add = function (p) {
    if (p && p.type === 'vsword2' && HF.on && HF.ready()) { p.type = 'vsword3'; p.ph = Math.random(); p.life = Math.max(p.life, p.fall + 0.62); }
    return baseAdd.call(this, p);
  };
})();
