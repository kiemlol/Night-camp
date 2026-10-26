/* keeprun.js — the game goes on (2026-10-18; the user: "เวลาเปิดเมนูบางอย่างแล้วเกมเหมือนหยุด ... ตอนพับจอเหมือนเกม
   ไม่ทำงาน บอทไม่ทำงาน"). Loaded FIRST (before intro.js): it replaces the page's timers before anyone makes one.

   1. NC.worldHeld(game): the few screens that really stop the world while game.paused is on: the title / story film
      (#intro), the character creator, the online character select and the wait for the first snapshot, a map
      change's curtain (game.warping, maps.js). Every other window (bag, status,
      skills, map, shop, ESC menu, journal, party, craft, ...) still sets game.paused, so its keys stay off the world
      (T, B, Z, the dash, ...), but the world, the monsters and AUTO run on behind it, as in an MMO.
      game.js step() puts the answer in game.hold; the update-time checks read game.hold, not game.paused.
   2. When frames stop, a worker clock steps the game without drawing (1/60 s steps) and runs due page timers, so
      AUTO and online traffic continue. In the desktop app, a minimized/hidden window stops drawing explicitly:
      Electron keeps background timers alive and its Page Visibility state may still say "visible". A visible window
      behind another app, including on a second monitor, keeps drawing normally. A Web Lock asks Chromium not to
      freeze an ordinary browser tab.
   Off: ?bgrun=0. A test that steps the game itself (__nc.step / __nc.sim called from outside, or
   requestAnimationFrame replaced) turns the background stepping off for that page, so stepped captures stay exact.
   (A phone's browser stops the whole page when it goes to the background: nothing on the page can run then.) */
(function () {
  'use strict';
  const NC = (window.NC = window.NC || {});
  const OFF = false;
  const now = () => performance.now();

  // ---------------- 1. which screens stop the world ----------------
  const shown = (el) => !!el && !el.hidden;
  NC.worldHeld = function (g) {
    if (!g || g.warping) return true;                                       // the curtain while the next map loads
    const intro = document.getElementById('intro');
    if (intro && !intro.classList.contains('out')) return true;             // the title film / the story film
    if (NC.Creator && NC.Creator.isOpen) return true;                       // the character creator
    if (shown(document.querySelector('.cs-root'))) return true;              // ?online: the character select
    if (window.__ncOnline && !window.__ncOnline.ready) return true;          // ?online: before the first snapshot
    return false;
  };

  if (OFF) return;

  // ---------------- 2a. the page's timers, kept on time while hidden ----------------
  // Each timer still runs on the browser's own clock; the list lets the worker run due ones when frames are absent
  // (a timeout once: whoever comes first runs it; an interval: the browser's own ticks wait meanwhile).
  const T = new Map(); // id -> { fn, args, due, every }
  const nST = window.setTimeout, nCT = window.clearTimeout, nSI = window.setInterval, nCI = window.clearInterval;
  let pumping = false;
  const report = (e) => { if (window.reportError) window.reportError(e); else console.error(e); };
  window.setTimeout = function (fn, ms) {
    if (typeof fn !== 'function') return nST.apply(window, arguments);
    const args = Array.prototype.slice.call(arguments, 2), r = { fn, args, due: now() + (Number(ms) || 0), every: 0 };
    const id = nST.call(window, function () { T.delete(id); fn.apply(window, args); }, ms);
    r.id = id; T.set(id, r);
    return id;
  };
  window.setInterval = function (fn, ms) {
    if (typeof fn !== 'function') return nSI.apply(window, arguments);
    const every = Math.max(4, Number(ms) || 0), args = Array.prototype.slice.call(arguments, 2), r = { fn, args, due: now() + every, every };
    const id = nSI.call(window, function () { if (pumping) return; r.due = now() + every; fn.apply(window, args); }, ms);
    r.id = id; T.set(id, r);
    return id;
  };
  // (timeouts and intervals share one list of ids: either clear stops either)
  window.clearTimeout = function (id) { T.delete(id); return nCT.call(window, id); };
  window.clearInterval = function (id) { T.delete(id); return nCI.call(window, id); };
  function pump() {
    const t = now();
    for (const r of Array.from(T.values())) { // (a callback may make or clear timers)
      if (r.due > t || !T.has(r.id)) continue;
      if (r.every) r.due = r.due + r.every > t ? r.due + r.every : t + r.every; // (late: the next one a full step on, no burst)
      else { T.delete(r.id); nCT.call(window, r.id); }
      try { r.fn.apply(window, r.args); } catch (e) { report(e); }
    }
  }

  // ---------------- 2b. the game, stepped while the tab gets no frames ----------------
  const RAF0 = window.requestAnimationFrame;
  let lastRaf = now(), lastTick = now(), outside = false, wrapped = null;
  (function ping() { lastRaf = now(); RAF0.call(window, ping); })();
  // the game's own frame calls its step directly; a call through window.__nc is a test driving the game
  let nc = null;
  Object.defineProperty(window, '__nc', {
    configurable: true, enumerable: true,
    get() { return nc; },
    set(v) {
      nc = v;
      if (!v || typeof v.step !== 'function') { wrapped = null; return; }
      const step = v.step, sim = v.sim;
      wrapped = step;
      v.step = function () { outside = true; return step.apply(this, arguments); };
      if (typeof sim === 'function') v.sim = function () { outside = true; return sim.apply(this, arguments); };
    },
  });
  const CAP = 1.2; // catch a throttled one-second tick, but never simulate a whole system sleep at once
  const desktopHidden = () => !!(window.NCDesktop && window.NCDesktop.isWindowHidden && window.NCDesktop.isWindowHidden());
  let wasBackground = false;
  function tick() {
    const t = now(), stalled = t - lastRaf >= 400;
    const background = document.hidden || desktopHidden() || stalled;
    let d = Math.max(0, (t - lastTick) / 1000);
    lastTick = t;
    // The first stalled tick includes the gap since the last displayed frame.
    if (background && !wasBackground && stalled) d = Math.max(d, (t - lastRaf) / 1000);
    wasBackground = background;
    pumping = background;
    if (pumping) pump();
    if (!background) return;                                              // frames are coming: the game's own loop runs
    if (!wrapped || outside || window.requestAnimationFrame !== RAF0) return;
    const g = nc && nc.game;
    if (!g || !g.player) return;
    let left = Math.min(d, CAP);
    try { while (left > 1e-4) { const s = Math.min(1 / 60, left); left -= s; wrapped(s, true); } } catch (e) { report(e); }
  }
  // The desktop disables background throttling; an ordinary browser may still delay worker messages.
  try {
    const src = 'let t=0;onmessage=function(e){clearInterval(t);t=setInterval(function(){postMessage(0)},e.data)};';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onmessage = tick;
    w.onerror = () => { w.terminate(); nSI.call(window, tick, 50); };
    w.postMessage(50);
  } catch (e) { nSI.call(window, tick, 50); }
  // Chromium does not freeze a page that holds a Web Lock (a name of its own: other game tabs hold theirs)
  try { if (navigator.locks && navigator.locks.request) navigator.locks.request('nightcamp-awake-' + Math.random().toString(36).slice(2), () => new Promise(() => {})).catch(() => {}); } catch (e) { /* no locks */ }
})();
