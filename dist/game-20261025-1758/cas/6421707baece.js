/* vcstorm.js — the VOID COMET set's storm (the user, 2026-10-08: "อยากให้สกิลเปลี่ยนสายฟ้าทั้งหมดด้วย เวลาใส่ชุดนี้ หมาป่าเวลาพุ่งไป
   กับนก จะเป็นสายฟ้า ... เอฟเฟคสายฟ้าเวลาตี อยากให้ดุดันๆ มากกว่านี้ ใช้ blender ทำได้").
   The lightning pieces are Blender renders (tools/blender/storm_kit.py -> tools/storm_pack.py -> assets/vfx3d/storm: white-hot
   cores in cyan sheaths with the bloom baked in, on black, drawn 'lighter'); this file only places, stretches and times them.
   While the hero wears the set (NC.VoidComet.active):
     the hits     the chain lightning (js/voidcomet.js) jolts the first monster (a burst, a light, a shake) and crackles thick
                  Blender arcs from monster to monster with a burst on each; the lightning arrows land in a burst
     the skills   everything his skills make turns to lightning: the skill code runs in a "storm context" (his RUN calls,
                  their timers, the effects they spawn and those effects' own updates / draws, his skill ticks, his pets'
                  attacks) and in it every colour handed to the effect makers (NC.VFX, NC.SkillKit, FX.add fields) is mapped
                  onto the storm's blues by its brightness; arrows they shoot fly as lightning arrows, their bolts become
                  Blender arcs, their big rings get a ring of lightning, every monster they hit takes a burst; the spirit
                  pack runs as lightning wolves
     the pets     the wolf: a jump (the arrow's pounce, "ขย้ำ!", catching up) is a bolt from where it was to where it lands,
                  its rush at a monster a crackling streak, its bites a short arc; the falcon flies to its prey as a
                  streak of lightning and every dive is a strike from the sky; both flash white-blue while they do
   NC.VoidStorm: .on / .skills / .pets / .hits switch parts off; .arc / .strike / .burst / .ring / .sparks / .jolt make pieces. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, VC = NC.VoidComet;
  if (!FX || !V || !VC) return;
  const D = 'assets/vfx3d/storm/', TAU = Math.PI * 2, rand = NC.rand;
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const ST = (NC.VoidStorm = { on: true, skills: true, pets: true, hits: true });
  const IM = { arc: [0, 1, 2, 3].map((i) => load(D + 'arc_' + i + '.webp')), strike: [0, 1].map((i) => load(D + 'strike_' + i + '.webp')),
    burst: [0, 1].map((i) => load(D + 'burst_' + i + '.webp')), ring: [0, 1].map((i) => load(D + 'ring_' + i + '.webp')), spark: load(D + 'spark.webp') };
  let META = null;
  fetch(D + 'meta.json').then((r) => r.json()).then((j) => { META = j; }).catch(() => {});
  ST.ready = () => !!(ST.on && META && ok(IM.arc[0]) && ok(IM.burst[0]));
  const live = () => ST.ready() && VC.on && VC.active;
  const now = () => (NC.game ? NC.game.time : 0);
  const pt = (a) => (typeof a === 'function' ? a() : a);
  const frameOf = (M, f) => (M.down ? [0, f * M.h] : [f * M.w, 0]);

  // ---------------- the pieces ----------------
  // an arc between two points (or two getters: it follows them), 6 frames: a strike, forks, thinner, a second flash, embers
  function drawArc(ctx, A, B, f, v, w, flip) {
    const M = META.arc, im = IM.arc[v];
    if (!ok(im)) return;
    const dx = B[0] - A[0], dy = B[1] - A[1], dist = Math.hypot(dx, dy);
    if (dist < 6) return;
    const kx = dist / (M.b[0] - M.a[0]), ky = Math.max(0.42, Math.min(1.15, kx)) * (w || 1);
    const [sx, sy] = frameOf(M, f);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.translate(A[0], A[1]); ctx.rotate(Math.atan2(dy, dx)); ctx.scale(kx, flip ? -ky : ky);
    ctx.drawImage(im, sx, sy, M.w, M.h, -M.a[0], -M.a[1], M.w, M.h);
    ctx.restore();
  }
  ST.drawArc = drawArc;
  ST.arc = function (a, b, o) {
    o = o || {};
    const v = o.v === undefined ? (Math.random() * 4) | 0 : o.v, life = o.life || 0.26, delay = o.delay || 0, flip = Math.random() < 0.5;
    return FX.add({ type: 'custom', layer: 'glow', x: 0, y: 0, life: delay + life, storm: 1,
      draw(ctx, q) {
        const t = q.t - delay;
        if (t < 0 || !META) return;
        const f = Math.min(META.arc.frames - 1, Math.floor((t / life) * META.arc.frames));
        drawArc(ctx, pt(a), pt(b), f, v, o.w, flip);
      } });
  };
  // a flipbook standing on a ground point (strike: the bolt from the sky; burst: the impact; ring: flat on the ground)
  function flip(kind, x, y, k, life, o) {
    o = o || {};
    const M = META[kind], v = (Math.random() * M.n) | 0, im = IM[kind][v], anchor = M.ground || M.centre, mir = Math.random() < 0.5 ? -1 : 1;
    return FX.add({ type: 'custom', layer: o.layer || 'glow', x, y, life: (o.delay || 0) + life, storm: 1,
      draw(ctx, q) {
        const t = q.t - (o.delay || 0);
        if (t < 0 || !ok(im)) return;
        const f0 = o.from || 0, f = Math.min(M.frames - 1, f0 + Math.floor((t / life) * (M.frames - f0))), [sx, sy] = frameOf(M, f);   // (from: skip the first frames, the white flash)
        const at = o.follow ? o.follow() : [q.x, q.y];
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= o.alpha || 1;
        ctx.translate(at[0], at[1]); ctx.scale(k * mir, k);
        ctx.drawImage(im, sx, sy, M.w, M.h, -anchor[0], -anchor[1], M.w, M.h);
        ctx.restore();
      } });
  }
  ST.strike = (x, y, o) => { o = o || {}; V.light(x, y - 60, 340 * (o.size || 1), '120,210,255', 0.9, 0.3); return flip('strike', x, y, 0.95 * (o.size || 1), o.life || 0.4, o); };
  const recent = [];                                          // (bursts just made: a second one on the same spot is skipped)
  ST.burst = (x, y, o) => {
    o = o || {};
    const t = now();
    while (recent.length && t - recent[0][2] > 0.09) recent.shift();
    if (recent.some((r) => Math.abs(r[0] - x) < 45 && Math.abs(r[1] - y) < 35)) return null;
    recent.push([x, y, t]);
    return flip('burst', x, y, (o.r || 50) / META.burst.unit, o.life || 0.34, Object.assign({ alpha: 0.85 }, o));
  };
  ST.ring = (x, y, r, o) => flip('ring', x, y, r / META.ring.r, (o && o.life) || 0.4, o);
  // little forked sparks thrown out of a point
  ST.sparks = function (x, y, n, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(160, 420) * (o.speed || 1), k = rand(0.35, 0.7) * (o.size || 1), s = (Math.random() * 8) | 0, rot = rand(0, TAU);
      FX.add({ type: 'custom', layer: 'glow', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 40, drag: 7, life: rand(0.16, 0.3), storm: 1,
        draw(ctx, q, u) {
          if (!ok(IM.spark)) return;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 1 - u * u;
          ctx.translate(q.x, q.y); ctx.rotate(rot + q.t * 9); ctx.scale(k, k);
          ctx.drawImage(IM.spark, s * 64, 0, 64, 64, -32, -32, 64, 64);
          ctx.restore();
        } });
    }
  };
  // the first monster of a chain: a burst, a flash of light, a jolt of the screen
  ST.jolt = function (game, e) {
    ST.burst(e.x, e.y, { r: 54, life: 0.36 });
    ST.sparks(e.x, VC.midY ? VC.midY(e) : e.y - 50, 7, { speed: 1.2 });
    V.light(e.x, e.y - 50, 300, '120,210,255', 0.9, 0.22);
    V.shake(game, 4); V.stop(game, 0.03);
  };

  // ---------------- the storm context: his skills' colours turned to lightning ----------------
  let CTX = 0;
  const mine = (p) => !!(p && NC.game && p === NC.game.player && live() && ST.skills);
  const inCtx = (fn) => { if (typeof fn !== 'function' || fn._vcs) return fn; const g = function () { CTX++; try { return fn.apply(this, arguments); } finally { CTX--; } }; g._vcs = 1; return g; };
  // a colour by its brightness onto the storm's ramp: deep blue -> electric blue -> cyan -> white-cyan
  const RAMP = [[0, [16, 34, 120]], [0.38, [36, 130, 255]], [0.66, [110, 215, 255]], [0.86, [190, 242, 255]], [1, [240, 253, 255]]];
  function zap(r, g, b) {
    const L = Math.min(1, ((0.3 * r + 0.55 * g + 0.15 * b) / 255) * 0.75 + (Math.max(r, g, b) / 255) * 0.3);
    if (L < 0.2) return [r, g, b];                            // (darks stay dark: a skill's dimming of the screen is no blue flash)
    for (let i = 1; i < RAMP.length; i++) if (L <= RAMP[i][0]) {
      const [a0, c0] = RAMP[i - 1], [a1, c1] = RAMP[i], u = (L - a0) / (a1 - a0 || 1);
      return c0.map((c, j) => Math.round(c + (c1[j] - c) * u));
    }
    return RAMP[RAMP.length - 1][1];
  }
  const RGB_RE = /^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$/, HEX_RE = /^#([0-9a-f]{6})$/i, memo = new Map();
  function recol(v) {
    if (typeof v === 'string') {
      let out = memo.get(v);
      if (out !== undefined) return out;
      let m;
      if ((m = RGB_RE.exec(v))) out = zap(+m[1], +m[2], +m[3]).join(',');
      else if ((m = HEX_RE.exec(v))) { const n = parseInt(m[1], 16); out = '#' + zap(n >> 16, (n >> 8) & 255, n & 255).map((x) => x.toString(16).padStart(2, '0')).join(''); }
      else out = v;
      memo.set(v, out);
      return out;
    }
    if (Array.isArray(v) && v.length >= 1 && v.length <= 6 && typeof v[0] === 'string' && HEX_RE.test(v[0])) return v.map((x) => (typeof x === 'string' ? recol(x) : x));   // (a palette, a tint)
    return v;
  }
  const FIELDS = ['rgb', 'rgb2', 'color', 'colour', 'fill', 'pal', 'tint', 'glow', 'hi', 'col', 'stroke', 'edge', 'core'];
  function recolObj(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
    for (const k of FIELDS) if (o[k] !== undefined) o[k] = recol(o[k]);
    return o;
  }
  // (only plain option objects: never a monster, the hero, the game or a canvas, whose own colours must stay)
  const plain = (v) => v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype && v.hp === undefined && !v.enemies && !v.equip;
  const recolArgs = (args) => { for (let i = 0; i < args.length; i++) { const v = args[i]; if (typeof v === 'string' || Array.isArray(v)) args[i] = recol(v); else if (plain(v)) recolObj(v); } };

  // the effect makers: their colours mapped while in the context (V.at keeps the context for its callback)
  const SKIP = new Set(['at', 'fade', 'shake', 'stop', 'ease', 'curve']);
  for (const [name, fn] of Object.entries(V)) {
    if (typeof fn !== 'function' || SKIP.has(name)) continue;
    V[name] = function () { if (CTX > 0 && live()) recolArgs(arguments); return fn.apply(this, arguments); };
  }
  const baseAt = V.at;
  V.at = function (delay, fn) { return baseAt.call(this, delay, CTX > 0 ? inCtx(fn) : fn); };
  // its bolts: the Blender arc; its big rings: a ring of lightning on top
  const baseBolt = V.boltAt;
  V.boltAt = function (x0, y0, x1, y1, rgb, life) {
    if (CTX > 0 && live()) { ST.arc([x0, y0], [x1, y1], { life: Math.max(0.2, life || 0.25) }); return null; }
    return baseBolt.apply(this, arguments);
  };
  const baseRing = V.ring;
  let ringT = -1;
  V.ring = function (x, y, r0, r1) {
    if (CTX > 0 && live() && r1 >= 140) { if (now() > ringT) { ringT = now() + 0.2; ST.ring(x, y, r1 * 0.75); } return null; }
    return baseRing.apply(this, arguments);
  };
  if (K) {
    for (const [name, fn] of Object.entries(K)) {
      if (typeof fn !== 'function' || name === 'S' || name === 'def') continue;
      K[name] = function () { if (CTX > 0 && live()) recolArgs(arguments); return fn.apply(this, arguments); };
    }
    // the arrows his skills shoot: lightning arrows
    const baseArrow = K.drawArrow;
    K.drawArrow = function (ctx, q, rgb, scale) {
      if (CTX > 0 && live() && VC.arrowPic) {
        const big = (scale || 1) > 1.25, im = VC.arrowPic(big, q.t || 0);
        if (im) {
          const L = (big ? 150 : 96) * Math.max(0.8, Math.min(1.6, scale || 1)), h = (im.naturalHeight * L) / im.naturalWidth;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(q.x, q.y); ctx.rotate(Math.atan2(q.vy, q.vx)); ctx.drawImage(im, -L * 0.9, -h / 2, L, h); ctx.restore();
          if (Math.random() < 0.35) ST.sparks(q.x, q.y, 1, { size: 0.7, speed: 0.6 });
          return;
        }
      }
      return baseArrow.apply(this, arguments);
    };
    // every monster his skills hit: a burst of lightning (not too many at once)
    const baseHit = K.hit, hitT = new WeakMap();
    let budgetT = 0, budget = 0;
    K.hit = function (game, p, id, e) {
      const r = baseHit.apply(this, arguments);
      if (CTX > 0 && live() && ST.hits && e && e.hp !== undefined && (hitT.get(e) || -1) < now()) {
        if (now() > budgetT) { budgetT = now() + 0.1; budget = 6; }
        if (budget-- > 0) { hitT.set(e, now() + 0.14); ST.burst(e.x, e.y, { r: 36, life: 0.28, from: 1, alpha: 0.6 }); ST.sparks(e.x, VC.midY ? VC.midY(e) : e.y - 50, 2); }
      }
      return r;
    };
  }
  // the effects spawned in the context: their colours, and their own updates / draws / ends keep the context
  const baseAdd = FX.add;
  FX.add = function (q) {
    if (CTX > 0 && q && !q.storm && live()) {
      recolObj(q);
      if (q.update) q.update = inCtx(q.update);
      if (q.draw) q.draw = inCtx(q.draw);
      if (q.onEnd) q.onEnd = inCtx(q.onEnd);
      if (q.type === 'vspiritwolf' && ST.pets) q.type = 'vcspiritwolf';
    }
    return baseAdd.apply(this, arguments);
  };
  // the spirit pack as lightning wolves: the set's wolf running, burning white-blue, a bolt crackling behind it
  FX.def('vcspiritwolf', (ctx, q, u) => {
    const a = V.fade(u, 0.1, 0.2), face = q.vx > 0;
    if (!q.from) q.from = [q.x - q.vx * 0.12, q.y - q.vy * 0.12];
    const back = [q.x - q.vx * 0.16, q.y - 40 - q.vy * 0.16];
    if (META) drawArc(ctx, back, [q.x, q.y - 40], Math.floor(q.t * 30) % 6, ((q.x * 7) | 0) & 3, 0.9, (Math.floor(q.t * 20) & 1) === 1);
    if (VC.drawPet) {
      const st = { age: 1, amp: 1, ph: q.t * 16 };
      ctx.save(); ctx.globalAlpha *= a;
      ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'brightness(1.5) saturate(0.6)';
      VC.drawPet(ctx, 'wolf', st, q.x, q.y, { flip: face, scale: 1.1, alpha: 0.6 }, false);
      ctx.filter = 'blur(3px) brightness(2)'; VC.drawPet(ctx, 'wolf', st, q.x, q.y, { flip: face, scale: 1.1 }, true);
      ctx.filter = 'none'; VC.drawPet(ctx, 'wolf', st, q.x, q.y, { flip: face, scale: 1.1 }, true);
      ctx.restore();
    }
  }, 'glow');

  // his skills, his skill ticks, his pets' attacks: run in the context (wrapped as they are found: other files add some late)
  const RUN = NC.SKILL_RUN || {};
  function wrapAll() {
    for (const id of Object.keys(RUN)) {
      const fn = RUN[id];
      if (typeof fn !== 'function' || fn._vcsRun) continue;
      const g = function (game, p) { if (!mine(p)) return fn.apply(this, arguments); CTX++; try { return fn.apply(this, arguments); } finally { CTX--; } };
      g._vcsRun = 1; g._orig = fn; RUN[id] = g;   // (_orig: the real one, read by js/bl_runes.js to tell a skill's kind)
    }
    const T = NC.skillTicks || [];
    for (let i = 0; i < T.length; i++) {
      const fn = T[i];
      if (typeof fn !== 'function' || fn._vcsTick) continue;
      const g = function (game, p) { if (!mine(p)) return fn.apply(this, arguments); CTX++; try { return fn.apply(this, arguments); } finally { CTX--; } };
      g._vcsTick = 1; T[i] = g;
    }
  }
  let wrapT = -1;

  // ---------------- the pets as lightning ----------------
  const ZAP = new WeakMap();                                  // (pet -> until when it shows as lightning)
  let falconZap = 0;
  VC.zapOf = (type, q) => {
    if (!live() || !ST.pets) return 0;
    if (type === 'falcon') return falconZap > now() ? 1 : 0;
    const u = q && ZAP.get(q);
    return u && u > now() ? Math.min(1, (u - now()) / 0.15) : 0;
  };
  const WOLF = { last: null, trail: [] };
  function watchWolf(game, p, dt) {
    const w = NC.Pets && NC.Pets.get('wolf');
    if (!w || w.owner !== p) { WOLF.last = null; return; }
    if (w.act && !w.act._vcs) { const a0 = w.act; w.act = inCtx(function (g, q, e) { if (mine(p) && ST.pets) { ST.arc(() => [q.x + q.face * 20, q.y - 30], () => [e.x, VC.midY ? VC.midY(e) : e.y - 50], { life: 0.2, w: 0.8 }); ZAP.set(q, now() + 0.18); } return a0.apply(this, arguments); }); }
    const L = WOLF.last;
    if (L && L.map === game.mapId) {
      const d = Math.hypot(w.x - L.x, w.y - L.y);
      // a jump (the pounce, "ขย้ำ!", catching up): a bolt from where it was to where it lands
      if (d > 110 && d < 1400) {
        const A = [L.x, L.y - 30], B = [w.x, w.y - 30];
        ST.arc(A, B, { life: 0.3, w: 1.5 }); ST.arc(A, B, { life: 0.24, w: 0.9, delay: 0.04 });
        ST.burst(L.x, L.y, { r: 34, life: 0.26 }); ST.burst(w.x, w.y, { r: 52, life: 0.34 }); ST.sparks(w.x, w.y - 30, 6);
        V.light(w.x, w.y - 40, 260, '120,210,255', 0.8, 0.25);
        ZAP.set(w, now() + 0.45);
      } else if (w.target && w.moving && d / Math.max(dt, 1e-3) > 300) {
        // its rush at a monster: a crackling streak behind it
        WOLF.trail.push([w.x, w.y - 32, now()]);
        ZAP.set(w, now() + 0.16);
      }
    }
    while (WOLF.trail.length && now() - WOLF.trail[0][2] > 0.14) WOLF.trail.shift();
    if (WOLF.trail.length > 1 && now() > (WOLF.trailT || 0)) {
      WOLF.trailT = now() + 0.06;
      const A = WOLF.trail[0], B = WOLF.trail[WOLF.trail.length - 1];
      if (Math.hypot(B[0] - A[0], B[1] - A[1]) > 30) ST.arc([A[0], A[1]], () => [w.x, w.y - 32], { life: 0.12, w: 0.75 });
      if (Math.random() < 0.5) ST.sparks(w.x - w.face * 30, w.y - 30, 1, { size: 0.8 });
    }
    WOLF.last = { x: w.x, y: w.y, map: game.mapId };
  }
  // the falcon: a streak of lightning on its way, a strike from the sky at every dive (js/skills_v21.js: f.st, f.left)
  const FAL = new WeakMap();
  if (NC.PetRig && NC.PetRig.falcon) {
    const baseFalcon = NC.PetRig.falcon;
    NC.PetRig.falcon = function (ctx, game, p, f) {
      if (live() && ST.pets && p === game.player && f) {
        const m = FAL.get(f) || { pts: [], left: f.left, st: f.st };
        FAL.set(f, m);
        if (f.st === 'go' || f.st === 'back') {
          m.pts.push([f.x, f.y, now()]);
          falconZap = now() + 0.12;
        }
        while (m.pts.length && now() - m.pts[0][2] > 0.12) m.pts.shift();
        if (m.pts.length > 1) { const A = m.pts[0]; drawArc(ctx, [A[0], A[1]], [f.x, f.y], Math.floor(now() * 28) % 6, 1, 0.9, (Math.floor(now() * 18) & 1) === 1); }
        if (f.st === 'strike' && f.left !== m.left && f.e) {
          const e = f.e;
          m.n = (m.n || 0) + 1;
          if (m.n % 2) { ST.strike(e.x, e.y, { size: 0.62, life: 0.3, alpha: 0.9 }); V.shake(game, 2); }
          ST.burst(e.x, e.y, { r: 40, life: 0.28 }); ST.sparks(e.x, e.y - 50, 3);
          falconZap = now() + 0.2;
        }
        if (f.st === 'strike' && m.st !== 'strike') falconZap = now() + 0.25;
        m.left = f.left; m.st = f.st;
      }
      return baseFalcon.apply(this, arguments);
    };
  }

  // ---------------- each frame ----------------
  if (NC.skillTicks) NC.skillTicks.push((game, p, dt) => {
    if (now() > wrapT) { wrapT = now() + 3; wrapAll(); }
    if (live() && ST.pets && p === game.player) watchWolf(game, p, dt);
    else WOLF.last = null;
  });
})();
