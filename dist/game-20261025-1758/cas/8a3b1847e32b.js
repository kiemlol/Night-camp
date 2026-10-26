/* bossrate.js — the bosses' own pieces drop rarely (the user, 2026-10-12: "ของบอสลดเรทดรอปลงเยอะๆหน่อย เป็นหลัก 0.5% หรือ
   1%"): every boss's drop rows (js/loot_data.js, the crowns setfx.js adds, the old boss outfits rebalance.js adds), on the
   fields, in the dungeons, the story bosses and the shades of รากต้นไม้มืด alike:
     a weapon        0.5% a kill (a boss carries ~30 weapon types: about one weapon in seven kills, the one wanted ~200)
     anything else   1% a kill (the boss hat, the crown, the story bosses' robes, capes and hats)
   The rows are rewritten once everything has added its own (load after every file that adds boss rows); js/loot.js reads
   them at each kill, the books and the wiki show the new numbers. NC.BOSS_RATE = { weapon, other, of(id) }. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, D = NC.LOOT_DATA;
  if (!D || !D.bosses) return;
  const R = (NC.BOSS_RATE = { weapon: 0.5, other: 1, of: (id) => (ITEMS[id] && ITEMS[id].slot === 'weapon' ? R.weapon : R.other) });
  for (const b in D.bosses) for (const row of D.bosses[b]) if (Array.isArray(row) && ITEMS[row[0]]) row[1] = R.of(row[0]);
})();
