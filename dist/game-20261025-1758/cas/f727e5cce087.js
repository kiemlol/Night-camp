/* aura99.js — the Base Lv 99 aura (the user asked for it on 2026-09-27: the game tops out at 99, so 99 gets a light,
   like classic MMOs'). Every hero at the top level (NC.LV_MAX) stands in a light: a glowing ring on the ground with beads
   of light running round it and a pulse going out, strands of light rising round the body (the ones behind under the
   body, the ones in front over it), sparkles drifting up; at night it lights the ground round them. It shows on me, on
   the other players online (net.js) and on the other adventurers (bots.js) who are 99, not on the AI party (they only
   borrow my level), and it goes out while hidden or fainted and flares up again after. Reaching 99 sets it alight: a
   pillar of light, LEVEL 99!, a line in the log.
   ESC menu: full / light / off, like classic MMOs' /aura (kept in localStorage 'nc.aura99').
   Drawn off fx.js's layers: the ground and the back strands with 'low' (under everyone, before the night lighting: its
   own light keeps it bright), the front strands and the sparkles with 'glow' (after the lighting).
   NC.Aura99: { mode(), set(mode), celebrate(game, p) }. Loaded after worldmap.js, before game.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX;
  const TAU = Math.PI * 2, clamp = NC.clamp, lerp = NC.lerp;
  const RGB = '190,224,255', GOLD = '255,226,150', WHITE = '255,255,255', SQ = 0.42;
  const KEY = 'nc.aura99', MODES = ['full', 'lite', 'off'], LABEL = { full: 'เต็ม', lite: 'เบา', off: 'ปิด' };
  let mode = 'full';
  try { const m = localStorage.getItem(KEY); if (MODES.includes(m)) mode = m; } catch (e) { /* (no storage: the default) */ }
  const MAX = () => NC.LV_MAX || 99;

  // ---------------- who wears it ----------------
  const lit = new WeakMap(); // a holder -> when its aura lit up (it grows in from then)
  const seed = new WeakMap(); // a holder -> its own phase (no two auras pulse together)
  const top = (o) => !!o && o.lv >= MAX() && !(o.dead > 0) && !(NC.heroHidden && NC.heroHidden(o));
  let now = [], prev = new Set();
  function gather(game) {
    const out = [];
    const add = (o, fade) => {
      if (!top(o)) return;
      if (!lit.has(o)) lit.set(o, game.time);
      if (!seed.has(o)) seed.set(o, Math.random() * 10);
      out.push({ o, fade: fade === undefined ? 1 : clamp(fade, 0, 1) });
    };
    add(game.player);
    if (NC.Net && NC.Net.room && NC.Net.onMap) for (const r of NC.Net.onMap()) add(r);
    if (NC.Bots && NC.Bots.list) for (const b of NC.Bots.list) if (b.leaving === undefined) add(b, b.fade);
    // whoever lost it (fainted, hid, left): it flares up again next time
    const here = new Set(out.map((h) => h.o));
    for (const o of prev) if (!here.has(o)) lit.delete(o);
    prev = here;
    return out;
  }
  const onScreen = (game, o) => o.x > game.cam.x - 220 && o.x < game.cam.x + game.vw + 220 && o.y > game.cam.y - 120 && o.y < game.cam.y + game.vh + 320;

  // ---------------- the look ----------------
  // a strand of light: bright at its foot, gone at the top, soft at the sides (drawn once, stamped with 'lighter')
  let SPR = null;
  function sprites() {
    if (SPR) return SPR;
    const make = (w, h, rgb, a) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d'), vg = g.createLinearGradient(0, h, 0, 0);
      vg.addColorStop(0, `rgba(${rgb},${a})`); vg.addColorStop(0.3, `rgba(${rgb},${a * 0.62})`); vg.addColorStop(0.75, `rgba(${rgb},${a * 0.16})`); vg.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = vg; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-in';
      const hg = g.createLinearGradient(0, 0, w, 0);
      hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.5, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = hg; g.fillRect(0, 0, w, h);
      return c;
    };
    return (SPR = { soft: make(32, 192, RGB, 0.9), core: make(8, 192, WHITE, 1) });
  }

  // the ground: a pool of light, a ring and a finer turning one inside, a pulse going out, beads running round
  function ground(ctx, x, y, t, A, s, lite) {
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2 + s);
    if (!lite) V.glow(ctx, x, y - 92, 64, RGB, 0.14 * A * pulse, false, 1.8); // (a soft halo standing behind the body)
    V.glow(ctx, x, y, 124, RGB, 0.42 * A * pulse, false, SQ);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y); ctx.scale(1, SQ);
    ctx.beginPath(); ctx.arc(0, 0, 80, 0, TAU);
    ctx.lineWidth = 11; ctx.strokeStyle = `rgba(${RGB},${0.18 * A})`; ctx.stroke();
    ctx.lineWidth = 2.8; ctx.strokeStyle = `rgba(236,247,255,${0.8 * A * pulse})`; ctx.stroke();
    if (!lite) {
      ctx.beginPath(); ctx.arc(0, 0, 58, 0, TAU);
      ctx.setLineDash([9, 13]); ctx.lineDashOffset = -t * 26;
      ctx.lineWidth = 2.2; ctx.strokeStyle = `rgba(${RGB},${0.55 * A})`; ctx.stroke();
      ctx.setLineDash([]);
      const u = ((t + s) % 2.2) / 2.2, r = lerp(46, 132, V.easeOut(u));
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
      ctx.lineWidth = 3.4 * (1 - u) + 0.6; ctx.strokeStyle = `rgba(${RGB},${0.5 * (1 - u) * A})`; ctx.stroke();
    }
    ctx.restore();
    const n = lite ? 4 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU - t * 0.9 + s, bx = x + Math.cos(a) * 80, by = y + Math.sin(a) * 80 * SQ;
      V.glow(ctx, bx, by, 11, WHITE, 0.75 * (0.55 + 0.45 * Math.sin(a)) * A, true); // (brighter in front)
    }
  }

  // the strands rising round the body: the ones behind (front = false) or the ones in front. Each one grows up out of
  // the ring, shines and fades, then comes up again elsewhere on it (a golden-angle step), some short, some tall; they
  // sway a little and come brighter at the sides, where the ring of light is seen edge-on
  const N = 14;
  function strands(ctx, x, y, t, A, s, front) {
    const S = sprites();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) {
      const P = 1.5 + (i % 5) * 0.23, c = t / P + ((i * 0.381966 + s * 0.1) % 1), k = Math.floor(c), u = c - k;
      const a = (i / N) * TAU + k * 2.39996 + s + t * 0.25, sn = Math.sin(a);
      if (front !== sn >= 0) continue;
      const sx = x + Math.cos(a) * 58, sy = y + sn * 58 * SQ;
      const grow = V.easeOut(Math.min(1, u / 0.35)), glow = Math.sin(u * Math.PI);
      const tall = 0.55 + 0.45 * (((i * 7 + k * 3) % 5) / 4);
      const h = 175 * tall * grow * A, w = 20 * (0.85 + 0.3 * glow);
      const al = (front ? 0.62 : 0.48) * glow * (0.7 + 0.3 * Math.abs(Math.cos(a))) * A;
      if (al < 0.01 || h < 4) continue;
      const lean = Math.sin(t * 1.1 + i) * 7; // (the top drifts, the foot stays)
      ctx.save();
      ctx.translate(sx, sy); ctx.transform(1, 0, -lean / h, 1, 0, 0);
      ctx.globalAlpha = al;
      ctx.drawImage(S.soft, -w / 2, -h, w, h);
      ctx.globalAlpha = al * 0.7;
      ctx.drawImage(S.core, -w * 0.11, -h * 0.9, w * 0.22, h * 0.9);
      ctx.restore();
    }
    ctx.restore();
  }

  // sparkles spiralling up from the ring, a gold one now and then; the ones behind the body dimmer
  function sparkles(ctx, x, y, t, A, s, n) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let j = 0; j < n; j++) {
      const ph = (j * 0.618034 + s) % 1, P = 2.4 + (j % 3) * 0.5, u = (t / P + ph) % 1;
      const a = ph * TAU + t * 0.7 + j, r = lerp(62, 24, u);
      const sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r * SQ - u * 205;
      const k = Math.sin(u * Math.PI) * A * (Math.sin(a) < 0 ? 0.6 : 1), gold = j % 4 === 0;
      if (k < 0.03) continue;
      V.glow(ctx, sx, sy, 10 * k + 3, gold ? GOLD : RGB, 0.8 * k, true);
      V.flarePath(ctx, sx, sy, (5 + (j % 3) * 2) * k, (5 + (j % 3) * 2) * k * 0.16, t * 2 + j);
      ctx.fillStyle = `rgba(${gold ? GOLD : WHITE},${0.9 * k})`; ctx.fill();
    }
    ctx.restore();
  }

  // the light it gives at night (fx.js ages it; held here while it shows, it fades out by itself once it goes)
  const lights = new WeakMap();
  function light(o, A, lite) {
    let L = lights.get(o);
    if (!L || !FX.lights.includes(L)) {
      L = { x: o.x, y: o.y - 40, r: 260, rgb: '175,205,255', a: 0, life: 0.6, t: 0, follow: o, oy: -40 };
      FX.lights.push(L); lights.set(o, L);
    }
    L.a = (lite ? 0.4 : 0.62) * A; L.t = 0.05;
  }

  // how strong now: grown in over 1.3 s after it lights up, a bot fading out takes it along
  const strength = (game, h) => V.easeOut(clamp((game.time - lit.get(h.o)) / 1.3, 0, 1)) * h.fade;

  const baseDraw = FX.draw;
  FX.draw = function (ctx, layer) {
    const game = NC.game;
    if (layer === 'low' && game && game.player && game.cam) {
      now = mode === 'off' ? [] : gather(game);
      if (mode === 'off') { for (const o of prev) lit.delete(o); prev = new Set(); }
      for (const h of now) {
        if (!onScreen(game, h.o)) continue;
        const A = strength(game, h), s = seed.get(h.o), t = game.time;
        if (A <= 0.005) continue;
        ground(ctx, h.o.x, h.o.y, t, A, s, mode === 'lite');
        if (mode === 'full') strands(ctx, h.o.x, h.o.y, t, A, s, false);
        light(h.o, A, mode === 'lite');
      }
    }
    baseDraw.apply(this, arguments);
    if (layer === 'glow' && game && now.length)
      for (const h of now) {
        if (!onScreen(game, h.o)) continue;
        const A = strength(game, h), s = seed.get(h.o), t = game.time;
        if (A <= 0.005) continue;
        if (mode === 'full') strands(ctx, h.o.x, h.o.y, t, A, s, true);
        sparkles(ctx, h.o.x, h.o.y, t, A, s, mode === 'full' ? 12 : 5);
      }
  };

  // ---------------- reaching 99 ----------------
  function celebrate(game, p) {
    lit.set(p, game.time + 0.35); // (the aura lights up as the pillar lands)
    const stay = { a: 0.7, update(o) { o.x = p.x; o.y = p.y; } }; // (the pillar stays on the hero, who shows through it)
    V.beam(p.x, p.y, 110, 1000, '220,240,255', 1.3, stay);
    V.flash('235,245,255', 0.16, 0.5);
    V.ring(p.x, p.y - 6, 30, 330, 14, RGB, 0.9);
    V.at(0.25, () => V.ring(p.x, p.y - 6, 20, 240, 9, GOLD, 0.8));
    V.stars(p.x, p.y - 90, 22, '#fff4c8', GOLD, { speed: 420 });
    V.motes(p.x, p.y - 20, 26, RGB, { spread: 90, rise: 320, lifeK: 1.6 });
    V.light(p.x, p.y - 60, 560, '220,236,255', 0.9, 2.4, { follow: p, oy: -60 });
    V.shake(game, 8);
    FX.text(p.x, p.y - 265, 'LEVEL 99!', '#fff0b0', 84);
    if (NC.HUD && NC.HUD.log) NC.HUD.log('ยินดีด้วย! Base Lv 99 เลเวลสูงสุดแล้ว · ได้แสงออร่าเลเวล 99 (ปรับเต็ม/เบา/ปิดได้ที่เมนู ESC)', 'level');
  }
  (NC.xpWatchers || (NC.xpWatchers = [])).push((game, was) => {
    const p = game.player;
    if (was.lv < MAX() && p.lv >= MAX()) celebrate(game, p);
  });

  // ---------------- ESC menu: full / light / off ----------------
  const btn = document.getElementById('aura99');
  const label = () => { if (btn) btn.textContent = LABEL[mode]; };
  function set(m) {
    if (!MODES.includes(m)) return;
    mode = m;
    try { localStorage.setItem(KEY, mode); } catch (e) { /* (not kept: fine) */ }
    label();
  }
  if (btn) { label(); btn.addEventListener('click', () => set(MODES[(MODES.indexOf(mode) + 1) % MODES.length])); }

  NC.Aura99 = { mode: () => mode, set, celebrate };
})();
