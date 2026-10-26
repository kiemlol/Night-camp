/* aspdgear.js — attack speed comes from gear more than from stats (2026-10-18, the user: "อยากให้เน้นไปที่ของ มากกว่า
   การเเค่อัพสเตตัส", then picked "ลด AGI เพิ่มของ"). Before: AGI 99 alone was x1.80 of the x2.5 ceiling (the stats did 53%
   of the way there, gear 47%) and full speed gear came to +70%, far past what was left.
     stats        AGI 0.004 and DEX 0.001 a point (was 0.008 / 0.0015), x1.5 at most (was x2): a new hero x1.03 (ASPD 151,
                  was 152), AGI 99 x1.40 (the sword's ASPD 164, was 172), AGI 99 + DEX 99 x1.50
     weapons      the ตีเร็ว row 3–6 / 7–9 / 10–12% (was 3–4 / 5–6 / 7–8): two rows +24%
     accessories  a ตีเร็ว row of their own (aspdAcc: 2–3 / 4–5 / 6%; its key aspd goes through gearopts.js rowMods):
                  two pieces with two rows each +24%
     the ceiling  NC.ASPD_CAP x2.5 stays. AGI 99 with the weapon's ability (+18%), its rows (+24%), a light-leather set of
                  grade 4 with its accessory (+16%) and the accessories' rows (+24%) = x2.55, so x2.5: the stats do 27% of
                  the way, gear 73%. With no speed gear the hero attacks slower than before (x1.40 against x1.80).
   Copies keep the values they rolled: the old 3–8 stays inside the new 3–12, so the stalls (gearopts.js dec) still take them.
   Online: the Go server works the speed out itself. Its stat formula is tools/online/patches/003_aspd_gear.patch (stats.go),
   the two rows reach world.json through tools/online/world_export.mjs (part gearopts). */
(function () {
  'use strict';
  const NC = window.NC, OPT = NC.WOPTS;
  if (!OPT || !OPT.aspd) return;
  NC.ASPD_STAT = { agi: 0.004, dex: 0.001, cap: 1.5 };
  OPT.aspd.tiers = [[3, 6], [7, 9], [10, 12]];
  OPT.aspdAcc = { th: 'ตีเร็ว', tiers: [[2, 3], [4, 5], [6, 6]], on: 'A', g: 'atk', key: 'aspd', cap: 0, text: (r) => `ความเร็วโจมตี +${r.v}%` };
})();
