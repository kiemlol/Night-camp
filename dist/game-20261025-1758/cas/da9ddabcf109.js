/* gl2d_layers.js — the WebGL layers share the game screen's WebGL2 context (2026-10-19, the user: "ทำระยะ 2 ต่อเลย: รวม WebGL
   6 ตัวเดิม (rig ฮีโร่, glfx, meshfx, paintgl, Baphomet, bloodaura) เข้า context เดียวกับจอ"). README "จอเกมด้วย WebGL2" (ระยะ 2).
   Every layer (herospine, petspine, glfx, meshfx, paintgl, baphspine, bloodaura, meshrig) makes its own offscreen canvas,
   asks it for 'webgl2' (premultiplied, alpha), draws, then `ctx.drawImage(itsCanvas, ...)`. Here that getContext hands back
   a PROXY of the screen's own context instead:
   - the layer's "default framebuffer" is a framebuffer of its own (multisampled like its antialias asked, as big as its
     canvas; a new canvas size clears it), with a vertex array of its own (no layer uses VAOs: their attribute setup lives there)
   - its state (program, blend, caps, textures, viewport, pixelStorei, buffers ...) is recorded as it sets it and put back
     whenever it uses the context after the screen did; the screen puts its own state back after a layer (gl2d.js ours())
   - drawImage(itsCanvas) on the GL screen / a GLCanvas = its picture as a texture (multisample resolve, no copy between
     contexts); on a plain 2D canvas (windows that show the hero: bag, status, creator) its pixels are read back (slow, so
     the crowd's hero pictures are GLCanvases now: herospine_crowd.js)
   ?gllayers=0 = every layer keeps its own context (phase 1); NC.GL2D.layerList = the layers. */
(function () {
  'use strict';
  const NC = window.NC, G = NC.GL2D;
  if (!G || !G.on) return;
  G.layers = true;
  if (!G.layers) return;
  const I = G._, gl = I.gl, VIEW = I.VIEW;
  const LAYERS = (G.layerList = []);
  const SAMPLES = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) | 0);
  const CAPS = [gl.BLEND, gl.CULL_FACE, gl.DEPTH_TEST, gl.DITHER, gl.POLYGON_OFFSET_FILL, gl.SAMPLE_ALPHA_TO_COVERAGE, gl.SAMPLE_COVERAGE, gl.SCISSOR_TEST, gl.STENCIL_TEST, gl.RASTERIZER_DISCARD];
  const PIXEL = [[gl.PACK_ALIGNMENT, 4], [gl.UNPACK_ALIGNMENT, 4], [gl.UNPACK_FLIP_Y_WEBGL, false], [gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false],
    [gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL], [gl.UNPACK_ROW_LENGTH, 0], [gl.UNPACK_SKIP_ROWS, 0], [gl.UNPACK_SKIP_PIXELS, 0],
    [gl.UNPACK_IMAGE_HEIGHT, 0], [gl.UNPACK_SKIP_IMAGES, 0], [gl.PACK_ROW_LENGTH, 0], [gl.PACK_SKIP_ROWS, 0], [gl.PACK_SKIP_PIXELS, 0]];
  const D_BLEND = [gl.ONE, gl.ZERO, gl.ONE, gl.ZERO], D_EQ = [gl.FUNC_ADD, gl.FUNC_ADD], D4 = [0, 0, 0, 0], DMASK = [true, true, true, true];
  G.layerStats = { enters: 0, resolves: 0, readbacks: 0 };

  class Layer {
    constructor(canvas, attrs) {
      this.canvas = canvas; this.attrs = Object.assign({}, attrs); this.dead = false;
      this.name = 'layer';
      for (const l of String(new Error().stack).split(String.fromCharCode(10))) { const m = /\/js\/([\w.]+)\.js/.exec(l); if (m && !/^gl2d|crashguard/.test(m[1])) { this.name = m[1]; break; } }
      this.ms = attrs.antialias !== false && SAMPLES > 1;
      this.w = 0; this.h = 0; this.w0 = 0; this.h0 = 0;
      this.fbo = null; this.rb = null; this.resFb = null; this.tex = null;
      this.drawn = 1; this.resolved = 0; this.mirror = null; this.mirrorVer = 0;
      this.vao = gl.createVertexArray();
      this.S = { caps: new Map(), blend: null, eq: null, bc: null, program: null, vao: null, ab: null, ub: null, draw: null, read: null, rbind: null,
        units: new Map(), active: gl.TEXTURE0, vp: null, sc: null, cmask: null, dmask: null, cc: null, cd: null, cs: null, pixel: new Map(),
        cull: null, front: null, lw: null, po: null, df: null };
      this.E = { tex: null, tw: 0, th: 0, sw: 0, sh: 0, flip: true, b: 0, u: 0, used: 0, kind: 9, gen: 0 };
      this.proxy = proxyOf(this);
      this.size();
      this.w0 = this.w; this.h0 = this.h;
    }
    // the framebuffer as big as the canvas (a new size clears it, like a canvas)
    size() {
      const w = Math.max(1, this.canvas.width | 0), h = Math.max(1, this.canvas.height | 0);
      if (w === this.w && h === this.h && this.fbo) return;
      if (this.E.b === I.batchId) I.flush();
      I.flush(); I.ours();
      if (this.fbo) { gl.deleteFramebuffer(this.fbo); gl.deleteRenderbuffer(this.rb); gl.deleteFramebuffer(this.resFb); gl.deleteTexture(this.tex); }
      this.w = w; this.h = h;
      this.rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.rb);
      if (this.ms) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, SAMPLES, gl.RGBA8, w, h);
      else gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
      this.fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.rb);
      gl.clearColor(0, 0, 0, 0); gl.colorMask(true, true, true, true); gl.clear(gl.COLOR_BUFFER_BIT);
      this.tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + I.NU + 3); gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
      this.resFb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.resFb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      I.forget();
      const E = this.E;
      E.tex = this.tex; E.tw = E.sw = w; E.th = E.sh = h;
      this.drawn++;
    }
    // the picture for the GL screen: the multisampled framebuffer resolved into the texture (rows bottom-up: flip)
    resolve() {
      if (this.resolved === this.drawn || !this.fbo) return;
      if (this.E.b === I.batchId) I.flush(); // (the batch still draws the last picture)
      I.ours();
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.resFb);
      gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      I.forget();
      this.resolved = this.drawn;
      G.layerStats.resolves++;
    }
    entry() {
      if ((this.canvas.width | 0) !== this.w || (this.canvas.height | 0) !== this.h) this.size();
      this.resolve();
      this.E.used = G.frame;
      return this.E;
    }
    // the pixels for a plain 2D canvas / another context: read back (straight alpha, top row first); only the part asked
    // for (the source rectangle of that drawImage), kept until the layer draws again
    toCanvas(x, y, w, h) {
      const W = this.w, H = this.h;
      if (x === undefined) { x = 0; y = 0; w = W; h = H; }
      x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y));
      w = Math.min(W - x, Math.ceil(w) + 1); h = Math.min(H - y, Math.ceil(h) + 1);
      if (!this.mirror) this.mirror = document.createElement('canvas');
      if (this.mirror.width !== W || this.mirror.height !== H) { this.mirror.width = W; this.mirror.height = H; this.mirrorVer = 0; }
      if (this.mirrorVer !== this.drawn) { this.mirrorVer = this.drawn; this.have = null; }
      const hv = this.have;
      if (hv && x >= hv[0] && y >= hv[1] && x + w <= hv[2] && y + h <= hv[3]) return this.mirror;
      if (!(w > 0 && h > 0)) return this.mirror;
      this.resolve();
      I.ours();
      const px = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.resFb);
      gl.readPixels(x, H - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      I.forget();
      const img = new ImageData(w, h), d = img.data;
      for (let r = 0; r < h; r++) {
        const s = (h - 1 - r) * w * 4, o = r * w * 4;
        for (let i = 0; i < w * 4; i += 4) {
          const a = px[s + i + 3];
          if (!a) continue;
          const k = 255 / a;
          d[o + i] = px[s + i] * k; d[o + i + 1] = px[s + i + 1] * k; d[o + i + 2] = px[s + i + 2] * k; d[o + i + 3] = a;
        }
      }
      const mc = this.mirror.getContext('2d');
      if (!hv) mc.clearRect(0, 0, W, H);
      mc.putImageData(img, x, y);
      this.have = hv ? [Math.min(hv[0], x), Math.min(hv[1], y), Math.max(hv[2], x + w), Math.max(hv[3], y + h)] : [x, y, x + w, y + h];
      G.layerStats.readbacks++;
      return this.mirror;
    }
    loseExt() {
      const L = this;
      return { loseContext() { L.dead = true; try { L.canvas.dispatchEvent(new Event('webglcontextlost')); } catch (e) { /* ignore */ } }, restoreContext() {} };
    }
  }

  // ---------------- the layer's turn: our batch out, its state in ----------------
  function enter(L) {
    if ((L.canvas.width | 0) !== L.w || (L.canvas.height | 0) !== L.h) L.size();
    if (I.foreign === L) return;
    I.flush();
    I.setForeign(L);
    apply(L);
    G.layerStats.enters++;
  }
  function apply(L) {
    const S = L.S;
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S.draw || L.fbo);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.read || L.fbo);
    gl.bindRenderbuffer(gl.RENDERBUFFER, S.rbind);
    const vp = S.vp || [0, 0, L.w0, L.h0], sc = S.sc || [0, 0, L.w0, L.h0];
    gl.viewport(vp[0], vp[1], vp[2], vp[3]); gl.scissor(sc[0], sc[1], sc[2], sc[3]);
    for (const c of CAPS) { const v = S.caps.has(c) ? S.caps.get(c) : c === gl.DITHER; if (v) gl.enable(c); else gl.disable(c); }
    const b = S.blend || D_BLEND, e = S.eq || D_EQ, bc = S.bc || D4, cm = S.cmask || DMASK, cc = S.cc || D4;
    gl.blendFuncSeparate(b[0], b[1], b[2], b[3]); gl.blendEquationSeparate(e[0], e[1]); gl.blendColor(bc[0], bc[1], bc[2], bc[3]);
    gl.colorMask(cm[0], cm[1], cm[2], cm[3]); gl.depthMask(S.dmask == null ? true : S.dmask); gl.stencilMask(0xffffffff);
    gl.clearColor(cc[0], cc[1], cc[2], cc[3]); gl.clearDepth(S.cd == null ? 1 : S.cd); gl.clearStencil(S.cs == null ? 0 : S.cs);
    for (const [p, d] of PIXEL) gl.pixelStorei(p, S.pixel.has(p) ? S.pixel.get(p) : d);
    if (S.cull != null) gl.cullFace(S.cull);
    if (S.front != null) gl.frontFace(S.front);
    if (S.lw != null) gl.lineWidth(S.lw);
    if (S.po) gl.polygonOffset(S.po[0], S.po[1]);
    if (S.df != null) gl.depthFunc(S.df);
    gl.useProgram(S.program);
    gl.bindVertexArray(S.vao || L.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, S.ab);
    if (S.ub) gl.bindBuffer(gl.UNIFORM_BUFFER, S.ub);
    for (const [u, m] of S.units) { gl.activeTexture(u); for (const [t, x] of m) gl.bindTexture(t, x); }
    gl.activeTexture(S.active);
  }

  // ---------------- the proxy ----------------
  const REC = {
    enable: (S, a) => S.caps.set(a[0], true), disable: (S, a) => S.caps.set(a[0], false),
    blendFunc: (S, a) => { S.blend = [a[0], a[1], a[0], a[1]]; }, blendFuncSeparate: (S, a) => { S.blend = [a[0], a[1], a[2], a[3]]; },
    blendEquation: (S, a) => { S.eq = [a[0], a[0]]; }, blendEquationSeparate: (S, a) => { S.eq = [a[0], a[1]]; },
    blendColor: (S, a) => { S.bc = [a[0], a[1], a[2], a[3]]; },
    useProgram: (S, a) => { S.program = a[0]; },
    bindBuffer: (S, a) => { if (a[0] === gl.ARRAY_BUFFER) S.ab = a[1]; else if (a[0] === gl.UNIFORM_BUFFER) S.ub = a[1]; },
    activeTexture: (S, a) => { S.active = a[0]; },
    bindTexture: (S, a) => { let m = S.units.get(S.active); if (!m) S.units.set(S.active, (m = new Map())); m.set(a[0], a[1]); },
    bindRenderbuffer: (S, a) => { S.rbind = a[1]; },
    viewport: (S, a) => { S.vp = [a[0], a[1], a[2], a[3]]; }, scissor: (S, a) => { S.sc = [a[0], a[1], a[2], a[3]]; },
    colorMask: (S, a) => { S.cmask = [a[0], a[1], a[2], a[3]]; }, depthMask: (S, a) => { S.dmask = a[0]; },
    clearColor: (S, a) => { S.cc = [a[0], a[1], a[2], a[3]]; }, clearDepth: (S, a) => { S.cd = a[0]; }, clearStencil: (S, a) => { S.cs = a[0]; },
    pixelStorei: (S, a) => { S.pixel.set(a[0], a[1]); },
    cullFace: (S, a) => { S.cull = a[0]; }, frontFace: (S, a) => { S.front = a[0]; }, lineWidth: (S, a) => { S.lw = a[0]; },
    polygonOffset: (S, a) => { S.po = [a[0], a[1]]; }, depthFunc: (S, a) => { S.df = a[0]; },
  };
  const DRAWS = new Set(['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'clear', 'blitFramebuffer', 'clearBufferfv', 'clearBufferiv', 'clearBufferuiv', 'clearBufferfi']);
  function wrap(L, k, fn) {
    const S = L.S;
    switch (k) {
      case 'isContextLost': return () => G.lost || L.dead;
      case 'getContextAttributes': return () => Object.assign({ alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false, desynchronized: false }, L.attrs);
      case 'getExtension': return (name) => (name === 'WEBGL_lose_context' ? L.loseExt() : gl.getExtension(name));
      case 'getParameter': return (p) => {
        if (p === gl.FRAMEBUFFER_BINDING || p === gl.DRAW_FRAMEBUFFER_BINDING) return S.draw;
        if (p === gl.READ_FRAMEBUFFER_BINDING) return S.read;
        if (p === gl.VERTEX_ARRAY_BINDING) return S.vao;
        enter(L); return gl.getParameter(p);
      };
      case 'bindFramebuffer': return (t, fb) => {
        enter(L);
        if (t === gl.FRAMEBUFFER || t === gl.DRAW_FRAMEBUFFER) S.draw = fb;
        if (t === gl.FRAMEBUFFER || t === gl.READ_FRAMEBUFFER) S.read = fb;
        gl.bindFramebuffer(t, fb || L.fbo);
      };
      case 'bindVertexArray': return (v) => { enter(L); S.vao = v; gl.bindVertexArray(v || L.vao); };
      case 'deleteTexture': return (t) => { enter(L); for (const m of S.units.values()) for (const [tg, x] of m) if (x === t) m.delete(tg); gl.deleteTexture(t); };
      case 'deleteBuffer': return (b) => { enter(L); if (S.ab === b) S.ab = null; if (S.ub === b) S.ub = null; gl.deleteBuffer(b); };
      case 'deleteProgram': return (p) => { enter(L); if (S.program === p) S.program = null; gl.deleteProgram(p); };
      case 'deleteFramebuffer': return (f) => { enter(L); if (S.draw === f) S.draw = null; if (S.read === f) S.read = null; gl.deleteFramebuffer(f); };
      case 'deleteVertexArray': return (v) => { enter(L); if (S.vao === v) S.vao = null; gl.deleteVertexArray(v); };
      case 'readPixels': return function () {
        enter(L);
        if (S.read) return gl.readPixels.apply(gl, arguments);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, L.resFb);
        gl.blitFramebuffer(0, 0, L.w, L.h, 0, 0, L.w, L.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, L.resFb);
        const r = gl.readPixels.apply(gl, arguments);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, L.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S.draw || L.fbo);
        return r;
      };
    }
    if (DRAWS.has(k)) return function () { enter(L); L.drawn++; return fn.apply(gl, arguments); };
    const rec = REC[k];
    if (rec) return function () { enter(L); rec(S, arguments); return fn.apply(gl, arguments); };
    return function () { enter(L); return fn.apply(gl, arguments); };
  }
  function proxyOf(L) {
    const cache = new Map();
    return new Proxy(gl, {
      get(t, k) {
        if (k === 'canvas') return L.canvas;
        if (k === 'drawingBufferWidth') return L.w;
        if (k === 'drawingBufferHeight') return L.h;
        let f = cache.get(k);
        if (f) return f;
        const v = gl[k];
        if (typeof v !== 'function') return v;
        f = wrap(L, k, v);
        cache.set(k, f);
        return f;
      },
      set(t, k, v) { try { gl[k] = v; } catch (e) { /* (read-only) */ } return true; },
    });
  }

  // ---------------- every layer's getContext('webgl2'): a proxy of the screen's context ----------------
  const baseGet = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    if (type === 'webgl2' && this !== VIEW && attrs && attrs.premultipliedAlpha === true && attrs.alpha === true && !this.isConnected && !G.lost) {
      let L = this.__glLayer;
      if (!L || L.dead) {
        L = new Layer(this, attrs);
        this.__glLayer = L;
        this.__gl2d = { entry: () => L.entry() }; // (texFor: drawn on the GL screen as its texture)
        LAYERS.push(L);
      }
      return L.proxy;
    }
    return baseGet.apply(this, arguments);
  };
  // the screen's context lost: every layer with it (each makes a new context on its next draw, as before)
  VIEW.addEventListener('webglcontextlost', () => {
    for (const L of LAYERS) { L.dead = true; try { L.canvas.dispatchEvent(new Event('webglcontextlost')); } catch (e) { /* ignore */ } }
    LAYERS.length = 0;
  }, false);
})();
