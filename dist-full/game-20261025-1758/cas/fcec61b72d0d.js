/* balance_round.js — the numbers of the balance round of 2026-10-04 (the user: "เช็คบาลานรอบใหญ่เลย คำนวนอย่างละเอียด ...
   ให้ไอเทมขยะเป็นของมีค่า และคนเล่นไม่โตไวเกินไป"; the calculation: 90 auto-farm runs of 18 builds over 10 level bands,
   78 builds x 1252 weapons on the dummy, tools/farmsim.js + tools/balance.js; the report is the Artifact "Night Camp
   balance round"). Its own systems live in their own files: js/potions.js (three sizes), js/brew.js (ต้มยา),
   js/partysupport.js (a priest's help for real players, the support EXP), the forge's แต้มช่าง (js/forge.js).
     junk by level  a species seen above the level its junk is priced for drops more pieces there: x (level / its junk's
                    level)^1.37 (the curve of what a kill's junk sells for, fitted over 196 species), at most x1.5, the
                    fraction as a chance of one more. The old early species that also live in late maps (bats, ghosts,
                    wolves, golems...) paid 40–60% of their map's level there; every map now pays 85%+ of its level's curve.
                    The cap was x2.5 until the endgame balance audit (the owner, 2026-10-07): low species placed high
                    (bats, wolves, fire imps at Lv 80–95) paid up to 2.5x the junk, which made the Lv 70–90 maps out-earn
                    the Lv 99 ones; x1.5 keeps most of the lift. Every drop's pieces are also x the hero's level gap
                    (js/endgame_audit.js wraps NC.matQty with NC.dropGap, the same multiplier as EXP: js/levelgap.js)
     the mage      the 1st-job mage farmed at a third to a half of the other 1st jobs' kills a minute (the auto farm, band
                   gear, Lv 10–49) and fainted 2–6 times in 150 s: its damage x1.8 (rebalance.js JOB_POWER, was x1.35) and
                   HP per level 4.5 (was 3.5; the knight's is 7, the priest's 4.5). The 2nd-job casters farmed level with
                   the others (fire mage 0.8–1.06 of the median) and stay as they are
   Load after rebalance.js. Hooks: NC.matQty (materials.js asks how many pieces a drop gives), NC.JOB_POWER, NC.JOBS. */
(function () {
  'use strict';
  const NC = window.NC;

  // ---------------- junk by level ----------------
  // the level each species' junk is priced for (where its kill's junk meets the curve 0.355 x lv^1.374), for the species
  // that also live higher up (the census of 2026-10-02: 62 of 196)
  const NATIVE = (NC.MAT_NATIVE = { ant_obsidian: 34, ash_wisp: 36, bat: 10, bee: 17, boar_silver: 15, bomb_ant: 22, bone_knight: 34, bone_pile: 34, bone_shaman: 34, canal_rat: 81, candle_wisp: 31, carrot: 10, cave_spider: 15, char_stump: 34, cliff_goat: 47, cloud_ram: 41, crab: 17, crow: 12, dig_ant: 22, dragonfly: 18, dragonfly_rainbow: 25, ember_fox: 34, fire_bat: 63, fire_imp: 72, float_rock: 47, flying_ant: 24, frog: 15, ghost: 25, golem: 54, gust_sprite: 38, kappa: 68, lava_worm: 74, magma_golem: 72, mist_wraith: 66, moth: 29, mother_bloom: 58, nurse_ant: 22, poison_toad: 49, pumpkin: 9, raptor: 76, rhino_beetle: 76, salamander: 66, scorpion: 50, scorpion_copper: 67, shadow_crow: 75, shadow_heron: 69, skeleton: 28, slime_blue: 14, slime_glow: 26, slime_lava: 45, slime_stone: 22, soldier_ant: 26, split_slug: 58, storm_eagle: 41, stump: 31, swamp_snake: 51, tomb_knight: 34, tombstone: 25, wolf: 30, worker_ant: 19, zombie: 24, zombie_mold: 32 });
  const CURVE = 1.374, CAP = 1.5;
  NC.matQty = function (e, n) {
    const lv0 = e && NATIVE[e.type];
    const k = lv0 && e.lv > lv0 ? Math.min(CAP, Math.pow(e.lv / lv0, CURVE)) : 1, x = n * k;
    if (x === n) return n; // (at or under its junk's level: as it was, no roll)
    return Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);
  };

  // ---------------- the 1st-job mage ----------------
  if (NC.JOB_POWER) NC.JOB_POWER.mage = 1.8;
  if (NC.JOBS && NC.JOBS.mage) NC.JOBS.mage.hp = 4.5;
})();
