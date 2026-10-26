/* jobs3.js — the new 2nd jobs of the plan "อาชีพใหม่ Night Camp" (approved 2026-09-28): four 2nd jobs per 1st job
     อัศวิน -> นักดาบ (+ เบอร์เซิร์กเกอร์ later)     จอมเวท -> จอมเวทไฟ / จอมเวทน้ำแข็ง
     นักธนู -> นักกวี / มือปืน                      โจร -> ยมทูต / นักเชิดหุ่น          พระ -> ผู้จุดตะเกียง / ผู้เลี้ยงดวงไฟ
   This file holds the data, like class2.js: each job's outfit (top / pants / shoes on its own rig), headgear, its class
   set and its NC.JOBS entry; plus the weapons of the new weapon types (js/weapons.js: NC.WTYPES) and the shields.
   A job goes live (NC.JOBS, the job change) only when its skills are built: LIVE below; the skill files are
   jobs3_skills_*.js. Loaded before items.js (items.js merges NC.JOBS3.items). Art: assets/jobs3/ +
   assets/jobs3.manifest.js (Codex sheets from assets/gen/j3_*.prompt.txt, cut with rigcut / cutout). */
(function () {
  'use strict';
  const NC = window.NC;
  if (NC.ASSET_MANIFEST_JOBS3) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_JOBS3);

  // the jobs whose skills are in the game (the next batches add theirs)
  const LIVE = ['swordmaster', 'firemage', 'icemage', 'bard', 'gunslinger', 'reaper', 'puppeteer', 'lightkeeper', 'wisp', 'berserker'];

  const band = (y) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => [+(i / 12).toFixed(3), y]);
  // job: [name, 1st job, weapon, hp, sp, look {top, pants, shoes, hat: name, stats, text}, hat fit, job text]
  const JOBS3 = {
    swordmaster: ['นักดาบ', 'knight', 'twinswords', 7, 4,
      [['เสื้อคลุมนักดาบ', { def: 12, agi: 2, str: 1 }, 'เสื้อคลุมน้ำเงินเข้ม ผ้าพันแขนฟ้า เข็มกลัดจันทร์เสี้ยว'],
        ['กางเกงนักดาบ', { def: 6, agi: 1 }, 'กางเกงน้ำเงินเข้ม เข็มขัดหนัง'],
        ['รองเท้าหุ้มข้อนักดาบ', { def: 4, agi: 1 }, 'รองเท้าหุ้มข้อสีน้ำเงิน สายรัดเงิน'],
        ['ผ้าคาดหัวจันทร์เสี้ยว', { def: 2, dex: 2, agi: 1 }, 'ผ้าคาดหัวสีฟ้า แผ่นเงินจันทร์เสี้ยว ชายผ้ายาวปลิว']],
      // (the rim line drops at the front so the crescent plate stays in front of the head, not cut off straight)
      { fit: 1.14, seat: 0.518, dx: -0.228, clip: false, soft: 0, rimBehind: true,
        rim: [[0, 0.47], [0.1, 0.47], [0.2, 0.47], [0.3, 0.47], [0.4, 0.47], [0.5, 0.47], [0.6, 0.5], [0.66, 0.56], [0.72, 0.66], [0.8, 0.66], [0.9, 0.66], [1, 0.62]] },
      'นักดาบใต้แสงจันทร์ ทุกครั้งที่ฟันทิ้ง "รอยดาบ" เรืองแสงค้างกลางอากาศ แล้วใช้ท่าปิดท้ายระเบิดรอยทั้งหมด · ดาบคู่ฟิสิคัล หรือดาบเวท ATK+MATK'],
    // (the berserker's skills: jobs3_berserker.js; its helmet sat over one eye with the dragon helm's seat: higher here)
    berserker: ['เบอร์เซิร์กเกอร์', 'knight', 'greataxe', 8, 2.5,
      [['เกราะเบอร์เซิร์กเกอร์', { def: 14, str: 3, vit: 1 }, 'เกราะเหล็กดำหนังสัตว์ ผ้าคาดแดง บ่าขนสัตว์'],
        ['สนับขาเบอร์เซิร์กเกอร์', { def: 7, str: 1 }, 'กางเกงหนังสนับเหล็ก'],
        ['รองเท้าเบอร์เซิร์กเกอร์', { def: 5, vit: 1 }, 'รองเท้าหนังหุ้มเหล็ก'],
        ['หมวกเขาเบอร์เซิร์กเกอร์', { def: 6, str: 2 }, 'หมวกเหล็กดำเขาโค้ง ขอบขนเทา ผ้าแดงปลิว']],
      { fit: 1.35, seat: 0.4, dx: 0, clip: false, soft: 0 },
      'นักรบคลั่งถือขวานยักษ์หรือค้อนยักษ์ ตีสะสมโทสะ 3 ช่องแล้วปล่อยท่าปิดแรงตามจำนวนช่อง ลงเลือด ยิ่งเลือดน้อยยิ่งแรง · เลนดาบใหญ่แลกเลือด · เลนขวาน/ค้อนยักษ์มึนล้ม'],
    firemage: ['จอมเวทไฟ', 'mage', 'staff', 4, 7.5,
      [['เสื้อคลุมจอมเวทไฟ', { def: 4, mdef: 11, int: 3 }, 'เสื้อคลุมแดงเข้มขลิบทอง ลายเปลวไฟที่ชาย อัญมณีส้มที่อก'],
        ['กางเกงลายเปลวไฟ', { def: 2, mdef: 5, int: 1 }, 'กางเกงแดงเข้ม ลายเปลวไฟทอง'],
        ['รองเท้าเถ้าถ่าน', { def: 1, mdef: 4 }, 'รองเท้าหนังดำ'],
        ['หมวกปลายเปลว', { mdef: 6, int: 3 }, 'หมวกพ่อมดแดงเข้ม คาดทองประดับทับทิม ปลายหมวกมีเปลวไฟเล็ก ๆ']],
      { fit: 1.75, seat: 0.47, dx: 0, clip: false, soft: 0.4 }, // (a wide brim covers the hair: cut, it left a straight edge under it)
      'จอมเวทสายไฟล้วน ร่ายไฟแล้วแถบความร้อนขึ้น 0–100 ยิ่งร้อนยิ่งแรง เกิน 80 ตัวเองโดนเผา ต้องระบายความร้อนเป็นระเบิดรอบตัว · เก่งฝูงที่สุด'],
    icemage: ['จอมเวทน้ำแข็ง', 'mage', 'staff', 4.5, 7,
      [['เสื้อคลุมจอมเวทน้ำแข็ง', { def: 6, mdef: 10, int: 2, vit: 1 }, 'เสื้อคลุมฟ้าซีดขลิบขนขาว ลายเกล็ดหิมะ'],
        ['กางเกงขนนุ่ม', { def: 3, mdef: 5, vit: 1 }, 'กางเกงฟ้าลายหิมะ ขอบขนขาว'],
        ['บูทขนหิมะ', { def: 2, mdef: 3 }, 'บูทขนนุ่มสีขาว'],
        ['หมวกผลึกน้ำแข็ง', { mdef: 6, int: 2, vit: 1 }, 'หมวกทรงสูงสีฟ้า ขอบขนขาว ผลึกน้ำแข็งเรืองแสงสามแท่ง']],
      { fit: 1.3, seat: 0.45, dx: 0, clip: true, soft: 0.3 },
      'จอมเวทสายน้ำแข็งล้วน แช่แข็งศัตรูแล้วทุบให้แตกเป็นลูกโซ่ สร้างกำแพงและเกราะน้ำแข็ง · เลนออร์บ + โล่เป็นจอมเวทสายทน'],
    bard: ['นักกวี', 'archer', 'lute', 5, 4.5,
      [['เสื้อกั๊กนักดนตรี', { def: 7, dex: 2, luk: 1 }, 'เสื้อกั๊กแดงเลือดหมูกระดุมทอง ผ้าพันคอเหลืองยาว กลองเล็กที่เอว'],
        ['กางเกงนักดนตรี', { def: 4, agi: 1 }, 'กางเกงสีน้ำตาลเข้ม'],
        ['บูทพับข้อนักกวี', { def: 3, agi: 1 }, 'บูทหนังพับข้อสีน้ำตาล'],
        ['หมวกขนนกนักกวี', { def: 2, dex: 2, luk: 1 }, 'หมวกเบเร่ต์แดงเลือดหมู ขนนกขาวทอง ตราโน้ตดนตรี']],
      { fit: 1.4, seat: 0.45, dx: 0, clip: true, soft: 0.3 },
      'นักดนตรีรอบกองไฟ เพลงเล่นเป็นท่อน ยิ่งเล่นนานยิ่งแรง แล้วปิดด้วยท่อนฮุก · เลนเครื่องดนตรีเล่นเพลงบัฟทั้งทีม · เลนแส้ระบำไฟให้ศัตรูอ่อนแรง'],
    gunslinger: ['มือปืน', 'archer', 'pistols', 5, 3.5,
      [['เสื้อโค้ทมือปืน', { def: 8, dex: 3 }, 'เสื้อโค้ทยาวสีน้ำตาล ผ้าพันคอแดง เข็มขัดกระสุน ซองปืนที่เอว'],
        ['กางเกงมือปืน', { def: 4, dex: 1 }, 'กางเกงสีเทาเข้ม'],
        ['บูทเดือยดาว', { def: 3, agi: 1 }, 'บูทหนังสีน้ำตาล มีเดือยรูปดาว'],
        ['หมวกปีกกว้างมือปืน', { def: 3, dex: 2, luk: 1 }, 'หมวกปีกกว้างสีน้ำตาล คาดสายหนัง ตราดาวเงิน']],
      { fit: 1.45, seat: 0.45, dx: 0, clip: true, soft: 0.2 },
      'มือปืนสายเสี่ยงดวง ลูกโม่ 6 นัด ยิงครบต้องบรรจุใหม่ นัดที่หกแรงพิเศษ หมุนโม่ได้กระสุนสุ่ม · เลนปืนพกคู่เป้าเดียว · เลนลูกซองยิงกระจายระยะใกล้'],
    reaper: ['ยมทูต', 'rogue', 'scythe', 6.5, 3,
      [['เสื้อคลุมยมทูต', { def: 10, str: 2, vit: 1 }, 'เสื้อคลุมดำชายขาด ผ้าพันคอเทาเงิน ตะเกียงไฟวิญญาณที่เอว'],
        ['กางเกงยมทูต', { def: 5, agi: 1 }, 'กางเกงดำชายขาด'],
        ['บูทยมทูต', { def: 3, agi: 1 }, 'บูทหนังดำ'],
        ['ฮู้ดยมทูต', { def: 4, str: 1, luk: 2 }, 'ฮู้ดผ้าดำขาดรุ่ย ประดับกะโหลกนกสีขาว']],
      { fit: 1.25, seat: 0.42, dx: 0, clip: true, soft: 0.2 },
      'ผู้เก็บเกี่ยวยามค่ำคืน เก็บดวงวิญญาณจากศัตรูที่ล้ม ยิ่งมากยิ่งแรงและดูดเลือด แปลงร่างเป็นผีพุ่งทะลุศัตรู · เลนเคียวใหญ่กวาดหมู่ · เลนเคียวคู่ขว้างวกกลับ'],
    puppeteer: ['นักเชิดหุ่น', 'rogue', 'puppetbar', 5.5, 4,
      [['เสื้อกั๊กนักเชิดหุ่น', { def: 8, dex: 2, agi: 1 }, 'เสื้อกั๊กลายตารางม่วงเข้ม ผ้าคลุมไหล่สั้น โบว์ลูกไม้ขาว ถุงมือมีห่วงด้าย'],
        ['กางเกงลายทาง', { def: 4, agi: 1 }, 'กางเกงลายทางสีม่วงดำ'],
        ['รองเท้าหัวแหลม', { def: 3, agi: 1 }, 'รองเท้าหนังดำหัวแหลม ขลิบทอง'],
        ['หมวกทรงสูงนักเชิดหุ่น', { def: 2, dex: 2, luk: 1 }, 'หมวกทรงสูงสีม่วงเข้ม ห้อยตุ๊กตาไม้ตัวจิ๋ว']],
      { fit: 1.08, seat: 0.43, dx: 0, clip: true, soft: 0.2 },
      'นักเชิดหุ่นยามค่ำคืน เชิดหุ่นไม้ตัวใหญ่ให้สู้แทน สลับที่กับหุ่นได้ ขึงด้ายเหล็กเป็นกับดัก และเกี่ยวด้ายเชิดมอนให้หันไปตีพวกเดียวกัน · เลนหุ่นรบ · เลนด้ายสังหาร'],
    lightkeeper: ['ผู้จุดตะเกียง', 'priest', 'torch', 6, 6,
      [['เสื้อคลุมผู้จุดตะเกียง', { def: 7, mdef: 6, int: 2, vit: 1 }, 'เสื้อคลุมสีครีมขลิบทอง ผ้าคลุมไหล่ส้มทอง กระเป๋าไส้ตะเกียง'],
        ['กางเกงผู้จุดตะเกียง', { def: 4, vit: 1 }, 'กางเกงสีน้ำตาล'],
        ['บูทผู้จุดตะเกียง', { def: 3 }, 'บูทหนังสีน้ำตาล หัวเข็มขัดทอง'],
        ['หมวกแก๊ปโคมเล็ก', { def: 2, mdef: 3, int: 2 }, 'หมวกแก๊ปผ้าสีครีม มีโคมทองเหลืองเล็ก ๆ ห้อยข้าง']],
      { fit: 1.25, seat: 0.45, dx: 0, clip: true, soft: 0.3 },
      'ผู้ถือแสงในคืนมืด ทุกสกิลสร้าง "เขตแสง" พวกเราที่ยืนในแสงได้ฮีล ผีกับอมตะในแสงโดนเผา กลางคืนแสงกว้างขึ้น · เลนคบเพลิงสู้ประชิด · เลนโคมแก้วฮีลเป็นพื้นที่'],
    wisp: ['ผู้เลี้ยงดวงไฟ', 'priest', 'spiritbell', 4.5, 7,
      [['ชุดคลุมผู้เลี้ยงดวงไฟ', { def: 4, mdef: 10, int: 3 }, 'ชุดคลุมยาวสีฟ้าอมเทา ปักลายหิ่งห้อยเรืองแสง กระดิ่งเงินที่เอว'],
        ['ชายชุดคลุมดวงไฟ', { def: 2, mdef: 5, int: 1 }, 'ชายชุดคลุมสีฟ้าอมเทา'],
        ['รองเท้าผ้านุ่ม', { def: 1, mdef: 3 }, 'รองเท้าผ้านุ่มสีเทา'],
        ['ผ้าคลุมหัวดวงไฟ', { mdef: 5, int: 2, dex: 1 }, 'ผ้าคลุมหัวบางสีฟ้า มีหิ่งห้อยสองดวงเกาะ']],
      { fit: 1.3, seat: 0.42, dx: 0, clip: false, soft: 0.3 }, // (a sheer veil: the hair shows through, never cut straight)
      'ผู้เลี้ยงดวงไฟวิญญาณ มีดวงไฟลอยรอบตัวสูงสุด 5 ดวง ส่งไปเกาะเพื่อนให้ฮีลและกันดาเมจ หรือสั่งพุ่งไปรุมระเบิดศัตรู · เลนดวงไฟรักษา · เลนกระดิ่งดวงไฟโจมตี'],
  };

  const items = {}, sets = [];
  for (const id in JOBS3) {
    const [name, from, weapon, hp, sp, look, fit, desc] = JOBS3[id];
    const [top, pants, shoes, hat] = look;
    items['top_' + id] = { slot: 'top', name: top[0], rig: id, rarity: 'legend', stats: top[1], desc: top[2] };
    items['pants_' + id] = { slot: 'pants', name: pants[0], rig: id, rarity: 'legend', stats: pants[1], desc: pants[2] };
    items['shoes_' + id] = { slot: 'shoes', name: shoes[0], rig: id, rarity: 'legend', stats: shoes[1], desc: shoes[2] };
    items['hat_' + id] = Object.assign({ slot: 'hat', name: hat[0], sprite: 'hat_' + id, rarity: 'legend', stats: hat[1], desc: hat[2] }, fit);
    sets.push({ id, name, icon: 'hat_' + id, items: { hair: 'hair_spiky', robe: null, cape: null, top: 'top_' + id, pants: 'pants_' + id, shoes: 'shoes_' + id, hat: 'hat_' + id, weapon } });
    if (LIVE.includes(id)) NC.JOBS[id] = { name, tier: 2, from, maxJob: 50, hp, sp, cls: id, skills: [], desc };
  }

  // ---------------- the weapons of the new types (each carries its wtype) and the shields ----------------
  // sprites stand upright, the grip at the bottom (tools/cutout.py); the moves are the existing styles
  const tuckHip = { grip: 0.3, ang: 1.05, at: [-9, -8], back: true };
  const tuckBack = { grip: 0.3, ang: -2.05, at: [-6, -30], back: true }; // (slung on the back, the head up)
  const tuckUp = { grip: 0.25, ang: -2.1, at: [-8, -12], back: true }; // (at the hip, the head up behind)
  const W = (id, o) => { items[id] = Object.assign({ slot: 'weapon', sprite: 'w_' + id, rarity: 'rare' }, o); };
  W('twinswords', { wtype: 'dsword', name: 'ดาบคู่จันทร์เสี้ยว', style: 'swing', dmg: [28, 38], hitK: 1.1, cd: 0.28, dur: 0.2, hitAt: 0.05, reach: 140, arc: 1.3, kb: 170,
    grip: 0.17, restAng: -2.0, stance: -0.55, dual: true, tuck: { grip: 0.25, ang: 2.5, at: [-4, -10], back: true }, aspd: 1.2, crit: 0.1, trailRgb: '190,225,255',
    desc: 'ดาบเรียวคู่ ขอบใบมีดเรืองฟ้า ฟันสองมือเร็ว' });
  W('orb', { wtype: 'orb', name: 'ออร์บม่วงราตรี', style: 'bolt', dmg: [26, 34], cd: 0.3, dur: 0.2, hitAt: 0.06, range: 720, kb: 140, grip: 0.18, restAng: -1.6, stance: -1.15,
    tuck: tuckUp, aspd: 1.08, magic: true, matkMul: 0.5, stats: { int: 3, skill: 0.12 }, desc: 'ลูกแก้วเวทในกรงเงิน มือเดียว ยิงลูกเวทไวกว่าคทา ถือโล่ได้' });
  W('greataxe', { wtype: 'gaxe', name: 'ขวานยักษ์ขอบแดง', style: 'smash', dmg: [70, 92], hitK: 1.9, cd: 0.62, dur: 0.34, hitAt: 0.15, reach: 175, arc: 1.6, kb: 420, grip: 0.2,
    restAng: -1.9, stance: -1.1, twoHanded: true, grip2: 12, behind: true, tuck: tuckBack, aspd: 0.85, stun: 1, trailRgb: '255,200,170', desc: 'ขวานสองมือหัวใหญ่ ทุบแรง มึน' });
  W('mace', { wtype: 'mace', name: 'กระบองเหล็กครีบ', style: 'swing', dmg: [44, 58], hitK: 1.3, cd: 0.4, dur: 0.24, hitAt: 0.07, reach: 145, arc: 1.3, kb: 280, grip: 0.18,
    restAng: -1.95, stance: -0.9, tuck: tuckHip, aspd: 0.95, trailRgb: '255,240,200', desc: 'กระบองมือเดียว ถือโล่ได้' });
  W('spear_short', { wtype: 'spear', name: 'หอกสั้นพู่แดง', style: 'thrust', dmg: [40, 54], hitK: 1.05, cd: 0.36, dur: 0.22, hitAt: 0.07, reach: 225, arc: 0.4, kb: 260,
    grip: 0.3, restAng: -1.62, stance: -0.25, tuck: { grip: 0.45, ang: -2.05, at: [-5, -28], back: true }, aspd: 1.05, desc: 'หอกมือเดียว แทงไกล ถือโล่ได้' });
  W('scythe', { wtype: 'scythe', name: 'เคียวยมทูต', style: 'swing', dmg: [82, 106], hitK: 1.8, cd: 0.56, dur: 0.32, hitAt: 0.12, reach: 200, arc: 2.0, kb: 300, grip: 0.18,
    restAng: -2.35, stance: -0.75, behind: true, twoHanded: true, grip2: 12, tuck: tuckBack, aspd: 0.9, trailRgb: '200,210,235', desc: 'เคียวใหญ่สองมือ กวาดกว้าง' });
  W('sickles', { wtype: 'sickle', name: 'เคียวคู่เงา', style: 'swing', dmg: [44, 58], cd: 0.26, dur: 0.18, hitAt: 0.05, reach: 130, arc: 1.3, kb: 150, grip: 0.2, restAng: -1.9,
    stance: -0.5, dual: true, tuck: { grip: 0.25, ang: 2.5, at: [-4, -10], back: true }, aspd: 1.4, crit: 0.2, trailRgb: '210,210,235', desc: 'เคียวมือคู่ ตีเร็ว' });
  W('katar', { wtype: 'katar', name: 'คาทาร์แดง', style: 'swing', dmg: [40, 52], cd: 0.26, dur: 0.18, hitAt: 0.05, reach: 125, arc: 1.2, kb: 150, grip: 0.12, restAng: -1.9,
    stance: -0.5, dual: true, tuck: { grip: 0.25, ang: 2.5, at: [-4, -10], back: true }, aspd: 1.2, crit: 0.3, trailRgb: '255,150,150', desc: 'มีดกำปั้นคู่ คริติคอลสูง' });
  W('knuckle', { wtype: 'knuckle', name: 'สนับมือหนัง', style: 'swing', dmg: [32, 42], cd: 0.24, dur: 0.16, hitAt: 0.05, reach: 115, arc: 1.1, kb: 180, grip: 0.3, restAng: -1.9,
    stance: -0.5, dual: true, tuck: { grip: 0.3, ang: 2.5, at: [-4, -10], back: true }, aspd: 1.4, desc: 'สนับมือคู่ ต่อยรัว' });
  W('holybook', { wtype: 'book', name: 'คัมภีร์ตะวัน', style: 'swing', dmg: [38, 50], cd: 0.4, dur: 0.24, hitAt: 0.07, reach: 130, arc: 1.2, kb: 220, grip: 0.3, restAng: -1.9,
    stance: -0.9, tuck: tuckHip, aspd: 1, stats: { int: 2 }, desc: 'คัมภีร์ปกทองหนา ใช้ฟาด ถือโล่ได้' });
  // (ranged: DEX makes their ATK like a bow's, stats.js · shot: what flies out instead of a magic bolt, jobs3_skills_b.js)
  W('lute', { wtype: 'instrument', name: 'พิณน้ำผึ้ง', style: 'bolt', ranged: true, shot: 'note', dmg: [32, 42], cd: 0.34, dur: 0.22, hitAt: 0.06, range: 700, kb: 140,
    grip: 0.25, restAng: -1.6, stance: -1.15, tuck: tuckBack, aspd: 1, desc: 'พิณไม้สีน้ำผึ้ง ดีดตัวโน้ตพุ่งไปใส่ศัตรู' });
  W('whip', { wtype: 'whip', name: 'แส้หนังไฟ', style: 'swing', ranged: true, hitK: 1.2, dmg: [42, 56], cd: 0.34, dur: 0.22, hitAt: 0.07, reach: 230, arc: 1.2, kb: 200, grip: 0.2, restAng: -1.9,
    stance: -0.6, tuck: tuckHip, aspd: 1.05, trailRgb: '255,190,140', desc: 'แส้หนังยาว ฟาดไกล' });
  W('pistols', { wtype: 'pistol', name: 'ปืนพกคู่ทองเหลือง', style: 'bolt', ranged: true, shot: 'bullet', dual: true, dmg: [38, 50], cd: 0.26, dur: 0.18, hitAt: 0.05,
    range: 760, kb: 120, grip: 0.14, restAng: -1.2, stance: -0.3, tuck: { grip: 0.2, ang: 1.4, at: [-2, -6], back: true }, aspd: 1.3, crit: 0.05,
    desc: 'ปืนลูกโม่คู่ ยิงเร็ว ลูกโม่ 6 นัด' });
  W('shotgun', { wtype: 'shotgun', name: 'ลูกซองสองลำกล้อง', style: 'bolt', ranged: true, shot: 'pellet', twoHanded: true, grip2: 10, dmg: [66, 86], hitK: 1.3,
    cd: 0.5, dur: 0.3, hitAt: 0.08, range: 420, kb: 320, grip: 0.3, restAng: -1.3, stance: -0.35, tuck: tuckBack, aspd: 0.8,
    desc: 'ลูกซองสองลำกล้อง ยิงแรง ระยะใกล้' });
  W('spiritbell', { wtype: 'bell', name: 'กระดิ่งวิญญาณ', style: 'bolt', dmg: [30, 40], cd: 0.34, dur: 0.22, hitAt: 0.06, range: 450, kb: 120, grip: 0.2, restAng: -1.6,
    stance: -1.15, tuck: tuckUp, aspd: 1, magic: true, matkMul: 0.5, shot: 'chime', stats: { int: 2 }, desc: 'กระดิ่งเงิน มีหิ่งห้อยเรืองในปากกระดิ่ง ตีปกติเป็นคลื่นเสียง' });
  W('puppetbar', { wtype: 'puppet', name: 'ไม้เชิดหุ่นกากบาท', style: 'bolt', shot: 'thread', dmg: [34, 44], cd: 0.34, dur: 0.22, hitAt: 0.06, range: 420, kb: 120,
    grip: 0.2, restAng: -1.6, stance: -1.15, tuck: tuckUp, aspd: 1.05, desc: 'ไม้กากบาทห้อยด้ายเรืองแสง สะบัดด้ายใส่ศัตรูและสั่งหุ่นรบ ถือโล่ได้' });
  W('steelwire', { wtype: 'wire', name: 'ม้วนด้ายเหล็ก', style: 'thrust', dual: true, dmg: [40, 54], hitK: 1.05, cd: 0.3, dur: 0.2, hitAt: 0.06, reach: 300, arc: 0.3, kb: 160,
    grip: 0.3, restAng: -1.9, stance: -0.5, tuck: { grip: 0.3, ang: 2.5, at: [-4, -10], back: true }, aspd: 1.3, trailRgb: '220,230,245',
    desc: 'ม้วนด้ายเหล็กคู่ สะบัดด้ายไกล 300 ทะลุทั้งแนว' });
  W('torch', { wtype: 'torch', name: 'คบเพลิงศักดิ์สิทธิ์', style: 'swing', dmg: [48, 64], hitK: 1.4, cd: 0.38, dur: 0.24, hitAt: 0.07, reach: 150, arc: 1.3, kb: 220, grip: 0.18,
    restAng: -1.95, stance: -0.9, tuck: tuckUp, aspd: 1, trailRgb: '255,220,140', desc: 'คบเพลิงไฟทองอมขาว ถือโล่ได้' });
  // (the old jobs' new lanes: the ranger's crossbow, the shinobi's huuma)
  W('crossbow', { wtype: 'xbow', name: 'หน้าไม้พราน', style: 'arrow', dmg: [44, 58], cd: 0.5, dur: 0.3, hitAt: 0.1, range: 950, kb: 200, grip: 0.3, restAng: -1.5,
    stance: -1.5, tuck: tuckBack, aspd: 0.85, crit: 0.08, trailRgb: '255,240,200', desc: 'หน้าไม้สองมือ ยิงหนักและแม่น แต่ช้ากว่าธนู' });
  W('huuma', { wtype: 'huuma', name: 'ดาวกระจายยักษ์', style: 'swing', dmg: [58, 76], hitK: 1.5, cd: 0.5, dur: 0.3, hitAt: 0.1, reach: 175, arc: 1.7, kb: 300, grip: 0.5,
    restAng: -2.0, stance: -0.8, twoHanded: true, grip2: 0, behind: true, tuck: { grip: 0.5, ang: 1.95, at: [-6, -40], back: true }, aspd: 0.9, trailRgb: '220,220,235',
    desc: 'ดาวกระจายยักษ์สี่แฉก ฟันกว้าง' });
  // shields: the off hand (weapons.js: only with a one-handed weapon)
  const SH = (id, o) => { items[id] = Object.assign({ slot: 'shield', sprite: 'w_' + id, rarity: 'common' }, o); };
  SH('buckler', { name: 'โล่ไม้กลม', stats: { def: 6, mdef: 1 }, desc: 'โล่ไม้ขอบเหล็กใบเล็ก เบา' });
  SH('kiteshield', { name: 'โล่อัศวินกางเขนทอง', rarity: 'rare', stats: { def: 12, mdef: 3, vit: 1 }, desc: 'โล่ทรงว่าวสีเงิน พื้นน้ำเงิน กางเขนทอง' });
  // the shield line by level (2026-10-20, after Discord #96: nothing to carry from Lv 50 to 99): each the drop of its own
  // monsters (js/shieldloot.js); art assets/shields/ (assets/gen/make_shields_prompts.py, tools/shield_art.py)
  if (NC.ASSET_MANIFEST_SHIELDS) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_SHIELDS);
  SH('sh_mossshell', { name: 'โล่กระดองเต่าตะไคร่', lvReq: 20, stats: { def: 8, mdef: 2, hp: 40 }, desc: 'กระดองเต่าทรงโดมเขียวขี้ม้า มีมอสกับยอดเฟิร์นเล็ก ๆ' });
  SH('sh_glowwing', { name: 'โล่ปีกแข็งหิ่งห้อย', lvReq: 30, stats: { def: 10, mdef: 3, hit: 4 }, desc: 'ปีกแข็งด้วงสองซีกประกบกัน ท้องหิ่งห้อยเรืองแสงตรงล่าง' });
  SH('sh_owlstone', { name: 'โล่นกฮูกศิลา', rarity: 'rare', lvReq: 55, stats: { def: 14, mdef: 6, int: 1 }, desc: 'หินสลักรูปนกฮูกหุบปีก ตาสองดวงเรืองแสงในวงทองเหลือง' });
  SH('sh_geode', { name: 'โล่จีโอดผลึก', rarity: 'rare', lvReq: 65, stats: { def: 16, mdef: 4, vit: 2 }, desc: 'หินจีโอดผ่าซีก ขอบหินแดง ด้านในเต็มไปด้วยผลึกม่วง' });
  SH('sh_hollowcrest', { name: 'โล่หอคอยเมืองร้าง', rarity: 'epic', lvReq: 75, stats: { def: 18, mdef: 5, vit: 2, hp: 150 }, desc: 'โล่หอคอยเหล็กดำของยามเมืองชั้นนอก ตราประตูเมืองกับกุญแจทอง' });
  SH('sh_mistclam', { name: 'โล่หอยมุกทะเลหมอก', rarity: 'epic', lvReq: 85, stats: { def: 20, mdef: 7, vit: 3 }, desc: 'เปลือกหอยพัดใบใหญ่ ปะการังซีดที่ขอบ มุกเรืองแสงตรงกลางล่าง' });
  SH('sh_midnight', { name: 'โล่หน้าปัดเที่ยงคืน', rarity: 'legend', lvReq: 95, stats: { def: 23, mdef: 8, vit: 3, hp: 300 }, desc: 'โล่กลมเป็นหน้าปัดนาฬิกาดำทอง เข็มทั้งสองชี้เที่ยงคืน' });

  // the shield in the far hand (avatar.js calls this right after the far arm): upright, its middle on the fist, turned
  // a little with the arm; not with a two-handed weapon
  NC.drawOffhand = function (ctx, equip, S, P, o) {
    const sh = equip && equip.shield && NC.ITEMS[equip.shield], w = equip && NC.ITEMS[equip.weapon];
    if (!sh || !S.armFar || (w && (w.twoHanded || w.dual || (NC.WTYPES && NC.WTYPES[w.wtype] && NC.WTYPES[w.wtype].h === 2)))) return;
    const s = NC.SPR[sh.sprite];
    if (!s) return;
    const f = S.armFar, ang = Math.atan2(f.end[1] - f.J[1], f.end[0] - f.J[0]);
    const k = 0.8, ww = s.w * k, hh = s.h * k;
    ctx.save();
    ctx.translate(f.end[0], f.end[1] - 4);
    ctx.rotate((ang - Math.PI / 2) * 0.25);
    ctx.drawImage(o.silhouette ? NC.tinted(s.name, o.silhouette) : s.img, -ww * 0.45, -hh * 0.55, ww, hh);
    ctx.restore();
  };

  NC.JOBS3 = { items, sets, jobs: Object.keys(JOBS3), live: LIVE };
})();
