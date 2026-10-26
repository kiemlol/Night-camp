/* magelight.js — the MAGE LINE made of light (2026-10-19, the user: "ทำสายนักเวทเป็นแสงต่อ ทุกอาชีพในสาย แล้วถ่ายคลิปมาดู" ...
   "นักเวทไม่ต้องเเก้ ice mage นะ เขาทำดีเเล้ว เเก้อันอื่นเลย"), on js/lightkit.js (LK.lineSkin).
   After the clip of the whole line (the user: "จากที่ดูทั้งหมดของเมจ ผมว่าเปลี่ยนเเค่เมจไฟ ก็พอ อันอื่นใช้อันเดิม"):
   ONLY จอมเวทไฟ and its class 3 จอมเวทดาวฤกษ์ (starcore, same fm_ skills) are light, every spell they cast, the
   1st-job ones too. จอมเวท, อาร์คเมจ, วอร์ล็อกตะเกียง, จอมเวทน้ำแข็ง and their class 3 keep the looks they had.
   (The archmage / warlock conversions below stay in the file but no job of theirs takes them.)
   Every skill keeps its own code and numbers. While a skill of the line runs, the painted looks of emberfx.js /
   arcanefx.js / warlockfx.js step aside (offs), so the skill takes its code-drawn path, and that becomes light:
   - the holy skin's conversions (columns, waves, sigils, glints, drops, spikes, lines, bolts, cracks, dust ...), in each
     effect's own colour, plus: flames -> painted flames of light (fire orange, soul teal, shadow violet), spikes -> lances of
     light rising, big flares -> a spell blast (6 painted frames) + a shockwave, target marks -> a small sigil;
   - drawers of projectiles and lasting looks run with their primitives swapped for light (prims): V.glow -> a soft glow,
     V.flame -> a painted flame, V.rock -> a painted meteor, V.skull -> a shadow wisp, V.blob (the thunder cloud) -> soft
     dust, K.drawOrb -> an orb of light with a glint, K.drawGhost -> a soul wisp; the same swaps hold for the line's lasting
     drawers anywhere (orbiting element orbs, the trinity, the souls, the astral planets) while the local hero is of the line;
   - the basic attack: the staff's bolt -> a missile of light in the job's colour (orange with the fire mage's orb fire),
     with a trail of drops, a flare at the tip and a burst on the hit.
   Switch: ESC → ตั้งค่า "สายนักเวท" (js/hitstyle.js row 'mage', NC.MageLight.on); ?magelight=1 / 0 forces it.
   Load after every file of the line (emberfx, arcanefx, warlockfx, class 3) and before js/hitstyle.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, LK = NC.LightKit, K = NC.SkillKit;
  if (!FX || !V || !LK || !LK.lineSkin || !K) return;
  let ML = null;   // (NC.MageLight: made by LK.lineSkin below)
  const MAN = NC.ASSET_MANIFEST_LIGHTKIT || {};
  const rand = NC.rand, PI = Math.PI, TAU = PI * 2;
  const FAM = ['firemage', 'starcore'];   // (the root is the fire mage: the rest of the mage line keeps its looks)
  const isJob = (p, j) => !!p && (p.job === j || (NC.isJob ? NC.isJob(p, j) : false));
  const has = (n) => !!MAN[n] && LK.ready(n);
  // (deep colours: light pieces add up, a pale orange piled up white; a deep one piles up yellow-orange like fire)
  const VIO = '#b98cff', ARC = '#8ccfff', TEALC = '#5ae8d0', FIRE = '#ff6a20', SUN = '#ff9a30', ASTRAL = '#c49cff', HEX = '#6cf0c8';
  const tone = (p) => (isJob(p, 'starcore') ? SUN : isJob(p, 'firemage') ? FIRE : isJob(p, 'hexlord') ? HEX : isJob(p, 'warlock') ? TEALC
    : isJob(p, 'astral') ? ASTRAL : isJob(p, 'archmage') ? ARC : VIO);
  const col = (rgb, w) => LK.hex(rgb || '200,170,255', w === undefined ? 0.15 : w);
  // a fire colour ('r,g,b': red high, green middling, little blue; not the hex's pink)
  const isFire = (rgb) => { const v = String(rgb || '').split(',').map(Number); return v.length === 3 && v[0] >= 230 && v[1] >= 90 && v[1] <= 205 && v[2] <= 130; };
  const zoom = (x, y, k, d) => { if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(x, y, k, d); };
  const live = () => ML && ML.live();
  const mine = () => live() && ML.fam(ML.me());
  // a palette (V.PAL arrays) -> the light's colour
  const palCol = (pal) => {
    if (!pal) return FIRE;   // (a fire palette and anything not matched below)
    const m = pal[1] || '';
    if (m === '#5ae8d6' || m === '#5ff0d2') return TEALC;
    if (m === '#7a4ab8' || m === '#ff3d6e') return '#c69aff';
    if (m === '#bfeaff') return '#78c4ff';   // (ice: a deep blue, a pale one piled up white)
    if (m === '#ffe68a') return '#ffe08a';
    if (m === '#9ff09a') return '#b8ffb0';
    if (m === '#e0335a') return '#ff7090';
    return FIRE;
  };

  // =====================================================================================================
  // drawing primitives as light (inside a drawer)
  // =====================================================================================================
  const PR = {
    glow: (c, x, y, r, rgb, a) => LK.piece(c, 'soft', x, y, 0, r * 2.2, r * 2.2 * LK.aspect('soft'), Math.min(1, (a || 0.6) * 0.45), col(rgb, 0), 0),
    flame: (c, x, y, w, h, ph, pal, a) => LK.piece(c, 'flame', x, y - h * 0.45, Math.sin((ph || 0) * 0.7) * 0.08, w * 1.35, h * 1.2, (a === undefined ? 1 : a) * 0.85, palCol(pal), 0.12),
    rock: (c, x, y, r, rot, seed, a) => LK.piece(c, 'orb', x, y, 0, r * 2.6, r * 2.6, (a === undefined ? 1 : a), '#ff9a40', 0.4),
    skull: (c, x, y, s, fill, a) => {
      LK.piece(c, 'shade', x, y, Math.sin(Date.now() / 300) * 0.1, s * 2.2, s * 2.2 * LK.aspect('shade'), a === undefined ? 1 : a, '#ff8ac0', 0.35);
      LK.piece(c, 'core', x, y + s * 0.3, 0, s * 1.4, s * 1.4, (a === undefined ? 1 : a) * 0.6, '#ff9ac8', 0.4);
    },
    blob: (c, x, y, r, seed, fill, a) => LK.piece(c, 'dust', x, y, (seed || 0) * 0.7, r * 2.6, r * 2.6 * LK.aspect('dust'), Math.min(1, (a || 0.8)) * 0.55, '#7a86b8', 0),
    orb: (c, x, y, r, rgb, core) => {
      const k = Math.max(10, r);
      LK.piece(c, 'soft', x, y, 0, k * 6, k * 6 * LK.aspect('soft'), 0.4, col(rgb, 0.1), 0);
      LK.piece(c, 'orb', x, y, 0, k * 3.2, k * 3.2 * LK.aspect('orb'), 1, col(rgb, 0.15), 0.55);
      LK.piece(c, 'glint', x, y, ((NC.game && NC.game.time) || 0) * 3 + x * 0.01, k * 3.4, k * 3.4 * LK.aspect('glint'), 0.7, col(rgb, 0.3), 0.4);
    },
    ghost: (c, x, y, s, t, rgb, a) => {
      LK.piece(c, 'shade', x, y - s * 0.4, Math.sin((t || 0) * 4) * 0.15, s * 3.4, s * 3.4 * LK.aspect('shade'), (a === undefined ? 1 : a) * 0.95, col(rgb, 0.15), 0.3);
      LK.piece(c, 'orb', x, y + s * 0.4, 0, s * 1.9, s * 1.9, (a === undefined ? 1 : a) * 0.85, col(rgb, 0.3), 0.5);
    },
  };
  // run a drawer with the primitives swapped for light (each piece added as light)
  function prims(fn, self, args) {
    const s0 = { glow: V.glow, flame: V.flame, rock: V.rock, skull: V.skull, blob: V.blob, orb: K.drawOrb, ghost: K.drawGhost };
    const lit = (f) => function (c) { c.save(); c.globalCompositeOperation = 'lighter'; try { f.apply(null, arguments); } finally { c.restore(); } };
    V.glow = lit(PR.glow); V.flame = lit(PR.flame); V.rock = lit(PR.rock); V.skull = lit(PR.skull); K.drawOrb = lit(PR.orb); K.drawGhost = lit(PR.ghost);
    V.blob = function (c, x, y, r, seed, fill, a, hi) { if (fill === '#3a4468') return PR.blob(c, x, y, r, seed, fill, a); return s0.blob.apply(this, arguments); };
    try { return fn.apply(self, args); } finally { V.glow = s0.glow; V.flame = s0.flame; V.rock = s0.rock; V.skull = s0.skull; V.blob = s0.blob; K.drawOrb = s0.orb; K.drawGhost = s0.ghost; }
  }
  const litDraw = (p) => { const d0 = p.draw; if (d0 && !d0.lk) { p.draw = function () { return live() ? prims(d0, this, arguments) : d0.apply(this, arguments); }; p.draw.lk = true; } };
  // the line's lasting drawers drawn outside a skill (the element orbs, the trinity, the souls, the astral planets):
  // orbs and ghosts as light while the local hero is of the line
  const baseOrb = K.drawOrb, baseGhost = K.drawGhost, baseSkull = V.skull;
  K.drawOrb = function (c) { if (mine() && has('orb')) { c.save(); c.globalCompositeOperation = 'lighter'; try { PR.orb.apply(null, arguments); } finally { c.restore(); } return; } return baseOrb.apply(this, arguments); };
  K.drawGhost = function (c) { if (mine() && has('shade')) { c.save(); c.globalCompositeOperation = 'lighter'; try { PR.ghost.apply(null, arguments); } finally { c.restore(); } return; } return baseGhost.apply(this, arguments); };
  V.skull = function (c) { if (mine() && has('shade')) { c.save(); c.globalCompositeOperation = 'lighter'; try { PR.skull.apply(null, arguments); } finally { c.restore(); } return; } return baseSkull.apply(this, arguments); };

  // =====================================================================================================
  // the skin
  // =====================================================================================================
  const SOFT = new Set(['cast', 'tick', 'mg_memorize', 'wl_pact']);
  // a frame set played at (x, y) (the spell blast): o.k size, o.col tint (null: as painted, violet)
  function frames(n, x, y, o) {
    const A = MAN[n];
    if (!A || !LK.ready(n)) return;
    const life = A.frames.reduce((t, f) => t + f.d, 0) / 1000, k = o.k || 1, cum = [];
    let acc = 0;
    for (const f of A.frames) { cum.push(acc); acc += f.d / 1000; }
    LK.add({ x, y, life, draw(c, q, u, glow) {
      let i = 0;
      while (i < A.frames.length - 1 && q.t >= cum[i + 1]) i++;
      const F = A.frames[i], W = 300 * k;
      LK.piece(c, n, x, y, 0, W, (W * F.h) / F.w, 1, o.col || null, 0.25, { glow, frame: i, g: 0.55 });
    } });
    LK.nightLight(x, y, 260 * k, o.col || VIO, 0.8, life);
  }
  const MAP = LK.holyMap((kind, p, S) => {
    const t = S.tag;
    if (kind === 'beam') {
      const c = col(p.rgb, 0.2);
      if (SOFT.has(t) || (p.a !== undefined && p.a < 0.7) || p.life > 1.5) { LK.pillar(p.x, p.y, { w: p.w * 0.6, h: p.h, life: p.life, col: c, a: 0.5 }); return null; }
      const hot = isFire(p.rgb);   // (a fire column: a deep orange body, an orange core)
      LK.pillar(p.x, p.y, { w: p.w, h: p.h, life: p.life, col: hot ? FIRE : c, core: hot ? '#ffb070' : undefined, impact: Math.min(1.3, p.w / 70) });
      return null;
    }
    if (kind === 'flare' && p.r >= 90 && has('sblast')) {   // (a spell's blast: the painted frames + a shockwave)
      const k = Math.min(2.4, p.r / 110), fire = isFire(p.rgb), c = fire ? FIRE : col(p.rgb, 0.1);
      frames('sblast', p.x, p.y + 40, { k, col: fire ? '#ff8030' : c });
      if (has('shock')) LK.part({ n: 'shock', x: p.x, y: p.y, rot: rand(0, TAU), len: p.r * 1.3, life: 0.26, a: 0.8, col: c, white: 0.35, g: 0.6, grow: (u) => 0.4 + 0.9 * (1 - Math.pow(1 - u, 2.4)), fade: LK.out(1.3) });
      if (p.r >= 240) zoom(p.x, p.y, 0.04, 0.28);
      return null;
    }
    return undefined;
  });
  // flames (fire, soul teal, shadow) -> painted flames of light with the same flight
  MAP.vflame = (p) => {
    if (!has('flame')) return undefined;
    LK.asPart(p, 'flame', (p.w || 30) * 1.35, palCol(p.pal), { white: 0.15, a: 0.75, g: 0.55, fade: LK.inOut(0.1, 0.6) });
    p.wid = (p.h || 50) * 1.2; p.rot = rand(-0.08, 0.08); p.spin = 0;   // (len = its width, wid = its height: the flame points up)
    p.y -= (p.h || 50) * 0.45;   // (its x, y was the flame's foot)
    if (p.vy === undefined || p.vy === 0) p.vy = -50;
  };
  // standing spikes (ice, shadow) -> lances of light rising
  MAP.vspike = (p) => {
    if (!has('lance')) return undefined;
    const h = p.h || 90, c = palCol(p.pal);
    LK.part({ n: 'lance', x: p.x, y: p.y - h * 0.5, rot: -PI / 2 + (p.tilt || 0) * 0.5, len: h * 1.15, wid: h * 1.15 * LK.aspect('lance') * 1.2, life: p.life || 0.8, a: 0.75, col: c, white: 0.2, g: 0.45,
      grow: (u) => (u < 0.12 ? 0.3 + 0.7 * (u / 0.12) : 1), fade: LK.inOut(0.05, 0.4) });
    LK.nightLight(p.x, p.y, h, c, 0.5, p.life || 0.8);
    return null;
  };
  // a target mark on the ground (the meteor's landing) -> a small sigil
  MAP.vmark = (p) => { LK.sigil(p.x, p.y, { r: p.r || 100, life: p.life || 0.6, col: col(p.rgb, 0.1), spin: 2, a: 0.8 }); return null; };
  // projectiles: the meteor -> a painted meteor along its fall; the others: their drawer with light primitives
  MAP.vproj = (p) => {
    if (p.draw && p.trail && has('rock') && /V\.rock/.test(p.draw.toString())) {
      p.type = 'lk'; p.layer = 'glow';
      p.draw = (c, q, u, glow) => {
        const T = q.trail, a = T && T.length > 1 ? Math.atan2(T[T.length - 1][1] - T[0][1], T[T.length - 1][0] - T[0][0]) : PI / 2;
        LK.piece(c, 'rock', q.x - Math.cos(a) * 70, q.y - Math.sin(a) * 70, a, 230, 230 * LK.aspect('rock'), 1, null, 0.35, { glow, g: 0.7 });
      };
      return;
    }
    litDraw(p);
  };
  MAP.custom = (p) => { litDraw(p); };

  // =====================================================================================================
  // lasting looks swapped when they appear, the class-3 drawers
  // =====================================================================================================
  const SWAP = {
    // the element orbs round a target, the trinity: their drawers with light primitives (the faint orbit ring stays)
    j3orbs(p) { litDraw(p); return false; },
    j3trinity(p) { litDraw(p); return false; },
  };
  if (NC.C3) {
    const AX = NC.C3.jobs.astral;
    if (AX && AX.drawFront && !AX.drawFront.lk) { const f0 = AX.drawFront; AX.drawFront = function () { return live() ? prims(f0, this, arguments) : f0.apply(this, arguments); }; AX.drawFront.lk = true; }
  }

  // =====================================================================================================
  // the basic attack: the staff's bolt -> a missile of light
  // =====================================================================================================
  const BOLTMAP = Object.assign({}, MAP, { ring: (p) => { LK.burst(p.x, p.y, { k: 0.55, col: tone(ML.me()), n: 8, spark: 4 }); return null; } });
  let boltAt = -1;
  function add(p, L, put) {
    const G = NC.game, P = L.me();
    if (p.type === 'bolt' && has('missile')) {
      boltAt = G ? G.time : -1;
      const W = P && NC.ITEMS[P.equip.weapon], orbFire = isJob(P, 'firemage') && W && NC.wtypeOf && NC.wtypeOf(W) === 'orb';
      const c = orbFire ? FIRE : tone(P), up = p.update;
      let trail = 0;
      p.type = 'lk'; p.layer = 'glow';
      p.draw = (cx, q, u, glow) => {
        const ang = Math.atan2(q.vy, q.vx), k = q.big ? 1.3 : 1;
        LK.piece(cx, 'missile', q.x - Math.cos(ang) * 40 * k, q.y - Math.sin(ang) * 40 * k, ang, 130 * k, 130 * k * LK.aspect('missile'), 1, c, 0.5, { glow, g: 0.7 });
      };
      p.update = function (o, dt, game) {
        trail += dt;
        while (trail > 0.02) {
          trail -= 0.02;
          LK.part({ n: Math.random() < 0.3 ? 'glint' : 'drop', x: o.x + rand(-6, 6), y: o.y + rand(-6, 6), vx: -o.vx * 0.08 + rand(-30, 30), vy: -o.vy * 0.08 + rand(-30, 30), drag: 3,
            len: rand(9, 15), life: rand(0.18, 0.3), a: 0.85, col: c, white: 0.45, g: 0.6, tw: 36, ph: rand(0, 6) });
        }
        const self = this, args = arguments;
        return up ? LK.within(BOLTMAP, 'bolt', () => up.apply(self, args), P) : undefined;
      };
      put(p);
      return true;
    }
    if (p.type === 'ring' && p.color === '150,220,255' && G && G.time === boltAt) { LK.flare(p.x, p.y, { r: 34, col: tone(P), spikes: false }); return true; }
    return false;
  }

  MAP.__wk = 0.35; MAP.__ak = 0.8; BOLTMAP.__wk = 0.35; BOLTMAP.__ak = 0.8;   // (dense spells: less white-hot, a little softer)
  ML = LK.lineSkin({
    name: 'MageLight', param: 'magelight', jobs: FAM, root: 'firemage', map: MAP, swaps: SWAP, add, tone, ghost: '#d4b4ff',
    offs: [NC.EmberFX, NC.ArcaneFX, NC.WarlockFX].filter(Boolean),
    ready: ['ring', 'glint', 'orb', 'soft', 'core', 'drop', 'missile', 'flame', 'sblast'],
    plainSkip: (W) => W.style === 'bolt',   // (a staff's bolt is a missile of its own)
  });
})();
