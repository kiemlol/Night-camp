/* gl2d_text.js — text for the WebGL2 game screen, the tee check, and the switch on #view (last of the gl2d files).
   README "จอเกมด้วย WebGL2".
   - Text: each string is drawn ONCE by a real 2D canvas, white, into a 2048 x 2048 atlas, at a size a little above what
     the screen needs (sizes in steps of 9%), then drawn as a quad painted with the fill / stroke style (colours and
     gradients). Damage numbers that grow and shrink reuse a few sizes. A new web font clears the atlas.
   - NC.GL2D.tee(true): every call on the screen's context (and on the offscreen GL canvases) is also made on a real 2D
     canvas of the same size: the same frame drawn both ways, for pixel comparisons (NC.GL2D.teeCanvas()).
   - #view.getContext('2d') hands out this context (game.js and everything that draws on the screen). */
(function () {
  'use strict';
  const NC = window.NC, G = NC.GL2D;
  if (!G || !G.on || !G.Ctx) return;
  const I = G._, gl = I.gl, VIEW = I.VIEW;
  const Ctx = G.Ctx, CP = Ctx.prototype;
  const warn = (k, ...a) => { if (!G._warned[k]) { G._warned[k] = 1; console.warn('gl2d:', ...a); } };

  // ---------------- fonts ----------------
  const FONTS = new Map();
  let probe = null;
  const FRE = /^(.*?)(\d*\.?\d+)px(?:\s*\/\s*[^\s]+)?\s+(.+)$/;
  function fontOf(str) {
    let f = FONTS.get(str);
    if (f !== undefined) return f;
    let m = FRE.exec(str.trim());
    if (!m) { // (pt, em, keywords: let a real canvas turn it into px)
      probe = probe || document.createElement('canvas').getContext('2d');
      probe.font = '10px sans-serif'; probe.font = str;
      m = FRE.exec(probe.font);
    }
    f = m ? { pre: m[1].trim(), size: parseFloat(m[2]), post: m[3].trim() } : null;
    if (FONTS.size > 512) FONTS.clear();
    FONTS.set(str, f);
    return f;
  }
  // measureText by a real 2D canvas; its settings only when they change (setting a font is slow), answers kept per string
  let mctx = null, mFont = '', mAlign = '', mBase = '', mDir = '', mLs = '';
  const MEAS = new Map();
  CP.measureText = function (t) {
    const s = this._s;
    t = String(t);
    const key = s.font + '|' + s.align + '|' + s.base + '|' + s.dir + '|' + s.ls + '|' + t;
    let m = MEAS.get(key);
    if (m) return m;
    mctx = mctx || document.createElement('canvas').getContext('2d');
    if (mFont !== s.font) mctx.font = mFont = s.font;
    if (mAlign !== s.align) mctx.textAlign = mAlign = s.align;
    if (mBase !== s.base) mctx.textBaseline = mBase = s.base;
    if (mDir !== s.dir) mctx.direction = mDir = s.dir;
    if (mLs !== s.ls && 'letterSpacing' in mctx) mctx.letterSpacing = mLs = s.ls;
    m = mctx.measureText(t);
    if (MEAS.size > 4000) MEAS.clear();
    MEAS.set(key, m);
    return m;
  };

  // ---------------- the atlas ----------------
  const AW = 2048, AH = 2048;
  const AT = { tex: null, tw: AW, th: AH, sw: AW, sh: AH, b: 0, u: 0, used: 0, flip: false, mip: false };
  const MASKS = new Map();
  let shelves = [], shelfY = 0;
  function makeAtlas() {
    AT.tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + I.NU + 3); gl.bindTexture(gl.TEXTURE_2D, AT.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, AW, AH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
    MASKS.clear(); shelves = []; shelfY = 0;
  }
  function clearAtlas() {
    if (AT.b === I.batchId) I.flush();
    MASKS.clear(); shelves = []; shelfY = 0;
    // (the old strings' pixels go too: new strings sit where old ones were, and the texels between them (the 1 px gaps, a
    // shelf's rows under a shorter string) kept old glyphs, which a string drawn a hair off 1:1 picked up at its bottom and
    // right edges as a thin dark box: Discord #155, right after the web fonts loaded)
    I.ours();
    gl.activeTexture(gl.TEXTURE0 + I.NU + 3); gl.bindTexture(gl.TEXTURE_2D, AT.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, AW, AH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  function place(w, h) {
    for (const sh of shelves) if (h <= sh.h && sh.x + w <= AW) { const x = sh.x; sh.x += w + 1; return [x, sh.y]; }
    if (shelfY + h > AH) return null;
    const sh = { y: shelfY, h, x: w + 1 };
    shelves.push(sh); shelfY += h + 1;
    return [0, sh.y];
  }
  let rcv = null, rg = null;
  function raster(t, f, bs, s, stroke, lw) {
    rcv = rcv || document.createElement('canvas');
    const font = (f.pre ? f.pre + ' ' : '') + bs + 'px ' + f.post;
    const setup = () => {
      rg = rcv.getContext('2d');
      rg.font = font; rg.textAlign = s.align; rg.textBaseline = s.base; rg.direction = s.dir;
      if ('letterSpacing' in rg) rg.letterSpacing = s.ls === '0px' ? '0px' : parseFloat(s.ls) * (bs / f.size) + 'px';
      rg.fillStyle = '#fff'; rg.strokeStyle = '#fff'; rg.lineWidth = lw; rg.lineJoin = s.join; rg.miterLimit = s.ml;
    };
    if (!rg) { rcv.width = 512; rcv.height = 256; }
    setup();
    const m = rg.measureText(t);
    const pad = 2 + Math.ceil(lw);
    const L = Math.ceil(m.actualBoundingBoxLeft || 0), R = Math.ceil(m.actualBoundingBoxRight || 0);
    const A = Math.ceil(m.actualBoundingBoxAscent || 0), D = Math.ceil(m.actualBoundingBoxDescent || 0);
    const w = L + R + 2 * pad, h = A + D + 2 * pad;
    if (!(w > 0 && h > 0)) return null;
    if (w > AW || h > 512) { warn('bigtext', 'text too big for the atlas', t.slice(0, 24)); return null; }
    let at = place(w, h);
    if (!at) { clearAtlas(); at = place(w, h); if (!at) return null; }
    if (rcv.width < w || rcv.height < h) { rcv.width = Math.max(rcv.width, w); rcv.height = Math.max(rcv.height, h); setup(); }
    rg.clearRect(0, 0, w, h);
    if (stroke) rg.strokeText(t, pad + L, pad + A); else rg.fillText(t, pad + L, pad + A);
    I.ours();
    gl.activeTexture(gl.TEXTURE0 + I.NU + 3); gl.bindTexture(gl.TEXTURE_2D, AT.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, at[0], at[1], w, h, gl.RGBA, gl.UNSIGNED_BYTE, rcv);
    return { ax: at[0], ay: at[1], w, h, ox: pad + L, oy: pad + A, adv: m.width };
  }
  const UV = new Float32Array(8);
  CP._text = function (t, x, y, maxW, stroke) {
    t = String(t);
    if (!t || !(isFinite(x) && isFinite(y))) return;
    if (maxW !== undefined && !(maxW > 0)) return;
    const s = this._s, f = fontOf(s.font);
    if (!f || !(f.size > 0)) return;
    const det = Math.abs(s.a * s.d - s.b * s.c), sc = Math.sqrt(det);
    if (!(sc > 0)) return;
    const dev = f.size * Math.max(sc, this._sc() * 0.75);
    if (!(dev >= 1)) return;
    // names and labels at their own size (to half a pixel); bigger text (damage numbers that grow and shrink) in 9% steps
    const bs = dev <= 36 ? Math.round(dev * 2) / 2 : Math.min(320, Math.round(Math.pow(2, Math.ceil(Math.log2(dev) * 8) / 8) * 4) / 4);
    const lw = stroke ? (s.lw * bs) / f.size : 0;
    const key = (stroke ? 'S' + lw.toFixed(2) + s.join : 'F') + '|' + f.pre + '|' + f.post + '|' + bs + '|' + s.align + '|' + s.base + '|' + s.dir + '|' + s.ls + '|' + t;
    let M = MASKS.get(key);
    if (!M) { M = raster(t, f, bs, s, stroke, lw); if (!M) return; MASKS.set(key, M); }
    const k = f.size / bs;
    let x0 = x - M.ox * k, w = M.w * k, y0 = y - M.oy * k;
    const h = M.h * k;
    if (Math.abs(s.b) < 1e-9 && Math.abs(s.c) < 1e-9 && Math.abs(k * s.a - 1) < 0.02 && Math.abs(k * s.d - 1) < 0.02) { // (1 mask px = 1 screen px: on whole pixels, crisp)
      const X = s.a * x0 + s.e, Y = s.d * y0 + s.f;
      x0 += (Math.round(X) - X) / s.a; y0 += (Math.round(Y) - Y) / s.d;
    }
    if (maxW !== undefined && M.adv * k > maxW) { const q = maxW / (M.adv * k); x0 = x + (x0 - x) * q; w *= q; }
    const R = this._rect(x0, y0, w, h);
    const u0 = M.ax / AW, v0 = M.ay / AH, u1 = (M.ax + M.w) / AW, v1 = (M.ay + M.h) / AH;
    UV[0] = u0; UV[1] = v0; UV[2] = u1; UV[3] = v0; UV[4] = u0; UV[5] = v1; UV[6] = u1; UV[7] = v1;
    AT.used = G.frame;
    this._emit(stroke ? s.ss : s.fs, 1, R, 4, QUAD, 6, false, AT, UV);
  };
  CP.fillText = function (t, x, y, maxW) { this._text(t, x, y, maxW, false); };
  CP.strokeText = function (t, x, y, maxW) { this._text(t, x, y, maxW, true); };
  const QUAD = new Uint32Array([0, 1, 2, 1, 3, 2]);
  makeAtlas();
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { clearAtlas(); FONTS.clear(); MEAS.clear(); });
  VIEW.addEventListener('webglcontextrestored', () => makeAtlas(), false);
  G.textStats = () => ({ masks: MASKS.size, shelves: shelves.length, usedRows: shelfY });

  // ---------------- tee: the same calls on a real 2D canvas ----------------
  const METHODS = ['save', 'restore', 'reset', 'setTransform', 'resetTransform', 'transform', 'translate', 'scale', 'rotate', 'setLineDash',
    'beginPath', 'closePath', 'moveTo', 'lineTo', 'rect', 'arc', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'arcTo', 'roundRect',
    'fill', 'stroke', 'clip', 'fillRect', 'clearRect', 'strokeRect', 'drawImage', 'putImageData', 'fillText', 'strokeText'];
  const PROPS = ['fillStyle', 'strokeStyle', 'globalAlpha', 'globalCompositeOperation', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit',
    'lineDashOffset', 'font', 'textAlign', 'textBaseline', 'direction', 'letterSpacing', 'filter', 'imageSmoothingEnabled',
    'imageSmoothingQuality', 'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY'];
  let teeOn = false, MV = null, inner = 0;
  // what the real canvas draws for a source: the screen = its own copy; a GLCanvas (the light map, the crowd's pictures, made
  // before or during the tee) = its pixels read back from the GPU; a WebGL layer canvas = itself (read back on drawImage)
  const mirrorCanvas = (src) => {
    if (src === VIEW) return MV;
    if (src instanceof I.GLCanvas) {
      const c = document.createElement('canvas'), w = src.width, h = src.height;
      c.width = w; c.height = h;
      c.getContext('2d').putImageData(CP.getImageData.call(src.getContext('2d'), 0, 0, w, h), 0, 0);
      return c;
    }
    return src;
  };
  function mapArg(v, mc) {
    if (v === VIEW || (v && v.__gl2d) || v instanceof I.GLCanvas) return mirrorCanvas(v);
    if (v instanceof G.Gradient) {
      if (!v._m || v._mc !== mc) {
        const g = v.kind === 'linear' ? mc.createLinearGradient(v.x0, v.y0, v.x1, v.y1) : v.kind === 'radial' ? mc.createRadialGradient(v.x0, v.y0, v.r0, v.x1, v.y1, v.r1) : mc.createLinearGradient(0, 0, 1, 0);
        for (const st of v.stops) g.addColorStop(st.o, st.s);
        v._m = g; v._mc = mc;
      }
      return v._m;
    }
    if (v && v.constructor && v.constructor.name === 'Pattern' && v.img) return mc.createPattern(mirrorCanvas(v.img), v.rep);
    return v;
  }
  function teeCtx(ctx, mc) {
    // the real canvas starts from the state this one has now (a context keeps its state from frame to frame)
    for (const p of PROPS) { try { mc[p] = mapArg(ctx[p], mc); } catch (e) { /* ignore */ } }
    const st = ctx._s;
    mc.setTransform(st.a, st.b, st.c, st.d, st.e, st.f); mc.setLineDash(st.dash);
    for (const m of METHODS) {
      const f = CP[m];
      ctx[m] = function () { // (only the outermost call: arcTo, rect, roundRect, putImageData make calls of their own)
        if (!inner) {
          const a = Array.prototype.map.call(arguments, (v) => mapArg(v, mc));
          try { mc[m].apply(mc, a); } catch (e) { /* (the real canvas refused it: it may throw where we drew nothing) */ }
        }
        inner++;
        try { return f.apply(ctx, arguments); } finally { inner--; }
      };
    }
    for (const p of PROPS) {
      const d = Object.getOwnPropertyDescriptor(CP, p);
      Object.defineProperty(ctx, p, { configurable: true, get: d.get, set(v) { if (!inner) try { mc[p] = mapArg(v, mc); } catch (e) { /* ignore */ } d.set.call(ctx, v); } });
    }
  }
  function untee(ctx) { for (const m of METHODS) delete ctx[m]; for (const p of PROPS) delete ctx[p]; }
  G.tee = function (on) {
    if (on === teeOn) return MV;
    teeOn = on;
    if (on) {
      MV = document.createElement('canvas'); MV.width = VIEW.width; MV.height = VIEW.height;
      teeCtx(G.ctx, MV.getContext('2d'));
      for (const r of G._canvases) {
        const c = r.deref();
        if (!c) continue;
        c._mc = document.createElement('canvas'); c._mc.width = c.width; c._mc.height = c.height;
        if (c._ctx) teeCtx(c._ctx, c._mc.getContext('2d'));
      }
    } else {
      untee(G.ctx);
      for (const r of G._canvases) { const c = r.deref(); if (c) { if (c._ctx) untee(c._ctx); c._mc = null; } }
    }
    return MV;
  };
  G.teeCanvas = () => MV;

  // ---------------- the switch: #view's 2D context is this one ----------------
  G.ctx = new Ctx(VIEW, I.SCREEN);
  VIEW.getContext = function (type) { return type === '2d' ? G.ctx : null; };
})();
