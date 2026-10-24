/* axemoves.js — axes swing edge first (the user, 2026-10-06: "ท่าโจมตีเช่นขวาน ... เวลาตีมันต้องง้างแขนไปข้างหลังแล้ว
   ฟาดกลับมาข้างหน้าไม่ใช่หรอ แต่อันนี้เหมือนหน้าขวานหันผิดข้างตอนง้าง"). An axe has its edge on one side only: the upright
   picture's right, which is the side the weapon turns toward when it swings from overhead down to the front. The basic
   sword combo's 2nd cut is a rising backhand (low behind -> up), so an axe hit with the back of its head there; the
   heavy weapons' smash2 pushed forward and then held the weapon up in one hand. Axes now cut over the top only:
     axe (one-handed): axeChop1 (diagonal chop), axeChop2 (wind back over the shoulder, chop to chest height), axeChop3
                       (the jumping chop) — 1 and 3 are swing1 / swing3 with the head stopping in front, edge down
     great axe:        heavyChop1 / 2 / 3 (smash1, a two-handed chop2, smash3, stopping the same way)
     hammer:           smash1, heavyChop2, smash3 (no edge; only the 2nd hit that ended held up in one hand)
   through their own move sets (W.sig.set, like the greatsword's). The wind-ups lift the head back behind the shoulder
   with the edge up, the strikes bring it down and forward with the edge leading. */
(function () {
  'use strict';
  const NC = window.NC, A = NC.Anim;
  if (!A || !A.addClip) return;
  // (aim-relative keys, the same rules as anim.js's AS / AW / ASL / AWL: a strike follows the aim but never ends behind
  // the body, a wind-up / follow-through takes part of the aim; long weapons stop short of the ground)
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

  /* the hand holds the handle across the palm in every key (the user: "พอง้างแบบนี้มือก็จับไม่ถูกอีก" — an arm raised
     up-back with the elbow bent puts the handle along the forearm, through the wrist):
     - wind-up: the axe LOADED OVER THE SHOULDER: the fist at the chest, the forearm up, the handle back over the shoulder
       (about 90 degrees across the forearm), the axe head behind the neck, edge up
     - strike / follow-through: the arm reaching forward, the axe a little above the forearm's line (35-40 degrees: the
       wrist bent down as far as it goes), level ahead, edge down into what it hit */
  // (the load: upper arm down-forward ~0.75, elbow 2.0: the fist at the chest, the forearm up, the handle on the near
  // shoulder; the axe head is in front of the back of the head, as the near shoulder is: no wz)
  const LOW = -0.25; // (one hand: held near the end of the handle for the chop, not mid-handle with the butt poking ahead)
  const clip = (base, over) => {
    const b = A.CLIPS[base];
    return Object.assign({}, b, over, { keys: Object.assign({}, b.keys, over.keys) });
  };
  // one hand
  A.addClip('axeChop1', clip('swing1', { keys: {
    aF: [[0.1, AW(0.75), 'snap'], [0.16, AS(0.75), 'out'], [0.24, AW(0.95), 'inout'], [0.36, AW(1.05)]],
    eF: [[0.1, 2.0, 'snap'], [0.16, 0.05, 'out'], [0.24, 0.1], [0.36, 0.2]],
    wAng: [[0.1, AW(-3.0), 'snap'], [0.16, ASL(0.05), 'out'], [0.24, AWL(0.2), 'inout'], [0.36, AWL(0.35)]], gAdj: [[0.08, LOW], [0.36, LOW]],
  } }));
  A.addClip('axeChop2', {
    dur: 0.36, out: 0.12, cancel: 0.2, trail: [0.1, 0.2], ev: [[0.14, 'hit']], lunge: [[0.1, 0], [0.17, 14]],
    phases: [[0, 0.1, 'a'], [0.1, 0.16, 's'], [0.16, 0.24, 'f'], [0.24, 0.36, 'r']],
    keys: {
      aF: [[0.1, AW(0.75), 'in'], [0.16, AS(0.5), 'out'], [0.24, AW(0.75), 'inout'], [0.36, AW(0.95)]],
      eF: [[0.1, 2.0, 'in'], [0.16, 0.06, 'out'], [0.24, 0.1], [0.36, 0.2]],
      wAng: [[0.1, AW(-3.0), 'in'], [0.16, ASL(-0.2), 'out'], [0.24, AWL(-0.05), 'inout'], [0.36, AWL(0.15)]], gAdj: [[0.08, LOW], [0.36, LOW]],
      lean: [[0.1, -0.12, 'in'], [0.16, 0.22, 'out'], [0.24, 0.24], [0.36, 0.18]],
      head: [[0.1, -0.06], [0.16, 0.08], [0.36, 0.06]],
      aB: [[0.1, 0.45, 'in'], [0.16, 1.9, 'out'], [0.36, 1.55]], eB: [[0.1, 0.9], [0.16, 0.5], [0.36, 0.45]],
      legB: [[0.1, 0.28], [0.16, 0.5, 'out'], [0.36, 0.44]], kB: [[0.1, 0.5], [0.16, 0.62], [0.36, 0.58]],
      legF: [[0.1, -0.26], [0.16, -0.46, 'out'], [0.36, -0.4]], kF: [[0.1, 0.58], [0.16, 0.28], [0.36, 0.34]],
      tuck: [[0.03, 0]], wPush: [[0.1, 0]],
    },
  });
  A.addClip('axeChop3', clip('swing3', { keys: {
    aF: [[0.16, AW(0.75), 'out'], [0.25, AW(0.7), 'snap'], [0.31, AS(0.9), 'out'], [0.58, AW(1.0)]],
    eF: [[0.16, 2.0], [0.25, 2.05, 'snap'], [0.31, 0.05], [0.58, 0.15]],
    wAng: [[0.16, AW(-3.0), 'out'], [0.25, AW(-3.0), 'snap'], [0.31, ASL(0.15), 'out'], [0.4, AWL(0.25)], [0.58, AWL(0.4)]], gAdj: [[0.12, LOW], [0.58, LOW]],
  } }));
  // two hands (the other hand follows on the handle, ik)
  A.addClip('heavyChop1', clip('smash1', { keys: {
    aF: [[0.17, AW(0.75), 'in'], [0.23, AS(0.95), 'out'], [0.3, AW(1.0), 'inout'], [0.5, AW(1.05)]],
    eF: [[0.17, 2.0, 'in'], [0.23, 0.05], [0.5, 0.1]],
    wAng: [[0.17, AW(-3.0), 'in'], [0.23, ASL(0.25), 'out'], [0.3, AWL(0.35)], [0.5, AWL(0.45)]],
  } }));
  A.addClip('heavyChop2', {
    dur: 0.48, out: 0.14, cancel: 0.32, trail: [0.16, 0.25], ev: [[0.215, 'hit']], lunge: [[0.16, 0], [0.22, 14]],
    phases: [[0, 0.16, 'a'], [0.16, 0.22, 's'], [0.22, 0.3, 'f'], [0.3, 0.48, 'r']],
    keys: {
      aF: [[0.16, AW(0.75), 'in'], [0.22, AS(0.85), 'out'], [0.3, AW(0.95), 'inout'], [0.48, AW(1.05)]],
      eF: [[0.16, 2.0, 'in'], [0.22, 0.06, 'out'], [0.48, 0.12]],
      wAng: [[0.16, AW(-3.0), 'in'], [0.22, ASL(0.15), 'out'], [0.3, AWL(0.3)], [0.48, AWL(0.4)]],
      lean: [[0.16, -0.14, 'in'], [0.22, 0.28, 'out'], [0.48, 0.22]],
      sq: [[0.16, 0.97], [0.22, 1.0, 'snap'], [0.25, 0.95, 'out'], [0.38, 1]],
      head: [[0.16, -0.08], [0.22, 0.1], [0.48, 0.08]],
      legB: [[0.16, 0.3], [0.22, 0.5], [0.48, 0.44]], kB: [[0.16, 0.55], [0.22, 0.78], [0.48, 0.68]],
      legF: [[0.16, -0.28], [0.22, -0.46], [0.48, -0.4]], kF: [[0.16, 0.6], [0.22, 0.45], [0.48, 0.48]],
      tuck: [[0.03, 0]], ik: [[0.03, 1]], wPush: [[0.1, 0]],
    },
  });
  A.addClip('heavyChop3', clip('smash3', { keys: {
    aF: [[0.2, AW(0.75), 'out'], [0.3, AW(0.7), 'in'], [0.37, AS(1.0), 'out'], [0.74, AW(1.05)]],
    eF: [[0.2, 2.0], [0.3, 2.05, 'in'], [0.37, 0.05], [0.74, 0.1]],
    wAng: [[0.2, AW(-3.0), 'out'], [0.3, AW(-3.0), 'in'], [0.37, ASL(0.3), 'out'], [0.46, AWL(0.4)], [0.74, AWL(0.5)]],
  } }));

  const AXE = ['axeChop1', 'axeChop2', 'axeChop3'], HEAVY = ['heavyChop1', 'heavyChop2', 'heavyChop3'];
  A.SETS.axe = { ready: 'ready', combo: { swing: AXE, smash: AXE } };
  A.SETS.heavyAxe = { ready: 'ready', combo: { smash: HEAVY, swing: HEAVY } };
  // (the hammer and the scythe too: smash1 / smash3 ended with the hammer's handle standing down the arm, and the scythe,
  // a two-handed tool, swung one-handed through the sword's cuts; "ลองดูอาวุธอื่นด้วย")
  const SET_OF = { axe: 'axe', gaxe: 'heavyAxe', hammer: 'heavyAxe', scythe: 'heavyAxe' };
  // (set on the items before the game loads its art: poselib.js keeps a weapon's own sig when it adds a studio hold)
  for (const id in NC.ITEMS) {
    const W = NC.ITEMS[id];
    if (W.slot !== 'weapon') continue;
    const set = SET_OF[NC.wtypeOf ? NC.wtypeOf(W) : W.wtype];
    if (set && !(W.sig && W.sig.set)) W.sig = Object.assign({}, W.sig || {}, { set });
  }
})();
