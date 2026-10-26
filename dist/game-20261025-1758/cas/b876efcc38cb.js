/* voidbreaks.js — more ways for the void dome (js/voiddome.js) to break when its shield runs out. Made 2026-10-06 so the
   user could pick one from a clip ("ลองทำทุกเอฟเฟคเลยแล้วทำเป็นคลิปมาให้ผมเลือก"). NC.VoidDomeFX.breakStyle picks:
     hit       (voiddome.js) a hole opens from the last blow and eats the dome, shards thrown on along the blow
     plates    cracks run between cells from the last blow, the front glass splits into plates that fly off and land
     melt      cracks from the top, the plates come loose top first, fall, and melt into violet pools on the ground
     stardust  the dome dissolves from the top down into specks of light drifting up
     freeze    an impact frame: the moment stops (a negative flash, then dark with the cracks blazing), then the plates
               explode outward
     backlash  the dome pulls in and bursts into crystal thorns that fly into the monsters round it (damage)
     void      the dome collapses into black smoke; ink tendrils reach the monsters round it, drain them (damage, slowed)
               and pull the power back into the hero (heal)
   Each style sets q.brk on the dome (what is left of it, see voiddome.js paint) and adds its own pieces. Plates are the
   dome's front glass baked into a canvas (q.bakeFront) and cut along Voronoi cells laid over its outline. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, GL = NC.GLFX, VD = NC.VoidDomeFX;
  if (!FX || !V || !GL || !VD || !VD._) return;
  const { CP, SP, proj, sparks, sfx, unit, rand, TAU } = VD._;
  const S = GL.SH, P = GL.PAL, C = GL.curve;
  const B = VD.BREAKS;
  FX.def('vb_draw', (ctx, q) => q.paint(ctx), 'glow');
  FX.def('vb_low', (ctx, q) => q.paint(ctx), 'low');
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fadeOut = (t0, d) => (t) => 1 - clamp01((t - t0) / d);
  const k0 = () => 0;

  // ---------------- the front glass cut into cells ----------------
  // the dome's outline on screen (world coords): the top half circle + the front half of its base ellipse (convex)
  function outline(x0, y0, Rn) {
    const o = [];
    for (let i = 0; i <= 20; i++) { const a = (Math.PI * i) / 20; o.push([x0 + Rn * Math.cos(a), y0 - Rn * Math.sin(a)]); }
    for (let i = 1; i < 20; i++) { const a = (Math.PI * i) / 20; o.push([x0 - Rn * Math.cos(a), y0 + 0.5 * Rn * Math.sin(a)]); }
    return o;
  }
  function inside(poly, x, y) {
    let sg = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
      if (c !== 0) { if (!sg) sg = Math.sign(c); else if (Math.sign(c) !== sg) return false; }
    }
    return true;
  }
  // the part of a polygon where (v - m)·n <= 0
  function clip(poly, mx, my, nx, ny) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = (a[0] - mx) * nx + (a[1] - my) * ny, db = (b[0] - mx) * nx + (b[1] - my) * ny;
      if (da <= 0) out.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  // Voronoi cells over the outline, smaller round the focus point: [{ pts (relative to the centre), cx, cy, area }]
  function cells(x0, y0, Rn, n, focus) {
    const ol = outline(x0, y0, Rn), seeds = [], dmin = Rn * Math.sqrt(2.2 / n);
    for (let tries = 0; tries < 4000 && seeds.length < n; tries++) {
      const x = x0 + rand(-Rn, Rn), y = y0 + rand(-Rn, 0.5 * Rn);
      if (!inside(ol, x, y)) continue;
      let d = dmin * rand(0.65, 1.3);   // uneven sizes (even ones look like a honeycomb)
      if (focus) d *= 0.45 + 0.55 * Math.min(1, Math.hypot(x - focus[0], y - focus[1]) / (Rn * 0.9));
      if (seeds.some((s) => Math.hypot(s[0] - x, s[1] - y) < d)) continue;
      seeds.push([x, y]);
    }
    const out = [];
    seeds.forEach((s, i) => {
      let poly = ol;
      for (let j = 0; j < seeds.length && poly.length > 2; j++) if (j !== i) poly = clip(poly, (s[0] + seeds[j][0]) / 2, (s[1] + seeds[j][1]) / 2, seeds[j][0] - s[0], seeds[j][1] - s[1]);
      if (poly.length < 3) return;
      let A = 0, cx = 0, cy = 0;
      for (let k = 0; k < poly.length; k++) { const a = poly[k], b = poly[(k + 1) % poly.length], c = a[0] * b[1] - b[0] * a[1]; A += c; cx += (a[0] + b[0]) * c; cy += (a[1] + b[1]) * c; }
      A /= 2;
      if (Math.abs(A) < 1) return;
      cx /= 6 * A; cy /= 6 * A;
      out.push({ pts: poly.map((v) => [v[0] - cx, v[1] - cy]), cx, cy, area: Math.abs(A) });
    });
    return out;
  }
  const path = (ctx, pts, ox, oy) => { ctx.beginPath(); pts.forEach((v, i) => (i ? ctx.lineTo(ox + v[0], oy + v[1]) : ctx.moveTo(ox + v[0], oy + v[1]))); ctx.closePath(); };
  // the cells' edges as glowing cracks spreading from the focus (k: 0 → 1 → past), w = width in world px
  function drawCracks(ctx, list, k, a, w, focus, Rn) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
    for (const c of list) {
      const d = focus ? Math.hypot(c.cx - focus[0], c.cy - focus[1]) / (Rn * 2.2) : 0, kk = clamp01((k - d) / 0.3) * a;
      if (kk <= 0.01) continue;
      path(ctx, c.pts, c.cx, c.cy);
      ctx.strokeStyle = `rgba(190,110,255,${0.45 * kk})`; ctx.lineWidth = w * 2.8; ctx.stroke();
      ctx.strokeStyle = `rgba(255,236,255,${0.95 * kk})`; ctx.lineWidth = w; ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------- plates: the baked glass, one piece per cell ----------------
  // each plate gets its surface normal N (x across, y up, z toward the camera) and its ground line; launch(pl) sets
  // its motion. A plate tumbles (its width follows cos of a turning phase) and glints when its face turns to us.
  function makePlates(p, list, bake) {
    const Rn = bake.Rn;
    return list.map((c) => {
      const sx = (c.cx - p.x) / Rn, sy = -(c.cy - p.y) / Rn, z = Math.sqrt(Math.max(0, 1 - Math.min(0.999, sx * sx + sy * sy)));
      const N = unit([sx, Math.max(0, sy * CP + z * SP), -sy * SP + z * CP]);
      return Object.assign(c, { N, x: c.cx, y: c.cy, gy: p.y + Math.max(0.05, N[2]) * SP * Rn * 0.9, vx: 0, vy: 0, vgy: 0, rot: 0, spin: 0,
        ph: 0, flip: 0, t: 0, delay: 0, life: 1.2, land: 0, a: 1, melt: -1, sq: 1, grav: 1100, drag: 1, bounce: 0.25 });
    });
  }
  const throwPlate = (pl, d3, v) => { pl.vx = d3[0] * v; pl.vy = -(d3[1] * CP - d3[2] * SP) * v; pl.vgy = d3[2] * SP * v; };
  function stepPlates(list, dt, onLand) {
    for (const pl of list) {
      pl.t += dt;
      if (pl.t < pl.delay) continue;
      const k = Math.exp(-pl.drag * dt);
      pl.vx *= k; pl.vgy *= k; pl.vy += pl.grav * dt;
      pl.x += pl.vx * dt; pl.y += pl.vy * dt; pl.gy += pl.vgy * dt;
      pl.rot += pl.spin * dt; pl.ph += pl.flip * dt;
      if (pl.y > pl.gy && pl.vy > 0) {
        pl.y = pl.gy; pl.vy *= -pl.bounce; pl.vx *= 0.45; pl.vgy *= 0.3; pl.spin *= 0.4; pl.flip *= 0.35; pl.land++;
        if (onLand) onLand(pl);
      }
      if (pl.melt >= 0) pl.melt += dt;
    }
  }
  function drawPlates(ctx, list, bake) {
    for (const pl of list) {
      const fa = pl.a * clamp01((pl.life - pl.t) / 0.3);
      if (fa <= 0.01) continue;
      const f = Math.cos(pl.ph), sx = 0.3 + 0.7 * Math.abs(f), glint = Math.pow(Math.max(0, f), 14) * (pl.flip > 0.5 ? 1 : 0);
      ctx.save();
      ctx.translate(pl.x, pl.y); ctx.rotate(pl.rot); ctx.scale(sx, pl.sq);
      path(ctx, pl.pts, 0, 0);
      ctx.save(); ctx.clip();
      ctx.globalAlpha = fa;
      ctx.drawImage(bake.img, bake.x0 - pl.cx, bake.y0 - pl.cy, bake.w, bake.h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(bake.light, bake.x0 - pl.cx, bake.y0 - pl.cy, bake.w, bake.h);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      if (glint > 0.02) { ctx.fillStyle = `rgba(255,225,255,${0.35 * glint * fa})`; ctx.fill(); }
      ctx.strokeStyle = `rgba(226,170,255,${0.55 * fa})`; ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    }
  }
  // a star of light on the point of the last blow
  function impactStar(x, y, R, k) {
    FX.add({ type: 'vb_draw', life: 0.22, x: 0, y: 0, paint() {
      const u = this.t / this.life, r = R * (k || 0.34) * (0.6 + u);
      GL.quad('glow', x, y, r, r, 0, { shape: S.star, pal: P.void, add: true, seed: 3, extra: 0.05, a: 0.85 * (1 - u) });
    } });
  }
  const hitOf = (p, q, R) => (q.lastHit ? proj(p.x, p.y, R, q.lastHit.I[0], q.lastHit.I[1], q.lastHit.I[2]) : [p.x + R * 0.5, p.y - R * 0.2]);
  const blow3 = (q) => (q.lastHit ? [q.lastHit.blow[0], 0, q.lastHit.blow[1]] : [-1, 0, 0]);
  // monsters round the hero (inside k radii, the ground ellipse), nearest first
  const near = (game, p, R, k, n) => game.enemies
    .filter((e) => e.hp > 0 && !e.dead && !e.dummy && Math.hypot((e.x - p.x) / (R * k), (e.y - p.y) / (R * k * SP)) < 1)
    .sort((a, b) => Math.hypot(a.x - p.x, (a.y - p.y) * 2) - Math.hypot(b.x - p.x, (b.y - p.y) * 2)).slice(0, n);
  VD.breakDmg = (game, p, q) => Math.max(1, Math.round((q.hp0 || 200) * 0.12));   // one thorn / one tendril

  // ---------------- 1. plates ----------------
  B.plates = function (game, p, q) {
    const R = q.size(), f = hitOf(p, q, R), bl = blow3(q), SEP = 0.13;
    const list = cells(p.x, p.y, R, 26, f);
    let pl = null, bake = null;
    q.brk = { dur: SEP + 0.3, life: SEP + 0.35, front: (t) => (t < SEP ? 1 : 0), back: fadeOut(SEP, 0.25), webs: (t) => (t < SEP ? 1 : 0),
      ground: fadeOut(0, 0.4), halo: fadeOut(0, 0.2), boost: (t) => 0.3 * (1 - clamp01(t / 0.15)) };
    impactStar(f[0], f[1], R);
    sfx('domeCrack');
    FX.add({ type: 'vb_draw', life: 2.2, x: 0, y: 0,
      update(o, dt) {
        if (!pl && o.t >= SEP) {
          bake = q.bakeFront();
          if (!bake) { o.dead = true; return; }
          pl = makePlates(p, list, bake);
          for (const c of pl) {
            const v3 = unit([c.N[0] + bl[0] * 0.45, c.N[1] + 0.25, c.N[2] + bl[2] * 0.45]);
            throwPlate(c, v3, rand(240, 430));
            Object.assign(c, { spin: rand(-7, 7), flip: rand(4, 11), life: rand(1.1, 1.5) });
          }
          sparks(p.x, p.y - R * 0.4, 26, undefined, 0, { min: 300, max: 750, w: 2.4 });
          V.flash('200,120,255', 0.18, 0.22); V.shake(game, 10); V.stop(game, 0.06);
          sfx('domeShatter');
        }
        if (pl) stepPlates(pl, dt);
      },
      paint(ctx) { if (!pl) drawCracks(ctx, list, (this.t / SEP) * 1.3, 1, 1.3, f, R); else drawPlates(ctx, pl, bake); },
    });
  };

  // ---------------- 3. melt ----------------
  B.melt = function (game, p, q) {
    const R = q.size(), top = [p.x, p.y - R], SEP = 0.22;
    const list = cells(p.x, p.y, R, 22, null);
    let pl = null, bake = null;
    q.brk = { dur: SEP + 0.45, life: SEP + 0.5, front: (t) => (t < SEP ? 1 : 0), back: fadeOut(SEP, 0.45), webs: (t) => (t < SEP ? 1 : 0),
      ground: fadeOut(0.2, 0.8), halo: fadeOut(0, 0.3), boost: (t) => 0.15 * (1 - clamp01(t / 0.2)) };
    sfx('domeCrack');
    const pools = [];
    FX.add({ type: 'vb_low', life: 3.4, x: 0, y: 0, paint() {
      for (const o of pools) {
        const u = (this.t - o.t0) / 1.5;
        if (u < 0 || u >= 1) continue;
        const g = GL.out(Math.min(1, u * 4), 2);
        GL.quad('low', o.x, o.y, o.r * 1.2 * g, o.r * g * 0.3, 0, { shape: S.puff, pal: P.void, erode: C(u, [[0, 0.1], [0.5, 0.15], [1, 1]]), edge: 0.06, ns: 1.6, seed: o.sd, extra: -0.22, a: 0.9 });
        GL.quad('low', o.x, o.y, o.r * 1.5 * g, o.r * 0.55 * g, 0, { shape: S.glow, tint: [0.55, 0.15, 0.9], add: true, a: 0.45 * (1 - u) });
      }
    } });
    const smoke = GL.parts({ spawnFor: 2, draw: (s, u) => GL.quad('glow', s.x, s.y, s.r * (0.6 + u), s.r * (0.6 + u), 0, { shape: S.puff, pal: P.dusk, erode: C(u, [[0, 0.25], [0.3, 0.1], [1, 1]]), ns: 3, seed: s.sd, pan: 0.6, a: 0.75 }) });
    FX.add({ type: 'vb_draw', life: 3.0, x: 0, y: 0,
      update(o, dt) {
        if (!pl && o.t >= SEP) {
          bake = q.bakeFront();
          if (!bake) { o.dead = true; return; }
          pl = makePlates(p, list, bake);
          for (const c of pl) {
            const hgt = clamp01((p.y - c.cy) / R);
            throwPlate(c, unit([c.N[0], 0, c.N[2] + 0.3]), rand(30, 80));
            Object.assign(c, { delay: (1 - hgt) * 0.5, spin: rand(-2.5, 2.5), flip: rand(1, 3), grav: 950, bounce: 0.15, life: 2.6 });
          }
          sfx('domeMelt');
        }
        if (pl) stepPlates(pl, dt, (c) => {
          if (c.land !== 1) return;
          c.melt = 0;
          pools.push({ x: c.x, y: c.gy, r: Math.sqrt(c.area) * 0.75, sd: rand(0, 40), t0: o.t });
          for (let i = 0; i < 2; i++) smoke.add({ x: c.x + rand(-8, 8), y: c.gy - 6, vx: rand(-15, 15), vy: rand(-70, -40), drag: 1.2, grav: -10, life: rand(0.7, 1.1), r: Math.sqrt(c.area) * 0.3, sd: rand(0, 40) });
        });
        if (pl) for (const c of pl) if (c.melt >= 0) { const m = clamp01(c.melt / 0.5); c.a = 1 - m; c.sq = 1 - 0.75 * m; c.life = Math.max(c.life, c.t + 0.01); }
      },
      paint(ctx) { if (!pl) drawCracks(ctx, list, (this.t / SEP) * 1.3, 1, 1.2, top, R); else drawPlates(ctx, pl, bake); },
    });
  };

  // ---------------- 4. stardust ----------------
  B.stardust = function (game, p, q) {
    const R = q.size(), D = 0.95;
    const hr = (t) => 0.05 + 1.9 * GL.ease(clamp01(t / D));
    q.brk = { dur: D, life: D + 0.1, front: fadeOut(D - 0.12, 0.12), back: fadeOut(D - 0.12, 0.12), webs: fadeOut(0, 0.45),
      ground: fadeOut(0.3, 0.9), halo: fadeOut(0, 0.35), boost: (t) => 0.35 * (1 - clamp01(t / 0.3)),
      hole: (t) => [0, 1, 0, hr(t)] };
    const mk = (low) => GL.parts({ low, spawnFor: D + 0.1, draw: (s, u) => {
      const tw = 0.55 + 0.45 * Math.sin(s.t * s.tw + s.ph), a = tw * (u < 0.1 ? u / 0.1 : 1 - Math.pow((u - 0.1) / 0.9, 1.3));
      if (s.star) GL.quad(low ? 'low' : 'glow', s.x, s.y, s.r * 3, s.r * 3, 0, { shape: S.twinkle, pal: P.void, add: true, a });
      else GL.quad(low ? 'low' : 'glow', s.x, s.y, s.r, s.r, 0, { shape: S.glow, tint: s.c, add: true, a });
    }, tick: (ps, dt) => { for (const s of ps.parts) s.vx += Math.sin(s.t * 2.6 + s.ph) * 26 * dt; } });
    const front = mk(false), back = mk(true);
    let made = 0;
    sfx('domeDust');
    V.flash('170,120,255', 0.08, 0.3);
    FX.add({ type: 'vb_draw', life: D + 0.05, x: 0, y: 0, paint() {},
      update(o) {
        const want = Math.floor(clamp01(o.t / D) * 520);
        const h = hr(o.t), Rn = q.size();
        for (; made < want; made++) {
          const ph = rand(0, TAU), hh = h + rand(-0.04, 0.06), P3 = [Math.sin(hh) * Math.cos(ph), Math.cos(hh), Math.sin(hh) * Math.sin(ph)];
          if (P3[1] < 0.01) continue;
          const [x, y] = proj(p.x, p.y, Rn, P3[0], P3[1], P3[2]), star = Math.random() < 0.18;
          const c = Math.random() < 0.3 ? [1, 0.85, 1] : Math.random() < 0.5 ? [0.85, 0.45, 1] : [0.6, 0.35, 1];
          (P3[2] < 0 ? back : front).add({ x, y, vx: P3[0] * rand(20, 80), vy: -rand(40, 140), drag: 0.7, grav: -40, life: rand(1.1, 2.1), r: rand(3.5, 8), star, c, tw: rand(8, 18), ph: rand(0, TAU) });
        }
      } });
  };

  // ---------------- 5. freeze (an impact frame) ----------------
  B.freeze = function (game, p, q) {
    const R = q.size(), f = hitOf(p, q, R), HOLD = 0.3;
    const list = cells(p.x, p.y, R, 24, f), st = { boom: false };
    const bake = q.bakeFront();
    if (!bake) return B.hit(game, p, q);
    const pl = makePlates(p, list, bake);
    q.brk = { dur: 3, life: 3, front: k0, back: () => (st.boom ? 0 : 1), webs: k0, ground: () => (st.boom ? 0 : 1), halo: () => (st.boom ? 0 : 1) };
    V.stop(game, HOLD);
    sfx('domeFreeze');
    FX.add({ type: 'vb_draw', life: 2.4, x: 0, y: 0,
      update(o, dt) {
        if (!st.boom && !(game.hitstop > 0)) {
          st.boom = true;
          for (const c of pl) {
            throwPlate(c, unit([c.N[0], c.N[1] + 0.15, c.N[2]]), rand(650, 1050));
            Object.assign(c, { spin: rand(-16, 16), flip: rand(10, 20), drag: 1.6, grav: 700, life: rand(0.55, 0.85) });
          }
          sparks(p.x, p.y - R * 0.4, 44, undefined, 0, { min: 900, max: 1500, w: 3 });
          FX.add({ type: 'vb_low', life: 0.35, x: 0, y: 0, paint() {
            const u = this.t / this.life, r = R * (0.3 + 1.9 * GL.out(u, 2.4));
            GL.quad('low', p.x, p.y, r, r * SP * 1.05, 0, { shape: S.ring, pal: P.void, erode: C(u, [[0, 0], [0.3, 0.2], [1, 1]]), ns: 3, add: true, extra: 0.15 });
          } });
          V.flash('255,235,255', 0.35, 0.22); V.shake(game, 16);
          GL.zoom(p.x, p.y - R * 0.4, 0.07, 0.35);
          sfx('domeShatter'); sfx('domeBurst');
        }
        if (st.boom) stepPlates(pl, dt);
      },
      paint(ctx) {
        if (st.boom) { drawPlates(ctx, pl, bake); return; }
        const e = HOLD - Math.max(0, game.hitstop), cv = ctx.canvas;
        if (e >= 0.06) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(8,0,20,0.66)'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore(); }
        ctx.save(); ctx.globalAlpha = e >= 0.06 ? 0.6 : 1; ctx.drawImage(bake.img, bake.x0, bake.y0, bake.w, bake.h);
        ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(bake.light, bake.x0, bake.y0, bake.w, bake.h); ctx.restore();
        drawCracks(ctx, list, 1 + e * 8, 1, e >= 0.06 ? 2.2 : 1.4, f, R);
        if (e < 0.06) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore(); }
      },
    });
  };

  // ---------------- 6. backlash: thorns into the monsters ----------------
  B.backlash = function (game, p, q) {
    const R = q.size(), PULL = 0.12;
    q.brk = { dur: PULL, life: PULL + 0.05, scale: (t) => 1 - 0.22 * GL.ease(clamp01(t / PULL)), front: () => 1, back: () => 1, webs: () => 1,
      ground: fadeOut(0, 0.25), halo: () => 1, boost: (t) => 0.8 * clamp01(t / PULL) };
    sfx('domeImplode');
    const dmg = VD.breakDmg(game, p, q), targets = near(game, p, R, 3.4, 6);
    const thorns = [];
    const sys = GL.parts({ spawnFor: PULL + 0.1, life: 3, draw: (s, u) => {
      const a = Math.atan2(s.vy, s.vx), fade = s.hitT ? 1 : clamp01((s.life - s.t) / 0.2);
      if (s.trail.length > 1) GL.strip('glow', s.trail.map((v, i) => ({ x: v[0], y: v[1], w: 6.5 * (i / (s.trail.length - 1)) })), { shape: S.blade, pal: P.void, add: true, erode: 0.25 + (1 - fade) * 0.6, ns: 2, pan: 3, extra: 0.1, even: true });
      GL.quad('glow', s.x, s.y, 24, 7.5, a, { shape: S.thorn, pal: P.void, erode: 1 - fade, edge: 0.1, ns: 3, seed: s.sd, extra: 0.22 });
    }, tick: (ps, dt) => {
      for (const s of ps.parts) {
        s.trail.push([s.x, s.y]); if (s.trail.length > 8) s.trail.shift();
        const e = s.e;
        if (!e || e.hp <= 0 || e.dead) continue;
        const tx = e.x, ty = e.y - 30, dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
        s.sp = Math.min(1400, s.sp + 2400 * dt);
        const k = Math.min(1, 8 * dt);
        s.vx += ((dx / d) * s.sp - s.vx) * k; s.vy += ((dy / d) * s.sp - s.vy) * k;
        if (d < 26) {
          s.life = s.t + 0.01; s.e = null;
          NC.damageEnemy(game, e, { dmg, mod: 1 }, (dx / d) * 260, (dy / d) * 130, { fill: '#e2b4ff', stun: 0.25, color: '210,150,255' });
          sparks(tx, ty, 8, Math.atan2(dy, dx), 0.8, { min: 150, max: 380 });
          if (game.time - (e._vbStab || -9) > 0.05) { e._vbStab = game.time; sfx('domeStab'); }
        }
      }
    } });
    FX.add({ type: 'vb_draw', life: PULL + 0.02, x: 0, y: 0, paint() {},
      onEnd() {
        const Rn = R * 0.78;
        for (let i = 0; i < 26; i++) {
          const th = (i / 26) * TAU + rand(-0.1, 0.1), lat = Math.asin(rand(0.08, 0.85)), cl = Math.cos(lat);
          const P3 = [cl * Math.cos(th), Math.sin(lat), cl * Math.sin(th)], [x, y] = proj(p.x, p.y, Rn, P3[0], P3[1], P3[2]);
          const sv = rand(520, 720);
          thorns.push(sys.add({ x, y, vx: P3[0] * sv, vy: -(P3[1] * CP - P3[2] * SP) * sv, drag: 0.6, life: rand(0.45, 0.6), sp: sv, sd: rand(0, 40), trail: [], e: null, P3 }));
        }
        // three thorns for each monster near: the ones already flying its way
        for (const e of targets) {
          const ang = Math.atan2(e.y - (p.y - R * 0.3), e.x - p.x);
          thorns.filter((s) => !s.e).sort((a, b) => Math.abs(Math.atan2(Math.sin(Math.atan2(a.vy, a.vx) - ang), Math.cos(Math.atan2(a.vy, a.vx) - ang))) - Math.abs(Math.atan2(Math.sin(Math.atan2(b.vy, b.vx) - ang), Math.cos(Math.atan2(b.vy, b.vx) - ang))))
            .slice(0, 3).forEach((s) => { s.e = e; s.life = 1.6; });
        }
        V.flash('200,120,255', 0.2, 0.22); V.shake(game, 10);
        sparks(p.x, p.y - R * 0.35, 20, undefined, 0, { min: 300, max: 700 });
        sfx('domeBurst'); sfx('domeThorn');
      } });
  };

  // ---------------- 7. void: ink tendrils drain the monsters ----------------
  B.void = function (game, p, q) {
    const R = q.size(), FALL = 0.16, OUT = 0.14, REACH = 0.16, HOLDT = 0.62, BACK = 0.24;
    q.brk = { dur: FALL, life: FALL + 0.05, scale: (t) => 1 - 0.4 * GL.ease(clamp01(t / FALL)), front: fadeOut(0, FALL), back: fadeOut(0, FALL),
      webs: fadeOut(0, FALL), ground: fadeOut(0, 0.5), halo: fadeOut(0, 0.1) };
    sfx('domeDrain');
    const dmg = VD.breakDmg(game, p, q), targets = near(game, p, R, 3.0, 6);
    const x0 = p.x, y0 = p.y - 8;
    // black smoke where the dome was, rolling out along the ground
    const smoke = GL.parts({ spawnFor: 0.3, draw: (s, u) => GL.quad(s.low ? 'low' : 'glow', s.x, s.y, s.r * (0.7 + u * 0.8), s.r * (0.7 + u * 0.8) * 0.8, 0, { shape: S.puff, pal: P.dusk, erode: C(u, [[0, 0.35], [0.25, 0.12], [1, 1]]), ns: 2.6, seed: s.sd, pan: 0.5, extra: -0.12, a: 0.72 }) });
    for (let i = 0; i < 22; i++) {
      const th = rand(0, TAU), lat = Math.asin(rand(0.05, 0.8)), cl = Math.cos(lat), P3 = [cl * Math.cos(th), Math.sin(lat), cl * Math.sin(th)];
      const [x, y] = proj(p.x, p.y, R * 0.8, P3[0], P3[1], P3[2]), v = rand(120, 260);
      smoke.add({ x, y, vx: Math.cos(th) * v, vy: Math.sin(th) * v * SP + 30, drag: 2.2, grav: 40, life: rand(0.7, 1.1), r: R * rand(0.18, 0.3), sd: rand(0, 40), low: P3[2] < 0 });
    }
    // the tendrils: to each monster near, and a few more into the empty ground round it
    const tl = targets.map((e) => ({ e, ex: e.x, ey: e.y - 28 }));
    for (let i = tl.length; i < 7; i++) { const a = rand(0, TAU), L = R * rand(1.4, 2.2); tl.push({ e: null, ex: x0 + Math.cos(a) * L, ey: y0 + Math.sin(a) * L * SP }); }
    for (const t of tl) Object.assign(t, { bend: rand(-0.35, 0.35), ph: rand(0, TAU), grabbed: false, delay: rand(0, 0.06) });
    let healed = 0;
    const curve = (t, u, time) => {
      const ex = t.e && t.e.hp > 0 ? t.e.x : t.ex, ey = t.e && t.e.hp > 0 ? t.e.y - 28 : t.ey;
      const dx = ex - x0, dy = ey - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const cx = x0 + dx * 0.5 + nx * t.bend * L, cy = y0 + dy * 0.5 + ny * t.bend * L - L * 0.18;
      const a = 1 - u, x = a * a * x0 + 2 * a * u * cx + u * u * ex, y = a * a * y0 + 2 * a * u * cy + u * u * ey;
      const wig = Math.sin(u * 9 - time * 14 + t.ph) * 7 * u * (1 - u) * 4;
      return [x + nx * wig, y + ny * wig, ey];
    };
    FX.add({ type: 'vb_draw', life: OUT + REACH + HOLDT + BACK + 0.5, x: 0, y: 0,
      update(o) {
        for (const t of tl) {
          if (t.grabbed || o.t < OUT + REACH + t.delay) continue;
          t.grabbed = true;
          const e = t.e;
          if (!e || e.hp <= 0) continue;
          const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
          NC.damageEnemy(game, e, { dmg, mod: 1 }, ((p.x - e.x) / d) * 220, ((p.y - e.y) / d) * 110, { fill: '#c99bff', stun: 1.2, color: '150,80,220' });
          e.slow = Math.max(e.slow || 0, 1.2);
          healed += dmg;
          for (let i = 0; i < 4; i++) smoke.add({ x: e.x + rand(-20, 20), y: e.y - rand(10, 50), vx: rand(-20, 20), vy: rand(-60, -20), drag: 1.5, grav: -20, life: rand(0.6, 0.9), r: R * 0.12, sd: rand(0, 40) });
          sfx('domeHit', { k: 0.5 });
        }
        if (!o.healed && o.t >= OUT + REACH + HOLDT + BACK) {
          o.healed = true;
          const gain = Math.round(healed * 0.5);
          if (gain > 0) { p.hp = Math.min(p.maxHp || p.hp + gain, p.hp + gain); FX.num(p.x, p.y - 140, '+' + gain, { fill: '#9be35a', size: 30 }); }
          FX.add({ type: 'vb_draw', life: 0.5, x: 0, y: 0, paint() {
            const u = this.t / this.life;
            GL.quad('glow', p.x, p.y - 50, 70 * (1 + u * 0.5), 90 * (1 + u * 0.5), 0, { shape: S.glow, tint: [0.55, 0.22, 0.9], add: true, a: 0.6 * (1 - u) });
            const r = R * (1.2 - 1.0 * GL.ease(u));
            GL.quad('low', p.x, p.y, r, r * SP, 0, { shape: S.ring, pal: P.void, erode: 0.35 + u * 0.6, ns: 3, add: true, extra: -0.2, a: 0.6 * (1 - u) });
          } });
          sfx('domeHeal');
        }
      },
      paint() {
        const t = this.t, time = game.time;
        for (const tt of tl) {
          const tOut = t - OUT - tt.delay;
          if (tOut <= 0) continue;
          const back = clamp01((t - OUT - REACH - HOLDT - tt.delay) / BACK);
          const h = GL.ease(clamp01(tOut / REACH)) * (1 - GL.ease(back));
          if (h < 0.02) continue;
          const pts = [], n = 14;
          let endY = 0;
          for (let i = 0; i <= n; i++) {
            const u = (i / n) * h, [x, y, ey] = curve(tt, u, time);
            endY = ey;
            pts.push({ x, y, w: (17 - 12 * (i / n)) * (0.75 + 0.25 * Math.sin(time * 9 + i)) });
          }
          const lay = endY < p.y - 5 ? 'low' : 'glow';
          GL.strip(lay, pts, { shape: S.blade, pal: P.smoke, erode: 0.04 + back * 0.4, edge: 0.08, ns: 2.5, pan: 3, extra: 0.12, even: true });
          GL.strip(lay, pts.map((v) => ({ x: v.x, y: v.y, w: v.w * 0.42 })), { shape: S.blade, pal: P.void, add: true, erode: 0.42 + back * 0.4, ns: 4, pan: 5, extra: -0.05, even: true });
          if (tt.grabbed && tt.e && back < 0.5) GL.quad(lay, pts[n].x, pts[n].y, 22, 22, 0, { shape: S.glow, tint: [0.45, 0.1, 0.75], add: true, a: 0.7 * (1 - back * 2) });
        }
      },
    });
  };
})();
