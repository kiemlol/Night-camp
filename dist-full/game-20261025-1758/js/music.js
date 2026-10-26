/* music.js — the map music (the user, 2026-10-05: "ทำระบบเพลงในเกมเลย"; the tracks: Suno V6, one per map, the early
   maps mixed with atmospheric drum-and-bass versions; tools/music_pack.py -> assets/music/<map id>.m4a + js/music_list.js).
   - each map plays its own track; a new map's track fades in as the old one fades out (a map without a track keeps
     the music that is playing)
   - a track loops by crossfading into its own start a few seconds before its end (the Suno tracks end with a fade)
   - browsers only allow sound after the player's first key or click: the music starts then
   - quiet while the title film / story film is on screen (#intro), paused while the tab is hidden (several game tabs
     never play at once)
   - ESC menu -> ตั้งค่า: "เพลง" volume (ปิด / เบา / กลาง / ดัง), kept in localStorage nightcamp.music.vol
   NC.Music: { play(mapId), now, vol, set(v) }. Load after js/music_list.js. */
(function () {
  'use strict';
  const NC = window.NC;
  const TR = NC.MUSIC_TRACKS || {};
  const KEY = 'nightcamp.music.vol';
  const FADE = 2.2, XLOOP = 5;                        // seconds: between maps, the loop's crossfade
  const off = false;
  let vol = 0.5;
  try { const v = localStorage.getItem(KEY); if (v !== null && !isNaN(+v)) vol = +v; } catch (e) { /* (private window) */ }

  // two players crossfading: each { a: Audio, id, g: its own fade gain 0..1, to: the target, rate }
  const mk = () => { const a = new Audio(); a.preload = 'auto'; return { a, id: null, g: 0, to: 0, rate: 1 / FADE }; };
  const P = [mk(), mk()];
  let cur = null, unlocked = false, want = null;

  function apply() {
    const hidden = document.hidden || film();
    for (const p of P) p.a.volume = Math.max(0, Math.min(1, p.g * vol * (hidden ? 0 : 1)));
  }
  const film = () => { const el = document.getElementById('intro'); return !!(el && el.isConnected && getComputedStyle(el).display !== 'none'); };

  function start(id, loop) {
    const t = TR[id];
    if (!t) return;
    const free = P.find((p) => p !== cur && p.g <= 0.001) || P.find((p) => p !== cur) || P[0];
    if (cur && cur !== free) { cur.to = 0; cur.rate = 1 / (loop ? XLOOP : FADE); }
    if (free.id !== id || !free.a.src) { free.a.src = t.src; free.id = id; }
    free.a.currentTime = 0;
    free.g = 0; free.to = 1; free.rate = 1 / (loop ? XLOOP : FADE);
    const pr = free.a.play();
    if (pr && pr.catch) pr.catch(() => { unlocked = false; });
    cur = free;
  }

  function play(id) {
    want = id;
    if (off || !unlocked || !TR[id]) return;
    if (cur && cur.id === id && cur.to > 0) return;
    start(id, false);
  }

  // the clock: fades, the loop, the map we are on
  let last = performance.now();
  setInterval(() => {
    const now = performance.now(), dt = Math.min(0.5, (now - last) / 1000);
    last = now;
    const g = NC.game;
    if (g && g.mapId && g.mapId !== want && TR[g.mapId]) play(g.mapId);
    for (const p of P) {
      if (p.g < p.to) p.g = Math.min(p.to, p.g + p.rate * dt);
      else if (p.g > p.to) p.g = Math.max(p.to, p.g - p.rate * dt);
      if (p.g <= 0 && p.to <= 0 && !p.a.paused) p.a.pause();
    }
    // the loop: near the end, the same track again from the start on the other player
    if (cur && cur.a.duration && cur.a.currentTime > cur.a.duration - XLOOP - 0.2 && cur.to > 0) start(cur.id, true);
    if (document.hidden) { for (const p of P) if (!p.a.paused) p.a.pause(); }
    else for (const p of P) if (p.to > 0 && p.a.paused && unlocked && p.a.src) { const pr = p.a.play(); if (pr && pr.catch) pr.catch(() => {}); }
    apply();
  }, 100);

  // the first key or click allows sound
  function unlock() {
    if (unlocked || off) return;
    unlocked = true;
    const id = want || (NC.game && NC.game.mapId);
    if (id) { want = null; play(id); }
  }
  addEventListener('keydown', unlock, true);
  addEventListener('pointerdown', unlock, true);
  addEventListener('touchstart', unlock, true);

  function set(v) {
    vol = +v;
    try { localStorage.setItem(KEY, String(vol)); } catch (e) { /* (private window) */ }
    apply();
  }
  NC.Music = { play, set, get vol() { return vol; }, get now() { return cur && cur.to > 0 ? cur.id : null; }, tracks: TR, _players: P };   // (_players: for tests)

  // ESC menu -> ตั้งค่า
  const rows = (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []);
  const OPTS = [['0', 'ปิด'], ['0.25', 'เบา'], ['0.5', 'กลาง'], ['0.85', 'ดัง']];
  rows.push({
    name: 'เพลง', note: 'เพลงประจำแมพ (แต่ละแมพมีเพลงของตัวเอง)', opts: OPTS,
    get: () => OPTS.reduce((b, o) => (Math.abs(+o[0] - vol) < Math.abs(+b[0] - vol) ? o : b))[0],
    set: (v) => set(v),
  });
})();
