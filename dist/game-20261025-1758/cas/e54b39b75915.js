/* Shared collection-item economy. Weapon copies/option rows remain a separate system. */
(function () {
  'use strict';
  const N = window.NC;
  const prices = { common: 120, rare: 480, epic: 1500, legend: 6000, fashion: 2400 };
  const recipes = {}, sell = {};
  for (const [id, item] of Object.entries(N.ITEMS)) {
    const gs = item.gs, source = gs && gs.src;
    if (source && (source.craft || source.shop)) recipes[id] = { coins: source.shop || source.coins || 0, mats: source.craft || {} };
    if (item.slot !== 'hair') sell[id] = gs
      ? N.GS.GRADES[gs.grade].sell * (['D', 'L'].includes(gs.kind) ? 3 : 1)
      : prices[item.rarity] || 300;
  }
  const protectedItems = new Set(Object.values(N.STARTER_WEAPONS || {}));
  for (const cls of N.CLASSES || []) for (const id of Object.values(cls.items || {})) if (id) protectedItems.add(id);
  // the merchant Uncle Coco stands at shop.js's SELLER: the big camp's market (camp.js NC.CAMP_SPOT, 2026-10-04)
  const seller = (N.CAMP_SPOT && N.CAMP_SPOT.seller) || { x: 1254, y: 1652 };
  N.ECONOMY = { recipes, sell, protected: [...protectedItems], merchant: { x: seller.x, y: seller.y, reach: 240 },
    vending: { limit: 12, titleMax: 30, priceMax: 9999999, reach: 520, stockMax: 9999 } };
})();
