/* lessons.js — บทนำเป็นบทสอน: the first chapter taught by the camp's own people (the user, 2026-10-17: "เเก้ระบบเควส ...
   ทำเป็นรับเควสจาก npc เเล้วเริ่มสอนจริงจังเลยไหม" -> the recommended way: chapter 1 is the tutorial, each NPC gives a
   hands-on lesson quest, the ember spirit is the guide; looks: mockup A, assets/gen/nightcamp_questui_a_raw.png; the
   lesson list the user approved: lumen x2, Bruno, Hazel, Sister Mel, Uncle Coco, Papa Moo, Auntie Bear, Finn, Hazel).
     lessons   LESSONS below, one at a time. The ones on a story quest (MQ00 MQ01 MQ02 MQ03 MQ08) ARE that quest (taken and
               handed in through js/quests.js, its farming goal kept as the last step) with the teaching steps in front;
               the others are this file's own. The story quests between them (MQ04–MQ07) stay story quests (a blue !)
     the talk  ONE quest talk window for every quest giver (mockup A): docked at the bottom, the NPC's sprite popping out of
               its left edge, a name plate, the tag, the title, the line, "ต้องทำอะไร" as numbered steps with ticks, what
               it teaches, the reward, one big button. storynpc.js (T / a click), shop.js, forge.js, cooking.js hand their
               NPC to it (NC.Lessons.talk) when a quest waits there; anyone else it greets with a link to the lesson on now
     marks     painted ! (gold: the lesson on now · blue: a story quest) and ? (gold: hand in · grey: going) over the givers
               (assets/quest/, tools/questmarks_cut.py; storynpc.js draws them through NC.Lessons.of / draw)
     tracker   under the minimap, the ember spirit on its corner: the chapter, the lessons done / on / next with AUTO; the
               current step rings the real button to press (the bag, a hotbar slot, a window's button) with "ขั้น N" by it
     after     the last lesson hands over to the journey's stage 2 (js/journey.js, Lv 10–20)
   Rewards are coins and potions only (the quest rules). Saved: nightcamp.lessons.v1. Test: ?lessons=7 (from lesson 7,
   with ?quest=MQ03 for a story one), ?nolessons. */
(function () {
  'use strict';
  const NC = window.NC;
  const G = () => NC.game;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => (NC.fmtCoins ? NC.fmtCoins(n) : String(n));
  const Q = () => NC.Quests;
  const KEY = 'nightcamp.lessons.v1';
  // the chapters: the lessons from..to (the second one added 2026-10-17, "ทำต่อเลย": it takes the journey's stage 2, Lv 10–20)
  const CHAPTERS = [{ name: 'บทนำ · คืนแรกที่ค่าย', from: 0, to: 10, chest: { coins: 1500, red: 10, blue: 10 } },
    { name: 'บทที่ 1 · พ้นแสงไฟ', from: 10, to: 18, chest: { coins: 5000, red: 20, blue: 15 } },
    { name: 'บทที่ 2 · เนินสุสาน', from: 18, to: 25, chest: { coins: 10000, red: 20, blue: 20 } },
    { name: 'บทที่ 3 · ป่าเห็ดเรืองแสง', from: 25, to: 31, chest: { coins: 15000, red: 30, blue: 30 } }];
  const chOf = (i) => CHAPTERS.find((c) => i >= c.from && i < c.to) || CHAPTERS[CHAPTERS.length - 1];

  // ---------------- the people who teach ----------------
  // (the story NPCs come from js/storynpc.js; the merchant, the smith and the cook from their own files)
  const SYS = {
    coco: { name: 'ลุงโกโก้', title: 'พ่อค้าประจำค่าย', npc: () => NC.Shop && NC.Shop.npc, spr: ['merchant_b', 'merchant'], open: (g) => { g.paused = NC.HUD.panel('shop', true); }, openTxt: 'เปิดร้านลุงโกโก้' },
    smith: { name: 'ป๋าหมูหริ่ง', title: 'ช่างตีเหล็ก', npc: () => NC.Forge && NC.Forge.npc, spr: ['smith_b', 'smith'], open: () => { if (NC.CraftGo) NC.CraftGo.open('refine'); }, openTxt: 'เปิดงานฝีมือ' },
    bear: { name: 'ป้าหมีหม้อดำ', title: 'แม่ครัวประจำค่าย', npc: () => NC.Cook && NC.Cook.npc, spr: ['npc_bear_b', 'npc_bear'], open: () => { if (NC.CraftGo) NC.CraftGo.open('cook'); }, openTxt: 'เปิดหน้าทำอาหาร' },
  };
  function who(id) {
    if (id === 'wargate') { const G1 = NC.GW && NC.GW.gate; return G1 ? { id, name: 'ประตูศึกชิงกองไฟ', title: '', x: G1.x, y: G1.y + 60, map: 'camp' } : null; }
    if (id === 'rootgate') { const G0 = NC.Root && NC.Root.gate; return G0 ? { id, name: 'ประตูรากต้นไม้มืด', title: '', x: G0.x, y: G0.y + 60, map: 'camp' } : null; }
    if (SYS[id]) { const n = SYS[id].npc(); return n ? { id, name: SYS[id].name, title: SYS[id].title, x: n.x, y: n.y, map: 'camp', spr: SYS[id].spr, sys: SYS[id] } : null; }
    const n = NC.StoryNPC && NC.StoryNPC.byId(id);
    return n ? { id, name: n.name, title: n.title, x: n.x, y: n.y, map: n.map, spr: [n.sprite + '_b', n.sprite], story: n } : null;
  }
  const sprSrc = (w) => { for (const k of (w && w.spr) || []) if (NC.SPR[k] && NC.SPR[k].img) return NC.SPR[k].img.src; return ''; };

  // ---------------- the lessons (the plan the user approved) ----------------
  // a step: t (what to do), ic (its icon), and how it is checked: ev (a counter since the lesson was taken) / near / map /
  // joblv / tier, or mq (the story quest's own goals); ring (the buttons it points at); go (where AUTO walks)
  const IC = {
    walk: 'assets/craftgo/cg_walk.png', talk: 'assets/quest/qm_gold.png', map: 'assets/ic_map.png', axe: 'assets/life/t_axe1.png',
    sword: 'assets/ic_sword.png', skill: 'assets/ic_q.png', loot: 'assets/ic_bag.png', potion: 'assets/ic_potion.png', sit: 'assets/craftgo/cg_camp.png',
    coin: 'assets/shop/ic_coin.png', refine: 'assets/refine/rf_hammer.png', cook: 'assets/craftgo/cg_cook.png', eat: 'assets/craftgo/cg_cook.png',
    auto: 'assets/craftgo/cg_menu.png', job: 'assets/ic_skills.png', goal: 'assets/craftgo/cg_pin.png', status: 'assets/ic_status.png',
  };
  const LESSONS = [
    { id: 'L1', giver: 'lumen', mq: 'MQ00', title: 'ขี้กบในความมืด', learn: 'คุยกับชาวค่าย',
      line: 'ตื่นแล้วรึ เจ้าหนู... เดินหลงมาจากป่ามืดสินะ เข้ามาใกล้ไฟก่อน แล้วข้าจะเล่าให้ฟัง',
      steps: [{ t: 'เดินไปหาตาลูเมนที่กองไฟ (WASD หรือคลิกขวาที่พื้น)', ic: 'walk', near: 'lumen' }, { t: 'กด T หรือคลิกที่ตัวเพื่อคุย', ic: 'talk', ev: 'talk_lumen' }],
      gift: { coins: 100, red: 3 } },
    { id: 'L2', giver: 'lumen', mq: 'MQ01', title: 'ฟืนคืนแรก', learn: 'ตัดไม้ (อาชีพเสริม)',
      line: 'ไฟต้องกินฟืนทุกคืน ไม่งั้นความมืดจะคืบเข้ามา ไปตัดไม้ที่ไร่ฟักทองมาให้ข้าหน่อย',
      steps: [{ t: 'ออกไปไร่ฟักทอง ทางตะวันออกของค่าย', ic: 'map', map: 'farm' },
        { t: 'ยืนใกล้ต้นไม้ แล้วกด B (หรือคลิกต้นไม้) ตัด 1 ครั้ง', ic: 'axe', ev: 'chop', go: 'farm' }, { mq: true }],
      gift: { coins: 150, red: 3 } },
    { id: 'L3', giver: 'bruno', title: 'ตีหุ่นฟาง', learn: 'โจมตีและใช้สกิล',
      line: 'ฮ่า! มือใหม่สินะ มาตีหุ่นฟางให้ข้าดูหน่อย ตีให้แรง แล้วลองปล่อยสกิลใส่มันด้วย!',
      steps: [{ t: 'ตีหุ่นฟางที่ลานฝึก 5 ครั้ง (คลิกค้าง หรือ Space)', ic: 'sword', ev: 'dummy', n: 5, at: 'dummy' },
        { t: 'ใช้สกิลปุ่ม Q ใส่หุ่น 1 ครั้ง', ic: 'skill', ev: 'skill', at: 'dummy', ring: ['#hud .hotbar .hslot'] }],
      gift: { coins: 300, red: 5 } },
    { id: 'L4', giver: 'hazel', mq: 'MQ02', title: 'ขอบแสง', learn: 'ออกล่ามอนนอกค่าย',
      line: 'ขอบแสงไฟคืนนี้มีสไลม์เขียวมาป้วนเปี้ยน ไปไล่พวกมันที่ไร่ฟักทองหน่อย อย่าลืมเก็บของที่มันทิ้งไว้',
      steps: [{ t: 'ไปทุ่งสไลม์ริมทาง ในไร่ฟักทอง', ic: 'map', map: 'farm' }, { t: 'เดินผ่านของที่ดรอปเพื่อเก็บ', ic: 'loot', ev: 'loot', go: 'farm' }, { mq: true }],
      gift: { coins: 200, red: 5 } },
    { id: 'L5', giver: 'mel', title: 'แผลแรก', learn: 'ฟื้นเลือด: ยาและการนั่งพัก',
      line: 'โดนสไลม์กัดมาสินะ มานี่ ฉันจะสอนวิธีดูแลตัวเองให้ ดื่มยาแดงสักขวด แล้วนั่งพักข้างกองไฟ',
      steps: [{ t: 'ดื่มยาแดง (ปุ่ม 1)', ic: 'potion', ev: 'pot', ring: ['#hud .hotbar .hslot.item'] },
        { t: 'นั่งพักข้างกองไฟ (ปุ่ม X) ฟื้นเร็วกว่าที่อื่น 2 เท่า', ic: 'sit', ev: 'sitfire', at: 'fire', ring: ['#mb-sit'] }],
      gift: { coins: 200, red: 5, blue: 3 } },
    { id: 'L6', giver: 'coco', mq: 'MQ03', title: 'ค่าที่พัก', learn: 'ซื้อขายกับลุงโกโก้',
      line: 'ยินดีต้อนรับจ้า~ ที่ค่ายนี้ทุกคนช่วยกันนะ เอาวัสดุมาขายให้ลุง ซื้อยาติดตัวไว้ ค่าที่พักก็จ่ายเป็นของได้จ้า',
      steps: [{ t: 'ขายวัสดุให้ลุง 1 ครั้ง (แท็บ ขายวัสดุ)', ic: 'coin', ev: 'sell', at: 'coco', ring: ['#shopwin [data-sell="1"]:not([disabled])', '#shopwin .sp-cell', '#shopwin [data-tab="sell"]:not(.on)'] },
        { t: 'ซื้อยา 1 ขวด (แท็บ ซื้อของ)', ic: 'potion', ev: 'buy', at: 'coco', ring: ['#shopwin [data-buy]:not([disabled])', '#shopwin [data-tab="buy"]:not(.on)'] }, { mq: true }],
      gift: { coins: 300, red: 5 } },
    { id: 'L7', giver: 'smith', title: 'ตีบวกครั้งแรก', learn: 'ตีบวกอาวุธ',
      line: 'อาวุธแบบนั้นทื่อเกินไปสำหรับป่ามืด เดี๋ยวป๋าตีให้เล่มนึง แล้วจะสอนวิธีตีบวกของค่ายนี้ แร่กับค่าเตาครั้งนี้ป๋าออกให้',
      take: 'refine',
      steps: [{ t: 'เปิดหน้าตีบวก (สถานี "ตีบวก" ในงานฝีมือ)', ic: 'refine', ev: 'p_refine', at: 'smith', ring: ['#craftgo [data-cgpage="refine"]'] },
        { t: 'เลือกอาวุธ แล้วกด "ตีบวก +1" (+1 ไม่มีวันพลาด)', ic: 'refine', ev: 'refine', at: 'smith', ring: ['#craftgo [data-act^="rf:go"]:not([disabled])', '#craftgo .rw-row'] }],
      gift: { coins: 300, red: 5 } },
    { id: 'L8', giver: 'bear', title: 'มื้อแรก', learn: 'ทำอาหารและกินบัฟ',
      line: 'หิวไหมจ๊ะ? กินให้อิ่มก่อนออกไปเจอความมืดนะ ป้าให้ผักกับเขี้ยวหมูป่าไป ลองทำสตูว์แครอทเองสักหม้อ',
      take: 'cook',
      steps: [{ t: 'ทำสตูว์แครอท 1 จาน (หน้าทำอาหาร → ทำ x1)', ic: 'cook', ev: 'cook', at: 'bear', ring: ['#craftgo [data-cgcook="1"]:not([disabled])', '#cookbook [data-cook="1"]:not([disabled])', '#craftgo [data-cgdish="fd_carrot_stew"]'] },
        { t: 'กินอาหาร 1 จาน (ปุ่ม "กิน") บัฟอยู่ 30 นาที', ic: 'eat', ev: 'eat', ring: ['#craftgo [data-cgeat]:not([disabled])', '#cookbook [data-eat]:not([disabled])'] }],
      gift: { coins: 300, blue: 5 } },
    { id: 'L9', giver: 'finn', title: 'ให้บอทช่วย', learn: 'ออโต้ฟาร์ม',
      line: 'ล่าทั้งคืนเหนื่อยแย่ ข้าจะบอกเคล็ดลับพรานให้ เปิดออโต้ให้มันล่าแทน แล้วเจ้าก็คอยดูไว้',
      steps: [{ t: 'กดปุ่ม AUTO (หรือ Z) เปิดออโต้ฟาร์ม นอกค่าย', ic: 'auto', ev: 'autoon', go: 'farm', ring: ['#af-btn'] },
        { t: 'ให้บอทล่ามอน 10 ตัว', ic: 'sword', ev: 'autokill', n: 10, go: 'farm' }],
      gift: { coins: 500, red: 5, blue: 5 } },
    { id: 'L10', giver: 'hazel', mq: 'MQ08', title: 'ห้าทางเดิน', learn: 'เปลี่ยนอาชีพ',
      line: 'เจ้าแข็งแรงพอแล้ว ถึงเวลาเลือกทางเดินของตัวเอง ฝึกให้ถึง Job Lv 10 แล้วเลือกอาชีพแรกของเจ้า',
      steps: [{ t: 'ฝึกให้ถึง Job Lv 10 (ล่ามอนไปเรื่อย ๆ)', ic: 'sword', joblv: 10, go: 'lv' },
        { t: 'เปลี่ยนอาชีพ (K → แท็บเปลี่ยนอาชีพ)', ic: 'job', tier: 1, ring: ['#skillwin .job-go', '#skillwin [data-tab="jobs"]:not(.on)', '.menubar [data-panel="skills"]'] }],
      gift: { coins: 1000, red: 10, blue: 5 } },
    // ---- บทที่ 1 · พ้นแสงไฟ (Lv 10–20): what the journey's stage 2 showed, taught by the camp's people ----
    { id: 'L11', giver: 'bruno', title: 'แรงต้องฝึก', learn: 'ลงแต้มสเตตัสและแต้มสกิล',
      line: 'มีอาชีพแล้วก็ต้องฝึกให้ถูกทาง! ทุกเลเวลเจ้าได้แต้มมา เอาไปลงพลังที่ชอบ แล้วเรียนสกิลใหม่ให้ข้าดูหน่อย',
      steps: [{ t: 'ลงแต้มสเตตัส 1 แต้ม (C → ปุ่ม +)', ic: 'status', ev: 'stat', ring: ['#statwin [data-plus]:not([disabled])', '.menubar [data-panel="status"]'] },
        // (the skill window remembers its tab: just after the job change it opens on "เลือกอาชีพ", where no +1 is)
        { t: 'เรียนสกิล +1 เลเวล (K → ปุ่ม +1)', ic: 'job', ev: 'skillup', ring: ['#skillwin [data-plus]:not([disabled])', '#skillwin .kw-tab[data-tab]:not([data-tab="jobs"]):not([data-tab="shared"]):not(.on)', '.menubar [data-panel="skills"]'] }],
      gift: { coins: 800, red: 5 } },
    { id: 'L12', giver: 'hazel', title: 'ชุดก่อนออกเดินทาง', learn: 'กระเป๋าและการสวมใส่',
      line: 'นอกแสงไฟไม่ใช่ที่สำหรับเสื้อผ้าบาง ๆ คาราวานมีเกราะเหลืออยู่ชิ้นนึง เอาไปใส่ซะ',
      take: 'armour',
      steps: [{ t: 'เปิดกระเป๋า (ปุ่ม I)', ic: 'loot', ev: 'p_bag', ring: ['.menubar [data-panel="bag"]'] },
        { t: 'เลือกชุดที่ได้ แล้วกด "สวมใส่" (หรือดับเบิลคลิก)', ic: 'loot', ev: 'equip', ring: [() => giftCell(), () => (st.gift && document.querySelector(`#inv .iv-cell.sel[data-id="${st.gift}"]`) ? '#inv [data-act="main"]:not([disabled])' : '')] }],
      gift: { coins: 800, red: 5 } },
    { id: 'L13', giver: 'noel', title: 'ทางในความมืด', learn: 'แผนที่และการนำทาง',
      line: '...ป่านอกค่ายกว้างกว่าที่เจ้าคิด เปิดแผนที่ไว้เสมอ เลือกที่ที่จะไป แล้วตามลูกศรทองไป',
      steps: [{ t: 'เปิดแผนที่ (ปุ่ม M)', ic: 'map', ev: 'p_bigmap', ring: ['.menubar [data-panel="bigmap"]'] },
        { t: 'ไปทุ่งหญ้าแสงจันทร์ ทางตะวันตกของค่าย', ic: 'walk', map: 'meadow', ring: ['[data-route]:not([data-route="-"])'] }],
      gift: { coins: 1000, red: 5 } },
    { id: 'L14', giver: 'noel', title: 'ลูกไฟนำทาง', learn: 'วาร์ปข้ามแมพ',
      line: 'เดินกลับมันไกล ลูกไฟนำทางพากลับได้ทุกที่ที่เคยไป จ่ายเหรียญนิดหน่อย ลองกลับค่ายด้วยมันดู',
      steps: [{ t: 'ออกไปนอกค่ายสักแมพ (เช่น ทุ่งหญ้าแสงจันทร์)', ic: 'walk', ev: 'leftcamp', go: 'meadow' },
        { t: 'วาร์ปกลับค่าย (J → ลูกไฟนำทาง → ค่ายกลางป่า)', ic: 'map', ev: 'warphome', ring: ['[data-warp="camp"]:not([disabled])', '#hb-tabs [data-tab="warp"]:not(.on)', '.menubar .mbtn[title*="(J)"]'] }],
      gift: { coins: 1000, blue: 5 } },
    { id: 'L15', giver: 'finn', title: 'กระดานล่าค่าหัว', learn: 'เควสรายวัน',
      line: 'อยากได้เหรียญเพิ่มไหม? ทุกวันมีงานล่าค่าหัวสามงาน ทำได้เรื่อย ๆ ดูกระดานไว้ทุกวันนะ',
      steps: [{ t: 'เปิดสมุดนักเดินทาง (J) → เควส → รายวัน', ic: 'goal', ev: 'daily', ring: ['[data-qt="daily"]', '#hb-tabs [data-tab="quest"]:not(.on)', '.menubar .mbtn[title*="(J)"]'] }],
      gift: { coins: 1000, red: 5 } },
    { id: 'L16', giver: 'bruno', title: 'ถ้ำค้างคาว', learn: 'ดันเจี้ยน',
      line: 'หุ่นฟางไม่ตีกลับ! ไปถ้ำค้างคาวทางตะวันตก ลงไปล่าค้างคาวให้ข้าดูสัก 20 ตัว แล้วรอดกลับมา',
      steps: [{ t: 'เข้าถ้ำค้างคาว (จากทุ่งหญ้าแสงจันทร์)', ic: 'map', map: 'batcave' },
        { t: 'ล่าค้างคาว 20 ตัว', ic: 'sword', ev: 'k_bat', n: 20, go: 'batcave' }],
      gift: { coins: 1500, red: 10, blue: 5 } },
    { id: 'L17', giver: 'lily', title: 'เพื่อนร่วมทาง', learn: 'ปาร์ตี้',
      line: 'พี่! ข้างนอกอันตรายนะ ไปกับเพื่อนสิ ชวนคนอื่นเข้าปาร์ตี้ได้นะ แบ่งกันล่า ปลอดภัยกว่าเยอะ',
      steps: [{ t: 'เปิดหน้าปาร์ตี้ (ปุ่ม P) ดูวิธีชวนเพื่อน', ic: 'goal', ev: 'p_party', ring: ['.menubar .mbtn[title*="(P)"]'] }],
      gift: { coins: 800, red: 5 } },
    { id: 'L18', giver: 'lumen', mq: 'MQ15', title: 'หมอผู้ขโมยไฟ', learn: 'บอสเนื้อเรื่อง',
      line: 'ไฟของเราหรี่ลงทุกคืน... มีคนขโมยมันไป ไปหยุดหมอไอวี่ให้ได้ แล้วกลับมาเล่าให้ข้าฟัง',
      steps: [{ t: 'พกยาแดงไว้อย่างน้อย 10 ขวด', ic: 'potion', have: 'potions', n: 10 }, { mq: true }],
      gift: { coins: 3000, red: 10, blue: 10 } },
    // ---- บทที่ 2 · เนินสุสาน (Lv 18–36, "ทำต่อเลย" again): the mid-game systems; the story MQ20–24 between them ----
    { id: 'L19', giver: 'coco', title: 'ต้มยากลางป่า', learn: 'งานฝีมือนอกค่าย (Y)',
      line: 'ออกไปไกล ๆ ไม่ต้องกลับมาหาลุงทุกครั้งนะ กดงานฝีมือแล้วต้มยาเองได้เลย ตอนที่ไม่ได้สู้อยู่',
      steps: [{ t: 'ออกไปนอกค่ายสักแมพ', ic: 'walk', ev: 'leftcamp', go: 'meadow' },
        { t: 'เปิดงานฝีมือ (ปุ่ม Y) ตอนอยู่นอกค่าย', ic: 'auto', ev: 'cg_out', ring: ['.cg-mbtn'] },
        { t: 'ต้มยา 1 ครั้ง (สถานี "ต้มยา")', ic: 'potion', ev: 'brew', ring: ['#craftgo [data-brew]:not([disabled])', '#craftgo [data-cgpage="brew"]:not(.on)'] }],
      gift: { coins: 1500, red: 5 } },
    { id: 'L20', giver: 'bear', title: 'สมุดอาชีพเสริม', learn: 'อาชีพเสริม',
      line: 'ป่านี้ให้ทุกอย่างถ้าเจ้ารู้จักเก็บ ไม้ แร่ ผัก ปลา ดูในสมุดอาชีพเสริมว่าเก็บที่ไหน แล้วลองเก็บดูสักสิบครั้ง',
      steps: [{ t: 'เปิดสมุดอาชีพเสริม (ปุ่ม H)', ic: 'axe', ev: 'p_life', ring: ['.menubar .mbtn[title*="(H)"]', '.menubar [data-panel="life"]'] },
        { t: 'เก็บของอาชีพเสริม 10 ครั้ง (ตัดไม้ ขุดแร่ ปลูกผัก ตกปลา)', ic: 'axe', ev: 'life', n: 10, go: 'farm' }],
      gift: { coins: 1500, red: 5 } },
    { id: 'L21', giver: 'coco', title: 'ร้านของเราเอง', learn: 'ตลาดและร้านผู้เล่น',
      line: 'ของดี ๆ บางอย่างลุงไม่รับซื้อนะ ไปดูราคาที่ตลาด แล้วตั้งร้านขายให้คนอื่นเองก็ได้ ได้ราคาดีกว่า',
      steps: [{ t: 'ดูราคาที่ตลาด (J → ตลาด)', ic: 'coin', ev: 'hub_market', ring: ['#hb-tabs [data-tab="market"]:not(.on)', '.menubar .mbtn[title*="(J)"]'] },
        { t: 'เปิดหน้าตั้งร้านของตัวเอง (ปุ่ม V)', ic: 'coin', ev: 'p_vend', ring: ['.menubar .mbtn[title*="(V)"]'] }],
      gift: { coins: 1500, blue: 5 } },
    { id: 'L22', giver: 'smith', title: 'รูนจารึกสกิล', learn: 'รูนสกิล',
      line: 'รูนจารึกทำให้สกิลแรงขึ้นอีกขั้น ป๋าให้รูนจันทร์ไปสามอัน รวมเป็นอันเดียวที่แรงกว่า แล้วเอาไปใส่ในสกิลที่ใช้บ่อย',
      take: 'runes',
      steps: [{ t: 'รวมรูน 3 อันเป็นขั้น II (งานฝีมือ → รวมรูน)', ic: 'refine', ev: 'runemerge', ring: ['#craftgo [data-blmerge]:not([disabled])', '#craftgo [data-cgpage="runes"]:not(.on)', '.cg-mbtn'] },
        { t: 'ใส่รูนลงสกิล (K → การ์ดสกิล → ช่องรูน) · ช่องเปิดเมื่อสกิลถึงครึ่งเลเวลสูงสุด', ic: 'job', fn: 'rune', ring: ['#skillwin [data-blsock]', '#skillwin [data-blpickrune]', '.menubar [data-panel="skills"]'] }],
      gift: { coins: 2000, red: 5 } },
    { id: 'L23', giver: 'hazel', title: 'กองไฟของกิลด์', learn: 'กิลด์และตารางอันดับ',
      line: 'คาราวานเดียวไปได้ไม่ไกล รวมกลุ่มเป็นกิลด์ จุดกองไฟของตัวเอง แล้วดูว่าใครในค่ายแข็งแรงที่สุด',
      steps: [{ t: 'เปิดหน้ากิลด์ (ปุ่ม O)', ic: 'goal', ev: 'p_guild', ring: ['.menubar .mbtn[title*="(O)"]'] },
        { t: 'เปิดตารางอันดับ (ปุ่ม N)', ic: 'goal', ev: 'p_ranks', ring: ['.menubar .mbtn[title*="(N)"]'] }],
      gift: { coins: 1500, red: 5 } },
    { id: 'L24', giver: 'noel', title: 'รากต้นไม้มืด', learn: 'หอคอยรากมืด',
      line: '...ใต้ค่ายมีรากของต้นไม้มืดลงไปลึกร้อยชั้น ไปดูประตูมันสิ ลงไปกับเพื่อนก็ได้ ทุกสัปดาห์มีลมใหม่',
      steps: [{ t: 'ไปที่ประตูรากต้นไม้มืดในค่าย', ic: 'walk', near: 'rootgate' },
        { t: 'กด T ที่ประตู เปิดหน้ารากต้นไม้มืด', ic: 'goal', ev: 'p_rootlobby' }],
      gift: { coins: 2000, blue: 5 } },
    { id: 'L25', giver: 'lumen', mq: 'MQ25', title: 'ความเมตตาของหมอ', learn: 'บอสเนื้อเรื่อง',
      line: 'ห้องทดลองใต้เนินสุสาน... สิ่งที่หมอทิ้งไว้ยังไม่ตาย ไปจบมันซะ แล้วกลับมาเล่าให้ข้าฟัง',
      steps: [{ t: 'พกยาแดงไว้อย่างน้อย 20 ขวด', ic: 'potion', have: 'potions', n: 20 }, { mq: true }],
      gift: { coins: 6000, red: 15, blue: 15 } },
    // ---- บทที่ 3 · ป่าเห็ดเรืองแสง (Lv 26–38, "ทำต่อ"): gear past refining, monster essences, the war and the arena; MQ30–33 between ----
    { id: 'L26', giver: 'smith', title: 'ขัดเกรด', learn: 'เกรดสีของของ',
      line: 'ของชิ้นเดียวกันยังเก่งกว่ากันได้ ขัดเกรดให้มันเปลี่ยนสี ออฟก็แรงขึ้น ป๋าให้หินขัดกับค่าแรงไปลองครั้งแรก',
      take: 'polish',
      steps: [{ t: 'เปิดหน้าขัดเกรด (งานฝีมือ → ขัดเกรด ที่โรงตีเหล็ก)', ic: 'refine', ev: 'p_grade', at: 'smith', ring: ['#craftgo [data-cgpage="grade"]:not(.on)'] },
        { t: 'กด "ขัด!" 1 ครั้ง (ของเกรดวาวขึ้นไปกดสองครั้ง พลาดแล้วอาจเกรดตก)', ic: 'refine', ev: 'polish', at: 'smith', ring: ['#craftgo [data-gtgo]:not([disabled])'] }],
      gift: { coins: 3000, red: 10 } },
    { id: 'L27', giver: 'smith', title: 'หินออฟ', learn: 'เปลี่ยนออฟด้วยหินออฟ',
      line: 'ออฟแถวไหนไม่ถูกใจ ใส่หินออฟแล้วเลือกชนิดเองได้ ระดับยังสุ่มนะ แต่แต้มช่างจะช่วยเจ้า ป๋าให้หินไปก้อนนึง',
      take: 'optstone',
      steps: [{ t: 'เปิดหน้าหินออฟ (งานฝีมือ → หินออฟ · เจาะออฟ)', ic: 'refine', ev: 'p_opt', at: 'smith', ring: ['#craftgo [data-cgpage="opt"]:not(.on)'] },
        { t: 'เลือกชนิดออฟ แล้วกด "ใส่หินออฟ" 1 ครั้ง', ic: 'refine', ev: 'optstone', at: 'smith', ring: ['#craftgo #fg-stone:not([disabled])'] }],
      gift: { coins: 3000, blue: 10 } },
    { id: 'L28', giver: 'finn', title: 'น้ำมันเคลือบ', learn: 'แก่นธาตุ น้ำมัน กระสุน',
      line: 'มอนแต่ละตัวมีธาตุของมัน สกัดชิ้นส่วนมันเป็นแก่นธาตุ แล้วทำน้ำมันเคลือบอาวุธ ตีธาตุที่มันแพ้จะเจ็บกว่ากันเยอะ',
      take: 'essence',
      steps: [{ t: 'สกัดแก่นธาตุให้ได้ 5 อัน (งานฝีมือ → ธาตุ · น้ำมัน → "ทั้งหมด")', ic: 'potion', ev: 'essence', n: 5, ring: ['#craftgo [data-blextall]:not([disabled])', '#craftgo [data-blsec="ess"]:not(.on)', '#craftgo [data-cgpage="bl"]:not(.on)', '.cg-mbtn'] },
        { t: 'ทำน้ำมันเคลือบ 1 ขวด (แท็บ น้ำมัน · กระสุน: แก่น 5 + 300 เหรียญ)', ic: 'potion', ev: 'oilmake', ring: ['#craftgo [data-bloil]:not([disabled])', '#craftgo [data-blsec="oil"]:not(.on)'] }],
      gift: { coins: 3000, red: 10 } },
    { id: 'L29', giver: 'hazel', title: 'ศึกชิงกองไฟ', learn: 'กิลด์วอร์',
      line: 'ทุกสัปดาห์กิลด์จะแย่งกองไฟของสี่ดินแดน ใครถือไว้ได้ก็ได้ส่วนแบ่ง ไปดูกระดานศึกที่ประตูทางเหนือของค่ายสิ',
      steps: [{ t: 'ไปที่ประตูศึกชิงกองไฟ ทางเหนือของค่าย', ic: 'walk', near: 'wargate' },
        { t: 'กด T เปิดกระดานศึก', ic: 'goal', ev: 'p_gwar' }],
      gift: { coins: 3000, blue: 10 } },
    { id: 'L30', giver: 'bruno', title: 'เวทีกลางทะเลสาบ', learn: 'ดวลและเวทีประลอง',
      line: 'หุ่นฟางกับมอนมันไม่คิด! อยากรู้ว่าแข็งแรงจริงไหมต้องเจอคน เวทีกลางทะเลสาบทางตะวันออก คลิกขวาที่ผู้เล่นแล้วท้าดวลได้',
      steps: [{ t: 'ไปเวทีประลองกลางทะเลสาบ (ทางออกตะวันออกของค่าย)', ic: 'map', map: 'pvp_lake' }],
      gift: { coins: 3000, red: 10 } },
    { id: 'L31', giver: 'lumen', mq: 'MQ34', title: 'พี่ชายในเงา', learn: 'บอสเนื้อเรื่อง',
      line: 'เงาในป่าเห็ด... มันรู้จักชื่อข้า ไปหามันให้เจอ แล้วเอาแสงของเรากลับมา',
      steps: [{ t: 'พกยาแดงไว้อย่างน้อย 30 ขวด', ic: 'potion', have: 'potions', n: 30 }, { mq: true }],
      gift: { coins: 8000, red: 20, blue: 20 } },
  ];

  // ---------------- the counters ----------------
  const blank = () => ({ i: 0, on: false, base: {}, sd: [], ev: {}, done: false, baseFor: '', chest: false });
  let st = blank();
  let loaded = false;
  try { if (!NC.ONLINE) { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) { st = Object.assign(st, s); loaded = true; } } } catch (e) { /* blocked */ }
  // (?online the page is a fresh, unsaved game: the lessons were never kept and every visit began at lesson 1 again,
  // 2026-10-18 "เควสตอนนี้ไปต่อไม่ได้". They are kept per hero on this device now, NC.Lessons.useSave from online/extras.js)
  let saveKey = KEY, keyed = false;
  const save = () => { const g = G(); if (g && g.noSave && !keyed) return; try { localStorage.setItem(saveKey, JSON.stringify(st)); } catch (e) { /* blocked */ } };
  const ev = () => st.ev;
  const bump = (k, n) => {
    const was = st.ev[k] || 0;
    st.ev[k] = was + (n || 1); dirty = true;
    // Persist a newly completed teaching step before a reload or a hero switch.
    // Ordinary combat counters still share the periodic save below.
    const l = !st.done && LESSONS[st.i], base = st.base[k] || 0;
    if (l && l.steps.some((s) => s.ev === k && was - base < (s.n || 1) && st.ev[k] - base >= (s.n || 1))) save();
  };
  let dirty = false;
  setInterval(() => { if (dirty) { dirty = false; save(); } }, 2000);
  addEventListener('pagehide', () => { if (dirty) { dirty = false; save(); } });
  const since = (k) => (st.ev[k] || 0) - (st.base[k] || 0);
  const wrap = (obj, name, after) => { if (!obj || typeof obj[name] !== 'function') return; const base = obj[name]; obj[name] = function () { const r = base.apply(this, arguments); try { after(r, arguments); } catch (e) { /* never breaks the game */ } return r; }; };
  NC.skillKills.push((game, e) => { if (!e || e.dummy) return; bump('kill'); if (NC.Auto && NC.Auto.on) bump('autokill'); });
  const drankRed = (r, a) => {
    // Online drinks are counted by their confirmed server reply (online/world.js).
    if (NC.Online && NC.Online.enabled) return;
    if (a[2] !== 'red' || !a[0] || a[1] !== a[0].player) return;
    if (r) bump('pot'); else NC.Lessons.fullPot(a[0], a[1]);
  };
  wrap(NC, 'drinkPotion', drankRed);
  if (NC.POT) wrap(NC.POT, 'drink', drankRed);
  if (NC.Rest) wrap(NC.Rest, 'toggle', (r, a) => { const g = a[0] || G(); if (g && g.player.sit && nearFire(g)) bump('sitfire'); });
  if (NC.Econ) wrap(NC.Econ, 'sell', () => bump('sell'));
  if (NC.Life) wrap(NC.Life, 'addXp', (r, a) => { const k = a[1]; if (k === 'wood') bump('chop'); else if (k === 'cook') bump('cook'); });
  if (NC.Auto) wrap(NC.Auto, 'toggle', () => { if (NC.Auto.on) bump('autoon'); });
  wrap(NC, 'castSkill', () => bump('skill'));
  wrap(NC, 'raiseStat', (r) => { if (r !== false && r !== 0) bump('stat'); });
  wrap(NC, 'raiseSkill', (r) => { if (r) bump('skillup'); });
  wrap(NC, 'equip', () => bump('equip'));
  NC.skillKills.push((game, e) => { if (e && !e.dummy) bump('k_' + e.type); });
  wrap(NC.HUD, 'mapChanged', (r, a) => {
    const game = a[0], prev = a[1] && (a[1].mapId || a[1].field);
    if (game.mapId !== 'camp') bump('leftcamp');
    // home from far away (not walked in from a neighbour): the guiding flame
    if (game.mapId === 'camp' && prev && NC.MapRoute) { const path = NC.MapRoute.pathTo(prev, 'camp'); if (path && path.length > 2) bump('warphome'); }
  });
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-qt="daily"]')) bump('daily'); }, true);
  if (NC.Brew) wrap(NC.Brew, 'brew', (r) => { if (r) bump('brew'); });
  if (NC.Life) wrap(NC.Life, 'addXp', () => bump('life'));
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#hb-tabs [data-tab="market"]')) bump('hub_market'); }, true);
  // a rune put in a skill: the click, then a rune less in the pouch
  const runeCount = (p) => Object.keys(p.mats || {}).filter((k) => /^bl_rune_/.test(k)).reduce((a, k) => a + p.mats[k], 0);
  document.addEventListener('click', (e) => {
    if (!(e.target.closest && e.target.closest('[data-blsock]'))) return;
    const g = G(), n0 = g && runeCount(g.player);
    setTimeout(() => { const gg = G(); if (gg && runeCount(gg.player) < n0) bump('runesock'); }, 120);
  }, true);
  // a warp by the guiding flame (economy.js logs it; its warp() is its own); an option stone put in (forge.js logs it)
  wrap(NC.HUD, 'log', (r, a) => {
    const m = String(a[0] || '');
    if (m.indexOf('ลูกไฟนำทางพาไป') === 0) { bump('warp'); if (NC.MAPS.camp && m.indexOf(NC.MAPS.camp.name) > 0) bump('warphome'); }
    if (m.indexOf('ใส่หินออฟแถว') === 0) bump('optstone');
  });
  // an essence / an oil made: one more of them in the pouch than before (js/bl_core.js)
  const blIds = (k) => { const B = NC.BL && NC.BL[k]; return B ? Object.values(B) : []; };
  const baseAdd2 = NC.addMat;
  NC.addMat = function (game, id, n) { if (n > 0) { if (blIds('ESS').includes(id)) bump('essence', n); else if (blIds('OIL').includes(id)) bump('oilmake'); } return baseAdd2.apply(this, arguments); };
  // a window opened (p_bag, p_bigmap, p_party ...)
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) { const on = basePanel(id, show); if (on && id) bump('p_' + id); return on; };
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e) { if (e && e.dummy) bump('dummy'); return baseDamage.apply(this, arguments); };
  // Ground pickups report 'loot' after collection (items/materials and online/world).
  // Adding a reward or buying a material is not the walking-to-pick-up lesson.
  if (NC.gearPicked) NC.gearPicked.push(() => bump('loot'));
  const nearFire = (g) => { const f = NC.CAMP_SPOT && NC.CAMP_SPOT.fire; return !!(f && g.mapId === 'camp' && NC.dist(g.player.x, g.player.y, f.x, f.y) < 460); };
  // the counters only a look can tell (the refine page open, a refine done, a meal eaten): polled each frame
  let lastRef = null, lastMealT = null, refOpen = false;
  function poll(game) {
    const R = NC.Refine;
    if (R && R.last) { const l = R.last(); if (l && l !== lastRef) bump('refine'); lastRef = l; }
    const rp = !!(NC.CraftGo && NC.CraftGo.isOpen() && $('cg-page') && $('cg-page').classList.contains('pg-refine'));
    if (rp && !refOpen) bump('p_refine');
    refOpen = rp;
    // a meal eaten: its time left jumps back up (or a meal starts)
    const meal = NC.Cook && NC.Cook.state && NC.Cook.state().meal, t = meal ? meal.t : 0;
    if (lastMealT !== null && meal && t > lastMealT + 30) bump('eat');
    lastMealT = t;
    // the crafting window opened away from the camp; a rune merged (a higher rune more than before)
    // pages opened in the crafting window (grade, option stones) and the war board
    const pg = NC.CraftGo && NC.CraftGo.isOpen() && $('cg-page') ? ($('cg-page').className.match(/pg-(\w+)/) || [])[1] : '';
    if (pg && pg !== lastPg) bump('p_' + pg);
    lastPg = pg;
    // a polish: the polishing stones go down (gradetier.js's polish() is its own)
    const pol = NC.matCount(game.player, 'mat_polish');
    if (lastPol !== null && pol < lastPol) bump('polish');
    lastPol = pol;
    const gw = $('gwr-board'), gwOn = !!(gw && !gw.hidden);
    if (gwOn && !gwWas) bump('p_gwar');
    gwWas = gwOn;
    const cgo = !!(NC.CraftGo && NC.CraftGo.isOpen() && game.mapId !== 'camp');
    if (cgo && !cgOut) bump('cg_out');
    cgOut = cgo;
    const p = game.player, hi = Object.keys(p.mats || {}).filter((k) => /^bl_rune_.+_[23]$/.test(k)).reduce((a, k) => a + p.mats[k], 0);
    if (lastHi !== null && hi > lastHi) bump('runemerge');
    lastHi = hi;
  }
  let cgOut = false, lastHi = null, lastPg = '', gwWas = false, lastPol = null;
  NC.Lessons = NC.Lessons || {};
  NC.Lessons.ev = (k, n) => bump(k, n); // (shopwin.js: a potion bought; online/*.js: what the server did)
  // key 1 pressed with HP already full: nothing to drink (the game and the server both refuse), but the step teaches the
  // button, so it counts and no bottle is spent (2026-10-19 "เควสดื่มยาแดงคนติดเยอะเลย เพราะเลือดเต็ม"). Offline from
  // drankRed above, ?online from online/world.js before it asks the server.
  NC.Lessons.fullPot = (game, p) => {
    const l = L();
    if (!l || !active() || !p || p.dead > 0 || p.hp < p.maxHp || lessonState() !== 'on') return false;
    if (!l.steps.some((s, i) => s.ev === 'pot' && !stepDone(l, s, i, p))) return false;
    bump('pot');
    if (game && game.toast) game.toast('เลือดเต็มอยู่แล้ว ไม่ต้องเสียยา นับว่าผ่านขั้นนี้แล้ว');
    return true;
  };

  // ---------------- where the lesson stands ----------------
  const L = () => (st.done ? null : LESSONS[st.i] || null);
  const tier = (p) => ((NC.JOBS[p.job] || {}).tier || 0);
  const active = () => !st.done;
  // a story lesson: its quest is the chain's current one? (else it waits for the story, or it is done already)
  function mqState(l) {
    const q = Q() && Q().cur();
    if (Q().done(l.mq)) return 'done';
    if (!q || q.id !== l.mq) return 'story';
    return Q().state.on ? 'on' : 'offer';
  }
  function lessonState() {
    const l = L();
    if (!l) return 'none';
    let s = l.mq ? mqState(l) : st.on ? 'on' : 'offer';
    if (s === 'on' && ready(l)) s = 'ready';
    return s;
  }
  // ?online: what the server can't do for a lesson yet (the teachers' handouts are never paid there, and the essences, oils
  // and runes are not on the server): the step counts once its page has been opened, so the lesson goes on
  const ONLINE_ALT = { refine: 'p_refine', cook: 'p_cook', eat: 'p_cook', equip: 'p_bag', runemerge: 'p_runes', polish: 'p_grade', optstone: 'p_opt', essence: 'p_bl', oilmake: 'p_bl' };
  const onlineAlt = (l, s) => !!(NC.Lessons.noPay && s.ev && ONLINE_ALT[s.ev] && (l.take || /^(runemerge|essence|oilmake)$/.test(s.ev)));
  function stepVal(l, s, i, p) {
    if (s.mq) return null;
    if (st.sd[i]) return [1, 1];
    const g = G(), n = s.n || 1;
    let v = 0;
    if (s.ev) {
      v = since(s.ev);
      if (onlineAlt(l, s) && since(ONLINE_ALT[s.ev]) > 0) v = n;
      // every skill point spent and the job at its top level: no +1 will ever come (it waited for good)
      if (s.ev === 'skillup' && NC.skillLeft && NC.jobMax && NC.skillLeft(p) <= 0 && (p.jobLv || 1) >= NC.jobMax(p)) v = n;
    }
    else if (s.fn === 'rune' && NC.Lessons.noPay) v = since('runesock') || since('p_skills') ? 1 : 0;
    else if (s.near) { const w = who(s.near); v = w && g.mapId === w.map && NC.dist(p.x, p.y, w.x, w.y) < 300 ? 1 : 0; }
    else if (s.map) v = g.mapId === s.map ? 1 : 0;
    else if (s.joblv) return [tier(p) >= 1 ? s.joblv : Math.min(s.joblv, p.jobLv || 1), s.joblv];
    else if (s.tier) v = tier(p) >= s.tier ? 1 : 0;
    else if (s.have) return [Math.min(n, p[s.have] || 0), n]; // (a count held now, never ticked for good)
    else if (s.fn === 'rune') v = since('runesock') || (!slotOpen(p) && since('p_skills')) ? 1 : 0;
    v = Math.max(0, Math.min(n, v));
    if (v >= n) { st.sd[i] = true; save(); }
    return [v, n];
  }
  const stepDone = (l, s, i, p) => { const r = stepVal(l, s, i, p); return !r || r[0] >= r[1]; };
  function ready(l) {
    const p = G().player;
    if (!l.steps.every((s, i) => s.mq || stepDone(l, s, i, p))) return false;
    if (l.mq) { const q = Q().cur(); return !!(q && q.id === l.mq && Q().ready(q, p)); }
    return true;
  }
  // the steps as shown: the lesson's own, then the story quest's goals (not its "talk")
  function rows(l, p) {
    const out = [];
    l.steps.forEach((s, i) => {
      if (s.mq) {
        const q = Q().cur();
        if (q && q.id === l.mq) q.obj.forEach((o, k) => { if (o.k === 'talk') return; out.push({ html: Q().objText(o, k, p), ic: 'goal', done: Q().state.on && Q().objDone(q, o, k, p), story: true }); });
        return;
      }
      const v = stepVal(l, s, i, p);
      const alt = onlineAlt(l, s) || (s.fn === 'rune' && NC.Lessons.noPay) ? ' <small>(ออนไลน์: เปิดหน้าดูก็ผ่าน)</small>' : '';
      out.push({ html: esc(s.t) + (v[1] > 1 ? ` <b>${Math.min(v[0], v[1])}/${v[1]}</b>` : '') + alt, ic: s.ic, done: v[0] >= v[1], s, i });
    });
    return out;
  }
  // the lesson's own first step not done (the one AUTO and the ring help with)
  function curStep(l, p) { for (let i = 0; i < l.steps.length; i++) { const s = l.steps[i]; if (!s.mq && !stepDone(l, s, i, p)) return s; } return null; }
  // a step that spends a point the hero has not got yet (a new job's Job Lv 1): nothing to press until a level comes
  const waitsPoint = (c, p) => !!(c && p && ((c.ev === 'skillup' && NC.skillLeft && NC.skillLeft(p) <= 0) || (c.ev === 'stat' && NC.statusLeft && NC.statusLeft(p) <= 0)));
  // the story quest taken now (the journal's current quest) when it is not the lesson's own (Discord #149)
  const storyTaken = (l, q) => !!(q && q.ok && Q() && Q().state.on && !(l && l.mq === q.id));

  // ---------------- moving through the lessons ----------------
  function snap() { st.base = Object.assign({}, st.ev); st.sd = []; st.baseFor = (L() || {}).id || ''; save(); }
  function gift(game, r, why) {
    if (NC.Lessons.noPay) return; // (?online: only the server pays, and it has no lessons yet: js/online/extras.js)
    const p = game.player, bits = [];
    if (r.coins) { p.coins = (p.coins || 0) + r.coins; bits.push(fmt(r.coins) + ' เหรียญ'); }
    for (const c of ['red', 'blue']) if (r[c]) {
      if (NC.POT) NC.POT.add(p, c, NC.POT.sizeFor(p.lv), r[c]); else if (c === 'red') p.potions += r[c]; else p.spPotions += r[c];
      bits.push(`ยา${c === 'red' ? 'แดง' : 'ฟ้า'} ×${r[c]}`);
    }
    if (bits.length) NC.HUD.log(`${why}: ${bits.join(' · ')}`, 'level');
    NC.saveGame(game);
  }
  // what a teacher hands over with the lesson (the smith pays the forge, the cook gives the ingredients)
  function onTake(game, l) {
    if (NC.Lessons.noPay) return; // (?online: the teachers' handouts would be gear and materials the server never gave)
    const p = game.player;
    if (l.take === 'refine') {
      const W = NC.GEAR;
      let c = W && (W.wornIn(p, 'weapon') || W.bag(p).find((x) => NC.ITEMS[x.id] && NC.ITEMS[x.id].slot === 'weapon'));
      // the starting weapon is no copy (it can't be refined): the smith forges a training one for the hero's job and puts it in hand
      if (W && !c && NC.Forge && NC.Forge.recipes) {
        const types = NC.Forge.makeTypes ? NC.Forge.makeTypes(p) : ['sword'], id = (NC.Forge.recipes(types[0]) || [])[0];
        if (id) { c = W.add(game, W.make(id, { src: 'lesson', by: 'ป๋าหมูหริ่ง' })); if (W.use) W.use(game, c.u); NC.HUD.log(`ป๋าหมูหริ่งตี ${NC.ITEMS[id].name} ให้ไว้ฝึก`, 'level'); }
      }
      const g = c ? W.gradeOf(NC.ITEMS[c.id]) : 1, n = c ? (c.ref || 0) + 1 : 1;
      const ore = (NC.Refine && NC.Refine.ORE[g]) || 'lf_iron', coins = NC.Refine ? NC.Refine.cost(g, n) : 1800;
      NC.addMat(game, ore, NC.Refine && NC.Refine.oreN ? NC.Refine.oreN(n) : 1);
      p.coins = (p.coins || 0) + coins;
      NC.HUD.log(`ป๋าหมูหริ่งให้${(NC.MATERIALS[ore] || {}).name || 'แร่'}กับค่าเตา ${fmt(coins)} เหรียญ`, 'level');
    } else if (l.take === 'armour') {
      const W = NC.GEAR, ITEMS = NC.ITEMS, ok = (k, lo) => ITEMS[k].inst && ITEMS[k].slot === 'top' && ITEMS[k].rarity !== 'fashion' && (ITEMS[k].lvReq || 1) <= Math.max(10, p.lv) && (ITEMS[k].lvReq || 1) >= lo;
      const id = W && (Object.keys(ITEMS).find((k) => ok(k, 8)) || Object.keys(ITEMS).find((k) => ok(k, 1)));
      if (id) { W.add(game, W.make(id, { src: 'lesson', by: 'กัปตันเฮเซล' })); st.gift = id; NC.HUD.log(`กัปตันเฮเซลให้ ${ITEMS[id].name}`, 'level'); }
    } else if (l.take === 'polish' || l.take === 'optstone') {
      const W = NC.GEAR;
      let c = W && (W.wornIn(p, 'weapon') || W.bag(p).find((x) => NC.ITEMS[x.id] && NC.ITEMS[x.id].slot === 'weapon'));
      if (W && !c && NC.Forge && NC.Forge.recipes) { const id = (NC.Forge.recipes((NC.Forge.makeTypes ? NC.Forge.makeTypes(p) : ['sword'])[0]) || [])[0]; if (id) { c = W.add(game, W.make(id, { src: 'lesson' })); if (W.use) W.use(game, c.u); } }
      if (l.take === 'polish' && c && NC.Grade && NC.Grade.needOf) {
        const need = NC.Grade.needOf(c);
        NC.addMat(game, 'mat_polish', need.stones || 1); if (need.core) NC.addMat(game, 'mat_night_core', 1);
        p.coins = (p.coins || 0) + (need.coins || 0);
        NC.HUD.log(`ป๋าหมูหริ่งให้หินขัดเกรด ×${need.stones || 1} กับค่าแรง ${fmt(need.coins || 0)} เหรียญ`, 'level');
      } else if (l.take === 'optstone') {
        NC.addMat(game, 'mat_opt_stone', 1); p.coins = (p.coins || 0) + 15000;
        NC.HUD.log('ป๋าหมูหริ่งให้หินออฟ 1 ก้อนกับค่าแรง 15,000 เหรียญ', 'level');
      }
    } else if (l.take === 'essence') {
      const B = NC.BL, el = B && B.matElements ? B.matElements() : {};
      const id = Object.keys(el).find((k) => NC.MATERIALS[k] && !NC.MATERIALS[k].rare && (!B.extractable || B.extractable(k)));
      if (id) { NC.addMat(game, id, 15); p.coins = (p.coins || 0) + 300; NC.HUD.log(`ฟินน์ให้${NC.MATERIALS[id].name} ×15 กับค่าน้ำมัน 300 เหรียญ`, 'level'); }
    } else if (l.take === 'runes') {
      NC.addMat(game, 'bl_rune_moonrite_1', 3);
      NC.HUD.log('ป๋าหมูหริ่งให้รูนจันทร์ I ×3', 'level');
    } else if (l.take === 'cook') {
      const d = NC.Cook && NC.Cook.BY.fd_carrot_stew;
      if (d) { for (const m in d.mats) NC.addMat(game, m, Math.max(0, d.mats[m] - NC.matCount(p, m))); p.coins = (p.coins || 0) + d.coins; }
      NC.HUD.log('ป้าหมีให้วัตถุดิบสตูว์แครอทกับค่าหม้อ', 'level');
    }
    if (NC.saveTrade) NC.saveTrade(game);
  }
  function accept(game) {
    const l = L(), p = game.player;
    if (!l) return;
    if (l.mq) { const was = Q().state.on; Q().take(game); if (!Q().state.on || was) return; }
    else st.on = true;
    snap();
    l.steps.forEach((s, i) => { if (s.ev === 'talk_' + l.giver || s.near === l.giver) st.sd[i] = true; }); // (talking now)
    onTake(game, l);
    NC.HUD.log(`รับบทเรียน: ${l.title}`, 'level');
    render(true);
  }
  function handIn(game) {
    const l = L();
    if (!l || lessonState() !== 'ready') return;
    if (l.mq) { Q().handIn(game); if (!Q().done(l.mq)) return; }
    gift(game, l.gift, `บทเรียน "${l.title}" สำเร็จ`);
    NC.FX.stars(game.player.x, game.player.y - 90, 18, '255,220,120', { speed: 280 });
    next(game);
  }
  function next(game) {
    const was = chOf(st.i);
    st.i++; st.on = false;
    if (st.i >= was.to) chapterEnd(game, was);
    if (st.i >= LESSONS.length) finish(game); else snap();
    render(true);
  }
  // a chapter's chest (once), and the card that says what comes next
  function chapterEnd(game, C, quiet) {
    st.chests = st.chests || {};
    if (st.chests[C.name]) return;
    st.chests[C.name] = 1;
    if (quiet) return;
    gift(game, C.chest, 'จบ' + C.name.split(' · ')[0]);
    showDone(C, CHAPTERS[CHAPTERS.indexOf(C) + 1]);
  }
  // every lesson done: the tracker carries on as the story quest's (the journey is not needed any more)
  function finish(game) {
    st.done = true; st.on = false;
    save();
    const J = NC.Journey && NC.Journey.state;
    if (J && !J.done) { J.done = true; try { if (!game.noSave) localStorage.setItem('nightcamp.journey.v1', JSON.stringify(J)); } catch (e) { /* blocked */ } }
    if (NC.Journey && NC.Journey.render) NC.Journey.render(true);
  }
  // a story lesson handed in some other way (an old save, ?qall): it counts as done, without the lesson's gift
  function sync(game) {
    let moved = false;
    while (L() && L().mq && Q().done(L().mq)) { const C = chOf(st.i); st.i++; st.on = false; moved = true; if (st.i >= C.to) chapterEnd(game, C, true); if (st.i >= LESSONS.length) { finish(game); return; } }
    if (moved) snap();
    const l = L();
    if (l && l.mq && Q().state.on && Q().cur() && Q().cur().id === l.mq && st.baseFor !== l.id) snap(); // (MQ00 comes by itself)
  }

  // does any of the hero's skills have a rune slot open (the first opens at half the skill's top level: js/bl_runes.js)
  function slotOpen(p) {
    const ids = NC.jobSkills ? NC.jobSkills(p) : [];
    return ids.some((id) => { const S = (NC.SKILLS || {})[id]; return S && S.max && NC.skillLv(p, id) >= Math.ceil(S.max / 2); });
  }
  // the bag cell of the armour Hazel gave (the ring points at it)
  const giftCell = () => (st.gift ? `#inv .iv-cell[data-id="${st.gift}"]:not(.sel)` : ''); // (a bag cell names its kind in data-id, one cell per gear piece; once picked, the ring moves to "สวมใส่")

  // ---------------- the marks over the givers ----------------
  const MARK = {};
  for (const k of ['gold', 'blue', 'ready', 'wait']) { MARK[k] = new Image(); MARK[k].src = `assets/quest/qm_${k}.png`; }
  // the mark of a giver: { k: gold | blue | ready | wait } or null
  function markOf(game, id) {
    const p = game.player, q = Q() && Q().cur();
    if (active()) {
      const l = L(), s = lessonState();
      if (l && l.giver === id) {
        if (s === 'offer') return { k: 'gold', ch: '!', gold: true };
        if (s === 'on') return { k: 'wait', ch: '?', gold: false };
        if (s === 'ready') return { k: 'ready', ch: '?', gold: true };
      }
      // the story quest on now: a blue ! (not when it is a lesson still to come: one thing at a time)
      if (q && q.ok && q.giver === id && !(l && l.mq === q.id) && !LESSONS.some((x) => x.mq === q.id && LESSONS.indexOf(x) > st.i)) {
        if (!Q().state.on) return p.lv >= Q().lvNeed(q) ? { k: 'blue', ch: '!', gold: true } : null;
        return Q().ready(q, p) ? { k: 'ready', ch: '?', gold: true } : { k: 'wait', ch: '?', gold: false };
      }
      return null;
    }
    if (!q || !q.ok || q.giver !== id) return null;
    if (!Q().state.on) return p.lv >= Q().lvNeed(q) ? { k: 'gold', ch: '!', gold: true } : null;
    return Q().ready(q, p) ? { k: 'ready', ch: '?', gold: true } : { k: 'wait', ch: '?', gold: false };
  }
  function drawMark(ctx, game, m, x, y) {
    const im = MARK[m.k];
    if (!im || !im.complete || !im.naturalWidth) return false;
    const bob = Math.sin(game.time * 4) * 5, s = m.k === 'wait' ? 0.95 : 1 + Math.sin(game.time * 6) * 0.05, h = 70 * s, w = (im.naturalWidth / im.naturalHeight) * h;
    ctx.save();
    if (m.k !== 'wait' && NC.VFX) NC.VFX.glow(ctx, x, y - 10 + bob, 62, m.k === 'blue' ? '120,200,255' : '255,215,90', 0.35, true);
    ctx.drawImage(im, x - w / 2, y + bob - h + 18, w, h);
    ctx.restore();
    return true;
  }
  // the merchant, the smith and the cook are not story NPCs: their marks are drawn here
  const P = NC.Party;
  const baseTags = P.drawTags;
  P.drawTags = function (ctx, game) {
    baseTags.call(P, ctx, game);
    if (!game.player || game.mapId !== 'camp') return;
    for (const id in SYS) {
      const n = SYS[id].npc(); if (!n) continue;
      const m = markOf(game, id);
      if (m) drawMark(ctx, game, m, n.x, n.y - (id === 'smith' ? 250 : 230));
    }
    // the place the step is done at: a gold arrow (the dummies, the fire)
    const l = L(), p = game.player;
    if (!l || lessonState() !== 'on') return;
    const s = curStep(l, p), t = s && s.at ? spot(s.at) : null;
    if (t && t.map === game.mapId && t.arrow && ARROW.complete) {
      const h = 54, w = (ARROW.naturalWidth / ARROW.naturalHeight) * h, y = t.y - t.h - Math.abs(Math.sin(game.time * 3.4)) * 16;
      ctx.drawImage(ARROW, t.x - w / 2, y - h, w, h);
    }
  };
  const ARROW = new Image(); ARROW.src = 'assets/journey/arrow.png';
  // where a step's "at" is
  function spot(at) {
    if (at === 'dummy') { const d = NC.CAMP_SPOT && NC.CAMP_SPOT.dummies && NC.CAMP_SPOT.dummies[0]; return d ? { map: 'camp', x: d[0], y: d[1], h: 170, arrow: true } : null; }
    if (at === 'fire') { const f = NC.CAMP_SPOT && NC.CAMP_SPOT.fire; return f ? { map: 'camp', x: f.x, y: f.y + 120, h: 220, arrow: true } : null; }
    const w = who(at);
    return w ? { map: w.map, x: w.x, y: w.y + 60, h: 220 } : null;
  }

  // ---------------- AUTO ----------------
  // a spot in front of an NPC (below and a little to the side: walking to the feet could stop the hero behind them, half
  // hidden, as craftgo.js and journey.js found for the smith)
  const front = (w) => (w && w.x != null ? Object.assign({}, w, { x: w.x - 60, y: w.y + 90 }) : w);
  function travelTo(game, t, then) {
    if (!t) return;
    const J = NC.Journey;
    if (J && J.travel) J.travel(game, { map: t.map, x: t.x, y: t.y, r: 150, name: t.name || '' }, then);
  }
  function auto(game) {
    const l = L(), p = game.player, s = lessonState();
    if (!l) return;
    const J = NC.Journey;
    if (s === 'story') { if (J && J.storyAuto) J.storyAuto(game); return; }
    const giver = who(l.giver);
    if (s === 'offer' || s === 'ready') { if (giver) travelTo(game, front(giver), (g) => talk(g, l.giver, true)); return; }
    const c = curStep(l, p);
    if (!c) { if (l.mq && J && J.storyAuto) J.storyAuto(game); return; }
    if (c.map && game.mapId !== c.map) { travelTo(game, { map: c.map, x: null, y: null }); return; }
    const PANEL = { stat: 'status', skillup: 'skills', p_bag: 'bag', equip: 'bag', p_bigmap: 'bigmap', p_party: 'party', p_life: 'life', p_vend: 'vend', p_guild: 'guild', p_ranks: 'ranks' };
    if (c.ev === 'cg_out' || c.ev === 'brew') { if (game.mapId === 'camp' && c.ev === 'cg_out') travelTo(game, { map: 'meadow', x: null, y: null }, () => NC.CraftGo.open('brew')); else NC.CraftGo.open('brew'); return; }
    if (c.ev === 'runemerge') { NC.CraftGo.open('runes'); return; }
    if (c.ev === 'essence' || c.ev === 'oilmake') { NC.CraftGo.open('bl'); return; }
    if (c.near === 'wargate') { travelTo(game, who('wargate')); return; }
    if (c.ev === 'p_gwar') { if (NC.GW && NC.GW.ui && NC.GW.ui.board) NC.GW.ui.board(); else game.toast('กด T ที่ประตูศึกชิงกองไฟ'); return; }
    if (c.fn === 'rune') { game.paused = NC.HUD.panel('skills', true); return; }
    if (c.ev === 'hub_market') { if (NC.Hub) NC.Hub.open('market'); bump('hub_market'); return; }
    if (c.near === 'rootgate') { travelTo(game, who('rootgate')); return; }
    if (c.ev === 'p_rootlobby') { if (NC.Root && NC.Root.openLobby) NC.Root.openLobby(); return; }
    if (c.go === 'farm' && c.ev === 'life') { travelTo(game, { map: 'farm', x: null, y: null }); NC.HUD.log('เดินไปใกล้ต้นไม้ / แร่ / แปลงผัก แล้วกด B เพื่อเก็บ', 'sys'); return; }
    if (PANEL[c.ev]) { game.paused = NC.HUD.panel(PANEL[c.ev], true); return; }
    if (c.ev === 'warphome') { if (NC.Hub) NC.Hub.open('warp'); return; }
    if (c.ev === 'daily') { if (NC.Hub) { NC.Hub.open('quest'); setTimeout(() => { const b = document.querySelector('[data-qt="daily"]'); if (b) b.click(); }, 150); } return; }
    if (c.go === 'meadow') { travelTo(game, { map: 'meadow', x: null, y: null }); return; }
    if (c.go === 'batcave') { if (J) J.farm(game, 'bat', 'batcave'); return; }
    if (c.have === 'potions') { const t = spot('coco'); if (game.mapId === 'camp' && t && NC.dist(p.x, p.y, t.x, t.y) < 320) SYS.coco.open(game); else travelTo(game, t, (g) => SYS.coco.open(g)); return; }
    if (c.go === 'farm') {
      if (c.ev === 'autoon') { if (game.mapId !== 'farm') travelTo(game, { map: 'farm' }, (g) => { if (!NC.Auto.on) NC.Auto.toggle(g); }); else if (!NC.Auto.on) NC.Auto.toggle(game); return; }
      if (c.ev === 'autokill' || c.ev === 'loot') { if (J) J.farm(game, c.ev === 'loot' ? 'slime_green' : null, 'farm'); return; }
      travelTo(game, { map: 'farm' }); return;
    }
    if (c.go === 'lv') { if (J) J.farm(game, null, p.lv < 8 ? 'farm' : 'meadow'); return; }
    if (c.ev === 'pot') { game.toast('กดปุ่ม 1 (ช่องยาแดงที่แถบล่าง) เพื่อดื่มยา'); return; } // (a hands-on step: the ring shows the button)
    if (c.ev === 'sitfire') { const f = spot('fire'); if (nearFire(game)) { if (!p.sit) NC.Rest.toggle(game); } else travelTo(game, f, (g) => { if (!g.player.sit) NC.Rest.toggle(g); }); return; }
    if (c.tier) { game.paused = NC.HUD.panel('skills', true); return; }
    if (c.at) {
      const t = spot(c.at), w = SYS[c.at];
      if (w && c.at === 'smith' && /^p_(grade|opt)$|^(polish|optstone)$/.test(c.ev || '')) { const page = /grade|polish/.test(c.ev) ? 'grade' : 'opt'; if (t && game.mapId === 'camp' && NC.dist(p.x, p.y, t.x, t.y) < 320) NC.CraftGo.open(page); else travelTo(game, front(t), () => NC.CraftGo.open(page)); return; }
      if (w) { if (t && game.mapId === 'camp' && NC.dist(p.x, p.y, t.x, t.y) < 320) w.open(game); else travelTo(game, front(t), (g) => w.open(g)); return; }
      travelTo(game, t); return;
    }
    if (c.ev === 'eat') { if (NC.CraftGo) NC.CraftGo.open('cook'); return; }
    if (l.mq && J && J.storyAuto) J.storyAuto(game);
  }

  // ---------------- the talk window (mockup A) ----------------
  let dlg = null, dlgWho = '', dlgHtml = '';
  function buildDlg() {
    dlg = document.createElement('div');
    dlg.id = 'qdlg'; dlg.hidden = true;
    dlg.innerHTML = '<div class="qd-wrap"><img class="qd-npc" id="qd-npc" alt=""><section class="qd-win"><header class="qd-title"><span id="qd-name"></span>' +
      '<button class="kw-x" id="qd-x" aria-label="ปิด">✕</button></header><div class="qd-body" id="qd-body"></div></section></div>';
    document.body.appendChild(dlg);
    $('qd-x').addEventListener('click', closeDlg);
    dlg.addEventListener('mousedown', (e) => { if (e.target === dlg) closeDlg(); });
    dlg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-qd]'), g = G();
      if (!b || b.disabled || !g) return;
      const a = b.dataset.qd;
      if (a === 'x') closeDlg();
      // (a story quest's panels open over the world: the talk window steps aside for them)
      else if (a === 'take') { const l = L(); accept(g); if (l && l.mq) closeDlg(); else drawDlg(); }
      else if (a === 'in') { const l = L(); handIn(g); if (l && l.mq) closeDlg(); else drawDlg(); }
      else if (a === 'staken') { Q().take(g); closeDlg(); }
      else if (a === 'sin') { Q().handIn(g); closeDlg(); }
      else if (a === 'auto') { closeDlg(); auto(g); }
      else if (a === 'open') { const w = SYS[dlgWho]; closeDlg(); if (w) w.open(g); }
      else if (a === 'goto') { closeDlg(); const l = L(); if (l) { const w = who(l.giver); travelTo(g, front(w), (gg) => talk(gg, l.giver, true)); } }
      else if (a === 'skip') { if (b.dataset.armed) { closeDlg(); skipLesson(g); } else { b.dataset.armed = '1'; b.textContent = 'กดอีกครั้งเพื่อข้าม'; } }
    });
  }
  function closeDlg() { if (!dlg || dlg.hidden) return; dlg.hidden = true; const g = G(); if (g) g.paused = false; render(true); }
  // talk to a giver: true when the talk window took it (a system NPC with nothing waiting returns false: its own window opens)
  function talk(game, id, force) {
    if (!game || !game.player) return false;
    const m = markOf(game, id), w = who(id);
    if (!w) return false;
    if (SYS[id] && !force && !(m && m.k !== 'wait')) return false;
    if (!dlg) buildDlg();
    dlgWho = id; dlgHtml = '';
    bump('talk_' + id);
    NC.HUD.panel('pause', false); // (closes the other windows)
    dlg.hidden = false; game.paused = true;
    if (w.story) w.story.wave = 1.2;
    drawDlg();
    return true;
  }
  function stepsHtml(list) {
    return '<ol class="qd-steps">' + list.map((r, k) => `<li class="${r.done ? 'ok' : ''}${r.story ? ' story' : ''}"><span class="qd-n">${r.done ? '✓' : k + 1}</span>` +
      `<img src="${IC[r.ic] || IC.goal}" alt=""><span class="qd-t">${r.html}</span></li>`).join('') + '</ol>';
  }
  const rewardHtml = (r, extra) => {
    const bits = [];
    if (r.coins || extra) bits.push(`<img src="${IC.coin}" alt="">${fmt((r.coins || 0) + (extra || 0))} เหรียญ`);
    if (r.red) bits.push(`<img src="${IC.potion}" alt="">ยาแดง ×${r.red}`);
    if (r.blue) bits.push(`<img src="assets/ic_sppotion.png" alt="">ยาฟ้า ×${r.blue}`);
    return bits.length ? `<div class="qd-rew"><b>รางวัล</b>${bits.join('')}</div>` : '';
  };
  function drawDlg() {
    if (!dlg || dlg.hidden) return;
    const g = G(), p = g.player, w = who(dlgWho);
    if (!w) { closeDlg(); return; }
    $('qd-name').textContent = `${w.name} · ${w.title}`;
    $('qd-npc').src = sprSrc(w);
    const l = L(), s = lessonState(), q = Q() && Q().cur();
    const openBtn = w.sys ? `<button class="kw-btn blue" data-qd="open">${esc(w.sys.openTxt)}</button>` : '';
    let left = '', right = '';
    if (active() && l && l.giver === dlgWho && s !== 'story') {
      // a lesson
      const list = rows(l, p), mqq = l.mq && q && q.id === l.mq ? q : null;
      const C = chOf(st.i);
      left = `<span class="qd-tag">${esc(C.name)} · บทเรียน ${st.i - C.from + 1} / ${C.to - C.from}</span><h3>${esc(l.title)}</h3>` +
        `<div class="qd-line">${esc(s === 'ready' ? 'ทำได้ดีมาก! เก่งขึ้นเยอะเลยนะ' : s === 'on' ? 'ยังไม่ครบนะ ค่อย ๆ ทำไป ลองดูขั้นที่ยังไม่มีเครื่องหมายถูก' : l.line)}</div>`;
      const lvLow = mqq && s === 'offer' && p.lv < Q().lvNeed(mqq);
      right = '<div class="qd-card"><div class="qd-ch">ต้องทำอะไร</div>' + stepsHtml(list) +
        `<div class="qd-learn"><img src="${IC[l.steps[0].ic] || IC.goal}" alt="">ได้เรียน: <b>${esc(l.learn)}</b></div>` + rewardHtml(l.gift, mqq ? mqq.coins : 0) +
        (lvLow ? `<div class="qd-warn">ต้อง Lv ${Q().lvNeed(mqq)} ก่อน (ตอนนี้ Lv ${p.lv})</div>` : '') +
        '<div class="qd-btns">' +
        (s === 'offer' ? `<button class="kw-btn gold" data-qd="take"${lvLow ? ' disabled' : ''}>รับเควส</button><button class="kw-btn grey" data-qd="x">ไว้ทีหลัง</button>`
          : s === 'ready' ? '<button class="kw-btn gold" data-qd="in">ส่งเควส</button>'
          : '<button class="kw-btn gold" data-qd="auto">AUTO พาไปทำ</button><button class="kw-btn grey" data-qd="x">ปิด</button>') +
        openBtn + '</div>' + (s === 'offer' ? '<button class="qd-skip" data-qd="skip">ข้ามบทเรียนนี้</button>' : '') + '</div>';
    } else if (q && q.ok && q.giver === dlgWho && markOf(g, dlgWho)) {
      // a story quest (MQ04–07 now, every quest after the lessons)
      const on = Q().state.on, rd = on && Q().ready(q, p), lvOk = p.lv >= Q().lvNeed(q);
      const list = q.obj.filter((o) => o.k !== 'talk' || !on).map((o) => ({ html: o.k === 'talk' ? `<small>${esc(o.text)}</small>` : Q().objText(o, q.obj.indexOf(o), p), ic: 'goal', done: on && Q().objDone(q, o, q.obj.indexOf(o), p) }));
      left = `<span class="qd-tag story">${esc(q.ch)} · เควสเนื้อเรื่อง</span><h3>${esc(q.title)}</h3>` +
        `<div class="qd-line">${esc(rd ? 'ทำได้ครบแล้ว! ขอบใจมากนะ' : on ? 'ยังไม่ครบนะ ค่อย ๆ ทำไป' : (w.story && w.story.lines ? w.story.lines[0] : 'มีเรื่องอยากขอให้ช่วย...'))}</div>`;
      right = '<div class="qd-card"><div class="qd-ch">ต้องทำอะไร</div>' + stepsHtml(list) + rewardHtml({ coins: q.coins }) +
        (lvOk ? '' : `<div class="qd-warn">ต้อง Lv ${Q().lvNeed(q)} ก่อน · ฟาร์มให้ถึงก่อนนะ (เควสไม่ให้ EXP)</div>`) +
        '<div class="qd-btns">' + (!on ? `<button class="kw-btn gold" data-qd="staken"${lvOk ? '' : ' disabled'}>รับเควส</button><button class="kw-btn grey" data-qd="x">ไว้ทีหลัง</button>`
          : rd ? '<button class="kw-btn gold" data-qd="sin">ส่งเควส</button>' : '<button class="kw-btn grey" data-qd="x">ปิด</button>') + openBtn + '</div></div>';
    } else {
      // nothing waits here: a greeting and the way to what is on now
      const lw = l && active() ? who(l.giver) : null, waits = lw && s === 'story' && q;
      left = `<h3>${esc(w.name)}</h3><div class="qd-line">${esc(w.story && w.story.lines ? w.story.lines[0] : 'มีอะไรให้ช่วยก็บอกนะ')}</div>`;
      right = '<div class="qd-card"><div class="qd-ch">ตอนนี้</div>' +
        (waits ? `<p class="qd-now">บทเรียน ${st.i + 1} <b>${esc(l.title)}</b> รอเควสเนื้อเรื่องก่อน: <b>${esc(q.title)}</b> · ${esc(NC.questWhere ? NC.questWhere(q) : '')}</p>`
          : lw ? `<p class="qd-now">บทเรียน ${st.i + 1}: <b>${esc(l.title)}</b> กับ ${esc(lw.name)}</p>` : q && q.ok ? `<p class="qd-now">เควสเนื้อเรื่อง: <b>${esc(q.title)}</b> · ${esc(NC.questWhere ? NC.questWhere(q) : '')}</p>` : '<p class="qd-now">ไม่มีเควสค้างอยู่</p>') +
        '<div class="qd-btns">' + (waits ? '<button class="kw-btn gold" data-qd="auto">AUTO พาไปทำ</button>' : lw && lw.id !== dlgWho ? `<button class="kw-btn gold" data-qd="goto">พาไปหา${esc(lw.name)}</button>` : '') +
        openBtn + '<button class="kw-btn grey" data-qd="x">ลาก่อน</button></div></div>';
    }
    const html = `<div class="qd-left">${left}</div>${right}`;
    if (html !== dlgHtml) { dlgHtml = html; $('qd-body').innerHTML = html; }
  }

  // ---------------- the tracker (under the minimap) ----------------
  let trk = null, ring = null, collapsed = false, scrolled = null;
  function buildTracker() {
    trk = document.createElement('div');
    trk.id = 'lstrack'; trk.hidden = true;
    (document.getElementById('hud') || document.body).appendChild(trk);
    trk.addEventListener('click', (e) => {
      const g = G(); if (!g) return;
      const b = e.target.closest('[data-ls]');
      if (!b) return;
      const a = b.dataset.ls;
      if (a === 'auto') { if (active()) auto(g); else if (NC.Journey && NC.Journey.storyAuto) NC.Journey.storyAuto(g); render(true); }
      else if (a === 'daily') { if (NC.Hub) { NC.Hub.open('quest'); setTimeout(() => { const d = document.querySelector('[data-qt="daily"]'); if (d) d.click(); }, 150); } }
      else if (a === 'min') { collapsed = !collapsed; render(true); }
      else if (a === 'skipall') { if (b.dataset.armed) { finish(g); render(true); } else { b.dataset.armed = '1'; b.textContent = 'กดอีกครั้ง'; g.toast('กดอีกครั้งเพื่อข้ามบทเรียนทั้งหมด (สำหรับคนเคยเล่นแล้ว)'); setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'ข้าม'; } }, 3000); } }
    });
    ring = document.createElement('div');
    ring.id = 'lsring'; ring.hidden = true;
    ring.innerHTML = '<i class="lsr-ring"></i><img class="lsr-sp" src="assets/journey/sp_point.png" alt=""><b class="lsr-tag"></b>';
    document.body.appendChild(ring);
  }
  function skipLesson(game) {
    const l = L();
    if (!l) return;
    NC.HUD.log(`ข้ามบทเรียน: ${l.title}`, 'sys');
    next(game); // (a story lesson's quest stays a story quest: a blue ! from now)
  }
  let lastKey = '';
  function render(force) {
    if (!trk) return;
    const g = G(), p = g && g.player;
    if (!p) return;
    const on = active(), story = !on && storyMode();
    document.documentElement.classList.toggle('ls-on', on || story);
    trk.hidden = !(on || story);
    if (!on) ring.hidden = true;
    if (story) { renderStory(g, p, force); return; }
    if (!on) return;
    const l = L(), s = lessonState(), q = Q() && Q().cur();
    const moving = NC.Travel && NC.Travel.on, farming = NC.Auto && NC.Auto.on;
    const c = l && s === 'on' ? curStep(l, p) : null;
    const cv = c ? stepVal(l, c, l.steps.indexOf(c), p) : null;
    const goalIndex = q && Q().state.on ? q.obj.findIndex((o, i) => o.k !== 'talk' && !Q().objDone(q, o, i, p)) : -1;
    const goal = goalIndex >= 0 ? Q().objText(q.obj[goalIndex], goalIndex, p).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
    const key = [st.i, s, collapsed, moving, farming, c ? l.steps.indexOf(c) : -1, cv ? cv.join('/') : '', q ? q.id + Q().state.on : '', p.lv, goal, waitsPoint(c, p)].join('|');
    if (!force && key === lastKey) return;
    lastKey = key;
    const W = l ? who(l.giver) : null;
    const sub = s === 'offer' ? `${W ? W.name : ''} · ${W ? (NC.MAPS[W.map] || {}).name || '' : ''} · กดคุยเพื่อรับ`
      : s === 'ready' ? `กลับไปส่งเควสกับ${W ? W.name : ''}`
      : s === 'story' ? `ทำเควสเนื้อเรื่องก่อน: ${q ? q.title : ''}`
      : c ? `ขั้น ${l.steps.indexOf(c) + 1}: ${c.t}${cv && cv[1] > 1 ? ` (${Math.min(cv[0], cv[1])}/${cv[1]})` : ''}${waitsPoint(c, p) ? ` · ${c.ev === 'stat' ? 'รอขึ้นเลเวล' : 'รอขึ้น Job Lv'} ได้แต้มก่อน` : ''}` : goal || 'ทำเป้าของเควสให้ครบ';
    // a story quest taken (the journal's current quest) that is not this lesson's own: it is the row on now, the lesson
    // under it (Discord #149, 2026-10-20: the tracker showed the lesson "แรงต้องฝึก ขั้น 2", waiting for a skill point,
    // as the quest on while the journal's was the story quest "ไฟที่หรี่ลง"; only "ข้าม" brought the story back)
    const sq = storyTaken(l, q);
    // rows: the last two done, the one on now, the next two
    const C = chOf(st.i), from = Math.max(C.from, st.i - 2), to = Math.min(C.to, st.i + 3);
    let h = `<div class="ls-head"><img class="ls-sp" src="assets/journey/sp_idle.png" alt=""><b>${esc(C.name)}</b><em>${st.i - C.from}/${C.to - C.from}</em>` +
      '<button class="ls-skipall" data-ls="skipall" title="ข้ามบทเรียนทั้งหมด (สำหรับคนเคยเล่น)">ข้าม</button>' +
      `<button class="ls-min" data-ls="min" title="${collapsed ? 'ขยาย' : 'ย่อ'}">${collapsed ? '+' : '–'}</button></div>`;
    if (!collapsed) {
      h += '<div class="ls-rows">';
      for (let i = from; i < to; i++) {
        const x = LESSONS[i];
        if (i < st.i) h += `<div class="ls-row done"><i class="ls-ic ok">✓</i><span>${esc(x.title)}</span></div>`;
        else if (i === st.i && sq) {
          const rd = Q().ready(q, p), where = NC.questWhere ? NC.questWhere(q) : '';
          const goals = q.obj.map((o, k) => (o.k === 'talk' ? '' : `<i class="${Q().objDone(q, o, k, p) ? 'ok' : ''}">${Q().objText(o, k, p)}</i>`)).filter(Boolean).join('');
          h += `<div class="ls-row cur ${rd ? 'ready' : ''}"><img class="ls-ic" src="assets/quest/qm_${rd ? 'ready' : 'wait'}.png" alt="">` +
            `<span><b>${esc(q.title)}</b><small>${esc(rd ? `กลับไปส่งกับ ${where}` : `เควสเนื้อเรื่อง · ${where}`)}</small>${goals ? `<small class="ls-goals">${goals}</small>` : ''}</span>` +
            `<button class="ls-auto${moving || farming ? ' on' : ''}" data-ls="auto">${moving ? 'กำลังไป' : farming ? 'บอททำอยู่' : 'AUTO'}</button></div>` +
            `<div class="ls-row side ls-les"><img class="ls-ic" src="assets/quest/qm_${s === 'ready' ? 'ready' : s === 'on' ? 'wait' : 'gold'}.png" alt="">` +
            `<span><b>บทเรียน: ${esc(x.title)}</b><small>${esc(sub)}</small></span></div>`;
        } else if (i === st.i) {
          h += `<div class="ls-row cur ${s}"><img class="ls-ic" src="assets/quest/qm_${s === 'ready' ? 'ready' : s === 'on' ? 'wait' : s === 'story' ? 'blue' : 'gold'}.png" alt="">` +
            `<span><b>${esc(x.title)}</b><small>${esc(sub)}</small></span>` +
            `<button class="ls-auto${moving || farming ? ' on' : ''}" data-ls="auto">${moving ? 'กำลังไป' : farming ? 'บอททำอยู่' : 'AUTO'}</button></div>`;
          // the story quest on now (MQ04–07): its own blue line
          if (s !== 'story' && q && q.ok && !(x.mq === q.id) && !LESSONS.some((y) => y.mq === q.id && LESSONS.indexOf(y) > st.i) && markOf(g, q.giver))
            h += `<div class="ls-row side"><img class="ls-ic" src="assets/quest/qm_blue.png" alt=""><span><b>${esc(q.title)}</b><small>เควสเนื้อเรื่อง · ${esc(NC.questWhere ? NC.questWhere(q) : '')}</small></span></div>`;
        } else h += `<div class="ls-row lock"><i class="ls-ic lk"></i><span>${esc(x.title)}</span></div>`;
      }
      h += '</div>';
    }
    trk.innerHTML = h;
    place();
    fit();
  }
  // after the lessons: the story quest on now, its goals, AUTO, and the daily board
  const storyMode = () => { const J = NC.Journey && NC.Journey.state; return st.done && !(J && !J.done); };
  function renderStory(g, p, force) {
    const q = Q() && Q().cur(), on = q && Q().state.on, rd = on && Q().ready(q, p), moving = NC.Travel && NC.Travel.on, farming = NC.Auto && NC.Auto.on;
    const goals = q && on ? q.obj.map((o, k) => (o.k === 'talk' ? '' : `<i class="${Q().objDone(q, o, k, p) ? 'ok' : ''}">${Q().objText(o, k, p)}</i>`)).filter(Boolean).join('') : '';
    const key = ['story', q ? q.id : '', on, rd, goals, moving, farming, collapsed, p.lv].join('|');
    if (!force && key === lastKey) return;
    lastKey = key;
    const where = q && NC.questWhere ? NC.questWhere(q) : '';
    const sub = !q ? 'จบเรื่องที่มีแล้ว · รอบทต่อไปในอัปเดต' : !q.ok ? 'บทต่อไปมาในอัปเดตหน้า' : rd ? `กลับไปส่งกับ ${where}` : on ? '' : p.lv < Q().lvNeed(q) ? `ฟาร์มให้ถึง Lv ${Q().lvNeed(q)} ก่อน (เควสไม่ให้ EXP)` : `รับได้ที่ ${where}`;
    const icon = !q || !q.ok ? 'wait' : rd ? 'ready' : on ? 'wait' : 'gold';
    let h = `<div class="ls-head"><img class="ls-sp" src="assets/journey/sp_idle.png" alt=""><b>${esc(q ? q.ch : 'เควสเนื้อเรื่อง')}</b>` +
      `<button class="ls-min" data-ls="min" title="${collapsed ? 'ขยาย' : 'ย่อ'}">${collapsed ? '+' : '–'}</button></div>`;
    if (!collapsed) {
      h += '<div class="ls-rows">' + (q ? `<div class="ls-row cur ${rd ? 'ready' : ''}"><img class="ls-ic" src="assets/quest/qm_${icon}.png" alt="">` +
        `<span><b>${esc(q.title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}${goals ? `<small class="ls-goals">${goals}</small>` : ''}</span>` +
        (q.ok ? `<button class="ls-auto${moving || farming ? ' on' : ''}" data-ls="auto">${moving ? 'กำลังไป' : farming ? 'บอททำอยู่' : 'AUTO'}</button>` : '') + '</div>' : '') +
        '<button class="ls-row link" data-ls="daily"><img class="ls-ic" src="assets/quest/qm_blue.png" alt=""><span><b>กระดานรายวัน</b><small>งานล่าค่าหัววันละ 3 งาน · J → เควส</small></span></button></div>';
    }
    trk.innerHTML = h;
    place();
  }
  // too little room under the minimap: drop the rows done first, then the ones to come (the one on now always stays)
  function fit() {
    const max = parseFloat(trk.style.maxHeight) || 9999;
    const rowsEl = trk.querySelector('.ls-rows');
    if (!rowsEl) return;
    for (let k = 0; k < 8 && trk.scrollHeight > max; k++) {
      const drop = rowsEl.querySelector('.ls-row.done') || [...rowsEl.querySelectorAll('.ls-row.lock')].pop();
      if (!drop) break;
      drop.remove();
    }
  }
  // under the hero's frame at the left, above the chat (mockup A had it under the minimap, but the game's AUTO button and
  // coins sit there: only one row fitted); fewer rows when there is little room
  function place() {
    const fr = document.querySelector('#hud .cframe'), ch = document.querySelector('#chatwin');
    const a = fr && fr.getClientRects().length ? fr.getBoundingClientRect() : { bottom: 120, left: 16 };
    const b = ch && ch.getClientRects().length ? ch.getBoundingClientRect() : { top: innerHeight * 0.6 };
    trk.style.top = Math.round(a.bottom + 10) + 'px';
    trk.style.maxHeight = Math.max(90, Math.round((b.top > a.bottom ? b.top : innerHeight * 0.6) - a.bottom - 22)) + 'px';
  }
  // the ring on the real button the step asks for, with the spirit and "ขั้น N" by it
  function drawRing() {
    const g = G(), p = g && g.player, l = L();
    if (!ring || !l || !active() || lessonState() !== 'on' || (dlg && !dlg.hidden)) { if (ring) ring.hidden = true; return; }
    const c = curStep(l, p);
    // no point to spend yet (a new job's Job Lv 1): nothing to press, AUTO levels first (js/questauto.js)
    if (waitsPoint(c, p)) { ring.hidden = true; return; }
    let el = null, under = null;
    // (a button under an open window, the menu bar's K behind the status window: the next one in the list that can be
    // pressed, else that one; 2026-10-18 the ring sat on a covered button and the lesson looked stuck)
    const open = (e) => { const b = e.getBoundingClientRect(), t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !t || t === e || e.contains(t) || ring.contains(t); };
    if (c && c.ring) for (const r0 of c.ring) { const sel = typeof r0 === 'function' ? r0() : r0; if (!sel) continue; for (const e of document.querySelectorAll(sel)) { if (e.getClientRects().length && !e.closest('[hidden]')) { if (open(e)) { el = e; break; } if (!under) under = e; } } if (el) break; }
    if (!el) el = under;
    if (!el) { ring.hidden = true; return; }
    // a button scrolled out of its window's view (the bag card's "สวมใส่"): bring it in once, then leave the scrolling to the player
    // (or covered by a window's sticky buttons: the skill card's rune list under its "+1 เรียน" bar)
    if (el !== scrolled) {
      scrolled = el;
      const box = el.closest('.kw-scroll, .iv-detail, .cg-page, [class*="scroll"]'), b = el.getBoundingClientRect();
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2), covered = top && top !== el && !el.contains(top) && !(ring && ring.contains(top));
      if (box) { const a = box.getBoundingClientRect(); if (b.bottom > a.bottom || b.top < a.top || covered) el.scrollIntoView({ block: covered ? 'center' : 'nearest' }); }
      else if (covered) el.scrollIntoView({ block: 'center' });
    }
    const r = el.getBoundingClientRect();
    ring.hidden = false;
    ring.style.left = Math.round(r.left - 6) + 'px'; ring.style.top = Math.round(r.top - 6) + 'px';
    ring.style.width = Math.round(r.width + 12) + 'px'; ring.style.height = Math.round(r.height + 12) + 'px';
    const tag = ring.querySelector('.lsr-tag'), txt = `ขั้น ${l.steps.indexOf(c) + 1}: ${c.t.split(' (')[0]}`;
    if (tag.textContent !== txt) tag.textContent = txt;
    ring.classList.toggle('onright', r.left + r.width / 2 > innerWidth * 0.5); // (the spirit and the tag go to the side with room)
    ring.classList.toggle('up', r.top > innerHeight * 0.6);
  }
  function showDone(C, N) {
    const box = document.createElement('div');
    box.className = 'ls-done';
    box.innerHTML = `<img src="assets/journey/chest_open.png" alt=""><h3>จบ${esc(C.name.split(' · ')[0])}แล้ว!</h3><p>รางวัลจบบท: ${fmt(C.chest.coins)} เหรียญ · ยาแดง ×${C.chest.red} · ยาฟ้า ×${C.chest.blue}</p>` +
      (N ? `<p>ต่อไป: ${esc(N.name)} · บทเรียนรออยู่ที่ป้าย ! สีทอง</p>` : '<p>ต่อจากนี้ตามเควสเนื้อเรื่องที่ป้าย ! สีทองได้เลย กระดานรายวันรออยู่ในสมุด (J)</p>') + '<button class="kw-btn gold">ไปต่อ</button>';
    document.body.appendChild(box);
    box.querySelector('button').addEventListener('click', () => box.remove());
  }

  // ---------------- input: T / a click on the merchant, the smith, the cook ----------------
  // (the story NPCs come through js/storynpc.js's open; the B keys and clicks of the three through their files' hooks)
  addEventListener('keydown', (e) => {
    const g = G();
    if (!g || !g.player || e.repeat) return;
    if (dlg && !dlg.hidden && (e.code === 'Escape' || e.code === 'KeyT')) { e.stopImmediatePropagation(); e.preventDefault(); closeDlg(); return; }
    if (e.code !== 'KeyT') return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (g.mapId !== 'camp') return;
    const p = g.player, SN = NC.StoryNPC;
    const storyNear = SN && SN.list.some((n) => n.map === g.mapId && (!SN.present || SN.present(n)) && NC.dist(p.x, p.y, n.x, n.y) < 230);
    if (storyNear) return; // (storynpc.js opens the nearest story NPC, through this window)
    for (const id in SYS) { const n = SYS[id].npc(); if (n && NC.dist(p.x, p.y, n.x, n.y) < 290) { e.stopImmediatePropagation(); talk(g, id, true); return; } }
  }, true);

  // ---------------- hooks ----------------
  Object.assign(NC.Lessons, {
    LESSONS, state: st, active, of: (game, id) => markOf(game, id), draw: drawMark, cur: L, lessonState, auto: () => auto(G()),
    // (storynpc.js open / shop.js, forge.js, cooking.js B and clicks): true when the talk window took the NPC
    talk: (game, id, force) => talk(game, id, force),
    // (js/questauto.js: the step AUTO plays. A step waiting for a point while a story quest is taken: none, so AUTO plays
    // the story quest the tracker shows on top, not a farm for a job level; once the point comes, the step is back)
    step: () => { const l = L(), g = G(); if (!l || !g || !g.player) return null; const c = curStep(l, g.player); return c && waitsPoint(c, g.player) && storyTaken(l, Q() && Q().cur()) ? null : c; },
  });
  // an old save (none of the lessons' own): past what the story already went by (the story beyond MQ08, or the journey
  // past its first stage)
  function migrate(game) {
    const p = game.player, J = NC.Journey && NC.Journey.state;
    const idx = (id) => (Q() ? Q().data.findIndex((x) => x.id === id) : -1), qi = Q() ? Q().state.i : 0;
    st.chests = st.chests || {};
    // the last story lesson of each chapter: past it, that chapter is done
    const ends = CHAPTERS.map((C) => { const last = LESSONS.slice(C.from, C.to).filter((x) => x.mq).pop(); return last ? idx(last.mq) : -1; });
    if (ends[ends.length - 1] >= 0 && qi > ends[ends.length - 1]) { st.done = true; CHAPTERS.forEach((C) => { st.chests[C.name] = 1; }); } // (past every chapter)
    else if (!keyed && J && J.stage >= 1 && !J.done && p.lv >= 10) { st.done = true; CHAPTERS.forEach((C) => { st.chests[C.name] = 1; }); } // (the journey's stage 2 is on: it stays the guide)
    else {
      // every lesson up to the last story lesson already handed in went by (before: only whole chapters, so a hero at
      // MQ05 was sent back to the dummies of lesson 3)
      let k = -1;
      LESSONS.forEach((x, i) => { if (x.mq && Q() && Q().done(x.mq)) k = i; });
      let at = k + 1;
      const cq = Q() && Q().cur(), j = cq && Q().state.on ? LESSONS.findIndex((x) => x.mq === cq.id) : -1;
      if (j > at) at = j; // (its story quest already taken: the lessons before it went by too)
      if (at > st.i) { st.i = at; CHAPTERS.forEach((C) => { if (C.to <= st.i) st.chests[C.name] = 1; }); }
    }
  }
  // ?online (online/extras.js, once the server names the hero): this hero's own lessons, kept on this device; a hero
  // never seen here starts where the server's story says
  NC.Lessons.useSave = (key, game) => {
    if (!key || (keyed && saveKey === key)) return;
    if (keyed && dirty) save();
    dirty = false;
    saveKey = key; keyed = true;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { /* blocked */ }
    for (const k of Object.keys(st)) delete st[k];
    Object.assign(st, blank(), s || {});
    loaded = !!s;
    game = game || G();
    if (game && game.player) {
      const before = st.i;
      migrate(game); // a stale device save cannot send an active story quest back to an earlier lesson
      if (st.i > before) { st.on = false; st.baseFor = ''; }
    }
    snapIfNew();
    if (game && game.player) sync(game);
    save();
    render(true);
  };
  const snapIfNew = () => { if (!st.baseFor) snap(); };
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    buildTracker();
    if (!loaded) migrate(game);
    if (!st.baseFor) snap();
    sync(game);
    render(true);
  };
  const baseUpdate = NC.HUD.update.bind(NC.HUD);
  let tT = 0;
  NC.HUD.update = function (game) {
    baseUpdate(game);
    try {
      if (!active()) { if (ring && !ring.hidden) ring.hidden = true; tT -= 1 / 60; if (tT <= 0) { tT = 0.5; render(); if (dlg && !dlg.hidden) drawDlg(); } return; }
      poll(game);
      sync(game);
      tT -= 1 / 60;
      if (tT <= 0) { tT = 0.25; render(); if (dlg && !dlg.hidden) drawDlg(); }
      drawRing();
    } catch (e) { console.error(e); }
  };
  addEventListener('resize', () => { if (trk && !trk.hidden) place(); });
  addEventListener('nightcamp:online-hud-layout', () => { if (trk && !trk.hidden) place(); }); // (js/online/hud.js moved the hero card)
})();
