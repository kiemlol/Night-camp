/* swords.js — 40 one-handed swords (ดาบมือเดียว), the second weapon type of the item plan (the user, 2026-09-29: "ทำแค่
   มาใส่ได้เฉย ๆ ก่อน": pictures and holding them first; abilities, drops and the blacksmith come later, as for the
   greatswords). Grades by level like the greatswords (1 Lv 1–25 · 2 Lv 26–50 · 3 Lv 51–75 · 4 Lv 76–99), mid ATK
   50 / 80 / 110 / 140 (a one-handed sword: faster, a shield in the other hand); kinds A ธรรมดา · B ออป · C เวท ·
   D บอส · L ตำนาน set the rarity (and, later, what they can do).
   Each entry: [id, name, grade, kind, element, Lv, ATK, look]. They are plain collection items for now (they drop like
   any item; ?allitems gives them all); every sword holds like the old ดาบนักเดินทาง, whose moves they take, and so
   the Pose Studio's sword hold. Art: assets/gen/make_sw_prompts.py -> Codex -> python tools/gs_art.py sw
   (assets/swords/, assets/swords.manifest.js: NC.ASSET_MANIFEST_SW, with each sprite's grip). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS;
  if (NC.ASSET_MANIFEST_SW) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_SW);
  const RARITY = { A: 'common', B: 'rare', C: 'epic', D: 'legend', L: 'legend' };
  const TRAIL = { neutral: '210,230,255', water: '150,210,255', wind: '170,240,200', earth: '225,185,125', fire: '255,150,80', poison: '190,140,255',
    holy: '255,232,160', shadow: '175,140,235', ghost: '200,255,240', undead: '190,215,190' };
  const L = [
    // ---- grade 1 (Lv 1–25) ----
    ['sw_twig', 'ดาบกิ่งไม้', 1, 'A', 'neutral', 1, 40, 'กิ่งไม้เหลาเป็นดาบ ใบไม้งอกที่การ์ด'],
    ['sw_copper', 'ดาบสั้นทองแดง', 1, 'A', 'neutral', 8, 50, 'ใบดาบรูปใบไม้ทองแดง มีสนิมเขียวเป็นจุด ๆ'],
    ['sw_honey', 'ดาบน้ำผึ้ง', 1, 'B', 'neutral', 12, 46, 'ใบดาบผลึกน้ำผึ้งสีอำพัน การ์ดรังผึ้ง ผึ้งจิ๋วนั่งที่ด้าม'],
    ['sw_beesting', 'ดาบเรเปียร์เหล็กในผึ้ง', 1, 'C', 'wind', 15, 44, 'ใบแหลมเรียวเหมือนเหล็กในผึ้ง การ์ดลายเหลืองดำ'],
    ['sw_crowfeather', 'ดาบขนอีกา', 1, 'B', 'shadow', 18, 46, 'ขนนกดำเหลือบรุ้ง การ์ดเป็นหัวอีกา'],
    ['sw_pumpkin', 'ดาบฟักทอง', 1, 'B', 'earth', 10, 46, 'ใบดาบเถาฟักทองม้วนปลาย การ์ดเป็นฟักทองแกะหน้ายิ้ม'],
    ['sw_crabclaw', 'ดาบก้ามปู', 1, 'C', 'water', 20, 44, 'ก้ามปูสีแดงส้ม ปลายเป็นคีมสองแฉก'],
    ['sw_batfangs', 'ดาบเขี้ยวคู่ราชาค้างคาว', 1, 'D', 'shadow', 22, 60, 'ดาบโค้งปลายแยกเป็นเขี้ยวคู่ ตาอัญมณีแดง'],
    // ---- grade 2 (Lv 26–50) ----
    ['sw_iron', 'ดาบอัศวินเหล็กกล้า', 2, 'A', 'neutral', 26, 80, 'ดาบอัศวินคลาสสิก ใบตรงมีร่องกลาง ด้ามหนังน้ำเงิน'],
    ['sw_bonesaber', 'ดาบโค้งกระดูกซี่โครง', 2, 'A', 'neutral', 32, 84, 'ซี่โครงโค้งยาว มีข้อกระดูกสันหลังตามสัน'],
    ['sw_turtle', 'ดาบกระดองเต่า', 2, 'B', 'earth', 30, 74, 'ใบกว้างหุ้มกระดองเต่าตะไคร่ หัวเต่าโผล่ที่ด้าม'],
    ['sw_dragonfly', 'ดาบแทงปีกแมลงปอ', 2, 'B', 'wind', 36, 74, 'ใบเรียวยาวสำหรับแทง ปีกแมลงปอสี่ปีกเป็นการ์ด'],
    ['sw_serpent', 'ดาบอสรพิษหนองน้ำ', 2, 'C', 'poison', 40, 70, 'ใบดาบคดเคี้ยวเป็นตัวงู การ์ดเป็นหัวงูเขี้ยวยาว'],
    ['sw_patchwork', 'ดาบมีดปังตอผ้าปะ', 2, 'B', 'shadow', 34, 74, 'มีดปังตอขึ้นสนิม ปะแผ่นเหล็กกับผ้าเย็บ'],
    ['sw_ghostflame', 'ดาบดวงไฟวิญญาณ', 2, 'C', 'ghost', 42, 70, 'ใบดาบเป็นเปลวไฟผีสีฟ้าขาว ออกจากกรงตะเกียง'],
    ['sw_scorpion', 'ดาบหางแมงป่อง', 2, 'C', 'fire', 38, 70, 'ใบดาบเป็นปล้องหางแมงป่อง ปลายเป็นเหล็กในเรืองแสง'],
    ['sw_whirlwind', 'ดาบลมหมุน', 2, 'B', 'wind', 44, 74, 'ใบดาบบิดเป็นเกลียว ลูกแก้วลมหมุนที่การ์ด'],
    ['sw_antsoldier', 'ดาบทหารมด', 2, 'A', 'earth', 46, 86, 'เปลือกมดสีแดงซ้อนเป็นปล้อง หนวดมดเป็นการ์ด'],
    ['sw_mushcap', 'ดาบหมวกเห็ดราชา', 2, 'D', 'poison', 50, 96, 'ใบดาบก้านเห็ดจุดเรืองแสง หมวกเห็ดม่วงเป็นการ์ด'],
    ['sw_amber', 'ดาบอำพันนางพญามด', 2, 'D', 'earth', 50, 96, 'ผลึกอำพันมีหิ่งห้อยติดอยู่ข้างใน การ์ดมงกุฎทอง'],
    // ---- grade 3 (Lv 51–75) ----
    ['sw_moonsteel', 'ดาบเหล็กจันทรา', 3, 'A', 'neutral', 52, 110, 'เหล็กสีเงินอมฟ้า ลายสลักพลิ้ว การ์ดปีกเล็ก'],
    ['sw_obsidian', 'ดาบแก้วภูเขาไฟ', 3, 'A', 'fire', 60, 114, 'แก้วภูเขาไฟดำกะเทาะเป็นเหลี่ยมคม'],
    ['sw_heron', 'ดาบโค้งนกกระสาเงา', 3, 'B', 'shadow', 66, 102, 'ใบคมเดียวโค้งเล็กน้อย ขนนกกระสาห้อยที่ด้าม'],
    ['sw_kappa', 'ดาบโค้งกัปปะ', 3, 'C', 'water', 62, 97, 'ดาบโค้งสั้น การ์ดกระดองเต่ามีจานน้ำ'],
    ['sw_bonecross', 'ดาบอัศวินกระดูก', 3, 'A', 'shadow', 56, 112, 'เหล็กดำโกธิก การ์ดซี่โครง อัญมณีวิญญาณเขียว'],
    ['sw_mistveil', 'ดาบผ้าคลุมหมอก', 3, 'C', 'shadow', 68, 97, 'ใบดาบพันผ้าขาดปลิวเป็นหมอก'],
    ['sw_salamander', 'ดาบเกล็ดซาลาแมนเดอร์', 3, 'C', 'fire', 64, 97, 'ใบดาบเป็นลอนเปลวไฟ เกล็ดแดงจุดเหลือง'],
    ['sw_toad', 'ดาบคางคกพิษ', 3, 'B', 'poison', 58, 102, 'ใบม่วงเป็นปุ่ม ขวดพิษเขียวสามขวด การ์ดหัวคางคก'],
    ['sw_raptorclaw', 'ดาบกรงเล็บแร็พเตอร์', 3, 'B', 'wind', 72, 102, 'ใบดาบงอเป็นตะขอเหมือนกรงเล็บ เกล็ดเขียว'],
    ['sw_cryptcrown', 'ดาบมงกุฎราชาสุสาน', 3, 'D', 'shadow', 55, 132, 'ดาบดำยาว อักษรไฟสีฟ้า การ์ดมงกุฎเหล็กมีหนาม'],
    // ---- grade 4 (Lv 76–99) ----
    ['sw_starmetal', 'ดาบเหล็กดวงดาว', 4, 'A', 'neutral', 76, 140, 'เหล็กดวงดาวสีเข้มมีประกายเงิน งานชั้นครู'],
    ['sw_beetle', 'ดาบเปลือกด้วงแรด', 4, 'A', 'earth', 80, 144, 'เปลือกด้วงเขียวครามเหลือบรุ้ง เขาเล็กที่การ์ด'],
    ['sw_lavaworm', 'ดาบเกล็ดหนอนลาวา', 4, 'A', 'fire', 84, 146, 'แผ่นหินดำซ้อนกัน รอยต่อเรืองส้ม ขอบหยัก'],
    ['sw_elderwood', 'ดาบไม้ต้นไม้โบราณ', 4, 'B', 'earth', 82, 130, 'ไม้โบราณลายเส้นเรืองเขียว มีดอกไม้ผลิ'],
    ['sw_stormeye', 'ดาบตาพายุ', 4, 'B', 'wind', 88, 130, 'ขอบสีฟ้าสายฟ้า ลูกแก้วพายุหมุนที่การ์ด'],
    ['sw_impfork', 'ดาบส้อมอิมป์', 4, 'C', 'fire', 86, 124, 'ปลายแยกเป็นส้อมสองง่าม เขาอิมป์ที่การ์ด'],
    ['sw_frostfang', 'ดาบเขี้ยวน้ำแข็ง', 4, 'C', 'water', 90, 124, 'ใบดาบเป็นแท่งน้ำแข็งหยัก ผลึกน้ำแข็งงอกที่การ์ด'],
    ['sw_eclipse', 'ดาบสุริยุปราคา', 4, 'C', 'shadow', 92, 124, 'ใบดำขอบทอง การ์ดจานดำมีวงไฟทอง'],
    ['sw_dragonfang', 'ดาบเขี้ยวมังกรลาวา', 4, 'D', 'fire', 92, 170, 'เขี้ยวมังกรโค้ง รอยแตกลาวา เกล็ดมังกรที่ด้าม'],
    ['sw_dawn', 'ดาบรุ่งอรุณ', 4, 'L', 'holy', 95, 185, 'ใบดาบไล่สีทองขาวถึงชมพูส้มรุ่งเช้า การ์ดรัศมีตะวันขึ้น'],
  ];
  const T = ITEMS.sword; // the moves, grip and feel of the old ดาบนักเดินทาง
  const SW = (NC.SWORDS = { list: [], byId: {} });
  for (const [id, name, grade, kind, el, lv, atk, look] of L) {
    const m = (NC.ASSET_MANIFEST_SW || {})[id];
    const it = {
      id, slot: 'weapon', wtype: 'sword', sprite: id, name, rarity: RARITY[kind], style: 'swing',
      dmg: [Math.round(atk * 0.88), Math.round(atk * 1.12)], hitK: T.hitK, cd: T.cd, dur: T.dur, hitAt: T.hitAt, reach: T.reach, arc: T.arc, kb: T.kb,
      grip: (m && m.grip) || T.grip, restAng: T.restAng, stance: T.stance, tuck: T.tuck, aspd: T.aspd, trailRgb: TRAIL[el] || TRAIL.neutral,
      element: el === 'neutral' ? undefined : el, lvReq: lv, sw: { grade, kind, atk, lv, look }, desc: look,
    };
    if (T.sig) it.sig = T.sig;
    ITEMS[id] = it;
    SW.list.push(id);
    SW.byId[id] = it;
  }
  // the item order (js/items.js: the drop pool): after the greatswords
  if (NC.ITEM_ORDER) for (const id of SW.list) if (!NC.ITEM_ORDER.includes(id)) NC.ITEM_ORDER.push(id);
})();
