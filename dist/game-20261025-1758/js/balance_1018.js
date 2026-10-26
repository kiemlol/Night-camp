/* balance_1018.js — the biggest balance round (the user, 2026-10-18: "ทำบาลานซ์ครั้งใหญ่สุดเท่าที่เคยมีมา โดยเกมต้องไม่ง่าย
   และไม่ยากจนเกินไป ... แรกๆ เน้นง่ายหน่อย แต่กลางๆ หลังๆ จะยาก ทำให้ผู้เล่นต้องกลับมาทำของก่อนออกไปสู้ หรือหาทรัพยากร หรือ
   พึ่งการเล่นเป็นปาร์ตี้"; picked: numbers only, no new rules, Lv 99 in 260–350 bot hours as before).
   Measured first (109 auto-farm runs + 262 clean damage fights, every level band x 5 jobs x starting / band / band +7
   gear, with the monsters' HP x2.5, the newbie power, the level-gap EXP and the endgame audit on):
     Lv 1–18   every monster died in one hit (0.2–0.4 s of a same-level fight), 60–90 kills a minute
     Lv 22–30  under 1 s a kill, but a cliff in damage taken at Lv 25 (the newbie power ends, the maps turn
               aggressive, the monsters get skills: 10–17 potions a minute, the HP bar at 5%)
     Lv 40–75  1.4–3.1 s with band gear; the starting gear ~1.6x slower, +7 ~1.25x faster
     Lv 90–99  6–11 s with band gear; Lv 99 in ~1,100 bot hours
   This file:
     HP    x the factor of the monster's level (HP below): 2 hits instead of 1 on Lv 1–16, easing to x1 at Lv 32; the
           middle and late game as they were (5–35 s a monster on the auto farm, 10–16 potions a minute)
     ATK   x the factor of its level (ATK below): the Lv 22–40 maps hit softer, so the step from the passive first
           maps to the aggressive ones is a slope instead of a cliff
     EXP   the level curve back to the user's 260–350 h (xpK below, from the re-measured speed)
   Hooks: NC.monsterStats (after js/monscale.js and js/endgame_audit.js), NC.xpNext / NC.jobNext (after balance_1016.js).
   The numbers go to the Go server with tools/online/world_export.mjs (the monsters' levels, levelTables). */
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
  const B = (NC.BAL1018 = {
    // [monster level, factor], straight lines between, the last one's after
    // (a first try raised the middle too, x1.3–2.1 at Lv 24–78: the auto farm's fights went to 15–30 s a monster with
    // deaths on band gear; Lv 25–99 were already hard with x2.5, only the start was too easy)
    HP: [[1, 2.8], [12, 3], [16, 2.6], [20, 1.9], [24, 1.35], [28, 1.1], [32, 1]],
    ATK: [[18, 1], [22, 0.85], [26, 0.8], [32, 0.85], [40, 1]],
    // x the EXP need of a level (base and job, by base level): the auto farm's measured hours a level (band gear,
    // damage builds, one typical map each, 2026-10-18 after HP / ATK above; a smooth fit through 128 runs) brought to
    // the design shape of js/progression.js (kills a level 12 + 0.05 Lv^2.4), 350 h from Lv 1 to 99 on such a map
    // (the best maps ~260 h, the user's 10-16 target); never above 1 (the first levels as they were)
    xpK: [[1, 1], [5, 0.755], [10, 0.546], [15, 0.52], [20, 0.525], [25, 0.531], [30, 0.532], [35, 0.528], [40, 0.52], [45, 0.509],
      [50, 0.497], [55, 0.482], [60, 0.468], [65, 0.452], [70, 0.437], [75, 0.422], [80, 0.407], [85, 0.393], [90, 0.379], [95, 0.365], [99, 0.355]],
    // the auto farm's kills a minute by level on such a map (the same fit): the Go server's offline farm (world.json
    // levelTables.killsPerMinute, tools/online/world_export.mjs)
    KPM: [[1, 55.3], [5, 58.8], [10, 48.5], [15, 40.8], [20, 35.2], [25, 30.8], [30, 27.4], [35, 24.6], [40, 22.3], [45, 20.4], [50, 18.8],
      [55, 17.3], [60, 16.1], [65, 15], [70, 14.1], [75, 13.2], [80, 12.4], [85, 11.7], [90, 11.1], [95, 10.5], [99, 10.1]],
    along,
  });
  B.hpK = (type, lv) => (/^chest_/.test(type || '') ? 1 : along(B.HP, lv || 1));
  B.atkK = (type, lv) => (/^chest_/.test(type || '') ? 1 : along(B.ATK, lv || 1));

  const baseStats = NC.monsterStats;
  NC.monsterStats = function (type, lv) {
    const s = baseStats.apply(this, arguments);
    if (!s) return s;
    const h = B.hpK(type, lv), a = B.atkK(type, lv);
    if (h !== 1) s.maxHp = Math.max(1, Math.round(s.maxHp * h));
    if (a !== 1 && Array.isArray(s.atk)) s.atk = s.atk.map((v) => Math.max(1, Math.round(v * a)));
    return s;
  };

  // ---------------- the level curve ----------------
  const xk = (lv) => Math.min(1, along(B.xpK, lv || 1));
  const baseNext = NC.xpNext, baseJob = NC.jobNext, memo = [];
  if (baseNext) {
    // (never less than the level before, as balance_1016.js)
    const next = (lv) => {
      lv = Math.max(1, lv | 0);
      if (memo[lv] === undefined) memo[lv] = Math.max(1, Math.round(baseNext(lv) * xk(lv)), lv > 1 ? next(lv - 1) : 0);
      return memo[lv];
    };
    NC.xpNext = next;
  }
  if (baseJob) NC.jobNext = function () { const p = NC.game && NC.game.player; return Math.max(1, Math.round(baseJob.apply(this, arguments) * xk((p && p.lv) || 1))); };
})();
