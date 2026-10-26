/* arcanefx.js — the Archmage in the Blender look the user picked for the ice and fire (B, 2026-10-02: "ลองทำอาร์คเมจด้วย"):
   cel colours with the game's dark outline, rendered by tools/blender/arcane_kit.py (assets/vfx3d/arcane/):
     lightning    every blue lightning bolt (FX 'vbolt': Chain Lightning, Lord of Thunder, the frozen-lightning fusion, the
                  Mage's thunder, ...) is a Blender bolt stretched between its two ends, flickering through 6 shapes
     orbs         the element orbs (am_orbs, am_trinity, their shots, the arcane flux shots) are Blender orbs that turn:
                  fire = a lumpy fireball, water = an ice gem, wind = a sun with two rings, earth = a rock; the moon
                  missiles (am_missile) are little cratered moons
     am_eclipse   a Blender dark sun: the disc with a gold rim and two coronas of spikes turning opposite ways
     am_gravity   a Blender gravity well: three violet spiral arms round a black hole, lying on the ground
     am_firepillar  a Blender fire-tornado column (assets/vfx3d/fire/pillar.webp), same hits
     cloud        Lord of Thunder's storm cloud is made of Blender cloud puffs
     fusions      fire+wind: the fire-tornado column walks onto the spot; earth+water: the falling glacier
                  slab is the Blender ice block (jobs3_archmage.js asks NC.ArcaneFX.tornado / .slab)
   The skills' numbers don't change. NC.ArcaneFX.on = false: the old look. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, TAU = Math.PI * 2;
  if (!V || !K) return;
  const AF = (NC.ArcaneFX = { on: true, skins: [] }); // skins: other bolt looks by colour ({ test(rgb), imgs, on() }, warlockfx.js)
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const D = 'assets/vfx3d/arcane/';
  const A = { bolt: [0, 1, 2, 3, 4, 5].map((i) => load(D + `bolt_${i}.webp`)), cloud: [0, 1, 2].map((i) => load(D + `cloud_${i}.webp`)),
    orb: { fire: load(D + 'orb_fire.webp'), water: load(D + 'orb_water.webp'), wind: load(D + 'orb_wind.webp'), earth: load(D + 'orb_earth.webp'), moon: load(D + 'orb_moon.webp') },
    disc: load(D + 'eclipse_disc.webp'), corona: load(D + 'eclipse_corona.webp'), vortex: load(D + 'vortex.webp'),
    block: load('assets/vfx3d/frost/block.webp'), pillar: load('assets/vfx3d/fire/pillar.webp') };
  const BOLT = { W: 1024, H: 192, edge: 41 }, ORB = { F: 160, n: 8, r: 44 };
  const time = () => (NC.game && NC.game.time) || 0;

  // ---------------- lightning ----------------
  // blue-white bolts only (a green or gold bolt keeps the drawn look)
  const blueish = new Map();
  const isBlue = (rgb) => {
    if (!blueish.has(rgb)) { const c = String(rgb).split(',').map(Number); blueish.set(rgb, c.length === 3 && c[2] >= 200 && c[0] <= 200 && c[1] >= 180); }
    return blueish.get(rgb);
  };
  AF.bolt = function (ctx, x0, y0, x1, y1, w, rgb, a, seed) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 4 || a <= 0.01) return;
    const sk = AF.skins.find((k) => k.on() && k.test(rgb)), v = ((seed % 6) + 6) % 6, im = (sk ? sk.imgs : A.bolt)[v];
    if (!ok(im)) return false;
    const sx = L / BOLT.W, sy = Math.max(0.5, Math.min(0.95, L / 800)) * Math.max(0.75, (w || 7) / 7);
    V.glow(ctx, x1, y1, 60 + w * 6, rgb, 0.7 * a, true);
    ctx.save(); ctx.globalAlpha *= a;
    ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0)); ctx.scale(sx, (seed >> 3) & 1 ? -sy : sy);
    ctx.drawImage(im, 0, -BOLT.H / 2);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.22; // (the bolt glows)
    ctx.drawImage(im, 0, -BOLT.H / 2);
    ctx.restore();
    return true;
  };
  FX.def('vbolt', (ctx, p, u) => {
    const a = (p.a || 1) * (u < 0.1 ? 1 : 1 - (u - 0.1) / 0.9) * (0.75 + 0.25 * Math.sin(p.t * 90));
    const seed = Math.floor(p.t * 28) + p.seed;
    if (((AF.on && isBlue(p.rgb)) || AF.skins.some((k) => k.on() && k.test(p.rgb))) && AF.bolt(ctx, p.x0, p.y0, p.x, p.y, p.w || 7, p.rgb, a, seed) !== false) return;
    V.bolt(ctx, V.boltPoints(p.x0, p.y0, p.x, p.y, p.seg || 12, p.jag || 40, seed), p.w || 7, p.rgb, a);
  }, 'glow');

  // ---------------- element orbs ----------------
  const ORB_OF = { '255,140,60': 'fire', '150,215,255': 'water', '120,220,255': 'water', '255,236,120': 'wind', '205,160,110': 'earth', '140,190,255': 'moon' };
  const baseOrb = K.drawOrb;
  K.drawOrb = function (ctx, x, y, r, rgb, core) {
    const el = AF.on && ORB_OF[rgb], im = el && A.orb[el];
    if (!im || !ok(im)) return baseOrb.apply(this, arguments);
    V.glow(ctx, x, y, r * 3, rgb, 0.75, true);
    const f = Math.floor(time() * 14 + x * 0.01) % ORB.n, k = (r * 1.25) / ORB.r;
    ctx.drawImage(im, ((f % ORB.n) + ORB.n) % ORB.n * ORB.F, 0, ORB.F, ORB.F, x - (ORB.F / 2) * k, y - (ORB.F / 2) * k, ORB.F * k, ORB.F * k);
  };

  // ---------------- Lord of Thunder's cloud ----------------
  const baseBlob = V.blob;
  V.blob = function (ctx, x, y, r, seed, fill, a, hi) {
    const im = AF.on && fill === '#3a4468' && hi === '#58648e' && A.cloud[((seed | 0) % 3 + 3) % 3];
    if (!im || !ok(im) || a <= 0.01) return baseBlob.apply(this, arguments);
    const k = (r * 2.6) / 210;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.drawImage(im, x - 128 * k, y - 96 * k, 256 * k, 192 * k);
    ctx.restore();
  };

  // ---------------- the fire-tornado column (the same art as firefx.js's, kept here: firefx.js is unhooked) ----------------
  const PI = { F: 512, gx: 256, gy: 401, n: 24, cols: 6 }, FIRE_RGB = V.RGB.fire;
  FX.def('afPillar', (ctx, p) => {
    if (!ok(A.pillar)) return;
    const f = Math.floor(p.t * 30) % PI.n, sx = (f % PI.cols) * PI.F, sy = Math.floor(f / PI.cols) * PI.F, k = p.k;
    const u = p.t / p.life, rise = Math.min(1, p.t / 0.12), a = u > 0.7 ? (1 - u) / 0.3 : 1;
    if (a <= 0) return;
    V.glow(ctx, p.x, p.y - 150 * k, 170 * k, FIRE_RGB, 0.55 * a, true);
    ctx.save(); ctx.globalAlpha *= a;
    ctx.translate(p.x, p.y); ctx.scale(k, k * (0.4 + 0.6 * rise));
    ctx.drawImage(A.pillar, sx, sy, PI.F, PI.F, -PI.gx, -PI.gy, PI.F, PI.F);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35;
    ctx.drawImage(A.pillar, sx, sy, PI.F, PI.F, -PI.gx, -PI.gy, PI.F, PI.F);
    ctx.restore();
  }, 'glow');

  // ---------------- fusions (asked by jobs3_archmage.js) ----------------
  // fire+wind: the fire-tornado column follows z (the spot it walks along) for life seconds
  AF.tornado = function (z, life) {
    if (!AF.on || !ok(A.pillar)) return false;
    FX.add({ type: 'afPillar', layer: 'glow', x: z.x, y: z.y, k: 1.15, life, update(q) { q.x = z.x; q.y = z.y; } });
    return true;
  };
  // earth+water: the falling slab is the Blender ice block, turned on its side and spinning a little
  AF.slab = function (ctx, q) {
    if (!AF.on || !ok(A.block)) return false;
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(-0.5 + q.t * 0.8);
    ctx.drawImage(A.block, -160 * 0.62, -200 * 0.62, 320 * 0.62, 400 * 0.62);
    ctx.restore();
    return true;
  };
  // ---------------- Eclipse: the dark sun ----------------
  const ECL = { F: 512, r: 128 };
  FX.def('veclipse', (ctx, q, u) => {
    const a = V.fade(u, 0.15, 0.1), R = 110 * V.easeOut(Math.min(1, q.t / 0.8)), x = q.x, y = q.y - 330;
    if (!AF.on || !ok(A.disc) || !ok(A.corona)) { // (the drawn one, copied from class2_skills_a.js)
      V.glow(ctx, x, y, R * 3.2, '255,170,60', 0.8 * a, true);
      ctx.save(); ctx.globalAlpha *= a; ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) {
        const b = (i / 18) * TAU + q.t * 0.8, l = R * (1.3 + 0.25 * Math.sin(q.t * 7 + i * 2));
        ctx.beginPath(); ctx.moveTo(x + Math.cos(b - 0.08) * R, y + Math.sin(b - 0.08) * R); ctx.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l); ctx.lineTo(x + Math.cos(b + 0.08) * R, y + Math.sin(b + 0.08) * R);
        ctx.fillStyle = 'rgba(255,200,90,0.7)'; ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fillStyle = '#16121e'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffd36a'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x - R * 0.25, y - R * 0.2, R * 0.3, 0, TAU); ctx.fillStyle = 'rgba(80,70,110,0.5)'; ctx.fill();
      ctx.restore();
      return;
    }
    if (R < 2) return;
    const k = R / ECL.r, pulse = 1 + 0.06 * Math.sin(q.t * 7);
    V.glow(ctx, x, y, R * 3.4, '255,170,60', 0.85 * a, true);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y);
    const corona = (rot, s, alpha, add) => {
      ctx.save(); ctx.rotate(rot); ctx.scale(k * s, k * s); ctx.globalAlpha *= alpha; if (add) ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(A.corona, -ECL.F / 2, -ECL.F / 2); ctx.restore();
    };
    corona(-q.t * 0.5 + 0.17, 1.18 * pulse, 0.55, true); // (a second, bigger corona behind, glowing)
    corona(q.t * 0.35, pulse, 1, false);
    ctx.drawImage(A.disc, -ECL.F / 2 * k, -ECL.F / 2 * k, ECL.F * k, ECL.F * k);
    ctx.restore();
  }, 'glow');

  // ---------------- Gravity: a well of spiral arms on the ground ----------------
  const VOR = { F: 512, r: 233 };
  FX.def('vhole', (ctx, q, u) => {
    const a = V.fade(u, 0.1, 0.15), R = q.r;
    if (!AF.on || !ok(A.vortex)) { // (the drawn one, copied from class2_skills_a.js)
      ctx.save(); ctx.translate(q.x, q.y - 20); ctx.scale(1, V.SQ);
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.rotate(-q.t * (2.4 + i * 0.6) + i * 2.1);
        ctx.beginPath();
        for (let k = 0; k <= 30; k++) { const t = k / 30, rr = R * (1 - t * 0.9), b = t * 5; ctx.lineTo(Math.cos(b) * rr, Math.sin(b) * rr); }
        ctx.strokeStyle = `rgba(190,120,255,${0.55 * a})`; ctx.lineWidth = 10 - i * 2; ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, R * 0.28, 0, TAU); ctx.fillStyle = `rgba(10,6,20,${0.95 * a})`; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = `rgba(230,200,255,${0.9 * a})`; ctx.stroke();
      ctx.restore();
      V.glow(ctx, q.x, q.y - 20, R * 1.4, '190,120,255', 0.35 * a, false, V.SQ);
      return;
    }
    const k = (R * 1.05) / VOR.r * (0.85 + 0.15 * V.easeOut(Math.min(1, q.t / 0.4)));
    V.glow(ctx, q.x, q.y - 20, R * 1.5, '190,120,255', 0.45 * a, false, V.SQ);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(q.x, q.y - 20); ctx.scale(1, V.SQ);
    ctx.save(); ctx.rotate(q.t * 2.4); ctx.scale(k, k); ctx.drawImage(A.vortex, -VOR.F / 2, -VOR.F / 2); ctx.restore();
    ctx.save(); ctx.rotate(q.t * 4 + 1); ctx.scale(k * 0.55, k * 0.55); ctx.globalAlpha *= 0.5; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(A.vortex, -VOR.F / 2, -VOR.F / 2); ctx.restore();
    ctx.restore();
  }, 'low');

  // ---------------- Pillar of Fire (the Archmage's): the fire-tornado column ----------------
  const RUN = NC.SKILL_RUN, FIRE = V.RGB.fire;
  const basePillar = RUN && RUN.am_firepillar;
  if (basePillar) RUN.am_firepillar = function (game, p, lv) {
    if (!AF.on || !ok(A.pillar)) return basePillar.apply(this, arguments);
    K.pose(game, p, K.clip(p, 'bolt', 0), 0.3);
    const e0 = K.target(game, p, 560);
    let [tx, ty] = e0 ? [e0.x, e0.y] : K.ground(game, p, 420);
    for (let i = 0; i < 3; i++) V.at(0.15 + i * 0.25, () => {
      if (e0 && K.alive(e0)) { tx = e0.x; ty = e0.y; }
      V.circle(tx, ty, 90, FIRE, 0.4, { style: 'arcane', spin: 3 });
      FX.add({ type: 'afPillar', layer: 'glow', x: tx, y: ty, k: 1.2, life: 0.6 });
      for (let k = 0; k < 3; k++) V.flameAt(tx + NC.rand(-30, 30), ty + NC.rand(-8, 8), NC.rand(34, 48), NC.rand(70, 120), V.PAL.fire, NC.rand(0.35, 0.5), { vy: -120 });
      V.light(tx, ty - 60, 360, FIRE, 1, 0.4, { flick: true });
      V.shake(game, 4);
      for (const e of K.around(game, tx, ty, 110)) K.hit(game, p, 'am_firepillar', e, 0, -140, '255,170,90');
    });
  };
})();
