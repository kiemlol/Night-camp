/* lowermerge.js — no more shoes slot: the trousers are worn with their own boots, one item (the user, 2026-10-06:
   "รวมรองเท้ากับกางเกงเป็นชิ้นเดียวกันเลย เดี๋ยวค่อยปรับสเตตัสกับบาลานซ์ทีหลัง"; the legs are drawn in one piece too,
   js/lowerbody.js). Loaded after every file that makes items (class2/3, jobs3, samurai, priest, outfits) and after the
   balance passes (rebalance.js, balance_round.js), so each shoe's final numbers are what go in:
   - shoes_<rig>: its stats added onto pants_<rig> (a set worn whole adds up to the same as before), its name kept on
     the trousers (pants.shoes, shown in the text); then the shoe item is gone from NC.ITEMS / NC.ITEM_ORDER;
   - 'shoes' out of NC.SLOTS / NC.SLOT_NAME and out of every class set and outfit set (NC.classOf, the set bonus);
   - the outfit sets' text counts 2 pieces (top + trousers) and 3 with the accessory.
   Old saves: an equipped or owned shoe just isn't loaded any more (items.js keeps known slots and items only). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS;
  const add = (a, b) => {
    const r = Object.assign({}, a);
    for (const k in b || {}) r[k] = Math.round(((r[k] || 0) + b[k]) * 1000) / 1000;
    return r;
  };
  const gone = new Set();
  NC.SHOES_OF = {}; // pants id -> the shoe id that is part of it now
  for (const id of Object.keys(ITEMS)) {
    const s = ITEMS[id];
    if (!s || s.slot !== 'shoes') continue;
    const pid = 'pants_' + s.rig, p = ITEMS[pid];
    if (p) {
      p.stats = add(p.stats, s.stats);
      p.shoes = s.name;
      NC.SHOES_OF[pid] = id;
    }
    delete ITEMS[id];
    gone.add(id);
  }
  if (NC.ITEM_ORDER) for (let i = NC.ITEM_ORDER.length - 1; i >= 0; i--) if (gone.has(NC.ITEM_ORDER[i])) NC.ITEM_ORDER.splice(i, 1);
  const si = NC.SLOTS.indexOf('shoes');
  if (si >= 0) NC.SLOTS.splice(si, 1);
  delete NC.SLOT_NAME.shoes;
  NC.SLOT_NAME.pants = 'กางเกง+รองเท้า';
  const strip = (list) => { for (const c of list || []) if (c && c.items) delete c.items.shoes; };
  strip(NC.CLASSES);
  strip(NC.CLASS3 && NC.CLASS3.sets);
  if (NC.OUTFITS) {
    strip(Object.values(NC.OUTFITS.sets));
    NC.OUTFITS.list = NC.OUTFITS.list.filter((id) => !gone.has(id));
  }
  for (const id in ITEMS) {
    const it = ITEMS[id];
    if (it.desc) it.desc = it.desc.replace('ครบ 3 ชิ้น (เสื้อ กางเกง รองเท้า)', 'ครบ 2 ชิ้น (เสื้อ กางเกง+รองเท้า)').replace('ครบ 4 ชิ้น', 'ครบ 3 ชิ้น');
    if (it.slot === 'pants' && it.shoes && it.desc && !it.desc.includes(it.shoes)) it.desc = 'พร้อม' + it.shoes + ' · ' + it.desc;
  }
})();
