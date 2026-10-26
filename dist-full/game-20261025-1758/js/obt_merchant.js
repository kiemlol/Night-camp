/* obt_merchant.js — the merchant line's skills (the user, 2026-10-19: picked พ่อค้า as a new main line, then "เริ่มทำอาชีพและ
   สกิลของ 3 สายนี้ ... ต่อเลย"). The jobs and their gear: js/obtjobs.js (unreleased catalog source).
     พ่อค้าเร่      the pack of goods: throws use up the cheapest junk in the bag (a monster material) and hit in that
                   monster's element, so junk is worth carrying (a throw with nothing in the bag is a pebble: 70%,
                   no element); the strongbox on its chain spins and slams
     นายคาราวาน    the cargo beetle (a summon monsters turn on: it takes hits for the party, rams, charges), a rest stop
                   that heals the party, supplies, a wall of crates that draws monsters, the phantom caravan ultimate
     เจ้าหนี้        debt on monsters (e.debt, 1–10 stacks: each one +3% damage from him); ทวงหนี้ cashes it all in at once;
                   the strongest strikes burn real coins (a coin sink)
   Effects (2026-10-20, "ออกเเบบให้บึ้มๆบั้มๆ" -> the ลังไม้กระแทก sample passed -> "ทำสกิลที่เหลือของทั้ง 3 สายแบบเดียวกันเลย"):
   js/obt_vfx.js's kit X: goods, coins, crates and slips as high-res paintings thrown and dropped, blasts of painted frames
   played smoothly (goods, quake, coins, the giant clearance blast), dust and debris dissolving, the light kit in gold / teal /
   crimson, shakes, punches and the game's sounds. Loaded after obt_vfx.js, before rotiming.js. */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC.JOBS.peddler) return;
  const FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS, F = NC.OBTJOBS.fx, X = NC.OBTVFX;
  const { TAU } = K;
  const rand = NC.rand, S = K.S, alive = K.alive, lvOf = (p, id) => NC.skillLv(p, id);
  const r1 = (v) => Math.round(v * 10) / 10;
  const any = (list) => list[Math.floor(Math.random() * list.length)];
  const isJob = (p, j) => p && NC.isJob && NC.isJob(p, j);
  const GOLD = '255,205,110', TEAL = '90,220,200', CRIM = '255,90,90', COIN = '255,215,90';
  const HGOLD = '#ffc870', HTEAL = '#4fe3c8', HCRIM = '#ff5a5a', HCOIN = '#ffd85a';
  const COINS = ['hm_coin0', 'hm_coin1', 'hm_coin2'], GOODS_HD = ['hm_bundle', 'hm_pot', 'hm_rug'];

  // =====================================================================================================
  // the pack: the junk in the bag (monster materials) is the ammunition
  // =====================================================================================================
  const MAT = NC.MATERIALS || {};
  const ELEM = {}; // material -> its monster's element
  for (const sp in NC.MAT_DROPS || {}) {
    const el = NC.SPECIES && NC.SPECIES[sp] && NC.SPECIES[sp].element;
    for (const [m] of NC.MAT_DROPS[sp]) if (el && !ELEM[m]) ELEM[m] = el;
  }
  const junkOk = (id) => /^mat_/.test(id) && MAT[id] && !MAT[id].rare && !MAT[id].keep && (MAT[id].base || 0) > 0 && !(NC.invLocked && NC.invLocked(id));
  // the cheapest piece of junk he carries (null: the pack is empty)
  function junkOf(p) {
    let best = null;
    for (const id in p.mats || {}) if (p.mats[id] > 0 && junkOk(id) && (!best || MAT[id].base < MAT[best].base)) best = id;
    return best;
  }
  // take one piece out of the pack: -> { el, k } (its element and the throw's power)
  function takeJunk(game, p) {
    const id = junkOf(p);
    if (!id) return { el: null, k: lvOf(p, 'mc_thrift') >= 5 ? 1 : 0.7, id: null };
    const keep = Math.random() < lvOf(p, 'mc_thrift') * 0.06;
    if (!keep && !(NC.Online && NC.Online.active)) p.mats[id] -= 1; // (online the server will own the pack: not wired yet)
    return { el: ELEM[id] || null, k: 1, id };
  }
  const goodsPiece = (j) => GOODS_HD[(j && j.id ? j.id.length : 0) % GOODS_HD.length];
  const ELRGB = { fire: '255,140,70', water: '110,180,255', wind: '140,230,140', earth: '210,170,110', poison: '190,120,255', holy: '255,240,170', shadow: '170,130,230', ghost: '200,200,255' };
  const ELCOL = { fire: '#ff8a46', water: '#6eb4ff', wind: '#8ce68c', earth: '#d2aa6e', poison: '#be78ff', holy: '#fff0aa', shadow: '#aa82e6', ghost: '#c8c8ff' };
  const handFrom = (p) => { const h = K.hand(p); return [h[0], p.y, Math.max(0, p.y - h[1])]; };
  // a burst of coins out of a point (a debt cashed in): the painted coin frames, coins flung, gold light
  function coinBurst(game, x, y, k) {
    X.frames('ob_coin_boom', x, y - 60 * k, 300 * k, { s0: 0.85, s1: 1.1, erode: [0.7, 1] });
    const parts = [];
    X.debris(parts, x, y, COINS, Math.round(5 + 4 * k), { size: [18 * k, 28 * k], sp: [120, 380], up: [500, 900], spin: 18, z: 60 });
    X.emit(parts);
    X.glints(x, y - 60, 6, HCOIN, { sp: [260, 640] });
    X.sfx('coin', x, 0.8);
  }

  // =====================================================================================================
  // พ่อค้าเร่
  // =====================================================================================================
  K.def({
    mc_toss: S({ name: 'ปาของขาย', icon: 'sk_mc_toss', free: 1, cd: 1, ro: 'a', sp: (lv) => 7 + lv, mul: (lv) => 1.05 + lv * 0.12,
      desc: (lv, m) => `ปาสินค้าในเป้ใส่จุดที่เล็ง ระเบิดรอบ 90 ${m}% ของ ATK ธาตุตามวัสดุที่ใช้ (ใช้ขยะ 1 ชิ้น ไม่มีขยะ = 70% ไม่มีธาตุ)${lv >= 5 ? ' · เด้งต่อไปอีกตัว 60%' : ''}${lv >= 10 ? ' · ปาทีละ 3 ชิ้นเป็นพัด' : ''}` }),
    mc_crate: S({ name: 'ลังไม้กระแทก', icon: 'sk_mc_crate', cd: 5, sp: (lv) => 14 + lv, mul: (lv) => 1.7 + lv * 0.17,
      desc: (lv, m) => `ขว้างลังไม้หนักไปข้างหน้า แตกกระจายรอบ 140 ${m}% ของ ATK มึน 0.8 วิ${lv >= 5 ? ' · ขว้าง 2 ลัง' : ''}${lv >= 10 ? ' · มึน 1.4 วิ' : ''}` }),
    mc_sale: S({ name: 'ล้างสต็อก', icon: 'sk_mc_sale', ult: true, max: 5, cd: 45, sp: (lv) => 38 + lv * 4, mul: (lv) => 0.95 + lv * 0.15,
      desc: (lv, m) => `เทเป้ทั้งเป้ สินค้า ${6 + lv * 2} ชิ้นตกใส่พื้นที่ 260 ชิ้นละ ${m}% ของ ATK ธาตุตามขยะแต่ละชิ้น แล้วระเบิดใหญ่ตอนจบรอบ 300 ${m * 2}%` }),
    mc_swing: S({ name: 'เหวี่ยงหีบ', icon: 'sk_mc_swing', free: 1, cd: 2, ro: 'a', sp: (lv) => 9 + lv, mul: (lv) => 1.2 + lv * 0.12,
      desc: (lv, m) => `เหวี่ยงหีบเหล็กหมุนรอบตัว 160 ${m}% ของ ATK กระเด็น${lv >= 5 ? ' · หมุนสองรอบ' : ''}${lv >= 10 ? ' · ดูดมอนเข้ามาก่อน' : ''}` }),
    mc_slam: S({ name: 'หีบทุบ', icon: 'sk_mc_slam', cd: 6, ro: 'a', sp: (lv) => 14 + lv, mul: (lv) => 2 + lv * 0.2,
      desc: (lv, m) => `กระโดดไปข้างหน้า 180 ทุบหีบลงพื้นรอบ 150 ${m}% ของ ATK มึน 1 วิ${lv >= 10 ? ' · คลื่นพื้นแตกพุ่งต่อไป 400' : ''}` }),
    mc_strong: S({ name: 'หีบหนัก', icon: 'sk_mc_strong', pass: (lv, p) => (NC.wtypeOf && NC.wtypeOf(NC.weaponDef(p)) === 'mace' ? { atk: lv * 2, def: lv >= 10 ? 5 : 0 } : null),
      desc: (lv) => `ถือหีบหรือกระบอง ATK +${lv * 2}%${lv >= 10 ? ' · DEF +5' : ''}` }),
    mc_thrift: S({ name: 'ของไม่หมดเป้', icon: 'sk_mc_thrift', pass: () => ({}),
      desc: (lv) => `ปาของแล้ว ${lv * 6}% ไม่เสียขยะ${lv >= 5 ? ' · เป้ว่างก็ปาได้แรงเต็ม' : ''}` }),
    mc_pitch: S({ name: 'ปากหวาน', icon: 'sk_mc_pitch', kind: 'buff', type: 'buff', cd: 30, sp: (lv) => 18 + lv * 2, rgb: GOLD, circle: 'star', dur: () => 30,
      buff: (lv) => ({ crit: lv, luk: lv, atk: lv >= 10 ? 5 : 0 }),
      desc: (lv) => `30 วิ: คริ +${lv} LUK +${lv}${lv >= 5 ? ' · เพื่อนรอบตัวตีแรงขึ้น ' + lv + '%' : ''}${lv >= 10 ? ' · ATK +5%' : ''}` }),
    mc_knack: S({ name: 'มือขายของ', icon: 'sk_mc_knack', free: 1, pass: () => ({}), mul: (lv) => 0.4 + lv * 0.04,
      desc: (lv) => `ตีปกติครั้งที่ ${lv >= 5 ? 3 : 4} ปาของชิ้นเล็กใส่มอนอีกตัว ${Math.round((0.4 + lv * 0.04) * 100)}% ของ ATK (ใช้ขยะถ้ามี ได้ธาตุ)` }),
    mc_load: S({ name: 'แบกได้อีก', icon: 'sk_mc_load', pass: (lv) => ({ hpPct: lv * 2, def: lv }),
      desc: (lv) => `HP สูงสุด +${lv * 2}% DEF +${lv}` }),
  });
  for (const id of ['mc_strong', 'mc_thrift', 'mc_knack', 'mc_load']) { SK[id].active = false; SK[id].kind = 'passive'; }

  // one goods piece from the hand to (tx, ty): it bursts there (r) for k x the skill
  // (the goods fly as a painting and blow up where they land: X.lob + X.blast; o.from [x, ground y, height], o.fall straight
  // down from the sky, o.light / o.shake how big the blast looks)
  function throwGoods(game, p, id, tx, ty, r, k, o) {
    o = o || {};
    const j = takeJunk(game, p), rgb = ELRGB[j.el] || GOLD, col = ELCOL[j.el] || HGOLD;
    return X.lob(game, o.from || handFrom(p), [tx, ty], o.name || goodsPiece(j), { size: o.size || 66, dur: o.dur || 0.38, H: o.arc || 120, spin: 9, fall: o.fall,
      land(x, y) {
        const s = r / 90;
        X.blast(game, x, y, r, { fr: 'ob_goods_boom', col, light: o.light === undefined ? 1 : o.light, dust: 'cs_puff_', dustO: { crown: 2, skirt: 5, size: 0.75 },
          debris: [['cs_splinter_', 6, { size: [16 * s, 28 * s], sp: [160 * s, 420 * s], up: [300 * s, 700 * s] }],
            [COINS, 3, { size: [14 * s, 22 * s], sp: [100 * s, 300 * s], up: [500 * s, 800 * s], spin: 18 }]],
          shake: o.shake === undefined ? 5 : o.shake, zoom: o.zoom, sfx: [['im_crush', 0.7], ['body_wood', 0.6]].concat(o.boom ? [['ult_boom', 0.3]] : []) });
        for (const e of K.around(game, x, y, r)) {
          const res = K.hit(game, p, id, e, 0, 0, rgb, k * j.k, { element: j.el || undefined });
          if (o.each) o.each(e, res);
        }
        if (o.land) o.land(x, y);
      } });
  }

  RUN.mc_toss = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 0), 0.26);
    const [gx, gy] = K.ground(game, p, 520), a = NC.angle(p.x, p.y, gx, gy), d = Math.min(520, NC.dist(p.x, p.y, gx, gy));
    const spots = lv >= 10 ? [-0.22, 0, 0.22] : [0];
    spots.forEach((da, i) => V.at(i * 0.05, () => {
      const tx = p.x + Math.cos(a + da) * d, ty = p.y + Math.sin(a + da) * d;
      X.sfx('sw_light', p.x, 0.6);
      throwGoods(game, p, 'mc_toss', tx, ty, 90, 1, { land(x, y) {
        if (lv < 5 || i) return;
        const next = K.nearest(game, x, y, 280, 2).find((e) => NC.dist(e.x, e.y, x, y) > 40);
        if (next) throwGoods(game, p, 'mc_toss', next.x, next.y, 80, 0.6, { from: [x, y, 40], arc: 80, dur: 0.3, size: 52, light: 0.7, shake: 3 });
      } });
    }));
  };
  RUN.mc_crate = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 2), 0.34);
    // (thrown where he aims, 120-360 away; the spot is taken when he throws: the mouse may move on)
    const n = lv >= 5 ? 2 : 1, [gx, gy] = K.ground(game, p, 360), x0 = p.x, y0 = p.y;
    const a0 = NC.angle(x0, y0, gx, gy), d0 = Math.max(120, NC.dist(x0, y0, gx, gy));
    const R = 140 * (NC.skillScale ? NC.skillScale(p, 'mc_crate') : 1);
    X.sfx('sw_heavy', p.x, 0.8);
    for (let i = 0; i < n; i++) V.at(0.02 + i * 0.16, () => {
      const a = a0 + (n > 1 ? (i ? 0.3 : -0.3) : 0), tx = x0 + Math.cos(a) * d0, ty = y0 + Math.sin(a) * d0;
      X.crateFly(game, p, K.hand(p), [tx, ty], { land(x, y) {
        X.crateBurst(game, x, y, R);
        K.nova(game, p, 'mc_crate', x, y, 140, { fx: false, kb: 260, status: ['stun', lv >= 10 ? 1.4 : 0.8] });
      } });
    });
  };
  RUN.mc_sale = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.9);
    const [gx, gy] = K.ground(game, p, 600), n = 6 + lv * 2;
    X.dim(2.6, 0.3);
    V.light(gx, gy - 60, 520, GOLD, 0.9, 2.4);
    X.buffFx(game, p, { col: HGOLD, pieces: [GOODS_HD.concat(COINS), 10, 34], sfx: 'ult_rise' });   // (the pack bursts open)
    for (let i = 0; i < n; i++) V.at(0.3 + (i / n) * 1.4, () => {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 260, tx = gx + Math.cos(a) * d, ty = gy + Math.sin(a) * d * V.SQ;
      throwGoods(game, p, 'mc_sale', tx, ty, 85, 1, { from: [tx + 40, ty, 760], fall: true, dur: 0.34, size: 80, light: 0.7, shake: 4 });
    });
    V.at(1.95, () => {   // the last of the stock: one giant blast
      X.blast(game, gx, gy, 300, { fr: 'ob_mega_gold', frK: 2.2, gold: true, col: '#ffb860', light: 0.75, dust: 'cs_puff_', dustO: { crown: 8, skirt: 12, size: 1.3 },
        debris: [[COINS, 14, { size: [22, 34], sp: [200, 700], up: [600, 1200], spin: 18 }], [GOODS_HD, 4, { size: [50, 70], sp: [150, 450], up: [700, 1100] }]],
        mark: ['cs_crater', 1.4, 3.5], crack: true, shake: 16, zoom: 0.1, sfx: [['ult_boom', 1], ['boss_slam', 0.9], ['im_crush', 0.8]] });
      V.flash('255,200,120', 0.1, 0.35);
      for (const e of K.around(game, gx, gy, 300)) K.hit(game, p, 'mc_sale', e, ...K.push([gx, gy], e, 300), GOLD, 2, { big: true });
    });
  };
  RUN.mc_swing = function (game, p, lv) {
    const spins = lv >= 5 ? 2 : 1;
    if (lv >= 10) for (const e of K.around(game, p.x, p.y, 320)) K.pull(e, p.x, p.y, 520);
    for (let i = 0; i < spins; i++) V.at(i * 0.24, () => {
      K.pose(game, p, K.clip(p, 'swing', i % 2), 0.26);
      X.frames('ob_whirl_gold', p.x, p.y - 50, 360, { add: true, follow: p, flip: i % 2 === 1, speed: 1.15, s0: 0.95, s1: 1.12, erode: [0.72, 1] });
      X.glints(p.x, p.y - 50, 9, HGOLD, { sp: [420, 820] });
      const parts = [];
      X.puffs(parts, p.x, p.y, 'cs_puff_', { crown: 0, skirt: 6, s: 0.6 });
      X.emit(parts);
      for (const e of K.nova(game, p, 'mc_swing', p.x, p.y, 160, { fx: false, kb: 260, color: GOLD })) X.hitFx(game, e.x, e.y - 50, { col: HGOLD, k: 0.7, spark: 2 });
      V.shake(game, 4);
      X.sfx('sw_spin', p.x, 0.8);
    });
  };
  RUN.mc_slam = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'smash', 2) || K.clip(p, 'swing', 2), 0.5);
    const a = p.aim;
    K.dash(game, p, 'mc_slam', a, 180, 0.22, { hit: () => {}, end() {
      X.blast(game, p.x, p.y, 150, { fr: 'ob_quake', gold: true, dust: 'cs_puff_', dustO: { crown: 4, skirt: 10 }, mark: ['cs_crater', 2.2, 3], crack: true,
        shake: 10, zoom: 0.07, sfx: [['boss_slam', 0.9], ['im_crush', 0.8], ['ult_boom', 0.3]] });
      K.nova(game, p, 'mc_slam', p.x, p.y, 150, { fx: false, kb: 260, status: ['stun', 1] });
      if (lv >= 10) {
        const x0 = p.x, y0 = p.y;
        V.at(0.08, () => { for (const e of K.lineHits(game, x0, y0 - 30, a, 400, 120)) K.hit(game, p, 'mc_slam', e, Math.cos(a) * 200, Math.sin(a) * 140, GOLD, 0.6); });
        for (let i = 1; i <= 4; i++) V.at(0.06 + i * 0.07, () => X.blast(game, x0 + Math.cos(a) * i * 95, y0 + Math.sin(a) * i * 66, 72, { fr: 'ob_quake', light: 0.6,
          dust: 'cs_puff_', dustO: { crown: 1, skirt: 4, size: 0.7 }, shake: 4, sfx: [['im_crush', 0.5]] }));
      }
    } });
  };
  RUN.mc_pitch = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.5);
    K.startBuff(game, p, 'mc_pitch', lv, 30);
    X.buffFx(game, p, { col: HGOLD, pieces: [COINS, 9, 30] });
    if (lv >= 5) K.buffFriends(game, p, { dur: 30, atk: 1 + lv * 0.01, rgb: GOLD });
  };
  // มือขายของ: every 3rd / 4th basic hit throws a small piece at another monster
  NC.basicHits.push((game, p, e) => {
    const lv = lvOf(p, 'mc_knack');
    if (!lv || !isJob(p, 'peddler')) return;
    p.mcKnack = (p.mcKnack || 0) + 1;
    if (p.mcKnack < (lv >= 5 ? 3 : 4)) return;
    p.mcKnack = 0;
    const other = K.nearest(game, e.x, e.y, 360, 3).find((o) => o !== e) || e;
    throwGoods(game, p, 'mc_knack', other.x, other.y, 60, 1, { from: [p.x, p.y, 80], arc: 90, dur: 0.3, size: 46, light: 0.55, shake: 2 });
  });

  // =====================================================================================================
  // นายคาราวาน: the cargo beetle, the rest stop, supplies, the crate wall, the phantom caravan
  // =====================================================================================================
  const P = NC.Pets;
  if (P && P.KINDS) {
    P.KINDS.beetle = { a: 'pet_beetle', b: 'pet_beetle_b', fly: 0, speed: 340, r: 30, reach: 105, solid: true, shadow: [42, 13] };
    for (let i = 1; i <= 3; i++) P.KINDS['crate' + i] = { a: 'fx_crate', b: 'fx_crate', fly: 0, speed: 0, r: 26, reach: 320, solid: true, shadow: [30, 9] };
  }
  const beetleOf = () => (P && P.get('beetle')) || null;
  K.def({
    cv_beetle: S({ name: 'เรียกด้วงขนของ', icon: 'sk_cv_beetle', free: 1, cd: 10, ro: 'm', sp: (lv) => 20 + lv * 2, mul: (lv) => 1.8 + lv * 0.18,
      desc: (lv, m) => `เรียกด้วงขนของมาช่วย (HP ${60 + lv * 4}% ของเรา) มอนหันมาตีด้วงได้ ด้วงพุ่งชน ${m}% ของ ATK${lv >= 5 ? ' · กระดองรับดาเมจลด 25%' : ''}${lv >= 10 ? ' · ด้วงล้มแล้วลังแตกรอบตัว' : ''}` }),
    cv_charge: S({ name: 'ด้วงพุ่งชน', icon: 'sk_cv_charge', cd: 5, ro: 'a', sp: (lv) => 14 + lv, mul: (lv) => 2.7 + lv * 0.27,
      need: () => (beetleOf() ? true : 'ต้องเรียกด้วงขนของก่อน'),
      desc: (lv, m) => `สั่งด้วงพุ่งชนเป็นแนวยาว 380 ${m}% ของ ATK มึน 0.8 วิ${lv >= 5 ? ' · ด้วงพุ่งกลับมาอีกรอบ' : ''}` }),
    cv_shell: S({ name: 'กระดองเหล็ก', icon: 'sk_cv_shell', kind: 'buff', type: 'buff', cd: 30, sp: (lv) => 18 + lv * 2, rgb: TEAL, circle: 'holy', dur: () => 30,
      buff: (lv) => ({ def: lv * 3, mdef: lv * 2, taken: lv >= 10 ? 10 : 0 }),
      desc: (lv) => `30 วิ: DEF +${lv * 3} MDEF +${lv * 2}${lv >= 5 ? ' · ปาร์ตี้รอบตัวรับดาเมจลด 15%' : ''}${lv >= 10 ? ' · ตัวเองรับดาเมจลดอีก 10%' : ''}` }),
    cv_camp: S({ name: 'ตั้งจุดพัก', icon: 'sk_cv_camp', cd: 14, ro: 'z', roLife: 8, sp: (lv) => 24 + lv * 2,
      desc: (lv) => `ตั้งจุดพักกลางทุ่ง 8 วิ รัศมี 240: ทุกวินาทีปาร์ตี้ในวงฟื้น HP ${r1(2 + lv * 0.25)}% SP 1%${lv >= 5 ? ' · DEF +10 ในวง' : ''}${lv >= 10 ? ' · ล้างสถานะผิดปกติ' : ''}` }),
    cv_supply: S({ name: 'แจกเสบียง', icon: 'sk_cv_supply', type: 'heal', cd: 6, ro: 'h', sp: (lv) => 20 + lv * 2,
      desc: (lv) => `เปิดลังแจกเสบียงทั้งปาร์ตี้รอบ 400: ฟื้น HP ${12 + lv}% (ใช้ขยะ 2 ชิ้น ถ้ามี +50%)` }),
    cv_route: S({ name: 'เส้นทางคาราวาน', icon: 'sk_cv_route', pass: (lv) => ({ spd: r1(lv * 1.5), flee: lv }),
      desc: (lv) => `เดินเร็วขึ้น ${r1(lv * 1.5)}% FLEE +${lv}` }),
    cv_wall: S({ name: 'กำแพงลังไม้', icon: 'sk_cv_wall', cd: 12, ro: 'u', sp: (lv) => 18 + lv * 2,
      desc: (lv) => `วางลังไม้ 3 ลังเป็นแนวข้างหน้า 8 วิ มอนรอบ 320 หันมาตีลัง (ลังละ HP ${30 + lv * 3}% ของเรา)${lv >= 5 ? ' · ลังแตกแล้วกระแทกรอบตัว' : ''}` }),
    cv_caravan: S({ name: 'ขบวนคาราวาน', icon: 'sk_cv_caravan', ult: true, max: 5, cd: 50, sp: (lv) => 40 + lv * 4, mul: (lv) => 1.4 + lv * 0.25,
      desc: (lv, m) => `ขบวนด้วงเงาวิ่งผ่านเป็นแนวยาว 900 สามระลอก ระลอกละ ${m}% ของ ATK แล้วปาร์ตี้ ATK +${10 + lv * 2}% 15 วิ` }),
  });
  SK.cv_route.active = false; SK.cv_route.kind = 'passive';
  RUN.cv_beetle = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.5);
    const q = P.summon(game, p, 'beetle', { skill: 'cv_beetle', lv, hp: 0.6 + lv * 0.04, every: 1.2, name: 'ด้วงขนของ', glow: TEAL,
      act(game, q, e) {
        q.lunge = 0.3; K.hit(game, p, 'cv_beetle', e, e.x > q.x ? 160 : -160, 0, TEAL);
        X.hitFx(game, e.x, e.y - 40, { col: HTEAL, k: 0.8, sfx: [['im_blunt', 0.5]] });
        const parts = []; X.puffs(parts, e.x, e.y, 'cs_puff_', { crown: 1, skirt: 3, s: 0.5 }); X.emit(parts);
      } });
    X.blast(game, q.x, q.y, 100, { fr: 'ob_quake', col: HTEAL, light: 0.8, dust: 'cs_puff_', dustO: { crown: 3, skirt: 6, size: 0.8 }, shake: 5,
      sfx: [['im_crush', 0.6], ['mv_insect', 0.6]] });   // (it bursts up out of the ground)
    q.guardK = lv >= 5 ? 0.75 : 1;
    q.hurtMod = (game, a, dmg) => dmg * (a.guardK || 1); // (the shell: party.js hurtAlly asks a summon's own hurtMod)
    if (lv >= 10) q.onFaint = (game, a) => { P.dismiss(a.type); X.crateBurst(game, a.x, a.y, 170, { col: HTEAL }); K.nova(game, p, 'cv_beetle', a.x, a.y, 180, { fx: false, mul: 2, kb: 300 }); };
  };
  RUN.cv_charge = function (game, p, lv) {
    const q = beetleOf();
    if (!q) return;
    K.pose(game, p, 'cheer', 0.3);
    const a = p.aim, go = (from, ang, back) => {
      const x0 = from[0], y0 = from[1], hit = new Set();
      let dust = 0;
      X.sfx('mv_insect', x0, 0.7);
      FX.add({ type: 'timer', layer: 'none', life: 0.36, x: x0, y: y0, update(z, dt) {
        const u = Math.min(1, z.t / 0.36);
        q.x = x0 + Math.cos(ang) * 380 * u; q.y = y0 + Math.sin(ang) * 380 * u * V.SQ; q.face = Math.cos(ang) >= 0 ? 1 : -1; q.lunge = 0.2;
        if ((dust -= dt) <= 0) { dust = 0.05; const parts = []; X.puffs(parts, q.x, q.y, 'cs_puff_', { crown: 0, skirt: 2, s: 0.55, sp: 0.4 }); X.emit(parts); }
        for (const e of K.around(game, q.x, q.y, 70)) if (!hit.has(e)) {
          hit.add(e); K.hit(game, p, 'cv_charge', e, Math.cos(ang) * 260, Math.sin(ang) * 180, TEAL, back ? 0.6 : 1); K.stun(game, e, 0.8);
          X.hitFx(game, e.x, e.y - 40, { col: HTEAL, k: 1, shake: 4, dir: Math.cos(ang) >= 0 ? 1 : -1, sfx: [['im_crush', 0.6]] });
        }
      }, onEnd() {
        X.blast(game, q.x, q.y, 95, { fr: 'ob_quake', col: HTEAL, light: 0.7, dust: 'cs_puff_', dustO: { crown: 2, skirt: 6, size: 0.8 }, shake: 5, sfx: [['im_crush', 0.5]] });
        if (!back && lv >= 5) go([q.x, q.y], ang + Math.PI, true);
      } });
    };
    go([q.x, q.y], a, false);
  };
  RUN.cv_shell = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    K.startBuff(game, p, 'cv_shell', lv, 30);
    X.buffFx(game, p, { col: HTEAL, sfx: 'buff_shield' });
    if (lv >= 5) K.buffFriends(game, p, { dur: 30, guard: 0.85, rgb: TEAL });
    const q = beetleOf();
    if (q) { q.guardK = Math.min(q.guardK || 1, 0.6); X.buffFx(game, q, { col: HTEAL, k: 0.7 }); }
  };
  RUN.cv_camp = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.5);
    const x = p.x, y = p.y, R = 240 * (NC.skillScale ? NC.skillScale(p, 'cv_camp') : 1);
    X.drop(game, x - 70, y - 4, 'cs_crate', { size: 80, H: 420, land(cx, cy) { X.stay('cs_crate', cx, cy, 7.7, { size: 80 }); X.blast(game, cx, cy, 60, { fr: 'ob_quake', light: 0.4, haze: false, dust: 'cs_puff_', dustO: { crown: 1, skirt: 4, size: 0.6 }, shake: 3, sfx: [['body_wood', 0.6]] }); } });
    X.stay('hm_rug', x + 64, y + 6, 8, { size: 92 });
    if (NC.LightKit) NC.LightKit.ring(x, y, { r0: 30, r1: R, life: 0.6, col: HTEAL, a: 0.6 });
    V.light(x, y - 40, R * 2, '255,210,150', 0.8, 8);
    let acc = 1;
    FX.add({ type: 'timer', layer: 'none', life: 8, x, y, update(z, dt) {
      if ((acc += dt) < 1) return;
      acc -= 1;
      const who = [game.player].concat(K.friends(game, p, 900)).filter((a) => a && a.dead <= 0 && NC.dist(a.x, a.y, x, y) < R);
      for (const a of who) {
        K.heal(game, a, a.maxHp * (0.02 + lv * 0.0025) * K.healPow(p), { quiet: true });
        if (a === p && p.maxSp) p.sp = Math.min(p.maxSp, p.sp + p.maxSp * 0.01);
        if (lv >= 10 && a === game.player && NC.HS) NC.HS.cure(game, NC.HS.IDS.filter((id) => !(NC.HS.ST[id] && NC.HS.ST[id].hard)));
      }
      if (lv >= 5) p.cvCampDef = game.time + 1.2;
      for (const a of who) X.healFx(game, a, { col: HTEAL, k: 0.6 });
      X.glints(x, y - 20, 6, '#ffc890', { up: true, w: R * 0.5, sp: [60, 160], life: 1.6 });   // (embers of the camp rising)
    } });
  };
  NC.skillModSources.push((p) => (p.cvCampDef && NC.game && p.cvCampDef > NC.game.time ? { def: 10 } : null));
  RUN.cv_supply = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.45);
    let k = 1;
    const a = takeJunk(game, p), b = takeJunk(game, p);
    if (a.id && b.id) k = 1.5;
    const who = [game.player].concat(K.friends(game, p, 400)).filter((w) => w && w.dead <= 0);
    X.drop(game, p.x + (p.face || 1) * 70, p.y + 10, 'cs_crate', { size: 90, H: 520, land(cx, cy) {
      X.crateBurst(game, cx, cy, 80, { shake: 4, zoom: 0, col: HTEAL });
      for (const w of who) { K.heal(game, w, w.maxHp * (0.12 + lv * 0.01) * k * K.healPow(p)); X.healFx(game, w, { col: HTEAL }); }
    } });
  };
  RUN.cv_wall = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 1), 0.4);
    const a = p.aim, cx = p.x + Math.cos(a) * 170, cy = p.y + Math.sin(a) * 120;
    [-1, 0, 1].forEach((s, i) => V.at(i * 0.08, () => {
      const x = cx + Math.cos(a + Math.PI / 2) * s * 90, y = cy + Math.sin(a + Math.PI / 2) * s * 60;
      X.drop(game, x, y, 'cs_crate', { size: 92, H: 560, land() {   // (each crate comes down from the sky, then stands as the decoy)
        X.blast(game, x, y, 80, { fr: 'ob_quake', col: HGOLD, light: 0.6, dust: 'cs_puff_', dustO: { crown: 2, skirt: 5, size: 0.7 }, shake: 4, sfx: [['body_wood', 0.7], ['im_crush', 0.5]] });
        const q = P.summon(game, p, 'crate' + (i + 1), { skill: 'cv_wall', lv, hp: 0.3 + lv * 0.03, dur: 8, every: 1, name: 'ลังไม้', glow: GOLD,
          act(game, q, e) { if (!e.tgt || Math.random() < 0.7) { e.tgt = q; e.tgtLock = game.time + 2; } } });
        q.x = x; q.y = y; q.scale = 1.5;
        if (lv >= 5) q.onFaint = (game, c) => { P.dismiss(c.type); X.crateBurst(game, c.x, c.y, 140, { shake: 7, zoom: 0.04 }); K.nova(game, p, 'cv_wall', c.x, c.y, 140, { fx: false, mul: 1.2, kb: 200 }); };
      } });
    }));
  };
  RUN.cv_caravan = function (game, p, lv) {
    K.pose(game, p, 'cheer', 1);
    const a = p.aim, x0 = p.x - Math.cos(a) * 300, y0 = p.y - Math.sin(a) * 210;
    X.dim(1.8, 0.3);
    V.flash(TEAL, 0.08, 0.4);
    X.sfx('ult_rise', p.x, 0.7);
    for (let w = 0; w < 3; w++) V.at(0.2 + w * 0.35, () => {
      // the dust the herd kicks up, rolling along behind it, and the speed of it
      const dust = [];
      for (let j = 0; j < 12; j++) {
        const u = j / 12, off = rand(-90, 90), px = x0 + Math.cos(a) * 1100 * u - Math.sin(a) * off, py = y0 + Math.sin(a) * 770 * u + Math.cos(a) * off * 0.6;
        X.puffs(dust, px, py, 'cs_puff_', { crown: 0, skirt: 2, s: 0.7, sp: 0.5, t: 0 });
        for (let k = dust.length - 2; k < dust.length; k++) if (dust[k]) dust[k].t = -u * 0.55;
      }
      X.emit(dust);
      // the herd's own rolling dust bank (the painted stampede frames, looping) sweeping along the line with the beetles
      X.emit([{ fr: 'ob_stampede', loop: true, x: x0, y: y0 + 20, vx: Math.cos(a) * 2000, vy: Math.sin(a) * 1400, size: 560, life: 0.55, flip: Math.cos(a) < 0,
        fade: (u) => Math.min(1, u * 6, (1 - u) * 4), erode: [0.8, 1] }]);
      X.glints(x0 + Math.cos(a) * 550, y0 + Math.sin(a) * 385, 10, HTEAL, { sp: [500, 900], w: 200 });
      X.sfx('mv_insect', p.x, 0.8); X.sfx('im_crush', p.x, 0.5);
      for (let i = 0; i < 5; i++) {
        const off = (i - 2) * 46;
        FX.add({ type: 'obtpiece', layer: 'high', x: x0, y: y0, life: 0.55, draw(ctx, q, u) {
          const x = x0 + Math.cos(a) * 1100 * u - Math.sin(a) * off, y = y0 + Math.sin(a) * 770 * u + Math.cos(a) * off * 0.6;
          F.piece(ctx, 'pet_beetle', x, y, { scale: 0.85, alpha: 0.55 * Math.sin(u * Math.PI), flip: Math.cos(a) > 0, tint: [TEAL, 0.6] });
        } });
      }
      const got = K.lineHits(game, x0, y0 - 30, a, 1100, 200);
      for (const e of got) { K.hit(game, p, 'cv_caravan', e, Math.cos(a) * 240, Math.sin(a) * 170, TEAL, 1, { big: w === 2 }); X.hitFx(game, e.x, e.y - 40, { col: HTEAL, k: 0.9, dir: Math.cos(a) >= 0 ? 1 : -1 }); }
      V.shake(game, 6);
      if (w === 2 && got.length) {   // (the last wave crashes into the pack)
        const cx = got.reduce((s, e) => s + e.x, 0) / got.length, cy = got.reduce((s, e) => s + e.y, 0) / got.length;
        X.blast(game, cx, cy, 200, { fr: 'ob_quake', col: HTEAL, dust: 'cs_puff_', dustO: { crown: 5, skirt: 10 }, mark: ['cs_crater', 1.8, 3], crack: true,
          shake: 12, zoom: 0.08, sfx: [['boss_slam', 0.9], ['ult_boom', 0.6], ['im_crush', 0.8]] });
      }
    });
    V.at(1.4, () => { K.buffFriends(game, p, { dur: 15, atk: 1.1 + lv * 0.02, rgb: TEAL }); p.cvRally = game.time + 15; p.cvRallyLv = lv; X.buffFx(game, p, { col: HTEAL }); });
  };
  NC.skillModSources.push((p) => (p.cvRally && NC.game && p.cvRally > NC.game.time ? { atk: 10 + (p.cvRallyLv || 1) * 2 } : null));

  // =====================================================================================================
  // เจ้าหนี้: debt on monsters, collected at once; the strongest strikes burn coins
  // =====================================================================================================
  const debtOf = (e) => (e && e.debt && e.debt.n > 0 ? e.debt.n : 0);
  function addDebt(game, p, e, n) {
    if (!alive(e)) return;
    const d = e.debt || (e.debt = { n: 0, t: game.time, by: p });
    d.n = Math.min(10, d.n + n); d.t = game.time; d.by = p;
    X.emit([{ n: 'hm_slip', x: e.x + rand(-20, 20), y: e.y, z: 110, vz: 60, dragZ: 2, size: 34, s0: 1.6, s1: 1, grow: (u) => X.out(u * 4, 3), rot: rand(-0.4, 0.4), life: 0.5, erode: [0.5, 1] }]);
  }
  const coins = (p) => p.coins || 0;
  const pay = (p, n) => { if (NC.Online && NC.Online.active) return true; if (coins(p) < n) return false; p.coins -= n; return true; };
  K.def({
    dbt_mark: S({ name: 'จดหนี้', icon: 'sk_dbt_mark', free: 1, cd: 1, ro: 's', sp: (lv) => 8 + lv, mul: (lv) => 0.8 + lv * 0.08,
      desc: (lv, m) => `ปาใบจดหนี้ใส่มอน ${m}% ของ ATK ติดหนี้ ${lv >= 5 ? 3 : 2} ชั้น (สูงสุด 10 ชั้น ชั้นละ +3% ดาเมจจากเรา)${lv >= 10 ? ' · ติดตัวข้าง ๆ อีก 2 ตัว' : ''}` }),
    dbt_collect: S({ name: 'ทวงหนี้', icon: 'sk_dbt_collect', cd: 4, ro: 'a', sp: (lv) => 16 + lv * 2, mul: (lv) => 0.38 + lv * 0.04,
      desc: (lv, m) => `ทวงหนี้มอนทุกตัวรอบ 450: ชั้นละ ${m}% ของ ATK แล้วหนี้หมด${lv >= 5 ? ' · ฟื้น HP ชั้นละ 1%' : ''}${lv >= 10 ? ' · หนี้ครึ่งหนึ่งย้ายไปตัวข้าง ๆ' : ''}` }),
    dbt_close: S({ name: 'ปิดบัญชี', icon: 'sk_dbt_close', ult: true, max: 5, cd: 50, sp: (lv) => 40 + lv * 4, mul: (lv) => 0.6 + lv * 0.08,
      desc: (lv, m) => `จ่าย ${lv * 100} เหรียญ: ทวงหนี้ทุกตัวในจอ ×2 (ชั้นละ ${m}% ของ ATK) ฝนเหรียญทองทับ ตัวที่ไม่มีหนี้ได้ 3 ชั้นก่อน` }),
    dbt_coin: S({ name: 'เหรียญทองฟาด', icon: 'sk_dbt_coin', cd: 3, ro: 'a', sp: (lv) => 10 + lv, mul: (lv) => 3 + lv * 0.3,
      desc: (lv, m) => `จ่าย ${15 + lv * 5} เหรียญ: เหรียญทองยักษ์ฟาดเป้า ${m}% ของ ATK ติดหนี้ 2 ชั้น${lv >= 5 ? ' · เหรียญแตกโดนรอบ 120' : ''}` }),
    dbt_seize: S({ name: 'ยึดทรัพย์', icon: 'sk_dbt_seize', cd: 10, ro: 'u', sp: (lv) => 16 + lv,
      desc: (lv) => `ยึดแรงของมอนรอบ 300 ${8} วิ: มอนตีเบาลง ${10 + lv * 2}% เราตีแรงขึ้น ${lv * 2}%` }),
    dbt_contract: S({ name: 'สัญญาผูกมัด', icon: 'sk_dbt_contract', cd: 12, ro: 'u', sp: (lv) => 18 + lv,
      desc: (lv) => `ผูกสัญญากับมอนตัวที่เล็ง 10 วิ: ใครตีโดน หนี้ +1 (ทุก 0.5 วิ)${lv >= 5 ? ' · มันเดินช้าลง' : ''}` }),
    dbt_interest: S({ name: 'ดอกเบี้ยทบต้น', icon: 'sk_dbt_interest', pass: () => ({}),
      desc: (lv) => `ตีปกติ ${25 + Math.round(lv * 3.5)}% ติดหนี้ 1 ชั้น · หนี้บนมอนงอกเอง +1 ทุก ${lv >= 10 ? 3 : 4} วิ` }),
    dbt_greed: S({ name: 'ละโมบ', icon: 'sk_dbt_greed', pass: (lv) => ({ critDmg: lv * 2, crit: r1(lv * 0.4) }),
      desc: (lv) => `แรงคริ +${lv * 2}% คริ +${r1(lv * 0.4)}` }),
  });
  for (const id of ['dbt_interest', 'dbt_greed']) { SK[id].active = false; SK[id].kind = 'passive'; }
  SK.dbt_coin.need = (game, p) => (NC.Online && NC.Online.active) || coins(p) >= 15 + lvOf(p, 'dbt_coin') * 5 ? true : 'เหรียญไม่พอ';
  SK.dbt_close.need = (game, p) => (NC.Online && NC.Online.active) || coins(p) >= lvOf(p, 'dbt_close') * 100 ? true : 'เหรียญไม่พอ';
  // each stack: +3% from the collector's hits (all of them, basic ones too)
  const baseHH = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const g = NC.game, p = g && g.player;
    if (p && d === p.d && debtOf(e) && isJob(p, 'collector')) o = Object.assign({}, o, { mul: (o && o.mul !== undefined ? o.mul : 1) * (1 + debtOf(e) * 0.03) });
    return baseHH.call(this, d, e, o);
  };
  RUN.dbt_mark = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 0), 0.24);
    const t = K.target(game, p, 560);
    const a = t ? NC.angle(p.x, p.y - 60, t.x, t.y - 50) : p.aim;
    K.shot(game, p, 'dbt_mark', { from: [p.x, p.y - 70], ang: a, v: 1000, range: 560, r: 30, home: t ? 6 : 0, target: t, rgb: COIN, spin: 10,
      look(ctx, q) { if (!X.piece(ctx, 'hm_slip', q.x, q.y, 44, q.rot)) F.piece(ctx, 'fx_slip', q.x, q.y, { rot: q.rot, scale: 1.1 }); },
      hit(e) {
        K.hit(game, p, 'dbt_mark', e, 0, 0, COIN);
        X.hitFx(game, e.x, e.y - 60, { col: HCRIM, k: 0.8, piece: ['hm_seal', 46, 1.9], shake: 2, sfx: [['im_stab', 0.6]] });
        addDebt(game, p, e, lv >= 5 ? 3 : 2);
        if (lv >= 10) for (const o of K.nearest(game, e.x, e.y, 220, 3).filter((o) => o !== e).slice(0, 2)) addDebt(game, p, o, 2);
      } });
  };
  function collect(game, p, id, x, y, R, k) {
    const lv = lvOf(p, 'dbt_collect');
    let healed = 0;
    for (const e of K.around(game, x, y, R)) {
      const n = debtOf(e);
      if (!n) continue;
      e.debt.n = 0;
      coinBurst(game, e.x, e.y, 0.5 + n * 0.08);
      K.hit(game, p, id, e, 0, 0, COIN, n * k, { big: n >= 6 });
      healed += n;
      if (id === 'dbt_collect' && lv >= 10) { const o = K.nearest(game, e.x, e.y, 260, 3).find((o) => o !== e && !debtOf(o)); if (o) addDebt(game, p, o, Math.floor(n / 2)); }
    }
    if (healed && lv >= 5) K.heal(game, p, p.maxHp * 0.01 * healed, { quiet: true });
    return healed;
  }
  RUN.dbt_collect = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.35);
    if (NC.LightKit) NC.LightKit.ring(p.x, p.y, { r0: 30, r1: 470, life: 0.5, col: HCOIN, a: 0.7 });
    X.glints(p.x, p.y - 60, 8, HCOIN, { up: true, w: 40 });
    if (collect(game, p, 'dbt_collect', p.x, p.y, 450, 1)) { V.shake(game, 6); X.sfx('im_crush', p.x, 0.6); }
  };
  RUN.dbt_close = function (game, p, lv) {
    if (!pay(p, lv * 100)) return;
    K.pose(game, p, 'cheer', 1);
    X.dim(1.8, 0.3);
    V.flash(COIN, 0.1, 0.4);
    X.buffFx(game, p, { col: HCOIN, pieces: [COINS, 12, 34], sfx: 'ult_rise' });
    for (const e of K.around(game, p.x, p.y, 760)) if (!debtOf(e)) addDebt(game, p, e, 3);
    for (let i = 0; i < 28; i++) V.at(i * 0.025, () => {   // (a rain of gold coins)
      const x = p.x + rand(-520, 520), y = p.y + rand(-330, 330);
      X.drop(game, x, y, any(COINS), { size: rand(30, 46), H: rand(600, 760), dur: 0.3, shadow: false, land(lx, ly) { X.glints(lx, ly - 10, 2, HCOIN, { sp: [120, 260] }); X.sfx('coin', lx, 0.4); } });
    });
    V.at(0.6, () => {
      const got = K.around(game, p.x, p.y, 760).filter((e) => debtOf(e));
      collect(game, p, 'dbt_close', p.x, p.y, 760, 2);
      if (got.length) {
        const cx = got.reduce((s, e) => s + e.x, 0) / got.length, cy = got.reduce((s, e) => s + e.y, 0) / got.length;
        X.blast(game, cx, cy, 260, { fr: 'ob_mega_gold', frK: 2.1, gold: true, col: '#ffcf60', light: 0.75, dust: 'cs_puff_', dustO: { crown: 6, skirt: 10, size: 1.2 },
          debris: [[COINS, 18, { size: [22, 36], sp: [200, 760], up: [600, 1250], spin: 18 }]], mark: ['cs_crater', 1.4, 3.2],
          shake: 15, zoom: 0.1, sfx: [['ult_boom', 1], ['boss_slam', 0.8], ['coin', 0.9]] });
      } else V.shake(game, 10);
    });
  };
  RUN.dbt_coin = function (game, p, lv) {
    if (!pay(p, 15 + lv * 5)) return;
    K.pose(game, p, K.clip(p, 'swing', 2), 0.34);
    const t = K.target(game, p, 300) || K.nearest(game, p.x, p.y, 300, 1, p.aim, 0.9)[0];
    if (!t) return;
    X.drop(game, t.x, t.y, 'hm_coin0', { size: 150, H: 640, dur: 0.24, dx: 40, land(x, y) {
      K.hit(game, p, 'dbt_coin', t, 0, 0, COIN, 1, { big: true });
      addDebt(game, p, t, 2);
      X.blast(game, x, y, 115, { fr: 'ob_quake', gold: true, col: HCOIN, debris: [[COINS, 8, { size: [18, 28], sp: [150, 450], up: [600, 1000], spin: 18 }]], mark: ['cs_crater', 1.8, 2.5],
        shake: 9, zoom: 0.06, sfx: [['boss_slam', 0.8], ['coin', 0.9], ['im_crush', 0.6]] });
      coinBurst(game, x, y, 0.8);
      if (lv >= 5) for (const e of K.around(game, x, y, 120)) if (e !== t) K.hit(game, p, 'dbt_coin', e, 0, 0, COIN, 0.5);
    } });
  };
  RUN.dbt_seize = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    if (NC.LightKit) NC.LightKit.ring(p.x, p.y, { r0: 30, r1: 320, life: 0.5, col: HCRIM, a: 0.7 });
    for (const e of K.around(game, p.x, p.y, 300)) {
      K.weak(game, e, 1 - (0.1 + lv * 0.02), 8);
      X.hitFx(game, e.x, e.y - 60, { col: HCRIM, k: 0.7, piece: ['hm_seal', 40, 1.8] });
      for (let i = 0; i < 3; i++) V.at(0.1 + i * 0.07, () => X.lob(game, [e.x, e.y, 90], [p.x + rand(-20, 20), p.y], any(COINS), { size: 26, H: 140, dur: 0.42, shadow: false, trail: false, land() { X.sfx('coin', p.x, 0.4); } }));
    }
    p.dbtSeize = game.time + 8; p.dbtSeizeLv = lv;
    V.at(0.5, () => X.buffFx(game, p, { col: HCOIN }));
  };
  NC.skillModSources.push((p) => (p.dbtSeize && NC.game && p.dbtSeize > NC.game.time ? { atk: (p.dbtSeizeLv || 1) * 2 } : null));
  RUN.dbt_contract = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 1), 0.3);
    const t = K.target(game, p, 520);
    if (!t) return;
    t.contract = { until: game.time + 10, by: p, lv, tick: 0 };
    addDebt(game, p, t, 1);
    X.hitFx(game, t.x, t.y - 60, { col: HCRIM, k: 0.9, piece: ['hm_seal', 54, 2], shake: 3, sfx: [['im_stab', 0.6]] });
    const L = NC.LightKit;
    if (L) { L.line(p.x, p.y - 60, t.x, t.y - 60, { col: HCRIM, life: 0.45, w: 10 }); for (let i = 0; i < 4; i++) V.at(i * 2.5, () => { if (alive(t)) L.ring(t.x, t.y, { r0: 20, r1: 90, life: 0.6, col: HCRIM, a: 0.6, follow: t }); }); }
    if (lv >= 5) t.slow = Math.max(t.slow || 0, 10);
  };
  // ดอกเบี้ยทบต้น: basic hits mark, the debt grows by itself; สัญญาผูกมัด: hits on the bound one add debt
  NC.basicHits.push((game, p, e) => {
    const lv = lvOf(p, 'dbt_interest');
    if (lv && isJob(p, 'collector') && Math.random() < 0.25 + lv * 0.035) addDebt(game, p, e, 1);
  });
  const baseDE = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r) {
    const out = baseDE.apply(this, arguments);
    const c = e && e.contract;
    if (c && c.until > game.time && r && !r.miss && game.time - c.tick > 0.5) { c.tick = game.time; addDebt(game, c.by, e, 1); }
    return out;
  };
  NC.skillTicks.push((game, p, dt) => {
    const lv = lvOf(p, 'dbt_interest');
    if (!lv || !isJob(p, 'collector')) return;
    const every = lv >= 10 ? 3 : 4;
    for (const e of game.enemies) if (debtOf(e) && e.debt.by === p && game.time - e.debt.t >= every) { e.debt.n = Math.min(10, e.debt.n + 1); e.debt.t = game.time; }
  });
  // the debt over a monster: small slips in a fan, one per stack (the painted slip; code only places them)
  FX.def('dbtmarks', (ctx, q) => {
    const g = NC.game;
    if (!g) return;
    for (const e of g.enemies) {
      const n = debtOf(e);
      if (!n || !alive(e)) continue;
      for (let i = 0; i < n; i++) { const x = e.x - (n - 1) * 7 + i * 14, y = e.y - 150 - (i % 2) * 6; if (!X.piece(ctx, 'hm_slip', x, y, 22, (i - n / 2) * 0.12)) F.piece(ctx, 'fx_slip', x, y, { scale: 0.55, rot: (i - n / 2) * 0.12 }); }
    }
  }, 'glow');
  NC.skillTicks.push((game, p) => { if (isJob(p, 'collector') && !FX.list.some((f) => f.type === 'dbtmarks')) FX.add({ type: 'dbtmarks', layer: 'glow', life: 1e9, x: 0, y: 0 }); });

  // =====================================================================================================
  // lines, the skill lists, the weapon rules (as samurai_skills.js)
  // =====================================================================================================
  const LINES = {
    peddler: [['goods', 'ปาสินค้า', 'neutral', null, 0], ['box', 'หีบเหล็ก', 'neutral', null, 0], ['trade', 'ค้าขาย', 'neutral', null, 1]],
    caravan: [['herd', 'ด้วงขนของ', 'neutral', 'box', 0], ['camp', 'จุดพัก', 'neutral', 'trade', 1], ['convoy', 'ขบวนคาราวาน', 'neutral', 'goods', 0]],
    collector: [['ledger', 'บัญชีหนี้', 'neutral', 'goods', 0], ['claim', 'ยึดทรัพย์', 'neutral', 'box', 0], ['interest', 'ดอกเบี้ย', 'neutral', 'trade', 1]],
  };
  const PLAN = {
    peddler: [
      ['mc_toss', 'goods', 10, 1, [], 'Lv5 เด้งต่ออีกตัว · Lv10 ปา 3 ชิ้นเป็นพัด'],
      ['mc_crate', 'goods', 10, 0, [['mc_toss', 3]], 'Lv5 ขว้าง 2 ลัง · Lv10 มึนนานขึ้น'],
      ['mc_sale', 'goods', 5, 0, [['mc_toss', 5], ['mc_crate', 3]], 'สินค้ามากขึ้นทุกเลเวล'],
      ['mc_swing', 'box', 10, 1, [], 'Lv5 หมุนสองรอบ · Lv10 ดูดมอนเข้ามา'],
      ['mc_slam', 'box', 10, 0, [['mc_swing', 3]], 'Lv10 คลื่นพื้นแตกพุ่งต่อ'],
      ['mc_strong', 'box', 10, 0, [], 'Lv10 DEF +5'],
      ['mc_knack', 'trade', 10, 1, [], 'Lv5 ทุกครั้งที่ 3'],
      ['mc_thrift', 'trade', 10, 0, [['mc_knack', 3]], 'Lv5 เป้ว่างก็ปาแรงเต็ม'],
      ['mc_pitch', 'trade', 10, 0, [['mc_knack', 5]], 'Lv5 เพื่อนตีแรงขึ้น · Lv10 ATK +5%'],
      ['mc_load', 'trade', 10, 0, [], 'ทุกเลเวล HP +2% DEF +1'],
    ],
    caravan: [
      ['cv_beetle', 'herd', 10, 1, [], 'Lv5 กระดองรับดาเมจลด · Lv10 ล้มแล้วระเบิดลัง'],
      ['cv_charge', 'herd', 10, 0, [['cv_beetle', 3]], 'Lv5 พุ่งกลับอีกรอบ'],
      ['cv_shell', 'herd', 10, 0, [['cv_beetle', 3]], 'Lv5 ปาร์ตี้รับดาเมจลด · Lv10 ตัวเองลดอีก'],
      ['cv_camp', 'camp', 10, 1, [], 'Lv5 DEF +10 ในวง · Lv10 ล้างสถานะ'],
      ['cv_supply', 'camp', 10, 0, [['cv_camp', 3]], 'ใช้ขยะ 2 ชิ้นแรงขึ้น 50%'],
      ['cv_route', 'camp', 10, 0, [], 'เดินเร็วขึ้น FLEE เพิ่ม'],
      ['cv_wall', 'convoy', 10, 0, [], 'Lv5 ลังแตกแล้วกระแทก'],
      ['cv_caravan', 'convoy', 5, 0, [['cv_wall', 3], ['cv_charge', 3]], 'ขบวนสามระลอก แล้วปาร์ตี้ตีแรงขึ้น'],
    ],
    collector: [
      ['dbt_mark', 'ledger', 10, 1, [], 'Lv5 ติด 3 ชั้น · Lv10 ติดตัวข้าง ๆ'],
      ['dbt_collect', 'ledger', 10, 0, [['dbt_mark', 3]], 'Lv5 ฟื้น HP · Lv10 หนี้ย้ายตัว'],
      ['dbt_close', 'ledger', 5, 0, [['dbt_collect', 5], ['dbt_coin', 3]], 'จ่ายเหรียญ ทวงหนี้ทั้งจอ ×2'],
      ['dbt_coin', 'claim', 10, 0, [], 'จ่ายเหรียญ · Lv5 แตกรอบตัว'],
      ['dbt_seize', 'claim', 10, 0, [['dbt_coin', 3]], 'มอนอ่อนลง เราแรงขึ้น'],
      ['dbt_contract', 'claim', 10, 0, [['dbt_mark', 3]], 'Lv5 มอนเดินช้า'],
      ['dbt_interest', 'interest', 10, 1, [], 'Lv10 หนี้งอกทุก 3 วิ'],
      ['dbt_greed', 'interest', 10, 0, [['dbt_interest', 3]], 'แรงคริและคริเพิ่ม'],
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
  if (NC.weaponRule) for (const id of ['mc_swing', 'mc_slam']) NC.weaponRule(id, 'n:mace');
  NC.OBT_MERCHANT = { junkOf, takeJunk, addDebt, debtOf };
})();
