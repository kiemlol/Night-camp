/* fx.js — particles and effects. Layers: 'low' (under sprites), 'high' (over sprites, before the night
   lighting) and 'glow' (after lighting, so it stays bright: numbers, magic, slashes). */
(function () {
  'use strict';
  const NC = window.NC;
  const FX = (NC.FX = { list: [], lights: [], flashes: [] }); // lights: brighten the night around effects; flashes: the screen
  const TAU = Math.PI * 2;
  // Thin only decorative drawing. FX entries also carry skill timers and damage callbacks,
  // so quality settings must never skip spawning or updating them, or consume gameplay RNG.
  const COSMETIC = new Set(['puff', 'star', 'spark', 'ember', 'leaf', 'after', 'hero', 'vmote', 'vsmoke']);
  let visualId = 0;

  // ---------------- smoothness, phase 1 (2026-10-18, the user: "ทำระยะ 1 เลย (อนุภาค/เงาเป็นภาพ, แคชชุดคลุม/ผ้าคลุม,
  // มอนไกลอัปเดตช้าลง, HUD 10 ครั้ง/วิ)") ----------------
  // NC.Perf: each change can be switched off at run time (the before / after timing flips them in one page); ?perf1=0
  // starts with all of them off. cloth: robes from the bend cache (avatar.js); mobs: far idle monsters updated every 4th
  // frame + a grid for their spacing (game.js); hud: the HUD's page parts 10 times a second (hud.js). (Particles and
  // contact shadows drawn from pictures were tried and taken out: timed in a crowd they were 10-60% SLOWER than the
  // plain arc / ellipse fills on a GPU canvas; only the radial-gradient lights gained from pictures, js/game.js)
  const P1 = true;
  NC.Perf = NC.Perf || { cloth: P1, mobs: P1, hud: P1 };

  FX.add = function (p) {
    p.t = 0;
    p.drawRank = (++visualId * 0.618033988749895) % 1;
    p.layer = p.layer || LAYER[p.type] || 'glow';
    FX.list.push(p);
    return p;
  };
  const LAYER = { puff: 'low', after: 'high', hero: 'high', shard: 'high', leaf: 'high', num: 'glow', text: 'glow' };
  // new effect types (vfx.js, skills.js): a drawer and the layer it belongs to
  FX.def = function (type, draw, layer) { DRAW[type] = draw; if (layer) LAYER[type] = layer; };

  FX.update = function (dt, game) {
    const L = FX.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.t += dt;
      if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; }
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      if (p.grav) p.vy += p.grav * dt;
      if (p.spin) p.rot += p.spin * dt;
      if (p.update) p.update(p, dt, game);
      if (p.t >= p.life || p.dead) { L.splice(i, 1); if (p.onEnd) p.onEnd(p, game); }
    }
    // lights and screen flashes age too (a light can follow a moving effect)
    for (const A of [FX.lights, FX.flashes])
      for (let i = A.length - 1; i >= 0; i--) {
        const o = A[i];
        o.t += dt;
        if (o.follow) { o.x = o.follow.x + (o.ox || 0); o.y = o.follow.y + (o.oy || 0); if (o.follow.dead) o.t = Math.max(o.t, o.life - 0.15); }
        if (o.t >= o.life) A.splice(i, 1);
      }
  };
  // a light's strength now (fades in fast, out slowly, may flicker)
  FX.lightA = (o) => { const u = o.t / o.life; return o.a * (u < 0.08 ? u / 0.08 : 1 - Math.pow(u, 1.6)) * (o.flick ? 1 + Math.sin(o.t * 37) * 0.08 : 1); };

  // Numbers off the screen are not drawn (they still age and move): the server sends the hits round about five screens'
  // worth of map, and each number is several text draws a frame (2026-10-24: FPS). The margin covers a number's rise.
  const NUMBERS = new Set(['num', 'dmg', 'dmgb']), OFF_MARGIN = 240;
  function onScreen(p) {
    const g = NC.game, c = g && g.cam;
    if (!c || !(g.vw > 0) || typeof p.x !== 'number') return true;
    return p.x > c.x - OFF_MARGIN && p.x < c.x + g.vw + OFF_MARGIN && p.y > c.y - OFF_MARGIN && p.y < c.y + g.vh + OFF_MARGIN;
  }
  function shouldDraw(p) {
    if (NUMBERS.has(p.type)) return onScreen(p);
    if (!COSMETIC.has(p.type)) return true;
    // (Auto's relief step 2, js/gfx.js: the CPU holding the frames back: half of them)
    const density = ((NC.Gfx?.profile || NC.Graphics?.profile)?.particleDensity ?? 1) * ((NC.Gfx?.relief?.() ?? 0) >= 2 ? 0.5 : 1);
    return density >= 1 || p.drawRank < density;
  }
  FX.draw = function (ctx, layer) {
    for (const p of FX.list) if (p.layer === layer && DRAW[p.type] && shouldDraw(p)) DRAW[p.type](ctx, p, p.t / p.life);
  };
  // one effect standing among the characters ('sorted': the renderer sorts it with them by its y)
  FX.drawOne = function (ctx, p) { if (DRAW[p.type] && shouldDraw(p)) DRAW[p.type](ctx, p, p.t / p.life); };

  // ---------- spawners ----------
  FX.num = function (x, y, text, o) {
    o = o || {};
    // a heal capped by (maxHp - hp) comes out fractional when hp regenerates bit by bit: never show "+301.9853..."
    text = String(text).replace(/\d+\.\d{3,}/g, (m) => String(Math.round(+m)));
    FX.add({ type: 'num', x: x + NC.rand(-18, 18), y, vx: 0, vy: -95, drag: 2.2, life: o.life || 0.95, text,
      size: o.size || 46, fill: o.fill || '#ffffff', pop: 1 });
  };
  // a damage number the classic MMO way: it pops up, arcs out to one side and falls back (dir: -1 / 1, so a string of hits
  // fans out instead of piling up), a critical one bigger and gold on a red burst; o.delay holds it back (a double
  // hit's second number), o.tag: a little label after it (x2)
  FX.dmg = function (x, y, text, o) {
    o = o || {};
    const dir = o.dir || (Math.random() < 0.5 ? -1 : 1);
    FX.add({ type: 'dmg', layer: 'glow', x: x + NC.rand(-10, 10), y, x0: x, y0: y, sx: dir * NC.rand(55, 120), sy: -NC.rand(430, 500),
      life: (o.life || 1.05) + (o.delay || 0), delay: o.delay || 0, text: String(text), size: o.size || 44, fill: o.fill || '#ffffff',
      crit: !!o.crit, tag: o.tag || null, rot: NC.rand(0, TAU),
      update(p, dt) {
        const t = p.t - p.delay;
        if (t < 0) return;
        const k = Math.min(t, 0.9); // (rises, then drops; slows to a hang at the end)
        p.x = p.x0 + p.sx * k * 0.9; p.y = p.y0 + p.sy * k + 0.5 * 1050 * k * k;
      } });
  };
  FX.text = function (x, y, text, fill, size) {
    FX.add({ type: 'text', x, y, vx: 0, vy: -40, life: 1.8, text, fill, size: size || 64 });
  };
  FX.puff = function (x, y, n, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = NC.rand(0, TAU), s = NC.rand(o.speed * 0.3 || 20, o.speed || 90);
      FX.add({ type: 'puff', x: x + NC.rand(-10, 10), y: y + NC.rand(-6, 6), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - (o.rise || 20),
        drag: 3, life: NC.rand(0.45, 0.8) * (o.lifeK || 1), r0: NC.rand(14, 22) * (o.size || 1), r1: NC.rand(30, 44) * (o.size || 1),
        color: o.color || '215,218,230', layer: o.layer });
    }
  };
  FX.stars = function (x, y, n, color, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = NC.rand(0, TAU), s = NC.rand(60, o.speed || 260);
      FX.add({ type: 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, drag: 2.6, grav: o.grav || 0, life: NC.rand(0.5, 0.9),
        size: NC.rand(10, 20) * (o.size || 1), rot: NC.rand(0, TAU), spin: NC.rand(-6, 6), color });
    }
  };
  FX.sparks = function (x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = NC.rand(0, TAU), s = NC.rand(250, 520);
      FX.add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 7, life: NC.rand(0.18, 0.3), color: color || '255,255,255' });
    }
  };
  FX.slash = function (x, y, ang, r, color, dir) {
    FX.add({ type: 'slash', x, y, ang, r, life: 0.2, color: color || '255,255,255', dir: dir || 1 });
  };
  FX.ring = function (x, y, r0, r1, color, life, width) {
    FX.add({ type: 'ring', x, y, r0, r1, color, life: life || 0.5, width: width || 8 });
  };
  FX.after = function (name, x, y, flip, color) {
    FX.add({ type: 'after', name, x, y, flip, color, life: 0.28 });
  };
  FX.cloud = function (x, y, size, delay, life) {
    FX.add({ type: 'cloud', x, y, size, delay, life: life + delay, rot: NC.rand(0, TAU), spin: NC.rand(1.5, 3) * (Math.random() < 0.5 ? -1 : 1) });
  };

  // ---------- drawers ----------
  var DRAW = {
    // an effect that draws itself: p.draw(ctx, p, u) (boss.js: warning circles on the ground, spore clouds)
    custom(ctx, p, u) { p.draw(ctx, p, u); },
    num(ctx, p, u) {
      const pop = u < 0.12 ? 1 + (0.12 - u) * 4 : 1;
      ctx.save();
      ctx.globalAlpha = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      ctx.font = `800 ${Math.round(p.size * pop)}px 'Baloo 2', 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = p.size * 0.17; ctx.strokeStyle = NC.OUTLINE;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.fill;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    },
    dmg(ctx, p) {
      const t = p.t - p.delay, L = p.life - p.delay;
      if (t < 0) return;
      const u = t / L, pop = t < 0.09 ? 1.45 - (t / 0.09) * 0.45 : 1, s = Math.round(p.size * pop);
      ctx.save();
      ctx.globalAlpha = u > 0.72 ? Math.max(0, 1 - (u - 0.72) / 0.28) : 1;
      const fa = p.crit ? Math.max(0, 1 - Math.max(0, t - 0.3) / 0.25) : 0; // (the burst goes before the number does)
      if (fa > 0.01) { // a red-gold burst behind a critical
        const r = p.size * (0.62 + Math.min(1, t / 0.1) * 0.22);
        ctx.save();
        ctx.globalAlpha *= fa;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot + t * 1.5);
        ctx.beginPath();
        for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU, rr = i % 2 ? r * 0.52 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8); }
        ctx.closePath();
        ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
        ctx.fillStyle = '#e8412c'; ctx.fill();
        ctx.scale(0.62, 0.62); ctx.fillStyle = '#ff9a3c'; ctx.fill();
        ctx.restore();
      }
      ctx.font = `800 ${s}px 'Baloo 2', 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.18; ctx.strokeStyle = NC.OUTLINE;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.fill;
      ctx.fillText(p.text, p.x, p.y);
      if (p.tag) {
        const w = ctx.measureText(p.text).width, ts = Math.round(s * 0.55);
        ctx.font = `800 ${ts}px 'Baloo 2', 'Segoe UI', sans-serif`;
        ctx.textAlign = 'left'; ctx.lineWidth = ts * 0.2;
        ctx.strokeText(p.tag, p.x + w / 2 + 4, p.y - s * 0.28);
        ctx.fillStyle = '#ffd873'; ctx.fillText(p.tag, p.x + w / 2 + 4, p.y - s * 0.28);
      }
      ctx.restore();
    },
    text(ctx, p, u) {
      ctx.save();
      ctx.globalAlpha = u > 0.75 ? 1 - (u - 0.75) / 0.25 : Math.min(1, u * 8);
      const s = p.size * (u < 0.1 ? 0.6 + u * 4 : 1);
      ctx.font = `800 ${Math.round(s)}px 'Baloo 2', 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.16; ctx.strokeStyle = NC.OUTLINE;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.fill;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    },
    puff(ctx, p, u) {
      const r = NC.lerp(p.r0, p.r1, NC.ease(u));
      ctx.fillStyle = `rgba(${p.color},${0.55 * (1 - u)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.18 * (1 - u)})`;
      ctx.beginPath(); ctx.arc(p.x - r * 0.25, p.y - r * 0.3, r * 0.55, 0, TAU); ctx.fill();
    },
    star(ctx, p, u) {
      const a = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
      const s = p.size * (u < 0.15 ? u / 0.15 : 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 1.8);
      g.addColorStop(0, `rgba(${p.color},${0.55 * a})`); g.addColorStop(1, `rgba(${p.color},0)`);
      ctx.fillStyle = g; ctx.fillRect(p.x - s * 2, p.y - s * 2, s * 4, s * 4);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a;
      NC.star(ctx, p.x, p.y, s, p.rot);
      ctx.fillStyle = `rgb(${p.color})`; ctx.fill();
      NC.star(ctx, p.x, p.y, s * 0.45, p.rot);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.restore();
    },
    spark(ctx, p, u) {
      ctx.strokeStyle = `rgba(${p.color},${1 - u})`;
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); ctx.stroke();
    },
    slash(ctx, p, u) {
      // crescent that sweeps and thins out
      const a0 = p.ang - 1.25 * p.dir, sweep = 2.5 * p.dir * NC.ease(Math.min(1, u * 1.6));
      const n = 18, thick = 26 * (1 - u);
      ctx.save();
      ctx.globalAlpha = 1 - u;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + sweep * t; ctx.lineTo(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r * 0.8); }
      for (let i = n; i >= 0; i--) {
        const t = i / n, a = a0 + sweep * t, rr = p.r - Math.sin(t * Math.PI) * thick;
        ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * 0.8);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${p.color},0.95)`;
      ctx.fill();
      ctx.restore();
    },
    ring(ctx, p, u) {
      const r = NC.lerp(p.r0, p.r1, NC.ease(u));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${p.color},${0.8 * (1 - u)})`;
      ctx.lineWidth = p.width * (1 - u * 0.6);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.55, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    },
    hero(ctx, p, u) {
      // dash afterimage: the whole rigged hero (with gear) as a fading silhouette
      NC.drawHero(ctx, p.equip, p.pose, p.x, p.y, { silhouette: p.color, alpha: 0.5 * (1 - u), noBend: true });
    },
    arrow(ctx, p) {
      // an arrow in flight: shaft, steel head and red fletching along its path, with a faint streak behind
      const a = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(a);
      ctx.globalAlpha *= 0.35; ctx.strokeStyle = '#fff4dc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-36, 0); ctx.stroke();
      ctx.globalAlpha /= 0.35;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#231a33'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(10, 0); ctx.stroke();
      ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(10, 0); ctx.stroke();
      ctx.fillStyle = '#dfe6ef'; ctx.strokeStyle = '#231a33'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(8, -6); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c94a3a';
      ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-24, -6); ctx.lineTo(-20, 0); ctx.lineTo(-24, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
    bolt(ctx, p) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const tx = p.x - p.vx * 0.07, ty = p.y - p.vy * 0.07;
      const g = ctx.createLinearGradient(tx, ty, p.x, p.y);
      g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(1, 'rgba(150,220,255,0.8)');
      ctx.strokeStyle = g; ctx.lineWidth = 16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(p.x, p.y); ctx.stroke();
      const r = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(160,225,255,0.9)'); r.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = r; ctx.fillRect(p.x - 30, p.y - 30, 60, 60);
      ctx.restore();
    },
    cutline(ctx, p, u) {
      // a straight cut of light (the dash-through slash): a long thin diamond that flares, then fades
      const w = p.w * (u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88);
      const dx = p.x1 - p.x, dy = p.y1 - p.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const mx = (p.x + p.x1) / 2, my = (p.y + p.y1) / 2;
      const shape = (k) => {
        ctx.beginPath();
        ctx.moveTo(p.x - ux * k, p.y - uy * k); ctx.lineTo(mx - uy * w * k * 0.25, my + ux * w * k * 0.25);
        ctx.lineTo(p.x1 + ux * k, p.y1 + uy * k); ctx.lineTo(mx + uy * w * k * 0.25, my - ux * w * k * 0.25);
        ctx.closePath();
      };
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${p.color},${0.45 * (1 - u)})`; shape(10); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.95 * (1 - u)})`; shape(4); ctx.fill();
      ctx.restore();
    },
    thrust(ctx, p, u) {
      // a long narrow streak along the spear's line
      const c = Math.cos(p.ang), s2 = Math.sin(p.ang), L = p.len * (0.6 + 0.4 * NC.ease(Math.min(1, u * 3)));
      const nx = -s2, ny = c, w = 13 * (1 - u);
      ctx.save();
      ctx.globalAlpha = 1 - u;
      ctx.beginPath();
      ctx.moveTo(p.x + nx * w, p.y + ny * w);
      ctx.lineTo(p.x + c * L, p.y + s2 * L);
      ctx.lineTo(p.x - nx * w, p.y - ny * w);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
      ctx.restore();
    },
    after(ctx, p, u) {
      NC.drawSpr(ctx, p.name, p.x, p.y, { flip: p.flip, alpha: 0.55 * (1 - u), img: NC.tinted(p.name, p.color) });
    },
    cloud(ctx, p, u) {
      const t = p.t - p.delay;
      if (t < 0) return;
      const life = p.life - p.delay, v = t / life;
      const grow = NC.ease(Math.min(1, t / 0.18));
      const a = v > 0.7 ? 1 - (v - 0.7) / 0.3 : 1;
      const s = p.size * grow;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = a;
      const path = () => {
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) {
          const ang = (i / 48) * TAU, rr = s * (1 + 0.07 * Math.sin(ang * 6 + p.rot));
          ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr * 0.9);
        }
        ctx.closePath();
      };
      ctx.globalCompositeOperation = 'lighter';
      path(); ctx.lineWidth = 18; ctx.strokeStyle = 'rgba(255,180,50,0.28)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,200,90,0.22)'; ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      path(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffd35c'; ctx.stroke();
      // inner spiral
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const k = i / 40, ang = p.rot + k * TAU * 1.6, rr = s * 0.72 * k;
        ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr * 0.9);
      }
      ctx.lineWidth = 4.5; ctx.strokeStyle = '#ffe28a'; ctx.stroke();
      ctx.restore();
    },
    shard(ctx, p, u) {
      const a = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(a);
      ctx.globalAlpha = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1;
      ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(0, -9); ctx.lineTo(-18, 0); ctx.lineTo(0, 9); ctx.closePath();
      ctx.fillStyle = '#a9e4ff'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#2b4a78'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(20, -1); ctx.lineTo(0, -5); ctx.lineTo(-8, -1); ctx.closePath();
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.restore();
    },
    orb(ctx, p) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 22);
      g.addColorStop(0, 'rgba(255,245,170,0.95)'); g.addColorStop(0.4, 'rgba(255,200,80,0.5)'); g.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = g; ctx.fillRect(p.x - 22, p.y - 22, 44, 44);
      ctx.restore();
    },
    ember(ctx, p, u) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,${150 + 80 * (1 - u)},70,${0.9 * (1 - u)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 * (1 - u) + 1.5, 0, TAU); ctx.fill();
      ctx.restore();
    },
    leaf(ctx, p) {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.abs(Math.sin(p.t * 3 + p.ph)) * 0.8 + 0.2);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 4.5, 0, 0, TAU); ctx.fill();
      ctx.restore();
    },
  };
})();
