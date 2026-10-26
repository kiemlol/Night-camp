/* hitstyle.js — the player picks the hit style: the old look or the new one (2026-10-04, the user after the Archer's
   drawn effects were taken back: "ทำระบบให้เลือกใช้ hit style ได้ แบบเก่ากับแบบใหม่"). ESC menu → ตั้งค่า (NC.MENU_SETTINGS,
   js/menuwin.js): one row turns them all new or old, then a row for each look:
     เลขดาเมจ        new: the burst numbers (js/dmgburst.js) · old: classic MMOs' numbers              default new
     นักธนู          new: arrows of wind and stars drawn by code (js/archerfx.js)                  default OLD (the user's pick)
     จอมเวทไฟ        new: fire drawn by code (js/emberfx.js)                                       default new
     จอมเวทน้ำแข็ง    new: Blender ice (js/crystalburst.js, js/frostfx.js)                          default new
     อาร์คเมจ         new: Blender bolts and orbs (js/arcanefx.js)                                   default new
     วอร์ล็อก         new: Blender soulfire (js/warlockfx.js)                                        default new
     พาลาดิน         new: the Blender barrier and Heaven's swords (js/barrierfx.js, js/heavenfx.js) default new
   Every look file has an `on` switch it reads while drawing, so a change shows at once. The choices are kept in
   localStorage (nc_hit_<id> = 'new' / 'old'; the numbers keep dmgburst.js's own nc_dmgfx). Test switch: ?hitstyle=old
   or ?hitstyle=new sets every look for this page (not kept). Load after the look files, before menuwin.js. */
(function () {
  'use strict';
  const NC = window.NC;
  const fx = (...names) => names.map((n) => NC[n]).filter(Boolean);
  const STYLES = [
    { id: 'dmg', name: 'เลขดาเมจ', note: 'ใหม่: เลขรัวตามจังหวะเอฟเฟกต์ สีตามอาชีพ · เก่า: เลขโค้งตกแบบเดิม', mods: () => (NC.DmgFX ? [NC.DmgFX] : []), def: 'new',
      key: 'nc_dmgfx', save: (v) => (v === 'new' ? 'burst' : '0'), load: (s) => (s === null ? null : s === '0' ? 'old' : 'new') },
    { id: 'archer', name: 'นักธนู', note: 'ใหม่: ลูกธนูลม/ดาว วาดด้วยโค้ด', mods: () => fx('ArcherFX'), def: 'old' },
    { id: 'ember', name: 'จอมเวทไฟ', note: 'ใหม่: ไฟวาดด้วยโค้ด', mods: () => fx('EmberFX'), def: 'new' },
    { id: 'ice', name: 'จอมเวทน้ำแข็ง', note: 'ใหม่: น้ำแข็งจาก Blender', mods: () => fx('CrystalFX', 'FrostFX'), def: 'new' },
    { id: 'arcane', name: 'อาร์คเมจ', note: 'ใหม่: ลูกเวทจาก Blender', mods: () => fx('ArcaneFX'), def: 'new' },
    { id: 'warlock', name: 'วอร์ล็อก', note: 'ใหม่: ไฟวิญญาณจาก Blender', mods: () => fx('WarlockFX'), def: 'new' },
    { id: 'paladin', name: 'พาลาดิน', note: 'ใหม่: บาเรียและดาบสวรรค์จาก Blender', mods: () => fx('BarrierFX', 'HeavenFX'), def: 'new' },
    { id: 'priest', name: 'สายพระ', note: 'ใหม่: แสงอนุภาค + bloom (js/priestlight.js)', mods: () => fx('PriestLight'), def: 'new' },   // (the user, 2026-10-19: "เปิดแบบแสงของสายพระเป็นค่าเริ่มต้นเลย")
    { id: 'knight', name: 'สายอัศวิน', note: 'ใหม่: แสงอนุภาค + bloom (js/knightlight.js)', mods: () => fx('KnightLight'), def: 'new' },   // (the user: "ทำสายอัศวินเป็นแสงต่อเลย")
    { id: 'mage', name: 'จอมเวทไฟ (แสง)', note: 'ใหม่: แสงอนุภาค + bloom เฉพาะจอมเวทไฟ + ดาวฤกษ์ (js/magelight.js)', mods: () => fx('MageLight'), def: 'new' },   // (the user: "เปลี่ยนเเค่เมจไฟ ก็พอ อันอื่นใช้อันเดิม")
    { id: 'reaper', name: 'ยมทูต', note: 'ใหม่: เคียวแสงจันทร์บนเงามืด (js/reaperlight.js)', mods: () => fx('ReaperLight'), def: 'new' },   // (the user, 2026-10-20: "เปลี่ยนสกิล เคียว vfx เป็นเวอร์ชั่น แสง ... ต้องเท่จัด")
    { id: 'rogue', name: 'สายโจร', note: 'ใหม่: แสงบนเงาหมึก โจร นักฆ่า นินจา (js/roguelight.js)', mods: () => fx('RogueLight'), def: 'new' },   // (the user: "ทำ vfx โจรใหม่ด้วย สูตรเดียวกับเคียวเลย")
    { id: 'bow', name: 'สายธนู', note: 'ใหม่: แสงอนุภาค + bloom ทุกอาชีพสายธนู (js/archerlight.js)', mods: () => fx('ArcherLight'), def: 'new' },   // (the user: "ทำสายธนูเป็นแสงต่อ ทุกอาชีพในสาย")
  ].filter((S) => S.mods().length);
  const keyOf = (S) => S.key || 'nc_hit_' + S.id;
  const read = (S) => {
    let v = null;
    try { const s = localStorage.getItem(keyOf(S)); v = S.load ? S.load(s) : s; } catch (e) { /* storage blocked */ }
    return v === 'new' || v === 'old' ? v : S.def;
  };
  const write = (S, v) => { try { localStorage.setItem(keyOf(S), S.save ? S.save(v) : v); } catch (e) { /* storage blocked */ } };
  const apply = (S, v) => { for (const m of S.mods()) m.on = v === 'new'; };
  const cur = (S) => (S.mods().every((m) => m.on) ? 'new' : 'old');
  const set = (S, v) => { apply(S, v); write(S, v); };

  // at load: the kept choices
  for (const S of STYLES) apply(S, read(S));

  NC.HitStyle = {
    STYLES,
    get: (id) => { const S = STYLES.find((s) => s.id === id); return S ? cur(S) : null; },
    set: (id, v) => { const S = STYLES.find((s) => s.id === id); if (S) set(S, v); },
    setAll: (v) => { for (const S of STYLES) set(S, v); },
  };

  // the ESC menu's settings: all at once, then one row each (the "all" row lights neither pill when they are mixed)
  const rows = (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []);
  // (dev: the online player's menu hides them - js/menuwin.js PLAYER; online plays the defaults)
  rows.push({
    dev: true, group: 'look',
    name: 'สไตล์การตี', note: 'เลขดาเมจและเอฟเฟกต์สกิล: ทุกแถวข้างล่างพร้อมกัน', opts: [['new', 'ใหม่ทั้งหมด'], ['old', 'เก่าทั้งหมด']],
    get: () => { const c = STYLES.map(cur); return c.every((x) => x === 'new') ? 'new' : c.every((x) => x === 'old') ? 'old' : 'mix'; },
    set: (v) => NC.HitStyle.setAll(v),
  });
  for (const S of STYLES) rows.push({ dev: true, group: 'look', name: S.name, note: S.note, opts: [['new', 'แบบใหม่'], ['old', 'แบบเก่า']], get: () => cur(S), set: (v) => set(S, v) });
})();
