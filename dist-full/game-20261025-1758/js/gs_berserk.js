/* gs_berserk.js — the berserker greatsword (ดาบใหญ่เหล็กโทสะ, 2026-10-04): a colossal slab of raw iron painted with an
   artist's six-pass method (assets/gen/make_bossgs_prompts.py), and its red cracks GLOW (the user: "ลองแต่งดาบให้มีแสง
   ตามรอยแดง ใช้ bloom ดีไหม"): two light layers made by tools/veinglow.py are drawn over the sword with 'lighter':
     gs_berserk_vein.png   the cracks themselves pushed hotter (red -> orange -> a pale core)
     gs_berserk_bloom.png  the bloom: those cracks blurred into a halo that spills past the outline (PAD px bigger)
   They beat like a slow heart (two quick pulses, a rest), flare while the sword swings, and small embers rise from the
   cracks. A TEST item for now: not in the collection or the drops; try it with ?equip=gs_berserk.
   Load after greatswords.js (and wfx.js). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, FX = NC.FX;
  const ID = 'gs_berserk', DIR = 'assets/greatswords/';
  const PAD = 28;                                          // (tools/veinglow.py --pad)
  // vein points the embers rise from (sprite fractions, from tools/veinglow.py)
  const PTS = [[0.209, 0.575], [0.736, 0.527], [0.191, 0.043], [0.2, 0.302], [0.2, 0.082], [0.182, 0.294], [0.209, 0.233], [0.227, 0.066], [0.736, 0.169], [0.736, 0.535], [0.236, 0.105], [0.245, 0.325], [0.727, 0.517], [0.209, 0.041], [0.218, 0.064], [0.264, 0.051]];

  // ---------------- the sprite and the item ----------------
  NC.ASSET_MANIFEST[ID] = { src: DIR + ID + '.png', w: 60.8, h: 216, ax: 0.491, ay: 1.0 };
  const base = ITEMS.gs_lavadragon || ITEMS.greatsword;
  if (!base) return;
  const W = Object.assign({}, base, { id: ID, sprite: ID, name: 'ดาบใหญ่เหล็กโทสะ', grip: 0.199, element: 'neutral',
    desc: 'แผ่นเหล็กดิบที่ใหญ่เกินกว่าจะเรียกว่าดาบ รอยแตกสีเลือดเรืองเต้นเป็นจังหวะ (ไอเทมทดสอบ)' });
  delete W.gs; delete W.inst;                             // (no tier effects of wfx.js: this sword glows its own way)
  ITEMS[ID] = W;
  const L = { vein: new Image(), bloom: new Image() };
  L.vein.src = DIR + ID + '_vein.png'; L.bloom.src = DIR + ID + '_bloom.png';

  // ---------------- the beat ----------------
  // two quick pulses then a rest (1.3 s), brighter while the hero swings
  function beat(t, swinging) {
    const c = t % 1.3;
    const pulse = (x, at, w) => Math.exp(-(((x - at) / w) ** 2));
    const b = 0.42 + 0.58 * Math.max(pulse(c, 0.12, 0.09), 0.7 * pulse(c, 0.36, 0.1));
    return swinging ? Math.min(1.35, b + 0.55) : b;
  }

  // ---------------- drawn over the sword, in its own frame ----------------
  // At night the game draws its darkness over the world AFTER the hero, so a glow drawn with the sword would be dimmed.
  // So the sword's frame is remembered when it is drawn, and the bloom + the hot cracks are drawn again after the
  // lighting (NC.drawTrail runs there), at full strength; a small red light also warms the ground round the hero.
  const H = { hero: null, inv: null, t: 0, emberT: 0, frames: [] };
  const baseDP = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game.player;
    if (!p || p.equip.weapon !== ID) return baseDP.apply(this, arguments);
    H.hero = p; H.t = game.time; H.inv = ctx.getTransform().inverse();
    try { return baseDP.apply(this, arguments); } finally { H.hero = null; }
  };
  function layers(ctx, f, a) {
    const { ox, oy, w, h, px } = f;
    ctx.globalCompositeOperation = 'lighter';
    if (!(NC.GlowFX || {}).noBloom && L.bloom.complete && L.bloom.naturalWidth) {
      // the halo twice: as baked, and stretched wider and softer (at game size the baked one alone is too small to see)
      const g1 = PAD * px, g2 = PAD * px * 2.2;
      for (let left = a * 1.4; left > 0.01; left -= 1) { ctx.globalAlpha = Math.min(1, left); ctx.drawImage(L.bloom, ox - g1, oy - g1, w + 2 * g1, h + 2 * g1); }
      ctx.globalAlpha = Math.min(1, 0.55 * a); ctx.drawImage(L.bloom, ox - g2, oy - g2 * 0.6, w + 2 * g2, h + 1.2 * g2);
    }
    ctx.globalAlpha = Math.min(1, 0.6 + 0.4 * a);
    ctx.drawImage(L.vein, ox, oy, w, h);
    if (a > 0.9) { ctx.globalAlpha = Math.min(1, a - 0.9); ctx.drawImage(L.vein, ox, oy, w, h); }
  }
  const baseDW = NC.drawWeapon;
  NC.drawWeapon = function (ctx, Wd, hx, hy, ang, o) {
    baseDW.apply(this, arguments);
    o = o || {};
    const G = NC.GlowFX || {};                              // (js/ironrage.js: switches for the making-of video)
    if (!Wd || Wd.id !== ID || o.silhouette || o.sayaOnly || G.off || !L.vein.complete || !L.vein.naturalWidth) return;
    const s = NC.SPR[ID];
    if (!s) return;
    const p = H.hero, t = p ? H.t : performance.now() / 1000;
    const swinging = !!(p && p.atk && p.atk.on) && !G.noSwing;
    const k = (o.scale || 1) * 0.95, w = s.w * k, h = s.h * k, grip = o.grip === undefined ? Wd.grip : o.grip;
    const f = { ox: -s.ax * w, oy: -h * (1 - grip), w, h, px: w / L.vein.naturalWidth };
    const a = G.noBeat ? (swinging ? 1.2 : 0.75) : beat(t, swinging);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang + Math.PI / 2);
    if (o.len !== undefined && o.len !== 1) ctx.scale(1, o.len);
    if (p && !G.early) {
      // the hero's sword in the world: remembered for the pass after the lighting
      f.m = ctx.getTransform(); f.a = a; H.frames.push(f);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(L.vein, f.ox, f.oy, w, h);
    } else layers(ctx, f, a);                               // (a window, a portrait: drawn right here)
    // embers rising from the cracks (the point taken to the world, where they drift up on their own)
    if (p && H.inv && t > H.emberT) {
      H.emberT = t + (swinging ? 0.03 : 0.12);
      const q = PTS[(Math.random() * PTS.length) | 0];
      const dp = ctx.getTransform().transformPoint(new DOMPoint(f.ox + q[0] * w, f.oy + q[1] * h));
      const wp = H.inv.transformPoint(dp);
      if (!G.noEmbers) ember(wp.x, wp.y, swinging);
      if (!G.noLight) warm(p, a);
    }
    ctx.restore();
  };
  // after the lighting: the remembered frames at full strength
  const baseTrail = NC.drawTrail;
  NC.drawTrail = function (ctx, game) {
    if (H.frames.length) {
      ctx.save();
      for (const f of H.frames) { ctx.setTransform(f.m); layers(ctx, f, f.a); }
      ctx.restore();
      H.frames.length = 0;
    }
    return baseTrail.apply(this, arguments);
  };
  // a soft red light round the hero that beats with the cracks (fx.js ages it; refreshed while the sword is out)
  let light = null;
  function warm(p, a) {
    if (!light || !FX.lights.includes(light)) { light = { x: p.x, y: p.y - 40, r: 190, rgb: '255,55,35', a: 0, life: 0.5, t: 0, follow: p, oy: -40 }; FX.lights.push(light); }
    light.a = 0.35 + 0.4 * Math.min(1, a); light.t = 0.05;
  }
  function ember(x, y, hot) {
    FX.add({ type: 'custom', layer: 'glow', x, y, life: NC.rand(0.5, 1.0), vx: NC.rand(-14, 14), vy: -NC.rand(30, hot ? 90 : 55), drag: 0.6,
      r: NC.rand(1.2, hot ? 2.6 : 2.0),
      draw(ctx, q, u) {
        const al = (1 - u) * (u < 0.15 ? u / 0.15 : 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,${(90 + 110 * (1 - u)) | 0},60,${al})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 - 0.4 * u), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,60,40,${al * 0.25})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r * 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } });
  }
  NC.GsBerserk = { beat, layers: L };
})();
