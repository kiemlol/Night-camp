/* acc.js — เครื่องประดับ: two accessory slots (equip.acc1, equip.acc2), like classic MMOs' left and right accessory. An
   accessory (item slot 'acc': rings, charms, pendants...) is not drawn on the hero: only its icon (it.sprite) and its
   stats. Any accessory fits either slot; clicking a worn one takes it off. The outfit catalog gives every set one
   (js/outfits.js: the set's 4th piece).
   Kept outside NC.SLOTS (their items' slot is 'acc', not the equip key): this file adds their stats (gearStats),
   puts them on (NC.equip) and restores them from the save (the save stores p.equip whole); the bag (js/inventory.js)
   shows the two slots. Loaded after weapons.js, before js/outfits.js. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, FX = NC.FX;
  const KEYS = (NC.ACC_KEYS = ['acc1', 'acc2']);
  NC.SLOT_NAME.acc = 'เครื่องประดับ';
  const isAcc = (id) => !!(id && ITEMS[id] && ITEMS[id].slot === 'acc');
  NC.accWorn = (p, id) => !!(p && p.equip && id && (p.equip.acc1 === id || p.equip.acc2 === id));

  // ---------------- stats ----------------
  const baseGear = NC.gearStats;
  NC.gearStats = function (equip) {
    const st = baseGear.apply(this, arguments);
    for (const k of KEYS) {
      const it = equip && isAcc(equip[k]) && ITEMS[equip[k]];
      if (it && it.stats) for (const s in it.stats) st[s] = (st[s] || 0) + it.stats[s];
    }
    return st;
  };

  // ---------------- putting one on: the slot picked in the bag, else the first free one, else the first ----------------
  const baseEquip = NC.equip;
  NC.equip = function (game, id) {
    const p = game.player, it = ITEMS[id];
    if (!it || it.slot !== 'acc') return baseEquip.apply(this, arguments);
    if (!p.owned.has(id) || !NC.itemReady(id)) return;
    const at = KEYS.find((k) => p.equip[k] === id);
    if (at) p.equip[at] = null;
    else {
      const pick = NC.EquipUI && KEYS.includes(NC.EquipUI.accPick) ? NC.EquipUI.accPick : null;
      p.equip[pick || KEYS.find((k) => !p.equip[k]) || KEYS[0]] = id;
    }
    p.fresh.delete(id);
    NC.applyGear(game);
    FX.stars(p.x, p.y - 70, 10, NC.RARITY[it.rarity].rgb, { speed: 200, size: 0.8 });
    NC.saveGame(game);
  };

  // ---------------- loading: back from the save ----------------
  const baseLoad = NC.loadGear;
  NC.loadGear = function (game, params) {
    baseLoad.apply(this, arguments);
    const p = game.player;
    let s = null;
    if (!NC.ONLINE) { try { s = JSON.parse(localStorage.getItem('nightcamp.save.v1') || 'null'); } catch (e) { s = null; } }
    const e = (s && s.equip) || {};
    for (const k of KEYS) p.equip[k] = isAcc(e[k]) && p.owned.has(e[k]) && NC.itemReady(e[k]) ? e[k] : p.equip[k] && isAcc(p.equip[k]) ? p.equip[k] : null;
    if (p.equip.acc1 && p.equip.acc1 === p.equip.acc2) p.equip.acc2 = null;
    NC.applyGear(game);
    p.hp = p.maxHp; p.sp = p.maxSp;
  };
})();
