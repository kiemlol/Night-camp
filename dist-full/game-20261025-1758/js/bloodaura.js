/* bloodaura.js — the blood aura of the red marks (the user, 2026-10-07, in the night falcon set with a samurai blade:
   "ให้มีออร่าเลือดตรงดาบ กับชุด"; the first try, flames round the whole outline, was not it: "ออร่ามันไม่ใช่แบบนี้ มันจะเกิด
   ตามรอยสีแดงของชุด แล้วเลือดหยดๆ ... หรือจะทำ bloom"). Drawn after the night's darkness (in NC.drawTrail, like
   js/ironrage.js / js/samglow.js), so it stays bright:
     the marks  the hero is drawn again with only his RED pixels (NC.tinted '#bloodred': every crimson pixel of each part, white
                with its redness in the alpha; the blade's red edge too, not while it is in its scabbard) into a small canvas
                round him; laid back on with a bloom (blurred, additive) and a hot core, beating like a heart
     the aura   a WebGL2 shader lifts short toon wisps of blood off those marks (noise panning upward samples the mask
                below each pixel), dark crimson to a pink core
     the blood  drops gather on the lower edges of the red marks (and along the bare blade, most near the tip), hang for a
                moment, fall, and splash on the ground; a few red specks rise off the marks; a dim red light round him
   On for the night falcon set (robe_nfalcon) and the blood blades (nodachi_blood, nodachi_crimson, sw_nfalcon); ?bloodaura
   forces it on any outfit. NC.BloodAura.on = false switches it off (.drips / .wisps / .bloom one by one). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  if (!FX) return;
  const BA = (NC.BloodAura = { on: true, force: false, drips: true, wisps: true, bloom: true, marks: 0.35, bladeWisps: false });
  // how the blood follows his movement (the user, 2026-10-07: "อยากให้หยดเลือดมันตามการเคลื่อนไหวตัวด้วย เหมือนพู่กัน ...
  // ทำมาให้ผมเลือกสักสามแบบ"): 'brush' A strokes trailing off the red tips and the blade like a brush dragged through the air,
  // 'fling' B blood flung off them by the motion as stretched drops, brush-dab splats on the ground, 'strand' C strands of
  // blood hanging from them, swinging with inertia, drops pinching off their ends.
  // (OFF by default: all three draw their blood with canvas code, and the user's rule is "ห้ามวาดเอฟเฟคเองนะ" (2026-10-07);
  // the one picked gets remade from Blender / Codex pieces. Only the Blender drops show meanwhile.)
  BA.style = 'none';
  const BLADES = (BA.blades = new Set(['nodachi_blood', 'nodachi_crimson', 'sw_nfalcon']));   // (js/muramasa.js adds its blade)
  const MINE = (e) => BA.on && (BA.force || (e && (e.robe === 'robe_nfalcon' || BLADES.has(e.weapon))));
  const KEY = '#bloodred';
  // what glows FULL (the bloom and the wisps): the falcon's eye on the helm and the blade; the outfit's other red marks only
  // glow softly, with barely any wisps (the user, 2026-10-07: "ออร่าที่เป็นไฟตามหมวกกับชุดเอาออก เหลือไว้ตรงตาเหยี่ยวพอ" ->
  // "ไม่ต้องเอาออกก็ได้ แต่ลดลง"): BA.marks = how strong the rest is (0 = only the eye and the blade)
  const GLOWKEY = '#bloodeye';
  const EYE = (BA.EYE = { hat_nfalcon: [280 / 414, 158 / 335, 352 / 414, 208 / 335] });   // (the eye-slit box in each helm picture, fractions)

  // ---------------- the red of a picture: white, its redness in the alpha (cached per picture) ----------------
  const redCache = {}, EMPTY = document.createElement('canvas');
  EMPTY.width = EMPTY.height = 1;
  function redOf(name, box) {
    const ck = box ? name + '#eye' : name;
    if (redCache[ck]) return redCache[ck];
    const s = NC.SPR[name], im = s && s.img, W = im && (im.naturalWidth || im.width), Hh = im && (im.naturalHeight || im.height);
    if (!W || !Hh) return EMPTY;
    const c = document.createElement('canvas'); c.width = W; c.height = Hh;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    let d;
    try { d = x.getImageData(0, 0, W, Hh); } catch (e) { return (redCache[ck] = EMPTY); }
    const a = d.data, x0 = box ? box[0] * W : 0, y0 = box ? box[1] * Hh : 0, x1 = box ? box[2] * W : W, y1 = box ? box[3] * Hh : Hh;
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i], g = a[i + 1], b = a[i + 2], px = (i >> 2) % W, py = ((i >> 2) / W) | 0;
      const inBox = px >= x0 && px < x1 && py >= y0 && py < y1;
      const red = inBox && r > 60 && r > g * 1.5 && r > b * 1.3 ? Math.min(1, (r - Math.max(g, b)) / 90) : 0;
      a[i] = a[i + 1] = a[i + 2] = 255; a[i + 3] = a[i + 3] * red;
    }
    x.putImageData(d, 0, 0);
    return (redCache[ck] = c);
  }
  // the glow's red: the helm's eye, all of the blade's red, nothing else
  function glowOf(name) {
    if (EYE[name]) return redOf(name, EYE[name]);
    if (H.eyeOnly) return EMPTY;
    const W = H.p && NC.ITEMS[H.p.equip.weapon];
    return W && W.sprite === name ? redOf(name) : EMPTY;
  }
  const baseTinted = NC.tinted;
  NC.tinted = function (name, colour) { return colour === KEY ? redOf(name) : colour === GLOWKEY ? glowOf(name) : baseTinted.apply(this, arguments); };

  // ---------------- the hero's frame remembered while he is drawn ----------------
  const H = { on: false, p: null, shot: null, blade: null, mask: false };
  const baseDP = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game.player;
    if (!p || !MINE(p.equip) || p.dead > 0) return baseDP.apply(this, arguments);
    H.on = true; H.p = p; H.blade = null;
    try { return baseDP.apply(this, arguments); } finally { H.on = false; }
  };
  const baseDH = NC.drawHero;
  NC.drawHero = function (ctx, equip, P, x, y, o) {
    if (H.on && !H.mask && H.p && equip === H.p.equip && !(o && o.silhouette)) H.shot = { m: ctx.getTransform(), equip, P, x, y, o: o || {} };
    return baseDH.apply(this, arguments);
  };
  const baseDW = NC.drawWeapon;
  NC.drawWeapon = function (ctx, W, hx, hy, ang, o) {
    o = o || {};
    if (H.mask && (o.sheath > 0.5 || o.sayaOnly)) return;          // (a blade in its scabbard: its red stays hidden)
    if (!H.mask && H.on && H.p && W && W === NC.ITEMS[H.p.equip.weapon] && !o.silhouette && !o.sayaOnly) {
      const s = NC.SPR[W.sprite];
      if (s) {
        const m = ctx.getTransform(), k = (o.scale || 1) * 0.95, h = s.h * k, grip = o.grip === undefined ? W.grip : o.grip;
        const a = ang + Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), len = o.len === undefined ? 1 : o.len;
        const at = (ly) => { const yy = ly * len, X = hx - sa * yy, Y = hy + ca * yy; return [m.a * X + m.c * Y + m.e, m.b * X + m.d * Y + m.f]; };
        H.blade = { g: at(-h * (1 - grip) * 0.25), t: at(-h * (1 - grip) * 0.97), sheathed: o.sheath > 0.5 };
      }
    }
    return baseDW.apply(this, arguments);
  };

  // ---------------- the wisps (WebGL2) ----------------
  let gl = null, glc = null, prog = null, U = {}, tex = [], failed = false;
  const VS = `#version 300 es
in vec2 a; out vec2 v;
void main() { v = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5); gl_Position = vec4(a, 0.0, 1.0); }`;
  const FS = `#version 300 es
precision highp float;
in vec2 v; out vec4 o;
uniform sampler2D uSoft, uSharp;
uniform float uT, uBeat;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 17.17; a *= 0.5; } return s / 0.9375; }
float step2(float e, float x) { float w = fwidth(x) * 0.8 + 1e-4; return smoothstep(e - w, e + w, x); }
void main() {
  vec2 uv = v;                                               // (uv spans a fixed 340 world units round the hero)
  float n1 = fbm(vec2(uv.x * 14.0, uv.y * 3.5 + uT * 2.8));
  float n2 = fbm(vec2(uv.x * 26.0 + 3.1, uv.y * 5.0 + uT * 4.2));
  // short wisps rising off the red marks: each pixel samples the marks below it (up to ~30 world units)
  float m = texture(uSoft, uv + vec2((n1 - 0.5) * 0.03, 0.006 + 0.06 * n2 * n2)).a;
  float f = m * (0.9 + 0.5 * uBeat) * (0.35 + 1.1 * n2) * 1.6;
  float on = texture(uSharp, uv).a;
  f *= 1.0 - 0.75 * on;                                      // (the marks themselves get the hot core pass instead)
  vec3 c0 = vec3(0.24, 0.0, 0.05), c1 = vec3(0.68, 0.03, 0.12), c2 = vec3(1.0, 0.16, 0.25), c3 = vec3(1.0, 0.7, 0.75);
  float k0 = step2(0.28, f), k1 = step2(0.5, f), k2 = step2(0.8, f), k3 = step2(1.25, f);
  vec3 c = mix(mix(mix(c0, c1, k1), c2, k2), c3, k3);
  float a = k0 * mix(0.7, 1.0, k1);
  o = vec4(c * a, a);
}`;
  let glLost = 0;
  function init() {
    // (the browser took the context away - a GPU reset, out of memory; js/crashguard.js counts it): a new one, as herospine does
    if (gl && gl.isContextLost()) { gl = null; tex = []; failed = ++glLost > 3; }
    if (gl || failed) return !!gl;
    try {
      glc = document.createElement('canvas');
      gl = glc.getContext('webgl2', { premultipliedAlpha: true, alpha: true });
      if (!gl) throw new Error('no webgl2');
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const la = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
      for (const n of ['uSoft', 'uSharp', 'uT', 'uBeat']) U[n] = gl.getUniformLocation(prog, n);
      for (let i = 0; i < 2; i++) {
        const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        tex.push(t);
      }
      gl.uniform1i(U.uSoft, 0); gl.uniform1i(U.uSharp, 1);
      return true;
    } catch (e) { failed = true; gl = null; console.warn('bloodaura: wisps off', e && e.message); return false; }
  }
  BA.error = () => failed;
  const upload = (i, cv) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); };

  const mcv = document.createElement('canvas'), mc = mcv.getContext('2d', { willReadFrequently: true });   // the red marks (white)
  const scv = document.createElement('canvas'), scx = scv.getContext('2d');                                // blurred
  const tcv = document.createElement('canvas'), tc = tcv.getContext('2d');                                 // tinted
  const gcv = document.createElement('canvas'), gcx = gcv.getContext('2d');                                // what glows (eye + blade)
  // (the wisps rise off the eye only: off a drawn blade they made a flat pale-pink ribbon that read as pasted on: the
  // user, 2026-10-07: "ขัดดาบหน่อยไหม มันภาพโดดจากตัวละคร". The blade keeps its bloom; BA.bladeWisps = true brings them back)
  const ecv = document.createElement('canvas'), ecx = ecv.getContext('2d');                                // the eye alone

  function pass(ctx, game) {
    const s = H.shot;
    H.shot = null;
    if (!s) return;
    const p = H.p, m = s.m, k = Math.hypot(m.a, m.b), sc = (s.o.scale || 1) * k;
    const B = Math.ceil(340 * sc), ox = m.a * s.x + m.c * (s.y - 70) + m.e - B / 2, oy = m.b * s.x + m.d * (s.y - 70) + m.f - B / 2;
    for (const c of [mcv, scv, tcv, gcv, ecv]) if (c.width !== B) { c.width = B; c.height = B; }
    // 1. the red marks
    mc.setTransform(1, 0, 0, 1, 0, 0); mc.clearRect(0, 0, B, B);
    mc.setTransform(m.a, m.b, m.c, m.d, m.e - ox, m.f - oy);
    H.mask = true;
    gcx.setTransform(1, 0, 0, 1, 0, 0); gcx.clearRect(0, 0, B, B);
    gcx.setTransform(m.a, m.b, m.c, m.d, m.e - ox, m.f - oy);
    try {
      baseDH.call(NC, mc, s.equip, s.P, s.x, s.y, Object.assign({}, s.o, { silhouette: KEY, tint: null, alpha: 1 }));
      baseDH.call(NC, gcx, s.equip, s.P, s.x, s.y, Object.assign({}, s.o, { silhouette: GLOWKEY, tint: null, alpha: 1 }));
      H.eyeOnly = !BA.bladeWisps && !!(H.blade && !H.blade.sheathed);
      if (H.eyeOnly) {
        ecx.setTransform(1, 0, 0, 1, 0, 0); ecx.clearRect(0, 0, B, B);
        ecx.setTransform(m.a, m.b, m.c, m.d, m.e - ox, m.f - oy);
        baseDH.call(NC, ecx, s.equip, s.P, s.x, s.y, Object.assign({}, s.o, { silhouette: GLOWKEY, tint: null, alpha: 1 }));
        ecx.setTransform(1, 0, 0, 1, 0, 0);
      }
    } finally { H.mask = false; H.eyeOnly = false; }
    mc.setTransform(1, 0, 0, 1, 0, 0); gcx.setTransform(1, 0, 0, 1, 0, 0);
    const swinging = !!(p.atk && p.atk.on), t = game.time;
    const g2 = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));
    const hb = (u) => g2(u % 1, 0.08, 0.05) + 0.6 * g2(u % 1, 0.27, 0.06);   // (lub-dub)
    const beat = Math.min(1.3, hb(t * 1.15) + (swinging ? 0.5 : 0));
    // 2. the bloom: the marks tinted blood red, blurred wide, added twice; then the hot core
    tc.setTransform(1, 0, 0, 1, 0, 0); tc.globalCompositeOperation = 'copy';
    tc.globalAlpha = BA.marks; tc.drawImage(mcv, 0, 0); tc.globalAlpha = 1;
    tc.globalCompositeOperation = 'source-over'; tc.drawImage(gcv, 0, 0);
    tc.globalCompositeOperation = 'source-in'; tc.fillStyle = '#ff1a3c'; tc.fillRect(0, 0, B, B); tc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    if (BA.bloom) {
      ctx.filter = `blur(${Math.max(3, 9 * sc).toFixed(1)}px)`; ctx.globalAlpha = Math.min(1, 0.55 + 0.4 * beat); ctx.drawImage(tcv, ox, oy);
      ctx.filter = `blur(${Math.max(1.5, 3.5 * sc).toFixed(1)}px)`; ctx.globalAlpha = Math.min(1, 0.6 + 0.35 * beat); ctx.drawImage(tcv, ox, oy);
      ctx.filter = 'none';
    }
    ctx.globalAlpha = Math.min(1, 0.45 + 0.4 * beat); ctx.drawImage(tcv, ox, oy);
    ctx.restore();
    // 3. the wisps
    if (BA.wisps && init()) {
      scx.setTransform(1, 0, 0, 1, 0, 0); scx.clearRect(0, 0, B, B);
      scx.filter = `blur(${Math.max(1.2, 2.5 * sc).toFixed(1)}px)`; const wv = !BA.bladeWisps && H.blade && !H.blade.sheathed ? ecv : gcv; scx.drawImage(wv, 0, 0); scx.drawImage(wv, 0, 0); scx.globalAlpha = BA.marks * 0.6; scx.drawImage(mcv, 0, 0); scx.globalAlpha = 1; scx.filter = 'none';
      if (glc.width !== B) { glc.width = B; glc.height = B; }
      gl.viewport(0, 0, B, B);
      upload(0, scv); upload(1, !BA.bladeWisps && H.blade && !H.blade.sheathed ? ecv : gcv);
      gl.uniform1f(U.uT, t); gl.uniform1f(U.uBeat, beat);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.75; ctx.drawImage(glc, ox, oy); ctx.restore();
    }
    // 4. the blood: drops gathering on the marks' lower edges and along the bare blade; specks rising
    const toWorld = (dx, dy) => [game.cam.x + dx / game.scale, game.cam.y + dy / game.scale];
    if (t > (H.edgeT || 0)) { H.edgeT = t + 0.25; H.edges = edges(B); H.eox = ox; H.eoy = oy; }
    styles(ctx, game, p, swinging, ox, oy, B);
    if (BA.drips && BA.style !== 'strand' && t > (H.dripT || 0)) {
      H.dripT = t + (swinging ? NC.rand(0.05, 0.12) : NC.rand(0.12, 0.28));
      const b = H.blade;
      if (b && !b.sheathed && Math.random() < 0.45) {
        const u = Math.pow(Math.random(), 0.5);
        const [wx, wy] = toWorld(b.g[0] + (b.t[0] - b.g[0]) * u, b.g[1] + (b.t[1] - b.g[1]) * u);
        drip(p, wx, wy, swinging);
      } else if (H.edges && H.edges.length) {
        const e = H.edges[(Math.random() * H.edges.length) | 0];
        const [wx, wy] = toWorld(H.eox + e[0], H.eoy + e[1]);
        drip(p, wx, wy, swinging);
      }
    }
    if (t > (H.speckT || 0) && H.edges && H.edges.length) {
      H.speckT = t + (swinging ? 0.04 : 0.1);
      const e = H.edges[(Math.random() * H.edges.length) | 0];
      const [wx, wy] = toWorld(H.eox + e[0], H.eoy + e[1] - 6);
      speck(wx, wy);
    }
    light(p, beat);
  }
  // ---------------- the three ways the blood follows the motion ----------------
  // emitters: the lowest red point in six columns across him (the cape's hem, the feather tips), tracked by column, and the
  // bare blade's tip / middle; each keeps its path over the last third of a second
  const smc = document.createElement('canvas'), smx = smc.getContext('2d', { willReadFrequently: true });
  const HIST = {}, STR = {}, TRAIL_T = 0.32;
  const BL = { dark: '#4c0310', body: '#a80f25', hi: '#ff8e9c' };
  function emitters(ctx, B, ox, oy) {
    const S = 64, out = [], inv = ctx.getTransform().inverse();
    smc.width = smc.height = S; smx.clearRect(0, 0, S, S); smx.drawImage(mcv, 0, 0, S, S);
    let d;
    try { d = smx.getImageData(0, 0, S, S).data; } catch (e) { return out; }
    for (let b = 0; b < 6; b++) {
      const x0 = Math.floor(S * (0.22 + b * 0.093)), x1 = Math.floor(S * (0.22 + (b + 1) * 0.093));
      let by = -1, bx = 0;
      for (let y = S - 1; y >= 0 && by < 0; y--) for (let x = x0; x < x1; x++) if (d[(y * S + x) * 4 + 3] > 90) { by = y; bx = x; break; }
      if (by < 0) continue;
      const w = inv.transformPoint(new DOMPoint(ox + (bx + 0.5) * B / S, oy + (by + 0.5) * B / S));
      out.push({ id: 'h' + b, x: w.x, y: w.y, w: 3.2 });
    }
    const bl = H.blade;
    if (bl && !bl.sheathed) {
      const T = inv.transformPoint(new DOMPoint(bl.t[0], bl.t[1])), G = inv.transformPoint(new DOMPoint(bl.g[0], bl.g[1]));
      out.push({ id: 'bt', x: T.x, y: T.y, w: 5, blade: true });
      out.push({ id: 'bm', x: (T.x * 2 + G.x) / 3, y: (T.y * 2 + G.y) / 3, w: 3.6, blade: true });
    }
    return out;
  }
  function track(E, t) {
    const seen = new Set();
    for (const e of E) {
      seen.add(e.id);
      let h = HIST[e.id];
      if (!h) h = HIST[e.id] = [];
      const last = h[h.length - 1];
      if (last && Math.hypot(e.x - last.x, e.y - last.y) > 40) h.length = 0;          // (a jump: he turned round)
      h.push({ x: e.x, y: e.y, t });
      while (h.length && t - h[0].t > TRAIL_T) h.shift();
      e.h = h;
      const p0 = h[Math.max(0, h.length - 4)], dt = Math.max(1e-3, t - p0.t);
      e.vx = (e.x - p0.x) / dt; e.vy = (e.y - p0.y) / dt;
    }
    for (const k in HIST) if (!seen.has(k)) delete HIST[k];
  }
  function styles(ctx, game, p, swinging, ox, oy, B) {
    const t = game.time, E = emitters(ctx, B, ox, oy);
    track(E, t);
    if (BA.style === 'brush') brushStrokes(ctx, E, t);
    else if (BA.style === 'fling') fling(p, E, t, swinging);
    else if (BA.style === 'strand') strands(ctx, p, E, t, swinging);
  }
  // A: a stroke along each emitter's recent path, thick at the head, tapering and splitting into bristles at the tail
  function brushStrokes(ctx, E, t) {
    for (const e of E) {
      const h = e.h;
      if (!h || h.length < 3) continue;
      let L = 0;
      for (let i = 1; i < h.length; i++) L += Math.hypot(h[i].x - h[i - 1].x, h[i].y - h[i - 1].y);
      if (L < 6) continue;
      const W = e.w * 1.5 * Math.min(1.4, 0.6 + L / 90);
      const pts = h.map((q, i) => ({ x: q.x, y: q.y, s: i / (h.length - 1) }));    // s: 0 tail -> 1 head
      const normal = (i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let nx = -(b.y - a.y), ny = b.x - a.x;
        const d = Math.hypot(nx, ny) || 1;
        return [nx / d, ny / d];
      };
      const ribbon = (wk, off, col, alpha, s0) => {
        const L2 = [], R2 = [];
        for (let i = 0; i < pts.length; i++) {
          const s = pts[i].s;
          if (s < (s0 || 0)) continue;
          const [nx, ny] = normal(i), w = W * wk * Math.pow(s, 0.9) * (0.85 + 0.15 * Math.sin(s * 9 + t * 7));
          L2.push([pts[i].x + nx * (w + off * W), pts[i].y + ny * (w + off * W)]);
          R2.push([pts[i].x - nx * (w - off * W), pts[i].y - ny * (w - off * W)]);
        }
        if (L2.length < 2) return;
        ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.beginPath();
        ctx.moveTo(L2[0][0], L2[0][1]);
        for (const q of L2) ctx.lineTo(q[0], q[1]);
        for (let i = R2.length - 1; i >= 0; i--) ctx.lineTo(R2[i][0], R2[i][1]);
        ctx.closePath(); ctx.fill();
        const hd = pts[pts.length - 1];
        ctx.beginPath(); ctx.arc(hd.x, hd.y, W * wk, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };
      ribbon(1, 0, BL.dark, 0.9);
      ribbon(0.72, -0.08, BL.body, 0.95);
      ribbon(0.2, -0.32, BL.hi, 0.85, 0.35);
      // dry bristles at the tail
      ctx.save(); ctx.strokeStyle = BL.body; ctx.lineCap = 'round';
      for (let k = -1; k <= 1; k++) {
        ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(0.6, W * 0.22);
        ctx.beginPath();
        const m = Math.min(pts.length, Math.ceil(pts.length * 0.45));
        for (let i = 0; i < m; i++) {
          const [nx, ny] = normal(i), o = k * W * 0.5 * (1 - pts[i].s);
          if (i === 0) ctx.moveTo(pts[i].x + nx * o, pts[i].y + ny * o); else ctx.lineTo(pts[i].x + nx * o, pts[i].y + ny * o);
        }
        ctx.stroke();
      }
      ctx.restore();
      // a drop now and then flicked off the tail when it moves fast
      if (L > 30 && Math.random() < 0.12) { const tl = h[0]; flung(tl.x, tl.y, e.vx * 0.15, e.vy * 0.15 - 40, e.w * 0.6); }
    }
  }
  // B: blood flung off by the motion: stretched glossy drops, brush-dab splats where they land
  function fling(p, E, t, swinging) {
    for (const e of E) {
      const sp = Math.hypot(e.vx || 0, e.vy || 0);
      const rate = (sp > 60 ? sp / 16 : 0) + (swinging && e.blade ? 24 : 0);
      if (Math.random() < rate / 60) {
        const k = e.blade ? 0.55 : 0.4;
        flung(e.x, e.y, (e.vx || 0) * k + NC.rand(-30, 30), (e.vy || 0) * k - NC.rand(20, 70), e.w * NC.rand(0.5, 0.8), p.y + NC.rand(-4, 10));
      }
    }
  }
  function flung(x, y, vx, vy, r, ground) {
    if (ground === undefined) ground = H.p ? H.p.y + NC.rand(-4, 10) : y + 60;
    FX.add({ type: 'custom', layer: 'glow', x, y, vx, vy, grav: 900, drag: 0.4, life: 3, r, hit: 0,
      update(q) { if (!q.hit && q.y >= ground && q.vy > 0) { q.hit = q.t; q.hvx = q.vx; q.vx = q.vy = 0; q.grav = 0; q.y = ground; q.life = q.t + 1.3; } },
      draw(ctx, q) {
        if (!q.hit) {
          const sp = Math.hypot(q.vx, q.vy), a = Math.atan2(q.vy, q.vx), st = 1 + Math.min(3, sp / 160);
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(a); ctx.scale(st, 1 / Math.sqrt(st));
          ctx.fillStyle = BL.dark; ctx.beginPath(); ctx.arc(0, 0, q.r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = BL.body; ctx.beginPath(); ctx.arc(-q.r * 0.08, -q.r * 0.08, q.r * 0.78, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = BL.hi; ctx.beginPath(); ctx.arc(q.r * 0.25, -q.r * 0.35, q.r * 0.25, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else {
          const u = (q.t - q.hit) / 1.3, a = 1 - u * u, dir = Math.sign(q.hvx || 1), L = q.r * (1.8 + Math.min(1.4, Math.abs(q.hvx || 0) / 120));
          ctx.save(); ctx.globalAlpha = a; ctx.translate(q.x, q.y); ctx.scale(1, 0.42);
          ctx.fillStyle = BL.dark; ctx.beginPath(); ctx.ellipse(dir * L * 0.4, 0, L, q.r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = BL.body; ctx.beginPath(); ctx.ellipse(dir * L * 0.35, -q.r * 0.15, L * 0.8, q.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(dir * (L * 1.5 + i * q.r * 1.6), (i - 1) * q.r * 0.9, q.r * (0.45 - i * 0.1), 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = BL.hi; ctx.globalAlpha = a * 0.6; ctx.beginPath(); ctx.ellipse(dir * L * 0.2, -q.r * 0.45, L * 0.35, q.r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      } });
  }
  // C: strands of blood hanging off the red tips and the blade, swinging with inertia (verlet), drops pinching off the ends
  function strands(ctx, p, E, t, swinging) {
    const keep = new Set();
    for (const e of E) {
      if (!(e.blade ? e.id === 'bt' : /h[1-4]/.test(e.id))) continue;
      keep.add(e.id);
      let S = STR[e.id];
      const n = 6, seg = e.blade ? 4.6 : 6;
      if (!S) S = STR[e.id] = { pts: Array.from({ length: n }, (_, i) => ({ x: e.x, y: e.y + i * seg, px: e.x, py: e.y + i * seg })), grow: 1, next: t + NC.rand(0.6, 1.4), lastT: t };
      const dt = Math.min(0.033, Math.max(0.001, t - S.lastT));
      S.lastT = t;
      S.grow = Math.min(1, S.grow + dt * 1.6);
      const P = S.pts, L = seg * (0.35 + 0.65 * S.grow);
      P[0].x = e.x; P[0].y = e.y; P[0].px = e.x; P[0].py = e.y;
      for (let i = 1; i < n; i++) {                                   // inertia + gravity (verlet)
        const q = P[i], vx = (q.x - q.px) * 0.93, vy = (q.y - q.py) * 0.93;
        q.px = q.x; q.py = q.y; q.x += vx; q.y += vy + 700 * dt * dt;
      }
      for (let it = 0; it < 4; it++) for (let i = 1; i < n; i++) {    // keep each link its length
        const a = P[i - 1], b = P[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, k = (d - L) / d;
        if (i === 1) { b.x -= dx * k; b.y -= dy * k; } else { a.x += dx * k * 0.5; a.y += dy * k * 0.5; b.x -= dx * k * 0.5; b.y -= dy * k * 0.5; }
      }
      // a drop lets go of the end (sooner when he moves or swings)
      const sp = Math.hypot(e.vx || 0, e.vy || 0);
      if (t > S.next) {
        S.next = t + (swinging || sp > 80 ? NC.rand(0.25, 0.6) : NC.rand(0.9, 1.8));
        const end = P[n - 1];
        flung(end.x, end.y, (end.x - end.px) * 30, Math.max(0, (end.y - end.py) * 30), e.w * 0.62, p.y + NC.rand(-4, 10));
        S.grow = 0.2;
      }
      // the strand: a glossy tapered tube with a bead at its end
      for (const [wk, col, off] of [[1, BL.dark, 0], [0.7, BL.body, -0.15], [0.22, BL.hi, -0.45]]) {
        ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 1; i < n; i++) {
          const w = e.w * (1 - 0.45 * i / n) * wk;
          ctx.lineWidth = Math.max(0.6, w * 2.0);
          ctx.beginPath(); ctx.moveTo(P[i - 1].x + off * w, P[i - 1].y); ctx.lineTo(P[i].x + off * w, P[i].y); ctx.stroke();
        }
        const end = P[n - 1], br = e.w * 1.25 * (0.75 + 0.25 * S.grow) * wk;
        ctx.beginPath(); ctx.arc(end.x + off * br, end.y + br * 0.4, br, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    for (const k in STR) if (!keep.has(k)) delete STR[k];
  }

  // the lower edges of the red marks: a red pixel with no red just below it (where a drop gathers)
  function edges(B) {
    let d;
    try { d = mc.getImageData(0, 0, B, B).data; } catch (e) { return []; }
    const out = [], st = 2, dn = 3;
    for (let y = 0; y < B - dn; y += st) for (let x = 0; x < B; x += st) {
      if (d[(y * B + x) * 4 + 3] > 150 && d[((y + dn) * B + x) * 4 + 3] < 40) out.push([x, y]);
    }
    return out;
  }
  const baseTrail = NC.drawTrail;
  NC.drawTrail = function (ctx, game) {
    if (H.shot) pass(ctx, game);
    return baseTrail.apply(this, arguments);
  };

  // ---------------- the drops: glossy 3D blood from Blender (tools/blender/blood_drops.py → assets/vfx3d/blood) ----------------
  // (the user, 2026-10-07: the first, drawn drops "ดูใช้ขอบแบบวาดหนักเกินไป ใช้เป็น blender ทำ vfx ได้ไหม")
  // strips: form (10 frames: gathering under a point, letting go), fall (4: stretched, wobbling), splash (14: a crown round a
  // spreading pool); anchors in px from meta.json; BA.dropSize = world units per Blender unit
  const DM = { form: { w: 96, h: 160, n: 10, ax: 48, ay: 35.2, bu: 1.6 }, fall: { w: 64, h: 112, n: 4, ax: 32, ay: 56, bu: 1.0 },
    splash: { w: 256, h: 192, n: 14, ax: 128, ay: 116, bu: 2.6 } };
  const DI = {};
  for (const n in DM) { DI[n] = new Image(); DI[n].src = 'assets/vfx3d/blood/' + n + '.webp'; }
  BA.dropSize = 13;
  const dok = (n) => DI[n].complete && DI[n].naturalWidth > 0;
  function strip(ctx, n, f, x, y, size, a, sy) {
    const m = DM[n];
    if (!dok(n) || a <= 0.01) return;
    const k = size * m.bu / m.w;                                    // (world units per frame px)
    f = Math.max(0, Math.min(m.n - 1, f | 0));
    ctx.save(); ctx.globalAlpha *= Math.min(1, a); ctx.translate(x, y); if (sy) ctx.scale(1 / Math.sqrt(sy), sy);
    ctx.drawImage(DI[n], f * m.w, 0, m.w, m.h, -m.ax * k, -m.ay * k, m.w * k, m.h * k);
    ctx.restore();
  }
  // a drop: gathers on the spot (riding along with the hero), lets go, falls, splashes, the pool fades
  function drip(p, x, y, quick) {
    const ox = x - p.x, oy = y - p.y, ground = p.y + NC.rand(-3, 9), size = BA.dropSize * NC.rand(0.8, 1.25), grow = quick ? 0.12 : NC.rand(0.35, 0.6);
    FX.add({ type: 'custom', layer: 'glow', x, y, life: 4, hit: 0, fall: 0,
      update(q, dt) {
        if (q.t < grow) { q.x = p.x + ox; q.y = p.y + oy; return; }               // (still clinging to the armour)
        if (!q.fall) { q.fall = q.t; q.x = p.x + ox; q.y = p.y + oy + size * 0.62; q.vx = (p.vx || 0) * 0.3; q.vy = 30; q.grav = 900; }
        if (!q.hit && q.y >= ground) { q.hit = q.t; q.vx = q.vy = 0; q.grav = 0; q.y = ground; q.life = q.t + 1.4; }
      },
      draw(ctx, q) {
        if (!q.fall) strip(ctx, 'form', (q.t / grow) * 9, q.x, q.y, size, 1);
        else if (!q.hit) strip(ctx, 'fall', (q.t * 20) % 4, q.x, q.y, size, 1, Math.min(1.5, 1 + (q.vy || 0) / 900));
        else {
          const u = q.t - q.hit;
          strip(ctx, 'splash', u * 30, q.x, q.y, size * 0.85, u < 0.6 ? 1 : Math.max(0, 1 - (u - 0.6) / 0.8));
        }
      } });
  }
  function speck(x, y) {
    FX.add({ type: 'custom', layer: 'glow', x, y, life: NC.rand(0.5, 0.9), vx: NC.rand(-8, 8), vy: -NC.rand(25, 55), drag: 0.8, r: NC.rand(0.9, 1.7),
      draw(ctx, q, u) {
        ctx.save(); ctx.globalAlpha = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8; ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#ff3550'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } });
  }
  let L = null;
  function light(p, beat) {
    if (!L || !FX.lights.includes(L)) { L = { x: p.x, y: p.y - 40, r: 130, rgb: '255,30,50', a: 0, life: 0.5, t: 0, follow: p, oy: -40 }; FX.lights.push(L); }
    L.a = 0.18 + 0.2 * Math.min(1, beat); L.t = 0.05;
  }
})();
