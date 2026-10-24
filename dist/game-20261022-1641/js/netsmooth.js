/* netsmooth.js — the other heroes and the online monsters drawn a moment behind, between two known places (2026-10-19, the
   user: "ทำ กลุ่ม A เลย": the recipe of another web MMO, item 1 + 2). README "คนอื่นเดินเนียน (วาดย้อนหลัง)".
   Before: every remote hero (js/net.js) and every server monster (js/online/world.js mirrors) chased the LAST place that
   arrived (k 12-14 a second): a burst of speed at each snapshot, then slowing down, so a walk looked like rubber bands and a
   late snapshot stopped them dead. Now each keeps the places it was given with their time (online the snapshot's tick x 50 ms,
   see below; the arrival time in a claude.ai / ?netmock room) and is drawn where it was a little while ago (about 1.5 snapshot gaps,
   150-350 ms, from the snapshots' own rhythm), at an even speed between the two places around that moment:
     - nothing new yet (a late snapshot): it walks on the way it was going for at most 150 ms, then waits;
     - a place far from where it was being drawn (a correction, a dash): the step beyond a believable speed is kept as an
       offset that fades in 80 ms instead of a jump; past 600 px (a warp, back at the camp) it jumps;
     - after standing still a while, the walk starts just before the new place (not a slow slide across the gap).
   What the others do waits for their bodies too (item 2): another hero's swing clip and replayed skill (net.js net.defer)
   play at the time they were sent, never more than 1.2 s late (older ones are dropped, 40 waiting at most); the numbers
   and sparks of another player's hits (online/world.js runs them through NC.OtherFX.run) show the same moment later.
   Your own hero, your own hits and every number about you stay at once.
   Timed by the tick (2026-10-19, the live 0.5.3 build's shaking walk, tools/perf/walksim.mjs): the server moves everyone a
   fixed step a tick (1/20 s) but stamped its snapshots with the wall clock when it wrote them, so a tick that ran late came
   out as a speed wobble. The places are now timed by the snapshot's own tick x TICK_MS (serverTime only when a snapshot has
   no tick); a new match (a map, a channel) starts its own count and the clock with it. A server
   whose ticks fall behind the wall clock is followed by the offset's creep (faster the later the snapshots get).
   Hooks: NC.Net.follow / defer / tick (net.js), NC.OnlineWorld.follow + monsterHooks (online/world.js), NC.OtherFX.run.
   Load after js/otherfx.js. NC.NetSmooth.stats() for tests. */
(function () {
  'use strict';
  const NC = window.NC, net = NC.Net;
  if (!net) return;
  const O = NC.Online, online = !!(O && O.enabled);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FIXED = 0;
  const GUESS = 150; // ms walked on when nothing new came
  const LATE = 1200; // ms: an act older than this is dropped
  const JUMP = 600; // px: past this it jumps
  const FADE = 0.08; // s: a correction's offset fades this fast
  const MAXBUF = 24;
  const TICK_MS = 50; // the server's simulation step (backend match.go tickRate 20): the moment a snapshot's places belong to
  const WALL = false;

  // ---------------- the clock and the delay ----------------
  // online: the snapshot's time (its tick x TICK_MS) -> this page's clock. The offset keeps the snapshot that came fastest
  // (the largest T - now) and creeps down so a slower road later is followed: 0.4 ms a snapshot, or 5% of how much later
  // this one came (a server whose ticks fall behind: the lag stays bounded instead of emptying the places).
  const K = { off: null, iv: 0, jit: 0, lastT: 0, lastAt: 0, delay: FIXED || 150, n: 0 };
  function onSnap(T) {
    if (typeof T !== 'number' || !isFinite(T)) return;
    if (K.lastT && (T < K.lastT - 2000 || T > K.lastT + 10000)) { K.off = null; K.lastT = 0; } // (another match: its own count)
    const at = performance.now(), e = T - at;
    K.off = K.off == null ? e : Math.max(e, K.off - Math.max(0.4, (K.off - e) * 0.05));
    if (K.lastT && T > K.lastT) {
      const gap = T - K.lastT, arr = at - K.lastAt;
      if (gap < 1000) {
        K.iv = K.iv ? K.iv + (gap - K.iv) * 0.05 : gap;
        K.jit += (Math.abs(arr - gap) - K.jit) * 0.05;
      }
    }
    K.lastT = T; K.lastAt = at; K.n++;
    if (!FIXED && K.iv) {
      // (150 ms at least: at 116 ms a hiccup of the page emptied the places and they stood still 4% of the frames)
      const want = clamp(K.iv * 1.5 + K.jit * 3, 150, 350);
      K.delay += (want - K.delay) * 0.05; // (slowly: a sudden change would jump everyone)
    }
  }
  const W = () => NC.OnlineWorld;
  // a snapshot's time: its tick on the server's simulation clock (serverTime when it has none, or ?nettime=wall)
  function stampOf(s) {
    if (!s) return null;
    if (!WALL && typeof s.tick === 'number' && isFinite(s.tick)) return s.tick * TICK_MS;
    return typeof s.serverTime === 'number' ? s.serverTime : null;
  }
  // the time a place / an act arriving now belongs to
  function sampleTime() {
    if (online) { const T = stampOf(W() && W().snap); if (T != null) return T; }
    return performance.now();
  }
  // the moment everyone is drawn at: from this frame's own time (the same for the whole frame, whatever ran before; not
  // performance.now(), which moves on while the frame is worked out: the steps came out uneven)
  const frameNow = () => { const t = !document.hidden && document.timeline && document.timeline.currentTime; return typeof t === 'number' ? t : performance.now(); };
  function renderTime() {
    if (online && K.off != null) return frameNow() + K.off - K.delay;
    return frameNow() - K.delay;
  }
  if (online) O.on('snapshot', (st) => onSnap(stampOf(st)));

  // ---------------- the places ----------------
  function stateOf(o) { return o._ns || (o._ns = { buf: [], ex: 0, ey: 0, px: undefined, py: undefined, vx: 0, vy: 0, map: null }); }
  function reset(S) { S.buf.length = 0; S.ex = S.ey = 0; S.px = S.py = undefined; S.vx = S.vy = 0; }
  function sample(o, T, x, y, moving, map) {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    const S = stateOf(o), b = S.buf;
    if (map !== undefined && S.map !== map) { reset(S); S.map = map; }
    let last = b[b.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) > JUMP) { reset(S); last = null; } // (a warp: start over from here)
    if (last && T <= last.T) { if (T === last.T) { last.x = x; last.y = y; last.mv = moving; } return; }
    if (last && T - last.T > 260) b.push({ T: T - 100, x: last.x, y: last.y, mv: last.mv }); // (stood still: the move starts just before)
    const L = b[b.length - 1];
    if (L && T - L.T <= 500) { const s = (T - L.T) / 1000; S.vx = (x - L.x) / s; S.vy = (y - L.y) / s; }
    if (!moving) S.vx = S.vy = 0;
    b.push({ T, x, y, mv: moving });
    if (b.length > MAXBUF) b.splice(0, b.length - MAXBUF);
  }
  // where it was at the moment R
  function pose(S, R) {
    const b = S.buf;
    if (!b.length) return null;
    while (b.length >= 2 && b[1].T <= R) b.shift();
    const a = b[0], c = b[1];
    if (R <= a.T) return { x: a.x, y: a.y };
    if (c) { const k = (R - a.T) / Math.max(1, c.T - a.T); return { x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k }; }
    const late = R - a.T, go = a.mv && late < 600 ? Math.min(GUESS, late) / 1000 : 0; // (nothing newer: on the way it went, a little)
    return { x: a.x + S.vx * go, y: a.y + S.vy * go };
  }
  // put it there; a step beyond a believable speed becomes an offset that fades (FADE) instead of a jump
  function place(o, S, P, dt, speed) {
    let jump = S.px === undefined;
    if (!jump) {
      const dx = P.x - S.px, dy = P.y - S.py, d = Math.hypot(dx, dy), ok = Math.max(6, speed * dt);
      if (d > JUMP) jump = true;
      else if (d > ok) { const k = (d - ok) / d; S.ex -= dx * k; S.ey -= dy * k; }
    }
    if (jump) S.ex = S.ey = 0;
    S.px = P.x; S.py = P.y;
    const m = Math.exp(-Math.max(0, dt) / FADE);
    S.ex *= m; S.ey *= m;
    o.x = P.x + S.ex; o.y = P.y + S.ey;
  }

  // ---------------- the other heroes (net.js) ----------------
  net.hooks.push((r, pr) => { if (pr && typeof pr.x === 'number') sample(r, sampleTime(), r.tx, r.ty, !!pr.mv || !!pr.ds, r.map); });
  net.follow = function (r, dt) {
    const S = r._ns;
    if (!S || !S.buf.length) return false;
    const P = pose(S, renderTime());
    if (!P) return false;
    place(r, S, P, dt, 1300);
    return true;
  };
  // ---------------- their acts, at the time they were sent ----------------
  const waiting = []; // { T, fn, at }: T on the render clock's scale (serverTime online)
  function due(item, R) { return item.T <= R + 20; }
  net.defer = function (r, fn) {
    waiting.push({ T: sampleTime(), fn });
    if (waiting.length > 40) run(waiting.shift(), renderTime()); // (a flood: the oldest at once)
  };
  function run(item, R) {
    if (R - item.T > LATE) return; // (too old: dropped)
    try { item.fn(); } catch (e) { console.warn('netsmooth: act', e); }
  }
  // another player's hit (its number, sparks and feel: online/world.js through NC.OtherFX.run) when their swing shows
  const OF = NC.OtherFX;
  if (OF && typeof OF.run === 'function' && online) {
    const baseRun = OF.run;
    // (the hit happened about now on the server's clock: shown once the drawing moment gets there, i.e. the delay later)
    OF.run = function (fn) { waiting.push({ T: performance.now() + (K.off != null ? K.off : 0), fn: () => baseRun(fn) }); };
  }
  net.tick = function () {
    if (!waiting.length) return;
    const R = renderTime();
    let n = 0;
    for (let i = 0; i < waiting.length;) {
      if (due(waiting[i], R) && n < 16) { const it = waiting.splice(i, 1)[0]; n++; run(it, R); } else i++;
    }
  };

  // ---------------- the server's monsters (online/world.js mirrors) ----------------
  const Wd = W();
  if (online && Wd) {
    Wd.monsterHooks.push((e, m) => {
      const S = e._ns, last = S && S.buf[S.buf.length - 1];
      const moving = !!last && (last.x !== e.tx || last.y !== e.ty);
      sample(e, sampleTime(), e.tx, e.ty, moving);
    });
    Wd.follow = function (e, dt) {
      const S = e._ns;
      if (!S || !S.buf.length) return false;
      const P = pose(S, renderTime());
      if (!P) return false;
      place(e, S, P, dt, 1600);
      return true;
    };
  }

  // ---------------- for tests ----------------
  NC.NetSmooth = {
    K, waiting,
    stats() {
      return { online, delay: Math.round(K.delay), gap: Math.round(K.iv), jitter: Math.round(K.jit), snapshots: K.n, waiting: waiting.length,
        heroes: [...net.remotes.values()].filter((r) => r._ns && r._ns.buf.length).length,
        monsters: Wd ? [...Wd.mirrors.values()].filter((e) => e._ns && e._ns.buf.length).length : 0 };
    },
    renderTime, sampleTime, stampOf,
  };
})();
