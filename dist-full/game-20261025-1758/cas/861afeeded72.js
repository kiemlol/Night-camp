/* balance_1011.js — the balance round of 2026-10-11 (the user: "ทำสมดุลกันดีกว่า มอนเตอร์แมพแรกๆ จะไม่ active นะ เพื่อที่
   ตัวละครจะได้ไปตีมอนได้").
     passive early fields   on the fields whose monsters are at most Lv 24 (the farm fields, the moonlit meadow, the frog
                            marsh, the flower hill: NC.MAPS[id].lv, never a dungeon) the monsters do not come at the
                            hero: they wander until something hits them, then fight back like everywhere else, and calm
                            down 15 s after the last hit. Bosses and elites stay aggressive, and so do the dungeons
                            (the bat cave is a danger on purpose).
   How: an outer NC.updateEnemy wrapper shows a calm monster the hero far away (game.player is a stand-in at +1e6 for its
   update: every species' AI file reads game.player, so none needs touching); NC.damageEnemy marks the one hit.
   NC.Bal1011 = { passiveMap(id), isCalm(e), PASSIVE_LV }. */
(function () {
  'use strict';
  const NC = window.NC;
  const PASSIVE_LV = 24, CALM_AFTER = 15;

  // ---------------- which maps are calm ----------------
  const cache = {};
  function passiveMap(id) {
    if (id in cache) return cache[id];
    const M = NC.MAPS && NC.MAPS[id];
    let hi = 0;
    if (M && !M.dungeon && M.lv) for (const t in M.lv) { const v = M.lv[t]; hi = Math.max(hi, Array.isArray(v) ? v[1] || v[0] : v); }
    return (cache[id] = !!(M && !M.dungeon && hi > 0 && hi <= PASSIVE_LV));
  }
  const isBoss = (e) => !!((NC.BOSSES && NC.BOSSES[e.type]) || (NC.STORY_BOSSES && NC.STORY_BOSSES[e.type]) || e.boss || e.isBoss);
  const isElite = (e) => !!(e.elite || e.champ || (NC.MONSTERS && NC.MONSTERS[e.type] && NC.MONSTERS[e.type].eliteOf));
  function isCalm(game, e) {
    if (!e || e.dead || e.pvp || e.dummy || !passiveMap(game.mapId) || isBoss(e) || isElite(e)) return false;
    return !(e._provokedT && game.time - e._provokedT < CALM_AFTER);
  }

  // ---------------- a calm monster's update: the hero is far away ----------------
  const baseUpd = NC.updateEnemy;
  NC.updateEnemy = function (game, e) {
    if (!isCalm(game, e) || !game.player) return baseUpd.apply(this, arguments);
    const p = game.player;
    // (a monster that was chasing loses the hero by its own rules and walks home)
    game.player = Object.create(p, { x: { value: p.x + 1e6, writable: true }, y: { value: p.y + 1e6, writable: true } });
    try { return baseUpd.apply(this, arguments); } finally { game.player = p; }
  };
  // ---------------- something hits it: it fights back ----------------
  const baseDmg = NC.damageEnemy;
  NC.damageEnemy = function (game, e) {
    // (only a hit from around the hero counts: the camp's other adventurers (bots) hunt here too, and a monster
    // they hit should not run across the map at the hero; its own AI sees the hero next frame and goes for him)
    const p = game && game.player;
    if (e && p && passiveMap(game.mapId) && NC.dist(e.x, e.y, p.x, p.y) < 1000) e._provokedT = game.time;
    return baseDmg.apply(this, arguments);
  };

  NC.Bal1011 = { passiveMap, isCalm: (e) => isCalm(NC.game, e), PASSIVE_LV };
})();
