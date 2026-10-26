/* berserklight.js — the BERSERKER's skills made of light on ink, the reaper's recipe (2026-10-20, the user: "ทำ vfx โจรใหม่ด้วย
   สูตรเดียวกับเคียวเลย เบอเซิกเกอร์ด้วย พวกสายตีทั้งหลาย"), on js/lightkit.js (LK.lineSkin) + js/inklight.js. Jobs: เบอร์เซิร์กเกอร์
   and จอมคลั่งจันทร์เลือด (taken out of js/knightlight.js). Every skill keeps its own code and numbers; only the drawing
   changes, in rage light (white-hot -> orange-red -> blood crimson) on blood-dark ink. The painted pieces (assets/berserklight,
   Codex: assets/gen/make_berserklight_prompts.py -> tools/berserklight_cut.py): a great cross cut, a rage crescent, a
   whirlwind ring, the guillotine, crater cracks, rage flames, a roar wave, the blood moon, a spark spray, a spinning axe,
   jagged rips, an impact star; ink: a dust blast, rubble, an ink crescent, a crater splat, rage smoke, an ink ring.
     ฟันกากบาท      rage crescents on ink, the first cut a great cross; Lv 5's third cut falls straight down
     ดาบพายุหมุน     the whirlwind ring turning flat round him on an ink ring, sparks flung off, dust with every hit beat
     ฟันประหาร       the guillotine of light falling onto the target, crater cracks, a dust blast, rubble, a camera punch
     ทุบสะสมพลัง / กระโดดทุบธรณี   rage motes gathering; the ground smashed: crater cracks of red-hot light on a dark crater,
                    an impact star, a dust blast, rubble flying
     ขว้างอาวุธ      the thrown weapon inside a spinning disc of light, an ink trail
     พิโรธไททัน / คำรามศึก / คำรามท้ารบ   rage flames and rage smoke rising round him, roar waves (out / in)
     a plain hit     a rage crescent across the monster on ink + a spark spray; a crit: jagged rips + an impact star
   HEAVY (2026-10-21, the user: "ทำสกิล berserk ต่อให้มันดูดุดัน หนักเเน่น ระเบิดตู้มต้ามอารมฟาดใหญ่"): painted FRAME animations drawn as
   painted under the light (assets/berserkframes, make_berserkframes_prompts.py -> tools/berserkframes_cut.py, played smoothly by
   IL.frames): a ground-smash explosion and a quake ring standing on the ground, a heavy cleave smear, a giant X, the guillotine
   slamming down, a rage eruption round him; painted rock chunks flung up that fall and bounce; the screen shaken and punched.
   Switch: ESC → ตั้งค่า "เบอร์เซิร์กเกอร์" (js/hitstyle.js row 'berserk', NC.BerserkLight.on).
   Load after js/jobs3_berserker.js, js/class3_skills_a.js, js/lightkit.js, js/inklight.js; before js/hitstyle.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, LK = NC.LightKit, IL = NC.InkLight, K = NC.SkillKit;
  if (!FX || !V || !LK || !LK.lineSkin || !LK.addPieces || !IL || !K) return;
  const MANB = NC.ASSET_MANIFEST_BERSERKLIGHT || {};
  const rand = NC.rand, PI = Math.PI, TAU = PI * 2, SQ = V.SQ || 0.58;
  const out = LK.out, inOut = LK.inOut, asp = (n) => LK.aspect(n), pop = IL.pop, has = IL.has;
  const RAGE = '#ff5a3c', BLOOD = '#ff2a48', HOT = '#ff9a4a';
  const zoom = (x, y, k, d) => { if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(x, y, k, d); };
  let BK = null, loaded = false, BK_heavy = null;
  const ensure = () => {
    if (loaded) return;
    loaded = true;
    LK.addPieces(MANB);
    const F = NC.ASSET_MANIFEST_BERSERKFRAMES;
    if (F) {
      const anims = {}, rocks = {};
      for (const n in F) if (F[n].frames) anims[n] = F[n];
      ((F.rocks && F.rocks.pieces) || []).forEach((r, i) => { rocks['bkr_' + i] = { src: r.src, v: r.src, w: r.w, h: r.h }; });
      IL.addFrames(anims);
      LK.addPieces(rocks);
    }
  };

  // ---------------- the heavy layer: painted blasts, rock chunks, the screen shaken ----------------
  const BKF = () => NC.ASSET_MANIFEST_BERSERKFRAMES || {};
  const fr = (n, x, y, o) => (IL.framesReady && IL.framesReady(n) ? IL.frames(n, x, y, o) : null);
  // a painted blast standing on the ground at (x, y): its painted ground line put at y
  // (the rings - the quake, the rage eruption - stand round him: their ring's middle at his feet, not its front edge)
  const RING_MID = { bkf_quake: 0.17, bkf_rage: 0.3, bkf_smash: 0.39 };
  const onGround = (n, x, y, size, o) => fr(n, x, y - (RING_MID[n] || (BKF()[n] && BKF()[n].ground) || 0.2) * size, Object.assign({ size }, o || {}));
  const shake = (k) => { const G = NC.game; if (G && V.shake) V.shake(G, k); };
  // painted rock chunks flung up from (x, y), falling, bouncing once on the ground
  function rocks(x, y, n, k) {
    for (let i = 0; i < n; i++) {
      const name = 'bkr_' + ((Math.random() * 8) | 0);
      if (!has(name)) continue;
      const a = rand(-PI * 0.88, -PI * 0.12), sp = rand(420, 900) * k, gy = y + rand(-12, 24);
      IL.dark({ n: name, x: x + rand(-24, 24), y: y - 24, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 1900, drag: 0.4, rot: rand(0, TAU), spin: rand(-10, 10),
        len: rand(26, 58) * Math.min(1.4, k), life: rand(0.9, 1.3), a: 1, fade: inOut(0.01, 0.22), layer: 'high',
        update(q) { if (!q.bounced && q.vy > 0 && q.y > gy) { q.y = gy; q.vy *= -0.3; q.vx *= 0.45; q.spin *= 0.35; q.bounced = 1; } } });
    }
  }
  // BOOM: the ground blown open at (x, y): the painted smash + the quake ring on the ground, rocks, the light crater, the screen hit
  function boom(x, y, size, o) {
    o = o || {};
    onGround('bkf_smash', x, y, size, { grow: [0.92, 1.06] });
    if (o.quake !== false) onGround('bkf_quake', x, y, size * 1.2, { grow: [0.85, 1.1], layer: 'low' });
    rocks(x, y, o.rocks === undefined ? 6 : o.rocks, size / 480);
    smash(x, y, size * 0.28, { rubble: 0, wave: false, zoom: 0.001 });
    shake(o.shake || 12);
    zoom(x, y - 60, o.zoom || 0.07, 0.3);
    if (o.dim) IL.dim(0.4, 0.26);
  }
  BK_heavy = { boom, rocks, onGround, fr };

  // =====================================================================================================
  // looks
  // =====================================================================================================
  function crescent(x, y, rot, len, dir, o) {
    o = o || {};
    IL.dark({ n: 'bk_vcres', x, y: y + 8, rot, flipY: dir < 0, len: len * 1.12, life: (o.life || 0.28) * 1.6, a: o.inkA || 0.5, grow: pop(0.8, 1.05, 0.3), fade: out(1.6) });
    LK.part({ n: o.n || 'bk_crescent', x, y, rot, flipY: dir < 0, len, life: o.life || 0.28, a: 1, col: null, white: o.white === undefined ? 0.45 : o.white, g: 0.8,
      grow: pop(0.72, 1.06, 0.3), fade: out(1.5) });
  }
  // the ground smashed at (x, y): r its size
  function smash(x, y, r, o) {
    o = o || {};
    LK.add({ x, y, life: 1.3, layer: 'low', draw(c, q, u, glow) {
      const a = (u < 0.05 ? u / 0.05 : 1) * Math.pow(1 - u, 1.4);
      LK.piece(c, 'bk_crater', q.x, q.y, q.rot || 0, r * 2.4, r * 2.4, a, null, 0.2, { glow, ground: true, g: 0.5 });
      LK.piece(c, 'ground_glow', q.x, q.y, 0, r * 2.6, r * 2.6 * asp('ground_glow'), a * 0.35, RAGE, 0, { glow, ground: true, g: 0.3 });
    } }).rot = rand(0, TAU);
    LK.nightLight(x, y, r * 2.2, HOT, 0.7, 1.2);
    IL.dark({ n: 'bk_vcrater', x, y: y + 4, rot: rand(0, TAU), len: r * 2.5, life: 1.6, a: 0.55, ground: true, layer: 'low', grow: pop(0.5, 1, 0.12), fade: inOut(0.04, 0.5) });
    LK.part({ n: 'bk_impact', x, y: y - 30, rot: rand(0, PI), len: r * 1.6, life: 0.2, a: 1, col: null, white: 0.35, g: 0.7, grow: pop(0.5, 1.1, 0.3), fade: out(1.4) });
    for (const s of [-1, 1]) IL.dark({ n: 'bk_vdust', x: x + s * r * 0.45, y: y - 10, vx: s * 260, vy: -20, drag: 3, rot: 0, flipY: false, len: r * 1.7, life: 0.8, a: 0.55,
      grow: (u) => 0.6 + 0.6 * u, fade: inOut(0.08, 0.6) });
    for (let i = 0; i < (o.rubble || 3); i++) {
      const a = rand(-PI * 0.9, -PI * 0.1), sp = rand(400, 700);
      IL.dark({ n: 'bk_vrubble', x, y: y - 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 1500, drag: 0.5, rot: rand(0, TAU), spin: rand(-6, 6), len: r * rand(0.5, 0.8), life: 0.7, a: 0.9, fade: inOut(0.02, 0.3) });
    }
    if (o.wave !== false) LK.part({ n: 'bk_roar', x, y, rot: 0, len: r * 2.4, life: 0.45, a: 0.8, col: null, white: 0.2, g: 0.6, grow: (u) => 0.3 + 0.9 * (1 - Math.pow(1 - u, 2.2)), fade: out(1.4), ground: true });
    zoom(x, y - 40, o.zoom || 0.05, 0.26);
  }
  function rageRise(who, n, k) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), r = rand(20, 70) * k;
      LK.part({ n: 'bk_flames', x: who.x + Math.cos(a) * r, y: who.y - 10 + Math.sin(a) * r * SQ, vx: 0, vy: -rand(120, 200), drag: 1.5, len: rand(50, 80) * k, life: rand(0.5, 0.8), a: 0.85,
        col: null, white: 0.3, g: 0.7, grow: pop(0.3, 1, 0.3), fade: inOut(0.1, 0.6) });
      if (i % 2 === 0) IL.dark({ n: 'bk_vsmoke', x: who.x + Math.cos(a) * r, y: who.y - 20, vx: rand(-20, 20), vy: -rand(60, 120), drag: 1, len: rand(70, 110) * k, life: 0.9, a: 0.4, grow: (u) => 0.5 + 0.7 * u, fade: inOut(0.15, 0.6) });
    }
  }

  // a slash on an arc -> a rage crescent there (by the skill)
  function slashLook(p, S) {
    const t = S.tag || '', dir = p.dir || 1, sweep = p.sweep || 2, r = p.r || 90, m = (p.ang || 0) + (sweep / 2) * dir;
    const x = p.x + Math.cos(m) * r * 0.5, y = p.y + Math.sin(m) * r * 0.5, rot = m + PI / 2 + 0.45 * dir, big = (p.thick || 20) >= 34;
    if (t === 'bk_whirlwind') {   // (a slash every frame while spinning: the ring carries it, one crescent in four)
      S.bkW = (S.bkW || 0) + 1;
      if (big && (p.thick || 0) >= 44) {
        crescent(x, y, rot, r * 2.3, dir, { life: 0.34 });
        LK.part({ n: 'bk_impact', x: p.x, y: p.y - 40, len: 300, life: 0.2, a: 1, col: null, white: 0.3, g: 0.7, grow: pop(0.5, 1.1, 0.3), fade: out(1.4) });
        fr('bkf_cleave', x, y, { size: 560, rot: rand(-0.2, 0.2), flipX: dir < 0, grow: [0.9, 1.1] });
        boom(p.x, p.y + 30, 440, { rocks: 6, shake: 12, zoom: 0.07, quake: true });
        return null;
      }
      if (S.bkW % 4 === 1) LK.part({ n: 'bk_crescent', x, y, rot, flipY: dir < 0, len: r * 1.9, life: 0.16, a: 0.8, col: null, white: 0.3, g: 0.6, fade: out(1.4) });
      if (S.bkW % 7 === 3) {   // (a painted cleave whirling past every few frames, on alternating sides)
        const side = (S.bkW / 7) % 2 < 1 ? 1 : -1, hero = S.p || BK.me();
        if (hero) fr('bkf_cleave', hero.x + side * 90, hero.y - 50, { size: 320, rot: rand(-0.3, 0.3), flipX: side < 0, speed: 1.5, grow: [0.9, 1.05] });
      }
      if (!S.bkRing) {
        S.bkRing = true;
        const hero = S.p || BK.me();
        // (the ring ends with the spin: a stun, a death or a map change cuts the channel short, the ring must not stay behind)
        const ended = (q) => { if (q.t > 0.25 && !(hero.channel && hero.channel.dur === 2.5)) q.t = Math.max(q.t, q.life - 0.15); };
        LK.add({ x: hero.x, y: hero.y, life: 2.5, follow: hero, update: ended, draw(c, q, u, glow) {
          const a = inOut(0.06, 0.12)(u), px = hero.x, py = hero.y - 30;
          LK.piece(c, 'bk_ring', px, py, q.t * 16, 420, 420, a, null, 0.35, { glow, ground: true, g: 0.7 });
          LK.piece(c, 'bk_ring', px, py, q.t * 16 + PI * 0.9, 330, 330, a * 0.55, RAGE, 0.1, { glow, ground: true, g: 0.5 });
        } });
        IL.dark({ n: 'bk_vring', x: hero.x, y: hero.y, rot: 0, spin: 10, len: 480, life: 2.5, a: 0.45, ground: true, layer: 'low', follow: hero, fade: inOut(0.06, 0.12), update: ended });
      }
      return null;
    }
    if (t === 'bk_guillotine') return null;   // (the falling blade is the guillotine's look)
    if (t === 'bk_crosscut' && !S.bkX) {      // (the first cut: a great cross)
      S.bkX = true;
      IL.dark({ n: 'bk_vcres', x: p.x, y: p.y + 10, rot: 0.6, len: r * 2.4, life: 0.5, a: 0.5, fade: out(1.6) });
      IL.dark({ n: 'bk_vcres', x: p.x, y: p.y + 10, rot: -0.6, flipY: true, len: r * 2.4, life: 0.5, a: 0.5, fade: out(1.6) });
      const X = fr('bkf_cross', p.x, p.y, { size: r * 3.2, rot: rand(-0.15, 0.15), grow: [0.88, 1.1] });
      LK.part({ n: 'bk_cross', x: p.x, y: p.y, rot: rand(-0.15, 0.15), len: r * 2.3, life: 0.34, a: X ? 0.6 : 1, col: null, white: X ? 0.25 : 0.45, g: 0.85, grow: pop(0.5, 1.08, 0.25), fade: out(1.4) });
      LK.part({ n: 'bk_spark', x: p.x + 70, y: p.y, rot: 0.1, len: 200, life: 0.3, a: 1, col: null, white: 0.3, g: 0.6, fade: out(1.3) });
      if (X) { rocks(p.x, p.y + 60, 3, 0.8); shake(8); zoom(p.x, p.y, 0.05, 0.22); }
      return null;
    }
    if (t === 'bk_crosscut' && Math.abs(Math.sin(p.ang || 0) + 1) < 0.05) {   // (Lv 5's third cut, straight down)
      LK.part({ n: 'bk_guillo', x: p.x, y: p.y - 40, len: 90, wid: 300, life: 0.3, a: 1, col: null, white: 0.4, g: 0.8, grow: (u) => (u < 0.15 ? 0.4 + 4 * u : 1), fade: out(1.4) });
      if (onGround('bkf_guillo', p.x, p.y + 40, 380, { grow: [0.95, 1.05], speed: 1.2 })) { rocks(p.x, p.y + 40, 4, 0.8); shake(9); }
      return null;
    }
    crescent(x, y, rot, r * (big ? 2.25 : 2), dir, { life: p.life || 0.28, white: 0.3 });
    fr('bkf_cleave', x, y, { size: r * (big ? 3.3 : 2.9), rot: rand(-0.25, 0.2), flipX: dir < 0, grow: [0.9, 1.08] });
    return null;
  }
  // the guillotine's column (V.beam at the target) -> the blade of light falling onto it, the ground broken
  function beamLook(p, S) {
    if (S.tag !== 'bk_guillotine' && S.tag !== 'bm_guillotine') {
      LK.pillar(p.x, p.y, { w: (p.w || 60) * 0.5, h: p.h || 400, life: p.life || 0.4, col: RAGE, a: 0.45 });
      return null;
    }
    const x = p.x, y = p.y, painted = !!onGround('bkf_guillo', x, y, 660, { grow: [0.95, 1.05] });
    LK.add({ x, y, life: 0.5, draw(c, q, u, glow) {
      const fall = Math.min(1, q.t / 0.07), H = 520, a = (q.t < 0.07 ? 1 : Math.max(0, 1 - (q.t - 0.07) / 0.43)) * (painted ? 0.5 : 1);
      const bottom = y - 10, top = bottom - H, cy = top + (H * fall) / 2;
      LK.piece(c, 'bk_guillo', x, cy, 0, 150, H * fall, a, null, 0.45, { glow, g: 0.8 });
    } });
    V.at(0.06, () => {
      boom(x, y, 560, { rocks: 9, shake: 16, zoom: 0.09, dim: true });
      if (!fr('bkf_cross', x, y - 80, { size: 330, rot: rand(-0.2, 0.2), grow: [0.9, 1.1] }))
        LK.part({ n: 'bk_cross', x, y: y - 80, rot: rand(-0.2, 0.2), len: 240, life: 0.26, a: 0.9, col: null, white: 0.35, g: 0.7, grow: pop(0.5, 1.08, 0.25), fade: out(1.4) });
    });
    return null;
  }
  // a cast / buff circle (occult): the roar wave on the ground + rage flames and smoke rising round him
  function circleLook(p, S) {
    const hero = p.follow || S.p || BK.me();
    if (hero) {
      rageRise(hero, 8, 1.2);
      // (the fire behind him on the ground layer, a faint copy over him: in front it hid the hero whole)
      if (onGround('bkf_rage', hero.x, hero.y, 440, { follow: hero, grow: [0.85, 1.08], layer: 'low' })) {
        onGround('bkf_rage', hero.x, hero.y, 440, { follow: hero, grow: [0.85, 1.08], a: 0.28 });
        shake(10); zoom(hero.x, hero.y - 80, 0.05, 0.28);
      }
    }
    LK.part({ n: 'bk_roar', x: p.x, y: p.y, len: (p.r || 160) * 2.3, life: 0.6, a: 0.8, col: null, white: 0.2, g: 0.6, grow: (u) => 0.3 + 0.9 * (1 - Math.pow(1 - u, 2.2)), fade: out(1.3), ground: true });
    return null;
  }
  // rings: roar waves flat on the ground (out, or in for the taunt), dust at a whirlwind's beat
  function ringLook(p, S) {
    const r0 = p.r0 || 20, r1 = p.r1 || 150, inward = r1 < r0, R = Math.max(r0, r1);
    LK.part({ n: 'bk_roar', x: p.x, y: p.y, len: R * 2.2, life: p.life || 0.45, a: S.tag === 'bk_whirlwind' ? 0.35 : 0.8, col: null, white: 0.2, g: 0.6,
      grow: inward ? (u) => 1 - 0.8 * u : (u) => 0.25 + 0.85 * (1 - Math.pow(1 - u, 2.2)), fade: out(1.3), ground: true });
    if (S.tag === 'bk_whirlwind') { if (Math.random() < 0.6) IL.puffs(p.x, p.y + 10, 2, 180, 0.9, { n: ['bk_vdust'], a: 0.3, layer: 'low' }); rocks(p.x, p.y, 1, 0.6); shake(3); }
    else {
      IL.dark({ n: 'bk_vring', x: p.x, y: p.y, rot: rand(0, TAU), spin: inward ? -6 : 6, len: R * 2.4, life: (p.life || 0.45) * 1.3, a: 0.4, ground: true, layer: 'low',
        grow: inward ? (u) => 1 - 0.7 * u : (u) => 0.3 + 0.8 * u, fade: out(1.3) });
      if (R >= 200) { onGround('bkf_quake', p.x, p.y, Math.min(760, R * 1.9), { grow: inward ? [1.1, 0.8] : [0.8, 1.1], layer: 'low' }); shake(inward ? 6 : 9); }
    }
    return null;
  }

  const MAP = LK.holyMap((kind, p, S) => {
    if (kind === 'slash') return slashLook(p, S);
    if (kind === 'beam') return beamLook(p, S);
    if (kind === 'circle') return circleLook(p, S);
    if (kind === 'ring' || kind === 'fxring') return ringLook(p, S);
    if (kind === 'decal' && (p.kind === 'crack' || p.kind === 'scorch')) {
      const big = S.tag === 'bk_leap' || S.tag === 'bm_leap', size = Math.min(720, (p.r || 120) * (big ? 4 : 4.3));
      if (IL.framesReady && IL.framesReady('bkf_smash')) boom(p.x, p.y, size, { rocks: big ? 9 : 7, shake: big ? 16 : 13, zoom: big ? 0.09 : 0.07, dim: big });
      else smash(p.x, p.y, (p.r || 120) * 1.0, { rubble: 3 });
      return null;
    }
    if (kind === 'glow') { LK.glow(p.x, p.y, { r0: p.r0, r1: (p.r1 || 120) * 0.8, life: p.life, col: RAGE, a: Math.min(0.45, (p.a || 0.6) * 0.3), follow: p.follow }); return null; }
    if (kind === 'flare') { LK.flare(p.x, p.y, { r: (p.r || 80) * 0.6, life: p.life, col: HOT }); return null; }
    return undefined;
  });
  // rock debris -> the painted rubble flying (a few, not one per shard)
  MAP.vshard = (p, S) => { S.bkSh = (S.bkSh || 0) + 1; if (S.bkSh % 4 !== 1 || !has('bk_vrubble')) return null; p.type = 'inkdark'; p.n = 'bk_vrubble'; p.len = (p.s || 16) * 4; p.a = 0.9; p.fade = inOut(0.02, 0.3); return undefined; };
  MAP.vsmoke = (p) => { if (!has('bk_vdust')) return undefined; p.type = 'inkdark'; p.n = 'bk_vdust'; p.len = ((p.r1 || 36) + (p.r0 || 16)) * 2.4; p.rot = 0; p.a = 0.4; p.grow = (u) => 0.55 + 0.6 * u; p.fade = inOut(0.12, 0.6); return undefined; };
  MAP.vmote = (p) => LK.asPart(p, 'mote', (p.r || 4) * 4, Math.random() < 0.5 ? RAGE : HOT, { a: p.a || 1, g: 0.8 });
  IL.stars(MAP, [HOT, RAGE]);
  // the thrown weapon: its own picture inside a spinning disc of light, an ink trail
  MAP.vproj = (p, S) => {
    if (S.tag !== 'bk_hurl' || !has('bk_axe')) return undefined;
    const d0 = p.draw, u0 = p.update;
    let inkT = 0, px = p.x, py = p.y;
    p.update = function (q, dt) {
      const r = u0 ? u0.apply(this, arguments) : undefined;
      if ((inkT -= dt) <= 0) { inkT = 0.05; const a = Math.atan2(q.y - py, q.x - px); IL.dark({ n: 'bk_vdust', x: q.x - Math.cos(a) * 20, y: q.y + 10, rot: a, len: 90, life: 0.35, a: 0.3, fade: out(1.2) }); }
      px = q.x; py = q.y;
      return r;
    };
    p.type = 'lk'; p.layer = 'glow';
    p.draw = (c, q, u, glow) => {
      LK.piece(c, 'bk_axe', q.x, q.y + 20, q.spin || 0, 150, 150, 0.8, null, 0.3, { glow, g: 0.7 });
      if (!glow && d0) { c.save(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; d0(c, q); c.restore(); }
    };
    return undefined;
  };

  // a plain hit with the greatsword / axe / hammer: a rage crescent across the monster on ink + a spark spray
  function plainHit(e, r, h) {
    const k = h.k * (h.big ? 1.2 : 1), heavy = h.W && (h.W.twoHanded || h.W.style === 'smash');
    const rot = (h.dir > 0 ? 0.5 : PI - 0.5) + rand(-0.25, 0.25);
    crescent(h.x, h.y, rot, (heavy ? 210 : 170) * k, h.dir, { life: 0.2, inkA: 0.38, white: 0.3 });
    fr('bkf_cleave', h.x, h.y, { size: (heavy ? 270 : 220) * k, rot: rand(-0.25, 0.15), flipX: h.dir < 0, speed: 1.3, grow: [0.88, 1.06] });
    if (heavy) shake(2);
    LK.part({ n: 'bk_spark', x: h.x + h.dir * 50 * k, y: h.y, rot: h.dir > 0 ? rand(-0.3, 0.2) : PI + rand(-0.2, 0.3), len: 140 * k, life: 0.24, a: 1, col: null, white: 0.3, g: 0.6, fade: out(1.3) });
    if (r.crit) {
      if (fr('bkf_cross', h.x, h.y, { size: 300 * k, rot: rand(-0.2, 0.2), grow: [0.88, 1.1] })) { rocks(h.x, h.y + 50, 2, 0.6); shake(5); }
      LK.part({ n: 'bk_rips', x: h.x, y: h.y, rot: rand(-0.2, 0.2), flipY: h.dir < 0, len: 200 * k, life: 0.3, a: 1, col: null, white: 0.4, g: 0.8, grow: pop(0.5, 1.08, 0.2), fade: out(1.3) });
      LK.part({ n: 'bk_impact', x: h.x, y: h.y, rot: rand(0, PI), len: 170 * k, life: 0.16, a: 1, col: null, white: 0.3, g: 0.6, grow: pop(0.5, 1.1, 0.3), fade: out(1.4) });
    }
  }

  const hitFeel = IL.hitFeel([HOT, RAGE]);
  BK = LK.lineSkin({
    name: 'BerserkLight', param: 'berserklight', jobs: ['berserker', 'bloodmoon'], root: 'berserker',
    ready: ['bk_crescent', 'bk_cross', 'bk_ring', 'bk_guillo', 'bk_crater', 'bk_vcres', 'bk_vdust', 'ring', 'glint', 'orb', 'soft', 'core', 'spike_mid', 'spike_long', 'shard', 'drop'],
    map: MAP, plainHit, ghost: '#ff8a6a', swingRing: true,
    add: (p, L, base) => {
      // (the titan's / bloodmoon's awake shockwave outside a skill: K.slashAt from a hit hook, in the line's scope already)
      return hitFeel(p, L, base);
    },
  });
  IL.flashes((S) => S.map === MAP);
  BK.heavy = BK_heavy;
  NC.skillTicks.push((game, p) => { if (BK.fam(p)) ensure(); });
  for (const id of BK.ids) {
    const f = NC.SKILL_RUN[id];
    if (f && !f.bkEnsure) { const g = function () { ensure(); return f.apply(this, arguments); }; g.bkEnsure = true; g.lkSkin = f.lkSkin; g._orig = f._orig || f; NC.SKILL_RUN[id] = g; }
  }
  // the smash's charge: rage motes gathering (the channel's motes are mapped); the titan's whole buff: flames now and then
  NC.skillTicks.push((game, p, dt) => {
    if (!BK.live() || !BK.fam(p) || !(p.buffs && p.buffs.bk_titan > 0)) return;
    if (Math.random() < dt * 6) rageRise(p, 1, 1.4);
  });
})();
