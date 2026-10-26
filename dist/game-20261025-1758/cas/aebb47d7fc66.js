/* crystalburst.js — a 3D-rendered look for the Ice Mage's Crystal Burst (ผลึกระเบิด), the way 3D-engine games build such
   effects (the user's reference, 2026-10-01: "st_glacial_spike"): frost spreads on the ground under the target, a star
   flash, a cluster of faceted ice crystals erupts out of the ground with a swirl of cold wind, then it shatters into
   shards that fly, land and melt away.
     3D parts  made in Blender by tools/blender/crystal_burst.py (assets/vfx3d/crystal_burst/<plain|ink>/): the cluster
               growing (a 6 x 3 flipbook, 512 px frames), 8 loose shards, a frost decal seen from above
     2D parts  drawn here: the decal's spread, the flash, the swirl, the shards' flight (height z, gravity, bounce, spin)
   NC.CrystalFX.play(game, x, y, { scale, onShatter }) plays it at a monster's feet; while NC.CrystalFX.on, im_burst uses
   it (the damage and the shatter are the skill's own, at the moment the crystals break). The user picked the outlined
   look (B, 2026-10-01: Blender Freestyle in the game's navy ink); the glossy one (A) can be rendered again without
   --outline. Re-render: README "เอฟเฟกต์ 3D จาก Blender". */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, TAU = Math.PI * 2;
  const ROOT = 'assets/vfx3d/crystal_burst/';
  const F = 512, COLS = 6, N = 18, AX = 256, AY = 360; // a flipbook frame and where the ground point sits in it
  const GROW = 12, FPS = 30;
  const IMG = {};
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  function art(v) {
    if (!IMG[v]) IMG[v] = { sheet: load(ROOT + v + '/cluster.webp'), decal: load(ROOT + v + '/decal.webp'), shards: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => load(ROOT + v + '/shard_' + i + '.webp')) };
    return IMG[v];
  }
  const ready = (im) => im && im.complete && im.naturalWidth > 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);

  // ---------------- the ground: frost spreading out, then melting ----------------
  FX.def('cbDecal', (ctx, p) => {
    const A = art(p.v); if (!ready(A.decal)) return;
    const grow = ease(p.t / 0.4), fadeOut = p.t > p.life - 0.8 ? (p.life - p.t) / 0.8 : 1, R = p.r * (0.35 + 0.65 * grow);
    ctx.save();
    ctx.translate(p.x, p.y); ctx.scale(1, V.SQ);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
    ctx.globalAlpha *= clamp(fadeOut, 0, 1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = (NC.CrystalFX && NC.CrystalFX.decalFilter) || 'sepia(1) hue-rotate(160deg) saturate(3.4) brightness(1.35)'; // (the render is pale: tint it ice blue; decalFilter: js/darkice.js)
    ctx.drawImage(A.decal, -p.r, -p.r, p.r * 2, p.r * 2);
    ctx.restore();
  }, 'low');

  // ---------------- the cluster: the Blender flipbook standing among the characters ----------------
  FX.def('cbCrystal', (ctx, p) => {
    const A = art(p.v); if (!ready(A.sheet)) return;
    let f = Math.floor(p.t * FPS);
    if (f >= N) f = GROW + ((f - GROW) % (N - GROW)); // (hold: the glint frames again)
    const sx = (f % COLS) * F, sy = Math.floor(f / COLS) * F, k = p.k;
    V.glow(ctx, p.x, p.y - 90 * k * 2.2, 150 * k * 2.2, '150,215,255', 0.35 * Math.min(1, p.t / 0.15), true, 0.8);
    ctx.drawImage(A.sheet, sx, sy, F, F, p.x - AX * k, p.y - AY * k, F * k, F * k);
  }, 'glow'); // (after the night lighting: the ice shines like the reference)

  // ---------------- shards: fly up and out, fall, bounce once, lie, melt ----------------
  FX.def('cbShard', (ctx, p) => {
    const A = art(p.v), im = A.shards[p.i]; if (!ready(im)) return;
    const melt = p.t > p.life - 0.6 ? (p.life - p.t) / 0.6 : 1;
    ctx.save();
    // the shadow on the ground
    ctx.globalAlpha *= 0.25 * melt;
    ctx.fillStyle = '#081428'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 14 * p.s, 5 * p.s, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = melt;
    ctx.translate(p.x, p.y - p.z); ctx.rotate(p.rot);
    const w = im.naturalWidth * 0.42 * p.s, h = im.naturalHeight * 0.42 * p.s;
    ctx.drawImage(im, -w / 2, -h / 2, w, h);
    ctx.restore();
  }, 'glow');
  function shardUpdate(p, dt) {
    if (p.landed) { p.sort = p.y; return; }
    p.vz -= 1500 * dt; p.z += p.vz * dt;
    if (p.z <= 0) {
      p.z = 0;
      if (p.bounced) { p.landed = true; p.vx = p.vy = 0; p.spin = 0; } else { p.bounced = true; p.vz = -p.vz * 0.3; p.vx *= 0.4; p.vy *= 0.4; p.spin *= 0.4; }
    }
    p.sort = p.y;
  }

  // ---------------- the flash: a star of light ----------------
  FX.def('cbFlash', (ctx, p) => {
    const u = p.t / p.life, a = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8, R = p.r * (0.6 + 0.6 * ease(u));
    if (a <= 0) return;
    V.glow(ctx, p.x, p.y, R * 1.2, '170,225,255', a, true);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(p.x, p.y); ctx.rotate(p.rot + u * 0.4);
    for (let i = 0; i < 8; i++) {
      const L = R * (i % 2 ? 0.55 : 1.15), wdt = R * 0.07;
      const g = ctx.createLinearGradient(0, 0, L, 0);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(160,220,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -wdt); ctx.lineTo(L, 0); ctx.lineTo(0, wdt); ctx.closePath(); ctx.fill();
      ctx.rotate(TAU / 8);
    }
    ctx.restore();
  }, 'glow');

  // ---------------- the swirl: cold wind rings round the cluster ----------------
  FX.def('cbSwirl', (ctx, p) => {
    const u = p.t / p.life, a = (u < 0.15 ? u / 0.15 : 1 - Math.pow((u - 0.15) / 0.85, 2)) * 0.9;
    if (a <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const R = p.r * (0.75 + k * 0.22 + u * 0.35), y0 = p.y - (20 + k * 46) * p.k, rot = p.t * (5 - k) + k * 2.1;
      for (let s = 0; s < 14; s++) {
        const t0 = rot + s * 0.11, t1 = t0 + 0.12, w = (1 - s / 14);
        ctx.strokeStyle = `rgba(${k === 1 ? '230,245,255' : '160,220,255'},${a * w * 0.8})`; ctx.lineWidth = (7 - k * 1.5) * w * p.k + 1;
        ctx.beginPath(); ctx.ellipse(p.x, y0, R, R * V.SQ * 0.75, 0, t0, t1); ctx.stroke();
      }
    }
    ctx.restore();
  }, 'high');

  // ---------------- the whole effect at (x, y) ----------------
  const CF = (NC.CrystalFX = { on: true, variant: 'ink' });
  art(CF.variant); // (loaded with the game: a burst never waits for its pictures)
  CF.play = function (game, x, y, o) {
    o = o || {};
    const v = o.variant || CF.variant, k = (o.scale || 1) * 1.05, A = art(v);
    void A;
    FX.add({ type: 'cbDecal', layer: 'low', x, y, r: 170 * (o.scale || 1), life: 2.8, v });
    // a cold wisp gathering in, a snow puff at the feet
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * TAU, d = 120 + Math.random() * 80;
      FX.add({ type: 'vmote', x: x + Math.cos(a) * d, y: y - 40 + Math.sin(a) * d * V.SQ, vx: -Math.cos(a) * d * 2.6, vy: -Math.sin(a) * d * V.SQ * 2.6, life: 0.38, r: 7, rgb: '200,235,255', layer: 'glow' });
    }
    V.light && V.light(x, y - 60, 260, '140,210,255', 0.9, 1.6);
    V.at(0.3, () => {
      FX.add({ type: 'cbFlash', layer: 'glow', x, y: y - 70 * k, r: 115 * k, rot: Math.random(), life: 0.32 });
      V.shake && V.shake(game, 3);
    });
    V.at(0.32, () => {
      const c = FX.add({ type: 'cbCrystal', layer: 'glow', x, y, k, v, life: 0.75 });
      FX.add({ type: 'cbSwirl', layer: 'high', x, y, r: 120 * k, k, life: 0.9 });
      V.at(0.72, () => {
        c.dead = true;
        // break: the shards fly, the flash again, the skill's damage
        FX.add({ type: 'cbFlash', layer: 'glow', x, y: y - 90 * k, r: 120 * k, rot: Math.random(), life: 0.22 });
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * TAU, sp = 140 + Math.random() * 260, s = 0.55 + Math.random() * 0.75;
          FX.add({ type: 'cbShard', layer: 'glow', x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 12, z: 40 + Math.random() * 140 * k,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * V.SQ, vz: 260 + Math.random() * 420, drag: 1.2,
            rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 18, i: (Math.random() * 8) | 0, s, v, life: 1.6 + Math.random() * 0.8, update: shardUpdate });
        }
        V.shake && V.shake(game, 6);
        if (o.onShatter) o.onShatter();
      });
    });
  };

  // ---------------- Crystal Burst uses it ----------------
  const RUN = NC.SKILL_RUN, K = NC.SkillKit, base = RUN.im_burst;
  const alive = (e) => e && e.hp > 0 && !e.dead;
  RUN.im_burst = function (game, p, lv) {
    if (!CF.on) return base.apply(this, arguments);
    K.pose(game, p, 'cheer', 0.3);
    const frozen = game.enemies.filter((e) => alive(e) && e.frozen > 0 && NC.dist(e.x, e.y, p.x, p.y) < 1100);
    if (!frozen.length) { FX.text(p.x, p.y - 200, 'ไม่มีศัตรูที่แข็งอยู่', '#bfe8ff', 26); return; }
    V.flash('200,235,255', 0.08, 0.2);
    frozen.forEach((e, i) => V.at(i * 0.06, () => {
      if (!alive(e)) return;
      const big = NC.isBigMon ? NC.isBigMon(e) : false;
      // the crystals take the place of the ice block (the frozen look), the monster held still inside them
      V.at(0.32, () => { if (alive(e) && e.frozen > 0) { e.cbHeld = e.frozen; e.frozen = 0; NC.statusEnemy(game, e, 'stun', 0.8); } });
      CF.play(game, e.x, e.y, { scale: big ? 1.35 : 1, onShatter() {
        if (!alive(e)) return;
        if (e.cbHeld) { e.frozen = Math.max(0.2, e.cbHeld - 0.6); e.cbHeld = 0; }
        K.hit(game, p, 'im_burst', e, 0, -100, '190,235,255');
        if (NC.iceShatter) NC.iceShatter(game, p, e, 0);
        if (lv >= 10 && !alive(e)) p.sp = Math.min(p.maxSp, p.sp + 5);
      } });
    }));
  };
})();
