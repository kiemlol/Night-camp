/* roguelight.js — the ROGUE LINE's skills made of light on ink, the reaper's recipe (2026-10-20, the user after the scythe:
   "ทำ vfx โจรใหม่ด้วย สูตรเดียวกับเคียวเลย"), on js/lightkit.js (LK.lineSkin) + js/inklight.js. Jobs: โจร, นักฆ่า, นินจา and
   their class 3 (นักฆ่าจันทรคราส, จ้าวเงาร้อยร่าง); ยมทูต has its own (js/reaperlight.js), นักเชิดหุ่น keeps its looks.
   Every skill keeps its own code and numbers; only the drawing changes. Each job its light: โจร shadow violet, นักฆ่า crimson,
   นินจา moon steel; poison is toxic green. The painted pieces (assets/roguelight, Codex: assets/gen/make_roguelight_prompts.py
   -> tools/roguelight_cut.py): fang cuts, katar claws, a stab, a shadow slash, the death mark, a shadow meteor, venom splash
   and bubbles, a dash streak, a dagger, a blood spray, a ring of blades; the huuma star, a throwing star, a kunai, a wind
   blade, a fire swirl, a lightning seal; ink: a smoke bomb, a poison cloud, an ink slash, an ink splat, an ink smear, torn
   shadow. What the skills' code-drawn effects become:
     a slash      the line's cut of light (claws for the assassin, fangs for venom, the shadow slash) on an ink slash; the big
                  finishers (พายุคมเงา, ตราประทับมรณะ) a crimson cross, a burst of the ring of blades, a blood spray, ink
     a cut line   a stab of light along it (the flurries' cuts through the target), a dash's line: the dash streak on an ink smear
     a cast circle  the death mark turning on the ground (crimson) / the lightning seal (คาถาสายฟ้า)
     smoke        ink: smoke bombs (dark violet), poison clouds (dark green); the poison's skulls -> venom bubbles rising
     shots        the knives -> daggers of light, the kunai -> a kunai of light trailing fire, คาถาไฟ -> fire swirls, the
                  clones' stars and พายุชูริเคน -> throwing stars of light
     the world    the darkening a skill asks for -> a dim under the light (the light stays bright); white flashes halved
   Switch: ESC → ตั้งค่า "สายโจร" (js/hitstyle.js row 'rogue', NC.RogueLight.on); ?roguelight=1 / 0 forces it. The pieces load the
   first time a hero of the line is seen. Load after the line's files, js/lightkit.js and js/inklight.js, before js/hitstyle.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, LK = NC.LightKit, IL = NC.InkLight, K = NC.SkillKit;
  if (!FX || !V || !LK || !LK.lineSkin || !LK.addPieces || !IL || !K) return;
  const MANR = NC.ASSET_MANIFEST_ROGUELIGHT || {};
  const rand = NC.rand, PI = Math.PI, TAU = PI * 2, SQ = V.SQ || 0.58;
  const out = LK.out, inOut = LK.inOut, asp = (n) => LK.aspect(n), pop = IL.pop, has = IL.has;
  const VIOL = '#b48cff', CRIM = '#e4152f', STEEL = '#c4dcff', GREEN = '#7dff6a', FIRE = '#ff9a3c', BOLT = '#7fc8ff', WIND = '#8dffc4';
  const isJob = (p, j) => !!p && (p.job === j || (NC.isJob ? NC.isJob(p, j) : false));
  const tone = (p) => (isJob(p, 'assassin') ? CRIM : isJob(p, 'shinobi') ? STEEL : VIOL);
  const VENOM = new Set(['envenom', 'venomdust', 'as_knives', 'as_splasher', 'as_edp', 'as_venom']);
  const BIGCUT = new Set(['sonic', 'as_deathmark']);
  const zoom = (x, y, k, d) => { if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(x, y, k, d); };
  let RG = null, loaded = false;
  const ensure = () => {
    if (loaded) return;
    loaded = true;
    LK.addPieces(MANR);
    // (the poison vial: the painted flask of the new main lines, assets/obtvfx, instead of the code-drawn bottle)
    const F = NC.ASSET_MANIFEST_OBTVFX && NC.ASSET_MANIFEST_OBTVFX.hd_flask_g;
    if (F) LK.addPieces({ rg_flask: { src: F.src, v: F.src, w: F.w, h: F.h } });
    // (the assassin's deep red: painted frame animations drawn as painted + the berserker's blood ink under its light)
    if (NC.ASSET_MANIFEST_ASSASSINFRAMES) IL.addFrames(NC.ASSET_MANIFEST_ASSASSINFRAMES);
    const B = NC.ASSET_MANIFEST_BERSERKLIGHT, ink = {};
    if (B) for (const n of ['bk_vcres', 'bk_vcrater', 'bk_vsmoke', 'bk_vdust']) if (B[n]) ink[n] = B[n];
    LK.addPieces(ink);
  };
  // a deep-red painted animation of the assassin (js/inklight.js IL.frames), when it is in
  const asf = (n, x, y, o) => (IL.framesReady && IL.framesReady(n) ? IL.frames(n, x, y, o) : null);
  const bloodInk = () => has('bk_vcres');
  const colOf = (S) => (VENOM.has(S.tag) ? GREEN : tone(S.p || (RG && RG.me())));

  // =====================================================================================================
  // looks
  // =====================================================================================================
  // a slash on an arc (V.slash: round (x, y), radius r, from ang over sweep) -> the line's cut of light there, on ink
  function slashLook(p, S) {
    const owner = S.p || RG.me(), t = S.tag || '', sweep = p.sweep || 2, dir = p.dir || 1, r = p.r || 90;
    const m = (p.ang || 0) + (sweep / 2) * dir, big = (p.thick || 20) >= 40;
    const x = p.x + Math.cos(m) * r * 0.5, y = p.y + Math.sin(m) * r * 0.5, venom = VENOM.has(t);
    const asn = isJob(owner, 'assassin') || t === 'ro_backstab';
    const n = big ? 'slash_big' : venom ? 'rg_fang' : asn ? 'rg_claw' : 'rg_shadow';
    const col = big ? (p.rgb && p.rgb.startsWith('255') ? CRIM : VIOL) : venom ? GREEN : asn ? CRIM : tone(owner);
    // (the fang / claw pieces lie diagonal: their length along the cut's tangent)
    const tang = m + PI / 2, rot = n === 'rg_fang' ? tang + 0.75 : n === 'rg_claw' ? tang - 0.8 : m + PI / 2 + 0.45 * dir;
    const len = r * (big ? 2.2 : 1.9);
    const deep = asn && !venom && bloodInk();   // (the assassin: deep red paintings carry the cut, the light only edges it)
    IL.dark({ n: deep ? 'bk_vcres' : 'rg_vslash', x, y: y + 6, rot, flipY: dir < 0, len: len * 1.1, life: (p.life || 0.3) * 1.5, a: big ? 0.6 : deep ? 0.55 : 0.4, grow: pop(0.8, 1.05, 0.3), fade: out(1.6) });
    if (deep && !big) {
      if (t === 'as_twin') asf('asf_cross', x, y, { size: r * 2.4, rot: rand(-0.3, 0.3), grow: [0.85, 1.1] });
      else asf('asf_claw', x, y, { size: r * 2.5, rot: tang - 0.8, flipX: dir < 0, grow: [0.85, 1.1] });
    }
    const deepBig = big && asn && bloodInk();   // (the assassin's finishers: deep red too, the light only a rim)
    LK.part({ n, x, y, rot, flipY: dir < 0 && n !== 'rg_fang' && n !== 'rg_claw', len, life: p.life || 0.28, a: deep || deepBig ? 0.65 : 1, col: n === 'slash_big' ? (deepBig ? '#c0102a' : col) : null, white: deep || deepBig ? 0.12 : 0.5, g: deep || deepBig ? 0.45 : 0.8,
      grow: pop(0.72, 1.06, 0.3), fade: out(1.5) });
    if (venom) LK.part({ n: 'rg_splash', x: x + Math.cos(m) * 20, y: y + 10, len: r * 0.9, life: 0.4, a: 0.9, col: null, white: 0.3, g: 0.7, grow: pop(0.5, 1.05, 0.3), fade: out(1.3) });
    if (t === 'ro_backstab') LK.part({ n: 'rg_spray', x: x + Math.cos(p.ang || 0) * 60, y, rot: p.ang || 0, len: 170, life: 0.4, a: 1, col: null, white: 0.3, g: 0.7, grow: pop(0.5, 1.05, 0.25), fade: out(1.3) });
    if (t === 'as_meteor' && !S.rgMet) {   // (the shadow meteor: one dive of violet light onto him, a ring of blades bursting, ink)
      S.rgMet = true;
      const cx = p.x, cy = p.y;
      LK.part({ n: 'rg_meteor', x: cx - 60, y: cy - 150, vx: 900, vy: 1500, drag: 6, rot: 0.25, len: 300, life: 0.22, a: 1, col: null, white: 0.4, g: 0.7, fade: out(1.2) });
      asf('asf_meteor', cx, cy - 150, { size: 560, grow: [0.9, 1.1] });   // (its ground ring sits 0.28 of the cell below the middle: at his feet)
      LK.part({ n: 'rg_ring', x: cx, y: cy, rot: rand(0, TAU), spin: 10, len: 320, life: 0.45, a: 0.8, col: CRIM, white: 0.15, g: 0.6, grow: pop(0.4, 1.15, 0.35), fade: out(1.3) });
      IL.puffs(cx, cy + 40, 6, 170, 1.2);
      IL.dark({ n: 'rg_vsplat', x: cx, y: cy + 60, rot: rand(0, TAU), len: 420, life: 1.1, a: 0.5, ground: true, layer: 'low', grow: pop(0.5, 1, 0.15), fade: inOut(0.05, 0.6) });
      zoom(cx, cy, 0.04, 0.22);
    }
    if (big && BIGCUT.has(t) && !S.rgFin) {   // (the flurry's last blow: a cross, the ring of blades bursting, blood light, ink)
      S.rgFin = true;
      const cx = p.x, cy = p.y;
      if (t === 'as_deathmark') { asf('asf_cross', cx, cy, { size: 460, rot: rand(-0.2, 0.2), grow: [0.9, 1.15] }); asf('asf_blood', cx, cy, { size: 400, grow: [0.8, 1.2] }); }
      const asnFin = t === 'as_deathmark';
      LK.part({ n: 'rg_ring', x: cx, y: cy, rot: rand(0, TAU), spin: 9, len: 300, life: 0.45, a: asnFin ? 0.7 : 1, col: asnFin ? '#c0102a' : null, white: asnFin ? 0.1 : 0.4, g: asnFin ? 0.5 : 0.8, grow: pop(0.4, 1.15, 0.35), fade: out(1.3) });
      LK.part({ n: 'rg_spray', x: cx + 80, y: cy, rot: 0.1, len: 220, life: 0.45, a: 1, col: null, white: 0.3, g: 0.7, grow: pop(0.5, 1.05, 0.25), fade: out(1.3) });
      LK.part({ n: 'rg_spray', x: cx - 80, y: cy, rot: PI - 0.1, len: 200, life: 0.45, a: 1, col: null, white: 0.3, g: 0.7, grow: pop(0.5, 1.05, 0.25), fade: out(1.3) });
      IL.puffs(cx, cy + 50, 5, 140, 1.2);
      IL.dark({ n: 'rg_vsplat', x: cx, y: cy + 70, rot: rand(0, TAU), len: 360, life: 1.2, a: 0.55, ground: true, layer: 'low', grow: pop(0.5, 1, 0.15), fade: inOut(0.05, 0.6) });
      zoom(cx, cy, 0.05, 0.24);
    }
    return null;
  }
  // a cut line (from x y to x1 y1): a stab of light along it; a dash's line: the dash streak on an ink smear
  function lineLook(p, S) {
    const x0 = p.x, y0 = p.y, x1 = p.x1, y1 = p.y1, D = Math.hypot(x1 - x0, y1 - y0);
    if (D < 6) return null;
    const ang = Math.atan2(y1 - y0, x1 - x0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, t = S.tag || '', owner = S.p || RG.me();
    if (BIGCUT.has(t)) {   // (a cut through the target in a flurry)
      const col = t === 'sonic' ? CRIM : CRIM;
      LK.part({ n: 'rg_stab', x: cx, y: cy, rot: ang, len: D * 1.15, wid: 40, life: p.life || 0.25, a: 1, col, white: 0.55, g: 0.8, grow: (u) => (u < 0.2 ? 0.4 + 3 * u : 1), fade: out(1.4) });
      LK.part({ n: 'rg_fang', x: cx, y: cy, rot: ang + 0.75, len: 120, life: 0.22, a: 0.9, col: null, white: 0.4, g: 0.6, fade: out(1.3) });
      if (t === 'as_deathmark') asf('asf_claw', cx, cy, { size: Math.min(320, D * 1.1), rot: ang - 0.8, grow: [0.85, 1.05], speed: 1.3 });
      return null;
    }
    const dash = t === 'sh_windblade' ? 'wind' : 'shadow';
    IL.dark({ n: 'rg_vsmear', x: cx, y: cy + 8, rot: ang, len: D * 1.1, wid: 64, life: 0.5, a: 0.45, fade: out(1.3) });
    LK.part({ n: 'rg_dash', x: cx, y: cy, rot: ang, len: D * 1.05, wid: 70, life: 0.32, a: 0.9, col: dash === 'wind' ? WIND : tone(owner), white: 0.35, g: 0.6, fade: out(1.3) });
    LK.part({ n: 'rg_stab', x: cx, y: cy, rot: ang, len: D * 1.1, wid: 26, life: 0.2, a: 0.9, col: '#ffffff', white: 0.5, g: 0.5, fade: out(1.2) });
    if (dash === 'wind') for (let i = 0; i < 3; i++) { const k = (i + 1) / 4; LK.part({ n: 'ng_wind', x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, rot: ang, len: 110, life: 0.35, a: 0.85, col: null, white: 0.3, g: 0.7, vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300, drag: 4, grow: pop(0.5, 1.05, 0.3), fade: out(1.2) }); }
    else for (const [x, y] of [[x0, y0 + 60], [x1, y1 + 60]]) IL.dark({ n: 'rg_vsplat', x, y, rot: rand(0, TAU), len: 170, life: 0.9, a: 0.45, ground: true, layer: 'low', grow: pop(0.5, 1, 0.15), fade: inOut(0.05, 0.6) });
    return null;
  }
  // a cast / mark circle on the ground: the death mark (crimson) or the lightning seal
  function circleLook(p, S) {
    const t = S.tag || '';
    const n = t === 'sh_raiton' ? 'ng_seal' : BIGCUT.has(t) ? 'rg_mark' : null;
    if (!n || !has(n)) return undefined;
    const R = (p.r || 140) * 1.05, life = p.life || 1, rot0 = rand(0, TAU), spin = n === 'ng_seal' ? 1.4 : 1.1, col = n === 'ng_seal' ? null : CRIM;
    LK.nightLight(p.x, p.y, R * 1.5, n === 'ng_seal' ? BOLT : CRIM, 0.6, life);
    LK.add({ x: p.x, y: p.y, life, layer: 'low', draw(c, q, u, glow) {
      const a = inOut(0.12, 0.35)(u), g = pop(0.5, 1, 0.25)(u);
      LK.piece(c, 'ground_glow', q.x, q.y, 0, R * 2.6 * g, R * 2.6 * g * asp('ground_glow'), a * 0.3, n === 'ng_seal' ? BOLT : CRIM, 0, { glow, ground: true, g: 0.3 });
      LK.piece(c, n, q.x, q.y, rot0 + q.t * spin, R * 2 * g, R * 2 * g, a, col, 0.3, { glow, ground: true, g: 0.5 });
    } });
    return null;
  }
  // the death mark over a target (V.mark) -> the painted mark upright, spinning in
  function markLook(p, S) {
    const hero = S && S.p;
    if (hero && IL.framesReady && IL.framesReady('asf_mark')) {
      const t0 = NC.game ? NC.game.time : 0;
      asf('asf_mark', p.x, p.y - 80, { size: 230, hold: [2, 3, () => !!hero.channel || (NC.game && NC.game.time - t0 < 0.4)], grow: [0.8, 1.05], layer: 'glow' });
      LK.part({ n: 'soft', x: p.x, y: p.y - 80, len: 260, life: 1.4, a: 0.35, col: CRIM, white: 0, g: 0.4, fade: inOut(0.1, 0.4) });
      return null;
    }
    if (!has('rg_mark')) return undefined;
    const life = p.life || 0.4;
    LK.add({ x: p.x, y: p.y, life: Math.max(0.6, life), draw(c, q, u, glow) {
      const g = pop(1.8, 1, 0.3)(u), a = inOut(0.1, 0.4)(u);
      LK.piece(c, 'rg_mark', q.x, q.y - 70, (1 - Math.min(1, u / 0.3)) * 2, 150 * g, 150 * g, a, CRIM, 0.4, { glow, g: 0.7 });
    } });
    return null;
  }
  // smoke: ink (smoke bombs dark violet, poison dark green); a pale puff (the substitute's log) stays light dust
  function smokeLook(p) {
    const f = (p.fill || '').toLowerCase(), r = parseInt(f.slice(1, 3), 16), gg = parseInt(f.slice(3, 5), 16), b = parseInt(f.slice(5, 7), 16);
    if (!(r >= 0)) return undefined;
    const lum = (r + gg + b) / 3, green = gg > r + 30 && gg > b + 30;
    if (lum > 200) { LK.dust(p); return undefined; }
    const n = green ? 'rg_vpoison' : 'rg_vbomb';
    if (!has(n)) return undefined;
    p.type = 'inkdark'; p.n = n; p.len = ((p.r1 || 36) + (p.r0 || 16)) * (green ? 2.4 : 2.1); p.rot = rand(0, TAU); p.spin = rand(-1, 1);
    p.a = (p.a || 1) * (green ? 0.5 : lum > 110 ? 0.5 : 0.62);
    p.grow = (u) => 0.55 + 0.6 * u; p.fade = inOut(0.12, 0.6);
    if (green && Math.random() < 0.5) LK.part({ n: 'mote', x: p.x + rand(-20, 20), y: p.y, vx: rand(-10, 10), vy: -rand(60, 110), len: rand(8, 13), life: rand(0.6, 1), a: 0.8, col: GREEN, white: 0.4, g: 0.7, fade: inOut(0.2, 0.6) });
    return undefined;   // (added as a dark piece with the smoke's own flight)
  }
  // the thrown things, by the skill that threw them
  function projLook(p, S) {
    const t = S.tag || '', hero = S.p || RG.me();
    const swapDraw = (draw) => { p.type = 'lk'; p.layer = 'glow'; p.draw = draw; };
    const ang = (q) => Math.atan2(q.vy || 0, q.vx || 0);
    if (t === 'as_knives' && has('rg_dagger')) {
      swapDraw((c, q, u, glow) => {
        const a = ang(q);
        LK.piece(c, 'rg_dash', q.x - Math.cos(a) * 40, q.y - Math.sin(a) * 40, a, 110, 30, 0.6, GREEN, 0.2, { glow, g: 0.5 });
        LK.piece(c, 'rg_dagger', q.x, q.y, a, 70, 70 * asp('rg_dagger'), 1, null, 0.4, { glow, g: 0.7 });
      });
      return undefined;
    }
    if (t === 'sh_kunai' && has('ng_kunai')) {
      const stuck = (p.life || 0) <= 0.55 && !p.vx;   // (the kunai stuck in a monster before it bursts)
      swapDraw((c, q, u, glow) => {
        const a = stuck ? -0.6 : ang(q);
        if (!stuck) LK.piece(c, 'rg_dash', q.x - Math.cos(a) * 50, q.y - Math.sin(a) * 50, a, 130, 34, 0.7, FIRE, 0.2, { glow, g: 0.6 });
        LK.piece(c, 'ng_fire', q.x - Math.cos(a) * 18, q.y - Math.sin(a) * 18, q.t * 9, stuck ? 46 + 20 * u : 34, stuck ? 46 + 20 * u : 34, 0.8, null, 0.2, { glow, g: 0.6 });
        LK.piece(c, 'ng_kunai', q.x, q.y, a, 104, 104 * asp('ng_kunai'), 1, null, 0.45, { glow, g: 0.7 });
      });
      return undefined;
    }
    if (t === 'sh_katon' && has('ng_fire')) {
      swapDraw((c, q, u, glow) => {
        const a = ang(q);
        LK.piece(c, 'rg_dash', q.x - Math.cos(a) * 46, q.y - Math.sin(a) * 46, a, 120, 40, 0.75, FIRE, 0.2, { glow, g: 0.6 });
        LK.piece(c, 'ng_fire', q.x, q.y, q.t * 14, 92, 92, 1, null, 0.3, { glow, g: 0.7 });
      });
      return undefined;
    }
    if (t === 'sh_clone' && has('ng_star')) {
      swapDraw((c, q, u, glow) => {
        const a = ang(q);
        LK.piece(c, 'rg_dash', q.x - Math.cos(a) * 36, q.y - Math.sin(a) * 36, a, 90, 26, 0.6, STEEL, 0.2, { glow, g: 0.5 });
        LK.piece(c, 'ng_star', q.x, q.y, q.t * 22, 62, 62, 1, null, 0.45, { glow, g: 0.7 });
      });
      return undefined;
    }
    if (t === 'sh_shuriken' && has('ng_star')) {
      swapDraw((c, q, u, glow) => {
        const R = q.R || 60, n = 10;
        for (let i = 0; i < n; i++) {
          const a = q.t * 7 + (i / n) * TAU, x = hero.x + Math.cos(a) * R, y = hero.y - 50 + Math.sin(a) * R * 0.55;
          for (let j = 2; j >= 1; j--) { const b = a - j * 0.12; LK.piece(c, 'ng_star', hero.x + Math.cos(b) * R, hero.y - 50 + Math.sin(b) * R * 0.55, q.t * 30 + i, 34, 34, 0.22 / j, STEEL, 0, { glow, g: 0.4 }); }
          LK.piece(c, 'ng_star', x, y, q.t * 30 + i, 66, 66, 1, null, 0.45, { glow, g: 0.7 });
        }
        LK.piece(c, 'ground_glow', hero.x, hero.y, 0, R * 2.8, R * 2.8 * asp('ground_glow'), 0.25, STEEL, 0, { glow, ground: true, g: 0.3 });
      });
      return undefined;
    }
    if (t === 'venomdust' && has('rg_flask')) {   // (the thrown vial: the painted flask turning, a green glow, a trail of drops)
      swapDraw((c, q, u, glow) => {
        LK.piece(c, 'soft', q.x, q.y, 0, 90, 90 * asp('soft'), 0.5, GREEN, 0, { glow, g: 0.5 });
        if (!glow) { c.save(); c.globalCompositeOperation = 'source-over'; LK.piece(c, 'rg_flask', q.x, q.y, q.t * 14, 46, 46 * asp('rg_flask'), 1, null, 0, {}); c.restore(); }
      });
      const u0 = p.update;
      p.update = function (q) { const r = u0 ? u0.apply(this, arguments) : undefined; if (Math.random() < 0.5) LK.part({ n: 'drop', x: q.x, y: q.y, vx: 0, vy: 60, len: 10, life: 0.3, a: 0.8, col: GREEN, white: 0.4, g: 0.6 }); return r; };
      return undefined;
    }
    if (t === 'as_splasher' && has('rg_bubbles')) {   // (the target marked for the venom burst: bubbles and a green mark over it, no skull)
      swapDraw((c, q, u, glow) => {
        const k = 0.8 + 0.15 * Math.sin(q.t * 12);
        LK.piece(c, 'soft', q.x, q.y - 60, 0, 120 * k, 120 * k * asp('soft'), 0.45, GREEN, 0, { glow, g: 0.5 });
        LK.piece(c, 'rg_mark', q.x, q.y - 150, q.t * 1.5, 70, 70, 0.9, GREEN, 0.3, { glow, g: 0.6 });
        LK.piece(c, 'rg_bubbles', q.x, q.y - 80 - (q.t * 30) % 30, 0, 80, 80 * asp('rg_bubbles'), 0.6, null, 0.2, { glow, g: 0.5 });
      });
      return undefined;
    }
    return undefined;
  }

  // =====================================================================================================
  // the skin
  // =====================================================================================================
  const MAP = LK.holyMap((kind, p, S) => {
    if (kind === 'slash') return slashLook(p, S);
    if (kind === 'line') return lineLook(p, S);
    if (kind === 'circle') return circleLook(p, S);
    // a buff's standing columns (holy pillars by default): a faint thin light in the job's colour
    if (kind === 'beam' && (S.tag === 'cast' || S.tag === 'tick' || (p.a !== undefined && p.a < 0.7) || p.life > 1.5 || !/^(sh_raiton)$/.test(S.tag || ''))) {
      LK.pillar(p.x, p.y, { w: (p.w || 60) * 0.35, h: p.h || 300, life: p.life || 0.5, col: colOf(S), a: 0.28, drop: false });
      return null;
    }
    // the big glows and flares of a burst (K.burst): softer, so a crowd's hits don't burn white
    if (kind === 'glow') { LK.glow(p.x, p.y, { r0: p.r0, r1: (p.r1 || 120) * 0.8, life: p.life, col: colOf(S), a: Math.min(0.45, (p.a || 0.6) * 0.3), follow: p.follow }); return null; }
    if (kind === 'flare') { LK.flare(p.x, p.y, { r: (p.r || 80) * 0.6, life: p.life, col: colOf(S) }); return null; }
    // rings: flat on the ground (an upright one read as a dome over the target)
    if (kind === 'ring' || kind === 'fxring') { LK.ring(p.x, p.y, { r0: p.r0, r1: (p.r1 || 150) * 0.85, life: p.life, col: colOf(S), a: 0.7, follow: p.follow }); return null; }
    if (kind === 'decal' && p.kind === 'goo') {   // (the poison's pool: green light on the ground, an ink splat)
      const life = Math.min(5.5, p.life || 4), R0 = (p.r || 150);
      LK.add({ x: p.x, y: p.y, life, layer: 'low', draw(c, q, u, glow) { LK.piece(c, 'ground_glow', q.x, q.y, 0, R0 * 2.6, R0 * 2.6 * asp('ground_glow'), 0.4 * inOut(0.05, 0.3)(u), GREEN, 0, { glow, ground: true, g: 0.3 }); } });
      LK.nightLight(p.x, p.y, R0 * 2, GREEN, 0.5, life);
      IL.dark({ n: 'rg_vsplat', x: p.x, y: p.y, rot: rand(0, TAU), len: (p.r || 150) * 2.2, life: Math.min(5.5, p.life || 4), a: 0.35, ground: true, layer: 'low', fade: inOut(0.05, 0.3) });
      LK.part({ n: 'rg_splash', x: p.x, y: p.y - 40, len: 220, life: 0.5, a: 1, col: null, white: 0.3, g: 0.7, grow: pop(0.4, 1.05, 0.3), fade: out(1.3) });
      return null;
    }
    return undefined;
  });
  MAP.vmark = markLook;
  MAP.vsmoke = smokeLook;
  MAP.vproj = projLook;
  MAP.vdrop = (p) => LK.asPart(p, 'drop', (p.s || 6) * 3, GREEN, { white: 0.45, g: 0.7, fade: out(1.1) });
  MAP.vskull = (p) => { LK.asPart(p, 'rg_bubbles', (p.s || 40) * 1.4, null, { a: 0.75, white: 0.25, g: 0.6, fade: inOut(0.2, 0.5) }); p.grow = pop(0.5, 1, 0.3); };
  MAP.vbubble = (p) => LK.asPart(p, 'rg_bubbles', (p.s || 8) * 4, null, { a: 0.8, white: 0.25, g: 0.6, fade: inOut(0.15, 0.5) });
  // the grim tooth's spikes from the ground -> claws of light rising, ink at their feet
  MAP.vspike = (p, S) => {
    if (!has('rg_claw')) return undefined;
    const h = p.h || 80, col = tone(S.p || RG.me());
    if (isJob(S.p || RG.me(), 'assassin') && asf('asf_fang', p.x, p.y - h * 0.99, { size: h * 2.6, grow: [0.85, 1.05], layer: 'high' })) {   // (the fangs' foot sits 0.38 of the cell below its middle)
      LK.part({ n: 'glint', x: p.x, y: p.y - h * 0.8, len: 40, life: 0.25, a: 0.8, col: CRIM, white: 0.3, g: 0.6, fade: out(1.2) });
      return null;
    }
    LK.part({ n: 'rg_claw', x: p.x, y: p.y - h * 0.55, rot: 0.77 + (p.tilt || 0) * 0.5, len: h * 1.6, life: p.life || 0.6, a: 1, col, white: 0.5, g: 0.7,
      grow: (u) => (u < 0.15 ? 0.3 + 0.7 * (u / 0.15) : 1), fade: inOut(0.05, 0.45) });
    IL.dark({ n: 'rg_vsplat', x: p.x, y: p.y, rot: rand(0, TAU), len: h * 1.3, life: (p.life || 0.6) * 1.4, a: 0.45, ground: true, layer: 'low', fade: inOut(0.05, 0.5) });
    return null;
  };
  // afterimages: half of them, in the job's colour
  MAP.hero = (p, S) => {
    S.rgGh = (S.rgGh || 0) + 1;
    if (S.rgGh % 2 === 0) return null;
    p.color = tone(S.p || RG.me());
    return undefined;
  };
  IL.stars(MAP, [STEEL, VIOL]);
  // the thrown kunai's / katon's flame trail: fire light
  const flame0 = MAP.vflame;
  MAP.vflame = (p, S) => {
    if (S.tag === 'sh_kunai' || S.tag === 'sh_katon') { LK.asPart(p, 'mote', (p.w || 20) * 1.3, FIRE, { white: 0.4, g: 0.7, fade: inOut(0.1, 0.6) }); if (!p.vy) p.vy = -50; return; }
    return flame0 ? flame0(p, S) : undefined;
  };

  // a plain hit with a dagger / katar: the job's cut of light across the monster on an ink smear (a crit: crimson claws +
  // blood light)
  function plainHit(e, r, h) {
    const P = h.P, k = h.k * (h.big ? 1.2 : 1), asn = isJob(P, 'assassin'), ninja = isJob(P, 'shinobi');
    if (asn && IL.framesReady && IL.framesReady('asf_claw')) {
      asf('asf_claw', h.x, h.y, { size: 210 * k, rot: rand(-0.25, 0.15), flipX: h.dir < 0, grow: [0.85, 1.08], speed: 1.25 });
      if (bloodInk()) IL.dark({ n: 'bk_vcres', x: h.x, y: h.y + 6, rot: h.dir > 0 ? 0.5 : PI - 0.5, flipY: h.dir < 0, len: 170 * k, life: 0.3, a: 0.45, fade: out(1.6) });
      LK.burst(h.x, h.y, { k: k * 0.4, col: CRIM, n: r.crit ? 9 : 5, dir: h.dir, spark: 2, flash: false });
      if (r.crit) { asf('asf_blood', h.x, h.y, { size: 260 * k, grow: [0.8, 1.15] }); asf('asf_cross', h.x, h.y, { size: 240 * k, rot: rand(-0.2, 0.2), grow: [0.9, 1.1] }); }
      return;
    }
    const n = asn ? 'rg_claw' : ninja ? 'rg_shadow' : Math.random() < 0.5 ? 'rg_fang' : 'rg_shadow';
    const rot = n === 'rg_fang' ? (h.dir > 0 ? -0.1 : 0.1) : n === 'rg_claw' ? 0 : rand(-0.2, 0.15);
    IL.cut(h.x, h.y, 150 * k, h.dir, { n, col: n === 'rg_shadow' ? null : null, rot, life: 0.22, inkA: 0.34, ink: 'rg_vslash', inkK: 1.05 });
    LK.burst(h.x, h.y, { k: k * 0.5, col: r.crit ? CRIM : tone(P), n: r.crit ? 11 : 6, dir: h.dir, spark: 3, flash: false });
    if (r.crit) {
      LK.part({ n: 'rg_claw', x: h.x + h.dir * 6, y: h.y, rot: h.dir > 0 ? 0.2 : -0.2, flipY: h.dir < 0, len: 190 * k, life: 0.3, a: 1, col: null, white: 0.4, g: 0.8, grow: pop(0.5, 1.08, 0.2), fade: out(1.3) });
      LK.part({ n: 'rg_spray', x: h.x + h.dir * 70, y: h.y, rot: h.dir > 0 ? 0 : PI, len: 150 * k, life: 0.35, a: 1, col: null, white: 0.3, g: 0.6, grow: pop(0.5, 1.05, 0.25), fade: out(1.3) });
    }
  }

  const hitFeel = IL.hitFeel([VIOL, CRIM]);
  RG = LK.lineSkin({
    name: 'RogueLight', param: 'roguelight', jobs: ['rogue', 'assassin', 'shinobi', 'eclipse', 'shadowlord'], root: 'rogue',
    exclude: ['reaper', 'puppeteer'], swingRing: true,
    ready: ['rg_fang', 'rg_claw', 'rg_shadow', 'rg_stab', 'rg_vslash', 'rg_vbomb', 'ring', 'glint', 'orb', 'soft', 'core', 'spike_mid', 'spike_long', 'shard', 'drop'],
    map: MAP,
    plainHit,
    add: (p, L, base) => {
      if (p.type === 'hero' && p.color === '#9dff8f') p.color = tone(L.me());   // (a dash's afterimages, added by the hero's own update)
      return hitFeel(p, L, base);
    },
  });
  IL.flashes((S) => S.map === MAP);
  NC.skillTicks.push((game, p) => { if (RG.fam(p)) ensure(); });
  for (const id of RG.ids) {   // (another hero's skill online: its look loads the pieces too)
    const f = NC.SKILL_RUN[id];
    if (f && !f.rgEnsure) { const g = function () { ensure(); return f.apply(this, arguments); }; g.rgEnsure = true; g.lkSkin = f.lkSkin; g._orig = f._orig || f; NC.SKILL_RUN[id] = g; }
  }
})();
