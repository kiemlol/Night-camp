/* glasses2.js — 20 more pairs of glasses for the แว่น slot (the user, 2026-09-29: "แว่นตาอีก 20 แบบ"). Art: sheets 2-5 of
   assets/gen/make_glasses_prompts.py (MORE) -> tools/glasscut.py 2 3 4 5 (writes their lens centres into
   assets/glasses.manifest.js, merged by js/glasses.js); drawn by NC.drawGlasses like the first eight. Loaded after
   items.js: adds its items to NC.ITEMS and the collection order itself. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS;
  const list = [];
  const add = (id, name, rarity, stats, desc, lvReq) => {
    ITEMS[id] = { slot: 'glasses', name, sprite: id, rarity, stats, desc, fit: 1, dx: 0, dy: 0, lvReq };
    list.push(id);
  };
  add('glasses_aviator', 'แว่นนักบินกรอบทอง', 'rare', { crit: 0.04, hit: 4 }, 'กรอบทองบางทรงหยดน้ำ เลนส์เขียวเข้มสะท้อนทอง', 20);
  add('glasses_cateye', 'แว่นตาแมวชมพู', 'fashion', { luk: 2, agi: 1 }, 'กรอบชมพูปลายตวัดขึ้น ประดับเพชรเม็ดจิ๋ว');
  add('glasses_rose', 'แว่นกลมเลนส์ชมพู', 'fashion', { luk: 3 }, 'กรอบเงินกลมบาง มองโลกผ่านเลนส์สีกุหลาบ');
  add('glasses_swim', 'แว่นว่ายน้ำ', 'common', { flee: 3, spd: 0.02 }, 'แว่นว่ายน้ำสีฟ้าน้ำทะเล พร้อมลงลำธาร', 8);
  add('glasses_ski', 'แว่นสกีเลนส์รุ้ง', 'epic', { def: 3, flee: 5 }, 'เลนส์โค้งกว้างสะท้อนสีรุ้ง สายรัดลายทาง', 55);
  add('glasses_patch', 'ผ้าปิดตาโจรสลัด', 'rare', { str: 2, crit: 0.03 }, 'ผ้าปิดตาสีดำข้างเดียว ดูน่าเกรงขาม', 30);
  add('glasses_tape', 'แว่นกรอบหนาพันเทป', 'common', { int: 1, dex: 1 }, 'กรอบดำหนาหักกลาง พันพลาสเตอร์ไว้ ยังใช้ได้อยู่', 5);
  add('glasses_leaf', 'แว่นกรอบใบไม้', 'fashion', { hp: 15, luk: 1 }, 'ใบไม้เขียวล้อมเลนส์ สะพานเป็นกิ่งไม้');
  add('glasses_flower', 'แว่นกรอบดอกไม้', 'fashion', { luk: 2, sp: 10 }, 'กลีบดอกไม้สีชมพูเหลืองล้อมเลนส์');
  add('glasses_bat', 'แว่นปีกค้างคาว', 'rare', { agi: 2, flee: 3 }, 'กรอบม่วงเข้ม ปีกค้างคาวงอกสองข้าง', 25);
  add('glasses_flame', 'แว่นเปลวไฟ', 'epic', { str: 2, crit: 0.04 }, 'กรอบเป็นเปลวไฟสีส้มแดงลุกขึ้นรอบเลนส์', 50);
  add('glasses_loupe', 'แว่นนักประดิษฐ์เลนส์ซ้อน', 'rare', { dex: 3, hit: 3 }, 'กรอบทองเหลือง แว่นขยายจิ๋วพับออกข้างเลนส์', 35);
  add('glasses_moth', 'แว่นปีกผีเสื้อราตรี', 'rare', { int: 2, sp: 15 }, 'กรอบม่วงอ่อนเป็นปีกผีเสื้อกลางคืน ลายตาจิ๋ว', 40);
  add('glasses_catface', 'แว่นหน้าแมว', 'fashion', { agi: 2 }, 'กรอบดำกลม หูแมวบนกรอบ หนวดแมวสองข้าง');
  add('glasses_hex', 'แว่นหกเหลี่ยมทอง', 'rare', { int: 2, dex: 1 }, 'ลวดทองบางทรงหกเหลี่ยม', 28);
  add('glasses_ice', 'แว่นคริสตัลน้ำแข็ง', 'epic', { int: 3, mdef: 3 }, 'กรอบเกล็ดคริสตัลน้ำแข็งสีฟ้าอ่อน', 60);
  add('glasses_wood', 'แว่นกรอบไม้', 'common', { vit: 1, hp: 10 }, 'กรอบกลมไม้สีน้ำตาลอุ่น เห็นลายไม้', 3);
  add('glasses_browline', 'แว่นนักสืบครึ่งกรอบ', 'rare', { int: 1, hit: 4 }, 'ขอบบนลายกระดองเต่า ขอบล่างลวดเงิน', 22);
  add('glasses_mirror', 'แว่นกันแดดปรอทรุ้ง', 'epic', { crit: 0.05, flee: 4 }, 'แว่นกีฬาทรงโค้ง เลนส์ปรอทสะท้อนชมพูม่วง', 65);
  add('glasses_visor', 'แว่นวิชั่นไซเบอร์', 'legend', { dex: 3, hit: 6, crit: 0.03 }, 'เลนส์โค้งยาวชิ้นเดียวเรืองแสงฟ้า กรอบเงินบาง', 80);
  if (NC.GLASSES) NC.GLASSES.more = list;
  if (NC.ITEM_ORDER) for (const id of list) if (!NC.ITEM_ORDER.includes(id)) NC.ITEM_ORDER.push(id);
})();
