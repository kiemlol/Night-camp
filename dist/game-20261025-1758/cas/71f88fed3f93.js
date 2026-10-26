/* warlockfx.js — the Lantern Warlock in the Blender look the user picked (B, 2026-10-02: "วอล็อกตะเกียงด้วย"):
   cel colours with the game's dark outline, rendered by tools/blender/warlock_kit.py (assets/vfx3d/warlock/):
     soul fire    every teal flame (V.flame with the teal palettes: Soulfire's trail, Soulburn's flames, the class-3 teal
                  flames) plays a teal ghost-fire loop (the fire kit's flame, recoloured)
     ghosts       K.drawGhost in teal (the wisps, Spirit Parade's shots, the harvested souls, Soulfire's ghost) is a little
                  Blender ghost with eyes and a wavy hem, floating
     Soulfire     the ball is a lumpy teal fire ball with two eyes
     tethers      teal bolts (Soulburn, the lantern's bolts) are soul tethers: a wavy strand with a thin one wound round it
                  (a bolt skin for arcanefx.js's 'vbolt')
     Chains       'vchains' is cut from a row of Blender chain links, sagging from three anchors into the monster
     Death Hex    the mark over the monster is a Blender skull with glowing eyes
   The skills' numbers don't change. NC.WarlockFX.on = false: the old look. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, TAU = Math.PI * 2;
  if (!V || !K) return;
  const WF = (NC.WarlockFX = { on: true });
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const D = 'assets/vfx3d/warlock/';
  const A = { flame: load(D + 'soulflame.webp'), ghost: load(D + 'ghost.webp'), orb: load(D + 'soulorb.webp'), chain: load(D + 'chain.webp'), skull: load(D + 'skull.webp'),
    tbolt: [0, 1, 2, 3, 4, 5].map((i) => load(D + `tbolt_${i}.webp`)) };
  const FL = { W: 256, H: 384, gx: 128, gy: 316, h: 261, w: 176, n: 16, cols: 8 };
  const GH = { F: 192, n: 8, r: 48 }, ORB = { F: 160, n: 8, r: 42 }, CH = { W: 1024, H: 96, link: 64 }, SK = { F: 256, w: 160 };
  const TEAL = '90,235,215';
  const time = () => (NC.game && NC.game.time) || 0;

  // ---------------- soul fire ----------------
  const isTealPal = (pal) => pal && (pal[1] === '#5ae8d6' || pal[1] === '#5ff0d2');
  const baseFlame = V.flame;
  V.flame = function (ctx, x, y, w, h, ph, pal, a) {
    if (!WF.on || !isTealPal(pal) || !ok(A.flame)) return baseFlame.apply(this, arguments);
    if (a <= 0.01 || h < 2) return;
    const f = ((Math.floor(ph * 1.15) % FL.n) + FL.n) % FL.n, sx = (f % FL.cols) * FL.W, sy = Math.floor(f / FL.cols) * FL.H;
    const kx = (w * 1.5) / FL.w, ky = (h * 1.05) / FL.h;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.translate(x, y);
    if (Math.floor(ph * 0.37) & 1) ctx.scale(-1, 1);
    ctx.drawImage(A.flame, sx, sy, FL.W, FL.H, -FL.gx * kx, -FL.gy * ky, FL.W * kx, FL.H * ky);
    ctx.restore();
  };

  // ---------------- ghosts ----------------
  const baseGhost = K.drawGhost;
  K.drawGhost = function (ctx, x, y, s, t, rgb, a) {
    if (!WF.on || rgb !== TEAL || !ok(A.ghost)) return baseGhost.apply(this, arguments);
    a = a === undefined ? 1 : a;
    if (a <= 0.01) return;
    const f = ((Math.floor(t * 10) % GH.n) + GH.n) % GH.n, k = (s * 1.15) / GH.r;
    V.glow(ctx, x, y + s * 0.3, s * 2.6, rgb, 0.6 * a, false);
    ctx.save(); ctx.globalAlpha *= a;
    ctx.drawImage(A.ghost, f * GH.F, 0, GH.F, GH.F, x - (GH.F / 2) * k, y - (GH.F / 2) * k + s * 0.35, GH.F * k, GH.F * k);
    ctx.restore();
  };

  // ---------------- the Soulfire ball ----------------
  const baseOrb = K.drawOrb;
  K.drawOrb = function (ctx, x, y, r, rgb, core) {
    if (!WF.on || rgb !== TEAL || core !== '#e9fff8' || !ok(A.orb)) return baseOrb.apply(this, arguments);
    V.glow(ctx, x, y, r * 3, rgb, 0.8, true);
    const f = Math.floor(time() * 12 + x * 0.01) % ORB.n, k = (r * 1.3) / ORB.r;
    ctx.drawImage(A.orb, ((f % ORB.n) + ORB.n) % ORB.n * ORB.F, 0, ORB.F, ORB.F, x - (ORB.F / 2) * k, y - (ORB.F / 2) * k, ORB.F * k, ORB.F * k);
  };

  // ---------------- soul tethers (a bolt skin for arcanefx.js) ----------------
  if (NC.ArcaneFX && NC.ArcaneFX.skins) NC.ArcaneFX.skins.push({ test: (rgb) => rgb === TEAL, imgs: A.tbolt, on: () => WF.on && A.tbolt.every(ok) });

  // ---------------- Chains of the curse ----------------
  const lerp = (a, b, t) => a + (b - a) * t;
  // a straight piece of chain from (x0, y0) to (x1, y1): links cut from the strip (not stretched), w = link size
  function chainPiece(ctx, x0, y0, x1, y1, w, off) {
    const L = Math.hypot(x1 - x0, y1 - y0), k = w / CH.link, src = Math.min(CH.W - 2, L / k);
    if (L < 2) return;
    ctx.save(); ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0)); ctx.scale(k, k);
    ctx.drawImage(A.chain, off, 0, src, CH.H, 0, -CH.H / 2, src, CH.H);
    ctx.restore();
  }
  FX.def('vchains', (ctx, q, u) => {
    const e = q.e, a = V.fade(u, 0.1, 0.25);
    if (!e) return;
    ctx.save(); ctx.globalAlpha *= a;
    for (let k = 0; k < 3; k++) {
      const b = (k / 3) * TAU + 0.5, sx = e.x + Math.cos(b) * 70, sy = e.y + Math.sin(b) * 34, ex = e.x, ey = e.y - 40;
      if (WF.on && ok(A.chain)) {
        // grows out of the ground anchor in the first 0.15 s, sags a little in the middle, shivers
        const grow = Math.min(1, q.t / 0.15), mx = lerp(sx, ex, 0.5), my = lerp(sy, ey, 0.5) - 14 + Math.sin(q.t * 30 + k) * 1.5;
        const tx = lerp(sx, ex, grow), ty = lerp(sy, ey, grow);
        if (grow < 0.5) chainPiece(ctx, sx, sy, lerp(sx, mx, grow * 2), lerp(sy, my, grow * 2), 15, 0);
        else { chainPiece(ctx, sx, sy, mx, my, 15, 0); chainPiece(ctx, mx, my, tx, ty, 15, 0); }
        V.glow(ctx, sx, sy, 26, '190,120,255', 0.6, true);
        ctx.save(); ctx.translate(sx, sy); ctx.scale(1, V.SQ); ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); // (the anchor: a violet ring on the ground)
        ctx.lineWidth = 5; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#c79bff'; ctx.stroke(); ctx.restore();
        continue;
      }
      for (let i = 0; i < 7; i++) { // links (the drawn ones, copied from class2_skills_a.js)
        const t = (i + 0.5) / 7, x = lerp(sx, ex, t), y = lerp(sy, ey, t) - Math.sin(t * Math.PI) * 14;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(ey - sy, ex - sx) + (i % 2 ? Math.PI / 2 : 0));
        ctx.beginPath(); ctx.ellipse(0, 0, 8, 4.5, 0, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#c79bff'; ctx.stroke();
        ctx.restore();
      }
      V.glow(ctx, sx, sy, 20, '190,120,255', 0.5, true);
    }
    ctx.restore();
  }, 'glow');

  // ---------------- Death Hex: the skull ----------------
  const baseSkull = V.skull;
  V.skull = function (ctx, x, y, s, fill, a) {
    if (!WF.on || fill !== '#ff9ac8' || !ok(A.skull) || a <= 0.01) return baseSkull.apply(this, arguments);
    const k = (s * 1.25) / SK.w;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.drawImage(A.skull, x - (SK.F / 2) * k, y - (SK.F / 2) * k, SK.F * k, SK.F * k);
    ctx.restore();
  };
})();
