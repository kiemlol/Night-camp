/* vfx.js — the skill effects' toolkit, in the art's style: toon shapes with the bold navy outline, a flat colour, a
   light core; soft glows (cached sprites, added); ground decals; lights that brighten the night around an effect; screen
   flashes; small timelines (at / every). The skills (skills.js) are put together from these.
   Layers (fx.js): 'low' ground, 'sorted' stands on the ground among the characters (depth-sorted), 'high' over the
   sprites (lit by the night), 'glow' after the lighting (bright, emissive). */
(function () {
  'use strict';
  const NC = window.NC;
  const FX = NC.FX;
  const TAU = Math.PI * 2;
  const OUT = NC.OUTLINE;
  const V = (NC.VFX = {});
  const rand = NC.rand, clamp = NC.clamp, lerp = NC.lerp;
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeIn = (t) => Math.pow(clamp(t, 0, 1), 3);
  // 0 -> 1 over the first `a` of the life, 1 -> 0 over the last `b`
  const fade = (u, a, b) => (u < a ? u / a : u > 1 - b ? Math.max(0, (1 - u) / b) : 1);
  V.easeOut = easeOut; V.easeIn = easeIn; V.fade = fade;
  V.SQ = 0.58; // how flat a circle on the ground looks (the 3/4 camera)

  // palettes: [outer, mid, core] for flames and toon fills
  V.PAL = {
    fire: ['#ff5a2a', '#ffa53a', '#fff3b8'], hell: ['#7a2cff', '#ff3d6e', '#ffd6f2'], holy: ['#ffb62e', '#ffe68a', '#ffffff'],
    poison: ['#2f9a4a', '#8ee05a', '#e9ffb8'], ice: ['#5fb8f2', '#bfeaff', '#ffffff'], rock: ['#7a5a40', '#a8825a', '#dcbf92'],
    shadow: ['#3a1f5c', '#7a4ab8', '#e7c9ff'], blood: ['#8a1030', '#e0335a', '#ffd0dc'], wind: ['#3fae62', '#9ff09a', '#f2ffe8'],
    gold: ['#e8a21a', '#ffd35c', '#fff6d0'], lightning: ['#3a8cff', '#9fe6ff', '#ffffff'], stone: ['#6a5e5a', '#9d918a', '#ddd3c8'],
  };
  V.RGB = { fire: '255,140,50', hell: '200,60,255', holy: '255,214,110', poison: '120,230,90', ice: '140,210,255', rock: '220,170,110',
    shadow: '170,110,255', blood: '255,60,100', wind: '140,255,150', gold: '255,210,90', lightning: '150,220,255', white: '255,255,255' };

  // ---------------- glows: a soft round sprite per colour, drawn once, stamped with 'lighter' ----------------
  const glowCache = new Map();
  function glowSprite(rgb, hot) {
    const key = rgb + (hot ? '#' : '');
    let c = glowCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    if (hot) { gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.16, `rgba(${rgb},0.95)`); } else gr.addColorStop(0, `rgba(${rgb},0.85)`);
    gr.addColorStop(0.45, `rgba(${rgb},0.32)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    glowCache.set(key, c);
    return c;
  }
  V.glow = function (ctx, x, y, r, rgb, a, hot, sq) {
    if (a <= 0.004 || r <= 0.5) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= Math.min(1, a);
    const s = sq || 1;
    ctx.drawImage(glowSprite(rgb, hot), x - r, y - r * s, r * 2, r * 2 * s);
    ctx.restore();
  };

  // ---------------- toon shapes ----------------
  const ink = (ctx, lw) => { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke(); };

  // a flame tongue standing on (x, y), h tall, w wide, flickering with ph; three tones inside a dark outline
  function flamePath(ctx, x, y, w, h, ph) {
    const lean = Math.sin(ph * 1.7) * w * 0.28, wob = Math.sin(ph * 3.1) * w * 0.08;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y - h * 0.16);
    ctx.bezierCurveTo(x - w * 0.66 - wob, y - h * 0.56, x - w * 0.1 + lean * 0.6, y - h * 0.66, x + lean, y - h);
    ctx.bezierCurveTo(x + w * 0.22 + lean * 0.5, y - h * 0.62, x + w * 0.66 + wob, y - h * 0.52, x + w * 0.5, y - h * 0.16);
    ctx.bezierCurveTo(x + w * 0.46, y + h * 0.06, x - w * 0.46, y + h * 0.06, x - w * 0.5, y - h * 0.16);
    ctx.closePath();
  }
  V.flame = function (ctx, x, y, w, h, ph, pal, a) {
    if (a <= 0.01 || h < 2) return;
    ctx.save();
    ctx.globalAlpha *= a;
    flamePath(ctx, x, y, w, h, ph); ink(ctx, Math.max(2, w * 0.13));
    ctx.fillStyle = pal[0]; ctx.fill();
    flamePath(ctx, x, y + h * 0.03, w * 0.64, h * 0.72, ph + 0.9); ctx.fillStyle = pal[1]; ctx.fill();
    flamePath(ctx, x, y + h * 0.05, w * 0.32, h * 0.42, ph + 1.8); ctx.fillStyle = pal[2]; ctx.fill();
    ctx.restore();
  };

  // a crystal (ice) or a rock spike standing on (x, y): faceted, a light face on the left, a highlight line
  V.spike = function (ctx, x, y, w, h, tilt, pal, a, jag) {
    if (a <= 0.01 || h < 2) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(tilt || 0);
    ctx.globalAlpha *= a;
    const j = jag || 0, tip = [w * 0.08 * j, -h];
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0); ctx.lineTo(-w * 0.5, -h * 0.55); ctx.lineTo(-w * 0.2 - w * 0.1 * j, -h * 0.82); ctx.lineTo(tip[0], tip[1]);
      ctx.lineTo(w * 0.28, -h * 0.76); ctx.lineTo(w * 0.5, -h * 0.5); ctx.lineTo(w / 2, 0); ctx.closePath();
    };
    body(); ink(ctx, Math.max(2.5, w * 0.12)); ctx.fillStyle = pal[0]; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w * 0.5, -h * 0.55); ctx.lineTo(-w * 0.2 - w * 0.1 * j, -h * 0.82); ctx.lineTo(tip[0], tip[1]); ctx.lineTo(0, 0); ctx.closePath();
    ctx.fillStyle = pal[1]; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-w * 0.34, -h * 0.12); ctx.lineTo(-w * 0.34, -h * 0.5); ctx.lineTo(-w * 0.12, -h * 0.72);
    ctx.lineWidth = Math.max(1.5, w * 0.07); ctx.strokeStyle = pal[2]; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
  };

  // a sword-slash crescent around (x, y): from angle a0 sweeping `sweep`, thickest in the middle; outline, colour, white core
  V.crescent = function (ctx, x, y, r, a0, sweep, thick, sq, pal, a) {
    if (a <= 0.01 || thick < 0.5) return;
    const n = 26, s = sq || 1;
    const edge = (k, inner) => {
      const t = k / n, ang = a0 + sweep * t, rr = inner ? r - Math.sin(t * Math.PI) * thick : r;
      return [x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * s];
    };
    const path = (shrink) => {
      ctx.beginPath();
      for (let k = 0; k <= n; k++) { const p = edge(k, false); ctx.lineTo(p[0], p[1]); }
      for (let k = n; k >= 0; k--) {
        const t = k / n, ang = a0 + sweep * t, rr = r - Math.sin(t * Math.PI) * thick * shrink;
        ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * s);
      }
      ctx.closePath();
    };
    ctx.save();
    ctx.globalAlpha *= a;
    path(1); ink(ctx, Math.max(3, thick * 0.22)); ctx.fillStyle = pal[0]; ctx.fill();
    path(0.62); ctx.fillStyle = pal[1]; ctx.fill();
    path(0.28); ctx.fillStyle = pal[2]; ctx.fill();
    ctx.restore();
  };

  // jagged lightning between two points (new jags with seed)
  V.boltPoints = function (x0, y0, x1, y1, seg, jag, seed) {
    const r = NC.rng(seed | 0), pts = [[x0, y0]], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let i = 1; i < seg; i++) {
      const t = i / seg, off = (r() - 0.5) * 2 * jag * Math.sin(t * Math.PI);
      pts.push([x0 + dx * t + nx * off, y0 + dy * t + ny * off]);
    }
    pts.push([x1, y1]);
    return pts;
  };
  V.bolt = function (ctx, pts, w, rgb, a) {
    if (a <= 0.01) return;
    const line = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    line(); ctx.strokeStyle = OUT; ctx.lineWidth = w + 6; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    line(); ctx.strokeStyle = `rgba(${rgb},0.45)`; ctx.lineWidth = w * 3.2; ctx.stroke();
    line(); ctx.strokeStyle = `rgb(${rgb})`; ctx.lineWidth = w; ctx.stroke();
    line(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, w * 0.4); ctx.stroke();
    ctx.restore();
  };

  // a magic circle on the ground: rings, ticks, runes and a star, glowing lines (seen at the 3/4 camera)
  const runeCache = new Map();
  function runeGlyphs(seed) {
    if (runeCache.has(seed)) return runeCache.get(seed);
    const r = NC.rng(seed), out = [];
    for (let i = 0; i < 16; i++) {
      const strokes = [];
      const n = 2 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) strokes.push([[r() - 0.5, r() - 0.5], [r() - 0.5, r() - 0.5]]);
      out.push(strokes);
    }
    runeCache.set(seed, out);
    return out;
  }
  V.magicCircle = function (ctx, x, y, r, rot, rgb, a, style, sq) {
    if (a <= 0.01 || r < 2) return;
    const s = sq || V.SQ, st = style || 'arcane';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, s);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= a;
    const soft = (draw, lw) => {
      ctx.strokeStyle = `rgba(${rgb},0.28)`; ctx.lineWidth = lw * 3.4; draw(); ctx.stroke();
      ctx.strokeStyle = `rgba(${rgb},0.95)`; ctx.lineWidth = lw; draw(); ctx.stroke();
    };
    const circ = (rr) => () => { ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); };
    ctx.drawImage(glowSprite(rgb, false), -r * 1.15, -r * 1.15, r * 2.3, r * 2.3);
    soft(circ(r), 4); soft(circ(r * 0.9), 2.5); soft(circ(r * 0.56), 3);
    // ticks between the two outer rings
    ctx.save(); ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 60; i++) { const ang = (i / 60) * TAU, l = i % 5 === 0 ? 0.9 : 0.94; ctx.moveTo(Math.cos(ang) * r * l, Math.sin(ang) * r * l); ctx.lineTo(Math.cos(ang) * r * 0.985, Math.sin(ang) * r * 0.985); }
    ctx.strokeStyle = `rgba(${rgb},0.9)`; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    // runes on the middle band, turning the other way
    const glyphs = runeGlyphs(st.length * 7 + 3), gr = r * 0.73, gs = r * 0.11;
    ctx.save(); ctx.rotate(-rot * 0.7);
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * TAU, gx = Math.cos(ang) * gr, gy = Math.sin(ang) * gr;
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(ang + Math.PI / 2);
      ctx.beginPath();
      for (const [p0, p1] of glyphs[i % glyphs.length]) { ctx.moveTo(p0[0] * gs * 2, p0[1] * gs * 2); ctx.lineTo(p1[0] * gs * 2, p1[1] * gs * 2); }
      ctx.strokeStyle = `rgba(${rgb},0.95)`; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // the star inside
    ctx.save(); ctx.rotate(rot * 1.3);
    const pts = st === 'occult' ? 5 : st === 'holy' ? 8 : 6, step = st === 'occult' ? 2 : st === 'holy' ? 3 : 2;
    const star = () => {
      ctx.beginPath();
      for (let i = 0; i <= pts; i++) { const ang = ((i * step) / pts) * TAU - Math.PI / 2; ctx.lineTo(Math.cos(ang) * r * 0.56, Math.sin(ang) * r * 0.56); }
      if (pts === 6) { ctx.moveTo(Math.cos(-Math.PI / 2 + Math.PI / 3) * r * 0.56, 0); }
    };
    if (pts === 6) {
      for (const off of [0, Math.PI / 3]) soft(() => { ctx.beginPath(); for (let i = 0; i <= 3; i++) { const ang = off + (i / 3) * TAU - Math.PI / 2; ctx.lineTo(Math.cos(ang) * r * 0.56, Math.sin(ang) * r * 0.56); } }, 2.5);
    } else soft(star, 2.5);
    soft(circ(r * 0.2), 2);
    ctx.restore();
    ctx.restore();
  };

  // a puffy cloud / smoke blob: a few overlapping circles, outlined as one, a light top
  V.blob = function (ctx, x, y, r, seed, fill, a, hi) {
    if (a <= 0.01 || r < 1) return;
    const R = NC.rng(seed | 0), n = 6, cs = [];
    for (let i = 0; i < n; i++) { const ang = (i / n) * TAU + R(); cs.push([x + Math.cos(ang) * r * 0.45, y + Math.sin(ang) * r * 0.32, r * (0.42 + R() * 0.2)]); }
    cs.push([x, y, r * 0.62]);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.beginPath();
    for (const [cx, cy, cr] of cs) { ctx.moveTo(cx + cr, cy); ctx.arc(cx, cy, cr, 0, TAU); }
    ctx.lineWidth = Math.max(3, r * 0.16); ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = fill; ctx.fill();
    if (hi) {
      ctx.beginPath();
      for (const [cx, cy, cr] of cs) { if (cy > y) continue; ctx.moveTo(cx - cr * 0.1 + cr * 0.55, cy - cr * 0.25); ctx.arc(cx - cr * 0.1, cy - cr * 0.25, cr * 0.55, 0, TAU); }
      ctx.fillStyle = hi; ctx.fill();
    }
    ctx.restore();
  };

  // a toon five-point star
  V.star = function (ctx, x, y, s, rot, fill, a) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= a;
    NC.star(ctx, x, y, s, rot); ink(ctx, Math.max(2, s * 0.22)); ctx.fillStyle = fill; ctx.fill();
    NC.star(ctx, x, y, s * 0.45, rot); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();
  };

  // a big sword of light pointing down, its tip at (x, y)
  V.lightSword = function (ctx, x, y, len, w, a, pal) {
    if (a <= 0.01) return;
    const P = pal || V.PAL.holy;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha *= a;
    const blade = (k) => {
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-w * 0.5 * k, -len * 0.16); ctx.lineTo(-w * 0.5 * k, -len * 0.78); ctx.lineTo(w * 0.5 * k, -len * 0.78);
      ctx.lineTo(w * 0.5 * k, -len * 0.16); ctx.closePath();
    };
    blade(1); ink(ctx, Math.max(4, w * 0.13)); ctx.fillStyle = P[1]; ctx.fill();
    blade(0.5); ctx.fillStyle = P[2]; ctx.fill();
    // the fuller: a line down the middle
    ctx.beginPath(); ctx.moveTo(0, -len * 0.1); ctx.lineTo(0, -len * 0.74); ctx.lineWidth = Math.max(2, w * 0.08); ctx.strokeStyle = P[0]; ctx.stroke();
    // cross-guard, grip, pommel
    const gy = -len * 0.78;
    ctx.beginPath(); ctx.moveTo(-w * 1.25, gy); ctx.quadraticCurveTo(0, gy - w * 0.35, w * 1.25, gy); ctx.lineTo(w * 1.1, gy - w * 0.32);
    ctx.quadraticCurveTo(0, gy - w * 0.62, -w * 1.1, gy - w * 0.32); ctx.closePath();
    ink(ctx, Math.max(3, w * 0.11)); ctx.fillStyle = P[0]; ctx.fill();
    ctx.beginPath(); ctx.rect(-w * 0.18, gy - len * 0.17, w * 0.36, len * 0.13); ink(ctx, Math.max(3, w * 0.1)); ctx.fillStyle = '#8a5a34'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, gy - len * 0.19, w * 0.3, 0, TAU); ink(ctx, Math.max(3, w * 0.1)); ctx.fillStyle = '#ff4a5a'; ctx.fill();
    ctx.restore();
  };

  // a meteor: a dark rock with glowing cracks, (x, y) its centre
  V.rock = function (ctx, x, y, r, rot, seed, a, glowCol) {
    if (a <= 0.01) return;
    const R = NC.rng(seed | 0), n = 9, pts = [];
    for (let i = 0; i < n; i++) { const ang = (i / n) * TAU, rr = r * (0.78 + R() * 0.3); pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr]); }
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.globalAlpha *= a;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    ink(ctx, Math.max(3, r * 0.14)); ctx.fillStyle = '#5a4238'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(pts[5][0] * 0.9, pts[5][1] * 0.9); ctx.lineTo(pts[6][0] * 0.9, pts[6][1] * 0.9); ctx.lineTo(pts[7][0] * 0.9, pts[7][1] * 0.9); ctx.lineTo(0, 0); ctx.closePath();
    ctx.fillStyle = '#7a5a48'; ctx.fill();
    if (glowCol) {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { const p = pts[(i * 2) % n]; ctx.moveTo(p[0] * 0.2, p[1] * 0.2); ctx.lineTo(p[0] * 0.75, p[1] * 0.75); }
      ctx.lineWidth = Math.max(2, r * 0.1); ctx.strokeStyle = glowCol; ctx.stroke();
    }
    ctx.restore();
  };

  // a shadow tendril rising from (x, y), h tall, swaying with ph, a clawed hand at the top
  V.tendril = function (ctx, x, y, h, w, ph, a, pal) {
    if (a <= 0.01 || h < 4) return;
    const P = pal || V.PAL.shadow, n = 10, L = [], Rr = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, sway = Math.sin(ph + t * 3.2) * w * 1.1 * t, cx = x + sway, cy = y - h * t, ww = w * (1 - t * 0.6) * 0.5;
      L.push([cx - ww, cy]); Rr.push([cx + ww, cy]);
    }
    const top = [x + Math.sin(ph + 3.2) * w * 1.1, y - h];
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.beginPath();
    L.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    // three claws
    for (let k = -1; k <= 1; k++) { const ang = -Math.PI / 2 + k * 0.55 + Math.sin(ph * 2) * 0.1; ctx.lineTo(top[0] + Math.cos(ang) * w * 0.9, top[1] + Math.sin(ang) * w * 0.9); ctx.lineTo(top[0] + k * w * 0.15, top[1] - w * 0.1); }
    for (let i = Rr.length - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
    ctx.closePath();
    ink(ctx, Math.max(3, w * 0.22)); ctx.fillStyle = P[0]; ctx.fill();
    ctx.beginPath();
    for (let i = 1; i < n; i++) { const p = L[i], q = Rr[i]; ctx.lineTo((p[0] * 0.7 + q[0] * 0.3), p[1]); }
    ctx.lineWidth = Math.max(2, w * 0.14); ctx.strokeStyle = P[1]; ctx.stroke();
    ctx.restore();
  };

  // a cartoon skull (the plague cloud's face), centre (x, y), size s
  V.skull = function (ctx, x, y, s, fill, a) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.beginPath(); ctx.arc(x, y - s * 0.1, s * 0.5, Math.PI * 0.92, Math.PI * 2.08); ctx.lineTo(x + s * 0.32, y + s * 0.42); ctx.lineTo(x - s * 0.32, y + s * 0.42); ctx.closePath();
    ink(ctx, Math.max(3, s * 0.07)); ctx.fillStyle = fill; ctx.fill();
    ctx.fillStyle = OUT;
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + k * s * 0.19, y - s * 0.02, s * 0.13, s * 0.15, 0, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.12); ctx.lineTo(x - s * 0.06, y + s * 0.24); ctx.lineTo(x + s * 0.06, y + s * 0.24); ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  // a translucent dome over (x, y): a shield, hexagons shimmering over it
  V.dome = function (ctx, x, y, rx, ry, rgb, a, t) {
    if (a <= 0.01) return;
    const path = () => { ctx.beginPath(); ctx.ellipse(x, y - ry * 0.35, rx, ry, 0, 0, TAU); };
    ctx.save();
    ctx.globalAlpha *= a;
    path(); ctx.fillStyle = `rgba(${rgb},0.16)`; ctx.fill();
    ctx.save();
    path(); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const hs = 26;
    ctx.beginPath();
    for (let gy = -ry * 1.4; gy < ry; gy += hs * 0.87) {
      const row = Math.round((gy + ry * 1.4) / (hs * 0.87));
      for (let gx = -rx - hs; gx < rx + hs; gx += hs * 1.5) {
        const cx = x + gx + (row % 2 ? hs * 0.75 : 0), cy = y - ry * 0.35 + gy;
        for (let k = 0; k <= 6; k++) { const ang = (k / 6) * TAU; const px = cx + Math.cos(ang) * hs * 0.5, py = cy + Math.sin(ang) * hs * 0.5; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      }
    }
    ctx.strokeStyle = `rgba(${rgb},0.3)`; ctx.lineWidth = 1.6; ctx.stroke();
    // a band of light sweeping up the dome
    const by = y + ry * 0.65 - ((t * 140) % (ry * 2.6));
    const g = ctx.createLinearGradient(0, by - 24, 0, by + 24);
    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.5, `rgba(255,255,255,0.35)`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - rx, by - 24, rx * 2, 48);
    ctx.restore();
    path(); ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.stroke();
    path(); ctx.lineWidth = 3.5; ctx.strokeStyle = `rgb(${rgb})`; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x - rx * 0.3, y - ry * 0.95, rx * 0.35, ry * 0.18, -0.4, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
    ctx.restore();
  };

  // ---------------- lights (the night lighting pass lights these too), flashes, timelines ----------------
  V.light = function (x, y, r, rgb, a, life, o) {
    const L = Object.assign({ x, y, r, rgb, a, life, t: 0 }, o || {});
    FX.lights.push(L);
    return L;
  };
  V.flash = function (rgb, a, life, mode) { FX.flashes.push({ rgb, a, life, t: 0, mode: mode || 'lighter' }); };
  V.shake = function (game, s) { game.shake = Math.max(game.shake, s); };
  V.stop = function (game, s) { game.hitstop = Math.max(game.hitstop, s); };
  V.at = function (delay, fn) { return FX.add({ type: 'timer', layer: 'none', life: Math.max(0.001, delay), onEnd: fn }); };
  // call fn(i, k) n times over `dur` seconds (k = 0..1)
  V.every = function (dur, n, fn) {
    let i = 0;
    return FX.add({ type: 'timer', layer: 'none', life: dur + 0.001, update(o) { while (i < n && o.t >= (i / Math.max(1, n - 1)) * dur) { fn(i, n > 1 ? i / (n - 1) : 1); i++; } } });
  };

  // ---------------- effect types ----------------
  // a soft glow (x, y) growing r0 -> r1, fading in and out; follow: an object whose x, y it stays on
  FX.def('vglow', (ctx, p, u) => {
    const x = p.follow ? p.follow.x + (p.ox || 0) : p.x, y = p.follow ? p.follow.y + (p.oy || 0) : p.y;
    V.glow(ctx, x, y, lerp(p.r0, p.r1, easeOut(u)), p.rgb, p.a * fade(u, p.fin || 0.1, p.fout || 0.6), p.hot, p.sq);
  }, 'glow');
  V.glowAt = (x, y, r0, r1, rgb, a, life, o) => FX.add(Object.assign({ type: 'vglow', x, y, r0, r1, rgb, a, life }, o || {}));

  // a toon shockwave ring on the ground: outline, colour band, bright inner line; thins as it grows
  FX.def('vring', (ctx, p, u) => {
    const r = lerp(p.r0, p.r1, easeOut(u)), w = p.w * (1 - u * 0.75), a = (1 - u) * (p.a || 1), s = p.sq || V.SQ;
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= a;
    const ell = () => { ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * s, 0, 0, TAU); };
    if (p.ink !== false) { ell(); ctx.lineWidth = w + 6; ctx.strokeStyle = OUT; ctx.stroke(); }
    ell(); ctx.lineWidth = w; ctx.strokeStyle = p.col || `rgb(${p.rgb})`; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ell(); ctx.lineWidth = w * 2.6; ctx.strokeStyle = `rgba(${p.rgb},0.25)`; ctx.stroke();
    ell(); ctx.lineWidth = Math.max(1.5, w * 0.3); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    ctx.restore();
  }, 'glow');
  V.ring = (x, y, r0, r1, w, rgb, life, o) => FX.add(Object.assign({ type: 'vring', x, y, r0, r1, w, rgb, life }, o || {}));

  // a magic circle on the ground: fades in, turns, fades out (style: arcane | holy | occult | star)
  FX.def('vcircle', (ctx, p, u) => {
    const a = (p.a || 1) * fade(u, p.fin || 0.12, p.fout || 0.3), r = p.r * (p.grow ? lerp(0.6, 1, easeOut(Math.min(1, u / 0.25))) : 1);
    V.magicCircle(ctx, p.follow ? p.follow.x : p.x, p.follow ? p.follow.y : p.y, r, p.rot0 + p.t * (p.spin || 0.8), p.rgb, a, p.style);
  }, 'low');
  V.circle = (x, y, r, rgb, life, o) => FX.add(Object.assign({ type: 'vcircle', x, y, r, rgb, life, rot0: rand(0, TAU) }, o || {}));

  // ground marks: scorch (burnt, glowing cracks cooling), frost (a pale star of ice), crack (rays), goo (a splat)
  FX.def('vdecal', (ctx, p, u) => {
    const a = (p.a || 1) * fade(u, 0.05, 0.4), R = NC.rng(p.seed), s = V.SQ;
    if (a <= 0.01) return;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.scale(1, s);
    ctx.globalAlpha *= a;
    if (p.kind === 'scorch' || p.kind === 'burn') {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r);
      g.addColorStop(0, 'rgba(30,18,24,0.7)'); g.addColorStop(0.7, 'rgba(40,24,30,0.4)'); g.addColorStop(1, 'rgba(40,24,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
      const heat = Math.max(0, 1 - u * 1.6);
      if (heat > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        for (let i = 0; i < 9; i++) {
          const ang = R() * TAU; let x = 0, y = 0;
          ctx.moveTo(x, y);
          for (let k = 0; k < 4; k++) { x += Math.cos(ang + (R() - 0.5)) * p.r * 0.22; y += Math.sin(ang + (R() - 0.5)) * p.r * 0.22; ctx.lineTo(x, y); }
        }
        ctx.strokeStyle = `rgba(${p.rgb || '255,150,60'},${0.9 * heat})`; ctx.lineWidth = 4; ctx.stroke();
      }
    } else if (p.kind === 'frost') {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r);
      g.addColorStop(0, 'rgba(190,235,255,0.45)'); g.addColorStop(1, 'rgba(190,235,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + p.seed, L = p.r * 0.85;
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * L, Math.sin(ang) * L);
        for (const f of [0.4, 0.65]) {
          const bx = Math.cos(ang) * L * f, by = Math.sin(ang) * L * f;
          for (const k of [-1, 1]) { ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(ang + k * 0.7) * L * 0.2, by + Math.sin(ang + k * 0.7) * L * 0.2); }
        }
      }
      ctx.strokeStyle = 'rgba(225,248,255,0.85)'; ctx.lineWidth = 3; ctx.stroke();
    } else if (p.kind === 'crack') {
      ctx.beginPath();
      for (let i = 0; i < (p.n || 10); i++) {
        const ang = (i / (p.n || 10)) * TAU + R() * 0.4; let x = 0, y = 0;
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += Math.cos(ang + (R() - 0.5) * 0.7) * p.r * 0.2; y += Math.sin(ang + (R() - 0.5) * 0.7) * p.r * 0.2; ctx.lineTo(x, y); }
      }
      const lw = p.lw || 7;
      ctx.strokeStyle = 'rgba(28,20,32,0.8)'; ctx.lineWidth = lw; ctx.stroke();
      if (p.rgb) {
        const heat = Math.max(0, 1 - u * 1.4);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${p.rgb},${0.35 * heat})`; ctx.lineWidth = lw * 1.9; ctx.stroke();
        ctx.strokeStyle = `rgba(${p.rgb},${heat})`; ctx.lineWidth = lw * 0.45; ctx.stroke();
      }
    } else if (p.kind === 'goo') {
      ctx.beginPath();
      for (let i = 0; i < 9; i++) { const ang = R() * TAU, rr = p.r * (0.3 + R() * 0.5); ctx.moveTo(Math.cos(ang) * rr + p.r * 0.2, Math.sin(ang) * rr); ctx.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, p.r * 0.2, 0, TAU); }
      ctx.arc(0, 0, p.r * 0.55, 0, TAU);
      ctx.fillStyle = p.col || 'rgba(90,190,70,0.55)'; ctx.fill();
    }
    ctx.restore();
  }, 'low');
  V.decal = (x, y, r, kind, life, o) => FX.add(Object.assign({ type: 'vdecal', x, y, r, kind, life, seed: Math.floor(rand(1, 9999)) }, o || {}));

  // a flame particle (rises, flickers, shrinks); pal from V.PAL
  FX.def('vflame', (ctx, p, u) => {
    const k = u < 0.15 ? u / 0.15 : 1 - Math.pow((u - 0.15) / 0.85, 1.5);
    V.flame(ctx, p.x, p.y, p.w * k, p.h * k, p.t * 14 + p.ph, p.pal, 1);
  }, 'glow');
  V.flameAt = (x, y, w, h, pal, life, o) => FX.add(Object.assign({ type: 'vflame', x, y, w, h, pal, life, ph: rand(0, 9), vx: 0, vy: 0 }, o || {}));

  // a streak of light (a spark, a speed line) along its velocity
  FX.def('vstreak', (ctx, p, u) => {
    const a = (1 - u) * (p.a || 1), L = p.len * (1 - u * 0.5), sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp;
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - ux * L, p.y - uy * L);
    ctx.strokeStyle = `rgba(${p.rgb},${0.5 * a})`; ctx.lineWidth = p.w * 2.4; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = p.w * 0.7; ctx.stroke();
    ctx.restore();
  }, 'glow');
  V.sparks = function (x, y, n, rgb, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const ang = o.ang !== undefined ? o.ang + rand(-(o.spread || 0.6), o.spread || 0.6) : rand(0, TAU), s = rand(o.min || 300, o.max || 700);
      FX.add({ type: 'vstreak', x, y, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s * (o.sq || 1), drag: o.drag || 5, grav: o.grav || 0,
        len: rand(18, 34) * (o.size || 1), w: (o.w || 3) * rand(0.7, 1.2), rgb, life: rand(0.2, 0.42) * (o.lifeK || 1) });
    }
  };

  // a flying chunk: ice (glass) or rock, turning, falling
  FX.def('vshard', (ctx, p, u) => {
    const a = u > 0.75 ? (1 - u) / 0.25 : 1;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
    V.spike(ctx, 0, p.s * 0.5, p.s * 0.7, p.s, 0, p.pal, a, 1);
    ctx.restore();
  }, 'high');
  V.debris = function (x, y, n, pal, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const ang = rand(-Math.PI, 0) + (o.tilt || 0), s = rand(o.min || 200, o.max || 520);
      FX.add({ type: 'vshard', layer: o.layer || 'high', x, y, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, grav: o.grav || 1400, drag: 0.6,
        rot: rand(0, TAU), spin: rand(-12, 12), s: rand(10, 22) * (o.size || 1), pal, life: rand(0.5, 0.9) });
    }
  };

  // a spike standing on the ground among the characters (depth-sorted): rises fast, stays, then sinks or shatters
  FX.def('vspike', (ctx, p, u) => {
    const t = p.t, rise = p.rise || 0.12, k = t < rise ? easeOut(t / rise) : 1, out = u > 0.8 ? (1 - u) / 0.2 : 1;
    V.glow(ctx, p.x, p.y - p.h * 0.4 * k, p.w * 1.4, p.rgb || '255,255,255', (p.glowA || 0) * out, false);
    V.spike(ctx, p.x, p.y, p.w, p.h * k * (u > 0.8 && p.sink ? out : 1), p.tilt, p.pal, p.sink ? 1 : out, p.jag);
  }, 'sorted');
  V.spikeAt = (x, y, w, h, pal, life, o) => FX.add(Object.assign({ type: 'vspike', x, y, sort: y, w, h, pal, life, tilt: rand(-0.25, 0.25), jag: rand(-1, 1) }, o || {}));

  // lightning between two points; new jags every few frames
  FX.def('vbolt', (ctx, p, u) => {
    const a = (p.a || 1) * (u < 0.1 ? 1 : 1 - (u - 0.1) / 0.9) * (0.75 + 0.25 * Math.sin(p.t * 90));
    const seed = Math.floor(p.t * 28) + p.seed;
    V.bolt(ctx, V.boltPoints(p.x0, p.y0, p.x, p.y, p.seg || 12, p.jag || 40, seed), p.w || 7, p.rgb, a);
  }, 'glow');
  V.boltAt = (x0, y0, x1, y1, rgb, life, o) => FX.add(Object.assign({ type: 'vbolt', x0, y0, x: x1, y: y1, rgb, life, seed: Math.floor(rand(0, 9999)) }, o || {}));

  // a pillar of light: it slams down from the sky, then thins and fades. A soft haze, the colour, a white core, a foot
  // flaring out on the ground, streaks running up it; the dark edge (ink, inkCol) fades out upwards like the rest
  const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
  FX.def('vbeam', (ctx, p, u) => {
    const a = (p.a || 1) * fade(u, 0.03, 0.55);
    if (a <= 0.01) return;
    const land = p.drop === false ? 1 : easeOut(Math.min(1, p.t / 0.08)); // the column reaching the ground
    const w = p.w * (u < 0.08 ? 0.55 + 0.45 * (u / 0.08) : 1 - 0.55 * easeIn((u - 0.08) / 0.92));
    const top = p.y - p.h, bot = lerp(top, p.y, land), H = bot - top;
    if (H < 2) return;
    ctx.save();
    ctx.globalAlpha *= a;
    const col = (k, fill) => {
      const hw = (w * k) / 2, fl = land >= 1 ? hw * 0.5 : 0;
      ctx.beginPath();
      ctx.moveTo(p.x - hw, top); ctx.lineTo(p.x + hw, top); ctx.lineTo(p.x + hw, bot - hw * 0.6);
      ctx.quadraticCurveTo(p.x + hw, bot, p.x + hw + fl, bot);
      ctx.lineTo(p.x - hw - fl, bot);
      ctx.quadraticCurveTo(p.x - hw, bot, p.x - hw, bot - hw * 0.6);
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
    };
    const grad = (rgb, a0, a1, a2) => {
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, `rgba(${rgb},${a0})`); g.addColorStop(0.4, `rgba(${rgb},${a1})`); g.addColorStop(1, `rgba(${rgb},${a2})`);
      return g;
    };
    if (land >= 1) V.glow(ctx, p.x, p.y, w * 2.4, p.rgb, 0.9, true, V.SQ);
    if (p.ink !== false) col(1.12, grad(p.inkRGB || (p.inkRGB = rgbOf(p.inkCol || OUT)), 0, 0.85, 1));
    // (dark: a pillar of black light, its colour only in the glow round it and a thread down its middle)
    col(1, grad(p.dark ? p.darkRGB || (p.darkRGB = rgbOf(p.dark)) : p.rgb, 0, 0.92, 1));
    ctx.globalCompositeOperation = 'lighter';
    col(2.3, grad(p.rgb, 0, 0.16, 0.3));
    col(p.dark ? 0.22 : 0.42, grad(p.dark ? p.rgb : '255,255,255', 0, 0.9, 1));
    // streaks of light running up it
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(2, w * 0.05);
    for (let i = 0; i < 4; i++) {
      const sx = p.x + (i / 3 - 0.5) * w * 0.62, y1 = bot - ((p.t * 1400 + i * H * 0.31) % H);
      ctx.beginPath(); ctx.moveTo(sx, Math.max(top, y1)); ctx.lineTo(sx, Math.min(bot, y1 + H * 0.22)); ctx.stroke();
    }
    ctx.restore();
  }, 'glow');
  V.beam = (x, y, w, h, rgb, life, o) => FX.add(Object.assign({ type: 'vbeam', x, y, w, h, rgb, life }, o || {}));

  // a toon slash crescent (a sword swing): sweeps out, then thins; a see-through smear of its colour fans out behind the
  // blade and a spark rides the leading edge
  FX.def('vslash', (ctx, p, u) => {
    const grow = easeOut(Math.min(1, u / 0.35)), a = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
    const x = p.follow ? p.follow.x + (p.ox || 0) : p.x, y = p.follow ? p.follow.y + (p.oy || 0) : p.y, s = p.sq || 1;
    const rgb = p.rgb || '255,240,200', a0 = p.ang - (p.sweep / 2) * p.dir, sw = p.sweep * p.dir * grow;
    V.glow(ctx, x + Math.cos(p.ang) * p.r * 0.6, y + Math.sin(p.ang) * p.r * 0.6 * s, p.r * 0.9, rgb, 0.5 * a, false);
    if (p.smear !== false && Math.abs(sw) > 0.05) {
      const r1 = p.r, r0 = Math.max(4, p.r - p.thick * 2.6), n = 22;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      for (let k = 0; k <= n; k++) { const ang = a0 + (sw * k) / n; ctx.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1 * s); }
      for (let k = n; k >= 0; k--) { const ang = a0 + (sw * k) / n; ctx.lineTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0 * s); }
      ctx.closePath();
      const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
      g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},${0.34 * a * (1 - u * 0.5)})`);
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
    }
    V.crescent(ctx, x, y, p.r, a0, sw, p.thick * (1 - u * 0.55), s, p.pal, a);
    if (grow < 0.97) {
      const ang = a0 + sw, rr = p.r - p.thick * 0.25, ex = x + Math.cos(ang) * rr, ey = y + Math.sin(ang) * rr * s;
      V.glow(ctx, ex, ey, p.thick * 1.3, rgb, 0.9, true);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      V.flarePath(ctx, ex, ey, p.thick * 0.9, p.thick * 0.12, ang); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
      ctx.restore();
    }
  }, 'glow');
  V.slash = (x, y, r, ang, sweep, thick, pal, life, o) => FX.add(Object.assign({ type: 'vslash', x, y, r, ang, sweep, thick, pal, life, dir: 1 }, o || {}));

  // a toon smoke / cloud puff that grows and fades (fill colour, a lighter top)
  FX.def('vsmoke', (ctx, p, u) => {
    const r = lerp(p.r0, p.r1, easeOut(u)), a = (p.a || 1) * fade(u, 0.1, 0.5);
    V.blob(ctx, p.x, p.y, r, p.seed, p.fill, a, p.hi);
  }, 'high');
  V.smoke = function (x, y, n, fill, hi, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const ang = rand(0, TAU), s = rand(o.min || 30, o.max || 160);
      FX.add({ type: 'vsmoke', layer: o.layer || 'high', x: x + rand(-10, 10), y: y + rand(-8, 8), vx: Math.cos(ang) * s, vy: Math.sin(ang) * s * 0.5 - (o.rise || 30), drag: 2.5,
        r0: rand(12, 20) * (o.size || 1), r1: rand(28, 44) * (o.size || 1), fill, hi, life: rand(0.6, 1.1) * (o.lifeK || 1), seed: Math.floor(rand(0, 9999)), a: o.a || 1 });
    }
  };

  // a toon star that spins and fades (sparkles on impacts)
  FX.def('vstar', (ctx, p, u) => {
    const s = p.s * (u < 0.15 ? u / 0.15 : 1 - u * 0.6), a = u > 0.6 ? (1 - u) / 0.4 : 1;
    V.glow(ctx, p.x, p.y, s * 2.4, p.rgb || '255,230,140', 0.6 * a, false);
    V.star(ctx, p.x, p.y, s, p.rot, p.fill || '#ffd35c', a);
  }, 'glow');
  V.stars = function (x, y, n, fill, rgb, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const ang = rand(0, TAU), s = rand(80, o.speed || 320);
      FX.add({ type: 'vstar', x, y, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s - 60, drag: 2.8, grav: o.grav || 0, s: rand(8, 15) * (o.size || 1),
        rot: rand(0, TAU), spin: rand(-8, 8), fill, rgb, life: rand(0.5, 0.9) });
    }
  };

  // glowing motes drifting (rising embers, snow, spores, magic dust)
  FX.def('vmote', (ctx, p, u) => {
    const a = fade(u, 0.15, 0.5) * (p.a || 1);
    V.glow(ctx, p.x, p.y, p.r * 3, p.rgb, 0.8 * a, false);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.7, 0, TAU); ctx.fill();
    ctx.restore();
  }, 'glow');
  V.motes = function (x, y, n, rgb, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const ang = rand(0, TAU), d = rand(0, o.spread || 60);
      FX.add({ type: 'vmote', x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d * 0.6, vx: rand(-30, 30) + (o.vx || 0), vy: -rand(o.rise0 || 40, o.rise || 140), drag: 1,
        r: rand(2.5, 5) * (o.size || 1), rgb, life: rand(0.6, 1.3) * (o.lifeK || 1), a: o.a || 1 });
    }
  };
  // motes pulled in towards a point (charging up)
  V.gather = function (x, y, n, rgb, R, life) {
    for (let i = 0; i < n; i++) {
      const ang = rand(0, TAU), d = rand(R * 0.6, R), sx = x + Math.cos(ang) * d, sy = y + Math.sin(ang) * d * 0.7;
      FX.add({ type: 'vmote', x: sx, y: sy, r: rand(2.5, 5), rgb, life: life || 0.5, a: 1, update(o) { const k = V.easeIn(o.t / o.life); o.x = lerp(sx, x, k); o.y = lerp(sy, y, k); } });
    }
  };

  // an impact flare: a sharp four-point star of light that pops open and closes, turning a little
  V.flarePath = function (ctx, x, y, r, w, rot) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = rot + (i / 8) * TAU, rr = i % 2 ? w : r;
      ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    ctx.closePath();
  };
  FX.def('vflare', (ctx, p, u) => {
    const k = u < 0.18 ? V.easeOut(u / 0.18) : 1 - V.easeIn((u - 0.18) / 0.82), r = p.r * k, rot = p.rot + p.t * (p.spin || 1.5);
    if (r < 1) return;
    V.glow(ctx, p.x, p.y, r * 1.3, p.rgb, 0.8 * k, true);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    V.flarePath(ctx, p.x, p.y, r, r * 0.12, rot); ctx.fillStyle = `rgba(${p.rgb},0.85)`; ctx.fill();
    V.flarePath(ctx, p.x, p.y, r * 0.62, r * 0.07, rot + Math.PI / 4); ctx.fillStyle = `rgba(${p.rgb},0.6)`; ctx.fill();
    V.flarePath(ctx, p.x, p.y, r * 0.7, r * 0.06, rot); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
    ctx.restore();
  }, 'glow');
  V.flare = (x, y, r, rgb, life, o) => FX.add(Object.assign({ type: 'vflare', x, y, r, rgb, life: life || 0.3, rot: rand(-0.3, 0.3) }, o || {}));

  // a target on the ground where something will land: a ring closing in with ticks pointing at its centre, turning,
  // a glow filling it as the moment nears
  FX.def('vmark', (ctx, p, u) => {
    const r = p.r * lerp(1.45, 0.62, easeIn(u)), a = fade(u, 0.12, 0.04) * (0.75 + 0.25 * Math.sin(p.t * 24)), s = V.SQ;
    V.glow(ctx, p.x, p.y, p.r * (0.5 + 0.9 * u), p.rgb, 0.55 * u * a, false, s);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(p.x, p.y); ctx.scale(1, s); ctx.rotate(p.t * 1.5);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    for (let i = 0; i < 4; i++) { const ang = (i / 4) * TAU; ctx.moveTo(Math.cos(ang) * r * 1.2, Math.sin(ang) * r * 1.2); ctx.lineTo(Math.cos(ang) * r * 0.76, Math.sin(ang) * r * 0.76); }
    ctx.lineCap = 'round';
    ctx.lineWidth = 8; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = `rgb(${p.rgb})`; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
    ctx.restore();
  }, 'glow');
  V.mark = (x, y, r, rgb, life, o) => FX.add(Object.assign({ type: 'vmark', x, y, r, rgb, life }, o || {}));

  // a bubble rising out of a brew: outlined, a shine; it pops into a thin ring
  FX.def('vbubble', (ctx, p, u) => {
    ctx.save();
    if (u < 0.88) {
      const r = p.s * easeOut(Math.min(1, u / 0.3));
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.lineWidth = Math.max(2, r * 0.22); ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = p.fill; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x - r * 0.32, p.y - r * 0.32, r * 0.28, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    } else {
      const k = (u - 0.88) / 0.12;
      ctx.globalAlpha *= 1 - k;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 + k * 0.9), 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = p.fill; ctx.stroke();
    }
    ctx.restore();
  }, 'high');
  V.bubbles = function (x, y, n, fill, o) {
    o = o || {};
    const sp = o.spread || 30;
    for (let i = 0; i < n; i++)
      FX.add({ type: 'vbubble', x: x + rand(-sp, sp), y: y + rand(-sp, sp) * 0.6, vx: rand(-10, 10), vy: -rand(20, 60), s: rand(5, 11) * (o.size || 1), fill, life: rand(0.6, 1.1) });
  };

  // hero afterimages (fx.js 'hero'), tinted
  V.ghost = function (p, color, life) {
    if (p.pose) FX.add({ type: 'hero', x: p.x, y: p.y, equip: Object.assign({}, p.equip), pose: Object.assign({}, p.pose), color, life: life || 0.3 });
  };
})();
