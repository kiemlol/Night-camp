/* uberfx_pillar.js — the fire mage's เสาเพลิง (fm_pillar) drawn with the UBER FX shader (js/uberfx.js), a test to set
   against the look it has now (2026-10-20). The skill keeps all its own code and numbers (jobs3_skills_a.js: targets,
   timing, hits, the Lv 10 floor of fire); it runs in a skin (LK.reskin) where its code-drawn pieces become these instead:
     V.circle (one per eruption)  -> the eruption: a column of fire (flame streaks scrolling up through a column mask, the
                                     uv bent by noise, dissolving from the top with a burning edge, a glow pass), three
                                     flame tongues round it, a polar ring of fire swirling out on the ground, a shock
                                     ring, a cracked lava glow under it, a flare, embers and dark smoke rising
     V.flameAt                    -> nothing (the column has them) / the Lv 10 floor's flames: small tongues
     V.glowAt                     -> nothing / the Lv 10 floor: a lava pool on the ground
   Everything else (hit sparks, burns, the cast circle) goes on through the fire mage's light skin (js/magelight.js).
   Switch: ?uberfx=1 (or NC.UberPillar.on = true); without it the skill looks as before. Load after js/magelight.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, UF = NC.UberFX, LK = NC.LightKit, RUN = NC.SKILL_RUN;
  if (!FX || !V || !UF || !LK || !RUN || !RUN.fm_pillar) return;
  const UP = (NC.UberPillar = { on: false });
  const rand = NC.rand, PI = Math.PI, SQ = V.SQ || 0.58;
  const MAN = UF.MAN;
  const NZC = MAN.uf_noise_c ? 'uf_noise_c' : 'uf_noise_a';
  const isFM = (p) => !!p && (p.job === 'firemage' || p.job === 'starcore' || (NC.isJob ? NC.isJob(p, 'firemage') : false));
  const NEED = ['uf_noise_a', 'uf_noise_b', 'uf_column', 'uf_tongue', 'uf_ring', 'uf_shock', 'uf_glow', 'uf_flare', 'uf_ramp_fire'];
  UP.live = () => UP.on && UF.ok() && UF.ready.apply(null, NEED);

  // ---------------- materials ----------------
  const FIRE = 'uf_ramp_fire';
  const M = (UP.M = {
    core: UF.mat({ main: 'uf_noise_b', tile: [0.75, 0.5], scroll: [0, 2.6], pow: 1.35, mask: 'uf_column', maskDistort: 0.6,
      distort: 'uf_noise_a', distTile: [1.2, 0.8], distScroll: [0.1, 1.7], distAmt: 0.09, distRoot: 1,
      dissolve: 'uf_noise_a', disTile: [1.4, 1.0], edge: 0.1, soft: 0.04, edgeCol: [1.7, 0.62, 0.12],
      ramp: FIRE, rampK: 1.3, rampOff: -0.06, expo: 1.3 }),
    // (a wider, dimmer body of cloudy fire behind the streaks: the column has volume, not only strands)
    body: UF.mat({ main: 'uf_noise_a', tile: [0.8, 0.5], scroll: [0.03, 1.5], pow: 1.2, mask: 'uf_column', maskDistort: 0.8,
      distort: 'uf_noise_b', distTile: [0.8, 0.6], distScroll: [0, 1.2], distAmt: 0.1, distRoot: 1,
      dissolve: 'uf_noise_a', disTile: [1.2, 0.9], edge: 0.08, soft: 0.05, edgeCol: [1.2, 0.4, 0.08],
      ramp: FIRE, rampK: 1.05, rampOff: -0.04, expo: 1.2 }),
    tongue: UF.mat({ main: 'uf_noise_a', tile: [0.9, 0.6], scroll: [0, 1.9], mask: 'uf_tongue', maskDistort: 1,
      distort: 'uf_noise_b', distTile: [1, 0.7], distScroll: [0, 1.4], distAmt: 0.1, distRoot: 1,
      dissolve: 'uf_noise_a', disTile: [1.6, 1.2], edge: 0.09, soft: 0.04, edgeCol: [1.6, 0.55, 0.1],
      ramp: FIRE, rampK: 1.35, rampOff: -0.05, expo: 1.25 }),
    ring: UF.mat({ main: 'uf_noise_a', polar: true, tile: [3, 1.5], scroll: [0.22, -1.0], twist: 0.35, mask: 'uf_ring',
      distort: 'uf_noise_a', distTile: [1.5, 1.5], distScroll: [0.2, 0.2], distAmt: 0.03,
      dissolve: 'uf_noise_a', disTile: [2, 2], edge: 0.08, soft: 0.03, edgeCol: [1.5, 0.5, 0.08],
      ramp: FIRE, rampK: 1.8, expo: 1.2 }),
    shock: UF.mat({ main: 'uf_shock', pow: 2.2, distort: 'uf_noise_a', distTile: [2, 2], distAmt: 0.025,
      dissolve: 'uf_noise_a', disTile: [2.2, 2.2], edge: 0.06, soft: 0.03, edgeCol: [1.2, 0.45, 0.08],
      ramp: FIRE, rampK: 1.25, expo: 1.1 }),
    pool: UF.mat({ main: NZC, tile: [1.5, 1.5], scroll: [0, 0.04], pow: 1.4, mask: 'uf_glow', maskDistort: 0.3,
      distort: 'uf_noise_a', distTile: [1.2, 1.2], distScroll: [0.05, 0.1], distAmt: 0.025,
      dissolve: 'uf_noise_a', disTile: [1.8, 1.8], edge: 0.06, soft: 0.03, edgeCol: [1.3, 0.4, 0.06],
      ramp: FIRE, rampK: 1.6, rampOff: -0.04, expo: 1.15 }),
    smoke: UF.mat({ main: 'uf_noise_a', tile: [0.8, 0.8], scroll: [0.02, 0.35], pow: 0.9, mask: 'uf_glow', maskDistort: 1,
      distort: 'uf_noise_a', distTile: [1, 1], distScroll: [0, 0.6], distAmt: 0.12,
      dissolve: 'uf_noise_a', disTile: [1.3, 1.3], edge: 0, soft: 0.14, cover: 0.9, add: false }),
    flare: UF.mat({ main: 'uf_flare', expo: 1.1 }),
    glow: UF.mat({ main: 'uf_glow', expo: 1.0 }),
    ember: UF.mat({ main: 'uf_glow', expo: 1.3 }),
  });

  // ---------------- over-life curves (baked) ----------------
  const C = UF.curve;
  const K = (UP.C = {
    coreH: C([[0, 0.12], [0.13, 1.08], [0.24, 1], [1, 1.04]], 48),
    coreW: C([[0, 0.45], [0.11, 1.12], [0.4, 0.96], [1, 0.6]], 48),
    coreK: C([[0, 1.7], [0.14, 1.4], [0.5, 1.15], [1, 0.9]], 48),
    coreA: C([[0, 0], [0.04, 1], [0.82, 1], [1, 0]], 48),
    coreD: C([[0, 0], [0.38, 0.04], [1, 1]], 48, 'smooth'),
    tongH: C([[0, 0.2], [0.18, 1.06], [0.35, 1], [1, 0.9]], 48),
    tongD: C([[0, 0], [0.3, 0.05], [1, 1]], 48, 'smooth'),
    ringR: C([[0, 0.42], [0.3, 0.96], [1, 1.16]], 48, 'smooth'),
    ringA: C([[0, 0], [0.06, 1], [0.7, 0.85], [1, 0]], 48),
    ringD: C([[0, 0], [0.3, 0.08], [1, 1]], 48, 'smooth'),
    shockR: C([[0, 0.3], [1, 1.7]], 32, 'smooth'),
    shockA: C([[0, 1], [0.5, 0.6], [1, 0]], 32),
    poolA: C([[0, 0], [0.08, 1], [0.6, 0.8], [1, 0]], 48),
    poolD: C([[0, 0], [0.45, 0.1], [1, 1]], 48, 'smooth'),
    flareS: C([[0, 0.3], [0.25, 1.25], [1, 1.5]], 32),
    flareA: C([[0, 1], [0.2, 0.9], [1, 0]], 32),
    smokeS: C([[0, 0.6], [1, 1.5]], 32),
    smokeA: C([[0, 0], [0.18, 1], [0.6, 0.7], [1, 0]], 32),
    smokeD: C([[0, 0.1], [1, 0.95]], 32, 'smooth'),
  });
  const at = UF.at;
  const sub = (u, a, b) => (u - a) / (b - a);   // a share of the life (a piece that starts late, or ends early)

  // ---------------- one eruption ----------------
  const LIFE = 0.95;
  function eruption(x, y, first) {
    const s0 = rand(0, 9), R = 118, H0 = 330, W0 = 128;
    const tongues = [-1, 0, 1].map((k) => ({ dx: k * rand(26, 34) + rand(-6, 6), h: (k ? rand(150, 190) : rand(210, 240)), w: k ? rand(70, 84) : rand(92, 104), d: 0.02 + Math.abs(k) * 0.04 + rand(0, 0.03), flip: Math.random() < 0.5, seed: rand(0, 9) }));
    // the ground: lava cracks glowing, the ring swirling out, the shock ring
    UF.fx({ x, y, life: LIFE, layer: 'low', draw(qq, u) {
      UF.quad('low', M.pool, x, y + 2, R * 2.1, R * 2.1, 0, { squash: SQ, a: at(K.poolA, u) * 0.9, k: 1.05, dis: at(K.poolD, u), seed: s0 });
      const ur = sub(u, 0, 0.72);
      if (ur < 1) { const r = R * at(K.ringR, ur); UF.quad('low', M.ring, x, y, r * 2, r * 2, 0, { squash: SQ, a: at(K.ringA, ur), k: 1.1, dis: at(K.ringD, ur), seed: s0 + 3, glow: 0.35 }); }
      const us = sub(u, 0, 0.32);
      if (us < 1) { const r = R * at(K.shockR, us); UF.quad('low', M.shock, x, y, r * 2, r * 2, 0, { squash: SQ, a: at(K.shockA, us) * 0.75, k: 1.1, dis: us * 0.9, seed: s0 + 5 }); }
    } });
    // the column, its tongues, a flare and a soft glow round its foot
    UF.fx({ x, y, life: LIFE, layer: 'glow', draw(qq, u) {
      const ug = sub(u, 0, 0.8);
      if (ug < 1) UF.quad('glow', M.glow, x, y - 70, 330, 300, 0, { a: Math.min(1, ug * 12) * (1 - ug) * 0.32, tint: [0.9, 0.3, 0.06], k: 1 });
      const uc = sub(u, 0, 0.68);
      if (uc < 1) {
        UF.quad('glow', M.body, x, y + 10, W0 * 1.55 * at(K.coreW, uc), H0 * 0.86 * at(K.coreH, uc), 0,
          { ay: 1, a: at(K.coreA, uc) * 0.85, k: 1, dis: at(K.coreD, uc), seed: s0 + 1.7 });
        UF.quad('glow', M.core, x, y + 8, W0 * at(K.coreW, uc), H0 * at(K.coreH, uc), 0,
          { ay: 1, a: at(K.coreA, uc), k: at(K.coreK, uc), dis: at(K.coreD, uc), seed: s0, glow: 0.28, gs: 1.35 });
      }
      for (const T of tongues) {
        const ut = sub(u, T.d, T.d + 0.5);
        if (ut < 0 || ut >= 1) continue;
        UF.quad('glow', M.tongue, x + T.dx, y + 10, T.w, T.h * at(K.tongH, ut), 0,
          { ay: 1, flip: T.flip, a: at(K.coreA, ut), k: 1.1, dis: at(K.tongD, ut), seed: T.seed, glow: 0.18 });
      }
      const uf = sub(u, 0, 0.22);
      if (uf < 1) { const s = 200 * at(K.flareS, uf); UF.quad('glow', M.flare, x, y - 26, s, s, s0, { a: at(K.flareA, uf) * 0.7, tint: [1.6, 0.85, 0.42], k: 1 }); }
    } });
    // embers flying up, stretched along their flight
    UF.parts({ life: 1.6, parts: Array.from({ length: 16 }, () => ({ x: x + rand(-34, 34), y: y - rand(0, 40), vx: rand(-160, 160), vy: -rand(380, 820), drag: 2.2, grav: -60, life: rand(0.45, 0.95), t: -rand(0, 0.12), sz: rand(9, 15) })),
      draw(p, u) {
        const sp = Math.hypot(p.vx, p.vy), len = p.sz * (1.4 + Math.min(3.2, sp / 160)), ang = Math.atan2(p.vy, p.vx);
        const hot = 1 - u;
        UF.quad('glow', M.ember, p.x, p.y, len, p.sz, ang, { a: Math.min(1, (1 - u) * 1.6), tint: [1.0 + hot * 0.8, 0.3 + hot * 0.7, 0.05 + hot * 0.3], k: 1.4 });
      } });
    // dark smoke rolling off the top late in the eruption
    UF.parts({ layer: 'glow', life: 2.2, parts: Array.from({ length: 3 }, (_, i) => ({ x: x + rand(-30, 30), y: y - rand(170, 240), vx: rand(-25, 25), vy: -rand(50, 90), drag: 0.6, life: rand(0.9, 1.25), t: -(0.3 + i * 0.07), sz: rand(120, 160), seed: rand(0, 9), rot: rand(-0.4, 0.4) })),
      draw(p, u) {
        const s = p.sz * at(K.smokeS, u);
        UF.quad('glow', M.smoke, p.x, p.y, s, s * 0.85, p.rot, { a: at(K.smokeA, u) * 0.6, tint: [0.11, 0.055, 0.06], dis: at(K.smokeD, u), seed: p.seed });
      } });
    if (first && NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(x, y - 120, 0.012, 0.2);
  }
  UP.eruption = eruption;

  // the Lv 10 floor of fire: a lava pool for the zone's life, small tongues licking up on it
  const TONG = UF.curve([[0, 0.2], [0.25, 1.05], [1, 0.85]], 32);
  function floorPool(x, y, r, life) {
    UF.fx({ x, y, life, layer: 'low', draw(qq, u) {
      const a = Math.min(1, u * life / 0.25) * Math.min(1, (1 - u) * life / 0.6);
      UF.quad('low', M.pool, x, y, r * 2.4, r * 2.4, 0, { squash: SQ, a: a * 0.85, k: 1.0, dis: 0.15 + 0.85 * Math.max(0, (u - 0.7) / 0.3), seed: 7 });
    } });
  }
  function smallTongue(x, y, h) {
    const w = h * 0.75, seed = rand(0, 9), flip = Math.random() < 0.5;
    UF.fx({ x, y, life: 0.55, layer: 'glow', draw(qq, u) {
      UF.quad('glow', M.tongue, x, y + 4, w, h * at(TONG, u), 0, { ay: 1, flip, a: Math.min(1, u * 8) * (1 - u * 0.3), k: 1.3, dis: Math.max(0, (u - 0.25) / 0.75), seed, glow: 0.25 });
    } });
  }

  // ---------------- the skin ----------------
  // (falls back on the fire mage's light skin for everything else: hit sparks, burn marks ... stay as they are now)
  const ML = NC.MageLight;
  const MAP = Object.create((ML && ML.MAP) || {});
  if (NC.EmberFX && !MAP.__offs) MAP.__offs = [NC.EmberFX];
  let erupted = 0;
  MAP.vcircle = (p) => { eruption(p.x, p.y, erupted++ === 0); return null; };
  MAP.vflame = (p) => { if ((p.h || 0) <= 60 && (p.w || 0) <= 30) smallTongue(p.x, p.y, rand(60, 90)); return null; };
  MAP.vglow = (p) => { if (p.sq) floorPool(p.x, p.y + 10, p.r1 || 100, p.life || 3); return null; };
  const prev = RUN.fm_pillar, base = prev._orig || prev;
  const lit = LK.reskin(MAP, base, 'fm_pillar');
  RUN.fm_pillar = function (game, p) {
    if (!(UP.live() && isFM(p))) return prev.apply(this, arguments);
    erupted = 0;
    return lit.apply(this, arguments);
  };
  RUN.fm_pillar._orig = base;
  RUN.fm_pillar.lkSkin = true;
})();
