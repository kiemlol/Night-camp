/* The web online client's side of the dragon knight (js/class2_skills_a.js, js/skills_v21.js, backend/job_dragonknight.go):
   the server rolls the dragon's tail off a basic hit and fires the wyvern's fireballs, and sends a `dragon` event for
   each look: `tail` (the lances' angles, from the hero's hand) and `wyvern` (a fireball from the wyvern's mouth at the
   monster it fights). They are drawn as the offline game draws them (skills_v21.js:297-304, class2_skills_a.js:403-410)
   with K.shot, whose strikes here only look: the numbers come from the server's combat events.
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC;
  const TAIL = { v: 1250, range: 620, r: 40, size: 1.5, trail: 0.6 };
  const SPIT = { v: 820, range: 620, home: 4, aimLift: 40, size: 0.9, grow: 0.03, burst: 70, drop: 40, trail: 0.7 };
  let selfId = '';

  function heroOf(game, id) {
    if (id && id === selfId) return game.player;
    return NC.Online?.remotes?.get(id) || null;
  }
  // the hand the lances leave from (skills.js hand(p)), else where the server put it
  function handOf(hero, data) {
    try { return hero ? NC.skillHelpers.hand(hero) : [data.x, data.y]; } catch { return [data.x, data.y]; }
  }
  function tail(game, hero, data) {
    const K = NC.SkillKit, V = NC.VFX, from = handOf(hero, data);
    for (const ang of data.angles || []) {
      K.shot(game, hero || game.player, 'dk_tail', {
        from, ang, v: TAIL.v, range: TAIL.range, r: TAIL.r, pierce: true, rgb: V.RGB.fire, style: 'arrow', size: TAIL.size,
        hit() {},
        trail(q) { if (Math.random() < TAIL.trail) V.flameAt(q.x, q.y + 10, 22, 40, V.PAL.fire, 0.3, { vy: -50 }); },
      });
    }
  }
  function spit(game, hero, data) {
    const K = NC.SkillKit, V = NC.VFX, rand = NC.rand;
    const e = (game.enemies || []).find((m) => (m.sid || m.id) === data.targetId);
    K.shot(game, hero || game.player, 'dk_wyvern', {
      from: [data.x, data.y], ang: e ? NC.angle(data.x, data.y, e.x, e.y - SPIT.aimLift) : data.aim || 0, v: SPIT.v, range: SPIT.range,
      rgb: V.RGB.fire, size: SPIT.size + (data.lv || 1) * SPIT.grow, home: SPIT.home, target: e,
      trail(q) { if (Math.random() < SPIT.trail) V.flameAt(q.x + rand(-6, 6), q.y + 14, rand(14, 22), rand(24, 36), V.PAL.fire, 0.25, { vy: -40 }); },
      hit(t, q) { K.burst(game, q.x, q.y + SPIT.drop, SPIT.burst, V.RGB.fire, { shake: 2, sparks: 8, flare: false }); },
    });
  }
  function onEvent(event) {
    const data = event.detail, game = NC.game;
    if (!data || data.type !== 'dragon' || !game || !NC.SkillKit) return;
    const hero = heroOf(game, data.actorId);
    if (data.kind === 'tail') tail(game, hero, data);
    else if (data.kind === 'wyvern') spit(game, hero, data);
  }
  window.addEventListener('nightcamp:online-snapshot', (event) => { selfId = event.detail?.snapshot?.self?.id || selfId; });
  window.addEventListener('nightcamp:online-event', onEvent);
})();
