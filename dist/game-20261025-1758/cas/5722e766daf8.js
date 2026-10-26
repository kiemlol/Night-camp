/* wcatalog.js — the weapon catalog: 40 weapons of each of the other 28 weapon types (the user, 2026-09-29: "ทำต่อเลย
   ทุกอาวุธ 40 หมด"; like the greatswords and the one-handed swords, only pictures and holding them for now). The rows
   come from js/wcatalog_data.js (tools/wcat_build.py, from the designs in assets/gen/wcat/<type>.json): each becomes
   an item that moves and feels like its type's template (NC.STARTER_WEAPONS: the same style, speed, reach, grip,
   stance, hands, magic, range, stats, signature moves, so the Pose Studio's hold of that type applies), with its own
   sprite (assets/wcat/, assets/wcat.manifest.js: NC.ASSET_MANIFEST_WCAT; a bow's string points come from there),
   name, grade, element, level and ATK. A row whose sprite isn't cut yet is skipped by the game (NC.itemReady).
   Plain collection items for now (they drop like any item; ?allitems gives them all).
   The world legends' elements (the owner, 2026-10-07, the endgame balance audit): 26 of the 30 were holy, and holy does
   0% to holy monsters (73% of grave1, 58% of grave2, 96% of the cathedral), so 21 of them took the element their name
   and picture already carry (forest/stag → earth, campfire/comet → fire, moonstone/star-stream → water, aurora/swan →
   wind, night/galaxy → shadow, spirit → ghost) in assets/gen/wcat/<type>.json + assets/gen/loot/drops_plan.json, then
   tools/wcat_build.py and assets/gen/loot/wabil_gen.py (their second ability follows the element). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, DATA = NC.WCAT_DATA || {};
  if (NC.ASSET_MANIFEST_WCAT) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_WCAT);
  const MAN = NC.ASSET_MANIFEST_WCAT || {};
  // types drawn bigger than the game's first weapon of the type (tools/gs_art.py WC_SIZE): that first one grows as much
  const BIGGER = { dagger: 1.35 };
  for (const t in BIGGER) {
    const T0 = ITEMS[(NC.STARTER_WEAPONS || {})[t]], m0 = T0 && NC.ASSET_MANIFEST[T0.sprite];
    if (m0 && !m0.big) { m0.w = Math.round(m0.w * BIGGER[t] * 10) / 10; m0.h = Math.round(m0.h * BIGGER[t] * 10) / 10; m0.big = true; }
  }
  const RARITY = { A: 'common', B: 'rare', C: 'epic', D: 'legend', L: 'legend' };
  const TRAIL = { neutral: '220,230,245', water: '150,210,255', wind: '170,240,200', earth: '225,185,125', fire: '255,150,80', poison: '190,140,255',
    holy: '255,232,160', shadow: '175,140,235', ghost: '200,255,240' };
  const OWN = new Set(['id', 'name', 'sprite', 'icon', 'rarity', 'dmg', 'element', 'desc', 'lvReq', 'art']);
  const WC = (NC.WCAT = { types: {}, list: [], byId: {} });
  // one row -> one item that moves and feels like its type's template T (m: the sprite's manifest entry). Also used by
  // js/wcatalog_area.js for the hunting-section monsters' own weapons (2026-10-15).
  WC.make = function (t, T, [id, name, grade, kind, el, lv, atk, desc], m) {
    const it = {};
    for (const k in T) if (!OWN.has(k)) it[k] = T[k];
    Object.assign(it, {
      id, name, sprite: id, wtype: t, rarity: RARITY[kind] || 'common', dmg: [Math.round(atk * 0.88), Math.round(atk * 1.12)],
      element: el === 'neutral' ? undefined : el, lvReq: lv, desc, wc: { type: t, grade, kind, atk, lv },
    });
    if (T.trailRgb || T.style === 'swing' || T.style === 'smash' || T.style === 'thrust') it.trailRgb = TRAIL[el] || TRAIL.neutral;
    if (m && m.grip) it.grip = m.grip; // (sword-like types: measured on the picture)
    if (m && m.bow) { it.bow = m.bow; it.bowNoStow = true; } // (a bow: where its string is tied; slung on the back, no string)
    return it;
  };
  for (const t in DATA) {
    const T = ITEMS[DATA[t].tpl];
    if (!T) continue;
    WC.types[t] = [];
    for (const row of DATA[t].items) {
      const it = WC.make(t, T, row, MAN[row[0]]), id = it.id;
      ITEMS[id] = it;
      WC.types[t].push(id); WC.list.push(id); WC.byId[id] = it;
    }
  }
  // the item order (js/items.js: the drop pool): after the swords, type by type
  if (NC.ITEM_ORDER) for (const id of WC.list) if (!NC.ITEM_ORDER.includes(id)) NC.ITEM_ORDER.push(id);
})();
