/* knightlight.js — the whole KNIGHT LINE made of light (2026-10-19, the user: "ทำสายอัศวินเป็นแสงต่อเลย ทุกอาชีพในสาย แล้วถ่าย
   คลิปมาดู"), on js/lightkit.js (LK.lineSkin: every skill, cast, hook, hit and class-3 effect of the line runs in the skin).
   The jobs: อัศวิน, พาลาดิน, อัศวินมังกร, นักดาบ, เบอร์เซิร์กเกอร์ and their class 3 (ผู้พิทักษ์รุ่งสาง, อัศวินผสานมังกร,
   นักดาบกลุ่มดาว, จอมคลั่งจันทร์เลือด). Every skill keeps its own code and numbers; only the drawing changes:
   - the holy skin (columns, waves, sigils, glints, drops, spikes, lines, bolts, cracks, dust ...) plus the sword line's
     own painted pieces (assets/lightkit: steel-blue light, tinted to each effect's colour): sword slashes -> painted light
     slashes (big / thin) along the same arc, big flares -> shockwaves, standing spikes -> lances of light rising,
     projectiles -> a shield of light spinning (โล่พิฆาต), a fire lance (หางมังกร), a crescent wave (คลื่นดาบเวท), swords of
     light (the swordmaster's blades), an orb of light in the job's colour;
   - lasting looks swapped when they appear: the guard dome and the aegis / reflect barriers -> the painted hexagon dome,
     the judgment sword and the heaven swords -> the painted giant sword of light falling, landing, breaking, the heaven's
     finale -> a burst of light, the ground rays -> painted light cones turning, the paladin's cross -> two blades of
     light on the ground, the roaring dragon -> a serpent of flame light with a meteor head, the swordmaster's blade marks
     -> painted cross slashes, the floating / moon blades -> swords of light, the starblade's star -> lines of light, a
     spear's thrust -> a lance of light; a plain melee hit -> a thin light slash + spikes in the job's colour.
   Switch: ESC → ตั้งค่า "สายอัศวิน" (js/hitstyle.js row 'knight', NC.KnightLight.on); ?knightlight=1 / 0 forces it.
   Load after every file of the line (the class-3 ones, barrierfx.js, heavenfx.js) and before js/hitstyle.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, LK = NC.LightKit, K = NC.SkillKit;
  if (!FX || !V || !LK || !LK.lineSkin) return;
  let KL = null;   // (NC.KnightLight: made by LK.lineSkin below)
  const MAN = NC.ASSET_MANIFEST_LIGHTKIT || {};
  const rand = NC.rand, PI = Math.PI, TAU = PI * 2, SQ = V.SQ || 0.58, lerp = NC.lerp || ((a, b, t) => a + (b - a) * t);
  // (the berserker + จอมคลั่งจันทร์เลือด: their own skin js/berserklight.js was tried 2026-10-20/21 and unhooked, the owner kept
  // this old look: "กลับไปใช้สกิลเดิมดีกว่า" - they stay here, without the ink below)
  const FAM = ['knight', 'paladin', 'dragonknight', 'swordmaster', 'berserker', 'dawnwarden', 'dragonbound', 'starblade', 'bloodmoon'];
  // the ink under the light (js/inklight.js, the reaper's recipe, the user 2026-10-20: "พวกสายตีทั้งหลาย"): an ink slash under
  // every slash, ink dust under the big blows; the ink pieces load the first time a hero of the line is seen
  // (not for the berserker's line: its old look as it was)
  const IL = (P) => (P && isJob(P, 'berserker') ? null : NC.InkLight && NC.InkLight.ensureInk && NC.InkLight.ensureInk() ? NC.InkLight : null);
  const isJob = (p, j) => !!p && (p.job === j || (NC.isJob ? NC.isJob(p, j) : false));
  const live = () => KL.live();
  const has = (n) => !!MAN[n] && LK.ready(n);
  const GOLD = '#ffd66e', STEEL = '#d8ecff', FIRE = '#ffa060', MOON = '#bcd8ff', RAGE = '#ff5a50';
  const tone = (p) => (isJob(p, 'paladin') ? GOLD : isJob(p, 'dragonknight') ? FIRE : isJob(p, 'swordmaster') ? MOON : isJob(p, 'berserker') ? RAGE : STEEL);
  const col = (rgb, w) => LK.hex(rgb || '220,235,255', w === undefined ? 0.15 : w);
  const zoom = (x, y, k, d) => { if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(x, y, k, d); };

  // =====================================================================================================
  // the skin: holy + the sword line's own
  // =====================================================================================================
  const SOFT = new Set(['cast', 'tick', 'pal_devotion', 'pal_layhands', 'kn_berserk', 'bk_warcry', 'bk_titan', 'sm_moondance', 'sm_enchant']);
  const MAP = LK.holyMap((kind, p, S) => {
    const t = S.tag;
    if (kind === 'beam') {
      const c = col(p.rgb, 0.2);
      if (SOFT.has(t) || (p.a !== undefined && p.a < 0.7) || p.life > 1.5) { LK.pillar(p.x, p.y, { w: p.w * 0.6, h: p.h, life: p.life, col: c, a: 0.5 }); return null; }
      // (the judgment's six columns round its sword: thin and soft, the sword is the star; at full strength they burnt it white)
      if (t === 'judgment' || t === 'pal_cross' || t === 'pal_heaven') { LK.pillar(p.x, p.y, { w: p.w * 0.45, h: p.h, life: p.life, col: c, a: 0.42 }); return null; }
      LK.pillar(p.x, p.y, { w: p.w, h: p.h, life: p.life, col: c, impact: Math.min(1.3, p.w / 70) });
      if (p.w >= 90) zoom(p.x, p.y - 40, 0.03, 0.16);
      return null;
    }
    if (kind === 'flare' && p.r >= 120 && has('shock')) {   // (a big blow's flare: a shockwave of light)
      const k = Math.min(2.6, p.r / 110), c = col(p.rgb, 0.2);
      LK.part({ n: 'shock', x: p.x, y: p.y, rot: rand(0, TAU), len: p.r * 1.4, life: 0.26, a: 0.9, col: c, white: 0.4, g: 0.6, grow: (u) => 0.4 + 0.9 * (1 - Math.pow(1 - u, 2.4)), fade: LK.out(1.3) });
      LK.burst(p.x, p.y, { k: k * 0.7, col: c, n: Math.round(6 + k * 4), spark: 4 });
      const ink = IL(S.p);
      if (ink) { ink.puffs(p.x, p.y + 30, Math.round(2 + k * 1.5), p.r * 0.5, 0.8 + k * 0.25, { a: 0.38 }); ink.dark({ n: 'rg_vsplat', x: p.x, y: p.y + 50, rot: rand(0, TAU), len: p.r * 1.6, life: 0.9, a: 0.4, ground: true, layer: 'low', fade: LK.inOut(0.05, 0.6) }); }
      if (p.r >= 280) zoom(p.x, p.y, 0.05, 0.3);
      return null;
    }
    return undefined;
  });
  // a sword slash (V.slash: an arc of radius r round (x, y) from ang over sweep) -> a painted light slash on that arc
  MAP.vslash = (p, S) => {
    if (!has('slash_big')) return undefined;
    const dir = p.dir || 1, sweep = p.sweep || 2, m = p.ang + (sweep / 2) * dir, big = (p.thick || 20) >= 26 || p.r >= 110;
    const n = big ? 'slash_big' : 'slash_thin', c = col(p.rgb || '220,235,255', 0.1), r = p.r || 90, life = p.life || 0.3;
    const x = p.x + Math.cos(m) * r * 0.5, y = p.y + Math.sin(m) * r * 0.5, rot = m + PI / 2 + 0.45 * dir;
    const ink = IL(S && S.p);
    if (ink) ink.dark({ n: 'rg_vslash', x, y: y + 6, rot, flipY: dir < 0, len: r * (big ? 2.3 : 2.1), life: life * 1.5, a: big ? 0.45 : 0.32, grow: (u) => 0.8 + 0.25 * Math.min(1, u / 0.3), fade: LK.out(1.6) });
    LK.part({ n, x, y, rot, len: r * (big ? 2.15 : 2), flipY: dir < 0, life, a: 1, col: c, white: 0.55, g: 0.7,
      grow: (u) => 0.75 + 0.35 * Math.min(1, u / 0.3), fade: LK.out(1.5) });
    for (let i = 0; i < 3; i++) {
      const a = m + rand(-0.6, 0.6) * sweep * 0.5, sp = rand(600, 1000);
      LK.part({ n: 'spike_mid', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 9, stretch: true, sp0: 500,
        len: rand(50, 80), life: rand(0.12, 0.2), a: 0.85, col: c, white: 0.4, g: 0.5, fade: LK.out(1.3) });
    }
    return null;
  };
  // a spike standing on the ground (V.spikeAt) -> a lance of light rising out of it
  MAP.vspike = (p) => {
    if (!has('lance')) return undefined;
    const h = p.h || 90, c = col(p.rgb || '200,230,255', 0.1);
    LK.part({ n: 'lance', x: p.x, y: p.y - h * 0.5, rot: -PI / 2 + (p.tilt || 0) * 0.5, len: h * 1.25, wid: h * 1.25 * LK.aspect('lance') * 1.4, life: p.life || 0.8, a: 1, col: c, white: 0.5, g: 0.6,
      grow: (u) => (u < 0.12 ? 0.3 + 0.7 * (u / 0.12) : 1), fade: LK.inOut(0.05, 0.4) });
    LK.nightLight(p.x, p.y, h, c, 0.5, p.life || 0.8);
    return null;
  };
  // projectiles by the skill
  MAP.vproj = (p, S) => {
    const t = S.tag || '', owner = S.p || KL.me();
    if (t === 'bk_hurl' || t === 'dk_wyvern') return undefined;   // (the thrown weapon's own sprite; the wyvern's own)
    const kind = t === 'pal_shieldchain' ? 'shield' : t === 'dk_tail' ? 'lance' : t === 'sm_wave' ? 'wave' : /^sm_|^sb_/.test(t) || (isJob(owner, 'swordmaster') && (t === 'tick' || t === 'hit')) ? 'sword' : 'orb';
    const c = kind === 'lance' ? FIRE : tone(owner);
    p.type = 'lk'; p.layer = 'glow';
    p.draw = (cx, q, u, glow) => {
      const vx = q.vx || 0, vy = q.vy || 0, ang = Math.atan2(vy, vx), sp = Math.hypot(vx, vy);
      if (kind === 'shield' && has('lshield')) { LK.piece(cx, 'lshield', q.x, q.y, q.t * 14, 64, 64 * LK.aspect('lshield'), 1, GOLD, 0.45, { glow, g: 0.7 }); return; }
      if (kind === 'lance' && has('lance')) { LK.piece(cx, 'lance', q.x - Math.cos(ang) * 50, q.y - Math.sin(ang) * 50, ang, 150, 150 * LK.aspect('lance') * 1.5, 1, c, 0.45, { glow, g: 0.7 }); return; }
      if (kind === 'wave' && has('slash_thin')) { LK.piece(cx, 'slash_thin', q.x, q.y, ang + PI / 2 + 0.2, 150, 150 * LK.aspect('slash_thin') * 1.4, 1, MOON, 0.5, { glow, g: 0.7 }); return; }
      if (kind === 'sword' && has('lsword')) {
        if (sp > 50) LK.piece(cx, 'streak', q.x - Math.cos(ang) * 40, q.y - Math.sin(ang) * 40, ang, 100, 100 * LK.aspect('streak') * 1.4, 0.7, MOON, 0.3, { glow, g: 0.5 });
        LK.piece(cx, 'lsword', q.x, q.y, ang - PI / 2, 20, 20 * LK.aspect('lsword'), 1, MOON, 0.5, { glow, g: 0.7 });
        return;
      }
      if (sp > 50) LK.piece(cx, 'streak', q.x - Math.cos(ang) * 46, q.y - Math.sin(ang) * 46, ang, 130, 130 * LK.aspect('streak') * 1.7, 0.85, c, 0.45, { glow, g: 0.6 });
      LK.piece(cx, 'orb', q.x, q.y, 0, 46, 46 * LK.aspect('orb'), 1, c, 0.6, { glow, g: 0.7 });
      LK.piece(cx, 'glint', q.x, q.y, q.t * 5, 58, 58 * LK.aspect('glint'), 0.9, c, 0.5, { glow, g: 0.6 });
    };
  };

  // =====================================================================================================
  // lasting looks, swapped when they appear
  // =====================================================================================================
  const swap = (p, draw, update) => KL.swap(p, draw, update);
  // the painted dome round someone (frames: 0-1 rise, 2-4 shimmer, 5 break); tint null = gold as painted
  function domeAt(c, who, t, a, tint, pulse, glow, f) {
    const fr = f !== undefined ? f : t < 0.17 ? 0 : t < 0.34 ? 1 : 2 + (Math.floor((t - 0.34) * 8) % 3), F = MAN.dome.frames[fr], W = 250 * (1 + pulse * 0.06);
    LK.piece(c, 'dome', who.x, who.y + 24, 0, W, (W * F.h) / F.w, a * (0.85 + 0.4 * pulse), tint, 0.15 + 0.35 * pulse, { glow, frame: fr, g: 0.45 });
  }
  function domeBreak(who, tint) {
    LK.add({ x: who.x, y: who.y, life: 0.35, draw(c, q, u, glow) { domeAt(c, who, 0, 1 - u, tint, 0, glow, 5); } });
    for (let i = 0; i < 8; i++) { const a = rand(-PI, 0); LK.part({ n: has('hex') ? 'hex' : 'chip', x: who.x + Math.cos(a) * 90, y: who.y - 60 + Math.sin(a) * 60, vx: Math.cos(a) * rand(150, 380), vy: Math.sin(a) * rand(150, 380), grav: 600, drag: 1.5, spin: rand(-6, 6), rot: rand(0, TAU), len: rand(16, 26), life: rand(0.4, 0.7), col: tint || '#ffe08a', white: 0.4 }); }
  }
  // the giant sword of light: falling (frame 1), landed (2 impact, 3 steady), breaking (4, 5); `len` its length
  function swordAt(c, x, tipY, f, len, a, glow) {
    const F = MAN.hsword.frames[f], k = (len * 1.15) / 390;
    if (len >= 400) LK.piece(c, 'soft', x, tipY - len * 0.45, 0, len * 0.5, len * 1.0, a * 0.18, '#cfe4ff', 0, { glow, g: 0.3 });
    LK.piece(c, 'hsword', x, tipY, 0, F.w * k, F.h * k, a * (len >= 400 ? 1 : 0.8), null, len >= 400 ? 0.3 : 0.1, { glow, frame: f, g: len >= 400 ? 0.6 : 0.35 });
  }
  function fallingSword(p, len, top) {
    if (!has('hsword')) return false;
    swap(p, (c, q, u, glow) => {
      const fall = q.fall || 0.3, t = q.t, rest = Math.max(0.3, q.life - fall);
      if (t < fall) {
        const y = lerp(q.y - top, q.y + 20, Math.pow(t / fall, 2));
        swordAt(c, q.x, y, 1, len, 1, glow);
        LK.piece(c, 'streak', q.x, y - len * 0.9, PI / 2, len * 1.4, len * 0.2, 0.5, STEEL, 0.2, { glow, g: 0.4 });
        return;
      }
      // (the impact frame only for the big one: ten small swords landing at once burnt one white blob)
      const big = len >= 400, s = t - fall, f = big && s < 0.07 ? 2 : s < rest * 0.6 ? 3 : s < rest * 0.82 ? 4 : 5;
      if (!q.lkLanded) {
        q.lkLanded = true;
        LK.ring(q.x, q.y, { r0: 10, r1: len * (big ? 0.55 : 0.4), life: 0.4, col: STEEL, a: big ? 0.9 : 0.5 });
        if (big) LK.burst(q.x, q.y - 20, { k: 1, col: '#e6f2ff', n: 10, spark: 6 }); else LK.burst(q.x, q.y - 10, { k: 0.35, col: '#e6f2ff', n: 4, spark: 2, flash: false });
      }
      swordAt(c, q.x, q.y + 20, f, len, f >= 4 ? Math.max(0, 1 - (s - rest * 0.6) / (rest * 0.4)) + 0.3 : 1, glow);
    });
  }
  const SWAP = {
    // the knight's guard: the painted dome (a hit makes it flare)
    vdome(p) {
      if (!has('dome')) return false;
      swap(p, (c, q, u, glow) => {
        const pulse = q.hitT ? Math.max(0, 1 - (q.t - q.hitT) / 0.3) : 0, a = u < 0.06 ? u / 0.06 : u > 0.88 ? (1 - u) / 0.12 : 1;
        domeAt(c, q.follow, q.t, a, '#fff0c0', pulse, glow);
      });
      const end = p.onEnd;
      p.onEnd = function (q) { if (end) end.apply(this, arguments); if (live()) domeBreak(q.follow, '#fff0c0'); };
    },
    // the paladin's aegis (gold) / reflect (sky) barriers (js/barrierfx.js)
    pbarrier(p) {
      if (!has('dome')) return false;
      const tint = p.tone === 'sky' ? '#bfe2ff' : null;
      swap(p, (c, q, u, glow) => {
        const who = q.follow;
        if (!who) return;
        const gone = q.buff && !(who.buffs && who.buffs[q.buff] > 0);
        if (gone && !q.lkGone) { q.lkGone = q.t; domeBreak(who, tint); }
        if (q.lkGone) { if (q.t - q.lkGone > 0.05) q.dead = true; return; }
        const pulse = q.hitT !== undefined ? Math.max(0, 1 - (q.t - q.hitT) / 0.3) : 0, end = q.life - q.t;
        domeAt(c, who, q.t, end < 0.3 ? end / 0.3 : 1, tint, pulse, glow);
      });
    },
    // the judgment's giant sword, the heaven's swords (the drawn one, or js/heavenfx.js's)
    vsword(p) { return fallingSword(p, 470, 1150); },
    vsword2(p) { return fallingSword(p, 230, 900); },
    vsword3(p) { return fallingSword(p, 230, 900); },
    // ground rays turning (the judgment, the heaven): painted light cones flat on the ground
    vrays(p) {
      if (!has('cone')) return false;
      LK.nightLight(p.x, p.y, (p.r || 300) * 1.1, col(p.rgb, 0.2), 0.5, p.life);
      swap(p, (c, q, u, glow) => {
        const a = (u < 0.1 ? u / 0.1 : u > 0.5 ? 1 - (u - 0.5) / 0.5 : 1) * (q.a || 1), hex = col(q.rgb, 0.2);
        for (let i = 0; i < q.n; i++) {
          const ang = (i / q.n) * TAU + q.t * (q.spin || 0.6), r = q.r;
          LK.piece(c, 'cone', q.x + Math.cos(ang) * r * 0.5, q.y + Math.sin(ang) * r * 0.5 * SQ, ang, r * 1.04, (q.w || 20) * 2.6, 0.55 * a, hex, 0.1, { glow, ground: true, g: 0.4 });
        }
      });
    },
    // the paladin's burning cross: two blades of light crossing on the ground
    vcross(p) {
      if (!has('slash_line')) return false;
      LK.nightLight(p.x, p.y, (p.len || 300) * 1.2, col(p.rgb, 0.2), 0.6, p.life);
      swap(p, (c, q, u, glow) => {
        const a = u < 0.08 ? u / 0.08 : u > 0.5 ? 1 - (u - 0.5) / 0.5 : 1, L = q.len * (1 - Math.pow(1 - Math.min(1, u / 0.25), 3)), hex = col(q.rgb, 0.2);
        for (const r of [PI / 4, -PI / 4]) {
          LK.piece(c, 'slash_line', q.x, q.y, r, L * 2.2, (q.w || 90) * 1.3, a, hex, 0.35, { glow, ground: true, g: 0.6 });
          LK.piece(c, 'slash_line', q.x, q.y, r, L * 1.8, (q.w || 90) * 0.35, a, '#ffffff', 0.5, { glow, ground: true, g: 0.3 });
        }
      });
    },
    // the dragon's roar: a serpent of flame light (painted flames along its path, a meteor for its head)
    vdragon(p) {
      if (!has('rage') || !has('meteor')) return false;
      swap(p, (c, q, u, glow) => {
        const T = q.trail, a = u < 0.1 ? u / 0.1 : u > 0.8 ? (1 - u) / 0.2 : 1;
        if (!T || T.length < 2) return;
        for (let i = 0; i < T.length - 1; i++) {
          const k = i / T.length, [x, y] = T[i], s = 0.35 + k * 0.8;
          LK.piece(c, 'soft', x, y, 0, 110 * s, 110 * s * LK.aspect('soft'), 0.35 * a, FIRE, 0, { glow, g: 0.5 });
          LK.piece(c, 'rage', x, y, Math.sin(q.t * 9 + i) * 0.2, 46 * s, 46 * s * LK.aspect('rage'), 0.85 * a, FIRE, 0.3, { glow, g: 0.6 });
        }
        const [hx, hy] = T[T.length - 1], [px, py] = T[T.length - 2], ang = Math.atan2(hy - py, hx - px);
        LK.piece(c, 'meteor', hx - Math.cos(ang) * 40, hy - Math.sin(ang) * 40, ang, 170, 170 * LK.aspect('meteor'), a, null, 0.35, { glow, g: 0.7 });
      });
    },
    // the swordmaster's blade marks: painted cross slashes, blinking before they go off
    j3marks(p) {
      if (!has('slash_x') || !NC.bladeMarks) return false;
      const ELC = { fire: '#ffa060', ice: '#a8dcff', wind: '#fff08a', earth: '#e0b070', holy: GOLD };
      swap(p, (c, q, u, glow) => {
        for (const m of NC.bladeMarks) {
          const mu = m.t / m.life, a = Math.min(1, m.t / 0.1) * (mu > 0.8 ? 1 - (mu - 0.8) / 0.2 : 1) * (mu > 0.75 ? 0.6 + 0.4 * Math.sin(m.t * 30) : 1);
          const L = (34 + 6 * Math.sin(m.t * 6)) * 2.6;
          LK.piece(c, 'slash_x', m.x, m.y, m.ang, L, L * LK.aspect('slash_x'), a, (m.el && ELC[m.el]) || MOON, 0.45, { glow, g: 0.6 });
        }
      });
    },
    // the floating swords and the thousand moon blades (the ice shell of the same drawer stays as it is)
    j3orbit(p) {
      if (!has('lsword')) return false;
      p.layer = 'glow';
      swap(p, (c, q, u, glow) => {   // (the drawer itself runs, its blades drawn as swords of light)
        const t = q.type, kb = K.drawBlade, gl = V.glow;
        K.drawBlade = (cx, x, y, ang, len, w, fill, rgb) => LK.piece(cx, 'lsword', x, y, ang - PI / 2, len * 0.42, len * 0.42 * LK.aspect('lsword'), 0.95, rgb ? col(rgb, 0.2) : MOON, glow ? 0 : 0.5, { glow, g: 0.6 });
        if (glow) V.glow = () => {};
        c.save();
        try { q.type = q.origType; FX.drawOne(c, q); } finally { q.type = t; K.drawBlade = kb; V.glow = gl; c.restore(); }
      });
    },
    // the starblade's star: lines of light between the five marks
    c3star(p) {
      if (!has('slash_line')) return false;
      const PENTA = [0, 2, 4, 1, 3, 0];
      swap(p, (c, q, u, glow) => {
        const a = u < 0.2 ? u / 0.2 : 1 - Math.max(0, (u - 0.7) / 0.3);
        for (let k = 1; k < PENTA.length; k++) {
          const [x0, y0] = q.pts[PENTA[k - 1]], [x1, y1] = q.pts[PENTA[k]], L = Math.hypot(x1 - x0, y1 - y0);
          LK.piece(c, 'slash_line', (x0 + x1) / 2, (y0 + y1) / 2, Math.atan2(y1 - y0, x1 - x0), L * 1.1, 34, a, MOON, 0.45, { glow, g: 0.6 });
        }
        for (const [x, y] of q.pts) LK.piece(c, 'glint', x, y, q.t * 2, 60, 60 * LK.aspect('glint'), a, MOON, 0.5, { glow, g: 0.7 });
      });
    },
    // a spear's thrust: a lance of light along it
    thrust(p) {
      if (!has('lance')) return false;
      p.layer = 'glow';
      const c0 = tone(KL.me());
      swap(p, (c, q, u, glow) => {
        const L = q.len * (0.6 + 0.4 * Math.min(1, u * 3)), x = q.x + Math.cos(q.ang) * L * 0.5, y = q.y + Math.sin(q.ang) * L * 0.5;
        LK.piece(c, 'lance', x, y, q.ang, L * 1.05, L * LK.aspect('lance') * 1.6 * (1 - u * 0.6), 1 - u, c0, 0.5, { glow, g: 0.6 });
      });
    },
  };
  // the heaven's finale (js/heavenfx.js): a burst of light instead of the Blender impact; a swing's own ground ring and
  // spark (js/entities.js weaponHit, outside any skill): light
  function add(p) {
    const P = KL.me();
    if (!LK.scope() && P && P.atk && P.atk.on) {
      if (p.type === 'ring' && p.r1 >= 60) { LK.ring(p.x, p.y, { r0: p.r0, r1: p.r1, life: p.life || 0.4, col: tone(P), a: 0.7 }); return true; }
    }
    if (p.type === 'vheavenburst') {
      const s = p.s || 1.8;
      LK.pillar(p.x, p.y, { w: 70, h: 520, life: 0.55, col: '#fff0c8', impact: 1.4 });
      LK.ring(p.x, p.y, { r0: 20, r1: 220 * s / 1.8, life: 0.5, col: GOLD });
      if (has('shock')) LK.part({ n: 'shock', x: p.x, y: p.y - 40, rot: rand(0, TAU), len: 260, life: 0.3, a: 0.9, col: '#fff0c8', white: 0.4, g: 0.6, grow: (u) => 0.4 + 0.9 * u, fade: LK.out(1.3) });
      zoom(p.x, p.y - 40, 0.05, 0.3);
      return true;
    }
    return false;
  }
  // a plain melee hit: a thin light slash across the monster (a thrust: a short lance) + spikes in the job's colour
  function plainHit(e, r, h) {
    const c = tone(h.P), W = h.W, thrust = W && W.style === 'thrust', heavy = W && (W.twoHanded || W.style === 'smash');
    const ink = IL(h.P);
    if (ink) ink.dark({ n: thrust ? 'rg_vsmear' : 'rg_vslash', x: h.x, y: h.y + 6, rot: thrust ? (h.dir > 0 ? 0 : PI) : (h.dir > 0 ? 0.5 : PI - 0.5), flipY: !thrust && h.dir < 0, len: (heavy ? 190 : 150) * h.k, life: 0.26, a: 0.3, fade: LK.out(1.6) });
    if (thrust && has('lance')) LK.part({ n: 'lance', x: h.x, y: h.y, rot: h.dir > 0 ? 0 : PI, len: 120 * h.k, life: 0.14, a: 1, col: c, white: 0.5, g: 0.6, grow: (u) => 0.6 + 0.6 * u, fade: LK.out(1.4) });
    else if (has('slash_thin')) {
      const rot = (h.dir > 0 ? 0.5 : PI - 0.5) + rand(-0.3, 0.3);
      LK.part({ n: heavy ? 'slash_big' : 'slash_thin', x: h.x, y: h.y, rot, len: (heavy ? 170 : 130) * h.k, flipY: h.dir < 0,
        life: 0.16, a: 1, col: c, white: 0.55, g: 0.6, grow: (u) => 0.8 + 0.3 * u, fade: LK.out(1.4) });
    }
    LK.burst(h.x, h.y, { k: h.k * (heavy ? 0.7 : 0.55), col: c, n: r.crit ? 12 : 7, dir: h.dir, spark: 4, flash: !!(r.crit || heavy) });
  }

  KL = LK.lineSkin({
    name: 'KnightLight', param: 'knightlight', jobs: FAM, root: 'knight', map: MAP, swaps: SWAP, add, tone, plainHit, ghost: '#cfe4ff',
    ready: ['ring', 'glint', 'orb', 'soft', 'core', 'drop', 'slash_big', 'slash_thin', 'pillar'],
  });
})();
