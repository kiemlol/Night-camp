/* crashguard.js — จำการแครช + ตั้งค่า WebGL (2026-10-19, the user: "ทำ กลุ่ม A เลย": the recipe of another web MMO, item 3 + 4).
   README "จำการแครช + WebGL".
   1) Crash memory: the page writes a small heartbeat to localStorage every 2 s (and 'hide' / 'bg' when the tab is closed or
      put away). A start that finds the last run's heartbeat with no end (the page died on screen: the tab crashed, the
      phone ran out of memory, the browser was killed) within 15 min counts a crash. With graphics on อัตโนมัติ the game then
      starts a level lower (two levels after a second crash before the game was even up), that level is the ceiling for this
      session, and the player is told once (ESC -> ตั้งค่า puts it back). A WebGL context the browser took away during the
      last run counts the same way (the graphics card ran out of memory). A run that reached the game and played 20 s
      clears the count. Skipped for test pages (?gfx=..., navigator.webdriver) and ?crash=0.
   2) WebGL: a context the browser takes away (not one the game drops on purpose: gfx.js's probe) is counted here
      (NC.Crash.gl); each layer (glfx, paintgl, meshfx, meshrig, bloodaura, the hero and Baphomet rigs) makes itself a new
      one on its next draw. The contexts keep what they ask for: dropping preserveDrawingBuffer (every layer draws and
      copies its canvas in the same frame) was the plan, but on the WebGL2 game screen (js/gl2d.js, which uploads those
      canvases) 30 rig heroes took 26-28 ms a frame without the kept copies against 19-22 ms with them (two interleaved
      pairs, 2026-10-19), so it stays a test: ?glpdb=0 (never on a canvas marked __ncKeep). No powerPreference either: the
      layers are copied into the game canvas each frame, and a context on a laptop's other graphics chip pays for that.
      ?glflags=0 leaves the contexts alone (no loss count).
   Load first of all (before intro.js makes its context); nothing else is needed from the page. */
(function () {
  'use strict';
  const NC = (window.NC = window.NC || {});
  const KEY = 'nightcamp.crash.v1';
  const C = (NC.Crash = { n: 0, drop: 0, prev: null, gl: 0, glPrev: 0, on: false, applied: false });

  // ---------------- 2) WebGL ----------------
  let rec = null; // (this run's heartbeat: set below)
  function lost(e) {
    if (this.__ncPurpose) return; // (dropped by the game itself)
    C.gl++;
    if (rec) { rec.gl = C.gl; save(); }
    console.warn('crashguard: the browser took a WebGL context away', C.gl);
  }
  if (window.HTMLCanvasElement) {
    const baseGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      if (type !== 'webgl2' && type !== 'webgl' && type !== 'experimental-webgl') return baseGet.apply(this, arguments);
      const a = Object.assign({}, attrs || {});
      // (no powerPreference 'high-performance': every layer here is copied into the 2D game canvas each frame, and on a
      // laptop with two graphics chips a context on the other chip pays a copy across them; the browser's own pick stays)
      const ctx = baseGet.call(this, type, a);
      if (ctx && !this.__ncWatch) { this.__ncWatch = true; this.addEventListener('webglcontextlost', lost, false); }
      return ctx;
    };
    // a context the game drops on purpose (WEBGL_lose_context: gfx.js's look at the machine) is not a loss
    for (const P of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!P || !P.prototype.getExtension) continue;
      const baseExt = P.prototype.getExtension;
      P.prototype.getExtension = function (name) {
        const x = baseExt.apply(this, arguments);
        if (x && name === 'WEBGL_lose_context' && !x.__nc) {
          x.__nc = true;
          const cv = this.canvas, baseLose = x.loseContext.bind(x);
          x.loseContext = function () { if (cv) cv.__ncPurpose = true; return baseLose(); };
        }
        return x;
      };
    }
  }

  // ---------------- 1) crash memory ----------------
  const skip = navigator.webdriver === true;
  let store = null;
  try { store = window.localStorage; } catch (e) { /* storage blocked */ }
  if (skip || !store) return;
  C.on = true;
  let prev = null;
  try { prev = JSON.parse(store.getItem(KEY) || 'null'); } catch (e) { prev = null; }
  const now = Date.now();
  // died on screen: no end written, the last beat less than 15 min ago
  const died = !!(prev && prev.t && !prev.end && now - prev.t < 15 * 60e3);
  if (died) { C.n = prev.ok ? 1 : (prev.n | 0) + 1; C.prev = prev; }
  C.glPrev = prev && prev.gl ? prev.gl | 0 : 0;
  C.drop = died ? Math.min(2, C.n) : C.glPrev ? 1 : 0;
  rec = { t0: now, t: now, n: died ? C.n : 0, ok: 0, gl: 0 };
  function save() { try { store.setItem(KEY, JSON.stringify(rec)); } catch (e) { /* full */ } }
  save();
  setInterval(() => { rec.t = Date.now(); save(); }, 2000);
  addEventListener('pagehide', () => { rec.end = 'hide'; rec.t = Date.now(); save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) rec.end = 'bg'; else delete rec.end; rec.t = Date.now(); save(); });

  // the level: once gfx.js is in (graphics on อัตโนมัติ only), then one line to the player when the game is up
  const playing = () => { const g = NC.game; return !!(g && g.world && g.player && !document.getElementById('loading') && !document.hidden); };
  let upFor = 0, told = false, tries = 0;
  function lower() {
    const G = NC.Gfx;
    if (!C.drop || C.applied || !G || !G.A || !G.S || G.S.mode !== 'auto') return;
    C.applied = true;
    const to = Math.min(3, G.A.lv + C.drop);
    G.A.ceil = Math.max(G.A.ceil || 0, to); // (no climbing back up this session)
    if (to !== G.A.lv) G.set('level', to);
    C.to = to;
  }
  const tick = setInterval(() => {
    tries++;
    lower();
    if (playing()) {
      upFor += 1;
      if (C.applied && !told && NC.HUD && NC.HUD.toast && NC.Gfx) {
        told = true;
        const L = NC.Gfx.LEVELS[NC.Gfx.A.lv];
        NC.HUD.toast(`รอบก่อนเกมปิดตัวกลางคัน: ลดคุณภาพภาพเป็น "${L ? L.name : 'ต่ำ'}" ให้ก่อน · ESC → ตั้งค่า → ความลื่นและคุณภาพภาพ`);
      }
      if (upFor >= 20 && !rec.ok) { rec.ok = 1; rec.n = 0; save(); } // (played 20 s: the count starts over)
    }
    if ((rec.ok && (told || !C.applied)) || tries > 600) clearInterval(tick);
  }, 1000);
})();
