/* herospine_others.js — the other heroes in the new rig too (the user, 2026-10-18: "ทำให้ผู้เล่นคนอื่น (ออนไลน์/ปาร์ตี้)
   ใช้ rig ใหม่ด้วย ทั้งท่ายืน เดิน วิ่ง ตีและสกิล"). js/herospine.js draws only the player's own hero from the rig; every
   other hero - net.js's remote players (the ?netmock room and the Go server's, js/online/world.js feeds the same remotes),
   the party's members, the map's adventurers (js/bots.js) and the camp's stall keepers (js/vend.js, sitting) - is drawn by
   NC.Party.draw with the old cut-out moves. Here
   that draw goes through the rig as well, the same way as his: the traveler look as the full rig art (HS.draw), any other
   look as the game's cut-out moved by the rig (HS.drawLook).
   Each of those heroes already keeps the player's own fields (anim: the NC.Anim state with its act / actT / base, moving,
   running, combat, dash, hurt, face, equip, pose), so the rig picks their moves the way it picks his: stand / ready, walk,
   run, dash, sit, the weapon's own attacks on the game's hit time, a skill as one of those attacks, the flinch, death.
   A stand-in per hero (Object.create: every read goes through to the hero) keeps the rig's state (_hspine) off the hero
   and answers the two fields the others keep differently: dead (a remote's 0/1, a member's 25 s countdown -> the
   player's 2.6 s clock, so the death plays once) and dash (a remote's dash flag ds).
   Standing still in a cut-out look, the hero gets the standing legs the player gets (js/idlefeet.js NC.heroStanding).
   Shots and skills from their weapon start at the rig's weapon (NC.weaponLine), a catch sits in the rig's hands
   (NC.rigJoints). ?spineothers=0 off (the old drawing for everyone but the player). */
(function () {
  'use strict';
  const NC = window.NC, HS = NC.HeroSpine;
  if (!HS || !NC.Party) return;
  HS.others = true;

  const SI = new WeakMap(); // hero -> stand-in
  const EQ = new WeakMap(); // the gear object of a hero the rig drew -> his stand-in (NC.weaponLine, NC.rigJoints)
  const DASH = {};
  function standIn(a) {
    let s = SI.get(a);
    if (s) return s;
    s = Object.create(a, {
      dead: { get() { return a.dead > 0 ? Math.max(1e-3, 2.6 - s.deadFor) : 0; } },
      dash: { get() { return a.dash || (a.ds ? DASH : null); } },
    });
    const g = NC.game;
    s.deadAt = a.dead > 0 ? (g ? g.time : 0) - 9 : null; s.deadFor = 0; // (already down when first seen: lying there)
    SI.set(a, s);
    return s;
  }
  const now = () => (NC.game ? NC.game.time : performance.now() / 1000);

  // which hero NC.Party.draw is drawing (it draws him with NC.drawHero(ctx, a.equip, a.pose, ...))
  let cur = null;
  const basePD = NC.Party.draw;
  NC.Party.draw = function (ctx, game, a) {
    const was = cur;
    cur = a && a.equip && a.anim ? a : null;
    try { return basePD.apply(this, arguments); } finally { cur = was; }
  };

  // standing still in a cut-out look: the player's standing legs (NC.heroStanding is true only inside NC.drawPlayer)
  let standing = false;
  const baseSt = NC.heroStanding;
  NC.heroStanding = function () { return standing || (baseSt ? baseSt.apply(this, arguments) : false); };

  const baseDH = NC.drawHero;
  NC.drawHero = function (ctx, equip, P, x, y, o) {
    const a = cur;
    if (a && HS.on && HS.others && equip === a.equip && P === a.pose && !(o && (o.silhouette || o.scale))) {
      const s = standIn(a), t = now();
      if (a.dead > 0) { if (s.deadAt == null) s.deadAt = t; s.deadFor = t - s.deadAt; } else { s.deadAt = null; s.deadFor = 0; }
      if (HS.fits(equip)) {
        if (HS.draw(ctx, s, x, y, o || {})) { EQ.set(equip, s); return; }
      } else if (equip.weapon && NC.ITEMS[equip.weapon]) {
        standing = !a.moving && !s.dash && !(a.atk && a.atk.on) && !a.cast && !(a.anim && a.anim.act) && !(a.dead > 0);
        try { if (HS.drawLook(ctx, s, equip, x, y, o || {})) { EQ.set(equip, s); return; } } finally { standing = false; }
      }
    }
    return baseDH.apply(this, arguments);
  };

  // where their weapon is while the rig draws them: the shots of a remote's bow / staff, the skills' sparks
  const baseWL = NC.weaponLine;
  if (baseWL) NC.weaponLine = function (equip, P, x, y, scale) {
    const s = HS.on && HS.others && equip && EQ.get(equip);
    if (s && (!P || P === s.pose)) { const L = HS.weaponLine(s, x, y, scale, NC.ITEMS[equip.weapon]); if (L) return L; }
    return baseWL.apply(this, arguments);
  };
  const baseRJ = NC.rigJoints;
  if (baseRJ) NC.rigJoints = function (equip, P, x, y, scale) {
    const J = baseRJ.apply(this, arguments), s = J && HS.on && HS.others && equip && EQ.get(equip);
    if (s && P && P === s.pose) { const H = HS.hands(s, x, y, scale); if (H) Object.assign(J, H); }
    return J;
  };

  // (tests) the rig's state of another hero: what plays
  HS.otherStatus = (a) => { const s = SI.get(a); return s ? HS.status(s) : null; };
})();
