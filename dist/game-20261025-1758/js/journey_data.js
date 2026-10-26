/* journey_data.js — the guided journey's steps as plain data (js/journey.js plays them on the web; the server and the
   Unity client read the same steps from tools/export_journey.mjs -> journey.json). No functions here: what a step
   checks, what AUTO does and where the way leads are small descriptors each side interprets.
     check   { k: 'ever', ev }      a counter ever reached `need` (a window opened, a potion drunk...)
             { k: 'since', ev }     a counter grew by `need` since the step began (kills of a kind, sales, gathering)
             { k: 'map', map }      the hero has been on that map (or is on it)
             { k: 'jobLv' }         the job level (a job already changed counts as done)
             { k: 'tier', n }       the job's tier is n or more
             { k: 'done', id } / { k: 'reached', id }   a story quest handed in / taken (or past it)
             { k: 'any', of: [...] } the best of several
     counters  kill, k_<species>, equip, pot, sit, sell, stat, skill, life, refine, m_<map>, warphome (a warp home from
               a map not next to the camp), talk_<npc>; the client-only ones (the server can't see them) p_<window>
               (bag, status, skills, bigmap, party, lifementor, shop) and daily (the dailies' tab opened)
     auto    { k: 'npc', npc, panel? }  walk to that NPC and talk (or open its window); npc: a story NPC id, or 'coco'
                                        (the merchant) / 'forge' (the smith)
             { k: 'go', map }           walk onto that map    { k: 'farm', sp?, map? }  auto farm (that kind) there
             { k: 'farm', lvMap: true } auto farm on the field that suits the level
             { k: 'panel', panel }      open a window          { k: 'stat' }  the status window, or farm a level first
             { k: 'potion' } { k: 'sit' } { k: 'warp', map } { k: 'daily' } { k: 'story' } (the story quest's next part)
     target  where the firefly trail and the arrow lead: { npc } · { map, sp } (the nearest of that kind) · { map, x, y }
     spot    the HUD button that gets the ring: bag, status, skills, map, journal, party, auto
     give    at the step's start (the potions a step teaches with) · coins at its end · the chest at the stage's end
   Rewards: coins and potions only (the quest rules: no EXP, no gear). */
window.NC = window.NC || {};
NC.JOURNEY_DATA = {
  version: 1,
  levelDone: 20, // an old save at this level or more: the journey counts as done
  stages: [
    { id: 'first_night', name: 'คืนแรก', lv: 'Lv 1–10', chest: { coins: 2000, red: 10, blue: 5 }, steps: [
      { id: 'fire', title: 'คุยกับตาลูเมนที่กองไฟ', where: 'ตาลูเมน · ค่ายกลางป่า กองไฟกลางค่าย', hint: 'เดินไปใกล้ ๆ แล้วกด <kbd>T</kbd> หรือคลิกที่ตัว',
        say: 'ไฟกองนี้คือที่ที่ปลอดภัยที่สุดในป่านี้ ไปทักตาลูเมนก่อนเลย!', need: 1,
        check: { k: 'any', of: [{ k: 'done', id: 'MQ00' }, { k: 'ever', ev: 'talk_lumen' }] }, auto: { k: 'npc', npc: 'lumen' }, target: { npc: 'lumen' }, coins: 100 },
      { id: 'bag', title: 'เปิดกระเป๋าดูของที่มี', where: 'ปุ่มกระเป๋า มุมขวาล่าง', hint: 'กด <kbd>I</kbd> หรือปุ่มกระเป๋า', need: 1,
        check: { k: 'ever', ev: 'p_bag' }, auto: { k: 'panel', panel: 'bag' }, spot: 'bag', coins: 100 },
      { id: 'east', title: 'ออกไปไร่ฟักทองทางตะวันออก', where: 'ไร่ฟักทอง · ทางออกขวาของค่าย', hint: 'เดินด้วย <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ตามหิ่งห้อยไป',
        say: 'ข้างนอกมืดหน่อย แต่ตามแสงหิ่งห้อยไปไม่หลงแน่!', need: 1,
        check: { k: 'map', map: 'farm' }, auto: { k: 'go', map: 'farm' }, target: { map: 'farm', sp: 'slime_green' }, coins: 150 },
      { id: 'slime', title: 'ล่าสไลม์เขียว 10 ตัว', where: 'ไร่ฟักทอง · สไลม์ตัวเล็กใกล้ทางเข้า', hint: 'คลิกซ้ายหรือ <kbd>Space</kbd> เพื่อตี · ของที่ดรอปจะลอยเข้าตัวเอง', need: 10,
        check: { k: 'since', ev: 'k_slime_green' }, auto: { k: 'farm', sp: 'slime_green', map: 'farm' }, target: { map: 'farm', sp: 'slime_green' }, coins: 200 },
      { id: 'stat', title: 'อัพแต้มสเตตัส', where: 'หน้าสถานะ', hint: 'กด <kbd>C</kbd> แล้วกด + ที่ค่าที่อยากได้ (ขึ้นเลเวลได้แต้มเพิ่ม)', need: 1, wait: 'statPoints',
        check: { k: 'ever', ev: 'stat' }, auto: { k: 'stat' }, spot: 'status', coins: 150 },
      { id: 'skill', title: 'เปิดหน้าสกิล ดูสกิลที่ใช้ได้', where: 'หน้าสกิล', hint: 'กด <kbd>K</kbd> · ลากสกิลลงแถบล่าง แล้วกดปุ่มตามช่อง', need: 1,
        check: { k: 'any', of: [{ k: 'ever', ev: 'p_skills' }, { k: 'ever', ev: 'skill' }] }, auto: { k: 'panel', panel: 'skills' }, spot: 'skills', coins: 150, give: { red: 5 } },
      { id: 'potion', title: 'กินยาฟื้นเลือด', where: 'ยาแดงในแถบล่าง', hint: 'กด <kbd>1</kbd> กินยาแดง · <kbd>2</kbd> ยาฟ้า (ประกายให้ยาไว้แล้ว 5 ขวด)', need: 1,
        check: { k: 'ever', ev: 'pot' }, auto: { k: 'potion' }, coins: 100, give: { blue: 3 } },
      { id: 'sit', title: 'นั่งพักให้เลือดฟื้นเร็ว', where: 'ที่ไหนก็ได้ที่ไม่มีมอนใกล้ ๆ', hint: 'กด <kbd>X</kbd> นั่งพัก · กดอีกทีลุก', need: 1,
        check: { k: 'ever', ev: 'sit' }, auto: { k: 'sit' }, coins: 100 },
      { id: 'auto', title: 'ให้บอทฟาร์มแทน ล่ามอน 30 ตัว', where: 'ปุ่ม AUTO ข้างแถบสกิล', hint: 'กด <kbd>Z</kbd> หรือปุ่ม AUTO · เดินเองเมื่อไหร่บอทก็หยุด', need: 30,
        say: 'เหนื่อยแล้วใช่ไหม ให้บอทล่าแทนได้นะ!', check: { k: 'since', ev: 'kill' }, auto: { k: 'farm', lvMap: true }, spot: 'auto', coins: 250 },
      { id: 'coco', title: 'กลับค่าย ขายของให้ลุงโกโก้', where: 'ลุงโกโก้ · แผงร้านในค่าย', hint: 'ไปใกล้ ๆ ลุงแล้วกด <kbd>B</kbd> · ขายวัสดุที่ไม่ใช้ได้เงิน', need: 1,
        check: { k: 'since', ev: 'sell' }, auto: { k: 'npc', npc: 'coco', panel: 'shop' }, target: { npc: 'coco' }, coins: 300 },
      { id: 'joblv', title: 'ฝึกให้ถึงเลเวลอาชีพ (Job) 10', where: 'ไร่ฟักทอง / ทุ่งหญ้า', hint: 'ล่ามอนได้ทั้ง EXP และ Job EXP · ดูแถบ Job ล่างจอ', need: 10,
        check: { k: 'jobLv' }, auto: { k: 'farm', lvMap: true }, coins: 300 },
      { id: 'job', title: 'เปลี่ยนอาชีพ!', where: 'หน้าสกิล → แท็บอาชีพ', hint: 'กด <kbd>K</kbd> เลือกอาชีพ: อัศวิน จอมเวท นักธนู โจร นักบวช', need: 1,
        say: 'ถึงเวลาเลือกทางของเจ้าแล้ว!', check: { k: 'tier', n: 1 }, auto: { k: 'panel', panel: 'skills' }, spot: 'skills', coins: 500 },
    ] },
    { id: 'beyond_light', name: 'พ้นแสงไฟ', lv: 'Lv 10–20', chest: { coins: 6000, red: 20, blue: 10 }, steps: [
      { id: 'forge', title: 'ให้ป๋าหมูหริ่งตีบวกของ +1', where: 'เตาตีเหล็ก ป๋าหมูหริ่ง · ค่ายกลางป่า', hint: 'ยืนใกล้เตา เปิดกระเป๋า คลิกอาวุธ แล้วกด "ตีบวก"', need: 1,
        say: 'ของแรงขึ้นคนก็รอดนานขึ้น ไปหาป๋าหมูกัน!', check: { k: 'ever', ev: 'refine' }, auto: { k: 'npc', npc: 'forge', panel: 'bag' }, target: { npc: 'forge' }, coins: 300 },
      { id: 'teacher', title: 'ไปฟาร์มหิ่งห้อย หาครูอาชีพเสริม', where: 'ครูกระต่าย · ฟาร์มหิ่งห้อย (ทางขวาล่างของค่าย)', hint: 'ยืนใกล้ครูแล้วกด <kbd>B</kbd> · ตัดไม้ ขุดแร่ ปลูกผัก ตกปลา ได้ของไปขายหรือใช้', need: 1,
        check: { k: 'ever', ev: 'p_lifementor' }, auto: { k: 'npc', npc: 'rabbit' }, target: { npc: 'rabbit' }, coins: 300 },
      { id: 'gather', title: 'เก็บของอาชีพเสริม 10 ครั้ง', where: 'ฟาร์มหิ่งห้อย', hint: 'เดินไปที่ต้นไม้ หิน แปลงผัก แล้วกดเก็บตามที่ขึ้นบนจอ', need: 10,
        check: { k: 'since', ev: 'life' }, auto: { k: 'go', map: 'homefarm' }, target: { map: 'homefarm' }, coins: 400 },
      { id: 'meadow', title: 'ไปทุ่งหญ้าทางตะวันตก', where: 'ทุ่งหญ้า · มอน Lv 8–18', hint: 'ทางออกซ้ายของค่าย', need: 1,
        check: { k: 'map', map: 'meadow' }, auto: { k: 'go', map: 'meadow' }, target: { map: 'meadow' }, coins: 300 },
      { id: 'map', title: 'เปิดแผนที่ ดูว่าอยู่ตรงไหน', where: 'ปุ่มแผนที่', hint: 'กด <kbd>M</kbd> · กดแมพไหนก็ได้แล้วกด "นำทาง" จะมีลูกศรพาไป', need: 1,
        check: { k: 'ever', ev: 'p_bigmap' }, auto: { k: 'panel', panel: 'bigmap' }, spot: 'map', coins: 200 },
      { id: 'bee', title: 'ล่าผึ้ง 50 ตัว', where: 'ทุ่งหญ้า', hint: 'ใช้ออโต้ฟาร์มได้ (<kbd>Z</kbd>) · ตั้งค่าให้ล่าเฉพาะผึ้งในหน้าออโต้', need: 50,
        check: { k: 'since', ev: 'k_bee' }, auto: { k: 'farm', sp: 'bee', map: 'meadow' }, target: { map: 'meadow', sp: 'bee' }, coins: 500 },
      { id: 'cave', title: 'เข้าถ้ำค้างคาว', where: 'ปากถ้ำในทุ่งหญ้า · ดันเจี้ยน Lv 8–16', hint: 'ในถ้ำมืดและมอนเยอะ ระวังด้วย', need: 1,
        say: 'ข้างในมืดกว่าข้างนอกอีก... ข้าจะส่องทางให้เอง', check: { k: 'map', map: 'batcave' }, auto: { k: 'go', map: 'batcave' }, target: { map: 'batcave' }, coins: 500 },
      { id: 'warp', title: 'วาร์ปกลับค่ายด้วยลูกไฟนำทาง', where: 'J → วาร์ป (ไปได้ทุกแมพที่เคยไป)', hint: 'กด <kbd>J</kbd> → แท็บวาร์ป → ค่ายกลางป่า · เสียเหรียญนิดหน่อย', need: 1,
        check: { k: 'ever', ev: 'warphome' }, auto: { k: 'warp', map: 'camp' }, spot: 'journal', coins: 300 },
      { id: 'daily', title: 'ดูกระดานเควสรายวัน', where: 'J → เควส → รายวัน', hint: 'ทุกวันมีเควส 3 อัน ได้เหรียญ เหรียญฤดูกาล และชื่อเสียง', need: 1,
        check: { k: 'ever', ev: 'daily' }, auto: { k: 'daily' }, spot: 'journal', coins: 300 },
      { id: 'party', title: 'เปิดหน้าปาร์ตี้', where: 'ปุ่มปาร์ตี้', hint: 'กด <kbd>P</kbd> · ชวนเพื่อนตีด้วยกัน แบ่ง EXP และของ', need: 1,
        check: { k: 'ever', ev: 'p_party' }, auto: { k: 'panel', panel: 'party' }, spot: 'party', coins: 200 },
      { id: 'story', title: 'ทำเควสเนื้อเรื่องจนถึง "หมอผู้ขโมยไฟ"', where: 'ดูเควสที่ J → เควส · ผู้ให้เควสมีเครื่องหมาย ! เหนือหัว', hint: 'AUTO จะพาไปรับเควส ล่ามอนที่เควสต้องการ และส่งเควสให้', need: 1,
        say: 'มีคนในค่ายต้องการความช่วยเหลือเยอะเลย ไปช่วยพวกเขากัน!', check: { k: 'reached', id: 'MQ15' }, progress: 'story', auto: { k: 'story' }, coins: 1000 },
      { id: 'ivy', title: 'ล้มไอวี่ หมอผู้ขโมยไฟ', where: 'ทุ่งหญ้า · บอสเนื้อเรื่อง Lv 20', hint: 'ไปเป็นปาร์ตี้จะง่ายขึ้น · พกยาไปเยอะ ๆ', need: 1,
        say: 'นางขโมยไฟของค่ายไป... เอาคืนมาให้ได้นะ!', check: { k: 'done', id: 'MQ15' }, auto: { k: 'story' }, target: { map: 'meadow', x: 3925, y: 1455, boss: 'sb_ivy' }, coins: 1500 },
    ] },
  ],
  // the counters the client sends (the server can't see these: windows opened)
  clientEvents: ['p_bag', 'p_status', 'p_skills', 'p_bigmap', 'p_party', 'p_lifementor', 'p_shop', 'daily'],
};
