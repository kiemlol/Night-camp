/* rigparts.js — a rig's parts picked by hand in the Pose Studio (studio/, the "ชิ้นส่วนชุด" pickers under the outfit):
   e.g. the night falcon's legs with the foot turned another way (rig_<rig>_<part>_v<n>, made by tools/falcon_cut.py legs c;
   the user, 2026-10-06: "ลองเจนขามาหลายๆ แบบก็ได้ เดี๋ยวผมลองประกอบขาเอง ใน studio").
   js/rigparts_data.js (NC.RIGPARTS = { rigs: { <rig>: { <part>: <sprite> } } }, written by tools/studio_serve.mjs
   POST /api/rigparts) says which picture each part uses; NC.getRig hands the rig out with those pictures.
   Load after js/avatar.js. */
(function () {
  'use strict';
  const NC = window.NC;
  const picks = () => (NC.RIGPARTS && NC.RIGPARTS.rigs) || {};
  const seen = new WeakSet();
  // <part>_idle: the picture while the player's own hero stands still (js/idlefeet.js NC.heroStanding), e.g. the night
  // falcon's front leg v3 standing, v2 walking (the user, 2026-10-07: "ขาหน้าชุดนี้ต้องเป็นอันที่ 2" -> "ตอน idle ให้ใช้ 3")
  function apply(r) {
    const want = picks()[r.name] || {}, idle = !!(NC.heroStanding && NC.heroStanding());
    for (const part in r.P0) {
      const pick = (idle && want[part + '_idle']) || want[part];
      const s = pick && NC.SPR[pick];
      r.P[part] = s && s.joints ? s : r.P0[part];
    }
  }
  const hasIdle = (r) => Object.keys(picks()[r.name] || {}).some((k) => /_idle$/.test(k));
  const baseGetRig = NC.getRig;
  NC.getRig = function (name) {
    const r = baseGetRig.apply(this, arguments);
    if (r && !seen.has(r)) { seen.add(r); r.P0 = Object.assign({}, r.P); apply(r); }
    else if (r && hasIdle(r)) apply(r);                     // (standing / moving changes from one draw to the next)
    return r;
  };
  NC.RigParts = {
    // the pictures a part can take: its own and rig_<rig>_<part>_v<n>
    variants(rig, part) {
      const re = new RegExp('^rig_' + rig + '_' + part + '_v\\d+$');
      return Object.keys(NC.SPR || {}).filter((k) => re.test(k) && NC.SPR[k].joints)
        .sort((a, b) => Number(a.split('_v').pop()) - Number(b.split('_v').pop()));
    },
    get: (rig, part) => (picks()[rig] || {})[part] || null,
    set(rig, part, spr) {
      const d = (NC.RIGPARTS = NC.RIGPARTS || { rigs: {} });
      d.rigs = d.rigs || {};
      const o = (d.rigs[rig] = d.rigs[rig] || {});
      if (spr) o[part] = spr; else delete o[part];
      if (!Object.keys(o).length) delete d.rigs[rig];
      const r = NC.getRig(rig);
      if (r && r.P0) apply(r);
    },
  };
})();
