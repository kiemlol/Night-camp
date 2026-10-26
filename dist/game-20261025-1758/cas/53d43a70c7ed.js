/* wcatalog_area.js — every new monster species of the hunting sections (assets/gen/loot/areas_data.py, the farm pilot of
   js/monsters7.js; 104 species, 2026-10-14/15) has ONE weapon of its own, designed from the monster (the user's rule:
   every monster's drops differ, each item has exactly one source). The rows come from js/wcatalog_area_data.js
   (tools/wcatarea_build.py, designs in assets/gen/wcat_area/<type>.json, species -> weapon in species_weapons.json); each
   becomes an item exactly like a catalog weapon through js/wcatalog.js (NC.WCAT.make: the type's template moves, feel,
   grip, ATK by grade and kind, lvReq, it.wc for wskill / wfx / gearbag) with its sprite from assets/wcat_area/
   (assets/wcat_area.manifest.js: NC.ASSET_MANIFEST_WCATAREA) and `srcSpecies`, the one monster that drops it.
   They are NOT in NC.WCAT's lists (the catalog stays 40 per type): NC.WCATAREA = { types, list, byId, bySpecies }.
   No drops here: the loot tables (js/loot_data.js) list them. A row whose sprite isn't cut yet is skipped (NC.itemReady).
   Load right after js/wcatalog.js. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, DATA = NC.WCATAREA_DATA || {}, WC = NC.WCAT;
  if (!WC || !WC.make) return;
  if (NC.ASSET_MANIFEST_WCATAREA) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_WCATAREA);
  const MAN = NC.ASSET_MANIFEST_WCATAREA || {};
  const A = (NC.WCATAREA = { types: {}, list: [], byId: {}, bySpecies: {} });
  for (const t in DATA) {
    const T = ITEMS[DATA[t].tpl];
    if (!T) continue;
    A.types[t] = [];
    for (const row of DATA[t].items) {
      if (ITEMS[row[0]]) continue; // (never over an item that is already there)
      const it = WC.make(t, T, row, MAN[row[0]]);
      it.srcSpecies = row[8];
      ITEMS[it.id] = it;
      A.types[t].push(it.id); A.list.push(it.id); A.byId[it.id] = it; A.bySpecies[row[8]] = it.id;
    }
  }
  // the item order (js/items.js: the drop pool): after the catalog
  if (NC.ITEM_ORDER) for (const id of A.list) if (!NC.ITEM_ORDER.includes(id)) NC.ITEM_ORDER.push(id);
})();
