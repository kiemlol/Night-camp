/* monscale.js — how tough monsters are by level: easy at first, hard later, so the gear has to keep up (the user,
   2026-09-30: "เลือดมอนตอนนี้มันน้อยไป มันไม่ควรจะ one hit ง่าย ๆ ... อยากให้ปาร์ตี้เป็นสิ่งสำคัญ แต่ยัง solo ได้", then
   "เกมเราต้องออกแบบให้คนติด แรก ๆ ง่าย หลัง ๆ ยาก เพื่อให้ติดก่อน จนต้องกลับมาทำของเพื่อไปฟามต่อได้").
     before     with the class's first weapon a same-level monster died in ~0.65 s to a damage build (six in a clump in
                0.6–1.3 s) at every level; the bot killed 35–60 a minute and hardly drank a potion
     the curve  every monster's HP x the factor of its level: x1 up to Lv 15 (the hook: one or two hits), x1.6 at Lv 30,
                x3 at 55, x4 at 75, x5 at 90, x5.5 at 99, straight lines between. ATK as before. (x7 at 90 was tried: a
                bot of a single-target build crawled on 18–32 potions a minute and a buffing bishop killed nothing)
     the gear   the factor follows what the gear of each level adds (tools/balance.js with a weapon of the level's band:
                x1.2–1.6, refined +6..+8: x1.4–2.2; magic weapons through js/magicgear.js). With it a monster of the
                hero's level takes ~0.9 s at Lv 30, ~1.2 s at 55, ~1.7 s at 90; with the first weapon still, about twice
                as long while the hits pile up: time to go back to the forge
     bosses     the same curve, over their own HP factors
     as before  EXP and drops per kill, ATK, chests, training dummies
   Everything else stacks on top: night monsters (daynight.js), zone forms (monsters6.js), the tower's floors and the
   world boss (season.js), the guild boss (social.js), split pieces and helpers (monkinds.js).
   x2.5 for all (the user, 2026-10-18: "เพิ่มเลือดมอน X2.5 ทุกตัว"): every monster's HP x2.5 on top of the curve, bosses
                too (field, dungeon, story, Baphomet, guild boss, the tower: their HP all start here); training
                dummies, chests and the PvP / guild-war player stand-ins are not monsters and stay. Online the server
                decides monster HP (js/online/world.js copies it), so this is the offline game only.
   Hook: NC.monsterStats (stats.js; entities.js NC.makeEnemy is its only caller). The numbers: NC.MON_SCALE. */
(function () {
  'use strict';
  const NC = window.NC;
  // [monster level, HP factor] points: the first one's factor before it, straight lines between, the last one's after;
  // all: the factor over every monster (x2.5, 2026-10-18)
  const T = (NC.MON_SCALE = { hp: [[15, 1], [30, 1.6], [55, 3], [75, 4], [90, 5], [99, 5.5]], all: 2.5 });
  const along = (pts, lv) => {
    if (lv <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [l1, k1] = pts[i], [l0, k0] = pts[i - 1];
      if (lv <= l1) return k0 + ((k1 - k0) * (lv - l0)) / (l1 - l0);
    }
    return pts[pts.length - 1][1];
  };
  // the HP factor a monster of this kind and level gets (the monster book and tests can ask)
  NC.monScale = (type, lv) => (/^chest_/.test(type || '') ? 1 : along(T.hp, lv || 1) * T.all);

  const base = NC.monsterStats;
  NC.monsterStats = function (type, lv) {
    const s = base.apply(this, arguments);
    if (s) s.maxHp = Math.max(1, Math.round(s.maxHp * NC.monScale(type, lv)));
    return s;
  };
})();
