/* The web online client's side of the rogue family's class-3 jobs (js/class3_skills_b.js:231-448; backend/job_eclipse.go,
   job_shadowlord.go, job_harvester.go, job_showmaster.go). The server runs their signatures; the client draws them from
   what it sends, with the skill file's own looks (C3.jobs.<job>.looks):
   - meters of every hero's record: ecDark (the eclipse's darkness, 0-10) and hvPhase (the harvest moon, 0-8) go onto
     p.ecDark and p.hvPhase, which the jobs' drawFront read; slCopies (how many shadow copies stand by) onto p.slCopies,
     which the shadowlord's drawBack reads for another hero (the local hero counts them from its own skills and
     awakening, js/online-class3.js's p.c3);
   - `class3` events: eclipse (the flash and the words, then a slash on each target in turn that still stands), copy (a
     shadow copy's cut from its hand to the monster), crescent (the giant slashes 200 ahead down the aim), act (the
     words "องก์ n"), curtain (the drapes, and 0.3 s on K.nova's burst); another hero's do not flash or shake the screen.
     Their numbers are the usual combat events.
   It goes after js/online-class3.js. Apart from js/online.js so the FX replay sources stay untouched
   (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC, C3 = NC.C3;
  if (!C3 || !NC.Online) return;
  const JOBS = new Set(['eclipse', 'shadowlord', 'harvester', 'showmaster']);
  const FIELDS = { ecDark: 'ecDark', hvPhase: 'hvPhase', slCopies: 'slCopies' };
  const SLASH_FIRST = 0.12, SLASH_GAP = 0.12; // (js/class3_skills_b.js:251 each target 0.12 + 0.12 i s after the eclipse)
  const BURST_DELAY = 0.3; // (:416 the curtain bursts 0.3 s after it falls)
  const num = (meters, key) => Number(meters?.[key]) || 0;
  const heroOf = (game, id) => (game.player && game.player.id === id ? game.player : NC.Online?.remotes?.get(id));
  const monsterOf = (game, id) => (id ? (game.enemies || []).find((m) => (m.sid || m.id) === id) : null);

  function sync(p, meters) {
    if (!p) return;
    for (const [key, field] of Object.entries(FIELDS)) p[field] = num(meters, key);
  }
  function onSnapshot(event) {
    const game = NC.game, data = event.detail?.snapshot;
    if (!game || !data?.self) return;
    sync(game.player, data.self.meters);
    for (const remote of NC.Online?.remotes?.values() || []) sync(remote, remote.meters);
  }

  // each event kind's look: (game, the hero, its job, the event, whether it is the local hero)
  const LOOKS = {
    eclipse(game, p, L, data, mine) {
      L.eclipse(p, mine);
      (data.targets || []).forEach((t, i) => NC.VFX.at(SLASH_FIRST + i * SLASH_GAP, () => {
        const e = monsterOf(game, t.id);
        if (e) L.slash(p, e);
      }));
    },
    copy(game, p, L, data) { L.copy(data.x, data.y, monsterOf(game, data.targetId) || { x: data.tx, y: data.ty }); },
    crescent(game, p, L, data, mine) { L.crescent(game, p, data.x, data.y, Number(data.ang) || 0, null, mine); },
    act(game, p, L, data) { L.act(p, data.n); },
    curtain(game, p, L, data, mine) {
      L.curtain(data.x, data.y);
      NC.VFX.at(BURST_DELAY, () => L.burst(game, p, data.x, data.y, mine));
    },
  };

  function onEvent(event) {
    const data = event.detail, game = NC.game, look = data && LOOKS[data.kind];
    if (!look || data.type !== 'class3' || !game) return;
    const p = heroOf(game, data.actorId), J = p && C3.jobOf(p);
    if (!J || !JOBS.has(J.id) || !J.looks) return; // (out of this client's sight, or another family's kind)
    look(game, p, J.looks, data, p === game.player);
  }

  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  window.addEventListener('nightcamp:online-event', onEvent);
})();
