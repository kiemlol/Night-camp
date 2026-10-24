/* priestlight.js — the whole PRIEST LINE made of light (2026-10-19, the user: "ปรับทุกสกิล ให้ใช้เเสง อารมนี้เเทน ... เริ่มจากพระ
   ก่อน" -> "ทำชุดแสงกลาง + พระคลาส 1 ทั้ง 6 อย่าง" -> "ทำสกิลสายพระ เเก้ทุกอันเลย เอาให้สวยนะ"), on js/lightkit.js.
   The jobs: พระ, บิชอป, นักพรต, ผู้จุดตะเกียง, ผู้เลี้ยงดวงไฟ and their class 3 (นักบุญแสงดาว, ปรมาจารย์หมัดดาวตก,
   ผู้เฝ้าประภาคาร, ผู้เลี้ยงดวงดาว). Every skill keeps ALL its own code and numbers; only the drawing changes:
   - while a skill of the line runs (RUN.<id>, a cast, a buff's aura, the line's per-frame hooks, its hits, the class-3
     power-ups and signatures, and everything those start later: timers, projectiles), its code-drawn effects become light
     (LK.reskin with the holy skin): beams -> columns of light, rings -> waves along the ground, holy circles -> the painted
     sigil, the plus -> feathers and petals rising, wings -> the painted light wings + a halo, stars / motes / sparks ->
     glints, drops and spikes, slashes -> painted light arcs, dash lines -> lines of light, lightning -> painted bolts,
     ground cracks -> painted cracks of light, smoke -> light dust, ♪ -> painted notes; projectiles -> a gold orb of light
     (the monk's chi in its teal), the wisps -> the painted wisp spirit, the meteor-fist's meteors -> a painted meteor, star
     rains -> painted stars;
   - the line's lasting looks, drawn by their own drawers, are swapped when they appear: the bishop's barrier -> the painted
     hexagon dome (rising, shimmering, breaking), the seal -> two sigils, the lightkeeper's zones -> ground light + a turning
     band + motes, its lamps' glow -> light, the dawn -> a wash of light with sun rays, the wisps circling / latched /
     marking -> painted wisps, the thousand fireflies -> drops of light, the bell's chime -> crescents of light and a note;
     the starsaint's faith star and the beacon's beams -> painted star / light cones; a cast's circle -> the painted sigil;
   - the line's basic attacks: a holy staff's bolt -> a gold orb of light with a glint and a trail (a burst on the hit, a
     flare at the tip); a melee weapon's plain hit (fists, torch ...) -> a small burst of light spikes in the job's colour.
   The skill's extras: attack columns land with spikes and (big ones) a small camera punch; buff / heal / revive columns are
   soft and narrow; the monk's palms leave painted light palms, his combo / impact / asura shockwaves.
   Switch: ESC → ตั้งค่า "สายพระ" (js/hitstyle.js row 'priest', NC.PriestLight.on, ON by default); ?priestlight=1 / 0 forces it.
   The machinery (every skill / cast / hook / hit / class-3 effect of the line in the skin, swapped looks, plain hits) is
   js/lightkit.js LK.lineSkin; this file holds the line's own looks.
   Load after every file of the line (the class-3 ones included) and before js/hitstyle.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, RUN = NC.SKILL_RUN, LK = NC.LightKit, C3 = NC.C3;
  if (!FX || !RUN || !LK || !V) return;
  let PL = null;   // (NC.PriestLight: made by LK.lineSkin below)
  const GOLD = '#ffd66e', WISPC = '#a8ffe6', CHI = '#8ef2e2', WARM = '#ffcf86', rand = NC.rand, TAU = Math.PI * 2, SQ = V.SQ || 0.58;
  const MAN = NC.ASSET_MANIFEST_LIGHTKIT || {};
  const FAM = ['priest', 'bishop', 'monk', 'lightkeeper', 'wisp', 'starsaint', 'meteorfist', 'beacon', 'starshepherd'];
  const isJob = (p, j) => !!p && (p.job === j || (NC.isJob ? NC.isJob(p, j) : false));
  const live = () => PL.live();
  const me = () => NC.game && NC.game.player;
  const lv = (p, id) => (NC.skillLv ? NC.skillLv(p, id) : 0);
  const has = (n) => !!MAN[n] && LK.ready(n);
  // the colour of a job's light
  const tone = (p) => (isJob(p, 'monk') ? WARM : isJob(p, 'wisp') ? WISPC : isJob(p, 'lightkeeper') ? '#ffd9a0' : GOLD);

  // =====================================================================================================
  // the holy skin, with this line's own extras
  // =====================================================================================================
  const SOFT = new Set(['blessing', 'pr_gloria', 'pr_suffragium', 'pr_resurrect', 'bi_clementia', 'bi_canto', 'bi_sacrament', 'bi_expiatio',
    'cast', 'tick']);   // (bi_heal's / the sanctuary's columns are soft by their own low alpha; a judgment from inside a heal is an attack)
  const zoom = (x, y, k, d) => { if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(x, y, k, d); };
  const MAP = LK.holyMap((kind, p, S) => {
    const t = S.tag;
    if (kind === 'beam') {
      const col = LK.hex(p.rgb, 0.2);
      if (p.w >= 200) { LK.pillar(p.x, p.y, { w: p.w * 0.6, h: p.h, life: p.life, col, a: 0.5, impact: 1.3 }); zoom(p.x, p.y - 60, 0.04, 0.25); return null; }   // (ปาฏิหาริย์'s sun)
      if (t === 'pr_resurrect' || p.w >= 105) { LK.pillar(p.x, p.y, { w: p.w * 0.7, h: p.h, life: p.life, col, a: 0.62 }); return null; }   // (a revive)
      if (SOFT.has(t) || (p.a !== undefined && p.a < 0.7) || p.life > 1.5) {   // (a buff's, a heal's, a zone's: soft and narrow)
        LK.pillar(p.x, p.y, { w: p.w * 0.6, h: p.h, life: p.life, col, a: Math.min(0.5, p.a === undefined ? 0.5 : p.a + 0.1) });
        return null;
      }
      if (t === 'magnus') { LK.pillar(p.x, p.y, { w: p.w, h: p.h, life: p.life, col, impact: 0.55 }); return null; }
      // an attack's column (แสงศักดิ์สิทธิ์, ขับไล่อมตะ, ลงทัณฑ์, the class-3 pillars, the lighthouse ...): it lands with spikes
      LK.pillar(p.x, p.y, { w: p.w * 1.05, h: p.h, life: p.life, col, impact: Math.min(1.2, p.w / 70) });
      if (p.w >= 70) zoom(p.x, p.y - 40, 0.03, 0.16);
      return null;
    }
    if (kind === 'glow' && t === 'mo_palms' && p.hot && has('palm')) {   // (a light palm print for each palm strike)
      LK.part({ n: 'palm', x: p.x, y: p.y, rot: rand(-0.3, 0.3), len: 54, life: 0.24, a: 1, col: '#ffd49a', white: 0.5, g: 0.7,
        grow: (u) => 0.6 + 0.6 * Math.min(1, u / 0.3), fade: LK.out(1.4) });
      LK.burst(p.x, p.y, { k: 0.4, col: '#ffcf86', n: 5, spark: 2, flash: false });
      return null;
    }
    if (kind === 'flare' && (t === 'mo_combo' || t === 'mo_impact' || t === 'mo_asura' || p.r >= 140) && has('shock')) {   // (a fist's shockwave)
      const k = Math.min(2.4, p.r / 110), col = LK.hex(p.rgb, 0.2);
      LK.part({ n: 'shock', x: p.x, y: p.y, rot: rand(0, TAU), len: p.r * 1.4, life: 0.26, a: 0.9, col, white: 0.4, g: 0.6, grow: (u) => 0.4 + 0.9 * (1 - Math.pow(1 - u, 2.4)), fade: LK.out(1.3) });
      LK.burst(p.x, p.y, { k: k * 0.7, col, n: Math.round(6 + k * 4), spark: 4 });
      if (p.r >= 300) zoom(p.x, p.y, 0.05, 0.3);
      return null;
    }
    return undefined;
  });
  // ♪ floating from the battle hymn -> painted notes of light
  MAP.text = (p) => { if ((p.text === '♪' || p.text === '♫') && has('note')) { LK.asPart(p, 'note', 30, '#ffe6a0', { white: 0.35 }); p.sway = 4; p.swayA = 8; } };
  // projectiles: a gold orb of light, the wisp spirit, a meteor, a star (by the skill and the caster's job)
  function projKind(S) {
    const t = S.tag || '', p = S.p || me();
    if (t === 'mo_spheres') return 'orbit';
    if (t === 'st_merge') return 'star';
    if (/^ws_/.test(t) || ((t === 'tick' || t === 'hit') && isJob(p, 'wisp'))) return 'wisp';
    if (/^mf_/.test(t) || (isJob(p, 'meteorfist') && (t === 'hit' || t === 'tick'))) return 'meteor';
    if (/^ss_|^st_/.test(t)) return 'star';
    return 'orb';
  }
  function drawWisp(c, x, y, s, t, a, glow) {
    if (!has('wisp')) { LK.piece(c, 'orb', x, y, 0, 26 * s, 26 * s, a, WISPC, 0.5, { glow }); return; }
    // (about the old dot's size: five painted ones at full size merged into one bright blob over the shepherd's head)
    const f = LK.frameAt('wisp', t, 10), fr = MAN.wisp.frames[f], W = 34 * s;
    LK.piece(c, 'wisp', x, y, 0, W, (W * fr.h) / fr.w, a * 0.85, null, 0.2, { glow, frame: f, g: 0.45 });
  }
  // (PL.drawWisp is set once the skin is made)
  MAP.vproj = (p, S) => {
    const kind = projKind(S), owner = S.p || me(), col = S.tag === 'mo_chi' ? CHI : tone(owner), ph = rand(0, 6);
    p.type = 'lk'; p.layer = 'glow';
    p.draw = (c, q2, u, glow) => {
      const vx = q2.vx || 0, vy = q2.vy || 0, ang = Math.atan2(vy, vx), sp = Math.hypot(vx, vy);
      if (kind === 'orbit') {   // the monk's spirit spheres circling him
        const P = owner, G = NC.game, n = (P && P.spheres) || 0;
        for (let i = 0; i < n; i++) {
          const a = G.time * 2.2 + (i / n) * TAU, x = P.x + Math.cos(a) * 58, y = P.y - 80 + Math.sin(a) * 22;
          LK.piece(c, 'soft', x, y, 0, 70, 70 * LK.aspect('soft'), 0.45, '#ffc860', 0, { glow, g: 0.5 });
          LK.piece(c, 'orb', x, y, 0, 42, 42, 1, '#ffd27a', 0.6, { glow, g: 0.8 });
          LK.piece(c, 'glint', x, y, G.time * 2 + i, 48, 48 * LK.aspect('glint'), 0.65 + 0.3 * Math.sin(G.time * 9 + i), '#fff0c0', 0.45, { glow, g: 0.5 });
        }
        return;
      }
      if (kind === 'wisp') { drawWisp(c, q2.x, q2.y, 0.9, q2.t + ph, 1, glow); if (sp > 50) LK.piece(c, 'streak', q2.x - Math.cos(ang) * 30, q2.y - Math.sin(ang) * 30, ang, 80, 80 * LK.aspect('streak') * 1.6, 0.6, WISPC, 0.3, { glow, g: 0.5 }); return; }
      if (kind === 'meteor' && has('meteor')) { LK.piece(c, 'meteor', q2.x - Math.cos(ang) * 40, q2.y - Math.sin(ang) * 40, ang, 150, 150 * LK.aspect('meteor'), 1, null, 0.35, { glow, g: 0.7 }); return; }
      if (kind === 'star' && has('star5')) {
        if (sp > 50 && has('comet')) LK.piece(c, 'comet', q2.x - Math.cos(ang) * 50, q2.y - Math.sin(ang) * 50, ang, 130, 130 * LK.aspect('comet') * 1.4, 0.8, GOLD, 0.4, { glow, g: 0.6 });
        LK.piece(c, 'star5', q2.x, q2.y, q2.t * 8, 44, 44 * LK.aspect('star5'), 1, '#fff0b0', 0.5, { glow, g: 0.7 });
        return;
      }
      // a gold (teal for the chi) orb of light with a streak behind it and a glint
      const k = S.tag === 'mo_chi' ? 1.8 : 1;
      if (sp > 50) LK.piece(c, 'streak', q2.x - Math.cos(ang) * 46 * k, q2.y - Math.sin(ang) * 46 * k, ang, 130 * k, 130 * k * LK.aspect('streak') * 1.7, 0.85, col, 0.45, { glow, g: 0.6 });
      LK.piece(c, 'orb', q2.x, q2.y, 0, 46 * k, 46 * k * LK.aspect('orb'), 1, col, 0.6, { glow, g: 0.7 });
      LK.piece(c, 'glint', q2.x, q2.y, q2.t * 5, 58 * k, 58 * k * LK.aspect('glint'), 0.9, col, 0.5, { glow, g: 0.6 });
    };
  };

  // the class-3 drawers of the line (the starsaint's faith star, the beacon's beams)
  if (C3) {
    // the starsaint's faith star over the head
    const SS = C3.jobs.starsaint;
    if (SS && SS.drawFront) {
      const f0 = SS.drawFront;
      SS.drawFront = function (ctx, game, p) {
        if (!live() || !has('star5')) return f0.apply(this, arguments);
        const f = (p.ssFaith || 0) / 100;
        if (f <= 0 || !lv(p, 'ss_faith')) return;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        LK.piece(ctx, 'soft', p.x, p.y - 226, 0, 120 * (0.5 + f), 120 * (0.5 + f) * LK.aspect('soft'), 0.25 + f * 0.35, GOLD, 0);
        LK.piece(ctx, 'star5', p.x, p.y - 226, game.time, 30 + f * 40, (30 + f * 40) * LK.aspect('star5'), 0.6 + f * 0.4, '#fff2b0', f >= 1 ? 0.6 : 0.3);
        ctx.restore();
      };
    }
    // the beacon's turning beams: painted light cones flat on the ground
    const BC = C3.jobs.beacon;
    if (BC && BC.drawBack) {
      const f0 = BC.drawBack;
      BC.drawBack = function (ctx, game, p) {
        if (!live() || !has('cone')) return f0.apply(this, arguments);
        const o = p._bcOn || 0;
        if (o <= 0 || !lv(p, 'bc_beam')) return;
        const n = C3.awake && C3.awake(p) ? 3 : 1, L = 480;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let b = 0; b < n; b++) {
          const a = (p._bcA || 0) + (b / n) * TAU, x0 = p.x, y0 = p.y - 70;
          LK.piece(ctx, 'cone', x0 + Math.cos(a) * L * 0.5, y0 + Math.sin(a) * L * 0.5 * SQ, a, L * 1.04, L * 0.62, 0.7 * o, '#ffe2a8', 0.2, { ground: true });
        }
        ctx.restore();
      };
    }
  }

  // =====================================================================================================
  // lasting looks and basic attacks, swapped when they appear (outside any skill's run)
  // =====================================================================================================
  const swap = (p, draw, update) => PL.swap(p, draw, update);   // (a swapped look: its old self when the switch is off)
  const zonesOf = (G, P) => (NC.lightZones ? NC.lightZones(G, P) || [] : []);
  const SWAP = {
    // the bishop's barrier: the painted dome rising, shimmering (brighter for a moment when it soaks a hit), breaking
    vkyrie(p) {
      if (!has('dome')) return false;
      swap(p, (c, q2, u, glow) => {
        const o = q2.follow, pulse = q2.hitT ? Math.max(0, 1 - (q2.t - q2.hitT) / 0.3) : 0;
        const f = q2.t < 0.17 ? 0 : q2.t < 0.34 ? 1 : 2 + (Math.floor((q2.t - 0.34) * 8) % 3), fr = MAN.dome.frames[f], W = 250 * (1 + pulse * 0.06);
        LK.piece(c, 'dome', o.x, o.y + 24, 0, W, (W * fr.h) / fr.w, 0.85 + 0.4 * pulse, null, 0.15 + 0.35 * pulse, { glow, frame: f, g: 0.45 });
      });
      const end = p.onEnd;
      p.onEnd = function (q2) {   // (it breaks: the last frame, hexagon chips flying)
        if (end) end.apply(this, arguments);
        if (!live()) return;
        const o = q2.follow;
        LK.add({ x: o.x, y: o.y, life: 0.35, draw(c, q3, u, glow) { const fr = MAN.dome.frames[5]; LK.piece(c, 'dome', o.x, o.y + 24, 0, 250, (250 * fr.h) / fr.w, 1 - u, null, 0.2, { glow, frame: 5, g: 0.45 }); } });
        for (let i = 0; i < 8; i++) { const a = rand(-Math.PI, 0); LK.part({ n: has('hex') ? 'hex' : 'chip', x: o.x + Math.cos(a) * 90, y: o.y - 60 + Math.sin(a) * 60, vx: Math.cos(a) * rand(150, 380), vy: Math.sin(a) * rand(150, 380), grav: 600, drag: 1.5, spin: rand(-6, 6), rot: rand(0, TAU), len: rand(16, 26), life: rand(0.4, 0.7), col: '#ffe08a', white: 0.4 }); }
      };
    },
    // the seal of ตราแสงตรึง: two sigils turning against each other
    vseal(p) {
      swap(p, (c, q2, u, glow) => {
        const a = (u < 0.1 ? u / 0.1 : u > 0.75 ? (1 - u) / 0.25 : 1);
        LK.sigilNow(c, q2.x, q2.y, q2.r, q2.t * 1.2, '#cfe9ff', a, 'holy', glow);
        LK.sigilNow(c, q2.x, q2.y, q2.r * 0.6, -q2.t * 2, GOLD, a * 0.9, 'star', glow);
      });
    },
    // the lightkeeper's zones: light on the ground, a band turning slowly at the edge, motes rising
    j3zones(p) {
      let acc = 0;
      swap(p, (c, q2, u, glow) => {
        const G = NC.game, P = G && G.player;
        if (!G || !isJob(P, 'lightkeeper')) return;
        for (const z of zonesOf(G, P)) {
          const hex = z.kind === 'lamp' ? '#ffe2a0' : z.kind === 'aura' ? '#fff0c8' : '#ffc27a', a = z.kind === 'aura' ? 0.35 : 0.55;
          LK.piece(c, 'ground_glow', z.x, z.y, 0, z.r * 2.3, z.r * 2.3 * LK.aspect('ground_glow'), a, hex, 0, { glow, ground: true, g: 0.35 });
          LK.piece(c, 'sigil_band', z.x, z.y, G.time * 0.25, z.r * 2, z.r * 2, a * 0.55, hex, 0.1, { glow, ground: true, g: 0.3 });
        }
      }, (q2, dt) => {
        const G = NC.game, P = G && G.player;
        if (!G || !isJob(P, 'lightkeeper')) return;
        acc += dt;
        if (acc < 0.12) return;
        acc = 0;
        for (const z of zonesOf(G, P)) {
          const a = rand(0, TAU), d = Math.sqrt(Math.random()) * z.r;
          LK.part({ n: Math.random() < 0.3 ? 'petal' : 'mote', x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d * SQ, vx: rand(-10, 10), vy: -rand(60, 130), drag: 0.6,
            len: rand(9, 14), life: rand(0.7, 1.2), a: 0.8, col: z.kind === 'lamp' ? '#ffe2a0' : '#ffc27a', white: 0.5, g: 0.7, fade: LK.inOut(0.2, 0.6), sway: rand(3, 6), swayA: 6, ph: rand(0, 6) });
        }
      });
    },
    // a lamp / torch standing: its painted sprite, its glow made of light (flickering)
    j3lampobj(p) {
      swap(p, (c, q2, u, glow) => {
        const z = q2.z, G = NC.game;
        if (z.list && !z.list.includes(z)) { q2.dead = true; return; }
        const lamp = z.kind === 'lamp', name = lamp ? 'lk_lamp' : 'lk_torch', bob = lamp && z.follow ? Math.sin(G.time * 3) * 6 : 0;
        if (!glow && NC.SPR[name]) { c.save(); c.globalCompositeOperation = 'source-over'; NC.drawSpr(c, name, z.x, z.y + bob, {}); c.restore(); }
        const hy = z.y - (lamp ? 30 : 95) + bob, fl = 0.85 + 0.15 * Math.sin(G.time * 9) + 0.05 * Math.sin(G.time * 23), hex = lamp ? '#ffe2a0' : '#ffbf70';
        LK.piece(c, 'soft', z.x, hy, 0, 210, 210 * LK.aspect('soft'), 0.4 * fl, hex, 0, { glow, g: 0.5 });
        LK.piece(c, 'orb', z.x, hy, 0, 56, 56 * LK.aspect('orb'), 0.85 * fl, hex, 0.45, { glow, g: 0.7 });
      });
    },
    // the dawn: a warm wash of light over the view, sun rays from above
    j3dawn(p) {
      swap(p, (c, q2, u, glow) => {
        const G = NC.game; if (!G) return;
        const a = Math.min(1, q2.t / 0.8) * (u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1), P = G.player;
        LK.piece(c, 'soft', P.x, P.y - 100, 0, 2600, 2600 * LK.aspect('soft'), 0.2 * a, '#ffe6b0', 0, { glow, g: 0.25 });
        LK.piece(c, 'rays', P.x, P.y - 560, 0, 1300, 1300 * LK.aspect('rays'), 0.32 * a * (0.9 + 0.1 * Math.sin(G.time * 2)), '#fff0c8', 0.15, { glow, g: 0.4 });
      });
    },
    // the wisps: circling the shepherd, latched on friends, marking monsters -> the painted wisp spirit
    j3wisps(p) {
      if (!has('wisp')) return false;
      swap(p, (c, q2, u, glow) => {
        const G = NC.game, P = G && G.player;
        if (!P || !isJob(P, 'wisp') || P.dead > 0) return;
        const n = P.wsOrbit || 0, t = G.time, s0 = n >= 5 && lv(P, 'ws_heart') >= 5 ? 1.25 : 1;
        for (let i = 0; i < n; i++) {
          const a = t * 1.8 + (i / Math.max(1, n)) * TAU;
          drawWisp(c, P.x + Math.cos(a) * 58, P.y - 96 + Math.sin(a) * 20 + Math.sin(t * 3 + i) * 5, s0, t + i * 0.37, 1, glow);
        }
        for (const l of P.wsLatch || []) {
          const a = t * 2.4 + l.until;
          drawWisp(c, l.host.x + Math.cos(a) * 34, l.host.y - 110 + Math.sin(a) * 10, 0.85, t + l.until, 0.9, glow);
          if (l.shield > 0) LK.piece(c, 'soft', l.host.x, l.host.y - 60, 0, 190, 190 * LK.aspect('soft'), 0.3, WISPC, 0, { glow, g: 0.4 });
        }
        for (const e of G.enemies) if (e.wsMark && e.wsMark.until > t && e.hp > 0) drawWisp(c, e.x + Math.sin(t * 3) * 10, NC.labelTop(e) - 40, 0.9, t, 1, glow);
      });
    },
    // the thousand fireflies: drops of light drifting and twinkling
    j3fireflies(p) {
      swap(p, (c, q2, u, glow) => {
        const G = NC.game; if (!G) return;
        const P = G.player, a = Math.min(1, q2.t / 0.6) * (u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1);
        for (const [dx, dy, ph] of q2.dots) {
          const x = P.x + dx + Math.sin(G.time * 0.8 + ph) * 30, y = P.y + dy - q2.t * 20 + Math.cos(G.time * 1.1 + ph) * 20;
          LK.piece(c, 'drop', x, y, 0, 16, 16 * LK.aspect('drop'), 0.9 * a * (0.45 + 0.55 * Math.sin(G.time * 4 + ph)), WISPC, 0.5, { glow, g: 0.8 });
        }
      });
    },
    // the bell's chime: crescents of light travelling out, a note
    j3chime(p) {
      if (!has('crescent')) return false;
      swap(p, (c, q2, u, glow) => {
        const a = Math.atan2(q2.vy, q2.vx), s = 0.7 + Math.min(1, q2.t * 4) * 0.5;
        for (let i = 0; i < 3; i++) LK.piece(c, 'crescent', q2.x - Math.cos(a) * i * 12 * s, q2.y - Math.sin(a) * i * 12 * s, a + Math.PI, (36 + i * 10) * s, (36 + i * 10) * s * LK.aspect('crescent'), 0.85 - i * 0.22, WISPC, 0.4, { glow, g: 0.6 });
        if (has('note')) LK.piece(c, 'note', q2.x, q2.y - 26, Math.sin(q2.t * 8) * 0.2, 26, 26 * LK.aspect('note'), 0.8, WISPC, 0.3, { glow, g: 0.5 });
      });
    },
  };

  // the basic attack of a holy staff, the plain hits of the line's melee weapons
  const holyBolt = () => { const P = me(), W = P && NC.ITEMS[P.equip.weapon]; return !!(W && W.style === 'bolt' && W.element === 'holy'); };
  const BOLTMAP = Object.assign({}, MAP, { ring: (p) => { LK.burst(p.x, p.y, { k: 0.55, col: GOLD, n: 8, spark: 4 }); return null; } });
  function drawBolt(c, q2, u, glow) {
    const ang = Math.atan2(q2.vy, q2.vx), k = q2.big ? 1.3 : 1, ca = Math.cos(ang), sa = Math.sin(ang);
    LK.piece(c, 'streak', q2.x - ca * 46 * k, q2.y - sa * 46 * k, ang, 130 * k, 130 * k * LK.aspect('streak') * 1.7, 0.85, GOLD, 0.45, { glow, g: 0.6 });
    LK.piece(c, 'orb', q2.x, q2.y, 0, 46 * k, 46 * k * LK.aspect('orb'), 1, '#ffe9a6', 0.7, { glow, g: 0.7 });
    LK.piece(c, 'glint', q2.x, q2.y, q2.t * 5, 58 * k, 58 * k * LK.aspect('glint'), 0.9, GOLD, 0.6, { glow, g: 0.6 });
  }
  let boltAt = -1;
  // the line's own new FX items: a holy staff's bolt -> the orb of light, the ring at the staff's tip -> a flare
  function add(p, L, put) {
    const G = NC.game, P = me();
    if (p.type === 'bolt' && holyBolt()) {
      boltAt = G ? G.time : -1;
      const up = p.update;
      let trail = 0;
      p.type = 'lk'; p.layer = 'glow'; p.draw = drawBolt;
      p.update = function (o, dt, game) {
        trail += dt;
        while (trail > 0.018) {
          trail -= 0.018;
          LK.part({ n: Math.random() < 0.3 ? 'glint' : 'drop', x: o.x + rand(-6, 6), y: o.y + rand(-6, 6), vx: -o.vx * 0.08 + rand(-30, 30), vy: -o.vy * 0.08 + rand(-30, 30), drag: 3,
            len: rand(9, 16), life: rand(0.18, 0.32), a: 0.85, col: GOLD, white: 0.5, g: 0.6, tw: 36, ph: rand(0, 6) });
        }
        const self = this, args = arguments;
        return up ? LK.within(BOLTMAP, 'bolt', () => up.apply(self, args), P) : undefined;
      };
      put(p);
      return true;
    }
    if (p.type === 'ring' && p.color === '150,220,255' && G && G.time === boltAt) { LK.flare(p.x, p.y, { r: 34, col: GOLD, spikes: false }); return true; }
    return false;
  }

  // =====================================================================================================
  // the skin itself (js/lightkit.js LK.lineSkin: every skill, cast, hook, hit and class-3 effect of the line)
  // =====================================================================================================
  PL = LK.lineSkin({
    name: 'PriestLight', param: 'priestlight', jobs: FAM, root: 'priest', map: MAP, swaps: SWAP, add, tone, ghost: '#ffd36b',
    ready: ['pillar', 'sigil', 'ring', 'glint', 'orb', 'soft', 'core', 'drop'],
    plainSkip: (W) => W.style === 'bolt' && W.element === 'holy',   // (a holy staff's bolt has its own)
  });
  PL.drawWisp = drawWisp;
})();