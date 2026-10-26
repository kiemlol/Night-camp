/* stats.js — the character system, like a classic MMO: six base stats raised with status points, the combat values
   they give, the ten elements and their table, the job (job level, skill points, skills), monster levels and stats,
   and the hit / damage rules entities.js uses. Only numbers here: no drawing, so it can be tested on its own. */
(function () {
  'use strict';
  const NC = window.NC;
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------------- levels ----------------
  NC.LV_MAX = 99;
  NC.JOB_MAX = 50;
  NC.EXPERIENCE = {
    id: 'mobile-progression-2026-09-30',
    baseKills: [[1, 12], [10, 14], [25, 25], [40, 40], [60, 60], [80, 95], [99, 140]],
    standardExpK: 1.2,
    reward: { flat: 90, perLevel: 14, divisor: 16 },
    jobs: { 0: [70, 1.085], 1: [65, 1.08], 2: [320, 1.09], 3: [250, 1.075] },
    defaultJobRatio: 0.75,
    jobRatios: {
      slime: .65, slime_blue: .65, slime_green: .65, slime_honey: .65,
      slime_glow: .8, slime_stone: .8, slime_lava: .8,
      wolf: .65, boar: .65, raptor: .65, crab: .65,
      skeleton: .9, zombie: .9, bone_knight: .9, ghost: .9,
      ash_wisp: .9, candle_wisp: .9, mist_wraith: .9,
      bat_king: .9, mushking: .9, ant_queen: .9, crypt_lord: .9, lava_dragon: .9,
    },
  };
  // Monster rewards have their own budget; increasing level requirements must
  // never increase the reward of the same monster as a side effect.
  NC.monsterExpBudget = (lv) => (NC.EXPERIENCE.reward.flat + lv * NC.EXPERIENCE.reward.perLevel) / NC.EXPERIENCE.reward.divisor;
  NC.xpNext = (lv) => {
    lv = NC.clamp(Math.floor(lv), 1, NC.LV_MAX);
    const anchors = NC.EXPERIENCE.baseKills;
    let i = 1;
    while (i < anchors.length - 1 && lv > anchors[i][0]) i++;
    const [a, x] = anchors[i - 1], [b, y] = anchors[i];
    return Math.round(NC.monsterExpBudget(lv) * NC.EXPERIENCE.standardExpK * (x + (y - x) * (lv - a) / (b - a)));
  };
  NC.jobNext = (jlv, job) => {
    const tier = typeof job === 'number' ? job : (NC.JOBS[typeof job === 'string' ? job : job && job.job] || {}).tier;
    const [base, growth] = NC.EXPERIENCE.jobs[tier == null ? 1 : tier] || NC.EXPERIENCE.jobs[1];
    return Math.round(base * Math.pow(growth, jlv - 1));
  };
  NC.migrateExperience = (p, version) => {
    if (version !== NC.EXPERIENCE.id) {
      const fraction = (xp, need) => NC.clamp((Number.isFinite(xp) ? xp : 0) / need, 0, 1 - 1e-9);
      p.xp = Math.floor(fraction(p.xp, 90 + p.lv * 14) * NC.xpNext(p.lv));
      p.jobXp = Math.floor(fraction(p.jobXp, Math.round(70 * Math.pow(1.085, p.jobLv - 1))) * NC.jobNext(p.jobLv, p));
    }
    if (p.lv >= NC.LV_MAX) p.xp = 0;
    if (p.jobLv >= NC.jobMax(p)) p.jobXp = 0;
    p.experienceVersion = NC.EXPERIENCE.id;
  };

  // ---------------- base stats ----------------
  NC.STAT_KEYS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
  NC.STAT_INFO = {
    str: { th: 'พลัง', desc: 'พลังโจมตีของอาวุธระยะประชิด' },
    agi: { th: 'ความว่องไว', desc: 'ความเร็วโจมตี (ASPD) และการหลบ (FLEE)' },
    vit: { th: 'ความอึด', desc: 'HP สูงสุด ฟื้น HP และพลังป้องกัน (DEF)' },
    int: { th: 'สติปัญญา', desc: 'พลังเวท (MATK) SP สูงสุด ฟื้น SP และป้องกันเวท (MDEF)' },
    dex: { th: 'ความแม่นยำ', desc: 'ความแม่น (HIT) พลังโจมตีธนู และความเร็วโจมตีเล็กน้อย' },
    luk: { th: 'โชค', desc: 'โอกาสคริติคอล (CRI) และการหลบแบบสมบูรณ์' },
  };
  NC.STAT_MAX = 99;
  NC.START_STATS = { str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5 }; // a new character: all 5 (the 48 starting points)
  // classic MMOs' own numbers: 48 points to start with, then floor((lv-1)/5) + 3 at every new level; raising a stat from x
  // to x+1 costs floor((x-1)/10) + 2
  NC.statusPointsAt = (lv) => {
    let n = 48;
    for (let L = 2; L <= lv; L++) n += Math.floor((L - 1) / 5) + 3;
    return n;
  };
  NC.statCost = (x) => Math.floor((x - 1) / 10) + 2;
  NC.statSpent = (x) => { let n = 0; for (let v = 1; v < x; v++) n += NC.statCost(v); return n; };
  NC.statusLeft = (p) => NC.statusPointsAt(p.lv) - NC.STAT_KEYS.reduce((s, k) => s + NC.statSpent(p.base[k]), 0);
  // put points into a stat (n times, as far as the points go); how many went in
  NC.raiseStat = function (p, k, n) {
    let done = 0;
    while (done < (n || 1) && p.base[k] < NC.STAT_MAX && NC.statusLeft(p) >= NC.statCost(p.base[k])) { p.base[k]++; done++; }
    return done;
  };
  NC.resetStats = (p) => { p.base = Object.assign({}, NC.START_STATS); };

  // ---------------- elements (classic MMOs' ten, element level 1) ----------------
  NC.ELEMENTS = ['neutral', 'water', 'earth', 'fire', 'wind', 'poison', 'holy', 'shadow', 'ghost', 'undead'];
  NC.ELEMENT_INFO = {
    neutral: { th: 'ไม่มีธาตุ', color: '#d8cfbf' }, water: { th: 'น้ำ', color: '#5aa9ff' }, earth: { th: 'ดิน', color: '#c08a4a' },
    fire: { th: 'ไฟ', color: '#ff7a3d' }, wind: { th: 'ลม', color: '#7fd67a' }, poison: { th: 'พิษ', color: '#b36ee0' },
    holy: { th: 'ศักดิ์สิทธิ์', color: '#ffe07a' }, shadow: { th: 'มืด', color: '#8a78d8' }, ghost: { th: 'วิญญาณ', color: '#bfeaf5' },
    undead: { th: 'อมตะ', color: '#9fb38f' },
  };
  // damage % by attack element (rows) against the defender's element (columns), in NC.ELEMENTS order
  const ELEMENT_TABLE = [
    [100, 100, 100, 100, 100, 100, 100, 100, 25, 100], // neutral
    [100, 25, 100, 150, 50, 100, 75, 100, 100, 100], // water
    [100, 100, 25, 50, 150, 100, 75, 100, 100, 100], // earth
    [100, 50, 150, 25, 100, 100, 75, 100, 100, 125], // fire
    [100, 175, 50, 100, 25, 100, 75, 100, 100, 100], // wind
    [100, 100, 125, 125, 125, 0, 75, 50, 100, -25], // poison
    [100, 100, 100, 100, 100, 100, 0, 125, 100, 150], // holy
    [100, 100, 100, 100, 100, 50, 125, 0, 100, -25], // shadow
    [25, 100, 100, 100, 100, 100, 75, 75, 125, 100], // ghost
    [100, 100, 100, 100, 100, 50, 100, 0, 100, 0], // undead
  ];
  NC.ELEMENT_TABLE = ELEMENT_TABLE;
  // (negative in classic MMOs heals the target: here it just does nothing)
  NC.elementMod = (atk, def) => Math.max(0, ELEMENT_TABLE[NC.ELEMENTS.indexOf(atk || 'neutral')][NC.ELEMENTS.indexOf(def || 'neutral')] / 100);

  // ---------------- jobs and skills ----------------
  // classic MMOs' path: a traveler (like the novice, job levels up to 10) changes job at job level 10 into one of the four
  // first jobs (job levels up to 50). Each job has three skills (Q E R), an ultimate (F) and the shared passives.
  // cls: the class look (items.js NC.CLASSES) the job change puts on
  NC.JOBS = {
    traveler: { name: 'นักเดินทาง', tier: 0, maxJob: 10, hp: 5, sp: 2, cls: 'base', skills: ['q', 'e', 'r', 'starfall', 'mastery', 'body', 'mind'],
      desc: 'ผู้เริ่มต้นเดินทาง ครบทุกด้าน · Job Lv 10 เปลี่ยนอาชีพได้' },
    knight: { name: 'อัศวิน', tier: 1, maxJob: 50, hp: 7, sp: 2.5, cls: 'knight', skills: ['bash', 'magnum', 'guard', 'judgment', 'mastery', 'body', 'mind'],
      desc: 'แนวหน้า HP สูง ฟันหนัก ระเบิดเพลิง และโล่แสงป้องกัน' },
    mage: { name: 'จอมเวท', tier: 1, maxJob: 50, hp: 3.5, sp: 6, cls: 'mage', skills: ['fireball', 'thunder', 'frostdiver', 'meteor', 'mastery', 'body', 'mind'],
      desc: 'เวทธาตุ ไฟ สายฟ้า น้ำแข็ง ดาเมจหมู่รุนแรง SP สูง' },
    archer: { name: 'นักธนู', tier: 1, maxJob: 50, hp: 4.5, sp: 3, cls: 'archer', skills: ['double', 'shower', 'gale', 'starshot', 'mastery', 'body', 'mind'],
      desc: 'ยิงไกลแม่นยำ ห่าฝนธนู และลำแสงทะลวง' },
    rogue: { name: 'โจร', tier: 1, maxJob: 50, hp: 5.5, sp: 2.5, cls: 'rogue', skills: ['envenom', 'shadowstep', 'venomdust', 'sonic', 'mastery', 'body', 'mind'],
      desc: 'ว่องไว พิษ และคมเงา ฟันรัวคริติคอล' },
  };
  NC.jobMax = (p) => (NC.JOBS[p.job] || NC.JOBS.traveler).maxJob;
  NC.canChangeJob = (p) => (NC.JOBS[p.job] || NC.JOBS.traveler).tier === 0 && p.jobLv >= NC.jobMax(p);

  // skills: key (the hotbar key), type (phys / magic / best: whichever of ATK and MATK is higher / buff), element
  // (null: the weapon's), cd, sp(lv), mul(lv) (the hit's % of ATK or MATK), desc(lv, mul%). Actives start at level 1.
  const S = (o) => Object.assign({ max: 10, active: true }, o);
  NC.SKILLS = {
    // traveler
    q: S({ key: 'Q', name: 'วงเมฆทองคำ', icon: 'ic_q', type: 'phys', element: 'holy', cd: 7, sp: (lv) => 10 + lv * 2, mul: (lv) => 1.6 + lv * 0.2,
      desc: (lv, m) => `วงเวทและเมฆทองระเบิดรอบตัว ดาเมจ ${m}% ของ ATK ผลักศัตรู` }),
    e: S({ key: 'E', name: 'พุ่งใบไม้', icon: 'ic_e', type: 'phys', element: 'wind', cd: 3.5, sp: (lv) => 6 + lv, mul: (lv) => 1 + lv * 0.15,
      desc: (lv, m) => `พุ่งเป็นสายลมใบไม้ อมตะชั่วครู่ ฟันศัตรูที่ผ่าน ${m}% ของ ATK` }),
    r: S({ key: 'R', name: 'ระเบิดน้ำแข็ง', icon: 'ic_r', type: 'magic', element: 'water', cd: 9, sp: (lv) => 14 + lv * 2, mul: (lv) => 1 + lv * 0.2,
      desc: (lv, m) => `หนามน้ำแข็งผุดรอบตัว เศษน้ำแข็งกระจาย ${m}% ของ MATK ต่อชิ้น ศัตรูช้าลง` }),
    starfall: S({ key: 'F', name: 'ฝนดาวนำทาง', icon: 'sk_starfall', ult: true, type: 'phys', element: 'holy', cd: 40, sp: (lv) => 30 + lv * 3, mul: (lv) => 1.2 + lv * 0.15,
      desc: (lv, m) => `ดาวตก 12 ดวงถล่มศัตรูรอบตัว ดวงละ ${m}% ของ ATK` }),
    // knight
    bash: S({ key: 'Q', name: 'ฟันสะท้านเหล็ก', icon: 'sk_bash', type: 'phys', element: null, cd: 4, sp: (lv) => 8 + lv, mul: (lv) => 3 + lv * 0.45,
      desc: (lv, m) => `ฟาดดาบครั้งใหญ่ข้างหน้า ${m}% ของ ATK ทำให้มึน 1.2 วิ` }),
    magnum: S({ key: 'E', name: 'ระเบิดเพลิงรอบกาย', icon: 'sk_magnum', type: 'phys', element: 'fire', cd: 9, sp: (lv) => 12 + lv, mul: (lv) => 2.6 + lv * 0.4,
      desc: (lv, m) => `เปลวไฟระเบิดรอบตัว ${m}% ของ ATK ผลักศัตรู · อาวุธติดไฟ 8 วิ (ตีเป็นธาตุไฟ)` }),
    guard: S({ key: 'R', name: 'โล่แสงศักดิ์สิทธิ์', icon: 'sk_guard', type: 'buff', element: 'holy', cd: 16, sp: (lv) => 16 + lv, mul: () => 0,
      dur: (lv) => 5 + lv * 0.3, red: (lv) => Math.min(0.6, 0.3 + lv * 0.03),
      desc: (lv) => `โดมแสงคุ้มกัน ${(5 + lv * 0.3).toFixed(1)} วิ รับดาเมจลดลง ${Math.round(Math.min(0.6, 0.3 + lv * 0.03) * 100)}%` }),
    judgment: S({ key: 'F', name: 'ดาบแสงพิพากษา', icon: 'sk_judgment', ult: true, type: 'phys', element: 'holy', cd: 45, sp: (lv) => 40 + lv * 3, mul: (lv) => 6.5 + lv * 0.9,
      desc: (lv, m) => `ดาบแสงยักษ์ปักลงจากฟ้า ${m}% ของ ATK รอบจุดตก` }),
    // mage
    fireball: S({ key: 'Q', name: 'ลูกไฟ', icon: 'sk_fireball', type: 'magic', element: 'fire', cd: 2.5, sp: (lv) => 10 + lv, mul: (lv) => 1.6 + lv * 0.25,
      desc: (lv, m) => `ยิงลูกไฟระเบิดเป็นวง ${m}% ของ MATK` }),
    thunder: S({ key: 'E', name: 'สายฟ้าฟาด', icon: 'sk_thunder', type: 'magic', element: 'wind', cd: 6, sp: (lv) => 16 + lv * 2, mul: (lv) => 1.5 + lv * 0.22,
      n: (lv) => 3 + Math.floor(lv / 3), desc: (lv, m) => `สายฟ้าผ่าศัตรู ${3 + Math.floor(lv / 3)} ตัว ตัวละ ${m}% ของ MATK` }),
    frostdiver: S({ key: 'R', name: 'หอกน้ำแข็ง', icon: 'sk_frostdiver', type: 'magic', element: 'water', cd: 8, sp: (lv) => 14 + lv * 2, mul: (lv) => 1.8 + lv * 0.3,
      freeze: (lv) => 1.5 + lv * 0.1, desc: (lv, m) => `แนวหนามน้ำแข็งพุ่งไปข้างหน้า ${m}% ของ MATK แช่แข็ง ${(1.5 + lv * 0.1).toFixed(1)} วิ` }),
    meteor: S({ key: 'F', name: 'อุกกาบาตถล่ม', icon: 'sk_meteor', ult: true, type: 'magic', element: 'fire', cd: 50, sp: (lv) => 50 + lv * 4, mul: (lv) => 2.2 + lv * 0.3,
      n: (lv) => 6 + Math.floor(lv / 2), desc: (lv, m) => `อุกกาบาต ${6 + Math.floor(lv / 2)} ลูกถล่มพื้นที่ ลูกละ ${m}% ของ MATK` }),
    // archer
    double: S({ key: 'Q', name: 'ยิงคู่', icon: 'sk_double', type: 'phys', element: null, cd: 2, sp: (lv) => 8 + lv, mul: (lv) => 1.4 + lv * 0.2,
      desc: (lv, m) => `ยิงลูกธนูแสง 2 ดอกติดกัน ดอกละ ${m}% ของ ATK` }),
    shower: S({ key: 'E', name: 'ห่าฝนธนู', icon: 'sk_shower', type: 'phys', element: null, cd: 5, sp: (lv) => 12 + lv, mul: (lv) => 1.5 + lv * 0.25,
      desc: (lv, m) => `ธนู 12 ดอกตกใส่พื้นที่ข้างหน้า ดอกละ ${m}% ของ ATK` }),
    gale: S({ key: 'R', name: 'ธนูพายุทะลวง', icon: 'sk_gale', type: 'phys', element: 'wind', cd: 8, sp: (lv) => 16 + lv * 2, mul: (lv) => 2.2 + lv * 0.3,
      desc: (lv, m) => `ลูกธนูพันพายุทะลุทุกตัวในแนว ${m}% ของ ATK ผลักกระเด็น` }),
    starshot: S({ key: 'F', name: 'ธนูดาราพิฆาต', icon: 'sk_starshot', ult: true, type: 'phys', element: 'holy', cd: 45, sp: (lv) => 40 + lv * 3, mul: (lv) => 5 + lv * 0.7,
      desc: (lv, m) => `ชาร์จแล้วยิงลำแสงดาราทะลวงทั้งแนว ${m}% ของ ATK` }),
    // rogue
    envenom: S({ key: 'Q', name: 'ฟันพิษ', icon: 'sk_envenom', type: 'phys', element: 'poison', cd: 3, sp: (lv) => 8 + lv, mul: (lv) => 1.2 + lv * 0.18,
      desc: (lv, m) => `ฟันไขว้ 2 ครั้ง ครั้งละ ${m}% ของ ATK ติดพิษ 3 วิ` }),
    shadowstep: S({ key: 'E', name: 'ก้าวเงา', icon: 'sk_shadowstep', type: 'phys', element: null, cd: 6, sp: (lv) => 10 + lv, mul: (lv) => 1 + lv * 0.15,
      desc: (lv, m) => `หายตัวไปโผล่ข้างหลังศัตรู ${m}% ของ ATK · ตีปกติครั้งถัดไปคริติคอลแน่นอน` }),
    venomdust: S({ key: 'R', name: 'ม่านควันพิษ', icon: 'sk_venomdust', type: 'phys', element: 'poison', cd: 10, sp: (lv) => 16 + lv * 2, mul: (lv) => 0.35 + lv * 0.05,
      desc: (lv, m) => `ปาขวดพิษเป็นกลุ่มควัน 5 วิ ทุก 0.5 วิ ${m}% ของ ATK และติดพิษ` }),
    sonic: S({ key: 'F', name: 'พายุคมเงา', icon: 'sk_sonic', ult: true, type: 'phys', element: null, cd: 40, sp: (lv) => 38 + lv * 3, mul: (lv) => 0.8 + lv * 0.1,
      desc: (lv, m) => `วาร์ปฟันรัว 8 ครั้ง ครั้งละ ${m}% ของ ATK ปิดท้ายฟันกากบาท x2.5` }),
    // passives (every job)
    mastery: { name: 'ชำนาญอาวุธ', icon: 'ic_mastery', max: 10, desc: (lv) => `ATK +${lv * 4} (เลเวลละ +4)` },
    body: { name: 'ร่างกายแข็งแกร่ง', icon: 'ic_body', max: 10, desc: (lv) => `HP สูงสุด +${lv * 2}% · ฟื้น HP +${lv * 10}%` },
    mind: { name: 'สมาธิแน่วแน่', icon: 'ic_mind', max: 10, desc: (lv) => `SP สูงสุด +${lv * 2}% · ฟื้น SP +${lv * 10}%` },
    // the boss sets' ultimates (F while the whole set is worn: robe, cape and hat), at a set level. The shadow-looking
  // ones (like the rogue's blades) strike with the weapon's element: shadow on the shadow hollows would do nothing
    b_quake: S({ key: 'F', boss: 'horned_king', name: 'แผ่นดินถล่มราชันย์', icon: 'sk_b_quake', ult: true, type: 'best', element: 'earth', cd: 50, sp: () => 50, mul: () => 6,
      desc: (lv, m) => `กระทืบพื้น หินแหลมผุดเป็นวงรอบตัว ${m}% ของ ATK/MATK` }),
    b_ritual: S({ key: 'F', boss: 'occult_priest', name: 'พิธีกรรมแห่งความมืด', icon: 'sk_b_ritual', ult: true, type: 'best', element: null, cd: 50, sp: () => 50, mul: () => 6,
      desc: (lv, m) => `วงเวทลัทธิ มือเงาผุดขึ้นลากศัตรูเข้าหากลาง ${m}% ของ ATK/MATK` }),
    b_blades: S({ key: 'F', boss: 'shadow_knight', name: 'ดาบวิญญาณเงา', icon: 'sk_b_blades', ult: true, type: 'best', element: null, cd: 45, sp: () => 45, mul: () => 1.6,
      desc: (lv, m) => `เรียกดาบวิญญาณ 8 เล่มพุ่งใส่ศัตรู เล่มละ ${m}% ของ ATK/MATK` }),
    b_plague: S({ key: 'F', boss: 'plague_shaman', name: 'โรคระบาดดำ', icon: 'sk_b_plague', ult: true, type: 'best', element: 'poison', cd: 50, sp: () => 50, mul: () => 3,
      desc: (lv, m) => `หมอกพิษหัวกะโหลกแผ่ทั่ว ${m}% ของ ATK/MATK และพิษรุนแรง 6 วิ` }),
    b_fall: S({ key: 'F', boss: 'fallen_paladin', name: 'แสงพิพากษาสีดำ', icon: 'sk_b_fall', ult: true, type: 'best', element: 'holy', cd: 50, sp: () => 50, mul: () => 2.4,
      desc: (lv, m) => `เสาแสงดำทองถล่ม 5 ต้นเป็นกากบาท ต้นละ ${m}% ของ ATK/MATK` }),
    b_hellfire: S({ key: 'F', boss: 'infernal_warlock', name: 'วังวนเพลิงนรก', icon: 'sk_b_hellfire', ult: true, type: 'best', element: 'fire', cd: 50, sp: () => 50, mul: () => 1.2,
      desc: (lv, m) => `วังวนไฟนรกหมุนขยายรอบตัว 6 ระลอก ระลอกละ ${m}% ของ ATK/MATK` }),
  };
  for (const id in NC.SKILLS) NC.SKILLS[id].id = id;
  NC.BOSS_ULT = {};
  for (const id in NC.SKILLS) if (NC.SKILLS[id].boss) NC.BOSS_ULT[NC.SKILLS[id].boss] = id;
  NC.BOSS_ULT_LV = 5;
  NC.skillLv = (p, id) => (NC.SKILLS[id] && NC.SKILLS[id].boss ? NC.BOSS_ULT_LV : (p.skills && p.skills[id]) || 0);
  NC.freeSkillLv = (id) => (NC.SKILLS[id].active ? 1 : 0);
  NC.jobSkills = (p) => (NC.JOBS[p.job] || NC.JOBS.traveler).skills;
  NC.newSkills = (job) => { const s = {}; for (const id of (NC.JOBS[job] || NC.JOBS.traveler).skills) s[id] = NC.freeSkillLv(id); return s; };
  NC.skillLeft = (p) => (p.jobLv - 1) - NC.jobSkills(p).reduce((s, id) => s + Math.max(0, NC.skillLv(p, id) - NC.freeSkillLv(id)), 0);
  NC.raiseSkill = function (p, id) {
    const S = NC.SKILLS[id];
    if (!S || !NC.jobSkills(p).includes(id) || NC.skillLv(p, id) >= S.max || NC.skillLeft(p) <= 0) return false;
    p.skills[id] = NC.skillLv(p, id) + 1;
    return true;
  };
  // the skill on a hotbar key: the job's, or the boss set's ultimate on F while the whole set is worn
  NC.skillForKey = function (p, key) {
    const K = key.toUpperCase();
    if (K === 'F' && NC.classOf) { const b = NC.BOSS_ULT[NC.classOf(p.equip)]; if (b) return b; }
    return NC.jobSkills(p).find((id) => NC.SKILLS[id].key === K) || null;
  };
  // the job change (traveler -> a first job): job level 1, the new job's skills
  NC.changeJob = function (p, id) {
    if (!NC.JOBS[id] || NC.JOBS[id].tier !== 1) return false;
    p.job = id; p.jobLv = 1; p.jobXp = 0; p.skills = NC.newSkills(id);
    return true;
  };

  // ---------------- attack speed ----------------
  // a weapon's own speed (W.aspd: the dagger 1.35, the greatsword 0.78) times the hero's (d.aspdMul); shown like
  // classic MMOs' ASPD, 190 at most
  NC.ASPD_CAP = 2.5;
  // the stats' own share: AGI and DEX per point, at most cap (js/aspdgear.js lowers it so gear carries the speed)
  NC.ASPD_STAT = { agi: 0.008, dex: 0.0015, cap: 2 };
  NC.aspdShown = (W, mul) => Math.min(190, Math.round(200 - 50 / (((W && W.aspd) || 1) * (mul || 1))));
  NC.atkSpeed = (p, W) => ((W && W.aspd) || 1) * ((p && p.d && p.d.aspdMul) || 1);

  // ---------------- the hero's combat values (from base stats, gear, job, level and passive skills) ----------------
  // g = NC.gearStats(equip): hp, sp (flat), def, mdef (hard, %), str..luk (flat), hit, flee (flat), atk, skill, spd, cdr
  // and crit (fractions)
  NC.derive = function (p) {
    const g = p.stats || {}, b = p.base, job = NC.JOBS[p.job] || NC.JOBS.traveler, L = p.lv;
    const W = NC.ITEMS[p.equip.weapon] || {};
    const S = (k) => b[k] + (g[k] || 0);
    const str = S('str'), agi = S('agi'), vit = S('vit'), int = S('int'), dex = S('dex'), luk = S('luk');
    const lvOf = (id) => NC.skillLv(p, id);
    const ranged = W.style === 'arrow' || !!W.ranged, magic = !!W.magic; // (W.ranged: DEX weapons with other moves, js/jobs3.js)
    const main = ranged ? dex : str, side = ranged ? str : dex;
    const d = { str, agi, vit, int, dex, luk, ranged, magic };
    // status ATK (the classic formula): the main stat, its square bonus, a bit of the side stat and luck
    d.batk = main + Math.floor(main / 10) ** 2 + Math.floor(side / 5) + Math.floor(luk / 5) + lvOf('mastery') * 4;
    d.watk = W.dmg ? W.dmg.slice() : [1, 1];
    d.atkMul = 1 + (g.atk || 0);
    d.matk = [int + Math.floor(int / 7) ** 2, int + Math.floor(int / 5) ** 2];
    d.skillMul = 1 + (g.skill || 0);
    d.hit = L + dex + (g.hit || 0);
    d.flee = L + agi + (g.flee || 0);
    d.pdodge = 1 + Math.floor(luk / 10); // % (always avoids, like classic MMOs' perfect dodge)
    d.crit = Math.round(1 + luk * 0.3 + ((g.crit || 0) + (W.crit || 0)) * 100); // %
    d.def = Math.min(90, g.def || 0); // hard DEF: % less physical damage
    d.vdef = Math.floor(vit * 0.5 + (vit * vit) / 200); // soft DEF (VIT): taken off each hit
    d.mdef = Math.min(90, g.mdef || 0);
    d.imdef = Math.floor(int * 0.5);
    d.maxHp = Math.round((35 + L * job.hp + L * L * 0.04) * (1 + vit / 100) * (1 + lvOf('body') * 0.02)) + (g.hp || 0);
    d.maxSp = Math.round((10 + L * job.sp + L * L * 0.01) * (1 + int / 100) * (1 + lvOf('mind') * 0.02)) + (g.sp || 0);
    d.hpRegen = ((1 + d.maxHp / 200 + vit / 5) / 6) * (1 + lvOf('body') * 0.1); // per second
    d.spRegen = ((1 + d.maxSp / 100 + int / 6) / 4) * (1 + lvOf('mind') * 0.1);
    // attacks play this much faster: AGI above all, a little DEX (NC.ASPD_STAT); gear and buffs add to it up to
    // NC.ASPD_CAP (skilltree.js)
    const AS = NC.ASPD_STAT;
    d.aspdMul = Math.min(AS.cap, 1 + agi * AS.agi + dex * AS.dex);
    d.aspd = NC.aspdShown(W, d.aspdMul); // shown like classic MMOs' ASPD
    d.spd = g.spd || 0;
    d.cdr = Math.min(0.6, g.cdr || 0);
    d.atkElement = W.element || 'neutral';
    const robe = p.equip.robe && NC.ITEMS[p.equip.robe];
    d.armorElement = (robe && robe.element) || 'neutral';
    return d;
  };

  // ---------------- monsters ----------------
  // a species: element (its body), atkElement (its hits), how its numbers grow with its level (k = x the base curve)
  NC.MONSTERS = {
    slime: { name: 'สไลม์', element: 'water', atkElement: 'water', r: 26, hpK: 0.65, atkK: 0.75, defK: 0.4, mdefK: 1.2, agiK: 0.3, dexK: 0.5, expK: 0.8, spd: 0, aggro: 480 },
    hollow: { name: 'ฮอลโลว์', element: 'shadow', atkElement: 'neutral', r: 24, hpK: 1, atkK: 1, defK: 1, mdefK: 0.5, agiK: 0.6, dexK: 0.7, expK: 1.2, spd: 150, aggro: 560 },
  };
  // Night Camp's classic-MMO-inspired progression, fitted to our weapons and skills.
  // Bosses use an independent HP budget at their encounter level; chests retain
  // their break-open curve instead of inheriting a combat monster's health.
  NC.MONSTER_BALANCE = {
    id: 'ro-inspired-2026-09-30',
    hpAnchors: [[1, 40], [10, 140], [25, 450], [40, 1100], [60, 2200], [80, 3800], [99, 5500]],
    hpStep: 5,
    bosses: {
      bat_king: { lv: 22, hp: 8000 }, mushking: { lv: 50, hp: 55000 },
      ant_queen: { lv: 50, hp: 65000 }, crypt_lord: { lv: 55, hp: 80000 },
      lava_dragon: { lv: 99, hp: 200000 },
    },
  };
  const legacyMonsterHp = (lv) => 40 + 6 * lv + 0.15 * lv * lv;
  NC.monsterBaseHp = function (lv) {
    const L = NC.clamp(lv, 1, NC.LV_MAX), B = NC.MONSTER_BALANCE;
    for (let i = 1; i < B.hpAnchors.length; i++) {
      const [l0, hp0] = B.hpAnchors[i - 1], [l1, hp1] = B.hpAnchors[i];
      if (L <= l1) return Math.round((hp0 + (hp1 - hp0) * (L - l0) / (l1 - l0)) / B.hpStep) * B.hpStep;
    }
    return B.hpAnchors[B.hpAnchors.length - 1][1];
  };
  NC.monsterStats = function (type, lv) {
    const M = NC.MONSTERS[type], a = M.atkK * (6 + 2.2 * lv);
    const boss = NC.MONSTER_BALANCE.bosses[type];
    const hp = boss ? boss.hp * legacyMonsterHp(lv) / legacyMonsterHp(boss.lv)
      : M.hpCurve === 'chest' ? M.hpK * legacyMonsterHp(lv) : M.hpK * NC.monsterBaseHp(lv);
    const exp = Math.max(1, Math.round(NC.monsterExpBudget(lv) * M.expK));
    const jobRatio = NC.EXPERIENCE.jobRatios[type] == null ? NC.EXPERIENCE.defaultJobRatio : NC.EXPERIENCE.jobRatios[type];
    return {
      lv, name: M.name, element: M.element, atkElement: M.atkElement,
      maxHp: Math.max(1, Math.round(hp)),
      atk: [Math.round(a * 0.8), Math.round(a * 1.2)],
      def: Math.min(60, Math.round(M.defK * lv * 0.4)), vdef: Math.round(M.defK * lv * 0.3),
      mdef: Math.min(60, Math.round(M.mdefK * lv * 0.3)), imdef: Math.round(lv * 0.2),
      hit: Math.round(lv + lv * M.dexK), flee: Math.round(lv + lv * M.agiK),
      exp, jexp: Math.max(1, Math.round(exp * jobRatio)),
    };
  };
  // monster levels by map zone (the camp is where new heroes start)
  const ZONE_LV = {
    'ค่ายกลางป่า': { slime: [1, 5], hollow: [5, 10] },
    'ซากป้อมหินเก่า': { slime: [20, 26], hollow: [26, 34] },
    'ป่าตะวันออก': { slime: [40, 48], hollow: [50, 62] },
  };
  NC.spawnLevel = function (world, type, x, y) {
    const z = world && world.zones ? world.zones.find((zn) => zn.test(x, y)) : null;
    const r = (z && ZONE_LV[z.name] && ZONE_LV[z.name][type]) || [5, 10];
    return Math.round(rand(r[0], r[1]));
  };

  // ---------------- hits ----------------
  const res = (dmg, o) => Object.assign({ dmg: 0, miss: false, crit: false, mod: 1 }, o, { dmg: Math.max(0, Math.round(dmg)) });
  // the hero hitting a monster. o: kind 'phys' | 'magic', mul (the move's %), skill (a skill: gear skill %),
  // element (a skill's own; else the weapon's), flat (added magic power: the staff's own bolt)
  NC.heroHit = function (d, e, o) {
    const mod = NC.elementMod(o.element || d.atkElement, e.element);
    if (o.kind === 'magic') { // magic never misses; MDEF takes a share, then INT-less monsters' soft MDEF
      const m = rand(d.matk[0], d.matk[1]) + (o.flat || 0);
      const dmg = m * (o.mul || 1) * (o.skill ? d.skillMul : 1) * mod * (1 - e.mdef / 100) - e.imdef;
      return res(mod > 0 ? Math.max(1, dmg) : 0, { mod, magic: true });
    }
    const crit = o.crit || Math.random() * 100 < d.crit; // (o.crit: a sure critical)
    // (as in classic MMOs the hero's hit rate tops out at 100%, the floor 5%; skills aim better, +hitBonus; o.sure: an
    // ultimate never misses)
    if (!crit && !o.sure && Math.random() * 100 >= NC.clamp(80 + d.hit + (o.hitBonus || 0) - e.flee, 5, 100)) return res(0, { miss: true, mod });
    // the weapon's roll: DEX steadies it (a higher low end)
    const lo = d.watk[0] + (d.watk[1] - d.watk[0]) * Math.min(0.9, d.dex / 120);
    const atk = (d.batk + rand(lo, d.watk[1])) * d.atkMul * (o.mul || 1) * (o.skill ? d.skillMul : 1) * mod;
    const dmg = crit ? atk * 1.4 : atk * (1 - e.def / 100) - e.vdef; // a critical ignores DEF (and FLEE)
    return res(mod > 0 ? Math.max(1, dmg) : 0, { crit, mod });
  };
  // a monster hitting the hero
  NC.monsterHit = function (m, d) {
    if (Math.random() * 100 < d.pdodge) return res(0, { miss: true, lucky: true });
    if (Math.random() * 100 >= NC.clamp(80 + m.hit - d.flee, 5, 95)) return res(0, { miss: true });
    const mod = NC.elementMod(m.atkElement, d.armorElement);
    const dmg = rand(m.atk[0], m.atk[1]) * mod * (1 - d.def / 100) - d.vdef;
    return res(mod > 0 ? Math.max(1, dmg) : 0, { mod });
  };

  // ---------------- a hero's record: new, and filled in for old saves ----------------
  NC.initHero = function (p, s) {
    s = s || {};
    p.name = typeof s.name === 'string' ? s.name : p.name || '';
    p.job = NC.JOBS[s.job] ? s.job : 'traveler';
    p.base = Object.assign({}, NC.START_STATS);
    if (s.base) for (const k of NC.STAT_KEYS) if (Number.isFinite(s.base[k])) p.base[k] = NC.clamp(Math.round(s.base[k]), 1, NC.STAT_MAX);
    // a save from before job levels: its job level follows from its base level
    p.jobLv = NC.clamp(Number.isFinite(s.jobLv) ? s.jobLv : Math.floor(p.lv / 2), 1, NC.jobMax(p));
    p.jobXp = Number.isFinite(s.jobXp) && p.jobLv < NC.jobMax(p) ? s.jobXp : 0;
    NC.migrateExperience(p, s.experienceVersion);
    p.skills = NC.newSkills(p.job);
    if (s.skills) for (const id of NC.jobSkills(p)) if (Number.isFinite(s.skills[id])) p.skills[id] = NC.clamp(s.skills[id], NC.freeSkillLv(id), NC.SKILLS[id].max);
    // points spent beyond what the level gives (a bad save): back to a fresh spread
    if (NC.statusLeft(p) < 0) NC.resetStats(p);
    if (NC.skillLeft(p) < 0) p.skills = NC.newSkills(p.job);
    p.spPotions = Number.isFinite(s.spPotions) ? s.spPotions : s.lv ? 20 : p.spPotions || 0; // an old save: some to start with (a new hero: none)
  };
})();
