/* lvreq.js — an item's minimum level (it.lvReq: the new weapons and outfits of the item plan; classic-MMO-style, the only
   limit). An item above the hero's Base Lv can't be put on (the bag, js/inventory.js, says so and greys it); a weapon of
   that kind stays out of the job's weapon choice (NC.canWield). Class sets (NC.equipClass) put their own pieces on as
   before. Loaded after weapons.js (it wraps NC.equip / NC.canWield over theirs) and the item files. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS;
  const tooLow = (p, it) => !!(it && it.lvReq && p && p.lv < it.lvReq);
  NC.itemLvOk = (p, id) => !tooLow(p, ITEMS[id]);

  const baseCan = NC.canWield;
  NC.canWield = function (p, id) {
    if (tooLow(p, ITEMS[id])) return false;
    return baseCan ? baseCan(p, id) : true;
  };
  const baseEquip = NC.equip;
  NC.equip = function (game, id) {
    const p = game.player, it = ITEMS[id];
    if (tooLow(p, it) && p.owned.has(id)) {
      const msg = `${it.name} ต้อง Base Lv ${it.lvReq} ขึ้นไป`;
      if (game.toast) game.toast(msg);
      NC.HUD.log(msg, 'warn');
      return;
    }
    return baseEquip.apply(this, arguments);
  };
})();
