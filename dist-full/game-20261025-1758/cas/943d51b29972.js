/* The web online client's side of the knight family's class 3 (js/class3_skills_a.js, backend/job_dawnwarden.go,
   job_dragonbound.go, job_starblade.go, job_bloodmoon.go). The server runs the signatures and the awakenings' hooks
   and sends what the skill file's looks need; they are drawn with its own look functions (NC.C3.knightLooks), their
   numbers being the usual combat and heal events:
   - the dwDawn meter (every hero's record) goes onto p.dwDawn, which the dawnwarden's drawFront draws as the sun over
     its head;
   - `class3` events of the family's kinds: sunBurst (the dawnwarden's burst round it), ember (a dragonbound's ember
     on a monster), emberBlast (five of them going off, where the monster was), breath (its awake cone of fire),
     star (a starblade's five marks joined, and their novas 0.3 s later), blade (its awake crystal blade at a monster)
     and wave (a bloodmoon's awake shockwave);
   - below half HP a bloodmoon gives off blood motes: offline its signature's tick does it, which never runs online,
     so its drawFront does it for the heroes online.
   The core's own (the ring, the back-piece, the giant, the effects) are js/online-class3.js, which loads before this
   file. Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC, C3 = NC.C3, KL = C3 && C3.knightLooks;
  if (!KL || !NC.Online) return;
  const STAR_DELAY = 0.3; // (js/class3_skills_a.js: the star's novas 0.3 s after it joins)
  const num = (meters, key) => Number(meters?.[key]) || 0;
  const heroOf = (game, id) => (game.player && game.player.id === id ? game.player : NC.Online?.remotes?.get(id));
  const monsterOf = (game, id) => (id ? (game.enemies || []).find((m) => (m.sid || m.id) === id) : null);

  function onSnapshot(event) {
    const game = NC.game, data = event.detail?.snapshot;
    if (!game || !data?.self) return;
    if (game.player) game.player.dwDawn = num(data.self.meters, 'dwDawn');
    for (const remote of NC.Online?.remotes?.values() || []) remote.dwDawn = num(remote.meters, 'dwDawn');
  }

  const LOOKS = {
    sunBurst: (game, p, data, mine) => KL.sunBurst(game, p, mine),
    ember: (game, p, data) => { const e = monsterOf(game, data.targetId); if (e) KL.ember(e); },
    emberBlast: (game, p, data, mine) => KL.emberBlast(game, data.x, data.y, mine),
    breath: (game, p, data) => KL.breath(p, Number(data.ang) || 0),
    star: (game, p, data, mine) => {
      const pts = (data.pts || []).filter((pt) => Array.isArray(pt) && pt.length >= 2);
      if (pts.length < 3) return;
      KL.star(pts);
      NC.VFX.at(STAR_DELAY, () => {
        for (const [x, y] of pts) KL.starNova(game, x, y, mine);
        if (mine) KL.starFlash();
      });
    },
    blade: (game, p, data) => { const e = monsterOf(game, data.targetId); if (e) KL.blade(game, p, e); },
    wave: (game, p, data, mine) => KL.wave(game, p, Number(data.ang) || 0, mine),
  };

  function onEvent(event) {
    const data = event.detail, game = NC.game, look = data && data.type === 'class3' && LOOKS[data.kind];
    if (!look || !game) return;
    const p = heroOf(game, data.actorId);
    if (!p) return; // (out of this client's sight)
    look(game, p, data, p === game.player);
  }

  // the blood motes of a bloodmoon below half HP, for the heroes online (offline its signature's tick draws them)
  function wrapBloodmoon() {
    const J = C3.jobs.bloodmoon;
    if (!J || J.drawFront?.online) return;
    const base = J.drawFront;
    J.drawFront = function (ctx, game, p, st) {
      if (base) base.call(this, ctx, game, p, st);
      if (p && p.online && !game.presentationOnly) KL.bloodMotes(p);
    };
    J.drawFront.online = true;
  }

  wrapBloodmoon();
  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  window.addEventListener('nightcamp:online-event', onEvent);
})();
