/* levelgap.js — kill EXP by the level gap (the user, 2026-09-30, the Game Bible's online plan decision 2; brought into
   this web 2026-10-18: "ยก ... EXP ตามช่องว่างเลเวล ... มาใส่เว็บเรา"; it lived only in the server team's copy of the
   web and on the Go server, server/level_gap.go): a kill pays its Base and Job EXP times a multiplier by
   |monster Lv − hero Lv| — up to 3 levels 100%, 4–8 70%, 9–14 40%, 15–20 20%, more 5% — bosses and chests too.
   The same multiplier scales the drops (js/endgame_audit.js NC.dropGap).
     how    NC.damageEnemy (the outermost wrapper) sets the monster's exp / jexp from the ones it was born with x the gap
            of the hero's level at that hit, so the kill's log line, its EXP orbs and a party's even share
            (js/partynet.js) all pay the gap; online the server pays (the same table, world.json experience.levelGap)
   The table goes to the Go server with tools/online/world_export.mjs. NC.levelGapMult(heroLv, monsterLv). */
(function () {
  'use strict';
  const NC = window.NC;
  // [largest gap, multiplier] rows; past the last row its multiplier
  const ROWS = (NC.LEVEL_GAP = [[3, 1], [8, 0.7], [14, 0.4], [20, 0.2], [999, 0.05]]);
  NC.levelGapMult = function (heroLv, monLv) {
    const gap = Math.abs((heroLv || 1) - (monLv || 1));
    for (const [most, k] of ROWS) if (gap <= most) return k;
    return ROWS[ROWS.length - 1][1];
  };
  // a material the main quest on hand still asks for is not cut by the gap (Discord #183, 2026-10-21: an old quest's
  // "รวงผึ้งน้ำผึ้ง 5/20" hardly dropped for a hero far above its monsters); the Go server's quests.go questMatGap
  NC.questMatGap = function (p, mat, k) {
    if (!(k < 1) || !mat || !p || !NC.Quests || !NC.Quests.cur) return k;
    const q = NC.Quests.cur(), st = NC.Quests.state;
    if (!q || !st || !st.on || !Array.isArray(q.obj)) return k;
    const have = (p.mats && p.mats[mat]) | 0;
    return q.obj.some((o) => o.k === 'mat' && o.id === mat && have < o.n) ? 1 : k;
  };

  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e) {
    const p = game && game.player;
    if (e && p && !e.dummy && typeof e.exp === 'number') {
      if (!e._xp0) e._xp0 = [e.exp, e.jexp || 0];
      const k = NC.levelGapMult(p.lv, e.lv);
      e.exp = Math.round(e._xp0[0] * k);
      e.jexp = Math.round(e._xp0[1] * k);
    }
    return baseDamage.apply(this, arguments);
  };

  // (the server team's part, kept from its copy of the web) the table for world.json experience.levelGap (the Go server
  // and Unity read it there), and the band of a gap for the map window's fit / hard / easy and the monsters' name colours
  // (js/mapwin.js, js/worldmap.js): 0 (even, 100%) up to the last row (far off, 5%), and whether the monster is stronger
  if (NC.EXPERIENCE) NC.EXPERIENCE.levelGap = ROWS;
  NC.levelGapBand = function (heroLv, monsterLv) {
    const gap = Math.abs((heroLv || 1) - (monsterLv || 1));
    let band = ROWS.findIndex(([most]) => gap <= most);
    if (band < 0) band = ROWS.length - 1;
    return { band, mult: ROWS[band][1], gap, stronger: monsterLv > heroLv };
  };
  // a place whose monsters are [lo, hi]: the band of the one nearest the hero's level (the most EXP it can give)
  NC.levelGapRange = (range, heroLv) => (range ? NC.levelGapBand(heroLv, NC.clamp(heroLv, range[0], range[1])) : null);
})();
