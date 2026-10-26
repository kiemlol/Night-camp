/* magicgear.js — magic weapons keep up with the monster curve (js/monscale.js) the way the others do. Before, a spell's
   power came from INT alone (stats.js MATK): a better staff, or refining it, changed only the staff's own bolt, so a
   mage never had a reason to go back to the forge (tools/balance.js: a Lv 81–99 staff x0.84–0.99 against the first one,
   where a physical weapon of that band gives x1.2–1.6 and x1.4–2.2 refined).
     the weapon   MATK +20% for each time over the weapon's ATK is its type's first weapon's (NC.STARTER_WEAPONS): a
                  Lv 41–60 staff about +30%, a Lv 81–99 one about +41%; the first weapon itself +0
     refining     a magic weapon's refine also gives MATK +4% a level (+10: +40%), as it gives a physical one ATK
   A magic weapon: W.magic (staves, orbs, bells ...). Hook: NC.skillModSources (skilltree.js: matk % in NC.derive). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS;
  const avg = (it) => (it && it.dmg ? (it.dmg[0] + it.dmg[1]) / 2 : 0);
  function firstOf(W) {
    const t = NC.wtypeOf ? NC.wtypeOf(W) : null, id = t && NC.STARTER_WEAPONS && NC.STARTER_WEAPONS[t];
    return avg(ITEMS[id]);
  }
  NC.skillModSources.push((p) => {
    if (!p || p.kind !== 'player' || !p.equip) return null;
    const W = ITEMS[p.equip.weapon];
    if (!W || !W.magic) return null;
    const a = avg(W), a0 = firstOf(W) || a, c = NC.GEAR && NC.GEAR.wornIn ? NC.GEAR.wornIn(p, 'weapon') : null;
    const pct = 20 * Math.max(0, a / a0 - 1) + 4 * ((c && c.ref) || 0);
    return pct > 0 ? { matk: pct } : null;
  });
})();
