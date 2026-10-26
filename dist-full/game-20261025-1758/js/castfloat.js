/* castfloat.js — a floating, one-leg spell cast (the user, 2026-10-02: "ท่าร่ายเวทใหม่ เป็นลอย ยืนขาเดียว แล้วร่าย").
   With a magic weapon (staff, orb, lantern, bell; the bishop's book too) the cast bar (casting.js) plays this instead of
   the raised-weapon castHold: a little dip, then the hero rises off the ground on one leg (the far knee up), the staff
   held upright low in front so the face stays clear, the free fist out; the hold bobs gently while the bar fills. When
   the spell goes off: the staff thrusts forward (castRelease) and the hero lands; a cancelled cast just lets go.
   Hooks: NC.updateHeroAnim (after casting.js has started castHold: switched to castFloat; the bob; the release). */
(function () {
  'use strict';
  const NC = window.NC, Anim = NC.Anim;
  if (!Anim) return;

  // the held pose (rig channels: arm/weapon angles 0 = straight ahead, negative = raised; legs: positive = forward)
  const HOLD = { y: -32, legF: 0.08, kF: 0.1, legB: 1.1, kB: 1.9, aF: 0.35, eF: -0.1, wAng: -1.25, aB: -0.2, eB: 0.1, lean: -0.05, head: -0.06 };
  const DIP = { y: 3, legF: 0.15, kF: 0.45, legB: -0.1, kB: 0.45, aF: 0.7, eF: 0.5, wAng: -1.5, aB: 0.6, eB: 0.6, lean: 0.06, head: 0.02 };
  const THRUST = { y: -34, legF: 0.08, kF: 0.1, legB: 1.1, kB: 1.9, aF: 0.0, eF: -0.1, wAng: -0.5, aB: -0.1, eB: 0.0, lean: 0.15, head: 0.0 };
  const LAND = { y: 0, legF: 0.1, kF: 0.25, legB: -0.05, kB: 0.25, aF: 0.6, eF: 0.4, wAng: -1.4, aB: 0.9, eB: 0.4, lean: 0.05, head: 0.0 };
  const keysOf = (frames) => {
    const k = { tuck: [[0.02, 0]], wPush: [[0.02, 0]] };
    for (const [t, P, curve] of frames) for (const ch in P) (k[ch] = k[ch] || []).push([t, P[ch], curve || 'inout']);
    return k;
  };
  // rise: dip, then up onto one leg (held at the end while the bar fills)
  Anim.addClip('castFloat', { dur: 0.46, in: 0.08, out: 0.25, hold: true, fidget: false,
    keys: keysOf([[0.12, DIP, 'inout'], [0.46, HOLD, 'out']]) });
  // the spell goes off: the staff thrust forward, then down to the ground
  Anim.addClip('castRelease', { dur: 0.5, in: 0.02, out: 0.18,
    keys: keysOf([[0, HOLD], [0.07, THRUST, 'snap'], [0.22, THRUST, 'inout'], [0.5, LAND, 'in']]) });

  const magic = (p) => { const W = NC.weaponDef ? NC.weaponDef(p) : NC.ITEMS[p.equip.weapon]; return !!W && (W.magic || W.wtype === 'book'); };
  const base = NC.updateHeroAnim;
  NC.updateHeroAnim = function (game, dt) {
    const p = game.player, st = p && p.anim;
    // a cast just started: the floating cast in place of the raised weapon
    if (p && p.casting && st && st.act === 'castHold' && magic(p)) Anim.play(st, 'castFloat');
    // the cast ended while floating: it went off (its cooldown is running) -> the release, else let go
    if (p && !p.casting && st && st.act === 'castFloat') {
      const id = p._castFloatId;
      if (id && NC.skillCd && NC.skillCd(p, id) > 0) Anim.play(st, 'castRelease'); else Anim.stop(st);
    }
    if (p) p._castFloatId = p.casting ? p.casting.id : p._castFloatId;
    const r = base.apply(this, arguments);
    if (!p || !p.pose || !st) return r;
    // the hold bobs: up and down a little while the bar fills
    if (st.act === 'castFloat' && st.actT >= 0.46) p.pose.y += Math.sin(game.time * 3.4) * 3.5;
    // the spell's own cast pose took over (castSkill's swing): come down from the float over 0.3 s, legs and all,
    // while the arms do the cast
    if (st.act === 'castFloat') p._floatPose = { y: p.pose.y, legF: p.pose.legF, kF: p.pose.kF, legB: p.pose.legB, kB: p.pose.kB };
    else if (p._floatPose && !p._land) { p._land = { from: p._floatPose, t: 0 }; p._floatPose = null; }
    if (p._land) {
      const L = p._land, u = Math.min(1, (L.t += dt) / 0.3), k = u * u * (3 - 2 * u);
      for (const ch in L.from) p.pose[ch] = L.from[ch] + (p.pose[ch] - L.from[ch]) * k;
      if (u >= 1) p._land = null;
    }
    return r;
  };
})();
