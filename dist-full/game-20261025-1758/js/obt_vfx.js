/* obt_vfx.js — the OBT lines' skill effects, ENGINE-STYLE (2026-10-20). After the first skill preview the user wanted far
   more ("ออกเเบบให้บึ้มๆบั้มๆ หน่อยสิ ... ไม่ว้าวไม่เร้าใจ"), found 12-frame painted sheets rough ("เฟรมสกิลที่ไม่หยาบ"), picked
   particles + shaders with single high-res paintings, then "ใช้ระบบเเสงเราด้วยสิ เเสงกับเฟรมก็ได้นะ ... เเต่เฟรมรูปต้องสมูท คนจะ
   ไม่รู้ว่าใช้รูปเหมือน maple" -> the ลังไม้กระแทก sample passed: "แนวนี้ผ่าน ทำสกิลที่เหลือของทั้ง 3 สายแบบเดียวกันเลย".
   Three kinds of painting, all Codex, nothing drawn by code (the user's rule: code only places, turns, stretches, fades and
   dissolves the paintings):
     FRAMES   the core of a blow, a ring of sound, a swoosh (assets/obtboom/: make_obtboom_prompts.py -> obtboom_cut.py),
              played SMOOTHLY: each frame melts into the next over its whole time, the picture keeps growing between frames,
              the shader eats it away at the end (never a visible step)
     PIECES   big single paintings moved every frame as particles (assets/obtvfx/: make_crateslam_prompts.py,
              make_obthd_prompts.py -> crateslam_cut.py, obthd_cut.py): debris and coins flung with gravity and a bounce,
              dust and gas that bloom, churn and dissolve (js/paintgl.js erosion), bells and crates falling, sparks
              stretched along their flight, marks left on the ground
     LIGHT    the game's own light kit (js/lightkit.js: spikes, glints, notes, rings of light, pillars, glowing cracks,
              its bloom and exposure) in each line's colours, the night lit round every blow (FX.lights)
   plus the camera (shake, js/glfx.js punch) and the game's sounds (js/hitsfx.js). The kit (X = NC.OBTVFX) is used by
   obt_merchant.js, obt_doctor.js and obt_bell.js (loaded right after this file); the other systems are looked up when a
   skill goes off, so the load order doesn't matter. Unreleased catalog source, omitted from the player page. A painting not cut yet is simply skipped.
   Particles (X.emit): n (a painting) or fr (frames), x y on the ground, z height, vx vy vz, drag, dragZ, grav, rot spin,
   size s0 -> s1 by grow(u), a, fade(u), life, t (< 0: later), erode [u0, u1] (edge, edgeK, ns), bounce, stretch, ground,
   haze, add (light), low (on the ground layer), rev / speed / flipY (frames). Solid ones draw in the 'high' layer in one
   shader pass (js/paintgl.js PG.many: under the night light and the damage numbers), light ones as the light kit's items
   (bloomed), low ones under everything. */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC.OBTJOBS) return;
  const FX = NC.FX, V = NC.VFX;
  const X = (NC.OBTVFX = { on: true });
  const MAN = NC.ASSET_MANIFEST_OBTVFX || {};
  const IMG = {};
  for (const n in MAN) { const im = new Image(); im.src = MAN[n].src; IMG[n] = im; }
  const ok = (n) => { const im = IMG[n]; return !!(im && im.complete && im.naturalWidth > 0); };
  const FMAN = NC.ASSET_MANIFEST_OBTBOOM || {}, FIMG = {};
  for (const n in FMAN) {
    const A = FMAN[n];
    A.cum = [0];
    for (const f of A.frames) A.cum.push(A.cum[A.cum.length - 1] + f.d / 1000);
    A.total = A.cum[A.cum.length - 1];
    FIMG[n] = A.frames.map((f) => { const im = new Image(); im.src = f.src; return im; });
  }
  const fok = (n) => !!(FIMG[n] && FIMG[n].every((im) => im.complete && im.naturalWidth > 0));
  X.framesReady = fok;
  X.ready = (...ns) => ns.every(ok);
  X.has = (n) => !!MAN[n];
  const all = (prefix) => Object.keys(MAN).filter((n) => n.startsWith(prefix));
  X.all = all;
  const PG = () => (NC.PaintGL && NC.PaintGL.ok && NC.PaintGL.ok() ? NC.PaintGL : null);
  const LKit = () => (NC.LightKit && NC.LightKit.part ? NC.LightKit : null);
  const lkHas = (n) => { const L = LKit(); return !!(L && L.MAN && L.MAN[n]); };
  const rand = (a, b) => a + Math.random() * (b - a);
  const any = (list) => list[Math.floor(Math.random() * list.length)];
  const TAU = Math.PI * 2, SQ = V.SQ || 0.58;
  const c01 = (u) => (u < 0 ? 0 : u > 1 ? 1 : u);
  const out = (u, p) => 1 - Math.pow(1 - c01(u), p || 3);
  const backOut = (u) => { u = c01(u) - 1; return 1 + 2.7 * u * u * u + 1.7 * u * u; };
  const aspect = (n) => (MAN[n] ? MAN[n].h / MAN[n].w : 1);
  const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
  X.rand = rand; X.out = out;

  // ---------------- sounds (the game's ElevenLabs set): a copy within 50 ms of the same one is skipped ----------------
  const heard = {};
  X.sfx = function (id, x, gain, t) {
    const HS = NC.HitSfx, g = NC.game;
    if (!HS || !HS.play || !g) return;
    const now = g.time + (t || 0);
    if (heard[id] !== undefined && Math.abs(now - heard[id]) < 0.05) return;
    heard[id] = now;
    const p = g.player, pan = p && x != null ? Math.max(-0.6, Math.min(0.6, (x - p.x) / 600)) : 0;
    HS.play([{ id, t: t || 0, gain: gain == null ? 1 : gain, rate: 0.94 + Math.random() * 0.12 }], pan);
  };

  // ======================================================================================================
  // particles
  // ======================================================================================================
  function step(P, dt) {
    P.t += dt;
    if (P.t < 0 || P.rest) return;
    if (P.orbit) {   // (circling a point / someone: [radius, turns a second, height]; dizzy stars)
      const [r, w, hz] = P.orbit, a = (P.oa || 0) + P.t * w * TAU, cx = P.follow ? P.follow.x : P.cx, cy = P.follow ? P.follow.y : P.cy;
      P.x = cx + Math.cos(a) * r; P.y = cy + Math.sin(a) * r * 0.35; P.z = hz; P.dz = Math.sin(a) > 0 ? 1 : -1;
      return;
    }
    if (P.follow) { P.x = P.follow.x + (P.fx || 0); P.y = P.follow.y + (P.fy || 0); }
    const k = Math.exp(-(P.drag || 0) * dt);
    P.vx *= k; P.vy *= k;
    if (P.dragZ) P.vz *= Math.exp(-P.dragZ * dt);
    P.vz -= (P.grav || 0) * dt;
    P.x += P.vx * dt; P.y += P.vy * dt; P.z += P.vz * dt;
    P.rot += (P.spin || 0) * dt;
    if (P.grav && P.z <= 0) {
      P.z = 0;
      if (P.vz < -220 && (P.b || 0) < (P.bounce || 0)) { P.b = (P.b || 0) + 1; P.vz *= -0.34; P.vx *= 0.5; P.vy *= 0.5; P.spin *= 0.45; }
      else { P.vz = 0; P.rest = true; }
    }
  }
  function pose(P) {
    if (P.t < 0 || P.t > P.life || !(P.fr ? fok(P.fr) : ok(P.n))) return null;
    const u = c01(P.t / P.life);
    const g = P.grow ? P.grow(u, P) : 1, sz = P.size * (P.s0 + (P.s1 - P.s0) * g);
    let w = sz, h = sz * (P.fr ? 1 : aspect(P.n)), rot = P.rot;
    if (P.stretch) {
      const vx = P.vx, vy = P.vy - P.vz, sp = Math.hypot(vx, vy);
      rot = Math.atan2(vy, vx) - ((MAN[P.n] && MAN[P.n].ang) || 0);
      const s = Math.min(1.6, 0.5 + sp / (P.sp0 || 800));
      w *= s; h *= Math.min(1, 0.6 + 0.4 * s);
    }
    const a = (P.a === undefined ? 1 : P.a) * (P.fade ? P.fade(u) : 1);
    if (a <= 0.004) return null;
    return { u, w, h, rot, a, x: P.x, y: P.y - P.z };
  }
  const erodeOf = (P, u) => (P.erode ? c01((u - P.erode[0]) / (P.erode[1] - P.erode[0])) : 0);
  // a frame particle: the two frames either side of its time, crossfaded over the frame's whole time, each placed by its
  // own origin; s.w = the drawn width of one cell. cb(img, frame, k, alpha)
  function frameAt(P, s, cb) {
    const A = FMAN[P.fr], n = A.frames.length;
    let t = A.loop || P.loop ? (P.t * (P.speed || 1)) % A.total : Math.min(A.total - 1e-4, (P.t / P.life) * A.total);   // (a loop runs at its own pace while the particle lives)
    if (P.rev) t = Math.max(0, A.total - 1e-4 - t);
    let i = 0;
    while (i < n - 1 && t >= A.cum[i + 1]) i++;
    const f = (t - A.cum[i]) / (A.cum[i + 1] - A.cum[i]), k = (s.w / A.cw) * A.k;
    const j = P.rev ? i - 1 : i + 1, fi = P.rev ? 1 - f : f;   // (backwards: frame i melts into the one before)
    if (j < 0 || j >= n) { cb(FIMG[P.fr][i], A.frames[i], k, 1); return; }
    cb(FIMG[P.fr][i], A.frames[i], k, P.rev ? fi : 1 - f);
    cb(FIMG[P.fr][j], A.frames[j], k, P.rev ? 1 - fi : f);
  }
  function drawSolid(ctx, parts) {
    const list = [], pg = PG();
    for (const P of parts) {
      if (P.add) continue;
      const s = pose(P);
      if (!s) continue;
      const er = erodeOf(P, s.u);
      const base = (o) => { if (er > 0) { o.erode = [er, 0.09, P.ns || 3.2, P.edgeK === undefined ? 0.3 : P.edgeK]; o.edge = P.edge || [1, 0.92, 0.75]; } if (P.tint) o.tint = P.tint; o.seed = P.seed; return o; };
      if (P.fr) {
        frameAt(P, s, (im, F, k, a) => { if (a > 0.01) list.push([im, s.x, s.y, F.w * k, F.h * k, s.rot, base({ a: s.a * a, flip: P.flip, ax: F.ox / F.w, ay: F.oy / F.h }), 1, s.y - 1]); });
        continue;
      }
      const o = base({ a: s.a, flip: P.flip, squash: P.ground ? SQ : 1 });
      if (P.haze) { o.haze = P.haze * s.a; o.a = 1; delete o.erode; }
      list.push([IMG[P.n], s.x, s.y, s.w, s.h, s.rot, o, P.haze ? 0 : 1, s.y + (P.dz || 0)]);
    }
    if (!list.length) return;
    list.sort((a, b) => a[7] - b[7] || a[8] - b[8]);   // (the haze first, then back to front)
    if (pg) { pg.many(ctx, list); return; }
    for (const [im, x, y, w, h, rot, o] of list) {   // (no WebGL2: the plain paintings, faded)
      if (o.haze) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); if (o.flip) ctx.scale(-1, 1);
      ctx.globalAlpha = Math.max(0, o.a * (1 - ((o.erode && o.erode[0]) || 0)));
      ctx.drawImage(im, -(o.ax === undefined ? 0.5 : o.ax) * w, -(o.ay === undefined ? 0.5 : o.ay) * h, w, h); ctx.restore();
    }
  }
  // the light paintings and light frames, added (the light kit's item: its bloom pass draws them again, wider, blurred)
  function drawLight(c, parts, glow) {
    for (const P of parts) {
      if (!P.add) continue;
      const s = pose(P);
      if (!s) continue;
      const g = glow ? (P.g === undefined ? 0.6 : P.g) : 1;
      if (g <= 0) continue;
      const er = erodeOf(P, s.u), a0 = s.a * g * (1 - er);
      const G = glow ? 1.2 : 1;
      c.save();
      c.translate(s.x, s.y);
      if (P.ground) c.scale(1, SQ);
      c.rotate(s.rot || 0);
      if (P.flip) c.scale(-1, 1);
      if (P.flipY) c.scale(1, -1);
      if (P.fr) frameAt(P, s, (im, F, k, a) => { if (a <= 0.01) return; c.globalAlpha = Math.min(1, a0 * a); c.drawImage(im, -F.ox * k * G, -F.oy * k * G, F.w * k * G, F.h * k * G); });
      else { c.globalAlpha = Math.min(1, a0); c.drawImage(IMG[P.n], -s.w * G / 2, -s.h * G / 2, s.w * G, s.h * G); }
      c.restore();
    }
  }
  X.emit = function (parts) {
    if (!B.on() || !parts.length) return parts;
    for (const P of parts) {
      if (P.fr && !P.life) P.life = FMAN[P.fr] ? FMAN[P.fr].total / (P.speed || 1) : 0.5;
      P.t = P.t || 0; P.s0 = P.s0 === undefined ? 1 : P.s0; P.s1 = P.s1 === undefined ? P.s0 : P.s1;
      P.rot = P.rot || 0; P.z = P.z || 0; P.vx = P.vx || 0; P.vy = P.vy || 0; P.vz = P.vz || 0; P.seed = Math.random() * 50;
      if (P.follow && !P.orbit) { P.fx = P.x - P.follow.x; P.fy = P.y - P.follow.y; }
      if (P.orbit && !P.follow) { P.cx = P.x; P.cy = P.y; }
    }
    const life = Math.max(0.05, ...parts.map((P) => (P.t < 0 ? -P.t : 0) + P.life));
    const low = parts.filter((P) => P.low), rest = parts.filter((P) => !P.low);
    FX.add({ type: 'custom', layer: 'high', life, x: 0, y: 0, update(q, dt) { for (const P of parts) step(P, dt); }, draw(ctx) { drawSolid(ctx, rest); } });
    if (low.length) FX.add({ type: 'custom', layer: 'low', life, x: 0, y: 0, draw(ctx) { drawSolid(ctx, low.filter((P) => !P.add)); ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawLight(ctx, low, false); ctx.restore(); } });
    const L = LKit();
    if (rest.some((P) => P.add)) {
      if (L && L.add) L.add({ layer: 'glow', life, x: 0, y: 0, draw: (c, q, u, glow) => drawLight(c, rest, glow) });
      else FX.add({ type: 'custom', layer: 'glow', life, x: 0, y: 0, draw(ctx) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawLight(ctx, rest, false); ctx.restore(); } });
    }
    return parts;
  };
  const B = { on: () => X.on };

  // ======================================================================================================
  // pieces of a recipe (they push particles into `parts`; X.emit draws them)
  // ======================================================================================================
  // debris flung up and out: names, n; o: sp [a, b], up [a, b], size [a, b], spin, life [a, b], bounce, z, erode start
  X.debris = function (parts, x, y, names, n, o) {
    o = o || {};
    names = (Array.isArray(names) ? names : all(names)).filter((m) => MAN[m]);
    if (!names.length) return;
    const sp = o.sp || [180, 460], up = o.up || [520, 900], size = o.size || [40, 70], life = o.life || [1.2, 1.7];
    for (let i = 0; i < n; i++) {
      const a = o.dir === undefined ? rand(0, TAU) : o.dir + rand(-(o.spread || 0.8), o.spread || 0.8), v = rand(sp[0], sp[1]);
      parts.push({ n: names[i % names.length], x: x + rand(-12, 12), y: y + rand(-6, 6), z: o.z === undefined ? rand(30, 60) : o.z, vx: Math.cos(a) * v, vy: Math.sin(a) * v * SQ,
        vz: rand(up[0], up[1]), grav: o.grav || 2400, drag: o.drag || 0.7, bounce: o.bounce === undefined ? 1 : o.bounce, rot: rand(0, TAU), spin: rand(-1, 1) * (o.spin || 14),
        size: rand(size[0], size[1]), life: rand(life[0], life[1]), t: o.t ? -rand(0, o.t) : 0, erode: [o.erode || 0.72, 1], edge: o.edge || [0.35, 0.22, 0.12], edgeK: 0.2, ns: 5, a: o.a });
    }
  };
  // puffs (dust, gas): a crown bursting up and out, a skirt rolling out along the ground; o: crown, skirt, size, sp
  X.puffs = function (parts, x, y, names, o) {
    o = o || {};
    names = (Array.isArray(names) ? names : all(names)).filter((m) => MAN[m]);
    if (!names.length) return;
    const s = o.s || 1, edge = o.edge || [1, 0.94, 0.8];
    for (let i = 0; i < (o.crown === undefined ? 5 : o.crown); i++) {
      const a = -Math.PI / 2 + rand(-1.2, 1.2), sp = rand(220, 460) * s * (o.sp || 1);
      parts.push({ n: any(names), x: x + rand(-26, 26) * s, y: y + rand(-6, 10), z: rand(10, 40) * s, vx: Math.cos(a) * sp, vz: -Math.sin(a) * sp * 0.9,
        drag: 3.4, dragZ: 3.4, size: rand(105, 150) * s * (o.size || 1), s0: 0.3, s1: rand(0.95, 1.2), grow: (u) => out(u, 3), rot: rand(-0.4, 0.4), spin: rand(-0.7, 0.7),
        flip: Math.random() < 0.5, life: rand(0.85, 1.2) * (o.life || 1), erode: [rand(0.3, 0.42), 1], edge, edgeK: 0.3, ns: 3, a: o.a, tint: o.tint, t: o.t ? -rand(0, o.t) : 0 });
    }
    for (let i = 0; i < (o.skirt === undefined ? 8 : o.skirt); i++) {
      const n = o.skirt === undefined ? 8 : o.skirt, a = (i / n) * TAU + rand(-0.25, 0.25), sp = rand(380, 620) * s * (o.sp || 1);
      parts.push({ n: any(names), x: x + Math.cos(a) * 22 * s, y: y + Math.sin(a) * 12 * s, z: rand(4, 16) * s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * SQ, vz: rand(10, 50),
        drag: 3.8, dragZ: 4, size: rand(85, 125) * s * (o.size || 1), s0: 0.3, s1: rand(0.95, 1.15), grow: (u) => out(u, 3), rot: rand(-0.3, 0.3), spin: rand(-0.6, 0.6),
        flip: Math.random() < 0.5, life: rand(0.75, 1.0) * (o.life || 1), erode: [rand(0.28, 0.36), 1], edge, edgeK: 0.3, ns: 3, a: o.a, tint: o.tint });
    }
  };
  // golden sparks (the painted streaks), stretched along their flight
  X.sparks = function (parts, x, y, n, o) {
    o = o || {};
    const sk = all('cs_spark_');
    if (!sk.length) return;
    const s = o.s || 1;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-1.35, 1.35), sp = rand(520, 1100) * s;
      parts.push({ n: any(sk), add: true, stretch: true, sp0: 900 * s, x: x + rand(-14, 14), y, z: rand(30, 60) * s, vx: Math.cos(a) * sp, vy: rand(-0.2, 0.25) * sp * 0.4, vz: -Math.sin(a) * sp,
        grav: 1500, drag: 1.4, size: rand(34, 58) * s, life: rand(0.3, 0.55), fade: (u) => 1 - u * u, g: 0.55, a: o.a });
    }
  };
  // light from the light kit in any colour: glints and drops thrown out (o.up: rising instead), notes rising
  X.glints = function (x, y, n, col, o) {
    const L = LKit();
    if (!L) return;
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = o.up ? -Math.PI / 2 + rand(-0.9, 0.9) : rand(0, TAU), sp = rand(o.sp ? o.sp[0] : 220, o.sp ? o.sp[1] : 620), pc = i % 3 ? 'drop' : 'glint';
      L.part({ n: pc, x: x + rand(-(o.w || 10), o.w || 10), y: y + rand(-6, 6), t: -rand(0, o.t || 0.05), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ? 0 : 90),
        drag: 3, grav: o.up ? -40 : 420, len: pc === 'glint' ? rand(26, 40) : rand(10, 16), life: rand(0.35, 0.7) * (o.life || 1), a: 1, col, white: 0.5, g: 0.7,
        tw: rand(28, 44), ph: rand(0, 6), fade: L.out(1.1) });
    }
  };
  X.notes = function (x, y, n, col) {
    const L = LKit();
    if (!L) return;
    for (let i = 0; i < n; i++) {
      const pc = lkHas('notes2') && i % 2 ? 'notes2' : 'note';
      if (!lkHas(pc)) return;
      L.part({ n: pc, x: x + rand(-50, 50), y: y + rand(-20, 20), t: -rand(0, 0.25), vx: rand(-40, 40), vy: -rand(90, 170), drag: 0.8, rot: rand(-0.3, 0.3), spin: rand(-1, 1),
        len: rand(26, 40), life: rand(0.7, 1.1), a: 0.95, col, white: 0.35, g: 0.6, fade: L.inOut(0.12, 0.5), sway: rand(3, 6), swayA: rand(6, 12), ph: rand(0, 6) });
    }
  };
  // a mark on the ground (a crater, a crack, a puddle), dissolving at the end
  X.mark = function (parts, n, x, y, size, life, o) {
    if (!MAN[n]) return;
    o = o || {};
    parts.push({ n, low: true, x, y: y + 6, size, s0: 0.8, s1: 1, grow: (u) => out(u * life * 10, 2), life, erode: [1 - 0.8 / life, 1], edge: o.edge || [0.3, 0.2, 0.12], edgeK: 0.15, ns: 4, a: o.a });
  };
  // the painted frames as one particle: size = the drawn width of a cell
  X.framesP = function (name, x, y, size, o) {
    o = o || {};
    if (!FMAN[name]) return null;
    return Object.assign({ fr: name, x, y, size, s0: o.s0 === undefined ? 0.9 : o.s0, s1: o.s1 === undefined ? 1.08 : o.s1, grow: (u) => out(u, 2),
      erode: o.erode === undefined ? [0.62, 1] : o.erode, edge: [1, 0.9, 0.7], edgeK: 0.25, ns: 3.4 }, o);
  };
  X.frames = (name, x, y, size, o) => { const P = X.framesP(name, x, y, size, o); if (P) X.emit([P]); return P; };

  // ======================================================================================================
  // recipes
  // ======================================================================================================
  X.punch = function (game, x, y, shake, zoom) {
    if (shake) V.shake(game, shake);
    if (zoom && NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(x, y - 40, zoom, 0.24);
  };
  X.dim = (life, a) => FX.add({ type: 'samdim', layer: 'high', x: 0, y: 0, life: life || 1.6, a: a || 0.3 });
  // one painting drawn right now (a projectile's look, a bell held over someone)
  X.piece = function (ctx, n, x, y, size, rot, a, flip) {
    if (!ok(n)) return false;
    const w = size, h = size * aspect(n);
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
    if (a !== undefined) ctx.globalAlpha *= a;
    ctx.drawImage(IMG[n], -w / 2, -h / 2, w, h); ctx.restore();
    return true;
  };
  // a BLAST on the ground at (x, y), radius R. o: fr (its painted frames), frK (frames' width x R), col (the light's colour),
  // gold (the painted gold flash / star / ring / sparks instead of the light kit's coloured ones), light (0..1), ring, crack,
  // haze, dust (puff names + puffs options in dustO), debris ([[names, n, debris options], ...]), mark ([name, size x R,
  // life]), sparks n, glints n, shake, zoom, sfx ([[id, gain], ...]), parts (extra particles)
  const FALL = { ob_mega_tox: 'ob_tox_erupt', ob_knell_boom: 'ob_quake', ob_goods_boom: 'ob_crate_slam' };
  X.blast = function (game, x, y, R, o) {
    o = o || {};
    const s = R / 140, parts = o.parts || [], L = LKit(), col = o.col || '#ffc870', lt = o.light === undefined ? 1 : o.light;
    if (o.fr && !FMAN[o.fr] && FALL[o.fr]) o = Object.assign({}, o, { fr: FALL[o.fr] });   // (a frame set not painted yet: its stand-in)
    if (o.fr) { const P = X.framesP(o.fr, x, y + 8 * s, ((o.frK || 2.35) * R) / 0.86, { flip: Math.random() < 0.5, speed: o.speed || 1, add: !!o.frAdd, a: o.frA, tint: o.tint }); if (P) parts.push(P); }
    if (lt > 0 && o.gold) {
      parts.push({ n: 'cs_flash', add: true, x, y, z: 50 * s, size: 230 * s, s0: 0.45, s1: 1.15, grow: (u) => out(u, 3), life: 0.2, a: 0.5 * lt, fade: (u) => Math.pow(1 - u, 2), g: 0.45 });
      parts.push({ n: 'cs_star', add: true, x, y, z: 58 * s, size: 290 * s, s0: 0.3, s1: 1.1, rot: rand(0, TAU), spin: rand(-1, 1), grow: (u) => backOut(u * 2.6), life: 0.2,
        fade: (u) => (u < 0.25 ? 1 : Math.pow(1 - (u - 0.25) / 0.75, 2)), g: 0.4, a: 0.6 * lt });
      if (o.ring !== false) parts.push({ n: 'cs_ring', add: true, x, y: y + 4, size: 2.6 * R, s0: 0.12, s1: 1, grow: (u) => out(u, 4), life: 0.48, fade: (u) => Math.pow(1 - u, 1.5), g: 0.35, a: 0.75 * lt });
      X.sparks(parts, x, y, o.sparks === undefined ? 12 : o.sparks, { s });
    }
    if (o.haze !== false && MAN.cs_ring) parts.push({ n: 'cs_ring', haze: 12 * Math.min(1.4, s), x, y: y + 4, size: 2.6 * R, s0: 0.12, s1: 1, grow: (u) => out(u, 4), life: 0.45, fade: (u) => 1 - u });
    if (o.dust) X.puffs(parts, x, y, o.dust, Object.assign({ s }, o.dustO || {}));
    for (const [names, n, d] of o.debris || []) X.debris(parts, x, y, names, n, d);
    if (o.mark) X.mark(parts, o.mark[0], x, y, o.mark[1] * R, o.mark[2] || 3);
    X.emit(parts);
    if (L && lt > 0) {
      L.burst(x, y - 50 * s, { k: 0.85 * s * lt, col, n: o.spikes || 10, spark: 7, flash: !o.gold });
      if (o.ring !== false && !o.gold) L.ring(x, y, { r0: 24 * s, r1: R * 1.25, life: 0.42, col, a: 0.6 * lt });
      else if (o.ring !== false) L.ring(x, y, { r0: 24 * s, r1: R * 1.25, life: 0.42, col, a: 0.45 * lt });
      if (o.crack && L.crack) L.crack(x, y, { r: R * 0.62, col: o.crackCol || col, life: 1.4 });
      if (o.glints) X.glints(x, y - 40 * s, o.glints, col, { sp: [300 * s, 760 * s] });
    }
    V.light(x, y - 40, R * 3, rgbOf(col), 0.7 * Math.max(0.4, lt), 0.5);
    X.punch(game, x, y, o.shake === undefined ? Math.round(6 + 4 * s) : o.shake, o.zoom);
    for (const [id, g] of o.sfx || []) X.sfx(id, x, g);
    return parts;
  };
  // a HIT on a monster (or a point): the light kit's burst, an arc, notes, a painted piece stamped on (o.piece [name,
  // size]), a shake, sounds
  X.hitFx = function (game, x, y, o) {
    o = o || {};
    const L = LKit(), k = o.k || 1, col = o.col || '#ffd27a';
    if (L) {
      L.burst(x, y, { k: 0.55 * k, col, n: o.n || 7, spark: o.spark === undefined ? 4 : o.spark, flash: o.flash !== false, dir: o.dir });
      if (o.arc && L.arc) L.arc(x, y, { r: 75 * k, col, ang: o.ang || 0 });
    }
    if (o.piece && MAN[o.piece[0]]) X.emit([{ n: o.piece[0], x, y: y + 30, z: 30, size: o.piece[1] || 60, s0: o.piece[2] || 1.7, s1: 1, grow: (u) => out(u * 5, 3), rot: rand(-0.3, 0.3),
      life: o.piece[3] || 0.6, erode: [0.6, 1], edgeK: 0.3, dz: 500 }]);
    if (o.notes) X.notes(x, y - 20, o.notes, col);
    V.light(x, y - 20, 140 * k, rgbOf(col), 0.5, 0.3);
    if (o.shake) V.shake(game, o.shake);
    for (const [id, g] of o.sfx || []) X.sfx(id, x, g);
  };
  // a BUFF taking hold on someone: a pillar and a ring of light, glints rising, painted pieces rising round them (o.pieces
  // [names, n, size]), notes
  X.buffFx = function (game, who, o) {
    o = o || {};
    const L = LKit(), col = o.col || '#ffd27a', k = o.k || 1;
    if (L) {
      L.pillar(who.x, who.y, { w: 56 * k, h: 460, life: 0.6, col, a: 0.75 });
      L.ring(who.x, who.y, { r0: 20, r1: 160 * k, life: 0.5, col, a: 0.6 });
      X.glints(who.x, who.y - 40, 10, col, { up: true, w: 40 });
    }
    if (o.pieces) {
      const [names, n, size] = o.pieces, ns = (Array.isArray(names) ? names : all(names)).filter((m) => MAN[m]), parts = [];
      for (let i = 0; i < n && ns.length; i++) {
        const a = (i / n) * TAU;
        parts.push({ n: ns[i % ns.length], x: who.x + Math.cos(a) * 60 * k, y: who.y + Math.sin(a) * 30 * k, z: rand(0, 20), vz: rand(260, 420), dragZ: 1.6, vx: Math.cos(a) * 30, vy: Math.sin(a) * 15,
          size: size || 36, s0: 0.4, s1: 1, grow: (u) => out(u * 4, 2), rot: rand(0, TAU), spin: rand(-6, 6), life: rand(0.8, 1.1), t: -i * 0.04, erode: [0.6, 1], edgeK: 0.25, follow: o.follow ? who : null });
      }
      X.emit(parts);
    }
    if (o.notes) X.notes(who.x, who.y - 90, o.notes, col);
    X.sfx(o.sfx || 'buff_up', who.x, 0.7);
  };
  // HEALING light on someone: a soft burst, light rising, a ring on the ground
  X.healFx = function (game, who, o) {
    o = o || {};
    const L = LKit(), col = o.col || '#9dffd8', k = o.k || 1;
    if (!L) return;
    L.burst(who.x, who.y - 60, { k: 0.45 * k, col, n: 3, spark: 6, flash: true });
    if (L.healRise) L.healRise(who.x, who.y, { col, n: Math.round(7 * k) });
    L.ring(who.x, who.y, { r0: 14, r1: 110 * k, life: 0.45, col, a: 0.5 });
  };
  // a painting THROWN in an arc from (x, y) at height z0 to the ground spot `to`: turning (spin: turns while in the air),
  // a high arc H, falling hard (stretched as it drops), a faint trail, its shadow growing under it; land(x, y)
  X.lob = function (game, from, to, n, o) {
    o = o || {};
    const dur = o.dur || 0.45, H = o.H === undefined ? 200 : o.H, size = o.size || 60, z0 = from[2] || 0;
    const dir = Math.cos(NC.angle(from[0], from[1], to[0], to[1])) >= 0 ? 1 : -1, spin = (o.spin === undefined ? 1.7 : o.spin) * dir;
    const trail = [];
    let gx = from[0], gy = from[1], z = z0, rot = 0;
    const at = (u) => {
      gx = from[0] + (to[0] - from[0]) * u; gy = from[1] + (to[1] - from[1]) * u;
      z = o.fall ? z0 * (1 - u * u) : z0 * (1 - u) + H * 4 * u * (1 - u);
      rot = o.fall ? (o.rot || 0) : spin * u * (o.settle ? (1 - u) * 4 : 1);
    };
    at(0);
    const h = size * aspect(n);
    FX.add({ type: 'custom', layer: o.layer || 'high', life: dur, x: gx, y: gy,
      update(q) { const u = c01(q.t / dur); trail.unshift([gx, gy - z, rot]); if (trail.length > 5) trail.pop(); at(u); },
      draw(ctx, q) {
        if (!ok(n)) return;
        const u = c01(q.t / dur), fall = c01((u - (o.fall ? 0.3 : 0.55)) / (o.fall ? 0.7 : 0.45)), sy = 1 + 0.16 * fall, sx = 1 - 0.07 * fall;
        if (o.trail !== false) for (let i = trail.length - 1; i >= 1; i -= 2) {
          if (u < 0.45) break;
          const [tx, ty, tr] = trail[i];
          ctx.save(); ctx.translate(tx, ty - h / 2); ctx.rotate(tr); ctx.scale(sx, sy); ctx.globalAlpha = 0.22 * (1 - i / 6) * fall; ctx.drawImage(IMG[n], -size / 2, -h / 2, size, h); ctx.restore();
        }
        ctx.save(); ctx.translate(gx, gy - z - h / 2); ctx.rotate(rot); ctx.scale(sx, sy); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha; ctx.drawImage(IMG[n], -size / 2, -h / 2, size, h); ctx.restore();
      },
      onEnd() { if (o.land) o.land(to[0], to[1]); } });
    if (o.shadow !== false) FX.add({ type: 'custom', layer: 'low', life: dur, x: 0, y: 0, draw(ctx, q) {
      const u = c01(q.t / dur), r = size * 0.42;
      if (NC.drawShadow) NC.drawShadow(ctx, gx, gy, r * (0.5 + 0.5 * u), r * 0.32 * (0.5 + 0.5 * u), 0.15 + 0.25 * u);
    } });
  };
  // a painting STANDING on the ground a while among the characters (a camp's crate, a bell over someone): fading in and out,
  // dissolving at the end; o.size, o.a, o.follow, o.dy, o.flip
  X.stay = function (n, x, y, life, o) {
    o = o || {};
    if (!MAN[n]) return null;
    const size = o.size || 80, h = size * aspect(n);
    return FX.add({ type: 'custom', layer: o.layer || 'sorted', life, x, y, sort: y + (o.dz || 0),
      update(q) { if (o.follow) { q.x = o.follow.x + (o.fx || 0); q.y = o.follow.y + (o.fy || 0); q.sort = q.y + (o.dz || 0); } },
      draw(ctx, q) {
        const a = Math.min(1, q.t / 0.12, (life - q.t) / 0.35) * (o.a === undefined ? 1 : o.a);
        const g = (o.growIn ? out(q.t / o.growIn, 3) : 1) * (o.pulse ? 1 + o.pulse * Math.sin(q.t * 5) : 1), hh = h * g;
        if (a > 0) X.piece(ctx, n, q.x, q.y - hh / 2 + (o.dy || 0), size * g, o.sway ? Math.sin(q.t * 2 + (o.ph || 0)) * o.sway : o.rot || 0, a, o.flip);
      } });
  };
  // dizzy STARS circling over a stunned one (the painted stars)
  X.stars = function (e, life, n) {
    const st = all('hb_star_');
    if (!st.length || !e) return;
    const parts = [];
    for (let i = 0; i < (n || 4); i++) parts.push({ n: st[i % st.length], follow: e, orbit: [34, 0.9, 150], oa: (i / (n || 4)) * TAU, size: 22, life: life || 1.2, spin: 2,
      fade: (u) => Math.min(1, u * 8, (1 - u) * 5) });
    X.emit(parts);
  };
  // a painting DROPPED from the sky onto (x, y) (a bell, a crate, a coin): straight down, faster and faster
  X.drop = (game, x, y, n, o) => X.lob(game, [x + (o && o.dx !== undefined ? o.dx : 24), y, (o && o.H) || 720], [x, y], n, Object.assign({ fall: true, dur: 0.3, trail: true }, o || {}));
  // a lasting CLOUD of puffs (poison, mist) round (x, y): puffs blooming, churning slowly, drifting, dissolving at the end;
  // o: names, n, size (x R), bubbles (names), mark ([name, size x R]), tint, a
  X.cloud = function (game, x, y, R, life, o) {
    o = o || {};
    const names = (Array.isArray(o.names) ? o.names : all(o.names || 'hg_puff_')).filter((m) => MAN[m]), parts = [];
    const n = o.n || Math.round(4 + R / 40);
    for (let i = 0; i < n && names.length; i++) {
      const a = rand(0, TAU), r = Math.sqrt(Math.random()) * R * 0.75, ph = rand(0, TAU), sp = rand(0.6, 1.1);
      parts.push({ n: any(names), x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * SQ, z: rand(6, 30), vx: rand(-14, 14), vy: rand(-5, 5),
        size: R * rand(0.6, 0.85) * (o.size || 1), s0: 0.25, s1: 1, rot: rand(-0.3, 0.3), spin: rand(-0.12, 0.12), flip: Math.random() < 0.5, life: life + rand(-0.3, 0.2),
        grow: (u, P) => Math.min(1, out((u * P.life) / 0.6, 3)) + 0.06 * Math.sin(P.t * 2.2 * sp + ph), t: -rand(0, 0.25), a: o.a === undefined ? 0.6 : o.a,
        erode: [1 - 0.9 / life, 1], edge: o.edge || [0.85, 1, 0.6], edgeK: 0.25, ns: 2.6, tint: o.tint, dz: -40 });
    }
    const bub = o.bubbles ? (Array.isArray(o.bubbles) ? o.bubbles : all(o.bubbles)).filter((m) => MAN[m]) : [];
    for (let i = 0; i < Math.round(life * 4) && bub.length; i++) {
      const a = rand(0, TAU), r = Math.sqrt(Math.random()) * R * 0.7;
      parts.push({ n: any(bub), x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * SQ, z: rand(10, 40), vz: rand(60, 130), vx: rand(-10, 10), size: rand(14, 28),
        s0: 0.3, s1: 1, grow: (u) => out(u * 3, 2), life: rand(0.8, 1.3), t: -rand(0, life - 1), erode: [0.75, 1], edgeK: 0.4, edge: [0.8, 1, 0.6] });
    }
    if (o.mark) X.mark(parts, o.mark[0], x, y, o.mark[1] * R, life + 0.5);
    return X.emit(parts);
  };

  // ======================================================================================================
  // SOUND as light + mesh, no frames (the user, 2026-10-20: "ตัวเสียงเราใช้เป็น หลักการทำสกิล เเบบ เเสง กับ mesh ได้ไหม เเละอื่นๆ
  // ผสม ไม่เอาเฟรม"): every ring and wave of sound is a MESH band (js/meshfx.js MX.ribbon: the painted strips of the mesh
  // slashes scrolling along it, its bright edge leading, eaten away by noise at the end), plus the light kit's light and
  // notes, and the ground bent by the haze shader under a ring (js/paintgl.js)
  // ======================================================================================================
  const MXk = () => (NC.MeshFX && NC.MeshFX.ok && NC.MeshFX.ok() ? NC.MeshFX : null);
  const STRIP = { sound: ['strip_steel', [0.78, 1, 1.12]], bronze: ['strip_ember', [1.15, 0.92, 0.62]], cold: ['strip_steel', [0.62, 0.86, 1.2]], dark: ['strip_shadow', [0.85, 0.95, 1.3]] };
  const SOUNDHEX = { sound: '#aaebff', bronze: '#ffc86e', cold: '#9fe8ff', dark: '#8fb4ff' };
  // a ring band flat on the ground (cx, cy), radius r, width w, as edge pairs for MX.ribbon (u kept inside 0.2..0.8 so the
  // strip's tail / head fades never show; the seam sits at the back of the ring, where it is thinnest)
  function ringPts(cx, cy, r, w) {
    const pts = [], N = 64;
    for (let i = 0; i <= N; i++) {
      const th = -Math.PI / 2 + (i / N) * TAU, c = Math.cos(th), sn = Math.sin(th);
      pts.push({ a: [cx + c * (r - w * 0.5), cy + sn * (r - w * 0.5) * SQ], b: [cx + c * (r + w * 0.5), cy + sn * (r + w * 0.5) * SQ], u: 0.2 + 0.6 * (i / N) });
    }
    return pts;
  }
  // a crescent of sound standing up, bulging along `ang` from (cx, cy) at height h: the arc of a circle of radius r in the
  // upright plane through the direction, spread rad each side, thick in the middle and pointed at both ends
  function crescentPts(cx, cy, h, ang, r, w, spread) {
    const pts = [], N = 32, dx = Math.cos(ang), dy = Math.sin(ang) * SQ;
    for (let i = 0; i <= N; i++) {
      const f = i / N, th = -spread + 2 * spread * f, k = Math.pow(Math.sin(Math.PI * f), 0.6), ww = w * k;
      const at = (rr) => [cx + dx * Math.cos(th) * rr, cy + dy * Math.cos(th) * rr - h - Math.sin(th) * rr];
      pts.push({ a: at(r - ww * 0.5), b: at(r + ww * 0.5), u: 0.2 + 0.6 * f });
    }
    return pts;
  }
  // rings of sound racing out along the ground: o.n rings o.gap apart, r0 -> R, o.w width, o.life each, o.col ('sound' /
  // 'bronze' / 'cold' / 'dark'), o.rev (closing in), o.a, o.follow; the light kit's ring with them, the ground bent under
  // them, glints, notes
  X.soundRing = function (game, x, y, R, o) {
    o = o || {};
    const mx = MXk(), L = LKit(), n = o.n || 3, gap = o.gap || 0.07, life = o.life || 0.5, col = o.col || 'sound', kind = STRIP[col], hex = SOUNDHEX[col];
    const a0 = o.a === undefined ? 1 : o.a;
    for (let i = 0; i < n && mx; i++) {
      const seed = Math.random() * 10, w0 = (o.w || 46) * (1 - i * 0.18), r0 = o.r0 || 18, Ri = R * (1 - i * 0.12);
      FX.add({ type: 'custom', layer: 'glow', life: life + i * gap, x, y, draw(ctx, q) {
        const t = q.t - i * gap;
        if (t < 0) return;
        const u = c01(t / life), g = o.rev ? 1 - out(u, 2.2) : out(u, 3.2), r = r0 + (Ri - r0) * g, w = w0 * (o.rev ? 0.4 + 0.6 * u : 1 - 0.55 * u);
        const cx = o.follow ? o.follow.x : x, cy = o.follow ? o.follow.y : y;
        const alpha = a0 * (i ? 0.75 : 1) * Math.min(1, u * 10) * (1 - u * 0.35);
        mx.ribbon(ctx, ringPts(cx, cy, r, w), { strip: kind[0], tint: kind[1], alpha, erode: c01((u - 0.5) / 0.5), pan: 2.2, rep: 5, seed, tailK: 0.001, lift: 0.9, edgeK: 1.2 });
      } });
    }
    if (L) L.ring(x, y, { r0: o.rev ? R : 24, r1: o.rev ? 24 : R, life, col: hex, a: (mx ? 0.35 : 0.7) * a0, follow: o.follow });   // (no WebGL2: the light kit's ring alone)
    if (o.haze !== false && MAN.cs_ring && !o.rev) X.emit([{ n: 'cs_ring', haze: 12, x, y: y + 4, size: 2.4 * R, s0: 0.1, s1: 1, grow: (u) => out(u, 3.2), life, fade: (u) => 1 - u }]);
    if (o.notes) X.notes(x, y - 90, o.notes, hex);
    if (o.glints !== false) X.glints(x, y - 30, 8, hex, { sp: [R * 1.2, R * 2.4] });
  };
  // a CONE of sound: crescents rolling out along `ang` one after another from (x, y) at height o.h, each growing 20 -> range
  // and fading; o.n crescents o.gap apart, o.w, o.spread, o.col, o.a; motes of sound streaming with them (the light kit)
  X.soundCone = function (game, x, y, ang, range, o) {
    o = o || {};
    const mx = MXk(), L = LKit(), n = o.n || 5, gap = o.gap || 0.06, life = o.life || 0.45, col = o.col || 'sound', kind = STRIP[col], hex = SOUNDHEX[col];
    const a0 = o.a === undefined ? 1 : o.a, h = o.h === undefined ? 60 : o.h;
    for (let i = 0; i < n && mx; i++) {
      const seed = Math.random() * 10;
      FX.add({ type: 'custom', layer: 'glow', life: life + i * gap, x, y, draw(ctx, q) {
        const t = q.t - i * gap;
        if (t < 0) return;
        const u = c01(t / life), r = 20 + (range - 20) * out(u, 2.4), w = (o.w || 50) * (1 - 0.45 * u), sp = (o.spread || 0.85) * (0.7 + 0.3 * u);
        mx.ribbon(ctx, crescentPts(x, y, h, ang, r, w, sp), { strip: kind[0], tint: kind[1], alpha: a0 * Math.min(1, u * 8) * (1 - u * 0.3), erode: c01((u - 0.45) / 0.55), pan: 2.6, rep: 2, seed, tailK: 0.001, lift: 0.9, edgeK: 1.2 });
      } });
    }
    if (!L) return;
    const dir = Math.cos(ang) >= 0 ? 1 : -1;
    L.burst(x + Math.cos(ang) * 20, y - h, { k: 0.55, col: hex, n: 6, spark: 4, dir });
    if (!mx) L.burst(x + Math.cos(ang) * range * 0.5, y - h, { k: range / 300, col: hex, n: 10, spark: 6, dir });
    for (let i = 0; i < 8; i++) {
      const a = ang + rand(-0.5, 0.5), sp = rand(500, 900);
      L.part({ n: 'drop', x: x + Math.cos(ang) * 30, y: y - h + rand(-20, 20), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * SQ, drag: 3, stretch: true, sp0: 500,
        len: rand(10, 16), life: rand(0.3, 0.5), a: 0.9 * a0, col: hex, white: 0.5, g: 0.6, fade: L.out(1.2) });
    }
  };

  // ======================================================================================================
  // the crate (ลังไม้กระแทก, the wall of crates, the beetle's fall): thrown or dropped, bursting
  // ======================================================================================================
  X.crateBurst = function (game, x, y, R, o) {
    o = o || {};
    const s = R / 140, parts = [];
    parts.push({ n: 'cs_crate', x, y, z: 60 * s * aspect('cs_crate'), size: 120 * s, life: 0.05, fade: () => 1 });
    const L = LKit();
    X.blast(game, x, y, R, { parts, fr: 'ob_crate_slam', gold: true, col: o.col || '#ffc870', dust: 'cs_puff_', dustO: { crown: 5, skirt: 9 },
      debris: [[['cs_plank_0', 'cs_plank_1', 'cs_plank_2', 'cs_plank_3', 'cs_corner', 'cs_lid'], 6, { sp: [170 * s, 420 * s], up: [560 * s, 920 * s], size: [64 * s, 90 * s], spin: 11, life: [1.5, 1.9], erode: 0.74 }],
        ['cs_splinter_', 12, { sp: [220 * s, 600 * s], up: [420 * s, 1000 * s], size: [22 * s, 38 * s], spin: 22, life: [1.1, 1.5], erode: 0.65 }]],
      mark: ['cs_crater', 2.2, 3.2], shake: o.shake === undefined ? 11 : o.shake, zoom: o.zoom === undefined ? 0.075 : o.zoom,
      sfx: [['boss_slam', 0.85], ['im_crush', 0.9], ['body_wood', 0.9], ['ult_boom', 0.35]] });
    if (L && L.crack) L.crack(x, y, { r: R * 0.62, col: '#ff9a40', life: 1.4 });
  };
  X.crateFly = (game, p, from, to, o) => X.lob(game, [from[0], p.y, Math.max(0, p.y - from[1])], to, 'cs_crate', Object.assign({ size: 120, H: 250, dur: 0.5, settle: true }, o || {}));
})();
