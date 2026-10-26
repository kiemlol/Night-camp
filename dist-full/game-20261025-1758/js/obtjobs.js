/* obtjobs.js — the first new main job lines for the open beta (the user, 2026-10-19: picked from a list of new main lines,
   "คอนเซ็ปต์ผ่านทั้ง 9 ตัว ทำชิ้นส่วนริกเข้าเกมต่อเลย"): the merchant line พ่อค้าเร่ → นายคาราวาน / เจ้าหนี้, the doctor
   line หมอหน้ากากกา → หมอยาราตรี / ผู้หว่านโรค and the bell line ผู้ตีระฆัง → ผู้เฝ้าหอระฆัง / ผู้ตีระฆังสุดท้าย.
   Here: their LOOKS (outfits, headgear, weapons, the bell shield and the two backpacks, with a class set per job in the
   bag) and the nine JOBS (NC.JOBS, what they hold, their number colours); each line's skills are in its own file
   (js/obt_merchant.js, js/obt_doctor.js, js/obt_bell.js). Their own weapon types come later; until then the weapons
   borrow the moves of existing types (strongbox = mace, bell maces = mace / hammer, canes = staff).
   Unreleased catalog source, omitted from the player page and inserted by build tools for complete catalog exports.
   Art: assets/gen/make_obtjobs_prompts.py (concepts, parts, hats, weapons, backpacks, one-garment coats) cut by
   tools/obt_cut.py: the rig parts in assets/ (the main manifest: rig_<id>_*, rig_<id>_body), the rest in
   assets/obtjobs/ + assets/obtjobs.manifest.js; the one-piece legs by tools/lower_cut.py (assets/lower). */
(function () {
  'use strict';
  const NC = window.NC;
  const ITEMS = NC.ITEMS, MAN = NC.ASSET_MANIFEST_OBTJOBS || {};
  Object.assign(NC.ASSET_MANIFEST, MAN);

  // ---------------- weapons (upright pictures, the grip at the bottom) ----------------
  const tuckHip = { grip: 0.3, ang: 1.05, at: [-9, -8], back: true };
  const tuckBack = { grip: 0.3, ang: -2.05, at: [-6, -30], back: true };
  const tuckStaff = { grip: 0.42, ang: -1.22, at: [15, -22], back: true };
  const W = (id, o) => { ITEMS[id] = Object.assign({ slot: 'weapon', sprite: 'w_' + id, rarity: 'epic' }, o); };
  const box = (o) => Object.assign({ wtype: 'mace', style: 'swing', hitK: 1.35, cd: 0.42, dur: 0.24, hitAt: 0.08, reach: 150, arc: 1.4, kb: 300, grip: 0.08,
    restAng: -1.95, stance: -0.9, tuck: tuckHip, aspd: 0.95, trailRgb: '240,215,160' }, o);
  const cane = (o) => Object.assign({ wtype: 'staff', style: 'bolt', cd: 0.34, dur: 0.22, hitAt: 0.06, range: 700, kb: 140, grip: 0.3, restAng: -1.6,
    stance: -1.15, tuck: tuckStaff, aspd: 1.05, magic: true, matkMul: 0.45 }, o);
  W('wpn_peddler', box({ name: 'หีบเหล็กพ่อค้าเร่', dmg: [40, 54], desc: 'หีบไม้หุ้มเหล็กมุมทองเหลือง ห้อยโซ่สั้น เหวี่ยงฟาดแบบลูกตุ้ม' }));
  W('wpn_caravan', box({ name: 'หีบกุญแจนายคาราวาน', rarity: 'legend', dmg: [52, 68], kb: 340, desc: 'หีบใหญ่มุมทองเหลือง แม่กุญแจหนัก โซ่หนา' }));
  W('wpn_collector', box({ name: 'หีบทองเจ้าหนี้', rarity: 'legend', dmg: [52, 68], crit: 0.08, trailRgb: '255,215,120', desc: 'หีบดำมุมทอง แม่กุญแจทอง โซ่ยาว' }));
  W('wpn_bellringer', { wtype: 'mace', name: 'คทาระฆังทองเหลือง', style: 'swing', dmg: [42, 56], hitK: 1.3, cd: 0.42, dur: 0.24, hitAt: 0.08, reach: 165,
    arc: 1.4, kb: 300, grip: 0.14, restAng: -1.95, stance: -0.9, tuck: tuckBack, aspd: 0.95, trailRgb: '255,225,150', desc: 'ระฆังทองเหลืองใบเล็กบนด้ามไม้ยาว ตีแล้วดังกังวาน' });
  W('wpn_bellward', { wtype: 'mace', name: 'คทาระฆังผู้เฝ้าหอ', rarity: 'legend', style: 'swing', dmg: [54, 70], hitK: 1.4, cd: 0.46, dur: 0.26, hitAt: 0.09,
    reach: 170, arc: 1.4, kb: 340, grip: 0.14, restAng: -1.95, stance: -0.9, tuck: tuckBack, aspd: 0.9, trailRgb: '255,215,140', desc: 'ระฆังทองเหลืองใบใหญ่บนด้ามรัดปลอก ถือคู่โล่' });
  W('wpn_lasttoll', { wtype: 'hammer', name: 'ระฆังเหล็กดำร้าว', rarity: 'legend', style: 'smash', dmg: [70, 92], hitK: 1.8, cd: 0.6, dur: 0.34, hitAt: 0.16,
    reach: 175, arc: 1.5, kb: 400, grip: 0.16, restAng: -1.9, stance: -1.1, twoHanded: true, grip2: 12, behind: true, tuck: tuckBack, aspd: 0.85,
    trailRgb: '170,225,255', desc: 'ระฆังเหล็กดำขอบเงิน มีรอยร้าว ถือสองมือ เสียงสุดท้ายที่มอนได้ยิน' });
  W('wpn_crowdoc', cane({ name: 'ไม้เท้าหัวกา', dmg: [30, 40], stats: { int: 2 }, desc: 'ไม้เท้าดำ ด้ามหัวกาเงิน' }));
  W('wpn_apothecary', cane({ name: 'คทาขวดยาเรืองแสง', rarity: 'legend', dmg: [36, 46], stats: { int: 3, skill: 0.1 }, desc: 'คทาเงินยอดเป็นขวดยาสีมิ้นต์ในกรงเงิน' }));
  W('wpn_plaguer', cane({ name: 'ไม้เท้าขวดพิษ', rarity: 'legend', dmg: [38, 48], element: 'poison', stats: { int: 3 }, desc: 'ไม้เท้าไม้บิดเกลียว ปลายเป็นขวดพิษเขียวเดือดปุด' }));
  ITEMS.sh_bellward = { slot: 'shield', name: 'โล่ปากระฆัง', sprite: 'w_sh_bellward', rarity: 'legend', stats: { def: 14, mdef: 4, vit: 1 },
    desc: 'โล่ทองเหลืองทรงปากระฆังใบใหญ่ ขอบหนา หมุดรอบ' };

  // ---------------- the backpacks (cape slot: hung from the neck behind the body, avatar.js cloth()) ----------------
  ITEMS.back_peddler = { slot: 'cape', name: 'เป้สินค้าพ่อค้าเร่', sprite: 'back_peddler', rarity: 'epic', stats: { vit: 1 }, desc: 'เป้โครงไม้ อัดสินค้าเต็ม พรม หม้อ ลังไม้ โหลเมือก' };
  ITEMS.back_caravan = { slot: 'cape', name: 'เป้ม้วนแผนที่', sprite: 'back_caravan', rarity: 'legend', stats: { vit: 1 }, desc: 'เป้หนังใบเล็ก มัดกระบอกแผนที่กับผ้าห่ม' };

  // ---------------- outfits, headgear, class sets ----------------
  // job: [name, 1st job (null) or the 1st job it comes from, weapon, shield, back, [top, pants, hat] as [name, stats, text]]
  const JOBS = {
    peddler: ['พ่อค้าเร่', null, 'wpn_peddler', null, 'back_peddler',
      [['เสื้อคลุมพ่อค้าเร่', { def: 7, vit: 1, luk: 1 }, 'เสื้อคลุมเดินทางสีเขียวขี้ม้าปะชุน สายหนังคาดอก ผ้าพันคอฟ้าอมเขียว ถุงเหรียญที่เอว'],
        ['กางเกงปะเข่าพ่อค้าเร่', { def: 5, vit: 1 }, 'กางเกงน้ำตาลปะเข่า รองเท้าบูทผูกเชือก'],
        ['หมวกปีกกว้างพ่อค้าเร่', { def: 2, luk: 1 }, 'หมวกผ้านุ่มปีกกว้างสีน้ำตาล ป้ายทองเหลืองกลม']]],
    caravan: ['นายคาราวาน', 'peddler', 'wpn_caravan', null, 'back_caravan',
      [['โค้ตนายคาราวาน', { def: 11, vit: 2 }, 'โค้ตเดินทางสีฟ้าอมเขียวเข้ม กระดุมทองเหลือง คอขนสัตว์ เข็มทิศกับพวงกุญแจที่เข็มขัด'],
        ['กางเกงบูทขี่ม้า', { def: 6, vit: 1 }, 'กางเกงเทาน้ำตาล บูทหนังสูงถึงเข่า หัวเข็มขัด'],
        ['หมวกคาราวานปีกพับ', { def: 3, vit: 1 }, 'หมวกปีกกว้างสีฟ้าอมเขียว ปีกพับขึ้นข้าง หัวเข็มขัดทองเหลือง']]],
    collector: ['เจ้าหนี้', 'peddler', 'wpn_collector', null, null,
      [['โค้ตดำเจ้าหนี้', { def: 9, str: 2, luk: 1 }, 'โค้ตดำคอตั้งขอบทอง เสื้อกั๊กแดงเลือดหมู สายนาฬิกาทองพาดอก สมุดบัญชีห้อยเอว'],
        ['กางเกงลายแดงเจ้าหนี้', { def: 5, luk: 1 }, 'กางเกงดำริ้วแดง บูทหนังขัดมันหัวทอง'],
        ['หมวกทรงสูงเหรียญทอง', { def: 3, luk: 2 }, 'หมวกทรงสูงสีดำ แถบแดง เหน็บเหรียญทองสามเหรียญ']]],
    crowdoc: ['หมอหน้ากากกา', null, 'wpn_crowdoc', null, null,
      [['โค้ตหนังหมอหน้ากากกา', { def: 6, int: 1, vit: 1 }, 'โค้ตหนังเคลือบขี้ผึ้งสีน้ำตาลเข้ม ผ้าคลุมบ่าสั้น ผ้าพันคอแดง ขวดยาสามสีเรียงที่เข็มขัด'],
        ['กางเกงบูทหมอหน้ากากกา', { def: 4, vit: 1 }, 'กางเกงเทาเข้ม บูทหนังสูงหัวเข็มขัด'],
        ['หมวกหน้ากากกา', { def: 2, int: 1, dex: 1 }, 'หมวกปีกกว้างสีดำ หน้ากากปากกาสีขาวดันขึ้นไว้บนหมวก']]],
    apothecary: ['หมอยาราตรี', 'crowdoc', 'wpn_apothecary', null, null,
      [['เสื้อกาวน์หมอยาราตรี', { def: 8, int: 2, dex: 1 }, 'เสื้อกาวน์ยาวสีงาช้าง ขอบฟ้าอมเขียว สายขวดยาเรืองมิ้นต์ไขว้อก กระเป๋าสมุนไพร'],
        ['กางเกงบูทขาวหมอยา', { def: 5, int: 1 }, 'กางเกงเทา บูทสีงาช้างหัวเข็มขัดหนัง'],
        ['หมวกขาวหน้ากากกา', { def: 3, int: 2 }, 'หมวกปีกกว้างสีงาช้าง ขนนกฟ้าอมเขียว หน้ากากกาขาวตาแก้วฟ้าดันขึ้นไว้']]],
    plaguer: ['ผู้หว่านโรค', 'crowdoc', 'wpn_plaguer', null, null,
      [['โค้ตขาดวิ่นผู้หว่านโรค', { def: 8, int: 2, agi: 1 }, 'โค้ตม่วงดำขาดวิ่น ด้ายเย็บสีเขียวพิษ คราบพิษ ขวดแตกห้อยเข็มขัด'],
        ['กางเกงคราบพิษ', { def: 5, int: 1 }, 'กางเกงดำเปื้อนคราบเขียว บูทดำหัวเข็มขัด'],
        ['ฮู้ดหน้ากากกาม่วง', { def: 3, int: 2 }, 'ฮู้ดดำขาดวิ่น หน้ากากกาม่วงเข้มตาแก้วเขียวพิษดันขึ้นไว้บนฮู้ด']]],
    bellringer: ['ผู้ตีระฆัง', null, 'wpn_bellringer', null, null,
      [['เสื้อโค้ตผู้ตีระฆัง', { def: 7, str: 1, vit: 1 }, 'โค้ตสั้นสีน้ำเงินหินชนวน กระดุมทองเหลือง เชือกระฆังขดพาดบ่าหลัง ค้อนตั้งเสียงที่เข็มขัด'],
        ['กางเกงพันแข้งผู้ตีระฆัง', { def: 5, vit: 1 }, 'กางเกงน้ำตาล บูทผูกเชือก ผ้าพันแข้งหนัง'],
        ['หมวกหนังครอบหู', { def: 3, vit: 1 }, 'หมวกหนังบุนวม ที่ครอบหูทองเหลืองกลมใหญ่ กันเสียงระฆัง']]],
    bellward: ['ผู้เฝ้าหอระฆัง', 'bellringer', 'wpn_bellward', 'sh_bellward', null,
      [['เกราะทองเหลืองผู้เฝ้าหอ', { def: 14, vit: 3 }, 'เกราะอกทองเหลือง บ่าเกราะทรงระฆังใบเล็ก ผ้าพันคอกรมท่า เสื้อตัวในน้ำเงินหินชนวน'],
        ['สนับแข้งทองเหลือง', { def: 7, vit: 1 }, 'สนับแข้งและสนับเข่าทองเหลือง บูทหนัก'],
        ['หมวกเกราะทรงระฆัง', { def: 5, vit: 2 }, 'หมวกเกราะทองเหลืองทรงระฆังใบเล็ก ขอบหนา เปิดหน้า']]],
    lasttoll: ['ผู้ตีระฆังสุดท้าย', 'bellringer', 'wpn_lasttoll', null, null,
      [['โค้ตคืนเที่ยงผู้ตีระฆังสุดท้าย', { def: 10, str: 2, dex: 1 }, 'โค้ตยาวสีน้ำเงินเที่ยงคืน ขอบเทาเงิน ผ้าพันคอเทาอ่อน กระดิ่งเงินสามใบที่เข็มขัด'],
        ['กางเกงหัวเข็มขัดเงิน', { def: 5, str: 1 }, 'กางเกงดำ บูทดำหัวเข็มขัดเงิน'],
        ['หมวกปีกกว้างกระดิ่งเงิน', { def: 3, str: 1, dex: 1 }, 'หมวกปีกกว้างดำ ริบบิ้นเทาปลิว กระดิ่งเงินห้อยปีกหมวก']]],
  };
  const hatWear = (id) => (MAN[id] && MAN[id].wear) || { fit: 1.35, seat: 0.4, clip: true };
  const sets = [], ids = [];
  for (const id in JOBS) {
    const [name, from, weapon, shield, back, look] = JOBS[id];
    const [top, pants, hat] = look, rarity = from ? 'legend' : 'epic';
    ITEMS['top_' + id] = { slot: 'top', name: top[0], rig: id, rarity, stats: top[1], desc: top[2] };
    ITEMS['pants_' + id] = { slot: 'pants', name: pants[0], rig: id, rarity, stats: pants[1], desc: pants[2] };
    const w = hatWear('hat_' + id);
    ITEMS['hat_' + id] = { slot: 'hat', name: hat[0], sprite: 'hat_' + id, rarity, stats: hat[1], desc: hat[2], fit: w.fit, seat: w.seat, dx: 0, clip: w.clip, soft: 0.3 };
    sets.push({ id, name, icon: 'hat_' + id, items: { hair: 'hair_spiky', robe: null, cape: back, top: 'top_' + id, pants: 'pants_' + id, hat: 'hat_' + id, weapon, shield } });
    ids.push('top_' + id, 'pants_' + id, 'hat_' + id, weapon);
    if (shield) ids.push(shield);
    if (back) ids.push(back);
  }
  const bw = hatWear('hat_beakmask');
  ITEMS.hat_beakmask = { slot: 'hat', name: 'หน้ากากกาดันขึ้นหัว', sprite: 'hat_beakmask', rarity: 'fashion', stats: {}, desc: 'หน้ากากปากกาสีขาว แว่นทองเหลือง สวมดันขึ้นไว้บนหัว',
    fit: bw.fit, seat: bw.seat, dx: 0, clip: bw.clip, soft: 0.3 };
  ids.push('hat_beakmask');
  // (a picture not cut yet: the item would draw nothing and the Lab lists every item, so keep only what has its art)
  for (const id of ids) {
    const it = ITEMS[id], spr = it && (it.sprite || ('rig_' + it.rig + '_torso'));
    if (it && !NC.ASSET_MANIFEST[spr]) delete ITEMS[id];
  }
  const live = sets.filter((s) => ITEMS[s.items.top]);
  const at = NC.CLASSES.findIndex((c) => c.id === 'windsamurai');
  NC.CLASSES.splice(at < 0 ? NC.CLASSES.length : at + 1, 0, ...live.filter((s) => !NC.CLASSES.some((c) => c.id === s.id)));
  if (NC.ITEM_ORDER) for (const id of ids) if (ITEMS[id] && !NC.ITEM_ORDER.includes(id)) NC.ITEM_ORDER.push(id);

  // ---------------- the jobs (the user, 2026-10-19: "เริ่มทำอาชีพและสกิลของ 3 สายนี้ ... ต่อเลย") ----------------
  // their skills, lines and weapon rules: js/obt_merchant.js, js/obt_doctor.js, js/obt_bell.js (loaded right after this,
  // before rotiming.js). id: [hp, sp, text, the number colour (dmgburst.js)]
  const JOBDEF = {
    peddler: [6.5, 2.5, 'พ่อค้าแบกเป้ เหวี่ยงหีบเหล็กห้อยโซ่ ปาสินค้าในเป้ใส่มอน ของที่ปาเป็นธาตุตามวัสดุของมอนตัวนั้น ขยะในกระเป๋าจึงมีค่า', '#e8b25a'],
    caravan: [7.5, 3, 'นายคาราวาน เรียกด้วงขนของมาช่วยรับดาเมจและพุ่งชน ตั้งจุดพักกลางทุ่งให้ปาร์ตี้ฟื้นเลือดและแจกเสบียง', '#4fc3b0'],
    collector: [6, 3, 'เจ้าหนี้ จดหนี้ลงบนตัวมอน หนี้ยิ่งมากยิ่งโดนแรง แล้วทวงหนี้ระเบิดทีเดียว สกิลแรงสุดเผาเหรียญจริงแลกพลัง', '#ffd35a'],
    crowdoc: [4.5, 5, 'หมอหน้ากากกา ขวดยาขวดเดียว โดนเพื่อนเป็นยารักษา โดนมอนเป็นพิษ ติด "ไข้" ที่ลามไปตัวข้าง ๆ ตอนมอนตาย', '#9be37a'],
    apothecary: [4.5, 6, 'หมอยาราตรี สายรักษา ขวดยาเรืองแสงกระเด้งรักษาเพื่อนทีละคน สวนสมุนไพร ฟองยาคุ้มกัน และฝนยาทั้งปาร์ตี้', '#7ff0d0'],
    plaguer: [4, 5.5, 'ผู้หว่านโรค สายพิษ เมฆพิษ ขวดพิษกระจาย ไข้ลามทั้งฝูง แล้วระเบิดโรคระบาดทีเดียวทั้งจอ', '#c6e63c'],
    bellringer: [6.5, 3, 'ผู้ตีระฆัง ตีเป้าเดิมนับเสียง ครบสามครั้งเกิดคลื่นเสียงใหญ่ เสียงสะท้อนเด้งต่อตัวข้าง ๆ ทำให้มอนมึน', '#f0c060'],
    bellward: [8, 3, 'ผู้เฝ้าหอระฆัง สายแทงก์ ระฆังยักษ์ครอบตัวรับดาเมจ เรียกมอนมาหาตัวเอง โล่ปากระฆังกระแทก คุ้มครองทั้งปาร์ตี้', '#ffb84a'],
    lasttoll: [6, 3, 'ผู้ตีระฆังสุดท้าย ปิดท้ายมอนเลือดน้อย นับถอยหลังสามจังหวะแล้วตีแรงตามเลือดที่หายไป ฆ่าได้แล้วเกิดเสียงสุดท้ายรอบตัว', '#9fe8ff'],
  };
  for (const id in JOBDEF) {
    const [hp, sp, desc] = JOBDEF[id], from = JOBS[id][1];
    NC.JOBS[id] = from ? { name: JOBS[id][0], tier: 2, from, maxJob: 50, hp, sp, cls: id, skills: [], desc, admin: true }
      : { name: JOBS[id][0], tier: 1, maxJob: 50, hp, sp, cls: id, skills: [], desc, admin: true };
  }
  // what each holds (a 2nd job also holds its 1st job's): the strongbox and the bell maces are maces, the canes staffs,
  // the black bell a hammer (their own weapon types and moves come with the rig work)
  if (NC.JOB_WEAPONS) Object.assign(NC.JOB_WEAPONS, { peddler: ['mace'], caravan: [], collector: [], crowdoc: ['staff'], apothecary: [], plaguer: [],
    bellringer: ['mace'], bellward: [], lasttoll: ['hammer'] });
  if (NC.STARTER_WEAPONS) for (const [t, w] of [['mace', 'wpn_peddler'], ['staff', 'wpn_crowdoc'], ['hammer', 'wpn_lasttoll']]) if (!NC.STARTER_WEAPONS[t]) NC.STARTER_WEAPONS[t] = w;
  // (the number colours: dmgburst.js loads later; its table is read on every number)
  const baseInit = NC.HUD && NC.HUD.init;
  if (baseInit) NC.HUD.init = function () {
    if (NC.DmgFX && NC.DmgFX.JOBCOL) for (const id in JOBDEF) NC.DmgFX.JOBCOL[id] = JOBDEF[id][3];
    // each job's damage x (js/rebalance.js NC.JOB_POWER, read on every hit; measured with tools/balance.js 2026-10-20:
    // 1st jobs ~1,300 single-target, damage 2nd jobs ~3,000, the tanks ~1,900, the healer ~1,700 — the healer's damage is
    // mostly the 1st job's injection, so its power is cut)
    if (NC.JOB_POWER) Object.assign(NC.JOB_POWER, { bellringer: 1.2, caravan: 1.3, collector: 1.2, apothecary: 0.6, plaguer: 0.82, bellward: 1.35, lasttoll: 1.1 });
    return baseInit.apply(this, arguments);
  };
  // ---------------- the skills' painted pieces (assets/obtjobs/fx_*: Codex, tools/obt_cut.py fx) ----------------
  // the rule (the user, 2026-10-07/12/14): every effect PIECE is a painted picture; code only moves, times and tints
  // them (and the game's own vfx.js helpers, recoloured). A piece not cut yet is simply not drawn.
  const has = (n) => !!(NC.SPR && NC.SPR[n] && NC.SPR[n].img);
  // (the pieces are anchored at their middle; o.ground: (x, y) is where its bottom stands, a crate or a bell on the ground)
  const piece = (ctx, name, x, y, o) => {
    if (!has(name)) return;
    const s = NC.SPR[name];
    NC.drawSpr(ctx, name, x, o && o.ground ? y - s.h * (1 - (s.ay === undefined ? 0.5 : s.ay)) * ((o && o.scale) || 1) : y, o);
  };
  NC.FX.def('obtpiece', (ctx, q, u) => q.draw(ctx, q, u), 'sorted');
  const FXK = {
    has, piece,
    // a piece lobbed from `from` to `to` (K.shot's lob), spinning; land(x, y) where it comes down
    lob(game, p, id, o) {
      const K = NC.SkillKit, from = o.from || K.hand(p);
      return K.shot(game, p, id, { from, to: o.to, arc: o.arc || 130, dur: o.dur || 0.42, spin: o.spin === undefined ? 9 : o.spin, rgb: o.rgb,
        look(ctx, q) { piece(ctx, o.name, q.x, q.y, { scale: o.scale || 1, rot: q.rot }); },
        end() { if (o.land) o.land(o.to[0], o.to[1]); } });
    },
    // a piece that stays on the ground a while (depth-sorted among the characters), fading in and out
    stay(name, x, y, life, o) {
      o = o || {};
      return NC.FX.add({ type: 'obtpiece', layer: 'sorted', x, y, life, draw(ctx, q, u) {
        const a = Math.min(1, u * life * 6, (1 - u) * life * 3);
        piece(ctx, name, q.x, q.y + (o.dy || 0), { scale: (o.scale || 1) * (1 + (o.pulse || 0) * Math.sin(q.t * 6)), alpha: a * (o.alpha || 1), flip: o.flip, ground: o.ground !== false });
      } });
    },
    // a piece that pops up at (x, y) and fades (a burst, a splash): grows from k0 to k1
    pop(name, x, y, o) {
      o = o || {};
      const life = o.life || 0.45;
      return NC.FX.add({ type: 'obtpiece', layer: o.layer || 'high', x, y, life, draw(ctx, q, u) {
        const k = (o.k0 || 0.6) + ((o.k1 || 1.1) - (o.k0 || 0.6)) * Math.sqrt(u);
        piece(ctx, name, q.x, q.y, { scale: k * (o.scale || 1), alpha: (1 - u * u) * (o.alpha || 1), rot: o.rot || 0, flip: o.flip });
      } });
    },
  };
  NC.OBTJOBS = { jobs: JOBS, sets: live, def: JOBDEF, fx: FXK };
})();
