/* archerlight.js — the whole ARCHER LINE made of light (2026-10-19, the user: "ทำสายธนูเป็นแสงต่อ ทุกอาชีพในสาย แล้วถ่ายคลิปมาดู"),
   on js/lightkit.js (LK.lineSkin: every skill, cast, hook, hit and class-3 effect of the line runs in the skin).
   The jobs: นักธนู, เรนเจอร์, นักล่าหมาป่า, นักกวี, มือปืน and their class 3 (พรานจันทร์เงียบ, จ่าฝูงจันทร์เต็มดวง,
   วาทยกรแห่งป่า, มือปืนเที่ยงคืน). Every skill keeps its own code and numbers; only the drawing changes:
   - while a skill of the line runs, the painted looks of maplefx.js / maplebow.js / archerfx.js step aside (offs), so the
     skill takes its code-drawn path, and that becomes light: the holy skin's conversions (columns, rings, sigils, glints,
     sparks, lines, bolts, dust ...) in each effect's own colour, plus the line's own painted pieces (assets/lightkit,
     round 5 'lk_bow'): arrows of light (a charged arrow with a wind ring for the gale / the charge), tracers for bullets,
     notes of light, falling stars, a spinning trap ring for a thrown trap, a beam of light for the starshot / the snipe
     (+ the charged-shot hit frames 'bowhit' where it lands), traps on the ground -> a ring of light with teeth, arrows
     stuck in the ground -> arrows of light, the hunter's mark / the outlaw's crosshair -> a painted reticle, a target mark
     -> a small sigil;
   - the basic attack: a bow's arrow -> an arrow of light with an arrow hit; a lute's note / a gun's bullet / a shotgun's
     pellets -> a note of light / tracers, the muzzle flash -> a painted muzzle flash.
   Not changed: the summons (the wolf, the hawk, the spirit wolves: creatures, js/petrig.js / js/petspine.js), leaves,
   the gauges over the head (the cylinder, the moons, the midnight clock), a hero wearing VOID COMET or REAPER GUN (the
   sets keep their own looks: o.skip).
   Switch: ESC → ตั้งค่า "สายธนู" (js/hitstyle.js row 'bow', NC.ArcherLight.on); ?archerlight=1 / 0 forces it.
   Load after every file of the line (maplefx, maplebow, archerfx, jobs3, class 3, voidcomet, reapergun) and before
   js/hitstyle.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, LK = NC.LightKit, K = NC.SkillKit;
  if (!FX || !V || !LK || !LK.lineSkin || !K) return;
  let AL = null;   // (NC.ArcherLight: made by LK.lineSkin below)
  const MAN = NC.ASSET_MANIFEST_LIGHTKIT || {};
  const rand = NC.rand, PI = Math.PI, TAU = PI * 2;
  const FAM = ['archer', 'ranger', 'wolfhunter', 'bard', 'gunslinger', 'moonsniper', 'packalpha', 'maestro', 'outlaw'];
  const isJob = (p, j) => !!p && (p.job === j || (NC.isJob ? NC.isJob(p, j) : false));
  const has = (n) => !!MAN[n] && LK.ready(n);
  const live = () => AL && AL.live();
  const me = () => NC.game && NC.game.player;
  // (deep colours: light pieces add up; pale ones piled up white)
  const GOLD = '#ffbe50', MINT = '#58f0a0', MOON = '#8cc4ff', ROSE = '#ff80c0', BRASS = '#ff9a40', SILVER = '#a8c8ff', SPIRIT = '#5ad8ff',
    MAESTRO = '#ffb848', RED = '#ff4a3a', WIND = '#7cf0b8';
  const tone = (p) => (isJob(p, 'outlaw') ? RED : isJob(p, 'maestro') ? MAESTRO : isJob(p, 'packalpha') ? SPIRIT : isJob(p, 'moonsniper') ? SILVER
    : isJob(p, 'gunslinger') ? BRASS : isJob(p, 'bard') ? ROSE : isJob(p, 'wolfhunter') ? MOON : isJob(p, 'ranger') ? MINT : GOLD);
  const col = (rgb, w) => LK.hex(rgb || '255,210,120', w === undefined ? 0.15 : w);
  const zoom = (x, y, k, d) => { if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(x, y, k, d); };
  const setOn = () => (NC.VoidComet && NC.VoidComet.on && NC.VoidComet.active) || (NC.ReaperGun && NC.ReaperGun.on && NC.ReaperGun.active);

  // =====================================================================================================
  // the line's pieces
  // =====================================================================================================
  // an arrow of light flying along (vx, vy): the head at (x, y), a faint streak behind
  function arrowAt(c, x, y, ang, L, hex, a, glow, big) {
    const n = big && has('carrow') ? 'carrow' : 'arrow';
    if (has('streak')) LK.piece(c, 'streak', x - Math.cos(ang) * L * 0.95, y - Math.sin(ang) * L * 0.95, ang, L * 1.2, L * 1.2 * LK.aspect('streak') * 1.2, a * 0.5, hex, 0.2, { glow, g: 0.5 });
    LK.piece(c, n, x - Math.cos(ang) * L * 0.45, y - Math.sin(ang) * L * 0.45, ang, L, L * LK.aspect(n) * 1.25, a, hex, 0.5, { glow, g: 0.7 });
  }
  function tracerAt(c, x, y, ang, L, hex, a, glow) {
    LK.piece(c, 'tracer', x - Math.cos(ang) * L * 0.42, y - Math.sin(ang) * L * 0.42, ang, L, L * LK.aspect('tracer') * 1.4, a, hex, 0.55, { glow, g: 0.7 });
    LK.piece(c, 'soft', x, y, 0, L * 0.5, L * 0.5 * LK.aspect('soft'), a * 0.4, hex, 0, { glow, g: 0.5 });
  }
  function noteAt(c, x, y, t, s, hex, a, glow, ph) {
    const n = (ph || 0) % 2 < 1 && has('notes2') ? 'notes2' : 'note', W = 44 * s;
    LK.piece(c, 'soft', x, y, 0, W * 1.6, W * 1.6 * LK.aspect('soft'), a * 0.35, hex, 0, { glow, g: 0.5 });
    LK.piece(c, n, x, y + Math.sin(t * 14) * 3, Math.sin(t * 8) * 0.22, W, W * LK.aspect(n), a, hex, 0.4, { glow, g: 0.7 });
  }
  function starAt(c, x, y, ang, sp, rot, s, hex, a, glow) {
    if (sp > 50 && has('comet')) LK.piece(c, 'comet', x - Math.cos(ang) * 50 * s, y - Math.sin(ang) * 50 * s, ang, 130 * s, 130 * s * LK.aspect('comet') * 1.4, a * 0.8, hex, 0.4, { glow, g: 0.6 });
    LK.piece(c, 'star5', x, y, rot, 44 * s, 44 * s * LK.aspect('star5'), a, hex, 0.5, { glow, g: 0.7 });
  }
  function orbAt(c, x, y, ang, sp, s, hex, a, glow) {
    if (sp > 50) LK.piece(c, 'streak', x - Math.cos(ang) * 40 * s, y - Math.sin(ang) * 40 * s, ang, 110 * s, 110 * s * LK.aspect('streak') * 1.6, a * 0.8, hex, 0.4, { glow, g: 0.6 });
    LK.piece(c, 'orb', x, y, 0, 40 * s, 40 * s * LK.aspect('orb'), a, hex, 0.55, { glow, g: 0.7 });
  }
  // an arrow's / a bullet's hit: the painted V of streaks along the flight + a few spikes
  function hitAt(x, y, ang, hex, k) {
    k = k || 1;
    if (has('ahit')) LK.part({ n: 'ahit', x: x + Math.cos(ang) * 30 * k, y: y + Math.sin(ang) * 30 * k, rot: ang, len: 120 * k, life: 0.16, a: 1, col: hex, white: 0.5, g: 0.6,
      grow: (u) => 0.7 + 0.5 * u, fade: LK.out(1.4) });
    LK.burst(x, y, { k: 0.45 * k, col: hex, n: 5, dir: Math.cos(ang) >= 0 ? 1 : -1, spark: 3 });
  }
  // the charged shot's hit frames (6 painted frames, the hit point as origin) at (x, y), turned along ang
  function bowHit(x, y, ang, hex, k) {
    const A = MAN.bowhit;
    if (!A || !LK.ready('bowhit')) return hitAt(x, y, ang, hex, k);
    const life = A.frames.reduce((t, f) => t + f.d, 0) / 1000, cum = [];
    let acc = 0;
    for (const f of A.frames) { cum.push(acc); acc += f.d / 1000; }
    const flip = Math.cos(ang) < 0, rot = flip ? ang - PI : ang;
    LK.add({ x, y, life, draw(c, q, u, glow) {
      let i = 0;
      while (i < A.frames.length - 1 && q.t >= cum[i + 1]) i++;
      const F = A.frames[i], W = 300 * (k || 1);
      c.save(); c.translate(x, y); c.rotate(rot); if (flip) c.scale(-1, 1);
      LK.piece(c, 'bowhit', 0, 0, 0, W, (W * F.h) / F.w, 1, hex, 0.3, { glow, frame: i, g: 0.6 });
      c.restore();
    } });
    LK.nightLight(x, y, 240 * (k || 1), hex, 0.8, life);
  }

  // =====================================================================================================
  // the skin
  // =====================================================================================================
  const SOFT = new Set(['cast', 'tick', 'rg_truesight', 'rg_focus', 'ar_concentrate', 'wh_howl', 'wh_frenzy', 'gs_special', 'bd_tempo', 'bd_warm', 'bd_stars', 'bd_firefly', 'bd_lure']);
  const ARROWS = new Set(['double', 'shower', 'gale', 'ar_charge', 'ar_multishot', 'rg_triple', 'rg_piercer', 'rg_storm', 'rg_fearbreeze', 'wh_fang', 'starshot', 'rg_snipe']);
  const BIG = new Set(['gale', 'ar_charge', 'rg_piercer', 'wh_fang']);
  const TRAPS = new Set(['ar_snare', 'rg_trap', 'rg_freezetrap']);
  const tagCol = (S) => {
    const t = S.tag || '';
    if (t === 'gale' || t === 'rg_piercer') return WIND;
    if (t === 'double' || t === 'shower' || t === 'starshot' || t === 'ar_charge' || t === 'ar_multishot') return GOLD;
    return tone(S.p || me());
  };
  // what a projectile of the line is: by the skill, else by the caster's job (a class-3 power-up's shards ...)
  let pending = null, pendingRgb = null;   // (what K.shot was asked to fire, told by its look / style: see K.shot below)
  function projKind(S, p) {
    const t = S.tag || '', P = S.p || me(), src = p.draw ? String(p.draw) : '';
    if (pending) return pending;
    if (TRAPS.has(t) && !p.trailPts) return 'trap';
    if (t === 'gs_stars' || t === 'ol_stars') return 'star';
    if (/drawBullet/.test(src) || /^gs_triple|^gs_ricochet|^ol_/.test(t)) return 'bullet';
    if (/drawNote|noteLook/.test(src) || /^bd_note|^bd_noterain|^mt_/.test(t)) return 'note';
    if (t === 'gs_smoke') return 'bomb';
    if (ARROWS.has(t) || /drawArrow/.test(src)) return 'arrow';
    if (isJob(P, 'gunslinger')) return 'bullet';
    if (isJob(P, 'bard')) return 'note';
    return 'arrow';
  }
  const MAP = LK.holyMap((kind, p, S) => {
    const t = S.tag;
    if (kind === 'beam') {
      const c = col(p.rgb, 0.2);
      if (SOFT.has(t) || (p.a !== undefined && p.a < 0.7) || p.life > 1.5) { LK.pillar(p.x, p.y, { w: p.w * 0.6, h: p.h, life: p.life, col: c, a: 0.5 }); return null; }
      LK.pillar(p.x, p.y, { w: p.w, h: p.h, life: p.life, col: c, impact: Math.min(1.3, p.w / 70) });
      return null;
    }
    if (kind === 'flare') {
      const c = col(p.rgb, 0.15);
      // (an arrow skill's hit: the painted V along the flight from the caster)
      if (p.r < 90 && ARROWS.has(t)) {
        const P = S.p || me(), ang = P ? Math.atan2(p.y - (P.y - 70), p.x - P.x) : 0;
        hitAt(p.x, p.y, ang, c, Math.max(0.7, Math.min(1.4, p.r / 60)));
        return null;
      }
      if (p.r >= 90 && has('shock')) {
        const k = Math.min(2.4, p.r / 110);
        LK.part({ n: 'shock', x: p.x, y: p.y, rot: rand(0, TAU), len: p.r * 1.3, life: 0.26, a: 0.85, col: c, white: 0.35, g: 0.6, grow: (u) => 0.4 + 0.9 * (1 - Math.pow(1 - u, 2.4)), fade: LK.out(1.3) });
        LK.burst(p.x, p.y, { k: k * 0.6, col: c, n: Math.round(5 + k * 3), spark: 4 });
        if (p.r >= 240) zoom(p.x, p.y, 0.04, 0.26);
        return null;
      }
    }
    return undefined;
  });
  // projectiles: a full light drawer by kind (arrows, tracers, notes, stars, a trap thrown, a bomb)
  MAP.vproj = (p, S) => {
    const kind = projKind(S, p), P = S.p || me(), hex = pending && pendingRgb ? col(pendingRgb, 0.1) : tagCol(S), big = BIG.has(S.tag), ph = rand(0, 6);
    const trap = TRAPS.has(S.tag) ? (S.tag === 'rg_freezetrap' ? '#78c8ff' : S.tag === 'ar_snare' ? '#7ce07a' : '#ffb050') : null;
    p.type = 'lk'; p.layer = 'glow';
    let lx = p.x, ly = p.y, ang = Math.atan2(p.vy || 0, p.vx || 1);
    p.draw = (c, q, u, glow) => {
      // (a lob moves by its update, not by vx: the angle from its last place)
      const dx = q.x - lx, dy = q.y - ly;
      if (!glow && dx * dx + dy * dy > 1) { ang = Math.atan2(dy, dx); lx = q.x; ly = q.y; }
      const A = ang, sp = Math.hypot(q.vx || 0, q.vy || 0) || 600;
      if (kind === 'arrow') return arrowAt(c, q.x, q.y, A, big ? 150 : 110, hex, 1, glow, big);
      if (kind === 'bullet') return tracerAt(c, q.x, q.y, A, 80, isJob(P, 'outlaw') ? RED : BRASS, 1, glow);
      if (kind === 'note') return noteAt(c, q.x, q.y, q.t + ph, 1.1, isJob(P, 'maestro') ? MAESTRO : ROSE, 1, glow, ph);
      if (kind === 'star') return starAt(c, q.x, q.y, A, sp, q.t * 8, 1.1, isJob(P, 'outlaw') ? '#ff8a60' : '#ffd070', 1, glow);
      if (kind === 'trap') {
        LK.piece(c, 'trapring', q.x, q.y, q.t * 10, 46, 46 * LK.aspect('trapring'), 1, trap, 0.45, { glow, g: 0.6 });
        return;
      }
      orbAt(c, q.x, q.y, A, sp, kind === 'bomb' ? 0.9 : 1, kind === 'bomb' ? '#c8b0ff' : hex, 1, glow);
    };
  };
  // the starshot's / the snipe's beam: a long beam of light along it, the hit frames at its end
  MAP.vlaser = (p, S) => {
    if (!has('mbeam')) return undefined;
    const hex = col(p.rgb, 0.2), L = p.len || 900, w = p.w || 40, c0 = Math.cos(p.ang || 0), s0 = Math.sin(p.ang || 0);
    LK.add({ x: p.x, y: p.y, life: p.life || 0.6, draw(c, q, u, glow) {
      const a = u < 0.1 ? u / 0.1 : 1 - Math.pow((u - 0.1) / 0.9, 1.4), len = L * Math.min(1, u / 0.08), ww = w * (0.5 + 0.5 * a);
      const mx = p.x + c0 * len * 0.5, my = p.y + s0 * len * 0.5;
      LK.piece(c, 'mbeam', mx, my, p.ang || 0, len * 1.08, ww * 2.4, a * 0.9, hex, 0.35, { glow, g: 0.6 });
      if (has('flare_h')) LK.piece(c, 'flare_h', mx, my, p.ang || 0, len * 1.2, ww * 1.2, a * 0.5, hex, 0.4, { glow, g: 0.5 });
      LK.piece(c, 'glint', p.x, p.y, q.t * 6, ww * 1.8, ww * 1.8 * LK.aspect('glint'), a * 0.7, hex, 0.35, { glow, g: 0.5 });
    } });
    V.at(0.05, () => bowHit(p.x + c0 * L * 0.55, p.y + s0 * L * 0.55, p.ang || 0, hex, 1.3));
    LK.nightLight(p.x + c0 * L * 0.5, p.y + s0 * L * 0.5, L * 0.6, hex, 0.7, p.life || 0.6);
    zoom(p.x + c0 * 200, p.y, 0.03, 0.2);
    return null;
  };
  // a target mark on the ground -> a small sigil
  MAP.vmark = (p) => { LK.sigil(p.x, p.y, { r: p.r || 90, life: p.life || 0.6, col: col(p.rgb, 0.1), spin: 2, a: 0.8 }); return null; };
  // an arrow stuck in the ground (the rain's arrows) -> an arrow of light standing in the ground, fading
  MAP.varrowin = (p, S) => {
    if (!has('arrow')) return undefined;
    const hex = tagCol(S), x = p.x, y = p.y, ang = p.ang || -PI / 2;
    LK.add({ x, y, life: Math.min(0.9, p.life || 1.2), layer: 'glow', draw(c, q, u, glow) {
      const a = u > 0.5 ? (1 - u) / 0.5 : 1;
      LK.piece(c, 'arrow', x - Math.cos(ang) * 30, y - Math.sin(ang) * 30, ang, 80, 80 * LK.aspect('arrow') * 1.25, a * 0.9, hex, 0.4, { glow, g: 0.6 });
    } });
    return null;
  };

  // =====================================================================================================
  // lasting looks swapped when they appear
  // =====================================================================================================
  const TRAPC = { freeze: '#78c8ff', snare: '#7ce07a' };
  const SWAP = {
    // a trap on the ground -> a ring of light with teeth, flat, breathing once armed
    vtrap(p, L) {
      if (!has('trapring')) return false;
      const hex = TRAPC[p.kind] || '#ffb050';
      L.swap(p, (c, q, u, glow) => {
        const a = Math.min(1, q.t / 0.25) * (u > 0.9 ? (1 - u) / 0.1 : 1), armed = q.t > 0.5;
        LK.piece(c, 'trapring', q.x, q.y, q.t * 0.6, 92, 92, a * (armed ? 0.75 + 0.25 * Math.sin(q.t * 6) : 0.6), hex, 0.35, { glow, g: 0.55, ground: true });
        if (armed) LK.piece(c, 'soft', q.x, q.y - 4, 0, 120, 120 * LK.aspect('soft'), a * 0.25, hex, 0, { glow, g: 0.4, ground: true });
      });
    },
    // the hunter's mark over a target -> the painted reticle, turning slowly
    vvuln(p, L) {
      if (!has('reticle')) return false;
      L.swap(p, (c, q, u, glow) => {
        const e = q.e;
        if (!e || !K.alive(e) || !(e.vuln && e.vuln.until > NC.game.time)) { q.dead = true; return; }
        const hex = col(e.vuln.rgb || '255,90,90', 0.1);
        LK.piece(c, 'reticle', e.x, e.y - 175, q.t * 0.8, 52, 52 * LK.aspect('reticle'), 0.75 + 0.25 * Math.sin(q.t * 6), hex, 0.45, { glow, g: 0.6 });
      });
    },
    // the outlaw's crosshair on a marked target
    c3cross(p, L) {
      if (!has('reticle')) return false;
      L.swap(p, (c, q, u, glow) => {
        const e = q.e, r = 40 - u * 12;
        if (!e) return;
        LK.piece(c, 'reticle', e.x, e.y - 60, u * 2, r * 2.6, r * 2.6 * LK.aspect('reticle'), 1 - u * 0.3, RED, 0.5, { glow, g: 0.7 });
      });
    },
  };

  // =====================================================================================================
  // the basic attack: a bow's arrow, a lute's note, a gun's bullet / pellets
  // =====================================================================================================
  let hitAng = 0, hitAt0 = -1;
  const ARROWMAP = Object.assign({}, MAP, {
    // (the arrow's hit: FX.sparks -> one painted hit along the flight, the rest dropped)
    spark: (p) => { const G = NC.game, now = G ? G.time : 0; if (now !== hitAt0) { hitAt0 = now; hitAt(p.x, p.y, hitAng, tone(me()), 0.8); } return null; },
  });
  let shotAng = 0;
  const SHOTMAP = Object.assign({}, MAP, {
    // the muzzle flash (V.glowAt hot at the gun's mouth) -> the painted muzzle flash along the shot
    vglow: (p) => {
      if (!p.hot || !has('muzzle')) return MAP.vglow(p);
      const L = (p.r1 || 44) * 1.9;
      LK.part({ n: 'muzzle', x: p.x + Math.cos(shotAng) * L * 0.3, y: p.y + Math.sin(shotAng) * L * 0.3, rot: shotAng, len: L, life: 0.09, a: 1, col: '#ffb060', white: 0.6, g: 0.7,
        grow: (u) => 0.8 + 0.4 * u, fade: LK.out(1.2) });
      LK.nightLight(p.x, p.y, 140, '#ffb060', 0.8, 0.1);
      return null;
    },
  });
  // a shot of jobs3 (the bolt it retyped while it was added) -> its light drawer
  function litShot(p) {
    const P = me(), j = P && isJob(P, 'outlaw');
    if (p.type === 'j3bullet' || p.type === 'j3pellet') {
      const pellet = p.type === 'j3pellet', hex = p.sixth ? '#ff5a3a' : j ? RED : BRASS;
      p.type = 'lk'; p.layer = 'glow';
      p.draw = (c, q, u, glow) => {
        const ang = Math.atan2(q.vy, q.vx);
        tracerAt(c, q.x, q.y, ang, pellet ? 60 : q.sixth ? 110 : 80, hex, 1, glow);
        if (pellet && q.fan) for (const o of [-1, 1]) { const a = ang + o * 0.16, d = q.t * 900; tracerAt(c, q.x0 + Math.cos(a) * d, q.y0 + Math.sin(a) * d, ang, 50, hex, 0.9, glow); }
      };
      return true;
    }
    if (p.type === 'j3note' && has('note')) {
      const hex = p.hue ? col(p.hue, 0.05) : ROSE, ph = rand(0, 6);
      p.type = 'lk'; p.layer = 'glow';
      p.draw = (c, q, u, glow) => noteAt(c, q.x, q.y, q.t, q.big ? 1.3 : 1, hex, 1, glow, ph);
      return true;
    }
    return false;
  }
  SWAP.j3note = SWAP.j3bullet = SWAP.j3pellet = (p) => (litShot(p) ? undefined : false);
  function add(p, L, put) {
    const G = NC.game, P = L.me(), W = P && NC.ITEMS[P.equip.weapon];
    const own = P && Math.hypot(p.x - P.x, p.y - P.y) < 260;   // (the hero's own shots: not another player's replayed ones)
    // a bow's arrow -> an arrow of light; its hit -> the painted hit
    if (p.type === 'arrow' && own && has('arrow') && !p.lkArrow) {
      p.lkArrow = true;
      const hex = tone(P), up = p.update;
      p.type = 'lk'; p.layer = 'glow';
      p.draw = (c, q, u, glow) => arrowAt(c, q.x, q.y, Math.atan2(q.vy, q.vx), q.big ? 140 : 120, hex, 1, glow, false);
      if (up) p.update = function (o) { hitAng = Math.atan2(o.vy, o.vx); const self = this, args = arguments; return LK.within(ARROWMAP, 'shot', () => up.apply(self, args), P); };
      put(p);
      return true;
    }
    // a lute's / a gun's bolt: jobs3 retypes it inside put (+ the muzzle flash, the pellets) -> all of it in light
    if (p.type === 'bolt' && own && W && W.shot && !p.lkShot) {
      p.lkShot = true;
      shotAng = Math.atan2(p.vy, p.vx);
      LK.within(SHOTMAP, 'shot', () => put(p), P);
      litShot(p);
      return true;
    }
    return false;
  }

  // the kit's shot inside a skill of the line: what it fires is told by its look (jobs3's bullet / note) or its style
  // (K.shot's own draw only says "o.look": the kind is noted while it is added)
  const shot0 = K.shot;
  const ours = () => { const S = LK.scope(); return !!S && (S.map === MAP || S.map === SHOTMAP || S.map === ARROWMAP); };
  K.shot = function (game, p, id, o) {
    if (!o || !ours()) return shot0.apply(this, arguments);
    const s = o.look ? String(o.look) : '';
    pending = o.look ? (/drawBullet/.test(s) ? 'bullet' : /drawNote|noteLook/.test(s) ? 'note' : /drawArrow/.test(s) ? 'arrow' : /drawStar/.test(s) ? 'star' : null)
      : o.style === 'star' ? 'star' : o.style === 'arrow' || o.style === 'blade' ? 'arrow' : 'orb';
    pendingRgb = o.rgb || null;
    try { return shot0.apply(this, arguments); } finally { pending = null; pendingRgb = null; }
  };

  // (arrows by the dozen, beams: less white-hot, a little softer, like the fire mage's spells)
  for (const M of [MAP, ARROWMAP, SHOTMAP]) { M.__wk = 0.5; M.__ak = 0.85; }
  AL = LK.lineSkin({
    name: 'ArcherLight', param: 'archerlight', jobs: FAM, root: 'archer', map: MAP, swaps: SWAP, add, tone, ghost: '#bfe8d0',
    offs: [NC.MapleFX, NC.ArcherFX].filter(Boolean), skip: () => setOn(),
    ready: ['ring', 'glint', 'orb', 'soft', 'core', 'drop', 'arrow', 'carrow', 'tracer', 'ahit', 'streak'],
    plainSkip: (W) => W.style === 'bolt',
  });
})();
