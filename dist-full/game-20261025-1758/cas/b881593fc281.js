/* wfx.js — high-tier weapons look it (the user, 2026-09-29: "อาวุธเทียร์สูง ๆ จะมีเอฟเฟกต์ตอนตีด้วยนะ"). Visual only:
   the weapons of the item plan (greatswords W.gs, one-handed swords W.sw, the catalog W.wc) get a tier from their
   grade and kind, and with it
     tier 1  (grade 3)             every basic hit bursts in the weapon's element colour
     tier 2  (grade 4, grade 1-2 bosses)  + the element's own touch on the hit (flames, frost, a gust, a crack, poison
                                   smoke, holy light, shadow smoke, ghost wisps, star sparks), a brighter swing trail,
                                   a soft glow on the weapon in hand
     tier 3  (grade 3-4 bosses)    bigger, a flare, a small shake, embers drifting off the weapon
     tier 4  (the legends)         all of it at its grandest, stars on every hit, the weapon shining
   Every elemental weapon, whatever its tier, also shows its element (the user, 2026-09-29: "แล้วพวกอาวุธธาตุล่ะ"):
   small particles of it drift off the weapon in hand (embers, drops, leaves in the wind, dust, bubbles, sparkles,
   shadow wisps, ghost lights) and its hits spark in the element's colour.
   Hooks: NC.basicHits (the hit), NC.drawTrail (the trail drawn again), NC.drawPlayer (the glow over the hero). */
(function () {
  'use strict';
  const NC = window.NC, V = NC.VFX, K = NC.SkillKit, P = V.PAL, rand = NC.rand;
  const RGB = { neutral: '225,235,255', water: '140,205,255', wind: '160,245,200', earth: '230,185,120', fire: '255,140,60', poison: '185,130,255',
    holy: '255,228,140', shadow: '170,130,240', ghost: '190,255,240', undead: '190,215,190' };
  const FILL = { neutral: '#f4f8ff', water: '#e6f6ff', wind: '#eafff2', earth: '#ffe9c4', fire: '#fff0c0', poison: '#f0e4ff', holy: '#fff6c8',
    shadow: '#e9dcff', ghost: '#eafffb', undead: '#e8f2e4' };

  // the tier of a weapon (0: nothing extra)
  const cache = new WeakMap();
  function tierOf(W) {
    if (!W) return 0;
    if (cache.has(W)) return cache.get(W);
    const d = W.gs || W.sw || W.wc;
    let t = 0;
    if (d) {
      t = d.grade >= 4 ? 2 : d.grade >= 3 ? 1 : 0;
      if (d.kind === 'D') t = d.grade >= 3 ? 3 : 2;
      if (d.kind === 'L') t = 4;
    }
    cache.set(W, t);
    return t;
  }
  NC.weaponTier = tierOf;
  const elOf = (W) => W.element || 'neutral';

  // ---------------- on the hit ----------------
  let lastHit = 0;
  NC.basicHitLooks.push((game, p, e, r) => { // (a look only: online it plays from the server's hit, NC.basicHitLooks)
    if (!(r && r.dmg > 0) || !e) return;
    const W = NC.weaponDef(p), T = tierOf(W), el = elOf(W);
    if ((!T && el === 'neutral') || game.time - lastHit < 0.07) return; // (a sweep through a pack: one burst per swing moment)
    lastHit = game.time;
    const rgb = RGB[el] || RGB.neutral, x = e.x, y = e.y - 44, big = T >= 3 ? 1.35 : T >= 2 ? 1.1 : 1;
    if (!T) { V.sparks(x, y, 5, rgb, { size: 0.6, max: 300 }); return; } // (a low elemental weapon: a small spark of its element)
    V.sparks(x, y, 6 + T * 3, rgb, { size: 0.7 + T * 0.08, max: 380 + T * 90 });
    V.ring(x, e.y - 6, 10, 60 * big, 5 + T, rgb, 0.28);
    if (T < 2) return;
    V.light(x, y, 160 * big, rgb, 0.7, 0.22);
    // the element's own touch
    switch (el) {
      case 'fire': K.flames(x, e.y, T >= 3 ? 4 : 2, 30 * big, { pal: P.fire, k: 0.55 * big }); break;
      case 'water': for (let i = 0; i < (T >= 3 ? 3 : 2); i++) V.spikeAt(x + rand(-26, 26), e.y + rand(-8, 8), 12, 34 * big, P.ice, 0.5, { glowA: 0.3, rgb, rise: 0.05, sink: true }); break;
      case 'wind': V.slash(x, y, 46 * big, rand(0, 6.28), 3.4, 10, P.wind || P.ice, 0.26, { rgb }); break;
      case 'earth': V.decal(x, e.y, 34 * big, 'crack', 1.2, { rgb }); V.smoke(x, e.y - 6, 4, '#b9a07c', '#e8d6b4', { size: 0.6, lifeK: 0.6 }); break;
      case 'poison': V.smoke(x, y, 5, '#9a6fd8', '#dcc8ff', { size: 0.7 * big, lifeK: 0.7, a: 0.7 }); break;
      case 'holy': V.flare(x, y, 70 * big, rgb, 0.26); V.stars(x, y, 3 + T, FILL.holy, rgb, { speed: 200 }); break;
      case 'shadow': V.smoke(x, y, 5, '#3a2c55', '#8a6fc0', { size: 0.8 * big, lifeK: 0.7, a: 0.75 }); break;
      case 'ghost': V.motes(x, y, 6 + T, rgb, { spread: 30, rise: 120 }); break;
      default: V.stars(x, y, 2 + T, FILL.neutral, rgb, { speed: 220 });
    }
    if (T >= 3) { V.flare(x, y, 90 * big, rgb, 0.24); V.shake(game, T >= 4 ? 3 : 2); }
    if (T >= 4) { V.stars(x, y, 8, FILL[el] || '#fff6d0', rgb, { speed: 320 }); V.ring(x, e.y - 6, 20, 140, 9, rgb, 0.4); }
  });

  // ---------------- the trail: drawn again for a brighter ribbon ----------------
  const baseTrail = NC.drawTrail;
  NC.drawTrail = function (ctx, game) {
    baseTrail(ctx, game);
    const T = tierOf(NC.weaponDef(game.player));
    if (T >= 2) baseTrail(ctx, game);
    if (T >= 4) baseTrail(ctx, game);
  };

  // ---------------- an element drifting off the weapon ----------------
  function drift(el, x, y, T) {
    const rgb = RGB[el], k = T >= 2 ? 1.2 : 1;
    switch (el) {
      case 'fire': V.flameAt(x, y, 9 * k, 16 * k, P.fire, 0.5, { vy: -60 }); V.sparks(x, y, 1, rgb, { size: 0.4, max: 80 }); break;
      case 'water': V.sparks(x, y, 1, rgb, { size: 0.45, max: 60 }); V.motes(x, y, 1, rgb, { spread: 4, rise0: -60, rise: -30, size: 0.6, lifeK: 0.5 }); break;
      case 'wind': V.motes(x, y, 1, rgb, { spread: 8, vx: rand(40, 80), rise0: 10, rise: 40, size: 0.7, lifeK: 0.7 }); break;
      case 'earth': V.motes(x, y, 1, '215,170,110', { spread: 5, rise0: -40, rise: -10, size: 0.7, lifeK: 0.6 }); break; // (grit falling off it)
      case 'poison': V.motes(x, y, 1, rgb, { spread: 5, rise0: 20, rise: 60, size: 0.8, lifeK: 0.8 }); break;
      case 'holy': V.stars(x, y, 1, FILL.holy, rgb, { speed: 30, size: 0.4 }); break;
      case 'shadow': V.motes(x, y, 2, '150,110,235', { spread: 6, rise0: 20, rise: 50, size: 0.8, lifeK: 0.7 }); break;
      case 'ghost': V.motes(x, y, 1, rgb, { spread: 6, rise0: 30, rise: 70, size: 0.8, lifeK: 0.9 }); break;
    }
  }

  // ---------------- the weapon in hand glows ----------------
  let emberT = 0, driftT = 0;
  const baseDraw = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    baseDraw(ctx, game);
    const p = game.player, W = NC.weaponDef(p), T = tierOf(W);
    if (!W || !p.pose || p.dead > 0) return;
    const el = elOf(W);
    if (T < 2 && el === 'neutral') return;
    const L = NC.weaponLine(p.equip, p.pose, p.x, p.y);
    if (!L) return;
    if (el !== 'neutral' && game.time > driftT) { // (any elemental weapon: its element drifts off the blade)
      driftT = game.time + (T >= 3 ? 0.14 : T >= 1 ? 0.22 : 0.32);
      const u = 0.35 + Math.random() * 0.65;
      drift(el, NC.lerp(L.base[0], L.tip[0], u), NC.lerp(L.base[1], L.tip[1], u), T);
    }
    if (T < 2) return;
    const rgb = RGB[elOf(W)] || RGB.neutral, t = game.time, pulse = 0.75 + 0.25 * Math.sin(t * (T >= 4 ? 5 : 3));
    const mx = (L.base[0] + L.tip[0]) / 2, my = (L.base[1] + L.tip[1]) / 2, len = Math.hypot(L.tip[0] - L.base[0], L.tip[1] - L.base[1]);
    ctx.save();
    V.glow(ctx, mx, my, Math.max(30, len * 0.55), rgb, (T >= 4 ? 0.34 : T >= 3 ? 0.24 : 0.16) * pulse, true);
    if (T >= 3) V.glow(ctx, L.tip[0], L.tip[1], T >= 4 ? 34 : 24, rgb, 0.4 * pulse, true);
    ctx.restore();
    // embers / sparkles drifting off it
    if (T >= 3 && t > emberT) {
      emberT = t + (T >= 4 ? 0.12 : 0.25);
      const u = Math.random(), x = NC.lerp(L.base[0], L.tip[0], u), y = NC.lerp(L.base[1], L.tip[1], u);
      if (T >= 4) V.stars(x, y, 1, FILL[elOf(W)] || '#fff6d0', rgb, { speed: 40, size: 0.5 });
      else V.sparks(x, y, 1, rgb, { size: 0.45, max: 90 });
    }
  };
})();
