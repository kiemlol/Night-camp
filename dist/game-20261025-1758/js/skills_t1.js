/* skills_t1.js — the 1st jobs' six new skills each (the user wanted 10 skills per job: actives, buffs and passives to
   build with), so every 1st job has its four old ones + these six (+ the three shared passives):
     อัศวิน   หมุนฟาดกระเด็น · แทงสามจังหวะ · ตะโกนท้าทาย · เร่งเพลงดาบ (บัฟ) · ชำนาญดาบ · ผิวเหล็ก
     จอมเวท  กำแพงไฟ · หินแหลมพสุธา · วงน้ำแข็ง · สมาธิเวท (บัฟ) · ฟื้นฟูมานา · ชำนาญธาตุ
     นักธนู   ตาเหยี่ยว · ชำนาญธนู · สมาธิเล็ง (บัฟ) · ธนูกระแทก · กับดักเถาวัลย์ · ยิงกระจาย
     โจร     ขโมยของ · ซ่อนตัว (บัฟ) · โจมตีสองครั้ง · ชำนาญมีด · แทงข้างหลัง · จู่โจมจากเงา
     พระ     เพิ่มความเร็ว (บัฟ) · พรเกราะกาย (บัฟ) · พรคุ้มครอง · ปราบมาร · อาวุธแสงชำระ (บัฟ) · ชุบชีวิต
   Also the traps (NC.Traps: the archer's snare, the ranger's blast and freezing traps) and hiding (the rogue's, the
   assassin's cloak: monsters lose the hero, he fades). Built with skillkit.js; numbers in each entry, looks in RUN. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS;
  const { C, P, TAU } = K;
  const rand = NC.rand;
  const W = (p) => NC.weaponDef(p) || {};
  const melee = (p) => { const w = W(p); return !!w.style && !w.magic && w.style !== 'arrow'; };

  // the new skills join each 1st job's list (before the shared passives)
  const JOIN = {
    knight: ['kn_bowling', 'kn_pierce', 'kn_provoke', 'kn_quicken', 'kn_swordmastery', 'kn_ironskin'],
    mage: ['mg_firewall', 'mg_quake', 'mg_frostnova', 'mg_amplify', 'mg_sprecovery', 'mg_elemmastery'],
    archer: ['ar_owl', 'ar_bowmastery', 'ar_concentrate', 'ar_charge', 'ar_snare', 'ar_multishot'],
    rogue: ['ro_steal', 'ro_hide', 'ro_double', 'ro_dagger', 'ro_backstab', 'ro_raid'],
    priest: ['pr_agi', 'pr_angelus', 'pr_protect', 'pr_demonbane', 'pr_aspersio', 'pr_resurrect'],
  };
  for (const j in JOIN) {
    const L = NC.JOBS[j].skills, at = L.indexOf('mastery');
    L.splice(at < 0 ? L.length : at, 0, ...JOIN[j].filter((s) => !L.includes(s)));
  }
  const S = K.S, r1 = (v) => Math.round(v * 10) / 10;

  K.def({
    // ======== knight ========
    kn_bowling: S({ name: 'หมุนฟาดกระเด็น', icon: 'sk_kn_bowling', req: [['bash', 5]], cd: 6, sp: (lv) => 14 + lv, mul: (lv) => 1.8 + lv * 0.28,
      desc: (lv, m) => `ฟันหมุนรอบตัว 2 รอบ รอบละ ${m}% ของ ATK รอบหลังผลักศัตรูกระเด็น` }),
    kn_pierce: S({ name: 'แทงสามจังหวะ', icon: 'sk_kn_pierce', req: [['bash', 3]], cd: 3.5, sp: (lv) => 6 + lv, mul: (lv) => 1.6 + lv * 0.28,
      desc: (lv, m) => `แทงไปข้างหน้า 3 ครั้งเป็นแนวยาว ครั้งละ ${m}% ของ ATK โดนทุกตัวในแนว` }),
    kn_provoke: S({ name: 'ตะโกนท้าทาย', icon: 'sk_kn_provoke', type: 'debuff', cd: 12, sp: (lv) => 8 + lv, mul: () => 0,
      desc: (lv) => `ตะโกนท้าศัตรูรอบตัว ให้หันมาสู้กับเรา และรับดาเมจเพิ่ม ${10 + lv * 3}% นาน 10 วิ` }),
    kn_quicken: S({ name: 'เร่งเพลงดาบ', icon: 'sk_kn_quicken', kind: 'buff', req: [['kn_swordmastery', 3]], cd: 30, sp: (lv) => 14 + lv * 2, rgb: '255,190,90',
      dur: (lv) => 20 + lv * 4, buff: (lv) => ({ aspd: 8 + lv * 2, crit: r1(1 + lv * 0.6) }),
      desc: (lv) => `${20 + lv * 4} วิ: โจมตีเร็วขึ้น ${8 + lv * 2}% คริติคอล +${r1(1 + lv * 0.6)}%` }),
    kn_swordmastery: S({ name: 'ชำนาญดาบ', icon: 'sk_kn_swordmastery', pass: (lv, p) => (W(p).style === 'swing' && !W(p).dual ? { atk: lv * 2, hit: lv } : null),
      // (2026-10-20 Discord #147: dual swords never counted, here or on the server, and the text said nothing of it)
      desc: (lv) => `ถือดาบ ดาบใหญ่ ขวาน หรือกระบอง (ไม่นับดาบคู่): ATK +${lv * 2}% ความแม่น +${lv}` }),
    kn_ironskin: S({ name: 'ผิวเหล็ก', icon: 'sk_kn_ironskin', pass: (lv) => ({ def: lv, hpPct: lv, hpReg: lv * 8 }),
      desc: (lv) => `DEF +${lv} · HP สูงสุด +${lv}% · ฟื้น HP +${lv * 8}%` }),

    // ======== mage ========
    mg_firewall: S({ name: 'กำแพงไฟ', icon: 'sk_mg_firewall', type: 'magic', element: 'fire', req: [['fireball', 4]], cd: 10, sp: (lv) => 20 + lv * 2,
      mul: (lv) => 0.35 + lv * 0.05, desc: (lv, m) => `กำแพงไฟยาวขวางหน้า 5 วิ ศัตรูที่แตะโดน ${m}% ของ MATK ทุก 0.3 วิ และถูกผลักกลับ` }),
    mg_quake: S({ name: 'หินแหลมพสุธา', icon: 'sk_mg_quake', type: 'magic', element: 'earth', cd: 5, sp: (lv) => 14 + lv, mul: (lv) => 0.8 + lv * 0.13,
      n: (lv) => 3 + Math.floor(lv / 3), desc: (lv, m) => `หินแหลม ${3 + Math.floor(lv / 3)} ระลอกผุดใต้ศัตรูใกล้เมาส์ ระลอกละ ${m}% ของ MATK` }),
    mg_frostnova: S({ name: 'วงน้ำแข็ง', icon: 'sk_mg_frostnova', type: 'magic', element: 'water', req: [['frostdiver', 3]], cd: 12, sp: (lv) => 22 + lv,
      mul: (lv) => 1.3 + lv * 0.2, freeze: (lv) => 1.2 + lv * 0.12,
      desc: (lv, m) => `ระเบิดน้ำแข็งรอบตัว ${m}% ของ MATK แช่แข็งทุกตัว ${(1.2 + lv * 0.12).toFixed(1)} วิ` }),
    mg_amplify: S({ name: 'สมาธิเวท', icon: 'sk_mg_amplify', kind: 'buff', req: [['mg_sprecovery', 3]], cd: 40, sp: (lv) => 20 + lv * 2, rgb: '190,140,255', circle: 'arcane',
      dur: (lv) => 15 + lv * 2, buff: (lv) => ({ matk: 6 + lv * 2, spReg: 50 }),
      desc: (lv) => `${15 + lv * 2} วิ: MATK +${6 + lv * 2}% ฟื้น SP +50%` }),
    mg_sprecovery: S({ name: 'ฟื้นฟูมานา', icon: 'sk_mg_sprecovery', pass: (lv) => ({ spReg: lv * 8, spPct: lv }),
      desc: (lv) => `ฟื้น SP +${lv * 8}% · SP สูงสุด +${lv}%` }),
    mg_elemmastery: S({ name: 'ชำนาญธาตุ', icon: 'sk_mg_elemmastery', pass: (lv) => ({ matk: lv * 2, cdr: r1(lv * 0.8) }),
      desc: (lv) => `MATK +${lv * 2}% · คูลดาวน์สกิล -${r1(lv * 0.8)}%` }),

    // ======== archer ========
    ar_owl: S({ name: 'ตาเหยี่ยว', icon: 'sk_ar_owl', pass: (lv) => ({ dex: lv, hit: lv }), desc: (lv) => `DEX +${lv} · ความแม่น +${lv}` }),
    ar_bowmastery: S({ name: 'ชำนาญธนู', icon: 'sk_ar_bowmastery', pass: (lv, p) => (W(p).style === 'arrow' ? { atk: r1(lv * 1.5), crit: r1(lv * 0.5) } : null),
      desc: (lv) => `ถือธนู: ATK +${lv * 2}% คริติคอล +${r1(lv * 0.5)}%` }),
    ar_concentrate: S({ name: 'สมาธิเล็ง', icon: 'sk_ar_concentrate', kind: 'buff', req: [['ar_owl', 3]], cd: 40, sp: (lv) => 20 + lv * 2, rgb: '120,230,210',
      dur: (lv) => 30 + lv * 6, buff: (lv) => ({ dex: 1 + lv, agi: 1 + lv, hit: 5 + lv }),
      desc: (lv) => `${30 + lv * 6} วิ: DEX และ AGI +${1 + lv} ความแม่น +${5 + lv}` }),
    ar_charge: S({ name: 'ธนูกระแทก', icon: 'sk_ar_charge', req: [['double', 3]], cd: 5, sp: (lv) => 12 + lv, mul: (lv) => 1.8 + lv * 0.25,
      desc: (lv, m) => `ลูกธนูหนักกระแทก ${m}% ของ ATK ศัตรูกระเด็นไกลและมึน 1 วิ` }),
    ar_snare: S({ name: 'กับดักเถาวัลย์', icon: 'sk_ar_snare', cd: 6, sp: (lv) => 10 + lv, mul: (lv) => 0.5 + lv * 0.1, hold: (lv) => 2.5 + lv * 0.25,
      desc: (lv, m) => `วางกับดักที่เมาส์ (วางได้หลายอัน) ศัตรูที่เหยียบโดนเถาวัลย์รัด ${(2.5 + lv * 0.25).toFixed(1)} วิ และ ${m}% ของ ATK` }),
    ar_multishot: S({ name: 'ยิงกระจาย', icon: 'sk_ar_multishot', req: [['double', 5]], cd: 4, sp: (lv) => 12 + lv, mul: (lv) => 1.2 + lv * 0.18,
      desc: (lv, m) => `ยิงธนู 5 ดอกกระจายเป็นพัด ดอกละ ${m}% ของ ATK` }),

    // ======== rogue ========
    ro_steal: S({ name: 'ขโมยของ', icon: 'sk_ro_steal', cd: 3, sp: (lv) => 6 + lv, mul: (lv) => 0.8 + lv * 0.1, chance: (lv) => 10 + lv * 4,
      desc: (lv, m) => `ฟันเบา ๆ ${m}% ของ ATK และมีโอกาส ${10 + lv * 4}% ขโมยวัตถุดิบประจำตัวมอนตัวนั้น` }),
    ro_hide: S({ name: 'ซ่อนตัว', icon: 'sk_ro_hide', kind: 'buff', req: [['shadowstep', 3]], cd: 15, sp: (lv) => 12 + lv, rgb: '150,110,220', circle: 'occult',
      dur: (lv) => 3 + lv * 0.4, buff: () => ({ spd: -25 }),
      desc: (lv) => `หายตัวในเงา ${(3 + lv * 0.4).toFixed(1)} วิ มอนมองไม่เห็น (เดินช้าลง) · ออกจากที่ซ่อนเมื่อโจมตี ตีครั้งแรกคริติคอลแน่นอน` }),
    ro_double: S({ name: 'โจมตีสองครั้ง', icon: 'sk_ro_double', pass: (lv, p) => (W(p).dual ? { dbl: lv * 4 } : null),
      desc: (lv) => `ถือมีดคู่: ตีปกติมีโอกาส ${lv * 4}% โดน 2 เท่า` }),
    ro_dagger: S({ name: 'ชำนาญมีด', icon: 'sk_ro_dagger', pass: (lv, p) => (W(p).dual ? { atk: lv * 2, aspd: lv, flee: lv } : { flee: lv }),
      desc: (lv) => `หลบหลีก +${lv} · ถือมีดคู่: ATK +${lv * 2}% โจมตีเร็วขึ้น ${lv}%` }),
    ro_backstab: S({ name: 'แทงข้างหลัง', icon: 'sk_ro_backstab', req: [['ro_hide', 2]], cd: 6, sp: (lv) => 14 + lv, mul: (lv) => 3.2 + lv * 0.45,
      desc: (lv, m) => `วาร์ปไปข้างหลังศัตรูแล้วแทง ${m}% ของ ATK · ใช้ตอนซ่อนตัว: คริติคอลแน่นอน` }),
    ro_raid: S({ name: 'จู่โจมจากเงา', icon: 'sk_ro_raid', req: [['ro_hide', 3]], cd: 8, sp: (lv) => 16 + lv, mul: (lv) => 1.4 + lv * 0.2,
      desc: (lv, m) => `ระเบิดคมเงารอบตัว ${m}% ของ ATK ทำให้มึน 1 วิ · ใช้ตอนซ่อนตัว: แรงขึ้น 50%` }),

    // ======== priest ========
    pr_agi: S({ name: 'เพิ่มความเร็ว', icon: 'sk_pr_agi', kind: 'buff', req: [['pr_heal', 3]], cd: 30, sp: (lv) => 18 + lv * 2, rgb: '150,255,170',
      dur: (lv) => 30 + lv * 6, buff: (lv) => ({ agi: 2 + lv, spd: 10 }), party: () => ({ atk: 1.05 }),
      desc: (lv) => `ตัวเองและเพื่อนรอบตัว ${30 + lv * 6} วิ: AGI +${2 + lv} เดินเร็วขึ้น 10%` }),
    pr_angelus: S({ name: 'พรเกราะกาย', icon: 'sk_pr_angelus', kind: 'buff', req: [['pr_protect', 3]], cd: 40, sp: (lv) => 20 + lv * 2, rgb: '170,215,255',
      dur: (lv) => 30 + lv * 6, buff: (lv) => ({ def: 2 + lv, vit: lv }), party: (lv) => ({ guard: 1 - (0.05 + lv * 0.01) }),
      desc: (lv) => `ตัวเองและเพื่อนรอบตัว ${30 + lv * 6} วิ: DEF +${2 + lv} VIT +${lv} (เพื่อนรับดาเมจลดลง ${5 + lv}%)` }),
    pr_protect: S({ name: 'พรคุ้มครอง', icon: 'sk_pr_protect', pass: (lv) => ({ mdef: lv, def: Math.floor(lv / 2), taken: r1(lv * 0.8) }),
      desc: (lv) => `MDEF +${lv} · DEF +${Math.floor(lv / 2)} · รับดาเมจลดลง ${r1(lv * 0.8)}%` }),
    pr_demonbane: S({ name: 'ปราบมาร', icon: 'sk_pr_demonbane', pass: (lv) => ({ vsDark: lv * 4 }),
      desc: (lv) => `ดาเมจต่อมอนอมตะและความมืด +${lv * 4}%` }),
    pr_aspersio: S({ name: 'อาวุธแสงชำระ', icon: 'sk_pr_aspersio', kind: 'buff', req: [['holylight', 3]], cd: 40, sp: (lv) => 20 + lv, rgb: '160,215,255',
      dur: (lv) => 30 + lv * 6, enchant: 'holy', buff: (lv) => ({ atk: lv }),
      desc: (lv) => `${30 + lv * 6} วิ: อาวุธเป็นธาตุแสง (แรงกับอมตะและความมืด) ATK +${lv}%` }),
    pr_resurrect: S({ name: 'ชุบชีวิต', icon: 'sk_pr_resurrect', type: 'heal', req: [['pr_heal', 5]], cd: (lv) => 60 - lv * 3, sp: () => 40, mul: () => 0,
      need: (game, p) => (fallen(game, p).length ? true : 'ไม่มีเพื่อนที่หมดแรงอยู่ใกล้ ๆ'),
      desc: (lv) => `ชุบชีวิตเพื่อนในปาร์ตี้ที่หมดแรงรอบตัว ให้ลุกขึ้นพร้อม HP ${20 + lv * 8}%` }),
  });
  const fallen = (game, p) => ((NC.allies ? NC.allies(game) : NC.Party && NC.Party.members) || []).filter((a) => a.dead > 0 && NC.dist(a.x, a.y, p.x, p.y) < 520); // (+ the real players: js/partysupport.js)

  // ================= knight =================
  RUN.kn_bowling = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 2), 0.55);
    const G = '220,235,255';
    for (let i = 0; i < 2; i++) V.at(0.12 + i * 0.2, () => {
      for (const a of [0, Math.PI]) V.slash(p.x, p.y - 60, 150, a + i * 1.2, 3.2, 34, P.wind, 0.32, { rgb: G, dir: i ? -1 : 1, sq: 0.62 });
      V.ring(p.x, p.y, 30, 220, 10, G, 0.35);
      V.sparks(p.x, p.y - 50, 12, G, { max: 700 });
      V.smoke(p.x, p.y - 5, 5, '#cbbfae', '#efe6d8', { size: 0.8, lifeK: 0.6 });
      V.shake(game, i ? 8 : 4);
      K.nova(game, p, 'kn_bowling', p.x, p.y, 190, { fx: false, kb: i ? 420 : 120, color: '220,235,255', big: !!i });
    });
  };
  RUN.kn_pierce = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'thrust', 1), 0.4);
    const a = p.aim, c = Math.cos(a), s = Math.sin(a);
    [0.05, 0.15, 0.25].forEach((t, i) => V.at(t, () => {
      const x0 = p.x + c * 30, y0 = p.y - 60 + s * 20, len = 270, off = (i - 1) * 14;
      FX.add({ type: 'cutline', x: x0 - s * off, y: y0 + c * off, x1: x0 + c * len - s * off, y1: y0 + s * len * 0.7 + c * off, w: 12, color: '255,236,180', life: 0.22 });
      V.sparks(x0 + c * len, y0 + s * len * 0.7, 6, '255,236,180', { ang: a, spread: 0.5, size: 0.8 });
      for (const e of K.lineHits(game, p.x, p.y - 30, a, len + 20, 80)) K.hit(game, p, 'kn_pierce', e, c * 90, s * 70, '255,236,180');
      V.shake(game, 3);
    }));
  };
  RUN.kn_provoke = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    const R = '255,90,70';
    for (let i = 0; i < 3; i++) V.at(i * 0.1, () => V.ring(p.x, p.y - 40, 30, 330, 12 - i * 3, R, 0.5));
    V.glowAt(p.x, p.y - 80, 30, 180, R, 0.6, 0.4, { hot: true });
    V.shake(game, 7);
    for (const e of K.around(game, p.x, p.y, 320)) {
      K.vuln(game, e, 1.1 + lv * 0.03, 10, R);
      if (e.tgt) { e.tgt = null; e.tgtLock = game.time + 3; }
      FX.num(e.x, e.y - 150, '!', { fill: '#ff6b5a', size: 44 });
    }
  };

  // ================= mage =================
  const castPose = (game, p, lock) => K.pose(game, p, K.clip(p, 'bolt', 0), lock || 0.3);
  RUN.mg_firewall = function (game, p, lv) {
    castPose(game, p, 0.35);
    const [cx, cy] = K.ground(game, p, 320), a = p.aim + Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a) * V.SQ, half = 170;
    const push = [Math.cos(p.aim), Math.sin(p.aim)];
    V.decal(cx, cy, 190, 'scorch', 5.4);
    V.light(cx, cy - 40, 520, C.fire, 1, 5.2, { flick: true });
    let acc = 0;
    FX.add({
      type: 'timer', layer: 'none', life: 5,
      update(z, dt) {
        for (let i = 0; i < 3; i++) if (Math.random() < dt * 16) {
          const k = rand(-1, 1);
          V.flameAt(cx + dx * half * k + rand(-8, 8), cy + dy * half * k + rand(-6, 6), rand(34, 50), rand(90, 150), P.fire, rand(0.4, 0.6), { vy: -70 });
        }
        if (Math.random() < dt * 5) V.smoke(cx + dx * half * rand(-1, 1), cy - 60, 1, '#5a4a52', '#7a6a70', { size: 0.8, lifeK: 1, rise: 50, a: 0.6 });
        if ((acc += dt) < 0.3) return;
        acc -= 0.3;
        for (const e of game.enemies) {
          if (!K.alive(e)) continue;
          const vx = e.x - cx, vy = e.y - cy, along = vx * dx + vy * dy, side = Math.abs(vx * -dy + vy * dx);
          if (Math.abs(along) < half + e.r && side < 46 + e.r) {
            const f = Math.sign(vx * push[0] + vy * push[1]) || 1;
            K.hit(game, p, 'mg_firewall', e, push[0] * 260 * f, push[1] * 200 * f, '255,160,80');
          }
        }
      },
    });
    V.flash('255,140,60', 0.1, 0.3);
  };
  RUN.mg_quake = function (game, p, lv) {
    castPose(game, p);
    const e0 = K.target(game, p, 560), n = SK.mg_quake.n(lv);
    let [tx, ty] = e0 ? [e0.x, e0.y] : K.ground(game, p, 420);
    for (let i = 0; i < n; i++) V.at(0.12 + i * 0.14, () => {
      if (e0 && K.alive(e0)) { tx = e0.x; ty = e0.y; }
      V.decal(tx, ty, 100, 'crack', 2, { rgb: C.rock, n: 8 });
      K.spikes(tx, ty, 6, 60, P.rock, C.rock, { k: 1.1 });
      V.debris(tx, ty - 10, 6, P.rock, { size: 0.8, max: 420 });
      V.smoke(tx, ty - 5, 4, '#9a8a78', '#c8b8a2', { size: 0.8, lifeK: 0.7 });
      V.shake(game, 5);
      for (const e of K.around(game, tx, ty, 95)) K.hit(game, p, 'mg_quake', e, 0, -120, '230,190,140');
    });
  };
  RUN.mg_frostnova = function (game, p, lv) {
    castPose(game, p, 0.4);
    V.gather(p.x, p.y - 60, 12, C.ice, 140, 0.25);
    V.at(0.22, () => {
      V.decal(p.x, p.y, 240, 'frost', 3);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, d = rand(150, 210); V.spikeAt(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * V.SQ, rand(26, 38), rand(60, 100), P.ice, rand(1, 1.3), { glowA: 0.35, rgb: C.ice, rise: 0.08, sink: true }); }
      K.nova(game, p, 'mg_frostnova', p.x, p.y, 240, { rgb: C.ice, color: '170,225,255', status: ['freeze', SK.mg_frostnova.freeze(lv)], smoke: ['#e6f6ff', '#ffffff'], flash: '190,230,255', shake: 8 });
    });
  };

  // ================= archer =================
  const bowPose = (game, p, i, lock) => K.pose(game, p, K.clip(p, 'arrow', i === undefined ? 1 : i), lock || 0.3);
  RUN.ar_charge = function (game, p, lv) {
    bowPose(game, p, 2, 0.45);
    V.at(0.22, () => {
      const a = p.aim;
      V.ring(K.hand(p)[0], K.hand(p)[1], 10, 110, 10, C.fire, 0.3, { sq: 1 });
      V.shake(game, 5);
      K.shot(game, p, 'ar_charge', {
        style: 'arrow', rgb: '255,170,90', size: 1.5, tail: 240, v: 1350, range: 950,
        hit(e, q) {
          K.hit(game, p, 'ar_charge', e, Math.cos(a) * 760, Math.sin(a) * 520, '255,190,120', 1, { big: true });
          K.stun(game, e, 1);
          K.burst(game, q.x, q.y + 40, 110, '255,170,90', { shake: 7, sparks: 16, smoke: ['#cbbfae', '#efe6d8'] });
        },
      });
    });
  };
  RUN.ar_multishot = function (game, p, lv) {
    bowPose(game, p, 1, 0.35);
    V.at(0.12, () => {
      for (let i = 0; i < 5; i++) K.shot(game, p, 'ar_multishot', { style: 'arrow', rgb: '160,220,255', ang: p.aim + (i - 2) * 0.17, v: 1300, range: 850, kb: 140, color: '200,235,255' });
      V.ring(K.hand(p)[0], K.hand(p)[1], 8, 80, 6, '160,220,255', 0.25, { sq: 1 });
    });
  };
  // ---- traps: on the ground until a monster steps near (or they time out); snare, blast, freezing ----
  const Traps = (NC.Traps = { list: [] });
  FX.def('vtrap', (ctx, q, u) => {
    const a = Math.min(1, q.t / 0.25) * (u > 0.9 ? (1 - u) / 0.1 : 1), s = V.SQ, armed = q.t > 0.5;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(q.x, q.y); ctx.scale(1, s);
    const col = q.kind === 'freeze' ? ['#8fd3ff', '#e6f6ff'] : q.kind === 'snare' ? ['#5aa84a', '#9fdc6a'] : ['#6a5e5a', '#b8aaa0'];
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.lineWidth = 10; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = col[0]; ctx.stroke();
    for (let i = 0; i < 10; i++) { // the teeth (thorns for the snare)
      const t0 = (i / 10) * TAU;
      ctx.beginPath(); ctx.moveTo(Math.cos(t0 - 0.12) * 30, Math.sin(t0 - 0.12) * 30); ctx.lineTo(Math.cos(t0) * 16, Math.sin(t0) * 16); ctx.lineTo(Math.cos(t0 + 0.12) * 30, Math.sin(t0 + 0.12) * 30);
      ctx.fillStyle = col[1]; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    }
    ctx.restore();
    if (armed) V.glow(ctx, q.x, q.y - 4, 30, q.rgb, 0.3 + 0.25 * Math.sin(q.t * 6), false, s);
  }, 'low');
  Traps.place = function (game, p, id, x, y, o) {
    const max = 3 + Math.floor(((p.d && p.d.mods && p.d.mods.traps) || 0));
    while (Traps.list.length >= max) { const old = Traps.list.shift(); old.fx.dead = true; }
    const t = { id, x, y, r: o.r || 70, boom: o.boom, kind: o.kind };
    t.fx = FX.add({
      type: 'vtrap', x, y, kind: o.kind, rgb: o.rgb || '255,210,120', life: o.life || 25,
      update(q) {
        if (q.t < 0.5) return;
        for (const e of game.enemies) if (K.alive(e) && NC.dist(e.x, e.y, x, y) < t.r + e.r) { Traps.fire(game, t); return; }
      },
      onEnd() { const i = Traps.list.indexOf(t); if (i >= 0) Traps.list.splice(i, 1); },
    });
    V.ring(x, y, 10, 80, 5, o.rgb || '255,210,120', 0.3);
    V.smoke(x, y - 4, 3, '#cbbfae', '#efe6d8', { size: 0.5, lifeK: 0.5 });
    Traps.list.push(t);
    return t;
  };
  Traps.fire = function (game, t, k) {
    const i = Traps.list.indexOf(t);
    if (i < 0) return;
    Traps.list.splice(i, 1);
    t.fx.dead = true;
    t.boom(game, t, k || 1);
  };
  const throwTrap = (game, p, id, o) => {
    bowPose(game, p, 0, 0.25);
    const [tx, ty] = K.ground(game, p, 360), from = K.hand(p);
    K.proj({
      x: from[0], y: from[1], life: 0.3,
      update(q) { const k = q.t / 0.3; q.x = NC.lerp(from[0], tx, k); q.y = NC.lerp(from[1], ty - 10, k) - Math.sin(k * Math.PI) * 110; },
      draw(ctx, q) { V.glow(ctx, q.x, q.y, 26, o.rgb || '255,210,120', 0.6, true); ctx.save(); ctx.beginPath(); ctx.arc(q.x, q.y, 10, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); ctx.fillStyle = '#8a7e78'; ctx.fill(); ctx.restore(); },
      onEnd() { Traps.place(game, p, id, tx, ty, o); },
    });
  };
  NC.throwTrap = throwTrap;
  RUN.ar_snare = function (game, p, lv) {
    throwTrap(game, p, 'ar_snare', {
      kind: 'snare', rgb: C.wind, r: 70,
      boom(game, t) {
        V.decal(t.x, t.y, 90, 'goo', 2, { col: 'rgba(70,150,50,0.35)' });
        K.spikes(t.x, t.y, 7, 50, P.wind, C.wind, { k: 0.8 });
        V.ring(t.x, t.y, 10, 110, 8, C.wind, 0.35);
        for (const e of K.around(game, t.x, t.y, 110)) {
          K.hit(game, p, 'ar_snare', e, 0, 0, '160,240,140', (p.d.trapK || 1));
          K.stun(game, e, SK.ar_snare.hold(NC.skillLv(p, 'ar_snare')));
          FX.add({ type: 'vtendril', x: e.x - 16, y: e.y + 4, sort: e.y + 4, h: 70, w: 12, ph: rand(0, 6), life: 1.6 });
          FX.add({ type: 'vtendril', x: e.x + 16, y: e.y + 6, sort: e.y + 6, h: 60, w: 11, ph: rand(0, 6), life: 1.6 });
        }
      },
    });
  };

  // ================= rogue =================
  const bladePose = (game, p, i, lock) => K.pose(game, p, K.clip(p, 'swing', i || 0), lock || 0.3);
  const hidden = (NC.heroHidden = (p) => p.buffs && (p.buffs.ro_hide > 0 || p.buffs.as_cloak > 0 || p.buffs.rg_camo > 0));
  RUN.ro_steal = function (game, p, lv) {
    bladePose(game, p, 0, 0.3);
    const e = K.target(game, p, 220, 160);
    V.at(0.08, () => {
      if (!e || !K.alive(e)) return;
      K.hit(game, p, 'ro_steal', e, 0, 0, '220,200,255');
      V.slash(e.x, e.y - 60, 60, p.aim, 1.8, 18, P.shadow, 0.22, { rgb: C.shadow });
      if (e.stolen || Math.random() * 100 >= SK.ro_steal.chance(lv)) { FX.num(e.x, e.y - 170, 'พลาด', { fill: '#cfd8ff', size: 28 }); return; }
      e.stolen = true; // one steal per monster
      const drop = NC.MAT_DROPS && NC.MAT_DROPS[e.type] && NC.MAT_DROPS[e.type][0];
      if (drop && NC.addMat) {
        NC.addMat(game, drop[0], 1);
        if (NC.saveTrade) NC.saveTrade(game);
        const M = NC.MATERIALS[drop[0]];
        FX.num(e.x, e.y - 170, 'ขโมยได้!', { fill: '#ffd873', size: 32 });
        NC.HUD.log(`ขโมย ${M ? M.name : 'ของ'} ได้ ×1`, 'item');
        V.stars(e.x, e.y - 80, 8, '#ffe68a', C.gold, { speed: 200 });
      }
    });
  };
  RUN.ro_hide = function (game, p, lv) {
    K.startBuff(game, p, 'ro_hide', lv);
    p.hideAt = game.time;
    p.buffs.shadow = SK.ro_hide.dur(lv) + 2; // (the old shadow step's sure critical on the next basic hit)
    V.smoke(p.x, p.y - 20, 10, '#3a2a4e', '#5a4a72', { size: 1, lifeK: 0.7, max: 180, a: 0.9 });
    V.motes(p.x, p.y - 60, 12, C.shadow, { spread: 50, rise: 120 });
    V.ring(p.x, p.y, 16, 130, 8, C.shadow, 0.3);
  };
  RUN.ro_backstab = function (game, p, lv) {
    const e = K.target(game, p, 420);
    const sure = hidden(p);
    if (e) { const a = NC.angle(p.x, p.y, e.x, e.y); K.blink(game, p, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 40); p.face = e.x > p.x ? 1 : -1; }
    bladePose(game, p, 2, 0.35);
    V.at(0.06, () => {
      if (!e || !K.alive(e)) return;
      V.slash(e.x, e.y - 60, 90, NC.angle(p.x, p.y, e.x, e.y), 2.2, 26, P.blood, 0.28, { rgb: C.blood });
      V.sparks(e.x, e.y - 60, 12, C.blood);
      K.hit(game, p, 'ro_backstab', e, 0, 0, '255,120,160', 1, { crit: sure, big: true });
      V.shake(game, 6); V.stop(game, 0.05);
    });
  };
  RUN.ro_raid = function (game, p, lv) {
    const k = hidden(p) ? 1.5 : 1;
    bladePose(game, p, 1, 0.4);
    V.smoke(p.x, p.y - 20, 12, '#2a1a3a', '#4a3a5a', { size: 1.2, lifeK: 0.8, max: 240, a: 0.9 });
    for (let i = 0; i < 6; i++) V.slash(p.x, p.y - 60, 120, (i / 6) * TAU, 1.4, 22, P.shadow, 0.3, { rgb: C.shadow });
    K.nova(game, p, 'ro_raid', p.x, p.y, 200, { rgb: C.shadow, color: '200,160,255', mul: k, status: ['stun', 1], shake: 7, flare: false });
  };
  // hiding: monsters lose the hero (they see him as gone), he fades; attacking or another skill brings him out
  const baseUpdateEnemy = NC.updateEnemy;
  NC.updateEnemy = function (game, e, dt) {
    const p = game.player;
    if (p.kind !== 'player' || !hidden(p) || p.dead > 0) return baseUpdateEnemy(game, e, dt);
    p.dead = 1e-6;
    try { baseUpdateEnemy(game, e, dt); } finally { if (p.dead === 1e-6) p.dead = 0; }
  };
  const baseDrawPlayer = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game.player;
    if (!hidden(p) || !p.pose || p.dead > 0) return baseDrawPlayer(ctx, game);
    NC.drawHero(ctx, p.equip, p.pose, p.x, p.y, { alpha: 0.32 + 0.06 * Math.sin(game.time * 5), tint: ['#5a3a8a', 0.55] });
  };
  const unhide = (p) => { for (const k of ['ro_hide', 'as_cloak', 'rg_camo']) if (p.buffs[k] > 0) p.buffs[k] = 0; };
  NC.skillCasts.push((game, p, id) => { if (id !== 'ro_hide' && id !== 'as_cloak' && id !== 'rg_camo') unhide(p); });
  NC.skillTicks.push((game, p) => { if (hidden(p) && p.atk && p.atk.on && game.time - (p.hideAt || 0) > 0.2) unhide(p); });

  // ================= priest =================
  RUN.pr_resurrect = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.5);
    for (const a of fallen(game, p)) {
      V.beam(a.x, a.y, 110, 700, C.holy, 0.7);
      FX.add({ type: 'vwings', follow: a, x: a.x, y: a.y, life: 1.2 });
      V.stars(a.x, a.y - 80, 12, '#fff0b0', C.holy, { speed: 260 });
      NC.Party.lib.revive(game, a, 0.2 + lv * 0.08);
    }
    V.circle(p.x, p.y, 150, C.holy, 0.9, { style: 'holy', spin: 2, follow: p });
    V.flash('255,248,220', 0.14, 0.3);
  };
})();
