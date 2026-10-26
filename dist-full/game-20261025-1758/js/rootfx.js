/* rootfx.js — the ROOTBOUND set's own tricks (the user, 2026-10-08: "เพิ่มเอฟเฟคชุดยังไงดี มันดูง่ายไปหน่อย" -> all four):
     roots    standing still a moment, black roots with violet sap creep out of the robe's hem across the ground round him;
              they draw back in as he walks; walking leaves small root cracks behind; crystal leaves drift down off him
     eye      the void eye on the hood is alive: it looks at the nearest monster, blinks now and then, opens wide when he
              casts (frames laid over the hood's own eye, drawn the hood's way: avatar.js's silhouette path, '#rooteye')
     sap      light runs along the sap lines from the chest outward on every cast and every few hits (the glow layer of
              js/rootbound.js revealed by a ring growing from the chest, a little hotter red)
     awake    25+ hits in a fight -> the AWAKENED form for 10 s: the hood's branches grow into antlers with crystal leaves
              (hat_rootbound_awake), the roots stay out and grow, leaves fall thick, the sap glows stronger and pulses on
   Every picture is Codex art (assets/gen/make_rootbound_prompts.py fx -> tools/rootfx_cut.py -> assets/rootbound/fx,
   assets/fashion/hat_rootbound_awake): the code only places, reveals, moves and tints them. Local player only.
   NC.RootFX.on = false switches it all off (.roots / .eye / .sap / .awake one by one); NC.RootFX.wake() = awaken now. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, RB = NC.Rootbound, ITEMS = NC.ITEMS;
  if (!RB || !FX || !ITEMS.hat_rootbound) return;
  const RF = (NC.RootFX = { on: true, roots: true, eye: true, sap: true, awake: true, need: 25, dur: 10 });
  const MINE = (e) => !!e && (e.robe === 'robe_rootbound' || e.hat === 'hat_rootbound' || e.weapon === 'staff_rootbound');
  const D = 'assets/rootbound/fx/', PPU = 3, TAU = Math.PI * 2, rand = NC.rand;
  const load = (n) => { const im = new Image(); im.src = D + n; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const pair = (n) => ({ img: load(n + '.png'), vein: load(n + '_vein.png') });
  // (tools/rootfx_cut.py prints these: fx.json)
  const ROOTS = [[285, 135, 4, 45.5], [220, 116, 4, 33], [205, 97, 4, 29], [167, 104, 4, 36], [180, 91, 4, 33.5], [124, 85, 4, 26.5]]
    .map(([w, h, ax, ay], i) => Object.assign(pair('root_' + i), { w, h, ax, ay }));
  const CRACKS = [0, 1, 2, 3].map((i) => pair('crack_' + i)), LEAVES = [0, 1, 2, 3].map((i) => pair('leaf_' + i));
  const EYES = [0, 1, 2, 3].map((i) => pair('eye_' + i)), PUPIL = load('pupil.png'), NOEYE = load('hat_rootbound_vein_noeye.png');
  const EYE = { cx: 205.4, cy: 105.8, mx: 12, my: 7 };            // (the iris centre in the hood picture; how far the pupil travels)
  const AWAKE = { sprite: 'hat_rootbound_awake', fit: +(1.935 * 1.5 / 1.778).toFixed(3), seat: 0.665, dx: 0.06 };   // (its own skincut fit, shrunk like the hood's)

  // ---------------- the state of the local hero ----------------
  const S = { p: null, t: -1, still: 0, grow: 0, ring: null, crackT: 0, leafT: 0, blinkAt: 3, blink: -1, wideT: -9, look: [0, 0],
    charge: 0, lastHit: -9, hitT: -9, awake: 0, cool: 0, pulses: [], pulseT: 0, low: null, glow: null };
  const awakeOn = () => S.awake > 0;
  function newRing() {
    const n = 7, a0 = rand(0, TAU);
    S.ring = Array.from({ length: n }, (_, i) => ({ a: a0 + (i / n) * TAU + rand(-0.25, 0.25), i: (i + ((Math.random() * 6) | 0)) % 6, k: rand(0.8, 1.05),
      d: rand(0, 0.45), flip: Math.random() < 0.5 }));
  }
  function tick(game, p) {
    const t = game.time, dt = S.t < 0 ? 0 : Math.min(0.1, Math.max(0, t - S.t));
    S.t = t;
    const moving = Math.hypot(p.vx || 0, p.vy || 0) > 25 && !p.casting;
    S.still = moving ? 0 : S.still + dt;
    // roots: out after a moment standing (always while awake), back in when he walks
    const want = RF.roots && (awakeOn() || S.still > 1.1) ? 1 : 0;
    if (want && S.grow <= 0.001) newRing();
    S.grow = want ? Math.min(1, S.grow + dt * (awakeOn() ? 1.6 : 0.55)) : Math.max(0, S.grow - dt * 3.2);
    if (!S.ring) newRing();
    if (!S.low || !FX.list.includes(S.low)) S.low = FX.add({ type: 'custom', layer: 'low', x: p.x, y: p.y, life: 1e9, draw: (ctx) => drawRoots(ctx, false) });
    if (!S.glow || !FX.list.includes(S.glow)) S.glow = FX.add({ type: 'custom', layer: 'glow', x: p.x, y: p.y, life: 1e9, draw: (ctx) => drawRoots(ctx, true) });
    // cracks behind him as he walks, leaves drifting off him
    if (RF.roots && moving && t > S.crackT) { S.crackT = t + 0.3; crack(p.x + rand(-8, 8), p.y + rand(-3, 3), rand(0.5, 0.65)); }
    if (RF.roots && t > S.leafT) { S.leafT = t + (awakeOn() ? rand(0.1, 0.22) : rand(0.6, 1.2)); leaf(p.x + rand(-26, 26), p.y - rand(40, 105)); }
    // the eye: blinks, looks at the nearest monster, wide while casting
    if (S.blink < 0 && t > S.blinkAt) { S.blink = 0; S.blinkAt = t + rand(2.5, 5.5); }
    if (S.blink >= 0) { S.blink += dt; if (S.blink > 0.24) S.blink = -1; }
    let tx = Math.sin(t * 0.7) * 0.5, ty = Math.sin(t * 0.43) * 0.4;
    let best = null, bd = 650;
    for (const e of game.enemies) { if (!(e.hp > 0) || e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
    if (best) { const dx = best.x - p.x, dy = (best.y - 40) - (p.y - 110), L = Math.hypot(dx, dy) || 1; tx = (dx / L) * (p.face < 0 ? -1 : 1); ty = dy / L; }
    S.look[0] += (tx - S.look[0]) * Math.min(1, dt * 8); S.look[1] += (ty - S.look[1]) * Math.min(1, dt * 8);
    // the awakened form
    if (S.awake > 0) { S.awake -= dt; if (S.awake <= 0) { S.awake = 0; S.cool = 6; RB.str = 1; } }
    else if (S.cool > 0) S.cool -= dt;
    if (t - S.lastHit > 3) S.charge = Math.max(0, S.charge - dt * 8);
    if (RF.awake && !S.awake && S.cool <= 0 && S.charge >= RF.need) wake(game, p);
    // the sap: a pulse now and then, many while awake
    if (RF.sap && t > S.pulseT) { S.pulseT = t + (awakeOn() ? 0.55 : 3.5); pulse(t); }
    S.pulses = S.pulses.filter((q) => t - q < 0.8);
  }
  const pulse = (t) => { if (S.pulses.length < 6) S.pulses.push(t); };
  function wake(game, p) {
    S.awake = RF.dur; S.charge = 0; RB.str = 1.7; S.wideT = game.time;
    newRing(); S.grow = Math.max(S.grow, 0.2);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + rand(-0.2, 0.2), r = rand(30, 62); crack(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.55, rand(0.7, 0.95)); }
    for (let i = 0; i < 14; i++) leaf(p.x + rand(-40, 40), p.y - rand(40, 140), true);
    for (let i = 0; i < 3; i++) pulse(game.time + i * 0.18);
    FX.text && FX.text(p.x, p.y - 190, 'รากตื่น!', '#e080ff', 34);
    if (NC.VFX && NC.VFX.shake) NC.VFX.shake(game, 4);
  }
  RF.wake = () => { const g = NC.game, p = g && g.player; if (p && MINE(p.equip)) wake(g, p); };
  RF.pulse = () => pulse(S.t);                                  // (for clips: the sap now)
  RF.wide = () => { S.wideT = S.t; };                           // (for clips: the eye opens wide)

  // ---------------- the ground ----------------
  const SQ = 0.55;
  function drawRoots(ctx, glow) {
    const p = S.p;
    if (!RF.on || !p || !S.ring || S.grow <= 0.01 || !MINE(p.equip)) return;
    const big = awakeOn() ? 1.25 : 1, beat = 0.6 + 0.4 * Math.sin((S.t || 0) * 3.1);
    for (const r of S.ring) {
      const R = ROOTS[r.i], im = glow ? R.vein : R.img;
      if (!ok(im)) continue;
      const u = Math.max(0, Math.min(1, (S.grow - r.d) / (1 - r.d)));
      if (u <= 0.02) continue;
      const e = 1 - Math.pow(1 - u, 2.2);
      const dx = Math.cos(r.a), dy = Math.sin(r.a) * SQ, ang = Math.atan2(dy, dx), L = Math.hypot(dx, dy);
      const k = (r.k * big) / PPU, w = R.w * k, h = R.h * k;
      ctx.save();
      ctx.translate(p.x + dx * 12, p.y + 3 + dy * 12);
      ctx.rotate(ang); ctx.scale(L * 0.35 + 0.65, r.flip ? -1 : 1);
      ctx.beginPath(); ctx.rect(-R.ax * k - 2, -h, (w + 4) * e, h * 2); ctx.clip();       // (revealed from the base to the tip)
      if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= (awakeOn() ? 0.95 : 0.7) * beat; }
      ctx.drawImage(im, -R.ax * k, -R.ay * k, w, h);
      ctx.restore();
    }
  }
  function crack(x, y, s) {
    const c = CRACKS[(Math.random() * 4) | 0], rot = rand(-0.4, 0.4);
    const draw = (glow) => (ctx, q) => {
      const im = glow ? c.vein : c.img; if (!ok(im)) return;
      const grow = Math.min(1, q.t / 0.12), fade = Math.min(1, (q.life - q.t) / (glow ? 0.6 : 1));
      const k = (s * grow) / PPU, w = im.naturalWidth * k, h = im.naturalHeight * k;
      ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1, SQ + 0.15); ctx.rotate(rot);
      ctx.globalAlpha *= fade * (glow ? 0.8 : 1); if (glow) ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
    };
    FX.add({ type: 'custom', layer: 'low', x, y, life: 2.2, draw: draw(false) });
    FX.add({ type: 'custom', layer: 'glow', x, y, life: 1.2, draw: draw(true) });
  }
  function leaf(x, y, burst) {
    const L = LEAVES[(Math.random() * 4) | 0];
    FX.add({ type: 'custom', layer: 'glow', x, y, life: rand(1.4, 2.2), vx: burst ? rand(-90, 90) : rand(-12, 12), vy: burst ? rand(-120, -40) : rand(22, 40),
      grav: burst ? 160 : 0, drag: burst ? 1.4 : 0, rot: rand(0, TAU), spin: rand(-3, 3), ph: rand(0, 6),
      update(q, dt) { q.x += Math.sin(q.t * 2.4 + q.ph) * 22 * dt; },
      draw(ctx, q, u) {
        if (!ok(L.img)) return;
        const a = (u < 0.1 ? u / 0.1 : 1) * (1 - Math.max(0, (u - 0.6) / 0.4)), k = 1 / PPU, w = L.img.naturalWidth * k, h = L.img.naturalHeight * k;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha *= a;
        ctx.drawImage(L.img, -w / 2, -h / 2, w, h);
        if (ok(L.vein)) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.8; ctx.drawImage(L.vein, -w / 2, -h / 2, w, h); }
        ctx.restore();
      } });
  }

  // ---------------- the eye on the hood ----------------
  const ecv = document.createElement('canvas'), ec = ecv.getContext('2d');
  const gcv = document.createElement('canvas'), gc = gcv.getContext('2d');
  const EMPTY = document.createElement('canvas'); EMPTY.width = EMPTY.height = 1;
  const eyeOn = () => RF.on && RF.eye && S.p && S.p.equip.hat === 'hat_rootbound' && !awakeOn() && EYES.every((e) => ok(e.img));
  function frameNow() {
    if (S.blink >= 0) { const b = S.blink / 0.24; return b < 0.25 || b > 0.75 ? 1 : 0; }
    return (S.t - S.wideT < 0.7 || (S.p && S.p.casting)) ? 3 : 2;
  }
  function compose() {
    const f = frameNow(), im = EYES[f].img, W = im.naturalWidth, H = im.naturalHeight;
    for (const c of [ecv, gcv]) if (c.width !== W) { c.width = W; c.height = H; }
    ec.clearRect(0, 0, W, H); ec.drawImage(im, 0, 0);
    let pp = null;
    if (f >= 2 && ok(PUPIL)) {
      const s = f === 3 ? 1.15 : 1.35, pw = PUPIL.naturalWidth * s, ph = PUPIL.naturalHeight * s;
      pp = [EYE.cx + S.look[0] * EYE.mx - pw / 2, EYE.cy + S.look[1] * EYE.my - ph / 2, pw, ph];
      ec.filter = 'brightness(0.35)'; ec.drawImage(PUPIL, pp[0], pp[1], pp[2], pp[3]); ec.filter = 'none';   // (darker than drawn: it has to read against the glow)
    }
    gc.clearRect(0, 0, W, H);
    if (ok(NOEYE)) gc.drawImage(NOEYE, 0, 0);
    if (ok(EYES[f].vein)) { gc.globalAlpha = f === 3 ? 1 : 0.8; gc.drawImage(EYES[f].vein, 0, 0); gc.globalAlpha = 1; }
    // (the night's glow over the eye would wash the black pupil out: a hole in the glow where the pupil is)
    if (pp) { gc.globalCompositeOperation = 'destination-out'; gc.drawImage(PUPIL, pp[0] - 2, pp[1] - 2, pp[2] + 4, pp[3] + 4); gc.globalCompositeOperation = 'source-over'; }
  }
  const baseTinted = NC.tinted;
  NC.tinted = function (name, colour) {
    if (colour === '#rooteye') return name === 'hat_rootbound' ? ecv : EMPTY;
    if (colour === RB.KEY && name === 'hat_rootbound' && eyeOn()) return gcv;      // (the hood's glow follows the eye)
    return baseTinted.apply(this, arguments);
  };

  // ---------------- drawing the local hero ----------------
  let drawing = false;
  const swapHood = (on) => {
    const h = ITEMS.hat_rootbound;
    if (on) { h._rf = { sprite: h.sprite, fit: h.fit, seat: h.seat, dx: h.dx }; Object.assign(h, AWAKE); }
    else if (h._rf) { Object.assign(h, h._rf); delete h._rf; }
  };
  const awakeHood = () => RF.on && awakeOn() && S.p && S.p.equip.hat === 'hat_rootbound' && NC.SPR[AWAKE.sprite];
  const baseDP = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game && game.player;
    if (!RF.on || !p || !MINE(p.equip) || p.dead > 0) { if (S.awake && p && !MINE(p.equip)) { S.awake = 0; RB.str = 1; } return baseDP.apply(this, arguments); }
    S.p = p; tick(game, p);
    const sw = awakeHood(); if (sw) swapHood(true);
    drawing = true;
    try { return baseDP.apply(this, arguments); } finally { drawing = false; if (sw) swapHood(false); }
  };
  const baseTrail = NC.drawTrail;
  NC.drawTrail = function () {
    const sw = awakeHood(); if (sw) swapHood(true);
    try { return baseTrail.apply(this, arguments); } finally { if (sw) swapHood(false); }
  };
  const baseDH = NC.drawHero;
  NC.drawHero = function (ctx, equip, P, x, y, o) {
    const r = baseDH.apply(this, arguments);
    if (drawing && S.p && equip === S.p.equip && !(o && o.silhouette) && eyeOn()) {
      compose();
      baseDH.call(NC, ctx, equip, P, x, y, Object.assign({}, o || {}, { silhouette: '#rooteye', tint: null }));
    }
    return r;
  };

  // ---------------- the sap running along the lines (after the glow of js/rootbound.js) ----------------
  const fcv = document.createElement('canvas'), fc = fcv.getContext('2d');
  RB.extra = function (q) {
    if (!RF.on || !RF.sap || !S.pulses.length) return;
    const { ctx, off, ox, oy, B, sc, shot } = q, m = shot.m;
    const wx = shot.x, wy = shot.y - 50, chx = m.a * wx + m.c * wy + m.e - ox, chy = m.b * wx + m.d * wy + m.f - oy;
    if (fcv.width !== B) { fcv.width = B; fcv.height = B; }
    for (const t0 of S.pulses) {
      const u = (S.t - t0) / 0.8;
      if (u < 0 || u > 1) continue;
      const R = (8 + 120 * (1 - Math.pow(1 - u, 2))) * sc, band = 24 * sc;
      fc.globalCompositeOperation = 'copy'; fc.drawImage(off, 0, 0);
      fc.globalCompositeOperation = 'destination-in';
      const g = fc.createRadialGradient(chx, chy, Math.max(0, R - band), chx, chy, R + band);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      fc.fillStyle = g; fc.fillRect(0, 0, B, B);
      fc.globalCompositeOperation = 'source-over';
      const a = (1 - u) * (awakeOn() ? 1 : 0.85);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
      // (hotter: the violet shifted toward blood red; the glow layers are black where they don't glow, so 'lighter' and a hue
      // shift leave the rest untouched)
      const hot = 'hue-rotate(38deg) saturate(1.6) ';
      ctx.filter = hot + `blur(${Math.max(2, 5 * sc).toFixed(1)}px)`; ctx.globalAlpha = a; ctx.drawImage(fcv, ox, oy); ctx.drawImage(fcv, ox, oy); ctx.drawImage(fcv, ox, oy);
      ctx.filter = hot; ctx.globalAlpha = a; ctx.drawImage(fcv, ox, oy); ctx.filter = 'none';
      ctx.restore();
    }
  };

  // ---------------- casts and hits ----------------
  const baseCast = NC.castSkill;
  NC.castSkill = function (game, p) {
    const r = baseCast.apply(this, arguments);
    if (r && RF.on && p && game && p === game.player && MINE(p.equip)) { S.wideT = game.time; pulse(game.time); }
    return r;
  };
  const baseHH = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHH.apply(this, arguments);
    const G = NC.game, p = G && G.player;
    if (RF.on && p && d === p.d && r && r.dmg > 0 && MINE(p.equip)) {
      S.lastHit = G.time;
      if (G.time - S.hitT > 0.12) { S.hitT = G.time; if (!S.awake) S.charge++; if (Math.random() < 0.25) pulse(G.time); }
    }
    return r;
  };
})();
