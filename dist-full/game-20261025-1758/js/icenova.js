/* icenova.js — an ice crystal burst, TEST ONLY (not on a skill), after the user's frame sheet of a cartoon 3D crystal burst
   and its recipe (2026-10-07: "ลองทำสกิลแบบนี้ให้หน่อย อันนี้สูตรที่เขาแคปมา" → "ทำตัวทดสอบก่อน"; the first try with flat
   stickers was "ไม่เหมือนเลย" → "ทำด้วย blender เลย").
     3D (Blender, tools/blender/icenova_kit.py → assets/vfx3d/icenova): the pale glassy crystal ball turning; the burst as a
       flipbook (a star of cel-shaded crystals bursting out of the middle, crystals thrown out that land stuck in the ground,
       a ring of crystals growing out of the ground from the middle outward)
     2D pieces (Codex, assets/gen/make_icenova_prompts.py → assets/vfx2d/icenova): the golden swoosh, cartoon smoke puffs
     code: speed lines, light rays, the screen tint, the ring running out to the real reach, ground cracks, sparks
     timing (the recipe's five beats)
       1 lead-in    0.00  the crystal ball forms in the air, a golden swoosh hugging it, white streaks across it
       2 impact     0.32  one beat of white and black: the ball as a white shape, white / grey puffs, black speed lines
       3 flash      0.38  the whole screen tinted ice teal, the burst's first frames as pale ghosts, white rays
       4 burst      0.45  the crystals burst, blue / golden smoke rolls out, light rays, a thick white ring to the reach
       5 aftermath  1.15  the crystal forest stands on the glowing cracked ground, then fades (gone at 2.3 s)
   NC.IceNovaFX.add(game, x, y, { R }) at a point on the ground (R = the reach, 170). Test: ?icenova (the nearest monster, or
   in front of the hero, every 3 s). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX;
  if (!FX || !V) return;
  const IN = (NC.IceNovaFX = { on: true, R: 170 });
  const rand = NC.rand, TAU = Math.PI * 2;
  const clamp01 = (u) => Math.max(0, Math.min(1, u));
  const ease = (u) => 1 - Math.pow(1 - clamp01(u), 3);
  const backOut = (u, s) => { s = s === undefined ? 1.8 : s; u = clamp01(u) - 1; return u * u * ((s + 1) * u + s) + 1; };
  const curve = (u, pts) => { if (u <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (u <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * ((u - a[0]) / (b[0] - a[0] || 1)); } return pts[pts.length - 1][1]; };

  // ---------------- pictures ----------------
  // (assets/vfx3d/icenova/meta.json, written by tools/icenova_pack.py: frame sizes, the ground centre in a burst frame,
  // px per Blender unit; the burst's reach is 2 Blender units)
  const M = { ball: { w: 384, h: 384, bu: 2.35, cols: 4, n: 8 }, burst: { w: 640, h: 480, n: 24, fps: 30, ox: 320, oy: 284.25, ppb: 98.77, cols: 6 } };
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const IMG = { ball: load('assets/vfx3d/icenova/ball.webp'), burst: load('assets/vfx3d/icenova/burst.webp') };
  for (const n of ['swoosh', 'puff_white', 'puff_grey', 'puff_blue', 'puff_gold']) IMG[n] = load('assets/vfx2d/icenova/' + n + '.png');
  const ok = (n) => IMG[n] && IMG[n].complete && IMG[n].naturalWidth > 0;
  IN.ready = () => Object.keys(IMG).every(ok);
  // a frame of a sheet tinted one colour (the impact's white shape, the flash's pale ghosts): cached per frame
  const tinted = {};
  function tint(sheet, i, col) {
    const key = sheet + i + col;
    if (tinted[key]) return tinted[key];
    const m = M[sheet], c = document.createElement('canvas');
    c.width = m.w; c.height = m.h;
    const g = c.getContext('2d');
    g.drawImage(IMG[sheet], (i % m.cols) * m.w, Math.floor(i / m.cols) * m.h, m.w, m.h, 0, 0, m.w, m.h);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = col; g.fillRect(0, 0, m.w, m.h);
    return (tinted[key] = c);
  }
  // a frame drawn with its point (px, py in the frame) at (x, y), k world units per frame px
  function frame(ctx, sheet, i, x, y, k, px, py, a, col) {
    if (!ok(sheet) || a <= 0.003) return;
    const m = M[sheet];
    ctx.save(); ctx.globalAlpha *= Math.min(1, a);
    if (col) ctx.drawImage(tint(sheet, i, col), x - px * k, y - py * k, m.w * k, m.h * k);
    else ctx.drawImage(IMG[sheet], (i % m.cols) * m.w, Math.floor(i / m.cols) * m.h, m.w, m.h, x - px * k, y - py * k, m.w * k, m.h * k);
    ctx.restore();
  }
  function piece(ctx, n, x, y, w, rot, a, flip) {
    if (!ok(n) || a <= 0.003 || w <= 0.5) return;
    const im = IMG[n], h = w * im.naturalHeight / im.naturalWidth;
    ctx.save(); ctx.globalAlpha *= Math.min(1, a); ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(im, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // ---------------- code-drawn pieces ----------------
  const INK = '#120f2c';
  function taper(ctx, x, y, th, r0, r1, w, col, sy) {
    const c = Math.cos(th), s = Math.sin(th) * (sy || 1), nx = -Math.sin(th), ny = Math.cos(th) * (sy || 1);
    const ax = x + c * r0, ay = y + s * r0, bx = x + c * r1, by = y + s * r1, mx = x + c * (r0 + (r1 - r0) * 0.3), my = y + s * (r0 + (r1 - r0) * 0.3);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(mx + nx * w, my + ny * w); ctx.lineTo(bx, by); ctx.lineTo(mx - nx * w, my - ny * w); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
  }
  function star(ctx, x, y, r, a, rot) {
    if (a <= 0 || r <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(rot || 0); ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.1, 0); ctx.lineTo(0, r * 0.1); ctx.lineTo(-r * 0.1, 0); ctx.closePath(); ctx.fill(); ctx.rotate(Math.PI / 2); }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // the ring running out on the ground: a thick white band with a motion-blur trail behind it (inside) and a cyan edge
  function ring(ctx, x, y, r, w, a, trail) {
    if (a <= 0 || r <= 1) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(1, 0.58);
    for (let k = 4; k >= 1; k--) { ctx.lineWidth = w * (1 + k * 0.5); ctx.strokeStyle = `rgba(220,248,255,${0.13 * (5 - k) / 4 * trail})`; ctx.beginPath(); ctx.arc(0, 0, Math.max(1, r - k * w * 0.9), 0, TAU); ctx.stroke(); }
    ctx.lineWidth = w + 4; ctx.strokeStyle = 'rgba(110,210,255,0.9)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function makeCracks(R) {
    const L = [];
    const branch = (x0, y0, ang, len, depth) => {
      const pts = [[x0, y0]]; let x = x0, y = y0, a = ang;
      for (let i = 0; i < 6; i++) { a += rand(-0.45, 0.45); x += Math.cos(a) * len / 6; y += Math.sin(a) * len / 6; pts.push([x, y]); }
      L.push({ pts, w: depth === 0 ? 1 : 0.6 });
      if (depth < 2) for (let k = 0; k < 2; k++) if (Math.random() < 0.6) { const j = 2 + Math.floor(Math.random() * 3); branch(pts[j][0], pts[j][1], a + rand(-1.1, 1.1), len * 0.5, depth + 1); }
    };
    for (let i = 0; i < 10; i++) branch(0, 0, (i / 10) * TAU + rand(-0.2, 0.2), R * rand(0.6, 0.95), 0);
    return L;
  }
  function cracks(ctx, x, y, C, grow, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(1, 0.58);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, col] of [[10, 'rgba(90,210,255,0.25)'], [5, '#6fdcff'], [1.8, '#ffffff']]) {
      ctx.strokeStyle = col;
      for (const c of C) {
        const m = Math.max(1, Math.round((c.pts.length - 1) * grow));
        ctx.lineWidth = w * c.w;
        ctx.beginPath(); ctx.moveTo(c.pts[0][0], c.pts[0][1]);
        for (let i = 1; i <= m; i++) ctx.lineTo(c.pts[i][0], c.pts[i][1]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  FX.def('icenova', (ctx, q) => q.paint(ctx), 'glow');

  IN.add = function (game, x, y, o) {
    o = o || {};
    const R = o.R || IN.R;
    const H = R * 0.62;                                      // the ball floats this high over the ground point
    const D = R * 1.05;                                      // the ball's width
    const kBall = D / (M.ball.w * 2 / M.ball.bu);            // world units per ball-frame px (the ball is 2 BU wide in a 2.35 BU frame)
    const kBurst = (R / 2) / M.burst.ppb;                    // world units per burst-frame px (the reach is 2 BU)
    const T1 = 0.32, T2 = 0.38, T3 = 0.45, TEND = 2.3;
    const B = M.burst, bf = (t) => Math.min(B.n - 1, Math.max(0, Math.floor((t - T2) * B.fps)));
    // the particle sets (when, how many, where they go, how they grow and fade)
    const puffs = [], white = [], speed = [], rays = [], sparks = [];
    // (the smoke rolls round the OUTSIDE, as in the reference: the crystals in the middle stay clear)
    for (let i = 0; i < 18; i++) {
      const th = (i / 18) * TAU + rand(-0.15, 0.15), kind = i % 3 === 1 ? 'puff_gold' : i % 6 === 4 ? 'puff_white' : 'puff_blue';
      puffs.push({ n: kind, th, d0: rand(0.45, 0.6) * R, d1: rand(1.05, 1.3) * R, w: rand(0.34, 0.58) * R, t0: rand(0.02, 0.12), life: rand(0.6, 0.9), rot: rand(-0.4, 0.4), flip: Math.random() < 0.5 });
    }
    for (let i = 0; i < 16; i++) { const th = (i / 16) * TAU + rand(-0.2, 0.2), d = (i % 2 ? rand(0.5, 0.8) : rand(0.15, 0.4)) * R; white.push({ n: i % 4 === 3 ? 'puff_grey' : 'puff_white', x: Math.cos(th) * d, y: Math.sin(th) * d * 0.62, w: rand(0.5, 0.85) * R, rot: rand(-0.5, 0.5), flip: Math.random() < 0.5 }); }
    white.sort((a, b) => (a.n === 'puff_grey' ? -1 : 0) - (b.n === 'puff_grey' ? -1 : 0));
    for (let i = 0; i < 30; i++) speed.push({ th: rand(0, TAU), r0: rand(0.75, 1.0) * R, len: rand(0.7, 1.6) * R, w: rand(1.5, 3.5) });
    for (let i = 0; i < 22; i++) rays.push({ th: (i / 22) * TAU + rand(-0.12, 0.12), len: R * rand(1.1, 1.9), w: rand(2.5, 6) });
    for (let i = 0; i < 36; i++) { const th = rand(0, TAU), sp = rand(160, 420); sparks.push({ x: 0, y: 0, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp * 0.6 - 80, life: rand(0.35, 0.8), r: rand(1.8, 3.4), sq: Math.random() < 0.5 }); }
    const C = makeCracks(R);
    let impacted = false, lt = 0;
    if (V.light) V.light(x, y - H * 0.4, R * 2.4, '150,230,255', 0.55, TEND);

    return FX.add({ type: 'icenova', x, y, life: TEND, paint(ctx) {
      const t = this.t, dt = Math.max(0, Math.min(0.05, t - lt)); lt = t;
      const bx = x, by = y - H;
      if (!impacted && t >= T1) {
        impacted = true;
        game.hitstop = Math.max(game.hitstop || 0, 0.08);
        V.shake(game, 12);
        if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(x, by, 0.05, 0.28);
      }
      const end = curve(t, [[1.75, 1], [TEND, 0]]);       // everything left fades at the end
      // ---- 5 the ground: cracks and the ring (under the rest)
      if (t >= T3) {
        cracks(ctx, x, y, C, ease((t - T3) / 0.18), Math.min(curve(t, [[T3, 1], [1.5, 0.95]]), end));
        const u = (t - T3) / 0.34;
        ring(ctx, x, y, R * (0.2 + 0.85 * ease(u)), 15 * (1 - 0.55 * clamp01(u)), curve(u, [[0, 1], [0.85, 0.95], [1.5, 0]]), 1 - clamp01(u));
        ring(ctx, x, y, R * (0.12 + 0.55 * ease((t - T3) / 0.7)), 5, Math.min(curve(t, [[T3, 0], [T3 + 0.12, 0.6]]), end) * 0.8, 0);
      }
      // ---- 4 burst: smoke behind the crystals
      const puffAt = (p, tb) => {
        const u = (tb - p.t0) / p.life;
        if (u < 0 || u > 1) return null;
        const d = p.d0 + (p.d1 - p.d0) * ease(u * 1.6);
        return { u, x: x + Math.cos(p.th) * d, y: y - R * 0.12 + Math.sin(p.th) * d * 0.58 - u * 26 };
      };
      if (t >= T3) for (const p of puffs) if (Math.sin(p.th) < 0) { const s = puffAt(p, t - T3); if (s) piece(ctx, p.n, s.x, s.y, p.w * (0.5 + 0.7 * ease(s.u)), p.rot, curve(s.u, [[0, 0], [0.08, 1], [0.6, 0.95], [1, 0]]), p.flip); }
      // ---- 1 lead-in: the ball turning, the golden swoosh hugging it, white streaks
      if (t < T1) {
        const u = t / T1, s = backOut(u / 0.5, 2.0);
        piece(ctx, 'swoosh', bx - D * 0.12, by + D * 0.08, D * 1.35 * Math.max(0.3, s), curve(u, [[0, -0.5], [1, 0.12]]), curve(u, [[0, 0], [0.3, 1]]), true);
        frame(ctx, 'ball', Math.floor(t * 24) % M.ball.n, bx, by, kBall * s, M.ball.w / 2, M.ball.h / 2, curve(u, [[0, 0], [0.12, 1]]));
        for (let k = 0; k < 3; k++) {
          const g = clamp01((u - 0.2 - k * 0.12) / 0.35);
          if (g <= 0) continue;
          const len = D * (1.6 + k * 0.35), off = (k - 1) * D * 0.14;
          ctx.save(); ctx.globalAlpha = curve(g, [[0, 0.95], [0.75, 0.95], [1, 0.2]]);
          taper(ctx, bx - len * 0.45 + off, by + len * 0.24 - off * 0.3, -0.5, 0, len * (0.25 + 0.75 * g), 2.2, '#ffffff');
          ctx.restore();
        }
        star(ctx, bx - D * 0.18, by - D * 0.12, D * 0.28 * curve(u, [[0, 0], [0.5, 0.7], [0.92, 1.3], [1, 1]]), 1, t * 2);
      }
      // ---- 2 impact: white and black only — the ball as a white shape, white / grey puffs, black speed lines
      if (t >= T1 && t < T2 + 0.02) {
        const u = (t - T1) / (T2 + 0.02 - T1);
        ctx.save(); for (const s of speed) taper(ctx, bx, by, s.th, s.r0 * (0.8 + u * 0.4), s.r0 + s.len * (0.8 + u * 0.4), s.w, INK, 0.75); ctx.restore();
        for (const p of white) piece(ctx, p.n, bx + p.x * (1 + u * 0.3), by + p.y * (1 + u * 0.3), p.w * (0.85 + u * 0.3), p.rot, 1, p.flip);
        frame(ctx, 'ball', 0, bx, by, kBall * (1 + u * 0.15), M.ball.w / 2, M.ball.h / 2, 1, '#ffffff');
        star(ctx, bx, by, R * 0.5, 1, 0.3);
      }
      // ---- 3 flash: the screen ice teal, the burst's first frames as pale ghosts, white rays
      if (t >= T2 && t < T3 + 0.02) {
        const a = curve(t, [[T2, 0.88], [T3 - 0.01, 0.82], [T3 + 0.02, 0]]);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(110,204,204,${a})`; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
        ctx.save(); for (const r of rays) taper(ctx, x, y - R * 0.25, r.th, 0, r.len * 0.6, r.w * 1.2, '#ffffff', 0.8); ctx.restore();
        frame(ctx, 'burst', bf(t), x, y, kBurst, B.ox, B.oy, 0.92, '#e8fbff');
      }
      // ---- 4 burst: the crystals (3D flipbook, the last frame held), rays, front smoke, sparks
      if (t >= T3) {
        const tb = t - T3;
        frame(ctx, 'burst', bf(t), x, y, kBurst, B.ox, B.oy, end);
        if (tb < 0.32) { ctx.save(); ctx.globalAlpha = curve(tb, [[0, 1], [0.32, 0]]); for (const r of rays) taper(ctx, x, y - R * 0.2, r.th, R * 0.15 + tb * 340, r.len * (0.55 + tb * 2), r.w, '#ffffff', 0.62); ctx.restore(); }
        for (const p of puffs) if (Math.sin(p.th) >= 0) { const s = puffAt(p, tb); if (s) piece(ctx, p.n, s.x, s.y, p.w * (0.5 + 0.7 * ease(s.u)), p.rot, curve(s.u, [[0, 0], [0.08, 1], [0.6, 0.95], [1, 0]]), p.flip); }
        for (const p of sparks) {
          if (tb > p.life) continue;
          p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.save(); ctx.globalAlpha = 1 - tb / p.life; ctx.fillStyle = '#ffb040';
          if (p.sq) { ctx.translate(x + p.x, y - R * 0.3 + p.y); ctx.rotate(tb * 8); ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); }
          else { ctx.beginPath(); ctx.arc(x + p.x, y - R * 0.3 + p.y, p.r, 0, TAU); ctx.fill(); }
          ctx.restore();
        }
        star(ctx, x, y - R * 0.25, R * 0.45 * curve(tb, [[0, 1], [0.18, 0]]), 1, 0.4);
      }
    } });
  };

})();
