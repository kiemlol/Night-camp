/* newbie.js — the newbie power (the user, 2026-10-08, brought into this web 2026-10-18: "ยกพลังมือใหม่ ... มาใส่เว็บเรา";
   it lived only in the server team's copy of the web and on the Go server, server/newbie_power.go): a Lv 1 hero had
   42 HP and could not farm the first map. A hero of base level 1 through FULL has max HP x HP and deals damage x DMG;
   from the next level both fade in a straight line to x1 at GONE.
     HP     only the HP from level, VIT, job and the body skill (stats.js's own formula) is boosted: gear HP, flat or %,
            and the % passives count once, so the mid game is untouched. It never drops on a level-up: past FULL it is
            at least its boosted value at FULL until its own passes that (about Lv 47). HP regen x the same factor.
     damage every hit of the hero x the factor, rounded, at least 1 (NC.heroHit, the outermost wrapper)
     PvP    nothing while a duel is on (NC.PvP.duel): a fight is at the heroes' own numbers
   The numbers go to the Go server with tools/online/world_export.mjs (world.json combatRules.newbie). Not tuned to the
   x2.5 monster HP on purpose (the user: monsters still die too easily). Load after every NC.derive / NC.heroHit wrapper. */
(function () {
  'use strict';
  const NC = window.NC;
  const N = (NC.NEWBIE = { full: 15, gone: 25, hp: 3, dmg: 2 });
  const share = (lv) => Math.min(1, Math.max(0, (N.gone - lv) / (N.gone - N.full)));
  NC.newbieHpK = (lv) => 1 + (N.hp - 1) * share(lv);
  NC.newbieDmgK = (lv) => 1 + (N.dmg - 1) * share(lv);
  const inDuel = () => !!(NC.PvP && NC.PvP.duel);
  // stats.js NC.derive's HP from level, VIT, job and the body skill
  const coreHp = (L, jobHp, vit, body) => Math.round((35 + L * jobHp + L * L * 0.04) * (1 + vit / 100) * (1 + body * 0.02));

  const baseDerive = NC.derive;
  NC.derive = function (p) {
    const d = baseDerive.apply(this, arguments);
    if (!d || !p || inDuel()) return d;
    const job = NC.JOBS[p.job] || NC.JOBS.traveler, body = NC.skillLv ? NC.skillLv(p, 'body') : 0, L = p.lv || 1;
    const own = d.maxHp, core = coreHp(L, job.hp, d.vit || 0, body);
    let boosted = core;
    const k = NC.newbieHpK(L);
    if (k !== 1) boosted = Math.round(core * k);
    if (L > N.full) boosted = Math.max(boosted, Math.round(coreHp(N.full, job.hp, d.vit || 0, body) * NC.newbieHpK(N.full)));
    if (boosted !== core) {
      d.maxHp = own + boosted - core;
      if (own > 0) d.hpRegen *= d.maxHp / own;
    }
    const dk = NC.newbieDmgK(L);
    if (dk !== 1) d.newbieK = dk;
    return d;
  };

  const baseHit = NC.heroHit;
  NC.heroHit = function (d) {
    const r = baseHit.apply(this, arguments);
    if (r && r.dmg > 0 && d && d.newbieK > 1 && !inDuel()) r.dmg = Math.max(1, Math.round(r.dmg * d.newbieK));
    return r;
  };
})();
