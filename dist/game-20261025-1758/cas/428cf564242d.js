/* reaperlight.js — the REAPER's scythe skills made of MOONLIGHT carved out of darkness (2026-10-20, the user: "เปลี่ยนสกิล
   เคียว vfx เป็นเวอร์ชั่น แสง แบบท่าฟันที่เราปิดไว้ เเต่เท่กว่า ลองออกแบบให้หน่อยหรือจะผสมก็ได้เเต่ต้องเท่จัด"), on js/lightkit.js
   (LK.lineSkin: every skill, cast, hook, hit and class-3 effect of ยมทูต / ผู้เก็บเกี่ยวจันทรา runs in the skin).
   The mix: the sword's light slash (js/lightslash.js: painted pieces fired as particles, added as light, bloomed) + the
   scythe's own painted light pieces (assets/reaperlight: a scythe's sweep, a reaping ring, a ghost scythe, a soul torn out, a
   soul chain, a hook, moon shards, a moon sigil, a rift, a cross cut, ghost flame, a harvest wave) + DARK ink-smoke pieces
   laid UNDER the light (drawn as painted: the light reads on a bright meadow too) + the mesh scythe arc (js/meshfx.js).
   Codex on black / green: assets/gen/make_reaperlight_prompts.py -> tools/reaperlight_cut.py. Every skill keeps its own code
   and numbers; only the drawing changes:
     ฟันเก็บเกี่ยว     each turn: a mesh blade ring swept round the hero + the painted reaping ring turning flat at the waist,
                     an ink ring under it, crescent shards flung off; the second turn bigger: the moon sigil flashes on the
                     ground, a shock ring, a camera punch; every monster hit gives up a soul that is torn out of it
     ประหารใต้จันทร์    the world dims, a moon rises over the target, the moon sigil turns under it, a ghost scythe of light
                     rises behind it and CHOPS down: a giant crescent cut through the sky, the air tears open (a rift), ink
                     and ghost flames burst out; a monster executed: a crimson cross cut and its soul torn up and away
     ขว้างเคียววกกลับ    each sickle a spinning disc of light with afterimage crescents and an ink trail
     เกี่ยววิญญาณ       a chain of light shoots out with a hook, yanks, a crescent cut, the soul flies to the reaper
     ร่างวิญญาณ        a line of soul light along the dash; every monster passed is marked by a cut that BURSTS a moment
                     after the reaper has gone by
     พายุวิญญาณ        the moon sigil turning under the reaper, souls (painted wisps) circling in two rings, three hooks of
                     light chasing round, a pulse of light with every hit, ghost flames rising
     the souls round the reaper and the souls flying to him: painted wisps; a plain scythe / sickle hit: the scythe's
     crescent of light across the monster on an ink smear + light spikes (a crit: a crimson cross cut)
     ผู้เก็บเกี่ยวจันทรา's full-moon crescent: a giant harvest wave of light flying out with the moon behind it
   Switch: ESC → ตั้งค่า "ยมทูต" (js/hitstyle.js row 'reaper', NC.ReaperLight.on); ?reaperlight=1 / 0 forces it. The pieces load
   the first time a reaper is seen. Load after js/jobs3_skills_b.js, js/class3_skills_b.js and js/lightkit.js, before
   js/hitstyle.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, LK = NC.LightKit, K = NC.SkillKit;
  if (!FX || !V || !LK || !LK.lineSkin || !LK.addPieces || !K) return;
  const RMAN = NC.ASSET_MANIFEST_REAPERLIGHT || {};
  const rand = NC.rand, PI = Math.PI, TAU = PI * 2, SQ = V.SQ || 0.58;
  const EDGE = '#e6f6ff', SOUL = '#8fd8ff', DEEP = '#9a7cff', BLOOD = '#ff2a48', SOULRGB = '170,230,255';
  const zoom = (x, y, k, d) => { if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(x, y, k, d); };
  const out = LK.out, inOut = LK.inOut, asp = (n) => LK.aspect(n);
  const has = (n) => !!LK.MAN[n] && LK.ready(n);
  const alive = (e) => e && !e.dead && e.hp > 0;
  let RL = null, loaded = false;
  const ensure = () => { if (!loaded) { loaded = true; LK.addPieces(RMAN); } };

  // =====================================================================================================
  // dark pieces: ink smoke drawn as painted (under the light, 'high' over the characters or 'low' on the ground)
  // =====================================================================================================
  FX.def('rlvoid', (ctx, q, u) => {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const g = q.grow ? q.grow(u) : 1, a = q.a * (q.fade ? q.fade(u) : out(1.4)(u));
    let x = q.x, y = q.y;
    if (q.follow) { x += q.follow.x - q.fx0; y += q.follow.y - q.fy0; }
    const len = q.len * g, wid = (q.wid || q.len * asp(q.n)) * g;
    LK.piece(ctx, q.n, x, y, q.rot || 0, len, wid, a, null, 0, { ground: q.ground, flipY: q.flipY });
    ctx.restore();
  }, 'high');
  function dark(P) {
    if (!has(P.n)) return null;
    P.a = P.a === undefined ? 0.6 : P.a;
    if (P.follow) { P.fx0 = P.follow.x; P.fy0 = P.follow.y; }
    return FX.add(Object.assign({ type: 'rlvoid' }, P));
  }
  const pop = (s0, s1, at) => (u) => (u < at ? s0 + (s1 - s0) * (1 - Math.pow(1 - u / at, 2)) : s1);
  // a piece drawn mirrored left-right: turned half round and flipped across its length
  const mirror = (rot, dir) => (dir < 0 ? { rot: PI - rot, flipY: true } : { rot, flipY: false });

  // =====================================================================================================
  // the reaper's pieces of motion
  // =====================================================================================================
  // a soul torn out of (x, y), flying at angle ang (up: -PI/2) and slowing; its painted head leads
  function soulTear(x, y, ang, o) {
    o = o || {};
    if (!has('rl_soul')) return;
    const sp = o.sp || 620, L = o.len || 70;
    LK.part({ n: 'rl_soul', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, drag: o.drag === undefined ? 2.6 : o.drag, rot: ang + PI / 2,
      len: L, life: o.life || 0.55, a: 0.95, col: o.col || null, white: 0.35, g: 0.75, grow: pop(0.5, 1.05, 0.25), fade: inOut(0.06, 0.55) });
    LK.part({ n: 'soft', x, y, len: L * 2.2, life: 0.22, a: 0.4, col: SOUL, white: 0, g: 0.4, grow: pop(0.5, 1, 0.3), fade: out(1.6) });
  }
  // a crescent cut of light across a point (dir: which way it swings), an ink smear under it
  function crescentCut(x, y, len, dir, o) {
    o = o || {};
    const m = mirror(o.rot === undefined ? rand(-0.2, 0.15) : o.rot, dir), life = o.life || 0.26;
    if (o.ink !== false) dark({ n: 'rl_vsweep', x: x - dir * len * 0.03, y: y + len * 0.04, rot: m.rot, flipY: m.flipY, len: len * 1.12, life: life * 1.5, a: o.inkA || 0.42,
      grow: pop(0.8, 1.05, 0.3), fade: out(1.6) });
    LK.part({ n: 'rl_sweep', x, y, rot: m.rot, flipY: m.flipY, len, life, a: 1, col: o.col || null, white: o.white === undefined ? 0.5 : o.white, g: 0.8,
      grow: pop(0.72, 1.06, 0.3), fade: out(1.5) });
  }
  // crescent shards of light flung from (x, y) at angle a
  function shards(x, y, n, a0, spread, k, col) {
    for (let i = 0; i < n; i++) {
      const a = a0 + rand(-spread, spread), sp = rand(500, 1000) * k, L = rand(26, 42) * k;
      LK.part({ n: 'rl_shard', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 6, rot: a + PI, spin: rand(-8, 8), len: L, life: rand(0.22, 0.4), a: 1, col: col || EDGE, white: 0.45, g: 0.7, fade: out(1.2) });
    }
  }
  // ghost flames rising round (x, y)
  function flames(x, y, n, r, k) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), rr = r * rand(0.3, 1);
      LK.part({ n: 'rl_flame', x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * SQ - 20 * k, vx: rand(-15, 15), vy: -rand(120, 220) * k, drag: 1.2, len: rand(30, 48) * k,
        life: rand(0.45, 0.75), a: 0.85, col: i % 3 ? SOUL : DEEP, white: 0.35, g: 0.7, grow: pop(0.4, 1, 0.3), fade: inOut(0.12, 0.6), sway: rand(4, 8), swayA: rand(4, 10), ph: rand(0, 6) });
    }
  }
  function inkPuffs(x, y, n, r, k, layer) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      dark({ n: i % 2 ? 'rl_vpuff' : 'rl_vpuff2', x: x + Math.cos(a) * r * rand(0.2, 1), y: y + Math.sin(a) * r * rand(0.2, 1) * SQ, vx: Math.cos(a) * rand(30, 90), vy: -rand(10, 50), drag: 1.5,
        rot: rand(0, TAU), spin: rand(-1.2, 1.2), len: rand(70, 120) * k, life: rand(0.5, 0.8), a: 0.45, grow: (u) => 0.6 + 0.6 * u, fade: inOut(0.12, 0.6), layer: layer || 'high' });
    }
  }
  // the moon sigil flat on the ground at (x, y), turning
  function moonSigil(x, y, R, life, o) {
    o = o || {};
    if (!has('rl_sigil')) return;
    const rot0 = rand(0, TAU), spin = o.spin || 0.9;
    LK.nightLight(x, y, R * 1.6, SOUL, 0.6, life, o.follow);
    return LK.add({ x, y, life, layer: 'low', follow: o.follow, draw(c, q, u, glow) {
      const px = q.follow ? q.follow.x : q.x, py = q.follow ? q.follow.y : q.y;
      const a = (o.a || 1) * inOut(o.fin || 0.12, o.fout || 0.35)(u), g = o.pop ? pop(0.6, 1, 0.25)(u) : 1;
      LK.piece(c, 'ground_glow', px, py, 0, R * 2.7 * g, R * 2.7 * g * asp('ground_glow'), a * 0.3, SOUL, 0, { glow, ground: true, g: 0.3 });
      LK.piece(c, 'rl_sigil', px, py, rot0 + q.t * spin, R * 2 * g, R * 2 * g, a * 0.95, o.col || null, 0.25, { glow, ground: true, g: 0.45 });
    } });
  }

  // =====================================================================================================
  // the looks, by skill (each fired by the skill's own code-drawn effect, at its moment and place)
  // =====================================================================================================
  // ---------------- ฟันเก็บเกี่ยว: one turn of the scythe (i 0 / 1) round (x, y) ----------------
  function spinTurn(who, x, y, i) {
    const big = i === 1, s = big ? 1.18 : 1, dir = big ? -1 : 1, R = 190 * s, cy = y - 58;
    if (NC.MeshFX && NC.MeshFX.ok()) {
      const base = rand(0, TAU);
      NC.MeshFX.slash({ x, y: y - 10, h: 52, r: R, w: 120 * s, tilt: 0.1, a0: base, a1: base + dir * TAU * 1.02, dur: 0.18, lag: 0.13, life: 0.5,
        strip: 'strip_steel', tint: [0.72, 0.98, 1.3], dark: true, owner: who });
    }
    // the reaping ring at the waist, flat, turning the swing's way, and a smaller one chasing it
    for (const [k, a, l] of [[1, 1, 0.34], [0.78, 0.6, 0.28]]) {
      LK.add({ x, y: cy, life: l, draw(c, q, u, glow) {
        const g = pop(0.62, 1.08, 0.35)(u) * k, rot = q.t * 15 * dir + (dir < 0 ? PI : 0);
        LK.piece(c, 'rl_ring', q.x, q.y, rot, R * 2.2 * g, R * 2.2 * g, a * out(1.3)(u), null, 0.45, { glow, ground: true, g: 0.7, flipY: dir < 0 });
      } });
    }
    dark({ n: 'rl_vring', x, y: y - 6, rot: rand(0, TAU), spin: dir * 9, len: R * 2.5, life: 0.5, a: 0.5, ground: true, layer: 'low', grow: pop(0.7, 1.12, 0.4), fade: out(1.3) });
    // spikes and crescent shards flung off the blade's path
    for (let k = 0; k < (big ? 14 : 10); k++) {
      const th = rand(0, TAU), px = x + Math.cos(th) * R, py = cy + Math.sin(th) * R * SQ, ta = th + dir * PI / 2;
      const vx = Math.cos(ta) * rand(700, 1200) + Math.cos(th) * 260, vy = (Math.sin(ta) * rand(700, 1200) + Math.sin(th) * 260) * SQ;
      LK.part({ n: k % 3 ? 'spike_mid' : 'spike_long', x: px, y: py, vx, vy, drag: 9, stretch: true, sp0: 700, len: rand(80, 140), life: rand(0.14, 0.24), a: 0.9, col: k % 4 ? SOUL : DEEP, white: 0.45, g: 0.55, fade: out(1.3) });
    }
    for (let k = 0; k < (big ? 6 : 4); k++) { const th = rand(0, TAU); shards(x + Math.cos(th) * R, cy + Math.sin(th) * R * SQ, 1, th + dir * 1.2, 0.3, 1.1); }
    if (big) {
      moonSigil(x, y, 210, 0.7, { pop: true, spin: -1.6, fout: 0.5 });
      LK.ring(x, y, { r0: 50, r1: 300, life: 0.42, col: SOUL, a: 0.85 });
      inkPuffs(x, y, 4, 160, 1, 'low');
      zoom(x, cy, 0.035, 0.2);
    }
  }
  // ---------------- ประหารใต้จันทร์ ----------------
  // the moon rising over the target, the sigil under it, the ghost scythe lifting behind it; the chop at `at` seconds
  const SCY = { px: 0.175, py: 0.494 };   // (the ghost scythe's grip, the foot of its shaft, from the piece's centre, x its size)
  // the world dimmed (a tint over everything below the light layer, so the moon and the cut stay bright)
  FX.def('rldim', (ctx, q, u) => {
    const a = q.a * (u < q.fin ? u / q.fin : u > 1 - q.fout ? (1 - u) / q.fout : 1);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(6,4,22,${Math.max(0, Math.min(1, a)).toFixed(3)})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }, 'high');
  function executeWindup(x, y, at, side) {
    FX.add({ type: 'rldim', x, y, life: at + 0.75, a: 0.42, fin: 0.2, fout: 0.5 });
    moonSigil(x, y, 140, at + 0.55, { pop: true, spin: 1.2, fout: 0.45 });
    const life = at + 0.7;
    if (has('rl_moon')) LK.add({ x, y, life, draw(c, q, u, glow) {
      const t = q.t, rise = Math.min(1, t / at), a = (t < at + 0.15 ? Math.min(1, t / 0.12) : Math.max(0, 1 - (t - at - 0.15) / 0.5));
      const mx = x - side * 40, my = y - 430 - 40 * (1 - rise) * (1 - rise);
      LK.piece(c, 'soft', mx, my, 0, 420, 420 * asp('soft'), a * 0.45, SOUL, 0, { glow, g: 0.5 });
      LK.piece(c, 'rl_moon', mx, my, 0, 190, 190 * asp('rl_moon'), a * 0.95, '#d8ecff', 0.3, { glow, g: 0.6 });
    } });
    // the ghost scythe of a giant unseen reaper: its grip high on the reaper's side, the blade lifted over the target, then
    // swung down so the blade passes through it and hangs there (shaft level), then fading. Drawn for the grip on the
    // right and mirrored round the target when the reaper stands on the left.
    if (has('rl_gscythe')) LK.add({ x, y, life, draw(c, q, u, glow) {
      const t = q.t, H = 540, W = H / asp('rl_gscythe');
      let th, a;
      if (t < at) { const k = t / at; th = 0.35 + 0.2 * (1 - k) * (1 - k); a = Math.min(1, t / 0.15); }
      else { const k = Math.min(1, (t - at) / 0.07); th = 0.35 - (0.35 + PI / 2) * (1 - Math.pow(1 - k, 3)); a = Math.max(0, 1 - Math.max(0, t - at - 0.06) / 0.16); }
      const gx = x + 470, gy = y - 175, ox = -SCY.px * W, oy = -SCY.py * H;   // (the grip; the piece's centre from it)
      const cx = gx + ox * Math.cos(th) - oy * Math.sin(th), cy = gy + ox * Math.sin(th) + oy * Math.cos(th);
      c.save();
      if (side < 0) { c.translate(x, 0); c.scale(-1, 1); c.translate(-x, 0); }
      LK.piece(c, 'soft', cx, cy, 0, W * 1.3, H * 1.1, a * 0.3, SOUL, 0, { glow, g: 0.4 });
      LK.piece(c, 'rl_gscythe', cx, cy, th, W, H, a, null, 0.5, { glow, g: 0.8 });
      if (t >= at && t < at + 0.1) for (let j = 1; j <= 3; j++) {   // (the swing's smear: the scythe a moment ago, fainter)
        const tj = th + j * 0.32, ex = gx + ox * Math.cos(tj) - oy * Math.sin(tj), ey = gy + ox * Math.sin(tj) + oy * Math.cos(tj);
        LK.piece(c, 'rl_gscythe', ex, ey, tj, W, H, a * (0.5 - j * 0.13), SOUL, 0.1, { glow, g: 0.5 });
      }
      c.restore();
    } });
    for (let k = 0; k < 8; k++) LK.part({ n: 'rl_flame', x: x + rand(-110, 110), y: y + rand(-30, 30), vx: 0, vy: -rand(40, 90), len: rand(22, 34), life: at + rand(0.1, 0.3), a: 0.6, col: SOUL, white: 0.3, g: 0.6, fade: inOut(0.3, 0.4), sway: rand(4, 8), swayA: 6, ph: rand(0, 6) });
  }
  function executeChop(x, y, side) {
    // the cut through the sky: a giant crescent falling onto the target from the scythe's side, on its ink
    const m = mirror(PI / 2 - 0.5, -side);
    dark({ n: 'rl_vsweep', x: x + side * 90, y: y - 200, rot: m.rot, flipY: m.flipY, len: 600, life: 0.55, a: 0.6, grow: pop(0.8, 1.04, 0.2), fade: out(1.4) });
    LK.part({ n: 'rl_sweep', x: x + side * 80, y: y - 200, rot: m.rot, flipY: m.flipY, len: 560, life: 0.34, a: 1, col: null, white: 0.45, g: 0.8, grow: pop(0.75, 1.04, 0.2), fade: out(1.5) });
    // the air torn open
    if (has('rl_rift')) LK.add({ x, y, life: 0.6, draw(c, q, u, glow) {
      const w = (u < 0.12 ? u / 0.12 : 1) * (1 - 0.5 * u), a = inOut(0.04, 0.55)(u);
      LK.piece(c, 'rl_rift', x, y - 105, 0.05, 66 * w + 8, 290, a * 0.7, SOUL, 0.12, { glow, g: 0.45 });
    } });
    LK.burst(x, y - 70, { k: 0.95, col: SOUL, n: 12, spark: 6, flash: false });
    LK.part({ n: 'core', x, y: y - 70, len: 150, life: 0.12, a: 0.7, col: SOUL, white: 0.25, g: 0.5, grow: pop(0.5, 1, 0.4), fade: out(1.4) });
    LK.ring(x, y, { r0: 30, r1: 240, life: 0.45, col: SOUL, a: 0.75 });
    LK.crack(x, y, { r: 150, col: SOUL, life: 1.3 });
    shards(x, y - 70, 8, -PI / 2, 1.4, 1.3);
    flames(x, y, 8, 130, 1.2);
    inkPuffs(x, y - 20, 5, 120, 1.2);
    dark({ n: 'rl_vtendril', x, y: y - 90, len: 210, life: 0.7, a: 0.55, grow: pop(0.5, 1.1, 0.35), fade: inOut(0.1, 0.6) });
    zoom(x, y - 80, 0.065, 0.26);
  }
  function executeKill(e, x, y) {
    const ex = e ? e.x : x, ey = e ? e.y - Math.max(36, (e.y - (NC.labelTop ? NC.labelTop(e) : e.y - 100)) * 0.45) : y;
    LK.part({ n: 'rl_cross', x: ex, y: ey, rot: rand(-0.15, 0.15), len: 260, life: 0.42, a: 1, col: BLOOD, white: 0.35, g: 0.8, grow: pop(0.5, 1.08, 0.18), fade: out(1.3) });
    LK.part({ n: 'rl_cross', x: ex, y: ey, rot: rand(-0.15, 0.15), len: 300, life: 0.2, a: 0.7, col: '#ffffff', white: 0.4, g: 0.3, grow: pop(0.6, 1.1, 0.2), fade: out(1) });
    LK.burst(ex, ey, { k: 1, col: BLOOD, n: 12, spark: 5 });
    dark({ n: 'rl_vtendril', x: ex, y: ey - 10, len: 170, life: 0.8, a: 0.6, grow: pop(0.4, 1.15, 0.4), fade: inOut(0.1, 0.6) });
    V.at(0.1, () => soulTear(ex, ey - 20, -PI / 2 + rand(-0.15, 0.15), { sp: 820, len: 96, life: 0.85, drag: 1.4, col: '#bfeaff' }));
  }
  // ---------------- ขว้างเคียววกกลับ: a sickle as a spinning disc of light ----------------
  function sickleLook(p) {
    const u0 = p.update;
    p.rlHist = [];
    let inkT = 0;
    p.update = function (q, dt) {
      const r = u0 ? u0.apply(this, arguments) : undefined;
      q.rlHist.unshift([q.x, q.y, q.rot || 0]);
      if (q.rlHist.length > 8) q.rlHist.length = 8;
      if ((inkT -= dt) <= 0 && q.rlHist.length > 2) {
        inkT = 0.09; // (0.045 left ~7 ink streaks alive per sickle: see the draw below)
        const [x1, y1] = q.rlHist[2], ang = Math.atan2(q.y - y1, q.x - x1);
        dark({ n: 'rl_vstreak', x: q.x - Math.cos(ang) * 30, y: q.y - Math.sin(ang) * 30, rot: ang, len: 120, life: 0.3, a: 0.32, fade: out(1.2) });
      }
      return r;
    };
    p.type = 'lk'; p.layer = 'glow'; p.noBloom = true; // (no bloom pass for the whole flight: lightkit.js bloom)
    p.draw = (c, q, u, glow) => {
      const H = q.rlHist;
      // the afterimages: every other place of the last eight, and not in the bloom pass. A sickle drew 10 light pieces a
      // frame (twice with the bloom) for its whole flight out and back, four sickles from Lv 10, and the twin-sickle
      // reaper throws them every 3 s: FPS fell by half (120 -> 60) while they flew (2026-10-21, players after 0.5.8)
      if (!glow) for (let i = H.length - 1; i >= 1; i -= 2) { const [hx, hy, hr] = H[i]; LK.piece(c, 'rl_shard', hx, hy, hr, 64, 64 * asp('rl_shard'), 0.62 * (1 - i / H.length), SOUL, 0.2, { glow, g: 0.55 }); }
      LK.piece(c, 'whirl', q.x, q.y, (q.rot || 0) * 0.6, 92, 92 * asp('whirl'), 0.55, SOUL, 0.25, { glow, g: 0.6 });
      const s = NC.SPR.w_sickles;
      if (!glow && s) { c.save(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.translate(q.x, q.y); c.rotate(q.rot || 0); c.drawImage(s.img, -s.w / 2, -s.h / 2, s.w, s.h); c.restore(); }
      if (!glow) LK.piece(c, 'rl_hook', q.x, q.y, (q.rot || 0) + 0.4, 62, 62 * asp('rl_hook'), 0.85, EDGE, 0.4, { glow, g: 0.6 }); // (its edge: the whirl carries the bloom)
    };
  }
  // ---------------- เกี่ยววิญญาณ: the soul chain shooting out, hooking, yanking back ----------------
  function chainLook(x0, y0, x1, y1) {
    if (!has('rl_chain')) return;
    const ang = Math.atan2(y1 - y0, x1 - x0), D = Math.hypot(x1 - x0, y1 - y0), SEG = 170, life = 0.42;
    LK.add({ x: x0, y: y0, life, draw(c, q, u, glow) {
      const t = q.t, reach = t < 0.1 ? t / 0.1 : t < 0.16 ? 1 : Math.max(0, 1 - (t - 0.16) / 0.22), L = D * reach;
      if (L < 4) return;
      const a = inOut(0.02, 0.25)(u), wid = SEG * asp('rl_chain');
      for (let d = 0; d < L; d += SEG) {
        const l = Math.min(SEG, L - d), cx = x0 + Math.cos(ang) * (d + l / 2), cy = y0 + Math.sin(ang) * (d + l / 2);
        LK.piece(c, 'rl_chain', cx, cy, ang, SEG, wid, a, EDGE, 0.6, { glow, g: 0.45 });
      }
      const hx = x0 + Math.cos(ang) * L, hy = y0 + Math.sin(ang) * L;
      LK.piece(c, 'rl_hook', hx, hy, ang + PI / 2, 96, 96 * asp('rl_hook'), a, EDGE, 0.5, { glow, g: 0.7 });
    } });
    LK.part({ n: 'glint', x: x1, y: y1, len: 90, life: 0.2, a: 1, col: SOUL, white: 0.5, g: 0.7, fade: out(1.2) });
  }
  // ---------------- ร่างวิญญาณ: a cut left on every monster passed, bursting after the reaper has gone by ----------------
  function ghostMark(p, e) {
    const x = e.x, y = e.y - 55, a = p.aim || 0;
    LK.part({ n: 'rl_shard', x, y, rot: a + PI, len: 60, life: 0.3, a: 0.9, col: EDGE, white: 0.4, g: 0.6, fade: inOut(0.05, 0.5) });
    V.at(0.32, () => {
      const ex = alive(e) ? e.x : x, ey = alive(e) ? e.y - 55 : y;
      LK.part({ n: 'rl_cross', x: ex, y: ey, rot: rand(-0.3, 0.3), len: 170, life: 0.3, a: 1, col: null, white: 0.5, g: 0.8, grow: pop(0.4, 1.1, 0.2), fade: out(1.3) });
      LK.burst(ex, ey, { k: 0.7, col: SOUL, n: 9, spark: 4 });
      dark({ n: 'rl_vpuff', x: ex, y: ey + 10, rot: rand(0, TAU), len: 120, life: 0.45, a: 0.4, grow: (u) => 0.6 + 0.6 * u });
      soulTear(ex, ey, -PI / 2 + rand(-0.4, 0.4), { sp: 520, len: 60, life: 0.5 });
    });
  }
  function ghostLine(x0, y0, x1, y1) {
    LK.line(x0, y0, x1, y1, { col: SOUL, w: 16, life: 0.4 });
    const ang = Math.atan2(y1 - y0, x1 - x0), D = Math.hypot(x1 - x0, y1 - y0);
    dark({ n: 'rl_vstreak', x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 6, rot: ang, len: D * 1.15, wid: 70, life: 0.45, a: 0.4, fade: out(1.3) });
    for (let i = 0; i < 4; i++) { const k = rand(0.1, 0.95); soulTear(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, -PI / 2 + rand(-0.5, 0.5), { sp: rand(160, 300), len: 40, life: 0.6, drag: 1 }); }
  }
  // ---------------- พายุวิญญาณ: the storm round the reaper (swapped in for the code-drawn one) ----------------
  function wispAt(c, x, y, size, t, a, glow) {
    const F = LK.MAN.wisp && LK.MAN.wisp.frames;
    if (!F) return LK.piece(c, 'orb', x, y, 0, size, size, a, SOUL, 0.4, { glow, g: 0.6 });
    const n = F.length, f = ((Math.floor((t || 0) * 10) % n) + n) % n || 0, fr = F[f], k = size / fr.w * 1.5;
    LK.piece(c, 'wisp', x, y, 0, fr.w * k, fr.h * k, a, SOUL, 0.35, { glow, frame: f, g: 0.6 });
  }
  function stormSwap(p, L) {
    let acc = 0, fl = 0;
    L.swap(p, (c, q, u, glow) => {
      const G = NC.game, t = G ? G.time : q.t, a = Math.min(1, q.t / 0.25, (q.life - q.t) / 0.5);
      LK.piece(c, 'ground_glow', q.x, q.y, 0, 520, 520 * asp('ground_glow'), a * 0.3, SOUL, 0, { glow, ground: true, g: 0.3 });
      LK.piece(c, 'rl_sigil', q.x, q.y, t * 0.7, 400, 400, a * 0.75, null, 0.2, { glow, ground: true, g: 0.4 });
      LK.piece(c, 'rl_ring', q.x, q.y - 60, t * 9, 420, 420, a * 0.4, SOUL, 0.2, { glow, ground: true, g: 0.5 });
      for (let i = 0; i < q.n; i++) for (const ring of [0, 1]) {
        const ang = t * (3 + ring) + (i / q.n) * TAU + ring, R = ring ? 170 : 110, x = q.x + Math.cos(ang) * R, y = q.y - 60 + Math.sin(ang) * R * 0.4;
        wispAt(c, x, y, ring ? 22 : 19, t + i * 0.37, a * (Math.sin(ang) > 0 ? 0.8 : 0.45), glow);
      }
      for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) {   // (three hooks of light chasing round, each with its afterimages)
        const ang = t * 7 + (k / 3) * TAU - j * 0.13, x = q.x + Math.cos(ang) * 150, y = q.y - 60 + Math.sin(ang) * 150 * 0.4;
        LK.piece(c, 'rl_hook', x, y, ang + PI, 70 - j * 8, (70 - j * 8) * asp('rl_hook'), a * (j ? 0.45 / j : 0.9), j ? SOUL : EDGE, j ? 0.1 : 0.4, { glow, g: 0.6 });
      }
    }, (q, dt) => {
      if ((acc += dt) >= 0.5) {
        acc -= 0.5;
        LK.ring(q.x, q.y, { r0: 60, r1: 215, life: 0.36, col: SOUL, a: 0.65 });
        for (let k = 0; k < 4; k++) { const th = rand(0, TAU); shards(q.x + Math.cos(th) * 120, q.y - 60 + Math.sin(th) * 50, 1, th, 0.3, 1); }
      }
      if ((fl -= dt) <= 0) { fl = 0.07; const th = rand(0, TAU); flames(q.x + Math.cos(th) * 170, q.y + Math.sin(th) * 170 * SQ, 1, 10, 1.1); }
    });
  }
  // the souls round the reaper: painted wisps on the same orbits
  function soulsSwap(p, L) {
    L.swap(p, (c, q, u, glow) => {
      const G = NC.game, P = G && G.player;
      if (!P || !NC.isJob(P, 'reaper') || P.dead > 0) return;
      const n = P.rpSouls || 0, t = G.time;
      for (let i = 0; i < n; i++) {
        const a = t * 1.3 + (i / Math.max(1, n)) * TAU, x = P.x + Math.cos(a) * 62, y = P.y - 70 + Math.sin(a) * 22 + Math.sin(t * 3 + i) * 5;
        wispAt(c, x, y, 20, t + i * 0.41, Math.sin(a) > 0 ? 0.95 : 0.5, glow);
      }
    });
    // the ring never ends (life 1e9): in the bloom it kept the whole pass (two blurs + an upload) running every frame a
    // reaper was on the screen, souls or none (2026-10-21, FPS halved for twin-sickle reapers): lit without it
    p.noBloom = true;
  }
  // ---------------- ผู้เก็บเกี่ยวจันทรา: the full moon's crescent ----------------
  function harvestWave(x, y, aim) {
    const W = 760, vx = Math.cos(aim) * 520, vy = Math.sin(aim) * 380;
    LK.part({ n: 'rl_moon', x: x - Math.cos(aim) * 60, y: y - 200, len: 260, life: 0.7, a: 0.55, col: '#d8ecff', white: 0.2, g: 0.5, fade: inOut(0.1, 0.5) });
    dark({ n: 'rl_vsweep', x, y, vx, vy, drag: 2, rot: aim + PI / 2 + 0.2, len: W * 1.05, life: 0.6, a: 0.5, grow: pop(0.6, 1.05, 0.3), fade: out(1.4) });
    LK.part({ n: 'rl_wave', x, y, vx, vy, drag: 2, rot: aim, len: W, life: 0.5, a: 1, col: null, white: 0.55, g: 0.85, grow: pop(0.55, 1.05, 0.3), fade: out(1.4) });
    LK.ring(x, y + 30, { r0: 60, r1: 420, life: 0.5, col: SOUL, a: 0.8 });
    shards(x, y, 10, aim, 0.9, 1.4);
    zoom(x, y, 0.06, 0.26);
  }

  // =====================================================================================================
  // the skin: holy for the rest, the reaper's own looks fired by the skills' own code-drawn effects
  // =====================================================================================================
  const LOOK = {
    rp_sweep: { slash: (p, S) => { spinTurn(S.p, p.x, p.y - 10, Math.cos(p.ang || 0) < 0 ? 1 : 0); return null; } },
    rp_execute: {
      circle: (p, S) => { executeWindup(p.x, p.y, 0.22, S.p && S.p.x < p.x ? -1 : 1); return null; },
      beam: (p, S) => { executeChop(p.x, p.y, S.p && S.p.x < p.x ? -1 : 1); return null; },
      slash: () => null,
    },
    rp_hook: {
      line: (p) => { chainLook(p.x, p.y, p.x1, p.y1); return null; },
      slash: (p, S) => { const dir = S.p && S.p.x > p.x ? -1 : 1; crescentCut(p.x, p.y, 210, dir, { rot: -0.35, white: 0.4 }); LK.burst(p.x, p.y, { k: 0.7, col: SOUL, n: 8, dir, spark: 3, flash: false }); return null; },
    },
    rp_ghost: { line: (p) => { ghostLine(p.x, p.y, p.x1, p.y1); return null; } },
    hv_phase: {
      slash: (p, S) => {
        if ((p.thick || 0) < 60) return null;   // (the second, thinner crescent: part of the one wave)
        const aim = (p.ang || 0) - PI / 2;
        harvestWave(p.x, p.y, S.p && S.p.aim !== undefined ? S.p.aim : aim);
        return null;
      },
    },
  };
  // any other slash of the line (class-3 echoes ...): the scythe's crescent along that arc
  const anySlash = (p) => {
    if (!has('rl_sweep')) return undefined;
    const sweep = p.sweep || 2, m = (p.ang || 0) + sweep / 2, r = p.r || 90;
    const x = p.x + Math.cos(m) * r * 0.55, y = p.y + Math.sin(m) * r * 0.55;
    LK.part({ n: 'rl_sweep', x, y, rot: m + PI / 2, len: r * 2.1, life: p.life || 0.28, a: 1, col: null, white: 0.5, g: 0.75, grow: pop(0.75, 1.05, 0.3), fade: out(1.5) });
    dark({ n: 'rl_vsweep', x, y: y + 6, rot: m + PI / 2, len: r * 2.3, life: (p.life || 0.28) * 1.5, a: 0.38, fade: out(1.5) });
    return null;
  };
  const MAP = LK.holyMap((kind, p, S) => {
    const L = LOOK[S.tag];
    if (L && L[kind]) return L[kind](p, S);
    if (kind === 'slash') return anySlash(p);
    return undefined;
  });
  // the skill's projectiles: the thrown sickles; the souls flying (K.drawGhost below) keep their own flight
  const proj0 = MAP.vproj;
  MAP.vproj = (p, S) => {
    if ((S.tag === 'rp_return' || S.tag === 'hv_return') && has('whirl')) { sickleLook(p); return undefined; }
    return proj0 ? proj0(p, S) : undefined;
  };
  // 'ประหาร!' (an execution): the crimson cross and the soul torn out of the one executed
  MAP.text = (p, S) => {
    if (S.tag === 'rp_execute' && p.text === 'ประหาร!') {
      const G = NC.game, e = G && (G.enemies || []).filter((f) => Math.abs(f.x - p.x) < 2).sort((a, b) => a.hp - b.hp)[0];
      executeKill(e, p.x, p.y + 130);
    }
    return undefined;
  };
  // the ghost dash's afterimages (V.ghost every frame piled into one pale block): one in three, shorter, the soul's colour
  MAP.hero = (p, S) => {
    if (S.tag !== 'rp_ghost') return undefined;
    S.rlGh = (S.rlGh || 0) + 1;
    if (S.rlGh % 3 !== 1) return null;
    p.color = '#6fc4ff'; p.life = Math.min(p.life || 0.3, 0.22);
    return undefined;
  };
  // rings flat on the ground in soul light (an upright one read as a dome)
  MAP.ring = (p) => { LK.ring(p.x, p.y, { r0: p.r0, r1: (p.r1 || 150) * 0.85, life: p.life, col: SOUL, a: 0.7 }); return null; };
  // motes of the souls: soul light, not petals; stars in the moon's colours, never gold
  MAP.vmote = (p) => LK.asPart(p, 'mote', (p.r || 4) * 4, LK.hex(p.rgb || SOULRGB, 0.25), { a: p.a || 1, g: 0.8 });
  MAP.star = (p) => LK.asPart(p, 'glint', (p.size || 14) * 2.2, Math.random() < 0.5 ? EDGE : SOUL, { tw: 34 });
  MAP.vstar = (p) => LK.asPart(p, 'glint', (p.s || 12) * 2.6, SOUL, { tw: 34 });
  // the hit feel's warm pieces on the line's hits (js/hitfeel.js): embers -> soul sparks with the same flight, the round hit
  // light and its pool on the ground -> soul light, the impact spark tinted
  function hitFeel(p, L, base) {
    if (p.type === 'hfember') {
      LK.asPart(p, Math.random() < 0.3 ? 'rl_shard' : 'spike_mid', 40 * (p.k || 1), Math.random() < 0.3 ? DEEP : SOUL, { stretch: true, sp0: 500, white: 0.4, fade: out(1.2) });
      base(p);
      return true;
    }
    if (p.type === 'hflight') { LK.part({ n: 'soft', x: p.x, y: p.y, len: p.size * 0.8, life: p.life, a: p.a * 0.45, col: SOUL, white: 0, g: 0.35, grow: pop(0.6, 1, 0.3), fade: out(1.5) }); return true; }
    if (p.type === 'hfpool') {
      LK.add({ x: p.x, y: p.y, life: p.life, layer: 'low', draw(c, q, u, glow) { LK.piece(c, 'ground_glow', q.x, q.y, 0, p.size, p.size * asp('ground_glow'), p.a * 0.55 * out(1.3)(u), SOUL, 0, { glow, ground: true, g: 0.3 }); } });
      return true;
    }
    if (p.type === 'hfspark') return true;   // (its white-gold painting burnt the hit white under the line's own burst)
    return false;
  }

  // every monster a skill of the line hits: what it gives up
  const HIT = {
    rp_sweep: (game, p, e) => {
      const y = e.y - 55;
      LK.burst(e.x, y, { k: 0.42, col: SOUL, n: 5, spark: 2, flash: false });
      const now = game.time || 0;
      if ((p._rlTear || 0) < now - 0.04) { p._rlTear = now; soulTear(e.x, y - 10, NC.angle(e.x, y, p.x, p.y - 90) + rand(-0.4, 0.4), { sp: 520, len: 58, life: 0.5 }); }
    },
    rp_execute: (game, p, e) => { soulTear(e.x, e.y - 70, -PI / 2 + rand(-0.3, 0.3), { sp: 600, len: 70, life: 0.6 }); },
    rp_return: (game, p, e) => { // (once per monster each 0.2 s: four sickles out and back struck each monster up to 8 times a throw)
      const now = game.time || 0;
      if ((e._rlRet || -9) > now - 0.2) return;
      e._rlRet = now;
      shards(e.x, e.y - 50, 2, rand(0, TAU), PI, 0.9); LK.burst(e.x, e.y - 50, { k: 0.45, col: SOUL, n: 5, spark: 2 });
    },
    rp_hook: (game, p, e) => { soulTear(e.x, e.y - 60, NC.angle(e.x, e.y - 60, p.x, p.y - 90), { sp: 700, len: 72, life: 0.5, drag: 1.5 }); },
    rp_ghost: (game, p, e) => ghostMark(p, e),
  };
  const baseHit = K.hit;
  K.hit = function (game, p, id, e) {
    const r = baseHit.apply(this, arguments);
    if (r && !r.miss && HIT[id] && e && RL && RL.live() && RL.fam(p)) { try { HIT[id](game, p, e, r); } catch (err) { console.warn('reaperlight', id, err); } }
    return r;
  };

  // a plain hit with the scythe or the sickles: the scythe's crescent of light across the monster, on an ink smear
  function plainHit(e, r, h) {
    const sick = h.W && h.W.wtype === 'sickle', k = h.k * (sick ? 0.72 : 1) * (h.big ? 1.2 : 1);
    crescentCut(h.x, h.y, (sick ? 150 : 210) * k, h.dir, { life: sick ? 0.2 : 0.26, inkA: sick ? 0.32 : 0.42 });
    LK.burst(h.x, h.y, { k: k * 0.55, col: r.crit ? BLOOD : SOUL, n: r.crit ? 12 : 7, dir: h.dir, spark: 4 });
    if (r.crit) {
      LK.part({ n: 'rl_cross', x: h.x + h.dir * 8, y: h.y, rot: rand(-0.2, 0.2), len: 190 * k, life: 0.3, a: 1, col: BLOOD, white: 0.35, g: 0.75, grow: pop(0.5, 1.08, 0.2), fade: out(1.3) });
    } else if (Math.random() < 0.3) {
      LK.part({ n: 'rl_flame', x: h.x + rand(-20, 20), y: h.y - 10, vx: rand(-20, 20), vy: -rand(120, 200), drag: 1.5, len: rand(26, 36), life: 0.5, a: 0.8, col: SOUL, white: 0.3, g: 0.6, grow: pop(0.4, 1, 0.3), fade: inOut(0.1, 0.6) });
    }
  }

  RL = LK.lineSkin({
    name: 'ReaperLight', param: 'reaperlight', jobs: ['reaper', 'harvester'], root: 'reaper',
    ready: ['rl_sweep', 'rl_ring', 'rl_vsweep', 'rl_soul', 'ring', 'glint', 'orb', 'soft', 'core', 'spike_mid', 'spike_long', 'shard', 'drop'],
    map: MAP,
    swaps: { j3storm: (p, L) => stormSwap(p, L), j3souls: (p, L) => soulsSwap(p, L) },
    plainHit, swingRing: true,
    add: hitFeel,
  });
  // (the pieces load the first time a reaper is seen; the souls' ring may have been added before: swapped once they are in)
  NC.skillTicks.push((game, p) => {
    if (!RL.fam(p)) return;
    ensure();
    if (!RL.live() || p._rlSoulsSwapped) return;
    const q = FX.list.find((f) => f.type === 'j3souls' && !f.origType);
    if (q) { soulsSwap(q, RL); p._rlSoulsSwapped = true; }
  });
  for (const id of RL.ids) {   // (another hero's skill online: its look loads the pieces too)
    const f = NC.SKILL_RUN[id];
    if (f && !f.rlEnsure) { const g = function () { ensure(); return f.apply(this, arguments); }; g.rlEnsure = true; g.lkSkin = f.lkSkin; g._orig = f._orig || f; NC.SKILL_RUN[id] = g; }
  }
  // the souls flying to the reaper (K.drawGhost in the soul's colour): a painted wisp of light
  const baseGhost = K.drawGhost;
  K.drawGhost = function (ctx, x, y, s, t, rgb, a) {
    if (rgb !== SOULRGB || !RL.live() || !has('wisp')) return baseGhost.apply(this, arguments);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    LK.piece(ctx, 'soft', x, y, 0, s * 5, s * 5 * asp('soft'), (a === undefined ? 1 : a) * 0.35, SOUL, 0, {});
    wispAt(ctx, x, y, s * 2.4, t, a === undefined ? 1 : a, false);
    ctx.restore();
  };
  RL.looks = { spinTurn, executeWindup, executeChop, executeKill, chainLook, ghostLine, harvestWave, crescentCut, soulTear };
})();
