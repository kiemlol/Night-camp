/* gl2d_path.js — shapes for the WebGL2 game screen (js/gl2d.js): colours and colour filters, paths in screen pixels,
   fills and strokes as triangles. README "จอเกมด้วย WebGL2".
   - A path keeps its points already moved by the transform of each call (as a 2D canvas does); arcs, ellipses and curves
     are cut into straight pieces no more than 0.2 px off the curve.
   - fan(): every subpath as a fan of triangles from its first point. When every subpath is convex those triangles ARE the
     shape; otherwise they only count the winding (gl2d_ctx.js draws them into the stencil, then covers).
   - stroke(): the outline worked out in the space of the transform (a squashed transform squashes the line, like canvas),
     quads per piece + joins (round / miter / bevel) + caps + dashes; overlaps are drawn once by the stencil when it shows.
   - colours: '#rgb[a]', '#rrggbb[aa]', 'rgb[a](...)' read here; any other CSS colour asks a real 2D canvas once.
   - filters: brightness, contrast, grayscale, sepia, saturate, hue-rotate, invert, opacity = colour matrices applied in order
     with a clamp after each (as the browser does); blur / drop-shadow are left out (a warning once). */
(function () {
  'use strict';
  const NC = window.NC, G = NC.GL2D;
  if (!G || !G.on) return;
  const TAU = Math.PI * 2, TOL = 0.2;
  const P = (G.path = {});

  // ---------------- colours ----------------
  const COL = new Map();
  let probe = null;
  const c255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v), c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const RGB = /^rgba?\(\s*([-+\d.e]+%?)\s*[,\s]\s*([-+\d.e]+%?)\s*[,\s]\s*([-+\d.e]+%?)\s*(?:[,/]\s*([-+\d.e]+%?)\s*)?\)$/;
  // 'rgb(' / 'rgba(' with plain numbers, read by hand (animated alphas make a new string every frame; the regex was slow)
  function fastRgb(s) {
    let i = s.charCodeAt(3) === 97 ? 5 : 4, k = 0;
    const v = [0, 0, 0, 1];
    while (k < 4) {
      while (s.charCodeAt(i) === 32) i++;
      let j = i;
      for (;;) { const c = s.charCodeAt(j); if ((c >= 48 && c <= 57) || c === 46 || c === 45 || c === 43 || c === 101) j++; else break; }
      if (j === i) return undefined;
      v[k++] = +s.slice(i, j);
      while (s.charCodeAt(j) === 32) j++;
      const c = s.charCodeAt(j);
      if (c === 41) break;            // )
      if (c !== 44) return undefined;  // , (anything else: the slow way)
      i = j + 1;
    }
    if (k < 3 || v.some((x) => x !== x)) return undefined;
    return [c255(Math.round(v[0])), c255(Math.round(v[1])), c255(Math.round(v[2])), c01(v[3])];
  }
  function read(s) {
    if (s.charCodeAt(0) === 114 && s.charCodeAt(1) === 103 && s.charCodeAt(2) === 98) { const f = fastRgb(s); if (f) return f; } // rgb
    if (s[0] === '#') {
      const h = s.slice(1);
      if (!/^[0-9a-f]+$/.test(h)) return null;
      if (h.length === 3 || h.length === 4) {
        const v = (i) => parseInt(h[i] + h[i], 16);
        return [v(0), v(1), v(2), h.length === 4 ? v(3) / 255 : 1];
      }
      if (h.length === 6 || h.length === 8) {
        const v = (i) => parseInt(h.slice(i, i + 2), 16);
        return [v(0), v(2), v(4), h.length === 8 ? v(6) / 255 : 1];
      }
      return null;
    }
    const m = RGB.exec(s);
    if (m) {
      const ch = (v) => c255(Math.round(v.endsWith('%') ? parseFloat(v) * 2.55 : parseFloat(v)));
      const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      if ([m[1], m[2], m[3]].some((v) => isNaN(parseFloat(v))) || isNaN(a)) return null;
      return [ch(m[1]), ch(m[2]), ch(m[3]), c01(a)];
    }
    return undefined; // (not ours to read)
  }
  // [r, g, b (0-255), a (0-1)] or null for a string the canvas would ignore
  P.color = function (s) {
    if (typeof s !== 'string') return null;
    let c = COL.get(s);
    if (c !== undefined) return c;
    const t = s.trim().toLowerCase();
    c = read(t);
    if (c === undefined) {
      probe = probe || document.createElement('canvas').getContext('2d');
      probe.fillStyle = '#010203'; probe.fillStyle = t;
      let n = probe.fillStyle;
      if (n === '#010203') { probe.fillStyle = '#040506'; probe.fillStyle = t; if (probe.fillStyle === '#040506') n = null; }
      c = n ? read(n) || null : null;
    }
    if (COL.size > 4096) COL.clear();
    COL.set(s, c);
    return c;
  };
  // premultiplied RGBA8 as one word (alpha already includes globalAlpha)
  P.pack = function (r, g, b, a) {
    if (!(a > 0)) return 0;
    if (a > 1) a = 1;
    return ((Math.round(a * 255) << 24) | (Math.round(b * a) << 16) | (Math.round(g * a) << 8) | Math.round(r * a)) >>> 0;
  };

  // ---------------- colour filters ----------------
  const FIL = new Map();
  function lumM(k, a) { // the colour matrices of the CSS filters, rows r g b (3x3)
    switch (k) {
      case 'grayscale': { const t = 1 - a; return [0.2126 + 0.7874 * t, 0.7152 - 0.7152 * t, 0.0722 - 0.0722 * t, 0.2126 - 0.2126 * t, 0.7152 + 0.2848 * t, 0.0722 - 0.0722 * t, 0.2126 - 0.2126 * t, 0.7152 - 0.7152 * t, 0.0722 + 0.9278 * t]; }
      case 'sepia': { const t = 1 - a; return [0.393 + 0.607 * t, 0.769 - 0.769 * t, 0.189 - 0.189 * t, 0.349 - 0.349 * t, 0.686 + 0.314 * t, 0.168 - 0.168 * t, 0.272 - 0.272 * t, 0.534 - 0.534 * t, 0.131 + 0.869 * t]; }
      case 'saturate': return [0.213 + 0.787 * a, 0.715 - 0.715 * a, 0.072 - 0.072 * a, 0.213 - 0.213 * a, 0.715 + 0.285 * a, 0.072 - 0.072 * a, 0.213 - 0.213 * a, 0.715 - 0.715 * a, 0.072 + 0.928 * a];
      case 'hue-rotate': { const c = Math.cos(a), s = Math.sin(a);
        return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
          0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
          0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]; }
    }
    return null;
  }
  // one step = a mat4 (column-major, for the shader) + an offset
  function step(m3, off, alpha) {
    const m = new Float32Array(16), o = new Float32Array(4);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m[c * 4 + r] = m3[r * 3 + c];
    m[15] = alpha === undefined ? 1 : alpha;
    if (off) { o[0] = off[0]; o[1] = off[1]; o[2] = off[2]; }
    return { m, o };
  }
  // NC.GL2D filter: null = none; { steps: [{m, o}...], n } otherwise (at most 4 steps, the rest folded into the last)
  P.filter = function (s) {
    if (!s || s === 'none') return null;
    if (FIL.has(s)) return FIL.get(s);
    const steps = [];
    const re = /([a-z-]+)\(([^)]*)\)/g;
    let m, bad = '';
    while ((m = re.exec(s))) {
      const k = m[1], v = m[2].trim();
      let a = v === '' ? (k === 'hue-rotate' ? 0 : 1) : parseFloat(v);
      if (v.endsWith('%')) a /= 100;
      if (k === 'hue-rotate') a = v.endsWith('turn') ? a * TAU : v.endsWith('rad') ? a : v.endsWith('grad') ? (a * Math.PI) / 200 : (a * Math.PI) / 180;
      if (isNaN(a)) continue;
      if (k === 'brightness') steps.push(step([a, 0, 0, 0, a, 0, 0, 0, a]));
      else if (k === 'contrast') steps.push(step([a, 0, 0, 0, a, 0, 0, 0, a], [0.5 - 0.5 * a, 0.5 - 0.5 * a, 0.5 - 0.5 * a]));
      else if (k === 'invert') { a = c01(a); const d = 1 - 2 * a; steps.push(step([d, 0, 0, 0, d, 0, 0, 0, d], [a, a, a])); }
      else if (k === 'opacity') steps.push(step([1, 0, 0, 0, 1, 0, 0, 0, 1], null, c01(a)));
      else if (lumM(k, k === 'grayscale' || k === 'sepia' ? c01(a) : a)) steps.push(step(lumM(k, k === 'grayscale' || k === 'sepia' ? c01(a) : a)));
      else bad += k + ' ';
    }
    if (bad && !G._warned['filter:' + bad]) { G._warned['filter:' + bad] = 1; console.warn('gl2d: filter left out:', bad.trim(), 'in', s); }
    while (steps.length > 4) { // fold: the last two as one (no clamp between them)
      const b = steps.pop(), a = steps.pop(), m = new Float32Array(16), o = new Float32Array(4);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let t = 0; for (let k = 0; k < 4; k++) t += b.m[k * 4 + r] * a.m[c * 4 + k]; m[c * 4 + r] = t; }
      for (let r = 0; r < 4; r++) { let t = b.o[r]; for (let k = 0; k < 4; k++) t += b.m[k * 4 + r] * a.o[k]; o[r] = t; }
      steps.push({ m, o });
    }
    const f = steps.length ? { n: steps.length, m: new Float32Array(64), o: new Float32Array(16) } : null;
    if (f) steps.forEach((st, i) => { f.m.set(st.m, i * 16); f.o.set(st.o, i * 4); });
    if (FIL.size > 256) FIL.clear();
    FIL.set(s, f);
    return f;
  };

  // ---------------- paths (points in screen pixels) ----------------
  function segs(r, sweep) {
    if (!(sweep > 0)) return 1;
    if (!(r > TOL)) return Math.max(1, Math.ceil(sweep / (Math.PI / 2)));
    const da = 2 * Math.acos(1 - TOL / r);
    return Math.max(1, Math.min(1024, Math.ceil(sweep / da)));
  }
  P.segs = segs;
  function sweepOf(a0, a1, ccw) {
    let sw = a1 - a0;
    if (!ccw) { if (sw >= TAU) sw = TAU; else { sw %= TAU; if (sw < 0) sw += TAU; } }
    else { if (sw <= -TAU) sw = -TAU; else { sw %= TAU; if (sw > 0) sw -= TAU; } }
    return sw;
  }
  class Path {
    constructor() { this.subs = []; this.n = 0; this.cur = null; }
    reset() { this.n = 0; this.cur = null; }
    _new(x, y) {
      let s = this.subs[this.n];
      if (!s) this.subs[this.n] = s = { p: [], closed: false, cv: false };
      else { s.p.length = 0; s.closed = false; s.cv = false; }
      this.n++; this.cur = s; s.p.push(x, y);
    }
    moveTo(x, y) {
      if (this.cur && this.cur.p.length === 2 && !this.cur.closed) { this.cur.p[0] = x; this.cur.p[1] = y; return; }
      this._new(x, y);
    }
    lineTo(x, y) {
      const s = this.cur;
      if (!s) { this._new(x, y); return; }
      const p = s.p, n = p.length;
      if (Math.abs(p[n - 2] - x) < 1e-7 && Math.abs(p[n - 1] - y) < 1e-7) return;
      p.push(x, y); s.cv = false;
    }
    close() {
      const s = this.cur;
      if (!s || s.p.length < 2) return;
      s.closed = true;
      this._new(s.p[0], s.p[1]);
    }
    convexSub() { if (this.cur && this.cur.p.length >= 6) this.cur.cv = true; } // (a rect, a round rect: no need to check)
    last() { const p = this.cur && this.cur.p; return p ? [p[p.length - 2], p[p.length - 1]] : null; }
    // points X = ox + ux cos t + vx sin t (a circle / an ellipse already moved by the transform), t from a0 by n steps of d;
    // the angle turned by a rotation each step (no sin / cos per point)
    _curve(ox, oy, ux, uy, vx, vy, a0, sw, n) {
      const d = sw / n, cd = Math.cos(d), sd = Math.sin(d);
      let c = Math.cos(a0), s = Math.sin(a0);
      let X = ox + ux * c + vx * s, Y = oy + uy * c + vy * s;
      const cur = this.cur, P0 = cur && cur.p;
      // a fresh subpath: nothing yet, or only the point the curve starts on (moveTo(x + r, y); arc(x, y, r, ...))
      const fresh = !cur || (P0.length === 2 && !cur.closed && Math.abs(P0[0] - X) < 1e-6 && Math.abs(P0[1] - Y) < 1e-6);
      if (!cur) this._new(X, Y); else this.lineTo(X, Y);
      const p = this.cur.p;
      for (let i = 1; i <= n; i++) {
        const c2 = c * cd - s * sd;
        s = s * cd + c * sd; c = c2;
        X = ox + ux * c + vx * s; Y = oy + uy * c + vy * s;
        p.push(X, Y);
      }
      this.cur.cv = fresh && Math.abs(sw) >= TAU - 1e-9; // (a whole circle / ellipse on its own: convex)
    }
    // (the canvas transform m = {a,b,c,d,e,f}, sc = its largest scale)
    arc(cx, cy, r, a0, a1, ccw, m, sc) {
      const sw = sweepOf(a0, a1, ccw), n = segs(r * sc, Math.abs(sw));
      this._curve(m.a * cx + m.c * cy + m.e, m.b * cx + m.d * cy + m.f, m.a * r, m.b * r, m.c * r, m.d * r, a0, sw, n);
    }
    ellipse(cx, cy, rx, ry, rot, a0, a1, ccw, m, sc) {
      const sw = sweepOf(a0, a1, ccw), n = segs(Math.max(rx, ry) * sc, Math.abs(sw));
      const cr = Math.cos(rot), sr = Math.sin(rot), e1x = rx * cr, e1y = rx * sr, e2x = -ry * sr, e2y = ry * cr;
      this._curve(m.a * cx + m.c * cy + m.e, m.b * cx + m.d * cy + m.f, m.a * e1x + m.c * e1y, m.b * e1x + m.d * e1y, m.a * e2x + m.c * e2y, m.b * e2x + m.d * e2y, a0, sw, n);
    }
    // curves: control points already in screen pixels
    quad(cx, cy, x, y) {
      const L = this.last();
      if (!L) { this._new(cx, cy); this.lineTo(x, y); return; }
      const [x0, y0] = L, dd = Math.hypot(x0 - 2 * cx + x, y0 - 2 * cy + y);
      const n = Math.max(1, Math.min(100, Math.ceil(Math.sqrt(dd / (8 * TOL)))));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        this.lineTo(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y);
      }
    }
    cubic(c1x, c1y, c2x, c2y, x, y) {
      const L = this.last();
      if (!L) { this._new(c1x, c1y); }
      const [x0, y0] = L || [c1x, c1y];
      const dd = Math.max(Math.hypot(x0 - 2 * c1x + c2x, y0 - 2 * c1y + c2y), Math.hypot(c1x - 2 * c2x + x, c1y - 2 * c2y + y));
      const n = Math.max(1, Math.min(100, Math.ceil(Math.sqrt((0.75 * dd) / TOL))));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        this.lineTo(u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x, u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y);
      }
    }
  }
  P.Path = Path;

  // ---------------- triangles out ----------------
  const O = (P.out = { P: new Float32Array(16384), np: 0, I: new Uint32Array(32768), ni: 0, x0: 0, y0: 0, x1: 0, y1: 0 });
  function clear() { O.np = 0; O.ni = 0; O.x0 = O.y0 = Infinity; O.x1 = O.y1 = -Infinity; }
  function pt(x, y) {
    if (O.np * 2 + 2 > O.P.length) { const n = new Float32Array(O.P.length * 2); n.set(O.P); O.P = n; }
    O.P[O.np * 2] = x; O.P[O.np * 2 + 1] = y;
    if (x < O.x0) O.x0 = x; if (x > O.x1) O.x1 = x; if (y < O.y0) O.y0 = y; if (y > O.y1) O.y1 = y;
    return O.np++;
  }
  function tri(a, b, c) {
    if (O.ni + 3 > O.I.length) { const n = new Uint32Array(O.I.length * 2); n.set(O.I); O.I = n; }
    O.I[O.ni++] = a; O.I[O.ni++] = b; O.I[O.ni++] = c;
  }
  P.clear = clear;

  function convex(p, n) { // n points (x, y, ...) of a closed polygon
    let sign = 0, xch = 0, ych = 0, pdx = 0, pdy = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, k = (i + 2) % n;
      const dx = p[2 * j] - p[2 * i], dy = p[2 * j + 1] - p[2 * i + 1];
      const cr = dx * (p[2 * k + 1] - p[2 * j + 1]) - dy * (p[2 * k] - p[2 * j]);
      if (cr > 1e-4) { if (sign < 0) return false; sign = 1; } else if (cr < -1e-4) { if (sign > 0) return false; sign = -1; }
      if (dx !== 0) { if (pdx !== 0 && dx > 0 !== pdx > 0) xch++; pdx = dx; }
      if (dy !== 0) { if (pdy !== 0 && dy > 0 !== pdy > 0) ych++; pdy = dy; }
    }
    return xch <= 2 && ych <= 2;
  }
  // star-shaped from its centre (every edge seen turning the same way, once round): a fan from the centre covers it exactly
  // (stars, petals, blobs); a pentagram drawn in one line goes round twice and is not
  function starFan(p, n) {
    if (n > 256) return false;
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += p[2 * i]; cy += p[2 * i + 1]; }
    cx /= n; cy /= n;
    let sign = 0, turn = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ax = p[2 * i] - cx, ay = p[2 * i + 1] - cy, bx = p[2 * j] - cx, by = p[2 * j + 1] - cy;
      const cr = ax * by - ay * bx;
      if (cr > 1e-6) { if (sign < 0) return false; sign = 1; } else if (cr < -1e-6) { if (sign > 0) return false; sign = -1; } else return false;
      turn += Math.atan2(cr, ax * bx + ay * by);
    }
    if (Math.abs(Math.abs(turn) - TAU) > 0.01) return false;
    const c = pt(cx, cy), b = O.np;
    for (let i = 0; i < n; i++) pt(p[2 * i], p[2 * i + 1]);
    for (let i = 0; i < n; i++) tri(c, b + i, b + ((i + 1) % n));
    return true;
  }
  // every subpath as triangles; returns { convex: every subpath drawn without overlaps of its own (convex fan / star fan),
  // subs: how many have an area, apart: their boxes do not overlap }
  const FAN = { convex: true, subs: 0, apart: true };
  const BX = [];
  P.fan = function (path) {
    clear();
    FAN.convex = true; FAN.subs = 0; FAN.apart = true;
    BX.length = 0;
    for (let s = 0; s < path.n; s++) {
      const p = path.subs[s].p;
      let n = p.length >> 1;
      if (n > 1 && Math.abs(p[0] - p[2 * n - 2]) < 1e-7 && Math.abs(p[1] - p[2 * n - 1]) < 1e-7) n--; // (closed on its first point)
      if (n < 3) continue;
      FAN.subs++;
      const n0 = O.np, x0 = O.x0, y0 = O.y0, x1 = O.x1, y1 = O.y1;
      O.x0 = O.y0 = Infinity; O.x1 = O.y1 = -Infinity;
      if (path.subs[s].cv || !FAN.convex || convex(p, n)) {
        const b = pt(p[0], p[1]);
        for (let i = 1; i < n; i++) pt(p[2 * i], p[2 * i + 1]);
        for (let i = 1; i < n - 1; i++) tri(b, b + i, b + i + 1);
      } else if (!starFan(p, n)) {
        FAN.convex = false;
        O.np = n0;
        const b = pt(p[0], p[1]);
        for (let i = 1; i < n; i++) pt(p[2 * i], p[2 * i + 1]);
        for (let i = 1; i < n - 1; i++) tri(b, b + i, b + i + 1);
      }
      if (FAN.apart && FAN.subs <= 48) {
        for (let k = 0; k < BX.length; k += 4) if (O.x0 < BX[k + 2] && O.x1 > BX[k] && O.y0 < BX[k + 3] && O.y1 > BX[k + 1]) { FAN.apart = false; break; }
        BX.push(O.x0, O.y0, O.x1, O.y1);
      } else FAN.apart = false;
      O.x0 = Math.min(O.x0, x0); O.y0 = Math.min(O.y0, y0); O.x1 = Math.max(O.x1, x1); O.y1 = Math.max(O.y1, y1);
    }
    return FAN;
  };

  // ---------------- strokes ----------------
  let U = new Float64Array(4096);
  // O.smooth after a stroke: one subpath, every turn under ~25 deg (drawn as one strip without overlaps), so a see-through
  // line can be drawn straight (rings, arcs) instead of through the stencil
  P.stroke = function (path, m, lw, cap, join, miterLimit, dash, dashOff, sc) {
    clear();
    O.smooth = true;
    let used = 0;
    const det = m.a * m.d - m.b * m.c;
    if (!(Math.abs(det) > 1e-12) || !(lw > 0)) return false;
    const ia = m.d / det, ib = -m.b / det, ic = -m.c / det, id = m.a / det, ie = (m.c * m.f - m.d * m.e) / det, iff = (m.b * m.e - m.a * m.f) / det;
    const hw = lw / 2;
    const out = (x, y) => pt(m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f);
    const roundN = (sweep) => segs(hw * sc, sweep);
    for (let s = 0; s < path.n; s++) {
      const sub = path.subs[s], p = sub.p, n = p.length >> 1;
      if (n < 1) continue;
      if (U.length < n * 2 + 2) U = new Float64Array(n * 4 + 4);
      let k = 0;
      for (let i = 0; i < n; i++) {
        const x = ia * p[2 * i] + ic * p[2 * i + 1] + ie, y = ib * p[2 * i] + id * p[2 * i + 1] + iff;
        if (k && Math.abs(U[2 * k - 2] - x) < 1e-9 && Math.abs(U[2 * k - 1] - y) < 1e-9) continue;
        U[2 * k] = x; U[2 * k + 1] = y; k++;
      }
      let closed = sub.closed;
      if (closed && k > 1 && Math.abs(U[0] - U[2 * k - 2]) < 1e-9 && Math.abs(U[1] - U[2 * k - 1]) < 1e-9) k--;
      if (k === 1 && !closed && path.n === 1 && sub.p.length === 2) continue; // (a lone moveTo draws nothing)
      if (k > 1 && ++used > 1) O.smooth = false;
      if (dash && dash.length) dashed(U, k, closed, dash, dashOff, (q, c, cl) => line(q, c, cl, hw, cap, join, miterLimit, out, roundN));
      else line(U, k, closed, hw, cap, join, miterLimit, out, roundN);
    }
    return O.ni > 0;
  };
  // every turn of the polyline under ~25 deg?
  function smoothLine(q, n, closed) {
    for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
      const a = (i - 1 + n) % n, c = (i + 1) % n;
      const d0x = q[2 * i] - q[2 * a], d0y = q[2 * i + 1] - q[2 * a + 1], d1x = q[2 * c] - q[2 * i], d1y = q[2 * c + 1] - q[2 * i + 1];
      const l = Math.hypot(d0x, d0y) * Math.hypot(d1x, d1y);
      if (!(l > 0) || (d0x * d1x + d0y * d1y) / l < 0.9) return false;
    }
    return true;
  }
  // a smooth polyline as one strip: each point pushed out along the mitre of its two pieces (no overlaps at all; at these
  // small turns a round or bevel join looks the same)
  const SL = [], SR = [];
  function strip(q, n, closed, hw, cap, out, roundN) {
    SL.length = SR.length = 0;
    for (let i = 0; i < n; i++) {
      const hasA = closed || i > 0, hasB = closed || i < n - 1;
      const a = (i - 1 + n) % n, c = (i + 1) % n, x = q[2 * i], y = q[2 * i + 1];
      let n0x = 0, n0y = 0, n1x = 0, n1y = 0;
      if (hasA) { const dx = x - q[2 * a], dy = y - q[2 * a + 1], L = Math.hypot(dx, dy); n0x = -dy / L; n0y = dx / L; }
      if (hasB) { const dx = q[2 * c] - x, dy = q[2 * c + 1] - y, L = Math.hypot(dx, dy); n1x = -dy / L; n1y = dx / L; }
      let ox, oy, px = x, py = y;
      if (hasA && hasB) { const mx = n0x + n1x, my = n0y + n1y, ml = Math.hypot(mx, my), k = hw / Math.max(0.5, (mx * n0x + my * n0y) / ml); ox = (mx / ml) * k; oy = (my / ml) * k; }
      else if (hasA) { ox = n0x * hw; oy = n0y * hw; if (cap === 'square') { px += n0y * hw; py -= n0x * hw; } }
      else { ox = n1x * hw; oy = n1y * hw; if (cap === 'square') { px -= n1y * hw; py += n1x * hw; } }
      SL.push(out(px + ox, py + oy)); SR.push(out(px - ox, py - oy));
      if (i > 0) { tri(SL[i - 1], SR[i - 1], SL[i]); tri(SR[i - 1], SR[i], SL[i]); }
    }
    if (closed) { tri(SL[n - 1], SR[n - 1], SL[0]); tri(SR[n - 1], SR[0], SL[0]); }
    else if (cap === 'round') roundCaps(q, n, hw, out, roundN);
  }
  function roundCaps(q, n, hw, out, roundN) {
    const cap1 = (x, y, dx, dy, dir) => { // half a disc from the side +n round the back (dir 1) / the front (dir -1)
      const a0 = Math.atan2(dx, -dy), N = roundN(Math.PI), c = out(x, y);
      let prev = out(x + hw * Math.cos(a0), y + hw * Math.sin(a0));
      for (let k = 1; k <= N; k++) { const t = a0 + (dir * Math.PI * k) / N, v = out(x + hw * Math.cos(t), y + hw * Math.sin(t)); tri(c, prev, v); prev = v; }
    };
    let dx = q[2] - q[0], dy = q[3] - q[1], L = Math.hypot(dx, dy);
    if (L > 0) cap1(q[0], q[1], dx / L, dy / L, 1);
    dx = q[2 * n - 2] - q[2 * n - 4]; dy = q[2 * n - 1] - q[2 * n - 3]; L = Math.hypot(dx, dy);
    if (L > 0) cap1(q[2 * n - 2], q[2 * n - 1], dx / L, dy / L, -1);
  }
  // one polyline (user space): a strip when smooth, else quads + joins + caps
  function line(q, n, closed, hw, cap, join, ml, out, roundN) {
    if (n >= 2 && smoothLine(q, n, closed)) { strip(q, n, closed, hw, cap, out, roundN); return; }
    if (n >= 3 || closed) O.smooth = false;
    if (n < 2) {
      if (n === 1 && !closed && cap !== 'butt') { // (a zero-length piece: a dot / a square)
        const x = q[0], y = q[1];
        if (cap === 'round') { const N = roundN(TAU), c = out(x, y), f = out(x + hw, y); let prev = f; for (let i = 1; i <= N; i++) { const t = (TAU * i) / N, v = i === N ? f : out(x + hw * Math.cos(t), y + hw * Math.sin(t)); tri(c, prev, v); prev = v; } }
        else { const a = out(x - hw, y - hw), b = out(x + hw, y - hw), c = out(x + hw, y + hw), d = out(x - hw, y + hw); tri(a, b, c); tri(a, c, d); }
      }
      return;
    }
    const segN = closed ? n : n - 1;
    for (let i = 0; i < segN; i++) {
      const j = (i + 1) % n;
      let ax = q[2 * i], ay = q[2 * i + 1], bx = q[2 * j], by = q[2 * j + 1];
      const L = Math.hypot(bx - ax, by - ay);
      if (!(L > 0)) continue;
      const dx = (bx - ax) / L, dy = (by - ay) / L, nx = -dy * hw, ny = dx * hw;
      if (!closed && cap === 'square') {
        if (i === 0) { ax -= dx * hw; ay -= dy * hw; }
        if (i === segN - 1) { bx += dx * hw; by += dy * hw; }
      }
      const i0 = out(ax + nx, ay + ny), i1 = out(ax - nx, ay - ny), i2 = out(bx + nx, by + ny), i3 = out(bx - nx, by - ny);
      tri(i0, i1, i2); tri(i1, i3, i2);
    }
    // joins
    const j0 = closed ? 0 : 1, j1 = closed ? n : n - 1;
    for (let i = j0; i < j1; i++) {
      const a = (i - 1 + n) % n, c = (i + 1) % n;
      const px = q[2 * i], py = q[2 * i + 1];
      let d0x = px - q[2 * a], d0y = py - q[2 * a + 1], d1x = q[2 * c] - px, d1y = q[2 * c + 1] - py;
      const l0 = Math.hypot(d0x, d0y), l1 = Math.hypot(d1x, d1y);
      if (!(l0 > 0) || !(l1 > 0)) continue;
      d0x /= l0; d0y /= l0; d1x /= l1; d1y /= l1;
      const cr = d0x * d1y - d0y * d1x, dot = d0x * d1x + d0y * d1y;
      if (Math.abs(cr) < 1e-9 && dot > 0) continue;
      const sg = cr > 0 ? -1 : 1;
      const o0x = -d0y * hw * sg, o0y = d0x * hw * sg, o1x = -d1y * hw * sg, o1y = d1x * hw * sg;
      const pc = out(px, py);
      if (join === 'round') {
        const a0 = Math.atan2(o0y, o0x);
        let da = Math.atan2(o1y, o1x) - a0;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        const N = roundN(Math.abs(da));
        let prev = out(px + o0x, py + o0y);
        for (let k = 1; k <= N; k++) { const t = a0 + (da * k) / N, v = out(px + hw * Math.cos(t), py + hw * Math.sin(t)); tri(pc, prev, v); prev = v; }
      } else {
        const r = 1 / Math.sqrt(Math.max(1e-12, (1 + dot) / 2));
        if (join === 'miter' && r <= ml) {
          let mx = o0x + o1x, my = o0y + o1y;
          const ml2 = Math.hypot(mx, my);
          if (ml2 > 0) { mx = (mx / ml2) * hw * r; my = (my / ml2) * hw * r; }
          const e0 = out(px + o0x, py + o0y), mm = out(px + mx, py + my), e1 = out(px + o1x, py + o1y);
          tri(pc, e0, mm); tri(pc, mm, e1);
        } else tri(pc, out(px + o0x, py + o0y), out(px + o1x, py + o1y));
      }
    }
    if (!closed && cap === 'round') roundCaps(q, n, hw, out, roundN);
  }
  // cut a polyline by the dash pattern (user space); each 'on' piece goes to fn(points, count, false)
  let DQ = new Float64Array(1024);
  function dashed(q, n, closed, dash, off, fn) {
    const pat = dash.length % 2 ? dash.concat(dash) : dash;
    let total = 0;
    for (const v of pat) total += v;
    if (!(total > 0)) { fn(q, n, closed); return; }
    let pos = ((off % total) + total) % total, di = 0;
    while (pos >= pat[di]) { pos -= pat[di]; di = (di + 1) % pat.length; }
    let left = pat[di] - pos, on = di % 2 === 0, k = 0;
    const push = (x, y) => { if (DQ.length < 2 * k + 2) { const t = new Float64Array(DQ.length * 2); t.set(DQ); DQ = t; } DQ[2 * k] = x; DQ[2 * k + 1] = y; k++; };
    if (on) push(q[0], q[1]);
    const segN = closed ? n : n - 1;
    for (let i = 0; i < segN; i++) {
      const j = (i + 1) % n;
      let ax = q[2 * i], ay = q[2 * i + 1];
      const bx = q[2 * j], by = q[2 * j + 1];
      let L = Math.hypot(bx - ax, by - ay);
      const dx = L > 0 ? (bx - ax) / L : 0, dy = L > 0 ? (by - ay) / L : 0;
      while (L > left) {
        ax += dx * left; ay += dy * left; L -= left;
        if (on) { push(ax, ay); if (k > 1) fn(DQ, k, false); k = 0; }
        else push(ax, ay);
        on = !on; di = (di + 1) % pat.length; left = pat[di];
      }
      left -= L;
      if (on) push(bx, by);
    }
    if (on && k > 1) fn(DQ, k, false);
  }
})();
