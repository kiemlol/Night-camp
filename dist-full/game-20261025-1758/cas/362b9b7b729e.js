/* novice.js — the traveler's (the first, pre-job class) skills reworked (the user, 2026-10-12: "ตัวแรก ไม่ควรมีสกิลหมู่
   ปรับสกิลใหม่ เป็นตีธรรมดา กับ ตีเดี่ยวแรง แล้วก็พุ่ง"): no area skills before the job change.
     basic attack  the plain hit, as before
     Q  ฟาดเต็มแรง   (id q: old hotbars and its learned level carry over) a heavy blow on ONE monster in front
     E  พุ่งใบไม้     (the dash, unchanged) now strikes only the FIRST monster it runs into
   R (the ice burst all round) and F (the falling stars) are no longer the traveler's: the points put in them come back by
   themselves (skill points are counted over the job's own skills, skilltree.js). Q has no drawn effect of its own: the
   weapon's heavy swing, and the hit feel (js/hitfeel.js: painted sparks and embers, light, shake) of a big hit.
   Load after skills.js and BEFORE rotiming.js, which turns these numbers into its skill timing (q: attack class, e: dash). */
(function () {
  'use strict';
  const NC = window.NC, SK = NC.SKILLS, RUN = NC.SKILL_RUN, H = NC.skillHelpers, V = NC.VFX;
  if (!SK || !RUN || !H || !V || !NC.JOBS || !NC.JOBS.traveler) return;

  NC.JOBS.traveler.skills = ['q', 'e', 'mastery', 'body', 'mind'];
  NC.JOBS.traveler.desc = 'ผู้เริ่มต้นเดินทาง ตีทีละตัว ฟาดหนัก และพุ่งชน · Job Lv 10 เปลี่ยนอาชีพได้';

  Object.assign(SK.q, {
    name: 'ฟาดเต็มแรง', type: 'phys', element: null, cd: 5, sp: (lv) => 8 + lv, mul: (lv) => 2.2 + lv * 0.3,
    desc: (lv, m) => `ฟาดอาวุธเต็มแรงใส่มอนตัวเดียวข้างหน้า ${m}% ของ ATK ผลักกระเด็น`,
  });
  // the weapon's own heaviest blow (its combo's last swing)
  const HEAVY = { swing: 'swing3', thrust: 'thrust3', smash: 'smash3', bolt: 'bolt3', arrow: 'bow3' };
  const REACH = 175;
  RUN.q = function (game, p) {
    const target = () => H.nearest(game, p.x, p.y, REACH, 1, p.aim, 1.0)[0] || H.nearest(game, p.x, p.y, REACH * 0.8, 1)[0];
    let e = target();
    if (e) p.aim = NC.angle(p.x, p.y, e.x, e.y);
    const W = NC.ITEMS[p.equip.weapon] || {};
    H.pose(game, p, HEAVY[W.style] || 'swing3', 0.5);
    V.at(0.24, () => {
      if (!e || e.dead || e.hp <= 0 || NC.dist(p.x, p.y, e.x, e.y) > REACH * 1.4) e = target();
      if (!e) return;
      const a = NC.angle(p.x, p.y, e.x, e.y);
      H.strike(game, p, 'q', e, Math.cos(a) * 420, Math.sin(a) * 300, { big: true });
      V.shake(game, 6);
    });
  };

  // the dash: one monster, the first one in the way
  const dash0 = RUN.e;
  RUN.e = function (game, p) {
    dash0.apply(this, arguments);
    const d = p.dash;
    if (!d || !d.hitFn) return;
    const hit0 = d.hitFn;
    let done = false;
    d.hitFn = function () { if (done) return; done = true; return hit0.apply(this, arguments); };
  };
  SK.e.desc = (lv, m) => `พุ่งเป็นสายลมใบไม้ อมตะชั่วครู่ ชนมอนตัวแรกที่ขวาง ${m}% ของ ATK`;
})();
