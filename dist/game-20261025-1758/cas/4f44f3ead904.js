/* class2_skills_b.js — the 2nd jobs from the archer and the rogue, ten skills each (their 1st job's stay too):
     เรนเจอร์     ยิงสามดอก · กับดักระเบิด · ธนูใบไม้ทะลวง · พายุศร (อัลติ) · ตาอินทรี · ช่างกับดัก · กับดักน้ำแข็ง ·
                 เล็งจุดตาย (บัฟ) · ยิงสไนป์ · จุดระเบิดกับดัก                             -> traps and precision
     นักล่าหมาป่า  ธนูเขี้ยวหมาป่า · เรียกหมาป่า · หอนเรียกพลัง (บัฟ) · ฝูงหมาป่าวิญญาณ (อัลติ) · สายใยสัตว์ป่า · สั่งขย้ำ ·
                 จ่าฝูง · ล่าเป้าหมาย · ชำนาญธนูพราน · คลั่งป่า (บัฟ)                     -> the wolf that grows with its skill
     นักฆ่า       เขี้ยวคู่ · อำพรางกาย (บัฟ) · มีดพิษกระจาย · ตราประทับมรณะ (อัลติ) · ชำนาญมีดคู่ · พิษร้าย ·
                 อาบพิษมรณะ (บัฟ) · เขี้ยวมัจจุราช · ระเบิดพิษ · อุกกาบาตเงา                -> critical, poison, one target
     นินจา        คุไนระเบิด · แยกเงาร่าง · ใบมีดวายุ · พายุชูริเคน (อัลติ) · คาถาไฟ · คาถาสายฟ้า · วิชานินจา ·
                 คาถาสลับร่าง (บัฟ) · ระเบิดควัน · ขว้างดาวยักษ์วกกลับ                              -> jutsu and mobility
   Built with skillkit.js; the traps are skills_t1.js's NC.Traps, the wolf is pets.js's. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS;
  const { C, P, TAU } = K;
  const rand = NC.rand, lerp = NC.lerp, S = K.S;
  const r1 = (v) => Math.round(v * 10) / 10;
  const W = (p) => NC.weaponDef(p) || {};

  NC.JOBS.ranger.skills = ['rg_triple', 'rg_trap', 'rg_piercer', 'rg_storm', 'rg_eagle', 'rg_trapmastery', 'rg_freezetrap', 'rg_focus', 'rg_snipe', 'rg_detonate'];
  NC.JOBS.wolfhunter.skills = ['wh_fang', 'wh_wolf', 'wh_howl', 'wh_pack', 'wh_bond', 'wh_command', 'wh_alpha', 'wh_mark', 'wh_huntmastery', 'wh_frenzy'];
  NC.JOBS.assassin.skills = ['as_twin', 'as_cloak', 'as_knives', 'as_deathmark', 'as_katar', 'as_venom', 'as_edp', 'as_grimtooth', 'as_splasher', 'as_meteor'];
  NC.JOBS.shinobi.skills = ['sh_kunai', 'sh_clone', 'sh_windblade', 'sh_shuriken', 'sh_katon', 'sh_raiton', 'sh_ninjamastery', 'sh_substitute', 'sh_smoke', 'sh_huuma'];

  const LEAF = C.wind, WOLF = '150,200,255', RED = C.blood, VENOM = C.poison, NINJA = '120,140,210', FIRE_T = C.fire;
  const wolfOf = () => NC.Pets && NC.Pets.get('wolf');

  K.def({
    // ======== ranger ========
    rg_triple: S({ name: 'ยิงสามดอก', icon: 'sk_rg_triple', free: 1, cd: 2.2, sp: (lv) => 9 + lv, mul: (lv) => 1.3 + lv * 0.18,
      desc: (lv, m) => `ยิงธนูพันลม 3 ดอกเป็นพัดแคบ ทะลุทุกตัวในแนว ดอกละ ${m}% ของ ATK` }),
    rg_trap: S({ name: 'กับดักระเบิด', icon: 'sk_rg_trap', req: [['ar_snare', 3]], cd: 4, sp: (lv) => 10 + lv, mul: (lv) => 4.2 + lv * 0.56,
      desc: (lv, m) => `โยนกับดักระเบิดที่เมาส์ (วางได้หลายอัน) ศัตรูเหยียบแล้วระเบิดเป็นวง ${m}% ของ ATK มึน 1.2 วิ` }),
    rg_piercer: S({ name: 'ธนูใบไม้ทะลวง', icon: 'sk_rg_piercer', element: 'wind', req: [['ar_charge', 3]], cd: 7, sp: (lv) => 16 + lv, mul: (lv) => 4 + lv * 0.6,
      desc: (lv, m) => `ธนูหมุนใบไม้ทะลุทั้งแนว ${m}% ของ ATK แล้วเปิดวังวนใบไม้ดูดศัตรูตรงศัตรูตัวแรกที่โดน (ไม่โดนใครจะเปิดที่ปลายทาง)` }),
    rg_storm: S({ name: 'พายุศร', icon: 'sk_rg_storm', ult: true, element: 'wind', req: [['rg_piercer', 5]], cd: 30, sp: (lv) => 40 + lv * 2, mul: (lv) => 2.2 + lv * 0.3,
      desc: (lv, m) => `พายุธนู 40 ดอกกับสายฟ้าสีเขียวถล่มพื้นที่ที่เล็ง ดอกละ ${m}% ของ ATK` }),
    rg_eagle: S({ name: 'ตาอินทรี', icon: 'sk_rg_eagle', pass: (lv) => ({ crit: lv, critDmg: lv * 3 }), desc: (lv) => `คริติคอล +${lv}% · ดาเมจคริติคอล +${lv * 3}%` }),
    rg_trapmastery: S({ name: 'ช่างกับดัก', icon: 'sk_rg_trapmastery', pass: (lv) => ({ trap: lv * 5, traps: Math.floor(lv / 3) }),
      desc: (lv) => `กับดักแรงขึ้น ${lv * 5}% · วางกับดักได้เพิ่ม ${Math.floor(lv / 3)} อัน (ปกติ 3)` }),
    rg_freezetrap: S({ name: 'กับดักน้ำแข็ง', icon: 'sk_rg_freezetrap', element: 'water', req: [['rg_trap', 3]], cd: 6, sp: (lv) => 12 + lv, mul: (lv) => 1.8 + lv * 0.3,
      freeze: (lv) => 2 + lv * 0.2, desc: (lv, m) => `โยนกับดักน้ำแข็ง ศัตรูเหยียบแล้วแช่แข็งทั้งวง ${(2 + lv * 0.2).toFixed(1)} วิ และ ${m}% ของ ATK` }),
    rg_focus: S({ name: 'เล็งจุดตาย', icon: 'sk_rg_focus', kind: 'buff', req: [['rg_eagle', 3]], cd: 45, sp: (lv) => 24 + lv * 2, rgb: '180,255,150', circle: 'star',
      dur: () => 30, buff: (lv) => ({ atk: r1(5 + lv * 1.5), crit: r1(1 + lv * 0.5), hit: lv * 2 }),
      desc: (lv) => `30 วิ: ATK +${r1(5 + lv * 1.5)}% คริติคอล +${r1(1 + lv * 0.5)}% ความแม่น +${lv * 2} · ยิงสไนป์ตอนเล็งอยู่คริติคอลแน่นอน` }),
    rg_snipe: S({ name: 'ยิงสไนป์', icon: 'sk_rg_snipe', req: [['rg_piercer', 3], ['rg_eagle', 5]], cd: 10, sp: (lv) => 24 + lv * 2, mul: (lv) => 5.6 + lv * 0.7,
      desc: (lv, m) => `เล็ง 0.6 วิแล้วยิงทะลุทั้งแนว ${m}% ของ ATK` }),
    rg_detonate: S({ name: 'จุดระเบิดกับดัก', icon: 'sk_rg_detonate', req: [['rg_trapmastery', 3]], cd: 3, sp: () => 8, mul: () => 0,
      need: () => (NC.Traps && NC.Traps.list.length ? true : 'ยังไม่ได้วางกับดัก'), desc: () => 'จุดระเบิดกับดักทุกอันที่วางไว้ทันที แรงขึ้น 50%' }),

    // ======== wolf hunter ========
    wh_fang: S({ name: 'ธนูเขี้ยวหมาป่า', icon: 'sk_wh_fang', cd: 2.8, sp: (lv) => 10 + lv, mul: (lv) => 2 + lv * 0.3,
      desc: (lv, m) => `ลูกธนูเขี้ยวหมาป่า ${m}% ของ ATK · ถ้าหมาป่าออกมาอยู่ มันจะวิ่งไปกัดเป้าเดียวกัน` }),
    wh_wolf: S({ name: 'เรียกหมาป่า', icon: 'sk_wh_wolf', free: 1, cd: 20, sp: (lv) => 30 + lv, mul: (lv) => 0.5 + lv * 0.07,
      desc: (lv, m) => `เรียกหมาป่าคู่ใจ อยู่จนกว่าจะหมดแรง กัดครั้งละ ${m}% ของ ATK · ตัวใหญ่ ${Math.round((0.8 + lv * 0.05) * 100)}% เลือด ${35 + lv * 5}% ของเรา` +
        `${lv >= 5 ? ' · กัดติดเลือดออก' : ' · (Lv 5 กัดติดเลือดออก)'}${lv >= 8 ? ' · กัดโดนรอบตัว' : ' · (Lv 8 กัดโดนรอบตัว)'}` }),
    wh_howl: S({ name: 'หอนเรียกพลัง', icon: 'sk_wh_howl', kind: 'buff', req: [['wh_wolf', 3]], cd: 30, sp: (lv) => 22 + lv, rgb: WOLF, circle: 'star',
      dur: (lv) => 20 + lv, buff: (lv) => ({ atk: 8 + lv * 2, aspd: 5 + lv }),
      desc: (lv) => `หอนใต้แสงจันทร์ ${20 + lv} วิ: ATK +${8 + lv * 2}% โจมตีเร็วขึ้น ${5 + lv}% (หมาป่าด้วย) ศัตรูรอบตัวหวาดกลัว 1 วิ` }),
    wh_pack: S({ name: 'ฝูงหมาป่าวิญญาณ', icon: 'sk_wh_pack', ult: true, req: [['wh_wolf', 5], ['wh_howl', 3]], cd: 45, sp: (lv) => 45 + lv * 3, mul: (lv) => 2 + lv * 0.25,
      desc: (lv, m) => `หมาป่าวิญญาณ 5 ตัววิ่งตะลุยไปข้างหน้า ชนทุกตัวที่ผ่าน ตัวละ ${m}% ของ ATK` }),
    wh_bond: S({ name: 'สายใยสัตว์ป่า', icon: 'sk_wh_bond', pass: (lv) => ({ pet: lv * 8, atk: lv }), desc: (lv) => `สัตว์ที่เรียกมาแรงขึ้น ${lv * 8}% · ATK +${lv}%` }),
    wh_command: S({ name: 'สั่งขย้ำ', icon: 'sk_wh_command', req: [['wh_wolf', 3]], cd: 5, sp: (lv) => 10 + lv, mul: (lv) => 1 + lv * 0.15,
      need: () => (wolfOf() ? true : 'ต้องเรียกหมาป่าก่อน'), desc: (lv, m) => `สั่งหมาป่าพุ่งขย้ำศัตรูใกล้เมาส์ 3 ครั้ง ครั้งละ ${m}% ของ ATK มึน 0.5 วิ` }),
    wh_alpha: S({ name: 'จ่าฝูง', icon: 'sk_wh_alpha', pass: (lv) => ({ pet: lv * 5 }), wolf: (lv) => ({ size: lv * 0.02, hp: lv * 0.05 }),
      desc: (lv) => `หมาป่าตัวโตขึ้นอีก ${lv * 2}% เลือด +${lv * 5}% กัดแรงขึ้น ${lv * 5}%` }),
    wh_mark: S({ name: 'ล่าเป้าหมาย', icon: 'sk_wh_mark', type: 'debuff', req: [['wh_fang', 3]], cd: 10, sp: () => 12, mul: () => 0,
      desc: (lv) => `ทำเครื่องหมายศัตรูใกล้เมาส์ 15 วิ: รับดาเมจเพิ่ม ${10 + lv * 2}% และหมาป่าจะไล่กัดตัวนั้น` }),
    wh_huntmastery: S({ name: 'ชำนาญธนูพราน', icon: 'sk_wh_huntmastery', pass: (lv, p) => (W(p).style === 'arrow' ? { atk: lv * 2, dex: Math.floor(lv / 2) } : null),
      desc: (lv) => `ถือธนู: ATK +${lv * 2}% DEX +${Math.floor(lv / 2)}` }),
    wh_frenzy: S({ name: 'คลั่งป่า', icon: 'sk_wh_frenzy', kind: 'buff', req: [['wh_bond', 5]], cd: 40, sp: () => 30, rgb: '255,120,90', circle: 'occult',
      dur: () => 15, buff: (lv) => ({ aspd: 10 + lv * 2 }),
      desc: (lv) => `15 วิ: เราโจมตีเร็วขึ้น ${10 + lv * 2}% หมาป่าตัวใหญ่ขึ้นและกัดเร็วขึ้นมาก` }),

    // ======== assassin ========
    as_twin: S({ name: 'เขี้ยวคู่', icon: 'sk_as_twin', free: 1, cd: 3, sp: (lv) => 10 + lv, mul: (lv) => 2.1 + lv * 0.32,
      desc: (lv, m) => `พุ่งฟันมีดคู่ทะลุศัตรู 2 ครั้ง ครั้งละ ${m}% ของ ATK ครั้งละ 30% ติดคริติคอลแน่นอน` }),
    as_cloak: S({ name: 'อำพรางกาย', icon: 'sk_as_cloak', kind: 'buff', req: [['ro_hide', 3]], cd: 18, sp: (lv) => 16 + lv, rgb: '170,110,255', circle: 'occult',
      dur: (lv) => 5 + lv * 0.5, buff: () => ({}),
      desc: (lv) => `หายตัว ${r1(5 + lv * 0.5)} วิ เดินได้ปกติ มอนมองไม่เห็น · เขี้ยวมัจจุราชใช้ได้โดยไม่หลุดอำพราง · ตีแรกคริติคอลแน่นอน` }),
    as_knives: S({ name: 'มีดพิษกระจาย', icon: 'sk_as_knives', element: 'poison', req: [['envenom', 5]], cd: 6, sp: (lv) => 14 + lv, mul: (lv) => 1 + lv * 0.14,
      desc: (lv, m) => `ปามีดอาบพิษ 5 เล่มเป็นพัด เล่มละ ${m}% ของ ATK ติดพิษ` }),
    as_deathmark: S({ name: 'ตราประทับมรณะ', icon: 'sk_as_deathmark', ult: true, req: [['as_twin', 5]], cd: 42, sp: (lv) => 40 + lv * 3, mul: (lv) => 1.1 + lv * 0.15,
      desc: (lv, m) => `ประทับตรามรณะแล้ววาร์ปฟันรอบตัวเป้า 10 ครั้ง ครั้งละ ${m}% ของ ATK ปิดท้าย x3 และติดพิษ` }),
    as_katar: S({ name: 'ชำนาญมีดคู่', icon: 'sk_as_katar', pass: (lv, p) => (W(p).dual ? { crit: lv, atk: lv * 2 } : null),
      desc: (lv) => `ถือมีดคู่: คริติคอล +${lv}% ATK +${lv * 2}%` }),
    as_venom: S({ name: 'พิษร้าย', icon: 'sk_as_venom', pass: (lv) => ({ poison: lv * 10 }),
      desc: (lv) => `พิษที่เราใส่แรงขึ้น ${lv * 10}% · ตีปกติมีโอกาส ${lv * 3}% ติดพิษ` }),
    as_edp: S({ name: 'อาบพิษมรณะ', icon: 'sk_as_edp', kind: 'buff', req: [['as_venom', 5]], cd: 60, sp: () => 40, rgb: '190,120,255', circle: 'occult',
      dur: (lv) => 20 + lv * 2, enchant: 'poison', buff: (lv) => ({ atk: 10 + lv * 4 }),
      aura: (game, p, dt) => { if (Math.random() < dt * 8) V.motes(p.x + rand(-20, 20), p.y - rand(30, 90), 1, '190,120,255', { rise: 60, spread: 4 }); },
      desc: (lv) => `${20 + lv * 2} วิ: อาวุธอาบพิษมรณะ (ธาตุพิษ) ATK +${10 + lv * 4}% ทุกการตีติดพิษ` }),
    as_grimtooth: S({ name: 'เขี้ยวมัจจุราช', icon: 'sk_as_grimtooth', req: [['as_cloak', 3]], cd: 3, sp: (lv) => 8 + lv, mul: (lv) => 1.6 + lv * 0.2,
      desc: (lv, m) => `หนามเงาผุดเป็นแนวยาวข้างหน้า ${m}% ของ ATK · ใช้ตอนอำพรางได้โดยไม่หลุด` }),
    as_splasher: S({ name: 'ระเบิดพิษ', icon: 'sk_as_splasher', element: 'poison', req: [['as_knives', 3]], cd: 12, sp: (lv) => 20 + lv, mul: (lv) => 2.6 + lv * 0.35,
      desc: (lv, m) => `ฝังระเบิดพิษในศัตรู 2 วิแล้วระเบิดเป็นวง ${m}% ของ ATK ติดพิษรุนแรง` }),
    as_meteor: S({ name: 'อุกกาบาตเงา', icon: 'sk_as_meteor', req: [['as_twin', 3]], cd: 8, sp: (lv) => 22 + lv, mul: (lv) => 2.4 + lv * 0.36,
      desc: (lv, m) => `ระเบิดคมเงาสีเลือดรอบตัว ${m}% ของ ATK มึน 0.8 วิ` }),

    // ======== shinobi ========
    sh_kunai: S({ name: 'คุไนระเบิด', icon: 'sk_sh_kunai', free: 1, type: 'best', element: 'fire', cd: 2.5, sp: (lv) => 10 + lv, mul: (lv) => 2.2 + lv * 0.32,
      desc: (lv, m) => `ปาคุไนติดยันต์ไฟ ปักแล้วระเบิดใน 0.5 วิ ${m}% ของ ATK/MATK (ที่สูงกว่า) ธาตุไฟ` }),
    sh_clone: S({ name: 'แยกเงาร่าง', icon: 'sk_sh_clone', req: [['shadowstep', 3]], cd: 22, sp: (lv) => 24 + lv, mul: (lv) => 0.7 + lv * 0.1, dur: (lv) => 10 + lv,
      desc: (lv, m) => `แยกร่างเงา 2 ร่าง ${10 + lv} วิ ปาชูริเคนใส่ศัตรูใกล้ ๆ ร่างละ ${m}% ของ ATK` }),
    sh_windblade: S({ name: 'ใบมีดวายุ', icon: 'sk_sh_windblade', element: 'wind', req: [['sh_kunai', 3]], cd: 6, sp: (lv) => 16 + lv, mul: (lv) => 5 + lv * 0.8,
      desc: (lv, m) => `พุ่งเป็นสายลมคม ฟันทุกตัวที่ผ่าน ${m}% ของ ATK` }),
    sh_shuriken: S({ name: 'พายุชูริเคน', icon: 'sk_sh_shuriken', ult: true, req: [['sh_windblade', 5]], cd: 42, sp: (lv) => 42 + lv * 3, mul: (lv) => 0.5 + lv * 0.07,
      desc: (lv, m) => `วงชูริเคนหมุนรอบตัวขยายออกและหดเข้า 2.4 วิ ทุก 0.12 วิ ${m}% ของ ATK` }),
    sh_katon: S({ name: 'คาถาไฟ', icon: 'sk_sh_katon', type: 'best', element: 'fire', req: [['sh_ninjamastery', 3]], cd: 5, sp: (lv) => 14 + lv, mul: (lv) => 1.9 + lv * 0.28,
      desc: (lv, m) => `ผนึกมือ กลีบไฟ 5 กลีบไล่ตามศัตรู กลีบละ ${m}% ของ ATK/MATK ธาตุไฟ` }),
    sh_raiton: S({ name: 'คาถาสายฟ้า', icon: 'sk_sh_raiton', type: 'best', element: 'wind', req: [['sh_katon', 3]], cd: 7, sp: (lv) => 20 + lv, mul: (lv) => 5.6 + lv * 0.9,
      desc: (lv, m) => `มังกรสายฟ้าฟาดลงที่เมาส์ ${m}% ของ ATK/MATK มึน 0.8 วิ` }),
    sh_ninjamastery: S({ name: 'วิชานินจา', icon: 'sk_sh_ninjamastery', pass: (lv) => ({ skill: lv * 2, flee: lv, spPct: lv }),
      desc: (lv) => `สกิลแรงขึ้น ${lv * 2}% · หลบหลีก +${lv} · SP สูงสุด +${lv}%` }),
    sh_substitute: S({ name: 'คาถาสลับร่าง', icon: 'sk_sh_substitute', kind: 'buff', req: [['sh_ninjamastery', 3]], cd: 30, sp: () => 20, rgb: '220,190,150',
      dur: () => 30, buff: () => ({}), n: (lv) => 2 + Math.floor(lv / 4),
      desc: (lv) => `30 วิ: หลบการโจมตีได้หมด ${2 + Math.floor(lv / 4)} ครั้ง (ทิ้งท่อนไม้ไว้แทน)` }),
    sh_smoke: S({ name: 'ระเบิดควัน', icon: 'sk_sh_smoke', type: 'debuff', req: [['sh_substitute', 2]], cd: 15, sp: () => 18, mul: () => 0,
      desc: (lv) => `กลุ่มควันรอบตัว 5 วิ ศัตรูข้างในช้าลงและตีเบาลง ${20 + lv * 2}%` }),
    sh_huuma: S({ name: 'ขว้างดาวยักษ์วกกลับ', icon: 'sk_sh_huuma', req: [['sh_windblade', 3]], cd: 6, sp: (lv) => 16 + lv, mul: (lv) => 2.1 + lv * 0.28,
      desc: (lv, m) => `ขว้างชูริเคนยักษ์ไปแล้ววกกลับ โดนทั้งขาไปและขากลับ ครั้งละ ${m}% ของ ATK` }),
  });

  const bowPose = (game, p, i, lock) => K.pose(game, p, K.clip(p, 'arrow', i === undefined ? 1 : i), lock || 0.3);
  const bladePose = (game, p, i, lock) => K.pose(game, p, K.clip(p, 'swing', i || 0), lock || 0.3);

  // ================= ranger =================
  RUN.rg_triple = function (game, p, lv) {
    bowPose(game, p, 1, 0.3);
    V.at(0.1, () => { for (let i = 0; i < 3; i++) K.shot(game, p, 'rg_triple', { style: 'arrow', rgb: LEAF, ang: p.aim + (i - 1) * 0.14, v: 1400, range: 900, kb: 150, pierce: true, color: '190,255,180' }); });
  };
  const trapFx = (game, t, rgb) => { V.ring(t.x, t.y, 10, 170, 10, rgb, 0.4); V.glowAt(t.x, t.y - 20, 20, 170, rgb, 0.8, 0.35, { hot: true }); V.shake(game, 6); };
  RUN.rg_trap = function (game, p, lv) {
    NC.throwTrap(game, p, 'rg_trap', {
      kind: 'blast', rgb: '255,170,90', r: 70,
      boom(game, t, k) {
        trapFx(game, t, '255,170,90');
        K.flames(t.x, t.y, 12, 90, { k: 1 });
        V.debris(t.x, t.y - 10, 8, P.rock, { size: 0.7, max: 480 });
        V.smoke(t.x, t.y - 10, 8, '#5a4a52', '#7a6a70', { size: 1, lifeK: 0.8, a: 0.8 });
        V.decal(t.x, t.y, 130, 'scorch', 3);
        for (const e of K.around(game, t.x, t.y, 160)) { K.hit(game, p, 'rg_trap', e, 0, -160, '255,190,120', (p.d.trapK || 1) * (k || 1), { big: true }); K.stun(game, e, 1.2); }
      },
    });
  };
  RUN.rg_freezetrap = function (game, p, lv) {
    NC.throwTrap(game, p, 'rg_freezetrap', {
      kind: 'freeze', rgb: C.ice, r: 70,
      boom(game, t, k) {
        trapFx(game, t, C.ice);
        K.spikes(t.x, t.y, 10, 100, P.ice, C.ice, { k: 1 });
        V.decal(t.x, t.y, 140, 'frost', 3);
        for (const e of K.around(game, t.x, t.y, 140)) { K.hit(game, p, 'rg_freezetrap', e, 0, 0, '170,225,255', (p.d.trapK || 1) * (k || 1)); K.freeze(game, e, SK.rg_freezetrap.freeze(NC.skillLv(p, 'rg_freezetrap'))); }
      },
    });
  };
  RUN.rg_detonate = function (game, p) {
    K.pose(game, p, 'cheer', 0.25);
    const all = NC.Traps.list.slice();
    all.forEach((t, i) => V.at(i * 0.08, () => NC.Traps.fire(game, t, 1.5)));
    V.flash('255,190,120', 0.08, 0.2);
  };
  RUN.rg_piercer = function (game, p, lv) {
    bowPose(game, p, 2, 0.5);
    V.at(0.25, () => {
      V.ring(K.hand(p)[0], K.hand(p)[1], 10, 120, 10, LEAF, 0.3, { sq: 1 });
      // (the whirl at the first monster struck, else where the arrow ends: Discord #153, as js/maplebow.js)
      let opened = false;
      const whirl = (q) => {
        if (opened) return;
        opened = true;
        const x = q.x, y = q.y + 40;
        K.zone(game, p, 'rg_piercer', x, y, 150, 1.4, 0.45, { rgb: LEAF, style: 'arcane', pull: 140, mul: 0.8, color: '190,255,180',
          tick(z, dt) { if (Math.random() < dt * 30) { const a = rand(0, TAU); FX.add({ type: 'leaf', layer: 'glow', x: x + Math.cos(a) * 140, y: y - 20 + Math.sin(a) * 60, vx: -Math.sin(a) * 300, vy: Math.cos(a) * 120, drag: 1, life: 0.6, rot: rand(0, TAU), spin: 8, ph: 0, color: '#9fdc6a' }); } } });
      };
      K.shot(game, p, 'rg_piercer', {
        style: 'arrow', rgb: LEAF, size: 1.5, tail: 260, v: 1200, range: 820, pierce: true,
        trail(q) { if (Math.random() < 0.9) FX.add({ type: 'leaf', layer: 'glow', x: q.x, y: q.y, vx: rand(-120, 120), vy: rand(-120, 60), drag: 1.4, life: rand(0.4, 0.7), rot: rand(0, TAU), spin: rand(-9, 9), ph: rand(0, 6), color: NC.pick(['#9fdc6a', '#6cc35a', '#c9f08a']) }); },
        hit(e, q) { K.hit(game, p, 'rg_piercer', e, Math.cos(p.aim) * 380, Math.sin(p.aim) * 280, '190,255,180', 1, { big: true }); V.ring(e.x, e.y, 10, 100, 6, LEAF, 0.3); whirl(q); },
        end: whirl,
      });
    });
  };
  RUN.rg_storm = function (game, p, lv) {
    bowPose(game, p, 2, 0.9);
    const [tx, ty] = K.ground(game, p, 460), R = 300;
    V.flash('10,30,20', 0.3, 2.6, 'source-over');
    V.circle(tx, ty, R, LEAF, 2.6, { style: 'arcane', spin: 1.2, grow: true });
    V.light(tx, ty - 40, 600, LEAF, 0.8, 2.6);
    V.at(0.2, () => { const [hx, hy] = K.hand(p); for (let i = 0; i < 10; i++) FX.add({ type: 'vstreak', x: hx + rand(-10, 10), y: hy, vx: rand(-80, 80), vy: -1900, len: 100, w: 4, rgb: LEAF, life: 0.3 }); });
    K.rain(game, p, 'rg_storm', tx, ty, R, 40, 2.1, {
      delay: 0.45, rgb: LEAF, ir: 70, color: '190,255,180', fall: 0.18, from: [90, -780],
      look(ctx, q) { K.drawArrow(ctx, q, LEAF, 1, 220); },
      land(x, y) { FX.add({ type: 'varrowin', x, y: y - 16, sort: y, ang: -Math.PI / 2 - 0.15, life: 1.2 }); },
    });
    for (let i = 0; i < 6; i++) V.at(0.5 + i * 0.35, () => { const a = rand(0, TAU), d = rand(0, R); const x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d * V.SQ; V.boltAt(x + rand(-60, 60), y - 700, x, y - 20, '150,255,160', 0.25, { w: 6, jag: 40, seg: 12 }); V.shake(game, 5); });
  };
  RUN.rg_snipe = function (game, p, lv) {
    bowPose(game, p, 2, 1.0);
    const sure = p.buffs.rg_focus > 0;
    K.channel(game, p, 0.6, (ch) => {
      const [hx, hy] = K.hand(p);
      if (!ch.m) ch.m = V.circle(hx + Math.cos(p.aim) * 40, hy + 40, 90, LEAF, 0.8, { style: 'star', spin: 3, grow: true });
      if (Math.random() < 0.7) V.gather(hx, hy, 1, LEAF, 140, 0.3);
    }, () => {
      const [hx, hy] = K.hand(p), a = p.aim, c = Math.cos(a), s = Math.sin(a), len = 1300;
      FX.add({ type: 'vlaser', x: hx, y: hy, ang: a, len, w: 40, rgb: '200,255,180', life: 0.35 });
      V.ring(hx, hy, 10, 150, 10, LEAF, 0.35, { sq: 1 });
      V.flash('230,255,220', 0.2, 0.25);
      V.shake(game, 10); V.stop(game, 0.06);
      for (const e of K.lineHits(game, hx, hy + 20, a, len, 60)) { K.hit(game, p, 'rg_snipe', e, c * 520, s * 380, '210,255,190', 1, { big: true, crit: sure }); V.sparks(e.x, e.y - 50, 10, LEAF, { ang: a, spread: 0.6 }); }
    });
  };

  // ================= wolf hunter =================
  // the wolf: its size, health and bite grow with the skill level (and the alpha passive); Lv 5 bites bleed, Lv 8 bites
  // hit all round the target; frenzy makes it bigger and quicker for a while
  function wolfSize(p, lv) { const A = SK.wh_alpha.wolf(NC.skillLv(p, 'wh_alpha') || 0); return 0.8 + lv * 0.05 + A.size; }
  function bite(game, p, q, e, k) {
    const lv = q.lv;
    q.lunge = 0.28;
    const a = NC.angle(q.x, q.y, e.x, e.y);
    NC.tryMove(game.world, q, Math.cos(a) * 26, Math.sin(a) * 18);
    const res = K.hit(game, p, 'wh_wolf', e, Math.cos(a) * 120, Math.sin(a) * 90, '255,230,200', (p.d.petK || 1) * (k || 1));
    for (let i = 0; i < 3; i++) FX.add({ type: 'cutline', x: e.x - 30 + i * 18, y: e.y - 90, x1: e.x - 10 + i * 18, y1: e.y - 30, w: 7, color: '255,255,255', life: 0.2 });
    if (lv >= 5 && res && !res.miss) K.poison(game, p, e, 3, 0.15);
    if (lv >= 8) for (const f of K.around(game, e.x, e.y, 90)) if (f !== e) K.hit(game, p, 'wh_wolf', f, 0, 0, '255,230,200', (p.d.petK || 1) * 0.5 * (k || 1));
    if (lv >= 10) V.sparks(e.x, e.y - 50, 6, '255,220,120', { size: 0.8 });
  }
  RUN.wh_wolf = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    const A = SK.wh_alpha.wolf(NC.skillLv(p, 'wh_alpha') || 0);
    const q = NC.Pets.summon(game, p, 'wolf', {
      skill: 'wh_wolf', lv, scale: wolfSize(p, lv), hp: 0.35 + lv * 0.05 + A.hp, every: Math.max(0.55, 0.9 - lv * 0.02),
      name: `หมาป่า Lv ${lv}`, glow: lv >= 10 ? '255,220,120' : null,
      act(game, q, e) { bite(game, p, q, e); },
    });
    V.at(0.1, () => { V.ring(q.x, q.y, 20, 180, 10, WOLF, 0.5); FX.text(q.x, q.y - 120 * q.scale, 'AWOO!', '#cfe6ff', 36); });
  };
  RUN.wh_fang = function (game, p, lv) {
    bowPose(game, p, 2, 0.4);
    V.at(0.2, () => K.shot(game, p, 'wh_fang', {
      style: 'arrow', rgb: '255,210,150', size: 1.4, tail: 220, v: 1350, range: 950,
      hit(e, q) {
        K.hit(game, p, 'wh_fang', e, Math.cos(p.aim) * 300, Math.sin(p.aim) * 220, '255,220,170', 1, { big: true });
        for (let i = 0; i < 3; i++) FX.add({ type: 'cutline', x: e.x - 40 + i * 22, y: e.y - 100, x1: e.x - 14 + i * 22, y1: e.y - 20, w: 9, color: '255,210,150', life: 0.25 });
        const w = wolfOf();
        if (w) { w.target = e; w.atkT = 0; }
      },
    }));
  };
  RUN.wh_howl = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.6);
    K.startBuff(game, p, 'wh_howl', lv);
    FX.text(p.x, p.y - 230, 'AWOOOO!', '#cfe6ff', 48);
    for (let i = 0; i < 4; i++) V.at(i * 0.12, () => V.ring(p.x, p.y - 60, 40, 300, 10 - i * 2, WOLF, 0.5, { sq: 0.9 }));
    K.buffFx(game, p, WOLF, { style: 'star' });
    for (const e of K.around(game, p.x, p.y, 260)) { K.stun(game, e, 1); FX.num(e.x, e.y - 150, '!', { fill: '#cfe6ff', size: 40 }); }
    const w = wolfOf();
    if (w) { K.buffFx(game, w, WOLF, { flash: false, r: 120 }); w.fast = 0.8; V.at(SK.wh_howl.dur(lv), () => { if (w.fast === 0.8) w.fast = 1; }); }
  };
  RUN.wh_command = function (game, p, lv) {
    const w = wolfOf(), e = K.target(game, p, 560, 240);
    K.pose(game, p, 'cheer', 0.25);
    if (!w || !e) return;
    FX.text(w.x, w.y - 100, 'ขย้ำ!', '#ffe0b0', 30);
    V.ghost({ x: w.x, y: w.y }, '#cfe6ff', 0.3);
    const a = NC.angle(e.x, e.y, w.x, w.y);
    w.x = e.x + Math.cos(a) * 60; w.y = e.y + Math.sin(a) * 36;
    V.smoke(w.x, w.y - 20, 5, '#e8e4f4', '#ffffff', { size: 0.7, lifeK: 0.5 });
    w.target = e;
    for (let i = 0; i < 3; i++) V.at(0.05 + i * 0.16, () => {
      if (!K.alive(e)) return;
      w.lunge = 0.2; w.face = e.x > w.x ? 1 : -1;
      K.hit(game, p, 'wh_command', e, 0, 0, '255,230,200', p.d.petK || 1);
      for (let k = 0; k < 3; k++) FX.add({ type: 'cutline', x: e.x - 30 + k * 18, y: e.y - 90, x1: e.x - 10 + k * 18, y1: e.y - 30, w: 8, color: '255,255,255', life: 0.2 });
      if (i === 2) K.stun(game, e, 0.5);
      V.shake(game, 3);
    });
  };
  RUN.wh_mark = function (game, p, lv) {
    bowPose(game, p, 0, 0.25);
    const e = K.target(game, p, 620);
    if (!e) { FX.num(p.x, p.y - 170, 'ไม่มีเป้า', { fill: '#cfd8ff', size: 28 }); return; }
    K.vuln(game, e, 1.1 + lv * 0.02, 15, '255,90,90');
    V.mark(e.x, e.y, 90, '255,90,90', 0.8);
    for (let k = 0; k < 3; k++) FX.add({ type: 'cutline', x: e.x - 40 + k * 22, y: e.y - 110, x1: e.x - 14 + k * 22, y1: e.y - 30, w: 9, color: '255,110,110', life: 0.4 });
    const w = !p.remote && wolfOf(); // (another player's mark, js/net.js: my wolf stays mine)
    if (w) { w.target = e; w.atkT = 0; }
  };
  // a marked (vulnerable) monster shows a red reticle over it
  FX.def('vvuln', (ctx, q) => {
    const e = q.e;
    if (!e || !K.alive(e) || !(e.vuln && e.vuln.until > NC.game.time)) { q.dead = true; return; }
    ctx.save(); ctx.globalAlpha *= 0.7 + 0.3 * Math.sin(q.t * 6); ctx.translate(e.x, e.y - 175);
    ctx.strokeStyle = `rgb(${e.vuln.rgb || '255,90,90'})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.stroke();
    for (let i = 0; i < 4; i++) { const b = (i / 4) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(b) * 7, Math.sin(b) * 7); ctx.lineTo(Math.cos(b) * 18, Math.sin(b) * 18); ctx.stroke(); }
    ctx.restore();
  }, 'high');
  NC.skillTicks.push((game) => {
    for (const e of game.enemies) if (e.vuln && e.vuln.until > game.time && !e.vulnFx) { e.vulnFx = true; FX.add({ type: 'vvuln', e, x: e.x, y: e.y, life: 60, onEnd() { e.vulnFx = false; } }); }
  });
  RUN.wh_frenzy = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    K.startBuff(game, p, 'wh_frenzy', lv);
    K.buffFx(game, p, '255,120,90', { style: 'occult' });
    const w = wolfOf();
    if (w) {
      const base = w.scale;
      w.scale = base * 1.2; w.fast = 0.55; w.tint = ['#ff5a3a', 0.25];
      K.buffFx(game, w, '255,120,90', { flash: false, r: 130 });
      V.at(15, () => { if (NC.Pets.list.includes(w)) { w.scale = base; w.fast = 1; w.tint = null; } });
    }
  };
  // the spirit pack: five glowing wolves (the wolf's own drawing, tinted) running straight ahead
  FX.def('vspiritwolf', (ctx, q, u) => {
    const a = V.fade(u, 0.1, 0.2), s = NC.SPR['pet_wolf_b'] ? 'pet_wolf_b' : 'pet_wolf';
    V.glow(ctx, q.x, q.y - 40, 90, WOLF, 0.6 * a, true);
    NC.drawSpr(ctx, Math.floor(q.t * 10) % 2 ? s : 'pet_wolf', q.x, q.y, { flip: q.vx > 0, scale: 1.1, alpha: 0.85 * a, tint: ['#9fd0ff', 0.75] });
  }, 'glow');
  RUN.wh_pack = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.8);
    FX.text(p.x, p.y - 240, 'AWOOOOO!', '#cfe6ff', 54);
    V.flash('10,20,40', 0.3, 1.6, 'source-over');
    const a = p.aim, c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
    for (let i = 0; i < 5; i++) V.at(0.2 + i * 0.08, () => {
      const off = (i - 2) * 70, hit = new Set();
      let x = p.x - c * 80 + nx * off, y = p.y - s * 60 + ny * off * 0.6;
      FX.add({
        type: 'vspiritwolf', x, y, vx: c * 1100, vy: s * 760, life: 0.9,
        update(q, dt) {
          q.x += q.vx * dt; q.y += q.vy * dt;
          if (Math.random() < 0.8) V.motes(q.x, q.y - 30, 1, WOLF, { rise: 30, spread: 10, lifeK: 0.5 });
          for (const e of game.enemies) if (!hit.has(e) && K.alive(e) && NC.dist(q.x, q.y, e.x, e.y) < 70 + e.r) {
            hit.add(e);
            K.hit(game, p, 'wh_pack', e, c * 420, s * 300, '200,230,255', 1, { big: true });
            V.sparks(e.x, e.y - 40, 8, WOLF);
          }
        },
      });
    });
    V.at(0.3, () => V.shake(game, 10));
  };

  // ================= assassin =================
  RUN.as_twin = function (game, p, lv) {
    bladePose(game, p, 1, 0.35);
    const a = p.aim;
    K.dash(game, p, 'as_twin', a, 190, 0.16, {
      rgb: RED, pal: P.blood,
      hit(e) {
        for (let i = 0; i < 2; i++) V.at(i * 0.06, () => {
          if (!K.alive(e)) return;
          V.slash(e.x, e.y - 60, 70, a + (i ? 0.7 : -0.7), 2, 22, P.blood, 0.24, { rgb: RED, dir: i ? -1 : 1 });
          K.hit(game, p, 'as_twin', e, Math.cos(a) * 80, Math.sin(a) * 60, '255,120,160', 1, { crit: Math.random() < 0.3 });
        });
      },
    });
  };
  RUN.as_cloak = function (game, p, lv) {
    K.startBuff(game, p, 'as_cloak', lv);
    p.hideAt = game.time;
    p.buffs.shadow = SK.as_cloak.dur(lv) + 2;
    V.smoke(p.x, p.y - 20, 12, '#2a1a3a', '#4a3a5a', { size: 1.1, lifeK: 0.7, max: 200, a: 0.9 });
    V.motes(p.x, p.y - 60, 14, '170,110,255', { spread: 50, rise: 120 });
  };
  RUN.as_knives = function (game, p, lv) {
    bladePose(game, p, 0, 0.3);
    V.at(0.08, () => { for (let i = 0; i < 5; i++) K.shot(game, p, 'as_knives', { style: 'blade', rgb: VENOM, fill: '#cfe8d8', ang: p.aim + (i - 2) * 0.16, v: 1200, range: 700, size: 1,
      hit(e, q) { const r = K.hit(game, p, 'as_knives', e, 0, 0, '150,240,110'); if (r && !r.miss) K.poison(game, p, e, 4, 0.25); V.sparks(q.x, q.y, 5, VENOM, { size: 0.7 }); } }); });
  };
  RUN.as_deathmark = function (game, p, lv) {
    const e = K.target(game, p, 460);
    if (!e) { FX.num(p.x, p.y - 170, 'ไม่มีเป้า', { fill: '#cfd8ff', size: 28 }); return; }
    V.flash('30,0,10', 0.4, 1.4, 'source-over');
    V.mark(e.x, e.y, 120, RED, 0.4);
    p.inv = Math.max(p.inv, 1.4);
    let step = 0;
    K.channel(game, p, 1.25, (ch) => {
      p.vx = p.vy = 0;
      while (step < 10 && ch.t >= 0.3 + step * 0.08) {
        const b = (step / 10) * TAU * 1.5 + rand(-0.3, 0.3), cx = K.alive(e) ? e.x : p.x, cy = K.alive(e) ? e.y : p.y;
        V.ghost(p, '#d05a8a', 0.25);
        const x = cx + Math.cos(b) * 90, y = cy + Math.sin(b) * 55;
        if (!game.world.fits || game.world.fits(x, y, p.r)) { p.x = x; p.y = y; }
        p.face = cx > p.x ? 1 : -1;
        NC.Anim.play(p.anim, step % 2 ? 'iaiS1' : 'iaiS2');
        const cut = rand(0, Math.PI);
        FX.add({ type: 'cutline', x: cx - Math.cos(cut) * 140, y: cy - 60 - Math.sin(cut) * 90, x1: cx + Math.cos(cut) * 140, y1: cy - 60 + Math.sin(cut) * 90, w: 16, color: RED, life: 0.25 });
        if (K.alive(e)) K.hit(game, p, 'as_deathmark', e, 0, 0, '255,120,160');
        V.stop(game, 0.02);
        step++;
      }
    }, () => {
      if (!K.alive(e)) return;
      V.slash(e.x, e.y - 70, 170, -0.8, 2.5, 46, P.blood, 0.4, { rgb: RED, dir: 1 });
      V.slash(e.x, e.y - 70, 170, Math.PI + 0.8, 2.5, 46, P.shadow, 0.4, { rgb: C.shadow, dir: -1 });
      K.hit(game, p, 'as_deathmark', e, 0, 0, '255,120,160', 3, { big: true });
      K.poison(game, p, e, 6, 0.4);
      K.burst(game, e.x, e.y, 150, RED, { shake: 14, flash: '255,200,220' });
      V.stop(game, 0.1);
    });
  };
  // the venom passive and the deadly-poison buff poison on the hero's own hits
  NC.basicHits.push((game, p, e, r) => {
    if (!r || r.miss || !game) return;
    const lv = NC.skillLv(p, 'as_venom');
    if (p.buffs.as_edp > 0 || (lv && Math.random() * 100 < lv * 3)) K.poison(game, p, e, 3, p.buffs.as_edp > 0 ? 0.35 : 0.2);
  });
  RUN.as_grimtooth = function (game, p, lv) {
    bladePose(game, p, 2, 0.3);
    const a = p.aim, c = Math.cos(a), s = Math.sin(a), hit = new Set();
    for (let k = 0; k < 8; k++) V.at(0.04 + k * 0.035, () => {
      const d = 50 + k * 40, x = p.x + c * d, y = p.y + s * d * 0.7;
      V.spikeAt(x + rand(-10, 10), y + rand(-6, 6), rand(22, 30), rand(60, 90), P.shadow, 0.6, { glowA: 0.35, rgb: C.shadow, rise: 0.06, sink: true });
      for (const e of K.around(game, x, y, 60)) if (!hit.has(e)) { hit.add(e); K.hit(game, p, 'as_grimtooth', e, 0, -80, '200,160,255'); }
    });
  };
  NC.skillCasts.unshift((game, p, id) => { if (id === 'as_grimtooth' && p.buffs.as_cloak > 0) p.keepCloak = p.buffs.as_cloak; });
  NC.skillCasts.push((game, p, id) => { if (p.keepCloak) { p.buffs.as_cloak = p.keepCloak; p.keepCloak = 0; } });
  RUN.as_splasher = function (game, p, lv) {
    bladePose(game, p, 0, 0.3);
    const e = K.target(game, p, 420);
    if (!e) { FX.num(p.x, p.y - 170, 'ไม่มีเป้า', { fill: '#cfd8ff', size: 28 }); return; }
    FX.add({ type: 'vproj', layer: 'glow', x: e.x, y: e.y, life: 2,
      update(q) { if (K.alive(e)) { q.x = e.x; q.y = e.y; } if (Math.random() < 0.3) FX.add({ type: 'vdrop', x: q.x + rand(-20, 20), y: q.y - 80, vx: rand(-40, 40), vy: -60, grav: 900, s: 6, life: 0.6 }); },
      draw(ctx, q) { V.glow(ctx, q.x, q.y - 60, 50 + 20 * Math.sin(q.t * 12), VENOM, 0.6, true); V.skull(ctx, q.x, q.y - 150, 30, '#b8f07a', 0.8); } });
    V.at(2, () => {
      const x = e.x, y = e.y;
      V.bubbles(x, y, 10, '#8ee05a', { spread: 120, size: 1.1 });
      V.decal(x, y, 160, 'goo', 4, { col: 'rgba(70,150,50,0.4)' });
      K.nova(game, p, 'as_splasher', x, y, 160, { rgb: VENOM, color: '150,240,110', big: true, shake: 8, smoke: ['#7acb52', '#c8f58a'], each(f, r) { if (r && !r.miss) K.poison(game, p, f, 6, 0.4); } });
    });
  };
  RUN.as_meteor = function (game, p, lv) {
    bladePose(game, p, 2, 0.4);
    V.at(0.1, () => {
      for (let i = 0; i < 8; i++) V.slash(p.x, p.y - 60, 140, (i / 8) * TAU, 1.3, 26, P.blood, 0.32, { rgb: RED });
      V.smoke(p.x, p.y - 10, 10, '#3a1a2a', '#5a2a3a', { size: 1.1, lifeK: 0.7, max: 220, a: 0.85 });
      K.nova(game, p, 'as_meteor', p.x, p.y, 220, { rgb: RED, color: '255,120,160', status: ['stun', 0.8], kb: 300, shake: 9, big: true });
    });
  };

  // ================= shinobi =================
  RUN.sh_kunai = function (game, p, lv) {
    bladePose(game, p, 0, 0.28);
    V.at(0.06, () => K.shot(game, p, 'sh_kunai', {
      style: 'blade', rgb: FIRE_T, fill: '#dfe6ef', v: 1300, range: 760, size: 1.1,
      trail(q) { if (Math.random() < 0.6) V.flameAt(q.x - q.vx * 0.02, q.y + 12, 12, 20, P.fire, 0.2, { vy: -30 }); },
      hit(e, q) {
        const stick = { x: e.x, y: e.y };
        FX.add({ type: 'vproj', layer: 'glow', x: e.x, y: e.y - 50, life: 0.5, update(q2) { if (K.alive(e)) { stick.x = e.x; stick.y = e.y; } q2.x = stick.x; q2.y = stick.y - 50; }, draw(ctx, q2) { K.drawBlade(ctx, q2.x, q2.y, -0.6, 30, 6, '#dfe6ef', '255,140,50'); V.flame(ctx, q2.x - 6, q2.y + 10, 14, 26, q2.t * 20, P.fire, 1); } });
        V.at(0.5, () => {
          K.flames(stick.x, stick.y, 10, 60, {});
          K.nova(game, p, 'sh_kunai', stick.x, stick.y, 110, { rgb: FIRE_T, color: '255,170,90', kb: 200, shake: 6, decal: 'scorch', smoke: ['#5a4a52', '#7a6a70'] });
        });
      },
    }));
  };
  // shadow clones: the hero's own pose, dark and see-through, a step to each side; they throw shuriken
  FX.def('vclone', (ctx, q) => {
    const p = q.p;
    if (!p.pose) return;
    const a = Math.min(1, q.t * 4, (q.life - q.t) * 3);
    NC.drawHero(ctx, p.equip, p.pose, p.x + q.ox, p.y + q.oy, { alpha: 0.55 * a, tint: ['#23284a', 0.7] });
  }, 'sorted');
  RUN.sh_clone = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.3);
    const dur = SK.sh_clone.dur(lv);
    for (const [ox, oy] of [[-90, 30], [90, 30]]) {
      V.smoke(p.x + ox, p.y + oy - 20, 8, '#3a3f5a', '#5a6080', { size: 1, lifeK: 0.7, a: 0.9 });
      let t = rand(0.2, 0.5);
      FX.add({
        type: 'vclone', p, ox, oy, x: p.x + ox, y: p.y + oy, life: dur,
        update(q, dt) {
          q.x = p.x + ox; q.y = p.y + oy; q.sort = q.y;
          if ((t -= dt) > 0) return;
          t = 0.7;
          const e = K.nearest(game, q.x, q.y, 480, 1)[0];
          if (e) K.shot(game, p, 'sh_clone', { from: [q.x, q.y - 80], ang: NC.angle(q.x, q.y - 80, e.x, e.y - 45), v: 1100, range: 600, style: 'star', rgb: NINJA, size: 0.8, spin: 22, color: '200,210,255' });
        },
        onEnd(q) { V.smoke(q.x, q.y - 20, 8, '#3a3f5a', '#5a6080', { size: 1, lifeK: 0.7, a: 0.9 }); },
      });
    }
  };
  RUN.sh_windblade = function (game, p, lv) {
    bladePose(game, p, 2, 0.35);
    K.dash(game, p, 'sh_windblade', p.aim, 360, 0.18, { rgb: C.wind, pal: P.wind,
      end(p) { V.ring(p.x, p.y, 20, 170, 10, C.wind, 0.4); V.stars(p.x, p.y - 55, 8, '#c9f08a', C.wind, { speed: 300, size: 0.8 }); } });
  };
  RUN.sh_shuriken = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.5);
    V.flash('10,14,30', 0.3, 2.6, 'source-over');
    const n = 10;
    let acc = 0;
    FX.add({
      type: 'vproj', layer: 'glow', x: p.x, y: p.y, life: 2.4,
      update(q, dt) {
        q.R = 60 + 170 * Math.sin((q.t / 2.4) * Math.PI);
        if ((acc += dt) >= 0.12) {
          acc -= 0.12;
          for (const e of K.around(game, p.x, p.y, q.R + 30)) if (NC.dist(e.x, e.y, p.x, p.y) > q.R - 60) K.hit(game, p, 'sh_shuriken', e, 0, 0, '200,210,255');
        }
      },
      draw(ctx, q) {
        for (let i = 0; i < n; i++) { const a = q.t * 7 + (i / n) * TAU, x = p.x + Math.cos(a) * (q.R || 60), y = p.y - 50 + Math.sin(a) * (q.R || 60) * 0.55; V.glow(ctx, x, y, 34, NINJA, 0.5, true); K.drawStar(ctx, x, y, 18, q.t * 30 + i, 4, '#cfd6e2'); }
      },
    });
    V.light(p.x, p.y - 50, 500, NINJA, 0.8, 2.4, { follow: p });
  };
  RUN.sh_katon = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.3);
    const foes = K.nearest(game, p.x, p.y, 640, 5);
    for (let i = 0; i < 5; i++) V.at(0.08 + i * 0.07, () => {
      const t = foes.length ? foes[i % foes.length] : null;
      K.shot(game, p, 'sh_katon', { from: [p.x + p.face * 20, p.y - 90], ang: p.aim + (i - 2) * 0.45, v: 700, range: 900, rgb: FIRE_T, size: 0.9, home: 7, target: t,
        look(ctx, q) { V.glow(ctx, q.x, q.y, 40, FIRE_T, 0.7, true); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.t * 12); for (let k = 0; k < 5; k++) { ctx.rotate(TAU / 5); ctx.beginPath(); ctx.ellipse(8, 0, 9, 4.5, 0, 0, TAU); ctx.fillStyle = k % 2 ? '#ff8a3a' : '#ffd06a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); } ctx.restore(); },
        trail(q) { if (Math.random() < 0.5) V.flameAt(q.x, q.y + 10, 12, 18, P.fire, 0.2, { vy: -30 }); },
        hit(e, q) { K.hit(game, p, 'sh_katon', e, 0, 0, '255,170,90'); V.flare(q.x, q.y, 50, FIRE_T, 0.2); } });
    });
  };
  RUN.sh_raiton = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.35);
    const e0 = K.target(game, p, 560), [tx, ty] = e0 ? [e0.x, e0.y] : K.ground(game, p, 420);
    V.circle(tx, ty, 150, C.lightning, 0.5, { style: 'arcane', spin: 3 });
    V.at(0.2, () => {
      for (let i = 0; i < 3; i++) V.boltAt(tx + rand(-100, 100), ty - 800, tx + rand(-20, 20), ty - 30, C.lightning, 0.35, { w: 10 - i * 3, jag: 50, seg: 14 });
      V.flash('200,235,255', 0.2, 0.2);
      K.nova(game, p, 'sh_raiton', tx, ty, 150, { rgb: C.lightning, color: '170,230,255', status: ['stun', 0.8], shake: 9, decal: 'crack', big: true });
    });
  };
  RUN.sh_substitute = function (game, p, lv) {
    K.startBuff(game, p, 'sh_substitute', lv);
    p.subsLeft = SK.sh_substitute.n(lv);
    K.buffFx(game, p, '220,190,150', { flash: false });
  };
  // the substitute's looks, apart so that the online client draws the server's with them (js/online-shinobi.js)
  const SUBST = {
    // a log where he stood (x, y: his feet)
    log(x, y) {
      V.smoke(x, y - 30, 10, '#e8e4f4', '#ffffff', { size: 1, lifeK: 0.6 });
      FX.add({ type: 'vproj', layer: 'glow', x, y: y - 30, life: 0.8, draw(ctx, q) {
        const a = 1 - q.t / 0.8;
        ctx.save(); ctx.globalAlpha *= a; ctx.translate(q.x, q.y); ctx.rotate(0.3);
        ctx.beginPath(); ctx.roundRect(-36, -14, 72, 28, 12); ctx.lineWidth = 4; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); ctx.fillStyle = '#a8764a'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(36, 0, 8, 14, 0, 0, TAU); ctx.fillStyle = '#e8c89a'; ctx.fill(); ctx.stroke();
        ctx.restore();
      } });
    },
    // the word over him where he stepped to
    swapped(x, y) { FX.num(x, y - 160, 'สลับร่าง!', { fill: '#ffe0b0', size: 30 }); },
  };
  NC.ShinobiLooks = { substitute: SUBST };
  NC.heroGuards.unshift((game, p, dmg) => {
    if (!(p.buffs.sh_substitute > 0) || !(p.subsLeft > 0)) return dmg;
    p.subsLeft--;
    if (p.subsLeft <= 0) p.buffs.sh_substitute = 0;
    // a log where he stood, and he is a step away
    SUBST.log(p.x, p.y);
    NC.tryMove(game.world, p, rand(-90, 90), rand(-50, 50));
    SUBST.swapped(p.x, p.y);
    return 0;
  });
  RUN.sh_smoke = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.25);
    const x = p.x, y = p.y;
    V.smoke(x, y - 20, 18, '#8a8a96', '#c8c8d4', { size: 1.6, max: 300, lifeK: 1.2, a: 0.9 });
    K.zone(game, p, 'sh_smoke', x, y, 200, 5, 0.4, {
      rgb: '200,200,215', circle: false, glowA: 0.15, hits: false,
      each(e) { K.weak(game, e, 1 - (0.2 + lv * 0.02), 1); K.slow(e, 1); },
      tick(z, dt) { if (Math.random() < dt * 12) V.smoke(x + rand(-170, 170), y + rand(-80, 80), 1, '#8a8a96', '#c8c8d4', { size: rand(1, 1.6), lifeK: 1.4, rise: 10, max: 40, a: 0.55 }); },
    });
  };
  RUN.sh_huuma = function (game, p, lv) {
    bladePose(game, p, 1, 0.35);
    const a = p.aim, c = Math.cos(a), s = Math.sin(a), from = K.hand(p), out = new Set(), back = new Set(), L = 420;
    FX.add({
      type: 'vproj', layer: 'glow', x: from[0], y: from[1], life: 1.3, rot: 0,
      update(q, dt) {
        q.rot += dt * 26;
        const k = q.t / 1.3, d = Math.sin(k * Math.PI) * L, ret = k > 0.5;
        q.x = (ret ? p.x : from[0]) + c * d; q.y = (ret ? p.y - 70 : from[1]) + s * d * 0.7;
        const set = ret ? back : out;
        for (const e of game.enemies) if (!set.has(e) && K.alive(e) && NC.dist(q.x, q.y, e.x, e.y - 45) < 60 + e.r) { set.add(e); K.hit(game, p, 'sh_huuma', e, c * 120, s * 90, '200,210,255'); V.sparks(q.x, q.y, 6, NINJA); }
        if (Math.random() < 0.6) FX.add({ type: 'vstreak', x: q.x, y: q.y, vx: 0, vy: 0, len: 40, w: 4, rgb: NINJA, life: 0.2 });
      },
      draw(ctx, q) { V.glow(ctx, q.x, q.y, 60, NINJA, 0.5, true); K.drawStar(ctx, q.x, q.y, 34, q.rot, 4, '#cfd6e2'); },
    });
  };
})();
