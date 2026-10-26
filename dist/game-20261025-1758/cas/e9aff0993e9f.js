/* frostfx.js — every ice skill in the Blender look the user picked for Crystal Burst (B, 2026-10-01: faceted ice with
   the game's navy outline). The 3D pieces come from tools/blender/frost_kit.py (assets/vfx3d/frost/) and
   crystal_burst.py (its shards); this file swaps them in:
     everywhere   an ice spike on the ground (V.spikeAt with the ice palette: frostdiver's line, the frost ring, the
                  traveler's R, the class-3 / weapon / archmage ice spikes) is a Blender spike growing out of the ground;
                  ice debris (V.debris with the ice palette) and the falling / flying ice shards ('shard') are Blender shards
     im_lance     the Glacier Lance is a Blender crystal lance with a frost trail; its hit bursts into shards and spikes
     im_blizzard  a turning funnel of wind and ice (a 24-frame loop) over the storm, ice raining from it
     im_breath    frost spikes sprout along the cone while the breath lasts
     im_iceage    crystal clusters (crystalburst.js) erupt round the hero every second of the ultimate
     also        a frozen monster's ice block, the ice blades (shatter shards, class-3 blades), the ice wall (im_wall), the
                 ice armour's plates (im_armor), and frost on the ground (V.decal 'frost')
   The skills' own numbers stay as they are: im_lance / im_blizzard are re-written with the same logic, the others only
   gain pictures. NC.FrostFX.on = false brings the old look back (re-load the page). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, RUN = NC.SKILL_RUN, K = NC.SkillKit, SK = NC.SKILLS, TAU = Math.PI * 2;
  if (!V || !RUN || !K) return;
  const FF = (NC.FrostFX = { on: true });
  const ICE_PAL = V.PAL.ice, ICE = V.RGB.ice;
  const rand = NC.rand, clamp = NC.clamp;
  const easeOut = V.easeOut;
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const A = {
    spikes: [0, 1, 2, 3, 4, 5].map((i) => load('assets/vfx3d/frost/spike_' + i + '.webp')),
    lance: load('assets/vfx3d/frost/lance.webp'), tornado: load('assets/vfx3d/frost/tornado.webp'),
    shards: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => load('assets/vfx3d/crystal_burst/ink/shard_' + i + '.webp')),
  };
  FF.A = A; // (hook: js/darkice.js swaps these pictures for the dark ice ones while the hero wears the ROOTBOUND set)
  const SPIKE = { gx: 128, gy: 307, h: 230 }; // (meta.json: the ground point; the main crystal's usual height in px)
  const TOR = { F: 512, cols: 6, n: 24, gx: 256, gy: 397, r: 165 };
  const hashOf = (p) => (p.hv === undefined ? (p.hv = Math.floor(Math.random() * 1e6)) : p.hv);

  // ---------------- spikes ----------------
  function drawSpike(ctx, p, u, glowPass) {
    const im = A.spikes[hashOf(p) % 6]; if (!ok(im)) return false;
    const t = p.t, rise = p.rise || 0.12, k = t < rise ? easeOut(t / rise) : 1, out = u > 0.8 ? (1 - u) / 0.2 : 1;
    const s = (p.h * 1.3) / SPIKE.h, sink = p.sink ? out : 1, a = p.sink ? 1 : out;
    if (a <= 0.01 || k * sink <= 0.02) return true;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate((p.tilt || 0) * 0.6);
    if (hashOf(p) & 64) ctx.scale(-1, 1);
    ctx.scale(s, s * k * sink); // (grows out of the ground, sinks back into it)
    if (glowPass) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= Math.min(1, 0.3 * (FF.glowK || 1)) * a; } else ctx.globalAlpha *= a; // (FF.glowK: js/darkice.js's bloom)
    ctx.drawImage(im, -SPIKE.gx, -SPIKE.gy);
    if (glowPass && FF.glowBlur && NC.game) { ctx.filter = `blur(${(FF.glowBlur * NC.game.scale).toFixed(1)}px)`; ctx.drawImage(im, -SPIKE.gx, -SPIKE.gy); ctx.filter = 'none'; } // (FF.glowBlur: js/darkice.js, the bloom spilling past the crystal)
    ctx.restore();
    return true;
  }
  // the old drawer for the other spikes (earth, holy...): as js/vfx.js has it
  FX.def('vspike', (ctx, p, u) => {
    if (FF.on && p.pal === ICE_PAL && drawSpike(ctx, p, u, false)) return;
    const t = p.t, rise = p.rise || 0.12, k = t < rise ? easeOut(t / rise) : 1, out = u > 0.8 ? (1 - u) / 0.2 : 1;
    V.glow(ctx, p.x, p.y - p.h * 0.4 * k, p.w * 1.4, p.rgb || '255,255,255', (p.glowA || 0) * out, false);
    V.spike(ctx, p.x, p.y, p.w, p.h * k * (u > 0.8 && p.sink ? out : 1), p.tilt, p.pal, p.sink ? 1 : out, p.jag);
  }, 'sorted');
  // the night darkens what stands among the characters: a bright twin after the lighting keeps the ice shining
  FX.def('ffSpikeHi', (ctx, p, u) => { const m = p.of; if (m && !m.dead) drawSpike(ctx, m, m.t / m.life, true); else p.dead = true; }, 'glow');
  const baseSpikeAt = V.spikeAt;
  V.spikeAt = function (x, y, w, h, pal, life, o) {
    const s = baseSpikeAt.apply(this, arguments);
    if (FF.on && pal === ICE_PAL && s) {
      FX.add({ type: 'ffSpikeHi', layer: 'glow', x, y, of: s, life });
      if (!(o && o.quiet)) V.glow && FX.add({ type: 'vmote', x: x + rand(-12, 12), y: y - 10, vx: 0, vy: -rand(40, 90), r: rand(2.5, 4), rgb: ICE, life: rand(0.4, 0.8), layer: 'glow' });
    }
    return s;
  };

  // ---------------- shards: debris and the flying / falling ones ----------------
  function shardSprite(ctx, x, y, rot, size, a, i) {
    const im = A.shards[i & 7]; if (!ok(im)) return false;
    const k = size / Math.max(im.naturalWidth, im.naturalHeight);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(im, -im.naturalWidth * k / 2, -im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k);
    ctx.restore(); return true;
  }
  FX.def('vshard', (ctx, p, u) => {
    const a = u > 0.75 ? (1 - u) / 0.25 : 1;
    if (FF.on && p.pal === ICE_PAL && shardSprite(ctx, p.x, p.y, p.rot || 0, p.s * 2.6, a, hashOf(p))) return;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
    V.spike(ctx, 0, p.s * 0.5, p.s * 0.7, p.s, 0, p.pal, a, 1);
    ctx.restore();
  }, 'high');
  // ('shard' is only ever ice: the rain of the storms, the frost nova's ring, the glacial spear's trail)
  FX.def('shard', (ctx, p, u) => {
    const a = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1, rot = Math.atan2(p.vy, p.vx) + Math.PI / 2;
    if (FF.on && shardSprite(ctx, p.x, p.y, rot + (hashOf(p) % 7) * 0.2, 46, a, hashOf(p))) return;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rot - Math.PI / 2); ctx.globalAlpha = a;
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(0, -9); ctx.lineTo(-18, 0); ctx.lineTo(0, 9); ctx.closePath();
    ctx.fillStyle = '#a9e4ff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2b4a78'; ctx.stroke(); ctx.restore();
  }, 'glow');

  // ---------------- Glacier Lance: a Blender lance ----------------
  const alive = (e) => e && e.hp > 0 && !e.dead;
  const castPose = (game, p, lock) => K.pose(game, p, K.clip(p, 'bolt', 0), lock || 0.3);
  const baseLance = RUN.im_lance;
  RUN.im_lance = function (game, p, lv) {
    if (!FF.on || !ok(A.lance)) return baseLance.apply(this, arguments);
    castPose(game, p, 0.3);
    const ang = p.aim, from = [p.x + Math.cos(ang) * 40, p.y - 70];
    V.glowAt && V.glowAt(from[0], from[1], 10, 120, ICE, 1, 0.25, { hot: true });
    K.shot(game, p, 'im_lance', { from, ang, v: 1500, range: 900, r: 44, pierce: true, rgb: ICE,
      look(ctx, q) {
        const a = Math.atan2(q.vy, q.vx), L = 190, k = L / A.lance.naturalWidth;
        V.glow(ctx, q.x - Math.cos(a) * 40, q.y - Math.sin(a) * 40, 110, ICE, 0.75, true);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(a);
        ctx.drawImage(A.lance, -L * 0.6, -A.lance.naturalHeight * k / 2, L, A.lance.naturalHeight * k);
        ctx.restore();
      },
      trail(q) {
        if (Math.random() < 0.7) FX.add({ type: 'vmote', x: q.x + rand(-14, 14), y: q.y + rand(-10, 10), vx: -q.vx * 0.05, vy: rand(-30, 30), r: rand(3, 5), rgb: ICE, life: rand(0.25, 0.5), layer: 'glow' });
        if (Math.random() < 0.25) FX.add({ type: 'shard', x: q.x, y: q.y, vx: q.vx * 0.12 + rand(-80, 80), vy: rand(-60, 160), life: 0.35 });
      },
      hit(e) {
        K.hit(game, p, 'im_lance', e, Math.cos(ang) * 200, Math.sin(ang) * 140, '190,235,255');
        V.debris(e.x, e.y - 40, 8, ICE_PAL, { size: 0.8, max: 360, layer: 'glow' });
        for (let i = 0; i < 3; i++) V.spikeAt(e.x + rand(-40, 40), e.y + rand(-14, 14), 30, rand(60, 95), ICE_PAL, 0.7, { rgb: ICE, rise: 0.06, sink: true, quiet: true });
      } });
    V.shake(game, 3);
  };

  // ---------------- Blizzard: the funnel ----------------
  FX.def('ffTornado', (ctx, p) => {
    if (!ok(A.tornado)) return;
    const f = Math.floor(p.t * 30) % TOR.n, sx = (f % TOR.cols) * TOR.F, sy = Math.floor(f / TOR.cols) * TOR.F, k = p.k;
    const a = Math.min(1, p.t / 0.35, (p.life - p.t) / 0.5);
    if (a <= 0) return;
    const x = p.z.x, y = p.z.y;
    V.glow(ctx, x, y - 160 * k, 260 * k, '190,230,255', 0.35 * a, false);
    ctx.save(); ctx.globalAlpha *= a;
    ctx.drawImage(A.tornado, sx, sy, TOR.F, TOR.F, x - TOR.gx * k, y - TOR.gy * k, TOR.F * k, TOR.F * k);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= Math.min(1, 0.45 * (FF.windK || 1)); // (the wind glows; FF.windK: js/darkice.js)
    ctx.drawImage(A.tornado, sx, sy, TOR.F, TOR.F, x - TOR.gx * k, y - TOR.gy * k, TOR.F * k, TOR.F * k);
    ctx.restore();
  }, 'glow');
  const baseBliz = RUN.im_blizzard;
  RUN.im_blizzard = function (game, p, lv) {
    if (!FF.on) return baseBliz.apply(this, arguments);
    castPose(game, p, 0.35);
    const [tx, ty] = K.ground(game, p, 480), R = 200 * (NC.weaponBonus && NC.weaponBonus(p, 'im_blizzard') ? 1.3 : 1);
    const hunt = lv >= 10 ? K.target(game, p, 700, 300) : null;
    let acc = 0;
    const z = { x: tx, y: ty };
    FX.add({ type: 'ffTornado', layer: 'glow', z, k: (R / TOR.r) * 1.05, life: 5 });
    FX.add({ type: 'timer', layer: 'none', life: 5, x: tx, y: ty, update(q, dt) {
      if (hunt && alive(hunt)) { z.x += Math.sign(hunt.x - z.x) * Math.min(Math.abs(hunt.x - z.x), 90 * dt); z.y += Math.sign(hunt.y - z.y) * Math.min(Math.abs(hunt.y - z.y), 60 * dt); }
      // ice flung out of the funnel, falling round it
      if (Math.random() < dt * 22) {
        const a = rand(0, TAU), d = Math.sqrt(Math.random()) * R, x = z.x + Math.cos(a) * d, y = z.y + Math.sin(a) * d * V.SQ;
        FX.add({ type: 'shard', x: x + 80, y: y - 420, vx: -200, vy: 1100, life: 0.38 });
        if (Math.random() < 0.3) V.smoke(x, y - 10, 1, '#e6f6ff', '#ffffff', { size: 0.6, lifeK: 0.6, a: 0.7 });
      }
      if (Math.random() < dt * 18) FX.add({ type: 'vmote', x: z.x + rand(-R, R) * 0.8, y: z.y - rand(20, 260), vx: rand(-260, 260), vy: rand(-40, 40), r: rand(2.5, 4.5), rgb: '230,245,255', life: rand(0.4, 0.8), layer: 'glow' });
      if ((acc += dt) >= 1) {
        acc -= 1;
        for (let i = 0; i < 3; i++) { const a = rand(0, TAU), d = rand(0.3, 0.95) * R; V.spikeAt(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d * V.SQ, 26, rand(50, 80), ICE_PAL, 0.7, { rgb: ICE, rise: 0.07, sink: true, quiet: true }); }
        for (const e of K.around(game, z.x, z.y, R)) { K.hit(game, p, 'im_blizzard', e, 0, 0, '170,225,255'); K.slow(e, 1.2); }
      }
    } });
    V.decal(tx, ty, R, 'frost', 5.5);
    V.light(tx, ty - 40, R * 2.2, ICE, 0.7, 5);
  };

  // ---------------- Frozen Breath: spikes sprouting along the cone ----------------
  const baseBreath = RUN.im_breath;
  RUN.im_breath = function (game, p, lv) {
    baseBreath.apply(this, arguments);
    if (!FF.on) return;
    for (let n = 0; n < 4; n++) V.at(0.2 + n * 0.45, () => {
      if (p.dead > 0) return;
      const a = p.aim;
      for (let i = 0; i < 4; i++) {
        const d = rand(90, 320), b = a + rand(-0.45, 0.45);
        V.spikeAt(p.x + Math.cos(b) * d, p.y + Math.sin(b) * d * 0.7, 24, rand(40, 72), ICE_PAL, 0.65, { rgb: ICE, rise: 0.08, sink: true, quiet: true });
      }
    });
  };

  // ---------------- Ice Age: crystal clusters erupt round the hero ----------------
  const baseAge = RUN.im_iceage;
  RUN.im_iceage = function (game, p, lv) {
    baseAge.apply(this, arguments);
    if (!FF.on || !NC.CrystalFX) return;
    for (let s = 0; s < 8; s++) V.at(0.4 + s, () => {
      const foes = game.enemies.filter((e) => alive(e) && NC.dist(e.x, e.y, p.x, p.y) < 900);
      for (let i = 0; i < 3; i++) {
        const e = foes.length ? foes[Math.floor(Math.random() * foes.length)] : null;
        const x = e ? e.x + rand(-40, 40) : p.x + rand(-600, 600), y = e ? e.y + rand(-20, 20) : p.y + rand(-300, 300);
        V.at(i * 0.18, () => NC.CrystalFX.play(game, x, y, { scale: rand(0.75, 1.05) }));
      }
    });
  };

  // ================= the rest of the ice: the frozen block, ice blades, the ice wall, the ice armour, frost on the ground =================
  A.block = load('assets/vfx3d/frost/block.webp');
  A.decal = load('assets/vfx3d/crystal_burst/ink/decal.webp');
  const BLOCK = { gx: 160, gy: 312, h: 270, w: 270 };

  // a frozen monster: entities.js / monsters.js draw the block with V.spike in this palette: a see-through Blender block instead
  const baseSpike = V.spike;
  V.spike = function (ctx, x, y, w, h, tilt, pal, a, jag) {
    if (FF.on && pal && pal[0] === '#8fd8ff' && pal[1] === '#d9f4ff' && ok(A.block)) {
      if (a <= 0.01 || h < 2) return;
      const sy = (h * 1.12) / BLOCK.h, sx = clamp((w * 1.35) / BLOCK.w, sy * 0.8, sy * 1.3);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (ctx.globalAlpha / 0.55) * 0.8 * a); // (the callers fade it to 0.55: the picture is see-through already)
      ctx.translate(x, y - 6); ctx.scale(sx, sy);
      ctx.drawImage(A.block, -BLOCK.gx, -BLOCK.gy);
      ctx.restore();
      return;
    }
    return baseSpike.apply(this, arguments);
  };

  // ice blades (the shatter's flying shards, the class-3 ice blades): a small Blender lance along the flight
  const baseBlade = K.drawBlade;
  K.drawBlade = function (ctx, x, y, ang, len, w, fill, glowRgb) {
    if (FF.on && glowRgb === ICE && ok(A.lance)) {
      const L = len * 1.25, k = L / A.lance.naturalWidth, hh = Math.max(w * 2.2, A.lance.naturalHeight * k);
      V.glow(ctx, x, y, len * 0.8, ICE, 0.4, true);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.drawImage(A.lance, -L * 0.45, -hh / 2, L, hh);
      ctx.restore();
      return;
    }
    return baseBlade.apply(this, arguments);
  };

  // the ice wall (im_wall): a row of Blender spikes
  FX.def('j3wall', (ctx, q, u) => {
    const a = Math.min(1, q.t / 0.15) * (u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1), rise = Math.min(1, q.t / 0.18);
    V.glow(ctx, q.x, q.y - 60, 180, ICE, 0.25 * a, true);
    const row = [];
    for (let i = -4; i <= 4; i++) row.push(i);
    row.sort((m, n) => q.ay * m - q.ay * n); // (the far end first)
    for (const i of row) {
      const im = A.spikes[(i + 8) % 6]; if (!ok(im)) continue;
      const x = q.x + q.ax * i * 36, y = q.y + q.ay * i * 36, h = 110 + ((i * 37) % 3) * 16 - Math.abs(i) * 8, sc = (h * 1.3) / SPIKE.h;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); if (i & 1) ctx.scale(-1, 1); ctx.scale(sc, sc * easeOut(rise));
      ctx.drawImage(im, -SPIKE.gx, -SPIKE.gy); ctx.restore();
    }
  }, 'high');

  // the ice armour (im_armor): six Blender shards turning round the hero instead of the drawn plates
  const baseDraw = FX.draw;
  FX.draw = function (ctx, layer) {
    const G = NC.game, p = G && G.player;
    if ((layer !== 'high' && layer !== 'glow') || !FF.on || !p || !(p.iceArmor > 0) || !(p.buffs && p.buffs.im_armor > 0)) return baseDraw.apply(this, arguments);
    if (layer === 'high') { // (the drawn plates hide; the Blender ones come after the night lighting, in 'glow')
      const keep = p.iceArmor; p.iceArmor = 0;
      try { return baseDraw.apply(this, arguments); } finally { p.iceArmor = keep; }
    }
    baseDraw.apply(this, arguments);
    const t = G.time || 0;
    const plates = [];
    for (let i = 0; i < 6; i++) { const a = t * 0.8 + (i / 6) * TAU; plates.push([a, Math.sin(a)]); }
    plates.sort((m, n) => m[1] - n[1]);
    for (const [a, front] of plates) {
      const x = p.x + Math.cos(a) * 66, y = p.y - 70 + Math.sin(a) * 26;
      ctx.save(); ctx.globalAlpha *= front > 0 ? 0.95 : 0.5;
      shardSprite(ctx, x, y, -0.15 + Math.sin(t * 2 + a) * 0.1, 64, 1, Math.floor((a / TAU) * 6 + 6) % 8);
      ctx.restore();
    }
    V.glow(ctx, p.x, p.y - 70, 110, ICE, 0.2, true);
  };

  // frost on the ground (V.decal 'frost'): the Blender frost pattern, tinted, spreading then melting
  FX.def('ffFrost', (ctx, p) => {
    if (!ok(A.decal)) return;
    const grow = easeOut(p.t / 0.3), fade = Math.min(1, (p.life - p.t) / Math.min(1, p.life * 0.4)), R = p.r * 1.15 * (0.4 + 0.6 * grow);
    if (fade <= 0) return;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, V.SQ);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
    ctx.globalAlpha *= fade * (p.a || 1); ctx.globalCompositeOperation = 'lighter';
    ctx.filter = FF.decalFilter || 'sepia(1) hue-rotate(160deg) saturate(3.4) brightness(1.2)'; // (FF.decalFilter: js/darkice.js)
    ctx.rotate(p.rot); ctx.drawImage(A.decal, -p.r * 1.15, -p.r * 1.15, p.r * 2.3, p.r * 2.3);
    ctx.restore();
  }, 'low');
  const baseDecal = V.decal;
  V.decal = function (x, y, r, kind, life, o) {
    if (FF.on && kind === 'frost' && ok(A.decal)) return FX.add(Object.assign({ type: 'ffFrost', layer: 'low', x, y, r, life, rot: rand(0, TAU) }, o || {}));
    return baseDecal.apply(this, arguments);
  };

  // the Archmage's glacial spear (am_glacial) draws its own spear: the Blender lance instead
  const baseShot = K.shot;
  K.shot = function (game, p, sid, o) {
    if (FF.on && sid === 'am_glacial' && o && o.look && ok(A.lance)) {
      o.look = (ctx, q) => {
        const a = Math.atan2(q.vy, q.vx), L = 200, k = L / A.lance.naturalWidth;
        V.glow(ctx, q.x, q.y, 120, ICE, 0.7, true);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(a);
        ctx.drawImage(A.lance, -L * 0.6, -A.lance.naturalHeight * k / 2, L, A.lance.naturalHeight * k);
        ctx.restore();
      };
    }
    return baseShot.apply(this, arguments);
  };
})();
