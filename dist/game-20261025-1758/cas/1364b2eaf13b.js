/* fleeease.js — monsters dodge a little less (2026-10-19, the user: "ลดค่าหลบหลีกของมอนเตอร์ลง นิดนึง ด้วย มัน หลบเยอะไปไหม").
   README "มอนหลบน้อยลง". A plain hit lands at 80 + the hero's HIT (Lv + DEX + gear) - the monster's FLEE (stats.js heroHit,
   5..100%), and a monster's FLEE was Lv + Lv x agiK (agiK 0..1.6, median 0.8): with the bots' melee build (DEX 16% of the
   points) a same-level monster of agiK 0.8 was missed 22% at Lv 10 -> 44% at Lv 60 -> 55% at Lv 90, an agile one (1.3)
   74-95% from Lv 60. Now the agility part counts 70%: FLEE = Lv + Lv x agiK x 0.7 (same-level agiK 0.8: 20% / 30% / 33%,
   agiK 1.3: 51-65%); bows and DEX builds miss little either way. Magic and critical hits never missed and still don't.
   Outermost NC.monsterStats (after balance_1018.js); the Go server takes the same FLEE per level from
   tools/online/world_delta.json (node tools/online/world_export.mjs, then tools/online/server.sh). */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC || !NC.monsterStats) return;
  const K = 0.7;
  NC.MON_FLEE_K = K;
  const base = NC.monsterStats;
  NC.monsterStats = function (type, lv) {
    const s = base.apply(this, arguments);
    const M = NC.MONSTERS && NC.MONSTERS[type];
    if (s && M && Number.isFinite(lv)) s.flee = Math.round(lv + lv * (M.agiK || 0) * K);
    return s;
  };
})();
