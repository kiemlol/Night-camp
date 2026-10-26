/* expease.js — a lighter level curve (the user, 2026-10-18: "ผมว่า exp ขึ้นยากไป เเก้หน่อย").
   Why it felt slow: js/rebalance.js, balance_1016.js and balance_1018.js fitted the curve to the AUTO FARM's speed
   (40–60 kills a minute early on), so a level asked for far more kills than the Game Bible's design: a hero playing by
   hand needed ~163 kills for Lv 1 → 2, ~135 at Lv 10, ~430 at Lv 20, ~900 at Lv 30 (same-level monsters, the median
   species' EXP), and the traveler's Job levels the same.
   This file:   kills a level (same-level monster) = 8 + 0.12 Lv^2.2 up to Lv 40 (Lv 1 ~8, Lv 10 ~27, Lv 20 ~95,
                Lv 30 ~220, Lv 40 ~410), then easing to x0.7 of the old need at Lv 70 and after (Lv 50 ~890, Lv 70 ~2,190,
                Lv 90 ~4,000). The auto farm: Lv 40 in ~3 h (was ~15), Lv 99 in ~176 h (was ~282)
                the Job EXP need gets the same factor by the hero's base level (the traveler's 10 Job levels in ~80 kills)
   K below = new need / old need by base level (measured 2026-10-18 against NC.monsterStats' median EXP; monster EXP
   itself is not touched: js/stats.js reads NC.xpBase). A save whose bar holds more than the new need levels up on its
   next kill (EXP it earned). Online: tools/online/world_export.mjs sends NC.xpNext (baseXp) and NC.expCurveK (the Job
   curve). */
(function () {
  'use strict';
  const NC = window.NC;
  const along = (pts, lv) => {
    if (lv <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [l1, k1] = pts[i], [l0, k0] = pts[i - 1];
      if (lv <= l1) return k0 + ((k1 - k0) * (lv - l0)) / (l1 - l0);
    }
    return pts[pts.length - 1][1];
  };
  // [base level, x the need], straight lines between, the last one's after
  const K = (NC.EXP_EASE = [[1, 0.05], [2, 0.054], [3, 0.065], [4, 0.078], [5, 0.097], [6, 0.118], [7, 0.135], [8, 0.163], [9, 0.186],
    [10, 0.211], [12, 0.228], [14, 0.231], [16, 0.23], [18, 0.236], [20, 0.231], [22, 0.239], [24, 0.239], [26, 0.247], [28, 0.249],
    [30, 0.258], [32, 0.248], [34, 0.243], [36, 0.237], [38, 0.233], [40, 0.233], [45, 0.311], [50, 0.389], [55, 0.467], [60, 0.544],
    [65, 0.622], [70, 0.7]]);
  const ek = (lv) => Math.min(1, along(K, lv || 1));
  // the whole factor on a Job EXP need by base level (balance_1018.js's xpK x this): world_export.mjs -> levelTables.jobCurve
  NC.expCurveK = (lv) => (NC.BAL1018 ? Math.min(1, NC.BAL1018.along(NC.BAL1018.xpK, lv)) : 1) * ek(lv);

  const baseNext = NC.xpNext, baseJob = NC.jobNext, memo = [];
  if (baseNext) {
    // (never less than the level before)
    const next = (lv) => {
      lv = Math.max(1, lv | 0);
      if (memo[lv] === undefined) memo[lv] = Math.max(1, Math.round(baseNext(lv) * ek(lv)), lv > 1 ? next(lv - 1) : 0);
      return memo[lv];
    };
    NC.xpNext = next;
  }
  if (baseJob) NC.jobNext = function () { const p = NC.game && NC.game.player; return Math.max(1, Math.round(baseJob.apply(this, arguments) * ek((p && p.lv) || 1))); };
})();
