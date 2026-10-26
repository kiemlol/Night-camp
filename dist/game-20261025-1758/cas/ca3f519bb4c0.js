/* mage_early.js — the 1st-job mage's early pace (2026-10-18, after js/balance_1018.js: the mage was the one job that fell
   behind on its HP x2.8–3 at Lv 1–16). Measured first (tools/farmsim.js, 90 auto-farm runs of 240 s: the knight's ดาบแท้ against
   the four mage builds ไฟแท้ / น้ำแข็งควบคุม / ตีปกติ / ไฮบริด at Lv 10 / 14 / 18 / 25 / 30 on ไร่ฟักทอง / ทุ่งหญ้าแสงจันทร์ /
   เนินดอกไม้กลางคืน / ป่าเห็ดเรืองแสง / สุสานเก่าหลังเนิน, band gear and starting gear, with the bot builds' full skill points and with the points
   a hero of that level really has, Job Lv 3 / 7 / 13 / 27 / 41):
     the mage killed 2–3x slower than the knight at every level (median 27 / 19 / 18 / 15 kills a minute against 55 / 45 /
     47 / 30), 4.6–12 s a monster with a real hero's skills against the knight's 0.3–1 s; at Lv 25 the HP bar went down to 2–10% with deaths.
   Why:
     MATK   INT + (INT / 7)^2 has no weapon in it: a Lv 14 mage with INT 26 has MATK 38–55, the knight's ATK is ~78
            (STR + the sword's 44–56), so a mage's spell does ~250–400 where the knight's bash does 750–2,000 (the
            monsters' 500–1,300 HP: one bash, three or four spells). The quadratic INT term only pays from INT ~60.
     time   each spell is a cast (0.7–0.8 s at DEX 12) and the after-cast delay (0.6–0.8 s): the mage stood casting half
            its time; the knight walked two thirds of its time (its kills are one hit, it waits for the next monster)
     skills a real Lv 14 mage has 6 skill points (Job Lv 7): ลูกไฟ 6 with หอกน้ำแข็ง / สายฟ้าฟาด at their free Lv 1 —
            about what the bot builds do per cast (rotiming.js DMG: ลูกไฟ x0.67, หอกน้ำแข็ง x0.93)
     basic  the staff's bolt (45% of MATK + the staff's roll, x0.86 for the job) did 15–25% of the damage
   This file: every hit of a hero who is a 1st-job mage (NC.JOBS.mage, จอมเวท) x the factor of the hero's base level (K
   below), its spells, the staff's bolts and the autospell alike; easing to x1 at Lv 40, so the middle game from Lv 40, the 2nd
   jobs (archmage, warlock, ...) and every other job stay as they were. Not between players: a duel (NC.PvP.duel) and the arena's
   / guild war's stand-ins (e.pvp, e.gwp) take the hero's own numbers.
   After (the same 240 s runs, Lv 10 / 14 / 18 / 25 / 30, band gear, a real hero's skill points): the knight kills 1.7 / 1.3 /
   1.8 / 1.6 / 1.55x as many as the mage (was 1.8 / 2.0 / 2.35 / 1.9 / 1.9x), 2.4–6 s a monster (was 4.6–12); with the bot
   builds' full skill points 2.0 / 2.0 / 2.2 / 1.65 / 1.8x (was 2.5 / 2.7 / 3.0 / 2.2 / 2.2x). Still open: at Lv 25–30 the mage
   faints (HP ~350 against the knight's ~650), and the auto farm never casts ลูกไฟ while หอกน้ำแข็ง / สายฟ้าฟาด (1 s
   cooldowns, even at their free Lv 1) are on the bar: autofarm.js keyOrder tries cooldown skills first.
   Offline only: online the Go server works the damage out itself (nothing here goes to world.json).
   Hook: NC.heroHit (outermost, after js/newbie.js). */
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
  const M = (NC.MAGE_EARLY = {
    // [the hero's base level, x damage], straight lines between, the last one's after
    K: [[1, 1.5], [12, 1.55], [18, 1.9], [25, 1.85], [32, 1.35], [40, 1]],
  });
  M.k = (p) => (p && p.job === 'mage' ? along(M.K, p.lv || 1) : 1);
  const pvp = (e) => !!((NC.PvP && NC.PvP.duel) || (e && (e.pvp || e.gwp)));

  const baseHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    // (whose hit: checked before the call, as rotiming.js: a hook inside may derive the hero's stats again)
    const hero = NC.game && NC.game.player, mine = !!hero && d === hero.d;
    const r = baseHit.apply(this, arguments);
    if (mine && r && r.dmg > 0 && !pvp(e)) {
      const k = M.k(hero);
      if (k !== 1) r.dmg = Math.max(1, Math.round(r.dmg * k));
    }
    return r;
  };
})();
