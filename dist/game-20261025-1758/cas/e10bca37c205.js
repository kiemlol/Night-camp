/* swingkeep.js — a basic swing a skill cuts short still lands its blow (2026-10-18, after js/aspdgear.js made attacks
   slower without speed gear). Before, a skill that strikes a pose or opens a cast bar (skills.js pose, casting.js start)
   set p.atk.on = false and a swing whose 'hit' event was still ahead was simply thrown away. A rotation that presses its
   skills the moment they come back (the auto farm's keyOrder, tools/balance.js, a player mashing) meets every swing at the
   same point of its clip, so a build's damage fell off a cliff at one speed instead of a slope:
     the fire mage's orb build (tools/balance_builds.js 60): frostdiver / thunder every ~1.4 s, three swings between them
     (castBolt1, castBolt2, castBolt3, the finisher's blow at 0.36 s of its clip). At the previous x1.54 speed the finisher had
     reached 0.47 of clip time when the next cast came and landed; at x1.29 it had reached 0.349, so every finisher went,
     and with it the burns and the seeking splits it brings (single DPS 1,850 -> 490).
     the auto farm too (tools/farmsim.js, ย่านริมคลอง canal, 90 s): finishers cut before their blow 34 of 46 at x1.29, 33 of 72
     at x1.54 — and every build's swings that a skill catches in the wind-up, at any speed.
   Now, as on the Go server (combat.go swing queues a swing's blows at the press and startCast leaves them), the blows still
   ahead of a swing cut by a skill land when the swing would have landed them (a bolt leaves from where the swing would have
   held the weapon), so a slower swing only lands a little later and nothing is thrown away: the skill is never held back.
   Measured (tools/balance.js): build 60 at x1.29 490 -> ~2,000 (basic ~20% + burns ~35% again), at x1.54 +3%; over the
   78 builds 42 of 74 stay within ±8%, 31 go up 8–56%: the hybrids whose swings the skills used to cut (online they always
   landed). Tried first and dropped: the skill waiting for the blow — casters lost 12–20% (their spells waited on staff bolts).
   Still lost, also as on the server (mobility.go, boss_ultimate.go): a swing cut by a dash, by a boss set's skill, by a
   fall, or left behind on a map change. With ?online the server does all this itself: nothing here runs.
   Hooks: NC.weaponHit (entities.js, the swing's blow), NC.updateHeroAnim (watching the swing), NC.skillTicks (the blows
   land inside the hero's update, so the gun / instrument shots keep their looks: jobs3_skills_b.js), NC.skillCasts. */
(function () {
  'use strict';
  const NC = window.NC, SK = NC.SKILLS;
  if (NC.ONLINE || !NC.weaponHit || !NC.updateHeroAnim || !NC.skillTicks || !NC.Anim) return;
  let cur = null;      // the hero's swing at the end of the last frame
  let due = [];        // the blows of cut swings still to land: { at, step, clip, ang, x0, y0, pose, w, map }
  let bossT = -1;      // when a boss set's skill last went off (its pose drops the swing, as on the server)
  if (NC.skillCasts) NC.skillCasts.push((game, p, id) => { if (game && p === game.player && SK[id] && SK[id].boss) bossT = game.time; });
  const speedOf = (p) => Math.max(0.2, NC.atkSpeed(p, NC.weaponDef(p)));
  // the swing's pose at its blow (anim.js sample: the stance with the clip at the blow's time, aimed as the swing was, as
  // entities.js updateHeroAnim aims it), so the bolt leaves from where the swing would have held the weapon; the rig, when
  // it draws the hero, gives its own weapon line anyway (herospine.js HS.weaponLine)
  function poseAt(p, s, te) {
    try {
      const a = s.face > 0 ? s.ang : Math.PI - s.ang, P = NC.Anim.sample(s.name, te, NC.animCtx(p.equip, { al: NC.clamp(Math.atan2(Math.sin(a), Math.cos(a)), -1.2, 1.2) }));
      P.face = s.face;
      return P;
    } catch (e) { return s.pose; }
  }

  const baseAnim = NC.updateHeroAnim;
  NC.updateHeroAnim = function (game, dt) {
    const p = game.player, A = p && p.atk;
    if (cur && A) {
      const st = p.anim, going = A.on && A.name === cur.name && st.act === cur.name && st.actT >= cur.t;
      if (!going) {
        const lost = p.dead > 0 || p.dash || bossT === game.time || game.mapId !== cur.map || p.equip.weapon !== cur.w;
        if (!lost) for (const [te, name] of cur.clip.ev || []) {
          if (name === 'hit' && te > cur.t) due.push({ at: game.time + (te - cur.t) / cur.spd, step: cur.step, clip: cur.clip, ang: cur.ang, x0: cur.x0, y0: cur.y0, pose: poseAt(p, cur, te), w: cur.w, map: cur.map });
        }
        cur = null;
      }
    }
    const r = baseAnim.apply(this, arguments);
    if (p && A && A.on && p.anim.act === A.name && NC.Anim.CLIPS[A.name]) {
      if (!cur || cur.name !== A.name || p.anim.actT < cur.t) cur = { name: A.name, clip: NC.Anim.CLIPS[A.name], step: A.step, ang: A.ang, face: p.face, x0: A.x0, y0: A.y0, w: p.equip.weapon, map: game.mapId };
      cur.t = p.anim.actT; cur.spd = speedOf(p); cur.pose = p.pose;
    } else cur = null;
    return r;
  };

  // landing: the swing's aim, start and pose at the blow put back for it (weaponHit reads p.atk, and p.pose for the weapon's
  // tip: not the raised staff of a cast bar), then the hero's own again
  NC.skillTicks.push((game, p) => {
    if (!due.length || p !== game.player) return;
    const now = [];
    due = due.filter((d) => { if (d.at > game.time) return true; now.push(d); return false; });
    for (const d of now) {
      if (p.dead > 0 || game.mapId !== d.map || p.equip.weapon !== d.w) continue;
      const A = p.atk, keep = { ang: A.ang, x0: A.x0, y0: A.y0, step: A.step }, pose = p.pose;
      A.ang = d.ang; A.x0 = d.x0; A.y0 = d.y0; A.step = d.step;
      if (d.pose) p.pose = d.pose;
      try { NC.weaponHit(game, p, NC.weaponDef(p), d.step, d.clip); } finally { Object.assign(A, keep); p.pose = pose; }
    }
  });
  NC.SWING_KEEP = { due: () => due.length }; // (testing)
})();
