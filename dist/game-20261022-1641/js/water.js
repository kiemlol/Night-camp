/* water.js — the ponds move (the user, 2026-09-29: "บ่อน้ำผมอยากได้แบบขยับได้"). The map generator bakes each pond into
   the ground (fieldgen.js: shore, water, the deep middle, lily pads, outline); over it, every frame, inside the pond:
     waves      two layers of wave crests drifting slowly in opposite directions (a tiling pattern)
     glints     sparkles of sun or moon light winking on the surface
     ripples    rings where a fish rises, a leaf lands, a bobber plops (NC.Water.ripple)
     fish       dark fish shadows gliding under the surface (the fishing uses them too: js/life_fish.js)
     moon       at night a wobbling streak of moonlight
     shore      a line of foam lapping at the edge
   Lava ponds (pond.glow, the volcano) bubble and glow instead. Drawn by game.js right after the ground
   (NC.drawWater), under the decals and everything standing. NC.Water.extra: more drawings inside a pond's outline
   ((ctx, game, pond, t) => ..., the fishing's bobber and the fish that comes for it). */
(function () {
  'use strict';
  const NC = window.NC, V = NC.VFX, TAU = Math.PI * 2;
  const W = (NC.Water = { extra: [], ripples: [] });

  // ---------------- geometry ----------------
  const inPoly = (pts, x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const scalePoly = (pts, cx, cy, k) => pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
  const trace = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  // the point of the outline nearest to (x, y), and the way into the water from there
  function shorePoint(p, x, y) {
    const P = p.pts;
    let best = null, bd = Infinity;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [ax, ay] = P[j], [bx, by] = P[i], dx = bx - ax, dy = by - ay;
      const t = NC.clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const qx = ax + dx * t, qy = ay + dy * t, d = Math.hypot(x - qx, y - qy);
      if (d < bd) { bd = d; best = [qx, qy]; }
    }
    return { x: best[0], y: best[1], d: bd };
  }
  W.inPoly = inPoly; W.shorePoint = shorePoint;
  W.inWater = (p, x, y) => inPoly(p.inner || p.pts, x, y);
  W.pondAt = (game, x, y, pad) => {
    const w = game.world;
    if (!w || !w.ponds) return null;
    let best = null, bd = pad || 0;
    for (const p of w.ponds) {
      if (inPoly(p.pts, x, y)) return p;
      if (pad) { const s = shorePoint(p, x, y); if (s.d < bd) { bd = s.d; best = p; } }
    }
    return best;
  };

  // ---------------- the wave crests: a tile of short wavy strokes (wraps both ways) ----------------
  const TW = 512, TH = 256;
  function waveTile(rgb, seed, n, width) {
    const c = document.createElement('canvas'); c.width = TW; c.height = TH;
    const g = c.getContext('2d'), R = NC.rng(seed);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let row = 0; row < 15; row++) {
      const y0 = row * (TH / 15) + R() * 8;
      for (let k = 0; k < n; k++) {
        const x0 = R() * TW, len = 34 + R() * 80, amp = 1.6 + R() * 2.6, a = 0.35 + R() * 0.55, lw = width * (0.7 + R() * 0.7);
        for (const ox of [0, -TW, TW]) for (const oy of [0, -TH, TH]) {
          if (x0 + ox > TW + 10 || x0 + ox + len < -10 || y0 + oy > TH + 10 || y0 + oy < -10) continue;
          g.strokeStyle = `rgba(${rgb},${a})`; g.lineWidth = lw;
          g.beginPath();
          for (let s = 0; s <= 14; s++) { const x = x0 + ox + (s / 14) * len, y = y0 + oy + Math.sin((s / 14) * TAU) * amp; s ? g.lineTo(x, y) : g.moveTo(x, y); }
          g.stroke();
        }
      }
    }
    return c;
  }
  let pats = null;
  function patterns(ctx) {
    if (pats) return pats;
    pats = {
      light: ctx.createPattern(waveTile('255,255,255', 11, 6, 3), 'repeat'),
      dark: ctx.createPattern(waveTile('20,40,70', 23, 5, 4), 'repeat'),
      lava: ctx.createPattern(waveTile('255,220,120', 37, 5, 4), 'repeat'),
      crust: ctx.createPattern(waveTile('40,16,10', 41, 5, 6), 'repeat'),
    };
    return pats;
  }
  const place = (pat, x, y, sx, sy) => { if (pat.setTransform) pat.setTransform(new DOMMatrix([sx || 1, 0, 0, sy || 1, x, y])); return pat; };

  // ---------------- a pond's own moving things ----------------
  function setup(p, i) {
    if (p.wSet) return;
    p.wSet = true;
    p.inner = scalePoly(p.pts, p.x, p.y, 0.94);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of p.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    p.box = [x0, y0, x1, y1];
    p.seed = i * 97 + Math.round(p.x);
    const R = NC.rng(p.seed);
    const n = p.glow ? 0 : NC.clamp(Math.round((p.rx * p.ry) / 26000), 2, 7);
    p.fish = [];
    for (let k = 0; k < n; k++) {
      const f = { x: p.x, y: p.y, a: R() * TAU, s: 0.7 + R() * 0.7, v: 0, tx: p.x, ty: p.y, wig: R() * TAU, wait: R() * 2 };
      pick(p, f, R); f.x = f.tx; f.y = f.ty; pick(p, f, R);
      p.fish.push(f);
    }
    p.nextRip = R() * 2;
  }
  function pick(p, f, R) {
    for (let k = 0; k < 20; k++) {
      const a = (R ? R() : Math.random()) * TAU, rr = Math.sqrt(R ? R() : Math.random()) * 0.8;
      const x = p.x + Math.cos(a) * p.rx * rr, y = p.y + Math.sin(a) * p.ry * rr;
      if (inPoly(p.inner, x, y) && inPoly(p.inner, x + 30, y) && inPoly(p.inner, x - 30, y)) { f.tx = x; f.ty = y; return; }
    }
    f.tx = p.x; f.ty = p.y;
  }
  W.ripple = (p, x, y, r, o) => W.ripples.push(Object.assign({ p, x, y, r: r || 26, t: 0, life: 1.1, rgb: '255,255,255', a: 0.7 }, o || {}));

  function update(game, dt) {
    const w = game.world;
    if (!w || !w.ponds) return;
    w.ponds.forEach((p, i) => {
      setup(p, i);
      for (const f of p.fish) {
        if (f.lure) continue; // (called over by the fishing)
        if (f.wait > 0) { f.wait -= dt; f.v *= 0.9; continue; }
        const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
        if (d < 12) { f.wait = 0.6 + Math.random() * 2.2; pick(p, f); continue; }
        const want = Math.atan2(dy, dx), da = Math.atan2(Math.sin(want - f.a), Math.cos(want - f.a));
        f.a += NC.clamp(da, -2.2 * dt, 2.2 * dt);
        f.v = NC.lerp(f.v, 38 * f.s + 14, dt * 1.5);
        f.x += Math.cos(f.a) * f.v * dt; f.y += Math.sin(f.a) * f.v * dt * 0.62;
        f.wig += dt * (4 + f.v * 0.08);
      }
      p.nextRip -= dt;
      if (p.nextRip <= 0 && !p.glow) { // (a fish rises somewhere)
        p.nextRip = 1.2 + Math.random() * 3.2;
        const f = p.fish[Math.floor(Math.random() * p.fish.length)];
        if (f) W.ripple(p, f.x, f.y, 18 + f.s * 14, { a: 0.55 });
      }
    });
    for (let i = W.ripples.length - 1; i >= 0; i--) { const r = W.ripples[i]; r.t += dt; if (r.t >= r.life) W.ripples.splice(i, 1); }
  }

  // ---------------- drawing ----------------
  function nightOf(game) {
    const hr = (((game.minutes / 60) % 24) + 24) % 24;
    const n = hr < 5 || hr >= 19.5 ? 1 : hr < 7 ? (7 - hr) / 2 : hr >= 17.5 ? (hr - 17.5) / 2 : 0;
    return game.world && game.world.dusk ? Math.max(n, game.world.dusk) : n;
  }
  function fishShape(ctx, f, a) {
    const L = 34 * f.s, H = 11 * f.s, wag = Math.sin(f.wig) * 0.35;
    ctx.save();
    ctx.translate(f.x, f.y); ctx.scale(1, 0.62); ctx.rotate(f.a);
    ctx.fillStyle = `rgba(12,24,40,${a})`;
    ctx.beginPath(); ctx.ellipse(0, 0, L * 0.5, H * 0.5, 0, 0, TAU); ctx.fill();
    ctx.rotate(wag);
    ctx.beginPath(); ctx.moveTo(-L * 0.4, 0); ctx.lineTo(-L * 0.78, -H * 0.55); ctx.lineTo(-L * 0.7, 0); ctx.lineTo(-L * 0.78, H * 0.55); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  W.fishShape = fishShape;
  function sparkle(ctx, x, y, s, a, rgb) {
    V.glow(ctx, x, y, s * 2.4, rgb, 0.55 * a, true);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${a})`;
    V.flarePath(ctx, x, y, s, s * 0.22, 0); ctx.fill(); ctx.restore();
  }

  function drawPond(ctx, game, p, t, night) {
    const P = patterns(ctx), [x0, y0, x1, y1] = p.box, w = x1 - x0, h = y1 - y0;
    ctx.save();
    trace(ctx, p.inner); ctx.clip();
    if (p.glow) {
      // lava: glowing currents, a dark crust drifting over them, bubbles swelling and popping
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.34 + 0.08 * Math.sin(t * 1.3);
      ctx.fillStyle = place(P.lava, t * 9, t * 3, 1.3, 1.3); ctx.fillRect(x0, y0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.45; ctx.fillStyle = place(P.crust, -t * 6, 40 + t * 2, 1.5, 1.2); ctx.fillRect(x0, y0, w, h);
      ctx.globalAlpha = 1;
      const R = NC.rng(p.seed), n = Math.round((p.rx * p.ry) / 9000);
      for (let k = 0; k < n; k++) {
        const u = R() * TAU, rr = Math.sqrt(R()) * 0.85, bx = p.x + Math.cos(u) * p.rx * rr, by = p.y + Math.sin(u) * p.ry * rr, per = 2.2 + R() * 3, ph = ((t + R() * per) % per) / per;
        const s = (6 + R() * 10) * Math.sin(Math.min(1, ph / 0.85) * Math.PI * 0.5);
        if (ph > 0.85) { V.glow(ctx, bx, by, s * 3.5, '255,190,90', (1 - ph) / 0.15 * 0.8, true); continue; }
        ctx.fillStyle = 'rgba(255,170,60,0.85)'; ctx.beginPath(); ctx.ellipse(bx, by, s, s * 0.7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,240,190,0.9)'; ctx.beginPath(); ctx.ellipse(bx - s * 0.3, by - s * 0.3, s * 0.3, s * 0.2, 0, 0, TAU); ctx.fill();
      }
    } else {
      // two layers of wave crests drifting apart, the light one brighter by day
      ctx.globalAlpha = NC.lerp(0.42, 0.26, night);
      ctx.fillStyle = place(P.light, t * 14, t * 3.5, 1, 0.62); ctx.fillRect(x0, y0, w, h);
      ctx.globalAlpha = NC.lerp(0.2, 0.28, night);
      ctx.fillStyle = place(P.dark, -t * 10 + 170, t * 2.2 + 60, 1.25, 0.7); ctx.fillRect(x0, y0, w, h);
      ctx.globalAlpha = 1;
      // fish shadows (under the glints)
      const fa = NC.lerp(0.22, 0.3, night);
      for (const f of p.fish) fishShape(ctx, f, fa * (f.lure ? 1.25 : 1));
      // the moon on the water
      if (night > 0.3) {
        const mx = p.x + p.rx * 0.15, my = p.y - p.ry * 0.35, a = (night - 0.3) / 0.7;
        V.glow(ctx, mx, my, p.rx * 0.22, '190,210,255', 0.28 * a, false, 0.5);
        for (let k = 0; k < 6; k++) {
          const yy = my - 18 + k * 7, ww = (28 - Math.abs(k - 2.5) * 6) * (1 + 0.25 * Math.sin(t * 2.3 + k * 1.7)), xx = mx + Math.sin(t * 1.6 + k) * 4;
          ctx.strokeStyle = `rgba(235,242,255,${0.55 * a})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(xx - ww, yy); ctx.lineTo(xx + ww, yy); ctx.stroke();
        }
      }
      // glints winking (they move to a new spot each time)
      const n = Math.round((p.rx * p.ry) / 11000), rgb = night > 0.5 ? '200,220,255' : '255,250,220';
      for (let k = 0; k < n; k++) {
        const per = 1.6 + (k % 4) * 0.45, q = t / per + k * 0.37, ph = q % 1, cyc = Math.floor(q);
        if (ph > 0.35) continue;
        const R = NC.rng(p.seed + k * 131 + cyc * 7), u = R() * TAU, rr = Math.sqrt(R()) * 0.85;
        const gx = p.x + Math.cos(u) * p.rx * rr, gy = p.y + Math.sin(u) * p.ry * rr, k2 = Math.sin((ph / 0.35) * Math.PI);
        sparkle(ctx, gx, gy, (5 + R() * 5) * k2, k2 * NC.lerp(0.95, 0.75, night), rgb);
      }
    }
    // rings
    for (const r of W.ripples) {
      if (r.p !== p) continue;
      const u = r.t / r.life, rr = r.r * (0.3 + u * 1.4), a = r.a * (1 - u);
      ctx.strokeStyle = `rgba(${r.rgb},${a})`; ctx.lineWidth = 3 * (1 - u) + 1;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, rr, rr * 0.45, 0, 0, TAU); ctx.stroke();
      if (u < 0.6) { ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${r.rgb},${a * 0.6})`; ctx.beginPath(); ctx.ellipse(r.x, r.y, rr * 0.55, rr * 0.25, 0, 0, TAU); ctx.stroke(); }
    }
    for (const f of W.extra) f(ctx, game, p, t);
    ctx.restore();
    // foam lapping at the edge (outside the clip: over the outline's inner side)
    if (!p.glow) {
      ctx.save();
      trace(ctx, scalePoly(p.pts, p.x, p.y, 0.965 + 0.012 * Math.sin(t * 1.4)));
      ctx.setLineDash([26, 18, 10, 22]); ctx.lineDashOffset = -t * 16;
      ctx.strokeStyle = `rgba(255,255,255,${NC.lerp(0.4, 0.22, night)})`; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }
  }

  let last = 0;
  NC.drawWater = function (ctx, game, cx, cy) {
    const w = game.world;
    if (!w || !w.ponds || !w.ponds.length) return;
    const t = game.time || 0, dt = NC.clamp(t - last, 0, 0.1);
    last = t;
    update(game, dt);
    const night = nightOf(game), vw = game.vw, vh = game.vh;
    for (const p of w.ponds) {
      const [x0, y0, x1, y1] = p.box;
      if (x1 < cx - 40 || x0 > cx + vw + 40 || y1 < cy - 40 || y0 > cy + vh + 40) continue;
      drawPond(ctx, game, p, t, night);
    }
  };
})();
