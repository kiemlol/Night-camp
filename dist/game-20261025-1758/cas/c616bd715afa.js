/* class2_skills_a.js — the 2nd jobs from the knight and the mage, ten skills each (their 1st job's stay too):
     พาลาดิน     ฟันศักดิ์สิทธิ์ · โล่อีจิส (บัฟ) · แสงกากบาทเผาผลาญ · ดาบสวรรค์พิพากษา (อัลติ) · สายใยพิทักษ์ (บัฟทีม) · โล่พิฆาต ·
                 ศรัทธา · โล่สะท้อน (บัฟ) · แสงพลีชีพ · มือแห่งแสง                         -> the tank who shields the party
     อัศวินมังกร   แทงเพลิงมังกร · มังกรทะยาน · ลมหายใจมังกร · วิญญาณมังกรคำราม (อัลติ) · ชำนาญหอก · เลือดมังกร ·
                 โทสะมังกร (บัฟ) · หอกเกลียวสว่าน · จู่โจมพุ่งทะลวง · เรียกไวเวิร์น              -> the fire lancer's burst
     อาร์คเมจ     มิสไซล์จันทรา · โล่มานา (บัฟ) · พายุหิมะ · สุริยุปราคา (อัลติ) · สายฟ้าลูกโซ่ · เสาเพลิง · ปราชญ์ธาตุ ·
                 ร่ายเร็ว · ขยายพลังเวท (บัฟ) · หลุมดำ                                     -> area magic
     วอร์ล็อกตะเกียง ไฟวิญญาณ · เรียกวิญญาณ · โซ่คำสาป · ขบวนแห่วิญญาณ (อัลติ) · คำสาปเผาวิญญาณ · ตะเกียงวิญญาณ ·
                 เก็บเกี่ยววิญญาณ · สัญญาแห่งความมืด (บัฟ) · ศาสตร์มืด · ตราคำสาปมรณะ          -> curses, burns, summons
   Also: the 2nd jobs' class sets join NC.CLASSES (after the priest's). Built with skillkit.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS;
  const { C, P, TAU } = K;
  const rand = NC.rand, lerp = NC.lerp, S = K.S;
  const r1 = (v) => Math.round(v * 10) / 10;
  const W = (p) => NC.weaponDef(p) || {};

  // the 2nd jobs' looks in the class list (the equipment screen's class buttons, the job change's outfit)
  if (NC.CLASS2) {
    const at = NC.CLASSES.findIndex((c) => c.id === 'priest');
    const add = NC.CLASS2.sets.filter((s) => !NC.CLASSES.some((c) => c.id === s.id));
    NC.CLASSES.splice(at < 0 ? NC.CLASSES.length : at + 1, 0, ...add);
  }
  const jobSkills = (job, ids) => { NC.JOBS[job].skills = ids; };
  jobSkills('paladin', ['pal_strike', 'pal_aegis', 'pal_cross', 'pal_heaven', 'pal_devotion', 'pal_shieldchain', 'pal_faith', 'pal_reflect', 'pal_sacrifice', 'pal_layhands']);
  jobSkills('dragonknight', ['dk_thrust', 'dk_leap', 'dk_breath', 'dk_roar', 'dk_spearmastery', 'dk_blood', 'dk_fury', 'dk_spiral', 'dk_charge', 'dk_wyvern']);
  jobSkills('archmage', ['am_missile', 'am_shield', 'am_blizzard', 'am_eclipse', 'am_chain', 'am_firepillar', 'am_wisdom', 'am_quickcast', 'am_mystic', 'am_gravity']);
  jobSkills('warlock', ['wl_soulfire', 'wl_wisps', 'wl_chains', 'wl_parade', 'wl_soulburn', 'wl_lantern', 'wl_harvest', 'wl_pact', 'wl_darkarts', 'wl_hex']);

  const HOLY = C.holy, GOLD = C.gold, FIRE = C.fire, TEAL = '90,235,215', VIOLET = '190,120,255', MOON = '140,190,255';
  const castPose = (game, p, lock) => K.pose(game, p, K.clip(p, 'bolt', 0), lock || 0.3);

  K.def({
    // ======== paladin ========
    pal_strike: S({ name: 'ฟันศักดิ์สิทธิ์', icon: 'sk_pal_strike', free: 1, type: 'best', element: 'holy', cd: 3, sp: (lv) => 10 + lv, mul: (lv) => 4 + lv * 0.6,
      heal: (lv) => 2 + lv * 0.3, desc: (lv, m) => `ฟันดาบแสงข้างหน้า ${m}% ของ ATK/MATK (ที่สูงกว่า) ธาตุแสง ฟื้น HP ${r1(2 + lv * 0.3)}% ต่อศัตรูที่โดน (สูงสุด 3 ตัว)` }),
    pal_aegis: S({ name: 'โล่อีจิส', icon: 'sk_pal_aegis', kind: 'buff', req: [['guard', 5]], cd: 25, sp: (lv) => 18 + lv, rgb: HOLY,
      dur: (lv) => 8 + lv * 0.6, buff: (lv) => ({ taken: 20 + lv * 2, def: lv, hpReg: 100 }),
      desc: (lv) => `โดมโล่ทอง ${r1(8 + lv * 0.6)} วิ: รับดาเมจลดลง ${20 + lv * 2}% DEF +${lv} ฟื้น HP เร็วขึ้น 2 เท่า` }),
    pal_cross: S({ name: 'แสงกากบาทเผาผลาญ', icon: 'sk_pal_cross', type: 'best', element: 'holy', req: [['pal_strike', 3]], cd: 5, sp: (lv) => 16 + lv * 2,
      mul: (lv) => 5 + lv * 1, desc: (lv, m) => `กางเขนแสงยักษ์รอบตัว ${m}% ของ ATK/MATK (ที่สูงกว่า) ธาตุแสง` }),
    pal_heaven: S({ name: 'ดาบสวรรค์พิพากษา', icon: 'sk_pal_heaven', ult: true, type: 'best', element: 'holy', req: [['pal_cross', 5]], cd: 35, sp: (lv) => 45 + lv * 3,
      mul: (lv) => 3 + lv * 0.4, desc: (lv, m) => `ดาบแสง 10 เล่มร่วงจากฟ้าใส่พื้นที่ที่เล็ง เล่มละ ${m}% ของ ATK/MATK (ที่สูงกว่า) ธาตุแสง` }),
    pal_devotion: S({ name: 'สายใยพิทักษ์', icon: 'sk_pal_devotion', kind: 'buff', req: [['pal_aegis', 3]], cd: 45, sp: (lv) => 30 + lv, rgb: GOLD,
      dur: (lv) => 30 + lv * 3, buff: (lv) => ({ def: lv }), party: (lv) => ({ guard: 1 - (0.2 + lv * 0.02) }),
      desc: (lv) => `${30 + lv * 3} วิ: โซ่แสงผูกเพื่อนรอบตัว เพื่อนรับดาเมจลดลง ${20 + lv * 2}% ตัวเอง DEF +${lv}` }),
    pal_shieldchain: S({ name: 'โล่พิฆาต', icon: 'sk_pal_shieldchain', req: [['pal_strike', 5]], cd: 5, sp: (lv) => 14 + lv, mul: (lv) => 2 + lv * 0.3,
      n: (lv) => 3 + Math.floor(lv / 3), desc: (lv, m) => `ขว้างโล่แสงเด้งไป ${3 + Math.floor(lv / 3)} ตัว ตัวละ ${m}% ของ ATK` }),
    pal_faith: S({ name: 'ศรัทธา', icon: 'sk_pal_faith', pass: (lv) => ({ hpPct: lv * 2, taken: lv, mdef: Math.floor(lv / 2) }),
      desc: (lv) => `HP สูงสุด +${lv * 2}% · รับดาเมจลดลง ${lv}% · MDEF +${Math.floor(lv / 2)}` }),
    pal_reflect: S({ name: 'โล่สะท้อน', icon: 'sk_pal_reflect', kind: 'buff', req: [['pal_aegis', 5]], cd: 30, sp: (lv) => 20 + lv, rgb: '140,200,255',
      dur: (lv) => 30 + lv * 5, buff: () => ({ def: 2 }), back: (lv) => 10 + lv * 3,
      desc: (lv) => `${30 + lv * 5} วิ: สะท้อนดาเมจ ${10 + lv * 3}% กลับใส่มอนที่ตีเรา` }),
    pal_sacrifice: S({ name: 'แสงพลีชีพ', icon: 'sk_pal_sacrifice', type: 'best', element: 'holy', req: [['pal_cross', 3]], cd: 12, sp: (lv) => 16 + lv,
      mul: (lv) => 3.2 + lv * 0.45, need: (game, p) => (p.hp > p.maxHp * 0.15 ? true : 'HP น้อยเกินไป'),
      desc: (lv, m) => `สละ HP 8% ระเบิดแสงรอบตัว ${m}% ของ ATK/MATK ธาตุแสง` }),
    pal_layhands: S({ name: 'มือแห่งแสง', icon: 'sk_pal_layhands', type: 'heal', req: [['pal_faith', 3]], cd: 18, sp: (lv) => 24 + lv * 2, mul: () => 0,
      heal: (lv) => 12 + lv * 2, desc: (lv) => `ฟื้น HP ตัวเองและเพื่อนรอบตัว ${12 + lv * 2}% ของ HP สูงสุด` }),

    // ======== dragon knight ========
    dk_thrust: S({ name: 'แทงเพลิงมังกร', icon: 'sk_dk_thrust', free: 1, element: 'fire', cd: 3.5, sp: (lv) => 10 + lv, mul: (lv) => 3 + lv * 0.5,
      desc: (lv, m) => `แทงหอกพ่นไฟเป็นแนวยาว ${m}% ของ ATK ธาตุไฟ โดนทุกตัวในแนว` }),
    dk_leap: S({ name: 'มังกรทะยาน', icon: 'sk_dk_leap', element: 'fire', req: [['dk_thrust', 3]], cd: 8, sp: (lv) => 16 + lv * 2, mul: (lv) => 3.4 + lv * 0.5,
      desc: (lv, m) => `พุ่งทะยานไปที่เมาส์แล้วกระแทกพื้นเป็นวงไฟ ${m}% ของ ATK ธาตุไฟ ผลักศัตรู` }),
    dk_breath: S({ name: 'ลมหายใจมังกร', icon: 'sk_dk_breath', element: 'fire', req: [['dk_thrust', 5]], cd: 8, sp: (lv) => 18 + lv * 2, mul: (lv) => 1.4 + lv * 0.2,
      desc: (lv, m) => `พ่นไฟเป็นกรวยข้างหน้า 1.2 วิ (หันตามเมาส์ได้) 8 ครั้ง ครั้งละ ${m}% ของ ATK ธาตุไฟ` }),
    dk_roar: S({ name: 'วิญญาณมังกรคำราม', icon: 'sk_dk_roar', ult: true, element: 'fire', req: [['dk_breath', 5]], cd: 50, sp: (lv) => 50 + lv * 4,
      mul: (lv) => 4 + lv * 0.7, desc: (lv, m) => `มังกรเพลิงวนรอบตัว 5 ระลอก ระลอกละ ${m}% ของ ATK แล้วคำรามระเบิด x2.5` }),
    dk_spearmastery: S({ name: 'ชำนาญหอก', icon: 'sk_dk_spearmastery', pass: (lv, p) => (W(p).style === 'thrust' ? { atk: lv * 2, hit: lv } : null),
      desc: (lv) => `ถือหอกหรือพลอง: ATK +${lv * 2}% ความแม่น +${lv}` }),
    dk_blood: S({ name: 'เลือดมังกร', icon: 'sk_dk_blood', pass: (lv) => ({ hpPct: lv * 2, atk: lv }), desc: (lv) => `HP สูงสุด +${lv * 2}% · ATK +${lv}%` }),
    dk_fury: S({ name: 'โทสะมังกร', icon: 'sk_dk_fury', kind: 'buff', req: [['dk_blood', 3]], cd: 45, sp: () => 30, rgb: FIRE, circle: 'arcane',
      dur: (lv) => 20 + lv * 2, enchant: 'fire', buff: (lv) => ({ atk: 5 + lv * 2, aspd: 5, def: -8 }),
      aura: (game, p, dt) => { if (Math.random() < dt * 10) V.flameAt(p.x + rand(-26, 26), p.y - rand(0, 30), rand(18, 26), rand(30, 50), P.fire, 0.35, { vy: -80 }); },
      desc: (lv) => `${20 + lv * 2} วิ: ATK +${5 + lv * 2}% โจมตีเร็วขึ้น 5% อาวุธเป็นธาตุไฟ แต่ DEF -8` }),
    dk_spiral: S({ name: 'หอกเกลียวสว่าน', icon: 'sk_dk_spiral', element: 'fire', req: [['dk_spearmastery', 3], ['dk_thrust', 5]], cd: 7, sp: (lv) => 18 + lv * 2,
      mul: (lv) => 1.3 + lv * 0.2, desc: (lv, m) => `หอกหมุนเป็นสว่านเพลิงเจาะศัตรูข้างหน้า 5 ครั้ง ครั้งละ ${m}% ของ ATK` }),
    dk_charge: S({ name: 'จู่โจมพุ่งทะลวง', icon: 'sk_dk_charge', element: 'fire', req: [['dk_leap', 3]], cd: 9, sp: (lv) => 18 + lv * 2, mul: (lv) => 2.8 + lv * 0.42,
      desc: (lv, m) => `พุ่งตรงไปข้างหน้า ชนทุกตัวที่ขวาง ${m}% ของ ATK ผลักกระเด็นออกข้าง` }),
    dk_wyvern: S({ name: 'เรียกไวเวิร์น', icon: 'sk_dk_wyvern', type: 'best', element: 'fire', req: [['dk_breath', 3]], cd: 40, sp: (lv) => 30 + lv * 2,
      mul: (lv) => 1.5 + lv * 0.22, dur: (lv) => 20 + lv * 2,
      desc: (lv, m) => `เรียกไวเวิร์นน้อย ${20 + lv * 2} วิ บินตามและพ่นลูกไฟ ลูกละ ${m}% ของ ATK/MATK · ยิ่งอัพยิ่งตัวโต` }),

    // ======== archmage ========
    am_missile: S({ name: 'มิสไซล์จันทรา', icon: 'sk_am_missile', free: 1, type: 'magic', cd: 2.5, sp: (lv) => 10 + lv, mul: (lv) => 1 + lv * 0.15,
      desc: (lv, m) => `ยิงลูกเวทจันทรา 3 ลูกไล่ตามศัตรู ลูกละ ${m}% ของ MATK` }),
    am_shield: S({ name: 'โล่มานา', icon: 'sk_am_shield', kind: 'buff', req: [['mg_sprecovery', 3]], cd: 20, sp: () => 20, rgb: MOON, circle: 'arcane',
      dur: (lv) => 20 + lv * 2, buff: (lv) => ({ mdef: lv }), soak: (lv) => 40 + lv * 3,
      desc: (lv) => `${20 + lv * 2} วิ: ใช้ SP รับดาเมจแทน HP ${40 + lv * 3}% (SP 1 ต่อดาเมจ 2) MDEF +${lv}` }),
    am_blizzard: S({ name: 'พายุหิมะ', icon: 'sk_am_blizzard', type: 'magic', element: 'water', req: [['mg_frostnova', 3]], cd: 10, sp: (lv) => 26 + lv * 2,
      mul: (lv) => 0.5 + lv * 0.08, desc: (lv, m) => `พายุหิมะที่เมาส์ 3.5 วิ ทุก 0.35 วิ ${m}% ของ MATK ศัตรูช้าลง` }),
    am_eclipse: S({ name: 'สุริยุปราคา', icon: 'sk_am_eclipse', ult: true, type: 'magic', req: [['am_blizzard', 5]], cd: 50, sp: (lv) => 55 + lv * 4,
      mul: (lv) => 1.6 + lv * 0.2, desc: (lv, m) => `ดวงจันทร์ดำบังดวงอาทิตย์เหนือพื้นที่ที่เล็ง ${m}% ของ MATK 4 ระลอก แล้ววงแหวนไฟระเบิด x3` }),
    am_chain: S({ name: 'สายฟ้าลูกโซ่', icon: 'sk_am_chain', type: 'magic', element: 'wind', req: [['thunder', 5]], cd: 5, sp: (lv) => 18 + lv, mul: (lv) => 1.4 + lv * 0.2,
      n: (lv) => 4 + Math.floor(lv / 2), desc: (lv, m) => `สายฟ้ากระโดดต่อกัน ${4 + Math.floor(lv / 2)} ตัว ตัวละ ${m}% ของ MATK (ลดลงทีละนิดต่อการกระโดด)` }),
    am_firepillar: S({ name: 'เสาเพลิง', icon: 'sk_am_firepillar', type: 'magic', element: 'fire', req: [['mg_firewall', 3]], cd: 6, sp: (lv) => 16 + lv,
      mul: (lv) => 0.8 + lv * 0.11, desc: (lv, m) => `เสาไฟปะทุใต้ศัตรูใกล้เมาส์ 3 ครั้ง ครั้งละ ${m}% ของ MATK` }),
    am_wisdom: S({ name: 'ปราชญ์ธาตุ', icon: 'sk_am_wisdom', pass: (lv) => ({ int: lv, matk: lv * 2 }), desc: (lv) => `INT +${lv} · MATK +${lv * 2}%` }),
    am_quickcast: S({ name: 'ร่ายเร็ว', icon: 'sk_am_quickcast', pass: (lv) => ({ cdr: r1(lv * 1.5), spCost: lv * 2 }),
      desc: (lv) => `คูลดาวน์สกิล -${r1(lv * 1.5)}% · ใช้ SP น้อยลง ${lv * 2}%` }),
    am_mystic: S({ name: 'ขยายพลังเวท', icon: 'sk_am_mystic', kind: 'buff', req: [['am_wisdom', 3]], cd: 45, sp: (lv) => 30 + lv * 2, rgb: VIOLET, circle: 'star',
      dur: (lv) => 10 + lv, buff: (lv) => ({ skill: 15 + lv * 3 }), desc: (lv) => `${10 + lv} วิ: สกิลแรงขึ้น ${15 + lv * 3}%` }),
    am_gravity: S({ name: 'หลุมดำ', icon: 'sk_am_gravity', type: 'magic', req: [['am_missile', 5]], cd: 14, sp: (lv) => 30 + lv * 2, mul: (lv) => 0.55 + lv * 0.08,
      desc: (lv, m) => `หลุมดำที่เมาส์ 3 วิ ดูดศัตรูเข้ากลาง ทุก 0.35 วิ ${m}% ของ MATK` }),

    // ======== lantern warlock ========
    wl_soulfire: S({ name: 'ไฟวิญญาณ', icon: 'sk_wl_soulfire', free: 1, type: 'magic', cd: 2.5, sp: (lv) => 10 + lv, mul: (lv) => 1.6 + lv * 0.24,
      desc: (lv, m) => `ลูกไฟวิญญาณระเบิดเป็นวง ${m}% ของ MATK และเผาต่อ 3 วิ` }),
    wl_wisps: S({ name: 'เรียกวิญญาณ', icon: 'sk_wl_wisps', type: 'magic', req: [['wl_soulfire', 3]], cd: 18, sp: (lv) => 24 + lv * 2, mul: (lv) => 0.35 + lv * 0.055,
      dur: (lv) => 12 + lv, desc: (lv, m) => `วิญญาณน้อย 3 ดวงวนรอบตัว ${12 + lv} วิ ยิงศัตรูใกล้ ๆ ทุกวินาที ดวงละ ${m}% ของ MATK` }),
    wl_chains: S({ name: 'โซ่คำสาป', icon: 'sk_wl_chains', type: 'magic', req: [['wl_soulfire', 5]], cd: 12, sp: (lv) => 22 + lv * 2, mul: (lv) => 1.3 + lv * 0.2,
      hold: (lv) => 1.5 + lv * 0.1, desc: (lv, m) => `โซ่รูนผุดที่เมาส์ ${m}% ของ MATK ตรึงศัตรู ${r1(1.5 + lv * 0.1)} วิ และรับดาเมจเพิ่ม 15% นาน 6 วิ` }),
    wl_parade: S({ name: 'ขบวนแห่วิญญาณ', icon: 'sk_wl_parade', ult: true, type: 'magic', req: [['wl_wisps', 5]], cd: 48, sp: (lv) => 50 + lv * 4,
      mul: (lv) => 0.8 + lv * 0.11, desc: (lv, m) => `วิญญาณ 24 ดวงพรั่งพรูจากตะเกียงไล่ล่าศัตรู ดวงละ ${m}% ของ MATK` }),
    wl_soulburn: S({ name: 'คำสาปเผาวิญญาณ', icon: 'sk_wl_soulburn', type: 'magic', req: [['wl_darkarts', 3]], cd: 7, sp: (lv) => 16 + lv, mul: (lv) => 0.42 + lv * 0.06,
      desc: (lv, m) => `สาปศัตรูใกล้เมาส์ได้ถึง 5 ตัว เผาวิญญาณ 6 วิ ทุก 0.5 วิ ${m}% ของ MATK` }),
    wl_lantern: S({ name: 'ตะเกียงวิญญาณ', icon: 'sk_wl_lantern', type: 'magic', req: [['wl_wisps', 3]], cd: 40, sp: (lv) => 30 + lv * 2, mul: (lv) => 0.75 + lv * 0.11,
      dur: (lv) => 40 + lv * 4, desc: (lv, m) => `เรียกภูตตะเกียง ${40 + lv * 4} วิ ดูดวิญญาณศัตรู ${m}% ของ MATK แล้วคืน HP ให้เรา 30% ของดาเมจ · ยิ่งอัพยิ่งตัวโต` }),
    wl_harvest: S({ name: 'เก็บเกี่ยววิญญาณ', icon: 'sk_wl_harvest', pass: () => ({}), max: 10,
      desc: (lv) => `มอนตายใกล้ตัวได้วิญญาณ 1 ดวง (สูงสุด ${3 + Math.floor(lv / 2)}) ดวงละ MATK +2% หายไปถ้าไม่ได้เพิ่ม 20 วิ` }),
    wl_pact: S({ name: 'สัญญาแห่งความมืด', icon: 'sk_wl_pact', kind: 'buff', req: [['wl_harvest', 3]], cd: 30, sp: () => 0, rgb: '150,90,220', circle: 'occult',
      dur: () => 20, buff: (lv) => ({ matk: 8 + lv * 2 }), need: (game, p) => (p.hp > p.maxHp * 0.2 ? true : 'HP น้อยเกินไป'),
      desc: (lv) => `แลก HP 10% เป็น SP และได้ MATK +${8 + lv * 2}% นาน 20 วิ` }),
    wl_darkarts: S({ name: 'ศาสตร์มืด', icon: 'sk_wl_darkarts', pass: (lv) => ({ matk: lv * 2, spReg: lv * 5 }), desc: (lv) => `MATK +${lv * 2}% · ฟื้น SP +${lv * 5}%` }),
    wl_hex: S({ name: 'ตราคำสาปมรณะ', icon: 'sk_wl_hex', type: 'magic', req: [['wl_soulburn', 5]], cd: 12, sp: (lv) => 24 + lv * 2, mul: (lv) => 5.5 + lv * 0.75,
      desc: (lv, m) => `ประทับตราคำสาปบนศัตรู 2.5 วิแล้วระเบิด ${m}% ของ MATK ตัวรอบข้างโดนครึ่งหนึ่ง` }),
  });

  // ================= paladin =================
  RUN.pal_strike = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 2), 0.45);
    const a = p.aim, c = Math.cos(a), s = Math.sin(a);
    V.at(0.22, () => {
      K.slashAt(p.x + c * 10, p.y - 70, 170, a, P.gold, GOLD, { thick: 50, life: 0.34, dir: p.face });
      V.flare(p.x + c * 150, p.y - 40 + s * 100, 150, HOLY, 0.3);
      V.light(p.x + c * 120, p.y - 60, 360, HOLY, 1, 0.5);
      V.shake(game, 8);
      const got = K.cone(game, p, 'pal_strike', 230, 1.05, { kb: 380, color: '255,236,170', big: true });
      const n = Math.min(3, got.length);
      if (n) K.heal(game, p, p.maxHp * (SK.pal_strike.heal(lv) / 100) * n * K.healPow(p), { quiet: true });
    });
  };
  RUN.pal_aegis = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.35);
    const dur = K.startBuff(game, p, 'pal_aegis', lv);
    if (NC.BarrierFX && NC.BarrierFX.on && NC.BarrierFX.ready()) p.guardFx = NC.BarrierFX.add(game, p, dur, 'gold', 'pal_aegis'); // (barrierfx.js: the Blender barrier, no flat rings)
    else {
      p.guardFx = FX.add({ type: 'vdome', follow: p, x: p.x, y: p.y, life: dur });
      V.circle(p.x, p.y, 140, HOLY, dur, { style: 'holy', spin: 1.2, follow: p, a: 0.7 });
      K.buffFx(game, p, HOLY, { r: 170 });
    }
  };
  // a dome ripple when the aegis soaks a hit (skills.js's guard does the same)
  NC.heroGuards.push((game, p, dmg) => { if (p.buffs.pal_aegis > 0 && NC.guardHit) NC.guardHit(game, p); return dmg; });
  FX.def('vcross', (ctx, q, u) => {
    const a = V.fade(u, 0.08, 0.5), L = q.len * V.easeOut(Math.min(1, u / 0.25));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(q.x, q.y); ctx.scale(1, V.SQ);
    for (const r of [0, Math.PI / 2]) {
      ctx.save(); ctx.rotate(r + Math.PI / 4);
      const g = ctx.createLinearGradient(-L, 0, L, 0);
      g.addColorStop(0, `rgba(${q.rgb},0)`); g.addColorStop(0.5, `rgba(${q.rgb},${0.8 * a})`); g.addColorStop(1, `rgba(${q.rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(-L, -q.w / 2, L * 2, q.w);
      ctx.fillStyle = `rgba(255,255,240,${0.9 * a})`; ctx.fillRect(-L * 0.8, -q.w * 0.12, L * 1.6, q.w * 0.24);
      ctx.restore();
    }
    ctx.restore();
  }, 'low');
  RUN.pal_cross = function (game, p, lv) {
    K.pose(game, p, 'stormS3', 0.6);
    V.gather(p.x, p.y - 70, 16, HOLY, 170, 0.3);
    V.at(0.3, () => {
      FX.add({ type: 'vcross', x: p.x, y: p.y, len: 300, w: 90, rgb: HOLY, life: 0.9 });
      V.beam(p.x, p.y, 120, 700, HOLY, 0.5);
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; V.beam(p.x + Math.cos(a) * 200, p.y + Math.sin(a) * 200 * V.SQ, 56, 420, HOLY, 0.45, { a: 0.8 }); }
      V.flash('255,248,215', 0.18, 0.3);
      V.shake(game, 10);
      // the cross's four arms (diagonal on the ground) and its middle
      for (const e of game.enemies) {
        if (!K.alive(e)) continue;
        const dx = e.x - p.x, dy = (e.y - p.y) / V.SQ, d1 = Math.abs(dx - dy) / Math.SQRT2, d2 = Math.abs(dx + dy) / Math.SQRT2, R = Math.hypot(dx, dy);
        if (R < 110 + e.r || (R < 310 + e.r && Math.min(d1, d2) < 50 + e.r)) K.hit(game, p, 'pal_cross', e, 0, -80, '255,240,190', 1, { big: true });
      }
    });
  };
  FX.def('vsword2', (ctx, q, u) => {
    const fall = q.fall, t = q.t;
    let y, a = 1;
    if (t < fall) y = lerp(q.y - 900, q.y + 20, V.easeIn(t / fall));
    else { y = q.y + 20; a = 1 - Math.min(1, Math.max(0, (t - fall - 0.35) / 0.35)); }
    if (a <= 0) return;
    V.glow(ctx, q.x, y - 110, 120, HOLY, 0.5 * a, false);
    V.lightSword(ctx, q.x, y, 230, 36, a);
  }, 'glow');
  RUN.pal_heaven = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.9);
    const [tx, ty] = K.ground(game, p, 380), R = 250;
    V.flash('10,14,40', 0.3, 2.4, 'source-over');
    V.circle(tx, ty, R + 40, HOLY, 2.6, { style: 'holy', spin: 0.9, grow: true });
    FX.add({ type: 'vrays', x: tx, y: ty, r: R + 120, w: 22, n: 10, rgb: HOLY, spin: 0.7, life: 2.6 });
    V.light(tx, ty - 40, 560, HOLY, 0.9, 2.6);
    for (let i = 0; i < 10; i++) V.at(0.3 + i * 0.18, () => {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * R, x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d * V.SQ, fall = 0.28;
      FX.add({ type: 'vsword2', x, y, fall, life: fall + 0.7 });
      V.at(fall, () => {
        if (!(NC.HeavenFX && NC.HeavenFX.on && NC.HeavenFX.ready())) V.ring(x, y, 10, 130, 9, HOLY, 0.35); // (heavenfx.js: a Blender burst instead)
        V.glowAt(x, y - 30, 20, 140, HOLY, 0.8, 0.3, { hot: true });
        V.sparks(x, y - 20, 10, HOLY, { max: 600 });
        V.decal(x, y, 80, 'crack', 2, { rgb: HOLY, n: 7 });
        V.shake(game, 5);
        for (const e of K.around(game, x, y, 110)) K.hit(game, p, 'pal_heaven', e, 0, -60, '255,240,190');
      });
    });
    V.at(2.3, () => {
      if (NC.HeavenFX && NC.HeavenFX.on && NC.HeavenFX.ready()) FX.add({ type: 'vheavenburst', x: tx, y: ty, life: 0.7, s: 1.8 });
      else V.ring(tx, ty, 40, R * 1.3, 18, HOLY, 0.5);
      V.flash('255,248,215', 0.2, 0.35); V.shake(game, 12);
    });
  };
  RUN.pal_devotion = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    const dur = K.startBuff(game, p, 'pal_devotion', lv);
    K.buffFx(game, p, GOLD, { r: 200 });
    for (const a of K.friends(game, p, 560)) V.boltAt(p.x, p.y - 70, a.x, a.y - 70, GOLD, 0.5, { w: 5, jag: 10, seg: 8 });
    K.buffFriends(game, p, Object.assign({ dur, rgb: GOLD }, SK.pal_devotion.party(lv)));
  };
  // a shield (or anything) bouncing from monster to monster: it flies to one, hits, picks the next
  function bounce(game, p, id, first, n, jump, o) {
    const hit = new Set(), from = K.hand(p);
    let cur = first, left = n;
    const q = K.proj({
      x: from[0], y: from[1], life: 6, rot: 0,
      update(q, dt) {
        q.rot += dt * 18;
        const T = cur && K.alive(cur) ? [cur.x, cur.y - 50] : [p.x, p.y - 70];
        const d = NC.dist(q.x, q.y, T[0], T[1]), sp = (o.speed || 1300) * dt;
        if (Math.random() < 0.7) FX.add({ type: 'vstreak', x: q.x, y: q.y, vx: 0, vy: 0, len: 30, w: 4, rgb: o.rgb, life: 0.2 });
        if (d > sp) { q.x += ((T[0] - q.x) / d) * sp; q.y += ((T[1] - q.y) / d) * sp; return; }
        if (!cur || !K.alive(cur)) { q.dead = true; return; } // back in the hand
        hit.add(cur);
        o.hit(cur, q);
        left--;
        const c = cur;
        cur = left > 0 ? game.enemies.filter((e) => K.alive(e) && !hit.has(e) && NC.dist(e.x, e.y, c.x, c.y) < jump).sort((a, b) => NC.dist(a.x, a.y, c.x, c.y) - NC.dist(b.x, b.y, c.x, c.y))[0] || null : null;
      },
      draw(ctx, q) { o.draw(ctx, q); },
    });
    V.light(from[0], from[1], 200, o.rgb, 0.7, 2, { follow: q });
    return q;
  }
  RUN.pal_shieldchain = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'swing', 1), 0.3);
    const first = K.target(game, p, 560);
    if (!first) { FX.num(p.x, p.y - 170, 'ไม่มีเป้า', { fill: '#cfd8ff', size: 28 }); return; }
    bounce(game, p, 'pal_shieldchain', first, SK.pal_shieldchain.n(lv), 360, {
      rgb: GOLD,
      hit(e, q) { K.hit(game, p, 'pal_shieldchain', e, 0, 0, '255,230,150'); V.sparks(q.x, q.y, 10, GOLD); V.ring(e.x, e.y, 10, 90, 6, GOLD, 0.3); V.shake(game, 3); },
      draw(ctx, q) {
        V.glow(ctx, q.x, q.y, 60, GOLD, 0.7, true);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(1, 0.8);
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); ctx.fillStyle = '#e8c45a'; ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fillStyle = '#fff3c4'; ctx.fill();
        V.star(ctx, 0, 0, 9, 0, '#ffb62e', 1);
        ctx.restore();
      },
    });
  };
  // the reflection: a share of a monster's hit goes back to it
  NC.heroGuards.push((game, p, dmg, att) => {
    if (!(p.buffs.pal_reflect > 0) || !att || !K.alive(att)) return dmg;
    const back = Math.max(1, Math.round((dmg * SK.pal_reflect.back(p.buffLv.pal_reflect || 1)) / 100));
    NC.damageEnemy(game, att, { dmg: back, mod: 1 }, 0, 0, { color: '160,210,255' });
    V.boltAt(p.x, p.y - 70, att.x, att.y - 50, '160,210,255', 0.2, { w: 4, jag: 12, seg: 6 });
    return dmg;
  });
  RUN.pal_sacrifice = function (game, p, lv) {
    K.pose(game, p, 'smash3', 0.55);
    const cost = Math.round(p.hp * 0.08);
    if (!game.presentationOnly) p.hp = Math.max(1, p.hp - cost); // (online the server takes it: the bar follows its record)
    FX.num(p.x, p.y - 150, '-' + cost, { fill: '#ff8a8a', size: 34 });
    V.gather(p.x, p.y - 70, 14, '255,120,110', 160, 0.3);
    V.at(0.32, () => {
      V.beam(p.x, p.y, 160, 800, HOLY, 0.5);
      K.nova(game, p, 'pal_sacrifice', p.x, p.y, 230, { rgb: HOLY, color: '255,230,160', kb: 360, big: true, stars: 12, flash: '255,210,150', shake: 12, decal: 'crack' });
    });
  };
  RUN.pal_layhands = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    const k = (SK.pal_layhands.heal(lv) / 100) * K.healPow(p);
    for (const who of [p, ...K.friends(game, p, 440)]) K.heal(game, who, who.maxHp * k);
    V.circle(p.x, p.y, 160, GOLD, 0.9, { style: 'holy', spin: 2, follow: p });
    V.light(p.x, p.y - 60, 360, '200,255,170', 0.8, 0.6, { follow: p });
  };

  // ================= dragon knight =================
  const thrustPose = (game, p, i, lock) => K.pose(game, p, K.clip(p, 'thrust', i === undefined ? 2 : i), lock || 0.4);
  const fireLine = (game, p, id, a, len, w, o) => {
    const c = Math.cos(a), s = Math.sin(a), x0 = p.x + c * 40, y0 = p.y - 50;
    for (let k = 0; k < 9; k++) V.at(k * 0.02, () => {
      const d = 30 + (k / 8) * len;
      V.flameAt(x0 + c * d + rand(-10, 10), y0 + s * d * 0.7 + 40 + rand(-8, 8), rand(30, 44) * (o.k || 1), rand(60, 100) * (o.k || 1), P.fire, rand(0.3, 0.5), { vx: c * 260, vy: s * 180 - 50 });
    });
    V.flare(x0 + c * len, y0 + s * len * 0.7, 110, FIRE, 0.3);
    for (const e of K.lineHits(game, p.x, p.y - 30, a, len + 30, w)) K.hit(game, p, id, e, c * (o.kb || 200), s * (o.kb || 200) * 0.7, '255,170,90', o.mul);
  };
  RUN.dk_thrust = function (game, p, lv) {
    thrustPose(game, p, 2, 0.42);
    V.at(0.12, () => { fireLine(game, p, 'dk_thrust', p.aim, 330, 90, {}); V.shake(game, 6); V.light(p.x + Math.cos(p.aim) * 180, p.y - 50, 420, FIRE, 1, 0.4, { flick: true }); });
  };
  RUN.dk_leap = function (game, p, lv) {
    const [tx, ty] = K.ground(game, p, 380), a = NC.angle(p.x, p.y, tx, ty), d = Math.min(380, NC.dist(p.x, p.y, tx, ty) / 1);
    K.pose(game, p, 'gsLeap', 0.6);
    V.flameAt(p.x, p.y, 50, 90, P.fire, 0.5, { vy: -60 });
    K.dash(game, p, 'dk_leap', a, Math.max(60, d), 0.32, {
      rgb: FIRE, hit() {},
      tick(p) { if (Math.random() < 0.8) V.flameAt(p.x + rand(-16, 16), p.y - rand(10, 60), rand(24, 36), rand(40, 70), P.fire, 0.35, { vy: -40 }); },
      end(p) {
        for (let i = 0; i < 18; i++) { const b = (i / 18) * TAU, sp = rand(360, 520); V.flameAt(p.x + Math.cos(b) * 40, p.y + Math.sin(b) * 24, rand(34, 50), rand(70, 110), P.fire, rand(0.4, 0.6), { vx: Math.cos(b) * sp, vy: Math.sin(b) * sp * 0.6, drag: 3.6 }); }
        K.nova(game, p, 'dk_leap', p.x, p.y, 210, { rgb: FIRE, color: '255,170,90', kb: 460, big: true, decal: 'scorch', smoke: ['#5a4a52', '#7a6a70'], flash: '255,150,60', shake: 12 });
        V.stop(game, 0.06);
      },
    });
  };
  RUN.dk_breath = function (game, p, lv) {
    thrustPose(game, p, 0, 1.3);
    let acc = 0.15, n = 0;
    V.light(p.x, p.y - 60, 480, FIRE, 1, 1.3, { follow: p, flick: true });
    K.channel(game, p, 1.2, (ch, dt) => {
      const a = p.aim, c = Math.cos(a), s = Math.sin(a), hx = p.x + c * 50, hy = p.y - 60;
      for (let i = 0; i < 3; i++) { const b = a + rand(-0.4, 0.4), sp = rand(520, 760); V.flameAt(hx, hy + 40, rand(30, 46), rand(50, 80), P.fire, rand(0.4, 0.6), { vx: Math.cos(b) * sp, vy: Math.sin(b) * sp * 0.7 - 30, drag: 1.2 }); }
      if (Math.random() < 0.4) V.smoke(hx + c * 200, hy + s * 140, 1, '#5a4a52', '#7a6a70', { size: 0.8, lifeK: 0.8, rise: 40, a: 0.6 });
      if ((acc += dt) >= 0.15 && n < 8) {
        acc -= 0.15; n++;
        K.cone(game, p, 'dk_breath', 340, 0.5, { kb: 90, color: '255,170,90' });
        V.shake(game, 2);
      }
    });
  };
  FX.def('vdragon', (ctx, q, u) => {
    const a = V.fade(u, 0.1, 0.2), T = q.trail;
    if (!T || T.length < 2) return;
    ctx.save(); ctx.globalAlpha *= a;
    for (let i = 0; i < T.length; i++) { // the body: flame blobs thinning to the tail
      const k = i / T.length, [x, y] = T[i];
      V.glow(ctx, x, y, 50 * (0.4 + k), FIRE, 0.4, true);
      V.flame(ctx, x, y + 20, 36 * (0.35 + k * 0.8), 60 * (0.35 + k * 0.8), q.t * 20 + i, P.fire, 1);
    }
    const [hx, hy] = T[T.length - 1], [px, py] = T[T.length - 2], ang = Math.atan2(hy - py, hx - px);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    V.glow(ctx, 0, 0, 90, FIRE, 0.8, true);
    ctx.beginPath(); ctx.moveTo(44, 0); ctx.quadraticCurveTo(20, -30, -20, -24); ctx.lineTo(-30, -40); ctx.lineTo(-24, -14); ctx.quadraticCurveTo(-30, 0, -24, 14); ctx.lineTo(-30, 40); ctx.lineTo(-20, 24); ctx.quadraticCurveTo(20, 30, 44, 0);
    ctx.lineWidth = 4; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); ctx.fillStyle = '#ff7a2a'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, -10, 7, 5, 0, 0, TAU); ctx.fillStyle = '#fff3b8'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, 10, 7, 5, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
  }, 'glow');
  RUN.dk_roar = function (game, p, lv) {
    K.pose(game, p, 'cheer', 1.0);
    V.flash('60,10,0', 0.25, 2.2, 'source-over');
    V.circle(p.x, p.y, 280, FIRE, 2.3, { style: 'arcane', spin: -1.6, follow: p });
    V.light(p.x, p.y - 60, 700, FIRE, 1, 2.3, { follow: p, flick: true });
    const q = FX.add({
      type: 'vdragon', x: p.x, y: p.y, life: 2.2, trail: [],
      update(q) { const t = q.t, R = 150 + 90 * Math.sin(t * 2.2), a = t * 5.2; q.trail.push([p.x + Math.cos(a) * R, p.y - 70 + Math.sin(a) * R * 0.55]); if (q.trail.length > 16) q.trail.shift(); },
    });
    for (let w = 0; w < 5; w++) V.at(0.3 + w * 0.3, () => {
      V.ring(p.x, p.y, 60, 300, 12, FIRE, 0.45, { col: '#ff8a3a' });
      K.flames(p.x, p.y, 8, 260, { k: 1 });
      V.shake(game, 5);
      for (const e of K.around(game, p.x, p.y, 300)) K.hit(game, p, 'dk_roar', e, 0, 0, '255,170,90');
    });
    V.at(2, () => {
      q.dead = true;
      K.nova(game, p, 'dk_roar', p.x, p.y, 340, { rgb: FIRE, color: '255,170,90', mul: 2.5, kb: 520, big: true, decal: 'scorch', smoke: ['#5a4a52', '#7a6a70'], flash: '255,150,60', shake: 16, stars: 14 });
      K.flames(p.x, p.y, 16, 300, { k: 1.3 });
      V.stop(game, 0.1);
    });
  };
  RUN.dk_spiral = function (game, p, lv) {
    thrustPose(game, p, 1, 0.7);
    const e = K.target(game, p, 280, 180) || K.nearest(game, p.x, p.y, 280, 1, p.aim, 0.8)[0];
    for (let i = 0; i < 5; i++) V.at(0.08 + i * 0.1, () => {
      const [tx, ty] = K.tip(p);
      for (let k = 0; k < 6; k++) { const a = i * 1.3 + (k / 6) * TAU; V.flameAt(tx + Math.cos(a) * 26, ty + Math.sin(a) * 16 + 30, 22, 40, P.fire, 0.3, { vx: Math.cos(p.aim) * 200, vy: -30 }); }
      V.ring(tx, ty + 30, 6, 60, 5, FIRE, 0.2, { sq: 1 });
      if (e && K.alive(e)) { K.hit(game, p, 'dk_spiral', e, Math.cos(p.aim) * 60, Math.sin(p.aim) * 40, '255,170,90', 1, { big: i === 4 }); V.sparks(e.x, e.y - 50, 6, FIRE); }
      V.shake(game, 3);
    });
  };
  RUN.dk_charge = function (game, p, lv) {
    thrustPose(game, p, 2, 0.5);
    const a = p.aim;
    K.dash(game, p, 'dk_charge', a, 420, 0.3, {
      rgb: FIRE, pal: P.fire,
      hit(e) {
        const side = Math.sign((e.x - p.x) * -Math.sin(a) + (e.y - p.y) * Math.cos(a)) || 1;
        K.hit(game, p, 'dk_charge', e, -Math.sin(a) * 420 * side, Math.cos(a) * 300 * side, '255,170,90', 1, { big: true });
        V.flare(e.x, e.y - 50, 90, FIRE, 0.25);
        V.shake(game, 5);
      },
      tick(p) { if (Math.random() < 0.9) V.flameAt(p.x + rand(-20, 20), p.y + rand(-6, 6), rand(26, 40), rand(40, 70), P.fire, 0.4, { vy: -40 }); },
      end(p) { K.burst(game, p.x, p.y, 120, FIRE, { shake: 6 }); },
    });
  };
  RUN.dk_wyvern = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    NC.Pets.summon(game, p, 'wyvern', {
      skill: 'dk_wyvern', lv, scale: 0.9 + lv * 0.04, dur: SK.dk_wyvern.dur(lv), every: 1.4, name: 'ไวเวิร์น', glow: FIRE,
      act(game, q, e) {
        q.fire = 0.35;
        const from = [q.x + q.face * 26 * q.scale, q.y - q.T.fly - 20 * q.scale];
        K.shot(game, p, 'dk_wyvern', {
          from, ang: NC.angle(from[0], from[1], e.x, e.y - 40), v: 820, range: 620, rgb: FIRE, size: 0.9 + lv * 0.03, home: 4, target: e,
          trail(q2) { if (Math.random() < 0.7) V.flameAt(q2.x + rand(-6, 6), q2.y + 14, rand(14, 22), rand(24, 36), P.fire, 0.25, { vy: -40 }); },
          hit(t, q2) { K.nova(game, p, 'dk_wyvern', q2.x, q2.y + 40, 70, { rgb: FIRE, color: '255,170,90', mul: (p.d.petK || 1), shake: 2, sparks: 8, flare: false }); },
        });
      },
    });
    V.flash('255,150,60', 0.08, 0.25);
  };

  // ================= archmage =================
  RUN.am_missile = function (game, p, lv) {
    castPose(game, p, 0.3);
    const foes = K.nearest(game, p.x, p.y, 700, 3);
    for (let i = 0; i < 3; i++) V.at(0.05 + i * 0.08, () => {
      const t = foes.length ? foes[i % foes.length] : null;
      K.shot(game, p, 'am_missile', {
        ang: p.aim + (i - 1) * 0.5, v: 760, range: 900, rgb: MOON, size: 1, home: 7, target: t, core: '#eaf4ff',
        trail(q) { if (Math.random() < 0.5) V.motes(q.x, q.y, 1, MOON, { rise: 10, spread: 4, lifeK: 0.5, size: 0.7 }); },
        hit(e, q) { K.hit(game, p, 'am_missile', e, 0, 0, '190,215,255'); V.flare(q.x, q.y, 60, MOON, 0.2); V.ring(q.x, q.y + 40, 8, 70, 5, MOON, 0.25); },
      });
    });
  };
  FX.def('vhex', (ctx, q, u) => {
    const o = q.follow, a = V.fade(u, 0.05, 0.1) * (0.5 + 0.5 * (q.hitT ? Math.max(0, 1 - (q.t - q.hitT) / 0.3) : 0) + 0.3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(o.x, o.y - 70);
    for (let ring = 0; ring < 2; ring++) {
      const R = 95 + ring * 12;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const b = (i / 6) * TAU + q.t * (ring ? -0.6 : 0.6); ctx.lineTo(Math.cos(b) * R, Math.sin(b) * R * 1.05); }
      ctx.strokeStyle = `rgba(${MOON},${0.55 * a})`; ctx.lineWidth = ring ? 2 : 4; ctx.stroke();
    }
    ctx.restore();
    V.glow(ctx, o.x, o.y - 70, 120, MOON, 0.18 * a, false);
  }, 'glow');
  RUN.am_shield = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.3);
    const dur = K.startBuff(game, p, 'am_shield', lv);
    p.hexFx = FX.add({ type: 'vhex', follow: p, x: p.x, y: p.y, life: dur });
    K.buffFx(game, p, MOON, { style: 'arcane' });
  };
  // the mana shield: SP pays for part of the hit (1 SP per 2 damage)
  NC.heroGuards.push((game, p, dmg) => {
    if (!(p.buffs.am_shield > 0)) return dmg;
    const share = Math.round((dmg * SK.am_shield.soak(p.buffLv.am_shield || 1)) / 100), cost = share / 2;
    if (p.sp < cost) return dmg;
    p.sp -= cost;
    if (p.hexFx) p.hexFx.hitT = p.hexFx.t;
    V.sparks(p.x, p.y - 80, 6, MOON, { size: 0.7 });
    return dmg - share;
  });
  RUN.am_blizzard = function (game, p, lv) {
    castPose(game, p, 0.35);
    const [tx, ty] = K.ground(game, p, 460), R = 200;
    K.zone(game, p, 'am_blizzard', tx, ty, R, 3.5, 0.35, {
      rgb: C.ice, style: 'arcane', color: '170,225,255',
      each(e) { K.slow(e, 1.2); },
      tick(z, dt) {
        for (let i = 0; i < 2; i++) if (Math.random() < dt * 22) {
          const a = rand(0, TAU), d = Math.sqrt(Math.random()) * R, x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d * V.SQ;
          FX.add({ type: 'shard', x: x + 120, y: y - 520, vx: -300, vy: 1300, life: 0.4 });
          if (Math.random() < 0.3) V.smoke(x, y - 10, 1, '#e6f6ff', '#ffffff', { size: 0.6, lifeK: 0.6, a: 0.7 });
        }
        if (Math.random() < dt * 30) FX.add({ type: 'vstreak', x: tx + rand(-R, R), y: ty - rand(40, 200), vx: -500, vy: 120, len: rand(40, 80), w: 2, rgb: '230,245,255', life: 0.3 });
      },
    });
    V.decal(tx, ty, R, 'frost', 3.8);
  };
  FX.def('veclipse', (ctx, q, u) => {
    const a = V.fade(u, 0.15, 0.1), R = 110 * V.easeOut(Math.min(1, q.t / 0.8)), x = q.x, y = q.y - 330;
    V.glow(ctx, x, y, R * 3.2, '255,170,60', 0.8 * a, true);
    ctx.save(); ctx.globalAlpha *= a;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) { // the corona
      const b = (i / 18) * TAU + q.t * 0.8, l = R * (1.3 + 0.25 * Math.sin(q.t * 7 + i * 2));
      ctx.beginPath(); ctx.moveTo(x + Math.cos(b - 0.08) * R, y + Math.sin(b - 0.08) * R); ctx.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l); ctx.lineTo(x + Math.cos(b + 0.08) * R, y + Math.sin(b + 0.08) * R);
      ctx.fillStyle = 'rgba(255,200,90,0.7)'; ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fillStyle = '#16121e'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffd36a'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x - R * 0.25, y - R * 0.2, R * 0.3, 0, TAU); ctx.fillStyle = 'rgba(80,70,110,0.5)'; ctx.fill();
    ctx.restore();
  }, 'high');
  RUN.am_eclipse = function (game, p, lv) {
    K.pose(game, p, 'cheer', 1.0);
    const [tx, ty] = K.ground(game, p, 420), R = 300;
    V.flash('8,6,20', 0.45, 3.2, 'source-over');
    FX.add({ type: 'veclipse', x: tx, y: ty, life: 3.1 });
    V.circle(tx, ty, R, '255,190,90', 3.1, { style: 'star', spin: 0.7, grow: true });
    V.light(tx, ty - 80, 700, '255,190,90', 0.8, 3.1);
    for (let w = 0; w < 4; w++) V.at(0.6 + w * 0.45, () => {
      V.ring(tx, ty, 40, R * 1.05, 10, '255,190,90', 0.45);
      for (let i = 0; i < 6; i++) { const a = rand(0, TAU), d = rand(40, R * 0.9); V.beam(tx + Math.cos(a) * d, ty + Math.sin(a) * d * V.SQ, 36, 420, '255,200,110', 0.35, { a: 0.7 }); }
      V.shake(game, 5);
      for (const e of K.around(game, tx, ty, R)) K.hit(game, p, 'am_eclipse', e, 0, 0, '255,210,150');
    });
    V.at(2.6, () => {
      K.nova(game, p, 'am_eclipse', tx, ty, R + 40, { rgb: '255,160,60', color: '255,200,120', mul: 3, kb: 480, big: true, decal: 'scorch', flash: '255,210,140', shake: 18, stars: 16 });
      K.flames(tx, ty, 20, R, { k: 1.2 });
    });
  };
  RUN.am_chain = function (game, p, lv) {
    castPose(game, p, 0.3);
    const first = K.target(game, p, 600);
    if (!first) { const [x, y] = K.ground(game, p, 400); V.boltAt(K.tip(p)[0], K.tip(p)[1], x, y - 30, C.lightning, 0.2, { w: 5, jag: 24, seg: 9 }); return; }
    V.flash('200,235,255', 0.1, 0.15);
    K.chain(game, p, 'am_chain', first, SK.am_chain.n(lv), 300, { rgb: C.lightning, mul: 1, fall: 0.92, gap: 0.08, each(e) { K.stun(game, e, 0.3); } });
  };
  RUN.am_firepillar = function (game, p, lv) {
    castPose(game, p, 0.3);
    const e0 = K.target(game, p, 560);
    let [tx, ty] = e0 ? [e0.x, e0.y] : K.ground(game, p, 420);
    for (let i = 0; i < 3; i++) V.at(0.15 + i * 0.25, () => {
      if (e0 && K.alive(e0)) { tx = e0.x; ty = e0.y; }
      V.circle(tx, ty, 90, FIRE, 0.4, { style: 'arcane', spin: 3 });
      for (let k = 0; k < 7; k++) V.flameAt(tx + rand(-26, 26), ty + rand(-8, 8), rand(40, 60), rand(150, 230), P.fire, rand(0.4, 0.6), { vy: -120 });
      V.glowAt(tx, ty - 80, 30, 160, FIRE, 0.9, 0.35, { hot: true });
      V.light(tx, ty - 60, 360, FIRE, 1, 0.4, { flick: true });
      V.shake(game, 4);
      for (const e of K.around(game, tx, ty, 110)) K.hit(game, p, 'am_firepillar', e, 0, -140, '255,170,90');
    });
  };
  FX.def('vhole', (ctx, q, u) => {
    const a = V.fade(u, 0.1, 0.15), R = q.r;
    ctx.save(); ctx.translate(q.x, q.y - 20); ctx.scale(1, V.SQ);
    for (let i = 0; i < 3; i++) { // swirling arms
      ctx.save(); ctx.rotate(-q.t * (2.4 + i * 0.6) + i * 2.1);
      ctx.beginPath();
      for (let k = 0; k <= 30; k++) { const t = k / 30, rr = R * (1 - t * 0.9), b = t * 5; ctx.lineTo(Math.cos(b) * rr, Math.sin(b) * rr); }
      ctx.strokeStyle = `rgba(${VIOLET},${0.55 * a})`; ctx.lineWidth = 10 - i * 2; ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, R * 0.28, 0, TAU); ctx.fillStyle = `rgba(10,6,20,${0.95 * a})`; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = `rgba(230,200,255,${0.9 * a})`; ctx.stroke();
    ctx.restore();
    V.glow(ctx, q.x, q.y - 20, R * 1.4, VIOLET, 0.35 * a, false, V.SQ);
  }, 'low');
  RUN.am_gravity = function (game, p, lv) {
    castPose(game, p, 0.35);
    const [tx, ty] = K.ground(game, p, 460), R = 190;
    FX.add({ type: 'vhole', x: tx, y: ty, r: R, life: 3 });
    K.zone(game, p, 'am_gravity', tx, ty, R, 3, 0.35, {
      rgb: VIOLET, circle: false, pull: 120, color: '210,170,255',
      tick(z, dt) { if (Math.random() < dt * 24) { const a = rand(0, TAU); V.motes(tx + Math.cos(a) * R * 1.2, ty + Math.sin(a) * R * 0.7, 1, VIOLET, { rise: 0, spread: 4, size: 0.9 }); } },
      end() { K.burst(game, tx, ty, 160, VIOLET, { shake: 8, flash: '200,150,255' }); },
    });
  };

  // ================= lantern warlock =================
  RUN.wl_soulfire = function (game, p, lv) {
    castPose(game, p, 0.28);
    V.at(0.06, () => K.shot(game, p, 'wl_soulfire', {
      v: 820, range: 800, rgb: TEAL, size: 1.3, core: '#e9fff8',
      trail(q) { if (Math.random() < 0.8) V.flameAt(q.x + rand(-6, 6), q.y + 16, rand(18, 26), rand(30, 44), ['#1f8f86', '#5ae8d6', '#e9fff8'], 0.25, { vy: -50 }); },
      hit() {},
      end(q) {
        K.nova(game, p, 'wl_soulfire', q.x, q.y + 40, 100, { rgb: TEAL, color: '140,255,230', shake: 4,
          each(e, r) { if (r && !r.miss) K.poison(game, p, e, 3, 0.2); } });
        FX.add({ type: 'vproj', layer: 'glow', x: q.x, y: q.y, life: 0.6, draw(ctx, q2) { K.drawGhost(ctx, q2.x, q2.y - q2.t * 60, 14, q2.t, TEAL, 1 - q2.t / 0.6); } });
      },
    }));
  };
  RUN.wl_wisps = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.35);
    const dur = SK.wl_wisps.dur(lv), shotT = [0.3, 0.6, 0.9];
    FX.add({
      type: 'vproj', layer: 'glow', x: p.x, y: p.y, life: dur,
      update(q, dt) {
        for (let i = 0; i < 3; i++) {
          if ((shotT[i] -= dt) > 0) continue;
          shotT[i] = 1;
          const a = q.t * 2.4 + (i / 3) * TAU, from = [p.x + Math.cos(a) * 80, p.y - 90 + Math.sin(a) * 30];
          const e = K.nearest(game, from[0], from[1], 440, 1)[0];
          if (e) K.shot(game, p, 'wl_wisps', { from, ang: NC.angle(from[0], from[1], e.x, e.y - 45), v: 720, range: 520, style: 'ghost', rgb: TEAL, size: 0.6, home: 6, target: e, color: '140,255,230' });
        }
      },
      draw(ctx, q) {
        for (let i = 0; i < 3; i++) { const a = q.t * 2.4 + (i / 3) * TAU; K.drawGhost(ctx, p.x + Math.cos(a) * 80, p.y - 90 + Math.sin(a) * 30, 12, q.t + i, TEAL, Math.min(1, q.t * 3, (q.life - q.t) * 3)); }
      },
    });
    K.buffFx(game, p, TEAL, { style: 'occult', flash: false });
  };
  FX.def('vchains', (ctx, q, u) => {
    const e = q.e, a = V.fade(u, 0.1, 0.25);
    if (!e) return;
    ctx.save(); ctx.globalAlpha *= a;
    for (let k = 0; k < 3; k++) {
      const b = (k / 3) * TAU + 0.5, sx = e.x + Math.cos(b) * 70, sy = e.y + Math.sin(b) * 34, ex = e.x, ey = e.y - 40;
      for (let i = 0; i < 7; i++) { // links
        const t = (i + 0.5) / 7, x = lerp(sx, ex, t), y = lerp(sy, ey, t) - Math.sin(t * Math.PI) * 14;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(ey - sy, ex - sx) + (i % 2 ? Math.PI / 2 : 0));
        ctx.beginPath(); ctx.ellipse(0, 0, 8, 4.5, 0, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#c79bff'; ctx.stroke();
        ctx.restore();
      }
      V.glow(ctx, sx, sy, 20, VIOLET, 0.5, true);
    }
    ctx.restore();
  }, 'glow');
  RUN.wl_chains = function (game, p, lv) {
    castPose(game, p, 0.3);
    const [tx, ty] = K.ground(game, p, 460), hold = SK.wl_chains.hold(lv);
    V.circle(tx, ty, 170, VIOLET, hold + 0.3, { style: 'occult', spin: 1.5, grow: true });
    V.at(0.15, () => K.nova(game, p, 'wl_chains', tx, ty, 170, { rgb: VIOLET, color: '210,170,255', shake: 5, flare: false,
      each(e, r) { if (!r || r.miss) return; K.stun(game, e, hold); K.vuln(game, e, 1.15, 6, VIOLET); FX.add({ type: 'vchains', e, x: e.x, y: e.y, life: hold }); } }));
  };
  RUN.wl_parade = function (game, p, lv) {
    K.pose(game, p, 'cheer', 1.0);
    V.flash('10,20,30', 0.3, 2.8, 'source-over');
    V.circle(p.x, p.y, 220, TEAL, 2.8, { style: 'occult', spin: 1.4, follow: p });
    V.light(p.x, p.y - 60, 600, TEAL, 1, 2.8, { follow: p });
    const foes = K.nearest(game, p.x, p.y, 700, 12);
    for (let i = 0; i < 24; i++) V.at(0.25 + i * 0.1, () => {
      const t = foes.length ? foes[i % foes.length] : null, from = K.tip(p);
      K.shot(game, p, 'wl_parade', { from, ang: p.aim + rand(-1.4, 1.4), v: 640, range: 1000, style: 'ghost', rgb: TEAL, size: 0.9, home: 5, target: t, color: '140,255,230',
        hit(e, q) { K.hit(game, p, 'wl_parade', e, 0, 0, '140,255,230'); V.sparks(q.x, q.y, 6, TEAL, { size: 0.7 }); V.ring(q.x, q.y + 40, 6, 70, 5, TEAL, 0.25); } });
    });
  };
  // a curse that burns: its own timer on each monster, a teal flame over it
  function soulburn(game, p, e, id, dur, every) {
    let acc = 0;
    FX.add({
      type: 'timer', layer: 'none', life: dur,
      update(z, dt) {
        if (!K.alive(e)) { z.dead = true; return; }
        if (Math.random() < dt * 8) V.flameAt(e.x + rand(-14, 14), e.y - rand(40, 80), 18, 30, ['#1f8f86', '#5ae8d6', '#e9fff8'], 0.3, { vy: -60 });
        if ((acc += dt) >= every) { acc -= every; K.hit(game, p, id, e, 0, 0, '140,255,230'); }
      },
    });
  }
  RUN.wl_soulburn = function (game, p, lv) {
    castPose(game, p, 0.3);
    const [tx, ty] = K.ground(game, p, 460), foes = K.nearest(game, tx, ty, 220, 5);
    V.circle(tx, ty, 200, TEAL, 0.6, { style: 'occult', spin: 2, grow: true });
    for (const e of foes) { V.boltAt(K.tip(p)[0], K.tip(p)[1], e.x, e.y - 50, TEAL, 0.25, { w: 3, jag: 18, seg: 8 }); soulburn(game, p, e, 'wl_soulburn', 6, 0.5); }
    if (!foes.length) FX.num(tx, ty - 60, 'ไม่มีเป้า', { fill: '#cfd8ff', size: 26 });
  };
  RUN.wl_lantern = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    NC.Pets.summon(game, p, 'lantern', {
      skill: 'wl_lantern', lv, scale: 0.9 + lv * 0.04, dur: SK.wl_lantern.dur(lv), every: 1.1, name: 'ภูตตะเกียง', glow: TEAL,
      act(game, q, e) {
        q.fire = 0.4;
        const from = [q.x, q.y - q.T.fly - 24 * q.scale];
        V.boltAt(from[0], from[1], e.x, e.y - 50, TEAL, 0.35, { w: 6, jag: 10, seg: 8 });
        V.glowAt(e.x, e.y - 50, 20, 90, TEAL, 0.8, 0.3, { hot: true });
        const r = K.hit(game, p, 'wl_lantern', e, 0, 0, '140,255,230', p.d.petK || 1);
        if (r && r.dmg > 0) {
          const got = Math.min(p.maxHp - p.hp, Math.round(r.dmg * 0.3));
          if (got > 0) { p.hp += got; FX.num(p.x, p.y - 150, '+' + got, { fill: '#8dffd8', size: 30 }); }
          for (let i = 0; i < 4; i++) V.motes(e.x, e.y - 50, 1, TEAL, { rise: 40, spread: 20, size: 0.8 });
        }
      },
    });
  };
  // souls from the monsters that fall near the warlock (the passive), MATK +2% each, gone after 20 s without a new one
  NC.skillKills.push((game, e) => {
    const p = game.player, lv = NC.skillLv(p, 'wl_harvest');
    if (!lv || NC.dist(e.x, e.y, p.x, p.y) > 600) return;
    const max = 3 + Math.floor(lv / 2);
    p.souls = { n: Math.min(max, ((p.souls && p.souls.n) || 0) + 1), t: game.time };
    FX.add({ type: 'vproj', layer: 'glow', x: e.x, y: e.y - 50, life: 0.5, update(q) { q.x = lerp(e.x, p.x, q.t / 0.5); q.y = lerp(e.y - 50, p.y - 90, q.t / 0.5); }, draw(ctx, q) { K.drawGhost(ctx, q.x, q.y, 10, q.t, TEAL); } });
    NC.applyGear(game);
    if (!p.soulFx || p.soulFx.dead) p.soulFx = FX.add({ type: 'vproj', layer: 'glow', x: p.x, y: p.y, life: 1e9, draw(ctx, q) {
      const n = (p.souls && p.souls.n) || 0;
      for (let i = 0; i < n; i++) { const a = game.time * 1.8 + (i / n) * TAU; K.drawGhost(ctx, p.x + Math.cos(a) * 60, p.y - 110 + Math.sin(a) * 20, 8, game.time + i, TEAL, 0.85); }
    } });
  });
  NC.skillModSources.push((p) => (p.souls && p.souls.n ? { matk: p.souls.n * 2 } : null));
  NC.skillTicks.push((game, p) => {
    if (p.souls && p.souls.n && game.time - p.souls.t > 20) { p.souls = null; NC.applyGear(game); }
    if (p.soulFx && !(p.souls && p.souls.n)) { p.soulFx.dead = true; p.soulFx = null; }
  });
  RUN.wl_pact = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.35);
    const hp = Math.round(p.maxHp * 0.1);
    if (!game.presentationOnly) { p.hp = Math.max(1, p.hp - hp); p.sp = Math.min(p.maxSp, p.sp + hp); } // (online: the server's)
    FX.num(p.x, p.y - 150, '-' + hp + ' HP', { fill: '#ff8a8a', size: 30 });
    FX.num(p.x, p.y - 190, '+' + hp + ' SP', { fill: '#8fc8ff', size: 30 });
    K.startBuff(game, p, 'wl_pact', lv);
    K.buffFx(game, p, '150,90,220', { style: 'occult' });
  };
  RUN.wl_hex = function (game, p, lv) {
    castPose(game, p, 0.3);
    const e = K.target(game, p, 560);
    if (!e) { FX.num(p.x, p.y - 170, 'ไม่มีเป้า', { fill: '#cfd8ff', size: 28 }); return; }
    const mark = FX.add({ type: 'vproj', layer: 'glow', x: e.x, y: e.y, life: 2.5,
      update(q) { if (K.alive(e)) { q.x = e.x; q.y = e.y; } },
      draw(ctx, q) {
        const k = q.t / 2.5, s = 34 + 10 * Math.sin(q.t * (6 + k * 20));
        V.glow(ctx, q.x, q.y - 150, 60, '255,80,140', 0.5 + 0.4 * k, true);
        V.skull(ctx, q.x, q.y - 150, s, '#ff9ac8', 0.9);
      } });
    V.at(2.5, () => {
      const x = K.alive(e) ? e.x : mark.x, y = K.alive(e) ? e.y : mark.y;
      if (K.alive(e)) K.hit(game, p, 'wl_hex', e, 0, 0, '255,140,190', 1, { big: true });
      for (const f of K.around(game, x, y, 150)) if (f !== e) K.hit(game, p, 'wl_hex', f, 0, 0, '255,140,190', 0.5);
      K.burst(game, x, y, 150, '255,80,140', { shake: 9, stars: 8, flash: '255,120,170' });
    });
  };
})();
