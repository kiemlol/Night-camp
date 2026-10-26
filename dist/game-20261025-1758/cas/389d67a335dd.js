/* priest.js — the priest (พระ), a first job like the knight, mage, archer and rogue: the holy healer and support of the
   party. This file holds its data: the outfit (top / pants / shoes on rig 'priest'), the cap and the holy staff, the
   class set, the job and its skills (what they cost and do in numbers). The skills' effects, the blessing buff and the
   class buttons are in priest_skills.js.
   Loaded after stats.js and before items.js (items.js merges NC.PRIEST.items into NC.ITEMS, so the pieces show in the
   equipment screen and drop like any other). Art: assets/priest/ + assets/priest.manifest.js, merged into the main
   manifest here (the HUD's icons and the item pictures read that one). */
(function () {
  'use strict';
  const NC = window.NC;
  if (NC.ASSET_MANIFEST_PRIEST) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_PRIEST);
  // Heal's icon was made with the HUD icons (tools/hud_icons.py -> maps.manifest.js); the HUD reads the main manifest
  if (!NC.ASSET_MANIFEST.sk_heal && NC.ASSET_MANIFEST_MAPS && NC.ASSET_MANIFEST_MAPS.sk_heal) NC.ASSET_MANIFEST.sk_heal = NC.ASSET_MANIFEST_MAPS.sk_heal;

  const items = {
    top_priest: { slot: 'top', name: 'เสื้อนักบวชแสงตะวัน', rig: 'priest', rarity: 'epic', stats: { mdef: 6, int: 2, sp: 20 },
      desc: 'ผ้าขาวแถบฟ้าขลิบทอง ตราตะวันสีทองที่อก' },
    pants_priest: { slot: 'pants', name: 'ชายเสื้อนักบวช', rig: 'priest', rarity: 'epic', stats: { mdef: 3, vit: 1 },
      desc: 'ชายผ้าขาวยาวถึงข้อเท้า แถบฟ้าขลิบทอง' },
    shoes_priest: { slot: 'shoes', name: 'รองเท้านักบวช', rig: 'priest', rarity: 'epic', stats: { spd: 0.03 }, desc: 'นุ่มเบา เดินได้ทั้งวัน' },
    hat_priest: { slot: 'hat', name: 'หมวกนักบวช', sprite: 'hat_priest', rarity: 'epic', fit: 1.12, seat: 0.33, dx: 0, clip: true, soft: 0.4,
      rim: [[0.0, 0.2204], [0.0854, 0.3721], [0.1646, 0.6311], [0.25, 0.5954], [0.3354, 0.5596], [0.4146, 0.5329], [0.5, 0.5061], [0.5854, 0.4882], [0.6646, 0.4793], [0.75, 0.4793], [0.8354, 0.4971], [0.9146, 0.515], [1.0, 0.0864]],
      stats: { int: 2, sp: 15 }, desc: 'หมวกผ้าขาว แถบฟ้า ตราตะวันสีทอง' },
    // the mage's staff in holy wood: the same grip and moves, bolts of holy light
    staff_holy: { slot: 'weapon', name: 'คทาแสงตะวัน', sprite: 'staff_holy', rarity: 'legend', style: 'bolt', dmg: [32, 42], cd: 0.34, dur: 0.22,
      hitAt: 0.06, range: 760, kb: 160, grip: 0.3, restAng: -1.6, stance: -1.15, tuck: { grip: 0.42, ang: -1.22, at: [15, -22], back: true },
      aspd: 1.05, magic: true, matkMul: 0.45, element: 'holy', stats: { int: 4, skill: 0.1 },
      desc: 'ยิงลูกแสงศักดิ์สิทธิ์ (ธาตุแสง แรงกับอมตะและความมืด) และเพิ่มพลังสกิล' },
  };
  const cls = { id: 'priest', name: 'พระ', icon: 'hat_priest',
    items: { hair: 'hair_spiky', robe: null, cape: null, top: 'top_priest', pants: 'pants_priest', shoes: 'shoes_priest', hat: 'hat_priest', weapon: 'staff_holy' } };
  NC.PRIEST = { items, cls };

  NC.JOBS.priest = { name: 'พระ', tier: 1, maxJob: 50, hp: 4.5, sp: 5.5, cls: 'priest',
    skills: ['pr_heal', 'blessing', 'holylight', 'magnus', 'mastery', 'body', 'mind'],
    desc: 'ผู้รับใช้แสงศักดิ์สิทธิ์ รักษาตัวเองและเพื่อน อวยพรให้แรงขึ้น เวทแสงแรงกับอมตะและความมืด' };

  const S = (o) => Object.assign({ max: 10, active: true }, o);
  Object.assign(NC.SKILLS, {
    pr_heal: S({ key: 'Q', name: 'แสงเยียวยา', icon: 'sk_heal', type: 'magic', element: 'holy', cd: 3, sp: (lv) => 12 + lv * 2, mul: (lv) => 1.2 + lv * 0.2,
      heal: (lv) => 8 + lv * 1.2,
      desc: (lv, m) => `ฟื้น HP ตัวเองและเพื่อนในปาร์ตี้รอบตัว ${Math.round(8 + lv * 1.2)}% ของ HP สูงสุด + ตามพลังเวท · มอนอมตะ/ความมืดรอบตัวโดนแสง ${m}% ของ MATK` }),
    blessing: S({ key: 'E', name: 'พรศักดิ์สิทธิ์', icon: 'sk_blessing', type: 'buff', element: 'holy', cd: 20, sp: (lv) => 20 + lv * 2, mul: () => 0,
      dur: (lv) => 30 + lv * 3, pct: (lv) => 6 + lv * 1.5,
      desc: (lv) => `อวยพรตัวเองและเพื่อนในปาร์ตี้ ${30 + lv * 3} วิ: ATK และ MATK +${6 + lv * 1.5}% ความแม่น +${4 + lv * 2}` }),
    holylight: S({ key: 'R', name: 'แสงศักดิ์สิทธิ์', icon: 'sk_holylight', type: 'magic', element: 'holy', cd: 4, sp: (lv) => 14 + lv * 2,
      mul: (lv) => 4.2 + lv * 0.7, desc: (lv, m) => `ลำแสงจากฟ้าฟาดลงศัตรูใกล้เมาส์ ${m}% ของ MATK ธาตุแสง` }),
    magnus: S({ key: 'F', name: 'วงเวทแสงขับมาร', icon: 'sk_magnus', ult: true, type: 'magic', element: 'holy', cd: 45, sp: (lv) => 45 + lv * 4,
      mul: (lv) => 2.2 + lv * 0.3, desc: (lv, m) => `วงเวทศักดิ์สิทธิ์ขนาดใหญ่ เสาแสงผุด 8 ระลอก ระลอกละ ${m}% ของ MATK ธาตุแสง` }),
  });
  for (const id of ['pr_heal', 'blessing', 'holylight', 'magnus']) NC.SKILLS[id].id = id;
})();
