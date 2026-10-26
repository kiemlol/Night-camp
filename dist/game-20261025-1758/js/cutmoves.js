/* cutmoves.js — one-handed blades and clubs cut with the grip across the fist (the user, 2026-10-06, after the axe:
   "ลองดูอาวุธอื่นด้วย"). The basic combo (anim.js swing1-3) ended its strikes with the blade lying along the forearm, the
   pommel running back into the wrist (swing1 / swing3 strikes and follow-throughs, swing2's high finish), and swing3's
   wind-up held the blade straight back along the forearm. The same three cuts, re-keyed so the handle always crosses
   the fist at 30 degrees or more, as a real wrist allows:
     cut1  diagonal slash: wound up over the shoulder, the blade cuts down and ends low ahead, angled forward
     cut2  rising backhand: from low behind up through the front, ending high with the blade back over the head
     cut3  jumping chop: loaded over the shoulder (like the axe), brought down ahead
   Timing, hits, steps and trails are the clips' own. For swords, maces, torches and twin swords (W.sig.set 'cut');
   weapons with their own set (greatswords, katanas) keep theirs. */
(function () {
  'use strict';
  const NC = window.NC, A = NC.Anim;
  if (!A || !A.addClip || !A.CLIPS.swing1) return;
  const FRONT_UP = -Math.PI / 2 - 0.35, BACK_UP = -Math.PI - 0.1, DOWN = Math.PI / 2 + 0.25;
  const keep = (v, lo, hi, n) => NC.clamp(v, Math.min(lo, n), Math.max(hi, n));
  const lowCap = (c, a) => {
    const L = c.wl || 60;
    if (L < 66) return a;
    const lim = Math.asin(NC.clamp(62 / L, 0, 1)) + 0.8 * Math.max(0, c.al || 0);
    if (a > lim && a < Math.PI / 2) return lim;
    if (a >= Math.PI / 2 && a < Math.PI - lim) return Math.PI - lim;
    return a;
  };
  const AS = (n) => (c) => keep(c.al + n, FRONT_UP, DOWN, n);
  const AW = (n) => (c) => keep(n + (c.al < 0 ? 0.3 : 0.45) * c.al, BACK_UP, DOWN, n);
  const ASL = (n) => (c) => lowCap(c, AS(n)(c));
  const AWL = (n) => (c) => lowCap(c, AW(n)(c));
  const clip = (base, keys) => { const b = A.CLIPS[base]; return Object.assign({}, b, { keys: Object.assign({}, b.keys, keys) }); };

  A.addClip('cut1', clip('swing1', {
    aF: [[0.1, AW(-2.05), 'snap'], [0.16, AS(0.75), 'out'], [0.24, AW(1.15), 'inout'], [0.36, AW(1.1)]],
    eF: [[0.1, 1.05, 'snap'], [0.16, 0.05, 'out'], [0.24, 0.12], [0.36, 0.2]],
    wAng: [[0.1, AW(-2.3), 'snap'], [0.16, ASL(0.05), 'out'], [0.24, AWL(0.5), 'inout'], [0.36, AWL(0.45)]],
  }));
  A.addClip('cut2', clip('swing2', {
    wAng: [[0.07, AW(2.0), 'snap'], [0.13, AS(-2.25), 'out'], [0.2, AW(-2.75), 'inout'], [0.32, AW(-2.6)]],
  }));
  A.addClip('cut3', clip('swing3', {
    aF: [[0.16, AW(0.75), 'out'], [0.25, AW(0.7), 'snap'], [0.31, AS(1.05), 'out'], [0.58, AW(1.05)]],
    eF: [[0.16, 2.0], [0.25, 2.05, 'snap'], [0.31, 0.06], [0.58, 0.12]],
    wAng: [[0.16, AW(-3.0), 'out'], [0.25, AW(-3.0), 'snap'], [0.31, ASL(0.45), 'out'], [0.4, AWL(0.5)], [0.58, AWL(0.55)]],
  }));
  const CUT = ['cut1', 'cut2', 'cut3'];
  A.SETS.cut = { ready: 'ready', combo: { swing: CUT, smash: CUT, thrust: CUT, bolt: CUT } };
  const USE = new Set(['sword', 'mace', 'torch', 'dsword']);
  for (const id in NC.ITEMS) {
    const W = NC.ITEMS[id];
    if (W.slot !== 'weapon' || W.style !== 'swing' || !USE.has(NC.wtypeOf ? NC.wtypeOf(W) : W.wtype)) continue;
    if (!(W.sig && W.sig.set)) W.sig = Object.assign({}, W.sig || {}, { set: 'cut' });
  }
})();
