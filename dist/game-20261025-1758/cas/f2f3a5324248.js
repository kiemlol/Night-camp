/* class3.js — the class-3 ("high class") outfits: one per 2nd job, from the approved concepts of 2026-09-28
   (assets/gen/nightcamp_class3b_<family>_raw.png, the Monk from nightcamp_class3_monk_alt_raw.png, version C).
   Only the looks for now: each job's outfit (top / pants / shoes on its own rig c3_<job>), headgear and weapon, and its
   class set in NC.CLASSES (the bag's class buttons put the whole look on). The class-3 jobs and their skills (passives
   that power up the 2nd job's actives) come later; the concepts' big signature pieces (sun disc, dragon wings, auras,
   halos ...) will be those skills' effects. Loaded after items.js and weapons.js: it adds to NC.ITEMS directly.
   Art: assets/class3/ + assets/class3.manifest.js (prompts assets/gen/make_class3_parts_prompts.py, cut with
   tools/c3_art.py). */
(function () {
  'use strict';
  const NC = window.NC;
  if (NC.ASSET_MANIFEST_CLASS3) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_CLASS3);
  const ITEMS = NC.ITEMS;

  const band = (y) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => [+(i / 12).toFixed(3), y]);
  // headgear kinds: a ring round the head (its back half behind the head), a hood (the hair above its band squashed
  // under it), a hat that sits on top. Sizes and seats are first guesses; the user fits hats in the Animation Lab (L).
  const RING = (fit, y) => ({ fit, seat: 0.5, dx: -0.2, clip: false, soft: 0, rimBehind: true, rim: band(y) });
  const HOOD = (fit) => ({ fit, seat: 0.42, dx: 0, clip: true, soft: 0.2 });
  const HAT = (fit) => ({ fit, seat: 0.45, dx: 0, clip: true, soft: 0.3 });

  // job: [name, 2nd job, weapon, shield, [top, pants, shoes, hat: [name, stats, text]], hat fit, text]
  const C3 = {
    dawnwarden: ['ผู้พิทักษ์รุ่งสาง', 'paladin', 'c3_sunblade', 'c3_sunshield',
      [['เกราะตะวันรุ่งสาง', { def: 24, mdef: 7, vit: 5 }, 'เกราะเคลือบขาวขลิบทอง บ่ารูปตะวัน ผ้าคลุมน้ำเงินหลวง'],
        ['สนับขาตะวันรุ่งสาง', { def: 13, vit: 2 }, 'สนับขาขาวทอง ผ้าน้ำเงินใต้เกราะ'],
        ['รองเท้าเกราะตะวัน', { def: 7, vit: 1 }, 'รองเท้าเกราะขาวทอง'],
        ['มงกุฎรัศมีตะวัน', { def: 9, mdef: 4, vit: 2 }, 'มงกุฎทองแฉกรัศมีตะวันสูง ตราดาวในวงแหวน']],
      RING(1.3, 0.6), 'อัศวินแห่งรุ่งสาง โล่เก็บดาเมจที่รับแทนทีมแล้วปล่อยเป็นแสงตะวัน · ต่อยอดจากพาลาดิน'],
    dragonbound: ['อัศวินผสานมังกร', 'dragonknight', 'c3_dragonlance', null,
      [['เกราะเลือดมังกร', { def: 22, str: 5 }, 'เกราะเกล็ดดำรอยแตกลาวา ปีกมังกรพับเล็ก หางมังกรห้อยหลัง'],
        ['สนับขาเกล็ดลาวา', { def: 12, str: 2 }, 'ขาเกราะเกล็ดดำ รอยแตกสีส้มเรือง'],
        ['รองเท้ากรงเล็บมังกร', { def: 7, agi: 2 }, 'รองเท้าเกราะกรงเล็บ ขลิบแดง'],
        ['มงกุฎเขามังกร', { def: 8, str: 3 }, 'มงกุฎกระดูกมังกรดำ เขายาวลู่หลัง แผงขนแดง']],
      RING(1.4, 0.62), 'อัศวินที่มีเลือดมังกร ปีกกางเมื่อพลังตื่น หอกพ่นไฟ · ต่อยอดจากอัศวินมังกร'],
    starblade: ['นักดาบกลุ่มดาว', 'swordmaster', 'c3_starswords', null,
      [['เสื้อคลุมดาบดารา', { def: 17, agi: 3, str: 2 }, 'เสื้อคลุมขาวน้ำเงินราตรี ชายเสื้อบุลายฟ้ากลางคืน'],
        ['กางเกงดาบดารา', { def: 9, agi: 2 }, 'กางเกงขาว'],
        ['บูทดาบดารา', { def: 6, agi: 2 }, 'บูทน้ำเงินราตรีหัวเงิน'],
        ['รัดเกล้าดารา', { def: 3, dex: 3, agi: 2 }, 'รัดเกล้าเงินตราดาว ริบบิ้นขาวยาวปลิว']],
      RING(1.12, 0.3), 'นักดาบใต้ดวงดาว ดาบคริสตัลลอยรอบตัวเมื่อพลังตื่น · ต่อยอดจากนักดาบ'],
    bloodmoon: ['จอมคลั่งจันทร์เลือด', 'berserker', 'c3_moonaxe', null,
      [['เกราะจันทร์เลือด', { def: 22, str: 5, vit: 2 }, 'เกราะเหล็กดำขลิบแดง คอขนหมาป่าดำ จันทร์แดงเรืองที่อก'],
        ['สนับขาจันทร์เลือด', { def: 12, str: 2 }, 'กางเกงหนังเข้ม สนับเหล็กดำขลิบแดง'],
        ['รองเท้าเหล็กคลั่ง', { def: 7, vit: 1 }, 'รองเท้าเหล็กดำหนัก'],
        ['หมวกเขาจันทร์เลือด', { def: 9, str: 3 }, 'หมวกเหล็กดำขอบขน เขากระดูกโค้งใหญ่ จันทร์แดงที่หน้าผาก']],
      { fit: 1.35, seat: 0.47, dx: 0, clip: false, soft: 0 }, 'นักรบคลั่งใต้จันทร์สีเลือด ยิ่งเลือดน้อยยิ่งแรง · ต่อยอดจากเบอร์เซิร์กเกอร์'],
    starcore: ['จอมเวทดาวฤกษ์', 'firemage', 'c3_sunstaff', null,
      [['เสื้อคลุมดาวฤกษ์', { def: 6, mdef: 16, int: 5 }, 'เสื้อคลุมขาวทองขลิบส้มเปลวไฟ ผ้าคลุมไหล่ทองขอบเปลว'],
        ['ชายคลุมเปลวทอง', { def: 3, mdef: 7, int: 2 }, 'ชายเสื้อขาวทองลายเปลวไฟ'],
        ['รองเท้าเถ้าทอง', { def: 2, mdef: 5 }, 'รองเท้าดำขลิบทอง'],
        ['ฮู้ดมงกุฎเปลวทอง', { mdef: 9, int: 4 }, 'ฮู้ดขาวทอง มงกุฎทองแฉกเปลวไฟ อัญมณีแดง']],
      HOOD(1.3), 'จอมเวทดวงอาทิตย์ ความร้อนเกินร้อยกลายเป็นดวงดาว · ต่อยอดจากจอมเวทไฟ'],
    winterlord: ['จ้าวเหมันต์', 'icemage', 'c3_icescepter', null,
      [['เสื้อคลุมจักรพรรดิหิมะ', { def: 8, mdef: 15, int: 4, vit: 1 }, 'เสื้อคลุมน้ำเงินขาว เกราะผลึกน้ำแข็งใส ผ้าคลุมชายน้ำแข็งย้อย'],
        ['ชายคลุมผลึกน้ำแข็ง', { def: 4, mdef: 7, vit: 1 }, 'ชายเสื้อน้ำเงินขาว ขอบผลึกน้ำแข็ง'],
        ['บูทหิมะหลวง', { def: 3, mdef: 4 }, 'บูทน้ำเงินขลิบเงิน'],
        ['มงกุฎน้ำแข็ง', { mdef: 9, int: 3, vit: 1 }, 'มงกุฎผลึกน้ำแข็งแหลมสูง เรืองฟ้า']],
      RING(1.3, 0.62), 'จักรพรรดิแห่งฤดูหนาว ศัตรูที่ตายตอนแข็งกลายเป็นรูปปั้นน้ำแข็ง · ต่อยอดจากจอมเวทน้ำแข็ง'],
    astral: ['จอมเวทดาราจักร', 'archmage', 'c3_orbitstaff', null,
      [['เสื้อคลุมดาราจักร', { def: 6, mdef: 17, int: 5 }, 'เสื้อคลุมลายเนบิวลาม่วงน้ำเงิน ปกสูงทอง'],
        ['ชายคลุมดาราจักร', { def: 3, mdef: 8, int: 2 }, 'ชายเสื้อลายเนบิวลา ขอบทอง'],
        ['รองเท้าดาราจักร', { def: 2, mdef: 5 }, 'รองเท้าเข้มขลิบทอง'],
        ['มงกุฎวงโคจร', { mdef: 9, int: 4 }, 'หมวกม่วงพันวงโคจรทอง ดาวเคราะห์จิ๋ว']],
      HAT(1.25), 'จอมเวทจักรวาล ดาวเคราะห์โคจรรอบตัว เรียงครบได้เวทผสมสามธาตุ · ต่อยอดจากอาร์คเมจ'],
    hexlord: ['จ้าวคืนเดือนดับ', 'warlock', 'c3_ghostlantern', null,
      [['เสื้อคลุมจ้าวตะเกียงผี', { def: 7, mdef: 15, int: 4, dex: 1 }, 'เสื้อคลุมดำม่วง ปกสูงแหลม ไฟผีเขียวที่ไหล่'],
        ['ชายคลุมไฟผี', { def: 4, mdef: 7, dex: 1 }, 'ชายเสื้อดำขอบไฟผีสีเขียว'],
        ['รองเท้าจ้าวตะเกียงผี', { def: 3, mdef: 4 }, 'รองเท้าดำขลิบเงิน'],
        ['มงกุฎเขาไฟผี', { mdef: 8, int: 3, dex: 1 }, 'มงกุฎหนามดำ เขาโค้งคู่ ไฟผีเขียวกลาง']],
      RING(1.35, 0.64), 'จ้าวแห่งผีและตะเกียง คำสาปติดต่อจากตัวสู่ตัว · ต่อยอดจากวอร์ล็อกตะเกียง'],
    moonsniper: ['พรานจันทร์เงียบ', 'ranger', 'c3_moonbow', null,
      [['เสื้อเกราะพรานจันทร์', { def: 11, dex: 5 }, 'เสื้อเกราะเขียวหัวเป็ดขลิบเงิน บ่าขนนกเงิน ผ้าคลุมผ่าหลัง'],
        ['กางเกงพรานจันทร์', { def: 6, agi: 3 }, 'กางเกงเขียวเข้ม สนับเข่าเงิน'],
        ['บูทพรานจันทร์', { def: 4, agi: 2 }, 'บูทน้ำตาลขลิบเงิน'],
        ['ฮู้ดพรานจันทร์', { def: 5, dex: 3 }, 'ฮู้ดเขียวหัวเป็ดขลิบเงิน ขนนกเงิน']],
      HOOD(1.25), 'พรานซุ่มยิงใต้แสงจันทร์ ยืนนิ่งเล็งแล้วยิงทะลุทั้งจอ · ต่อยอดจากเรนเจอร์'],
    packalpha: ['จ่าฝูงจันทร์เต็มดวง', 'wolfhunter', 'c3_wolfbow', null,
      [['เสื้อขนหมาป่าวิญญาณ', { def: 13, dex: 3, vit: 2 }, 'ผ้าคลุมขนหมาป่าขาวลายฟ้าเรือง เกราะหนังตรากรงเล็บเงิน'],
        ['กางเกงจ่าฝูง', { def: 7, dex: 2 }, 'กางเกงน้ำตาลเข้ม'],
        ['บูทขนขาวจ่าฝูง', { def: 4, agi: 2 }, 'บูทเกราะเงินขอบขนขาว'],
        ['ฮู้ดหัวหมาป่าขาว', { def: 6, dex: 3, luk: 1 }, 'ฮู้ดหัวหมาป่าวิญญาณสีขาว ตาฟ้าเรือง']],
      HOOD(1.3), 'ราชาหมาป่าวิญญาณ คุมฝูงหมาป่า · ต่อยอดจากนักล่าหมาป่า'],
    maestro: ['วาทยกรแห่งป่า', 'bard', 'c3_harplute', null,
      [['เสื้อหางยาววาทยกร', { def: 10, dex: 3, luk: 2 }, 'เสื้อหางยาวม่วงราตรีขลิบทอง อินทรธนูทอง ผ้าผูกคอมรกต'],
        ['กางเกงวาทยกร', { def: 6, agi: 2 }, 'กางเกงขาว'],
        ['บูทวาทยกร', { def: 4, agi: 1 }, 'บูทน้ำตาลขลิบทอง'],
        ['หมวกสามเหลี่ยมวาทยกร', { def: 3, dex: 3, luk: 2 }, 'หมวกสามเหลี่ยมม่วงขลิบทอง ขนนกขาวทองใหญ่']],
      HAT(1.45), 'วาทยกรยามราตรี เพลงสองเพลงซ้อนกันเป็นเสียงประสาน · ต่อยอดจากนักกวี'],
    outlaw: ['มือปืนเที่ยงคืน', 'gunslinger', 'c3_revolver', null,
      [['โค้ทยาวมือปืนเที่ยงคืน', { def: 11, dex: 5 }, 'โค้ทยาวดำแดงปกสูง โซ่เงิน ผ้าพันคอแดง'],
        ['กางเกงมือปืนเที่ยงคืน', { def: 6, dex: 2 }, 'กางเกงดำ'],
        ['บูทเดือยเงิน', { def: 4, agi: 2 }, 'บูทดำเดือยเงิน สายรัดแดง'],
        ['หมวกคาวบอยราตรี', { def: 4, dex: 3, luk: 2 }, 'หมวกคาวบอยดำคาดแดง ขนนกขาว']],
      HAT(1.5), 'มือปืนนอกกฎหมายยามเที่ยงคืน หยุดเวลาเล็งหกเป้าแล้วยิงพร้อมกัน · ต่อยอดจากมือปืน'],
    eclipse: ['นักฆ่าจันทรคราส', 'assassin', 'c3_eclipseblade', null,
      [['เกราะจันทรคราส', { def: 11, agi: 4, luk: 2 }, 'เกราะดำขลิบทองคม ตราคราสที่อก ผ้าพันคอแดงยาว'],
        ['กางเกงจันทรคราส', { def: 6, luk: 3 }, 'กางเกงเกราะดำ สนับเข่าทอง'],
        ['รองเท้าจันทรคราส', { def: 4, agi: 3 }, 'รองเท้าดำขลิบทอง'],
        ['ฮู้ดจันทรคราส', { def: 5, agi: 2, luk: 2 }, 'ฮู้ดดำขอบทอง ตราดาวที่หน้าผาก']],
      HOOD(1.25), 'นักฆ่าแห่งคราส ซ่อนตัวสะสมความมืดแล้ววาร์ปฟันทุกเป้า · ต่อยอดจากนักฆ่า'],
    shadowlord: ['จ้าวเงาร้อยร่าง', 'shinobi', 'c3_violetkunai', null,
      [['ชุดเกราะจ้าวเงา', { def: 10, agi: 3, dex: 2 }, 'ชุดนินจาดำม่วง แผ่นเหล็กที่ไหล่ ผ้าพันคอม่วงยาวหลายชาย ดาวกระจายยักษ์ที่หลัง'],
        ['กางเกงจ้าวเงา', { def: 6, agi: 2 }, 'กางเกงดำพันผ้าม่วง สนับแข้งเหล็ก'],
        ['รองเท้าจ้าวเงา', { def: 4, agi: 3 }, 'รองเท้าแยกนิ้วสีดำ'],
        ['ผ้าคาดหัวจ้าวเงา', { def: 3, agi: 3, luk: 2 }, 'ผ้าคาดหัวดำ แผ่นเหล็กตราดาว ชายผ้าม่วงยาว']],
      RING(1.0, 0.36), 'จ้าวแห่งเงา ร่างแยกอยู่ถาวรและร่ายคาถาซ้ำตาม · ต่อยอดจากนินจา'],
    harvester: ['ผู้เก็บเกี่ยวจันทรา', 'reaper', 'c3_moonscythe', null,
      [['เสื้อคลุมผู้เก็บเกี่ยว', { def: 14, str: 3, vit: 2 }, 'เสื้อคลุมดำซับเงิน โซ่วิญญาณ ไฟผีสีฟ้าที่ชาย'],
        ['กางเกงผู้เก็บเกี่ยว', { def: 7, agi: 2 }, 'ชายคลุมดำขาดวิ่น ไฟผีฟ้า'],
        ['บูทผู้เก็บเกี่ยว', { def: 4, agi: 2 }, 'บูทหนังดำ'],
        ['ฮู้ดมงกุฎกะโหลกเงิน', { def: 6, str: 2, luk: 3 }, 'ฮู้ดดำขาดรุ่ย โซ่เงิน มงกุฎกะโหลกนกสีเงิน']],
      HOOD(1.3), 'ผู้เก็บเกี่ยวใต้จันทร์ วิญญาณทำให้จันทร์ขึ้นทีละข้าง เต็มดวงฟันเสี้ยวจันทร์ทั้งจอ · ต่อยอดจากยมทูต'],
    showmaster: ['จ้าวโรงหุ่นราตรี', 'puppeteer', 'c3_goldbar', null,
      [['เสื้อหางยาวจ้าวโรงหุ่น', { def: 11, dex: 3, agi: 2 }, 'เสื้อหางยาวแดงดำขลิบทอง โบว์ลูกไม้ขาว อินทรธนูทอง'],
        ['กางเกงจ้าวโรงหุ่น', { def: 6, agi: 2 }, 'กางเกงดำแถบทองข้าง'],
        ['รองเท้าจ้าวโรงหุ่น', { def: 4, agi: 2 }, 'รองเท้าดำขลิบทอง'],
        ['หมวกทรงสูงจ้าวโรงหุ่น', { def: 3, dex: 3, luk: 2 }, 'หมวกทรงสูงดำคาดทอง ขนนกแดง']],
      HAT(1.15), 'เจ้าของโรงละครหุ่นยามราตรี หุ่นสามตัวประกอบร่างเป็นหุ่นยักษ์ · ต่อยอดจากนักเชิดหุ่น'],
    starsaint: ['นักบุญแสงดาว', 'bishop', 'c3_starscepter', null,
      [['อาภรณ์นักบุญแสงดาว', { def: 6, mdef: 15, int: 4, sp: 45 }, 'อาภรณ์ขาวทองปักดาว แผงฟ้า ผ้าคลุมฟ้าขาวเหมือนปีก'],
        ['ชายอาภรณ์แสงดาว', { def: 3, mdef: 7, vit: 2 }, 'ชายเสื้อขาวฟ้าปักดาวทอง'],
        ['รองเท้าแสงดาว', { def: 2, mdef: 4 }, 'รองเท้าขาวทอง'],
        ['มงกุฎดาวผ้าคลุมขาว', { mdef: 9, int: 4, sp: 30 }, 'มงกุฎทองตราดาว ผ้าคลุมบางสีขาว']],
      RING(1.25, 0.6), 'นักบุญผู้ถือแสงดาว ฮีลที่ล้นหลอดกลายเป็นตราแสงพิพากษา · ต่อยอดจากบิชอป'],
    meteorfist: ['ปรมาจารย์หมัดดาวตก', 'monk', 'c3_flamefist', null,
      [['กายเปลือยนักสู้', { def: 11, str: 3, vit: 3 }, 'ถอดเสื้อ เชือกทองดำคาดเอว ชายผ้าแดง'],
        ['กางเกงลายเพลิง', { def: 7, str: 2, agi: 2 }, 'กางเกงหลวมดำลายเปลวไฟแดง ผูกข้อเท้าเชือกทอง'],
        ['รองเท้าผ้านักสู้', { def: 4, agi: 2 }, 'รองเท้าผ้าสีดำ'],
        ['ผ้าคาดหัวเพลิงแดง', { def: 3, str: 2, vit: 2 }, 'ผ้าคาดหัวแดงขาดวิ่น ตราดาว']],
      RING(1.0, 0.36), 'ปรมาจารย์หมัด ออร่าไฟลุกเมื่อลูกปราณเต็ม ทุกหมัดเรียกดาวตก · ต่อยอดจากนักพรต'],
    beacon: ['ผู้เฝ้าประภาคาร', 'lightkeeper', 'c3_beaconstaff', null,
      [['โค้ทกัปตันประภาคาร', { def: 10, mdef: 8, int: 3, vit: 2 }, 'โค้ทกัปตันน้ำเงิน กระดุมทองเหลือง ผ้าคลุมไหล่ครีม ประภาคารจิ๋วที่หลัง'],
        ['กางเกงผู้เฝ้าประภาคาร', { def: 6, vit: 2 }, 'กางเกงเข้ม'],
        ['บูทหัวเข็มขัดทองเหลือง', { def: 4 }, 'บูทน้ำตาล หัวเข็มขัดทองเหลือง'],
        ['หมวกกัปตันโคมทองเหลือง', { def: 3, mdef: 4, int: 3 }, 'หมวกกัปตันยอดขาว เชือกทอง ตราโคมเรือง']],
      HAT(1.3), 'ผู้เฝ้าแสงประภาคาร ลำแสงหมุนกวาด ฮีลพวกเรา เผาผี · ต่อยอดจากผู้จุดตะเกียง'],
    starshepherd: ['ผู้เลี้ยงดวงดาว', 'wisp', 'c3_starcrook', null,
      [['ชุดคลุมทางช้างเผือก', { def: 6, mdef: 15, int: 5 }, 'ชุดคลุมไล่สีน้ำเงินราตรีถึงขาวพราวดาว ผ้าคาดทางช้างเผือก'],
        ['ชายคลุมพราวดาว', { def: 3, mdef: 7, int: 2 }, 'ชายเสื้อขาวพราวดาว ขอบน้ำเงิน'],
        ['รองเท้านุ่มแสงดาว', { def: 2, mdef: 4 }, 'รองเท้านุ่มสีซีด'],
        ['ผ้าคลุมหัวพราวดาว', { mdef: 8, int: 3, dex: 2 }, 'ผ้าคลุมหัวบางสีน้ำเงินพราวดาว รัดเกล้าเงิน']],
      HOOD(1.3), 'ผู้เลี้ยงดวงดาว หลอมดวงไฟเป็นดาวดวงใหญ่ · ต่อยอดจากผู้เลี้ยงดวงไฟ'],
  };

  // ---------------- the weapons: the same kinds as the 2nd jobs', stronger (copied from the base item) ----------------
  const W = (id, base, wtype, o) => {
    const b = ITEMS[base] || {};
    const it = Object.assign({}, b, { id, sprite: 'w_' + id, rarity: 'legend', wtype }, o); // (not the base's id)
    delete it.icon;
    if (b.dmg && !o.dmg) it.dmg = b.dmg.map((v) => Math.round(v * 1.3));
    ITEMS[id] = it;
  };
  W('c3_sunblade', 'sword', 'sword', { name: 'ดาบตะวันรุ่งสาง', desc: 'ดาบศักดิ์สิทธิ์คมทองเรือง กระบังรูปจานตะวัน' });
  W('c3_dragonlance', 'spear', 'lance', { name: 'หอกหัวมังกรเพลิง', desc: 'หอกยาวดำปลายเป็นหัวมังกรพ่นไฟ' });
  W('c3_starswords', 'twinswords', 'dsword', { name: 'ดาบคู่คริสตัลดารา', desc: 'ดาบคู่ใบคริสตัลขาวฟ้า กระบังดาวเงิน' });
  W('c3_moonaxe', 'greataxe', 'gaxe', { name: 'ขวานยักษ์จันทร์เลือด', desc: 'ขวานสองคมรูปจันทร์เสี้ยวสีเลือด ด้ามพันโซ่' });
  W('c3_sunstaff', 'staff', 'staff', { name: 'คทาดวงอาทิตย์', desc: 'คทาทองยอดเป็นดวงอาทิตย์จิ๋วลุกโชน' });
  W('c3_icescepter', 'staff', 'staff', { name: 'คทาเกล็ดหิมะ', desc: 'คทาเงินยอดผลึกเกล็ดหิมะเรืองฟ้า' });
  W('c3_orbitstaff', 'staff_moon', 'staff', { name: 'คทาวงโคจร', desc: 'คทาทองยอดดาวเคราะห์เรืองในวงแหวน' });
  W('c3_ghostlantern', 'staff_lantern', 'lantern', { name: 'คทาตะเกียงผีใหญ่', desc: 'คทาดำห้อยตะเกียงกรงเหล็ก มีผีตัวน้อยข้างใน' });
  // (bow: where the game ties its string, measured by tools/c3_art.py when it wiped the string Codex drew)
  W('c3_moonbow', 'bow', 'bow', { name: 'ธนูยาวจันทร์เสี้ยว', bow: { x: 0.093, top: 0.055, bottom: 0.941 },
    desc: 'ธนูยาวขาวเงินปลายจันทร์เสี้ยว สายเรืองแสง' });
  W('c3_wolfbow', 'bow', 'bow', { name: 'ธนูขากรรไกรหมาป่า', bow: { x: 0.187, top: 0.143, bottom: 0.857 },
    desc: 'ธนูสีกระดูก กิ่งเป็นขากรรไกรหมาป่ามีเขี้ยว' });
  W('c3_harplute', 'lute', 'instrument', { name: 'พิณฮาร์ปทองคำ', desc: 'พิณฮาร์ปทองสลักลาย ดีดแล้วตัวโน้ตทองพุ่ง' });
  W('c3_revolver', 'pistols', 'pistol', { name: 'ปืนลูกโม่เงินเที่ยงคืน', desc: 'ปืนลูกโม่คู่สีเงินลายแดงเรือง' });
  W('c3_eclipseblade', 'dagger', 'dagger', { name: 'มีดโค้งจันทรคราส', desc: 'มีดโค้งคู่ใบดำคมทอง' });
  W('c3_violetkunai', 'dagger', 'dagger', { name: 'คุไนเงาม่วง', desc: 'คุไนคู่ใบเรืองม่วง' });
  W('c3_moonscythe', 'scythe', 'scythe', { name: 'เคียวจันทร์วิญญาณ', desc: 'เคียวใหญ่ใบเสี้ยวจันทร์เรืองฟ้า ด้ามพันโซ่' });
  W('c3_goldbar', 'puppetbar', 'puppet', { name: 'ไม้เชิดหุ่นทองคำ', desc: 'ไม้เชิดกากบาททองประดับดาว ด้ายทองเรือง' });
  W('c3_starscepter', 'staff_holy', 'staff', { name: 'คทาดาวแปดแฉก', desc: 'คทาทองยอดดาวแปดแฉกเรืองแสง' });
  W('c3_flamefist', 'knuckle', 'knuckle', { name: 'สนับมือทองเพลิง', desc: 'สนับมือคู่สีทอง มีเปลวไฟที่ข้อนิ้ว' });
  W('c3_beaconstaff', 'torch', 'torch', { name: 'คทาประภาคาร', desc: 'คทาทองเหลืองยอดเป็นโคมประภาคารเรืองแสง' });
  W('c3_starcrook', 'staff', 'staff', { name: 'ไม้เท้าเลี้ยงดาว', desc: 'ไม้เท้าเงินปลายงอ ห้อยโคมดาวเรืองแสง' });
  ITEMS.c3_sunshield = { slot: 'shield', name: 'โล่หอคอยตะวัน', sprite: 'w_c3_sunshield', rarity: 'legend',
    stats: { def: 18, mdef: 5, vit: 2 }, desc: 'โล่ทรงหอคอยขาวทอง ขอบบนเป็นตะวันขึ้น' };

  // ---------------- outfits, headgear, class sets ----------------
  const sets = [];
  for (const job in C3) {
    const [name, from, weapon, shield, look, fit, desc] = C3[job], rig = 'c3_' + job;
    const [top, pants, shoes, hat] = look;
    ITEMS['top_' + rig] = { slot: 'top', name: top[0], rig, rarity: 'legend', stats: top[1], desc: top[2] };
    ITEMS['pants_' + rig] = { slot: 'pants', name: pants[0], rig, rarity: 'legend', stats: pants[1], desc: pants[2] };
    ITEMS['shoes_' + rig] = { slot: 'shoes', name: shoes[0], rig, rarity: 'legend', stats: shoes[1], desc: shoes[2] };
    ITEMS['hat_' + rig] = Object.assign({ slot: 'hat', name: hat[0], sprite: 'hat_' + rig, rarity: 'legend', stats: hat[1], desc: hat[2] }, fit);
    const items = { hair: from === 'ranger' || from === 'wolfhunter' ? 'hair_brown' : 'hair_spiky', robe: null, cape: null,
      top: 'top_' + rig, pants: 'pants_' + rig, shoes: 'shoes_' + rig, hat: 'hat_' + rig, weapon };
    if (shield) items.shield = shield;
    sets.push({ id: rig, name, icon: 'hat_' + rig, class3: true, from, desc, items });
  }
  for (const id in ITEMS) if (!ITEMS[id].id) ITEMS[id].id = id; // (items.js named the others)

  // the class buttons in the bag: after the new 2nd jobs, only the outfits already cut (their rig is in the manifest)
  const at = NC.CLASSES.findIndex((c) => c.id === 'wisp');
  const cut = sets.filter((s) => NC.ASSET_MANIFEST['rig_' + s.id + '_torso']);
  NC.CLASSES.splice(at < 0 ? NC.CLASSES.length : at + 1, 0, ...cut);

  NC.CLASS3 = { items: Object.keys(ITEMS).filter((k) => /c3_/.test(k)), sets, jobs: Object.keys(C3) };
})();
