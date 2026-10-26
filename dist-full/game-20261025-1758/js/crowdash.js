/* crowdash.js — the night falcon set's dash as a crow's shadow (the user, 2026-10-07: "เวลาใส่ชุดนี้ ตอนกดพุ่งจะเป็นเหมือนเงา
   สีดำแดง ขนนก ให้อารมณ์เงาอีกา"). While the hero in robe_nfalcon dashes:
     the body   drawn as a black shadow with a blood-red rim (his own silhouette, a red glow round it), not the armour
     the trail  the dash's afterimages (entities.js's green ghosts) turned into fading black shadows with red rims, drawn
                after the night's darkness so they read
     feathers   a burst of black feathers with red tips as he goes, more shed along the way, drifting, swaying, falling
     crows      a few crows break out of him at the start, flap off and fade; a last puff of feathers where he lands
     the Shift dash's own streaks, dust and ring (js/dash.js) turn black and red
   The crows and feathers are Codex paintings (assets/gen/make_crowdash_prompts.py, cut by tools/cutout.py into
   assets/vfx2d/crowdash): never drawn by code (the user: "ห้ามวาดเอฟเฟคเองนะ").
   Loaded after js/bloodaura.js (its NC.drawPlayer is the outermost). NC.CrowDash.on = false switches it off. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  if (!FX) return;
  const CD = (NC.CrowDash = { on: true });
  const MINE = (e) => CD.on && e && e.robe === 'robe_nfalcon';
  const SHADOW = '#0b0610', TAU = Math.PI * 2;

  // ---------------- the body during the dash: a black shadow with a red rim ----------------
  const H = { was: false };
  const baseDP = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game.player;
    const dashing = !!(p && p.dash && p.pose && p.dead <= 0 && MINE(p.equip));
    if (dashing && !H.was) start(game, p);
    if (!dashing && H.was && p) land(p);
    H.was = dashing;
    if (!dashing) return baseDP.apply(this, arguments);
    if (game.time > (H.shedT || 0)) { H.shedT = game.time + 0.03; feather(p.x + NC.rand(-14, 14), p.y - NC.rand(20, 90), -(p.dash.vx || 0) * NC.rand(0.05, 0.15) + NC.rand(-30, 30), NC.rand(-40, 10)); }
    shadowAt(ctx, p.equip, p.pose, p.x, p.y, 1, 1);
  };
  // the silhouette drawn black into a small canvas round him, then laid on: a thin blurred red copy first (the rim), the
  // black on top (so the inside stays black, not reddened by the glow of each part)
  const sc1 = document.createElement('canvas'), sx1 = sc1.getContext('2d');
  const sc2 = document.createElement('canvas'), sx2 = sc2.getContext('2d');
  function shadowAt(ctx, equip, pose, x, y, a, glow) {
    if (a <= 0.01) return;
    const m = ctx.getTransform(), k = Math.hypot(m.a, m.b), B = Math.ceil(320 * k);
    const ox = m.a * x + m.c * (y - 70) + m.e - B / 2, oy = m.b * x + m.d * (y - 70) + m.f - B / 2;
    for (const c of [sc1, sc2]) if (c.width !== B) { c.width = B; c.height = B; }
    sx1.setTransform(1, 0, 0, 1, 0, 0); sx1.clearRect(0, 0, B, B);
    sx1.setTransform(m.a, m.b, m.c, m.d, m.e - ox, m.f - oy);
    NC.drawHero(sx1, equip, pose, x, y, { silhouette: SHADOW, alpha: 1, noBend: true });
    sx1.setTransform(1, 0, 0, 1, 0, 0);
    sx2.setTransform(1, 0, 0, 1, 0, 0); sx2.clearRect(0, 0, B, B);
    sx2.filter = `blur(${Math.max(1.5, 3.2 * k).toFixed(1)}px)`; sx2.drawImage(sc1, 0, 0); sx2.drawImage(sc1, 0, 0); sx2.filter = 'none';
    sx2.globalCompositeOperation = 'source-in'; sx2.fillStyle = '#ff2442'; sx2.fillRect(0, 0, B, B); sx2.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.min(1, a * glow); ctx.drawImage(sc2, ox, oy);
    ctx.globalAlpha = a; ctx.drawImage(sc1, ox, oy);
    ctx.restore();
  }

  // ---------------- the afterimages: black shadows with red rims, after the night's darkness ----------------
  FX.def('crowghost', (ctx, q, u) => shadowAt(ctx, q.equip, q.pose, q.x, q.y, 0.72 * (1 - u), 0.45 * (1 - u)), 'glow');   // (black, a faint rim: shadows, not a red fog)
  const baseAdd = FX.add;
  FX.add = function (q) {
    if (q && q.type === 'hero' && MINE(q.equip) && (q.color === '#9dff8f' || q.color === '#bfe3ff')) {
      if ((H.ghostN = (H.ghostN || 0) + 1) % 2) return q;                           // (every other one: a cleaner trail)
      q.type = 'crowghost'; q.layer = 'glow'; q.life = 0.24;
    }
    return baseAdd.call(this, q);
  };

  // ---------------- the pictures: Codex-painted crows and feathers (assets/gen/make_crowdash_prompts.py) ----------------
  // (never drawn by code: the user, "อย่าวาดอีกา หรือเอฟเฟคแบบนั้นสิ ... ห้ามวาดเอฟเฟคเองนะ")
  const IMG = {};
  for (const n of ['crow_0', 'crow_1', 'crow_2', 'crow_3', 'feather_0', 'feather_1', 'feather_2', 'feather_3']) { IMG[n] = new Image(); IMG[n].src = 'assets/vfx2d/crowdash/' + n + '.png'; }
  const ok = (n) => IMG[n].complete && IMG[n].naturalWidth > 0;
  // (drawn at k times their own size: tools/cutout.py stored them at 2.5 px a world unit, the four crow poses at one scale)
  function pic(ctx, n, k) {
    if (!ok(n)) return;
    const im = IMG[n], w = im.naturalWidth / 2.5 * k, h = im.naturalHeight / 2.5 * k;
    ctx.drawImage(im, -w / 2, -h / 2, w, h);
  }
  // a feather: drifts, sways, turns, falls slowly, fades
  function feather(x, y, vx, vy, big) {
    const n = 'feather_' + ((Math.random() * 4) | 0), w = NC.rand(0.28, 0.42) * (big ? 1.25 : 1), sw = NC.rand(1.5, 3.2), ph = NC.rand(0, TAU);
    FX.add({ type: 'custom', layer: 'glow', x, y, vx, vy, drag: 2.2, life: NC.rand(0.9, 1.5), rot: NC.rand(0, TAU), spin: NC.rand(-6, 6),
      update(q, dt) { q.vy += (28 - q.vy) * Math.min(1, dt * 1.5); q.x += Math.sin(q.t * sw + ph) * 18 * dt; },
      draw(ctx, q, u) {
        ctx.save(); ctx.globalAlpha *= u < 0.1 ? u / 0.1 : 1 - Math.pow((u - 0.1) / 0.9, 2);
        ctx.translate(q.x, q.y); ctx.rotate(q.rot + Math.sin(q.t * sw + ph) * 0.6);
        ctx.filter = 'drop-shadow(0 0 2px rgba(255,40,64,0.7))';
        pic(ctx, n, w);
        ctx.restore();
      } });
  }
  // a crow: flaps off (the four poses as a wing beat: up, level, down, level), fades
  const BEAT = ['crow_0', 'crow_1', 'crow_2', 'crow_1'];
  function crow(x, y, vx, vy, s, delay) {
    delay = delay || 0;
    const ph = NC.rand(0, 4), fps = NC.rand(13, 17);
    FX.add({ type: 'custom', layer: 'glow', x, y, vx: 0, vy: 0, drag: 0.5, life: delay + NC.rand(0.75, 1.05), s,
      update(q, dt) { if (q.t < delay) return; if (!q.go) { q.go = 1; q.vx = vx; q.vy = vy; } q.vy -= 60 * dt; },
      draw(ctx, q, u) {
        if (q.t < delay) return;
        const v = (q.t - delay) / (q.life - delay), dir = vx >= 0 ? 1 : -1, n = BEAT[Math.floor(q.t * fps + ph) % 4];
        ctx.save(); ctx.globalAlpha *= v < 0.08 ? v / 0.08 : 1 - Math.pow((v - 0.08) / 0.92, 1.6);
        ctx.translate(q.x, q.y); ctx.scale(dir, 1); ctx.rotate(Math.atan2(q.vy, Math.abs(q.vx)) * 0.4);
        ctx.filter = 'drop-shadow(0 0 3px rgba(255,40,64,0.85))';
        pic(ctx, n, 0.62 * q.s);
        ctx.restore();
      } });
  }

  function start(game, p) {
    const back = -Math.sign((p.dash && p.dash.vx) || p.face || 1);
    for (let i = 0; i < 14; i++) feather(p.x + NC.rand(-16, 16), p.y - NC.rand(20, 95), back * NC.rand(30, 160) + NC.rand(-40, 40), NC.rand(-140, -10), true);
    const n = 4 + ((Math.random() * 3) | 0);
    // (spread out: each its own way up and back, a beat apart, so they read as separate birds, not a clump)
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + back * (0.35 + 1.0 * (i / Math.max(1, n - 1))) + NC.rand(-0.15, 0.15), sp = NC.rand(170, 280);
      crow(p.x + NC.rand(-24, 24), p.y - NC.rand(35, 100), Math.cos(a) * sp, Math.sin(a) * sp, NC.rand(1.0, 1.4), i * 0.035);
    }
  }
  function land(p) {
    for (let i = 0; i < 8; i++) { const a = NC.rand(0, TAU), sp = NC.rand(40, 110); feather(p.x + Math.cos(a) * 10, p.y - 50 + Math.sin(a) * 25, Math.cos(a) * sp, Math.sin(a) * sp * 0.6 - 30); }
  }
  // ---------------- the Shift dash's own looks (js/dash.js) in the set's black and red ----------------
  // (its speed streaks, the dust at the start / the end and the little ring are pale blue / beige for everyone)
  const V = NC.VFX, mineNow = () => !!(NC.game && NC.game.player && MINE(NC.game.player.equip));
  if (V) {
    const baseSmoke = V.smoke;
    V.smoke = function (x, y, n, fill, hi, o) {
      if (fill === '#cfc6b8' && mineNow()) return null;                            // (no dust: the feathers and crows are the burst)
      return baseSmoke.apply(this, arguments);
    };
    const baseRing = V.ring;
    V.ring = function (x, y, r0, r1, w, rgb, life, o) {
      if (rgb === '200,225,255' && mineNow()) return baseRing.call(this, x, y, r0, r1, w, '255,36,64', life, o);
      return baseRing.apply(this, arguments);
    };
  }
  const baseAdd2 = FX.add;
  FX.add = function (q) {
    if (q && q.type === 'vstreak' && q.rgb === '200,225,255' && mineNow()) q.rgb = '255,36,64';
    return baseAdd2.call(this, q);
  };
  CD.burst = () => NC.game && start(NC.game, NC.game.player);      // (tests)
})();
