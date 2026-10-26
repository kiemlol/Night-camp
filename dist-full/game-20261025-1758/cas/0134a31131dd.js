/* barrierfx.js — the Paladin's shields as real barriers, rendered in Blender (2026-10-02, the user: "สกิลโล่ของพาลาดิน
   VFX ไม่สวยเลย เหมือนแผ่น ๆ กรอบ ใช้ Blender ทำเป็นเหมือนบาเรียได้ไหม"): tools/blender/barrier_kit.py ->
   assets/vfx3d/barrier/.
     Aegis     (pal_aegis) a gold dome of light over the hero: a bright rim, energy cells pulsing over it, a band of
               light sweeping up, rune chips turning round its foot; it pops up when cast, ripples from the front when
               it soaks a hit (NC.guardHit marks hitT), fades when the buff ends
     Reflect   (pal_reflect) the same barrier in sky blue
   The loop and the ripple are light on black, drawn 'lighter' (see-through); the navy outline is drawn normally.
   The Knight's Guard keeps its own drawn dome ('vdome'). NC.BarrierFX.on = false: the old look. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX;
  if (!FX || !V) return;
  const BF = (NC.BarrierFX = { on: true, R: 95 });
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const D = 'assets/vfx3d/barrier/';
  const A = { loop: load(D + 'loop.webp'), hit: load(D + 'hit.webp'), loop_sky: load(D + 'loop_sky.webp'), hit_sky: load(D + 'hit_sky.webp'), ink: load(D + 'ink.webp') };
  const M = { S: 384, loop: { frames: 16, cols: 4 }, hit: { frames: 8, cols: 4 }, gx: 192, gy: 291, r: 116 };
  const COL = { gold: '255,214,120', sky: '150,205,255' };
  BF.ready = () => ok(A.loop) && ok(A.hit) && ok(A.ink);
  // BF.debug (the VFX tutorial's comparisons only): { blend: 'source-over', frames: 4, res: 0.25, ink: false }
  BF.debug = null;
  const lowRes = {};
  const sheetAt = (img, res) => {   // the sheet scaled down and back (what a smaller render would look like)
    const key = img.src + res;
    if (!lowRes[key]) { const c = document.createElement('canvas'); c.width = img.width * res; c.height = img.height * res; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); lowRes[key] = c; }
    return lowRes[key];
  };
  const easeBack = (u) => { const c = 1.7; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
  const frame = (ctx, img, sheet, f, x, y, k) => {
    const S = M.S, sx = (f % sheet.cols) * S, sy = Math.floor(f / sheet.cols) * S, D = BF.debug;
    if (D && D.res) { const r = D.res; ctx.drawImage(sheetAt(img, r), sx * r, sy * r, S * r, S * r, x - M.gx * k, y - M.gy * k, S * k, S * k); return; }
    ctx.drawImage(img, sx, sy, S, S, x - M.gx * k, y - M.gy * k, S * k, S * k);
  };

  FX.def('pbarrier', (ctx, q) => {
    const p = q.follow;
    if (!p) return;
    const t = q.t, end = q.life - t, sky = q.tone === 'sky';
    // pops up (a little overshoot), fades and swells a touch at the end or when the buff is gone
    const gone = q.buff && !(p.buffs && p.buffs[q.buff] > 0);
    if (gone && !q.goneT) q.goneT = t;
    const out = q.goneT ? Math.min(1, (t - q.goneT) / 0.3) : end < 0.35 ? 1 - end / 0.35 : 0;
    if (q.goneT && out >= 1) { q.dead = true; return; }
    const inU = Math.min(1, t / 0.28);
    const hitU = q.hitT !== undefined ? (t - q.hitT) / 0.42 : 9;
    const kick = hitU < 1 ? Math.sin(Math.min(1, hitU * 2) * Math.PI) * 0.035 : 0;
    const scale = (0.55 + 0.45 * easeBack(inU)) * (1 + out * 0.08 + kick);
    const a = Math.min(1, inU * 1.6) * (1 - out);
    if (a <= 0.01) return;
    const k = (BF.R / M.r) * scale, x = p.x, y = p.y + 4;
    // the light under it
    V.glow(ctx, x, y - 60, 170 * scale, COL[q.tone], 0.16 * a + (hitU < 1 ? 0.25 * (1 - hitU) : 0), false);
    // the navy outline (normal blending), then the light ('lighter')
    ctx.save();
    ctx.globalAlpha *= a * 0.5;
    if (ok(A.ink) && !(BF.debug && BF.debug.ink === false)) ctx.drawImage(A.ink, x - M.gx * k, y - M.gy * k, M.S * k, M.S * k);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = (BF.debug && BF.debug.blend) || 'lighter';
    ctx.globalAlpha *= a * 0.85 * (inU < 1 ? 1 + (1 - inU) * 0.5 : 1);
    let lf = Math.floor(t * 14) % M.loop.frames;
    if (BF.debug && BF.debug.frames) { const st = M.loop.frames / BF.debug.frames; lf = Math.floor(lf / st) * st; }
    frame(ctx, sky ? A.loop_sky : A.loop, M.loop, lf, x, y, k);
    ctx.globalAlpha *= 0.7;   // (the ripple: bright, but the hero stays readable)
    if (hitU < 1) frame(ctx, sky ? A.hit_sky : A.hit, M.hit, Math.min(M.hit.frames - 1, Math.floor(hitU * M.hit.frames)), x, y, k);
    ctx.restore();
  }, 'glow');

  // a barrier over the hero for `dur` seconds (tone 'gold' | 'sky'); `buff`: it ends with that buff
  BF.add = function (game, p, dur, tone, buff) {
    if (p.barrierFx && !p.barrierFx.dead && p.barrierFx.tone === tone) p.barrierFx.dead = true;
    const q = FX.add({ type: 'pbarrier', follow: p, x: p.x, y: p.y, life: dur, tone: tone || 'gold', buff });
    p.barrierFx = q;
    const rgb = COL[q.tone];
    V.sparks(p.x, p.y - 70, 14, rgb, { size: 0.9 });
    V.light(p.x, p.y - 60, 300, rgb, 0.6, dur, { follow: p });
    V.flash(q.tone === 'sky' ? '200,230,255' : '255,240,190', 0.08, 0.25);
    return q;
  };

  // a hit under the barrier: the barrier ripples and sparks (no flat ring on the ground, the Knight's Guard keeps its own)
  const baseGuardHit = NC.guardHit;
  NC.guardHit = function (game, p) {
    const q = p.guardFx;
    if (!q || (q.origType || q.type) !== 'pbarrier' || q.dead) return baseGuardHit && baseGuardHit.apply(this, arguments); // (the knight line's light skin renames it 'lk': js/lightkit.js swap)
    if (q.hitT === undefined || q.t - q.hitT > 0.2) q.hitT = q.t;
    V.sparks(p.x, p.y - 80, 6, COL[q.tone], { size: 0.8 });
  };
  // Reflect: the sky barrier (Aegis is wired in class2_skills_a.js's RUN.pal_aegis)
  if (NC.skillCasts) NC.skillCasts.push((game, p, id) => {
    if (!BF.on || id !== 'pal_reflect' || !BF.ready() || !(p.buffs && p.buffs.pal_reflect > 0)) return;
    BF.add(game, p, p.buffs.pal_reflect, 'sky', 'pal_reflect');
  });
  // a hit soaked by Reflect ripples its barrier too (Aegis: NC.guardHit marks p.guardFx)
  if (NC.heroGuards) NC.heroGuards.push((game, p, dmg) => {
    const q = p.barrierFx;
    if (q && !q.dead && q.tone === 'sky' && p.buffs && p.buffs.pal_reflect > 0 && (q.hitT === undefined || q.t - q.hitT > 0.2)) q.hitT = q.t;
    return dmg;
  });
})();
