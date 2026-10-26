/* gfx.js — คุณภาพภาพที่เข้ากับเครื่อง + เช็คเครื่อง (2026-10-18, the user: "ทำโหมด มีให้ผู้ใช้ เลือก optimize ภาพให้เข้ากับคอม
   ... ถ้าคอมกากมันจะปรับให้เอง เเล้วเเนะนำว่า คอมลูกค้าควรปรับอะไร"). README "คุณภาพภาพ + เช็คเครื่อง".
   The knobs (each a one-line hook in js/game.js):
     - the game canvas' resolution: NC.Gfx.res() = a share of devicePixelRatio that resize() multiplies in (game.dpr; the
       mouse already divides by it, the WebGL layers - glfx, paintgl, meshfx, the hero rig - follow the canvas size)
     - the night light map's size: NC.Gfx.lightK() (was 0.5 fixed with the light sprites on)
     - a frame cap: frame() asks NC.Gfx.skip(now) first; it also times every drawn frame for the auto level
   The levels: 0 สูง, 1 กลาง, 2 ต่ำ, 3 ต่ำสุด (auto only). อัตโนมัติ starts from a look at the machine (the WebGL renderer
   string, CPU threads, RAM, screen pixels, a phone) and then watches presented frames: a level down after two 2 s windows
   below the display target or with repeated long frames, a level up after 40 s of smooth frames with spare time; a level that dropped again soon after going up becomes
   the ceiling for the session. The level it ends on is kept for the next start. Picking สูง / กลาง / ต่ำ by hand also
   sets ผู้เล่นอื่นบนจอ (js/herospine_crowd.js) and เอฟเฟกต์ผู้เล่นอื่น (js/otherfx.js) to match; อัตโนมัติ gives the crowd
   its own auto.
   เช็คเครื่อง (ESC -> ตั้งค่า -> ความลื่นและคุณภาพภาพ -> เครื่องของคุณ): what the browser can tell about the machine, what
   the game set by itself, and what the player should change outside the game: hardware acceleration off (the browser
   draws with the CPU), the laptop's built-in graphics chip, battery / power mode, the browser's energy saver (frames held
   at 30), RAM, an old or non-Chromium browser, a big screen, a fast screen the machine can't keep up with, and the
   JavaScript JIT turned off for this site (Edge's "Enhance your security on the web", Chrome's JavaScript optimization
   setting: the game's code runs several times slower on any machine; checkJit below, timed once while the game loads).
   localStorage nightcamp.gfx.v1. Tests (never saved): ?gfx=0 off (the old full-resolution game), ?gfx=auto|high|mid|low,
   ?gfxres=0.5, ?fpscap=30|60. */
(function () {
  'use strict';
  const NC = window.NC;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // px: most pixels drawn a frame; lin: at most this share of the screen's own resolution (across); light: the night light
  // map's size; cap: the frame cap when จำกัดเฟรม is อัตโนมัติ (0 = none; 60 only matters on a faster screen).
  // 60 at every level since 2026-10-24 (players' reports: on a gaming PC the FPS swung and the windows beside the game,
  // a live stream, stuttered, while an i3 laptop was steady): uncapped, a 144-165 Hz screen drew every frame it could and
  // Chrome's one GPU process, which draws the other windows too, had no room left; and Auto aimed at the screen's rate,
  // stepped down and up again, each step a resize. จำกัดเฟรม ไม่จำกัด still draws every frame.
  const LEVELS = [
    { id: 'high', name: 'สูง', px: 8.3e6, lin: 1, light: 0.5, cap: 60 },
    { id: 'mid', name: 'กลาง', px: 2.1e6, lin: 0.85, light: 0.5, cap: 60 },
    { id: 'low', name: 'ต่ำ', px: 1.2e6, lin: 0.7, light: 0.35, cap: 60 },
    { id: 'min', name: 'ต่ำสุด', px: 0.62e6, lin: 0.55, light: 0.25, cap: 60 },
  ];
  // Scene fields from the existing graphics.js presets. This entrypoint uses
  // Gfx as its single quality controller; without this bridge game.js stayed on
  // the high fallback (including expensive high resampling) at every Auto level.
  // Resolution, frame pacing and persisted choices remain the LEVELS above.
  const SCENE = [
    Object.freeze({ name: 'high', lightScale: .75, bloom: true, vignette: true, shadows: 'all', decorationDensity: 1, sway: true, particleDensity: 1, smoothing: 'high' }),
    Object.freeze({ name: 'medium', lightScale: .5, bloom: false, vignette: true, shadows: 'actors', decorationDensity: .7, sway: true, particleDensity: .65, smoothing: 'low' }),
    Object.freeze({ name: 'low', lightScale: .35, bloom: false, vignette: false, shadows: 'none', decorationDensity: .4, sway: false, particleDensity: .35, smoothing: 'low' }),
  ];
  const IDX = { high: 0, mid: 1, low: 2 };
  const MODES = ['auto', 'high', 'mid', 'low'], SHARPS = ['auto', '1', '0.75', '0.5'], CAPS = ['auto', '0', '60', '30'];
  const KEY = 'nightcamp.gfx.v1';
  const S = { mode: 'auto', sharp: 'auto', cap: 'auto', level: -1, told: 0, toldJit: 0 };
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (MODES.includes(o.mode)) S.mode = o.mode;
    if (SHARPS.includes(o.sharp)) S.sharp = o.sharp;
    if (CAPS.includes(o.cap)) S.cap = o.cap;
    if (o.level >= 0 && o.level <= 3) S.level = o.level | 0;
    S.told = o.told | 0;
    S.toldJit = o.toldJit | 0;
  } catch (e) { /* storage blocked */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ } };
  // (no page-only overrides: the settings decide)
  const T = { mode: null, res: 0, cap: null };
  const mode = () => T.mode || S.mode;

  // ---------------- the machine ----------------
  const D = { gpu: '', gpuRaw: '', cls: 'unknown', weak: false, gl2: false, caveat: false, cores: 0, mem: 0, os: '', browser: '', ver: 0, chromium: false, phone: false, bat: null, jit: null, jitR: null, desktop: null };
  function cleanGpu(s) {
    const m = /^ANGLE \((.*)\)$/.exec(s);
    let t = s;
    if (m) { const parts = m[1].split(', '); t = parts.length >= 2 ? parts[1] : m[1]; }
    return t.replace(/\s*\(0x[0-9a-f]+\)/gi, '').replace(/\s+(Direct3D|D3D1|OpenGL|Vulkan|Metal|vs_|ps_).*$/i, '')
      .replace(/\((R|TM)\)/gi, '').replace(/\s+/g, ' ').trim();
  }
  function probe() {
    D.gl2 = false; D.caveat = false; D.gpuRaw = '';
    try {
      const c = document.createElement('canvas');
      let gl = c.getContext('webgl2');
      D.gl2 = !!gl;
      if (!gl) gl = c.getContext('webgl');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        D.gpuRaw = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
      // a context refused "if major performance caveat" = the browser would draw it in software
      const c2 = document.createElement('canvas'), g2 = c2.getContext('webgl', { failIfMajorPerformanceCaveat: true });
      D.caveat = !!gl && !g2;
      if (g2) { const l2 = g2.getExtension('WEBGL_lose_context'); if (l2) l2.loseContext(); }
    } catch (e) { /* no WebGL */ }
    const r = D.gpuRaw;
    D.gpu = cleanGpu(r);
    D.weak = false;
    if (!r || /swiftshader|llvmpipe|softpipe|basic render|software|microsoft basic/i.test(r) || D.caveat) D.cls = 'soft';
    else if (/nvidia|geforce|quadro|rtx|gtx|radeon rx|radeon pro|\brx ?\d{3,4}|arc\(tm\) a\d|arc a\d{3}/i.test(r)) {
      D.cls = 'dgpu';
      D.weak = /\bgt \d{3}\b|gtx (4|5|6|7)\d\d\b|geforce \d{3}m?\b|\bmx ?\d{3}\b|\bmx\d{3}\b|radeon r[5-7]\b|radeon hd/i.test(r);
    } else if (/apple m\d|apple gpu/i.test(r)) D.cls = 'apple';
    else if (/adreno|mali|powervr|apple a\d|xclipse|immortalis/i.test(r)) D.cls = 'mobile';
    else if (/intel|uhd|iris|hd graphics|radeon\(tm\) graphics|radeon graphics|radeon vega|vega \d|arc\(tm\) graphics/i.test(r)) D.cls = 'igpu';
    else D.cls = 'unknown';
    D.cores = navigator.hardwareConcurrency || 0;
    D.mem = navigator.deviceMemory || 0;
    const ua = navigator.userAgent, uad = navigator.userAgentData;
    D.os = /Windows/i.test(ua) ? 'win' : /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Mac OS X|Macintosh/i.test(ua) ? 'mac' : /Linux|CrOS/i.test(ua) ? 'linux' : '';
    D.phone = /Android|iPhone|iPad|iPod|Mobile/i.test(ua); // (not NC.Mobile: a touch laptop shows the phone buttons too)
    const brand = (uad && uad.brands || []).map((b) => [b.brand, +b.version]);
    const pickB = (re) => brand.find(([b]) => re.test(b));
    let b;
    if ((b = pickB(/Edge/i))) { D.browser = 'Edge'; D.ver = b[1]; }
    else if ((b = pickB(/Opera/i))) { D.browser = 'Opera'; D.ver = b[1]; }
    else if ((b = pickB(/Brave/i))) { D.browser = 'Brave'; D.ver = b[1]; }
    else if ((b = pickB(/Google Chrome/i))) { D.browser = 'Chrome'; D.ver = b[1]; }
    else if ((b = pickB(/Chromium/i))) { D.browser = 'Chromium'; D.ver = b[1]; }
    else if (/Firefox\/(\d+)/.test(ua)) { D.browser = 'Firefox'; D.ver = +RegExp.$1; }
    else if (/Edg\/(\d+)/.test(ua)) { D.browser = 'Edge'; D.ver = +RegExp.$1; }
    else if (/Chrome\/(\d+)/.test(ua)) { D.browser = 'Chrome'; D.ver = +RegExp.$1; }
    else if (/Version\/(\d+).*Safari/.test(ua)) { D.browser = 'Safari'; D.ver = +RegExp.$1; }
    D.chromium = !!brand.find(([x]) => /Chromium/i.test(x)) || /Chrome\//.test(ua) && !/Firefox/.test(ua);
    if (navigator.getBattery) navigator.getBattery().then((bt) => {
      const read = () => {
        // (a desktop reports charging, full, 0 s to charge: not a laptop)
        D.bat = { charging: bt.charging, level: bt.level, laptop: !(bt.charging && bt.level === 1 && bt.chargingTime === 0) };
      };
      read();
      bt.addEventListener('chargingchange', read); bt.addEventListener('levelchange', read);
    }).catch(() => {});
  }
  // the level a first start begins at
  function guess() {
    let lv = 0;
    if (D.cls === 'soft') lv = 3;
    else if (D.cls === 'igpu' || D.cls === 'mobile' || D.weak) lv = 1;
    else if (D.cls === 'unknown') lv = 1;
    if ((D.cores && D.cores <= 4) || (D.mem && D.mem <= 4)) lv = Math.max(lv, D.cls === 'dgpu' && !D.weak ? 1 : 2);
    if ((D.cores && D.cores <= 2) || (D.mem && D.mem <= 2)) lv = Math.max(lv, 2);
    if (D.phone) lv = Math.max(lv, 1);
    return lv;
  }
  probe();
  // The installed app can report Chromium's real GPU feature status even when
  // WebGL hides the model name. It is diagnostic only; Auto still follows frames.
  function desktopGpuState() {
    const info = D.desktop;
    if (!info) return null;
    const features = info.features || {};
    const webgl = String(features.webgl || '').toLowerCase();
    const webgl2 = String(features.webgl2 || '').toLowerCase();
    const limitedWebgl = /disabled|unavailable|blocklisted/.test(webgl) && /disabled|unavailable|blocklisted/.test(webgl2);
    const software = info.softwareRendering === true || info.hardwareAcceleration === false || /software/.test(String(features.canvas || ''));
    return { software, limitedWebgl, label: software ? 'วาดด้วยซีพียู (โหมดสำรอง)' : limitedWebgl ? 'WebGL ถูกจำกัด' : info.hardwareAcceleration === true ? 'ใช้การ์ดจอ' : 'กำลังตรวจ' };
  }
  function readDesktopGpu() {
    if (typeof window.NCDesktop?.graphicsInfo !== 'function') return;
    Promise.resolve().then(() => window.NCDesktop.graphicsInfo()).then((info) => {
      if (!info || typeof info !== 'object') return;
      D.desktop = info;
      if (over && !over.hidden) fill();
    }).catch(() => {});
  }
  readDesktopGpu();

  // ---------------- the JIT ----------------
  // Edge's "Enhance your security on the web" (Balanced: sites not visited often, so a new game; Strict: every site) starts
  // the site's page with `--js-flags=--jitless` (seen on its command line): no machine code for the page's JavaScript.
  // Chrome has a per-site setting of the same kind (chrome://settings/content/v8). Measured 2026-10-19 in headless Edge 155
  // (RTX laptop, woods at night, solo): frame JS 4.6-8.4 -> 30-48 ms, 75-125 -> 13-25 fps, loading 6-10 -> 22-83 s (README
  // "คุณภาพภาพที่เข้ากับเครื่อง"). The check: a plain JS loop timed against a builtin that is the same
  // native code with or without the JIT (a typed array sort), so the ratio does not depend on how fast the CPU is. Ratios
  // seen (ns per loop step / sort ms): JIT on 0.34-1.12 (CPU slowed 4x / 8x and every core busy included), the middle tier
  // alone 2-4, Edge's mode and no JIT 9.8-20.8. Both loops must read over 4. Chromium only: the numbers are V8's. Each loop grows until a run takes 1.5 ms (the loop tiers up
  // meanwhile; a later run under 1 ms grows it again), then the best of three runs; about 15 ms with the JIT, 30 ms without.
  let JP = null;
  function jitLoop(k) {
    if (!JP) {
      const N = 16384, src = new Float64Array(N), buf = new Float64Array(N), ta = new Int32Array(1024);
      let s = 12345;
      for (let i = 0; i < N; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; src[i] = s; }
      for (let i = 0; i < 1024; i++) ta[i] = i * 7;
      JP = { sink: 0, nat: () => { buf.set(src); buf.sort(); return buf[7]; }, loops: [
        (n) => { let a = 0, b = 1; for (let i = 0; i < n; i++) { a = (a + i * b) | 0; b = ((b ^ i) & 1023) | 1; } return a; },
        (n) => { let t = 0; for (let i = 0; i < n; i++) t = (t + ta[i & 1023]) | 0; return t; },
      ] };
    }
    const tm = (f, n) => { const t = performance.now(); JP.sink += f(n); return performance.now() - t; };
    const f = JP.loops[k], nat = [];
    let n = 2000, best = 0, tries = 0;
    for (;;) {
      while ((best = tm(f, n)) < 1.5 && n < 4e7) n *= 2;
      for (let r = 0; r < 3; r++) { nat.push(tm(JP.nat, 0)); best = Math.min(best, tm(f, n)); }
      if (best >= 1 || ++tries > 3 || n >= 4e7) break;
      n *= 2;
    }
    return +(((best / n) * 1e6) / Math.max(0.05, Math.min(...nat))).toFixed(2);
  }
  // (now: both loops at once, for ตรวจใหม่; else while the game loads, each loop in its own task, the second only when the
  // first did not already show the JIT at work)
  function checkJit(now) {
    if (!D.chromium) return;
    try {
      const r1 = jitLoop(0);
      D.jitR = [r1];
      if (r1 < 2) { D.jit = true; return; }
      const second = () => { try { const r2 = jitLoop(1); D.jitR = [r1, r2]; D.jit = !(r1 > 4 && r2 > 4); } catch (e) { /* (no verdict) */ } };
      if (now) second(); else setTimeout(second, 60);
    } catch (e) { /* (no verdict) */ }
  }
  setTimeout(checkJit, 1500);

  // ---------------- the level and the knobs ----------------
  // ceil: the best level auto may go up to this session; floor: the lowest it may go down to; try: a step down being
  // measured (did fewer pixels give more frames?)
  // relief: see setRelief (reliefMin: the least it may give back to this session; reliefAt / reliefBack: its last change
  // and its last step back)
  const A = { lv: S.level >= 0 ? S.level : guess(), ceil: 0, floor: 3, upAt: -1e9, try: null, firstRun: S.level < 0,
    relief: 0, reliefMin: 0, reliefAt: -1e9, reliefBack: -1e9 };
  const lv = () => (mode() === 'auto' ? A.lv : IDX[mode()]);
  const native = () => { const d = window.devicePixelRatio || 1; return [Math.round(innerWidth * d), Math.round(innerHeight * d)]; };
  function res() {
    const sh = T.res || (S.sharp !== 'auto' ? +S.sharp : 0);
    let f = sh;
    if (!f) { const L = LEVELS[lv()], [w, h] = native(); f = Math.min(L.lin, Math.sqrt(L.px / Math.max(1, w * h))); }
    return clamp(Math.round(f * 20) / 20, 0.3, 1);
  }
  const capNow = () => (T.cap !== null ? T.cap : S.cap === 'auto' ? LEVELS[lv()].cap : +S.cap);
  let lastF = res(), changedAt = 0;
  function apply() {
    const f = res();
    changedAt = performance.now();
    if (f !== lastF) { lastF = f; dispatchEvent(new Event('resize')); } // (game.js resize reads res())
  }

  // ---------------- the frames ----------------
  const M = { fps: 0, work: 0, hz: 0, hitch: 0, p95: 0, longRate: 0, target: 0, lock30: false, cpu: false, n: 0 };
  let rafPrev = 0, budget = 0, shownPrev = 0, winStart = 0, readyAt = 0, bad = 0, toldDrop = false;
  const hist = []; // (the last 20 windows at this level: 'good' / 'ok' / 'bad')
  const shown = [], work = [], rafIv = [];
  const HZ = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 200, 240, 360];
  const snapHz = (v) => { const n = HZ.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)); return Math.abs(n - v) / n < 0.08 ? n : Math.round(v); };
  const quant = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
  function skip(now) {
    const dt = rafPrev ? now - rafPrev : 16.7;
    rafPrev = now;
    if (dt > 0 && dt < 250) rafIv.push(dt);
    const cap = capNow();
    if (cap) {
      const I = 1000 / cap;
      budget += dt;
      if (budget < I * 0.96) return true;
      budget -= I;
      if (budget > I) budget = 0;
    }
    if (shownPrev) shown.push(now - shownPrev);
    shownPrev = now;
    const t0 = performance.now();
    queueMicrotask(() => work.push(performance.now() - t0)); // (runs once frame() has returned: the frame's JS time)
    if (!winStart) winStart = now;
    if (now - winStart >= 2000) judge(now);
    return false;
  }
  const playing = () => {
    const g = NC.game;
    return !!(g && g.world && g.player && !$('loading') && !g.hold && !g.warping && !document.hidden);
  };
  function judge(now) {
    winStart = now;
    const iv = shown.splice(0), wk = work.splice(0), rv = rafIv.splice(0);
    if (!playing()) { readyAt = 0; return; }
    if (!readyAt) readyAt = now;
    if (now - readyAt < 6000) return;
    // (before the frame checks: a machine too slow for 8 frames in 2 s gets its notice too - SwiftShader ran at 3.5 fps)
    if (!S.told || S.told < 2 || (D.jit === false && !S.toldJit)) tellOnce();
    if (now - changedAt < 3000 || iv.length < 8) return; // (a new map, a new size: pictures still decoding)
    const smooth = iv.filter((x) => x < 250), sum = smooth.reduce((a, b) => a + b, 0);
    if (!sum) return;
    M.fps = (smooth.length * 1000) / sum;
    M.hitch = iv.length - smooth.length;
    M.work = quant(wk, 0.5);
    M.p95 = quant(smooth, 0.95);
    const hz = snapHz(1000 / Math.max(1, quant(rv, 0.1)));
    M.hz = hz;
    M.n++;
    // the browser holding frames at 30 (Chrome's energy saver, Windows battery saver) while our frames take little time
    M.lock30 = M.n >= 3 && M.hz <= 32 && capNow() !== 30 && M.work < 12;
    // A 50 FPS GPU bottleneck can make RAF look like a 50 Hz display. Use 60 Hz as the
    // minimum uncapped target and validate each quality reduction against actual FPS;
    // a true 50 Hz display will simply undo a reduction that buys no frames.
    const target = Math.min(Math.max(M.hz || 60, 60), capNow() || 999);
    M.target = target;
    const frameMs = 1000 / target;
    M.longRate = smooth.filter((x) => x > frameMs * 2).length / smooth.length;
    // the game's own JS fills most of each frame: the CPU is what holds it back (fewer pixels help little)
    M.cpu = M.fps < target * 0.95 && M.work > (700 / M.fps);
    if (mode() !== 'auto') return;
    const slow = M.fps < target * 0.95 || M.p95 > frameMs * 1.2 || M.longRate > 0.01 || M.hitch > 0;
    const fast = M.fps >= target * 0.985 && M.p95 <= frameMs * 1.08 &&
      M.longRate === 0 && M.hitch === 0 && M.work < frameMs * 0.65;
    // Keep a step down if it gives at least 8% more FPS or makes pacing healthy.
    // If neither happens, undo it and stop trying lower tiers this session.
    if (A.try) {
      if (++A.try.n < 2) return;
      const T0 = A.try;
      A.try = null;
      if (M.fps < T0.fps * 1.08 && slow) { A.floor = T0.from; setLevel(T0.from); return; }
      if (!toldDrop && NC.HUD && NC.HUD.toast) { toldDrop = true; NC.HUD.toast(`เฟรมตก: ลดคุณภาพภาพเป็น "${LEVELS[A.lv].name}" ให้แล้ว (ESC → ตั้งค่า)`); }
    }
    const st = slow ? 'bad' : fast ? 'good' : 'ok';
    hist.push(st);
    if (hist.length > 20) hist.shift();
    bad = st === 'bad' ? bad + 1 : 0;
    const steady = hist.length >= 20 && hist.filter((x) => x === 'good').length >= 16 && !hist.slice(-10).includes('bad');
    if (bad >= 2 && M.cpu && A.relief < RELIEF_MAX) {
      // the game's own script fills the frame: fewer pixels help little, so fewer effects first
      if (now - A.reliefBack < 25000 && A.reliefMin < A.relief + 1) A.reliefMin = A.relief + 1; // (given back, then slow again soon: keep it)
      setRelief(A.relief + 1, now);
    } else if (bad >= 2 && A.lv < A.floor) {
      if (now - A.upAt < 25000) A.ceil = Math.max(A.ceil, A.lv + 1); // (up, then down again soon: stay down this session)
      const from = A.lv, fps = M.fps;
      setLevel(A.lv + 1);
      A.try = { from, fps, n: 0 };
    } else if (steady && A.relief > A.reliefMin && now - A.reliefAt > 60000) {
      A.reliefBack = now; // (the effects come back first, a minute after the last change)
      setRelief(A.relief - 1, now);
    } else if (steady && A.relief <= A.reliefMin && A.lv > A.ceil && !M.lock30) { // (the effects back first)
      A.upAt = now;
      setLevel(A.lv - 1);
    }
  }
  // relief (2026-10-24): when the CPU is what holds the frames back, Auto lowers the effects the player has not chosen
  // instead of the resolution: 1 = ตัวเลขดาเมจ แบบเรียบ and แสงของดรอป เฉพาะของดี, 2 = also no other players' effects
  // and half the particles. For this session only, given back step by step once the frames are steady; looks only, and
  // each module keeps a choice the player made (js/dmgburst.js, js/otherfx.js, js/droplight.js, js/fx.js).
  const RELIEF_MAX = 2;
  let toldRelief = false;
  function setRelief(v, now) {
    const from = A.relief;
    A.relief = clamp(v, 0, RELIEF_MAX); A.reliefAt = now; bad = 0; hist.length = 0;
    const numbers = !!(NC.DmgFX && NC.DmgFX.relieve && NC.DmgFX.relieve(A.relief));
    if (NC.OtherFX && NC.OtherFX.relieve) NC.OtherFX.relieve(A.relief);
    const drops = !!(NC.DropLight && NC.DropLight.mode && NC.DropLight.mode() === 'auto');
    // (step 1 with each of its effects chosen by the player lowers nothing: straight on to 2, the particles at least, or 0)
    if (A.relief === 1 && !numbers && !drops) { setRelief(from < 1 ? 2 : 0, now); return; }
    if (A.relief > 0 && !toldRelief && NC.HUD && NC.HUD.toast) {
      toldRelief = true;
      NC.HUD.toast('เครื่องทำงานหนัก: ลดเอฟเฟกต์ให้แล้ว (ESC → ตั้งค่า เลือกเองได้)');
    }
  }
  function setLevel(v) {
    A.lv = clamp(v, 0, 3); bad = 0; hist.length = 0;
    S.level = A.lv;
    if (!T.mode) save();
    apply();
  }
  function sceneChanged() {
    // A failed reduction in a quiet map says nothing about a crowded field.
    // Keep the current visual level, but give the new scene a fresh warmup and
    // an independent chance to move both down and up after its assets settle.
    A.ceil = 0; A.floor = 3; A.try = null; A.upAt = -1e9;
    A.reliefMin = 0; A.reliefBack = -1e9;
    bad = 0; hist.length = 0;
    rafPrev = 0; budget = 0; shownPrev = 0; winStart = 0; readyAt = 0;
    shown.length = 0; work.length = 0; rafIv.length = 0;
    Object.assign(M, { fps: 0, work: 0, hz: 0, hitch: 0, p95: 0, longRate: 0, target: 0, lock30: false, cpu: false, n: 0 });
    changedAt = performance.now();
  }
  // the first start: say what was set (and the one problem no game setting can fix)
  function tellOnce() {
    if (!NC.HUD || !NC.HUD.toast || T.mode) return;
    if (D.cls === 'soft' && S.told < 2) {
      NC.HUD.toast('เบราว์เซอร์ไม่ได้ใช้การ์ดจอ เกมจะกระตุก · ESC → ตั้งค่า → เช็คเครื่อง ดูวิธีแก้');
      S.told = 2; save(); return;
    }
    if (D.jit === false && !S.toldJit) {
      NC.HUD.toast(`${D.browser === 'Edge' ? 'Edge ' : 'เบราว์เซอร์'}ปิดตัวเร่งโค้ด เกมช้าลงหลายเท่า · ESC → ตั้งค่า → เช็คเครื่อง ดูวิธีแก้`);
      S.toldJit = 1; S.told = Math.max(S.told, 1); save(); return;
    }
    if (!S.told) {
      if (A.firstRun && mode() === 'auto' && A.lv > 0) NC.HUD.toast(`ปรับภาพให้เข้ากับเครื่องแล้ว: ระดับ "${LEVELS[A.lv].name}" · ESC → ตั้งค่า → เช็คเครื่อง`);
      S.told = 1; save();
    }
  }

  // ---------------- what the player should change ----------------
  const ADDR = { chrome: 'chrome://settings/system', edge: 'edge://settings/system', perf: 'chrome://settings/performance', help: 'chrome://settings/help' };
  function tips() {
    const out = [], B = D.browser, win = D.os === 'win', edge = B === 'Edge';
    const [w, h] = native();
    const addr = (a) => `<span class="gx-addr"><code>${a}</code><button class="gx-copy" data-copy="${a}">คัดลอก</button></span>`;
    const desktopGpu = desktopGpuState();
    if (desktopGpu && (desktopGpu.software || desktopGpu.limitedWebgl)) out.push({ k: 'red', t: 'ให้แอปใช้การ์ดจอ',
      why: desktopGpu.software ? 'ตอนนี้แอปวาดภาพด้วยซีพียูแทนการ์ดจอ เกมจะกระตุกได้แม้เครื่องแรง' : 'แอปแจ้งว่า WebGL ถูกจำกัด เอฟเฟกต์บางส่วนอาจใช้การ์ดจอไม่ได้',
      steps: ['อัปเดตไดรเวอร์การ์ดจอจากผู้ผลิต แล้วเปิดเกมใหม่', 'Windows: ตั้งค่า → ระบบ → จอแสดงผล → กราฟิก → Night Camp → ประสิทธิภาพสูง'] });
    else if (D.cls === 'soft') out.push({ k: 'red', t: 'เปิดให้เบราว์เซอร์ใช้การ์ดจอ',
      why: 'ตอนนี้เบราว์เซอร์วาดเกมด้วยซีพียูแทนการ์ดจอ ไม่ว่าเครื่องแรงแค่ไหนก็จะกระตุก ข้อนี้ช่วยมากที่สุด',
      steps: edge ? [`วางที่อยู่นี้ในช่อง URL ${addr(ADDR.edge)}`, 'เปิด "ใช้การเร่งด้วยฮาร์ดแวร์เมื่อพร้อมใช้งาน" (Use hardware acceleration)', 'กด "รีสตาร์ท" แล้วเข้าเกมใหม่']
        : B === 'Firefox' ? ['เมนู ☰ → การตั้งค่า → ทั่วไป → ประสิทธิภาพ', 'เอาติ๊ก "ใช้การตั้งค่าที่แนะนำ" ออก แล้วติ๊ก "ใช้การเร่งด้วยฮาร์ดแวร์เมื่อพร้อมใช้งาน"', 'ปิด Firefox แล้วเปิดใหม่']
          : [`วางที่อยู่นี้ในช่อง URL ${addr(ADDR.chrome)}`, 'เปิด "ใช้การเร่งกราฟิกเมื่อพร้อมใช้งาน" (Use graphics acceleration when available)', 'กด "เปิดใหม่" แล้วเข้าเกมใหม่'],
      more: 'เปิดแล้วยังขึ้นข้อนี้: อัปเดตไดรเวอร์การ์ดจอ (NVIDIA / AMD / Intel) แล้วเปิดเบราว์เซอร์ใหม่' });
    // (the site's own name goes in the browser's exception list: play.nightcamp.app online)
    const site = location.hostname || 'play.nightcamp.app';
    if (D.jit === false) out.push({ k: 'red', t: edge ? 'ปิด "ปรับแต่งความปลอดภัยของคุณบนเว็บ" ของ Edge' : 'ให้เว็บนี้ใช้ตัวเร่งโค้ด JavaScript',
      why: `${edge ? 'Edge เปิดโหมดความปลอดภัยเพิ่ม (Enhance your security on the web) ไว้ โหมดนี้ปิดตัวเร่งโค้ด (JIT) ของเว็บที่ไม่ค่อยได้เข้า' : 'เบราว์เซอร์ปิดตัวเร่งโค้ด (JIT) ของเว็บนี้ไว้'} โค้ดเกมเลยรันช้าลงหลายเท่า เกมโหลดนานและกระตุก ไม่ว่าเครื่องจะแรงแค่ไหน`,
      steps: edge ? [`วางที่อยู่นี้ในช่อง URL ${addr('edge://settings/privacy/security')} (หรือ การตั้งค่า → ความเป็นส่วนตัว การค้นหา และบริการ → ความปลอดภัย)`,
        'ปิด "ปรับแต่งความปลอดภัยของคุณบนเว็บ" (Enhance your security on the web)',
        `หรือเปิดไว้ได้ แต่ยกเว้นเว็บเกม: "การกำหนดลักษณะไซต์สำหรับความปลอดภัยขั้นสูง" → "อย่าใช้ความปลอดภัยขั้นสูงสำหรับไซต์เหล่านี้" → "เพิ่มไซต์" → ${addr(site)}`,
        'ปิดแท็บเกมแล้วเปิดใหม่ (ถ้ายังขึ้นข้อนี้: ปิด Edge ทุกหน้าต่างแล้วเปิดใหม่)']
        : [`วางที่อยู่นี้ในช่อง URL ${addr('chrome://settings/content/v8')} ("การเพิ่มประสิทธิภาพและความปลอดภัยของ JavaScript")`,
          `ที่ "พฤติกรรมเริ่มต้น" เลือกให้เว็บไซต์ใช้การเพิ่มประสิทธิภาพ JavaScript ได้ หรือเพิ่ม ${addr(site)} ในรายการ "ได้รับอนุญาตให้ใช้การเพิ่มประสิทธิภาพ JavaScript เสมอ"`,
          'ปิดแท็บเกมแล้วเปิดใหม่'],
      more: 'ถ้าตั้งค่านี้เป็นสีเทาแก้ไม่ได้ (องค์กรหรือโรงเรียนล็อกไว้) ลองเล่นด้วยเบราว์เซอร์อื่น' });
    if (M.lock30) out.push({ k: 'red', t: 'ปิดโหมดประหยัดพลังงาน (เกมถูกล็อกไว้ 30 เฟรม)',
      why: 'เบราว์เซอร์หรือ Windows กำลังประหยัดไฟ เลยให้เกมวาดได้แค่ 30 ภาพต่อวินาที ทั้งที่เครื่องทำได้มากกว่า',
      steps: (edge ? [`วาง ${addr(ADDR.edge)} → ปิด "โหมดประสิทธิภาพ" (Efficiency mode)`] : [`วาง ${addr(ADDR.perf)} → ปิด "โหมดประหยัดพลังงาน" (Energy Saver)`])
        .concat(win ? ['Windows: ตั้งค่า → ระบบ → พลังงานและแบตเตอรี่ → ปิด "ตัวประหยัดพลังงาน" (Energy saver)'] : []) });
    if ((D.cls === 'igpu' || D.weak) && win && !D.phone) out.push({ k: 'gold', t: 'ให้เบราว์เซอร์ใช้การ์ดจอแยก (ถ้าเครื่องมี)',
      why: `ตอนนี้เกมใช้ ${esc(D.gpu || 'ชิปกราฟิกในตัว')} ซึ่งช้ากว่าการ์ดจอแยกหลายเท่า โน้ตบุ๊กเล่นเกมมักมีการ์ดจอแยกแต่ไม่ได้ใช้`,
      steps: [`Windows: ตั้งค่า → ระบบ → จอแสดงผล → กราฟิก → เลือก ${esc(B || 'เบราว์เซอร์')} → ตัวเลือก → "ประสิทธิภาพสูง" (High performance)`,
        'การ์ด NVIDIA: คลิกขวาที่เดสก์ท็อป → NVIDIA Control Panel → Manage 3D settings → Program Settings → เลือกเบราว์เซอร์ → High-performance NVIDIA processor',
        'ปิดเบราว์เซอร์ทุกหน้าต่าง แล้วเปิดใหม่'],
      more: 'ถ้าเครื่องไม่มีการ์ดจอแยก ข้ามข้อนี้ได้ เกมลดภาพให้เบาลงเองแล้ว' });
    if (D.bat && D.bat.laptop && !D.bat.charging) out.push({ k: 'gold', t: 'เสียบสายชาร์จตอนเล่น',
      why: `ตอนนี้ใช้แบต (${Math.round(D.bat.level * 100)}%) เครื่องจะลดความแรงซีพียูและการ์ดจอลงเองเพื่อประหยัดไฟ`,
      steps: win ? ['เสียบสายชาร์จ', 'Windows 11: ตั้งค่า → ระบบ → พลังงานและแบตเตอรี่ → โหมดพลังงาน → "ประสิทธิภาพสูงสุด" (Best performance)'] : ['เสียบสายชาร์จ', 'ปิดโหมดประหยัดแบตเตอรี่ (Low Power Mode)'] });
    else if (D.bat && D.bat.laptop && win && M.n >= 3 && M.fps < 45) out.push({ k: 'gold', t: 'ตั้งโหมดพลังงานเป็นประสิทธิภาพสูงสุด',
      why: 'โน้ตบุ๊กส่วนใหญ่ตั้งไว้ "สมดุล" ซึ่งกั๊กความแรงไว้',
      steps: ['Windows 11: ตั้งค่า → ระบบ → พลังงานและแบตเตอรี่ → โหมดพลังงาน → "ประสิทธิภาพสูงสุด" (Best performance)'] });
    const heap = performance.memory;
    const heapFull = heap && heap.jsHeapSizeLimit && heap.usedJSHeapSize / heap.jsHeapSizeLimit > 0.8;
    if ((D.mem && D.mem <= 4) || heapFull) out.push({ k: heapFull ? 'red' : 'gold', t: 'ปิดแท็บและโปรแกรมอื่นตอนเล่น',
      why: D.mem && D.mem <= 4 ? `เครื่องมีแรมประมาณ ${D.mem} GB ส่วนรูปในเกมใช้แรมราว 1–1.5 GB ถ้าแรมเต็มเกมจะสะดุดเป็นช่วง ๆ` : 'แรมของหน้านี้ใกล้เต็มแล้ว เกมจะสะดุดเป็นช่วง ๆ',
      steps: ['ปิดแท็บที่ไม่ใช้ โดยเฉพาะวิดีโอ YouTube / ไลฟ์', 'ปิดโปรแกรมใหญ่ ๆ ที่เปิดค้าง (เกมอื่น, โปรแกรมตัดต่อ)', 'ถ้ายังสะดุด: ปิดเบราว์เซอร์ทั้งหมดแล้วเปิดเกมใหม่'] });
    // (with the JIT off the slow CPU work is the browser's doing: the tip above, not this one)
    const cpuBusy = M.n >= 3 && M.cpu && D.jit !== false;
    if ((D.cores && D.cores <= 4) || cpuBusy) out.push({ k: cpuBusy ? 'gold' : 'blue', t: 'ปิดโปรแกรมที่ทำงานเบื้องหลัง',
      why: cpuBusy ? `ซีพียูทำงานไม่ทัน (งานต่อเฟรม ${M.work.toFixed(0)} ms) ลดความคมภาพช่วยได้น้อย ต้องลดงานของซีพียู` : `ซีพียูมี ${D.cores} เธรด เกมต้องใช้ซีพียูทุกเฟรม โปรแกรมอื่นแย่งไปเกมจะช้าลง`,
      steps: ['ปิดโปรแกรมอัดจอ / สตรีม / โหลดไฟล์ / อัปเดต Windows ที่กำลังทำงาน', 'กด Ctrl + Shift + Esc ดูว่าโปรแกรมไหนกินซีพียูเยอะ']
        .concat(cpuBusy ? ['ในเกม: "ผู้เล่นอื่นบนจอ" ต่ำ · "เอฟเฟกต์ผู้เล่นอื่น" 30%'] : []) });
    if (!D.chromium && !D.phone) out.push({ k: 'gold', t: 'เล่นบน Chrome หรือ Edge',
      why: `เกมนี้ลื่นที่สุดบน Chrome และ Edge (ตอนนี้ใช้ ${esc(B || 'เบราว์เซอร์อื่น')})`, steps: ['เปิดเกมใน Google Chrome หรือ Microsoft Edge รุ่นล่าสุด'] });
    else if (D.chromium && D.ver && D.ver < 120) out.push({ k: 'gold', t: 'อัปเดตเบราว์เซอร์',
      why: `${esc(B)} รุ่น ${D.ver} เก่าแล้ว รุ่นใหม่วาดภาพเร็วกว่า`, steps: [edge ? 'วาง edge://settings/help ในช่อง URL แล้วรอให้อัปเดต' : `วาง ${addr(ADDR.help)} ในช่อง URL แล้วรอให้อัปเดต`, 'กด "เปิดใหม่"'] });
    if (w * h > 4.2e6) out.push({ k: 'blue', t: `จอความละเอียดสูง (${w}×${h})`,
      why: 'ยิ่งจอละเอียด การ์ดจอยิ่งต้องวาดเยอะทุกเฟรม', steps: [`เกมวาดที่ ${Math.round(res() * 100)}% ให้แล้ว (${Math.round(w * res())}×${Math.round(h * res())})`, 'ถ้ายังกระตุก: ตั้ง "ความคมของภาพ" เป็น 75%'],
      act: S.sharp !== '0.75' ? ['sharp', '0.75', 'ตั้งความคม 75%'] : null });
    // (a fast screen and frames between 58 and 90: uneven; below 60 the cap would not help, above 90 it is smooth)
    if (M.hz > 75 && M.n >= 3 && M.fps >= 58 && M.fps < Math.min(90, M.hz * 0.85) && capNow() !== 60 && capNow() !== 30) out.push({ k: 'blue', t: `จอ ${M.hz} Hz แต่เครื่องวาดได้ ${Math.round(M.fps)} ภาพ/วินาที`,
      why: 'เฟรมจะมาไม่สม่ำเสมอ ล็อกไว้ 60 จะลื่นเท่ากันทุกเฟรมและเครื่องเย็นลง', steps: ['ตั้ง "จำกัดเฟรม" เป็น 60'], act: ['cap', '60', 'ตั้ง 60 เลย'] });
    if (M.n >= 3 && M.fps < 30 && lv() >= 2 && D.cls !== 'soft' && D.jit !== false) out.push({ k: 'red', t: 'เครื่องยังลากไม่ไหว',
      why: `ลดภาพถึงระดับ "${LEVELS[lv()].name}" แล้วยังได้ ${Math.round(M.fps)} ภาพ/วินาที`,
      steps: ['อัปเดตไดรเวอร์การ์ดจอ (Intel / AMD / NVIDIA) จากเว็บผู้ผลิต', 'ตั้ง "ผู้เล่นอื่นบนจอ" เป็น ต่ำ และ "เอฟเฟกต์ผู้เล่นอื่น" เป็น 30%', 'เล่นแบบหน้าต่างเล็กลง (ยิ่งจอเล็กยิ่งวาดน้อย)'] });
    if (D.phone) out.push({ k: 'blue', t: 'เล่นบนมือถือ',
      why: 'มือถือร้อนแล้วจะลดความแรงเอง', steps: ['ปิดแอปอื่นที่เปิดค้าง', 'ปิดโหมดประหยัดแบต', 'ถ้าเครื่องร้อน: ตั้ง "จำกัดเฟรม" เป็น 30'] });
    if (!out.some((x) => x.k === 'red' || x.k === 'gold')) out.unshift({ k: 'green', t: 'เครื่องคุณพร้อมแล้ว',
      why: D.cls === 'dgpu' && !D.weak ? 'มีการ์ดจอแยก เบราว์เซอร์ใช้การ์ดจอ ไม่ต้องปรับอะไรที่เครื่อง' : 'ไม่เจออะไรที่ต้องแก้ที่เครื่อง เกมปรับภาพให้เข้ากับเครื่องเองแล้ว', steps: [] });
    return out;
  }
  // (the machine, not the level picked by hand: the auto level, else the first look)
  function verdict() {
    const desktopGpu = desktopGpuState();
    if (desktopGpu?.software) return ['red', 'ไม่ได้ใช้การ์ดจอ'];
    if (desktopGpu?.limitedWebgl) return ['gold', 'WebGL ถูกจำกัด'];
    if (D.cls === 'soft') return ['red', 'ไม่ได้ใช้การ์ดจอ'];
    if (D.jit === false) return ['red', 'ตัวเร่งโค้ดปิดอยู่'];
    let v = mode() === 'auto' ? A.lv : guess();
    if (M.n >= 3 && M.fps < 30 && !M.lock30) v = Math.max(v, 2);
    return v === 0 ? ['green', 'เครื่องแรง'] : v === 1 ? ['blue', 'เครื่องกลาง'] : ['gold', 'เครื่องเบา'];
  }
  const smoothWord = () => (!M.n ? 'กำลังวัด…' : M.fps >= M.target * 0.985 && M.p95 <= 1000 / M.target * 1.08 ? 'ลื่นมาก'
    : M.fps >= M.target * 0.95 ? 'ลื่น' : M.fps >= M.target * 0.7 ? 'พอเล่นได้' : 'กระตุก');
  const gpuLine = () => {
    const kind = { dgpu: D.weak ? 'การ์ดจอแยกรุ่นเก่า' : 'การ์ดจอแยก', igpu: 'ชิปกราฟิกในตัว', apple: 'ชิป Apple', mobile: 'ชิปมือถือ', soft: 'วาดด้วยซีพียู (ไม่ได้ใช้การ์ดจอ)', unknown: 'ไม่ทราบรุ่น' }[D.cls];
    if (D.cls === 'soft' && desktopGpuState()?.limitedWebgl && !desktopGpuState()?.software) return 'ไม่ทราบรุ่น <small>WebGL ถูกจำกัด</small>';
    return D.cls === 'soft' ? kind : `${esc(D.gpu || '–')} <small>${kind}</small>`;
  };

  // ---------------- the check window (over the ESC menu, in its K look) ----------------
  let over = null, live = 0;
  function openCheck() {
    const wrap = document.querySelector('#menuwin .mn-wrap');
    if (!wrap) return;
    if (!over || !wrap.contains(over)) {
      over = document.createElement('div');
      over.className = 'gx-over';
      wrap.appendChild(over);
      over.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) { if (e.target === over) closeCheck(); return; }
        if (b.dataset.copy) {
          const done = () => NC.HUD && NC.HUD.toast && NC.HUD.toast('คัดลอกแล้ว: วางในช่อง URL ของเบราว์เซอร์');
          if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(done, () => {}); return;
        }
        if (b.dataset.act === 'close') return closeCheck();
        if (b.dataset.act === 'discord') return NC.Discord && NC.Discord.open(); // (the Discord card over this window)
        if (b.dataset.act === 'auto') { setAll('auto'); probe(); A.lv = guess(); A.ceil = 0; S.level = A.lv; save(); apply(); }
        if (b.dataset.act === 'again') { probe(); checkJit(true); readDesktopGpu(); }
        if (b.dataset.set) { G.set(b.dataset.set, b.dataset.v); }
        fill();
        refreshMenu();
      });
    }
    over.hidden = false;
    fill();
    clearInterval(live);
    live = setInterval(() => {
      const mw = $('menuwin');
      if (!over || over.hidden || !mw || mw.hidden) { closeCheck(); return; }
      const f = over.querySelector('[data-live=fps]'); if (f) f.innerHTML = fpsLine();
    }, 500);
  }
  function closeCheck() { clearInterval(live); live = 0; if (over) over.hidden = true; }
  const fpsLine = () => (M.n ? `${Math.round(M.fps)} ภาพ/วินาที <small>${smoothWord()} · งานต่อเฟรม ${M.work.toFixed(1)} ms</small>` : `<small>${smoothWord()} (เล่นสักครู่)</small>`);
  function fill() {
    const [w, h] = native(), f = res(), cap = capNow(), [vk, vt] = verdict();
    const L = LEVELS[lv()], d = window.devicePixelRatio || 1;
    const spec = [
      ['การ์ดจอ', gpuLine()],
      ...(D.desktop ? [['ภาพในแอป', desktopGpuState().label]] : []),
      ['ซีพียู', D.cores ? `${D.cores} เธรด` : 'ไม่ทราบ'],
      ['แรม', D.mem ? `ประมาณ ${D.mem} GB${D.mem >= 8 ? ' ขึ้นไป' : ''}` : 'ไม่ทราบ'], // (browsers round it and stop at 8 or 32)
      ['จอ', `${w}×${h}${d !== 1 ? ` <small>สเกล ${Math.round(d * 100)}%</small>` : ''}${M.hz ? ` <small>${M.hz} Hz</small>` : ''}`],
      ['เบราว์เซอร์', esc(`${D.browser || 'ไม่ทราบ'}${D.ver ? ' ' + D.ver : ''}`)],
      ['โค้ดเกม', D.jit === false ? 'รันช้า <small>ตัวเร่งโค้ด (JIT) ถูกปิด</small>' : D.jit ? 'รันเร็วปกติ <small>JIT เปิด</small>' : D.chromium ? '<small>กำลังวัด…</small>' : '<small>ไม่ทราบ</small>'],
      ['ไฟ', !D.bat ? '<small>ไม่ทราบ</small>' : !D.bat.laptop ? 'ต่อไฟบ้าน' : D.bat.charging ? `เสียบชาร์จ <small>${Math.round(D.bat.level * 100)}%</small>` : `ใช้แบต <small>${Math.round(D.bat.level * 100)}%</small>`],
      ['เฟรมเรต', `<span data-live="fps">${fpsLine()}</span>`],
    ];
    const set = [
      `ระดับ <b>${L.name}</b>${mode() === 'auto' ? ' (อัตโนมัติ)' : ''}`,
      `ความคม <b>${Math.round(f * 100)}%</b> <span class="gx-dim">${Math.round(w * f)}×${Math.round(h * f)}</span>`,
      `แสงกลางคืน <b>${L.light >= 0.5 ? 'ปกติ' : 'เบา'}</b>`,
      `จำกัดเฟรม <b>${cap ? cap : 'ไม่จำกัด'}</b>`,
    ];
    const tp = tips();
    const tag = { red: 'สำคัญ', gold: 'ช่วยได้', blue: 'แนะนำ', green: 'ดีแล้ว' };
    over.innerHTML = '<section class="kw-win gx-win"><header class="kw-title"><span>เช็คเครื่อง</span><button class="kw-x" data-act="close" aria-label="ปิด">✕</button></header>' +
      '<div class="gx-body"><div class="gx-left">' +
        `<div class="gx-verdict kw-inset"><span class="gx-chip ${vk}">${vt}</span><span class="gx-vsub">${mode() === 'auto' ? 'เกมเลือกระดับภาพ' : 'คุณเลือกระดับภาพ'} <b>${L.name}</b>${mode() === 'auto' ? ' ให้' : ''}</span></div>` +
        '<div class="gx-spec kw-inset">' + spec.map(([k, v]) => `<span class="gx-k">${k}</span><span class="gx-v">${v}</span>`).join('') + '</div>' +
        '<div class="gx-auto kw-info"><span class="i">i</span><span><span class="gx-ah">เกมปรับให้แล้ว</span>' + set.join('<br>') + '</span></div>' +
      '</div><div class="gx-right"><div class="gx-rh">ควรปรับอะไรที่เครื่อง <small>เรียงจากช่วยได้มากสุด</small></div><div class="gx-tips kw-scroll">' +
        tp.map((x, i) => `<div class="gx-tip ${x.k}"><span class="gx-num">${x.k === 'green' ? '✓' : i + 1}</span><div class="gx-tb">` +
          `<h4>${x.t} <span class="gx-tag ${x.k}">${tag[x.k]}</span></h4><p>${x.why}</p>` +
          (x.steps.length ? '<ol>' + x.steps.map((s) => `<li>${s}</li>`).join('') + '</ol>' : '') +
          (x.more ? `<p class="gx-more">${x.more}</p>` : '') +
          (x.act ? `<button class="kw-btn blue gx-do" data-set="${x.act[0]}" data-v="${x.act[1]}">${x.act[2]}</button>` : '') +
        '</div></div>').join('') +
      '</div></div></div>' +
      '<footer class="gx-foot"><span class="gx-note">เบราว์เซอร์บอกรุ่นซีพียูไม่ได้ และบางเครื่องไม่บอกรุ่นการ์ดจอ</span>' +
        (NC.Discord ? '<button class="kw-btn blue" data-act="discord">ยังกระตุก? แจ้งใน Discord</button>' : '') + // (js/discord.js)
        '<button class="kw-btn grey" data-act="again">ตรวจใหม่</button><button class="kw-btn gold" data-act="auto">ให้เกมปรับเองทั้งหมด</button></footer></section>';
  }
  // the menu's rows show the new values
  function refreshMenu() {
    // (menuwin re-renders its rows after any pill: press จำกัดเฟรม's lit pill again, which changes nothing)
    const on = document.querySelector(`#mn-sets .mn-pill.on[data-set="x${rows.indexOf(capRow)}"]`);
    if (on) on.click();
  }

  // ---------------- ESC -> ตั้งค่า ----------------
  function setAll(v) {
    S.mode = v; S.sharp = 'auto'; S.cap = 'auto';
    if (NC.Crowd && NC.Crowd.set) NC.Crowd.set('auto');
  }
  const G = (NC.Gfx = {
    LEVELS, D, M, A, S,
    get frameCap() { return capNow(); },
    get profile() { return SCENE[Math.min(2, lv())]; },
    res, skip, sceneChanged,
    lightK: () => LEVELS[lv()].light,
    level: lv,
    relief: () => (mode() === 'auto' ? A.relief : 0),
    set(key, v) {
      if (key === 'mode' && MODES.includes(v)) {
        S.mode = v;
        if (v === 'auto') { if (NC.Crowd && NC.Crowd.set) NC.Crowd.set('auto'); }
        else {
          if (A.relief) setRelief(0, performance.now()); // (a level the player picks: the effects as they set them)
          if (NC.Crowd && NC.Crowd.set) NC.Crowd.set(v);
          if (NC.OtherFX && NC.OtherFX.set) NC.OtherFX.set({ high: 100, mid: 60, low: 30 }[v]);
        }
      }
      if (key === 'sharp' && SHARPS.includes(v)) S.sharp = v;
      if (key === 'cap' && CAPS.includes(v)) S.cap = v;
      if (key === 'level') { setLevel(+v); return; }
      bad = 0; hist.length = 0; budget = 0;
      save(); apply();
    },
    open: openCheck,
    tips,
    checkJit: () => { checkJit(true); return D.jitR; },
  });
  const rows = (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []);
  rows.push({
    name: 'เครื่องของคุณ', group: 'perf',
    get note() { const [, vt] = verdict(), gpu = D.gpu.replace(/^(NVIDIA|AMD|Intel)\s+/i, '').replace(/^GeForce\s+/i, ''); return `${vt}${gpu && D.cls !== 'soft' ? ' · ' + esc(gpu) : ''}${M.n ? ' · ' + Math.round(M.fps) + ' fps' : ''}`; },
    opts: [['check', 'เช็คเครื่อง + คำแนะนำ']],
    get: () => '',
    set: () => setTimeout(openCheck, 0), // (after menuwin re-renders its rows)
  });
  rows.push({
    name: 'คุณภาพภาพ', group: 'perf',
    get note() { return mode() === 'auto' ? `ตอนนี้ระดับ ${LEVELS[A.lv].name} · ลดเองเมื่อเฟรมตก เพิ่มเองเมื่อลื่น` : 'ตายตัวที่ระดับนี้ · ตั้งผู้เล่นอื่นและเอฟเฟกต์ให้ตาม'; },
    opts: [['auto', 'อัตโนมัติ'], ['high', 'สูง'], ['mid', 'กลาง'], ['low', 'ต่ำ']],
    get: () => mode(),
    set: (v) => G.set('mode', v),
  });
  rows.push({
    name: 'ความคมของภาพ', group: 'perf',
    get note() { const [w, h] = native(), f = res(); return `ตอนนี้ ${Math.round(f * 100)}% (${Math.round(w * f)}×${Math.round(h * f)}) · ต่ำลง = ลื่นขึ้น ภาพนุ่มลง`; },
    opts: [['auto', 'อัตโนมัติ'], ['1', '100%'], ['0.75', '75%'], ['0.5', '50%']],
    get: () => S.sharp,
    set: (v) => G.set('sharp', v),
  });
  const capRow = {
    name: 'จำกัดเฟรม', group: 'perf',
    get note() { return `${M.hz ? 'จอราว ' + M.hz + ' Hz · ' : ''}อัตโนมัติ = 60 · ไม่จำกัดยังขึ้นกับ Hz จอ · 30 = เครื่องเย็น แบตอึด`; },
    opts: [['auto', 'อัตโนมัติ'], ['0', 'ไม่จำกัด'], ['60', '60'], ['30', '30']],
    get: () => S.cap,
    set: (v) => G.set('cap', v),
  };
  rows.push(capRow);
})();
