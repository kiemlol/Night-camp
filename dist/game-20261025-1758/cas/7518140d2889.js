/* griphand.js — hands that really hold the weapon (the user, 2026-10-06: "นิ้วมันจับอาวุธไม่ถูก ... มันไม่ใช่สัดส่วนของด้าม
   ที่โดนอุ้งมือเวลากำมือ"). An arm picture rig_<rig>_armF can come with three more pictures of the same size
   (tools/grip_cut.py, drawn by Codex: assets/gen/nightcamp_grip_<rig>_raw.png):
     rig_<rig>_armF_nofist   the arm without its closed fist (the glove's cuff is its end)
     rig_<rig>_armF_gback    the holding hand's back: the palm and the thumb's root, open where the handle lies
     rig_<rig>_armF_gfront   the fingers (and the thumb's tip) that wrap over the handle
   gback's joints: wrist (where the hand turns, under the cuff), grip (the middle of the hole), and gax (the handle's
   direction through the hole, radians, in the picture). While the near hand holds a weapon, avatar.js draws the palm,
   then the weapon, the forearm, then the fingers, and turns the hand at the wrist (at most GRIP_MAX) so the handle
   lies across the palm; the weapon's grip point is the middle of the hole. Without the pictures: the old closed fist.
   ?grip=0: off. */
(function () {
  'use strict';
  const NC = window.NC;
  if (NC.ASSET_MANIFEST_GRIP) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_GRIP);
  // (the user found a hand turned up to 70 degrees "บิดเบี้ยวเยอะ" when attacking: now it turns 20 at most, the grip
  // rule in avatar.js solve() puts the handle across the forearm instead; ?grip=0: the old closed fist)
  const OFF = false;
  const GRIP_MAX = 0.35;
  const cache = {};
  NC.GRIP = !OFF;
  NC.gripOf = (s) => {
    if (!NC.GRIP || !s) return null;
    if (s.name in cache) return cache[s.name];
    const b = NC.SPR[s.name + '_gback'], f = NC.SPR[s.name + '_gfront'], n = NC.SPR[s.name + '_nofist'];
    return (cache[s.name] = b && f && n && b.joints && b.joints.wrist && b.joints.grip
      ? { back: b.name, front: f.name, wrist: b.joints.wrist, grip: b.joints.grip, gax: b.gax || 0 } : null);
  };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  // turn arm bone A's hand (limb L, grip g) so the handle at angle ang lies across the palm: returns the grip point in
  // the rig frame and keeps the turn on the bone (A.wr, A.wristPic) for drawing
  // weapons that ARE held in line with the forearm, so the grip rule (avatar.js solve) leaves them be: guns and the
  // crossbow are aimed along the arm (their grip is a pistol grip under the barrel), a katar's H-grip and knuckles put
  // the blade or the fist straight ahead of the forearm
  const FREE = new Set(['pistol', 'shotgun', 'xbow', 'katar', 'knuckle']);
  NC.gripFree = (W) => FREE.has(NC.wtypeOf ? NC.wtypeOf(W) : W.wtype);

  NC.gripTurn = (A, L, g, ang) => {
    const picLow = Math.atan2(L.end[1] - L.J[1], L.end[0] - L.J[0]);
    const base = Math.atan2(A.end[1] - A.J[1], A.end[0] - A.J[0]) - picLow; // the forearm's picture -> rig turn
    let q = (((ang - g.gax - base) % Math.PI) + Math.PI) % Math.PI; // the handle against the hole, as a line
    if (q > Math.PI / 2) q -= Math.PI;
    const mx = NC.GRIP_TURN_MAX || GRIP_MAX; // (NC.GRIP_TURN_MAX: a test override)
    // (fading to no turn as the handle comes to lie along the forearm, where the closest way round flips side)
    const r = Math.max(-mx, Math.min(mx, q)) * Math.max(0, Math.min(1, (Math.PI / 2 - Math.abs(q)) / 0.45));
    const toRig = (p) => add(A.J, rot(sub(p, L.J), base));
    const W = toRig(g.wrist), G = toRig(g.grip);
    A.wr = r; A.wristPic = g.wrist;
    return add(W, rot(sub(G, W), r));
  };
})();
