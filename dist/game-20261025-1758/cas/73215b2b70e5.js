/* autotravel.js — the hero walks himself to a place, across maps (for the guided journey's AUTO button, js/journey.js;
   2026-10-12). The way between maps is the map window's (NC.MapRoute.pathTo: the warps and the edge exits), inside a map
   the auto farm's A* (NC.Auto.findPath) round trees, rocks and fences; a warp is walked into and stood in until it takes
   the hero (0.55 s, game.js). Walking (WASD / the joystick), clicking the ground, dying or the auto farm switching on
   hands control back.
   NC.Travel.go(game, { map, x, y, r, name, done(game), clickMove }) · .stop(why) · .on · .target · .path (the points still to walk on
   this map, for the firefly trail) · .next (the warp being walked to, or null). Plugs in by wrapping NC.updatePlayer (it
   sets game.input.mx / my for the update, as the auto farm does). */
(function () {
  'use strict';
  const NC = window.NC, dist = NC.dist;
  const T = (NC.Travel = { on: false, target: null, path: null, next: null, note: '' });
  let goal = null, repathT = 0, lastPos = null, lastPosT = 0, stuck = 0, forceT = 0, wig = null, best = Infinity, bestT = 0, aim = null;
  let travelWorld = null; // right-click destinations belong only to the world where they were issued

  // inside a warp's trigger (game.js: the ellipse 70 x 42)?
  const inWarp = (pt, x, y) => ((x - pt.x) / 70) ** 2 + ((y - pt.y) / 42) ** 2 < 1;
  // near a warp that is NOT the one we want (walking through it would take the hero somewhere else)
  const nearOther = (game, x, y, keep) => game.portals.some((pt) => pt !== keep && ((x - pt.x) / 110) ** 2 + ((y - pt.y) / 70) ** 2 < 1);
  function clear(game, ax, ay, bx, by, keep) {
    const n = Math.ceil(dist(ax, ay, bx, by) / 4); // (as Auto: diagonal shortcuts must clear the corners between collision cells)
    for (let i = 1; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n, y = ay + ((by - ay) * i) / n;
      if (!game.world.fits(x, y, 20) || nearOther(game, x, y, keep)) return false;
    }
    return true;
  }
  // a spot just outside a warp, on the hero's side (the paths keep away from warps; the last bit is walked straight)
  function before(game, pt) {
    const p = game.player, a0 = Math.atan2(p.y - pt.y, p.x - pt.x);
    for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.2, -2.2, Math.PI]) {
      const x = pt.x + Math.cos(a0 + da) * 160, y = pt.y + Math.sin(a0 + da) * 110;
      if (game.world.fits(x, y, 22) && !nearOther(game, x, y, null)) return [x, y];
    }
    return [pt.x, pt.y];
  }
  // a step towards (x, y): straight when the way is clear, else along an A* path (redone when the goal moves or it stalls)
  // (after a stall the straight line is not trusted for a few seconds: the grid path round the spot is walked)
  function walkTo(game, x, y, dt, keep) {
    const p = game.player, forced = game.time < forceT;
    aim = [x, y];
    repathT -= dt;
    if (!forced && clear(game, p.x, p.y, x, y, keep)) { T.path = [[x, y]]; return [x - p.x, y - p.y]; }
    if (!T.path || !goal || dist(goal[0], goal[1], x, y) > 60 || repathT <= 0) {
      T.path = NC.Auto && NC.Auto.findPath ? NC.Auto.findPath(game, p.x, p.y, x, y) : null; goal = [x, y]; repathT = 2;
      if (!T.path) { T.path = [[x, y]]; return [x - p.x, y - p.y]; } // (no path: try straight, the stall check gives up)
    }
    while (T.path.length > 1 && (!forced || dist(p.x, p.y, T.path[0][0], T.path[0][1]) < 30) && clear(game, p.x, p.y, T.path[1][0], T.path[1][1], keep)) T.path.shift();
    const w = T.path[0];
    return [w[0] - p.x, w[1] - p.y];
  }
  function step(game, dt) {
    const t = T.target, p = game.player;
    if (t.clickMove && (game.mapId !== t.map || game.world !== travelWorld)) { T.stop(''); return null; }
    if (game.mapId !== t.map) {
      const route = NC.MapRoute && NC.MapRoute.pathTo(game.mapId, t.map);
      const pt = route && route.length > 1 && game.portals.find((w) => w.to === route[1]);
      if (!pt) { T.stop('หาทางไป' + (t.name || 'ที่นั่น') + 'ไม่เจอ'); return null; }
      if (T.next !== pt) { T.next = pt; T.path = null; goal = null; }
      if (inWarp(pt, p.x, p.y)) { T.note = 'กำลังเข้าวาร์ป'; return null; } // stand in it: the warp takes the hero
      T.note = 'ไป' + ((NC.MAPS[pt.to] || {}).name || pt.to);
      if (dist(p.x, p.y, pt.x, pt.y) < 190 && clear(game, p.x, p.y, pt.x, pt.y, pt)) { T.path = [[pt.x, pt.y]]; return [pt.x - p.x, pt.y - p.y]; }
      const b = before(game, pt);
      return walkTo(game, b[0], b[1], dt, pt);
    }
    T.next = null;
    const radius = t.clickMove ? Math.max(t.r || 12, Math.hypot(p.vx || 0, p.vy || 0) * dt / 2 + 1) : t.r || 90;
    // A fast step can straddle a small click destination. Stop at the nearer frame,
    // but never accept a nearby point across a wall instead of walking its route.
    if (dist(p.x, p.y, t.x, t.y) < radius && (!t.clickMove || clear(game, p.x, p.y, t.x, t.y, null))) { arrive(game); return null; }
    T.note = 'ไป' + (t.name || 'ที่หมาย');
    return walkTo(game, t.x, t.y, dt, null);
  }
  function arrive(game) {
    const t = T.target;
    if (t && t.clickMove) { game.player.vx = game.player.vy = 0; wig = null; } // no residual coast past the clicked point
    T.on = false; T.target = null; T.path = null; T.next = null; travelWorld = null;
    if (t && t.done) t.done(game);
  }
  // stalled (no 20 units in 1.2 s, or not 30 units of route progress in 4 s: sliding to and fro along a wall), the
  // auto farm's ladder (js/autofarm.js NC.Auto.unstick): re-plan round the spot (the cell pushed into shut for a while),
  // then a side step the freest way, then a hop out if wedged in a rock; still stuck after that: give up
  function watch(game, dt) {
    const p = game.player, t = game.time, U = NC.Auto && NC.Auto.unstick;
    if (p.channel || p.skillLock > 0 || p.sit || (wig && t < wig.until)) { lastPosT += dt; bestT += dt; return; }
    // A valid detour may head away from the destination. Track the remaining route,
    // otherwise a long river bank is declared stuck despite continuous movement.
    let d = 0, x = p.x, y = p.y;
    for (const w of T.path || []) { d += dist(x, y, w[0], w[1]); x = w[0]; y = w[1]; }
    if (aim) d += dist(x, y, aim[0], aim[1]);
    if (d < best - 30) { best = d; bestT = t; stuck = 0; }
    if (!lastPos || dist(p.x, p.y, lastPos[0], lastPos[1]) > 20) { lastPos = [p.x, p.y]; lastPosT = t; }
    if (t - lastPosT < 1.2 && t - bestT < 4) return;
    lastPos = [p.x, p.y]; lastPosT = t; bestT = t; T.path = null; repathT = 0;
    stuck++;
    if (!U) { if (stuck >= 3) T.stop('ติดทาง เดินต่อเองนะ'); return; }
    if (U.wedged(game, p) && U.hopOut(game, 160)) return;
    if (stuck <= 2 && aim) { forceT = t + 3 + stuck; U.blockAhead(game, aim[0], aim[1]); }
    if (stuck === 2 && aim) { const v = U.sideDir(game, aim[0], aim[1]); if (v) wig = { vx: v[0], vy: v[1], until: t + 0.55 }; }
    if (stuck >= 4) T.stop('ติดทาง เดินต่อเองนะ');
  }

  T.go = function (game, target) {
    const p = game && game.player;
    if (!p || p.dead > 0 || !target) return false;
    if (NC.Auto && NC.Auto.on) NC.Auto.toggle(game); // (one driver at a time)
    if (p.sit && NC.Rest) NC.Rest.standUp(game);
    T.target = target; T.on = true; T.path = null; T.next = null; goal = null; repathT = 0; lastPos = null; stuck = 0; travelWorld = game.world;
    forceT = 0; wig = null; best = Infinity; bestT = game.time; aim = null;
    if (game.mapId === target.map && dist(p.x, p.y, target.x, target.y) < (target.r || (target.clickMove ? 12 : 90))) arrive(game);
    return true;
  };
  T.stop = function (why) {
    if (!T.on) return;
    if (T.target && T.target.clickMove) wig = null;
    T.on = false; T.target = null; T.path = null; T.next = null; travelWorld = null;
    if (why) { NC.HUD.log('หยุดเดินอัตโนมัติ · ' + why, 'sys'); if (NC.game && NC.game.toast) NC.game.toast(why); }
    if (T.onStop) T.onStop(why);
  };

  const baseUpdate = NC.updatePlayer;
  NC.updatePlayer = function (game, dt) {
    if (!T.on) return baseUpdate.apply(this, arguments);
    const p = game.player, I = game.input, M = game.mouse;
    if (p.dead > 0) { T.stop('หมดแรง'); return baseUpdate.apply(this, arguments); }
    if (NC.Auto && NC.Auto.on) { T.stop(''); return baseUpdate.apply(this, arguments); }
    if (I.mx || I.my || M.down) { T.stop('เดินเอง'); return baseUpdate.apply(this, arguments); }
    const aimWas = aim;
    let v = step(game, dt);
    if (aim !== aimWas && (!aimWas || !aim || dist(aim[0], aim[1], aimWas[0], aimWas[1]) > 60)) { best = Infinity; bestT = game.time; stuck = 0; } // (a new goal: a warp, the target)
    if (T.on && v) watch(game, dt);
    if (wig && game.time < wig.until) v = [wig.vx, wig.vy]; else wig = null;
    const l = v ? Math.hypot(v[0], v[1]) : 0;
    I.mx = l > 1 ? v[0] / l : 0; I.my = l > 1 ? v[1] / l : 0;
    // A pointer left on the other side of the screen must not turn Auto walking backwards.
    const active = M.active;
    if (l > 1 && !p.channel && !(p.atk && p.atk.on) && !(p.skillLock > 0)) M.active = false;
    try { return baseUpdate.apply(this, arguments); }
    finally { M.active = active; }
  };
})();
