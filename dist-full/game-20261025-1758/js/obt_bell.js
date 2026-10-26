/* obt_bell.js — the bellringer line's skills (the user, 2026-10-19: "เริ่มทำอาชีพและสกิลของ 3 สายนี้ ... ต่อเลย"). The jobs
   and their gear: js/obtjobs.js (unreleased catalog source).
     ผู้ตีระฆัง         TOLLS: every hit on a monster rings it (e.toll, 0–2); the third ring sends out a great sound ring
                        round it (br_toll) that may echo on to the next ones (br_echo) and leaves them dazed
     ผู้เฝ้าหอระฆัง     the guardian: a giant bell drops over him and takes the blows, calls every monster to him, bashes
                        with the bell-mouth shield, stores the blows as resonance, shelters the party under a bell
     ผู้ตีระฆังสุดท้าย  the finisher: hits harder on the wounded, a three-ring countdown that strikes by the life missing,
                        a last ring round every monster he finishes, the midnight bells that end the weak ones
   Effects (2026-10-20, the same way as ลังไม้กระแทก: "ทำสกิลที่เหลือของทั้ง 3 สายแบบเดียวกันเลย"): js/obt_vfx.js's kit X:
   rings and cones of sound and swooshes as painted frames played smoothly, giant bronze and black bells (high-res
   paintings) crashing down into quakes and dark blasts, shards, cracked and frosted rings on the ground, dizzy stars
   circling, the light kit's bronze / cold light and notes. Loaded after obt_doctor.js. */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC.JOBS.bellringer) return;
  const FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS, F = NC.OBTJOBS.fx, X = NC.OBTVFX;
  const { TAU } = K;
  const rand = NC.rand, S = K.S, alive = K.alive, lvOf = (p, id) => NC.skillLv(p, id);
  const r1 = (v) => Math.round(v * 10) / 10;
  const isJob = (p, j) => p && NC.isJob && NC.isJob(p, j);
  // (the painted sound arc bulges to the LEFT: flipped when he strikes to the right)
  const BRONZE = '255,200,110', SOUND = '170,235,255', IRON = '150,200,235';
  const HBRONZE = '#ffc86e', HSOUND = '#aaebff', HCOLD = '#9fe8ff';
  const SHARDS = 'hb_shard_';
  // sound is light + mesh, never frames (the user: "ตัวเสียง ... เเสง กับ mesh ... ไม่เอาเฟรม"): rings of sound racing along
  // the ground (rev: closing in) and cones of crescents rolling forward (js/obt_vfx.js X.soundRing / X.soundCone)
  const wave = (x, y, R, o) => {
    o = o || {};
    X.soundRing(NC.game, x, y, R, Object.assign({ col: o.dark ? 'dark' : 'sound' }, o));
    if (!o.dark && !o.rev) X.soundRing(NC.game, x, y, R * 0.6, { col: 'bronze', n: 1, a: (o.a || 1) * 0.8, haze: false, glints: false });
  };
  const cone = (x, y, ang, size, o) => X.soundCone(NC.game, x - Math.cos(ang) * 10, y + 50, ang, size, Object.assign({ h: 50 }, o || {}));
  // a giant bell crashing down: the high-res bell falling, a quake of painted frames, shards, a cracked ring, a ring of sound
  function bellFall(game, x, y, R, o) {
    o = o || {};
    X.drop(game, x, y, o.bell || 'hb_bell', { size: o.size || 200, H: o.H || 740, dur: o.dur || 0.28, land(lx, ly) {
      X.blast(game, lx, ly, R, { fr: o.fr || 'ob_quake', gold: !o.dark, light: o.light || 0.65, col: o.dark ? HCOLD : HBRONZE, dust: o.dark ? null : 'cs_puff_', dustO: { crown: 4, skirt: 10 },
        debris: [[SHARDS, o.shards || 8, { size: [16, 30], sp: [180, 520], up: [500, 900], spin: 16 }]], mark: [o.dark ? 'hb_frost' : 'hb_ringcrack', 1.5, o.markLife || 3], crack: !o.dark,
        shake: o.shake || 11, zoom: o.zoom === undefined ? 0.07 : o.zoom, sfx: [['boss_slam', 0.9], ['rel_bell', 1], ['ult_boom', o.boom || 0.4]] });
      wave(lx, ly, R * 1.15, { dark: o.dark, a: 0.6 });   // (three bells + gold light + bloom burnt white at full strength)
      if (o.stay) X.stay(o.bell || 'hb_bell', lx, ly, o.stay, { size: o.size || 200, dz: 8 });
      X.notes(lx, ly - 120, 4, o.dark ? HCOLD : HBRONZE);
      if (o.land) o.land(lx, ly);
    } });
  }

  // =====================================================================================================
  // tolls: two rings on a monster, the third one sends out the great sound ring
  // =====================================================================================================
  const tollOf = (e) => (e && e.toll ? e.toll : 0);
  function soundRing(game, p, x, y, k, from) {
    const lv = Math.max(1, lvOf(p, 'br_toll')), R = 150 + lv * 8;
    wave(x, y, R, { a: from ? 0.7 : 1 });
    X.hitFx(game, x, y - 60, { col: HBRONZE, k: from ? 0.7 : 1, notes: 3, sfx: [['rel_bell', from ? 0.4 : 0.7]] });
    // (in a pack every monster's third ring would go off at once and each ring hit them all: one ring's damage every
    // 0.2 s, the others only sound)
    if (game.time - (p.brRingT || -9) < 0.2) return;
    p.brRingT = game.time;
    const got = K.around(game, x, y, R);
    for (const e of got) {
      K.hit(game, p, 'br_toll', e, 0, 0, SOUND, k);
      if (Math.random() < 0.3 + lv * 0.02) K.stun(game, e, 0.5);
    }
    // the echo: on to the nearest ones outside (br_echo)
    const echo = lvOf(p, 'br_echo');
    if (echo && !from) {
      const next = K.nearest(game, x, y, R + 260, 6).filter((e) => !got.includes(e)).slice(0, echo >= 5 ? 2 : 1);
      next.forEach((e, i) => V.at(0.12 + i * 0.08, () => { if (alive(e)) soundRing(game, p, e.x, e.y, k * (0.4 + echo * 0.04), true); }));
    }
    V.shake(game, 3);
  }
  function ring(game, p, e, n) {
    if (!alive(e)) return;
    e.toll = tollOf(e) + n;
    X.emit([{ n: 'hb_silver', x: e.x + rand(-14, 14), y: e.y, z: 125, size: 30, s0: 1.5, s1: 1, grow: (u) => X.out(u * 4, 3), rot: rand(-0.3, 0.3), spin: rand(-3, 3), life: 0.4, erode: [0.5, 1] }]);
    while (e.toll >= 3) { e.toll -= 3; soundRing(game, p, e.x, e.y, 1); }
  }
  const ringer = (p) => isJob(p, 'bellringer');

  // =====================================================================================================
  // ผู้ตีระฆัง
  // =====================================================================================================
  K.def({
    br_strike: S({ name: 'ตีระฆัง', icon: 'sk_br_strike', free: 1, cd: 1, ro: 'a', sp: (lv) => 5 + Math.round(lv * 0.5), mul: (lv) => 2.3 + lv * 0.23,
      desc: (lv, m) => `ฟาดคทาระฆังใส่ข้างหน้า ${m}% ของ ATK เสียงระฆังติดตัวที่โดน 2 ครั้ง${lv >= 5 ? ' · โดนรอบ 120' : ''}${lv >= 10 ? ' · ติด 3 ครั้ง (ดังทันที)' : ''}` }),
    br_ring: S({ name: 'คลื่นเสียง', icon: 'sk_br_ring', cd: 4, ro: 'a', sp: (lv) => 14 + lv, mul: (lv) => 1.2 + lv * 0.12,
      desc: (lv, m) => `ตีระฆังส่งคลื่นเสียงรอบตัว 220 ${m}% ของ ATK กระเด็น เสียงระฆังติดทุกตัว 1 ครั้ง${lv >= 5 ? ' · สองคลื่น' : ''}` }),
    br_great: S({ name: 'ระฆังสามครา', icon: 'sk_br_great', ult: true, max: 5, cd: 45, sp: (lv) => 40 + lv * 4, mul: (lv) => 1.6 + lv * 0.3,
      desc: (lv, m) => `ระฆังยักษ์ตกลงที่เล็ง 3 ครั้ง ครั้งละ ${m}% ของ ATK รัศมี 260 ทุกครั้งเกิดคลื่นเสียง` }),
    br_toll: S({ name: 'กังวานที่สาม', icon: 'sk_br_toll', free: 1, pass: () => ({}), mul: (lv) => 1.2 + lv * 0.12,
      desc: (lv) => `เสียงระฆังครั้งที่สามบนมอนตัวเดียวกัน เกิดคลื่นเสียงรอบ ${150 + lv * 8} ${Math.round((1.2 + lv * 0.12) * 100)}% ของ ATK มึนได้ ${30 + lv * 2}%` }),
    br_echo: S({ name: 'เสียงสะท้อน', icon: 'sk_br_echo', pass: () => ({}),
      desc: (lv) => `คลื่นเสียงสะท้อนไปหามอนนอกวง ${lv >= 5 ? 2 : 1} ตัว แรง ${40 + lv * 4}%` }),
    br_daze: S({ name: 'มึนเสียง', icon: 'sk_br_daze', cd: 8, ro: 'u', sp: (lv) => 16 + lv, mul: (lv) => 0.8 + lv * 0.08,
      desc: (lv, m) => `ระฆังดังเป็นกรวยข้างหน้า 300 ${m}% ของ ATK มึน ${r1(1 + lv * 0.08)} วิ เดินช้า 3 วิ` }),
    br_rope: S({ name: 'เหวี่ยงเชือก', icon: 'sk_br_rope', cd: 5, ro: 'd', sp: (lv) => 12 + lv, mul: (lv) => 1.2 + lv * 0.12,
      desc: (lv, m) => `เหวี่ยงเชือกระฆังคล้องมอนตัวที่เล็ง (ไกล 450) ดึงมาข้างหน้า ${m}% ของ ATK เสียงระฆังติด 1${lv >= 5 ? ' · ดึงได้ 3 ตัว' : ''}` }),
    br_ears: S({ name: 'ที่ครอบหู', icon: 'sk_br_ears', pass: (lv) => ({ def: lv, mdef: lv, vit: lv >= 10 ? 3 : 0 }),
      desc: (lv) => `DEF +${lv} MDEF +${lv}${lv >= 10 ? ' · VIT +3' : ''}` }),
    br_beat: S({ name: 'จังหวะระฆัง', icon: 'sk_br_beat', pass: (lv) => ({ aspd: r1(lv * 0.8) }),
      desc: (lv) => `ตีปกติติดเสียงระฆัง 1 ครั้ง ${30 + lv * 4}% · ความเร็วโจมตี +${r1(lv * 0.8)}%` }),
    br_hum: S({ name: 'ฮัมเสียงต่ำ', icon: 'sk_br_hum', kind: 'buff', type: 'buff', cd: 30, sp: (lv) => 18 + lv * 2, rgb: SOUND, circle: 'star', dur: () => 30,
      buff: (lv) => ({ aspd: r1(lv * 1.2), hit: lv * 2 }),
      desc: (lv) => `30 วิ: ความเร็วโจมตี +${r1(lv * 1.2)}% HIT +${lv * 2}${lv >= 5 ? ' · ปาร์ตี้รอบตัวตีแรงขึ้น ' + lv + '%' : ''}` }),
  });
  for (const id of ['br_toll', 'br_echo', 'br_ears', 'br_beat']) { SK[id].active = false; SK[id].kind = 'passive'; }
  RUN.br_strike = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 0), 0.3);
    const got = lv >= 5 ? K.nova(game, p, 'br_strike', p.x + Math.cos(p.aim) * 90, p.y + Math.sin(p.aim) * 60, 120, { fx: false, kb: 160, color: BRONZE })
      : K.cone(game, p, 'br_strike', 170, 0.7, { kb: 160, color: BRONZE });
    const hx = p.x + Math.cos(p.aim) * 110, hy = p.y + Math.sin(p.aim) * 70;
    X.hitFx(game, hx, hy - 50, { col: HBRONZE, k: 1, arc: true, ang: p.aim, dir: Math.cos(p.aim) >= 0 ? 1 : -1, notes: 2, shake: 3, sfx: [['im_blunt', 0.6], ['rel_bell', 0.4]] });
    if (lv >= 5) wave(hx, hy, 120, { a: 0.8 });
    for (const e of got) ring(game, p, e, lv >= 10 ? 3 : 2);
  };
  RUN.br_ring = function (game, p, lv) {
    const waves = lv >= 5 ? 2 : 1;
    for (let i = 0; i < waves; i++) V.at(i * 0.3, () => {
      K.pose(game, p, K.clip(p, 'swing', 2), 0.3);
      wave(p.x, p.y, 235);
      const parts = []; X.puffs(parts, p.x, p.y, 'cs_puff_', { crown: 0, skirt: 8, s: 0.7 }); X.emit(parts);
      X.hitFx(game, p.x, p.y - 70, { col: HBRONZE, k: 1, notes: 4, sfx: [['rel_bell', 0.9], ['im_crush', 0.4]] });
      for (const e of K.nova(game, p, 'br_ring', p.x, p.y, 220, { fx: false, kb: 260, color: SOUND })) ring(game, p, e, 1);
      V.shake(game, 5);
    });
  };
  RUN.br_great = function (game, p, lv) {
    K.pose(game, p, 'cheer', 1);
    const [gx, gy] = K.ground(game, p, 520);
    X.dim(1.9, 0.3);
    X.sfx('ult_rise', p.x, 0.7);
    for (let i = 0; i < 3; i++) V.at(0.2 + i * 0.45, () => {
      bellFall(game, gx, gy, 260 + i * 20, { size: 210 + i * 25, stay: 0.4, shake: 11 + i * 2, zoom: 0.06 + i * 0.015, boom: 0.4 + i * 0.2, land(x, y) {
        for (const e of K.nova(game, p, 'br_great', x, y, 260, { fx: false, kb: 280, big: true })) ring(game, p, e, 1);
        soundRing(game, p, x, y, 0.8, true);
      } });
    });
  };
  RUN.br_daze = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 1), 0.3);
    const left = Math.cos(p.aim) < 0;
    cone(p.x + Math.cos(p.aim) * 30, p.y - 50 + Math.sin(p.aim) * 20, p.aim, 320, { s0: 0.9, s1: 1.1 });
    X.sfx('rel_bell', p.x, 0.8); X.sfx('ult_wave', p.x, 0.35);
    V.shake(game, 4);
    for (const e of K.cone(game, p, 'br_daze', 300, 0.6, { kb: 120, color: SOUND })) {
      K.stun(game, e, 1 + lv * 0.08); K.slow(e, 3);
      X.stars(e, 1 + lv * 0.08);
    }
  };
  RUN.br_rope = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 2), 0.32);
    const t = K.target(game, p, 450);
    const list = t ? [t].concat(lv >= 5 ? K.nearest(game, t.x, t.y, 200, 3).filter((e) => e !== t).slice(0, 2) : []) : [];
    for (const e of list) {
      X.lob(game, [p.x, p.y, 70], [e.x, e.y], 'hb_rope', { size: 54, H: 40, dur: 0.18, spin: 4, shadow: false, land() {
        if (!alive(e)) return;
        const fx = p.x + Math.cos(p.aim) * 90, fy = p.y + Math.sin(p.aim) * 60;
        if (NC.LightKit) NC.LightKit.line(e.x, e.y - 60, fx, fy - 60, { col: HBRONZE, life: 0.3, w: 8 });
        e.x += (fx - e.x) * 0.8; e.y += (fy - e.y) * 0.8;
        K.hit(game, p, 'br_rope', e, 0, 0, BRONZE);
        X.hitFx(game, e.x, e.y - 50, { col: HBRONZE, k: 0.9, shake: 3, sfx: [['sw_whip', 0.6]] });
        ring(game, p, e, 1);
      } });
    }
  };
  RUN.br_hum = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.45);
    K.startBuff(game, p, 'br_hum', lv, 30);
    X.buffFx(game, p, { col: HSOUND, notes: 6 });
    wave(p.x, p.y, 150, { a: 0.6 });
    if (lv >= 5) K.buffFriends(game, p, { dur: 30, atk: 1 + lv * 0.01, rgb: SOUND });
  };
  // every hit rings (br_beat: basic hits by chance; the line's skills ring by themselves)
  NC.basicHits.push((game, p, e) => {
    const lv = lvOf(p, 'br_beat');
    if (lv && ringer(p) && Math.random() < 0.3 + lv * 0.04) ring(game, p, e, 1);
  });
  // the rings over a monster: one small silver bell per ring
  FX.def('brmarks', (ctx) => {
    const g = NC.game;
    if (!g) return;
    for (const e of g.enemies) {
      const n = tollOf(e);
      if (!n || !alive(e)) continue;
      for (let i = 0; i < n; i++) { const x = e.x - (n - 1) * 10 + i * 20, y = e.y - 148 + Math.sin(g.time * 8 + i) * 2, r = Math.sin(g.time * 9 + i) * 0.25; if (!X.piece(ctx, 'hb_silver', x, y, 22, r)) F.piece(ctx, 'fx_silverbell', x, y, { scale: 0.75, rot: r }); }
    }
  }, 'glow');
  NC.skillTicks.push((game, p) => { if (ringer(p) && !FX.list.some((f) => f.type === 'brmarks')) FX.add({ type: 'brmarks', layer: 'glow', life: 1e9, x: 0, y: 0 }); });

  // =====================================================================================================
  // ผู้เฝ้าหอระฆัง
  // =====================================================================================================
  K.def({
    bw_dome: S({ name: 'ระฆังครอบ', icon: 'sk_bw_dome', free: 1, cd: 12, ro: 'u', sp: (lv) => 18 + lv * 2, mul: (lv) => 3 + lv * 0.3,
      desc: (lv, m) => `ระฆังยักษ์ตกครอบตัว ${3 + lv * 0.2} วิ: รับดาเมจลด 70% มอนรอบ 300 หันมาตีเรา จบแล้วระฆังดัง ${m}% ของ ATK + ดาเมจที่รับไว้ 20%` }),
    bw_call: S({ name: 'เสียงเรียก', icon: 'sk_bw_call', cd: 6, ro: 'u', sp: (lv) => 12 + lv,
      desc: (lv) => `ตีระฆังเรียกมอนรอบ ${300 + lv * 20} ให้หันมาตีเรา ${4 + lv * 0.3} วิ${lv >= 5 ? ' · มอนเดินเข้าหาเราเร็วขึ้น' : ''}` }),
    bw_bash: S({ name: 'โล่ปากระฆัง', icon: 'sk_bw_bash', cd: 4, ro: 'a', sp: (lv) => 12 + lv, mul: (lv) => 3.2 + lv * 0.32,
      desc: (lv, m) => `กระแทกโล่ปากระฆังข้างหน้า ${m}% ของ ATK + DEF×2 มึน 1 วิ${lv >= 5 ? ' · สะท้อนคลื่นเสียง' : ''}` }),
    bw_resonate: S({ name: 'กังวานโล่', icon: 'sk_bw_resonate', pass: (lv) => ({ def: lv * 2 }),
      desc: (lv) => `ทุกครั้งที่โดนตี สะสมกังวาน (สูงสุด 10) · ระฆังครอบและโล่ปากระฆังแรงขึ้นชั้นละ ${lv * 2}% แล้วกังวานหมด · DEF +${lv * 2}` }),
    bw_wall: S({ name: 'กำแพงเสียง', icon: 'sk_bw_wall', cd: 14, ro: 'z', roLife: 8, sp: (lv) => 20 + lv * 2,
      desc: (lv) => `กำแพงเสียงข้างหน้า 8 วิ: ปาร์ตี้หลังกำแพง (รอบตัวเรา 260) รับดาเมจลด ${10 + lv * 2}% มอนที่ผ่านกำแพงกระเด็น` }),
    bw_iron: S({ name: 'ร่างทองเหลือง', icon: 'sk_bw_iron', pass: (lv) => ({ hpPct: lv * 3, def: lv * 2, taken: lv >= 10 ? 5 : 0 }),
      desc: (lv) => `HP สูงสุด +${lv * 3}% DEF +${lv * 2}${lv >= 10 ? ' · รับดาเมจลด 5%' : ''}` }),
    bw_stand: S({ name: 'ยืนหยัด', icon: 'sk_bw_stand', kind: 'buff', type: 'buff', cd: 30, sp: (lv) => 18 + lv * 2, rgb: BRONZE, circle: 'holy', dur: () => 30,
      buff: (lv) => ({ def: lv * 3, mdef: lv * 2, hpReg: lv * 5 }),
      desc: (lv) => `30 วิ: DEF +${lv * 3} MDEF +${lv * 2} ฟื้น HP +${lv * 5}%` }),
    bw_guardian: S({ name: 'ระฆังพิทักษ์', icon: 'sk_bw_guardian', ult: true, max: 5, cd: 60, sp: (lv) => 45 + lv * 4,
      desc: (lv) => `ระฆังยักษ์ครอบทั้งปาร์ตี้ 6 วิ (รอบ 340): ทุกคนรับดาเมจลด ${40 + lv * 5}% จบแล้วระฆังดังกระแทกมอนรอบตัว` }),
  });
  for (const id of ['bw_resonate', 'bw_iron']) { SK[id].active = false; SK[id].kind = 'passive'; }
  // what a bell over him and the stance do to the blows; the resonance he stores (bw_resonate)
  NC.heroGuards.push((game, p, dmg, att) => {
    if (!isJob(p, 'bellward') && !(p.bwGuard > game.time)) return dmg;
    if (lvOf(p, 'bw_resonate')) p.bwRes = Math.min(10, (p.bwRes || 0) + 1);
    let k = 1;
    if (p.bwDome && p.bwDome.until > game.time) { k *= 0.3; p.bwDome.held += dmg * 0.7; }
    if (p.bwGuard > game.time) k *= 1 - (p.bwGuardK || 0);
    if (p.bwWall && p.bwWall.until > game.time) k *= 1 - p.bwWall.k;
    return dmg * k;
  });
  const resK = (p) => { const n = p.bwRes || 0, lv = lvOf(p, 'bw_resonate'); p.bwRes = 0; return 1 + n * lv * 0.02; };
  function taunt(game, p, R, dur) {
    for (const e of K.around(game, p.x, p.y, R)) { e.tgt = p; e.tgtLock = game.time + dur; }
  }
  RUN.bw_dome = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    const dur = 3 + lv * 0.2;
    p.bwDome = { until: game.time + dur, held: 0 };
    taunt(game, p, 300, dur);
    X.drop(game, p.x, p.y + 6, 'hb_bell', { size: 190, H: 560, dur: 0.2, dx: 0, land() {   // (the giant bell comes down over him, and stays)
      X.blast(game, p.x, p.y, 140, { fr: 'ob_quake', col: HBRONZE, light: 0.8, dust: 'cs_puff_', dustO: { crown: 2, skirt: 8 }, shake: 8, zoom: 0.05, sfx: [['boss_slam', 0.8], ['rel_bell', 0.9]] });
      X.stay('hb_bell', p.x, p.y + 10, dur - 0.2, { size: 190, follow: p, fy: 10, dz: 12, a: 0.92 });
    } });
    FX.add({ type: 'obtpiece', layer: 'none', x: p.x, y: p.y, life: dur, draw() {},
      onEnd() {
        const held = p.bwDome ? p.bwDome.held : 0;
        p.bwDome = null;
        wave(p.x, p.y, 280);
        X.blast(game, p.x, p.y, 240, { gold: true, col: HBRONZE, debris: [[SHARDS, 10, { size: [16, 30], sp: [200, 600], up: [500, 900], spin: 16 }]], shake: 10, zoom: 0.06,
          sfx: [['rel_bell', 1], ['ult_wave', 0.6], ['im_crush', 0.6]] });
        X.notes(p.x, p.y - 140, 5, HBRONZE);
        const extra = held ? (held * 0.2) / Math.max(1, (p.d && p.d.batk) || 100) / SK.bw_dome.mul(lv) : 0; // (a fifth of what the bell took, as a share of ATK)
        K.nova(game, p, 'bw_dome', p.x, p.y, 260, { rgb: BRONZE, kb: 300, mul: resK(p) + extra, big: true });
      } });
  };
  RUN.bw_call = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 2), 0.3);
    const R = 300 + lv * 20;
    taunt(game, p, R, 4 + lv * 0.3);
    wave(p.x, p.y, R, { rev: true, a: 0.9 });   // (the rings close in: it calls them)
    X.hitFx(game, p.x, p.y - 70, { col: HBRONZE, k: 0.9, notes: 4, sfx: [['rel_bell', 0.9]] });
    if (lv >= 5) for (const e of K.around(game, p.x, p.y, R)) K.pull(e, p.x, p.y, 380);
  };
  RUN.bw_bash = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 1), 0.3);
    const k = resK(p) * (1 + ((p.d && p.d.def) || 0) * 0.02);
    for (const e of K.cone(game, p, 'bw_bash', 190, 0.7, { kb: 320, color: BRONZE, mul: SK.bw_bash.mul(lv) * k, status: ['stun', 1] })) X.stars(e, 1);
    const hx = p.x + Math.cos(p.aim) * 110, hy = p.y + Math.sin(p.aim) * 70;
    X.hitFx(game, hx, hy - 50, { col: HBRONZE, k: 1.3, arc: true, ang: p.aim, dir: Math.cos(p.aim) >= 0 ? 1 : -1, shake: 6, sfx: [['im_crush', 0.8], ['rel_bell', 0.6]] });
    const parts = []; X.debris(parts, hx, hy, SHARDS, 5, { dir: p.aim, spread: 0.8, size: [14, 24], sp: [200, 480], up: [300, 600] }); X.emit(parts);
    if (lv >= 5) cone(p.x + Math.cos(p.aim) * 40, p.y - 50, p.aim, 260);
  };
  RUN.bw_wall = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    const a = p.aim, x = p.x + Math.cos(a) * 150, y = p.y + Math.sin(a) * 100;
    p.bwWall = { until: game.time + 8, k: 0.1 + lv * 0.02 };
    // the wall of sound: a cone of painted sound rolling out from it every second while it stands
    for (let i = 0; i < 8; i++) V.at(i, () => {
      cone(x - Math.cos(a) * 70, y - 50, a, 230, { a: i ? 0.55 : 0.9 });
      if (NC.LightKit) NC.LightKit.ring(x, y, { r0: 20, r1: 120, life: 0.5, col: HSOUND, a: 0.4 });
    });
    X.sfx('rel_bell', x, 0.8); X.sfx('buff_shield', x, 0.6);
    K.buffFriends(game, p, { dur: 8, guard: 1 - (0.1 + lv * 0.02), rgb: SOUND, r: 260 });
    K.zone(game, p, 'bw_wall', x, y, 110, 8, 0.5, { rgb: SOUND, circle: false, glowA: 0.1, hits: false, each(e) { const k = K.push([x, y], e, 260); e.kbx += k[0]; e.kby += k[1]; } });
  };
  RUN.bw_stand = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    K.startBuff(game, p, 'bw_stand', lv, 30);
    X.buffFx(game, p, { col: HBRONZE, notes: 3, sfx: 'buff_shield', pieces: [SHARDS, 6, 22] });
  };
  RUN.bw_guardian = function (game, p, lv) {
    K.pose(game, p, 'cheer', 1);
    p.bwGuard = game.time + 6; p.bwGuardK = 0.4 + lv * 0.05;
    K.buffFriends(game, p, { dur: 6, guard: 1 - (0.4 + lv * 0.05), rgb: BRONZE, r: 340 });
    const x = p.x, y = p.y;
    X.dim(1.6, 0.3);
    X.sfx('ult_rise', x, 0.7);
    bellFall(game, x, y + 20, 340, { size: 420, H: 860, dur: 0.26, shards: 14, shake: 15, zoom: 0.1, boom: 0.8, markLife: 6.5, land() {
      V.flash(BRONZE, 0.08, 0.3);
      X.stay('hb_bell', x, y + 30, 5.6, { size: 420, a: 0.5, dz: 14 });   // (the giant bell over the party, see-through)
      if (NC.LightKit) for (let i = 0; i < 5; i++) V.at(i * 1.1, () => NC.LightKit.ring(x, y, { r0: 60, r1: 360, life: 0.7, col: HBRONZE, a: 0.35 }));
    } });
    FX.add({ type: 'obtpiece', layer: 'none', x, y, life: 6, draw() {},
      onEnd() {   // it rings out at the end
        wave(x, y, 400);
        X.blast(game, x, y, 340, { gold: true, col: HBRONZE, debris: [[SHARDS, 12, { size: [18, 32], sp: [250, 700], up: [600, 1000], spin: 16 }]], shake: 12, zoom: 0.07,
          sfx: [['rel_bell', 1], ['ult_wave', 0.8], ['boss_slam', 0.6]] });
        X.notes(x, y - 160, 8, HBRONZE);
        K.nova(game, p, 'bw_guardian', x, y, 340, { fx: false, kb: 340, mul: 3 + lv * 0.5, big: true });
      } });
  };

  // =====================================================================================================
  // ผู้ตีระฆังสุดท้าย
  // =====================================================================================================
  const lowK = (e, t) => (e && e.maxHp ? 1 - e.hp / e.maxHp : 0) * t; // the more it has lost, the more it takes
  K.def({
    ltl_knell: S({ name: 'ตีระฆังมรณะ', icon: 'sk_ltl_knell', free: 1, cd: 1, ro: 'a', sp: (lv) => 6 + Math.round(lv * 0.6), mul: (lv) => 3 + lv * 0.3,
      desc: (lv, m) => `ฟาดระฆังเหล็กดำ ${m}% ของ ATK ตัวที่ HP ต่ำกว่า 30% โดน ×2${lv >= 5 ? ' · โดนรอบ 140' : ''}` }),
    ltl_count: S({ name: 'นับถอยหลัง', icon: 'sk_ltl_count', cd: 5, ro: 'a', sp: (lv) => 14 + lv, mul: (lv) => 3 + lv * 0.3,
      desc: (lv, m) => `ผูกระฆังสามใบไว้บนมอนตัวที่เล็ง ดังทีละใบทุกวินาที ใบที่สามตี ${m}% ของ ATK + ${30 + lv * 5}% ต่อทุก 10% ของ HP ที่หายไป` }),
    ltl_final: S({ name: 'เสียงสุดท้าย', icon: 'sk_ltl_final', free: 1, pass: () => ({}), mul: (lv) => 0.8 + lv * 0.08,
      desc: (lv) => `มอนที่เราฆ่า ระฆังดังรอบตัวมัน 180 ${Math.round((0.8 + lv * 0.08) * 100)}% ของ ATK${lv >= 5 ? ' · มอนรอบ ๆ เดินช้า 2 วิ' : ''}` }),
    ltl_hush: S({ name: 'ความเงียบ', icon: 'sk_ltl_hush', cd: 10, ro: 'u', sp: (lv) => 16 + lv,
      desc: (lv) => `ความเงียบรอบ 280: มอนเดินช้า ${3 + lv * 0.3} วิ ครั้งต่อไปที่โดนเราตี คริแน่นอน` }),
    ltl_grave: S({ name: 'ระฆังเหล็กดำ', icon: 'sk_ltl_grave', pass: (lv, p) => (NC.wtypeOf && NC.wtypeOf(NC.weaponDef(p)) === 'hammer' ? { atk: lv * 2, critDmg: lv * 2 } : null),
      desc: (lv) => `ถือระฆังเหล็กดำหรือค้อน ATK +${lv * 2}% แรงคริ +${lv * 2}%` }),
    ltl_sweep: S({ name: 'กวาดระฆัง', icon: 'sk_ltl_sweep', cd: 3, ro: 'a', sp: (lv) => 14 + lv, mul: (lv) => 1.8 + lv * 0.18,
      desc: (lv, m) => `กวาดระฆังสองมือรอบตัว 200 ${m}% ของ ATK ตัวที่เลือดน้อยโดนแรงขึ้นตามเลือดที่หาย${lv >= 10 ? ' · กวาดกลับอีกรอบ' : ''}` }),
    ltl_quiet: S({ name: 'ใจนิ่ง', icon: 'sk_ltl_quiet', pass: (lv) => ({ crit: r1(lv * 0.5), hit: lv }),
      desc: (lv) => `คริ +${r1(lv * 0.5)} HIT +${lv}` }),
    ltl_midnight: S({ name: 'ระฆังเที่ยงคืน', icon: 'sk_ltl_midnight', ult: true, max: 5, cd: 50, sp: (lv) => 45 + lv * 4, mul: (lv) => 1.2 + lv * 0.2,
      desc: (lv, m) => `ระฆัง 12 ใบดังทั่วจอทีละใบ (รอบ 700) แต่ละใบตีมอนที่ใกล้ที่สุด ${m}% ของ ATK · มอนที่ HP ต่ำกว่า ${8 + lv * 2}% ล้มทันที (ไม่ใช่บอส)` }),
  });
  for (const id of ['ltl_final', 'ltl_grave', 'ltl_quiet']) { SK[id].active = false; SK[id].kind = 'passive'; }
  RUN.ltl_knell = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'smash', 0) || K.clip(p, 'swing', 0), 0.34);
    const x = p.x + Math.cos(p.aim) * 100, y = p.y + Math.sin(p.aim) * 70;
    const list = lv >= 5 ? K.around(game, x, y, 140) : K.nearest(game, p.x, p.y, 200, 1, p.aim, 0.8);
    for (const e of list) {
      const low = e.hp / e.maxHp < 0.3;
      K.hit(game, p, 'ltl_knell', e, Math.cos(p.aim) * 160, 0, IRON, low ? 2 : 1, { big: low });
      if (low) X.blast(game, e.x, e.y, 90, { fr: 'ob_knell_boom', col: HCOLD, light: 0.8, haze: false, shake: 6, sfx: [['ult_boom', 0.35]] });
    }
    X.hitFx(game, x, y - 50, { col: HCOLD, k: 1.1, arc: true, ang: p.aim, dir: Math.cos(p.aim) >= 0 ? 1 : -1, shake: 4, sfx: [['im_crush', 0.6], ['rel_bell', 0.4]] });
  };
  RUN.ltl_count = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 1), 0.3);
    const t = K.target(game, p, 520);
    if (!t) return;
    for (let i = 0; i < 3; i++) V.at(i + 0.05, () => {
      if (!alive(t)) return;
      X.emit([{ n: 'hb_silver', x: t.x - 24 + i * 24, y: t.y, z: 160, follow: t, size: 36, s0: 1.7, s1: 1, grow: (u) => X.out(u * 4, 3), rot: rand(-0.3, 0.3), spin: rand(-4, 4), life: 0.7, erode: [0.6, 1] }]);
      X.notes(t.x, t.y - 170, 2, HCOLD);
      X.sfx('rel_bell', t.x, 0.5 + i * 0.2);
      if (i < 2) return;
      // the third: the black bell comes down on it
      bellFall(game, t.x, t.y, 130, { bell: 'hb_black', size: 120, H: 620, dur: 0.22, dark: true, fr: 'ob_knell_boom', shards: 6, shake: 9, zoom: 0.06, land() {
        if (!alive(t)) return;
        const steps = Math.floor((1 - t.hp / t.maxHp) * 10);
        K.hit(game, p, 'ltl_count', t, 0, 0, IRON, 1 + steps * (0.3 + lv * 0.05), { big: true });
      } });
    });
  };
  // เสียงสุดท้าย: a monster he finishes rings round itself
  const baseDE = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r) {
    const was = alive(e), out = baseDE.apply(this, arguments), p = game.player;
    if (was && !alive(e) && p && isJob(p, 'lasttoll') && lvOf(p, 'ltl_final') && !e._ltlRang) {
      e._ltlRang = true;
      const lv = lvOf(p, 'ltl_final');
      V.at(0.05, () => {
        wave(e.x, e.y, 180, { dark: true });
        X.hitFx(game, e.x, e.y - 60, { col: HCOLD, k: 0.8, sfx: [['rel_bell', 0.5]] });
        for (const o of K.around(game, e.x, e.y, 180)) { K.hit(game, p, 'ltl_final', o, 0, 0, IRON); if (lv >= 5) K.slow(o, 2); }
      });
    }
    if (e && e.hush && alive(e) && r && !r.miss && game.player && e.hush > game.time) e.hush = 0;
    return out;
  };
  RUN.ltl_hush = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.35);
    wave(p.x, p.y, 290, { dark: true, rev: true });   // (the cold rings close in: everything goes quiet)
    const parts = []; X.mark(parts, 'hb_frost', p.x, p.y, 300, 2.4); X.emit(parts);
    X.glints(p.x, p.y - 40, 12, HCOLD, { up: true, w: 200, sp: [40, 140], life: 1.4 });
    X.sfx('st_freeze', p.x, 0.5);
    for (const e of K.around(game, p.x, p.y, 280)) { K.slow(e, 3 + lv * 0.3); e.hush = game.time + 10; X.glints(e.x, e.y - 80, 3, HCOLD, { up: true, sp: [30, 90] }); }
  };
  // a hushed monster: his next hit on it is a sure critical
  const baseHH = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const g = NC.game, p = g && g.player;
    if (p && d === p.d && e && e.hush > g.time && isJob(p, 'lasttoll')) o = Object.assign({}, o, { crit: true });
    return baseHH.call(this, d, e, o);
  };
  RUN.ltl_sweep = function (game, p, lv) {
    const n = lv >= 10 ? 2 : 1;
    for (let i = 0; i < n; i++) V.at(i * 0.3, () => {
      K.pose(game, p, K.clip(p, 'smash', 1) || K.clip(p, 'swing', 1), 0.32);
      if (!X.frames('ob_whirl_dark', p.x, p.y - 50, 420, { add: true, follow: p, flip: i % 2 === 1, speed: 1.1, s0: 0.95, s1: 1.12, erode: [0.72, 1] }) && NC.LightKit) NC.LightKit.ring(p.x, p.y, { r0: 40, r1: 210, life: 0.35, col: HCOLD, a: 0.8 });
      X.glints(p.x, p.y - 50, 9, HCOLD, { sp: [420, 820] });
      for (const e of K.around(game, p.x, p.y, 200)) { K.hit(game, p, 'ltl_sweep', e, ...K.push([p.x, p.y], e, 220), IRON, 1 + lowK(e, 1)); X.hitFx(game, e.x, e.y - 50, { col: HCOLD, k: 0.7, spark: 2 }); }
      V.shake(game, 5);
      X.sfx('sw_spin', p.x, 0.8);
    });
  };
  RUN.ltl_midnight = function (game, p, lv) {
    K.pose(game, p, 'cheer', 1.2);
    X.dim(3.1, 0.42);
    V.flash(IRON, 0.08, 0.4);
    X.sfx('ult_rise', p.x, 0.7);
    for (let i = 0; i < 12; i++) V.at(0.2 + i * 0.17, () => {
      const left = K.around(game, p.x, p.y, 700).filter(alive);
      const e = left.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      const a = (i / 12) * TAU, bx = e ? e.x : p.x + Math.cos(a) * 400, by = e ? e.y : p.y + Math.sin(a) * 260;
      X.drop(game, bx, by, 'hb_black', { size: 104, H: 660, dur: 0.2, land(x, y) {
        X.blast(game, x, y, 110, { fr: 'ob_knell_boom', col: HCOLD, light: 0.7, haze: false, debris: [[SHARDS, 3, { size: [12, 22], sp: [150, 400], up: [400, 700] }]],
          mark: ['hb_frost', 1.3, 2], shake: 4, sfx: [['rel_bell', 0.7], ['im_crush', 0.5]] });
        if (!e || !alive(e)) return;
        K.hit(game, p, 'ltl_midnight', e, 0, 0, IRON, 1, { big: true });
        if (alive(e) && !e.boss && e.hp / e.maxHp < 0.08 + lv * 0.02) K.hit(game, p, 'ltl_midnight', e, 0, 0, IRON, 50, { sure: true });
      } });
    });
    V.at(2.45, () => {   // midnight: the last cold ring over everything
      wave(p.x, p.y, 700, { dark: true });
      if (NC.LightKit) NC.LightKit.burst(p.x, p.y - 80, { k: 1.4, col: HCOLD, n: 14, spark: 12 });
      X.punch(game, p.x, p.y, 12, 0.07);
      X.sfx('ult_wave', p.x, 0.9); X.sfx('rel_bell', p.x, 1); X.sfx('ult_boom', p.x, 0.5);
    });
  };

  // =====================================================================================================
  // lines, the skill lists, the weapon rules
  // =====================================================================================================
  const LINES = {
    bellringer: [['toll', 'เสียงระฆัง', 'neutral', null, 0], ['echo', 'เสียงสะท้อน', 'neutral', null, 0], ['rope', 'เชือกระฆัง', 'neutral', null, 1]],
    bellward: [['ward', 'ระฆังพิทักษ์', 'neutral', 'toll', 0], ['shield', 'โล่ปากระฆัง', 'neutral', 'rope', 1], ['wall', 'กำแพงเสียง', 'neutral', 'echo', 0]],
    lasttoll: [['knell', 'ระฆังมรณะ', 'neutral', 'toll', 0], ['hush', 'ความเงียบ', 'neutral', 'echo', 0], ['iron', 'เหล็กดำ', 'neutral', 'rope', 1]],
  };
  const PLAN = {
    bellringer: [
      ['br_strike', 'toll', 10, 1, [], 'Lv5 โดนรอบตัว · Lv10 ติดเสียง 3 ครั้ง'],
      ['br_ring', 'toll', 10, 0, [['br_strike', 3]], 'Lv5 สองคลื่น'],
      ['br_great', 'toll', 5, 0, [['br_ring', 3], ['br_toll', 5]], 'ระฆังยักษ์ตกสามครั้ง'],
      ['br_toll', 'echo', 10, 1, [], 'คลื่นเสียงใหญ่และแรงขึ้น มึนได้'],
      ['br_echo', 'echo', 10, 0, [['br_toll', 3]], 'Lv5 สะท้อน 2 ตัว'],
      ['br_daze', 'echo', 10, 0, [['br_toll', 3]], 'มึนและช้าเป็นกรวย'],
      ['br_beat', 'rope', 10, 0, [], 'ตีปกติติดเสียงระฆัง'],
      ['br_rope', 'rope', 10, 0, [['br_beat', 3]], 'Lv5 ดึงได้ 3 ตัว'],
      ['br_ears', 'rope', 10, 0, [], 'Lv10 VIT +3'],
      ['br_hum', 'rope', 10, 0, [['br_beat', 5]], 'Lv5 ปาร์ตี้ตีแรงขึ้น'],
    ],
    bellward: [
      ['bw_dome', 'ward', 10, 1, [], 'ครอบนานขึ้น ระฆังดังแรงขึ้น'],
      ['bw_call', 'ward', 10, 0, [['bw_dome', 1]], 'Lv5 ดึงมอนเข้าหา'],
      ['bw_guardian', 'ward', 5, 0, [['bw_dome', 5], ['bw_wall', 3]], 'ครอบทั้งปาร์ตี้'],
      ['bw_bash', 'shield', 10, 0, [], 'Lv5 สะท้อนคลื่นเสียง'],
      ['bw_resonate', 'shield', 10, 1, [], 'โดนตีสะสมกังวาน'],
      ['bw_stand', 'shield', 10, 0, [['bw_resonate', 3]], 'DEF MDEF ฟื้น HP'],
      ['bw_wall', 'wall', 10, 0, [], 'ปาร์ตี้หลังกำแพงรับดาเมจลด'],
      ['bw_iron', 'wall', 10, 0, [], 'Lv10 รับดาเมจลด 5%'],
    ],
    lasttoll: [
      ['ltl_knell', 'knell', 10, 1, [], 'Lv5 โดนรอบตัว'],
      ['ltl_count', 'knell', 10, 0, [['ltl_knell', 3]], 'ยิ่งเลือดหายยิ่งแรง'],
      ['ltl_midnight', 'knell', 5, 0, [['ltl_count', 5], ['ltl_hush', 3]], 'ระฆัง 12 ใบ ปิดท้ายตัวเลือดน้อย'],
      ['ltl_hush', 'hush', 10, 0, [], 'ช้า คริแน่นอนครั้งต่อไป'],
      ['ltl_final', 'hush', 10, 1, [], 'Lv5 มอนรอบ ๆ ช้า'],
      ['ltl_quiet', 'hush', 10, 0, [['ltl_final', 3]], 'คริ HIT เพิ่ม'],
      ['ltl_sweep', 'iron', 10, 0, [], 'Lv10 กวาดกลับอีกรอบ'],
      ['ltl_grave', 'iron', 10, 0, [], 'ATK แรงคริเพิ่ม'],
    ],
  };
  for (const job in PLAN) {
    const J = NC.JOBS[job];
    J.lines = LINES[job].map(([id, name, el, parent, auto]) => ({ id, name, el, parent: parent || null, auto: !!auto }));
    J.skills = PLAN[job].map((r) => r[0]).concat(J.tier === 1 ? NC.SHARED_SKILLS : []);
    for (const [id, line, max, free, req, grow] of PLAN[job]) {
      const Sk = SK[id];
      if (!Sk) continue;
      Sk.line = line; Sk.max = max; Sk.free = free; Sk.grow = grow;
      Sk.req = req.filter(([r]) => SK[r]);
    }
  }
  if (NC.weaponRule) {
    for (const id of ['br_strike', 'br_ring', 'br_daze', 'bw_bash']) NC.weaponRule(id, 'n:mace');
    for (const id of ['ltl_knell', 'ltl_sweep']) NC.weaponRule(id, 'n:hammer');
  }
  NC.OBT_BELL = { ring, tollOf };
})();
