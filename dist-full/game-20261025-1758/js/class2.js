/* class2.js — the 2nd jobs (คลาส 2): at Job Lv 50 every 1st job branches in two (the user asked "ทำคราส 2 ของทุกอาชีพ
   แล้วแตกสายได้อีก"):
     อัศวิน -> พาลาดิน / อัศวินมังกร     จอมเวท -> อาร์คเมจ / วอร์ล็อกตะเกียง     นักธนู -> เรนเจอร์ / นักล่าหมาป่า
     โจร -> นักฆ่า / นินจา                พระ -> บิชอป / นักพรต
   This file holds the data: each branch's outfit (top / pants / shoes on its own rig), headgear and weapon, its class set
   and its job (tier 2, `from` its 1st job, 10 skills of its own; skilltree.js adds the 1st job's). The skills themselves
   are in class2_skills_a/b/c.js, the job change and the skill window in skilltree.js / skillui.js.
   Loaded after priest.js and before items.js (items.js merges NC.CLASS2.items). Art: assets/class2/ +
   assets/class2.manifest.js (Codex sheets cut with rigcut / splitparts / cutout / hud_icons), merged into the main
   manifest here. Hoods and helmets show the face through their opening (the hair above the band is cut away under
   them); the ninja's and the monk's headbands hang their back half behind the head (rimBehind). */
(function () {
  'use strict';
  const NC = window.NC;
  if (NC.ASSET_MANIFEST_CLASS2) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_CLASS2);

  const band = (y) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => [+(i / 12).toFixed(3), y]);
  // job: [name, 1st job, hair, weapon, hp, sp, look {top, pants, shoes, hat names + stats}, hat fit, job text]
  const JOBS2 = {
    paladin: ['พาลาดิน', 'knight', 'hair_spiky', 'sword', 8.5, 3,
      [['เกราะพาลาดิน', { def: 16, mdef: 4, vit: 3 }, 'เกราะเงินขลิบทอง ตราตะวันที่อก ผ้าพันคอและผ้าคลุมแดง'],
        ['สนับขาพาลาดิน', { def: 9, vit: 1 }, 'สนับเข่าทอง ขาเกราะเงิน'],
        ['รองเท้าเหล็กพาลาดิน', { def: 5 }, 'รองเท้าเกราะเงิน หัวรองเท้าทอง'],
        ['หมวกปีกพาลาดิน', { def: 7, mdef: 2, vit: 1 }, 'หมวกเงินปีกขาว พู่แดง บังหน้าผากทอง']],
      { fit: 1.63, seat: 0.477, dx: -0.29, clip: true, soft: 0.15 },
      'อัศวินศักดิ์สิทธิ์ แนวหน้าที่ทนที่สุด โล่ป้องกันทั้งทีม สะท้อนดาเมจ และรักษาได้ · สายแทงก์'],
    dragonknight: ['อัศวินมังกร', 'knight', 'hair_spiky', 'spear', 8, 2.5,
      [['เกราะเกล็ดมังกร', { def: 15, str: 3 }, 'เกราะเหล็กน้ำเงินเข้ม ลายเกล็ดมังกรแดง ผ้าคลุมหางเปลวไฟ'],
        ['สนับขาเกล็ดมังกร', { def: 8, str: 1 }, 'ขาเกราะเกล็ดขอบแดง'],
        ['รองเท้าเกล็ดมังกร', { def: 5, agi: 1 }, 'รองเท้าเหล็กเข้ม ขลิบแดง'],
        ['หมวกหัวมังกร', { def: 6, str: 2 }, 'หมวกเหล็กทรงหัวมังกร เขาโค้ง หงอนแดง']],
      { fit: 1.34, seat: 0.422, dx: -0.165, clip: true, soft: 0.15 },
      'นักรบหอกเพลิงมังกร พุ่งทะลวง กระโดดกระแทก พ่นไฟ และเรียกไวเวิร์นมาช่วย · สายดาเมจระเบิด'],
    archmage: ['อาร์คเมจ', 'mage', 'hair_spiky', 'staff_moon', 4, 7.5,
      [['เสื้อคลุมอาร์คเมจ', { def: 4, mdef: 12, int: 3 }, 'เสื้อคลุมกรมท่าขลิบทอง ลายดาวและจันทร์เสี้ยว เข็มกลัดอัญมณีฟ้า'],
        ['ชายเสื้อคลุมดาว', { def: 2, mdef: 6, int: 1 }, 'ชายเสื้อคลุมยาว ลายดาวทอง'],
        ['รองเท้าอาร์คเมจ', { def: 1, mdef: 4 }, 'รองเท้ากรมท่านุ่มเบา'],
        ['หมวกพ่อมดจันทรา', { mdef: 6, int: 3 }, 'หมวกพ่อมดปีกกว้าง ตราจันทร์เสี้ยวทอง ผลึกฟ้าห้อยปลาย']],
      // (the picture showed the hat's dark inside where the face goes: it is cut open, the hair is not cut, and the
      // inside lining below the rim line (the top of the opening) is drawn behind the head, so no dark band crosses it)
      { fit: 1.55, seat: 0.47, dx: 0, clip: false, soft: 0.4, art: 2, rimBehind: true,
        rim: [[0.0, 0.7643], [0.0312, 0.7643], [0.0625, 0.7643], [0.0938, 0.7643], [0.125, 0.7643], [0.1562, 0.7643], [0.1875, 0.7643], [0.2188, 0.7643], [0.25, 0.7643], [0.2812, 0.7643], [0.3125, 0.7643], [0.3438, 0.7643], [0.375, 0.7643], [0.4062, 0.7357], [0.4375, 0.7143], [0.4688, 0.7], [0.5, 0.6857], [0.5312, 0.6714], [0.5625, 0.6571], [0.5938, 0.6429], [0.625, 0.6286], [0.6562, 0.6214], [0.6875, 0.6071], [0.7188, 0.6], [0.75, 0.6071], [0.7812, 0.61], [0.8125, 0.61], [0.8438, 0.61], [0.875, 1.2], [0.9062, 1.2], [0.9375, 1.2], [0.9688, 1.2], [1.0, 1.2]] },
      'ปราชญ์เวทธาตุ มิสไซล์จันทรา พายุหิมะ สายฟ้าลูกโซ่ หลุมดำ · สายดาเมจเวทหมู่'],
    warlock: ['วอร์ล็อกตะเกียง', 'mage', 'hair_spiky', 'staff_lantern', 4.5, 7,
      [['เสื้อคลุมวอร์ล็อก', { def: 5, mdef: 10, int: 3 }, 'เสื้อคลุมม่วงเข้ม รูนเรืองแสงสีเขียวน้ำทะเล ขวดยาเรืองแสงที่เอว'],
        ['ชายเสื้อคลุมรูน', { def: 3, mdef: 5, dex: 1 }, 'ชายผ้าขาดรุ่ย รูนเรืองแสง'],
        ['รองเท้าวอร์ล็อก', { def: 2, mdef: 3 }, 'รองเท้าหนังสีเข้ม'],
        ['หมวกเขาวิญญาณ', { mdef: 5, int: 2, dex: 1 }, 'ฮู้ดม่วงปลายแหลม เขาดำคู่ ตราไฟวิญญาณ']],
      { fit: 1.31, seat: 0.422, dx: -0.205, clip: true, soft: 0.3 },
      'ผู้ใช้ตะเกียงวิญญาณ สาปศัตรูให้อ่อนแอ เผาวิญญาณต่อเนื่อง เรียกวิญญาณกับภูตตะเกียงมาช่วยสู้ · สายสาปและซัมมอน'],
    ranger: ['เรนเจอร์', 'archer', 'hair_brown', 'bow', 5.5, 3.5,
      [['เสื้อเรนเจอร์ใบไม้', { def: 7, dex: 3 }, 'เสื้อเขียวป่า ผ้าคลุมไหล่ทรงใบไม้ เกราะอกหนัง'],
        ['กางเกงเรนเจอร์', { def: 4, agi: 2 }, 'กางเกงเขียวเข้ม'],
        ['รองเท้าบูทเรนเจอร์', { def: 3, agi: 1 }, 'บูทหนังรัดสายสูง'],
        ['ฮู้ดเรนเจอร์', { def: 3, dex: 2 }, 'ฮู้ดผ้าเขียว ขนนกเสียบข้าง']],
      { fit: 1.31, seat: 0.422, dx: -0.193, clip: true, soft: 0.25 },
      'พรานแม่นธนู วางกับดักระเบิดและน้ำแข็ง ยิงสไนป์คริติคอลแรง · สายยิงไกลและกับดัก'],
    wolfhunter: ['นักล่าหมาป่า', 'archer', 'hair_brown', 'bow', 6, 3.5,
      [['เสื้อขนหมาป่า', { def: 9, dex: 2, vit: 1 }, 'ผ้าคลุมไหล่ขนหมาป่าหนา เสื้อหนังทับเสื้อเขียว'],
        ['กางเกงนักล่า', { def: 5, dex: 1 }, 'กางเกงหนังสีน้ำตาล'],
        ['รองเท้าขนหมาป่า', { def: 3, agi: 1 }, 'บูทหนังขลิบขนเทา'],
        ['ฮู้ดหัวหมาป่า', { def: 4, dex: 2, luk: 1 }, 'ฮู้ดหนังหมาป่าเทา หูตั้ง หน้าหมาป่าใจดี']],
      { fit: 1.16, seat: 0.422, dx: -0.111, clip: true, soft: 0.2 },
      'นักล่าคู่หมาป่า เรียกหมาป่าคู่ใจที่ยิ่งอัพสกิลยิ่งตัวโตและเก่งขึ้น สั่งขย้ำ หอนเสริมพลัง · สายซัมมอน'],
    assassin: ['นักฆ่า', 'rogue', 'hair_spiky', 'dagger', 6.5, 3,
      [['ชุดหนังนักฆ่า', { def: 8, agi: 3 }, 'เกราะหนังดำขลิบแดง สายคาดอกเสียบมีดบิน ผ้าพันคอแดงยาว'],
        ['กางเกงนักฆ่า', { def: 4, luk: 2 }, 'กางเกงเทาเข้ม'],
        ['รองเท้านักฆ่า', { def: 3, agi: 2 }, 'รองเท้าดำสายรัดแดง'],
        ['ฮู้ดนักฆ่า', { def: 3, agi: 1, luk: 1 }, 'ฮู้ดผ้าดำขอบแดง เข็มกลัดเงิน']],
      { fit: 1.16, seat: 0.422, dx: -0.1, clip: true, soft: 0.2 },
      'นักฆ่าเงามืด มีดคู่คริติคอล อำพรางกาย อาบพิษมรณะ · สายดาเมจเป้าเดียวสูงสุด'],
    shinobi: ['นินจา', 'rogue', 'hair_spiky', 'dagger', 6, 3.5,
      [['ชุดนินจา', { def: 7, agi: 2, dex: 1 }, 'เสื้อนินจาเทาเข้ม เกราะไหล่เหล็ก ชูริเคนที่เข็มขัด ผ้าพันคอแดงยาวมาก'],
        ['กางเกงนินจา', { def: 4, agi: 1 }, 'กางเกงพันแข้ง'],
        ['รองเท้านินจา', { def: 3, agi: 2 }, 'รองเท้าแยกนิ้วแบบนินจา'],
        ['ผ้าคาดหัวนินจา', { def: 2, agi: 2, luk: 1 }, 'ผ้าคาดหัวแดง แผ่นเหล็กหน้าผาก หางผ้ายาวปลิว']],
      { fit: 1.14, seat: 0.518, dx: -0.228, clip: false, soft: 0, rimBehind: true, rim: band(0.47) },
      'นินจาผู้ใช้คาถา คุไนระเบิด แยกเงาร่าง คาถาไฟและสายฟ้า หลบเก่ง · สายคล่องตัว'],
    bishop: ['บิชอป', 'priest', 'hair_spiky', 'staff_holy', 5, 7,
      [['ชุดบิชอป', { def: 4, mdef: 10, int: 3, sp: 30 }, 'ชุดพิธีขาวแผงหน้าทอง ตราตะวัน ผ้าสโตลสีน้ำเงิน'],
        ['ชายเสื้อบิชอป', { def: 2, mdef: 5, vit: 1 }, 'ชายเสื้อขาวยาวแถบทอง'],
        ['รองเท้าบิชอป', { def: 1, mdef: 3 }, 'รองเท้าขาวทอง'],
        ['หมวกไมเตอร์', { mdef: 6, int: 3, sp: 20 }, 'หมวกไมเตอร์ทรงสูงขาวขลิบทอง ตราตะวัน']],
      // (the picture showed the mitre's inside from below: it floated over the head. The inside is cut open in the
      // picture, so it sits ON the head with the hair showing under its band; centred: at dx -0.2 it hung off the back)
      { fit: 1.28, seat: 0.5, dx: -0.05, clip: false, soft: 0.3, art: 2 },
      'นักบวชชั้นสูง ฮีลหมู่ บาเรียดูดซับดาเมจ เขตศักดิ์สิทธิ์ บัฟทั้งทีม · สายซัพพอร์ต'],
    monk: ['นักพรต', 'priest', 'hair_spiky', 'staff_bo', 7.5, 4,
      [['ชุดกังฟู', { def: 8, str: 2, vit: 2 }, 'เสื้อกังฟูสีครีม ขอบเขียวน้ำทะเล กระดุมจีน ผ้าคาดเอวน้ำตาล'],
        ['กางเกงกังฟู', { def: 5, str: 1, agi: 1 }, 'กางเกงหลวมสีเขียวน้ำทะเล พันผ้าที่ข้อเท้า'],
        ['รองเท้าผ้านักพรต', { def: 3, agi: 1 }, 'รองเท้าผ้าเรียบง่าย'],
        ['ผ้าคาดหัวนักพรต', { def: 2, str: 1, vit: 1 }, 'ผ้าคาดหัวสีเขียวน้ำทะเล ผูกข้างหลัง']],
      { fit: 0.974, seat: 0.518, dx: -0.183, clip: false, soft: 0, rimBehind: true, rim: band(0.45) },
      'นักพรตสายหมัด สะสมลูกปราณ คอมโบหมัดพายุ กายเหล็ก หมัดสิ้นปราณที่ใช้ SP ทั้งหมด · สายประชิด'],
  };

  const items = {}, sets = [];
  for (const id in JOBS2) {
    const [name, from, hair, weapon, hp, sp, look, fit, desc] = JOBS2[id];
    const [top, pants, shoes, hat] = look;
    items['top_' + id] = { slot: 'top', name: top[0], rig: id, rarity: 'legend', stats: top[1], desc: top[2] };
    items['pants_' + id] = { slot: 'pants', name: pants[0], rig: id, rarity: 'legend', stats: pants[1], desc: pants[2] };
    items['shoes_' + id] = { slot: 'shoes', name: shoes[0], rig: id, rarity: 'legend', stats: shoes[1], desc: shoes[2] };
    items['hat_' + id] = Object.assign({ slot: 'hat', name: hat[0], sprite: 'hat_' + id, rarity: 'legend', stats: hat[1], desc: hat[2] }, fit);
    sets.push({ id, name, icon: 'hat_' + id, items: { hair, robe: null, cape: null, top: 'top_' + id, pants: 'pants_' + id, shoes: 'shoes_' + id, hat: 'hat_' + id, weapon } });
    NC.JOBS[id] = { name, tier: 2, from, maxJob: 50, hp, sp, cls: id, skills: [], desc };
  }
  // the three new weapons: two staves in the staff's grip and moves, and the monk's quarterstaff held like the spear
  const staff = { style: 'bolt', cd: 0.34, dur: 0.22, hitAt: 0.06, kb: 160, grip: 0.3, restAng: -1.6, stance: -1.15,
    tuck: { grip: 0.42, ang: -1.22, at: [15, -22], back: true }, aspd: 1.05, magic: true };
  Object.assign(items, {
    staff_moon: Object.assign({ slot: 'weapon', name: 'คทาจันทร์เสี้ยว', sprite: 'staff_moon', rarity: 'legend', dmg: [40, 52], range: 800, matkMul: 0.5,
      stats: { int: 5, skill: 0.25 }, desc: 'จันทร์เสี้ยวทองโอบผลึกฟ้า ยิงลูกแก้วเวทแรงขึ้นและเพิ่มพลังสกิลมาก' }, staff),
    staff_lantern: Object.assign({ slot: 'weapon', name: 'คทาตะเกียงวิญญาณ', sprite: 'staff_lantern', rarity: 'legend', dmg: [38, 50], range: 760, matkMul: 0.5,
      stats: { int: 4, dex: 2, skill: 0.2 }, desc: 'ไม้คดห้อยตะเกียงไฟวิญญาณ ยิงลูกไฟวิญญาณและเพิ่มพลังสกิล' }, staff),
    staff_bo: { slot: 'weapon', name: 'ไม้พลองนักพรต', sprite: 'staff_bo', rarity: 'legend', style: 'thrust', dmg: [50, 64], cd: 0.36, dur: 0.22, hitAt: 0.07,
      reach: 245, arc: 0.5, kb: 320, grip: 0.3, restAng: -1.62, stance: -0.25, twoHanded: true, grip2: 14, tuck: { grip: 0.45, ang: -2.05, at: [-5, -28], back: true },
      aspd: 1.15, stats: { str: 2, agi: 2 }, desc: 'พลองไม้ยาวพันผ้า ตีไวและไกล' },
  });
  NC.CLASS2 = { items, sets, jobs: Object.keys(JOBS2) };
})();
