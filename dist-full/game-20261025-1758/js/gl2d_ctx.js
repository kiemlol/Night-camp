/* gl2d_ctx.js — the 2D context of the WebGL2 game screen (js/gl2d.js): the same properties and calls as
   CanvasRenderingContext2D, drawn into the GL batch. README "จอเกมด้วย WebGL2".
   State, save / restore, transforms, styles (colours, gradients, patterns), paths, fill / stroke / clip, rectangles,
   drawImage (pictures, canvases, the screen itself, offscreen GL canvases), image data. Text is in js/gl2d_text.js.
   - fill: one convex shape (or several when nothing can show through) = its own triangles; anything else = winding into
     the stencil, then a box painted where the winding is not 0 (the same rule as canvas: nonzero / evenodd).
   - stroke: an opaque line = its triangles; a see-through or added ('lighter') one = marked in the stencil first so the
     overlaps at joins are painted once. Lines under 1 px are drawn 1 px wide and fainter, like canvas does.
   - clip: the path becomes the next stencil level (15 deep); restore() takes the levels back.
   - 'copy' clears the target (inside the clip) first; soft-light / overlay / difference / ... read a copy of what is under
     the shape. Gradients made by any 2D context (also an offscreen one) can be used here: their stops are recorded. */
(function () {
  'use strict';
  const NC = window.NC, G = NC.GL2D;
  if (!G || !G.on) return;
  const I = G._, P = G.path;
  const { VIEW, SCREEN, Bt, IB, vtx, state, begin, unitOf, flush, pass, texFor, backdrop, rowOf, useRow, BL, DSTMODE } = I;
  const pack = P.pack, color = P.color;
  const warn = (k, ...a) => { if (!G._warned[k]) { G._warned[k] = 1; console.warn('gl2d:', ...a); } };

  // ---------------- gradients and patterns (ours, and recorded from every 2D context) ----------------
  class Gradient {
    constructor(kind, x0, y0, r0, x1, y1, r1) {
      this.kind = kind; this.x0 = +x0; this.y0 = +y0; this.r0 = +r0 || 0; this.x1 = +x1; this.y1 = +y1; this.r1 = +r1 || 0;
      this.stops = []; this._k = null; this._p = null; this._m = null;
    }
    addColorStop(off, c) {
      off = +off;
      if (!(off >= 0 && off <= 1)) throw new DOMException('The provided value (' + off + ') is outside the range (0.0, 1.0).', 'IndexSizeError');
      const v = color(String(c));
      if (!v) throw new DOMException("The value provided ('" + c + "') could not be parsed as a color.", 'SyntaxError');
      let i = this.stops.length;
      while (i > 0 && this.stops[i - 1].o > off) i--;
      this.stops.splice(i, 0, { o: off, c: v, s: String(c) });
      this._k = null;
    }
    key() {
      if (this._k === null) { let k = ''; for (const s of this.stops) k += s.o + ':' + s.c[0] + ',' + s.c[1] + ',' + s.c[2] + ',' + s.c[3] + ';'; this._k = k; }
      return this._k;
    }
    // 256 colours: straight colour and alpha mixed between the stops (the canvas rule), then premultiplied
    fillRow(px) {
      const S = this.stops, n = S.length;
      let j = 1;
      for (let i = 0; i < 256; i++) {
        const t = i / 255;
        let r = 0, g = 0, b = 0, a = 0;
        if (n === 1 || (n && t <= S[0].o)) [r, g, b, a] = S[0].c;
        else if (n && t >= S[n - 1].o) [r, g, b, a] = S[n - 1].c;
        else if (n) {
          while (j < n - 1 && S[j].o < t) j++;
          const A = S[j - 1], B = S[j], span = B.o - A.o, u = span > 0 ? (t - A.o) / span : 1;
          r = A.c[0] + (B.c[0] - A.c[0]) * u; g = A.c[1] + (B.c[1] - A.c[1]) * u; b = A.c[2] + (B.c[2] - A.c[2]) * u; a = A.c[3] + (B.c[3] - A.c[3]) * u;
        }
        px[i * 4] = Math.round(r * a); px[i * 4 + 1] = Math.round(g * a); px[i * 4 + 2] = Math.round(b * a); px[i * 4 + 3] = Math.round(a * 255);
      }
    }
  }
  class Pattern { constructor(img, rep) { this.img = img; this.rep = rep; this._p = null; } setTransform() { warn('pattf', 'pattern transforms are left out'); } }
  G.Gradient = Gradient;
  // the native ones: remember how they were made, so this screen can paint them too
  const C2 = CanvasRenderingContext2D.prototype, CG = window.CanvasGradient && CanvasGradient.prototype;
  for (const [m, kind] of [['createLinearGradient', 'linear'], ['createRadialGradient', 'radial'], ['createConicGradient', 'conic']]) {
    const f = C2[m];
    if (!f) continue;
    C2[m] = function () {
      const g = f.apply(this, arguments), a = arguments;
      g.__nc = kind === 'linear' ? new Gradient('linear', a[0], a[1], 0, a[2], a[3], 0) : kind === 'radial' ? new Gradient('radial', a[0], a[1], a[2], a[3], a[4], a[5]) : new Gradient('conic', a[1], a[2], 0, a[1], a[2], 0);
      return g;
    };
  }
  if (CG) { const f = CG.addColorStop; CG.addColorStop = function (o, c) { const r = f.apply(this, arguments); if (this.__nc) try { this.__nc.addColorStop(o, c); } catch (e) { /* (the native one threw already) */ } return r; }; }
  { const f = C2.createPattern; C2.createPattern = function (img, rep) { const p = f.apply(this, arguments); if (p) p.__nc = new Pattern(img, rep); return p; }; }

  // a style value -> its paint: { k: 0, c } colour, { k: 1, g } gradient, { k: 2, p } pattern
  let lastStr = null, lastPaint = null;
  function paintOf(v) {
    if (typeof v === 'string') {
      if (v === lastStr) return lastPaint;
      const c = color(v);
      if (!c) return null;
      lastStr = v; lastPaint = c.__p || (c.__p = { k: 0, c });
      return lastPaint;
    }
    if (v instanceof Gradient) return v._p || (v._p = { k: 1, g: v });
    if (v instanceof Pattern) return v._p || (v._p = { k: 2, p: v });
    if (v && v.__nc) return paintOf(v.__nc);
    if (v && typeof v === 'object') warn('style', 'a fill / stroke style it cannot read', v);
    return null;
  }
  const hex2 = (n) => (n < 16 ? '0' : '') + n.toString(16);
  function colorStr(c) { return c[3] >= 1 ? '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]) : 'rgba(' + c[0] + ', ' + c[1] + ', ' + c[2] + ', ' + +c[3].toFixed(4).replace(/0+$/, '') + ')'; }

  // ---------------- state ----------------
  const BLACK = paintOf('#000000'), NODASH = [];
  const OPS = new Set([...Object.keys(BL).filter((k) => k !== 'clear'), ...Object.keys(DSTMODE), 'hue', 'saturation', 'color', 'luminosity']);
  const CAPS = new Set(['butt', 'round', 'square']), JOINS = new Set(['miter', 'round', 'bevel']);
  const ALIGNS = new Set(['start', 'end', 'left', 'right', 'center']), BASES = new Set(['top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom']);
  // the drawing state: one class with every field, copied field by field on save (Object.assign of ~40 keys was 3.5% of a frame)
  class St {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; this.alpha = 1; this.op = 'source-over';
      this.fs = BLACK; this.fsv = '#000000'; this.ss = BLACK; this.ssv = '#000000'; this.lw = 1; this.cap = 'butt'; this.join = 'miter';
      this.ml = 10; this.dash = NODASH; this.doff = 0; this.font = '10px sans-serif'; this.align = 'start'; this.base = 'alphabetic';
      this.dir = 'inherit'; this.filter = 'none'; this.cm = null; this.smooth = true; this.smoothQ = 'low'; this.depth = 0; this.sb = 0;
      this.sc = 'rgba(0, 0, 0, 0)'; this.sx = 0; this.sy = 0; this.ls = '0px'; this.ws = '0px'; this.fk = 'auto'; this.fst = 'normal';
      this.fvc = 'normal'; this.tr = 'auto';
    }
    copy(o) {
      this.a = o.a;
      this.b = o.b;
      this.c = o.c;
      this.d = o.d;
      this.e = o.e;
      this.f = o.f;
      this.alpha = o.alpha;
      this.op = o.op;
      this.fs = o.fs;
      this.fsv = o.fsv;
      this.ss = o.ss;
      this.ssv = o.ssv;
      this.lw = o.lw;
      this.cap = o.cap;
      this.join = o.join;
      this.ml = o.ml;
      this.dash = o.dash;
      this.doff = o.doff;
      this.font = o.font;
      this.align = o.align;
      this.base = o.base;
      this.dir = o.dir;
      this.filter = o.filter;
      this.cm = o.cm;
      this.smooth = o.smooth;
      this.smoothQ = o.smoothQ;
      this.depth = o.depth;
      this.sb = o.sb;
      this.sc = o.sc;
      this.sx = o.sx;
      this.sy = o.sy;
      this.ls = o.ls;
      this.ws = o.ws;
      this.fk = o.fk;
      this.fst = o.fst;
      this.fvc = o.fvc;
      this.tr = o.tr;
      return this;
    }
  }
  const S0 = () => new St();
  const fin = (v) => typeof v === 'number' ? isFinite(v) : isFinite(+v);
  const OPMAP = { hue: 'source-over', saturation: 'source-over', color: 'source-over', luminosity: 'source-over' };

  class Ctx {
    constructor(canvas, target) { this.canvas = canvas; this._T = target; this._s = S0(); this._st = []; this._pool = []; this._path = new P.Path(); this._tmp = new P.Path(); }
    _reset() { this._s = S0(); this._st.length = 0; this._path.reset(); this._T.onceK = 0; this._T.lowDirty = false; }
    // ---- state ----
    save() { this._st.push((this._pool.pop() || new St()).copy(this._s)); }
    restore() {
      if (!this._st.length) return;
      const s = this._st.pop(), cur = this._s;
      if (s.depth < cur.depth) this._clipOut(s.depth);
      this._s = s; this._pool.push(cur);
    }
    reset() { flush(); this._clearAll(true); this._reset(); }
    isContextLost() { return G.lost; }
    getContextAttributes() { return { alpha: true, colorSpace: 'srgb', desynchronized: false, willReadFrequently: false }; }
    // ---- transform ----
    setTransform(a, b, c, d, e, f) {
      if (arguments.length === 0) { a = 1; b = 0; c = 0; d = 1; e = 0; f = 0; }
      else if (arguments.length === 1) { const m = a || {}; a = m.a ?? m.m11 ?? 1; b = m.b ?? m.m12 ?? 0; c = m.c ?? m.m21 ?? 0; d = m.d ?? m.m22 ?? 1; e = m.e ?? m.m41 ?? 0; f = m.f ?? m.m42 ?? 0; }
      if (!(isFinite(a) && isFinite(b) && isFinite(c) && isFinite(d) && isFinite(e) && isFinite(f))) return;
      const s = this._s; s.a = +a; s.b = +b; s.c = +c; s.d = +d; s.e = +e; s.f = +f;
    }
    resetTransform() { const s = this._s; s.a = 1; s.b = 0; s.c = 0; s.d = 1; s.e = 0; s.f = 0; }
    getTransform() { const s = this._s; return new DOMMatrix([s.a, s.b, s.c, s.d, s.e, s.f]); }
    transform(a, b, c, d, e, f) {
      if (!(isFinite(a) && isFinite(b) && isFinite(c) && isFinite(d) && isFinite(e) && isFinite(f))) return;
      const s = this._s, A = s.a, B = s.b, C = s.c, D = s.d;
      s.a = A * a + C * b; s.b = B * a + D * b; s.c = A * c + C * d; s.d = B * c + D * d; s.e += A * e + C * f; s.f += B * e + D * f;
    }
    translate(x, y) { if (!(isFinite(x) && isFinite(y))) return; const s = this._s; s.e += s.a * x + s.c * y; s.f += s.b * x + s.d * y; }
    scale(x, y) { if (!(isFinite(x) && isFinite(y))) return; const s = this._s; s.a *= x; s.b *= x; s.c *= y; s.d *= y; }
    rotate(t) {
      if (!isFinite(t)) return;
      const s = this._s, co = Math.cos(t), si = Math.sin(t), A = s.a, B = s.b, C = s.c, D = s.d;
      s.a = A * co + C * si; s.b = B * co + D * si; s.c = C * co - A * si; s.d = D * co - B * si;
    }
    _sc() { const s = this._s; return Math.max(Math.hypot(s.a, s.b), Math.hypot(s.c, s.d)); }
    // ---- styles ----
    get fillStyle() { const v = this._s.fsv; return typeof v === 'string' ? colorStr(this._s.fs.c) : v; }
    set fillStyle(v) { const p = paintOf(v); if (p) { this._s.fs = p; this._s.fsv = v; } }
    get strokeStyle() { const v = this._s.ssv; return typeof v === 'string' ? colorStr(this._s.ss.c) : v; }
    set strokeStyle(v) { const p = paintOf(v); if (p) { this._s.ss = p; this._s.ssv = v; } }
    get globalAlpha() { return this._s.alpha; }
    set globalAlpha(v) { v = +v; if (v >= 0 && v <= 1) this._s.alpha = v; }
    get globalCompositeOperation() { return this._s.op; }
    set globalCompositeOperation(v) { if (OPS.has(v)) { this._s.op = v; if (OPMAP[v]) warn('op:' + v, v, 'is drawn as source-over'); } }
    get lineWidth() { return this._s.lw; }
    set lineWidth(v) { v = +v; if (v > 0 && isFinite(v)) this._s.lw = v; }
    get lineCap() { return this._s.cap; }
    set lineCap(v) { if (CAPS.has(v)) this._s.cap = v; }
    get lineJoin() { return this._s.join; }
    set lineJoin(v) { if (JOINS.has(v)) this._s.join = v; }
    get miterLimit() { return this._s.ml; }
    set miterLimit(v) { v = +v; if (v > 0 && isFinite(v)) this._s.ml = v; }
    get lineDashOffset() { return this._s.doff; }
    set lineDashOffset(v) { v = +v; if (isFinite(v)) this._s.doff = v; }
    setLineDash(a) {
      if (!a || typeof a.length !== 'number') return;
      const v = Array.from(a, Number);
      if (v.some((x) => !(x >= 0) || !isFinite(x))) return;
      this._s.dash = v.length % 2 ? v.concat(v) : v;
    }
    getLineDash() { return this._s.dash.slice(); }
    get font() { return this._s.font; }
    set font(v) { if (typeof v === 'string' && v) this._s.font = v; }
    get textAlign() { return this._s.align; }
    set textAlign(v) { if (ALIGNS.has(v)) this._s.align = v; }
    get textBaseline() { return this._s.base; }
    set textBaseline(v) { if (BASES.has(v)) this._s.base = v; }
    get direction() { return this._s.dir; }
    set direction(v) { if (v === 'ltr' || v === 'rtl' || v === 'inherit') this._s.dir = v; }
    get letterSpacing() { return this._s.ls; }
    set letterSpacing(v) { this._s.ls = String(v); }
    get wordSpacing() { return this._s.ws; }
    set wordSpacing(v) { this._s.ws = String(v); }
    get fontKerning() { return this._s.fk; }
    set fontKerning(v) { this._s.fk = v; }
    get fontStretch() { return this._s.fst; }
    set fontStretch(v) { this._s.fst = v; }
    get fontVariantCaps() { return this._s.fvc; }
    set fontVariantCaps(v) { this._s.fvc = v; }
    get textRendering() { return this._s.tr; }
    set textRendering(v) { this._s.tr = v; }
    get filter() { return this._s.filter; }
    set filter(v) { if (typeof v !== 'string') return; this._s.filter = v; this._s.cm = P.filter(v); }
    get imageSmoothingEnabled() { return this._s.smooth; }
    set imageSmoothingEnabled(v) { this._s.smooth = !!v; }
    get imageSmoothingQuality() { return this._s.smoothQ; }
    set imageSmoothingQuality(v) { if (v === 'low' || v === 'medium' || v === 'high') this._s.smoothQ = v; }
    get shadowBlur() { return this._s.sb; }
    set shadowBlur(v) { v = +v; if (v >= 0 && isFinite(v)) { this._s.sb = v; if (v > 0) warn('shadow', 'shadows are left out'); } }
    get shadowColor() { return this._s.sc; }
    set shadowColor(v) { this._s.sc = String(v); }
    get shadowOffsetX() { return this._s.sx; }
    set shadowOffsetX(v) { if (fin(v)) this._s.sx = +v; }
    get shadowOffsetY() { return this._s.sy; }
    set shadowOffsetY(v) { if (fin(v)) this._s.sy = +v; }
    createLinearGradient(x0, y0, x1, y1) { return new Gradient('linear', x0, y0, 0, x1, y1, 0); }
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      if (r0 < 0 || r1 < 0) throw new DOMException('The radius provided is negative.', 'IndexSizeError');
      return new Gradient('radial', x0, y0, r0, x1, y1, r1);
    }
    createConicGradient(a, x, y) { warn('conic', 'conic gradients are drawn as their first colour'); return new Gradient('conic', x, y, 0, x, y, 0); }
    createPattern(img, rep) { return img ? new Pattern(img, rep || 'repeat') : null; }

    // ---- paths ----
    beginPath() { this._path.reset(); }
    closePath() { this._path.close(); }
    moveTo(x, y) { if (!(isFinite(x) && isFinite(y))) return; const s = this._s; this._path.moveTo(s.a * x + s.c * y + s.e, s.b * x + s.d * y + s.f); }
    lineTo(x, y) { if (!(isFinite(x) && isFinite(y))) return; const s = this._s; this._path.lineTo(s.a * x + s.c * y + s.e, s.b * x + s.d * y + s.f); }
    rect(x, y, w, h) {
      if (!(isFinite(x) && isFinite(y) && isFinite(w) && isFinite(h))) return;
      this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h);
      this._path.convexSub(); this._path.close();
    }
    arc(x, y, r, a0, a1, ccw) {
      if (!(isFinite(x) && isFinite(y) && isFinite(r) && isFinite(a0) && isFinite(a1))) return;
      if (r < 0) throw new DOMException('The radius provided (' + r + ') is negative.', 'IndexSizeError');
      this._path.arc(+x, +y, +r, +a0, +a1, !!ccw, this._s, this._sc());
    }
    ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
      if (!(isFinite(x) && isFinite(y) && isFinite(rx) && isFinite(ry) && isFinite(rot) && isFinite(a0) && isFinite(a1))) return;
      if (rx < 0 || ry < 0) throw new DOMException('The radius provided is negative.', 'IndexSizeError');
      this._path.ellipse(+x, +y, +rx, +ry, +rot, +a0, +a1, !!ccw, this._s, this._sc());
    }
    quadraticCurveTo(cx, cy, x, y) {
      if (!(isFinite(cx) && isFinite(cy) && isFinite(x) && isFinite(y))) return;
      const s = this._s;
      this._path.quad(s.a * cx + s.c * cy + s.e, s.b * cx + s.d * cy + s.f, s.a * x + s.c * y + s.e, s.b * x + s.d * y + s.f);
    }
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      if (!(isFinite(c1x) && isFinite(c1y) && isFinite(c2x) && isFinite(c2y) && isFinite(x) && isFinite(y))) return;
      const s = this._s;
      this._path.cubic(s.a * c1x + s.c * c1y + s.e, s.b * c1x + s.d * c1y + s.f, s.a * c2x + s.c * c2y + s.e, s.b * c2x + s.d * c2y + s.f, s.a * x + s.c * y + s.e, s.b * x + s.d * y + s.f);
    }
    arcTo(x1, y1, x2, y2, r) {
      if (!(isFinite(x1) && isFinite(y1) && isFinite(x2) && isFinite(y2) && isFinite(r))) return;
      if (r < 0) throw new DOMException('The radius provided (' + r + ') is negative.', 'IndexSizeError');
      const s = this._s, L = this._path.last();
      if (!L) { this.moveTo(x1, y1); return; }
      const det = s.a * s.d - s.b * s.c;
      if (!det) return;
      // the current point back in user space
      const X = L[0] - s.e, Y = L[1] - s.f, x0 = (s.d * X - s.c * Y) / det, y0 = (-s.b * X + s.a * Y) / det;
      const ax = x0 - x1, ay = y0 - y1, bx = x2 - x1, by = y2 - y1;
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by), cr = ax * by - ay * bx;
      if (!la || !lb || !r || Math.abs(cr) < 1e-9) { this.lineTo(x1, y1); return; }
      const cos = (ax * bx + ay * by) / (la * lb), half = Math.acos(Math.max(-1, Math.min(1, cos))) / 2;
      const dist = r / Math.tan(half);
      const t0x = x1 + (ax / la) * dist, t0y = y1 + (ay / la) * dist, t1x = x1 + (bx / lb) * dist, t1y = y1 + (by / lb) * dist;
      const bisx = ax / la + bx / lb, bisy = ay / la + by / lb, bl = Math.hypot(bisx, bisy), cd = r / Math.sin(half);
      const cx = x1 + (bisx / bl) * cd, cy = y1 + (bisy / bl) * cd;
      const a0 = Math.atan2(t0y - cy, t0x - cx), a1 = Math.atan2(t1y - cy, t1x - cx);
      this.lineTo(t0x, t0y);
      this._path.arc(cx, cy, r, a0, a1, cr > 0, s, this._sc());
    }
    roundRect(x, y, w, h, radii) {
      if (!(isFinite(x) && isFinite(y) && isFinite(w) && isFinite(h))) return;
      let R = radii === undefined ? [0] : Array.isArray(radii) ? radii : [radii];
      if (R.length < 1 || R.length > 4) throw new RangeError('roundRect: 1 to 4 radii');
      R = R.map((v) => (typeof v === 'object' && v ? { x: +v.x || 0, y: +v.y || 0 } : { x: +v || 0, y: +v || 0 }));
      if (R.some((v) => v.x < 0 || v.y < 0)) throw new RangeError('roundRect: a radius is negative');
      const [tl, tr, br, bl] = R.length === 1 ? [R[0], R[0], R[0], R[0]] : R.length === 2 ? [R[0], R[1], R[0], R[1]] : R.length === 3 ? [R[0], R[1], R[2], R[1]] : R;
      if (w < 0) { x += w; w = -w; }
      if (h < 0) { y += h; h = -h; }
      const k = Math.min(1, w / (tl.x + tr.x || 1e-9), w / (bl.x + br.x || 1e-9), h / (tl.y + bl.y || 1e-9), h / (tr.y + br.y || 1e-9));
      const c = [tl, tr, br, bl].map((v) => ({ x: v.x * k, y: v.y * k }));
      const s = this._s, sc = this._sc(), Pp = this._path, H = Math.PI / 2;
      this.moveTo(x + c[0].x, y);
      this.lineTo(x + w - c[1].x, y);
      if (c[1].x && c[1].y) Pp.ellipse(x + w - c[1].x, y + c[1].y, c[1].x, c[1].y, 0, -H, 0, false, s, sc);
      this.lineTo(x + w, y + h - c[2].y);
      if (c[2].x && c[2].y) Pp.ellipse(x + w - c[2].x, y + h - c[2].y, c[2].x, c[2].y, 0, 0, H, false, s, sc);
      this.lineTo(x + c[3].x, y + h);
      if (c[3].x && c[3].y) Pp.ellipse(x + c[3].x, y + h - c[3].y, c[3].x, c[3].y, 0, H, Math.PI, false, s, sc);
      this.lineTo(x, y + c[0].y);
      if (c[0].x && c[0].y) Pp.ellipse(x + c[0].x, y + c[0].y, c[0].x, c[0].y, 0, Math.PI, Math.PI + H, false, s, sc);
      Pp.convexSub(); Pp.close();
      this.moveTo(x, y);
    }

    // ---- painting ----
    _use(op) { const s = this._s; state(this._T, OPMAP[op] || op, s.depth, s.cm); }
    // points (screen px) + triangles, painted with `paint` at globalAlpha x am; mk / muv: a text mask (its entry, uv per point)
    _emit(paint, am, Pp, np, Ii, ni, plain, mk, muv) {
      const s = this._s, A = s.alpha * am;
      if (!(A > 0) || !np || !ni) return;
      let col = 0, type = 0, row = 0, E = null, g = null;
      if (paint.k === 0) {
        const c = paint.c;
        col = pack(c[0], c[1], c[2], c[3] * A);
        if (!col && (s.op === 'source-over' || s.op === 'lighter' || s.op === 'destination-over')) return;
      } else if (paint.k === 1) {
        g = paint.g;
        if (g.kind === 'conic' || !g.stops.length) { if (!g.stops.length) return; const c = g.stops[0].c; col = pack(c[0], c[1], c[2], c[3] * A); }
        else if (g.kind === 'linear') { if (g.x0 === g.x1 && g.y0 === g.y1) return; type = 2; row = rowOf(g, false); }
        else if (g.x0 === g.x1 && g.y0 === g.y1) { if (g.r0 === g.r1) return; type = 3; row = rowOf(g, false); }
        else { type = 5; row = rowOf(g, true); }
        if (type) col = pack(255, 255, 255, A);
      } else if (mk) { warn('textpat', 'text in a pattern is drawn black'); col = pack(0, 0, 0, A); }
      else {
        E = texFor(paint.p.img, this._T !== SCREEN);
        if (!E) return;
        type = 4; col = pack(255, 255, 255, A);
      }
      if (mk) { E = mk; type |= 16; }
      if (!plain) this._prep(Pp, np);
      this._use(s.op);
      if (!begin(np, ni, E)) { warn('big', 'a shape too big for one batch was left out', np); return; }
      const u = E ? unitOf(E) : 0;
      const pt = type & 15;
      if (pt === 2 || pt === 3 || pt === 5) useRow(row);
      const misc = (u | (type << 8) | (row << 16)) >>> 0;
      const base = Bt.vn;
      if (pt === 0) for (let i = 0; i < np; i++) vtx(Pp[2 * i], Pp[2 * i + 1], mk ? muv[2 * i] : 0, mk ? muv[2 * i + 1] : 0, col, misc, 0, 0, 0, 0);
      else {
        const det = s.a * s.d - s.b * s.c;
        if (!det) { Bt.vn = base; return; }
        const ia = s.d / det, ib = -s.b / det, ic = -s.c / det, id = s.a / det, ie = (s.c * s.f - s.d * s.e) / det, iff = (s.b * s.e - s.a * s.f) / det;
        let k1 = 0, k2 = 0, k3 = 0, k4 = 0;
        if (pt === 2) { const dx = g.x1 - g.x0, dy = g.y1 - g.y0, L = dx * dx + dy * dy; k1 = dx / L; k2 = dy / L; }
        else if (pt === 3) { const span = g.r1 - g.r0; k1 = 1 / Math.abs(span); k3 = g.r0 * k1; k4 = span > 0 ? 1 : -1; }
        else if (pt === 4) { k1 = 1 / E.sw; k2 = 1 / E.sh; }
        for (let i = 0; i < np; i++) {
          const X = Pp[2 * i], Y = Pp[2 * i + 1], x = ia * X + ic * Y + ie, y = ib * X + id * Y + iff;
          const u = mk ? muv[2 * i] : 0, v = mk ? muv[2 * i + 1] : 0;
          if (pt === 2) vtx(X, Y, u, v, col, misc, (x - g.x0) * k1 + (y - g.y0) * k2, 0, 0, 0);
          else if (pt === 3) vtx(X, Y, u, v, col, misc, (x - g.x0) * k1, (y - g.y0) * k1, k3, k4);
          else if (pt === 5) vtx(X, Y, u, v, col, misc, x, y, 0, 0);
          else vtx(X, Y, x * k1, y * k2, col, misc, 0, 0, 0, 0);
        }
      }
      for (let j = 0; j < ni; j++) IB[Bt.in++] = base + Ii[j];
    }
    // before a draw with a mode that needs it: 'copy' clears the target first, the reading modes copy what is under it
    _prep(Pp, np) {
      const op = this._s.op;
      if (op === 'copy') this._clearAll(false);
      else if (DSTMODE[op]) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i < np; i++) { const x = Pp[2 * i], y = Pp[2 * i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const T = this._T, H = T.fb ? T.h : VIEW.height;
        if (T.fb) backdrop(T, x0 - 1, y0 - 1, x1 + 1, y1 + 1);
        else backdrop(T, x0 - 1, H - y1 - 1, x1 + 1, H - y0 + 1);
      }
    }
    // everything (inside the clip) to transparent; raw = ignore the clip too
    _clearAll(raw) {
      const T = this._T, W = T.fb ? T.w : VIEW.width, H = T.fb ? T.h : VIEW.height, s = this._s;
      state(T, 'clear', raw ? 0 : s.depth, null);
      if (raw) { flush(); I.ours(); const gl = I.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); gl.clearColor(0, 0, 0, 0); gl.clearStencil(0); gl.stencilMask(0xff); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT); gl.stencilMask(0); I.forget(); return; }
      begin(4, 6);
      const b = vtx(0, 0, 0, 0, 0, 0, 0, 0, 0, 0); vtx(W, 0, 0, 0, 0, 0, 0, 0, 0, 0); vtx(0, H, 0, 0, 0, 0, 0, 0, 0, 0); vtx(W, H, 0, 0, 0, 0, 0, 0, 0, 0);
      IB[Bt.in++] = b; IB[Bt.in++] = b + 1; IB[Bt.in++] = b + 2; IB[Bt.in++] = b + 1; IB[Bt.in++] = b + 3; IB[Bt.in++] = b + 2;
    }
    // raw triangles for the stencil passes (no colour)
    _raw(Pp, np, Ii, ni, depth) {
      state(this._T, 'source-over', depth, null);
      if (!begin(np, ni)) return;
      const base = Bt.vn;
      for (let i = 0; i < np; i++) vtx(Pp[2 * i], Pp[2 * i + 1], 0, 0, 0, 0, 0, 0, 0, 0);
      for (let j = 0; j < ni; j++) IB[Bt.in++] = base + Ii[j];
    }
    _box(x0, y0, x1, y1) { BOX[0] = x0; BOX[1] = y0; BOX[2] = x1; BOX[3] = y0; BOX[4] = x0; BOX[5] = y1; BOX[6] = x1; BOX[7] = y1; return BOX; }
    // a shape whose own pieces overlap, painted in one pass: the stencil lets each pixel be painted once (no clip only; the
    // low stencil bits count up 1..15 shape by shape, then are cleared)
    _onceDraw(paint, am, O) {
      const T = this._T;
      if ((T.onceK | 0) >= 15) this._lowClear();
      T.onceK = (T.onceK | 0) + 1; T.lowDirty = true;
      I.setOnce(T.onceK);
      pass('once', () => this._emit(paint, am, O.P, O.np, O.I, O.ni, true));
    }
    _lowClear() {
      const T = this._T, bx = this._box(0, 0, T.fb ? T.w : VIEW.width, T.fb ? T.h : VIEW.height);
      pass('lowClear', () => this._raw(bx, 4, QUAD, 6, 0));
      T.onceK = 0; T.lowDirty = false;
    }
    // a path the fan could not draw straight: winding into the stencil, then the box painted where it is not 0
    _cover(paint, am, O, rule, mark) {
      const d = this._s.depth;
      if (this._T.lowDirty) this._lowClear();
      if (this._s.op === 'copy') this._clearAll(false);
      pass(mark ? 'mark' : rule === 'evenodd' ? 'windEO' : 'wind', () => this._raw(O.P, O.np, O.I, O.ni, d));
      const b = this._box(Math.floor(O.x0) - 1, Math.floor(O.y0) - 1, Math.ceil(O.x1) + 1, Math.ceil(O.y1) + 1);
      if (DSTMODE[this._s.op]) this._prep(b, 4);
      pass('cover', () => this._emit(paint, am, b, 4, QUAD, 6, true));
    }
    fill(a, b) {
      const rule = typeof a === 'string' ? a : b;
      if (a && typeof a === 'object') warn('path2d', 'Path2D is not drawn');
      const fan = P.fan(this._path);
      if (!fan.subs) return;
      const O = P.out, s = this._s, paint = s.fs;
      const solid = paint.k === 0 && paint.c[3] * s.alpha >= 1 && s.op === 'source-over';
      if (fan.convex && (fan.subs === 1 || solid || fan.apart)) this._emit(paint, 1, O.P, O.np, O.I, O.ni);
      else if (fan.convex && rule !== 'evenodd' && !s.depth && !DSTMODE[s.op] && s.op !== 'copy') this._onceDraw(paint, 1, O);
      else this._cover(paint, 1, O, rule === 'evenodd' ? 'evenodd' : 'nonzero', false);
    }
    stroke(a) {
      if (a && typeof a === 'object') warn('path2d', 'Path2D is not drawn');
      this._strokePath(this._path);
    }
    _strokePath(path) {
      const s = this._s, det = Math.abs(s.a * s.d - s.b * s.c);
      if (!(det > 0)) return;
      const ds = Math.sqrt(det);
      let lw = s.lw, am = 1;
      if (lw * ds < 1) { am = lw * ds; lw = 1 / ds; }
      if (!P.stroke(path, s, lw, s.cap, s.join, s.ml, s.dash, s.doff, this._sc())) return;
      const O = P.out, paint = s.ss;
      const solid = paint.k === 0 && paint.c[3] * s.alpha * am >= 1 && s.op === 'source-over';
      // (thin lines, up to 3 px on screen: their overlaps are a few pixels where pieces meet - drawn straight too)
      if (solid || ((O.smooth || lw * ds <= 3) && !DSTMODE[s.op])) this._emit(paint, am, O.P, O.np, O.I, O.ni);
      else if (!s.depth && !DSTMODE[s.op] && s.op !== 'copy') this._onceDraw(paint, am, O);
      else this._cover(paint, am, O, 'nonzero', true);
    }
    clip(a, b) {
      const rule = typeof a === 'string' ? a : b, s = this._s, d = s.depth;
      if (d >= 15) { warn('clip15', 'more than 15 clips inside each other'); return; }
      const fan = P.fan(this._path), O = P.out;
      if (fan.subs) {
        if (this._T.lowDirty) this._lowClear();
        pass(rule === 'evenodd' ? 'windEO' : 'wind', () => this._raw(O.P, O.np, O.I, O.ni, d));
        const bx = this._box(Math.floor(O.x0) - 1, Math.floor(O.y0) - 1, Math.ceil(O.x1) + 1, Math.ceil(O.y1) + 1);
        pass('clipIn', () => this._raw(bx, 4, QUAD, 6, d));
      }
      s.depth = d + 1;
    }
    _clipOut(d) {
      const T = this._T, W = T.fb ? T.w : VIEW.width, H = T.fb ? T.h : VIEW.height;
      const bx = this._box(0, 0, W, H);
      pass('clipOut', () => this._raw(bx, 4, QUAD, 6, d));
    }
    isPointInPath(a, b, c) { // (x, y in canvas pixels, not moved by the transform)
      let x = a, y = b, rule = c;
      if (a && typeof a === 'object') return false;
      let wn = 0, odd = false;
      const Pp = this._path;
      for (let s = 0; s < Pp.n; s++) {
        const p = Pp.subs[s].p, n = p.length >> 1;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n, x0 = p[2 * i], y0 = p[2 * i + 1], x1 = p[2 * j], y1 = p[2 * j + 1];
          if (y0 <= y !== y1 <= y) { const xi = x0 + ((y - y0) * (x1 - x0)) / (y1 - y0); if (xi > x) { odd = !odd; wn += y1 > y0 ? 1 : -1; } }
        }
      }
      return rule === 'evenodd' ? odd : wn !== 0;
    }
    isPointInStroke() { return false; }
    drawFocusIfNeeded() {}
    scrollPathIntoView() {}

    // ---- rectangles ----
    fillRect(x, y, w, h) {
      if (!(isFinite(x) && isFinite(y) && isFinite(w) && isFinite(h)) || !w || !h) return;
      const s = this._s, R = this._rect(x, y, w, h);
      if (this._whole(R)) this._emit(s.fs, 1, this._tri(R), 3, TRI, 3);
      else this._emit(s.fs, 1, R, 4, QUAD, 6);
    }
    // a rect over the whole target (the screen's clear, the ground under everything) is drawn as one triangle twice its
    // size, not the two of a quad: the quad's inner edge ran corner to corner across the screen, and a player's GPU left
    // a dotted crack along it, the clear colour showing through the ground as a thin dark line from the bottom left to the
    // top right (Discord #155). The triangle's part past the rect is off the target; a picture's uv runs on with it.
    _whole(R) {
      const T = this._T, W = T.fb ? T.w : VIEW.width, H = T.fb ? T.h : VIEW.height, e = 1e-3, op = this._s.op;
      return !DSTMODE[op] && op !== 'copy' && Math.abs(R[1] - R[3]) < e && Math.abs(R[0] - R[4]) < e && Math.abs(R[2] - R[6]) < e &&
        Math.abs(R[5] - R[7]) < e && R[0] <= e && R[1] <= e && R[6] >= W - e && R[7] >= H - e;
    }
    _tri(R) { TRI_P[0] = R[0]; TRI_P[1] = R[1]; TRI_P[2] = 2 * R[2] - R[0]; TRI_P[3] = R[3]; TRI_P[4] = R[4]; TRI_P[5] = 2 * R[5] - R[1]; return TRI_P; }
    clearRect(x, y, w, h) {
      if (!(isFinite(x) && isFinite(y) && isFinite(w) && isFinite(h)) || !w || !h) return;
      const s = this._s, R = this._rect(x, y, w, h);
      state(this._T, 'clear', s.depth, null);
      begin(4, 6);
      const b = Bt.vn;
      for (let i = 0; i < 4; i++) vtx(R[2 * i], R[2 * i + 1], 0, 0, 0, 0, 0, 0, 0, 0);
      for (let j = 0; j < 6; j++) IB[Bt.in++] = b + QUAD[j];
    }
    strokeRect(x, y, w, h) {
      if (!(isFinite(x) && isFinite(y) && isFinite(w) && isFinite(h))) return;
      const s = this._s, T = this._tmp, m = (X, Y) => [s.a * X + s.c * Y + s.e, s.b * X + s.d * Y + s.f];
      T.reset();
      T.moveTo(...m(x, y)); T.lineTo(...m(x + w, y)); T.lineTo(...m(x + w, y + h)); T.lineTo(...m(x, y + h)); T.close();
      this._strokePath(T);
    }
    _rect(x, y, w, h) {
      const s = this._s, R = RECT, x1 = x + w, y1 = y + h;
      R[0] = s.a * x + s.c * y + s.e; R[1] = s.b * x + s.d * y + s.f;
      R[2] = s.a * x1 + s.c * y + s.e; R[3] = s.b * x1 + s.d * y + s.f;
      R[4] = s.a * x + s.c * y1 + s.e; R[5] = s.b * x + s.d * y1 + s.f;
      R[6] = s.a * x1 + s.c * y1 + s.e; R[7] = s.b * x1 + s.d * y1 + s.f;
      return R;
    }

    // ---- pictures ----
    drawImage(src, a1, a2, a3, a4, a5, a6, a7, a8) {
      const n = arguments.length, s = this._s;
      let E;
      if (src === this.canvas || src === VIEW) {
        const T = src === VIEW ? SCREEN : this._T;
        E = backdrop(T);
        if (this._T !== T) flush(); // (the copy is made; draw into our own target next)
      } else if (src && src.__gl2d && src.__gl2d._T === this._T) E = backdrop(this._T);
      else {
        E = texFor(src, this._T !== SCREEN);
        if (!E) { if (src instanceof HTMLCanvasElement && (!src.width || !src.height)) throw new DOMException("Failed to execute 'drawImage': The image argument is a canvas element with a width or height of 0.", 'InvalidStateError'); return; }
      }
      const W = E.sw, H = E.sh;
      let sx = 0, sy = 0, sw = W, sh = H, dx, dy, dw = W, dh = H;
      if (n <= 3) { dx = a1; dy = a2; }
      else if (n <= 5) { dx = a1; dy = a2; dw = a3; dh = a4; }
      else { sx = a1; sy = a2; sw = a3; sh = a4; dx = a5; dy = a6; dw = a7; dh = a8; }
      if (!(isFinite(sx) && isFinite(sy) && isFinite(sw) && isFinite(sh) && isFinite(dx) && isFinite(dy) && isFinite(dw) && isFinite(dh))) return;
      if (sw < 0) { sx += sw; sw = -sw; }
      if (sh < 0) { sy += sh; sh = -sh; }
      if (dw < 0) { dx += dw; dw = -dw; }
      if (dh < 0) { dy += dh; dh = -dh; }
      // the part of the source rectangle outside the picture is left out (and the same share of the destination)
      if (sx < 0) { const k = -sx / sw; dx += dw * k; dw -= dw * k; sw += sx; sx = 0; }
      if (sy < 0) { const k = -sy / sh; dy += dh * k; dh -= dh * k; sh += sy; sy = 0; }
      if (sx + sw > W) { const k = (sx + sw - W) / sw; dw -= dw * k; sw = W - sx; }
      if (sy + sh > H) { const k = (sy + sh - H) / sh; dh -= dh * k; sh = H - sy; }
      if (!(sw > 0 && sh > 0 && dw > 0 && dh > 0)) return;
      const A = s.alpha;
      if (!(A > 0)) return;
      const R = this._rect(dx, dy, dw, dh);
      this._prep(R, 4);
      this._use(s.op);
      begin(4, 6, E);
      const unit = unitOf(E);
      const uw = E.flip ? E.tw : W, vh = E.flip ? E.th : H;
      let u0 = sx / uw, u1 = (sx + sw) / uw, v0, v1;
      if (E.flip) { v0 = (H - sy) / vh; v1 = (H - sy - sh) / vh; } else { v0 = sy / vh; v1 = (sy + sh) / vh; }
      const part = sx > 0 || sy > 0 || sw < W || sh < H;
      const misc = (unit | ((part ? 33 : 1) << 8)) >>> 0, col = pack(255, 255, 255, A);
      const r0 = Math.min(u0, u1), r1 = Math.min(v0, v1), r2 = Math.max(u0, u1), r3 = Math.max(v0, v1);
      const b = Bt.vn;
      if (this._whole(R)) { // (the ground over the whole screen: one triangle, no corner-to-corner seam - _whole, Discord #155)
        vtx(R[0], R[1], u0, v0, col, misc, r0, r1, r2, r3);
        vtx(2 * R[2] - R[0], R[3], 2 * u1 - u0, v0, col, misc, r0, r1, r2, r3);
        vtx(R[4], 2 * R[5] - R[1], u0, 2 * v1 - v0, col, misc, r0, r1, r2, r3);
        IB[Bt.in++] = b; IB[Bt.in++] = b + 1; IB[Bt.in++] = b + 2;
        return;
      }
      vtx(R[0], R[1], u0, v0, col, misc, r0, r1, r2, r3);
      vtx(R[2], R[3], u1, v0, col, misc, r0, r1, r2, r3);
      vtx(R[4], R[5], u0, v1, col, misc, r0, r1, r2, r3);
      vtx(R[6], R[7], u1, v1, col, misc, r0, r1, r2, r3);
      IB[Bt.in++] = b; IB[Bt.in++] = b + 1; IB[Bt.in++] = b + 2; IB[Bt.in++] = b + 1; IB[Bt.in++] = b + 3; IB[Bt.in++] = b + 2;
    }
    // ---- image data ----
    createImageData(w, h) { return w && typeof w === 'object' ? new ImageData(w.width, w.height) : new ImageData(Math.abs(w | 0) || 1, Math.abs(h | 0) || 1); }
    getImageData(x, y, w, h) {
      x = Math.floor(x); y = Math.floor(y); w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
      if (this._T === SCREEN) return new ImageData(G.read(x, y, w, h), w, h);
      flush(); I.ours();
      const gl = I.gl, T = this._T, px = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb);
      gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      I.forget();
      const out = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < px.length; i += 4) { const a = px[i + 3]; if (!a) continue; const k = 255 / a; out[i] = px[i] * k; out[i + 1] = px[i + 1] * k; out[i + 2] = px[i + 2] * k; out[i + 3] = a; }
      return new ImageData(out, w, h);
    }
    putImageData(img, dx, dy) {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').putImageData(img, 0, 0);
      this.save();
      this.setTransform(1, 0, 0, 1, 0, 0); this.globalAlpha = 1; this.globalCompositeOperation = 'source-over'; this.filter = 'none';
      this.clearRect(dx, dy, img.width, img.height);
      this.drawImage(c, dx, dy);
      this.restore();
    }
  }
  const QUAD = new Uint32Array([0, 1, 2, 1, 3, 2]), RECT = new Float32Array(8), BOX = new Float32Array(8);
  const TRI = new Uint32Array([0, 1, 2]), TRI_P = new Float32Array(6); // (a whole-target rect's one triangle: Ctx._whole)
  G.Ctx = Ctx;
})();
