/* anim.js — keyframed bone animation for the hero, done the way Spine / DragonBones animators work.

   Research notes this follows (sources in README):
   - An attack is ANTICIPATION (wind-up, the slowest part) -> ACTION/STRIKE (the fastest part, the hit happens here)
     -> FOLLOW-THROUGH (the motion carries on past the target) -> RECOVERY (hold the over-extended pose, then pop back
     quickly). Vary the timing: slow anticipation, very fast strike, medium recovery. Block the key poses first.
   - The body leads the weapon: hips/torso lean and step in before the arm finishes; heavy weapons use both hands.
   - Hit events are placed on the contact key (damage, sound, VFX at the same moment); hit-stop freezes 1-4 frames.
   - Idle is a 2-4 s loop: slow breathing (chest + shoulders), head that follows the breath a little late, a slow
     weight shift and an asymmetric stance. Occasional fidgets break the loop.
   - Combat idle: wider and lower stance with bent knees, torso leaning forward, weapon up and pointed at the enemy,
     the other arm up as a guard, faster breathing and a small bounce.
   - Animations crossfade ("mix duration" 0.1-0.2 s) and are layered: locomotion on one track, attacks on a track
     above that overrides only the bones it keys (legs keep walking while the arms attack).

   A POSE is the value of every bone channel in the rig's own frame (facing right; angles in radians, 0 = forward,
   +PI/2 = down):
     x, y        body offset (y < 0 lifts the feet off the ground: jumps)     rot   whole-body rotation (falls)
     lean        torso rotation around the pelvis (+ = forward)             breathe, sq   torso / body stretch
     head, headY head rotation and bob
     aF, aB      near / far upper-arm direction        eF, eB   elbow flexion (0 = straight)
     legF, legB  thigh swing (+ = forward)              kF, kB   knee flexion
     wAng        weapon direction   wPush  shift along it   tuck  1 = weapon at the belt   ik  far hand on the weapon
     fade        opacity
     hk, hx, hy  IK: the near hand onto a spot of the body (hx, hy from the pelvis)    bk, bx, by  same, far hand
     plant, pX, pY, pG     the near hand held at a fixed spot (pX, pY from the feet): a weapon standing in the ground,
                 buried below the line y = pG
     gAdj        slide the hand along the handle    wz  1 = weapon drawn behind the head    turn  spin (a paper turn)
     wFar        1 = the weapon is in the far hand, behind the body (how animation templates hold it)
     wLen        the weapon's drawn length (1; less = foreshortened, a blade swinging past the body towards the camera)
     pull        a bow's string drawn back to the near hand (0 = straight, 1 = full draw)
     wHide       1 = the weapon is put away (not drawn): standing around, until it is drawn to attack
     wSheath     1 = the blade is in its scabbard (the knight holding his sword at his side)
     aBack       1 = the near arm (and what it holds) is drawn behind the head: a hand raised overhead. A chibi's arm is
                 too short to clear its big head, so in front of it the fist would cover the face

   MOVE SETS (picked in the animation lab and saved): an IDLE STYLE (how the hero stands around and carries the weapon)
   and an ATTACK SET (its own fighting stance + a 3-hit combo for every kind of weapon). */
(function () {
  'use strict';
  const NC = window.NC;
  const TAU = Math.PI * 2;

  // ---------------- curves (how a value travels from one key to the next) ----------------
  const CURVE = {
    lin: (u) => u,
    in: (u) => u * u, // slow start, accelerating: heavy swings into impact
    out: (u) => 1 - (1 - u) * (1 - u), // fast start, soft landing: reaching a pose / follow-through
    inout: (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)),
    snap: (u) => 1 - Math.pow(1 - u, 4), // explosive: the strike itself
    back: (u) => { const s = 2.2; u -= 1; return u * u * ((s + 1) * u + s) + 1; }, // overshoot, then settle
    step: () => 0, // hold, then cut to the next key
  };

  const CH = ['x', 'y', 'rot', 'lean', 'breathe', 'sq', 'head', 'headY', 'aF', 'eF', 'aB', 'eB',
    'legF', 'kF', 'legB', 'kB', 'wAng', 'wPush', 'tuck', 'ik', 'fade',
    'hk', 'hx', 'hy', 'bk', 'bx', 'by', 'plant', 'pX', 'pY', 'pG', 'gAdj', 'wz', 'turn', 'wFar', 'wLen', 'pull', 'wHide', 'wSheath', 'aBack'];
  const LOWER = new Set(['legF', 'kF', 'legB', 'kB']); // an attack does not move the legs while walking

  // key values may depend on the situation: c = { al (aim in the rig frame), rF, rB (arm rest angles), W (weapon) }
  const A = (n) => (c) => c.al + n; // relative to where the attack is aimed
  const RF = (n) => (c) => c.rF + n; // relative to the near arm hanging down
  const RB = (n) => (c) => c.rB + n; // relative to the far arm hanging down
  const val = (v, c) => (typeof v === 'function' ? v(c) : v);

  // the setup pose: standing, arms down, weapon carried
  function setup(c) {
    const W = c.W;
    return {
      x: 0, y: 0, rot: 0, lean: 0, breathe: 1, sq: 1, head: 0, headY: 0,
      aF: c.rF, eF: 0.15, aB: c.rB, eB: 0.15, legF: 0, kF: 0.06, legB: 0, kB: 0.06,
      wAng: W.restAng, wPush: 0, tuck: W.tuck ? 1 : 0, ik: 0, fade: 1, wBehind: !!W.behind,
      hk: 0, hx: 9, hy: -18, bk: 0, bx: 13, by: -14, plant: 0, pX: 4, pY: -62, pG: 99, gAdj: 0, wz: 0, turn: 0, wFar: 0,
      wLen: 1, pull: 0, wHide: 0, wSheath: 0, aBack: 0,
    };
  }

  // the weapon's ready angle follows the aim a little (less when aiming up, or the weapon rises in front of the face)
  const aimUp = (al) => (al < 0 ? al * 0.45 : al);
  const isXbow = (c) => !!(c.W && (c.W.wtype === 'xbow' || c.W.sprite === 'w_crossbow'));
  // (a crossbow is held level and aimed like a gun; its data came from the bow's, which stands upright)
  const stanceAng = (c, n) => (isXbow(c) ? -0.12 : c.W.stance) + 0.45 * aimUp(c.al) + (n || 0);
  const carryAng = (c, P) => c.W.restAng + 0.3 * (P.aF - c.rF);
  // how a weapon is held in the stances, by its type (weapons.js: W.wtype) so every new weapon finds its family:
  // sword (a hilt), greatsword, axe / hammer (a head), spear / staff (held along the shaft: POLE), bow
  const KIND = { sword: 'sword', dsword: 'sword', gsword: 'greatsword', huuma: 'greatsword', axe: 'axe', mace: 'axe', book: 'axe',
    hammer: 'hammer', gaxe: 'hammer', spear: 'spear', lance: 'spear', qstaff: 'spear', scythe: 'spear', staff: 'staff',
    lantern: 'staff', torch: 'staff', bow: 'bow', xbow: 'bow' };
  const kind = (c) => {
    const W = c.W;
    if (!W) return 'sword';
    const t = W.wtype || (NC.wtypeOf && NC.wtypeOf(W));
    return KIND[t] || W.sprite || 'sword';
  };
  const POLE = { spear: true, staff: true }; // held along the shaft, not by a hilt
  const TWO = (c) => (c.W && (c.W.twoHanded || isXbow(c)) ? 1 : 0);

  // ---- the aim in attack keys (audit 2026-09-28) ----
  // A(n) adds the whole aim. On a slash that already ends pointing down, a target below the hero turned the blade past
  // straight down into the back half (a chop behind his own heel); a wind-up already pointing back, aimed up, wrapped
  // round to hang under the legs; and an arm raised along the aim put the fist on the big chibi face. So:
  //   AS  a strike: the whole aim, but it never ends behind the body (unless the key itself was authored there)
  //   AW  a wind-up, follow-through or recovery: only part of the aim, kept in front the same way; long weapons stop
  //       short of burying themselves in the ground (lowCap)
  //   AU  an arm keyed along the aim: up-aims hardly raise it (the near shoulder sits under the face, so any arm raised
  //       along an up-aim ends with the fist on the face); the weapon does the aiming
  //   AT  a cast or a thrust pointing at the target: up-aims tilt it a little less (a staff straight up from the chest
  //       would stand across the face), kept in front like AS
  //   LU  leaning back a little when aiming up (makes room for the arm)
  const FRONT_UP = -Math.PI / 2 - 0.35, BACK_UP = -Math.PI - 0.1, DOWN = Math.PI / 2 + 0.25;
  const keep = (v, lo, hi, n) => NC.clamp(v, Math.min(lo, n), Math.max(hi, n));
  // a long weapon pointing down would sink into the ground: keep its tip within ~18 px under the feet (more when aimed
  // down at a target, which in the 3/4 view is towards the camera)
  function lowCap(c, a) {
    const L = c.wl || 60;
    if (L < 66) return a;
    const lim = Math.asin(NC.clamp(62 / L, 0, 1)) + 0.8 * Math.max(0, c.al || 0);
    if (a > lim && a < Math.PI / 2) return lim;
    if (a >= Math.PI / 2 && a < Math.PI - lim) return Math.PI - lim;
    return a;
  }
  const AS = (n) => (c) => keep(c.al + n, FRONT_UP, DOWN, n);
  const AW = (n) => (c) => keep(n + (c.al < 0 ? 0.3 : 0.45) * c.al, BACK_UP, DOWN, n);
  const AWL = (n) => (c) => lowCap(c, AW(n)(c)); // AW for the weapon of a long follow-through
  const ASL = (n) => (c) => lowCap(c, AS(n)(c));
  const AU = (n) => (c) => n + (c.al < 0 ? 0.2 * c.al : c.al);
  const AT = (n) => (c) => keep(n + (c.al < 0 ? 0.6 * c.al : c.al), FRONT_UP, DOWN, n);
  const LU = (n) => (c) => n + 0.3 * Math.min(0, c.al);
  //   UP  an arm raised overhead: never further forward than up-and-back (-2.0), where the fist clears the face
  const UP = (f, lim) => (c) => Math.min(val(f, c), lim === undefined ? -2.0 : lim);
  // a blade kept low behind the hip, as if in its sheath (long blades flatter, so the tip clears the ground)
  // (W.sheathAng: a sword's own, e.g. a katana thrust through the belt, flatter: js/samurai.js)
  const sheathAng = (c) => (c.W && c.W.sheathAng) || (POLE[kind(c)] ? Math.PI - 0.18 : c.wl > 90 ? 2.78 : 2.62);

  // ---------------- looping base animations (procedural, like a hand-keyed cycle) ----------------
  // an outfit drawn facing the viewer (the class line-up): a swing forward or back goes toward / away from the camera,
  // so on screen it is small. The arms stay at the sides (the near one never crosses the body: its fist would read as
  // the other arm), swinging a little out when back and in when forward, the elbows bent less; the body leans less.
  // (The legs keep their full stride: it is what carries the body across the screen without the feet sliding.)
  // u: the swing (+ = the near arm back), bend: elbow at rest, amp: swing, flex: extra elbow on the forward swing
  function frontArms(c, P, u, bend, amp, flex) {
    P.aF = c.rF + 0.1 + amp * u; P.eF = bend + flex * Math.max(0, -u);
    P.aB = c.rB - 0.1 + amp * u; P.eB = bend + flex * Math.max(0, u);
    P.lean *= 0.4;
  }

  // how an outfit carries its weapon when not fighting (the class line-up, top item's `carry`): the knight holds the
  // sword point-down in the near hand at his side ('hold'), the archer holds the bow at his far side ('far'); anyone
  // else keeps it where it is kept (W.tuck). swing: the arm's swing while walking, the weapon follows it
  function restCarry(c, P, swing) {
    const W = c.W, s = swing || 0;
    if (c.carry === 'far' && W.bow) {
      P.tuck = 0; P.wFar = 1; P.wAng = -1.25 + 0.2 * s; P.wLen = 0.9; P.wHide = 0; P.wBehind = false; P.ik = 0;
    } else if (c.carry === 'hold' && !W.bow && !W.dual && W.style !== 'bolt') {
      // held around its middle, the pommel up by the chest and the sheathed blade down to the knee
      // (behind the near leg: only the handle shows above the fist, the scabbard hangs down beside the leg)
      P.tuck = 0; P.wAng = 1.0 + 0.3 * s; P.wLen = 0.8; P.gAdj = 0.45 - W.grip; P.wSheath = 1;
      P.wHide = 0; P.wBehind = true; P.ik = 0;
    }
  }

  // standing at ease, the way the class line-up stands (the player's reference): upright, feet close together under the
  // body, both arms hanging a little away from the sides with the fists by the hips, head up, hands empty (the weapon
  // is kept at the belt or across the back: W.tuck). Only a slow breath and a faint sway move it.
  function idle(t, c, P) {
    const br = Math.sin((TAU * t) / 3.2); // one breath every 3.2 s (~19 per minute)
    const late = Math.sin((TAU * (t - 0.35)) / 3.2); // the head follows the chest a little later
    const sway = Math.sin((TAU * t) / 6.4); // slow weight shift
    P.breathe = 1 + 0.02 * br;
    P.headY = -0.8 * late; P.head = 0.012 * sway;
    P.x = 0.5 * sway; P.lean = 0.006 * sway;
    P.legF = 0.015; P.kF = 0.03; P.legB = -0.015; P.kB = 0.03; // legs straight down, side by side, the boots just apart
    P.aF = c.rF + 0.08 + 0.02 * br; P.eF = 0.26 + 0.03 * br;   // hanging at the sides, the fists by the hips
    P.aB = c.rB - 0.08 - 0.02 * br; P.eB = 0.26 + 0.03 * br;
    P.wAng = carryAng(c, P);
    restCarry(c, P);
  }

  // combat idle: low, wide, leaning in, weapon up, guard up, fast breathing and a small bounce
  function ready(t, c, P) {
    const b = 0.5 - 0.5 * Math.cos((TAU * t) / 0.84); // bounce on the knees
    const br = Math.sin((TAU * t) / 1.9);
    // wide stance: the far leg leads (it is the front one in a 3/4 view), the near leg braces behind
    P.legB = 0.3; P.legF = -0.28;
    P.kB = 0.58 + 0.12 * b; P.kF = 0.45 + 0.12 * b;
    P.lean = 0.13 + 0.02 * b; P.head = -0.05; P.headY = 0.6 * b;
    P.breathe = 1 + 0.012 * br;
    P.aF = 0.85 + 0.4 * aimUp(c.al) + 0.03 * b; P.eF = 0.95; // fist in front of the chest, pointed at the aim
    // one-handed: the free hand is a loose fist at the front of the hip, well away from the weapon (raised as a guard it
    // sat on the handle and read as the hand holding it); two-handed: it goes on the handle (ik below)
    P.aB = c.rB + 0.2 + 0.04 * b; P.eB = 0.5 + 0.05 * b;
    P.wAng = stanceAng(c, 0.04 * b); P.wPush = 0;
    P.tuck = 0; P.wBehind = false; P.ik = TWO(c);
  }

  function walk(t, c, P) {
    if (WALKS[c.idleStyle]) return BASE[WALKS[c.idleStyle]](t, c, P); // a template idle walks its own way
    const ph = c.walk, s = Math.sin(ph), cs = Math.cos(ph);
    P.legF = 0.5 * s; P.legB = -0.5 * s;
    // the leg swinging forward bends its knee (lifts the foot); the planted leg stays long
    P.kF = 0.08 + 0.55 * Math.max(0, cs); P.kB = 0.08 + 0.55 * Math.max(0, -cs);
    P.lean = 0.08; P.head = -0.02 * cs;
    P.headY = 0.9 * Math.abs(Math.sin(ph - 0.5)) - 0.5; // head bob, a little behind the step
    P.breathe = 1;
    // arms swing against the legs (the near leg forward = the near arm back); the elbow bends on the forward swing
    P.aF = c.rF + 0.45 * s; P.eF = 0.22 + 0.25 * Math.max(0, -s);
    P.aB = c.rB - 0.45 * s; P.eB = 0.2 + 0.25 * Math.max(0, s);
    if (c.front) frontArms(c, P, s, 0.26, 0.12, 0.18);
    P.wAng = carryAng(c, P);
    // out of combat the weapon stays where the idle style holds it (on the shoulder, hand on the hilt)
    const hold = CARRY[c.idleStyle];
    if (hold) { const Q = setup(c); hold(t, c, Q); for (const k of CARRY_CH) P[k] = Q[k]; }
    else if (!c.idleStyle || c.idleStyle === 'idle') restCarry(c, P, 0.5 * s);
  }

  function walkReady(t, c, P) {
    if (WALKS[c.ready]) return BASE[WALKS[c.ready]](t, c, P);
    const keepLegs = {};
    walk(t, c, keepLegs);
    (BASE[c.ready] || ready)(t, c, P);
    for (const k of ['legF', 'legB', 'kF', 'kB', 'headY']) P[k] = keepLegs[k];
    P.lean = 0.14;
  }

  // ---------------- run ----------------
  // A run is not a fast walk: each foot is on the ground less than half the cycle, so twice per cycle BOTH feet are
  // off the ground (the flight). Per step: CONTACT (the foot lands ahead of the hips, knee almost straight) -> DOWN
  // (the knee gives, the body is at its lowest) -> PUSH-OFF (the leg straightens behind, the body rises) -> FLIGHT
  // (the back heel kicks up to the seat, the front knee drives up high) -> the other foot's contact. The body leans
  // into the run, the elbows are bent ~90 degrees and pump against the legs, the head stays steady.
  // Leg keys over the near leg's cycle (0 = its foot lands; thigh + forward, knee + bends), made by tools/run_keys.py:
  // while a foot is on the ground it is solved with IK so it moves back exactly as fast as the ground goes by (the
  // phase advances 0.0663 rad per px while running, entities.js), so it never skates; the swing in between is keyed
  // by hand (trail -> heel kick -> knee drive -> reach -> paw back). RUN_LIFT raises the body in the two flights.
  const RUN_LEGS = {
    F: { thigh: [[0, 0.4648], [0.05, 0.608], [0.1, 0.581], [0.15, 0.4792], [0.2, 0.3149], [0.25, 0.0829], [0.3, -0.3457], [0.37, -0.4752], [0.46, -0.2952], [0.56, 0.0948], [0.68, 0.6648], [0.8, 0.9048], [0.9, 0.7448]],
         knee: [[0, 0.2], [0.05, 0.6874], [0.1, 0.8718], [0.15, 0.9288], [0.2, 0.8723], [0.25, 0.6811], [0.3, 0.1], [0.37, 0.55], [0.46, 1.55], [0.56, 2.05], [0.68, 1.95], [0.8, 1.2], [0.9, 0.55]] },
    B: { thigh: [[0, 0.4284], [0.05, 0.5345], [0.1, 0.4969], [0.15, 0.3889], [0.2, 0.2246], [0.25, 0.0013], [0.3, -0.3582], [0.37, -0.5645], [0.46, -0.3845], [0.56, 0.0055], [0.68, 0.5755], [0.8, 0.8155], [0.9, 0.6555]],
         knee: [[0, 0.2998], [0.05, 0.7274], [0.1, 0.9012], [0.15, 0.9502], [0.2, 0.89], [0.25, 0.7057], [0.3, 0.2449], [0.37, 0.55], [0.46, 1.55], [0.56, 2.05], [0.68, 1.95], [0.8, 1.2], [0.9, 0.55]] },
  };
  const RUN_LIFT = [[0, 0], [0.025, 0], [0.05, 0], [0.075, -0.07], [0.1, -0], [0.125, -0.009], [0.15, -0.001], [0.175, -0.009], [0.2, 0], [0.225, -0.106], [0.25, -0], [0.275, 0], [0.3, 0], [0.325, -3.984], [0.35, -4.666], [0.375, -4.835], [0.4, -4.772], [0.425, -4.182], [0.45, -2.966], [0.475, -1.455], [0.5, 0], [0.525, 0], [0.55, -0.001], [0.575, -0.049], [0.6, 0], [0.625, -0.008], [0.65, -0], [0.675, -0.008], [0.7, -0.001], [0.725, -0.06], [0.75, -0.001], [0.775, 0], [0.8, 0], [0.825, -3.957], [0.85, -4.957], [0.875, -5.126], [0.9, -5.018], [0.925, -4.335], [0.95, -3.034], [0.975, -1.48]];
  // a smooth loop through keys [[u, value]...] (u in 0..1; after the last key it runs back to the first)
  function loopCurve(keys, u) {
    u = ((u % 1) + 1) % 1;
    const n = keys.length;
    let i = 0;
    while (i < n - 1 && keys[i + 1][0] <= u) i++;
    const k1 = keys[i], k2 = keys[(i + 1) % n], p0 = keys[(i - 1 + n) % n][1], p3 = keys[(i + 2) % n][1];
    const t1 = i + 1 < n ? k2[0] : 1 + k2[0];
    const s = (u - k1[0]) / (t1 - k1[0]), p1 = k1[1], p2 = k2[1];
    return 0.5 * (2 * p1 + (p2 - p0) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (3 * p1 - p0 - 3 * p2 + p3) * s * s * s);
  }
  function runLegs(c, P) {
    const u = c.walk / TAU; // the near leg lands at 0, the far one half a cycle later
    P.legF = loopCurve(RUN_LEGS.F.thigh, u); P.kF = loopCurve(RUN_LEGS.F.knee, u);
    P.legB = loopCurve(RUN_LEGS.B.thigh, u - 0.5); P.kB = loopCurve(RUN_LEGS.B.knee, u - 0.5);
    P.y = Math.min(0, loopCurve(RUN_LIFT, u));
    const w = TAU * u;
    P.sq = 1 - 0.03 * Math.cos(2 * w - 1.885);   // squashed in the down, stretched in the flight (run_keys.py assumes it)
    P.headY = 0.9 * Math.cos(2 * w - 2.3);      // the head settles a moment after the body
    return w;
  }
  function run(t, c, P) {
    if (RUNS[c.idleStyle]) return BASE[RUNS[c.idleStyle]](t, c, P);
    const w = runLegs(c, P);
    P.lean = 0.24 + 0.04 * Math.cos(2 * w - 0.5); P.head = -0.12 + 0.02 * Math.sin(2 * w); P.breathe = 1;
    // the arms pump against the legs: the near arm is furthest back as the near knee drives up (a = w + 1: a little
    // ahead of the legs); the elbow bends more on the forward swing (the fist comes up in front of the chest)
    const a = Math.cos(w + 1);
    P.aF = c.rF + 0.1 + 0.6 * a; P.eF = 1.45 - 0.25 * a;
    P.aB = c.rB - 0.1 - 0.6 * a; P.eB = 1.45 + 0.25 * a;
    if (c.front) frontArms(c, P, a, 0.55, 0.15, 0.2);
    P.wAng = carryAng(c, P);
    const hold = CARRY[c.idleStyle];
    if (hold) { const Q = setup(c); hold(t, c, Q); for (const k of CARRY_CH) P[k] = Q[k]; }
    else if (!c.idleStyle || c.idleStyle === 'idle') restCarry(c, P, 0.4 * Math.cos(w));
  }
  // running in the fighting stance: the upper body keeps the stance, the legs run
  function runReady(t, c, P) {
    if (RUNS[c.ready]) return BASE[RUNS[c.ready]](t, c, P);
    (BASE[c.ready] || ready)(t, c, P);
    const lean = P.lean;
    runLegs(c, P);
    P.lean = Math.max(lean, 0.2);
  }
  const RUNS = {}; // idle style or fighting stance -> its own run cycle (templates)

  function dash(t, c, P) {
    P.lean = 0.38; P.head = -0.1;
    P.legF = 0.75; P.kF = 0.95; P.legB = -0.7; P.kB = 0.35;
    P.aF = c.rF + 1.25; P.eF = 0.25; P.aB = c.rB + 1.35; P.eB = 0.2;
    P.wAng = carryAng(c, P); P.sq = 1.03;
  }

  // ---------------- idle styles ----------------
  // the weapon resting on the shoulder, the other hand on the hip, weight on the back leg, chin up: the confident hero
  function idleShoulder(t, c, P) {
    const br = Math.sin((TAU * t) / 3.4), late = Math.sin((TAU * (t - 0.4)) / 3.4), sway = Math.sin((TAU * t) / 6.8);
    P.legB = 0.21; P.kB = 0.17 + 0.03 * sway; P.legF = -0.08; P.kF = 0.03;
    P.lean = -0.05 + 0.01 * br; P.breathe = 1 + 0.022 * br;
    P.head = -0.09 + 0.02 * sway; P.headY = -0.7 * late; P.x = 0.8 * sway;
    P.hk = 1; P.hx = 4 + 0.4 * br; P.hy = -30 - 0.8 * br; // the hand rides up with each breath
    P.wAng = -2.62 + 0.025 * br; P.gAdj = POLE[kind(c)] ? -0.2 : 0; P.wz = 1;
    P.tuck = 0; P.wBehind = false; P.ik = 0;
    P.bk = 1; P.bx = 13; P.by = -14;
  }

  // the weapon standing in the ground: a sword driven point-first into the earth in front with both hands on the
  // pommel (the knight), an axe or hammer resting on its head with the handle leaning into the hands, a pole standing
  // beside the body in one hand with the other hand on the hip. h = the hand, from the pelvis (which stands ~35 up)
  const PLANT = {
    sword: { h: [4, -27], a: 1.65, bury: true }, greatsword: { h: [4, -30], a: 1.6, bury: true },
    axe: { h: [6, -27] }, hammer: { h: [6, -26] },
    spear: { h: [-27, -18], a: -1.47, pole: true }, staff: { h: [-27, -18], a: -1.5, pole: true },
  };
  function idlePlant(t, c, P) {
    const br = Math.sin((TAU * t) / 3.6), late = Math.sin((TAU * (t - 0.4)) / 3.6), sway = Math.sin((TAU * t) / 7.2);
    P.legB = 0.13; P.kB = 0.05; P.legF = -0.13; P.kF = 0.05 + 0.02 * sway;
    P.lean = -0.03 + 0.01 * br; P.breathe = 1 + 0.02 * br;
    P.head = -0.06 + 0.015 * sway; P.headY = -0.7 * late; P.x = 0.6 * sway;
    const k = PLANT[kind(c)] || PLANT.sword, L = c.wlen || 80;
    const hx = k.h[0], hy = k.h[1] - 35; // the hand, from the feet
    P.plant = 1; P.pX = hx; P.pY = hy; P.pG = k.bury ? 7 : 99;
    if (k.pole) {
      // hold it where the butt just touches the ground
      P.wAng = k.a; P.gAdj = (hy - 2) / Math.sin(k.a) / L - c.W.grip;
    } else {
      // point-first into the ground, or leaning so the head rests on the ground in front
      P.wAng = k.a || Math.asin(NC.clamp((6 - hy) / (L * (1 - c.W.grip)), -1, 1)); P.gAdj = 0;
    }
    P.tuck = 0; P.wBehind = false; P.wz = 0;
    if (k.pole) { P.bk = 1; P.bx = 13; P.by = -14; P.ik = 0; } else P.ik = 1;
  }

  // the hand resting on the hilt, the blade low behind the hip as if sheathed; calm, head slightly bowed: the samurai
  function idleHilt(t, c, P) {
    const br = Math.sin((TAU * t) / 4), late = Math.sin((TAU * (t - 0.45)) / 4), sway = Math.sin((TAU * t) / 8);
    P.legB = 0.2; P.kB = 0.22 + 0.02 * sway; P.legF = -0.15; P.kF = 0.07;
    P.lean = 0.05 + 0.008 * br; P.breathe = 1 + 0.016 * br;
    P.head = 0.05 + 0.012 * sway; P.headY = -0.6 * late; P.x = 0.5 * sway;
    P.hk = 1; P.hx = 8; P.hy = -19 - 0.3 * br;
    P.wAng = sheathAng(c) + 0.3 * P.lean; P.gAdj = POLE[kind(c)] ? -0.2 : 0;
    P.tuck = 0; P.wBehind = false; P.ik = 0;
    P.aB = c.rB + 0.08; P.eB = 0.3; // the other arm hangs loose
  }

  // ---------------- fighting stances of the other attack sets ----------------
  // "samurai": crouched low, the hand on the hilt and the blade kept back and low, the other hand on the sheath.
  // Stillness sells it: slow breathing and only a faint, coiled pulse in the knees. Poles: a low guard instead.
  function readyIai(t, c, P) {
    const br = Math.sin((TAU * t) / 2.6), pulse = Math.sin((TAU * t) / 1.3);
    P.legB = 0.56; P.kB = 1.0 + 0.025 * pulse; P.legF = -0.62; P.kF = 0.42;
    P.lean = 0.26 + 0.01 * br; P.breathe = 1 + 0.012 * br;
    P.head = -0.13; P.headY = 0.3 * br;
    P.tuck = 0; P.wBehind = false; P.wPush = 0;
    if (POLE[kind(c)]) {
      P.aF = 0.95 + 0.3 * c.al; P.eF = 0.75; P.wAng = 0.4 + 0.4 * c.al; P.gAdj = 0.04; P.ik = 1;
    } else {
      P.hk = 1; P.hx = 9; P.hy = -18; P.wAng = sheathAng(c) + 0.3 * P.lean; P.ik = 0;
      P.bk = 1; P.bx = 3; P.by = -15;
    }
  }

  // "storm": wide and heavy, the weapon on the shoulder in both hands, ready to come crashing down; deep breaths
  // that lift the shoulders. Poles: held across the body at the hips.
  function readyHeavy(t, c, P) {
    const b = 0.5 - 0.5 * Math.cos((TAU * t) / 1.1), br = Math.sin((TAU * t) / 1.1);
    P.legB = 0.46; P.kB = 0.56 + 0.12 * b; P.legF = -0.46; P.kF = 0.44 + 0.12 * b;
    P.lean = 0.1 + 0.02 * b; P.breathe = 1 + 0.024 * br; P.head = -0.08; P.headY = 0.6 * b;
    P.tuck = 0; P.wBehind = false; P.wPush = 0; P.ik = 1;
    if (POLE[kind(c)]) {
      P.aF = 1.0 + 0.25 * c.al; P.eF = 1.1; P.wAng = -0.08 + 0.3 * c.al + 0.03 * b; P.gAdj = 0.16;
    } else {
      P.hk = 1; P.hx = 3; P.hy = -32 - 1.2 * b; P.wAng = -2.5 - 0.05 * b; P.wz = 1;
    }
  }

  // ---------------- the greatsword's own style (from a reference video the player sent) ----------------
  // A big blade carried low in one hand, its point resting on the ground ahead: too heavy to hold up for nothing.
  // It is dragged back low to wind up, cuts upwards, comes down overhead and is driven into the ground from a leap.
  // the hand at (x, -h) from the feet, the blade angled down so that its point reaches `sink` below the ground line
  function restOnGround(c, P, x, h, sink) {
    P.plant = 1; P.pX = x; P.pY = -h; P.pG = sink;
    P.wAng = Math.asin(NC.clamp((h + sink) / (c.wl || 80), -1, 1)); P.gAdj = 0;
  }
  // weight on the back leg, shoulders loose, head a little down (unimpressed); the free arm hangs
  function idleLow(t, c, P) {
    const br = Math.sin((TAU * t) / 3.6), late = Math.sin((TAU * (t - 0.4)) / 3.6), sway = Math.sin((TAU * t) / 7.2);
    P.legB = 0.22; P.kB = 0.16 + 0.03 * sway; P.legF = -0.16; P.kF = 0.1;
    P.lean = 0.07 + 0.012 * br; P.breathe = 1 + 0.022 * br;
    P.head = 0.05 + 0.015 * sway; P.headY = -0.7 * late; P.x = 0.6 * sway;
    restOnGround(c, P, 7, 45 + 0.5 * br, 2);
    P.aB = c.rB + 0.06 + 0.03 * br; P.eB = 0.22;
    P.tuck = 0; P.wBehind = false; P.wz = 0; P.ik = 0;
  }
  // fighting stance: both hands low on the grip, the point just off the ground ahead, knees bent, a heavy bounce
  function readyLow(t, c, P) {
    const b = 0.5 - 0.5 * Math.cos((TAU * t) / 1.2), br = Math.sin((TAU * t) / 1.2);
    P.legB = 0.42; P.kB = 0.6 + 0.12 * b; P.legF = -0.4; P.kF = 0.48 + 0.12 * b;
    P.lean = 0.16 + 0.02 * b; P.breathe = 1 + 0.02 * br; P.head = -0.04; P.headY = 0.6 * b;
    restOnGround(c, P, 11, 40 - 1.2 * b, -3); P.pG = 99; // the point hovers above the ground, dipping with the knees
    P.tuck = 0; P.wBehind = false; P.wz = 0; P.wPush = 0; P.ik = 1;
  }
  // on the move: trailed low behind the hip in the near hand, the point skimming along above the ground
  function trailLow(t, c, P) {
    P.hk = 1; P.hx = -3; P.hy = -12; P.wAng = Math.PI - 0.42; P.gAdj = 0; P.wz = 0;
    P.tuck = 0; P.wBehind = false; P.ik = 0;
  }
  const walkLow = (t, c, P) => walk(t, Object.assign({}, c, { idleStyle: 'idleLow' }), P);
  const runLow = (t, c, P) => run(t, Object.assign({}, c, { idleStyle: 'idleLow' }), P);

  // ---------------- the bow: held in the far hand, drawn with the near one ----------------
  // standing: the bow hangs upright in the far hand at the side (follows that arm's swing when walking)
  function bowCarry(t, c, P) { P.wFar = 1; P.wAng = -1.45 + 0.25 * (P.aB - c.rB); P.tuck = 0; P.wBehind = false; P.ik = 0; P.pull = 0; }
  function idleBow(t, c, P) { idle(t, c, P); P.aB = c.rB - 0.3; P.eB = 0.55; bowCarry(t, c, P); } // the bow a little forward, in view
  // fighting stance: the bow half raised toward the aim, the drawing hand ready at the hip, a light bounce
  function readyBow(t, c, P) {
    const b = 0.5 - 0.5 * Math.cos((TAU * t) / 1.1), br = Math.sin((TAU * t) / 1.9);
    P.legB = 0.3; P.legF = -0.3; P.kB = 0.5 + 0.1 * b; P.kF = 0.42 + 0.1 * b;
    P.lean = 0.08 + 0.02 * b; P.head = -0.04; P.headY = 0.5 * b; P.breathe = 1 + 0.012 * br;
    P.wFar = 1; P.aB = 0.7 + 0.35 * aimUp(c.al) + 0.02 * b; P.eB = 0.4;
    P.wAng = -1.35 + 0.35 * aimUp(c.al); P.pull = 0;
    P.aF = c.rF + 0.25; P.eF = 0.7 + 0.04 * b;
    P.tuck = 0; P.wBehind = false; P.ik = 0; P.wPush = 0;
  }

  const CARRY = { idleShoulder, idleHilt, idleLow: trailLow, idleBow: bowCarry };
  const CARRY_CH = ['hk', 'hx', 'hy', 'wAng', 'gAdj', 'wz', 'tuck', 'wBehind', 'ik', 'wFar', 'pull'];

  // ---------------- keyed clips ----------------
  // keys: channel -> [[time, value, curve to the next key], ...]; a channel's first key is reached from the pose
  // the character is in (curve clip.inCurve). ev: [[time, name]]. lunge: [[time, distance]] = root motion along the
  // aim. phases (for the animation lab): a = anticipation, s = strike, f = follow-through, r = recovery.
  const CLIPS = {};

  // ---- sword / axe / greatsword: diagonal slash, rising backhand, jumping chop ----
  CLIPS.swing1 = {
    dur: 0.36, out: 0.12, cancel: 0.2, trail: [0.1, 0.22], ev: [[0.135, 'hit']], lunge: [[0.1, 0], [0.17, 16]],
    phases: [[0, 0.1, 'a'], [0.1, 0.16, 's'], [0.16, 0.24, 'f'], [0.24, 0.36, 'r']],
    keys: {
      aF: [[0.1, AW(-2.05), 'snap'], [0.16, AS(0.95), 'out'], [0.24, AW(1.3), 'inout'], [0.36, AW(1.22)]],
      eF: [[0.1, 1.05, 'snap'], [0.16, 0.08, 'out'], [0.24, 0.12], [0.36, 0.2]],
      wAng: [[0.1, AW(-2.6), 'snap'], [0.16, ASL(0.8), 'out'], [0.24, AWL(1.35), 'inout'], [0.36, AWL(1.25)]],
      lean: [[0.1, -0.1, 'snap'], [0.16, 0.22, 'out'], [0.24, 0.27], [0.36, 0.24]],
      head: [[0.1, -0.06], [0.16, 0.06], [0.36, 0.08]],
      aB: [[0.1, 0.25, 'snap'], [0.16, RB(0.7), 'out'], [0.36, RB(0.55)]],
      eB: [[0.1, 1.1], [0.16, 0.45], [0.36, 0.4]],
      legB: [[0.1, 0.3], [0.16, 0.48, 'out'], [0.36, 0.45]], kB: [[0.1, 0.5], [0.16, 0.62], [0.36, 0.6]],
      legF: [[0.1, -0.3], [0.16, -0.42, 'out'], [0.36, -0.4]], kF: [[0.1, 0.55], [0.16, 0.3], [0.36, 0.32]],
      tuck: [[0.03, 0]], wPush: [[0.1, 0]],
    },
  };
  CLIPS.swing2 = {
    dur: 0.32, out: 0.12, cancel: 0.18, trail: [0.07, 0.17], ev: [[0.1, 'hit']], lunge: [[0.07, 0], [0.13, 10]],
    phases: [[0, 0.07, 'a'], [0.07, 0.13, 's'], [0.13, 0.2, 'f'], [0.2, 0.32, 'r']],
    keys: {
      aF: [[0.07, AW(1.15), 'snap'], [0.13, AS(-1.3), 'out'], [0.2, UP(AW(-1.65), -2.05), 'inout'], [0.32, UP(AW(-1.5), -1.95)]],
      eF: [[0.07, 0.4, 'snap'], [0.13, 0.15, 'out'], [0.32, 0.25]],
      wAng: [[0.07, AW(2.0), 'snap'], [0.13, AS(-1.75), 'out'], [0.2, AW(-2.15), 'inout'], [0.32, AW(-2.0)]],
      lean: [[0.07, 0.2, 'snap'], [0.13, -0.05, 'out'], [0.2, -0.1], [0.32, -0.06]],
      head: [[0.07, 0.08], [0.13, -0.1], [0.32, -0.08]],
      aB: [[0.07, RB(0.5)], [0.13, 0.3], [0.32, 0.4]], eB: [[0.07, 0.4], [0.13, 1.1], [0.32, 1.0]],
      legB: [[0.07, 0.42], [0.32, 0.36]], kB: [[0.07, 0.62], [0.32, 0.5]],
      legF: [[0.07, -0.36], [0.32, -0.32]], kF: [[0.07, 0.3], [0.32, 0.45]],
      tuck: [[0.03, 0]], wPush: [[0.07, 0]],
    },
  };
  CLIPS.swing3 = {
    dur: 0.58, out: 0.14, trail: [0.25, 0.34], ev: [[0.305, 'hit']], lunge: [[0.16, 0], [0.3, 40]], finisher: true,
    phases: [[0, 0.16, 'a'], [0.16, 0.25, 'a'], [0.25, 0.31, 's'], [0.31, 0.4, 'f'], [0.4, 0.58, 'r']],
    keys: {
      y: [[0.16, 0, 'out'], [0.245, -30, 'in'], [0.3, 0]],
      sq: [[0.14, 0.94, 'out'], [0.2, 1.06], [0.3, 1.0, 'snap'], [0.33, 0.92, 'out'], [0.45, 1.0]],
      kB: [[0.14, 1.0, 'out'], [0.2, 0.55], [0.28, 0.4, 'snap'], [0.32, 0.95, 'out'], [0.58, 0.75]],
      kF: [[0.14, 1.1, 'out'], [0.2, 0.9], [0.28, 0.5, 'snap'], [0.32, 1.0, 'out'], [0.58, 0.8]],
      legB: [[0.14, 0.35], [0.24, 0.5], [0.32, 0.55], [0.58, 0.5]],
      legF: [[0.14, -0.3], [0.24, -0.1], [0.32, -0.45], [0.58, -0.42]],
      aF: [[0.16, AW(-2.45), 'out'], [0.25, AW(-2.6), 'snap'], [0.31, AS(1.2), 'out'], [0.58, AW(1.1)]],
      eF: [[0.16, 0.65], [0.25, 0.5, 'snap'], [0.31, 0.06], [0.58, 0.12]],
      wAng: [[0.16, AW(-3.0), 'out'], [0.25, AW(-3.05), 'snap'], [0.31, ASL(1.2), 'out'], [0.4, AWL(1.05)], [0.58, AWL(1.1)]],
      lean: [[0.16, -0.18, 'out'], [0.25, -0.2, 'snap'], [0.31, 0.36, 'out'], [0.58, 0.3]],
      head: [[0.16, -0.12], [0.25, -0.1], [0.31, 0.14], [0.58, 0.1]],
      aB: [[0.16, -2.2], [0.25, -2.35, 'snap'], [0.31, AS(1.1)], [0.58, AW(1.0)]],
      eB: [[0.16, 0.7], [0.31, 0.2], [0.58, 0.3]],
      tuck: [[0.03, 0]], wPush: [[0.1, 0]],
    },
  };

  // ---- spear: two quick jabs, then a lunging thrust ----
  const jab = (up, lunge, hitAt) => ({
    dur: 0.3, out: 0.1, cancel: 0.17, ev: [[hitAt, 'hit']], lunge: [[0.07, 0], [0.11, lunge]],
    phases: [[0, 0.07, 'a'], [0.07, 0.11, 's'], [0.11, 0.2, 'f'], [0.2, 0.3, 'r']],
    keys: {
      aF: [[0.07, AU(1.05 + up), 'snap'], [0.11, AU(0.25 + up), 'out'], [0.2, AU(0.3 + up), 'inout'], [0.3, AU(0.7 + up)]],
      eF: [[0.07, 1.25, 'snap'], [0.11, 0.05, 'out'], [0.2, 0.1], [0.3, 0.8]],
      wAng: [[0.07, A(0.02 + up)], [0.3, A(up)]],
      wPush: [[0.07, -12, 'snap'], [0.11, 22, 'out'], [0.2, 18], [0.3, 0]],
      lean: [[0.07, LU(-0.08), 'snap'], [0.11, LU(0.2), 'out'], [0.3, LU(0.14)]],
      legB: [[0.07, 0.32], [0.11, 0.52], [0.3, 0.4]], kB: [[0.07, 0.55], [0.11, 0.65], [0.3, 0.55]],
      legF: [[0.07, -0.3], [0.11, -0.45], [0.3, -0.35]], kF: [[0.07, 0.45], [0.11, 0.12], [0.3, 0.35]],
      tuck: [[0.03, 0]], ik: [[0.03, 1]],
    },
  });
  CLIPS.thrust1 = jab(0, 12, 0.1);
  CLIPS.thrust2 = jab(-0.14, 12, 0.1);
  CLIPS.thrust3 = {
    dur: 0.5, out: 0.12, ev: [[0.185, 'hit']], lunge: [[0.13, 0], [0.2, 55]], finisher: true,
    phases: [[0, 0.13, 'a'], [0.13, 0.19, 's'], [0.19, 0.38, 'f'], [0.38, 0.5, 'r']],
    keys: {
      aF: [[0.13, AU(1.2), 'snap'], [0.19, AU(0.15), 'out'], [0.38, AU(0.2), 'inout'], [0.5, AU(0.6)]],
      eF: [[0.13, 1.4, 'snap'], [0.19, 0.02, 'out'], [0.38, 0.05], [0.5, 0.7]],
      wAng: [[0.13, A(0.05)], [0.5, A(0)]],
      wPush: [[0.13, -20, 'snap'], [0.19, 40, 'out'], [0.38, 34], [0.5, 0]],
      lean: [[0.13, LU(-0.16), 'snap'], [0.19, LU(0.34), 'out'], [0.38, LU(0.3)], [0.5, LU(0.16)]],
      head: [[0.13, -0.08], [0.19, 0.08]],
      legB: [[0.13, 0.3], [0.19, 0.75, 'out'], [0.5, 0.6]], kB: [[0.13, 0.8], [0.19, 0.75], [0.5, 0.6]],
      legF: [[0.13, -0.25], [0.19, -0.65, 'out'], [0.5, -0.5]], kF: [[0.13, 0.8], [0.19, 0.08], [0.5, 0.3]],
      tuck: [[0.03, 0]], ik: [[0.03, 1]],
    },
  };

  // ---- hammer: overhead slam, horizontal sweep, jumping slam (both hands on the handle) ----
  CLIPS.smash1 = {
    dur: 0.5, out: 0.14, cancel: 0.34, trail: [0.17, 0.25], ev: [[0.232, 'hit']], lunge: [[0.17, 0], [0.23, 12]],
    phases: [[0, 0.17, 'a'], [0.17, 0.23, 's'], [0.23, 0.3, 'f'], [0.3, 0.5, 'r']],
    keys: {
      aF: [[0.17, AW(-2.2), 'in'], [0.23, AS(1.25), 'out'], [0.3, AW(1.1), 'inout'], [0.5, AW(1.15)]],
      eF: [[0.17, 0.75, 'in'], [0.23, 0.05], [0.5, 0.1]],
      wAng: [[0.17, AW(-2.75), 'in'], [0.23, ASL(1.1), 'out'], [0.3, AWL(0.9)], [0.5, AWL(1.0)]],
      lean: [[0.17, -0.14, 'in'], [0.23, 0.3, 'out'], [0.5, 0.26]],
      sq: [[0.17, 0.97], [0.23, 1.0, 'snap'], [0.26, 0.95, 'out'], [0.4, 1]],
      head: [[0.17, -0.1], [0.23, 0.12], [0.5, 0.1]],
      legB: [[0.17, 0.3], [0.23, 0.45], [0.5, 0.42]], kB: [[0.17, 0.55], [0.23, 0.8], [0.5, 0.7]],
      legF: [[0.17, -0.28], [0.23, -0.4], [0.5, -0.38]], kF: [[0.17, 0.6], [0.23, 0.55], [0.5, 0.5]],
      tuck: [[0.03, 0]], ik: [[0.03, 1]], wPush: [[0.1, 0]],
    },
  };
  CLIPS.smash2 = {
    dur: 0.46, out: 0.14, cancel: 0.3, trail: [0.13, 0.25], ev: [[0.185, 'hit']], lunge: [[0.13, 0], [0.2, 14]],
    phases: [[0, 0.13, 'a'], [0.13, 0.2, 's'], [0.2, 0.28, 'f'], [0.28, 0.46, 'r']],
    keys: {
      aF: [[0.13, AW(2.6), 'snap'], [0.2, AS(0.0), 'out'], [0.28, UP(AW(-0.7)), 'inout'], [0.46, UP(AW(-0.5), -1.95)]],
      eF: [[0.13, 0.35], [0.2, 0.1], [0.46, 0.25]],
      wAng: [[0.13, AWL(2.85), 'snap'], [0.2, AS(-0.25), 'out'], [0.28, AW(-1.05)], [0.46, AW(-0.9)]],
      lean: [[0.13, -0.1, 'snap'], [0.2, 0.18, 'out'], [0.46, 0.12]],
      head: [[0.13, -0.06], [0.2, 0.06]],
      legB: [[0.13, 0.3], [0.2, 0.46], [0.46, 0.4]], kB: [[0.13, 0.55], [0.2, 0.7], [0.46, 0.6]],
      legF: [[0.13, -0.3], [0.2, -0.42], [0.46, -0.36]], kF: [[0.13, 0.6], [0.2, 0.35], [0.46, 0.45]],
      tuck: [[0.03, 0]], ik: [[0.03, 1]], wPush: [[0.1, 0]],
    },
  };
  CLIPS.smash3 = {
    dur: 0.74, out: 0.16, trail: [0.3, 0.4], ev: [[0.37, 'hit']], lunge: [[0.2, 0], [0.36, 44]], finisher: true,
    phases: [[0, 0.2, 'a'], [0.2, 0.3, 'a'], [0.3, 0.37, 's'], [0.37, 0.48, 'f'], [0.48, 0.74, 'r']],
    keys: {
      y: [[0.2, 0, 'out'], [0.295, -36, 'in'], [0.36, 0]],
      sq: [[0.18, 0.92, 'out'], [0.25, 1.07], [0.36, 1.0, 'snap'], [0.4, 0.9, 'out'], [0.55, 1.0]],
      kB: [[0.18, 1.1, 'out'], [0.25, 0.6], [0.34, 0.4, 'snap'], [0.39, 1.05, 'out'], [0.74, 0.8]],
      kF: [[0.18, 1.2, 'out'], [0.25, 0.95], [0.34, 0.5, 'snap'], [0.39, 1.1, 'out'], [0.74, 0.85]],
      legB: [[0.18, 0.35], [0.3, 0.5], [0.39, 0.6], [0.74, 0.55]],
      legF: [[0.18, -0.3], [0.3, -0.1], [0.39, -0.5], [0.74, -0.45]],
      aF: [[0.2, AW(-2.35), 'out'], [0.3, AW(-2.55), 'in'], [0.37, AS(1.3), 'out'], [0.74, AW(1.2)]],
      eF: [[0.2, 0.7], [0.3, 0.55, 'in'], [0.37, 0.05], [0.74, 0.1]],
      wAng: [[0.2, AW(-2.9), 'out'], [0.3, AW(-3.0), 'in'], [0.37, ASL(1.15), 'out'], [0.46, AWL(0.95)], [0.74, AWL(1.05)]],
      lean: [[0.2, -0.2, 'out'], [0.3, -0.22, 'in'], [0.37, 0.4, 'out'], [0.74, 0.32]],
      head: [[0.2, -0.14], [0.3, -0.12], [0.37, 0.16], [0.74, 0.12]],
      tuck: [[0.03, 0]], ik: [[0.03, 1]], wPush: [[0.1, 0]],
    },
  };

  // ---- staff: two casts from alternating sides, then a charged orb ----
  CLIPS.bolt1 = {
    dur: 0.3, out: 0.1, cancel: 0.16, ev: [[0.1, 'hit']],
    phases: [[0, 0.07, 'a'], [0.07, 0.11, 's'], [0.11, 0.2, 'f'], [0.2, 0.3, 'r']],
    keys: {
      aF: [[0.07, AU(0.55), 'snap'], [0.11, AU(0.0), 'out'], [0.3, AU(0.2)]],
      eF: [[0.07, 1.3, 'snap'], [0.11, 0.25, 'out'], [0.3, 0.5]],
      wAng: [[0.07, AT(-1.25), 'snap'], [0.11, AT(-0.55), 'out'], [0.3, AT(-0.75)]],
      wPush: [[0.07, -6, 'snap'], [0.11, 10, 'out'], [0.3, 0]],
      lean: [[0.07, LU(-0.06), 'snap'], [0.11, LU(0.14), 'out'], [0.3, LU(0.1)]],
      legB: [[0.07, 0.3], [0.3, 0.3]], kB: [[0.07, 0.5], [0.3, 0.5]], legF: [[0.07, -0.28], [0.3, -0.28]], kF: [[0.07, 0.45], [0.3, 0.45]],
      tuck: [[0.03, 0]],
    },
  };
  CLIPS.bolt2 = {
    dur: 0.3, out: 0.1, cancel: 0.16, ev: [[0.11, 'hit']],
    phases: [[0, 0.07, 'a'], [0.07, 0.12, 's'], [0.12, 0.2, 'f'], [0.2, 0.3, 'r']],
    keys: {
      aF: [[0.07, AU(1.25), 'snap'], [0.12, AU(-0.45), 'out'], [0.3, AU(-0.3)]],
      eF: [[0.07, 0.45, 'snap'], [0.12, 0.2, 'out'], [0.3, 0.4]],
      wAng: [[0.07, AWL(0.95), 'snap'], [0.12, AT(-1.1), 'out'], [0.3, AT(-0.95)]],
      lean: [[0.07, LU(0.14), 'snap'], [0.12, LU(-0.04), 'out'], [0.3, LU(0.06)]],
      legB: [[0.07, 0.3], [0.3, 0.3]], kB: [[0.07, 0.5], [0.3, 0.5]], legF: [[0.07, -0.28], [0.3, -0.28]], kF: [[0.07, 0.45], [0.3, 0.45]],
      tuck: [[0.03, 0]], wPush: [[0.07, 0]],
    },
  };
  CLIPS.bolt3 = {
    dur: 0.62, out: 0.14, ev: [[0.12, 'charge'], [0.36, 'hit']], finisher: true,
    phases: [[0, 0.26, 'a'], [0.26, 0.34, 's'], [0.34, 0.46, 'f'], [0.46, 0.62, 'r']],
    keys: {
      aF: [[0.26, -2.1, 'in'], [0.34, AU(0.05), 'snap'], [0.62, AU(0.15)]],
      eF: [[0.26, 0.25], [0.34, 0.1], [0.62, 0.4]],
      wAng: [[0.26, -1.72, 'in'], [0.34, AT(-0.35), 'snap'], [0.62, AT(-0.5)]],
      lean: [[0.26, -0.16, 'in'], [0.34, LU(0.24), 'snap'], [0.62, LU(0.18)]],
      head: [[0.26, -0.2], [0.34, 0.06]],
      y: [[0.2, 0], [0.26, -6, 'in'], [0.34, 0]],
      aB: [[0.26, -1.4], [0.34, RB(0.6)], [0.62, RB(0.4)]], eB: [[0.26, 0.4], [0.34, 0.3]],
      legB: [[0.26, 0.2], [0.34, 0.55], [0.62, 0.45]], kB: [[0.26, 0.3], [0.34, 0.7], [0.62, 0.55]],
      legF: [[0.26, -0.15], [0.34, -0.45], [0.62, -0.35]], kF: [[0.26, 0.25], [0.34, 0.2], [0.62, 0.35]],
      tuck: [[0.03, 0]], wPush: [[0.1, 0]],
    },
  };

  // ---- reactions and extras ----
  CLIPS.death = {
    dur: 1.1, hold: true,
    phases: [[0, 0.35, 'a'], [0.35, 0.85, 's'], [0.85, 1.1, 'r']],
    keys: {
      lean: [[0.08, -0.25, 'out'], [0.35, 0.35, 'inout'], [0.72, -0.1, 'in'], [1.1, -0.05]],
      head: [[0.08, -0.3], [0.35, 0.3], [0.72, -0.35], [1.1, -0.3]],
      kF: [[0.08, 0.2], [0.35, 1.25, 'out'], [0.72, 0.2], [1.1, 0.12]],
      kB: [[0.08, 0.2], [0.35, 1.35, 'out'], [0.72, 0.15], [1.1, 0.08]],
      legF: [[0.35, 0.2], [0.72, -0.05], [1.1, -0.12]], legB: [[0.35, -0.1], [0.72, 0.0], [1.1, -0.04]],
      // the arms fly up in the fall, then flop down along the body (keyed forward, they stood up from the chest like a
      // stiff arm once the body lay down)
      aF: [[0.08, RF(-0.45)], [0.35, RF(0.2)], [0.62, RF(-1.0), 'out'], [0.86, RF(-0.05), 'out'], [1.1, RF(0.05)]],
      aB: [[0.08, RB(-0.6)], [0.35, RB(0.25)], [0.62, RB(-0.9), 'out'], [0.86, RB(-0.1), 'out'], [1.1, RB(0)]],
      eF: [[0.35, 0.4], [0.86, 0.2], [1.1, 0.15]], eB: [[0.35, 0.4], [0.86, 0.2], [1.1, 0.15]],
      rot: [[0.38, 0, 'in'], [0.72, -1.42, 'out'], [0.84, -1.36, 'inout'], [1.1, -1.4]],
      // the weapon is put away at once (slower, the second hand of a two-hander jumped off it half way) and fades once
      // he lies (a long one stuck out from under him)
      tuck: [[0.1, 1]], wHide: [[0.66, 0], [0.84, 1]],
    },
  };
  CLIPS.fidgetStretch = {
    dur: 1.7, in: 0.25, out: 0.35, inCurve: 'inout', fidget: true,
    keys: {
      aF: [[0.45, -2.3, 'inout'], [1.2, -2.35, 'inout'], [1.7, RF(0.05)]], eF: [[0.45, 0.12], [1.7, 0.2]],
      aB: [[0.5, -1.72, 'inout'], [1.2, -1.78, 'inout'], [1.7, RB(0)]], eB: [[0.5, 0.12], [1.7, 0.15]],
      lean: [[0.45, -0.13, 'inout'], [1.2, -0.15, 'inout'], [1.7, 0]],
      head: [[0.45, -0.3, 'inout'], [1.2, -0.28, 'inout'], [1.7, 0]],
      y: [[0.45, -2.5, 'inout'], [1.2, -2.5, 'inout'], [1.7, 0]],
      kF: [[0.45, 0.02], [1.2, 0.02], [1.7, 0.15]], kB: [[0.45, 0.02], [1.7, 0.03]],
      sq: [[0.45, 1.03], [1.2, 1.03], [1.7, 1]],
    },
  };
  CLIPS.fidgetLook = {
    dur: 2.0, in: 0.2, out: 0.3, inCurve: 'inout', fidget: true,
    keys: {
      head: [[0.3, -0.17, 'inout'], [0.8, -0.14, 'inout'], [1.1, 0.13, 'inout'], [1.6, 0.1, 'inout'], [2.0, 0]],
      lean: [[0.3, -0.04], [1.1, 0.05], [2.0, 0]],
      x: [[0.3, -2, 'inout'], [1.1, 2, 'inout'], [2.0, 0]],
      aF: [[0.3, RF(-0.1)], [1.1, RF(0.12)], [2.0, RF(0)]], aB: [[0.3, RB(0.12)], [1.1, RB(-0.08)], [2.0, RB(0)]],
    },
  };
  CLIPS.cheer = {
    dur: 0.9, in: 0.08, out: 0.2,
    keys: {
      y: [[0.1, 2, 'out'], [0.25, -14, 'in'], [0.4, 0], [0.9, 0]],
      kF: [[0.1, 0.8], [0.25, 0.3], [0.45, 0.6], [0.9, 0.3]], kB: [[0.1, 0.8], [0.25, 0.5], [0.45, 0.6], [0.9, 0.3]],
      // (up and back: the fist ends at the back edge of the hair; straight up, a chibi's short arm put it on the face)
      aF: [[0.25, -2.05, 'out'], [0.9, -2.0]], eF: [[0.25, 0.2], [0.9, 0.25]],
      wAng: [[0.25, -1.85, 'out'], [0.9, -1.8]], tuck: [[0.1, 0]],
      aB: [[0.25, -0.6], [0.9, -0.5]], eB: [[0.25, 1.2], [0.9, 1.2]],
      lean: [[0.25, -0.12], [0.9, -0.08]], head: [[0.25, -0.18], [0.9, -0.12]],
    },
  };


  // ======== attack set "samurai" (blade) ========
  // ---- sword / axe / greatsword / hammer: the draw is the cut, a diagonal with both hands, then a dash straight
  // through the enemy: the cut is only a flash of light, the damage lands a beat later, and the blade is sheathed ----
  CLIPS.iaiS1 = { // nukitsuke: rising out of the sheath
    dur: 0.36, out: 0.12, cancel: 0.2, trail: [0.07, 0.16], ev: [[0.088, 'hit']], lunge: [[0.06, 0], [0.12, 26]],
    phases: [[0, 0.07, 'a'], [0.07, 0.12, 's'], [0.12, 0.2, 'f'], [0.2, 0.36, 'r']],
    keys: {
      hk: [[0.07, 1, 'snap'], [0.1, 0]], bk: [[0.07, 1, 'snap'], [0.1, 0]], ik: [[0.07, 0], [0.1, TWO]],
      aF: [[0.07, 1.1, 'snap'], [0.12, AU(-0.02), 'out'], [0.2, AU(-0.1), 'inout'], [0.36, AU(-0.06)]],
      eF: [[0.07, 1.2, 'snap'], [0.12, 0.05, 'out'], [0.36, 0.15]],
      wAng: [[0.07, (c) => sheathAng(c) + 0.1, 'snap'], [0.12, AT(-0.7), 'out'], [0.2, AT(-0.92), 'inout'], [0.36, AT(-0.82)]],
      lean: [[0.07, 0.34, 'snap'], [0.12, LU(0.06), 'out'], [0.2, LU(0.0)], [0.36, LU(0.05)]],
      head: [[0.07, -0.16], [0.12, -0.06], [0.36, -0.05]],
      aB: [[0.1, 2.3], [0.2, 2.1], [0.36, 2.0]], eB: [[0.1, 0.3], [0.36, 0.45]],
      legB: [[0.07, 0.58], [0.12, 0.66, 'out'], [0.36, 0.58]], kB: [[0.07, 1.12], [0.12, 0.7], [0.36, 0.78]],
      legF: [[0.07, -0.6], [0.12, -0.64, 'out'], [0.36, -0.58]], kF: [[0.07, 0.48], [0.12, 0.16], [0.36, 0.28]],
      tuck: [[0.02, 0]], wPush: [[0.05, 0]],
    },
  };
  CLIPS.iaiS2 = { // kesa-giri: from high over the shoulder, diagonally down through the target
    dur: 0.34, out: 0.12, cancel: 0.2, trail: [0.09, 0.18], ev: [[0.108, 'hit']], lunge: [[0.08, 0], [0.14, 16]],
    phases: [[0, 0.09, 'a'], [0.09, 0.14, 's'], [0.14, 0.22, 'f'], [0.22, 0.34, 'r']],
    keys: {
      hk: [[0.04, 0]], bk: [[0.04, 0]], ik: [[0.07, 1]],
      aF: [[0.09, AW(-1.85), 'snap'], [0.14, AS(0.75), 'out'], [0.22, AW(1.0), 'inout'], [0.34, AW(0.95)]],
      eF: [[0.09, 0.75, 'snap'], [0.14, 0.05, 'out'], [0.34, 0.15]],
      wAng: [[0.09, AW(-2.5), 'snap'], [0.14, ASL(0.8), 'out'], [0.22, AWL(1.1), 'inout'], [0.34, AWL(1.0)]],
      lean: [[0.09, -0.12, 'snap'], [0.14, 0.3, 'out'], [0.22, 0.36], [0.34, 0.32]],
      head: [[0.09, -0.1], [0.14, 0.04], [0.34, 0.06]],
      legB: [[0.09, 0.42], [0.14, 0.64, 'out'], [0.34, 0.6]], kB: [[0.09, 0.6], [0.14, 0.95], [0.34, 0.9]],
      legF: [[0.09, -0.42], [0.14, -0.64, 'out'], [0.34, -0.6]], kF: [[0.09, 0.42], [0.14, 0.3], [0.34, 0.32]],
      tuck: [[0.02, 0]], wPush: [[0.05, 0]],
    },
  };
  CLIPS.iaiS3 = { // the finisher: gather at the hilt, dash through, hold... the enemies fall, the blade goes home
    dur: 0.72, out: 0.14, finisher: true, trail: [0.17, 0.24], ghost: [0.1, 0.2], hitShape: 'path',
    ev: [[0.04, 'glint'], [0.21, 'flash'], [0.44, 'hit'], [0.64, 'sheathe']], lunge: [[0.1, 0], [0.19, 150]],
    phases: [[0, 0.1, 'a'], [0.1, 0.24, 's'], [0.24, 0.48, 'f'], [0.48, 0.72, 'r']],
    keys: {
      hk: [[0.06, 1], [0.17, 1, 'snap'], [0.21, 0], [0.5, 0, 'inout'], [0.66, 1]], hx: [[0.06, 9]], hy: [[0.06, -18]],
      bk: [[0.06, 1], [0.17, 1, 'snap'], [0.21, 0], [0.5, 0, 'inout'], [0.66, 1]], bx: [[0.06, 3]], by: [[0.06, -15]],
      ik: [[0.05, 0]],
      aF: [[0.17, 1.1, 'snap'], [0.23, AU(0.12), 'out'], [0.5, AU(0.06), 'inout'], [0.66, 1.1]],
      eF: [[0.17, 1.2, 'snap'], [0.23, 0.04, 'out'], [0.5, 0.08, 'inout'], [0.66, 1.2]],
      wAng: [[0.08, (c) => sheathAng(c) + 0.14], [0.17, (c) => sheathAng(c) + 0.14, 'snap'], [0.23, AT(-0.55), 'out'],
        [0.5, AT(-0.68), 'inout'], [0.66, (c) => sheathAng(c) + 0.08]],
      lean: [[0.08, 0.44, 'out'], [0.17, 0.48, 'snap'], [0.23, 0.2, 'out'], [0.5, 0.24, 'inout'], [0.72, 0.26]],
      head: [[0.08, -0.22], [0.23, -0.04], [0.5, 0.0], [0.72, -0.13]],
      legB: [[0.08, 0.6], [0.14, 0.95], [0.2, 0.72, 'out'], [0.5, 0.7], [0.72, 0.56]],
      kB: [[0.08, 1.25], [0.14, 0.5], [0.2, 1.3, 'out'], [0.5, 1.25], [0.72, 1.0]],
      legF: [[0.08, -0.64], [0.14, -0.15], [0.2, -0.85, 'out'], [0.5, -0.82], [0.72, -0.62]],
      kF: [[0.08, 0.5], [0.14, 0.95], [0.2, 0.22, 'out'], [0.5, 0.26], [0.72, 0.42]],
      aB: [[0.21, 2.4], [0.5, 2.3]], eB: [[0.21, 0.25], [0.5, 0.3]],
      tuck: [[0.02, 0]], wPush: [[0.05, 0]],
    },
  };

  // ---- spear: a snap jab from the low guard, a rising cut with the head, a dash-through thrust ----
  const lowGuardLegs = (t1, t2) => ({
    legB: [[t1, 0.56], [t2, 0.72], [t2 + 0.16, 0.58]], kB: [[t1, 1.05], [t2, 1.12], [t2 + 0.16, 1.0]],
    legF: [[t1, -0.62], [t2, -0.74], [t2 + 0.16, -0.62]], kF: [[t1, 0.45], [t2, 0.2], [t2 + 0.16, 0.4]],
  });
  CLIPS.iaiT1 = {
    dur: 0.26, out: 0.1, cancel: 0.15, ev: [[0.085, 'hit']], lunge: [[0.06, 0], [0.1, 14]],
    phases: [[0, 0.06, 'a'], [0.06, 0.1, 's'], [0.1, 0.17, 'f'], [0.17, 0.26, 'r']],
    keys: Object.assign({
      aF: [[0.06, AU(1.25), 'snap'], [0.1, AU(0.3), 'out'], [0.17, AU(0.35)], [0.26, AU(0.85)]],
      eF: [[0.06, 1.35, 'snap'], [0.1, 0.05, 'out'], [0.17, 0.08], [0.26, 0.7]],
      wAng: [[0.06, A(0.28)], [0.1, A(0.06)], [0.26, A(0.3)]],
      wPush: [[0.06, -10, 'snap'], [0.1, 26, 'out'], [0.17, 22], [0.26, 0]],
      gAdj: [[0.06, 0.04]], ik: [[0.03, 1]],
      lean: [[0.06, LU(0.2), 'snap'], [0.1, LU(0.38), 'out'], [0.26, LU(0.28)]],
      tuck: [[0.02, 0]],
    }, lowGuardLegs(0.06, 0.1)),
  };
  CLIPS.iaiT2 = {
    dur: 0.32, out: 0.12, cancel: 0.19, trail: [0.08, 0.17], hitShape: 'arc', ev: [[0.105, 'hit']], lunge: [[0.07, 0], [0.13, 12]],
    phases: [[0, 0.08, 'a'], [0.08, 0.13, 's'], [0.13, 0.2, 'f'], [0.2, 0.32, 'r']],
    keys: {
      aF: [[0.08, AU(1.4), 'snap'], [0.13, AU(-0.15), 'out'], [0.2, AU(-0.25)], [0.32, AU(-0.1)]],
      eF: [[0.08, 0.6, 'snap'], [0.13, 0.12, 'out'], [0.32, 0.3]],
      wAng: [[0.08, AWL(0.75), 'snap'], [0.13, AS(-0.72), 'out'], [0.2, AS(-0.88), 'inout'], [0.32, AS(-0.75)]],
      wPush: [[0.08, 0]], gAdj: [[0.06, 0.04]], ik: [[0.03, 1]],
      lean: [[0.08, 0.34, 'snap'], [0.13, LU(0.02), 'out'], [0.32, LU(0.06)]],
      head: [[0.08, 0], [0.13, -0.12], [0.32, -0.08]],
      legB: [[0.08, 0.56], [0.13, 0.6], [0.32, 0.56]], kB: [[0.08, 1.1], [0.13, 0.7], [0.32, 0.8]],
      legF: [[0.08, -0.62], [0.13, -0.5], [0.32, -0.55]], kF: [[0.08, 0.5], [0.13, 0.2], [0.32, 0.3]],
      tuck: [[0.02, 0]],
    },
  };
  const dashLegs = (t0, t1, t2, end) => ({ // gather -> a running stride -> land in a deep lunge -> hold
    legB: [[t0, 0.6], [t1, 0.95], [t2, 0.75, 'out'], [end - 0.22, 0.72], [end, 0.56]],
    kB: [[t0, 1.2], [t1, 0.5], [t2, 1.25, 'out'], [end - 0.22, 1.2], [end, 1.0]],
    legF: [[t0, -0.64], [t1, -0.15], [t2, -0.88, 'out'], [end - 0.22, -0.85], [end, -0.62]],
    kF: [[t0, 0.5], [t1, 0.95], [t2, 0.2, 'out'], [end - 0.22, 0.24], [end, 0.42]],
  });
  CLIPS.iaiT3 = {
    dur: 0.7, out: 0.14, finisher: true, ghost: [0.1, 0.2], hitShape: 'path',
    ev: [[0.04, 'glint'], [0.2, 'flash'], [0.44, 'hit']], lunge: [[0.1, 0], [0.2, 170]],
    phases: [[0, 0.1, 'a'], [0.1, 0.2, 's'], [0.2, 0.48, 'f'], [0.48, 0.7, 'r']],
    keys: Object.assign({
      aF: [[0.1, AU(1.3), 'snap'], [0.2, AU(0.1), 'out'], [0.48, AU(0.15), 'inout'], [0.7, AU(0.9)]],
      eF: [[0.1, 1.4, 'snap'], [0.2, 0.02, 'out'], [0.48, 0.05], [0.7, 0.7]],
      wAng: [[0.1, A(0.14)], [0.2, A(0.02)], [0.48, A(0.04)], [0.7, A(0.38)]],
      wPush: [[0.1, -14, 'snap'], [0.2, 34, 'out'], [0.48, 30, 'inout'], [0.7, 0]],
      gAdj: [[0.06, 0.04]], ik: [[0.03, 1]],
      lean: [[0.1, 0.3, 'snap'], [0.2, 0.5, 'out'], [0.48, 0.46], [0.7, 0.28]],
      head: [[0.1, -0.12], [0.2, -0.05], [0.7, -0.12]],
      tuck: [[0.02, 0]],
    }, dashLegs(0.1, 0.15, 0.2, 0.7)),
  };

  // ---- staff: quick flicks from the low guard, then a blink forward and a fan of bolts ----
  const crouch = (t) => ({ legB: [[t, 0.56]], kB: [[t, 1.0]], legF: [[t, -0.62]], kF: [[t, 0.42]] });
  CLIPS.iaiB1 = {
    dur: 0.26, out: 0.1, cancel: 0.14, ev: [[0.085, 'hit']],
    phases: [[0, 0.06, 'a'], [0.06, 0.1, 's'], [0.1, 0.17, 'f'], [0.17, 0.26, 'r']],
    keys: Object.assign({
      aF: [[0.06, AU(1.15), 'snap'], [0.1, AU(0.1), 'out'], [0.26, AU(0.3)]],
      eF: [[0.06, 1.2, 'snap'], [0.1, 0.1, 'out'], [0.26, 0.4]],
      wAng: [[0.06, AWL(0.65), 'snap'], [0.1, AT(-0.2), 'out'], [0.26, AT(0.05)]],
      wPush: [[0.06, -6, 'snap'], [0.1, 12, 'out'], [0.26, 0]],
      gAdj: [[0.06, 0.04]], ik: [[0.04, 0]],
      lean: [[0.06, LU(0.28), 'snap'], [0.1, LU(0.36), 'out'], [0.26, LU(0.3)]],
      tuck: [[0.02, 0]],
    }, crouch(0.06)),
  };
  CLIPS.iaiB2 = {
    dur: 0.28, out: 0.1, cancel: 0.15, ev: [[0.095, 'hit']],
    phases: [[0, 0.07, 'a'], [0.07, 0.11, 's'], [0.11, 0.18, 'f'], [0.18, 0.28, 'r']],
    keys: Object.assign({
      aF: [[0.07, AU(-0.9), 'snap'], [0.11, AU(0.25), 'out'], [0.28, AU(0.4)]],
      eF: [[0.07, 0.3, 'snap'], [0.11, 0.1, 'out'], [0.28, 0.5]],
      wAng: [[0.07, AT(-1.4), 'snap'], [0.11, AT(0.05), 'out'], [0.28, AT(0.2)]],
      wPush: [[0.07, 0]], gAdj: [[0.06, 0.04]], ik: [[0.04, 0]],
      lean: [[0.07, LU(0.14), 'snap'], [0.11, LU(0.34), 'out'], [0.28, LU(0.3)]],
      tuck: [[0.02, 0]],
    }, crouch(0.07)),
  };
  CLIPS.iaiB3 = {
    dur: 0.62, out: 0.14, finisher: true, ghost: [0.08, 0.18], hitShape: 'fan', fan: [5, 0.16],
    ev: [[0.04, 'glint'], [0.26, 'hit']], lunge: [[0.08, 0], [0.18, 150]],
    phases: [[0, 0.08, 'a'], [0.08, 0.18, 's'], [0.18, 0.3, 's'], [0.3, 0.46, 'f'], [0.46, 0.62, 'r']],
    keys: Object.assign({
      aF: [[0.08, AU(1.2)], [0.18, AU(1.3)], [0.26, AU(-0.05), 'snap'], [0.46, AU(0.0)], [0.62, AU(0.3)]],
      eF: [[0.08, 1.1], [0.18, 1.2], [0.26, 0.05, 'snap'], [0.62, 0.4]],
      wAng: [[0.08, AWL(0.6)], [0.18, AWL(0.8)], [0.26, AT(-0.3), 'snap'], [0.46, AT(-0.25)], [0.62, AT(0.1)]],
      wPush: [[0.18, -6], [0.26, 14, 'snap'], [0.46, 10], [0.62, 0]],
      gAdj: [[0.06, 0.04]], ik: [[0.04, 0]],
      lean: [[0.08, 0.4], [0.18, 0.46], [0.26, LU(0.16), 'snap'], [0.62, LU(0.24)]],
      aB: [[0.18, 2.2], [0.26, RB(-0.8)], [0.62, RB(-0.4)]], eB: [[0.26, 0.6]],
      tuck: [[0.02, 0]],
    }, dashLegs(0.08, 0.13, 0.18, 0.62)),
  };

  // ======== attack set "storm" (whirlwind) ========
  // ---- sword / axe / greatsword / hammer: crash down from the shoulder, a spinning whirlwind (two hits all around),
  // then a leaping spin that ends in a ground slam ----
  CLIPS.stormS1 = {
    dur: 0.46, out: 0.14, cancel: 0.28, trail: [0.14, 0.24], ev: [[0.19, 'hit']], lunge: [[0.14, 0], [0.2, 20]],
    phases: [[0, 0.14, 'a'], [0.14, 0.2, 's'], [0.2, 0.3, 'f'], [0.3, 0.46, 'r']],
    keys: {
      hk: [[0.1, 1], [0.16, 0]], hx: [[0.1, -2]], hy: [[0.1, -40]], wz: [[0.14, 1, 'step'], [0.15, 0]], ik: [[0.05, 1]],
      aF: [[0.14, -2.0, 'in'], [0.2, AS(1.0), 'out'], [0.3, AW(1.15), 'inout'], [0.46, AW(1.08)]],
      eF: [[0.14, 1.4, 'in'], [0.2, 0.05], [0.46, 0.12]],
      wAng: [[0.12, -2.3, 'out'], [0.14, -2.25, 'in'], [0.2, ASL(0.9), 'out'], [0.3, AWL(1.18), 'inout'], [0.46, AWL(1.1)]],
      lean: [[0.12, -0.16, 'out'], [0.14, -0.17, 'in'], [0.2, 0.36, 'out'], [0.3, 0.42], [0.46, 0.36]],
      head: [[0.12, -0.14], [0.2, 0.1], [0.46, 0.08]],
      sq: [[0.12, 0.97], [0.2, 1.0, 'snap'], [0.24, 0.95, 'out'], [0.36, 1]],
      legB: [[0.12, 0.36], [0.2, 0.64, 'out'], [0.46, 0.6]], kB: [[0.12, 0.45], [0.2, 0.95], [0.46, 0.85]],
      legF: [[0.12, -0.36], [0.2, -0.6, 'out'], [0.46, -0.56]], kF: [[0.12, 0.35], [0.2, 0.45], [0.46, 0.45]],
      tuck: [[0.02, 0]], wPush: [[0.05, 0]],
    },
  };
  CLIPS.stormS2 = { // whirlwind: a full turn with the weapon held out, cutting everything around
    dur: 0.56, out: 0.14, cancel: 0.38, trail: [0.12, 0.36], hitShape: 'around', hitMul: 0.62,
    ev: [[0.19, 'hit'], [0.31, 'hit']], lunge: [[0.1, 0], [0.34, 34]],
    phases: [[0, 0.1, 'a'], [0.1, 0.34, 's'], [0.34, 0.44, 'f'], [0.44, 0.56, 'r']],
    keys: {
      turn: [[0.1, 0, 'inout'], [0.34, TAU, 'step'], [0.341, 0]],
      aF: [[0.1, 2.3, 'snap'], [0.16, A(0.2)], [0.34, A(0.2)], [0.44, A(0.6)], [0.56, A(0.7)]],
      eF: [[0.1, 0.5, 'snap'], [0.16, 0.05], [0.44, 0.1], [0.56, 0.2]],
      wAng: [[0.1, 2.7, 'snap'], [0.16, A(0.25)], [0.34, A(0.3), 'out'], [0.44, A(0.65)], [0.56, A(0.75)]],
      ik: [[0.05, TWO]], hk: [[0.06, 0]], wz: [[0.06, 0]],
      aB: [[0.16, RB(-1.2)], [0.34, RB(-1.2)], [0.56, RB(-0.6)]], eB: [[0.16, 0.2]],
      lean: [[0.1, -0.12, 'snap'], [0.16, 0.16], [0.34, 0.18], [0.56, 0.24]],
      head: [[0.1, -0.08], [0.34, 0.02]],
      y: [[0.12, 0], [0.22, -8, 'inout'], [0.34, 0]],
      legB: [[0.1, 0.5], [0.34, 0.5], [0.56, 0.55]], kB: [[0.1, 0.8], [0.22, 0.4], [0.34, 0.75], [0.56, 0.8]],
      legF: [[0.1, -0.5], [0.34, -0.5], [0.56, -0.52]], kF: [[0.1, 0.7], [0.22, 0.35], [0.34, 0.65], [0.56, 0.6]],
      tuck: [[0.02, 0]], wPush: [[0.05, 0]],
    },
  };
  CLIPS.stormS3 = { // meteor: crouch, leap spinning, weapon overhead at the top, slam
    dur: 0.88, out: 0.16, finisher: true, trail: [0.42, 0.52], hitShape: 'slam', slamR: 200,
    ev: [[0.5, 'hit']], lunge: [[0.14, 0], [0.5, 46]],
    phases: [[0, 0.14, 'a'], [0.14, 0.42, 'a'], [0.42, 0.5, 's'], [0.5, 0.62, 'f'], [0.62, 0.88, 'r']],
    keys: {
      y: [[0.14, 0, 'out'], [0.32, -66, 'inout'], [0.42, -60, 'in'], [0.5, 0]],
      turn: [[0.16, 0, 'inout'], [0.38, TAU, 'step'], [0.381, 0]],
      sq: [[0.12, 0.9, 'out'], [0.2, 1.08], [0.3, 1.0], [0.5, 1.0, 'snap'], [0.54, 0.9, 'out'], [0.68, 1.0]],
      kB: [[0.12, 1.15, 'out'], [0.2, 0.4], [0.32, 0.95], [0.46, 0.5, 'snap'], [0.52, 1.15, 'out'], [0.88, 0.85]],
      kF: [[0.12, 1.2, 'out'], [0.2, 0.5], [0.32, 1.05], [0.46, 0.6, 'snap'], [0.52, 1.2, 'out'], [0.88, 0.9]],
      legB: [[0.12, 0.36], [0.3, 0.55], [0.5, 0.6], [0.88, 0.55]],
      legF: [[0.12, -0.3], [0.3, 0.1], [0.5, -0.5], [0.88, -0.46]],
      aF: [[0.14, -1.9, 'out'], [0.3, -2.1], [0.42, AW(-2.5), 'in'], [0.5, AW(1.3), 'out'], [0.88, AW(1.2)]],
      eF: [[0.14, 1.3], [0.3, 0.1], [0.42, 0.5, 'in'], [0.5, 0.05], [0.88, 0.1]],
      wAng: [[0.14, -2.35, 'out'], [0.3, -2.6], [0.42, AW(-2.9), 'in'], [0.5, AWL(1.2), 'out'], [0.6, AWL(1.0)], [0.88, AWL(1.1)]],
      lean: [[0.14, 0.22], [0.3, 0.05], [0.42, -0.2, 'in'], [0.5, 0.45, 'out'], [0.88, 0.36]],
      head: [[0.14, -0.1], [0.42, -0.14], [0.5, 0.14], [0.88, 0.1]],
      ik: [[0.05, TWO]], hk: [[0.1, 0]], wz: [[0.1, 0]], tuck: [[0.02, 0]], wPush: [[0.05, 0]],
    },
  };

  // ---- greatsword style: a rising slash out of a low drag, an overhead cleave that bites into the ground, a leap that
  // drives the blade into the earth (shockwave). The hands are placed with IK (hk: hx, hy from the pelvis); wLen
  // foreshortens the blade while it sweeps under the hands, so it passes the body instead of cutting the ground ----
  CLIPS.gsRise = {
    dur: 0.56, out: 0.14, cancel: 0.34, trail: [0.2, 0.33], ev: [[0.17, 'glint'], [0.245, 'hit']], lunge: [[0.2, 0], [0.26, 22]],
    phases: [[0, 0.2, 'a'], [0.2, 0.26, 's'], [0.26, 0.36, 'f'], [0.36, 0.56, 'r']],
    keys: {
      hk: [[0.06, 1]], plant: [[0.06, 0]],
      // (the hands end up behind the head: a chibi's arms can't reach above it, and in front they'd cover the face)
      hx: [[0.08, 2], [0.16, -18, 'inout'], [0.2, -19, 'in'], [0.23, 2, 'lin'], [0.25, 14, 'out'], [0.29, -14, 'out'], [0.36, -30], [0.56, -29]],
      hy: [[0.08, -4], [0.16, -6, 'inout'], [0.2, -5, 'in'], [0.23, -3, 'lin'], [0.25, -22, 'out'], [0.29, -54, 'out'], [0.36, -60], [0.56, -58]],
      wAng: [[0.08, 1.6], [0.16, 2.75, 'inout'], [0.2, 2.8, 'in'], [0.23, 1.45, 'lin'], [0.25, A(-0.35), 'out'], [0.29, -1.6, 'out'], [0.36, -2.3], [0.56, -2.25]],
      wLen: [[0.08, 0.45], [0.16, 1, 'inout'], [0.2, 1, 'in'], [0.23, 0.35, 'lin'], [0.25, 1]],
      wz: [[0.27, 0, 'step'], [0.28, 1]],
      ik: [[0.05, TWO]],
      lean: [[0.16, 0.3, 'inout'], [0.2, 0.32, 'in'], [0.25, 0.05, 'out'], [0.3, -0.16], [0.56, -0.12]],
      head: [[0.16, 0.12], [0.25, -0.05], [0.3, -0.16], [0.56, -0.12]],
      y: [[0.22, 0, 'out'], [0.29, -7, 'in'], [0.36, 0]],
      sq: [[0.18, 0.93], [0.24, 1.06, 'out'], [0.36, 1.0]],
      aB: [[0.16, RB(0.7)], [0.25, RB(-0.9)], [0.36, RB(-1.3)]], eB: [[0.16, 0.5], [0.25, 0.3]],
      legB: [[0.16, 0.5], [0.25, 0.42], [0.56, 0.4]], kB: [[0.16, 1.0], [0.25, 0.35, 'out'], [0.36, 0.5], [0.56, 0.55]],
      legF: [[0.16, -0.48], [0.25, -0.3], [0.56, -0.36]], kF: [[0.16, 0.8], [0.25, 0.25, 'out'], [0.36, 0.45], [0.56, 0.48]],
      tuck: [[0.03, 0]], wPush: [[0.05, 0]],
    },
  };
  CLIPS.gsCleave = {
    dur: 0.5, out: 0.14, cancel: 0.3, trail: [0.12, 0.18], ev: [[0.15, 'hit'], [0.17, 'dust']], lunge: [[0.11, 0], [0.17, 18]],
    phases: [[0, 0.12, 'a'], [0.12, 0.17, 's'], [0.17, 0.27, 'f'], [0.27, 0.5, 'r']],
    keys: {
      hk: [[0.04, 1], [0.165, 1, 'step'], [0.17, 0]],
      hx: [[0.12, -18, 'in'], [0.14, 6, 'lin'], [0.15, 18, 'out'], [0.17, 16]],
      hy: [[0.12, -60, 'in'], [0.14, -46, 'lin'], [0.15, -22, 'out'], [0.17, -8]],
      // the blade bites into the ground in front and stays there for a moment (planted, point buried)
      plant: [[0.04, 0], [0.165, 0, 'step'], [0.17, 1], [0.27, 1, 'inout'], [0.36, 0]],
      pX: [[0.17, 18]], pY: [[0.17, -31]], pG: [[0.17, 4]],
      wAng: [[0.12, -2.55, 'in'], [0.14, -1.3, 'lin'], [0.15, A(0.05), 'out'], [0.17, 0.47], [0.27, 0.47], [0.5, 0.45]],
      wz: [[0.12, 1, 'step'], [0.13, 0]],
      ik: [[0.04, TWO]],
      lean: [[0.12, -0.2, 'in'], [0.16, 0.36, 'out'], [0.27, 0.4], [0.5, 0.18]],
      head: [[0.12, -0.14], [0.16, 0.12], [0.5, -0.04]],
      sq: [[0.1, 1.04], [0.16, 1.0, 'snap'], [0.19, 0.93, 'out'], [0.3, 1.0]],
      y: [[0.1, -3, 'in'], [0.15, 0]],
      aB: [[0.12, RB(-1.6)], [0.17, RB(0.4)]], eB: [[0.12, 0.4], [0.17, 0.3]],
      legB: [[0.12, 0.36], [0.17, 0.58, 'out'], [0.5, 0.42]], kB: [[0.12, 0.35], [0.17, 0.95, 'out'], [0.5, 0.62]],
      legF: [[0.12, -0.3], [0.17, -0.52, 'out'], [0.5, -0.4]], kF: [[0.12, 0.3], [0.17, 0.62, 'out'], [0.5, 0.5]],
      tuck: [[0.02, 0]], wPush: [[0.04, 0]],
    },
  };
  CLIPS.gsLeap = {
    dur: 0.96, out: 0.16, finisher: true, trail: [0.36, 0.47], ghost: [0.36, 0.46], hitShape: 'slam', slamR: 230,
    ev: [[0.15, 'glint'], [0.46, 'hit']], lunge: [[0.16, 0], [0.44, 70]],
    phases: [[0, 0.16, 'a'], [0.16, 0.38, 'a'], [0.38, 0.46, 's'], [0.46, 0.7, 'f'], [0.7, 0.96, 'r']],
    keys: {
      hk: [[0.04, 1], [0.455, 1, 'step'], [0.46, 0]],
      hx: [[0.1, -14], [0.16, -16], [0.26, -22, 'out'], [0.36, -30], [0.42, 4, 'in'], [0.46, 12]],
      hy: [[0.1, -4], [0.16, -5], [0.26, -40, 'out'], [0.36, -62], [0.42, -52, 'in'], [0.46, -25]],
      wAng: [[0.08, 1.6], [0.16, 2.8, 'out'], [0.26, 3.4, 'out'], [0.36, 3.85, 'in'], [0.42, 5.2, 'in'], [0.46, 7.45], [0.7, 7.45, 'inout'], [0.84, 6.9], [0.96, 6.72]],
      wLen: [[0.08, 0.45], [0.16, 1]],
      wz: [[0.3, 0, 'step'], [0.31, 1], [0.41, 1, 'step'], [0.42, 0]],
      // landing: the blade goes in point-first and the hands stay on it while the shockwave goes out
      plant: [[0.04, 0], [0.455, 0, 'step'], [0.46, 1], [0.7, 1, 'inout'], [0.8, 0]],
      pX: [[0.46, 20]], pY: [[0.46, -42]], pG: [[0.46, 7]],
      ik: [[0.05, TWO]],
      y: [[0.16, 0, 'out'], [0.34, -96, 'inout'], [0.38, -92, 'in'], [0.46, 0]],
      sq: [[0.14, 0.88, 'out'], [0.22, 1.08], [0.34, 1.0], [0.46, 1.0, 'snap'], [0.5, 0.88, 'out'], [0.66, 1.0]],
      lean: [[0.14, 0.3], [0.3, -0.1], [0.38, -0.2, 'in'], [0.46, 0.42, 'out'], [0.7, 0.4, 'inout'], [0.96, 0.18]],
      head: [[0.14, 0.12], [0.3, -0.12], [0.38, -0.14], [0.46, 0.14], [0.96, -0.04]],
      aB: [[0.14, RB(0.7)], [0.3, RB(-1.8)], [0.46, RB(0.3)]], eB: [[0.14, 0.5], [0.3, 0.3], [0.46, 0.4]],
      legB: [[0.14, 0.42], [0.26, 0.6], [0.4, 0.5], [0.46, 0.58], [0.96, 0.42]],
      kB: [[0.14, 1.2, 'out'], [0.22, 0.4], [0.32, 1.35], [0.44, 0.6, 'snap'], [0.5, 1.2, 'out'], [0.7, 1.15], [0.96, 0.62]],
      legF: [[0.14, -0.36], [0.26, 0.25], [0.4, -0.1], [0.46, -0.5], [0.96, -0.4]],
      kF: [[0.14, 1.25, 'out'], [0.22, 0.5], [0.32, 1.3], [0.44, 0.5, 'snap'], [0.5, 1.25, 'out'], [0.7, 1.2], [0.96, 0.5]],
      tuck: [[0.02, 0]], wPush: [[0.04, 0]],
    },
  };

  // ---- bow: aim, draw to the cheek, loose (twice), then a slow full draw that looses three arrows. The bow arm (far)
  // points straight at the target with the bow upright across the line; the near hand (IK) draws the string (pull) ----
  const bowShot = (d, hit, big) => ({
    dur: d, out: 0.1, cancel: hit + 0.05, ev: [[hit, 'hit']], lunge: [[hit, 0], [hit + 0.04, -4]],
    phases: [[0, hit - 0.05, 'a'], [hit - 0.05, hit + 0.01, 's'], [hit + 0.01, hit + 0.08, 'f'], [hit + 0.08, d, 'r']],
    keys: {
      wFar: [[0.04, 1]], ik: [[0.02, (c) => (isXbow(c) ? 1 : 0)]],
      aB: [[0.07, AU(0), 'out'], [d, AU(0.06)]], eB: [[0.07, 0.06], [d, 0.12]],
      // (a bow stands upright across the line of the shot; a crossbow lies along it)
      wAng: [[0.07, (c) => c.al + (isXbow(c) ? 0 : -1.57), 'out'], [d, (c) => c.al + (isXbow(c) ? 0.02 : -1.5)]],
      hk: [[0.04, (c) => (isXbow(c) ? 0 : 1)], [d - 0.05, (c) => (isXbow(c) ? 0 : 1)], [d, 0]],
      hx: [[0.07, 16], [hit, big ? -3 : 0, 'in'], [hit + 0.04, -9, 'out'], [d, 4]],
      hy: [[0.07, -34], [hit, -45, 'in'], [hit + 0.04, -42], [d, -36]],
      pull: [[0.07, 0.1], [hit, 1, 'in'], [hit + 0.006, 0, 'step'], [d, 0]],
      lean: [[0.07, LU(0.04)], [hit, LU(big ? -0.1 : -0.04)], [hit + 0.05, LU(0.03)], [d, LU(0.06)]],
      head: [[0.07, 0.04], [hit, 0.08], [d, 0.02]],
      legB: [[0.07, 0.36], [d, 0.36]], kB: [[0.07, 0.52], [d, 0.52]], legF: [[0.07, -0.34], [d, -0.34]], kF: [[0.07, 0.44], [d, 0.44]],
      tuck: [[0.02, 0]], wPush: [[0.04, 0]], wz: [[0.04, 0]],
    },
  });
  CLIPS.bow1 = bowShot(0.3, 0.15);
  CLIPS.bow2 = bowShot(0.28, 0.13);
  CLIPS.bow3 = Object.assign(bowShot(0.52, 0.34, true), { finisher: true });

  // ---- spear: a sweeping swing of the shaft, a twirl like a propeller (three hits), a leap and a plunging dive ----
  CLIPS.stormT1 = {
    dur: 0.42, out: 0.12, cancel: 0.25, trail: [0.12, 0.22], hitShape: 'arc', ev: [[0.165, 'hit']], lunge: [[0.12, 0], [0.18, 16]],
    phases: [[0, 0.12, 'a'], [0.12, 0.18, 's'], [0.18, 0.27, 'f'], [0.27, 0.42, 'r']],
    keys: {
      aF: [[0.12, -1.9, 'in'], [0.18, AS(0.9), 'out'], [0.27, AW(1.1)], [0.42, AW(1.0)]],
      eF: [[0.12, 1.2, 'in'], [0.18, 0.15], [0.42, 0.3]],
      wAng: [[0.12, AW(-2.35), 'in'], [0.18, AS(0.75), 'out'], [0.27, AWL(1.0)], [0.42, AWL(0.9)]],
      gAdj: [[0.08, 0.16]], ik: [[0.03, 1]],
      lean: [[0.12, -0.14, 'in'], [0.18, 0.32, 'out'], [0.42, 0.28]],
      head: [[0.12, -0.1], [0.18, 0.08]],
      legB: [[0.12, 0.36], [0.18, 0.6, 'out'], [0.42, 0.56]], kB: [[0.12, 0.5], [0.18, 0.9], [0.42, 0.8]],
      legF: [[0.12, -0.36], [0.18, -0.58, 'out'], [0.42, -0.54]], kF: [[0.12, 0.4], [0.18, 0.4], [0.42, 0.42]],
      tuck: [[0.02, 0]], wPush: [[0.05, 0]],
    },
  };
  CLIPS.stormT2 = {
    dur: 0.56, out: 0.14, cancel: 0.4, trail: [0.1, 0.4], hitShape: 'arc', hitMul: 0.45,
    ev: [[0.17, 'hit'], [0.26, 'hit'], [0.35, 'hit']], lunge: [[0.08, 0], [0.4, 26]],
    phases: [[0, 0.08, 'a'], [0.08, 0.4, 's'], [0.4, 0.46, 'f'], [0.46, 0.56, 'r']],
    keys: {
      aF: [[0.08, A(0.6)], [0.12, A(-0.05)], [0.4, A(0.0)], [0.56, A(0.6)]],
      eF: [[0.08, 0.8], [0.12, 0.15], [0.4, 0.15], [0.56, 0.6]],
      wAng: [[0.08, A(0.3), 'lin'], [0.4, A(0.3 - 2 * TAU), 'step'], [0.401, A(0.3)], [0.56, A(0.5)]],
      gAdj: [[0.08, 0.2]], ik: [[0.06, 0]],
      aB: [[0.12, 2.4], [0.4, 2.3], [0.56, RB(0)]], eB: [[0.12, 0.3]],
      lean: [[0.08, 0.1], [0.4, 0.14], [0.56, 0.2]],
      legB: [[0.08, 0.46], [0.56, 0.5]], kB: [[0.08, 0.6], [0.56, 0.65]], legF: [[0.08, -0.46], [0.56, -0.5]], kF: [[0.08, 0.5], [0.56, 0.5]],
      tuck: [[0.02, 0]], wPush: [[0.05, 0]],
    },
  };
  CLIPS.stormT3 = { // leap high, the spear turned point-down, and dive onto the target
    dur: 0.94, out: 0.16, finisher: true, trail: [0.4, 0.5], hitShape: 'slam', slamR: 180,
    ev: [[0.48, 'hit']], lunge: [[0.14, 0], [0.46, 70]],
    phases: [[0, 0.14, 'a'], [0.14, 0.4, 'a'], [0.4, 0.48, 's'], [0.48, 0.64, 'f'], [0.64, 0.94, 'r']],
    keys: {
      y: [[0.14, 0, 'out'], [0.34, -84, 'inout'], [0.4, -80, 'in'], [0.48, 0]],
      sq: [[0.12, 0.9, 'out'], [0.2, 1.08], [0.3, 1.0], [0.48, 1.0, 'snap'], [0.52, 0.9, 'out'], [0.66, 1.0]],
      kB: [[0.12, 1.15, 'out'], [0.2, 0.4], [0.34, 1.0], [0.46, 0.5, 'snap'], [0.52, 1.2, 'out'], [0.94, 0.9]],
      kF: [[0.12, 1.2, 'out'], [0.2, 0.5], [0.34, 1.1], [0.46, 0.6, 'snap'], [0.52, 1.25, 'out'], [0.94, 0.95]],
      legB: [[0.12, 0.36], [0.34, 0.5], [0.48, 0.62], [0.94, 0.58]],
      legF: [[0.12, -0.3], [0.34, 0.05], [0.48, -0.5], [0.94, -0.48]],
      aF: [[0.14, A(1.0)], [0.32, -2.0, 'out'], [0.4, -2.1, 'in'], [0.48, 0.9, 'out'], [0.94, 0.95]],
      eF: [[0.14, 0.8], [0.32, 0.3], [0.4, 0.2], [0.48, 0.2], [0.94, 0.3]],
      wAng: [[0.14, A(0.2)], [0.32, 1.3, 'out'], [0.48, 1.25], [0.94, 1.2]],
      wPush: [[0.32, -10], [0.4, -14, 'snap'], [0.48, 20, 'out'], [0.7, 18], [0.94, 0]],
      gAdj: [[0.1, 0]], ik: [[0.03, 1]],
      lean: [[0.14, 0.2], [0.32, -0.1], [0.4, -0.12, 'in'], [0.48, 0.42, 'out'], [0.94, 0.3]],
      head: [[0.32, 0.1], [0.48, 0.2], [0.94, 0.12]],
      tuck: [[0.02, 0]],
    },
  };

  // ---- staff: a twirl then a bolt, a spin that casts a spread, and a nova: bolts bursting all around ----
  const heavyLegs = (t) => ({ legB: [[t, 0.46]], kB: [[t, 0.6]], legF: [[t, -0.46]], kF: [[t, 0.48]] });
  CLIPS.stormB1 = {
    dur: 0.42, out: 0.12, cancel: 0.26, trail: [0.06, 0.24], ev: [[0.24, 'hit']],
    phases: [[0, 0.06, 'a'], [0.06, 0.24, 's'], [0.24, 0.32, 'f'], [0.32, 0.42, 'r']],
    keys: Object.assign({
      aF: [[0.06, AU(0.4)], [0.2, AU(0.0)], [0.24, AU(-0.1), 'out'], [0.42, AU(0.2)]],
      eF: [[0.06, 0.6], [0.24, 0.15], [0.42, 0.4]],
      wAng: [[0.06, A(0.0), 'inout'], [0.24, A(-0.35 - TAU), 'step'], [0.241, A(-0.35)], [0.42, A(-0.3)]],
      gAdj: [[0.06, 0.2], [0.2, 0.2], [0.26, 0.0]], ik: [[0.04, 0]],
      lean: [[0.06, LU(0.08)], [0.24, LU(0.16)], [0.42, LU(0.12)]],
      tuck: [[0.02, 0]], wPush: [[0.05, 0]],
    }, heavyLegs(0.06)),
  };
  CLIPS.stormB2 = {
    dur: 0.5, out: 0.12, cancel: 0.32, trail: [0.08, 0.3], hitShape: 'fan', fan: [3, 0.14], ev: [[0.3, 'hit']],
    phases: [[0, 0.06, 'a'], [0.06, 0.3, 's'], [0.3, 0.38, 'f'], [0.38, 0.5, 'r']],
    keys: Object.assign({
      turn: [[0.06, 0, 'inout'], [0.28, TAU, 'step'], [0.281, 0]],
      aF: [[0.06, AU(0.9)], [0.16, AU(-0.3)], [0.3, AU(-0.1), 'out'], [0.5, AU(0.2)]],
      eF: [[0.06, 0.8], [0.16, 0.2], [0.3, 0.1], [0.5, 0.4]],
      wAng: [[0.06, AW(1.2)], [0.16, AT(-0.6)], [0.3, AT(-0.35), 'out'], [0.5, AT(-0.3)]],
      gAdj: [[0.06, 0]], ik: [[0.04, 0]],
      aB: [[0.16, RB(-1.0)], [0.3, RB(-0.6)]],
      lean: [[0.06, LU(0.02)], [0.3, LU(0.16)], [0.5, LU(0.12)]],
      tuck: [[0.02, 0]], wPush: [[0.05, 0]],
    }, heavyLegs(0.06)),
  };
  CLIPS.stormB3 = { // nova: hop with the staff raised in both hands, slam the crystal into the ground: bolts burst out
    dur: 0.8, out: 0.14, finisher: true, trail: [0.3, 0.44], hitShape: 'nova', ev: [[0.12, 'charge'], [0.43, 'hit']],
    phases: [[0, 0.3, 'a'], [0.3, 0.43, 's'], [0.43, 0.58, 'f'], [0.58, 0.8, 'r']],
    keys: {
      y: [[0.16, 0], [0.3, -26, 'in'], [0.42, 0]],
      sq: [[0.14, 0.92], [0.26, 1.06], [0.42, 1.0, 'snap'], [0.46, 0.9, 'out'], [0.6, 1.0]],
      kB: [[0.14, 1.0], [0.26, 0.3], [0.42, 1.0, 'out'], [0.8, 0.8]], kF: [[0.14, 1.0], [0.26, 0.35], [0.42, 1.05, 'out'], [0.8, 0.85]],
      legB: [[0.14, 0.3], [0.42, 0.5], [0.8, 0.46]], legF: [[0.14, -0.3], [0.42, -0.5], [0.8, -0.46]],
      aF: [[0.14, AW(1.0)], [0.3, -1.9, 'in'], [0.43, AW(0.9), 'out'], [0.8, AW(0.85)]],
      eF: [[0.14, 0.8], [0.3, 0.9, 'in'], [0.43, 0.1], [0.8, 0.2]],
      wAng: [[0.14, AW(0.3)], [0.3, AW(-2.6), 'in'], [0.43, AW(0.95), 'out'], [0.8, AW(0.9)]],
      gAdj: [[0.06, 0]], ik: [[0.04, 1]],
      lean: [[0.14, 0.12], [0.3, -0.14, 'in'], [0.43, 0.36, 'out'], [0.8, 0.3]],
      head: [[0.3, -0.16], [0.43, 0.12], [0.8, 0.08]],
      tuck: [[0.02, 0]], wPush: [[0.05, 0]],
    },
  };

  // a fidget for the shoulder carry: tap the weapon on the shoulder twice, glance away
  CLIPS.fidgetTap = {
    dur: 1.4, in: 0.15, out: 0.25, inCurve: 'inout', fidget: true,
    keys: {
      hy: [[0.2, -33, 'out'], [0.3, -28, 'in'], [0.46, -33, 'out'], [0.56, -28, 'in'], [1.4, -30]],
      wAng: [[0.2, -2.48, 'out'], [0.3, -2.64, 'in'], [0.46, -2.48, 'out'], [0.56, -2.64, 'in'], [1.4, -2.62]],
      head: [[0.2, -0.13], [0.56, -0.15], [0.9, 0.02, 'inout'], [1.4, -0.09]],
      lean: [[0.3, -0.07], [0.9, -0.02], [1.4, -0.05]],
    },
  };

  const BASE = { idle, idleShoulder, idlePlant, idleHilt, idleLow, idleBow, ready, readyIai, readyHeavy, readyLow, readyBow, walk, walkReady, walkLow, run, runReady, runLow, dash };

  // ---------------- the move sets ----------------
  const IDLES = ['idle', 'idleShoulder', 'idlePlant', 'idleHilt', 'idleLow', 'idleBow'];
  const FIDGETS = { idle: ['fidgetStretch', 'fidgetLook'], idleShoulder: ['fidgetTap', 'fidgetLook'], idlePlant: ['fidgetLook'], idleHilt: ['fidgetLook'], idleLow: ['fidgetLook'], idleBow: ['fidgetLook'] };
  const SETS = {
    basic: { ready: 'ready', combo: { swing: ['swing1', 'swing2', 'swing3'], thrust: ['thrust1', 'thrust2', 'thrust3'], smash: ['smash1', 'smash2', 'smash3'], bolt: ['bolt1', 'bolt2', 'bolt3'], arrow: ['bow1', 'bow2', 'bow3'] } },
    blade: { ready: 'readyIai', combo: { swing: ['iaiS1', 'iaiS2', 'iaiS3'], thrust: ['iaiT1', 'iaiT2', 'iaiT3'], smash: ['iaiS1', 'iaiS2', 'iaiS3'], bolt: ['iaiB1', 'iaiB2', 'iaiB3'] } },
    storm: { ready: 'readyHeavy', combo: { swing: ['stormS1', 'stormS2', 'stormS3'], thrust: ['stormT1', 'stormT2', 'stormT3'], smash: ['stormS1', 'stormS2', 'stormS3'], bolt: ['stormB1', 'stormB2', 'stormB3'] } },
    heavy: { ready: 'readyLow', combo: { swing: ['gsRise', 'gsCleave', 'gsLeap'], smash: ['gsRise', 'gsCleave', 'gsLeap'] } },
    archer: { ready: 'readyBow', combo: { arrow: ['bow1', 'bow2', 'bow3'] } },
  };
  const COMBO = SETS.basic.combo;
  const WALKS = {}; // idle style or fighting stance -> its own walk cycle (templates)
  WALKS.readyLow = 'walkLow'; RUNS.readyLow = 'runLow'; // the low stance moves with the blade trailing behind
  // the player's own combo ("custom": any three attacks from any set or template, and a stance)
  const CUSTOM = { ready: 'ready', combo: ['swing1', 'swing2', 'swing3'] };
  // what a player's move choice resolves to: the fighting stance, and the combo for a weapon style
  function setOf(moves) {
    const id = moves && moves.set;
    if (id === 'custom') {
      const cu = (moves && moves.custom) || CUSTOM;
      const ok = cu.combo && cu.combo.length === 3 && cu.combo.every((n) => CLIPS[n]);
      return { ready: BASE[cu.ready] ? cu.ready : 'ready', combo: () => (ok ? cu.combo : COMBO.swing) };
    }
    const S = SETS[id] || SETS.basic;
    return { ready: S.ready, combo: (style) => S.combo[style] || COMBO[style] };
  }
  const comboOf = (set, style, moves) => setOf(Object.assign({}, moves, { set })).combo(style);
  // a weapon can come with its own moves (W.sig: the greatsword's low hold + combo). They are used for that weapon
  // unless the player turned weapon moves off in the lab (moves.sig === false)
  const movesFor = (moves, W) => (W && W.sig && !(moves && moves.sig === false) ? Object.assign({}, moves, W.sig) : moves);

  // an action lets go of whatever the stance was holding (a hand on the hip, a planted weapon, a spin...) unless it
  // keys that channel itself
  const RESET = { hk: 0, bk: 0, plant: 0, gAdj: 0, wz: 0, turn: 0, wFar: 0, wHide: 0, wLen: 1, wSheath: 0, aBack: 0 };
  function addClip(name, clip) {
    if (!clip.fidget) for (const ch in RESET) if (!clip.keys[ch]) clip.keys[ch] = [[0.06, RESET[ch]]];
    CLIPS[name] = clip;
  }
  for (const name in CLIPS) addClip(name, CLIPS[name]);

  // blending two poses: a weapon or body that went round a full turn (a twirl, a spin) takes the short way back
  const SPIN = new Set(['wAng', 'turn']);
  function mix(ch, a, b, u) {
    if (SPIN.has(ch)) { const d = a - b; if (Math.abs(d) > 1.25 * Math.PI) a -= TAU * Math.round(d / TAU); }
    return NC.lerp(a, b, u);
  }

  // ---------------- animation templates: a Spine kit's animations baked onto the rig ----------------
  // tools/spine_import.py turns a Spine export into assets/kits/<kit>.js, js/spinekit.js maps its bones onto the rig.
  // Every animation becomes a clip '<kit>:<animation>'. Loops (idle, walk, run...) also become base animations (walk
  // cycles follow the hero's steps); attacks find their hit moment, swing trail and phases from the weapon's tip: the
  // hit is where it moves forward fastest.
  const KITS = {};
  function kitAttack(b) {
    const S = b.samples, fps = (S.length - 1) / b.dur;
    // vx[i]: how fast the tip moves forward between samples i-1 and i
    const vx = S.map((s, i) => (i ? (s.tip[0] - S[i - 1].tip[0]) * fps : 0));
    let hi = 1;
    for (let i = 2; i < S.length; i++) if (vx[i] > vx[hi]) hi = i;
    // the strike: the run of samples around the peak that still move forward at half its speed; the hit is its
    // speed-weighted middle (a swing peaks sharply, a push forward spreads out)
    let a = hi, z = hi;
    while (a > 1 && vx[a - 1] > vx[hi] * 0.5) a--;
    while (z < S.length - 1 && vx[z + 1] > vx[hi] * 0.5) z++;
    let wsum = 0, tsum = 0;
    for (let i = a; i <= z; i++) { wsum += vx[i]; tsum += vx[i] * (i - 0.5); }
    const hit = Math.min(b.dur - 0.02, tsum / wsum / fps);
    const t0 = Math.max(0, (a - 1.5) / fps), t1 = Math.min(b.dur, (z + 0.5) / fps);
    const keys = Object.assign(b.keys, { tuck: [[0.03, 0]], wPush: [[0.05, 0]], ik: [[0.05, TWO]], wFar: [[0.04, 1]] });
    return {
      dur: b.dur, out: 0.12, cancel: Math.min(b.dur - 0.03, hit + 0.1), trail: [t0, t1], ev: [[hit, 'hit']],
      lunge: [[t0, 0], [hit + 0.02, 14]], keys, kit: true,
      phases: [[0, t0, 'a'], [t0, hit + 0.02, 's'], [hit + 0.02, Math.min(b.dur, hit + 0.1), 'f'], [Math.min(b.dur, hit + 0.1), b.dur, 'r']],
    };
  }
  function kitLoop(name, steps) {
    return (t, c, P) => {
      const clip = CLIPS[name], ph = ((c.walk || 0) / TAU) % 1;
      const u = steps ? (ph < 0 ? ph + 1 : ph) * clip.dur : t % clip.dur;
      for (const ch in clip.keys) P[ch] = sampleKeys(clip.keys[ch], u, c, P[ch]);
      P.tuck = 0; P.wBehind = false; P.ik = TWO(c); P.wPush = 0; P.wFar = 1;
    };
  }
  // spec: { loops: [...], walks: [...] (loops that step), attacks: [...], poses: [...] (one-shot, like a cheer) }
  function useKit(id, spec) {
    const data = NC.SPINE_KITS && NC.SPINE_KITS[id], K = NC.SpineKit;
    if (!data || !K) return false;
    const sk = K.load(data), names = [];
    const add = (anim, kind) => {
      if (!sk.animations[anim]) return;
      const name = id + ':' + anim, baked = K.bake(sk, anim, { aim: kind === 'attack' });
      if (kind === 'attack') addClip(name, kitAttack(baked));
      else {
        addClip(name, { dur: baked.dur, keys: Object.assign(baked.keys, { wFar: [[0.05, 1]], tuck: [[0.05, 0]] }), in: 0.1, out: 0.2, inCurve: 'inout', kit: true, fidget: kind === 'pose' });
        if (kind !== 'pose') BASE[name] = kitLoop(name, kind === 'walk');
      }
      names.push({ name, anim, kind });
    };
    for (const a of spec.loops || []) add(a, 'loop');
    for (const a of spec.walks || []) add(a, 'walk');
    for (const a of spec.attacks || []) add(a, 'attack');
    for (const a of spec.poses || []) add(a, 'pose');
    KITS[id] = { names, spine: data.spine };
    return true;
  }

  // the kit that ships with the game: a sword-and-shield template kit (51 animations)
  const K1 = 'animight', kn = (a) => K1 + ':' + a;
  if (useKit(K1, {
    loops: ['01_idle', '02_idle', '24_block_idle', '25_block_idle', '30_stealth_idle', '41_epic', '42_epic'],
    walks: ['03_walk', '04_walk', '05_run', '06_run', '21_walk_block', '22_walk_block', '27_block_run', '31_stealth_walk'],
    attacks: ['13_attack', '14_attack', '15_attack', '16_attack', '17_attack', '35_stealth_attack', '36_stealth_attack',
      '37_spell', '38_spell', '39_spell', '40_spell', '48_throwing', '49_throwing', '50_throwing'],
    poses: ['09_hit', '18_block', '19_block', '20_block'],
  })) {
    IDLES.push(kn('01_idle'), kn('24_block_idle'), kn('30_stealth_idle'));
    FIDGETS[kn('01_idle')] = FIDGETS[kn('24_block_idle')] = FIDGETS[kn('30_stealth_idle')] = [kn('41_epic_pose'), kn('42_epic_pose')];
    WALKS[kn('01_idle')] = kn('03_walk'); WALKS[kn('24_block_idle')] = kn('21_walk_block'); WALKS[kn('30_stealth_idle')] = kn('31_stealth_walk');
    // the epic poses also play once, as fidgets (raise the sword now and then)
    for (const a of ['41_epic', '42_epic']) addClip(kn(a + '_pose'), Object.assign({}, CLIPS[kn(a)], { fidget: true, in: 0.2, out: 0.3 }));
    const blade = [kn('17_attack'), kn('16_attack'), kn('14_attack')], spell = [kn('39_spell'), kn('37_spell'), kn('40_spell')];
    SETS.kitBlade = { ready: kn('02_idle'), combo: { swing: blade, thrust: [kn('16_attack'), kn('39_spell'), kn('14_attack')], smash: blade, bolt: spell } };
    const sneak = [kn('35_stealth_attack'), kn('36_stealth_attack'), kn('13_attack')];
    SETS.kitShadow = { ready: kn('30_stealth_idle'), combo: { swing: sneak, thrust: sneak, smash: sneak, bolt: [kn('38_spell'), kn('39_spell'), kn('40_spell')] } };
    WALKS[kn('02_idle')] = kn('04_walk'); WALKS[kn('30_stealth_idle')] = kn('31_stealth_walk');
    RUNS[kn('01_idle')] = kn('05_run'); RUNS[kn('02_idle')] = kn('06_run'); RUNS[kn('24_block_idle')] = kn('27_block_run');
    RUNS[kn('30_stealth_idle')] = kn('31_stealth_walk');
    CLIPS[kn('14_attack')].finisher = CLIPS[kn('13_attack')].finisher = CLIPS[kn('40_spell')].finisher = true;
  }

  function sampleKeys(keys, t, c, from, inCurve) {
    const k0 = keys[0];
    if (t < k0[0]) return NC.lerp(from, val(k0[1], c), CURVE[inCurve || 'out'](t / k0[0]));
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t < b[0]) return NC.lerp(val(a[1], c), val(b[1], c), CURVE[a[2] || 'inout']((t - a[0]) / (b[0] - a[0])));
    }
    return val(keys[keys.length - 1][1], c);
  }

  // apply a keyed clip at time t over pose P with weight w (skipping leg keys while walking)
  function applyClip(clip, t, c, P, w, moving) {
    const base = Object.assign({}, P);
    for (const ch in clip.keys) {
      if (moving && LOWER.has(ch)) continue;
      const v = sampleKeys(clip.keys[ch], t, c, base[ch], clip.inCurve);
      P[ch] = w >= 1 ? v : mix(ch, base[ch], v, w);
    }
    if (clip.keys.tuck || clip.keys.ik) P.wBehind = P.wBehind && w < 0.5;
  }

  function basePose(name, t, c) {
    const P = setup(c);
    if (BASE[name]) BASE[name](t, c, P);
    else if (CLIPS[name]) { idle(0, c, P); applyClip(CLIPS[name], Math.min(t, CLIPS[name].dur), c, P, 1, false); }
    return P;
  }

  // ---------------- animation state: a base track (with crossfades) + an action track on top ----------------
  function makeState() {
    return { base: 'idle', baseT: 0, from: null, mixT: 1, mixDur: 0, act: null, actT: 0, actIn: 0, outT: -1,
      actFrom: null, actFromT: 1, fidgetT: 0, nextFidget: 9, last: null };
  }

  function setBase(st, name, mix) {
    if (st.base === name) return;
    st.from = st.last ? Object.assign({}, st.last) : null;
    st.base = name; st.baseT = 0; st.mixT = 0; st.mixDur = mix;
  }

  function play(st, name) {
    // chaining straight from another action (combo): crossfade from where that one left the body
    st.actFrom = st.act && st.last ? Object.assign({}, st.last) : null;
    st.actFromT = 0;
    st.act = name; st.actT = 0; st.outT = -1;
    st.actIn = CLIPS[name].in === undefined ? 0.035 : CLIPS[name].in;
  }

  function stop(st) { if (st.act && st.outT < 0) st.outT = 0; }

  // advance time; events crossed on the action track are reported to onEvent(name, clip)
  function update(st, dt, speed, onEvent) {
    st.baseT += dt;
    st.mixT += dt;
    st.actFromT += dt;
    if (!st.act) return;
    const clip = CLIPS[st.act];
    const t0 = st.actT;
    st.actT += dt * (speed || 1);
    if (clip.ev && onEvent) for (const [te, name] of clip.ev) if (te > t0 && te <= st.actT) onEvent(name, clip, st.act);
    if (st.outT < 0 && st.actT >= clip.dur && !clip.hold) st.outT = 0;
    if (st.outT >= 0) {
      st.outT += dt;
      if (st.outT >= (clip.out || 0.1)) { st.act = null; st.outT = -1; }
    }
  }

  function evaluate(st, c) {
    let P = basePose(st.base, st.baseT, c);
    if (st.from && st.mixT < st.mixDur) {
      const u = CURVE.inout(st.mixT / st.mixDur), Q = st.from;
      for (const ch of CH) P[ch] = mix(ch, Q[ch], P[ch], u);
      if (u < 0.5) P.wBehind = Q.wBehind;
    }
    if (st.act) {
      const clip = CLIPS[st.act];
      let w = st.actIn > 0 ? Math.min(1, st.actT / st.actIn) : 1;
      if (st.outT >= 0) w *= 1 - CURVE.inout(Math.min(1, st.outT / (clip.out || 0.1)));
      applyClip(clip, Math.min(st.actT, clip.dur), c, P, w, c.moving);
      P.act = w * (st.actFrom && st.actFromT < 0.07 ? CURVE.out(st.actFromT / 0.07) : 1); // (how much an action plays: avatar.js lets the grip rule go during attacks; eased in like the clip's own start)
      if (st.actFrom && st.actFromT < 0.07) {
        const u = CURVE.out(st.actFromT / 0.07), Q = st.actFrom;
        for (const ch of CH) P[ch] = mix(ch, Q[ch], P[ch], u);
      }
    }
    // reactions on top: a quick flinch when hit
    if (c.hurt > 0) {
      const h = c.hurt;
      P.lean -= 0.28 * h; P.head -= 0.2 * h; P.aF -= 0.3 * h; P.aB -= 0.45 * h;
      P.eF += 0.3 * h; P.eB += 0.3 * h; P.kF += 0.25 * h; P.kB += 0.25 * h; P.x -= 3 * h;
    }
    st.last = P;
    return P;
  }

  // one-off sampling (animation lab, equipment screen, contact sheets): base clip, or an action clip over `over`
  function sample(name, t, c, over) {
    if (BASE[name] || name === 'death') return basePose(name, t, c);
    const clip = CLIPS[name];
    const P = basePose(over || (clip.fidget ? 'idle' : 'ready'), t, c);
    applyClip(clip, Math.min(t, clip.dur), c, P, 1, false);
    P.act = 1;
    return P;
  }

  // root motion: how far the clip has moved the body along the aim by time t
  function lungeAt(clip, t) {
    const L = clip.lunge;
    if (!L) return 0;
    if (t <= L[0][0]) return L[0][1];
    for (let i = 0; i < L.length - 1; i++)
      if (t < L[i + 1][0]) return NC.lerp(L[i][1], L[i + 1][1], CURVE.snap((t - L[i][0]) / (L[i + 1][0] - L[i][0])));
    return L[L.length - 1][1];
  }

  NC.Anim = { CLIPS, BASE, COMBO, SETS, IDLES, FIDGETS, WALKS, RUNS, KITS, CUSTOM, CURVE, comboOf, setOf, movesFor, useKit, addClip, makeState, setBase, play, stop, update, evaluate, sample, lungeAt, setup };
})();
