/* castmoves.js — staves and other casting foci held the way a hand really holds them (the user, 2026-10-06, after the
   axe: "ลองดูอาวุธอื่นด้วย"). The basic casts (anim.js bolt1-3) pointed the staff along the forearm with the fist up at the
   mouth, and bolt3 raised it overhead with the fist on the face and the shaft running down the arm. Here the shaft
   always crosses the forearm, as it does in a closed fist, and the hand stays in front of the chest:
     castBolt1  the staff drawn back upright, then presented: the arm reaches forward, the top tips toward the target
     castBolt2  the staff held upright at the belly, then swept up and forward to the target
     castBolt3  (the charged cast) lifted high ahead, the arm reaching up and forward (not over the face), then pointed
   Same timing, hit and charge moments as bolt1-3 (cloned from them, only the arm and the weapon re-keyed). For the
   staff, lantern, orb, bell and puppet bar (W.sig.set 'cast'); the instrument keeps its own for now. */
(function () {
  'use strict';
  const NC = window.NC, A = NC.Anim;
  if (!A || !A.addClip || !A.CLIPS.bolt1) return;
  // (aim-relative keys as anim.js's AU / AT / AW)
  const FRONT_UP = -Math.PI / 2 - 0.35, BACK_UP = -Math.PI - 0.1, DOWN = Math.PI / 2 + 0.25;
  const keep = (v, lo, hi, n) => NC.clamp(v, Math.min(lo, n), Math.max(hi, n));
  const AU = (n) => (c) => n + (c.al < 0 ? 0.2 * c.al : c.al);
  const AT = (n) => (c) => keep(n + (c.al < 0 ? 0.6 * c.al : c.al), FRONT_UP, DOWN, n);
  const AW = (n) => (c) => keep(n + (c.al < 0 ? 0.3 : 0.45) * c.al, BACK_UP, DOWN, n);
  const clip = (base, keys) => { const b = A.CLIPS[base]; return Object.assign({}, b, { keys: Object.assign({}, b.keys, keys) }); };

  A.addClip('castBolt1', clip('bolt1', {
    aF: [[0.07, AU(0.9), 'snap'], [0.11, AU(0.1), 'out'], [0.3, AU(0.3)]],
    eF: [[0.07, 0.6, 'snap'], [0.11, 0.12, 'out'], [0.3, 0.35]],
    wAng: [[0.07, AT(-1.75), 'snap'], [0.11, AT(-1.0), 'out'], [0.3, AT(-1.15)]],
  }));
  A.addClip('castBolt2', clip('bolt2', {
    aF: [[0.07, AU(0.95), 'snap'], [0.12, AU(-0.2), 'out'], [0.3, AU(-0.05)]],
    eF: [[0.07, 0.7, 'snap'], [0.12, 0.1, 'out'], [0.3, 0.3]],
    wAng: [[0.07, AW(-1.6), 'snap'], [0.12, AT(-1.15), 'out'], [0.3, AT(-1.2)]],
  }));
  A.addClip('castBolt3', clip('bolt3', {
    aF: [[0.26, AW(-0.35), 'in'], [0.34, AU(0.05), 'snap'], [0.62, AU(0.2)]],
    eF: [[0.26, 0.15], [0.34, 0.1], [0.62, 0.35]],
    wAng: [[0.26, -1.35, 'in'], [0.34, AT(-0.95), 'snap'], [0.62, AT(-1.1)]],
  }));
  const CAST = ['castBolt1', 'castBolt2', 'castBolt3'];
  A.SETS.cast = { ready: 'ready', combo: { bolt: CAST, swing: CAST, thrust: CAST, smash: CAST } };
  const USE = new Set(['staff', 'lantern', 'orb', 'bell', 'puppet']);
  for (const id in NC.ITEMS) {
    const W = NC.ITEMS[id];
    if (W.slot !== 'weapon' || !USE.has(NC.wtypeOf ? NC.wtypeOf(W) : W.wtype)) continue;
    if (W.style !== 'bolt') continue; // (only weapons that cast: a staff that hits keeps its blows)
    if (!(W.sig && W.sig.set)) W.sig = Object.assign({}, W.sig || {}, { set: 'cast' });
  }
})();
