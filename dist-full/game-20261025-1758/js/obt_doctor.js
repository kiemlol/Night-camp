/* obt_doctor.js — the crow-mask doctor line's skills (the user, 2026-10-19: "เริ่มทำอาชีพและสกิลของ 3 สายนี้ ... ต่อเลย").
   The jobs and their gear: js/obtjobs.js (unreleased catalog source).
     หมอหน้ากากกา   ONE flask does both: where it breaks, friends are healed and monsters poisoned. Monsters it touches get
                    ไข้ (fever, e.fever: 1–5 stacks, a tick of damage a second each); a fevered monster that falls passes
                    its fever on to the ones next to it
     หมอยาราตรี     the healer: a glowing flask that bounces from friend to friend, a herb patch, a bubble that soaks hits,
                    a draught that keeps a friend from falling, the healing rain
     ผู้หว่านโรค     the poisoner: clouds, scattered bottles, fever that spreads on hits too (up to 8 stacks), then
                    โรคระบาด bursts every stack on screen at once
   Effects (2026-10-20, the same way as ลังไม้กระแทก: "ทำสกิลที่เหลือของทั้ง 3 สายแบบเดียวกันเลย"): js/obt_vfx.js's kit X:
   high-res flasks thrown, shattering into glass, drops and a toxic blast of painted frames; poison clouds of painted puffs
   that bloom, churn and dissolve; geysers and the giant plague blast; healing as the light kit's mint light; herbs growing.
   Loaded after obt_merchant.js, before rotiming.js. */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC.JOBS.crowdoc) return;
  const FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS, F = NC.OBTJOBS.fx, X = NC.OBTVFX;
  const { TAU } = K;
  const rand = NC.rand, S = K.S, alive = K.alive, lvOf = (p, id) => NC.skillLv(p, id);
  const r1 = (v) => Math.round(v * 10) / 10;
  const isJob = (p, j) => p && NC.isJob && NC.isJob(p, j);
  const HERB = '140,235,150', MINT = '120,240,210', TOX = '200,230,70', VIO = '170,110,230';
  const HMINT = '#9dffd8', HTOX = '#c8e646', HVIO = '#b47cff', HTONIC = '#ff9a9a';
  const handFrom = (p) => { const h = K.hand(p); return [h[0], p.y, Math.max(0, p.y - h[1])]; };
  const zoneOff = { circle: false, glow: false };   // (K.zone's own drawn circle and glow off: the kit's paintings show it)
  // a toxic geyser under a spot (the fever bursting, the plague field): the painted frames + puffs + drops
  const geyser = (game, x, y, R, o) => X.blast(game, x, y, R, Object.assign({ fr: 'ob_tox_erupt', frK: 2.1, col: HTOX, light: 0.7, dust: 'hg_puff_', dustO: { crown: 2, skirt: 3, size: 0.6 },
    debris: [['hd_drop_', 4, { size: [12, 22], sp: [100, 300], up: [500, 900], spin: 6, life: [0.8, 1.1], erode: 0.6 }]], shake: 0, haze: false }, o || {}));
  const matk = (p) => { const m = (p.d && p.d.matk) || [10, 10]; return (m[0] + m[1]) / 2; };
  const healOf = (p, k) => Math.round(matk(p) * k * K.healPow(p));
  const team = (game, p, x, y, r) => [game.player].concat(K.friends(game, p, 1400)).filter((a) => a && a.dead <= 0 && NC.dist(a.x, a.y, x, y) < r);

  // =====================================================================================================
  // ไข้ (fever): stacks on monsters, a tick a second, passed on when a fevered one falls
  // =====================================================================================================
  const feverMax = (p) => 5 + Math.min(3, Math.ceil(lvOf(p, 'pg_carrier') * 0.3));
  const feverOf = (e) => (e && e.fever && e.fever.n > 0 ? e.fever.n : 0);
  function addFever(game, p, e, n) {
    if (!alive(e)) return;
    const f = e.fever || (e.fever = { n: 0, by: p, next: game.time + 1 });
    f.n = Math.min(feverMax(p), f.n + n); f.by = p;
    X.glints(e.x, e.y - 70, 3, HTOX, { up: true, sp: [40, 140], w: 20 });
  }
  NC.skillTicks.push((game, p) => {
    if (!isJob(p, 'crowdoc')) return;
    const per = 0.07 + lvOf(p, 'cw_fever') * 0.006 + lvOf(p, 'pg_carrier') * 0.004;
    for (const e of game.enemies) {
      const f = e.fever;
      if (!f || f.n <= 0 || f.by !== p || !alive(e) || game.time < f.next) continue;
      f.next = game.time + 1;
      K.hit(game, p, 'cw_fever', e, 0, 0, TOX, (f.n * per) / SK.cw_fever.mul(lvOf(p, 'cw_fever')), { kind: 'magic', element: 'poison', sure: true });
    }
  });
  // a fevered monster that falls: its fever jumps on (cw_fever); hits pass it on too (pg_contagion)
  const baseDE = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r) {
    const n = feverOf(e), f = e && e.fever;
    const out = baseDE.apply(this, arguments);
    const p = game.player;
    if (n && f && f.by === p && !alive(e)) {
      const lv = lvOf(p, 'cw_fever'), jumps = lv >= 5 ? 3 : 2;
      for (const o of K.nearest(game, e.x, e.y, 280, jumps + 1).filter((o) => o !== e).slice(0, jumps)) {
        addFever(game, p, o, Math.max(1, Math.ceil(n * (0.5 + lv * 0.05))));
        X.lob(game, [e.x, e.y, 70], [o.x, o.y], 'hd_drop_3', { size: 24, H: 130, dur: 0.35, shadow: false, trail: false,
          land() { X.hitFx(game, o.x, o.y - 40, { col: HTOX, k: 0.6, spark: 2 }); } });   // (the fever leaps on)
      }
      e.fever = null;
    } else if (n && r && !r.miss && p && isJob(p, 'plaguer') && lvOf(p, 'pg_contagion') && Math.random() < 0.1 + lvOf(p, 'pg_contagion') * 0.02) {
      const o = K.nearest(game, e.x, e.y, 220, 2).find((o) => o !== e);
      if (o) addFever(game, p, o, 1);
    }
    return out;
  };
  // the fever over a monster: one small painted cloud puff per stack
  FX.def('cwmarks', (ctx) => {
    const g = NC.game;
    if (!g) return;
    for (const e of g.enemies) {
      const n = feverOf(e);
      if (!n || !alive(e)) continue;
      for (let i = 0; i < n; i++) { const x = e.x - (n - 1) * 8 + i * 16, y = e.y - 145 + Math.sin(g.time * 3 + i) * 3; if (!X.piece(ctx, 'hg_puff_0', x, y, 20, 0, 0.95)) F.piece(ctx, 'fx_cloud', x, y, { scale: 0.18, alpha: 0.9 }); }
    }
  }, 'glow');
  NC.skillTicks.push((game, p) => { if (isJob(p, 'crowdoc') && !FX.list.some((f) => f.type === 'cwmarks')) FX.add({ type: 'cwmarks', layer: 'glow', life: 1e9, x: 0, y: 0 }); });

  // one flask from the hand to (tx, ty): friends there healed (hk x MATK), monsters hit + fever
  // (the flask flies as a painting and shatters: glass, drops, a toxic blast of painted frames, a puddle; the mint one
  // bursts into healing light instead)
  function flask(game, p, id, tx, ty, r, o) {
    o = o || {};
    const name = o.name || 'hd_flask_g', heal = name === 'hd_flask_m', col = o.col || (heal ? HMINT : HTOX);
    return X.lob(game, o.from || handFrom(p), [tx, ty], name, { size: o.size || 52, dur: o.dur || 0.36, H: o.arc || 110, spin: 11,
      land(x, y) {
        const s = r / 110;
        X.blast(game, x, y, r, { fr: heal ? null : 'ob_flask_boom', col, light: o.light === undefined ? 0.9 : o.light, haze: !heal,
          debris: [['hd_glass_', 6, { size: [16 * s, 26 * s], sp: [140 * s, 420 * s], up: [300 * s, 700 * s], spin: 16, life: [0.8, 1.1], erode: 0.6 }],
            [heal ? [] : 'hd_drop_', 5, { size: [12 * s, 22 * s], sp: [120 * s, 360 * s], up: [400 * s, 800 * s], spin: 6, life: [0.8, 1.1], erode: 0.6 }]],
          dust: heal ? null : 'hg_puff_', dustO: { crown: 2, skirt: 4, size: 0.7, life: 1.3 }, mark: heal ? null : ['hg_puddle', 1.3, 2.4],
          shake: o.shake === undefined ? 4 : o.shake, sfx: [['cr_snap', 0.7], [heal ? 'heal' : 'tail_poison', 0.6]] });
        if (heal) X.glints(x, y - 30, 10, HMINT, { up: true, w: r * 0.5 });
        if (o.heal) for (const a of team(game, p, x, y, r)) { K.heal(game, a, healOf(p, o.heal)); X.healFx(game, a, { col: HMINT, k: 0.8 }); }
        for (const e of K.around(game, x, y, r)) {
          const res = K.hit(game, p, id, e, 0, 0, o.rgb || HERB, o.k || 1);
          if (o.fever && res && !res.miss) addFever(game, p, e, o.fever);
          if (o.each) o.each(e, res);
        }
        if (o.land) o.land(x, y);
      } });
  }
  const spot = (game, p, range) => K.ground(game, p, range);

  // =====================================================================================================
  // หมอหน้ากากกา
  // =====================================================================================================
  K.def({
    cw_flask: S({ name: 'ปาขวดยา', icon: 'sk_cw_flask', free: 1, type: 'magic', element: 'poison', cd: 1, ro: 'a', sp: (lv) => 9 + lv, mul: (lv) => 1.5 + lv * 0.15,
      desc: (lv, m) => `ปาขวดยาไปที่เล็ง แตกรอบ ${lv >= 5 ? 140 : 110}: มอน ${m}% ของ MATK ธาตุพิษ ติดไข้ 1 · เพื่อนในวงฟื้น HP ${Math.round((0.8 + lv * 0.08) * 100)}% ของ MATK${lv >= 10 ? ' · ขวดที่สองเด้งไปตัวข้าง ๆ' : ''}` }),
    cw_mist: S({ name: 'หมอกยา', icon: 'sk_cw_mist', type: 'magic', element: 'poison', cd: 8, ro: 'z', roLife: 6, sp: (lv) => 20 + lv * 2, mul: (lv) => 0.36 + lv * 0.036,
      desc: (lv, m) => `หมอกยาลอย 6 วิ รัศมี 200: มอนโดน ${m}% ของ MATK ทุกวินาที ติดไข้ทุก 2 วิ · เพื่อนในหมอกฟื้น HP ${r1(1 + lv * 0.15)}% ทุกวินาที` }),
    cw_fever: S({ name: 'ไข้ลาม', icon: 'sk_cw_fever', type: 'magic', free: 1, pass: () => ({}), mul: (lv) => 0.07 + lv * 0.006,
      desc: (lv) => `ไข้บนมอน (สูงสุด 5 ชั้น) ทำดาเมจทุกวินาทีชั้นละ ${r1((0.07 + lv * 0.006) * 100)}% ของ MATK · มอนติดไข้ล้ม ไข้ลามไป ${lv >= 5 ? 3 : 2} ตัวข้าง ๆ` }),
    cw_inject: S({ name: 'ฉีดยา', icon: 'sk_cw_inject', type: 'magic', element: 'poison', cd: 4, ro: 'a', sp: (lv) => 12 + lv, mul: (lv) => 2.4 + lv * 0.24,
      desc: (lv, m) => `แทงไม้เท้าฉีดยาใส่มอนตัวหน้า ${m}% ของ MATK ไข้บนตัวมันชั้นละ +40% แล้วไข้หมด${lv >= 5 ? ' · ไข้ที่ใช้ ลามไปตัวข้าง ๆ ครึ่งหนึ่ง' : ''}` }),
    cw_tonic: S({ name: 'ยาบำรุง', icon: 'sk_cw_tonic', kind: 'buff', type: 'buff', cd: 30, sp: (lv) => 18 + lv * 2, rgb: '255,140,140', circle: 'holy', dur: () => 30,
      buff: (lv) => ({ hpPct: lv, hpReg: lv * 4, vit: lv >= 10 ? 5 : 0 }),
      desc: (lv) => `30 วิ: HP สูงสุด +${lv}% ฟื้น HP +${lv * 4}%${lv >= 5 ? ' · เพื่อนรอบตัวได้ด้วย (ฟื้นทันที 10%)' : ''}${lv >= 10 ? ' · VIT +5' : ''}` }),
    cw_antidote: S({ name: 'ยาถอนพิษ', icon: 'sk_cw_antidote', type: 'heal', cd: 8, ro: 'h', sp: (lv) => 14 + lv,
      desc: (lv) => `ล้างสถานะผิดปกติของตัวเอง ฟื้น HP ${8 + lv}% ของ HP สูงสุด${lv >= 5 ? ' · เพื่อนรอบ 300 ได้ด้วย' : ''}` }),
    cw_study: S({ name: 'ตำราหมอ', icon: 'sk_cw_study', pass: (lv) => ({ matk: lv * 2, heal: lv * 3 }),
      desc: (lv) => `MATK +${lv * 2}% ยารักษาแรงขึ้น ${lv * 3}%` }),
    cw_cane: S({ name: 'ไม้เท้าหัวกา', icon: 'sk_cw_cane', pass: () => ({}),
      desc: (lv) => `ตีปกติด้วยไม้เท้า ${20 + lv * 3}% ติดไข้ 1 ชั้น${lv >= 10 ? ' · ติด 2 ชั้น' : ''}` }),
    cw_mask: S({ name: 'หน้ากากกา', icon: 'sk_cw_mask', pass: (lv) => ({ mdef: r1(lv * 1.5), flee: lv }),
      desc: (lv) => `MDEF +${r1(lv * 1.5)} FLEE +${lv}` }),
    cw_night: S({ name: 'คืนแห่งการรักษา', icon: 'sk_cw_night', ult: true, max: 5, type: 'magic', element: 'poison', cd: 50, sp: (lv) => 42 + lv * 4, mul: (lv) => 1.2 + lv * 0.2,
      desc: (lv, m) => `3 วิ: ปาร์ตี้ฟื้น HP 3 ครั้ง ครั้งละ ${15 + lv * 3}% · มอนรอบ 500 ไข้เต็ม แล้วโดน ${m}% ของ MATK` }),
  });
  for (const id of ['cw_fever', 'cw_study', 'cw_cane', 'cw_mask']) { SK[id].active = false; SK[id].kind = 'passive'; }
  RUN.cw_flask = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'bolt', 0), 0.26);
    const [gx, gy] = spot(game, p, 560), r = lv >= 5 ? 140 : 110;
    flask(game, p, 'cw_flask', gx, gy, r, { heal: 0.8 + lv * 0.08, fever: 1, land(x, y) {
      if (lv < 10) return;
      const o = K.nearest(game, x, y, 300, 3).find((o) => NC.dist(o.x, o.y, x, y) > 60);
      if (o) flask(game, p, 'cw_flask', o.x, o.y, 90, { from: [x, y, 40], heal: 0.4 + lv * 0.04, fever: 1, k: 0.6, arc: 70, dur: 0.28, size: 42, light: 0.7 });
    } });
  };
  RUN.cw_mist = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'bolt', 1), 0.3);
    const [gx, gy] = spot(game, p, 520);
    geyser(game, gx, gy, 120, { light: 0.8, shake: 5, sfx: [['cast_poison', 0.7], ['tail_poison', 0.5]] });
    X.cloud(game, gx, gy, 200, 6, { names: 'hg_puff_', n: 6, bubbles: 'hd_bubble_', a: 0.55 });
    let n = 0;
    K.zone(game, p, 'cw_mist', gx, gy, 200, 6, 1, Object.assign({ rgb: MINT, style: 'holy', each(e, res) { if ((n++ % 2) === 0 && res && !res.miss) addFever(game, p, e, 1); },
      pulse() { for (const a of team(game, p, gx, gy, 200)) { K.heal(game, a, a.maxHp * (0.01 + lv * 0.0015) * K.healPow(p), { quiet: true }); X.healFx(game, a, { col: HMINT, k: 0.5 }); } } }, zoneOff));
  };
  RUN.cw_inject = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'thrust', 1) || K.clip(p, 'bolt', 2), 0.3);
    const t = K.nearest(game, p.x, p.y, 220, 1, p.aim, 0.9)[0] || K.target(game, p, 220);
    if (!t) return;
    const n = feverOf(t), [hx, hy] = K.hand(p);
    if (NC.LightKit) NC.LightKit.line(hx, hy, t.x, t.y - 60, { col: HTOX, life: 0.25, w: 9 });
    X.hitFx(game, t.x, t.y - 60, { col: HTOX, k: 1.1, arc: true, ang: p.aim, dir: Math.cos(p.aim) >= 0 ? 1 : -1, shake: 3, sfx: [['im_stab', 0.7]] });
    const parts = [];
    X.debris(parts, t.x, t.y, 'hd_drop_', 6, { dir: p.aim, spread: 0.7, size: [12, 22], sp: [200, 500], up: [300, 600], z: 60, spin: 6, life: [0.7, 1], erode: 0.6 });
    X.emit(parts);
    if (n >= 3) geyser(game, t.x, t.y, 90 + n * 10, { light: 1, shake: 6, zoom: 0.04, sfx: [['ult_boom', 0.35], ['tail_poison', 0.6]] });   // (the fever bursts)
    K.hit(game, p, 'cw_inject', t, Math.cos(p.aim) * 120, 0, HERB, 1 + n * 0.4, { big: n >= 3 });
    if (n) {
      t.fever = null;
      if (lv >= 5) for (const o of K.nearest(game, t.x, t.y, 260, 3).filter((o) => o !== t).slice(0, 2)) addFever(game, p, o, Math.ceil(n / 2));
    }
  };
  RUN.cw_tonic = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.45);
    K.startBuff(game, p, 'cw_tonic', lv, 30);
    X.buffFx(game, p, { col: HTONIC, pieces: [['hd_herb_0', 'hd_herb_1', 'hd_herb_2', 'hd_herb_3'], 6, 32] });
    if (lv >= 5) K.buffFriends(game, p, { dur: 30, guard: 0.95, heal: (a) => a.maxHp * 0.1, rgb: '255,140,140' });
  };
  RUN.cw_antidote = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.35);
    if (NC.HS) NC.HS.cure(game, NC.HS.IDS);
    const who = lv >= 5 ? team(game, p, p.x, p.y, 300) : [p];
    for (const a of who) { K.heal(game, a, a.maxHp * (0.08 + lv * 0.01) * K.healPow(p)); X.healFx(game, a, { col: HMINT }); }
    X.hitFx(game, p.x, p.y - 150, { col: HMINT, k: 0.6, piece: ['hd_flask_m', 46, 1.5, 0.7], spark: 6, sfx: [['cr_glint', 0.6]] });
  };
  NC.basicHits.push((game, p, e) => {
    const lv = lvOf(p, 'cw_cane');
    if (lv && isJob(p, 'crowdoc') && Math.random() < 0.2 + lv * 0.03) addFever(game, p, e, lv >= 10 ? 2 : 1);
  });
  RUN.cw_night = function (game, p, lv) {
    K.pose(game, p, 'cheer', 1);
    X.dim(3.2, 0.3);
    V.flash(HERB, 0.08, 0.5);
    X.sfx('ult_rise', p.x, 0.7);
    if (NC.LightKit) NC.LightKit.pillar(p.x, p.y, { w: 90, h: 620, life: 0.8, col: HMINT });
    for (let i = 0; i < 3; i++) V.at(i, () => {
      for (const a of team(game, p, p.x, p.y, 600)) { K.heal(game, a, a.maxHp * (0.15 + lv * 0.03) * K.healPow(p)); X.healFx(game, a, { col: HMINT, k: 1.2 }); }
      if (NC.LightKit) NC.LightKit.ring(p.x, p.y, { r0: 40, r1: 520, life: 0.6, col: HMINT, a: 0.6 });
    });
    for (const e of K.around(game, p.x, p.y, 500)) addFever(game, p, e, feverMax(p));
    V.at(1.5, () => {   // the night turns on them: a geyser under every one, then the great blast in their midst
      const got = K.around(game, p.x, p.y, 500);
      got.forEach((e, i) => { K.hit(game, p, 'cw_night', e, 0, 0, TOX, 1, { big: true }); geyser(game, e.x, e.y, 80, { light: 0.5, delay: i * 0.03 }); });
      if (got.length) {
        const cx = got.reduce((s, e) => s + e.x, 0) / got.length, cy = got.reduce((s, e) => s + e.y, 0) / got.length;
        X.blast(game, cx, cy, 260, { fr: 'ob_mega_tox', frK: 2.1, col: HTOX, light: 0.75, dust: 'hg_puff_', dustO: { crown: 6, skirt: 10, size: 1.2 }, mark: ['hg_puddle', 1.6, 3.5],
          debris: [['hd_drop_', 10, { size: [14, 26], sp: [200, 600], up: [600, 1100], spin: 6 }]], shake: 14, zoom: 0.09, sfx: [['ult_boom', 1], ['tail_poison', 0.8]] });
      } else V.shake(game, 8);
    });
  };

  // =====================================================================================================
  // หมอยาราตรี
  // =====================================================================================================
  K.def({
    ap_bottle: S({ name: 'ขวดยาเรืองแสง', icon: 'sk_ap_bottle', free: 1, type: 'magic', element: 'holy', cd: 1, ro: 'a', sp: (lv) => 12 + lv, mul: (lv) => 0.9 + lv * 0.09,
      desc: (lv, m) => `ขวดยาเรืองแสงแตกที่เล็ง: เพื่อนฟื้น HP ${Math.round((1.4 + lv * 0.14) * 100)}% ของ MATK มอน ${m}% แล้วเด้งไปหาเพื่อนที่เลือดน้อยสุดอีก ${lv >= 10 ? 4 : lv >= 5 ? 3 : 2} ครั้ง` }),
    ap_garden: S({ name: 'สวนสมุนไพร', icon: 'sk_ap_garden', cd: 12, ro: 'z', roLife: 10, sp: (lv) => 22 + lv * 2,
      desc: (lv) => `ปลูกแปลงสมุนไพรใต้เท้า 10 วิ รัศมี 220: ทุก 1.5 วิ ปาร์ตี้ในวงฟื้น HP ${r1(3 + lv * 0.3)}% มอนในวงเดินช้า${lv >= 10 ? ' · SP ฟื้นด้วย' : ''}` }),
    ap_revive: S({ name: 'ยาฟื้นใจ', icon: 'sk_ap_revive', type: 'heal', cd: 30, ro: 'u', sp: (lv) => 30 + lv * 2,
      desc: (lv) => `ชุบเพื่อนที่หมดแรงรอบ 400 (HP ${20 + lv * 5}%) · ปาร์ตี้ทุกคนได้ยาฟื้นใจ ${10 + lv} วิ: โดนตีจนเหลือ 0 จะรอดที่ 1 แล้วฟื้น 25%` }),
    ap_bubble: S({ name: 'ฟองยาคุ้มกัน', icon: 'sk_ap_bubble', cd: 10, ro: 'u', sp: (lv) => 20 + lv * 2,
      desc: (lv) => `ฟองยาครอบตัวเอง${lv >= 5 ? 'และปาร์ตี้รอบ 300' : ''} 10 วิ ซับดาเมจได้ ${Math.round((2 + lv * 0.3) * 100)}% ของ MATK` }),
    ap_overflow: S({ name: 'ยาล้นแก้ว', icon: 'sk_ap_overflow', pass: () => ({}),
      desc: (lv) => `ยารักษาที่ล้นเกิน HP เต็ม กลายเป็นฟองซับดาเมจ ${lv * 8}% ของส่วนที่ล้น (ตัวเราเอง)` }),
    ap_brew: S({ name: 'ปรุงยาสด', icon: 'sk_ap_brew', pass: (lv) => ({ heal: lv * 3, spCost: lv * 2, int: lv >= 10 ? 5 : 0 }),
      desc: (lv) => `ยารักษาแรงขึ้น ${lv * 3}% สกิลใช้ SP น้อยลง ${lv * 2}%${lv >= 10 ? ' · INT +5' : ''}` }),
    ap_purify: S({ name: 'ล้างพิษ', icon: 'sk_ap_purify', type: 'heal', cd: 12, ro: 'h', sp: (lv) => 18 + lv * 2,
      desc: (lv) => `ล้างสถานะผิดปกติทั้งปาร์ตี้รอบ 400 ไม่ติดสถานะ ${2 + lv * 0.5} วิ ฟื้น HP ${5 + lv}%` }),
    ap_rain: S({ name: 'ฝนยา', icon: 'sk_ap_rain', ult: true, max: 5, type: 'magic', element: 'holy', cd: 50, sp: (lv) => 45 + lv * 4, mul: (lv) => 0.5 + lv * 0.08,
      desc: (lv, m) => `ฝนยาตก 4 วิ รัศมี 450: ทุก 0.5 วิ ปาร์ตี้ฟื้น HP ${4 + lv}% มอนในฝนโดน ${m}% ของ MATK` }),
  });
  for (const id of ['ap_overflow', 'ap_brew']) { SK[id].active = false; SK[id].kind = 'passive'; }
  RUN.ap_bottle = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'bolt', 0), 0.26);
    const [gx, gy] = spot(game, p, 560), hk = 1.4 + lv * 0.14;
    let left = lv >= 10 ? 4 : lv >= 5 ? 3 : 2;
    const hopped = new Set();
    const go = (from, tx, ty, k) => flask(game, p, 'ap_bottle', tx, ty, 120, { name: 'hd_flask_m', rgb: MINT, heal: hk * k, k, from, arc: 90, dur: 0.32, light: 0.8, shake: 2, land(x, y) {
      if (left-- <= 0) return;
      const next = team(game, p, x, y, 520).filter((a) => !hopped.has(a) && a.hp < a.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!next) return;
      hopped.add(next);
      go([x, y, 40], next.x, next.y, k * 0.8);
    } });
    go(null, gx, gy, 1);
  };
  RUN.ap_garden = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    const x = p.x, y = p.y, herbs = X.all('hd_herb_');
    // the garden bursts up out of the ground: herbs growing in a ring, swaying; leaves thrown up
    for (let i = 0; i < 10 && herbs.length; i++) {
      const a = (i / 10) * TAU + rand(-0.2, 0.2), r = rand(80, 190);
      V.at(i * 0.03, () => X.stay(herbs[i % herbs.length], x + Math.cos(a) * r, y + Math.sin(a) * r * 0.58, 10, { size: rand(40, 58), growIn: 0.35, sway: 0.12, ph: rand(0, 6), flip: Math.random() < 0.5 }));
    }
    const parts = [];
    X.debris(parts, x, y, 'hd_leaf_', 10, { size: [16, 26], sp: [120, 320], up: [400, 700], grav: 700, spin: 5, life: [1.1, 1.5], erode: 0.6, bounce: 0 });
    X.emit(parts);
    if (NC.LightKit) { NC.LightKit.ring(x, y, { r0: 30, r1: 230, life: 0.6, col: '#8ceb96', a: 0.6 }); X.glints(x, y - 20, 12, '#b8ffb0', { up: true, w: 160 }); }
    X.sfx('cast_wind', x, 0.6);
    K.zone(game, p, 'ap_garden', x, y, 220, 10, 1.5, Object.assign({ rgb: HERB, hits: false, each(e) { K.slow(e, 1.6); },
      pulse() {
        for (const a of team(game, p, x, y, 220)) {
          K.heal(game, a, a.maxHp * (0.03 + lv * 0.003) * K.healPow(p), { quiet: true });
          X.healFx(game, a, { col: '#9dffb0', k: 0.6 });
          if (lv >= 10 && a === p && p.maxSp) p.sp = Math.min(p.maxSp, p.sp + p.maxSp * 0.02);
        }
        X.glints(x, y - 20, 6, '#b8ffb0', { up: true, w: 150, sp: [60, 160], life: 1.4 });
      } }, zoneOff));
  };
  // ยาฟื้นใจ: a friend who would fall stays at 1 and gets a quarter back (the hero's guard; the AI friends' hurt below)
  NC.heroGuards.push((game, p, dmg) => {
    if (p.apSave > game.time && dmg >= p.hp) {
      p.apSave = 0; K.heal(game, p, p.maxHp * 0.25);
      if (NC.LightKit) NC.LightKit.pillar(p.x, p.y, { w: 70, h: 520, life: 0.6, col: HMINT });
      X.hitFx(game, p.x, p.y - 160, { col: HMINT, k: 0.8, piece: ['hd_flask_m', 46, 1.6, 0.7], sfx: [['heal', 0.8]] });
      return Math.max(0, p.hp - 1);
    }
    return dmg;
  });
  RUN.ap_revive = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.6);
    const lib = NC.Party && NC.Party.lib;
    for (const a of K.friends(game, p, 400).concat((NC.Party && NC.Party.members) || []))
      if (a.dead > 0 && NC.dist(a.x, a.y, p.x, p.y) < 400 && lib && lib.revive) {
        lib.revive(game, a, 0.2 + lv * 0.05);
        if (NC.LightKit) NC.LightKit.pillar(a.x, a.y, { w: 90, h: 600, life: 0.8, col: HMINT });
        X.healFx(game, a, { col: HMINT, k: 1.4 });
      }
    for (const a of team(game, p, p.x, p.y, 400)) {
      if (a === p) p.apSave = game.time + 10 + lv;
      else { a.guardUntil = game.time + 10 + lv; a.guardK = Math.min(a.guardK || 1, 0.85); }
      X.buffFx(game, a, { col: HMINT, k: 0.8 });
    }
  };
  // ฟองยา: soaks hits (p.apBubble: points left, until)
  NC.heroGuards.push((game, p, dmg) => {
    const b = p.apBubble;
    if (!b || b.until < game.time || b.left <= 0) return dmg;
    const take = Math.min(b.left, dmg);
    b.left -= take;
    if (b.left <= 0) { X.hitFx(game, p.x, p.y - 70, { col: HMINT, k: 1, spark: 10, sfx: [['cr_snap', 0.6]] }); X.glints(p.x, p.y - 70, 10, HMINT, { sp: [200, 520] }); }   // (it pops)
    return dmg - take;
  });
  // the bubble: the light kit's painted dome (its frames, mint) round the hero, breathing; the old painted bubble without it
  FX.def('apbubble', (ctx, q) => {
    const g = NC.game, p = g && g.player, b = p && p.apBubble, L = NC.LightKit;
    if (!b || b.until < g.time || b.left <= 0) return;
    if (L && L.MAN && L.MAN.dome && L.piece) {
      const A = L.MAN.dome, i = Math.floor(g.time * 8) % A.frames.length, f = A.frames[i], W = 230 * (1 + Math.sin(g.time * 3) * 0.02);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      L.piece(ctx, 'dome', p.x, p.y + 4, 0, W, W * (f.h / f.w), 0.55, HMINT, 0.15, { frame: i });
      ctx.restore();
    } else F.piece(ctx, 'fx_bubble', p.x, p.y - 20, { scale: 1.25 + Math.sin(g.time * 3) * 0.03, alpha: 0.55 });
  }, 'glow');
  RUN.ap_bubble = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.35);
    p.apBubble = { left: Math.round(matk(p) * (2 + lv * 0.3) * K.healPow(p)), until: game.time + 10 };
    if (!FX.list.some((f) => f.type === 'apbubble')) FX.add({ type: 'apbubble', layer: 'glow', life: 1e9, x: 0, y: 0 });
    X.healFx(game, p, { col: HMINT });
    X.glints(p.x, p.y - 70, 12, HMINT, { sp: [160, 420] });
    X.sfx('buff_shield', p.x, 0.7);
    if (lv >= 5) K.buffFriends(game, p, { dur: 10, guard: 0.7, rgb: MINT, r: 300 });
  };
  // ยาล้นแก้ว: overheal on the hero becomes a bubble
  const baseHeal = K.heal;
  K.heal = function (game, who, amount, o) {
    const p = game.player, room = who ? who.maxHp - who.hp : 0, got = baseHeal.apply(this, arguments), lv = p ? lvOf(p, 'ap_overflow') : 0;
    if (lv && who === p && amount > room && isJob(p, 'apothecary')) {
      const b = p.apBubble && p.apBubble.until > game.time ? p.apBubble : (p.apBubble = { left: 0, until: game.time + 8 });
      b.left = Math.min(p.maxHp * 0.4, b.left + (amount - room) * lv * 0.08); b.until = Math.max(b.until, game.time + 8);
      if (!FX.list.some((f) => f.type === 'apbubble')) FX.add({ type: 'apbubble', layer: 'glow', life: 1e9, x: 0, y: 0 });
    }
    return got;
  };
  RUN.ap_purify = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    if (NC.HS) { NC.HS.cure(game, NC.HS.IDS); const imm = p.hstImm || (p.hstImm = {}); for (const id of NC.HS.IDS) imm[id] = game.time + 2 + lv * 0.5; }
    for (const a of team(game, p, p.x, p.y, 400)) { K.heal(game, a, a.maxHp * (0.05 + lv * 0.01) * K.healPow(p)); X.healFx(game, a, { col: HMINT, k: 1.1 }); X.glints(a.x, a.y - 60, 6, '#ffffff', { up: true, w: 30 }); }
    if (NC.LightKit) NC.LightKit.ring(p.x, p.y, { r0: 30, r1: 420, life: 0.55, col: HMINT, a: 0.6 });
  };
  RUN.ap_rain = function (game, p, lv) {
    K.pose(game, p, 'cheer', 1);
    const x = p.x, y = p.y, L = NC.LightKit;
    X.dim(4.2, 0.22);
    X.sfx('ult_rise', x, 0.6);
    if (L) L.pillar(x, y, { w: 150, h: 700, life: 1, col: HMINT });
    V.light(x, y - 80, 900, MINT, 0.8, 4);
    K.zone(game, p, 'ap_rain', x, y, 450, 4, 0.5, Object.assign({ rgb: MINT,
      tick() {   // the rain: streaks of mint light falling, a flask now and then bursting into healing light
        if (!L) return;
        for (let i = 0; i < 2; i++) {
          const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 440, rx = x + Math.cos(a) * d, ry = y + Math.sin(a) * d * V.SQ;
          L.part({ n: 'drop', x: rx + 60, y: ry - 520, vx: -110, vy: 960, len: rand(10, 14), wid: rand(44, 70), rot: Math.atan2(960, -110) - Math.PI / 2, life: 0.52, a: 0.8, col: HMINT, white: 0.5, g: 0.5, fade: L.inOut(0.1, 0.2) });
          V.at(0.5, () => X.glints(rx, ry - 6, 2, HMINT, { up: true, sp: [40, 120], w: 6, life: 0.6 }));
        }
        if (Math.random() < 0.08) { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 400, fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d * V.SQ;
          X.drop(game, fx, fy, 'hd_flask_m', { size: 34, H: 620, dur: 0.32, shadow: false, land() { X.glints(fx, fy - 20, 8, HMINT, { up: true, w: 30 }); if (L) L.ring(fx, fy, { r0: 10, r1: 90, life: 0.4, col: HMINT, a: 0.6 }); X.sfx('cr_glint', fx, 0.4); } }); }
      },
      pulse() {
        for (const a of team(game, p, x, y, 450)) { K.heal(game, a, a.maxHp * (0.04 + lv * 0.01) * K.healPow(p), { quiet: true }); X.healFx(game, a, { col: HMINT, k: 0.6 }); }
        if (L) L.ring(x, y, { r0: 60, r1: 460, life: 0.5, col: HMINT, a: 0.35 });
      } }, zoneOff));
  };

  // =====================================================================================================
  // ผู้หว่านโรค
  // =====================================================================================================
  K.def({
    pg_cloud: S({ name: 'เมฆพิษ', icon: 'sk_pg_cloud', free: 1, type: 'magic', element: 'poison', cd: 6, ro: 'z', roLife: 6, sp: (lv) => 14 + lv, mul: (lv) => 0.45 + lv * 0.045,
      desc: (lv, m) => `เมฆพิษ 6 วิ รัศมี 160 ที่เล็ง: ทุกวินาที ${m}% ของ MATK ติดไข้ 1${lv >= 5 ? ' · ดูดมอนเข้ากลาง' : ''}${lv >= 10 ? ' · รัศมี 220' : ''}` }),
    pg_scatter: S({ name: 'ขวดพิษกระจาย', icon: 'sk_pg_scatter', type: 'magic', element: 'poison', cd: 3, ro: 'a', sp: (lv) => 14 + lv, mul: (lv) => 0.8 + lv * 0.08,
      desc: (lv, m) => `ขวดพิษแตกเป็น 3 ขวดตกเป็นพัด แต่ละจุด ${m}% ของ MATK ติดไข้ 2${lv >= 5 ? ' · 5 ขวด' : ''}` }),
    pg_epidemic: S({ name: 'โรคระบาด', icon: 'sk_pg_epidemic', type: 'magic', element: 'poison', cd: 5, ro: 'a', sp: (lv) => 18 + lv * 2, mul: (lv) => 0.3 + lv * 0.03,
      desc: (lv, m) => `ไข้บนมอนทุกตัวรอบ 600 ระเบิดพร้อมกัน ชั้นละ ${m}% ของ MATK แล้วไข้หมด${lv >= 10 ? ' (เหลือไว้ครึ่งหนึ่ง)' : ''}` }),
    pg_contagion: S({ name: 'ติดต่อ', icon: 'sk_pg_contagion', pass: () => ({}),
      desc: (lv) => `ตีโดนมอนติดไข้ ${10 + lv * 2}% ไข้ลามไปตัวข้าง ๆ 1 ชั้น` }),
    pg_wither: S({ name: 'ร่างโรย', icon: 'sk_pg_wither', type: 'debuff', cd: 10, ro: 'u', sp: (lv) => 18 + lv,
      desc: (lv) => `มอนรอบ 260 ที่เล็ง 8 วิ: ตีเบาลง ${10 + lv * 2}% โดนแรงขึ้น ${lv * 2}%` }),
    pg_carrier: S({ name: 'พาหะ', icon: 'sk_pg_carrier', pass: () => ({}),
      desc: (lv) => `ไข้ติดได้สูงสุด ${5 + Math.min(3, Math.ceil(lv * 0.3))} ชั้น ไข้แรงขึ้นชั้นละ ${r1(lv * 0.4)}%` }),
    pg_toxin: S({ name: 'ชำนาญพิษ', icon: 'sk_pg_toxin', pass: (lv) => ({ matk: lv * 2, poison: lv * 3 }),
      desc: (lv) => `MATK +${lv * 2}% พิษแรงขึ้น ${lv * 3}%` }),
    pg_blight: S({ name: 'ทุ่งโรคระบาด', icon: 'sk_pg_blight', ult: true, max: 5, type: 'magic', element: 'poison', cd: 50, sp: (lv) => 45 + lv * 4, mul: (lv) => 0.6 + lv * 0.1,
      desc: (lv, m) => `ทุ่งโรคระบาด 6 วิ รัศมี 520: มอนไข้เต็ม และโดน ${m}% ของ MATK ทุกวินาที` }),
  });
  for (const id of ['pg_contagion', 'pg_carrier', 'pg_toxin']) { SK[id].active = false; SK[id].kind = 'passive'; }
  RUN.pg_cloud = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'bolt', 1), 0.3);
    const [gx, gy] = spot(game, p, 520), R = lv >= 10 ? 220 : 160;
    geyser(game, gx, gy, R * 0.6, { light: 0.8, shake: 4, sfx: [['cast_poison', 0.7], ['tail_poison', 0.5]] });
    X.cloud(game, gx, gy, R, 6, { names: 'hg_puff_', bubbles: 'hd_bubble_', mark: ['hg_puddle', 1.1] });
    K.zone(game, p, 'pg_cloud', gx, gy, R, 6, 1, Object.assign({ rgb: TOX, pull: lv >= 5 ? 40 : 0, each(e, res) { if (res && !res.miss) addFever(game, p, e, 1); } }, zoneOff));
  };
  RUN.pg_scatter = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'bolt', 2), 0.3);
    const [gx, gy] = spot(game, p, 480), a = NC.angle(p.x, p.y, gx, gy), d = Math.min(480, NC.dist(p.x, p.y, gx, gy)), n = lv >= 5 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const da = (i - (n - 1) / 2) * 0.22;
      V.at(i * 0.05, () => flask(game, p, 'pg_scatter', p.x + Math.cos(a + da) * d, p.y + Math.sin(a + da) * d, 100, { name: 'hd_flask_p', rgb: TOX, fever: 2, col: HVIO, light: 0.75, shake: 3 }));
    }
  };
  RUN.pg_epidemic = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    if (NC.LightKit) NC.LightKit.ring(p.x, p.y, { r0: 30, r1: 620, life: 0.5, col: HTOX, a: 0.7 });
    let burst = 0;
    for (const e of K.around(game, p.x, p.y, 600)) {
      const n = feverOf(e);
      if (!n) continue;
      geyser(game, e.x, e.y, 55 + n * 12, { light: 0.4 + n * 0.08, delay: burst++ * 0.035 });   // (every fever bursts at once)
      K.hit(game, p, 'pg_epidemic', e, 0, 0, TOX, n, { big: n >= 5 });
      if (e.fever) e.fever.n = lv >= 10 ? Math.floor(n / 2) : 0;   // (a monster the burst killed has passed its fever on already: none left)
    }
    if (burst) { X.punch(game, p.x, p.y, 8, burst >= 4 ? 0.05 : 0); X.sfx('ult_boom', p.x, 0.5); X.sfx('tail_poison', p.x, 0.8); }
  };
  RUN.pg_wither = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'bolt', 1), 0.3);
    const [gx, gy] = spot(game, p, 480);
    X.blast(game, gx, gy, 200, { col: HVIO, light: 0.8, haze: false, dust: 'hg_plague_', dustO: { crown: 4, skirt: 8, life: 1.4 },
      debris: [['hd_leaf_', 8, { size: [14, 24], sp: [80, 260], up: [200, 420], grav: 500, spin: 5, life: [1.1, 1.5], bounce: 0, edge: [0.5, 0.3, 0.6] }]], shake: 3, sfx: [['st_curse', 0.7]] });
    for (const e of K.around(game, gx, gy, 260)) { K.weak(game, e, 1 - (0.1 + lv * 0.02), 8); K.vuln(game, e, 1 + lv * 0.02, 8, VIO); X.hitFx(game, e.x, e.y - 60, { col: HVIO, k: 0.6, spark: 2 }); }
  };
  RUN.pg_blight = function (game, p, lv) {
    K.pose(game, p, 'cheer', 1);
    const x = p.x, y = p.y;
    X.dim(6, 0.26);
    V.flash(TOX, 0.08, 0.5);
    X.sfx('ult_rise', x, 0.6);
    const got = K.around(game, x, y, 520);
    for (const e of got) addFever(game, p, e, feverMax(p));
    // the field: plague clouds all round, then the great blast in the pack's midst, geysers under them every second
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + rand(-0.3, 0.3), r = rand(270, 460); X.cloud(game, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.58, 170, 6, { names: i % 2 ? 'hg_plague_' : 'hg_puff_', n: 2, bubbles: i % 2 ? null : 'hd_bubble_', a: 0.45 }); }
    const cx = got.length ? got.reduce((s, e) => s + e.x, 0) / got.length : x + Math.cos(p.aim) * 200, cy = got.length ? got.reduce((s, e) => s + e.y, 0) / got.length : y + Math.sin(p.aim) * 140;
    V.at(0.25, () => X.blast(game, cx, cy, 300, { fr: 'ob_mega_tox', frK: 2.1, col: HTOX, light: 0.75, dust: 'hg_puff_', dustO: { crown: 8, skirt: 12, size: 1.3 }, mark: ['hg_puddle', 1.8, 6],
      debris: [['hd_drop_', 12, { size: [14, 26], sp: [200, 650], up: [600, 1200], spin: 6 }], ['hd_glass_', 6, { size: [16, 26], sp: [200, 500], up: [600, 1000], spin: 14 }]],
      shake: 15, zoom: 0.1, sfx: [['ult_boom', 1], ['boss_slam', 0.6], ['tail_poison', 0.8]] }));
    K.zone(game, p, 'pg_blight', x, y, 520, 6, 1, Object.assign({ rgb: TOX, each(e) { addFever(game, p, e, 1); },
      pulse() { K.around(game, x, y, 520).slice(0, 3).forEach((e, i) => geyser(game, e.x, e.y, 70, { light: 0.45, delay: i * 0.12 })); V.shake(game, 3); } }, zoneOff));
  };

  // =====================================================================================================
  // lines, the skill lists, the weapon rules
  // =====================================================================================================
  const LINES = {
    crowdoc: [['flask', 'ขวดยา', 'poison', null, 0], ['fever', 'ไข้ราตรี', 'poison', null, 0], ['cane', 'ไม้เท้าหมอ', 'neutral', null, 1]],
    apothecary: [['cure', 'ยารักษา', 'holy', 'flask', 0], ['guard', 'ยาคุ้มกัน', 'holy', 'cane', 1], ['herb', 'สมุนไพร', 'holy', 'fever', 0]],
    plaguer: [['plague', 'โรคระบาด', 'poison', 'fever', 0], ['toxin', 'พิษ', 'poison', 'flask', 0], ['carrier', 'พาหะ', 'poison', 'cane', 1]],
  };
  const PLAN = {
    crowdoc: [
      ['cw_flask', 'flask', 10, 1, [], 'Lv5 วงใหญ่ขึ้น · Lv10 ขวดที่สองเด้ง'],
      ['cw_mist', 'flask', 10, 0, [['cw_flask', 3]], 'มอนโดนทุกวินาที เพื่อนฟื้น'],
      ['cw_night', 'flask', 5, 0, [['cw_flask', 5], ['cw_fever', 3]], 'ฟื้นปาร์ตี้ 3 ครั้ง มอนไข้เต็ม'],
      ['cw_fever', 'fever', 10, 1, [], 'Lv5 ไข้ลาม 3 ตัว'],
      ['cw_inject', 'fever', 10, 0, [['cw_fever', 3]], 'Lv5 ไข้ที่ใช้ลามต่อ'],
      ['cw_antidote', 'fever', 10, 0, [['cw_fever', 1]], 'Lv5 เพื่อนได้ด้วย'],
      ['cw_cane', 'cane', 10, 0, [], 'Lv10 ติดไข้ 2 ชั้น'],
      ['cw_study', 'cane', 10, 0, [], 'MATK และยารักษาแรงขึ้น'],
      ['cw_tonic', 'cane', 10, 0, [['cw_study', 3]], 'Lv5 เพื่อนได้ด้วย · Lv10 VIT +5'],
      ['cw_mask', 'cane', 10, 0, [], 'MDEF และ FLEE เพิ่ม'],
    ],
    apothecary: [
      ['ap_bottle', 'cure', 10, 1, [], 'Lv5 เด้ง 3 ครั้ง · Lv10 เด้ง 4 ครั้ง'],
      ['ap_revive', 'cure', 10, 0, [['ap_bottle', 3]], 'ชุบเพื่อน และกันตายทั้งปาร์ตี้'],
      ['ap_rain', 'cure', 5, 0, [['ap_bottle', 5], ['ap_garden', 3]], 'ฝนยาทั้งปาร์ตี้'],
      ['ap_bubble', 'guard', 10, 0, [], 'Lv5 ปาร์ตี้ได้ด้วย'],
      ['ap_overflow', 'guard', 10, 0, [['ap_bubble', 1]], 'ยาล้นกลายเป็นฟอง'],
      ['ap_purify', 'guard', 10, 0, [['ap_bubble', 3]], 'ล้างสถานะ ไม่ติดสถานะชั่วคราว'],
      ['ap_garden', 'herb', 10, 1, [], 'Lv10 SP ฟื้นด้วย'],
      ['ap_brew', 'herb', 10, 0, [], 'Lv10 INT +5'],
    ],
    plaguer: [
      ['pg_cloud', 'plague', 10, 1, [], 'Lv5 ดูดมอน · Lv10 วงใหญ่ขึ้น'],
      ['pg_epidemic', 'plague', 10, 0, [['pg_cloud', 3]], 'Lv10 ไข้เหลือครึ่ง'],
      ['pg_blight', 'plague', 5, 0, [['pg_epidemic', 3], ['pg_scatter', 3]], 'ไข้เต็มทั้งทุ่ง'],
      ['pg_scatter', 'toxin', 10, 0, [], 'Lv5 5 ขวด'],
      ['pg_wither', 'toxin', 10, 0, [['pg_scatter', 3]], 'มอนอ่อนลง โดนแรงขึ้น'],
      ['pg_toxin', 'toxin', 10, 0, [], 'MATK และพิษแรงขึ้น'],
      ['pg_contagion', 'carrier', 10, 1, [], 'ตีโดนแล้วไข้ลาม'],
      ['pg_carrier', 'carrier', 10, 0, [['pg_contagion', 3]], 'ไข้ติดได้ถึง 8 ชั้น'],
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
  if (NC.weaponRule) for (const id of ['cw_inject']) NC.weaponRule(id, 'n:staff');
  NC.OBT_DOCTOR = { addFever, feverOf };
})();
