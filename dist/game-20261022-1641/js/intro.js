/* intro.js — the title intro: a short film in WebGL2 (art in assets/intro/, cut by tools/introcut.py; css/intro.css)
   that plays while the game loads behind it, then the logo and the start button.
     A. out of the dark, red hanging figures slide down on their ropes, row after row, and swing;
     B. the camera drops and rushes low through a thorn thicket towards a far violet glow;
     C. it slows and cranes up: THE DARK TREE in its clearing under the moon; its roots ignite violet, embers rise;
     D. the logo, then "เริ่มเกม" once the game is ready (a loading line until then); the scene keeps breathing
      (embers, mist, the twigs sway) but the camera stays put: no mouse parallax.
   Plays on a normal launch (no URL switches) or with ?intro=1; ?intro=0 or any test switch skips it, so test runs
   start as before. A click or a key skips the film to the title. While it is up the game is paused and keys don't
   reach it. Without WebGL2, or if its pictures fail to load, it steps aside and the old loading screen shows.
   Load right after the loading screen's markup, before core.js (it needs nothing from NC). */
(function () {
  'use strict';
  if (new URLSearchParams(location.search).has('online')) return; // (the online client opens on its own lobby)

  // ---------------- the screen ----------------
  const root = document.createElement('div');
  root.id = 'intro';
  root.innerHTML =
    '<canvas class="in-gl"></canvas>' +
    '<img class="in-logo" src="assets/loading/logo.png" alt="Night Camp">' +
    // the patch's logo with its "NEW PATCH" sticker, and the Meow-wat logo bottom-left
    '<div class="in-patch"><span class="in-ptag">NEW PATCH</span><img src="assets/intro/patch_logo.png" alt="Dark Tree"></div>' +
    '<div class="in-credit"><img src="assets/intro/meowwat.png" alt="Meow-wat"></div>' +
    '<div class="in-copy"><span>© 2026 Night Camp.</span> <span>Original content rights reserved.</span></div>' +
    '<div class="in-bottom">' +
    '<button class="in-start" type="button">เริ่มเกม</button>' +
    '<div class="in-load"><span>กำลังเตรียมค่าย…</span><div class="in-bar"><i></i></div></div>' +
    '<div class="in-hint">คลิก หรือกด Enter</div>' +
    '</div>' +
    '<button class="in-skip" type="button">ข้าม ▸</button>';
  document.body.appendChild(root);
  const cv = root.querySelector('.in-gl');
  const gl = cv.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) { root.remove(); return; }
  const $ = (s) => root.querySelector(s);
  const btn = $('.in-start'), loadEl = $('.in-load'), loadTxt = $('.in-load span'), loadBar = $('.in-bar i');

  // ---------------- the film's clock (seconds from the first picture) ----------------
  const T = { aIn: 0.25, aCut: 3.55, b0: 3.6, b1: 8.2, craneA: 7.2, craneB: 10.6, ignite: 8.7, logo: 10.1, ready: 10.9 };
  // where the hanging figures' ropes start (x as a fraction of each picture's width; tools/introcut.py --rope)
  const ROPE = [0.64, 0.46, 0.62, 0.66, 0.57, 0.6];
  const SIL = 0.3; // the figures' red: how bright a pixel must be (0.1 + SIL) to glow full red
  const BG_GROUND = 0.62; // the clearing's middle on bg.jpg (fraction from the top): the tree's roots go there

  // ---------------- GL: one sprite shader, a bloom chain, the final grade ----------------
  const VS = `#version 300 es
in vec2 aPos; in vec2 aUv; in vec4 aCol; in vec3 aFx;
out vec2 vUv; out vec4 vCol; out vec3 vFx;
void main(){ vUv=aUv; vCol=aCol; vFx=aFx; gl_Position=vec4(aPos,0.,1.); }`;
  const FS = `#version 300 es
precision highp float;
in vec2 vUv; in vec4 vCol; in vec3 vFx; // vFx: x = fog, y = sway, z = red silhouette
uniform sampler2D uTex; uniform vec3 uFog; uniform float uTime;
out vec4 o;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec2 uv = vUv;
  if (vFx.y > 0.) { // the tree breathes: twigs high up sway the most
    float k = pow(clamp(1. - uv.y, 0., 1.), 1.6);
    uv.x += (n2(vec2(uv.x*5. + uv.y*3., uTime*0.45)) - .5) * vFx.y * k;
    uv.y += (n2(vec2(uv.y*5. - uv.x*2., uTime*0.38 + 7.)) - .5) * vFx.y * .6 * k;
  }
  vec4 c = texture(uTex, uv);
  if (vFx.z > 0.) { // any figure becomes red stained glass: dark lines stay maroon, the fills glow red
    vec3 s = c.rgb / max(c.a, 1e-3);
    float l = max(s.r, max(s.g, s.b));
    vec3 red = mix(vec3(.24, .0, .03), vec3(1.15, .1, .09), smoothstep(.1, .1 + vFx.z, l));
    red = mix(red, vec3(1.3, .4, .32), smoothstep(.8, 1., l) * .35);
    c.rgb = red * c.a;
  }
  c *= vCol;
  c.rgb = mix(c.rgb, uFog * c.a, vFx.x);
  o = c;
}`;
  const QVS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*.5+.5; gl_Position = vec4(aPos,0.,1.); }`;
  const BRIGHT = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform float uThr; out vec4 o;
void main(){ vec3 c = texture(uTex, vUv).rgb; float m = max(c.r, max(c.g, c.b));
  o = vec4(c * max(m - uThr, 0.) / max(m, 1e-3) * 1.6, 1.); }`;
  const BLUR = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main(){ vec3 c = texture(uTex, vUv).rgb * .227;
  c += (texture(uTex, vUv + uDir*1.385).rgb + texture(uTex, vUv - uDir*1.385).rgb) * .316;
  c += (texture(uTex, vUv + uDir*3.231).rgb + texture(uTex, vUv - uDir*3.231).rgb) * .070;
  o = vec4(c, 1.); }`;
  const FIN_FS = `#version 300 es
precision highp float; in vec2 vUv;
uniform sampler2D uScene, uBloom; uniform float uBloomK, uZoom, uVig, uFade, uTime, uAspect, uSat, uImp, uImpInv;
uniform vec3 uFlash, uTint, uImpCol; uniform vec2 uRes, uZc; out vec4 o;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec3 c;
  if (uZoom > .001) { // zoom blur towards a point (the rush)
    vec2 d = (vUv - uZc) * uZoom; c = vec3(0.);
    for (int i = 0; i < 12; i++) c += texture(uScene, vUv - d * float(i) / 12.).rgb;
    c /= 12.;
  } else c = texture(uScene, vUv).rgb;
  c += texture(uBloom, vUv).rgb * uBloomK;
  c = mix(vec3(dot(c, vec3(.299, .587, .114))), c, uSat) * uTint; // the grade (the prologue drains colour, tints)
  if (uImp > 0.) { // an anime impact frame: the picture in two flat tones
    float l = dot(c, vec3(.299, .587, .114));
    float s = uImpInv > .5 ? 1. - step(.3, l) : step(.3, l); // (inverted: the dark parts take the colour)
    c = mix(c, mix(vec3(.03, .02, .05), uImpCol, s), uImp);
  }
  float r = length((vUv - .5) * vec2(uAspect, 1.));
  c *= mix(1., smoothstep(1.15, .3, r), uVig);
  c = c / (1. + c * .12);            // a soft shoulder for the bright glow
  c = c * (1. - uFade) + uFlash;
  c += (h(vUv * uRes + fract(uTime * 7.3) * 91.) - .5) * .03; // grain
  o = vec4(c, 1.);
}`;
  function prog(vs, fs) {
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aUv'); gl.bindAttribLocation(p, 2, 'aCol'); gl.bindAttribLocation(p, 3, 'aFx');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  let P;
  try {
    P = { spr: prog(VS, FS), bright: prog(QVS, BRIGHT), blur: prog(QVS, BLUR), fin: prog(QVS, FIN_FS) };
  } catch (e) { console.warn('intro: shader', e); root.remove(); return; }

  // the sprite batch: x y u v r g b a fog sway sil per vertex, six vertices a quad
  const MAXQ = 3000, STR = 11, vdata = new Float32Array(MAXQ * 6 * STR);
  const vbo = gl.createBuffer(), vao = gl.createVertexArray();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vdata.byteLength, gl.DYNAMIC_DRAW);
  [[0, 2, 0], [1, 2, 2], [2, 4, 4], [3, 3, 8]].forEach(([i, n, off]) => {
    gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, STR * 4, off * 4);
  });
  const qvao = gl.createVertexArray(), qbuf = gl.createBuffer();
  gl.bindVertexArray(qvao); gl.bindBuffer(gl.ARRAY_BUFFER, qbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  let nq = 0, bTex = null, bAdd = false, fogCol = [0.06, 0.04, 0.12], time = 0;
  function flush() {
    if (!nq) return;
    gl.useProgram(P.spr.p);
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vdata, 0, nq * 6 * STR);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bTex);
    gl.uniform1i(P.spr.u.uTex, 0); gl.uniform3fv(P.spr.u.uFog, fogCol); gl.uniform1f(P.spr.u.uTime, time);
    gl.enable(gl.BLEND);
    if (bAdd) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, nq * 6);
    nq = 0;
  }
  // one quad from four clip-space corners (top-left, top-right, bottom-right, bottom-left)
  function quad(tex, add, c, uv, col, fog, sway, sil) {
    if (tex !== bTex || add !== bAdd || nq >= MAXQ) { flush(); bTex = tex; bAdd = add; }
    const a = col[3], r = col[0] * a, g = col[1] * a, b = col[2] * a;
    const V = [[c[0], uv[0], uv[1]], [c[1], uv[2], uv[1]], [c[2], uv[2], uv[3]], [c[3], uv[0], uv[3]]];
    let o = nq * 6 * STR;
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const v = V[k];
      vdata[o++] = v[0][0]; vdata[o++] = v[0][1]; vdata[o++] = v[1]; vdata[o++] = v[2];
      vdata[o++] = r; vdata[o++] = g; vdata[o++] = b; vdata[o++] = add ? 0 : a;
      vdata[o++] = fog || 0; vdata[o++] = sway || 0; vdata[o++] = sil || 0;
    }
    nq++;
  }

  // ---------------- textures ----------------
  function texFrom(src, repeat) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
    return { t, w: src.width, h: src.height };
  }
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return texFrom(c, repeat);
  }
  const TX = {};
  TX.white = canvasTex(4, 4, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 4, 4); });
  TX.glow = canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    r.addColorStop(0.6, 'rgba(255,255,255,0.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  TX.dot = canvasTex(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.8)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  TX.ring = canvasTex(256, 256, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, w * 0.3, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.7, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  TX.mist = canvasTex(512, 256, (g, w, h) => { // soft blobs that tile sideways (and stay off the top and bottom edges)
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w, y = h * (0.42 + rnd() * 0.16), rr = h * (0.12 + rnd() * 0.22);
      for (const dx of [-w, 0, w]) {
        const r = g.createRadialGradient(x + dx, y, 0, x + dx, y, rr);
        r.addColorStop(0, 'rgba(255,255,255,0.16)'); r.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = r; g.fillRect(x + dx - rr, y - rr, rr * 2, rr * 2);
      }
    }
  }, true);

  // ---------------- render targets ----------------
  let W = 0, H = 0, aspect = 16 / 9, fb = null;
  function target(w, h) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  }
  function resize() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    const k = Math.min(1, 1920 / w, 1200 / h); w = Math.max(2, Math.round(w * k)); h = Math.max(2, Math.round(h * k));
    if (w === W && h === H) return;
    W = w; H = h; aspect = W / H; cv.width = W; cv.height = H;
    if (fb) for (const k2 in fb) { gl.deleteTexture(fb[k2].t); gl.deleteFramebuffer(fb[k2].f); }
    const hw = Math.max(1, W >> 1), hh = Math.max(1, H >> 1), qw = Math.max(1, W >> 2), qh = Math.max(1, H >> 2);
    fb = { scene: target(W, H), half: target(hw, hh), qa: target(qw, qh), qb: target(qw, qh) };
  }

  // ---------------- camera and projection (a pinhole looking down +z, y up) ----------------
  const FOV = 0.36; // tan(half the vertical field of view)
  const cam = { x: 0, y: 0, z: 0 }, camV = { x: 0, y: 0, z: 0 }, camLast = { x: 0, y: 0, z: 0 };
  let shake = 0;
  function clipAt(x, y, z, c) {
    const d = z - c.z;
    return [(x - c.x) / (d * FOV * aspect), (y - c.y) / (d * FOV), d];
  }
  // a picture standing at (x, y-bottom, z), w x h world units; rotated by ang around (px, py) if given
  function stand(tex, x, y, z, w, h, col, o) {
    o = o || {};
    const d = z - cam.z;
    if (d < 0.25) return;
    let pts = [[x - w / 2, y + h], [x + w / 2, y + h], [x + w / 2, y], [x - w / 2, y]];
    if (o.ang) {
      const s = Math.sin(o.ang), c = Math.cos(o.ang), px = o.px, py = o.py;
      pts = pts.map(([X, Y]) => [px + (X - px) * c - (Y - py) * s, py + (X - px) * s + (Y - py) * c]);
    }
    const cl = pts.map(([X, Y]) => { const p = clipAt(X, Y, z, cam); return [p[0], p[1]]; });
    const uv = o.uv || (o.flip ? [1, 0, 0, 1] : [0, 0, 1, 1]);
    quad(tex.t, !!o.add, cl, uv, col, o.fog, o.sway, o.sil);
  }
  // a band of mist: a wide quad that stays put while its picture scrolls (no edge ever shows)
  function mist(y, z, h, speed, col) {
    const w = 260, rep = w / 60, off = (time * speed) / 60;
    stand(TX.mist, cam.x, y, z, w, h, col, { add: true, uv: [off, 0, off + rep, 1] });
  }
  // a glowing point in the world, smeared along its screen motion (own velocity + the camera's)
  function spark(tex, x, y, z, vx, vy, vz, size, col, trail) {
    const d = z - cam.z;
    if (d < 0.3) return;
    const k = trail || 0.045;
    const prev = { x: cam.x - camV.x * k, y: cam.y - camV.y * k, z: cam.z - camV.z * k };
    const p1 = clipAt(x, y, z, cam), p0 = clipAt(x - vx * k, y - vy * k, z - vz * k, prev);
    if (p0[2] < 0.3) { p0[0] = p1[0]; p0[1] = p1[1]; }
    const ax = p1[0] * aspect, ay = p1[1], bx = p0[0] * aspect, by = p0[1];
    const r = size / (d * FOV);
    let dx = ax - bx, dy = ay - by;
    const len = Math.hypot(dx, dy);
    if (len < r * 0.5) { dx = 0; dy = 1; } else { dx /= len; dy /= len; }
    const nx = -dy * r, ny = dx * r, ex = dx * r, ey = dy * r;
    const pts = [[ax + ex + nx, ay + ey + ny], [ax + ex - nx, ay + ey - ny], [bx - ex - nx, by - ey - ny], [bx - ex + nx, by - ey + ny]];
    quad(tex.t, true, pts.map(([X, Y]) => [X / aspect, Y]), [0, 0, 1, 1], col);
  }
  // a quad in screen space (clip coords)
  function screen(tex, x0, y0, x1, y1, col, o) {
    o = o || {};
    quad(tex.t, !!o.add, [[x0, y1], [x1, y1], [x1, y0], [x0, y0]], o.uv || [0, 0, 1, 1], col, o.fog, o.sway);
  }

  // ---------------- small helpers ----------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const eOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const eInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---------------- the scene's layout ----------------
  const TREE = { z: 40, h: 13.6 };                 // the tree's distance and height (world units)
  // the title shot's camera: the tree big (78% of the screen's height), its roots 86% down above the button, its
  // crown reaching up behind the logo (the user: the tree must be bigger)
  const FINAL = { x: 0, y: 6.27, z: 15.8 };
  const LOW = 1.35;                                 // the camera's height while it rushes through the thicket
  const B0Z = -38;                                  // where the rush starts
  // the thicket: pieces left and right of the path, a few low ones on it (deterministic)
  const THORNS = [];
  seed = 4242;
  for (let i = 0; i < 40; i++) {
    const z = B0Z + 3 + i * 1.12 + rnd() * 0.8;
    const side = i % 2 ? 1 : -1, mid = rnd() < 0.22;
    THORNS.push({
      k: (rnd() * 6) | 0, z, flip: rnd() < 0.5,
      x: mid ? (rnd() - 0.5) * 1.6 : side * (0.7 + rnd() * 5.5),
      h: mid ? 0.5 + rnd() * 0.7 : 1.1 + rnd() * 2.6,
      dark: 0.55 + rnd() * 0.35,
    });
  }
  // the hanging figures: three rows filling the frame (back high, front low), dropping in left to right
  const HANG = [];
  seed = 777;
  [[26, 6, 0.62, 3.0], [19, 5, 0.82, -1.0], [13, 4, 1.0, -4.0]].forEach(([z, n, lit, rest], row) => {
    const span = 2 * z * FOV * aspectGuess() * 0.86, step = span / n;
    for (let i = 0; i < n; i++) {
      HANG.push({
        k: (row * 2 + i * 5 + 1) % 6, z, lit, flip: rnd() < 0.4,
        x: -span / 2 + step * (i + 0.5) + (row === 1 ? step * 0.25 : 0) + (rnd() - 0.5) * step * 0.12,
        t: T.aIn + row * 0.32 + i * 0.11 + rnd() * 0.06, rest: rest + (rnd() - 0.5) * 0.5,
        swing: 0.05 + rnd() * 0.06, ph: rnd() * 6.28, h: 3.1, tws: 0.35 + rnd() * 0.4,
      });
    }
  });
  function aspectGuess() { return Math.max(1.2, Math.min(2.4, innerWidth / Math.max(1, innerHeight))); }

  // ---------------- particles ----------------
  const parts = [];
  function emit(p) { if (parts.length < 900) parts.push(p); }
  function emitters(dt) {
    if (time < T.b0) { // A: red ash falling in the dark
      for (let i = 0; i < 2; i++) if (rnd() < dt * 22) emit({ x: (rnd() - 0.5) * 20, y: 9, z: 8 + rnd() * 16, vx: (rnd() - 0.5) * 0.3, vy: -(0.4 + rnd() * 0.5), vz: 0, life: 6, t: 0, s: 0.03 + rnd() * 0.03, c: [1, 0.25, 0.2], a: 0.7, wob: 0.4, ph: rnd() * 9 });
      return;
    }
    // embers from the roots (a trickle before they ignite, a stream after)
    const rate = time < T.ignite ? 6 : 34;
    if (rnd() < dt * rate) emit({ x: (rnd() - 0.5) * 7, y: 0.2 + rnd() * 0.6, z: TREE.z - 1.5 + rnd() * 3, vx: (rnd() - 0.5) * 0.4, vy: 0.7 + rnd() * 1.3, vz: (rnd() - 0.5) * 0.3, life: 3 + rnd() * 3, t: 0, s: 0.05 + rnd() * 0.05, c: rnd() < 0.7 ? [1, 0.45, 0.18] : [1, 0.3, 0.75], a: 1, wob: 0.6, ph: rnd() * 9 });
    // violet motes hanging in the air of the clearing
    if (rnd() < dt * 10) emit({ x: (rnd() - 0.5) * 30, y: rnd() * 12, z: FINAL.z + 4 + rnd() * 30, vx: (rnd() - 0.5) * 0.2, vy: 0.1 + rnd() * 0.15, vz: 0, life: 5 + rnd() * 4, t: 0, s: 0.04 + rnd() * 0.05, c: [0.7, 0.45, 1], a: 0.8, wob: 0.3, ph: rnd() * 9, tw: 1 });
    // a few fireflies in the thicket
    if (rnd() < dt * 3) emit({ x: (rnd() - 0.5) * 12, y: 0.3 + rnd() * 2.5, z: cam.z + 6 + rnd() * 30, vx: 0, vy: 0.05, vz: 0, life: 4 + rnd() * 3, t: 0, s: 0.05, c: [0.85, 1, 0.55], a: 0.9, wob: 0.5, ph: rnd() * 9, tw: 1 });
    // the rush: specks of light the camera flies past
    if (time < T.b1 && rnd() < dt * 90) emit({ x: (rnd() - 0.5) * 9, y: rnd() * 3.2, z: cam.z + 8 + rnd() * 22, vx: 0, vy: 0, vz: 0, life: 2, t: 0, s: 0.035, c: rnd() < 0.5 ? [1, 0.35, 0.65] : [0.6, 0.45, 1], a: 0.9, wob: 0, ph: 0 });
  }
  function updParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t > p.life || p.z < cam.z + 0.2) { parts.splice(i, 1); continue; }
      p.x += (p.vx + Math.sin(p.t * 1.7 + p.ph) * p.wob) * dt;
      p.y += p.vy * dt; p.z += p.vz * dt;
    }
  }
  function drawParts() {
    for (const p of parts) {
      let a = p.a * Math.min(1, p.t * 3) * Math.min(1, (p.life - p.t) * 1.5);
      if (p.tw) a *= 0.55 + 0.45 * Math.sin(p.t * 5 + p.ph);
      const d = p.z - cam.z;
      a *= clamp((d - 0.4) / 2, 0, 1);
      spark(TX.dot, p.x, p.y, p.z, p.vx, p.vy, p.vz, p.s, [p.c[0], p.c[1], p.c[2], a]);
    }
  }

  // ---------------- the film ----------------
  const IMG = {};
  let glowK = 0, ringT = -9;
  function shot(dt) {
    // -------- the camera --------
    const shakeOn = !window.NC?.ScreenShake || window.NC.ScreenShake.enabled();
    if (time < T.b0) { // A: a slow push in, then the drop
      const p = clamp((time - T.aIn) / (T.aCut - T.aIn), 0, 1);
      cam.x = 0; cam.z = lerp(-3, 0, eOut(p));
      cam.y = 0.4 - Math.pow(sm(T.aCut - 0.55, T.aCut, time), 2) * 9;
    } else {
      const pb = clamp((time - T.b0) / (T.b1 - T.b0), 0, 1);
      const pc = eInOut((time - T.craneA) / (T.craneB - T.craneA));
      const zRush = lerp(B0Z, 3, eOut(pb));
      cam.z = lerp(zRush, FINAL.z, eInOut((time - (T.b1 - 0.6)) / (T.craneB - T.b1 + 0.6)));
      cam.x = Math.sin(time * 1.3) * 0.25 * (1 - pc) + FINAL.x * pc;
      cam.y = lerp(LOW + (shakeOn ? Math.sin(time * 9) * 0.03 * (1 - pb) : 0), FINAL.y, pc);
      // (the title shot holds still: no drift, no mouse parallax; the user's call)
    }
    if (!shakeOn) shake = 0;
    if (shake > 0) { cam.x += (rnd() - 0.5) * shake; cam.y += (rnd() - 0.5) * shake; shake = Math.max(0, shake - dt * 0.9); }
    // the camera's speed, for the motion streaks
    const k = dt > 0 ? 1 / dt : 0;
    camV.x = lerp(camV.x, (cam.x - camLast.x) * k, 0.5); camV.y = lerp(camV.y, (cam.y - camLast.y) * k, 0.5); camV.z = lerp(camV.z, (cam.z - camLast.z) * k, 0.5);
    camLast.x = cam.x; camLast.y = cam.y; camLast.z = cam.z;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb.scene.f);
    gl.viewport(0, 0, W, H);
    if (time < T.b0) {
      // ================= A: the hanging figures =================
      gl.clearColor(0.012, 0.006, 0.012, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      fogCol = [0.012, 0.006, 0.012];
      const haze = sm(T.aIn, T.aIn + 1.4, time) * 0.5;
      screen(TX.glow, -1.6, -1.3, 1.6, 1.9, [0.55, 0.05, 0.08, haze * 0.55], { add: true });
      for (const f of HANG) {
        const tex = IMG['hang' + (f.k + 1)];
        if (!tex) continue;
        const te = time - f.t;
        if (te < 0) continue;
        // the drop: falls in, the rope catches it with a jolt, then it swings and settles
        const fall = 0.32, drop = 14;
        let off;
        if (te < fall) off = drop * (1 - Math.pow(te / fall, 2));
        else { const u = te - fall; off = -0.55 * Math.exp(-5 * u) * Math.sin(10 * u); }
        const u = Math.max(0, te - fall);
        const ang = f.swing * Math.exp(-0.7 * u) * Math.sin(2.4 * u + f.ph) + 0.035 * Math.sin(time * 1.1 + f.ph);
        // each body turns slowly on its rope (narrower as it turns away)
        const sx = 0.8 + 0.2 * Math.cos(time * f.tws + f.ph);
        const h = f.h, w = h * tex.w / tex.h * sx, y = f.rest + off;
        const ro = (f.flip ? (0.5 - ROPE[f.k]) : (ROPE[f.k] - 0.5)) * w; // the rope's point from the figure's middle
        const fog = clamp((f.z - 11) / 18, 0, 0.45);
        const lit = f.lit * (0.85 + 0.15 * Math.sin(time * 2 + f.ph));
        // a pendulum: the rope hangs from a point L above the figure (out of the frame) and swings with it
        const L = 6, px = f.x + ro, py = y + h + L;
        const ax = px + Math.sin(ang) * L, ay = py - Math.cos(ang) * L;
        stand(TX.white, px, py - L, f.z, 0.035, L + 30, [0.32 * lit, 0.03, 0.05, 1], { ang, px, py, fog });
        stand(tex, ax - ro, ay - h, f.z, w, h, [lit, lit, lit, 1], { ang, px: ax, py: ay, flip: f.flip, fog, sil: SIL });
        // a red glow behind each figure
        stand(TX.glow, ax - ro, ay - h * 1.3, f.z + 0.3, h * 1.6, h * 1.6, [0.9, 0.08, 0.1, 0.1 * lit], { add: true });
      }
      flush();
      drawParts(); flush();
    } else {
      // ================= B / C / D: the thicket and the Dark Tree =================
      gl.clearColor(0.03, 0.025, 0.06, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      fogCol = [0.07, 0.045, 0.13];
      const reveal = sm(T.b1 - 1.2, T.craneB, time);
      // the background plate, in screen space: covers the screen, its clearing kept under the tree's roots
      const bg = IMG.bg;
      if (bg) {
        const base = clipAt(0, 0, TREE.z, cam);
        const ia = bg.w / bg.h;
        let S = Math.max(2.25, (2 * aspect) / ia) * lerp(1.08, 1.0, reveal);
        let top = base[1] + S * BG_GROUND;
        top = clamp(top, 1, S - 1);
        const cx = clamp(base[0] * 0.25, -(S * ia / aspect - 2) / 2, (S * ia / aspect - 2) / 2);
        const halfW = S * ia / aspect / 2;
        const dim = lerp(0.55, 1, reveal);
        screen(bg, cx - halfW, top - S, cx + halfW, top, [dim, dim, dim, 1], { fog: lerp(0.55, 0.12, reveal) });
      }
      // mist far back
      const mistA = lerp(0.35, 0.22, reveal);
      mist(-1, TREE.z + 6, 9, 0.25, [0.55, 0.4, 0.85, mistA]);
      flush();
      // the root glow behind the tree (lights the clearing)
      const ig = sm(T.ignite, T.ignite + 0.5, time), pulse = 0.85 + 0.15 * Math.sin(time * 2.3);
      glowK = lerp(0.25, 1, ig) * pulse * (1 + 0.6 * Math.exp(-3 * Math.max(0, time - T.ignite)) * ig);
      stand(TX.glow, 0, -3.2, TREE.z + 0.5, 26, 9, [0.85, 0.2, 0.75, 0.55 * glowK], { add: true });
      // the tree
      const tree = IMG.tree;
      if (tree) {
        const d = TREE.z - cam.z, fog = clamp((d - 34) / 70, 0, 0.8);
        stand(tree, 0, -0.25, TREE.z, TREE.h * tree.w / tree.h, TREE.h, [1, 1, 1, 1], { fog, sway: 0.006 });
        flush();
        // its glow, again on top (the cracks burn), and the ring when it ignites
        stand(TX.glow, 0, -1.6, TREE.z - 0.3, 12, 3.6, [1, 0.3, 0.8, 0.32 * glowK], { add: true });
        const rt = time - T.ignite;
        if (rt > 0 && rt < 1.6) {
          const r = 2 + rt * 22, a = (1 - rt / 1.6) * 0.8;
          stand(TX.ring, 0, -r * 0.18, TREE.z - 0.2, r, r * 0.36, [1, 0.45, 0.9, a], { add: true });
        }
      }
      // ground mist in front of the roots
      mist(-1.2, TREE.z - 2, 5, 0.6, [0.6, 0.4, 0.9, 0.35]);
      mist(-1.6, TREE.z - 5, 5, -0.4, [0.5, 0.35, 0.8, 0.3]);
      flush();
      // the thicket, far to near
      for (let i = THORNS.length - 1; i >= 0; i--) {
        const t = THORNS[i], tex = IMG['thorn' + (t.k + 1)];
        if (!tex) continue;
        const d = t.z - cam.z;
        if (d < 0.35 || d > 60) continue;
        const a = clamp((d - 0.35) / 0.9, 0, 1);
        const fog = clamp((d - 6) / 30, 0, 0.85);
        const rim = 0.55 + 0.45 * glowK;
        stand(tex, t.x, -0.1, t.z, t.h * tex.w / tex.h, t.h, [t.dark * rim, t.dark * rim, t.dark * rim, a], { flip: t.flip, fog });
      }
      flush();
      drawParts(); flush();
    }
  }

  // ---------------- post: bloom + grade (postFx is shared with the story film, js/prologue.js) ----------------
  function fullQuad(p) { gl.useProgram(p.p); gl.bindVertexArray(qvao); gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLES, 0, 6); }
  // o: thr (bloom threshold), bloomK, zoom (zoom blur) + zc [u, v] (its centre), vig, fade (to black), flash [r, g, b],
  // sat (1 = full colour, 0 = grey), tint [r, g, b], impact (an anime impact frame: two flat tones) + impCol
  function postFx(o) {
    const s = fb;
    gl.useProgram(P.bright.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, s.half.f); gl.viewport(0, 0, s.half.w, s.half.h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.scene.t);
    gl.uniform1i(P.bright.u.uTex, 0); gl.uniform1f(P.bright.u.uThr, o.thr == null ? 0.42 : o.thr);
    fullQuad(P.bright);
    let src = s.half;
    for (let i = 0; i < 2; i++) {
      gl.useProgram(P.blur.p); gl.uniform1i(P.blur.u.uTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, s.qa.f); gl.viewport(0, 0, s.qa.w, s.qa.h);
      gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform2f(P.blur.u.uDir, (1 + i) / src.w, 0); fullQuad(P.blur);
      gl.bindFramebuffer(gl.FRAMEBUFFER, s.qb.f);
      gl.bindTexture(gl.TEXTURE_2D, s.qa.t); gl.uniform2f(P.blur.u.uDir, 0, (1 + i) / s.qa.h); fullQuad(P.blur);
      src = s.qb;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.useProgram(P.fin.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.scene.t);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, s.qb.t);
    const u = P.fin.u, zc = o.zc || [0.5, 0.48], fl = o.flash || [0, 0, 0], tn = o.tint || [1, 1, 1];
    gl.uniform1i(u.uScene, 0); gl.uniform1i(u.uBloom, 1);
    gl.uniform1f(u.uZoom, o.zoom || 0); gl.uniform2f(u.uZc, zc[0], zc[1]);
    gl.uniform1f(u.uBloomK, o.bloomK == null ? 0.9 : o.bloomK);
    gl.uniform1f(u.uVig, o.vig == null ? 0.85 : o.vig);
    gl.uniform1f(u.uFade, clamp(o.fade || 0, 0, 1));
    gl.uniform3f(u.uFlash, fl[0], fl[1], fl[2]);
    gl.uniform1f(u.uSat, o.sat == null ? 1 : o.sat); gl.uniform3f(u.uTint, tn[0], tn[1], tn[2]);
    const ic = o.impCol || [1, 1, 1]; gl.uniform1f(u.uImp, o.impact || 0); gl.uniform3f(u.uImpCol, ic[0], ic[1], ic[2]); gl.uniform1f(u.uImpInv, o.impInv || 0);
    gl.uniform1f(u.uTime, time); gl.uniform1f(u.uAspect, aspect); gl.uniform2f(u.uRes, W, H);
    fullQuad(P.fin);
    gl.activeTexture(gl.TEXTURE0);
  }
  function post() {
    // the rush blurs towards the middle; the cut from A to B flashes
    let fade = 1 - sm(0, T.aIn + 0.5, time);                       // in from black
    fade = Math.max(fade, sm(T.aCut - 0.25, T.aCut, time) * (time < T.b0 ? 1 : 0)); // out at the cut
    if (time >= T.b0) fade = Math.max(fade, 1 - sm(T.b0, T.b0 + 0.35, time));
    if (skipFade > 0) fade = Math.max(fade, skipFade);
    const fl = time >= T.ignite ? Math.exp(-6 * (time - T.ignite)) * 0.35 : 0;
    postFx({
      thr: time < T.b0 ? 0.62 : 0.42, // (the red figures: glow, don't burn)
      zoom: time < T.b0 ? sm(T.aCut - 0.45, T.aCut, time) * 0.12 : (1 - sm(T.b0, T.b1 - 0.8, time)) * 0.16 + 0.004,
      bloomK: time < T.b0 ? 0.75 : 0.9 + 0.5 * Math.max(0, glowK - 0.8),
      fade, flash: [fl * 0.8, fl * 0.3, fl * 0.75],
    });
  }

  // ---------------- the title: the logo, loading, the start button ----------------
  let started = false, ready = false, running = true, held = false, skipFade = 0, last = 0, playing = false;
  let story = null; // the story film (js/prologue.js) once "เริ่มเกม" is pressed: it draws instead of the title
  function gameReady() { return !document.getElementById('loading') && window.NC && NC.game && NC.game.player; }
  function ui() {
    // hold the game while the intro is up (it starts behind us)
    if (!held && gameReady()) { held = true; NC.game.paused = true; }
    ready = !!gameReady();
    root.classList.toggle('logo', time >= T.logo);
    root.classList.toggle('title', time >= T.ready);
    root.classList.toggle('ready', ready && time >= T.ready);
    root.classList.toggle('film', time < T.logo || !!story);
    if (time >= T.ready && !ready) { // still loading: the loading screen's own numbers
      const pct = document.getElementById('pl-pct'), txt = document.getElementById('pl-text');
      const n = pct ? parseInt(pct.textContent, 10) || 0 : 0;
      loadBar.style.width = n + '%';
      if (txt) loadTxt.textContent = txt.textContent;
    }
  }
  function skip() {
    if (story) { story.skip(); return; }
    if (time >= T.logo - 0.3) return;
    skipFade = 1; time = T.craneB - 0.15; glowK = 1;
    parts.length = 0;
  }
  function start() {
    if (started || !ready) return;
    started = true;
    // the story film first (a new player, or ?intro=1 / ?prologue=1), then into the game
    const P2 = window.NCPrologue;
    if (P2 && P2.wanted()) {
      story = P2.begin(KIT, finish);
      if (story) { root.classList.add('story'); return; }
    }
    finish();
  }
  function finish() {
    root.classList.add('out');
    const g = window.NC && NC.game;
    if (g) {
      // a window opened behind the intro (the character creator for a new hero) keeps the game paused
      const open = document.querySelector('.cr-root:not([hidden])') || [...document.querySelectorAll('.panel')].some((p) => !p.hidden);
      g.paused = !!open;
    }
    removeEventListener('keydown', onKey, true);
    setTimeout(() => { running = false; root.remove(); }, 1000);
  }
  function onKey(e) {
    if (root.classList.contains('out')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type !== 'keydown' || e.repeat) return;
    if (story) { if (e.key === 'Escape') story.skip(); else story.next(); return; }
    if (time >= T.ready) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') start(); }
    else skip();
  }
  addEventListener('keydown', onKey, true);
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.in-start') || e.target.closest('.in-skip')) return;
    if (story) { story.next(); return; }
    if (time < T.ready) skip(); else if (ready) start();
  });
  btn.addEventListener('click', start);
  $('.in-skip').addEventListener('click', (e) => { e.stopPropagation(); skip(); });

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    resize();
    if (story) {
      time += dt;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb.scene.f); gl.viewport(0, 0, W, H);
      story.frame(dt);
    } else if (playing) {
      time += dt;
      if (skipFade > 0) skipFade = Math.max(0, skipFade - dt * 2.2);
      if (time > T.ignite && time - dt <= T.ignite) shake = 0.25;
      emitters(dt); updParts(dt);
      shot(dt); post();
    }
    ui();
  }

  // ---------------- the kit the story film draws with (js/prologue.js) ----------------
  const KIT = {
    gl, root, TX, texFrom, canvasTex, quad, flush, stand, screen, spark, postFx, cam, clipAt, FOV, rnd, clamp, lerp, sm, eOut, eInOut,
    get W() { return W; }, get H() { return H; }, get aspect() { return aspect; }, get time() { return time; },
    setFog(c) { fogCol = c; },
    clear(r, g, b) { gl.bindFramebuffer(gl.FRAMEBUFFER, fb.scene.f); gl.viewport(0, 0, W, H); gl.clearColor(r, g, b, 1); gl.clear(gl.COLOR_BUFFER_BIT); },
  };

  // ---------------- the pictures; the film starts when they are in ----------------
  const LIST = { bg: 'bg.jpg', tree: 'tree.png' };
  for (let i = 1; i <= 6; i++) { LIST['thorn' + i] = `thorn_${i}.png`; LIST['hang' + i] = `hang_${i}.png`; }
  const loads = Object.entries(LIST).map(([k, f]) => new Promise((ok) => {
    const im = new Image();
    im.onload = () => { IMG[k] = texFrom(im); ok(); };
    im.onerror = () => { console.warn('intro: no ' + f); ok(); }; // a missing piece is left out of the film
    im.src = 'assets/intro/' + f;
  }));
  const giveUp = setTimeout(() => { if (!playing) { running = false; root.remove(); } }, 9000);
  Promise.all(loads).then(() => {
    clearTimeout(giveUp);
    if (!IMG.bg || !IMG.tree) { running = false; root.remove(); return; } // without these there is no film
    if (running) { playing = true; root.classList.add('on'); }
  });
  requestAnimationFrame(frame);
  // (tests: window.__intro.at(t) jumps the film; .step(dt) runs it by hand in a background tab)
  window.__intro = {
    at(t) { time = t; parts.length = 0; },
    step(dt) { const n = performance.now(); last = n - dt * 1000; frame(n); },
    get time() { return time; }, get playing() { return playing; }, get story() { return story; },
    start() { start(); },
  };
})();
