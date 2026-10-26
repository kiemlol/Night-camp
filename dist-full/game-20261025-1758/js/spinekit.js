/* spinekit.js — reads a Spine 3.7 skeleton export (JSON) and retargets its animations onto the hero's rig.

   A Spine skeleton is a tree of bones; an animation is a set of timelines that key each bone's rotation, translation
   and scale over time (linear, stepped or bezier curves). Sampling one at time t gives every bone's world transform.
   The template kit is drawn the same way as our hero: a 3/4 view facing right, the far shoulder in front.
   Its bones map onto our pose channels by DIRECTION (angles copy over whatever the proportions are):
     main (hip)            -> x (lunges), y (only when both feet leave the ground: jumps)
     body                  -> lean                    head        -> head
     handL / armL + weapon -> aB / eB / wAng  (the kit's far arm holds the weapon: so does ours, wFar = 1, and it is
                                              drawn behind the body like in the kit, so a raised sword never hides the face)
     handR / armR          -> aF / eF         (the kit's shield arm, in front, becomes the free near arm)
     legR / bootR          -> legF / kF (near leg)      legL / bootL -> legB / kB (far leg)
   Angles: Spine is y-up and counter-clockwise in degrees; the rig is y-down, clockwise in radians. */
(function () {
  'use strict';
  const NC = window.NC;
  const D2R = Math.PI / 180;

  // ---------------- a small Spine 3.7 JSON runtime: setup pose, timelines, world transforms ----------------
  function load(json) {
    const bones = json.bones.map((b) => ({
      name: b.name, parent: b.parent || null, x: b.x || 0, y: b.y || 0, rotation: b.rotation || 0,
      scaleX: b.scaleX === undefined ? 1 : b.scaleX, scaleY: b.scaleY === undefined ? 1 : b.scaleY,
      shearX: b.shearX || 0, shearY: b.shearY || 0, length: b.length || 0,
    }));
    const index = {};
    bones.forEach((b, i) => { index[b.name] = i; });
    for (const b of bones) b.pi = b.parent ? index[b.parent] : -1;
    return { bones, index, animations: json.animations || {}, slots: json.slots || [], skins: json.skins || {}, json };
  }

  // how far between two keys a value is, through the key's curve (Spine 3.7: linear, "stepped", or a cubic bezier)
  function curveAt(curve, u) {
    if (!curve) return u;
    if (curve === 'stepped') return 0;
    if (Array.isArray(curve)) {
      const [x1, y1, x2, y2] = curve;
      // solve x(s) = u for the bezier parameter s, then return y(s)
      let lo = 0, hi = 1, s = u;
      for (let i = 0; i < 24; i++) {
        s = (lo + hi) / 2;
        const x = 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s;
        if (x < u) lo = s; else hi = s;
      }
      return 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
    }
    return u;
  }

  // value of a timeline at t: `get(key)` returns the key's numbers, `mix(a, b, u)` blends them
  function sampleLine(frames, t, get, mix) {
    if (!frames || !frames.length) return null;
    if (t <= frames[0].time) return get(frames[0]);
    for (let i = 0; i < frames.length - 1; i++) {
      const a = frames[i], b = frames[i + 1];
      if (t < b.time) return mix(get(a), get(b), curveAt(a.curve, (t - a.time) / (b.time - a.time || 1)));
    }
    return get(frames[frames.length - 1]);
  }
  const wrapDeg = (d) => d - 360 * Math.round(d / 360);

  // local transforms of every bone at time t of an animation (setup pose + the animation's offsets)
  function pose(sk, anim, t) {
    const A = (anim && sk.animations[anim] && sk.animations[anim].bones) || {};
    return sk.bones.map((b) => {
      const tl = A[b.name] || {};
      const r = sampleLine(tl.rotate, t, (k) => k.angle || 0, (p, q, u) => p + wrapDeg(q - p) * u);
      const tr = sampleLine(tl.translate, t, (k) => [k.x || 0, k.y || 0], (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]);
      const sc = sampleLine(tl.scale, t, (k) => [k.x === undefined ? 1 : k.x, k.y === undefined ? 1 : k.y], (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]);
      return {
        x: b.x + (tr ? tr[0] : 0), y: b.y + (tr ? tr[1] : 0), rotation: b.rotation + (r || 0),
        scaleX: b.scaleX * (sc ? sc[0] : 1), scaleY: b.scaleY * (sc ? sc[1] : 1), shearX: b.shearX, shearY: b.shearY,
      };
    });
  }

  // world transforms (y up): a b / c d matrix, position, and the bone's direction in degrees
  function world(sk, local) {
    const W = [];
    sk.bones.forEach((b, i) => {
      const L = local[i];
      const la = Math.cos((L.rotation + L.shearX) * D2R) * L.scaleX, lb = Math.cos((L.rotation + 90 + L.shearY) * D2R) * L.scaleY;
      const lc = Math.sin((L.rotation + L.shearX) * D2R) * L.scaleX, ld = Math.sin((L.rotation + 90 + L.shearY) * D2R) * L.scaleY;
      if (b.pi < 0) { W.push({ a: la, b: lb, c: lc, d: ld, x: L.x, y: L.y }); return; }
      const P = W[b.pi];
      W.push({
        a: P.a * la + P.b * lc, b: P.a * lb + P.b * ld, c: P.c * la + P.d * lc, d: P.c * lb + P.d * ld,
        x: P.a * L.x + P.b * L.y + P.x, y: P.c * L.x + P.d * L.y + P.y,
      });
    });
    for (const w of W) w.rot = Math.atan2(w.c, w.a) / D2R;
    return W;
  }

  function duration(sk, anim) {
    const A = sk.animations[anim];
    if (A && A.duration !== undefined) return A.duration; // imported kits store it (unmoving timelines are dropped)
    let d = 0;
    const scan = (o) => {
      if (Array.isArray(o)) o.forEach(scan);
      else if (o && typeof o === 'object') for (const k in o) { if (k === 'time') d = Math.max(d, o[k]); else scan(o[k]); }
    };
    scan(sk.animations[anim]);
    return d;
  }

  // ---------------- retargeting: the kit's bones -> the rig's pose channels ----------------
  // which kit bone drives which part of the rig; k = kit units -> rig units (hip heights 95 vs 36)
  const MAP = {
    hip: 'main', body: 'body', head: 'head', weapon: 'weapon',
    armF: ['handR', 'armR'], armB: ['handL', 'armL'], legF: ['legR', 'bootR'], legB: ['legL', 'bootL'], k: 0.375,
  };
  const wrapR = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // the kit's feet: where the boots end (a little past the bone, where the sole is)
  function footY(sk, W, name) {
    const i = sk.index[name], w = W[i], L = sk.bones[i].length * 1.1;
    return w.y + w.c * L;
  }

  function retarget(sk, W, map) {
    const m = map || MAP, I = sk.index;
    const dir = (n) => -W[I[n]].rot * D2R; // a bone's direction in the rig's frame (y down, clockwise)
    if (!sk.rest) {
      const W0 = world(sk, pose(sk, null, 0));
      sk.rest = { hipX: W0[I[m.hip]].x, foot: Math.min(footY(sk, W0, m.legF[1]), footY(sk, W0, m.legB[1])) };
    }
    const P = {};
    P.lean = wrapR(dir(m.body) + Math.PI / 2); // the body bone points up; leaning forward turns it clockwise
    P.head = wrapR(dir(m.head) + Math.PI / 2) - 0.45 * P.lean; // the rig tilts the head with the torso already
    P.aF = dir(m.armF[0]); P.eF = wrapR(P.aF - dir(m.armF[1]));
    P.aB = dir(m.armB[0]); P.eB = wrapR(P.aB - dir(m.armB[1]));
    P.wAng = dir(m.weapon);
    P.legF = wrapR(Math.PI / 2 - dir(m.legF[0])); P.kF = Math.max(-0.02, wrapR(dir(m.legF[1]) - dir(m.legF[0])));
    P.legB = wrapR(Math.PI / 2 - dir(m.legB[0])); P.kB = Math.max(-0.02, wrapR(dir(m.legB[1]) - dir(m.legB[0])));
    P.x = (W[I[m.hip]].x - sk.rest.hipX) * m.k;
    // off the ground only when the lower foot leaves it (a crouch is already made by the leg angles + grounding)
    const lift = Math.min(footY(sk, W, m.legF[1]), footY(sk, W, m.legB[1])) - sk.rest.foot;
    P.y = lift > 2 ? -lift * m.k : 0;
    return P;
  }

  // bake a kit animation into a clip for anim.js: every channel keyed at `fps`, angles unwrapped so they turn the
  // short way between samples. `aim`: attacks follow the aim (arm + weapon turn with it).
  const ANGLES = ['aF', 'aB', 'wAng', 'lean', 'head', 'eF', 'eB', 'legF', 'legB', 'kF', 'kB'];
  function bake(sk, anim, opts) {
    const o = opts || {}, fps = o.fps || 30, dur = duration(sk, anim) || 1 / fps;
    const n = Math.max(1, Math.round(dur * fps)), samples = [];
    const m = o.map || MAP, wi = sk.index[m.weapon], wl = sk.bones[wi].length;
    for (let i = 0; i <= n; i++) {
      const t = (dur * i) / n, W = world(sk, pose(sk, anim, t)), w = W[wi];
      // + where the weapon's tip is (kit units, y up): attacks find their hit moment from how it moves
      samples.push({ t, P: retarget(sk, W, m), tip: [w.x + w.a * wl, w.y + w.c * wl] });
    }
    for (const ch of ANGLES)
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1].P[ch], b = samples[i].P[ch];
        samples[i].P[ch] = a + wrapR(b - a);
      }
    const keys = {};
    for (const ch of Object.keys(samples[0].P)) {
      keys[ch] = samples.map(({ t, P }) => {
        const v = P[ch];
        return [t, o.aim && (ch === 'aB' || ch === 'wAng') ? (c) => c.al + v : v, 'lin'];
      });
    }
    return { dur, keys, samples };
  }

  NC.SpineKit = { load, pose, world, duration, curveAt, retarget, bake, MAP };
})();
