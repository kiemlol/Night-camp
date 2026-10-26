/* poselib.js — poses and animations made in the Pose Studio (studio/, run tools/studio_serve.mjs) come into the game.

   The studio saves js/poselib_data.js: NC.POSE_LIB = { id: clip, ... }. A studio clip is a list of POSE KEYS, each one
   the whole body at a moment (every channel of anim.js's pose), with the curve to the next key:
     { name, kind: 'attack' | 'pose' | 'loop' | 'walk', dur, aim, hit, lunge, walkClip, runClip,
       keys: [{ t, curve, P: { channel: value } }] }
   Here it becomes an anim.js clip 'studio:<id>' (channel -> [[t, value, curve]]), keyed only on the channels the
   studio actually moved, so the rest keep following the stance underneath (legs keep walking under an attack):
   - attack: has a hit event, swing trail, lunge and phases -> a combo clip
   - pose:   plays once over the idle (an emote, a cheer: a fidget)
   - loop:   a stance / idle style (a BASE animation; walkClip / runClip: the walk and run it moves with)
   - walk:   a walk or run cycle that follows the hero's steps
   aim: the arms and weapon turn with where the attack is aimed (like anim.js's A(n) keys). */
(function () {
  'use strict';
  const NC = window.NC;
  const TAU = Math.PI * 2;
  const AIMED = { aF: 1, aB: 1, wAng: 1 };
  const id = (k) => 'studio:' + k;

  // the channels a clip moves: any that is not the same in every key
  function movedChannels(data) {
    const ks = data.keys || [], out = [];
    if (!ks.length) return out;
    const all = new Set();
    for (const k of ks) for (const ch in k.P) all.add(ch);
    for (const ch of all) {
      const v0 = ks[0].P[ch];
      if (data.keys.length === 1 || (data.channels && data.channels.includes(ch)) || ks.some((k) => Math.abs((k.P[ch] ?? v0) - v0) > 1e-4)) out.push(ch);
    }
    return out;
  }

  // studio clip -> anim.js clip
  function toClip(data) {
    // a one-shot hold (data.shot: the user poses one picture): its first key, held; loopBase brings it to life
    const ks = (data.keys || []).slice().sort((a, b) => a.t - b.t).slice(0, data.shot && data.kind === 'loop' ? 1 : undefined);
    const loop = data.kind === 'loop' || data.kind === 'walk';
    // a loop plays over the bare setup pose, not over a stance: it keys every channel its keys have
    const chans = data.channels && data.channels.length ? data.channels
      : loop ? [...new Set(ks.flatMap((k) => Object.keys(k.P)))] : movedChannels(data);
    const keys = {};
    for (const ch of chans) {
      const aim = data.aim && AIMED[ch];
      const v = (x) => (aim ? (c) => c.al + x : x);
      const list = ks.filter((k) => k.P[ch] !== undefined).map((k) => [k.t, v(k.P[ch]), k.curve || 'inout']);
      // a loop runs back into its first key at the end
      if (loop && list.length && list[list.length - 1][0] < data.dur - 1e-4) list.push([data.dur, list[0][1]]);
      if (list.length) keys[ch] = list;
    }
    const clip = { dur: data.dur, keys, studio: true, in: data.in ?? (data.kind === 'attack' ? 0.035 : 0.12), out: data.out ?? (data.kind === 'attack' ? 0.12 : 0.2), inCurve: 'inout' };
    if (data.shot && data.kind === 'loop') clip.shot = true;
    if (data.kind === 'attack') {
      const hit = NC.clamp(data.hit ?? data.dur * 0.4, 0.02, data.dur - 0.01);
      const s0 = Math.max(0, hit - 0.05), f1 = Math.min(data.dur, hit + 0.1);
      clip.ev = [[hit, 'hit']];
      clip.trail = [Math.max(0, hit - 0.08), Math.min(data.dur, hit + 0.06)];
      clip.lunge = [[s0, 0], [hit + 0.02, data.lunge || 0]];
      clip.cancel = Math.min(data.dur - 0.02, hit + 0.1);
      clip.phases = [[0, s0, 'a'], [s0, hit + 0.02, 's'], [hit + 0.02, f1, 'f'], [f1, data.dur, 'r']];
      if (data.finisher) clip.finisher = true;
    }
    if (data.kind === 'pose') clip.fidget = true;
    return clip;
  }

  function sampleCh(list, t, c) {
    const val = (x) => (typeof x === 'function' ? x(c) : x);
    if (t <= list[0][0]) return val(list[0][1]);
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1];
      if (t < b[0]) return NC.lerp(val(a[1]), val(b[1]), NC.Anim.CURVE[a[2] || 'inout']((t - a[0]) / (b[0] - a[0])));
    }
    return val(list[list.length - 1][1]);
  }

  // a one-shot hold comes alive like the game's own stances (anim.js idleLow): it breathes, the head bobs a beat late,
  // the weight sways slowly, the arms (and what they hold) rise and fall a little
  function alive(t, P) {
    const br = Math.sin((TAU * t) / 3.4), late = Math.sin((TAU * (t - 0.4)) / 3.4), sway = Math.sin((TAU * t) / 6.8);
    P.breathe = (P.breathe || 1) * (1 + 0.022 * br);
    P.headY = (P.headY || 0) - 0.7 * late;
    P.head = (P.head || 0) + 0.015 * sway;
    P.lean = (P.lean || 0) + 0.012 * br;
    P.x = (P.x || 0) + 0.6 * sway;
    P.kF = (P.kF || 0) + 0.02 * sway; P.kB = (P.kB || 0) + 0.03 * sway;
    P.aF = (P.aF || 0) + 0.03 * br; P.aB = (P.aB || 0) + 0.03 * late;
    P.wAng = (P.wAng || 0) + 0.012 * br;
  }
  NC.poseAlive = alive;
  // a looping clip as a base animation (walks follow the hero's steps: one cycle = one stride pair)
  function loopBase(name, steps) {
    return (t, c, P) => {
      const clip = NC.Anim.CLIPS[name];
      if (!clip) return;
      let u;
      if (steps) { const ph = ((c.walk || 0) / TAU) % 1; u = (ph < 0 ? ph + 1 : ph) * clip.dur; }
      else u = t % clip.dur;
      for (const ch in clip.keys) P[ch] = sampleCh(clip.keys[ch], u, c);
      if (clip.shot) alive(t, P);
      // a studio pose says itself where the weapon goes (ถือด้วยมือหลัง = behind the body, อาวุธหลังหัว = behind the
      // head, neither = in front): a weapon that otherwise rests behind the body (W.behind: the greatswords, the great
      // axe, the scythe) follows the pose too (the user, 2026-09-28: a greatsword held in front)
      P.wBehind = false;
    };
  }

  // (re)register one studio clip in anim.js; returns its clip name
  function register(key, data) {
    const A = NC.Anim, name = id(key);
    A.addClip(name, toClip(data));
    delete A.BASE[name];
    if (data.kind === 'loop' || data.kind === 'walk') A.BASE[name] = loopBase(name, data.kind === 'walk');
    if (data.kind === 'loop') {
      if (!A.IDLES.includes(name)) A.IDLES.push(name);
      if (!A.FIDGETS[name]) A.FIDGETS[name] = ['fidgetLook'];
      if (data.walkClip) A.WALKS[name] = id(data.walkClip); else delete A.WALKS[name];
      if (data.runClip) A.RUNS[name] = id(data.runClip); else delete A.RUNS[name];
    }
    return name;
  }

  function registerAll(lib) {
    for (const k in lib || {}) { try { register(k, lib[k]); } catch (e) { console.warn('poselib: bad clip', k, e); } }
  }
  registerAll(NC.POSE_LIB);

  // ---------------- a weapon's own holds (the studio's "ท่ายืนถืออาวุธ" / "ท่าวิ่งถืออาวุธ") ----------------
  // A loop clip made for a weapon (data.weapon) and marked weaponIdle is how that weapon is held standing around, by
  // default: it goes in the weapon's signature moves (W.sig.idle; a hero's moves.sig = false turns it off), for the
  // item itself and for every weapon of the same type that has no hold of its own. A walk-kind clip marked weaponRun
  // is its run. Walking keeps the hold's upper body over walking legs; a hold without a run clip runs the usual way.
  const LEGS = new Set(['legF', 'kF', 'legB', 'kB', 'y', 'headY', 'x']);
  const A = NC.Anim;
  const baseSig = {};
  function holdWalk(name) {
    return (t, c, P) => {
      A.BASE.walk(t, Object.assign({}, c, { idleStyle: 'idle' }), P);
      const Q = A.setup(c), clip = A.CLIPS[name];
      A.BASE[name](t, c, Q);
      if (clip) for (const ch in clip.keys) if (!LEGS.has(ch)) P[ch] = Q[ch];
      P.wBehind = Q.wBehind;
    };
  }
  // running with a one-shot hold: the run's legs, bob and lean, the hold's arms and weapon
  const RUN_BODY = new Set(['legF', 'kF', 'legB', 'kB', 'y', 'headY', 'x', 'lean', 'rot', 'head']);
  function holdRun(name) {
    return (t, c, P) => {
      A.BASE.run(t, Object.assign({}, c, { idleStyle: 'idle' }), P);
      const Q = A.setup(c), clip = A.CLIPS[name];
      A.BASE[name](t, c, Q);
      if (clip) for (const ch in clip.keys) if (!RUN_BODY.has(ch)) P[ch] = Q[ch];
      P.wBehind = Q.wBehind;
    };
  }
  function applyWeaponHolds() {
    const lib = NC.POSE_LIB || {}, idle = {}, run = {};
    for (const k in lib) {
      const d = lib[k];
      if (!d.weapon || !NC.ITEMS[d.weapon]) continue;
      if (d.kind === 'loop' && d.weaponIdle) idle[d.weapon] = id(k);
      if (d.kind === 'walk' && d.weaponRun) run[d.weapon] = id(k);
    }
    const typeOf = (W) => (NC.wtypeOf ? NC.wtypeOf(W) : W.sprite);
    const byType = (map) => { const o = {}; for (const w in map) { const t = typeOf(NC.ITEMS[w]); if (!(t in o)) o[t] = map[w]; } return o; };
    const idleT = byType(idle), runT = byType(run);
    for (const w in NC.ITEMS) {
      const W = NC.ITEMS[w];
      if (W.slot !== 'weapon') continue;
      if (!(w in baseSig)) baseSig[w] = W.sig || null;
      const t = typeOf(W), hold = idle[w] || idleT[t];
      if (!hold) { if (baseSig[w]) W.sig = baseSig[w]; else delete W.sig; continue; }
      W.sig = Object.assign({}, baseSig[w] || {}, { idle: hold });
      const r = run[w] || runT[t], clipH = A.CLIPS[hold];
      if (r) A.RUNS[hold] = r;
      else if (clipH && clipH.shot) { A.BASE[hold + ':run'] = holdRun(hold); A.RUNS[hold] = hold + ':run'; } // (the user poses one picture: the rest is made)
      if (!A.WALKS[hold] || /:walk$/.test(A.WALKS[hold])) { A.BASE[hold + ':walk'] = holdWalk(hold); A.WALKS[hold] = hold + ':walk'; }
    }
  }
  // (every weapon exists by the time the game loads its art: jobs3, class3 add theirs after this file)
  const loadAssets0 = NC.loadAssets;
  NC.loadAssets = function () {
    try { applyWeaponHolds(); } catch (e) { console.warn('poselib: weapon holds', e); } // (never stops the game loading)
    return loadAssets0.apply(this, arguments);
  };

  NC.PoseLib = { toClip, register, registerAll, movedChannels, loopBase, id, applyWeaponHolds, holdWalk, holdRun };
})();
