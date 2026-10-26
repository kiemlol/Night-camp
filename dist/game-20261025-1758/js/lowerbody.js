/* lowerbody.js — trousers and boots as ONE piece (the user, 2026-10-06: "รวมรองเท้ากับกางเกงเป็นชิ้นเดียวกัน ... เจนส่วนล่าง
   มาใหม่หมดเลย ผมต้องการให้เฟรม rig เนียน"): a trouser item whose redrawn legs are cut (tools/lower_cut.py ->
   assets/lower/legs_<rig>_legF/B[_idle], NC.ASSET_MANIFEST_LOWER) is drawn with them, boots included, and no shoe goes
   on it. While the player's own hero stands still (js/idlefeet.js) the standing legs are used: the front foot toward
   the viewer, the back foot turned half toward us; walking, running, attacking: the side-on legs.
   Hook: avatar.js solve() asks NC.lowerLeg(pants, 'legF' | 'legB') before the trouser picture. */
(function () {
  'use strict';
  const NC = window.NC;
  if (NC.ASSET_MANIFEST_LOWER) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_LOWER);
  const ok = (n) => { const s = NC.SPR[n]; return s && s.joints ? s : null; };
  NC.lowerLeg = (pants, which) => {
    if (!pants || !pants.rig) return null;
    const base = 'legs_' + pants.rig + '_' + which;
    // (not redrawn yet: the outfit's own whole leg, the piece its trousers and shoes were once cut from)
    return ((NC.heroStanding && NC.heroStanding()) && ok(base + '_idle')) || ok(base) || ok('rig_' + pants.rig + '_' + which);
  };
  NC.hasLower = (pants) => !!(pants && pants.rig && ok('legs_' + pants.rig + '_legF') && ok('legs_' + pants.rig + '_legB'));
})();
