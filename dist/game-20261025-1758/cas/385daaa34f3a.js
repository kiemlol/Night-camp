/* js/passprops.js — shots fly past rocks and trees, and the hero walks round them instead of sticking (2026-10-18, the
   user: "แก้ ตีติดหินติดต้นไม้ด้วย", then: "มันควรจะเดิน ไม่ชนหิน กับต้นไม้ ... จะเดินวนพวกหินพวกออฟเจ็คเลย" — walk round
   them, not through them).

   Before: every arrow, bolt, skill shot, huuma and monster bolt died where the ground under it was solid, and the foot
   of a rock, a tree or a bush is solid: a hero shooting past a trunk lost the shot at the trunk, and AUTO stood still
   shooting a rock (autofarm.js shotClear). Walking into a rock or a trunk head-on stopped the hero dead.

   The map builders (fieldgen.js, camp.js, dungeongen.js) keep world.solidOwn: for each solid cell, 0 when anything hard
   stood it up (water, cliffs, plateaus, dungeon walls and pools, the map's edge), else the bits NC.softProp gives the
   props that marked it (a cell two props share keeps only the bits both give):
     2  a shot flies past it: trees, tall plants, rocks and every rock-kind prop (stumps, logs, crates, barrels, wells,
        carts, graves...), bushes, posts, fences, benches
     4  the hero walks round it: all of those, and houses
   Arches' legs, and whatever is marked after the build (ore veins, the forge, the shop, guild fires...) stay hard. The
   PvP arena keeps its rocks as cover (pvparena.js has no solidOwn). Nothing is walked through: world.solid is unchanged.

   NC.passProps(world) runs at the end of each builder and gives the world
     shotSolid(x, y)  a wall to a shot: read by NC.shotWall (world.js) wherever a shot meets the ground (entities.js
                      basic shots, skills.js, skillkit.js, throwstar.js, archerfx.js, party.js, monkinds.js monster
                      bolts, autofarm.js shotClear)
     roundAt(x, y)    a solid cell of a prop the hero walks round
   NC.walkMove (entities.js's walking step): a step that bumps only into props turns 15°, 30° … up to 105° the side away
   from them (the side kept while it goes on bumping, so a trunk hit dead centre is not dithered round; on that side up
   to 135° if it must, never over to the other side meanwhile), a little slower past 45°; a step that touches a wall, or finds no way, is NC.tryMove as before (sliding along the wall). The turned
   way is kept on p.steer. Online the keys still go to the Go server, which steers round the same props from its own
   spot with this very rule (backend server/walk_round.go; the props: world.json roundSolid, exported from roundAt by
   scripts/export-terrain-collision.mjs --round-only). Sending the turned way instead (until 2026-10-18) made the server
   slide into the prop from its own, slightly different spot and stand there while the hero walked on: the tug back.
   Online (?online) shots keep the old rule: the Go server stops them on its own grid (shots.go, throw_flight.go,
   job_shinobi_stars.go, monster_kinds_far.go), and an arrow drawn past a trunk that the server stopped would land with
   no damage. They pass online too once the server reads a shot grid (world_export layout.shotSolid + a server patch).

   ?passprops=0 the old rule everywhere; ?walkround=0 shots only. README "ตีผ่านหินกับต้นไม้ เดินอ้อมสิ่งของ".
*/
(function () {
  const NC = window.NC;
  const OFF = false, ROUND = true;
  const SHOTS = !NC.ONLINE; // (online: the server's grid decides where a shot ends)
  const SHOT_KINDS = { tree: 1, tall: 1, rock: 1, bush: 1, post: 1, fence: 1, seat: 1 };
  const SHOT = 2, WALK_ROUND = 4, DASH = 8;

  // the bits a prop's foot gives the cells it marks (0 = hard, as before)
  NC.softProp = function (name, D, scale = 1) {
    if (OFF || !D) return 0;
    if (SHOT_KINDS[D.kind]) return SHOT | WALK_ROUND | (NC.propIsDashThrough(name, D.kind, scale) ? DASH : 0);
    return D.kind === 'house' ? WALK_ROUND : 0;
  };

  function cell(w, x, y) {
    const C = w.CELL, gx = Math.floor(x / C), gy = Math.floor(y / C);
    return gx < 0 || gy < 0 || gx >= w.GW || gy >= w.GH ? -1 : gy * w.GW + gx;
  }
  // Water (a field's ponds, fieldgen.js: w.ponds[].pts, their outlines) is flat: a shot, a bolt or a blow goes over it.
  // Every arrow, bolt and skill shot across a pond died at its shore, and online the server refused a hit across one
  // (Discord #112 "มอนอยู่ใกล้บ่อน้ำตียาก"). Walking stays as it is: nobody walks on water. The Go server passes it the same
  // way (tools/online/patches/024_water_sight.patch: MapDef.waterAt over the same ponds in clearLine and the shot walls).
  function inPoly(pts, x, y) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  NC.waterAt = function (w, x, y) {
    const P = w && w.ponds;
    if (!P || !P.length) return false;
    for (const p of P) {
      if (!p.pts || Math.abs(x - p.x) > p.rx * 1.6 || Math.abs(y - p.y) > p.ry * 1.6) continue;
      if (inPoly(p.pts, x, y)) return true;
    }
    return false;
  };
  function shotSolid(x, y) {
    const k = cell(this, x, y);
    return k < 0 || (this.solid[k] === 1 && !(this.solidOwn[k] & SHOT) && !NC.waterAt(this, x, y));
  }
  // online the shots' looks keep stopping at everything solid (the server's own grid ends them), but water
  function wetShotSolid(x, y) { return this.isSolid(x, y) && !NC.waterAt(this, x, y); }
  function roundAt(x, y) {
    const k = cell(this, x, y);
    return k >= 0 && this.solid[k] === 1 && !!(this.solidOwn[k] & WALK_ROUND);
  }
  function dashSolid(x, y) {
    const k = cell(this, x, y);
    return k < 0 || (this.solid[k] === 1 && !(this.solidOwn[k] & DASH));
  }
  NC.attachDashCollision = function (w) { if (!OFF && w.solidOwn) w.dashSolid = dashSolid; return w; };

  NC.passProps = function (w) {
    if (OFF || !w || !w.solid || !w.solidOwn || w.roundAt) return w;
    w.shotSolid = SHOTS ? shotSolid : wetShotSolid;
    w.roundAt = roundAt;
    NC.attachDashCollision(w);
    return w;
  };

  // ---------------- walking round props ----------------
  const D2R = Math.PI / 180, TURNS = [15, 30, 45, 60, 75, 90, 105], KEPT_TURNS = TURNS.concat([120, 135]);
  NC.walkMove = function (world, p, dx, dy) {
    const L = Math.hypot(dx, dy);
    if (!ROUND || !L || !world.roundAt || world.fits(p.x + dx, p.y + dy, p.r)) { p.steer = null; return NC.tryMove(world, p, dx, dy); }
    const g = NC.game, now = g ? g.time : 0, I = g && p === g.player ? g.input : null;
    // the way he wants to go: the keys' (whole 45° steps; the velocity still turning would make a new way every frame)
    const a = I && (I.mx || I.my) ? Math.atan2(I.my, I.mx) : Math.atan2(dy, dx);
    // what the step bumps into: the rim of the hero at the new spot (world.fits' 8 points) and its middle
    const nx = p.x + dx, ny = p.y + dy;
    let props = 0, wall = 0, lean = 0;
    for (let i = -1; i < 8; i++) {
      const b = (i * Math.PI) / 4, x = i < 0 ? nx : nx + Math.cos(b) * p.r, y = i < 0 ? ny : ny + Math.sin(b) * p.r * 0.6;
      if (!world.isSolid(x, y)) continue;
      if (!world.roundAt(x, y)) { wall++; break; }
      props++;
      if (i >= 0) lean += Math.sin(b - a); // (> 0: the prop is on his clockwise side)
    }
    if (wall || !props) { p.steer = null; return NC.tryMove(world, p, dx, dy); }
    // which way round: the side he took while he keeps bumping, else away from where the prop leans, else clockwise.
    // While he keeps bumping that side stays, turning on past 105° up to 135° (backing off a little) if it must: going
    // over to the other side sent him back the way he came every other step at a grave's corner or between two props,
    // shaking on the spot (2026-10-18). The server walks this same rule (backend server/walk_round.go).
    const kept = p._steerSide && now - p._steerT < 0.4;
    const side = kept ? p._steerSide : lean > 0.05 ? -1 : lean < -0.05 ? 1 : 1;
    for (const s of kept ? [side] : [side, -side])
      for (const d of kept ? KEPT_TURNS : TURNS) {
        const b = a + s * d * D2R, f = d <= 45 ? 1 : 1 - (d - 45) / 240, ux = Math.cos(b), uy = Math.sin(b);
        if (!world.fits(p.x + ux * L * f, p.y + uy * L * f, p.r)) continue;
        p.x += ux * L * f; p.y += uy * L * f;
        p.steer = { x: +ux.toFixed(3), y: +uy.toFixed(3), t: now };
        p._steerSide = s; p._steerT = now;
        // going round sideways: he faces the way he goes (not while a swing holds his facing)
        if (Math.abs(ux) > 0.5 && !(p.atk && p.atk.on) && !(I && I.mx)) p.face = ux > 0 ? 1 : -1;
        return;
      }
    p.steer = null;
    return NC.tryMove(world, p, dx, dy);
  };

  NC.PassProps = { on: !OFF, shots: SHOTS, round: ROUND };
})();
