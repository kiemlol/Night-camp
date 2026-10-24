/* autofarm.js — Auto Farm (ออโต้ฟาร์ม), the way mobile MMOs do it: the hero hunts by himself.
     Auto Target    the nearest monster of the kinds you picked (a monster hitting you is fought whatever its kind),
                    locked until it dies; never a bot's fight, never one standing in a warp
     Monster Filter which kinds to farm on this map, bosses only if you say so
     Auto Move      a path round trees, rocks, fences and warps (A* on a 40-unit grid of the map) up to its reach
     Auto Attack    the basic combo aimed at it; the hotbar's skills: buffs when they run out, heals when HP is low,
                    attacks when it is in their range
   and round that: potions under a set HP / SP, sitting down to recover when both run low and nothing is near,
   walking over the drops, roaming to where monsters live (a spot only refills when the hero is 700 away).
   Z or the AUTO button switches it; walking (WASD) or clicking yourself, dying or leaving the map hands control back.
   A click (a tap) on a monster while it runs picks that one next and AUTO stays on (A.pick, 2026-10-18).
   Plugs in from the outside: wraps NC.updatePlayer (it presses the hero's keys for him before rest.js and the base
   update read them; the mouse points at the target for that update only), NC.drawEnemyBar (the lock mark), NC.HUD.init
   / update / panel (the button, the status line, the settings window). Settings: localStorage nightcamp.auto.v1. */
(function () {
  'use strict';
  const NC = window.NC, TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const dist = NC.dist;
  const online = () => !!(NC.Online && (NC.Online.active || NC.Online.enabled));
  if (NC.ASSET_MANIFEST_AUTO) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_AUTO); // the button and the lock mark

  // ---------------- settings ----------------
  const KEY = 'nightcamp.auto.v1';
  // (share: leave other players' fights alone · flee: step out of a fight going wrong · group: farm beside the party ·
  // lootWhen: 'fight' the drops after the fight round the hero, 'near' at once; 2026-10-19)
  const SET = { off: [], boss: false, range: 'map', radius: 1300, skills: true, slots: {}, hpPot: 0.5, spPot: 0.2, rest: false, loot: true,
    share: true, flee: true, group: true, lootWhen: 'fight' };
  try { Object.assign(SET, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked: the defaults */ }
  const saveSet = () => { try { localStorage.setItem(KEY, JSON.stringify(SET)); } catch (e) { /* blocked */ } };
  const MIN_RADIUS = 200, MAX_RADIUS = 2000, RADIUS_STEP = 100;
  const radiusOf = (value) => Number.isFinite(Number(value)) ? Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, Math.round(Number(value) / RADIUS_STEP) * RADIUS_STEP)) : 1300;
  SET.radius = radiusOf(SET.radius);
  SET.range = SET.range === 'near' ? 'near' : 'map';

  const A = (NC.Auto = { on: false, set: SET, target: null, state: '', note: '' });
  // the 2026-10-19 smarts, each switchable for tests (tools that compare old and new set these; ?autoold = all off):
  // score = targets by a score (below "choosing"), pot = potions by how fast HP falls, flee / group = as SET (and the
  // player's switches), sp = SP kept for the hotbar's heal, loot = SET.lootWhen (off: the drops as before, at once)
  const OLD = false;
  A.opts = { score: !OLD, pot: !OLD, flee: !OLD, group: !OLD, sp: !OLD, loot: !OLD };
  let returning = false, previewUntil = 0, previewTimer = null;
  let map = null, home = null, path = null, pathI = 0, goal = null, repathT = 0;
  let hitW = null, roamT = 0; // (the hits on the target: are they landing? · the next roam search after one found nowhere)
  let roam = null, roamWait = 0, skillT = 0, black = new Map(), seen = {}, sitting = false, restBlock = 0;
  let picked = null; // (the monster the player clicked while AUTO runs: hunted whatever the filters say, A.pick)

  const isBoss = (e) => !!(NC.BOSSES && NC.BOSSES[e.type]);
  const alive = (e) => e && !e.dead && e.hp > 0;
  const nameOf = (type) => (NC.MONSTERS[type] && NC.MONSTERS[type].name) || type;
  const botFight = (e) => (e.tgt && e.tgt.bot) || (NC.Bots && NC.Bots.list && NC.Bots.list.some((b) => b.target === e));
  const nearWarp = (game, x, y, k) => game.portals.some((pt) => ((x - pt.x) / (110 * k)) ** 2 + ((y - pt.y) / (70 * k)) ** 2 < 1);
  const wanted = (e) => (isBoss(e) ? SET.boss : !SET.off.includes(e.type));

  // ---------------- who a monster is after (2026-10-19) ----------------
  // e.tgt is the hero (or a bot, a test AI friend, a summon) offline, but online it is the server's id of a hero
  // (online/world.js). AUTO compared it with the hero only, so online a monster hitting him never counted as hitting:
  // no fight back against a kind switched off, no threat (he walked off to the drops under its blows, never stood up from
  // a rest), and a monster another player was fighting was hunted like a free one.
  const myId = () => { const W = NC.OnlineWorld, s = W && W.snap && W.snap.self; return (s && s.id) || null; };
  let crew = [], crewT = -1;
  // the party members on this map, this frame: { id, ref, x, y, dead, lead } (real players; the test-only AI friends too)
  function party(game) {
    if (crewT === game.time) return crew;
    crewT = game.time; crew = [];
    const PN = NC.PartyNet, R = PN && PN.roster ? PN.roster() : null;
    if (PN && PN.pid && PN.pid() && PN.others) for (const id of PN.others()) {
      const r = NC.Net && NC.Net.remotes && NC.Net.remotes.get(id);
      if (r && r.map === game.mapId && !r.gwHide && Number.isFinite(r.x)) crew.push({ id, ref: r, x: r.x, y: r.y, dead: !!(r.dd || r.dead > 0), lead: !!(R && R.lead === id) });
    }
    for (const a of (NC.Party && NC.Party.members) || []) if (a && Number.isFinite(a.x)) crew.push({ id: a, ref: a, x: a.x, y: a.y, dead: a.dead > 0, lead: false });
    return crew;
  }
  const afterMe = (game, e) => { const t = e.tgt; return !!t && (t === game.player || t.owner === game.player || (online() && t === myId())); };
  A.afterMe = afterMe; // (js/questauto.js: a monster on the hero while he gathers)
  const afterMate = (game, e) => !!e.tgt && party(game).some((m) => e.tgt === m.id || e.tgt === m.ref);
  // monsters the hero has landed blows on (a fight he started stays his even when it turns on someone else)
  let struck = new WeakSet();
  // someone else's fight: a bot's, or online another hero's who is not in the party (SET.share: left to them)
  const othersFight = (game, e) => botFight(e) || (SET.share && online() && typeof e.tgt === 'string' && !afterMe(game, e) && !afterMate(game, e) && !struck.has(e));

  // ---------------- paths: A* on a coarse grid of the map ----------------
  // A cell is 1 = open (the hero fits at its middle and a little way towards each side, so two open cells side by side
  // are open between them too), 3 = tight (he fits only at one spot of it, its "stand point" g.pts: a neck, a gap
  // between two rocks, a ledge beside a lava pool) or 2 = shut. Every step is taken only when the hero really fits
  // all along it, stand point to stand point (tested once, then
  // kept in g.edges). Without that, a neck the hero walks through (beside the lava pools of lavavent1, the root gaps of
  // roots1) cut half the map off: every monster over there was "unreachable" and the hero stood still in his corner
  // (2026-10-18).
  const G = 40;
  const OFFS = [[0, 0], [-12, 0], [12, 0], [0, -12], [0, 12], [-12, -12], [12, -12], [-12, 12], [12, 12]];
  let nowT = 0; // (game.time: cells blocked for a while, g.tmp)
  function grid(game) {
    const w = game.world;
    if (!w.autoGrid) {
      const gw = Math.ceil(w.W / G), gh = Math.ceil(w.H / G);
      w.autoGrid = { gw, gh, cells: new Uint8Array(gw * gh), pts: new Uint8Array(gw * gh), edges: new Uint8Array(gw * gh * 8), tmp: new Map() };
    }
    return w.autoGrid;
  }
  function cell(game, g, gx, gy) {
    if (gx < 0 || gy < 0 || gx >= g.gw || gy >= g.gh) return 2;
    const i = gy * g.gw + gx;
    if (!g.cells[i]) {
      const x = gx * G + G / 2, y = gy * G + G / 2, W = game.world;
      if (W.fits(x, y, 22) && W.fits(x - 12, y, 18) && W.fits(x + 12, y, 18) && W.fits(x, y - 12, 18) && W.fits(x, y + 12, 18) && !nearWarp(game, x, y, 1)) g.cells[i] = 1;
      else {
        g.cells[i] = 2;
        for (let k = 0; k < OFFS.length; k++) {
          const px = x + OFFS[k][0], py = y + OFFS[k][1];
          if (W.fits(px, py, 20) && !nearWarp(game, px, py, 1)) { g.cells[i] = 3; g.pts[i] = k; break; }
        }
      }
    }
    if (g.tmp.size) { const u = g.tmp.get(i); if (u !== undefined) { if (u > nowT) return 2; g.tmp.delete(i); } } // (a spot the hero got stuck on)
    return g.cells[i];
  }
  // where the hero stands in cell i (its middle, or a tight cell's stand point)
  const standAt = (g, i) => { const o = OFFS[g.pts[i]]; return [(i % g.gw) * G + G / 2 + o[0], Math.floor(i / g.gw) * G + G / 2 + o[1]]; };
  const open = (game, g, gx, gy) => cell(game, g, gx, gy) !== 2;
  // Check more finely than the 10-unit collision cells: diagonal shortcuts can clip a corner between samples.
  function clear(game, ax, ay, bx, by) {
    const n = Math.ceil(dist(ax, ay, bx, by) / 4);
    for (let i = 1; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n, y = ay + ((by - ay) * i) / n;
      if (!game.world.fits(x, y, 20) || nearWarp(game, x, y, 1)) return false;
    }
    return true;
  }
  const DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  function edge(game, g, a, k, b) { // the step from cell a (direction k) to cell b, walked for real
    const j = a * 8 + k;
    if (!g.edges[j]) {
      const A2 = standAt(g, a), B2 = standAt(g, b);
      g.edges[j] = clear(game, A2[0], A2[1], B2[0], B2[1]) ? 1 : 2;
    }
    return g.edges[j] === 1;
  }
  function nearestOpen(game, g, gx, gy, from) {
    const reachable = (x, y) => {
      if (!open(game, g, x, y)) return false;
      const p = standAt(g, y * g.gw + x);
      return !from || clear(game, from[0], from[1], p[0], p[1]);
    };
    if (reachable(gx, gy)) return [gx, gy];
    for (let r = 1; r <= 4; r++) {
      let best = null, bd = Infinity; // (the nearest of the ring, not the first one found)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && dx * dx + dy * dy < bd && reachable(gx + dx, gy + dy)) { bd = dx * dx + dy * dy; best = [gx + dx, gy + dy]; }
      if (best) return best;
    }
    return null;
  }
  // Where a path may start (2026-10-20, Discord #151 / #24). Before, the one nearest open cell in a straight line from the
  // hero. Knocked into a wedge between a wall and a prop (a telescope or a shelf against a dungeon wall, a vein's rock by a
  // cave wall) he fits and can walk out, but that nearest cell was a tight one whose every step on was too tight (an
  // island of the grid), or no cell round a wall was in a straight line at all: every path from there was "none" - the
  // party leader out of reach, every monster given up, every roam spot marked bad - and he stood in the wedge while the
  // monsters hit him. Now every open cell next to him in a straight line is a start (his own and the 8 round it; farther
  // ones only when none of those is open: a long first leg can graze a corner between clear()'s samples), and when no
  // path leaves from them, the cells met by a flood of the spots he fits in 8-unit steps (240 at most), the path
  // beginning with those steps.
  function startCells(game, g, sx, sy) {
    const out = [], gx = Math.floor(sx / G), gy = Math.floor(sy / G);
    for (let r = 0; r <= 3 && (r < 2 || !out.length); r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !open(game, g, gx + dx, gy + dy)) continue;
          const i = (gy + dy) * g.gw + gx + dx, p = standAt(g, i);
          if (clear(game, sx, sy, p[0], p[1])) out.push({ i, cost: dist(sx, sy, p[0], p[1]), lead: null });
        }
    return out;
  }
  const STEP_OUT = 8, STEP_OUT_R = 30;
  function stepOutCells(game, g, sx, sy) {
    const w = game.world, R = STEP_OUT_R, side = 2 * R + 1, key = (i, j) => (i + R) * side + (j + R), home = key(0, 0);
    const back = new Map([[home, -1]]), q = [[0, 0]], out = [], met = new Set();
    const wayTo = (k0) => { const way = []; for (let k = k0; k !== home; k = back.get(k)) way.push([sx + (Math.floor(k / side) - R) * STEP_OUT, sy + ((k % side) - R) * STEP_OUT]); return way.reverse(); };
    for (let h = 0; h < q.length && h < 3000 && out.length < 24; h++) {
      const [i, j] = q[h], x = sx + i * STEP_OUT, y = sy + j * STEP_OUT;
      if (h) {
        const gx = Math.floor(x / G), gy = Math.floor(y / G);
        for (let k = -1; k < 8; k++) { // (the cell under the spot and the ones next to it, open and in a straight line)
          const cx = gx + (k < 0 ? 0 : DIRS[k][0]), cy = gy + (k < 0 ? 0 : DIRS[k][1]), ci = cy * g.gw + cx;
          if (met.has(ci) || !open(game, g, cx, cy)) continue;
          const p = standAt(g, ci);
          if (!clear(game, x, y, p[0], p[1])) continue;
          met.add(ci);
          const lead = wayTo(key(i, j));
          out.push({ i: ci, cost: lead.length * STEP_OUT * 1.2 + dist(x, y, p[0], p[1]), lead });
        }
      }
      for (const [di, dj] of DIRS) {
        const ni = i + di, nj = j + dj, k = key(ni, nj), nx = sx + ni * STEP_OUT, ny = sy + nj * STEP_OUT;
        if (Math.abs(ni) > R || Math.abs(nj) > R || back.has(k) || !w.fits(nx, ny, 20) || nearWarp(game, nx, ny, 1)) continue;
        back.set(k, key(i, j)); q.push([ni, nj]);
      }
    }
    return out;
  }
  // the path as a few waypoints (string-pulled); .gap = how far the target is from the last cell the hero can stand in
  // (a monster on a ledge or inside a thicket: the hero gets no nearer than that)
  function findPath(game, sx, sy, tx, ty, maxLength = Infinity, within = null) {
    const g = grid(game);
    nowT = game.time;
    const t = nearestOpen(game, g, Math.floor(tx / G), Math.floor(ty / G));
    if (!t) return null;
    if (within && !within(...standAt(g, t[1] * g.gw + t[0]))) return null;
    const way = search(game, g, startCells(game, g, sx, sy), t, sx, sy, tx, ty, maxLength, within);
    // (the flood only when the first search found the starts shut in: a wide search that found nothing means the target
    // is out of reach from here, and is not tried twice)
    return way || (explored < 400 ? search(game, g, stepOutCells(game, g, sx, sy), t, sx, sy, tx, ty, maxLength, within) : null);
  }
  let explored = 0; // (the cells the last search looked at)
  // A* on the grid from any of the starts (each with its cost to reach and the small steps there) to the cell t
  function search(game, g, starts, t, sx, sy, tx, ty, maxLength, within) {
    if (!starts.length) return null;
    const W = g.gw, end = t[1] * W + t[0];
    const gs = new Map(), from = new Map(), heap = [], lead = new Map();
    const h = (i) => { const dx = Math.abs((i % W) - t[0]), dy = Math.abs(Math.floor(i / W) - t[1]); return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)) * G; };
    const push = (n) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
      return top;
    };
    for (const s of starts) {
      if (within && !within(...standAt(g, s.i))) continue;
      if (s.cost < (gs.has(s.i) ? gs.get(s.i) : Infinity)) { gs.set(s.i, s.cost); lead.set(s.i, s.lead); push([s.cost + h(s.i), s.i]); }
    }
    let n = 0;
    explored = 0;
    while (heap.length && n++ < 24000) {
      explored = n;
      const [f, cur] = pop();
      if (f > maxLength) return null;
      const gc = gs.get(cur);
      if (f > gc + h(cur) + 1e-6) continue; // (a stale heap entry)
      if (cur === end) {
        const cells = [];
        for (let c = end; c !== undefined; c = from.get(c)) cells.push(c);
        cells.reverse();
        // string-pulling: keep a waypoint only where the straight line from the last kept one is blocked
        const pts = (lead.get(cells[0]) || []).concat(cells.map((c) => standAt(g, c)));
        const last = pts[pts.length - 1];
        // A flying monster or a drop may be inside a footprint. Keep the safe stand point;
        // replacing it with the target sends the hero straight back into the object.
        if (clear(game, last[0], last[1], tx, ty)) pts.push([tx, ty]);
        const out = [];
        let at = [sx, sy];
        for (let i = 0; i < pts.length; i++) {
          const next = pts[i + 1];
          if (next && clear(game, at[0], at[1], next[0], next[1])) continue;
          out.push(pts[i]); at = pts[i];
        }
        out.gap = dist(at[0], at[1], tx, ty);
        return out;
      }
      const cx = cur % W, cy = Math.floor(cur / W);
      for (let k = 0; k < 8; k++) {
        const dx = DIRS[k][0], dy = DIRS[k][1], nx = cx + dx, ny = cy + dy, cn = cell(game, g, nx, ny);
        if (cn === 2) continue;
        const ni = ny * W + nx;
        if (within && !within(...standAt(g, ni))) continue;
        if (!edge(game, g, cur, k, ni)) continue;
        const ng = gc + (dx && dy ? Math.SQRT2 : 1) * G * (cn === 3 ? 1.3 : 1); // (rather round a neck than through it)
        if (ng < (gs.has(ni) ? gs.get(ni) : Infinity)) { gs.set(ni, ng); from.set(ni, cur); push([ng + h(ni), ni]); }
      }
    }
    return null;
  }
  // a step towards (x, y): straight when nothing is in the way, else along a path (kept, redone when it goes stale).
  // After a stall (forceT) the straight line is not trusted for a while: the grid path round the spot is walked instead
  // (the straight-line test said "clear" while the hero pushed into a rock's corner, and every re-plan went straight
  // back into it)
  let forceT = 0;
  function steer(game, x, y, dt) {
    const p = game.player, forced = game.time < forceT;
    repathT -= dt;
    if (!forced && clear(game, p.x, p.y, x, y)) { path = null; return avoid(game, x - p.x, y - p.y); }
    if (!path || !goal || dist(goal[0], goal[1], x, y) > 100 || repathT <= 0) {
      path = findPath(game, p.x, p.y, x, y, Infinity, farmBoundary(game)); pathI = 0; goal = [x, y]; repathT = 1.5;
      if (!path) return null;
    }
    while (pathI < path.length - 1 && (!forced || dist(p.x, p.y, path[pathI][0], path[pathI][1]) < 26) && clear(game, p.x, p.y, path[pathI + 1][0], path[pathI + 1][1])) pathI++;
    const w = path[pathI];
    return avoid(game, w[0] - p.x, w[1] - p.y);
  }
  // feelers: when the next step that way is blocked (a corner, a bush's edge), turn a little, more and more, to the side
  // that worked last time first, so the hero slides round it instead of pushing into it
  let side = 1;
  function avoid(game, vx, vy) {
    const p = game.player, l = Math.hypot(vx, vy), a0 = Math.atan2(vy, vx);
    if (l < 1) return [vx, vy];
    for (const da of [0, 0.35, 0.7, 1.05, 1.4, 1.75]) {
      for (const s of da ? [side, -side] : [1]) {
        const a = a0 + da * s, x = p.x + Math.cos(a) * 28, y = p.y + Math.sin(a) * 28;
        if (clear(game, p.x, p.y, x, y)) { if (da) side = s; return [Math.cos(a) * l, Math.sin(a) * l]; }
      }
    }
    return [vx, vy];
  }

  // ---------------- not getting stuck (2026-10-18) ----------------
  // How the hero used to freeze: shooting a rock, a trunk or a ledge between him and the target (arrows and bolts die
  // where the ground under them is solid) while the monster, stuck on the other side, never came; pushing into a corner
  // the straight-line test missed; sliding to and fro along a wall; a monster in a pocket nobody can reach; a corner of
  // the map with nothing to walk to. Now every stall climbs a ladder: re-plan on the grid round the spot (the cell he
  // pushed into blocked for a while) → a side step the freest way → give the goal up (longer each time it fails, and
  // its spot with it). Wedged inside a rock, or shut in a pocket the size of a room: a short hop out to open ground.
  // can a shot from the hero reach e? (js/entities.js: a shot flies at hand height and dies where the ground 60 below it
  // is solid; it hits within its radius + e.r of e's body)
  function shotClear(game, p, e) {
    const w = game.world, ax = p.x, ay = p.y - 55, bx = e.x, by = e.y - 50, L = dist(ax, ay, bx, by), hitR = 26 + (e.r || 20);
    for (let s = 10; s < L; s += 10) {
      const x = ax + ((bx - ax) * s) / L, y = ay + ((by - ay) * s) / L;
      if (dist(x, y, e.x, e.y - 45) < hitR) return true;
      if (NC.shotWall(w, x, y + 60)) return false; // (js/passprops.js: rocks and trees let shots through)
    }
    return true;
  }
  // Online basic hits, including melee, use MapDef.clearLine on the ground (12-unit steps).
  // Hand-height projectile clearance alone can disagree with the server beside a grave or trunk.
  // (water passes, as on the server since patch 024: js/passprops.js NC.waterAt)
  function attackClear(game, p, e) {
    const n = Math.ceil(dist(p.x, p.y, e.x, e.y) / 12), w = game.world;
    for (let i = 1; i <= n; i++) {
      const x = p.x + (e.x - p.x) * i / n, y = p.y + (e.y - p.y) * i / n;
      if (!NC.terrainFits(w, x, y, 0) && !(NC.waterAt && NC.waterAt(w, x, y))) return false;
    }
    return true;
  }
  // the goals given up: each thing (a monster, a drop) for 12 s, 24, 48 … up to 2 min, and the spot round it for 40 s
  // (a monster that respawns in the same unreachable pocket is not tried again and again)
  let fails = new WeakMap(), bad = [];
  function giveUpOn(game, thing, x, y, base) {
    if (thing === picked) picked = null; // (the clicked one can't be reached: back to choosing)
    const n = (fails.get(thing) || 0) + 1;
    fails.set(thing, n);
    black.set(thing, game.time + Math.min(120, (base || 12) * 2 ** (n - 1)));
    bad = bad.filter((b) => b.until > game.time);
    if (x !== undefined) bad.push({ x, y, until: game.time + 40 });
  }
  // The online HP bar includes everybody's damage, while channel time deliberately pauses the movement watchdog.
  // Neither can prove our attacks work. Track our confirmed zero-damage blows separately (online/world.js), so
  // another hero hitting the monster or consecutive channels cannot keep AUTO on an ineffective target forever.
  // Online our confirmed damage is also the only progress (drive), and a blow the server refuses us (backend
  // hit_refusal.go: a world boss and AUTO, another guild's boss, saves failing...) says so: three and it is given up
  // for a minute (two, the next time), not the ordinary 12 s of a monster that was only hard to reach.
  const REFUSED_GIVE_UP = 3, REFUSED_BAN = 60;
  A.combat = function (game, e, ev, mine) {
    if (A.on && mine && e && ev && !ev.pvp && ev.damage > 0) struck.add(e);
    // (what a cast really lands, online: the server's blows under the skill's id. The look's hits on the monsters' views
    // never reach NC.heroHit's count below (online/world.js answers them first), so every skill learnt 0 hits and fell to
    // the 0.2 floor once cast, and a skill cast less looked worth more: the rotation skewed to one or two keys)
    if (A.on && mine && game && ev && ev.skillId && !ev.dot && !ev.pvp && ev.damage > 0 && pend.size) { const c = pend.get(ev.skillId); if (c && game.time - c.t <= LEARN_T) c.hits++; }
    if (!A.on || !mine || !game || game.mapId !== map || A.target !== e || !hitW || hitW.e !== e || !ev || ev.pvp || !Number.isFinite(ev.damage)) return;
    if (ev.refused) { if (ev.refused !== 'burrowed') hitW.refusedN = (hitW.refusedN || 0) + 1; return; } // (dug in: valid() waits for it)
    if (ev.damage > 0) { hitW.zeroN = 0; hitW.ours = (hitW.ours || 0) + 1; return; } // even our DOT can confirm that this target is taking our damage
    if (ev.damage !== 0 || ev.dot || ev.miss || ev.evade) return;
    if (!hitW.zeroN) hitW.zeroAt = game.time;
    hitW.zeroN = (hitW.zeroN || 0) + 1;
    hitW.zeroLast = game.time;
  };
  const badSpot = (game, x, y) => bad.some((b) => b.until > game.time && dist(b.x, b.y, x, y) < 90);
  // a short side step the freest way (rather towards the goal than away), when re-planning did not free him
  let wig = null;
  function freeRun(game, x, y, a, max) {
    let s = 0;
    while (s < max && game.world.fits(x + Math.cos(a) * (s + 12), y + Math.sin(a) * (s + 12), 22)) s += 12;
    return s;
  }
  function sideDir(game, gx, gy) {
    const p = game.player, ag = Math.atan2(gy - p.y, gx - p.x);
    let best = null, bs = -Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + Math.random() * 0.2, run = freeRun(game, p.x, p.y, a, 144);
      if (run < 24) continue;
      const s = run + 45 * Math.cos(a - ag) + Math.random() * 25;
      if (s > bs) { bs = s; best = a; }
    }
    return best === null ? null : [Math.cos(best) * 100, Math.sin(best) * 100];
  }
  function sideStep(game, gx, gy) {
    const v = sideDir(game, gx, gy);
    if (v) wig = { vx: v[0], vy: v[1], until: game.time + 0.55 };
    return !!v;
  }
  // the cell the hero is pushing into: shut on the grid for 8 s, so the next path goes round it
  function blockAhead(game, gx, gy) {
    const p = game.player, g = grid(game), a = Math.atan2(gy - p.y, gx - p.x);
    const bx = Math.floor((p.x + Math.cos(a) * 34) / G), by = Math.floor((p.y + Math.sin(a) * 34) / G);
    if (bx === Math.floor(p.x / G) && by === Math.floor(p.y / G)) return;
    if (dist(bx * G + G / 2, by * G + G / 2, gx, gy) < G) return; // (not the goal's own cell)
    g.tmp.set(by * g.gw + bx, game.time + 8);
  }
  // Online the server keeps the hero's place, so it is asked instead (2026-10-18: the hop was off online and a hero
  // wedged or shut in had no way out at all). backend unstuck.go moves him only when he really is wedged or in a pocket
  // (else moved:false, quietly); the answer puts him there at once (O.on('event') below). Once every UNSTUCK_WAIT s.
  const UNSTUCK_WAIT = 8;
  let unstuckAt = -Infinity, unstuckHooked = false;
  function askOut(game) {
    const O = NC.Online;
    if (!O || !O.on || !O.action || game.time - unstuckAt < UNSTUCK_WAIT) return false;
    unstuckAt = game.time;
    if (!unstuckHooked) {
      unstuckHooked = true;
      O.on('event', (ev) => {
        const g = NC.game, p = g && g.player;
        if (!ev || ev.type !== 'character' || ev.action !== 'unstuck' || !ev.moved || !p || !Number.isFinite(ev.x) || !Number.isFinite(ev.y)) return;
        if (NC.FX && NC.FX.puff) { NC.FX.puff(p.x, p.y - 30, 8, { speed: 90, size: 0.7 }); NC.FX.puff(ev.x, ev.y - 30, 8, { speed: 90, size: 0.7 }); }
        p.x = ev.x; p.y = ev.y; p.vx = p.vy = 0; path = null; wig = null; prog = null;
        NC.HUD.log('ออโต้ฟาร์ม · พาออกจากจุดติดแล้ว', 'sys');
      });
    }
    return O.action({ action: 'unstuck' }) !== false; // (not the bridge's W.send: nothing of the record changes)
  }
  A.askOut = askOut; // (tests)
  // a hop to the nearest open ground (wedged in a rock after a knock-back, or shut in a pocket): rings out to R
  function hopOut(game, R, ok) {
    if (online()) return askOut(game);
    const p = game.player, w = game.world;
    for (let r = 12; r <= R; r += 12)
      for (let i = 0, n = Math.max(8, Math.round(r / 6)); i < n; i++) {
        const a = (i / n) * TAU, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (!w.fits(x, y, 24) || nearWarp(game, x, y, 1.2) || (ok && !ok(x, y))) continue;
        if (NC.FX && NC.FX.puff) { NC.FX.puff(p.x, p.y - 30, 8, { speed: 90, size: 0.7 }); NC.FX.puff(x, y - 30, 8, { speed: 90, size: 0.7 }); }
        p.x = x; p.y = y; p.vx = p.vy = 0; path = null; wig = null;
        return true;
      }
    return false;
  }
  const wedged = (game, p) => {
    const w = game.world, r = p.r || 20;
    return !w.fits(p.x, p.y, r) || ![[5, 0], [-5, 0], [0, 5], [0, -5]].some(([dx, dy]) => w.fits(p.x + dx, p.y + dy, r));
  };
  // shut in a pocket a knock-back put him in (between a dungeon wall, a telescope and a shelf: a hollow a few steps wide
  // with no way out, Discord #151 / #24): the spots he fits round him, in 8-unit steps, run out before 300. The coarse
  // flood below never saw it (its nearest cell was outside the pocket). The spots, so the hop lands outside them.
  function shutIn(game, p) {
    const w = game.world, S = 8, seen = new Set(['0,0']), q = [[0, 0]];
    for (let h = 0; h < q.length; h++) {
      if (q.length >= 300) return null;
      const [i, j] = q[h];
      for (const [di, dj] of DIRS) {
        const k = (i + di) + ',' + (j + dj);
        if (seen.has(k) || !w.fits(p.x + (i + di) * S, p.y + (j + dj) * S, p.r || 20)) continue;
        seen.add(k); q.push([i + di, j + dj]);
      }
    }
    return (x, y) => seen.has(Math.round((x - p.x) / S) + ',' + Math.round((y - p.y) / S)) || dist(x, y, p.x, p.y) < 40;
  }
  // where a hop out of a pocket may land: out of it, and not in another one (the next hollow along the wall)
  const outOf = (game, pocket) => (x, y) => !pocket(x, y) && !shutIn(game, { x, y, r: 20 });
  // getting nowhere along the route: no 24 units of movement for 1 s, or not 30 units of route progress in 4 s;
  // standing still on purpose (casting, a swing, a dash, sitting) does not count
  let prog = null;
  function progress(game, dt, key, gx, gy, giveUp) {
    const p = game.player, t = game.time;
    if (!prog || prog.key !== key) prog = { key, best: Infinity, bestT: t, pos: [p.x, p.y], posT: t, n: 0, lockT: 0 };
    const P = prog;
    // (a cast bar, sitting, a dash or the side step: wait; a swing or an after-cast pause: 2 s at most until he gets
    // nearer, or a hero casting skill after skill at something out of reach never counted as stuck)
    const holding = p.channel || p.sit || p.dash || (wig && t < wig.until);
    const swinging = !holding && (p.skillLock > 0 || (p.atk && p.atk.on)) && P.lockT < 2;
    if (holding || swinging) { if (swinging) P.lockT += dt; P.posT += dt; P.bestT += dt; return; }
    // Going round a river can increase the direct distance for several seconds.
    // Judge progress along the route we are walking, including its last gap to the goal.
    let d = 0, x = p.x, y = p.y;
    for (let i = pathI; path && i < path.length; i++) { const w = path[i]; d += dist(x, y, w[0], w[1]); x = w[0]; y = w[1]; }
    d += dist(x, y, gx, gy);
    if (d < P.best - 30) {
      P.best = d; P.bestT = t; P.n = 0; P.lockT = 0;
      // A long, working approach is not an attack that keeps missing.
      if (hitW && hitW.e === key) hitW.last = t;
    }
    if (dist(p.x, p.y, P.pos[0], P.pos[1]) > 24) { P.pos = [p.x, p.y]; P.posT = t; }
    if (t - P.posT < 1 && t - P.bestT < 4) return;
    P.pos = [p.x, p.y]; P.posT = t; P.bestT = t; P.n++;
    if (wedged(game, p) && hopOut(game, 160)) return;
    { const pocket = shutIn(game, p); if (pocket && hopOut(game, 420, outOf(game, pocket))) return; }
    path = null; repathT = 0;
    if (P.n === 1) { forceT = t + 3; blockAhead(game, gx, gy); }
    else if (P.n === 2) { forceT = t + 4; blockAhead(game, gx, gy); sideStep(game, gx, gy); }
    else { prog = null; forceT = 0; giveUp(); }
  }

  // ---------------- choosing ----------------
  // (beside a party, grp: the party is the circle, see "farming beside the party")
  const inRange = (x, y) => !!grp || SET.range !== 'near' || !home || dist(x, y, home[0], home[1]) <= radiusOf(SET.radius);
  const farmBoundary = (game) => SET.range === 'near' && !grp && !returning && !(NC.AutoSupport && NC.AutoSupport.active(game)) ? inRange : null;
  // Keep the centre fixed for this AUTO run. A new run (or switching from map to radius) starts at the hero.
  A.area = (game) => {
    if (!game || !game.player || SET.range !== 'near' || (A.on && game.mapId !== map)) return null;
    const c = A.on && home ? home : [game.player.x, game.player.y];
    return { x: c[0], y: c[1], radius: radiusOf(SET.radius), returning };
  };
  function previewRange() {
    previewUntil = Date.now() + 3500;
  }
  A.setRange = function (game, mode, value = SET.radius) {
    if (mode === 'near' && SET.range !== 'near' && A.on) home = [game.player.x, game.player.y];
    SET.range = mode === 'near' ? 'near' : 'map'; SET.radius = radiusOf(value);
    A.target = null; path = null; roam = null; prog = null; wig = null; hitW = null;
    returning = false; chooseT = 0; roamT = 0; forceT = 0;
    black = new Map(); bad = []; fails = new WeakMap();
    saveSet(); previewRange();
  };
  A.rangeControls = (id) => `<div class="af-radius" ${SET.range === 'near' ? '' : 'hidden'}>` +
    `<label for="${id}">รัศมี <output data-radius-value>${radiusOf(SET.radius)}</output> หน่วย</label>` +
    `<input id="${id}" data-auto-radius type="range" min="${MIN_RADIUS}" max="${MAX_RADIUS}" step="${RADIUS_STEP}" value="${radiusOf(SET.radius)}" aria-label="รัศมีออโต้ฟาร์ม" title="เลื่อนแถบหรือ Scroll เพื่อปรับ · ยึดจุดที่เปิด AUTO เป็นศูนย์กลาง และเดินกลับเมื่อหลุดวง">` +
    '<small>เลื่อนแถบหรือ Scroll เพื่อปรับ · ยึดจุดที่เปิด AUTO เป็นศูนย์กลาง และเดินกลับเมื่อหลุดวง</small></div>';
  function hitting(game, e) { // a monster busy with the hero: it hits back whatever its kind
    const p = game.player, s = e.state;
    return (afterMe(game, e) || !e.tgt) && dist(e.x, e.y, p.x, p.y) < 260 && (s === 'chase' || s === 'windup' || s === 'strike' || s === 'hop' || s === 'charge' || s === 'dash');
  }
  function valid(game, e) { // (e.hidden: a burrower underground, js/monkinds.js; online the snapshot's mk.hid)
    if (!(alive(e) && e.state !== 'return' && !e.hidden && !e.dummy && game.enemies.includes(e) && !(black.get(e) > game.time) && !nearWarp(game, e.x, e.y, 1.5) && inRange(e.x, e.y))) return false;
    if (hitting(game, e)) return true;
    if (grp && !nearGroup(e)) return false; // (beside the party: monsters round it only)
    if (grp && afterMate(game, e)) return true; // (a party member under attack: helped, whatever its kind)
    return wanted(e) && !othersFight(game, e) && !badSpot(game, e.x, e.y) && (!supLead || dist(e.x, e.y, supLead.x, supLead.y) < 650); // (a support job: only round its party)
  }
  // ---------------- farming beside the party (2026-10-19) ----------------
  // In a party AUTO used to hunt on its own, far from the others, so the party's threads (js/partybonds.js: within 600, EXP
  // and drops +70% a thread) never formed for it. Now a member stays within GROUP_R of the leader (or the middle of the
  // others when the leader is not on this map), hunts only round the party and helps a member a monster is after; the
  // leader keeps within LEAD_R of the others' middle, so it can still lead the way. The circle round the start spot gives
  // way to the party while it is on this map. Not while the quest's AUTO drives (it hunts where its quest says).
  const GROUP_R = 420, LEAD_R = 640;
  let grp = null; // { x, y, r, lead (a name), mates } this frame
  function groupSpot(game) {
    if (!SET.group || !A.opts.group || (NC.QuestAuto && NC.QuestAuto.on) || picked) return null;
    if (NC.PartySupport && NC.PartySupport.supportMode(game)) return null; // (a support job keeps to its own party rules)
    const p = game.player, m = party(game).filter((q) => !q.dead && dist(q.x, q.y, p.x, p.y) < 2200);
    if (!m.length) return null;
    const lead = m.find((q) => q.lead);
    if (lead) return { x: lead.x, y: lead.y, r: GROUP_R, lead: lead.ref.name || 'หัวตี้', follow: true, key: lead.ref, mates: m };
    const cx = m.reduce((s, q) => s + q.x, 0) / m.length, cy = m.reduce((s, q) => s + q.y, 0) / m.length;
    const mine = !!(NC.PartyNet && NC.PartyNet.isLeader && NC.PartyNet.isLeader());
    return { x: cx, y: cy, r: mine ? LEAD_R : GROUP_R, lead: '', follow: false, mates: m };
  }
  // (Discord #172, 2026-10-21: in a party the hero drifted away from it, out of the party buffs' reach (520 on the server):
  // monsters were taken up to 560 from the spot or 380 from any member, drops up to 1000 from the hero. Now both keep to
  // the party's ring: GROUP_EDGE past its radius, 300 from a member)
  const GROUP_EDGE = 60;
  const nearGroup = (e) => !grp || dist(e.x, e.y, grp.x, grp.y) < grp.r + GROUP_EDGE || grp.mates.some((q) => dist(e.x, e.y, q.x, q.y) < 300);
  // ---------------- the target by a score (2026-10-19) ----------------
  // Before: the nearest one (a monster hitting the hero first). Now its distance, less what makes it worth more: its HP
  // gone (a half-dead one is finished first), its body weak to the hero's element (or plus when it resists), a party
  // member it is after; plus what makes it worse: levels above the hero (an elite counts 5 more), another player
  // beside it (online, not of the party: it is theirs to take), far from the party.
  A.weigh = { hurt: 260, el: 300, immune: 900, lvl: 45, help: 350, crowd: 220, group: 0.6 }; // (in units of distance; tools can try others)
  const isElite = (e) => !!(e.elite || e.champ || (NC.MONSTERS[e.type] && NC.MONSTERS[e.type].eliteOf));
  function others(game) { // other players' heroes on this map (online), not of the party
    const out = [];
    if (!online() || !NC.Net || !NC.Net.remotes) return out;
    const mates = party(game);
    for (const [id, r] of NC.Net.remotes) if (r && r.map === game.mapId && !r.gwHide && !(r.dd || r.dead > 0) && !mates.some((q) => q.id === id)) out.push(r);
    return out;
  }
  function costOf(game, p, e, crowd) {
    let c = dist(e.x, e.y, p.x, p.y);
    if (!A.opts.score) return c;
    const W = A.weigh, max = e.maxHp || 0;
    if (max > 0) c -= Math.max(0, Math.min(1, 1 - e.hp / max)) * W.hurt;
    const el = NC.elementMod ? NC.elementMod((p.d && p.d.atkElement) || null, e.element) : 1;
    c += el <= 0 ? W.immune : (1 - Math.min(el, 2)) * W.el;
    const gap = (e.lv || p.lv) + (isElite(e) ? 5 : 0) - p.lv;
    if (gap > 3) c += (gap - 3) * W.lvl;
    if (grp) {
      if (afterMate(game, e)) c -= W.help;
      c += Math.max(0, dist(e.x, e.y, grp.x, grp.y) - 250) * W.group;
    }
    if (crowd.length && crowd.some((r) => dist(r.x, r.y, e.x, e.y) < 220)) c += W.crowd;
    return c;
  }
  A.costOf = (game, e) => costOf(game, game.player, e, others(game)); // (tests)
  // how near the hero has to be to hit e: a bow or a staff its range, a blade its reach + the monster's size
  const reachOf = (p, e) => { const W = NC.weaponDef(p); return ranged(W) ? Math.min((W.range || 600) * 0.65, 560) : (W.reach || 120) + e.r - 14; };
  let chooseT = 0;
  function choose(game) {
    if (game.time < chooseT) return null;
    const p = game.player;
    const crowd = others(game), cost = new Map();
    const list = game.enemies.filter((e) => valid(game, e));
    for (const e of list) cost.set(e, costOf(game, p, e, crowd));
    list.sort((a, b) => (hitting(game, b) - hitting(game, a)) || cost.get(a) - cost.get(b));
    for (const e of list.slice(0, 5)) {
      if (clear(game, p.x, p.y, e.x, e.y)) return e;
      // a path that ends near enough to hit it (not one that stops at the foot of the ledge it stands on)
      const way = findPath(game, p.x, p.y, e.x, e.y, Infinity, farmBoundary(game));
      if (way && way.gap < reachOf(p, e) * (ranged(NC.weaponDef(p)) ? 0.9 : 1) + 20) return e;
      giveUpOn(game, e, e.x, e.y, 15); // can't get there from here
    }
    chooseT = game.time + 0.4; // (nothing in reach: look again in a moment, not five paths every frame)
    return null;
  }
  // the drop to walk to (within 700): the nearest; sweeping up after a fight (sweep, within SWEEP_R), the nearest counting
  // the drops round it (CLUSTER_W less a drop within 140 of it: one walk there picks them all up, js/items.js pulls drops in from 140)
  const CLUSTER_W = 45;
  let lootLeft = 0, lootBorn = new WeakMap(); // (how many drops are waiting round the hero: the status line · when each was first seen)
  let lootLock = null; // (Discord #184, 2026-10-21: the drop he is walking to, kept till it is picked up or given up)
  let onLoot = null; // { l, t }: since when he stands on the drop he is after
  function lootNear(game, sweep) {
    const p = game.player;
    const gearFull = !!(NC.GEAR && NC.GEAR.room && !NC.GEAR.room(p)); // (a full gear bag: gear can't be taken, js/gearbag.js)
    const ok = [];
    for (const l of game.loot) {
      if (!lootBorn.has(l)) lootBorn.set(l, game.time); // (its age: l.t is held under 0.3 by js/lootfeel.js until it reaches the hero)
      if (NC.LootFeel && NC.LootFeel.coming(l)) continue; // (js/lootfeel.js: it comes to the hero by itself, don't stand and wait)
      if (gearFull && l.inst) continue;
      const d = dist(l.x, l.y, p.x, p.y);
      if (grp && !(dist(l.x, l.y, grp.x, grp.y) < grp.r + GROUP_EDGE + 150 || grp.mates.some((q) => dist(l.x, l.y, q.x, q.y) < 300) || d < 220)) continue; // (#172: the party's ring, its monsters' drops scatter past it)
      if (d < (sweep ? SWEEP_R : 700) && !(black.get(l) > game.time) && !nearWarp(game, l.x, l.y, 1.2) && inRange(l.x, l.y) && !badSpot(game, l.x, l.y)) ok.push([l, d]);
    }
    lootLeft = ok.length;
    if (lootLock && ok.some(([l]) => l === lootLock)) return lootLock; // (#184: the one he is on stays his)
    lootLock = null;
    let best = null, bs = Infinity;
    for (const [l, d] of ok) {
      const s = sweep ? d - CLUSTER_W * ok.filter(([m]) => m !== l && dist(m.x, m.y, l.x, l.y) < 140).length : d;
      if (s < bs) { bs = s; best = l; }
    }
    return (lootLock = best);
  }
  // ---------------- fight first, then the drops (2026-10-19) ----------------
  // The user: "ต้องทำให้มีโหมด ตีก่อน เเล้วค่อยเก็บของด้วยนะ ให้มันฉลาดหน่อย". SET.lootWhen:
  //   'fight' (ตีก่อน แล้วค่อยเก็บ, the default): never off to a drop in the middle of a fight (a monster after the hero,
  //           or the one he is on once his blows have landed: drops at his feet still come to him, js/items.js /
  //           lootfeel.js); between two fights every drop round him (SWEEP_R) is picked up, a few lying together first
  //           (lootNear's sweep), before he takes on the next monster, even a nearer one. A drop lying there OLD_DROP s
  //           (online a drop lasts 2 min) is taken anyway.
  //   'near'  (เก็บทันที, as before): a drop nearer than the next monster is taken first, even from a fight under way.
  // SET.loot false = no drops at all (ไม่เก็บ). (The first try waited for no monster at all within 480 of the hero: on a
  // full map that hardly happened, the fight moved on and the drops were left behind, tools/farmsim.js -45% materials.)
  const SWEEP_R = 1000, OLD_DROP = 90;
  const engaged = (game) => { const e = A.target; return !!(e && alive(e) && (struck.has(e) || afterMe(game, e))); };
  const fightFirst = () => A.opts.loot && SET.lootWhen !== 'near';
  // somewhere to walk when nothing is left to hunt: where the kinds you farm live, far enough from the spots that are
  // waiting to refill (they only come back when the hero is 700 away). The places to choose from are grid cells the hero
  // can really walk to (a flood from where he stands), so a dead end with nothing in sight always has a way out (random
  // points round him, all behind walls, left him standing there). Shut in a pocket with no way out at all (a ring of
  // rocks he was knocked into): a hop to the nearest open ground outside it.
  function flood(game, max) {
    const p = game.player, g = grid(game), W = g.gw;
    nowT = game.time;
    const s = nearestOpen(game, g, Math.floor(p.x / G), Math.floor(p.y / G));
    if (!s) return null;
    const start = s[1] * W + s[0], seen = new Set([start]), q = [start];
    for (let qi = 0; qi < q.length && q.length < max; qi++) {
      const c = q[qi], cx = c % W, cy = Math.floor(c / W), cc = cell(game, g, cx, cy);
      for (let k = 0; k < 8; k++) {
        const dx = DIRS[k][0], dy = DIRS[k][1], nx = cx + dx, ny = cy + dy, ni = ny * W + nx;
        if (seen.has(ni)) continue;
        const cn = cell(game, g, nx, ny);
        if (cn === 2) continue;
        const corner = dx && dy && (cell(game, g, cx + dx, cy) === 2 || cell(game, g, cx, cy + dy) === 2);
        if ((corner || cn === 3 || cc === 3) && !edge(game, g, c, k, ni)) continue;
        seen.add(ni); q.push(ni);
      }
    }
    return { q, seen, W };
  }
  function roamPoint(game) {
    const p = game.player, w = game.world, waiting = game.respawns.filter((r) => !SET.off.includes(r.type));
    const pocket = shutIn(game, p);
    if (pocket) { if (hopOut(game, 420, outOf(game, pocket)) && !online()) NC.HUD.log('ออโต้ฟาร์ม · พาออกจากจุดติดแล้ว', 'sys'); return null; }
    const f = flood(game, 7000);
    if (!f || f.q.length < 30) {
      const inside = (x, y) => f && f.seen.has(Math.floor(y / G) * f.W + Math.floor(x / G));
      if (hopOut(game, 420, (x, y) => !inside(x, y)) && !online()) NC.HUD.log('ออโต้ฟาร์ม · พาออกจากจุดติดแล้ว', 'sys'); // (online: when the server answers)
      return null;
    }
    // (beside the party: round it, the party's leader a little further, so it leads the way)
    const c = grp ? [grp.x, grp.y] : home && SET.range === 'near' ? home : [p.x, p.y];
    const r = grp ? grp.r * 0.9 : SET.range === 'near' ? radiusOf(SET.radius) * 0.9 : 1700;
    let best = null, bs = -Infinity;
    for (let i = 0; i < 48; i++) {
      const [x, y] = standAt(grid(game), f.q[Math.floor(Math.random() * f.q.length)]);
      if (dist(x, y, c[0], c[1]) > r || dist(x, y, p.x, p.y) < 160 || !w.fits(x, y, 24) || nearWarp(game, x, y, 1.6) || badSpot(game, x, y)) continue;
      const free = waiting.filter((q) => dist(q.x, q.y, x, y) > 740).length, alive = game.enemies.filter((e) => wanted(e) && dist(e.x, e.y, x, y) < 700).length;
      const s = free * 2 + alive * 3 - dist(p.x, p.y, x, y) / 900;
      if (s > bs) { bs = s; best = [x, y]; }
    }
    return best;
  }

  // ---------------- the skills on the hotbar ----------------
  const ranged = (W) => W && (W.style === 'arrow' || W.style === 'bolt');
  // the order the slots are tried in: as they are, or (?rotime, js/rotiming.js, the default: most skills have no
  // cooldown) buffs, heals, big spells, zones, summons, utilities and dashes as soon as they are ready, the longest
  // cooldown first (a dash is worth more than its hit: ก้าวเงา makes the next swing a sure critical; ranked by its hit
  // alone the rogue dropped it and farmed 6% slower); then the attack skills by what a cast is worth a busy second, the
  // best first: its damage (the skill's mul at its level x rotiming.js's damage factor x MATK or ATK x its element
  // against the target) x the monsters it lands on, over its cast time + after-cast delay. The ones within 20% of the
  // best take turns, so the bot doesn't press one key alone. A big spell, zone or summon still at its free level
  // (nobody put points in it) is ranked with the attack skills.
  // The monsters a cast lands on: an area spell's circle round the target (or round the hero), a skill with a number of
  // bolts (สายฟ้าฟาด) the ones within 560 of the hero up to that number, another area skill 150 round the target, the
  // rest one; the ones besides the target count 0.7 (spread damage kills later; 1.0 farmed 4% slower). Then the bot
  // learns, skill by skill, how many hits a cast really lands against that count (the two arrows of ยิงคู่, the blast
  // round ลูกไฟ, a rain of arrows on one monster, shots lost on a rock): the hero's hits under the skill's id
  // (NC.heroHit o.sid) in the 3 s after the cast, over the last 20 casts or so.
  // Before (2026-10-18): the skills with a cooldown first, longest first, then the no-cooldown ones in turn. Under the
  // classic timing หอกน้ำแข็ง / สายฟ้าฟาด keep a 1 s cooldown even at their free Lv 1, so the fire mage bot cast its
  // ลูกไฟ Lv 10 zero times and fought with Lv-1 spells, and the knight's magnum Lv 1 went before bash Lv 10.
  // ?oldpick = that order. Measured (tools/farmsim.js, 240 s, Lv 14 / 25 / 55, real and full skill points, two runs a
  // cell, kills a minute over the six cells): knight 34.4 -> 41.3, fire mage 18.3 -> 21.2, ice 18.8 -> 22.0, hybrid
  // 17.3 -> 21.6, archer 34.6 -> 40.0, rogue 31.2 -> 31.0.
  const OLD_PICK = false;
  const PRIO = new Set(['B', 'z', 'm', 'u', 'd', 'h', 'buff']), FREE_RANKED = new Set(['B', 'z', 'm']);
  const LEARN_T = 3;
  // (A.pickW, not A.pick: A.pick is the click-to-hunt function below, and sharing the name turned every skill's worth into
  // NaN, so AUTO only ever cast the first ready slot - 2026-10-19, a Reaper on Discord)
  A.pickW = { others: 0.7, near: 0.8 }; // (the weight of the monsters besides the target · the lead's band; tools can try others)
  const val = (f, lv) => (typeof f === 'function' ? f(lv) : f) || 0;
  const mid = (a) => (Array.isArray(a) ? (a[0] + a[1]) / 2 : a || 0);
  const MAGIC = new Set(['magic', 'heal', 'debuff']);
  function baseOf(p, S) { // (MATK or ATK, as NC.heroHit takes them; the hero's skillMul is common to all)
    const d = p.d || {}, m = mid(d.matk), a = ((d.batk || 0) + mid(d.watk)) * (d.atkMul || 1);
    return S.type === 'best' ? Math.max(m, a) : MAGIC.has(S.type) ? m : a;
  }
  // how many monsters a cast of S at e lands on (the target included, unweighted)
  function landsOn(game, p, e, id, S, lv) {
    if (!e) return 1;
    const AR = NC.CAST_AREA && NC.CAST_AREA[id], n = S.n ? val(S.n, lv) : 0;
    let cx, cy, R;
    if (AR) { const self = AR[0] === 'self'; cx = self ? p.x : e.x; cy = self ? p.y : e.y; R = AR[1] || 200; }
    else if (n) { cx = p.x; cy = p.y; R = 560; }
    else if (S.roClass === 'a') { cx = e.x; cy = e.y; R = 150; }
    else return 1;
    let c = 0;
    for (const m of game.enemies) if (alive(m) && !m.dummy && dist(m.x, m.y, cx, cy) < R + (m.r || 0)) c++;
    return Math.max(1, n ? Math.min(n, c) : c);
  }
  // what the bot learned: id -> { s, n: decaying sums (the last 20 casts or so) of hits ÷ landsOn a cast }
  const learned = new Map(), pend = new Map(); // (pend: the casts still landing, id -> { t, at, hits })
  function closeCast(id) {
    const c = pend.get(id);
    if (!c) return;
    pend.delete(id);
    const L = learned.get(id) || { s: 0, n: 0 };
    L.s = L.s * 0.95 + c.hits / c.at; L.n = L.n * 0.95 + 1;
    learned.set(id, L);
  }
  const ratioOf = (id) => { const L = learned.get(id); return L ? Math.max(0.2, Math.min(8, (1 + L.s) / (1 + L.n))) : 1; };
  function worthOf(game, p, e, id, S, lv) {
    const busy = Math.max(0.3, (NC.castTime ? NC.castTime(p, id, lv) : 0) + (NC.skillAcdOf ? NC.skillAcdOf(p, id) : 0.5));
    // (a skill whose blows are not the hero's hits says what a cast is worth itself, S.autoWorth(p, lv, e, game): the
    // hunter's hawk, skills_v21.js; nothing to learn for it, NC.heroHit never sees its dives)
    if (S.autoWorth) return (S.autoWorth(p, lv, e, game) || 0) / busy;
    const d = p.d || {}, el = e && NC.elementMod ? NC.elementMod(S.element || d.atkElement, e.element) : 1;
    const per = val(S.mul, lv) * ((NC.RO_DMG && NC.RO_DMG[id]) || 1) * baseOf(p, S) * el;
    const hits = (1 + A.pickW.others * (landsOn(game, p, e, id, S, lv) - 1)) * ratioOf(id);
    return (per * hits) / busy;
  }
  let spamTurn = 0, fillIds = new Set();
  function keyOrder(p, game, e) {
    const keys = NC.HOTKEYS || ['q', 'e', 'r', 'f'];
    if (!NC.RO_TIME) return keys;
    if (OLD_PICK) {
      const cdOf = (k) => { const id = NC.skillForKey(p, k), S = id && NC.SKILLS[id]; return S ? NC.skillCdOf(S, NC.skillLv(p, id)) : 0; };
      const big = keys.filter((k) => cdOf(k) > 0).sort((a, b) => cdOf(b) - cdOf(a)), spam = keys.filter((k) => cdOf(k) <= 0);
      const n = spam.length, start = n ? spamTurn % n : 0;
      return big.concat(spam.slice(start), spam.slice(0, start));
    }
    if (game) for (const [id, c] of pend) if (game.time - c.t > LEARN_T) closeCast(id);
    const big = [], fill = [];
    fillIds = new Set();
    for (const k of keys) {
      const id = NC.skillForKey(p, k), S = id && NC.SKILLS[id];
      if (!S) continue;
      const lv = NC.skillLv(p, id), kind = NC.kindOf ? NC.kindOf(S) : S.type === 'buff' ? 'buff' : 'active';
      const cls = kind === 'buff' ? 'buff' : S.heal || S.type === 'heal' ? 'h' : S.roClass, cd = NC.skillCdOf(S, lv);
      const prio = cls ? PRIO.has(cls) && !(FREE_RANKED.has(cls) && lv <= NC.freeSkillLv(id)) : cd > 0;
      if (prio) big.push({ k, cd });
      else { fill.push({ k, w: game ? worthOf(game, p, e, id, S, lv) : 0 }); fillIds.add(id); }
    }
    big.sort((a, b) => b.cd - a.cd);
    fill.sort((a, b) => b.w - a.w);
    // (the lead: within 20% of the best, in turn)
    let n = 0;
    while (n < fill.length && fill[n].w > 0 && fill[n].w >= fill[0].w * A.pickW.near) n++;
    const start = n ? spamTurn % n : 0, lead = fill.slice(0, n);
    return big.concat(lead.slice(start), lead.slice(0, start), fill.slice(n)).map((x) => x.k);
  }
  if (NC.skillCasts) NC.skillCasts.push((game, p, id, lv) => {
    if (!A.on || !game || p !== game.player || !NC.SKILLS[id]) return;
    if (OLD_PICK) { if (!(NC.skillCdOf(NC.SKILLS[id], NC.skillLv(p, id)) > 0)) spamTurn++; return; }
    if (fillIds.has(id)) spamTurn++;
    closeCast(id);
    if (NC.SKILLS[id].autoWorth) return; // (its worth is its own: worthOf)
    const e = alive(A.target) ? A.target : null;
    pend.set(id, { t: game.time, at: landsOn(game, p, e, id, NC.SKILLS[id], lv || NC.skillLv(p, id)), hits: 0 });
  });
  // the hits a cast lands (the hero's, under the skill's id; not the autospell's procs, which carry the spell's id)
  const baseHeroHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const g = NC.game, mine = !!(g && g.player && d === g.player.d); // (checked before: a hook inside may derive a new p.d)
    const r = baseHeroHit.apply(this, arguments);
    if (mine && e && r && r.dmg > 0) struck.add(e);
    if (mine && pend.size && o && o.sid && !g.autoCast && r && !r.miss && r.dmg > 0) { const c = pend.get(o.sid); if (c && g.time - c.t <= LEARN_T) c.hits++; }
    return r;
  };
  A.forget = () => { learned.clear(); pend.clear(); }; // (testing: a fresh start)
  A.skillWorth = (game, p, e) => (NC.HOTKEYS || []).map((k) => { // (testing: what the bot thinks of each slot now)
    const id = NC.skillForKey(p, k), S = id && NC.SKILLS[id];
    return S ? { k, id, lv: NC.skillLv(p, id), worth: +worthOf(game, p, e, id, S, NC.skillLv(p, id)).toFixed(1), lands: landsOn(game, p, e, id, S, NC.skillLv(p, id)), ratio: +ratioOf(id).toFixed(2) } : null;
  }).filter(Boolean);
  // a summon of the skill still out (the wolf, the wyvern, the lantern, the puppet: js/pets.js; online the server's,
  // js/online-pets.js puts them in NC.Pets.list) is not called again: a recast puts a fresh one beside the hero and only
  // spent the cast, the SP and the cooldown. AUTO called the wolf each time its 10 s cooldown ran out, wolf or no wolf
  // (2026-10-21, 0.5.8, the owner: "ออโต้เรียกหมาป่ารัวๆ"). Nearly down or its time nearly up, a new one is worth it.
  const PET_LOW = 0.35, PET_ENDING = 2;
  function petOut(game, p, id) {
    for (const q of (NC.Pets && NC.Pets.list) || []) {
      if (q.owner !== p || q.skill !== id || !(q.hp > 0) || q.dead > 0) continue;
      if (q.maxHp > 0 && q.hp < q.maxHp * PET_LOW) continue;
      if (Number.isFinite(q.until) && q.until - game.time < PET_ENDING) continue;
      return true;
    }
    return false;
  }
  function pickSkill(game, p, e, d, noShot) { // (noShot: a rock or a ledge between them; only buffs and heals)
    if (!SET.skills || game.time < skillT || p.skillLock > 0 || p.channel || p.dash) return null;
    const W = NC.weaponDef(p);
    let heal; // (the SP kept for a heal, looked up on the first attack skill)
    for (const k of keyOrder(p, game, e)) {
      if (SET.slots[k] === false) continue;
      const id = NC.skillForKey(p, k), S = id && NC.SKILLS[id];
      if (!S) continue;
      if (help && help.off && help.off.includes(id)) continue; // (ซัพ+ตี: the support window's own slot switches)
      const supports = NC.Online && (NC.Online.supportsSkill || NC.Online.supports);
      if (online() && supports && !supports.call(NC.Online, id)) continue;
      const lv = NC.skillLv(p, id);
      if ((NC.skillCd ? NC.skillCd(p, id) : p.cd[k]) > 0) continue;
      if (NC.skillCost && p.sp < NC.skillCost(p, id, lv)) continue;
      if (S.need && S.need(game, p, lv) !== true) continue;
      if (NC.skillLocked && NC.skillLocked(p, id)) continue; // (berserk: basic hits only)
      if (petOut(game, p, id)) continue; // (its summon is still out)
      const kind = NC.kindOf ? NC.kindOf(S) : S.type === 'buff' ? 'buff' : 'active';
      if (kind === 'passive') continue;
      if (S.heal || S.type === 'heal') { if (p.hp < p.maxHp * 0.6 || (S.need && id !== 'pr_heal')) return k; continue; }
      // (?rotime: a physical build keeps 20% SP for its cooldown skills — fewer blue potions —; a caster's INT brings SP
      // back fast enough to spam: a reserve only slowed it, measured with tools/farmsim.js)
      const reserve = NC.RO_SP_RESERVE !== undefined ? NC.RO_SP_RESERVE : ((p.d && p.d.int) || 0) >= 50 ? 0 : 0.2;
      if (NC.RO_TIME && kind !== 'buff' && p.sp < p.maxSp * reserve && !(NC.skillCdOf(S, lv) > 0)) continue;
      if (kind === 'buff') { if (!(p.buffs && p.buffs[id] > 0) && e && d < 700) return k; continue; }
      if (noShot) continue; // (every shot would die on the rock: walk round it first)
      if (heal === undefined) heal = healReserve(p);
      if (heal > 0 && p.sp - (NC.skillCost ? NC.skillCost(p, id, lv) || 0 : 0) < heal) continue; // (the heal's SP stays)
      if (help && help.keep > 0 && p.sp - (NC.skillCost ? NC.skillCost(p, id, lv) || 0 : 0) < help.keep) continue; // (ซัพ+ตี: two heals' SP stay)
      // a long area spell waits for a group where it lands: 3 monsters for 1.5–2.5 s of casting (Earth Spikes, Blizzard),
      // 4 for the longest (Meteor, Magnus, 2.5 s+); a boss on its own is worth it too. The bot stood a quarter of its time
      // casting Meteor on one monster (the balance round of 2026-10-04: the 1st-job mage farmed at 0.37 of the others)
      const AR = NC.CAST_AREA && NC.CAST_AREA[id], castT = (NC.CAST_TIMES && NC.CAST_TIMES[id]) || 0;
      if (AR && e && !isBoss(e) && castT >= 1.5) {
        const self = AR[0] === 'self', cx = self ? p.x : e.x, cy = self ? p.y : e.y, R = AR[1] || 200;
        if (game.enemies.filter((m) => alive(m) && !m.dummy && dist(m.x, m.y, cx, cy) < R).length < (castT >= 2.5 ? 4 : 3)) continue;
      }
      // (a long melee reach stops the hero past 300: the steel wire's 300 + the monster's size, and its knockback pushes
      // them further: the skills without their own range waited for a monster to walk in, 2026-10-20 Discord #138)
      if (e && d <= (S.range ? Math.min(S.range * 0.8, 720) : ranged(W) ? 520 : Math.max(300, reachOf(p, e) + 20))) return k;
    }
    return null;
  }

  // a support job in a real party (js/partysupport.js): the heals, the resurrection and the party buffs come first, with
  // or without a monster about (the hero's own buff gone = the party's gone too)
  function pickSupport(game, p) {
    if (!SET.skills || game.time < skillT || p.skillLock > 0 || p.channel || p.dash) return null;
    const PS = NC.PartySupport;
    for (const k of keyOrder(p, game, null)) {
      if (SET.slots[k] === false) continue;
      const id = NC.skillForKey(p, k), S = id && NC.SKILLS[id];
      if (!S) continue;
      const lv = NC.skillLv(p, id);
      if ((NC.skillCd ? NC.skillCd(p, id) : p.cd[k]) > 0) continue;
      if (NC.skillCost && p.sp < NC.skillCost(p, id, lv)) continue;
      if (S.need && S.need(game, p, lv) !== true) continue;
      if (NC.skillLocked && NC.skillLocked(p, id)) continue;
      const kind = NC.kindOf ? NC.kindOf(S) : S.type === 'buff' ? 'buff' : 'active';
      if (S.heal || S.type === 'heal') { if (S.need || p.hp < p.maxHp * 0.6 || PS.needsHeal(game, p)) return k; continue; }
      if (kind === 'buff' && S.party && !(p.buffs && p.buffs[id] > 0) && NC.allies(game).some((a) => a.dead <= 0 && dist(a.x, a.y, p.x, p.y) < 600)) return k;
    }
    return null;
  }
  let supLead = null; // (the party member a support job stays with, this frame)
  let help = null; // (ซัพ+ตี, js/autosupport.js: { x, y, r, name, keep (SP for the heals), off (slots switched off) } this frame)

  // ---------------- driving the hero ----------------
  function say(state, note) { A.state = state; A.note = note || ''; }
  function stop(game, why) {
    if (!A.on) return;
    // (AUTO's own sit ends with it: turned off, the hero sat on, Discord #134 "ปิดแล้ว แต่ยังทำงาน")
    if (sitting && game.player && game.player.sit && NC.Rest) NC.Rest.standUp(game);
    A.on = false; returning = false; A.target = null; picked = null; path = null; roam = null; sitting = false; prog = null; wig = null; hitW = null;
    flee = null; grp = null; mend = false;
    if (NC.ScreenAwake) NC.ScreenAwake.setReason('auto-farm', false);
    if (why) { NC.HUD.log('หยุด' + A.label() + ' · ' + why, 'sys'); game.toast('หยุด' + A.label()); }
    render();
  }
  A.label = () => (NC.AutoSupport && NC.AutoSupport.active(NC.game) ? 'โหมดซัพพอร์ต' : 'ออโต้ฟาร์ม'); // (js/autosupport.js)
  A.stop = (game, why) => stop(game, why); // (js/autosupport.js: off without a word, to walk after a friend across maps)
  NC.Auto.toggle = function (game) {
    if (A.on) { stop(game, 'ปิดเอง'); return; }
    const p = game.player;
    if (!p || p.dead > 0) return;
    A.on = true; returning = false; previewRange(); map = game.mapId; home = [p.x, p.y]; A.target = null; picked = null; path = null; roam = null; roamWait = 0; black = new Map();
    prog = null; wig = null; hitW = null; forceT = 0; chooseT = 0; fails = new WeakMap(); bad = [];
    struck = new WeakSet(); flee = null; mend = false; fleeBlock = 0; hurtLog = []; hpWas = null; grp = null; potLow = false; potSeen = -1; calmT = game.time;
    if (NC.ScreenAwake) NC.ScreenAwake.setReason('auto-farm', true);
    say('หาเป้าหมาย');
    NC.HUD.log('เริ่ม' + A.label() + ' (Z หยุด · เดินเองก็หยุด)', 'sys');
    render();
  };

  // ---------------- picking a target by hand while AUTO runs (2026-10-18) ----------------
  // Any click used to hand control back, so a target could not be picked by hand (RO2: a tap locks the monster and the
  // auto battle goes on). A click on a monster (a tap on a phone, js/mobile.js tapAt) now makes it the next one, whatever
  // its kind and even outside the circle (the circle takes the hero back after it), and AUTO stays on. A click on the
  // ground still hands control back.
  const pickOk = (game, e) => alive(e) && !e.dummy && e.state !== 'return' && game.enemies.includes(e) && !(black.get(e) > game.time);
  A.pick = function (game, e) {
    if (!A.on || !game || !game.player || !alive(e) || e.dummy || !game.enemies.includes(e)) return false;
    if (NC.AutoSupport && NC.AutoSupport.active(game)) return false; // (the support mode follows its party, not a click)
    game.target = e; game.targetT = game.time;
    if (picked === e) return true;
    black.delete(e); // (one given up on before: the player asks for it again)
    picked = e; A.target = e;
    returning = false; path = null; roam = null; prog = null; wig = null; hitW = null; chooseT = 0;
    if (sitting && NC.Rest) { sitting = false; NC.Rest.standUp(game); }
    if (NC.FX && NC.FX.ring) NC.FX.ring(e.x, e.y, 10, 90, '255,216,115', 0.35, 5);
    say('ไล่', nameOf(e.type));
    NC.HUD.log(`${A.label()} · เป้าที่เลือก: ${nameOf(e.type)}`, 'sys');
    render();
    return true;
  };
  A.picked = () => picked; // (tests)
  // the monster drawn under a point of the world (js/game.js's hover box, a little larger for big monsters)
  function monsterAt(game, wx, wy) {
    let best = null, bd = Infinity;
    for (const e of game.enemies) {
      if (!alive(e)) continue;
      const dx = wx - e.x, dy = wy - (e.y - 60), r = Math.max(60, (e.r || 26) * 1.6), s = Math.abs(dx) + Math.abs(dy);
      if (Math.abs(dx) < r && dy > -r * 1.8 && dy < r * 1.3 && s < bd) { bd = s; best = e; }
    }
    return best;
  }
  addEventListener('mousedown', (ev) => {
    const game = NC.game, view = $('view');
    if (ev.button !== 0 || !A.on || !game || !game.player || !view || ev.target !== view || !(game.scale > 0)) return;
    const rect = view.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return;
    const wx = game.cam.x + (ev.clientX - rect.left) * view.width / rect.width / game.scale;
    const wy = game.cam.y + (ev.clientY - rect.top) * view.height / rect.height / game.scale;
    const e = monsterAt(game, wx, wy);
    if (!e || !A.pick(game, e)) return;
    ev.preventDefault(); ev.stopImmediatePropagation(); // (js/game.js would take it as the hero's own swing: AUTO off)
  }, true);

  A.findPath = findPath; // (js/autotravel.js walks the hero across maps on the same paths)
  A.unstick = { sideDir, blockAhead, hopOut, wedged }; // (… and gets out of a stall the same way)
  A.kit = { steer, progress, say, alive, nearWarp: (game, x, y) => nearWarp(game, x, y, 1) }; // (js/autosupport.js walks with them)

  // ---------------- HP, potions, SP (2026-10-19) ----------------
  // the HP lost a second lately (heals and potions don't count), so a burst is seen before the line is crossed
  const HURT_T = 1.5, POT_LEAD = 0.8; // (s: the window · how far ahead a red potion is drunk: its 0.8 s bottle, online a round trip)
  let hurtLog = [], hpWas = null, calmT = 0, potLow = false;
  const REST_CALM = 1.8; // (s without a blow or a cast before AUTO sits online: the server refuses a sit in a fight)
  function hurtRate(game, p) {
    const t = game.time;
    if (hpWas !== null && p.hp < hpWas) hurtLog.push([t, hpWas - p.hp]);
    hpWas = p.hp;
    while (hurtLog.length && hurtLog[0][0] < t - HURT_T) hurtLog.shift();
    let s = 0;
    for (const h of hurtLog) s += h[1];
    return s / HURT_T;
  }
  // a word when the red potions run low and when they are gone (once each, until there are more again; the pop-up only
  // when they ran out during this run, not for a hero who started without any)
  let potSeen = -1;
  function potNotes(game, reds) {
    const had = potSeen;
    potSeen = reds;
    if (!(SET.hpPot > 0) || reds > 5) { potLow = false; return; }
    if (potLow === (reds > 0 ? 'low' : 'out')) return;
    potLow = reds > 0 ? 'low' : 'out';
    const t = reds > 0 ? `ยาแดงเหลือ ${reds} ขวด` : 'ยาแดงหมดแล้ว' + (SET.rest ? ' · จะนั่งพักแทนเมื่อเลือดน้อย' : ' · เปิด "นั่งพัก" ในตั้งค่า AUTO ได้');
    NC.HUD.log('ออโต้ฟาร์ม · ' + t, 'sys');
    if (!reds && had > 0) game.toast(t);
  }
  // the SP a heal on the hotbar needs: attack skills leave it while HP is under 75% (A.opts.sp), so the heal is there
  function healReserve(p) {
    if (!A.opts.sp || p.hp >= p.maxHp * 0.75 || !NC.skillCost) return 0;
    let c = 0;
    for (const k of NC.HOTKEYS || []) {
      if (SET.slots[k] === false) continue;
      const id = NC.skillForKey(p, k), S = id && NC.SKILLS[id];
      if (S && (S.heal || S.type === 'heal') && (!S.need || id === 'pr_heal')) c = Math.max(c, NC.skillCost(p, id, NC.skillLv(p, id)) || 0);
    }
    return c;
  }

  // ---------------- out of a fight going wrong (2026-10-19) ----------------
  // HP under 30% (or falling so fast it is gone in 2 s) and no red potion to drink (none left, or potions off), or with
  // potions under 22% and falling faster than they can bring it back: the hero runs from the monsters after him, the
  // freest way and away from the others (drinking on the way, the bottle every 0.8 s), until none is after him (a monster
  // gives up its chase 1150 from its spot, js/entities.js; and a melee monster that has to wind up its blow mostly swings
  // at air behind a running hero), the potions have him back over 60%, or FLEE_T s have gone by. Without potions he then
  // sits down (whatever the rest switch says: SET.rest is for the ordinary low HP) until HP is back to 70%, and only then
  // fights again. Not again for FLEE_WAIT s if it did not get him out. A boss fight and a clicked monster are fought out.
  // (The first try, 2026-10-19, ran for 2.5 s and fought on: tools/farmsim.js runs without potions died as often as
  // before and killed up to 35% slower, since nothing came back in those 2.5 s.)
  const FLEE_T = 9, FLEE_WAIT = 6, MEND_TO = 0.7;
  let flee = null, fleeBlock = 0, mend = false; // (mend: the sit after a flight, until HP is back to MEND_TO)
  function fleeDir(game, p, foes) {
    const cx = foes.reduce((s, e) => s + e.x, 0) / foes.length, cy = foes.reduce((s, e) => s + e.y, 0) / foes.length;
    const away = Math.atan2(p.y - cy, p.x - cx);
    let best = null, bs = -Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, run = freeRun(game, p.x, p.y, a, 216);
      if (run < 36) continue;
      const x = p.x + Math.cos(a) * run, y = p.y + Math.sin(a) * run;
      if (nearWarp(game, x, y, 1.3)) continue; // (never off the map by a warp)
      const more = game.enemies.filter((e) => alive(e) && !e.dummy && !foes.includes(e) && dist(e.x, e.y, x, y) < 260).length;
      const s = run + 150 * Math.cos(a - away) - 90 * more;
      if (s > bs) { bs = s; best = a; }
    }
    return best === null ? null : [Math.cos(best) * 100, Math.sin(best) * 100];
  }
  function fleeStep(game, p, reds, rate, out) {
    if (!SET.flee || !A.opts.flee || picked) { flee = null; mend = false; return false; }
    const t = game.time, f = p.hp / p.maxHp, potion = SET.hpPot > 0 && reds > 0;
    const foes = game.enemies.filter((e) => alive(e) && !e.dummy && dist(e.x, e.y, p.x, p.y) < 600 && (afterMe(game, e) || hitting(game, e)));
    if (flee && !foes.length) { flee = null; mend = !potion; path = null; prog = null; } // (out of it: without potions, sit down)
    else if (flee && potion && f > 0.6) { flee = null; path = null; prog = null; } // (the potions brought him back up)
    else if (flee && t > flee.until) { flee = null; fleeBlock = t + FLEE_WAIT; path = null; prog = null; } // (still chased: fight)
    // without potions: under 30%, or gone in 2 s at this rate; with potions: under 22% and gone in 1.5 s (they can't keep up)
    const lost = potion ? f < 0.22 && p.hp < rate * 1.5 : f < 0.3 || p.hp < rate * 2;
    // (a monster coming at him while he sits it out: away again at once; it stood him up to swing once and sat him down
    // again, 2026-10-20 Discord #134 "ตีทีเดียวแล้วนั่ง")
    if (!flee && (!mend || foes.length) && t > fleeBlock && foes.length && !foes.some(isBoss) && lost) {
      flee = { until: t + FLEE_T, v: null, at: -1 }; mend = false;
      A.target = null; hitW = null; path = null; prog = null;
      if (sitting && NC.Rest) { sitting = false; NC.Rest.standUp(game); }
      NC.HUD.log('ออโต้ฟาร์ม · ' + (potion ? 'เลือดลดเร็วกว่ายา ถอยออกมาก่อน' : 'เลือดน้อยและไม่มียา ถอยออกไปพักก่อน'), 'sys');
    }
    if (!flee) return false;
    if (!flee.v || t - flee.at > 0.5) { flee.v = fleeDir(game, p, foes) || flee.v; flee.at = t; } // (looked at again twice a second)
    if (flee.v) { const v = avoid(game, flee.v[0], flee.v[1]); out.mx = v[0]; out.my = v[1]; }
    out.key = pickSkill(game, p, null, 0, true); // (a heal on the way; never an attack)
    if (out.key) skillT = t + 0.45;
    say('ถอย', `HP ${Math.round(f * 100)}%` + (potion ? ' · ดื่มยาไปด้วย' : ' · ไม่มียา'));
    return true;
  }



  function drive(game, dt) {
    const p = game.player, I = game.input, out = { mx: 0, my: 0, attack: false, aim: null, key: null };
    // the hands the hero keeps for himself: potions whatever else is going on
    // (every size counts: js/potions.js picks the one that fits)
    const reds = NC.POT ? NC.POT.count(p, 'red') : p.potions, blues = NC.POT ? NC.POT.count(p, 'blue') : p.spPotions;
    // (A.opts.pot: also when HP falls so fast it will be under the line by the time a bottle works: a burst drinks sooner)
    const rate = hurtRate(game, p), hpLine = p.maxHp * SET.hpPot;
    if (SET.hpPot > 0 && reds > 0 && p.cd.pot <= 0 && (p.hp < hpLine || (A.opts.pot && rate > 0 && p.hp - rate * POT_LEAD < hpLine))) I.potion = true;
    if (SET.spPot > 0 && p.sp < p.maxSp * SET.spPot && blues > 0 && p.cd.sppot <= 0) I.sppotion = true;
    potNotes(game, reds);
    const threat = game.enemies.some((e) => alive(e) && dist(e.x, e.y, p.x, p.y) < 420 && (afterMe(game, e) || hitting(game, e)));
    if (threat || p.atk.on || p.skillLock > 0 || p.channel) calmT = game.time;
    // the support mode (js/autosupport.js): follow the locked party member, support skills only, never a swing; with its
    // ซัพ+ตี switch, a frame with nothing to support comes back here with out.fight = the friend's spot: fight round them
    help = null;
    if (NC.AutoSupport && NC.AutoSupport.active(game)) {
      NC.AutoSupport.drive(game, dt, out, threat);
      if (!out.fight) return out;
      help = out.fight; delete out.fight;
    }
    // the monster the player clicked: hunted until it dies or can't be reached, even outside the circle (A.pick)
    if (picked && !pickOk(game, picked)) picked = null;
    grp = help ? { x: help.x, y: help.y, r: help.r, lead: help.name, follow: false, mates: party(game) } : groupSpot(game); // (beside the party: its spot for this frame, or null)
    // a fight going wrong (HP low and falling, no potion to keep up): out of it first, wherever the circle is
    if (fleeStep(game, p, reds, rate, out)) { returning = false; return out; }
    // A knockback, a dodge or a smaller radius can put us outside. Walk back before choosing any target.
    // Stay in return mode until safely inside, so the edge cannot alternate between chasing and returning.
    // (Not while he gets his HP back after a flight: he sits where he got away to, then walks back.)
    if (SET.range === 'near' && home && !picked && !grp && !mend) {
      const d = dist(p.x, p.y, home[0], home[1]), r = radiusOf(SET.radius);
      if (!returning && d > r) {
        returning = true; A.target = null; path = null; roam = null; wig = null; prog = null; hitW = null;
        if (p.sit && NC.Rest) NC.Rest.standUp(game);
        sitting = false;
      }
      if (returning && d <= r - Math.min(100, r * .25)) { returning = false; path = null; prog = null; wig = null; }
      if (returning) {
        const v = steer(game, home[0], home[1], dt);
        if (v) { out.mx = v[0]; out.my = v[1]; progress(game, dt, home, home[0], home[1], () => { path = null; }); }
        say('กลับเข้าวง', 'รัศมี ' + r);
        return out;
      }
    } else returning = false;
    // resting: sit when HP (without potions) or SP is low and nothing is near; stand up full or when something comes
    if (sitting && !p.sit) { sitting = false; restBlock = game.time + 12; mend = false; } // stood up by the player (X): farm on for a while
    // (online too since 2026-10-19: the sit goes to the server, online/extras.js, which refuses it while the hero is still
    // fighting, so he sits only after REST_CALM s of calm. No red potion to drink: no new fight under 45% HP either, was 35%)
    // (mend: the sit after a flight, out of a fight gone wrong, whatever SET.rest says; up again at MEND_TO)
    if (mend && (threat || p.hp >= p.maxHp * MEND_TO)) { mend = false; if (sitting && NC.Rest) { sitting = false; NC.Rest.standUp(game); } }
    if ((SET.rest || mend) && NC.Rest) {
      const lowHp = mend || (p.hp < p.maxHp * (A.opts.pot ? 0.45 : 0.35) && !(SET.hpPot > 0 && reds > 0)), lowSp = SET.skills && p.sp < p.maxSp * 0.12 && !(SET.spPot > 0 && blues > 0);
      if (!sitting && !threat && (lowHp || lowSp) && !p.atk.on && (mend || game.time > restBlock) && game.time - calmT > (online() ? REST_CALM : 0)) { sitting = true; NC.Rest.sitDown(game); }
      if (sitting) {
        if (threat || (!mend && p.hp >= p.maxHp * 0.9 && (!SET.skills || p.sp >= p.maxSp * 0.7))) { sitting = false; NC.Rest.standUp(game); }
        else { say('นั่งพัก', `HP ${Math.round((100 * p.hp) / p.maxHp)}% · SP ${Math.round((100 * p.sp) / p.maxSp)}%`); return out; }
      }
      if (mend && !threat) { say('พักฟื้น', `HP ${Math.round((100 * p.hp) / p.maxHp)}%`); return out; } // (online: the calm before the sit)
    }
    // a support job in a party: heal / raise / buff first, stay with the party, fight only round it
    const sup = !help && !!(NC.PartySupport && NC.PartySupport.supportMode(game));
    supLead = sup ? NC.PartySupport.lead(game) : null;
    if (sup) {
      const key = pickSupport(game, p);
      if (key) { out.key = key; skillT = game.time + 0.45; say('ซัพพอร์ต', 'ฮีล · ชุบ · บัฟปาร์ตี้'); return out; }
      if (supLead && supLead.d > 420 && inRange(supLead.x, supLead.y)) {
        A.target = null;
        const v = steer(game, supLead.x, supLead.y, dt);
        if (v) { out.mx = v[0]; out.my = v[1]; progress(game, dt, supLead.who, supLead.x, supLead.y, () => {}); }
        say('ตามปาร์ตี้', supLead.who.name);
        return out;
      }
    }
    // the target: the clicked one, else kept while it is still worth it, else the next one
    if (picked) A.target = picked;
    if (A.target && A.target !== picked && !valid(game, A.target)) A.target = null;
    // the drops: after the fight round the hero (fightFirst, unless one has lain there long), or (เก็บทันที) when one is
    // nearer than the next monster
    // (the threat gate is ตีก่อน's alone: with it on เก็บทันที too, solo every monster after the hero kept every drop
    // waiting, while in a party the monsters were after the others and drops were taken at once - Discord #109, 2026-10-20)
    // (Discord #172, 2026-10-21: ตีก่อน also counts a monster after a party member round him: he left their fight for drops)
    const mateFight = !!grp && fightFirst() && game.enemies.some((e) => alive(e) && afterMate(game, e) && dist(e.x, e.y, p.x, p.y) < 600);
    let loot = SET.loot && (!threat || !fightFirst()) && !picked ? lootNear(game, fightFirst()) : null;
    const oldLoot = loot && game.time - (lootBorn.get(loot) || game.time) > OLD_DROP;
    if (loot && fightFirst() && !oldLoot && engaged(game)) loot = null;
    if (loot && mateFight && !oldLoot && dist(loot.x, loot.y, p.x, p.y) > 150) loot = null; // (at his feet: taken on the way)
    if (!loot) lootLock = null;
    if (!A.target && !loot) A.target = choose(game);
    const e = A.target;
    if (loot && (fightFirst() || !e || dist(loot.x, loot.y, p.x, p.y) < dist(e.x, e.y, p.x, p.y))) {
      // standing on a drop that never comes (online: where the server's hero can't reach it) is given up on after 4 s,
      // not stood on while the pickup is refused over and over (Discord #184 / #187, 2026-10-21)
      if (dist(loot.x, loot.y, p.x, p.y) < 100) {
        if (!onLoot || onLoot.l !== loot) onLoot = { l: loot, t: game.time };
        else if (game.time - onLoot.t > 4) { giveUpOn(game, loot, loot.x, loot.y, 30); lootLock = null; onLoot = null; return out; }
      } else if (onLoot && onLoot.l === loot) onLoot = null;
      const v = steer(game, loot.x, loot.y, dt);
      if (!v) giveUpOn(game, loot, loot.x, loot.y, 20);
      else { out.mx = v[0]; out.my = v[1]; progress(game, dt, loot, loot.x, loot.y, () => giveUpOn(game, loot, loot.x, loot.y, 20)); }
      say('เก็บของ', lootLeft > 1 ? `อีก ${lootLeft} ชิ้น` : '');
      return out;
    }
    if (e) {
      roam = null;
      game.target = e; game.targetT = game.time;
      const W = NC.weaponDef(p), d = dist(p.x, p.y - 30, e.x, e.y - 30), reach = reachOf(p, e);
      // Prediction can put the hero ahead of the server, and monsters are drawn behind their last snapshot.
      // Keep approaching until both views are in reach; starting the swing only in the drawn view hits air online.
      const live = NC.OnlineWorld, snapshot = online() && live && live.ready && live.snap && live.snap.mapId === game.mapId && e.online ? live.snap.self : null;
      const serverEnemy = snapshot ? { x: Number.isFinite(e.tx) ? e.tx : e.x, y: Number.isFinite(e.ty) ? e.ty : e.y } : e;
      const tooFar = d > reach || !!(snapshot && dist(snapshot.x, snapshot.y, serverEnemy.x, serverEnemy.y) > reach);
      // a bow or a staff (or a skill thrown from afar) only hits along a clear line: with a rock, a trunk or a ledge in
      // between, every shot dies on it, so the hero walks on round it instead of standing there shooting the rock
      const noShot = online() ? !attackClear(game, p, e) || !!(snapshot && !attackClear(game, snapshot, serverEnemy)) : (ranged(W) || d > reach) && !shotClear(game, p, e);
      // hits that never land (shots lost on something the line test missed, a swing that can't connect): after 5 s
      // the hero tries from somewhere else, after 10 s another monster (a long cast does not count)
      // (and whatever the reason, 15 s on one monster without taking any of its HP = another monster; a boss 40 s)
      // (online the HP bar falls under everybody's blows: there only our own confirmed damage, A.combat, is progress)
      if (!hitW || hitW.e !== e) hitW = { e, hp: e.hp, t: game.time, n: 0, moveT: 0, last: game.time, ours: 0, seen: 0 };
      if (online() ? hitW.ours > hitW.seen : e.hp < hitW.hp) { hitW.seen = hitW.ours; hitW.t = game.time; hitW.n = 0; hitW.last = game.time; }
      hitW.hp = e.hp; // (it healed: count from there)
      if (hitW.refusedN >= REFUSED_GIVE_UP) { // the server will not let our blows land on it: not tried again for a while
        giveUpOn(game, e, undefined, undefined, REFUSED_BAN); A.target = null; hitW = null; say('เปลี่ยนเป้า', 'ตีไม่เข้า'); return out;
      }
      if (p.channel || p.sit) hitW.last += dt;
      // Require repeated confirmed failures over time: one multi-hit burst must not interrupt the next long cast.
      const zeroStreak = hitW.zeroN >= 10 && hitW.zeroLast - hitW.zeroAt >= (isBoss(e) ? 40 : 5);
      if (zeroStreak || game.time - hitW.last > (isBoss(e) ? 40 : 15)) { giveUpOn(game, e, e.x, e.y, 12); A.target = null; hitW = null; say('เปลี่ยนเป้า', 'ตีไม่โดน'); return out; }
      if (p.channel || p.sit || tooFar || noShot) hitW.t += dt;
      else if (game.time - hitW.t > 5) {
        hitW.t = game.time; hitW.n++;
        if (hitW.n >= (isBoss(e) ? 4 : 2)) { giveUpOn(game, e, e.x, e.y, 12); A.target = null; hitW = null; say('เปลี่ยนเป้า', 'ตีไม่โดน'); return out; }
        if (d > 90) { hitW.moveT = game.time + 1.6; forceT = game.time + 1.6; path = null; } // nearer, on the grid path
        else sideStep(game, e.x, e.y);
      }
      out.aim = [e.x, e.y - 50];
      out.key = pickSkill(game, p, e, d, noShot);
      if (out.key) skillT = game.time + 0.45;
      if (tooFar || noShot || game.time < hitW.moveT) {
        const v = steer(game, e.x, e.y, dt);
        if (!v) { giveUpOn(game, e, e.x, e.y, 15); A.target = null; return out; }
        out.mx = v[0]; out.my = v[1];
        progress(game, dt, e, e.x, e.y, () => { giveUpOn(game, e, e.x, e.y, 12); A.target = null; });
        say('ไล่', nameOf(e.type) + (noShot && d <= reach ? ' · อ้อมสิ่งกีดขวาง' : ''));
      } else {
        prog = null;
        out.attack = !out.key;
        say('ตี', nameOf(e.type));
      }
      return out;
    }
    // nothing to hunt here: walk to where monsters live, now and then a look round (a support job waits by the party)
    if (help) { say('ซัพพอร์ต', 'รอมอนรอบ ' + help.name); return out; } // (ซัพ+ตี: the support mode's follow keeps him by them)
    if (sup) { say('เฝ้าปาร์ตี้', supLead ? supLead.who.name : ''); return out; }
    // beside the party with its leader here: keep up with the leader (the leader, or a party without one here, looks
    // round the party's spot below)
    if (grp && grp.follow) {
      roam = null;
      const d = dist(p.x, p.y, grp.x, grp.y);
      if (d > 170) {
        const v = steer(game, grp.x, grp.y, dt);
        if (v) { out.mx = v[0]; out.my = v[1]; }
        // (no way found counts as getting nowhere too: the stall ladder's side step and hop, never standing there for good)
        progress(game, dt, grp.key, grp.x, grp.y, () => { path = null; });
      } else prog = null;
      say('เกาะกลุ่มตี้', grp.lead);
      return out;
    }
    if (!roam || roamWait > 0) {
      roamWait -= dt;
      if ((roamWait <= 0 || !roam) && game.time >= roamT) { roam = roamPoint(game); roamWait = 0; if (!roam) roamT = game.time + 1; }
    }
    if (roam) {
      const R = roam;
      if (dist(p.x, p.y, R[0], R[1]) < 60) { roam = null; roamWait = 1.2; }
      else {
        const v = steer(game, R[0], R[1], dt);
        if (!v) { bad.push({ x: R[0], y: R[1], until: game.time + 40 }); roam = null; }
        else { out.mx = v[0]; out.my = v[1]; progress(game, dt, R, R[0], R[1], () => { bad.push({ x: R[0], y: R[1], until: game.time + 40 }); roam = null; }); }
      }
    }
    say('หาเป้าหมาย', grp ? 'รอบปาร์ตี้' : SET.off.length ? 'เฉพาะชนิดที่เลือก' : '');
    return out;
  }

  const baseUpdate = NC.updatePlayer;
  // Authoritative online play consumes the same decisions as input intents only.
  A.intent = function (game, dt) {
    if (!A.on) return null;
    if (game.player.dead > 0) { stop(game, 'หมดแรง'); return null; }
    if (game.mapId !== map) { stop(game, 'เปลี่ยนแมพ'); return null; }
    if (game.input.mx || game.input.my || game.mouse.down) { stop(game, 'ควบคุมเอง'); return null; }
    return intent(game, dt);
  };
  A.stop = stop;
  NC.updatePlayer = function (game, dt) {
    if (!A.on) return baseUpdate.apply(this, arguments);
    const p = game.player, I = game.input, M = game.mouse;
    if (p.dead > 0) { stop(game, 'หมดแรง'); return baseUpdate.apply(this, arguments); }
    if (game.mapId !== map) { stop(game, 'เปลี่ยนแมพ'); return baseUpdate.apply(this, arguments); }
    if (I.mx || I.my || M.down) { stop(game, 'ควบคุมเอง'); return baseUpdate.apply(this, arguments); }
    const o = intent(game, dt);
    const l = Math.hypot(o.mx, o.my);
    I.mx = l > 1 ? o.mx / l : 0; I.my = l > 1 ? o.my / l : 0;
    if (o.attack) I.attack = true;
    if (o.key) I[o.key] = true;
    // the hero looks (and swings, and casts) at the target for this update: the mouse is pointed there and put back
    const keep = o.aim && { wx: M.wx, wy: M.wy, active: M.active };
    if (o.aim) { M.wx = o.aim[0]; M.wy = o.aim[1]; M.active = true; }
    try { return baseUpdate.apply(this, arguments); }
    finally { if (keep) { M.wx = keep.wx; M.wy = keep.wy; M.active = keep.active; } }
  };
  function intent(game, dt) {
    nowT = game.time;
    const p = game.player, o = drive(game, dt);
    // (a side step out of a stall overrides the rest for its half second)
    if (wig && game.time < wig.until) { o.mx = wig.vx; o.my = wig.vy; o.attack = false; o.key = null; }
    else wig = null;
    // (a cast bar filling: standing still, or the cast is dropped - js/casting.js cancels it on a new way of the keys, the
    // server too, casting.go castStepOff. Following the party's leader (js/autosupport.js), walking to loot or after a monster
    // dropped every heal / buff half way, Discord #139. Only a monster's skill warning below still moves him)
    if (p.casting) { o.mx = o.my = 0; }
    // (a monster's skill warning on the ground (js/monskills.js): step out of it first, as a player paying attention would)
    const out = NC.MonSkills && NC.MonSkills.escape && NC.MonSkills.escape(p);
    if (out) { o.mx = out[0] * 100; o.my = out[1] * 100; o.attack = false; o.key = null; }
    // A detour or dodge may go away from the target. Face the route while moving;
    // keep the target aim for a swing or a cast, so the hero does not run backwards.
    if (Math.hypot(o.mx, o.my) > 1 && !o.attack && !o.key && !p.channel && !(p.atk && p.atk.on) && !(p.skillLock > 0)) {
      o.aim = [p.x + o.mx, p.y - 50 + o.my];
    }
    return o;
  }

  // Draw in world coordinates on the ground layer, beneath characters and props.
  if (NC.FX && NC.FX.draw) {
    const baseFx = NC.FX.draw;
    NC.FX.draw = function (ctx, layer) {
      baseFx.apply(this, arguments);
      const game = NC.game, area = A.on && grp ? { x: grp.x, y: grp.y, radius: grp.r + GROUP_EDGE } : A.area(game); // (in a party: its ring, Discord #172)
      if (layer !== 'low' || !area || (NC.AutoSupport && NC.AutoSupport.active(game)) ||
          (!returning && !(win && !win.hidden) && Date.now() > previewUntil)) return;
      ctx.save();
      ctx.beginPath(); ctx.arc(area.x, area.y, area.radius, 0, TAU);
      ctx.fillStyle = 'rgba(102, 198, 255, 0.08)'; ctx.fill();
      ctx.strokeStyle = '#172e4a'; ctx.lineWidth = 7; ctx.stroke();
      ctx.setLineDash([18, 12]); ctx.strokeStyle = returning ? '#ffdb83' : '#88dcff'; ctx.lineWidth = 4; ctx.stroke();
      ctx.setLineDash([]); ctx.beginPath(); ctx.arc(area.x, area.y, 8, 0, TAU);
      ctx.fillStyle = '#b2eaff'; ctx.fill(); ctx.restore();
    };
  }

  // ---------------- the lock mark over the target ----------------
  const baseBar = NC.drawEnemyBar;
  NC.drawEnemyBar = function (ctx, e, game) {
    baseBar(ctx, e, game);
    if (!A.on || e !== A.target || !alive(e)) return;
    const s = NC.SPR.ic_lock, y = NC.labelTop(e) - 62 + Math.sin(game.time * 5) * 4, S = 40;
    if (s) { ctx.save(); ctx.translate(e.x, y); ctx.rotate(Math.sin(game.time * 2) * 0.15); ctx.drawImage(s.img, -S / 2, -S / 2, S, S); ctx.restore(); }
  };

  // ---------------- the HUD: the button, the status line, the settings ----------------
  let win = null, box = null;
  const icon = (n) => ((NC.ASSET_MANIFEST_AUTO || {})[n] || {}).src || '';
  function speciesHere(game) {
    const m = (seen[game.mapId] = seen[game.mapId] || new Set());
    for (const e of game.enemies) if (e.type) m.add(e.type);
    for (const r of game.respawns) if (r.type) m.add(r.type);
    return [...m].filter((t) => NC.MONSTERS[t]).sort((a, b) => (isBoss({ type: a }) - isBoss({ type: b })) || nameOf(a).localeCompare(nameOf(b), 'th'));
  }
  function thumb(cv, type) {
    const s = NC.SPR[type], c = cv.getContext('2d'), S = cv.width;
    c.clearRect(0, 0, S, S);
    if (!s) return;
    const k = Math.min((S * 0.9) / s.img.width, (S * 0.9) / s.img.height);
    c.drawImage(s.img, (S - s.img.width * k) / 2, (S - s.img.height * k) / 2, s.img.width * k, s.img.height * k);
  }
  function lvRange(game, type) {
    const lv = game.enemies.filter((e) => e.type === type).map((e) => e.lv);
    return lv.length ? (Math.min(...lv) === Math.max(...lv) ? 'Lv ' + lv[0] : `Lv ${Math.min(...lv)}–${Math.max(...lv)}`) : '';
  }
  function build(game) {
    box = document.createElement('div');
    box.className = 'af'; box.id = 'af';
    box.innerHTML = `<button class="af-btn" id="af-btn" title="ออโต้ฟาร์ม (Z)"><img src="${icon('ic_auto')}" alt=""><b>AUTO</b></button>` +
      '<button class="af-set" id="af-set" title="ตั้งค่าออโต้ฟาร์ม">ตั้งค่า</button>' +
      '<div class="af-indicators"><div class="af-state" id="af-state"></div><span id="af-wake" class="af-wake" role="status" hidden></span></div>';
    $('hud').appendChild(box);
    $('af-btn').addEventListener('click', () => NC.Auto.toggle(game));
    $('af-set').addEventListener('click', () => { game.paused = NC.HUD.panel('autofarm', true); });
    win = document.createElement('div');
    win.id = 'autofarm'; win.className = 'panel'; win.hidden = true;
    win.innerHTML = '<div class="card autofarm"><div class="ptitle"><span>ออโต้ฟาร์ม</span><button class="af-onoff" id="af-onoff"></button>' +
      '<button id="af-close" aria-label="ปิด">✕</button></div><div id="af-body"></div>' +
      '<section class="af-wake-settings" aria-labelledby="af-wake-title"><h3 id="af-wake-title">เปิดจอค้างขณะออโต้ฟาร์ม</h3>' +
      '<p id="af-wake-message" role="status"></p><button id="af-wake-retry" type="button" hidden>ลองเปิดจอค้างอีกครั้ง</button>' +
      '<p class="af-wake-help">ขอเปิดจอค้างอัตโนมัติเมื่อเริ่มฟาร์ม และคืนค่าเมื่อหยุด · ต้องเปิดหน้าเกมไว้ ระบบอาจยกเลิกเมื่อแบตต่ำหรือเปิดโหมดประหยัดพลังงาน</p></section>' +
      '<div class="st-note">กด <b>Z</b> หรือปุ่ม AUTO เปิด/ปิด · เดินเอง (WASD) คลิกตีเอง เปลี่ยนแมพ หรือหมดแรง = หยุด · สู้กลับมอนในขอบเขตที่เลือก</div></div>';
    document.body.appendChild(win);
    $('af-close').addEventListener('click', () => { NC.HUD.panel('autofarm', false); game.paused = false; });
    $('af-onoff').addEventListener('click', () => { NC.Auto.toggle(game); renderWin(); });
    $('af-wake-retry').addEventListener('click', () => { if (A.on && NC.ScreenAwake) NC.ScreenAwake.retry(); });
    if (NC.ScreenAwake) NC.ScreenAwake.subscribe(renderWake);
    // Do not rebuild the panel on input: native dragging and keyboard focus must survive each change.
    const adjustRadius = (value) => {
      A.setRange(game, 'near', value);
      for (const el of win.querySelectorAll('[data-auto-radius]')) el.value = SET.radius;
      for (const el of win.querySelectorAll('[data-radius-value]')) el.textContent = SET.radius;
      win.classList.add('af-previewing');
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => win.classList.remove('af-previewing'), 1400);
    };
    win.addEventListener('input', (ev) => { if (ev.target.matches('[data-auto-radius]')) adjustRadius(ev.target.value); });
    win.addEventListener('wheel', (ev) => {
      if (!ev.target.matches('[data-auto-radius]') || !ev.deltaY) return;
      ev.preventDefault(); ev.stopPropagation();
      adjustRadius(radiusOf(SET.radius) + (ev.deltaY < 0 ? RADIUS_STEP : -RADIUS_STEP));
    }, { passive: false });
    win.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.mon) { const i = SET.off.indexOf(d.mon); if (i >= 0) SET.off.splice(i, 1); else SET.off.push(d.mon); }
      else if (d.all) { if (d.all === 'on') SET.off = SET.off.filter((t) => !speciesHere(game).includes(t)); else for (const t of speciesHere(game)) if (!isBoss({ type: t }) && !SET.off.includes(t)) SET.off.push(t); }
      else if (d.boss) SET.boss = !SET.boss;
      else if (d.range) A.setRange(game, d.range);
      else if (d.skills) SET.skills = !SET.skills;
      else if (d.slot) SET.slots[d.slot] = SET.slots[d.slot] === false;
      else if (d.hp) SET.hpPot = Number(d.hp);
      else if (d.sp) SET.spPot = Number(d.sp);
      else if (d.rest) SET.rest = !SET.rest;
      else if (d.loot) SET.loot = !SET.loot;
      else if (d.lootw) { SET.loot = d.lootw !== 'off'; if (SET.loot) SET.lootWhen = d.lootw === 'near' ? 'near' : 'fight'; }
      else if (d.share) SET.share = !SET.share;
      else if (d.group) SET.group = !SET.group;
      else if (d.flee) SET.flee = !SET.flee;
      else return;
      saveSet(); renderWin();
    });
  }
  const chip = (on, attrs, html, cls) => `<button class="af-chip${on ? ' on' : ''}${cls ? ' ' + cls : ''}" ${attrs}>${html}</button>`;
  function renderWake() {
    const badge = $('af-wake');
    if (!badge) return;
    const state = NC.ScreenAwake ? NC.ScreenAwake.getState() : { active: false, status: 'unsupported', message: 'เบราว์เซอร์นี้ไม่รองรับการเปิดจอค้าง' };
    badge.hidden = !A.on;
    badge.dataset.status = state.active ? 'active' : 'inactive';
    badge.textContent = state.active ? 'จอเปิดค้าง' : state.status === 'requesting' ? 'กำลังขอเปิดจอค้าง…' : 'จออาจดับ · ดูตั้งค่า AUTO';
    $('af-wake-message').textContent = A.on ? state.message : 'เริ่มออโต้ฟาร์มเพื่อเปิดจอค้าง';
    $('af-wake-retry').hidden = !A.on || !['denied', 'released'].includes(state.status);
  }
  function renderWin() {
    if (!win || win.hidden) return;
    const game = NC.game, p = game.player, kinds = speciesHere(game);
    $('af-onoff').textContent = A.on ? 'กำลังทำงาน · กดเพื่อหยุด' : 'ปิดอยู่ · กดเพื่อเริ่ม';
    $('af-onoff').classList.toggle('on', A.on);
    const mons = kinds.filter((t) => !isBoss({ type: t })), bosses = kinds.filter((t) => isBoss({ type: t }));
    const pct = (v) => (v ? Math.round(v * 100) + '%' : 'ไม่ใช้');
    $('af-body').innerHTML =
      `<div class="af-h">มอนที่จะฟาร์ม <small>${(NC.MAPS[game.mapId] || {}).name || ''}</small>` +
      '<span class="af-hbtn">' + chip(false, 'data-all="on"', 'เลือกทั้งหมด') + chip(false, 'data-all="off"', 'ไม่เลือกเลย') + '</span></div>' +
      '<div class="af-mons">' + (mons.length ? mons.map((t) => chip(!SET.off.includes(t), `data-mon="${t}"`,
        `<canvas width="72" height="72" data-thumb="${t}"></canvas><span>${nameOf(t)}</span><em>${lvRange(game, t)}</em>`, 'mon')).join('')
        : '<div class="af-empty">แมพนี้ไม่มีมอนสเตอร์</div>') + '</div>' +
      (bosses.length ? `<div class="af-row">${chip(SET.boss, 'data-boss="1"', `ตีบอสด้วย (${bosses.map(nameOf).join(', ')})`)}</div>` : '') +
      '<div class="af-h">ระยะล่า</div><div class="af-row">' + chip(SET.range === 'map', 'data-range="map"', 'ทั้งแมพ') +
      chip(SET.range === 'near', 'data-range="near"', 'รัศมีรอบตัว') + '</div>' + A.rangeControls('af-radius') +
      '<div class="af-h">สกิล <span class="af-hbtn">' + chip(SET.skills, 'data-skills="1"', SET.skills ? 'ใช้สกิลอัตโนมัติ' : 'ตีธรรมดาอย่างเดียว') + '</span></div>' +
      '<div class="af-slots">' + (NC.HOTKEYS || ['q', 'e', 'r', 'f']).map((k) => {
        const id = NC.skillForKey(p, k), S = id && NC.SKILLS[id];
        const src = S && NC.ASSET_MANIFEST[S.icon] ? NC.ASSET_MANIFEST[S.icon].src : (S && NC.SPR[S.icon] ? NC.SPR[S.icon].src : '');
        return chip(S && SET.skills && SET.slots[k] !== false, `data-slot="${k}" ${S && SET.skills ? '' : 'disabled'} title="${S ? S.name : 'ช่องว่าง'}"`,
          `<i>${k.toUpperCase()}</i>${src ? `<img src="${src}" alt="">` : '<img alt="">'}`, 'slot');
      }).join('') + '</div>' +
      '<div class="af-h">ยาและการพัก</div>' +
      '<div class="af-row"><span class="af-lbl">ยาแดงเมื่อ HP ต่ำกว่า</span>' + [0, 0.3, 0.5, 0.7].map((v) => chip(SET.hpPot === v, `data-hp="${v}"`, pct(v))).join('') + '</div>' +
      '<div class="af-row"><span class="af-lbl">ยาฟ้าเมื่อ SP ต่ำกว่า</span>' + [0, 0.2, 0.4].map((v) => chip(SET.spPot === v, `data-sp="${v}"`, pct(v))).join('') + '</div>' +
      '<div class="af-row">' + chip(SET.rest, 'data-rest="1"', 'นั่งพักเมื่อ HP/SP ต่ำและยาหมด (ไม่มีมอนใกล้ ๆ)') + chip(SET.loot, 'data-loot="1"', 'เดินเก็บของดรอป') + '</div>' +
      '<div class="af-row">' + chip(SET.share, 'data-share="1"', 'ไม่แย่งมอนที่คนอื่นตีอยู่') + chip(SET.group, 'data-group="1"', 'เกาะกลุ่มเมื่ออยู่ในปาร์ตี้') +
      chip(SET.flee, 'data-flee="1" title="เลือดต่ำกว่า 30% และยังดื่มยาแดงไม่ได้: ถอยออกจากฝูงก่อน · ไม่มียาเลย: ถอยแล้วนั่งพักจน HP 70% (ปิดตรงนี้ ไม่ถอย ไม่นั่ง)"', 'ถอยเมื่อเลือดน้อยและยังดื่มยาไม่ได้') + '</div>';
    win.querySelectorAll('canvas[data-thumb]').forEach((cv) => thumb(cv, cv.dataset.thumb));
  }
  function render() {
    if (!box) return;
    box.classList.toggle('on', A.on);
    renderWake();
    renderWin();
  }
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game); build(game); render();
    const keys = document.querySelector('#pause .keys'); // the keys in the pause menu
    if (keys) {
      const li = document.createElement('li');
      li.innerHTML = '<kbd>Z</kbd> ออโต้ฟาร์ม — ล็อกเป้า เดินไล่ ตีและใช้สกิลเอง ดื่มยา นั่งพัก เก็บของ · เลือกชนิดมอนได้ที่ปุ่ม "ตั้งค่า" ข้างปุ่ม AUTO';
      keys.insertBefore(li, keys.lastElementChild);
    }
  };
  let lastLine = '';
  const baseHud = NC.HUD.update.bind(NC.HUD);
  NC.HUD.update = function (game) {
    baseHud(game);
    const el = $('af-state');
    if (!el) return;
    const line = A.on ? A.state + (A.note ? ' · ' + A.note : '') : '';
    if (line !== lastLine) { lastLine = line; el.textContent = line; el.hidden = !line; }
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (id === 'autofarm') {
      const on = show === undefined ? win.hidden : show;
      basePanel('pause', false); // closes every other window
      win.hidden = !on;
      if (on) renderWin();
      previewRange(); win.classList.remove('af-previewing');
      return on;
    }
    if (win) win.hidden = true;
    return basePanel(id, show);
  };
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyZ' || e.repeat || !NC.game || !NC.game.player) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (NC.game.paused) return;
    NC.Auto.toggle(NC.game);
  });
})();
