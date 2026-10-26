/* skillplan.js — the skill system the user approved on 2026-09-27 (the Artifact "สายสกิล Night Camp", v2.1): every job's
   skills sit in 3–5 lines (สาย), one of them its auto-attack line (auto: fast hits, double hits, criticals, things set
   off by a basic hit); a 2nd job's lines continue its 1st job's (parent); skills have the plan's top levels, free
   first levels, needs (req, reqAny: one of them, reqFn: a rule) and a line to grow in; what each skill turns into at
   Lv 5 / Lv 10 (or a keystone's Lv 1 / 3 / 5) is its `grow` text in the skill window.
   This file arranges the data (on top of skills.js, priest.js, skills_t1.js, class2_skills_*.js, skills_v21.js) and
   defines the v2 passives: the element hearts (ใจเพลิง ใจน้ำแข็ง ใจสายฟ้า ใจพิษ), the 2nd jobs' keystones and the
   archmage's new spells, as stat changes the game reads elsewhere (skilltree.js: element damage, safety valves;
   statuses.js: burn / chill / shock). LINES / PLAN are made from the plan's jobs.js. Loaded before skillui.js. */
(function () {
  'use strict';
  const NC = window.NC, SK = NC.SKILLS, K = NC.SkillKit, S = K.S;
  const r1 = (v) => Math.round(v * 10) / 10;

  // ---------------- the new skills ----------------
  const heartsOf = (p) => ['mg_fireheart', 'mg_iceheart', 'mg_stormheart'].filter((h) => NC.skillLv(p, h) >= 5).length;
  K.def({
    // the mage's element hearts
    mg_fireheart: S({ name: 'ใจเพลิง', icon: 'sk_mg_fireheart', pass: (lv) => ({ el_fire: lv * 2, st_burn: lv * 3, burn2: lv >= 5 ? 1 : 0, fireBig: lv >= 10 ? 25 : 0 }),
      desc: (lv) => `ดาเมจไฟ +${lv * 2}% · โอกาสติดเผา +${lv * 3}%${lv >= 5 ? ' · เผาซ้อนทีละ 2 ชั้น' : ''}${lv >= 10 ? ' · ระเบิดไฟใหญ่ขึ้น 25%' : ''}` }),
    mg_iceheart: S({ name: 'ใจน้ำแข็ง', icon: 'sk_mg_iceheart', pass: (lv) => ({ el_water: lv * 3, freezeT: r1(lv * 0.08), iceStack: lv >= 5 ? 1 : 0, frozenDmg: lv >= 10 ? 20 : 0 }),
      desc: (lv) => `ดาเมจน้ำ +${lv * 3}% · แช่แข็งนานขึ้น ${r1(lv * 0.08)} วิ${lv >= 5 ? ' · เย็นเฉียบครบ 3 ชั้นแล้วแข็ง' : ''}${lv >= 10 ? ' · ตัวที่แข็งรับดาเมจ +20%' : ''}` }),
    mg_stormheart: S({ name: 'ใจสายฟ้า', icon: 'sk_mg_stormheart', pass: (lv) => ({ el_wind: lv * 3, st_shock: lv * 2, shockAmp: lv >= 5 ? 15 : 0, shockBolt: lv >= 10 ? 1 : 0 }),
      desc: (lv) => `ดาเมจลม/สายฟ้า +${lv * 3}% · โอกาสช็อต +${lv * 2}%${lv >= 5 ? ' · ตัวที่ช็อตรับสายฟ้า +15%' : ''}${lv >= 10 ? ' · ช็อตแล้วมีฟ้าผ่าเล็กฟรี' : ''}` }),
    // the rogue's
    ro_venomheart: S({ name: 'ใจพิษ', icon: 'sk_ro_venomheart', pass: (lv) => ({ el_poison: lv * 2, poison: lv * 5, venomHit: lv * 2, venomWeak: lv >= 10 ? 15 : 0 }),
      desc: (lv) => `พิษแรงขึ้น ${lv * 5}% · ดาเมจพิษ +${lv * 2}% · ตีปกติโอกาสติดพิษ ${lv * 2}%${lv >= 10 ? ' · ศัตรูที่ติดพิษตีเราเบาลง 15%' : ''}` }),
    // keystones (2nd jobs, Lv 1 / 3 / 5)
    pal_bulwark: S({ name: 'ป้อมปราการ', icon: 'sk_pal_bulwark', max: 5, pass: () => ({}),
      desc: (lv) => `HP ยิ่งน้อยยิ่งรับดาเมจลดลง (สูงสุด 20%)${lv >= 3 ? ' · ศัตรูรอบตัวยิ่งเยอะยิ่งทน (ตัวละ 3% สูงสุด 15%)' : ''}${lv >= 5 ? ' · ตอนเปิดโล่อีจิส โล่พิฆาตแรงสองเท่า' : ''}` }),
    am_infernomastery: S({ name: 'ปรมาจารย์เพลิง', icon: 'sk_am_infernomastery', max: 5, pass: (lv) => ({ infernoGround: 1, el_fire: lv >= 3 ? 10 : 0, valve_fire: lv >= 3 ? 1 : 0, blueFire: lv >= 3 ? 1 : 0, fireTwice: lv >= 5 ? 1 : 0 }),
      desc: (lv) => `สกิลไฟทิ้งพื้นลุกไหม้${lv >= 3 ? ' · ไฟสีฟ้า ดาเมจไฟ +10% ตีมอนธาตุไฟได้อย่างน้อย 75%' : ''}${lv >= 5 ? ' · ระเบิดไฟระเบิดซ้ำอีกครั้ง' : ''}` }),
    am_absolutezero: S({ name: 'ศูนย์สัมบูรณ์', icon: 'sk_am_absolutezero', max: 5, pass: (lv) => ({ frozenDmg: 15, shatter: lv >= 3 ? 1 : 0, valve_water: lv >= 3 ? 1 : 0, sureFreeze: lv >= 5 ? 1 : 0 }),
      desc: (lv) => `ตัวที่แข็งรับดาเมจ +15%${lv >= 3 ? ' · น้ำแข็งแตกกระจายโดนรอบข้าง · ตีมอนธาตุน้ำได้อย่างน้อย 75%' : ''}${lv >= 5 ? ' · สกิลน้ำแข็งทุกอันแช่แข็งแน่นอน' : ''}` }),
    am_overcharge: S({ name: 'ประจุล้น', icon: 'sk_am_overcharge', max: 5, pass: (lv) => ({ shockSpread: 1, valve_wind: 1, freeBolt: lv >= 3 ? 1 : 0, stormBody: lv >= 5 ? 1 : 0 }),
      desc: (lv) => `ช็อตแพร่ไปตัวข้าง ๆ · ตีมอนธาตุลม/ดินได้อย่างน้อย 75%${lv >= 3 ? ' · สกิลสายฟ้าครั้งที่ 4 ได้ฟ้าผ่าใหญ่ฟรี' : ''}${lv >= 5 ? ' · ร่างประจุไฟฟ้า ศัตรูที่เราเดินผ่านโดนช็อต' : ''}` }),
    am_convergence: S({ name: 'หลอมรวมธาตุ', icon: 'sk_am_convergence', max: 5, pass: (lv) => ({ converge: 1, react: lv >= 3 ? 50 : 0, reactSp: lv >= 5 ? 1 : 0 }),
      reqFn: (p) => heartsOf(p) >= 2, reqText: 'ใจธาตุ 2 ธาตุ Lv 5',
      desc: (lv) => `ร่ายธาตุต่างจากครั้งก่อน MATK +8% ซ้อนได้ 3 ชั้น${lv >= 3 ? ' · ปฏิกิริยาธาตุแรงขึ้น 50%' : ''}${lv >= 5 ? ' · เกิดปฏิกิริยาแล้วได้ SP คืน' : ''}` }),
    wl_lanternmastery: S({ name: 'ปรมาจารย์ตะเกียง', icon: 'sk_wl_lanternmastery', max: 5, pass: (lv) => ({ pet: 15, wispPlus: lv >= 3 ? 1 : 0, lanternStay: lv >= 5 ? 1 : 0 }),
      desc: (lv) => `ซัมมอนทั้งหมดแรงขึ้น 15%${lv >= 3 ? ' · วิญญาณเพิ่ม 1 ดวง' : ''}${lv >= 5 ? ' · ภูตตะเกียงอยู่ถาวร' : ''}` }),
    // the archmage's new spells (their moves: class2_skills_a.js)
    am_inferno: S({ name: 'ทะเลเพลิง', icon: 'sk_am_inferno', type: 'magic', element: 'fire', cd: 12, sp: (lv) => 34 + lv * 3, mul: (lv) => 0.3 + lv * 0.05,
      desc: (lv, m) => `ทะเลเพลิงลุกทั่วพื้นที่ที่เล็ง 4 วิ ทุก 0.4 วิ ${m}% ของ MATK` }),
    am_glacial: S({ name: 'หอกธารน้ำแข็ง', icon: 'sk_am_glacial', type: 'magic', element: 'water', cd: 7, sp: (lv) => 22 + lv * 2, mul: (lv) => 2.4 + lv * 0.34,
      desc: (lv, m) => `หอกน้ำแข็งยักษ์พุ่งทะลุทั้งแนว ${m}% ของ MATK` }),
    am_lordthunder: S({ name: 'เจ้าแห่งอสนี', icon: 'sk_am_lordthunder', type: 'magic', element: 'wind', cd: 12, sp: (lv) => 36 + lv * 3, mul: (lv) => 0.8 + lv * 0.12,
      desc: (lv, m) => `พายุฟ้าผ่าเต็มพื้นที่ 3 วิ ฟ้าผ่าลูกละ ${m}% ของ MATK` }),
  });

  // ---------------- the lines of every job, and every job's skills (made from the plan's jobs.js) ----------------
  // a line: [id, name, element, parent (the 1st job's line a 2nd job's line continues), auto (the auto-attack line)]
  // a skill: [id, line, top level, free levels, needs, how it grows]; needs: [[skill, level], ...], '|' first = any one
  const LINES = {
    knight: [['sword', 'ดาบ', 'neutral', null, 0], ['berserk', 'คลั่งศึก', 'neutral', null, 1], ['guard', 'ผู้พิทักษ์', 'holy', null, 0], ['flame', 'เพลิงหอก', 'fire', null, 0]],
    paladin: [['holy', 'แสงศักดิ์สิทธิ์', 'holy', "guard", 0], ['holyblade', 'ดาบศักดิ์สิทธิ์', 'holy', "berserk", 1], ['shield', 'ปราการโล่', 'neutral', "guard", 0], ['team', 'พิทักษ์ทีม', 'holy', null, 0]],
    dragonknight: [['spear', 'ศาสตร์หอก', 'neutral', "flame", 0], ['quickspear', 'หอกรัว', 'fire', "berserk", 1], ['dragon', 'เพลิงมังกร', 'fire', "flame", 0], ['wyvern', 'ไวเวิร์น', 'fire', null, 0]],
    mage: [['fire', 'ไฟ', 'fire', null, 0], ['ice', 'น้ำแข็ง', 'water', null, 0], ['storm', 'สายฟ้า', 'wind', null, 0], ['quick', 'เวทเร็ว', 'neutral', null, 1]],
    archmage: [['fire', 'นรกเพลิง', 'fire', "fire", 0], ['ice', 'ธารน้ำแข็ง', 'water', "ice", 0], ['storm', 'พายุอสนี', 'wind', "storm", 0], ['quick', 'เวทรัวหลอมธาตุ', 'multi', "quick", 1]],
    warlock: [['soul', 'ไฟวิญญาณ', 'shadow', "fire", 0], ['swing', 'ตะเกียงแกว่ง', 'shadow', "quick", 1], ['curse', 'คำสาป', 'shadow', null, 0], ['lantern', 'ภูตตะเกียง', 'shadow', null, 0]],
    archer: [['rapid', 'ยิงรัว', 'neutral', null, 1], ['aim', 'แม่นยำ', 'neutral', null, 0], ['rain', 'ห่าศร', 'neutral', null, 0], ['wild', 'พรานพฤกษา', 'wind', null, 0]],
    ranger: [['rapid', 'พายุศรเร็ว', 'wind', "rapid", 1], ['trap', 'กับดัก', 'fire', "wild", 0], ['snipe', 'สไนเปอร์', 'neutral', "aim", 0], ['storm', 'พายุพฤกษา', 'wind', "wild", 0]],
    wolfhunter: [['wolf', 'หมาป่าคู่ใจ', 'neutral', null, 0], ['falcon', 'เหยี่ยว', 'wind', "rapid", 1], ['moon', 'สายเลือดจันทร์', 'neutral', null, 0], ['hunt', 'นักล่า', 'neutral', "aim", 0]],
    rogue: [['blade', 'คมมีด', 'neutral', null, 1], ['venom', 'พิษ', 'poison', null, 0], ['shadow', 'เงา', 'shadow', null, 0]],
    assassin: [['crit', 'คริติคอล', 'neutral', "blade", 1], ['venom', 'พิษมรณะ', 'poison', "venom", 0], ['shadow', 'เงามรณะ', 'shadow', "shadow", 0]],
    shinobi: [['throw', 'ซัดรัว', 'neutral', "blade", 1], ['katon', 'คาถาไฟ', 'fire', null, 0], ['fuuton', 'คาถาลม-สายฟ้า', 'wind', "shadow", 0], ['kage', 'วิชาเงา', 'shadow', "shadow", 0]],
    priest: [['heal', 'ฟื้นฟู', 'holy', null, 0], ['bless', 'บัฟทีม', 'holy', null, 0], ['light', 'แสง', 'holy', null, 0], ['battle', 'พระนักสู้', 'holy', null, 1]],
    bishop: [['heal', 'ฟื้นฟูชั้นสูง', 'holy', "heal", 0], ['praise', 'สรรเสริญ', 'holy', "bless", 0], ['ward', 'บาเรีย', 'holy', "bless", 0], ['judge', 'พิพากษา', 'holy', "light", 0], ['hymn', 'บทสวดศึก', 'holy', "battle", 1]],
    monk: [['combo', 'คอมโบ', 'neutral', "battle", 1], ['sphere', 'ลูกปราณ', 'neutral', null, 0], ['iron', 'ร่างเหล็ก', 'neutral', null, 0]],
  };
  const PLAN = {
    knight: [
      ['bash', 'sword', 10, 1, [], "Lv5 มึนนานขึ้น + คลื่นกระแทกสั้น · Lv10 คลื่นกระแทกเป็นแนวยาว"],
      ['kn_bowling', 'sword', 10, 0, [["bash", 5]], "Lv5 หมุน 3 รอบ · Lv10 ตัวที่กระเด็นไปชนตัวอื่นโดนเพิ่ม"],
      ['kn_swordmastery', 'sword', 10, 0, [], "Lv10 ฟันสะท้านเหล็กและหมุนฟาดกระเด็นคริติคอล +10%"],
      ['kn_quicken', 'berserk', 10, 0, [["kn_swordmastery", 3]], "Lv5 ตีปกติทิ้งรอยดาบ · Lv10 ตีคริแล้วเร็วขึ้นอีกชั่วครู่"],
      ['kn_cleave', 'berserk', 10, 0, [["kn_quicken", 1]], "Lv5 กวาดกว้างขึ้น · Lv10 ตีครั้งที่ 5 ปล่อยคลื่นดาบ"],
      ['kn_aurablade', 'berserk', 5, 0, [["kn_swordmastery", 5]], "Lv5 ออร่าติดไปกับคลื่นดาบและฟันกวาดด้วย"],
      ['kn_berserk', 'berserk', 5, 0, [["kn_quicken", 5], ["kn_cleave", 3]], "Lv3 ไม่สะดุ้งเมื่อโดนตี · Lv5 ไอแดงรอบตัว การตีครั้งที่ 3 ทุกครั้งปล่อยคลื่นดาบเล็ก"],
      ['guard', 'guard', 10, 1, [], "Lv5 สะท้อนดาเมจ 10% · Lv10 โดมครอบเพื่อนรอบตัวด้วย"],
      ['kn_ironskin', 'guard', 10, 0, [], "Lv10 HP ต่ำกว่า 30% ได้ DEF เพิ่มอีกเท่าตัว"],
      ['kn_provoke', 'guard', 5, 0, [], "Lv5 ดึงศัตรูเข้าหาตัวเล็กน้อย"],
      ['judgment', 'guard', 5, 0, [["guard", 5], ["kn_ironskin", 3]], "Lv5 ดาบเล็ก 4 เล่มตกรอบดาบใหญ่"],
      ['magnum', 'flame', 10, 1, [], "Lv5 อาวุธติดไฟนานขึ้น · Lv10 ทิ้งพื้นลุกไหม้"],
      ['kn_pierce', 'flame', 10, 0, [["magnum", 3]], "Lv5 แทง 4 ครั้ง · Lv10 ครั้งสุดท้ายพุ่งทะลุ"],
    ],
    paladin: [
      ['pal_strike', 'holy', 10, 1, [], "Lv5 ติดสถานะชำระ (อมตะ/มืดรับเพิ่ม) · Lv10 คลื่นแสงยาวขึ้น"],
      ['pal_cross', 'holy', 10, 0, [["pal_strike", 3], ["judgment", 1]], "Lv5 กางเขนหมุน 2 รอบ · Lv10 เสาแสงที่ปลายแขนกางเขน"],
      ['pal_faith', 'holy', 10, 0, [], "Lv10 แสงกากบาทเผาผลาญไม่เสีย HP"],
      ['pal_heaven', 'holy', 5, 0, [["pal_cross", 5], ["pal_faith", 5]], "Lv5 ดาบ 16 เล่ม + ดาบยักษ์ปิดท้าย"],
      ['pal_holyblade', 'holyblade', 10, 0, [["kn_swordmastery", 5]], "Lv5 ตีครั้งที่ 5 ฟันกางเขนแสง · Lv10 ตีปกติฟื้น HP 1% ของดาเมจ"],
      ['pal_zeal', 'holyblade', 10, 0, [["kn_quicken", 5]], "Lv5 ตีคริแล้วได้ HP · Lv10 ออร่าแสงเผาศัตรูรอบตัวทุกวินาที"],
      ['pal_faithblade', 'holyblade', 5, 0, [["kn_berserk", 3]], "Lv1 ตีปกติฮีลเพื่อนที่เลือดน้อยสุด 1% ของดาเมจ · Lv3 ตีครบ 10 ครั้งปล่อยกางเขนแสงรอบตัว · Lv5 บ้าคลั่งไม่เสีย HP และเปิดโล่อีจิสได้ระหว่างคลั่ง"],
      ['pal_shieldchain', 'shield', 10, 0, [["guard", 5]], "Lv5 เด้งเพิ่ม 2 ตัว · Lv10 โล่กลับมาระเบิดแสงรอบตัว"],
      ['pal_aegis', 'shield', 5, 0, [["guard", 5]], "Lv5 ตอนเปิดอยู่ ศัตรูที่ตีเราช้าลง"],
      ['pal_reflect', 'shield', 5, 0, [["pal_aegis", 3]], "Lv5 สะท้อนเป็นธาตุแสง"],
      ['pal_bulwark', 'shield', 5, 0, [["kn_ironskin", 10]], "Lv1 ลดสูงสุด 20% · Lv3 +DEF ตามจำนวนศัตรูรอบตัว · Lv5 ตอนเปิดอีจิส โล่พิฆาตแรงสองเท่า"],
      ['pal_devotion', 'team', 5, 0, [["pal_faith", 3]], "Lv5 เพื่อนที่ผูกไว้ฟื้น HP ช้า ๆ"],
      ['pal_layhands', 'team', 10, 0, [["pal_devotion", 1]], "Lv5 ล้างสถานะผิดปกติ · Lv10 ฮีลแล้วได้บาเรียเล็ก"],
    ],
    dragonknight: [
      ['dk_thrust', 'spear', 10, 1, [], "Lv5 ติดไฟ (เผา) · Lv10 หัวมังกรไฟพุ่งไปสุดแนว"],
      ['dk_spiral', 'spear', 10, 0, [["dk_thrust", 5], ["dk_spearmastery", 3]], "Lv5 7 ครั้ง · Lv10 ครั้งสุดท้ายไม่สน DEF"],
      ['dk_charge', 'spear', 5, 0, [["dk_thrust", 3]], "Lv5 ทิ้งทางไฟไว้ข้างหลัง"],
      ['dk_spearmastery', 'spear', 10, 0, [], "Lv10 ท่าหอกระยะไกลขึ้น 20%"],
      ['dk_quicken', 'quickspear', 10, 0, [["dk_spearmastery", 3]], "Lv5 ตีปกติบางครั้งแทงสองครั้ง (10%) · Lv10 เร็วขึ้นรวม 20%"],
      ['dk_tail', 'quickspear', 10, 0, [["dk_quicken", 1]], "Lv5 หอกไฟติดเผา · Lv10 แตกเป็น 3 แนว"],
      ['dk_fury', 'quickspear', 5, 0, [["dk_spearmastery", 3]], "Lv5 ร่างลุกเป็นไฟ ศัตรูใกล้ตัวติดไฟ"],
      ['dk_breath', 'dragon', 10, 0, [["magnum", 5]], "Lv5 กรวยกว้างขึ้น · Lv10 ไฟสีน้ำเงิน ทะลุ DEF บางส่วน"],
      ['dk_leap', 'dragon', 5, 0, [["dk_breath", 3]], "Lv5 ทิ้งพื้นลุกไหม้"],
      ['dk_blood', 'dragon', 5, 0, [["dk_breath", 5]], "Lv1 ไฟ +10% · Lv3 ศัตรูที่ติดไฟรับดาเมจหอกเพิ่ม · Lv5 ศัตรูที่ติดไฟตายแล้วระเบิด"],
      ['dk_roar', 'dragon', 5, 0, [["dk_breath", 5], ["dk_blood", 3]], "Lv5 มังกร 2 ตัว"],
      ['dk_wyvern', 'wyvern', 10, 0, [["dk_blood", 1]], "โตทุกเลเวล · Lv5 พ่นไฟเป็นกรวย · Lv10 โตเต็มวัย พ่นลูกไฟ 3 ลูก"],
    ],
    mage: [
      ['fireball', 'fire', 10, 1, [], "Lv5 ทิ้งพื้นลุกไหม้ · Lv10 แตกเป็น 3 ลูก"],
      ['mg_firewall', 'fire', 5, 0, [["fireball", 4]], "Lv5 กำแพงยาวขึ้นเป็นรูปโค้ง"],
      ['mg_fireheart', 'fire', 10, 0, [], "Lv5 เผาซ้อน 2 ชั้น · Lv10 ระเบิดไฟใหญ่ขึ้น 25%"],
      ['frostdiver', 'ice', 10, 1, [], "Lv5 แนวยาวขึ้น · Lv10 แยกเป็น 3 แนว"],
      ['mg_frostnova', 'ice', 5, 0, [["frostdiver", 4]], "Lv5 ทิ้งพื้นน้ำแข็ง (ศัตรูลื่นช้า)"],
      ['mg_iceheart', 'ice', 10, 0, [], "Lv5 ศัตรูเย็นเฉียบซ้อน 3 ชั้นแล้วแข็ง · Lv10 ตัวที่แข็งรับดาเมจเพิ่ม 20%"],
      ['thunder', 'storm', 10, 1, [], "Lv5 สายฟ้ากระโดดต่อ · Lv10 ผ่าซ้ำตัวที่ช็อต"],
      ['mg_stormheart', 'storm', 10, 0, [], "Lv5 ช็อตแล้วรับดาเมจสายฟ้าเพิ่ม · Lv10 ทุกครั้งที่ช็อตมีฟ้าผ่าเล็กฟรี"],
      ['meteor', 'multi', 5, 0, ["|", ["mg_fireheart", 5], ["mg_iceheart", 5], ["mg_stormheart", 5]], "Lv5 ร่างใหญ่ขึ้นเท่าตัว"],
      ['mg_staffmastery', 'quick', 10, 0, [], "Lv5 ลูกแก้วทะลุ 1 ตัว · Lv10 ตีปกติยิงลูกที่สอง (40%)"],
      ['mg_autospell', 'quick', 10, 0, [["mg_staffmastery", 3]], "Lv5 SP เกิน 80% โอกาสเพิ่ม 30% · Lv10 บางครั้งร่าย 2 ธาตุพร้อมกัน (30%)"],
      ['mg_memorize', 'quick', 5, 0, [["mg_sprecovery", 3]], "Lv5 ครั้งแรกหลังเปิดบัฟร่ายทันที"],
      ['mg_sprecovery', 'quick', 10, 0, [], "Lv10 ร่ายอัตโนมัติคืน SP นิดหน่อย"],
    ],
    archmage: [
      ['am_firepillar', 'fire', 10, 0, [["mg_firewall", 3]], "Lv5 5 ครั้ง · Lv10 เสาไฟเดินตามศัตรู"],
      ['am_inferno', 'fire', 10, 0, [["am_firepillar", 5]], "Lv5 พื้นที่กว้างขึ้น · Lv10 เปลวเพลิงหมุนเป็นพายุ"],
      ['am_infernomastery', 'fire', 5, 0, [["mg_fireheart", 10]], "Lv1 สกิลไฟทิ้งพื้นลุกไหม้ · Lv3 ไฟกลายเป็นสีฟ้า ดาเมจ +10% และตีมอนธาตุไฟได้อย่างน้อย 75% · Lv5 ระเบิดไฟระเบิดซ้ำอีกครั้ง"],
      ['am_blizzard', 'ice', 10, 0, [["mg_frostnova", 3]], "Lv5 ศัตรูข้างในแข็งเมื่อพายุจบ · Lv10 พายุเคลื่อนตามเมาส์"],
      ['am_glacial', 'ice', 10, 0, [["frostdiver", 5]], "Lv5 แช่แข็งทั้งแนว · Lv10 หอกระเบิดเป็นเศษน้ำแข็งที่ปลาย"],
      ['am_absolutezero', 'ice', 5, 0, [["mg_iceheart", 10]], "Lv1 ศัตรูที่แข็งรับดาเมจ +15% · Lv3 น้ำแข็งแตกกระจายโดนรอบข้าง และตีมอนธาตุน้ำได้อย่างน้อย 75% · Lv5 ทุกสกิลน้ำแข็งแช่แข็งแน่นอน"],
      ['am_chain', 'storm', 10, 0, [["thunder", 5]], "Lv5 กระโดดกลับตัวเดิมได้ · Lv10 แยกเป็น 2 สาย"],
      ['am_lordthunder', 'storm', 10, 0, [["am_chain", 5]], "Lv5 ฟ้าผ่าถี่ขึ้น · Lv10 เมฆพายุตามตัวเราไปด้วย"],
      ['am_overcharge', 'storm', 5, 0, [["mg_stormheart", 10]], "Lv1 ช็อตแพร่ไปตัวข้าง ๆ และตีมอนธาตุลม/ดินได้อย่างน้อย 75% · Lv3 ทุกครั้งที่ 4 ของสกิลสายฟ้าได้ฟ้าผ่าใหญ่ฟรี · Lv5 ร่างเป็นประจุไฟฟ้า เดินผ่านศัตรูแล้วช็อต"],
      ['am_doublecast', 'quick', 10, 0, [["mg_autospell", 5]], "Lv5 ครั้งที่สองเป็นอีกธาตุ (เกิดปฏิกิริยาได้) · Lv10 ทุก 10 ครั้งปล่อยพายุธาตุเล็ก"],
      ['am_arcaneflux', 'quick', 10, 0, [["mg_staffmastery", 5]], "Lv5 เวลาร่ายลดลง 20% ระหว่างบัฟ · Lv10 วงเวทหมุนรอบตัว ยิงลูกแก้วเพิ่มเอง"],
      ['am_convergence', 'quick', 5, 0, [], "Lv1 ร่ายธาตุต่างจากครั้งก่อน ดาเมจ +8% ซ้อน 3 ชั้น · Lv3 ปฏิกิริยาธาตุแรงขึ้น 50% · Lv5 ปฏิกิริยาธาตุทุกครั้งคืน SP"],
    ],
    warlock: [
      ['wl_soulfire', 'soul', 10, 1, [], "Lv5 ระเบิดแยกเป็นวิญญาณ 3 ดวง · Lv10 เผาแพร่ไปตัวข้าง ๆ"],
      ['wl_soulburn', 'soul', 10, 0, [["wl_soulfire", 3]], "Lv5 ตายแล้วไฟกระโดดไปตัวใหม่ · Lv10 ได้ SP คืนต่อตัวที่ตายขณะไหม้"],
      ['wl_harvest', 'soul', 5, 0, [["wl_soulfire", 5]], "Lv3 ดวงวิญญาณยิงศัตรูเอง · Lv5 ครบดวงแล้วอัลติคูลดาวน์ลดลง"],
      ['wl_parade', 'soul', 5, 0, [["wl_soulfire", 5], ["wl_harvest", 3]], "Lv5 วิญญาณเพิ่มตามดวงวิญญาณที่สะสม"],
      ['wl_swing', 'swing', 10, 0, [["mg_staffmastery", 3]], "Lv5 กระโดด 2 ตัว · Lv10 ฆ่าได้แล้วได้ดวงวิญญาณเพิ่ม"],
      ['wl_drain', 'swing', 10, 0, [["wl_swing", 1]], "Lv10 ดูดจน HP เต็มแล้วส่วนเกินกลายเป็นบาเรีย"],
      ['wl_blaze', 'swing', 5, 0, [["wl_swing", 3]], "Lv5 ระหว่างบัฟ ได้ดวงวิญญาณสองเท่า"],
      ['wl_chains', 'curse', 5, 0, [], "Lv5 ตรึงนานขึ้นและดึงเข้ากลาง"],
      ['wl_hex', 'curse', 10, 0, [["wl_chains", 3]], "Lv5 ประทับได้ 2 ตัว · Lv10 ระเบิดแล้วตราแพร่ไปตัวใหม่"],
      ['wl_pact', 'curse', 5, 0, [["wl_chains", 1]], "Lv5 ระหว่างบัฟ คำสาปทุกอันแรงขึ้น"],
      ['wl_wisps', 'lantern', 10, 0, [], "จำนวนดวงเพิ่มตามเลเวล (3 → 5)"],
      ['wl_lantern', 'lantern', 10, 0, [["wl_wisps", 3]], "โตทุกเลเวล · Lv5 สลับโหมดได้: คุ้มกัน (รับดาเมจแทนเรา) หรือโจมตี · Lv10 ดูดเป็นลำแสงใหญ่ 2 ตัวพร้อมกัน"],
      ['wl_lanternmastery', 'lantern', 5, 0, [["wl_lantern", 3]], "Lv1 ซัมมอน +15% · Lv3 วิญญาณ +1 ดวง · Lv5 ภูตตะเกียงอยู่ถาวร"],
    ],
    archer: [
      ['ar_bowmastery', 'rapid', 10, 0, [], "Lv10 ยิงปกติทุกดอกที่ 5 ยิงคู่ แรงขึ้น 50%"],
      ['ar_concentrate', 'rapid', 5, 0, [["ar_owl", 3]], "Lv5 เห็นศัตรูที่ซ่อนตัว"],
      ['ar_doubleshot', 'rapid', 10, 0, [["ar_bowmastery", 1]], "Lv5 ลูกเบิ้ลแรงขึ้น 10% · Lv10 บางครั้งออกสามลูก"],
      ['double', 'aim', 10, 1, [], "Lv5 ดอกที่สองคริติคอลง่ายขึ้น · Lv10 ยิง 3 ดอก"],
      ['ar_owl', 'aim', 10, 0, [], "-"],
      ['ar_charge', 'aim', 5, 0, [["double", 3]], "Lv5 กระเด็นไปชนตัวอื่นแล้วมึนทั้งคู่"],
      ['starshot', 'aim', 5, 0, ["|", ["double", 5], ["shower", 5]], "Lv5 ลำแสงกว้างเป็นสองเท่า"],
      ['shower', 'rain', 10, 1, [], "Lv5 พื้นที่กว้างขึ้น · Lv10 ห่าฝนสองระลอก"],
      ['ar_multishot', 'rain', 10, 0, [["shower", 3]], "Lv5 7 ดอก · Lv10 ดอกทะลุ"],
      ['gale', 'wild', 10, 1, [], "Lv5 ลมดูดศัตรูเข้าแนว · Lv10 ธนูแตกเป็นพายุเล็กที่ปลาย"],
      ['ar_snare', 'wild', 5, 0, [["gale", 3]], "Lv5 เถาวัลย์รัดหลายตัว"],
    ],
    ranger: [
      ['rg_fearbreeze', 'rapid', 10, 0, [["ar_doubleshot", 5]], "Lv5 ดอกเพิ่มเป็นธาตุลม · Lv10 ดอกที่คริติคอลยิงซ้ำ"],
      ['rg_truesight', 'rapid', 10, 0, [["ar_owl", 5]], "Lv5 คริแรงขึ้น 10% · Lv10 ระหว่างบัฟ ยิงปกติไม่พลาด"],
      ['rg_unlimit', 'rapid', 5, 0, [["rg_fearbreeze", 3], ["rg_truesight", 3]], "Lv3 ตัวเป็นประกายทอง ลูกธนูระเบิดเป็นประกายทอง · Lv5 ระหว่างบัฟ ยิงเบิ้ลเพิ่ม 20%"],
      ['rg_trap', 'trap', 10, 0, [["ar_snare", 3]], "Lv5 ระเบิดทิ้งไฟ · Lv10 ระเบิดสองจังหวะ"],
      ['rg_freezetrap', 'trap', 10, 0, [["rg_trap", 3]], "Lv5 วงกว้างขึ้น · Lv10 แตกเป็นหนามน้ำแข็ง"],
      ['rg_trapmastery', 'trap', 5, 0, [["rg_trap", 5]], "Lv1 วางได้ +1 อัน · Lv3 กับดักแรง +25% · Lv5 กับดักระเบิดต่อกันเป็นลูกโซ่"],
      ['rg_detonate', 'trap', 5, 0, [["rg_trapmastery", 1]], "Lv5 จุดแล้วกับดักคืนมาครึ่งหนึ่ง"],
      ['rg_snipe', 'snipe', 10, 0, [["ar_charge", 3]], "Lv5 เล็งเร็วขึ้น · Lv10 ยิงสองนัด"],
      ['rg_eagle', 'snipe', 5, 0, [["ar_owl", 10]], "Lv1 คริแรง +15% · Lv3 คริแล้วลดคูลดาวน์ยิงสไนป์ · Lv5 คริแล้วยิงซ้ำฟรี"],
      ['rg_focus', 'snipe', 5, 0, [["rg_eagle", 1]], "Lv5 นานขึ้นเท่าตัว"],
      ['rg_triple', 'storm', 10, 1, [], "ทุกดอกทะลุทั้งแนว"],
      ['rg_piercer', 'storm', 10, 0, [["gale", 5]], "Lv5 วังวนนานขึ้น · Lv10 วังวนสองจุด"],
      ['rg_storm', 'storm', 5, 0, [["rg_piercer", 5]], "Lv5 พายุเคลื่อนตามเมาส์"],
    ],
    wolfhunter: [
      ['wh_wolf', 'wolf', 10, 1, [], "โตทุกเลเวล · Lv5 กัดเลือดออก · Lv8 กัดโดนรอบตัว · Lv10 ขนสีทอง"],
      ['wh_command', 'wolf', 10, 0, [["wh_wolf", 3]], "Lv5 กัดแล้วเหวี่ยง · Lv10 หมาป่าหายตัวไปโผล่หลังเป้า"],
      ['wh_alpha', 'wolf', 5, 0, [["wh_wolf", 5]], "Lv1 หมาป่าตัวโต +10% · Lv3 หมาป่ามีลูกฝูง 1 ตัว · Lv5 หมาป่าหอนเองทุก 20 วิ"],
      ['wh_pack', 'wolf', 5, 0, [["wh_wolf", 5], ["wh_howl", 3]], "Lv5 ฝูงวิ่งกลับอีกรอบ"],
      ['wh_blitz', 'falcon', 10, 1, [], "Lv5 โฉบเป็นวงโดนรอบเป้า · Lv10 เหยี่ยวสายฟ้า ติดช็อต"],
      ['wh_autoblitz', 'falcon', 10, 0, [["wh_blitz", 3]], "Lv5 โฉบเองถี่ขึ้น · Lv10 เหยี่ยวคริติคอลได้"],
      ['wh_steelcrow', 'falcon', 5, 0, [["wh_autoblitz", 5]], "Lv1 เหยี่ยวแรง +20% · Lv3 เป้าที่โดนโฉบรับดาเมจธนูเพิ่ม 10% · Lv5 เหยี่ยวทองตัวที่สอง โฉบพร้อมกัน (แรง 35%)"],
      ['wh_bond', 'moon', 10, 0, [], "Lv10 หมาป่าได้คริติคอลเท่าเรา"],
      ['wh_howl', 'moon', 5, 0, [["wh_wolf", 3]], "Lv5 เพื่อนในปาร์ตี้ได้บัฟด้วย"],
      ['wh_frenzy', 'moon', 5, 0, [["wh_bond", 5]], "Lv5 เราได้ดูดเลือดจากการกัดของหมาป่า"],
      ['wh_wolfrush', 'moon', 10, 0, [["wh_wolf", 3]], "Lv5 กัดแล้วตรึง 1 วิ · Lv10 ทุกครั้งที่หมาป่ากัด เรายิงเร็วขึ้น 0.5% ซ้อน 10 ชั้น"],
      ['wh_fang', 'hunt', 10, 0, [], "Lv5 ทิ้งรอยเขี้ยว (เลือดออก) · Lv10 ยิง 2 ดอก"],
      ['wh_mark', 'hunt', 5, 0, [["wh_fang", 3]], "Lv5 เป้าตายแล้วเครื่องหมายย้ายไปตัวใกล้สุด"],
      ['wh_huntmastery', 'hunt', 10, 0, [], "Lv10 ยิงโดนเป้าที่หมาป่ากัดอยู่แรงขึ้น"],
    ],
    rogue: [
      ['ro_double', 'blade', 10, 0, [], "Lv10 ตีสองครั้งแล้วติดพิษ (ถ้ามีใจพิษ)"],
      ['ro_dagger', 'blade', 10, 0, [], "Lv10 ความเร็วโจมตีเพิ่มอีก 10%"],
      ['ro_vital', 'blade', 10, 0, [["ro_dagger", 3]], "Lv5 คริแล้วแรงขึ้น 20% · Lv10 คริติคอลฟันสองครั้ง"],
      ['sonic', 'blade', 5, 0, ["|", ["ro_double", 5], ["ro_backstab", 5]], "Lv5 ฟันเพิ่มเป็น 12 ครั้ง"],
      ['envenom', 'venom', 10, 1, [], "Lv5 พิษซ้อน 2 ชั้น · Lv10 ฟัน 3 ครั้ง"],
      ['venomdust', 'venom', 10, 0, [["envenom", 3]], "Lv5 ควันลอยตามศัตรู · Lv10 ควันสองกลุ่ม"],
      ['ro_venomheart', 'venom', 10, 0, [], "Lv10 ศัตรูที่ติดพิษตีเราเบาลง"],
      ['shadowstep', 'shadow', 10, 1, [], "Lv5 ทิ้งร่างเงาหลอก · Lv10 ก้าวได้ 2 ครั้ง"],
      ['ro_hide', 'shadow', 5, 0, [["shadowstep", 3]], "Lv5 เดินได้ความเร็วปกติ"],
      ['ro_backstab', 'shadow', 10, 0, [["ro_hide", 2]], "Lv5 แทงแล้วซ่อนตัวต่ออีก 1 วิ · Lv10 แทงสองครั้ง"],
      ['ro_steal', null, 5, 0, [], "Lv5 ขโมยได้ 2 ครั้งต่อตัว"],
    ],
    assassin: [
      ['as_haste', 'crit', 10, 0, [["ro_double", 5]], "Lv5 เดินเร็วขึ้น · Lv10 ตีปกติทิ้งเงาที่ฟันซ้ำ"],
      ['as_lethal', 'crit', 10, 0, [["ro_vital", 5]], "Lv5 คริแล้วติดเลือดออก · Lv10 คริติดกัน 3 ครั้งได้ความเร็วเพิ่มชั่วครู่"],
      ['as_katar', 'crit', 5, 0, [["ro_dagger", 10]], "Lv1 คริ +3% · Lv3 คริแรง +15% · Lv5 คริแล้วฟันซ้ำอัตโนมัติ (20%)"],
      ['as_twin', 'crit', 10, 1, [], "Lv5 พุ่งได้ 2 ครั้ง · Lv10 ทิ้งรอยเลือด"],
      ['as_meteor', 'crit', 10, 0, [["as_twin", 5]], "Lv5 วงกว้างขึ้น · Lv10 ระเบิดสองจังหวะ"],
      ['as_knives', 'venom', 10, 0, [["venomdust", 3]], "Lv5 7 เล่ม · Lv10 มีดเด้งไปตัวถัดไป"],
      ['as_edp', 'venom', 5, 0, [["ro_venomheart", 5]], "Lv5 พิษซ้อนได้ไม่จำกัดตอนบัฟ"],
      ['as_splasher', 'venom', 10, 0, [["as_knives", 3]], "Lv5 ระเบิดแรงขึ้นตามชั้นพิษ · Lv10 ระเบิดลูกโซ่"],
      ['as_venom', 'venom', 5, 0, [["ro_venomheart", 10]], "Lv1 พิษซ้อน 3 ชั้น · Lv3 พิษทำคริติคอลได้ · Lv5 ศัตรูที่ตายตอนติดพิษระเบิดพิษ"],
      ['as_cloak', 'shadow', 5, 0, [["ro_hide", 3]], "Lv5 ออกจากอำพรางแล้วได้ความเร็วโจมตีเพิ่ม"],
      ['as_grimtooth', 'shadow', 10, 0, [["as_cloak", 3]], "Lv5 แนวยาวขึ้น · Lv10 หนามสองแถว"],
      ['as_deathmark', 'shadow', 5, 0, ["|", ["as_grimtooth", 5], ["as_twin", 5]], "Lv5 ฆ่าได้แล้วตราย้ายไปตัวใหม่"],
    ],
    shinobi: [
      // (the star line redesigned 2026-10-01: js/ninjastars.js — ดาวคู่ · พัดดาวกระจาย · ดาวชิ่ง, the rest reworked)
      ['sh_throwing', 'throw', 10, 0, [["ro_double", 3]], "Lv5 เงาดาวชิ่งต่อ 1 ตัว · Lv10 ท่ากระโดดปาได้ดาวคู่ทุกครั้ง"],
      ['sh_huuma', 'throw', 10, 0, [], "Lv5 ใหญ่ขึ้น · Lv10 ปลายทางหมุนค้างดูดมอนเข้าหา"],
      ['sh_fan', 'throw', 10, 0, [["sh_huuma", 3]], "Lv5 7 ดอก · Lv10 ทุกดอกชิ่ง 1 ครั้งก่อนกลับ"],
      ['sh_ricochet', 'throw', 10, 0, [["sh_fan", 3]], "Lv10 ชิ่ง 7 ตัว"],
      ['sh_shuriken', 'throw', 5, 0, [["sh_huuma", 5]], "Lv5 วงสองชั้นหมุนสวนกัน · ตอนจบวงแตกพุ่งชิ่ง"],
      ['sh_kunai', 'katon', 10, 1, [], "Lv5 ปา 2 เล่ม · Lv10 ระเบิดทิ้งไฟ"],
      ['sh_katon', 'katon', 10, 0, [["sh_kunai", 3]], "Lv5 7 กลีบ · Lv10 กลีบรวมเป็นมังกรไฟ"],
      ['sh_windblade', 'fuuton', 10, 0, [["shadowstep", 5]], "Lv5 พุ่งได้ 2 ครั้ง · Lv10 ทิ้งพายุหมุน"],
      ['sh_raiton', 'fuuton', 10, 0, [["sh_windblade", 3]], "Lv5 ฟาด 2 จุด · Lv10 สายฟ้ากระโดดต่อ"],
      ['sh_ninjamastery', null, 5, 0, [["ro_hide", 3]], "Lv1 คาถา +15% · Lv3 ยันต์ธาตุ: ใช้คาถาธาตุเดิมซ้ำได้ยันต์ สูงสุด 10 ใบ ใบละ +6% เปลี่ยนธาตุแล้วยันต์หาย · Lv5 ทุกคาถาทิ้งร่างเงาที่ร่ายซ้ำครึ่งแรง"],
      ['sh_clone', 'kage', 10, 0, [["ro_hide", 3]], "Lv5 3 ร่าง · Lv10 4 ร่าง ดาวชิ่ง 2 ครั้ง"],
      ['sh_substitute', 'kage', 5, 0, [["sh_clone", 1]], "Lv5 ท่อนไม้ระเบิด"],
      ['sh_smoke', 'kage', 5, 0, [["sh_substitute", 1]], "Lv5 ในควันเราหายตัว"],
    ],
    priest: [
      ['pr_heal', 'heal', 10, 1, [], "Lv5 ฮีลเป็นวง · Lv10 ฮีลเกินได้บาเรียเล็ก"],
      ['pr_resurrect', 'heal', 5, 0, [["pr_heal", 5]], "Lv5 ชุบแล้วได้บัฟอมตะ 2 วิ"],
      ['pr_protect', 'heal', 10, 0, [], "-"],
      ['blessing', 'bless', 10, 1, [], "Lv10 ปีกขาวค้างระหว่างบัฟ"],
      ['pr_agi', 'bless', 10, 0, [["pr_heal", 3]], "Lv10 ทั้งทีมเดินเร็วขึ้นอีก 10%"],
      ['pr_angelus', 'bless', 10, 0, [["pr_protect", 3]], "-"],
      ['pr_gloria', 'bless', 5, 0, [["blessing", 3]], "Lv5 ทั้งทีมคริแรงขึ้น 10%"],
      ['pr_suffragium', 'bless', 5, 0, [["blessing", 5]], "Lv5 ร่ายครั้งแรกหลังได้บัฟเร็วขึ้นอีก 30%"],
      ['holylight', 'light', 10, 1, [], "Lv5 ลำแสง 2 เส้น · Lv10 ลำแสงกระโดดต่อ"],
      ['pr_demonbane', 'light', 10, 0, [], "Lv10 ตีอมตะแล้วติดสถานะชำระ"],
      ['magnus', 'light', 5, 0, [["holylight", 5], ["pr_demonbane", 3]], "Lv5 วงใหญ่ขึ้น ระลอกถี่ขึ้น"],
      ['pr_aspersio', 'battle', 5, 0, [["holylight", 3]], "Lv5 ตีปกติมีลำแสงเล็กลงมา"],
      ['pr_macemastery', 'battle', 10, 0, [], "Lv10 ตีครั้งที่ 5 ฟื้น HP เพื่อนที่เลือดน้อยสุด"],
      ['pr_duple', 'battle', 10, 0, [["pr_macemastery", 3]], "Lv5 ติดสถานะชำระ · Lv10 แสงกระโดดไปอีกตัว"],
    ],
    bishop: [
      ['bi_heal', 'heal', 10, 1, [], "Lv5 ทิ้งวงฟื้นฟูเล็ก · Lv10 ฮีลเกินกลายเป็นบาเรีย"],
      ['bi_sanctuary', 'heal', 10, 0, [["bi_heal", 3]], "Lv5 เขตใหญ่ขึ้น · Lv10 เขตเดินตามเรา"],
      ['bi_meditatio', 'heal', 5, 0, [["pr_heal", 10]], "Lv1 ฮีล +15% · Lv3 ฮีลคืน SP · Lv5 ทุกฮีลยิงแสงใส่ศัตรูใกล้สุด"],
      ['bi_miracle', 'heal', 5, 0, [["bi_sanctuary", 5]], "Lv5 ทุกคนอมตะ 3 วิหลังร่าย"],
      ['bi_clementia', 'praise', 10, 0, [["blessing", 10]], "Lv5 นานขึ้นเท่าตัว · Lv10 ปีกแสงทั้งทีม"],
      ['bi_canto', 'praise', 10, 0, [["pr_agi", 10]], "Lv5 ความเร็วโจมตีทั้งทีม +10% · Lv10 นานขึ้นเท่าตัว"],
      ['bi_sacrament', 'praise', 5, 0, [["pr_suffragium", 3]], "Lv5 ส่วนคงที่ของเวลาร่ายหายไป"],
      ['bi_expiatio', 'praise', 5, 0, [["bi_impositio", 3]], "Lv5 ตีทะลุ MDEF ด้วย"],
      ['bi_barrier', 'ward', 10, 0, [["blessing", 5]], "Lv5 เพื่อนได้บาเรียด้วย · Lv10 บาเรียแตกแล้วระเบิดแสง"],
      ['bi_assumptio', 'ward', 5, 0, [["bi_barrier", 5]], "Lv5 นานขึ้นเท่าตัว"],
      ['bi_magnificat', 'ward', 5, 0, [["pr_angelus", 3]], "-"],
      ['bi_turnundead', 'judge', 10, 0, [["holylight", 5]], "Lv5 โอกาสกำจัดทันทีกับอมตะ · Lv10 ลำแสงกระโดดต่อ"],
      ['bi_lexdivina', 'judge', 5, 0, [["bi_turnundead", 3]], "Lv5 ตรึงแล้วรับดาเมจแสงเพิ่ม"],
      ['bi_impositio', 'judge', 5, 0, [["blessing", 3]], "-"],
      ['bi_battlehymn', 'hymn', 10, 0, [["pr_macemastery", 5]], "Lv5 ตีคริแล้วฟื้น HP · Lv10 ออร่าเพลงรอบตัวตลอดบัฟ"],
      ['bi_mercy', 'hymn', 10, 0, [["pr_duple", 3]], "Lv10 ฮีลเกินกลายเป็นบาเรีย"],
    ],
    monk: [
      ['mo_triple', 'combo', 10, 0, [["pr_macemastery", 3]], "Lv5 สามหมัดได้ลูกปราณ · Lv10 ระหว่างปราณเดือด โอกาสคงที่ 30%"],
      ['mo_palms', 'combo', 10, 0, [["mo_chi", 3]], "Lv5 เปิดคอมโบ: ใช้ชุดหมัดต่อภายใน 1 วิ แรง ×1.5"],
      ['mo_combo', 'combo', 10, 0, [["mo_palms", 3]], "Lv5 ต่อจากฝ่ามือร้อยทิศได้ลูกปราณ 1 ลูก · Lv10 ปิดคอมโบด้วยหมัดสิ้นปราณได้ทันที ใช้ลูกปราณแค่ 3 ลูก"],
      ['mo_snap', 'combo', 5, 0, [["mo_spheres", 2]], "Lv5 ใช้ระหว่างคอมโบได้ไม่ตัดคอมโบ"],
      ['mo_fury', 'combo', 5, 0, [["mo_ironfist", 3]], "Lv5 ระหว่างบัฟ หมัดสิ้นปราณไม่ต้องร่าย"],
      ['mo_chi', 'sphere', 10, 1, [], "Lv5 คลื่นกว้างขึ้น · Lv10 ใช้ลูกปราณแล้วยิง 3 สาย"],
      ['mo_spheres', 'sphere', 5, 0, [], "สูงสุดตามเลเวล (1 → 5 ลูก)"],
      ['mo_impact', 'sphere', 10, 0, [["mo_chi", 5]], "Lv5 ยิ่ง DEF เป้าสูงยิ่งแรง · Lv10 คลื่นทะลุไปตัวข้างหลัง"],
      ['mo_asura', 'sphere', 5, 0, [["mo_spheres", 5], ["mo_impact", 3]], "Lv5 ระเบิดเป็นเสาทอง"],
      ['mo_ironbody', 'iron', 5, 0, [["mo_ironfist", 3]], "Lv5 ไม่กระเด็นไม่มึน"],
      ['mo_ironfist', 'iron', 10, 0, [], "-"],
      ['mo_dodge', 'iron', 10, 0, [], "Lv10 หลบได้แล้วสวนกลับอัตโนมัติ"],
    ],
  };
  for (const j in LINES) NC.JOBS[j].lines = LINES[j].map(([id, name, el, parent, auto]) => ({ id, name, el, parent: parent || null, auto: !!auto }));

  const SHARED = NC.SHARED_SKILLS;
  for (const job in PLAN) {
    const J = NC.JOBS[job];
    J.skills = PLAN[job].map((r) => r[0]).concat(J.tier === 1 ? SHARED : []);
    for (const [id, line, max, free, req, grow] of PLAN[job]) {
      const S = SK[id];
      if (!S) { console.warn('skillplan: no skill', id); continue; }
      S.line = line; S.max = max; S.free = free; S.grow = grow;
      const any = req[0] === '|';
      S.req = any ? req.slice(1) : req;
      S.reqAny = any;
    }
  }
  // the plan's names where the first version named them differently
  SK.dk_wyvern.name = 'ไวเวิร์นคู่ใจ';
  SK.wl_lantern.name = 'ภูตตะเกียง';
  // the mage's ultimate: its form follows the highest element heart
  SK.meteor.name = 'มหาเวทธาตุ';
  SK.meteor.form = (p) => {
    const f = NC.skillLv(p, 'mg_fireheart'), i = NC.skillLv(p, 'mg_iceheart'), s = NC.skillLv(p, 'mg_stormheart');
    return i > f && i >= s ? 'ice' : s > f && s > i ? 'storm' : 'fire';
  };
  SK.meteor.desc = (lv, m) => `ร่างตามใจธาตุที่เลเวลสูงสุด: ไฟ = อุกกาบาต ${6 + Math.floor(lv / 2)} ลูก · น้ำแข็ง = พายุน้ำแข็ง · สายฟ้า = พายุฟ้าผ่า · ครั้งละ ${m}% ของ MATK`;
  // (the reqFn rule of หลอมรวมธาตุ)
  const baseMet = NC.skillReqMet;
  NC.skillReqMet = (p, id) => baseMet(p, id) && (!SK[id] || !SK[id].reqFn || SK[id].reqFn(p));
})();
